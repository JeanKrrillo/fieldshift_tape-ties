// =============================================================================
// Field Shift v2 (Cápsula D) — Diccionario Trilingüe (ES, EN, PT), Capas Útiles,
// Estrategias Agronómicas, Casos de Ejemplo y Glosario
// =============================================================================

(function () {
  "use strict";

  window.esc = function (s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  };

  window.MONTHS_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  // Estrategias agronómicas del equipo (reglas agronómicas, no mediciones)
  window.STRAT_V2 = {
    A: {
      tag: "income", key: "sA", legume: 1, cover: 1, fam: 2, notill: 0,
      seq: {
        es: "Maíz / soya → centeno de cobertura invernal → leguminosa de grano",
        en: "Maize / soy → winter rye cover → grain legume",
        pt: "Milho / soja → centeio de cobertura de inverno → leguminosa de grão"
      },
      gain: {
        es: "Mayor valor comercial por hectárea",
        en: "Highest commercial value per hectare",
        pt: "Maior valor comercial por hectare"
      },
      cost: {
        es: "Mayor demanda de agua y fertilizante",
        en: "Highest water and fertilizer demand",
        pt: "Maior demanda de água e fertilizante"
      }
    },
    B: {
      tag: "water", key: "sB", legume: 1, cover: 0, fam: 2, notill: 0,
      seq: {
        es: "Sorgo tolerante a sequía → garbanzo / lenteja → barbecho con rastrojo",
        en: "Drought-tolerant sorghum → chickpea / lentil → fallow with stubble",
        pt: "Sorgo tolerante à seca → grão-de-bico / lentilha → pousio com palhada"
      },
      gain: {
        es: "Menor demanda de agua del cultivo",
        en: "Lower crop water demand",
        pt: "Menor demanda de água da cultura"
      },
      cost: {
        es: "Menor valor por hectárea; garbanzo y lenteja necesitan mercado local",
        en: "Lower value per hectare; chickpea and lentil need a local market",
        pt: "Menor valor por hectare; grão-de-bico e lentilha precisam de mercado local"
      }
    },
    C: {
      tag: "soil", key: "sC", legume: 1, cover: 1, fam: 2, notill: 1,
      seq: {
        es: "Trébol encarnado + avena → soya en siembra directa → alfalfa perenne",
        en: "Crimson clover + oat → no-till soy → perennial alfalfa",
        pt: "Trevo-encarnado + aveia → soja em plantio direto → alfafa perene"
      },
      gain: {
        es: "Cobertura del suelo y nitrógeno biológico de leguminosas",
        en: "Ground cover and biological nitrogen from legumes",
        pt: "Cobertura do solo e nitrogênio biológico de leguminosas"
      },
      cost: {
        es: "Requiere siembra directa y terminar la cobertura en primavera",
        en: "Needs no-till equipment and spring termination of the cover crop",
        pt: "Exige plantio direto e término da cobertura na primavera"
      }
    }
  };

  window.BASE_V2 = {
    maize: { legume: 0, cover: 0, fam: 1 },
    soy: { legume: 1, cover: 0, fam: 1 },
    wheat: { legume: 0, cover: 0, fam: 1 },
    veg: { legume: null, cover: null, fam: null }
  };

  // Las 14 capas útiles en 4 grupos (Plantas, Agua, Riesgo, Contexto)
  window.USEFUL_V2 = [
    { kind: "gibs", id: "MODIS_Terra_NDVI_8Day", g: "veg", t: {
      es: { n: "Verdor de las plantas", tech: "MODIS Terra NDVI 8-Day (250 m)", q: "Mide qué tan verde y activa está la vegetación.", i: "Te dice si el cultivo ya cubrió el suelo o si hay lotes sufriendo.", r: "Cada cuadro mide 250 m (6 ha); se actualiza cada 8 días." },
      en: { n: "Plant greenness", tech: "MODIS Terra NDVI 8-Day (250 m)", q: "Measures how green and active vegetation is.", i: "Tells whether the crop covers the soil or is stressed.", r: "Each square is 250 m (6 ha); updated every 8 days." },
      pt: { n: "Verdor das plantas", tech: "MODIS Terra NDVI 8-Day (250 m)", q: "Mede quão verde e ativa está a vegetação.", i: "Diz se a cultura cobriu o solo ou se há talhões sofrendo.", r: "Cada quadro tem 250 m (6 ha); atualiza a cada 8 dias." }
    }},
    { kind: "gibs", id: "MODIS_Combined_L4_LAI_8Day", g: "veg", t: {
      es: { n: "Cantidad de hojas", tech: "MODIS Combined LAI 8-Day (500 m)", q: "Cuántas capas de hojas cubren cada metro de suelo.", i: "Más hojas piden más agua; separa un cultivo joven de uno maduro.", r: "500 m por cuadro; cada 8 días." },
      en: { n: "Leaf amount", tech: "MODIS Combined LAI 8-Day (500 m)", q: "How many leaf layers cover each square meter of soil.", i: "More leaves ask for more water; tells young from mature crops.", r: "500 m per square; every 8 days." },
      pt: { n: "Quantidade de folhas", tech: "MODIS Combined LAI 8-Day (500 m)", q: "Quantas camadas de folhas cobrem cada metro de solo.", i: "Mais folhas pedem mais água; separa cultura jovem de madura.", r: "500 m por quadro; a cada 8 dias." }
    }},
    { kind: "pc", id: "sentinel-2-l2a", g: "veg", t: {
      es: { n: "Foto detallada de lote (10 m)", tech: "Copernicus Sentinel-2 L2A (10 m)", q: "Fotografía de satélite detallada de los últimos días sin nubes.", i: "Permite ver surcos y zonas peladas; de aquí sale el verdor por cuadro.", r: "10 m por punto; solo sin nubes; cada 5 días." },
      en: { n: "Detailed field photo (10 m)", tech: "Copernicus Sentinel-2 L2A (10 m)", q: "Detailed satellite photo from recent cloud-free days.", i: "Shows rows and bare spots; cell greenness comes from this photo.", r: "10 m per pixel; cloud-free only; every 5 days." },
      pt: { n: "Foto detalhada do talhão (10 m)", tech: "Copernicus Sentinel-2 L2A (10 m)", q: "Fotografia detalhada de satélite dos últimos dias sem nuvens.", i: "Mostra sulcos e áreas expostas; daqui sai o verdor por quadro.", r: "10 m por ponto; só sem nuvens; a cada 5 dias." }
    }},
    { kind: "gibs", id: "SMAP_L4_Analyzed_Root_Zone_Soil_Moisture", g: "water", t: {
      es: { n: "Humedad en la raíz", tech: "NASA SMAP L4 Root Zone (9 km)", q: "Qué tan mojado está el suelo hasta 1 metro de profundidad.", i: "Dice si hay agua para las raíces aunque la superficie se vea seca.", r: "9 km por cuadro: tendencia de la zona, no de un surco." },
      en: { n: "Root-zone moisture", tech: "NASA SMAP L4 Root Zone (9 km)", q: "How wet the soil is down to 1 meter deep.", i: "Tells whether roots have water even if the surface looks dry.", r: "9 km per square: area trend, not single-row detail." },
      pt: { n: "Umidade na raiz", tech: "NASA SMAP L4 Root Zone (9 km)", q: "Quão molhado está o solo até 1 metro de profundidade.", i: "Diz se há água para as raízes mesmo com superfície seca.", r: "9 km por quadro: tendência da região, não do sulco." }
    }},
    { kind: "gibs", id: "SMAP_L4_Analyzed_Surface_Soil_Moisture", g: "water", t: {
      es: { n: "Humedad de la superficie", tech: "NASA SMAP L4 Surface (9 km)", q: "Qué tan mojados están los primeros 5 centímetros del suelo.", i: "Indica si la semilla puede germinar hoy o si el suelo está seco.", r: "9 km por cuadro; cambia rápido con sol y viento." },
      en: { n: "Surface moisture", tech: "NASA SMAP L4 Surface (9 km)", q: "How wet the top 5 centimeters of soil are.", i: "Tells whether seeds can germinate today or if topsoil is dry.", r: "9 km per square; changes fast with sun and wind." },
      pt: { n: "Umidade da superfície", tech: "NASA SMAP L4 Surface (9 km)", q: "Quão molhados estão os primeiros 5 centímetros do solo.", i: "Indica se a semente pode germinar hoje ou se o solo secou.", r: "9 km por quadro; muda rápido com sol e vento." }
    }},
    { kind: "gibs", id: "IMERG_Precipitation_Rate", g: "water", t: {
      es: { n: "Lluvia reciente", tech: "NASA GPM IMERG Rate (10 km)", q: "Lluvia medida por satélite en milímetros por hora.", i: "Ayuda a decidir si entrar con maquinaria, sembrar o regar.", r: "10 km por cuadro; cada 30 minutos." },
      en: { n: "Recent rain", tech: "NASA GPM IMERG Rate (10 km)", q: "Satellite rain rate in millimeters per hour.", i: "Helps decide whether to enter with machinery, sow, or irrigate.", r: "10 km per square; updated every 30 minutes." },
      pt: { n: "Chuva recente", tech: "NASA GPM IMERG Rate (10 km)", q: "Chuva medida por satélite em milímetros por hora.", i: "Ajuda a decidir se convém entrar com máquinas, semear ou irrigar.", r: "10 km por quadro; a cada 30 minutos." }
    }},
    { kind: "usgs", id: "stations", g: "water", t: {
      es: { n: "Ríos y pozos cercanos", tech: "USGS NWIS Water Stations", q: "Sensores reales de caudal y nivel de agua en tierra.", i: "Indica cuánta agua hay cerca para riego o riesgo de crecida.", r: "Solo EE. UU.; acerca el mapa (zoom >= 9) para verlos." },
      en: { n: "Nearby rivers and wells", tech: "USGS NWIS Water Stations", q: "Real ground sensors measuring river flow and well levels.", i: "Shows nearby water supply for irrigation or flood risk.", r: "US only; zoom in (zoom >= 9) to see stations." },
      pt: { n: "Rios e poços próximos", tech: "USGS NWIS Water Stations", q: "Sensores reais de vazão e nível de água em terra.", i: "Indica quanta água há perto para irrigação ou risco de cheia.", r: "Só EUA; aproxime o mapa (zoom >= 9) para vê-los." }
    }},
    { kind: "gibs", id: "MODIS_Terra_Land_Surface_Temp_Day", g: "risk", t: {
      es: { n: "Temperatura del suelo de día", tech: "MODIS Terra LST Day (1 km)", q: "Qué tan caliente está la superficie del suelo y del cultivo.", i: "Un cultivo más caliente de lo normal suele tener falta de agua.", r: "1 km por cuadro; solo donde no hay nubes." },
      en: { n: "Daytime ground temperature", tech: "MODIS Terra LST Day (1 km)", q: "How hot the soil and crop canopy surface are.", i: "A crop hotter than normal is often short of water.", r: "1 km per square; cloud-free areas only." },
      pt: { n: "Temperatura do solo de dia", tech: "MODIS Terra LST Day (1 km)", q: "Quão quente está a superfície do solo e da cultura.", i: "Uma cultura mais quente que o normal costuma ter falta de água.", r: "1 km por quadro; só onde não há nuvens." }
    }},
    { kind: "gibs", id: "MODIS_Combined_Flood_1-Day", g: "risk", t: {
      es: { n: "Agua estancada o inundación", tech: "MODIS Combined Flood 1-Day (250 m)", q: "Zonas cubiertas de agua en superficie en el último día.", i: "Alerta de encharcamientos que pudren raíces o frenan el tractor.", r: "250 m por cuadro; las nubes la tapan." },
      en: { n: "Standing water or flood", tech: "MODIS Combined Flood 1-Day (250 m)", q: "Surface water detected by satellite in the last day.", i: "Warns of waterlogging that rots roots or blocks tractors.", r: "250 m per square; hidden by clouds." },
      pt: { n: "Água parada ou inundação", tech: "MODIS Combined Flood 1-Day (250 m)", q: "Áreas cobertas por água na superfície no último dia.", i: "Avisa de alagamentos que apodrecem raízes ou travam máquinas.", r: "250 m por quadro; nuvens escondem." }
    }},
    { kind: "gibs", id: "MODIS_Aqua_Thermal_Anomalies_Day", g: "risk", t: {
      es: { n: "Incendios activos", tech: "MODIS Aqua Thermal Anomalies (1 km)", q: "Puntos de calor intenso detectados desde el espacio.", i: "Alerta de fuego cercano y humo que reduce la luz solar.", r: "1 km por punto; varias veces al día." },
      en: { n: "Active fires", tech: "MODIS Aqua Thermal Anomalies (1 km)", q: "Intense heat spots detected from space.", i: "Warns of nearby fire risk and smoke cutting sunlight.", r: "1 km per point; several times per day." },
      pt: { n: "Incêndios ativos", tech: "MODIS Aqua Thermal Anomalies (1 km)", q: "Pontos de calor intenso detectados do espaço.", i: "Alerta de fogo próximo e fumaça que reduz a luz solar.", r: "1 km por ponto; várias vezes ao dia." }
    }},
    { kind: "gibs", id: "MODIS_Terra_L3_NDSI_Snow_Cover_Daily", g: "risk", t: {
      es: { n: "Cobertura de nieve", tech: "MODIS Terra Snow Cover (500 m)", q: "Dónde hay nieve acumulada sobre el terreno.", i: "Anticipa el agua de deshielo en primavera y el frío en el suelo.", r: "500 m por cuadro; las nubes la tapan." },
      en: { n: "Snow cover", tech: "MODIS Terra Snow Cover (500 m)", q: "Where snow covers the ground today.", i: "Predicts spring snowmelt water supply and cold soil.", r: "500 m per square; hidden by clouds." },
      pt: { n: "Cobertura de neve", tech: "MODIS Terra Snow Cover (500 m)", q: "Onde há neve acumulada sobre o solo.", i: "Antecipa a água de degelo na primavera e o frio no solo.", r: "500 m por quadro; nuvens escondem." }
    }},
    { kind: "gibs", id: "VIIRS_SNPP_CorrectedReflectance_TrueColor", g: "ctx", t: {
      es: { n: "Foto satelital del día", tech: "VIIRS SNPP True Color (375 m)", q: "Cómo se ve hoy la región desde el espacio a color natural.", i: "Muestra nubes, tormentas y manchas grandes verdes o secas.", r: "375 m por cuadro; sirve de contexto, no para medir." },
      en: { n: "Today's satellite photo", tech: "VIIRS SNPP True Color (375 m)", q: "How the region looks today from space in natural color.", i: "Shows clouds, storms, and broad green or dry patches.", r: "375 m per square; context only, not a measurement." },
      pt: { n: "Foto de satélite do dia", tech: "VIIRS SNPP True Color (375 m)", q: "Como a região aparece hoje do espaço em cor natural.", i: "Mostra nuvens, tempestades e grandes manchas verdes ou secas.", r: "375 m por quadro; serve de contexto, não para medir." }
    }},
    { kind: "pc", id: "usda-cdl", g: "ctx", t: {
      es: { n: "Cultivo sembrado por año", tech: "USDA NASS CDL (30 m)", q: "Qué cultivo creció en cada campo según el mapa anual del USDA.", i: "Muestra el historial de rotación de tu parcela y tus vecinos.", r: "30 m; solo EE. UU.; llega hasta 2021 en esta colección." },
      en: { n: "Crop planted each year", tech: "USDA NASS CDL (30 m)", q: "Which crop grew in each field according to the USDA annual map.", i: "Shows the rotation history of your parcel and neighbors.", r: "30 m; US only; reaches 2021 in this collection." },
      pt: { n: "Cultura plantada por ano", tech: "USDA NASS CDL (30 m)", q: "Qual cultura cresceu em cada campo segundo o mapa anual do USDA.", i: "Mostra o histórico de rotação da sua parcela e dos vizinhos.", r: "30 m; só EUA; vai até 2021 nesta coleção." }
    }},
    { kind: "lf", id: "LF2025_EVT_CONUS", g: "ctx", t: {
      es: { n: "Tipo de vegetación", tech: "USFS/USGS LANDFIRE EVT 2025 (30 m)", q: "Separa tierras de cultivo, pastizal, bosque y zona construida.", i: "Confirma qué rodea a tu terreno (bosques, pastos, barreras).", r: "30 m; solo EE. UU.; versión 2025." },
      en: { n: "Vegetation type", tech: "USFS/USGS LANDFIRE EVT 2025 (30 m)", q: "Separates cropland, grassland, forest, and built-up land.", i: "Confirms what surrounds your field (woods, pastures, windbreaks).", r: "30 m; US only; 2025 edition." },
      pt: { n: "Tipo de vegetação", tech: "USFS/USGS LANDFIRE EVT 2025 (30 m)", q: "Separa lavoura, pastagem, floresta e área construída.", i: "Confirma o que cerca seu terreno (matas, pastos, barreiras).", r: "30 m; só EUA; edição 2025." }
    }},
    { kind: "plss", id: "plss", g: "ctx", t: {
      es: { n: "Cuadrícula oficial de terrenos (PLSS)", tech: "BLM CadNSDI PLSS (259 ha / sección)", q: "Líneas oficiales de municipios y secciones de 1 milla cuadrada.", i: "Permite tomar una sección oficial completa con un clic en el mapa.", r: "Fuente: BLM. Cubre unos 30 estados (Medio Oeste y Oeste)." },
      en: { n: "Official land survey grid (PLSS)", tech: "BLM CadNSDI PLSS (259 ha / section)", q: "Official federal lines of townships and 1-sq-mile sections.", i: "Lets you adopt a full official section with one click on the map.", r: "Source: BLM. Covers ~30 states (Midwest and West)." },
      pt: { n: "Grade oficial de terras (PLSS)", tech: "BLM CadNSDI PLSS (259 ha / seção)", q: "Linhas oficiais de municípios e seções de 1 milha quadrada.", i: "Permite adotar uma seção oficial inteira com um clique no mapa.", r: "Fonte: BLM. Cobre cerca de 30 estados (Meio-Oeste e Oeste)." }
    }}
  ];

  // Resoluciones espaciales por fuente
  window.RES_V2 = [
    ["NASA POWER", "≈ 50 km", { es: "Lluvia, temperatura y humedad histórica", en: "Historical rain, temperature, and moisture", pt: "Chuva, temperatura e umidade histórica" }],
    ["SMAP (NASA CMR)", "9 km", { es: "Humedad en la raíz y en la superficie", en: "Root-zone and surface soil moisture", pt: "Umidade na raiz e na superfície" }],
    ["Meteomatics", "1 km", { es: "Pronóstico a 7 días y mínima de 24 h", en: "7-day forecast and 24 h minimum temp", pt: "Previsão de 7 dias e mínima de 24 h" }],
    ["ECOSTRESS (CMR)", "70 m", { es: "Pasadas de estrés térmico", en: "Heat-stress satellite passes", pt: "Passagens de estresse térmico" }],
    ["GEDI (CMR)", "25 m", { es: "Altura de dosel y estructura", en: "Canopy height and structure", pt: "Altura do dossel e estrutura" }],
    ["Sentinel-2 L2A", "10 m", { es: "Verdor por cuadro y nubes", en: "Cell greenness and clouds", pt: "Verdor por quadro e nuvens" }],
    ["Landsat 8/9, HLS", "30 m", { es: "Verdor e historial óptico", en: "Greenness and optical history", pt: "Verdor e histórico óptico" }],
    ["OpenET", "30 m", { es: "Consumo de agua del cultivo", en: "Crop water consumption", pt: "Consumo de água da cultura" }],
    ["LANDFIRE", "30 m", { es: "Clase de vegetación 2025", en: "2025 vegetation class", pt: "Classe de vegetação 2025" }],
    ["USDA SSURGO", "Polígonos", { es: "Perfil del suelo por profundidad", en: "Soil profile by depth", pt: "Perfil do solo por profundidade" }],
    ["USGS NWIS", "Puntos", { es: "Sensores de agua en ríos y pozos", en: "River and well water sensors", pt: "Sensores de água em rios e poços" }]
  ];

  // Glosario completo en 3 idiomas (ES, EN, PT)
  window.GLOSSARY_V2 = [
    ["Verdor (NDVI)", {
      es: "Mide de 0 a 1 qué tan verde y densa está la planta usando la luz que refleja. Menos de 0.30 suele ser suelo pelado o rastrojo seco.",
      en: "Measures from 0 to 1 how green and dense plants are using reflected light. Below 0.30 is usually bare soil or dry stubble.",
      pt: "Mede de 0 a 1 quão verde e densa está a planta pela luz refletida. Abaixo de 0.30 costuma ser solo nu ou palhada seca."
    }],
    ["Humedad en la raíz (SMAP)", {
      es: "Estimación satelital de NASA de cuánta agua hay hasta 1 metro de profundidad, donde beben las raíces.",
      en: "NASA satellite estimate of soil moisture down to 1 meter deep, where crop roots drink.",
      pt: "Estimativa por satélite da NASA de quanta água há até 1 metro de profundidade, onde as raízes absorvem."
    }],
    ["Consumo de agua (OpenET)", {
      es: "Agua total en milímetros que se evapora del suelo y transpiran las hojas del cultivo (a 30 m en EE. UU. continental).",
      en: "Total water in millimeters evaporated from soil and transpired by crop leaves (at 30 m across the continental US).",
      pt: "Água total em milímetros evaporada do solo e transpirada pelas folhas da cultura (a 30 m nos EUA continentais)."
    }],
    ["NASA POWER", {
      es: "Archivo climático mundial de la NASA desde 1981 con lluvia, temperatura, radiación solar y viento.",
      en: "NASA global climate archive since 1981 providing rain, temperature, solar radiation, and wind.",
      pt: "Arquivo climático mundial da NASA desde 1981 com chuva, temperatura, radiação solar e vento."
    }],
    ["Sentinel-2 L2A", {
      es: "Satélite europeo que fotografía el campo cada 5 días con detalle de 10 metros por punto.",
      en: "European satellite imaging fields every 5 days at 10-meter resolution.",
      pt: "Satélite europeu que fotografa o campo a cada 5 dias com detalhe de 10 metros por ponto."
    }],
    ["USDA SSURGO", {
      es: "Mapa oficial de suelos de EE. UU. con materia orgánica, pH, arcilla y agua disponible por profundidad.",
      en: "Official US soil survey with organic matter, pH, clay, and available water by depth.",
      pt: "Mapa oficial de solos dos EUA com matéria orgânica, pH, argila e água disponível por profundidade."
    }],
    ["USDA AMS MARS", {
      es: "Servicio oficial del USDA que publica precios reales del día para maíz, soya y trigo.",
      en: "Official USDA service publishing daily market prices for corn, soybeans, and wheat.",
      pt: "Serviço oficial do USDA que publica preços reais do dia para milho, soja e trigo."
    }],
    ["USGS NWIS", {
      es: "Red de estaciones automáticas que miden el caudal de los ríos y la profundidad de los pozos en vivo.",
      en: "Network of automated gages measuring live river flow and groundwater well depth.",
      pt: "Rede de estações automáticas que medem a vazão dos rios e a profundidade dos poços ao vivo."
    }],
    ["Sección oficial (BLM PLSS)", {
      es: "Cuadro oficial del catastro federal de EE. UU. de 1 milla por 1 milla (259 hectáreas).",
      en: "Official US federal land survey square measuring 1 mile by 1 mile (259 hectares).",
      pt: "Quadrado oficial do cadastro federal dos EUA de 1 milha por 1 milha (259 hectares)."
    }],
    ["Anomalía (z-score)", {
      es: "Qué tanto se aleja un cuadro del promedio de tu propio terreno. Si pasa de ±1.2 conviene revisarlo a pie.",
      en: "How far a cell deviates from your own field's average. Beyond ±1.2 warrants a field walk.",
      pt: "Quanto um quadro se afasta da média do seu próprio terreno. Acima de ±1.2 vale vistoriar no campo."
    }],
    ["Zonas de manejo", {
      es: "División del terreno en 3 grupos (bajo, medio y alto vigor) para no gastar igual semilla y abono en todo el lote.",
      en: "Splitting the field into 3 groups (low, medium, high vigor) to adjust seed and fertilizer by zone.",
      pt: "Divisão do terreno em 3 grupos (baixo, médio e alto vigor) para ajustar semente e adubo por zona."
    }],
    ["Percentiles p10 / p50 / p90", {
      es: "En 40 años de clima: p10 es un año seco o frío, p50 es lo normal y p90 es un año muy lluvioso o cálido.",
      en: "Across 40 years of climate: p10 is a dry/cool year, p50 is normal, and p90 is a very wet/warm year.",
      pt: "Em 40 anos de clima: p10 é um ano seco ou frio, p50 é o normal e p90 é um ano muito chuvoso ou quente."
    }],
    ["Leguminosa fijadora", {
      es: "Plantas como soya, trébol, garbanzo o alfalfa que toman nitrógeno del aire y fertilizan el suelo de forma natural.",
      en: "Plants like soy, clover, chickpea, or alfalfa that capture nitrogen from the air into the soil.",
      pt: "Plantas como soja, trevo, grão-de-bico ou alfafa que capturam nitrogênio do ar para o solo."
    }],
    ["Cultivo de cobertura", {
      es: "Siembra de invierno (centeno, avena, trébol) que protege el suelo de la erosión y guarda humedad.",
      en: "Winter planting (rye, oat, clover) that shields soil from erosion and holds moisture.",
      pt: "Plantio de inverno (centeio, aveia, trevo) que protege o solo da erosão e guarda umidade."
    }]
  ];

  // Textos de la interfaz en Español, Inglés y Portugués
  window.DICT_V2 = {
    es: {
      // Navegación principal (5 secciones Cápsula E)
      nav_inicio: "Inicio",
      nav_robot: "Robot",
      nav_region: "Clima y suelo",
      nav_recom: "Qué hacer",
      nav_conceptos: "Conceptos",
      nav_mapa: "Inicio",
      nav_decidir: "Recomendaciones",
      nav_datos: "Datos región",
      nav_ajustes: "Ajustes",
      nav_glosario: "Glosario",
      nav_recorrido: "Recorrido",
      nav_cuenta: "Mi Cuenta",
      nav_terrenos: "Mis Terrenos",

      // Pantalla 1: Bienvenida
      w_problem: "Decide qué sembrar y dónde regar leyendo satélites y estaciones oficiales en vivo.",
      w_try: "Probar con un ejemplo",
      w_gps: "Usar mi ubicación",
      w_search: "Buscar un lugar",
      w_examples_lbl: "O elige uno de los 6 lugares de ejemplo:",
      demo_badge: "ejemplo, no real",
      real_badge: "ubicación real",
      sim_badge: "lugar elegido en el mapa",

      // Barra superior y mapa (Pantalla 2)
      search_ph: "Buscar pueblo, rancho o dirección…",
      search_btn: "Buscar",
      btn_layers: "Capas",
      btn_draw: "Dibujar mi terreno",
      btn_my_land: "Mi terreno",
      btn_welcome: "Ayuda",
      sheet_summary: "Resumen del lugar",
      sheet_terrain: "Mi terreno",
      sheet_cell: "Ficha de cuadro",
      sheet_layers: "Capas",
      outside_us_msg: "Este lugar está fuera de EE. UU. Aquí hay clima global (NASA POWER), pronóstico (Meteomatics) y verdor (Sentinel-2), pero suelo (SSURGO), agua del cultivo (OpenET) y precios (USDA) solo cubren EE. UU.",
      outside_us_btn: "Simular ubicación en EE. UU. (Iowa)",

      // Semáforos y estados (Nunca solo color)
      st_ok_word: "Bien",
      st_warn_word: "Atención",
      st_risk_word: "Riesgo",
      st_nodata_word: "Sin dato",
      nodata: "sin dato",

      // Resumen del lugar (Pantalla 2)
      sum_empty_title: "Empieza por tu terreno",
      sum_empty_sub: "Agrégalo una vez y aquí verás su agua, su verdor, el riesgo de helada y su suelo, con datos de la NASA.",
      sem_general_title: "Estado general hoy",
      sem_water_title: "Agua y raíz",
      sem_vigor_title: "Verdor planta",
      sem_frost_title: "Frío (7 días)",
      sem_soil_title: "Reserva suelo",
      m_rain_yr: "Lluvia al año",
      m_rain_yr_desc: "Agua que cae en un año normal en esta zona.",
      m_temp_yr: "Temperatura media",
      m_temp_yr_desc: "Promedio anual de frío y calor.",
      m_soil_w: "Agua que guarda el suelo",
      m_soil_w_desc: "Reserva útil en el primer metro de raíz.",
      m_crop_et: "Agua que usó el cultivo",
      m_crop_et_desc: "Consumo total de la última temporada.",
      m_price_corn: "Precio del maíz hoy",
      m_price_soy: "Precio de la soya hoy",
      m_price_desc: "Reporte mayorista oficial por tonelada.",
      btn_go_decide: "Ver qué conviene sembrar",

      // Pantalla 3: Mi terreno
      ter_title: "Mi terreno",
      ter_none: "Aún no has trazado un terreno. Dibuja los bordes en el mapa o toma un campo con un clic.",
      ter_draw_start: "Dibujar bordes en el mapa",
      ter_draw_hint: "Toca las esquinas de tu lote en el mapa y cierra en el primer punto.",
      ter_plss_btn: "Tomar sección oficial (BLM PLSS)",
      ter_osm_btn: "Buscar campos de OpenStreetMap aquí",
      ter_osm_hint: "Campos encontrados en el mapa. Toca cualquiera para usarlo como tu terreno.",
      ter_clear: "Borrar terreno",
      ter_cells_lbl: "Cuadros",
      ter_area: "Área medida",
      ter_green: "Verdor promedio",
      ter_green_desc: "De 0 (suelo pelado) a 1 (planta muy densa).",
      ter_bare: "Suelo con poca cobertura",
      ter_bare_desc: "Cuadros con verdor menor a 0.30 (regla del equipo).",
      ter_scene: "Foto de satélite",
      ter_clouds: "nubes",
      ter_color_by: "Colorear cuadros por",
      cm_ndvi: "Verdor de la planta",
      cm_sev: "Severidad combinada",
      cm_zones: "Zonas de manejo (baja, media, alta)",
      cm_anom: "Anomalías del lote",
      ter_save: "Guardar",
      ter_import: "Importar GeoJSON / KML",
      ter_export_geo: "GeoJSON",
      ter_export_kml: "KML",
      ter_export_csv: "CSV",
      ter_print: "Imprimir / PDF",
      ter_ai_btn: "¿Qué cultivo hubo aquí? (SI)",

      // Pantalla 4: Ficha de cuadro
      cell_title: "Ficha del cuadro",
      cell_none: "Toca cualquier cuadro de tu terreno en el mapa para ver sus datos y su alerta. Usa Shift + clic para promediar varios.",
      cell_coords: "Centro del cuadro",
      cell_size: "Tamaño y área",
      cell_green: "Verdor medido",
      cell_anom: "Diferencia frente al lote",
      cell_ai: "Cultivo estimado por IA",
      cell_alert: "Qué significa para este cuadro",
      cell_multi: "Cuadros seleccionados",
      cell_clear_sel: "Quitar selección",

      // Pantalla 5: Capas
      lay_title: "Capas del mapa (14 útiles)",
      lay_sub: "Activa una capa para verla sobre el mapa. Toca «Saber más» para ver cómo cambia tu decisión y su límite.",
      lay_search: "Buscar capa…",
      lay_fav_only: "Solo favoritas",
      lay_more: "Saber más",
      lay_impact: "Cómo cambia tu decisión",
      lay_limit: "Límite y resolución",
      lay_g_veg: "Plantas y verdor",
      lay_g_water: "Agua y humedad",
      lay_g_risk: "Riesgo y clima",
      lay_g_ctx: "Contexto e historial",
      lay_time_title: "Máquina del tiempo (12 semanas) y cortina para comparar",
      lay_play: "Reproducir",
      lay_pause: "Pausar",
      lay_opacity: "Opacidad",
      lay_curtain: "Cortina comparadora (izquierda / derecha)",
      lay_open_cat: "Ver el catálogo completo (1330 capas)",

      // Pantalla 6 y 7: Decidir y Tu granja
      dec_title: "Qué sembrar y por qué",
      dec_edit_farm: "Cambiar datos de «Tu granja»",
      farm_title: "Tu granja (4 preguntas)",
      farm_sub: "Cambia cualquier respuesta y mira al instante cómo cambia la recomendación.",
      q_crop: "1. ¿Qué cultivas hoy?",
      q_water: "2. ¿Con qué agua cuentas?",
      q_mach: "3. ¿Qué maquinaria tienes?",
      q_prio: "4. ¿Cuál es tu prioridad principal?",
      c_maize: "Maíz continuo",
      c_soy: "Soya continua",
      c_wheat: "Trigo – barbecho",
      c_veg: "Hortalizas",
      w_rain: "Solo lluvia",
      w_irrig: "Riego disponible",
      w_limited: "Riego limitado",
      m_conv: "Convencional",
      m_notill: "Siembra directa",
      m_forage: "Equipo de forraje / ganadería",
      p_income: "Ingreso neto",
      p_water: "Ahorrar agua",
      p_soil: "Regenerar el suelo",
      p_pests: "Romper ciclos de plagas",
      sA: "Estrategia A · Ingreso comercial",
      sB: "Estrategia B · Ahorro de agua",
      sC: "Estrategia C · Regeneración del suelo",
      baseline: "Tu rotación actual",
      strat_seq: "Secuencia",
      strat_gain: "Lo que ganas",
      strat_cost: "Lo que sacrificas",
      strat_match: "Coincide con tu prioridad",
      strat_rule_note: "Regla agronómica del equipo, no una medición. Esta herramienta asiste; nunca reemplaza al agricultor ni a un agrónomo local.",
      legume_lbl: "Fijación de nitrógeno",
      cover_lbl: "Cobertura de invierno",
      fam_lbl: "Familias botánicas",
      fit_ok: "Encaja con tu maquinaria",
      fit_warn: "Requiere siembra directa",
      rot_comp_title: "Comparador lado a lado de estrategias",
      calc_title: "Calculadora de costos y márgenes (precios reales USDA MARS)",
      calc_sub: "Tú pones tu área, tu costo y el rendimiento esperado; el precio de venta viene de USDA MARS.",
      cal3_title: "Calendario agrícola a 3 años (imprimible)",
      scen_title: "Escenarios de clima: ¿qué pasa si llueve menos o hace más calor?",
      scen_rain: "Cambio de lluvia",
      scen_temp: "Cambio de temperatura",
      alerts_title: "Alertas activas y umbrales editables",

      // Pantalla 8: Clima y agua
      tab_clima: "Clima, agua y suelo",
      tab_ia: "Superinteligencia (SI)",
      tab_fuentes: "Datos, catálogo y fuentes",
      fc_title: "Pronóstico de 7 días y riesgo de helada",
      bal_title: "Balance de agua por mes (lluvia contra consumo del cultivo)",
      bare_cal_title: "Calendario de meses con poca cobertura (< 0.30)",
      clim40_title: "Clima histórico de 40 años (1985–2024)",
      soil_title: "Perfil del suelo por profundidad (USDA SSURGO)",
      sens_title: "Ríos cercanos (USGS), sensores CSV, ruta del robot y nitrógeno/pH",

      // Pantalla 9: SI
      ai_title: "¿Qué cultivo hubo aquí? (Clasificador SI)",
      ai_disclaimer: "Predicción, no medición: confirma siempre en el campo.",
      ai_run_btn: "Ejecutar SI sobre los cuadros de mi terreno",
      ai_acc_lbl: "Acierto medido en puntos de prueba nunca vistos",
      ai_train_lbl: "Dónde y con qué fue entrenado",
      ai_models_title: "Fichas de los modelos",
      ai_imp_title: "Importancia medida de variables (permutación)",
      ai_leaf_title: "Diagnóstico orientativo de foto de hoja (provisional)",
      ai_leaf_disclaimer: "Provisional · Predicción orientativa por color en navegador, no medición de laboratorio.",

      // Pantalla 10: Datos y fuentes
      recol_title: "Estado de la recolección de datos para la SI (se actualiza cada 5 s)",
      src_status_title: "Estado en vivo de las 9 fuentes oficiales",
      gaps_title: "Vacíos de información (lo que no se mide, escrito con honestidad)",
      harm_title: "Resolución espacial de cada fuente",
      cat_title: "Catálogo completo en vivo (GIBS, LANDFIRE, Planetary Computer, USGS, POWER, MARS)",

      // Pantalla 11: Ajustes
      set_title: "Ajustes de pantalla y lectura",
      set_lang: "Idioma",
      set_theme: "Tema de color",
      th_auto: "Automático (sistema)",
      th_light: "Claro (libreta de campo)",
      th_dark: "Oscuro (noche)",
      set_mode: "Modo de lectura (revelación progresiva)",
      mode_farmer: "Familia (lo esencial, palabras sencillas)",
      mode_agr: "Agrónomo (más detalle e índices)",
      mode_sci: "Científico (datos crudos, unidades, fuentes)",
      set_units: "Unidades de medida",
      u_metric: "Métrico (ha, mm, °C, t)",
      u_imperial: "Imperial (ac, in, °F, bu)"
    },

    en: {
      nav_inicio: "Home",
      nav_robot: "Robot",
      nav_region: "Climate & soil",
      nav_recom: "What to do",
      nav_conceptos: "Concepts",
      nav_mapa: "Home",
      nav_decidir: "Recommendations",
      nav_datos: "Regional data",
      nav_ajustes: "Settings",
      nav_glosario: "Glossary",
      nav_recorrido: "Tour",
      nav_cuenta: "My Account",
      nav_terrenos: "My Fields",

      w_problem: "Decide what to plant and when to irrigate using live satellites and official ground stations.",
      w_try: "Try with an example",
      w_gps: "Use my location",
      w_search: "Search a place",
      w_examples_lbl: "Or pick one of the 6 example places:",
      demo_badge: "example, not real",
      real_badge: "real location",
      sim_badge: "place picked on the map",

      search_ph: "Search town, ranch or address…",
      search_btn: "Search",
      btn_layers: "Layers",
      btn_draw: "Draw my land",
      btn_my_land: "My land",
      btn_welcome: "Help",
      sheet_summary: "Place summary",
      sheet_terrain: "My land",
      sheet_cell: "Cell card",
      sheet_layers: "Layers",
      outside_us_msg: "This place is outside the US. Global weather (NASA POWER), 7-day forecast (Meteomatics), and greenness (Sentinel-2) work here, while soil (SSURGO), crop water use (OpenET), and market prices (USDA) cover the US only.",
      outside_us_btn: "Simulate a US location (Iowa)",

      st_ok_word: "Good",
      st_warn_word: "Watch",
      st_risk_word: "Risk",
      st_nodata_word: "No data",
      nodata: "no data",

      sum_empty_title: "Start with your field",
      sum_empty_sub: "Add it once and you will see its water, greenness, frost risk and soil here, with NASA data.",
      sem_general_title: "Overall status today",
      sem_water_title: "Water & root",
      sem_vigor_title: "Plant cover",
      sem_frost_title: "Frost (7 days)",
      sem_soil_title: "Soil reserve",
      m_rain_yr: "Rain per year",
      m_rain_yr_desc: "Typical annual rainfall in this area.",
      m_temp_yr: "Mean temperature",
      m_temp_yr_desc: "Yearly average of cold and heat.",
      m_soil_w: "Water held by the soil",
      m_soil_w_desc: "Plant-available reserve in the top meter.",
      m_crop_et: "Water used by the crop",
      m_crop_et_desc: "Total crop consumption last season.",
      m_price_corn: "Corn price today",
      m_price_soy: "Soybean price today",
      m_price_desc: "Official wholesale report per ton.",
      btn_go_decide: "See what to plant here",

      ter_title: "My land",
      ter_none: "No land boundary yet. Draw the corners on the map or adopt a field with one click.",
      ter_draw_start: "Draw boundary on map",
      ter_draw_hint: "Click the corners of your field on the map and close on the first point.",
      ter_plss_btn: "Take official section (BLM PLSS)",
      ter_osm_btn: "Find OpenStreetMap fields here",
      ter_osm_hint: "Fields loaded on the map. Click any polygon to use it as your land.",
      ter_clear: "Clear land",
      ter_cells_lbl: "Grid cells",
      ter_area: "Measured area",
      ter_green: "Average greenness",
      ter_green_desc: "From 0 (bare soil) to 1 (dense, healthy plants).",
      ter_bare: "Soil with little cover",
      ter_bare_desc: "Cells with greenness below 0.30 (team rule).",
      ter_scene: "Satellite photo",
      ter_clouds: "clouds",
      ter_color_by: "Color cells by",
      cm_ndvi: "Plant greenness",
      cm_sev: "Combined severity",
      cm_zones: "Management zones (low, medium, high)",
      cm_anom: "Field anomalies",
      ter_save: "Save",
      ter_import: "Import GeoJSON / KML",
      ter_export_geo: "GeoJSON",
      ter_export_kml: "KML",
      ter_export_csv: "CSV",
      ter_print: "Print / PDF",
      ter_ai_btn: "What crop was here? (SI)",

      cell_title: "Grid cell card",
      cell_none: "Tap any grid cell of your land on the map to see its data and alert. Hold Shift + click to average multiple cells.",
      cell_coords: "Cell center",
      cell_size: "Size and area",
      cell_green: "Measured greenness",
      cell_anom: "Difference vs field average",
      cell_ai: "AI predicted crop",
      cell_alert: "What it means for this spot",
      cell_multi: "Selected cells",
      cell_clear_sel: "Clear selection",

      lay_title: "Map layers (14 useful layers)",
      lay_sub: "Turn on a layer to see it on the map. Tap “Learn more” to see how it changes your decision and its limit.",
      lay_search: "Search layer…",
      lay_fav_only: "Favorites only",
      lay_more: "Learn more",
      lay_impact: "How it changes your decision",
      lay_limit: "Limit and resolution",
      lay_g_veg: "Plants and greenness",
      lay_g_water: "Water and moisture",
      lay_g_risk: "Risk and weather",
      lay_g_ctx: "Context and history",
      lay_time_title: "Time machine (12 weeks) & comparison curtain",
      lay_play: "Play",
      lay_pause: "Pause",
      lay_opacity: "Opacity",
      lay_curtain: "Split comparison curtain (left / right)",
      lay_open_cat: "Open full catalog (1330 layers)",

      dec_title: "What to plant and why",
      dec_edit_farm: "Edit “Your farm” answers",
      farm_title: "Your farm (4 questions)",
      farm_sub: "Change any answer and watch the recommendation update immediately.",
      q_crop: "1. What do you grow today?",
      q_water: "2. What water supply do you have?",
      q_mach: "3. What machinery do you have?",
      q_prio: "4. What is your top priority?",
      c_maize: "Continuous maize",
      c_soy: "Continuous soy",
      c_wheat: "Wheat – fallow",
      c_veg: "Vegetables",
      w_rain: "Rain only",
      w_irrig: "Irrigation available",
      w_limited: "Limited irrigation",
      m_conv: "Conventional",
      m_notill: "No-till",
      m_forage: "Forage / livestock equipment",
      p_income: "Net income",
      p_water: "Save water",
      p_soil: "Regenerate soil",
      p_pests: "Break pest cycles",
      sA: "Strategy A · Commercial income",
      sB: "Strategy B · Water saving",
      sC: "Strategy C · Soil regeneration",
      baseline: "Your current rotation",
      strat_seq: "Sequence",
      strat_gain: "What you gain",
      strat_cost: "What you give up",
      strat_match: "Matches your priority",
      strat_rule_note: "Team agronomic rule, not a measurement. This tool assists; it never replaces the farmer or a local agronomist.",
      legume_lbl: "Nitrogen fixation",
      cover_lbl: "Winter ground cover",
      fam_lbl: "Botanical families",
      fit_ok: "Fits your machinery",
      fit_warn: "Needs no-till equipment",
      rot_comp_title: "Side-by-side strategy comparison",
      calc_title: "Cost & margin calculator (live USDA MARS prices)",
      calc_sub: "Enter your area, cost, and expected yield; sale prices come live from USDA MARS.",
      cal3_title: "Printable 3-year crop calendar",
      scen_title: "Climate scenarios: what if rain drops or temperature rises?",
      scen_rain: "Rainfall change",
      scen_temp: "Temperature change",
      alerts_title: "Active alerts & editable thresholds",

      tab_clima: "Weather, water & soil",
      tab_ia: "Superintelligence (SI)",
      tab_fuentes: "Data, catalog & sources",
      fc_title: "7-day forecast and frost risk",
      bal_title: "Monthly water balance (rain vs crop water use)",
      bare_cal_title: "Low ground-cover months calendar (< 0.30)",
      clim40_title: "40-year historical climate (1985–2024)",
      soil_title: "Soil profile by depth (USDA SSURGO)",
      sens_title: "Nearby rivers (USGS), sensor CSV, robot route & nitrogen/pH",

      ai_title: "What crop was here? (SI Classifier)",
      ai_disclaimer: "Prediction, not measurement: always confirm in the field.",
      ai_run_btn: "Run SI crop classifier on my land cells",
      ai_acc_lbl: "Measured accuracy on unseen test areas",
      ai_train_lbl: "Where and how it was trained",
      ai_models_title: "Model cards",
      ai_imp_title: "Measured feature importance (permutation)",
      ai_leaf_title: "Provisional leaf photo check (indicative)",
      ai_leaf_disclaimer: "Provisional · Indicative browser color check, not a lab measurement.",

      recol_title: "AI data collection status (refreshes every 5 s)",
      src_status_title: "Live status of the 9 official sources",
      gaps_title: "Information gaps (what is not measured, stated honestly)",
      harm_title: "Spatial resolution of each source",
      cat_title: "Full live catalog (GIBS, LANDFIRE, Planetary Computer, USGS, POWER, MARS)",

      set_title: "Display and reading settings",
      set_lang: "Language",
      set_theme: "Color theme",
      th_auto: "System default",
      th_light: "Light (field notebook)",
      th_dark: "Dark (night)",
      set_mode: "Reading mode (progressive disclosure)",
      mode_farmer: "Family (essentials, plain language)",
      mode_agr: "Agronomist (more detail & indices)",
      mode_sci: "Scientist (raw data, units & sources)",
      set_units: "Measurement units",
      u_metric: "Metric (ha, mm, °C, t)",
      u_imperial: "Imperial (ac, in, °F, bu)"
    },

    pt: {
      nav_inicio: "Início",
      nav_robot: "Robô",
      nav_region: "Clima e solo",
      nav_recom: "O que fazer",
      nav_conceptos: "Conceitos",
      nav_mapa: "Início",
      nav_decidir: "Recomendações",
      nav_datos: "Dados regionais",
      nav_ajustes: "Ajustes",
      nav_glosario: "Glossário",
      nav_recorrido: "Tour",
      nav_cuenta: "Minha Conta",
      nav_terrenos: "Meus Terrenos",

      w_problem: "Decida o que plantar e quando irrigar lendo satélites e estações oficiais ao vivo.",
      w_try: "Testar com um exemplo",
      w_gps: "Usar minha localização",
      w_search: "Buscar um lugar",
      w_examples_lbl: "Ou escolha um dos 6 lugares de exemplo:",
      demo_badge: "exemplo, não real",
      real_badge: "localização real",
      sim_badge: "lugar escolhido no mapa",

      search_ph: "Buscar cidade, fazenda ou endereço…",
      search_btn: "Buscar",
      btn_layers: "Camadas",
      btn_draw: "Desenhar meu terreno",
      btn_my_land: "Meu terreno",
      btn_welcome: "Ajuda",
      sheet_summary: "Resumo do lugar",
      sheet_terrain: "Meu terreno",
      sheet_cell: "Ficha do quadro",
      sheet_layers: "Camadas",
      outside_us_msg: "Este lugar está fora dos EUA. Clima global (NASA POWER), previsão (Meteomatics) e verdor (Sentinel-2) funcionam aqui, mas solo (SSURGO), uso de água (OpenET) e preços (USDA) cobrem só os EUA.",
      outside_us_btn: "Simular localização nos EUA (Iowa)",

      st_ok_word: "Bom",
      st_warn_word: "Atenção",
      st_risk_word: "Risco",
      st_nodata_word: "Sem dado",
      nodata: "sem dado",

      sum_empty_title: "Comece pelo seu terreno",
      sum_empty_sub: "Adicione uma vez e aqui verá água, verdor, risco de geada e solo, com dados da NASA.",
      sem_general_title: "Estado geral hoje",
      sem_water_title: "Água e raiz",
      sem_vigor_title: "Verdor planta",
      sem_frost_title: "Frio (7 dias)",
      sem_soil_title: "Reserva solo",
      m_rain_yr: "Chuva por ano",
      m_rain_yr_desc: "Água que cai em um ano normal nesta região.",
      m_temp_yr: "Temperatura média",
      m_temp_yr_desc: "Média anual de frio e calor.",
      m_soil_w: "Água retida pelo solo",
      m_soil_w_desc: "Reserva útil no primeiro metro de raiz.",
      m_crop_et: "Água usada pela cultura",
      m_crop_et_desc: "Consumo total da última safra.",
      m_price_corn: "Preço do milho hoje",
      m_price_soy: "Preço da soja hoje",
      m_price_desc: "Relatório oficial no atacado por tonelada.",
      btn_go_decide: "Ver o que convém plantar",

      ter_title: "Meu terreno",
      ter_none: "Você ainda não traçou um terreno. Desenhe as bordas no mapa ou adote um talhão com um clique.",
      ter_draw_start: "Desenhar bordas no mapa",
      ter_draw_hint: "Clique nos cantos do seu talhão no mapa e feche no primeiro ponto.",
      ter_plss_btn: "Usar seção oficial (BLM PLSS)",
      ter_osm_btn: "Buscar talhões do OpenStreetMap aqui",
      ter_osm_hint: "Talhões carregados no mapa. Toque em qualquer um para usá-lo como seu terreno.",
      ter_clear: "Apagar terreno",
      ter_cells_lbl: "Quadros",
      ter_area: "Área medida",
      ter_green: "Verdor médio",
      ter_green_desc: "De 0 (solo exposto) a 1 (planta muito densa).",
      ter_bare: "Solo com pouca cobertura",
      ter_bare_desc: "Quadros com verdor abaixo de 0.30 (regra da equipe).",
      ter_scene: "Foto de satélite",
      ter_clouds: "nuvens",
      ter_color_by: "Colorir quadros por",
      cm_ndvi: "Verdor da planta",
      cm_sev: "Severidade combinada",
      cm_zones: "Zonas de manejo (baixa, média, alta)",
      cm_anom: "Anomalias do talhão",
      ter_save: "Salvar",
      ter_import: "Importar GeoJSON / KML",
      ter_export_geo: "GeoJSON",
      ter_export_kml: "KML",
      ter_export_csv: "CSV",
      ter_print: "Imprimir / PDF",
      ter_ai_btn: "Que cultura havia aqui? (SI)",

      cell_title: "Ficha do quadro",
      cell_none: "Toque em qualquer quadro do seu terreno no mapa para ver seus dados e alerta. Use Shift + clique para tirar a média de vários.",
      cell_coords: "Centro do quadro",
      cell_size: "Tamanho e área",
      cell_green: "Verdor medido",
      cell_anom: "Diferença frente ao talhão",
      cell_ai: "Cultura prevista pela IA",
      cell_alert: "O que significa para este quadro",
      cell_multi: "Quadros selecionados",
      cell_clear_sel: "Limpar seleção",

      lay_title: "Camadas do mapa (14 úteis)",
      lay_sub: "Ative uma camada para vê-la no mapa. Toque em «Saiba mais» para ver como muda sua decisão e seu limite.",
      lay_search: "Buscar camada…",
      lay_fav_only: "Só favoritas",
      lay_more: "Saiba mais",
      lay_impact: "Como muda sua decisão",
      lay_limit: "Limite e resolução",
      lay_g_veg: "Plantas e verdor",
      lay_g_water: "Água e umidade",
      lay_g_risk: "Risco e clima",
      lay_g_ctx: "Contexto e histórico",
      lay_time_title: "Máquina do tempo (12 semanas) e cortina comparadora",
      lay_play: "Reproduzir",
      lay_pause: "Pausar",
      lay_opacity: "Opacidade",
      lay_curtain: "Cortina comparadora (esquerda / direita)",
      lay_open_cat: "Ver o catálogo completo (1330 camadas)",

      dec_title: "O que plantar e por quê",
      dec_edit_farm: "Editar respostas de «Sua fazenda»",
      farm_title: "Sua fazenda (4 perguntas)",
      farm_sub: "Mude qualquer resposta e veja na hora como muda a recomendação.",
      q_crop: "1. O que você cultiva hoje?",
      q_water: "2. Que água você tem disponível?",
      q_mach: "3. Que maquinário você tem?",
      q_prio: "4. Qual é sua prioridade principal?",
      c_maize: "Milho contínuo",
      c_soy: "Soja contínua",
      c_wheat: "Trigo – pousio",
      c_veg: "Hortaliças",
      w_rain: "Só chuva",
      w_irrig: "Irrigação disponível",
      w_limited: "Irrigação limitada",
      m_conv: "Convencional",
      m_notill: "Plantio direto",
      m_forage: "Equipamento de forragem / pecuária",
      p_income: "Renda líquida",
      p_water: "Economizar água",
      p_soil: "Regenerar o solo",
      p_pests: "Quebrar ciclos de pragas",
      sA: "Estratégia A · Renda comercial",
      sB: "Estratégia B · Economia de água",
      sC: "Estratégia C · Regeneração do solo",
      baseline: "Sua rotação atual",
      strat_seq: "Sequência",
      strat_gain: "O que você ganha",
      strat_cost: "O que você abre mão",
      strat_match: "Combina com sua prioridade",
      strat_rule_note: "Regra agronômica da equipe, não uma medição. Esta ferramenta ajuda; nunca substitui o agricultor nem um agrônomo local.",
      legume_lbl: "Fixação de nitrogênio",
      cover_lbl: "Cobertura de inverno",
      fam_lbl: "Famílias botânicas",
      fit_ok: "Combina com seu maquinário",
      fit_warn: "Exige plantio direto",
      rot_comp_title: "Comparador lado a lado de estratégias",
      calc_title: "Calculadora de custos e margens (preços reais USDA MARS)",
      calc_sub: "Informe sua área, custo e produtividade esperada; o preço de venda vem da USDA MARS.",
      cal3_title: "Calendário agrícola de 3 anos (imprimível)",
      scen_title: "Cenários climáticos: e se chover menos ou esquentar?",
      scen_rain: "Variação da chuva",
      scen_temp: "Variação da temperatura",
      alerts_title: "Alertas ativos e limites editáveis",

      tab_clima: "Clima, água e solo",
      tab_ia: "Superinteligência (SI)",
      tab_fuentes: "Dados, catálogo e fontes",
      fc_title: "Previsão de 7 dias e risco de geada",
      bal_title: "Balanço mensal de água (chuva vs uso da cultura)",
      bare_cal_title: "Calendário de meses com pouca cobertura (< 0.30)",
      clim40_title: "Clima histórico de 40 anos (1985–2024)",
      soil_title: "Perfil do solo por profundidade (USDA SSURGO)",
      sens_title: "Rios próximos (USGS), sensores CSV, rota do robô e nitrogênio/pH",

      ai_title: "Que cultura havia aqui? (Classificador SI)",
      ai_disclaimer: "Previsão, não medição: confirme sempre no campo.",
      ai_run_btn: "Executar SI sobre os quadros do meu terreno",
      ai_acc_lbl: "Acerto medido em áreas de teste nunca vistas",
      ai_train_lbl: "Onde e como foi treinado",
      ai_models_title: "Fichas dos modelos",
      ai_imp_title: "Importância medida das variáveis (permutação)",
      ai_leaf_title: "Diagnóstico orientativo de foto de folha (provisório)",
      ai_leaf_disclaimer: "Provisório · Previsão orientativa por cor no navegador, não medição de laboratório.",

      recol_title: "Estado da coleta de dados para a SI (atualiza a cada 5 s)",
      src_status_title: "Estado ao vivo das 9 fontes oficiais",
      gaps_title: "Lacunas de informação (o que não é medido, escrito com honestidade)",
      harm_title: "Resolução espacial de cada fonte",
      cat_title: "Catálogo completo ao vivo (GIBS, LANDFIRE, Planetary Computer, USGS, POWER, MARS)",

      set_title: "Ajustes de tela e leitura",
      set_lang: "Idioma",
      set_theme: "Tema de cor",
      th_auto: "Automático (sistema)",
      th_light: "Claro (caderno de campo)",
      th_dark: "Escuro (noite)",
      set_mode: "Modo de leitura (revelação progressiva)",
      mode_farmer: "Família (o essencial, palavras simples)",
      mode_agr: "Agrônomo (mais detalhes e índices)",
      mode_sci: "Científico (dados brutos, unidades, fontes)",
      set_units: "Unidades de medida",
      u_metric: "Métrico (ha, mm, °C, t)",
      u_imperial: "Imperial (ac, in, °F, bu)"
    }
  };

  window.tr = function (key) {
    const lang = window.V2?.lang || "es";
    return (window.DICT_V2[lang] && window.DICT_V2[lang][key]) || window.DICT_V2.es[key] || key;
  };

  // Conversión transparente de unidades cuando el usuario elige Imperial vs Métrico en Ajustes
  window.fmtRain = function (mm, d = 0) {
    if (mm == null || Number.isNaN(+mm)) return { val: window.tr("nodata"), unit: "" };
    if (window.V2?.units === "imperial") {
      return { val: (+mm / 25.4).toFixed(1), unit: "in" };
    }
    return { val: (+mm).toFixed(d), unit: "mm" };
  };

  window.fmtTemp = function (c, d = 1) {
    if (c == null || Number.isNaN(+c)) return { val: window.tr("nodata"), unit: "" };
    if (window.V2?.units === "imperial") {
      return { val: ((+c * 9) / 5 + 32).toFixed(d), unit: "°F" };
    }
    return { val: (+c).toFixed(d), unit: "°C" };
  };

  window.fmtArea = function (ha, d = 1) {
    if (ha == null || Number.isNaN(+ha)) return { val: window.tr("nodata"), unit: "" };
    if (window.V2?.units === "imperial") {
      return { val: (+ha * 2.47105).toFixed(d), unit: "ac" };
    }
    return { val: (+ha).toFixed(d), unit: "ha" };
  };

  window.trDrainage = function (raw) {
    if (!raw) return "";
    const lang = window.V2?.lang || "es";
    if (lang === "en") return raw.toLowerCase();
    const k = String(raw).trim().toLowerCase();
    const map = {
      "excessively drained": { es: "drenaje muy rápido", pt: "drenagem muito rápida" },
      "somewhat excessively drained": { es: "drenaje rápido", pt: "drenagem rápida" },
      "well drained": { es: "buen drenaje", pt: "boa drenagem" },
      "moderately well drained": { es: "drenaje moderado", pt: "drenagem moderada" },
      "somewhat poorly drained": { es: "drenaje algo lento", pt: "drenagem um pouco lenta" },
      "poorly drained": { es: "drenaje lento", pt: "drenagem lenta" },
      "very poorly drained": { es: "drenaje muy lento", pt: "drenagem muito lenta" }
    };
    return (map[k] && map[k][lang]) || raw;
  };
})();

