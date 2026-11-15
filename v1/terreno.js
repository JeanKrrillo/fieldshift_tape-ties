// Mi terreno: ubicación (real o simulada), terreno dibujado con cuadrícula de NDVI, capas útiles explicadas y datos dentro del mapa.
const TX = {
  en: { s1: "Where are you?", s2: "Draw your land", s2_hint: "Press Draw, click the corners on the map and close the shape by clicking the first corner. We measure it and color each grid cell with real satellite data.", s4: "Information layers", s4_hint: "Tick a layer to see it on the map. Open “What it means” to learn what it shows and how it changes your decisions.", s5: "Results for your land", res_none: "Pick a location (step 1) or draw your land (step 2) and the results appear here.",
    sim_hint: "You are outside the US, where most sources (soil, crop water use, prices) have data. Simulate a location: pick an example, search a place, or click the map.", btn_gps: "📍 Use my location", btn_sim: "🧪 Simulate location", btn_draw: "✏️ Draw my land", btn_clear: "🗑 Clear", cells: "Grid cells",
    loc_none: "No location yet.", loc_real: "Your location", loc_sim: "Simulated location", outside: "This place is outside the US. Soil, crop water use, crop history and prices have no data here; simulate a US location to see everything.", gps_fail: "Could not read your location (blocked or unavailable). Simulate one instead.", gps_wait: "Reading your location…", draw_hint: "Click the corners of your land on the map…",
    area: "ha", ndvi_avg: "average NDVI", bare: "of cells with little plant cover (<0.30)", scene: "satellite photo", clouds: "clouds", cell_of: "cells of about", m: "m",
    lg_title: "Plant cover (NDVI)", lg1: "Bare soil or dry stubble", lg2: "Very little cover", lg3: "Medium cover", lg4: "Good cover", lg5: "Dense, vigorous plants", lg_note: "Ranges are an orientation rule of the team, not a measurement.",
    ndvi_help: "NDVI goes from 0 (no plants) to 1 (very dense plants).", panel: "Data at this place", no_cells: "No cloud-free Sentinel-2 photo covers this land.", err: "Could not analyze the land", g_veg: "Plants", g_water: "Water", g_risk: "Risk", g_ctx: "Context", mean: "What it means", impact: "How it changes your decision", limit: "Limit" },
  es: { s1: "¿Dónde estás?", s2: "Dibuja tu terreno", s2_hint: "Presiona Dibujar, haz clic en las esquinas sobre el mapa y cierra la figura en la primera esquina. Lo medimos y coloreamos cada cuadro con datos reales de satélite.", s4: "Capas de información", s4_hint: "Marca una capa para verla en el mapa. Abre “Qué significa” para entender qué muestra y cómo cambia tus decisiones.", s5: "Resultados de tu terreno", res_none: "Elige una ubicación (paso 1) o dibuja tu terreno (paso 2) y aquí aparecen los resultados.",
    sim_hint: "Estás fuera de EE. UU., donde la mayoría de las fuentes (suelo, consumo de agua, precios) tienen datos. Simula una ubicación: elige un ejemplo, busca un lugar o haz clic en el mapa.", btn_gps: "📍 Usar mi ubicación", btn_sim: "🧪 Simular ubicación", btn_draw: "✏️ Dibujar mi terreno", btn_clear: "🗑 Borrar", cells: "Cuadros",
    loc_none: "Todavía sin ubicación.", loc_real: "Tu ubicación", loc_sim: "Ubicación simulada", outside: "Este lugar está fuera de EE. UU. Aquí no hay datos de suelo, consumo de agua, historial de cultivos ni precios; simula una ubicación en EE. UU. para verlo todo.", gps_fail: "No pude leer tu ubicación (bloqueada o no disponible). Simula una.", gps_wait: "Leyendo tu ubicación…", draw_hint: "Haz clic en las esquinas de tu terreno sobre el mapa…",
    area: "ha", ndvi_avg: "NDVI promedio", bare: "de los cuadros con poca cobertura de plantas (<0.30)", scene: "foto de satélite", clouds: "nubes", cell_of: "cuadros de unos", m: "m",
    lg_title: "Cobertura de plantas (NDVI)", lg1: "Suelo desnudo o rastrojo seco", lg2: "Muy poca cobertura", lg3: "Cobertura media", lg4: "Buena cobertura", lg5: "Plantas densas y vigorosas", lg_note: "Los rangos son una regla de orientación del equipo, no una medición.",
    ndvi_help: "El NDVI va de 0 (sin plantas) a 1 (plantas muy densas).", panel: "Datos de este lugar", no_cells: "Ninguna foto Sentinel-2 sin nubes cubre este terreno.", err: "No pude analizar el terreno", g_veg: "Plantas", g_water: "Agua", g_risk: "Riesgo", g_ctx: "Contexto", mean: "Qué significa", impact: "Cómo cambia tu decisión", limit: "Límite" },
  pt: { s1: "Onde você está?", s2: "Desenhe seu terreno", s2_hint: "Pressione Desenhar, clique nos cantos no mapa e feche a figura no primeiro canto. Medimos e coloramos cada quadro com dados reais de satélite.", s4: "Camadas de informação", s4_hint: "Marque uma camada para vê-la no mapa. Abra “O que significa” para entender o que mostra e como muda suas decisões.", s5: "Resultados do seu terreno", res_none: "Escolha uma localização (passo 1) ou desenhe seu terreno (passo 2) e os resultados aparecem aqui.",
    sim_hint: "Você está fora dos EUA, onde a maioria das fontes (solo, uso de água, preços) tem dados. Simule uma localização: escolha um exemplo, busque um lugar ou clique no mapa.", btn_gps: "📍 Usar minha localização", btn_sim: "🧪 Simular localização", btn_draw: "✏️ Desenhar meu terreno", btn_clear: "🗑 Apagar", cells: "Quadros",
    loc_none: "Ainda sem localização.", loc_real: "Sua localização", loc_sim: "Localização simulada", outside: "Este lugar está fora dos EUA. Aqui não há dados de solo, uso de água, histórico de culturas nem preços; simule uma localização nos EUA para ver tudo.", gps_fail: "Não consegui ler sua localização (bloqueada ou indisponível). Simule uma.", gps_wait: "Lendo sua localização…", draw_hint: "Clique nos cantos do seu terreno no mapa…",
    area: "ha", ndvi_avg: "NDVI médio", bare: "dos quadros com pouca cobertura de plantas (<0.30)", scene: "foto de satélite", clouds: "nuvens", cell_of: "quadros de cerca de", m: "m",
    lg_title: "Cobertura de plantas (NDVI)", lg1: "Solo nu ou restolho seco", lg2: "Pouquíssima cobertura", lg3: "Cobertura média", lg4: "Boa cobertura", lg5: "Plantas densas e vigorosas", lg_note: "As faixas são uma regra de orientação da equipe, não uma medição.",
    ndvi_help: "O NDVI vai de 0 (sem plantas) a 1 (plantas muito densas).", panel: "Dados deste lugar", no_cells: "Nenhuma foto Sentinel-2 sem nuvens cobre este terreno.", err: "Não consegui analisar o terreno", g_veg: "Plantas", g_water: "Água", g_risk: "Risco", g_ctx: "Contexto", mean: "O que significa", impact: "Como muda sua decisão", limit: "Limite" },
};
Object.assign(TX.en, { pts: "samples averaged",sec_btn: "Use this official section as my land", sec_none: "No official survey section here (the survey grid covers about 30 states, mostly the Midwest and West, not Texas or the East).", sec_lbl: "Official section", g_lbl: "township" });
Object.assign(TX.es, { pts: "muestras promediadas",sec_btn: "Usar esta sección oficial como mi terreno", sec_none: "Aquí no hay sección oficial del catastro (la cuadrícula cubre unos 30 estados, sobre todo el Medio Oeste y el Oeste, no Texas ni el Este).", sec_lbl: "Sección oficial", g_lbl: "municipio" });
Object.assign(TX.pt, { pts: "amostras na média",sec_btn: "Usar esta seção oficial como meu terreno", sec_none: "Aqui não há seção oficial do cadastro (a grade cobre cerca de 30 estados, sobretudo o Meio-Oeste e o Oeste, não Texas nem o Leste).", sec_lbl: "Seção oficial", g_lbl: "município" });
window.tz = n => TX[lang]?.[n] ?? TX.en[n] ?? n;

