"""
Conectores 100% REALES hacia las APIs de NASA, USGS, USDA y Microsoft Planetary Computer.
Cero datos inventados o falsos: cada función hace peticiones HTTP en vivo a los servidores oficiales.
"""

import json
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import requests
from dotenv import load_dotenv

# Las llaves viven en ../../privado/.env (fuera de lo que se publica); si no existe, busca un .env normal.
load_dotenv(Path(__file__).resolve().parents[2] / "privado" / ".env")
load_dotenv()


# =====================================================================
# 1. NASA POWER v10 (Clima, Lluvia, Calor, Heladas y Humedad de Raíz)
#    NO REQUIERE CUENTA NI API KEY - Cobertura 100% Mundial
# =====================================================================
def fetch_nasa_power_real(lat: float, lon: float) -> dict:
    """
    Consulta en vivo la API REST de NASA POWER v10 (Comunidad Agroclimática 'AG').
    Devuelve la climatología mensual real (Ene-Dic) y el promedio anual real.
    """
    url = "https://power.larc.nasa.gov/api/temporal/climatology/point"
    parametros = [
        "T2M", "T2M_MAX", "T2M_MIN",
        "PRECTOTCORR",
        "GWETTOP", "GWETROOT",
        "ALLSKY_SFC_SW_DWN", "RH2M", "WS2M"
    ]
    params = {
        "parameters": ",".join(parametros),
        "community": "AG",
        "longitude": round(lon, 4),
        "latitude": round(lat, 4),
        "format": "JSON"
    }
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    payload = resp.json()
    param_data = payload["properties"]["parameter"]

    # Precipitación mensual viene en mm/día promedio -> multiplicar por días del mes para obtener mm/mes reales
    dias_por_mes = {
        "JAN": 31, "FEB": 28.25, "MAR": 31, "APR": 30, "MAY": 31, "JUN": 30,
        "JUL": 31, "AUG": 31, "SEP": 30, "OCT": 31, "NOV": 30, "DEC": 31
    }
    lluvia_mensual_mm = {
        mes: round(param_data["PRECTOTCORR"][mes] * dias, 1)
        for mes, dias in dias_por_mes.items()
    }
    lluvia_anual_mm = round(sum(lluvia_mensual_mm.values()), 1)

    return {
        "fuente_oficial": "NASA POWER v10 Agroclimatology API (En Vivo)",
        "url_consultada": resp.url,
        "elevacion_satelital_msnm": payload["geometry"]["coordinates"][2],
        "resumen_anual": {
            "temp_media_anual_c": param_data["T2M"]["ANN"],
            "temp_max_mes_mas_calido_c": max(v for k, v in param_data["T2M_MAX"].items() if k != "ANN"),
            "temp_min_mes_mas_frio_c": min(v for k, v in param_data["T2M_MIN"].items() if k != "ANN"),
            "precipitacion_anual_mm": lluvia_anual_mm,
            "humedad_superficial_media_pct": round(param_data["GWETTOP"]["ANN"] * 100.0, 1),
            "humedad_zona_radicular_media_pct": round(param_data["GWETROOT"]["ANN"] * 100.0, 1),
            "humedad_relativa_media_pct": param_data["RH2M"]["ANN"],
            "viento_medio_2m_m_s": param_data["WS2M"]["ANN"],
        },
        "series_12_meses": {
            "lluvia_mm_mes": lluvia_mensual_mm,
            "temp_max_c": {k: v for k, v in param_data["T2M_MAX"].items() if k != "ANN"},
            "temp_min_c": {k: v for k, v in param_data["T2M_MIN"].items() if k != "ANN"},
            "humedad_raiz_fraccion": {k: v for k, v in param_data["GWETROOT"].items() if k != "ANN"},
        }
    }


