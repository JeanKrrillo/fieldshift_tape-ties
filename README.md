# 🛰️ Field Shift — Inteligencia Satelital y Agronómica Abierta (NASA Space Apps 2026)

Plataforma trilingüe (**Español, Inglés y Portugués**) para toma de decisiones agrícolas (hoy, esta temporada y en ciclos de rotación a 3 años) basada **exclusivamente en mediciones satelitales y estaciones oficiales reales**. Cero datos inventados: cada cifra muestra su fuente, resolución espacial y fecha de escena; donde una agencia no tiene cobertura, se reporta explícitamente como `sin dato`.

---

## 🚀 Instalación y Ejecución en 5 Pasos (en limpio)

1. **Requisitos previos:** Tener instalado **Python 3.10+** y conexión a Internet para consultar las APIs públicas de NASA, Copernicus, USDA y USGS.
2. **Instalar dependencias:**
   ```bash
   cd publico
   python -m pip install -r backend/requirements.txt
   ```
3. **Configurar variables de entorno (opcional pero recomendado para fuentes con llave):**
   Copia `backend/.env.example` hacia `../privado/.env` y coloca tus credenciales gratuitas (`EARTHDATA_TOKEN`, `USDA_MARS_API_KEY`, `USGS_WATER_API_KEY`, `OPENET_API_KEY`). *Nota: NASA POWER, NASA GIBS, Copernicus Sentinel-2 (vía Planetary Computer), USDA NRCS SSURGO, LANDFIRE y OpenStreetMap funcionan sin llave.*
4. **Iniciar el servidor FastAPI:**
   ```bash
   python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
   ```
5. **Abrir el panel en el navegador:**
   Visita `http://127.0.0.1:8000`. Puedes usar tu ubicación GPS, elegir cualquiera de los **6 casos reales listos con un clic** o seguir el **Recorrido Guiado de 5 pasos**.

---

## 🛰️ Fuentes de Datos Oficiales y Licencias (Área 49)

| Fuente / Misión | Qué mide en Field Shift | Resolución y Frecuencia | Cobertura | Licencia / Condición de Uso |
| :--- | :--- | :--- | :--- | :--- |
| **NASA POWER** (*Agroclimatology*) | Temperatura, lluvia, radiación solar, viento, ETo y percentiles climáticos de 40 años (`1985–2024`) | ~50 km · Diario y mensual | Global | Dominio Público Federal EE. UU. (NASA Open Data Policy) |
| **NASA SMAP** (*SPL4SMGP / L3*) | Humedad superficial (`0–5 cm`) y de zona de raíz (`0–100 cm`) | ~9 km · Cada 2–3 días | Global | Dominio Público Federal EE. UU. (NASA NSIDC DAAC) |
| **NASA GPM IMERG** | Precipitación satelital acumulada | ~10 km · Cada 30 min / diario | Global | Dominio Público Federal EE. UU. (NASA GES DISC) |
| **NASA GIBS** (*WMTS*) | Mosaicos visuales históricos (MODIS NDVI, LST, SMAP, IMERG) | 250 m – 10 km · Diario / 8–16 días | Global | Dominio Público Federal EE. UU. (NASA EOSDIS) |
| **Copernicus Sentinel-2 L2A** | Verdor NDVI cuadro por cuadro en el polígono del agricultor y reflectancia multitemporal | **10 m** · Cada 5 días (sin nubes) | Global | Copernicus Open Access License (CC-BY / Libre y abierta, ESA) |
| **USDA NASS Cropland Data Layer (CDL)** | Historial de cultivo sembrado lote por lote y etiquetas de entrenamiento de IA | **30 m** · Anual | EE. UU. continental (CONUS) | Dominio Público Federal EE. UU. (CC0 / USDA NASS) |
| **USDA NRCS SSURGO (SDA)** | Textura del suelo, pH, capacidad de retención de agua y drenaje medidos en campo | Escala parcelaria (1:12,000–1:63,360) | EE. UU. | Dominio Público Federal EE. UU. (USDA NRCS) |
| **USDA AMS MARS** | Precios reales mayoristas de maíz, soya y trigo en mercados regionales | Reportes diarios de mercado | EE. UU. | Dominio Público Federal EE. UU. (USDA AMS) |
| **USGS Water Data (NWIS / OGC)** | Caudal y nivel de agua en ríos y pozos cercanos | Estaciones puntuales en tiempo real | EE. UU. | Dominio Público Federal EE. UU. (USGS) |
| **BLM PLSS CadNSDI** | Cuadrícula catastral federal de municipios y secciones de 1 milla cuadrada (`259 ha`) | Polígonos topográficos oficiales | ~30 estados de EE. UU. | Dominio Público Federal EE. UU. (BLM) |
| **OpenStreetMap (Overpass API)** | Linderos de parcelas agrícolas (`landuse=farmland`, `orchard`, `vineyard`) | Vectorial colaborativo | Global | **ODbL 1.0** (*© OpenStreetMap contributors*) |

---

## 🤖 Tarjetas Técnicas de los Modelos de IA (Honestidad Científica)

Todos los modelos siguen nuestra regla de oro: **toda salida de IA se etiqueta explícitamente como "predicción, no medición"** e informa su tasa de acierto fuera de muestra:

- **M1 — Clasificador Multitemporal de Cultivos (`Random Forest`, `cultivos_ia.py`):**
  - **Entradas:** 6 escenas libres de nubes de Copernicus Sentinel-2 L2A (`10 m`, bandas Roja `B04` e Infrarroja Cercana `B08` de mayo a octubre).
  - **Etiquetas de verdad:** USDA NASS Cropland Data Layer (CDL 2021) en el centro de Iowa.
  - **Exactitud medida en zonas nunca vistas:** **83.4%** (frente a **40.7%** de una línea base al azar).
  - **Límite declarado:** Validado en el Cinturón Maicero de EE. UU. (maíz, soya, pastizal, bosque, zona urbana). Fuera de esa región o en cultivos hortícolas intercalados debe usarse únicamente como referencia orientativa.
- **M7 — Zonificación de Manejo en 3 Niveles (Baja, Media y Alta productividad):**
  - **Método:** Agrupación determinista sobre el NDVI Sentinel-2 (`10 m`) de los cuadros del polígono del usuario.
- **M8 — Detector Estadístico de Anomalías por Cuadro (`|z-score| ≥ 1.2`):**
  - **Método:** Calcula cuántas desviaciones estándar se aleja cada cuadro del promedio de su propio lote para priorizar la inspección en campo o el muestreo del robot.
