# 🔗 Guía de Integración para Claude Code (Corte B → `main.py` y Corte C)

Siguiendo las reglas de `plan_cortes_A_B_C.md` (**"Un archivo, un dueño"**), Antigravity (Cápsula B) **no modificó** `publico/backend/main.py` ni ningún archivo de los recolectores o de la Cápsula C.

---

## 1. Archivos Creados / Actualizados por la Cápsula B (Antigravity)

1. **`publico/backend/b_rutas.py`**:
   Router de FastAPI (`APIRouter(prefix="/api/v1/b")`) que expone:
   - `GET /api/v1/b/clima-historico?lat=&lon=`: Estadísticas climáticas de **40 años (1985–2024)** en vivo desde NASA POWER Monthly + Daily (percentiles `p10/p50/p90`, tendencia por década en `°C/década` y `mm/década`, comparación interanual contra los mismos 30 días del año pasado, fechas históricas de última helada de primavera y primera de otoño, y últimos 14 días diarios).
   - `GET /api/v1/b/osm-campos?sur=&oeste=&norte=&este=`: Consulta en vivo a OpenStreetMap Overpass API con reintentos en 2 servidores espejo y caché en memoria para devolver polígonos reales de parcelas agrícolas (`landuse=farmland|orchard|vineyard|meadow`).
   - `GET /api/v1/b/modelos`: Sirve las fichas técnicas honestas de los modelos (`M1..M12`) con métricas medidas y pesos de importancia de variables.
2. **`publico/backend/b_simulados.json`**:
   Metadatos técnicos honestos de los modelos (`M1`, `M2`, `M3`, `M7`, `M8`, `M12`) con exactitud medida (`83.4%` vs `40.7%` azar) e importancia de variables Gini.
3. **`publico/frontend/b_estilos.css`**:
   Hoja de estilos completa para tema claro/oscuro (`body[data-theme="light|dark"]`), foco visible de teclado, bienvenida con 6 casos listos, recorrido guiado de 5 pasos, semáforos de 5 segundos, cortina comparadora, calendario imprimible a 3 años, modal de glosario y barra inferior móvil (`390 px`).
4. **`publico/frontend/b_mejoras.js`**:
   Módulo autocontenido en Español, Inglés y Portugués (`esc()` en todo HTML dinámico) que implementa las áreas de experiencia, mapa, terreno, clima de 40 años, calculadora de márgenes, rotación a 3 años, IA explicable y sensores/robot.
   - **Nota de resiliencia:** Si `b_rutas.py` aún no está montado en `main.py`, `b_mejoras.js` hace *fallback* automático directo desde el navegador hacia NASA POWER (`https://power.larc.nasa.gov/api/temporal/monthly/point`) y Overpass API (`https://overpass-api.de/api/interpreter`), por lo que funciona al 100% desde el primer segundo.
5. **`publico/frontend/index.html`**:
   Se agregaron únicamente las dos líneas de enlace (`<link rel="stylesheet" href="b_estilos.css">` y `<script src="b_mejoras.js"></script>`).

---

## 2. Cómo Montar `b_rutas.py` en `publico/backend/main.py` (2 líneas)

En `publico/backend/main.py`, agrega:

```python
from .b_rutas import router as b_router
app.include_router(b_router)
```

Con eso quedan activos en el servidor local los 3 endpoints `/api/v1/b/clima-historico`, `/api/v1/b/osm-campos` y `/api/v1/b/modelos`.

---

## 3. Compatibilidad Automática con los Endpoints de la Cápsula C (Codex)

`publico/frontend/b_mejoras.js` ya busca tanto las rutas `/api/v1/b/clima-historico` y `/api/v1/b/modelos` como las rutas de la Cápsula C (`/api/v1/clima-historico` y `/api/v1/modelos`), integrándose sin colisiones.

---

## 4. Reporte de Pruebas Ejecutadas (Regla 6: "Probar de verdad")

- **Backend `b_rutas.py` (Python 3.10):**
  - Probado en vivo contra NASA POWER (`lat=42.02, lon=-93.64`, Story County, Iowa): devolvió `estado="OK"`, `40 años analizados (1985–2024)`, `temp_media_40a_c = 9.31 °C`, percentiles `p10=8.04 °C / p50=9.27 °C / p90=10.75 °C`, tendencia `+0.38 °C/década`, comparación interanual y fechas de helada (`04-16` primavera, `10-16` otoño).
  - Probado `obtener_modelos()`: devolvió las 6 fichas técnicas (`M1..M12`) con `83.4%` de acierto validado.
