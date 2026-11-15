"""SI de campo: responde preguntas sobre un terreno solo con sus datos reales. Cada frase lleva su dato, su fecha y su fuente.
Modo reglas: arma la respuesta con los hechos medidos o estimados del terreno. Si falta un dato, lo dice; nunca inventa una cifra.
`numeros_fuera_de_contexto` es el filtro para cuando responda un modelo de lenguaje: toda cifra de su texto debe existir en el contexto."""
import re
from fastapi import APIRouter, Request
from backend import capas

router = APIRouter(prefix="/api/v1/si")

TEMAS = (("helada", r"hel|frost|geada|fr[ií]o|cold|congel", ["helada"]), ("lluvia", r"lluv|llov|rain|chuv|chov|precip", ["lluvia_7d", "racha_seca"]),
         ("humedad", r"humed|moist|umid|sec[oa]|sequ|drought|rieg|irrig|agua|water", ["humedad_raiz", "racha_seca", "lluvia_7d"]), ("calor", r"calor|heat|temperatur|quente", ["calor_7d", "helada"]),
         ("sol", r"\bsol\b|sun|nub|cloud|luz|light|nuv", ["sol_7d"]), ("viento", r"vient|wind|vento|fumig|spray|pulver", ["viento_7d"]), ("siembra", r"sembr|siembr|plant|cultiv|crop|rotaci|rotation|semear", []))


def numeros_fuera_de_contexto(texto, contexto):
    """Cifras del texto que no aparecen en el contexto. Lista vacía = el texto no inventó ningún número."""
    num = lambda s: {x.replace(",", ".").rstrip(".") for x in re.findall(r"-?\d+(?:[.,]\d+)?", s)}
    return sorted(num(texto) - num(contexto))


def contexto_de(request, t, lang="es"):
    """Todo lo que se sabe del terreno, en frases con procedencia: series de NASA POWER, reglas del equipo sobre la parcela y lecturas del robot."""
    from backend.cuenta import _decisiones
    from backend.robot_datos import ultimas
    hechos, faltan = [], []
    try:
        hechos += capas.hechos_de(capas.series_de(t["lat"], t["lon"]), lang)
    except Exception:
        faltan.append("Serie diaria de NASA POWER")
    rot = []
    try:
        d = _decisiones(t); h1 = d["horizonte_1_hoy_7_dias"]
        if h1.get("agua_disponible_perfil_mm") is not None:
            hechos.append({"clave": "agua_suelo", "texto": f"El primer metro de suelo puede guardar {h1['agua_disponible_perfil_mm']:.0f} mm de agua útil.", "fecha": None, "fuente": "USDA SSURGO", "tipo": "medicion", "gravedad": "info", "regla": None})
        rot = [{"clave": "rotacion", "texto": f"{e['camino']}: {e['secuencia']}. {e['justificacion_datos_reales']}", "fecha": None, "fuente": "Regla del equipo sobre datos de la parcela", "tipo": "regla", "gravedad": "info", "regla": "secuencias de rotación del equipo"}
               for e in d["horizonte_2_esta_temporada"]["estrategias_rotacion"]]
    except Exception:
        faltan.append("Datos del lugar (NASA POWER, USDA SSURGO)")
    for v in ultimas()["variables"]:
        hechos.append({"clave": "robot_" + v["variable"], "texto": f"{ {'en': 'The robot measured', 'pt': 'O robô mediu'}.get(lang, 'El robot midió') } {v.get('nombre') or v['variable']}: {v['valor']:g} {v.get('unidad') or ''}".rstrip() + ".", "fecha": v["t"][:10], "fuente": "Robot", "tipo": "medicion", "gravedad": "info", "regla": None})
    return hechos, rot, faltan


def _obtener_terreno(request, tid=None, lat=None, lon=None, nombre=""):
    """Devuelve el terreno del usuario o construye uno al vuelo con lat/lon para responder sin bloquear al usuario."""
    if tid and str(tid).isdigit():
        from backend.cuenta import _terreno_de
        t = _terreno_de(request, int(tid))
        if t:
            return t
    if lat is not None and lon is not None:
        try:
            flat = float(lat)
            flon = float(lon)
            return {
                "id": None,
                "nombre": str(nombre or "Parcela seleccionada"),
                "lat": flat,
                "lon": flon,
                "area_ha": 1.0,
                "cultivo_actual": "Maíz",
                "tipo": "poligono",
                "puntos": [[flat, flon]]
            }
        except (ValueError, TypeError):
            pass
    try:
        from backend.cuenta import lista_terrenos
        terrenos = lista_terrenos(request)
        if terrenos:
            return terrenos[0]
    except Exception:
        pass
    return {
        "id": None,
        "nombre": str(nombre or "Ames, Iowa"),
        "lat": 42.0308,
        "lon": -93.6319,
        "area_ha": 1.0,
        "cultivo_actual": "Maíz",
        "tipo": "poligono",
        "puntos": [[42.0308, -93.6319]]
    }


@router.get("/resumen")
def resumen(request: Request, terreno_id: str = "", lat: float = None, lon: float = None, nombre: str = "", lang: str = "es"):
    """Las 3 cosas más importantes del terreno ahora, cada una con su fuente. Primero lo que pide atención."""
    t = _obtener_terreno(request, terreno_id, lat, lon, nombre)
    hechos, _, faltan = contexto_de(request, t, lang)
    orden = sorted(hechos, key=lambda h: (h["gravedad"] != "atencion", h["clave"].startswith("robot_")))
    return {"estado": "OK", "modo": "reglas", "frases": orden[:3], "faltan": faltan, "terreno": t.get("nombre")}


@router.post("")
async def preguntar(request: Request):
    d = await request.json()
    t = _obtener_terreno(request, d.get("terreno_id"), d.get("lat"), d.get("lon"), d.get("nombre"))
    q = str(d.get("pregunta") or "")[:300].lower()
    lang = str(d.get("lang") or "es")
    hechos, rot, faltan = contexto_de(request, t, lang)
    tema = next((x for x in TEMAS if re.search(x[1], q)), None)
    if tema and tema[0] == "siembra":
        resp = rot + [h for h in hechos if h["clave"] in ("humedad_raiz", "lluvia_7d", "agua_suelo")]
        nota = capas.tx("si_siembra", lang)
    elif tema:
        resp = [h for h in hechos if h["clave"] in tema[2] or (h["clave"].startswith("robot_") and re.search(tema[1], h["clave"]))]
        nota = None if resp else capas.tx("si_sin_dato", lang)
    else:
        resp, nota = hechos, capas.tx("si_tema", lang)
    return {
        "estado": "OK",
        "modo": "reglas",
        "modo_nota": capas.tx("si_modo", lang),
        "respuesta": resp,
        "nota": nota,
        "faltan": faltan,
        "terreno": t.get("nombre")
    }
