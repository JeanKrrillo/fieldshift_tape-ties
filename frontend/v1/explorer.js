// Explorador de datos: lista todo lo que ofrecen las fuentes (leído en vivo de /api/v1/catalogo) y deja prender las capas de mapa.
const X = {
  en: { nav_recol: "Data collection", nav_terreno: "My land", nav_catalog: "Full catalog", use_here: "Use as my (simulated) location", title: "Everything we can see", sub: "Live catalogs of NASA, USDA, USGS and Microsoft. Turn layers on over the map, or read what each source offers.",
    q: "Search layers, reports, parameters…", date: "Date for time layers", date_hint: "Empty = latest available per layer", active: "On the map", none: "No layers on. Tick any layer below.", show_more: "Show more", of: "of",
    s_gibs: "NASA GIBS · satellite map layers", s_lf: "LANDFIRE · vegetation and fire layers (USGS/USFS)", s_pc: "Microsoft Planetary Computer · satellite collections", s_usgs: "USGS Water · stations and collections", s_pt: "Data by point (no map layer)",
    s_power: "NASA POWER · weather and solar parameters", s_mars: "USDA AMS MARS · market reports", c_all: "All", cat_veg: "Vegetation", cat_soil: "Soil and water", cat_rain: "Rain", cat_temp: "Temperature", cat_fire: "Fire", cat_cloud: "Clouds", cat_snow: "Snow and ice", cat_sea: "Ocean", cat_air: "Atmosphere", cat_img: "True-color imagery", cat_land: "Land cover and people", cat_other: "Other",
    show: "Show at map center", nomap: "No map view; this collection is data only", looking: "Looking for imagery here…", noitem: "No scene covers the map center", stations: "USGS monitoring stations in view", zoomin: "Zoom in to see stations", analyze: "Analyze a parcel here", n_gibs: "map layers", n_lf: "map layers", n_pc: "collections", n_usgs: "collections", n_mars: "market reports", n_power: "parameters", n_cmr: "NASA datasets", n_src: "sources", no_date: "No image for this date at the map center. Change the date above.", empty: "This layer has no data at the map center (try another place or date).", guide: "How to use: 1) tick a layer below, 2) look at the map, 3) adjust date and transparency. The topic buttons only narrow the list; they do not change the map.", theme: "Topic", err: "Catalog source failed", period: "available", unit: "unit", place: "Go to a place…",
    ptnote: "These sources answer per point. They appear in the parcel analysis, not as map layers." },
  es: { nav_recol: "Recolección de datos", nav_terreno: "Mi terreno", nav_catalog: "Catálogo completo", use_here: "Usar como mi ubicación (simulada)", title: "Todo lo que podemos ver", sub: "Catálogos en vivo de NASA, USDA, USGS y Microsoft. Prende capas sobre el mapa o lee qué ofrece cada fuente.",
    q: "Buscar capas, reportes, parámetros…", date: "Fecha para capas con tiempo", date_hint: "Vacío = lo más reciente de cada capa", active: "En el mapa", none: "Ninguna capa prendida. Marca cualquiera abajo.", show_more: "Mostrar más", of: "de",
    s_gibs: "NASA GIBS · capas de mapa de satélite", s_lf: "LANDFIRE · capas de vegetación y fuego (USGS/USFS)", s_pc: "Microsoft Planetary Computer · colecciones de satélite", s_usgs: "USGS Agua · estaciones y colecciones", s_pt: "Datos por punto (sin capa de mapa)",
    s_power: "NASA POWER · parámetros de clima y sol", s_mars: "USDA AMS MARS · reportes de mercado", c_all: "Todas", cat_veg: "Vegetación", cat_soil: "Suelo y agua", cat_rain: "Lluvia", cat_temp: "Temperatura", cat_fire: "Fuego", cat_cloud: "Nubes", cat_snow: "Nieve y hielo", cat_sea: "Océano", cat_air: "Atmósfera", cat_img: "Imagen a color real", cat_land: "Cobertura de tierra y población", cat_other: "Otras",
    show: "Mostrar en el centro del mapa", nomap: "Sin vista de mapa; esta colección es solo datos", looking: "Buscando imagen aquí…", noitem: "Ninguna escena cubre el centro del mapa", stations: "Estaciones de monitoreo USGS a la vista", zoomin: "Acércate para ver estaciones", analyze: "Analizar una parcela aquí", n_gibs: "capas de mapa", n_lf: "capas de mapa", n_pc: "colecciones", n_usgs: "colecciones", n_mars: "reportes de mercado", n_power: "parámetros", n_cmr: "conjuntos de datos NASA", n_src: "fuentes", no_date: "No hay imagen para esa fecha en el centro del mapa. Cambia la fecha de arriba.", empty: "Esta capa no tiene datos en el centro del mapa (prueba otro lugar o fecha).", guide: "Cómo se usa: 1) marca una capa abajo, 2) mírala en el mapa, 3) ajusta fecha y transparencia. Los botones de tema solo acortan la lista; no cambian el mapa.", theme: "Tema", err: "Falló una fuente del catálogo", period: "disponible", unit: "unidad", place: "Ir a un lugar…",
    ptnote: "Estas fuentes responden por punto. Salen en el análisis de la parcela, no como capas de mapa." },
  pt: { nav_recol: "Coleta de dados", nav_terreno: "Meu terreno", nav_catalog: "Catálogo completo", use_here: "Usar como minha localização (simulada)", title: "Tudo o que podemos ver", sub: "Catálogos ao vivo de NASA, USDA, USGS e Microsoft. Ligue camadas sobre o mapa ou leia o que cada fonte oferece.",
    q: "Buscar camadas, relatórios, parâmetros…", date: "Data para camadas com tempo", date_hint: "Vazio = mais recente de cada camada", active: "No mapa", none: "Nenhuma camada ligada. Marque qualquer uma abaixo.", show_more: "Mostrar mais", of: "de",
    s_gibs: "NASA GIBS · camadas de mapa de satélite", s_lf: "LANDFIRE · camadas de vegetação e fogo (USGS/USFS)", s_pc: "Microsoft Planetary Computer · coleções de satélite", s_usgs: "USGS Água · estações e coleções", s_pt: "Dados por ponto (sem camada de mapa)",
    s_power: "NASA POWER · parâmetros de clima e sol", s_mars: "USDA AMS MARS · relatórios de mercado", c_all: "Todas", cat_veg: "Vegetação", cat_soil: "Solo e água", cat_rain: "Chuva", cat_temp: "Temperatura", cat_fire: "Fogo", cat_cloud: "Nuvens", cat_snow: "Neve e gelo", cat_sea: "Oceano", cat_air: "Atmosfera", cat_img: "Imagem em cor real", cat_land: "Cobertura da terra e população", cat_other: "Outras",
    show: "Mostrar no centro do mapa", nomap: "Sem visão de mapa; esta coleção é só dados", looking: "Procurando imagem aqui…", noitem: "Nenhuma cena cobre o centro do mapa", stations: "Estações de monitoramento USGS à vista", zoomin: "Aproxime para ver estações", analyze: "Analisar uma parcela aqui", n_gibs: "camadas de mapa", n_lf: "camadas de mapa", n_pc: "coleções", n_usgs: "coleções", n_mars: "relatórios de mercado", n_power: "parâmetros", n_cmr: "conjuntos de dados NASA", n_src: "fontes", no_date: "Sem imagem para essa data no centro do mapa. Mude a data acima.", empty: "Esta camada não tem dados no centro do mapa (tente outro lugar ou data).", guide: "Como usar: 1) marque uma camada abaixo, 2) veja no mapa, 3) ajuste data e transparência. Os botões de tema só encurtam a lista; não mudam o mapa.", theme: "Tema", err: "Falhou uma fonte do catálogo", period: "disponível", unit: "unidade", place: "Ir a um lugar…",
    ptnote: "Estas fontes respondem por ponto. Aparecem na análise da parcela, não como camadas de mapa." },
};
const x = n => X[lang]?.[n] ?? X.en[n] ?? n;
const POINTS = [
  ["NASA POWER", { en: "Daily and monthly weather, solar radiation and soil moisture since 1981. We read about 10 parameters today.", es: "Clima diario y mensual, radiación solar y humedad del suelo desde 1981. Hoy leemos unos 10 parámetros.", pt: "Clima diário e mensal, radiação solar e umidade do solo desde 1981. Hoje lemos uns 10 parâmetros." }],
  ["Meteomatics", { en: "7-day forecast at 1 km: temperature, rain, soil moisture.", es: "Pronóstico de 7 días a 1 km: temperatura, lluvia, humedad del suelo.", pt: "Previsão de 7 dias a 1 km: temperatura, chuva, umidade do solo." }],
  ["OpenET", { en: "Crop water use (ET) and its model range, plus vegetation index, at 30 m. Continental US only.", es: "Consumo de agua del cultivo (ET) y su rango entre modelos, más índice de vegetación, a 30 m. Solo EE. UU. continental.", pt: "Uso de água da cultura (ET) e sua faixa entre modelos, mais índice de vegetação, a 30 m. Só EUA continental." }],
  ["USDA SSURGO", { en: "Soil by depth: organic matter, pH, clay, density, erodibility, available water, drainage. US only.", es: "Suelo por profundidad: materia orgánica, pH, arcilla, densidad, erodabilidad, agua disponible, drenaje. Solo EE. UU.", pt: "Solo por profundidade: matéria orgânica, pH, argila, densidade, erodibilidade, água disponível, drenagem. Só EUA." }],
  ["NASA CMR", { en: "Catalog of NASA datasets and the dates of satellite passes over a point.", es: "Catálogo de conjuntos de datos NASA y fechas de pasadas de satélite sobre un punto.", pt: "Catálogo de conjuntos de dados NASA e datas de passagens de satélite sobre um ponto." }],
  ["Google Geocoding / US Census", { en: "Address to coordinates (Google, capped per day) and coordinates to US state (Census).", es: "Dirección a coordenadas (Google, con tope diario) y coordenadas a estado de EE. UU. (Censo).", pt: "Endereço para coordenadas (Google, com limite diário) e coordenadas para estado dos EUA (Censo)." }],
];
const ex = { cat: null, gcat: "all", q: "", limit: { gibs: 60, lf: 60, pc: 40, power: 60, mars: 60 }, act: new Map(), map: null, usgs: null, usgsOn: false };
const LF_DESC = { EVT: ["Tipo de vegetación", "Vegetation type", "Tipo de vegetação"], EVC: ["Cobertura de vegetación", "Vegetation cover", "Cobertura da vegetação"], EVH: ["Altura de vegetación", "Vegetation height", "Altura da vegetação"], FVT: ["Vegetación original", "Reference vegetation type", "Vegetação original"], FVC: ["Cobertura original", "Reference cover", "Cobertura original"], FVH: ["Altura original", "Reference height", "Altura original"],
  CBD: ["Densidad del dosel", "Canopy bulk density", "Densidade do dossel"], CBH: ["Altura de la base del dosel", "Canopy base height", "Altura da base do dossel"], CC: ["Cobertura de copas", "Canopy cover", "Cobertura de copas"], CH: ["Altura de copas", "Canopy height", "Altura de copas"],
  FBFM13: ["Modelo de combustible (13)", "Fuel model (13)", "Modelo de combustível (13)"], FBFM40: ["Modelo de combustible (40)", "Fuel model (40)", "Modelo de combustível (40)"], FCCS: ["Carga de combustible", "Fuel characteristics", "Carga de combustível"],
  FDist: ["Disturbio de combustible", "Fuel disturbance", "Distúrbio de combustível"], LDist: ["Disturbio reciente", "Recent disturbance", "Distúrbio recente"], PDist: ["Disturbio previo", "Past disturbance", "Distúrbio prévio"], Dist: ["Disturbios", "Disturbance", "Distúrbios"], NVC: ["Clasificación nacional de vegetación", "National vegetation classification", "Classificação nacional de vegetação"] };