# =====================================================================
# 2. USDA NRCS WEB SOIL SURVEY / SSURGO (Suelo y Horizontes 0-150 cm)
#    NO REQUIERE CUENTA NI API KEY - Base de datos oficial del USDA
# =====================================================================
def fetch_usda_ssurgo_real(lat: float, lon: float) -> dict:
    """
    Consulta en vivo el servidor SQL espacial de USDA NRCS Soil Data Access (SDA).
    Extrae el perfil real del suelo y todos sus horizontes por profundidad (0 a 150+ cm).
    """
    url = "https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest"
    wkt = f"POINT({lon} {lat})"

    sql = f"""
    SELECT
        m.mukey,
        m.muname AS unidad_suelo,
        ma.drclassdcd AS drenaje,
        ma.hydgrpdcd AS grupo_hidrologico,
        ma.aws0100wta AS agua_disponible_100cm_cm,
        c.compname AS serie_suelo,
        c.comppct_r AS porcentaje_componente,
        c.tfact AS tolerancia_erosion_ton_acre,
        ch.hzname AS horizonte,
        ch.hzdept_r AS prof_inicio_cm,
        ch.hzdepb_r AS prof_fin_cm,
        ch.om_r AS materia_organica_pct,
        ch.ph1to1h2o_r AS ph_agua,
        ch.sandtotal_r AS arena_pct,
        ch.silttotal_r AS limo_pct,
        ch.claytotal_r AS arcilla_pct,
        ch.dbthirdbar_r AS densidad_aparente_g_cm3,
        ch.kwfact AS factor_k_erosion
    FROM mapunit AS m
    INNER JOIN muaggatt AS ma ON m.mukey = ma.mukey
    INNER JOIN component AS c ON m.mukey = c.mukey AND c.majcompflag = 'Yes'
    INNER JOIN chorizon AS ch ON c.cokey = ch.cokey
    WHERE m.mukey IN (
        SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('{wkt}')
    )
    ORDER BY c.comppct_r DESC, ch.hzdept_r ASC
    """

    resp = requests.post(url, json={"query": sql, "format": "JSON+COLUMNNAME"}, timeout=15)
    resp.raise_for_status()
    tablas = resp.json().get("Table", [])

    if len(tablas) < 2:
        return {
            "fuente_oficial": "USDA NRCS SSURGO (Fuera de cobertura EE. UU.)",
            "cobertura_encontrada": False
        }

    columnas = tablas[0]
    filas = [dict(zip(columnas, fila)) for fila in tablas[1:]]

    # Filtrar únicamente los horizontes de la serie de suelo dominante (primera serie encontrada)
    serie_principal = filas[0]["serie_suelo"]
    horizontes_reales = []
    for f in filas:
        if f["serie_suelo"] == serie_principal:
            densidad = float(f["densidad_aparente_g_cm3"]) if f["densidad_aparente_g_cm3"] else None
            horizontes_reales.append({
                "horizonte": f["horizonte"],
                "prof_inicio_cm": int(f["prof_inicio_cm"]) if f["prof_inicio_cm"] is not None else None,
                "prof_fin_cm": int(f["prof_fin_cm"]) if f["prof_fin_cm"] is not None else None,
                "materia_organica_pct": float(f["materia_organica_pct"]) if f["materia_organica_pct"] else None,
                "ph": float(f["ph_agua"]) if f["ph_agua"] else None,
                "arena_pct": float(f["arena_pct"]) if f["arena_pct"] else None,
                "limo_pct": float(f["limo_pct"]) if f["limo_pct"] else None,
                "arcilla_pct": float(f["arcilla_pct"]) if f["arcilla_pct"] else None,
                "densidad_aparente_g_cm3": densidad,
                "factor_k_erosion": float(f["factor_k_erosion"]) if f["factor_k_erosion"] else None,
            })

    capa_superficial = horizontes_reales[0]
    return {
        "fuente_oficial": "USDA NRCS Soil Data Access (SSURGO En Vivo)",
        "cobertura_encontrada": True,
        "mukey": filas[0]["mukey"],
        "unidad_suelo": filas[0]["unidad_suelo"],
        "serie_dominante": serie_principal,
        "drenaje": filas[0]["drenaje"],
        "grupo_hidrologico": filas[0]["grupo_hidrologico"],
        "agua_disponible_0_100cm_mm": round(float(filas[0]["agua_disponible_100cm_cm"]) * 10.0, 1) if filas[0]["agua_disponible_100cm_cm"] is not None else None,
        "capa_arable_superficial": capa_superficial,
        "horizontes_verticales_0_150cm": horizontes_reales
    }