// Textos agregados en la mejora total (2026-11-15). Cada cadena nueva entra en ES, EN y PT a la vez.
(function () {
  "use strict";
  const N = {
    av_paso: ["Paso {a} de {b}", "Step {a} of {b}", "Passo {a} de {b}"],
    av_de: ["{a} de {b}", "{a} of {b}", "{a} de {b}"],
    av_suele: ["Suele tardar {s} s (mediana de {n} corridas medidas)", "Usually takes {s} s (median of {n} measured runs)", "Costuma levar {s} s (mediana de {n} execuções medidas)"],
    av_sin_hist: ["Primera vez: todavía no hay un tiempo medido para estimar", "First run: no measured time to estimate from yet", "Primeira vez: ainda não há tempo medido para estimar"],
    tr_terreno: ["Midiendo tu terreno con Sentinel-2", "Measuring your field with Sentinel-2", "Medindo seu terreno com Sentinel-2"],
    tr_ia: ["Prediciendo el cultivo con el modelo", "Predicting the crop with the model", "Prevendo a cultura com o modelo"],
    tr_parcela: ["Trayendo los datos de este lugar", "Fetching data for this place", "Buscando os dados deste lugar"],
    tr_hoja: ["Leyendo la hoja del robot", "Reading the robot sheet", "Lendo a planilha do robô"],
    ter_cuadros: ["trazando los cuadros", "laying out the squares", "traçando os quadros"],
    ter_escena: ["buscando la foto más reciente sin nubes", "finding the latest cloud-free image", "buscando a imagem mais recente sem nuvens"],
    ter_recorte: ["leyendo la foto del terreno", "reading the image of the field", "lendo a imagem do terreno"],
    ter_puntos: ["leyendo punto por punto", "reading point by point", "lendo ponto por ponto"],
    ter_resumen: ["calculando el verdor", "computing greenness", "calculando o verdor"],
    ia_cuadros: ["trazando los cuadros", "laying out the squares", "traçando os quadros"],
    ia_fechas: ["buscando las fechas de la temporada", "finding the season's dates", "buscando as datas da safra"],
    ia_puntos: ["leyendo cada punto en cada fecha", "reading each point on each date", "lendo cada ponto em cada data"],
    ia_modelo: ["aplicando el modelo", "running the model", "aplicando o modelo"],
    par_fuentes: ["consultando las fuentes", "querying the sources", "consultando as fontes"],
    par_reglas: ["aplicando las reglas del equipo", "applying the team's rules", "aplicando as regras da equipe"],
    hoja_bajar: ["bajando la hoja", "downloading the sheet", "baixando a planilha"],
    hoja_leer: ["interpretando las columnas", "reading the columns", "interpretando as colunas"],
    hoja_guardar: ["guardando las filas nuevas", "saving the new rows", "salvando as linhas novas"],
    ter_fail: ["No se pudo medir el terreno.", "The field could not be measured.", "Não foi possível medir o terreno."],
    gps_none: ["Este navegador no da la ubicación. Busca el lugar o tócalo en el mapa.", "This browser does not share location. Search for the place or tap it on the map.", "Este navegador não informa a localização. Busque o lugar ou toque no mapa."],
    gps_fail: ["No se pudo leer el GPS. Busca el lugar o tócalo en el mapa.", "Could not read GPS. Search for the place or tap it on the map.", "Não foi possível ler o GPS. Busque o lugar ou toque no mapa."],
    add_field: ["Agregar mi terreno", "Add my field", "Adicionar meu terreno"],
    go_robot_upload: ["Subir lecturas de sensores (sección Robot)", "Upload sensor readings (Robot section)", "Enviar leituras de sensores (seção Robô)"],
    src_medicion: ["medición", "measurement", "medição"],
    src_estimacion: ["estimación", "estimate", "estimativa"],
    src_prediccion: ["predicción, no medición", "prediction, not a measurement", "previsão, não medição"],
    src_regla: ["regla del equipo", "team rule", "regra da equipe"],
    src_usuario: ["lo escribiste tú", "entered by you", "informado por você"],
    src_saved: ["copia guardada el {f}", "copy saved on {f}", "cópia salva em {f}"],
    src_saved_old: ["guardado el {f}: la fuente no respondió ahora", "saved on {f}: the source did not answer just now", "salvo em {f}: a fonte não respondeu agora"],
    src_why: ["Motivo: {m}", "Reason: {m}", "Motivo: {m}"],
    calc_area: ["Área (ha)", "Area (ha)", "Área (ha)"],
    calc_area_user: ["Área que escribiste", "Area you entered", "Área informada por você"],
    calc_area_field: ["Si la dejas vacía se usa el área medida de tu terreno", "Left empty, the measured area of your field is used", "Se ficar vazio, usa-se a área medida do terreno"],
    calc_area_none: ["Escribe el área o mide tu terreno para ver el total", "Enter the area or measure your field to see the total", "Informe a área ou meça o terreno para ver o total"],
    calc_crop: ["Cultivo", "Crop", "Cultura"],
    calc_cost: ["Tu costo (USD/ha)", "Your cost (USD/ha)", "Seu custo (USD/ha)"],
    calc_yield: ["Tu rendimiento esperado (t/ha)", "Your expected yield (t/ha)", "Sua produtividade esperada (t/ha)"],
    calc_price: ["Precio (USD/t)", "Price (USD/t)", "Preço (USD/t)"],
    calc_price_user: ["Sin precio en el reporte de USDA: escribe el tuyo", "No price in the USDA report: enter yours", "Sem preço no relatório do USDA: informe o seu"],
    calc_margin: ["Margen (USD/ha)", "Margin (USD/ha)", "Margem (USD/ha)"],
    calc_total: ["Total (USD)", "Total (USD)", "Total (USD)"],
    calc_formula: ["Margen = tu rendimiento × precio − tu costo. Sin esos tres números no se calcula nada: aquí no hay costos ni rendimientos de ejemplo.", "Margin = your yield × price − your cost. Without those three numbers nothing is computed: there are no example costs or yields here.", "Margem = sua produtividade × preço − seu custo. Sem esses três números nada é calculado: aqui não há custos nem produtividades de exemplo."],
    scen_result: ["Lluvia del escenario: {r} mm/año · Consumo del cultivo del escenario: {e} mm/año → Balance: {b} mm.", "Scenario rainfall: {r} mm/yr · Scenario crop water use: {e} mm/yr → Balance: {b} mm.", "Chuva do cenário: {r} mm/ano · Consumo da cultura no cenário: {e} mm/ano → Balanço: {b} mm."],
    scen_rule: ["Estimación. El 6 % más de consumo por cada °C es una regla del equipo, aplicada sobre la lluvia de NASA POWER y el consumo de OpenET.", "Estimate. The 6% extra water use per °C is a team rule, applied to NASA POWER rainfall and OpenET water use.", "Estimativa. Os 6 % a mais de consumo por °C são uma regra da equipe, aplicada sobre a chuva do NASA POWER e o consumo do OpenET."],
    scen_missing: ["No se puede calcular el escenario: falta el dato de {f} para este lugar.", "The scenario cannot be computed: {f} data is missing for this place.", "Não é possível calcular o cenário: falta o dado de {f} para este lugar."],
    ai_base: ["Decir siempre el cultivo más común acierta {b} %", "Always guessing the most common crop scores {b}%", "Dizer sempre a cultura mais comum acerta {b} %"],
    ai_zone_note: ["Fuera de esa zona no está medido cuánto acierta.", "Outside that area its accuracy has not been measured.", "Fora dessa zona o acerto não foi medido."],
    ai_acc_tag: ["SI · {a} % de acierto medido", "SI · {a}% measured accuracy", "SI · {a} % de acerto medido"],
    ai_recom_note: ["El modelo acierta {a} % en años y zonas que no vio (decir siempre el cultivo más común acierta {b} %). Entrenado en {z}.", "The model scores {a}% on years and areas it never saw (always guessing the most common crop scores {b}%). Trained in {z}.", "O modelo acerta {a} % em anos e zonas que não viu (dizer sempre a cultura mais comum acerta {b} %). Treinado em {z}."],
    rec_today: ["Hoy", "Today", "Hoje"],
    cm_ai: ["Cultivo según el modelo (predicción)", "Crop per the model (prediction)", "Cultura segundo o modelo (previsão)"],
    rb_med: ["Medido", "Measured", "Medido"],
    rb_est: ["Estimado", "Estimated", "Estimado"],
    rb_tip_med: ["medido: media de {n} lecturas del robot dentro del cuadro", "measured: mean of {n} robot readings inside the square", "medido: média de {n} leituras do robô dentro do quadro"],
    rb_tip_est: ["estimado con los cuadros medidos cercanos; el robot no pasó por aquí", "estimated from nearby measured squares; the robot did not pass here", "estimado com os quadros medidos próximos; o robô não passou aqui"],
    rb_leg_med: ["Medido por el robot: {n} de {t} cuadros", "Measured by the robot: {n} of {t} squares", "Medido pelo robô: {n} de {t} quadros"],
    rb_leg_est: ["Estimado por vecindad: {n} cuadros (más tenue y punteado)", "Estimated from neighbours: {n} squares (fainter, dotted)", "Estimado por vizinhança: {n} quadros (mais claro e pontilhado)"],
    rb_leg_noest: ["Sin estimar: hacen falta al menos 3 cuadros medidos", "Not estimated: at least 3 measured squares are needed", "Sem estimar: são necessários pelo menos 3 quadros medidos"],
    rb_leg_fuera: ["{n} lecturas con posición caen fuera de este terreno", "{n} readings with position fall outside this field", "{n} leituras com posição caem fora deste terreno"],
    rb_leg_src: ["Fuente: {n} lecturas del robot con posición. La estimación pesa cada cuadro medido por el inverso de su distancia al cuadrado.", "Source: {n} robot readings with position. The estimate weights each measured square by the inverse of its squared distance.", "Fonte: {n} leituras do robô com posição. A estimativa pondera cada quadro medido pelo inverso do quadrado da distância."],
    rb_leg_cambiar: ["Cambiar lo que se pinta →", "Change what is drawn →", "Mudar o que é pintado →"],
    pq_title: ["¿Qué quieres saber de tu terreno?", "What do you want to know about your field?", "O que você quer saber do seu terreno?"],
    pq_loading: ["Cargando…", "Loading…", "Carregando…"],
    pq_pick: ["Toca una pregunta: se abre su paquete de capas y el valor en tu terreno.", "Tap a question: its layer pack and the value on your field open.", "Toque numa pergunta: abre o pacote de camadas e o valor no seu terreno."],
    pq_sum7: ["suma de 7 días · 30 días: {v}", "7-day total · 30 days: {v}", "soma de 7 dias · 30 dias: {v}"],
    pq_avg7: ["media de 7 días · 30 días: {v}", "7-day mean · 30 days: {v}", "média de 7 dias · 30 dias: {v}"],
    pq_noseries: ["No llegó la serie de NASA POWER para este terreno.", "The NASA POWER series for this field did not arrive.", "A série do NASA POWER para este terreno não chegou."],
    pq_nofield: ["Guarda un terreno para ver el valor en él.", "Save a field to see the value on it.", "Salve um terreno para ver o valor nele."],
    pq_layers: ["Capas de esta pregunta que hoy sí responden: {n}", "Layers for this question that answer today: {n}", "Camadas desta pergunta que respondem hoje: {n}"],
    pq_fresh: ["último dato {f}", "latest data {f}", "último dado {f}"],
    pq_image: ["solo imagen", "image only", "só imagem"],
    pq_dropped: ["{n} capas se descartaron porque no entregaron imagen al comprobarlas.", "{n} layers were dropped because they returned no image when checked.", "{n} camadas foram descartadas por não entregar imagem na verificação."],
    pq_open: ["Ver estas capas en el mapa", "See these layers on the map", "Ver estas camadas no mapa"],
    cell_same: ["Mismo color y valor que en el mapa · promedio del terreno {p} · {n} píxeles de la foto del {f}. Con la misma foto el valor no cambia; cambia cuando llega una foto nueva.", "Same colour and value as on the map · field average {p} · {n} pixels from the {f} image. With the same image the value does not change; it changes when a new image arrives.", "Mesma cor e valor do mapa · média do terreno {p} · {n} pixels da imagem de {f}. Com a mesma imagem o valor não muda; muda quando chega uma imagem nova."],
    strat_how: ["¿Cómo se eligió?", "How was it chosen?", "Como foi escolhida?"],
    strat_formula: ["Regla del equipo: +2 si la estrategia va con tu prioridad, −3 si pide siembra directa y no la tienes, −1 a la A sin riego, +1 a la B sin riego. Gana la de más puntos.", "Team rule: +2 if the strategy matches your priority, −3 if it needs no-till and you lack it, −1 to A without irrigation, +1 to B without irrigation. Highest score wins.", "Regra da equipe: +2 se a estratégia combina com sua prioridade, −3 se pede plantio direto e você não tem, −1 para a A sem irrigação, +1 para a B sem irrigação. Vence a de mais pontos."],
    why_btn: ["¿Por qué?", "Why?", "Por quê?"],
    why_rule: ["Regla:", "Rule:", "Regra:"],
    why_src: ["Fuente:", "Source:", "Fonte:"],
    vt_aria: ["Lo que hace Field Shift", "What Field Shift does", "O que o Field Shift faz"],
    vt_si_t: ["SI de campo: pregúntale a tu terreno", "Field SI: ask your field", "SI de campo: pergunte ao seu terreno"],
    vt_si_d: ["Responde con los datos reales de tu terreno y te dice de dónde sale cada cifra. Si un dato falta, lo dice.", "It answers with your field's real data and tells you where each figure comes from. If something is missing, it says so.", "Responde com os dados reais do seu terreno e diz de onde vem cada número. Se falta um dado, ela diz."],
    vt_si_acc: ["Su modelo de cultivos acierta {a} % en zonas y años que nunca vio (adivinar al más común acierta {b} %).", "Its crop model scores {a}% on areas and years it never saw (guessing the most common scores {b}%).", "Seu modelo de culturas acerta {a} % em zonas e anos que nunca viu (chutar a mais comum acerta {b} %)."],
    vt_si_btn: ["Abrir la SI", "Open the SI", "Abrir a SI"],
    vt_nasa_t: ["Datos de la NASA, en vivo", "NASA data, live", "Dados da NASA, ao vivo"],
    vt_nasa_d: ["{n} capas de satélite listas para ver, y 12 preguntas de campo que abren las que sirven.", "{n} satellite layers ready to view, and 12 field questions that open the ones that matter.", "{n} camadas de satélite prontas para ver, e 12 perguntas de campo que abrem as que servem."],
    vt_nasa_d0: ["Capas de satélite listas para ver, y 12 preguntas de campo que abren las que sirven.", "Satellite layers ready to view, and 12 field questions that open the ones that matter.", "Camadas de satélite prontas para ver, e 12 perguntas de campo que abrem as que servem."],
    vt_5m_t: ["Tu terreno, cuadro por cuadro", "Your field, square by square", "Seu terreno, quadro a quadro"],
    vt_5m_d: ["Cuadros de 5 × 5 m con el verdor de Sentinel-2. Mismo cuadro, misma foto, mismo valor.", "5 × 5 m squares with Sentinel-2 greenness. Same square, same image, same value.", "Quadros de 5 × 5 m com o verdor do Sentinel-2. Mesmo quadro, mesma imagem, mesmo valor."],
    vt_robot_t: ["Tu robot, conectado en 3 pasos", "Your robot, connected in 3 steps", "Seu robô, conectado em 3 passos"],
    vt_robot_d: ["Pega el link de su hoja de Google y ve sus lecturas en el mapa, medidas y estimadas por separado.", "Paste its Google Sheet link and see its readings on the map, measured and estimated kept apart.", "Cole o link da planilha Google e veja as leituras no mapa, medidas e estimadas separadas."],
    vt_src_t: ["Cada cifra con su origen", "Every figure with its source", "Cada número com sua origem"],
    vt_src_d: ["Fuente, fecha y si es medición, estimación o predicción. Nada de números de ejemplo.", "Source, date and whether it is a measurement, an estimate or a prediction. No example numbers.", "Fonte, data e se é medição, estimativa ou previsão. Nada de números de exemplo."],
    vt_lang_t: ["En tu idioma", "In your language", "No seu idioma"],
    vt_lang_d: ["Toda la app en español, inglés y portugués. Cámbialo aquí o arriba, cuando quieras.", "The whole app in Spanish, English and Portuguese. Switch here or at the top, any time.", "Todo o app em espanhol, inglês e português. Troque aqui ou no topo, quando quiser."],
    rec_week: ["Esta semana", "This week", "Esta semana"],
  };
  ["es", "en", "pt"].forEach((l, i) => Object.keys(N).forEach(k => { window.DICT_V2[l][k] = N[k][i]; }));
  // tr con huecos: trf("av_paso", { a: 1, b: 4 })
  window.trf = (k, v) => window.tr(k).replace(/\{(\w+)\}/g, (_, n) => (v && v[n] != null ? v[n] : ""));
})();

