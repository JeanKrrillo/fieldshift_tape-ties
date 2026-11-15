"""Recolector de capas numéricas: toma el valor real de cada mapa en los mismos puntos de `ia_cultivos` y lo guarda en `capas_muestras`.
Cada fuente corre en paralelo (hilo propio con su grupo de peticiones). Todo se reanuda: lo ya guardado se salta.
Uso:  python -m backend.recolector_capas            (todas)   |   python -m backend.recolector_capas modis_ndvi dem"""
import sqlite3, sys, time, threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
import requests
from backend.ia_cultivos import DB, PC, _punto, ANIO
DBC = DB.parent / "capas.sqlite"  # base aparte: así no choca con la recolección de cultivos que escribe en field_shift.sqlite

# Cada fuente: colección de Planetary Computer, variables (activo → (nombre, escala, offset, mínimo, máximo)), fechas objetivo (None = un valor del año).
# Los mínimos y máximos descartan valores de relleno de cada producto (nubes, sin dato).
FECHAS = [f"{ANIO}-{m}" for m in ("06-01", "06-25", "07-15", "08-05", "08-25", "09-15")]
FUENTES = {
    "modis_ndvi": dict(col="modis-13Q1-061", vars={"250m_16_days_NDVI": ("ndvi", 1e-4, 0, -0.2, 1.0), "250m_16_days_EVI": ("evi", 1e-4, 0, -0.2, 1.0)}, fechas=FECHAS, ventana=8),
    "modis_lst": dict(col="modis-11A2-061", vars={"LST_Day_1km": ("temp_suelo_dia_c", 0.02, -273.15, -40, 70)}, fechas=FECHAS, ventana=8),
    "modis_lai": dict(col="modis-15A2H-061", vars={"Lai_500m": ("lai", 0.1, 0, 0, 10), "Fpar_500m": ("fpar", 0.01, 0, 0, 1)}, fechas=FECHAS, ventana=8),
    "modis_et": dict(col="modis-16A3GF-061", vars={"ET_500m": ("et_anual_mm", 0.1, 0, 0, 3000), "PET_500m": ("pet_anual_mm", 0.1, 0, 0, 5000)}, fechas=None, ventana=0),
    "worldcover": dict(col="esa-worldcover", vars={"map": ("clase_worldcover", 1, 0, 10, 100)}, fechas=None, ventana=0),
    "dem": dict(col="cop-dem-glo-30", vars={"data": ("elevacion_m", 1, 0, -500, 9000)}, fechas=None, ventana=0),
}
_LOCK = threading.Lock()


def _items(f, bbox):
    q = {"collections": [f["col"]], "bbox": bbox, "limit": 500}
    q["datetime"] = f"{ANIO}-05-15/{ANIO}-10-05" if f["fechas"] else (f"{ANIO}-01-01/{ANIO}-12-31" if f["col"] != "cop-dem-glo-30" else None)
    if q["datetime"] is None:
        del q["datetime"]
    fs, url = [], f"{PC}/stac/v1/search"
    r = requests.post(url, json=q, timeout=60).json()
    for x in r.get("features", []):
        d = (x["properties"].get("datetime") or x["properties"].get("start_datetime") or "")[:10]
        fs.append({"id": x["id"], "fecha": d, "bbox": x["bbox"], "assets": list(x["assets"])})
    return fs


def _elige(items, lon, lat, fecha, ventana):
    cand = [i for i in items if i["bbox"][0] <= lon <= i["bbox"][2] and i["bbox"][1] <= lat <= i["bbox"][3]]
    if fecha:
        d = datetime.strptime(fecha, "%Y-%m-%d")
        cand = [i for i in cand if i["fecha"] and abs((datetime.strptime(i["fecha"], "%Y-%m-%d") - d).days) <= ventana + 8]
        cand.sort(key=lambda i: abs((datetime.strptime(i["fecha"], "%Y-%m-%d") - d).days))
    return cand


def _tarea(args):
    nombre, f, items, idx, lon, lat, fecha = args
    cands = _elige(items, lon, lat, fecha, f["ventana"])
    if not cands:
        return []
    r = None
    for it in cands[:4]:  # las cajas de las losas se traslapan: si una no cubre el punto, se prueba la siguiente
        act = [a for a in f["vars"] if a in it["assets"]]
        r = _punto(f["col"], it["id"], act, lon, lat)
        if r:
            break
    if not r:
        return None  # error de red o sin dato: no se anota, se reintenta en la siguiente corrida
    out = []
    for a, v in zip(act, r["values"]):
        nom, esc, off, lo, hi = f["vars"].get(a, f["vars"].get("data"))
        val = None if v is None else v * esc + off
        out.append((f"ia_{idx}", lon, lat, nombre, nom, fecha or str(ANIO), None if val is None or not lo <= val <= hi else round(val, 4)))
    return out