# =====================================================================
# 3. USGS WATER DATA FOR THE NATION (Ríos, Pozos, Salinidad y Nitratos)
#    NO REQUIERE CUENTA NI API KEY - Sensores en tiempo real
# =====================================================================
def fetch_usgs_water_real(lat: float, lon: float, radio_grados: float = 0.25) -> dict:
    """
    Consulta en vivo la última lectura de los sensores de agua del USGS alrededor de la parcela
    (API nueva api.waterdata.usgs.gov, ~1 s; el servicio viejo waterservices tardaba 7 s o más).
    """
    url = "https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items"
    nombres = {"00060": "Caudal", "00065": "Nivel del agua", "72019": "Profundidad al nivel freático",
               "00095": "Conductancia específica", "99133": "Nitrato + nitrito"}
    params = {
        "bbox": f"{round(lon - radio_grados, 4)},{round(lat - radio_grados, 4)},{round(lon + radio_grados, 4)},{round(lat + radio_grados, 4)}",
        "parameter_code": ",".join(nombres), "limit": 50, "f": "json",
    }
    llave = os.getenv("USGS_WATER_API_KEY", "").strip()
    resp = requests.get(url, params=params, headers={"X-Api-Key": llave} if llave else {}, timeout=15)
    resp.raise_for_status()

    from datetime import datetime, timedelta, timezone
    limite = datetime.now(timezone.utc) - timedelta(days=3)  # esta colección también devuelve la última lectura de estaciones ya apagadas (años atrás)
    lecturas_en_vivo = []
    for f in resp.json().get("features", []):
        p = f["properties"]
        if datetime.fromisoformat(p["time"]) < limite:
            continue
        estacion = p["monitoring_location_id"].replace("USGS-", "")
        punto = (f.get("geometry") or {}).get("coordinates") or [None, None]
        lecturas_en_vivo.append({
            "estacion_id": estacion,
            "nombre_estacion": p["monitoring_location_id"],  # esta colección no trae el nombre de la estación
            "lat": punto[1], "lon": punto[0],
            "codigo_parametro": p["parameter_code"],
            "parametro": nombres.get(p["parameter_code"], p["parameter_code"]),
            "valor_actual": float(p["value"]),
            "unidad": p["unit_of_measure"],
            "fecha_hora_lectura": p["time"],
            "url_oficial_usgs": f"https://waterdata.usgs.gov/monitoring-location/{estacion}/",
        })

    return {
        "fuente_oficial": "USGS Water Data OGC API latest-continuous (En Vivo)",
        "total_lecturas_activas_en_radio": len(lecturas_en_vivo),
        "sensores_cercanos": lecturas_en_vivo[:12],
    }


# =====================================================================
# 4. MICROSOFT PLANETARY COMPUTER STAC API (Landsat, Sentinel-2, NAIP, 3DEP SRTM)
#    NO REQUIERE API KEY - Consulta por colección (cada una en su propio backend)
# =====================================================================
def fetch_planetary_computer_stac_real(lat: float, lon: float) -> dict:
    """
    Consulta en vivo el catálogo STAC de Microsoft Planetary Computer
    para descubrir las escenas reales más recientes de Sentinel-2, Landsat 8/9 y NAIP sobre la parcela.
    Nota: En Planetary Computer cada colección usa su propio backend de almacenamiento,
    por lo que se consultan de forma individual.
    """
    stac_url = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
    delta = 0.01
    bbox = [round(lon - delta, 4), round(lat - delta, 4), round(lon + delta, 4), round(lat + delta, 4)]

    colecciones = ["sentinel-2-l2a", "landsat-c2-l2", "naip"]
    escenas_reales = []

    def consultar(col):
        resp = requests.post(stac_url, json={"collections": [col], "bbox": bbox, "limit": 2}, timeout=15)
        return resp.json().get("features", []) if resp.status_code == 200 else []

    with ThreadPoolExecutor(len(colecciones)) as ex:
        por_coleccion = list(ex.map(consultar, colecciones))

    for features in por_coleccion:
        for item in features:
                props = item.get("properties", {})
                escenas_reales.append({
                    "coleccion": item.get("collection"),
                    "escena_id": item.get("id"),
                    "fecha_captura": props.get("datetime"),
                    "nubosidad_pct": props.get("eo:cloud_cover"),
                    "plataforma": props.get("platform") or props.get("instruments")
                })

    return {
        "fuente_oficial": "Microsoft Planetary Computer STAC API (En Vivo)",
        "escenas_satelitales_recientes": escenas_reales
    }


