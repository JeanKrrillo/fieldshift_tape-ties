"""
Servidor Central FastAPI — Field Shift: Adapting Farms with NASA Data (2026)
----------------------------------------------------------------------------
Une en paralelo todas las APIs oficiales en vivo (0% datos falsos) y entrega:
1. Datos crudos reales de NASA POWER v10, USDA SSURGO, USGS Water Services,
   Microsoft Planetary Computer STAC y NASA Earthdata CMR (SMAP, ECOSTRESS, GEDI, HLS).
2. Reglas agronómicas reales para los 3 Horizontes de Tiempo (Hoy, Temporada, 5-10 Años).
3. Las 3 Estrategias de Rotación adaptadas al suelo y agua reales de la parcela.

Ejecutar servidor:
  python -m uvicorn backend.main:app --reload --port 8000   (desde la carpeta publico)
"""

import os
import threading
from datetime import date
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from backend import base, trabajos
from backend.catalogo import construir_catalogo, estaciones_usgs
from backend.rejilla import ndvi_terreno
from backend.real_connectors import (
    fetch_nasa_power_real,
    fetch_usda_ssurgo_real,
    fetch_usgs_water_real,
    fetch_planetary_computer_stac_real,
    fetch_nasa_earthdata_cmr_real,
    fetch_landfire_pixel_real,
    fetch_openet_point_real,
    fetch_usda_ams_market_news_real,
    fetch_meteomatics_weather_real,
    verificar_estado_tokens_env,
    geocodificar_google,
)



def _seguro(fn, *args):
    """Una fuente caída no tumba las demás: devuelve el error en su lugar."""
    try:
        return fn(*args)
    except Exception as e:
        return {"estado": "ERROR", "fuente": fn.__name__, "detalle": f"{type(e).__name__}: {e}"[:300]}

app = FastAPI(
    title="Field Shift: Adapting Farms with NASA Data — Live API Engine",
    version="1.0.0",
    description="Motor de interconexión satelital y agronómica 100% conectado a APIs oficiales en vivo."
)

# Sin CORS: la interfaz se sirve desde este mismo servidor, así que ningún otro sitio puede usar la sesión.
app.add_middleware(GZipMiddleware, minimum_size=1024)


