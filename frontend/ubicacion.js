// =============================================================================
// Field Shift v2 (Cápsula E) — Módulo de Ubicación y Cultivo (Pantalla 2)
// Cumple con la sección 2.2:
// - Todo en una sola pantalla, con el mapa satelital interactivo a la vista.
// - 8 campos integrados:
//   1. Buscar lugar (geocode con lista de sugerencias)
//   2. Coordenadas (grados decimales o DMS, pegado en 1 caja, validación -90..90, -180..180)
//   3. "Usar mi ubicación" (GPS real con manejo de permisos)
//   4. Clic o arrastre en el mapa para ajustar punto
//   5. Comunidad / Localidad y País (autocompletado editable)
//   6. Terreno (dibujar polígono, sección BLM PLSS, campo OSM, importar GeoJSON/KML) + Hectáreas
//   7. Tipo de cultivo actual y cultivo anterior
//   8. Nombre del terreno
// - Avisos obligatorios: Fuera de EE. UU. y Terreno > 500 ha
// - Botón "Continuar" desactivado hasta tener punto, nombre y cultivo
// - Guarda con POST /api/v1/terrenos vía V2Adapter
// =============================================================================

(function () {
  "use strict";

  const CULTIVOS_OPTS = [
    { id: "maiz", es: "Maíz", en: "Corn / Maize", pt: "Milho" },
    { id: "soya", es: "Soya", en: "Soybeans", pt: "Soja" },
    { id: "trigo", es: "Trigo", en: "Wheat", pt: "Trigo" },
    { id: "alfalfa", es: "Alfalfa", en: "Alfalfa", pt: "Alfafa" },
    { id: "pastizal", es: "Pastizal / Forraje", en: "Pasture / Grass", pt: "Pastagem" },
    { id: "hortalizas", es: "Hortalizas / Vegetales", en: "Vegetables", pt: "Hortaliças" },
    { id: "otro", es: "Otro cultivo", en: "Other crop", pt: "Outro cultivo" },
    { id: "descanso", es: "Nada / En descanso (barbecho)", en: "Fallow / Bare soil", pt: "Pousio / Sem cultivo" }
  ];

  const V2Ubicacion = {
    form: {
      nombre: "",
      lat: null,
      lon: null,
      localidad: "",
      pais: "",
      cultivo_actual: "",
      cultivo_anterior: "",
      hectareas: 0,
      poligono: null
    },
    coordsInputRaw: "",
    geoResults: [],
    geoSearching: false,

    abrirPantalla() {
      // Solo abre el formulario; no cambia de sección.
      window.V2.openModal("ubicacion");
    },

    // Parsea coordenadas decimales o DMS ("41°37'16.68\"N, 93°53'49.56\"W" o "41.6213, -93.8971")
    parsearCoordenadas(str) {
      if (!str) return null;
      const s = str.trim();

      // Caso 1: Decimal simple "lat, lon" o "lat lon"
      const decMatch = s.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
      if (decMatch) {
        const lat = parseFloat(decMatch[1]);
        const lon = parseFloat(decMatch[2]);
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          return { lat, lon };
        }
      }

      // Caso 2: Grados, Minutos, Segundos (DMS)
      function dmsToDec(d, m, s, dir) {
        let dec = parseFloat(d) + (parseFloat(m || 0) / 60) + (parseFloat(s || 0) / 3600);
        if (dir === "S" || dir === "W" || dir === "O") dec = -dec;
        return dec;
      }
      const dmsRegex = /(\d+)[°\s]+(\d+)['\s]+([\d.]+)?["\s]*([NSEWO])[,\s]+(\d+)[°\s]+(\d+)['\s]+([\d.]+)?["\s]*([NSEWO])/i;
      const dmsMatch = s.match(dmsRegex);
      if (dmsMatch) {
        const lat = dmsToDec(dmsMatch[1], dmsMatch[2], dmsMatch[3], dmsMatch[4].toUpperCase());
        const lon = dmsToDec(dmsMatch[5], dmsMatch[6], dmsMatch[7], dmsMatch[8].toUpperCase());
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          return { lat, lon };
        }
      }

      return null;
    },

    renderPanelHtml() {
      const lang = window.V2?.lang || "es";
      const f = this.form;
      const lat = f.lat != null ? f.lat : (window.V2?.loc?.lat ?? null);
      const lon = f.lon != null ? f.lon : (window.V2?.loc?.lon ?? null);
      const isOutsideUS = lat != null && lon != null && !window.V2.inUS(lat, lon);
      const ha = f.hectareas || (window.V2?.terrainResp?.area_ha) || 0;
      const isOverMaxHa = ha > 500;

      // Validación de completitud: requiere nombre, punto válido y cultivo
      const isComplete = !!(f.nombre && f.nombre.trim() && f.cultivo_actual && lat != null && lon != null && !isOverMaxHa);

      return `
        <div class="modal-card ubic-card ubicacion-flow-card" role="dialog" aria-modal="true" aria-label="Ubicación y cultivo del terreno">
          <div class="row-between" style="margin-bottom:8px">
            <h2 class="card-title" style="margin:0">${window.ic("map", "sm")} <span>${lang === "en" ? "Field location & crop" : lang === "pt" ? "Localização e cultura" : "Ubicación y cultivo de tu terreno"}</span></h2>
            <button type="button" class="btn btn-txt btn-sm" data-close-modal="1" aria-label="Cerrar">✕</button>
          </div>

          <p class="small mut" style="margin:0 0 12px">
            ${lang === "en"
              ? "All in one screen. Move the map, search a town, or use GPS to set your field boundaries."
              : lang === "pt"
              ? "Tudo em uma única tela. Mova o mapa, busque um lugar ou use GPS para marcar seu terreno."
              : "Todo en una sola pantalla. Mueve el mapa, busca una localidad o usa tu GPS para delimitar tu terreno."}
          </p>

          <!-- 1. BUSCADOR DE LUGAR -->
          <div class="field-group" style="margin-bottom:10px">
            <label class="small"><b>1. ${lang === "en" ? "Search place" : lang === "pt" ? "Buscar lugar" : "Buscar lugar (municipio, comunidad o dirección)"}</b></label>
            <div class="search-bar" style="max-width:100%;margin-top:4px">
              ${window.ic("search", "sm")}
              <input type="search" id="v2-ub-search-q" placeholder="${lang === "en" ? "E.g. Ames, Iowa or Zamora, Michoacán" : "Ej. Ames, Iowa o Zamora, Michoacán"}" value="" autocomplete="off">
              <button type="button" class="btn btn-pri btn-sm" id="v2-btn-ub-buscar">${lang === "en" ? "Find" : "Buscar"}</button>
            </div>
            <div id="v2-ub-geo-list" class="geo-sugg-list" style="margin-top:4px"></div>
          </div>

          <!-- 2 y 3. COORDENADAS + USAR MI UBICACIÓN (GPS) -->
          <div class="grid-2" style="margin-bottom:10px">
            <div class="field-group">
              <label class="small">
                <b>2. ${lang === "en" ? "Coordinates" : "Coordenadas (decimal o DMS)"}</b>
                <input type="text" id="v2-ub-coords" class="field" value="${window.esc(this.coordsInputRaw)}" placeholder="41.6213, -93.8971" style="width:100%;margin-top:4px">
              </label>
              <div class="xs mut" style="margin-top:2px">${lang === "en" ? "Lat -90..90, Lon -180..180" : "Acepta pegado directo o grados-minutos-segundos"}</div>
            </div>

            <div class="field-group" style="display:flex;flex-direction:column;justify-content:flex-end">
              <button type="button" class="btn btn-sec" id="v2-btn-ub-gps" style="min-height:44px;width:100%">
                ${window.ic("gps", "sm")} <span>${lang === "en" ? "Use my device GPS" : "Usar mi ubicación (GPS real)"}</span>
              </button>
            </div>
          </div>

          <!-- 5. LOCALIDAD Y PAÍS -->
          <div class="grid-2" style="margin-bottom:10px">
            <label class="small">
              <b>5. ${lang === "en" ? "Community / Town" : "Comunidad / Localidad"}</b>
              <input type="text" id="v2-ub-localidad" class="field" value="${window.esc(f.localidad)}" placeholder="Ej. Ames, Story County" style="width:100%;margin-top:4px">
            </label>
            <label class="small">
              <b>${lang === "en" ? "Country code" : "País"}</b>
              <input type="text" id="v2-ub-pais" class="field" value="${window.esc(f.pais)}" placeholder="US" maxlength="2" style="width:100%;margin-top:4px;text-transform:uppercase">
            </label>
          </div>

          <!-- 6. TERRENO Y FORMAS DE ADOPCIÓN -->
          <div class="card-sub" style="margin-bottom:12px">
            <div class="row-between" style="margin-bottom:6px">
              <span class="small" style="font-weight:700">6. ${lang === "en" ? "Delimit field boundary" : "Delimitar terreno"}</span>
              <span class="chip" style="font-weight:700">${ha > 0 ? ha.toFixed(1) + " ha" : "Sin polígono"}</span>
            </div>
            <div class="row-wrap" style="gap:6px">
              <button type="button" class="btn btn-pri btn-sm" id="v2-ub-btn-draw">${window.ic("draw", "sm")} <span>${lang === "en" ? "Draw on map" : "Dibujar en mapa"}</span></button>
              <button type="button" class="btn btn-sec btn-sm" id="v2-ub-btn-plss">${window.ic("map", "sm")} <span>BLM PLSS (259 ha)</span></button>
              <button type="button" class="btn btn-sec btn-sm" id="v2-ub-btn-osm">${window.ic("leaf", "sm")} <span>OpenStreetMap</span></button>
              <button type="button" class="btn btn-sec btn-sm" id="v2-ub-btn-import">${window.ic("upload", "sm")} <span>GeoJSON / KML</span></button>
              <input type="file" id="v2-ub-file-geo" accept=".geojson,.json,.kml" hidden>
            </div>
          </div>

          <!-- 7 y 8. CULTIVOS Y NOMBRE -->
          <div class="grid-2" style="margin-bottom:12px">
            <label class="small">
              <b>7. ${lang === "en" ? "Current crop" : "Cultivo actual *"}</b>
              <select id="v2-ub-cultivo-act" class="field" style="width:100%;margin-top:4px">
                <option value="">${lang === "en" ? "Choose…" : lang === "pt" ? "Escolha…" : "Elige…"}</option>
                ${CULTIVOS_OPTS.map(c => `<option value="${c.id}" ${f.cultivo_actual === c.id ? "selected" : ""}>${window.esc(c[lang] || c.es)}</option>`).join("")}
              </select>
            </label>
            <label class="small">
              <b>${lang === "en" ? "Previous crop (optional)" : "Cultivo anterior (opcional)"}</b>
              <select id="v2-ub-cultivo-ant" class="field" style="width:100%;margin-top:4px">
                <option value="">${lang === "en" ? "None / unknown" : "Ninguno / desconocido"}</option>
                ${CULTIVOS_OPTS.map(c => `<option value="${c.id}" ${f.cultivo_anterior === c.id ? "selected" : ""}>${window.esc(c[lang] || c.es)}</option>`).join("")}
              </select>
            </label>
          </div>

          <div class="field-group" style="margin-bottom:14px">
            <label class="small">
              <b>8. ${lang === "en" ? "Field name *" : "Nombre del terreno *"}</b>
              <input type="text" id="v2-ub-nombre" class="field" value="${window.esc(f.nombre)}" placeholder="Ej. Lote La Nopalera Norte" style="width:100%;margin-top:4px">
            </label>
          </div>

          <!-- AVISOS OBLIGATORIOS -->
          ${isOutsideUS ? `
            <div class="notice atencion" style="margin-bottom:12px">
              ${window.ic("atencion", "sm")}
              <div class="small">
                <b>${lang === "en" ? "Coverage note:" : "Aviso de cobertura:"}</b>
                ${lang === "en"
                  ? "Some detailed US-only layers (SSURGO soil, CDL crop labels, PLSS sections) do not have coverage here. You will see global NASA POWER weather and satellite imagery."
                  : "Algunas capas (suelo detallado SSURGO, etiquetas de cultivo CDL, secciones PLSS) no tienen cobertura fuera de EE. UU. Verás lo que sí hay: clima NASA POWER e imágenes satelitales."}
              </div>
            </div>
          ` : ""}

          ${isOverMaxHa ? `
            <div class="notice riesgo" style="margin-bottom:12px">
              ${window.ic("riesgo", "sm")}
              <div class="small">
                <b>${lang === "en" ? "Field exceeds 500 ha limit" : "Terreno mayor a 500 hectáreas:"}</b>
                ${lang === "en" ? "Please draw or select a smaller field to avoid satellite timeout." : "Por favor delimita un lote menor a 500 ha para garantizar procesamiento satelital rápido."}
              </div>
            </div>
          ` : ""}

          <!-- BOTÓN CONTINUAR (Desactivado hasta tener punto, nombre y cultivo) -->
          <div class="row-between" style="margin-top:16px;padding-top:12px;border-top:1px solid var(--linea)">
            <button type="button" class="btn btn-txt btn-sm" data-close-modal="1">${lang === "en" ? "Cancel" : "Cancelar"}</button>
            <button type="button" class="btn btn-pri" id="v2-btn-ub-continuar" ${!isComplete ? "disabled" : ""} style="min-height:46px;padding:0 24px">
              <span>${lang === "en" ? "Save & Continue →" : "Guardar y Continuar →"}</span>
            </button>
          </div>
        </div>
      `;
    },

    bindEvents() {
      document.addEventListener("click", async (e) => {
        if (e.target.closest("#v2-btn-ub-gps")) {
          window.V2.useGps();
          return;
        }

        if (e.target.closest("#v2-btn-ub-buscar")) {
          const q = document.getElementById("v2-ub-search-q")?.value || "";
          this.ejecutarGeocode(q);
          return;
        }

        const geoItem = e.target.closest("[data-geo-pick]");
        if (geoItem) {
          const [lat, lon] = geoItem.dataset.geoPick.split(",").map(Number);
          const dir = geoItem.dataset.geoDir || "";
          this.form.lat = lat;
          this.form.lon = lon;
          this.form.localidad = dir;
          this.coordsInputRaw = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
          window.V2.selectPlace(lat, lon, "sim", dir); // cierra la ventana: se vuelve a abrir para seguir llenando el formulario
          window.V2.openModal("ubicacion");
          return;
        }

        if (e.target.closest("#v2-ub-btn-draw")) {
          window.V2.closeModal();
          window.V2.openSheetTab("terrain", "min");
          window.V2Map.startDraw();
          this.mostrarBarraDibujo();
          return;
        }

        if (e.target.closest("#v2-ub-btn-plss")) {
          await window.V2Map.adoptPlssSection(this.form.lat, this.form.lon);
          this.actualizarHectareasDesdeMapa();
          if (window.V2?.modal === "ubicacion") window.V2.renderModal();
          return;
        }

        if (e.target.closest("#v2-ub-btn-osm")) {
          await window.V2Map.loadOsmFields();
          this.actualizarHectareasDesdeMapa();
          if (window.V2?.modal === "ubicacion") window.V2.renderModal();
          return;
        }

        if (e.target.closest("#v2-ub-btn-import")) {
          document.getElementById("v2-ub-file-geo")?.click();
          return;
        }

        if (e.target.closest("#v2-btn-ub-continuar")) {
          this.guardarYContinuar();
          return;
        }
      });

      document.addEventListener("input", (e) => {
        if (e.target.id === "v2-ub-coords") {
          this.coordsInputRaw = e.target.value;
          const parsed = this.parsearCoordenadas(e.target.value);
          if (parsed) {
            this.form.lat = parsed.lat;
            this.form.lon = parsed.lon;
            window.V2Map.setLocationMarker(parsed.lat, parsed.lon, "sim", this.form.localidad);
            this.actualizarBotonContinuar();
          }
        } else if (e.target.id === "v2-ub-nombre") {
          this.form.nombre = e.target.value;
          this.actualizarBotonContinuar();
        } else if (e.target.id === "v2-ub-localidad") {
          this.form.localidad = e.target.value;
        } else if (e.target.id === "v2-ub-pais") {
          this.form.pais = e.target.value.toUpperCase();
        } else if (e.target.id === "v2-ub-cultivo-act") {
          this.form.cultivo_actual = e.target.value;
          this.actualizarBotonContinuar();
        } else if (e.target.id === "v2-ub-cultivo-ant") {
          this.form.cultivo_anterior = e.target.value;
        }
      });

      document.addEventListener("change", (e) => {
        if (e.target.id === "v2-ub-file-geo") {
          const file = e.target.files?.[0];
          if (file) {
            window.V2Map.importGeoFile(file);
            setTimeout(() => {
              this.actualizarHectareasDesdeMapa();
              if (window.V2?.modal === "ubicacion") window.V2.renderModal();
            }, 500);
          }
        }
      });
    },

    // Mientras se dibuja el formulario se oculta; esta barra permite cancelar y volver a él.
    mostrarBarraDibujo() {
      this.dibujando = true;
      document.getElementById("v2-draw-bar")?.remove();
      const lang = window.V2?.lang || "es";
      const bar = document.createElement("div");
      bar.id = "v2-draw-bar";
      bar.className = "draw-bar";
      bar.innerHTML = `<span>${lang === "en" ? "Click on the map to mark each corner. Close the shape on the first point." : lang === "pt" ? "Clique no mapa para marcar cada canto. Feche a forma no primeiro ponto." : "Toca el mapa para marcar cada esquina. Cierra la figura en el primer punto."}</span><button type="button" class="btn btn-sec btn-sm" id="v2-draw-cancel">${lang === "en" ? "Cancel" : "Cancelar"}</button>`;
      document.body.appendChild(bar);
      bar.querySelector("#v2-draw-cancel").onclick = () => {
        try { window.V2Map.drawer?.disable(); } catch (_) {}
        this.volverTrasDibujo();
      };
    },

    volverTrasDibujo() {
      document.getElementById("v2-draw-bar")?.remove();
      if (!this.dibujando) return;
      this.dibujando = false;
      this.actualizarHectareasDesdeMapa();
      window.V2.modal = "ubicacion";
      window.V2.renderModal();
    },

    actualizarHectareasDesdeMapa() {
      const resp = window.V2?.terrainResp;
      if (resp && resp.area_ha) {
        this.form.hectareas = resp.area_ha;
      }
      if (window.V2Map?.poly) {
        this.form.poligono = window.V2Map.poly.getLatLngs()[0].map(p => [Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))]);
      }
      this.actualizarBotonContinuar();
    },

    actualizarBotonContinuar() {
      const btn = document.getElementById("v2-btn-ub-continuar");
      if (!btn) return;
      const f = this.form;
      const isComplete = !!(f.nombre && f.nombre.trim() && f.cultivo_actual && f.lat != null && f.lon != null && f.hectareas <= 500);
      btn.disabled = !isComplete;
    },

    async ejecutarGeocode(q) {
      if (!q || q.trim().length < 2) return;
      const outList = document.getElementById("v2-ub-geo-list");
      if (outList) outList.innerHTML = `<div class="xs mut">Buscando «${window.esc(q)}»…</div>`;
      try {
        const res = await fetch(`/api/v1/geocode?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        if (data && data.lat != null && data.lon != null) {
          outList.innerHTML = `
            <button type="button" class="btn btn-sec btn-sm" data-geo-pick="${data.lat},${data.lon}" data-geo-dir="${window.esc(data.direccion || q)}" style="width:100%;text-align:left;justify-content:flex-start">
              ${window.ic("map", "sm")} <span><b>${window.esc(data.direccion || q)}</b> (${data.lat.toFixed(4)}, ${data.lon.toFixed(4)})</span>
            </button>
          `;
        } else {
          outList.innerHTML = `<div class="xs atencion">No se encontró esa localidad. Intenta con municipio o código postal.</div>`;
        }
      } catch (err) {
        if (outList) outList.innerHTML = `<div class="xs riesgo">Error al consultar geocodificación.</div>`;
      }
    },

    async guardarYContinuar() {
      window.V2.startProgress("Guardando terreno…");
      try {
        const payload = {
          nombre: this.form.nombre || "Mi Parcela",
          lat: this.form.lat,
          lon: this.form.lon,
          localidad: this.form.localidad || "",
          pais: this.form.pais || "US",
          cultivo_actual: this.form.cultivo_actual || "maiz",
          cultivo_anterior: this.form.cultivo_anterior || "",
          hectareas: this.form.hectareas || 0, // el servidor calcula la superficie real del polígono
          poligono: this.form.poligono || (window.V2Map.poly ? window.V2Map.poly.getLatLngs()[0].map(p => [p.lat, p.lng]) : null)
        };

        const saved = await window.V2Adapter.guardarTerreno(payload);
        window.V2.closeModal();
        window.V2.showToast(`Terreno «${saved.nombre}» guardado (${saved.hectareas != null ? saved.hectareas.toFixed(1) + " ha" : ""}).`, 4000);

        // Actualizar estado global con el terreno guardado
        window.V2.selectPlace(saved.lat, saved.lon, "real", saved.nombre);
        if (window.V2.loc) window.V2.loc.id = saved.id;
        if (saved.poligono && window.V2Map) {
          window.V2Map.setPolygonCoords(saved.poligono, saved.nombre);
        }

        // Tras guardar el terreno, ir directamente al mapa satelital interactivo (antes del robot)
        window.V2.setSpace("mapa");
        window.V2.setSheetSnap?.("min");
        window.V2Map.analyzeTerrain();
      } catch (err) {
        window.V2.showToast("Error al guardar terreno: " + err.message, 4500);
      } finally {
        window.V2.stopProgress();
      }
    }
  };

  window.V2Ubicacion = V2Ubicacion;
  V2Ubicacion.bindEvents();
})();

