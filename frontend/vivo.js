// =============================================================================
// Field Shift — La página reacciona sola. Un clic desencadena lo que la persona necesita ver, uno tras otro:
// datos del cuadro en el mismo mapa, ruta y posición real del robot, ruta de muestreo, robots simulados y avisos en cadena.
// Todo lo simulado se llama simulado; los valores que leen los robots simulados son los reales de Sentinel-2.
// =============================================================================
(function () {
  "use strict";
  const esc = (s) => window.esc(s);
  const m = (es, en, pt) => (window.V2?.lang === "en" ? en : window.V2?.lang === "pt" ? pt : es);
  const MAPA = () => window.V2Map?.map;

  const V2Vivo = {
    capaRobot: null, capaMuestreo: null, sim: null, cola: [], mostrando: 0,

    // ---------------------------------------------------------------- un clic en un cuadro: sus datos ahí mismo
    popupCelda(idx, latlng) {
      const r = window.V2.terrainResp, c = r?.celdas?.[idx], mp = MAPA();
      if (!c || !mp) return;
      const st = window.V2Map.computeStats(r.celdas), est = window.V2Map.cellStyleAndBadge(c, idx, st);
      const z = c.ndvi != null && st.sd ? (c.ndvi - st.mean) / st.sd : null;
      const ai = window.V2.aiResp?.celdas?.[idx];
      const [[s, w], [n, e]] = c.limites;
      const rb = {};
      (window.V2Robot?.lecturas || []).forEach(l => { if (l.lat != null && l.lat >= s && l.lat <= n && l.lon >= w && l.lon <= e && typeof l.valor === "number") (rb[l.variable] = rb[l.variable] || []).push(l.valor); });
      const fila = (a, b) => `<div class="pv-fila"><span>${esc(a)}</span><b>${b}</b></div>`;
      const html = `
        <div class="pv">
          <div class="pv-cab"><span class="pv-color" style="background:${est.color}"></span><b>${esc(m("Cuadro", "Square", "Quadro"))} #${idx + 1}</b><span class="pv-palabra">${esc(est.word)}</span></div>
          ${fila(m("Verdor (NDVI)", "Greenness (NDVI)", "Verdor (NDVI)"), c.ndvi != null ? c.ndvi.toFixed(2) : "—")}
          ${fila(m("Frente al promedio", "Vs. field average", "Vs. média do terreno"), z != null ? `${z >= 0 ? "+" : ""}${z.toFixed(1)}σ` : "—")}
          ${fila(m("Tamaño", "Size", "Tamanho"), `${c.lado_m} × ${c.lado_m} m`)}
          ${ai ? fila(m("Cultivo según la SI", "Crop per the SI", "Cultura segundo a SI"), `${esc(ai.clase)} · ${Math.round(ai.confianza * 100)}%`) : ""}
          ${Object.entries(rb).map(([k, v]) => fila(`Robot · ${k}`, `${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)} (${v.length})`)).join("")}
          <div class="pv-pie">Sentinel-2 · ${esc(r.fecha || "—")} · ${esc(m("medición", "measurement", "medição"))}</div>
          <div class="pv-acc">
            <button type="button" class="btn btn-pri btn-sm" data-vivo-si="${idx}">${esc(m("Preguntar a la SI", "Ask the SI", "Perguntar à SI"))}</button>
            <button type="button" class="btn btn-sec btn-sm" data-vivo-ficha="${idx}">${esc(m("Ficha completa", "Full card", "Ficha completa"))}</button>
          </div>
        </div>`;
      L.popup({ className: "pv-popup", maxWidth: 300, autoPanPadding: [40, 40] }).setLatLng(latlng || [(s + n) / 2, (w + e) / 2]).setContent(html).openOn(mp);
    },

    // ---------------------------------------------------------------- robot real: ruta y última posición
    pintarRobot() {
      const mp = MAPA(), pts = window.V2Robot?.rutaPuntos || [];
      if (!mp) return;
      if (this.capaRobot) mp.removeLayer(this.capaRobot);
      if (!pts.length) { this.capaRobot = null; return; }
      const ll = pts.map(p => [p.lat, p.lon]), ult = pts[pts.length - 1];
      this.capaRobot = L.layerGroup([
        L.polyline(ll, { color: "#ffffff", weight: 6, opacity: .9 }),
        L.polyline(ll, { color: "var(--primario)", weight: 3, dashArray: "6 6", className: "ruta-anim" }),
        L.marker([ult.lat, ult.lon], { icon: L.divIcon({ className: "", html: `<div class="robot-pin" title="Robot"><span>R</span></div>`, iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: 1000 })
          .bindTooltip(`<b>${esc(m("Robot · posición real", "Robot · real position", "Robô · posição real"))}</b><br>${new Date(ult.t).toLocaleString()}<br>${ult.lat.toFixed(5)}, ${ult.lon.toFixed(5)}`, { direction: "top" }),
      ]).addTo(mp);
    },

    irAlRobot() {
      const pts = window.V2Robot?.rutaPuntos || [];
      if (!pts.length) return window.V2.showToast(m("El robot todavía no ha mandado su posición.", "The robot has not sent its position yet.", "O robô ainda não enviou sua posição."), 4000);
      window.V2.setSpace("mapa"); this.pintarRobot();
      setTimeout(() => MAPA()?.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lon])).pad(0.3), { maxZoom: 19 }), 250);
    },

    // ---------------------------------------------------------------- ruta de muestreo sobre el mapa
    rutaMuestreo(n = 5) {
      const r = window.V2.terrainResp, mp = MAPA();
      if (!r?.celdas?.length || !mp) return [];
      const bajos = r.celdas.map((c, i) => ({ c, i })).filter(x => x.c.ndvi != null).sort((a, b) => a.c.ndvi - b.c.ndvi).slice(0, n);
      // orden de visita: el vecino más cercano; solo incluye el robot si está dentro o muy cerca de la parcela
      const ini = window.V2Robot?.rutaPuntos?.slice(-1)[0];
      const enTerreno = ini && window.V2Map?.poly?.getBounds?.().pad(0.5).contains([ini.lat, ini.lon]);
      let cur = enTerreno ? [ini.lat, ini.lon] : [bajos[0]?.c.lat, bajos[0]?.c.lon];
      const orden = [], resto = [...bajos];
      while (resto.length) {
        resto.sort((a, b) => Math.hypot(a.c.lat - cur[0], a.c.lon - cur[1]) - Math.hypot(b.c.lat - cur[0], b.c.lon - cur[1]));
        const x = resto.shift(); orden.push(x); cur = [x.c.lat, x.c.lon];
      }
      if (this.capaMuestreo) mp.removeLayer(this.capaMuestreo);
      const ll = (enTerreno ? [[ini.lat, ini.lon]] : []).concat(orden.map(x => [x.c.lat, x.c.lon]));
      this.capaMuestreo = L.layerGroup([
        L.polyline(ll, { color: "#ffffff", weight: 7, opacity: .9 }),
        L.polyline(ll, { color: "#C77700", weight: 4, dashArray: "10 8", className: "ruta-anim" }),
        ...orden.map((x, k) => L.marker([x.c.lat, x.c.lon], { icon: L.divIcon({ className: "", html: `<div class="parada">${k + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) })
          .bindTooltip(`${esc(m("Parada", "Stop", "Parada"))} ${k + 1} · ${esc(m("Cuadro", "Square", "Quadro"))} #${x.i + 1} · NDVI ${x.c.ndvi.toFixed(2)}`)),
      ]).addTo(mp);
      mp.fitBounds(L.latLngBounds(ll).pad(0.35), { maxZoom: 19 });
      return orden;
    },

    // ---------------------------------------------------------------- flota de robots simulados
    simular(n = 5) {
      const r = window.V2.terrainResp, mp = MAPA();
      if (!r?.celdas?.length || !mp) return window.V2.showToast(m("Primero mide tu terreno.", "Measure your field first.", "Meça seu terreno primeiro."), 4000);
      if (this.sim) return this.parar();
      window.V2.setSpace("mapa");
      document.querySelectorAll(".vivo-aviso, .guia-globo, .pista").forEach(e => e.remove());
      const cs = r.celdas, visit = new Set(), grupo = L.layerGroup().addTo(mp), lecturas = [];
      const pol = window.V2Map.poly?.getLatLngs()[0] || [];
      const numBots = Math.min(n, Math.max(3, Math.min(6, Math.floor((cs?.length || 20) / 4))));
      const bots = Array.from({ length: numBots }, (_, k) => {
        const c = cs[Math.floor((k / numBots) * cs.length)];
        const mk = L.marker([c.lat, c.lon], {
          icon: L.divIcon({ className: "", html: `<div class="bot-sim" data-bot-id="${k + 1}" title="${esc(m(`Robot #${k + 1} (simulado) · Clic para ver telemetría`, `Robot #${k + 1} (simulated) · Click to view telemetry`, `Robô #${k + 1} (simulado) · Clique para ver telemetria`))}">${k + 1}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] }),
          interactive: true
        }).addTo(grupo);
        mk.on("click", () => {
          window.V2.setSpace("inicio");
          window.V2.showToast(m(`Robot #${k + 1} · Telemetría en vivo`, `Robot #${k + 1} · Live telemetry`, `Robô #${k + 1} · Telemetria ao vivo`), 3000);
        });
        return { mk, pos: [c.lat, c.lon], meta: null };
      });
      // a dónde va cada robot: el cuadro libre con menor verdor ponderado por la distancia (prioriza lo que más hay que revisar)
      const elegir = (b) => {
        let mejor = -1, puntaje = Infinity;
        for (let i = 0; i < cs.length; i++) {
          if (visit.has(i) || cs[i].ndvi == null) continue;
          const d = Math.hypot(cs[i].lat - b.pos[0], (cs[i].lon - b.pos[1]) * Math.cos(cs[i].lat * Math.PI / 180));
          const p = d * 111000 / 10 + cs[i].ndvi * 20;
          if (p < puntaje) { puntaje = p; mejor = i; }
        }
        if (mejor >= 0) visit.add(mejor);
        return mejor;
      };
      bots.forEach(b => (b.meta = elegir(b)));
      const panel = document.createElement("div"); panel.id = "sim-panel"; document.body.appendChild(panel);
      const pintarPanel = () => {
        const v = lecturas.length ? lecturas.reduce((a, b) => a + b, 0) / lecturas.length : null;
        const bajos = lecturas.filter(x => x < 0.30).length;
        panel.innerHTML = `
          <div class="row-between"><b>${esc(m(`Flota de ${numBots} robots · simulación`, `Fleet of ${numBots} rovers · simulation`, `Frota de ${numBots} robôs · simulação`))}</b><button type="button" class="btn btn-sec btn-sm" data-vivo-parar>${esc(m("Detener", "Stop", "Parar"))}</button></div>
          <div class="sim-cifras">
            <div><span>${esc(m("Cuadros revisados", "Squares checked", "Quadros revisados"))}</span><b>${lecturas.length} / ${cs.length}</b></div>
            <div><span>${esc(m("Verdor promedio leído", "Average greenness read", "Verdor médio lido"))}</span><b>${v == null ? "—" : v.toFixed(3)}</b></div>
            <div><span>${esc(m("Cuadros con verdor bajo", "Low-greenness squares", "Quadros com verdor baixo"))}</span><b>${bajos}</b></div>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.round(100 * lecturas.length / cs.length)}%"></div></div>
          <div class="xs mut">${esc(m("Los robots son simulados. Cada uno lee el verdor real de Sentinel-2 del cuadro al que llega y va primero a los de menor verdor.", "The robots are simulated. Each reads the real Sentinel-2 greenness of the square it reaches and goes first to the lowest ones.", "Os robôs são simulados. Cada um lê o verdor real do Sentinel-2 do quadro onde chega e vai primeiro aos de menor verdor."))}</div>`;
      };
      pintarPanel();
      const paso = 0.000012 * Math.max(1, Math.sqrt(cs.length) / 8);
      const tic = () => {
        let vivos = 0;
        bots.forEach(b => {
          if (b.meta < 0) return; vivos++;
          const t = cs[b.meta], dy = t.lat - b.pos[0], dx = t.lon - b.pos[1], d = Math.hypot(dx, dy);
          if (d <= paso) {
            b.pos = [t.lat, t.lon]; lecturas.push(t.ndvi);
            L.rectangle(t.limites, { renderer: window.V2Map.cellRenderer, color: "#fff", weight: 2, fill: false, interactive: false }).addTo(grupo);
            b.meta = elegir(b);
          } else b.pos = [b.pos[0] + dy / d * paso, b.pos[1] + dx / d * paso];
          b.mk.setLatLng(b.pos);
        });
        if (lecturas.length % 7 === 0) pintarPanel();
        if (vivos) this.sim.raf = requestAnimationFrame(tic); else { pintarPanel(); }
      };
      this.sim = { grupo, panel, raf: requestAnimationFrame(tic) };
      void pol;
    },

    parar() {
      if (!this.sim) return;
      cancelAnimationFrame(this.sim.raf); MAPA()?.removeLayer(this.sim.grupo); this.sim.panel.remove(); this.sim = null;
    },

    // ---------------------------------------------------------------- avisos en cadena (uno tras otro)
    avisar(a) { this.cola.push(a); this.siguiente(); },

    siguiente() {
      if (this.mostrando || !this.cola.length) return;
      if (window.FSDemo?.corriendo) { this.cola = []; return; } // el demo ya va mostrando cada cosa; no se encima
      let caja = document.getElementById("vivo-avisos");
      if (!caja) { caja = document.createElement("div"); caja.id = "vivo-avisos"; caja.setAttribute("aria-live", "polite"); document.body.appendChild(caja); }
      const a = this.cola.shift(); this.mostrando = 1;
      const el = document.createElement("div"); el.className = "vivo-aviso";
      el.innerHTML = `<span class="vivo-flecha" aria-hidden="true">➜</span><div style="flex:1"><b>${esc(a.t)}</b><div class="small">${esc(a.d)}</div>
        ${a.btn ? `<button type="button" class="btn btn-pri btn-sm" style="margin-top:6px">${esc(a.btn)}</button>` : ""}</div><button type="button" class="vivo-x" aria-label="${esc(m("Cerrar", "Close", "Fechar"))}">✕</button>`;
      const cerrar = () => { clearTimeout(el._t); el.remove(); this.mostrando = 0; this.siguiente(); };
      el.querySelector(".btn")?.addEventListener("click", () => { a.ir && a.ir(); cerrar(); });
      el.querySelector(".vivo-x").addEventListener("click", () => { this.cola = []; cerrar(); }); // cerrar uno calla la cadena
      caja.prepend(el);
      while (caja.children.length > 1) caja.lastChild.remove(); // uno a la vez: nunca se apilan sobre el mapa
      const fuera = () => { el.classList.add("sale"); setTimeout(() => el.remove(), 250); this.mostrando = 0; this.siguiente(); };
      el._t = setTimeout(fuera, 6500); // 6.5 s para leer y pasa solo al siguiente
      el.addEventListener("mouseenter", () => clearTimeout(el._t));
      el.addEventListener("mouseleave", () => (el._t = setTimeout(fuera, 2500)));
    },

    // Lo que se dispara después de medir el terreno, en orden
    domino() {
      if (window.FSDemo?.corriendo || document.body.classList.contains("demo-activo")) return;
      const V = window.V2, r = V.terrainResp;
      if (!r?.celdas?.length) return;
      const bajos = r.celdas.filter(c => c.ndvi != null && c.ndvi < 0.30).length;
      const o = V.D?.telemetria_oficial_en_vivo || {};
      const precios = o.usda_ams_market_news?.precios || [];
      const maiz = precios.find(p => p.producto === "Corn"), soya = precios.find(p => p.producto === "Soybeans");
      const hoy = V.D?.decisiones_3_horizontes?.horizonte_1_hoy_7_dias?.recomendacion_natural;
      const pasos = [
        { ic: "grid", t: m("Terreno medido", "Field measured", "Terreno medido"), d: m(`${r.celdas.length} cuadros · verdor medio ${r.ndvi_promedio} · foto del ${r.fecha}.`, `${r.celdas.length} squares · mean greenness ${r.ndvi_promedio} · image of ${r.fecha}.`, `${r.celdas.length} quadros · verdor médio ${r.ndvi_promedio} · imagem de ${r.fecha}.`) },
        bajos ? { t: m("Cuadros para revisar", "Squares to check", "Quadros para revisar"), d: m(`${bajos} cuadros tienen verdor bajo (menos de 0.30). Te trazo la ruta para ir a verlos.`, `${bajos} squares have low greenness (under 0.30). Here is a route to go and check them.`, `${bajos} quadros têm verdor baixo (menos de 0.30). Traço a rota para ir vê-los.`), btn: m("Ver la ruta", "Show the route", "Ver a rota"), ir: () => this.rutaMuestreo() } : null,
        (window.V2Alertas?.alertasList || []).length ? { t: m("Alertas", "Alerts", "Alertas"), d: m(`${window.V2Alertas.alertasList.length} alertas activas en tu terreno.`, `${window.V2Alertas.alertasList.length} active alerts on your field.`, `${window.V2Alertas.alertasList.length} alertas ativos no seu terreno.`), btn: m("Verlas", "See them", "Ver"), ir: () => V.openModal("alertas") } : null,
        hoy ? { t: m("Qué hacer hoy", "What to do today", "O que fazer hoje"), d: hoy, btn: m("Ver recomendaciones", "See recommendations", "Ver recomendações"), ir: () => V.setSpace("recom") } : null,
        maiz || soya ? { t: m("Precios de hoy (USDA)", "Today's prices (USDA)", "Preços de hoje (USDA)"), d: [maiz && `${m("Maíz", "Corn", "Milho")} ${maiz.por_tonelada_usd} USD/t`, soya && `${m("Soya", "Soybeans", "Soja")} ${soya.por_tonelada_usd} USD/t`].filter(Boolean).join(" · "), btn: m("Calcular mi margen", "Work out my margin", "Calcular minha margem"), ir: () => V.setSpace("decidir") } : null,
        (window.V2Robot?.rutaPuntos || []).length ? { t: m("Tu robot", "Your robot", "Seu robô"), d: m("Su ruta y su última posición ya están en el mapa.", "Its route and latest position are on the map.", "Sua rota e última posição já estão no mapa."), btn: m("Ir al robot", "Go to the robot", "Ir ao robô"), ir: () => this.irAlRobot() } : null,
        { t: m("Pregúntale a la SI", "Ask the SI", "Pergunte à SI"), d: m("Ya leyó los datos de tu terreno. Pregúntale qué está pasando.", "It has read your field's data. Ask it what is going on.", "Já leu os dados do seu terreno. Pergunte o que está acontecendo."), btn: m("Abrir la SI", "Open the SI", "Abrir a SI"), ir: () => document.getElementById("v2-si-btn")?.click() },
      ].filter(Boolean);
      pasos.forEach(p => this.avisar(p));
    },

    // ---------------------------------------------------------------- pistas con flecha, en cada carga
    pistas() {
      if (window.FSDemo?.corriendo || document.body.classList.contains("demo-activo")) return;
      const vistas = []; // salen en cada carga de la página, una tras otra
      const lista = [
        // Las pistas van siempre en inglés, para quien llega desde EE. UU.; el resto de la app sigue el idioma elegido
        [".lang-pill", "idioma", "Switch language here: English, Spanish or Portuguese"],
        ["#v2-si-btn", "si", "The SI answers with your field's data"],
        ["#v2-btn-bell", "avisos", "Your alerts arrive here"],
        ["#vivo-fab", "mapa", "Robot, route and simulated robots"],
      ].filter(x => !vistas.includes(x[1]));
      const una = (k) => {
        const x = lista[k]; if (!x) return;
        const el = document.querySelector(x[0]);
        if (!el || !el.offsetParent) return una(k + 1);
        const b = el.getBoundingClientRect(), p = document.createElement("div");
        p.className = "pista"; p.innerHTML = `<span class="pista-flecha" aria-hidden="true">⬆</span>${esc(x[2])}`;
        document.body.appendChild(p);
        const w = p.offsetWidth;
        p.style.left = Math.max(8, Math.min(innerWidth - w - 8, b.left + b.width / 2 - w / 2)) + "px";
        if (b.top > innerHeight / 2) { p.classList.add("arriba"); p.style.top = (b.top - p.offsetHeight - 12) + "px"; } else p.style.top = (b.bottom + 12) + "px";
        vistas.push(x[1]);
        p.addEventListener("click", () => p.remove());
        setTimeout(() => { p.remove(); una(k + 1); }, 3000);
      };
      setTimeout(() => una(0), 1500);
    },

    // ---------------------------------------------------------------- guía: un solo lugar a la vez, avanza con el clic de la persona
    // ---------------------------------------------------------------- guía deshabilitada para vista limpia
    guia() {
      document.querySelectorAll(".guia-aro, .guia-globo").forEach(e => e.remove());
    },

    // ---------------------------------------------------------------- botón flotante del mapa
    fab() {
      if (document.getElementById("vivo-fab")) return;
      const d = document.createElement("div"); d.id = "vivo-fab";
      document.getElementById("v2-stage")?.appendChild(d);
      this.pintarFab();
    },

    pintarFab() {
      const d = document.getElementById("vivo-fab"); if (!d) return;
      d.hidden = window.V2.space !== "mapa";
      d.innerHTML = `
        <button type="button" class="btn btn-sec btn-sm" data-vivo-robot>${esc(m("Ir al robot", "Go to robot", "Ir ao robô"))}</button>
        <button type="button" class="btn btn-sec btn-sm" data-vivo-ruta>${esc(m("Ruta de muestreo", "Sampling route", "Rota de amostragem"))}</button>
        <button type="button" class="btn btn-pri btn-sm" data-vivo-sim>${esc(this.sim ? m("Detener flota de robots", "Stop robot fleet", "Parar frota de robôs") : m("Simular flota de robots", "Simulate robot fleet", "Simular frota de robôs"))}</button>
        <button type="button" class="btn btn-sec btn-sm sim-info" aria-label="${esc(m("Qué es la simulación", "What the simulation is", "O que é a simulação"))}" data-src-info="${esc(m(
          "Simulación: los robots en movimiento muestran cómo recorrería el terreno una flota autónoma. Lo que leen sí es real: el verdor de Sentinel-2 de cada cuadro al que llegan. Todo lo demás del mapa (viento, temperatura, capas, robot real) son datos reales.",
          "Simulation: the moving rovers show how an autonomous fleet would cover the field. What they read is real: Sentinel-2 greenness of each square reached. Everything else on the map (wind, temperature, layers, ground truth robot) is real data.",
          "Simulação: os robôs em movimento mostram como uma frota percorreria o terreno. O que leem é real: o verdor do Sentinel-2 de cada quadro onde chegam. Todo o resto do mapa (vento, temperatura, camadas, robô real) são dados reais."))}">ⓘ ${esc(m("Simulación", "Simulation", "Simulação"))}</button>`;
    },

    init() {
      const V = window.V2, M = window.V2Map;
      if (!V || !M) return setTimeout(() => this.init(), 300);
      // tras medir el terreno: dominó de avisos
      const medir = M.analyzeTerrain.bind(M);
      M.analyzeTerrain = async (...a) => { const r = await medir(...a); if (V.terrainResp?.estado === "OK") setTimeout(() => this.domino(), 600); return r; };
      // la lista de cuadros críticos también se dibuja en el mapa
      const ruta = V.generateRobotRoute.bind(V);
      V.generateRobotRoute = () => { ruta(); this.rutaMuestreo(); };
      const pintar = V.renderActiveViews.bind(V);
      V.renderActiveViews = (...a) => { const r = pintar(...a); this.pintarFab(); return r; };
      document.addEventListener("click", (e) => {
        const t = e.target;
        if (t.closest("[data-vivo-sim]")) { this.simular(35); this.pintarFab(); }
        else if (t.closest("[data-vivo-parar]")) { this.parar(); this.pintarFab(); }
        else if (t.closest("[data-vivo-ruta]")) { if (!this.rutaMuestreo().length) V.showToast(m("Primero mide tu terreno.", "Measure your field first.", "Meça seu terreno primeiro."), 4000); }
        else if (t.closest("[data-vivo-robot]")) this.irAlRobot();
        else if (t.closest("[data-vivo-ficha]")) { MAPA()?.closePopup(); V.openSheetTab("cell", "mid"); }
        else if (t.closest("[data-vivo-si]")) { MAPA()?.closePopup(); document.getElementById("v2-si-btn")?.click(); setTimeout(() => { const i = document.getElementById("v2-si-inp"); if (i) { i.value = m(`¿Qué pasa en el cuadro #${+t.closest("[data-vivo-si]").dataset.vivoSi + 1}?`, `What is going on in square #${+t.closest("[data-vivo-si]").dataset.vivoSi + 1}?`, `O que acontece no quadro #${+t.closest("[data-vivo-si]").dataset.vivoSi + 1}?`); i.focus(); } }, 300); }
      });
      this.fab();
      setInterval(() => { if (V.space === "mapa") this.pintarRobot(); }, 10000);
      setTimeout(() => this.pintarRobot(), 2500);
      this.guia(); // la guía de pasos reemplaza a las pistas sueltas
    },
  };

  window.V2Vivo = V2Vivo;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => V2Vivo.init()); else setTimeout(() => V2Vivo.init(), 0);
})();
