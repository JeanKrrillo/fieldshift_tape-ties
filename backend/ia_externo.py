"""Prueba en regiones que el modelo nunca vio (Illinois, Nebraska, Minnesota).
Para cada zona y año: modelo entrenado solo con Iowa y SIN ese año, predice la zona nueva.
Uso (desde publico): python -m backend.ia_externo"""
import json, sqlite3, sys, time
from collections import Counter
import numpy as np
from sklearn.metrics import accuracy_score, f1_score
from backend.ia_cultivos import CLASES
from backend.ia_final import CLASES_MODELO, D, cargar, modelo, prueba, resumen
from backend.ia_rico import RICO, vector

SALIDA = D / "metricas_externas.json"


def cargar_zonas():
    con = sqlite3.connect(RICO)
    puntos = {r[0]: (r[1], r[2], r[3]) for r in con.execute("SELECT idx, lon, lat, zona FROM puntos")}
    cdl = {(i, a): (lambda k: k if k in CLASES_MODELO else "otro")(CLASES.get(c, "otro")) for i, a, c in con.execute("SELECT idx, anio, cdl FROM cdl_zonas")}
    sl = {}
    for i, a, k, _, v in con.execute("SELECT idx, anio, slot, fecha, vals FROM s2_rico WHERE idx>=10000"):
        sl.setdefault((i, a), {})[k] = json.loads(v)
    claves = [k for k in sl if k in cdl and k[0] in puntos]
    X = np.array([vector(sl[k]) for k in claves], float)
    y = np.array([cdl[k] for k in claves]); yr = np.array([k[1] for k in claves]); z = np.array([puntos[k[0]][2] for k in claves])
    xy = np.array([[puntos[k[0]][0] * 111 * np.cos(np.radians(puntos[k[0]][1])), puntos[k[0]][1] * 111] for k in claves])
    cajas = {n: [min(p[0] for p in puntos.values() if p[2] == n), min(p[1] for p in puntos.values() if p[2] == n), max(p[0] for p in puntos.values() if p[2] == n), max(p[1] for p in puntos.values() if p[2] == n)] for n in set(z)}
    return X, y, yr, z, xy, cajas


def main():
    t0 = time.time()
    _, X, y, yr, _, _, _ = cargar()
    Xz, yz, yrz, z, _, _ = cargar_zonas()
    print(f"Iowa {len(y)} muestras · zonas nuevas {len(yz)} {dict(Counter(z))}", flush=True)
    out = {"entrenamiento": "solo Iowa, sin el año que se prueba", "zonas": {}}
    P = np.empty(len(yz), object)
    for t in sorted(set(yrz)):
        tr = yr != t
        m = modelo().fit(X[tr], y[tr]); te = yrz == t
        P[te] = m.predict(Xz[te])
        print(f"año {t}: modelo con {int(tr.sum())} muestras de Iowa", flush=True)
    for nombre in sorted(set(z)):
        s = z == nombre
        r = resumen(yz[s], P[s], yrz[s]); r["muestras"] = int(s.sum()); r["clases"] = dict(Counter(yz[s]))
        r["siempre_la_mas_comun"] = round(max(Counter(yz[s]).values()) / int(s.sum()), 3)
        out["zonas"][nombre] = r
        print(nombre, r, flush=True)
    out["todas"] = resumen(yz, P, yrz)
    out["todas"]["siempre_la_mas_comun"] = round(max(Counter(yz).values()) / len(yz), 3)
    out["minutos"] = round((time.time() - t0) / 60, 1)
    SALIDA.write_text(json.dumps(out, ensure_ascii=False, indent=1, default=float), encoding="utf-8")
    print("TODAS", out["todas"], flush=True)
    if "--entrenar" in sys.argv:
        entrenar_todo(out)


def entrenar_todo(externo):
    """Reentrena con Iowa + zonas nuevas y mide con la prueba oficial (años y zonas de 25 km no vistos, 5 km de separación)."""
    import joblib
    from backend.ia_final import MODELO_FINAL, METRICAS
    from backend.ia_rico import NOMBRES
    claves, X, y, yr, xy, _, puntos = cargar()
    Xz, yz, yrz, z, xyz, cajas = cargar_zonas()
    XA, yA, yrA, xyA = np.vstack([X, Xz]), np.concatenate([y, yz]), np.concatenate([yr, yrz]), np.vstack([xy, xyz])
    print(f"== reentrenamiento: {len(yA)} muestras (Iowa {len(y)} + zonas {len(yz)})", flush=True)
    P, _ = prueba(XA, yA, yrA, xyA)
    oficial = resumen(yA, P, yrA)
    ms = np.concatenate([np.array(["Iowa"] * len(y)), z])
    oficial["por_zona"] = {n: round(accuracy_score(yA[ms == n], P[ms == n]), 3) for n in sorted(set(ms))}
    print("OFICIAL multizona", oficial, flush=True)
    m = modelo().fit(XA, yA)
    lon = [p[0] for p in puntos.values()]; lat = [p[1] for p in puntos.values()]
    cajas["Iowa"] = [min(lon), min(lat), max(lon), max(lat)]
    joblib.dump({"modelo": m, "clases": list(m.classes_), "nombres": NOMBRES, "n": len(yA), "acierto_cv": oficial["acierto"], "maiz_soya": oficial["maiz_soya"], "por_anio": oficial["por_anio"],
                 "zona": cajas["Iowa"], "zonas": cajas, "anios": sorted(int(a) for a in set(yrA))}, MODELO_FINAL)
    met = json.loads(METRICAS.read_text(encoding="utf-8"))
    met["solo_iowa_oficial"] = met.get("solo_iowa_oficial") or met["oficial"]
    met["externo_sin_ver_la_zona"] = externo
    met["oficial"] = oficial; met["multizona_muestras"] = len(yA)
    METRICAS.write_text(json.dumps(met, ensure_ascii=False, indent=1, default=float), encoding="utf-8")
    print("modelo multizona guardado", flush=True)


if __name__ == "__main__":
    main()
