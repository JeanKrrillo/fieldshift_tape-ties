"""Recibe los datos del robot sin suponer cómo los manda: JSON en vivo, CSV o Excel. Cada columna numérica es una variable.
Guía para quien programa el robot: privado/contexto_space_apps_2026/contrato_datos_robot.md"""
import hashlib, io, json, math, re, secrets, sqlite3, threading, time
from urllib.parse import urlparse
from datetime import datetime, timedelta, timezone
from pathlib import Path
import requests
from fastapi import APIRouter, Header, HTTPException, Request
from backend import base

D = base.DATOS
DB, TOKEN, CONFIG = D / "robot.sqlite", D / "robot_token.txt", D / "robot_config.json"
MAX_FILAS, MAX_BYTES = 5000, 5_000_000
TIEMPO = ("t", "tiempo", "fecha", "timestamp", "hora", "time", "datetime")
LAT, LON, ROBOT = ("lat", "latitud", "latitude"), ("lon", "lng", "longitud", "longitude"), ("robot", "id_robot", "dispositivo")
router = APIRouter(prefix="/api/v1/robot")
_LOCK = threading.Lock()
_HOJA = {}  # resultado de la última sincronización con la hoja de Google
_SINC = threading.Lock()  # una sola sincronización a la vez
CADA = 60  # segundos entre lecturas automáticas de la hoja


def _db():
    con = sqlite3.connect(DB, timeout=60, check_same_thread=False)
    con.execute("CREATE TABLE IF NOT EXISTS lecturas (robot TEXT, t TEXT, variable TEXT, valor REAL, lat REAL, lon REAL, unidad TEXT, PRIMARY KEY (robot, t, variable))")
    return con


def _token():
    if not TOKEN.exists():
        TOKEN.write_text(secrets.token_urlsafe(24), encoding="utf-8")
    return TOKEN.read_text(encoding="utf-8").strip()


def _permiso(x_robot_token, request=None):
    """Entra quien tiene sesión iniciada (la interfaz) o quien manda el token del robot (envíos automáticos)."""
    from backend.cuenta import usuario_de
    if request is not None and usuario_de(request):
        return
    esperado = _token()  # lo crea la primera vez que alguien intenta enviar datos
    if not x_robot_token or not secrets.compare_digest(x_robot_token, esperado):
        raise HTTPException(401, "Falta o es incorrecto el encabezado X-Robot-Token")


def _hora(v, c=None):
    """ISO 8601, segundos o milisegundos desde 1970, o fecha de Excel → ISO en UTC. Sin hora: ahora."""
    if v in (None, ""):
        return datetime.now(timezone.utc).isoformat(timespec="seconds")
    if isinstance(v, (int, float)) or str(v).replace(".", "", 1).isdigit():
        x = float(v); x = x / 1000 if x > 1e11 else x
        return datetime.fromtimestamp(x, timezone.utc).isoformat(timespec="seconds")
    import pandas as pd
    c = c or config()
    d = pd.to_datetime(v, dayfirst=bool(c.get("dia_primero")))  # las hojas en español suelen escribir día/mes/año
    if pd.isna(d):
        raise ValueError(f"hora no entendida: {v}")
    if d.tzinfo is None:
        d = d.tz_localize(c.get("zona_horaria") or "UTC")  # sin zona: la de la config, o UTC
    return d.tz_convert("UTC").isoformat(timespec="seconds")


def _num(v):
    try:
        x = float(str(v).replace(",", ".")) if not isinstance(v, (int, float)) else float(v)
        return x if math.isfinite(x) else None
    except (TypeError, ValueError):
        return None


