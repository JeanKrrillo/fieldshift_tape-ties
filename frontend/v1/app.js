// Field Shift: todo lo que se pinta sale de /api/v1/parcel-intelligence. Lo que no llega se muestra como "sin dato".
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const g = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const T = {
  en: {
    search: "Search", search_ph: "Town, ranch or address", click_map: "Click the map to pick a parcel.", constraints: "Your farm", assist: "This tool assists; it never replaces the judgement of the farmer or a local agronomist.",
    sources: "Live data sources", viewjson: "View official live JSON", loading: "Querying NASA, USDA, USGS and others live. The first query of a new parcel can take up to 25 s.", pick: "Pick a parcel on the map, search a place, or press a demo parcel.",
    tab_today: "Today", tab_season: "This season", tab_long: "5–10 years", crop_now: "Current crop", water: "Water", machine: "Machinery", priority: "Top priority",
    c_maize: "Continuous maize", c_soy: "Continuous soy", c_wheat: "Wheat–fallow", c_veg: "Vegetables", w_rain: "Rain only", w_irrig: "Irrigation available", w_limited: "Limited irrigation",
    m_conv: "Conventional", m_notill: "No-till", m_forage: "Forage / livestock equipment", p_income: "Net income", p_water: "Save water", p_soil: "Regenerate soil", p_pests: "Break pest cycles",
    mode_farmer: "Farmer mode", mode_agr: "Agronomist mode", mode_sci: "Scientist / judge mode", nodata: "no data",
    today_title: "Today and next 7 days", forecast: "Forecast at 1 km (Meteomatics)", temp: "Temp °C", rain: "Rain mm", soilidx: "Soil moisture index", rivers: "Rivers and wells nearby (USGS, latest reading)", passes: "Latest satellite passes over the parcel (NASA CMR)",
    season_title: "Water balance by month", rain_slider: "Rain change", rain_mm: "Rain (NASA POWER, long-term monthly average)", et_mm: "Water use by crops (OpenET, last season)", deficit: "Months where water use exceeds rain", none: "none",
    et_note: "Water use data exists only for the months OpenET returned. OpenET covers the continental US only.", soil_profile: "Soil profile (USDA SSURGO)", depth: "Depth cm", om: "Organic matter %", ph: "pH", clay: "Clay %", density: "Bulk density g/cm³", kfact: "Erodibility K", avail: "Available water 0–100 cm", series: "Soil series", drainage: "Drainage",
    market: "Market report (USDA AMS)", rot_title: "Rotation scenarios", baseline: "Your current rotation", sA: "Strategy A · Income", sB: "Strategy B · Water saving", sC: "Strategy C · Soil regeneration",
    seq: "Sequence", gains: "What you gain", costs: "What you give up", criteria: "Four agronomic criteria", legume: "Legume nitrogen fixation", cover: "Winter ground cover", families: "Botanical families", fit: "Fits your machinery", yes: "yes", no: "no", unk: "unknown", warn_notill: "needs no-till equipment",
    evidence: "Evidence from your parcel", gapsx: "Data gaps", validate: "Check locally before planting", match: "Matches your top priority", rule: "Team agronomic rule, not a measurement.",
    long_title: "Long term", annual: "Climate summary (NASA POWER)", t_mean: "Mean temp °C", p_year: "Rain mm/year", sm_top: "Surface moisture %", sm_root: "Root-zone moisture %", wind: "Wind m/s", evt: "Vegetation class code (LANDFIRE 2025)", evt_note: "This is the class code; the name lookup is pending.", scenes: "Recent satellite scenes (vigor and clouds)",
    harm_title: "Resolutions of each source", harm_note: "Each source is shown at its own resolution, side by side by location. Resampling to a common 30 m / 1 km grid is not built yet.", col_src: "Source", col_res: "Resolution", col_used: "Used for",
    gaps_title: "What is not measured or still pending", st_ok: "responding", st_error: "failed", st_pending: "key missing", st_nocov: "no coverage here", nrcs_txt: "Find your local USDA NRCS service center", soilweb_txt: "Open SoilWeb for this parcel",
    g_bare: "Bare-soil calendar and ± ranges exist only where OpenET has coverage (continental US).", g_n: "Nitrogen fixed in kg/ha: no source gives it, so it is not shown.", g_price: "Prices per ton: only the market report header is read, not the price rows.", g_temp: "Temperature slider: removed until the meaning of NASA POWER monthly maximum is checked (July shows 42 °C in Iowa).", g_chat: "Question-and-answer assistant: pending.", g_text: "Server recommendation text is in Spanish only.", g_hist: "Not visible from space: herbicide history, nematodes, sub-meter salinity.", bare_title: "Bare-soil calendar (vegetation index, OpenET)", bare_rule: "Months with a vegetation index below 0.30 count as little ground cover. 0.30 is a team rule, not a measurement. Index: monthly mean from Landsat via OpenET, last full year.", maybe: "Possible deficit (rain falls inside the OpenET model range)", sure: "Sure deficit (rain below the lowest model estimate)", range_note: "Black lines on the orange bars are the OpenET model range."
  },
  es: {
    search: "Buscar", search_ph: "Pueblo, rancho o dirección", click_map: "Haz clic en el mapa para elegir una parcela.", constraints: "Tu finca", assist: "Esta herramienta asiste; nunca sustituye el criterio del agricultor ni de un agrónomo local.",
    sources: "Fuentes de datos en vivo", viewjson: "Ver JSON oficial en vivo", loading: "Consultando NASA, USDA, USGS y otras en vivo. La primera consulta de una parcela nueva puede tardar hasta 25 s.", pick: "Elige una parcela en el mapa, busca un lugar o presiona una parcela de demostración.",
    tab_today: "Hoy", tab_season: "Esta temporada", tab_long: "5–10 años", crop_now: "Cultivo actual", water: "Agua", machine: "Maquinaria", priority: "Prioridad principal",
    c_maize: "Maíz continuo", c_soy: "Soja continua", c_wheat: "Trigo–barbecho", c_veg: "Hortalizas", w_rain: "Solo lluvia", w_irrig: "Riego disponible", w_limited: "Riego limitado",
    m_conv: "Convencional", m_notill: "Siembra directa", m_forage: "Equipo de forraje / ganadería", p_income: "Ingreso neto", p_water: "Ahorrar agua", p_soil: "Regenerar suelo", p_pests: "Romper ciclos de plagas",
    mode_farmer: "Modo agricultor", mode_agr: "Modo agrónomo", mode_sci: "Modo científico / juez", nodata: "sin dato",
    today_title: "Hoy y próximos 7 días", forecast: "Pronóstico a 1 km (Meteomatics)", temp: "Temp °C", rain: "Lluvia mm", soilidx: "Índice de humedad del suelo", rivers: "Ríos y pozos cercanos (USGS, última lectura)", passes: "Últimas pasadas de satélite sobre la parcela (NASA CMR)",
    season_title: "Balance de agua por mes", rain_slider: "Cambio de lluvia", rain_mm: "Lluvia (NASA POWER, promedio mensual de largo plazo)", et_mm: "Consumo de agua de los cultivos (OpenET, última temporada)", deficit: "Meses donde el consumo supera a la lluvia", none: "ninguno",
    et_note: "Solo hay consumo de agua en los meses que devolvió OpenET. OpenET cubre solo EE. UU. continental.", soil_profile: "Perfil del suelo (USDA SSURGO)", depth: "Profundidad cm", om: "Materia orgánica %", ph: "pH", clay: "Arcilla %", density: "Densidad aparente g/cm³", kfact: "Erodabilidad K", avail: "Agua disponible 0–100 cm", series: "Serie de suelo", drainage: "Drenaje",
    market: "Reporte de mercado (USDA AMS)", rot_title: "Escenarios de rotación", baseline: "Tu rotación actual", sA: "Estrategia A · Ingreso", sB: "Estrategia B · Ahorro de agua", sC: "Estrategia C · Regeneración de suelo",
    seq: "Secuencia", gains: "Lo que ganas", costs: "Lo que sacrificas", criteria: "Cuatro criterios agronómicos", legume: "Fijación de nitrógeno por leguminosas", cover: "Cobertura de suelo en invierno", families: "Familias botánicas", fit: "Encaja con tu maquinaria", yes: "sí", no: "no", unk: "no se sabe", warn_notill: "requiere siembra directa",
    evidence: "Evidencia de tu parcela", gapsx: "Vacíos de información", validate: "Verifica en campo antes de sembrar", match: "Coincide con tu prioridad principal", rule: "Regla agronómica del equipo, no una medición.",
    long_title: "Largo plazo", annual: "Resumen del clima (NASA POWER)", t_mean: "Temp media °C", p_year: "Lluvia mm/año", sm_top: "Humedad superficial %", sm_root: "Humedad en raíz %", wind: "Viento m/s", evt: "Código de clase de vegetación (LANDFIRE 2025)", evt_note: "Es el código de la clase; falta traducirlo a su nombre.", scenes: "Escenas recientes de satélite (vigor y nubes)",
    harm_title: "Resolución de cada fuente", harm_note: "Cada fuente se muestra a su propia resolución, una junto a otra por ubicación. Aún no se remuestrea a una cuadrícula común de 30 m / 1 km.", col_src: "Fuente", col_res: "Resolución", col_used: "Se usa para",
    gaps_title: "Lo que no se mide o está pendiente", st_ok: "responde", st_error: "falló", st_pending: "falta llave", st_nocov: "sin cobertura aquí", nrcs_txt: "Encuentra tu centro de servicio local del USDA NRCS", soilweb_txt: "Abrir SoilWeb para esta parcela",
    g_bare: "El calendario de suelo desnudo y los rangos ± existen solo donde OpenET tiene cobertura (EE. UU. continental).", g_n: "Nitrógeno fijado en kg/ha: ninguna fuente lo da, por eso no se muestra.", g_price: "Precios por tonelada: solo se lee el encabezado del reporte, no las filas de precio.", g_temp: "Control de temperatura: quitado hasta revisar qué mide el máximo mensual de NASA POWER (julio sale en 42 °C en Iowa).", g_chat: "Asistente de preguntas y respuestas: pendiente.", g_text: "El texto de recomendación del servidor está solo en español.", g_hist: "No se ve desde el espacio: historial de herbicidas, nematodos, salinidad submétrica.", bare_title: "Calendario de suelo desnudo (índice de vegetación, OpenET)", bare_rule: "Los meses con índice de vegetación menor a 0.30 cuentan como poca cobertura del suelo. El 0.30 es una regla del equipo, no una medición. Índice: promedio mensual de Landsat vía OpenET, último año completo.", maybe: "Déficit posible (la lluvia cae dentro del rango de los modelos de OpenET)", sure: "Déficit seguro (la lluvia queda por debajo de la estimación más baja)", range_note: "Las líneas negras sobre las barras naranjas son el rango de los modelos de OpenET."
  },
  pt: {
    search: "Buscar", search_ph: "Cidade, fazenda ou endereço", click_map: "Clique no mapa para escolher uma parcela.", constraints: "Sua fazenda", assist: "Esta ferramenta ajuda; nunca substitui o critério do agricultor nem de um agrônomo local.",
    sources: "Fontes de dados ao vivo", viewjson: "Ver JSON oficial ao vivo", loading: "Consultando NASA, USDA, USGS e outras ao vivo. A primeira consulta de uma parcela nova pode levar até 25 s.", pick: "Escolha uma parcela no mapa, busque um lugar ou pressione uma parcela de demonstração.",
    tab_today: "Hoje", tab_season: "Esta safra", tab_long: "5–10 anos", crop_now: "Cultura atual", water: "Água", machine: "Maquinário", priority: "Prioridade principal",
    c_maize: "Milho contínuo", c_soy: "Soja contínua", c_wheat: "Trigo–pousio", c_veg: "Hortaliças", w_rain: "Só chuva", w_irrig: "Irrigação disponível", w_limited: "Irrigação limitada",
    m_conv: "Convencional", m_notill: "Plantio direto", m_forage: "Equipamento de forragem / pecuária", p_income: "Renda líquida", p_water: "Economizar água", p_soil: "Regenerar o solo", p_pests: "Quebrar ciclos de pragas",
    mode_farmer: "Modo agricultor", mode_agr: "Modo agrônomo", mode_sci: "Modo cientista / juiz", nodata: "sem dado",
    today_title: "Hoje e próximos 7 dias", forecast: "Previsão a 1 km (Meteomatics)", temp: "Temp °C", rain: "Chuva mm", soilidx: "Índice de umidade do solo", rivers: "Rios e poços próximos (USGS, última leitura)", passes: "Últimas passagens de satélite sobre a parcela (NASA CMR)",
    season_title: "Balanço de água por mês", rain_slider: "Variação da chuva", rain_mm: "Chuva (NASA POWER, média mensal de longo prazo)", et_mm: "Consumo de água das culturas (OpenET, última safra)", deficit: "Meses em que o consumo supera a chuva", none: "nenhum",
    et_note: "Só há consumo de água nos meses que o OpenET devolveu. O OpenET cobre apenas os EUA continentais.", soil_profile: "Perfil do solo (USDA SSURGO)", depth: "Profundidade cm", om: "Matéria orgânica %", ph: "pH", clay: "Argila %", density: "Densidade aparente g/cm³", kfact: "Erodibilidade K", avail: "Água disponível 0–100 cm", series: "Série de solo", drainage: "Drenagem",
    market: "Relatório de mercado (USDA AMS)", rot_title: "Cenários de rotação", baseline: "Sua rotação atual", sA: "Estratégia A · Renda", sB: "Estratégia B · Economia de água", sC: "Estratégia C · Regeneração do solo",
    seq: "Sequência", gains: "O que você ganha", costs: "O que você abre mão", criteria: "Quatro critérios agronômicos", legume: "Fixação de nitrogênio por leguminosas", cover: "Cobertura do solo no inverno", families: "Famílias botânicas", fit: "Combina com seu maquinário", yes: "sim", no: "não", unk: "não se sabe", warn_notill: "exige plantio direto",
    evidence: "Evidência da sua parcela", gapsx: "Lacunas de informação", validate: "Verifique no campo antes de plantar", match: "Combina com sua prioridade principal", rule: "Regra agronômica da equipe, não uma medição.",
    long_title: "Longo prazo", annual: "Resumo do clima (NASA POWER)", t_mean: "Temp média °C", p_year: "Chuva mm/ano", sm_top: "Umidade superficial %", sm_root: "Umidade na raiz %", wind: "Vento m/s", evt: "Código da classe de vegetação (LANDFIRE 2025)", evt_note: "É o código da classe; falta traduzi-lo para o nome.", scenes: "Cenas recentes de satélite (vigor e nuvens)",
    harm_title: "Resolução de cada fonte", harm_note: "Cada fonte aparece na sua própria resolução, lado a lado por localização. Ainda não há reamostragem para uma grade comum de 30 m / 1 km.", col_src: "Fonte", col_res: "Resolução", col_used: "Usada para",
    gaps_title: "O que não é medido ou está pendente", st_ok: "responde", st_error: "falhou", st_pending: "falta chave", st_nocov: "sem cobertura aqui", nrcs_txt: "Encontre seu centro de serviço local do USDA NRCS", soilweb_txt: "Abrir o SoilWeb para esta parcela",
    g_bare: "O calendário de solo exposto e as faixas ± existem só onde o OpenET tem cobertura (EUA continental).", g_n: "Nitrogênio fixado em kg/ha: nenhuma fonte informa, por isso não aparece.", g_price: "Preços por tonelada: só o cabeçalho do relatório é lido, não as linhas de preço.", g_temp: "Controle de temperatura: removido até revisar o que mede o máximo mensal do NASA POWER (julho aparece com 42 °C em Iowa).", g_chat: "Assistente de perguntas e respostas: pendente.", g_text: "O texto de recomendação do servidor está só em espanhol.", g_hist: "Não se vê do espaço: histórico de herbicidas, nematoides, salinidade submétrica.", bare_title: "Calendário de solo exposto (índice de vegetação, OpenET)", bare_rule: "Meses com índice de vegetação abaixo de 0.30 contam como pouca cobertura do solo. O 0.30 é uma regra da equipe, não uma medição. Índice: média mensal do Landsat via OpenET, último ano completo.", maybe: "Déficit possível (a chuva cai dentro da faixa dos modelos do OpenET)", sure: "Déficit certo (a chuva fica abaixo da estimativa mais baixa)", range_note: "As linhas pretas sobre as barras laranjas são a faixa dos modelos do OpenET."
  },
};

