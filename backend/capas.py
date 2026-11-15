"""Aprovechar el catálogo: preguntas con su paquete de capas comprobadas, y series de valores reales sobre el terreno.
Comprobar las capas de cada pregunta abriendo una imagen de verdad (desde `publico`): python -m backend.capas"""
import re, sqlite3, sys, time
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Request
from backend import base

router = APIRouter(prefix="/api/v1/capas")
POWER = "https://power.larc.nasa.gov/api/temporal/daily/point"

# Tema de cada capa por las palabras de su título y su grupo. El orden importa: gana el primero que coincide.
TEMAS = (("incendios", r"fire|thermal anomal|burn"), ("desastres", r"flood|landslide|earthquake|volcan|cyclone|hurricane"), ("nieve", r"snow|ice |sea ice|ndsi|freeze"),
         ("vegetacion", r"ndvi|evi\b|lai\b|fpar|vegetation|chlorophyll|gpp|npp|crop|land cover|phenolog"), ("agua", r"soil moisture|precipitation|rain|imerg|smap|evapotransp|water vapor|runoff|groundwater|drought"),
         ("temperatura", r"temperature|lst\b|brightness temp|heat"), ("suelo", r"soil|elevation|slope|terrain|topograph|land surface refl"), ("atmosfera", r"aerosol|ozone|cloud|dust|carbon monoxide|no2|so2|methane|co2|wind|pressure|humidity"),
         ("imagen", r"corrected reflectance|true color|false color|imagery|blue marble|night"))


def tema(texto):
    t = (texto or "").lower()
    return next((k for k, rx in TEMAS if re.search(rx, t)), "otro")