// Capas recomendadas. n: nombre, q: qué es, i: cómo cambia tu decisión, r: límite (resolución y retraso). Las resoluciones son las de cada producto.
const USEFUL = [
  { kind: "gibs", id: "MODIS_Terra_NDVI_8Day", g: "veg", ic: "🌿", t: {
    es: { n: "Verdor de las plantas (NDVI)", q: "Mide qué tan verde y activa está la vegetación. Verde fuerte: plantas sanas y densas. Café o rojo: suelo desnudo o planta seca.", i: "Te dice si el cultivo ya cubrió el suelo, si sufre o si hay lotes sin sembrar. Es la señal más usada para detectar problemas antes de verlos a ojo.", r: "Cada cuadro mide 250 m (unas 6 ha): no ve detalles menores. Se actualiza cada 8 días." },
    en: { n: "Plant greenness (NDVI)", q: "Measures how green and active vegetation is. Strong green: healthy, dense plants. Brown or red: bare soil or dry plants.", i: "Tells you whether the crop already covers the soil, is suffering, or whether some plots are unplanted. The most used signal to spot problems before you see them.", r: "Each square is 250 m (about 6 ha): it misses smaller details. Updated every 8 days." },
    pt: { n: "Verdor das plantas (NDVI)", q: "Mede quão verde e ativa está a vegetação. Verde forte: plantas sadias e densas. Marrom ou vermelho: solo nu ou planta seca.", i: "Diz se a cultura já cobriu o solo, se sofre ou se há talhões sem plantio. É o sinal mais usado para achar problemas antes de vê-los a olho.", r: "Cada quadro tem 250 m (cerca de 6 ha): não vê detalhes menores. Atualiza a cada 8 dias." } } },
  { kind: "gibs", id: "MODIS_Combined_L4_LAI_8Day", g: "veg", ic: "🍃", t: {
    es: { n: "Cantidad de hojas (LAI)", q: "Cuántas capas de hojas hay sobre cada metro de suelo. Más alto: más follaje.", i: "Ayuda a saber cuánta agua pedirá el cultivo: más hojas, más sed. También separa un cultivo joven de uno maduro.", r: "500 m por cuadro. Cada 8 días." },
    en: { n: "Leaf amount (LAI)", q: "How many layers of leaves cover each square meter of soil. Higher: more foliage.", i: "Helps estimate how much water the crop will ask for: more leaves, more thirst. Also tells a young crop from a mature one.", r: "500 m per square. Every 8 days." },
    pt: { n: "Quantidade de folhas (LAI)", q: "Quantas camadas de folhas cobrem cada metro quadrado de solo. Mais alto: mais folhagem.", i: "Ajuda a saber quanta água a cultura vai pedir: mais folhas, mais sede. Também separa cultura jovem de madura.", r: "500 m por quadro. A cada 8 dias." } } },
  { kind: "gibs", id: "SMAP_L4_Analyzed_Root_Zone_Soil_Moisture", g: "water", ic: "💧", t: {
    es: { n: "Humedad en la raíz", q: "Qué tan mojado está el suelo a la profundidad de las raíces (hasta cerca de 1 m). NASA la estima con un satélite y un modelo.", i: "Dice si hay agua para el cultivo aunque la superficie se vea seca. Sirve para decidir riego, siembra y qué cultivos más o menos sedientos rotar.", r: "Cada cuadro mide 9 km: es la tendencia de la zona, no de tu terreno. Llega con unos días de retraso." },
    en: { n: "Root-zone moisture", q: "How wet the soil is at root depth (down to about 1 m). NASA estimates it with a satellite and a model.", i: "Tells whether there is water for the crop even if the surface looks dry. Used to decide irrigation, sowing and which thirstier or less thirsty crops to rotate.", r: "Each square is 9 km: it is the trend of the area, not of your land. Arrives a few days late." },
    pt: { n: "Umidade na raiz", q: "Quão molhado está o solo na profundidade das raízes (até cerca de 1 m). A NASA estima com satélite e modelo.", i: "Diz se há água para a cultura mesmo que a superfície pareça seca. Serve para decidir irrigação, plantio e quais culturas mais ou menos sedentas rotacionar.", r: "Cada quadro tem 9 km: é a tendência da região, não do seu terreno. Chega com alguns dias de atraso." } } },
  { kind: "gibs", id: "SMAP_L4_Analyzed_Surface_Soil_Moisture", g: "water", ic: "💦", t: {
    es: { n: "Humedad de la superficie", q: "Qué tan mojados están los primeros centímetros del suelo.", i: "Dice si la semilla puede germinar o si acaba de llover. Cambia rápido con el sol y el viento.", r: "9 km por cuadro." },
    en: { n: "Surface moisture", q: "How wet the first centimeters of soil are.", i: "Tells whether a seed can germinate or whether it just rained. Changes fast with sun and wind.", r: "9 km per square." },
    pt: { n: "Umidade da superfície", q: "Quão molhados estão os primeiros centímetros do solo.", i: "Diz se a semente pode germinar ou se acabou de chover. Muda rápido com sol e vento.", r: "9 km por quadro." } } },
  { kind: "gibs", id: "IMERG_Precipitation_Rate", g: "water", ic: "🌧️", t: {
    es: { n: "Lluvia reciente", q: "Cuánta lluvia cae según el satélite, en milímetros por hora, actualizada cada 30 minutos.", i: "Te ayuda a saber si llovió en tu zona y si conviene entrar al terreno, sembrar o regar. Sirve para comparar con el pronóstico.", r: "10 km por cuadro; los chubascos pequeños pueden no aparecer." },
    en: { n: "Recent rain", q: "How much rain falls according to the satellite, in millimeters per hour, updated every 30 minutes.", i: "Helps you know whether it rained in your area and whether to enter the land, sow or irrigate. Good to compare against the forecast.", r: "10 km per square; small showers may not show." },
    pt: { n: "Chuva recente", q: "Quanta chuva cai segundo o satélite, em milímetros por hora, atualizada a cada 30 minutos.", i: "Ajuda a saber se choveu na sua região e se convém entrar no terreno, semear ou irrigar. Útil para comparar com a previsão.", r: "10 km por quadro; chuvas pequenas podem não aparecer." } } },
  { kind: "gibs", id: "MODIS_Terra_Land_Surface_Temp_Day", g: "risk", ic: "🌡️", t: {
    es: { n: "Temperatura del suelo (día)", q: "Qué tan caliente está la superficie del suelo y de las plantas, no el aire.", i: "Un suelo muy caliente se seca rápido y estresa al cultivo. Si el cultivo está más caliente que lo normal, suele faltarle agua.", r: "1 km por cuadro; solo se ve donde no hay nubes." },
    en: { n: "Ground temperature (day)", q: "How hot the surface of the soil and plants is, not the air.", i: "Very hot soil dries fast and stresses the crop. If the crop is hotter than normal, it often lacks water.", r: "1 km per square; only visible where there are no clouds." },
    pt: { n: "Temperatura do solo (dia)", q: "Quão quente está a superfície do solo e das plantas, não o ar.", i: "Solo muito quente seca rápido e estressa a cultura. Se a cultura está mais quente que o normal, costuma faltar água.", r: "1 km por quadro; só se vê onde não há nuvens." } } },
  { kind: "gibs", id: "MODIS_Combined_Flood_1-Day", g: "risk", ic: "🌊", t: {
    es: { n: "Agua en la superficie (inundación)", q: "Zonas cubiertas de agua detectadas por satélite en el último día.", i: "Avisa de encharcamientos y desbordes que pueden pudrir raíces o impedir entrar con maquinaria.", r: "250 m por cuadro; las nubes la tapan." },
    en: { n: "Surface water (flood)", q: "Areas covered by water detected by satellite in the last day.", i: "Warns of waterlogging and overflow that can rot roots or block machinery.", r: "250 m per square; clouds hide it." },
    pt: { n: "Água na superfície (inundação)", q: "Áreas cobertas de água detectadas por satélite no último dia.", i: "Avisa de alagamentos e transbordamentos que podem apodrecer raízes ou impedir a entrada de máquinas.", r: "250 m por quadro; as nuvens a escondem." } } },
  { kind: "gibs", id: "MODIS_Aqua_Thermal_Anomalies_Day", g: "risk", ic: "🔥", t: {
    es: { n: "Incendios activos", q: "Puntos calientes detectados por satélite que suelen ser fuego.", i: "Alerta de riesgo cerca de tus cultivos y de humo que reduce la luz.", r: "1 km por punto; se actualiza varias veces al día." },
    en: { n: "Active fires", q: "Hot spots detected by satellite that are usually fire.", i: "Warns of risk near your crops and of smoke that cuts sunlight.", r: "1 km per point; updated several times a day." },
    pt: { n: "Incêndios ativos", q: "Pontos quentes detectados por satélite que costumam ser fogo.", i: "Alerta de risco perto das suas culturas e de fumaça que reduz a luz.", r: "1 km por ponto; atualiza várias vezes ao dia." } } },
  { kind: "gibs", id: "MODIS_Terra_L3_NDSI_Snow_Cover_Daily", g: "risk", ic: "❄️", t: {
    es: { n: "Nieve", q: "Dónde hay nieve sobre el suelo.", i: "La nieve que se derrite es el agua de riego de muchos ríos: ayuda a anticipar cuánta habrá en primavera. También avisa de riesgo de heladas.", r: "500 m por cuadro; las nubes la tapan." },
    en: { n: "Snow", q: "Where there is snow on the ground.", i: "Melting snow is the irrigation water of many rivers: it helps predict how much there will be in spring. It also hints at frost risk.", r: "500 m per square; clouds hide it." },
    pt: { n: "Neve", q: "Onde há neve sobre o solo.", i: "A neve que derrete é a água de irrigação de muitos rios: ajuda a prever quanta haverá na primavera. Também indica risco de geada.", r: "500 m por quadro; as nuvens a escondem." } } },
  { kind: "gibs", id: "VIIRS_SNPP_CorrectedReflectance_TrueColor", g: "ctx", ic: "🛰️", t: {
    es: { n: "Foto satelital del día", q: "Cómo se ve la zona hoy desde el espacio, a color natural.", i: "Sirve para ver nubes, humo, tormentas y grandes manchas verdes o secas. Es contexto, no una medición.", r: "375 m por cuadro." },
    en: { n: "Today's satellite photo", q: "How the area looks today from space, in natural color.", i: "Shows clouds, smoke, storms and big green or dry patches. It is context, not a measurement.", r: "375 m per square." },
    pt: { n: "Foto de satélite do dia", q: "Como a região aparece hoje do espaço, em cor natural.", i: "Mostra nuvens, fumaça, tempestades e grandes manchas verdes ou secas. É contexto, não medição.", r: "375 m por quadro." } } },
  { kind: "pc", id: "sentinel-2-l2a", g: "veg", ic: "🔍", t: {
    es: { n: "Foto detallada (10 m)", q: "Fotografía de satélite muy detallada, con fecha, de los últimos días en el centro del mapa.", i: "Aquí ves lotes, surcos y zonas peladas. De esta foto sale el NDVI de cada cuadro de tu terreno.", r: "10 m por punto; solo si no hay nubes; una foto cada 5 días." },
    en: { n: "Detailed photo (10 m)", q: "A very detailed satellite photo, with date, from the last days at the map center.", i: "You can see plots, rows and bare spots. The NDVI of each cell of your land comes from this photo.", r: "10 m per point; only if there are no clouds; one photo every 5 days." },
    pt: { n: "Foto detalhada (10 m)", q: "Fotografia de satélite muito detalhada, com data, dos últimos dias no centro do mapa.", i: "Aqui você vê talhões, sulcos e áreas peladas. Desta foto sai o NDVI de cada quadro do seu terreno.", r: "10 m por ponto; só sem nuvens; uma foto a cada 5 dias." } } },
  { kind: "pc", id: "usda-cdl", g: "ctx", ic: "🌽", t: {
    es: { n: "Cultivo sembrado cada año (CDL)", q: "Qué cultivo hubo cada año en cada campo (maíz, soya, trigo…).", i: "Muestra tu historial y el de tus vecinos. Es la base para decidir la rotación y para entrenar la IA.", r: "30 m; solo EE. UU.; en esta fuente llega hasta 2021." },
    en: { n: "Crop planted each year (CDL)", q: "Which crop grew each year in each field (corn, soy, wheat…).", i: "Shows your history and your neighbors'. It is the base to decide rotation and to train the AI.", r: "30 m; US only; in this source it reaches 2021." },
    pt: { n: "Cultura plantada a cada ano (CDL)", q: "Qual cultura houve a cada ano em cada campo (milho, soja, trigo…).", i: "Mostra seu histórico e o dos vizinhos. É a base para decidir a rotação e treinar a IA.", r: "30 m; só EUA; nesta fonte vai até 2021." } } },
  { kind: "lf", id: "LF2025_EVT_CONUS", g: "ctx", ic: "🌲", t: {
    es: { n: "Tipo de vegetación (LANDFIRE)", q: "Clasifica el terreno: cultivo, pastizal, bosque, zona urbana…", i: "Confirma qué hay hoy en tu terreno y qué hay alrededor (barreras, bosques, pastos).", r: "30 m; solo EE. UU.; mapa del año 2025." },
    en: { n: "Vegetation type (LANDFIRE)", q: "Classifies the land: crop, grassland, forest, urban…", i: "Confirms what is on your land today and what is around it (windbreaks, forests, pastures).", r: "30 m; US only; 2025 map." },
    pt: { n: "Tipo de vegetação (LANDFIRE)", q: "Classifica o terreno: cultivo, pastagem, floresta, área urbana…", i: "Confirma o que há hoje no seu terreno e ao redor (barreiras, florestas, pastos).", r: "30 m; só EUA; mapa de 2025." } } },
  { kind: "plss", id: "plss", g: "ctx", ic: "🗺️", t: {
    es: { n: "Cuadrícula oficial de terrenos (PLSS)", q: "Las líneas reales del catastro federal: municipios (36 mi²) y secciones (1 mi², 259 ha). Son límites medidos, no dibujados por nosotros.", i: "Te dice dónde empieza y termina cada sección y te deja tomar una completa como tu terreno con un clic. Muchos campos del Medio Oeste siguen estas líneas.", r: "Fuente: BLM. Cubre unos 30 estados (Medio Oeste y Oeste), no Texas ni el Este. Acerca el mapa para ver las secciones. No son linderos de propiedad privada." },
    en: { n: "Official land grid (PLSS)", q: "The real federal land survey lines: townships (36 mi²) and sections (1 mi², 259 ha). Measured boundaries, not drawn by us.", i: "Shows where each section starts and ends and lets you take a whole one as your land with a click. Many Midwest fields follow these lines.", r: "Source: BLM. Covers about 30 states (Midwest and West), not Texas or the East. Zoom in to see sections. They are not private property lines." },
    pt: { n: "Grade oficial de terras (PLSS)", q: "As linhas reais do levantamento federal: municípios (36 mi²) e seções (1 mi², 259 ha). Limites medidos, não desenhados por nós.", i: "Mostra onde cada seção começa e termina e deixa você tomar uma inteira como seu terreno com um clique. Muitos campos do Meio-Oeste seguem essas linhas.", r: "Fonte: BLM. Cobre cerca de 30 estados (Meio-Oeste e Oeste), não Texas nem o Leste. Aproxime para ver as seções. Não são divisas de propriedade privada." } } },
  { kind: "usgs", id: "stations", g: "water", ic: "🏞️", t: {
    es: { n: "Ríos y pozos cercanos", q: "Sensores reales de agua del USGS: caudal, nivel y temperatura.", i: "Indica cuánta agua hay cerca para riego y si hay riesgo de crecida. Acerca el mapa para verlos.", r: "Solo EE. UU.; son puntos, no una imagen." },
    en: { n: "Nearby rivers and wells", q: "Real USGS water sensors: flow, level and temperature.", i: "Shows how much water is nearby for irrigation and whether there is flood risk. Zoom in to see them.", r: "US only; they are points, not an image." },
    pt: { n: "Rios e poços próximos", q: "Sensores reais de água do USGS: vazão, nível e temperatura.", i: "Indica quanta água há perto para irrigação e se há risco de cheia. Aproxime o mapa para vê-los.", r: "Só EUA; são pontos, não uma imagem." } } },
];

