// =============================================================================
// Terra Lab — Series reales para planear a largo plazo.
//  · Sentinel-2 L2A de julio, varios años (Microsoft Planetary Computer): zonas estables, anomalías, prescripción.
//  · NASA POWER diario 1985–hoy: ET0 Penman-Monteith, balance de agua, drenaje, nitrato, erosividad, extremos.
//  · Open-Meteo: temperatura del suelo (ERA5) y relieve (DEM Copernicus 90 m).
//  · Modelos simples y declarados: carbono del suelo (ICBM), portafolio por rotación, riego, cal, N, P y K, secado.
// Lo que sale de un supuesto lo dice. Lo que no tiene dato real no se inventa.
// =============================================================================
(function () {
  "use strict";
  const A = window.V2Agro; if (!A) return;
  const m = (es, en, pt) => (window.V2?.lang === "en" ? en : window.V2?.lang === "pt" ? pt : es);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const PC = "https://planetarycomputer.microsoft.com/api";
  const POWER = "https://power.larc.nasa.gov/api/temporal/daily/point";
  const r0 = (x) => Math.round(x), r1 = (x) => Math.round(x * 10) / 10, pc = (x) => `${Math.round(x * 100)} %`;
  const media = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
  const cuantil = (xs, q) => { const s = [...xs].sort((a, b) => a < b ? -1 : a > b ? 1 : 0); return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))]; };
  const gd = (tx, tn, b) => tn >= b ? (tx + tn) / 2 - b : tx <= b ? 0 : (tx - b) ** 2 / (2 * (tx - tn));
  const loc = () => window.V2?.D?.coordenadas_parcela || window.V2?.loc || {};
  const claveLoc = (p) => { const l = loc(); return `tl_${p}_${(+l.lat || 0).toFixed(3)}_${(+l.lon || 0).toFixed(3)}`; };
  const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (_) { return null; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const repintar = () => { if (window.V2?.space === "recom") window.V2.renderActiveViews(); };

  // Parámetros que el agrónomo puede cambiar (los valores por defecto son supuestos declarados).
  const DEF = { costoMaiz: 2000, costoSoya: 1350, precioN: 1.1, deuda: 0, capRate: 3.5, precioCO2: 30, sueloP: "", sueloK: "", riegoCapital: 2500, tasa: 5, drenCapital: 2200, drenGanNormal: 3, drenGanHumedo: 10 };
  const par = () => ({ ...DEF, ...(leer(claveLoc("par")) || {}) });

  Object.assign(A, {
    // ============================================================ 1. Sentinel-2 de julio, varios años
    grilla() {
      const cs = window.V2?.terrainResp?.celdas || []; if (!cs.length) return null;
      let s = 90, n = -90, w = 180, e = -180, rows = 0, cols = 0;
      for (const c of cs) { const [[a, b], [c2, d]] = c.limites; s = Math.min(s, a, c2); n = Math.max(n, a, c2); w = Math.min(w, b, d); e = Math.max(e, b, d); rows = Math.max(rows, c.fila + 1); cols = Math.max(cols, c.col + 1); }
      return { cs, bbox: [w, s, e, n], rows, cols };
    },
    async cargarJulios() {
      const g = this.grilla(); if (!g || this.cargandoJul) return this.julios;
      const k = claveLoc(`jul_${g.rows}x${g.cols}`);
      const c = leer(k); if (c && Date.now() - c.t < 7 * 864e5) return (this.julios = c);
      this.cargandoJul = true;
      const hoy = new Date(), ult = hoy.getUTCMonth() >= 7 ? hoy.getUTCFullYear() : hoy.getUTCFullYear() - 1, anios = [];
      for (let y = Math.max(2017, ult - 8); y <= ult; y++) anios.push(y);
      const res = { t: Date.now(), rows: g.rows, cols: g.cols, anios: {} };
      await Promise.all(anios.map(async (y) => {
        try {
          const st = await (await fetch(`${PC}/stac/v1/search`, { method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ collections: ["sentinel-2-l2a"], bbox: g.bbox, datetime: `${y}-07-05/${y}-08-10`, query: { "eo:cloud_cover": { lt: 10 } }, sortby: [{ field: "eo:cloud_cover", direction: "asc" }], limit: 1 }) })).json();
          const it = st.features?.[0]; if (!it) return;
          // Desde la línea base 04.00 la reflectancia trae +1000: se resta en las dos bandas.
          const off = parseFloat(it.properties["s2:processing_baseline"] || "0") >= 4 ? 2000 : 0;
          const u = `${PC}/data/v1/item/bbox/${g.bbox.join(",")}/${g.cols}x${g.rows}.png?collection=sentinel-2-l2a&item=${it.id}&expression=(B08_b1-B04_b1)/(B08_b1%2BB04_b1-${off})&rescale=-1,1`;
          const bmp = await createImageBitmap(await (await fetch(u)).blob());
          const cv = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(g.cols, g.rows) : Object.assign(document.createElement("canvas"), { width: g.cols, height: g.rows });
          const x = cv.getContext("2d"); x.drawImage(bmp, 0, 0, g.cols, g.rows);
          const d = x.getImageData(0, 0, g.cols, g.rows).data, v = new Array(g.rows * g.cols);
          for (let i = 0; i < v.length; i++) v[i] = d[i * 4 + 3] ? d[i * 4] : -1;
          res.anios[y] = { fecha: it.properties.datetime.slice(0, 10), nubes: r1(it.properties["eo:cloud_cover"]), id: it.id, v };
        } catch (_) {}
      }));
      this.cargandoJul = false;
      if (Object.keys(res.anios).length) { this.julios = res; guardar(k, res); } else this.julios = { error: true };
      repintar();
      return this.julios;
    },
    // NDVI de un cuadro en un año (la fila 0 de la imagen es el norte; la fila 0 de la grilla es el sur).
    ndviJul(y, c) { const J = this.julios, a = J?.anios?.[y]; if (!a) return null; const v = a.v[(J.rows - 1 - c.fila) * J.cols + c.col]; return v < 0 ? null : v / 255 * 2 - 1; },
    analisisJulios() {
      const J = this.julios, g = this.grilla(); if (!J?.anios || !g) return null;
      const ys = Object.keys(J.anios).map(Number).sort(); if (ys.length < 3) return null;
      // Tercil de cada cuadro dentro de su lote, cada año (relativo: quita el efecto del año).
      const terc = {}, medias = {};
      for (const y of ys) {
        const vals = g.cs.map(c => this.ndviJul(y, c)), ok = vals.filter(v => v != null);
        const q1 = cuantil(ok, 1 / 3), q2 = cuantil(ok, 2 / 3);
        terc[y] = vals.map(v => v == null ? 0 : v < q1 ? 1 : v < q2 ? 2 : 3); medias[y] = media(ok);
      }
      const zona = [], estab = [];
      g.cs.forEach((c, i) => {
        const cnt = [0, 0, 0, 0]; ys.forEach(y => cnt[terc[y][i]]++);
        const z = [1, 2, 3].reduce((a, b) => cnt[b] > cnt[a] ? b : a, 1);
        zona.push(z); estab.push(cnt[z] / ys.length);
      });
      const estables = estab.filter(x => x >= 0.7).length / estab.length;
      // Anomalía: el último julio contra el promedio de los anteriores, cuadro por cuadro.
      const ultimo = ys[ys.length - 1], previos = ys.slice(0, -1);
      const anom = g.cs.map(c => { const v = this.ndviJul(ultimo, c), p = previos.map(y => this.ndviJul(y, c)).filter(x => x != null); return v == null || !p.length ? null : v - media(p); });
      const malos = anom.filter(a => a != null && a < -0.1).length;
      const porZona = [1, 2, 3].map(z => { const vs = g.cs.map((c, i) => zona[i] === z ? this.ndviJul(ultimo, c) : null).filter(v => v != null); return { z, n: vs.length, media: media(vs), cv: Math.sqrt(media(vs.map(v => (v - media(vs)) ** 2))) / media(vs) }; });
      return { ys, medias, zona, estab, estables, ultimo, anom, malos, porZona, fechas: ys.map(y => J.anios[y].fecha) };
    },
    verJulioEnMapa() {
      const an = this.analisisJulios(), g = this.grilla(); if (!an || !g) return;
      if (!this._ndviOrig) this._ndviOrig = g.cs.map(c => c.ndvi);
      g.cs.forEach(c => { const v = this.ndviJul(an.ultimo, c); if (v != null) c.ndvi = +v.toFixed(3); });
      window.V2.terrainResp.fecha = this.julios.anios[an.ultimo].fecha;
      window.V2.setSpace("mapa"); window.V2Map?.drawGridCells?.();
      window.V2.showToast?.(m(`Mapa con el NDVI real de Sentinel-2 del ${window.V2.terrainResp.fecha}.`, `Map showing real Sentinel-2 NDVI from ${window.V2.terrainResp.fecha}.`, `Mapa com o NDVI real do Sentinel-2 de ${window.V2.terrainResp.fecha}.`), 5000);
    },

    // Zona de cada cuadro: la estable de varios años si existe; si no, por los cortes de la leyenda.
    zonaCelda(i, c) { const an = this._an; return an ? an.zona[i] : c.ndvi < 0.35 ? 1 : c.ndvi < 0.58 ? 2 : 3; },
    muestreoZonas(porZona) {
      const g = this.grilla(); if (!g) return null;
      this._an = this.analisisJulios();
      const d = (a, b) => Math.hypot((a.lat - b.lat) * 111320, (a.lon - b.lon) * 111320 * Math.cos(a.lat * Math.PI / 180));
      const pts = [];
      for (const z of [1, 2, 3]) {
        const gz = g.cs.filter((c, i) => c.ndvi != null && this.zonaCelda(i, c) === z); if (!gz.length) continue;
        // Número de muestras: n = (1.96 · CV / 0.10)², con el CV del NDVI de julio como indicador de variabilidad (supuesto).
        const pz = this._an?.porZona.find(x => x.z === z);
        const n = porZona || Math.max(2, Math.min(8, Math.ceil((1.96 * (pz?.cv || 0.1) / 0.10) ** 2)));
        const cx = { lat: media(gz.map(c => c.lat)), lon: media(gz.map(c => c.lon)) };
        const el = [gz.reduce((a, c) => d(c, cx) < d(a, cx) ? c : a)];
        while (el.length < Math.min(n, gz.length)) el.push(gz.reduce((a, c) => Math.min(...el.map(e => d(c, e))) > Math.min(...el.map(e => d(a, e))) ? c : a));
        el.forEach(c => pts.push({ zona: z, lat: c.lat, lon: c.lon, ndvi: c.ndvi, n: gz.length, nMuestras: n }));
      }
      return pts;
    },
    prescripcion() {
      const g = this.grilla(); if (!g) return;
      this._an = this.analisisJulios();
      const dens = { 1: 79000, 2: 84000, 3: 89000 };
      const feats = g.cs.filter(c => c.limites).map((c, i) => {
        const z = this.zonaCelda(g.cs.indexOf(c), c), [[la0, lo0], [la1, lo1]] = c.limites;
        return { type: "Feature", properties: { id: c.id, zona: z, estabilidad: this._an ? +this._an.estab[g.cs.indexOf(c)].toFixed(2) : null, semillas_ha: dens[z] }, geometry: { type: "Polygon", coordinates: [[[lo0, la0], [lo1, la0], [lo1, la1], [lo0, la1], [lo0, la0]]] } };
      });
      this.descargar("prescripcion_siembra.geojson", "application/geo+json", JSON.stringify({ type: "FeatureCollection", properties: { fuente: this._an ? `Zonas estables Sentinel-2 julio ${this._an.ys[0]}–${this._an.ultimo}` : "NDVI de la foto actual" }, features: feats }));
    },

    // ============================================================ 2. NASA POWER diario de 1985 a hoy
    async cargarDiario() {
      const l = loc(); if (!l.lat || this.cargandoDia) return this.diario;
      const k = claveLoc("dia3"); const c = leer(k); if (c && Date.now() - c.t < 864e5) return (this.diario = c);
      this.cargandoDia = true;
      const hoy = new Date(), fin = hoy.toISOString().slice(0, 10).replace(/-/g, "");
      try {
        const j = await (await fetch(`${POWER}?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS2M,ALLSKY_SFC_SW_DWN,TS&community=AG&longitude=${(+l.lon).toFixed(4)}&latitude=${(+l.lat).toFixed(4)}&start=19850101&end=${fin}&format=JSON`)).json();
        const P = j.properties.parameter, z = j.geometry?.coordinates?.[2] ?? 300;
        this.diario = { t: Date.now(), z, anios: this.balance(P, +l.lat, z) };
        guardar(k, this.diario);
      } catch (e) { this.diario = { error: String(e) }; }
      this.cargandoDia = false; repintar();
      return this.diario;
    },
    // ET0 de Penman-Monteith (FAO-56) con datos diarios.
    et0(tx, tn, rh, u2, rs, lat, doy, z) {
      const t = (tx + tn) / 2, es = (T) => 0.6108 * Math.exp(17.27 * T / (T + 237.3));
      const esm = (es(tx) + es(tn)) / 2, ea = esm * rh / 100, D = 4098 * es(t) / (t + 237.3) ** 2;
      const Pk = 101.3 * ((293 - 0.0065 * z) / 293) ** 5.26, g = 0.000665 * Pk;
      const phi = lat * Math.PI / 180, dr = 1 + 0.033 * Math.cos(2 * Math.PI * doy / 365), dl = 0.409 * Math.sin(2 * Math.PI * doy / 365 - 1.39);
      const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(dl))));
      const Ra = 24 * 60 / Math.PI * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(dl) + Math.cos(phi) * Math.cos(dl) * Math.sin(ws));
      const Rso = (0.75 + 2e-5 * z) * Ra, Rns = 0.77 * rs;
      const Rnl = 4.903e-9 * (((tx + 273.16) ** 4 + (tn + 273.16) ** 4) / 2) * (0.34 - 0.14 * Math.sqrt(Math.max(0, ea))) * (1.35 * Math.min(1, rs / Math.max(Rso, 0.1)) - 0.35);
      return Math.max(0, (0.408 * D * (Rns - Rnl) + g * 900 / (t + 273) * u2 * (esm - ea)) / (D + g * (1 + 0.34 * u2)));
    },
    // Balance de agua diario del perfil (cubeta con el agua útil de SSURGO) y resumen por año.
    balance(P, lat, z) {
      const awc = A.calcular().agua?.awc || 180, out = {};
      let S = awc, p1 = 0, p2 = 0; const ts = [];
      for (const k of Object.keys(P.T2M_MAX).sort()) {
        const tx = P.T2M_MAX[k], tn = P.T2M_MIN[k], pr = P.PRECTOTCORR[k], rh = P.RH2M[k], u2 = P.WS2M[k], rs = P.ALLSKY_SFC_SW_DWN[k];
        if ([tx, tn, pr, rh, u2, rs].some(v => v == null || v <= -998)) continue;
        const y = +k.slice(0, 4), mo = +k.slice(4, 6), dd = +k.slice(6, 8);
        const doy = Math.floor((Date.UTC(y, mo - 1, dd) - Date.UTC(y, 0, 0)) / 864e5);
        const o = out[y] = out[y] || { p: 0, et0: 0, etc: 0, eta: 0, dren: 0, drenPrim: 0, gdd: 0, kdd: 0, ei: 0, diasCalor: 0, diasLluviaMayo: 0, trabajables: 0, n: 0, ts10: null };
        // Superficie a 10 °C (5 días seguidos de media), desde el 1 de abril: aproxima el suelo listo para sembrar.
        const tsv = P.TS?.[k]; if (tsv != null && tsv > -998) { ts.push(tsv); if (ts.length > 5) ts.shift(); if (!o.ts10 && mo >= 4 && mo <= 6 && ts.length === 5 && ts.reduce((a2, b2) => a2 + b2, 0) / 5 >= 10) o.ts10 = k.slice(4, 6) + "-" + k.slice(6, 8); }
        // Kc del maíz por grados día desde el 1 de mayo (FAO-56: 0.3 inicial, 1.2 a media temporada, 0.6 al final); fuera de temporada 0.3.
        let kc = 0.3;
        if (mo >= 5 && mo <= 9) { o.gdd += gd(tx, tn, 10) - gd(tx, tn, 30); kc = o.gdd < 150 ? 0.3 : o.gdd < 700 ? 0.3 + 0.9 * (o.gdd - 150) / 550 : o.gdd < 1250 ? 1.2 : o.gdd < 1450 ? 1.2 - 0.6 * (o.gdd - 1250) / 200 : 0.35; }
        const e0 = tx < 0 ? 0 : this.et0(tx, tn, rh, u2, rs, lat, doy, z), etc = kc * e0;
        const eta = etc * Math.min(1, S / (0.45 * awc));   // estrés cuando se agota más del 55 % del agua útil (p = 0.55)
        S = S + pr - eta; let dren = 0; if (S > awc) { dren = S - awc; S = awc; } if (S < 0) S = 0;
        o.p += pr; o.dren += dren; if (mo >= 4 && mo <= 6) o.drenPrim += dren;
        if (mo >= 5 && mo <= 9) { o.et0 += e0; o.etc += etc; o.eta += eta; }
        if (mo >= 6 && mo <= 8) { o.kdd += gd(tx, tn, 29); if (tx >= 35) o.diasCalor++; }
        if (mo === 5 && pr >= 12.7) o.diasLluviaMayo++;
        // Día trabajable: sin lluvia ese día y menos de 10 mm en los dos días anteriores.
        if ((mo === 4 && dd >= 10) || (mo === 5 && dd <= 20)) if (pr < 3 && p1 + p2 < 10) o.trabajables++;
        p2 = p1; p1 = pr;
        // Erosividad diaria (Richardson et al. 1983): EI = 0.41 · P^1.81 MJ·mm/(ha·h·año), solo días con 12.7 mm o más.
        if (pr >= 12.7) o.ei += 0.41 * pr ** 1.81;
        o.n++;
      }
      for (const o of Object.values(out)) for (const k2 of Object.keys(o)) if (typeof o[k2] === "number") o[k2] = r1(o[k2]);
      return out;
    },
    resumenDiario() {
      const D = this.diario?.anios; if (!D) return null;
      const anioAct = new Date().getUTCFullYear();
      const ys = Object.keys(D).map(Number).filter(y => y < anioAct && D[y].n > 360);
      if (ys.length < 20) return null;
      const awc = A.calcular().agua?.awc || 180;
      const R = media(ys.map(y => D[y].ei));   // SI; en unidades de EE. UU. = R / 17.02
      const deficit = ys.filter(y => D[y].etc - D[y].eta > 60), humedos = ys.filter(y => D[y].drenPrim > 250), calor = ys.filter(y => D[y].diasCalor >= 5);
      const dec = (arr) => r1(arr.length / ys.length * 10);
      return { ys, desde: ys[0], hasta: ys[ys.length - 1], act: D[anioAct], et0: r0(media(ys.map(y => D[y].et0))), etc: r0(media(ys.map(y => D[y].etc))), eta: r0(media(ys.map(y => D[y].eta))),
        dren: r0(media(ys.map(y => D[y].dren))), drenPrim: r0(media(ys.map(y => D[y].drenPrim))), R, Rus: r0(R / 17.02),
        deficit, humedos, calor, decDef: dec(deficit), decHum: dec(humedos), decCal: dec(calor), trab: r0(media(ys.map(y => D[y].trabajables))), awc, D };
    },

    // ============================================================ 3. Suelo para sembrar y relieve (Open-Meteo)
    async cargarSueloRelieve() {
      const l = loc(), g = this.grilla(); if (!l.lat || !g || this.cargandoSR) return this.sr;
      const k = claveLoc("sr"); const c = leer(k); if (c && Date.now() - c.t < 30 * 864e5) return (this.sr = c);
      this.cargandoSR = true;
      const res = { t: Date.now() };
      try {
        // 10 × 10 puntos de elevación sobre el lote → pendiente por diferencias finitas.
        const [w, s, e, n] = g.bbox, N = 10, la = [], lo = [];
        for (let i = 0; i < N; i++) for (let j2 = 0; j2 < N; j2++) { la.push((s + (n - s) * (i + 0.5) / N).toFixed(5)); lo.push((w + (e - w) * (j2 + 0.5) / N).toFixed(5)); }
        const el = (await (await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${la.join(",")}&longitude=${lo.join(",")}`)).json()).elevation;
        const dy = (n - s) / N * 111320, dx = (e - w) / N * 111320 * Math.cos(s * Math.PI / 180), pend = [];
        for (let i = 1; i < N - 1; i++) for (let j2 = 1; j2 < N - 1; j2++) {
          const gx = (el[i * N + j2 + 1] - el[i * N + j2 - 1]) / (2 * dx), gy = (el[(i + 1) * N + j2] - el[(i - 1) * N + j2]) / (2 * dy);
          pend.push(Math.hypot(gx, gy) * 100);
        }
        res.relieve = { min: Math.min(...el), max: Math.max(...el), pend: r1(media(pend)), pendMax: r1(Math.max(...pend)) };
      } catch (_) {}
      this.sr = res; if (res.relieve) guardar(k, res);
      this.cargandoSR = false; repintar();
      return res;
    },

    // ============================================================ 4. Modelos
    // Rendimiento relativo por año con clima real: maíz (calor > 29 °C, Ky 1.25) y soya (calor > 30 °C, Ky 0.85).
    rendAnio(o, cultivo) {
      const ky = cultivo === "soya" ? 0.85 : 1.25, kc = cultivo === "soya" ? 0.005 : 0.0065;
      const agua = Math.max(0, 1 - ky * (1 - o.eta / Math.max(o.etc, 1)));
      return Math.exp(-kc * o.kdd) * agua;
    },
    // Precio de cada año llevado al nivel de hoy: precio real (sin inflación) del año ÷ precio real de los últimos 12 meses × precio USDA de hoy.
    preciosAnio() {
      const H = window.FS_PRECIOS, e = A.calcular().economia; if (!H || !e) return null;
      const u = H.ult12, out = {};
      H.anios.forEach((y, i) => {
        const fM = (H.maiz[i] / H.cpi[i]) / (u.maiz / u.cpi), fS = (H.soya[i] / H.cpi[i]) / (u.soya / u.cpi), fN = (H.ppiN[i] / H.cpi[i]) / (u.ppiN / u.cpi);
        out[y] = { pM: e.precioT * fM, pS: (e.soyaT || 428) * fS, fN };
      });
      return out;
    },
    portafolio() {
      const rd = this.resumenDiario(), e = A.calcular().economia, q = par(); if (!rd || !e) return null;
      const yM = +(window.V2?.farmExtra?.yieldMaize) || 12.6, yS = 3.9;   // rendimientos promedio de Iowa (supuesto editable)
      const pa = this.preciosAnio();
      const ys = pa ? rd.ys.filter(y => pa[y]) : rd.ys;   // con precios: solo los años que tienen clima y precio reales
      const rel = (c) => { const v = ys.map(y => this.rendAnio(rd.D[y], c)), b = media(v); return v.map(x => 1 - 0.6 * (1 - x / b)); };   // misma calibración 0.6
      const rM = rel("maiz"), rS = rel("soya");
      const pM = ys.map(y => pa ? pa[y].pM : e.precioT), pS = ys.map(y => pa ? pa[y].pS : e.soyaT || 428), pN = ys.map(y => q.precioN * (pa ? pa[y].fN : 1));
      // Maíz tras maíz rinde ~10 % menos que tras soya (efecto rotación, ISU) y pide ~60 kg más de N.
      const esc = {
        maizSoya: ys.map((_, i) => ((yM * rM[i] * pM[i] - q.costoMaiz) + (yS * rS[i] * pS[i] - q.costoSoya)) / 2),
        maizMaiz: ys.map((_, i) => yM * 0.9 * rM[i] * pM[i] - q.costoMaiz - 60 * pN[i]),
        soyaSoya: ys.map((_, i) => yS * 0.95 * rS[i] * pS[i] - q.costoSoya),
      };
      const out = {};
      for (const [k, v] of Object.entries(esc)) { const peor = v.indexOf(Math.min(...v)); out[k] = { media: r0(media(v)), p5: r0(cuantil(v, 0.05)), peor: r0(v[peor]), anioPeor: ys[peor], pPerdida: v.filter(x => x < 0).length / v.length }; }
      // ¿El precio compensa los años malos? Correlación entre rendimiento de maíz y precio del mismo año.
      const corr = (a, b) => { const ma = media(a), mb = media(b); return a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0) / Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0) * b.reduce((s, x) => s + (x - mb) ** 2, 0)); };
      return { out, n: ys.length, desde: ys[0], hasta: ys[ys.length - 1], conPrecios: !!pa, corr: pa ? +corr(rM, pM).toFixed(2) : null, pM: e.precioT, pS: e.soyaT || 428, yM, yS, q };
    },
    insumos() {
      const H = window.FS_PRECIOS, e = A.calcular().economia, q = par(); if (!H || !e) return null;
      const real = H.anios.map((y, i) => H.ppiN[i] / H.cpi[i]), hoy = H.ult12.ppiN / H.ult12.cpi;
      const cv = Math.sqrt(media(real.map(v => (v - media(real)) ** 2))) / media(real);
      const caidas = real.slice(1).map((v, i) => v / real[i] - 1), salto = Math.max(...caidas), anioSalto = H.anios[caidas.indexOf(salto) + 1];
      const pct = real.filter(v => v <= hoy).length / real.length;
      // Razón de precios N:maíz (USD/lb ÷ USD/bu) de cada año, con los niveles de hoy.
      const pa = this.preciosAnio();
      const ratios = H.anios.map(y => (q.precioN * pa[y].fN / 2.2046) / (pa[y].pM / 39.368));
      return { cv: +cv.toFixed(2), salto: +salto.toFixed(2), anioSalto, pct, rMin: +Math.min(...ratios).toFixed(3), rMax: +Math.max(...ratios).toFixed(3), rMed: +cuantil(ratios, 0.5).toFixed(3), desde: H.anios[0], hasta: H.anios[H.anios.length - 1] };
    },
    // Semivariograma del NDVI de julio: a qué distancia dos cuadros dejan de parecerse.
    semivariograma() {
      const an = this.analisisJulios(), J = this.julios; if (!an || !J) return null;
      const a = J.anios[an.ultimo], R = J.rows, C = J.cols, lado = this.grilla().cs[0].lado_m || 10;
      const v = (r, c) => { const x = a.v[r * C + c]; return x < 0 ? null : x / 255 * 2 - 1; };
      const todos = a.v.filter(x => x >= 0).map(x => x / 255 * 2 - 1), sill = media(todos.map(x => (x - media(todos)) ** 2));
      const gam = [];
      for (let h = 1; h <= Math.floor(Math.min(R, C) / 2); h++) {
        let s = 0, n = 0;
        for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
          const x = v(r, c); if (x == null) continue;
          if (c + h < C) { const y = v(r, c + h); if (y != null) { s += (x - y) ** 2; n++; } }
          if (r + h < R) { const y = v(r + h, c); if (y != null) { s += (x - y) ** 2; n++; } }
        }
        gam.push(s / (2 * n));
      }
      const iR = gam.findIndex(g => g >= 0.95 * sill), rango = (iR < 0 ? gam.length : iR + 1) * lado, abierto = iR < 0;
      const ha = A.calcular().celdas?.ha || 1, nGrid = Math.ceil(ha * 1e4 / rango ** 2);
      return { rango, abierto, nGrid, pepita: +(gam[0] / sill).toFixed(2), sill: +sill.toFixed(4), lado };
    },
    drenajeVan() {
      const rd = this.resumenDiario(), e = A.calcular().economia, q = par(); if (!rd || !e) return null;
      const yM = +(window.V2?.farmExtra?.yieldMaize) || 12.6;
      // Supuestos editables: +3 % de rendimiento en años normales y +10 % en primaveras muy mojadas (suelo moderadamente bien drenado).
      const gan = rd.ys.map(y => (rd.D[y].drenPrim > 250 ? q.drenGanHumedo : q.drenGanNormal) / 100 * yM * e.precioT);
      const fa = (1 - (1 + q.tasa / 100) ** -20) / (q.tasa / 100);
      return { anual: r0(media(gan)), van: r0(media(gan) * fa - q.drenCapital), humedos: rd.humedos.length, n: rd.ys.length, q };
    },
    // Carbono del suelo con el modelo ICBM de dos compartimentos (Andrén y Kätterer 1997), 0–30 cm.
    carbono() {
      const s = A.calcular().suelo; if (!s?.mo) return null;
      const yM = +(window.V2?.farmExtra?.yieldMaize) || 12.6;
      const soc0 = s.mo / 1.724 / 100 * s.da * 30 * 100;   // t C/ha: %C × densidad × 30 cm
      const entradaRastrojo = yM * 0.85 * 1.0 * 0.45 * 1.2 * 0.5 + 3.9 * 0.85 * 1.5 * 0.45 * 1.2 * 0.5;   // rastrojo y raíces, maíz-soya alternados
      const correr = (r, extra) => { let Y = 0.1 * soc0, O = soc0 - Y; for (let t = 0; t < 30; t++) { const I = entradaRastrojo + extra; const dY = I - 0.8 * r * Y, dO = 0.125 * 0.8 * r * Y - 0.006 * r * O; Y += dY; O += dO; } return Y + O; };
      const conv = correr(1.3, 0), directa = correr(1.0, 0), cobertura = correr(1.0, 1.2);   // r: labranza acelera la descomposición (supuesto)
      const q = par();
      return { soc0: r1(soc0), conv: r1(conv - soc0), directa: r1(directa - soc0), cobertura: r1(cobertura - soc0),
        credito: r0(Math.max(0, cobertura - conv) * 44 / 12 / 30 * q.precioCO2), q };
    },
    riego() {
      const rd = this.resumenDiario(), e = A.calcular().economia, q = par(); if (!rd || !e) return null;
      const yM = +(window.V2?.farmExtra?.yieldMaize) || 12.6;
      const gan = rd.ys.map(y => { const o = rd.D[y], agua = Math.max(0, 1 - 1.25 * (1 - o.eta / Math.max(o.etc, 1))); return (1 - agua) * 0.6 * yM * e.precioT; });   // lo que el agua faltante quitó (calibrado)
      const anual = media(gan) - 150;   // 150 USD/ha/año de bombeo y mantenimiento (supuesto)
      const fa = (1 - (1 + q.tasa / 100) ** -20) / (q.tasa / 100);
      return { gananciaMedia: r0(media(gan)), anual: r0(anual), van: r0(anual * fa - q.riegoCapital), anios: rd.ys.filter((_, i) => gan[i] > 150).length, n: rd.ys.length, q };
    },
    nitrogeno() {
      const e = A.calcular().economia, rd = this.resumenDiario(), q = par(); if (!e) return null;
      const ratio = (q.precioN / 2.2046) / (e.precioT / 39.368);   // como la curva MRTN: USD por libra de N ÷ USD por bushel
      // Aproximación lineal de la curva MRTN de Iowa (maíz tras soya): 157 kg a razón 0.10, −6 kg por cada 0.01 más; tope 112–190.
      const base = Math.max(112, Math.min(190, 157 - 600 * (ratio - 0.10)));
      const prim = rd?.act?.drenPrim ?? null, extra = prim != null && rd ? (prim > rd.drenPrim * 1.5 ? 30 : prim < rd.drenPrim * 0.5 ? -15 : 0) : 0;
      return { ratio: +ratio.toFixed(3), base: r0(base), extra, total: r0(base + extra), prim: prim == null ? null : r0(prim), primMedia: rd?.drenPrim };
    },
    cal() {
      const s = A.calcular().suelo; if (!s?.ph) return null;
      const cic = 0.5 * s.c + 2 * s.mo;   // cmol/kg, estimación por arcilla y materia orgánica (supuesto)
      const acidoAnual = 157 * 1.8;   // kg CaCO3/ha por año: 1.8 kg por kg de N amoniacal
      const tampon = cic * 300;       // kg CaCO3/ha para bajar 1 unidad de pH en 0–15 cm (orden de magnitud)
      const anios = s.ph > 5.8 ? r0((s.ph - 5.8) * tampon / acidoAnual) : 0;
      return { cic: r1(cic), acidoAnual: r0(acidoAnual), anios, ph: s.ph };
    },
    pk() {
      const q = par(), yM = +(window.V2?.farmExtra?.yieldMaize) || 12.6, bu = yM * 15.93;   // bu/acre
      const remP = bu * 0.32 * 1.121, remK = bu * 0.22 * 1.121;   // kg/ha de P2O5 y K2O que se lleva la cosecha (ISU PM 1688)
      const catP = q.sueloP === "" ? null : +q.sueloP < 9 ? "muy bajo" : +q.sueloP < 16 ? "bajo" : +q.sueloP <= 20 ? "óptimo" : +q.sueloP <= 30 ? "alto" : "muy alto";
      const catK = q.sueloK === "" ? null : +q.sueloK < 120 ? "muy bajo" : +q.sueloK <= 160 ? "bajo" : +q.sueloK <= 200 ? "óptimo" : +q.sueloK <= 250 ? "alto" : "muy alto";
      const dosis = (cat, rem) => cat == null ? null : cat === "muy bajo" ? rem + 60 : cat === "bajo" ? rem + 30 : cat === "óptimo" ? rem : cat === "alto" ? 0 : 0;
      return { remP: r0(remP), remK: r0(remK), catP, catK, dP: dosis(catP, remP) && r0(dosis(catP, remP)), dK: dosis(catK, remK) && r0(dosis(catK, remK)), q };
    },
    secado() {
      const rd = this.resumenDiario(), p = A.calcular(); if (!rd?.act || !A.power) return null;
      const gdd = A.gradosDia(p.siembra?.ini || "05-01"); if (!gdd?.madurez) return null;
      // Desde la capa negra (~32 % de humedad) el grano pierde ~1 punto por cada 16 °C·día (orden de magnitud).
      const d = A.power.diario; let h = 32, fecha = null, ok = false;
      for (const k of Object.keys(d.T2M_MAX).sort()) {
        const f = `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6)}`; if (f <= gdd.madurez || d.T2M_MAX[k] <= -998) continue;
        h -= Math.max(0, gd(d.T2M_MAX[k], d.T2M_MIN[k], 10) - 0) / 16; if (h <= 20 && !ok) { fecha = f; ok = true; }
      }
      const yM = +(window.V2?.farmExtra?.yieldMaize) || 12.6, bu = yM * 15.93 * 2.471;
      return { madurez: gdd.madurez, fecha20: fecha, costo: r0(bu * (25 - 15.5) * 0.04) };   // si se cosecha al 25 %: 0.04 USD por bu por punto (supuesto)
    },
    valorTierra() {
      const pf = this.portafolio(), q = par(), proy = A.proyectar?.(A.calcular().agua?.awc); if (!pf) return null;
      const renta = pf.out.maizSoya.media; const hoy = renta / (q.capRate / 100);
      const en20 = proy ? hoy * (1 + proy.res[2].mediana * pf.yM * pf.pM / Math.max(renta, 1)) : null;
      return { renta, hoy: r0(hoy), en20: en20 == null ? null : r0(en20) };
    },
    banco() {
      const pf = this.portafolio(), q = par(); if (!pf) return null;
      const o = pf.out.maizSoya;
      return { media: o.media, p5: o.p5, cobertura: q.deuda > 0 ? +(o.media / q.deuda).toFixed(2) : null, coberturaP5: q.deuda > 0 ? +(o.p5 / q.deuda).toFixed(2) : null, q };
    },

    // ============================================================ 5. Bitácora y monitor de cosecha (datos del productor)
    bitacora() { return leer(claveLoc("bit")) || []; },
    agregarBitacora(e) { const b = this.bitacora(); b.push({ ...e, t: Date.now() }); guardar(claveLoc("bit"), b); repintar(); },
    async cargarCosechaCSV(file) {
      const txt = await file.text(), g = this.grilla(), an = this.analisisJulios(); if (!g || !an) return;
      const filas = txt.split(/\r?\n/).slice(1).map(l => l.split(/[,;\t]/).map(Number)).filter(r => r.length >= 3 && r.every(x => !Number.isNaN(x)));
      const pares = [];
      for (const [lat, lon, rend] of filas) {
        const c = g.cs.find(c2 => lat >= Math.min(c2.limites[0][0], c2.limites[1][0]) && lat <= Math.max(c2.limites[0][0], c2.limites[1][0]) && lon >= Math.min(c2.limites[0][1], c2.limites[1][1]) && lon <= Math.max(c2.limites[0][1], c2.limites[1][1]));
        const v = c && this.ndviJul(an.ultimo, c); if (v != null) pares.push([v, rend]);
      }
      if (pares.length < 10) { window.V2.showToast?.(m("Hacen falta al menos 10 puntos de cosecha dentro del lote.", "At least 10 yield points inside the field are needed.", "São necessários pelo menos 10 pontos de colheita no talhão."), 5000); return; }
      const mx = media(pares.map(p => p[0])), my = media(pares.map(p => p[1]));
      const b = pares.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / pares.reduce((s, p) => s + (p[0] - mx) ** 2, 0), a = my - b * mx;
      const ssr = pares.reduce((s, p) => s + (p[1] - (a + b * p[0])) ** 2, 0), sst = pares.reduce((s, p) => s + (p[1] - my) ** 2, 0);
      this.calibCosecha = { n: pares.length, a: +a.toFixed(2), b: +b.toFixed(2), r2: +(1 - ssr / sst).toFixed(2), rmse: +Math.sqrt(ssr / pares.length).toFixed(2) };
      guardar(claveLoc("cal"), this.calibCosecha); repintar();
    },

    // ============================================================ 6. Textos (los usan la tarjeta, la SI y el reporte)
    frasesExtra(F) {
      const an = this.analisisJulios();
      if (an) {
        F.zonasEstables = m(`Zonas estables con ${an.ys.length} julios reales de Sentinel-2 (${an.fechas.join(", ")}): el ${pc(an.estables)} de los cuadros cae en la misma zona al menos 7 de cada 10 años. Verdor medio de julio por año: ${an.ys.map(y => `${y} ${an.medias[y].toFixed(2)}`).join(", ")}. La prescripción y el muestreo ya usan estas zonas.`,
          `Stable zones from ${an.ys.length} real Sentinel-2 Julys (${an.fechas.join(", ")}): ${pc(an.estables)} of squares fall in the same zone at least 7 years in 10. Mean July NDVI by year: ${an.ys.map(y => `${y} ${an.medias[y].toFixed(2)}`).join(", ")}. Prescription and sampling now use these zones.`,
          `Zonas estáveis com ${an.ys.length} julhos reais do Sentinel-2 (${an.fechas.join(", ")}): ${pc(an.estables)} dos quadros caem na mesma zona pelo menos 7 de cada 10 anos. NDVI médio de julho por ano: ${an.ys.map(y => `${y} ${an.medias[y].toFixed(2)}`).join(", ")}. A prescrição e a amostragem já usam estas zonas.`);
        F.anomalias = m(`Anomalías de julio de ${an.ultimo} contra el promedio de ${an.ys[0]}–${an.ys[an.ys.length - 2]}: ${an.malos} cuadros (${pc(an.malos / an.anom.length)}) están más de 0.10 por debajo de su propio historial. Ahí conviene ir a ver.`,
          `July ${an.ultimo} anomalies against the ${an.ys[0]}–${an.ys[an.ys.length - 2]} average: ${an.malos} squares (${pc(an.malos / an.anom.length)}) are over 0.10 below their own history. Those are worth scouting.`,
          `Anomalias de julho de ${an.ultimo} contra a média de ${an.ys[0]}–${an.ys[an.ys.length - 2]}: ${an.malos} quadros (${pc(an.malos / an.anom.length)}) estão mais de 0,10 abaixo do próprio histórico. Vale a pena ir ver.`);
      }
      const rd = this.resumenDiario();
      if (rd) {
        F.etReal = m(`Evapotranspiración con datos diarios reales (Penman-Monteith FAO-56, NASA POWER ${rd.desde}–${rd.hasta}): referencia ${rd.et0} mm de mayo a septiembre; el maíz pide ${rd.etc} mm y usa ${rd.eta} mm en promedio.${rd.act ? ` Este año: pidió ${r0(rd.act.etc)} y usó ${r0(rd.act.eta)} mm.` : ""}`,
          `Evapotranspiration from real daily data (Penman-Monteith FAO-56, NASA POWER ${rd.desde}–${rd.hasta}): reference ${rd.et0} mm May–September; corn demands ${rd.etc} mm and uses ${rd.eta} mm on average.${rd.act ? ` This year: demanded ${r0(rd.act.etc)}, used ${r0(rd.act.eta)} mm.` : ""}`,
          `Evapotranspiração com dados diários reais (Penman-Monteith FAO-56, NASA POWER ${rd.desde}–${rd.hasta}): referência ${rd.et0} mm de maio a setembro; o milho pede ${rd.etc} mm e usa ${rd.eta} mm em média.${rd.act ? ` Este ano: pediu ${r0(rd.act.etc)} e usou ${r0(rd.act.eta)} mm.` : ""}`);
        F.extremos = m(`Extremos por década (${rd.ys.length} años reales): sequía que recorta el agua del maíz (más de 60 mm de déficit) ${rd.decDef} veces; primavera muy mojada (más de 250 mm de drenaje de abril a junio) ${rd.decHum}; verano con 5 o más días de 35 °C ${rd.decCal}. Años de sequía: ${rd.deficit.join(", ") || "ninguno"}.`,
          `Extremes per decade (${rd.ys.length} real years): drought cutting corn water (over 60 mm deficit) ${rd.decDef} times; very wet spring (over 250 mm drainage Apr–Jun) ${rd.decHum}; summer with 5+ days at 35 °C ${rd.decCal}. Drought years: ${rd.deficit.join(", ") || "none"}.`,
          `Extremos por década (${rd.ys.length} anos reais): seca que corta a água do milho (mais de 60 mm de déficit) ${rd.decDef} vezes; primavera muito úmida (mais de 250 mm de drenagem de abril a junho) ${rd.decHum}; verão com 5 ou mais dias de 35 °C ${rd.decCal}. Anos de seca: ${rd.deficit.join(", ") || "nenhum"}.`);
        const hu = A.huella(157, 12.6), conc = rd.dren > 0 ? hu.nitrato * 100 / rd.dren : null;
        F.nitratoAgua = m(`Agua que sale por debajo de la raíz: ${rd.dren} mm al año (${rd.drenPrim} mm de abril a junio). Con ~${hu.nitrato} kg N/ha lavados, el agua de drenaje llevaría ~${r1(conc)} mg/L de nitrato-N, ${conc > 10 ? "por encima" : "por debajo"} del límite de 10 mg/L de la EPA para agua potable. El nitrato es una estimación (IPCC); el drenaje sale del balance diario real.`,
          `Water leaving below the roots: ${rd.dren} mm a year (${rd.drenPrim} mm April–June). With ~${hu.nitrato} kg N/ha leached, drainage water would carry ~${r1(conc)} mg/L nitrate-N, ${conc > 10 ? "above" : "below"} the EPA 10 mg/L drinking-water limit. Nitrate is an estimate (IPCC); drainage comes from the real daily balance.`,
          `Água que sai abaixo da raiz: ${rd.dren} mm por ano (${rd.drenPrim} mm de abril a junho). Com ~${hu.nitrato} kg N/ha lixiviados, a água de drenagem levaria ~${r1(conc)} mg/L de nitrato-N, ${conc > 10 ? "acima" : "abaixo"} do limite de 10 mg/L da EPA. O nitrato é uma estimativa (IPCC); a drenagem vem do balanço diário real.`);
        const sr = this.sr, rel = sr?.relieve, s = A.calcular().suelo;
        if (s?.k) {
          const pend = rel?.pend ?? 4, th = Math.atan(pend / 100), mm2 = pend >= 5 ? 0.5 : pend >= 3.5 ? 0.4 : pend >= 1 ? 0.3 : 0.2;
          const LS = (300 / 72.6) ** mm2 * (pend < 9 ? 10.8 * Math.sin(th) + 0.03 : 16.8 * Math.sin(th) - 0.5);
          const er = (C) => r1(rd.Rus * s.k * LS * C * 2.2417);
          F.erosionReal = m(`Erosión con lluvia real: erosividad R = ${rd.Rus} (calculada con ${rd.ys.length} años de lluvia diaria)${rel ? ` y pendiente real del lote ${rel.pend} % (máx. ${rel.pendMax} %; relieve ${r0(rel.min)}–${r0(rel.max)} m, DEM de 90 m)` : ""}. Pérdida: convencional ${er(0.35)}, siembra directa ${er(0.1)}, directa con cobertura ${er(0.05)} t/ha/año; tolerancia 11.2.`,
            `Erosion with real rain: erosivity R = ${rd.Rus} (from ${rd.ys.length} years of daily rain)${rel ? ` and the field's real slope ${rel.pend} % (max ${rel.pendMax} %; relief ${r0(rel.min)}–${r0(rel.max)} m, 90 m DEM)` : ""}. Loss: conventional ${er(0.35)}, no-till ${er(0.1)}, no-till with cover ${er(0.05)} t/ha/yr; tolerance 11.2.`,
            `Erosão com chuva real: erosividade R = ${rd.Rus} (com ${rd.ys.length} anos de chuva diária)${rel ? ` e declividade real do talhão ${rel.pend} % (máx. ${rel.pendMax} %; relevo ${r0(rel.min)}–${r0(rel.max)} m, MDE de 90 m)` : ""}. Perda: convencional ${er(0.35)}, plantio direto ${er(0.1)}, direto com cobertura ${er(0.05)} t/ha/ano; tolerância 11,2.`);
        }
      }
      if (rd) {
        const f = rd.ys.filter(y => rd.D[y].ts10).slice(-12).map(y => [y, rd.D[y].ts10]);
        if (f.length) F.sueloSiembra = m(`Fecha en que la superficie del suelo llega a 10 °C (5 días seguidos; temperatura de superficie de NASA POWER), por año: ${f.map(([y, d]) => `${y}: ${d}`).join(", ")}. Mediana ${cuantil(f.map(x => x[1]), 0.5)}. Días trabajables del 10 de abril al 20 de mayo: ${rd.trab} en promedio.`,
          `Date the soil surface reaches 10 °C (5 days in a row; NASA POWER surface temperature), by year: ${f.map(([y, d]) => `${y}: ${d}`).join(", ")}. Median ${cuantil(f.map(x => x[1]), 0.5)}. Workable days Apr 10–May 20: ${rd.trab} on average.`,
          `Data em que a superfície do solo chega a 10 °C (5 dias seguidos; temperatura de superfície do NASA POWER), por ano: ${f.map(([y, d]) => `${y}: ${d}`).join(", ")}. Mediana ${cuantil(f.map(x => x[1]), 0.5)}. Dias trabalháveis de 10 de abril a 20 de maio: ${rd.trab} em média.`);
      }
      const pf = this.portafolio();
      if (pf) {
        const t = (k, n2) => `${n2}: ${pf.out[k].media} USD/ha de media, ${pf.out[k].p5} en el peor 5 % (peor año ${pf.out[k].anioPeor}), pérdida en ${pc(pf.out[k].pPerdida)} de los años`;
        const te = (k, n2) => `${n2}: ${pf.out[k].media} USD/ha mean, ${pf.out[k].p5} worst 5 % (worst year ${pf.out[k].anioPeor}), loss in ${pc(pf.out[k].pPerdida)} of years`;
        const tp = (k, n2) => `${n2}: ${pf.out[k].media} USD/ha de média, ${pf.out[k].p5} no pior 5 % (pior ano ${pf.out[k].anioPeor}), perda em ${pc(pf.out[k].pPerdida)} dos anos`;
        const pr = pf.conPrecios;
        F.portafolio = m(`Riesgo por rotación con ${pf.n} años (${pf.desde}–${pf.hasta}) de clima real${pr ? " y el precio real de cada año (FRED, sin inflación, llevado al precio USDA de hoy)" : " y los precios de hoy"}; costos ${pf.q.costoMaiz} y ${pf.q.costoSoya} USD/ha (editables): ${t("maizSoya", "maíz-soya")}; ${t("maizMaiz", "maíz-maíz")}; ${t("soyaSoya", "soya-soya")}.${pr ? ` Correlación entre rendimiento de maíz y precio del mismo año: ${pf.corr} (${pf.corr < -0.2 ? "el precio sube cuando el rendimiento cae: cobertura natural parcial" : "el precio casi no compensa los años malos"}).` : " Falta la historia de precios."}`,
          `Risk by rotation with ${pf.n} years (${pf.desde}–${pf.hasta}) of real weather${pr ? " and each year's real price (FRED, inflation-adjusted, scaled to today's USDA price)" : " and today's prices"}; costs ${pf.q.costoMaiz} and ${pf.q.costoSoya} USD/ha (editable): ${te("maizSoya", "corn-soy")}; ${te("maizMaiz", "corn-corn")}; ${te("soyaSoya", "soy-soy")}.${pr ? ` Correlation between corn yield and same-year price: ${pf.corr} (${pf.corr < -0.2 ? "price rises when yield falls: partial natural hedge" : "price barely offsets bad years"}).` : " Price history is missing."}`,
          `Risco por rotação com ${pf.n} anos (${pf.desde}–${pf.hasta}) de clima real${pr ? " e o preço real de cada ano (FRED, sem inflação, levado ao preço USDA de hoje)" : " e os preços de hoje"}; custos ${pf.q.costoMaiz} e ${pf.q.costoSoya} USD/ha (editáveis): ${tp("maizSoya", "milho-soja")}; ${tp("maizMaiz", "milho-milho")}; ${tp("soyaSoya", "soja-soja")}.${pr ? ` Correlação entre rendimento do milho e preço do mesmo ano: ${pf.corr} (${pf.corr < -0.2 ? "o preço sobe quando o rendimento cai: hedge natural parcial" : "o preço quase não compensa os anos ruins"}).` : " Falta a história de preços."}`);
      }
      const ins = this.insumos();
      if (ins) F.insumos = m(`Precio del fertilizante nitrogenado (índice de precios al productor, sin inflación, ${ins.desde}–${ins.hasta}): varía ${pc(ins.cv)} en promedio; el mayor salto anual fue de +${pc(ins.salto)} en ${ins.anioSalto}. Hoy está más caro que en el ${pc(ins.pct)} de esos años. La razón de precios N:maíz fue de ${ins.rMin} a ${ins.rMax} (mediana ${ins.rMed}): comprar el N con anticipación solo conviene si se espera que la razón suba.`,
        `Nitrogen fertilizer price (producer price index, inflation-adjusted, ${ins.desde}–${ins.hasta}): varies ${pc(ins.cv)} on average; the biggest yearly jump was +${pc(ins.salto)} in ${ins.anioSalto}. Today it is pricier than in ${pc(ins.pct)} of those years. The N:corn price ratio ranged ${ins.rMin} to ${ins.rMax} (median ${ins.rMed}): pre-buying N only pays if the ratio is expected to rise.`,
        `Preço do fertilizante nitrogenado (índice de preços ao produtor, sem inflação, ${ins.desde}–${ins.hasta}): varia ${pc(ins.cv)} em média; o maior salto anual foi de +${pc(ins.salto)} em ${ins.anioSalto}. Hoje está mais caro que em ${pc(ins.pct)} desses anos. A razão de preços N:milho foi de ${ins.rMin} a ${ins.rMax} (mediana ${ins.rMed}): comprar N antecipado só compensa se a razão deve subir.`);
      const sv = this.semivariograma();
      if (sv) F.semivariograma = m(`Semivariograma del NDVI real de julio: dos cuadros dejan de parecerse a ${sv.abierto ? "más de " : "unos "}${sv.rango} m (rango); el ${pc(sv.pepita)} de la variación ocurre a menos de ${sv.lado} m. ${sv.abierto ? `No se estabiliza dentro del lote: hay una tendencia que lo cruza entero, así que una rejilla rala engaña. Conviene muestrear por zonas, o en rejilla con al menos 1 punto por hectárea (${Math.ceil(A.calcular().celdas?.ha || 0)} puntos).` : `Para un muestreo en rejilla basta un punto cada ${sv.rango} m: unos ${sv.nGrid} puntos en el lote.`}`,
        `Semivariogram of real July NDVI: two squares stop resembling each other at ${sv.abierto ? "over " : "about "}${sv.rango} m (range); ${pc(sv.pepita)} of the variation happens within ${sv.lado} m. ${sv.abierto ? `It does not level off inside the field: a trend crosses all of it, so a sparse grid misleads. Sample by zones, or grid with at least 1 point per hectare (${Math.ceil(A.calcular().celdas?.ha || 0)} points).` : `Grid sampling needs one point every ${sv.rango} m: about ${sv.nGrid} points in the field.`}`,
        `Semivariograma do NDVI real de julho: dois quadros deixam de se parecer a ${sv.abierto ? "mais de " : "cerca de "}${sv.rango} m (alcance); ${pc(sv.pepita)} da variação ocorre a menos de ${sv.lado} m. ${sv.abierto ? `Não se estabiliza dentro do talhão: há uma tendência que o atravessa inteiro, então uma grade rala engana. Convém amostrar por zonas, ou em grade com pelo menos 1 ponto por hectare (${Math.ceil(A.calcular().celdas?.ha || 0)} pontos).` : `Para amostragem em grade basta um ponto a cada ${sv.rango} m: cerca de ${sv.nGrid} pontos no talhão.`}`);
      const cb = this.carbono();
      if (cb) F.carbonoSuelo = m(`Carbono del suelo a 30 años (modelo ICBM; parte de ${cb.soc0} t C/ha en 0–30 cm según SSURGO): labranza convencional ${cb.conv >= 0 ? "+" : ""}${cb.conv}, siembra directa ${cb.directa >= 0 ? "+" : ""}${cb.directa}, directa con cobertura ${cb.cobertura >= 0 ? "+" : ""}${cb.cobertura} t C/ha. A ${cb.q.precioCO2} USD/t CO₂e, pasar de convencional a directa con cobertura valdría ~${cb.credito} USD/ha/año antes de verificación. Las tasas del modelo son genéricas: hay que medir el carbono inicial.`,
        `Soil carbon over 30 years (ICBM model; starts at ${cb.soc0} t C/ha in 0–30 cm from SSURGO): conventional tillage ${cb.conv >= 0 ? "+" : ""}${cb.conv}, no-till ${cb.directa >= 0 ? "+" : ""}${cb.directa}, no-till with cover ${cb.cobertura >= 0 ? "+" : ""}${cb.cobertura} t C/ha. At ${cb.q.precioCO2} USD/t CO₂e, switching from conventional to no-till with cover would be worth ~${cb.credito} USD/ha/yr before verification. Model rates are generic: measure the baseline carbon.`,
        `Carbono do solo em 30 anos (modelo ICBM; parte de ${cb.soc0} t C/ha em 0–30 cm segundo o SSURGO): preparo convencional ${cb.conv >= 0 ? "+" : ""}${cb.conv}, plantio direto ${cb.directa >= 0 ? "+" : ""}${cb.directa}, direto com cobertura ${cb.cobertura >= 0 ? "+" : ""}${cb.cobertura} t C/ha. A ${cb.q.precioCO2} USD/t CO₂e, passar de convencional a direto com cobertura valeria ~${cb.credito} USD/ha/ano antes da verificação. As taxas do modelo são genéricas: é preciso medir o carbono inicial.`);
      const ri = this.riego();
      if (ri) F.riegoVan = m(`Riego de apoyo a 20 años: el agua faltante quitó en promedio ${ri.gananciaMedia} USD/ha/año (pesó en ${ri.anios} de ${ri.n} años). Restando 150 USD/ha/año de operación y ${ri.q.riegoCapital} USD/ha de inversión al ${ri.q.tasa} %, el valor presente es ${ri.van} USD/ha: ${ri.van > 0 ? "conviene" : "no conviene"}.`,
        `Supplemental irrigation over 20 years: missing water cost on average ${ri.gananciaMedia} USD/ha/yr (mattered in ${ri.anios} of ${ri.n} years). Minus 150 USD/ha/yr to operate and ${ri.q.riegoCapital} USD/ha invested at ${ri.q.tasa} %, the net present value is ${ri.van} USD/ha: ${ri.van > 0 ? "worth it" : "not worth it"}.`,
        `Irrigação de apoio em 20 anos: a água faltante tirou em média ${ri.gananciaMedia} USD/ha/ano (pesou em ${ri.anios} de ${ri.n} anos). Descontando 150 USD/ha/ano de operação e ${ri.q.riegoCapital} USD/ha de investimento a ${ri.q.tasa} %, o valor presente é ${ri.van} USD/ha: ${ri.van > 0 ? "compensa" : "não compensa"}.`);
      const dv = this.drenajeVan();
      if (dv) F.drenajeTubos = m(`Drenaje con tubos a 20 años: en ${dv.humedos} de ${dv.n} años la primavera tuvo más de 250 mm de agua sobrante. Con +${dv.q.drenGanNormal} % de rendimiento en años normales y +${dv.q.drenGanHumedo} % en los mojados (supuestos editables para un suelo moderadamente bien drenado), gana ${dv.anual} USD/ha/año; con ${dv.q.drenCapital} USD/ha de inversión al ${dv.q.tasa} %, el valor presente es ${dv.van} USD/ha: ${dv.van > 0 ? "conviene" : "no conviene"}.`,
        `Tile drainage over 20 years: in ${dv.humedos} of ${dv.n} years spring had over 250 mm of surplus water. With +${dv.q.drenGanNormal} % yield in normal years and +${dv.q.drenGanHumedo} % in wet ones (editable assumptions for a moderately well drained soil), it earns ${dv.anual} USD/ha/yr; with ${dv.q.drenCapital} USD/ha invested at ${dv.q.tasa} %, the NPV is ${dv.van} USD/ha: ${dv.van > 0 ? "worth it" : "not worth it"}.`,
        `Drenagem com tubos em 20 anos: em ${dv.humedos} de ${dv.n} anos a primavera teve mais de 250 mm de água sobrando. Com +${dv.q.drenGanNormal} % de rendimento em anos normais e +${dv.q.drenGanHumedo} % nos úmidos (supostos editáveis para um solo moderadamente bem drenado), ganha ${dv.anual} USD/ha/ano; com ${dv.q.drenCapital} USD/ha de investimento a ${dv.q.tasa} %, o VPL é ${dv.van} USD/ha: ${dv.van > 0 ? "compensa" : "não compensa"}.`);
      const n = this.nitrogeno();
      if (n) F.nitrogenoAjuste = m(`Dosis de N: razón de precios ${n.ratio} (N a ${par().precioN} USD/kg ÷ maíz a ${A.calcular().economia.precioT} USD/t, en USD/lb ÷ USD/bu) → ${n.base} kg N/ha (aproximación lineal de la curva MRTN, maíz tras soya)${n.prim != null ? `; primavera de este año con ${n.prim} mm de drenaje contra ${n.primMedia} de media → ajuste ${n.extra >= 0 ? "+" : ""}${n.extra} kg` : ""}. Total ${n.total} kg N/ha.`,
        `N rate: price ratio ${n.ratio} (N at ${par().precioN} USD/kg ÷ corn at ${A.calcular().economia.precioT} USD/t) → ${n.base} kg N/ha (linear approximation of the MRTN curve, corn after soy)${n.prim != null ? `; this spring had ${n.prim} mm drainage vs ${n.primMedia} average → adjust ${n.extra >= 0 ? "+" : ""}${n.extra} kg` : ""}. Total ${n.total} kg N/ha.`,
        `Dose de N: razão de preços ${n.ratio} (N a ${par().precioN} USD/kg ÷ milho a ${A.calcular().economia.precioT} USD/t) → ${n.base} kg N/ha (aproximação linear da curva MRTN, milho após soja)${n.prim != null ? `; primavera deste ano com ${n.prim} mm de drenagem contra ${n.primMedia} de média → ajuste ${n.extra >= 0 ? "+" : ""}${n.extra} kg` : ""}. Total ${n.total} kg N/ha.`);
      const cl = this.cal();
      if (cl) F.calLargo = m(`Cal a largo plazo: el N amoniacal acidifica ~${cl.acidoAnual} kg de carbonato de calcio por ha al año. Con CIC estimada de ${cl.cic} cmol/kg, el pH pasaría de ${cl.ph} a 5.8 en unos ${cl.anios} años; ahí toca encalar. Estimación: confirmar con análisis de pH tampón.`,
        `Long-term lime: ammoniacal N acidifies ~${cl.acidoAnual} kg of calcium carbonate per ha per year. With an estimated CEC of ${cl.cic} cmol/kg, pH would drop from ${cl.ph} to 5.8 in about ${cl.anios} years; lime then. Estimate: confirm with a buffer pH test.`,
        `Calcário a longo prazo: o N amoniacal acidifica ~${cl.acidoAnual} kg de carbonato de cálcio por ha ao ano. Com CTC estimada de ${cl.cic} cmol/kg, o pH passaria de ${cl.ph} a 5,8 em cerca de ${cl.anios} anos; aí é hora de calcário. Estimativa: confirmar com pH tampão.`);
      const pk = this.pk();
      if (pk) F.fosforoPotasio = pk.catP || pk.catK
        ? m(`Fósforo y potasio con tu análisis: P (Bray) ${pk.q.sueloP} ppm = ${pk.catP ?? "—"} → ${pk.dP ?? 0} kg P₂O₅/ha; K ${pk.q.sueloK} ppm = ${pk.catK ?? "—"} → ${pk.dK ?? 0} kg K₂O/ha. La cosecha se lleva ${pk.remP} kg P₂O₅ y ${pk.remK} kg K₂O por ha (categorías y extracción de ISU PM 1688).`,
          `Phosphorus and potassium from your test: P (Bray) ${pk.q.sueloP} ppm = ${pk.catP ?? "—"} → ${pk.dP ?? 0} kg P₂O₅/ha; K ${pk.q.sueloK} ppm = ${pk.catK ?? "—"} → ${pk.dK ?? 0} kg K₂O/ha. Harvest removes ${pk.remP} kg P₂O₅ and ${pk.remK} kg K₂O per ha (ISU PM 1688 categories and removal).`,
          `Fósforo e potássio com sua análise: P (Bray) ${pk.q.sueloP} ppm = ${pk.catP ?? "—"} → ${pk.dP ?? 0} kg P₂O₅/ha; K ${pk.q.sueloK} ppm = ${pk.catK ?? "—"} → ${pk.dK ?? 0} kg K₂O/ha. A colheita leva ${pk.remP} kg P₂O₅ e ${pk.remK} kg K₂O por ha (categorias e extração do ISU PM 1688).`)
        : m(`Fósforo y potasio: la cosecha se lleva ${pk.remP} kg P₂O₅ y ${pk.remK} kg K₂O por ha. Escribe abajo tu análisis de suelo (P Bray y K en ppm) para la dosis.`, `Phosphorus and potassium: harvest removes ${pk.remP} kg P₂O₅ and ${pk.remK} kg K₂O per ha. Enter your soil test (Bray P and K in ppm) below for the rate.`, `Fósforo e potássio: a colheita leva ${pk.remP} kg P₂O₅ e ${pk.remK} kg K₂O por ha. Escreva abaixo sua análise de solo (P Bray e K em ppm) para a dose.`);
      const se = this.secado();
      if (se) F.secado = m(`Cosecha y secado de este año: capa negra el ${se.madurez}; con el clima real el grano habría llegado a 20 % de humedad el ${se.fecha20 || "— (aún no)"}. Cosechar al 25 % y secar a 15.5 % costaría ~${se.costo} USD/ha (0.04 USD por bushel por punto, supuesto).`,
        `This year's harvest and drying: black layer on ${se.madurez}; with real weather the grain would have reached 20 % moisture on ${se.fecha20 || "— (not yet)"}. Harvesting at 25 % and drying to 15.5 % would cost ~${se.costo} USD/ha (0.04 USD per bushel per point, assumed).`,
        `Colheita e secagem deste ano: camada preta em ${se.madurez}; com o clima real o grão teria chegado a 20 % de umidade em ${se.fecha20 || "— (ainda não)"}. Colher a 25 % e secar a 15,5 % custaria ~${se.costo} USD/ha (0,04 USD por bushel por ponto, suposto).`);
      if (rd && A.calcular().siembra) {
        const s = A.calcular().siembra, tsv = rd.ys.map(y => rd.D[y].ts10).filter(Boolean), term = tsv.length ? cuantil(tsv, 0.5) : s.ini;
        F.coberturaFechas = m(`Cultivo de cobertura (centeno): sembrarlo justo después de cosechar y antes del 15 de octubre (la primera helada observada fue el ${s.primeraOtono}); terminarlo 10 a 14 días antes de sembrar maíz, es decir hacia finales de abril si el suelo llega a 10 °C cerca del ${term}.`,
          `Cover crop (rye): seed right after harvest and before October 15 (first observed frost ${s.primeraOtono}); terminate 10–14 days before corn planting, i.e. late April if the soil reaches 10 °C around ${term}.`,
          `Cultura de cobertura (centeio): semear logo após a colheita e antes de 15 de outubro (a primeira geada observada foi em ${s.primeraOtono}); encerrar 10 a 14 dias antes de plantar milho, ou seja no fim de abril se o solo chega a 10 °C perto de ${term}.`);
      }
      const vt = this.valorTierra();
      if (vt) F.valorTierra = m(`Valor de la tierra por capitalización: margen medio maíz-soya de ${vt.renta} USD/ha ÷ ${par().capRate} % = ${vt.hoy} USD/ha${vt.en20 != null ? `; con el rendimiento proyectado para 2041–2050, ~${vt.en20} USD/ha` : ""}. No incluye presión urbana ni tasas de interés futuras.`,
        `Land value by capitalization: mean corn-soy margin of ${vt.renta} USD/ha ÷ ${par().capRate} % = ${vt.hoy} USD/ha${vt.en20 != null ? `; with projected 2041–2050 yields, ~${vt.en20} USD/ha` : ""}. Excludes urban pressure and future interest rates.`,
        `Valor da terra por capitalização: margem média milho-soja de ${vt.renta} USD/ha ÷ ${par().capRate} % = ${vt.hoy} USD/ha${vt.en20 != null ? `; com o rendimento projetado para 2041–2050, ~${vt.en20} USD/ha` : ""}. Não inclui pressão urbana nem juros futuros.`);
      const bk = this.banco();
      if (bk) F.banco = m(`Para el banco: margen esperado ${bk.media} USD/ha, en el peor 5 % de los años ${bk.p5} USD/ha${bk.cobertura != null ? `; cobertura del servicio de deuda ${bk.cobertura} (peor 5 %: ${bk.coberturaP5}; los bancos suelen pedir 1.25 o más)` : "; escribe abajo el pago anual de deuda por ha para la cobertura"}.`,
        `For the bank: expected margin ${bk.media} USD/ha, in the worst 5 % of years ${bk.p5} USD/ha${bk.cobertura != null ? `; debt service coverage ${bk.cobertura} (worst 5 %: ${bk.coberturaP5}; banks usually want 1.25 or more)` : "; enter the annual debt payment per ha below for coverage"}.`,
        `Para o banco: margem esperada ${bk.media} USD/ha, no pior 5 % dos anos ${bk.p5} USD/ha${bk.cobertura != null ? `; cobertura do serviço da dívida ${bk.cobertura} (pior 5 %: ${bk.coberturaP5}; os bancos costumam pedir 1,25 ou mais)` : "; escreva abaixo o pagamento anual da dívida por ha para a cobertura"}.`);
      const cc = this.calibCosecha || leer(claveLoc("cal"));
      if (cc) F.calibracion = m(`Calibración con tu monitor de cosecha (${cc.n} puntos): rendimiento = ${cc.a} + ${cc.b} × NDVI de julio; R² ${cc.r2}, error típico ${cc.rmse} t/ha.`, `Calibration with your yield monitor (${cc.n} points): yield = ${cc.a} + ${cc.b} × July NDVI; R² ${cc.r2}, typical error ${cc.rmse} t/ha.`, `Calibração com seu monitor de colheita (${cc.n} pontos): rendimento = ${cc.a} + ${cc.b} × NDVI de julho; R² ${cc.r2}, erro típico ${cc.rmse} t/ha.`);
      const bt = this.bitacora();
      if (bt.length) F.bitacora = m(`Bitácora del lote: ${bt.length} registros (${bt.slice(-3).map(e => `${e.fecha} ${e.act}`).join("; ")}).`, `Field log: ${bt.length} entries (${bt.slice(-3).map(e => `${e.fecha} ${e.act}`).join("; ")}).`, `Diário do talhão: ${bt.length} registros (${bt.slice(-3).map(e => `${e.fecha} ${e.act}`).join("; ")}).`);
      return F;
    },

    titulosExtra: {
      zonasEstables: ["Zonas estables (Sentinel-2, varios julios)", "Stable zones (Sentinel-2, several Julys)", "Zonas estáveis (Sentinel-2, vários julhos)"],
      anomalias: ["Anomalías contra su propio historial", "Anomalies against its own history", "Anomalias contra o próprio histórico"],
      etReal: ["Evapotranspiración real", "Actual evapotranspiration", "Evapotranspiração real"],
      extremos: ["Extremos por década", "Extremes per decade", "Extremos por década"],
      nitratoAgua: ["Nitrato y agua de drenaje", "Nitrate and drainage water", "Nitrato e água de drenagem"],
      erosionReal: ["Erosión con lluvia y pendiente reales", "Erosion with real rain and slope", "Erosão com chuva e declividade reais"],
      sueloSiembra: ["Suelo listo para sembrar", "Soil ready for planting", "Solo pronto para plantar"],
      portafolio: ["Riesgo por rotación", "Risk by rotation", "Risco por rotação"],
      carbonoSuelo: ["Carbono del suelo y créditos", "Soil carbon and credits", "Carbono do solo e créditos"],
      riegoVan: ["Riego: ¿conviene invertir?", "Irrigation: worth investing?", "Irrigação: compensa investir?"],
      drenajeTubos: ["Drenaje con tubos", "Tile drainage", "Drenagem com tubos"],
      nitrogenoAjuste: ["Dosis de N ajustada", "Adjusted N rate", "Dose de N ajustada"],
      calLargo: ["Cal a largo plazo", "Long-term lime", "Calcário a longo prazo"],
      fosforoPotasio: ["Fósforo y potasio", "Phosphorus and potassium", "Fósforo e potássio"],
      secado: ["Cosecha y secado", "Harvest and drying", "Colheita e secagem"],
      coberturaFechas: ["Cultivo de cobertura", "Cover crop", "Cultura de cobertura"],
      valorTierra: ["Valor de la tierra", "Land value", "Valor da terra"],
      banco: ["Para el banco", "For the bank", "Para o banco"],
      insumos: ["Precio del fertilizante", "Fertilizer price", "Preço do fertilizante"],
      semivariograma: ["Distancia de muestreo", "Sampling distance", "Distância de amostragem"],
      calibracion: ["Verdor contra rendimiento", "Greenness vs yield", "Verdor contra rendimento"],
      bitacora: ["Bitácora", "Field log", "Diário"],
    },
    fuentesExtra: { zonasEstables: "Sentinel-2 L2A (Planetary Computer)", anomalias: "Sentinel-2 L2A (Planetary Computer)", etReal: "NASA POWER diario", extremos: "NASA POWER diario", nitratoAgua: "NASA POWER + IPCC", erosionReal: "NASA POWER + Open-Meteo DEM + SSURGO", sueloSiembra: "NASA POWER (TS)", portafolio: "NASA POWER + FRED + USDA AMS", insumos: "FRED (PPI, CPI)", semivariograma: "Sentinel-2 L2A", carbonoSuelo: "ICBM + SSURGO", riegoVan: "NASA POWER + USDA AMS", drenajeTubos: "NASA POWER", nitrogenoAjuste: "MRTN aprox. + NASA POWER", calLargo: "SSURGO (estimación)", fosforoPotasio: "ISU PM 1688", secado: "NASA POWER", coberturaFechas: "NASA POWER + ERA5", valorTierra: "Terra Lab", banco: "Terra Lab", calibracion: "Monitor de cosecha + Sentinel-2", bitacora: "Productor" },
    temasExtra: [
      [/zonas? estables|entre a[nñ]os|varias temporadas|historial de verdor|stable zone/, ["zonasEstables"]],
      [/anomal|historial|por debajo de lo normal/, ["anomalias"]],
      [/evapotrans|\bet real|\bet0|openet/, ["etReal"]],
      [/extremo|inundaci|derecho|calor extremo|extreme|flood/, ["extremos"]],
      [/nitrato|lixivi|epa|agua potable|regulaci|leach/, ["nitratoAgua"]],
      [/erosi|p[eé]rdida de suelo|rusle|pendiente|slope/, ["erosionReal"]],
      [/temperatura del suelo|suelo a 10|10 ?°|soil temp|d[ií]as trabajables|workable/, ["sueloSiembra"]],
      [/fertilizante.*precio|precio.*fertiliz|insumo|urea|volatil/, ["insumos", "nitrogenoAjuste"]],
      [/semivariog|distancia de muestreo|cada cu[aá]ntos metros|rejilla/, ["semivariograma", "muestreoZonas"]],
      [/rotaci[oó]n.*riesgo|riesgo.*rotaci|portafolio|portfolio|monte carlo|menos riesgo/, ["portafolio"]],
      [/carbono.*suelo|suelo.*carbono|cr[eé]ditos? de carbono|carbon credit|secuestr/, ["carbonoSuelo"]],
      [/riego|irrig|pivote|pivot/, ["riegoVan", "agua"]],
      [/drenaje|tubos|tile/, ["drenajeTubos"]],
      [/nitr[oó]g|dosis de n|mrtn|urea|fertiliz/, ["nitrogenoAjuste", "nitrogeno"]],
      [/\bcal\b|encal|lime|acidif/, ["calLargo"]],
      [/f[oó]sforo|potasio|phosph|potass|\bp y k\b/, ["fosforoPotasio"]],
      [/secado|secar|humedad del grano|drying|dry-?down/, ["secado"]],
      [/cobertura|centeno|cover crop|rye/, ["coberturaFechas"]],
      [/valor de la tierra|precio de la tierra|land value/, ["valorTierra"]],
      [/banco|cr[eé]dito|pr[eé]stamo|deuda|bank|loan/, ["banco"]],
      [/monitor de cosecha|calibra|yield monitor/, ["calibracion"]],
      [/bit[aá]cora|registro|log/, ["bitacora"]],
    ],

    // ============================================================ 7. Panel con los datos del productor
    panelExtra() {
      const q = par(), bt = this.bitacora();
      const campo = (k, t) => `<label class="xs" style="display:flex;flex-direction:column;gap:2px">${esc(t)}<input class="field" data-agro-par="${k}" value="${esc(q[k])}" inputmode="decimal" style="min-height:34px"></label>`;
      return `
        <details style="margin-top:12px"><summary class="small" style="cursor:pointer;font-weight:700">${esc(m("Mis datos (cambian los cálculos)", "My data (changes the math)", "Meus dados (mudam as contas)"))}</summary>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:8px">
            ${campo("costoMaiz", m("Costo maíz USD/ha", "Corn cost USD/ha", "Custo milho USD/ha"))}
            ${campo("costoSoya", m("Costo soya USD/ha", "Soy cost USD/ha", "Custo soja USD/ha"))}
            ${campo("precioN", m("Precio N USD/kg", "N price USD/kg", "Preço N USD/kg"))}
            ${campo("deuda", m("Pago de deuda USD/ha/año", "Debt payment USD/ha/yr", "Pagamento dívida USD/ha/ano"))}
            ${campo("capRate", m("Tasa de capitalización %", "Cap rate %", "Taxa de capitalização %"))}
            ${campo("precioCO2", m("Precio CO₂e USD/t", "CO₂e price USD/t", "Preço CO₂e USD/t"))}
            ${campo("sueloP", m("P Bray (ppm)", "Bray P (ppm)", "P Bray (ppm)"))}
            ${campo("sueloK", m("K (ppm)", "K (ppm)", "K (ppm)"))}
            ${campo("riegoCapital", m("Inversión riego USD/ha", "Irrigation capital USD/ha", "Investimento irrigação USD/ha"))}
            ${campo("tasa", m("Tasa de descuento %", "Discount rate %", "Taxa de desconto %"))}
            ${campo("drenCapital", m("Inversión drenaje USD/ha", "Drainage capital USD/ha", "Investimento drenagem USD/ha"))}
            ${campo("drenGanNormal", m("Ganancia drenaje año normal %", "Drainage gain normal year %", "Ganho drenagem ano normal %"))}
            ${campo("drenGanHumedo", m("Ganancia drenaje año mojado %", "Drainage gain wet year %", "Ganho drenagem ano úmido %"))}
          </div>
        </details>
        <details style="margin-top:8px"><summary class="small" style="cursor:pointer;font-weight:700">${esc(m("Bitácora del lote", "Field log", "Diário do talhão"))} (${bt.length})</summary>
          <div class="row-wrap" style="gap:6px;margin-top:8px">
            <input type="date" class="field" id="agro-bit-fecha" style="min-height:34px">
            <input class="field" id="agro-bit-act" placeholder="${esc(m("Actividad (siembra, N, cosecha…)", "Activity (planting, N, harvest…)", "Atividade (plantio, N, colheita…)"))}" style="min-height:34px;flex:1">
            <input class="field" id="agro-bit-cant" placeholder="${esc(m("Cantidad", "Amount", "Quantidade"))}" style="min-height:34px;width:110px">
            <button type="button" class="btn btn-sec btn-sm" data-agro-bit>${esc(m("Agregar", "Add", "Adicionar"))}</button>
            <button type="button" class="btn btn-sec btn-sm" data-agro-exportar>${esc(m("Exportar todo (JSON)", "Export all (JSON)", "Exportar tudo (JSON)"))}</button>
          </div>
          ${bt.length ? `<ul class="xs" style="margin:6px 0 0 16px;padding:0">${bt.slice(-8).reverse().map(e => `<li>${esc(e.fecha)} · ${esc(e.act)} ${esc(e.cant || "")}</li>`).join("")}</ul>` : ""}
        </details>
        <div class="row-wrap" style="gap:8px;margin-top:8px">
          <button type="button" class="btn btn-sec btn-sm" data-agro-julio ${this.analisisJulios() ? "" : "disabled"}>${esc(m("Ver julio real en el mapa", "Show real July on the map", "Ver julho real no mapa"))}</button>
          <label class="btn btn-sec btn-sm" style="cursor:pointer">${esc(m("Subir monitor de cosecha (CSV lat,lon,t/ha)", "Upload yield monitor (CSV lat,lon,t/ha)", "Enviar monitor de colheita (CSV lat,lon,t/ha)"))}<input type="file" accept=".csv,.txt" data-agro-csv hidden></label>
          ${this.cargandoJul || this.cargandoDia || this.cargandoSR ? `<span class="xs mut">${esc(m("Bajando series reales…", "Fetching real series…", "Baixando séries reais…"))}</span>` : ""}
        </div>`;
    },
  });

  // Cargar las series al abrir "Qué hacer" (y una vez al inicio para la SI).
  const tarjetaOrig = A.tarjeta.bind(A);
  A.tarjeta = function () {
    if (!this.julios && !this.cargandoJul && this.grilla()) this.cargarJulios();
    if (!this.diario && !this.cargandoDia) this.cargarDiario();
    if (!this.sr && !this.cargandoSR && this.grilla()) this.cargarSueloRelieve();
    return tarjetaOrig();
  };
  setTimeout(() => { if (A.grilla()) { A.cargarJulios(); A.cargarSueloRelieve(); } A.cargarDiario(); }, 4000);

  document.addEventListener("change", (e) => {
    const k = e.target.dataset?.agroPar;
    if (k) { const p2 = leer(claveLoc("par")) || {}; p2[k] = e.target.value.trim() === "" ? "" : +e.target.value; guardar(claveLoc("par"), p2); repintar(); }
    if (e.target.matches?.("[data-agro-csv]") && e.target.files[0]) A.cargarCosechaCSV(e.target.files[0]);
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-agro-julio]")) A.verJulioEnMapa();
    else if (e.target.closest("[data-agro-bit]")) {
      const f = document.getElementById("agro-bit-fecha")?.value, a = document.getElementById("agro-bit-act")?.value.trim();
      if (f && a) A.agregarBitacora({ fecha: f, act: a, cant: document.getElementById("agro-bit-cant")?.value.trim() });
    } else if (e.target.closest("[data-agro-exportar]")) {
      A.descargar("terra_lab_lote.json", "application/json", JSON.stringify({ lote: loc(), notas: A.notas(), bitacora: A.bitacora(), parametros: par(), plan: A.frases() }, null, 2));
    }
  });
})();
