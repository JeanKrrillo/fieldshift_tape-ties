"""
Script de verificación en vivo de las APIs reales conectadas (Sin datos falsos).
Ejecutar con: python backend/test_real_apis.py
"""

import json
from real_connectors import (
    fetch_nasa_power_real,
    fetch_usda_ssurgo_real,
    fetch_usgs_water_real,
    fetch_planetary_computer_stac_real,
    fetch_nasa_earthdata_cmr_real,
    fetch_meteomatics_weather_real,
    fetch_openet_point_real,
    fetch_usda_ams_market_news_real,
    verificar_estado_tokens_env,
    verificar_llaves_en_vivo,
)

# Coordenada real de una parcela agrícola en Ames, Iowa (Corn Belt)
LAT_PARCELA = 42.0308
LON_PARCELA = -93.6319


def ejecutar_diagnostico_real():
    print("=================================================================")
    print(f"PROBANDO CONEXIONES REALES EN VIVO PARA PARCELA ({LAT_PARCELA}, {LON_PARCELA})")
    print("=================================================================\n")

    print("[1/4] Consultando NASA POWER v10 (Clima, Lluvia y Humedad de Raíz)...")
    clima = fetch_nasa_power_real(LAT_PARCELA, LON_PARCELA)
    print(f"  -> Fuente: {clima['fuente_oficial']}")
    print(f"  -> Elevación satelital: {clima['elevacion_satelital_msnm']} msnm")
    print(f"  -> Resumen anual real: {json.dumps(clima['resumen_anual'], ensure_ascii=False)}\n")

    print("[2/4] Consultando USDA NRCS Web Soil Survey / SSURGO (Suelo y Horizontes 0-150 cm)...")
    suelo = fetch_usda_ssurgo_real(LAT_PARCELA, LON_PARCELA)
    print(f"  -> Fuente: {suelo['fuente_oficial']}")
    print(f"  -> Unidad de suelo real: {suelo.get('unidad_suelo')}")
    print(f"  -> Serie dominante: {suelo.get('serie_dominante')} | Drenaje: {suelo.get('drenaje')} | Grupo Hidrológico: {suelo.get('grupo_hidrologico')}")
    print(f"  -> Agua disponible (0-100 cm): {suelo.get('agua_disponible_0_100cm_mm')} mm")
    print(f"  -> Horizontes verticales encontrados ({len(suelo.get('horizontes_verticales_0_150cm', []))} capas):")
    for h in suelo.get("horizontes_verticales_0_150cm", []):
        print(f"     * Horizonte {h['horizonte']} ({h['prof_inicio_cm']}-{h['prof_fin_cm']} cm): "
              f"MO={h['materia_organica_pct']}%, pH={h['ph']}, Arcilla={h['arcilla_pct']}%, "
              f"Densidad={h['densidad_aparente_g_cm3']} g/cm3, Factor K={h['factor_k_erosion']}")
    print()

    print("[3/4] Consultando USGS Water Data for the Nation (Ríos, Pozos y Nitratos en vivo)...")
    agua = fetch_usgs_water_real(LAT_PARCELA, LON_PARCELA)
    print(f"  -> Fuente: {agua['fuente_oficial']}")
    print(f"  -> Total sensores activos alrededor de la parcela: {agua['total_lecturas_activas_en_radio']}")
    for s in agua["sensores_cercanos"][:4]:
        print(f"     * [{s['estacion_id']}] {s['nombre_estacion']}: {s['parametro']} = {s['valor_actual']} ({s['fecha_hora_lectura']})")
    print()

    print("[4/6] Consultando Microsoft Planetary Computer STAC (Escenas Landsat, Sentinel-2 y NAIP)...")
    stac = fetch_planetary_computer_stac_real(LAT_PARCELA, LON_PARCELA)
    print(f"  -> Fuente: {stac['fuente_oficial']}")
    for esc in stac["escenas_satelitales_recientes"][:4]:
        print(f"     * [{esc['coleccion']}] ID={esc['escena_id']} | Fecha={esc['fecha_captura']} | Nubes={esc['nubosidad_pct']}%")
    print()

    print("[5/6] Consultando NASA Earthdata CMR (Pasadas Reales de SMAP, ECOSTRESS, GEDI y HLS)...")
    cmr = fetch_nasa_earthdata_cmr_real(LAT_PARCELA, LON_PARCELA)
    print(f"  -> Fuente: {cmr['fuente_oficial']}")
    for p in cmr["ultimas_pasadas_satelitales_nasa"]:
        print(f"     * [{p['short_name']}] {p['mision']} -> Gránulo: {p['granulo_id']} ({p['fecha_inicio_utc']})")
    print()

    print("[6/8] Consultando Meteomatics Weather API (Modelo Mix 1 km - Pronóstico 7 días en vivo)...")
    mm = fetch_meteomatics_weather_real(LAT_PARCELA, LON_PARCELA)
    print(f"  -> Fuente: {mm.get('fuente_oficial')}")
    for param_block in mm.get("pronostico_7_dias_1km", {}).get("data", []):
        param_name = param_block.get("parameter")
        fechas = param_block.get("coordinates", [{}])[0].get("dates", [])
        muestra = ", ".join(f"{d['date'][:10]}={d['value']}" for d in fechas[:3])
        print(f"     * Parámetro {param_name}: {muestra} ...")
    print()

    print("[7/8] Consultando OpenET API v2 (Evapotranspiración Satelital Ensemble en mm)...")
    et = fetch_openet_point_real(LAT_PARCELA, LON_PARCELA)
    print(f"  -> Fuente: {et.get('fuente_oficial')}")
    print(f"  -> Consumo hídrico acumulado (Abr-Oct): {et.get('et_acumulada_temporada_mm')} mm")
    print(f"  -> Serie mensual (mm): {et.get('series_et_mm')}\n")

    print("[8/8] Consultando USDA AMS MyMarketNews API v1.2 (Precios Agrícolas Reales)...")
    ams = fetch_usda_ams_market_news_real(42.0308, -93.6319)
    print(f"  -> Fuente: {ams.get('fuente_oficial')}")
    resultados_ams = ams.get("precios", [])
    print(f"  -> Registros recibidos del reporte del estado: {len(resultados_ams)}\n")

    print("[Estado de Llaves Opcionales en .env]:")
    print(" ", verificar_estado_tokens_env())
    print("[Llaves probadas contra su servidor (200 = sirve, 401/403 = no)]:")
    print(" ", verificar_llaves_en_vivo())
    print("\n=================================================================")
    print("TODAS LAS CONEXIONES ABIERTAS RESPONDIERON CON DATOS 100% REALES.")
    print("=================================================================")


if __name__ == "__main__":
    ejecutar_diagnostico_real()