def calcular_decisiones_agronomicas_reales(clima: dict, suelo: dict, agua: dict) -> dict:
    """
    Reglas sobre los datos recién descargados. Si una fuente no trae un dato (por ejemplo SSURGO fuera de
    EE. UU.), el campo queda en None y el texto dice "sin dato": nunca se rellena con un valor supuesto.
    """
    resumen_clima = clima.get("resumen_anual", {})
    humedad_raiz_pct = resumen_clima.get("humedad_zona_radicular_media_pct")
    lluvia_anual_mm = resumen_clima.get("precipitacion_anual_mm")
    temp_max_c = resumen_clima.get("temp_max_mes_mas_calido_c")

    horizontes = suelo.get("horizontes_verticales_0_150cm", [])
    primer_horizonte = horizontes[0] if horizontes else {}
    materia_organica = primer_horizonte.get("materia_organica_pct")
    ph_suelo = primer_horizonte.get("ph")
    factor_k = primer_horizonte.get("factor_k_erosion")
    agua_disp_mm = suelo.get("agua_disponible_0_100cm_mm")
    serie = suelo.get("serie_dominante")

    def hechos(*pares):  # arma la frase solo con los datos que sí llegaron
        return ", ".join(txt.format(v) for v, txt in pares if v is not None)

    # Umbrales 35 % y 78 %: regla del equipo, no una medición.
    if humedad_raiz_pct is None:
        semaforo_hoy = "SIN_DATO"
        accion_hoy = "Sin dato de humedad en zona de raíz para esta parcela."
    elif humedad_raiz_pct < 35.0:
        semaforo_hoy = "ROJO"
        accion_hoy = (
            f"Alerta de déficit hídrico en raíz ({humedad_raiz_pct:.1f}% según NASA POWER). "
            f"Aplicar riego de auxilio en las próximas 24-48 h para proteger el cultivo."
        )
    elif humedad_raiz_pct > 78.0:
        semaforo_hoy = "AMARILLO"
        accion_hoy = (
            f"Suelo con alta saturación ({humedad_raiz_pct:.1f}%). Evitar paso de maquinaria pesada "
            f"y posponer fertilización nitrogenada para evitar lixiviación hacia ríos cercanos."
        )
    else:
        semaforo_hoy = "VERDE"
        accion_hoy = f"Humedad en zona de raíz dentro del rango normal ({humedad_raiz_pct:.1f}%)."

    sin_datos = "Sin datos suficientes de esta parcela para justificar esta secuencia."
    just_a = hechos((agua_disp_mm, "{:.1f} mm de agua útil en el suelo"), (ph_suelo, "pH {}"),
                    (lluvia_anual_mm, "{:.0f} mm/año de lluvia"))
    just_b = hechos((temp_max_c, "máximo mensual de {:.1f} °C reportado por NASA POWER"))
    just_c = hechos((materia_organica, "materia orgánica de {}%"), (factor_k, "factor de erodabilidad K={}"))

    return {
        "horizonte_1_hoy_7_dias": {
            "semaforo": semaforo_hoy,
            "humedad_zona_radicular_pct": humedad_raiz_pct,
            "agua_disponible_perfil_mm": agua_disp_mm,
            "sensores_usgs_en_vivo": agua.get("total_lecturas_activas_en_radio"),
            "recomendacion_natural": accion_hoy
        },
        "horizonte_2_esta_temporada": {
            "serie_suelo_detectada": serie,
            "ph_superficial_real": ph_suelo,
            "materia_organica_real_pct": materia_organica,
            "estrategias_rotacion": [
                {
                    "camino": "Camino A — Máxima Rentabilidad",
                    "secuencia": "Maíz / Soja -> Cultivo de Cobertura Invernal (Centeno) -> Leguminosa de Grano",
                    "justificacion_datos_reales": f"Datos de la parcela: {just_a}." if just_a else sin_datos
                },
                {
                    "camino": "Camino B — Máximo Ahorro de Agua",
                    "secuencia": "Sorgo Tolerante a Sequía -> Garbanzo / Lenteja -> Barbecho con Rastrojo",
                    "justificacion_datos_reales": f"Datos de la parcela: {just_b}." if just_b else sin_datos
                },
                {
                    "camino": "Camino C — Regeneración de Suelo y Control de Erosión",
                    "secuencia": "Trébol Encarnado + Avena -> Soja en Siembra Directa -> Alfalfa Perenne",
                    "justificacion_datos_reales": f"Datos de la parcela: {just_c}." if just_c else sin_datos
                }
            ]
        },
        "horizonte_3_largo_plazo_5_10_anos": {
            "precipitacion_media_anual_mm": lluvia_anual_mm,
            "pico_termico_historico_c": temp_max_c,
            "drenaje_del_suelo": suelo.get("drenaje"),
        }
    }


@app.on_event("startup")
def precalentar():
    """En segundo plano: el catálogo y el modelo de cultivos quedan listos sin frenar el arranque. No se consulta ninguna parcela que nadie pidió."""
    def trabajo():
        construir_catalogo()
        from backend.cultivos_ia import MODELO, _modelo
        if MODELO.exists():
            _modelo()
    threading.Thread(target=trabajo, daemon=True).start()


_GEO_CACHE: dict = {}
_GEO_USO = {"dia": None, "n": 0}
_GEO_MAX_DIARIO = int(os.getenv("GEOCODE_MAX_DIARIO", "50"))  # tope duro para no pasar de la cuota gratis de Google


@app.get("/api/v1/geocode")
def buscar_lugar(q: str = Query(..., min_length=2, max_length=100, description="Pueblo, rancho o dirección")):
    clave = " ".join(q.lower().split())
    if clave in _GEO_CACHE:  # búsqueda repetida: no se llama a Google
        return _GEO_CACHE[clave]
    hoy = date.today()
    if _GEO_USO["dia"] != hoy:
        _GEO_USO.update(dia=hoy, n=0)
    if _GEO_USO["n"] >= _GEO_MAX_DIARIO:
        return {"estado": "LIMITE_DIARIO", "detalle": f"Se alcanzó el tope de {_GEO_MAX_DIARIO} búsquedas nuevas hoy. Haz clic en el mapa."}
    _GEO_USO["n"] += 1
    r = _seguro(geocodificar_google, q)
    if "lat" in r:
        _GEO_CACHE[clave] = r
    return r