const tzs = { loc: null, poly: null, mk: null, panel: null, legend: null, drawer: null, busy: false };
window.tzs = tzs;
// Variables de app.js y explorer.js (let/const globales) visibles como window.* para la cápsula B (b_mejoras.js)
for (const [k, get, set] of [["lang", () => lang, v => (lang = v)], ["D", () => D, v => (D = v)], ["map", () => map, v => (map = v)]]) Object.defineProperty(window, k, { get, set, configurable: true });
window.C = C; window.ex = ex;
const inUS =(la, lo) => la >= 24 && la <= 50 && lo >= -125 && lo <= -66;

// ---------- ubicación ----------
function locStat() {
  const l = tzs.loc;
  $("#locstat").innerHTML = !l ? esc(tz("loc_none")) : `${l.sim ? `<span class="simtag">🧪 ${esc(tz("loc_sim"))}</span>` : `<b>📍 ${esc(tz("loc_real"))}</b>`} ${l.lat.toFixed(4)}, ${l.lon.toFixed(4)} ${l.label ? "· " + esc(l.label) : ""}${inUS(l.lat, l.lon) ? "" : `<br><span style="color:var(--bad)">${esc(tz("outside"))}</span>`}`;
}
function setLoc(lat, lon, sim, label) {
  tzs.loc = { lat, lon, sim, label: label || "" };
  tzs.mk && map.removeLayer(tzs.mk);
  tzs.mk = L.marker([lat, lon]).addTo(map).bindTooltip(sim ? "🧪 " + tz("loc_sim") : "📍 " + tz("loc_real"), { permanent: true, direction: "top" });
  map.setView([lat, lon], 13); locStat(); load(lat, lon, label || "");
}
window.setLoc = setLoc;
function gps() {
  if (!navigator.geolocation) { $("#locstat").textContent = tz("gps_fail"); $("#simbox").hidden = false; return; }
  $("#locstat").textContent = tz("gps_wait");
  navigator.geolocation.getCurrentPosition(p => { setLoc(p.coords.latitude, p.coords.longitude, false, ""); if (!inUS(p.coords.latitude, p.coords.longitude)) $("#simbox").hidden = false; },
    () => { $("#locstat").textContent = tz("gps_fail"); $("#simbox").hidden = false; }, { timeout: 10000 });
}

