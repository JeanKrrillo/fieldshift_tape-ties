"""Modelo final de cultivos: prueba sin fuga de datos, controles, análisis y guardado.
Prueba oficial: cada año se predice con un modelo entrenado en los otros años, en zonas de 25 km que el modelo no vio
y con 5 km de separación entre entrenamiento y prueba. Uso (desde publico): python -m backend.ia_final"""
import json, sqlite3, time, warnings
from collections import Counter
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier as H
from sklearn.metrics import accuracy_score, f1_score, classification_report
from sklearn.model_selection import GroupKFold
from scipy.spatial import cKDTree
from backend.ia_cultivos import DB, CLASES
from backend.ia_rico import RICO, NOMBRES, vector

warnings.filterwarnings("ignore")
D = DB.parent
MODELO_FINAL = D / "modelo_cultivos_final.joblib"
METRICAS = D / "metricas_modelo_final.json"
IMPORTANCIA = D / "importancia_final.json"
CLASES_MODELO = ("maiz", "soya", "pastizal", "urbano", "bosque", "otro")  # "otro" junta humedal, agua, alfalfa, heno, trigo y lo demás
BLOQUE_KM, BUFER_KM = 25, 5


def cargar():
    puntos = {r[0]: (r[1], r[2]) for r in sqlite3.connect(DB).execute("SELECT idx, lon, lat FROM ia_cultivos")}
    cdl = {(i, a): (lambda k: k if k in CLASES_MODELO else "otro")(CLASES.get(c, "otro")) for i, a, c in sqlite3.connect(D / "multianio.sqlite").execute("SELECT idx, anio, cdl FROM cdl_anios")}
    sl = {}
    for i, a, k, _, v in sqlite3.connect(RICO).execute("SELECT idx, anio, slot, fecha, vals FROM s2_rico"):
        sl.setdefault((i, a), {})[k] = json.loads(v)
    claves = [k for k in sl if k in cdl]
    X = np.array([vector(sl[k]) for k in claves], float)
    y = np.array([cdl[k] for k in claves]); yr = np.array([k[1] for k in claves])
    xy = np.array([[puntos[k[0]][0] * 111 * np.cos(np.radians(puntos[k[0]][1])), puntos[k[0]][1] * 111] for k in claves])  # km; solo para separar zonas, nunca entra al modelo
    previo = np.array([cdl.get((k[0], k[1] - 1)) for k in claves], object)
    return claves, X, y, yr, xy, previo, puntos


def modelo():
    return H(max_iter=150, learning_rate=0.06, class_weight="balanced", random_state=0)


def prueba(X, y, yr, xy, importancia=False, mezclar=False):
    """Predicción de cada muestra en la prueba oficial. Devuelve (predicciones, caída de acierto por variable)."""
    P = np.empty(len(y), object); caida = np.zeros(X.shape[1]); rng = np.random.default_rng(0)
    bloque = np.array([f"{int(a // BLOQUE_KM)}_{int(b // BLOQUE_KM)}" for a, b in xy])
    for t in sorted(set(yr)):
        te_all = np.where(yr == t)[0]
        for k, (_, b) in enumerate(GroupKFold(5).split(te_all, groups=bloque[te_all])):
            te = te_all[b]
            lejos = cKDTree(xy[te]).query(xy, k=1)[0] > BUFER_KM  # franja de 5 km entre entrenamiento y prueba
            tr = np.where((yr != t) & ~np.isin(bloque, bloque[te]) & lejos)[0]
            ytr = rng.permutation(y[tr]) if mezclar else y[tr]
            m = modelo().fit(X[tr], ytr); P[te] = m.predict(X[te])
            if importancia:
                base = accuracy_score(y[te], P[te])
                for j in range(X.shape[1]):
                    Xp = X[te].copy(); Xp[:, j] = rng.permutation(Xp[:, j])
                    caida[j] += base - accuracy_score(y[te], m.predict(Xp))
            print(f"  año de prueba {t} · zona {k + 1}/5 · entrenó con {len(tr)}", flush=True)
    return P, caida / 5 / len(set(yr))


def resumen(y, P, yr):
    ms = np.isin(y, ["maiz", "soya"])
    return {"acierto": round(accuracy_score(y, P), 3), "f1_macro": round(f1_score(y, P, average="macro"), 3),
            "maiz_soya": round(float((P[ms] == y[ms]).mean()), 3),
            "por_anio": {int(t): round(accuracy_score(y[yr == t], P[yr == t]), 3) for t in sorted(set(yr))}}


