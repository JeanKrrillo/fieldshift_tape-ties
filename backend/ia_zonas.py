"""Zonas nuevas para probar el modelo fuera de Iowa: puntos al azar, etiqueta CDL y 10 bandas Sentinel-2 por temporada.
Uso (desde publico): python -m backend.ia_zonas IL 600 2018 2019 2020 2021"""
import random, sys
from concurrent.futures import ThreadPoolExecutor
from backend.ia_cultivos import _punto
from backend.ia_multianio import _items_cdl
from backend.ia_rico import _db, s2

ZONAS = {"IL": (-89.0, 40.2, 10000), "NE": (-97.2, 41.0, 20000), "MN": (-94.0, 44.0, 30000)}  # centro y base de idx; ~40 km de lado


def main(zona, n, anios):
    lon0, lat0, base = ZONAS[zona]; con = _db(); rnd = random.Random(base)
    for i in range(n):
        con.execute("INSERT OR IGNORE INTO puntos VALUES (?,?,?,?)", (zona, base + i, rnd.uniform(lon0 - .2, lon0 + .2), rnd.uniform(lat0 - .18, lat0 + .18)))
    con.commit()
    pts = con.execute("SELECT idx, lon, lat FROM puntos WHERE zona=? OR (idx>=? AND idx<?)", (zona, base, base + 10000)).fetchall()
    for anio in anios:
        items = _items_cdl(anio, [lon0 - .25, lat0 - .25, lon0 + .25, lat0 + .25])
        hechos = {r[0] for r in con.execute("SELECT idx FROM cdl_zonas WHERE anio=?", (anio,))}

        def una(p):
            for it, b in items:
                if b[0] <= p[1] <= b[2] and b[1] <= p[2] <= b[3]:
                    r = _punto("usda-cdl", it, ["cropland"], p[1], p[2])
                    if r and r.get("values") and r["values"][0] not in (None, 0):
                        return (p[0], anio, int(r["values"][0]))
        with ThreadPoolExecutor(max_workers=16) as ex:
            filas = [f for f in ex.map(una, [p for p in pts if p[0] not in hechos]) if f]
        con.executemany("INSERT OR REPLACE INTO cdl_zonas VALUES (?,?,?)", filas)  # escritura corta: otros procesos escriben en la misma base
        con.commit(); print(zona, "CDL", anio, con.execute("SELECT COUNT(*) FROM cdl_zonas WHERE anio=? AND idx>=? AND idx<?", (anio, base, base + 10000)).fetchone()[0], flush=True)
    s2(anios, pts)


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]), [int(x) for x in sys.argv[3:]])