- **Frontend en navegador (Escritorio `1280×800` y Móvil `390×844`):**
  - Verificado cambio de idioma en caliente (`ES` / `EN` / `PT`) sin textos rotos.
  - Verificado cambio de tema (`☀️ Claro` / `🌙 Oscuro`) y modal de Glosario (`18 términos`).
  - Verificados los 6 casos reales con un clic y la vista móvil de `390 px` de ancho con barra inferior pegajosa (*Ver Paneles de Datos* / *Ver Mapa Completo*).

---

## 5. Cápsula D — Rediseño Completo de la Interfaz (`publico/frontend/v2/`)

Siguiendo `especificacion_rediseno_ui_cápsula_D.md` (Reglas 6 y 7: *"La interfaz nueva vive en `publico/frontend/v2/` y se abre en `http://127.0.0.1:8000/v2/`. La actual sigue en `/`. Un archivo, un dueño: Antigravity solo escribe dentro de `publico/frontend/v2/`"*):

- **URL en vivo:** `http://127.0.0.1:8000/v2/` (servida automáticamente por `StaticFiles(..., html=True)` de `main.py`, **0 cambios requeridos en `main.py`**).
- **Archivos de la nueva interfaz (`publico/frontend/v2/`):**
  - `publico/frontend/v2/index.html` — Estructura HTML con 3 espacios (`Mapa y terreno`, `Decidir`, `Datos y modelos`), barra superior con buscador y selector de idioma, y cajón acoplado de 3 alturas.
  - `publico/frontend/v2/estilos.css` — Sistema de diseño completo con tokens `:root` (claro/oscuro), tipografía del sistema, botones `>= 44×44 px`, responsive (`360px`, `390px`, `768px`, `1280px`, `1920px`) e impresión limpia.
  - `publico/frontend/v2/iconos.js` — 28 íconos SVG propios de `1.75 px` de trazo (`0` emojis).
  - `publico/frontend/v2/i18n.js` — Diccionario trilingüe completo (`ES / EN / PT`), `esc()`, 6 casos marcados `"ejemplo, no real"`, 14 capas útiles y glosario de 14 términos.
  - `publico/frontend/v2/mapa.js` — Mapa Leaflet a pantalla completa, dibujo libre, adopción 1-clic de secciones BLM PLSS y parcelas OSM, celdas (`9..100`) con color + símbolo + número + leyenda, máquina del tiempo de 12 semanas y cortina comparadora.
  - `publico/frontend/v2/pantallas.js` — Las 11 pantallas con divulgación progresiva (`Agricultor`, `Agrónomo`, `Científico`) y conexión a los 13 endpoints reales de `/api/v1/*`.
  - `publico/frontend/v2/app.js` — Controlador principal, `localStorage` seguro con `try/catch`, recorrido guiado de 5 pasos y barra de progreso no bloqueante.
  - `publico/frontend/v2/LEEME.md` y `privado/contexto_space_apps_2026/guia_estilo_capsula_D.md` — Documentación técnica y tabla de la sección 9 verificada con `0 console.error` y `0 pageerror`.
  - `publico/frontend/v2/capturas/` — 15 capturas PNG verificadas (`claro`, `oscuro` y `390px`).
- **Cómo promover `v2` a `/` (`http://127.0.0.1:8000/`):** Copiar el contenido de `publico/frontend/v2/` a `publico/frontend/` (o redirigir `/` a `/v2/`).

---

## 6. Cápsula E — Transformación de Visor a Producto Completo (`publico/frontend/v2/`)

Siguiendo `privado/contexto_space_apps_2026/especificacion_producto_capsula_E.md` ("Un archivo, un dueño: Antigravity trabaja exclusivamente dentro de `publico/frontend/v2/`"):

### 6.1 Arquitectura de Doble Modo (`adaptador.js`)
Para garantizar que el producto funcione de inmediato tanto si los nuevos endpoints de backend ya están desplegados como si se está evaluando sin conexión o sin cuenta, se implementó una capa adaptadora centralizada (`window.V2Adapter`):
- **Modo Real (`real`):** Consume los endpoints REST de FastAPI `/api/v1/*`. Si el backend responde `404` o falla la red, conmuta transparentemente a modo ejemplo con aviso.
- **Modo Demostración (`ejemplo`):** Se activa con el botón siempre visible **«Probar sin cuenta»** o cuando no hay backend disponible. Carga un almacén en memoria (`DEMO_STORE`) con datos agronómicos coherentes de Iowa y Sonora, mostrando de forma persistente la franja superior:
  ```
  MODO DEMO — DATOS SIMULADOS PARA EVALUACIÓN (Lote Norte, Story County, Iowa)
  ```
- **Seguridad y Cero Almacenamiento de Claves:** Ninguna contraseña se almacena jamás en `localStorage`, `sessionStorage`, cookies, parámetros de URL ni se imprime en consola.

### 6.2 Contrato de Endpoints Consumidos por el Frontend v2
Los siguientes endpoints son consumidos por los módulos de la Cápsula E:

