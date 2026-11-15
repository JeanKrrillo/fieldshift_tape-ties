"""Catálogo vivo de todo lo que las fuentes ofrecen. Cada lista se lee del catálogo oficial; nada se inventa."""
import os
import re
import time
import xml.etree.ElementTree as ET
import requests

_NS = {"w": "http://www.opengis.net/wmts/1.0", "o": "http://www.opengis.net/ows/1.1"}
_MEM = {}


def _cache(clave, fn, segundos=86400):  # shortcut: en memoria por proceso, 1 día; subir a archivo si el servidor se reinicia seguido
    hit = _MEM.get(clave)
    if hit and time.time() - hit[0] < segundos:
        return hit[1]
    val = fn()
    falla = isinstance(val, dict) and any(isinstance(v, dict) and v.get("estado") == "ERROR" for v in val.values())
    if not falla:  # un catálogo con alguna fuente caída no se guarda: así se reintenta en la siguiente petición
        _MEM[clave] = (time.time(), val)
    return val


_USO = [  # (clave, regex sobre grupo+título+id); el primero que coincide gana. Regla del equipo, no una medición.
    ("orb", r"orbital|orbit"), ("sea", r"sea surface|sea ice|ocean|chlorophyll|salinity|bathy|kelp|sea level|ocean current"),
    ("veg", r"vegetation|ndvi|evi|lai|fpar|biomass|primary prod|gpp"), ("soilm", r"soil moisture|root zone|smap"),
    ("rain", r"precip|imerg|rain"), ("water", r"evapotransp|liquid water equiv|groundwater|grace|flood|surface water|water mask|runoff|drought|water extent"),
    ("lst", r"land surface temp|lst"), ("land", r"land cover|crop|land use|irrigat|agricultur"), ("fire", r"fire|thermal anomal|burn"),
    ("snow", r"snow"), ("cloud", r"cloud|water vapor"), ("img", r"true ?color|corrected reflectance|false color|natural color|bands"),
    ("refl", r"reflectance"), ("airt", r"air temperature|2-meter|surface air|relative humidity"), ("air", r"aerosol|ozone|carbon|co2|methane|sulfur|nitrogen|no2|wind|humidity|pressure|temperature|dust|smoke|flux")]
_UTIL = {"veg": "alta", "soilm": "alta", "rain": "alta", "water": "alta", "lst": "alta", "land": "alta", "fire": "media", "snow": "media", "cloud": "media", "img": "media", "refl": "media",
         "airt": "media", "air": "baja", "sea": "baja", "orb": "baja", "otro": "baja"}
_RUIDO = re.compile(r"\(.*?\)|(terra|aqua|modis|viirs|suomi|npp|snpp|noaa-?\d+|metop-?\w|combined|day|night|daily|monthly|annual|rolling|8-?day|l\d|v\d+|nrt|best available|std)|[^a-z ]")


def _worldview():
    try:
        return requests.get("https://worldview.earthdata.nasa.gov/config/wv.json", timeout=120).json()["layers"]  # viene comprimido en brotli: requiere el paquete brotli
    except Exception:
        return {}


def _enriquecer(capas):
    wv = _worldview()
    fam = {}
    for c in capas:
        w = wv.get(c["id"], {})
        cr = (w.get("conceptIds") or [{}])[0]
        base = f'{w.get("layergroup", "")} {w.get("title", c["titulo"])} {c["id"]}'.lower()
        uso = next((k for k, rx in _USO if re.search(rx, base)), "otro")
        c.update({"subtitulo": w.get("subtitle"), "grupo": w.get("layergroup"), "frecuencia": w.get("period"), "vivo": bool(w.get("ongoing")) or not w.get("endDate"),
                  "paleta": bool(w.get("palette")), "crudo": cr.get("shortName"), "crudo_titulo": cr.get("title"), "daac": (w.get("dataCenter") or [None])[0],
                  "titulo_largo": w.get("title"), "uso": uso, "utilidad": _UTIL[uso], "desde": (w.get("startDate") or "")[:10], "hasta": (w.get("endDate") or "")[:10],
                  "variante": ",".join(k for k, rx in [("granule", r"granule"), ("calidad", r"_qa|quality|uncertaint"), ("bandas", r"bands|_ColorIndex")] if re.search(rx, c["id"], re.I))})
        c["familia"] = uso + "|" + re.sub(r"\s+", " ", _RUIDO.sub(" ", (c["titulo"] or "").lower())).strip()
        fam.setdefault(c["familia"], []).append(c)
    for miembros in fam.values():  # el representante es el que sigue vivo, es diario, no es de calidad y cubre más años
        mejor = max(miembros, key=lambda c: (c["vivo"], c["frecuencia"] == "daily", not c["variante"], -(len(c["desde"]) == 0), c["desde"] and -int(c["desde"][:4])))
        for c in miembros:
            c["familia_n"], c["representante"] = len(miembros), c is mejor
    return capas