// Reglas agronómicas del equipo (no son mediciones). fam = familias botánicas de la secuencia.
const STRAT = {
  A: { tag: "income", key: "sA", seq: { en: "Maize / soy → winter rye cover → grain legume", es: "Maíz / soja → centeno de cobertura invernal → leguminosa de grano", pt: "Milho / soja → centeio de cobertura de inverno → leguminosa de grão" }, legume: 1, cover: 1, fam: 2,
    gain: { en: "Highest commercial value per hectare", es: "Mayor valor comercial por hectárea", pt: "Maior valor comercial por hectare" }, cost: { en: "Highest water and fertilizer demand", es: "Mayor demanda de agua y fertilizante", pt: "Maior demanda de água e fertilizante" } },
  B: { tag: "water", key: "sB", seq: { en: "Drought-tolerant sorghum → chickpea / lentil → fallow with stubble", es: "Sorgo tolerante a sequía → garbanzo / lenteja → barbecho con rastrojo", pt: "Sorgo tolerante à seca → grão-de-bico / lentilha → pousio com palhada" }, legume: 1, cover: 0, fam: 2,
    gain: { en: "Lower crop water demand", es: "Menor demanda de agua del cultivo", pt: "Menor demanda de água da cultura" }, cost: { en: "Lower value per hectare; chickpea and lentil need a local market", es: "Menor valor por hectárea; garbanzo y lenteja necesitan mercado local", pt: "Menor valor por hectare; grão-de-bico e lentilha precisam de mercado local" } },
  C: { tag: "soil", key: "sC", seq: { en: "Crimson clover + oat → no-till soy → perennial alfalfa", es: "Trébol encarnado + avena → soja en siembra directa → alfalfa perenne", pt: "Trevo-encarnado + aveia → soja em plantio direto → alfafa perene" }, legume: 1, cover: 1, fam: 2, notill: 1,
    gain: { en: "Ground cover and biological nitrogen from legumes", es: "Cobertura del suelo y nitrógeno biológico de leguminosas", pt: "Cobertura do solo e nitrogênio biológico de leguminosas" }, cost: { en: "Needs no-till equipment and spring termination of the cover crop", es: "Requiere siembra directa y terminar la cobertura en primavera", pt: "Exige plantio direto e término da cobertura na primavera" } },
};
const BASE = { maize: { legume: 0, cover: 0, fam: 1 }, soy: { legume: 1, cover: 0, fam: 1 }, wheat: { legume: 0, cover: 0, fam: 1 }, veg: {} };
const RES = [["NASA POWER", "≈ 50 km", "rain, temperature, moisture"], ["SMAP (CMR)", "9 km", "soil-moisture passes"], ["Meteomatics", "1 km", "7-day forecast"], ["ECOSTRESS (CMR)", "70 m", "heat-stress passes"], ["GEDI (CMR)", "25 m", "canopy passes"],
  ["Sentinel-2", "10 m", "vigor, clouds"], ["Landsat 8/9, HLS", "30 m", "vigor, clouds"], ["OpenET", "30 m", "crop water use"], ["LANDFIRE", "30 m", "vegetation class"], ["USDA SSURGO", "soil map units", "soil profile"], ["USGS sensors", "points", "rivers and wells"]];