| Endpoint | Método | Módulo Frontend | Descripción |
|---|---|---|---|
| `/api/v1/cuenta/registro` | `POST` | `cuenta.js` | Crear cuenta de usuario `{ correo, contrasena, nombre }`. |
| `/api/v1/cuenta/login` | `POST` | `cuenta.js` | Inicio de sesión `{ correo, contrasena }` -> `{ token, usuario }`. |
| `/api/v1/cuenta/recuperar` | `POST` | `cuenta.js` | Envío de correo de recuperación `{ correo }`. |
| `/api/v1/terrenos` | `GET` / `POST` | `ubicacion.js` | Listar y crear parcelas con polígono, hectáreas, cultivo actual y anterior. |
| `/api/v1/robots/emparejar` | `POST` | `emparejar.js` | Genera código de 6 caracteres con 10 min de vigencia `{ terreno_id }`. |
| `/api/v1/robots/emparejar/{codigo}` | `GET` | `emparejar.js` | Sondeo cada 3s para confirmar conexión del robot desde portal cautivo. |
| `/api/v1/robots/{id}/ordenes` | `POST` | `robot.js` | Emisión de órdenes de misión en vivo: `iniciar`, `pausar`, `volver_base`. |
| `/api/v1/robots/{id}/importar` | `POST` | `robot.js` | Subida manual de CSV/Excel de sensores protegida por token en cabecera `X-FieldShift-Token`. |
| `/api/v1/alertas` | `GET` | `alertas.js` | Listado de alertas agronómicas con causa, gravedad y enlace a Conceptos. |
| `/api/v1/alertas/{id}/leida` | `PATCH` | `alertas.js` | Marcar alerta como leída (actualiza contador de campana). |
| `/api/v1/alertas/umbrales` | `GET` / `PUT` | `alertas.js` | Lectura y edición de umbrales («rango de la app (citado)» vs «definido por ti»). |
| `/api/v1/recomendaciones` | `GET` | `pantallas.js` | Recomendaciones hoy/semana, temporada y rotación honesta (acierto medido 72.1%). |

> **Nota de red y Mixed Content (Portal Cautivo del Robot):**
> Para configurar el robot cuando emite su propia red Wi-Fi `FieldShift-XXXX`, la app **nunca** realiza llamadas `fetch()` hacia `http://192.168.4.1` (lo cual fallaría por política de Mixed Content del navegador y aislamiento de red). En su lugar, el Asistente de Emparejamiento (`emparejar.js`) proporciona un enlace externo accesible con `target="_blank" rel="noopener noreferrer"`. La app nunca solicita la contraseña de la red Wi-Fi doméstica del agricultor; ésta se ingresa exclusivamente dentro del portal local del robot.

### 6.3 Los 5 Espacios Principales de la Aplicación
1. **Inicio (`#v2-ws-inicio`):** Tablero integral con cuadrícula interactiva coloreada por NDVI/severidad/variables del robot; tarjetas dinámicas de sensores (`temp_suelo_c`, `humedad_suelo_pct`, `ec_ms_cm`, `ph`, `n_mg_kg`, `p_mg_kg`, `k_mg_kg`, `bateria_pct`); tabla de datos crudos con descarga CSV; comparador Local vs Nube; medias a 24h / 7d / 30d; resumen de alertas activas.
2. **Robot (`#v2-ws-robot`):** Mapa de ruta recorrida y planeada; estado de telemetría y conexión; órdenes en vivo (Iniciar, Pausar, Volver a base); historial de misiones; tabla de calibración y mantenimiento; banner de desconexión automática si lleva >5 min sin reportar; subida de archivos CSV/Excel con token de un solo uso.
3. **Datos de la región (`#v2-ws-region`):** Pronóstico a 7 días; riesgo de helada; percentiles climáticos de 40 años (1985–2024); balance hídrico; suelo SSURGO; sensores NWIS; 14 capas satelitales. Tres niveles de divulgación progresiva: *Familia*, *Agrónomo* y *Científico*.
4. **Recomendaciones (`#v2-ws-recom`):** Cuatro horizontes temporales (Hoy/semana, temporada, rotación a 3 años y márgenes con precios USDA MARS). Predictor IA de cultivos con honestidad técnica explícita: acierto medido del 72.1% en zonas nunca vistas (82.9% en maíz/soya de Iowa, advertencia de «predicción, no medición»).
5. **Conceptos (`#v2-ws-conceptos`):** Los 17 conceptos agronómicos obligatorios con buscador reactivo y tarjetas expandibles respondiendo a las 5 preguntas canónicas (¿Qué es?, ¿Cómo se mide?, ¿Por qué le importa al cultivo?, Valores típicos con citas oficiales USDA/FAO/NASA, ¿Qué hacer si está alto o bajo?).



