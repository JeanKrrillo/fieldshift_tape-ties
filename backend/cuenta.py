"""Cuentas, terrenos, alertas y recomendaciones reales. Todo sale de la base o de los datos medidos; nada de ejemplo.
Contraseñas con scrypt (librería estándar), sesión en cookie HttpOnly. Restablecer una contraseña: python -m backend.cuenta restablecer correo@x.com"""
import hashlib, json, re, secrets, sqlite3, sys, threading, time
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from backend import base

DB = base.DATOS / "cuentas.sqlite"
COOKIE, VIDA = "fs_sesion", 7 * 24 * 3600
router = APIRouter(prefix="/api/v1")
_LOCK, _INTENTOS = threading.Lock(), {}


def _db():
    con = sqlite3.connect(DB, timeout=60, check_same_thread=False)
    con.executescript("""
    CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY, correo TEXT UNIQUE, nombre TEXT, sal BLOB, clave BLOB, creado TEXT);
    CREATE TABLE IF NOT EXISTS sesiones (huella TEXT PRIMARY KEY, usuario INTEGER, expira REAL);
    CREATE TABLE IF NOT EXISTS terrenos (id INTEGER PRIMARY KEY, usuario INTEGER, nombre TEXT, poligono TEXT, lat REAL, lon REAL, localidad TEXT, pais TEXT, cultivo_actual TEXT, cultivo_anterior TEXT, hectareas REAL, creado TEXT);
    CREATE TABLE IF NOT EXISTS umbrales (usuario INTEGER, variable TEXT, minimo REAL, maximo REAL, PRIMARY KEY (usuario, variable));
    CREATE TABLE IF NOT EXISTS leidas (usuario INTEGER, alerta TEXT, PRIMARY KEY (usuario, alerta));""")
    return con


def _clave(contrasena, sal):
    return hashlib.scrypt(contrasena.encode(), salt=sal, n=2 ** 14, r=8, p=1, dklen=32)


def _err(codigo, detalle):
    return JSONResponse({"estado": "ERROR", "detalle": detalle}, status_code=codigo)


def usuario_de(request):
    """Usuario de la sesión (cookie) o None."""
    t = request.cookies.get(COOKIE)
    if not t:
        return None
    con = _db()
    f = con.execute("SELECT u.id, u.nombre, u.correo FROM sesiones s JOIN usuarios u ON u.id = s.usuario WHERE s.huella=? AND s.expira>?", (hashlib.sha256(t.encode()).hexdigest(), time.time())).fetchone()
    con.close()
    return {"id": f[0], "nombre": f[1], "correo": f[2]} if f else None


def _abrir_sesion(con, uid, resp):
    t = secrets.token_urlsafe(32)
    con.execute("INSERT INTO sesiones VALUES (?,?,?)", (hashlib.sha256(t.encode()).hexdigest(), uid, time.time() + VIDA)); con.commit()
    resp.set_cookie(COOKIE, t, max_age=VIDA, httponly=True, samesite="lax", path="/")


async def exigir_sesion(request: Request, call_next):
    """Todo /api/v1 pide sesión salvo la cuenta y el envío del robot con su token (así también se cuidan las cuotas de las fuentes externas)."""
    p = request.url.path
    libre = p.startswith("/api/v1/cuenta/") or (request.method == "POST" and p.startswith("/api/v1/robot/") and request.headers.get("x-robot-token"))
    if p.startswith("/api/v1/") and not libre and usuario_de(request) is None:
        return _err(401, "Inicia sesión para continuar.")
    return await call_next(request)


