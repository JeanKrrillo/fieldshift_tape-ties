// =============================================================================
// Terra Lab — Modo demo interactivo para presentaciones (NASA Space Apps 2026).
// Un cursor recorre la aplicación de forma realista: inicia sesión, cambia de idioma,
// coloca la ubicación en el mapa, despliega el cuadrante satelital Sentinel-2 L2A,
// prueba los filtros y el zoom/paneo, activa las rutas de muestreo y simula 35 rovers,
// consulta a la SI (Inteligencia Satelital), inspecciona el prototipo físico IoT en vivo
// (reproduciendo las lecturas reales del Google Sheet / AppSheet), explora economía y conceptos.
// Velocidad 100% configurable: 30 segundos (pitch exprés), 90 segundos o 3 minutos.
// =============================================================================
(function () {
  "use strict";
  const dormir = (ms) => new Promise(r => setTimeout(r, ms));

  const Demo = {
    corriendo: false,
    pausa: false,
    bucle: true,
    ronda: 0,
    cursor: null,
    letrero: null,
    x: +(sessionStorage.getItem("fs_demo_x") || innerWidth - 60),
    y: +(sessionStorage.getItem("fs_demo_y") || 40),

    // Configurador de duración
    duraciones: {
      "30s": { factor: 5.2, limite: 36000, label: "Rápida" },
      "90s": { factor: 2.1, limite: 96000, label: "Normal" },
      "3m":  { factor: 1.0, limite: 185000, label: "Lenta" },
    },
    duracionActiva: sessionStorage.getItem("fs_demo_duracion") || "90s",

    factor() {
      return this.duraciones[this.duracionActiva]?.factor || 2.0;
    },

    setDuracion(d) {
      if (this.duraciones[d]) {
        this.duracionActiva = d;
        try { sessionStorage.setItem("fs_demo_duracion", d); } catch (_) {}
        this.pintar();
      }
    },

    // ---------------------------------------------------------------- piezas de control
    async esperar(ms) {
      const f = this.factor();
      const ajustado = Math.max(15, Math.round(ms / f));
      const r = this.ronda, fin = Date.now() + ajustado;
      while (Date.now() < fin || this.pausa) {
        if (r !== this.ronda) throw new Error("reinicio");
        await dormir(40);
      }
    },

    async buscar(sel, ms = 3000) {
      const f = this.factor();
      const ajustado = Math.max(600, Math.round(ms / f));
      const fin = Date.now() + ajustado;
      while (Date.now() < fin) {
        const el = typeof sel === "function" ? sel() : typeof sel !== "string" ? (sel.isConnected && sel.getClientRects().length ? sel : null) : [...document.querySelectorAll(sel)].find(e => e.getClientRects().length && e.getBoundingClientRect().width);
        if (el) return el;
        await this.esperar(100);
      }
      return null;
    },

    decir(txt) {
      if (!this.letrero) return;
      this.letrero.textContent = txt;
      this.letrero.hidden = !txt;
    },

    // Movimiento con curva y aceleración suave
    async mover(x, y) {
      if (Number.isNaN(x) || x == null) x = innerWidth / 2;
      if (Number.isNaN(y) || y == null) y = innerHeight / 2;
      const targetX = Math.max(16, Math.min(innerWidth - 24, x));
      const targetY = Math.max(16, Math.min(innerHeight - 24, y));
      const f = this.factor();
      const x0 = this.x, y0 = this.y, d = Math.hypot(targetX - x0, targetY - y0);
      const t = Math.max(70, Math.min(900, (240 + d * 0.7) / f)), ini = performance.now();
      const cx = (x0 + targetX) / 2 + (targetY - y0) * 0.18, cy = (y0 + targetY) / 2 - (targetX - x0) * 0.18;
      while (true) {
        if (this.pausa) { await this.esperar(0); continue; }
        const k = Math.min(1, (performance.now() - ini) / t);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        this.x = (1 - e) ** 2 * x0 + 2 * (1 - e) * e * cx + e * e * targetX;
        this.y = (1 - e) ** 2 * y0 + 2 * (1 - e) * e * cy + e * e * targetY;
        this.x = Math.max(16, Math.min(innerWidth - 24, this.x));
        this.y = Math.max(16, Math.min(innerHeight - 24, this.y));
        if (this.cursor) {
          this.cursor.hidden = false;
          this.cursor.style.transform = `translate(${this.x}px, ${this.y}px)`;
        }
        if (k >= 1) {
          try {
            sessionStorage.setItem("fs_demo_x", Math.round(this.x));
            sessionStorage.setItem("fs_demo_y", Math.round(this.y));
          } catch (_) {}
          break;
        }
        await dormir(16);
      }
    },

    contenedor(el) {
      if (!el) return document.scrollingElement || document.documentElement;
      const oPropio = getComputedStyle(el).overflowY;
      if ((oPropio === "auto" || oPropio === "scroll") && el.scrollHeight > el.clientHeight + 4) return el;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY;
        if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight + 4) return p;
      }
      return document.scrollingElement || document.documentElement;
    },

    async desplazarSuave(c, targetY, duracionMs = 380) {
      if (!c) return;
      const f = this.factor();
      const inicio = c.scrollTop;
      const maxScroll = Math.max(0, c.scrollHeight - c.clientHeight);
      const fin = Math.max(0, Math.min(maxScroll, Math.round(targetY)));
      const dist = fin - inicio;
      if (Math.abs(dist) < 3) return;

      const dur = Math.max(70, Math.min(800, duracionMs / f));
      const t0 = performance.now();
      while (true) {
        if (this.pausa) { await this.esperar(0); continue; }
        const p = Math.min(1, (performance.now() - t0) / dur);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        c.scrollTop = inicio + dist * e;
        if (p >= 1) break;
        await dormir(16);
      }
      await this.esperar(40);
    },

    async rodar(el, arriba = false) {
      if (!el) return;
      try {
        el.scrollIntoView({ behavior: "smooth", block: arriba ? "start" : "center", inline: "nearest" });
      } catch (_) {}
      const c = this.contenedor(el), pagina = c === document.scrollingElement || c === document.documentElement;
      const r = el.getBoundingClientRect();
      const v = pagina ? { top: 0, bottom: innerHeight, height: innerHeight } : c.getBoundingClientRect();
      const margenSup = pagina ? 86 : 36;
      const margenInf = pagina ? 50 : 36;

      if (!arriba && r.top >= v.top + margenSup && r.bottom <= v.bottom - margenInf) return;

      let targetScroll;
      if (pagina) {
        const curY = window.scrollY || document.documentElement.scrollTop;
        const elY = r.top + curY;
        targetScroll = (arriba || r.height > (v.height - margenSup - margenInf)) ? (elY - margenSup) : (elY - Math.max(margenSup, (v.height - r.height) / 2));
      } else {
        const diff = r.top - v.top;
        targetScroll = (arriba || r.height > (v.height - margenSup - margenInf)) ? (c.scrollTop + diff - margenSup) : (c.scrollTop + diff - Math.max(margenSup, (v.height - r.height) / 2));
      }
      const dist = Math.abs(targetScroll - c.scrollTop);
      await this.desplazarSuave(c, targetScroll, Math.min(500, Math.max(120, dist * 0.4)));
    },

    async recorrerBloque(el, ms = 2200) {
      if (!el) return;
      const c = this.contenedor(el), pagina = c === document.scrollingElement || c === document.documentElement;
      const alto = pagina ? innerHeight : c.clientHeight;
      const r = el.getBoundingClientRect();
      const sobra = r.height - (alto - 140);
      if (sobra > 25) {
        const targetScroll = Math.min(c.scrollHeight - c.clientHeight, c.scrollTop + sobra);
        await this.desplazarSuave(c, targetScroll, ms * 0.7);
        await this.esperar(Math.max(200, ms * 0.3));
      } else {
        await this.esperar(ms);
      }
    },

    async recorrerEspacio(selWorkspace, texto, ms = 2400) {
      const ws = typeof selWorkspace === "string" ? await this.buscar(selWorkspace, 3000) : selWorkspace;
      if (!ws) return;
      this.decir(texto);
      const c = this.contenedor(ws);
      const maxScroll = c.scrollHeight - c.clientHeight;
      if (maxScroll > 40) {
        const b = ws.getBoundingClientRect();
        await this.mover(Math.min(innerWidth - 220, Math.max(b.left + 90, innerWidth * 0.35)), Math.min(innerHeight - 120, innerHeight * 0.38));
        await this.desplazarSuave(c, maxScroll * 0.85, ms * 0.7);
        await this.esperar(Math.max(250, ms * 0.3));
      } else {
        await this.esperar(ms);
      }
    },

    async irA(el) {
      if (!el) return;
      await this.rodar(el);
      const b = await this.quieto(el);
      const targetX = Math.max(16, Math.min(innerWidth - 24, b.left + Math.max(4, b.width / 2)));
      const targetY = Math.max(16, Math.min(innerHeight - 24, b.top + Math.max(4, b.height / 2)));
      await this.mover(targetX, targetY);
    },

    tarde() {
      // Nunca saltar pasos de forma prematura para garantizar una demo fluida
      return false;
    },

    anotar(texto, ok, motivo) {
      let l; try { l = JSON.parse(sessionStorage.getItem("fs_demo_log") || "[]"); } catch (_) { l = []; }
      const t0 = +(sessionStorage.getItem("fs_demo_t0") || Date.now());
      l.push({ s: Math.round((Date.now() - t0) / 1000), paso: texto, ok, motivo: motivo || null, seccion: window.V2?.space || null });
      try { sessionStorage.setItem("fs_demo_log", JSON.stringify(l)); } catch (_) {}
    },

    async clic(sel, texto, despues = 1400) {
      if (this.tarde()) { this.anotar(texto, false, "sin tiempo"); return false; }
      const el = await this.buscar(sel);
      if (!el) { this.anotar(texto, false, "no apareció: " + (typeof sel === "string" ? sel : "elemento")); return false; }
      this.decir(texto);
      await this.irA(el);
      const fin = await this.quieto(el, 500);
      if (Math.abs(fin.left + fin.width / 2 - this.x) > 3 || Math.abs(fin.top + fin.height / 2 - this.y) > 3) {
        await this.mover(fin.left + fin.width / 2, fin.top + fin.height / 2);
      }
      await this.esperar(150);
      this.pulsar();
      el.focus?.({ preventScroll: true });
      el.click();
      this.anotar(texto, true);
      await this.seguir(sel, el);
      await this.esperar(despues);
      return true;
    },

    pulsar() {
      if (!this.cursor) return;
      this.cursor.classList.add("pulsa");
      setTimeout(() => this.cursor?.classList.remove("pulsa"), 200);
      const onda = document.createElement("div");
      onda.className = "demo-onda";
      onda.style.left = this.x + "px";
      onda.style.top = this.y + "px";
      document.body.appendChild(onda);
      setTimeout(() => onda.remove(), 550);
    },

    async quieto(el, maximo = 1200) {
      let prev = null;
      const fin = Date.now() + maximo;
      while (Date.now() < fin) {
        const r = el.getBoundingClientRect();
        if (prev && Math.abs(r.left - prev.left) < 1 && Math.abs(r.top - prev.top) < 1 && Math.abs(r.width - prev.width) < 1) return r;
        prev = r;
        await this.esperar(60);
      }
      return el.getBoundingClientRect();
    },

    async seguir(sel, el) {
      await this.esperar(90);
      const nuevo = typeof sel === "string" ? [...document.querySelectorAll(sel)].find(e => e.offsetParent) : (el?.isConnected ? el : null);
      if (!nuevo) return;
      const b = await this.quieto(nuevo), x = b.left + b.width / 2, y = b.top + b.height / 2;
      if (Math.abs(x - this.x) > b.width / 2 || Math.abs(y - this.y) > b.height / 2) await this.mover(x, y);
    },

    async escribir(sel, texto, decir) {
      if (this.tarde() || !(await this.clic(sel, decir, 250))) return false;
      const f = this.factor();
      let escrito = "", el = await this.buscar(sel, 2000);
      for (const ch of texto) {
        escrito += ch;
        if (!el?.isConnected) el = await this.buscar(sel, 2000);
        if (!el) return false;
        el.value = escrito;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        await dormir(Math.max(10, Math.round((40 + Math.random() * 45) / f)));
        while (this.pausa) await this.esperar(0);
      }
      el = await this.buscar(sel, 2000);
      if (el && el.value !== texto) { el.value = texto; el.dispatchEvent(new Event("input", { bubbles: true })); }
      el?.dispatchEvent(new Event("change", { bubbles: true }));
      this.anotar("escribir: " + texto.slice(0, 20), true);
      await this.esperar(350);
      return true;
    },

    async leer(sel, texto, ms = 2400) {
      if (this.tarde()) { this.anotar(texto, false, "sin tiempo"); return; }
      const el = await this.buscar(sel, 3000);
      if (!el) { this.anotar(texto, false, "no apareció: " + sel); return; }
      this.anotar(texto, true);
      await this.rodar(el, true);
      const t = el.querySelector("h2, h3, .card-title, thead, b") || el, b = await this.quieto(t);
      this.decir(texto);
      await this.mover(Math.min(b.left + 24, b.right), b.top + Math.min(b.height / 2, 14));
      await this.recorrerBloque(el, ms);
    },

    // ---------------------------------------------------------------- acciones del mapa
    async tocarCuadro() {
      const r = await this.buscar(() => window.V2?.terrainResp?.celdas?.length && window.V2Map?.poly && window.V2.space === "mapa" ? window.V2Map.map.getContainer() : null, 15000);
      if (!r) return;
      const mp = window.V2Map.map, cs = window.V2.terrainResp.celdas, c0 = window.V2Map.poly.getBounds().getCenter();
      const idx = cs.reduce((a, c, i) => (Math.hypot(c.lat - c0.lat, c.lon - c0.lng) < Math.hypot(cs[a].lat - c0.lat, cs[a].lon - c0.lng) ? i : a), 0);
      const p = mp.latLngToContainerPoint([cs[idx].lat, cs[idx].lon]), b = mp.getContainer().getBoundingClientRect();
      this.decir(this.t("Toco un cuadro: sus datos se abren ahí mismo en el mapa", "I tap a square: its data opens right on the map", "Toco um quadro: seus dados abrem ali mesmo no mapa"));
      await this.mover(b.left + p.x, b.top + p.y);
      await this.esperar(200);
      this.pulsar();
      window.V2.selectedCells.clear();
      window.V2.selectedCells.add(idx);
      window.V2Map.drawGridCells();
      window.V2Vivo?.popupCelda(idx);
      this.anotar("tocar un cuadro", !!document.querySelector(".pv-popup"));
      await this.esperar(2600);
      mp.closePopup?.();
      document.querySelectorAll(".pv-popup").forEach(e => e.closest(".leaflet-popup")?.remove());
    },

    async dibujar(esquinas) {
      const M = window.V2Map, mp = M?.map;
      if (!mp) return;
      mp.fitBounds(L.latLngBounds(esquinas).pad(0.15), { animate: false });
      if (!M.drawer) M.startDraw();
      await this.esperar(500);
      const punto = (ll) => { const p = mp.latLngToContainerPoint(ll), r = mp.getContainer().getBoundingClientRect(); return [r.left + p.x, r.top + p.y]; };
      for (const ll of esquinas) {
        const [x, y] = punto(ll);
        await this.mover(x, y);
        await this.esperar(100);
        this.pulsar();
        M.drawer?.addVertex(L.latLng(ll[0], ll[1]));
        await this.esperar(350);
      }
      const [x, y] = punto(esquinas[0]);
      this.decir(this.t("Toco otra vez la primera esquina para cerrar la figura", "I tap the first corner again to close the shape", "Toco de novo o primeiro canto para fechar a forma"));
      await this.mover(x, y);
      await this.esperar(150);
      this.pulsar();
      M.drawer?.completeShape();
      await this.esperar(600);
      this.anotar("dibujar el terreno", !!M.poly, M.poly ? null : "no se cerró la figura");
    },

    // ---------------------------------------------------------------- narración en el idioma de la página
    t(es, en, pt) {
      const l = window.V2?.lang;
      return l === "en" ? en : l === "pt" ? pt : es;
    },

    // ---------------------------------------------------------------- llegar por primera vez
    async bienvenida() {
      const V = window.V2;
      if (V.modal) V.closeModal();
      if (V.space !== "inicio") V.setSpace("inicio");
      await this.esperar(400);
      await this.leer("header, .topbar, #v2-topbar", this.t("Llego a Terra Lab por primera vez: una libreta de campo con datos de satélite", "First time on Terra Lab: a field notebook powered by satellite data", "Chego ao Terra Lab pela primeira vez: um caderno de campo com dados de satélite"), 1800);
      await this.clic('[data-set-lang="en"]', "It speaks English…", 1100);
      await this.clic('[data-set-lang="pt"]', "…fala português…", 1100);
      await this.clic('[data-set-lang="es"]', "…y español, sin recargar la página", 1100);
      await this.clic('[data-action="toggle-theme"]', this.t("También tiene modo oscuro para usarla de noche", "There is a dark mode for night use", "Também tem modo escuro para usar à noite"), 1200);
      await this.clic('[data-action="toggle-theme"]', this.t("Regreso al modo claro", "Back to light mode", "Volto ao modo claro"), 800);
    },

    // ---------------------------------------------------------------- dar de alta el terreno, paso a paso
    async primerTerreno() {
      const V = window.V2;
      await this.clic('[data-action="abrir-ubicacion"]', this.t("Lo primero: decirle dónde está mi terreno", "First step: tell it where my field is", "Primeiro passo: dizer onde fica meu terreno"), 1000);
      if (!(await this.buscar("#v2-ub-search-q", 4000))) return;
      await this.leer(".modal-card", this.t("Una sola pantalla: buscar el lugar, marcar el terreno, cultivo y nombre", "One screen: find the place, mark the field, crop and name", "Uma só tela: buscar o lugar, marcar o terreno, cultura e nome"), 1600);
      await this.escribir("#v2-ub-search-q", "Ames, Iowa", this.t("Escribo el pueblo donde está mi parcela", "I type the town where my field is", "Escrevo a cidade onde fica meu terreno"));
      await this.clic("#v2-btn-ub-buscar", this.t("Busco el lugar", "Search for it", "Busco o lugar"), 700);
      if (await this.buscar("[data-geo-pick]", 4000)) await this.clic("[data-geo-pick]", this.t("Elijo el resultado correcto: el mapa vuela hasta ahí", "I pick the right result: the map flies there", "Escolho o resultado certo: o mapa voa até lá"), 1400);
      if (!(await this.buscar("#v2-ub-btn-draw", 2500))) await this.clic('[data-action="abrir-ubicacion"]', this.t("Sigo llenando los datos del terreno", "I keep filling in the field details", "Continuo preenchendo os dados do terreno"), 800);
      await this.clic("#v2-ub-btn-draw", this.t("Ahora marco mi terreno en el mapa, esquina por esquina", "Now I mark my field on the map, corner by corner", "Agora marco meu terreno no mapa, canto por canto"), 800);
      await this.dibujar([[42.1081, -93.6098], [42.1081, -93.6002], [42.1009, -93.6002], [42.1009, -93.6098]]);
      if (window.V2Ubicacion?.volverTrasDibujo) window.V2Ubicacion.volverTrasDibujo();
      await this.buscar("#v2-ub-nombre", 4000);
      await this.esperar(400);
      if (await this.buscar("#v2-ub-cultivo-act", 1500)) {
        await this.clic("#v2-ub-cultivo-act", this.t("¿Qué tengo sembrado? Maíz", "What is planted? Corn", "O que está plantado? Milho"), 400);
        const s2 = document.getElementById("v2-ub-cultivo-act");
        if (s2) { const o = [...s2.options].find(x => /ma[ií]z|corn|milho/i.test(x.textContent)) || s2.options[1]; s2.value = o?.value || ""; s2.dispatchEvent(new Event("change", { bubbles: true })); }
        await this.esperar(700);
      }
      const nom = document.getElementById("v2-ub-nombre"); if (nom) nom.value = "";
      await this.escribir("#v2-ub-nombre", this.t("Mi terreno en Iowa", "My Iowa field", "Meu terreno em Iowa"), this.t("Le pongo nombre", "I give it a name", "Dou um nome"));
      await this.clic("#v2-btn-ub-continuar", this.t("Guardo: Terra Lab pide los datos al satélite y a la NASA", "Save: Terra Lab asks the satellite and NASA for data", "Salvo: o Terra Lab pede os dados ao satélite e à NASA"), 1200);
      if (await this.buscar('.modal-card [data-close-modal]', 2500)) await this.clic('.modal-card [data-close-modal]', this.t("El robot lo conecto después", "I'll connect the robot later", "Conecto o robô depois"), 600);
      this.decir(this.t("Cargando el verdor de cada cuadro y el clima de los últimos 40 años…", "Loading each square's greenness and 40 years of climate…", "Carregando o verdor de cada quadro e 40 anos de clima…"));
      await this.buscar(() => V.terrainResp?.celdas?.length && !V.modal ? document.body : null, 15000);
      if (V.modal) V.closeModal();
      V.setSpace("mapa");
      V.sheetSnap = "min"; V.renderActiveViews?.();
      document.getElementById("v2-toast-progress")?.setAttribute("hidden", "true");
      document.querySelectorAll(".vivo-aviso").forEach(e => e.remove());
      if (window.V2Map?.poly) window.V2Map.map?.fitBounds(window.V2Map.poly.getBounds().pad(0.2), { animate: false });
      await this.esperar(600);
    },

    // ---------------------------------------------------------------- EL RECORRIDO COMPLETO
    async recorrido() {
      const V = window.V2;
      const mp = () => window.V2Map?.map;

      // 1. EL MAPA
      if (V.space !== "mapa") V.setSpace("mapa");
      V.sheetSnap = "min"; V.renderActiveViews?.();
      if (window.V2Map?.poly) mp()?.fitBounds(window.V2Map.poly.getBounds().pad(0.2), { animate: false });
      const n = V.terrainResp?.celdas?.length, lado = V.terrainResp?.celdas?.[0]?.lado_m || 5;
      this.decir(this.t(`Listo: mi terreno quedó dividido en ${n || "miles de"} cuadros de ${lado} × ${lado} m`, `Done: my field is split into ${n || "thousands of"} ${lado} × ${lado} m squares`, `Pronto: meu terreno foi dividido em ${n || "milhares de"} quadros de ${lado} × ${lado} m`));
      await this.esperar(1800);
      this.decir(this.t("El color de cada cuadro sale de la foto de satélite: verde es planta sana", "Each square's color comes from the satellite image: green means healthy plants", "A cor de cada quadro vem da foto de satélite: verde é planta saudável"));
      await this.esperar(1800);
      await this.leer("#campo-tablero", this.t("Arriba, el clima de hoy en mi terreno: temperatura, viento, humedad, lluvia", "On top, today's weather on my field: temperature, wind, humidity, rain", "Em cima, o clima de hoje no meu terreno: temperatura, vento, umidade, chuva"), 2000);
      await this.tocarCuadro();

      // 2. FILTROS
      await this.clic('[data-color-mode="sev"]', this.t("¿Dónde hay riesgo? Falta de agua o helada, cuadro por cuadro", "Where is the risk? Water stress or frost, square by square", "Onde há risco? Falta de água ou geada, quadro a quadro"), 1600);
      await this.clic('[data-color-mode="zones"]', this.t("3 zonas de manejo: alta, media y baja, para tratarlas distinto", "3 management zones: high, medium and low, to treat them differently", "3 zonas de manejo: alta, média e baixa, para tratá-las diferente"), 1600);
      await this.clic('[data-color-mode="anom"]', this.t("Cuadros raros: los que se salen del promedio de mi lote", "Odd squares: the ones far from my field's average", "Quadros estranhos: os que fogem da média do talhão"), 1600);
      await this.clic('[data-color-mode="ndvi"]', this.t("Regreso al verdor", "Back to greenness", "Volto ao verdor"), 900);
      if (mp()) {
        this.decir(this.t("Me acerco para ver los cuadros uno por uno", "I zoom in to see the squares one by one", "Aproximo para ver os quadros um a um"));
        mp().zoomIn(1); await this.esperar(1100);
        mp().zoomOut(1); await this.esperar(800);
      }

      // 3. PANEL DE ABAJO
      V.sheetSnap = "mid"; V.renderActiveViews?.();
      await this.esperar(500);
      await this.clic('[data-quick-mode="farmer"]', this.t("Puedo leerlo en lenguaje simple…", "I can read it in plain language…", "Posso ler em linguagem simples…"), 1300);
      await this.clic('[data-quick-mode="agronomist"]', this.t("…técnico, con índices agronómicos…", "…technical, with agronomic indexes…", "…técnico, com índices agronômicos…"), 1300);
      await this.clic('[data-quick-mode="scientist"]', this.t("…o científico, con fuentes y fechas", "…or scientific, with sources and dates", "…ou científico, com fontes e datas"), 1300);
      await this.clic('[data-sheet-tab="terrain"]', this.t("Pestaña Mi terreno: tamaño, cultivo y datos guardados", "My field tab: size, crop and saved data", "Aba Meu terreno: tamanho, cultura e dados salvos"), 1600);
      await this.clic('[data-sheet-tab="layers"]', this.t("Pestaña Capas: todas las capas de la NASA que puedo prender", "Layers tab: every NASA layer I can turn on", "Aba Camadas: todas as camadas da NASA que posso ligar"), 1600);
      await this.clic('[data-sheet-tab="summary"]', this.t("Y el resumen de lo más importante", "And the summary of what matters most", "E o resumo do mais importante"), 1400);
      V.sheetSnap = "min"; V.renderActiveViews?.();
      await this.esperar(400);

      // 4. CAPAS NASA, RUTA Y FLOTA
      if (await this.buscar("[data-campo-capa]", 1500)) {
        await this.clic("[data-campo-capa]", this.t("Prendo una capa de satélite de la NASA encima de mi terreno", "I turn on a NASA satellite layer over my field", "Ligo uma camada de satélite da NASA sobre o terreno"), 1800);
        await this.clic("[data-campo-capa].on", this.t("Y la apago", "And turn it off", "E desligo"), 800);
      }
      await this.clic("[data-vivo-ruta]", this.t("¿Por dónde reviso? Ruta que pasa por los 5 cuadros más débiles, del más cercano al más lejano", "Where do I check? A route through the 5 weakest squares, nearest first", "Por onde verifico? Rota pelos 5 quadros mais fracos, do mais perto ao mais longe"), 2400);
      await this.clic("[data-vivo-sim]", this.t("Simulo una flota de robots recorriendo el terreno", "I simulate a robot fleet crossing the field", "Simulo uma frota de robôs percorrendo o terreno"), 1200);
      this.decir(this.t("Cada robot lee el verdor real del cuadro al que llega", "Each robot reads the real greenness of the square it reaches", "Cada robô lê o verdor real do quadro onde chega"));
      await this.esperar(2600);

      // 5. LA SI
      await this.clic(".si-fab, [data-action=\"abrir-si\"]", this.t("Tengo dudas: le pregunto a la SI, que ya leyó los datos de mi terreno", "I have questions: I ask the SI, which already read my field's data", "Tenho dúvidas: pergunto à SI, que já leu os dados do terreno"), 1200);
      const chips = async (i) => (await this.buscar(".si-chip-btn, [data-si-q]", 1500)) && document.querySelectorAll(".si-chip-btn, [data-si-q]")[i];
      for (const i of [0, 1, 2]) {
        const c = await chips(i);
        if (c) await this.clic(c, this.t("Pregunto: ", "I ask: ", "Pergunto: ") + c.textContent.replace(/\s+/g, " ").trim(), 2600);
      }
      await this.clic("#v2-si-cerrar", this.t("Cada respuesta cita su fuente y su fecha. Cierro la SI", "Every answer cites its source and date. I close the SI", "Cada resposta cita fonte e data. Fecho a SI"), 800);

      // 6. INICIO: ROBOT REAL
      window.V2Vivo?.parar?.();
      await this.clic('[data-go-space="inicio"]', this.t("En Inicio veo el robot real que construimos", "Home shows the real robot we built", "No Início vejo o robô real que construímos"), 1400);
      if (V.space !== "inicio") V.setSpace("inicio");
      await this.leer(".rover-hardware-card", this.t("Videos de las pruebas del robot: en banco y en campo", "Robot test videos: bench and field", "Vídeos dos testes do robô: bancada e campo"), 2000);
      const vid2 = await this.buscar('[data-vid-src*="rover_prueba_2"]', 1200);
      if (vid2) await this.clic(vid2, this.t("Cambio a la prueba en campo", "Switch to the field trial", "Mudo para o teste em campo"), 1500);
      await this.leer(".rover-stream-player", this.t("Sus lecturas llegan a una hoja de Google, y aquí las reproduzco", "Its readings go to a Google Sheet, and I replay them here", "Suas leituras vão para uma planilha Google, e aqui eu as reproduzo"), 2000);
      if (await this.buscar("#rover-btn-next", 1000)) {
        await this.clic("#rover-btn-next", this.t("Siguiente lectura: humedad, temperatura, velocidad…", "Next reading: moisture, temperature, speed…", "Próxima leitura: umidade, temperatura, velocidade…"), 1300);
        await this.clic("#rover-btn-next", this.t("Y otra", "And another", "E outra"), 1000);
      }
      await this.leer(".side-by-side-card", this.t("Lo que mide el robot en el suelo junto a lo que ve el satélite", "What the robot measures on the ground next to what the satellite sees", "O que o robô mede no solo ao lado do que o satélite vê"), 2200);
      await this.recorrerEspacio("#v2-ws-inicio", this.t("Promedios de 24 horas, 7 y 30 días", "24-hour, 7-day and 30-day averages", "Médias de 24 horas, 7 e 30 dias"), 2000);
      await this.clic('[data-go-space="robot"]', this.t("Pantalla Robot: conexión con la hoja y su ruta", "Robot screen: sheet connection and its route", "Tela Robô: conexão com a planilha e sua rota"), 1500);
      await this.leer("#v2-ws-robot .card", this.t("Última lectura, filas guardadas y cada cuánto sincroniza", "Last reading, stored rows and sync interval", "Última leitura, linhas salvas e intervalo de sincronização"), 1600);

      // 7. CLIMA Y SUELO
      await this.clic('[data-go-space="region"]', this.t("Clima y suelo: lo que viene esta semana y lo que dicen 40 años de datos", "Climate and soil: this week ahead and 40 years of data", "Clima e solo: o que vem nesta semana e 40 anos de dados"), 1500);
      await this.recorrerEspacio("#v2-ws-region", this.t("Pronóstico de 7 días, riesgo de helada, agua por mes y tipo de suelo", "7-day forecast, frost risk, monthly water and soil type", "Previsão de 7 dias, risco de geada, água por mês e tipo de solo"), 3000);

      // 8. QUÉ HACER
      await this.clic('[data-go-space="recom"]', this.t("Qué hacer: hoy, esta temporada y los próximos años", "What to do: today, this season and coming years", "O que fazer: hoje, nesta safra e nos próximos anos"), 1500);
      await this.leer("#agro-plan", this.t("Un plan calculado con mis datos: siembra, agua, suelo, nitrógeno, cosecha y números", "A plan worked out from my data: planting, water, soil, nitrogen, harvest and numbers", "Um plano calculado com meus dados: plantio, água, solo, nitrogênio, colheita e números"), 3000);
      await this.recorrerEspacio("#v2-ws-recom", this.t("Cada consejo dice de qué dato sale", "Each tip says which data it comes from", "Cada conselho diz de qual dado vem"), 2400);

      // 9. ECONOMÍA
      await this.clic('[data-go-space="decidir"]', this.t("Economía: ¿me conviene? Precios reales del USDA", "Economics: is it worth it? Real USDA prices", "Economia: compensa? Preços reais do USDA"), 1500);
      const yaHabia = { ...(V.farmExtra || {}) };
      await this.escribir('[data-calc="costMaize"]', "420", this.t("Pongo lo que me cuesta producir: 420 USD por hectárea", "I enter my cost: 420 USD per hectare", "Coloco meu custo: 420 USD por hectare"));
      await this.escribir('[data-calc="yieldMaize"]', "10.2", this.t("Y lo que espero cosechar: 10.2 toneladas", "And my expected yield: 10.2 tonnes", "E o que espero colher: 10,2 toneladas"));
      await this.recorrerEspacio("#v2-ws-decidir", this.t("Me calcula el margen y un calendario de 3 años", "It works out my margin and a 3-year calendar", "Calcula minha margem e um calendário de 3 anos"), 2200);
      Object.assign(V.farmExtra, { costMaize: yaHabia.costMaize ?? null, yieldMaize: yaHabia.yieldMaize ?? null });
      try { localStorage.setItem("v2_farm_extra", JSON.stringify(V.farmExtra)); } catch (_) {}

      // 10. DATOS Y SI
      await this.clic('[data-go-space="datos"]', this.t("Datos y SI: de dónde sale todo", "Data and SI: where everything comes from", "Dados e SI: de onde vem tudo"), 1400);
      await this.clic('[data-data-tab="ia"]', this.t("Cómo predice el cultivo y qué tan seguido acierta", "How it predicts the crop and how often it is right", "Como prevê a cultura e com que frequência acerta"), 1800);
      await this.clic('[data-data-tab="fuentes"]', this.t("Todas las fuentes: Sentinel-2, NASA POWER, SMAP, USDA…", "Every source: Sentinel-2, NASA POWER, SMAP, USDA…", "Todas as fontes: Sentinel-2, NASA POWER, SMAP, USDA…"), 1800);

      // 11. ALERTAS
      await this.clic("#v2-btn-bell", this.t("La campana junta las alertas de mi terreno", "The bell gathers my field's alerts", "O sino reúne os alertas do terreno"), 1800);
      if (V.modal) { V.closeModal(); await this.esperar(400); }

      // 12. CONCEPTOS
      await this.clic('[data-go-space="conceptos"]', this.t("¿No entiendo una palabra? Conceptos explicados simple", "Don't know a word? Concepts explained simply", "Não entendo uma palavra? Conceitos explicados de forma simples"), 1500);
      await this.escribir("#v2-con-search-q", "NDVI", this.t("Busco qué es el NDVI", "I look up what NDVI is", "Procuro o que é NDVI"));
      await this.leer(".concepto-card-exp, .card", this.t("Qué es, cómo se mide y qué hago con eso", "What it is, how it's measured and what to do", "O que é, como se mede e o que fazer"), 2200);

      // 13. CIERRE
      await this.clic('[data-go-space="inicio"]', this.t("Regreso a mi terreno", "Back to my field", "Volto ao meu terreno"), 900);
      await this.clic('[data-go-space="mapa"]', this.t("Terra Lab: satélite, NASA, robot y SI en un solo lugar", "Terra Lab: satellite, NASA, robot and SI in one place", "Terra Lab: satélite, NASA, robô e SI em um só lugar"), 1400);
      if (V.space !== "mapa") V.setSpace("mapa");
      V.sheetSnap = "mid"; V.renderActiveViews?.();
      this.decir(this.t("✓ Fin del recorrido. Ahora te toca explorar a ti", "✓ Tour complete. Now it's your turn to explore", "✓ Fim do passeio. Agora é sua vez de explorar"));
      await this.esperar(2500);
    },

    // ---------------------------------------------------------------- control de sesión
    fase(v) {
      try {
        if (v === undefined) return sessionStorage.getItem("fs_demo");
        if (v) sessionStorage.setItem("fs_demo", v);
        else sessionStorage.removeItem("fs_demo");
      } catch (_) {}
      return null;
    },

    async salir() {
      try {
        sessionStorage.setItem("fs_demo_t0", Date.now());
        sessionStorage.removeItem("fs_demo_log");
      } catch (_) {}
      this.fase("entrar");
      window.V2?.closeModal?.();
      await this.clic('[data-action="abrir-cuenta"]', "Start from the sign-in screen", 700);
      window.V2?.closeModal?.();
      await window.V2Cuenta.cerrarSesion();
    },

    mascara() {
      const k = document.getElementById("v2-inp-pass"), f = document.getElementById("v2-cuenta-form");
      if (k) { k.type = "text"; k.autocomplete = "off"; k.classList.add("demo-mascara"); }
      if (f) f.setAttribute("autocomplete", "off");
    },

    async entrar() {
      const cred = await (await fetch("/api/v1/cuenta/demo?reiniciar=1", { credentials: "same-origin" })).json();
      try { localStorage.removeItem("v2_last_terrain"); localStorage.removeItem("v2_farm_extra"); } catch (_) {}
      if (cred.estado !== "OK") { this.decir(cred.detalle || "Demo account not available"); this.fase(null); return; }
      await this.buscar("#v2-cuenta-form", 10000);
      await this.esperar(400);

      // Cambio de idioma (Inglés y Español)
      await this.clic('.auth-lang [data-set-lang="en"]', "Terra Lab opens in English, Spanish or Portuguese", 1400);
      await this.clic('.auth-lang [data-set-lang="es"]', "Interfaz completamente trilingüe sin recargar", 1000);

      // Iniciar sesión
      await this.clic('[data-cuenta-tab="entrar"]', "Sign in", 600);
      await this.escribir("#v2-inp-correo", cred.correo, "Type the email");
      this.mascara();
      await this.escribir("#v2-inp-pass", cred.contrasena, "And the password (demo account)");
      await this.esperar(300);
      this.mascara();
      this.fase("recorrido");
      await this.clic(".auth-submit", "Sign in: your field and its data load on their own", 3500);
    },

    async correr() {
      if (this.corriendo) return;
      this.corriendo = true;
      try { sessionStorage.setItem("fs_demo_t0", Date.now()); } catch (_) {}
      if (this.cursor) this.cursor.hidden = false;
      this.pintar();
      document.body.classList.add("demo-activo");
      try {
        const sesion = !!window.V2Adapter?.obtenerSesion();
        const f = this.fase();
        if (!f) try { sessionStorage.setItem("fs_demo_t0", Date.now()); sessionStorage.removeItem("fs_demo_log"); } catch (_) {}
        // Sin login: el demo va directo al recorrido, sin pantalla de cuenta.
        if (!f || f === "entrar" || f === "recorrido") {
          try { sessionStorage.setItem("fs_demo_t0", Date.now()); } catch (_) {}
          await this.esperar(1000);
          await this.bienvenida();
          await this.primerTerreno();
          await this.recorrido();
          await this.esperar(1200);
          if (this.bucle) {
            try { sessionStorage.removeItem("fs_demo_t0"); } catch (_) {}
            this.fase("recorrido"); location.reload();
          } else {
            this.fase(null);
          }
        }
      } catch (e) {
        if (e.message !== "reinicio") console.warn("demo:", e);
      }
      document.body.classList.remove("demo-activo");
      this.corriendo = false;
      this.pausa = false;
      if (this.cursor) {
        // Estacionar el cursor suavemente en el control superior sin desaparecer de golpe
        await this.mover(innerWidth - 120, 26);
        setTimeout(() => {
          if (!this.corriendo && this.cursor) this.cursor.hidden = true;
        }, 3000);
      }
      this.decir("");
      this.pintar();
    },

    reiniciar() {
      this.ronda++;
      this.pausa = false;
      this.fase(null);
      window.V2Vivo?.parar?.();
      if (window.V2SI?.abierto) document.getElementById("v2-si-cerrar")?.click();
      setTimeout(() => { this.corriendo = false; this.correr(); }, 150);
    },

    pintar() {
      if (!this.caja) return;
      const d = this.duracionActiva;
      this.caja.innerHTML = `
        <button type="button" data-demo="mini" class="demo-mini" aria-label="Demo controls" aria-expanded="${this.abierta}">${this.corriendo && !this.pausa ? "●" : "▶"}</button>
        ${this.abierta ? `<div class="demo-ctl">
          <div class="demo-speed-row">
            <button type="button" class="demo-dur-btn ${d === "30s" ? "active" : ""}" data-demo-dur="30s">⚡ 30s</button>
            <button type="button" class="demo-dur-btn ${d === "90s" ? "active" : ""}" data-demo-dur="90s">🎯 90s</button>
            <button type="button" class="demo-dur-btn ${d === "3m" ? "active" : ""}" data-demo-dur="3m">🎬 3m</button>
          </div>
          <button type="button" data-demo="play">${this.corriendo && !this.pausa ? "❚❚ Pause" : this.corriendo ? "▶ Resume" : "▶ Start demo"}</button>
          <button type="button" data-demo="reset">↺ Restart</button>
          <button type="button" data-demo="stop">■ Stop</button>
          <label style="display:flex;align-items:center;gap:3px;font-size:11px"><input type="checkbox" data-demo="loop" ${this.bucle ? "checked" : ""}> Loop</label>
        </div>` : ""}`;
    },

    init() {
      this.caja = document.createElement("div"); this.caja.id = "demo-caja";
      this.cursor = document.createElement("div"); this.cursor.id = "demo-cursor"; this.cursor.hidden = true;
      this.cursor.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 2l7.5 19 2.6-7.4L20.5 11z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
      this.letrero = document.createElement("div"); this.letrero.id = "demo-letrero"; this.letrero.hidden = true; this.letrero.setAttribute("aria-live", "polite");
      document.body.append(this.caja, this.cursor, this.letrero);
      this.abierta = false;
      this.pintar();

      this.caja.addEventListener("click", (e) => {
        const dur = e.target.closest("[data-demo-dur]")?.dataset.demoDur;
        if (dur) {
          this.setDuracion(dur);
          return;
        }
        const a = e.target.closest("[data-demo]")?.dataset.demo;
        if (a === "mini") { this.abierta = !this.abierta; this.pintar(); }
        else if (a === "play") { if (!this.corriendo) this.correr(); else { this.pausa = !this.pausa; this.pintar(); } }
        else if (a === "stop") { this.ronda++; this.fase(null); }
        else if (a === "reset") this.reiniciar();
      });

      this.caja.addEventListener("change", (e) => {
        if (e.target.dataset.demo === "loop") {
          this.bucle = e.target.checked;
          try { sessionStorage.setItem("fs_demo_bucle", this.bucle ? "1" : "0"); } catch (_) {}
        }
      });

      try { if (sessionStorage.getItem("fs_demo_bucle") === "0") this.bucle = false; } catch (_) {}
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.corriendo) { this.ronda++; this.fase(null); }
      });

      if (this.fase()) {
        this.cursor.hidden = false;
        this.cursor.style.transform = `translate(${this.x}px, ${this.y}px)`;
        setTimeout(() => this.correr(), 600);
      }
    },
  };

  window.FSDemo = Demo;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Demo.init());
  } else {
    Demo.init();
  }
})();