# =====================================================================
# 5. NASA EARTHDATA CMR API (Pasadas reales de SMAP, ECOSTRESS, GEDI, IMERG y HLS)
#    NO REQUIERE API KEY para descubrir los gránulos y enlaces reales sobre la parcela
# =====================================================================
def fetch_nasa_earthdata_cmr_real(lat: float, lon: float) -> dict:
    """
    Consulta en vivo el Common Metadata Repository (CMR) oficial de NASA Earthdata
    para obtener las pasadas satelitales exactas sobre la coordenada de la parcela:
    - SPL3SMP_E: NASA SMAP L3 Enhanced 9 km Soil Moisture
    - ECO_L2T_LSTE: NASA ECOSTRESS Land Surface Temperature & Emissivity (70m)
    - GEDI02_A: NASA GEDI LiDAR Canopy Height & Elevation
    - HLSL30: NASA Harmonized Landsat Sentinel-2 (30m)
    """
    cmr_url = "https://cmr.earthdata.nasa.gov/search/granules.json"
    misiones = [
        ("SPL3SMP_E", "NASA SMAP Humedad del Suelo (9 km)"),
        ("ECO_L2T_LSTE", "NASA ECOSTRESS Temperatura de Dosel (70 m)"),
        ("GEDI02_A", "NASA GEDI LiDAR Altura de Dosel y Topografía (25 m)"),
        ("HLSL30", "NASA/USGS Harmonized Landsat Sentinel-2 (30 m)")
    ]

    pasadas_reales = []
    def consultar(mision):
        params = {"short_name": mision[0], "point": f"{lon},{lat}", "page_size": 1, "sort_key": "-start_date"}
        resp = requests.get(cmr_url, params=params, timeout=15)
        return resp.json().get("feed", {}).get("entry", []) if resp.status_code == 200 else []

    with ThreadPoolExecutor(len(misiones)) as ex:
        por_mision = list(ex.map(consultar, misiones))

    for (short_name, descripcion), entries in zip(misiones, por_mision):
        if entries:
            g = entries[0]
            links = [lnk.get("href") for lnk in g.get("links", []) if lnk.get("href", "").startswith("https://")]
            pasadas_reales.append({
                "mision": descripcion,
                "short_name": short_name,
                "granulo_id": g.get("title"),
                "fecha_inicio_utc": g.get("time_start"),
                "fecha_fin_utc": g.get("time_end"),
                "enlace_descarga_earthdata": links[0] if links else None
            })

    return {
        "fuente_oficial": "NASA Earthdata Common Metadata Repository (CMR En Vivo)",
        "ultimas_pasadas_satelitales_nasa": pasadas_reales
    }


