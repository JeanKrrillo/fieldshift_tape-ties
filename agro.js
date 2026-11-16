// =============================================================================
// Terra Lab — Plan agronómico calculado con los datos reales del terreno.
// Cada cifra dice de qué dato sale y qué supuesto usa. Lo que no hay se marca como faltante.
// Lo usan: la pantalla "Qué hacer" (tarjeta), la SI (respuestas) y el reporte imprimible.
// =============================================================================
(function () {
  "use strict";
  const m = (es, en, pt) => (window.V2?.lang === "en" ? en : window.V2?.lang === "pt" ? pt : es);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const r1 = (x, d = 0) => x == null || Number.isNaN(x) ? null : +x.toFixed(d);
  const MESES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  // Supuestos declarados (guías públicas, no mediciones del terreno).
  const ETC_MAIZ_MM = 560;       // demanda de agua del maíz en Iowa, mayo–septiembre (orden de magnitud FAO-56 / ISU)
  const BU_T_MAIZ = 39.368, BU_T_SOYA = 36.744;

  const Agro = {
    datos() {
      const V = window.V2 || {}, T = V.D?.telemetria_oficial_en_vivo || {};
      const pw = T.nasa_power_v10 || {}, sg = T.usda_nrcs_ssurgo || {};
      const ch = window.FS_API?.["/api/v1/b/clima-historico"] || V.climaHistorico || {};
      const precios = T.usda_ams_market_news?.precios || [];
      return { V, pw, sg, ch, precios, terr: V.terrainResp || {}, loc: V.D?.coordenadas_parcela || V.loc || {} };
    },

    // ------------------------------------------------------------ cálculos
    calcular() {
      const { V, pw, sg, ch, precios, terr, loc } = this.datos();
      const out = { faltan: [] };
      const lluvia = pw.series_12_meses?.lluvia_mm_mes;
      const est = ch.estadistica_40_anios || {};
      const hel = ch.heladas_observadas || {};
      const ap = sg.capa_arable_superficial || {};
      const cornBelt = loc.lat > 36 && loc.lat < 49 && loc.lon > -104 && loc.lon < -80;

      // 1. Celdas reales
      const cs = terr.celdas || [];
      out.celdas = cs.length ? { n: cs.length, lado: cs[0].lado_m, ha: r1(terr.area_ha, 1), fecha: terr.fecha } : null;

      // 2. Fenología: una foto fuera de temporada no mide el cultivo
      if (terr.fecha) {
        const mes = +terr.fecha.slice(5, 7), sur = loc.lat < 0;
        const fuera = sur ? (mes >= 5 && mes <= 9) : (mes >= 11 || mes <= 3);
        out.fenologia = { mes, fuera };
      }

      // 3. Ventana de siembra (maíz): desde la última helada de primavera observada hasta la fecha límite de la guía
      if (hel.ultima_helada_primavera && cornBelt) {
        const uh = new Date(hel.ultima_helada_primavera + "T00:00:00Z");
        const ini = new Date(Math.max(uh.getTime() + 86400000, Date.UTC(uh.getUTCFullYear(), 3, 11)));
        const fin = new Date(Date.UTC(uh.getUTCFullYear(), 4, 18));
        out.siembra = { ultimaHelada: hel.ultima_helada_primavera, ini: ini.toISOString().slice(5, 10), fin: fin.toISOString().slice(5, 10), primeraOtono: hel.primera_helada_otono };
      } else out.faltan.push(m("ventana de siembra (fuera de la franja maicera o sin fechas de helada)", "planting window (outside Corn Belt or no frost dates)", "janela de plantio (fora do cinturão do milho ou sem datas de geada)"));

      // 4. Balance de agua mayo–septiembre: lluvia climatológica + agua útil del suelo contra la demanda del maíz
      if (lluvia && sg.agua_disponible_0_100cm_mm != null) {
        const temp = ["MAY", "JUN", "JUL", "AUG", "SEP"].reduce((a, k) => a + (lluvia[k] || 0), 0);
        const anual = MESES.reduce((a, k) => a + (lluvia[k] || 0), 0);
        const p10 = est.lluvia_p10_seca_mm ? temp * est.lluvia_p10_seca_mm / anual : null;
        const awc = sg.agua_disponible_0_100cm_mm;
        out.agua = { temp: r1(temp), p10: r1(p10), awc: r1(awc, 1), oferta: r1(temp + awc), ofertaSeca: p10 == null ? null : r1(p10 + awc), etc: ETC_MAIZ_MM,
          saldo: r1(temp + awc - ETC_MAIZ_MM), saldoSeco: p10 == null ? null : r1(p10 + awc - ETC_MAIZ_MM), tendencia: est.tendencia_lluvia_mm_por_decada };
      } else out.faltan.push(m("balance de agua (falta lluvia mensual o agua útil del suelo)", "water balance (missing monthly rain or soil water)", "balanço de água (falta chuva mensal ou água útil do solo)"));
      out.faltan.push(m("ET real del cultivo: OpenET no respondió (límite del plan gratuito); se usa una demanda de referencia", "actual crop ET: OpenET did not answer (free plan limit); a reference demand is used", "ET real da cultura: OpenET não respondeu (limite do plano gratuito); usa-se uma demanda de referência"));

      // 5. Suelo (SSURGO)
      if (ap.arena_pct != null) {
        const { arena_pct: a, limo_pct: l, arcilla_pct: c } = ap;
        const textura = c >= 40 ? m("arcillosa", "clay", "argilosa") : c >= 27 ? m("franco arcillosa", "clay loam", "franco-argilosa")
          : a > 52 ? m("franco arenosa", "sandy loam", "franco-arenosa") : l >= 50 ? m("franco limosa", "silt loam", "franco-siltosa") : m("franca", "loam", "franca");
        const hz = sg.horizontes_verticales_0_150cm || [];
        const limit = hz.find(h => h.densidad_aparente_g_cm3 >= 1.6);
        out.suelo = { unidad: sg.unidad_suelo, textura, a, l, c, ph: ap.ph, mo: ap.materia_organica_pct, da: ap.densidad_aparente_g_cm3, k: ap.factor_k_erosion,
          drenaje: sg.drenaje, grupo: sg.grupo_hidrologico, capaDensa: limit ? limit.prof_inicio_cm : null,
          cal: ap.ph != null && ap.ph < 5.8, compacta: ap.densidad_aparente_g_cm3 >= 1.55 };
      } else out.faltan.push(m("suelo (SSURGO solo cubre EE. UU.)", "soil (SSURGO covers the US only)", "solo (SSURGO só cobre os EUA)"));

      // 6. Clima de largo plazo, con la etiqueta correcta: los extremos NO son promedios
      if (est.n_anios) out.clima = { periodo: est.periodo, tmedia: est.temp_media_40a_c, tend: est.tendencia_temp_c_por_decada, lluvia: est.lluvia_media_40a_mm,
        p10: est.lluvia_p10_seca_mm, p90: est.lluvia_p90_humeda_mm, extMax: pw.resumen_anual?.temp_max_mes_mas_calido_c, extMin: pw.resumen_anual?.temp_min_mes_mas_frio_c };
      out.faltan.push(m("grados día de la temporada: la página solo trae extremos mensuales y ~45 días diarios", "season growing degree days: only monthly extremes and ~45 daily values are available", "graus-dia da safra: só há extremos mensais e ~45 dias diários"));

      // 7. Insumos (guías públicas de Iowa State University, no mediciones)
      out.insumos = cornBelt ? { nTrasSoya: [135, 157], nTrasMaiz: [190, 213], dens: [79, 89], rm: [105, 112] } : null;
      out.faltan.push(m("precio del nitrógeno: sin él no se calcula la dosis más rentable (MRTN), solo el rango de la guía", "nitrogen price: without it the most profitable rate (MRTN) can't be computed, only the guide range", "preço do nitrogênio: sem ele não se calcula a dose mais rentável (MRTN), só a faixa do guia"));

      // 8. Economía con precios USDA del día
      const maiz = precios.find(p => p.producto === "Corn"), soya = precios.find(p => p.producto === "Soybeans");
      const fx = V.farmExtra || {};
      const cost = +fx.costMaize || null, rend = +fx.yieldMaize || null;
      if (maiz) {
        const pt = maiz.promedio * BU_T_MAIZ;
        out.economia = { precioBu: maiz.promedio, precioT: r1(pt), fecha: maiz.fecha, soyaT: soya ? r1(soya.promedio * BU_T_SOYA) : null, cost, rend,
          margen: cost && rend ? r1(rend * pt - cost) : null, equilibrioT: cost ? r1(cost / pt, 2) : null, equilibrioP: cost && rend ? r1(cost / rend) : null,
          costoBajo: cost != null && cost < 800 };
      }
      return out;
    },

    // ------------------------------------------------------------ texto de cada bloque (lo reusa la SI)
    frases(p = this.calcular()) {
      const F = {};
      if (p.celdas) F.celdas = m(`Tu terreno tiene ${p.celdas.n} cuadros de ${p.celdas.lado} × ${p.celdas.lado} m (${p.celdas.ha} ha). Sentinel-2 mide a 10 m: un cuadro menor a 10 m repite el mismo píxel.`,
        `Your field has ${p.celdas.n} squares of ${p.celdas.lado} × ${p.celdas.lado} m (${p.celdas.ha} ha). Sentinel-2 measures at 10 m: a square under 10 m repeats the same pixel.`,
        `Seu terreno tem ${p.celdas.n} quadros de ${p.celdas.lado} × ${p.celdas.lado} m (${p.celdas.ha} ha). O Sentinel-2 mede a 10 m: um quadro menor que 10 m repete o mesmo pixel.`);
      if (p.fenologia?.fuera) F.fenologia = m(`La foto es de ${p.celdas?.fecha}, fuera de temporada: lo verde es rastrojo, maleza o cobertura, no el cultivo. Para decidir sobre el maíz usa fotos de junio a agosto.`,
        `The image is from ${p.celdas?.fecha}, off-season: green is residue, weeds or cover, not the crop. For corn decisions use June–August images.`,
        `A foto é de ${p.celdas?.fecha}, fora da safra: o verde é palhada, mato ou cobertura, não a cultura. Para decidir sobre o milho use fotos de junho a agosto.`);
      const s = p.siembra;
      if (s) F.siembra = m(`Ventana de siembra de maíz: del ${s.ini} al ${s.fin}. Sale de la última helada de primavera observada (${s.ultimaHelada}) y de la guía de Iowa State (siembra óptima del 11 de abril al 18 de mayo, con el suelo a 10 °C o más).`,
        `Corn planting window: ${s.ini} to ${s.fin}. Based on the last observed spring frost (${s.ultimaHelada}) and the Iowa State guide (optimal Apr 11–May 18, soil at 10 °C or more).`,
        `Janela de plantio do milho: de ${s.ini} a ${s.fin}. Vem da última geada de primavera observada (${s.ultimaHelada}) e do guia da Iowa State (ótimo de 11 de abril a 18 de maio, solo a 10 °C ou mais).`);
      const a = p.agua;
      if (a) F.agua = m(`Agua de mayo a septiembre: llueven ${a.temp} mm en un año normal y unos ${a.p10} mm en un año seco (1 de cada 10). Con ${a.awc} mm guardados en el suelo hay ${a.oferta} mm (${a.ofertaSeca} en año seco) contra unos ${a.etc} mm que pide el maíz: saldo ${a.saldo >= 0 ? "+" : ""}${a.saldo} mm (${a.saldoSeco >= 0 ? "+" : ""}${a.saldoSeco} en año seco). ${a.saldoSeco >= 0 ? "No hace falta riego, ni en año seco." : "En año seco falta agua: conviene híbrido tolerante o riego de apoyo."}`,
        `Water May–September: ${a.temp} mm of rain in a normal year and about ${a.p10} mm in a dry year (1 in 10). With ${a.awc} mm stored in the soil there are ${a.oferta} mm (${a.ofertaSeca} in a dry year) against about ${a.etc} mm corn needs: balance ${a.saldo >= 0 ? "+" : ""}${a.saldo} mm (${a.saldoSeco >= 0 ? "+" : ""}${a.saldoSeco} in a dry year). ${a.saldoSeco >= 0 ? "No irrigation needed, even in a dry year." : "Water runs short in a dry year: use a tolerant hybrid or supplemental irrigation."}`,
        `Água de maio a setembro: chovem ${a.temp} mm num ano normal e cerca de ${a.p10} mm num ano seco (1 em 10). Com ${a.awc} mm guardados no solo há ${a.oferta} mm (${a.ofertaSeca} em ano seco) contra cerca de ${a.etc} mm que o milho pede: saldo ${a.saldo >= 0 ? "+" : ""}${a.saldo} mm (${a.saldoSeco >= 0 ? "+" : ""}${a.saldoSeco} em ano seco). ${a.saldoSeco >= 0 ? "Não precisa de irrigação, nem em ano seco." : "Em ano seco falta água: use híbrido tolerante ou irrigação de apoio."}`);
      const g = p.suelo;
      if (g) F.suelo = m(`Suelo ${g.unidad}: textura ${g.textura} (${g.a}% arena, ${g.l}% limo, ${g.c}% arcilla), pH ${g.ph}${g.cal ? " (bajo: conviene encalar)" : " (bien para maíz y soya, no hace falta cal)"}, materia orgánica ${g.mo}%, densidad ${g.da} g/cm³${g.compacta ? " (compactado)" : " (sin compactación en la capa arable)"}${g.capaDensa != null ? `; capa densa desde ${g.capaDensa} cm` : ""}. Drenaje: ${g.drenaje}. Erosión K=${g.k}: deja al menos 30% del suelo cubierto con rastrojo.`,
        `Soil ${g.unidad}: ${g.textura} texture (${g.a}% sand, ${g.l}% silt, ${g.c}% clay), pH ${g.ph}${g.cal ? " (low: lime advised)" : " (fine for corn and soy, no lime needed)"}, organic matter ${g.mo}%, bulk density ${g.da} g/cm³${g.compacta ? " (compacted)" : " (no compaction in the plow layer)"}${g.capaDensa != null ? `; dense layer from ${g.capaDensa} cm` : ""}. Drainage: ${g.drenaje}. Erosion K=${g.k}: keep at least 30% residue cover.`,
        `Solo ${g.unidad}: textura ${g.textura} (${g.a}% areia, ${g.l}% silte, ${g.c}% argila), pH ${g.ph}${g.cal ? " (baixo: convém calcário)" : " (bom para milho e soja, não precisa de calcário)"}, matéria orgânica ${g.mo}%, densidade ${g.da} g/cm³${g.compacta ? " (compactado)" : " (sem compactação na camada arável)"}${g.capaDensa != null ? `; camada densa a partir de ${g.capaDensa} cm` : ""}. Drenagem: ${g.drenaje}. Erosão K=${g.k}: deixe pelo menos 30% do solo coberto com palhada.`);
      const c = p.clima;
      if (c) F.clima = m(`Clima ${c.periodo}: temperatura media ${c.tmedia} °C, subiendo ${c.tend} °C por década. Lluvia media ${c.lluvia} mm (año seco ${c.p10}, año húmedo ${c.p90}). Los ${c.extMax} °C y ${c.extMin} °C de NASA POWER son extremos absolutos, no promedios.`,
        `Climate ${c.periodo}: mean temperature ${c.tmedia} °C, rising ${c.tend} °C per decade. Mean rain ${c.lluvia} mm (dry year ${c.p10}, wet year ${c.p90}). NASA POWER's ${c.extMax} °C and ${c.extMin} °C are absolute extremes, not averages.`,
        `Clima ${c.periodo}: temperatura média ${c.tmedia} °C, subindo ${c.tend} °C por década. Chuva média ${c.lluvia} mm (ano seco ${c.p10}, ano úmido ${c.p90}). Os ${c.extMax} °C e ${c.extMin} °C do NASA POWER são extremos absolutos, não médias.`);
      const i = p.insumos;
      if (i) {
        F.nitrogeno = m(`Nitrógeno (guía MRTN de Iowa State): maíz después de soya ${i.nTrasSoya[0]}–${i.nTrasSoya[1]} kg N/ha; maíz después de maíz ${i.nTrasMaiz[0]}–${i.nTrasMaiz[1]} kg N/ha. La dosis exacta depende del precio del fertilizante, que la página aún no tiene.`,
          `Nitrogen (Iowa State MRTN guide): corn after soybean ${i.nTrasSoya[0]}–${i.nTrasSoya[1]} kg N/ha; corn after corn ${i.nTrasMaiz[0]}–${i.nTrasMaiz[1]} kg N/ha. The exact rate depends on fertilizer price, not yet in the page.`,
          `Nitrogênio (guia MRTN da Iowa State): milho após soja ${i.nTrasSoya[0]}–${i.nTrasSoya[1]} kg N/ha; milho após milho ${i.nTrasMaiz[0]}–${i.nTrasMaiz[1]} kg N/ha. A dose exata depende do preço do fertilizante, que a página ainda não tem.`);
        F.densidad = m(`Densidad de siembra (guía Iowa State): ${i.dens[0]} a ${i.dens[1]} mil semillas por hectárea. Madurez relativa para Iowa central: ${i.rm[0]}–${i.rm[1]} días.`,
          `Seeding rate (Iowa State guide): ${i.dens[0]} to ${i.dens[1]} thousand seeds per hectare. Relative maturity for central Iowa: ${i.rm[0]}–${i.rm[1]} days.`,
          `Densidade de plantio (guia Iowa State): ${i.dens[0]} a ${i.dens[1]} mil sementes por hectare. Maturidade relativa para Iowa central: ${i.rm[0]}–${i.rm[1]} dias.`);
      }
      if (i && s) F.cosecha = m(`Cosecha: un híbrido de ${i.rm[0]}–${i.rm[1]} días sembrado entre ${s.ini} y ${s.fin} llega a madurez (capa negra) a mediados de septiembre; se cosecha con el grano entre 20 y 25 % de humedad, de finales de septiembre a octubre, antes de la primera helada de otoño (la última observada fue el ${s.primeraOtono}).`,
        `Harvest: a ${i.rm[0]}–${i.rm[1]}-day hybrid planted between ${s.ini} and ${s.fin} reaches maturity (black layer) by mid-September; harvest at 20–25 % grain moisture, late September to October, before the first fall frost (last observed ${s.primeraOtono}).`,
        `Colheita: um híbrido de ${i.rm[0]}–${i.rm[1]} dias plantado entre ${s.ini} e ${s.fin} chega à maturação (camada preta) em meados de setembro; colhe-se com o grão entre 20 e 25 % de umidade, do fim de setembro a outubro, antes da primeira geada de outono (a última observada foi em ${s.primeraOtono}).`);
      const e = p.economia;
      if (e) F.economia = e.margen != null
        ? m(`Maíz a ${e.precioBu} USD/bu = ${e.precioT} USD/t (USDA, ${e.fecha}). Con ${e.rend} t/ha y ${e.cost} USD/ha de costo: margen ${e.margen} USD/ha. Punto de equilibrio: ${e.equilibrioT} t/ha, o ${e.equilibrioP} USD/t.${e.costoBajo ? " Ojo: menos de 800 USD/ha es muy bajo para Iowa; revisa si incluiste renta, semilla, fertilizante y secado." : ""}`,
          `Corn at ${e.precioBu} USD/bu = ${e.precioT} USD/t (USDA, ${e.fecha}). With ${e.rend} t/ha and ${e.cost} USD/ha cost: margin ${e.margen} USD/ha. Break-even: ${e.equilibrioT} t/ha, or ${e.equilibrioP} USD/t.${e.costoBajo ? " Note: under 800 USD/ha is very low for Iowa; check rent, seed, fertilizer and drying." : ""}`,
          `Milho a ${e.precioBu} USD/bu = ${e.precioT} USD/t (USDA, ${e.fecha}). Com ${e.rend} t/ha e custo de ${e.cost} USD/ha: margem ${e.margen} USD/ha. Ponto de equilíbrio: ${e.equilibrioT} t/ha, ou ${e.equilibrioP} USD/t.${e.costoBajo ? " Atenção: menos de 800 USD/ha é muito baixo para Iowa; revise arrendamento, semente, fertilizante e secagem." : ""}`)
        : m(`Maíz a ${e.precioBu} USD/bu = ${e.precioT} USD/t; soya ${e.soyaT} USD/t (USDA, ${e.fecha}). Escribe tu costo y rendimiento en Economía para calcular margen y punto de equilibrio.`,
          `Corn at ${e.precioBu} USD/bu = ${e.precioT} USD/t; soy ${e.soyaT} USD/t (USDA, ${e.fecha}). Enter your cost and yield in Economics to get margin and break-even.`,
          `Milho a ${e.precioBu} USD/bu = ${e.precioT} USD/t; soja ${e.soyaT} USD/t (USDA, ${e.fecha}). Escreva seu custo e rendimento em Economia para calcular margem e equilíbrio.`);
      const ru = window.V2Vivo?.ultimaRuta;
      if (ru) F.ruta = m(`Ruta de muestreo: ${ru.paradas} paradas separadas al menos ${ru.sep} m, ${ru.km} km ida y vuelta, unos ${ru.min} min a ${ru.vel} km/h. Cubre los cuadros más débiles de zonas distintas.`,
        `Sampling route: ${ru.paradas} stops at least ${ru.sep} m apart, ${ru.km} km round trip, about ${ru.min} min at ${ru.vel} km/h. It covers the weakest squares in different areas.`,
        `Rota de amostragem: ${ru.paradas} paradas a pelo menos ${ru.sep} m, ${ru.km} km ida e volta, cerca de ${ru.min} min a ${ru.vel} km/h. Cobre os quadros mais fracos de áreas diferentes.`);
      this.frasesLargo(F, p);
      this.frasesProy(F, p);
      this.frasesExtra?.(F, p);
      for (const k of Object.keys(F)) F[k] = this.fechasLegibles(F[k]);
      return F;
    },

    // 2026-04-20 → 20 de abril de 2026; 04-21 → 21 de abril (en el idioma elegido).
    fechasLegibles(t) {
      const l = window.V2?.lang || "es";
      const M = { es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"], en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] }[l] || [];
      const ok = (mo, d) => mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
      return String(t)
        .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (x, y, mo, d) => ok(+mo, +d) ? (l === "en" ? `${M[mo - 1]} ${+d}, ${y}` : `${+d} de ${M[mo - 1]} de ${y}`) : x)
        .replace(/(^|[^\d\-])(\d{2})-(\d{2})(?![\d\-])/g, (x, pre, mo, d) => ok(+mo, +d) ? pre + (l === "en" ? `${M[mo - 1]} ${+d}` : `${+d} de ${M[mo - 1]}`) : x);
    },

    // Respuesta de la SI a una pregunta libre. Devuelve [] si no sabe.
    responder(q) {
      const F = this.frases(), s = q.toLowerCase();
      const falta = (es, en, pt) => [{ clave: "faltante", texto: m(es, en, pt), fuente: "Terra Lab", tipo: "faltante", gravedad: "atencion" }];
      const sinDato = [
        [/farm bill|\barc\b|\bplc\b|subsidi|eqip|\bcsp\b/, ["Programas de la Farm Bill (ARC/PLC, EQIP, CSP): la página no tiene rendimientos del condado, precios de referencia ni reglas del programa.", "Farm Bill programs (ARC/PLC, EQIP, CSP): the page has no county yields, reference prices or program rules.", "Programas da Farm Bill (ARC/PLC, EQIP, CSP): a página não tem rendimentos do condado, preços de referência nem regras do programa."]],
        [/seguro|insurance|\baph\b|cobertura de seguro/, ["Seguro agrícola: falta el historial de rendimiento del terreno (APH) y las primas de RMA.", "Crop insurance: the field's yield history (APH) and RMA premiums are missing.", "Seguro agrícola: falta o histórico de rendimento do talhão (APH) e os prêmios da RMA."]],
        [/arancel|tariff|tarifa|china|exporta|comercio/, ["Comercio y aranceles: la página no tiene datos de exportación ni de base local histórica.", "Trade and tariffs: the page has no export data or historical local basis.", "Comércio e tarifas: a página não tem dados de exportação nem de base local histórica."]],
        [/etanol|ethanol|biocombust|biofuel|45z|\bsaf\b/, ["Etanol y biocombustibles: no hay datos de demanda ni de mandatos (EPA RFS).", "Ethanol and biofuels: no demand or mandate data (EPA RFS).", "Etanol e biocombustíveis: não há dados de demanda nem de mandatos (EPA RFS)."]],
        [/futuro|futures|opci[oó]n|hedge|cobertura de precio|contrato/, ["Coberturas con futuros y opciones: falta la curva de futuros y la base local; solo hay el precio al contado del día.", "Futures and options hedging: the futures curve and local basis are missing; only today's cash price exists.", "Hedge com futuros e opções: faltam a curva de futuros e a base local; só há o preço à vista do dia."]],
        [/plaga|gusano|rootworm|enfermedad|maleza|pest|disease|weed/, ["Plagas y enfermedades: no hay modelos de grados día por plaga ni reportes de monitoreo.", "Pests and diseases: no pest degree-day models or scouting reports.", "Pragas e doenças: não há modelos de graus-dia por praga nem relatórios de monitoramento."]],
      ].find(([re]) => re.test(s));
      if (sinDato) return falta(...sinDato[1]);
      const temas = [
        ...(this.temasExtra || []),
        [/grados d[ií]a|gdd|graus/, ["gradosDia"]],
        [/2030|2040|2050|20 a[nñ]os|50 a[nñ]os|futur|cambio clim|proyecci|climate change|dejar? de (sembrar|convenir)|rendir[aá]/, ["proyeccion", "validacion", "horizontes"]],
        [/sequ[ií]a|riesgo|d[eé]cada|hist[oó]ric|drought|risk|decade/, ["riesgo"]],
        [/erosi|p[eé]rdida de suelo|rusle|erosion/, ["erosion"]],
        [/huella|co2|emisi|n2o|nitrato|lixivi|footprint|leach/, ["huella"]],
        [/prescrip|tasa variable|siembra variable|variable rate/, ["prescripcion"]],
        [/muestr|sampl|amostr/, ["muestreoZonas", "ruta"]],
        [/densidad|semilla|seed|h[ií]brido|hybrid|madurez|maturity|matur/, ["densidad"]],
        [/compact|textura|suelo|soil/, ["suelo"]],
        [/sembr|siembr|plant|fecha|ventana|janela/, ["siembra", "fenologia"]],
        [/nitr[oó]g|fertiliz|urea|mrtn/, ["nitrogeno"]],
        [/agua|balance|riego|irrig|sequ[ií]a|drought|water|evapo|\bet\b/, ["agua"]],
        [/suelo|soil|solo|textura|ph\b|compact|materia org|erosi/, ["suelo"]],
        [/margen|costo|precio|rentab|ganan|profit|margin|price|cost|equilibr|break/, ["economia"]],
        [/clima|largo plazo|tendencia|40 a|calent|climate|trend/, ["clima"]],
        [/ruta|muestreo|robot|dron|drone|route|sampl/, ["ruta"]],
        [/cuadro|celda|resoluci|pixel|tama[nñ]o|square|grid/, ["celdas"]],
        [/cosech|harvest|colheit/, ["cosecha"]],
        [/verdor|ndvi|vigor|greenness/, ["fenologia", "celdas"]],
      ];
      const hit = temas.find(([re]) => re.test(s));
      if (!hit) return null;
      const pide = { calibracion: ["Sube el CSV de tu monitor de cosecha (lat, lon, t/ha) en Qué hacer → Plan agronómico; con eso se calibra el NDVI de julio contra tu rendimiento.", "Upload your yield monitor CSV (lat, lon, t/ha) in What to do → Agronomic plan; it calibrates July NDVI against your yield.", "Envie o CSV do seu monitor de colheita (lat, lon, t/ha) em O que fazer → Plano agronômico; com isso o NDVI de julho é calibrado contra seu rendimento."],
        bitacora: ["La bitácora está vacía: agrega siembra, insumos y cosecha en Qué hacer → Plan agronómico → Bitácora del terreno.", "The field log is empty: add planting, inputs and harvest in What to do → Agronomic plan → Field log.", "O diário está vazio: adicione plantio, insumos e colheita em O que fazer → Plano agronômico → Diário do talhão."] };
      if (!hit[1].some(k => F[k])) { const k = hit[1].find(x => pide[x]); return k ? falta(...pide[k]) : null; }
      if (!hit[1].length) return [{ clave: "faltante", texto: m("Grados día: no se pueden calcular bien con lo que trae la página (solo extremos mensuales de NASA POWER y unas semanas de datos diarios). Hace falta la serie diaria de la temporada.", "Growing degree days can't be computed well from what the page has (only NASA POWER monthly extremes and a few weeks of daily data). The season's daily series is needed.", "Graus-dia não podem ser calculados bem com o que a página tem (só extremos mensais do NASA POWER e algumas semanas diárias). Falta a série diária da safra."), fuente: "Terra Lab", tipo: "faltante", gravedad: "atencion" }];
      return hit[1].filter(k => F[k]).map(k => ({ clave: k, texto: F[k], fuente: { siembra: "NASA POWER + Iowa State", agua: "NASA POWER + USDA SSURGO", suelo: "USDA SSURGO", nitrogeno: "Iowa State MRTN", densidad: "Iowa State", economia: "USDA AMS", clima: "NASA POWER 1985–2024", ruta: "Terra Lab", celdas: "Sentinel-2", fenologia: "Sentinel-2", cosecha: "Iowa State + NASA POWER", gradosDia: "NASA POWER diario", riesgo: "NASA POWER mensual 1985–", horizontes: "NASA POWER (extrapolación)", erosion: "RUSLE + SSURGO", huella: "IPCC 2019", muestreoZonas: "Terra Lab", prescripcion: "Iowa State", proyeccion: "CMIP6 HighResMIP (Open-Meteo) + NASA POWER", validacion: "NASA POWER 1985–2024 + USDA NASS" }[k] || this.fuentesExtra?.[k] || "Terra Lab", tipo: "calculo", gravedad: "info" }));
    },

    // ------------------------------------------------------------ notas de campo (por terreno, en este navegador)
    claveNotas() { const l = window.V2?.loc || window.V2?.D?.coordenadas_parcela || {}; return `tl_notas_${(+l.lat || 0).toFixed(3)}_${(+l.lon || 0).toFixed(3)}`; },
    notas() { try { return localStorage.getItem(this.claveNotas()) || ""; } catch (_) { return ""; } },
    guardarNotas(t) { try { localStorage.setItem(this.claveNotas(), t); } catch (_) {} },

    // ------------------------------------------------------------ tarjeta en "Qué hacer"
    tarjeta() {
      if (!this.power && !this.cargando) this.cargarPower();
      if (!this.proy && !this.cargandoProy) this.cargarProyeccion();
      const p = this.calcular(), F = this.frases(p);
      const filas = [
        ["fenologia", m("Ojo con la foto", "Mind the image", "Atenção à foto")],
        ["siembra", m("Cuándo sembrar", "When to plant", "Quando plantar")],
        ["agua", m("Agua de la temporada", "Season water", "Água da safra")],
        ["suelo", m("Suelo", "Soil", "Solo")],
        ["nitrogeno", m("Nitrógeno", "Nitrogen", "Nitrogênio")],
        ["densidad", m("Semilla e híbrido", "Seed and hybrid", "Semente e híbrido")],
        ["gradosDia", m("Grados día de esta temporada", "This season's degree days", "Graus-dia desta safra")],
        ["riesgo", m("Riesgo de agua en 40 años", "40-year water risk", "Risco de água em 40 anos")],
        ["proyeccion", m("Rendimiento con el clima futuro", "Yield under future climate", "Rendimento com o clima futuro")],
        ["validacion", m("Qué tan bien funciona ese modelo", "How well that model works", "Quão bem esse modelo funciona")],
        ["horizontes", m("10, 15, 20 y 50 años", "10, 15, 20 and 50 years", "10, 15, 20 e 50 anos")],
        ["erosion", m("Erosión y vida del suelo", "Erosion and soil life", "Erosão e vida do solo")],
        ["huella", m("Huella de carbono y nitrato", "Carbon footprint and nitrate", "Pegada de carbono e nitrato")],
        ["muestreoZonas", m("Muestreo de suelo por zonas", "Zone soil sampling", "Amostragem de solo por zonas")],
        ["prescripcion", m("Siembra variable", "Variable-rate seeding", "Plantio variável")],
        ["cosecha", m("Cosecha", "Harvest", "Colheita")],
        ["economia", m("Números", "Numbers", "Números")],
        ["clima", m("Clima de 40 años", "40-year climate", "Clima de 40 anos")],
        ["celdas", m("Resolución", "Resolution", "Resolução")],
        ["ruta", m("Muestreo", "Sampling", "Amostragem")],
      ].filter(([k]) => F[k]);
      for (const k of Object.keys(F)) if (this.titulosExtra?.[k] && !filas.some(f => f[0] === k)) filas.push([k, m(...this.titulosExtra[k])]);
      return `
        <div class="card" id="agro-plan">
          <h2 class="card-title" style="margin-bottom:6px">${window.ic ? window.ic("calc", "sm") : ""} <span>${esc(m("Tu plan, calculado con tus datos", "Your plan, worked out from your data", "Seu plano, calculado com seus dados"))}</span></h2>
          <p class="small mut" style="margin:0 0 12px">${esc(m("Seis temas. Abre uno para ver el detalle y la cuenta. Las guías de universidades son reglas, no mediciones.", "Six topics. Open one to see the detail and the math. University guides are rules, not measurements.", "Seis temas. Abra um para ver o detalhe e a conta. Os guias de universidades são regras, não medições."))}</p>
          ${this.vistaPlan(F, filas, p)}
          ${p.faltan.length ? `<details class="plan-glosario"><summary>${esc(m("Lo que todavía no se puede calcular", "What can't be computed yet", "O que ainda não dá para calcular"))} (${p.faltan.length})</summary><ul>${p.faltan.map(f => `<li>${esc(f)}</li>`).join("")}</ul></details>` : ""}
          ${this.glosario()}
          ${this.panelExtra?.() || ""}
          <label class="small" style="display:block;margin-top:12px"><b>${esc(m("Mis notas de campo", "My field notes", "Minhas notas de campo"))}</b>
            <textarea id="agro-notas" class="field" rows="4" style="width:100%;margin-top:4px" placeholder="${esc(m("Lo que viste en el recorrido, decisiones, dudas…", "What you saw, decisions, questions…", "O que você viu, decisões, dúvidas…"))}">${esc(this.notas())}</textarea>
          </label>
          <div class="row-wrap" style="gap:8px;margin-top:8px">
            <button type="button" class="btn btn-sec btn-sm" data-agro-gpx>${esc(m("Puntos de muestreo (GPS)", "Sampling points (GPS)", "Pontos de amostragem (GPS)"))}</button>
            <button type="button" class="btn btn-sec btn-sm" data-agro-presc>${esc(m("Mapa de siembra (maquinaria)", "Seeding map (machinery)", "Mapa de plantio (máquinas)"))}</button>
            <button type="button" class="btn btn-pri btn-sm" data-agro-reporte>${esc(m("Hacer reporte", "Make report", "Fazer relatório"))}</button>
            <span class="xs mut">${esc(m("Las notas se guardan en este navegador.", "Notes are saved in this browser.", "As notas ficam salvas neste navegador."))}</span>
          </div>
        </div>`;
    },

    // Plan en 6 secciones plegables: una frase clara arriba, el detalle y la cuenta adentro.
    vistaPlan(F, filas, p) {
      const titulo = Object.fromEntries(filas);
      const GR = [
        ["temporada", m("Esta temporada", "This season", "Esta safra"), ["fenologia", "siembra", "sueloSiembra", "gradosDia", "cosecha", "secado", "coberturaFechas"]],
        ["agua", m("Agua y clima", "Water and climate", "Água e clima"), ["agua", "etReal", "riesgo", "extremos", "clima", "proyeccion", "validacion", "horizontes"]],
        ["suelo", m("Suelo", "Soil", "Solo"), ["suelo", "erosionReal", "erosion", "calLargo", "fosforoPotasio", "carbonoSuelo", "nitratoAgua", "huella"]],
        ["insumos", m("Semilla y fertilizante", "Seed and fertilizer", "Semente e fertilizante"), ["densidad", "prescripcion", "nitrogenoAjuste", "nitrogeno", "insumos"]],
        ["dinero", m("Dinero y riesgo", "Money and risk", "Dinheiro e risco"), ["economia", "portafolio", "riegoVan", "drenajeTubos", "valorTierra", "banco"]],
        ["mapa", m("Mapa y muestreo", "Map and sampling", "Mapa e amostragem"), ["celdas", "zonasEstables", "anomalias", "muestreoZonas", "semivariograma", "ruta", "calibracion", "bitacora"]],
      ];
      const usados = new Set(GR.flatMap(g => g[2]));
      GR[5][2].push(...Object.keys(titulo).filter(k => !usados.has(k)));
      const pc = (x) => `${Math.round(x * 100)} %`;
      const MES = { es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"], en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] };
      const dia = (md) => { const l = window.V2?.lang || "es", [mo, d] = md.split("-").map(Number), n = (MES[l] || MES.es)[mo - 1]; return l === "en" ? `${n} ${d}` : `${d} de ${n}`; };
      // La frase de arriba de cada sección: lo que importa, con su número.
      const frase = {
        temporada: () => p.siembra && m(`Sembrar maíz entre el ${dia(p.siembra.ini)} y el ${dia(p.siembra.fin)}.${p.fenologia?.fuera ? " La foto actual es de fuera de temporada." : ""}`, `Plant corn between ${dia(p.siembra.ini)} and ${dia(p.siembra.fin)}.${p.fenologia?.fuera ? " The current image is off-season." : ""}`, `Plantar milho entre ${dia(p.siembra.ini)} e ${dia(p.siembra.fin)}.${p.fenologia?.fuera ? " A foto atual é de fora da safra." : ""}`),
        agua: () => { const r = this.riesgo40?.(p.agua?.awc), pr = this.proyectar?.(p.agua?.awc); return r && m(`Falta agua para el maíz ${r.porDecada} veces por década${pr ? `; hacia 2041–2050 rendiría ${Math.round(-pr.res[2].mediana * 100)} % menos` : ""}.`, `Corn runs short of water ${r.porDecada} times per decade${pr ? `; by 2041–2050 it would yield ${Math.round(-pr.res[2].mediana * 100)} % less` : ""}.`, `Falta água para o milho ${r.porDecada} vezes por década${pr ? `; em 2041–2050 renderia ${Math.round(-pr.res[2].mediana * 100)} % menos` : ""}.`); },
        suelo: () => { const s = p.suelo, er = this.erosion?.(s); return s && m(`Suelo de textura ${s.textura} y pH ${s.ph}${s.cal ? ": necesita cal" : ": no necesita cal hoy"}.${er ? ` Arándolo cada año pierde 5 cm en ${er.esc.convencional.anios5cm} años.` : ""}`, `${s.textura.charAt(0).toUpperCase() + s.textura.slice(1)} soil, pH ${s.ph}${s.cal ? ": needs lime" : ": no lime needed today"}.${er ? ` Plowing every year loses 5 cm in ${er.esc.convencional.anios5cm} years.` : ""}`, `Solo de textura ${s.textura} e pH ${s.ph}${s.cal ? ": precisa de calcário" : ": não precisa de calcário hoje"}.${er ? ` Arando todo ano perde 5 cm em ${er.esc.convencional.anios5cm} anos.` : ""}`); },
        insumos: () => { const n = this.nitrogeno?.(), i = p.insumos; return i && m(`${n ? n.total : i.nTrasSoya[1]} kg de nitrógeno y ${i.dens[0]}–${i.dens[1]} mil semillas por hectárea.`, `${n ? n.total : i.nTrasSoya[1]} kg of nitrogen and ${i.dens[0]}–${i.dens[1]} thousand seeds per hectare.`, `${n ? n.total : i.nTrasSoya[1]} kg de nitrogênio e ${i.dens[0]}–${i.dens[1]} mil sementes por hectare.`); },
        dinero: () => { const pf = this.portafolio?.(); return pf ? m(`Maíz-soya deja ${pf.out.maizSoya.media} USD/ha en promedio y pierde dinero ${pc(pf.out.maizSoya.pPerdida)} de los años.`, `Corn-soy leaves ${pf.out.maizSoya.media} USD/ha on average and loses money in ${pc(pf.out.maizSoya.pPerdida)} of years.`, `Milho-soja deixa ${pf.out.maizSoya.media} USD/ha em média e perde dinheiro em ${pc(pf.out.maizSoya.pPerdida)} dos anos.`) : p.economia && m(`Maíz a ${p.economia.precioT} USD/t hoy.`, `Corn at ${p.economia.precioT} USD/t today.`, `Milho a ${p.economia.precioT} USD/t hoje.`); },
        mapa: () => { const an = this.analisisJulios?.(); return an ? m(`${pc(an.estables)} del terreno se comporta igual año con año; ${an.malos} cuadros están peor que de costumbre.`, `${pc(an.estables)} of the field behaves the same every year; ${an.malos} squares are worse than usual.`, `${pc(an.estables)} do terreno se comporta igual ano após ano; ${an.malos} quadros estão piores que o normal.`) : p.celdas && m(`${p.celdas.n} cuadros de ${p.celdas.lado} m.`, `${p.celdas.n} squares of ${p.celdas.lado} m.`, `${p.celdas.n} quadros de ${p.celdas.lado} m.`); },
      };
      // Primera oración a la vista; el resto, plegado.
      const partir = (t) => { const i = t.indexOf(". ", 60); return i < 0 || i > t.length - 20 ? [t, ""] : [t.slice(0, i + 1), t.slice(i + 2)]; };
      const fila = (k) => { const [a, b] = partir(F[k]); return `<div class="plan-fila${k === "fenologia" ? " plan-aviso" : ""}"><div class="plan-fila-t">${esc(titulo[k])}</div><p class="plan-fila-p">${esc(a)}</p>${b ? `<details class="plan-mas"><summary>${esc(m("Ver la cuenta", "See the math", "Ver a conta"))}</summary><p>${esc(b)}</p></details>` : ""}</div>`; };
      return GR.map(([id, nom, ks], i) => {
        const ok = ks.filter(k => F[k] && titulo[k]); if (!ok.length) return "";
        let f = ""; try { f = frase[id]?.() || ""; } catch (_) {}
        if (!f && (this.cargandoJul || this.cargandoDia || this.cargando || this.cargandoProy)) f = m("Calculando con datos reales…", "Working it out with real data…", "Calculando com dados reais…");
        return `<details class="plan-sec" ${i === 0 ? "open" : ""}><summary><span class="plan-sec-n">${esc(nom)}</span><span class="plan-sec-f">${esc(f)}</span><span class="plan-sec-c">${ok.length}</span></summary><div class="plan-sec-body">${ok.map(fila).join("")}</div></details>`;
      }).join("");
    },
    glosario() {
      const G = [
        ["NDVI", "Número de 0 a 1 que mide qué tan verde y viva está la planta, calculado con la luz que refleja.", "A 0-to-1 number for how green and alive the plant is, from the light it reflects.", "Número de 0 a 1 que mede quão verde e viva está a planta, pela luz que reflete."],
        ["Evapotranspiración (ET)", "Agua que el suelo y la planta pierden hacia el aire. Es lo que el cultivo \"bebe\".", "Water the soil and plant lose to the air. It is what the crop \"drinks\".", "Água que o solo e a planta perdem para o ar. É o que a cultura \"bebe\"."],
        ["Grados día", "Suma del calor útil de cada día. La planta avanza de etapa cuando junta cierta cantidad.", "Sum of each day's useful heat. The plant moves to its next stage after collecting enough.", "Soma do calor útil de cada dia. A planta muda de fase ao juntar certa quantidade."],
        ["RUSLE", "Fórmula oficial del USDA para estimar cuánta tierra se lleva la lluvia.", "The USDA's standard formula for how much soil rain washes away.", "Fórmula oficial do USDA para estimar quanto solo a chuva leva."],
        ["MRTN", "Método de Iowa State para elegir la dosis de nitrógeno que más dinero deja.", "Iowa State's method for the nitrogen rate that pays the most.", "Método da Iowa State para escolher a dose de nitrogênio que mais rende."],
        ["Semivariograma", "Gráfica que dice a qué distancia dos puntos del terreno dejan de parecerse. Sirve para decidir cada cuánto muestrear.", "A chart of how far apart two spots must be before they stop resembling each other. It sets sampling distance.", "Gráfico que diz a que distância dois pontos deixam de se parecer. Serve para decidir de quanto em quanto amostrar."],
        ["CMIP6", "Conjunto de modelos del clima futuro que usa el IPCC.", "The set of future-climate models the IPCC uses.", "Conjunto de modelos do clima futuro usado pelo IPCC."],
        ["Valor presente", "Cuánto vale hoy una inversión, sumando lo que dejará cada año y descontando el costo.", "What an investment is worth today: future yearly gains minus the cost, discounted.", "Quanto vale hoje um investimento: os ganhos de cada ano menos o custo, descontados."],
        ["GPX / GeoJSON", "Formatos de archivo para llevar puntos y mapas al GPS, al robot o a la maquinaria.", "File formats to carry points and maps to a GPS, robot or machinery.", "Formatos de arquivo para levar pontos e mapas ao GPS, ao robô ou às máquinas."],
      ];
      return `<details class="plan-glosario"><summary>${esc(m("Palabras técnicas, en simple", "Technical words, plainly", "Palavras técnicas, em simples"))}</summary><dl>${G.map(g => `<dt>${esc(g[0])}</dt><dd>${esc(m(g[1], g[2], g[3]))}</dd>`).join("")}</dl></details>`;
    },

    // ------------------------------------------------------------ reporte imprimible
    reporte() {
      const p = this.calcular(), F = this.frases(p), V = window.V2 || {};
      const nombre = V.terrainName || V.D?.nombre || m("Mi terreno", "My field", "Meu terreno");
      const loc = V.D?.coordenadas_parcela || V.loc || {};
      const hoy = new Date().toISOString().slice(0, 10);
      const sec = Object.entries(F).map(([k, t]) => `<h3>${esc(k)}</h3><p>${esc(t)}</p>`).join("");
      const html = `<!doctype html><html lang="${V.lang || "es"}"><head><meta charset="utf-8"><title>${esc(m("Reporte", "Report", "Relatório"))} · ${esc(nombre)}</title>
        <style>body{font:14px/1.5 system-ui,sans-serif;max-width:780px;margin:24px auto;padding:0 16px;color:#1b1b1b}h1{font-size:22px;margin:0}h3{font-size:14px;margin:16px 0 2px;text-transform:capitalize;color:#2E7D32}.mut{color:#666;font-size:12px}pre{white-space:pre-wrap;background:#f4f4f4;padding:10px;border-radius:6px}ul{margin:4px 0 0 18px}@media print{button{display:none}}</style></head><body>
        <button onclick="print()">${esc(m("Imprimir / PDF", "Print / PDF", "Imprimir / PDF"))}</button>
        <h1>Terra Lab · ${esc(nombre)}</h1>
        <p class="mut">${esc(hoy)} · ${(+loc.lat).toFixed(4)}, ${(+loc.lon).toFixed(4)}${p.celdas ? ` · ${p.celdas.ha} ha · ${p.celdas.n} ${esc(m("cuadros", "squares", "quadros"))}` : ""}</p>
        ${sec}
        <h3>${esc(m("Faltantes", "Missing", "Faltantes"))}</h3><ul>${p.faltan.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
        <h3>${esc(m("Notas de campo", "Field notes", "Notas de campo"))}</h3><pre>${esc(this.notas() || "—")}</pre>
        <p class="mut">${esc(m("Fuentes: NASA POWER, USDA SSURGO, USDA AMS, Sentinel-2, guías de Iowa State University. Las guías son reglas, no mediciones del terreno.", "Sources: NASA POWER, USDA SSURGO, USDA AMS, Sentinel-2, Iowa State University guides. Guides are rules, not field measurements.", "Fontes: NASA POWER, USDA SSURGO, USDA AMS, Sentinel-2, guias da Iowa State University. Os guias são regras, não medições do terreno."))}</p>
        </body></html>`;
      const w = window.open("", "_blank");
      if (w) { w.document.write(html); w.document.close(); }
      else window.V2?.showToast?.(m("El navegador bloqueó la ventana del reporte.", "The browser blocked the report window.", "O navegador bloqueou a janela do relatório."), 4000);
    },
  };

  // =============================================================================
  // Largo plazo y temporada real: datos de NASA POWER pedidos en vivo (diario de la temporada y 40 años mensuales).
  // =============================================================================
  const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const POWER = "https://power.larc.nasa.gov/api/temporal";
  Object.assign(Agro, {
    power: null,
    cargando: false,

    async cargarPower() {
      const loc = window.V2?.D?.coordenadas_parcela || window.V2?.loc;
      if (!loc?.lat || this.cargando) return this.power;
      const clave = `tl_power_${(+loc.lat).toFixed(3)}_${(+loc.lon).toFixed(3)}`;
      try { const c = JSON.parse(localStorage.getItem(clave) || "null"); if (c && Date.now() - c.t < 864e5) return (this.power = c); } catch (_) {}
      this.cargando = true;
      const hoy = new Date(), anio = hoy.getUTCFullYear();
      const f = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
      const q = `community=AG&longitude=${(+loc.lon).toFixed(4)}&latitude=${(+loc.lat).toFixed(4)}&format=JSON`;
      try {
        const [d, mo] = await Promise.all([
          fetch(`${POWER}/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR&start=${anio}0401&end=${f(hoy)}&${q}`).then(r => r.json()),
          fetch(`${POWER}/monthly/point?parameters=PRECTOTCORR,T2M&start=1985&end=${anio - 2}&${q}`).then(r => r.json()),
        ]);
        this.power = { t: Date.now(), anio, diario: d.properties.parameter, mensual: mo.properties.parameter };
        try { localStorage.setItem(clave, JSON.stringify(this.power)); } catch (_) {}
      } catch (e) { this.power = { error: String(e) }; }
      this.cargando = false;
      if (window.V2?.space === "recom") window.V2.renderActiveViews();
      return this.power;
    },

    // Grados día del maíz (método 10/30 °C) desde la siembra supuesta, con la serie diaria real.
    gradosDia(siembraMMDD) {
      const d = this.power?.diario; if (!d?.T2M_MAX) return null;
      const ini = `${this.power.anio}${siembraMMDD.replace("-", "")}`;
      let gdd = 0, dias = 0, ult = null, floracion = null, madurez = null, lluvia = 0;
      for (const k of Object.keys(d.T2M_MAX).sort()) {
        const tx = d.T2M_MAX[k], tn = d.T2M_MIN[k], p = d.PRECTOTCORR[k];
        if (k < ini || tx <= -998 || tn <= -998) continue;
        const c = (t) => Math.min(30, Math.max(10, t));
        gdd += (c(tx) + c(tn)) / 2 - 10; dias++; ult = k; if (p > -998) lluvia += p;
        if (!floracion && gdd >= 780) floracion = k;      // ~1400 °F·d: floración (guía ISU)
        if (!madurez && gdd >= 1450) madurez = k;        // ~2600 °F·d: capa negra, híbrido de 105–112 días
      }
      const fmt = (k) => k && `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6)}`;
      return { gdd: Math.round(gdd), dias, ult: fmt(ult), floracion: fmt(floracion), madurez: fmt(madurez), lluvia: Math.round(lluvia) };
    },

    // 40 años: lluvia de mayo a septiembre por año, años con déficit de agua y tendencias.
    riesgo40(awc, etc = ETC_MAIZ_MM) {
      const p = this.power?.mensual; if (!p?.PRECTOTCORR || awc == null) return null;
      const anios = {};
      for (const [k, v] of Object.entries(p.PRECTOTCORR)) {
        const a = +k.slice(0, 4), mes = +k.slice(4);
        if (mes < 5 || mes > 9 || v < 0) continue;
        anios[a] = (anios[a] || 0) + v * DIAS_MES[mes - 1];   // mm/día × días
      }
      const tJul = Object.entries(p.T2M || {}).filter(([k, v]) => +k.slice(4) === 7 && v > -998).map(([k, v]) => [+k.slice(0, 4), v]);
      const lista = Object.entries(anios).map(([a, mm]) => ({ a: +a, mm: Math.round(mm) })).sort((x, y) => x.a - y.a);
      const n = lista.length; if (n < 10) return null;
      const deficit = lista.filter(x => x.mm + awc < etc);
      const pend = (pts) => { const mx = pts.reduce((s, q) => s + q[0], 0) / pts.length, my = pts.reduce((s, q) => s + q[1], 0) / pts.length; return pts.reduce((s, q) => s + (q[0] - mx) * (q[1] - my), 0) / pts.reduce((s, q) => s + (q[0] - mx) ** 2, 0); };
      const tendLluvia = pend(lista.map(x => [x.a, x.mm])) * 10, tendJul = tJul.length > 10 ? pend(tJul) * 10 : null;
      const orden = [...lista].sort((x, y) => x.mm - y.mm);
      const julMedia = tJul.reduce((s, q) => s + q[1], 0) / (tJul.length || 1);
      return { n, desde: lista[0].a, hasta: lista[n - 1].a, media: Math.round(lista.reduce((s, x) => s + x.mm, 0) / n), seco: orden[0], humedo: orden[n - 1],
        deficit: deficit.map(x => x.a), pDeficit: deficit.length / n, porDecada: +(deficit.length / n * 10).toFixed(1),
        tendLluvia: +tendLluvia.toFixed(1), tendJul: tendJul == null ? null : +tendJul.toFixed(2), julMedia: +julMedia.toFixed(1),
        // Extrapolación lineal: no es un modelo climático; sirve para ordenar el riesgo, no para predecir.
        horizontes: [10, 15, 20, 50].map(h => ({ h, jul: +(julMedia + (tendJul || 0) * h / 10).toFixed(1), mm: Math.round(lista.reduce((s, x) => s + x.mm, 0) / n + tendLluvia * h / 10) })) };
    },

    // Erosión con RUSLE (unidades de EE. UU.): A = R·K·LS·C·P, en t/acre/año → t/ha/año.
    erosion(g) {
      if (!g?.k) return null;
      const m2 = /(\d+)\s*to\s*(\d+)\s*percent/.exec(g.unidad || ""); const pend = m2 ? (+m2[1] + +m2[2]) / 2 : 3;
      const R = 175, largo = 300;   // R de Iowa central (isoerodentas NRCS) y ladera de 300 pies: supuestos
      const th = Math.atan(pend / 100), mm = pend >= 5 ? 0.5 : pend >= 3.5 ? 0.4 : pend >= 1 ? 0.3 : 0.2;
      const LS = Math.pow(largo / 72.6, mm) * (10.8 * Math.sin(th) + 0.03);
      const C = { convencional: 0.35, reducida: 0.2, directa: 0.1, directaCobertura: 0.05 };   // maíz-soya, valores típicos de tablas RUSLE
      const capa = 50 * 10 * (g.da || 1.3);   // 5 cm de suelo = 50 mm × 10 × densidad → t/ha
      const esc = Object.fromEntries(Object.entries(C).map(([k, c]) => { const tha = R * g.k * LS * c * 2.2417; return [k, { tha: +tha.toFixed(1), anios5cm: Math.round(capa / tha) }]; }));
      return { pend, LS: +LS.toFixed(2), R, largo, T: 11.2, esc };   // T = 5 t/acre = 11.2 t/ha (tolerancia NRCS)
    },

    // Huella de carbono por hectárea y por tonelada (IPCC 2019, nivel 1; PCG 100 años del AR6).
    huella(nKg, rendT) {
      const n2oDir = nKg * 0.01, n2oLix = nKg * 0.24 * 0.011, n2oVol = nKg * 0.11 * 0.01;   // kg N2O-N
      const aCO2 = (x) => x * 44 / 28 * 273;
      const fab = nKg * 4.0, diesel = 50 * 2.68;   // fabricar N ~4 kg CO2e/kg; 50 L de diésel por ha
      const tot = aCO2(n2oDir) + aCO2(n2oLix + n2oVol) + fab + diesel;
      return { directo: Math.round(aCO2(n2oDir)), indirecto: Math.round(aCO2(n2oLix + n2oVol)), fab: Math.round(fab), diesel: Math.round(diesel), total: Math.round(tot),
        porT: rendT ? Math.round(tot / rendT) : null, nitrato: Math.round(nKg * 0.24) };
    },

    // Muestreo por zonas: 3 puntos repartidos dentro de cada zona (el más lejano de los ya elegidos).
    muestreoZonas(porZona = 3) {
      const cs = window.V2?.terrainResp?.celdas || []; if (!cs.length) return null;
      const zona = (v) => v < 0.35 ? 1 : v < 0.58 ? 2 : 3;
      const d = (a, b) => Math.hypot((a.lat - b.lat) * 111320, (a.lon - b.lon) * 111320 * Math.cos(a.lat * Math.PI / 180));
      const pts = [];
      for (const z of [1, 2, 3]) {
        const g = cs.filter(c => c.ndvi != null && zona(c.ndvi) === z); if (!g.length) continue;
        const cx = { lat: g.reduce((s, c) => s + c.lat, 0) / g.length, lon: g.reduce((s, c) => s + c.lon, 0) / g.length };
        const elegidos = [g.reduce((a, c) => d(c, cx) < d(a, cx) ? c : a)];
        while (elegidos.length < Math.min(porZona, g.length)) elegidos.push(g.reduce((a, c) => Math.min(...elegidos.map(e => d(c, e))) > Math.min(...elegidos.map(e => d(a, e))) ? c : a));
        elegidos.forEach(c => pts.push({ zona: z, lat: c.lat, lon: c.lon, ndvi: c.ndvi, n: g.length }));
      }
      return pts;
    },

    descargar(nombre, tipo, texto) {
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([texto], { type: tipo })); a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
    gpx() {
      const pts = this.muestreoZonas(); if (!pts?.length) return;
      const nz = { 1: m("baja", "low", "baixa"), 2: m("media", "medium", "média"), 3: m("alta", "high", "alta") };
      const wpt = pts.map((p, i) => `<wpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"><name>M${i + 1} ${nz[p.zona]}</name><desc>NDVI ${p.ndvi}</desc></wpt>`).join("\n");
      this.descargar("muestreo_zonas.gpx", "application/gpx+xml", `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Terra Lab" xmlns="http://www.topografix.com/GPX/1/1">\n${wpt}\n</gpx>\n`);
    },
    prescripcion() {
      const cs = window.V2?.terrainResp?.celdas || []; if (!cs.length) return;
      const dens = { 1: 79000, 2: 84000, 3: 89000 };   // semillas/ha por zona (guía ISU: menos semilla donde rinde menos)
      const feats = cs.filter(c => c.ndvi != null && c.limites).map(c => {
        const z = c.ndvi < 0.35 ? 1 : c.ndvi < 0.58 ? 2 : 3, [[la0, lo0], [la1, lo1]] = c.limites;
        return { type: "Feature", properties: { id: c.id, zona: z, ndvi: c.ndvi, semillas_ha: dens[z] }, geometry: { type: "Polygon", coordinates: [[[lo0, la0], [lo1, la0], [lo1, la1], [lo0, la1], [lo0, la0]]] } };
      });
      this.descargar("prescripcion_siembra.geojson", "application/geo+json", JSON.stringify({ type: "FeatureCollection", features: feats }));
    },

    frasesLargo(F, p) {
      const s = p.siembra;
      const gd = s && this.gradosDia(s.ini);
      if (gd) F.gradosDia = m(`Grados día (10/30 °C) desde el ${s.ini} hasta el ${gd.ult}: ${gd.gdd} °C·día en ${gd.dias} días, con ${gd.lluvia} mm de lluvia (NASA POWER diario). Floración (~780) ${gd.floracion ? "el " + gd.floracion : "aún no"}; madurez de un híbrido de 105–112 días (~1450) ${gd.madurez ? "el " + gd.madurez : "aún no"}.`,
        `Growing degree days (10/30 °C) from ${s.ini} to ${gd.ult}: ${gd.gdd} °C·day over ${gd.dias} days, with ${gd.lluvia} mm of rain (NASA POWER daily). Silking (~780) ${gd.floracion ? "on " + gd.floracion : "not yet"}; maturity of a 105–112-day hybrid (~1450) ${gd.madurez ? "on " + gd.madurez : "not yet"}.`,
        `Graus-dia (10/30 °C) de ${s.ini} até ${gd.ult}: ${gd.gdd} °C·dia em ${gd.dias} dias, com ${gd.lluvia} mm de chuva (NASA POWER diário). Florescimento (~780) ${gd.floracion ? "em " + gd.floracion : "ainda não"}; maturação de um híbrido de 105–112 dias (~1450) ${gd.madurez ? "em " + gd.madurez : "ainda não"}.`);
      const r = this.riesgo40(p.agua?.awc);
      if (r) {
        F.riesgo = m(`Riesgo de agua en ${r.n} temporadas reales (${r.desde}–${r.hasta}): de mayo a septiembre llovieron ${r.media} mm de media; la más seca fue ${r.seco.a} (${r.seco.mm} mm) y la más húmeda ${r.humedo.a} (${r.humedo.mm} mm). Con el agua del suelo, faltó agua para el maíz en ${r.deficit.length} años (${r.deficit.join(", ") || "ninguno"}): ${r.porDecada} por década. Tendencia: ${r.tendLluvia >= 0 ? "+" : ""}${r.tendLluvia} mm de lluvia y ${r.tendJul >= 0 ? "+" : ""}${r.tendJul} °C en julio por década.`,
          `Water risk over ${r.n} real seasons (${r.desde}–${r.hasta}): May–September averaged ${r.media} mm; the driest was ${r.seco.a} (${r.seco.mm} mm) and the wettest ${r.humedo.a} (${r.humedo.mm} mm). Counting soil water, corn ran short in ${r.deficit.length} years (${r.deficit.join(", ") || "none"}): ${r.porDecada} per decade. Trend: ${r.tendLluvia >= 0 ? "+" : ""}${r.tendLluvia} mm of rain and ${r.tendJul >= 0 ? "+" : ""}${r.tendJul} °C in July per decade.`,
          `Risco de água em ${r.n} safras reais (${r.desde}–${r.hasta}): de maio a setembro choveram ${r.media} mm em média; a mais seca foi ${r.seco.a} (${r.seco.mm} mm) e a mais úmida ${r.humedo.a} (${r.humedo.mm} mm). Com a água do solo, faltou água para o milho em ${r.deficit.length} anos (${r.deficit.join(", ") || "nenhum"}): ${r.porDecada} por década. Tendência: ${r.tendLluvia >= 0 ? "+" : ""}${r.tendLluvia} mm de chuva e ${r.tendJul >= 0 ? "+" : ""}${r.tendJul} °C em julho por década.`);
        F.horizontes = m(`Si la tendencia de 40 años sigue igual (extrapolación lineal, no un modelo climático): ${r.horizontes.map(x => `en ${x.h} años, julio a ${x.jul} °C de media y ${x.mm} mm de mayo a septiembre`).join("; ")}. Para planear a 20 y 50 años hacen falta proyecciones como NASA NEX-GDDP.`,
          `If the 40-year trend holds (linear extrapolation, not a climate model): ${r.horizontes.map(x => `in ${x.h} years, July averaging ${x.jul} °C and ${x.mm} mm May–September`).join("; ")}. Planning at 20 and 50 years needs projections such as NASA NEX-GDDP.`,
          `Se a tendência de 40 anos continuar (extrapolação linear, não um modelo climático): ${r.horizontes.map(x => `em ${x.h} anos, julho com ${x.jul} °C de média e ${x.mm} mm de maio a setembro`).join("; ")}. Para planejar a 20 e 50 anos são precisas projeções como NASA NEX-GDDP.`);
      }
      const er = this.erosion(p.suelo);
      if (er) F.erosion = m(`Erosión (RUSLE; pendiente ${er.pend} %, ladera de ${er.largo} pies, R=${er.R}, LS=${er.LS}): labranza convencional ${er.esc.convencional.tha} t/ha/año (pierde 5 cm de suelo en ${er.esc.convencional.anios5cm} años); reducida ${er.esc.reducida.tha}; siembra directa ${er.esc.directa.tha} (${er.esc.directa.anios5cm} años); directa con cobertura ${er.esc.directaCobertura.tha} (${er.esc.directaCobertura.anios5cm} años). La tolerancia es ${er.T} t/ha/año. R, la ladera y C son valores típicos, no medidos.`,
        `Erosion (RUSLE; slope ${er.pend} %, ${er.largo}-ft slope, R=${er.R}, LS=${er.LS}): conventional tillage ${er.esc.convencional.tha} t/ha/yr (loses 5 cm of soil in ${er.esc.convencional.anios5cm} years); reduced ${er.esc.reducida.tha}; no-till ${er.esc.directa.tha} (${er.esc.directa.anios5cm} years); no-till with cover ${er.esc.directaCobertura.tha} (${er.esc.directaCobertura.anios5cm} years). Tolerance is ${er.T} t/ha/yr. R, slope length and C are typical values, not measured.`,
        `Erosão (RUSLE; declividade ${er.pend} %, encosta de ${er.largo} pés, R=${er.R}, LS=${er.LS}): preparo convencional ${er.esc.convencional.tha} t/ha/ano (perde 5 cm de solo em ${er.esc.convencional.anios5cm} anos); reduzido ${er.esc.reducida.tha}; plantio direto ${er.esc.directa.tha} (${er.esc.directa.anios5cm} anos); direto com cobertura ${er.esc.directaCobertura.tha} (${er.esc.directaCobertura.anios5cm} anos). A tolerância é ${er.T} t/ha/ano. R, comprimento da encosta e C são valores típicos, não medidos.`);
      const hu = p.insumos && this.huella(p.insumos.nTrasSoya[1], +(window.V2?.farmExtra?.yieldMaize) || 12.6);
      if (hu) F.huella = m(`Huella de carbono con ${p.insumos.nTrasSoya[1]} kg N/ha (IPCC 2019, nivel 1): óxido nitroso directo ${hu.directo} + indirecto ${hu.indirecto} + fabricar el nitrógeno ${hu.fab} + diésel ${hu.diesel} = ${hu.total} kg CO₂e/ha, unos ${hu.porT} kg por tonelada. Nitrato que se lava hacia el agua: ~${hu.nitrato} kg N/ha/año (fracción por defecto del IPCC, no medida en esta cuenca).`,
        `Carbon footprint at ${p.insumos.nTrasSoya[1]} kg N/ha (IPCC 2019, tier 1): direct nitrous oxide ${hu.directo} + indirect ${hu.indirecto} + making the nitrogen ${hu.fab} + diesel ${hu.diesel} = ${hu.total} kg CO₂e/ha, about ${hu.porT} kg per tonne. Nitrate leached to water: ~${hu.nitrato} kg N/ha/yr (IPCC default fraction, not measured in this watershed).`,
        `Pegada de carbono com ${p.insumos.nTrasSoya[1]} kg N/ha (IPCC 2019, nível 1): óxido nitroso direto ${hu.directo} + indireto ${hu.indirecto} + fabricar o nitrogênio ${hu.fab} + diesel ${hu.diesel} = ${hu.total} kg CO₂e/ha, cerca de ${hu.porT} kg por tonelada. Nitrato lixiviado para a água: ~${hu.nitrato} kg N/ha/ano (fração padrão do IPCC, não medida nesta bacia).`);
      const mz = this.muestreoZonas();
      if (mz?.length) F.muestreoZonas = m(`Muestreo de suelo por zonas: ${mz.length} puntos repartidos según la variabilidad de cada zona (${[1, 2, 3].map(z => mz.find(x => x.zona === z)?.n).filter(Boolean).join(" / ")} cuadros por zona). En cada punto, una muestra compuesta de 15 a 20 piquetes a 0–15 cm. Descárgalo en GPX para el GPS o el robot.`,
        `Zone soil sampling: ${mz.length} points spread by each zone's variability (${[1, 2, 3].map(z => mz.find(x => x.zona === z)?.n).filter(Boolean).join(" / ")} squares per zone). At each point, a composite of 15–20 cores at 0–15 cm. Download it as GPX for the GPS or robot.`,
        `Amostragem de solo por zonas: ${mz.length} pontos distribuídos pela variabilidade de cada zona (${[1, 2, 3].map(z => mz.find(x => x.zona === z)?.n).filter(Boolean).join(" / ")} quadros por zona). Em cada ponto, uma amostra composta de 15 a 20 subamostras a 0–15 cm. Baixe em GPX para o GPS ou o robô.`);
      if (p.celdas) F.prescripcion = m(`Prescripción de siembra variable: zona baja 79 mil, media 84 mil y alta 89 mil semillas/ha (guía ISU), por cuadro, en GeoJSON para la maquinaria. Con la foto de noviembre las zonas no son confiables: rehazla con imágenes de julio.`,
        `Variable-rate seeding prescription: low zone 79k, medium 84k, high 89k seeds/ha (ISU guide), per square, as GeoJSON for the machinery. With the November image the zones aren't reliable: redo it with July imagery.`,
        `Prescrição de plantio variável: zona baixa 79 mil, média 84 mil e alta 89 mil sementes/ha (guia ISU), por quadro, em GeoJSON para as máquinas. Com a foto de novembro as zonas não são confiáveis: refaça com imagens de julho.`);
      if (this.power?.error) F.powerError = m("NASA POWER no respondió: grados día y riesgo de 40 años no se calcularon.", "NASA POWER did not answer: degree days and 40-year risk were not computed.", "NASA POWER não respondeu: graus-dia e risco de 40 anos não foram calculados.");
      return F;
    },
  });

  // =============================================================================
  // Proyección de rendimiento 2031–2050: 7 modelos CMIP6 de alta resolución (HighResMIP, vía Open-Meteo)
  // dentro de un modelo de rendimiento validado con 40 años observados de NASA POWER.
  // =============================================================================
  const MODELOS = ["CMCC_CM2_VHR4", "FGOALS_f3_H", "HiRAM_SIT_HR", "MRI_AGCM3_2_S", "EC_Earth3P_HR", "MPI_ESM1_2_XR", "NICAM16_8S"];
  const CALIB = 0.6;   // reduce la pérdida del modelo: calibrado con Iowa 1988 (−30 %) y 2012 (−22 %), USDA NASS aprox.
  const gradoDia = (tx, tn, b) => tn >= b ? (tx + tn) / 2 - b : tx <= b ? 0 : (tx - b) ** 2 / (2 * (tx - tn));   // método del triángulo
  Object.assign(Agro, {
    proy: null,
    cargandoProy: false,

    // Resumen por año: lluvia may–sep, grados día útiles (10–29 °C) y dañinos (>29 °C, jun–ago).
    resumirAnios(fechas, tmax, tmin, prec) {
      const out = {};
      for (let i = 0; i < fechas.length; i++) {
        const y = +fechas[i].slice(0, 4), mo = fechas[i].includes("-") ? +fechas[i].slice(5, 7) : +fechas[i].slice(4, 6), tx = tmax[i], tn = tmin[i], pr = prec[i];
        if (tx == null || tn == null || tx < -90 || tn < -90) continue;
        const o = out[y] = out[y] || { p: 0, g: 0, k: 0 };
        if (mo >= 5 && mo <= 9) { o.p += Math.max(0, pr || 0); o.g += gradoDia(tx, tn, 10) - gradoDia(tx, tn, 29); }
        if (mo >= 6 && mo <= 8) o.k += gradoDia(tx, tn, 29);
      }
      return out;
    },

    // Rendimiento relativo: calor (forma de Schlenker y Roberts 2009) × agua (FAO-33, Ky = 1.25 para maíz).
    rendRel(o, awc) {
      const eta = Math.min(ETC_MAIZ_MM, o.p + awc);
      return Math.exp(0.0003 * o.g - 0.0065 * o.k) * Math.max(0, 1 - 1.25 * (1 - eta / ETC_MAIZ_MM));
    },
    serieRel(anios, awc, desde, hasta) {
      const ys = Object.keys(anios).map(Number).filter(y => y >= desde && y <= hasta);
      const base = ys.reduce((s, y) => s + this.rendRel(anios[y], awc), 0) / ys.length;
      return { base, rel: (y) => 1 - CALIB * (1 - this.rendRel(anios[y], awc) / base) };
    },

    async cargarProyeccion() {
      const loc = window.V2?.D?.coordenadas_parcela || window.V2?.loc;
      if (!loc?.lat || this.cargandoProy) return this.proy;
      const clave = `tl_proy_${(+loc.lat).toFixed(2)}_${(+loc.lon).toFixed(2)}`;
      // El terreno de la demo ya trae su resumen calculado: no hace falta esperar 30 s ni gastar el límite del servicio.
      const R = window.FS_PROY;
      if (R && Math.abs(R.lat - loc.lat) < 0.05 && Math.abs(R.lon - loc.lon) < 0.05) { this.proy = R; return R; }
      try { const c = JSON.parse(localStorage.getItem(clave) || "null"); if (c && Object.keys(c.modelos || {}).length && Date.now() - c.t < 30 * 864e5) return (this.proy = c); } catch (_) {}
      // Tras un rechazo por límite, no volver a pedir en una hora: cada intento gasta la cuota y alarga el bloqueo.
      const espera = +(localStorage.getItem("tl_proy_espera") || 0);
      if (Date.now() < espera) { this.proy = { error: "límite de Open-Meteo; se reintenta después" }; return this.proy; }
      this.cargandoProy = true;
      const la = (+loc.lat).toFixed(4), lo = (+loc.lon).toFixed(4);
      try {
        const [obs, cl] = await Promise.all([
          fetch(`${POWER}/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR&community=AG&longitude=${lo}&latitude=${la}&start=19850101&end=20241231&format=JSON`).then(r => r.json()),
          fetch(`https://climate-api.open-meteo.com/v1/climate?latitude=${la}&longitude=${lo}&start_date=1985-01-01&end_date=2050-12-31&models=${MODELOS.join(",")}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum`).then(r => r.json()),
        ]);
        const P = obs.properties.parameter, f = Object.keys(P.T2M_MAX);
        const observado = this.resumirAnios(f, f.map(k => P.T2M_MAX[k]), f.map(k => P.T2M_MIN[k]), f.map(k => P.PRECTOTCORR[k]));
        const modelos = {};
        for (const md of MODELOS) {
          const tx = cl.daily?.[`temperature_2m_max_${md}`]; if (!tx) continue;
          modelos[md] = this.resumirAnios(cl.daily.time, tx, cl.daily[`temperature_2m_min_${md}`], cl.daily[`precipitation_sum_${md}`]);
        }
        if (!Object.keys(modelos).length) throw new Error(cl.reason || "Open-Meteo sin datos");
        this.proy = { t: Date.now(), observado, modelos };
        try { localStorage.setItem(clave, JSON.stringify(this.proy)); } catch (_) {}
      } catch (e) {
        try { localStorage.setItem("tl_proy_espera", String(Date.now() + 3600e3)); } catch (_) {}
        // Respaldo: resumen guardado del terreno de Iowa (recursos/proyeccion_iowa.js) si el terreno está ahí.
        const R = window.FS_PROY;
        this.proy = R && Math.abs(R.lat - loc.lat) < 0.05 && Math.abs(R.lon - loc.lon) < 0.05 ? { ...R, respaldo: true } : { error: String(e) };
      }
      this.cargandoProy = false;
      if (window.V2?.space === "recom") window.V2.renderActiveViews();
      return this.proy;
    },

    // Cambio de rendimiento por ventana de 10 años contra 1985–2014 de cada modelo (método delta: quita el sesgo de cada modelo).
    proyectar(awc) {
      const pr = this.proy; if (!pr?.modelos || awc == null) return null;
      const ob = pr.observado, so = this.serieRel(ob, awc, 1985, 2024);
      const yo = Object.keys(ob).map(Number);
      const validacion = yo.map(y => ({ y, r: +so.rel(y).toFixed(2) })).sort((a, b) => a.r - b.r);
      const perdidaObs = yo.filter(y => so.rel(y) < 0.8).length / yo.length;
      const ventanas = [[2031, 2040, 10], [2036, 2045, 15], [2041, 2050, 20]];
      const porModelo = Object.entries(pr.modelos).map(([md, an]) => {
        const s = this.serieRel(an, awc, 1985, 2014);
        const hist = Object.keys(an).map(Number).filter(y => y >= 1985 && y <= 2014);
        const kHist = hist.reduce((t, y) => t + an[y].k, 0) / hist.length;
        return { md, kHist, v: ventanas.map(([a, b]) => {
          const ys = Object.keys(an).map(Number).filter(y => y >= a && y <= b);
          const rel = ys.map(y => s.rel(y));
          return { cambio: rel.reduce((t, x) => t + x, 0) / rel.length - 1, pPerdida: rel.filter(x => x < 0.8).length / rel.length, k: ys.reduce((t, y) => t + an[y].k, 0) / ys.length, p: ys.reduce((t, y) => t + an[y].p, 0) / ys.length };
        }) };
      });
      const med = (xs) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
      const kObs = yo.filter(y => y <= 2014).reduce((t, y) => t + ob[y].k, 0) / yo.filter(y => y <= 2014).length;
      const res = ventanas.map(([a, b, h], i) => {
        const c = porModelo.map(m2 => m2.v[i].cambio), pp = porModelo.map(m2 => m2.v[i].pPerdida);
        return { a, b, h, mediana: med(c), min: Math.min(...c), max: Math.max(...c), pPerdida: med(pp), negativos: c.filter(x => x < 0).length, n: c.length, kdd: med(porModelo.map(m2 => m2.v[i].k)) };
      });
      // Umbral para el maíz: más de 1 año de cada 5 con pérdida mayor al 20 %.
      const umbral = res.find(r => r.pPerdida > 0.2);
      return { validacion, perdidaObs, kObs, kModelos: med(porModelo.map(m2 => m2.kHist)), res, umbral, n: porModelo.length };
    },

    frasesProy(F, p) {
      const pr = this.proyectar(p.agua?.awc);
      if (!pr) { if (this.proy?.error) F.proyError = m("Las proyecciones climáticas no respondieron.", "Climate projections did not answer.", "As projeções climáticas não responderam."); return F; }
      const v = pr.validacion, pc = (x) => `${x >= 0 ? "+" : ""}${Math.round(x * 100)} %`;
      F.validacion = m(`Modelo de rendimiento probado con 40 años observados (NASA POWER diario): los peores años que calcula son ${v[0].y} (${Math.round(v[0].r * 100)} % de lo normal) y ${v[1].y} (${Math.round(v[1].r * 100)} %), las dos grandes sequías de Iowa. Está calibrado con las pérdidas estatales de 1988 y 2012. No detecta los daños por exceso de agua, como la inundación de 1993. Años con pérdida mayor al 20 %: ${Math.round(pr.perdidaObs * 100)} % del periodo.`,
        `Yield model tested on 40 observed years (NASA POWER daily): the worst years it computes are ${v[0].y} (${Math.round(v[0].r * 100)} % of normal) and ${v[1].y} (${Math.round(v[1].r * 100)} %), Iowa's two great droughts. It is calibrated to the 1988 and 2012 state losses. It does not detect excess-water damage such as the 1993 flood. Years losing over 20 %: ${Math.round(pr.perdidaObs * 100)} % of the period.`,
        `Modelo de rendimento testado com 40 anos observados (NASA POWER diário): os piores anos que calcula são ${v[0].y} (${Math.round(v[0].r * 100)} % do normal) e ${v[1].y} (${Math.round(v[1].r * 100)} %), as duas grandes secas de Iowa. Está calibrado com as perdas estaduais de 1988 e 2012. Não detecta danos por excesso de água, como a enchente de 1993. Anos com perda acima de 20 %: ${Math.round(pr.perdidaObs * 100)} % do período.`);
      const linea = (r) => m(`${r.a}–${r.b} (a ${r.h} años): ${pc(r.mediana)} (entre ${pc(r.min)} y ${pc(r.max)}; ${r.negativos} de ${r.n} modelos dan pérdida), un año con más del 20 % de pérdida cada ${r.pPerdida > 0 ? Math.round(1 / r.pPerdida) : "∞"} años`,
        `${r.a}–${r.b} (${r.h} years out): ${pc(r.mediana)} (range ${pc(r.min)} to ${pc(r.max)}; ${r.negativos} of ${r.n} models show a loss), a year losing over 20 % every ${r.pPerdida > 0 ? Math.round(1 / r.pPerdida) : "∞"} years`,
        `${r.a}–${r.b} (a ${r.h} anos): ${pc(r.mediana)} (entre ${pc(r.min)} e ${pc(r.max)}; ${r.negativos} de ${r.n} modelos dão perda), um ano com mais de 20 % de perda a cada ${r.pPerdida > 0 ? Math.round(1 / r.pPerdida) : "∞"} anos`);
      F.proyeccion = m(`Rendimiento del maíz con el clima de ${pr.n} modelos CMIP6 de alta resolución (HighResMIP, escenario de emisiones altas), contra 1985–2014 de cada modelo: ${pr.res.map(linea).join("; ")}. Hoy hay un año con pérdida fuerte cada ${Math.round(1 / Math.max(pr.perdidaObs, 0.01))} años. En los modelos, los grados día de calor dañino en verano pasan de ${Math.round(pr.kModelos)} (1985–2014) a ${Math.round(pr.res[2].kdd)} (2041–2050); en lo observado eran ${Math.round(pr.kObs)}. ${pr.umbral ? `El maíz cruza el umbral de riesgo (más de 1 año de cada 5 con pérdida fuerte) en ${pr.umbral.a}–${pr.umbral.b}.` : "Hasta 2050 el maíz no cruza el umbral de riesgo (más de 1 año de cada 5 con pérdida fuerte)."} No hay datos más allá de 2050: el horizonte de 50 años necesita NEX-GDDP o CMIP6 completo.${this.proy.respaldo ? ` (Copia guardada del ${new Date(this.proy.t).toISOString().slice(0, 10)}: el servicio no respondió.)` : ""}`,
        `Corn yield under ${pr.n} high-resolution CMIP6 models (HighResMIP, high-emissions scenario), against each model's 1985–2014: ${pr.res.map(linea).join("; ")}. Today a severe-loss year comes every ${Math.round(1 / Math.max(pr.perdidaObs, 0.01))} years. In the models, harmful summer heat degree days rise from ${Math.round(pr.kModelos)} (1985–2014) to ${Math.round(pr.res[2].kdd)} (2041–2050); observed was ${Math.round(pr.kObs)}. ${pr.umbral ? `Corn crosses the risk threshold (more than 1 year in 5 with a severe loss) in ${pr.umbral.a}–${pr.umbral.b}.` : "Through 2050 corn does not cross the risk threshold (more than 1 year in 5 with a severe loss)."} No data beyond 2050: the 50-year horizon needs NEX-GDDP or full CMIP6.`,
        `Rendimento do milho com o clima de ${pr.n} modelos CMIP6 de alta resolução (HighResMIP, cenário de emissões altas), contra 1985–2014 de cada modelo: ${pr.res.map(linea).join("; ")}. Hoje há um ano com perda forte a cada ${Math.round(1 / Math.max(pr.perdidaObs, 0.01))} anos. Nos modelos, os graus-dia de calor prejudicial no verão passam de ${Math.round(pr.kModelos)} (1985–2014) para ${Math.round(pr.res[2].kdd)} (2041–2050); no observado eram ${Math.round(pr.kObs)}. ${pr.umbral ? `O milho cruza o limiar de risco (mais de 1 ano em 5 com perda forte) em ${pr.umbral.a}–${pr.umbral.b}.` : "Até 2050 o milho não cruza o limiar de risco (mais de 1 ano em 5 com perda forte)."} Não há dados além de 2050: o horizonte de 50 anos precisa de NEX-GDDP ou CMIP6 completo.`);
      return F;
    },
  });

  document.addEventListener("input", (e) => { if (e.target.id === "agro-notas") Agro.guardarNotas(e.target.value); });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-agro-reporte]")) Agro.reporte();
    else if (e.target.closest("[data-agro-gpx]")) Agro.gpx();
    else if (e.target.closest("[data-agro-presc]")) Agro.prescripcion();
  });
  setTimeout(() => Agro.cargarPower(), 2500);   // la proyección pesa mucho en la cuota de Open-Meteo: solo se pide al abrir "Qué hacer"   // para que la SI ya tenga los datos de NASA POWER
  window.V2Agro = Agro;
})();
