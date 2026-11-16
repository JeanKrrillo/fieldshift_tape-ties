// =============================================================================
// Terra Lab v2 (Cápsula E) — Módulo de Conceptos Agronómicos (Sección 5)
// Cumple con la sección 3.5:
// - Para entender, no para decidir. Lista con buscador y tarjetas expandibles.
// - Cada concepto incluye exactamente:
//   1. Qué es (una frase sencilla sin jerga)
//   2. Cómo se mide (con qué sensor en tierra o satélite)
//   3. Por qué importa (en una frase práctica)
//   4. Valores típicos (únicamente con fuentes científicas / agronómicas citadas)
//   5. Qué hacer si está alto o bajo
// - Incluye los 17 conceptos mínimos obligatorios.
// - Totalmente trilingüe (ES, EN, PT).
// =============================================================================

(function () {
  "use strict";

  const CONCEPTOS_DATA = [
    {
      id: "humedad_suelo",
      titulo: { es: "Humedad del suelo", en: "Soil moisture", pt: "Umidade do solo" },
      icono: "water",
      que_es: {
        es: "Porcentaje de agua líquida presente entre las partículas y poros de la tierra.",
        en: "Percentage of water held between soil pores and particles.",
        pt: "Porcentagem de água líquida presente nos poros e partículas da terra."
      },
      como_se_mide: {
        es: "En tierra: Sondas TDR o FDR del robot (0–30 cm). En el espacio: Satélite NASA SMAP (9 km) para la zona radicular (0–100 cm).",
        en: "On ground: Rover TDR/FDR probes (0–30 cm). From space: NASA SMAP satellite (9 km) for root-zone moisture (0–100 cm).",
        pt: "Em terra: Sondas TDR/FDR do robô (0–30 cm). No espaço: Satélite NASA SMAP (9 km) na zona radicular (0–100 cm)."
      },
      por_que_importa: {
        es: "Las raíces solo absorben nutrientes si están disueltos en agua; tanto la sequía como el encharcamiento asfixian la planta.",
        en: "Roots only take in nutrients dissolved in water; both drought and waterlogging suffocate plants.",
        pt: "As raízes só absorvem nutrientes dissolvidos na água; seca e encharcamento sufocam a planta."
      },
      valores_tipicos: {
        es: "25% a 65% de humedad volumétrica es óptimo en la mayoría de suelos francos (Fuente: USDA NRCS Soil Health Division).",
        en: "25% to 65% volumetric water content is optimal for most loamy soils (Source: USDA NRCS Soil Health Division).",
        pt: "25% a 65% de umidade volumétrica é ideal na maioria dos solos francos (Fonte: USDA NRCS Soil Health Division)."
      },
      que_hacer_alto: {
        es: "Si está alto (> 75%): Evitar el paso de maquinaria pesada para no compactar el suelo y revisar zanjas de drenaje.",
        en: "If high (> 75%): Delay heavy tractor passes to prevent compaction and clear drainage ditches.",
        pt: "Se alto (> 75%): Evitar máquinas pesadas para não compactar e revisar drenos."
      },
      que_hacer_bajo: {
        es: "Si está bajo (< 25%): Programar riego ligero nocturno o conservar rastrojo de cobertura para frenar la evaporación.",
        en: "If low (< 25%): Schedule evening irrigation or maintain stubble cover to curb evaporation.",
        pt: "Se baixo (< 25%): Programar irrigação noturna ou manter palhada para frear evaporação."
      }
    },
    {
      id: "temp_suelo",
      titulo: { es: "Temperatura del suelo", en: "Soil temperature", pt: "Temperatura do solo" },
      icono: "sun",
      que_es: {
        es: "Grado de calor almacenado en los primeros centímetros donde germina la semilla.",
        en: "Heat level stored in the seedbed layer.",
        pt: "Grau de calor armazenado na camada de germinação da semente."
      },
      como_se_mide: {
        es: "En tierra: Termistor PT100/DS18B20 en la punta de la sonda del robot. En satélite: MODIS LST (1 km).",
        en: "On ground: Rover thermistor probe at 5–10 cm depth. Satellite: MODIS Land Surface Temp (1 km).",
        pt: "Em terra: Termistor da sonda do robô a 5–10 cm. Satélite: MODIS LST (1 km)."
      },
      por_que_importa: {
        es: "Las semillas de maíz y soya no germinan ni absorben fósforo si el suelo está a menos de 10 °C.",
        en: "Corn and soybean seeds will not germinate or take up phosphorus below 10 °C (50 °F).",
        pt: "Sementes de milho e soja não germinam nem absorvem fósforo abaixo de 10 °C."
      },
      valores_tipicos: {
        es: "10 °C a 28 °C para siembra y desarrollo activo de granos (Fuente: Iowa State University Extension Agronomy).",
        en: "10 °C to 28 °C (50 °F–82 °F) for planting and active cereal growth (Source: Iowa State Univ Extension).",
        pt: "10 °C a 28 °C para semeadura e desenvolvimento de grãos (Fonte: Iowa State Univ Extension)."
      },
      que_hacer_alto: {
        es: "Si está alto (> 32 °C): Cubrir el suelo con rastrojo vivo o seco para sombrear la superficie y reducir shock térmico.",
        en: "If high (> 32 °C): Leave thick cover crop mulch to shade topsoil and curb thermal shock.",
        pt: "Se alto (> 32 °C): Manter cobertura morta para sombrear o solo e reduzir estresse térmico."
      },
      que_hacer_bajo: {
        es: "Si está bajo (< 10 °C): Retrasar la siembra de primavera hasta que el suelo caliente 3 días seguidos.",
        en: "If low (< 10 °C): Delay spring planting until soil stays warm for 3 consecutive days.",
        pt: "Se baixo (< 10 °C): Adiar o plantio até o solo aquecer por 3 dias seguidos."
      }
    },
    {
      id: "ph",
      titulo: { es: "pH del suelo", en: "Soil pH", pt: "pH do solo" },
      icono: "soil",
      que_es: {
        es: "Escala química que mide qué tan ácido (0 a 6) o alcalino (8 a 14) es el suelo.",
        en: "Scale measuring how acidic (0–6) or alkaline (8–14) the soil is.",
        pt: "Escala química que mede a acidez (0 a 6) ou alcalinidade (8 a 14) do solo."
      },
      como_se_mide: {
        es: "En tierra: Electrodo de vidrio de ion selectivo o sensor ISFET en el robot. Histórico: Mapa USDA SSURGO (30 m).",
        en: "On ground: Rover glass/ISFET ion electrode in moist soil. Historical: USDA SSURGO database (30 m).",
        pt: "Em terra: Eletrodo de vidro ou ISFET do robô no solo úmido. Histórico: USDA SSURGO (30 m)."
      },
      por_que_importa: {
        es: "Con pH menor a 5.5 o mayor a 7.5, los fertilizantes quedan atrapados químicamente y la raíz no puede comerlos.",
        en: "Below 5.5 or above 7.5, soil nutrients lock up chemically and roots cannot absorb them.",
        pt: "Com pH abaixo de 5.5 ou acima de 7.5, os nutrientes se fixam quimicamente e a raiz não os absorve."
      },
      valores_tipicos: {
        es: "6.0 a 7.0 es el rango óptimo donde la mayoría de nutrientes están disponibles (Fuente: USDA NRCS Soil Quality Technical Note No. 8).",
        en: "6.0 to 7.0 is the ideal range for maximum nutrient availability (Source: USDA NRCS Soil Quality Note 8).",
        pt: "6.0 a 7.0 é a faixa ideal onde os nutrientes ficam livres (Fonte: USDA NRCS Soil Quality Note 8)."
      },
      que_hacer_alto: {
        es: "Si está alto (> 7.5): Aplicar yeso agrícola o materia orgánica compostada; elegir cultivos tolerantes como sorgo o cebada.",
        en: "If high (> 7.5): Apply agricultural gypsum or compost; pick alkaline-tolerant crops like sorghum or barley.",
        pt: "Se alto (> 7.5): Aplicar gesso agrícola ou matéria orgânica; usar culturas tolerantes como sorgo."
      },
      que_hacer_bajo: {
        es: "Si está bajo (< 5.8): Aplicar cal agrícola (carbonato de calcio) antes de la siguiente siembra según análisis.",
        en: "If low (< 5.8): Apply agricultural lime (calcium carbonate) before the next planting window.",
        pt: "Se baixo (< 5.8): Fazer calagem com calcário agrícola antes do próximo plantio."
      }
    },
    {
      id: "ec_ms_cm",
      titulo: { es: "Conductividad eléctrica (EC / Salinidad)", en: "Electrical conductivity (EC)", pt: "Condutividade elétrica (EC / Salinidade)" },
      icono: "sensor",
      que_es: {
        es: "Capacidad del suelo para conducir corriente, proporcional a la cantidad de sales y fertilizantes disueltos.",
        en: "Ability of soil solution to conduct current, directly proportional to dissolved salts.",
        pt: "Capacidade da solução do solo de conduzir corrente, proporcional aos sais e adubos dissolvidos."
      },
      como_se_mide: {
        es: "En tierra: Sonda de 4 electrodos de acero inoxidable en el robot (mS/cm). Satélite: no medible de forma directa.",
        en: "On ground: Rover 4-pin stainless electrode array (mS/cm). Satellites: not directly measurable.",
        pt: "Em terra: Sonda de 4 pinos de inox no robô (mS/cm). Satélite: não medível diretamente."
      },
      por_que_importa: {
        es: "El exceso de sales impide que la raíz chupe agua por efecto osmótico, quemando los bordes de las hojas.",
        en: "Excessive salts draw moisture out of plant roots through osmotic back-pressure, burning leaf tips.",
        pt: "O excesso de sais impede que a raiz absorva água por pressão osmótica, queimando as folhas."
      },
      valores_tipicos: {
        es: "0.4 a 2.0 mS/cm en suelo no salino apto para maíz y soya (Fuente: FAO Soils Bulletin 39 - Salt-affected soils).",
        en: "0.4 to 2.0 mS/cm for non-saline crop soils (Source: FAO Soils Bulletin 39).",
        pt: "0.4 a 2.0 mS/cm em solos não salinos para milho e soja (Fonte: FAO Soils Bulletin 39)."
      },
      que_hacer_alto: {
        es: "Si está alto (> 2.5 mS/cm): Dar un riego de lavado con agua de baja salinidad y moderar aportes de sales fertilizantes.",
        en: "If high (> 2.5 mS/cm): Leach root zone with low-salinity irrigation and reduce salt-heavy fertilizers.",
        pt: "Se alto (> 2.5 mS/cm): Fazer irrigação de lavagem com água limpa e reduzir adubos salinos."
      },
      que_hacer_bajo: {
        es: "Si está bajo (< 0.2 mS/cm): Suelo muy lavado con baja concentración de minerales libres.",
        en: "If low (< 0.2 mS/cm): Leached soil with low dissolved nutrient ions.",
        pt: "Se baixo (< 0.2 mS/cm): Solo lixiviado com baixa reserva de nutrientes dissolvidos."
      }
    },
    {
      id: "nitrogeno",
      titulo: { es: "Nitrógeno disponible (N)", en: "Available Nitrogen (N)", pt: "Nitrogênio disponível (N)" },
      icono: "leaf",
      que_es: {
        es: "Nutriente principal para el crecimiento de hojas verdes, tallos y síntesis de proteínas.",
        en: "Key nutrient driving green foliage, stalk structure, and plant protein building.",
        pt: "Nutriente principal para o crescimento de folhas verdes, caules e proteínas."
      },
      como_se_mide: {
        es: "En tierra: Sonda óptica o química NPK del robot (nitrato NO3- en mg/kg). En satélite: inferido por verdor NDVI.",
        en: "On ground: Rover optical/chemical probe (nitrate in mg/kg). Space: inferred indirectly via NDVI greenness.",
        pt: "Em terra: Sonda ótica/química NPK do robô (nitrato em mg/kg). Espaço: inferido pelo verdor NDVI."
      },
      por_que_importa: {
        es: "Sin nitrógeno la planta amarillea y frena su rendimiento; con exceso se vuelve blanda y sensible a hongos.",
        en: "Nitrogen deficiency turns leaves yellow and caps yield; excess makes tissues soft and vulnerable to fungi.",
        pt: "Sem nitrogênio a planta amarela e perde rendimento; em excesso fica vulnerável a fungos."
      },
      valores_tipicos: {
        es: "25 a 60 mg/kg de nitrato-N en capa arable durante crecimiento (Fuente: Iowa State University PM 1714).",
        en: "25 to 60 mg/kg nitrate-N in topsoil during active growth (Source: Iowa State Univ PM 1714).",
        pt: "25 a 60 mg/kg de nitrato-N na camada arável (Fonte: Iowa State Univ PM 1714)."
      },
      que_hacer_alto: {
        es: "Si está alto (> 70 mg/kg): No agregar más fertilizante para evitar lixiviación a aguas subterráneas.",
        en: "If high (> 70 mg/kg): Halt fertilizer applications to prevent nitrate leaching into groundwater.",
        pt: "Se alto (> 70 mg/kg): Suspender adubação para evitar lixiviação para o lençol freático."
      },
      que_hacer_bajo: {
        es: "Si está bajo (< 25 mg/kg): Rotar con leguminosa fijadora (soya, trébol) o aplicar fertilización de cobertura.",
        en: "If low (< 25 mg/kg): Plant nitrogen-fixing legumes (soy, clover) or side-dress targeted nitrogen.",
        pt: "Se baixo (< 25 mg/kg): Rotacionar com leguminosa fixadora (soja, trevo) ou adubação de cobertura."
      }
    },
    {
      id: "fosforo",
      titulo: { es: "Fósforo disponible (P)", en: "Available Phosphorus (P)", pt: "Fósforo disponível (P)" },
      icono: "soil",
      que_es: {
        es: "Elemento esencial para el crecimiento de raíces fuertes, floración y transporte de energía celular.",
        en: "Essential mineral for vigorous root establishment, early flowering, and cellular energy storage.",
        pt: "Elemento essencial para enraizamento vigoroso, floração e transporte de energia celular."
      },
      como_se_mide: {
        es: "En tierra: Sensor del robot o prueba Mehlich-3 de laboratorio (mg/kg). Satélite: no medible directamente.",
        en: "On ground: Rover sensor / lab Mehlich-3 extract (mg/kg). Satellite: cannot be detected from orbit.",
        pt: "Em terra: Sensor do robô ou Mehlich-3 laboratorial (mg/kg). Satélite: não detectável do espaço."
      },
      por_que_importa: {
        es: "La falta de fósforo tiñe las hojas jóvenes de morado y deja raíces enanas que no aguantan el viento.",
        en: "Phosphorus deficiency turns young corn leaves purple and leaves roots shallow and vulnerable.",
        pt: "A deficiência de fósforo arroxeia as folhas jovens e deixa raízes superficiais fracas."
      },
      valores_tipicos: {
        es: "16 a 30 mg/kg P (método Bray-1 / Mehlich-3) en suelo agrícola fértil (Fuente: USDA NRCS Agronomy Guide).",
        en: "16 to 30 mg/kg P (Bray-1 / Mehlich-3) in healthy cropland (Source: USDA NRCS Agronomy Guide).",
        pt: "16 a 30 mg/kg P (Mehlich-3) em solos agrícolas férteis (Fonte: USDA NRCS Agronomy Guide)."
      },
      que_hacer_alto: {
        es: "Si está alto (> 45 mg/kg): Detener aportes fosfatados para evitar escorrentía hacia ríos y lagunas.",
        en: "If high (> 45 mg/kg): Cease phosphate fertilizer to protect surrounding streams from runoff.",
        pt: "Se alto (> 45 mg/kg): Parar fosfato para evitar escorrimento para rios e lagoas."
      },
      que_hacer_bajo: {
        es: "Si está bajo (< 15 mg/kg): Localizar fósforo cerca de la línea de siembra y mantener el pH cerca de 6.5.",
        en: "If low (< 15 mg/kg): Band starter phosphorus near seed rows and maintain soil pH near 6.5.",
        pt: "Se baixo (< 15 mg/kg): Aplicar fósforo localizado no sulco de plantio e regular o pH perto de 6.5."
      }
    },
    {
      id: "potasio",
      titulo: { es: "Potasio disponible (K)", en: "Available Potassium (K)", pt: "Potássio disponível (K)" },
      icono: "soil",
      que_es: {
        es: "Regulador del balance de agua celular que abre y cierra los estomas para resistir sequía y frío.",
        en: "Key regulator of plant osmotic pressure and stomatal opening under heat and drought stress.",
        pt: "Regulador do equilíbrio de água celular que abre e fecha estômatos contra seca e frio."
      },
      como_se_mide: {
        es: "En tierra: Sonda iónica del robot (mg/kg). Satélite: no medible de forma directa.",
        en: "On ground: Rover electrode array (mg/kg). Satellite: not directly measurable from space.",
        pt: "Em terra: Sonda iônica do robô (mg/kg). Satélite: não medível do espaço."
      },
      por_que_importa: {
        es: "El potasio da tallos firmes que no se caen antes de la cosecha y protege contra plagas e infecciones.",
        en: "Potassium strengthens stalks against lodging before harvest and boosts disease resistance.",
        pt: "O potássio garante colmos firmes contra acamamento e aumenta a resistência a pragas."
      },
      valores_tipicos: {
        es: "120 a 220 mg/kg de K intercambiable para rotación maíz/soya (Fuente: Iowa State University PM 1688).",
        en: "120 to 220 mg/kg exchangeable K for corn-soy rotations (Source: Iowa State Univ PM 1688).",
        pt: "120 a 220 mg/kg de K trocável para rotação milho/soja (Fonte: Iowa State Univ PM 1688)."
      },
      que_hacer_alto: {
        es: "Si está alto (> 250 mg/kg): Suelo con excelente reserva; suspender aplicaciones y monitorear magnesio.",
        en: "If high (> 250 mg/kg): Strong soil reserve; withhold applications and monitor magnesium balance.",
        pt: "Se alto (> 250 mg/kg): Excelente reserva; suspender aplicação e monitorar magnésio."
      },
      que_hacer_bajo: {
        es: "Si está bajo (< 100 mg/kg): Los bordes de las hojas se queman en seco; aplicar cloruro o sulfato de potasio.",
        en: "If low (< 100 mg/kg): Leaf margins brown and scorch; apply potash or potassium sulfate.",
        pt: "Se baixo (< 100 mg/kg): Bordas das folhas queimam; aplicar cloreto ou sulfato de potássio."
      }
    },
    {
      id: "materia_organica",
      titulo: { es: "Materia orgánica del suelo", en: "Soil organic matter (SOM)", pt: "Matéria orgânica do solo" },
      icono: "soil",
      que_es: {
        es: "Restos descompuestos de raíces, hojas y microorganismos que forman el humus fértil oscuro.",
        en: "Decomposed plant and microbial residues forming dark, spongy soil humus.",
        pt: "Restos decompostos de raízes, folhas e micróbios que formam o húmus fértil escuro."
      },
      como_se_mide: {
        es: "En tierra: Prueba de ignición / oxidación en laboratorio. Mapa base: USDA SSURGO (30 m).",
        en: "On ground: Lab loss-on-ignition test. Regional database: USDA SSURGO (30 m).",
        pt: "Em terra: Ensaio de combustão/oxidação em laboratório. Mapa base: USDA SSURGO (30 m)."
      },
      por_que_importa: {
        es: "Cada 1% de materia orgánica permite que una hectárea retenga hasta 150,000 litros extra de agua de lluvia.",
        en: "Every 1% of SOM allows each hectare to store up to 150,000 extra liters of rainwater.",
        pt: "Cada 1% de matéria orgânica retém até 150.000 litros extras de água de chuva por hectare."
      },
      valores_tipicos: {
        es: "2.5% a 5.0% en los suelos oscuros (Molisoles) del cinturón agrícola (Fuente: USDA NRCS Soil Quality Institute).",
        en: "2.5% to 5.0% in prime Midwest prairie soils (Mollisols) (Source: USDA NRCS Soil Quality Institute).",
        pt: "2.5% a 5.0% nos solos férteis de pradaria (Molisoles) (Fonte: USDA NRCS Soil Quality Institute)."
      },
      que_hacer_alto: {
        es: "Si está alto (> 4.5%): Suelo muy esponjoso con alta fertilidad natural y menor necesidad de riego.",
        en: "If high (> 4.5%): Excellent soil sponge capacity with high natural nutrient cycling.",
        pt: "Se alto (> 4.5%): Solo fértil com alta retenção de água e menor necessidade de adubo."
      },
      que_hacer_bajo: {
        es: "Si está bajo (< 2.0%): Pasar a siembra directa (no-till), sembrar cultivos de cobertura y no quemar rastrojos.",
        en: "If low (< 2.0%): Transition to no-till, keep living cover crops, and leave crop residues.",
        pt: "Se baixo (< 2.0%): Adotar plantio direto, usar culturas de cobertura e manter a palhada."
      }
    },
    {
      id: "textura_suelo",
      titulo: { es: "Textura del suelo (arena, limo, arcilla)", en: "Soil texture", pt: "Textura do solo" },
      icono: "soil",
      que_es: {
        es: "Proporción de granos gruesos (arena), medianos (limo) y microscópicos (arcilla) en la tierra.",
        en: "Relative proportion of coarse sand, medium silt, and fine clay particles.",
        pt: "Proporção de grãos grossos (areia), médios (silte) e microscópicos (argila)."
      },
      como_se_mide: {
        es: "En laboratorio por hidrómetro de sedimentación. En la app: horizontes oficiales USDA SSURGO (0–150 cm).",
        en: "Hydrometer sedimentation in soil lab. Regional baseline: USDA SSURGO horizon profiles (0–150 cm).",
        pt: "Sedimentação em laboratório. Na plataforma: horizontes oficiais USDA SSURGO (0–150 cm)."
      },
      por_que_importa: {
        es: "La textura determina la velocidad de infiltración del agua y qué tan rápido se seca el lote tras una tormenta.",
        en: "Texture sets how fast water infiltrates and how rapidly topsoil dries after storms.",
        pt: "A textura determina a velocidade de infiltração da água e a drenagem do talhão após chuvas."
      },
      valores_tipicos: {
        es: "Suelo franco (20% arcilla, 40% limo, 40% arena) es el más equilibrado para agricultura (Fuente: USDA NRCS Soil Taxonomy).",
        en: "Loam (20% clay, 40% silt, 40% sand) is the gold standard for annual cropping (Source: USDA NRCS).",
        pt: "Solo franco (20% argila, 40% silte, 40% areia) é o mais equilibrado para lavouras (Fonte: USDA NRCS)."
      },
      que_hacer_alto: {
        es: "Si es muy arcilloso (> 40% arcilla): Drenaje lento y riesgo de barro; trabajar solo con humedad adecuada.",
        en: "If heavy clay (> 40%): Slow percolation and mud risk; avoid tillage when wet.",
        pt: "Se muito argiloso (> 40% argila): Drenagem lenta; só trafegar com umidade adequada."
      },
      que_hacer_bajo: {
        es: "Si es muy arenoso (> 70% arena): El agua drena de inmediato; fraccionar los riegos y el fertilizante en dosis pequeñas.",
        en: "If very sandy (> 70%): Fast drainage; apply irrigation and nutrients in frequent light doses.",
        pt: "Se muito arenoso (> 70% areia): Água drena rápido; fracionar regas e adubação."
      }
    },
    {
      id: "ndvi_ndmi",
      titulo: { es: "NDVI y NDMI (Verdor y Humedad del dosel)", en: "NDVI & NDMI indices", pt: "NDVI e NDMI (Verdor e Água na folha)" },
      icono: "leaf",
      que_es: {
        es: "Índices matemáticos calculados con la luz infrarroja y visible que reflejan las hojas sanas hacia el satélite.",
        en: "Satellite spectral ratios comparing near-infrared and visible/SWIR reflectance from leaves.",
        pt: "Índices espectrais comparando a luz infravermelha e visível refletida pelas folhas aos satélites."
      },
      como_se_mide: {
        es: "Satélite Copernicus Sentinel-2 L2A (10 m) y MODIS (250 m). Fórmula: (NIR - Rojo) / (NIR + Rojo).",
        en: "Copernicus Sentinel-2 L2A (10 m) and MODIS (250 m). Formula: (NIR - Red) / (NIR + Red).",
        pt: "Satélite Sentinel-2 L2A (10 m) e MODIS (250 m). Fórmula: (NIR - Vermelho) / (NIR + Vermelho)."
      },
      por_que_importa: {
        es: "Detecta estrés hídrico y plagas días antes de que el ojo humano pueda notar el cambio de color a pie de campo.",
        en: "Detects crop water stress and disease days before human eyes can notice foliage yellowing.",
        pt: "Detecta estresse hídrico e pragas dias antes que o olho humano note a olho nu."
      },
      valores_tipicos: {
        es: "< 0.20 suelo desnudo; 0.30 a 0.50 vegetación moderada; > 0.70 dosel cerrado y sano (Fuente: NASA Earth Observatory).",
        en: "< 0.20 bare dirt; 0.30 to 0.50 moderate cover; > 0.70 dense healthy canopy (Source: NASA Earth Observatory).",
        pt: "< 0.20 solo nu; 0.30 a 0.50 cobertura moderada; > 0.70 dossel fechado (Fonte: NASA Earth Observatory)."
      },
      que_hacer_alto: {
        es: "Si está alto (> 0.75): Cultivo en plenitud de fotosíntesis; asegurar que no le falte agua para el llenado de grano.",
        en: "If high (> 0.75): Full canopy photosynthesis; maintain steady water for grain filling.",
        pt: "Se alto (> 0.75): Fotossíntese plena; garantir água para o enchimento de grãos."
      },
      que_hacer_bajo: {
        es: "Si está bajo (< 0.30) en pleno ciclo: Inspeccionar el sector con el robot para descartar falta de agua, plaga o semilla fallida.",
        en: "If low (< 0.30) mid-season: Dispatch rover to inspect sector for dry soil, pests, or poor stand.",
        pt: "Se baixo (< 0.30) na safra: Inspecionar o talhão com robô para checar falha de germinação ou praga."
      }
    },
    {
      id: "evapotranspiracion",
      titulo: { es: "Evapotranspiración (OpenET)", en: "Evapotranspiration (ET)", pt: "Evapotranspiração (OpenET)" },
      icono: "water",
      que_es: {
        es: "Cantidad total de agua en milímetros que se pierde por evaporación del suelo más la transpiración de las hojas.",
        en: "Total millimeters of water lost through direct soil evaporation plus crop transpiration.",
        pt: "Milímetros totais de água perdidos por evaporação do solo somada à transpiração das folhas."
      },
      como_se_mide: {
        es: "Servicio OpenET (consocio NASA / USGS / Desert Research Institute) combinando satélites Landsat y Sentinel a 30 m.",
        en: "OpenET ensemble (NASA / USGS / DRI) fusing Landsat and Sentinel-2 thermal/optical bands at 30 m.",
        pt: "Serviço OpenET (NASA / USGS / DRI) combinando bandas térmicas e óticas Landsat/Sentinel a 30 m."
      },
      por_que_importa: {
        es: "Es la 'cuenta de cobro' de agua del cultivo: te dice exactamente cuántos milímetros hay que reponer con riego o lluvia.",
        en: "It is the exact water bill of your field, showing how many millimeters of moisture need replenishing.",
        pt: "É a conta de consumo de água do talhão: mostra quantos milímetros precisam ser repostos por chuva ou rega."
      },
      valores_tipicos: {
        es: "Maíz: 500 a 700 mm/temporada; Soya: 450 a 600 mm/temporada en el Medio Oeste (Fuente: OpenET / FAO Irrigation Paper 56).",
        en: "Corn: 500–700 mm/season; Soy: 450–600 mm/season in US Midwest (Source: OpenET / FAO 56).",
        pt: "Milho: 500 a 700 mm/safra; Soja: 450 a 600 mm/safra (Fonte: OpenET / FAO 56)."
      },
      que_hacer_alto: {
        es: "Si es superior a la lluvia: Hay déficit hídrico acumulado; si no hay riego, la planta cerrará estomas y bajará rendimiento.",
        en: "If ET exceeds rainfall: Soil enters water deficit; without irrigation, plants close stomata and yield drops.",
        pt: "Se a ET supera a chuva: Há déficit hídrico; sem rega, a planta fecha estômatos e perde produção."
      },
      que_hacer_bajo: {
        es: "Si es baja en días cálidos: Indica que la planta no puede transpirar por falta de agua en raíz o raíz enferma.",
        en: "If unexpectedly low on hot sunny days: Roots cannot draw water due to soil drought or root rot.",
        pt: "Se baixa em dias quentes: Raiz não consegue transpirar por seca no solo ou doença radicular."
      }
    },
    {
      id: "grados_dia",
      titulo: { es: "Grados-día de desarrollo (GDD)", en: "Growing Degree Days (GDD)", pt: "Graus-dia de desenvolvimento (GDD)" },
      icono: "sun",
      que_es: {
        es: "Medida térmica que suma el calor diario útil que acumula la planta por encima de su temperatura base.",
        en: "Thermal heat accumulation calculated above the crop's minimum baseline growth temperature.",
        pt: "Soma térmica diária de calor acumulado pela planta acima da temperatura basal de crescimento."
      },
      como_se_mide: {
        es: "Histórico NASA POWER y pronóstico Meteomatics: [(Tmax + Tmin) / 2] - Tbase (Tbase = 10 °C para maíz).",
        en: "NASA POWER historical + Meteomatics: [(Tmax + Tmin) / 2] - 10 °C for maize.",
        pt: "NASA POWER histórico + Meteomatics: [(Tmax + Tmin) / 2] - 10 °C para milho."
      },
      por_que_importa: {
        es: "Permite saber la fecha exacta de floración y madurez del grano mucho mejor que contar días de calendario.",
        en: "Predicts exact tasseling, silking, and maturity dates far more accurately than calendar days.",
        pt: "Permite prever a data exata de florescimento e maturação melhor do que dias no calendário."
      },
      valores_tipicos: {
        es: "2400 a 2800 GDD base 10 °C para híbridos de maíz de ciclo completo en Iowa (Fuente: Pioneer / ISU Agronomy).",
        en: "2400 to 2800 GDD (base 50 °F) for full-season Corn Belt hybrids (Source: ISU Agronomy).",
        pt: "2400 a 2800 GDD base 10 °C para milho ciclo completo (Fonte: ISU Agronomy)."
      },
      que_hacer_alto: {
        es: "Si acumula GDD rápido: El cultivo madurará antes de lo previsto; adelantar la logística de cosecha.",
        en: "If GDD accumulates fast: Crop will mature earlier than expected; advance harvest equipment prep.",
        pt: "Se acumula GDD rápido: A lavoura vai madurar antes; antecipar a logística de colheita."
      },
      que_hacer_bajo: {
        es: "Si el año es frío: Riesgo de que la primera helada de otoño alcance al grano antes de que complete el llenado.",
        en: "If year is abnormally cool: Fall freeze risk before physiological black layer maturity.",
        pt: "Se o ano é frio: Risco de geada precoce de outono atingir grãos ainda verdes."
      }
    },
    {
      id: "helada",
      titulo: { es: "Riesgo de helada", en: "Frost risk", pt: "Risco de geada" },
      icono: "snow",
      que_es: {
        es: "Descenso de la temperatura del aire a 0 °C o menos que congela los tejidos de las plantas tiernas.",
        en: "Air temperature drop to 0 °C (32 °F) or below, freezing plant cell fluids.",
        pt: "Queda da temperatura do ar a 0 °C ou menos congelando tecidos de plantas jovens."
      },
      como_se_mide: {
        es: "Pronóstico Meteomatics (parámetro t_min_2m_24h a 1 km) y estaciones meteorológicas terrestres USGS/NOAA.",
        en: "Meteomatics 1 km model parameter t_min_2m_24h and ground weather networks.",
        pt: "Previsão Meteomatics (t_min_2m_24h a 1 km) e estações meteorológicas em solo."
      },
      por_que_importa: {
        es: "Una helada tardía en primavera destruye plántulas recién nacidas; una helada temprana en otoño mata el follaje.",
        en: "A late spring frost kills emerged seedlings; an early autumn frost terminates grain fill.",
        pt: "Geada tardia na primavera mata plântulas recém-nascidas; geada precoce no outono mata a folhagem."
      },
      valores_tipicos: {
        es: "0 °C helada superficial leve; ≤ -2.2 °C helada dura letal para tejidos de maíz y soya (Fuente: NOAA NWS Frost Guide).",
        en: "0 °C light frost; ≤ -2.2 °C (28 °F) hard killing freeze for maize and soybean (Source: NOAA NWS).",
        pt: "0 °C geada leve; ≤ -2.2 °C geada severa letal para tecidos de milho e soja (Fonte: NOAA NWS)."
      },
      que_hacer_alto: {
        es: "Si hay alerta de helada: Mantener el suelo húmedo (el agua guarda calor) y no realizar laboreos previos.",
        en: "If frost warned: Keep soil moist (wet soil holds more thermal energy) and avoid recent tillage.",
        pt: "Se há alerta de geada: Manter o solo úmido (água retém calor) e não revolver a terra."
      },
      que_hacer_bajo: {
        es: "Sin helada en 7 días: Ventana segura para aplicaciones foliares y labores de siembra.",
        en: "No frost expected: Safe operational window for sowing and spray passes.",
        pt: "Sem geada em 7 dias: Janela segura para semeadura e tratos culturais."
      }
    },
    {
      id: "deficit_agua",
      titulo: { es: "Déficit de agua", en: "Water deficit", pt: "Déficit de água" },
      icono: "water",
      que_es: {
        es: "Diferencia negativa entre la lluvia que cae y la evapotranspiración que el cultivo demanda para no estresarse.",
        en: "Negative balance between rainfall received and the water demand required by the crop.",
        pt: "Diferença negativa entre a chuva recebida e a demanda evaporativa da lavoura."
      },
      como_se_mide: {
        es: "Balance mensual NASA POWER (lluvia en mm) menos OpenET (consumo en mm).",
        en: "Monthly subtraction of NASA POWER precipitation (mm) minus OpenET actual consumption (mm).",
        pt: "Subtração mensal de chuva NASA POWER (mm) menos consumo OpenET (mm)."
      },
      por_que_importa: {
        es: "Cuando el déficit agota la reserva del suelo, el cultivo aborta flores y reduce drásticamente el número de granos.",
        en: "When deficit exhausts available soil moisture, crops abort kernels and slash final harvest yields.",
        pt: "Quando o déficit esgota a reserva do solo, a planta aborta flores e reduz drasticamente os grãos."
      },
      valores_tipicos: {
        es: "En secano, déficits mayores a 100 mm durante floración provocan mermas de hasta 40% (Fuente: FAO Irrigation & Drainage 33).",
        en: "Deficits exceeding 100 mm during pollination trigger up to 40% yield loss in rainfed corn (Source: FAO 33).",
        pt: "Déficits maiores que 100 mm na floração causam perdas de até 40% em sequeiro (Fonte: FAO 33)."
      },
      que_hacer_alto: {
        es: "Si el déficit crece: Activar riego suplementario o sembrar cultivos resistentes a sequía como sorgo o mijo.",
        en: "If deficit expands: Trigger supplemental irrigation or rotate into drought-resilient grain sorghum.",
        pt: "Se o déficit sobe: Ativar irrigação ou plantar culturas resistentes como sorgo."
      },
      que_hacer_bajo: {
        es: "Balance positivo (lluvia > consumo): El suelo recarga su perfil subterráneo para las semanas siguientes.",
        en: "Positive balance: Rain recharges deep root-zone storage for future weeks.",
        pt: "Balanço positivo: Chuva recarrega a reserva subterrânea para as próximas semanas."
      }
    },
    {
      id: "rotacion_cultivos",
      titulo: { es: "Rotación de cultivos", en: "Crop rotation", pt: "Rotação de culturas" },
      icono: "compass",
      que_es: {
        es: "Práctica de alternar diferentes familias de plantas en el mismo terreno en temporadas sucesivas.",
        en: "Practice of alternating plant botanical families on the same parcel across successive seasons.",
        pt: "Prática de alternar diferentes famílias botânicas no mesmo terreno em safras sucessivas."
      },
      como_se_mide: {
        es: "Historial de cultivos anuales USDA NASS CDL (30 m, 2008–2021) y libreta de campo del productor.",
        en: "Historical USDA NASS Cropland Data Layer (30 m) plus producer field logs.",
        pt: "Histórico USDA NASS CDL (30 m) e anotações da caderneta de campo do produtor."
      },
      por_que_importa: {
        es: "Rompe los ciclos biológicos de malezas, hongos y plagas, y recarga nitrógeno natural al suelo sin gastar en químicos.",
        en: "Breaks weed, fungal, and insect lifecycles while fixing free atmospheric nitrogen through legumes.",
        pt: "Quebra ciclos biológicos de pragas e fungos e fixa nitrogênio natural sem gastar adubo químico."
      },
      valores_tipicos: {
        es: "Rotación Maíz-Soya rinde entre 10% y 15% más que monocultivo continuo de maíz en Iowa (Fuente: ISU Extension Agronomy).",
        en: "Corn-Soybean rotations yield 10% to 15% higher than continuous corn in long-term Iowa trials (Source: ISU).",
        pt: "Rotação Milho-Soja rende de 10% a 15% a mais do que monocultura contínua de milho (Fonte: ISU Extension)."
      },
      que_hacer_alto: {
        es: "Rotación diversificada (3 o 4 familias): Máxima salud del suelo y menor riesgo financiero frente al clima.",
        en: "Diversified rotation (3–4 crop families): Peak soil biology and minimized market/weather vulnerability.",
        pt: "Rotação diversificada (3–4 famílias): Máxima saúde do solo e menor risco de mercado."
      },
      que_hacer_bajo: {
        es: "Monocultivo repetido: Aumenta la presión de gusano de la raíz del maíz y agota nutrientes específicos.",
        en: "Continuous monoculture: Elevates rootworm pest pressure and depletes specific soil nutrient zones.",
        pt: "Monocultura repetida: Aumenta pressão de pragas radiculares e esgota nutrientes específicos."
      }
    },
    {
      id: "ia_vs_medicion",
      titulo: { es: "Predicción de SI vs. Medición real", en: "AI Prediction vs. True Measurement", pt: "Previsão de SI vs. Medição real" },
      icono: "ai",
      que_es: {
        es: "Una estimación estadística de probabilidad aprendida con datos pasados, nunca una prueba física directa.",
        en: "A statistical estimate based on historical pattern recognition, never a direct physical measurement.",
        pt: "Uma estimativa estatística de probabilidade aprendida com dados passados, nunca uma medição física."
      },
      como_se_mide: {
        es: "Modelo de Gradient Boosting (M1) entrenado con 6 escenas Sentinel-2 L2A cruzadas con mapas USDA CDL en Iowa.",
        en: "Gradient Boosting tree model (M1) trained on 6 Sentinel-2 L2A scenes validated against USDA CDL maps.",
        pt: "Modelo Gradient Boosting (M1) treinado com 6 cenas Sentinel-2 validadas contra mapas USDA CDL."
      },
      por_que_importa: {
        es: "Un satélite y un algoritmo pueden confundir malezas densas con un cultivo o nubes con suelo seco: siempre debe confirmarse a pie.",
        en: "Algorithms can mistake thick weeds for crops or residual cloud edges for drought: field scouting is essential.",
        pt: "Satélites e algoritmos podem confundir mato com lavoura: a vistoria a pé no campo é indispensável."
      },
      valores_tipicos: {
        es: "Acierto medido real: 77.7% en bloques espaciales nunca vistos de Iowa, Illinois, Nebraska y Minnesota (86.6% en maíz/soya). Fuera de esas zonas: no validado (Fuente: Terra Lab Benchmarks 2026).",
        en: "Measured cross-validation accuracy: 77.7% on unseen spatial blocks in Iowa, Illinois, Nebraska and Minnesota (86.6% for corn/soy). Unvalidated elsewhere (Source: Terra Lab 2026).",
        pt: "Acurácia real medida: 77.7% em blocos nunca vistos em Iowa, Illinois, Nebraska e Minnesota (86.6% milho/soja). Fora dessas zonas: não validado (Fonte: Terra Lab 2026)."
      },
      que_hacer_alto: {
        es: "Alta confianza (> 85%): Gran probabilidad de acierto, útil para guiar la ruta del robot y priorizar zonas.",
        en: "High model confidence (> 85%): Strong signal, ideal for routing robot sampling paths.",
        pt: "Alta confiança (> 85%): Forte probabilidade, útil para guiar o robô nos pontos críticos."
      },
      que_hacer_bajo: {
        es: "Confianza baja o zona sin cobertura: Tomar la predicción como orientación hipotética y basar decisiones en sensores físicos.",
        en: "Low confidence or unvalidated region: Treat prediction as advisory and rely strictly on physical sensors.",
        pt: "Baixa confiança ou fora de validação: Usar como sugestão e decidir por sensores de terra."
      }
    },
    {
      id: "salinidad_balance",
      titulo: { es: "Salinidad y balance iónico", en: "Salinity & ion balance", pt: "Salinidade e equilíbrio iônico" },
      icono: "soil",
      que_es: {
        es: "Equilibrio entre sales benéficas (calcio, magnesio, potasio) y sales dañinas (sodio) en el agua del suelo.",
        en: "Equilibrium between beneficial soil cations (Ca, Mg, K) and toxic sodium salts (Na).",
        pt: "Equilíbrio entre sais benéficos (cálcio, magnésio, potássio) e sais tóxicos (sódio) no solo."
      },
      como_se_mide: {
        es: "En tierra: Sensor de conductividad eléctrica (EC) del robot junto a relación de adsorción de sodio (SAR).",
        en: "On ground: Rover electrical conductivity sensor paired with Sodium Adsorption Ratio (SAR).",
        pt: "Em terra: Sensor de condutividade elétrica (EC) do robô junto com Razão de Adsorção de Sódio (SAR)."
      },
      por_que_importa: {
        es: "El exceso de sodio desmorona la estructura del suelo, formando una costra dura e impermeable que asfixia la raíz.",
        en: "Excess sodium disperses clay particles, forming an impermeable surface crust that chokes roots.",
        pt: "O excesso de sódio desfaz os agregados do solo, formando uma crosta dura impermeável."
      },
      valores_tipicos: {
        es: "Relación SAR < 13 y EC < 4.0 mS/cm define suelos no afectados por sales (Fuente: USDA Agricultural Handbook 60).",
        en: "SAR < 13 and EC < 4.0 mS/cm define healthy non-saline/non-sodic ground (Source: USDA Handbook 60).",
        pt: "SAR < 13 e EC < 4.0 mS/cm define solos não sódicos e saudáveis (Fonte: USDA Handbook 60)."
      },
      que_hacer_alto: {
        es: "Si hay exceso de sodio: Aplicar sulfato de calcio (yeso) para desplazar el sodio y lavar con agua de riego.",
        en: "If high sodium: Apply calcium sulfate (gypsum) to displace sodium ions and flush with irrigation.",
        pt: "Se alto em sódio: Aplicar gesso agrícola para desalojar o sódio e lavar o solo."
      },
      que_hacer_bajo: {
        es: "Balance iónico equilibrado: El suelo mantiene buena porosidad y permeabilidad para las raíces.",
        en: "Balanced ions: Soil aggregates remain open, airy, and permeable to root systems.",
        pt: "Equilíbrio adequado: O solo mantém boa aeração e infiltração para as raízes."
      }
    }
  ];

  const V2Conceptos = {
    searchTerm: "",

    renderWorkspaceHtml() {
      const lang = window.V2?.lang || "es";
      const q = (this.searchTerm || "").toLowerCase().trim();
      const filtered = CONCEPTOS_DATA.filter(c => {
        if (!q) return true;
        const tit = (c.titulo[lang] || c.titulo.es).toLowerCase();
        const que = (c.que_es[lang] || c.que_es.es).toLowerCase();
        const med = (c.como_se_mide[lang] || c.como_se_mide.es).toLowerCase();
        return tit.includes(q) || que.includes(q) || med.includes(q);
      });

      return `
        <div class="workspace-inner conceptos-workspace-inner">
          <div class="card conceptos-hero-card">
            <div class="row-between" style="margin-bottom:8px">
              <div style="display:flex;align-items:center;gap:10px">
                <span class="sem-domain-ic vigor" style="width:36px;height:36px">
                  ${window.ic("book", "lg")}
                </span>
                <div>
                  <h1 style="font-size:20px;font-weight:700;margin:0">
                    ${lang === "en" ? "Concepts guide" : lang === "pt" ? "Guia de conceitos" : "Guía de conceptos"}
                  </h1>
                  <div class="xs mut">${lang === "en" ? "To understand and learn, not to decide." : "Para entender y aprender, no para decidir."}</div>
                </div>
              </div>
              <span class="chip" style="font-weight:700">${CONCEPTOS_DATA.length} conceptos</span>
            </div>

            <p class="small mut" style="margin:0 0 12px">
              Cada concepto responde 5 preguntas concretas: qué es, cómo se mide, por qué importa, sus valores típicos citados y qué hacer si está alto o bajo.
            </p>

            <!-- Buscador reactivo de conceptos -->
            <div class="search-bar" style="max-width:100%">
              ${window.ic("search", "sm")}
              <input type="search" id="v2-con-search-q" placeholder="Buscar concepto (humedad, pH, nitrógeno, NDVI, SI, helada, evapotranspiración…)…" value="${window.esc(this.searchTerm)}">
            </div>
          </div>

          <!-- Grilla de Tarjetas Expandibles de Conceptos -->
          <div class="conceptos-grid" style="display:flex;flex-direction:column;gap:10px">
            ${filtered.length === 0 ? `
              <div class="notice atencion" style="padding:16px;text-align:center">
                ${window.ic("atencion", "lg")}
                <div style="flex:1">
                  <b>No se encontró ningún concepto para «${window.esc(this.searchTerm)}»</b>
                  <div class="xs mut" style="margin-top:2px">Prueba buscando por sensor, satélite o nutriente.</div>
                </div>
              </div>
            ` : filtered.map(c => {
              const tit = c.titulo[lang] || c.titulo.es;
              const que = c.que_es[lang] || c.que_es.es;
              const med = c.como_se_mide[lang] || c.como_se_mide.es;
              const imp = c.por_que_importa[lang] || c.por_que_importa.es;
              const val = c.valores_tipicos[lang] || c.valores_tipicos.es;
              const alto = c.que_hacer_alto[lang] || c.que_hacer_alto.es;
              const bajo = c.que_hacer_bajo[lang] || c.que_hacer_bajo.es;

              return `
                <details class="card concepto-card-exp" id="c_${c.id}" style="padding:14px 16px">
                  <summary style="font-weight:700;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px">
                    <div style="display:flex;align-items:center;gap:8px">
                      <span class="sem-domain-ic" style="width:28px;height:28px">
                        ${window.ic(c.icono || "info", "sm")}
                      </span>
                      <span>${window.esc(tit)}</span>
                    </div>
                    <span class="xs mut" style="font-weight:500">Ver 5 puntos ↓</span>
                  </summary>

                  <div class="concepto-card-content" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--linea);display:flex;flex-direction:column;gap:10px">
                    <div>
                      <b class="xs mut" style="text-transform:uppercase;letter-spacing:0.04em">1. ¿Qué es?</b>
                      <p class="small" style="margin:2px 0 0;line-height:1.45">${window.esc(que)}</p>
                    </div>

                    <div>
                      <b class="xs mut" style="text-transform:uppercase;letter-spacing:0.04em">2. ¿Cómo se mide?</b>
                      <p class="small" style="margin:2px 0 0;line-height:1.45">${window.esc(med)}</p>
                    </div>

                    <div>
                      <b class="xs mut" style="text-transform:uppercase;letter-spacing:0.04em">3. ¿Por qué importa?</b>
                      <p class="small" style="margin:2px 0 0;line-height:1.45">${window.esc(imp)}</p>
                    </div>

                    <div class="card-sub" style="padding:10px 12px">
                      <b class="xs mut" style="text-transform:uppercase;letter-spacing:0.04em">4. Valores típicos con fuente citada:</b>
                      <p class="small" style="margin:2px 0 0;line-height:1.45"><b>${window.esc(val)}</b></p>
                    </div>

                    <div class="grid-2 small" style="gap:8px">
                      <div class="notice atencion" style="padding:8px 10px;margin:0">
                        <div>
                          <b class="xs">5A. ¿Qué hacer si está alto?</b>
                          <div class="xs" style="margin-top:2px">${window.esc(alto)}</div>
                        </div>
                      </div>
                      <div class="notice atencion" style="padding:8px 10px;margin:0">
                        <div>
                          <b class="xs">5B. ¿Qué hacer si está bajo?</b>
                          <div class="xs" style="margin-top:2px">${window.esc(bajo)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              `;
            }).join("")}
          </div>
        </div>
      `;
    },

    abrirConcepto(id) {
      this.searchTerm = "";
      const inp = document.getElementById("v2-con-search-q");
      if (inp) inp.value = "";
      if (window.V2) window.V2.renderActiveViews();
      setTimeout(() => {
        const el = document.getElementById(`c_${id}`) || document.getElementById(id) || document.querySelector(`[id*="${id}"]`);
        if (el) {
          el.open = true;
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 120);
    },

    bindEvents() {
      document.addEventListener("input", (e) => {
        if (e.target.id === "v2-con-search-q") {
          this.searchTerm = e.target.value;
          if (window.V2.space === "conceptos") {
            window.V2.renderActiveViews();
            const f = document.getElementById("v2-con-search-q");
            if (f) {
              f.focus();
              f.setSelectionRange(f.value.length, f.value.length);
            }
          }
        }
      });
    }
  };

  window.V2Conceptos = V2Conceptos;
  V2Conceptos.bindEvents();
})();

