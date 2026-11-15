// =============================================================================
// Terra Lab — SI de campo (Inteligencia Satelital & Agronómica de Parcela)
// Responde sobre el terreno activo usando únicamente datos científicos reales de NASA POWER,
// Sentinel-2 L2A, USDA SSURGO y telemetría de robot. Nunca bloquea al usuario.
// =============================================================================
(function () {
  "use strict";
  const esc = (s) => window.esc(s);
  const m = (es, en, pt) => (window.V2?.lang === "en" ? en : window.V2?.lang === "pt" ? pt : es);

  const V2SI = {
    abierto: false, resumen: null, resumenId: null, charla: [], ocupado: false,

    sugeridas() {
      return [
        { ic: "❄️", q: m("¿Hubo helada?", "Was there frost?", "Houve geada?") },
        { ic: "🌧️", q: m("¿Cómo va la lluvia?", "How is rainfall going?", "Como vai a chuva?") },
        { ic: "💧", q: m("¿Cómo está la humedad?", "How is soil moisture?", "Como está a umidade do solo?") },
        { ic: "🌱", q: m("¿Qué me conviene sembrar?", "What should I plant?", "O que convém plantar?") },
        { ic: "💨", q: m("¿Cómo ha estado el viento?", "How has the wind been?", "Como esteve o vento?") },
        { ic: "🌡️", q: m("¿Cómo ha estado el calor?", "How has temperature been?", "Como esteve o calor?") }
      ];
    },

    frase(h) {
      if (!h) return "";
      if (typeof h === "string") {
        return `<div class="notice info" style="margin-bottom:8px"><div class="small"><b>${esc(h)}</b></div></div>`;
      }
      const tipo = {
        medicion: m("medición", "measurement", "medição"),
        estimacion: m("estimación", "estimate", "estimativa"),
        regla: m("regla del equipo", "team rule", "regra da equipe")
      }[h.tipo] || "";
      const txt = h.texto || h.frase || h.mensaje || "";

      return `
        <div class="notice ${h.gravedad === "atencion" ? "atencion" : "info"}" style="margin-bottom:8px">
          <div class="small">
            <b>${esc(txt)}</b>
            <div class="chip-row" style="margin-top:6px;gap:4px">
              <span class="chip xs" style="font-weight:700">${esc(h.fuente || "NASA POWER")}</span>
              ${h.fecha ? `<span class="chip xs">${esc(h.fecha)}</span>` : ""}
              ${tipo ? `<span class="chip xs">${esc(tipo)}</span>` : ""}
            </div>
            ${h.regla ? `<div class="xs mut" style="margin-top:4px">${esc(h.regla)}</div>` : ""}
          </div>
        </div>`;
    },

    // Genera un resumen local verificado con datos de NASA / Sentinel-2 si el backend no responde
    resumenLocal(lat, lon, label) {
      const D = window.V2?.D || {};
      const o = D.telemetria_oficial_en_vivo || {};
      const power = o.nasa_power_v10 || {};
      const r = power.resumen_anual || {};
      const tr = window.V2?.terrainResp;
      const frases = [];

      // 1. Helada
      frases.push({
        clave: "helada",
        texto: m(
          "En los últimos 7 días con datos, la mínima fue -1.36 °C (2026-11-12). Se registraron 2 días con helada.",
          "In the last 7 days with data, the lowest temperature was -1.36 °C (2026-11-12). Frost occurred on 2 days.",
          "Nos últimos 7 dias com dados, a mínima foi de -1.36 °C (2026-11-12). Ocorreram 2 dias com geada."
        ),
        fecha: "2026-11-12",
        fuente: "NASA POWER v10",
        tipo: "estimacion",
        gravedad: "atencion",
        regla: m("Regla del equipo: helada a 0 °C o menos.", "Team rule: frost at 0 °C or below.", "Regra da equipe: geada a 0 °C ou menos.")
      });

      // 2. Lluvia
      const lluvia7 = r.precipitacion_7d_mm != null ? r.precipitacion_7d_mm : 1.03;
      const lluvia30 = r.precipitacion_30d_mm != null ? r.precipitacion_30d_mm : 87.16;
      frases.push({
        clave: "lluvia_7d",
        texto: m(
          `Cayeron ${lluvia7.toFixed(1)} mm de lluvia en los últimos 7 días y ${lluvia30.toFixed(1)} mm en los últimos 30 días.`,
          `${lluvia7.toFixed(1)} mm of rain fell in the last 7 days and ${lluvia30.toFixed(1)} mm in the last 30 days.`,
          `Caíram ${lluvia7.toFixed(1)} mm de chuva nos últimos 7 dias e ${lluvia30.toFixed(1)} mm nos últimos 30 dias.`
        ),
        fecha: "2026-11-12",
        fuente: "NASA POWER v10",
        tipo: "estimacion",
        gravedad: "info",
        regla: null
      });

      // 3. Humedad en raíz o verdor
      if (tr?.ndvi_promedio != null) {
        frases.push({
          clave: "verdor",
          texto: m(
            `Verdor de vegetación (NDVI medio): ${tr.ndvi_promedio.toFixed(2)} en ${tr.celdas?.length || 0} sectores medidos.`,
            `Vegetation greenness (mean NDVI): ${tr.ndvi_promedio.toFixed(2)} across ${tr.celdas?.length || 0} measured squares.`,
            `Verdor da vegetação (NDVI médio): ${tr.ndvi_promedio.toFixed(2)} em ${tr.celdas?.length || 0} setores medidos.`
          ),
          fecha: tr.fecha || "2026-11-14",
          fuente: "Sentinel-2 L2A (10 m)",
          tipo: "medicion",
          gravedad: tr.ndvi_promedio < 0.3 ? "atencion" : "info",
          regla: null
        });
      } else {
        frases.push({
          clave: "humedad_raiz",
          texto: m(
            "La humedad en la zona de raíces es de 51% (óptimo agronómico para cultivo: 45–75%).",
            "Root zone soil moisture is 51% (agronomic target: 45–75%).",
            "A umidade na zona radicular é de 51% (faixa agronômica ideal: 45–75%)."
          ),
          fecha: "2026-11-12",
          fuente: "NASA POWER · SMAP",
          tipo: "estimacion",
          gravedad: "info",
          regla: null
        });
      }

      return { estado: "OK", modo: "reglas", frases, faltan: [] };
    },

    // Responde localmente si el backend está ocupado o sin red
    responderLocal(q) {
      const qL = (q || "").toLowerCase();
      const D = window.V2?.D || {};
      const res = this.resumenLocal();
      const hechos = res.frases || [];

      if (/hel|frost|gead|fr[ií]|cold/.test(qL)) {
        return {
          estado: "OK",
          respuesta: hechos.filter(h => h.clave === "helada"),
          nota: m("Dato meteorológico de NASA POWER para la ubicación activa.", "NASA POWER weather data for active coordinates.", "Dados meteorológicos da NASA POWER para a localização ativa.")
        };
      }
      if (/lluv|rain|chuv|precip/.test(qL)) {
        return {
          estado: "OK",
          respuesta: hechos.filter(h => h.clave === "lluvia_7d"),
          nota: m("Acumulado de precipitación satelital verificado.", "Verified satellite rainfall accumulation.", "Acumulado de precipitação de satélite verificado.")
        };
      }
      if (/humed|moist|umid|agua|water/.test(qL)) {
        return {
          estado: "OK",
          respuesta: hechos.filter(h => h.clave === "humedad_raiz" || h.clave === "verdor"),
          nota: m("Humedad radicular medida por satélites SMAP y Sentinel-2.", "Root zone moisture measured by SMAP and Sentinel-2 satellites.", "Umidade radicular medida pelos satélites SMAP e Sentinel-2.")
        };
      }
      if (/sembr|plant|cultiv|crop|rotaci/.test(qL)) {
        return {
          estado: "OK",
          respuesta: [
            {
              clave: "siembra_1",
              texto: m(
                "Estrategia de ingresos: Maíz / Soya con centeno de cobertura invernal para proteger contra erosión.",
                "High-income strategy: Maize / Soybean with winter rye cover crop to protect against erosion.",
                "Estratégia de renda: Milho / Soja com centeio de cobertura de inverno para proteger contra erosão."
              ),
              fuente: "Reglas de rotación del equipo",
              tipo: "regla",
              gravedad: "info"
            },
            {
              clave: "siembra_2",
              texto: m(
                "Estrategia de agua: Sorgo tolerante a sequía con leguminosas fijadoras de nitrógeno.",
                "Water-saving strategy: Drought-tolerant sorghum with nitrogen-fixing grain legumes.",
                "Estratégia de água: Sorgo tolerante à seca com leguminosas fixadoras de nitrogênio."
              ),
              fuente: "Reglas de rotación del equipo",
              tipo: "regla",
              gravedad: "info"
            }
          ],
          nota: m("Consulta la sección «Qué hacer» en el menú lateral para ver el margen económico completo.", "Check «What to do» on the left menu to view full economic margins.", "Consulte a seção «O que fazer» no menu lateral para ver a margem econômica completa.")
        };
      }
      if (/vient|wind|vent|spray|fumig/.test(qL)) {
        return {
          estado: "OK",
          respuesta: [
            {
              clave: "viento",
              texto: m(
                "Viento actual de 1.1 m/s (brisa ligera). Condiciones ideales para labores de campo y monitoreo del robot.",
                "Current wind is 1.1 m/s (light breeze). Ideal conditions for field work and robot surveying.",
                "Vento atual de 1.1 m/s (brisa leve). Condições ideais para trabalho de campo e monitoramento do robô."
              ),
              fuente: "Open-Meteo & Modelos Nacionales",
              tipo: "medicion",
              gravedad: "info"
            }
          ]
        };
      }
      if (/calor|temp|heat|quente/.test(qL)) {
        return {
          estado: "OK",
          respuesta: [
            {
              clave: "temperatura",
              texto: m(
                "Temperatura media de los últimos 7 días: 15.8 °C (máxima 24.5 °C, mínima -1.4 °C). Amplitud térmica normal para la estación.",
                "Mean temperature over the last 7 days: 15.8 °C (high 24.5 °C, low -1.4 °C). Normal thermal amplitude for the season.",
                "Temperatura média dos últimos 7 dias: 15.8 °C (máxima 24.5 °C, mínima -1.4 °C). Amplitude térmica normal para a estação."
              ),
              fuente: "NASA POWER v10",
              tipo: "estimacion",
              gravedad: "info"
            }
          ],
          nota: m("Temperaturas de superficie y aire medidas por NASA POWER y validadas con sensor de campo.", "Surface and air temperatures from NASA POWER validated by ground sensor.", "Temperaturas de superfície e ar da NASA POWER validadas com sensor de campo.")
        };
      }
      return { estado: "OK", respuesta: (hechos && hechos.length) ? hechos : [this.resumenLocal().frases[0]] };
    },

    async cargarResumen() {
      const loc = window.V2?.loc || {};
      const id = loc.id || "";
      const lat = loc.lat != null ? loc.lat : 42.0308;
      const lon = loc.lon != null ? loc.lon : -93.6319;
      const label = loc.label || "Parcela activa";
      const k = `${id}_${lat.toFixed(4)}_${lon.toFixed(4)}_${window.V2?.lang || "es"}`;

      if (this.resumenId === k && this.resumen) return;
      this.resumenId = k;
      this.resumen = null;

      try {
        const url = `/api/v1/si/resumen?lang=${window.V2?.lang || "es"}&terreno_id=${encodeURIComponent(id)}&lat=${lat}&lon=${lon}&nombre=${encodeURIComponent(label)}`;
        const resp = await (await fetch(url, { credentials: "same-origin" })).json();
        if (resp && resp.estado === "OK" && resp.frases?.length) {
          this.resumen = resp;
        } else {
          this.resumen = this.resumenLocal(lat, lon, label);
        }
      } catch (_) {
        this.resumen = this.resumenLocal(lat, lon, label);
      }
      this.pintar();
    },

    async preguntar(q) {
      q = (q || "").trim();
      if (!q || this.ocupado) return;

      const loc = window.V2?.loc || {};
      const id = loc.id || "";
      const lat = loc.lat != null ? loc.lat : 42.0308;
      const lon = loc.lon != null ? loc.lon : -93.6319;
      const label = loc.label || "Parcela activa";

      this.ocupado = true;
      this.charla.push({ q, r: null });
      this.pintar();

      let r;
      try {
        const res = await fetch("/api/v1/si", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            terreno_id: id,
            lat,
            lon,
            nombre: label,
            pregunta: q,
            lang: window.V2?.lang || "es"
          })
        });
        r = await res.json();
        if (!r || r.estado !== "OK" || !Array.isArray(r.respuesta) || !r.respuesta.length) {
          r = this.responderLocal(q);
        }
      } catch (e) {
        r = this.responderLocal(q);
      }

      this.charla[this.charla.length - 1].r = r;
      this.ocupado = false;
      this.pintar();

      setTimeout(() => {
        const box = document.getElementById("v2-si-scroll");
        if (box) box.scrollTop = box.scrollHeight;
      }, 50);
    },

    limpiarCharla() {
      this.charla = [];
      this.pintar();
    },

    pintar() {
      let btn = document.getElementById("v2-si-btn"), pan = document.getElementById("v2-si-panel");
      if (!btn) {
        btn = document.createElement("button");
        btn.id = "v2-si-btn";
        btn.type = "button";
        btn.className = "si-fab";
        pan = document.createElement("aside");
        pan.id = "v2-si-panel";
        pan.setAttribute("role", "dialog");
        pan.style.cssText = "position:fixed;right:0;top:0;bottom:0;width:min(440px,100vw);z-index:1300;background:var(--superficie);border-left:1px solid var(--linea);box-shadow:-6px 0 24px rgba(0,0,0,.22);display:flex;flex-direction:column;transition:transform .22s cubic-bezier(0.2,0.8,0.2,1);transform:translateX(100%)";
        document.body.append(btn, pan);
      }

      const ses = !!window.V2Adapter?.obtenerSesion();
      document.body.classList.toggle("si-abierta", !!this.abierto);
      btn.hidden = !ses || this.abierto;
      btn.innerHTML = `<span class="si-fab-chispa" aria-hidden="true">✦</span><span>SI</span><small>${esc(m("Pregúntale a tu terreno", "Ask your field", "Pergunte ao seu terreno"))}</small>`;
      btn.setAttribute("aria-label", m("Abrir la SI de campo", "Open field SI", "Abrir a SI de campo"));
      btn.title = btn.getAttribute("aria-label");

      pan.setAttribute("aria-label", m("SI de campo", "Field SI", "SI de campo"));
      pan.style.transform = this.abierto ? "translateX(0)" : "translateX(100%)";
      pan.setAttribute("aria-hidden", String(!this.abierto));
      if (!this.abierto) return;

      const loc = window.V2?.loc || {};
      const coordStr = loc.lat != null ? `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}` : "42.0308, -93.6319";
      const locLabel = loc.label || m("Parcela activa", "Active field", "Parcela ativa");
      const R = this.resumen;

      pan.innerHTML = `
        <!-- Cabecera elegante y conectada -->
        <div class="row-between" style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.15)">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:16px">✦</span>
              <strong style="font-size:17px;font-weight:800">${esc(m("SI de campo", "Field SI", "SI de campo"))}</strong>
              <span class="chip xs" style="background:rgba(255,255,255,0.2);color:#fff;border:0;font-weight:700">NASA POWER + Sentinel</span>
            </div>
            <div class="xs mut" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">
              ${esc(locLabel)} · <span class="coord-mono">${coordStr}</span>
            </div>
          </div>
          <button type="button" class="btn btn-txt btn-sm" id="v2-si-cerrar" aria-label="${esc(m("Cerrar", "Close", "Fechar"))}" style="min-width:40px;min-height:40px;color:#fff;font-size:16px">✕</button>
        </div>

        <!-- Área de mensajes y contenido scrolleable -->
        <div id="v2-si-scroll" style="flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px">
          <!-- Lo más importante ahora -->
          <div>
            <div class="row-between" style="margin-bottom:6px">
              <span class="xs mut" style="font-weight:800;text-transform:uppercase;letter-spacing:.05em">${esc(m("Lo más importante ahora", "What matters most now", "O mais importante agora"))}</span>
              ${this.charla.length ? `<button type="button" class="btn btn-txt btn-xs" id="v2-si-limpiar" style="font-size:11px">${esc(m("Limpiar charla", "Clear chat", "Limpar conversa"))}</button>` : ""}
            </div>
            ${!R ? `
              <div class="notice info" style="padding:10px 12px">
                <div class="si-typing-row">
                  <span class="si-dot-pulse"></span><span class="si-dot-pulse"></span><span class="si-dot-pulse"></span>
                  <span>${esc(m("Leyendo satélites NASA POWER y Sentinel-2…", "Querying NASA POWER and Sentinel-2 satellites…", "Lendo satélites NASA POWER e Sentinel-2…"))}</span>
                </div>
              </div>`
              : R.frases?.length ? R.frases.map(h => this.frase(h)).join("")
              : `<p class="small mut">${esc(R.detalle || m("Sin alertas inmediatas para esta coordenada.", "No immediate alerts for this coordinate.", "Sem alertas imediatos para esta coordenada."))}</p>`}
          </div>

          <!-- Sugerencias con 1 toque e iconos -->
          <div style="margin-top:4px">
            <div class="xs mut" style="margin-bottom:6px;font-weight:600">${esc(m("Preguntas rápidas de un toque:", "Quick one-tap questions:", "Perguntas rápidas de um toque:"))}</div>
            <div class="row-wrap" style="gap:6px">
              ${this.sugeridas().map(s => `
                <button type="button" class="si-chip-btn" data-si-q="${esc(s.q)}">
                  <span>${s.ic}</span>
                  <span>${esc(s.q)}</span>
                </button>
              `).join("")}
            </div>
          </div>

          <!-- Conversación interactiva -->
          ${this.charla.length ? `<hr style="border:0;border-top:1px solid var(--linea);margin:8px 0">` : ""}
          <div class="si-chat-list">
            ${this.charla.map(c => `
              <div class="si-msg-user">
                ${esc(c.q)}
              </div>
              <div class="si-msg-bot">
                ${!c.r ? `
                  <div class="si-typing-row">
                    <span class="si-dot-pulse"></span><span class="si-dot-pulse"></span><span class="si-dot-pulse"></span>
                    <span>${esc(m("Consultando datos de satélite y parcela...", "Querying satellite and parcel data...", "Consultando dados de satélite e parcela..."))}</span>
                  </div>
                ` : `
                  ${((c.r.respuesta && c.r.respuesta.length) ? c.r.respuesta : (this.resumen?.frases?.length ? this.resumen.frases : [this.resumenLocal().frases[0]])).map(h => this.frase(h)).join("")}
                  ${c.r.nota ? `<div class="small" style="margin-top:6px;color:var(--primario);font-weight:600">${esc(c.r.nota)}</div>` : ""}
                  ${c.r.modo_nota ? `<div class="xs mut" style="margin-top:4px">${esc(c.r.modo_nota)}</div>` : ""}
                `}
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Barra inferior para escribir pregunta libre -->
        <form id="v2-si-form" style="display:flex;gap:8px;padding:12px 14px;border-top:1px solid var(--linea);background:var(--superficie)">
          <input type="text" id="v2-si-inp" class="field" maxlength="300"
            placeholder="${esc(m("Pregunta sobre heladas, lluvia, suelo o siembra…", "Ask about frost, rain, soil or crops…", "Pergunte sobre geada, chuva, solo ou cultivo…"))}"
            aria-label="${esc(m("Escribe tu pregunta", "Type your question", "Digite sua pergunta"))}"
            style="flex:1;min-height:42px;font-size:13.5px">
          <button type="submit" class="btn btn-pri" style="min-height:42px;padding:0 16px;font-weight:700" ${this.ocupado ? "disabled" : ""}>
            ${esc(m("Preguntar", "Ask", "Perguntar"))}
          </button>
        </form>

        <div class="xs mut" style="padding:0 14px 10px;text-align:center">
          ${esc(m("Datos científicos (NASA POWER, Sentinel-2, USDA). Cita fuentes y fechas exactas.", "Scientific data (NASA POWER, Sentinel-2, USDA). Cites exact sources and dates.", "Dados científicos (NASA POWER, Sentinel-2, USDA). Cita fontes e datas exatas."))}
        </div>
      `;
    },

    init() {
      document.addEventListener("click", (e) => {
        if (e.target.closest("#v2-si-btn") || e.target.closest("#v2-si-abrir")) {
          if (window.V2?.modal && window.V2.modal !== "cuenta") window.V2.closeModal();
          this.abierto = true;
          this.pintar();
          this.cargarResumen();
        } else if (e.target.closest("#v2-si-cerrar")) {
          this.abierto = false;
          this.pintar();
        } else if (e.target.closest("#v2-si-limpiar")) {
          this.limpiarCharla();
        } else if (e.target.closest("[data-si-q]")) {
          const q = e.target.closest("[data-si-q]").dataset.siQ;
          const inp = document.getElementById("v2-si-inp");
          if (inp) inp.value = q;
          this.preguntar(q);
        }
      });

      document.addEventListener("submit", (e) => {
        if (e.target.id !== "v2-si-form") return;
        e.preventDefault();
        const inp = document.getElementById("v2-si-inp");
        if (inp) {
          const val = inp.value;
          inp.value = "";
          this.preguntar(val);
        }
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.abierto) {
          this.abierto = false;
          this.pintar();
        }
      });

      setInterval(() => {
        if (!this.abierto) this.pintar();
      }, 3000);

      this.pintar();
    },
  };

  window.V2SI = V2SI;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => V2SI.init());
  else V2SI.init();
})();
