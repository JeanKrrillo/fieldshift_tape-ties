"""Recolector de datos crudos para entrenar IA. Guarda en SQLite (privado/datos/field_shift.sqlite) y se puede reanudar:
una corrida ya terminada no se repite.

Uso, desde la carpeta publico:
  python -m backend.recolector                       # 4 parcelas piloto, todas las fuentes
  python -m backend.recolector --punto 41.5,-93.6,Mi_finca --fuentes power,cdl --desde 2010
"""
import argparse
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path
import requests
from backend import real_connectors as rc
from backend.catalogo import _power

RUTA = Path(__file__).resolve().parents[2] / "privado" / "datos" / "field_shift.sqlite"
PILOTOS = [("Ames_Iowa", 42.0308, -93.6319), ("Ogallala_Nebraska", 40.7, -99.08), ("Michoacan", 19.9902, -102.2834), ("Central_Valley_California", 36.75, -119.77)]
PC = "https://planetarycomputer.microsoft.com/api"
_lock = threading.Lock()


def abrir() -> sqlite3.Connection:
    RUTA.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(RUTA, check_same_thread=False, timeout=60)
    con.executescript("""
    CREATE TABLE IF NOT EXISTS puntos(id INTEGER PRIMARY KEY, nombre TEXT UNIQUE, lat REAL, lon REAL);
    CREATE TABLE IF NOT EXISTS corridas(fuente TEXT, punto_id INT, periodo TEXT, filas INT, estado TEXT, nota TEXT, creada TEXT, PRIMARY KEY(fuente, punto_id, periodo));
    CREATE TABLE IF NOT EXISTS mars_precios(reporte INT, fecha TEXT, oficina_estado TEXT, producto TEXT, clase TEXT, grado TEXT, entrega TEXT, precio_min REAL, precio_max REAL, precio_prom REAL, unidad TEXT, lugar TEXT);
    CREATE INDEX IF NOT EXISTS i_mars ON mars_precios(reporte, fecha);
    CREATE TABLE IF NOT EXISTS cdl_cultivos(punto_id INT, anio INT, codigo INT, cultivo TEXT, PRIMARY KEY(punto_id, anio));
    CREATE TABLE IF NOT EXISTS openet_mensual(punto_id INT, mes TEXT, et_mm REAL, et_min REAL, et_max REAL, ndvi REAL, PRIMARY KEY(punto_id, mes));
    CREATE TABLE IF NOT EXISTS suelo_horizontes(punto_id INT, prof_ini_cm REAL, prof_fin_cm REAL, materia_organica_pct REAL, ph REAL, arcilla_pct REAL, densidad_g_cm3 REAL, factor_k REAL);
    """)
    return con


def _punto(con, nombre, lat, lon) -> int:
    with _lock:
        con.execute("INSERT OR IGNORE INTO puntos(nombre,lat,lon) VALUES(?,?,?)", (nombre, lat, lon))
        con.commit()
        return con.execute("SELECT id FROM puntos WHERE nombre=?", (nombre,)).fetchone()[0]


def _hecha(con, fuente, pid, periodo) -> bool:
    with _lock:
        return _hecha_sql(con, fuente, pid, periodo)


def _hecha_sql(con, fuente, pid, periodo) -> bool:
    return con.execute("SELECT 1 FROM corridas WHERE fuente=? AND punto_id=? AND periodo=? AND estado='OK'", (fuente, pid, periodo)).fetchone() is not None


def _anota(con, fuente, pid, periodo, filas, estado, nota=""):
    with _lock:
        con.execute("INSERT OR REPLACE INTO corridas VALUES(?,?,?,?,?,?,?)", (fuente, pid, periodo, filas, estado, nota[:300], time.strftime("%Y-%m-%d %H:%M:%S")))
        con.commit()


def _tabla_power(con, params):
    cols = ", ".join(f'"{p}" REAL' for p in params)
    with _lock:
        con.execute(f"CREATE TABLE IF NOT EXISTS power_diario(punto_id INT, fecha TEXT, {cols}, PRIMARY KEY(punto_id, fecha))")
        con.commit()


