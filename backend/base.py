"""Lo común del servidor: carpeta de datos, caché en SQLite, tiempos medidos, avance de trabajos y peticiones con reintento.
FIELD_SHIFT_DATOS cambia la carpeta de datos (las pruebas usan la suya y nunca la real)."""
import json, os, sqlite3, statistics, threading, time
from datetime import datetime, timezone
from pathlib import Path
import requests
from requests.adapters import HTTPAdapter

DATOS = Path(os.environ.get("FIELD_SHIFT_DATOS") or Path(__file__).resolve().parents[2] / "privado" / "datos")
DATOS.mkdir(parents=True, exist_ok=True)
_LOCK = threading.Lock()
_FALLOS = {}  # fuente caída: no se le vuelve a preguntar durante 10 minutos (cuida su cuota y no frena lo demás)
ESPERA_FALLO = 600
_HTTP = requests.Session()  # una sola sesión: reutiliza las conexiones en vez de abrir una por punto
_HTTP.mount("https://", HTTPAdapter(pool_connections=8, pool_maxsize=16))


def ahora_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _db():
    DATOS.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DATOS / "cache.sqlite", timeout=60)
    con.executescript("""CREATE TABLE IF NOT EXISTS cache (fuente TEXT, clave TEXT, t REAL, valor TEXT, PRIMARY KEY (fuente, clave));
    CREATE TABLE IF NOT EXISTS metricas_tiempos (tipo TEXT, tamano INTEGER, segundos REAL, t TEXT);""")
    return con


def pedir(metodo, url, intentos=3, **kw):
    """Petición con reintento y espera creciente (1 s, 2 s) cuando el servicio está saturado o caído."""
    for i in range(intentos):
        try:
            r = _HTTP.request(metodo, url, **kw)
            if r.status_code not in (429, 500, 502, 503, 504) or i == intentos - 1:
                return r
        except requests.RequestException:
            if i == intentos - 1:
                raise
        time.sleep(2 ** i)


def _sirve(v):
    return not (isinstance(v, dict) and v.get("estado") in ("ERROR", "PENDIENTE_TOKEN"))


def recordar(fuente, clave, segundos, fn, sirve=_sirve):
    """Caché que sobrevive al reinicio. Si la fuente falla y hay un dato guardado, se devuelve ese dato marcado
    como guardado, con su fecha y el motivo; nunca un valor de relleno. El resultado nuevo no lleva la marca `cache`."""
    clave = clave if isinstance(clave, str) else json.dumps(clave, sort_keys=True)
    with _LOCK:
        con = _db(); f = con.execute("SELECT t, valor FROM cache WHERE fuente=? AND clave=?", (fuente, clave)).fetchone(); con.close()

    def guardado(vencido, motivo=None):
        v = json.loads(f[1])
        v["cache"] = {"guardado_el": datetime.fromtimestamp(f[0], timezone.utc).isoformat(timespec="seconds"), "vencido": vencido, "motivo": motivo}
        return v

    if f and time.time() - f[0] < segundos:
        return guardado(False)
    fallo = _FALLOS.get((fuente, clave))
    if fallo and time.time() - fallo[0] < ESPERA_FALLO:
        return guardado(True, fallo[1]) if f else fallo[2]
    try:
        v = fn()
    except Exception as e:
        _FALLOS[(fuente, clave)] = (time.time(), f"{type(e).__name__}: {e}"[:200], None)
        if f:
            return guardado(True, f"{type(e).__name__}: {e}"[:200])
        raise
    if sirve(v):
        _FALLOS.pop((fuente, clave), None)
        with _LOCK:
            con = _db(); con.execute("INSERT OR REPLACE INTO cache VALUES (?,?,?,?)", (fuente, clave, time.time(), json.dumps(v))); con.commit(); con.close()
        return v
    if isinstance(v, dict):
        _FALLOS[(fuente, clave)] = (time.time(), str(v.get("detalle") or v.get("estado"))[:200], v)
        if f:
            return guardado(True, _FALLOS[(fuente, clave)][1])
    return v


def anotar_tiempo(tipo, tamano, segundos):
    with _LOCK:
        con = _db(); con.execute("INSERT INTO metricas_tiempos VALUES (?,?,?,?)", (tipo, int(tamano or 0), round(segundos, 2), ahora_iso())); con.commit(); con.close()


def mediana(tipo, tamano):
    """Mediana medida de las últimas 20 corridas de tamaño parecido (de la mitad al doble). Sin historial: None."""
    n = int(tamano or 0)
    with _LOCK:
        con = _db(); v = [r[0] for r in con.execute("SELECT segundos FROM metricas_tiempos WHERE tipo=? AND tamano BETWEEN ? AND ? ORDER BY t DESC LIMIT 20", (tipo, n // 2, max(n * 2, 1)))]; con.close()
    return {"segundos": round(statistics.median(v), 1), "corridas": len(v)} if v else None


class Avance:
    """Lo que un proceso largo informa mientras corre: paso actual, cuántos pasos, y hechas/total dentro del paso."""

    def __init__(self, estado=None):
        self.e = estado if estado is not None else {}

    def paso(self, n, pasos, clave, total=None):
        self.e.update(paso=n, pasos=pasos, clave=clave, hechas=0 if total else None, total=total)

    def suma(self, k=1):
        with _LOCK:
            self.e["hechas"] = (self.e.get("hechas") or 0) + k