# =====================================================================
# 6. USFS / USGS LANDFIRE WMS GetFeatureInfo (Vegetación y Combustible a 30m)
#    NO REQUIERE API KEY - Consulta instantánea al píxel
# =====================================================================
def fetch_landfire_pixel_real(lat: float, lon: float) -> dict:
    """
    Consulta en vivo el GeoServer oficial de USGS/USFS LANDFIRE mediante WMS GetFeatureInfo.
    """
    if not (24 <= lat <= 50 and -125 <= lon <= -66):  # la capa es solo de EE. UU. continental
        return {"estado": "SIN_COBERTURA", "detalle": "LANDFIRE solo cubre EE. UU."}
    wms_url = "https://edcintl.cr.usgs.gov/geoserver/landfire/wms"
    capa = "LF2025_EVT_CONUS"  # probada 2026-11-14; el valor devuelto es el código EVT, no su nombre
    delta = 0.001
    params = {
        "SERVICE": "WMS",
        "VERSION": "1.1.1",
        "REQUEST": "GetFeatureInfo",
        "LAYERS": capa,
        "QUERY_LAYERS": capa,
        "BBOX": f"{lon - delta},{lat - delta},{lon + delta},{lat + delta}",
        "SRS": "EPSG:4326",
        "WIDTH": 101,
        "HEIGHT": 101,
        "X": 50,
        "Y": 50,
        "INFO_FORMAT": "application/json"
    }
    resp = requests.get(wms_url, params=params, timeout=12)
    if resp.status_code != 200:
        return {"fuente_oficial": "USGS LANDFIRE WMS", "estado": f"HTTP {resp.status_code}"}
    data = resp.json()
    features = data.get("features", [])
    return {
        "fuente_oficial": "USFS / DOI LANDFIRE LF 250 WMS (En Vivo)",
        "propiedades_pixel_30m": features[0].get("properties", {}) if features else {}
    }


# =====================================================================
# 7. CONECTORES CON TOKEN GRATUITO (NASA Earthdata AppEEARS, USDA AMS, OpenET)
#    Se activan automáticamente al pegar tu llave en backend/.env
# =====================================================================
_CACHE_OPENET = Path(__file__).resolve().parents[2] / "privado" / "datos" / "cache_openet.json"