# 12 preguntas de campo. Cada una pide capas por patrón sobre el título o el identificador del catálogo de GIBS; se quedan solo
# las que de verdad entregan imagen (ver `comprobar`). `series` son las variables diarias de NASA POWER que responden con un valor en el terreno.
PREGUNTAS = [
    {"id": "sequia", "t": {"es": "¿Hay sequía?", "en": "Is there a drought?", "pt": "Há seca?"}, "gibs": [r"SMAP_L4_Analyzed_Root_Zone_Soil_Moisture$", r"MODIS_Terra_NDVI_8Day$", r"IMERG_Precipitation_Rate$", r"MODIS_Terra_Land_Surface_Temp_Day$"], "series": ["GWETROOT", "PRECTOTCORR", "T2M_MAX"],
     "leer": {"es": "Suelo de raíz seco, poca lluvia y verdor bajo a la vez apuntan a sequía. Una sola capa no basta.", "en": "Dry root-zone soil, little rain and low greenness together point to drought. One layer alone is not enough.", "pt": "Solo da raiz seco, pouca chuva e verdor baixo juntos apontam para seca. Uma camada só não basta."}},
    {"id": "humedad", "t": {"es": "¿Cómo está la humedad del suelo?", "en": "How is soil moisture?", "pt": "Como está a umidade do solo?"}, "gibs": [r"SMAP_L4_Analyzed_Surface_Soil_Moisture$", r"SMAP_L4_Analyzed_Root_Zone_Soil_Moisture$", r"SMAP_L3_Passive_Enhanced_Day_Soil_Moisture$"], "series": ["GWETTOP", "GWETROOT", "GWETPROF"],
     "leer": {"es": "La capa superficial cambia en horas; la de raíz, en días. Son de unos 9 km: no distinguen un surco de otro.", "en": "The surface layer changes within hours; the root zone within days. They are about 9 km: they cannot tell one furrow from another.", "pt": "A camada superficial muda em horas; a da raiz, em dias. São de cerca de 9 km: não distinguem um sulco do outro."}},
    {"id": "cultivo", "t": {"es": "¿Cómo está mi cultivo?", "en": "How is my crop doing?", "pt": "Como está minha cultura?"}, "gibs": [r"MODIS_Terra_NDVI_8Day$", r"MODIS_Terra_EVI_8Day$", r"MODIS_Combined_L4_LAI_8Day$", r"MODIS_Combined_L4_FPAR_8Day$"], "series": ["ALLSKY_SFC_PAR_TOT", "T2M"],
     "leer": {"es": "Más verde es más hoja viva. Compara contra la misma fecha de otros años, no contra el vecino.", "en": "Greener means more living leaf. Compare against the same date in other years, not against the neighbour.", "pt": "Mais verde é mais folha viva. Compare com a mesma data de outros anos, não com o vizinho."}},
    {"id": "helada", "t": {"es": "¿Hubo o habrá helada?", "en": "Was there or will there be frost?", "pt": "Houve ou haverá geada?"}, "gibs": [r"MODIS_Terra_Land_Surface_Temp_Night$", r"MODIS_Aqua_Land_Surface_Temp_Night$", r"MODIS_Terra_L3_NDSI_Snow_Cover_Daily$"], "series": ["T2M_MIN", "T2MDEW", "TS"],
     "leer": {"es": "La temperatura de la superficie de noche muestra dónde enfrió más. El pronóstico está en Datos región.", "en": "Night-time surface temperature shows where it got coldest. The forecast is under Region data.", "pt": "A temperatura da superfície à noite mostra onde esfriou mais. A previsão está em Dados da região."}},
    {"id": "lluvia", "t": {"es": "¿Cómo va la lluvia?", "en": "How is rainfall going?", "pt": "Como vai a chuva?"}, "gibs": [r"IMERG_Precipitation_Rate$", r"IMERG_Precipitation_Rate_30min$", r"MODIS_Terra_Cloud_Top_Temp_Day$"], "series": ["PRECTOTCORR", "RH2M"],
     "leer": {"es": "La capa muestra dónde llueve ahora. El total de tu terreno sale de la serie diaria.", "en": "The layer shows where it is raining now. Your field's total comes from the daily series.", "pt": "A camada mostra onde chove agora. O total do seu terreno vem da série diária."}},
    {"id": "incendios", "t": {"es": "¿Hubo incendios cerca?", "en": "Were there fires nearby?", "pt": "Houve incêndios por perto?"}, "gibs": [r"VIIRS_NOAA20_Thermal_Anomalies_375m_All$", r"VIIRS_SNPP_Thermal_Anomalies_375m_All$", r"MODIS_Aqua_Thermal_Anomalies_Day$", r"MODIS_Terra_Thermal_Anomalies_Day$"], "series": ["WS2M", "RH2M"],
     "leer": {"es": "Cada punto es calor detectado desde el espacio: puede ser un incendio, una quema agrícola o una chimenea.", "en": "Each dot is heat detected from space: it may be a wildfire, a farm burn or a chimney.", "pt": "Cada ponto é calor detectado do espaço: pode ser incêndio, queimada agrícola ou chaminé."}},
    {"id": "inundacion", "t": {"es": "¿Hay agua encharcada o inundación?", "en": "Is there standing water or flooding?", "pt": "Há água empoçada ou inundação?"}, "gibs": [r"MODIS_Combined_Flood_1-Day$", r"MODIS_Combined_Flood_2-Day$", r"MODIS_Combined_Flood_3-Day$"], "series": ["PRECTOTCORR", "GWETTOP"],
     "leer": {"es": "Marca agua donde normalmente hay tierra. Con nubes no ve; la capa de 3 días tapa menos huecos.", "en": "It marks water where there is normally land. It cannot see through cloud; the 3-day layer has fewer gaps.", "pt": "Marca água onde normalmente há terra. Com nuvens não vê; a camada de 3 dias tem menos falhas."}},
    {"id": "calor", "t": {"es": "¿Hay estrés por calor?", "en": "Is there heat stress?", "pt": "Há estresse por calor?"}, "gibs": [r"MODIS_Terra_Land_Surface_Temp_Day$", r"MODIS_Aqua_Land_Surface_Temp_Day$", r"VIIRS_SNPP_Land_Surface_Temp_Day$"], "series": ["T2M_MAX", "T2M_RANGE", "ALLSKY_SFC_SW_DWN"],
     "leer": {"es": "Es la temperatura de la superficie, no la del aire: un suelo desnudo se calienta mucho más que un cultivo regado.", "en": "This is surface temperature, not air temperature: bare soil heats far more than a watered crop.", "pt": "É a temperatura da superfície, não do ar: solo exposto aquece muito mais que uma cultura irrigada."}},
    {"id": "nieve", "t": {"es": "¿Hay nieve o hielo?", "en": "Is there snow or ice?", "pt": "Há neve ou gelo?"}, "gibs": [r"MODIS_Terra_L3_NDSI_Snow_Cover_Daily$", r"MODIS_Aqua_L3_NDSI_Snow_Cover_Daily$", r"VIIRS_SNPP_NDSI_Snow_Cover$"], "series": ["T2M_MIN", "TS"],
     "leer": {"es": "Cubierta de nieve del día. Con nubes queda en blanco: revisa también la imagen natural.", "en": "The day's snow cover. Under cloud it is blank: check the natural image as well.", "pt": "Cobertura de neve do dia. Com nuvens fica em branco: confira também a imagem natural."}},
    {"id": "aire", "t": {"es": "¿Hay humo o polvo en el aire?", "en": "Is there smoke or dust in the air?", "pt": "Há fumaça ou poeira no ar?"}, "gibs": [r"MODIS_Combined_MAIAC_L2G_AerosolOpticalDepth$", r"MODIS_Terra_Aerosol$", r"OMPS_NPP_AerosolIndex$", r"VIIRS_SNPP_CorrectedReflectance_TrueColor$"], "series": ["WS2M", "ALLSKY_SFC_SW_DWN", "CLRSKY_SFC_SW_DWN"],
     "leer": {"es": "Mucho aerosol es aire turbio: baja la luz que le llega a la planta. La diferencia entre sol real y sol sin nubes lo confirma.", "en": "High aerosol means hazy air: less light reaches the plant. The gap between actual and clear-sky sunlight confirms it.", "pt": "Muito aerossol é ar turvo: diminui a luz que chega à planta. A diferença entre sol real e sol sem nuvens confirma."}},
    {"id": "luz", "t": {"es": "¿Cuánto sol y nubes ha habido?", "en": "How much sun and cloud has there been?", "pt": "Quanto sol e nuvens houve?"}, "gibs": [r"MODIS_Terra_Cloud_Fraction_Day$", r"MODIS_Aqua_Cloud_Fraction_Day$", r"VIIRS_SNPP_CorrectedReflectance_TrueColor$"], "series": ["ALLSKY_SFC_SW_DWN", "CLRSKY_SFC_SW_DWN", "ALLSKY_SFC_PAR_TOT", "ALLSKY_SFC_LW_DWN"],
     "leer": {"es": "Días nublados seguidos frenan el crecimiento aunque haya agua.", "en": "A run of cloudy days slows growth even when there is water.", "pt": "Dias nublados seguidos freiam o crescimento mesmo com água."}},
    {"id": "viento", "t": {"es": "¿Cómo ha estado el viento y el aire para fumigar?", "en": "How have wind and air been for spraying?", "pt": "Como estiveram o vento e o ar para pulverizar?"}, "gibs": [r"VIIRS_SNPP_CorrectedReflectance_TrueColor$", r"MODIS_Terra_Water_Vapor_5km_Day$"], "series": ["WS2M", "WS2M_MAX", "RH2M", "QV2M", "PS", "T2MWET"],
     "leer": {"es": "No hay capa de viento en imagen: se lee de la serie diaria. Son datos de ayer hacia atrás, no un pronóstico.", "en": "There is no wind image layer: read it from the daily series. These are data up to yesterday, not a forecast.", "pt": "Não há camada de vento em imagem: leia da série diária. São dados até ontem, não uma previsão."}},
]