# ---------- fuentes ----------
def power(con, pid, lat, lon, desde):
    """NASA POWER diario: los 152 parámetros agro, en bloques de 20 parámetros y 5 años."""
    params = [p["id"] for p in _power()]
    _tabla_power(con, params)
    hoy = date.today() - timedelta(days=5)  # POWER publica con unos días de retraso
    for a0 in range(desde, hoy.year + 1, 5):
        a1, per = min(a0 + 4, hoy.year), f"{a0}"
        if _hecha(con, "power", pid, per):
            continue
        fin = hoy.strftime("%Y%m%d") if a1 == hoy.year else f"{a1}1231"
        datos, err = {}, ""
        def pedir(lote):
            r = requests.get("https://power.larc.nasa.gov/api/temporal/daily/point", params={"parameters": ",".join(lote), "community": "ag", "longitude": lon, "latitude": lat, "start": f"{a0}0101", "end": fin, "format": "json"}, timeout=180)
            r.raise_for_status()
            for p, serie in r.json()["properties"]["parameter"].items():
                for f, v in serie.items():
                    datos.setdefault(f, {})[p] = None if v in (-999, -999.0) else v  # -999 es "sin dato" en POWER
        for i in range(0, len(params), 20):
            lote = params[i:i + 20]
            try:
                pedir(lote)
            except requests.HTTPError as e:
                if e.response is None or e.response.status_code != 422:
                    err = f"{type(e).__name__}: {e}"[:200]
                    continue
                for p in lote:  # un lote con un parámetro inválido da 422: se prueban uno por uno
                    try:
                        pedir([p])
                    except Exception:
                        err += f"{p} no disponible; "
            except Exception as e:
                err = f"{type(e).__name__}: {e}"[:200]
        if err and not datos:
            _anota(con, "power", pid, per, 0, "ERROR", err)
            continue
        with _lock:
            for f, v in datos.items():
                cols = list(v)
                con.execute(f'INSERT OR REPLACE INTO power_diario(punto_id, fecha, {",".join(chr(34) + c + chr(34) for c in cols)}) VALUES(?,?,{",".join("?" * len(cols))})', [pid, f"{f[:4]}-{f[4:6]}-{f[6:]}"] + [v[c] for c in cols])
            con.commit()
        _anota(con, "power", pid, per, len(datos), "PARCIAL" if err else "OK", err)


def mars(con, pid, lat, lon, desde):
    """Precios históricos de granos del estado de la parcela (USDA AMS MARS), un año por pedido."""
    geo = requests.get("https://geocoding.geo.census.gov/geocoder/geographies/coordinates", params={"x": lon, "y": lat, "benchmark": "Public_AR_Current", "vintage": "Current_Current", "layers": "States", "format": "json"}, timeout=30).json()
    est = geo["result"]["geographies"].get("States") or []
    slug = rc._MARS_ESTADO.get(est[0]["STUSAB"]) if est else None
    if not slug:
        _anota(con, "mars", pid, "todo", 0, "SIN_COBERTURA", "sin reporte de granos para este punto")
        return
    key = rc.os.getenv("USDA_MARS_API_KEY", "").strip()
    for a in range(max(desde, 2016), date.today().year + 1):
        per = f"{slug}-{a}"
        if _hecha(con, "mars", pid, per):
            continue
        try:
            r = requests.get(f"https://marsapi.ams.usda.gov/services/v1.2/reports/{slug}", auth=(key, ""), params={"q": f"report_begin_date=01/01/{a}:12/31/{a}", "allSections": "true"}, timeout=180)
            r.raise_for_status()
            filas = next((s["results"] for s in r.json() if s.get("reportSection") == "Report Detail"), [])
            with _lock:
                con.execute("DELETE FROM mars_precios WHERE reporte=? AND substr(fecha,7,4)=?", (slug, str(a)))
                con.executemany("INSERT INTO mars_precios VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", [(slug, f.get("report_date"), f.get("office_state"), f.get("commodity"), f.get("class"), f.get("grade"), f.get("delivery_point"), f.get("price_min"), f.get("price_max"), f.get("avg_price"), f.get("price_unit"), f.get("market_location_name")) for f in filas])
                con.commit()
            _anota(con, "mars", pid, per, len(filas), "OK")
        except Exception as e:
            _anota(con, "mars", pid, per, 0, "ERROR", f"{type(e).__name__}: {e}")


def cdl(con, pid, lat, lon, desde):
    """Qué cultivo salió en el punto cada año (USDA Cropland Data Layer vía Planetary Computer). Son las etiquetas para entrenar."""
    if _hecha(con, "cdl", pid, "todo"):
        return
    try:
        col = requests.get(f"{PC}/stac/v1/collections/usda-cdl", timeout=60).json()
        nombres = {c["value"]: c["description"] for c in col["item_assets"]["cropland"]["classification:classes"]}
        fs = requests.get(f"{PC}/stac/v1/search", params={"collections": "usda-cdl", "bbox": f"{lon - .001},{lat - .001},{lon + .001},{lat + .001}", "limit": 100}, timeout=60).json()["features"]
        filas = []
        for f in sorted((f for f in fs if f["id"].startswith("cropland_")), key=lambda f: f["id"]):
            anio = int(f["properties"]["start_datetime"][:4])
            if anio < desde:
                continue
            v = requests.get(f"{PC}/data/v1/item/point/{lon},{lat}", params={"collection": "usda-cdl", "item": f["id"], "assets": "cropland"}, timeout=60).json()["values"][0]
            filas.append((pid, anio, int(v), nombres.get(int(v), "?")))
        with _lock:
            con.executemany("INSERT OR REPLACE INTO cdl_cultivos VALUES(?,?,?,?)", filas)
            con.commit()
        _anota(con, "cdl", pid, "todo", len(filas), "OK" if filas else "SIN_COBERTURA", "" if filas else "ninguna escena CDL cubre el punto")
    except Exception as e:
        _anota(con, "cdl", pid, "todo", 0, "ERROR", f"{type(e).__name__}: {e}")