// ---------- terreno dibujado ----------
const ndviCol = v => (v == null ? "#888" : v < 0.2 ? "#c0392b" : v < 0.3 ? "#e67e22" : v < 0.5 ? "#f1c40f" : v < 0.7 ? "#8bc34a" : "#1b7a2f");
const ndviTxt = v => (v == null ? "—" : tz(v < 0.2 ? "lg1" : v < 0.3 ? "lg2" : v < 0.5 ? "lg3" : v < 0.7 ? "lg4" : "lg5"));
function limpiar() {
  tzs.label = ""; tzs.bare = null; tzs.ai?.clearLayers(); if ($("#aistat")) $("#aistat").textContent = "";
  tzs.drawer?.disable(); tzs.group?.clearLayers(); tzs.cells?.clearLayers(); tzs.poly = null;
  tzs.legend && map.removeControl(tzs.legend); tzs.legend = null; $("#terstat").textContent = "";
}
function empezarDibujo() { limpiar(); tzs.drawer = new L.Draw.Polygon(map, { shapeOptions: { color: "#ffd200", weight: 3, fillOpacity: 0.08 }, allowIntersection: false, showArea: false }); tzs.drawer.enable(); $("#terstat").textContent = tz("draw_hint"); }
function leyenda() {
  tzs.legend = L.control({ position: "bottomright" });
  tzs.legend.onAdd = () => { const d = L.DomUtil.create("div", "maplegend"); d.innerHTML = `<b>${esc(tz("lg_title"))}</b><br>` + [["#c0392b", "lg1"], ["#e67e22", "lg2"], ["#f1c40f", "lg3"], ["#8bc34a", "lg4"], ["#1b7a2f", "lg5"]].map(([c, k]) => `<i style="background:${c}"></i>${esc(tz(k))}<br>`).join("") + `<span style="color:var(--mut)">${esc(tz("ndvi_help"))}<br>${esc(tz("lg_note"))}</span>`; return d; };
  tzs.legend.addTo(map);
}
async function analizarTerreno() {
  const ll = tzs.poly.getLatLngs()[0], c = tzs.poly.getBounds().getCenter(), ha = L.GeometryUtil.geodesicArea(ll) / 10000;
  $("#terstat").textContent = `${ha.toFixed(1)} ${tz("area")} …`;
  load(c.lat, c.lng, "");  // datos del punto central: clima, suelo, precios
  try {
    const poly = ll.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
    const r = await (await fetch(`/api/v1/terreno?poly=${encodeURIComponent(poly)}&celdas=${$("#cellsel").value}`)).json();
    if (r.estado !== "OK") { $("#terstat").textContent = `${ha.toFixed(1)} ${tz("area")} · ${r.estado === "SIN_COBERTURA" ? tz("no_cells") : r.detalle || tz("err")}`; return; }
    tzs.cells.clearLayers();
    r.celdas.forEach(k => L.rectangle(k.limites, { color: "#222", weight: 1, fillColor: ndviCol(k.ndvi), fillOpacity: 0.65 }).bindPopup(`<b>NDVI ${k.ndvi ?? "—"}</b><br>${esc(ndviTxt(k.ndvi))}<br><small>${k.lado_m} ${tz("m")} · ${r.fecha} · ${k.n_muestras}/9 ${tz("pts")}</small>`).addTo(tzs.cells));
    tzs.legend || leyenda();
    tzs.bare = r.pct_celdas_bajo_030; if (D) renderDecision();
    $("#terstat").innerHTML = `${tzs.label ? `<b>${esc(tzs.label)}</b><br>` : ""}<b>${r.area_ha} ${esc(tz("area"))}</b> · ${r.celdas.length} ${esc(tz("cell_of"))} ${r.celdas[0]?.lado_m} ${esc(tz("m"))}<br>${esc(tz("ndvi_avg"))}: <b>${r.ndvi_promedio ?? "—"}</b> · <b>${r.pct_celdas_bajo_030 ?? "—"}%</b> ${esc(tz("bare"))}<br><span class="mut">${esc(tz("scene"))} ${esc(r.fecha)} · ${esc(tz("clouds"))} ${r.nubosidad_pct}% · Sentinel-2</span>`;
  } catch (e) { $("#terstat").textContent = tz("err") + ": " + e.message; }
}

