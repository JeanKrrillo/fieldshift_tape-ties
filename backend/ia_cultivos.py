"""IA de cultivos: qué cultivo hay en un punto, a partir de la curva de verdor de Sentinel-2 en una temporada.
Etiquetas = USDA CDL 2021 (real). Entradas = NDVI y NDMI de 6 fechas de 2021 (real, Planetary Computer).
Uso:  python -m backend.ia_cultivos muestrear 1500   (reanudable)   |   python -m backend.ia_cultivos entrenar
Para sumar más capas como entrada (suelo, elevación, clima) se añaden columnas a FEATURES en `muestrear`."""
import json, random, sqlite3, sys, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests
from backend.base import _HTTP

PC = "https://planetarycomputer.microsoft.com/api"
DB = Path(__file__).resolve().parents[2] / "privado" / "datos" / "field_shift.sqlite"
MODELO_2021 = DB.parent / "modelo_cultivos.joblib"
MODELO = DB.parent / "modelo_cultivos_multianio.joblib"  # entrenado con 2018-2021; si no existe se usa el de 2021 solo
TESELA, ANIO = "15TVG", 2021
OBJETIVOS = ["06-01", "06-25", "07-15", "08-05", "08-25", "09-15"]  # fechas aproximadas: siembra reciente, crecimiento, pico y llenado
CLASES = {1: "maiz", 5: "soya", 24: "trigo", 36: "alfalfa", 37: "heno", 176: "pastizal", 111: "agua", 121: "urbano", 122: "urbano", 123: "urbano", 124: "urbano",
          141: "bosque", 142: "bosque", 143: "bosque", 190: "humedal", 195: "humedal", 152: "arbustos"}


def _post(url, **kw):
    for i in range(4):
        try:
            r = _HTTP.get(url, timeout=60, **kw)  # sesión compartida: no abre una conexión por punto
            if r.status_code == 200:
                return r.json()
            if r.status_code in (400, 404, 422):
                return None  # el punto no cae en ese raster: reintentar no sirve
        except requests.RequestException:
            pass  # corte de red o SSL: se reintenta con espera
        time.sleep(1.5 * (i + 1))
    return None


def escenas():
    q = {"collections": ["sentinel-2-l2a"], "datetime": f"{ANIO}-05-15/{ANIO}-09-30", "query": {"s2:mgrs_tile": {"eq": TESELA}, "eo:cloud_cover": {"lt": 20}}, "limit": 100}
    fs = requests.post(f"{PC}/stac/v1/search", json=q, timeout=60).json()["features"]
    out = []
    for o in OBJETIVOS:
        d = time.mktime(time.strptime(f"{ANIO}-{o}", "%Y-%m-%d"))
        f = min(fs, key=lambda x: abs(time.mktime(time.strptime(x["properties"]["datetime"][:10], "%Y-%m-%d")) - d))
        out.append({"id": f["id"], "fecha": f["properties"]["datetime"][:10], "base": float(f["properties"].get("s2:processing_baseline", "5")), "bbox": f["bbox"]})
    return out


def item_cdl(bbox):
    fs = requests.get(f"{PC}/stac/v1/search", params={"collections": "usda-cdl", "datetime": f"{ANIO}-01-01/{ANIO}-12-31", "bbox": ",".join(map(str, bbox)), "limit": 50}, timeout=60).json()["features"]
    return [(f["id"], f["bbox"]) for f in fs if f["id"].startswith("cropland_")]


def _punto(coleccion, item, assets, lon, lat):
    return _post(f"{PC}/data/v1/item/point/{lon},{lat}", params=[("collection", coleccion), ("item", item)] + [("assets", a) for a in assets])


def _etiqueta(items, lon, lat):
    for it, b in items:
        if not (b[0] <= lon <= b[2] and b[1] <= lat <= b[3]):
            continue  # el item CDL no cubre este punto: ahorra una petición
        r = _punto("usda-cdl", it, ["cropland"], lon, lat)
        if r and r.get("values") and r["values"][0] not in (None, 0):
            return int(r["values"][0])
    return None


def serie_s2(es, lon, lat):
    """NDVI y NDMI del punto en cada escena de `es` (None donde hay nube, sombra o sin dato)."""
    ndvi, ndmi = [], []
    for e in es:
        r = _punto("sentinel-2-l2a", e["id"], ["B04", "B08", "B11", "SCL"], lon, lat)
        if not r:
            ndvi.append(None); ndmi.append(None); continue
        rojo, nir, swir, scl = r["values"]
        if scl in (3, 8, 9, 10, 11) or not nir or not rojo:
            ndvi.append(None); ndmi.append(None); continue
        off = 1000 if e["base"] >= 4.0 else 0
        rojo, nir, swir = rojo - off, nir - off, (swir or 0) - off
        ndvi.append(round((nir - rojo) / (nir + rojo), 4) if nir + rojo > 0 else None)
        ndmi.append(round((nir - swir) / (nir + swir), 4) if nir + swir > 0 else None)
    return ndvi, ndmi


