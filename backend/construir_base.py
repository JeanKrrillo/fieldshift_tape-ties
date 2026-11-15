"""Vuelca el catálogo vivo a una base SQLite para consultarlo con SQL o pasarlo a otra base.
Uso, desde la carpeta publico:  python -m backend.construir_base
La base queda en privado/contexto_space_apps_2026/catalogo.sqlite (no se publica)."""
import sqlite3
from pathlib import Path
from backend import real_connectors  # noqa: F401  (carga las llaves del .env)
from backend.catalogo import construir_catalogo

RUTA = Path(__file__).resolve().parents[2] / "privado" / "contexto_space_apps_2026" / "catalogo.sqlite"
TABLAS = {"gibs": "capas_gibs", "landfire": "capas_landfire", "planetary": "colecciones_planetary", "usgs": "colecciones_usgs", "mars": "reportes_mars", "power": "parametros_power"}


def _txt(v):
    return ",".join(map(str, v)) if isinstance(v, (list, tuple)) else v


def main():
    cat = construir_catalogo()
    RUTA.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(RUTA)
    for clave, tabla in TABLAS.items():
        filas = cat.get(clave)
        if not isinstance(filas, list) or not filas:
            print(f"{tabla}: sin datos ({filas})")
            continue
        cols = list(filas[0].keys())
        con.execute(f"DROP TABLE IF EXISTS {tabla}")
        con.execute(f"CREATE TABLE {tabla} ({', '.join(f'\"{c}\"' for c in cols)})")
        con.executemany(f"INSERT INTO {tabla} VALUES ({','.join('?' * len(cols))})", [[_txt(f.get(c)) for c in cols] for f in filas])
        print(f"{tabla}: {len(filas)} filas")
    con.commit()
    con.close()
    print("Base escrita en", RUTA)


if __name__ == "__main__":
    main()
