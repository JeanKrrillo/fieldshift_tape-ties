// =============================================================================
// Field Shift v2 (Cápsula D) — Controlador Principal, Estado y Eventos
// =============================================================================

(function () {
  "use strict";

  function lsGet(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v != null ? v : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function lsSet(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (_) {}
  }

  function lsGetJson(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  const V2 = {
    lang: lsGet("v2_lang", "en"), // inglés de entrada; la persona lo cambia arriba y se recuerda
    themePref: lsGet("v2_theme", "light"), // light | dark | auto
    mode: lsGet("v2_mode", "farmer"),      // farmer | agronomist | scientist
    units: lsGet("v2_units", "metric"),    // metric | imperial
    space: "inicio",                       // inicio | robot | region | recom | conceptos | mapa | decidir | datos
    sheetTab: "summary",                   // summary | terrain | cell | layers
    sheetSnap: "mid",                      // min | mid | max
    dataSubTab: "clima",                   // clima | ia | fuentes
    modal: null,                           // cuenta | ubicacion | emparejar | alertas | welcome | settings | glossary | farm | null
    robotPollTimer: null,
    loc: null,
    outsideUsDismissed: false,
    D: null,
    terrainResp: null,
    aiResp: null,
    clim40: null,
    clim40Key: "",
    modelsMeta: null,
    recolData: null,
    catalog: null,
    cellsCount: 25,
    cellSide: null,                           // null = cuadrícula estándar 5x5 (25 cuadros); nunca 2500
    colorMode: "ndvi",
    selectedCells: new Set(),
    favLayers: lsGetJson("v2_fav_layers", []),
    savedTerrains: lsGetJson("v2_saved_terrains", []),
    layerFilter: "",
    layerFavOnly: false,
    layerOpacity: 0.80,
    layerDate: "",
    timeOffsetDays: 0,
    playTimer: null,
    curtainPct: 100,
    C: lsGetJson("v2_farm_c", { crop: "maize", water: "rain", machine: "conv", priority: "income" }),
    // Costos, rendimientos y área los escribe el usuario; no hay valores por omisión. Se guardan en este navegador.
    farmExtra: lsGetJson("v2_farm_extra", { ha: null, costMaize: null, costSoy: null, costWheat: null, yieldMaize: null, yieldSoy: null, yieldWheat: null, priceMaize: null, priceSoy: null, priceWheat: null, nKgHa: "", phVal: "" }),
    thresholds: { frostC: 0, bareNdvi: 0.30, droughtPct: 35, excessPct: 78 },
    scenRainPct: 0,
    scenTempC: 0,
    catFilter: { q: "", dedup: true, util: "all", vivo: "all", uso: "all", limit: 60 },
    progTimer: null,
    progStartMs: 0,
    tourStep: -1,

    inUS(lat, lon) {
      return lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66;
    },

    async init() {
      this.applyThemeAndMode();
      if (window.V2Adapter) {
        window.V2Adapter.updateDemoBanner();
      }
      window.V2Map.init();

      // Inicio de sesión obligatorio: sin sesión solo se ve la ventana de entrada.
      const ses = window.V2Adapter ? await window.V2Adapter.cuentaYo() : null;
      // Sin inicio de sesion obligatorio: la pagina se ve directo (la cuenta es opcional).
      if (ses && window.V2Alertas) await window.V2Alertas.init();
      if (window.V2Robot) await window.V2Robot.cargarDatos();
      this.iniciarRobotPolling();
      this.modal = null;

      await this.renderShellChrome();
      this.renderActiveViews();
      this.bindEvents();
      this.loadCatalogAndMeta();
      this.restoreLastSession();

      // Si hay terrenos guardados o en el adaptador y no hay ubicación activa, seleccionar el primero y desplegar el 5x5
      if (window.V2Adapter) {
        try {
          const terrenos = await window.V2Adapter.obtenerTerrenos();
          // El terreno activo es el último usado si sigue guardado; si no, el más reciente. Sus datos y su medición se cargan solos.
          const t1 = (this.loc && terrenos.find(t => Math.abs(t.lat - this.loc.lat) < 1e-4 && Math.abs(t.lon - this.loc.lon) < 1e-4)) || terrenos[0];
          if (t1) {
            this.loc = { id: t1.id, lat: t1.lat, lon: t1.lon, kind: "real", label: t1.nombre };
            window.V2Map.setLocationMarker(t1.lat, t1.lon, "real", t1.nombre);
            this.renderActiveViews();
            if (t1.poligono) {
              window.V2Map.setPolygonCoords(t1.poligono, t1.nombre);
              window.V2Map.analyzeTerrain(); // también trae los datos del lugar
            } else {
              this.loadParcelIntelligence(t1.lat, t1.lon, "real", t1.nombre);
            }
          } else if (terrenos && !terrenos.length && !this.loc && window.V2Ubicacion) {
            window.V2Ubicacion.abrirPantalla();
          }
        } catch (_) {}
      }

      // Actualizar recolección cada 5 segundos cuando se está en Pantalla 10 (Datos y fuentes)
      setInterval(() => {
        if (this.space === "datos" && this.dataSubTab === "fuentes") {
          this.fetchRecoleccion();
        }
      }, 5000);
    },

    iniciarRobotPolling() {
      if (this.robotPollTimer) clearInterval(this.robotPollTimer);
      const intervalMs = document.visibilityState === "visible" ? 10000 : 60000;
      this.robotPollTimer = setInterval(async () => {
        if (window.V2Robot) {
          await window.V2Robot.cargarDatos();
          const escribiendo = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
          if ((this.space === "robot" || this.space === "inicio") && !escribiendo && !this.modal && !window.FSDemo?.corriendo) {
            this.renderActiveViews();
          }
        }
        if (window.V2Alertas) {
          await window.V2Alertas.cargarAlertasYUmbrales();
        }
      }, intervalMs);
    },

    applyThemeAndMode() {
      document.documentElement.lang = this.lang;
      document.body.dataset.mode = this.mode;
      if (this.themePref === "auto") {
        document.documentElement.removeAttribute("data-theme");
        document.body.removeAttribute("data-theme");
      } else {
        document.documentElement.dataset.theme = this.themePref;
        document.body.dataset.theme = this.themePref;
      }
    },

    setLang(l) {
      this.lang = l;
      lsSet("v2_lang", l);
      this.applyThemeAndMode();
      this.renderShellChrome();
      this.renderActiveViews();
      window.V2Map.updateLegend();
      window.V2Vivo?.pintarFab?.();
      window.V2SI?.pintar?.();
      window.V2CampoVivo?.pintar?.();
      window.V2Campo?.tira?.();
      window.V2Campo?.tablero?.();
      window.FSDemo?.pintar?.();
      if (this.modal) this.renderModal();
    },

    setTheme(th) {
      this.themePref = th;
      lsSet("v2_theme", th);
      this.applyThemeAndMode();
      this.renderShellChrome();
    },

    setMode(m) {
      this.mode = m;
      lsSet("v2_mode", m);
      this.applyThemeAndMode();
      this.renderActiveViews();
    },

    setUnits(u) {
      this.units = u;
      lsSet("v2_units", u);
      this.renderActiveViews();
    },

    setSpace(sp) {
      this.space = sp;
      this.renderShellChrome();
      this.renderActiveViews();
      if (sp === "mapa") {
        setTimeout(() => window.V2Map.map?.invalidateSize(), 120);
      } else if (sp === "datos" && this.dataSubTab === "fuentes") {
        this.fetchRecoleccion();
      }
    },

    openSheetTab(tab, snap) {
      this.space = "mapa";
      this.sheetTab = tab;
      if (snap) this.sheetSnap = snap;
      else if (this.sheetSnap === "min") this.sheetSnap = "mid";
      this.renderShellChrome();
      this.renderActiveViews();
    },

    openModal(name) {
      this.modal = name;
      this.renderModal();
    },

    closeModal() {
      
      this.modal = null;
      this.renderModal();
    },

    // Renderiza barra lateral/inferior, barra superior con selector de terreno, campana y ajustes
    async renderShellChrome() {
      document.body.dataset.space = this.space;
      setTimeout(() => window.V2Map?.map?.invalidateSize(), 150);

      // Eliminar cualquier burbuja flotante residual para evitar sobreposiciones
      const bOld = document.getElementById("rover-video-bubble");
      if (bOld) bOld.remove();

      const nav = document.getElementById("v2-nav");
      if (nav) {
        const sp = this.space;
        nav.innerHTML = `
          <button type="button" class="nav-brand" data-open-modal="welcome" title="Field Shift">
            ${ic("leaf", "lg")}
            <span>Field Shift</span>
          </button>
          <div class="nav-spaces" role="navigation" aria-label="Espacios principales">
            <button type="button" class="nav-btn ${sp === "inicio" || sp === "mapa" ? "active" : ""}" ${sp === "inicio" || sp === "mapa" ? 'aria-current="page"' : ""} data-go-space="inicio" title="${esc(tr("nav_inicio"))}">
              ${ic("grid", "lg")}
              <span>${esc(tr("nav_inicio"))}</span>
            </button>
            <button type="button" class="nav-btn ${sp === "robot" ? "active" : ""}" ${sp === "robot" ? 'aria-current="page"' : ""} data-go-space="robot" title="${esc(tr("nav_robot"))}">
              ${ic("robot", "lg")}
              <span>${esc(tr("nav_robot"))}</span>
            </button>
            <button type="button" class="nav-btn ${sp === "region" ? "active" : ""}" ${sp === "region" ? 'aria-current="page"' : ""} data-go-space="region" title="${esc(tr("nav_region"))}">
              ${ic("chart", "lg")}
              <span>${esc(tr("nav_region"))}</span>
            </button>
            <button type="button" class="nav-btn ${sp === "recom" ? "active" : ""}" ${sp === "recom" ? 'aria-current="page"' : ""} data-go-space="recom" title="${esc(tr("nav_recom"))}">
              ${ic("compass", "lg")}
              <span>${esc(tr("nav_recom"))}</span>
            </button>
            <button type="button" class="nav-btn ${sp === "decidir" ? "active" : ""}" ${sp === "decidir" ? 'aria-current="page"' : ""} data-go-space="decidir" title="${esc(this.lang === "en" ? "Economics & planning" : this.lang === "pt" ? "Economia e planejamento" : "Economía y siembra")}">
              ${ic("dollar", "lg")}
              <span>${esc(this.lang === "en" ? "Economics" : this.lang === "pt" ? "Economia" : "Economía")}</span>
            </button>
            <button type="button" class="nav-btn ${sp === "datos" ? "active" : ""}" ${sp === "datos" ? 'aria-current="page"' : ""} data-go-space="datos" title="${esc(this.lang === "en" ? "Data, climate, models and catalog" : this.lang === "pt" ? "Dados, clima, modelos e catálogo" : "Datos, clima, modelos y catálogo")}">
              ${ic("layers", "lg")}
              <span>${esc(this.lang === "en" ? "Data & SI" : this.lang === "pt" ? "Dados e SI" : "Datos y SI")}</span>
            </button>
            <button type="button" class="nav-btn ${sp === "conceptos" ? "active" : ""}" ${sp === "conceptos" ? 'aria-current="page"' : ""} data-go-space="conceptos" title="${esc(tr("nav_conceptos"))}">
              ${ic("book", "lg")}
              <span>${esc(tr("nav_conceptos"))}</span>
            </button>
          </div>
          <div class="nav-footer">
            <button type="button" class="nav-btn" data-action="abrir-cuenta" title="${esc(tr("nav_cuenta"))}">
              ${ic("user", "sm")}
              <span>${esc(tr("nav_cuenta"))}</span>
            </button>
            <button type="button" class="nav-btn" data-open-modal="settings" title="${esc(tr("nav_ajustes"))}">
              ${ic("settings", "sm")}
              <span>${esc(tr("nav_ajustes"))}</span>
            </button>
          </div>
        `;
      }

      const topbar = document.getElementById("v2-topbar");
      if (topbar) {
        const curInputVal = document.getElementById("v2-q")?.value || "";
        const terrenos = window.V2Adapter ? await window.V2Adapter.obtenerTerrenos() : [];
        const nAlertas = window.V2Alertas ? window.V2Alertas.conteoNoLeidas() : 0;

        topbar.innerHTML = `
          <!-- Selector de Terreno Activo -->
          ${terrenos.length ? "" : `<button type="button" class="btn btn-pri btn-sm" data-action="abrir-ubicacion">${ic("draw", "sm")} <span>${esc(tr("add_field"))}</span></button>`}
          <div class="field-active-sel" title="Terreno activo" ${terrenos.length ? "" : "hidden"}>
            ${ic("map", "sm")}
            <select id="v2-sel-terreno-activo" aria-label="Seleccionar terreno activo">
              ${terrenos.map(t => `
                <option value="${esc(t.id)}" ${this.loc?.label === t.nombre ? "selected" : ""}>
                  ${esc(t.nombre)}${t.hectareas ? ` (${t.hectareas.toFixed(1)} ha)` : ""}
                </option>
              `).join("")}
              <option value="__nuevo__">+ Nuevo terreno…</option>
            </select>
          </div>

          <!-- Buscador de Localidad -->
          <form class="search-bar" id="v2-search-form" role="search">
            ${ic("search", "sm")}
            <input type="search" id="v2-q" placeholder="${esc(tr("search_ph"))}" value="${esc(curInputVal)}" maxlength="100" aria-label="${esc(tr("search_ph"))}">
            <button type="submit" class="btn btn-pri btn-sm">${esc(tr("search_btn"))}</button>
          </form>

          <!-- Acciones Superiores: Campana de Notificaciones, Idioma, Tema, Recorrido -->
          <div class="top-actions">
            <!-- Indicador de Notificaciones (Campana con contador visible siempre) -->
            <div class="bell-wrap">
              <button type="button" class="btn btn-sec btn-sm" id="v2-btn-bell" aria-label="Notificaciones y alertas" title="Notificaciones y alertas">
                ${ic("bell", "sm")}
              </button>
              <span id="v2-bell-badge" class="bell-badge" ${nAlertas === 0 ? "hidden" : ""}>${nAlertas}</span>
            </div>

            <!-- Selector de Idioma -->
            <div class="lang-pill" role="group" aria-label="Idioma / Language">
              ${["es", "en", "pt"].map(l => `
                <button type="button" class="${this.lang === l ? "active" : ""}" data-set-lang="${l}" aria-pressed="${this.lang === l}">${l.toUpperCase()}</button>
              `).join("")}
            </div>

            <!-- Tema Claro/Oscuro -->
            <button type="button" class="btn btn-sec btn-sm" data-action="toggle-theme" aria-label="${esc(tr("set_theme"))}" title="${esc(tr("set_theme"))}">
              ${ic(document.body.dataset.theme === "dark" ? "sun" : "moon", "sm")}
            </button>

            <!-- Menú de Ajustes / Cuenta -->
            <button type="button" class="btn btn-sec btn-sm" data-action="abrir-cuenta" aria-label="${esc(tr("nav_cuenta"))}" title="${esc(tr("nav_cuenta"))}">
              ${ic("user", "sm")}
            </button>
          </div>
        `;
      }

      const fabs = document.getElementById("v2-map-fabs");
      if (fabs) {
        fabs.hidden = this.space !== "mapa";
        fabs.innerHTML = `
          <button type="button" class="btn btn-pri" data-action="draw">
            ${ic("draw", "sm")} <span>${esc(tr("btn_draw"))}</span>
          </button>
          <button type="button" class="btn btn-sec" data-sheet-tab="layers">
            ${ic("layers", "sm")} <span>${esc(tr("btn_layers"))} (${window.V2Map.activeLayers.size + (window.V2Map.plssLayer ? 1 : 0) + (window.V2Map.usgsOn ? 1 : 0)})</span>
          </button>
          <button type="button" class="btn btn-sec" data-open-modal="welcome">
            ${ic("leaf", "sm")} <span>${esc(tr("btn_welcome"))}</span>
          </button>
        `;
      }
    },

    renderActiveViews() {
      const sheet = document.getElementById("v2-sheet");
      const fabs = document.getElementById("v2-map-fabs");
      const wsInicio = document.getElementById("v2-ws-inicio");
      const wsRobot = document.getElementById("v2-ws-robot");
      const wsRegion = document.getElementById("v2-ws-region");
      const wsRecom = document.getElementById("v2-ws-recom");
      const wsConceptos = document.getElementById("v2-ws-conceptos");
      const wsDec = document.getElementById("v2-ws-decidir");
      const wsDat = document.getElementById("v2-ws-datos");

      if (wsInicio) wsInicio.hidden = true;
      if (wsRobot) wsRobot.hidden = true;
      if (wsRegion) wsRegion.hidden = true;
      if (wsRecom) wsRecom.hidden = true;
      if (wsConceptos) wsConceptos.hidden = true;
      if (wsDec) wsDec.hidden = true;
      if (wsDat) wsDat.hidden = true;
      if (sheet) sheet.hidden = true;
      if (fabs) fabs.hidden = true;

      if (this.space === "inicio") {
        if (wsInicio) {
          wsInicio.hidden = false;
          wsInicio.innerHTML = window.V2Screens ? window.V2Screens.renderInicioWorkspace() : "";
        }
      } else if (this.space === "robot") {
        if (wsRobot) {
          wsRobot.hidden = false;
          wsRobot.innerHTML = window.V2Robot ? window.V2Robot.renderWorkspaceHtml() : "";
        }
      } else if (this.space === "region") {
        if (wsRegion) {
          wsRegion.hidden = false;
          wsRegion.innerHTML = window.V2Screens ? window.V2Screens.renderRegionWorkspace() : "";
        }
      } else if (this.space === "recom") {
        if (wsRecom) {
          wsRecom.hidden = false;
          wsRecom.innerHTML = window.V2Screens ? window.V2Screens.renderRecomendacionesWorkspace() : "";
        }
      } else if (this.space === "conceptos") {
        if (wsConceptos) {
          wsConceptos.hidden = false;
          wsConceptos.innerHTML = window.V2Conceptos ? window.V2Conceptos.renderWorkspaceHtml() : "";
        }
      } else if (this.space === "mapa") {
        if (fabs) fabs.hidden = false;
        if (sheet) {
          sheet.hidden = false;
          sheet.dataset.snap = this.sheetSnap;
          const handleEl = document.getElementById("v2-sheet-handle");
          if (handleEl) {
            const mLabels = this.lang === "en"
              ? [
                  ["farmer", "Simple", "Plain everyday language without technical jargon"],
                  ["agronomist", "Technical", "Adds agronomic indexes (NDVI, z-score, ET)"],
                  ["scientist", "Scientific", "Shows raw satellite formulas, sensors and APIs"]
                ]
              : this.lang === "pt"
              ? [
                  ["farmer", "Simples", "Linguagem direta sem termos técnicos"],
                  ["agronomist", "Técnica", "Adiciona índices agronômicos (NDVI, z-score, ET)"],
                  ["scientist", "Científica", "Mostra fórmulas brutas, sensores e APIs"]
                ]
              : [
                  ["farmer", "Simple", "Lenguaje claro de campo sin siglas técnicas"],
                  ["agronomist", "Técnico", "Muestra además índices agronómicos (NDVI, anomalía σ, ET)"],
                  ["scientist", "Científico", "Muestra variables crudas de satélite, sensores y APIs"]
                ];
            const sLabels = this.lang === "en"
              ? [["min", "Low"], ["mid", "Mid"], ["max", "Full"]]
              : this.lang === "pt"
              ? [["min", "Baixo"], ["mid", "Médio"], ["max", "Alto"]]
              : [["min", "Bajo"], ["mid", "Medio"], ["max", "Alto"]];
            const modeHdr = this.lang === "en" ? "Detail:" : this.lang === "pt" ? "Detalhe:" : "Detalle:";
            const sizeHdr = this.lang === "en" ? "Panel:" : "Panel:";
            handleEl.innerHTML = `
              <div class="handle-group" title="Elige cuánto detalle técnico quieres leer en las tarjetas">
                <span class="handle-lbl">${esc(modeHdr)}</span>
                <div class="seg-pill" role="group" aria-label="${esc(tr("set_mode"))}">
                  ${mLabels.map(([mId, mTxt, mTip]) => `
                    <button type="button" class="${this.mode === mId ? "active" : ""}" data-quick-mode="${mId}" title="${esc(mTip)}">${esc(mTxt)}</button>
                  `).join("")}
                </div>
              </div>
              <div class="sheet-pill-grab" aria-hidden="true"></div>
              <div class="handle-group" title="Cambia la altura de esta libreta sobre el mapa">
                <span class="handle-lbl">${esc(sizeHdr)}</span>
                <div class="seg-pill" role="group" aria-label="Altura del panel">
                  ${sLabels.map(([sId, sTxt]) => `
                    <button type="button" class="${this.sheetSnap === sId ? "active" : ""}" data-sheet-snap="${sId}">${esc(sTxt)}</button>
                  `).join("")}
                </div>
              </div>
            `;
          }
          const tabsEl = document.getElementById("v2-sheet-tabs");
          if (tabsEl) {
            const tabs = this.lang === "en"
              ? [
                  ["summary", "compass", "1. Summary", "4 key indicators of water, plant greenness, frost & soil"],
                  ["terrain", "grid", "2. My Field", "Draw your parcel, change number of cells (9 to 100) or export"],
                  ["cell", "info", "3. Sector", "Diagnosis of the specific square you click on the map"],
                  ["layers", "layers", "4. Layers", "Turn on 14 satellite layers, 12-week time machine & curtain"]
                ]
              : this.lang === "pt"
              ? [
                  ["summary", "compass", "1. Resumo", "4 indicadores principais de água, verdor, geada e solo"],
                  ["terrain", "grid", "2. Terreno", "Desenhe sua área, mude o número de quadros (9 a 100) ou exporte"],
                  ["cell", "info", "3. Setor", "Diagnóstico do quadro clicado no mapa"],
                  ["layers", "layers", "4. Camadas", "Ative 14 camadas de satélite e máquina do tempo"]
                ]
              : [
                  ["summary", "compass", "1. Resumen", "Los 4 medidores clave de agua, verdor, frío y suelo de este lugar"],
                  ["terrain", "grid", "2. Mi terreno", "Dibuja tu parcela, cambia cuántos cuadros ves (9 a 100) o exporta"],
                  ["cell", "info", "3. Sector", "Diagnóstico del cuadro específico que toques en el mapa"],
                  ["layers", "layers", "4. Capas", "Enciende 14 capas satelitales, viaje en el tiempo y cortina"]
                ];
            tabsEl.innerHTML = tabs.map(([id, icon, lbl, tip]) => `
              <button type="button" class="sheet-tab-btn ${this.sheetTab === id ? "active" : ""}" role="tab" aria-selected="${this.sheetTab === id}" data-sheet-tab="${id}" title="${esc(tip)}">
                ${ic(icon, "sm")} <span>${esc(lbl)}</span>
              </button>
            `).join("");
          }
          const bodyEl = document.getElementById("v2-sheet-body");
          if (bodyEl) {
            bodyEl.innerHTML =
              this.sheetTab === "summary" ? window.V2Screens.renderPlaceSummary() :
              this.sheetTab === "terrain" ? window.V2Screens.renderMyTerrain() :
              this.sheetTab === "cell" ? window.V2Screens.renderCellCard() :
              window.V2Screens.renderUsefulLayers();
          }
        }
      } else if (this.space === "decidir") {
        if (wsDec) {
          wsDec.hidden = false;
          wsDec.innerHTML = window.V2Screens.renderDecideWorkspace();
        }
      } else if (this.space === "datos") {
        if (wsDat) {
          wsDat.hidden = false;
          wsDat.innerHTML = window.V2Screens.renderDataWorkspace();
        }
      }

      // Las tarjetas entran con animación solo al llegar a una sección nueva; un redibujo de la misma sección no parpadea
      document.body.classList.toggle("seccion-nueva", this._ultimoEspacio !== this.space);
      this._ultimoEspacio = this.space;
      this.renderModal();
    },

    renderModal() {
      const m = document.getElementById("v2-modal-backdrop");
      if (!m) return;
      if (!this.modal) {
        m.hidden = true;
        m.innerHTML = "";
        return;
      }
      m.hidden = false;
      if (this.modal === "welcome") {
        m.innerHTML = window.V2Screens.renderWelcomeModal();
      } else if (this.modal === "settings") {
        m.innerHTML = window.V2Screens.renderSettingsModal();
      } else if (this.modal === "glossary") {
        m.innerHTML = window.V2Screens.renderGlossaryModal();
      } else if (this.modal === "cuenta") {
        m.innerHTML = window.V2Cuenta ? window.V2Cuenta.renderModalContent() : "";
      } else if (this.modal === "ubicacion") {
        m.innerHTML = window.V2Ubicacion ? window.V2Ubicacion.renderPanelHtml() : "";
      } else if (this.modal === "emparejar") {
        m.innerHTML = window.V2Emparejar ? window.V2Emparejar.renderModalHtml() : "";
      } else if (this.modal === "alertas") {
        m.innerHTML = window.V2Alertas ? window.V2Alertas.renderModalContent() : "";
      } else if (this.modal === "farm") {
        m.innerHTML = `
          <div class="modal-card" role="dialog" aria-modal="true">
            <div class="row-between" style="margin-bottom:12px">
              <h2 class="card-title" style="margin:0">${ic("leaf", "lg")} <span>${esc(tr("farm_title"))}</span></h2>
              <button type="button" class="btn btn-txt btn-sm" data-close-modal="1">${ic("close", "sm")}</button>
            </div>
            <p class="small mut">${esc(tr("farm_sub"))}</p>
            <div style="display:flex;flex-direction:column;gap:12px">
              <label class="small"><b>${esc(tr("q_crop"))}</b><br><select class="field" data-farm-q="crop" style="width:100%;margin-top:4px">${[["maize", "c_maize"], ["soy", "c_soy"], ["wheat", "c_wheat"], ["veg", "c_veg"]].map(([v, k]) => `<option value="${v}" ${this.C.crop === v ? "selected" : ""}>${esc(tr(k))}</option>`).join("")}</select></label>
              <label class="small"><b>${esc(tr("q_water"))}</b><br><select class="field" data-farm-q="water" style="width:100%;margin-top:4px">${[["rain", "w_rain"], ["irrig", "w_irrig"], ["limited", "w_limited"]].map(([v, k]) => `<option value="${v}" ${this.C.water === v ? "selected" : ""}>${esc(tr(k))}</option>`).join("")}</select></label>
              <label class="small"><b>${esc(tr("q_mach"))}</b><br><select class="field" data-farm-q="machine" style="width:100%;margin-top:4px">${[["conv", "m_conv"], ["notill", "m_notill"], ["forage", "m_forage"]].map(([v, k]) => `<option value="${v}" ${this.C.machine === v ? "selected" : ""}>${esc(tr(k))}</option>`).join("")}</select></label>
              <label class="small"><b>${esc(tr("q_prio"))}</b><br><select class="field" data-farm-q="priority" style="width:100%;margin-top:4px">${[["income", "p_income"], ["water", "p_water"], ["soil", "p_soil"], ["pests", "p_pests"]].map(([v, k]) => `<option value="${v}" ${this.C.priority === v ? "selected" : ""}>${esc(tr(k))}</option>`).join("")}</select></label>
            </div>
            <div style="margin-top:16px;text-align:right">
              <button type="button" class="btn btn-pri" data-close-modal="1">Listo</button>
            </div>
          </div>
        `;
      }
    },

    // Consultar /api/v1/parcel-intelligence y /api/v1/b/clima-historico
    async selectPlace(lat, lon, kind, label) {
      const mismo = this.loc?.id && Math.abs(this.loc.lat - lat) < 0.02 && Math.abs(this.loc.lon - lon) < 0.02;
      this.loc = { ...(mismo ? { id: this.loc.id } : {}), lat, lon, kind: kind || "sim", label: label || (mismo ? this.loc.label : "") };
      this.outsideUsDismissed = false;
      this.closeModal();
      window.V2Map.setLocationMarker(lat, lon, this.loc.kind, this.loc.label);

      // Crear recuadro de parcela y disparar análisis satelital automático
      if (window.V2Map) {
        const dLat = 0.0009;
        const dLon = 0.0009 / Math.cos(lat * Math.PI / 180);
        const ring = [
          [lat - dLat, lon - dLon],
          [lat - dLat, lon + dLon],
          [lat + dLat, lon + dLon],
          [lat + dLat, lon - dLon]
        ];
        window.V2Map.setPolygonCoords(ring, this.loc.label || "Parcela");
      }

      await this.loadParcelIntelligence(lat, lon, this.loc.kind, this.loc.label);

      if (window.V2Map) {
        window.V2Map.analyzeTerrain();
      }
    },

    async loadParcelIntelligence(lat, lon, kind, label) {
      const mismo = this.loc?.id && Math.abs(this.loc.lat - lat) < 0.02 && Math.abs(this.loc.lon - lon) < 0.02;
      this.loc = { ...(mismo ? { id: this.loc.id } : {}), lat, lon, kind: kind || "sim", label: label || (mismo ? this.loc.label : "") };
      try {
        const res = await this.correrTrabajo({ tipo: "parcela", lat, lon }, tr("tr_parcela"));
        this.D = res;
        const sensors = this.D?.telemetria_oficial_en_vivo?.usgs_water_services_nwis?.sensores_cercanos || [];
        window.V2Map.renderPointSensors(sensors);
        this.renderActiveViews();
        this.load40YearClimate(lat, lon);
      } catch (err) {
        this.showToast(
          (this.lang === "en" ? "Could not load place data: " : "No pudimos cargar los datos de este lugar: ") + err.message,
          5000
        );
      } finally {
        this.stopProgress();
      }
    },

    async load40YearClimate(lat, lon) {
      const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
      if (this.clim40Key === key && this.clim40) return;
      this.clim40Key = key;

      for (const ep of [`/api/v1/b/clima-historico?lat=${lat}&lon=${lon}`, `/api/v1/clima-historico?lat=${lat}&lon=${lon}`]) {
        try {
          const r = await fetch(ep);
          if (r.ok) {
            const j = await r.json();
            if (j.estado === "OK") {
              this.clim40 = j;
              if (this.space === "datos") this.renderActiveViews();
              return;
            }
          }
        } catch (_) {}
      }
    },

    async loadCatalogAndMeta() {
      try {
        const r = await fetch("/api/v1/catalogo");
        if (r.ok) {
          this.catalog = await r.json();
          this.renderActiveViews();
        }
      } catch (_) {}

      for (const ep of ["/api/v1/b/modelos", "/api/v1/modelos"]) {
        try {
          const r = await fetch(ep);
          if (r.ok) {
            this.modelsMeta = await r.json();
            break;
          }
        } catch (_) {}
      }
    },

    async fetchRecoleccion() {
      try {
        const r = await fetch("/api/v1/recoleccion");
        if (r.ok) {
          this.recolData = await r.json();
          if (this.space === "datos" && this.dataSubTab === "fuentes") {
            this.renderActiveViews();
          }
        }
      } catch (_) {}
    },

    useGps() {
      this.closeModal();
      if (!navigator.geolocation) {
        this.showToast(tr("gps_none"), 4500);
        return;
      }
      this.startProgress("Leyendo tu ubicación GPS…");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.stopProgress();
          this.selectPlace(pos.coords.latitude, pos.coords.longitude, "real", "GPS");
        },
        () => {
          this.stopProgress();
          this.showToast(tr("gps_fail"), 4500);
        },
        { timeout: 9000 }
      );
    },

    async searchPlace(q) {
      const query = (q || "").trim();
      if (query.length < 2) return;
      const searchTxt = this.lang === "en" ? `Searching «${query}»…` : this.lang === "pt" ? `Buscando «${query}»…` : `Buscando «${query}»…`;
      this.startProgress(searchTxt);
      try {
        const r = await (await fetch(`/api/v1/geocode?q=${encodeURIComponent(query)}`)).json();
        if (r.lat != null && r.lon != null) {
          this.selectPlace(r.lat, r.lon, "sim", r.direccion || query);
        } else {
          const failMsg = this.lang === "en" ? "Could not find this place. Try town or state name." : this.lang === "pt" ? "Não encontramos esse local. Tente com o município ou estado." : "No encontramos ese lugar. Intenta con el nombre del municipio o estado.";
          this.showToast(r.detalle || failMsg, 4500);
        }
      } catch (err) {
        this.showToast("Error: " + err.message, 4500);
      } finally {
        this.stopProgress();
      }
    },

    saveLastTerrainToStorage() {
      if (!window.V2Map.poly) return;
      const ring = window.V2Map.poly.getLatLngs()[0].map(p => [Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))]);
      lsSet("v2_last_terrain", JSON.stringify({
        ring,
        label: window.V2Map.polyLabel || "",
        loc: this.loc
      }));
    },

    restoreLastSession() {
      const last = lsGetJson("v2_last_terrain", null);
      if (last && last.loc && Array.isArray(last.ring) && last.ring.length >= 3) {
        this.loc = last.loc;
      }
    },

    saveNamedTerrain() {
      if (!window.V2Map.poly) {
        this.showToast("Primero dibuja o selecciona tu terreno.", 3500);
        return;
      }
      const name = prompt("Nombre para guardar este terreno:", window.V2Map.polyLabel || `Terreno ${this.savedTerrains.length + 1}`);
      if (!name) return;
      const ring = window.V2Map.poly.getLatLngs()[0].map(p => [Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))]);
      this.savedTerrains.push({ id: Date.now(), name, ring, date: new Date().toISOString().slice(0, 10) });
      lsSet("v2_saved_terrains", JSON.stringify(this.savedTerrains));
      this.renderActiveViews();
    },

    // Aviso de espera para operaciones cortas: solo el tiempo que de verdad lleva. No se muestra porcentaje ni estimación sin medir.
    startProgress(msg) {
      const box = document.getElementById("v2-toast-progress");
      if (!box) return;
      box.hidden = false;
      this.progStartMs = performance.now();
      clearInterval(this.progTimer);
      const update = () => {
        box.innerHTML = `<div class="row-between small"><strong>${esc(msg)}</strong><span class="xs mut">${((performance.now() - this.progStartMs) / 1000).toFixed(1)} s</span></div>`;
      };
      update();
      this.progTimer = setInterval(update, 200);
    },

    stopProgress() {
      clearInterval(this.progTimer);
      const box = document.getElementById("v2-toast-progress");
      if (box) box.hidden = true;
      this.pintarTrabajos(); // si queda otro análisis corriendo, su avance sigue a la vista
    },

    trabajosVivos: new Map(),

    pintarTrabajos() {
      const box = document.getElementById("v2-toast-progress");
      if (!box || !this.trabajosVivos.size) return;
      box.hidden = false;
      box.innerHTML = [...this.trabajosVivos.values()].join('<hr style="border:0;border-top:1px solid var(--linea);margin:8px 0">');
    },

    // Análisis largo: el servidor lo corre como trabajo y aquí se pinta su avance medido (paso, hechas/total, segundos).
    // La estimación solo aparece si hay corridas anteriores medidas; es su mediana.
    async correrTrabajo(cuerpo, titulo) {
      const r = await fetch("/api/v1/trabajos", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.detail || j.detalle || `Error ${r.status}`);
      clearInterval(this.progTimer);
      try {
        for (;;) {
          const t = await (await fetch(`/api/v1/trabajos/${encodeURIComponent(j.trabajo)}`, { credentials: "same-origin" })).json();
          if (t.estado === "LISTO") return t.resultado;
          if (t.estado !== "EN_CURSO") throw new Error(t.detalle || t.detail || "Error");
          this.trabajosVivos.set(j.trabajo, this.avanceHtml(titulo, t));
          this.pintarTrabajos();
          await new Promise(ok => setTimeout(ok, 350));
        }
      } finally {
        this.trabajosVivos.delete(j.trabajo);
        this.stopProgress();
      }
    },

    avanceHtml(titulo, t) {
      const dentro = t.total ? Math.min(1, (t.hechas || 0) / t.total) : 0;
      const pct = t.pasos ? Math.round(100 * ((Math.max(1, t.paso) - 1 + dentro) / t.pasos)) : 0;
      const partes = [];
      if (t.pasos) partes.push(`${trf("av_paso", { a: t.paso, b: t.pasos })} · ${tr(t.clave)}`);
      if (t.total) partes.push(trf("av_de", { a: t.hechas || 0, b: t.total }));
      const est = t.estimado ? trf("av_suele", { s: t.estimado.segundos, n: t.estimado.corridas }) : tr("av_sin_hist");
      return `
        <div class="row-between small"><strong>${esc(titulo)}</strong><span class="xs mut">${t.segundos.toFixed(1)} s</span></div>
        <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="xs mut">${esc(partes.join(" · "))}</div>
        <div class="xs mut">${esc(est)}</div>`;
    },

    showToast(msg, ms = 4000) {
      const box = document.getElementById("v2-toast-progress");
      if (!box) return;
      clearInterval(this.progTimer);
      box.hidden = false;
      box.innerHTML = `<div class="small">${ic("info", "sm")} <span>${esc(msg)}</span></div>`;
      setTimeout(() => { box.hidden = true; }, ms);
    },

    // Recorrido Guiado (Tour de 4 pasos)
    startTour(step = 0) {
      const steps = [
        { space: "mapa", tab: "summary", title: "1/4 · El mapa y el resumen en 5 segundos", desc: "El mapa ocupa toda la pantalla. En la hoja inferior ves los 3 semáforos (Agua, Verdor y Frío) sin jerga técnica." },
        { space: "mapa", tab: "terrain", title: "2/4 · Mi terreno y cuadrícula Sentinel-2", desc: "Dibuja tus bordes, toma una sección oficial BLM PLSS o un campo de OpenStreetMap con un clic, y toca cualquier cuadro para ver su ficha." },
        { space: "decidir", tab: null, title: "3/4 · Decidir qué sembrar y calcular margen", desc: "Responde 4 preguntas de «Tu granja» y compara al instante las 3 estrategias, tus costos con precios USDA MARS y el calendario a 3 años." },
        { space: "datos", tab: null, title: "4/4 · Clima de 40 años, SI honesta y el catálogo de capas", desc: "Explora percentiles climáticos 1985–2024, el clasificador SI de cultivos con su acierto medido y el catálogo satelital completo." }
      ];
      const bar = document.getElementById("v2-tour-bar");
      if (!bar) return;
      if (step < 0 || step >= steps.length) {
        bar.hidden = true;
        this.tourStep = -1;
        return;
      }
      this.tourStep = step;
      const st = steps[step];
      this.space = st.space;
      if (st.tab) this.sheetTab = st.tab;
      this.renderShellChrome();
      this.renderActiveViews();

      bar.hidden = false;
      bar.innerHTML = `
        <div class="row-between" style="margin-bottom:4px">
          <strong>${esc(st.title)}</strong>
          <button type="button" class="btn btn-txt btn-sm" data-tour-step="-1">✕</button>
        </div>
        <p class="small mut" style="margin:0 0 10px">${esc(st.desc)}</p>
        <div class="row-between">
          <button type="button" class="btn btn-sec btn-sm" data-tour-step="${step - 1}" ${step === 0 ? "disabled" : ""}>Anterior</button>
          <button type="button" class="btn btn-pri btn-sm" data-tour-step="${step === steps.length - 1 ? -1 : step + 1}">${step === steps.length - 1 ? "Finalizar" : "Siguiente"}</button>
        </div>
      `;
    },

    // Ruta del robot en cuadros críticos y análisis de foto de hoja
    generateRobotRoute() {
      const out = document.getElementById("v2-robot-out");
      const r = this.terrainResp;
      if (!out) return;
      if (!r?.celdas?.length) {
        out.innerHTML = `<div class="notice atencion"><div class="small">Primero dibuja tu terreno o carga un caso de ejemplo para calcular los cuadros críticos.</div></div>`;
        return;
      }
      const stats = window.V2Map.computeStats(r.celdas);
      const top5 = r.celdas
        .map((c, idx) => ({ c, idx, z: c.ndvi != null ? (c.ndvi - stats.mean) / stats.sd : 0 }))
        .sort((a, b) => a.z - b.z)
        .slice(0, Math.min(5, r.celdas.length));

      out.innerHTML = `
        <div class="card-sub">
          <strong>Ruta sugerida de muestreo para robot (5 cuadros de menor verdor):</strong>
          <ol style="margin:6px 0 0 18px;padding:0">
            ${top5.map(s => {
              const [[so, we], [no, ea]] = s.c.limites;
              return `<li><b>Cuadro #${s.idx + 1}</b> (${((so + no) / 2).toFixed(5)}, ${((we + ea) / 2).toFixed(5)}) · Verdor <b>${s.c.ndvi ?? "—"}</b> (${s.z.toFixed(2)}σ)</li>`;
            }).join("")}
          </ol>
        </div>
      `;
    },

    exportarLecturasRawCsv() {
      const hojaRecs = window.ROBOT_HOJA_RECORDS || [];
      if (hojaRecs.length) {
        const headers = ["hora_utc", "latitud", "longitud", "velocidad_kmh", "rotacion_deg", "temp_aire_c", "humedad_aire_pct", "nitrogeno_mg_kg", "fosforo_mg_kg", "potasio_mg_kg", "humedad_suelo_pct", "temp_suelo_c", "ph", "salinidad_us_cm", "tds_ppm"];
        const rows = hojaRecs.map(r => [
          r.t ? new Date(r.t).toISOString() : "",
          r.lat ?? "",
          r.lon ?? "",
          r.velocidad ?? "",
          r.rotacion ?? r["rotación"] ?? "",
          r.temperatura ?? "",
          r.humedad ?? "",
          r.nitrogeno ?? "",
          r.fosforo ?? "",
          r.potasio ?? "",
          r.humedad_suelo ?? "",
          r.temperatura_suelo ?? "",
          r.ph ?? "",
          r.salinidad ?? "",
          r.tds ?? ""
        ]);
        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fieldshift_appscript_npk_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
      const lecturas = window.V2Robot?.ultimasLecturas || [];
      if (!lecturas.length) {
        this.showToast("No hay lecturas disponibles para exportar.", 3000);
        return;
      }
      const headers = ["timestamp_utc", "variable", "valor", "unidad", "lat", "lon", "calidad"];
      const rows = lecturas.map(l => [
        l.t ? new Date(l.t).toISOString() : new Date().toISOString(),
        `"${(l.variable || "").replace(/"/g, '""')}"`,
        l.valor ?? "",
        `"${(l.unidad || "").replace(/"/g, '""')}"`,
        l.lat ?? "",
        l.lon ?? "",
        "OK"
      ]);
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fieldshift_robot_raw_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    analyzeLeafPhoto(file) {
      if (!file) return;
      const img = new Image();
      img.onload = () => {
        const cv = document.getElementById("v2-leaf-cv");
        if (!cv) return;
        const ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0, 160, 160);
        const data = ctx.getImageData(0, 0, 160, 160).data;
        let green = 0, yellow = 0, brown = 0, tot = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (r + g + b < 40 || r + g + b > 720) continue;
          tot++;
          if (g > r * 1.08 && g > b * 1.15) green++;
          else if (r > 130 && g > 110 && b < 95) yellow++;
          else if (r > g && g >= b && r < 180) brown++;
        }
        const n = Math.max(tot, 1);
        const gP = Math.round((green / n) * 100);
        const yP = Math.round((yellow / n) * 100);
        const bP = Math.round((brown / n) * 100);
        const out = document.getElementById("v2-leaf-out");
        if (out) {
          out.innerHTML = `
            <div class="notice ${yP + bP > 30 ? "atencion" : "ok"}">
              <div>
                <b>Tejido verde: ${gP}% · Amarillamiento (clorosis): ${yP}% · Necrosis parda: ${bP}%</b>
                <div class="xs mut" style="margin-top:4px">${esc(tr("ai_leaf_disclaimer"))}</div>
              </div>
            </div>
          `;
        }
      };
      img.src = URL.createObjectURL(file);
    },

    // Eventos globales delegados y accesibles por teclado
    bindEvents() {
      document.addEventListener("visibilitychange", () => {
        this.iniciarRobotPolling();
      });

      document.addEventListener("submit", (e) => {
        if (e.target.id === "v2-search-form") {
          e.preventDefault();
          const q = document.getElementById("v2-q")?.value;
          this.searchPlace(q);
        }
      });

      document.addEventListener("click", (e) => {
        const sBtn = e.target.closest("#v2-search-form button");
        if (sBtn) {
          e.preventDefault();
          const q = document.getElementById("v2-q")?.value;
          this.searchPlace(q);
          return;
        }
        const vidBtn = e.target.closest("[data-vid-src]");
        if (vidBtn) {
          const src = vidBtn.dataset.vidSrc;
          const card = vidBtn.closest(".rover-hardware-card") || document;
          const vid = card.querySelector("video");
          if (vid) {
            vid.src = src;
            vid.play().catch(() => {});
          }
          card.querySelectorAll(".rover-vid-btn").forEach(b => b.classList.toggle("active", b === vidBtn));
          return;
        }

        if (e.target.closest("#v2-btn-bell")) {
          this.openModal("alertas");
          return;
        }

        if (e.target.closest("#v2-btn-export-raw-csv")) {
          this.exportarLecturasRawCsv();
          return;
        }

        const el = e.target.closest("button, [data-go-space], [data-sheet-tab], [data-open-modal], [data-close-modal], [data-src-info]");
        if (!el) {
          if (e.target.id === "v2-modal-backdrop") this.closeModal();
          return;
        }

        if (el.dataset.setLang) {
          this.setLang(el.dataset.setLang);
        } else if (el.dataset.quickMode) {
          this.setMode(el.dataset.quickMode);
        } else if (el.dataset.colorMode) {
          this.colorMode = el.dataset.colorMode;
          window.V2Map.drawGridCells();
          this.renderActiveViews();
        } else if (el.dataset.goSpace) {
          this.setSpace(el.dataset.goSpace);
        } else if (el.dataset.sheetTab) {
          this.openSheetTab(el.dataset.sheetTab);
        } else if (el.dataset.sheetSnap) {
          this.sheetSnap = el.dataset.sheetSnap;
          this.renderActiveViews();
          if (window.V2Map.poly) {
            window.V2Map.fitBoundsSmart(window.V2Map.poly.getBounds());
          }
        } else if (el.dataset.openModal) {
          this.openModal(el.dataset.openModal);
        } else if (el.dataset.closeModal) {
          this.closeModal();
        } else if (el.dataset.pregunta) {
          this.preguntaActiva = el.dataset.pregunta;
          this.renderActiveViews();
        } else if (el.dataset.preguntaMapa) {
          // Enciende solo las capas de la pregunta (comprobadas) y abre el mapa
          const p = (this.preguntas?.preguntas || []).find(x => x.id === el.dataset.preguntaMapa);
          [...window.V2Map.activeLayers.values()].filter(x => x.kind === "gibs").forEach(x => window.V2Map.toggleLayer("gibs", x.id, false));
          (p?.capas || []).forEach(c => window.V2Map.toggleLayer("gibs", c.id, true));
          this.openSheetTab("layers", "min");
        } else if (el.dataset.dismissOutside) {
          this.outsideUsDismissed = true;
          this.renderActiveViews();
        } else if (el.dataset.mapPick) {
          const [la, lo] = el.dataset.mapPick.split(",").map(Number);
          window.V2Map.map?.closePopup();
          this.selectPlace(la, lo, "sim", "");
        } else if (el.dataset.mapPlss) {
          const [la, lo] = el.dataset.mapPlss.split(",").map(Number);
          window.V2Map.adoptPlssSection(la, lo);
        } else if (el.dataset.dataTab) {
          this.dataSubTab = el.dataset.dataTab;
          if (this.dataSubTab === "fuentes") this.fetchRecoleccion();
          this.renderActiveViews();
        } else if (el.dataset.openCatalog) {
          this.space = "datos";
          this.dataSubTab = "fuentes";
          this.fetchRecoleccion();
          this.renderShellChrome();
          this.renderActiveViews();
          setTimeout(() => document.getElementById("v2-full-catalog")?.scrollIntoView({ behavior: "smooth" }), 100);
        } else if (el.dataset.goConceptos) {
          this.closeModal();
          this.setSpace("conceptos");
          setTimeout(() => {
            if (window.V2Conceptos) {
              window.V2Conceptos.abrirConcepto?.(el.dataset.goConceptos);
            }
          }, 120);
        } else if (el.dataset.favLayer) {
          const id = el.dataset.favLayer;
          if (this.favLayers.includes(id)) this.favLayers = this.favLayers.filter(x => x !== id);
          else this.favLayers.push(id);
          lsSet("v2_fav_layers", JSON.stringify(this.favLayers));
          this.renderActiveViews();
        } else if (el.dataset.export) {
          window.V2Map.exportFile(el.dataset.export);
        } else if (el.dataset.loadSaved) {
          const item = this.savedTerrains.find(x => String(x.id) === el.dataset.loadSaved);
          if (item) {
            window.V2Map.setPolygonCoords(item.ring, item.name);
            window.V2Map.analyzeTerrain();
          }
        } else if (el.dataset.delSaved) {
          this.savedTerrains = this.savedTerrains.filter(x => String(x.id) !== el.dataset.delSaved);
          lsSet("v2_saved_terrains", JSON.stringify(this.savedTerrains));
          this.renderActiveViews();
        } else if (el.dataset.srcInfo) {
          this.showToast(el.dataset.srcInfo, 4500);
        } else if (el.dataset.tourStep !== undefined) {
          this.startTour(Number(el.dataset.tourStep));
        } else if (el.id === "v2-time-play") {
          this.toggleTimePlay();
        } else if (el.id === "v2-cat-more") {
          this.catFilter.limit += 80;
          this.renderActiveViews();
        } else if (el.dataset.action) {
          const act = el.dataset.action;
          if (act === "abrir-cuenta") this.openModal("cuenta");
          else if (act === "abrir-alertas") this.openModal("alertas");
          else if (act === "abrir-ubicacion") {
            if (window.V2Ubicacion) window.V2Ubicacion.abrirPantalla();
            else this.openModal("ubicacion");
          } else if (act === "abrir-emparejar") {
            if (window.V2Emparejar) window.V2Emparejar.abrirAsistente();
            else this.openModal("emparejar");
          } else if (act === "gps") this.useGps();
          else if (act === "focus-search") {
            this.closeModal();
            setTimeout(() => document.getElementById("v2-q")?.focus(), 80);
          } else if (act === "toggle-theme") {
            const cur = document.body.dataset.theme === "dark" ? "light" : "dark";
            this.setTheme(cur);
          } else if (act === "start-tour") this.startTour(0);
          else if (act === "draw") {
            this.openSheetTab("terrain", "min");
            window.V2Map.startDraw();
          } else if (act === "plss") window.V2Map.adoptPlssSection();
          else if (act === "osm") window.V2Map.loadOsmFields();
          else if (act === "clear-ter") window.V2Map.clearTerrain(true);
          else if (act === "retry-ter") window.V2Map.analyzeTerrain();
          else if (act === "clear-cell-sel") {
            this.selectedCells.clear();
            window.V2Map.drawGridCells();
            this.renderActiveViews();
          } else if (act === "run-ai") window.V2Map.runAiCropClassifier();
          else if (act === "save-ter") this.saveNamedTerrain();
          else if (act === "import-ter") document.getElementById("v2-file-geo")?.click();
          else if (act === "print") window.print();
          else if (act === "robot-route") this.generateRobotRoute();
          else if (act === "toggle-json") {
            const p = document.getElementById("v2-raw-json");
            if (p) p.hidden = !p.hidden;
          }
        }
      });

      document.addEventListener("change", async (e) => {
        const t = e.target;
        if (t.id === "v2-sel-terreno-activo") {
          if (t.value === "__nuevo__") {
            if (window.V2Ubicacion) window.V2Ubicacion.abrirPantalla();
            else this.openModal("ubicacion");
          } else {
            const terrenos = window.V2Adapter ? await window.V2Adapter.obtenerTerrenos() : [];
            const sel = terrenos.find(x => x.id === t.value);
            if (sel) {
              this.selectPlace(sel.lat, sel.lon, "real", sel.nombre);
              if (sel.poligono && window.V2Map) {
                window.V2Map.setPolygonCoords(sel.poligono, sel.nombre);
              }
            }
          }
        } else if (t.id === "v2-cells-sel") {
          if (String(t.value).startsWith("lado:")) { this.cellSide = Number(t.value.slice(5)); }
          else { this.cellSide = null; this.cellsCount = Number(t.value.slice(2)); }
          if (window.V2Map.poly) window.V2Map.analyzeTerrain();
        } else if (t.id === "v2-color-sel") {
          this.colorMode = t.value;
          window.V2Map.drawGridCells();
        } else if (t.dataset.toggleKind) {
          window.V2Map.toggleLayer(t.dataset.toggleKind, t.dataset.toggleId, t.checked);
        } else if (t.id === "v2-lay-fav") {
          this.layerFavOnly = t.checked;
          this.renderActiveViews();
        } else if (t.id === "v2-layer-date") {
          this.layerDate = t.value;
          window.V2Map.updateTimeDimension();
        } else if (t.dataset.farmQ) {
          this.C[t.dataset.farmQ] = t.value;
          lsSet("v2_farm_c", JSON.stringify(this.C));
          this.renderActiveViews();
        } else if (t.id === "v2-fe-ha") {
          this.farmExtra.ha = t.value === "" ? null : Math.max(0, Number(t.value));
          lsSet("v2_farm_extra", JSON.stringify(this.farmExtra));
          this.renderActiveViews();
        } else if (t.dataset.calc) {
          this.farmExtra[t.dataset.calc] = t.value === "" ? null : Number(t.value);
          lsSet("v2_farm_extra", JSON.stringify(this.farmExtra));
          this.renderActiveViews();
        } else if (t.dataset.th) {
          this.thresholds[t.dataset.th] = Number(t.value);
          window.V2Map.drawGridCells();
          this.renderActiveViews();
        } else if (t.id === "v2-file-geo") {
          window.V2Map.importGeoFile(t.files?.[0]);
        } else if (t.id === "v2-leaf-inp") {
          this.analyzeLeafPhoto(t.files?.[0]);
        } else if (t.id === "v2-cat-dedup") {
          this.catFilter.dedup = t.checked;
          this.catFilter.limit = 60;
          this.renderActiveViews();
        } else if (t.dataset.catF) {
          this.catFilter[t.dataset.catF] = t.value;
          this.catFilter.limit = 60;
          this.renderActiveViews();
        } else if (t.id === "v2-set-lang") {
          this.setLang(t.value);
        } else if (t.id === "v2-set-theme") {
          this.setTheme(t.value);
        } else if (t.id === "v2-set-mode") {
          this.setMode(t.value);
        } else if (t.id === "v2-set-units") {
          this.setUnits(t.value);
        }
      });

      document.addEventListener("input", (e) => {
        const t = e.target;
        if (t.id === "v2-lay-q") {
          this.layerFilter = t.value;
          this.renderActiveViews();
          const f = document.getElementById("v2-lay-q");
          if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
        } else if (t.id === "v2-op-rng") {
          this.layerOpacity = Number(t.value) / 100;
          window.V2Map.updateLayersOpacity(this.layerOpacity);
        } else if (t.id === "v2-curtain-rng") {
          this.curtainPct = Number(t.value);
          window.V2Map.applyCurtainClip();
        } else if (t.id === "v2-time-rng") {
          this.timeOffsetDays = Number(t.value);
          this.layerDate = "";
          window.V2Map.updateTimeDimension();
        } else if (t.id === "v2-scen-rain") {
          this.scenRainPct = Number(t.value);
          this.renderActiveViews();
        } else if (t.id === "v2-scen-temp") {
          this.scenTempC = Number(t.value);
          this.renderActiveViews();
        } else if (t.id === "v2-cat-q") {
          this.catFilter.q = t.value;
          this.catFilter.limit = 60;
          this.renderActiveViews();
          const f = document.getElementById("v2-cat-q");
          if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
        } else if (t.id === "v2-gl-q") {
          const q = t.value.toLowerCase();
          document.querySelectorAll(".v2-gl-item").forEach(it => {
            it.style.display = it.textContent.toLowerCase().includes(q) ? "" : "none";
          });
        } else if (t.id === "v2-inp-n" || t.id === "v2-inp-ph") {
          this.farmExtra.nKgHa = document.getElementById("v2-inp-n")?.value || "";
          this.farmExtra.phVal = document.getElementById("v2-inp-ph")?.value || "";
          const msgEl = document.getElementById("v2-npk-msg");
          if (msgEl) {
            const nV = this.farmExtra.nKgHa !== "" ? Number(this.farmExtra.nKgHa) : null;
            const phV = this.farmExtra.phVal !== "" ? Number(this.farmExtra.phVal) : null;
            const parts = [];
            if (nV != null) {
              parts.push(nV < 40 ? `Nitrógeno bajo (${nV} kg/ha): rotar con leguminosa fijadora (+50 a +90 kg N/ha).` : nV <= 150 ? `Nitrógeno adecuado (${nV} kg/ha).` : `Nitrógeno alto (${nV} kg/ha): evitar sobre-fertilización.`);
            }
            if (phV != null) {
              parts.push(phV < 5.6 ? `pH ácido (${phV}): considerar encalado.` : phV <= 7.3 ? `pH óptimo (${phV}) según USDA NRCS.` : `pH alcalino (${phV}): preferir sorgo/alfalfa/cebada.`);
            }
            msgEl.textContent = parts.join(" · ") || "Rango USDA NRCS: pH óptimo 6.0–7.0.";
          }
        }
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          if (this.modal) this.closeModal();
          else if (this.tourStep >= 0) this.startTour(-1);
          else if (this.sheetSnap === "max") {
            this.sheetSnap = "mid";
            const sheet = document.getElementById("v2-sheet");
            if (sheet) sheet.dataset.snap = "mid";
          }
        }
      });

      // Arrastre táctil y con ratón en la barra superior de la hoja inferior
      const handle = document.getElementById("v2-sheet-handle");
      if (handle) {
        let startY = null;
        handle.addEventListener("pointerdown", (e) => {
          if (e.target.closest("button")) return;
          startY = e.clientY;
        });
        window.addEventListener("pointerup", (e) => {
          if (startY == null) return;
          const dy = e.clientY - startY;
          startY = null;
          if (Math.abs(dy) < 24) return;
          const order = ["min", "mid", "max"];
          const idx = order.indexOf(this.sheetSnap);
          const next = dy < 0 ? Math.min(2, idx + 1) : Math.max(0, idx - 1);
          this.sheetSnap = order[next];
          const sheet = document.getElementById("v2-sheet");
          if (sheet) sheet.dataset.snap = this.sheetSnap;
        });
      }
    },

    toggleTimePlay() {
      if (this.playTimer) {
        clearInterval(this.playTimer);
        this.playTimer = null;
        this.renderActiveViews();
        return;
      }
      this.playTimer = setInterval(() => {
        this.timeOffsetDays += 7;
        if (this.timeOffsetDays > 0) this.timeOffsetDays = -84;
        this.layerDate = "";
        window.V2Map.updateTimeDimension();
        const rng = document.getElementById("v2-time-rng");
        if (rng) rng.value = String(this.timeOffsetDays);
      }, 1400);
      this.renderActiveViews();
    }
  };

  ["renderActiveViews", "renderModal", "renderShellChrome"].forEach(n => {
    const f = V2[n];
    V2[n] = function (...a) { const r = f.apply(this, a); Promise.resolve(r).then(() => window.traducirDom && window.traducirDom()); return r; };
  });
  window.V2 = V2;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => V2.init());
  } else {
    V2.init();
  }
})();