def _filas(registros, robot_por_defecto, omitidas=None, c=None):
    """Acepta filas largas ({t, variable, valor}) o anchas ({t, ph, humedad, ...}). Devuelve (filas, columnas ignoradas)."""
    out, ignoradas, c = [], set(), c or config()  # la configuración se lee una vez, no en cada fila
    for r in registros:
        k = {str(a).strip().lower(): v for a, v in r.items()}
        tk = next((a for a in TIEMPO if a in k), None)
        try:
            t = _hora(k.get(tk), c) if tk else _hora(None)
        except ValueError:
            if omitidas is None:
                raise
            omitidas.append(str(k.get(tk))); continue
        except Exception:  # pandas no entendió la hora
            if omitidas is None:
                raise ValueError(f"hora no entendida: {k.get(tk)}")
            omitidas.append(str(k.get(tk))); continue
        lat = next((_num(k[a]) for a in LAT if a in k), None); lon = next((_num(k[a]) for a in LON if a in k), None)
        if lat == 0 and lon == 0:
            lat = lon = None  # 0,0 es un GPS sin señal, no una posición
        robot = str(next((k[a] for a in ROBOT if k.get(a)), robot_por_defecto))
        if "variable" in k and "valor" in k:
            v = _num(k["valor"])
            if v is not None:
                out.append((robot, t, str(k["variable"]), v, lat, lon, k.get("unidad")))
            continue
        for a, v in k.items():
            if a in TIEMPO or a in LAT or a in LON or a in ROBOT or a == "unidad":
                continue
            x = _num(v)
            if x is None:
                if v not in (None, ""):
                    ignoradas.add(a)
                continue
            out.append((robot, t, a, x, lat, lon, None))
    return out, sorted(ignoradas)


def _guardar(filas):
    with _LOCK:
        con = _db(); con.executemany("INSERT OR REPLACE INTO lecturas VALUES (?,?,?,?,?,?,?)", filas); con.commit(); con.close()


@router.post("/lecturas")
async def recibir(request: Request, x_robot_token: str = Header(None)):
    """Datos en vivo. Cuerpo JSON: una fila, una lista de filas, o {"robot": "nombre", "lecturas": [...]}."""
    _permiso(x_robot_token, request)
    cuerpo = await request.json()
    robot = "robot"
    if isinstance(cuerpo, dict) and "lecturas" in cuerpo:
        robot = str(cuerpo.get("robot") or robot); cuerpo = cuerpo["lecturas"]
    if isinstance(cuerpo, dict):
        cuerpo = [cuerpo]
    if not isinstance(cuerpo, list) or not cuerpo or len(cuerpo) > MAX_FILAS:
        raise HTTPException(400, f"Se espera una lista de 1 a {MAX_FILAS} filas")
    try:
        filas, ign = _filas(cuerpo, robot)
    except ValueError as e:
        raise HTTPException(400, str(e))
    _guardar(filas)
    return {"estado": "OK", "guardadas": len(filas), "columnas_ignoradas": ign}


def _leer(raw):
    import pandas as pd
    try:
        if raw[:2] == b"PK":
            return pd.read_excel(io.BytesIO(raw))
        try:
            return pd.read_csv(io.BytesIO(raw), sep=None, engine="python", encoding="utf-8-sig")
        except UnicodeDecodeError:
            return pd.read_csv(io.BytesIO(raw), sep=None, engine="python", encoding="latin-1")
    except Exception as e:
        raise HTTPException(400, f"No pude leer el archivo: {e}")


def _ingestar(df, robot, exigir_hora=False):
    if len(df) > MAX_FILAS * 20:
        raise HTTPException(400, "Demasiadas filas; divide el archivo")
    if exigir_hora and not any(str(c).strip().lower() in TIEMPO for c in df.columns):
        raise HTTPException(400, "La hoja necesita una columna de hora (t, tiempo, fecha, timestamp...); sin ella cada sincronización duplicaría las lecturas")
    try:
        omitidas = []
        filas, ign = _filas(df.astype(object).where(df.notna(), None).to_dict("records"), robot, omitidas)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not filas:
        raise HTTPException(400, "No encontré columnas numéricas. Revisa los nombres de las columnas.")
    for i in range(0, len(filas), 5000):
        _guardar(filas[i:i + 5000])
    return {"estado": "OK", "guardadas": len(filas), "filas_leidas": len(df), "columnas": [str(c) for c in df.columns], "columnas_ignoradas": ign, "filas_omitidas": len(omitidas), "ejemplo_hora_omitida": omitidas[0] if omitidas else None}


