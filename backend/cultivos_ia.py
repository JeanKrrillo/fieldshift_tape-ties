"""Aplica el modelo de cultivos (entrenado en ia_cultivos.py) a las celdas de un terreno dibujado."""
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
import requests
from backend import base as comun
from backend.ia_cultivos import PC, _punto
from backend.ia_final import MODELO_FINAL as MODELO, METRICAS
from backend.ia_rico import BANDAS, escenas as _escenas, vector
from backend.rejilla import MAX_HA, area_ha, celdas

_M = None


def _modelo():
    global _M
    if _M is None:
        import joblib
        _M = joblib.load(MODELO)
    return _M


def _vec(es, lon, lat):
    sl = {}
    for k, _, it, base in es:
        r = _punto("sentinel-2-l2a", it, BANDAS, lon, lat)
        if r and r.get("values") and None not in r["values"]:
            off = 1000 if base >= 4.0 else 0
            sl[k] = [x - off for x in r["values"][:-1]] + [r["values"][-1]]
    return vector(sl)


def predecir(poly, maximo=25, anio=None, avance=None):
    ha = area_ha(poly)
    if ha > MAX_HA:
        return {"estado": "ERROR", "detalle": f"El terreno mide {ha:.0f} ha; el máximo es {MAX_HA} ha"}
    if not MODELO.exists():
        return {"estado": "ERROR", "detalle": "Falta entrenar el modelo: python -m backend.ia_final"}
    hoy = date.today(); anio = anio or (hoy.year if hoy.month >= 10 else hoy.year - 1)
    clave = [[round(x, 5), round(y, 5)] for x, y in poly] + [maximo, anio]
    return comun.recordar("cultivos_ia", clave, 24 * 3600, lambda: _predecir(poly, maximo, anio, ha, avance or comun.Avance()), sirve=lambda v: v.get("estado") == "OK")


def _predecir(poly, maximo, anio, ha, avance):
    import numpy as np
    avance.paso(1, 4, "ia_cuadros")
    m = _modelo(); cajas = m.get('zonas') or {'Iowa': m['zona']}  # una caja por zona entrenada, con margen de ~50 km
    cs = celdas(poly, maximo); lon0, lat0 = sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly)
    es = None
    avance.paso(2, 4, "ia_fechas")
    for a in range(anio, anio - 3, -1):  # la temporada más reciente con al menos 6 de las 10 fechas limpias (la actual puede estar incompleta)
        es = _escenas(lon0, lat0, a)
        if len(es) >= 6:
            anio = a; break
    if not es or len(es) < 6:
        return {"estado": "SIN_COBERTURA", "detalle": f"No hay al menos 6 fechas Sentinel-2 sin nubes en las últimas 3 temporadas sobre este terreno"}
    pts = [(i, c["lon"] + a * (c["limites"][1][1] - c["limites"][0][1]) / 4, c["lat"] + b * (c["limites"][1][0] - c["limites"][0][0]) / 4) for i, c in enumerate(cs) for a in (-1, 1) for b in (-1, 1)]  # 4 puntos por celda
    avance.paso(3, 4, "ia_puntos", len(pts))

    def contado(p):
        v = _vec(es, p[1], p[2]); avance.suma(); return v

    with ThreadPoolExecutor(max_workers=16) as ex:
        series = list(ex.map(contado, pts))
    avance.paso(4, 4, "ia_modelo")
    X = np.array(series, float)
    m = _modelo(); P = m["modelo"].predict_proba(X); cl = m["clases"]
    por = {i: [] for i in range(len(cs))}
    for (i, _, _), pr in zip(pts, P):
        por[i].append(pr)
    for i, c in enumerate(cs):
        pm = np.mean(por[i], axis=0); k = int(pm.argmax())
        c["clase"], c["confianza"] = cl[k], round(float(pm[k]), 2)
        c["probas"] = {cl[j]: round(float(pm[j]), 2) for j in np.argsort(-pm)[:3]}
    cont = Counter(c["clase"] for c in cs)
    res = {"estado": "OK", "anio": anio, "fechas": [e[1] for e in es], "area_ha": round(ha, 2), "celdas": cs,
           "resumen": {k: round(100 * v / len(cs)) for k, v in cont.most_common()},
           "modelo": {"muestras": m["n"], "acierto_zonas_no_vistas": round(m["acierto_cv"], 3), "acierto_maiz_soya": round(m["maiz_soya"], 3), "entrenado_en": f"{'Iowa, Illinois, Nebraska y Minnesota' if m.get('zonas') else 'centro de Iowa'}, temporadas {m['anios'][0]}-{m['anios'][-1]} (etiquetas USDA CDL)",
                "acierto_nota": "medido en un año que el modelo no vio, en zonas de 25 km que no vio y con 5 km de separación", "dentro_de_zona_entrenada": any(b[0] - 0.5 <= lon0 <= b[2] + 0.5 and b[1] - 0.5 <= lat0 <= b[3] + 0.5 for b in cajas.values())}}
    return res