# Las 20 variables diarias de NASA POWER (comunidad agro) que se guardan como serie del terreno. Nombre y unidad son los de POWER.
SERIES = {"T2M": ("Temperatura del aire a 2 m", "°C"), "T2M_MAX": ("Temperatura máxima", "°C"), "T2M_MIN": ("Temperatura mínima", "°C"), "T2M_RANGE": ("Diferencia entre máxima y mínima", "°C"),
          "T2MDEW": ("Punto de rocío", "°C"), "T2MWET": ("Temperatura de bulbo húmedo", "°C"), "TS": ("Temperatura de la superficie", "°C"), "RH2M": ("Humedad relativa del aire", "%"),
          "QV2M": ("Humedad específica del aire", "g/kg"), "PRECTOTCORR": ("Lluvia", "mm/día"), "WS2M": ("Viento a 2 m", "m/s"), "WS2M_MAX": ("Viento máximo a 2 m", "m/s"), "PS": ("Presión", "kPa"),
          "ALLSKY_SFC_SW_DWN": ("Sol que llega al suelo", "MJ/m²/día"), "CLRSKY_SFC_SW_DWN": ("Sol que llegaría sin nubes", "MJ/m²/día"), "ALLSKY_SFC_LW_DWN": ("Radiación de onda larga", "MJ/m²/día"),
          "ALLSKY_SFC_PAR_TOT": ("Luz útil para la planta", "MJ/m²/día"), "GWETTOP": ("Humedad del suelo superficial (0 a 5 cm)", "fracción 0 a 1"), "GWETROOT": ("Humedad del suelo en la raíz", "fracción 0 a 1"),
          "GWETPROF": ("Humedad de todo el perfil del suelo", "fracción 0 a 1")}
