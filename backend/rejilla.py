"""Cuadrícula sobre un terreno dibujado: mide el área y calcula el NDVI real de cada celda con Sentinel-2 (Microsoft Planetary Computer)."""
import math
from concurrent.futures import ThreadPoolExecutor
import requests
from backend import base as comun

PC = "https://planetarycomputer.microsoft.com/api"
MAX_HA = 2000


def _metros(poly, lat0):
    k = 111320.0
    return [((lon * math.cos(math.radians(lat0))) * k, lat * k) for lon, lat in poly]


def area_ha(poly) -> float:
    """Área por la fórmula del topógrafo sobre una proyección local; sirve bien para terrenos de hasta unos pocos km."""
    p = _metros(poly, sum(y for _, y in poly) / len(poly))
    return abs(sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p)))) / 2 / 10000


def _dentro(x, y, poly) -> bool:
    d = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            d = not d
    return d


def celdas(poly, maximo=36, lado_fijo=None):
    """Celdas cuadradas (en metros) cuyo centro cae dentro del terreno, no más de `maximo` y de lado mínimo 30 m."""
    lons, lats = [p[0] for p in poly], [p[1] for p in poly]
    lat0 = sum(lats) / len(lats)
    ancho, alto = (max(lons) - min(lons)) * 111320 * math.cos(math.radians(lat0)), (max(lats) - min(lats)) * 111320
    lado = max(30.0, math.sqrt(ancho * alto / maximo))
    if lado_fijo:  # lado pedido (mínimo 5 m); solo crece si el terreno no cabe en el máximo de celdas
        lado = max(float(lado_fijo), math.sqrt(area_ha(poly) * 10000 / maximo))
    for _ in range(20):  # si el terreno es muy irregular, se agranda la celda hasta caber en el máximo
        dlat, dlon = lado / 111320, lado / (111320 * math.cos(math.radians(lat0)))
        out = []
        y = min(lats) + dlat / 2
        while y < max(lats):
            x = min(lons) + dlon / 2
            while x < max(lons):
                if _dentro(x, y, poly):
                    out.append({"lat": y, "lon": x, "lado_m": round(lado), "limites": [[y - dlat / 2, x - dlon / 2], [y + dlat / 2, x + dlon / 2]]})
                x += dlon
            y += dlat
        if len(out) <= maximo:
            return out
        lado *= 1.1
    return out[:maximo]


def _escena(poly):
    lons, lats = [p[0] for p in poly], [p[1] for p in poly]
    q = {"collections": "sentinel-2-l2a", "bbox": f"{min(lons)},{min(lats)},{max(lons)},{max(lats)}", "limit": 10, "sortby": "-datetime", "query": '{"eo:cloud_cover":{"lt":20}}'}
    fs = comun.pedir("GET", f"{PC}/stac/v1/search", params=q, timeout=60).json().get("features", [])
    return fs[0] if fs else None


def _ndvi(item, base, lat, lon):
    r = comun.pedir("GET", f"{PC}/data/v1/item/point/{lon},{lat}", params=[("collection", "sentinel-2-l2a"), ("item", item), ("assets", "B04"), ("assets", "B08")], timeout=60)
    if r.status_code != 200:
        return None
    rojo, nir = r.json()["values"]
    if rojo in (0, None) and nir in (0, None):
        return None
    if base >= 4.0:  # desde la línea base 04.00 la reflectancia viene con un desfase de 1000
        rojo, nir = rojo - 1000, nir - 1000
    return round((nir - rojo) / (nir + rojo), 3) if (nir + rojo) > 0 else None


def _ventana(item, poly):
    """Recorte del terreno en una sola petición: bandas roja e infrarroja y máscara de dato válido. None si el servicio no lo da."""
    import io
    import numpy as np
    lons, lats = [p[0] for p in poly], [p[1] for p in poly]
    caja = (min(lons), min(lats), max(lons), max(lats))
    r = comun.pedir("GET", f"{PC}/data/v1/item/bbox/{caja[0]},{caja[1]},{caja[2]},{caja[3]}.npy", params=[("collection", "sentinel-2-l2a"), ("item", item), ("assets", "B04"), ("assets", "B08")], timeout=90)
    if r is None or r.status_code != 200:
        return None
    a = np.load(io.BytesIO(r.content)).astype(float)
    return (a, caja) if a.ndim == 3 and a.shape[0] >= 3 else None