const lfInfo = l => { const m = l.id.match(/^LF(\d{4})_([A-Za-z0-9]+)_(\w+)$/); if (!m) return { title: l.titulo, year: 0 }; const d = LF_DESC[m[2].replace(/^([LPF]?Dist)\d+$/, "$1")]; const i = { en: 1, es: 0, pt: 2 }[lang]; return { title: `${d ? d[i] : m[2]} · ${m[3]} ${m[1]}`, year: +m[1] }; };

// ---------- mapa ----------
function exMap() {
  const m = L.map("emap", { worldCopyJump: true }).setView([39, -98], 4);
  const esri = (p, a) => L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/${p}/MapServer/tile/{z}/{y}/{x}`, { attribution: a || "Esri", maxZoom: 18 });
  const base = { "Satélite / Satellite (Esri)": esri("World_Imagery").addTo(m), "Topográfico (Esri)": esri("World_Topo_Map"), "Calles (Esri)": esri("World_Street_Map"),
    "OpenStreetMap": L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }) };
  L.control.layers(base, {}, { collapsed: true }).addTo(m);
  ex.usgs = L.layerGroup().addTo(m);
  map = m; kml = L.layerGroup().addTo(m);  // app.js (análisis de parcela) usa estas dos variables
  m.on("moveend", usgsRefresh);
  m.on("click", e => L.popup().setLatLng(e.latlng).setContent(`<b>${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}</b><br><button data-sim="${e.latlng.lat},${e.latlng.lng}">${esc(x("use_here"))}</button><br><button data-sec="${e.latlng.lat},${e.latlng.lng}">${esc(window.tz ? tz("sec_btn") : "")}</button>`).openOn(m));
  ex.map = m;
}
async function usgsRefresh() {
  ex.usgs.clearLayers();
  const el = $("#usgs_state") || document.createElement("span"); if (!ex.usgsOn) { if (el) el.textContent = ""; return; }
  const b = ex.map.getBounds();
  if (ex.map.getZoom() < 9) { el.textContent = x("zoomin"); return; }
  el.textContent = "…";
  const r = await (await fetch(`/api/v1/usgs-estaciones?oeste=${b.getWest()}&sur=${b.getSouth()}&este=${b.getEast()}&norte=${b.getNorth()}`)).json();
  const list = Array.isArray(r.estaciones) ? r.estaciones : [];
  list.forEach(s => L.circleMarker([s.lat, s.lon], { radius: 5, color: "#1b6fb5", weight: 1, fillOpacity: .7 }).bindPopup(`<b>${esc(s.nombre)}</b><br>${esc(s.tipo)}<br><a target="_blank" rel="noopener" href="https://waterdata.usgs.gov/monitoring-location/${encodeURIComponent(s.id)}">USGS</a>`).addTo(ex.usgs));
  el.textContent = r.estado === "ZOOM" ? x("zoomin") : String(list.length);
}

// ---------- capas ----------
function gibsDate(l) { const d = $("#exdate")?.value; return l.tiempo ? d || l.tiempo : null; }
function makeGibs(l) { const d = gibsDate(l); return L.tileLayer(`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${l.id}/default/${d ? d + "/" : ""}${l.matriz}/{z}/{y}/{x}.${l.ext}`, { maxNativeZoom: l.nivel, maxZoom: 18, opacity: .8, attribution: "NASA GIBS" }); }
async function makePC(c) {
  const p = ex.map.getCenter(), bb = [p.lng - .05, p.lat - .05, p.lng + .05, p.lat + .05].join(",");
  const j = await (await fetch(`https://planetarycomputer.microsoft.com/api/stac/v1/search?collections=${encodeURIComponent(c.id)}&bbox=${bb}&limit=1&sortby=-datetime`)).json();
  const f = (j.features || [])[0]; if (!f) return { err: x("noitem") };
  if (f.assets?.tilejson) { const tj = await (await fetch(f.assets.tilejson.href)).json(); return { layer: L.tileLayer(tj.tiles[0], { maxZoom: 18, opacity: .85, attribution: "Microsoft Planetary Computer" }), note: `${f.id} · ${(f.properties.datetime || "").slice(0, 10)}` }; }
  if (f.assets?.rendered_preview && f.bbox) return { layer: L.imageOverlay(f.assets.rendered_preview.href, [[f.bbox[1], f.bbox[0]], [f.bbox[3], f.bbox[2]]], { opacity: .85 }), note: `${f.id} · ${(f.properties.datetime || "").slice(0, 10)}` };
  return { err: x("nomap") };
}
async function toggle(kind, id, on, srcEl) {
  const key = kind + ":" + id, cat = ex.cat;
  if (!on) { const a = ex.act.get(key); if (a) ex.map.removeLayer(a.layer); ex.act.delete(key); return renderActive(); }
  let rec;
  if (kind === "gibs") { const l = cat.gibs.find(z => z.id === id); rec = { layer: makeGibs(l), title: l.titulo, meta: l, note: gibsDate(l) || "" }; }
  else if (kind === "lf") { const l = cat.landfire.find(z => z.id === id); rec = { layer: L.tileLayer.wms("https://edcintl.cr.usgs.gov/geoserver/landfire/wms", { layers: id, format: "image/png", transparent: true, opacity: .7, attribution: "USFS/USGS LANDFIRE" }), title: lfInfo(l).title, note: "" }; }
  else { const c = cat.planetary.find(z => z.id === id); srcEl.parentElement.querySelector(".st").textContent = x("looking"); const r = await makePC(c); srcEl.parentElement.querySelector(".st").textContent = r.err || ""; if (r.err) { srcEl.checked = false; return; } rec = { layer: r.layer, title: c.titulo, note: r.note }; }
  rec.layer.addTo(ex.map); ex.act.set(key, rec); renderActive();
  if (kind === "gibs") probeGibs(rec);
}
function renderActive() {
  const rows = [...ex.act.entries()].map(([k, a]) => `<div class="act"><b>${esc(a.title)}</b>${a.note ? `<small> · ${esc(a.note)}</small>` : ""}${a.warn ? `<div class="small" style="color:var(--bad)">⚠ ${esc(a.warn)}</div>` : ""}<div class="row"><input type="range" min="0" max="100" value="${Math.round((a.layer.options.opacity ?? 1) * 100)}" data-op="${esc(k)}" aria-label="opacity"><button data-rm="${esc(k)}">✕</button></div></div>`).join("");
  $("#exactive").innerHTML = rows || `<p class="small mut">${esc(x("none"))}</p>`;
}