def _cache_openet_leer() -> dict:
    try:
        return json.loads(_CACHE_OPENET.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _cache_openet_escribir(clave: str, valor: dict) -> None:
    datos = _cache_openet_leer()
    datos[clave] = valor
    _CACHE_OPENET.parent.mkdir(parents=True, exist_ok=True)
    _CACHE_OPENET.write_text(json.dumps(datos), encoding="utf-8")


def fetch_openet_point_real(lat: float, lon: float, start_date: str = "2025-04-01", end_date: str = "2025-10-31") -> dict:
    """
    Consulta la evapotranspiración real (consumo de agua en mm) usando OpenET API v2.
    Requiere OPENET_API_KEY en privado/.env.
    """
    api_key = os.getenv("OPENET_API_KEY", "").strip()
    if not api_key:
        return {
            "estado": "PENDIENTE_TOKEN",
            "instruccion": "Agrega OPENET_API_KEY en privado/.env (registro gratuito en https://etdata.org/api/)"
        }
    if not (24 <= lat <= 50 and -125 <= lon <= -66):  # OpenET solo cubre EE. UU.; fuera tarda 21 s en responder 404
        return {"estado": "SIN_COBERTURA", "detalle": "OpenET solo cubre el oeste y centro de EE. UU. continental"}
    llave_cache = f"{lat:.3f},{lon:.3f},{start_date},{end_date}"
    guardado = _cache_openet_leer().get(llave_cache)
    if guardado:  # el plan gratuito da solo 100 solicitudes al mes y cada parcela gasta 4: lo ya pedido no se vuelve a pedir
        return guardado
    url = "https://openet-api.org/raster/timeseries/point"
    headers = {"Authorization": api_key, "Content-Type": "application/json"}
    anio = start_date[:4]

    def pedir(variable, desde, hasta):
        payload = {"date_range": [desde, hasta], "interval": "monthly", "geometry": [lon, lat], "model": "Ensemble",
                   "variable": variable, "reference_et": "gridMET", "units": "mm", "file_format": "JSON"}
        resp = requests.post(url, json=payload, headers=headers, timeout=20)
        if resp.status_code == 404 and "limit" in resp.text.lower():
            raise RuntimeError("OpenET: límite mensual de solicitudes alcanzado (plan gratuito: 100); se reinicia el día 1 a las 00:00 UTC")
        resp.raise_for_status()
        return resp.json()

    def opcional(variable, desde, hasta):  # el rango y el NDVI son extras: si fallan, el ET sigue llegando
        try:
            return pedir(variable, desde, hasta)
        except Exception:
            return None

    with ThreadPoolExecutor(4) as ex:
        f_et = ex.submit(pedir, "ET", start_date, end_date)
        f_min = ex.submit(opcional, "ET_MAD_MIN", start_date, end_date)
        f_max = ex.submit(opcional, "ET_MAD_MAX", start_date, end_date)
        f_ndvi = ex.submit(opcional, "NDVI", f"{anio}-01-01", f"{anio}-12-31")
        series, mn, mx, ndvi = f_et.result(), f_min.result(), f_max.result(), f_ndvi.result()

    total_et = round(sum(float(i["et"]) for i in series if i.get("et") is not None), 1) if isinstance(series, list) else None
    res = {
        "fuente_oficial": "OpenET API v2 Ensemble Satellite Evapotranspiration (En Vivo)",
        "et_acumulada_temporada_mm": total_et,
        "series_et_mm": series,
        "rango_et_mm": [{"time": a["time"], "min": a.get("et_mad_min"), "max": b.get("et_mad_max")} for a, b in zip(mn, mx)] if mn and mx else None,
        "ndvi_mensual": ndvi,  # índice de vegetación (Landsat vía OpenET); None si no llegó
    }
    if isinstance(series, list) and ndvi and mn and mx:  # solo se guarda lo completo
        _cache_openet_escribir(llave_cache, res)
    return res


# Reportes "Grain Bids" por estado (slug verificados en la lista oficial de MARS); otros estados: sin dato.
_MARS_ESTADO = {"IA": 2850, "IL": 3192, "NE": 3225, "CA": 3146, "TX": 2711, "KS": 2886, "IN": 3463, "MO": 2932, "OH": 2851, "SD": 3186}
_BU_POR_TON = {"Corn": 39.368, "Soybeans": 36.744}  # 56 y 60 lb por bushel, medidas estándar


def fetch_usda_ams_market_news_real(lat: float, lon: float) -> dict:
    """Precios reales de granos del estado de la parcela (USDA AMS MARS v1.2). Requiere USDA_MARS_API_KEY."""
    api_key = os.getenv("USDA_MARS_API_KEY", "").strip()
    if not api_key:
        return {"estado": "PENDIENTE_TOKEN", "instruccion": "Agrega USDA_MARS_API_KEY en privado/.env"}
    geo = requests.get("https://geocoding.geo.census.gov/geocoder/geographies/coordinates",
                       params={"x": lon, "y": lat, "benchmark": "Public_AR_Current", "vintage": "Current_Current", "layers": "States", "format": "json"}, timeout=15)
    geo.raise_for_status()
    est = geo.json()["result"]["geographies"].get("States") or []
    if not est:
        return {"estado": "SIN_COBERTURA", "motivo": "La parcela está fuera de Estados Unidos"}
    sigla, nombre = est[0]["STUSAB"], est[0]["NAME"]
    slug = _MARS_ESTADO.get(sigla)
    if not slug:
        return {"estado": "SIN_COBERTURA", "estado_usa": nombre, "motivo": f"Sin reporte de granos cargado para {nombre}"}
    r = requests.get(f"https://marsapi.ams.usda.gov/services/v1.2/reports/{slug}", auth=(api_key, ""), params={"allSections": "true", "lastReports": 1}, timeout=30)
    r.raise_for_status()
    filas = next((x["results"] for x in r.json() if x.get("reportSection") == "Report Detail"), [])
    por = {}
    for f in filas:
        if f.get("avg_price") is not None and f.get("commodity"):
            por.setdefault((f["commodity"], f.get("price_unit")), []).append(f)
    precios = []
    for (prod, unidad), fs in por.items():
        v = [x["avg_price"] for x in fs]
        prom = round(sum(v) / len(v), 2)
        precios.append({"producto": prod, "promedio": prom, "minimo": round(min(v), 2), "maximo": round(max(v), 2), "unidad": unidad,
                        "por_tonelada_usd": round(prom * _BU_POR_TON[prod]) if prod in _BU_POR_TON and unidad == "$ Per Bushel" else None,
                        "n_puntos": len(v), "fecha": fs[0].get("report_date")})
    return {"fuente_oficial": "USDA AMS MyMarketNews API v1.2 (En Vivo)", "estado_usa": nombre, "reporte": filas[0]["report_title"] if filas else None, "precios": precios}



def geocodificar_google(texto: str) -> dict:
    """
    Convierte un pueblo, condado o dirección agrícola en lat/lon reales.
    1. Intenta primero con GOOGLE_MAPS_API_KEY si tiene Billing activo.
    2. Si Google responde REQUEST_DENIED (por el bloqueo de pantalla de Billing),
       usa automáticamente el Geocodificador Oficial Abierto de OpenStreetMap (Nominatim) en vivo.
    """
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    if api_key:
        d = requests.get("https://maps.googleapis.com/maps/api/geocode/json", params={"address": texto, "key": api_key}, timeout=15).json()
        if d.get("status") == "OK" and d.get("results"):
            r = d["results"][0]
            return {
                "fuente": "Google Maps Geocoding API (En Vivo)",
                "direccion": r["formatted_address"],
                "lat": float(r["geometry"]["location"]["lat"]),
                "lon": float(r["geometry"]["location"]["lng"]),
            }

    # Respaldo automático 100% real y sin tarjeta (OpenStreetMap Nominatim API)
    resp_osm = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": texto, "format": "json", "limit": 1},
        headers={"User-Agent": "FieldShift-NASA-SpaceApps-2026/1.0"},
        timeout=15,
    )
    resp_osm.raise_for_status()
    datos_osm = resp_osm.json()
    if datos_osm:
        item = datos_osm[0]
        return {
            "fuente": "OpenStreetMap Nominatim Geocoder (En Vivo - Respaldo Automático)",
            "direccion": item.get("display_name"),
            "lat": float(item["lat"]),
            "lon": float(item["lon"]),
        }
    return {"estado": "ZERO_RESULTS", "detalle": f"No se encontró la ubicación: {texto}"}


