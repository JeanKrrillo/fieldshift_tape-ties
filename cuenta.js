// =============================================================================
// Field Shift v2 (Cápsula E) — Módulo de Cuenta (Pantalla 1)
// Cumple con la sección 2.1 y regla de oro 3:
// - Pestañas "Entrar" y "Crear cuenta".
// - Mostrar/ocultar contraseña con botón accesible.
// - "Olvidé mi contraseña" (llama a V2Adapter.cuentaRecuperar).
// - "Probar sin cuenta" visible siempre (entra con datos EJEMPLO en memoria).
// - Ninguna contraseña se guarda en localStorage, sessionStorage, URL ni consola.
// =============================================================================

(function () {
  "use strict";

  const V2Cuenta = {
    activeTab: "entrar", // entrar | crear | recuperar
    showPass: false,
    errorMsg: "",
    successMsg: "",

    m(es, en, pt) { const l = window.V2?.lang; return l === "en" ? en : l === "pt" ? pt : es; },

    renderModalContent() {
      const lang = window.V2?.lang || "es";
      const isEntrar = this.activeTab === "entrar";
      const isCrear = this.activeTab === "crear";
      const isRecuperar = this.activeTab === "recuperar";

      const tTitle = lang === "en"
        ? (isRecuperar ? "Recover password" : isCrear ? "Create account" : "Sign in")
        : lang === "pt"
        ? (isRecuperar ? "Recuperar senha" : isCrear ? "Criar conta" : "Entrar")
        : (isRecuperar ? "Recuperar contraseña" : isCrear ? "Crear cuenta" : "Entrar a tu libreta");

      const tEmail = lang === "en" ? "Email" : lang === "pt" ? "E-mail" : "Correo electrónico";
      const tPass = lang === "en" ? "Password" : lang === "pt" ? "Senha" : "Contraseña";
      const tName = lang === "en" ? "Your name" : lang === "pt" ? "Seu nome" : "Tu nombre";
      const tSubmit = lang === "en"
        ? (isRecuperar ? "Send recovery link" : isCrear ? "Create account" : "Sign in")
        : lang === "pt"
        ? (isRecuperar ? "Enviar link" : isCrear ? "Criar conta" : "Entrar")
        : (isRecuperar ? "Enviar enlace" : isCrear ? "Crear cuenta" : "Entrar");

      const tForgot = lang === "en" ? "Forgot password?" : lang === "pt" ? "Esqueceu a senha?" : "¿Olvidaste tu contraseña?";
      const tBackToLogin = lang === "en" ? "Back to sign in" : lang === "pt" ? "Voltar para entrar" : "Volver a iniciar sesión";

      const svg = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
      const I = {
        mail: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>'),
        lock: svg('<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
        user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 20c1.2-3.6 4.2-5 8-5s6.8 1.4 8 5"/>'),
        eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
        sat: svg('<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/>'),
        bot: svg('<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/>'),
        shield: svg('<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>'),
      };
      const T = {
        es: ["Tu campo, visto desde el espacio", "Datos satelitales de NASA y Sentinel-2, más las lecturas reales de tu robot, en una sola libreta.", "Satélites NASA y ESA", "Humedad, vigor y clima de tu terreno.", "Tu robot de campo", "Sus lecturas llegan por hoja de Google o archivo.", "Datos reales, sin inventos", "Si un dato no existe, lo decimos."],
        en: ["Your field, seen from space", "NASA and Sentinel-2 satellite data plus your robot's real readings, in one notebook.", "NASA and ESA satellites", "Moisture, vigor and weather of your land.", "Your field robot", "Its readings arrive by Google Sheet or file.", "Real data, nothing invented", "If a value does not exist, we say so."],
        pt: ["Seu campo, visto do espaço", "Dados de satélite NASA e Sentinel-2 mais as leituras reais do seu robô, em um só caderno.", "Satélites NASA e ESA", "Umidade, vigor e clima do seu terreno.", "Seu robô de campo", "As leituras chegam por planilha Google ou arquivo.", "Dados reais, sem invenções", "Se um dado não existe, dizemos."],
      }[lang];
      const sub = isCrear
        ? (lang === "en" ? "It takes less than a minute." : lang === "pt" ? "Leva menos de um minuto." : "Toma menos de un minuto.")
        : isRecuperar
        ? (lang === "en" ? "We will help you get back in." : lang === "pt" ? "Vamos ajudar você a voltar." : "Te ayudamos a volver a entrar.")
        : (lang === "en" ? "Welcome back. Sign in to continue." : lang === "pt" ? "Bem-vindo de volta. Entre para continuar." : "Qué bueno verte de nuevo. Entra para continuar.");
      const feat = (ic, h, p) => `<li><span class="auth-feat-ic">${ic}</span><span><b>${window.esc(h)}</b><small>${window.esc(p)}</small></span></li>`;

      return `
        <div class="modal-card auth-card" role="dialog" aria-modal="true" aria-labelledby="v2-cuenta-title">
          <aside class="auth-brand">
            <div class="auth-logo"><span class="auth-logo-ic">${window.ic("leaf", "sm")}</span><span>Field Shift</span></div>
            <h2 class="auth-hero">${window.esc(T[0])}</h2>
            <p class="auth-lead">${window.esc(T[1])}</p>
            <ul class="auth-feats">
              ${feat(I.sat, T[2], T[3])}
              ${feat(I.bot, T[4], T[5])}
              ${feat(I.shield, T[6], T[7])}
            </ul>
          </aside>

          <section class="auth-form-side">
            <div class="auth-lang" role="group" aria-label="Language">${["es", "en", "pt"].map(l => `<button type="button" class="${lang === l ? "on" : ""}" data-set-lang="${l}" aria-pressed="${lang === l}">${l.toUpperCase()}</button>`).join("")}</div>
            <div class="auth-logo auth-logo-mobile"><span class="auth-logo-ic">${window.ic("leaf", "sm")}</span><span>Field Shift</span></div>
            <h1 id="v2-cuenta-title" class="auth-title">${window.esc(tTitle)}</h1>
            <p class="auth-sub">${window.esc(sub)}</p>

            ${!isRecuperar ? `
              <div class="auth-seg" role="tablist">
                <button type="button" class="${isEntrar ? "on" : ""}" data-cuenta-tab="entrar" role="tab" aria-selected="${isEntrar}">${lang === "en" ? "Sign in" : "Entrar"}</button>
                <button type="button" class="${isCrear ? "on" : ""}" data-cuenta-tab="crear" role="tab" aria-selected="${isCrear}">${lang === "en" ? "Create account" : lang === "pt" ? "Criar conta" : "Crear cuenta"}</button>
              </div>` : ""}

            ${this.errorMsg ? `<div class="auth-msg err" role="alert">${window.esc(this.errorMsg)}</div>` : ""}
            ${this.successMsg ? `<div class="auth-msg ok" role="status">${window.esc(this.successMsg)}</div>` : ""}

            <form id="v2-cuenta-form" novalidate class="auth-form">
              ${isCrear ? `
                <label class="auth-lbl">${window.esc(tName)}
                  <span class="auth-inp">${I.user}<input type="text" id="v2-inp-nombre" value="${window.esc(this.borrador?.["v2-inp-nombre"] ?? "")}" placeholder="${lang === "en" ? "E.g. Jean" : "Ej. Jean"}" autocomplete="name" required></span>
                </label>` : ""}
              <label class="auth-lbl">${window.esc(tEmail)}
                <span class="auth-inp">${I.mail}<input type="email" id="v2-inp-correo" value="${window.esc(this.borrador?.["v2-inp-correo"] ?? "")}" placeholder="correo@ejemplo.com" autocomplete="email" required></span>
              </label>
              ${!isRecuperar ? `
                <label class="auth-lbl">
                  <span class="auth-lbl-row"><span>${window.esc(tPass)}</span>${isEntrar ? `<button type="button" class="auth-link" data-cuenta-tab="recuperar">${window.esc(tForgot)}</button>` : ""}</span>
                  <span class="auth-inp">${I.lock}<input type="${this.showPass ? "text" : "password"}" id="v2-inp-pass" value="${window.esc(this.borrador?.["v2-inp-pass"] ?? "")}" placeholder="••••••••" autocomplete="${isCrear ? "new-password" : "current-password"}" required>
                    <button type="button" class="auth-eye" id="v2-btn-toggle-pass" aria-label="${lang === "en" ? "Show or hide password" : lang === "pt" ? "Mostrar ou ocultar senha" : "Mostrar u ocultar contraseña"}">${I.eye}</button></span>
                </label>` : ""}
              <button type="submit" class="auth-submit">${window.esc(tSubmit)}</button>
              ${isRecuperar ? `<button type="button" class="auth-link center" data-cuenta-tab="entrar">${window.esc(tBackToLogin)}</button>` : ""}
            </form>
          </section>
        </div>
      `;
    },

    bindEvents() {
      this.borrador = {};
      document.addEventListener("input", (e) => { if (/^v2-inp-(nombre|correo|pass)$/.test(e.target.id || "")) this.borrador[e.target.id] = e.target.value; });
      document.addEventListener("click", (e) => {
        const btnTab = e.target.closest("[data-cuenta-tab]");
        if (btnTab) {
          this.activeTab = btnTab.dataset.cuentaTab;
          this.errorMsg = "";
          this.successMsg = "";
          if (window.V2?.modal === "cuenta") {
            window.V2.renderModal();
          }
          return;
        }

        if (e.target.closest("#v2-btn-toggle-pass")) {
          this.showPass = !this.showPass;
          const inp = document.getElementById("v2-inp-pass");
          if (inp) {
            inp.type = this.showPass ? "text" : "password";
          }
          document.getElementById("v2-btn-toggle-pass")?.classList.toggle("on", this.showPass);
          return;
        }

        if (e.target.closest("[data-action='abrir-cuenta']")) {
          this.activeTab = "entrar";
          this.errorMsg = "";
          this.successMsg = "";
          window.V2.openModal("cuenta");
          return;
        }

        if (e.target.closest("[data-action='cerrar-sesion']")) {
          this.cerrarSesion();
          return;
        }
      });

      document.addEventListener("submit", async (e) => {
        if (e.target.id === "v2-cuenta-form") {
          e.preventDefault();
          this.errorMsg = "";
          this.successMsg = "";

          const emailEl = document.getElementById("v2-inp-correo");
          const passEl = document.getElementById("v2-inp-pass");
          const nameEl = document.getElementById("v2-inp-nombre");

          const correo = emailEl ? emailEl.value.trim() : "";
          const contrasena = passEl ? passEl.value : "";
          const nombre = nameEl ? nameEl.value.trim() : "";

          if (!correo) {
            this.errorMsg = this.m("Por favor escribe tu correo electrónico.", "Please enter your email.", "Digite seu e-mail.");
            window.V2.renderModal();
            return;
          }

          if (this.activeTab === "recuperar") {
            try {
              window.V2.startProgress(this.m("Enviando enlace de recuperación…", "Sending recovery link…", "Enviando link de recuperação…"));
              await window.V2Adapter.cuentaRecuperar({ correo });
              this.successMsg = this.m("Revisa tu correo: si la cuenta existe, te enviamos las instrucciones de acceso.", "Check your email: if the account exists, we sent you instructions.", "Verifique seu e-mail: se a conta existir, enviamos as instruções.");
            } catch (err) {
              this.errorMsg = err.message || this.m("Error al procesar recuperación.", "Could not process recovery.", "Erro ao processar a recuperação.");
            } finally {
              window.V2.stopProgress();
              window.V2.renderModal();
            }
            return;
          }

          if (!contrasena) {
            this.errorMsg = this.m("Por favor escribe tu contraseña.", "Please enter your password.", "Digite sua senha.");
            window.V2.renderModal();
            return;
          }

          try {
            if (this.activeTab === "crear") {
              window.V2.startProgress(this.m("Creando tu libreta de campo…", "Creating your field notebook…", "Criando seu caderno de campo…"));
              await window.V2Adapter.cuentaCrear({ correo, contrasena, nombre });
              location.reload(); // recarga con la sesión ya abierta
            } else {
              window.V2.startProgress(this.m("Iniciando sesión…", "Signing in…", "Entrando…"));
              const res = await window.V2Adapter.cuentaEntrar({ correo, contrasena });
              location.reload();
            }
          } catch (err) {
            this.errorMsg = err.message || this.m("Correo o contraseña incorrectos.", "Wrong email or password.", "E-mail ou senha incorretos.");
            window.V2.renderModal();
          } finally {
            window.V2.stopProgress();
          }
        }
      });
    },

    async cerrarSesion() {
      window.V2.startProgress(this.m("Cerrando sesión…", "Signing out…", "Saindo…"));
      try {
        await window.V2Adapter.cuentaSalir();
        location.reload(); // sin sesión, la app vuelve a pedir el inicio de sesión
      } finally {
        window.V2.stopProgress();
      }
    }
  };

  window.V2Cuenta = V2Cuenta;
  V2Cuenta.bindEvents();
})();

