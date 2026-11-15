"""Datos multi-año para la IA, sobre los mismos puntos de `ia_cultivos`:
  1) cdl_anios: cultivo oficial (USDA CDL) de cada punto en cada año 2008-2021  → rotaciones reales observadas
  2) s2_anios:  curva de NDVI/NDMI de Sentinel-2 de esos años                    → entrenar y probar en el tiempo
Base aparte (multianio.sqlite) para no chocar con otras recolecciones. Reanudable.
Uso: python -m backend.ia_multianio cdl            |   python -m backend.ia_multianio s2 2018 2019 2020"""
import json, sqlite3, sys, threading, time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import requests
from backend.ia_cultivos import DB, PC, CLASES, _punto, serie_s2
from backend.cultivos_ia import _escenas

DBM = DB.parent / "multianio.sqlite"
_LOCK = threading.Lock()


def _db():
    con = sqlite3.connect(DBM, timeout=60)
    con.execute("CREATE TABLE IF NOT EXISTS cdl_anios (idx INTEGER, anio INTEGER, cdl INTEGER, clase TEXT, PRIMARY KEY (idx, anio))")
    con.execute("CREATE TABLE IF NOT EXISTS s2_anios (idx INTEGER, anio INTEGER, ndvi TEXT, ndmi TEXT, fechas TEXT, PRIMARY KEY (idx, anio))")
    con.execute("CREATE TABLE IF NOT EXISTS estado (fuente TEXT PRIMARY KEY, total INTEGER, hechas INTEGER, errores INTEGER, estado TEXT, actualizado TEXT)")
    return con


def _estado(con, nombre, total, hechas, errores, st):
    with _LOCK:
        con.execute("INSERT OR REPLACE INTO estado VALUES (?,?,?,?,?,?)", (nombre, total, hechas, errores, st, datetime.now().isoformat(timespec="seconds"))); con.commit()


def _puntos():
    c = sqlite3.connect(DB, timeout=60)
    p = c.execute("SELECT idx, lon, lat FROM ia_cultivos").fetchall(); c.close(); return p


def _items_cdl(anio, bbox):
    fs = requests.get(f"{PC}/stac/v1/search", params={"collections": "usda-cdl", "datetime": f"{anio}-01-01/{anio}-12-31", "bbox": ",".join(map(str, bbox)), "limit": 50}, timeout=60).json().get("features", [])
    return [(f["id"], f["bbox"]) for f in fs if f["id"].startswith("cropland_")]


def cdl(anios=range(2008, 2022)):
    pts = _puntos(); con = _db()
    xs, ys = [p[1] for p in pts], [p[2] for p in pts]; bbox = [min(xs), min(ys), max(xs), max(ys)]
    for anio in anios:
        items = _items_cdl(anio, bbox)
        hechos = {r[0] for r in con.execute("SELECT idx FROM cdl_anios WHERE anio=?", (anio,))}
        pend = [p for p in pts if p[0] not in hechos]
        if not items:
            print(anio, "sin items CDL en esta fuente", flush=True); continue

        def una(p):
            i, lon, lat = p
            for it, b in items:
                if b[0] <= lon <= b[2] and b[1] <= lat <= b[3]:
                    r = _punto("usda-cdl", it, ["cropland"], lon, lat)
                    if r and r.get("values") and r["values"][0] not in (None, 0):
                        return (i, anio, int(r["values"][0]), CLASES.get(int(r["values"][0]), "otro"))
            return None
        hechas = err = 0; _estado(con, f"cdl_{anio}", len(pend), 0, 0, "corriendo")
        with ThreadPoolExecutor(max_workers=16) as ex:
            for k, f in enumerate(ex.map(una, pend), 1):
                if f:
                    with _LOCK:
                        con.execute("INSERT OR REPLACE INTO cdl_anios VALUES (?,?,?,?)", f); con.commit()
                    hechas += 1
                else:
                    err += 1
                if k % 200 == 0:
                    _estado(con, f"cdl_{anio}", len(pend), hechas, err, "corriendo")
        _estado(con, f"cdl_{anio}", len(pend), hechas, err, "terminada"); print("CDL", anio, hechas, "ok", err, "sin dato", flush=True)


def s2(anios):
    pts = _puntos(); con = _db()
    lon0, lat0 = sum(p[1] for p in pts) / len(pts), sum(p[2] for p in pts) / len(pts)
    for anio in anios:
        es = _escenas(lon0, lat0, anio)
        if not es:
            print(anio, "sin 6 escenas limpias cerca de las fechas objetivo", flush=True); continue
        hechos = {r[0] for r in con.execute("SELECT idx FROM s2_anios WHERE anio=?", (anio,))}
        pend = [p for p in pts if p[0] not in hechos]
        hechas = 0; _estado(con, f"s2_{anio}", len(pend), 0, 0, "corriendo")
        fechas = json.dumps([e["fecha"] for e in es])
        with ThreadPoolExecutor(max_workers=16) as ex:
            for k, (p, (n, m)) in enumerate(zip(pend, ex.map(lambda p: serie_s2(es, p[1], p[2]), pend)), 1):
                with _LOCK:
                    con.execute("INSERT OR REPLACE INTO s2_anios VALUES (?,?,?,?,?)", (p[0], anio, json.dumps(n), json.dumps(m), fechas)); con.commit()
                hechas += 1
                if k % 100 == 0:
                    _estado(con, f"s2_{anio}", len(pend), hechas, 0, "corriendo")
        _estado(con, f"s2_{anio}", len(pend), hechas, 0, "terminada"); print("S2", anio, hechas, flush=True)


if __name__ == "__main__":
    a = sys.argv[1]
    cdl() if a == "cdl" else s2([int(x) for x in sys.argv[2:]])