const PN = { "00060": ["Streamflow", "Caudal", "Vazão"], "00065": ["Water level", "Nivel del agua", "Nível da água"], "72019": ["Depth to water table", "Profundidad al nivel freático", "Profundidade do lençol"], "00095": ["Specific conductance", "Conductancia específica", "Condutância específica"], "99133": ["Nitrate + nitrite", "Nitrato + nitrito", "Nitrato + nitrito"] };
let lang = "en", D = null, sel = null, map, kml;
const pname = s => (PN[s.codigo_parametro] || [])[["en", "es", "pt"].indexOf(lang)] || s.parametro;
const C = { crop: "maize", water: "rain", machine: "conv", priority: "income", rain: 0 };
const t = k => T[lang][k] ?? T.en[k] ?? k;
const num = (v, d = 1) => (v == null || Number.isNaN(+v) ? t("nodata") : (+v).toFixed(d));
const tel = () => D.telemetria_oficial_en_vivo;

const K = {
  en: { w_title: "What is happening on your field?", w_sub: "Pick a place. We read NASA, USDA and USGS live data and tell you what it means for your farm.", tab_src: "Data and sources", rain: "Rain per year", temp: "Mean temperature", soilw: "Water held by the soil", et: "Crop water use, season", price: "per ton", pts: "price points", ok: "Rain covers the crop", wk: "Next 7 days", mm: "mm", pr: "Grain prices today", cur: "Rain in the next 24 h" },
  es: { w_title: "¿Qué está pasando en tu parcela?", w_sub: "Elige un lugar. Leemos datos en vivo de NASA, USDA y USGS y te decimos qué significan para tu finca.", tab_src: "Datos y fuentes", rain: "Lluvia al año", temp: "Temperatura media", soilw: "Agua que guarda el suelo", et: "Agua que usó el cultivo, temporada", price: "por tonelada", pts: "puntos de precio", ok: "La lluvia cubre al cultivo", wk: "Próximos 7 días", mm: "mm", pr: "Precios de granos hoy", cur: "Lluvia en las próximas 24 h" },
  pt: { w_title: "O que está acontecendo na sua lavoura?", w_sub: "Escolha um lugar. Lemos dados ao vivo da NASA, USDA e USGS e dizemos o que significam para sua fazenda.", tab_src: "Dados e fontes", rain: "Chuva por ano", temp: "Temperatura média", soilw: "Água retida no solo", et: "Água usada pela cultura, safra", price: "por tonelada", pts: "pontos de preço", ok: "A chuva cobre a cultura", wk: "Próximos 7 dias", mm: "mm", pr: "Preços de grãos hoje", cur: "Chuva nas próximas 24 h" } };