// ---------- datos dentro del mapa ----------
window.exAfterRender = () => {
  $("#resnone").hidden = true;
  tzs.panel && map.removeControl(tzs.panel);
  tzs.panel = L.control({ position: "bottomleft" });
  tzs.panel.onAdd = () => { const d = L.DomUtil.create("div", "mappanel"); L.DomEvent.disableClickPropagation(d); d.innerHTML = `<button class="x" data-closepanel>✕</button><h4>${esc(tz("panel"))}</h4>${$("#hero").innerHTML}`; return d; };
  tzs.panel.addTo(map);
};

// ---------- capas útiles ----------
function useful() {
  const box = $("#useful"); if (!ex.cat) { box.innerHTML = `<p class="small mut">…</p>`; return; }
  const ok = u => u.kind === "usgs" || u.kind === "plss" || (u.kind === "gibs" ? (Array.isArray(ex.cat.gibs) && ex.cat.gibs.some(l => l.id === u.id)) : u.kind === "lf" ? (Array.isArray(ex.cat.landfire) && ex.cat.landfire.some(l => l.id === u.id)) : (Array.isArray(ex.cat.planetary) && ex.cat.planetary.some(c => c.id === u.id)));
  const G = ["veg", "water", "risk", "ctx"], items = USEFUL.filter(ok);
  box.innerHTML = G.map(g => `<h2 class="sub" style="font-size:14px;margin:10px 0 2px">${esc(tz("g_" + g))}</h2>` + items.filter(u => u.g === g).map(u => {
    const d = u.t[lang] || u.t.en, on = u.kind === "usgs" ? ex.usgsOn : u.kind === "plss" ? !!tzs.plss : ex.act.has(u.kind + ":" + u.id);
    return `<div class="ul"><input type="checkbox" id="u_${esc(u.id)}" data-kind="${u.kind}" data-id="${esc(u.id)}" ${on ? "checked" : ""}><div><label for="u_${esc(u.id)}"><b>${u.ic} ${esc(d.n)}</b></label><div class="q">${esc(d.q)}</div>
      <details><summary>${esc(tz("mean"))}</summary><div class="ex"><b>${esc(tz("impact"))}:</b> ${esc(d.i)}</div><div class="ex"><b>${esc(tz("limit"))}:</b> ${esc(d.r)}</div></details><span class="st"></span></div></div>`;
  }).join("")).join("");
}
window.tzUseful = useful;