def openet(con, pid, lat, lon, desde):
    """Consumo de agua mensual (ET), rango entre modelos y NDVI, todos los años en UNA solicitud por variable (el plan gratuito da 100 al mes)."""
    if _hecha(con, "openet", pid, "todo"):
        return
    key = rc.os.getenv("OPENET_API_KEY", "").strip()
    if not (24 <= lat <= 50 and -125 <= lon <= -66):
        _anota(con, "openet", pid, "todo", 0, "SIN_COBERTURA", "fuera de EE. UU. continental")
        return
    try:
        cuota = requests.get("https://openet-api.org/account/status", headers={"Authorization": key}, timeout=30).json()["Monthly Requests"]  # "99 used of 100"
        usadas, tope = (int(x) for x in cuota.replace("used of", " ").split())
        if tope - usadas < 6:
            _anota(con, "openet", pid, "todo", 0, "SIN_CUPO", f"cuota mensual: {cuota}")
            return
        d0, d1 = f"{max(desde, 2016)}-01-01", f"{date.today().year - 1}-12-31"
        pedir = lambda v: requests.post("https://openet-api.org/raster/timeseries/point", headers={"Authorization": key}, timeout=120, json={"date_range": [d0, d1], "interval": "monthly", "geometry": [lon, lat], "model": "Ensemble", "variable": v, "reference_et": "gridMET", "units": "mm", "file_format": "JSON"})
        r = {v: pedir(v) for v in ("ET", "ET_MAD_MIN", "ET_MAD_MAX", "NDVI")}
        for v, x in r.items():
            x.raise_for_status()
        j = {v: {p["time"][:7]: p for p in x.json()} for v, x in r.items()}
        meses = sorted(j["ET"])
        with _lock:
            con.executemany("INSERT OR REPLACE INTO openet_mensual VALUES(?,?,?,?,?,?)", [(pid, m, j["ET"][m].get("et"), j["ET_MAD_MIN"].get(m, {}).get("et_mad_min"), j["ET_MAD_MAX"].get(m, {}).get("et_mad_max"), j["NDVI"].get(m, {}).get("ndvi")) for m in meses])
            con.commit()
        _anota(con, "openet", pid, "todo", len(meses), "OK" if meses else "VACIO")
    except Exception as e:
        _anota(con, "openet", pid, "todo", 0, "ERROR", f"{type(e).__name__}: {e}")


def suelo(con, pid, lat, lon, desde):
    """Perfil de suelo por profundidad (USDA SSURGO)."""
    if _hecha(con, "suelo", pid, "todo"):
        return
    try:
        s = rc.fetch_usda_ssurgo_real(lat, lon)
        hz = s.get("horizontes_verticales_0_150cm") or []
        with _lock:
            con.execute("DELETE FROM suelo_horizontes WHERE punto_id=?", (pid,))
            con.executemany("INSERT INTO suelo_horizontes VALUES(?,?,?,?,?,?,?,?)", [(pid, h.get("prof_inicio_cm"), h.get("prof_fin_cm"), h.get("materia_organica_pct"), h.get("ph"), h.get("arcilla_pct"), h.get("densidad_aparente_g_cm3"), h.get("factor_k_erosion")) for h in hz])
            con.commit()
        _anota(con, "suelo", pid, "todo", len(hz), "OK" if hz else "SIN_COBERTURA", "" if hz else "sin suelo SSURGO en el punto")
    except Exception as e:
        _anota(con, "suelo", pid, "todo", 0, "ERROR", f"{type(e).__name__}: {e}")


FUENTES = {"power": power, "mars": mars, "cdl": cdl, "openet": openet, "suelo": suelo}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--punto", action="append", help="lat,lon,nombre (se puede repetir); sin esto usa las parcelas piloto")
    ap.add_argument("--fuentes", default=",".join(FUENTES))
    ap.add_argument("--desde", type=int, default=2000, help="año de inicio")
    a = ap.parse_args()
    puntos = [(p.split(",")[2], float(p.split(",")[0]), float(p.split(",")[1])) for p in a.punto] if a.punto else PILOTOS
    con = abrir()
    tareas = [(FUENTES[f], _punto(con, n, la, lo), la, lo) for n, la, lo in puntos for f in a.fuentes.split(",")]
    with ThreadPoolExecutor(max_workers=6) as ex:
        list(ex.map(lambda t: t[0](con, t[1], t[2], t[3], a.desde), tareas))
    for fuente, estado, n, filas in con.execute("SELECT fuente, estado, COUNT(*), SUM(filas) FROM corridas GROUP BY fuente, estado ORDER BY fuente"):
        print(f"{fuente:7} {estado:14} corridas={n:3} filas={filas}")
    print("Base:", RUTA)


if __name__ == "__main__":
    main()