const k = x => (K[lang] || K.en)[x] ?? x;
function tile(ic, big, unit, label) {
  const na = big == null || big === "";
  return `<div class="tile ${na ? "na" : ""}"><div class="ic">${ic}</div><div class="big">${na ? esc(t("nodata")) : `${esc(big)}${unit ? ` <small>${esc(unit)}</small>` : ""}`}</div><div class="lb">${esc(label)}</div></div>`;
}
function renderHero() {
  const h = g(D, "decisiones_3_horizontes.horizonte_1_hoy_7_dias") || {}, o = tel();
  const pw = g(o, "nasa_power_v10.resumen_anual") || {}, s = o.usda_nrcs_ssurgo || {}, et = g(o, "openet_api.et_acumulada_temporada_mm");
  const pr = g(o, "usda_ams_market_news.precios") || [], soy = pr.find(p => p.producto === "Soybeans"), corn = pr.find(p => p.producto === "Corn");
  const sem = h.semaforo && h.semaforo !== "SIN_DATO" ? h.semaforo : null, r0 = n => (n == null ? null : Math.round(n));
  $("#hero").innerHTML = `<div class="hero"><span class="tl ${esc(sem || "SIN_DATO")}">${esc(sem || t("nodata"))}</span><p>${esc(h.recomendacion_natural || "")}</p></div>
    <div class="tiles">${tile("🌧️", r0(pw.precipitacion_anual_mm), "mm", k("rain"))}${tile("🌡️", pw.temp_media_anual_c == null ? null : num(pw.temp_media_anual_c, 1), "°C", k("temp"))}
    ${tile("💧", r0(s.agua_disponible_0_100cm_mm), "mm", k("soilw"))}${tile("🌱", r0(et), "mm", k("et"))}
    ${tile("🌽", corn && corn.por_tonelada_usd, "USD/t", t("c_maize").split(" ").pop())}${tile("🫘", soy && soy.por_tonelada_usd, "USD/t", t("c_soy").split(" ").pop())}</div>`;
}

// ---------- estado de cada fuente ----------
const SRC = { nasa_power_v10: "NASA POWER", usda_nrcs_ssurgo: "USDA SSURGO", usgs_water_services_nwis: "USGS Water", microsoft_planetary_computer_stac: "Planetary Computer", nasa_earthdata_cmr_pasadas: "NASA CMR",
  usfs_landfire_vegetacion: "LANDFIRE", meteomatics_weather_1km: "Meteomatics", openet_api: "OpenET", usda_ams_market_news: "USDA AMS" };
function estado(o) {
  if (!o) return "error";
  if (o.estado === "ERROR") return "error";
  if (o.estado === "PENDIENTE_TOKEN") return "pending";
  if (o.estado === "SIN_COBERTURA" || o.cobertura_encontrada === false) return "nocov";
  return "ok";
}

// ---------- idioma, modo y controles ----------
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(e => (e.textContent = t(e.dataset.i18n)));
  document.querySelectorAll("[data-k]").forEach(e => (e.textContent = k(e.dataset.k)));
  $("#q").placeholder = t("search_ph");
  $("#mode").innerHTML = [["farmer", "mode_farmer"], ["agronomist", "mode_agr"], ["scientist", "mode_sci"]].map(([v, k]) => `<option value="${v}" ${document.body.dataset.mode === v ? "selected" : ""}>${esc(t(k))}</option>`).join("");
  $("#langs").innerHTML = ["en", "es", "pt"].map(l => `<button data-l="${l}" class="${l === lang ? "on" : ""}">${l.toUpperCase()}</button>`).join("");
  const opt = (id, vals) => `<label class="small mut">${esc(t(id.label))}<br><select data-c="${id.k}">${vals.map(([v, k]) => `<option value="${v}" ${C[id.k] === v ? "selected" : ""}>${esc(t(k))}</option>`).join("")}</select></label>`;
  $("#constraints").innerHTML =
    opt({ label: "crop_now", k: "crop" }, [["maize", "c_maize"], ["soy", "c_soy"], ["wheat", "c_wheat"], ["veg", "c_veg"]]) +
    opt({ label: "water", k: "water" }, [["rain", "w_rain"], ["irrig", "w_irrig"], ["limited", "w_limited"]]) +
    opt({ label: "machine", k: "machine" }, [["conv", "m_conv"], ["notill", "m_notill"], ["forage", "m_forage"]]) +
    opt({ label: "priority", k: "priority" }, [["income", "p_income"], ["water", "p_water"], ["soil", "p_soil"], ["pests", "p_pests"]]);
  $("#tabs").innerHTML = [["today", "tab_today"], ["season", "tab_season"], ["long", "tab_long"], ["src", "tab_src"]].map(([v, n]) => `<button data-tab="${v}" class="${curTab === v ? "on" : ""}">${esc(v === "src" ? k(n) : t(n))}</button>`).join("");
  if (D) render();
  if (window.exRender) window.exRender();
}
let curTab = "today";
function showTab(v) {
  curTab = v;
  ["today", "season", "long", "src"].forEach(x => ($("#tab_" + x).hidden = x !== v));
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === v));
}

// ---------- mapa ----------
// ---------- carga ----------
async function load(lat, lon, label) {
  sel = { lat, lon };
  $("#coords").textContent = ` ${lat.toFixed(4)}, ${lon.toFixed(4)} ${label ? "· " + label : ""}`;
  $("#loading").style.display = "block";
  try {
    const r = await fetch(`/api/v1/parcel-intelligence?lat=${lat}&lon=${lon}`);
    if (!r.ok) throw new Error("HTTP " + r.status);
    D = await r.json();
    $("#msg").hidden = true; $("#out").hidden = false; document.body.dataset.stage = "result";
    render();
  } catch (e) { $("#msg").hidden = false; $("#msg").textContent = "Error: " + e.message; }
  $("#loading").style.display = "none";
}
async function buscar() {
  const q = $("#q").value.trim();
  if (q.length < 2) return;
  const r = await (await fetch("/api/v1/geocode?q=" + encodeURIComponent(q))).json();
  if (r.lat != null) (window.setLoc ? setLoc(r.lat, r.lon, true, r.direccion) : load(r.lat, r.lon, r.direccion));
  else { $("#msg").hidden = false; $("#msg").textContent = `${r.estado || "ERROR"}: ${r.detalle || r.instruccion || ""}`; }
}

