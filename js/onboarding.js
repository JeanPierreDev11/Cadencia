// Cuestionario inicial (rediseño 2026-11-15). Aquí viven los textos, los cálculos y el HTML de cada pantalla.
// No guarda estado: app.js tiene `st.ob` y llama a estas funciones. Pantallas (en orden):
//   perfil → donde → (material, solo si eliges Casa o Calistenia) → dias → peso → plan → firma
import { esc, nf, num, I } from './util.js';

/* ---------- datos ---------- */
// Los ids de «dónde» son los mismos que usa el asistente de rutinas (gym, casa, parque), así lo guardado le sirve de punto de partida.
export const DONDE = [
  { id: 'casa', t: 'Casa', s: 'Con el material que tengas', ico: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>' },
  { id: 'gym', t: 'Gimnasio', s: 'Máquinas, poleas y peso libre', ico: '<path d="M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10"/>' },
  { id: 'parque', t: 'Calistenia', s: 'Barras, paralelas y tu peso', ico: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v7M7 10l5-1.5 5 1.5M8.5 21l3.5-7 3.5 7"/>' },
];
// `eq` = id equivalente del asistente de rutinas (null si no tiene: dominadas, banco, anillas y paralelas son de peso corporal).
export const MATERIAL = [
  { id: 'mancuernas', t: 'Mancuernas', eq: 'mancuernas', ico: '<path d="M4 10v4M7 7v10M17 7v10M20 10v4M7 12h10"/>' },
  { id: 'dominadas', t: 'Barra de dominadas', eq: null, ico: '<path d="M3 4h18M6 4v3M18 4v3"/><circle cx="12" cy="9" r="1.7"/><path d="M12 11v5M9 21l3-5 3 5"/>' },
  { id: 'banda', t: 'Bandas elásticas', eq: 'banda', ico: '<path d="M4 17c4-9 12-9 16 0"/><path d="M4 12c4-7 12-7 16 0"/>' },
  { id: 'kettlebell', t: 'Kettlebells', eq: 'kettlebell', ico: '<circle cx="12" cy="14.5" r="6"/><path d="M8.5 9.5a3.5 3.5 0 0 1 7 0"/>' },
  { id: 'barra', t: 'Barra con discos', eq: 'barra', ico: '<path d="M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8"/>' },
  { id: 'banco', t: 'Banco', eq: null, ico: '<path d="M3 13h18M5 13v5M19 13v5M7 13v-3h10v3"/>' },
  { id: 'suspension', t: 'Anillas o TRX', eq: null, ico: '<path d="M9 3v8M15 3v8"/><circle cx="9" cy="14.5" r="3"/><circle cx="15" cy="14.5" r="3"/>' },
  { id: 'paralelas', t: 'Paralelas o fondos', eq: null, ico: '<path d="M6 8h12M6 14h12M8 8v12M16 8v12"/>' },
  { id: 'ninguno', t: 'Solo mi cuerpo', eq: null, ico: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v7M7 10l5-1.5 5 1.5M8.5 21l3.5-7 3.5 7"/>' },
];
// Mismos ids que `RW_EXP` del asistente de rutinas (nuevo · anio · anios), para precargarlo.
export const EXPS = [
  { id: 'nuevo', t: 'Principiante', s: 'Menos de 6 meses' },
  { id: 'anio', t: 'Intermedio', s: 'Cerca de 1 año' },
  { id: 'anios', t: 'Avanzado', s: 'Varios años' },
];
export const FREQ = [[2, 'Para arrancar'], [3, 'Constante'], [4, 'Comprometido'], [5, 'Increíble'], [6, 'Sin excusas'], [7, 'Imparable']];
// Número de paso que se enseña («Paso 2 de 5»); «perfil» es la pantalla previa con tus datos.
export const PASO = { donde: 1, material: 1, dias: 2, peso: 3, plan: 4, firma: 5 };
export const PASOS = 5;
export const FIRMA_MS = 2000;

const svg = (p, s = 22, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const tick = (on) => `<span class="tick">${on ? I.check : ''}</span>`;
const expDe = (id) => EXPS.find((e) => e.id === id);

/* ---------- lógica ---------- */
export const flujo = (o) => ['perfil', 'donde', ...(o.donde.some((d) => d === 'casa' || d === 'parque') ? ['material'] : []), 'dias', 'peso', 'plan', 'firma'];

export function puedeSeguir(o) {
  switch (o.step) {
    case 'perfil': return !!(o.sexo && o.edad && o.nombre.trim() && o.apellidos.trim() && o.usuario && o.alturaCm && o.exp);
    case 'donde': return o.donde.length > 0;
    case 'material': return o.material.length > 0;
    case 'dias': return o.freq >= 2 && o.freq <= 7;
    case 'peso': return !!(o.pesoKg && o.pesoObjetivo);
    default: return true;
  }
}

// Objetivo que se deduce del peso (ya no se pregunta aparte): bajar → perder grasa, subir → ganar músculo, igual → mantener.
export const objetivosDe = (actual, meta) => (!(actual > 0) || !(meta > 0) || Math.abs(meta - actual) < 0.5 ? ['mantener'] : meta < actual ? ['perder'] : ['musculo']);

// Material para el asistente de rutinas: el gimnasio lo trae todo; lo marcado aquí se suma; sin nada → solo peso corporal.
export function eqDesde(donde, material) {
  const eq = new Set(donde.includes('gym') ? ['maquina', 'mancuernas', 'barra'] : []);
  material.forEach((id) => { const m = MATERIAL.find((x) => x.id === id); if (m && m.eq) eq.add(m.eq); });
  if (!eq.size) eq.add('ninguno');
  return [...eq];
}

// Termómetro: % de cambio respecto al peso actual. < 10 verde · 10–15 naranja · > 15 rojo (se compara con 1 decimal).
export function termometro(actual, meta) {
  if (!(actual > 0) || !(meta > 0)) return null;
  const dif = meta - actual, pct = Math.round((Math.abs(dif) / actual) * 1000) / 10, gana = dif > 0;
  if (Math.abs(dif) < 0.05) return { nivel: 'none', pct: 0, dif: 0, txt: 'Mantener tu peso también es una gran meta' };
  const nivel = pct < 10 ? 'ok' : pct <= 15 ? 'mid' : 'high';
  const txt = nivel === 'ok' ? 'Fácil de lograr. Un buen primer objetivo'
    : nivel === 'mid' ? `Objetivo realista. Tasa de ${gana ? 'ganancia' : 'pérdida'} saludable`
      : 'Objetivo ambicioso. Requerirá tiempo y constancia';
  return { nivel, pct, dif, txt };
}

// Fecha orientativa (mockup de «Proyección IA»): ritmo fijo en kg por semana, 0,6 kg al bajar y 0,25 kg al subir (≈ 1 kg al mes, subida limpia). Entre 4 semanas y 2 años.
export const KG_SEMANA_BAJAR = 0.6, KG_SEMANA_SUBIR = 0.25;
export function estimarMeta(actual, meta, hoyISO) {
  const dif = Math.abs(meta - actual);
  if (!(actual > 0) || !(meta > 0) || dif < 0.5) return null;
  const sem = Math.min(104, Math.max(4, Math.ceil(dif / (meta < actual ? KG_SEMANA_BAJAR : KG_SEMANA_SUBIR))));
  const fecha = new Date(`${hoyISO}T12:00:00`);
  fecha.setDate(fecha.getDate() + sem * 7);
  return { semanas: sem, fecha };
}

// Recomposición corporal (perder grasa y ganar músculo a la vez): a qué peso debería quedar la persona.
// Masa magra actual (con su % de grasa; si no lo ha medido, se estima con la fórmula de Deurenberg a partir del IMC, la edad y el sexo)
// + una ganancia razonable de músculo (3 % de la masa magra) y un % de grasa «en forma» (15 % hombres, 24 % mujeres) → peso objetivo.
// Si ya está en ese % de grasa, el objetivo es mantener el peso (solo gana músculo). Devuelve null si faltan datos.
export const RECOMP_MUSCULO = 0.03, RECOMP_GRASA = { hombre: 0.15, mujer: 0.24 };
export function pesoRecomp({ kg, alturaCm, sexo, edad, grasaPct }) {
  if (!(kg >= 30 && kg <= 300) || !(alturaCm >= 120 && alturaCm <= 230)) return null;
  const mujer = sexo === 'mujer', medido = grasaPct > 2 && grasaPct < 60;
  let bf;
  if (medido) bf = grasaPct / 100;
  else {
    if (!(edad >= 14 && edad <= 100)) return null;
    const imc = kg / ((alturaCm / 100) ** 2);
    bf = Math.min(0.5, Math.max(0.05, (1.2 * imc + 0.23 * edad - 10.8 * (mujer ? 0 : 1) - 5.4) / 100));
  }
  const meta = RECOMP_GRASA[mujer ? 'mujer' : 'hombre'], magra = kg * (1 - bf), musculo = magra * RECOMP_MUSCULO;
  const r = (v) => Math.round(v * 2) / 2;
  const yaEnForma = bf <= meta + 0.01;
  const objetivo = yaEnForma ? r(kg) : Math.min(r(kg), r((magra + musculo) / (1 - meta)));
  const grasaBaja = yaEnForma ? 0 : Math.max(0, kg * bf - (objetivo - (magra + musculo)));
  return { objetivo, bfActual: Math.round(bf * 1000) / 10, bfMeta: Math.round(meta * 100), musculo: Math.round(musculo * 10) / 10, grasa: Math.round(grasaBaja * 10) / 10, yaEnForma, medido };
}
const fechaLarga = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
const fechaCorta = (d) => d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }).replace('.', '');

/* ---------- pantallas ---------- */
export function perfilHTML(o, name) {
  return `<h1 class="ob-title">${name ? `${esc(name)}, cuéntanos` : 'Cuéntanos'} sobre ti</h1>
    <p class="ob-sub">Con esto calculamos cuánta energía gasta tu cuerpo y adaptamos tu plan.</p>
    <label class="field"><span>Nombre</span><input class="input" data-ob="nombre" value="${esc(o.nombre)}" maxlength="40" autocomplete="given-name" required></label>
    <label class="field"><span>Apellidos</span><input class="input" data-ob="apellidos" value="${esc(o.apellidos)}" maxlength="60" autocomplete="family-name" required></label>
    <label class="field"><span>Nombre de usuario</span><input class="input" data-ob="usuario" value="${esc(o.usuario)}" maxlength="20" autocapitalize="none" autocomplete="username" placeholder="ej. jean_ramirez" required><small>Letras, números, _ y -, sin espacios.</small></label>
    <div class="field"><span>Sexo</span>
      <div class="pair">
        <button type="button" class="choice" data-act="sex" data-v="hombre" aria-pressed="${o.sexo === 'hombre'}"><span class="ico">${I.male}</span>Hombre</button>
        <button type="button" class="choice" data-act="sex" data-v="mujer" aria-pressed="${o.sexo === 'mujer'}"><span class="ico">${I.female}</span>Mujer</button>
      </div>
    </div>
    <div class="ob-grid2">
      <label class="field"><span>Edad</span><div class="big-input sm"><input name="edad" inputmode="numeric" pattern="[0-9]*" maxlength="3" value="${esc(o.edad)}" placeholder="30" data-ob="edad"><em>años</em></div></label>
      <label class="field"><span>Estatura</span><div class="big-input sm"><input name="alturaCm" inputmode="decimal" maxlength="4" value="${esc(o.alturaCm)}" placeholder="175" data-ob="alturaCm"><em>cm</em></div></label>
    </div>
    <div class="field"><span>Experiencia entrenando</span>
      <div class="exp3">${EXPS.map((e) => `<button type="button" class="choice" data-act="ob-exp" data-v="${e.id}" aria-pressed="${o.exp === e.id}">${e.t}<small>${e.s}</small></button>`).join('')}</div>
    </div>`;
}

export function dondeHTML(o) {
  return `<h1 class="ob-title">¿Qué equipamiento tienes?</h1>
    <p class="ob-sub">Elige todos los sitios donde entrenas. Te propondremos ejercicios con eso.</p>
    <div class="choices">${DONDE.map((d) => `<button type="button" class="choice" data-act="ob-donde" data-v="${d.id}" aria-pressed="${o.donde.includes(d.id)}">
      <span class="ico">${svg(d.ico)}</span><span class="t">${d.t}<small>${d.s}</small></span>${tick(o.donde.includes(d.id))}</button>`).join('')}</div>`;
}

export function materialHTML(o) {
  return `<h1 class="ob-title">¿Qué material tienes?</h1>
    <p class="ob-sub">Marca todo lo que puedas usar en casa o en el parque.</p>
    <div class="choices tight">${MATERIAL.map((m) => `<button type="button" class="choice" data-act="ob-mat" data-v="${m.id}" aria-pressed="${o.material.includes(m.id)}">
      <span class="ico">${svg(m.ico, 20)}</span><span class="t">${m.t}</span>${tick(o.material.includes(m.id))}</button>`).join('')}</div>`;
}

export function diasHTML(o) {
  return `<h1 class="ob-title">¿Cuántos días a la semana quieres entrenar?</h1>
    <p class="ob-sub">Será tu compromiso semanal y marcará cómo cuenta tu racha.</p>
    <div class="choices tight">${FREQ.map(([n, t]) => `<button type="button" class="choice freq" data-act="ob-dias" data-v="${n}" aria-pressed="${o.freq === n}">
      <span class="ico num">${n}</span><span class="t">${n} días<small>${t}</small></span>${tick(o.freq === n)}</button>`).join('')}</div>`;
}

// Cajita del termómetro (se repinta sola al escribir: ver `ob-term` en app.js).
export function termometroHTML(actual, meta) {
  const t = termometro(actual, meta);
  if (!t) return '<div class="term-box none"><small>Escribe tu peso actual y tu peso objetivo para ver cuánto cambio supone.</small></div>';
  const cab = t.nivel === 'none' ? 'Sin cambio de peso' : `${t.dif < 0 ? 'Perder' : 'Ganar'} ${nf(Math.abs(t.dif), 1)} kg · ${nf(t.pct, 1)} % de tu peso`;
  const pos = Math.min(100, (t.pct / 25) * 100);
  return `<div class="term-wrap" style="--p:${pos}"><i class="term-pin"></i><div class="term-bar" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="term-scale" aria-hidden="true"><span>0 %</span><span>10 %</span><span>15 %</span><span>25 %+</span></div></div>
    <div class="term-box ${t.nivel}"><small>${cab}</small><b>${esc(t.txt)}</b></div>`;
}

export function pesoHTML(o) {
  return `<h1 class="ob-title">¿Cuál es tu peso ideal?</h1>
    <p class="ob-sub">Compáralo con tu peso de hoy y mira si el objetivo es realista.</p>
    <div class="ob-grid2">
      <label class="field"><span>Peso actual</span><div class="big-input md"><input name="pesoKg" inputmode="decimal" maxlength="5" value="${esc(o.pesoKg)}" placeholder="72,5" data-ob="pesoKg" autofocus><em>kg</em></div></label>
      <label class="field"><span>Peso objetivo</span><div class="big-input md"><input name="pesoObjetivo" inputmode="decimal" maxlength="5" value="${esc(o.pesoObjetivo)}" placeholder="68" data-ob="pesoObjetivo"><em>kg</em></div></label>
    </div>
    <small class="muted">Será el primer registro de tu historial de peso.</small>
    <div class="term" id="ob-term" aria-live="polite">${termometroHTML(num(o.pesoKg), num(o.pesoObjetivo))}</div>`;
}

function graficaHTML(actual, meta, est) {
  const x0 = 26, x1 = 294, top = 30, bot = 100, baja = meta < actual, igual = !est;
  const y0 = igual ? 65 : baja ? top : bot, y1 = igual ? 65 : baja ? bot : top, mx = (x0 + x1) / 2;
  const d = `M${x0} ${y0} C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`;
  const mes = (f) => `<line x1="${x0 + (x1 - x0) * f}" x2="${x0 + (x1 - x0) * f}" y1="112" y2="116" stroke="currentColor" opacity=".35"/>`;
  return `<svg viewBox="0 0 320 150" role="img" aria-label="Línea de tiempo de tu peso, de ${nf(actual, 1)} kg hoy a ${nf(meta, 1)} kg${est ? ` hacia el ${fechaLarga(est.fecha)}` : ''}">
    <line x1="${x0}" x2="${x1}" y1="114" y2="114" stroke="currentColor" opacity=".25"/>${mes(0.25)}${mes(0.5)}${mes(0.75)}
    <path class="ar" d="${d} L${x1} 114 L${x0} 114 Z"/>
    <path class="ln" d="${d}" pathLength="1"/>
    <circle class="dot" cx="${x0}" cy="${y0}" r="5"/><circle class="dot fin" cx="${x1}" cy="${y1}" r="7"/>
    <text x="${x0}" y="${y0 - 11}" text-anchor="start" class="v">${nf(actual, 1)} kg</text>
    <text x="${x1}" y="${y1 - 13}" text-anchor="end" class="v">${nf(meta, 1)} kg</text>
    <text x="${x0}" y="134" text-anchor="start">Hoy</text>
    <text x="${x1}" y="134" text-anchor="end">${est ? fechaCorta(est.fecha) : 'Meta'}</text></svg>`;
}

export function planHTML(o, p, hoyISO) {
  const est = estimarMeta(p.pesoKg, p.pesoObjetivo, hoyISO), e = expDe(o.exp);
  const frase = est
    ? `Estimamos que con Cadencia IA puedes lograr tu objetivo para el <b class="proy-fecha">${fechaLarga(est.fecha)}</b>`
    : 'Con Cadencia IA mantendrás tu peso estable, con energía y constancia';
  return `<h1 class="ob-title">¡Tu plan está listo!</h1>
    <div class="summary">
      <dl>
        <dt>Sexo</dt><dd>${p.sexo === 'mujer' ? 'Mujer' : 'Hombre'}</dd>
        <dt>Experiencia</dt><dd>${e ? e.t : '–'}</dd>
        <dt>Peso actual</dt><dd>${nf(p.pesoKg, 1)} kg</dd>
        <dt>Peso meta</dt><dd>${nf(p.pesoObjetivo, 1)} kg</dd>
      </dl>
    </div>
    <section class="proy" aria-label="Proyección">
      <span class="plan-chip">${svg(I_SPARK, 14, 2.4)}Proyección Cadencia IA</span>
      <div class="proy-graf">${graficaHTML(p.pesoKg, p.pesoObjetivo, est)}</div>
      <p class="proy-txt">${frase}</p>
      ${est ? `<p class="small muted">Unas ${est.semanas} semanas a un ritmo saludable. Es una estimación orientativa: cada cuerpo es distinto.</p>` : ''}
    </section>`;
}
const I_SPARK = '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>';

const HUELLA = '<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>';
export const FIRMA_TXT = 'Mantén pulsado para firmar';

export function firmaHTML(o, nombre) {
  const hecho = !!o.firmado;
  return `<h1 class="ob-title">Tu compromiso</h1>
    <p class="ob-sub">Firmarlo te ayuda a cumplirlo. Léelo y mantén pulsado.</p>
    <blockquote class="pact">
      <p>Prometo entrenar con Cadencia <b>${o.freq} veces a la semana</b>. Sin excusas.</p>
      <footer>${esc(nombre)}</footer>
    </blockquote>
    <div class="sign">
      <button type="button" class="sign-btn ${hecho ? 'done' : ''}" data-hold ${hecho ? 'disabled' : ''} aria-label="${FIRMA_TXT} durante 2 segundos">
        <svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="trk" cx="50" cy="50" r="46"/><circle class="bar" cx="50" cy="50" r="46" pathLength="100" style="stroke-dashoffset:${hecho ? 0 : 100}"/></svg>
        <span class="sign-in">${hecho ? svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 64, 2.6) : svg(HUELLA, 64, 1.6)}<span class="sign-lbl" data-lbl="${FIRMA_TXT}">${hecho ? '¡Firmado!' : FIRMA_TXT}</span></span>
      </button>
      <p class="small muted">${hecho ? 'Guardando tu plan…' : 'Mantén el dedo 2 segundos. Si lo sueltas antes, se reinicia.'}</p>
    </div>`;
}

/* ---------- botón de firma: mantener pulsado 2 s ---------- */
// Se llama una sola vez al arrancar la app. Todo va por eventos de puntero (ratón, dedo y lápiz) y por teclado (barra espaciadora / Intro).
// El anillo se anima tocando el DOM directamente: si se llamara a render() a mitad se perdería el botón y la pulsación.
export function iniciarFirma(root, alFirmar) {
  let h = null; // pulsación en curso: { btn, t0, raf }
  const pinta = (b, p) => { const bar = b.querySelector('.bar'); if (bar) bar.style.strokeDashoffset = String(100 - p * 100); };
  const rotulo = (b, txt) => { const l = b.querySelector('.sign-lbl'); if (l) l.textContent = txt == null ? l.dataset.lbl : txt; };
  const parar = () => {
    if (!h) return;
    cancelAnimationFrame(h.raf);
    const b = h.btn; h = null;
    if (b.isConnected) { b.classList.remove('holding'); pinta(b, 0); rotulo(b); }
  };
  const tic = () => {
    if (!h) return;
    if (!h.btn.isConnected) return parar();
    const p = Math.min(1, (performance.now() - h.t0) / FIRMA_MS);
    pinta(h.btn, p);
    if (p < 1) { h.raf = requestAnimationFrame(tic); return; }
    const b = h.btn; h = null;
    b.classList.remove('holding'); b.classList.add('done'); rotulo(b, '¡Firmado!');
    try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) { /* sin vibración */ }
    alFirmar();
  };
  const empezar = (b) => {
    if (h || b.disabled || b.classList.contains('done')) return false;
    h = { btn: b, t0: performance.now(), raf: 0 };
    b.classList.add('holding'); rotulo(b, 'Sigue pulsando…');
    h.raf = requestAnimationFrame(tic);
    return true;
  };
  root.addEventListener('pointerdown', (e) => {
    const b = e.target.closest && e.target.closest('[data-hold]');
    if (!b || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    if (empezar(b)) { try { b.setPointerCapture(e.pointerId); } catch (x) { /* nada */ } }
  });
  root.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('[data-hold]')) e.preventDefault(); });
  root.addEventListener('keydown', (e) => {
    const b = e.target.closest && e.target.closest('[data-hold]');
    if (b && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); if (!e.repeat) empezar(b); }
  });
  root.addEventListener('keyup', (e) => { if (e.target.closest && e.target.closest('[data-hold]') && (e.key === ' ' || e.key === 'Enter')) parar(); });
  window.addEventListener('pointerup', parar);
  window.addEventListener('pointercancel', parar);
  window.addEventListener('blur', parar);
  document.addEventListener('visibilitychange', () => { if (document.hidden) parar(); });
  // Si el dedo se sale del botón (más de 24 px), se cancela.
  window.addEventListener('pointermove', (e) => {
    if (!h) return;
    const r = h.btn.getBoundingClientRect(), m = 24;
    if (e.clientX < r.left - m || e.clientX > r.right + m || e.clientY < r.top - m || e.clientY > r.bottom + m) parar();
  });
}