// ---------- textos y eventos ----------
function tzRender() {
  document.querySelectorAll("[data-t]").forEach(e => (e.textContent = tz(e.dataset.t)));
  $("#btn_gps").textContent = tz("btn_gps"); $("#btn_sim").textContent = tz("btn_sim"); $("#btn_draw").textContent = tz("btn_draw"); $("#btn_clear").textContent = tz("btn_clear");
  locStat(); useful();
}
const _exRender = window.exRender; window.exRender = () => { _exRender(); tzRender(); };
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.id === "btn_gps") gps();
  else if (b.id === "btn_sim") $("#simbox").hidden = !$("#simbox").hidden;
  else if (b.id === "btn_draw") empezarDibujo();
  else if (b.id === "btn_clear") limpiar();
  else if (b.dataset.closepanel !== undefined) { map.removeControl(tzs.panel); tzs.panel = null; }
});
// ---------- secciones oficiales del catastro (BLM PLSS) ----------
const PLSS = "https://gis.blm.gov/arcgis";
document.addEventListener("change", e => {
  if (e.target.dataset?.kind !== "plss") return;
  e.stopImmediatePropagation();
  if (e.target.checked) tzs.plss = L.tileLayer.wms(`${PLSS}/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/WMSServer`, { layers: "1,2", format: "image/png", transparent: true, version: "1.3.0", attribution: "BLM PLSS" }).addTo(map);
  else { map.removeLayer(tzs.plss); tzs.plss = null; }
}, true);
async function usarSeccion(la, lo) {
  map.closePopup(); $("#terstat").textContent = "…";
  try {
    const r = await (await fetch(`${PLSS}/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/2/query?geometry=${lo},${la}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FRSTDIVLAB,PLSSID&outSR=4326&returnGeometry=true&f=json`)).json();
    const f = r.features?.[0]; if (!f) { $("#terstat").textContent = tz("sec_none"); return; }
    limpiar();
    tzs.poly = L.polygon(f.geometry.rings[0].map(([x, y]) => [y, x]), { color: "#ffd200", weight: 3, fillOpacity: 0.08 });
    tzs.group.addLayer(tzs.poly); map.fitBounds(tzs.poly.getBounds());
    tzs.label = `${tz("sec_lbl")} ${f.attributes.FRSTDIVLAB}, ${tz("g_lbl")} ${f.attributes.PLSSID} (BLM PLSS)`;
    analizarTerreno();
  } catch (e) { $("#terstat").textContent = tz("err") + ": " + e.message; }
}
document.addEventListener("click", e => { const b = e.target.closest("button[data-sec]"); if (b) usarSeccion(...b.dataset.sec.split(",").map(Number)); });
tzs.group = L.featureGroup().addTo(map); tzs.cells = L.layerGroup().addTo(map);
map.on(L.Draw.Event.CREATED, e => { tzs.drawer = null; tzs.poly = e.layer; tzs.group.addLayer(e.layer); analizarTerreno(); });
tzRender();
const _w = setInterval(() => { if (ex.cat) { clearInterval(_w); useful(); } }, 300);  // el catálogo llega después de cargar la página

