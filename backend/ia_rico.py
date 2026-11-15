"""Datos ricos para entrenar: reflectancia cruda de 10 bandas Sentinel-2 en 10 fechas por temporada y por punto,
más temperatura diaria (NASA POWER) para alinear por grados-día. Los índices se calculan después, al entrenar.
Uso: python -m backend.ia_rico s2 2018 2019 2020 2021 | clima 2018 2019 2020 2021"""
import json, sqlite3, sys, threading, time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import requests
from backend.ia_cultivos import DB, PC, _punto

RICO = DB.parent / "rico.sqlite"
BANDAS = ["B02", "B03", "B04", "B05", "B06", "B07", "B08", "B8A", "B11", "B12", "SCL"]
OBJ = ["05-25", "06-08", "06-22", "07-06", "07-20", "08-03", "08-17", "08-31", "09-14", "09-28"]
_LOCK = threading.Lock()


def _db():
    con = sqlite3.connect(RICO, timeout=60, check_same_thread=False)
    con.executescript("""CREATE TABLE IF NOT EXISTS s2_rico (idx INTEGER, anio INTEGER, slot INTEGER, fecha TEXT, vals TEXT, PRIMARY KEY (idx, anio, slot));
    CREATE TABLE IF NOT EXISTS puntos (zona TEXT, idx INTEGER PRIMARY KEY, lon REAL, lat REAL);
    CREATE TABLE IF NOT EXISTS cdl_zonas (idx INTEGER, anio INTEGER, cdl INTEGER, PRIMARY KEY (idx, anio));
    CREATE TABLE IF NOT EXISTS clima (anio INTEGER, fecha TEXT, tmax REAL, tmin REAL, PRIMARY KEY (anio, fecha));""")
    return con


def _puntos():
    return [(r[0], r[1], r[2]) for r in sqlite3.connect(DB).execute("SELECT idx, lon, lat FROM ia_cultivos ORDER BY idx")]


def escenas(lon, lat, anio):
    q = {"collections": ["sentinel-2-l2a"], "datetime": f"{anio}-05-15/{anio}-10-05", "intersects": {"type": "Point", "coordinates": [lon, lat]},
         "query": {"eo:cloud_cover": {"lt": 40}}, "limit": 300}
    fs = requests.post(f"{PC}/stac/v1/search", json=q, timeout=60).json().get("features", [])
    out = []
    for k, o in enumerate(OBJ):
        d = datetime.strptime(f"{anio}-{o}", "%Y-%m-%d")
        dias = lambda f: abs((datetime.strptime(f["properties"]["datetime"][:10], "%Y-%m-%d") - d).days)
        c = [f for f in fs if dias(f) <= 8]
        if c:
            f = min(c, key=lambda f: dias(f) + f["properties"]["eo:cloud_cover"] / 10)
            out.append((k, f["properties"]["datetime"][:10], f["id"], float(f["properties"].get("s2:processing_baseline", "5") or 5)))
    return out


def vector(sl):
    """50 variables: 5 índices (NDVI, NDMI, NDRE, EVI, NBR) en cada una de las 10 fechas. `sl`: {fecha_k: valores de BANDAS o None}; nube/sombra = nan."""
    nan, out, e = float("nan"), [], 1e-6
    for k in range(len(OBJ)):
        v = sl.get(k)
        if not v or v[-1] in (3, 8, 9, 10, 11):
            out += [nan] * 5; continue
        b2, b3, b4, b5, b6, b7, b8, b8a, b11, b12 = [x / 10000 for x in v[:-1]]
        out += [(b8 - b4) / (b8 + b4 + e), (b8 - b11) / (b8 + b11 + e), (b8a - b5) / (b8a + b5 + e), 2.5 * (b8 - b4) / (b8 + 6 * b4 - 7.5 * b2 + 1 + e), (b8 - b12) / (b8 + b12 + e)]
    return out


NOMBRES = [f"{i} {OBJ[k]}" for k in range(len(OBJ)) for i in ("NDVI", "NDMI", "NDRE", "EVI", "NBR")]


def s2(anios, pts=None):
    pts = pts or _puntos(); con = _db()
    lon0, lat0 = sum(p[1] for p in pts) / len(pts), sum(p[2] for p in pts) / len(pts)
    for anio in anios:
        es = escenas(lon0, lat0, anio)
        print(anio, "escenas:", [(k, f) for k, f, _, _ in es], flush=True)
        hechos = {r[0] for r in con.execute("SELECT idx FROM s2_rico WHERE anio=? GROUP BY idx HAVING COUNT(*)>=?", (anio, len(es)))}
        pend = [p for p in pts if p[0] not in hechos]

        def uno(p):
            filas = []
            for k, fecha, it, base in es:
                r = _punto("sentinel-2-l2a", it, BANDAS, p[1], p[2])
                v = None
                if r and r.get("values") and None not in r["values"]:
                    off = 1000 if base >= 4.0 else 0
                    v = [x - off for x in r["values"][:-1]] + [r["values"][-1]]  # SCL no se corrige
                filas.append((p[0], anio, k, fecha, json.dumps(v)))
            return filas

        t0 = time.time()
        with ThreadPoolExecutor(max_workers=16) as ex:
            for n, filas in enumerate(ex.map(uno, pend), 1):
                with _LOCK:
                    con.executemany("INSERT OR REPLACE INTO s2_rico VALUES (?,?,?,?,?)", filas); con.commit()
                if n % 50 == 0:
                    print(f"S2 {anio}: {n}/{len(pend)} · {time.time() - t0:.0f}s", flush=True)
        print("S2", anio, "listo", flush=True)


def clima(anios):
    pts = _puntos(); con = _db()
    lon0, lat0 = sum(p[1] for p in pts) / len(pts), sum(p[2] for p in pts) / len(pts)
    for anio in anios:
        r = requests.get("https://power.larc.nasa.gov/api/temporal/daily/point", params={"parameters": "T2M_MAX,T2M_MIN", "community": "AG", "longitude": lon0, "latitude": lat0,
                         "start": f"{anio}0101", "end": f"{anio}1231", "format": "JSON"}, timeout=120).json()["properties"]["parameter"]
        for d, tx in r["T2M_MAX"].items():
            tn = r["T2M_MIN"][d]
            if tx > -900 and tn > -900:
                con.execute("INSERT OR REPLACE INTO clima VALUES (?,?,?,?)", (anio, f"{d[:4]}-{d[4:6]}-{d[6:]}", tx, tn))
        con.commit(); print("clima", anio, flush=True)


if __name__ == "__main__":
    (s2 if sys.argv[1] == "s2" else clima)([int(x) for x in sys.argv[2:]])