// ---------- pintar ----------
function render() {
  const o = tel();
  $("#status").innerHTML = Object.entries(SRC).map(([k, n]) => { const s = estado(o[k]); return `<span class="chip"><span class="dot ${s}"></span>${esc(n)} · ${esc(t("st_" + s))}</span>`; }).join("");
  $("#json").textContent = JSON.stringify(D, null, 2);
  kml.clearLayers(); L.marker([sel.lat, sel.lon]).addTo(kml);
  (g(o, "usgs_water_services_nwis.sensores_cercanos") || []).forEach(s => s.lat != null && L.circleMarker([s.lat, s.lon], { radius: 5, color: "#1b6fb5" }).bindPopup(`${esc(pname(s))}: ${esc(s.valor_actual)} ${esc(s.unidad)}`).addTo(kml));
  renderHero(); renderDecision(); renderToday(); renderSeason(); renderLong(); renderHarm(); renderGaps();
  showTab(curTab);
  if (window.exAfterRender) window.exAfterRender();
}

// ---------- Tu decisión: reacciona a las cuatro respuestas de "Tu granja" con datos reales y reglas del equipo ----------
const DX = {
  en: { alt: "the best option your machinery and water allow; the one for your priority does not fit them", t: "Your decision", rec: "Best fit for you", why: { income: "your top priority is net income", water: "your top priority is saving water", soil: "your top priority is protecting the soil", pests: "your top priority is fewer pests and diseases" }, none: "Pick a place first.",
    mach_no: "needs no-till equipment and you chose another machine", mach_ok: "fits your machinery", wat_bad: "asks for more water than rain alone gives", wat_ok: "fits your water", wat_mid: "water use is high; check your water allowance",
    now: "Today you grow", base: "without legume and without winter cover, one botanical family", your: "Real data of your place", rain: "Rain per year", soil: "Water the soil holds", price: "Price of your crop", frost: "Frost in the next days", bare: "Cells with little cover", nd: "no data", yes: "yes", no: "no", rule: "Rules of the team, not measurements. Data: NASA POWER, USDA, Meteomatics, Sentinel-2.", rank: "Order for your answers" },
  es: { alt: "la mejor opción que permiten tu maquinaria y tu agua; la de tu prioridad no encaja con ellas", t: "Tu decisión", rec: "Lo que mejor te encaja", why: { income: "tu prioridad principal son los ingresos netos", water: "tu prioridad principal es ahorrar agua", soil: "tu prioridad principal es cuidar el suelo", pests: "tu prioridad principal es menos plagas y enfermedades" }, none: "Primero elige un lugar.",
    mach_no: "requiere siembra directa y elegiste otra maquinaria", mach_ok: "encaja con tu maquinaria", wat_bad: "pide más agua de la que da solo la lluvia", wat_ok: "encaja con tu agua", wat_mid: "usa mucha agua; revisa cuánta puedes usar",
    now: "Hoy cultivas", base: "sin leguminosa y sin cobertura de invierno, una sola familia botánica", your: "Datos reales de tu lugar", rain: "Lluvia por año", soil: "Agua que retiene el suelo", price: "Precio de tu cultivo", frost: "Helada en los próximos días", bare: "Cuadros con poca cobertura", nd: "sin dato", yes: "sí", no: "no", rule: "Reglas del equipo, no mediciones. Datos: NASA POWER, USDA, Meteomatics, Sentinel-2.", rank: "Orden según tus respuestas" },
  pt: { alt: "a melhor opção que sua maquinaria e sua água permitem; a da sua prioridade não combina com elas", t: "Sua decisão", rec: "O que melhor combina com você", why: { income: "sua prioridade principal é a renda líquida", water: "sua prioridade principal é economizar água", soil: "sua prioridade principal é cuidar do solo", pests: "sua prioridade principal é menos pragas e doenças" }, none: "Primeiro escolha um lugar.",
    mach_no: "exige plantio direto e você escolheu outra maquinaria", mach_ok: "combina com sua maquinaria", wat_bad: "pede mais água do que só a chuva dá", wat_ok: "combina com sua água", wat_mid: "usa muita água; verifique quanta você pode usar",
    now: "Hoje você cultiva", base: "sem leguminosa e sem cobertura de inverno, uma só família botânica", your: "Dados reais do seu lugar", rain: "Chuva por ano", soil: "Água que o solo retém", price: "Preço da sua cultura", frost: "Geada nos próximos dias", bare: "Quadros com pouca cobertura", nd: "sem dado", yes: "sim", no: "não", rule: "Regras da equipe, não medições. Dados: NASA POWER, USDA, Meteomatics, Sentinel-2.", rank: "Ordem conforme suas respostas" } };