@router.post("/cuenta/crear")
async def crear(request: Request):
    d = await request.json()
    correo, clave, nombre = str(d.get("correo", "")).strip().lower(), str(d.get("contrasena", "")), str(d.get("nombre", "")).strip()[:80]
    if not re.fullmatch(r"[^@\s]{1,64}@[^@\s]+\.[^@\s]+", correo) or len(correo) > 120:
        return _err(400, "Escribe un correo válido.")
    if len(clave) < 8:
        return _err(400, "La contraseña debe tener al menos 8 caracteres.")
    sal = secrets.token_bytes(16)
    with _LOCK:
        con = _db()
        if con.execute("SELECT 1 FROM usuarios WHERE correo=?", (correo,)).fetchone():
            con.close(); return _err(409, "Ese correo ya tiene una cuenta. Inicia sesión.")
        uid = con.execute("INSERT INTO usuarios (correo, nombre, sal, clave, creado) VALUES (?,?,?,?,?)", (correo, nombre or correo.split("@")[0], sal, _clave(clave, sal), datetime.now(timezone.utc).isoformat(timespec="seconds"))).lastrowid
        resp = JSONResponse({"estado": "OK", "usuario": {"id": uid, "nombre": nombre or correo.split("@")[0], "correo": correo}}); _abrir_sesion(con, uid, resp); con.close()
    return resp


@router.post("/cuenta/entrar")
async def entrar(request: Request):
    d = await request.json(); correo, clave = str(d.get("correo", "")).strip().lower(), str(d.get("contrasena", ""))
    k = (request.client.host if request.client else "?", correo); ahora = time.time()
    _INTENTOS[k] = [t for t in _INTENTOS.get(k, []) if ahora - t < 900]
    if len(_INTENTOS[k]) >= 5:
        return _err(429, "Demasiados intentos. Espera unos minutos.")
    con = _db(); f = con.execute("SELECT id, nombre, sal, clave FROM usuarios WHERE correo=?", (correo,)).fetchone()
    ok = secrets.compare_digest(_clave(clave, f[2] if f else b"0" * 16), f[3] if f else b"0" * 32) and f is not None  # mismo trabajo exista o no el correo
    if not ok:
        _INTENTOS[k].append(ahora); con.close(); return _err(401, "Correo o contraseña incorrectos")
    _INTENTOS.pop(k, None)
    resp = JSONResponse({"estado": "OK", "usuario": {"id": f[0], "nombre": f[1], "correo": correo}}); _abrir_sesion(con, f[0], resp); con.close()
    return resp


@router.post("/cuenta/salir")
def salir(request: Request):
    t = request.cookies.get(COOKIE)
    if t:
        con = _db(); con.execute("DELETE FROM sesiones WHERE huella=?", (hashlib.sha256(t.encode()).hexdigest(),)); con.commit(); con.close()
    resp = JSONResponse({"estado": "OK"}); resp.delete_cookie(COOKIE, path="/")
    return resp


@router.post("/cuenta/recuperar")
async def recuperar(request: Request):
    return _err(501, "La recuperación por correo aún no está configurada. Pide al administrador que restablezca tu contraseña.")


@router.get("/cuenta/yo")
def yo(request: Request):
    u = usuario_de(request)
    return {"estado": "OK", "usuario": u} if u else _err(401, "Sin sesión")


# ---------- terrenos ----------
def _terreno(f):
    return {"id": f[0], "nombre": f[1], "poligono": json.loads(f[2]) if f[2] else None, "lat": f[3], "lon": f[4], "localidad": f[5], "pais": f[6], "cultivo_actual": f[7], "cultivo_anterior": f[8], "hectareas": f[9]}


_COLS = "id, nombre, poligono, lat, lon, localidad, pais, cultivo_actual, cultivo_anterior, hectareas"


@router.get("/terrenos")
def terrenos(request: Request):
    con = _db(); out = [_terreno(f) for f in con.execute(f"SELECT {_COLS} FROM terrenos WHERE usuario=? ORDER BY id DESC", (usuario_de(request)["id"],))]; con.close()
    return out