def _gibs():
    x = requests.get("https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml", timeout=60).text
    out = []
    for l in ET.fromstring(x).iter("{%s}Layer" % _NS["w"]):
        ident = l.findtext("o:Identifier", namespaces=_NS)
        fmt = l.findtext("w:Format", namespaces=_NS) or ""
        ms = l.findtext("w:TileMatrixSetLink/w:TileMatrixSet", namespaces=_NS) or ""
        niv = re.search(r"Level(\d+)", ms)
        dim = l.find("w:Dimension", _NS)
        vals = [v.text for v in dim.findall("w:Value", _NS) if v.text] if dim is not None else []
        # El "Default" de GIBS es la fecha de hoy aunque no haya imagen; la última fecha real es el final del último rango.
        fin = vals[-1].split("/")[1] if vals and "/" in vals[-1] else (vals[-1] if vals else None)
        rango = f"{vals[0].split('/')[0]}/{fin}" if vals else None
        if not ident or not niv:
            continue
        out.append({"id": ident, "titulo": l.findtext("o:Title", namespaces=_NS) or ident, "ext": "png" if "png" in fmt else "jpg",
                    "nivel": int(niv.group(1)), "matriz": ms, "tiempo": fin[:10] if fin and fin != "default" else None,
                    "periodo": rango})
    return _enriquecer(out)


def _landfire():
    x = requests.get("https://edcintl.cr.usgs.gov/geoserver/landfire/wms", params={"service": "WMS", "request": "GetCapabilities"}, timeout=60).text
    par = re.findall(r"<Layer[^>]*queryable[^>]*>\s*<Name>([^<]+)</Name>\s*<Title>([^<]*)</Title>", x)
    return [{"id": n, "titulo": t or n} for n, t in par if n.startswith("LF")]


def _pc():
    cols = requests.get("https://planetarycomputer.microsoft.com/api/stac/v1/collections", timeout=60).json()["collections"]
    out = []
    for c in cols:
        iv = (c.get("extent", {}).get("temporal", {}).get("interval") or [[None, None]])[0]
        out.append({"id": c["id"], "titulo": c.get("title") or c["id"], "desc": re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", c.get("description") or "")).strip()[:260],
                    "desde": (iv[0] or "")[:10], "hasta": (iv[1] or "")[:10], "palabras": c.get("keywords", [])[:6]})
    return out


def _usgs_colecciones():
    r = requests.get("https://api.waterdata.usgs.gov/ogcapi/v0/collections", params={"f": "json"}, timeout=60).json()
    return [{"id": c["id"], "titulo": c.get("title") or c["id"], "desc": (c.get("description") or "")[:200]} for c in r["collections"]]


def _mars():
    key = os.getenv("USDA_MARS_API_KEY", "").strip()
    if not key:
        return []
    r = requests.get("https://marsapi.ams.usda.gov/services/v1.2/reports", auth=(key, ""), timeout=30).json()
    return [{"id": x.get("slug_id"), "titulo": x.get("report_title"), "tipos": x.get("market_types") or []} for x in r]


def _power():
    r = requests.get("https://power.larc.nasa.gov/api/system/manager/parameters", params={"community": "ag", "temporal": "daily"}, timeout=60).json()
    return [{"id": k, "titulo": v.get("name"), "unidad": v.get("units"), "tipo": v.get("type")} for k, v in r.items()]


def _cmr_total():
    return int(requests.get("https://cmr.earthdata.nasa.gov/search/collections.json", params={"page_size": 1}, timeout=30).headers.get("CMR-Hits", 0))


def _seguro(fn):
    try:
        return fn()
    except Exception as e:  # una fuente caída no tumba el catálogo
        return {"estado": "ERROR", "detalle": f"{type(e).__name__}: {e}"}


def construir_catalogo() -> dict:
    def armar():
        from concurrent.futures import ThreadPoolExecutor
        fns = {"gibs": _gibs, "landfire": _landfire, "planetary": _pc, "usgs": _usgs_colecciones, "mars": _mars, "power": _power, "cmr_total": _cmr_total}
        with ThreadPoolExecutor(max_workers=7) as ex:
            futs = {k: ex.submit(_seguro, f) for k, f in fns.items()}
            return {k: f.result() for k, f in futs.items()}
    return _cache("cat", armar)


def estaciones_usgs(oeste: float, sur: float, este: float, norte: float) -> list:
    """Estaciones de monitoreo del USGS dentro de un cuadro del mapa (máx. 300)."""
    h = {"X-Api-Key": os.getenv("USGS_WATER_API_KEY", "").strip()}
    r = requests.get("https://api.waterdata.usgs.gov/ogcapi/v0/collections/monitoring-locations/items",
                     params={"bbox": f"{oeste},{sur},{este},{norte}", "limit": 300, "f": "json"}, headers=h, timeout=30)
    r.raise_for_status()
    out = []
    for f in r.json().get("features", []):
        p, g = f.get("properties", {}), f.get("geometry") or {}
        if g.get("type") == "Point":
            out.append({"id": f.get("id"), "nombre": p.get("monitoring_location_name"), "tipo": p.get("site_type"), "lon": g["coordinates"][0], "lat": g["coordinates"][1]})
    return out