@router.post("/importar")
async def importar(request: Request, robot: str = "robot", x_robot_token: str = Header(None)):
    """Archivo CSV o Excel (.xlsx) como cuerpo de la petición. Una fila por instante, una columna por variable."""
    _permiso(x_robot_token, request)
    raw = await request.body()
    if not raw or len(raw) > MAX_BYTES:
        raise HTTPException(400, f"Archivo vacío o mayor de {MAX_BYTES // 1_000_000} MB")
    return _ingestar(_leer(raw), robot)


def _csv_url(u):
    """Enlace de Google Sheets (de compartir o de publicar en la web) → enlace de descarga CSV. Solo docs.google.com."""
    m = urlparse((u or "").strip())
    if m.scheme != "https" or m.hostname != "docs.google.com":
        raise HTTPException(400, "Solo se aceptan enlaces de Google Sheets (https://docs.google.com/...)")
    if "/pub" in m.path:
        return u.strip() if "output=csv" in m.query else u.strip() + ("&" if m.query else "?") + "output=csv"
    i = re.search(r"/d/([\w-]+)", m.path)
    if not i:
        raise HTTPException(400, "No encontré el identificador de la hoja en el enlace")
    g = re.search(r"gid=(\d+)", u)
    return f"https://docs.google.com/spreadsheets/d/{i.group(1)}/export?format=csv&gid={g.group(1) if g else 0}"


def _bajar_hoja(u):
    try:
        r = requests.get(_csv_url(u), timeout=30, stream=True)
        raw = b"".join(r.iter_content(65536))[:MAX_BYTES + 1]
    except requests.RequestException as e:
        raise HTTPException(502, f"No pude llegar a Google: {e}")
    if r.status_code != 200 or raw[:1] == b"<":  # Google devuelve una página de inicio de sesión si la hoja es privada
        raise HTTPException(400, "No pude leer la hoja: compártela como 'Cualquier persona con el enlace' (lector) o publícala en la web como CSV")
    if len(raw) > MAX_BYTES:
        raise HTTPException(400, "La hoja pesa más de 5 MB")
    return raw


def _sincronizar(avance=None):
    avance = avance or base.Avance()
    c = config(); u = c.get("hoja_url")
    if not u:
        raise HTTPException(400, "No hay hoja conectada. Usa POST /api/v1/robot/hoja")
    if not _SINC.acquire(blocking=False):
        raise HTTPException(409, "Ya hay una sincronización en curso.")
    try:
        avance.paso(1, 3, "hoja_bajar")
        raw = _bajar_hoja(u)
        avance.paso(2, 3, "hoja_leer")
        df = _leer(raw)
        # Incremental: si la hoja es la misma y solo creció, se procesan nada más las filas nuevas
        huella = hashlib.sha1(repr([u] + ([str(x) for x in df.iloc[0].tolist()] if len(df) else [])).encode()).hexdigest()
        vistas = _HOJA.get("filas_hoja", 0) if _HOJA.get("huella") == huella and len(df) >= _HOJA.get("filas_hoja", 0) else 0
        nuevas = df.iloc[vistas:]
        avance.paso(3, 3, "hoja_guardar", len(nuevas))
        if len(nuevas):
            res = _ingestar(nuevas, c.get("robot") or "robot", exigir_hora=True)
        else:
            res = {"estado": "OK", "guardadas": 0, "filas_leidas": 0, "columnas": [str(x) for x in df.columns], "columnas_ignoradas": [], "filas_omitidas": 0, "ejemplo_hora_omitida": None}
        avance.suma(len(nuevas))
        res["ejemplo_hora_omitida"] = res["ejemplo_hora_omitida"] or (_HOJA.get("ejemplo_hora_omitida") if vistas else None)
        res.update(filas_hoja=len(df), filas_nuevas=len(nuevas), huella=huella, columnas=[str(x).strip() for x in df.columns],
                   filas_omitidas_total=res["filas_omitidas"] + (_HOJA.get("filas_omitidas_total", 0) if vistas else 0))
        return res
    finally:
        _SINC.release()