def correr(nombre, con_pts):
    f = FUENTES[nombre]
    con = sqlite3.connect(DBC, timeout=60)
    con.execute("CREATE TABLE IF NOT EXISTS capas_muestras (punto TEXT, lon REAL, lat REAL, fuente TEXT, variable TEXT, fecha TEXT, valor REAL, PRIMARY KEY (punto, fuente, variable, fecha))")
    con.execute("CREATE TABLE IF NOT EXISTS recoleccion_estado (fuente TEXT PRIMARY KEY, total INTEGER, hechas INTEGER, errores INTEGER, estado TEXT, actualizado TEXT)")
    xs = [p[1] for p in con_pts]; ys = [p[2] for p in con_pts]
    items = _items(f, [min(xs), min(ys), max(xs), max(ys)])
    hechos = {(r[0], r[1]) for r in con.execute("SELECT punto, fecha FROM capas_muestras WHERE fuente=?", (nombre,))}
    pend = [(nombre, f, items, i, x, y, fe) for i, x, y in con_pts for fe in (f["fechas"] or [None]) if (f"ia_{i}", fe or str(ANIO)) not in hechos]
    total, hechas, errores = len(pend), 0, 0
    def est(s):
        with _LOCK:
            con.execute("INSERT OR REPLACE INTO recoleccion_estado VALUES (?,?,?,?,?,?)", (nombre, total, hechas, errores, s, datetime.now().isoformat(timespec="seconds"))); con.commit()
    est("corriendo")
    with ThreadPoolExecutor(max_workers=8) as ex:
        for k, filas in enumerate(ex.map(_tarea, pend), 1):
            if filas is None:
                errores += 1
            else:
                with _LOCK:  # un solo hilo escribe a la vez: varias conexiones a la misma base chocan
                    con.executemany("INSERT OR REPLACE INTO capas_muestras VALUES (?,?,?,?,?,?,?)", filas); con.commit()
                hechas += 1
            if k % 100 == 0:
                est("corriendo")
    est("terminada"); con.close()
    print(nombre, "listo:", hechas, "tareas,", errores, "errores", flush=True)


def main(nombres):
    con = sqlite3.connect(DB, timeout=60)
    pts = con.execute("SELECT idx, lon, lat FROM ia_cultivos").fetchall(); con.close()
    print(len(pts), "puntos de ia_cultivos;", "fuentes:", nombres, flush=True)
    ts = [threading.Thread(target=correr, args=(n, pts)) for n in nombres]
    [t.start() for t in ts]; [t.join() for t in ts]


if __name__ == "__main__" and sys.argv[1:2] != ["bbox"]:
    main(sys.argv[1:] or list(FUENTES))


# ---------- Lectura por recorte: una petición por fecha y producto trae todos los píxeles de la zona ----------
def correr_bbox(nombre, lado=768):
    """Para productos de resolución gruesa (MODIS): en vez de una petición por punto, baja un recorte de la zona
    y toma el valor de cada punto localmente (píxel más cercano). Mismas tablas y mismas reglas de rango que `correr`."""
    import io
    import numpy as np
    f = FUENTES[nombre]
    con_pts = sqlite3.connect(DB, timeout=60).execute("SELECT idx, lon, lat FROM ia_cultivos").fetchall()
    xs = np.array([p[1] for p in con_pts]); ys = np.array([p[2] for p in con_pts])
    w, s, e, n = xs.min() - 0.01, ys.min() - 0.01, xs.max() + 0.01, ys.max() + 0.01
    items = _items(f, [w, s, e, n])
    con = sqlite3.connect(DBC, timeout=60)
    con.execute("CREATE TABLE IF NOT EXISTS capas_muestras (punto TEXT, lon REAL, lat REAL, fuente TEXT, variable TEXT, fecha TEXT, valor REAL, PRIMARY KEY (punto, fuente, variable, fecha))")
    con.execute("CREATE TABLE IF NOT EXISTS recoleccion_estado (fuente TEXT PRIMARY KEY, total INTEGER, hechas INTEGER, errores INTEGER, estado TEXT, actualizado TEXT)")
    fechas = f["fechas"] or [None]
    total, hechas, errores = len(fechas) * len(f["vars"]), 0, 0
    def est(st):
        con.execute("INSERT OR REPLACE INTO recoleccion_estado VALUES (?,?,?,?,?,?)", (nombre, total * len(con_pts), hechas * len(con_pts), errores * len(con_pts), st, datetime.now().isoformat(timespec="seconds"))); con.commit()
    est("corriendo")
    ancho = lado; alto = max(64, int(lado * (n - s) / (e - w)))
    for fe in fechas:
        cands = _elige(items, (w + e) / 2, (s + n) / 2, fe, f["ventana"])
        for act, (nom, esc, off, lo, hi) in f["vars"].items():
            ok = False
            for it in cands[:3]:
                if act not in it["assets"]:
                    continue
                try:
                    r = requests.get(f"{PC}/data/v1/item/bbox/{w},{s},{e},{n}/{ancho}x{alto}.npy", params=[("collection", f["col"]), ("item", it["id"]), ("assets", act)], timeout=180)
                except requests.RequestException:
                    continue
                if r.status_code != 200:
                    continue
                a = np.load(io.BytesIO(r.content), allow_pickle=True)  # (valor, máscara)
                val, msk = a[0].astype(float), a[1]
                cx = np.clip(((xs - w) / (e - w) * ancho).astype(int), 0, ancho - 1); cy = np.clip(((n - ys) / (n - s) * alto).astype(int), 0, alto - 1)
                filas = []
                for (i, lon, lat), x, y in zip(con_pts, cx, cy):
                    v = val[y, x] * esc + off if msk[y, x] > 0 else None
                    filas.append((f"ia_{i}", lon, lat, nombre, nom, fe or str(ANIO), None if v is None or not lo <= v <= hi else round(float(v), 4)))
                con.executemany("INSERT OR REPLACE INTO capas_muestras VALUES (?,?,?,?,?,?,?)", filas); con.commit(); ok = True; break
            hechas += ok; errores += (not ok)
            est("corriendo")
    est("terminada"); print(nombre, "por recorte:", hechas, "de", total, "recortes", flush=True)


if __name__ == "__main__" and sys.argv[1:2] == ["bbox"]:
    for _n in sys.argv[2:]:
        correr_bbox(_n)