DIAS = 90


def _db():
    con = sqlite3.connect(base.DATOS / "capas_uso.sqlite", timeout=60)
    con.executescript("""CREATE TABLE IF NOT EXISTS curadas (pregunta TEXT, id TEXT, titulo TEXT, ok INTEGER, fecha_dato TEXT, revisado TEXT, detalle TEXT, PRIMARY KEY (pregunta, id));
    CREATE TABLE IF NOT EXISTS series (lat REAL, lon REAL, capa TEXT, fecha TEXT, valor REAL, PRIMARY KEY (lat, lon, capa, fecha));""")
    return con


def comprobar(avance=None):
    """Abre de verdad una imagen de cada capa pedida por las preguntas y guarda si respondió y de qué fecha es su último dato."""
    from backend.catalogo import construir_catalogo
    gibs = construir_catalogo().get("gibs", [])
    con = _db(); con.execute("DELETE FROM curadas"); n = 0
    for p in PREGUNTAS:
        for rx in p["gibs"]:
            for c in [c for c in gibs if re.search(rx, c["id"])][:1] or [None]:
                if c is None:
                    con.execute("INSERT OR REPLACE INTO curadas VALUES (?,?,?,?,?,?,?)", (p["id"], rx.rstrip("$"), None, 0, None, base.ahora_iso(), "no está en el catálogo de GIBS")); continue
                z = min(3, c["nivel"]); x, y = (2 ** z) * 87 // 360, (2 ** z) * 3 // 8  # una imagen sobre el centro de Norteamérica
                url = f"https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{c['id']}/default/{(c.get('tiempo') or '') + '/' if c.get('tiempo') else ''}{c['matriz']}/{z}/{y}/{x}.{c['ext']}"
                try:
                    r = base.pedir("GET", url, timeout=30)
                    ok = r.status_code == 200 and r.headers.get("content-type", "").startswith("image") and len(r.content) > 200
                    det = None if ok else f"HTTP {r.status_code}, {len(r.content)} bytes"
                except Exception as e:
                    ok, det = False, f"{type(e).__name__}"
                con.execute("INSERT OR REPLACE INTO curadas VALUES (?,?,?,?,?,?,?)", (p["id"], c["id"], c.get("titulo_largo") or c["titulo"], int(ok), c.get("tiempo"), base.ahora_iso(), det)); n += ok
    con.commit(); con.close()
    return n


@router.get("/preguntas")
def preguntas():
    """Las preguntas con las capas que respondieron en la última comprobación, cada una con la fecha de su último dato."""
    con = _db(); filas = con.execute("SELECT pregunta, id, titulo, ok, fecha_dato, revisado, detalle FROM curadas").fetchall(); con.close()
    por = {}
    for q, i, t, ok, f, rev, det in filas:
        por.setdefault(q, []).append({"id": i, "titulo": t, "ok": bool(ok), "fecha_dato": f, "revisado": rev, "detalle": det})
    return {"estado": "OK" if filas else "SIN_COMPROBAR", "detalle": None if filas else "Falta comprobar las capas: python -m backend.capas",
            "preguntas": [{"id": p["id"], "titulo": p["t"], "leer": p["leer"], "series": [{"capa": s, "nombre": SERIES[s][0], "unidad": SERIES[s][1]} for s in p["series"]],
                           "capas": [c for c in por.get(p["id"], []) if c["ok"]], "descartadas": [c for c in por.get(p["id"], []) if not c["ok"]]} for p in PREGUNTAS]}