def sincronizar_con_avance(avance=None):
    """Lee la hoja y deja anotado cómo salió: cuándo, cuántas filas, cuántas se omitieron o qué falló."""
    try:
        res = _sincronizar(avance); _HOJA.update(res, error=None)
        return res
    except HTTPException as e:
        if e.status_code != 409:
            _HOJA["error"] = e.detail
        raise
    except Exception as e:
        _HOJA["error"] = str(e); raise
    finally:
        _HOJA["t"], _HOJA["reloj"] = base.ahora_iso(), time.time()


def _vigilar():
    while True:
        time.sleep(CADA)
        if config().get("hoja_url"):
            try:
                sincronizar_con_avance()
            except Exception:
                pass  # el motivo ya quedó en _HOJA["error"] y la interfaz lo muestra


threading.Thread(target=_vigilar, daemon=True).start()


# Límites que no dependen del sensor ni del lugar: salen de la definición de la unidad. Una lectura fuera de ellos es un error de medición o de unidad.
RANGOS_FISICOS = {"%": (0, 100, "un porcentaje va de 0 a 100, por definición"), "°C": (-273.15, None, "no hay temperatura por debajo del cero absoluto (−273.15 °C)"),
                  "K": (0, None, "no hay temperatura por debajo de 0 K"), "pH": (0, 14, "la escala usual de pH va de 0 a 14"), "m³/m³": (0, 1, "una fracción de volumen va de 0 a 1")}
SUGERENCIAS = (("temp", ["°C", "°F", "K"]), ("hum", ["%", "m³/m³"]), ("vel", ["m/s", "km/h", "cm/s"]), ("rot", ["°", "rad", "rpm", "°/s"]), ("ph", ["pH"]), ("bat", ["%", "V"]),
               ("ec", ["mS/cm", "dS/m", "µS/cm"]), ("cond", ["mS/cm", "dS/m", "µS/cm"]), ("pres", ["hPa", "kPa"]), ("lluv", ["mm"]), ("luz", ["lux"]))


def _dia_primero(valores):
    """True o False si las fechas lo dejan claro (un 13 o más en el día o en el mes); None si no aplica; "ambiguo" si todas sirven de las dos formas."""
    pares = [(int(m.group(1)), int(m.group(2))) for m in (re.match(r"\s*(\d{1,2})[/-](\d{1,2})[/-]\d{2,4}", str(v)) for v in valores) if m]
    if not pares:
        return None
    if any(a > 12 for a, _ in pares):
        return True
    if any(b > 12 for _, b in pares):
        return False
    return "ambiguo"