def ndvi_de_ventana(a, caja, cs, base):
    """NDVI de cada celda: media de los píxeles del recorte que la celda toca. Devuelve [(ndvi o None, píxeles válidos)]."""
    import numpy as np
    rojo, nir = a[0], a[1]
    off = 1000 if base >= 4.0 else 0  # desde la línea base 04.00 la reflectancia viene con un desfase de 1000
    den = nir + rojo - 2 * off
    ok = (a[2] > 0) & ~((rojo == 0) & (nir == 0)) & (den > 0)
    nd = np.where(ok, (nir - rojo) / np.where(den > 0, den, 1), np.nan)
    alto, ancho = nd.shape
    o, s, e, n = caja
    out = []
    for c in cs:
        (cs_, cw), (cn, ce) = c["limites"]
        f0 = min(alto - 1, max(0, int((n - cn) / (n - s) * alto))); f1 = max(f0 + 1, min(alto, math.ceil((n - cs_) / (n - s) * alto)))
        k0 = min(ancho - 1, max(0, int((cw - o) / (e - o) * ancho))); k1 = max(k0 + 1, min(ancho, math.ceil((ce - o) / (e - o) * ancho)))
        v = nd[f0:f1, k0:k1]; v = v[~np.isnan(v)]
        out.append((round(float(v.mean()), 3), int(v.size)) if v.size else (None, 0))
    return out


def ndvi_terreno(poly, maximo=36, lado=None, avance=None) -> dict:
    ha = area_ha(poly)
    if ha > MAX_HA:
        return {"estado": "ERROR", "detalle": f"El terreno mide {ha:.0f} ha; el máximo es {MAX_HA} ha"}
    clave = [[round(x, 5), round(y, 5)] for x, y in poly] + [maximo, lado]
    return comun.recordar("terreno", clave, 6 * 3600, lambda: _medir(poly, maximo, lado, ha, avance or comun.Avance()), sirve=lambda v: v.get("estado") == "OK")


def _medir(poly, maximo, lado, ha, avance) -> dict:
    avance.paso(1, 4, "ter_cuadros")
    cs = celdas(poly, maximo, lado)
    avance.paso(2, 4, "ter_escena")
    it = _escena(poly)
    if not it:
        return {"estado": "SIN_COBERTURA", "area_ha": round(ha, 2), "detalle": "Ninguna escena Sentinel-2 sin nubes cubre este terreno"}
    base = float(it["properties"].get("s2:processing_baseline", "5") or 5)
    def contado(lat, lon):
        x = _ndvi(it["id"], base, lat, lon); avance.suma(); return x

    avance.paso(3, 4, "ter_recorte")
    v = _ventana(it["id"], poly)
    metodo = "recorte" if v else "puntos"  # si el recorte falla se mide punto por punto, como antes
    if v:
        medidas = ndvi_de_ventana(v[0], v[1], cs, base)
        pts = [(i, None, None) for i in range(len(cs)) for _ in range(medidas[i][1])]
        res_pts = [medidas[i][0] for i, _, _ in pts]
    elif cs and cs[0]["lado_m"] < 20:
        # Celdas más chicas que dos píxeles de Sentinel-2 (10 m): un punto por celda; las celdas que caen en el mismo píxel comparten su medición
        cl = lambda c: (round(c["lat"] / 0.00009), round(c["lon"] / (0.00009 / math.cos(math.radians(c["lat"])))))
        unicos = {}
        for c in cs:
            unicos.setdefault(cl(c), (c["lat"], c["lon"]))
        avance.paso(3, 4, "ter_puntos", len(unicos))
        with ThreadPoolExecutor(max_workers=16) as ex:
            val = dict(zip(unicos, ex.map(lambda q: contado(q[0], q[1]), unicos.values())))
        pts = [(i, None, None) for i in range(len(cs))]
        res_pts = [val[cl(c)] for c in cs]
    else:
        # 3×3 puntos de 10 m repartidos por cada celda, promediados
        pts = [(i, c["lat"] + a * (c["limites"][1][0] - c["limites"][0][0]) / 3, c["lon"] + b * (c["limites"][1][1] - c["limites"][0][1]) / 3) for i, c in enumerate(cs) for a in (-1, 0, 1) for b in (-1, 0, 1)]
        avance.paso(3, 4, "ter_puntos", len(pts))
        with ThreadPoolExecutor(max_workers=16) as ex:
            res_pts = list(ex.map(lambda p: contado(p[1], p[2]), pts))
    avance.paso(4, 4, "ter_resumen")
    por = {i: [] for i in range(len(cs))}
    for (i, _, _), v in zip(pts, res_pts):
        if v is not None:
            por[i].append(v)
    vals = []
    for i, c in enumerate(cs):
        c["n_muestras"] = len(por[i])
        c["ndvi"] = round(sum(por[i]) / len(por[i]), 3) if por[i] else None
        vals.append(c["ndvi"])
    con = [v for v in vals if v is not None]
    res = {"estado": "OK", "fuente": "Sentinel-2 L2A (Microsoft Planetary Computer)", "escena": it["id"], "fecha": it["properties"]["datetime"][:10], "nubosidad_pct": round(it["properties"].get("eo:cloud_cover", 0), 1),
           "area_ha": round(ha, 2), "metodo": metodo, "celdas": cs, "lado_m": cs[0]["lado_m"] if cs else None, "lado_pedido_m": lado, "ndvi_promedio": round(sum(con) / len(con), 3) if con else None,
           "pct_celdas_bajo_030": round(100 * sum(v < 0.30 for v in con) / len(con)) if con else None}  # 0.30 es la regla del equipo para suelo con poca cobertura
    return res