def _fila(args):
    i, lon, lat, es, items = args
    cod = _etiqueta(items, lon, lat)
    if cod is None:
        return None
    ndvi, ndmi = serie_s2(es, lon, lat)
    return (i, lon, lat, cod, CLASES.get(cod, "otro"), json.dumps(ndvi), json.dumps(ndmi))


def muestrear(n):
    es = escenas(); items = item_cdl(es[0]["bbox"])
    print("escenas:", [e["fecha"] for e in es], "| items CDL:", len(items))
    con = sqlite3.connect(DB)
    con.execute("CREATE TABLE IF NOT EXISTS ia_cultivos (idx INTEGER PRIMARY KEY, lon REAL, lat REAL, cdl INTEGER, clase TEXT, ndvi TEXT, ndmi TEXT, tesela TEXT, anio INTEGER, fechas TEXT)")
    hechos = {r[0] for r in con.execute("SELECT idx FROM ia_cultivos")}
    rnd = random.Random(7); b = es[0]["bbox"]
    pts = [(i, rnd.uniform(b[0] + .02, b[2] - .02), rnd.uniform(b[1] + .02, b[3] - .02)) for i in range(n)]
    pend = [(i, x, y, es, items) for i, x, y in pts if i not in hechos]
    t0 = time.time(); ok = 0
    with ThreadPoolExecutor(max_workers=20) as ex:
        for k, f in enumerate(ex.map(_fila, pend), 1):
            if f:
                con.execute("INSERT OR REPLACE INTO ia_cultivos VALUES (?,?,?,?,?,?,?,?,?,?)", f + (TESELA, ANIO, json.dumps([e["fecha"] for e in es]))); ok += 1
            if k % 50 == 0:
                con.commit(); print(f"{k}/{len(pend)} · {ok} filas · {time.time() - t0:.0f}s", flush=True)
    con.commit(); print("listo:", con.execute("SELECT clase, COUNT(*) FROM ia_cultivos GROUP BY 1 ORDER BY 2 DESC").fetchall())


def _matriz(filas):
    import numpy as np
    X = np.array([[np.nan if v is None else v for v in json.loads(r[5]) + json.loads(r[6])] for r in filas], float)
    return X


def entrenar():
    import numpy as np, joblib
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.metrics import classification_report, accuracy_score
    from sklearn.model_selection import GroupKFold, cross_val_predict
    con = sqlite3.connect(DB)
    filas = con.execute("SELECT idx, lon, lat, cdl, clase, ndvi, ndmi FROM ia_cultivos").fetchall()
    cnt = {}
    for r in filas: cnt[r[4]] = cnt.get(r[4], 0) + 1
    filas = [r for r in filas if cnt[r[4]] >= 30]  # clases con muy pocas muestras no se pueden evaluar
    X, y = _matriz(filas), np.array([r[4] for r in filas])
    grupos = np.array([f"{int(r[1] * 20)}_{int(r[2] * 20)}" for r in filas])  # bloques de ~5 km: el acierto se mide en zonas que el modelo no vio
    clf = HistGradientBoostingClassifier(max_iter=200, learning_rate=0.08, class_weight="balanced", random_state=0)
    pred = cross_val_predict(clf, X, y, groups=grupos, cv=GroupKFold(5))
    print(f"muestras: {len(y)} · clases: {dict(zip(*np.unique(y, return_counts=True)))}")
    print(f"acierto en zonas no vistas: {accuracy_score(y, pred):.3f} · si siempre dijera '{max(cnt, key=cnt.get)}': {max(cnt.values()) / sum(cnt.values()):.3f}")
    print(classification_report(y, pred, zero_division=0))
    clf.fit(X, y); joblib.dump({"modelo": clf, "clases": list(clf.classes_), "fechas": json.loads(con.execute("SELECT fechas FROM ia_cultivos LIMIT 1").fetchone()[0]), "n": len(y), "acierto_cv": float(accuracy_score(y, pred))}, MODELO)
    print("modelo guardado en", MODELO)


if __name__ == "__main__":
    muestrear(int(sys.argv[2])) if sys.argv[1] == "muestrear" else entrenar()