def main():
    t0 = time.time(); claves, X, y, yr, xy, previo, puntos = cargar()
    print(f"muestras {len(y)} · clases {dict(Counter(y))} · variables {X.shape[1]} · años {sorted(set(yr))}", flush=True)
    out = {"muestras": len(y), "clases": dict(Counter(y)), "variables": X.shape[1],
           "prueba": f"cada año se predice con un modelo entrenado en los otros años, en zonas de {BLOQUE_KM} km no vistas y con {BUFER_KM} km de separación"}
    out["siempre_la_mas_comun"] = round(max(Counter(y).values()) / len(y), 3)
    ok = previo != None
    out["mismo_que_el_anio_anterior"] = round(float((previo[ok] == y[ok]).mean()), 3)  # un punto sembrado igual que el año pasado: línea base de persistencia

    print("== prueba oficial", flush=True)
    P, caida = prueba(X, y, yr, xy, importancia=True)
    out["oficial"] = resumen(y, P, yr)
    out["por_clase"] = classification_report(y, P, output_dict=True, zero_division=0)
    print("OFICIAL", out["oficial"], flush=True)

    print("== control 1: etiquetas mezcladas (debe caer al azar)", flush=True)
    out["control_etiquetas_mezcladas"] = resumen(y, prueba(X, y, yr, xy, mezclar=True)[0], yr)
    print("MEZCLADAS", out["control_etiquetas_mezcladas"], flush=True)
    print("== control 2: solo dónde faltan datos (no debe acertar casi nada)", flush=True)
    out["control_solo_huecos"] = resumen(y, prueba(np.isnan(X).astype(float), y, yr, xy)[0], yr)
    print("HUECOS", out["control_solo_huecos"], flush=True)
    out["control_coordenadas"] = "lon/lat solo se usan para separar zonas; el modelo recibe únicamente los 50 índices (ver NOMBRES)"

    por_var = sorted(({"variable": NOMBRES[j], "caida_acierto_pts": round(100 * caida[j], 2)} for j in range(X.shape[1])), key=lambda d: -d["caida_acierto_pts"])
    grupos = {}
    for j, n in enumerate(NOMBRES):
        for g in (n.split()[0], n.split()[1]):
            grupos[g] = grupos.get(g, 0) + caida[j]
    IMPORTANCIA.write_text(json.dumps({"variables": por_var[:20], "por_grupo": {k: round(100 * v, 2) for k, v in sorted(grupos.items(), key=lambda kv: -kv[1])},
                                       "nota": "caída de acierto al barajar la variable, en la prueba oficial; los grupos suman las variables de un índice o de una fecha"}, ensure_ascii=False, indent=1), encoding="utf-8")
    c = np.corrcoef(np.nan_to_num(X - np.nanmean(X, 0), nan=0).T)
    pares = sorted(((abs(c[i, j]), NOMBRES[i], NOMBRES[j]) for i in range(len(c)) for j in range(i + 1, len(c))), reverse=True)
    out["correlacion"] = {"pares_con_r_mayor_0_95": sum(1 for p in pares if p[0] > 0.95), "de": len(pares), "mas_correlacionados": [[round(a, 3), b, d] for a, b, d in pares[:10]]}

    import joblib
    lon = [p[0] for p in puntos.values()]; lat = [p[1] for p in puntos.values()]
    m = modelo().fit(X, y)
    joblib.dump({"modelo": m, "clases": list(m.classes_), "nombres": NOMBRES, "n": len(y), "acierto_cv": out["oficial"]["acierto"], "maiz_soya": out["oficial"]["maiz_soya"], "por_anio": out["oficial"]["por_anio"],
                 "zona": [min(lon), min(lat), max(lon), max(lat)], "anios": sorted(int(a) for a in set(yr))}, MODELO_FINAL)
    out["minutos"] = round((time.time() - t0) / 60, 1)
    METRICAS.write_text(json.dumps(out, ensure_ascii=False, indent=1, default=float), encoding="utf-8")
    print("listo", MODELO_FINAL, f"{out['minutos']} min", flush=True)


if __name__ == "__main__":
    main()