function renderDecision() {
  let el = $("#decision"); if (!el) { el = document.createElement("div"); el.id = "decision"; $("#hero").insertAdjacentElement("afterend", el); }
  const X = DX[lang], pw = g(tel(), "nasa_power_v10.resumen_anual") || {}, ss = tel().usda_nrcs_ssurgo || {};
  const prod = { maize: "Corn", soy: "Soybeans" }[C.crop], pr = (g(tel(), "usda_ams_market_news.precios") || []).find(p => p.producto === prod);
  const fm = g(tel(), "meteomatics_weather_1km.pronostico_7_dias_1km.data")?.find(p => p.parameter === "t_min_2m_24h:C"), fv = (g(fm, "coordinates.0.dates") || []).map(x => x.value).filter(x => x != null);
  const bare = window.tzs?.bare;
  // puntaje simple y visible: prioridad (+2), maquinaria (−3 si no cumple), agua (−1 si pide más de la que tienes)
  const rows = Object.entries(STRAT).map(([id, s]) => {
    const machBad = s.notill && C.machine !== "notill", watBad = id === "A" && C.water !== "irrig", watOk = id === "B" && C.water !== "irrig";
    return { id, s, score: (s.tag === C.priority ? 2 : 0) - (machBad ? 3 : 0) - (watBad ? 1 : 0) + (watOk ? 1 : 0), machBad, watBad, watOk };
  }).sort((a, b) => b.score - a.score);
  const best = rows[0], cropName = t({ maize: "c_maize", soy: "c_soy", wheat: "c_wheat", veg: "c_veg" }[C.crop]);
  const bcol = x => x == null ? esc(X.nd) : esc(x);
  el.innerHTML = `<div class="card" style="margin:10px 0"><h2>🧭 ${esc(X.t)}</h2>
    <p><b>${esc(X.rec)}:</b> ${esc(t(best.s.key))} <span class="mut small">— ${esc(best.s.tag === C.priority ? X.why[C.priority] : X.alt)}${best.machBad ? "; ⚠ " + esc(X.mach_no) : ""}</span></p>
    <p class="small mut">${esc(best.s.seq[lang])}</p>
    <p class="small"><b>${esc(X.now)}:</b> ${esc(cropName)} (${esc(X.base)})</p>
    <p class="small"><b>${esc(X.rank)}:</b></p>${rows.map((r, i) => `<div class="small">${i + 1}. ${esc(t(r.s.key))} · ${r.machBad ? "✘ " + esc(X.mach_no) : "✔ " + esc(X.mach_ok)} · ${r.watBad ? "⚠ " + esc(X.wat_bad) : r.watOk ? "✔ " + esc(X.wat_ok) : esc(X.wat_mid)}</div>`).join("")}
    <p class="small"><b>${esc(X.your)}:</b> ${esc(X.rain)} ${bcol(pw.precipitacion_anual_mm != null ? Math.round(pw.precipitacion_anual_mm) + " mm" : null)} · ${esc(X.soil)} ${bcol(ss.agua_disponible_0_100cm_mm != null ? Math.round(ss.agua_disponible_0_100cm_mm) + " mm" : null)} · ${esc(X.price)} ${bcol(pr?.por_tonelada_usd != null ? pr.por_tonelada_usd + " USD/t" : null)} · ${esc(X.frost)} ${fv.length ? esc(fv.filter(x => x <= 0).length + "/" + fv.length + " · min " + Math.min(...fv).toFixed(1) + " °C") : esc(X.nd)} · ${esc(X.bare)} ${bare != null ? esc(bare + "%") : esc(X.nd)}</p>
    <p class="small mut">${esc(X.rule)}</p></div>`;
}
const FZ = { en: { min: "min", t: "Frost risk", none: "No frost expected in the next days.", some: n => `${n} night(s) at or below 0 °C.`, hard: n => `${n} of them at or below −2 °C (damages most crops).`, ref: "Reference: ≤0 °C frost, ≤−2 °C hard frost. Forecast minimum of the last 24 h, 1 km (Meteomatics)." },
  es: { min: "mín", t: "Riesgo de helada", none: "No se espera helada en los próximos días.", some: n => `${n} noche(s) a 0 °C o menos.`, hard: n => `${n} de ellas a −2 °C o menos (daña a la mayoría de los cultivos).`, ref: "Referencia: ≤0 °C helada, ≤−2 °C helada fuerte. Mínima pronosticada de las últimas 24 h, 1 km (Meteomatics)." },
  pt: { min: "mín", t: "Risco de geada", none: "Não se espera geada nos próximos dias.", some: n => `${n} noite(s) a 0 °C ou menos.`, hard: n => `${n} delas a −2 °C ou menos (danifica a maioria das culturas).`, ref: "Referência: ≤0 °C geada, ≤−2 °C geada forte. Mínima prevista das últimas 24 h, 1 km (Meteomatics)." } };
function frostHtml() {
  const d = g(tel(), "meteomatics_weather_1km.pronostico_7_dias_1km.data")?.find(p => p.parameter === "t_min_2m_24h:C");
  const v = (g(d, "coordinates.0.dates") || []).map(x => x.value).filter(x => x != null); if (!v.length) return "";
  const a = v.filter(x => x <= 0).length, b = v.filter(x => x <= -2).length, F = FZ[lang];
  return `<h2>${esc(F.t)}</h2><p>${b ? "🥶" : a ? "❄️" : "✅"} <b>${esc(a ? F.some(a) : F.none)}</b> ${b ? esc(F.hard(b)) : ""} (min ${Math.min(...v).toFixed(1)} °C)</p><p class="small mut">${esc(F.ref)}</p>`;
}
function mmRows() {
  const d = g(tel(), "meteomatics_weather_1km.pronostico_7_dias_1km.data");
  if (!d) return [];
  const by = {};
  d.forEach(p => (g(p, "coordinates.0.dates") || []).forEach(x => ((by[x.date.slice(0, 10)] ||= {})[p.parameter] = x.value)));
  const mx = Math.max(...Object.values(by).map(v => v["precip_24h:mm"] || 0), 1);
  return Object.entries(by).map(([day, v]) => { const p = v["precip_24h:mm"], mn = v["t_min_2m_24h:C"], fz = mn == null ? "" : mn <= -2 ? "🥶" : mn <= 0 ? "❄️" : "";
    return `<div class="day"><div class="d">${esc(new Date(day + "T12:00:00").toLocaleDateString(lang, { weekday: "short", day: "numeric" }))}</div><div class="t">${num(v["t_2m:C"], 0)}°</div><div class="d">${fz} ${esc(FZ[lang].min)} ${num(mn, 0)}°</div>
      <div class="bar" style="width:${p == null ? 0 : Math.max(4, (p / mx) * 100)}%"></div><div class="d">🌧 ${num(p, 1)} mm</div><div class="d tech">${esc(t("soilidx"))}: ${num(v["soil_moisture_index_-15cm:idx"], 2)}</div></div>`; });
}
function renderToday() {
  const h = g(D, "decisiones_3_horizontes.horizonte_1_hoy_7_dias") || {};
  const rows = mmRows();
  const us = g(tel(), "usgs_water_services_nwis.sensores_cercanos") || [];
  const ps = g(tel(), "nasa_earthdata_cmr_pasadas.ultimas_pasadas_satelitales_nasa") || [];
  $("#tab_today").innerHTML = `${frostHtml()}<h2>${esc(k("wk"))}</h2>${rows.length ? `<div class="days">${rows.join("")}</div><p class="small mut">${esc(t("forecast"))}</p>` : `<p class="mut">${esc(t("nodata"))}</p>`}
    <h2>${esc(t("rivers"))}</h2>${us.length ? `<div class="tiles">${us.map(s => `<div class="tile"><div class="ic">🌊</div><div class="big">${num(s.valor_actual, 2)} <small>${esc(s.unidad)}</small></div><div class="lb">${esc(pname(s))}</div><div class="lb tech">${esc(s.nombre_estacion)} · ${esc(s.fecha_hora_lectura.slice(0, 16))}</div></div>`).join("")}</div>` : `<p class="mut">${esc(t("nodata"))}</p>`}
    <h2 class="tech">${esc(t("passes"))}</h2><div class="tech">${ps.map(p => `<span class="chip">${esc(p.short_name)} · ${esc((p.fecha_inicio_utc || "").slice(0, 10))}</span>`).join("") || esc(t("nodata"))}</div>`;
}