def series_de(lat, lon):
    """Serie diaria de 90 días de las 20 variables de NASA POWER en el punto. Se guarda en SQLite y se resume."""
    lat, lon = round(lat, 2), round(lon, 2)  # POWER es de ~50 km: dos decimales sobran
    fin = date.today() - timedelta(days=1); ini = fin - timedelta(days=DIAS)

    def bajar():
        r = base.pedir("GET", POWER, params={"parameters": ",".join(SERIES), "community": "AG", "longitude": lon, "latitude": lat, "start": ini.strftime("%Y%m%d"), "end": fin.strftime("%Y%m%d"), "format": "JSON"}, timeout=60)
        if r.status_code != 200:
            return {"estado": "ERROR", "detalle": f"NASA POWER respondió {r.status_code}"}
        par = r.json()["properties"]["parameter"]
        filas = [(lat, lon, k, f"{d[:4]}-{d[4:6]}-{d[6:]}", None if v is None or v <= -900 else v) for k, s in par.items() for d, v in s.items()]  # -999 es «sin dato» en POWER
        with base._LOCK:
            con = _db(); con.executemany("INSERT OR REPLACE INTO series VALUES (?,?,?,?,?)", filas); con.commit(); con.close()
        return {"estado": "OK", "bajado": base.ahora_iso()}

    marca = base.recordar("power_series", [lat, lon], 12 * 3600, bajar)
    con = _db(); out = {}
    for k, (nombre, unidad) in SERIES.items():
        s = [(f, v) for f, v in con.execute("SELECT fecha, valor FROM series WHERE lat=? AND lon=? AND capa=? AND fecha>=? ORDER BY fecha", (lat, lon, k, ini.isoformat())) if v is not None]
        if not s:
            continue
        v7, v30 = [v for _, v in s[-7:]], [v for _, v in s[-30:]]
        suma = k == "PRECTOTCORR"  # la lluvia se suma; lo demás se promedia
        out[k] = {"nombre": nombre, "unidad": unidad, "ultimo": round(s[-1][1], 2), "fecha": s[-1][0], "dias_con_dato": len(s),
                  "ult_7d": round(sum(v7) if suma else sum(v7) / len(v7), 2), "ult_30d": round(sum(v30) if suma else sum(v30) / len(v30), 2), "agregado": "suma" if suma else "media",
                  "min_90d": round(min(v for _, v in s), 2), "max_90d": round(max(v for _, v in s), 2), "serie": [[f, round(v, 2)] for f, v in s[-60:]]}
    con.close()
    return {"estado": "OK" if out else marca.get("estado", "ERROR"), "detalle": marca.get("detalle"), "fuente": "NASA POWER, serie diaria (comunidad agro)", "resolucion": "unos 50 km", "tipo": "estimacion",
            "nota": "POWER es un reanálisis: estima el valor de la zona, no lo mide en tu terreno. Llega con 2 a 5 días de retraso.", "lat": lat, "lon": lon, "cache": marca.get("cache"), "variables": out}