// ---------- Recolección de datos: qué hay guardado y cómo va cada fuente ----------
const RC = {
  en: { t: "Data collection", sub: "What we have already saved from real sources into local databases, and how each collector is going. It refreshes every 5 seconds.", src: "Collectors (in parallel)", st: { corriendo: "running", terminada: "finished" }, done: "done", err: "errors", tabs: "Saved tables", rows: "rows", crops: "Crop labels (USDA CDL 2021) for the AI", vars: "Numeric values sampled from maps", n: "values", range: "range", none: "Nothing collected yet.", why: "Every row is a real measurement at a real point. Nothing is filled in with made-up values; where a source has no value, it stays empty.",
    d: { modis_ndvi: "Vegetation greenness, MODIS (250 m, every 16 days)", modis_lst: "Ground temperature by day, MODIS (1 km)", modis_lai: "Leaf amount and light absorbed, MODIS (500 m)", modis_et: "Water the land loses per year, MODIS (500 m)", worldcover: "Land cover class, ESA WorldCover (10 m)", dem: "Elevation, Copernicus (30 m)" } },
  es: { t: "Recolección de datos", sub: "Lo que ya guardamos de fuentes reales en bases locales y cómo va cada recolector. Se actualiza cada 5 segundos.", src: "Recolectores (en paralelo)", st: { corriendo: "corriendo", terminada: "terminada" }, done: "hechas", err: "errores", tabs: "Tablas guardadas", rows: "filas", crops: "Etiquetas de cultivo (USDA CDL 2021) para la IA", vars: "Valores numéricos tomados de mapas", n: "valores", range: "rango", none: "Todavía no hay nada recolectado.", why: "Cada fila es una medición real en un punto real. Nada se rellena con valores inventados; donde una fuente no tiene dato, queda vacío.",
    d: { modis_ndvi: "Verdor de la vegetación, MODIS (250 m, cada 16 días)", modis_lst: "Temperatura del suelo de día, MODIS (1 km)", modis_lai: "Cantidad de hojas y luz absorbida, MODIS (500 m)", modis_et: "Agua que pierde el terreno al año, MODIS (500 m)", worldcover: "Tipo de cobertura del suelo, ESA WorldCover (10 m)", dem: "Elevación, Copernicus (30 m)" } },
  pt: { t: "Coleta de dados", sub: "O que já guardamos de fontes reais em bases locais e como vai cada coletor. Atualiza a cada 5 segundos.", src: "Coletores (em paralelo)", st: { corriendo: "rodando", terminada: "concluída" }, done: "feitas", err: "erros", tabs: "Tabelas guardadas", rows: "linhas", crops: "Rótulos de cultura (USDA CDL 2021) para a IA", vars: "Valores numéricos tirados de mapas", n: "valores", range: "faixa", none: "Ainda não há nada coletado.", why: "Cada linha é uma medição real em um ponto real. Nada é preenchido com valores inventados; onde a fonte não tem dado, fica vazio.",
    d: { modis_ndvi: "Verdor da vegetação, MODIS (250 m, a cada 16 dias)", modis_lst: "Temperatura do solo de dia, MODIS (1 km)", modis_lai: "Quantidade de folhas e luz absorvida, MODIS (500 m)", modis_et: "Água que o terreno perde por ano, MODIS (500 m)", worldcover: "Tipo de cobertura do solo, ESA WorldCover (10 m)", dem: "Elevação, Copernicus (30 m)" } },
};
async function recol() {
  const box = $("#pane-recoleccion"), R = RC[lang] || RC.en;
  try {
    const d = await (await fetch("/api/v1/recoleccion")).json();
    const bar = (a, b) => `<div style="background:var(--line);border-radius:6px;height:8px"><div style="width:${b ? Math.min(100, 100 * a / b) : 0}%;background:var(--crop);height:8px;border-radius:6px"></div></div>`;
    box.innerHTML = `<div class="card"><h2>${esc(R.t)}</h2><p class="small mut">${esc(R.sub)}</p><p class="small">${esc(R.why)}</p></div>
      <div class="card"><h2>${esc(R.src)}</h2>${d.fuentes.map(f => `<div style="margin:8px 0"><b>${esc(f.fuente)}</b> <span class="chip">${esc(R.st[f.estado] || f.estado)}</span><div class="small mut">${esc(R.d[f.fuente] || "")}</div>${bar(f.hechas, f.total)}<div class="small">${f.hechas}/${f.total} ${esc(R.done)} · ${f.errores} ${esc(R.err)} · ${esc(f.actualizado.replace("T", " "))}</div></div>`).join("") || `<p class="mut">${esc(R.none)}</p>`}</div>
      <div class="card"><h2>${esc(R.crops)}</h2><div>${d.clases_cultivo.map(c => `<span class="chip">${esc(c.clase)} · ${c.n}</span>`).join("") || esc(R.none)}</div></div>
      <div class="card"><h2>${esc(R.vars)}</h2><table>${(d.variables || []).map(v => `<tr><td>${esc(v.fuente)}</td><td>${esc(v.variable)}</td><td>${v.n} ${esc(R.n)}</td><td class="mut small">${esc(R.range)} ${v.min} … ${v.max}</td></tr>`).join("")}</table></div>
      <div class="card"><h2>${esc(R.tabs)}</h2><table>${d.tablas.map(t => `<tr><td class="small">${esc(t.base)}</td><td>${esc(t.tabla)}</td><td>${t.filas} ${esc(R.rows)}</td></tr>`).join("")}</table></div>`;
  } catch (e) { box.textContent = e.message; }
}
setInterval(() => document.body.dataset.view === "recoleccion" && recol(), 5000);
document.addEventListener("click", e => { if (e.target.closest("button[data-view=recoleccion]")) recol(); });