// ---------- listas ----------
const hit = (...s) => !ex.q || s.join(" ").toLowerCase().includes(ex.q);
function more(kind, total, shown) { return total > shown ? `<button data-more="${kind}">${esc(x("show_more"))} (${shown} ${esc(x("of"))} ${total})</button>` : ""; }
const Y = {
  en: { u_veg: "Vegetation", u_soilm: "Soil moisture", u_rain: "Rain", u_water: "Water and drought", u_lst: "Ground temperature", u_land: "Crops and land cover", u_fire: "Fire", u_snow: "Snow", u_cloud: "Clouds and vapor", u_img: "Color imagery", u_refl: "Reflectance", u_airt: "Air temperature", u_air: "Atmosphere", u_sea: "Ocean and sea ice", u_orb: "Satellite orbits", u_otro: "Other",
    w_veg: "How green and healthy plants are. The base of crop monitoring.", w_soilm: "How wet the soil is, at the surface or the root zone. Tells when to irrigate or sow.", w_rain: "How much rain fell. Needed for any water balance.", w_water: "Groundwater, floods, surface water and drought. Water supply and risk.", w_lst: "How hot the ground is. Marks heat stress and dry soil.", w_land: "What is planted or covers the land.", w_fire: "Active fires and burned areas. Risk and alerts.", w_snow: "Snow cover. Future water for rivers and irrigation.", w_cloud: "Clouds and water vapor. Tells whether satellites can see the ground.", w_img: "A photo-like view of the ground. Good for context, not for measuring.", w_refl: "Raw light bounced by the ground, used to compute indices like NDVI.", w_airt: "Air temperature and humidity near the ground.", w_air: "Gases, dust and winds. Little direct use on a farm.", w_sea: "Ocean data. Almost no direct use on a farm.", w_orb: "Only draws where a satellite flew. Not data about the land.", w_otro: "Other science layers with no clear link to farming.",
    ut_alta: "High value for farming", ut_media: "Context value", ut_baja: "Low value for farming", live: "Live", hist: "Historic, ended", f_daily: "Daily", f_monthly: "Monthly", f_subdaily: "Several per day", f_yearly: "Yearly", f_none: "No fixed period",
    v_ok: "Visible here", v_empty: "No data here", v_none: "No image on date", v_unk: "Not tested", values: "Values in color scale", image: "Picture",
    f_util: "Value for farming", f_state: "Status", f_vis: "Visible in this area?", f_topic: "Topic", all: "All", dedup: "Hide repeated layers (one per family)", dedup_note: "repeated layers hidden: same data from another satellite, another frequency or quality variants.", showing: "Showing", probe: "Test which ones are visible in this area", probing: "Testing", detail: "Details", platform: "Satellite / sensor", raw: "Original data product", period2: "Available", today: "today", family: "Family", fam_n: "similar layers in its family", see_fam: "See its family", clear_fam: "Back to all", ai: "To train AI use the original data product, not this map picture.", bad: "Not visible", unk: "Not tested yet" },
  es: { u_veg: "Vegetación", u_soilm: "Humedad del suelo", u_rain: "Lluvia", u_water: "Agua y sequía", u_lst: "Temperatura del suelo", u_land: "Cultivos y cobertura", u_fire: "Fuego", u_snow: "Nieve", u_cloud: "Nubes y vapor", u_img: "Imagen a color", u_refl: "Reflectancia", u_airt: "Temperatura del aire", u_air: "Atmósfera", u_sea: "Océano y hielo marino", u_orb: "Órbitas de satélites", u_otro: "Otras",
    w_veg: "Qué tan verdes y sanas están las plantas. Es la base de vigilar cultivos.", w_soilm: "Qué tan húmedo está el suelo, en la superficie o en la raíz. Dice cuándo regar o sembrar.", w_rain: "Cuánta lluvia cayó. Hace falta para cualquier balance de agua.", w_water: "Agua subterránea, inundaciones, agua superficial y sequía. Abasto y riesgo.", w_lst: "Qué tan caliente está el suelo. Marca estrés por calor y suelo seco.", w_land: "Qué está sembrado o qué cubre la tierra.", w_fire: "Incendios activos y áreas quemadas. Riesgo y alertas.", w_snow: "Cobertura de nieve. Agua futura para ríos y riego.", w_cloud: "Nubes y vapor de agua. Dice si el satélite puede ver el suelo.", w_img: "Vista parecida a una foto. Sirve de contexto, no para medir.", w_refl: "Luz cruda que rebota el suelo; sirve para calcular índices como NDVI.", w_airt: "Temperatura y humedad del aire cerca del suelo.", w_air: "Gases, polvo y vientos. Poco uso directo en una finca.", w_sea: "Datos del océano. Casi sin uso directo en una finca.", w_orb: "Solo dibuja por dónde voló un satélite. No son datos de la tierra.", w_otro: "Otras capas científicas sin relación clara con el campo.",
    ut_alta: "Muy útil para el campo", ut_media: "Sirve de contexto", ut_baja: "Poco útil para el campo", live: "En vivo", hist: "Histórica, ya terminó", f_daily: "Diaria", f_monthly: "Mensual", f_subdaily: "Varias al día", f_yearly: "Anual", f_none: "Sin periodo fijo",
    v_ok: "Se ve aquí", v_empty: "Sin datos aquí", v_none: "Sin imagen en la fecha", v_unk: "Sin probar", values: "Valores en escala de color", image: "Imagen",
    f_util: "Utilidad para el campo", f_state: "Estado", f_vis: "¿Se ve en esta zona?", f_topic: "Tema", all: "Todas", dedup: "Ocultar capas repetidas (una por familia)", dedup_note: "capas repetidas ocultas: el mismo dato de otro satélite, otra frecuencia o variantes de calidad.", showing: "Mostrando", probe: "Probar cuáles se ven en esta zona", probing: "Probando", detail: "Detalle", platform: "Satélite / sensor", raw: "Producto de datos original", period2: "Disponible", today: "hoy", family: "Familia", fam_n: "capas parecidas en su familia", see_fam: "Ver su familia", clear_fam: "Volver a todas", ai: "Para entrenar IA usa el producto de datos original, no esta imagen del mapa.", bad: "No se ve", unk: "Aún sin probar" },
  pt: { u_veg: "Vegetação", u_soilm: "Umidade do solo", u_rain: "Chuva", u_water: "Água e seca", u_lst: "Temperatura do solo", u_land: "Culturas e cobertura", u_fire: "Fogo", u_snow: "Neve", u_cloud: "Nuvens e vapor", u_img: "Imagem em cor", u_refl: "Refletância", u_airt: "Temperatura do ar", u_air: "Atmosfera", u_sea: "Oceano e gelo marinho", u_orb: "Órbitas de satélites", u_otro: "Outras",
    w_veg: "Quão verdes e sadias estão as plantas. Base do monitoramento de culturas.", w_soilm: "Quão úmido está o solo, na superfície ou na raiz. Diz quando irrigar ou semear.", w_rain: "Quanta chuva caiu. Necessária para qualquer balanço de água.", w_water: "Água subterrânea, inundações, água superficial e seca. Oferta e risco.", w_lst: "Quão quente está o solo. Marca estresse por calor e solo seco.", w_land: "O que está plantado ou cobre a terra.", w_fire: "Incêndios ativos e áreas queimadas. Risco e alertas.", w_snow: "Cobertura de neve. Água futura para rios e irrigação.", w_cloud: "Nuvens e vapor de água. Diz se o satélite vê o solo.", w_img: "Vista parecida com uma foto. Serve de contexto, não para medir.", w_refl: "Luz bruta refletida pelo solo; serve para calcular índices como NDVI.", w_airt: "Temperatura e umidade do ar perto do solo.", w_air: "Gases, poeira e ventos. Pouco uso direto numa fazenda.", w_sea: "Dados do oceano. Quase sem uso direto numa fazenda.", w_orb: "Só desenha por onde um satélite passou. Não são dados da terra.", w_otro: "Outras camadas científicas sem relação clara com o campo.",
    ut_alta: "Muito útil para o campo", ut_media: "Serve de contexto", ut_baja: "Pouco útil para o campo", live: "Ao vivo", hist: "Histórica, já terminou", f_daily: "Diária", f_monthly: "Mensal", f_subdaily: "Várias por dia", f_yearly: "Anual", f_none: "Sem período fixo",
    v_ok: "Visível aqui", v_empty: "Sem dados aqui", v_none: "Sem imagem na data", v_unk: "Não testada", values: "Valores em escala de cor", image: "Imagem",
    f_util: "Utilidade para o campo", f_state: "Estado", f_vis: "Visível nesta área?", f_topic: "Tema", all: "Todas", dedup: "Ocultar camadas repetidas (uma por família)", dedup_note: "camadas repetidas ocultas: o mesmo dado de outro satélite, outra frequência ou variantes de qualidade.", showing: "Mostrando", probe: "Testar quais aparecem nesta área", probing: "Testando", detail: "Detalhe", platform: "Satélite / sensor", raw: "Produto de dados original", period2: "Disponível", today: "hoje", family: "Família", fam_n: "camadas parecidas na família", see_fam: "Ver a família", clear_fam: "Voltar a todas", ai: "Para treinar IA use o produto de dados original, não esta imagem do mapa.", bad: "Não visível", unk: "Ainda não testada" },
};
const y = n => Y[lang]?.[n] ?? Y.en[n] ?? n;
Object.assign(ex, { f: { uso: "all", util: "all", vivo: "all", vis: "all", dedup: true, fam: null }, vis: new Map(), probing: false });
const USOS = ["veg", "soilm", "rain", "water", "lst", "land", "fire", "snow", "cloud", "img", "refl", "airt", "air", "sea", "orb", "otro"];
const visOf = l => ex.vis.get(l.id) || "unk";
const gibsBase = () => ex.cat.gibs.filter(l => (ex.f.fam ? l.familia === ex.f.fam : !ex.f.dedup || l.representante) && hit(l.titulo, l.id, l.subtitulo || "", l.grupo || "", l.crudo || ""));
const gibsMatch = l => (ex.f.uso === "all" || l.uso === ex.f.uso) && (ex.f.util === "all" || l.utilidad === ex.f.util) && (ex.f.vivo === "all" || (ex.f.vivo === "live") === l.vivo) && (ex.f.vis === "all" || (ex.f.vis === "bad" ? ["empty", "none"].includes(visOf(l)) : visOf(l) === ex.f.vis));
function chipRow(label, key, opts) { return `<div class="frow"><span class="small mut">${esc(label)}</span><div class="chips">${opts.map(([v, t, n]) => `<button class="${ex.f[key] === v ? "on" : ""}" data-f="${key}" data-v="${v}">${esc(t)}${n == null ? "" : ` ${n}`}</button>`).join("")}</div></div>`; }
function gibsBadges(l) {
  const vs = visOf(l), vt = { ok: "v_ok", empty: "v_empty", none: "v_none", unk: "v_unk" }[vs];
  return `<span class="bd ${l.utilidad}">${esc(y("ut_" + l.utilidad))}</span><span class="bd ${l.vivo ? "live" : "hist"}">${esc(l.vivo ? y("live") : y("hist") + (l.hasta ? " " + l.hasta.slice(0, 4) : ""))}</span><span class="bd">${esc(y("f_" + (l.frecuencia || "none")))}</span><span class="bd">${esc(l.paleta ? y("values") : y("image"))}</span><span class="bd vis-${vs}">${esc(y(vt))}</span>`;
}
function gibsDetail(l) {
  const dt = (k, v) => (v ? `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>` : "");
  return `<details class="gd"><summary>${esc(y("detail"))}</summary><p class="small">${esc(y("w_" + l.uso))}</p><dl>${dt(y("platform"), l.subtitulo)}${dt(y("raw"), l.crudo ? `${l.crudo} · ${l.crudo_titulo || ""} · ${l.daac || ""}` : "")}${dt(y("period2"), l.desde ? `${l.desde} → ${l.hasta || y("today")}` : l.periodo)}${dt(y("family"), `${l.familia_n} ${y("fam_n")}`)}</dl>${l.familia_n > 1 ? `<button data-fam="${esc(l.familia)}">${esc(y("see_fam"))}</button>` : ""}<p class="small mut">${esc(y("ai"))}</p></details>`;
}
function listGibs() {
  const base = gibsBase(), cnt = (k, v) => base.filter(l => l[k] === v).length, rows = base.filter(gibsMatch);
  const hidden = ex.cat.gibs.length - ex.cat.gibs.filter(l => l.representante).length;
  const head = `${ex.f.fam ? `<button data-fam="">${esc(y("clear_fam"))}</button>` : `<label class="small"><input type="checkbox" id="fdedup" ${ex.f.dedup ? "checked" : ""}> ${esc(y("dedup"))}${ex.f.dedup ? `<br><span class="mut">${hidden} ${esc(y("dedup_note"))}</span>` : ""}</label>`}
    ${chipRow(y("f_util"), "util", [["all", y("all"), base.length], ...["alta", "media", "baja"].map(v => [v, y("ut_" + v), cnt("utilidad", v)])])}
    ${chipRow(y("f_state"), "vivo", [["all", y("all"), null], ["live", y("live"), base.filter(l => l.vivo).length], ["hist", y("hist"), base.filter(l => !l.vivo).length]])}
    ${chipRow(y("f_vis"), "vis", [["all", y("all"), null], ["ok", y("v_ok"), base.filter(l => visOf(l) === "ok").length], ["bad", y("bad"), base.filter(l => ["empty", "none"].includes(visOf(l))).length], ["unk", y("unk"), base.filter(l => visOf(l) === "unk").length]])}
    <button id="probeall">${esc(y("probe"))}</button> <span class="small mut" id="probe_state"></span>
    ${chipRow(y("f_topic"), "uso", [["all", y("all"), null], ...USOS.filter(u => cnt("uso", u)).map(u => [u, y("u_" + u), cnt("uso", u)])])}
    <p class="small"><b>${esc(y("showing"))} ${rows.length}</b> / ${ex.cat.gibs.length}</p>`;
  return head + rows.slice(0, ex.limit.gibs).map(l => `<div class="lrow gl"><input type="checkbox" id="g_${esc(l.id)}" data-kind="gibs" data-id="${esc(l.id)}" ${ex.act.has("gibs:" + l.id) ? "checked" : ""}><span><label for="g_${esc(l.id)}"><b>${esc(l.titulo_largo || l.titulo)}</b></label><div class="badges">${gibsBadges(l)}</div><small>${esc(l.id)}</small>${gibsDetail(l)}</span></div>`).join("") + more("gibs", rows.length, ex.limit.gibs);
}
// Mosaico de prueba en el centro del mapa: "ok" tiene imagen, "empty" es transparente, "none" no existe para esa fecha.
async function probeTile(l) {
  const p = ex.map.getCenter(), z = Math.min(4, l.nivel), n = 2 ** z, d = gibsDate(l);
  const xx = Math.floor(((p.lng + 180) / 360) * n), yy = Math.floor(((1 - Math.log(Math.tan((p.lat * Math.PI) / 180) + 1 / Math.cos((p.lat * Math.PI) / 180)) / Math.PI) / 2) * n);
  try {
    const r = await fetch(`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${l.id}/default/${d ? d + "/" : ""}${l.matriz}/${z}/${yy}/${xx}.${l.ext}`);
    if (!r.ok) return "none";
    const bm = await createImageBitmap(await r.blob()), c = new OffscreenCanvas(bm.width, bm.height).getContext("2d"); c.drawImage(bm, 0, 0);
    const px = c.getImageData(0, 0, bm.width, bm.height).data; let k = 0; for (let i = 3; i < px.length; i += 200) if (px[i] > 0) k++;
    return k < 4 ? "empty" : "ok";
  } catch (e) { return "unk"; }
}
async function probeGibs(rec) { const s = await probeTile(rec.meta); ex.vis.set(rec.meta.id, s); rec.warn = s === "none" ? x("no_date") : s === "empty" ? x("empty") : ""; renderActive(); }
async function probeAll() {
  if (ex.probing) return; const v = ex.f.vis; ex.f.vis = "all"; const list = gibsBase().filter(gibsMatch); ex.f.vis = v; let done = 0; ex.probing = true; ex.vis.clear();
  const worker = async () => { while (list.length) { const l = list.pop(); ex.vis.set(l.id, await probeTile(l)); done++; const el = $("#probe_state"); if (el) el.textContent = `${y("probing")} ${done}…`; } };
  await Promise.all(Array.from({ length: 12 }, worker)); ex.probing = false; exDraw();
}
function listLf() {
  const rows = ex.cat.landfire.map(l => ({ l, i: lfInfo(l) })).filter(({ l, i }) => hit(i.title, l.id)).sort((a, b) => b.i.year - a.i.year || a.i.title.localeCompare(b.i.title));
  return rows.slice(0, ex.limit.lf).map(({ l, i }) => `<label class="lrow"><input type="checkbox" data-kind="lf" data-id="${esc(l.id)}" ${ex.act.has("lf:" + l.id) ? "checked" : ""}><span>${esc(i.title)}<small>${esc(l.id)}</small></span></label>`).join("") + more("lf", rows.length, ex.limit.lf);
}
function listPc() {
  const rows = ex.cat.planetary.filter(c => hit(c.titulo, c.id, c.desc, (c.palabras || []).join(" ")));
  return `<p class="small mut">${esc(x("show"))}</p>` + rows.slice(0, ex.limit.pc).map(c => `<label class="lrow"><input type="checkbox" data-kind="pc" data-id="${esc(c.id)}" ${ex.act.has("pc:" + c.id) ? "checked" : ""}><span>${esc(c.titulo)}<small>${esc(c.id)} · ${esc(c.desde)} → ${esc(c.hasta || "…")}</small><small>${esc(c.desc.slice(0, 150))}</small><small class="st"></small></span></label>`).join("") + more("pc", rows.length, ex.limit.pc);
}
function listUsgs() {
  return `<label class="lrow"><input type="checkbox" id="usgs_on" ${ex.usgsOn ? "checked" : ""}><span>${esc(x("stations"))}<small id="usgs_state"></small></span></label>` +
    ex.cat.usgs.map(c => `<div class="lrow"><span>${esc(c.titulo)}<small>${esc(c.id)}</small></span></div>`).join("");
}
function listPoints() {
  return `<p class="small mut">${esc(x("ptnote"))}</p>` + POINTS.map(([n, d]) => `<div class="lrow"><span><b>${esc(n)}</b>${n === "NASA CMR" && typeof ex.cat.cmr_total === "number" ? ` <span class="chip">${ex.cat.cmr_total.toLocaleString(lang)} ${esc(x("n_cmr"))}</span>` : ""}<small>${esc(d[lang] || d.en)}</small></span></div>`).join("");
}
function listPower() {
  const rows = ex.cat.power.filter(p => hit(p.titulo, p.id, p.tipo));
  return rows.slice(0, ex.limit.power).map(p => `<div class="lrow"><span>${esc(p.titulo)}<small>${esc(p.id)} · ${esc(p.tipo)} · ${esc(x("unit"))}: ${esc(p.unidad)}</small></span></div>`).join("") + more("power", rows.length, ex.limit.power);
}
function listMars() {
  const rows = ex.cat.mars.filter(r => hit(r.titulo, (r.tipos || []).join(" ")));
  return rows.slice(0, ex.limit.mars).map(r => `<div class="lrow"><span>${esc(r.titulo)}<small>#${esc(r.id)} · ${esc((r.tipos || []).join(", "))}</small></span></div>`).join("") + more("mars", rows.length, ex.limit.mars);
}
const ok = v => Array.isArray(v);
function section(id, title, n, nl, body, open) {
  return `<details data-sec="${id}" ${open ? "open" : ""}><summary><b>${esc(title)}</b> <span class="chip">${n == null ? "—" : n.toLocaleString(lang) + " " + esc(nl)}</span></summary>${n == null ? `<p class="small mut">${esc(x("err"))}</p>` : `<div class="secbody">${body()}</div>`}</details>`;
}
function exDraw() {
  if (!ex.cat) return;
  const c = ex.cat, open = new Set([...document.querySelectorAll("#exlists details[open]")].map(d => d.dataset.sec)), isOpen = id => open.has(id) || (!open.size && id === "gibs");
  $("#exlists").innerHTML =
    section("gibs", x("s_gibs"), ok(c.gibs) ? c.gibs.length : null, x("n_gibs"), listGibs, isOpen("gibs")) +
    section("lf", x("s_lf"), ok(c.landfire) ? c.landfire.length : null, x("n_lf"), listLf, isOpen("lf")) +
    section("pc", x("s_pc"), ok(c.planetary) ? c.planetary.length : null, x("n_pc"), listPc, isOpen("pc")) +
    section("usgs", x("s_usgs"), ok(c.usgs) ? c.usgs.length : null, x("n_usgs"), listUsgs, isOpen("usgs")) +
    section("power", x("s_power"), ok(c.power) ? c.power.length : null, x("n_power"), listPower, isOpen("power")) +
    section("mars", x("s_mars"), ok(c.mars) ? c.mars.length : null, x("n_mars"), listMars, isOpen("mars")) +
    section("pt", x("s_pt"), POINTS.length, x("n_src"), listPoints, isOpen("pt"));
  renderActive(); usgsRefresh();
}
function exStatic() {
  $("#extitle").textContent = x("title"); $("#exsub").textContent = x("sub"); $("#exguide").textContent = x("guide"); $("#exq").placeholder = x("q"); $("#exdate_l").textContent = x("date"); $("#exdate_h").textContent = x("date_hint"); $("#exactive_h").textContent = x("active");
  $("#nav").innerHTML = [["terreno", "nav_terreno"], ["catalogo", "nav_catalog"], ["recoleccion", "nav_recol"]].map(([v, k]) => `<button data-view="${v}" class="${document.body.dataset.view === v ? "on" : ""}">${esc(x(k))}</button>`).join("");
}
function showView(v) { document.body.dataset.view = v; exStatic(); }
async function exInit() {
  exMap(); exStatic();
  $("#exlists").innerHTML = `<p class="mut">…</p>`;
  try { ex.cat = await (await fetch("/api/v1/catalogo")).json(); exDraw(); } catch (e) { $("#exlists").textContent = "Error: " + e.message; }
}
window.exRender = () => { exStatic(); exDraw(); };
window.showView = showView;