_T = {  # frases de los hechos en los tres idiomas; {} se llena con los datos
    "helada": ("Heló {n} de los últimos 7 días con dato; la mínima fue {v} °C el {f}.", "It froze on {n} of the last 7 days with data; the low was {v} °C on {f}.", "Geou em {n} dos últimos 7 dias com dado; a mínima foi {v} °C em {f}."),
    "helada_r": ("helada: mínima de 0 °C o menos (regla del equipo)", "frost: low of 0 °C or below (team rule)", "geada: mínima de 0 °C ou menos (regra da equipe)"),
    "lluvia": ("Llovieron {a} mm en los últimos 7 días con dato y {b} mm en los últimos 30.", "{a} mm of rain fell in the last 7 days with data and {b} mm in the last 30.", "Choveram {a} mm nos últimos 7 dias com dado e {b} mm nos últimos 30."),
    "seca": ("Van {n} días seguidos con menos de 1 mm de lluvia.", "{n} days in a row with less than 1 mm of rain.", "São {n} dias seguidos com menos de 1 mm de chuva."),
    "seca_r": ("racha seca: 10 días o más con menos de 1 mm (regla del equipo)", "dry spell: 10 days or more under 1 mm (team rule)", "estiagem: 10 dias ou mais com menos de 1 mm (regra da equipe)"),
    "raiz": ("La humedad del suelo en la raíz está en {v} (escala de 0 a 1){c}.", "Root-zone soil moisture is {v} (0 to 1 scale){c}.", "A umidade do solo na raiz está em {v} (escala de 0 a 1){c}."),
    "raiz_sube": (", subió {d} en 7 días", ", up {d} in 7 days", ", subiu {d} em 7 dias"), "raiz_baja": (", bajó {d} en 7 días", ", down {d} in 7 days", ", caiu {d} em 7 dias"),
    "raiz_r": ("suelo de raíz seco: menos de 0.35 (regla del equipo)", "dry root zone: under 0.35 (team rule)", "solo da raiz seco: menos de 0.35 (regra da equipe)"),
    "calor": ("La máxima media de los últimos 7 días con dato fue {a} °C; el pico en 90 días, {b} °C.", "The average high over the last 7 days with data was {a} °C; the 90-day peak, {b} °C.", "A máxima média dos últimos 7 dias com dado foi {a} °C; o pico em 90 dias, {b} °C."),
    "sol": ("En los últimos 7 días llegó al suelo {p} % del sol que habría llegado sin nubes.", "Over the last 7 days {p}% of the clear-sky sunlight reached the ground.", "Nos últimos 7 dias chegou ao solo {p} % do sol que chegaria sem nuvens."),
    "viento": ("El viento máximo medio de los últimos 7 días fue {v} m/s.", "The average peak wind over the last 7 days was {v} m/s.", "O vento máximo médio dos últimos 7 dias foi {v} m/s."),
    "si_siembra": ("Las secuencias son reglas del equipo, no una predicción. Para saber qué cultivo hubo aquí, corre el modelo de cultivos en Mi terreno.", "The sequences are team rules, not a prediction. To learn which crop was here, run the crop model under My field.", "As sequências são regras da equipe, não uma previsão. Para saber qual cultura houve aqui, rode o modelo de culturas em Meu terreno."),
    "si_sin_dato": ("No tengo ese dato para este terreno.", "I don't have that data for this field.", "Não tenho esse dado para este terreno."),
    "si_tema": ("No reconocí el tema de la pregunta; esto es todo lo que sé de este terreno.", "I didn't recognize the topic; this is everything I know about this field.", "Não reconheci o tema da pergunta; isto é tudo o que sei deste terreno."),
    "si_modo": ("Respuesta armada con reglas sobre los datos del terreno. No hay un modelo de lenguaje conectado.", "Answer built with rules over the field's data. No language model is connected.", "Resposta montada com regras sobre os dados do terreno. Não há modelo de linguagem conectado."),
    "t_helada": ("Helada en los últimos días", "Frost in recent days", "Geada nos últimos dias"), "t_racha_seca": ("Racha seca", "Dry spell", "Estiagem"), "t_humedad_raiz": ("Suelo de raíz seco", "Dry root zone", "Solo da raiz seco"),
}


def tx(k, lang="es", **v):
    return _T[k][{"es": 0, "en": 1, "pt": 2}.get(lang, 0)].format(**v)


def hechos_de(s, lang="es"):
    """Lo que las series dicen del terreno, en frases con su dato, su fecha y su fuente. Las usan las alertas, el resumen del día y el asistente.
    Los cortes (helada a 0 °C, racha seca con menos de 1 mm, suelo de raíz bajo 0.35) son reglas del equipo y se dicen como tales."""
    v, out = s.get("variables", {}), []

    def h(clave, texto, dato, capa, gravedad="info", regla=None):
        out.append({"clave": clave, "texto": texto, "dato": dato, "unidad": v[capa]["unidad"], "fecha": v[capa]["fecha"], "capa": capa, "fuente": "NASA POWER", "tipo": "estimacion", "gravedad": gravedad, "regla": regla})

    if "T2M_MIN" in v:
        frias = [(f, x) for f, x in v["T2M_MIN"]["serie"][-7:] if x <= 0]
        if frias:
            h("helada", tx("helada", lang, n=len(frias), v=min(x for _, x in frias), f=min(frias, key=lambda p: p[1])[0]), min(x for _, x in frias), "T2M_MIN", "atencion", tx("helada_r", lang))
    if "PRECTOTCORR" in v:
        s_ll = v["PRECTOTCORR"]["serie"]; seca = 0
        for _, x in reversed(s_ll):
            if x >= 1:
                break
            seca += 1
        h("lluvia_7d", tx("lluvia", lang, a=v['PRECTOTCORR']['ult_7d'], b=v['PRECTOTCORR']['ult_30d']), v["PRECTOTCORR"]["ult_7d"], "PRECTOTCORR")
        if seca >= 10:
            h("racha_seca", tx("seca", lang, n=seca), seca, "PRECTOTCORR", "atencion", tx("seca_r", lang))
    if "GWETROOT" in v:
        g = v["GWETROOT"]; cambio = round(g["ultimo"] - g["serie"][-8][1], 2) if len(g["serie"]) >= 8 else None
        h("humedad_raiz", tx("raiz", lang, v=g['ultimo'], c=tx("raiz_sube" if cambio > 0 else "raiz_baja", lang, d=abs(cambio)) if cambio else ""), g["ultimo"], "GWETROOT",
          "atencion" if g["ultimo"] < 0.35 else "info", tx("raiz_r", lang) if g["ultimo"] < 0.35 else None)
    if "T2M_MAX" in v:
        h("calor_7d", tx("calor", lang, a=v['T2M_MAX']['ult_7d'], b=v['T2M_MAX']['max_90d']), v["T2M_MAX"]["ult_7d"], "T2M_MAX")
    if "ALLSKY_SFC_SW_DWN" in v and "CLRSKY_SFC_SW_DWN" in v and v["CLRSKY_SFC_SW_DWN"]["ult_7d"]:
        pct = round(100 * v["ALLSKY_SFC_SW_DWN"]["ult_7d"] / v["CLRSKY_SFC_SW_DWN"]["ult_7d"])
        h("sol_7d", tx("sol", lang, p=pct), pct, "ALLSKY_SFC_SW_DWN")
    if "WS2M_MAX" in v:
        h("viento_7d", tx("viento", lang, v=v['WS2M_MAX']['ult_7d']), v["WS2M_MAX"]["ult_7d"], "WS2M_MAX")
    return out