@app.get("/api/v1/catalogo")
def catalogo():
    """Todo lo que ofrecen las fuentes, leído en vivo de sus catálogos oficiales."""
    return construir_catalogo()


def _poligono(poly):
    """«lon,lat;lon,lat;…» → lista de puntos, o None si no es un polígono válido."""
    try:
        pts = [tuple(float(v) for v in p.split(",")) for p in str(poly)[:2000].split(";")]
        assert len(pts) >= 3 and all(len(p) == 2 and -180 <= p[0] <= 180 and -90 <= p[1] <= 90 for p in pts)
        return pts
    except Exception:
        return None


@app.post("/api/v1/trabajos")
async def crear_trabajo(request: Request):
    """Arranca un análisis largo y devuelve su identificador. El avance se pregunta en GET /api/v1/trabajos/{id}.
    Cuerpo: {"tipo": "terreno" | "cultivos_ia" | "parcela" | "hoja", ...los mismos datos que la ruta directa}."""
    from backend.cuenta import usuario_de
    d = await request.json(); u = usuario_de(request)["id"]; tipo = d.get("tipo")
    try:
        if tipo in ("terreno", "cultivos_ia"):
            pts = _poligono(d.get("poly"))
            if not pts:
                raise ValueError("Polígono inválido")
            from backend.rejilla import area_ha
            lado = d.get("lado"); lado = None if lado in (None, "") else min(500, max(5, int(lado)))
            if tipo == "terreno":
                n = min(2500 if lado else 64, max(4, int(d.get("celdas") or 36)))
                fn = lambda av: ndvi_terreno(pts, n, lado, av)
            else:
                from backend.cultivos_ia import predecir
                n = min(64, max(4, int(d.get("celdas") or 25)))
                fn = lambda av: predecir(pts, n, None, av)
            tam = n if tipo == "cultivos_ia" else round(area_ha(pts))
        elif tipo == "parcela":
            lat, lon = float(d["lat"]), float(d["lon"])
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                raise ValueError("Coordenadas fuera de rango")
            fn, tam = (lambda av: obtener_inteligencia_parcela(lat, lon, av)), len(FUENTES)
        elif tipo == "hoja":
            from backend.robot_datos import sincronizar_con_avance
            fn, tam = sincronizar_con_avance, 0
        else:
            raise ValueError("Tipo de análisis desconocido")
    except (KeyError, TypeError, ValueError) as e:
        raise HTTPException(400, str(e))
    return {"estado": "OK", "trabajo": trabajos.lanzar(u, tipo, tam, fn)}


@app.get("/api/v1/terreno")
def terreno(poly: str = Query(..., max_length=2000, description="lon,lat;lon,lat;… (mínimo 3 vértices)"), celdas: int = Query(36, ge=4, le=2500), lado: int = Query(None, ge=5, le=500)):
    """Mide el terreno dibujado y devuelve el NDVI real de cada celda de la cuadrícula."""
    pts = _poligono(poly)
    if not pts:
        return {"estado": "ERROR", "detalle": "Polígono inválido: usa lon,lat;lon,lat;… con al menos 3 vértices"}
    if lado is None:
        celdas = min(celdas, 64)  # sin lado fijo se mantiene el tope anterior
    return _seguro(ndvi_terreno, pts, celdas, lado)


@app.get("/api/v1/cultivos-ia")
def cultivos_ia(poly: str = Query(..., max_length=2000), celdas: int = Query(25, ge=4, le=64)):
    """Modelo de IA: qué cultivo hubo en cada celda del terreno la última temporada completa (Sentinel-2)."""
    from backend.cultivos_ia import predecir
    pts = _poligono(poly)
    if not pts:
        return {"estado": "ERROR", "detalle": "Polígono inválido"}
    return _seguro(predecir, pts, celdas)