@router.post("/hoja/vista")
async def vista_hoja(request: Request, x_robot_token: str = Header(None)):
    """Vista previa de una hoja sin guardar nada: cómo se entendió cada columna, las primeras filas y cuántas filas no sirven y por qué.
    Cuerpo: {"url": "...", "zona_horaria": "...", "dia_primero": true|false|null}."""
    _permiso(x_robot_token, request)
    d = await request.json()
    df = _leer(_bajar_hoja(d.get("url")))
    if len(df) > MAX_FILAS * 20:
        raise HTTPException(400, "Demasiadas filas; divide la hoja")
    reg = df.astype(object).where(df.notna(), None).to_dict("records")
    cols = []
    for col in df.columns:
        k = str(col).strip().lower(); vals = [r[col] for r in reg if r[col] not in (None, "")]
        papel = "hora" if k in TIEMPO else "latitud" if k in LAT else "longitud" if k in LON else "robot" if k in ROBOT else None
        if papel is None:
            nums = sum(_num(v) is not None for v in vals)
            papel = "variable" if vals and nums >= len(vals) / 2 else "texto"
        cols.append({"columna": str(col), "clave": k, "papel": papel, "ejemplo": None if not vals else str(vals[0])[:40], "con_dato": len(vals),
                     "unidades_sugeridas": next((u for pista, u in SUGERENCIAS if pista in k), []) if papel == "variable" else []})
    hora = next((c for c in cols if c["papel"] == "hora"), None)
    detectado = _dia_primero([r[hora["columna"]] for r in reg[:2000]]) if hora else None
    dp = d.get("dia_primero") if isinstance(d.get("dia_primero"), bool) else (detectado is True)
    omitidas = []
    filas, ign = _filas(reg, "robot", omitidas, {"dia_primero": dp, "zona_horaria": str(d.get("zona_horaria") or "UTC")}) if hora else ([], [])
    sin_gps = sum(1 for r in reg if any(str(a).strip().lower() in LAT for a in r) and next((_num(r[a]) for a in r if str(a).strip().lower() in LAT), None) == 0
                  and next((_num(r[a]) for a in r if str(a).strip().lower() in LON), None) == 0)
    return {"estado": "OK", "columnas": cols, "filas": [[("" if r[c] is None else str(r[c])[:40]) for c in df.columns] for r in reg[:8]], "total_filas": len(df),
            "tiene_hora": bool(hora), "dia_primero_detectado": detectado, "dia_primero_usado": dp, "filas_sin_hora_valida": len(omitidas), "ejemplo_hora_no_entendida": omitidas[0] if omitidas else None,
            "filas_sin_gps": sin_gps, "lecturas_validas": len(filas), "primera_hora": min((f[1] for f in filas), default=None), "ultima_hora": max((f[1] for f in filas), default=None),
            "variables_actuales": config().get("variables", {})}


@router.post("/hoja")
async def conectar_hoja(request: Request, x_robot_token: str = Header(None)):
    """Conecta una hoja de Google: {"url": "...", "robot": "nombre", "zona_horaria": "America/Mexico_City", "dia_primero": true}. Se lee ahora y luego cada minuto."""
    _permiso(x_robot_token, request)
    d = await request.json(); _csv_url(d.get("url"))
    c = config(); c.update({"hoja_url": d["url"].strip(), "robot": str(d.get("robot") or "robot")})
    for k in ("zona_horaria", "dia_primero"):
        if k in d:
            c[k] = d[k]
    CONFIG.write_text(json.dumps(c, ensure_ascii=False, indent=1), encoding="utf-8")
    _HOJA.clear()  # hoja nueva: se lee entera
    return sincronizar_con_avance()


@router.post("/sincronizar")
def sincronizar_ahora(request: Request, x_robot_token: str = Header(None)):
    _permiso(x_robot_token, request)
    return sincronizar_con_avance()


@router.get("/config")
def config():
    return json.loads(CONFIG.read_text(encoding="utf-8")) if CONFIG.exists() else {"variables": {}}


@router.put("/config")
async def poner_config(request: Request, x_robot_token: str = Header(None)):
    """Descripción opcional de las variables: {"variables": {"ph": {"nombre": "pH", "unidad": "", "min": 5.5, "max": 7.5}}}."""
    _permiso(x_robot_token, request)
    d = await request.json()
    if not isinstance(d, dict) or not isinstance(d.get("variables"), dict) or len(d["variables"]) > 60:
        raise HTTPException(400, 'Se espera {"variables": {...}}')
    limpio = {}
    for k, v in d["variables"].items():
        if not isinstance(v, dict):
            raise HTTPException(400, f"Descripción no válida para {k}")
        x = {"nombre": str(v.get("nombre") or "")[:60], "unidad": str(v.get("unidad") or "")[:20]}
        for lim in ("min", "max"):
            if v.get(lim) not in (None, ""):
                n = _num(v[lim])
                if n is None:
                    raise HTTPException(400, f"El {lim} de {k} no es un número")
                x[lim] = n
        if v.get("origen"):
            x["origen"] = str(v["origen"])[:80]
        limpio[str(k).strip().lower()[:60]] = x
    c = config(); c["variables"] = limpio  # la hoja conectada y su zona horaria se conservan
    CONFIG.write_text(json.dumps(c, ensure_ascii=False, indent=1), encoding="utf-8")
    return {"estado": "OK", "variables": limpio}


