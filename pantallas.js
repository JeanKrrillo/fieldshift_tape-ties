// =============================================================================
// Terra Lab v2 (Cápsula D) — Renderizado de las 11 Pantallas
// =============================================================================

(function () {
  "use strict";

  const g = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const m = (es, en, pt) => (window.V2?.lang === "en" ? en : window.V2?.lang === "pt" ? pt : es);

  // Sello de procedencia único para toda cifra: de dónde sale, de qué fecha es el dato, a qué resolución y si es
  // medición, estimación, predicción o regla del equipo. La fecha es la del dato; si viene de la copia guardada, se dice.
  function fuente({ fuente, fecha, resolucion, tipo, detalle, cache }) {
    const guardado = cache ? trf(cache.vencido ? "src_saved_old" : "src_saved", { f: String(cache.guardado_el || "").slice(0, 10) }) : "";
    const partes = [fuente, fecha, resolucion, tipo ? tr("src_" + tipo) : "", guardado].filter(Boolean);
    const info = [detalle, partes.join(" · "), cache?.motivo ? trf("src_why", { m: cache.motivo }) : ""].filter(Boolean).join(" — ");
    return `<button type="button" class="src-tag${cache?.vencido ? " src-saved" : ""}" data-src-info="${esc(info)}" title="${esc(info)}">${ic("info", "sm")} <span>${esc(partes.join(" · "))}</span></button>`;
  }
  window.fuente = fuente;

  function srcTag(sourceName, dateOrRes, detailText) {
    return fuente({ fuente: sourceName, fecha: dateOrRes, detalle: detailText });
  }

  function semCard(status, domainCls, domainIc, title, word, bigVal, unit, targetTxt, gaugePct, phrase, sourceHtml, techHtml) {
    const st = status || "nodata";
    const iconName = st === "ok" ? "ok" : st === "atencion" ? "atencion" : st === "riesgo" ? "riesgo" : "info";
    const pct = Math.max(4, Math.min(100, Math.round(gaugePct ?? 50)));
    return `
      <article class="sem-card" data-status="${esc(st)}">
        <div class="sem-head">
          <div class="sem-title-group">
            <span class="sem-domain-ic ${esc(domainCls)}">${ic(domainIc, "sm")}</span>
            <span class="sem-title-txt" title="${esc(title)}">${esc(title)}</span>
          </div>
          <span class="sem-badge ${esc(st)}">${ic(iconName, "sm")} <span>${esc(word)}</span></span>
        </div>
        <div class="sem-readout-row">
          <div class="sem-num">${esc(bigVal)}${unit ? ` <small>${esc(unit)}</small>` : ""}</div>
          ${targetTxt ? `<span class="sem-target">${esc(targetTxt)}</span>` : ""}
        </div>
        <div class="sem-gauge-track" aria-hidden="true">
          <div class="sem-gauge-fill ${esc(st)}" style="width:${st === "nodata" ? 0 : pct}%"></div>
        </div>
        <p class="sem-phrase">${esc(phrase)}</p>
        ${techHtml ? `<div class="lv-agr xs mut">${techHtml}</div>` : ""}
        <div class="sem-foot">${sourceHtml}</div>
      </article>
    `;
  }

  function fmtCoordNice(lat, lon) {
    if (lat == null || lon == null) return "";
    const ns = lat >= 0 ? "N" : "S";
    const ew = lon >= 0 ? "E" : "W";
    return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lon).toFixed(4)}° ${ew}`;
  }

  const V2Screens = {
    // -------------------------------------------------------------------------
    // PANTALLA 2 (Hoja Inferior Tab 1): Resumen del lugar en 5 segundos
    // -------------------------------------------------------------------------
    renderPlaceSummary() {
      const D = window.V2.D;
      const loc = window.V2.loc;
      if (!D || !loc) {
        return `
          <div class="card" style="text-align:center;padding:24px 16px">
            <h2 class="card-title" style="justify-content:center">${ic("compass", "lg")} <span>${esc(tr("sum_empty_title"))}</span></h2>
            <p class="small mut" style="margin:0 0 16px">${esc(tr("sum_empty_sub"))}</p>
            <div class="row-wrap" style="justify-content:center">
              <button type="button" class="btn btn-pri" data-action="abrir-ubicacion">${ic("draw", "sm")} <span>${esc(tr("add_field"))}</span></button>
              <button type="button" class="btn btn-sec" data-action="gps">${ic("gps", "sm")} <span>${esc(tr("w_gps"))}</span></button>
            </div>
          </div>
        `;
      }

      const o = D.telemetria_oficial_en_vivo || {};
      const h1 = g(D, "decisiones_3_horizontes.horizonte_1_hoy_7_dias") || {};
      const pw = g(o, "nasa_power_v10.resumen_anual") || {};
      const ss = o.usda_nrcs_ssurgo || {};
      const et = g(o, "openet_api.et_acumulada_temporada_mm");
      const pr = g(o, "usda_ams_market_news.precios") || [];
      const corn = pr.find(p => p.producto === "Corn");
      const soy = pr.find(p => p.producto === "Soybeans");
      const ter = window.V2.terrainResp;

      // 1) Semáforo de Agua y lluvia
      const rz = pw.humedad_zona_radicular_media_pct;
      const rainFmt = fmtRain(pw.precipitacion_anual_mm, 0);
      const waterSt = rz == null ? "nodata" : (rz < window.V2.thresholds.droughtPct || rz > window.V2.thresholds.excessPct) ? "riesgo" : rz < 45 ? "atencion" : "ok";
      const waterWord = waterSt === "ok" ? tr("st_ok_word") : waterSt === "atencion" ? tr("st_warn_word") : waterSt === "riesgo" ? tr("st_risk_word") : tr("st_nodata_word");
      const waterPhrase = rz == null
        ? tr("nodata")
        : waterSt === "ok"
        ? (window.V2.lang === "en" ? "Root zone has steady moisture for the crop." : window.V2.lang === "pt" ? "A zona da raiz tem umidade firme para a cultura." : "La zona de la raíz tiene buena humedad para el cultivo.")
        : waterSt === "atencion"
        ? (window.V2.lang === "en" ? "Moderate root moisture; watch rainfall closely." : window.V2.lang === "pt" ? "Umidade moderada na raiz; acompanhe a chuva." : "Humedad moderada en la raíz; vigila la lluvia.")
        : (window.V2.lang === "en" ? "Root moisture outside safe range (drought or excess)." : window.V2.lang === "pt" ? "Umidade na raiz fora da faixa segura." : "Humedad en la raíz fuera del rango seguro.");

      // 2) Semáforo de Verdor del terreno
      const ndvi = ter?.ndvi_promedio;
      const barePct = ter?.pct_celdas_bajo_030;
      const vigSt = ndvi == null ? "nodata" : (ndvi < 0.30 || (barePct != null && barePct > 35)) ? "riesgo" : ndvi < 0.50 ? "atencion" : "ok";
      const vigWord = vigSt === "ok" ? tr("st_ok_word") : vigSt === "atencion" ? tr("st_warn_word") : vigSt === "riesgo" ? tr("st_risk_word") : tr("st_nodata_word");
      const vigPhrase = ndvi == null
        ? (window.V2.lang === "en" ? "Draw your land to measure plant greenness." : window.V2.lang === "pt" ? "Desenhe seu terreno para medir o verdor." : "Dibuja tu terreno para medir el verdor lote por lote.")
        : vigSt === "ok"
        ? (window.V2.lang === "en" ? "Plants cover the ground well across your field." : window.V2.lang === "pt" ? "As plantas cobrem bem o solo no talhão." : "Las plantas cubren bien el suelo en tu terreno.")
        : (window.V2.lang === "en" ? `${barePct ?? "—"}% of cells have little plant cover.` : window.V2.lang === "pt" ? `${barePct ?? "—"}% dos quadros têm pouca cobertura.` : `${barePct ?? "—"}% de los cuadros tienen poca cobertura.`);

      // 3) Semáforo de Frío y helada (próximos 7 días)
      const fm = g(o, "meteomatics_weather_1km.pronostico_7_dias_1km.data")?.find(p => p.parameter === "t_min_2m_24h:C");
      const fVals = (g(fm, "coordinates.0.dates") || []).map(x => x.value).filter(x => x != null);
      const min7 = fVals.length ? Math.min(...fVals) : null;
      const frostNights = fVals.filter(x => x <= window.V2.thresholds.frostC).length;
      const minFmt = fmtTemp(min7, 1);
      const frostSt = min7 == null ? "nodata" : min7 <= -2 ? "riesgo" : min7 <= window.V2.thresholds.frostC ? "atencion" : "ok";
      const frostWord = frostSt === "ok" ? tr("st_ok_word") : frostSt === "atencion" ? tr("st_warn_word") : frostSt === "riesgo" ? tr("st_risk_word") : tr("st_nodata_word");
      const frostPhrase = min7 == null
        ? tr("nodata")
        : frostNights === 0
        ? (window.V2.lang === "en" ? "No frost expected in the next 7 days." : window.V2.lang === "pt" ? "Sem geada prevista nos próximos 7 dias." : "No se espera helada en los próximos 7 días.")
        : (window.V2.lang === "en" ? `${frostNights} night(s) at or below freezing.` : window.V2.lang === "pt" ? `${frostNights} noite(s) com risco de geada.` : `${frostNights} noche(s) a 0 °C o menos.`);

      const locKindBadge = loc.kind === "demo"
        ? `<span class="demo-tag">${ic("atencion", "sm")} <span>${esc(tr("demo_badge"))}</span></span>`
        : `<span class="chip">${ic("gps", "sm")} <span>${esc(loc.kind === "real" ? tr("real_badge") : tr("sim_badge"))}</span></span>`;

      const outUsBanner = !window.V2.inUS(loc.lat, loc.lon) && !window.V2.outsideUsDismissed
        ? `
          <div class="notice atencion" style="margin-bottom:12px">
            <div>${ic("atencion", "lg")}</div>
            <div style="flex:1">
              <div class="small">${esc(tr("outside_us_msg"))}</div>
              <div class="row-wrap" style="margin-top:8px">
                <button type="button" class="btn btn-txt btn-sm" data-dismiss-outside="1">OK</button>
              </div>
            </div>
          </div>
        `
        : "";

      const tempYrFmt = fmtTemp(pw.temp_media_anual_c, 1);
      const soilWVal = ss.agua_disponible_0_100cm_mm;
      const soilWFmt = fmtRain(soilWVal, 0);
      const etFmt = fmtRain(et, 0);

      // 4) Semáforo de Suelo y reserva en la raíz (USDA SSURGO)
      const drainTxt = window.trDrainage ? window.trDrainage(ss.drenaje) : (ss.drenaje || "");
      const soilSt = soilWVal == null ? "nodata" : soilWVal < 90 ? "riesgo" : soilWVal < 140 ? "atencion" : "ok";
      const soilWord = soilSt === "ok" ? tr("st_ok_word") : soilSt === "atencion" ? tr("st_warn_word") : soilSt === "riesgo" ? tr("st_risk_word") : tr("st_nodata_word");
      const soilPhrase = soilWVal == null
        ? (ss.cobertura_encontrada === false
          ? (window.V2.lang === "en" ? "USDA SSURGO covers the US only." : window.V2.lang === "pt" ? "USDA SSURGO cobre apenas os EUA." : "USDA SSURGO solo cubre EE. UU.")
          : tr("nodata"))
        : soilSt === "ok"
        ? (window.V2.lang === "en" ? `Deep water reserve (${drainTxt || "good drainage"}).` : window.V2.lang === "pt" ? `Boa reserva de água (${drainTxt || "boa drenagem"}).` : `Buena reserva de agua en raíz (${drainTxt || "buen drenaje"}).`)
        : (window.V2.lang === "en" ? `Limited soil reserve (${drainTxt || "watch moisture"}).` : window.V2.lang === "pt" ? `Reserva limitada no solo (${drainTxt || "atenção"}).` : `Reserva limitada en el suelo (${drainTxt || "cuidar humedad"}).`);

      const defaultPlaceTitle = ss.nombre_serie_suelo
        ? `${window.V2.lang === "en" ? "Parcel · Soil" : "Parcela · Suelo"} ${ss.nombre_serie_suelo}`
        : (window.V2.lang === "en" ? "Selected map parcel" : window.V2.lang === "pt" ? "Parcela selecionada no mapa" : "Parcela seleccionada en el mapa");
      const placeTitle = (loc.label && !/^-?\d+\.\d+/.test(loc.label.trim())) ? loc.label : defaultPlaceTitle;

      const waterGauge = rz != null ? Math.min(100, Math.max(8, Math.round(rz))) : 20;
      const vigGauge = ndvi != null ? Math.min(100, Math.max(8, Math.round(ndvi * 100))) : 20;
      const frostGauge = min7 != null ? Math.min(100, Math.max(10, Math.round(((min7 + 10) / 30) * 100))) : 20;
      const soilGauge = soilWVal != null ? Math.min(100, Math.max(10, Math.round((soilWVal / 220) * 100))) : 20;

      const summaryGuide = window.V2.lang === "en"
        ? `
          <div class="guide-box">
            <div class="guide-box-title">
              <span>${ic("info", "sm")} What are you looking at & what can you do?</span>
              <button type="button" class="btn-txt xs" data-open-modal="glossary" style="font-weight:700;color:var(--primario);cursor:pointer;border:0;background:none">Glossary →</button>
            </div>
            <div>These <b>4 satellite gauges</b> summarize water, plant cover, 7-day frost risk, and soil reserve for this field. On the map, your parcel is divided into <b>numbered squares (#1, #2…)</b> measured at 10 m resolution.</div>
            <div class="guide-steps">
              <span class="guide-step"><b>Option 1:</b> Click any square on the map to inspect that sector</span>
              <span class="guide-step"><b>Option 2:</b> Go to <b>2. My Field</b> to draw or change square size (5–50 m)</span>
              <span class="guide-step"><b>Option 3:</b> Go to <b>Decide</b> (left menu) for crop rotation & profit</span>
            </div>
          </div>
        `
        : window.V2.lang === "pt"
        ? `
          <div class="guide-box">
            <div class="guide-box-title">
              <span>${ic("info", "sm")} O que você está vendo e quais são as opções?</span>
              <button type="button" class="btn-txt xs" data-open-modal="glossary" style="font-weight:700;color:var(--primario);cursor:pointer;border:0;background:none">Glossário →</button>
            </div>
            <div>Estes <b>4 medidores de satélite</b> resumem água, cobertura vegetal, frio (7 dias) e solo. No mapa, o terreno está dividido em <b>setores numerados (#1, #2…)</b> medidos a cada 10 m.</div>
            <div class="guide-steps">
              <span class="guide-step"><b>Opção 1:</b> Clique em um quadro no mapa para ver seu diagnóstico</span>
              <span class="guide-step"><b>Opção 2:</b> Vá em <b>2. Terreno</b> para desenhar ou mudar o tamanho dos quadros (5–50 m)</span>
              <span class="guide-step"><b>Opção 3:</b> Vá em <b>Decidir</b> para rotação e lucro</span>
            </div>
          </div>
        `
        : `
          <div class="guide-box">
            <div class="guide-box-title">
              <span>${ic("info", "sm")} ¿Qué estás viendo y qué opciones tienes?</span>
              <button type="button" class="btn-txt xs" data-open-modal="glossary" style="font-weight:700;color:var(--primario);cursor:pointer;border:0;background:none">Ver glosario →</button>
            </div>
            <div>Estos <b>4 medidores satelitales</b> evalúan el estado actual de tu parcela. En el mapa de la derecha, el terreno está dividido en <b>sectores numerados (#1, #2…)</b> leídos por el satélite Sentinel-2 cada 10 metros.</div>
            <div class="guide-steps">
              <span class="guide-step"><b>1.</b> Haz clic en cualquier cuadro del mapa para diagnosticar ese sector</span>
              <span class="guide-step"><b>2.</b> Abre <b>2. Mi terreno</b> arriba para dibujar tu lote o cambiar el tamaño de los cuadros (5 a 50 m)</span>
              <span class="guide-step"><b>3.</b> Pulsa <b>Decidir qué sembrar</b> abajo para ver rotaciones y ganancia</span>
            </div>
          </div>
        `;

      return `
        ${outUsBanner}
        <div class="place-banner">
          <div class="place-title-wrap">
            <div class="place-title" title="${esc(placeTitle)}">${esc(placeTitle)}</div>
            <div class="coord-mono">${esc(fmtCoordNice(loc.lat, loc.lon))}</div>
          </div>
          ${locKindBadge}
        </div>

        ${summaryGuide}

        <div class="sem-grid" style="margin-bottom:14px">
          ${semCard(
            waterSt,
            "water",
            "water",
            tr("sem_water_title"),
            waterWord,
            rz != null ? Math.round(rz) : tr("nodata"),
            rz != null ? "%" : "",
            "Meta: 45–75%",
            waterGauge,
            waterPhrase,
            srcTag("NASA POWER · SMAP", "9–50 km", "Humedad en la zona de raíz (0 a 100%): debajo de 45% falta agua; arriba de 75% hay exceso de barro."),
            `SMAP Root Zone: ${rz ?? "—"}% · ${tr("m_rain_yr")}: ${rainFmt.val} ${rainFmt.unit}`
          )}
          ${semCard(
            vigSt,
            "vigor",
            "leaf",
            tr("sem_vigor_title"),
            vigWord,
            ndvi != null ? ndvi.toFixed(2) : tr("nodata"),
            ndvi != null ? "(escala 0–1)" : "",
            "Meta: ≥ 0.50",
            vigGauge,
            vigPhrase,
            srcTag("Sentinel-2 L2A", ter?.fecha || "10 m", `Índice de verdor (0.00 a 1.00): menos de 0.30 es suelo pelado; 0.50 o más es planta tupida y sana.`),
            `NDVI Sentinel-2: ${ndvi ?? "—"} · Nubes: ${ter?.nubosidad_pct ?? "—"}%`
          )}
          ${semCard(
            frostSt,
            "frost",
            "snow",
            tr("sem_frost_title"),
            frostWord,
            minFmt.val,
            minFmt.unit,
            `Helada ≤ ${window.V2.thresholds.frostC}°`,
            frostGauge,
            frostPhrase,
            srcTag("Meteomatics", "1 km · 7d", "Temperatura mínima esperada en los próximos 7 días a 1 km de resolución."),
            `t_min_2m_24h: ${minFmt.val} ${minFmt.unit} · Semáforo servidor: ${esc(h1.semaforo || "—")}`
          )}
          ${semCard(
            soilSt,
            "soil",
            "soil",
            tr("sem_soil_title"),
            soilWord,
            soilWFmt.val,
            soilWVal != null ? soilWFmt.unit : "",
            "Meta: ≥ 140 mm",
            soilGauge,
            soilPhrase,
            srcTag("USDA SSURGO", "30 m", ss.cobertura_encontrada === false ? "Sin cobertura SSURGO fuera de EE. UU." : `Capacidad del primer metro de suelo para guardar agua útil (≥ 140 mm es reserva alta; < 90 mm se seca rápido).`),
            `Serie: ${esc(ss.nombre_serie_suelo || "—")} · Consumo OpenET: ${etFmt.val} ${etFmt.unit}`
          )}
        </div>

        <div class="telemetry-ledger" style="margin-bottom:14px">
          <div class="ledger-col">
            <span class="ledger-kicker">${esc(tr("m_rain_yr"))}</span>
            <div class="ledger-val">${esc(rainFmt.val)} <small>${esc(rainFmt.unit)}</small></div>
            <div class="ledger-sub">${esc(tr("m_temp_yr"))}: <b>${esc(tempYrFmt.val)} ${esc(tempYrFmt.unit)}</b></div>
            <div style="margin-top:auto;padding-top:4px">${srcTag("NASA POWER", "50 km", "Promedio climatológico anual NASA POWER v10")}</div>
          </div>

          <div class="ledger-col">
            <span class="ledger-kicker">${esc(tr("m_soil_w"))}</span>
            <div class="ledger-val">${esc(soilWFmt.val)} <small>${esc(soilWFmt.unit)}</small></div>
            <div class="ledger-sub">${esc(tr("m_crop_et"))}: <b>${esc(etFmt.val)} ${esc(etFmt.unit)}</b></div>
            <div style="margin-top:auto;padding-top:4px">${srcTag("SSURGO · OpenET", "30 m", ss.cobertura_encontrada === false ? "Sin cobertura SSURGO fuera de EE. UU." : "USDA NRCS SSURGO (0–100 cm) y OpenET (30 m)")}</div>
          </div>

          <div class="ledger-col">
            <span class="ledger-kicker">${esc(tr("m_price_corn"))}</span>
            <div class="ledger-val">${corn?.por_tonelada_usd != null ? `\$${esc(corn.por_tonelada_usd)}` : esc(tr("nodata"))} <small>${corn?.por_tonelada_usd != null ? "USD/t" : ""}</small></div>
            <div class="ledger-sub">${esc(tr("m_price_soy"))}: <b>${soy?.por_tonelada_usd != null ? `\$${esc(soy.por_tonelada_usd)}/t` : esc(tr("nodata"))}</b></div>
            <div style="margin-top:auto;padding-top:4px">${srcTag("USDA MARS", corn?.fecha || "en vivo", g(o, "usda_ams_market_news.motivo") || g(o, "usda_ams_market_news.reporte") || "USDA AMS Market News")}</div>
          </div>
        </div>

        <div class="row-between">
          <p class="small mut" style="margin:0">${esc(h1.recomendacion_natural || "")}</p>
          <button type="button" class="btn btn-pri" data-go-space="decidir">${ic("compass", "sm")} <span>${esc(tr("btn_go_decide"))}</span></button>
        </div>
      `;
    },

    // -------------------------------------------------------------------------
    // PANTALLA 3: Mi Terreno
    // -------------------------------------------------------------------------
    renderMyTerrain() {
      const r = window.V2.terrainResp;
      const saved = window.V2.savedTerrains || [];
      const cellsOpts = [9, 16, 25, 36, 64, 100];
      const areaFmt = fmtArea(r?.area_ha, 1);

      const terrainGuide = window.V2.lang === "en"
        ? `
          <div class="guide-box">
            <div class="guide-box-title"><span>${ic("grid", "sm")} How does the field grid work?</span></div>
            <div>We divide your parcel into <b>squares of 5 to 50 m</b> so the Sentinel-2 satellite (10 m resolution) can tell you which spots have dense crop and which have bare soil.</div>
            <div class="guide-steps">
              <span class="guide-step"><b>Option A:</b> Draw your border by hand on the map</span>
              <span class="guide-step"><b>Option B:</b> Adopt an official 259 ha US BLM PLSS section in 1 click</span>
              <span class="guide-step"><b>Option C:</b> Find registered OpenStreetMap fields nearby</span>
            </div>
          </div>
        `
        : window.V2.lang === "pt"
        ? `
          <div class="guide-box">
            <div class="guide-box-title"><span>${ic("grid", "sm")} Como funciona a grade do terreno?</span></div>
            <div>Dividimos sua área em <b>quadros de 5 a 50 m</b> para o satélite Sentinel-2 (10 m) mostrar onde a planta está densa e onde o solo está exposto.</div>
            <div class="guide-steps">
              <span class="guide-step"><b>Opção A:</b> Desenhar à mão no mapa</span>
              <span class="guide-step"><b>Opção B:</b> Usar seção oficial dos EUA (BLM PLSS) em 1 clique</span>
              <span class="guide-step"><b>Opção C:</b> Buscar talhões do OpenStreetMap</span>
            </div>
          </div>
        `
        : `
          <div class="guide-box">
            <div class="guide-box-title"><span>${ic("grid", "sm")} ¿Qué es la cuadrícula y qué opciones tienes aquí?</span></div>
            <div>Dividimos tu terreno en <b>cuadros de 5 a 50 m</b> para que el satélite Sentinel-2 (10 m) te diga exactamente en qué rincón crece bien el cultivo y dónde hay suelo pelado.</div>
            <div class="guide-steps">
              <span class="guide-step"><b>Opción A:</b> Dibujar tu lindero a mano sobre el mapa</span>
              <span class="guide-step"><b>Opción B:</b> Tomar la parcela oficial de EE. UU. (259 ha BLM) en 1 clic</span>
              <span class="guide-step"><b>Opción C:</b> Buscar parcelas agrícolas vecinas (OpenStreetMap)</span>
            </div>
          </div>
        `;

      return `
        ${terrainGuide}
        <div class="row-between" style="margin-bottom:12px">
          <h2 class="card-title" style="margin:0">${ic("grid", "lg")} <span>${esc(tr("ter_title"))}</span></h2>
          <label class="small mut" title="Tamaño de cada cuadro del terreno">
            ${esc(window.V2.lang === "en" ? "Square size" : window.V2.lang === "pt" ? "Tamanho do quadro" : "Tamaño del cuadro")}:
            <select class="field" id="v2-cells-sel" style="min-height:36px;padding:4px 8px;font-size:14px">
              ${[5, 10, 20, 50].map(m => `<option value="lado:${m}" ${window.V2.cellSide === m ? "selected" : ""}>${m} × ${m} m${m === 5 ? (window.V2.lang === "en" ? " (soil moisture scale)" : " (escala de la humedad del suelo)") : ""}</option>`).join("")}
              ${cellsOpts.map(n => `<option value="n:${n}" ${!window.V2.cellSide && window.V2.cellsCount === n ? "selected" : ""}>${window.V2.lang === "en" ? "Auto" : "Automático"}: ${n} (${Math.round(Math.sqrt(n))}×${Math.round(Math.sqrt(n))})</option>`).join("")}
            </select>
          </label>
        </div>

        <div class="row-wrap" style="margin-bottom:12px">
          <button type="button" class="btn btn-pri" data-action="draw">${ic("draw", "sm")} <span>${esc(tr("ter_draw_start"))}</span></button>
          <button type="button" class="btn btn-sec" data-action="plss">${ic("map", "sm")} <span>${esc(tr("ter_plss_btn"))}</span></button>
          <button type="button" class="btn btn-sec" data-action="osm">${ic("leaf", "sm")} <span>${esc(tr("ter_osm_btn"))}</span></button>
          ${window.V2Map.poly ? `<button type="button" class="btn btn-txt" data-action="clear-ter">${ic("trash", "sm")} <span>${esc(tr("ter_clear"))}</span></button>` : ""}
        </div>

        ${!r || r.estado !== "OK" ? `
          <div class="notice ${r && r.estado !== "OK" ? "atencion" : ""}" style="margin-bottom:12px">
            ${ic(r && r.estado !== "OK" ? "atencion" : "info", "lg")}
            <div class="small" style="flex:1">
              ${esc(!r ? tr("ter_none") : (window.V2.lang === "en" ? "The satellite service took too long to read this photo. Try again or reduce the number of cells." : window.V2.lang === "pt" ? "O serviço de satélite demorou para ler esta foto. Tente novamente ou reduza o número de quadros." : "El satélite tardó demasiado en responder para esta foto. Intenta de nuevo o elige menos cuadros."))}
              ${r && r.estado !== "OK" ? `<div style="margin-top:8px"><button type="button" class="btn btn-pri btn-sm" data-action="retry-ter">${esc(m("Reintentar lectura satelital", "Retry satellite read", "Tentar leitura de satélite de novo"))}</button></div>` : ""}
            </div>
          </div>
        ` : `
          <div class="grid-3" style="margin-bottom:12px">
            <div class="card">
              <div class="small mut">${esc(tr("ter_area"))}</div>
              <div class="sem-num">${esc(areaFmt.val)} <small>${esc(areaFmt.unit)}</small></div>
              <div class="xs mut">${r.celdas?.length || 0} ${esc(tr("ter_cells_lbl").toLowerCase())} · ~${r.celdas?.[0]?.lado_m || "—"} m</div>
            </div>
            <div class="card">
              <div class="small mut">${esc(tr("ter_green"))} <span class="lv-agr">(NDVI)</span></div>
              <div class="sem-num">${r.ndvi_promedio ?? esc(tr("nodata"))}</div>
              <div class="xs mut">${esc(tr("ter_green_desc"))}</div>
            </div>
            <div class="card">
              <div class="small mut">${esc(tr("ter_bare"))}</div>
              <div class="sem-num">${r.pct_celdas_bajo_030 ?? "—"}<small>%</small></div>
              <div class="xs mut">${esc(tr("ter_bare_desc"))}</div>
            </div>
          </div>

          <div class="row-between card-sub" style="margin-bottom:12px">
            <div>
              ${srcTag("Sentinel-2 L2A (10 m)", r.fecha || "—", `Escena Sentinel-2 del ${r.fecha} con ${r.nubosidad_pct}% de nubes`)}
              <span class="xs mut" style="margin-left:6px">${esc(tr("ter_clouds"))}: <b>${r.nubosidad_pct ?? "—"}%</b></span>
            </div>
            <label class="small">
              <b>${esc(tr("ter_color_by"))}:</b>
              <select class="field" id="v2-color-sel" style="min-height:36px;padding:4px 8px;font-size:14px">
                <option value="ndvi" ${window.V2.colorMode === "ndvi" ? "selected" : ""}>${esc(tr("cm_ndvi"))}</option>
                <option value="sev" ${window.V2.colorMode === "sev" ? "selected" : ""}>${esc(tr("cm_sev"))}</option>
                <option value="zones" ${window.V2.colorMode === "zones" ? "selected" : ""}>${esc(tr("cm_zones"))}</option>
                <option value="anom" ${window.V2.colorMode === "anom" ? "selected" : ""}>${esc(tr("cm_anom"))}</option>
                ${window.V2.aiResp ? `<option value="ai" ${window.V2.colorMode === "ai" ? "selected" : ""}>${esc(tr("cm_ai"))}</option>` : ""}
                ${(window.V2Robot?.variablesConPosicion() || []).map(u => `<option value="robot:${esc(u.variable)}" ${window.V2.colorMode === "robot:" + u.variable ? "selected" : ""}>Robot · ${esc(u.nombre || u.variable)}${u.unidad ? ` (${esc(u.unidad)})` : ""}</option>`).join("")}
              </select>
            </label>
          </div>
        `}

        <div class="row-wrap" style="margin-bottom:12px">
          <button type="button" class="btn btn-sec btn-sm" data-action="run-ai">${ic("ai", "sm")} <span>${esc(tr("ter_ai_btn"))}</span></button>
          <button type="button" class="btn btn-sec btn-sm" data-action="save-ter">${ic("save", "sm")} <span>${esc(tr("ter_save"))}</span></button>
          <button type="button" class="btn btn-sec btn-sm" data-action="import-ter">${ic("upload", "sm")} <span>${esc(tr("ter_import"))}</span></button>
          <input type="file" id="v2-file-geo" accept=".geojson,.json,.kml" hidden>
          <button type="button" class="btn btn-sec btn-sm" data-export="geojson">${ic("download", "sm")} <span>${esc(tr("ter_export_geo"))}</span></button>
          <button type="button" class="btn btn-sec btn-sm" data-export="kml">${ic("download", "sm")} <span>${esc(tr("ter_export_kml"))}</span></button>
          <button type="button" class="btn btn-sec btn-sm" data-export="csv">${ic("download", "sm")} <span>${esc(tr("ter_export_csv"))}</span></button>
          <button type="button" class="btn btn-sec btn-sm" data-action="print">${ic("print", "sm")} <span>${esc(tr("ter_print"))}</span></button>
        </div>

        ${saved.length ? `
          <div class="chip-row">
            ${saved.map(s => `
              <span class="chip">
                <button type="button" class="btn-txt" style="border:0;background:transparent;padding:0;font-weight:600;cursor:pointer" data-load-saved="${s.id}">${esc(s.name)} (${esc(s.date)})</button>
                <button type="button" class="btn-txt" style="border:0;background:transparent;padding:0 2px;color:var(--riesgo);cursor:pointer" data-del-saved="${s.id}" aria-label="Borrar">✕</button>
              </span>
            `).join("")}
          </div>
        ` : ""}
      `;
    },

    // -------------------------------------------------------------------------
    // PANTALLA 4: Ficha de Cuadro (y selección múltiple)
    // -------------------------------------------------------------------------
    renderCellCard() {
      const r = window.V2.terrainResp;
      const selIds = Array.from(window.V2.selectedCells);
      const cellGuide = window.V2.lang === "en"
        ? `
          <div class="guide-box">
            <div class="guide-box-title"><span>${ic("info", "sm")} How to inspect a sector of your field</span></div>
            <div>Click any numbered square (<b>#1, #2…</b>) on the map to read its exact plant greenness (0 to 1), size in meters, and how much it differs from the rest of your parcel. Hold <b>Shift + click</b> to compare several squares together.</div>
          </div>
        `
        : window.V2.lang === "pt"
        ? `
          <div class="guide-box">
            <div class="guide-box-title"><span>${ic("info", "sm")} Como inspecionar um setor do terreno</span></div>
            <div>Clique em qualquer quadro numerado (<b>#1, #2…</b>) no mapa para ver seu verdor (0 a 1), tamanho em metros e diferença em relação à média do talhão. Segure <b>Shift + clique</b> para comparar vários quadros.</div>
          </div>
        `
        : `
          <div class="guide-box">
            <div class="guide-box-title"><span>${ic("info", "sm")} ¿Qué es la Ficha de sector y cómo se usa?</span></div>
            <div>Haz clic en cualquier cuadro numerado (<b>#1, #2…</b>) sobre el mapa para ver su verdor exacto (escala 0 a 1), cuánto mide en metros y si está mejor o peor que el promedio del lote. Mantén presionado <b>Shift + clic</b> en el mapa si quieres sumar y promediar varios sectores a la vez.</div>
          </div>
        `;
      if (!r || !Array.isArray(r.celdas) || !selIds.length) {
        return `
          ${cellGuide}
          <div class="notice">
            ${ic("grid", "lg")}
            <div class="small">${esc(tr("cell_none"))}</div>
          </div>
        `;
      }

      const stats = window.V2Map.computeStats(r.celdas);
      if (selIds.length > 1) {
        const items = selIds.map(i => r.celdas[i]).filter(Boolean);
        const valid = items.map(x => x.ndvi).filter(v => v != null);
        const avg = valid.length ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2) : tr("nodata");
        const totHa = items.reduce((a, x) => a + (x.lado_m * x.lado_m) / 10000, 0);
        const aFmt = fmtArea(totHa, 2);
        return `
          ${cellGuide}
          <div class="card">
            <div class="row-between">
              <h3 class="card-title" style="margin:0">${ic("grid", "sm")} <span>${esc(tr("cell_multi"))}: ${items.length}</span></h3>
              <button type="button" class="btn btn-sec btn-sm" data-action="clear-cell-sel">${esc(tr("cell_clear_sel"))}</button>
            </div>
            <div class="grid-2" style="margin-top:12px">
              <div><span class="mut small">${esc(tr("ter_area"))}:</span> <b>${esc(aFmt.val)} ${esc(aFmt.unit)}</b></div>
              <div><span class="mut small">${esc(tr("cell_green"))}:</span> <b>${esc(avg)}</b> (lote: ${r.ndvi_promedio})</div>
            </div>
            <div style="margin-top:10px">${srcTag("Sentinel-2 L2A (10 m)", r.fecha || "—")}</div>
          </div>
        `;
      }

      const idx = selIds[0];
      const c = r.celdas[idx];
      if (!c) return "";
      const sideN = Math.round(Math.sqrt(r.celdas.length)) || 1;
      const filaNum = c.fila != null ? c.fila + 1 : Math.floor(idx / sideN) + 1;
      const colNum = c.col != null ? c.col + 1 : (idx % sideN) + 1;
      const [[s, w], [n, e]] = c.limites;
      const z = c.ndvi != null ? (c.ndvi - stats.mean) / stats.sd : null;
      const aiC = window.V2.aiResp?.celdas?.[idx];
      const ha = (c.lado_m * c.lado_m) / 10000;
      const aFmt = fmtArea(ha, 2);

      const status = c.ndvi == null ? "nodata" : c.ndvi < 0.30 ? "riesgo" : c.ndvi < 0.50 ? "atencion" : "ok";
      const enMapa = window.V2Map.cellStyleAndBadge(c, idx, stats); // lo mismo que pinta el mapa
      const alertMsg = c.ndvi == null
        ? tr("nodata")
        : c.ndvi < 0.30
        ? (window.V2.lang === "en" ? "Low plant cover or bare soil. Check roots, moisture, or reseeding here." : window.V2.lang === "pt" ? "Pouca cobertura vegetal ou solo exposto. Revise raízes e umidade aqui." : "Poca cobertura o suelo pelado. Conviene revisar raíces, humedad o resiembra en este cuadro.")
        : c.ndvi < 0.50
        ? (window.V2.lang === "en" ? "Moderate plant vigor. Watch nitrogen and water in this spot." : window.V2.lang === "pt" ? "Vigor moderado. Acompanhe nitrogênio e água neste ponto." : "Cobertura media en crecimiento. Vigila agua y nitrógeno en este cuadro.")
        : (window.V2.lang === "en" ? "Dense, healthy canopy in this cell." : window.V2.lang === "pt" ? "Cobertura densa e sadia neste quadro." : "Planta densa y pareja en este cuadro.");

      return `
        ${cellGuide}
        <div class="card">
          <div class="row-between" style="margin-bottom:10px">
            <h3 class="card-title" style="margin:0">${ic("grid", "sm")} <span>${esc(tr("cell_title"))} #${idx + 1} (Fila ${filaNum} · Columna ${colNum})</span></h3>
            <button type="button" class="btn btn-sec btn-sm" data-action="clear-cell-sel">${esc(tr("cell_clear_sel"))}</button>
          </div>

          <div class="notice ${status}" style="margin-bottom:12px">
            ${ic(status === "ok" ? "ok" : status === "riesgo" ? "riesgo" : "atencion", "lg")}
            <div>
              <div style="font-weight:600">${esc(tr("cell_alert"))}</div>
              <div class="small">${esc(alertMsg)}</div>
            </div>
          </div>

          <div class="grid-3 small" style="margin-bottom:12px">
            <div>
              <div class="mut xs">${esc(tr("cell_green"))} (0 a 1) <span class="lv-agr">(NDVI)</span></div>
              <div style="font-size:20px;font-weight:600"><span style="display:inline-block;width:14px;height:14px;border:1px solid #1F2A14;background:${enMapa.color};vertical-align:-1px" aria-hidden="true"></span> ${c.ndvi != null ? c.ndvi.toFixed(2) : esc(tr("nodata"))} <small>${esc(enMapa.word)}</small></div>
              <div class="xs mut">${esc(trf("cell_same", { p: r.ndvi_promedio ?? "—", n: c.n_muestras, f: r.fecha || "—" }))}</div>
            </div>
            <div>
              <div class="mut xs">${esc(tr("cell_size"))}</div>
              <div style="font-size:20px;font-weight:600">${c.lado_m}×${c.lado_m} m</div>
              <div class="xs mut">~${esc(aFmt.val)} ${esc(aFmt.unit)}</div>
            </div>
            <div>
              <div class="mut xs">${esc(tr("cell_anom"))} vs. lote <span class="lv-agr">(z-score)</span></div>
              <div style="font-size:20px;font-weight:600">${z != null ? (z >= 0 ? "+" : "") + z.toFixed(2) + "σ" : "—"}</div>
              <div class="xs mut">${esc(tr("cell_coords"))}: ${((s + n) / 2).toFixed(4)}, ${((w + e) / 2).toFixed(4)}</div>
            </div>
          </div>

          ${aiC ? `
            <div class="card-sub small" style="margin-bottom:10px">
              <b>${esc(tr("cell_ai"))}:</b> ${esc(aiC.clase)} (${Math.round(aiC.confianza * 100)}%) · <span class="mut">${esc(tr("ai_disclaimer"))}</span>
            </div>
          ` : ""}

          ${srcTag("Sentinel-2 L2A (10 m)", r.fecha || "—", `Muestreo óptico Sentinel-2 L2A (${r.fecha}) con ${c.n_muestras}/9 puntos válidos en el cuadro.`)}
        </div>
      `;
    },

    // -------------------------------------------------------------------------
    // PANTALLA 5: Capas (14 útiles en 4 grupos + tiempo + cortina + ir al catálogo)
    // -------------------------------------------------------------------------
    renderUsefulLayers() {
      const lang = window.V2.lang;
      const q = (window.V2.layerFilter || "").toLowerCase().trim();
      const favOnly = !!window.V2.layerFavOnly;
      const groups = [
        ["veg", tr("lay_g_veg")],
        ["water", tr("lay_g_water")],
        ["risk", tr("lay_g_risk")],
        ["ctx", tr("lay_g_ctx")]
      ];

      const offsetDate = new Date(Date.now() - 5 * 86400000 + (window.V2.timeOffsetDays || 0) * 86400000).toISOString().slice(0, 10);

      return `
        <div class="row-between" style="margin-bottom:8px">
          <h2 class="card-title" style="margin:0">${ic("layers", "lg")} <span>${esc(tr("lay_title"))}</span></h2>
          <button type="button" class="btn btn-sec btn-sm" data-open-catalog="1">${ic("book", "sm")} <span>${esc(tr("lay_open_cat"))}</span></button>
        </div>
        <p class="small mut" style="margin:0 0 12px">${esc(tr("lay_sub"))}</p>

        <div class="row-wrap" style="margin-bottom:12px">
          <input type="search" class="field" id="v2-lay-q" placeholder="${esc(tr("lay_search"))}" value="${esc(window.V2.layerFilter || "")}" style="flex:1;min-height:40px">
          <label class="btn btn-sec btn-sm" style="cursor:pointer">
            <input type="checkbox" id="v2-lay-fav" ${favOnly ? "checked" : ""}>
            <span>${esc(tr("lay_fav_only"))}</span>
          </label>
        </div>

        <div class="card-sub" style="margin-bottom:16px">
          <div class="small" style="font-weight:600;margin-bottom:8px">${ic("calendar", "sm")} <span>${esc(tr("lay_time_title"))}</span></div>
          <div class="row-wrap" style="margin-bottom:8px">
            <button type="button" class="btn btn-sec btn-sm" id="v2-time-play">
              ${ic(window.V2.playTimer ? "pause" : "play", "sm")}
              <span>${esc(window.V2.playTimer ? tr("lay_pause") : tr("lay_play"))}</span>
            </button>
            <input type="range" id="v2-time-rng" min="-84" max="0" step="7" value="${window.V2.timeOffsetDays || 0}" style="flex:1" aria-label="12 weeks time machine">
            <input type="date" class="field" id="v2-layer-date" value="${esc(window.V2.layerDate || offsetDate)}" style="min-height:36px;padding:4px 8px;font-size:13px">
          </div>
          <div class="grid-2 small">
            <label class="row-wrap">
              <span class="mut">${esc(tr("lay_opacity"))}:</span>
              <input type="range" id="v2-op-rng" min="10" max="100" value="${Math.round((window.V2.layerOpacity ?? 0.8) * 100)}" style="flex:1">
              <b>${Math.round((window.V2.layerOpacity ?? 0.8) * 100)}%</b>
            </label>
            <label class="row-wrap">
              <span class="mut">${esc(tr("lay_curtain"))}:</span>
              <input type="range" id="v2-curtain-rng" min="0" max="100" value="${window.V2.curtainPct ?? 100}" style="flex:1">
              <b>${window.V2.curtainPct ?? 100}%</b>
            </label>
          </div>
        </div>

        ${groups.map(([gKey, gTitle]) => {
          const items = window.USEFUL_V2.filter(u => {
            if (u.g !== gKey) return false;
            const d = u.t[lang] || u.t.es;
            if (favOnly && !window.V2.favLayers.includes(u.id)) return false;
            if (q && !`${d.n} ${d.q} ${d.tech}`.toLowerCase().includes(q)) return false;
            return true;
          });
          if (!items.length) return "";
          return `
            <h3 class="small mut" style="text-transform:uppercase;letter-spacing:0.04em;margin:16px 0 4px">${esc(gTitle)}</h3>
            <div class="card" style="padding:4px 16px;margin-bottom:12px">
              ${items.map(u => {
                const d = u.t[lang] || u.t.es;
                const on = window.V2Map.isLayerOn(u.kind, u.id);
                const isFav = window.V2.favLayers.includes(u.id);
                return `
                  <div class="switch-row">
                    <div style="flex:1">
                      <div class="row-wrap">
                        <label for="sw_${esc(u.id)}" style="font-weight:600;cursor:pointer">${esc(d.n)}</label>
                        <span class="lv-agr xs mut">(${esc(d.tech)})</span>
                        <button type="button" class="btn-txt" style="padding:2px 6px;min-height:28px" data-fav-layer="${esc(u.id)}" aria-label="Favorita">
                          ${isFav ? "★" : "☆"}
                        </button>
                      </div>
                      <div class="small mut">${esc(d.q)}</div>
                      <details style="margin-top:4px">
                        <summary class="xs" style="color:var(--primario);font-weight:600;cursor:pointer">${esc(tr("lay_more"))}</summary>
                        <div class="xs" style="margin-top:4px"><b>${esc(tr("lay_impact"))}:</b> ${esc(d.i)}</div>
                        <div class="xs mut" style="margin-top:2px"><b>${esc(tr("lay_limit"))}:</b> ${esc(d.r)}</div>
                      </details>
                    </div>
                    <input type="checkbox" class="switch-inp" id="sw_${esc(u.id)}" data-toggle-kind="${esc(u.kind)}" data-toggle-id="${esc(u.id)}" ${on ? "checked" : ""}>
                  </div>
                `;
              }).join("")}
            </div>
          `;
        }).join("")}

        <div style="text-align:center;margin-top:16px">
          <button type="button" class="btn btn-pri" data-open-catalog="1">${ic("layers", "sm")} <span>${esc(tr("lay_open_cat"))}</span></button>
        </div>
      `;
    },

    // -------------------------------------------------------------------------
    // PANTALLAS 6 Y 7: Decidir + Tu granja (reactivo al instante)
    // -------------------------------------------------------------------------
    renderDecideWorkspace() {
      const D = window.V2.D;
      const C = window.V2.C;
      const lang = window.V2.lang;
      const o = D?.telemetria_oficial_en_vivo || {};
      const pw = g(o, "nasa_power_v10.resumen_anual") || {};
      const ss = o.usda_nrcs_ssurgo || {};
      const et = g(o, "openet_api.et_acumulada_temporada_mm");
      const pr = g(o, "usda_ams_market_news.precios") || [];
      const ams = o.usda_ams_market_news || {};
      const fe = window.V2.farmExtra;
      const num = (v) => (v == null || v === "" || Number.isNaN(+v) ? null : +v);
      // Precio: el de USDA MARS si el reporte lo trae; si no, el que escriba el usuario. Sin ninguno no hay margen.
      const cultivos = [["Maize", "c_maize", "Corn"], ["Soy", "c_soy", "Soybeans"], ["Wheat", "c_wheat", "Wheat"]].map(([id, k, prod]) => {
        const m = pr.find(p => p.producto === prod);
        const precio = m?.por_tonelada_usd ?? num(fe["price" + id]);
        const costo = num(fe["cost" + id]), rend = num(fe["yield" + id]);
        return { id, k, m, precio, costo, rend, margen: precio != null && costo != null && rend != null ? rend * precio - costo : null };
      });
      const haTerreno = window.V2.terrainResp?.area_ha ?? null;
      const ha = num(fe.ha) ?? haTerreno;

      // Puntaje transparente de las 3 estrategias según las 4 respuestas de "Tu granja"
      const rows = Object.entries(window.STRAT_V2).map(([id, s]) => {
        const machBad = s.notill && C.machine !== "notill";
        // Ahorrar agua solo cuenta donde llueve poco: con más de 600 mm al año el maíz de temporal no pasa sed.
        const seco = (pw.precipitacion_anual_mm ?? 0) > 0 && pw.precipitacion_anual_mm < 600;
        const watBad = id === "A" && C.water !== "irrig" && seco;
        const watOk = id === "B" && C.water !== "irrig" && seco;
        const score = (s.tag === C.priority ? 2 : 0) - (machBad ? 3 : 0) - (watBad ? 1 : 0) + (watOk ? 1 : 0);
        return { id, s, score, machBad, watBad, watOk };
      }).sort((a, b) => b.score - a.score);

      const best = rows[0];
      const semSt = best.machBad ? "atencion" : "ok";
      const semWord = best.machBad ? tr("st_warn_word") : tr("st_ok_word");

      // Escenario climático: solo se calcula con lluvia y consumo medidos; si falta uno, se dice cuál
      const baseRain = pw.precipitacion_anual_mm ?? null;
      const baseEt = et ?? null;
      const hayEsc = baseRain != null && baseEt != null;
      const adjRain = hayEsc ? baseRain * (1 + (window.V2.scenRainPct || 0) / 100) : null;
      const adjEt = hayEsc ? baseEt * (1 + 0.06 * (window.V2.scenTempC || 0)) : null;
      const balScen = hayEsc ? adjRain - adjEt : null;

      // Alertas activas (generales y por cuadro)
      const alerts = this.computeActiveAlerts();

      return `
        <div class="workspace-inner">
          <!-- Encabezado y Semáforo Grande de Decisión -->
          <div class="strat-card recommended">
            <div class="row-between" style="margin-bottom:4px">
              <span class="sem-badge ${semSt}">${ic(semSt, "sm")} <span>${esc(semWord)} · ${esc(tr("dec_title"))}</span></span>
              <button type="button" class="btn btn-sec btn-sm" data-open-modal="farm">${ic("settings", "sm")} <span>${esc(tr("dec_edit_farm"))}</span></button>
            </div>
            <h1 style="font-size:var(--fs-24);margin:0">${esc(tr(best.s.key))}</h1>
            <div class="rot-flow">
              ${best.s.seq[lang].split("→").map((st, i, arr) => `
                <span class="rot-step">${esc(st.trim())}</span>${i < arr.length - 1 ? `<span class="rot-arrow">→</span>` : ""}
              `).join("")}
            </div>
            <div class="chip-row">
              <span class="chip">${ic("ok", "sm")} <span>+${esc(best.s.gain[lang])}</span></span>
              <span class="chip">${ic("atencion", "sm")} <span>−${esc(best.s.cost[lang])}</span></span>
            </div>
            <div class="xs mut">${esc(tr("strat_rule_note"))}</div>
            <details class="xs" style="margin-top:6px"><summary style="cursor:pointer;color:var(--primario);font-weight:600">${esc(tr("strat_how"))}</summary>
              <div style="margin-top:4px">${esc(tr("strat_formula"))}</div>
              <div class="mut" style="margin-top:2px">${rows.map(r => `${esc(tr(r.s.key))}: ${r.score >= 0 ? "+" : ""}${r.score}`).join(" · ")}</div></details>
          </div>

          <!-- Pantalla 7 integrada y plegable: Tu granja (4 preguntas que reaccionan al instante) -->
          <div class="card">
            <h2 class="card-title">${ic("leaf", "sm")} <span>${esc(tr("farm_title"))}</span></h2>
            <p class="small mut" style="margin:0 0 12px">${esc(tr("farm_sub"))}</p>
            <div class="grid-2">
              <label class="small">
                <b>${esc(tr("q_crop"))}</b><br>
                <select class="field" data-farm-q="crop" style="width:100%;margin-top:4px">
                  ${[["maize", "c_maize"], ["soy", "c_soy"], ["wheat", "c_wheat"], ["veg", "c_veg"]].map(([v, k]) => `<option value="${v}" ${C.crop === v ? "selected" : ""}>${esc(tr(k))}</option>`).join("")}
                </select>
              </label>
              <label class="small">
                <b>${esc(tr("q_water"))}</b><br>
                <select class="field" data-farm-q="water" style="width:100%;margin-top:4px">
                  ${[["rain", "w_rain"], ["irrig", "w_irrig"], ["limited", "w_limited"]].map(([v, k]) => `<option value="${v}" ${C.water === v ? "selected" : ""}>${esc(tr(k))}</option>`).join("")}
                </select>
              </label>
              <label class="small">
                <b>${esc(tr("q_mach"))}</b><br>
                <select class="field" data-farm-q="machine" style="width:100%;margin-top:4px">
                  ${[["conv", "m_conv"], ["notill", "m_notill"], ["forage", "m_forage"]].map(([v, k]) => `<option value="${v}" ${C.machine === v ? "selected" : ""}>${esc(tr(k))}</option>`).join("")}
                </select>
              </label>
              <label class="small">
                <b>${esc(tr("q_prio"))}</b><br>
                <select class="field" data-farm-q="priority" style="width:100%;margin-top:4px">
                  ${[["income", "p_income"], ["water", "p_water"], ["soil", "p_soil"], ["pests", "p_pests"]].map(([v, k]) => `<option value="${v}" ${C.priority === v ? "selected" : ""}>${esc(tr(k))}</option>`).join("")}
                </select>
              </label>
            </div>
          </div>

          <!-- Las 3 Tarjetas de Estrategias + Rotación Actual -->
          <div class="grid-3">
            ${rows.map((r, idx) => `
              <div class="strat-card ${idx === 0 ? "recommended" : ""}">
                <div class="row-between">
                  <strong>#${idx + 1} · ${esc(tr(r.s.key))}</strong>
                  ${r.s.tag === C.priority ? `<span class="sem-badge ok">${esc(tr("strat_match"))}</span>` : ""}
                </div>
                <div class="rot-flow">
                  ${r.s.seq[lang].split("→").map((st, i, arr) => `
                    <span class="rot-step">${esc(st.trim())}</span>${i < arr.length - 1 ? `<span class="rot-arrow">→</span>` : ""}
                  `).join("")}
                </div>
                <div class="xs"><b>＋ ${esc(tr("strat_gain"))}:</b> ${esc(r.s.gain[lang])}</div>
                <div class="xs mut"><b>－ ${esc(tr("strat_cost"))}:</b> ${esc(r.s.cost[lang])}</div>
                <div class="chip-row" style="margin-top:auto;padding-top:4px">
                  <span class="chip">${r.s.legume ? "✓" : "✕"} ${esc(tr("legume_lbl"))}</span>
                  <span class="chip">${r.s.cover ? "✓" : "✕"} ${esc(tr("cover_lbl"))}</span>
                  <span class="chip">${esc(tr("fam_lbl"))}: ${r.s.fam}</span>
                  <span class="chip">${r.machBad ? "⚠ " + esc(tr("fit_warn")) : "✓ " + esc(tr("fit_ok"))}</span>
                </div>
              </div>
            `).join("")}
          </div>

          <!-- Comparador lado a lado de las 4 estrategias -->
          <div class="card">
            <h2 class="card-title">${ic("chart", "sm")} <span>${esc(tr("rot_comp_title"))}</span></h2>
            <div class="table-wrap">
              <table class="v2-table">
                <thead>
                  <tr>
                    <th>Criterio</th>
                    <th>${esc(tr("baseline"))} (${esc(tr("c_" + C.crop))})</th>
                    <th>${esc(tr("sA"))}</th>
                    <th>${esc(tr("sB"))}</th>
                    <th>${esc(tr("sC"))}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><b>Demanda de agua</b></td><td>Alta</td><td>Alta (${et != null ? Math.round(et) + " mm" : "sin dato"})</td><td><b>Baja–Media</b></td><td>Baja (retiene humedad)</td></tr>
                  <tr><td><b>Nitrógeno biológico</b></td><td>${C.crop === "soy" ? "Sí (1 cultivo)" : "No (0)"}</td><td>Sí (leguminosa)</td><td>Sí (garbanzo/lenteja)</td><td><b>Sí (trébol + soya + alfalfa)</b></td></tr>
                  <tr><td><b>Cobertura invernal</b></td><td>Sin cobertura</td><td>Centeno invernal</td><td>Rastrojo en pie</td><td><b>Cobertura viva continua</b></td></tr>
                  <tr><td><b>Maquinaria</b></td><td>Actual</td><td>Convencional / directa</td><td>Convencional / directa</td><td>Requiere siembra directa</td></tr>
                </tbody>
              </table>
            </div>
            <div style="margin-top:8px">${srcTag("USDA NRCS / OpenET / SSURGO", "Reglas del equipo + datos locales")}</div>
          </div>

          <!-- Calculadora transparente de costos y márgenes -->
          <div class="card">
            <h2 class="card-title">${ic("dollar", "sm")} <span>${esc(tr("calc_title"))}</span></h2>
            <p class="small mut" style="margin:0 0 12px">${esc(tr("calc_sub"))}</p>
            <div class="row-wrap" style="margin-bottom:12px">
              <label class="small">${esc(tr("calc_area"))}: <input type="number" class="field" id="v2-fe-ha" value="${fe.ha ?? ""}" placeholder="${haTerreno != null ? haTerreno : ""}" min="0" max="20000" style="width:96px;min-height:38px"></label>
              <span class="xs mut">${esc(num(fe.ha) != null ? tr("calc_area_user") : haTerreno != null ? tr("calc_area_field") : tr("calc_area_none"))}</span>
            </div>
            <div class="table-wrap">
              <table class="v2-table">
                <thead>
                  <tr><th>${esc(tr("calc_crop"))}</th><th>${esc(tr("calc_cost"))}</th><th>${esc(tr("calc_yield"))}</th><th>${esc(tr("calc_price"))}</th><th>${esc(tr("calc_margin"))}</th><th>${esc(tr("calc_total"))}${ha != null ? ` (${esc(ha)} ha)` : ""}</th></tr>
                </thead>
                <tbody>
                  ${cultivos.map(c => `
                  <tr>
                    <td><b>${esc(tr(c.k))}</b></td>
                    <td><input type="number" class="field" min="0" data-calc="cost${c.id}" value="${c.costo ?? ""}" aria-label="${esc(tr("calc_cost"))}" style="width:90px;min-height:36px"></td>
                    <td><input type="number" class="field" min="0" step="0.1" data-calc="yield${c.id}" value="${c.rend ?? ""}" aria-label="${esc(tr("calc_yield"))}" style="width:80px;min-height:36px"></td>
                    <td>${c.m?.por_tonelada_usd != null
                      ? `<b>${esc(c.m.por_tonelada_usd)}</b><div>${fuente({ fuente: "USDA AMS MARS", fecha: c.m.fecha, tipo: "medicion", detalle: ams.reporte, cache: ams.cache })}</div>`
                      : `<input type="number" class="field" min="0" data-calc="price${c.id}" value="${num(fe["price" + c.id]) ?? ""}" aria-label="${esc(tr("calc_price"))}" style="width:90px;min-height:36px"><div class="xs mut">${esc(tr("calc_price_user"))}</div>`}</td>
                    <td style="font-weight:600;color:${c.margen == null ? "inherit" : c.margen >= 0 ? "var(--ok)" : "var(--riesgo)"}">${c.margen == null ? "—" : esc(c.margen.toFixed(0))}</td>
                    <td><b>${c.margen == null || ha == null ? "—" : esc(Math.round(c.margen * ha).toLocaleString())}</b></td>
                  </tr>`).join("")}
                </tbody>
              </table>
            </div>
            <p class="xs mut" style="margin:8px 0 0">${esc(tr("calc_formula"))}</p>
          </div>

          <!-- Calendario agrícola a 3 años imprimible -->
          <div class="card">
            <div class="row-between" style="margin-bottom:10px">
              <h2 class="card-title" style="margin:0">${ic("calendar", "sm")} <span>${esc(tr("cal3_title"))}</span></h2>
              <button type="button" class="btn btn-sec btn-sm no-print" data-action="print">${ic("print", "sm")} <span>${esc(tr("ter_print"))}</span></button>
            </div>
            <div class="grid-3 small">
              <div class="card-sub">
                <strong>Año 1 · Cultivo principal + Cobertura</strong>
                <p class="xs" style="margin:6px 0">Abr–Sep: Siembra y desarrollo de ${esc(tr("c_" + C.crop))}.</p>
                <p class="xs" style="margin:6px 0">Oct–Nov: Cosecha y siembra inmediata de centeno/avena de cobertura para no dejar suelo desnudo.</p>
              </div>
              <div class="card-sub">
                <strong>Año 2 · Fijación biológica de nitrógeno</strong>
                <p class="xs" style="margin:6px 0">Abr: Terminación de cobertura en verde.</p>
                <p class="xs" style="margin:6px 0">May–Oct: Leguminosa fijadora (Soya / Garbanzo / Lenteja) que aporta nitrógeno y corta plagas de raíz.</p>
              </div>
              <div class="card-sub">
                <strong>Año 3 · Consolidación del suelo</strong>
                <p class="xs" style="margin:6px 0">Nov–Jun: Cereal de invierno o cobertura mixta (Trébol + Avena).</p>
                <p class="xs" style="margin:6px 0">Jul–Oct: Muestreo de pH y materia orgánica en cuadros con anomalía.</p>
              </div>
            </div>
          </div>

          <!-- Escenarios climáticos interactivos -->
          <div class="card">
            <h2 class="card-title">${ic("sun", "sm")} <span>${esc(tr("scen_title"))}</span></h2>
            <div class="grid-2 small" style="margin-bottom:12px">
              <label>
                <b>${esc(tr("scen_rain"))}: ${window.V2.scenRainPct > 0 ? "+" : ""}${window.V2.scenRainPct || 0}%</b><br>
                <input type="range" id="v2-scen-rain" min="-30" max="30" step="5" value="${window.V2.scenRainPct || 0}" style="width:100%">
              </label>
              <label>
                <b>${esc(tr("scen_temp"))}: +${window.V2.scenTempC || 0} °C (+6% demanda de agua/°C)</b><br>
                <input type="range" id="v2-scen-temp" min="0" max="4" step="0.5" value="${window.V2.scenTempC || 0}" style="width:100%">
              </label>
            </div>
            ${hayEsc ? `<div class="notice ${balScen < 0 ? "riesgo" : "ok"}">
              ${ic(balScen < 0 ? "atencion" : "ok", "lg")}
              <div class="small">
                ${esc(trf("scen_result", { r: Math.round(adjRain), e: Math.round(adjEt), b: (balScen >= 0 ? "+" : "") + Math.round(balScen) }))}
                <div class="xs mut">${esc(tr("scen_rule"))}</div>
              </div>
            </div>` : `<div class="notice info">${ic("info", "sm")}<div class="small">${esc(trf("scen_missing", { f: [baseRain == null ? "NASA POWER" : "", baseEt == null ? "OpenET" : ""].filter(Boolean).join(" + ") }))}</div></div>`}
          </div>

          <!-- Alertas activas y umbrales editables -->
          <div class="card">
            <h2 class="card-title">${ic("atencion", "sm")} <span>${esc(tr("alerts_title"))}</span></h2>
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
              ${alerts.map(a => `
                <div class="notice ${a.st}">
                  ${ic(a.st === "ok" ? "ok" : a.st === "riesgo" ? "riesgo" : "atencion", "sm")}
                  <div class="small">${esc(a.msg)}</div>
                </div>
              `).join("")}
            </div>
            <div class="grid-2 small card-sub">
              <label>Umbral helada (°C): <input type="number" class="field" data-th="frostC" step="0.5" value="${window.V2.thresholds.frostC}" style="width:76px;min-height:36px"></label>
              <label>Umbral suelo pelado (verdor &lt;): <input type="number" class="field" data-th="bareNdvi" step="0.05" value="${window.V2.thresholds.bareNdvi}" style="width:76px;min-height:36px"></label>
              <label>Umbral sequía raíz (&lt; %): <input type="number" class="field" data-th="droughtPct" step="1" value="${window.V2.thresholds.droughtPct}" style="width:76px;min-height:36px"></label>
              <label>Umbral exceso agua (&gt; %): <input type="number" class="field" data-th="excessPct" step="1" value="${window.V2.thresholds.excessPct}" style="width:76px;min-height:36px"></label>
            </div>
          </div>
        </div>
      `;
    },

    computeActiveAlerts() {
      const D = window.V2.D;
      const o = D?.telemetria_oficial_en_vivo || {};
      const pw = g(o, "nasa_power_v10.resumen_anual") || {};
      const fm = g(o, "meteomatics_weather_1km.pronostico_7_dias_1km.data")?.find(p => p.parameter === "t_min_2m_24h:C");
      const fVals = (g(fm, "coordinates.0.dates") || []).map(x => x.value).filter(x => x != null);
      const min7 = fVals.length ? Math.min(...fVals) : null;
      const r = window.V2.terrainResp;
      const out = [];

      if (min7 != null && min7 <= window.V2.thresholds.frostC) {
        out.push({ st: "riesgo", msg: `Helada prevista: mínima de ${min7.toFixed(1)} °C en los próximos 7 días (umbral ≤ ${window.V2.thresholds.frostC} °C · Meteomatics 1 km).` });
      }
      const rz = pw.humedad_zona_radicular_media_pct;
      if (rz != null && rz < window.V2.thresholds.droughtPct) {
        out.push({ st: "riesgo", msg: `Sequía en zona de raíz: humedad media de ${rz.toFixed(1)}% (umbral < ${window.V2.thresholds.droughtPct}% · NASA POWER).` });
      }
      if (rz != null && rz > window.V2.thresholds.excessPct) {
        out.push({ st: "atencion", msg: `Exceso de humedad en raíz: ${rz.toFixed(1)}% (umbral > ${window.V2.thresholds.excessPct}%). Evitar paso de maquinaria pesada.` });
      }
      if (r?.celdas?.length) {
        const low = r.celdas.map((c, i) => ({ c, i })).filter(x => x.c.ndvi != null && x.c.ndvi < window.V2.thresholds.bareNdvi);
        if (low.length) {
          out.push({ st: "atencion", msg: `${low.length} de ${r.celdas.length} cuadros tienen verdor < ${window.V2.thresholds.bareNdvi} (Cuadros: ${low.slice(0, 8).map(x => "#" + (x.i + 1)).join(", ")}${low.length > 8 ? "…" : ""} · Sentinel-2 10 m).` });
        }
      }
      if (!out.length) {
        out.push({ st: "ok", msg: "Sin alertas críticas bajo los umbrales actuales." });
      }
      return out;
    },

    // -------------------------------------------------------------------------
    // ESPACIO 3: Datos y Modelos (Pantallas 8, 9 y 10)
    // -------------------------------------------------------------------------
    renderDataWorkspace() {
      // El clima, el agua y el suelo ya están en "Clima y suelo": aquí solo predicciones y fuentes.
      const sub = window.V2.dataSubTab === "fuentes" ? "fuentes" : "ia";
      return `
        <div class="workspace-inner">
          <div class="row-wrap card" style="padding:10px 16px">
            <button type="button" class="btn ${sub === "ia" ? "btn-pri" : "btn-sec"}" data-data-tab="ia">${ic("ai", "sm")} <span>${esc(tr("tab_ia"))}</span></button>
            <button type="button" class="btn ${sub === "fuentes" ? "btn-pri" : "btn-sec"}" data-data-tab="fuentes">${ic("satellite", "sm")} <span>${esc(tr("tab_fuentes"))}</span></button>
          </div>
          ${sub === "ia" ? this.renderScreen9IA() : this.renderScreen10FuentesCatalogo()}
        </div>
      `;
    },

    // -------------------------------------------------------------------------
    // PANTALLA 8: Clima, agua, suelo y sensores
    // -------------------------------------------------------------------------
    renderScreen8ClimaAgua() {
      const D = window.V2.D;
      const o = D?.telemetria_oficial_en_vivo || {};
      const fcData = g(o, "meteomatics_weather_1km.pronostico_7_dias_1km.data") || [];
      const byDay = {};
      fcData.forEach(p => (g(p, "coordinates.0.dates") || []).forEach(x => {
        const day = x.date.slice(0, 10);
        (byDay[day] ||= {})[p.parameter] = x.value;
      }));
      const dayEntries = Object.entries(byDay);

      // Balance mensual de agua (NASA POWER vs OpenET)
      const rainM = g(o, "nasa_power_v10.series_12_meses.lluvia_mm_mes") || {};
      const etM = {};
      (g(o, "openet_api.series_et_mm") || []).forEach(p => { etM[window.MONTHS_KEYS[+p.time.slice(5, 7) - 1]] = p.et; });
      const rgM = {};
      (g(o, "openet_api.rango_et_mm") || []).forEach(p => { rgM[window.MONTHS_KEYS[+p.time.slice(5, 7) - 1]] = p; });
      const balRows = window.MONTHS_KEYS.map(m => ({
        m,
        rain: rainM[m] ?? null,
        et: etM[m] ?? null,
        lo: rgM[m]?.min ?? null,
        hi: rgM[m]?.max ?? null
      }));

      // Calendario de poca cobertura (OpenET NDVI mensual)
      const ndviM = g(o, "openet_api.ndvi_mensual") || [];

      // Suelo USDA SSURGO
      const ss = o.usda_nrcs_ssurgo || {};
      const hz = ss.horizontes_verticales_0_150cm || [];

      // Sensores USGS cercanos
      const usgs = g(o, "usgs_water_services_nwis.sensores_cercanos") || [];
      const passes = g(o, "nasa_earthdata_cmr_pasadas.ultimas_pasadas_satelitales_nasa") || [];

      // Clima de 40 años
      const c40 = window.V2.clim40;

      return `
        <!-- Pronóstico 7 días y helada -->
        <div class="card">
          <div class="row-between" style="margin-bottom:10px">
            <h2 class="card-title" style="margin:0">${ic("sun", "sm")} <span>${esc(tr("fc_title"))}</span></h2>
            ${srcTag("Meteomatics", "1 km · 7 días", "Pronóstico meteorológico a 1 km de resolución (Meteomatics)")}
          </div>
          ${dayEntries.length ? `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px">
              ${dayEntries.map(([d, v]) => {
                const tFmt = fmtTemp(v["t_2m:C"], 0);
                const mnFmt = fmtTemp(v["t_min_2m_24h:C"], 0);
                const rFmt = fmtRain(v["precip_24h:mm"], 1);
                const isFrost = v["t_min_2m_24h:C"] != null && v["t_min_2m_24h:C"] <= 0;
                return `
                  <div class="card-sub" style="text-align:center;border-color:${isFrost ? "var(--riesgo)" : "var(--linea)"}">
                    <div class="xs mut">${esc(d.slice(5))}</div>
                    <div style="font-size:20px;font-weight:600">${esc(tFmt.val)}${esc(tFmt.unit)}</div>
                    <div class="xs ${isFrost ? "" : "mut"}" style="${isFrost ? "color:var(--riesgo);font-weight:600" : ""}">mín ${esc(mnFmt.val)}${esc(mnFmt.unit)}</div>
                    <div class="xs" style="color:var(--agua);margin-top:4px">${esc(rFmt.val)} ${esc(rFmt.unit)}</div>
                    <div class="lv-agr xs mut">Humedad idx: ${v["soil_moisture_index_-15cm:idx"] != null ? (+v["soil_moisture_index_-15cm:idx"]).toFixed(2) : "—"}</div>
                  </div>
                `;
              }).join("")}
            </div>
          ` : `<p class="small mut">${esc(tr("nodata"))}</p>`}
        </div>

        <!-- Balance de agua por mes (SVG con ejes, unidades y fuente visibles) -->
        <div class="card">
          <div class="row-between" style="margin-bottom:10px">
            <h2 class="card-title" style="margin:0">${ic("water", "sm")} <span>${esc(tr("bal_title"))}</span></h2>
            ${srcTag("NASA POWER + OpenET", "50 km / 30 m", "Lluvia mensual NASA POWER contra consumo de agua del cultivo OpenET (con rango entre modelos)")}
          </div>
          ${this.renderWaterBalanceSvg(balRows)}

          <h3 class="small" style="margin:16px 0 8px">${esc(tr("bare_cal_title"))}</h3>
          ${ndviM.length ? `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(64px,1fr));gap:6px">
              ${ndviM.map(p => {
                const mName = window.MONTHS_KEYS[+p.time.slice(5, 7) - 1] || p.time;
                const low = p.ndvi != null && p.ndvi < 0.30;
                return `
                  <div style="text-align:center;padding:6px 4px;border-radius:8px;background:${low ? "var(--atencion)" : "var(--ok)"};color:#fff;font-size:12px;font-weight:600">
                    ${esc(mName)}<br>${p.ndvi != null ? (+p.ndvi).toFixed(2) : "—"}
                  </div>
                `;
              }).join("")}
            </div>
            <p class="xs mut" style="margin-top:6px">Meses con verdor menor a 0.30 cuentan como suelo con poca cobertura (regla del equipo sobre promedio Landsat vía OpenET).</p>
          ` : `<p class="small mut">${esc(tr("nodata"))} (OpenET: EE. UU. continental)</p>`}
        </div>

        <!-- Clima histórico de 40 años (1985–2024) -->
        <div class="card">
          <div class="row-between" style="margin-bottom:10px">
            <h2 class="card-title" style="margin:0">${ic("chart", "sm")} <span>${esc(tr("clim40_title"))}</span></h2>
            ${srcTag("NASA POWER (1985–2024)", "40 años · 50 km", "Percentiles p10/p50/p90, tendencia por década y fechas históricas de helada (NASA POWER)")}
          </div>
          ${c40?.resumen_40_anios ? `
            <div class="grid-2 small" style="margin-bottom:12px">
              <div class="card-sub">
                <strong>Temperatura anual (${c40.resumen_40_anios.anios_analizados} años)</strong>
                <div>Media: <b>${c40.resumen_40_anios.temp_media_40a_c} °C</b></div>
                <div>Percentiles p10 / p50 / p90: <b>${c40.resumen_40_anios.temp_percentiles_c?.p10} / ${c40.resumen_40_anios.temp_percentiles_c?.p50} / ${c40.resumen_40_anios.temp_percentiles_c?.p90} °C</b></div>
                <div>Tendencia por década: <b>${c40.resumen_40_anios.tendencia_temp_c_por_decada >= 0 ? "+" : ""}${c40.resumen_40_anios.tendencia_temp_c_por_decada} °C/década</b></div>
              </div>
              <div class="card-sub">
                <strong>Lluvia anual (${c40.resumen_40_anios.anios_analizados} años)</strong>
                <div>Media: <b>${c40.resumen_40_anios.lluvia_media_40a_mm} mm/año</b></div>
                <div>Percentiles p10 / p50 / p90: <b>${c40.resumen_40_anios.lluvia_percentiles_mm?.p10} / ${c40.resumen_40_anios.lluvia_percentiles_mm?.p50} / ${c40.resumen_40_anios.lluvia_percentiles_mm?.p90} mm</b></div>
                <div>Tendencia por década: <b>${c40.resumen_40_anios.tendencia_lluvia_mm_por_decada >= 0 ? "+" : ""}${c40.resumen_40_anios.tendencia_lluvia_mm_por_decada} mm/década</b></div>
              </div>
            </div>
            ${c40.comparacion_contra_anio_pasado ? `
              <div class="card-sub small" style="margin-bottom:12px">
                <strong>Comparación contra el mismo periodo del año pasado (${esc(c40.comparacion_contra_anio_pasado.ventana_actual)}):</strong>
                Lluvia 30d: <b>${c40.comparacion_contra_anio_pasado.lluvia_actual_mm} mm</b> vs ${c40.comparacion_contra_anio_pasado.lluvia_anio_pasado_mm} mm ·
                Temp 30d: <b>${c40.comparacion_contra_anio_pasado.temp_actual_c} °C</b> vs ${c40.comparacion_contra_anio_pasado.temp_anio_pasado_c} °C
              </div>
            ` : ""}
            <div class="card-sub small">
              <strong>Fechas históricas de helada (≤ 0 °C):</strong>
              Última en primavera: <b>${esc(c40.heladas_10_anios?.ultima_helada_primavera_mediana || "—")}</b> ·
              Primera en otoño: <b>${esc(c40.heladas_10_anios?.primera_helada_otono_mediana || "—")}</b> ·
              Ventana libre: <b>${c40.heladas_10_anios?.dias_libres_helada_aprox ?? "—"} días</b>
            </div>
          ` : `<p class="small mut">Consultando serie de 40 años en NASA POWER…</p>`}
        </div>

        <!-- Perfil del suelo por profundidad (USDA SSURGO) -->
        <div class="card">
          <div class="row-between" style="margin-bottom:10px">
            <h2 class="card-title" style="margin:0">${ic("soil", "sm")} <span>${esc(tr("soil_title"))}</span></h2>
            ${srcTag("USDA NRCS SSURGO", "Polígonos oficiales", "Base oficial de suelos de EE. UU. (USDA NRCS SSURGO)")}
          </div>
          ${!ss || ss.cobertura_encontrada === false ? `
            <p class="small mut">${esc(tr("nodata"))} — USDA SSURGO solo tiene cobertura dentro de EE. UU.</p>
          ` : `
            <p class="small" style="margin:0 0 8px">
              Serie dominante: <b>${esc(ss.serie_dominante || "—")}</b> · Drenaje: <b>${esc(ss.drenaje || "—")}</b> · Agua disponible (0–100 cm): <b>${ss.agua_disponible_0_100cm_mm ?? "—"} mm</b>
            </p>
            <div class="table-wrap">
              <table class="v2-table">
                <thead>
                  <tr><th>Profundidad (cm)</th><th>Materia orgánica (%)</th><th>pH</th><th>Arcilla (%)</th><th class="lv-agr">Densidad (g/cm³)</th><th class="lv-agr">Factor K erosión</th></tr>
                </thead>
                <tbody>
                  ${hz.map(h => `
                    <tr>
                      <td>${h.prof_inicio_cm}–${h.prof_fin_cm}</td>
                      <td>${h.materia_organica_pct ?? "—"}</td>
                      <td>${h.ph ?? "—"}</td>
                      <td>${h.arcilla_pct ?? "—"}</td>
                      <td class="lv-agr">${h.densidad_aparente_g_cm3 ?? "—"}</td>
                      <td class="lv-agr">${h.factor_k_erosion ?? "—"}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Sensores USGS, Ruta del Robot, CSV de sensores y Nitrógeno/pH -->
        <div class="card">
          <h2 class="card-title">${ic("sensor", "sm")} <span>${esc(tr("sens_title"))}</span></h2>
          <div class="small" style="margin-bottom:12px">
            <b>Estaciones de agua cercanas (USGS NWIS):</b>
            ${usgs.length ? `
              <div class="chip-row" style="margin-top:6px">
                ${usgs.map(s => `<span class="chip">${esc(s.parametro || s.codigo_parametro)}: <b>${esc(s.valor_actual)} ${esc(s.unidad || "")}</b> <span class="lv-agr">(${esc(s.nombre_estacion)})</span></span>`).join("")}
              </div>
            ` : `<span class="mut">${esc(tr("nodata"))}</span>`}
          </div>

          <div class="lv-agr small" style="margin-bottom:12px">
            <b>Últimas pasadas de satélite sobre este punto (NASA CMR):</b>
            <div class="chip-row" style="margin-top:6px">
              ${passes.length ? passes.map(p => `<span class="chip">${esc(p.short_name)} · ${esc((p.fecha_inicio_utc || "").slice(0, 10))}</span>`).join("") : `<span class="mut">${esc(tr("nodata"))}</span>`}
            </div>
          </div>

          <div class="row-wrap" style="margin-bottom:12px">
            <button type="button" class="btn btn-pri btn-sm" data-action="robot-route">${ic("compass", "sm")} <span>${esc(m("Generar ruta de muestreo para robot (5 cuadros críticos)", "Generate sampling route for robot (5 critical squares)", "Gerar rota de amostragem para robô (5 quadros críticos)"))}</span></button>
            <button type="button" class="btn btn-sec btn-sm" data-go-space="robot">${ic("upload", "sm")} <span>${esc(tr("go_robot_upload"))}</span></button>
          </div>
          <div id="v2-robot-out" class="small"></div>
          <div id="v2-sensors-out" class="small" style="margin-top:8px"></div>

          <div class="card-sub small" style="margin-top:12px">
            <strong>Nitrógeno (N) y pH medidos en tu suelo (rangos citados USDA NRCS)</strong>
            <div class="grid-2" style="margin-top:8px">
              <label>Nitrógeno (kg N/ha): <input type="number" class="field" id="v2-inp-n" value="${esc(window.V2.farmExtra.nKgHa)}" style="width:90px;min-height:36px"></label>
              <label>pH del suelo: <input type="number" class="field" id="v2-inp-ph" step="0.1" value="${esc(window.V2.farmExtra.phVal)}" style="width:90px;min-height:36px"></label>
            </div>
            <div id="v2-npk-msg" class="xs mut" style="margin-top:8px">
              Rango de referencia USDA NRCS: pH óptimo 6.0–7.0 para maíz/soya/trigo; si N &lt; 40 kg/ha se sugiere leguminosa fijadora (+50 a +90 kg N/ha).
            </div>
          </div>
        </div>
      `;
    },

    renderWaterBalanceSvg(rows) {
      const mes = (k) => { const i = window.MONTHS_KEYS.indexOf(k); return i < 0 ? k : new Date(2000, i, 1).toLocaleString(window.V2.lang, { month: "short" }); };
      rows = rows.map(x => ({ ...x, m: mes(x.m) }));
      const rawMax = Math.max(...rows.map(x => Math.max(x.rain || 0, x.et || 0, x.hi || 0)), 1);
      const step = rawMax > 200 ? 100 : rawMax > 80 ? 50 : 20;
      const max = Math.ceil(rawMax / step) * step;
      const H = 165, W = 38, L = 38;
      const y = v => H - (v / max) * H;
      const grid = Array.from({ length: max / step + 1 }, (_, i) => i * step);

      const calCells = rows.map(x => {
        const st = x.rain == null || x.et == null ? "nodata" : x.lo != null ? (x.rain < x.lo ? "riesgo" : x.rain < x.hi ? "atencion" : "ok") : x.et > x.rain ? "riesgo" : "ok";
        const bg = st === "ok" ? "var(--ok)" : st === "atencion" ? "var(--atencion)" : st === "riesgo" ? "var(--riesgo)" : "var(--superficie-2)";
        const fg = st === "nodata" ? "var(--texto-suave)" : "#fff";
        return `<div style="text-align:center;padding:5px 2px;border-radius:6px;background:${bg};color:${fg};font-size:11px;font-weight:600">${esc(x.m)}</div>`;
      }).join("");

      return `
        <div style="display:grid;grid-template-columns:repeat(12,1fr);gap:4px;margin-bottom:10px">${calCells}</div>
        <svg viewBox="0 0 ${12 * W + L + 12} ${H + 28}" width="100%" role="img" aria-label="Monthly water balance (mm)">
          ${grid.map(v => `
            <line x1="${L}" x2="${12 * W + L}" y1="${y(v)}" y2="${y(v)}" stroke="var(--linea)"/>
            <text x="${L - 5}" y="${y(v) + 4}" text-anchor="end" fill="var(--texto-suave)" font-size="10">${v}</text>
          `).join("")}
          <text x="4" y="12" fill="var(--texto-suave)" font-size="10">mm</text>
          ${rows.map((x, i) => {
            const xx = L + 6 + i * W;
            const hr = ((x.rain || 0) / max) * H;
            const he = ((x.et || 0) / max) * H;
            return `
              <rect x="${xx}" y="${H - hr}" width="13" height="${hr}" rx="2" fill="var(--agua)"/>
              <rect x="${xx + 14}" y="${H - he}" width="13" height="${he}" rx="2" fill="var(--suelo)"/>
              ${x.lo != null && x.hi != null ? `<line x1="${xx + 20.5}" x2="${xx + 20.5}" y1="${y(x.lo)}" y2="${y(x.hi)}" stroke="var(--texto)" stroke-width="2"/>` : ""}
              <text x="${xx + 13}" y="${H + 16}" text-anchor="middle" fill="var(--texto-suave)" font-size="10">${esc(x.m)}</text>
            `;
          }).join("")}
        </svg>
        <div class="row-wrap xs mut" style="margin-top:6px">
          <span><b style="color:var(--agua)">■</b> Lluvia mensual (NASA POWER, mm)</span>
          <span><b style="color:var(--suelo)">■</b> Consumo del cultivo (OpenET, mm, con barra de rango entre modelos)</span>
        </div>
      `;
    },

    // -------------------------------------------------------------------------
    // PANTALLA 9: Inteligencia Artificial (SI Honesta)
    // -------------------------------------------------------------------------
    renderScreen9IA() {
      const ai = window.V2.aiResp;
      const models = window.V2.modelsMeta?.modelos || [];
      const m1 = (window.V2.modelsMeta?.modelos || []).find(m => m.id === "M1");
      const weights = m1?.importancia_variables || [];

      return `
        <div class="card">
          <div class="row-between" style="margin-bottom:8px">
            <h2 class="card-title" style="margin:0">${ic("ai", "lg")} <span>${esc(tr("ai_title"))}</span></h2>
            <span class="demo-tag">${ic("atencion", "sm")} <span>${esc(tr("ai_disclaimer"))}</span></span>
          </div>

          <div class="grid-2 small" style="margin-bottom:12px">
            <div class="card-sub">
              <div class="mut xs">${esc(tr("ai_acc_lbl"))}</div>
              <div class="sem-num">${m1?.acierto_medido_pct != null ? esc(m1.acierto_medido_pct) + "%" : esc(tr("nodata"))}</div>
              <div class="xs mut">${m1?.referencia_base_pct != null ? esc(trf("ai_base", { b: m1.referencia_base_pct })) : ""}</div>
            </div>
            <div class="card-sub">
              <div class="mut xs">${esc(tr("ai_train_lbl"))}</div>
              <div style="font-weight:600;margin-top:4px">${esc(m1?.region_entrenamiento || tr("nodata"))}</div>
              <div class="xs mut">${esc(tr("ai_zone_note"))}</div>
            </div>
          </div>

          <div class="row-wrap" style="margin-bottom:12px">
            <button type="button" class="btn btn-pri" data-action="run-ai">${ic("ai", "sm")} <span>${esc(tr("ai_run_btn"))}</span></button>
          </div>

          ${ai && ai.estado === "OK" ? `
            <div class="notice ok" style="margin-bottom:12px">
              ${ic("ok", "lg")}
              <div class="small">
                <b>Resultado por cuadro (Temporada ${esc(ai.anio)}):</b>
                ${Object.entries(ai.resumen || {}).map(([k, p]) => `${esc(k)}: <b>${p}%</b>`).join(" · ")}
                <div class="xs mut">${esc(tr("ai_disclaimer"))}</div>
              </div>
            </div>
          ` : ""}
        </div>

        <!-- Fichas honestas de los modelos -->
        <div class="card">
          <h2 class="card-title">${ic("book", "sm")} <span>${esc(tr("ai_models_title"))}</span></h2>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${models.map(m => {
              const name = typeof m.nombre === "object" ? (m.nombre[window.V2.lang] || m.nombre.es || m.nombre.en) : m.nombre;
              const acc = m.metrica_acierto || (m.acierto_medido_pct != null ? `${m.acierto_medido_pct}%` : "En validación");
              const train = m.datos_entrenamiento || `${m.entradas || ""} · ${m.region_entrenamiento || ""}`;
              const lim = m.limitacion || m.limites || "";
              return `
                <div class="card-sub small">
                  <div class="row-between">
                    <strong>${esc(m.id)} · ${esc(name)}</strong>
                    <span class="chip">${esc(m.estado || "ACTIVO")}</span>
                  </div>
                  <div style="margin-top:4px"><b>Acierto medido:</b> ${esc(acc)}</div>
                  <div><b>Entrenamiento:</b> ${esc(train)}</div>
                  <div class="mut"><b>Límite:</b> ${esc(lim)} (Predicción, no medición)</div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        ${weights.length ? `
          <div class="card">
            <h2 class="card-title">${ic("chart", "sm")} <span>${esc(tr("ai_imp_title"))}</span></h2>
            ${weights.map(w => `
              <div class="small" style="margin:8px 0">
                <div class="row-between"><span>${esc(w.variable)}</span><b>${w.caida_acierto_pts} pts</b></div>
                <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, w.caida_acierto_pts * 20)}%"></div></div>
              </div>
            `).join("")}
            <div style="margin-top:8px">${srcTag("Permutación en bloque no visto", "Sentinel-2 + USDA CDL 2021")}</div>
          </div>
        ` : ""}

        <!-- Diagnóstico provisional de foto de hoja -->
        <div class="card">
          <div class="row-between" style="margin-bottom:8px">
            <h2 class="card-title" style="margin:0">${ic("leaf", "sm")} <span>${esc(tr("ai_leaf_title"))}</span></h2>
            <span class="demo-tag">${esc(tr("ai_leaf_disclaimer"))}</span>
          </div>
          <input type="file" class="field" id="v2-leaf-inp" accept="image/*">
          <canvas id="v2-leaf-cv" width="160" height="160" hidden></canvas>
          <div id="v2-leaf-out" class="small" style="margin-top:10px"></div>
        </div>
      `;
    },

    // -------------------------------------------------------------------------
    // PANTALLA 10: Datos, Recolección, Fuentes, Vacíos, Catálogo (1330 capas)
    // -------------------------------------------------------------------------
    renderScreen10FuentesCatalogo() {
      const D = window.V2.D;
      const o = D?.telemetria_oficial_en_vivo || {};
      const rec = window.V2.recolData;
      const cat = window.V2.catalog;

      const srcMap = [
        ["nasa_power_v10", "NASA POWER"],
        ["usda_nrcs_ssurgo", "USDA SSURGO"],
        ["usgs_water_services_nwis", "USGS Water"],
        ["microsoft_planetary_computer_stac", "Planetary Computer"],
        ["nasa_earthdata_cmr_pasadas", "NASA CMR"],
        ["usfs_landfire_vegetacion", "LANDFIRE"],
        ["meteomatics_weather_1km", "Meteomatics"],
        ["openet_api", "OpenET"],
        ["usda_ams_market_news", "USDA AMS MARS"]
      ];

      const gaps = [
        "El calendario de suelo desnudo y los rangos de evapotranspiración existen solo donde OpenET tiene cobertura (EE. UU. continental).",
        "Nitrógeno fijado en kg/ha: ninguna fuente satelital lo mide de forma directa; los rangos mostrados son referencias agronómicas del USDA NRCS.",
        "No visible desde el espacio: historial de herbicidas, nematodos de raíz y salinidad submétrica.",
        "Cada fuente se presenta en su resolución nativa (10 m a 50 km) sin inventar interpolaciones."
      ];

      return `
        <!-- Estado en vivo de las 9 fuentes -->
        <div class="card">
          <div class="row-between" style="margin-bottom:10px">
            <h2 class="card-title" style="margin:0">${ic("satellite", "sm")} <span>${esc(tr("src_status_title"))}</span></h2>
            <button type="button" class="btn btn-sec btn-sm lv-sci" data-action="toggle-json">${esc(m("Ver JSON oficial en vivo", "View live official JSON", "Ver JSON oficial ao vivo"))}</button>
          </div>
          <div class="chip-row">
            ${srcMap.map(([k, name]) => {
              const obj = o[k];
              const st = !obj || obj.estado === "ERROR" ? "riesgo" : (obj.estado === "SIN_COBERTURA" || obj.cobertura_encontrada === false) ? "atencion" : "ok";
              const stTxt = st === "ok" ? "responde" : st === "atencion" ? "sin cobertura aquí" : "sin dato / pendiente";
              return `<span class="sem-badge ${st}">${ic(st === "ok" ? "ok" : "atencion", "sm")} <span>${esc(name)} · ${esc(stTxt)}</span></span>`;
            }).join("")}
          </div>
          <pre id="v2-raw-json" class="lv-sci card-sub xs" hidden style="max-height:300px;overflow:auto;margin-top:10px">${esc(D ? JSON.stringify(D, null, 2) : "")}</pre>
        </div>

        <!-- Estado de Recolección de Datos (/api/v1/recoleccion) -->
        <div class="card">
          <h2 class="card-title">${ic("chart", "sm")} <span>${esc(tr("recol_title"))}</span></h2>
          ${!rec ? `<p class="small mut">Cargando estado de recolectores…</p>` : `
            <div class="grid-2 small" style="margin-bottom:12px">
              ${(rec.fuentes || []).map(f => {
                const pct = f.total ? Math.min(100, Math.round((100 * f.hechas) / f.total)) : 0;
                return `
                  <div class="card-sub">
                    <div class="row-between"><b>${esc(f.fuente)}</b><span class="chip">${esc(f.estado)}</span></div>
                    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
                    <div class="xs mut" style="margin-top:4px">${f.hechas}/${f.total} hechas · ${f.errores} errores</div>
                  </div>
                `;
              }).join("")}
            </div>
            <div class="small" style="margin-bottom:8px">
              <b>Etiquetas de cultivo (USDA CDL 2021):</b>
              <div class="chip-row" style="margin-top:4px">
                ${(rec.clases_cultivo || []).map(c => `<span class="chip">${esc(c.clase)}: <b>${c.n}</b></span>`).join("")}
              </div>
            </div>
            <div class="table-wrap">
              <table class="v2-table">
                <thead><tr><th>Fuente / Base</th><th>Variable / Tabla</th><th>Cantidad</th><th>Rango medido</th></tr></thead>
                <tbody>
                  ${(rec.variables || []).map(v => `<tr><td>${esc(v.fuente)}</td><td>${esc(v.variable)}</td><td>${v.n} valores</td><td>${v.min} … ${v.max}</td></tr>`).join("")}
                  ${(rec.tablas || []).map(t => `<tr><td>${esc(t.base)}</td><td>${esc(t.tabla)}</td><td>${t.filas} filas</td><td>—</td></tr>`).join("")}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Vacíos de información y Resoluciones -->
        <div class="grid-2">
          <div class="card">
            <h2 class="card-title">${ic("info", "sm")} <span>${esc(tr("gaps_title"))}</span></h2>
            <ul class="small" style="margin:0;padding-left:18px">
              ${gaps.map(gTxt => `<li style="margin-bottom:6px">${esc(gTxt)}</li>`).join("")}
            </ul>
          </div>
          <div class="card">
            <h2 class="card-title">${ic("layers", "sm")} <span>${esc(tr("harm_title"))}</span></h2>
            <div class="table-wrap">
              <table class="v2-table">
                <thead><tr><th>Fuente</th><th>Resolución</th><th>Uso</th></tr></thead>
                <tbody>
                  ${window.RES_V2.map(([s, r, u]) => `<tr><td><b>${esc(s)}</b></td><td>${esc(r)}</td><td>${esc(u[window.V2.lang] || u.es)}</td></tr>`).join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Catálogo Completo (1330 capas GIBS + LANDFIRE + PC + USGS + POWER + MARS) -->
        <div class="card" id="v2-full-catalog">
          <h2 class="card-title">${ic("layers", "sm")} <span>${esc(tr("cat_title"))}</span></h2>
          ${!cat ? `<p class="small mut">Cargando catálogo de 1330 capas…</p>` : this.renderCatalogExplorer(cat)}
        </div>
      `;
    },

    renderCatalogExplorer(cat) {
      const f = window.V2.catFilter;
      const q = (f.q || "").toLowerCase().trim();
      const SIN = { lluvia: "precipitation rain imerg", chuva: "precipitation rain imerg", humedad: "soil moisture smap", umidade: "soil moisture smap", verdor: "ndvi evi vegetation", vegetacion: "ndvi evi vegetation lai", "vegetación": "ndvi evi vegetation lai",
        temperatura: "temperature lst", calor: "temperature lst", nieve: "snow ndsi", neve: "snow ndsi", fuego: "fire thermal", incendio: "fire thermal", fogo: "fire thermal", nubes: "cloud", nuvens: "cloud", humo: "aerosol smoke", polvo: "aerosol dust",
        inundacion: "flood", "inundación": "flood", enchente: "flood", sequia: "drought soil moisture", "sequía": "drought soil moisture", seca: "drought soil moisture", hielo: "ice", gelo: "ice", noche: "night", noite: "night", cultivo: "crop ndvi lai", cultura: "crop ndvi lai" };
      const terminos = q ? [q, ...(SIN[q] || "").split(" ").filter(Boolean)] : [];
      const hit = (...s) => { const t = s.join(" ").toLowerCase(); return !q || terminos.some(x => t.includes(x)); };
      const gibsAll = cat.gibs || [];
      const base = gibsAll.filter(l => (!f.dedup || l.representante) && hit(l.titulo, l.id, l.subtitulo || "", l.grupo || ""));
      const filtered = base.filter(l =>
        (f.util === "all" || l.utilidad === f.util) &&
        (f.vivo === "all" || (f.vivo === "live") === !!l.vivo) &&
        (f.uso === "all" || l.uso === f.uso)
      );

      const shown = filtered.slice(0, f.limit);

      return `
        <div class="row-wrap" style="margin-bottom:10px">
          <input type="search" class="field" id="v2-cat-q" placeholder="Buscar entre ${gibsAll.length} capas GIBS, LANDFIRE, Planetary Computer, POWER, MARS…" value="${esc(f.q)}" style="flex:1">
          <label class="btn btn-sec btn-sm">
            <input type="checkbox" id="v2-cat-dedup" ${f.dedup ? "checked" : ""}>
            <span>Una por familia (ocultar repetidas)</span>
          </label>
        </div>

        <div class="row-wrap small" style="margin-bottom:12px">
          <select class="field" data-cat-f="util" style="min-height:36px;padding:4px 8px">
            <option value="all" ${f.util === "all" ? "selected" : ""}>Utilidad: Todas (${base.length})</option>
            <option value="alta" ${f.util === "alta" ? "selected" : ""}>Alta para el campo</option>
            <option value="media" ${f.util === "media" ? "selected" : ""}>Contexto</option>
            <option value="baja" ${f.util === "baja" ? "selected" : ""}>Baja</option>
          </select>
          <select class="field" data-cat-f="vivo" style="min-height:36px;padding:4px 8px">
            <option value="all" ${f.vivo === "all" ? "selected" : ""}>Estado: Todas</option>
            <option value="live" ${f.vivo === "live" ? "selected" : ""}>En vivo</option>
            <option value="hist" ${f.vivo === "hist" ? "selected" : ""}>Históricas</option>
          </select>
          <span class="mut">Mostrando <b>${shown.length}</b> de <b>${filtered.length}</b> capas GIBS (${gibsAll.length} totales)</span>
        </div>

        <div style="max-height:420px;overflow-y:auto;border:1px solid var(--linea);border-radius:12px;padding:4px 12px;margin-bottom:12px">
          ${shown.map(l => {
            const on = window.V2Map.isLayerOn("gibs", l.id);
            return `
              <div class="switch-row">
                <div>
                  <div style="font-weight:600;font-size:14px">${esc(l.titulo_largo || l.titulo)}</div>
                  <div class="xs mut">${esc(l.id)} · ${esc(l.frecuencia || "")} · ${esc(l.desde || "")} → ${esc(l.hasta || "hoy")}</div>
                </div>
                <input type="checkbox" class="switch-inp" data-toggle-kind="gibs" data-toggle-id="${esc(l.id)}" ${on ? "checked" : ""}>
              </div>
            `;
          }).join("")}
        </div>
        ${filtered.length > f.limit ? `<button type="button" class="btn btn-sec btn-sm" id="v2-cat-more">Mostrar 80 más (${shown.length} / ${filtered.length})</button>` : ""}

        <div class="grid-2 small" style="margin-top:12px">
          <details class="card-sub">
            <summary style="font-weight:600">LANDFIRE (${(cat.landfire || []).length} capas WMS)</summary>
            <div style="max-height:220px;overflow-y:auto;margin-top:8px">
              ${(cat.landfire || []).slice(0, 50).map(l => `
                <div class="switch-row" style="padding:6px 0">
                  <span class="xs">${esc(l.titulo)} <small class="mut">(${esc(l.id)})</small></span>
                  <input type="checkbox" class="switch-inp" data-toggle-kind="lf" data-toggle-id="${esc(l.id)}" ${window.V2Map.isLayerOn("lf", l.id) ? "checked" : ""}>
                </div>
              `).join("")}
            </div>
          </details>
          <details class="card-sub">
            <summary style="font-weight:600">Planetary Computer (${(cat.planetary || []).length}) · POWER (${(cat.power || []).length}) · MARS (${(cat.mars || []).length})</summary>
            <div style="max-height:220px;overflow-y:auto;margin-top:8px">
              ${(cat.planetary || []).slice(0, 30).map(c => `
                <div class="switch-row" style="padding:6px 0">
                  <span class="xs"><b>${esc(c.titulo)}</b> <small class="mut">(${esc(c.id)})</small></span>
                  <input type="checkbox" class="switch-inp" data-toggle-kind="pc" data-toggle-id="${esc(c.id)}" ${window.V2Map.isLayerOn("pc", c.id) ? "checked" : ""}>
                </div>
              `).join("")}
            </div>
          </details>
        </div>
      `;
    },

    // -------------------------------------------------------------------------
    // PANTALLA 1: Modal de Bienvenida (< 3 toques para ver un resultado)
    // -------------------------------------------------------------------------
    renderWelcomeModal() {
      const lang = window.V2.lang;
      return `
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="v2-w-title">
          <div class="welcome-hero">
            <div class="row-between" style="margin-bottom:8px">
              <span class="sem-badge ok">${ic("satellite", "sm")} <span>Terra Lab · NASA Space Apps 2026</span></span>
              <button type="button" class="btn btn-txt btn-sm" data-close-modal="1" aria-label="Cerrar">${ic("close", "sm")}</button>
            </div>
            <h1 id="v2-w-title" style="font-size:22px;line-height:1.25;margin:0 0 12px">${esc(tr("w_problem"))}</h1>
            ${this.renderVitrina()}
            <div style="display:flex;flex-direction:column;gap:8px">
              <button type="button" class="btn btn-pri" style="width:100%;font-size:15px;min-height:46px" data-action="abrir-ubicacion">
                ${ic("draw", "sm")} <span>${esc(tr("add_field"))}</span>
              </button>
              <div class="grid-2">
                <button type="button" class="btn btn-sec" data-action="gps">${ic("gps", "sm")} <span>${esc(tr("w_gps"))}</span></button>
                <button type="button" class="btn btn-sec" data-action="focus-search">${ic("search", "sm")} <span>${esc(tr("w_search"))}</span></button>
              </div>
            </div>
          </div>

        </div>
      `;
    },

    // Vitrina de lo que distingue a Terra Lab. Las cifras salen del servidor (capas del catálogo, acierto medido); si no han llegado, no se muestran.
    renderVitrina() {
      const V = window.V2, n = V.catalog?.gibs?.length, m1 = (V.modelsMeta?.modelos || []).find(x => x.id === "M1");
      const items = [
        ["ai", "vt_si_t", "vt_si_d", "si"], ["satellite", "vt_nasa_t", n ? trf("vt_nasa_d", { n }) : tr("vt_nasa_d0"), ""], ["grid", "vt_5m_t", "vt_5m_d", ""],
        ["sensor", "vt_robot_t", "vt_robot_d", ""], ["info", "vt_src_t", "vt_src_d", ""], ["book", "vt_lang_t", "vt_lang_d", "lang"]];
      return `
        <div class="vitrina" role="list" aria-label="${esc(tr("vt_aria"))}">
          ${items.map(([icono, t, d, tipo]) => `
            <div class="vitrina-item ${tipo === "si" ? "vitrina-si" : ""}" role="listitem">
              <span class="vitrina-ic">${ic(icono, "lg")}</span>
              <div><strong>${esc(tr(t))}</strong>
                <div class="small">${esc(d.startsWith("vt_") ? tr(d) : d)}</div>
                ${tipo === "si" ? `${m1?.acierto_medido_pct != null ? `<div class="xs" style="margin-top:4px;opacity:.9">${esc(trf("vt_si_acc", { a: m1.acierto_medido_pct, b: m1.referencia_base_pct }))}</div>` : ""}<button type="button" class="btn btn-sm vitrina-btn" id="v2-si-abrir">${esc(tr("vt_si_btn"))}</button>` : ""}
                ${tipo === "lang" ? `<div class="lang-pill" role="group" aria-label="${esc(tr("vt_lang_t"))}" style="margin-top:6px">${[["es", "Español"], ["en", "English"], ["pt", "Português"]].map(([l, nom]) => `<button type="button" class="${V.lang === l ? "active" : ""}" data-set-lang="${l}" aria-pressed="${V.lang === l}">${nom}</button>`).join("")}</div>` : ""}
              </div>
            </div>`).join("")}
        </div>`;
    },

    // -------------------------------------------------------------------------
    // PANTALLA 11: Ajustes (Idioma, Tema, Modo, Unidades)
    // -------------------------------------------------------------------------
    renderSettingsModal() {
      const V = window.V2;
      return `
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="v2-set-title">
          <div class="row-between" style="margin-bottom:12px">
            <h2 id="v2-set-title" class="card-title" style="margin:0">${ic("settings", "lg")} <span>${esc(tr("set_title"))}</span></h2>
            <button type="button" class="btn btn-txt btn-sm" data-close-modal="1" aria-label="Cerrar">${ic("close", "sm")}</button>
          </div>

          <div style="display:flex;flex-direction:column;gap:16px">
            <label class="small">
              <b>${esc(tr("set_lang"))}</b><br>
              <select class="field" id="v2-set-lang" style="width:100%;margin-top:6px">
                <option value="es" ${V.lang === "es" ? "selected" : ""}>Español (ES)</option>
                <option value="en" ${V.lang === "en" ? "selected" : ""}>English (EN)</option>
                <option value="pt" ${V.lang === "pt" ? "selected" : ""}>Português (PT)</option>
              </select>
            </label>

            <label class="small">
              <b>${esc(tr("set_theme"))}</b><br>
              <select class="field" id="v2-set-theme" style="width:100%;margin-top:6px">
                <option value="auto" ${V.themePref === "auto" ? "selected" : ""}>${esc(tr("th_auto"))}</option>
                <option value="light" ${V.themePref === "light" ? "selected" : ""}>${esc(tr("th_light"))}</option>
                <option value="dark" ${V.themePref === "dark" ? "selected" : ""}>${esc(tr("th_dark"))}</option>
              </select>
            </label>

            <label class="small">
              <b>${esc(tr("set_mode"))}</b><br>
              <select class="field" id="v2-set-mode" style="width:100%;margin-top:6px">
                <option value="farmer" ${V.mode === "farmer" ? "selected" : ""}>${esc(tr("mode_farmer"))}</option>
                <option value="agronomist" ${V.mode === "agronomist" ? "selected" : ""}>${esc(tr("mode_agr"))}</option>
                <option value="scientist" ${V.mode === "scientist" ? "selected" : ""}>${esc(tr("mode_sci"))}</option>
              </select>
            </label>

            <label class="small">
              <b>${esc(tr("set_units"))}</b><br>
              <select class="field" id="v2-set-units" style="width:100%;margin-top:6px">
                <option value="metric" ${V.units === "metric" ? "selected" : ""}>${esc(tr("u_metric"))}</option>
                <option value="imperial" ${V.units === "imperial" ? "selected" : ""}>${esc(tr("u_imperial"))}</option>
              </select>
            </label>
          </div>
        </div>
      `;
    },

    // -------------------------------------------------------------------------
    // Modal de Glosario (14 términos clave en ES, EN, PT)
    // -------------------------------------------------------------------------
    renderGlossaryModal() {
      const lang = window.V2.lang;
      return `
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="v2-gl-title">
          <div class="row-between" style="margin-bottom:12px">
            <h2 id="v2-gl-title" class="card-title" style="margin:0">${ic("book", "lg")} <span>${esc(tr("nav_glosario"))}</span></h2>
            <button type="button" class="btn btn-txt btn-sm" data-close-modal="1" aria-label="Cerrar">${ic("close", "sm")}</button>
          </div>
          <input type="search" class="field" id="v2-gl-q" placeholder="Filtrar término…" style="width:100%;margin-bottom:12px">
          <div id="v2-gl-list" style="display:flex;flex-direction:column;gap:10px">
            ${window.GLOSSARY_V2.map(([term, descObj]) => `
              <div class="card-sub v2-gl-item">
                <strong>${esc(term)}</strong>
                <div class="small mut" style="margin-top:4px">${esc(descObj[lang] || descObj.es)}</div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    },

    // =========================================================================
    // CÁPSULA E — SECCIÓN 1: INICIO (Tablero completo del terreno)
    // =========================================================================
    renderInicioWorkspace() {
      const D = window.V2.D;
      const o = D?.telemetria_oficial_en_vivo || {};
      const pw = g(o, "nasa_power_v10.resumen_anual") || {};
      const r = window.V2.terrainResp;
      const robotUltimas = window.V2Robot?.ultimasLecturas || [];
      const robotEstado = window.V2Robot?.robotData || {};
      const lang = window.V2.lang;
      const mode = window.V2.mode;

      // Lecturas dinámicas del robot y sonda NPK 8-en-1
      const conocidas = {
        temp_suelo_c: { ic: "sun", nombre: lang === "en" ? "Soil temperature" : lang === "pt" ? "Temperatura do solo" : "Temperatura del suelo", defUnidad: "°C" },
        humedad_suelo_pct: { ic: "water", nombre: lang === "en" ? "Soil moisture" : lang === "pt" ? "Umidade do solo" : "Humedad del suelo", defUnidad: "%" },
        ec_ms_cm: { ic: "sensor", nombre: lang === "en" ? "Salinity (EC)" : lang === "pt" ? "Salinidade (EC)" : "Salinidad (EC)", defUnidad: "µS/cm" },
        ph: { ic: "soil", nombre: "pH", defUnidad: "" },
        n_mg_kg: { ic: "leaf", nombre: lang === "en" ? "Nitrogen (N)" : lang === "pt" ? "Nitrogênio (N)" : "Nitrógeno disponible (N)", defUnidad: "mg/kg" },
        p_mg_kg: { ic: "soil", nombre: lang === "en" ? "Phosphorus (P)" : lang === "pt" ? "Fósforo (P)" : "Fósforo disponible (P)", defUnidad: "mg/kg" },
        k_mg_kg: { ic: "soil", nombre: lang === "en" ? "Potassium (K)" : lang === "pt" ? "Potássio (K)" : "Potasio disponible (K)", defUnidad: "mg/kg" },
        tds: { ic: "sensor", nombre: "TDS", defUnidad: "ppm" },
        humedad: { ic: "water", nombre: lang === "en" ? "Air humidity" : lang === "pt" ? "Umidade do ar" : "Humedad ambiente", defUnidad: "%" },
        temperatura: { ic: "sun", nombre: lang === "en" ? "Air temp" : lang === "pt" ? "Temperatura do ar" : "Temperatura ambiente", defUnidad: "°C" },
        velocidad: { ic: "rover", nombre: lang === "en" ? "Speed" : lang === "pt" ? "Velocidade" : "Velocidad", defUnidad: "km/h" },
        rotacion: { ic: "sensor", nombre: lang === "en" ? "Heading" : lang === "pt" ? "Orientação" : "Rotación", defUnidad: "°" },
        bateria_pct: { ic: "sensor", nombre: lang === "en" ? "Robot battery" : lang === "pt" ? "Bateria do robô" : "Batería del robot", defUnidad: "%" }
      };

      // 4. Lado a lado: Datos locales (Robot / Sonda NPK) vs Datos de la nube (NASA / Satélite)
      const rHumedad = robotUltimas.find(x => x.variable === "humedad_suelo_pct")?.valor ?? robotUltimas.find(x => x.variable === "humedad")?.valor;
      const sHumedad = pw.humedad_zona_radicular_media_pct;
      const diffHum = (rHumedad != null && sHumedad != null) ? (rHumedad - sHumedad).toFixed(1) : null;

      const rTemp = robotUltimas.find(x => x.variable === "temp_suelo_c")?.valor ?? robotUltimas.find(x => x.variable === "temperatura")?.valor;
      const sTemp = pw.temp_media_anual_c;
      const diffTemp = (rTemp != null && sTemp != null) ? (rTemp - sTemp).toFixed(1) : null;

      // Promedios 24 h / 7 d / 30 d calculados con las lecturas reales
      const lect = window.V2Robot?.lecturas || [];
      const ahora = Date.now();
      const media = (vals) => vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
      const fmt = (n) => (n == null ? "—" : (Math.round(n * 100) / 100).toString());
      const statsRows = robotUltimas.map(u => {
        const serie = lect.filter(l => l.variable === u.variable && typeof l.valor === "number");
        const celda = (h) => {
          const v = serie.filter(l => ahora - new Date(l.t).getTime() <= h * 3600e3).map(l => l.valor);
          return v.length ? `Media: <b>${fmt(media(v))}</b> (mín ${fmt(Math.min(...v))} · máx ${fmt(Math.max(...v))})` : "sin datos";
        };
        return `<tr><td><b>${esc(u.nombre || u.variable)}</b></td><td>${celda(24)}</td><td>${celda(168)}</td><td>${celda(720)}</td></tr>`;
      }).join("") || `<tr><td colspan="4" class="mut">Aún no hay lecturas del robot.</td></tr>`;

      // Alertas activas recientes
      const ultAlertas = (window.V2Alertas?.alertasList || []).slice(0, 3);

      return `
        <div class="workspace-inner inicio-workspace-inner">
          ${window.V2.loc ? "" : this.renderVitrina()}
          ${window.V2.loc ? "" : `<div class="card empty-hero">
            <h2>${esc(lang === "en" ? "Create your first field" : lang === "pt" ? "Crie seu primeiro terreno" : "Crea tu primer terreno")}</h2>
            <p>${esc(lang === "en" ? "Pick the place and crop. With that we bring satellite data, weather and recommendations." : lang === "pt" ? "Escolha o lugar e a cultura. Com isso trazemos dados de satélite, clima e recomendações." : "Elige el lugar y el cultivo. Con eso traemos datos satelitales, clima y recomendaciones.")}</p>
            <button type="button" class="btn btn-pri" data-action="abrir-ubicacion" style="min-height:48px;padding:0 24px">${esc(lang === "en" ? "Add my field" : lang === "pt" ? "Adicionar meu terreno" : "Agregar mi terreno")}</button>
          </div>`}
          <!-- Banner de estado del terreno -->
          <div class="card inicio-hero-card">
            <div class="row-between" style="margin-bottom:8px">
              <div>
                <span class="xs mut" style="font-weight:700;text-transform:uppercase;letter-spacing:0.04em">Tablero de campo</span>
                <h1 style="font-size:22px;margin:2px 0 0;font-weight:800">${esc(window.V2.loc?.label || "Mi terreno")}</h1>
                <div class="coord-mono xs mut">${esc(fmtCoordNice(window.V2.loc?.lat, window.V2.loc?.lon))} · ${r?.area_ha ? `${r.area_ha.toFixed(1)} ha` : ""}</div>
              </div>
              <div class="row-wrap" style="gap:6px">
                <button type="button" class="btn btn-sec btn-sm" data-go-space="mapa">
                  ${ic("map", "sm")} <span>Ver mapa satelital completo</span>
                </button>
                <button type="button" class="btn btn-sec btn-sm" data-action="abrir-ubicacion">
                  ${ic("draw", "sm")} <span>Editar terreno</span>
                </button>
              </div>
            </div>

            <!-- Modos de coloración de cuadrícula -->
            <div class="row-between card-sub" style="margin-top:10px">
              <span class="small"><b>Colorear sectores del terreno por:</b></span>
              <div class="row-wrap" style="gap:4px">
                <button type="button" class="btn btn-sec btn-sm ${window.V2.colorMode === "ndvi" ? "btn-pri" : ""}" data-color-mode="ndvi">Verdor (NDVI)</button>
                <button type="button" class="btn btn-sec btn-sm ${window.V2.colorMode === "sev" ? "btn-pri" : ""}" data-color-mode="sev">Riesgo</button>
                <button type="button" class="btn btn-sec btn-sm ${window.V2.colorMode === "zones" ? "btn-pri" : ""}" data-color-mode="zones">3 Zonas</button>
                <button type="button" class="btn btn-sec btn-sm ${window.V2.colorMode === "anom" ? "btn-pri" : ""}" data-color-mode="anom">Anomalías</button>
              </div>
            </div>
          </div>

          <!-- VIDEO EN LOOP DE HARDWARE REAL Y TELEMETRÍA IOT -->
          <div class="rover-hardware-card">
            <div class="rover-video-container">
              <video id="rover-main-video" autoplay muted playsinline loop src="recursos/rover_prueba_1.mp4"></video>
              <div class="rover-video-overlay">
                <div class="rover-video-live-pill"><span class="rover-live-pulse"></span> ${esc(m("Hardware real · Pruebas IoT en loop", "Real hardware · Looping IoT test feed", "Hardware real · Testes IoT em loop"))}</div>
                <div class="rover-video-switcher">
                  <button type="button" class="rover-vid-btn active" data-vid-src="recursos/rover_prueba_1.mp4">${esc(m("Prueba 1 (Banco)", "Test 1 (Bench)", "Teste 1 (Bancada)"))}</button>
                  <button type="button" class="rover-vid-btn" data-vid-src="recursos/rover_prueba_2.mp4">${esc(m("Prueba 2 (Campo)", "Test 2 (Field)", "Teste 2 (Campo)"))}</button>
                </div>
              </div>
            </div>
            <div class="rover-hardware-meta">
              <div class="rover-hardware-title">
                <b>${ic("sensor", "sm")} ${esc(m("Pruebas del robot que construimos", "Tests of the robot we built", "Testes do robô que construímos"))}</b>
                <span class="sem-badge ok" style="font-size:11px">${esc(m("Telemetría de pruebas", "Test telemetry", "Telemetria de testes"))}</span>
              </div>
              <p class="small mut" style="margin:4px 0 8px">
                ${esc(m(
                  "Estos videos muestran el hardware real del rover durante ensayos de banco y terreno. Las lecturas en la hoja de Google (rotación, temperatura, velocidad) son reales y emitidas por este dispositivo.",
                  "These videos show the real rover hardware during bench and field trials. The readings in the Google Sheet (rotation, temperature, speed) are real and emitted by this device.",
                  "Estes vídeos mostram o hardware real do robô em testes de bancada e campo. As leituras na planilha Google (rotação, temperatura, velocidade) são reais e emitidas por este dispositivo."
                ))}
              </p>
              <div class="notice info" style="padding:8px 12px;font-size:12px;line-height:1.4">
                ${ic("info", "sm")}
                <span><b>${esc(m("Distinción agronómica:", "Agronomic distinction:", "Distinção agronômica:"))}</b> ${esc(m(
                  "Los datos de la hoja reflejan el banco físico de pruebas del robot (Querétaro, 20.61° N). La verdad agronómica del terreno en Iowa (42.10° N) se calibra con precisión mediante las constelaciones Sentinel-2 L2A (10 m) y NASA POWER.",
                  "Google Sheet data reflects the robot's physical test bench (Querétaro, 20.61° N). The agronomic ground truth for the Iowa parcel (42.10° N) is precisely calibrated via Sentinel-2 L2A (10 m) and NASA POWER.",
                  "Os dados da planilha refletem a bancada física de testes do robô (Querétaro, 20.61° N). A verdade agronômica do terreno em Iowa (42.10° N) é calibrada com precisão pelas constelações Sentinel-2 L2A (10 m) e NASA POWER."
                ))}</span>
              </div>
            </div>
          </div>

          <!-- 2. LECTURAS DEL ROBOT (Tarjetas dinámicas según variables que lleguen) -->
          <div class="card">
            <div class="row-between" style="margin-bottom:10px">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="sem-domain-ic vigor">${ic("sensor", "sm")}</span>
                <h2 class="card-title" style="margin:0">${esc(m("Lecturas del robot en tiempo real", "Real-time robot readings", "Leituras do robô em tempo real"))}</h2>
              </div>
              <div class="row-wrap" style="gap:6px">
                <span class="sem-badge ${robotEstado.conectado ? "ok" : "atencion"}">
                  ${robotEstado.conectado ? esc(m("Robot conectado", "Robot connected", "Robô conectado")) : esc(m("Esperando lecturas", "Awaiting readings", "Aguardando leituras"))}
                </span>
              </div>
            </div>

            <!-- STREAMING EN VIVO DE LA HOJA DE GOOGLE / EXCEL -->
            <div class="rover-stream-player" style="background:var(--superficie-2, #f3f7f4);border:1px solid var(--linea);border-radius:10px;padding:12px;margin-bottom:14px">
              <div class="row-between" style="flex-wrap:wrap;gap:8px;margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="rover-live-pulse" style="background:#2ecc71;width:10px;height:10px;border-radius:50%;display:inline-block;box-shadow:0 0 6px #2ecc71"></span>
                  <b style="font-size:13px">${esc(m("Stream en tiempo real · Datos del prototipo IoT (Google Sheets / AppSheet)", "Real-time stream · IoT prototype data (Google Sheets / AppSheet)", "Stream em tempo real · Dados do protótipo IoT (Google Sheets / AppSheet)"))}</b>
                  <span class="sem-badge ok" style="font-size:10px;padding:1px 6px" id="rover-stream-counter">Muestra 1 / 33</span>
                </div>
                <div class="row-wrap" style="gap:6px">
                  <button type="button" class="btn btn-sec btn-sm" id="rover-btn-prev" aria-label="${esc(m("Lectura anterior", "Previous reading", "Leitura anterior"))}" title="${esc(m("Lectura anterior", "Previous reading", "Leitura anterior"))}" style="padding:3px 8px;font-size:12px">⏮</button>
                  <button type="button" class="btn btn-pri btn-sm" id="rover-btn-play" style="padding:3px 10px;font-size:12px">❚❚ ${esc(m("Pausar", "Pause", "Pausar"))}</button>
                  <button type="button" class="btn btn-sec btn-sm" id="rover-btn-next" aria-label="${esc(m("Siguiente lectura", "Next reading", "Próxima leitura"))}" title="${esc(m("Siguiente lectura", "Next reading", "Próxima leitura"))}" style="padding:3px 8px;font-size:12px">⏭</button>
                  <select id="rover-stream-speed" class="field field-sm" style="font-size:11px;padding:2px 6px">
                    <option value="1500">${esc(m("1.5s (Rápido)", "1.5s (Fast)", "1.5s (Rápido)"))}</option>
                    <option value="2500" selected>${esc(m("2.5s (Normal)", "2.5s (Normal)", "2.5s (Normal)"))}</option>
                    <option value="5000">${esc(m("5.0s (Pausado)", "5.0s (Slow)", "5.0s (Pausado)"))}</option>
                  </select>
                  <a href="https://docs.google.com/spreadsheets/d/1qLLcz2nqP3tsAzvgeWL7eH7EAD-h4_4QsKCYoxLfCWc/edit" target="_blank" rel="noopener" class="btn btn-sec btn-sm" style="font-size:11px;padding:3px 8px">
                    📊 ${esc(m("Hoja de Google ↗", "Google Sheet ↗", "Planilha Google ↗"))}
                  </a>
                </div>
              </div>
              <div class="row-between xs mut" style="flex-wrap:wrap;gap:6px">
                <span id="rover-stream-coords">📍 ${esc(m("Coordenadas de prueba: 20.61309° N, -100.40274° W (Querétaro)", "Test coordinates: 20.61309° N, -100.40274° W (Querétaro)", "Coordenadas de teste: 20.61309° N, -100.40274° W (Querétaro)"))}</span>
                <span id="rover-stream-time">⏱ Timestamp: 2026-11-15 10:37:00 UTC</span>
              </div>
            </div>

            ${robotUltimas.length === 0 ? `
              <div class="notice atencion" style="padding:16px">
                ${ic("info", "lg")}
                <div style="flex:1">
                  <b>Aún no llegan datos del robot.</b>
                  <p class="small" style="margin:4px 0 8px">
                    Tu libreta está lista para recibir variables. Conecta la hoja de Google del robot o sube un archivo CSV / Excel desde la sección Robot.
                  </p>
                  <div class="row-wrap">
                    <button type="button" class="btn btn-pri btn-sm" data-go-space="robot">Conectar el robot →</button>
                  </div>
                </div>
              </div>
            ` : `
              <div class="robot-var-grid">
                ${robotUltimas.map(v => {
                  const meta = conocidas[v.variable] || {};
                  const icName = meta.ic || "sensor";
                  const nom = v.nombre || meta.nombre || v.variable;
                  const uni = v.unidad !== undefined ? v.unidad : (meta.defUnidad || "");
                  const hasLimits = (v.min != null && v.max != null);
                  let stCls = "ok", stWord = "Normal";
                  if (hasLimits) {
                    if (v.valor < v.min) { stCls = "atencion"; stWord = "Bajo"; }
                    else if (v.valor > v.max) { stCls = "riesgo"; stWord = "Alto"; }
                  }
                  const tStr = v.t ? new Date(v.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "ahora";

                  return `
                    <div class="robot-var-card">
                      <div class="robot-var-head">
                        <span class="robot-var-name" title="${esc(nom)}">${esc(nom)}</span>
                        ${hasLimits ? `<span class="sem-badge ${stCls}" style="font-size:10px;padding:1px 5px">${stWord}</span>` : ""}
                      </div>
                      <div class="robot-var-val">
                        ${v.valor != null ? v.valor : "—"}
                        ${uni ? `<small>${esc(uni)}</small>` : ""}
                      </div>
                      ${hasLimits ? `
                        <div class="xs mut">Rango: ${v.min}–${v.max} ${esc(uni)}</div>
                      ` : `<div class="xs mut">Sin rango fijado</div>`}
                      <div class="robot-var-foot mut">
                        <span>${tStr}</span>
                        <span>${esc(v.fuente || "Robot local")}</span>
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>
            `}
          </div>

          <!-- 4. DATOS LOCALES Y NUBE LADO A LADO -->
          <div class="card side-by-side-card">
            <h2 class="card-title">${ic("satellite", "sm")} <span>${esc(m("Lo que mide el robot y lo que ve el satélite", "What the robot measures vs what the satellite sees", "O que o robô mede e o que o satélite vê"))}</span></h2>
            <p class="small mut" style="margin:0 0 10px">
              ${esc(m(
                "Comparación entre las lecturas directas del banco de pruebas del prototipo físico y los promedios satelitales Sentinel-2 / NASA POWER calculados para la parcela agrícola.",
                "Comparison between direct readings from the physical prototype test bench and regional Sentinel-2 / NASA POWER satellite averages computed for the agricultural field.",
                "Comparação entre as leituras diretas da bancada de testes do protótipo físico e as médias de satélite Sentinel-2 / NASA POWER calculadas para a parcela agrícola."
              ))}
            </p>

            <div class="grid-2">
              <!-- Humedad: Robot vs NASA POWER SMAP -->
              <div class="card-sub">
                <div class="sbs-col-title">Humedad del suelo (Agua en raíz)</div>
                <div class="sbs-grid">
                  <div class="sbs-col">
                    <span class="xs mut">Robot (Local)</span>
                    <div class="sbs-val" style="color:var(--primario)">${rHumedad != null ? `${rHumedad}%` : "—"}</div>
                    <div class="xs mut">Punto exacto (0–30 cm)</div>
                  </div>
                  <div class="sbs-diff-badge">
                    <span class="xs mut">Diferencia</span>
                    <b style="font-size:14px;color:var(--texto)">${diffHum != null ? `${diffHum > 0 ? "+" : ""}${diffHum}%` : "—"}</b>
                  </div>
                  <div class="sbs-col">
                    <span class="xs mut">NASA POWER (Nube)</span>
                    <div class="sbs-val" style="color:var(--agua)">${sHumedad != null ? `${Math.round(sHumedad)}%` : "—"}</div>
                    <div class="xs mut">Promedio zona (9–50 km)</div>
                  </div>
                </div>
                <div class="xs mut" style="line-height:1.4">
                  El robot mide el punto exacto de la raíz en este metro cuadrado; el satélite SMAP estima el promedio de la región agrícola.
                </div>
              </div>

              <!-- Temperatura: Robot vs Satélite/Pronóstico -->
              <div class="card-sub">
                <div class="sbs-col-title">Temperatura de la superficie</div>
                <div class="sbs-grid">
                  <div class="sbs-col">
                    <span class="xs mut">Robot (Local)</span>
                    <div class="sbs-val" style="color:var(--primario)">${rTemp != null ? `${rTemp} °C` : "—"}</div>
                    <div class="xs mut">Sonda de suelo (10 cm)</div>
                  </div>
                  <div class="sbs-diff-badge">
                    <span class="xs mut">Diferencia</span>
                    <b style="font-size:14px;color:var(--texto)">${diffTemp != null ? `${diffTemp > 0 ? "+" : ""}${diffTemp} °C` : "—"}</b>
                  </div>
                  <div class="sbs-col">
                    <span class="xs mut">NASA POWER (Nube)</span>
                    <div class="sbs-val" style="color:var(--suelo)">${sTemp != null ? `${sTemp.toFixed(1)} °C` : "—"}</div>
                    <div class="xs mut">Media climatológica (50 km)</div>
                  </div>
                </div>
                <div class="xs mut" style="line-height:1.4">
                  La temperatura local refleja la humedad del surco y la insolación instantánea; NASA POWER refleja la atmósfera regional.
                </div>
              </div>
            </div>
          </div>

          <!-- 5. PROMEDIOS Y ESTADÍSTICAS (24 h, 7 días, 30 días) -->
          <div class="card">
            <h2 class="card-title">${ic("chart", "sm")} <span>Promedios del robot: 24 horas, 7 y 30 días</span></h2>
            <details class="plan-mas"><summary>${esc(m("Ver los promedios", "Show the averages", "Ver as médias"))}</summary>
            <div class="table-wrap">
              <table class="v2-table">
                <thead>
                  <tr><th>Variable</th><th>Últimas 24 horas</th><th>Últimos 7 días</th><th>Últimos 30 días</th></tr>
                </thead>
                <tbody>
                  ${statsRows}
                </tbody>
              </table>
            </div>
            </details>
            <div class="xs mut" style="margin-top:8px">Calculado solo con las lecturas que el robot ha enviado.</div>
          </div>

          <!-- 3. DATOS EN CRUDO (Tabla ordenable + Descarga CSV) -->
          <div class="card">
            <div class="row-between" style="margin-bottom:10px">
              <h2 class="card-title" style="margin:0">${ic("download", "sm")} <span>Datos en crudo del robot</span></h2>
              <button type="button" class="btn btn-sec btn-sm" id="v2-btn-export-raw-csv">
                ${ic("download", "sm")} <span>Descargar CSV completo</span>
              </button>
            </div>
            <p class="small mut" style="margin:0 0 10px">${esc(m("Serie temporal de lecturas directas del banco y campo físico (Google Sheets · AppSheet · Sonda NPK 8-en-1).", "Time series of direct test bench and physical field readings (Google Sheets · AppSheet · 8-in-1 NPK probe).", "Série temporal de leituras diretas de bancada e campo físico (Google Sheets · AppSheet · Sonda NPK 8-em-1)."))}</p>
            <details class="plan-mas"><summary>${esc(m("Ver la tabla de lecturas", "Show the readings table", "Ver a tabela de leituras"))}</summary>
            <div class="table-wrap" style="max-height:280px;overflow-y:auto">
              <table class="v2-table rover-stream-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>${esc(m("Hora (UTC)", "Time (UTC)", "Hora (UTC)"))}</th>
                    <th>${esc(m("Velocidad", "Speed", "Velocidade"))}</th>
                    <th>${esc(m("Rotación", "Rotation", "Rotação"))}</th>
                    <th>${esc(m("Temp. aire", "Air temp", "Temp. ar"))}</th>
                    <th>${esc(m("Hum. aire", "Air hum", "Umidade ar"))}</th>
                    <th>${esc(m("Nitrógeno", "Nitrogen", "Nitrogênio"))}</th>
                    <th>${esc(m("Fósforo", "Phosphorus", "Fósforo"))}</th>
                    <th>${esc(m("Potasio", "Potassium", "Potássio"))}</th>
                    <th>${esc(m("Hum. suelo", "Soil hum", "Umidade solo"))}</th>
                    <th>${esc(m("Temp. suelo", "Soil temp", "Temp. solo"))}</th>
                    <th>pH</th>
                    <th>${esc(m("Salinidad", "Salinity", "Salinidade"))}</th>
                    <th>TDS</th>
                    <th>${esc(m("Coordenadas", "Coordinates", "Coordenadas"))}</th>
                  </tr>
                </thead>
                <tbody>
                  ${(window.ROBOT_HOJA_RECORDS || []).map((r, i) => `
                    <tr data-rec-idx="${i}" class="${i === 0 ? "active-row" : ""}">
                      <td class="xs mut">${i + 1}</td>
                      <td class="xs">${r.t ? new Date(r.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}</td>
                      <td><b>${r.velocidad} km/h</b></td>
                      <td><b>${r.rotacion ?? r["rotación"]}°</b></td>
                      <td><b>${r.temperatura} °C</b></td>
                      <td><b>${r.humedad}%</b></td>
                      <td style="color:#2e7d32"><b>${r.nitrogeno != null ? r.nitrogeno + " mg/kg" : "—"}</b></td>
                      <td style="color:#1565c0"><b>${r.fosforo != null ? r.fosforo + " mg/kg" : "—"}</b></td>
                      <td style="color:#e65100"><b>${r.potasio != null ? r.potasio + " mg/kg" : "—"}</b></td>
                      <td><b>${r.humedad_suelo != null ? r.humedad_suelo + "%" : "—"}</b></td>
                      <td><b>${r.temperatura_suelo != null ? r.temperatura_suelo + " °C" : "—"}</b></td>
                      <td><b>${r.ph != null ? r.ph : "—"}</b></td>
                      <td><b>${r.salinidad != null ? r.salinidad + " µS/cm" : "—"}</b></td>
                      <td><b>${r.tds != null ? r.tds + " ppm" : "—"}</b></td>
                      <td class="coord-mono xs">${r.lat != null ? `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}` : "—"}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
            </details>
          </div>

          <!-- 6. NOTIFICACIONES Y ALERTAS RECIENTES -->
          <div class="card">
            <div class="row-between" style="margin-bottom:10px">
              <h2 class="card-title" style="margin:0">${ic("atencion", "sm")} <span>Alertas agronómicas activas</span></h2>
              <button type="button" class="btn btn-sec btn-sm" data-action="abrir-alertas">
                Ver todas (${window.V2Alertas?.alertasList?.length || 0}) →
              </button>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${ultAlertas.length ? "" : `<div class="small mut">Sin alertas por ahora.</div>`}
              ${ultAlertas.map(a => `
                <div class="notice ${a.gravedad === "alerta" ? "riesgo" : a.gravedad === "atencion" ? "atencion" : "info"}">
                  ${ic(a.gravedad === "alerta" ? "riesgo" : "atencion", "sm")}
                  <div style="flex:1">
                    <b>${esc(a.titulo)}</b>
                    <div class="small">${esc(a.detalle)}</div>
                  </div>
                  <button type="button" class="btn btn-txt btn-sm" data-src-info="${esc([a.detalle, a.umbral ? tr("why_rule") + " " + a.umbral : "", a.fuente ? tr("why_src") + " " + a.fuente : "", a.t ? String(a.t).slice(0, 10) : ""].filter(Boolean).join(" · "))}">${esc(tr("why_btn"))}</button>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `;
    },

    // =========================================================================
    // CÁPSULA E — SECCIÓN 3: DATOS DE LA REGIÓN (Familia, Agrónomo, Científico)
    // =========================================================================
    renderRegionWorkspace() {
      const mode = window.V2.mode; // farmer (familia) | agronomist | scientist
      const lang = window.V2.lang;
      const D = window.V2.D;
      const o = D?.telemetria_oficial_en_vivo || {};
      const pw = g(o, "nasa_power_v10.resumen_anual") || {};
      const rainYr = pw.precipitacion_anual_mm ?? null;
      const tempYr = pw.temp_media_anual_c ?? null;

      // MODO FAMILIA: Lenguaje llano de todos los días, semáforos y enlaces "¿Qué significa?"
      if (mode === "farmer") {
        return `
          <div class="workspace-inner region-workspace-inner">
            <div class="card" style="background:var(--superficie);border-left:4px solid var(--primario)">
              <div class="row-between" style="margin-bottom:6px">
                <span class="chip" style="font-weight:700">Modo Familia (lenguaje sencillo)</span>
                <button type="button" class="btn btn-txt btn-sm" data-open-modal="settings">Cambiar modo de detalle</button>
              </div>
              <h1 style="font-size:22px;margin:0 0 6px">El clima y la tierra de tu región explicados simple</h1>
              <p class="small mut" style="margin:0">Sin términos técnicos ni siglas. Toca «¿Qué significa?» en cualquier tema para aprender más.</p>
            </div>

            ${rainYr == null ? `<div class="notice info">${ic("info", "sm")}<div class="small">Elige un terreno en el mapa para ver la lluvia de su zona con datos de NASA.</div></div>` : `
            <!-- Semáforo 1: Agua de lluvia -->
            <div class="notice ${rainYr > 600 ? "ok" : "atencion"}" style="padding:16px">
              ${ic("water", "lg")}
              <div style="flex:1">
                <div style="font-size:16px;font-weight:700">Lluvia de la zona: ${rainYr > 600 ? "Buena cantidad de agua al año" : "Zona seca con poca lluvia"}</div>
                <div class="small" style="margin-top:4px">
                  ${rainYr > 600
                    ? `En esta zona caen unos ${Math.round(rainYr)} milímetros de agua al año, suficiente para sembrar maíz o soya de secano.`
                    : `Caen unos ${Math.round(rainYr)} mm al año. Conviene usar riego o sembrar cultivos que aguanten la sed como sorgo o trigo.`}
                </div>
                <div style="margin-top:8px">
                  <button type="button" class="btn btn-txt btn-sm" data-go-conceptos="deficit_agua" style="font-weight:700;color:var(--primario)">¿Qué significa el balance de agua? →</button>
                </div>
              </div>
            </div>
            `}

            ${this.renderPreguntas()}

            <!-- Acceso a las capas satelitales -->
            <div class="card">
              <h2 class="card-title">${ic("layers", "sm")} <span>Fotos del satélite sobre tu campo</span></h2>
              <p class="small mut" style="margin:0 0 10px">Puedes encender las capas satelitales para ver el verdor de las hojas y la humedad de la tierra.</p>
              <button type="button" class="btn btn-pri btn-sm" data-sheet-tab="layers">Abrir explorador de capas satelitales →</button>
            </div>
          </div>
        `;
      }

      // MODOS AGRÓNOMO Y CIENTÍFICO: Conserva todo el inventario completo existente (Pantalla 8)
      return this.renderScreen8ClimaAgua();
    },

    // Explorador por preguntas: cada pregunta enciende su paquete de capas comprobadas y muestra el valor en el terreno
    renderPreguntas() {
      const V = window.V2, lang = V.lang, P = V.preguntas, S = V.seriesTerreno;
      if (!P) {
        V.preguntas = { cargando: true };
        fetch("/api/v1/capas/preguntas", { credentials: "same-origin" }).then(r => r.json()).then(j => { V.preguntas = j; if (V.space === "region") V.renderActiveViews(); }).catch(() => { V.preguntas = { estado: "ERROR" }; });
      }
      if (V.loc?.id && V.seriesId !== V.loc.id + V.lang) {
        V.seriesId = V.loc.id + V.lang; V.seriesTerreno = null;
        fetch(`/api/v1/capas/series?lang=${V.lang}&terreno_id=${encodeURIComponent(V.loc.id)}`, { credentials: "same-origin" }).then(r => r.json()).then(j => { V.seriesTerreno = j; if (V.space === "region") V.renderActiveViews(); }).catch(() => {});
      }
      const lista = P?.preguntas || [];
      const act = lista.find(p => p.id === V.preguntaActiva);
      const vars = S?.variables || {};
      return `
        <div class="card">
          <h2 class="card-title">${ic("compass", "sm")} <span>${esc(tr("pq_title"))}</span></h2>
          ${!lista.length ? `<p class="small mut">${esc(P?.cargando ? tr("pq_loading") : (P?.detalle || tr("nodata")))}</p>` : `
          <div class="row-wrap" style="gap:8px;margin-bottom:10px">
            ${lista.map(p => `<button type="button" class="btn ${p.id === V.preguntaActiva ? "btn-pri" : "btn-sec"} btn-sm" data-pregunta="${esc(p.id)}" style="min-height:44px" ${p.capas.length || p.series.length ? "" : "disabled"}>${esc(p.titulo[lang] || p.titulo.es)}</button>`).join("")}
          </div>
          ${act ? `
            <p class="small" style="margin:0 0 8px">${esc(act.leer[lang] || act.leer.es)}</p>
            ${act.series.some(s => vars[s.capa]) ? `<div class="grid-3 small" style="margin-bottom:10px">${act.series.filter(s => vars[s.capa]).map(s => { const x = vars[s.capa]; return `
              <div class="card-sub"><div class="xs mut">${esc(x.nombre)}</div><div style="font-size:20px;font-weight:700">${esc(x.ult_7d)} <small>${esc(x.unidad)}</small></div>
                <div class="xs mut">${esc(trf(x.agregado === "suma" ? "pq_sum7" : "pq_avg7", { v: x.ult_30d }))}</div>
                ${fuente({ fuente: "NASA POWER", fecha: x.fecha, resolucion: "~50 km", tipo: "estimacion", detalle: S.nota, cache: S.cache })}</div>`; }).join("")}</div>`
            : `<p class="small mut">${esc(V.loc?.id ? (S ? (S.detalle || tr("pq_noseries")) : tr("pq_loading")) : tr("pq_nofield"))}</p>`}
            <div class="small" style="margin-bottom:8px"><b>${esc(trf("pq_layers", { n: act.capas.length }))}</b>
              <ul style="margin:4px 0 0 18px;padding:0">${act.capas.map(c => `<li>${esc(c.titulo || c.id)} <span class="xs mut">· ${esc(trf("pq_fresh", { f: c.fecha_dato || "—" }))} · ${esc(tr("pq_image"))}</span></li>`).join("")}</ul>
              ${act.descartadas.length ? `<div class="xs mut" style="margin-top:4px">${esc(trf("pq_dropped", { n: act.descartadas.length }))}</div>` : ""}
            </div>
            ${act.capas.length ? `<button type="button" class="btn btn-pri btn-sm" data-pregunta-mapa="${esc(act.id)}" style="min-height:44px">${ic("map", "sm")} <span>${esc(tr("pq_open"))}</span></button>` : ""}
          ` : `<p class="small mut">${esc(tr("pq_pick"))}</p>`}`}
        </div>`;
    },

    // =========================================================================
    // CÁPSULA E — SECCIÓN 4: RECOMENDACIONES (Vienen de contrato con el backend)
    // =========================================================================
    renderRecomendacionesWorkspace() {
      const loc = window.V2.loc;
      const clave = loc ? `${loc.lat},${loc.lon}` : "";
      if (clave && this._recomsId !== clave) {
        this._recomsId = clave; this._recoms = null;
        // El terreno guardado se identifica por sus coordenadas.
        window.V2Adapter.obtenerTerrenos()
          .then(ts => ts.find(t => Math.abs(t.lat - loc.lat) < 1e-4 && Math.abs(t.lon - loc.lon) < 1e-4))
          .then(t => t ? window.V2Adapter.obtenerRecomendaciones(t.id) : [])
          .then(l => { this._recoms = l; if (window.V2.space === "recom") window.V2.renderActiveViews(); });
      }
      const recoms = this._recoms || [];
      const lang = window.V2.lang;
      const m1r = (window.V2.modelsMeta?.modelos || []).find(m => m.id === "M1");

      // Agrupar por horizontes
      const hoy = recoms.filter(r => r.horizonte === "hoy" || r.horizonte === "semana");
      const temporada = recoms.filter(r => r.horizonte === "temporada");
      const largo = recoms.filter(r => r.horizonte === "largo");

      return `
        <div class="workspace-inner recom-workspace-inner">
          <div class="card recom-hero-card">
            <div class="row-between" style="margin-bottom:8px">
              <div>
                <h1 style="font-size:22px;font-weight:800;margin:0 0 4px">Qué hacer en tu terreno</h1>
                <p class="small mut" style="margin:0">
                  Lo que conviene hacer hoy, esta temporada y en los próximos años, con los datos de tu terreno.
                </p>
              </div>
            </div>
          </div>

          ${window.V2Agro ? window.V2Agro.tarjeta() : ""}

          ${recoms.length ? "" : `<div class="notice info">${ic("info", "sm")}<div class="small">${this._recoms === null ? "Calculando recomendaciones con los datos reales de tu terreno…" : "Todavía no hay recomendaciones: elige o guarda un terreno y espera a que termine el análisis."}</div></div>`}
          <!-- 1. QUÉ HACER AHORA (Hoy y esta semana) -->
          <div class="card">
            <h2 class="card-title" style="margin-bottom:12px">
              ${ic("compass", "sm")} <span>1. Qué hacer hoy y esta semana</span>
            </h2>
            <div style="display:flex;flex-direction:column;gap:12px">
              ${hoy.map(r => `
                <div class="recom-card urgent">
                  <div class="recom-title-row">
                    <strong style="font-size:16px">${esc(r.titulo)}</strong>
                    <div class="row-wrap" style="gap:6px">
                      <span class="recom-horizon">${esc(tr(r.horizonte === "hoy" ? "rec_today" : "rec_week"))}</span>
                    </div>
                  </div>
                  <div class="small" style="font-weight:600;color:var(--texto)">Acción: ${esc(r.accion)}</div>
                  
                  <div style="margin-top:6px">
                    <b class="xs mut" style="text-transform:uppercase;letter-spacing:0.04em">Por qué (datos que lo sustentan):</b>
                    <ul class="recom-because-list">
                      ${(r.porque || []).map(p => `<li>${esc(p)}</li>`).join("")}
                    </ul>
                  </div>

                  ${r.faltan_datos?.length ? `
                    <div class="recom-missing-box">
                      <b>Datos que faltan para afinar la decisión:</b>
                      <ul style="margin:2px 0 0 16px;padding:0">
                        ${r.faltan_datos.map(f => `<li>${esc(f)}</li>`).join("")}
                      </ul>
                    </div>
                  ` : ""}

                  <div style="margin-top:4px">${srcTag(r.fuente || "Fusión de datos")}</div>
                </div>
              `).join("")}
            </div>
          </div>

          <!-- 2. QUÉ HACER ESTE MES Y ESTA TEMPORADA -->
          <div class="card">
            <h2 class="card-title" style="margin-bottom:12px">
              ${ic("calendar", "sm")} <span>2. Qué hacer este mes y esta temporada</span>
            </h2>
            <div style="display:flex;flex-direction:column;gap:12px">
              ${temporada.map(r => `
                <div class="recom-card">
                  <div class="recom-title-row">
                    <strong style="font-size:16px">${esc(r.titulo)}</strong>
                  </div>
                  <div class="small" style="font-weight:600">Acción: ${esc(r.accion)}</div>
                  <ul class="recom-because-list" style="margin-top:6px">
                    ${(r.porque || []).map(p => `<li>${esc(p)}</li>`).join("")}
                  </ul>
                  ${srcTag(r.fuente || "OpenET + Sentinel-2")}
                </div>
              `).join("")}
            </div>
          </div>

          <!-- 3. LARGO PLAZO Y ROTACIÓN A 3 AÑOS (Reutiliza el comparador de márgenes) -->
          <div class="card">
            <h2 class="card-title" style="margin-bottom:12px">
              ${ic("chart", "sm")} <span>3. Estrategia a largo plazo (Rotación y márgenes)</span>
            </h2>
            <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:12px">
              ${largo.map(r => `
                <div class="recom-card">
                  <div class="recom-title-row">
                    <strong style="font-size:16px">${esc(r.titulo)}</strong>
                  </div>
                  <div class="small" style="font-weight:600">Acción: ${esc(r.accion)}</div>
                  <ul class="recom-because-list">
                    ${(r.porque || []).map(p => `<li>${esc(p)}</li>`).join("")}
                  </ul>
                  ${srcTag(r.fuente)}
                </div>
              `).join("")}
            </div>
          </div>

          <!-- 4. PREDICCIONES SI HONESTA (Regla de oro 5) -->
          <div class="card">
            <div class="row-between" style="margin-bottom:10px">
              <h2 class="card-title" style="margin:0">${ic("ai", "sm")} <span>Predicción de cultivo por SI</span></h2>
              <span class="demo-tag">${esc(m1r?.acierto_medido_pct != null ? trf("ai_acc_tag", { a: m1r.acierto_medido_pct }) : tr("ai_disclaimer"))}</span>
            </div>
            <div class="notice ok" style="margin-bottom:10px">
              ${ic("info", "lg")}
              <div class="small">
                ${m1r ? `${esc(trf("ai_recom_note", { a: m1r.acierto_medido_pct, b: m1r.referencia_base_pct, z: m1r.region_entrenamiento }))} <em>${esc(tr("ai_disclaimer"))}</em>` : esc(tr("nodata"))}
              </div>
            </div>
            <div class="row-wrap">
              <button type="button" class="btn btn-pri btn-sm" data-action="run-ai">${ic("ai", "sm")} <span>${esc(m("Ejecutar clasificador SI sobre los cuadros", "Run SI classifier over squares", "Executar classificador SI sobre os quadros"))}</span></button>
              <button type="button" class="btn btn-sec btn-sm" data-go-conceptos="ia_vs_medicion">¿Por qué una predicción no es medición? →</button>
            </div>
          </div>
        </div>
      `;
    },
  };

  window.V2Screens = V2Screens;
})();