function balance() {
  const rain = g(tel(), "nasa_power_v10.series_12_meses.lluvia_mm_mes") || {};
  const et = {};
  (g(tel(), "openet_api.series_et_mm") || []).forEach(p => (et[MONTHS[+p.time.slice(5, 7) - 1]] = p.et));
  const rg = {};
  (g(tel(), "openet_api.rango_et_mm") || []).forEach(p => (rg[MONTHS[+p.time.slice(5, 7) - 1]] = p));
  const f = 1 + C.rain / 100;
  return MONTHS.map(m => ({ m, rain: rain[m] == null ? null : rain[m] * f, et: et[m] ?? null, lo: rg[m]?.min ?? null, hi: rg[m]?.max ?? null }));
}
function chart(b) {
  const raw = Math.max(...b.map(x => Math.max(x.rain || 0, x.et || 0, x.hi || 0)), 1), step = raw > 200 ? 100 : raw > 80 ? 50 : 20, max = Math.ceil(raw / step) * step, H = 170, W = 36, L = 34;
  const y = v => H - (v / max) * H, grid = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  return `<svg viewBox="0 0 ${12 * W + L + 6} ${H + 24}" width="100%" role="img" aria-label="${esc(t("season_title"))}" style="font-size:12px">
    ${grid.map(v => `<line x1="${L}" x2="${12 * W + L}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 4}" y="${y(v) + 4}" text-anchor="end" style="font-size:11px">${v}</text>`).join("")}
    ${b.map((x, i) => {
    const xx = L + 4 + i * W, hr = ((x.rain || 0) / max) * H, he = ((x.et || 0) / max) * H;
    return `<rect x="${xx}" y="${H - hr}" width="13" height="${hr}" rx="2" fill="var(--water)"/><rect x="${xx + 14}" y="${H - he}" width="13" height="${he}" rx="2" fill="var(--soil)"/>${x.lo != null && x.hi != null ? `<line x1="${xx + 20.5}" x2="${xx + 20.5}" y1="${y(x.lo)}" y2="${y(x.hi)}" stroke="var(--ink)" stroke-width="2"/>` : ""}<text x="${xx + 13}" y="${H + 16}" text-anchor="middle" style="font-size:11px">${x.m[0] + x.m.slice(1).toLowerCase()}</text>`;
  }).join("")}</svg><div class="legend"><span><i style="background:var(--water)"></i>${esc(t("rain_mm"))}</span><span><i style="background:var(--soil)"></i>${esc(t("et_mm"))}</span></div><p class="small mut">${esc(t("range_note"))}</p>`;
}
function soilTable() {
  const s = tel().usda_nrcs_ssurgo;
  if (!s || s.cobertura_encontrada === false) return `<p class="mut">${esc(t("nodata"))} (USDA SSURGO: EE. UU.)</p>`;
  const hz = s.horizontes_verticales_0_150cm || [];
  return `<p class="small">${esc(t("series"))}: <b>${esc(s.serie_dominante)}</b> · ${esc(t("drainage"))}: ${esc(s.drenaje)} · ${esc(t("avail"))}: <b>${num(s.agua_disponible_0_100cm_mm)} mm</b></p>
    <table><tr><th>${esc(t("depth"))}</th><th>${esc(t("om"))}</th><th>${esc(t("ph"))}</th><th>${esc(t("clay"))}</th><th class="tech">${esc(t("density"))}</th><th class="tech">${esc(t("kfact"))}</th></tr>
    ${hz.map(h => `<tr><td>${num(h.prof_inicio_cm, 0)}–${num(h.prof_fin_cm, 0)}</td><td>${num(h.materia_organica_pct)}</td><td>${num(h.ph)}</td><td>${num(h.arcilla_pct)}</td><td class="tech">${num(h.densidad_aparente_g_cm3)}</td><td class="tech">${num(h.factor_k_erosion, 2)}</td></tr>`).join("")}</table>`;
}
function evidence(id) {
  const s = tel().usda_nrcs_ssurgo || {}, cap = s.capa_arable_superficial || {}, pw = g(tel(), "nasa_power_v10.resumen_anual") || {}, et = g(tel(), "openet_api.et_acumulada_temporada_mm");
  const mk = g(tel(), "usda_ams_market_news.precios.0");
  const chips = { A: [["USDA AMS", mk ? `${mk.producto} $${mk.promedio}/bu · ${mk.fecha}` : null], ["OpenET", et != null ? et + " mm" : null]],
    B: [["OpenET", et != null ? et + " mm" : null], [t("p_year"), pw.precipitacion_anual_mm], [t("avail"), s.agua_disponible_0_100cm_mm != null ? s.agua_disponible_0_100cm_mm + " mm" : null]],
    C: [[t("om"), cap.materia_organica_pct], ["K", cap.factor_k_erosion], [t("density"), cap.densidad_aparente_g_cm3]] }[id] || [];
  return chips.map(([k, v]) => `<span class="chip">${esc(k)}: ${v == null ? esc(t("nodata")) : esc(v)}</span>`).join("");
}
function yn(v) { return v == null ? t("unk") : v ? t("yes") : t("no"); }
function card(title, cls, seq, gain, cost, fl, extra, ev) {
  return `<div class="strat ${cls}"><b>${esc(title)}</b>${cls.includes("match") ? ` <span class="chip">${esc(t("match"))}</span>` : ""}
    <div class="small">${esc(t("seq"))}: ${esc(seq)}</div>
    ${gain ? `<div class="small">＋ ${esc(gain)}<br>－ ${esc(cost)} <span class="mut">(${esc(t("rule"))})</span></div>` : ""}
    <div>${[["legume", fl.legume], ["cover", fl.cover]].map(([n, v]) => `<span class="badge ${v == null ? "" : v ? "good" : "bad"}">${v == null ? "?" : v ? "✔" : "✘"} ${esc(t(n))}</span>`).join("")}<span class="badge">${esc(t("families"))}: ${fl.fam ?? esc(t("unk"))}</span><span class="badge ${extra.includes("<b") ? "bad" : "good"}">${extra.includes("<b") ? "✘ " + esc(t("warn_notill")) : "✔ " + esc(t("fit"))}</span></div>
    <div class="tech small">${esc(t("evidence"))}: ${ev}</div></div>`;
}
function balHtml() {
  const b = balance();
  const st = x => x.rain == null || x.et == null ? "na" : x.lo != null ? (x.rain < x.lo ? "sure" : x.rain < x.hi ? "maybe" : "ok") : x.et > x.rain ? "sure" : "ok";
  const cal = `<div class="months">${b.map(x => `<div class="${st(x)}">${esc(x.m[0] + x.m.slice(1).toLowerCase())}</div>`).join("")}</div>
    <div class="legend"><span><i style="background:var(--crop)"></i>${esc(k("ok"))}</span><span><i style="background:var(--soil)"></i>${esc(t("maybe"))}</span><span><i style="background:var(--bad)"></i>${esc(t("sure"))}</span><span><i style="background:var(--line)"></i>${esc(t("nodata"))}</span></div>`;
  return `${cal}${chart(b)}<p class="small mut">${esc(t("et_note"))}</p>`;
}
function bareHtml() {
  const nd = g(tel(), "openet_api.ndvi_mensual");
  if (!nd) return `<p class="mut">${esc(t("nodata"))}</p>`;
  const cells = nd.map(p => { const v = p.ndvi, low = v != null && v < 0.3; return `<div style="flex:1;min-width:34px;text-align:center;padding:4px 0;border-radius:6px;background:${low ? "var(--soil)" : "var(--crop)"};color:#fff;font-size:12px">${MONTHS[+p.time.slice(5, 7) - 1][0]}${MONTHS[+p.time.slice(5, 7) - 1].slice(1).toLowerCase()}<br>${num(v, 2)}</div>`; });
  return `<div class="row" style="flex-wrap:nowrap;gap:3px">${cells.join("")}</div><p class="small mut">${esc(t("bare_rule"))}</p>`;
}
function renderSeason() {
  const bk = BASE[C.crop] || {}, cropName = t({ maize: "c_maize", soy: "c_soy", wheat: "c_wheat", veg: "c_veg" }[C.crop]);
  const strat = Object.entries(STRAT).map(([id, s]) => ({ id, s, match: s.tag === C.priority }));
  strat.sort((a, c) => c.match - a.match);
  const cards = card(t("baseline"), "base", cropName, "", "", bk, esc(t("yes")), "") +
    strat.map(({ id, s, match }) => card(t(s.key), match ? "match" : "", s.seq[lang], s.gain[lang], s.cost[lang], s, s.notill && C.machine !== "notill" ? `<b style="color:var(--bad)">${esc(t("warn_notill"))}</b>` : esc(t("yes")), evidence(id))).join("");
  const mk = g(tel(), "usda_ams_market_news") || {};
  $("#tab_season").innerHTML = `<h2>${esc(t("season_title"))}</h2><div id="bal">${balHtml()}</div>
    <label class="small">${esc(t("rain_slider"))}: <b id="rv">${C.rain > 0 ? "+" : ""}${C.rain}%</b> <input id="rain" type="range" min="-30" max="30" step="5" value="${C.rain}"></label>
    <h2>${esc(t("bare_title"))}</h2>${bareHtml()}
    <h2>${esc(t("soil_profile"))}</h2>${soilTable()}
    <h2>${esc(k("pr"))}${mk.estado_usa ? ` · ${esc(mk.estado_usa)}` : ""}</h2>${(mk.precios || []).length ? `<div class="tiles">${mk.precios.map(p => `<div class="tile price"><div class="ic">${p.producto === "Corn" ? "🌽" : "🫘"}</div><div class="big">${p.por_tonelada_usd ?? num(p.promedio, 2)} <small>${p.por_tonelada_usd ? "USD/t" : esc(p.unidad)}</small></div><div class="lb">${esc(p.producto === "Corn" ? t("c_maize").split(" ").pop() : t("c_soy").split(" ").pop())} · ${esc(p.fecha)}</div><div class="lb">$${num(p.promedio, 2)}/bu (${num(p.minimo, 2)}–${num(p.maximo, 2)}) · ${p.n_puntos} ${esc(k("pts"))}</div></div>`).join("")}</div><p class="small mut">${esc(mk.reporte)} · USDA AMS</p>` : `<p class="small mut">${esc(t("nodata"))}${mk.motivo ? " · " + esc(mk.motivo) : ""}</p>`}
    <h2>${esc(t("rot_title"))}</h2>${cards}
    <p class="small"><b>${esc(t("validate"))}</b>: <a href="https://www.nrcs.usda.gov/contact/find-a-service-center" target="_blank" rel="noopener">${esc(t("nrcs_txt"))}</a> · <a href="https://casoilresource.lawr.ucdavis.edu/gmap/?loc=${sel.lat},${sel.lon},z16" target="_blank" rel="noopener">${esc(t("soilweb_txt"))}</a></p>`;
}
function renderLong() {
  const pw = g(tel(), "nasa_power_v10.resumen_anual") || {}, lf = g(tel(), "usfs_landfire_vegetacion.propiedades_pixel_30m") || {};
  const sc = g(tel(), "microsoft_planetary_computer_stac.escenas_satelitales_recientes") || [];
  $("#tab_long").innerHTML = `<h2>${esc(t("annual"))}</h2><table>
    <tr><td>${esc(t("t_mean"))}</td><td>${num(pw.temp_media_anual_c)}</td></tr><tr><td>${esc(t("p_year"))}</td><td>${num(pw.precipitacion_anual_mm, 0)}</td></tr>
    <tr><td>${esc(t("sm_top"))}</td><td>${num(pw.humedad_superficial_media_pct)}</td></tr><tr><td>${esc(t("sm_root"))}</td><td>${num(pw.humedad_zona_radicular_media_pct)}</td></tr><tr class="tech"><td>${esc(t("wind"))}</td><td>${num(pw.viento_medio_2m_m_s)}</td></tr></table>
    <h2>${esc(t("evt"))}</h2><p>${lf.GRAY_INDEX != null ? esc(lf.GRAY_INDEX) : esc(t("nodata"))} <span class="mut small">${esc(t("evt_note"))}</span></p>
    <h2>${esc(t("scenes"))}</h2>${sc.map(x => `<span class="chip">${esc(x.coleccion)} · ${esc((x.fecha_captura || "").slice(0, 10))} · ${num(x.nubosidad_pct, 0)}%</span>`).join("") || esc(t("nodata"))}`;
}
function renderHarm() {
  $("#harm").innerHTML = `<h2>${esc(t("harm_title"))}</h2><p class="small mut">${esc(t("harm_note"))}</p><table class="tech"><tr><th>${esc(t("col_src"))}</th><th>${esc(t("col_res"))}</th></tr>${RES.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("")}</table>`;
}
function renderGaps() {
  const fails = Object.entries(SRC).filter(([k]) => estado(tel()[k]) !== "ok").map(([k, n]) => `${n}: ${t("st_" + estado(tel()[k]))}`);
  $("#gaps").innerHTML = `<h2>${esc(t("gaps_title"))}</h2><ul class="small">${fails.map(x => `<li>${esc(x)}</li>`).join("")}${["g_bare", "g_n", "g_unc", "g_temp", "g_chat", "g_text", "g_hist"].map(k => `<li>${esc(t(k))}</li>`).join("")}</ul>`;
}

