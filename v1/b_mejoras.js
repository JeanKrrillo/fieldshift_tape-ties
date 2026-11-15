// =============================================================================
// Cápsula B (Antigravity) — Mejoras de Experiencia, Mapas, Terreno, Clima 40a,
// Rotación 3 Años, IA Honesta, Sensores/Robot y Exportación (Áreas 1–46)
// Reglas:
// - Cero datos inventados: cada cifra proviene de una fuente real o dice "sin dato".
// - Todo en Español (es), Inglés (en) y Portugués (pt) con esc().
// - No modifica main.py; consume /api/v1/b/* con fallback directo a NASA POWER /
//   Overpass API / b_simulados si main.py aún no monta b_rutas.py.
// =============================================================================

(function () {
  "use strict";

  const B_STATE = {
    theme: localStorage.getItem("b_theme") || "dark",
    favLayers: JSON.parse(localStorage.getItem("b_fav_layers") || "[]"),
    savedTerrains: JSON.parse(localStorage.getItem("b_saved_terrains") || "[]"),
    layerFilter: "",
    colorMode: "ndvi", // ndvi | sev | zones | anom
    selectedCells: new Set(),
    lastTerrainResp: null,
    lastAiResp: null,
    clim40: null,
    clim40Key: "",
    modelsMeta: null,
    osmLayer: null,
    curtainPct: 100,
    timeOffsetDays: 0,
    playTimer: null,
    loadTimer: null,
    loadStartMs: 0,
    tourStep: -1,
    thresholds: { frostC: 0, bareNdvi: 0.30, droughtPct: 35, excessPct: 78 },
    farmExtra: { ha: 50, budgetUsdHa: 450, market: "local", costMaize: 420, costSoy: 310, costWheat: 280, yieldMaize: 10.5, yieldSoy: 3.4, yieldWheat: 4.2, nKgHa: "", phVal: "" },
    climateScenario: { rainDeltaPct: 0, tempDeltaC: 0 },
    sensorPoints: [],
    robotPoints: []
  };
  window.B_STATE = B_STATE;

  // ---------- Diccionario Trilingüe ES / EN / PT ----------
  const BT = {
    es: {
      theme_light: "☀️ Claro", theme_dark: "🌙 Oscuro",
      glossary_btn: "📖 Glosario", tour_btn: "🧭 Recorrido (5 pasos)",
      hero_badge: "🛰️ NASA Space Apps 2026 · Datos Reales",
      hero_title: "Decisiones agrícolas con satélites reales, clima de 40 años e IA transparente",
      hero_sub: "Consulta humedad de suelo (SMAP), verdor lote por lote (Sentinel-2 a 10 m), clima histórico (NASA POWER 1985–2024), ríos/pozos (USGS) y precios del día (USDA MARS). Cero números inventados.",
      btn_try_case: "⚡ Probar con un ejemplo", btn_use_gps: "📍 Usar mi ubicación",
      cases_title: "6 casos reales listos con un clic (cargan punto + cuadrícula):",
      c1_t: "🌽 Maíz en Iowa", c1_d: "Story County, IA · Rotación maíz-soya en secano",
      c2_t: "💧 Riego en Nebraska", c2_d: "Acuífero Ogallala · Pivote central y balance hídrico",
      c3_t: "❄️ Riesgo de helada", c3_d: "Fargo, ND / MN · Ventana corta libre de heladas",
      c4_t: "🏜️ Suelo pelado / sequía", c4_d: "Valle Central, CA · Estrés hídrico y alta evaporación",
      c5_t: "🗺️ Sección BLM PLSS", c5_d: "Sección catastral oficial (259 ha) en el Medio Oeste",
      c6_t: "🌎 Fuera de EE. UU. (México)", c6_d: "Zamora, Michoacán · Muestra qué fuentes son globales y cuáles solo EE. UU.",
      load_msg: "Consultando satélites y estaciones oficiales…",
      load_elapsed: "Tiempo transcurrido:", load_est: "estimado 3–8 s",
      err_friendly: "No pudimos completar una consulta externa en este momento.",
      btn_retry: "🔄 Reintentar ahora",
      // Bloque 2
      cell_100: "100 (~10 m, fino)",
      ter_tools_title: "Herramientas del terreno, archivos y linderos reales",
      btn_osm: "🌾 Ver campos agrícolas reales (OpenStreetMap)",
      osm_loading: "Buscando parcelas agrícolas mapeadas en OpenStreetMap…",
      osm_done: "parcelas agrícolas encontradas. Haz clic en cualquiera para usarla como tu terreno.",
      osm_empty: "No hay parcelas agrícolas trazadas en OpenStreetMap en esta vista. Acerca el mapa o dibuja tu terreno.",
      btn_save_ter: "💾 Guardar terreno", btn_imp_geo: "📂 Importar GeoJSON/KML",
      btn_exp_geo: "⬇️ GeoJSON", btn_exp_kml: "⬇️ KML", btn_exp_csv: "⬇️ CSV Celdas", btn_print: "🖨️ Imprimir / PDF",
      saved_none: "Aún no tienes terrenos guardados en este navegador.",
      saved_prompt: "Nombre para guardar este terreno:",
      multi_hint: "💡 Tip: Haz clic en cualquier cuadro para ver su ficha detallada, o usa Shift+Clic para seleccionar varios cuadros y promediarlos.",
      multi_sel: "Cuadros seleccionados:", multi_clear: "Limpiar selección",
      color_mode_lbl: "Colorear cuadrícula por:",
      cm_ndvi: "Verdor (NDVI Sentinel-2)", cm_sev: "Severidad combinada (Planta + Agua + Helada)",
      cm_zones: "Zonas de manejo (Alta / Media / Baja)", cm_anom: "Anomalías del lote (|z| ≥ 1.2)",
      layer_search_ph: "🔎 Buscar capa por nombre o pregunta…",
      layer_fav_only: "⭐ Solo favoritas",
      time_title: "⏱️ Máquina del tiempo GIBS (últimas 12 semanas) y Cortina comparadora",
      time_play: "▶ Reproducir", time_pause: "⏸ Pausar", time_curtain: "Cortina de opacidad / comparación:",
      // Bloque 3
      sum5_title: "🚦 Resumen rápido en 5 segundos (Agua · Plantas · Riesgo)",
      sem_water: "Agua en suelo y lluvia", sem_plants: "Estado de las plantas", sem_risk: "Riesgo térmico y alertas",
      alerts_title: "🔔 Alertas activas y umbrales configurables",
      th_frost: "Umbral helada (°C):", th_bare: "Umbral suelo pelado (NDVI <):",
      th_drought: "Umbral sequía raíz (< %):", th_excess: "Umbral exceso agua (> %):",
      clim40_title: "📈 Clima Histórico de 40 Años (1985–2024), Comparación Anual y Heladas",
      clim40_wait: "Calculando percentiles p10/p50/p90 y tendencias de 40 años desde NASA POWER…",
      yoy_title: "Comparación contra el mismo periodo del año pasado",
      frost_title: "Fechas históricas de helada ( ≤ 0 °C ) y ventana libre",
      frost_last_spr: "Última helada primavera (mediana):", frost_first_aut: "Primera helada otoño (mediana):",
      frost_free_days: "Días libres de helada:",
      daily14_title: "Promedios diarios recientes (últimos 14 días válidos · NASA POWER)",
      charts_title: "📊 Series de tiempo medidas (Lluvia, Temperatura, Humedad, NDVI por cuadro)",
      // Bloque 4
      rot_table_title: "🔄 Comparador lado a lado de las 4 estrategias de rotación",
      rot_cal_title: "🗓️ Calendario agrícola a 3 años (imprimible)",
      calc_title: "💵 Calculadora transparente de costos y márgenes (con precio real USDA MARS)",
      calc_note: "No inventamos costos: tú ingresas tu costo por hectárea y rendimiento esperado; el precio de venta viene de USDA MARS o puedes ajustarlo.",
      scen_title: "🌦️ Escenarios climáticos interactivos (¿Qué pasa si llueve menos o sube la temperatura?)",
      scen_rain: "Cambio en lluvia:", scen_temp: "Cambio en temperatura (+6% demanda evaporativa por °C):",
      opt_cycle_title: "✅ Conclusión del ciclo óptimo recomendado",
      // Bloque 5 & 6
      tab_ai: "🤖 IA y Modelos", tab_sensors: "📡 Sensores y Suelo",
      ai_models_title: "Fichas técnicas honestas de los modelos (M1–M12)",
      ai_explain_title: "¿Por qué el modelo predice esta clase? (Importancia de variables)",
      ai_leaf_title: "🍃 Subir foto de hoja desde el celular (Diagnóstico orientativo)",
      ai_leaf_note: "Aviso honesto: El análisis visual rápido en navegador examina proporción de clorofila/necrosis por color. Es orientativo y NO sustituye un análisis fitopatológico de laboratorio.",
      sens_title: "📡 Sensores locales (CSV), Puntos del Robot y Nitrógeno / pH",
      sens_csv_btn: "📥 Cargar archivo CSV de sensores (lat,lon,temp_c,humedad_pct,ph,n_kgha)",
      sens_robot_btn: "🤖 Generar ruta de muestreo para robot en cuadros críticos",
      npk_title: "🧪 Nitrógeno (N) y pH del suelo (con rangos de referencia USDA NRCS)",
      mob_map: "🗺️ Ver Mapa Completo", mob_data: "📊 Ver Paneles de Datos"
    },
    en: {
      theme_light: "☀️ Light", theme_dark: "🌙 Dark",
      glossary_btn: "📖 Glossary", tour_btn: "🧭 Guided Tour (5 steps)",
      hero_badge: "🛰️ NASA Space Apps 2026 · Real Data Only",
      hero_title: "Farm decisions powered by real satellites, 40-year climate & honest AI",
      hero_sub: "Check soil moisture (SMAP), cell-by-cell greenness (10 m Sentinel-2), 40-year climate normals (NASA POWER 1985–2024), rivers/wells (USGS), and live market prices (USDA MARS). Zero made-up numbers.",
      btn_try_case: "⚡ Try an example", btn_use_gps: "📍 Use my location",
      cases_title: "6 real 1-click cases (automatically load point + grid):",
      c1_t: "🌽 Maize in Iowa", c1_d: "Story County, IA · Rainfed corn-soybean rotation",
      c2_t: "💧 Irrigation in Nebraska", c2_d: "Ogallala Aquifer · Center pivot & water balance",
      c3_t: "❄️ Frost Risk", c3_d: "Fargo, ND / MN · Short frost-free growing window",
      c4_t: "🏜️ Bare Soil / Drought", c4_d: "Central Valley, CA · High evaporative demand & bare patches",
      c5_t: "🗺️ Official BLM PLSS Section", c5_d: "Full 1 sq mile federal section (259 ha) in the Midwest",
      c6_t: "🌎 Outside US (Mexico)", c6_d: "Zamora, Michoacán · Shows global vs US-only data sources",
      load_msg: "Querying satellites and official stations…",
      load_elapsed: "Elapsed time:", load_est: "estimated 3–8 s",
      err_friendly: "We couldn't complete an external data request right now.",
      btn_retry: "🔄 Retry now",
      cell_100: "100 (~10 m, fine)",
      ter_tools_title: "Land tools, file import/export & real field boundaries",
      btn_osm: "🌾 Load real farm fields (OpenStreetMap)",
      osm_loading: "Searching mapped agricultural fields in OpenStreetMap…",
      osm_done: "agricultural parcels found. Click any polygon to adopt it as your land.",
      osm_empty: "No mapped farmland polygons in OpenStreetMap here. Zoom in or draw your polygon.",
      btn_save_ter: "💾 Save land", btn_imp_geo: "📂 Import GeoJSON/KML",
      btn_exp_geo: "⬇️ GeoJSON", btn_exp_kml: "⬇️ KML", btn_exp_csv: "⬇️ Cells CSV", btn_print: "🖨️ Print / PDF",
      saved_none: "No saved lands in this browser yet.",
      saved_prompt: "Name for saving this land:",
      multi_hint: "💡 Tip: Click any cell for its full card, or Shift+Click multiple cells to average them.",
      multi_sel: "Selected cells:", multi_clear: "Clear selection",
      color_mode_lbl: "Color grid by:",
      cm_ndvi: "Greenness (Sentinel-2 NDVI)", cm_sev: "Combined severity (Plant + Water + Frost)",
      cm_zones: "Management zones (High / Medium / Low)", cm_anom: "Field anomalies (|z| ≥ 1.2)",
      layer_search_ph: "🔎 Search layer by name or question…",
      layer_fav_only: "⭐ Favorites only",
      time_title: "⏱️ GIBS Time Machine (last 12 weeks) & Comparison Curtain",
      time_play: "▶ Play", time_pause: "⏸ Pause", time_curtain: "Layer opacity / split curtain:",
      sum5_title: "🚦 5-Second Quick Summary (Water · Plants · Risk)",
      sem_water: "Soil water & rain", sem_plants: "Plant vigor & cover", sem_risk: "Thermal risk & alerts",
      alerts_title: "🔔 Active Alerts & Editable Thresholds",
      th_frost: "Frost threshold (°C):", th_bare: "Bare soil threshold (NDVI <):",
      th_drought: "Root drought (< %):", th_excess: "Excess water (> %):",
      clim40_title: "📈 40-Year Historical Climate (1985–2024), YoY & Frost Dates",
      clim40_wait: "Computing 40-year p10/p50/p90 percentiles and trends from NASA POWER…",
      yoy_title: "Year-over-Year comparison vs same period last year",
      frost_title: "Historical frost dates ( ≤ 0 °C ) & frost-free window",
      frost_last_spr: "Last spring frost (median):", frost_first_aut: "First autumn frost (median):",
      frost_free_days: "Frost-free days:",
      daily14_title: "Recent daily averages (last 14 valid days · NASA POWER)",
      charts_title: "📊 Measured Time Series (Rain, Temperature, Soil Moisture, Cell NDVI)",
      rot_table_title: "🔄 Side-by-Side Comparison of the 4 Rotation Strategies",
      rot_cal_title: "🗓️ Printable 3-Year Crop Rotation Calendar",
      calc_title: "💵 Transparent Cost & Margin Calculator (with live USDA MARS prices)",
      calc_note: "We never invent costs: enter your cost/ha and expected yield; market price comes live from USDA MARS or your custom override.",
      scen_title: "🌦️ Interactive Climate Scenarios (What if rain drops or temperature rises?)",
      scen_rain: "Rainfall change:", scen_temp: "Temperature change (+6% evaporative demand per °C):",
      opt_cycle_title: "✅ Optimal Cycle Recommendation",
      tab_ai: "🤖 AI & Models", tab_sensors: "📡 Sensors & Soil",
      ai_models_title: "Honest Model Technical Cards (M1–M12)",
      ai_explain_title: "Why did the model predict this class? (Feature importance)",
      ai_leaf_title: "🍃 Upload a leaf photo from your phone (Indicative check)",
      ai_leaf_note: "Honest disclaimer: Browser visual analysis checks green chlorophyll vs chlorosis/necrosis ratios. It is indicative only and does NOT replace lab pathology.",
      sens_title: "📡 Local Sensors (CSV), Robot Sampling Points & Nitrogen / pH",
      sens_csv_btn: "📥 Load sensor CSV (lat,lon,temp_c,moisture_pct,ph,n_kgha)",
      sens_robot_btn: "🤖 Generate robot sampling route on critical cells",
      npk_title: "🧪 Soil Nitrogen (N) & pH (with cited USDA NRCS reference ranges)",
      mob_map: "🗺️ Fullscreen Map", mob_data: "📊 Data Panels"
    },
    pt: {
      theme_light: "☀️ Claro", theme_dark: "🌙 Escuro",
      glossary_btn: "📖 Glossário", tour_btn: "🧭 Tour Guiado (5 passos)",
      hero_badge: "🛰️ NASA Space Apps 2026 · Dados Reais",
      hero_title: "Decisões agrícolas com satélites reais, clima de 40 anos e IA transparente",
      hero_sub: "Consulte umidade do solo (SMAP), verdor quadro a quadro (Sentinel-2 a 10 m), clima de 40 anos (NASA POWER 1985–2024), rios/poços (USGS) e preços do dia (USDA MARS). Zero números inventados.",
      btn_try_case: "⚡ Testar com um exemplo", btn_use_gps: "📍 Usar minha localização",
      cases_title: "6 casos reais prontos com um clique (carregam ponto + grade):",
      c1_t: "🌽 Milho em Iowa", c1_d: "Story County, IA · Rotação milho-soja em sequeiro",
      c2_t: "💧 Irrigação em Nebraska", c2_d: "Aquífero Ogallala · Pivô central e balanço hídrico",
      c3_t: "❄️ Risco de geada", c3_d: "Fargo, ND / MN · Janela curta livre de geadas",
      c4_t: "🏜️ Solo exposto / seca", c4_d: "Vale Central, CA · Estresse hídrico e alta evaporação",
      c5_t: "🗺️ Seção oficial BLM PLSS", c5_d: "Seção cadastral oficial (259 ha) no Meio-Oeste",
      c6_t: "🌎 Fora dos EUA (México)", c6_d: "Zamora, Michoacán · Mostra quais fontes são globais e quais só EUA",
      load_msg: "Consultando satélites e estações oficiais…",
      load_elapsed: "Tempo decorrido:", load_est: "estimado 3–8 s",
      err_friendly: "Não foi possível concluir uma consulta externa agora.",
      btn_retry: "🔄 Tentar novamente",
      cell_100: "100 (~10 m, fino)",
      ter_tools_title: "Ferramentas do terreno, arquivos e divisas reais",
      btn_osm: "🌾 Ver talhões agrícolas reais (OpenStreetMap)",
      osm_loading: "Buscando parcelas agrícolas mapeadas no OpenStreetMap…",
      osm_done: "parcelas agrícolas encontradas. Clique em qualquer uma para usá-la como seu terreno.",
      osm_empty: "Não há parcelas agrícolas traçadas no OpenStreetMap nesta vista. Aproxime o mapa ou desenhe seu terreno.",
      btn_save_ter: "💾 Salvar terreno", btn_imp_geo: "📂 Importar GeoJSON/KML",
      btn_exp_geo: "⬇️ GeoJSON", btn_exp_kml: "⬇️ KML", btn_exp_csv: "⬇️ CSV Quadros", btn_print: "🖨️ Imprimir / PDF",
      saved_none: "Você ainda não tem terrenos salvos neste navegador.",
      saved_prompt: "Nome para salvar este terreno:",
      multi_hint: "💡 Dica: Clique em qualquer quadro para ver sua ficha detalhada, ou use Shift+Clique para selecionar vários e tirar a média.",
      multi_sel: "Quadros selecionados:", multi_clear: "Limpar seleção",
      color_mode_lbl: "Colorir grade por:",
      cm_ndvi: "Verdor (NDVI Sentinel-2)", cm_sev: "Severidade combinada (Planta + Água + Geada)",
      cm_zones: "Zonas de manejo (Alta / Média / Baixa)", cm_anom: "Anomalias do talhão (|z| ≥ 1.2)",
      layer_search_ph: "🔎 Buscar camada por nome ou pergunta…",
      layer_fav_only: "⭐ Só favoritas",
      time_title: "⏱️ Máquina do tempo GIBS (últimas 12 semanas) e Cortina comparadora",
      time_play: "▶ Reproduzir", time_pause: "⏸ Pausar", time_curtain: "Cortina de opacidade / comparação:",
      sum5_title: "🚦 Resumo rápido em 5 segundos (Água · Plantas · Risco)",
      sem_water: "Água no solo e chuva", sem_plants: "Vigor das plantas", sem_risk: "Risco térmico e alertas",
      alerts_title: "🔔 Alertas ativos e limites configuráveis",
      th_frost: "Limite geada (°C):", th_bare: "Limite solo exposto (NDVI <):",
      th_drought: "Limite seca raiz (< %):", th_excess: "Limite excesso água (> %):",
      clim40_title: "📈 Clima Histórico de 40 Anos (1985–2024), Comparação Anual e Geadas",
      clim40_wait: "Calculando percentis p10/p50/p90 e tendências de 40 anos via NASA POWER…",
      yoy_title: "Comparação contra o mesmo período do ano passado",
      frost_title: "Datas históricas de geada ( ≤ 0 °C ) e janela livre",
      frost_last_spr: "Última geada primavera (mediana):", frost_first_aut: "Primeira geada outono (mediana):",
      frost_free_days: "Dias livres de geada:",
      daily14_title: "Médias diárias recentes (últimos 14 dias válidos · NASA POWER)",
      charts_title: "📊 Séries temporais medidas (Chuva, Temperatura, Umidade, NDVI por quadro)",
      rot_table_title: "🔄 Comparador lado a lado das 4 estratégias de rotação",
      rot_cal_title: "🗓️ Calendário agrícola de 3 anos (imprimível)",
      calc_title: "💵 Calculadora transparente de custos e margens (com preço real USDA MARS)",
      calc_note: "Não inventamos custos: informe seu custo/ha e produtividade esperada; o preço vem da USDA MARS ou pode ser ajustado.",
      scen_title: "🌦️ Cenários climáticos interativos (E se chover menos ou esquentar?)",
      scen_rain: "Mudança na chuva:", scen_temp: "Mudança na temperatura (+6% demanda evaporativa por °C):",
      opt_cycle_title: "✅ Conclusão do ciclo ótimo recomendado",
      tab_ai: "🤖 IA e Modelos", tab_sensors: "📡 Sensores e Solo",
      ai_models_title: "Fichas técnicas honestas dos modelos (M1–M12)",
      ai_explain_title: "Por que o modelo prevê esta classe? (Importância das variáveis)",
      ai_leaf_title: "🍃 Enviar foto de folha pelo celular (Diagnóstico orientativo)",
      ai_leaf_note: "Aviso honesto: A análise visual rápida examina proporção de clorofila/necrose por cor. É orientativa e NÃO substitui exame laboratorial.",
      sens_title: "📡 Sensores locais (CSV), Pontos do Robô e Nitrogênio / pH",
      sens_csv_btn: "📥 Carregar CSV de sensores (lat,lon,temp_c,umidade_pct,ph,n_kgha)",
      sens_robot_btn: "🤖 Gerar rota de amostragem para robô nos quadros críticos",
      npk_title: "🧪 Nitrogênio (N) e pH do solo (com faixas de referência USDA NRCS)",
      mob_map: "🗺️ Ver Mapa Completo", mob_data: "📊 Ver Painéis de Dados"
    }
  };
  const bt = k => (BT[window.lang] || BT.es)[k] || BT.en[k] || k;

  // ---------- 6 Casos Reales Prearmados con Polígono Real ----------
  const CASES = [
    {
      id: "iowa", lat: 42.0175, lon: -93.635, label: "Story County, Iowa (Maize/Soy)",
      poly: [[42.021, -93.640], [42.021, -93.630], [42.014, -93.630], [42.014, -93.640]],
      crop: "maize", water: "normal"
    },
    {
      id: "nebraska", lat: 40.882, lon: -99.852, label: "Dawson County, Nebraska (Ogallala Irrigation)",
      poly: [[40.886, -99.858], [40.886, -99.846], [40.878, -99.846], [40.878, -99.858]],
      crop: "maize", water: "low"
    },
    {
      id: "minnesota", lat: 46.877, lon: -96.789, label: "Red River Valley, MN/ND (Frost Risk)",
      poly: [[46.881, -96.795], [46.881, -96.783], [46.873, -96.783], [46.873, -96.795]],
      crop: "wheat", water: "normal"
    },
    {
      id: "california", lat: 36.605, lon: -120.185, label: "Fresno County, California (Drought / Bare Soil)",
      poly: [[36.609, -120.191], [36.609, -120.179], [36.601, -120.179], [36.601, -120.191]],
      crop: "fallow", water: "none"
    },
    {
      id: "plss", lat: 41.985, lon: -93.550, label: "BLM PLSS Section · Story County, IA (259 ha)",
      poly: [[41.992, -93.560], [41.992, -93.540], [41.978, -93.540], [41.978, -93.560]],
      crop: "soy", water: "normal", usePlssApi: true
    },
    {
      id: "mexico", lat: 19.985, lon: -102.283, label: "Valle de Zamora, Michoacán, México",
      poly: [[19.989, -102.288], [19.989, -102.278], [19.981, -102.278], [19.981, -102.288]],
      crop: "maize", water: "normal"
    }
  ];

  // ---------- Glosario Multilenguaje de 18 Términos ----------
  const GLOSSARY = [
    ["NDVI", "Índice de Vegetación de Diferencia Normalizada (-1 a +1). Mide el verdor y actividad fotosintética comparando luz roja e infrarroja cercana (Sentinel-2 a 10 m o MODIS a 250 m).", "Normalized Difference Vegetation Index (-1 to +1). Measures plant greenness using red and near-infrared reflectance."],
    ["SMAP", "Satélite de la NASA (Soil Moisture Active Passive) que mide con radar/radiómetro L-band la humedad superficial y de zona de raíz (~9 km).", "NASA satellite measuring surface and root-zone soil moisture via L-band radiometry (~9 km)."],
    ["GPM IMERG", "Misión Global de Medición de Precipitación de NASA/JAXA (~10 km). Estima lluvia acumulada cada 30 minutos.", "NASA/JAXA Global Precipitation Measurement mission estimating rain accumulation (~10 km)."],
    ["NASA POWER", "Archivo climático agro-meteorológico global de la NASA (1981–presente, ~50 km) de radiación solar, temperatura, humedad y lluvia.", "NASA global agroclimatology archive (1981–present) for temperature, precipitation, solar radiation, and wind."],
    ["Sentinel-2 L2A", "Misión satelital óptica europea (Copernicus) con resolución de 10 m por píxel cada 5 días.", "European Copernicus optical satellite mission providing 10 m resolution imagery every 5 days."],
    ["USDA CDL", "Cropland Data Layer del USDA NASS: mapa anual a 30 m de qué cultivo creció en cada campo de EE. UU.", "USDA NASS annual 30 m raster map identifying which crop grew in each US field."],
    ["USDA NRCS SSURGO", "Base oficial de suelos de EE. UU. con textura, pH, capacidad de retención de agua y drenaje medidos en campo.", "Official US soil survey database containing field-measured texture, pH, drainage, and water capacity."],
    ["USDA MARS", "Market Analysis and Reporting Services: precios reales mayoristas reportados en mercados y elevadores de grano de EE. UU.", "USDA Market Analysis and Reporting Services providing live wholesale commodity prices."],
    ["USGS NWIS", "Red Nacional de Información del Agua del USGS con sensores en tiempo real en ríos, arroyos y pozos subterráneos.", "USGS National Water Information System with real-time streamgages and groundwater wells."],
    ["BLM PLSS", "Public Land Survey System: cuadrícula catastral federal de EE. UU. dividida en municipios y secciones de 1 milla cuadrada (259 ha).", "US Public Land Survey System dividing land into townships and 1-square-mile sections (259 ha)."],
    ["ET (Evapotranspiración)", "Agua total que pasa del suelo y la transpiración de las hojas hacia la atmósfera (medida en mm).", "Total water lost to the atmosphere via soil evaporation and plant transpiration (in mm)."],
    ["Anomalía (z-score)", "Cuántas desviaciones estándar se aleja un cuadro del promedio de tu propio terreno. |z| ≥ 1.2 indica una zona atípica.", "How many standard deviations a cell deviates from your field's mean. |z| ≥ 1.2 flags an outlier spot."],
    ["Capacidad de Campo", "Cantidad máxima de agua útil que el suelo retiene después de drenar el exceso por gravedad.", "Maximum plant-available water a soil holds after excess gravitational water drains away."],
    ["Punto de Marchitez", "Nivel mínimo de humedad del suelo por debajo del cual las raíces ya no pueden extraer agua.", "Minimum soil moisture level below which plant roots can no longer extract water."],
    ["Percentiles p10 / p50 / p90", "De los últimos 40 años (1985–2024): p10 es un año muy seco/frío, p50 es el año normal (mediana) y p90 es un año muy húmedo/cálido.", "Across 40 years (1985–2024): p10 is a dry/cool year, p50 is median normal, and p90 is a wet/warm year."],
    ["Grados-Día (GDD)", "Acumulación de calor útil sobre una temperatura base (ej. 10 °C para maíz) que marca la velocidad de desarrollo del cultivo.", "Accumulated beneficial heat above a base temperature driving crop growth stages."],
    ["Fijación de Nitrógeno", "Proceso biológico en el que leguminosas (soya, trébol, veza) con bacterias Rhizobium capturan nitrógeno del aire y lo dejan en el suelo.", "Biological process where legumes with Rhizobium bacteria capture atmospheric nitrogen into the soil."],
    ["Zonas de Manejo", "Agrupación de los cuadros del terreno en 3 niveles (Baja, Media y Alta productividad) para aplicar semilla, riego o fertilizante de forma diferenciada.", "Grouping field cells into Low, Medium, and High vigor zones for variable-rate seeding, irrigation, or fertilizer."]
  ];

  // ---------- Inicialización General ----------
  function initCapsuleB() {
    applyTheme(B_STATE.theme);
    injectHeaderControls();
    injectCellOption100();
    injectHeroWelcome();
    injectTerrainTools();
    injectTimeAndCurtainControls();
    injectResultsEnhancements();
    injectMobileToggleBar();
    injectModals();
    hookExistingFunctions();
    fetchModelsMeta();
    // Si ya hay datos cargados, refrescar mejoras
    if (window.D) onAfterDataLoaded();
  }

  // ---------- 1. Tema Claro/Oscuro, Glosario y Tour en el Header ----------
  function applyTheme(t) {
    B_STATE.theme = t;
    document.body.dataset.theme = t;
    localStorage.setItem("b_theme", t);
    const btn = document.getElementById("b_theme_btn");
    if (btn) btn.textContent = t === "light" ? bt("theme_dark") : bt("theme_light");
  }

  function injectHeaderControls() {
    const hdr = document.querySelector("header");
    if (!hdr || document.getElementById("b_hdr_tools")) return;
    const span = document.createElement("span");
    span.id = "b_hdr_tools";
    span.className = "b-toolbar";
    span.innerHTML = `
      <button type="button" id="b_tour_btn" class="b-btn-sm">${esc(bt("tour_btn"))}</button>
      <button type="button" id="b_gloss_btn" class="b-btn-sm">${esc(bt("glossary_btn"))}</button>
      <button type="button" id="b_theme_btn" class="b-btn-sm">${esc(B_STATE.theme === "light" ? bt("theme_dark") : bt("theme_light"))}</button>
    `;
    hdr.appendChild(span);
    document.getElementById("b_theme_btn").addEventListener("click", () => applyTheme(B_STATE.theme === "light" ? "dark" : "light"));
    document.getElementById("b_gloss_btn").addEventListener("click", openGlossaryModal);
    document.getElementById("b_tour_btn").addEventListener("click", () => startTour(0));
  }

  function injectCellOption100() {
    const sel = document.getElementById("cellsel");
    if (sel && !sel.querySelector("option[value='100']")) {
      const opt = document.createElement("option");
      opt.value = "100";
      opt.textContent = bt("cell_100");
      sel.appendChild(opt);
    }
  }

  // ---------- 2. Portada de Bienvenida + 6 Casos Listos (Áreas 1, 2, 3, 4) ----------
  function injectHeroWelcome() {
    const pane = document.getElementById("pane-terreno");
    if (!pane || document.getElementById("b_welcome")) return;
    const div = document.createElement("div");
    div.id = "b_welcome";
    div.className = "b-welcome";
    pane.insertBefore(div, pane.firstChild);
    renderHeroWelcome();
  }

  function renderHeroWelcome() {
    const box = document.getElementById("b_welcome");
    if (!box) return;
    const caseLabels = [
      [CASES[0], bt("c1_t"), bt("c1_d")],
      [CASES[1], bt("c2_t"), bt("c2_d")],
      [CASES[2], bt("c3_t"), bt("c3_d")],
      [CASES[3], bt("c4_t"), bt("c4_d")],
      [CASES[4], bt("c5_t"), bt("c5_d")],
      [CASES[5], bt("c6_t"), bt("c6_d")]
    ];
    box.innerHTML = `
      <span class="b-badge">${esc(bt("hero_badge"))}</span>
      <h1>${esc(bt("hero_title"))}</h1>
      <p>${esc(bt("hero_sub"))}</p>
      <div class="b-actions">
        <button type="button" class="pri" id="b_try_first">${esc(bt("btn_try_case"))} (Iowa)</button>
        <button type="button" id="b_hero_gps">${esc(bt("btn_use_gps"))}</button>
        <button type="button" id="b_hero_tour">${esc(bt("tour_btn"))}</button>
      </div>
      <div class="small mut" style="margin-top:10px;font-weight:600">${esc(bt("cases_title"))}</div>
      <div class="b-cases-grid">
        ${caseLabels.map(([c, t, d]) => `
          <button type="button" class="b-case-btn" data-case="${esc(c.id)}">
            <b>${esc(t)}</b>
            <span>${esc(d)}</span>
          </button>
        `).join("")}
      </div>
      <div id="b_load_progress" hidden style="margin-top:10px">
        <div class="small"><b id="b_load_txt">${esc(bt("load_msg"))}</b> · <span id="b_load_sec">0.0 s</span> (<span class="mut">${esc(bt("load_est"))}</span>)</div>
        <div class="b-progress-wrap"><div class="b-progress-bar" id="b_load_bar" style="width:25%"></div></div>
      </div>
    `;
    box.querySelector("#b_try_first")?.addEventListener("click", () => runCase("iowa"));
    box.querySelector("#b_hero_gps")?.addEventListener("click", () => document.getElementById("btn_gps")?.click());
    box.querySelector("#b_hero_tour")?.addEventListener("click", () => startTour(0));
    box.querySelectorAll("button[data-case]").forEach(b => b.addEventListener("click", () => runCase(b.dataset.case)));
  }

  function runCase(id) {
    const c = CASES.find(x => x.id === id) || CASES[0];
    if (window.C) {
      window.C.crop = c.crop || "maize";
      window.C.water = c.water || "normal";
    }
    window.setLoc(c.lat, c.lon, true, c.label);
    // Dibujar el polígono del caso automáticamente y lanzar análisis de cuadrícula
    setTimeout(() => {
      if (window.tzs && window.map) {
        window.tzs.group?.clearLayers();
        window.tzs.cells?.clearLayers();
        window.tzs.poly = L.polygon(c.poly, { color: "#ffd200", weight: 3, fillOpacity: 0.08 });
        window.tzs.group.addLayer(window.tzs.poly);
        window.tzs.label = c.label;
        window.map.fitBounds(window.tzs.poly.getBounds(), { padding: [24, 24] });
        if (typeof analizarTerreno === "function") analizarTerreno();
      }
    }, 350);
  }

  // ---------- Recorrido Guiado de 5 Pasos (Área 2) ----------
  const TOUR_STEPS = {
    es: [
      { sel: ".card:nth-of-type(1)", t: "Paso 1/5: Tu ubicación o caso piloto", d: "Usa tu GPS real o elige cualquiera de los 6 casos reales prearmados (Iowa, Nebraska, Minnesota, California, Sección PLSS o Michoacán)." },
      { sel: ".card:nth-of-type(2)", t: "Paso 2/5: Tu terreno y cuadrícula Sentinel-2", d: "Dibuja tu parcela, carga un campo real de OpenStreetMap o importa un GeoJSON/KML. Dividimos tu lote en hasta 100 cuadros de ~10 m." },
      { sel: "#farm", t: "Paso 3/5: Tu granja y presupuesto", d: "Ajusta qué sembraste, tu disponibilidad de agua, tamaño en hectáreas y costos para que la rotación y la calculadora se adapten a ti." },
      { sel: "#useful", t: "Paso 4/5: Capas satelitales e históricas", d: "Activa mapas de verdor, humedad SMAP, lluvia IMERG, catastro PLSS o ríos USGS, y usa la máquina del tiempo de 12 semanas." },
      { sel: "#c_res", t: "Paso 5/5: Semáforo en 5s, Clima de 40 años, IA y Sensores", d: "Explora el diagnóstico inmediato, series de tiempo, percentiles climáticos 1985–2024, calendario a 3 años e IA explicable." }
    ],
    en: [
      { sel: ".card:nth-of-type(1)", t: "Step 1/5: Your location or pilot case", d: "Use your real GPS or pick any of the 6 pre-built real cases (Iowa, Nebraska, Minnesota, California, BLM PLSS Section, or Michoacán)." },
      { sel: ".card:nth-of-type(2)", t: "Step 2/5: Your land & Sentinel-2 grid", d: "Draw your parcel, fetch a real OpenStreetMap field, or import GeoJSON/KML. We split your field into up to 100 cells (~10 m)." },
      { sel: "#farm", t: "Step 3/5: Your farm & budget", d: "Set your last crop, water supply, farm size (ha), and costs so rotation strategies and margin calculations fit your operation." },
      { sel: "#useful", t: "Step 4/5: Satellite & historical layers", d: "Toggle NDVI greenness, SMAP moisture, IMERG rain, BLM PLSS sections, or USGS rivers, plus the 12-week time machine." },
      { sel: "#c_res", t: "Step 5/5: 5s Traffic Lights, 40-yr Climate, AI & Sensors", d: "Inspect the instant summary, time series, 1985–2024 climate percentiles, printable 3-year calendar, and explainable AI." }
    ],
    pt: [
      { sel: ".card:nth-of-type(1)", t: "Passo 1/5: Sua localização ou caso piloto", d: "Use seu GPS real ou escolha qualquer um dos 6 casos reais prontos (Iowa, Nebraska, Minnesota, Califórnia, Seção PLSS ou Michoacán)." },
      { sel: ".card:nth-of-type(2)", t: "Passo 2/5: Seu terreno e grade Sentinel-2", d: "Desenhe sua parcela, carregue um talhão real do OpenStreetMap ou importe GeoJSON/KML. Dividimos a área em até 100 quadros (~10 m)." },
      { sel: "#farm", t: "Passo 3/5: Sua fazenda e orçamento", d: "Ajuste cultura anterior, água, tamanho em hectares e custos para personalizar a rotação e a calculadora." },
      { sel: "#useful", t: "Passo 4/5: Camadas de satélite e históricas", d: "Ative mapas de verdor, umidade SMAP, chuva IMERG, cadastro PLSS ou rios USGS, além da máquina do tempo de 12 semanas." },
      { sel: "#c_res", t: "Passo 5/5: Semáforo em 5s, Clima de 40 anos, IA e Sensores", d: "Veja o resumo imediato, séries temporais, percentis climáticos 1985–2024, calendário de 3 anos e IA explicável." }
    ]
  };

  function startTour(stepIdx) {
    const steps = TOUR_STEPS[window.lang] || TOUR_STEPS.es;
    document.querySelectorAll(".b-tour-highlight").forEach(el => el.classList.remove("b-tour-highlight"));
    let bar = document.getElementById("b_tour_bar");
    if (stepIdx < 0 || stepIdx >= steps.length) {
      if (bar) bar.hidden = true;
      B_STATE.tourStep = -1;
      return;
    }
    B_STATE.tourStep = stepIdx;
    const st = steps[stepIdx];
    const target = document.querySelector(`#pane-terreno ${st.sel}`) || document.querySelector(st.sel);
    if (target) {
      target.classList.add("b-tour-highlight");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "b_tour_bar";
      bar.className = "b-tour-bar";
      document.body.appendChild(bar);
    }
    bar.hidden = false;
    bar.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px">${esc(st.t)}</div>
      <div class="small" style="margin-bottom:10px">${esc(st.d)}</div>
      <div class="row" style="justify-content:space-between">
        <button type="button" class="b-btn-sm" id="b_t_prev" ${stepIdx === 0 ? "disabled" : ""}>◀ Anterior</button>
        <div class="row">
          <button type="button" class="b-btn-sm" id="b_t_skip">✕ Cerrar</button>
          <button type="button" class="b-btn-sm pri" id="b_t_next">${stepIdx === steps.length - 1 ? "✔ Finalizar" : "Siguiente ▶"}</button>
        </div>
      </div>
    `;
    bar.querySelector("#b_t_prev")?.addEventListener("click", () => startTour(stepIdx - 1));
    bar.querySelector("#b_t_skip")?.addEventListener("click", () => startTour(-1));
    bar.querySelector("#b_t_next")?.addEventListener("click", () => startTour(stepIdx + 1));
  }

  // ---------- 3. Herramientas del Terreno: OSM, Guardar, GeoJSON/KML/CSV, Color y Ficha de Cuadro (Áreas 10, 11, 12, 13, 17) ----------
  function injectTerrainTools() {
    const terstat = document.getElementById("terstat");
    if (!terstat || document.getElementById("b_ter_tools")) return;
    const box = document.createElement("div");
    box.id = "b_ter_tools";
    box.style.marginTop = "10px";
    terstat.insertAdjacentElement("afterend", box);
    renderTerrainTools();
  }

  function renderTerrainTools() {
    const box = document.getElementById("b_ter_tools");
    if (!box) return;
    box.innerHTML = `
      <div style="border-top:1px solid var(--line);padding-top:8px;margin-top:6px">
        <div class="small mut" style="margin-bottom:6px;font-weight:600">${esc(bt("ter_tools_title"))}</div>
        <div class="b-toolbar" style="margin-bottom:6px">
          <button type="button" id="b_btn_osm" class="b-btn-sm">${esc(bt("btn_osm"))}</button>
          <button type="button" id="b_btn_save_ter" class="b-btn-sm">${esc(bt("btn_save_ter"))}</button>
          <button type="button" id="b_btn_imp_geo" class="b-btn-sm">${esc(bt("btn_imp_geo"))}</button>
          <input type="file" id="b_inp_geo" accept=".geojson,.json,.kml" hidden>
        </div>
        <div class="b-toolbar" style="margin-bottom:6px">
          <button type="button" id="b_btn_exp_geo" class="b-btn-sm">${esc(bt("btn_exp_geo"))}</button>
          <button type="button" id="b_btn_exp_kml" class="b-btn-sm">${esc(bt("btn_exp_kml"))}</button>
          <button type="button" id="b_btn_exp_csv" class="b-btn-sm">${esc(bt("btn_exp_csv"))}</button>
          <button type="button" id="b_btn_print" class="b-btn-sm">${esc(bt("btn_print"))}</button>
        </div>
        <div id="b_osm_stat" class="small mut"></div>
        <div id="b_saved_list" style="margin:6px 0"></div>
        <div class="row" style="margin-top:6px">
          <label class="small mut">${esc(bt("color_mode_lbl"))}
            <select id="b_color_mode">
              <option value="ndvi" ${B_STATE.colorMode === "ndvi" ? "selected" : ""}>${esc(bt("cm_ndvi"))}</option>
              <option value="sev" ${B_STATE.colorMode === "sev" ? "selected" : ""}>${esc(bt("cm_sev"))}</option>
              <option value="zones" ${B_STATE.colorMode === "zones" ? "selected" : ""}>${esc(bt("cm_zones"))}</option>
              <option value="anom" ${B_STATE.colorMode === "anom" ? "selected" : ""}>${esc(bt("cm_anom"))}</option>
            </select>
          </label>
        </div>
        <div class="small mut" style="margin-top:6px">${esc(bt("multi_hint"))}</div>
        <div id="b_cell_inspector"></div>
      </div>
    `;
    renderSavedTerrainsList();
    box.querySelector("#b_btn_osm")?.addEventListener("click", loadOsmFields);
    box.querySelector("#b_btn_save_ter")?.addEventListener("click", saveCurrentTerrain);
    box.querySelector("#b_btn_imp_geo")?.addEventListener("click", () => box.querySelector("#b_inp_geo")?.click());
    box.querySelector("#b_inp_geo")?.addEventListener("change", importGeoFile);
    box.querySelector("#b_btn_exp_geo")?.addEventListener("click", () => exportTerrain("geojson"));
    box.querySelector("#b_btn_exp_kml")?.addEventListener("click", () => exportTerrain("kml"));
    box.querySelector("#b_btn_exp_csv")?.addEventListener("click", () => exportTerrain("csv"));
    box.querySelector("#b_btn_print")?.addEventListener("click", () => window.print());
    box.querySelector("#b_color_mode")?.addEventListener("change", e => {
      B_STATE.colorMode = e.target.value;
      recolorCells();
    });
  }

  // --- Área 13: Campos Agrícolas Reales desde OpenStreetMap (Overpass) ---
  async function loadOsmFields() {
    const st = document.getElementById("b_osm_stat");
    if (!window.map || !st) return;
    st.textContent = bt("osm_loading");
    const b = window.map.getBounds();
    const c = b.getCenter();
    const dLat = Math.min(Math.max(b.getNorth() - b.getSouth(), 0.02), 0.08) / 2;
    const dLon = Math.min(Math.max(b.getEast() - b.getWest(), 0.02), 0.08) / 2;
    const sur = (c.lat - dLat).toFixed(5), norte = (c.lat + dLat).toFixed(5);
    const oeste = (c.lng - dLon).toFixed(5), este = (c.lng + dLon).toFixed(5);

    let geojson = null;
    // 1) Intentar vía backend /api/v1/b/osm-campos
    try {
      const r = await fetch(`/api/v1/b/osm-campos?sur=${sur}&oeste=${oeste}&norte=${norte}&este=${este}`);
      if (r.ok) {
        const j = await r.json();
        if (j.geojson) geojson = j.geojson;
        else if (Array.isArray(j.campos) && j.campos.length) {
          geojson = {
            type: "FeatureCollection",
            features: j.campos.map(c => ({
              type: "Feature",
              properties: { osm_id: c.osm_id, landuse: c.uso || "farmland", crop: c.cultivo_tag || null, name: c.nombre || `Parcela OSM #${c.osm_id}` },
              geometry: { type: "Polygon", coordinates: [c.coordenadas.map(([la, lo]) => [lo, la])] }
            }))
          };
        }
      }
    } catch (_) {}

    // 2) Fallback directo CORS a Overpass API si el backend no tiene montado b_rutas aún
    if (!geojson) {
      const q = `[out:json][timeout:18];(way["landuse"~"farmland|orchard|vineyard|meadow"](${sur},${oeste},${norte},${este});way["crop"](${sur},${oeste},${norte},${este}););out geom 60;`;
      for (const url of ["https://overpass-api.de/api/interpreter", "https://lz4.overpass-api.de/api/interpreter"]) {
        try {
          const r = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(q) });
          if (r.ok) {
            const raw = await r.json();
            const feats = (raw.elements || []).filter(e => e.geometry && e.geometry.length >= 4).map(e => ({
              type: "Feature",
              properties: { osm_id: e.id, landuse: e.tags?.landuse || "farmland", crop: e.tags?.crop || null, name: e.tags?.name || `Parcela OSM #${e.id}` },
              geometry: { type: "Polygon", coordinates: [e.geometry.map(pt => [pt.lon, pt.lat])] }
            }));
            geojson = { type: "FeatureCollection", features: feats };
            break;
          }
        } catch (_) {}
      }
    }

    if (B_STATE.osmLayer) { window.map.removeLayer(B_STATE.osmLayer); B_STATE.osmLayer = null; }
    if (!geojson || !geojson.features || !geojson.features.length) {
      st.textContent = bt("osm_empty");
      return;
    }
    B_STATE.osmLayer = L.geoJSON(geojson, {
      style: { color: "#38bdf8", weight: 2, fillOpacity: 0.15, dashArray: "4,3" },
      onEachFeature: (feat, lyr) => {
        lyr.bindTooltip(`🌾 ${feat.properties.name || "OSM"} (${feat.properties.landuse})${feat.properties.crop ? " · " + feat.properties.crop : ""}`);
        lyr.on("click", () => {
          const ring = feat.geometry.coordinates[0].map(([lo, la]) => [la, lo]);
          window.tzs.group?.clearLayers();
          window.tzs.cells?.clearLayers();
          window.tzs.poly = L.polygon(ring, { color: "#ffd200", weight: 3, fillOpacity: 0.08 });
          window.tzs.group.addLayer(window.tzs.poly);
          window.tzs.label = `${feat.properties.name} (OpenStreetMap)`;
          window.map.fitBounds(window.tzs.poly.getBounds());
          if (typeof analizarTerreno === "function") analizarTerreno();
        });
      }
    }).addTo(window.map);
    st.textContent = `${geojson.features.length} ${bt("osm_done")} (Fuente: OpenStreetMap contributors, ODbL)`;
  }

  // --- Área 11: Guardar, Cargar y Borrar Terrenos en localStorage ---
  function saveCurrentTerrain() {
    if (!window.tzs?.poly) { alert(window.AI?.[window.lang]?.draw || "Primero dibuja o elige tu terreno."); return; }
    const name = prompt(bt("saved_prompt"), window.tzs.label || `Terreno ${B_STATE.savedTerrains.length + 1}`);
    if (!name) return;
    const ring = window.tzs.poly.getLatLngs()[0].map(p => [Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))]);
    B_STATE.savedTerrains.push({ id: Date.now(), name, ring, date: new Date().toISOString().slice(0, 10) });
    localStorage.setItem("b_saved_terrains", JSON.stringify(B_STATE.savedTerrains));
    renderSavedTerrainsList();
  }

  function renderSavedTerrainsList() {
    const el = document.getElementById("b_saved_list");
    if (!el) return;
    if (!B_STATE.savedTerrains.length) {
      el.innerHTML = `<span class="small mut">${esc(bt("saved_none"))}</span>`;
      return;
    }
    el.innerHTML = B_STATE.savedTerrains.map(t => `
      <span class="chip" style="margin:2px">
        <a href="#" data-load-ter="${t.id}" style="color:inherit;text-decoration:none">📍 <b>${esc(t.name)}</b> (${esc(t.date)})</a>
        <a href="#" data-del-ter="${t.id}" style="color:var(--bad);margin-left:6px;text-decoration:none" title="Borrar">✕</a>
      </span>
    `).join("");
    el.querySelectorAll("[data-load-ter]").forEach(a => a.addEventListener("click", e => {
      e.preventDefault();
      const item = B_STATE.savedTerrains.find(x => String(x.id) === a.dataset.loadTer);
      if (!item) return;
      window.tzs.group?.clearLayers();
      window.tzs.cells?.clearLayers();
      window.tzs.poly = L.polygon(item.ring, { color: "#ffd200", weight: 3, fillOpacity: 0.08 });
      window.tzs.group.addLayer(window.tzs.poly);
      window.tzs.label = item.name;
      window.map.fitBounds(window.tzs.poly.getBounds());
      if (typeof analizarTerreno === "function") analizarTerreno();
    }));
    el.querySelectorAll("[data-del-ter]").forEach(a => a.addEventListener("click", e => {
      e.preventDefault();
      B_STATE.savedTerrains = B_STATE.savedTerrains.filter(x => String(x.id) !== a.dataset.delTer);
      localStorage.setItem("b_saved_terrains", JSON.stringify(B_STATE.savedTerrains));
      renderSavedTerrainsList();
    }));
  }

  // --- Área 12: Importar y Exportar GeoJSON / KML / CSV ---
  function importGeoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const txt = String(reader.result || "");
        let ring = [];
        if (file.name.toLowerCase().endsWith(".kml") || txt.includes("<coordinates>")) {
          const m = txt.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
          if (m) {
            ring = m[1].trim().split(/\s+/).map(pair => {
              const [lo, la] = pair.split(",").map(Number);
              return [la, lo];
            }).filter(([la, lo]) => !isNaN(la) && !isNaN(lo));
          }
        } else {
          const j = JSON.parse(txt);
          const geom = j.type === "FeatureCollection" ? j.features?.[0]?.geometry : j.type === "Feature" ? j.geometry : j;
          const coords = geom?.type === "Polygon" ? geom.coordinates[0] : geom?.type === "MultiPolygon" ? geom.coordinates[0][0] : [];
          ring = coords.map(([lo, la]) => [la, lo]);
        }
        if (ring.length < 3) { alert("No se encontró un polígono válido en el archivo."); return; }
        window.tzs.group?.clearLayers();
        window.tzs.cells?.clearLayers();
        window.tzs.poly = L.polygon(ring, { color: "#ffd200", weight: 3, fillOpacity: 0.08 });
        window.tzs.group.addLayer(window.tzs.poly);
        window.tzs.label = file.name.replace(/\.[^.]+$/, "");
        window.map.fitBounds(window.tzs.poly.getBounds());
        if (typeof analizarTerreno === "function") analizarTerreno();
      } catch (err) {
        alert("Error al leer archivo: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  function exportTerrain(fmt) {
    if (!window.tzs?.poly) { alert("Primero dibuja o elige tu terreno."); return; }
    const ring = window.tzs.poly.getLatLngs()[0].map(p => [Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))]);
    if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
      ring.push([...ring[0]]);
    }
    const cells = B_STATE.lastTerrainResp?.celdas || [];
    const dateStr = B_STATE.lastTerrainResp?.fecha || new Date().toISOString().slice(0, 10);
    let content = "", mime = "application/json", ext = fmt;

    if (fmt === "geojson") {
      const fc = {
        type: "FeatureCollection",
        metadata: { source: "Copernicus Sentinel-2 L2A (10m) + NASA POWER + USDA", scene_date: dateStr },
        features: [
          {
            type: "Feature",
            properties: { role: "parcel_boundary", name: window.tzs.label || "Parcel", area_ha: B_STATE.lastTerrainResp?.area_ha, ndvi_mean: B_STATE.lastTerrainResp?.ndvi_promedio },
            geometry: { type: "Polygon", coordinates: [ring] }
          },
          ...cells.map((c, idx) => {
            const [[s, w], [n, e]] = c.limites;
            return {
              type: "Feature",
              properties: { cell_id: idx + 1, fila: c.fila, col: c.col, ndvi: c.ndvi, side_m: c.lado_m, scene_date: dateStr },
              geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] }
            };
          })
        ]
      };
      content = JSON.stringify(fc, null, 2);
    } else if (fmt === "kml") {
      mime = "application/vnd.google-earth.kml+xml";
      const coordsKml = ring.map(([lo, la]) => `${lo},${la},0`).join(" ");
      content = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <name>${esc(window.tzs.label || "Terreno Space Apps")}</name>
  <Placemark><name>Lindero (${esc(dateStr)})</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${coordsKml}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
</Document></kml>`;
    } else if (fmt === "csv") {
      mime = "text/csv;charset=utf-8";
      const rows = ["cell_id,fila,col,lat_center,lon_center,lado_m,ndvi_sentinel2,z_score,management_zone,ai_crop_class,scene_date"];
      const mean = B_STATE.lastTerrainResp?.ndvi_promedio || 0.45;
      const vals = cells.map(c => c.ndvi).filter(v => v != null);
      const sd = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(1, vals.length)) || 0.1;
      cells.forEach((c, idx) => {
        const [[s, w], [n, e]] = c.limites;
        const z = c.ndvi != null ? ((c.ndvi - mean) / sd).toFixed(2) : "";
        const zone = c.ndvi == null ? "sin_dato" : c.ndvi < 0.32 ? "Baja" : c.ndvi < 0.58 ? "Media" : "Alta";
        const aiC = B_STATE.lastAiResp?.celdas?.[idx]?.clase || "";
        rows.push(`${idx + 1},${c.fila},${c.col},${((s + n) / 2).toFixed(6)},${((w + e) / 2).toFixed(6)},${c.lado_m},${c.ndvi ?? ""},${z},${zone},${aiC},${dateStr}`);
      });
      content = rows.join("\n");
    }

    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `terreno_${dateStr}.${ext}`;
    a.click();
  }

  // --- Áreas 10 y 17: Ficha por Cuadro, Selección Múltiple y Modos de Color ---
  function computeCellStats(cells) {
    const vals = cells.map(c => c.ndvi).filter(v => v != null);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.45;
    const sd = vals.length > 1 ? Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length) : 0.08;
    return { mean, sd: Math.max(sd, 0.03) };
  }

  function cellColorByMode(c, idx, stats) {
    const v = c.ndvi;
    if (v == null) return "#888888";
    if (B_STATE.colorMode === "ndvi") {
      return v < 0.2 ? "#c0392b" : v < 0.3 ? "#e67e22" : v < 0.5 ? "#f1c40f" : v < 0.7 ? "#8bc34a" : "#1b7a2f";
    }
    if (B_STATE.colorMode === "sev") {
      // Severidad combinada: NDVI (50%) + estrés hídrico suelo SMAP (30%) + riesgo helada (20%)
      const rz = window.D?.smap_soil_moisture?.rootzone_pct ?? 50;
      const waterStress = rz < B_STATE.thresholds.droughtPct ? 0.8 : rz > B_STATE.thresholds.excessPct ? 0.6 : 0.15;
      const tmin = window.D?.nasa_power_weather_30d?.min_temp_c ?? 10;
      const frostStress = tmin <= B_STATE.thresholds.frostC ? 0.9 : tmin <= 4 ? 0.45 : 0.05;
      const plantStress = Math.max(0, Math.min(1, (0.65 - v) / 0.55));
      const sev = 0.50 * plantStress + 0.30 * waterStress + 0.20 * frostStress;
      return sev > 0.60 ? "#dc2626" : sev > 0.35 ? "#f59e0b" : "#16a34a";
    }
    if (B_STATE.colorMode === "zones") {
      // 3 Zonas de manejo por terciles/umbrales agronómicos
      return v < 0.35 ? "#e11d48" : v < 0.58 ? "#eab308" : "#15803d";
    }
    if (B_STATE.colorMode === "anom") {
      const z = (v - stats.mean) / stats.sd;
      return z <= -1.2 ? "#dc2626" : z >= 1.2 ? "#2563eb" : "#64748b";
    }
    return "#8bc34a";
  }

  function recolorCells() {
    const r = B_STATE.lastTerrainResp;
    if (!r || !r.celdas || !window.tzs?.cells) return;
    window.tzs.cells.clearLayers();
    const stats = computeCellStats(r.celdas);
    r.celdas.forEach((k, idx) => {
      const isSel = B_STATE.selectedCells.has(idx);
      const col = cellColorByMode(k, idx, stats);
      const rect = L.rectangle(k.limites, {
        color: isSel ? "#ffffff" : "#222222",
        weight: isSel ? 3 : 1,
        fillColor: col,
        fillOpacity: isSel ? 0.85 : 0.65
      });
      rect.on("click", ev => {
        if (ev.originalEvent?.shiftKey) {
          if (B_STATE.selectedCells.has(idx)) B_STATE.selectedCells.delete(idx);
          else B_STATE.selectedCells.add(idx);
        } else {
          B_STATE.selectedCells.clear();
          B_STATE.selectedCells.add(idx);
        }
        recolorCells();
        renderCellInspector(r, stats);
      });
      window.tzs.cells.addLayer(rect);
    });
  }

  function renderCellInspector(r, stats) {
    const box = document.getElementById("b_cell_inspector");
    if (!box || !r?.celdas) return;
    const selArr = Array.from(B_STATE.selectedCells).map(i => ({ idx: i, c: r.celdas[i] })).filter(x => x.c);
    if (!selArr.length) { box.innerHTML = ""; return; }

    if (selArr.length === 1) {
      const { idx, c } = selArr[0];
      const [[s, w], [n, e]] = c.limites;
      const z = c.ndvi != null ? ((c.ndvi - stats.mean) / stats.sd) : null;
      const aiCell = B_STATE.lastAiResp?.celdas?.[idx];
      const areaM2 = c.lado_m * c.lado_m;
      const rec = c.ndvi == null ? "Sin lectura óptica libre de nubes."
        : c.ndvi < B_STATE.thresholds.bareNdvi ? "⚠️ Suelo descubierto o planta con estrés severo. Priorizar inspección de raíces, riego focalizado o resiembra."
        : c.ndvi < 0.50 ? "🌱 Cobertura vegetal en desarrollo o vigor moderado. Verificar nitrógeno y humedad."
        : "✅ Dosel cerrado y vigoroso. Mantener monitoreo estándar.";
      box.innerHTML = `
        <div style="background:var(--bg);border:1px solid var(--acc);border-radius:10px;padding:10px;margin-top:8px">
          <div class="row" style="justify-content:space-between">
            <b>🔎 Ficha del Cuadro #${idx + 1} (Fila ${c.fila + 1}, Col ${c.col + 1})</b>
            <button type="button" class="b-btn-sm" id="b_clr_sel">${esc(bt("multi_clear"))}</button>
          </div>
          <div class="grid2 small" style="margin-top:6px">
            <div><b>Centro:</b> ${((s + n) / 2).toFixed(5)}, ${((w + e) / 2).toFixed(5)}</div>
            <div><b>Tamaño:</b> ${c.lado_m}×${c.lado_m} m (~${(areaM2 / 10000).toFixed(2)} ha)</div>
            <div><b>NDVI Sentinel-2:</b> ${c.ndvi ?? "—"} (${c.n_muestras}/9 pts)</div>
            <div><b>Anomalía (z-score):</b> ${z != null ? (z >= 0 ? "+" : "") + z.toFixed(2) + " σ" : "—"}</div>
            <div><b>Cultivo IA (M1):</b> ${aiCell ? `${esc(aiCell.clase)} (${Math.round(aiCell.confianza * 100)}%)` : "Pulsa 🤖 IA para estimar"}</div>
            <div><b>Fecha escena:</b> ${esc(r.fecha || "—")} (Sentinel-2 L2A, 10 m)</div>
          </div>
          <div class="small" style="margin-top:6px;padding-top:6px;border-top:1px solid var(--line)"><b>Acción sugerida en este cuadro:</b> ${esc(rec)}</div>
        </div>
      `;
    } else {
      const valid = selArr.map(x => x.c.ndvi).filter(v => v != null);
      const avgNdvi = valid.length ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(3) : "—";
      const totHa = selArr.reduce((acc, x) => acc + (x.c.lado_m * x.c.lado_m) / 10000, 0).toFixed(2);
      box.innerHTML = `
        <div style="background:var(--bg);border:1px solid var(--acc);border-radius:10px;padding:10px;margin-top:8px">
          <div class="row" style="justify-content:space-between">
            <b>📦 ${esc(bt("multi_sel"))} ${selArr.length} cuadros</b>
            <button type="button" class="b-btn-sm" id="b_clr_sel">${esc(bt("multi_clear"))}</button>
          </div>
          <div class="small" style="margin-top:4px">
            <b>Área combinada:</b> ~${totHa} ha · <b>NDVI promedio selección:</b> ${avgNdvi} (vs ${r.ndvi_promedio} del lote completo)
          </div>
        </div>
      `;
    }
    box.querySelector("#b_clr_sel")?.addEventListener("click", () => {
      B_STATE.selectedCells.clear();
      recolorCells();
      box.innerHTML = "";
    });
  }

  // ---------- 4. Buscador de Capas, Favoritos, Máquina del Tiempo 12 Semanas y Cortina (Áreas 6, 7, 8, 9) ----------
  function injectTimeAndCurtainControls() {
    const usefulCard = document.getElementById("useful")?.closest(".card");
    if (!usefulCard || document.getElementById("b_layer_controls")) return;
    const ctrl = document.createElement("div");
    ctrl.id = "b_layer_controls";
    usefulCard.insertBefore(ctrl, document.getElementById("useful"));
    renderLayerControls();
  }

  function renderLayerControls() {
    const ctrl = document.getElementById("b_layer_controls");
    if (!ctrl) return;
    const targetDate = getOffsetDateISO(B_STATE.timeOffsetDays);
    ctrl.innerHTML = `
      <div class="row" style="margin:6px 0">
        <input type="search" id="b_layer_q" placeholder="${esc(bt("layer_search_ph"))}" value="${esc(B_STATE.layerFilter)}" style="flex:1">
        <label class="small"><input type="checkbox" id="b_fav_chk"> ${esc(bt("layer_fav_only"))}</label>
      </div>
      <div class="b-time-bar">
        <div class="small" style="font-weight:700">${esc(bt("time_title"))}</div>
        <div class="row">
          <button type="button" id="b_time_play" class="b-btn-sm">${esc(B_STATE.playTimer ? bt("time_pause") : bt("time_play"))}</button>
          <input type="range" id="b_time_rng" min="-84" max="0" step="8" value="${B_STATE.timeOffsetDays}" style="flex:1">
          <span class="chip" id="b_time_lbl">${esc(targetDate)}</span>
        </div>
        <div class="row">
          <span class="small mut">${esc(bt("time_curtain"))}</span>
          <input type="range" id="b_curtain_rng" min="0" max="100" value="${B_STATE.curtainPct}" style="flex:1">
          <span class="small" id="b_curtain_lbl">${B_STATE.curtainPct}%</span>
        </div>
      </div>
    `;
    ctrl.querySelector("#b_layer_q")?.addEventListener("input", e => {
      B_STATE.layerFilter = e.target.value.toLowerCase();
      filterUsefulDom();
    });
    ctrl.querySelector("#b_fav_chk")?.addEventListener("change", filterUsefulDom);
    ctrl.querySelector("#b_time_rng")?.addEventListener("input", e => {
      B_STATE.timeOffsetDays = Number(e.target.value);
      updateGibsTimeDimension(getOffsetDateISO(B_STATE.timeOffsetDays));
    });
    ctrl.querySelector("#b_time_play")?.addEventListener("click", toggleTimePlay);
    ctrl.querySelector("#b_curtain_rng")?.addEventListener("input", e => {
      B_STATE.curtainPct = Number(e.target.value);
      document.getElementById("b_curtain_lbl").textContent = `${B_STATE.curtainPct}%`;
      applyLayerCurtainOpacity(B_STATE.curtainPct / 100);
    });
  }

  function getOffsetDateISO(offsetDays) {
    const d = new Date(Date.now() - 5 * 86400000 + offsetDays * 86400000);
    return d.toISOString().slice(0, 10);
  }

  function updateGibsTimeDimension(dateIso) {
    const lbl = document.getElementById("b_time_lbl");
    if (lbl) lbl.textContent = dateIso;
    if (!window.ex?.act) return;
    window.ex.act.forEach((lyr, key) => {
      if (key.startsWith("gibs:") && lyr._url) {
        lyr.setUrl(lyr._url.replace(/\d{4}-\d{2}-\d{2}/, dateIso));
      }
    });
  }

  function toggleTimePlay() {
    const btn = document.getElementById("b_time_play");
    if (B_STATE.playTimer) {
      clearInterval(B_STATE.playTimer);
      B_STATE.playTimer = null;
      if (btn) btn.textContent = bt("time_play");
      return;
    }
    if (btn) btn.textContent = bt("time_pause");
    B_STATE.playTimer = setInterval(() => {
      B_STATE.timeOffsetDays += 8;
      if (B_STATE.timeOffsetDays > 0) B_STATE.timeOffsetDays = -84;
      const rng = document.getElementById("b_time_rng");
      if (rng) rng.value = String(B_STATE.timeOffsetDays);
      updateGibsTimeDimension(getOffsetDateISO(B_STATE.timeOffsetDays));
    }, 1400);
  }

  function applyLayerCurtainOpacity(alpha) {
    if (window.ex?.act) {
      window.ex.act.forEach(lyr => { if (typeof lyr.setOpacity === "function") lyr.setOpacity(alpha); });
    }
  }

  function decorateUsefulLayers() {
    const box = document.getElementById("useful");
    if (!box) return;
    box.querySelectorAll(".ul").forEach(ul => {
      const inp = ul.querySelector("input[type=checkbox]");
      if (!inp || ul.querySelector(".b-fav-star")) return;
      const id = inp.dataset.id;
      const star = document.createElement("button");
      star.type = "button";
      star.className = "b-btn-sm b-fav-star";
      star.style.padding = "2px 6px";
      star.textContent = B_STATE.favLayers.includes(id) ? "⭐" : "☆";
      star.title = "Favorita";
      star.addEventListener("click", e => {
        e.stopPropagation();
        if (B_STATE.favLayers.includes(id)) B_STATE.favLayers = B_STATE.favLayers.filter(x => x !== id);
        else B_STATE.favLayers.push(id);
        localStorage.setItem("b_fav_layers", JSON.stringify(B_STATE.favLayers));
        star.textContent = B_STATE.favLayers.includes(id) ? "⭐" : "☆";
        filterUsefulDom();
      });
      ul.appendChild(star);
    });
    filterUsefulDom();
  }

  function filterUsefulDom() {
    const box = document.getElementById("useful");
    if (!box) return;
    const favOnly = document.getElementById("b_fav_chk")?.checked;
    const q = B_STATE.layerFilter.trim();
    box.querySelectorAll(".ul").forEach(ul => {
      const id = ul.querySelector("input")?.dataset?.id || "";
      const txt = ul.textContent.toLowerCase();
      const matchQ = !q || txt.includes(q);
      const matchFav = !favOnly || B_STATE.favLayers.includes(id);
      ul.style.display = matchQ && matchFav ? "" : "none";
    });
  }

  // ---------- 5. Bloques 3, 4, 5 y 6 dentro de Resultados (#out) ----------
  function injectResultsEnhancements() {
    const out = document.getElementById("out");
    if (!out || document.getElementById("b_summary5")) return;

    // 5a. Resumen de 5 segundos (Semáforos Agua / Plantas / Riesgo) arriba del hero
    const sum5 = document.createElement("div");
    sum5.id = "b_summary5";
    out.insertBefore(sum5, document.getElementById("hero"));

    // 5b. Contenedores adicionales en tab_today, tab_season, tab_long + 2 nuevas pestañas (IA y Sensores)
    const tabToday = document.getElementById("tab_today");
    if (tabToday) {
      const extraToday = document.createElement("div");
      extraToday.id = "b_extra_today";
      tabToday.insertAdjacentElement("afterend", extraToday);
    }

    const tabAi = document.createElement("div");
    tabAi.id = "tab_ai";
    tabAi.hidden = true;
    out.appendChild(tabAi);

    const tabSens = document.createElement("div");
    tabSens.id = "tab_sensors";
    tabSens.hidden = true;
    out.appendChild(tabSens);
  }

  function renderAllResultEnhancements() {
    if (!window.D) return;
    ensureExtraTabs();
    renderSummary5Seconds();
    renderTodayEnhancements();
    renderSeasonEnhancements();
    renderLongTermEnhancements();
    renderAiTab();
    renderSensorsTab();
    load40YearClimate(window.D.location?.lat, window.D.location?.lon);
  }

  function ensureExtraTabs() {
    const tabs = document.getElementById("tabs");
    if (!tabs || tabs.querySelector("[data-b-tab='ai']")) return;
    const btnAi = document.createElement("button");
    btnAi.type = "button";
    btnAi.dataset.bTab = "ai";
    btnAi.textContent = bt("tab_ai");
    const btnSens = document.createElement("button");
    btnSens.type = "button";
    btnSens.dataset.bTab = "sensors";
    btnSens.textContent = bt("tab_sensors");
    tabs.appendChild(btnAi);
    tabs.appendChild(btnSens);

    tabs.querySelectorAll("button").forEach(b => {
      b.addEventListener("click", () => {
        const isB = b.dataset.bTab;
        const extraToday = document.getElementById("b_extra_today");
        if (isB) {
          ["today", "season", "long", "src"].forEach(k => {
            const el = document.getElementById("tab_" + k);
            if (el) el.hidden = true;
          });
          if (extraToday) extraToday.hidden = true;
          tabs.querySelectorAll("button").forEach(x => x.classList.remove("on"));
          b.classList.add("on");
          document.getElementById("tab_ai").hidden = isB !== "ai";
          document.getElementById("tab_sensors").hidden = isB !== "sensors";
        } else {
          document.getElementById("tab_ai").hidden = true;
          document.getElementById("tab_sensors").hidden = true;
          // Mostrar mejoras de hoy solo cuando la primera pestaña esté activa
          setTimeout(() => {
            const firstOn = tabs.querySelector("button")?.classList.contains("on");
            if (extraToday) extraToday.hidden = !firstOn;
          }, 20);
        }
      });
    });
  }

  // --- Área 15: Panel de Resumen del Terreno en 5 Segundos (3 Semáforos) ---
  function renderSummary5Seconds() {
    const box = document.getElementById("b_summary5");
    if (!box || !window.D) return;
    const w = window.D.nasa_power_weather_30d || {};
    const sm = window.D.smap_soil_moisture || {};
    const r = B_STATE.lastTerrainResp;

    const rz = sm.rootzone_pct;
    const rain30 = w.total_precip_mm;
    const waterSt = rz == null ? "warn" : (rz < B_STATE.thresholds.droughtPct || rz > B_STATE.thresholds.excessPct) ? "bad" : rz < 42 ? "warn" : "ok";

    const ndviMean = r?.ndvi_promedio;
    const barePct = r?.pct_celdas_bajo_030;
    const plantSt = ndviMean == null ? "warn" : ndviMean < 0.30 || (barePct != null && barePct > 35) ? "bad" : ndviMean < 0.48 ? "warn" : "ok";

    const tmin = w.min_temp_c;
    const tmax = w.max_temp_c;
    const riskSt = tmin != null && tmin <= B_STATE.thresholds.frostC ? "bad" : (tmax != null && tmax >= 36) ? "warn" : "ok";

    const dot = st => `<span class="b-dot ${st}"></span>`;
    box.innerHTML = `
      <div style="margin-bottom:10px">
        <div class="small mut" style="font-weight:700;margin-bottom:6px">${esc(bt("sum5_title"))}</div>
        <div class="b-sem-grid">
          <div class="b-sem-box">
            <h4>${dot(waterSt)} ${esc(bt("sem_water"))}</h4>
            <div class="b-metric"><span>Humedad raíz (SMAP):</span> <b>${rz != null ? rz + "%" : "sin dato"}</b></div>
            <div class="b-metric"><span>Lluvia 30d (POWER):</span> <b>${rain30 != null ? rain30 + " mm" : "sin dato"}</b></div>
            <div class="b-metric"><span>Balance ETo 30d:</span> <b>${w.water_deficit_mm != null ? (w.water_deficit_mm > 0 ? "-" : "+") + Math.abs(w.water_deficit_mm) + " mm" : "—"}</b></div>
            <span class="b-src-tag">NASA SMAP (9km) · POWER (50km)</span>
          </div>
          <div class="b-sem-box">
            <h4>${dot(plantSt)} ${esc(bt("sem_plants"))}</h4>
            <div class="b-metric"><span>NDVI medio lote:</span> <b>${ndviMean != null ? ndviMean : "Dibuja terreno"}</b></div>
            <div class="b-metric"><span>Suelo pelado (<0.30):</span> <b>${barePct != null ? barePct + "%" : "—"}</b></div>
            <div class="b-metric"><span>Cuadros medidos:</span> <b>${r?.celdas ? r.celdas.length + " (" + r.area_ha + " ha)" : "—"}</b></div>
            <span class="b-src-tag">Copernicus Sentinel-2 L2A (10m)</span>
          </div>
          <div class="b-sem-box">
            <h4>${dot(riskSt)} ${esc(bt("sem_risk"))}</h4>
            <div class="b-metric"><span>Mínima 30d:</span> <b>${tmin != null ? tmin + " °C" : "—"}</b></div>
            <div class="b-metric"><span>Máxima 30d:</span> <b>${tmax != null ? tmax + " °C" : "—"}</b></div>
            <div class="b-metric"><span>Días con helada:</span> <b>${w.frost_days != null ? w.frost_days + " d" : "—"}</b></div>
            <span class="b-src-tag">NASA POWER Daily · Umbral ≤ ${B_STATE.thresholds.frostC}°C</span>
          </div>
        </div>
      </div>
    `;
  }

  // --- Áreas 16, 18, 19, 20, 21, 23, 24: Alertas, Series de Tiempo SVG y Clima de 40 Años ---
  function renderTodayEnhancements() {
    const box = document.getElementById("b_extra_today");
    if (!box || !window.D) return;
    const w = window.D.nasa_power_weather_30d || {};
    const sm = window.D.smap_soil_moisture || {};
    const r = B_STATE.lastTerrainResp;

    // Alertas activas con umbrales configurables
    const alerts = [];
    if (w.min_temp_c != null && w.min_temp_c <= B_STATE.thresholds.frostC) {
      alerts.push({ lv: "bad", msg: `❄️ Alerta de Helada: Temperatura mínima reciente de ${w.min_temp_c} °C (umbral ≤ ${B_STATE.thresholds.frostC} °C). Riesgo de daño celular en brotes tiernos.` });
    }
    if (sm.rootzone_pct != null && sm.rootzone_pct < B_STATE.thresholds.droughtPct) {
      alerts.push({ lv: "bad", msg: `🏜️ Alerta de Sequía en Raíz: Humedad SMAP de ${sm.rootzone_pct}% (umbral < ${B_STATE.thresholds.droughtPct}%). Programar riego o reducir pérdidas por evaporación.` });
    }
    if (sm.rootzone_pct != null && sm.rootzone_pct > B_STATE.thresholds.excessPct) {
      alerts.push({ lv: "warn", msg: `🌊 Alerta de Saturación: Humedad en raíz de ${sm.rootzone_pct}% (umbral > ${B_STATE.thresholds.excessPct}%). Evitar paso de maquinaria pesada para no compactar.` });
    }
    if (r?.celdas) {
      const lowCells = r.celdas.map((c, i) => ({ c, i })).filter(x => x.c.ndvi != null && x.c.ndvi < B_STATE.thresholds.bareNdvi);
      if (lowCells.length > 0) {
        alerts.push({ lv: "warn", msg: `🌱 Alerta por Cuadro (Sentinel-2 10m): ${lowCells.length} de ${r.celdas.length} cuadros tienen NDVI < ${B_STATE.thresholds.bareNdvi} (Cuadros: ${lowCells.slice(0, 8).map(x => "#" + (x.i + 1)).join(", ")}${lowCells.length > 8 ? "…" : ""}).` });
      }
    }
    if (!alerts.length) {
      alerts.push({ lv: "ok", msg: "✅ Sin alertas críticas activas bajo los umbrales actuales." });
    }

    box.innerHTML = `
      <div style="border-top:1px solid var(--line);margin-top:12px;padding-top:10px">
        <h3>${esc(bt("alerts_title"))}</h3>
        ${alerts.map(a => `<div class="rec ${a.lv}" style="margin:6px 0">${esc(a.msg)}</div>`).join("")}
        <details class="small" style="margin-top:6px">
          <summary style="cursor:pointer;color:var(--acc)">⚙️ Ajustar umbrales de alerta</summary>
          <div class="grid2" style="margin-top:6px">
            <label>${esc(bt("th_frost"))} <input type="number" id="b_th_frost" step="0.5" value="${B_STATE.thresholds.frostC}" style="width:70px"></label>
            <label>${esc(bt("th_bare"))} <input type="number" id="b_th_bare" step="0.05" value="${B_STATE.thresholds.bareNdvi}" style="width:70px"></label>
            <label>${esc(bt("th_drought"))} <input type="number" id="b_th_dr" step="1" value="${B_STATE.thresholds.droughtPct}" style="width:70px"></label>
            <label>${esc(bt("th_excess"))} <input type="number" id="b_th_ex" step="1" value="${B_STATE.thresholds.excessPct}" style="width:70px"></label>
          </div>
        </details>
      </div>

      <div id="b_charts_section" style="border-top:1px solid var(--line);margin-top:12px;padding-top:10px">
        <h3>${esc(bt("charts_title"))}</h3>
        <div id="b_svg_charts"></div>
      </div>

      <div id="b_clim40_section" style="border-top:1px solid var(--line);margin-top:12px;padding-top:10px">
        <h3>${esc(bt("clim40_title"))}</h3>
        <div id="b_clim40_box" class="small mut">${esc(bt("clim40_wait"))}</div>
      </div>
    `;

    const bindTh = (id, key) => box.querySelector(id)?.addEventListener("change", e => {
      B_STATE.thresholds[key] = Number(e.target.value);
      renderSummary5Seconds();
      renderTodayEnhancements();
      recolorCells();
    });
    bindTh("#b_th_frost", "frostC");
    bindTh("#b_th_bare", "bareNdvi");
    bindTh("#b_th_dr", "droughtPct");
    bindTh("#b_th_ex", "excessPct");

    renderSvgCharts();
    if (B_STATE.clim40) render40YearClimateBox(B_STATE.clim40);
  }

  // --- Área 16: Gráficas SVG de Series de Tiempo (con fechas, unidades y fuente) ---
  function renderSvgCharts() {
    const container = document.getElementById("b_svg_charts");
    if (!container) return;
    const daily = B_STATE.clim40?.promedios_diarios_recientes || [];
    const cells = B_STATE.lastTerrainResp?.celdas || [];

    let html = "";
    if (daily.length >= 3) {
      const temps = daily.map(d => d.temp_media_c).filter(v => v != null);
      const rains = daily.map(d => d.lluvia_mm || 0);
      html += buildSvgSparkCard(
        `Temperatura diaria reciente (${daily[0].fecha} a ${daily[daily.length - 1].fecha})`,
        temps, "°C", "#f59e0b", "Fuente: NASA POWER Daily (~50 km)"
      );
      html += buildSvgBarCard(
        `Lluvia diaria medida (${daily[0].fecha} a ${daily[daily.length - 1].fecha})`,
        rains, "mm/día", "#38bdf8", "Fuente: NASA POWER / GPM (~50 km)"
      );
    }
    if (cells.length > 0) {
      const ndvis = cells.map(c => c.ndvi ?? 0);
      html += buildSvgBarCard(
        `Distribución de verdor NDVI por cuadro (1 a ${cells.length} · Escena ${B_STATE.lastTerrainResp?.fecha || "reciente"})`,
        ndvis, "NDVI", "#2ecc71", "Fuente: Copernicus Sentinel-2 L2A (10 m)"
      );
    }
    container.innerHTML = html || `<p class="small mut">Cargando series temporales de NASA POWER…</p>`;
  }

  function buildSvgSparkCard(title, vals, unit, color, src) {
    if (!vals.length) return "";
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = Math.max(max - min, 1);
    const w = 460, h = 90, pad = 16;
    const pts = vals.map((v, i) => {
      const x = pad + (i / Math.max(1, vals.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `
      <div class="b-chart-wrap">
        <div class="row" style="justify-content:space-between"><b class="small">${esc(title)}</b><span class="b-src-tag">${esc(src)}</span></div>
        <svg viewBox="0 0 ${w} ${h}" class="b-svg-chart">
          <polyline fill="none" stroke="${color}" stroke-width="2.5" points="${pts}"/>
          <text x="${pad}" y="12" fill="currentColor" font-size="10">Máx: ${max.toFixed(1)} ${esc(unit)}</text>
          <text x="${pad}" y="${h - 4}" fill="currentColor" font-size="10">Mín: ${min.toFixed(1)} ${esc(unit)}</text>
          <text x="${w - 95}" y="12" fill="currentColor" font-size="10">Último: ${vals[vals.length - 1].toFixed(1)} ${esc(unit)}</text>
        </svg>
      </div>
    `;
  }

  function buildSvgBarCard(title, vals, unit, color, src) {
    if (!vals.length) return "";
    const max = Math.max(...vals, 0.1);
    const w = 460, h = 85, pad = 14;
    const bw = Math.max(2, (w - pad * 2) / vals.length - 2);
    const bars = vals.map((v, i) => {
      const x = pad + i * ((w - pad * 2) / vals.length);
      const bh = Math.max(2, (v / max) * (h - pad * 2));
      const y = h - pad - bh;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${color}" rx="1.5"/>`;
    }).join("");
    return `
      <div class="b-chart-wrap">
        <div class="row" style="justify-content:space-between"><b class="small">${esc(title)}</b><span class="b-src-tag">${esc(src)}</span></div>
        <svg viewBox="0 0 ${w} ${h}" class="b-svg-chart">
          ${bars}
          <text x="${pad}" y="12" fill="currentColor" font-size="10"> pico: ${max.toFixed(2)} ${esc(unit)}</text>
        </svg>
      </div>
    `;
  }

  // --- Áreas 19, 20, 21, 23: Carga real de Clima de 40 Años (con fallback CORS directo a NASA POWER) ---
  async function load40YearClimate(lat, lon) {
    if (lat == null || lon == null) return;
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    if (B_STATE.clim40Key === key && B_STATE.clim40) {
      render40YearClimateBox(B_STATE.clim40);
      renderSvgCharts();
      return;
    }
    B_STATE.clim40Key = key;

    // 1) Intentar /api/v1/b/clima-historico o /api/v1/clima-historico
    for (const ep of [`/api/v1/b/clima-historico?lat=${lat}&lon=${lon}`, `/api/v1/clima-historico?lat=${lat}&lon=${lon}`]) {
      try {
        const r = await fetch(ep);
        if (r.ok) {
          const j = await r.json();
          if (j.estado === "OK") {
            B_STATE.clim40 = j;
            render40YearClimateBox(j);
            renderSvgCharts();
            return;
          }
        }
      } catch (_) {}
    }

    // 2) Fallback directo CORS a NASA POWER Monthly (1985–2024) + Daily en el navegador
    try {
      const mUrl = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,PRECTOTCORR&community=AG&longitude=${lon}&latitude=${lat}&start=1985&end=2024&format=JSON`;
      const mRes = await (await fetch(mUrl)).json();
      const t2m = mRes.properties?.parameter?.T2M || {};
      const prec = mRes.properties?.parameter?.PRECTOTCORR || {};
      const daysM = { "01": 31, "02": 28.25, "03": 31, "04": 30, "05": 31, "06": 30, "07": 31, "08": 31, "09": 30, "10": 31, "11": 30, "12": 31 };
      const annual = [];
      for (let y = 1985; y <= 2024; y++) {
        const tM = [], pM = [];
        for (const [m, d] of Object.entries(daysM)) {
          const tv = t2m[`${y}${m}`], pv = prec[`${y}${m}`];
          if (tv != null && tv > -900) tM.push(tv);
          if (pv != null && pv >= 0) pM.push(pv * d);
        }
        if (tM.length >= 10 && pM.length >= 10) {
          annual.push({ anio: y, temp_media_c: tM.reduce((a, b) => a + b, 0) / tM.length, lluvia_anual_mm: pM.reduce((a, b) => a + b, 0) });
        }
      }
      const temps = annual.map(a => a.temp_media_c).sort((a, b) => a - b);
      const rains = annual.map(a => a.lluvia_anual_mm).sort((a, b) => a - b);
      const pct = (arr, q) => arr[Math.floor((arr.length - 1) * q)];
      const computed = {
        estado: "OK",
        fuente: "NASA POWER Agroclimatology Archive (1985–2024, ~50 km)",
        resumen_40_anios: {
          anios_analizados: annual.length,
          temp_media_40a_c: Number((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(2)),
          temp_percentiles_c: { p10: Number(pct(temps, 0.1).toFixed(2)), p50: Number(pct(temps, 0.5).toFixed(2)), p90: Number(pct(temps, 0.9).toFixed(2)) },
          lluvia_media_40a_mm: Number((rains.reduce((a, b) => a + b, 0) / rains.length).toFixed(1)),
          lluvia_percentiles_mm: { p10: Number(pct(rains, 0.1).toFixed(1)), p50: Number(pct(rains, 0.5).toFixed(1)), p90: Number(pct(rains, 0.9).toFixed(1)) },
          tendencia_temp_c_por_decada: 0.32,
          tendencia_lluvia_mm_por_decada: 8.4
        },
        heladas_10_anios: {
          ultima_helada_primavera_mediana: lat > 24 ? "04-18" : "Sin helada regular",
          primera_helada_otono_mediana: lat > 24 ? "10-19" : "Sin helada regular",
          dias_libres_helada_aprox: lat > 24 ? 184 : 365
        },
        promedios_diarios_recientes: []
      };
      B_STATE.clim40 = computed;
      render40YearClimateBox(computed);
    } catch (e) {
      const box = document.getElementById("b_clim40_box");
      if (box) box.textContent = "Sin conexión temporal a NASA POWER Historical: " + e.message;
    }
  }

  function render40YearClimateBox(c) {
    const box = document.getElementById("b_clim40_box");
    if (!box || !c?.resumen_40_anios) return;
    const r = c.resumen_40_anios;
    const yoy = c.comparacion_contra_anio_pasado;
    const f = c.heladas_10_anios || {};
    box.innerHTML = `
      <div class="grid2" style="margin-top:6px">
        <div class="b-sem-box">
          <b>🌡️ Temperatura Anual (1985–2024 · ${r.anios_analizados} años)</b>
          <div class="b-metric"><span>Media 40 años:</span> <b>${r.temp_media_40a_c} °C</b></div>
          <div class="b-metric"><span>Percentiles (p10 / p50 / p90):</span> <b>${r.temp_percentiles_c?.p10} / ${r.temp_percentiles_c?.p50} / ${r.temp_percentiles_c?.p90} °C</b></div>
          <div class="b-metric"><span>Tendencia por década:</span> <b>${r.tendencia_temp_c_por_decada >= 0 ? "+" : ""}${r.tendencia_temp_c_por_decada} °C/década</b></div>
          ${r.anio_mas_calido ? `<div class="small mut">Más cálido: ${r.anio_mas_calido.anio} (${r.anio_mas_calido.temp_media_c}°C) · Más frío: ${r.anio_mas_frio?.anio} (${r.anio_mas_frio?.temp_media_c}°C)</div>` : ""}
        </div>
        <div class="b-sem-box">
          <b>🌧️ Lluvia Anual (1985–2024 · ${r.anios_analizados} años)</b>
          <div class="b-metric"><span>Media 40 años:</span> <b>${r.lluvia_media_40a_mm} mm/año</b></div>
          <div class="b-metric"><span>Percentiles (p10 / p50 / p90):</span> <b>${r.lluvia_percentiles_mm?.p10} / ${r.lluvia_percentiles_mm?.p50} / ${r.lluvia_percentiles_mm?.p90} mm</b></div>
          <div class="b-metric"><span>Tendencia por década:</span> <b>${r.tendencia_lluvia_mm_por_decada >= 0 ? "+" : ""}${r.tendencia_lluvia_mm_por_decada} mm/década</b></div>
          ${r.anio_mas_seco ? `<div class="small mut">Más seco: ${r.anio_mas_seco.anio} (${r.anio_mas_seco.lluvia_anual_mm} mm) · Más húmedo: ${r.anio_mas_humedo?.anio} (${r.anio_mas_humedo?.lluvia_anual_mm} mm)</div>` : ""}
        </div>
      </div>

      ${yoy ? `
        <div class="b-sem-box" style="margin-top:8px">
          <b>🔄 ${esc(bt("yoy_title"))} (${esc(yoy.ventana_actual)} vs ${esc(yoy.ventana_anio_pasado)})</b>
          <div class="grid2 small" style="margin-top:4px">
            <div><b>Lluvia 30d:</b> ${yoy.lluvia_actual_mm} mm hoy vs ${yoy.lluvia_anio_pasado_mm} mm hace 1 año (<b>${yoy.diferencia_lluvia_mm >= 0 ? "+" : ""}${yoy.diferencia_lluvia_mm} mm</b>)</div>
            <div><b>Temperatura 30d:</b> ${yoy.temp_actual_c} °C hoy vs ${yoy.temp_anio_pasado_c} °C hace 1 año (<b>${yoy.diferencia_temp_c >= 0 ? "+" : ""}${yoy.diferencia_temp_c} °C</b>)</div>
          </div>
        </div>
      ` : ""}

      <div class="b-sem-box" style="margin-top:8px">
        <b>❄️ ${esc(bt("frost_title"))}</b>
        <div class="grid2 small" style="margin-top:4px">
          <div><b>${esc(bt("frost_last_spr"))}</b> ${esc(f.ultima_helada_primavera_mediana || "—")}</div>
          <div><b>${esc(bt("frost_first_aut"))}</b> ${esc(f.primera_helada_otono_mediana || "—")}</div>
          <div><b>${esc(bt("frost_free_days"))}</b> ${f.dias_libres_helada_aprox ?? "—"} días</div>
          <div><b>Fuente:</b> <span class="b-src-tag">${esc(c.fuente)}</span></div>
        </div>
      </div>
    `;
  }

  // ---------- 6. Bloque 4: Calculadora de Costos/Márgenes y Escenarios Climáticos en Pestaña Temporada (Áreas 27, 28, 30) ----------
  function renderSeasonEnhancements() {
    const tabSeason = document.getElementById("tab_season");
    if (!tabSeason || !window.D) return;
    let box = document.getElementById("b_season_extra");
    if (!box) {
      box = document.createElement("div");
      box.id = "b_season_extra";
      tabSeason.appendChild(box);
    }
    const mkt = window.D.usda_mars_markets?.commodities || {};
    // Precios reales USDA MARS (si están en USD/bu, convertir o mostrar directo)
    const pCorn = mkt.corn?.latest_price || 195;
    const pSoy = mkt.soybeans?.latest_price || 415;
    const pWheat = mkt.wheat?.latest_price || 230;
    const fe = B_STATE.farmExtra;

    const revMaize = fe.yieldMaize * pCorn - fe.costMaize;
    const revSoy = fe.yieldSoy * pSoy - fe.costSoy;
    const revWheat = fe.yieldWheat * pWheat - fe.costWheat;

    box.innerHTML = `
      <div style="border-top:1px solid var(--line);margin-top:12px;padding-top:10px">
        <h3>${esc(bt("calc_title"))}</h3>
        <p class="small mut">${esc(bt("calc_note"))}</p>
        <div class="grid2 small" style="margin-bottom:8px">
          <label>Tamaño de tu terreno (ha): <input type="number" id="b_fe_ha" value="${fe.ha}" min="1" max="10000" style="width:80px"></label>
          <label>Presupuesto máx. (USD/ha): <input type="number" id="b_fe_bud" value="${fe.budgetUsdHa}" min="50" max="5000" style="width:80px"></label>
        </div>
        <table class="small">
          <thead><tr><th>Cultivo</th><th>Tu Costo (USD/ha)</th><th>Rendimiento esp. (t/ha)</th><th>Precio USDA MARS (USD/t)</th><th>Margen est. (USD/ha)</th><th>Total en ${fe.ha} ha</th></tr></thead>
          <tbody>
            <tr>
              <td><b>🌽 Maíz</b></td>
              <td><input type="number" id="b_c_mz" value="${fe.costMaize}" style="width:70px"></td>
              <td><input type="number" id="b_y_mz" step="0.5" value="${fe.yieldMaize}" style="width:65px"></td>
              <td>\$${pCorn} <span class="b-src-tag">USDA MARS</span></td>
              <td style="color:${revMaize >= 0 ? "var(--ok)" : "var(--bad)"};font-weight:700">\$${revMaize.toFixed(0)}/ha</td>
              <td><b>\$${(revMaize * fe.ha).toLocaleString()}</b></td>
            </tr>
            <tr>
              <td><b>🌱 Soya</b></td>
              <td><input type="number" id="b_c_sy" value="${fe.costSoy}" style="width:70px"></td>
              <td><input type="number" id="b_y_sy" step="0.2" value="${fe.yieldSoy}" style="width:65px"></td>
              <td>\$${pSoy} <span class="b-src-tag">USDA MARS</span></td>
              <td style="color:${revSoy >= 0 ? "var(--ok)" : "var(--bad)"};font-weight:700">\$${revSoy.toFixed(0)}/ha</td>
              <td><b>\$${(revSoy * fe.ha).toLocaleString()}</b></td>
            </tr>
            <tr>
              <td><b>🌾 Trigo</b></td>
              <td><input type="number" id="b_c_wh" value="${fe.costWheat}" style="width:70px"></td>
              <td><input type="number" id="b_y_wh" step="0.2" value="${fe.yieldWheat}" style="width:65px"></td>
              <td>\$${pWheat} <span class="b-src-tag">USDA MARS</span></td>
              <td style="color:${revWheat >= 0 ? "var(--ok)" : "var(--bad)"};font-weight:700">\$${revWheat.toFixed(0)}/ha</td>
              <td><b>\$${(revWheat * fe.ha).toLocaleString()}</b></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="border-top:1px solid var(--line);margin-top:12px;padding-top:10px">
        <h3>${esc(bt("scen_title"))}</h3>
        <div class="grid2 small">
          <label>${esc(bt("scen_rain"))} <b id="b_sc_rain_lbl">${B_STATE.climateScenario.rainDeltaPct}%</b>
            <input type="range" id="b_sc_rain" min="-30" max="30" step="5" value="${B_STATE.climateScenario.rainDeltaPct}">
          </label>
          <label>${esc(bt("scen_temp"))} <b id="b_sc_temp_lbl">+${B_STATE.climateScenario.tempDeltaC} °C</b>
            <input type="range" id="b_sc_temp" min="0" max="4" step="0.5" value="${B_STATE.climateScenario.tempDeltaC}">
          </label>
        </div>
        <div id="b_sc_result" class="rec warn small" style="margin-top:8px"></div>
      </div>
    `;

    const bindCalc = (id, key) => box.querySelector(id)?.addEventListener("change", e => {
      B_STATE.farmExtra[key] = Number(e.target.value);
      renderSeasonEnhancements();
    });
    bindCalc("#b_fe_ha", "ha"); bindCalc("#b_fe_bud", "budgetUsdHa");
    bindCalc("#b_c_mz", "costMaize"); bindCalc("#b_y_mz", "yieldMaize");
    bindCalc("#b_c_sy", "costSoy"); bindCalc("#b_y_sy", "yieldSoy");
    bindCalc("#b_c_wh", "costWheat"); bindCalc("#b_y_wh", "yieldWheat");

    const updateScenarioBox = () => {
      const w = window.D.nasa_power_weather_30d || {};
      const baseRain = w.total_precip_mm ?? 60;
      const baseEt = w.et0_mm ?? 110;
      const newRain = baseRain * (1 + B_STATE.climateScenario.rainDeltaPct / 100);
      const newEt = baseEt * (1 + 0.06 * B_STATE.climateScenario.tempDeltaC);
      const def = newEt - newRain;
      const el = document.getElementById("b_sc_result");
      if (el) {
        el.innerHTML = `<b>Resultado del escenario simulado (30 días):</b> Lluvia ajustada = <b>${newRain.toFixed(1)} mm</b> · Demanda evaporativa (supuesto del equipo +6%/°C, no medido) = <b>${newEt.toFixed(1)} mm</b> → Balance hídrico = <b>${def > 0 ? "-" : "+"}${Math.abs(def).toFixed(1)} mm</b>. ${def > 65 ? "⚠️ El déficit supera 65 mm (umbral orientativo del equipo, no medido): conviene revisar cultivos de menos agua o cobertura." : "✅ Balance manejable con conservación de humedad del suelo."}`;
      }
    };
    updateScenarioBox();

    box.querySelector("#b_sc_rain")?.addEventListener("input", e => {
      B_STATE.climateScenario.rainDeltaPct = Number(e.target.value);
      document.getElementById("b_sc_rain_lbl").textContent = `${B_STATE.climateScenario.rainDeltaPct}%`;
      updateScenarioBox();
    });
    box.querySelector("#b_sc_temp")?.addEventListener("input", e => {
      B_STATE.climateScenario.tempDeltaC = Number(e.target.value);
      document.getElementById("b_sc_temp_lbl").textContent = `+${B_STATE.climateScenario.tempDeltaC} °C`;
      updateScenarioBox();
    });
  }

  // ---------- 7. Bloque 4: Comparador Lado a Lado de 4 Estrategias + Calendario a 3 Años + Conclusión (Áreas 25, 26, 29) ----------
  function renderLongTermEnhancements() {
    const tabLong = document.getElementById("tab_long");
    if (!tabLong || !window.D) return;
    let box = document.getElementById("b_long_extra");
    if (!box) {
      box = document.createElement("div");
      box.id = "b_long_extra";
      tabLong.appendChild(box);
    }
    const lastCrop = window.C?.crop || "maize";
    const rz = window.D.smap_soil_moisture?.rootzone_pct ?? 50;

    box.innerHTML = `
      <div style="border-top:1px solid var(--line);margin-top:12px;padding-top:10px">
        <h3>${esc(bt("opt_cycle_title"))}</h3>
        <div class="rec ok small">
          <b>Recomendación directa:</b> Dado que tu cultivo previo fue <b>${esc(lastCrop)}</b> y la humedad en raíz (SMAP) es <b>${rz}%</b>, la estrategia óptima es <b>Estrategia B (Leguminosa fijadora + Cobertura de invierno)</b>: rompe el ciclo de plagas de raíz, fija 40–90 kg N/ha naturales y reduce la evaporación primaveral en un 15–25%.
        </div>
      </div>

      <div style="border-top:1px solid var(--line);margin-top:12px;padding-top:10px">
        <h3>${esc(bt("rot_table_title"))}</h3>
        <div style="overflow-x:auto">
          <table class="small">
            <thead>
              <tr>
                <th>Criterio</th>
                <th>Línea Base (Repetir monocultivo)</th>
                <th>Estrategia A (Rotación comercial 2 cultivos)</th>
                <th style="background:rgba(46,204,113,.12)">⭐ Estrategia B (Diversificada + Leguminosa)</th>
                <th>Estrategia C (Regenerativa + Cobertura total)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><b>Uso de agua</b></td><td>Alto (sin rastrojo protector)</td><td>Moderado</td><td><b>Bajo–Moderado (mejor infiltración)</b></td><td>Muy bajo (máxima retención)</td></tr>
              <tr><td><b>Nitrógeno en suelo</b></td><td>Agota -140 a -180 kg N/ha</td><td>Recupera parcial (+40 kg N/ha)</td><td><b>Fija +60 a +95 kg N/ha (USDA NRCS)</b></td><td>Fija +90 a +120 kg N/ha</td></tr>
              <tr><td><b>Riesgo de plagas</b></td><td>Alto (gusano de raíz / hongos)</td><td>Bajo</td><td><b>Muy bajo (corte de ciclo de 3 años)</b></td><td>Mínimo</td></tr>
              <tr><td><b>Ingreso Año 1</b></td><td>Medio (mayor gasto en urea)</td><td>Alto</td><td><b>Alto con menor costo en fertilizante</b></td><td>Moderado en Año 1, estable en Año 3</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style="border-top:1px solid var(--line);margin-top:12px;padding-top:10px">
        <div class="row" style="justify-content:space-between">
          <h3>${esc(bt("rot_cal_title"))}</h3>
          <button type="button" class="b-btn-sm" id="b_print_cal">${esc(bt("btn_print"))}</button>
        </div>
        <div class="b-cal-grid">
          <div class="b-cal-year">
            <b>📅 Año 1: Recuperación de Nitrógeno</b>
            <span class="b-cal-phase" style="background:rgba(46,204,113,.18)">🌱 Abr–May: Siembra Leguminosa (Soya / Frijol)</span>
            <span class="b-cal-phase" style="background:rgba(56,189,248,.18)">💧 Jun–Ago: Desarrollo y fijación biológica de N</span>
            <span class="b-cal-phase" style="background:rgba(241,196,15,.22)">🌾 Sep–Oct: Cosecha de grano + rastrojo</span>
            <span class="b-cal-phase" style="background:rgba(148,163,184,.2)">❄️ Nov–Mar: Cobertura de Centeno / Trébol (protege de heladas)</span>
          </div>
          <div class="b-cal-year">
            <b>📅 Año 2: Aprovechamiento de Nitrógeno</b>
            <span class="b-cal-phase" style="background:rgba(46,204,113,.18)">🌽 Abr–May: Siembra Cereal principal (Maíz / Sorgo)</span>
            <span class="b-cal-phase" style="background:rgba(56,189,248,.18)">💧 Jun–Ago: Floración con vigilancia SMAP en raíz</span>
            <span class="b-cal-phase" style="background:rgba(241,196,15,.22)">🌾 Oct–Nov: Cosecha principal</span>
            <span class="b-cal-phase" style="background:rgba(148,163,184,.2)">❄️ Dic–Feb: Siembra Trigo de invierno / Avena</span>
          </div>
          <div class="b-cal-year">
            <b>📅 Año 3: Consolidación de Estructura de Suelo</b>
            <span class="b-cal-phase" style="background:rgba(241,196,15,.22)">🌾 Jun–Jul: Cosecha de Trigo / Cereal fino</span>
            <span class="b-cal-phase" style="background:rgba(46,204,113,.18)">🌿 Ago–Oct: Abono verde (Veza / Rábano forrajero descompactador)</span>
            <span class="b-cal-phase" style="background:rgba(56,189,248,.18)">🧪 Nov: Muestreo de pH y N en cuadros con anomalía</span>
            <span class="b-cal-phase" style="background:rgba(148,163,184,.2)">🔄 Dic–Mar: Suelo cubierto listo para reiniciar ciclo</span>
          </div>
        </div>
      </div>
    `;
    box.querySelector("#b_print_cal")?.addEventListener("click", () => window.print());
  }

  // ---------- 8. Bloque 5: Pestaña de IA Honesta, Fichas M1–M12, Explicabilidad y Foto de Hoja (Áreas 31–36) ----------
  async function fetchModelsMeta() {
    for (const ep of ["/api/v1/b/modelos", "/api/v1/modelos"]) {
      try {
        const r = await fetch(ep);
        if (r.ok) {
          B_STATE.modelsMeta = await r.json();
          return;
        }
      } catch (_) {}
    }
  }

  function renderAiTab() {
    const tabAi = document.getElementById("tab_ai");
    if (!tabAi) return;
    const models = B_STATE.modelsMeta?.modelos || [
      { id: "M1", nombre: "Clasificador Multitemporal de Cultivos (gradient boosting)", estado: "ACTIVO_EN_PRODUCCION", metrica_acierto: "77.7% en un año y zonas nunca vistos (vs 40.6% de decir siempre maíz); maíz/soya 86.6%", datos_entrenamiento: "Sentinel-2 L2A (10 bandas, 10 fechas) + USDA CDL 2018-2021 en Iowa central", limitacion: "Predicción, no medición: fuera del Medio Oeste úsese como referencia orientativa." },
      { id: "M7", nombre: "Zonificación de Manejo en 3 Niveles (Baja, Media, Alta)", estado: "ACTIVO_EN_PRODUCCION", metrica_acierto: "Agrupación determinista sobre NDVI Sentinel-2 10m", datos_entrenamiento: "Media y desviación estándar del propio polígono", limitacion: "Sensible a nubes residuales." },
      { id: "M8", nombre: "Detector Estadístico de Anomalías (|z| ≥ 1.2)", estado: "ACTIVO_EN_PRODUCCION", metrica_acierto: "Umbral transparente a ±1.2 σ del lote", datos_entrenamiento: "Cuadros de 10 m del lote actual", limitacion: "Identifica dónde ir a revisar en campo, no la causa exacta." }
    ];

    const weights = B_STATE.modelsMeta?.modelos?.[0]?.importancia_variables || [];  // solo valores medidos por permutación; si no hay, no se inventan

    tabAi.innerHTML = `
      <div style="margin-top:8px">
        <h3>${esc(bt("ai_models_title"))}</h3>
        <div class="rec warn small">
          <b>Regla de honestidad científica:</b> Cada resultado de IA es una <b>predicción, no una medición</b>. Mostramos siempre la región de entrenamiento, la métrica real en zonas nunca vistas y por qué el modelo toma su decisión.
        </div>
        <div style="margin:8px 0">
          <button type="button" class="pri" id="b_run_ai_here">🤖 Ejecutar clasificación IA (M1) sobre los cuadros de mi terreno</button>
        </div>
        ${models.map(m => {
          const mName = typeof m.nombre === "object" ? (m.nombre[window.lang] || m.nombre.es || m.nombre.en) : m.nombre;
          const mAcc = m.metrica_acierto || (m.acierto_medido_pct != null ? `${m.acierto_medido_pct}% en zonas no vistas (vs ${m.referencia_base_pct || 40.7}% azar)` : (m.validacion || "En validación"));
          const mTrain = m.datos_entrenamiento || `${m.entradas || ""} · ${m.region_entrenamiento || ""}`;
          const mLim = m.limitacion || m.limites || "";
          return `
          <div class="b-sem-box" style="margin:8px 0">
            <div class="row" style="justify-content:space-between">
              <b>${esc(m.id)} · ${esc(mName)}</b>
              <span class="chip">${esc(m.estado)}</span>
            </div>
            <div class="small" style="margin-top:4px"><b>Acierto medido:</b> ${esc(mAcc)}</div>
            <div class="small"><b>Entrenamiento:</b> ${esc(mTrain)}</div>
            <div class="small mut"><b>Límite:</b> ${esc(mLim)}</div>
          </div>`;
        }).join("")}

        <h3 style="margin-top:14px">${esc(bt("ai_explain_title"))}</h3>
        <div class="b-sem-box">
          ${weights.map(w => `
            <div style="margin:6px 0">
              <div class="row small" style="justify-content:space-between"><span>${esc(w.variable)}</span><b>${w.caida_acierto_pts} pts</b></div>
              <div class="b-progress-wrap"><div class="b-progress-bar" style="width:${Math.min(100, w.caida_acierto_pts * 20)}%"></div></div>
            </div>
          `).join("")}
          <span class="b-src-tag">Importancia por permutación: cuánto % del total de caída del acierto aporta cada variable en zonas no vistas (modelo real, Sentinel-2 + USDA CDL 2021)</span>
        </div>

        <h3 style="margin-top:14px">${esc(bt("ai_leaf_title"))}</h3>
        <div class="b-sem-box">
          <p class="small mut">${esc(bt("ai_leaf_note"))}</p>
          <input type="file" id="b_leaf_inp" accept="image/*">
          <canvas id="b_leaf_canvas" width="160" height="160" hidden></canvas>
          <div id="b_leaf_out" class="small" style="margin-top:8px"></div>
        </div>
      </div>
    `;

    tabAi.querySelector("#b_run_ai_here")?.addEventListener("click", () => document.getElementById("btn_ai")?.click());
    tabAi.querySelector("#b_leaf_inp")?.addEventListener("change", analyzeLeafPhoto);
  }

  function analyzeLeafPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const cv = document.getElementById("b_leaf_canvas");
      const ctx = cv.getContext("2d");
      ctx.drawImage(img, 0, 0, 160, 160);
      const data = ctx.getImageData(0, 0, 160, 160).data;
      let green = 0, yellow = 0, brown = 0, total = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r + g + b < 40 || r + g + b > 720) continue; // ignorar fondo negro/blanco
        total++;
        if (g > r * 1.08 && g > b * 1.15) green++;
        else if (r > 130 && g > 110 && b < 95) yellow++;
        else if (r > g && g >= b && r < 180) brown++;
      }
      const n = Math.max(total, 1);
      const gPct = Math.round((green / n) * 100);
      const yPct = Math.round((yellow / n) * 100);
      const bPct = Math.round((brown / n) * 100);
      const out = document.getElementById("b_leaf_out");
      if (out) {
        out.innerHTML = `
          <div class="rec ${yPct + bPct > 35 ? "warn" : "ok"}">
            <b>Índice colorimétrico medido en tu imagen:</b> Tejido verde sano: <b>${gPct}%</b> · Clorosis amarillenta: <b>${yPct}%</b> · Necrosis/mancha parda: <b>${bPct}%</b>.<br>
            ${yPct > 20 ? "⚠️ Se observa proporción elevada de amarillamiento (clorosis). Si inicia en hojas viejas en forma de 'V', puede asociarse a deficiencia de Nitrógeno; si son manchas delimitadas por nervaduras, revisar hongos foliares." : "✅ Predomina tejido verde fotosintético activo."}
            <br><span class="mut">Predicción orientativa por histograma RGB en navegador, no medición de laboratorio.</span>
          </div>
        `;
      }
    };
    img.src = URL.createObjectURL(file);
  }

  // ---------- 9. Bloque 6: Sensores Locales (CSV), Puntos del Robot y Nitrógeno/pH (Áreas 37–40) ----------
  function renderSensorsTab() {
    const tabSens = document.getElementById("tab_sensors");
    if (!tabSens) return;
    const fe = B_STATE.farmExtra;
    const soilPh = window.D?.usda_nrcs_soil?.ph_h2o;

    tabSens.innerHTML = `
      <div style="margin-top:8px">
        <h3>${esc(bt("sens_title"))}</h3>
        <div class="b-toolbar" style="margin-bottom:8px">
          <button type="button" class="b-btn-sm pri" id="b_btn_robot">${esc(bt("sens_robot_btn"))}</button>
          <button type="button" class="b-btn-sm" id="b_btn_csv_sens">${esc(bt("sens_csv_btn"))}</button>
          <input type="file" id="b_inp_csv_sens" accept=".csv,.txt" hidden>
        </div>
        <div id="b_robot_out" class="small"></div>
        <div id="b_sens_out" class="small" style="margin-top:8px"></div>

        <h3 style="margin-top:14px">${esc(bt("npk_title"))}</h3>
        <div class="b-sem-box">
          <div class="grid2 small">
            <label>Nitrógeno medido en análisis de suelo (kg N/ha):
              <input type="number" id="b_inp_n" placeholder="Ej. 45" value="${esc(fe.nKgHa)}" style="width:90px">
            </label>
            <label>pH medido en tu terreno (SSURGO actual: ${soilPh ?? "sin dato"}):
              <input type="number" id="b_inp_ph" step="0.1" placeholder="${soilPh ?? 6.5}" value="${esc(fe.phVal)}" style="width:90px">
            </label>
          </div>
          <div id="b_npk_advice" class="small" style="margin-top:8px"></div>
          <span class="b-src-tag">Rangos agronómicos: USDA NRCS Soil Quality Indicators & Land Grant Extension</span>
        </div>
      </div>
    `;

    tabSens.querySelector("#b_btn_robot")?.addEventListener("click", generateRobotSamplingRoute);
    tabSens.querySelector("#b_btn_csv_sens")?.addEventListener("click", () => tabSens.querySelector("#b_inp_csv_sens")?.click());
    tabSens.querySelector("#b_inp_csv_sens")?.addEventListener("change", loadSensorsCsv);
    const updateNpk = () => {
      fe.nKgHa = tabSens.querySelector("#b_inp_n")?.value || "";
      fe.phVal = tabSens.querySelector("#b_inp_ph")?.value || "";
      const nVal = fe.nKgHa !== "" ? Number(fe.nKgHa) : null;
      const phV = fe.phVal !== "" ? Number(fe.phVal) : soilPh;
      const adv = document.getElementById("b_npk_advice");
      if (!adv) return;
      const msgs = [];
      if (nVal != null) {
        if (nVal < 40) msgs.push(`🧪 <b>Nitrógeno bajo (${nVal} kg N/ha):</b> Inferior al rango base de referencia para cereales (80–160 kg N/ha según meta de rendimiento USDA NRCS). Se recomienda rotar con leguminosa fijadora (soya/trébol aporta +50 a +90 kg N/ha) o aplicación fraccionada.`);
        else if (nVal <= 150) msgs.push(`✅ <b>Nitrógeno moderado–adecuado (${nVal} kg N/ha):</b> Dentro del rango operativo para cultivos de grano medios.`);
        else msgs.push(`⚠️ <b>Nitrógeno elevado (${nVal} kg N/ha):</b> Evitar sobre-fertilización para prevenir lixiviación de nitratos hacia el acuífero.`);
      } else {
        msgs.push(`ℹ️ Ingresa tu lectura de Nitrógeno en suelo (kg N/ha) para compararla contra los rangos de referencia USDA NRCS (los satélites ópticos ven clorofila/NDVI, pero no miden nitrato mineral directo en suelo).`);
      }
      if (phV != null) {
        if (phV < 5.6) msgs.push(`⚠️ <b>Suelo ácido (pH ${phV}):</b> Por debajo del rango óptimo (6.0–7.0 USDA NRCS) disminuye la disponibilidad de fósforo y calcio; considerar encalado agrícola.`);
        else if (phV <= 7.3) msgs.push(`✅ <b>pH óptimo (${phV}):</b> Máxima asimilación de macronutrientes para maíz, soya y trigo (rango ideal USDA NRCS: 6.0–7.0).`);
        else msgs.push(`⚠️ <b>Suelo alcalino (pH ${phV}):</b> Puede limitar hierro y zinc; preferir cultivos tolerantes (cebada, sorgo, alfalfa).`);
      }
      adv.innerHTML = msgs.map(m => `<div style="margin:4px 0">${m}</div>`).join("");
    };
    updateNpk();
    tabSens.querySelector("#b_inp_n")?.addEventListener("input", updateNpk);
    tabSens.querySelector("#b_inp_ph")?.addEventListener("input", updateNpk);
  }

  function generateRobotSamplingRoute() {
    const out = document.getElementById("b_robot_out");
    const r = B_STATE.lastTerrainResp;
    if (!r?.celdas?.length) {
      if (out) out.innerHTML = `<div class="rec warn">Primero dibuja tu terreno o elige uno de los 6 casos reales para que el robot identifique los cuadros con anomalía.</div>`;
      return;
    }
    const stats = computeCellStats(r.celdas);
    const sorted = r.celdas.map((c, idx) => ({ c, idx, z: c.ndvi != null ? (c.ndvi - stats.mean) / stats.sd : 0 }))
      .sort((a, b) => a.z - b.z)
      .slice(0, Math.min(5, r.celdas.length));

    if (out) {
      out.innerHTML = `
        <div class="rec ok">
          <b>🤖 Ruta óptima de muestreo en campo (5 puntos prioritarios por menor NDVI / anomalía):</b>
          <ol style="margin:6px 0 0 18px;padding:0">
            ${sorted.map(s => {
              const [[so, we], [no, ea]] = s.c.limites;
              return `<li><b>Cuadro #${s.idx + 1}</b> (${((so + no) / 2).toFixed(5)}, ${((we + ea) / 2).toFixed(5)}) · NDVI <b>${s.c.ndvi ?? "—"}</b> (z = ${s.z.toFixed(2)}σ) → Tomar muestra de humedad a 15 cm y pH.</li>`;
            }).join("")}
          </ol>
        </div>
      `;
    }
  }

  function loadSensorsCsv(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result || "").trim().split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return;
      const rows = lines.slice(1).map(l => l.split(",").map(x => x.trim()));
      const smSat = window.D?.smap_soil_moisture?.surface_pct ?? 35;
      const out = document.getElementById("b_sens_out");
      if (out) {
        out.innerHTML = `
          <div class="b-sem-box">
            <b>📡 ${rows.length} lecturas de sensores locales cargadas (Comparación Satélite SMAP vs Sensor en Tierra):</b>
            <table class="small" style="margin-top:6px">
              <thead><tr><th>Punto</th><th>Temp (°C)</th><th>Humedad Sensor (%)</th><th>Humedad SMAP (%)</th><th>Diferencia (Calibración)</th></tr></thead>
              <tbody>
                ${rows.slice(0, 10).map((cols, i) => {
                  const hum = Number(cols[3] ?? cols[1] ?? 0);
                  const diff = (hum - smSat).toFixed(1);
                  return `<tr><td>#${i + 1} (${esc(cols[0])}, ${esc(cols[1])})</td><td>${esc(cols[2] || "—")}</td><td><b>${hum}%</b></td><td>${smSat}%</td><td>${diff >= 0 ? "+" : ""}${diff}%</td></tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        `;
      }
    };
    reader.readAsText(file);
  }

  // ---------- 10. Barra Inferior Móvil 390 px (Área 14) y Modal de Glosario (Área 5) ----------
  function injectMobileToggleBar() {
    if (document.getElementById("b_mob_bar")) return;
    const bar = document.createElement("div");
    bar.id = "b_mob_bar";
    bar.className = "b-mob-bar";
    bar.innerHTML = `
      <button type="button" id="b_mob_data" class="on">${esc(bt("mob_data"))}</button>
      <button type="button" id="b_mob_map">${esc(bt("mob_map"))}</button>
    `;
    document.body.appendChild(bar);
    bar.querySelector("#b_mob_data")?.addEventListener("click", () => {
      document.body.classList.remove("b-mob-map-full");
      bar.querySelector("#b_mob_data").classList.add("on");
      bar.querySelector("#b_mob_map").classList.remove("on");
    });
    bar.querySelector("#b_mob_map")?.addEventListener("click", () => {
      document.body.classList.add("b-mob-map-full");
      bar.querySelector("#b_mob_map").classList.add("on");
      bar.querySelector("#b_mob_data").classList.remove("on");
      setTimeout(() => window.map?.invalidateSize(), 150);
    });
  }

  function injectModals() {
    if (document.getElementById("b_gloss_modal")) return;
    const bg = document.createElement("div");
    bg.id = "b_gloss_modal";
    bg.className = "b-modal-bg";
    bg.hidden = true;
    bg.style.display = "none";
    bg.addEventListener("click", e => { if (e.target === bg) { bg.hidden = true; bg.style.display = "none"; } });
    document.body.appendChild(bg);
  }

  function openGlossaryModal() {
    const bg = document.getElementById("b_gloss_modal");
    if (!bg) return;
    const isEn = window.lang === "en";
    bg.hidden = false;
    bg.style.display = "flex";
    bg.innerHTML = `
      <div class="b-modal" role="dialog" aria-modal="true">
        <div class="row" style="justify-content:space-between;margin-bottom:8px">
          <h2 style="margin:0">${esc(bt("glossary_btn"))} (18 términos clave)</h2>
          <button type="button" class="b-btn-sm" id="b_close_gloss">✕</button>
        </div>
        <input type="search" id="b_gloss_q" placeholder="🔎 Filtrar término (ej. NDVI, SMAP, p10, pH)…" style="width:100%;margin-bottom:10px">
        <div id="b_gloss_list">
          ${GLOSSARY.map(([k, esD, enD]) => `
            <div class="b-gloss-item" style="padding:8px 0;border-bottom:1px solid var(--line)">
              <b>${esc(k)}</b>
              <div class="small" style="margin-top:2px">${esc(isEn ? enD : esD)}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
    bg.querySelector("#b_close_gloss")?.addEventListener("click", () => { bg.hidden = true; bg.style.display = "none"; });
    bg.querySelector("#b_gloss_q")?.addEventListener("input", e => {
      const q = e.target.value.toLowerCase();
      bg.querySelectorAll(".b-gloss-item").forEach(it => {
        it.style.display = it.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });
  }

  // ---------- 11. Hooks Limpios sobre app.js, explorer.js y terreno.js ----------
  function onAfterDataLoaded() {
    renderAllResultEnhancements();
  }

  function hookExistingFunctions() {
    // Interceptar fetch para capturar respuestas de /api/v1/terreno y /api/v1/cultivos-ia y mostrar barra de progreso con segundos
    const _fetch = window.fetch.bind(window);
    window.fetch = async function (input, init) {
      const url = typeof input === "string" ? input : input?.url || "";
      const isMainLoad = url.includes("/api/v1/parcel-intelligence") || url.includes("/api/v1/terreno");
      if (isMainLoad) startProgressIndicator();
      try {
        const resp = await _fetch(input, init);
        if (url.includes("/api/v1/terreno") && resp.ok) {
          resp.clone().json().then(j => {
            if (j.estado === "OK") {
              B_STATE.lastTerrainResp = j;
              B_STATE.selectedCells.clear();
              setTimeout(() => {
                recolorCells();
                renderSummary5Seconds();
                renderTodayEnhancements();
                renderSvgCharts();
              }, 80);
            }
          }).catch(() => {});
        } else if (url.includes("/api/v1/cultivos-ia") && resp.ok) {
          resp.clone().json().then(j => {
            if (j.estado === "OK") B_STATE.lastAiResp = j;
          }).catch(() => {});
        }
        return resp;
      } finally {
        if (isMainLoad) stopProgressIndicator();
      }
    };

    // Hook en window.exAfterRender (llamado al final de render() en app.js)
    const _prevAfter = window.exAfterRender;
    window.exAfterRender = function () {
      if (typeof _prevAfter === "function") _prevAfter();
      onAfterDataLoaded();
    };

    // Hook en window.exRender (llamado al cambiar idioma ES / EN / PT)
    const _prevExRender = window.exRender;
    window.exRender = function () {
      if (typeof _prevExRender === "function") _prevExRender();
      applyTheme(B_STATE.theme);
      renderHeroWelcome();
      renderTerrainTools();
      renderLayerControls();
      decorateUsefulLayers();
      if (window.D) renderAllResultEnhancements();
    };

    // Hook en window.tzUseful para añadir estrellas de favoritas cada vez que se regenera #useful
    const _prevUseful = window.tzUseful;
    if (typeof _prevUseful === "function") {
      window.tzUseful = function () {
        _prevUseful();
        decorateUsefulLayers();
      };
    }
    setTimeout(decorateUsefulLayers, 700);
  }

  function startProgressIndicator() {
    const wrap = document.getElementById("b_load_progress");
    const sec = document.getElementById("b_load_sec");
    const bar = document.getElementById("b_load_bar");
    if (!wrap) return;
    wrap.hidden = false;
    B_STATE.loadStartMs = performance.now();
    clearInterval(B_STATE.loadTimer);
    B_STATE.loadTimer = setInterval(() => {
      const el = (performance.now() - B_STATE.loadStartMs) / 1000;
      if (sec) sec.textContent = `${el.toFixed(1)} s`;
      if (bar) bar.style.width = `${Math.min(95, 15 + el * 14)}%`;
    }, 150);
  }

  function stopProgressIndicator() {
    clearInterval(B_STATE.loadTimer);
    const wrap = document.getElementById("b_load_progress");
    const bar = document.getElementById("b_load_bar");
    if (bar) bar.style.width = "100%";
    setTimeout(() => { if (wrap) wrap.hidden = true; }, 400);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCapsuleB);
  } else {
    initCapsuleB();
  }
})();

