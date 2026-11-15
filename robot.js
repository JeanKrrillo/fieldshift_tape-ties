// =============================================================================
// Field Shift — Sección Robot. Solo muestra lo que el robot realmente envió (hoja de Google, archivo o envío en vivo).
// Lo que no llega no se dibuja ni se inventa: batería, señal y ruta aparecen solo si el robot manda esas columnas.
// Las unidades no se suponen: las elige quien conoce el robot, en el paso 3 del asistente.
// =============================================================================
(function () {
  "use strict";
  const esc = (s) => window.esc(s);
  const ic = (n, t) => window.ic(n, t);

  const V2Robot = {
    robotData: null,
    ultimasLecturas: [],
    lecturas: [],
    rutaPuntos: [],
    asistente: null, // { paso, url, vista, tz, dia, vars, error }

    m(es, en, pt) { return window.V2?.lang === "en" ? en : window.V2?.lang === "pt" ? pt : es; },

    async cargarDatos() {
      try {
        this.robotData = await window.V2Adapter.robotEstado();
        this.ultimasLecturas = await window.V2Adapter.robotUltimas();
        this.lecturas = await window.V2Adapter.robotLecturas({ limite: 5000 });
        this.rutaPuntos = await window.V2Adapter.robotRuta();
      } catch (err) {
        console.warn("Robot data load:", err);
      }
    },

    valor(variable) {
      return this.ultimasLecturas.find(v => v.variable === variable);
    },

    lapso(seg) {
      const s = Math.max(0, Math.round(seg));
      return s < 90 ? `${s} s` : s < 5400 ? `${Math.round(s / 60)} min` : s < 172800 ? `${(s / 3600).toFixed(1)} h` : `${Math.round(s / 86400)} ${this.m("días", "days", "dias")}`;
    },

    hace(iso) {
      if (!iso) return this.m("sin registro", "no record", "sem registro");
      const s = (Date.now() - new Date(iso).getTime()) / 1000;
      return s < 0 ? this.m(`dentro de ${this.lapso(-s)}`, `in ${this.lapso(-s)}`, `em ${this.lapso(-s)}`) : this.m(`hace ${this.lapso(s)}`, `${this.lapso(s)} ago`, `há ${this.lapso(s)}`);
    },

    // Variables con posición: las que se pueden pintar en el mapa de cuadros
    variablesConPosicion() {
      const s = new Set(this.lecturas.filter(l => l.lat != null && l.lon != null && typeof l.valor === "number").map(l => l.variable));
      return this.ultimasLecturas.filter(v => s.has(v.variable));
    },

    // ---------------------------------------------------------------- tarjetas
    estadoHtml(est) {
      const bat = this.valor("bateria_pct"), wifi = this.valor("wifi_dbm");
      const futuro = est.ultima_lectura && new Date(est.ultima_lectura).getTime() - Date.now() > 120000;
      const r = est.ritmo;
      return `
        <div class="card robot-hero-card">
          <div class="row-between" style="margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:10px">
              <span class="sem-domain-ic vigor" style="width:36px;height:36px">${ic("sensor", "lg")}</span>
              <div>
                <h1 style="font-size:20px;font-weight:700;margin:0">${esc((est.robots && est.robots[0]) || "Robot")}</h1>
                <div class="xs mut">${est.lecturas} ${esc(this.m("lecturas guardadas · última", "readings stored · latest", "leituras salvas · última"))} ${esc(this.hace(est.ultima_lectura))}</div>
              </div>
            </div>
            <span class="sem-badge ${est.conectado && !futuro ? "ok" : "atencion"}">${ic(est.conectado && !futuro ? "ok" : "atencion", "sm")} <span>${esc(est.conectado && !futuro ? this.m("Reportando", "Reporting", "Reportando") : this.m("Sin reportar", "Not reporting", "Sem reportar"))}</span></span>
          </div>
          ${futuro ? `<div class="notice atencion" role="alert" style="margin-bottom:10px">${ic("atencion", "lg")}<div class="small">${esc(this.m(
            "La última lectura tiene una hora que todavía no llega. Casi siempre es la zona horaria de la hoja: revísala en «Cambiar hoja o unidades».",
            "The latest reading has a time that has not happened yet. This is almost always the sheet's time zone: check it under “Change sheet or units”.",
            "A última leitura tem um horário que ainda não chegou. Quase sempre é o fuso horário da planilha: revise em «Trocar planilha ou unidades»."))}</div></div>`
          : !est.conectado ? `<div class="notice atencion" role="alert" style="margin-bottom:10px">${ic("atencion", "lg")}<div class="small">${esc(this.m(
            `El robot no manda datos desde ${this.hace(est.ultima_lectura)}. Se cuenta como sin conexión después de 5 minutos sin lecturas (regla del equipo).`,
            `The robot has sent no data since ${this.hace(est.ultima_lectura)}. It counts as offline after 5 minutes without readings (team rule).`,
            `O robô não envia dados desde ${this.hace(est.ultima_lectura)}. Conta como sem conexão após 5 minutos sem leituras (regra da equipe).`))}</div></div>` : ""}
          <div class="grid-3 small">
            ${bat ? `<div class="card-sub"><div class="xs mut">${esc(this.m("Batería", "Battery", "Bateria"))}</div><div style="font-size:24px;font-weight:800">${esc(bat.valor)}%</div></div>` : ""}
            ${wifi ? `<div class="card-sub"><div class="xs mut">Wi‑Fi</div><div style="font-size:24px;font-weight:800">${esc(wifi.valor)} dBm</div></div>` : ""}
            <div class="card-sub"><div class="xs mut">${esc(this.m("Variables que manda", "Variables it sends", "Variáveis que envia"))}</div><div style="font-size:24px;font-weight:800">${this.ultimasLecturas.length}</div></div>
            ${r ? `<div class="card-sub"><div class="xs mut">${esc(this.m("Cada cuánto manda (mediana)", "How often it sends (median)", "De quanto em quanto envia (mediana)"))}</div><div style="font-size:24px;font-weight:800">${esc(this.lapso(r.cada_s_mediana))}</div></div>
            <div class="card-sub"><div class="xs mut">${esc(this.m("Hueco más largo sin datos", "Longest gap without data", "Maior intervalo sem dados"))}</div><div style="font-size:24px;font-weight:800">${esc(this.lapso(r.hueco_mayor_s))}</div><div class="xs mut">${esc(this.m("desde", "from", "desde"))} ${esc(new Date(r.hueco_mayor_desde).toLocaleString())}</div></div>` : ""}
          </div>
        </div>`;
    },

    hojaVivaHtml(hoja) {
      const fila = (a, b) => `<div><span class="xs mut">${esc(a)}</span><div style="font-weight:700">${b}</div></div>`;
      return `
        <div class="notice ${hoja.error ? "riesgo" : "ok"}" style="margin-bottom:10px">${ic(hoja.error ? "riesgo" : "ok", "sm")}<div class="small">${hoja.error
          ? `<b>${esc(this.m("La última lectura de la hoja falló:", "The last read of the sheet failed:", "A última leitura da planilha falhou:"))}</b> ${esc(hoja.error)}`
          : `<b>${esc(this.m("Hoja conectada.", "Sheet connected.", "Planilha conectada."))}</b> ${esc(this.m("Field Shift solo la lee; nunca escribe en ella.", "Field Shift only reads it; it never writes to it.", "O Field Shift só lê; nunca escreve nela."))}`}</div></div>
        <div class="grid-3 small" style="margin-bottom:10px">
          ${fila(this.m("Última lectura de la hoja", "Last sheet read", "Última leitura da planilha"), esc(hoja.ultima_sincronizacion ? this.hace(hoja.ultima_sincronizacion) : this.m("pendiente", "pending", "pendente")))}
          ${fila(this.m("Próxima lectura", "Next read", "Próxima leitura"), hoja.proxima_en_s != null ? `<span id="v2-hoja-prox" data-s="${hoja.proxima_en_s}" data-t="${Date.now()}">${hoja.proxima_en_s} s</span>` : `${esc(this.m("cada", "every", "a cada"))} ${hoja.cada_s || 60} s`)}
          ${fila(this.m("Filas en la hoja", "Rows in the sheet", "Linhas na planilha"), hoja.filas_hoja ?? "—")}
          ${fila(this.m("Filas nuevas en la última lectura", "New rows in the last read", "Linhas novas na última leitura"), hoja.filas_nuevas ?? "—")}
          ${fila(this.m("Filas omitidas por no tener hora válida", "Rows skipped for lacking a valid time", "Linhas omitidas por não ter horário válido"), hoja.filas_omitidas ?? "—")}
        </div>
        <div class="row-wrap">
          <button type="button" class="btn btn-pri btn-sm" id="v2-btn-hoja-sync" style="min-height:44px">${ic("upload", "sm")} <span>${esc(this.m("Sincronizar ahora", "Sync now", "Sincronizar agora"))}</span></button>
          <button type="button" class="btn btn-sec btn-sm" id="v2-btn-hoja-cambiar" style="min-height:44px">${esc(this.m("Cambiar hoja o unidades", "Change sheet or units", "Trocar planilha ou unidades"))}</button>
        </div>`;
    },

    asistenteHtml() {
      const a = this.asistente, v = a.vista;
      const pasos = [this.m("1 · Pega el enlace", "1 · Paste the link", "1 · Cole o link"), this.m("2 · Revisa cómo se leyó", "2 · Check how it was read", "2 · Confira como foi lida"), this.m("3 · Nombres y unidades", "3 · Names and units", "3 · Nomes e unidades")];
      const cab = `<div class="row-wrap" style="gap:6px;margin-bottom:12px" role="list">${pasos.map((p, i) => `<span role="listitem" class="chip" style="${a.paso === i + 1 ? "background:var(--primario);color:#fff;font-weight:700" : a.paso > i + 1 ? "" : "opacity:.55"}" ${a.paso === i + 1 ? 'aria-current="step"' : ""}>${esc(p)}</span>`).join("")}</div>`;
      const err = a.error ? `<div class="notice riesgo" role="alert" style="margin-bottom:10px">${ic("riesgo", "sm")}<div class="small">${esc(a.error)}</div></div>` : "";
      if (a.paso === 1) {
        return `${cab}${err}
          <form id="v2-form-hoja-vista" style="display:flex;flex-direction:column;gap:10px">
            <label class="small"><b>${esc(this.m("Enlace de la hoja de Google del robot", "Link to the robot's Google Sheet", "Link da planilha Google do robô"))}</b>
              <input type="url" id="v2-inp-hoja-url" class="field" value="${esc(a.url)}" placeholder="https://docs.google.com/spreadsheets/d/…" required style="width:100%;margin-top:4px"></label>
            <details class="small"><summary style="cursor:pointer;color:var(--primario);font-weight:600">${esc(this.m("¿Cómo comparto la hoja para que se pueda leer?", "How do I share the sheet so it can be read?", "Como compartilho a planilha para que possa ser lida?"))}</summary>
              <ol style="margin:6px 0 0 18px;padding:0">
                <li>${this.m("En la hoja, toca <b>Compartir</b> (arriba a la derecha).", "In the sheet, click <b>Share</b> (top right).", "Na planilha, toque em <b>Compartilhar</b> (canto superior direito).")}</li>
                <li>${this.m("En <b>Acceso general</b> elige <b>Cualquier persona con el enlace</b>, como <b>Lector</b>.", "Under <b>General access</b> choose <b>Anyone with the link</b>, as <b>Viewer</b>.", "Em <b>Acesso geral</b> escolha <b>Qualquer pessoa com o link</b>, como <b>Leitor</b>.")}</li>
                <li>${this.m("Toca <b>Copiar enlace</b> y pégalo aquí.", "Click <b>Copy link</b> and paste it here.", "Toque em <b>Copiar link</b> e cole aqui.")}</li>
              </ol></details>
            <div class="row-wrap"><button type="submit" class="btn btn-pri btn-sm" style="min-height:44px">${esc(this.m("Ver cómo se lee", "See how it reads", "Ver como é lida"))}</button>
              ${this.robotData?.hoja?.conectada ? `<button type="button" class="btn btn-txt btn-sm" id="v2-btn-hoja-cancelar">${esc(this.m("Cancelar", "Cancel", "Cancelar"))}</button>` : ""}</div>
          </form>`;
      }
      const papel = { hora: this.m("hora", "time", "horário"), latitud: this.m("posición (latitud)", "position (latitude)", "posição (latitude)"), longitud: this.m("posición (longitud)", "position (longitude)", "posição (longitude)"),
        robot: this.m("nombre del robot", "robot name", "nome do robô"), variable: this.m("variable medida", "measured variable", "variável medida"), texto: this.m("texto: no se guarda", "text: not stored", "texto: não é salvo") };
      const fh = (x) => (x ? new Date(x).toLocaleString() : "—");
      if (a.paso === 2) {
        return `${cab}${err}
          <p class="small" style="margin:0 0 8px">${esc(this.m(`La hoja tiene ${v.total_filas} filas. Así se entendió cada columna:`, `The sheet has ${v.total_filas} rows. This is how each column was understood:`, `A planilha tem ${v.total_filas} linhas. Assim cada coluna foi entendida:`))}</p>
          <div class="table-wrap" style="margin-bottom:10px"><table class="v2-table">
            <thead><tr>${v.columnas.map(c => `<th>${esc(c.columna)}<div class="xs" style="font-weight:600;color:${c.papel === "texto" ? "var(--texto-suave)" : "var(--primario)"}">${esc(papel[c.papel])}</div></th>`).join("")}</tr></thead>
            <tbody>${v.filas.map(f => `<tr>${f.map(x => `<td class="xs">${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody>
          </table></div>
          ${!v.tiene_hora ? `<div class="notice riesgo" style="margin-bottom:10px">${ic("riesgo", "sm")}<div class="small">${esc(this.m("La hoja no tiene una columna de hora (Hora, Fecha, Tiempo…). Sin ella no se puede saber cuándo se midió cada fila.", "The sheet has no time column (Time, Date…). Without it there is no way to know when each row was measured.", "A planilha não tem coluna de horário (Hora, Data…). Sem ela não dá para saber quando cada linha foi medida."))}</div></div>` : `
          <ul class="small" style="margin:0 0 10px 18px;padding:0">
            <li>${esc(this.m(`${v.lecturas_validas} lecturas se pueden guardar, de ${fh(v.primera_hora)} a ${fh(v.ultima_hora)}.`, `${v.lecturas_validas} readings can be stored, from ${fh(v.primera_hora)} to ${fh(v.ultima_hora)}.`, `${v.lecturas_validas} leituras podem ser salvas, de ${fh(v.primera_hora)} a ${fh(v.ultima_hora)}.`))}</li>
            ${v.filas_sin_hora_valida ? `<li>${esc(this.m(`${v.filas_sin_hora_valida} filas se omiten porque su hora no es una fecha (por ejemplo «${v.ejemplo_hora_no_entendida}»).`, `${v.filas_sin_hora_valida} rows are skipped because their time is not a date (for example “${v.ejemplo_hora_no_entendida}”).`, `${v.filas_sin_hora_valida} linhas são omitidas porque o horário não é uma data (por exemplo «${v.ejemplo_hora_no_entendida}»).`))}</li>` : ""}
            ${v.filas_sin_gps ? `<li>${esc(this.m(`${v.filas_sin_gps} filas traen posición 0, 0: es un GPS sin señal. Su medición se guarda, pero sin lugar en el mapa.`, `${v.filas_sin_gps} rows have position 0, 0: a GPS with no fix. Their reading is stored, but with no place on the map.`, `${v.filas_sin_gps} linhas têm posição 0, 0: GPS sem sinal. A medição é salva, mas sem lugar no mapa.`))}</li>` : ""}
          </ul>
          <div class="card-sub small" style="margin-bottom:10px">
            <div>${esc(this.m("Las horas de la hoja se leen en la zona horaria", "Sheet times are read in the time zone", "Os horários da planilha são lidos no fuso"))} <b>${esc(a.tz)}</b> ${esc(this.m("(la de este dispositivo).", "(this device's).", "(o deste dispositivo)."))}
              <details style="display:inline"><summary style="display:inline;cursor:pointer;color:var(--primario)">${esc(this.m("Cambiar", "Change", "Alterar"))}</summary>
                <input type="text" id="v2-inp-hoja-tz" class="field" value="${esc(a.tz)}" list="v2-tz-lista" style="margin-top:6px;min-height:40px"><datalist id="v2-tz-lista">${(Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : []).map(z => `<option value="${esc(z)}">`).join("")}</datalist>
                <button type="button" class="btn btn-sec btn-sm" id="v2-btn-hoja-releer">${esc(this.m("Volver a leer", "Read again", "Ler de novo"))}</button></details></div>
            ${v.dia_primero_detectado === "ambiguo" ? `<fieldset style="border:0;padding:0;margin:8px 0 0"><legend style="font-weight:600">${esc(this.m("Las fechas se pueden leer de dos formas. ¿Cuál va primero?", "The dates can be read two ways. Which comes first?", "As datas podem ser lidas de duas formas. O que vem primeiro?"))}</legend>
              <label style="margin-right:14px"><input type="radio" name="v2-hoja-dia" value="1" ${a.dia === true ? "checked" : ""}> ${esc(this.m("El día (25/12)", "The day (25/12)", "O dia (25/12)"))}</label>
              <label><input type="radio" name="v2-hoja-dia" value="0" ${a.dia === false ? "checked" : ""}> ${esc(this.m("El mes (12/25)", "The month (12/25)", "O mês (12/25)"))}</label></fieldset>` : ""}
          </div>`}
          <div class="row-wrap">
            <button type="button" class="btn btn-sec btn-sm" data-hoja-paso="1" style="min-height:44px">${esc(this.m("Atrás", "Back", "Voltar"))}</button>
            <button type="button" class="btn btn-pri btn-sm" data-hoja-paso="3" style="min-height:44px" ${v.tiene_hora && v.lecturas_validas && (v.dia_primero_detectado !== "ambiguo" || a.dia != null) ? "" : "disabled"}>${esc(this.m("Está bien, seguir", "Looks right, continue", "Está certo, continuar"))}</button>
          </div>`;
      }
      const vars = v.columnas.filter(c => c.papel === "variable");
      return `${cab}${err}
        <p class="small" style="margin:0 0 8px">${esc(this.m("Pon a cada medición un nombre claro y su unidad. La unidad no se adivina: escríbela como la mide el robot. Si no la sabes, déjala vacía y se mostrará sin unidad.", "Give each measurement a clear name and its unit. The unit is not guessed: enter it as the robot measures it. If you don't know it, leave it empty and it will be shown without a unit.", "Dê a cada medição um nome claro e sua unidade. A unidade não é adivinhada: escreva como o robô mede. Se não souber, deixe vazio e será mostrada sem unidade."))}</p>
        <div class="table-wrap" style="margin-bottom:10px"><table class="v2-table">
          <thead><tr><th>${esc(this.m("Columna", "Column", "Coluna"))}</th><th>${esc(this.m("Nombre que verás", "Name you will see", "Nome que você verá"))}</th><th>${esc(this.m("Unidad", "Unit", "Unidade"))}</th><th>${esc(this.m("Mínimo normal", "Normal minimum", "Mínimo normal"))}</th><th>${esc(this.m("Máximo normal", "Normal maximum", "Máximo normal"))}</th></tr></thead>
          <tbody>${vars.map(c => { const x = a.vars[c.clave] || {}; return `<tr>
            <td><b>${esc(c.columna)}</b><div class="xs mut">${esc(this.m("ej.", "e.g.", "ex."))} ${esc(c.ejemplo ?? "—")}</div></td>
            <td><input type="text" class="field" data-hoja-var="${esc(c.clave)}" data-campo="nombre" value="${esc(x.nombre || c.columna.trim())}" maxlength="60" style="min-height:40px;width:150px" aria-label="${esc(this.m("Nombre", "Name", "Nome"))}"></td>
            <td><input type="text" class="field" data-hoja-var="${esc(c.clave)}" data-campo="unidad" value="${esc(x.unidad ?? "")}" maxlength="20" list="v2-u-${esc(c.clave)}" style="min-height:40px;width:96px" aria-label="${esc(this.m("Unidad", "Unit", "Unidade"))}"><datalist id="v2-u-${esc(c.clave)}">${c.unidades_sugeridas.map(u => `<option value="${esc(u)}">`).join("")}</datalist></td>
            <td><input type="number" step="any" class="field" data-hoja-var="${esc(c.clave)}" data-campo="min" value="${esc(x.min ?? "")}" style="min-height:40px;width:86px" aria-label="${esc(this.m("Mínimo", "Minimum", "Mínimo"))}"></td>
            <td><input type="number" step="any" class="field" data-hoja-var="${esc(c.clave)}" data-campo="max" value="${esc(x.max ?? "")}" style="min-height:40px;width:86px" aria-label="${esc(this.m("Máximo", "Maximum", "Máximo"))}"></td></tr>`; }).join("")}</tbody>
        </table></div>
        <p class="xs mut" style="margin:0 0 10px">${esc(this.m("El mínimo y el máximo son opcionales. Si los pones, una lectura fuera de ellos enciende una alerta y se dirá que el rango lo definiste tú.", "Minimum and maximum are optional. If you set them, a reading outside them raises an alert, labelled as a range you defined.", "Mínimo e máximo são opcionais. Se informar, uma leitura fora deles acende um alerta, indicado como faixa definida por você."))}</p>
        <div class="row-wrap">
          <button type="button" class="btn btn-sec btn-sm" data-hoja-paso="2" style="min-height:44px">${esc(this.m("Atrás", "Back", "Voltar"))}</button>
          <button type="button" class="btn btn-pri btn-sm" id="v2-btn-hoja-guardar" style="min-height:44px">${ic("save", "sm")} <span>${esc(this.m("Guardar y conectar", "Save and connect", "Salvar e conectar"))}</span></button>
        </div>`;
    },

    // Código de Apps Script para que la hoja reciba lo que manda el robot. Sale de las columnas reales de la hoja.
    appScript() {
      const cols = this.asistente?.vista?.columnas?.map(c => c.columna.trim()) || this.robotData?.hoja?.columnas || [];
      if (!cols.length) return "";
      const hora = cols.find(c => ["hora", "fecha", "tiempo", "t", "timestamp", "time", "datetime"].includes(c.toLowerCase())) || cols[0];
      return `// Field Shift — pega esto en la hoja: Extensiones > Apps Script. Luego: Implementar > Nueva implementación > Aplicación web,
// "Ejecutar como: yo" y "Quién tiene acceso: cualquier persona". La dirección que termina en /exec es a donde el robot manda sus datos.
const COLUMNAS = ${JSON.stringify(cols)};

function doPost(e) {
  const datos = JSON.parse(e.postData.contents);          // una lectura {…} o varias [{…}, {…}]
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const filas = Array.isArray(datos) ? datos : [datos];
  filas.forEach(function (f) {
    hoja.appendRow(COLUMNAS.map(function (c) {
      if (c === ${JSON.stringify(hora)}) return f[c] || new Date().toISOString();   // hora en ISO con zona: no hay duda de día/mes ni de huso
      return f[c] === undefined ? "" : f[c];
    }));
  });
  return ContentService.createTextOutput(JSON.stringify({ ok: true, filas: filas.length })).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput("Esta hoja recibe lecturas del robot por POST.");
}`;
    },

    renderWorkspaceHtml() {
      const est = this.robotData || {};
      const hoja = est.hoja || {};
      const hay = (est.lecturas || 0) > 0;
      if (!hoja.conectada && !this.asistente) this.abrirAsistente();
      const script = this.appScript();

      const ruta = this.rutaPuntos.length ? `
        <div class="table-wrap" style="max-height:260px;overflow:auto"><table class="v2-table">
          <thead><tr><th>#</th><th>${esc(this.m("Coordenadas", "Coordinates", "Coordenadas"))}</th><th>${esc(this.m("Hora", "Time", "Horário"))}</th></tr></thead>
          <tbody>${this.rutaPuntos.slice(-100).map(p => `<tr><td>${p.punto}</td><td class="coord-mono">${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}</td><td class="xs mut">${esc(new Date(p.t).toLocaleString())}</td></tr>`).join("")}</tbody>
        </table></div>` : `<div class="notice info">${ic("info", "sm")}<div class="small">${esc(this.m("La ruta se dibuja cuando el robot manda su posición (columnas de latitud y longitud). Todavía no llegó ninguna.", "The route is drawn once the robot sends its position (latitude and longitude columns). None has arrived yet.", "A rota é desenhada quando o robô envia sua posição (colunas de latitude e longitude). Ainda não chegou nenhuma."))}</div></div>`;

      const conPos = this.variablesConPosicion();

      return `
        <div class="workspace-inner robot-workspace-inner">
          <!-- Video de pruebas de hardware real en loop -->
          <div class="rover-hardware-card">
            <div class="rover-video-container">
              <video autoplay muted playsinline loop src="recursos/rover_prueba_1.mp4"></video>
              <div class="rover-video-overlay">
                <div class="rover-video-live-pill"><span class="rover-live-pulse"></span> ${esc(this.m("Hardware real · Ensayos IoT", "Real hardware · IoT test feed", "Hardware real · Testes IoT"))}</div>
                <div class="rover-video-switcher">
                  <button type="button" class="rover-vid-btn active" data-vid-src="recursos/rover_prueba_1.mp4">${esc(this.m("Prueba 1 (Banco)", "Test 1 (Bench)", "Teste 1 (Bancada)"))}</button>
                  <button type="button" class="rover-vid-btn" data-vid-src="recursos/rover_prueba_2.mp4">${esc(this.m("Prueba 2 (Campo)", "Test 2 (Field)", "Teste 2 (Campo)"))}</button>
                </div>
              </div>
            </div>
            <div class="rover-hardware-meta">
              <div class="rover-hardware-title">
                <b>${ic("sensor", "sm")} ${esc(this.m("Pruebas físicas del rover", "Physical rover test runs", "Testes físicos do robô"))}</b>
                <span class="sem-badge ok" style="font-size:11px">${esc(this.m("Video en loop", "Looping video", "Vídeo em loop"))}</span>
              </div>
              <p class="small mut" style="margin:4px 0 8px">
                ${esc(this.m(
                  "Ensayos físicos de campo y banco del rover. La telemetría en Google Sheets proviene de las pruebas de este prototipo.",
                  "Physical field and bench trials of the rover. Telemetry in Google Sheets comes from tests of this prototype.",
                  "Testes físicos de campo e bancada do robô. A telemetria na planilha Google vem dos ensaios deste protótipo."
                ))}
              </p>
              <div class="notice info" style="padding:8px 12px;font-size:12px;line-height:1.4">
                ${ic("info", "sm")}
                <span>${esc(this.m(
                  "La verdad agronómica del lote en Iowa la miden Sentinel-2 y NASA POWER; los datos de la hoja reflejan la respuesta mecánica del sensor local.",
                  "The agronomic ground truth for the Iowa parcel is measured by Sentinel-2 and NASA POWER; sheet data reflects physical bench sensor response.",
                  "A verdade agronômica do lote em Iowa é medida por Sentinel-2 e NASA POWER; os dados da planilha refletem a resposta do sensor físico."
                ))}</span>
              </div>
            </div>
          </div>

          ${hay ? this.estadoHtml(est) : ""}

          <div class="card">
            <h2 class="card-title">${ic("sensor", "sm")} <span>${esc(this.m("Hoja de Google del robot", "The robot's Google Sheet", "Planilha Google do robô"))}</span></h2>
            ${this.asistente ? this.asistenteHtml() : this.hojaVivaHtml(hoja)}
            <div id="v2-robot-hoja-out" style="margin-top:10px"></div>
          </div>

          ${this.ultimasLecturas.length ? `
          <div class="card">
            <div class="row-between" style="margin-bottom:8px">
              <h2 class="card-title" style="margin:0">${ic("chart", "sm")} <span>${esc(this.m("Lo que el robot está mandando", "What the robot is sending", "O que o robô está enviando"))}</span></h2>
              ${conPos.length ? `<button type="button" class="btn btn-sec btn-sm" id="v2-btn-robot-mapa" data-var="${esc(conPos[0].variable)}" style="min-height:44px">${ic("map", "sm")} <span>${esc(this.m("Ver en el mapa de cuadros", "See on the grid map", "Ver no mapa de quadros"))}</span></button>` : ""}
            </div>
            <div class="table-wrap"><table class="v2-table">
              <thead><tr><th>${esc(this.m("Variable", "Variable", "Variável"))}</th><th>${esc(this.m("Última lectura", "Latest reading", "Última leitura"))}</th><th>${esc(this.m("Hora", "Time", "Horário"))}</th><th>${esc(this.m("Calidad", "Quality", "Qualidade"))}</th></tr></thead>
              <tbody>${this.ultimasLecturas.map(v => `<tr>
                <td><b>${esc(v.nombre || v.variable)}</b><div class="xs mut">${esc(v.variable)}</div></td>
                <td>${esc(String(v.valor))} ${v.unidad ? esc(v.unidad) : `<span class="xs mut">${esc(this.m("(sin unidad definida)", "(no unit set)", "(sem unidade definida)"))}</span>`}</td>
                <td class="xs mut">${esc(new Date(v.t).toLocaleString())}</td>
                <td class="xs">${v.rango_fisico ? (v.fuera_de_rango_fisico ? `<span style="color:var(--riesgo);font-weight:700">${esc(this.m(`${v.fuera_de_rango_fisico} de ${v.total_lecturas} lecturas imposibles`, `${v.fuera_de_rango_fisico} of ${v.total_lecturas} impossible readings`, `${v.fuera_de_rango_fisico} de ${v.total_lecturas} leituras impossíveis`))}</span>` : esc(this.m(`${v.total_lecturas} lecturas dentro de lo posible`, `${v.total_lecturas} readings within what is possible`, `${v.total_lecturas} leituras dentro do possível`)))
                  + `<div class="mut">${esc(v.rango_fisico.porque)}</div>` : `<span class="mut">${esc(this.m("Sin unidad no se puede revisar", "Cannot be checked without a unit", "Sem unidade não dá para conferir"))}</span>`}</td></tr>`).join("")}</tbody>
            </table></div>
          </div>` : ""}

          <div class="card">
            <div class="row-between" style="margin-bottom:10px">
              <h2 class="card-title" style="margin:0">${ic("compass", "sm")} <span>${esc(this.m("Ruta y posición", "Route and position", "Rota e posição"))}</span></h2>
              ${this.rutaPuntos.length ? `<button type="button" class="btn btn-sec btn-sm" id="v2-btn-export-ruta">${ic("download", "sm")} <span>${esc(this.m("Bajar ruta (CSV)", "Download route (CSV)", "Baixar rota (CSV)"))}</span></button>` : ""}
            </div>
            ${ruta}
          </div>

          ${script ? `<details class="card">
            <summary class="card-title" style="cursor:pointer">${ic("upload", "sm")} <span>${esc(this.m("Código para que la hoja reciba los datos del robot (Apps Script)", "Code for the sheet to receive the robot's data (Apps Script)", "Código para a planilha receber os dados do robô (Apps Script)"))}</span></summary>
            <p class="small mut" style="margin:8px 0">${esc(this.m("Está armado con las columnas de tu hoja. El robot manda sus lecturas a la dirección que termina en /exec; Field Shift solo lee la hoja.", "It is built from your sheet's columns. The robot sends its readings to the address ending in /exec; Field Shift only reads the sheet.", "É montado com as colunas da sua planilha. O robô envia as leituras para o endereço que termina em /exec; o Field Shift só lê a planilha."))}</p>
            <ol class="small" style="margin:0 0 8px 18px;padding:0">
              <li>${this.m("En la hoja abre <b>Extensiones &gt; Apps Script</b> y pega el código.", "In the sheet open <b>Extensions &gt; Apps Script</b> and paste the code.", "Na planilha abra <b>Extensões &gt; Apps Script</b> e cole o código.")}</li>
              <li>${this.m("Toca <b>Implementar &gt; Nueva implementación</b> y elige <b>Aplicación web</b>.", "Click <b>Deploy &gt; New deployment</b> and choose <b>Web app</b>.", "Toque em <b>Implantar &gt; Nova implantação</b> e escolha <b>App da Web</b>.")}</li>
              <li>${this.m("En <b>Quién tiene acceso</b> elige <b>Cualquier persona</b> y toca <b>Implementar</b>.", "Under <b>Who has access</b> choose <b>Anyone</b> and click <b>Deploy</b>.", "Em <b>Quem pode acessar</b> escolha <b>Qualquer pessoa</b> e toque em <b>Implantar</b>.")}</li>
              <li>${this.m("Copia la dirección que termina en <b>/exec</b> y ponla en el robot.", "Copy the address ending in <b>/exec</b> and set it in the robot.", "Copie o endereço que termina em <b>/exec</b> e coloque no robô.")}</li>
            </ol>
            <button type="button" class="btn btn-sec btn-sm" id="v2-btn-copiar-script" style="min-height:44px">${esc(this.m("Copiar código", "Copy code", "Copiar código"))}</button>
            <pre id="v2-appscript" class="card-sub xs" style="max-height:280px;overflow:auto;margin-top:8px;white-space:pre">${esc(script)}</pre>
          </details>` : ""}

          <div class="card">
            <h2 class="card-title">${ic("upload", "sm")} <span>${esc(this.m("Subir un archivo del robot (CSV o Excel)", "Upload a robot file (CSV or Excel)", "Enviar um arquivo do robô (CSV ou Excel)"))}</span></h2>
            <p class="small mut" style="margin:0 0 12px">${esc(this.m("Una fila por instante y una columna por variable, con una columna de hora.", "One row per moment and one column per variable, with a time column.", "Uma linha por instante e uma coluna por variável, com uma coluna de horário."))}</p>
            <form id="v2-form-import-robot" style="display:flex;flex-direction:column;gap:12px">
              <label class="small"><b>${esc(this.m("Archivo (.csv o .xlsx)", "File (.csv or .xlsx)", "Arquivo (.csv ou .xlsx)"))}</b><input type="file" id="v2-file-robot-data" class="field" accept=".csv,.xlsx" required style="width:100%;margin-top:4px"></label>
              <div><button type="submit" class="btn btn-pri btn-sm" style="min-height:44px">${ic("upload", "sm")} <span>${esc(this.m("Guardar lecturas", "Store readings", "Salvar leituras"))}</span></button></div>
            </form>
            <div id="v2-robot-import-out" style="margin-top:10px"></div>
          </div>
        </div>`;
    },

    aviso(box, ok, html) {
      if (box) box.innerHTML = `<div class="notice ${ok ? "ok" : "riesgo"}">${ic(ok ? "ok" : "riesgo", "sm")}<div class="small">${html}</div></div>`;
    },

    abrirAsistente() {
      const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
      this.asistente = { paso: 1, url: "", vista: null, tz, dia: null, vars: {}, error: "" };
    },

    async leerVista() {
      const a = this.asistente;
      a.error = "";
      window.V2.startProgress(this.m("Leyendo la hoja…", "Reading the sheet…", "Lendo a planilha…"));
      try {
        a.vista = await window.V2Adapter.robotVistaHoja({ url: a.url, zona_horaria: a.tz, dia_primero: a.dia });
        if (a.vista.dia_primero_detectado !== "ambiguo") a.dia = a.vista.dia_primero_detectado === true;
        Object.entries(a.vista.variables_actuales || {}).forEach(([k, x]) => { a.vars[k] = a.vars[k] || { ...x }; });
        a.paso = 2;
      } catch (err) {
        a.error = err.message;
      } finally {
        window.V2.stopProgress();
        window.V2.renderActiveViews();
      }
    },

    async guardarAsistente() {
      const a = this.asistente;
      a.error = "";
      window.V2.startProgress(this.m("Guardando y leyendo la hoja…", "Saving and reading the sheet…", "Salvando e lendo a planilha…"));
      try {
        const variables = {};
        a.vista.columnas.filter(c => c.papel === "variable").forEach(c => {
          const x = a.vars[c.clave] || {};
          const lim = (x.min != null && x.min !== "") || (x.max != null && x.max !== "");
          variables[c.clave] = { nombre: (x.nombre || c.columna).trim(), unidad: (x.unidad || "").trim(), min: x.min ?? "", max: x.max ?? "", ...(lim ? { origen: "definido por ti" } : {}) };
        });
        await window.V2Adapter.robotGuardarConfig(variables);
        const r = await window.V2Adapter.robotConectarHoja({ url: a.url, robot: "robot", zona_horaria: a.tz, dia_primero: a.dia === true });
        this.asistente = null;
        await this.cargarDatos();
        window.V2.renderActiveViews();
        this.aviso(document.getElementById("v2-robot-hoja-out"), true, esc(this.m(`Listo: ${r.guardadas} lecturas guardadas de ${r.filas_hoja} filas; ${r.filas_omitidas} filas omitidas.`, `Done: ${r.guardadas} readings stored from ${r.filas_hoja} rows; ${r.filas_omitidas} rows skipped.`, `Pronto: ${r.guardadas} leituras salvas de ${r.filas_hoja} linhas; ${r.filas_omitidas} linhas omitidas.`)));
      } catch (err) {
        a.error = err.message;
        window.V2.renderActiveViews();
      } finally {
        window.V2.stopProgress();
      }
    },

    bindEvents() {
      // La cuenta atrás de la próxima lectura corre con el reloj, sin redibujar la pantalla
      setInterval(() => {
        const el = document.getElementById("v2-hoja-prox");
        if (el) el.textContent = `${Math.max(0, Math.round(+el.dataset.s - (Date.now() - +el.dataset.t) / 1000))} s`;
      }, 1000);

      document.addEventListener("click", async (e) => {
        const t = e.target;
        if (t.closest("#v2-btn-export-ruta")) return this.exportarRuta();
        if (t.closest("#v2-btn-hoja-cambiar")) { this.abrirAsistente(); return window.V2.renderActiveViews(); }
        if (t.closest("#v2-btn-hoja-cancelar")) { this.asistente = null; return window.V2.renderActiveViews(); }
        if (t.closest("#v2-btn-hoja-guardar")) return this.guardarAsistente();
        if (t.closest("#v2-btn-hoja-releer")) { this.asistente.tz = document.getElementById("v2-inp-hoja-tz")?.value.trim() || this.asistente.tz; return this.leerVista(); }
        if (t.closest("#v2-btn-copiar-script")) {
          try { await navigator.clipboard.writeText(this.appScript()); window.V2.showToast(this.m("Código copiado.", "Code copied.", "Código copiado."), 2500); }
          catch (_) { window.V2.showToast(this.m("No se pudo copiar: selecciónalo y cópialo a mano.", "Could not copy: select it and copy by hand.", "Não foi possível copiar: selecione e copie à mão."), 4000); }
          return;
        }
        const pm = t.closest("#v2-btn-robot-mapa");
        if (pm) { window.V2.colorMode = "robot:" + pm.dataset.var; window.V2.setSpace("mapa"); window.V2Map.drawGridCells(); return; }
        const paso = t.closest("[data-hoja-paso]");
        if (paso && this.asistente && !paso.disabled) { this.asistente.paso = +paso.dataset.hojaPaso; this.asistente.error = ""; return window.V2.renderActiveViews(); }
        if (t.closest("#v2-btn-hoja-sync")) {
          try {
            const r = await window.V2.correrTrabajo({ tipo: "hoja" }, tr("tr_hoja"));
            await this.cargarDatos();
            window.V2.renderActiveViews();
            this.aviso(document.getElementById("v2-robot-hoja-out"), true, esc(this.m(`${r.filas_nuevas} filas nuevas, ${r.guardadas} lecturas guardadas.`, `${r.filas_nuevas} new rows, ${r.guardadas} readings stored.`, `${r.filas_nuevas} linhas novas, ${r.guardadas} leituras salvas.`)));
          } catch (err) {
            this.aviso(document.getElementById("v2-robot-hoja-out"), false, esc(err.message));
          }
        }
      });

      document.addEventListener("input", (e) => {
        const t = e.target, a = this.asistente;
        if (!a) return;
        if (t.id === "v2-inp-hoja-url") a.url = t.value.trim();
        else if (t.dataset.hojaVar) (a.vars[t.dataset.hojaVar] = a.vars[t.dataset.hojaVar] || {})[t.dataset.campo] = t.value;
      });

      document.addEventListener("change", (e) => {
        if (e.target.name === "v2-hoja-dia" && this.asistente) { this.asistente.dia = e.target.value === "1"; this.leerVista(); }
      });

      document.addEventListener("submit", async (e) => {
        if (e.target.id === "v2-form-hoja-vista") {
          e.preventDefault();
          this.asistente.url = document.getElementById("v2-inp-hoja-url").value.trim();
          this.leerVista();
        }

        if (e.target.id === "v2-form-import-robot") {
          e.preventDefault();
          const file = document.getElementById("v2-file-robot-data")?.files?.[0], box = document.getElementById("v2-robot-import-out");
          if (!file) return this.aviso(box, false, esc(this.m("Elige un archivo .csv o .xlsx", "Choose a .csv or .xlsx file", "Escolha um arquivo .csv ou .xlsx")));
          window.V2.startProgress(this.m("Subiendo lecturas del robot…", "Uploading robot readings…", "Enviando leituras do robô…"));
          try {
            const r = await window.V2Adapter.robotImportar(file);
            await this.cargarDatos();
            window.V2.renderActiveViews();
            this.aviso(document.getElementById("v2-robot-import-out"), true, esc(this.m(`${r.guardadas} lecturas guardadas de ${r.filas_leidas} filas; ${r.filas_omitidas} filas omitidas.`, `${r.guardadas} readings stored from ${r.filas_leidas} rows; ${r.filas_omitidas} rows skipped.`, `${r.guardadas} leituras salvas de ${r.filas_leidas} linhas; ${r.filas_omitidas} linhas omitidas.`))
              + (r.columnas_ignoradas?.length ? ` ${esc(this.m("Columnas de texto que no se guardan:", "Text columns not stored:", "Colunas de texto não salvas:"))} ${esc(r.columnas_ignoradas.join(", "))}.` : ""));
          } catch (err) {
            this.aviso(box, false, esc(err.message));
          } finally {
            window.V2.stopProgress();
          }
        }
      });
    },

    exportarRuta() {
      const csv = ["punto,latitud,longitud,hora"].concat(this.rutaPuntos.map(p => `${p.punto},${p.lat},${p.lon},${p.t || ""}`)).join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      a.download = `ruta_robot_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    },
  };

  window.V2Robot = V2Robot;
  V2Robot.bindEvents();
})();
