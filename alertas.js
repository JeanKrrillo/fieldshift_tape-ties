// =============================================================================
// Terra Lab v2 (Cápsula E) — Sistema de Alertas y Notificaciones
// Cumple con la sección 5:
// - Gravedad con color + texto + icono (info, atención, alerta).
// - Muestra qué dato la causó, umbral y fuente, y botón "¿Por qué?" a Conceptos.
// - Umbrales editables por el usuario con distinción clara de origen:
//   "rango de la app (citado)" vs "definido por ti".
// - Marcar como leída, filtrar por gravedad y variable.
// - Contador en la campana de notificaciones siempre visible.
// - Notificaciones de navegador (solo si el usuario activa el permiso expresamente).
// =============================================================================

(function () {
  "use strict";

  const V2Alertas = {
    alertasList: [],
    umbralesList: [],
    filtroGravedad: "todas", // todas | alerta | atencion | info
    filtroVariable: "todas",
    browserNotifEnabled: false,

    async init() {
      await this.cargarAlertasYUmbrales();
    },

    async cargarAlertasYUmbrales() {
      try {
        this.alertasList = await window.V2Adapter.obtenerAlertas();
        this.umbralesList = await window.V2Adapter.obtenerUmbrales();
        this.actualizarCampanaBadge();
      } catch (err) {
        console.warn("Error cargando alertas:", err);
      }
    },

    conteoNoLeidas() {
      return (this.alertasList || []).filter(a => !a.leida).length;
    },

    actualizarCampanaBadge() {
      const badge = document.getElementById("v2-bell-badge");
      const n = this.conteoNoLeidas();
      if (badge) {
        badge.textContent = String(n);
        badge.hidden = n === 0;
      }
    },

    renderModalContent() {
      const lang = window.V2?.lang || "es";
      const noLeidas = this.conteoNoLeidas();
      const grav = this.filtroGravedad;
      const filtered = (this.alertasList || []).filter(a => {
        if (grav !== "todas" && a.gravedad !== grav) return false;
        if (this.filtroVariable !== "todas" && a.variable !== this.filtroVariable) return false;
        return true;
      });

      const tTitle = lang === "en" ? "Alerts & Notifications" : lang === "pt" ? "Alertas e Notificações" : "Notificaciones y alertas agronómicas";

      return `
        <div class="modal-card alertas-modal-card" role="dialog" aria-modal="true" aria-labelledby="v2-alt-title">
          <div class="row-between" style="margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:8px">
              <span class="sem-domain-ic" style="color:var(--atencion)">${window.ic("atencion", "sm")}</span>
              <h2 id="v2-alt-title" class="card-title" style="margin:0">${window.esc(tTitle)}</h2>
              ${noLeidas > 0 ? `<span class="sem-badge alerta" style="font-size:11px">${noLeidas} nuevas</span>` : ""}
            </div>
            <button type="button" class="btn btn-txt btn-sm" data-close-modal="1" aria-label="Cerrar">✕</button>
          </div>

          <!-- Permiso opcional de notificaciones de navegador -->
          <div class="card-sub small" style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div>
              <b>Notificaciones en el celular / navegador:</b>
              <div class="xs mut">Recibe avisos solo cuando haya helada o sequía crítica.</div>
            </div>
            <button type="button" class="btn btn-sec btn-sm" id="v2-btn-toggle-browser-notif">
              ${this.browserNotifEnabled ? "✓ Permitidas" : "Activar avisos"}
            </button>
          </div>

          <!-- Filtros de Gravedad y Variable -->
          <div class="row-wrap small" style="gap:6px;margin-bottom:12px">
            <span class="xs mut" style="font-weight:700">Gravedad:</span>
            ${[["todas", "Todas"], ["alerta", "Riesgo alto"], ["atencion", "Atención"], ["info", "Informativas"]].map(([k, lbl]) => `
              <button type="button" class="btn btn-sec btn-sm ${this.filtroGravedad === k ? "active" : ""}" data-alt-grav="${k}" style="padding:2px 8px;min-height:30px;font-size:12px">
                ${lbl}
              </button>
            `).join("")}
          </div>

          <!-- Lista de Alertas -->
          <div class="alertas-items-stream" style="display:flex;flex-direction:column;gap:8px;max-height:360px;overflow-y:auto;padding-right:4px;margin-bottom:14px">
            ${filtered.length === 0 ? `
              <div class="notice ok" style="padding:16px;text-align:center">
                ${window.ic("ok", "lg")}
                <div style="flex:1">
                  <b>Sin alertas activas bajo este filtro.</b>
                  <div class="xs mut" style="margin-top:2px">Última revisión: hace unos momentos.</div>
                </div>
              </div>
            ` : filtered.map(a => {
              const stClass = a.gravedad === "alerta" ? "riesgo" : a.gravedad === "atencion" ? "atencion" : "info";
              const gravLabel = a.gravedad === "alerta" ? "ALERTA CRÍTICA" : a.gravedad === "atencion" ? "ATENCIÓN" : "INFO";
              return `
                <div class="notice ${stClass} ${a.leida ? "leida" : "no-leida"}" style="flex-direction:column;gap:6px;opacity:${a.leida ? "0.78" : "1"}">
                  <div class="row-between" style="width:100%">
                    <div style="display:flex;align-items:center;gap:6px">
                      <span class="sem-badge ${stClass}" style="font-size:10px;padding:1px 6px">
                        ${window.ic(stClass === "riesgo" ? "riesgo" : "atencion", "sm")} <span>${gravLabel}</span>
                      </span>
                      <strong style="font-size:14px">${window.esc(a.titulo)}</strong>
                    </div>
                    ${!a.leida ? `
                      <button type="button" class="btn btn-txt btn-sm" data-mark-read="${window.esc(a.id)}" style="font-size:11px;padding:0 4px">
                        Marcar leída
                      </button>
                    ` : `<span class="xs mut">Leída</span>`}
                  </div>

                  <div class="small" style="line-height:1.4">${window.esc(a.detalle)}</div>

                  <div class="row-between small" style="width:100%;margin-top:2px;padding-top:4px;border-top:1px dashed var(--linea)">
                    <div class="xs mut">
                      Dato: <b>${a.valor != null ? a.valor : "—"}</b> · Umbral: <b>${window.esc(a.umbral || "—")}</b>
                    </div>
                    <div class="row-wrap" style="gap:4px">
                      <span class="src-tag">${window.esc(a.fuente || "Sensor")}</span>
                      <button type="button" class="btn btn-txt btn-sm" data-go-conceptos="${window.esc(a.variable || "humedad_suelo_pct")}" style="font-size:11px;font-weight:700;color:var(--primario)">
                        ¿Por qué? →
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>

          <!-- Plegable de Umbrales Editables (Origen Citado vs Definido por ti) -->
          <details class="card-sub" style="margin-top:10px">
            <summary style="font-weight:700;cursor:pointer;font-size:13px">
              Configurar umbrales de alerta de tu terreno
            </summary>
            <p class="xs mut" style="margin:6px 0 10px">
              Los valores por defecto proceden de guías oficiales USDA NRCS y FAO citadas. Puedes personalizar los rangos para adaptarlos a tu suelo específico.
            </p>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${(this.umbralesList || []).map(u => `
                <div class="switch-row" style="padding:6px 0;align-items:center">
                  <div style="flex:1">
                    <b style="font-size:13px">${window.esc(u.variable)}</b>
                    <span class="xs mut" style="display:block">Origen: <em>${window.esc(u.origen || "rango de la app (citado)")}</em></span>
                  </div>
                  <div class="row-wrap" style="gap:4px">
                    <input type="number" class="field" step="0.5" value="${u.min ?? ""}" data-umbral-var="${window.esc(u.variable)}" data-umbral-type="min" placeholder="Mín" style="width:68px;min-height:34px;padding:2px 6px;font-size:13px">
                    <span>–</span>
                    <input type="number" class="field" step="0.5" value="${u.max ?? ""}" data-umbral-var="${window.esc(u.variable)}" data-umbral-type="max" placeholder="Máx" style="width:68px;min-height:34px;padding:2px 6px;font-size:13px">
                    <span class="xs mut">${window.esc(u.unidad || "")}</span>
                  </div>
                </div>
              `).join("")}
            </div>
          </details>
        </div>
      `;
    },

    bindEvents() {
      document.addEventListener("click", async (e) => {
        if (e.target.closest("#v2-btn-bell")) {
          await this.cargarAlertasYUmbrales();
          window.V2.openModal("alertas");
          return;
        }

        const btnGrav = e.target.closest("[data-alt-grav]");
        if (btnGrav) {
          this.filtroGravedad = btnGrav.dataset.altGrav;
          if (window.V2?.modal === "alertas") window.V2.renderModal();
          return;
        }

        const markReadBtn = e.target.closest("[data-mark-read]");
        if (markReadBtn) {
          const id = markReadBtn.dataset.markRead;
          await window.V2Adapter.marcarAlertaLeida(id);
          const a = this.alertasList.find(x => x.id === id);
          if (a) a.leida = true;
          this.actualizarCampanaBadge();
          if (window.V2?.modal === "alertas") window.V2.renderModal();
          return;
        }

        const btnWhy = e.target.closest("[data-go-conceptos]");
        if (btnWhy) {
          window.V2.closeModal();
          window.V2.setSpace("conceptos");
          return;
        }

        if (e.target.closest("#v2-btn-toggle-browser-notif")) {
          this.solicitarNotificacionesNavegador();
          return;
        }
      });

      document.addEventListener("change", async (e) => {
        if (e.target.dataset.umbralVar) {
          const varName = e.target.dataset.umbralVar;
          const u = this.umbralesList.find(x => x.variable === varName);
          if (u) {
            const minInp = document.querySelector(`[data-umbral-var="${varName}"][data-umbral-type="min"]`);
            const maxInp = document.querySelector(`[data-umbral-var="${varName}"][data-umbral-type="max"]`);
            const min = minInp ? parseFloat(minInp.value) : u.min;
            const max = maxInp ? parseFloat(maxInp.value) : u.max;
            await window.V2Adapter.actualizarUmbral({
              variable: varName,
              min,
              max,
              origen: "definido por ti"
            });
            u.min = min;
            u.max = max;
            u.origen = "definido por ti";
            window.V2.showToast(`Umbral de «${varName}» actualizado (definido por ti).`, 3000);
          }
        }
      });
    },

    solicitarNotificacionesNavegador() {
      if (!("Notification" in window)) {
        window.V2.showToast("Tu navegador no soporta notificaciones de sistema.", 4000);
        return;
      }
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          this.browserNotifEnabled = true;
          window.V2.showToast("Notificaciones del navegador activadas.", 3500);
          if (window.V2?.modal === "alertas") window.V2.renderModal();
        } else {
          this.browserNotifEnabled = false;
          window.V2.showToast("Permiso de notificaciones denegado.", 3500);
        }
      });
    }
  };

  window.V2Alertas = V2Alertas;
  V2Alertas.bindEvents();
})();