@router.get("/estado")
def estado():
    con = _db(); n, ult = con.execute("SELECT COUNT(*), MAX(t) FROM lecturas").fetchone()
    robots = [r[0] for r in con.execute("SELECT DISTINCT robot FROM lecturas")]
    con.close()
    vivo = bool(ult) and datetime.now(timezone.utc) - datetime.fromisoformat(ult) < timedelta(minutes=5)
    ts = [datetime.fromisoformat(r[0]) for r in _db().execute("SELECT DISTINCT t FROM lecturas ORDER BY t DESC LIMIT 2000")]
    saltos = sorted(((ts[i] - ts[i + 1]).total_seconds(), ts[i + 1].isoformat()) for i in range(len(ts) - 1))
    ritmo = {"cada_s_mediana": saltos[len(saltos) // 2][0], "hueco_mayor_s": saltos[-1][0], "hueco_mayor_desde": saltos[-1][1], "instantes": len(ts)} if saltos else None
    return {"estado": "OK", "lecturas": n, "ultima_lectura": ult, "robots": robots, "conectado": vivo, "criterio_conectado": "una lectura en los últimos 5 minutos", "ritmo": ritmo,
            "hoja": {"conectada": bool(config().get("hoja_url")), "ultima_sincronizacion": _HOJA.get("t"), "guardadas": _HOJA.get("guardadas"), "error": _HOJA.get("error"),
                     "cada_s": CADA, "proxima_en_s": max(0, round(CADA - (time.time() - _HOJA["reloj"]))) if _HOJA.get("reloj") else None,
                     "filas_hoja": _HOJA.get("filas_hoja"), "filas_nuevas": _HOJA.get("filas_nuevas"), "filas_omitidas": _HOJA.get("filas_omitidas_total"), "ejemplo_hora_omitida": _HOJA.get("ejemplo_hora_omitida"), "columnas": _HOJA.get("columnas")}}


@router.get("/ultimas")
def ultimas(robot: str = None):
    """Última lectura de cada variable, con su hora y la descripción de config si existe."""
    con = _db(); cfg = config().get("variables", {})
    q = "SELECT variable, valor, MAX(t), lat, lon, robot FROM lecturas" + (" WHERE robot=?" if robot else "") + " GROUP BY variable ORDER BY variable"
    filas = con.execute(q, (robot,) if robot else ()).fetchall()
    out = []
    for v, x, t, la, lo, r in filas:
        d = {"variable": v, "valor": x, "t": t, "lat": la, "lon": lo, "robot": r, **cfg.get(v, {})}
        fis = RANGOS_FISICOS.get(d.get("unidad"))
        if fis:
            a, b, por = fis
            d["rango_fisico"] = {"min": a, "max": b, "porque": por}
            d["fuera_de_rango_fisico"], d["total_lecturas"] = con.execute("SELECT SUM(valor < ? OR valor > ?), COUNT(*) FROM lecturas WHERE variable=?", (-1e308 if a is None else a, 1e308 if b is None else b, v)).fetchone()
        out.append(d)
    con.close()
    return {"estado": "OK", "variables": out}


@router.get("/lecturas")
def lecturas(variable: str = None, robot: str = None, desde: str = None, limite: int = 2000):
    con = _db(); c, p = [], []
    for col, v in (("variable", variable), ("robot", robot)):
        if v:
            c.append(f"{col}=?"); p.append(v)
    if desde:
        c.append("t>=?"); p.append(desde)
    filas = con.execute("SELECT t, variable, valor, lat, lon, robot FROM lecturas" + (" WHERE " + " AND ".join(c) if c else "") + " ORDER BY t DESC LIMIT ?", p + [min(limite, 20000)]).fetchall(); con.close()
    return {"estado": "OK", "lecturas": [dict(zip(("t", "variable", "valor", "lat", "lon", "robot"), f)) for f in filas]}