// ---------- IA: qué cultivo hubo en cada cuadro (modelo entrenado con USDA CDL + Sentinel-2) ----------
const AI = {
  en: { btn: "🤖 What crop was here? (AI)", wait: "Reading up to 10 satellite dates of the last full season… up to 2 minutes.", draw: "Draw or pick your land first.", t: "Crop predicted by the AI", conf: "confidence", season: "season", acc: "The model got", acc2: "of its test points right in a year and areas it had never seen, trained on central Iowa 2018-2021 (USDA CDL labels). Outside that region it is not validated.", fuera: "⚠ This land is outside the zone the model was trained on: treat the result as a rough guess.", note: "It is a prediction, not a measurement: confirm in the field.",
    c: { maiz: "Maize", soya: "Soy", pastizal: "Grass / pasture", bosque: "Forest", urbano: "Built-up", otro: "Other (not maize/soy)" } },
  es: { btn: "🤖 ¿Qué cultivo hubo aquí? (IA)", wait: "Leyendo hasta 10 fechas de satélite de la última temporada completa… hasta 2 minutos.", draw: "Primero dibuja o elige tu terreno.", t: "Cultivo que predice la IA", conf: "confianza", season: "temporada", acc: "El modelo acertó", acc2: "de sus puntos de prueba en un año y zonas que nunca había visto, entrenado en el centro de Iowa 2018-2021 (etiquetas USDA CDL). Fuera de esa región no está validado.", fuera: "⚠ Este terreno está fuera de la zona donde se entrenó el modelo: toma el resultado como una idea aproximada.", note: "Es una predicción, no una medición: confírmala en el campo.",
    c: { maiz: "Maíz", soya: "Soya", pastizal: "Pastizal", bosque: "Bosque", urbano: "Zona construida", otro: "Otro (no maíz ni soya)" } },
  pt: { btn: "🤖 Que cultura havia aqui? (IA)", wait: "Lendo até 10 datas de satélite da última safra completa… até 2 minutos.", draw: "Primeiro desenhe ou escolha seu terreno.", t: "Cultura prevista pela IA", conf: "confiança", season: "safra", acc: "O modelo acertou", acc2: "dos seus pontos de teste em um ano e áreas que nunca tinha visto, treinado no centro de Iowa 2018-2021 (rótulos USDA CDL). Fora dessa região não está validado.", fuera: "⚠ Este terreno está fora da zona onde o modelo foi treinado: trate o resultado como uma ideia aproximada.", note: "É uma previsão, não uma medição: confirme no campo.",
    c: { maiz: "Milho", soya: "Soja", pastizal: "Pastagem", bosque: "Floresta", urbano: "Área construída", otro: "Outro (não milho nem soja)" } },
};
const AICOL = { maiz: "#f1c40f", soya: "#2e9b4f", pastizal: "#9ccc65", bosque: "#1b5e20", urbano: "#8d6e63", otro: "#90a4ae" };
(function () {
  const b = document.createElement("button"); b.id = "btn_ai"; $("#terstat").insertAdjacentElement("afterend", b);
  const s = document.createElement("div"); s.id = "aistat"; s.className = "small"; b.insertAdjacentElement("afterend", s);
  tzs.ai = L.layerGroup().addTo(map);
  const txt = () => (b.textContent = (AI[lang] || AI.en).btn);
  txt(); const _r = window.exRender; window.exRender = () => { _r(); txt(); };
  b.addEventListener("click", async () => {
    const A = AI[lang] || AI.en;
    if (!tzs.poly) { s.textContent = A.draw; return; }
    s.textContent = A.wait; b.disabled = true; tzs.ai.clearLayers();
    try {
      const poly = tzs.poly.getLatLngs()[0].map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
      const r = await (await fetch(`/api/v1/cultivos-ia?poly=${encodeURIComponent(poly)}&celdas=${$("#cellsel").value}`)).json();
      if (r.estado !== "OK") { s.textContent = r.detalle || r.estado; return; }
      tzs.cells.clearLayers();
      r.celdas.forEach(k => L.rectangle(k.limites, { color: "#222", weight: 1, fillColor: AICOL[k.clase] || "#888", fillOpacity: 0.7 })
        .bindPopup(`<b>${esc(A.c[k.clase] || k.clase)}</b> · ${esc(A.conf)} ${Math.round(k.confianza * 100)}%<br><small>${Object.entries(k.probas).map(([c, p]) => `${esc(A.c[c] || c)} ${Math.round(p * 100)}%`).join(" · ")}</small>`).addTo(tzs.ai));
      tzs.legend && (map.removeControl(tzs.legend), tzs.legend = null);
      tzs.legend = L.control({ position: "bottomright" });
      tzs.legend.onAdd = () => { const d = L.DomUtil.create("div", "maplegend"); d.innerHTML = `<b>${esc(A.t)}</b><br>` + Object.entries(A.c).map(([c, n]) => `<i style="background:${AICOL[c]}"></i>${esc(n)}<br>`).join(""); return d; };
      tzs.legend.addTo(map);
      s.innerHTML = `<b>${esc(A.t)} (${esc(A.season)} ${r.anio}):</b> ${Object.entries(r.resumen).map(([c, p]) => `${esc(A.c[c] || c)} ${p}%`).join(" · ")}<br>${esc(A.acc)} <b>${Math.round(r.modelo.acierto_zonas_no_vistas * 100)}%</b> ${esc(A.acc2)}<br>${r.modelo.dentro_de_zona_entrenada === false ? `<b>${esc(A.fuera)}</b><br>` : ""}<span class="mut">${esc(A.note)}</span>`;
    } catch (e) { s.textContent = e.message; } finally { b.disabled = false; }
  });
})();