@router.post("/terrenos")
async def guardar_terreno(request: Request):
    d = await request.json(); u = usuario_de(request)
    try:
        lat, lon = float(d["lat"]), float(d["lon"])
    except (KeyError, TypeError, ValueError):
        return _err(400, "Falta la ubicación del terreno.")
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return _err(400, "Coordenadas fuera de rango.")
    pol = d.get("poligono"); ha = None
    if pol and len(pol) >= 3:
        from backend.rejilla import area_ha
        ha = round(area_ha([(p[1], p[0]) for p in pol]), 2)  # el navegador manda [lat, lon]
    con = _db()
    i = con.execute("INSERT INTO terrenos (usuario, nombre, poligono, lat, lon, localidad, pais, cultivo_actual, cultivo_anterior, hectareas, creado) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (u["id"], str(d.get("nombre") or "Mi terreno")[:80], json.dumps(pol) if pol else None, lat, lon, str(d.get("localidad") or "")[:120], str(d.get("pais") or "")[:4], str(d.get("cultivo_actual") or "")[:30], str(d.get("cultivo_anterior") or "")[:30], ha, datetime.now(timezone.utc).isoformat(timespec="seconds"))).lastrowid
    con.commit(); f = con.execute(f"SELECT {_COLS} FROM terrenos WHERE id=?", (i,)).fetchone(); con.close()
    return _terreno(f)


@router.delete("/terrenos/{tid}")
def borrar_terreno(tid: int, request: Request):
    con = _db(); con.execute("DELETE FROM terrenos WHERE id=? AND usuario=?", (tid, usuario_de(request)["id"])); con.commit(); con.close()
    return {"estado": "OK"}


def _terreno_de(request, tid):
    if not str(tid or "").isdigit():
        return None
    con = _db(); f = con.execute(f"SELECT {_COLS} FROM terrenos WHERE id=? AND usuario=?", (int(tid), usuario_de(request)["id"])).fetchone(); con.close()
    return _terreno(f) if f else None


# ---------- alertas y umbrales ----------
def _rangos(uid):
    """Rangos por variable: los de la configuración del robot (con su origen) y, encima, los que puso el usuario."""
    from backend.robot_datos import config
    out = {v: {"variable": v, "min": c.get("min"), "max": c.get("max"), "unidad": c.get("unidad", ""), "origen": c.get("origen") or "definido en la configuración del robot"}
           for v, c in config().get("variables", {}).items() if c.get("min") is not None or c.get("max") is not None}
    con = _db()
    for v, a, b in con.execute("SELECT variable, minimo, maximo FROM umbrales WHERE usuario=?", (uid,)):
        out[v] = {**out.get(v, {"variable": v, "unidad": ""}), "min": a, "max": b, "origen": "definido por ti"}
    con.close()
    return list(out.values())


@router.get("/alertas/umbrales")
def umbrales(request: Request, terreno_id: str = ""):
    return _rangos(usuario_de(request)["id"])


@router.put("/alertas/umbrales")
async def poner_umbral(request: Request):
    d = await request.json(); u = usuario_de(request)
    try:
        v, a, b = str(d["variable"])[:60], d.get("min"), d.get("max")
        a, b = (None if a in (None, "") else float(a)), (None if b in (None, "") else float(b))
    except (KeyError, TypeError, ValueError):
        return _err(400, "Umbral no válido.")
    con = _db(); con.execute("INSERT OR REPLACE INTO umbrales VALUES (?,?,?,?)", (u["id"], v, a, b)); con.commit(); con.close()
    return {"estado": "OK"}


def _id(*partes):
    return hashlib.sha1("|".join(map(str, partes)).encode()).hexdigest()[:12]


@router.get("/alertas")
def alertas(request: Request, terreno_id: str = "", desde: str = "", lang: str = "es"):
    from backend.robot_datos import ultimas, estado
    u = usuario_de(request); lista = []
    rangos = {r["variable"]: r for r in _rangos(u["id"])}
    for v in ultimas()["variables"]:
        r = rangos.get(v["variable"])
        if not r:
            continue
        x, bajo, alto = v["valor"], r.get("min"), r.get("max")
        if (bajo is not None and x < bajo) or (alto is not None and x > alto):
            nom = v.get("nombre") or v["variable"]
            lista.append({"id": _id("robot", v["variable"], v["t"]), "t": v["t"], "tipo": "fuera_de_rango", "gravedad": "atencion", "titulo": f"{nom} fuera de rango",
                          "detalle": f"El robot midió {x:g} {v.get('unidad', '')}; el rango es {'' if bajo is None else bajo}–{'' if alto is None else alto} ({r['origen']}).",
                          "variable": v["variable"], "valor": x, "umbral": f"{'' if bajo is None else bajo}–{'' if alto is None else alto}", "fuente": "Robot"})
    e = estado()
    if e["lecturas"] and not e["conectado"]:
        lista.append({"id": _id("sinconexion", e["ultima_lectura"]), "t": e["ultima_lectura"], "tipo": "robot_sin_conexion", "gravedad": "info", "titulo": "El robot no reporta",
                      "detalle": f"La última lectura llegó el {e['ultima_lectura']}.", "variable": None, "valor": None, "umbral": "5 min sin datos", "fuente": "Robot"})
    t = _terreno_de(request, terreno_id)
    if t:
        h1 = _decisiones(t)["horizonte_1_hoy_7_dias"]
        if h1.get("semaforo") in ("ROJO", "AMARILLO"):
            lista.append({"id": _id("humedad", terreno_id, datetime.now(timezone.utc).date()), "t": datetime.now(timezone.utc).isoformat(timespec="seconds"), "tipo": "humedad_zona_radicular",
                          "gravedad": "alerta" if h1["semaforo"] == "ROJO" else "atencion", "titulo": "Humedad en la zona de raíz", "detalle": h1["recomendacion_natural"], "variable": "humedad_zona_radicular_pct",
                          "valor": h1.get("humedad_zona_radicular_pct"), "umbral": "35–78 % (regla del equipo)", "fuente": "NASA POWER"})
    if t:
        try:
            from backend.capas import hechos_de, series_de, tx
            for h in hechos_de(series_de(t["lat"], t["lon"]), lang):
                if h["gravedad"] == "atencion":
                    lista.append({"id": _id(h["clave"], terreno_id, h["fecha"]), "t": h["fecha"] + "T00:00:00+00:00", "tipo": h["clave"], "gravedad": "atencion", "titulo": tx("t_" + h["clave"], lang) if "t_" + h["clave"] in __import__("backend.capas", fromlist=["_T"])._T else h["clave"],
                                  "detalle": h["texto"], "variable": h["capa"], "valor": h["dato"], "umbral": h["regla"], "fuente": "NASA POWER (estimación de la zona, unos 50 km)"})
        except Exception:
            pass  # sin serie no hay alerta de serie; las demás siguen
    con = _db(); leidas = {r[0] for r in con.execute("SELECT alerta FROM leidas WHERE usuario=?", (u["id"],))}; con.close()
    return [{**a, "leida": a["id"] in leidas} for a in lista if not desde or (a["t"] or "") >= desde]


@router.put("/alertas/{aid}/leida")
def leida(aid: str, request: Request):
    con = _db(); con.execute("INSERT OR IGNORE INTO leidas VALUES (?,?)", (usuario_de(request)["id"], aid[:20])); con.commit(); con.close()
    return {"estado": "OK"}


# ---------- recomendaciones ----------
def _decisiones(t):
    from backend.main import obtener_inteligencia_parcela
    return obtener_inteligencia_parcela(t["lat"], t["lon"])["decisiones_3_horizontes"]


@router.get("/recomendaciones")
def recomendaciones(request: Request, terreno_id: str = ""):
    """Salen de las reglas del equipo aplicadas a los datos medidos (NASA POWER, USDA SSURGO, USGS). Sin confianza inventada."""
    t = _terreno_de(request, terreno_id)
    if not t:
        return _err(400, "Elige un terreno guardado.")
    d = _decisiones(t); h1, h2, h3 = d["horizonte_1_hoy_7_dias"], d["horizonte_2_esta_temporada"], d["horizonte_3_largo_plazo_5_10_anos"]
    out = [{"id": "hoy", "horizonte": "hoy", "titulo": "Humedad en la zona de raíz", "accion": h1["recomendacion_natural"], "confianza": None,
            "porque": [x for x in (f"Humedad de la zona radicular: {h1['humedad_zona_radicular_pct']:.1f} %" if h1.get("humedad_zona_radicular_pct") is not None else None,
                                   f"Agua disponible en el perfil: {h1['agua_disponible_perfil_mm']:.0f} mm" if h1.get("agua_disponible_perfil_mm") is not None else None) if x],
            "faltan_datos": [] if h1.get("humedad_zona_radicular_pct") is not None else ["Humedad en zona de raíz (NASA POWER)"], "fuente": "NASA POWER + USDA SSURGO. Umbrales del semáforo: regla del equipo"}]
    for i, e in enumerate(h2["estrategias_rotacion"]):
        out.append({"id": f"temporada{i}", "horizonte": "temporada", "titulo": e["camino"], "accion": e["secuencia"], "confianza": None, "porque": [e["justificacion_datos_reales"]],
                    "faltan_datos": [], "fuente": "Reglas de rotación del equipo sobre datos de la parcela"})
    largo = [x for x in (f"Lluvia media anual: {h3['precipitacion_media_anual_mm']:.0f} mm" if h3.get("precipitacion_media_anual_mm") is not None else None,
                         f"Pico térmico histórico: {h3['pico_termico_historico_c']:.1f} °C" if h3.get("pico_termico_historico_c") is not None else None,
                         f"Drenaje del suelo: {h3['drenaje_del_suelo']}" if h3.get("drenaje_del_suelo") else None) if x]
    out.append({"id": "largo", "horizonte": "largo", "titulo": "Contexto a largo plazo", "accion": "Estos datos de la parcela orientan la rotación a 5–10 años.", "confianza": None, "porque": largo or ["Sin datos suficientes"],
                "faltan_datos": [], "fuente": "NASA POWER + USDA SSURGO"})
    return out


if __name__ == "__main__" and len(sys.argv) == 3 and sys.argv[1] == "restablecer":
    nueva = secrets.token_urlsafe(9); sal = secrets.token_bytes(16); con = _db()
    n = con.execute("UPDATE usuarios SET sal=?, clave=? WHERE correo=?", (sal, _clave(nueva, sal), sys.argv[2].strip().lower())).rowcount; con.commit()
    print(f"Contraseña temporal: {nueva}" if n else "No existe ese correo")


# ---------- cuenta de demostración (solo desde esta misma compu) ----------
@router.get("/cuenta/demo")
def cuenta_demo(request: Request):
    """Correo y contraseña de la cuenta de demostración que usa el modo demo. Se crea la primera vez con una contraseña al azar,
    guardada en la carpeta de datos (nunca en el código), y con un terreno de prueba en Iowa. Solo responde a peticiones de la propia compu."""
    if (request.client.host if request.client else "") not in ("127.0.0.1", "::1", "localhost"):
        return _err(403, "Solo disponible en la compu donde corre el servidor.")
    f = base.DATOS / "demo_cuenta.json"
    with _LOCK:
        d = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {"correo": "demo@fieldshift.test", "contrasena": secrets.token_urlsafe(12)}
        con = _db(); u = con.execute("SELECT id FROM usuarios WHERE correo=?", (d["correo"],)).fetchone()
        if not u:
            sal = secrets.token_bytes(16)
            uid = con.execute("INSERT INTO usuarios (correo, nombre, sal, clave, creado) VALUES (?,?,?,?,?)", (d["correo"], "Demo", sal, _clave(d["contrasena"], sal), datetime.now(timezone.utc).isoformat(timespec="seconds"))).lastrowid
            from backend.rejilla import area_ha
            pol = [[42.1049, -93.6055], [42.1049, -93.6045], [42.1041, -93.6045], [42.1041, -93.6055]]
            con.execute("INSERT INTO terrenos (usuario, nombre, poligono, lat, lon, localidad, pais, cultivo_actual, cultivo_anterior, hectareas, creado) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                        (uid, "Demo field · Iowa", json.dumps(pol), 42.1045, -93.6050, "Story County, Iowa", "US", "maiz", "soya", round(area_ha([(p[1], p[0]) for p in pol]), 2), datetime.now(timezone.utc).isoformat(timespec="seconds")))
            con.commit(); f.write_text(json.dumps(d), encoding="utf-8")
        if request.query_params.get("reiniciar"):  # cada vuelta del demo empieza como alguien que entra por primera vez: sin terrenos
            con.execute("DELETE FROM terrenos WHERE usuario=(SELECT id FROM usuarios WHERE correo=?)", (d["correo"],)); con.commit()
        con.close()
    return {"estado": "OK", **d}
