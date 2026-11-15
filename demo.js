// =============================================================================
// Field Shift — Modo demo para presentar. Un cursor recorre la app como una persona: se mueve, hace clic de verdad,
// escribe tecla por tecla y espera a que cada cosa termine. Micro botón arriba a la derecha: iniciar o pausar,
// reiniciar y repetir en bucle. Todo lo que muestra son las pantallas y datos reales de la app.
// =============================================================================
(function () {
  "use strict";
  const dormir = (ms) => new Promise(r => setTimeout(r, ms));

  const Demo = {
    corriendo: false, pausa: false, bucle: true, ronda: 0, cursor: null, letrero: null, x: +(sessionStorage.getItem("fs_demo_x") || innerWidth - 60), y: +(sessionStorage.getItem("fs_demo_y") || 40),

    // ---------------------------------------------------------------- piezas
    async esperar(ms) {
      const r = this.ronda, fin = Date.now() + ms;
      while (Date.now() < fin || this.pausa) {
        if (r !== this.ronda) throw new Error("reinicio");
        await dormir(80);
      }
    },

    async buscar(sel, ms = 3000) {
      const fin = Date.now() + ms;
      while (Date.now() < fin) {
        const el = typeof sel === "function" ? sel() : [...document.querySelectorAll(sel)].find(e => e.offsetParent && e.getBoundingClientRect().width);
        if (el) return el;
        await this.esperar(150);
      }
      return null;
    },

    decir(txt) {
      this.letrero.textContent = txt;
      this.letrero.hidden = !txt;
    },

    // Movimiento con curva y aceleración, a velocidad de mano: más lejos, más tiempo
    async mover(x, y) {
      const x0 = this.x, y0 = this.y, d = Math.hypot(x - x0, y - y0), t = Math.min(900, 250 + d * 0.7), ini = performance.now();
      const cx = (x0 + x) / 2 + (y - y0) * 0.18, cy = (y0 + y) / 2 - (x - x0) * 0.18; // control de la curva
      while (true) {
        if (this.pausa) { await this.esperar(0); continue; }
        const k = Math.min(1, (performance.now() - ini) / t), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        this.x = (1 - e) ** 2 * x0 + 2 * (1 - e) * e * cx + e * e * x;
        this.y = (1 - e) ** 2 * y0 + 2 * (1 - e) * e * cy + e * e * y;
        this.cursor.style.transform = `translate(${this.x}px, ${this.y}px)`;
        if (k >= 1) { try { sessionStorage.setItem("fs_demo_x", Math.round(this.x)); sessionStorage.setItem("fs_demo_y", Math.round(this.y)); } catch (_) {} break; }
        await dormir(16);
      }
    },

    // Contenedor que de verdad se desplaza (la página, un workspace o la hoja inferior)
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

    // Desplazamiento continuo con easing cúbico suave a la velocidad y visión real del navegador
    async desplazarSuave(c, targetY, duracionMs = 380) {
      if (!c) return;
      const inicio = c.scrollTop;
      const maxScroll = Math.max(0, c.scrollHeight - c.clientHeight);
      const fin = Math.max(0, Math.min(maxScroll, Math.round(targetY)));
      const dist = fin - inicio;
      if (Math.abs(dist) < 3) return;

      const dur = Math.max(180, Math.min(800, duracionMs));
      const t0 = performance.now();
      while (true) {
        if (this.pausa) { await this.esperar(0); continue; }
        const p = Math.min(1, (performance.now() - t0) / dur);
        // Easing cúbico (acelera y desacelera como inercia de rueda o trackpad físico)
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        c.scrollTop = inicio + dist * e;
        if (p >= 1) break;
        await dormir(16);
      }
      await this.esperar(60);
    },

    // Asegura que el elemento quede cómodamente dentro del campo visual sin quedar tapado por barras
    async rodar(el, arriba = false) {
      if (!el) return;
      const c = this.contenedor(el), pagina = c === document.scrollingElement || c === document.documentElement;
      const r = el.getBoundingClientRect();
      const v = pagina ? { top: 0, bottom: innerHeight, height: innerHeight } : c.getBoundingClientRect();
      const margenSup = pagina ? 86 : 28;
      const margenInf = pagina ? 50 : 28;

      if (!arriba && r.top >= v.top + margenSup && r.bottom <= v.bottom - margenInf) {
        return;
      }

      let targetScroll;
      if (pagina) {
        const curY = window.scrollY || document.documentElement.scrollTop;
        const elY = r.top + curY;
        if (arriba || r.height > (v.height - margenSup - margenInf)) {
          targetScroll = elY - margenSup;
        } else {
          targetScroll = elY - Math.max(margenSup, (v.height - r.height) / 2);
        }
      } else {
        const diff = r.top - v.top;
        if (arriba || r.height > (v.height - margenSup - margenInf)) {
          targetScroll = c.scrollTop + diff - margenSup;
        } else {
          targetScroll = c.scrollTop + diff - Math.max(margenSup, (v.height - r.height) / 2);
        }
      }

      const dist = Math.abs(targetScroll - c.scrollTop);
      const dur = Math.min(550, Math.max(220, dist * 0.55));
      await this.desplazarSuave(c, targetScroll, dur);
    },

    // Recorre un bloque o tarjeta de arriba abajo de forma natural y legible
    async recorrerBloque(el, ms = 2200) {
      if (!el || this.tarde()) return;
      const c = this.contenedor(el), pagina = c === document.scrollingElement || c === document.documentElement;
      const alto = pagina ? innerHeight : c.clientHeight;
      const r = el.getBoundingClientRect();
      const sobra = r.height - (alto - 140);
      if (sobra > 25) {
        const targetScroll = Math.min(c.scrollHeight - c.clientHeight, c.scrollTop + sobra);
        const dur = Math.max(500, Math.min(ms - 350, sobra * 1.2));
        await this.desplazarSuave(c, targetScroll, dur);
        await this.esperar(Math.max(250, ms - dur));
      } else {
        await this.esperar(ms);
      }
    },

    // Recorre un espacio entero a pantalla completa de forma suave a velocidad de lectura
    async recorrerEspacio(selWorkspace, texto, ms = 2400) {
      if (this.tarde()) return;
      const ws = typeof selWorkspace === "string" ? await this.buscar(selWorkspace, 3000) : selWorkspace;
      if (!ws) return;
      this.decir(texto);
      const c = this.contenedor(ws);
      const maxScroll = c.scrollHeight - c.clientHeight;
      if (maxScroll > 40) {
        const b = ws.getBoundingClientRect();
        await this.mover(Math.min(innerWidth - 220, Math.max(b.left + 90, innerWidth * 0.35)), Math.min(innerHeight - 120, innerHeight * 0.38));
        const dur = Math.max(700, Math.min(ms - 400, maxScroll * 0.85));
        await this.desplazarSuave(c, maxScroll * 0.85, dur);
        await this.esperar(Math.max(300, ms - dur));
      } else {
        await this.esperar(ms);
      }
    },

    async irA(el) {
      await this.rodar(el);
      const b = await this.quieto(el);
      await this.mover(b.left + b.width / 2, b.top + b.height / 2); // centro exacto, ya con el botón quieto
    },

    // Límite de la presentación: todo debe caber en menos de 3 minutos. Pasado el límite, los pasos que faltan se saltan.
    LIMITE: 175000,
    // Bitácora de cada paso: qué intentó, si lo logró y por qué no. Sobrevive a las recargas. FSDemo.informe() la muestra.
    anotar(texto, ok, motivo) {
      let l; try { l = JSON.parse(sessionStorage.getItem("fs_demo_log") || "[]"); } catch (_) { l = []; }
      const t0 = +(sessionStorage.getItem("fs_demo_t0") || Date.now());
      l.push({ s: Math.round((Date.now() - t0) / 1000), paso: texto, ok, motivo: motivo || null, seccion: window.V2?.space || null });
      try { sessionStorage.setItem("fs_demo_log", JSON.stringify(l)); } catch (_) {}
    },
    informe() { try { return JSON.parse(sessionStorage.getItem("fs_demo_log") || "[]"); } catch (_) { return []; } },

    tarde() { const t0 = +(sessionStorage.getItem("fs_demo_t0") || Date.now()); return Date.now() - t0 > this.LIMITE; },

    async clic(sel, texto, despues = 1600) {
      if (this.tarde()) { this.anotar(texto, false, "sin tiempo"); return false; }
      despues = Math.round(despues * 0.7);
      const el = await this.buscar(sel);
      if (!el) { this.anotar(texto, false, "no apareció: " + (typeof sel === "string" ? sel : "elemento")); return false; }
      this.decir(texto);
      await this.irA(el);
      const fin = await this.quieto(el, 600);
      if (Math.abs(fin.left + fin.width / 2 - this.x) > 3 || Math.abs(fin.top + fin.height / 2 - this.y) > 3) await this.mover(fin.left + fin.width / 2, fin.top + fin.height / 2);
      // Si lo que está bajo la punta no es el botón (tapado o fuera de vista), se centra en pantalla y se vuelve a apuntar
      const debajo = () => { const d = document.elementFromPoint(this.x, this.y); return d && (el === d || el.contains(d) || d.contains(el)); };
      if (!debajo()) {
        await this.rodar(el);
        const c = await this.quieto(el);
        await this.mover(c.left + c.width / 2, c.top + c.height / 2);
        if (!debajo()) this.anotar(texto, false, "tapado por: " + (document.elementFromPoint(this.x, this.y)?.className || "nada"));
      }
      await this.esperar(200);
      this.cursor.classList.add("pulsa"); setTimeout(() => this.cursor.classList.remove("pulsa"), 220);
      const onda = document.createElement("div"); onda.className = "demo-onda"; onda.style.left = this.x + "px"; onda.style.top = this.y + "px"; document.body.appendChild(onda); setTimeout(() => onda.remove(), 600);
      el.focus?.({ preventScroll: true });
      el.click();
      this.anotar(texto, true);
      await this.seguir(sel, el);
      await this.esperar(despues);
      return true;
    },

    // Después de un clic la pantalla puede acomodarse (un campo nuevo, un aviso) y el botón cambia de lugar:
    // el cursor lo sigue con un movimiento corto para quedar siempre sobre lo que tocó
    // Espera a que el elemento deje de moverse (animación de entrada, pantalla que se acomoda) y da su lugar final
    async quieto(el, maximo = 1500) {
      let prev = null;
      const fin = Date.now() + maximo;
      while (Date.now() < fin) {
        const r = el.getBoundingClientRect();
        if (prev && Math.abs(r.left - prev.left) < 1 && Math.abs(r.top - prev.top) < 1 && Math.abs(r.width - prev.width) < 1) return r;
        prev = r;
        await this.esperar(90);
      }
      return el.getBoundingClientRect();
    },

    async seguir(sel, el) {
      await this.esperar(120);
      const nuevo = typeof sel === "string" ? [...document.querySelectorAll(sel)].find(e => e.offsetParent) : (el.isConnected ? el : null);
      if (!nuevo) return;
      const b = await this.quieto(nuevo), x = b.left + b.width / 2, y = b.top + b.height / 2;
      if (Math.abs(x - this.x) > b.width / 2 || Math.abs(y - this.y) > b.height / 2) await this.mover(x, y);
    },

    async escribir(sel, texto, decir) {
      if (this.tarde() || !(await this.clic(sel, decir, 300))) return false;
      let escrito = "", el = await this.buscar(sel, 2000);
      for (const ch of texto) {
        escrito += ch;
        if (!el?.isConnected) el = await this.buscar(sel, 2000); // si la pantalla se redibujó, se escribe en el campo nuevo
        if (!el) return false;
        el.value = escrito;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        await dormir(45 + Math.random() * 55); // ritmo de una persona que escribe rápido
        while (this.pausa) await this.esperar(0);
      }
      el = await this.buscar(sel, 2000);
      if (el && el.value !== texto) { el.value = texto; el.dispatchEvent(new Event("input", { bubbles: true })); } // comprobación final
      el?.dispatchEvent(new Event("change", { bubbles: true }));
      const quedo = (await this.buscar(sel, 1000))?.value;
      this.anotar("escribir: " + texto.slice(0, 20), quedo === texto, quedo === texto ? null : `quedó «${quedo}»`);
      await this.esperar(600);
      return true;
    },

    async leer(sel, texto, ms = 2600) {
      if (this.tarde()) { this.anotar(texto, false, "sin tiempo"); return; }
      ms = Math.round(ms * 0.7);
      const el = await this.buscar(sel, 3000);
      if (!el) { this.anotar(texto, false, "no apareció: " + sel); return; }
      this.anotar(texto, true);
      await this.rodar(el, true);
      // el cursor apunta al título del bloque, no a su centro vacío
      const t = el.querySelector("h2, h3, .card-title, thead, b") || el, b = await this.quieto(t);
      this.decir(texto);
      await this.mover(Math.min(b.left + 24, b.right), b.top + Math.min(b.height / 2, 14));
      await this.recorrerBloque(el, ms);
    },

    // Un cuadro del terreno: el cursor va al centro del terreno y abre los datos de ese cuadro
    async tocarCuadro() {
      const r = await this.buscar(() => window.V2?.terrainResp?.celdas?.length && window.V2Map?.poly && window.V2.space === "mapa" ? window.V2Map.map.getContainer() : null, 30000);
      if (!r) return;
      const mp = window.V2Map.map, cs = window.V2.terrainResp.celdas, c0 = window.V2Map.poly.getBounds().getCenter();
      const idx = cs.reduce((a, c, i) => (Math.hypot(c.lat - c0.lat, c.lon - c0.lng) < Math.hypot(cs[a].lat - c0.lat, cs[a].lon - c0.lng) ? i : a), 0);
      const p = mp.latLngToContainerPoint([cs[idx].lat, cs[idx].lon]), b = mp.getContainer().getBoundingClientRect();
      this.decir("Click one square: its data opens right on the map");
      await this.mover(b.left + p.x, b.top + p.y);
      await this.esperar(300);
      this.cursor.classList.add("pulsa"); setTimeout(() => this.cursor.classList.remove("pulsa"), 220);
      window.V2.selectedCells.clear(); window.V2.selectedCells.add(idx); window.V2Map.drawGridCells();
      window.V2Vivo?.popupCelda(idx);
      this.anotar("tocar un cuadro", !!document.querySelector(".pv-popup"));
      await this.esperar(3200);
    },

    // ---------------------------------------------------------------- primera vez: buscar el lugar, marcar el área, nombrarla y guardarla
    async primerTerreno() {
      if (!(await this.buscar("#v2-ub-search-q", 4000))) await this.clic('[data-action="abrir-ubicacion"]', "Add your first field", 1200);
      if (!(await this.buscar("#v2-ub-search-q", 4000))) return;
      this.decir("First time here: let's add a field");
      await this.esperar(1200);
      await this.escribir("#v2-ub-search-q", "Ames, Iowa", "Search for the town where the field is");
      await this.clic("#v2-btn-ub-buscar", "Find it", 600);
      if (await this.buscar("[data-geo-pick]", 5000)) await this.clic("[data-geo-pick]", "Pick the right place", 1200);
      await this.clic("#v2-ub-btn-draw", "Draw the field: click each corner on the map", 900);
      await this.dibujar([[42.1049, -93.6055], [42.1049, -93.6045], [42.1041, -93.6045], [42.1041, -93.6055]]);
      // tras cerrar la figura la app mide el terreno y vuelve al formulario
      await this.buscar("#v2-ub-nombre", 30000);
      await this.esperar(600);
      const sel = await this.buscar("#v2-ub-cultivo-act");
      if (sel) {
        await this.clic("#v2-ub-cultivo-act", "Choose the crop", 400);
        const s2 = document.getElementById("v2-ub-cultivo-act");
        if (s2) { s2.value = s2.options[1]?.value || ""; s2.dispatchEvent(new Event("input", { bubbles: true })); s2.dispatchEvent(new Event("change", { bubbles: true })); }
        await this.esperar(800);
      }
      await this.escribir("#v2-ub-nombre", "North field", "Give it a name");
      await this.clic("#v2-btn-ub-continuar", "Save: the field and its data load on their own", 1500);
      if (await this.buscar('.modal-card [data-close-modal]', 3000)) await this.clic('.modal-card [data-close-modal]', "Skip the robot pairing for now", 800);
      await this.buscar(() => window.V2?.terrainResp?.celdas?.length && !window.V2.modal ? document.body : null, 20000);
      
      // Pasar DIRECTAMENTE al mapa interactivo del terreno creado (NUNCA mostrar el robot antes del mapa)
      if (window.V2.modal) window.V2.closeModal();
      window.V2.setSpace("mapa");
      window.V2.setSheetSnap?.("min");
      document.getElementById("v2-toast-progress")?.setAttribute("hidden", "true");
      document.querySelectorAll(".vivo-aviso").forEach(e => e.remove());
      if (window.V2Map?.poly) window.V2Map.map?.fitBounds(window.V2Map.poly.getBounds().pad(0.35), { animate: false });
      
      this.anotar("terreno guardado y medido", !!window.V2?.loc?.id && !!window.V2?.terrainResp?.celdas?.length, `id ${window.V2?.loc?.id ?? "—"}, cuadros ${window.V2?.terrainResp?.celdas?.length ?? 0}`);
      await this.esperar(800);
    },

    // Marca las esquinas del terreno en el mapa como lo haría una persona, punto por punto, y cierra la figura en el primero
    async dibujar(esquinas) {
      const M = window.V2Map, mp = M?.map;
      if (!mp) return;
      mp.setView([(esquinas[0][0] + esquinas[2][0]) / 2, (esquinas[0][1] + esquinas[2][1]) / 2], 18, { animate: false });
      if (!M.drawer) M.startDraw();
      await this.esperar(700);
      const punto = (ll) => { const p = mp.latLngToContainerPoint(ll), r = mp.getContainer().getBoundingClientRect(); return [r.left + p.x, r.top + p.y]; };
      for (const ll of esquinas) {
        const [x, y] = punto(ll);
        await this.mover(x, y);
        await this.esperar(150);
        this.pulsar();
        M.drawer?.addVertex(L.latLng(ll[0], ll[1]));
        await this.esperar(500);
      }
      const [x, y] = punto(esquinas[0]);
      this.decir("Click the first corner again to close the shape");
      await this.mover(x, y);
      await this.esperar(200);
      this.pulsar();
      M.drawer?.completeShape();
      await this.esperar(800);
      this.anotar("dibujar el terreno", !!M.poly, M.poly ? null : "no se cerró la figura");
    },

    pulsar() {
      this.cursor.classList.add("pulsa"); setTimeout(() => this.cursor.classList.remove("pulsa"), 220);
      const onda = document.createElement("div"); onda.className = "demo-onda"; onda.style.left = this.x + "px"; onda.style.top = this.y + "px"; document.body.appendChild(onda); setTimeout(() => onda.remove(), 600);
    },

    // ---------------------------------------------------------------- el recorrido
    async recorrido() {
      const V = window.V2;

      // 1. EL MAPA Y CONDICIONES EN VIVO (antes de ver el robot)
      if (V.space !== "mapa") V.setSpace("mapa");
      window.V2.setSheetSnap?.("min");
      document.getElementById("v2-toast-progress")?.setAttribute("hidden", "true");
      document.querySelectorAll(".vivo-aviso").forEach(e => e.remove());
      if (window.V2Map?.poly) window.V2Map.map?.fitBounds(window.V2Map.poly.getBounds().pad(0.35), { animate: false });
      this.decir("Interactive satellite map: North field at 10 m Sentinel-2 resolution");
      await this.esperar(1200);

      // Ver tablero del clima y satélite arriba del mapa
      await this.leer("#campo-tablero", "Live conditions: air temp, wind arrows, humidity, rain and Sentinel-2 NDVI", 2200);

      // 2. EXPLORAR LOS FILTROS DEL MAPA
      // Filtro de Riesgo (sev)
      await this.clic('[data-color-mode="sev"]', "Explore filters: Risk highlights squares with severe stress or water need", 1800);
      // Filtro de 3 Zonas (zones)
      await this.clic('[data-color-mode="zones"]', "3 Zones: automatically groups the field into management zones", 1800);
      // Volver a Verdor (ndvi)
      await this.clic('[data-color-mode="ndvi"]', "Greenness: Sentinel-2 10 m resolution plant cover", 1600);

      // Explorar capas satelitales NASA (temperatura / cultivo)
      const capaChip = document.querySelector("[data-campo-capa]");
      if (capaChip) {
        await this.clic("[data-campo-capa]", "Turn on a NASA satellite layer with one click", 2000);
        await this.clic("[data-campo-capa].on", "Seamless satellite overlay turned off", 1000);
      }

      // 3. EXPLORAR LA INFORMACIÓN DEL TERRENO (a la gente siempre le da curiosidad ver lo que tiene)
      // Tocar un cuadro para ver sus datos exactos en el mapa
      await this.tocarCuadro();

      // Preguntar a la SI sobre este cuadro
      if (await this.buscar("[data-vivo-si]", 1500)) {
        await this.clic("[data-vivo-si]", "Ask the SI about this specific square", 1400);
        await this.escribir("#v2-si-inp", "Was there frost this week?", "Type any agronomic question in plain words");
        await this.clic('#v2-si-form [type="submit"]', "The SI answers citing exact dates and NASA data sources", 3200);
        await this.clic("#v2-si-cerrar", "Back to the field", 900);
        window.V2Map?.map?.closePopup?.();
      }

      // Explorar la ficha del terreno en la hoja inferior: Pestaña 1 (Resumen)
      await this.clic('[data-sheet-tab="summary"]', "Field summary: 4 indicators of water, vegetative index, frost & soil", 1400);
      await this.recorrerBloque(document.getElementById("v2-sheet-body") || document.querySelector(".sheet-body"), 2200);

      // Pestaña 2 (Mi terreno)
      await this.clic('[data-sheet-tab="terrain"]', "My Field: measured parcel area, 10-meter Sentinel-2 grid and soil series", 1400);
      await this.recorrerBloque(document.getElementById("v2-sheet-body") || document.querySelector(".sheet-body"), 2200);

      // Probar nivel de detalle (Simple / Técnico)
      await this.clic('[data-quick-mode="agronomist"]', "Technical detail: shows agronomic formulas, NDVI and z-score", 1400);
      await this.clic('[data-quick-mode="farmer"]', "Simple mode: plain everyday words for practical farm work", 1200);

      // Minimizar la hoja para dejar el mapa y terreno 100% despejados antes de los robots
      window.V2.openSheetTab?.("summary", "min");
      window.V2Map?.map?.closePopup?.();
      await this.esperar(400);

      // 4. ROBOTS SIMULADOS MOVIÉNDOSE EN EL TERRENO -> CLIC AL ROBOT -> INFO DEL ROBOT
      // "ya después ves algunos puntos moviéndose en su terreno (robots simulados) y le da clic y ahí es donde ve la info del robot"
      await this.clic("[data-vivo-sim]", "Simulate a fleet of autonomous rovers scanning your field", 1200);

      // Dejar que los robots se muevan por el terreno y el cursor los sigue
      this.decir("Robots move across the parcel sampling Sentinel-2 values in real time");
      const rCenter = window.V2Map?.poly?.getBounds?.().getCenter?.();
      if (rCenter && window.V2Map?.map) {
        const mp = window.V2Map.map, p = mp.latLngToContainerPoint(rCenter), b = mp.getContainer().getBoundingClientRect();
        await this.mover(b.left + p.x, b.top + p.y);
      }
      await this.esperar(2600); // tiempo para ver los puntos moviéndose

      // El cursor busca un robot moviéndose en el mapa (.bot-sim) o el pin del robot y le da clic
      const botEl = await this.buscar(".bot-sim, .robot-pin, [data-vivo-robot]", 2000);
      if (botEl) {
        await this.clic(botEl, "Click on a robot on the field to see its live telemetry", 1400);
      } else {
        await this.clic('[data-vivo-robot], [data-go-space="inicio"]', "Click on the robot to inspect its live sensors", 1400);
      }

      // Asegurar que abrimos la pantalla con los datos y telemetría del robot
      if (V.space !== "inicio") V.setSpace("inicio");
      await this.esperar(600);

      // Video de pruebas de hardware real del prototipo en bucle
      await this.leer(".rover-hardware-card", "Real hardware in action: looping test videos of the IoT prototype rover", 2800);
      const vidBtn2 = await this.buscar('[data-vid-src*="rover_prueba_2"]', 1200);
      if (vidBtn2) {
        await this.clic(vidBtn2, "Switch camera: physical field test vs laboratory bench", 1600);
      }

      // Lecturas en vivo del robot (tarjetas con pulso y datos de la hoja)
      await this.leer(() => document.querySelector("#v2-ws-inicio .robot-var-grid")?.closest(".card"), "Google Sheets hardware telemetry: rotation, temperature and speed", 2200);

      // Scroll suave por la pantalla de inicio: comparativa hardware vs NASA y tabla de datos crudos
      await this.recorrerEspacio("#v2-ws-inicio", "Bench hardware sensor vs Sentinel-2 / NASA satellite ground truth, and raw data", 2800);

      // Breve visita a la sección de configuración y emparejamiento del robot
      await this.clic('[data-go-space="robot"]', "Robot connection: Google Sheets live sync, tokens and sampling missions", 2000);
      await this.leer("#v2-ws-robot .card", "Sync status: last reading, next sync interval and battery", 1800);

      // Detener simulación de los 35 robots para limpiar el mapa
      window.V2Vivo?.parar?.();

      // 5. EXPLORAR TODAS LAS DEMÁS OPCIONES DE LA APLICACIÓN
      // Clima y Suelo
      await this.clic('[data-go-space="region"]', "Climate & soil: 40 years of NASA satellite history (1985–2024)", 1600);
      await this.recorrerEspacio("#v2-ws-region", "Historical percentiles, water balance and frost risk curves", 2600);

      // Recomendaciones
      await this.clic('[data-go-space="recom"]', "What to do: actionable advice for today, this season and crop rotation", 1600);
      await this.recorrerEspacio("#v2-ws-recom", "Tailored agronomic recommendations based on real satellite indicators", 2400);

      // Economía y Planificación
      await this.clic('[data-go-space="decidir"]', "Economics: live USDA MARS market prices and profit margins", 1600);
      const yaHabia = { ...(V.farmExtra || {}) };
      await this.escribir('[data-calc="costMaize"]', "420", "Enter your own cost per hectare");
      await this.escribir('[data-calc="yieldMaize"]', "10", "And your expected yield: margin is computed from USDA prices");
      await this.recorrerEspacio("#v2-ws-decidir", "Dynamic crop profitability table with your real numbers", 2600);
      Object.assign(V.farmExtra, { costMaize: yaHabia.costMaize ?? null, yieldMaize: yaHabia.yieldMaize ?? null });
      try { localStorage.setItem("v2_farm_extra", JSON.stringify(V.farmExtra)); } catch (_) {}

      // Datos y SI
      await this.clic('[data-go-space="datos"]', "Data & SI: machine learning models and NASA satellite catalog", 1600);
      await this.clic('[data-data-tab="ia"]', "SI crop classifier model with measured 77.7% accuracy", 2200);

      // Conceptos
      await this.clic('[data-go-space="conceptos"]', "Concepts: 17 agronomic topics explained simply with search", 1600);
      await this.recorrerEspacio("#v2-ws-conceptos", "Searchable agronomic knowledge base without technical jargon", 2400);

      // Alertas en vivo
      await this.clic("#v2-btn-bell", "Active alerts: rule-based warnings from real weather and satellite data", 2200);
      V.closeModal();

      // Regresar al mapa al terminar
      await this.clic('[data-go-space="mapa"], [data-go-space="inicio"]', "Field Shift: satellite intelligence and robotics for every farmer", 1600);
      if (V.space !== "mapa") V.setSpace("mapa");
      this.decir("");
    },

    // Robot simulado solo durante el demo: parte de la última lectura real de cada variable y se mueve poco a poco.
    // No se guarda nada en la base y al terminar vuelven los datos reales. Un anuncio fijo dice que solo esto es simulado.
    robotSim: null,
    simularRobot() {
      const R = window.V2Robot;
      if (!R || this.robotSim) return;
      const real = { ultimas: R.ultimasLecturas, lecturas: R.lecturas, ruta: R.rutaPuntos, cargar: R.cargarDatos };
      const base = (R.ultimasLecturas || []).map(v => ({ ...v }));
      if (!base.length) return; // sin variables reales no hay de dónde partir
      R.cargarDatos = async () => {}; // el sondeo no pisa los valores mientras dura el demo
      R.ultimasLecturas = base.map(v => ({ ...v })); R.lecturas = [...(real.lecturas || [])]; R.rutaPuntos = [...(real.ruta || [])];
      const anuncio = document.createElement("div"); anuncio.id = "demo-anuncio";
      anuncio.innerHTML = `<b>Simulated robot data</b> · Only the robot readings move during this demo. Satellite, weather and map data are real.`;
      anuncio.hidden = !(window.V2.space === "robot" || window.V2.space === "inicio");
      document.body.appendChild(anuncio);
      const paso = () => {
        const ahora = new Date().toISOString();
        R.ultimasLecturas.forEach((v, i) => {
          const b = base[i].valor, amp = Math.max(0.5, Math.abs(b) * 0.04);
          v.valor = Math.round((v.valor + (Math.random() - .5) * amp * 0.6 + (b - v.valor) * 0.08) * 10) / 10; // camina alrededor del valor real
          v.t = ahora;
          R.lecturas.unshift({ t: ahora, variable: v.variable, valor: v.valor, lat: v.lat, lon: v.lon, robot: v.robot });
        });
        R.lecturas.length = Math.min(R.lecturas.length, 5000);
        const u = R.rutaPuntos[R.rutaPuntos.length - 1];
        if (u) R.rutaPuntos.push({ ...u, lat: u.lat + (Math.random() - .5) * 0.00004, lon: u.lon + (Math.random() - .5) * 0.00004, t: ahora, punto: R.rutaPuntos.length + 1 });
        anuncio.hidden = !(window.V2.space === "robot" || window.V2.space === "inicio"); // el aviso grande solo en la sección Robot
        // se cambia solo el número en pantalla, sin redibujar: los botones que va a tocar el cursor no se mueven
        document.querySelectorAll(".robot-var-card").forEach(card => {
          const nom = card.querySelector(".robot-var-name")?.textContent.trim(), v = R.ultimasLecturas.find(x => (x.nombre || x.variable) === nom);
          const n = card.querySelector(".robot-var-val")?.firstChild;
          if (v && n) { n.nodeValue = ` ${v.valor} `; card.classList.remove("demo-late"); void card.offsetWidth; card.classList.add("demo-late"); }
          if (!card.querySelector(".demo-etiqueta")) card.querySelector(".robot-var-head")?.insertAdjacentHTML("beforeend", '<span class="demo-etiqueta">Simulated</span>');
        });
        // tabla de la sección Robot: misma idea, solo el número
        document.querySelectorAll("#v2-ws-robot tbody tr").forEach(tr => {
          const nom = tr.querySelector("td b")?.textContent.trim(), v = R.ultimasLecturas.find(x => (x.nombre || x.variable) === nom), td = tr.children[1];
          if (v && td?.firstChild) { td.firstChild.nodeValue = `${v.valor} `; tr.classList.remove("demo-late"); void tr.offsetWidth; tr.classList.add("demo-late"); }
        });
        if (window.V2.space === "mapa") window.V2Vivo?.pintarRobot();
      };
      this.robotSim = { real, anuncio, t: setInterval(paso, 1500) };
    },

    pararRobot() {
      const s = this.robotSim, R = window.V2Robot;
      if (!s) return;
      clearInterval(s.t); s.anuncio.remove();
      document.querySelectorAll(".demo-etiqueta").forEach(e => e.remove());
      R.ultimasLecturas = s.real.ultimas; R.lecturas = s.real.lecturas; R.rutaPuntos = s.real.ruta; R.cargarDatos = s.real.cargar;
      this.robotSim = null;
      R.cargarDatos().then(() => { window.V2.renderActiveViews(); window.V2Vivo?.pintarRobot(); });
    },

    // Entrar y salir recargan la página: la fase se guarda en esta pestaña y el demo sigue solo después de recargar
    fase(v) { try { if (v === undefined) return sessionStorage.getItem("fs_demo"); if (v) sessionStorage.setItem("fs_demo", v); else sessionStorage.removeItem("fs_demo"); } catch (_) {} return null; },

    async salir() {
      try { sessionStorage.setItem("fs_demo_t0", Date.now()); sessionStorage.removeItem("fs_demo_log"); } catch (_) {} // vuelta nueva, bitácora nueva // cada vuelta cuenta sus 3 minutos desde aquí
      this.fase("entrar");
      window.V2?.closeModal?.(); // una ventana abierta tapa el botón de la cuenta
      await this.clic('[data-action="abrir-cuenta"]', "Start from the sign-in screen", 900);
      window.V2?.closeModal?.();
      await window.V2Cuenta.cerrarSesion(); // recarga la página
    },

    mascara() {
      const k = document.getElementById("v2-inp-pass"), f = document.getElementById("v2-cuenta-form");
      if (k) { k.type = "text"; k.autocomplete = "off"; k.classList.add("demo-mascara"); }
      if (f) f.setAttribute("autocomplete", "off");
    },

    async entrar() {
      const cred = await (await fetch("/api/v1/cuenta/demo?reiniciar=1", { credentials: "same-origin" })).json(); // cuenta sin terrenos, como alguien nuevo
      try { localStorage.removeItem("v2_last_terrain"); localStorage.removeItem("v2_farm_extra"); } catch (_) {}
      if (cred.estado !== "OK") { this.decir(cred.detalle || "Demo account not available"); this.fase(null); return; }
      await this.buscar("#v2-cuenta-form", 10000);
      await this.esperar(500);
      await this.clic('.auth-lang [data-set-lang="en"]', "Field Shift opens in English, Spanish or Portuguese", 1800); // deja que la ventana termine de redibujarse
      await this.clic('[data-cuenta-tab="entrar"]', "Sign in", 800);
      await this.escribir("#v2-inp-correo", cred.correo, "Type the email");
      this.mascara(); // la contraseña se escribe tapada pero sin campo de contraseña: el navegador no ofrece guardarla
      await this.escribir("#v2-inp-pass", cred.contrasena, "And the password (demo account)");
      await this.esperar(400);
      const c = document.getElementById("v2-inp-correo"), k = document.getElementById("v2-inp-pass");
      if (!c || c.value !== cred.correo || !k || k.value !== cred.contrasena) { await this.escribir("#v2-inp-correo", cred.correo, "Type the email"); this.mascara(); await this.escribir("#v2-inp-pass", cred.contrasena, "And the password (demo account)"); }
      this.mascara();
      this.fase("recorrido");
      await this.clic(".auth-submit", "Sign in: your field and its data load on their own", 4000); // recarga la página
    },

    async correr() {
      if (this.corriendo) return;
      this.corriendo = true; this.cursor.hidden = false; this.pintar();
      document.body.classList.add("demo-activo");
      try {
        const sesion = !!window.V2Adapter?.obtenerSesion();
        const f = this.fase();
        if (!f) try { sessionStorage.setItem("fs_demo_t0", Date.now()); sessionStorage.removeItem("fs_demo_log"); } catch (_) {}
        if (f === "entrar" || (!f && !sesion)) await this.entrar();
        else if (!f && sesion) await this.salir();
        else if (f === "recorrido") {
          await this.esperar(1200); // la app abre sola la pantalla para agregar el primer terreno
          await this.primerTerreno();
          this.simularRobot();
          await this.recorrido();
          this.pararRobot();
          await this.esperar(1500);
          if (this.bucle) { try { sessionStorage.removeItem("fs_demo_t0"); } catch (_) {} await this.salir(); } else this.fase(null);
        }
      } catch (e) { if (e.message !== "reinicio") console.warn("demo:", e); }
      this.pararRobot(); // pase lo que pase, al terminar vuelven los datos reales del robot
      document.body.classList.remove("demo-activo");
      this.corriendo = false; this.pausa = false; this.cursor.hidden = true; this.decir(""); this.pintar();
    },

    reiniciar() {
      this.ronda++; this.pausa = false; this.fase(null);
      window.V2Vivo?.parar?.();
      if (window.V2SI?.abierto) document.getElementById("v2-si-cerrar")?.click();
      setTimeout(() => { this.corriendo = false; this.correr(); }, 200);
    },

    pintar() {
      this.caja.innerHTML = `
        <button type="button" data-demo="mini" class="demo-mini" aria-label="Demo controls" aria-expanded="${this.abierta}">${this.corriendo && !this.pausa ? "●" : "▶"}</button>
        ${this.abierta ? `<div class="demo-ctl">
          <button type="button" data-demo="play">${this.corriendo && !this.pausa ? "❚❚ Pause" : this.corriendo ? "▶ Resume" : "▶ Start demo"}</button>
          <button type="button" data-demo="reset">↺ Restart</button>
          <button type="button" data-demo="stop">■ Stop</button>
          <label><input type="checkbox" data-demo="loop" ${this.bucle ? "checked" : ""}> Loop</label>
        </div>` : ""}`;
    },

    init() {
      this.caja = document.createElement("div"); this.caja.id = "demo-caja";
      this.cursor = document.createElement("div"); this.cursor.id = "demo-cursor"; this.cursor.hidden = true;
      this.cursor.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 2l7.5 19 2.6-7.4L20.5 11z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
      this.letrero = document.createElement("div"); this.letrero.id = "demo-letrero"; this.letrero.hidden = true; this.letrero.setAttribute("aria-live", "polite");
      document.body.append(this.caja, this.cursor, this.letrero);
      this.abierta = false; this.pintar();
      this.caja.addEventListener("click", (e) => {
        const a = e.target.closest("[data-demo]")?.dataset.demo;
        if (a === "mini") { this.abierta = !this.abierta; this.pintar(); }
        else if (a === "play") { if (!this.corriendo) this.correr(); else { this.pausa = !this.pausa; this.pintar(); } }
        else if (a === "stop") { this.ronda++; this.fase(null); }
        else if (a === "reset") this.reiniciar();
      });
      this.caja.addEventListener("change", (e) => { if (e.target.dataset.demo === "loop") { this.bucle = e.target.checked; try { sessionStorage.setItem("fs_demo_bucle", this.bucle ? "1" : "0"); } catch (_) {} } });
      try { if (sessionStorage.getItem("fs_demo_bucle") === "0") this.bucle = false; } catch (_) {}
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && this.corriendo) { this.ronda++; this.fase(null); } });
      if (this.fase()) { // en medio del demo: el cursor se ve de inmediato, sin desaparecer
        this.cursor.hidden = false;
        this.cursor.style.transform = `translate(${this.x}px, ${this.y}px)`;
        setTimeout(() => this.correr(), 700);
      } // sigue tras la recarga, con los controles ocultos
    },
  };

  window.FSDemo = Demo;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => Demo.init()); else Demo.init();
})();