def listar_reportes_ams() -> list:
    """Catálogo real de reportes MARS (slug_id y título) para elegir cuál consultar."""
    api_key = os.getenv("USDA_MARS_API_KEY", "").strip()
    if not api_key:
        return []
    resp = requests.get("https://marsapi.ams.usda.gov/services/v1.2/reports", auth=(api_key, ""), timeout=20)
    resp.raise_for_status()
    return [{"slug_id": r.get("slug_id"), "titulo": r.get("report_title")} for r in resp.json()]


def verificar_llaves_en_vivo() -> dict:
    """Prueba cada llave contra su servidor y devuelve solo el código HTTP, nunca el valor."""
    estado = {}
    token = "".join(os.getenv("EARTHDATA_TOKEN", "").split()).strip("\"'")  # el token pegado suele traer saltos de línea
    if token:
        r = requests.get("https://cmr.earthdata.nasa.gov/search/granules.json", params={"short_name": "SPL3SMP_E", "page_size": 1},
                         headers={"Authorization": f"Bearer {token}"}, timeout=20)
        estado["earthdata_cmr_http"] = r.status_code
    mars = os.getenv("USDA_MARS_API_KEY", "").strip()
    if mars:
        r = requests.get("https://marsapi.ams.usda.gov/services/v1.2/reports", auth=(mars, ""), timeout=20)
        estado["mars_http"] = r.status_code
    usgs_key = os.getenv("USGS_WATER_API_KEY", "").strip()
    if usgs_key:
        r = requests.get("https://api.waterdata.usgs.gov/ogcapi/v0/collections/monitoring-locations/items",
                         params={"limit": 1, "f": "json"}, headers={"X-Api-Key": usgs_key}, timeout=20)
        estado["usgs_ogc_http"] = r.status_code
    openet_key = os.getenv("OPENET_API_KEY", "").strip()
    if openet_key:
        r = requests.post("https://openet-api.org/raster/timeseries/point",
                          json={"date_range": ["2025-05-01", "2025-06-30"], "interval": "monthly", "geometry": [-93.6319, 42.0308],
                                "model": "Ensemble", "variable": "ET", "reference_et": "gridMET", "units": "mm", "file_format": "JSON"},
                          headers={"Authorization": openet_key, "Content-Type": "application/json"}, timeout=20)
        estado["openet_http"] = r.status_code
    mm_user = os.getenv("METEOMATICS_USER", "").strip()
    mm_pass = os.getenv("METEOMATICS_PASS", "").strip()
    if mm_user and mm_pass:
        r = requests.get("https://api.meteomatics.com/2026-11-14T00:00:00Z/t_2m:C/42.0308,-93.6319/json",
                         auth=(mm_user, mm_pass), timeout=20)
        estado["meteomatics_http"] = r.status_code
    gmaps = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    if gmaps:
        geo = geocodificar_google("Ames, Iowa")
        estado["google_maps_status"] = "OK" if "lat" in geo else geo.get("estado")
    return estado