@app.get("/api/v1/recoleccion")
def recoleccion():
    """Qué hay recolectado en las bases locales y cómo va cada fuente."""
    import sqlite3
    from backend.recolector_capas import DBC
    from backend.ia_cultivos import DB
    out = {"tablas": [], "fuentes": [], "clases_cultivo": []}
    if DB.exists():
        c = sqlite3.connect(f"file:{DB}?mode=ro", uri=True, timeout=5)
        for (t,) in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall():
            out["tablas"].append({"base": DB.name, "tabla": t, "filas": c.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]})
        if any(t["tabla"] == "ia_cultivos" for t in out["tablas"]):
            out["clases_cultivo"] = [{"clase": a, "n": b} for a, b in c.execute("SELECT clase, COUNT(*) FROM ia_cultivos GROUP BY 1 ORDER BY 2 DESC")]
        c.close()
    if DBC.exists():
        c = sqlite3.connect(f"file:{DBC}?mode=ro", uri=True, timeout=5)
        out["fuentes"] = [dict(zip(("fuente", "total", "hechas", "errores", "estado", "actualizado"), r)) for r in c.execute("SELECT * FROM recoleccion_estado")]
        for t, in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall():
            out["tablas"].append({"base": DBC.name, "tabla": t, "filas": c.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]})
        out["variables"] = [{"fuente": a, "variable": b, "n": n, "min": lo, "max": hi} for a, b, n, lo, hi in c.execute("SELECT fuente, variable, COUNT(valor), MIN(valor), MAX(valor) FROM capas_muestras GROUP BY 1,2")]
        c.close()
    from backend.ia_multianio import DBM
    if DBM.exists():
        c = sqlite3.connect(f"file:{DBM}?mode=ro", uri=True, timeout=5)
        out["fuentes"] += [dict(zip(("fuente", "total", "hechas", "errores", "estado", "actualizado"), r)) for r in c.execute("SELECT * FROM estado ORDER BY fuente")]
        for (t,) in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall():
            out["tablas"].append({"base": DBM.name, "tabla": t, "filas": c.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]})
        c.close()
    return out


@app.get("/api/v1/usgs-estaciones")
def usgs_estaciones(oeste: float = Query(..., ge=-180, le=180), sur: float = Query(..., ge=-90, le=90),
                    este: float = Query(..., ge=-180, le=180), norte: float = Query(..., ge=-90, le=90)):
    if (este - oeste) > 3 or (norte - sur) > 3:  # un cuadro grande devolvería miles de estaciones
        return {"estado": "ZOOM", "estaciones": []}
    return {"estado": "OK", "estaciones": _seguro(estaciones_usgs, oeste, sur, este, norte)}


@app.get("/api/v1/status-tokens")
def obtener_estado_tokens():
    """Verifica qué llaves gratuitas opcionales ya están activas en backend/.env."""
    return verificar_estado_tokens_env()


def openet_ultima_temporada(lat, lon):
    """Consumo de agua de la última temporada completa (abril a octubre). Desde noviembre es la de este año; antes, la del año pasado."""
    hoy = date.today(); a = hoy.year if hoy.month >= 11 else hoy.year - 1
    return fetch_openet_point_real(lat, lon, f"{a}-04-01", f"{a}-10-31")


# Cada fuente guarda su respuesta en la caché de disco el tiempo que tarda en cambiar. Una fuente caída no impide guardar las demás.
H, DIA = 3600, 86400
FUENTES = [("nasa_power_v10", fetch_nasa_power_real, DIA), ("usda_nrcs_ssurgo", fetch_usda_ssurgo_real, 30 * DIA), ("usgs_water_services_nwis", fetch_usgs_water_real, 900),
           ("microsoft_planetary_computer_stac", fetch_planetary_computer_stac_real, 6 * H), ("nasa_earthdata_cmr_pasadas", fetch_nasa_earthdata_cmr_real, 6 * H),
           ("usfs_landfire_vegetacion", fetch_landfire_pixel_real, 30 * DIA), ("meteomatics_weather_1km", fetch_meteomatics_weather_real, H),
           ("openet_api", openet_ultima_temporada, 30 * DIA), ("usda_ams_market_news", fetch_usda_ams_market_news_real, 6 * H)]