document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.view) showView(b.dataset.view);
  else if (b.dataset.f) { ex.f[b.dataset.f] = b.dataset.v; ex.limit.gibs = 60; exDraw(); }
  else if (b.dataset.fam !== undefined) { ex.f.fam = b.dataset.fam || null; ex.limit.gibs = 60; exDraw(); }
  else if (b.id === "probeall") probeAll();
  else if (b.dataset.more) { ex.limit[b.dataset.more] += 120; exDraw(); }
  else if (b.dataset.rm) { const [k, ...r] = b.dataset.rm.split(":"); toggle(k, r.join(":"), false); exDraw(); }
  else if (b.dataset.sim) { const [la, lo] = b.dataset.sim.split(",").map(Number); ex.map.closePopup(); setLoc(la, lo, true, ""); }
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.kind === "usgs") { ex.usgsOn = el.checked; usgsRefresh(); }
  else if (el.dataset.kind) toggle(el.dataset.kind, el.dataset.id, el.checked, el);
  else if (el.id === "fdedup") { ex.f.dedup = el.checked; ex.limit.gibs = 60; exDraw(); }
  else if (el.id === "usgs_on") { ex.usgsOn = el.checked; usgsRefresh(); }
  else if (el.id === "exdate") [...ex.act.entries()].forEach(([k, a]) => { if (k.startsWith("gibs:") && a.meta?.tiempo) { ex.map.removeLayer(a.layer); a.layer = makeGibs(a.meta).addTo(ex.map); a.note = gibsDate(a.meta); renderActive(); probeGibs(a); } });
});
document.addEventListener("input", e => {
  if (e.target.id === "exq") { ex.q = e.target.value.trim().toLowerCase(); Object.keys(ex.limit).forEach(k => (ex.limit[k] = k === "pc" ? 40 : 60)); exDraw(); const f = $("#exq"); f.focus(); }
  else if (e.target.dataset.op) { const a = ex.act.get(e.target.dataset.op); a && (a.layer.setOpacity ? a.layer.setOpacity(e.target.value / 100) : 0); }
});
exInit();
