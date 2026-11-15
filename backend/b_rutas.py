"""
Rutas nuevas de la Cápsula B (Antigravity) — Field Shift (NASA Space Apps 2026)
-------------------------------------------------------------------------------
Reglas de oro:
1. Nada inventado: todo sale de NASA POWER (1985-2025), Sentinel-2 (rejilla.py),
   OpenStreetMap Overpass API o las bases SQLite reales.
2. Cero lectura de .env ni exposición de llaves.
3. Listo para conectarse en main.py con:
     from backend.b_rutas import router as b_router
     app.include_router(b_router)
"""

import json
import math
import time
from datetime import date, timedelta
from pathlib import Path
import requests
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/v1/b", tags=["Capsula-B"])

_CACHE_B: dict = {}
_RUTA_SIM = Path(__file__).resolve().parent / "b_simulados.json"


def _percentil(valores: list[float], p: float) -> float | None:
    if not valores:
        return None
    s = sorted(valores)
    k = (len(s) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return round(s[int(k)], 2)
    return round(s[f] * (c - k) + s[c] * (k - f), 2)


def _tendencia_por_decada(anios: list[int], valores: list[float]) -> float | None:
    if len(anios) < 5 or len(anios) != len(valores):
        return None
    n = len(anios)
    mx = sum(anios) / n
    my = sum(valores) / n
    num = sum((x - mx) * (y - my) for x, y in zip(anios, valores))
    den = sum((x - mx) ** 2 for x in anios)
    if den == 0:
        return None
    return round((num / den) * 10.0, 2)


@router.get("/clima-historico")
def clima_historico_40_anios(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
):
    """
    Áreas 19, 20, 21 y 23 (Cápsula B):
    - Serie histórica real de 40 años (1985–2024) de NASA POWER Monthly API.
    - Promedios diarios recientes y comparación contra el mismo periodo del año anterior (NASA POWER Daily API).
    - Fechas típicas de primera y última helada (T2M_MIN <= 0 °C).
    """
    clave = ("clima_hist", round(lat, 2), round(lon, 2))
    if clave in _CACHE_B and time.time() - _CACHE_B[clave][0] < 3600:
        return _CACHE_B[clave][1]

    # 1. Serie interanual de 40 años (NASA POWER Monthly 1985-2024)
    url_m = "https://power.larc.nasa.gov/api/temporal/monthly/point"
    params_m = {
        "parameters": "T2M,T2M_MAX,T2M_MIN,PRECTOTCORR",
        "community": "AG",
        "longitude": lon,
        "latitude": lat,
        "start": 1985,
        "end": 2024,
        "format": "JSON",
    }
    rm = requests.get(url_m, params=params_m, timeout=20)
    rm.raise_for_status()
    pm = rm.json().get("properties", {}).get("parameter", {})
    t2m_m = pm.get("T2M", {})
    tmin_m = pm.get("T2M_MIN", {})
    prec_m = pm.get("PRECTOTCORR", {})

    dias_mes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    anios_serie = []
    for y in range(1985, 2025):
        t_anual = t2m_m.get(f"{y}13")
        tmin_anual = tmin_m.get(f"{y}13")
        lluvia_meses = []
        for idx, dm in enumerate(dias_mes, start=1):
            v = prec_m.get(f"{y}{idx:02d}")
            if v is not None and v > -900:
                lluvia_meses.append(float(v) * dm)
        lluvia_anual = round(sum(lluvia_meses), 1) if len(lluvia_meses) == 12 else None
        if t_anual is not None and t_anual > -900 and lluvia_anual is not None:
            anios_serie.append({
                "anio": y,
                "temp_media_c": round(float(t_anual), 2),
                "temp_min_extrema_c": round(float(tmin_anual), 2) if tmin_anual is not None and tmin_anual > -900 else None,
                "lluvia_anual_mm": lluvia_anual,
            })

    temps = [x["temp_media_c"] for x in anios_serie if x["temp_media_c"] is not None]
    lluvias = [x["lluvia_anual_mm"] for x in anios_serie if x["lluvia_anual_mm"] is not None]
    anios_num = [x["anio"] for x in anios_serie]

    # 2. Promedios diarios recientes y comparación contra el año anterior (NASA POWER Daily)
    hoy = date.today()
    hace_30 = hoy - timedelta(days=35)
    inicio_act = hace_30 - timedelta(days=30)
    inicio_prev = inicio_act - timedelta(days=365)
    fin_prev = hace_30 - timedelta(days=365)

    url_d = "https://power.larc.nasa.gov/api/temporal/daily/point"
    params_d = {
        "parameters": "T2M,T2M_MIN,T2M_MAX,PRECTOTCORR",
        "community": "AG",
        "longitude": lon,
        "latitude": lat,
        "start": inicio_prev.strftime("%Y%m%d"),
        "end": hace_30.strftime("%Y%m%d"),
        "format": "JSON",
    }
    rd = requests.get(url_d, params=params_d, timeout=20)
    diarios_recientes = []
    comparacion_anual = None
    heladas_info = {"meses_con_helada_historica": []}

    if rd.status_code == 200:
        pd = rd.json().get("properties", {}).get("parameter", {})
        dt2m = pd.get("T2M", {})
        dtmin = pd.get("T2M_MIN", {})
        dtmax = pd.get("T2M_MAX", {})
        dprec = pd.get("PRECTOTCORR", {})

        fechas_validas = sorted(k for k, v in dt2m.items() if v is not None and v > -900)
        for fk in fechas_validas[-14:]:
            diarios_recientes.append({
                "fecha": f"{fk[:4]}-{fk[4:6]}-{fk[6:8]}",
                "t_media_c": round(float(dt2m.get(fk)), 1),
                "t_min_c": round(float(dtmin.get(fk)), 1) if dtmin.get(fk, -999) > -900 else None,
                "t_max_c": round(float(dtmax.get(fk)), 1) if dtmax.get(fk, -999) > -900 else None,
                "lluvia_mm": round(float(dprec.get(fk)), 1) if dprec.get(fk, -999) > -900 else None,
            })

        # Comparar ventana de 30 días actual vs. misma ventana 1 año antes
        s_act_i, s_act_f = inicio_act.strftime("%Y%m%d"), hace_30.strftime("%Y%m%d")
        s_prv_i, s_prv_f = inicio_prev.strftime("%Y%m%d"), fin_prev.strftime("%Y%m%d")
        t_act = [float(dt2m[k]) for k in fechas_validas if s_act_i <= k <= s_act_f and dt2m.get(k, -999) > -900]
        t_prv = [float(dt2m[k]) for k in fechas_validas if s_prv_i <= k <= s_prv_f and dt2m.get(k, -999) > -900]
        p_act = [float(dprec[k]) for k in fechas_validas if s_act_i <= k <= s_act_f and dprec.get(k, -999) > -900]
        p_prv = [float(dprec[k]) for k in fechas_validas if s_prv_i <= k <= s_prv_f and dprec.get(k, -999) > -900]

        if t_act and t_prv and p_act and p_prv:
            m_t_act = round(sum(t_act) / len(t_act), 2)
            m_t_prv = round(sum(t_prv) / len(t_prv), 2)
            s_p_act = round(sum(p_act), 1)
            s_p_prv = round(sum(p_prv), 1)
            comparacion_anual = {
                "periodo_actual": f"{s_act_i[:4]}-{s_act_i[4:6]}-{s_act_i[6:8]} a {s_act_f[:4]}-{s_act_f[4:6]}-{s_act_f[6:8]}",
                "periodo_anio_anterior": f"{s_prv_i[:4]}-{s_prv_i[4:6]}-{s_prv_i[6:8]} a {s_prv_f[:4]}-{s_prv_f[4:6]}-{s_prv_f[6:8]}",
                "temp_media_actual_c": m_t_act,
                "temp_media_anio_anterior_c": m_t_prv,
                "diferencia_temp_c": round(m_t_act - m_t_prv, 2),
                "lluvia_actual_mm": s_p_act,
                "lluvia_anio_anterior_mm": s_p_prv,
                "diferencia_lluvia_mm": round(s_p_act - s_p_prv, 1),
            }

        # Fechas de helada observadas en el último año completo
        fechas_helada = [k for k, v in dtmin.items() if v is not None and -900 < v <= 0.0]
        primavera = [k for k in fechas_helada if "01" <= k[4:6] <= "06"]
        otono = [k for k in fechas_helada if "08" <= k[4:6] <= "12"]
        heladas_info = {
            "total_dias_helada_observados": len(fechas_helada),
            "ultima_helada_primavera": f"{primavera[-1][:4]}-{primavera[-1][4:6]}-{primavera[-1][6:8]}" if primavera else None,
            "primera_helada_otono": f"{otono[0][:4]}-{otono[0][4:6]}-{otono[0][6:8]}" if otono else None,
        }

    res = {
        "estado": "OK",
        "fuente_oficial": "NASA POWER v10 Monthly (1985-2024) & Daily Agroclimatology API (En Vivo)",
        "estadistica_40_anios": {
            "periodo": "1985-2024",
            "n_anios": len(anios_serie),
            "temp_media_40a_c": round(sum(temps) / len(temps), 2) if temps else None,
            "temp_p10_c": _percentil(temps, 10),
            "temp_p50_mediana_c": _percentil(temps, 50),
            "temp_p90_c": _percentil(temps, 90),
            "tendencia_temp_c_por_decada": _tendencia_por_decada(anios_num, temps),
            "lluvia_media_40a_mm": round(sum(lluvias) / len(lluvias), 1) if lluvias else None,
            "lluvia_p10_seca_mm": _percentil(lluvias, 10),
            "lluvia_p50_mediana_mm": _percentil(lluvias, 50),
            "lluvia_p90_humeda_mm": _percentil(lluvias, 90),
            "tendencia_lluvia_mm_por_decada": _tendencia_por_decada(anios_num, lluvias),
        },
        "comparacion_contra_anio_pasado": comparacion_anual,
        "heladas_observadas": heladas_info,
        "promedios_diarios_recientes": diarios_recientes,
        "serie_anual_1985_2024": anios_serie,
    }
    _CACHE_B[clave] = (time.time(), res)
    return res


@router.get("/osm-campos")
def osm_campos_agricolas(
    sur: float = Query(..., ge=-90, le=90),
    oeste: float = Query(..., ge=-180, le=180),
    norte: float = Query(..., ge=-90, le=90),
    este: float = Query(..., ge=-180, le=180),
):
    """
    Área 13 (Cápsula B): Consulta polígonos reales de uso agrícola (farmland, orchard, meadow, vineyard)
    en OpenStreetMap vía Overpass API con reintentos y caché.
    """
    if (norte - sur) > 0.15 or (este - oeste) > 0.15:
        return {"estado": "ZOOM", "detalle": "Acerca más el mapa (zoom >= 13) para consultar los campos agrícolas de OpenStreetMap.", "campos": []}

    clave = ("osm", round(sur, 3), round(oeste, 3), round(norte, 3), round(este, 3))
    if clave in _CACHE_B and time.time() - _CACHE_B[clave][0] < 3600:
        return _CACHE_B[clave][1]

    q = f'[out:json][timeout:15];(way["landuse"~"farmland|orchard|vineyard|meadow"]({sur},{oeste},{norte},{este}););out geom 60;'
    servidores = [
        "https://overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter",
    ]
    ultimo_err = ""
    for srv in servidores:
        try:
            r = requests.post(srv, data={"data": q}, timeout=16, headers={"User-Agent": "FieldShift-NASA-SpaceApps-2026/1.0"})
            if r.status_code == 200:
                elems = r.json().get("elements", [])
                campos = []
                for el in elems:
                    geom = el.get("geometry", [])
                    if len(geom) >= 3:
                        campos.append({
                            "osm_id": el.get("id"),
                            "uso": el.get("tags", {}).get("landuse", "farmland"),
                            "cultivo_tag": el.get("tags", {}).get("crop"),
                            "nombre": el.get("tags", {}).get("name"),
                            "coordenadas": [[pt["lat"], pt["lon"]] for pt in geom],
                        })
                out = {
                    "estado": "OK",
                    "fuente_oficial": "OpenStreetMap Overpass API (Polígonos agrícolas reales)",
                    "total_campos": len(campos),
                    "campos": campos,
                }
                _CACHE_B[clave] = (time.time(), out)
                return out
            ultimo_err = f"HTTP {r.status_code} en {srv}"
        except Exception as e:
            ultimo_err = f"{type(e).__name__}: {e}"

    return {"estado": "ERROR", "detalle": f"OpenStreetMap Overpass no respondió tras reintentos ({ultimo_err}).", "campos": []}


@router.get("/modelos")
def fichas_modelos():
    """
    Área 31 y 36 (Cápsula B): Devuelve las fichas honestas de los modelos de IA con su acierto medido,
    región de entrenamiento, importancia de variables y límites.
    """
    datos = json.loads(_RUTA_SIM.read_text(encoding="utf-8")) if _RUTA_SIM.exists() else {"modelos_fichas": []}
    imp = Path(__file__).resolve().parents[2] / "privado" / "datos" / "importancia_final.json"  # medida por permutación sobre el modelo real (cápsula C)
    for m in datos.get("modelos_fichas", []):
        if m.get("id") == "M1":
            m["importancia_variables"] = json.loads(imp.read_text(encoding="utf-8"))["variables"] if imp.exists() else []
            met = imp.parent / "metricas_modelo_final.json"  # lo que midió la prueba estricta; si falta, el acierto queda sin dato
            if met.exists():
                x = json.loads(met.read_text(encoding="utf-8"))
                m.update(acierto_medido_pct=round(100 * x["oficial"]["acierto"], 1), acierto_maiz_soya_pct=round(100 * x["oficial"]["maiz_soya"], 1),
                         referencia_base_pct=round(100 * x["siempre_la_mas_comun"]), acierto_por_anio=x["oficial"].get("por_anio"), acierto_por_zona=x["oficial"].get("por_zona"),
                         por_clase={k: v for k, v in x.get("por_clase", {}).items() if isinstance(v, dict) and " " not in k}, prueba=x.get("prueba"), muestras=x.get("multizona_muestras") or x.get("muestras"))
    return {
        "estado": "OK",
        "fuente": "Fichas de evaluación de modelos Field Shift (Validación por año nuevo y bloques espaciales de 25 km)",
        "frase_obligatoria": "Todo resultado de IA es una predicción, no una medición: confirmar siempre en el campo.",
        "modelos": datos.get("modelos_fichas", []),
    }