@app.get("/api/v1/parcel-intelligence")
def inteligencia_parcela(lat: float = Query(..., ge=-90, le=90, description="Latitud de la parcela"), lon: float = Query(..., ge=-180, le=180, description="Longitud de la parcela")):
    return obtener_inteligencia_parcela(lat, lon)


def obtener_inteligencia_parcela(lat: float, lon: float, avance=None):
    """
    Consulta en paralelo todas las APIs científicas reales (NASA, USDA, USGS, Planetary Computer)
    para una coordenada agrícola y devuelve tanto los datos satelitales crudos como las
    decisiones explicadas en lenguaje natural.
    """
    avance = avance or base.Avance()
    clave = [round(lat, 3), round(lon, 3)]  # ~110 m: misma parcela, misma respuesta
    avance.paso(1, 2, "par_fuentes", len(FUENTES))

    def una(f):
        v = base.recordar(f[0], clave, f[2], lambda: _seguro(f[1], lat, lon)); avance.suma()
        return f[0], v

    with ThreadPoolExecutor(max_workers=len(FUENTES)) as ex:
        tele = dict(ex.map(una, FUENTES))
    avance.paso(2, 2, "par_reglas")
    clima, suelo, agua = tele["nasa_power_v10"], tele["usda_nrcs_ssurgo"], tele["usgs_water_services_nwis"]
    decisiones = calcular_decisiones_agronomicas_reales(clima, suelo, agua)

    respuesta = {
        "coordenadas_parcela": {"lat": lat, "lon": lon},
        "garantia_datos": "Datos medidos por fuentes oficiales en vivo. Los umbrales del semáforo y las secuencias de rotación son reglas del equipo, no mediciones. Lo que una fuente no trae queda en null.",
        "estado_tokens_opcionales": verificar_estado_tokens_env(),
        "decisiones_3_horizontes": decisiones,
        "telemetria_oficial_en_vivo": tele,
    }
    return respuesta


# La interfaz va al final para que no tape las rutas /api.
from backend.b_rutas import router as b_router  # rutas de la cápsula B (clima de 40 años, campos de OSM, fichas de modelos)
app.include_router(b_router)
from backend.robot_datos import router as robot_router  # recibe los datos del robot (JSON, CSV o Excel)
app.include_router(robot_router)
from backend.cuenta import router as cuenta_router, exigir_sesion  # cuentas, terrenos, alertas y recomendaciones; todo /api/v1 pide sesión
app.include_router(cuenta_router)
app.include_router(trabajos.router)
from backend.capas import router as capas_router  # preguntas con capas comprobadas y series del terreno
app.include_router(capas_router)
from backend.si import router as si_router  # SI de campo: respuestas ancladas a los datos del terreno
app.include_router(si_router)
app.middleware("http")(exigir_sesion)

_WEB = Path(__file__).resolve().parents[1] / "frontend"


@app.get("/")
@app.get("/index.html")
def pagina():
    """La página marca cada script y estilo con la huella de su contenido: si un archivo cambia, cambia su dirección
    y el navegador lo baja de nuevo; si no cambia, lo usa de su caché sin preguntar."""
    import hashlib, re
    from fastapi.responses import HTMLResponse

    def marca(m):
        f = _WEB / m.group(2)
        return f'{m.group(1)}="{m.group(2)}?v={hashlib.sha1(f.read_bytes()).hexdigest()[:10] if f.is_file() else 0}"'

    html = re.sub(r'(src|href)="([\w./-]+\.(?:js|css))\?v=[^"]*"', marca, (_WEB / "index.html").read_text(encoding="utf-8"))
    return HTMLResponse(html, headers={"Cache-Control": "no-cache"})


@app.middleware("http")
async def cache_de_estaticos(request: Request, call_next):
    r = await call_next(request)
    if r.status_code == 200 and request.url.path.endswith((".js", ".css")) and "v" in request.query_params:
        r.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return r


app.mount("/", StaticFiles(directory=_WEB, html=True), name="web")