def fetch_meteomatics_weather_real(lat: float, lon: float) -> dict:
    """
    Consulta en vivo la Oferta Global de Meteomatics Weather API (modelos US1k / EURO1k a 1 km de resolución,
    1,000 consultas/día gratis para NASA Space Apps: https://www.meteomatics.com/en/meteomatics-and-nasa-space-apps-challenge/).
    Requiere METEOMATICS_USER y METEOMATICS_PASS en privado/.env.
    """
    user = os.getenv("METEOMATICS_USER", "").strip()
    pwd = os.getenv("METEOMATICS_PASS", "").strip()
    if not (user and pwd):
        return {
            "estado": "PENDIENTE_TOKEN",
            "instruccion": (
                "Reclama la Oferta Global gratuita de Meteomatics (1,000 consultas/día a 1 km de resolución) en "
                "https://www.meteomatics.com/en/meteomatics-and-nasa-space-apps-challenge/ y agrega "
                "METEOMATICS_USER y METEOMATICS_PASS con configurar_env.py"
            )
        }
    from datetime import datetime, timezone
    ahora_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT00:00:00Z")
    parametros = "t_2m:C,t_min_2m_24h:C,precip_24h:mm,soil_moisture_index_-15cm:idx"
    url = f"https://api.meteomatics.com/{ahora_iso}P7D:PT24H/{parametros}/{lat},{lon}/json"
    resp = requests.get(url, params={"model": "mix"}, auth=(user, pwd), timeout=15)
    resp.raise_for_status()
    return {
        "fuente_oficial": "Meteomatics Weather API Global Offer (Model Mix 1 km US1k/EURO1k En Vivo)",
        "pronostico_7_dias_1km": resp.json()
    }


def verificar_estado_tokens_env() -> dict:
    """
    Comprueba qué tokens opcionales ya configuró el usuario en su archivo .env.
    """
    return {
        "EARTHDATA_TOKEN_configurado": bool(os.getenv("EARTHDATA_TOKEN", "").strip()),
        "USDA_MARS_API_KEY_configurado": bool(os.getenv("USDA_MARS_API_KEY", "").strip()),
        "USGS_WATER_API_KEY_configurado": bool(os.getenv("USGS_WATER_API_KEY", "").strip()),
        "OPENET_API_KEY_configurado": bool(os.getenv("OPENET_API_KEY", "").strip()),
        "METEOMATICS_configurado": bool(os.getenv("METEOMATICS_USER", "").strip() and os.getenv("METEOMATICS_PASS", "").strip()),
        "GOOGLE_MAPS_API_KEY_configurado": bool(os.getenv("GOOGLE_MAPS_API_KEY", "").strip()),
    }