@router.get("/series")
def series(request: Request, terreno_id: str = "", lang: str = "es"):
    from backend.cuenta import _terreno_de
    t = _terreno_de(request, terreno_id)
    if not t:
        return {"estado": "ERROR", "detalle": "Elige un terreno guardado."}
    try:
        s = series_de(t["lat"], t["lon"])
    except Exception as e:
        return {"estado": "ERROR", "detalle": f"{type(e).__name__}: {e}"[:200]}
    s["hechos"] = hechos_de(s, lang)
    return s


@router.get("/aire")
def aire(sur: float, oeste: float, norte: float, este: float):
    """Tiempo de ahora en una rejilla de 4 × 3 puntos sobre lo que se ve del mapa: temperatura, humedad, lluvia y viento con su dirección.
    Fuente: Open-Meteo (modelos meteorológicos nacionales, de 2 a 11 km). Sin llave. Se guarda 15 minutos."""
    if not (-90 <= sur < norte <= 90 and -180 <= oeste < este <= 180):
        return {"estado": "ERROR", "detalle": "Recuadro no válido"}
    lats = [round(sur + (norte - sur) * (i + .5) / 3, 3) for i in range(3)]
    lons = [round(oeste + (este - oeste) * (j + .5) / 4, 3) for j in range(4)]
    pts = [(a, b) for a in lats for b in lons]

    def bajar():
        r = base.pedir("GET", "https://api.open-meteo.com/v1/forecast", params={"latitude": ",".join(str(a) for a, _ in pts), "longitude": ",".join(str(b) for _, b in pts),
                       "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m", "wind_speed_unit": "ms", "timezone": "UTC"}, timeout=20)
        if r.status_code != 200:
            return {"estado": "ERROR", "detalle": f"Open-Meteo respondió {r.status_code}"}
        d = r.json(); d = d if isinstance(d, list) else [d]
        return {"estado": "OK", "puntos": [{"lat": x["latitude"], "lon": x["longitude"], "hora": x["current"]["time"], "temp_c": x["current"]["temperature_2m"], "humedad_pct": x["current"]["relative_humidity_2m"],
                 "lluvia_mm": x["current"]["precipitation"], "viento_ms": x["current"]["wind_speed_10m"], "viento_dir": x["current"]["wind_direction_10m"], "rachas_ms": x["current"]["wind_gusts_10m"]} for x in d]}

    v = base.recordar("aire", [round(sur, 2), round(oeste, 2), round(norte, 2), round(este, 2)], 900, bajar)
    v.update(fuente="Open-Meteo (modelos meteorológicos nacionales)", resolucion="2 a 11 km", tipo="estimacion")
    return v


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    t = time.time(); n = comprobar()
    con = _db()
    print(f"{n} capas respondieron con imagen, en {time.time() - t:.1f} s\n")
    for q, i, ok, f, det in con.execute("SELECT pregunta, id, ok, fecha_dato, detalle FROM curadas ORDER BY pregunta, ok DESC"):
        print(f"{'sí ' if ok else 'NO '} {q:11} {i:55} {f or '—':12} {det or ''}")
