"""Crea o completa privado/.env pidiendo cada llave en tu terminal (no se muestra al escribir).
Uso: python configurar_env.py   (Enter deja una llave como está)"""

from getpass import getpass
from pathlib import Path

NOMBRES = ["EARTHDATA_TOKEN", "USDA_MARS_API_KEY",
           "USGS_WATER_API_KEY", "OPENET_API_KEY", "METEOMATICS_USER", "METEOMATICS_PASS", "GOOGLE_MAPS_API_KEY"]
ruta = Path(__file__).resolve().parents[2] / "privado" / ".env"

actual = {}
if ruta.exists():
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        if "=" in linea and not linea.startswith("#"):
            k, v = linea.split("=", 1)
            actual[k.strip()] = v.strip()

for n in NOMBRES:
    if actual.get(n):  # solo pregunta las que faltan
        continue
    nuevo = getpass(f"Pega {n} y presiona Enter (no se ve al pegar; Enter solo para saltarla): ")
    nuevo = "".join(nuevo.split())  # quita espacios y saltos de línea que trae el texto copiado
    if nuevo:
        actual[n] = nuevo

ruta.parent.mkdir(parents=True, exist_ok=True)
ruta.write_text("".join(f"{n}={actual.get(n, '')}\n" for n in NOMBRES), encoding="utf-8")
print(f"Guardado en {ruta}. Llaves con valor: {sum(bool(actual.get(n)) for n in NOMBRES)} de {len(NOMBRES)}")