// ---------- eventos ----------
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.l) { lang = b.dataset.l; applyLang(); }
  else if (b.dataset.tab) showTab(b.dataset.tab);
  else if (b.id === "go") buscar();
  else if (b.id === "jsonbtn") $("#json").hidden = !$("#json").hidden;
  else if (b.dataset.lat) setLoc(+b.dataset.lat, +b.dataset.lon, true, b.dataset.n);
});
document.addEventListener("change", e => {
  if (e.target.id === "mode") { document.body.dataset.mode = e.target.value; }
  else if (e.target.dataset.c) { C[e.target.dataset.c] = e.target.value; if (D) renderSeason(), renderDecision(), showTab(curTab); }
});
document.addEventListener("input", e => {
  if (e.target.id !== "rain") return;
  C.rain = +e.target.value; $("#rv").textContent = (C.rain > 0 ? "+" : "") + C.rain + "%"; $("#bal").innerHTML = balHtml(); // solo el gráfico, para no perder el control
});
$("#q").addEventListener("keydown", e => e.key === "Enter" && buscar());
$("#pilots").innerHTML = [["Ames, Iowa", 42.0308, -93.6319], ["Nebraska · Ogallala", 40.7, -99.08], ["Michoacán", 19.9902, -102.2834], ["California · Central Valley", 36.75, -119.77]]
  .map(([n, la, lo]) => `<button data-lat="${la}" data-lon="${lo}" data-n="${esc(n)}">📍 ${esc(n)}</button>`).join("");
applyLang();