// Textos fijos de pantallas anteriores que estaban solo en español: se traducen al dibujar, por coincidencia exacta.
// Lo que viene del servidor (frases de alertas, de la SI y de las recomendaciones) todavía llega en español.
(function () {
  "use strict";
  const T = {
    "Simular flota de robots": ["Simulate robot fleet", "Simular frota de robôs"], "Detener flota de robots": ["Stop robot fleet", "Parar frota de robôs"], "Flota de robots simulada": ["Simulated robot fleet", "Frota de robôs simulada"],
    "Hardware real · Pruebas IoT en loop": ["Real hardware · Looping IoT test feed", "Hardware real · Testes IoT em loop"],
    "Hardware real · Ensayos IoT": ["Real hardware · IoT test feed", "Hardware real · Testes IoT"],
    "Prueba 1 (Banco)": ["Test 1 (Bench)", "Teste 1 (Bancada)"], "Prueba 2 (Campo)": ["Test 2 (Field)", "Teste 2 (Campo)"],
    "Ensayos físicos del prototipo robótico": ["Physical trials of the prototype rover", "Testes físicos do protótipo robótico"],
    "Telemetría de pruebas": ["Test telemetry", "Telemetria de testes"], "Pruebas físicas del rover": ["Physical rover test runs", "Testes físicos do robô"],
    "Video en loop": ["Looping video", "Vídeo em loop"], "Rover real": ["Real rover", "Robô real"],
    "Datos del sensor de hardware y datos de la nube": ["Hardware sensor data and cloud satellite data", "Dados do sensor de hardware e dados da nuvem"],
    "Distinción agronómica:": ["Agronomic distinction:", "Distinção agronômica:"],
    "Ruta de muestreo": ["Sampling route", "Rota de amostragem"], "Ir al robot": ["Go to robot", "Ir ao robô"],
    "Tablero de campo": ["Field board", "Painel de campo"], "Ver mapa satelital completo": ["Open full satellite map", "Ver mapa de satélite completo"], "Editar terreno": ["Edit field", "Editar terreno"],
    "Colorear sectores del terreno por:": ["Colour the field's squares by:", "Colorir os quadros do terreno por:"], "Verdor (NDVI)": ["Greenness (NDVI)", "Verdor (NDVI)"], "Riesgo / Severidad": ["Risk / Severity", "Risco / Severidade"],
    "3 Zonas": ["3 Zones", "3 Zonas"], "Anomalías": ["Anomalies", "Anomalias"], "Lecturas del robot en tiempo real": ["Robot readings, live", "Leituras do robô ao vivo"], "Robot conectado": ["Robot connected", "Robô conectado"],
    "Esperando lecturas": ["Waiting for readings", "Aguardando leituras"], "Aún no llegan datos del robot.": ["No robot data has arrived yet.", "Ainda não chegaram dados do robô."],
    "Tu libreta está lista para recibir variables. Conecta la hoja de Google del robot o sube un archivo CSV / Excel desde la sección Robot.": ["Your notebook is ready to receive variables. Connect the robot's Google Sheet or upload a CSV / Excel file from the Robot section.", "Seu caderno está pronto para receber variáveis. Conecte a planilha Google do robô ou envie um arquivo CSV / Excel na seção Robô."],
    "Conectar el robot →": ["Connect the robot →", "Conectar o robô →"], "Datos locales y datos de la nube, lado a lado": ["Local data and cloud data, side by side", "Dados locais e dados da nuvem, lado a lado"],
    "Comparación directa entre lo que mide el robot en el suelo exacto y lo que observan los satélites en promedio regional.": ["A direct comparison between what the robot measures at the exact spot and what satellites see as a regional average.", "Comparação direta entre o que o robô mede no ponto exato e o que os satélites observam em média regional."],
    "Humedad del suelo (Agua en raíz)": ["Soil moisture (root-zone water)", "Umidade do solo (água na raiz)"], "Robot (Local)": ["Robot (local)", "Robô (local)"], "Diferencia": ["Difference", "Diferença"], "NASA POWER (Nube)": ["NASA POWER (cloud)", "NASA POWER (nuvem)"],
    "Temperatura de la superficie": ["Surface temperature", "Temperatura da superfície"], "Promedios y estadísticas históricas del lote": ["Averages and history for the field", "Médias e histórico do terreno"],
    "Variable": ["Variable", "Variável"], "Últimas 24 horas": ["Last 24 hours", "Últimas 24 horas"], "Últimos 7 días": ["Last 7 days", "Últimos 7 dias"], "Últimos 30 días": ["Last 30 days", "Últimos 30 dias"],
    "Calculado solo con las lecturas que el robot ha enviado.": ["Computed only from the readings the robot has sent.", "Calculado só com as leituras que o robô enviou."], "Aún no hay lecturas del robot.": ["No robot readings yet.", "Ainda não há leituras do robô."],
    "Datos en crudo del robot": ["Raw robot data", "Dados brutos do robô"], "Descargar CSV completo": ["Download CSV", "Baixar CSV"], "Serie temporal de lecturas sin modificar, directa de los sensores.": ["Unmodified time series of readings, straight from the sensors.", "Série de leituras sem alterações, direto dos sensores."],
    "Hora (UTC)": ["Time", "Horário"], "Valor": ["Value", "Valor"], "Coordenadas": ["Coordinates", "Coordenadas"], "Alertas agronómicas activas": ["Active field alerts", "Alertas de campo ativos"], "Sin alertas por ahora.": ["No alerts for now.", "Sem alertas por enquanto."],
    "Sin rango fijado": ["No range set", "Sem faixa definida"], "Mi terreno": ["My field", "Meu terreno"],
    "Recomendaciones agronómicas": ["What to do on your field", "O que fazer no seu terreno"],
    "Acciones concretas sustentadas en la combinación de datos del robot local, satélites Sentinel/NASA y modelos climáticos.": ["Concrete actions backed by robot data, Sentinel/NASA satellites and climate data together.", "Ações concretas apoiadas em dados do robô, satélites Sentinel/NASA e dados de clima juntos."],
    "1. Qué hacer hoy y esta semana": ["1. What to do today and this week", "1. O que fazer hoje e nesta semana"], "2. Qué hacer este mes y esta temporada": ["2. What to do this month and this season", "2. O que fazer neste mês e nesta safra"],
    "3. Estrategia a largo plazo (Rotación y márgenes)": ["3. Long-term strategy (rotation and margins)", "3. Estratégia de longo prazo (rotação e margens)"], "Por qué (datos que lo sustentan):": ["Why (the data behind it):", "Por quê (os dados que sustentam):"],
    "Datos que faltan para afinar la decisión:": ["Data still missing to sharpen the decision:", "Dados que faltam para afinar a decisão:"], "Predicción de cultivo por SI": ["Crop prediction by SI", "Previsão de cultura pela SI"],
    "Ejecutar clasificador SI sobre los cuadros": ["Run the SI classifier on the squares", "Rodar o classificador SI nos quadros"], "¿Por qué una predicción no es medición? →": ["Why is a prediction not a measurement? →", "Por que uma previsão não é medição? →"],
    "Calculando recomendaciones con los datos reales de tu terreno…": ["Working out what to do from your field's real data…", "Calculando o que fazer com os dados reais do seu terreno…"],
    "Todavía no hay recomendaciones: elige o guarda un terreno y espera a que termine el análisis.": ["Nothing to recommend yet: choose or save a field and wait for the analysis to finish.", "Ainda não há recomendações: escolha ou salve um terreno e aguarde a análise."],
    "Modo Familia (lenguaje sencillo)": ["Simple mode (plain language)", "Modo simples (linguagem direta)"], "Cambiar modo de detalle": ["Change level of detail", "Mudar nível de detalhe"],
    "El clima y la tierra de tu región explicados simple": ["Your region's climate and soil, explained simply", "O clima e o solo da sua região, explicados de forma simples"],
    "Sin términos técnicos ni siglas. Toca «¿Qué significa?» en cualquier tema para aprender más.": ["No jargon or acronyms. Tap “What does it mean?” on any topic to learn more.", "Sem termos técnicos nem siglas. Toque em «O que significa?» em qualquer tema para saber mais."],
    "¿Qué significa el balance de agua? →": ["What does water balance mean? →", "O que significa o balanço de água? →"], "Fotos del satélite sobre tu campo": ["Satellite images over your field", "Imagens de satélite sobre seu campo"],
    "Puedes encender las capas satelitales para ver el verdor de las hojas y la humedad de la tierra.": ["Turn on satellite layers to see leaf greenness and soil moisture.", "Ligue as camadas de satélite para ver o verdor das folhas e a umidade do solo."],
    "Abrir explorador de capas satelitales →": ["Open the satellite layer explorer →", "Abrir o explorador de camadas de satélite →"], "Elige un terreno en el mapa para ver la lluvia de su zona con datos de NASA.": ["Choose a field on the map to see its area's rainfall with NASA data.", "Escolha um terreno no mapa para ver a chuva da zona com dados da NASA."],
    "Criterio": ["Criterion", "Critério"], "Demanda de agua": ["Water demand", "Demanda de água"], "Nitrógeno biológico": ["Biological nitrogen", "Nitrogênio biológico"], "Cobertura invernal": ["Winter cover", "Cobertura de inverno"], "Maquinaria": ["Machinery", "Maquinário"],
    "Año 1 · Cultivo principal + Cobertura": ["Year 1 · Main crop + cover", "Ano 1 · Cultura principal + cobertura"], "Año 2 · Fijación biológica de nitrógeno": ["Year 2 · Biological nitrogen fixation", "Ano 2 · Fixação biológica de nitrogênio"],
    "Año 3 · Consolidación del suelo": ["Year 3 · Building the soil", "Ano 3 · Consolidação do solo"], "Listo": ["Done", "Pronto"], "Anterior": ["Back", "Anterior"], "Siguiente": ["Next", "Próximo"], "Finalizar": ["Finish", "Concluir"],
    "Acierto medido:": ["Measured accuracy:", "Acerto medido:"], "Entrenamiento:": ["Training:", "Treinamento:"], "Límite:": ["Limit:", "Limite:"],
    "Profundidad (cm)": ["Depth (cm)", "Profundidade (cm)"], "Materia orgánica (%)": ["Organic matter (%)", "Matéria orgânica (%)"], "Arcilla (%)": ["Clay (%)", "Argila (%)"],
    "Fuente": ["Source", "Fonte"], "Resolución": ["Resolution", "Resolução"], "Uso": ["Use", "Uso"], "Reintentar lectura satelital": ["Retry satellite read", "Tentar a leitura de satélite de novo"],
    "Ver JSON oficial en vivo": ["See the live raw response", "Ver a resposta bruta ao vivo"], "Cargando estado de recolectores…": ["Loading collection status…", "Carregando o estado da coleta…"],
    "Fuente / Base": ["Source / Database", "Fonte / Base"], "Variable / Tabla": ["Variable / Table", "Variável / Tabela"], "Cantidad": ["Count", "Quantidade"], "Rango medido": ["Measured range", "Faixa medida"],
    "Una por familia (ocultar repetidas)": ["One per family (hide repeats)", "Uma por família (ocultar repetidas)"], "Estado: Todas": ["Status: all", "Estado: todas"], "En vivo": ["Live", "Ao vivo"], "Históricas": ["Historical", "Históricas"],
    "Alta para el campo": ["High for farming", "Alta para o campo"], "Contexto": ["Context", "Contexto"], "Baja": ["Low", "Baixa"], "Generar ruta de muestreo para robot (5 cuadros críticos)": ["List the 5 lowest-greenness squares for the robot", "Listar os 5 quadros de menor verdor para o robô"],
    "Estaciones de agua cercanas (USGS NWIS):": ["Nearby water stations (USGS NWIS):", "Estações de água próximas (USGS NWIS):"], "Últimas pasadas de satélite sobre este punto (NASA CMR):": ["Latest satellite passes over this point (NASA CMR):", "Últimas passagens de satélite sobre este ponto (NASA CMR):"],
    "Consultando serie de 40 años en NASA POWER…": ["Fetching the 40-year series from NASA POWER…", "Buscando a série de 40 anos no NASA POWER…"], "Panel": ["Panel", "Painel"], "Filtrar término…": ["Filter term…", "Filtrar termo…"],
    "Nitrógeno": ["Nitrogen", "Nitrogênio"], "Fósforo": ["Phosphorus", "Fósforo"], "Potasio": ["Potassium", "Potássio"], "Humedad suelo": ["Soil moisture", "Umidade do solo"], "Temp. suelo": ["Soil temp", "Temp. do solo"], "Salinidad": ["Salinity", "Salinidade"], "TDS": ["TDS", "TDS"], "Hum. aire": ["Air hum", "Umidade do ar"], "Temp. aire": ["Air temp", "Temp. do ar"], "Velocidad": ["Speed", "Velocidade"], "Rotación": ["Rotation", "Rotação"],
  };
  window.traducirDom = function () {
    const i = window.V2?.lang === "en" ? 0 : window.V2?.lang === "pt" ? 1 : -1;
    if (i < 0) return;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const k = n.nodeValue.trim(), t = k && T[k];
      if (t) n.nodeValue = n.nodeValue.replace(k, t[i]);
    }
    document.querySelectorAll("input[placeholder]").forEach(e => { const t = T[e.placeholder]; if (t) e.placeholder = t[i]; });
  };
})();
