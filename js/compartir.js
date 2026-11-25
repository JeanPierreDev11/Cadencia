// Compartir entreno (45): modal «Compartir Entreno» con 4 plantillas (resumen, mapa muscular, minimalista 9:16 y lista de ejercicios).
// La imagen se DIBUJA en un <canvas> 2D (nada de html2canvas ni de SVG con foreignObject: fallan en iOS Safari con fuentes y SVG),
// así el PNG sale igual en cualquier navegador y el fondo transparente sale limpio.
// Acciones (barra circular): Fondo (oscuro | transparente | foto de la galería), Copiar (portapapeles), Guardar (descarga) y Más (Web Share API).
import { esc, nf, fmtDate, toast, I } from './util.js';
import * as E from './entreno.js';

/* ---------- constantes fáciles de editar ---------- */
export const TEXTO_ETIQUETA = 'Comparte tu entreno · Etiqueta a @cadenciafit.app'; // texto discreto bajo las acciones
export const MARCA = 'CADENCIA';                                                // logo de texto de las tarjetas
const ACENTO = '#F2BE1A';                                                       // amarillo de la app (--accent)
const ESCALA_EXPORT = 1;       // 1 = 1080 px de ancho (el tamaño nativo de Stories/posts). 2 = 2160 px; se limita solo para no pasar el máximo de iOS (~16 M px)
const ESCALA_PREVIA = 0.6;     // resolución de las vistas previas del carrusel (suficiente en pantallas de 3x)
const FOTO_MAX = 2400;         // lado mayor al que se reduce la foto de la galería (ahorra memoria en el móvil)

// Plantillas del carrusel: tamaño en píxeles del PNG final.
export const PLANTILLAS = [
  { id: 'resumen', n: 'Resumen completo', w: 1080, h: 1080 },
  { id: 'mapa', n: 'Mapa muscular', w: 1080, h: 1080 },
  { id: 'vertical', n: 'Minimalista vertical', w: 1080, h: 1920 },
  { id: 'lista', n: 'Lista de ejercicios', w: 1080, h: 1350 },
];

const FUENTE = "'Archivo', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const fnt = (peso, px) => `${peso} ${px}px ${FUENTE}`;
const TEMAS = {
  oscuro: { ink: '#FFFFFF', mute: '#8E8E8E', linea: '#2A2A2A', base: '#262626', sombra: false },
  // Transparente: va pegado sobre fotos de cualquier luz (Stories), así que todo en blanco casi sólido, sombra oscura nítida y silueta con contorno.
  transparente: { ink: '#FFFFFF', mute: 'rgba(255,255,255,.95)', linea: 'rgba(255,255,255,.55)', base: 'rgba(255,255,255,.35)', contorno: 'rgba(255,255,255,.85)', sombra: { c: 'rgba(0,0,0,.85)', b: 12 } },
  foto: { ink: '#FFFFFF', mute: 'rgba(255,255,255,.78)', linea: 'rgba(255,255,255,.34)', base: 'rgba(255,255,255,.24)', sombra: { c: 'rgba(0,0,0,.55)', b: 14 } },
};

/* ---------- datos de la tarjeta ---------- */
const durPartes = (min) => { min = Math.round(min || 0); if (min < 60) return [[String(min), 'MIN']]; const h = Math.floor(min / 60), r = min % 60; return r ? [[String(h), 'H'], [String(r), 'MIN']] : [[String(h), 'H']]; };
const durTxt = (min) => durPartes(min).map(([n, u]) => `${n} ${u.toLowerCase()}`).join(' ');

// Mejor serie de un ejercicio: si superó su récord anterior, la serie del récord; si no, la de mayor peso (a igual peso, más repeticiones).
function mejorSerie(e, prev) {
  const lados = (s) => (e.uni ? E.ladosSerie(s) : [{ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 }]);
  let pesada = null, tope = null;
  for (const s of E.trabajo(e.series)) for (const l of lados(s)) {
    if (!l.reps) continue;
    const score = l.kg > 0 ? l.kg * (1 + l.reps / 30) : l.reps; // mismo criterio que E.records (Epley)
    if (!pesada || l.kg > pesada.kg || (l.kg === pesada.kg && l.reps > pesada.reps)) pesada = { kg: l.kg, reps: l.reps };
    if (!tope || score > tope.score) tope = { kg: l.kg, reps: l.reps, score };
  }
  if (!pesada) return null;
  const antes = prev.get(String(e.n || '').trim().toLowerCase());
  const pr = antes > 0 && tope.score > antes + 1e-9;
  const s = pr ? tope : pesada;
  const porLado = !e.uni && E.cargaDe(e) === 'por_lado';
  const set = s.kg > 0 ? `${nf(Math.round(s.kg * 10) / 10, s.kg % 1 ? 1 : 0)} kg${porLado ? ' c/u' : ''} × ${s.reps}` : `${s.reps} reps`;
  return { n: String(E.canon(e.n) || e.n || '').trim(), set, pr };
}

// Todo lo que pintan las plantillas, a partir de un entreno guardado. `ai` = análisis del Coach AI (o null), `perfil`/`user` para el @usuario.
export function datosDe(w, ws, perfil, user, ai) {
  const fuerza = (w.ejercicios || []).filter((e) => !E.exCardio(e));
  const prev = new Map(E.records((ws || []).filter((x) => x.id !== w.id && x.fecha <= w.fecha)).gym.map((r) => [r.key, r.best.score]));
  const ejercicios = fuerza.map((e) => mejorSerie(e, prev)).filter(Boolean);
  const p = perfil || {}, u = user || {};
  const usuario = p.usuario ? `@${p.usuario}` : String(p.nombre || u.name || '').trim();
  const mus = E.seriesPorMusculo(w), max = Math.max(0, ...Object.values(mus));
  const inten = {};
  for (const k of Object.keys(mus)) if (mus[k] > 0 && max > 0) inten[k] = 0.5 + 0.5 * (mus[k] / max); // todo músculo trabajado se ve; el más cargado brilla más
  const top = Object.keys(inten).sort((a, b) => inten[b] - inten[a]).slice(0, 4).map((k) => E.MUSC_DET[k]).filter(Boolean);
  return {
    id: w.id, nombre: String(w.nombre || E.TIPOS[w.tipo] || 'Entreno').trim(), fecha: w.fecha,
    fechaTxt: fmtDate(w.fecha, { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase(),
    min: w.min || 0, durPartes: durPartes(w.min), durTxt: durTxt(w.min),
    series: E.seriesDe(w), vol: Math.round(E.volumenDe(w)), nEj: fuerza.length,
    ejercicios, usuario, inten, top,
    ai: ai && Number.isFinite(Number(ai.nota)) ? { nota: Number(ai.nota), titulo: ai.titulo || '' } : null,
  };
}

/* ---------- siluetas (viewBox 200 × 420). Cada región es un lado (izquierda de la pantalla) y se refleja; `u` = sin reflejar ---------- */
const BASE = [
  { d: 'M64 68 Q100 56 136 68 L132 120 Q128 148 124 170 L120 198 L80 198 L76 170 Q72 148 68 120 Z', u: 1 }, // torso
  { d: 'M92 44 L108 44 L110 62 L90 62 Z', u: 1 },                                                            // cuello
  { d: 'M46 84 Q44 112 46 140 L66 140 Q68 112 68 88 Z' },                                                      // brazo
  { d: 'M45 144 L65 144 L60 198 L44 198 Q43 170 45 144 Z' },                                                   // antebrazo
  { d: 'M44 200 Q51 196 59 200 Q61 214 55 222 Q47 222 44 212 Z' },                                             // mano
  { d: 'M78 198 L99 200 L97 296 L80 296 Q70 250 78 198 Z' },                                                   // muslo
  { d: 'M80 300 L96 300 L92 392 L83 392 Q77 346 80 300 Z' },                                                   // pierna
  { d: 'M82 394 L93 394 L97 412 L76 412 Q76 398 82 394 Z' },                                                   // pie
];
const REGIONES = {
  frente: [
    { k: 'sh', d: ['M50 72 Q54 64 66 66 L72 70 L70 98 Q60 104 52 98 Q46 86 50 72 Z'] },
    { k: 'ch', d: ['M98 68 L74 70 L72 96 Q78 108 98 106 Z'] },
    { k: 'ab', d: ['M84 110 L98 110 L98 178 Q90 180 84 172 Z', 'M74 112 L82 112 L82 170 L78 164 Q74 140 74 112 Z'] },
    { k: 'bi', d: ['M50 100 L68 102 L67 138 L48 138 Q47 118 50 100 Z'] },
    { k: 'fo', d: ['M47 144 L66 144 L61 196 L45 196 Q44 170 47 144 Z'] },
    { k: 'qu', d: ['M76 206 L92 208 L91 292 L80 292 Q70 250 76 206 Z'] },
    { k: 'ad', d: ['M93 208 L99 210 L98 278 L92 290 Z'] },
    { k: 'ca', d: ['M81 304 L96 304 L92 388 L84 388 Q78 346 81 304 Z'] },
    { k: 'ne', d: ['M92 44 L108 44 L110 62 L90 62 Z'], u: 1 },
  ],
  espalda: [
    { k: 'tp', d: ['M100 58 L88 62 L72 70 L76 80 L90 84 L100 96 Z'] },
    { k: 'sh', d: ['M50 72 Q54 64 66 66 L72 70 L70 98 Q60 104 52 98 Q46 86 50 72 Z'] },
    { k: 'la', d: ['M72 88 L90 104 L90 150 L84 152 Q70 124 72 88 Z'] },
    { k: 'mb', d: ['M90 90 L99 100 L99 130 L90 128 Z'] },
    { k: 'lb', d: ['M90 136 L99 136 L99 176 L92 176 Z'] },
    { k: 'tr', d: ['M50 100 L68 102 L67 138 L48 138 Q47 118 50 100 Z'] },
    { k: 'fo', d: ['M47 144 L66 144 L61 196 L45 196 Q44 170 47 144 Z'] },
    { k: 'abd', d: ['M70 188 L78 184 L76 208 L69 204 Z'] },
    { k: 'gl', d: ['M79 182 L99 182 L99 214 Q84 222 76 208 Q74 194 79 182 Z'] },
    { k: 'ha', d: ['M77 222 L98 218 L96 292 L80 292 Q72 256 77 222 Z'] },
    { k: 'ca', d: ['M80 300 L97 300 L93 384 L83 384 Q76 340 80 300 Z'] },
    { k: 'ne', d: ['M92 44 L108 44 L110 62 L90 62 Z'], u: 1 },
  ],
};
const P2D = new Map();
const trazo = (d) => { let p = P2D.get(d); if (!p) { p = new Path2D(d); P2D.set(d, p); } return p; }; // Path2D con datos SVG: Safari ≥ 10

// Dibuja una silueta (vista = 'frente' | 'espalda') en (x, y) con escala s. Los músculos con intensidad brillan en amarillo neón.
function figura(ctx, vista, x, y, s, d, t, K) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  const lado = (fn) => { fn(); ctx.save(); ctx.translate(200, 0); ctx.scale(-1, 1); fn(); ctx.restore(); }; // izquierda + reflejo (derecha)
  const pintar = (items, fill, borde) => { for (const r of items) { const f = () => r.d.forEach((q) => { ctx.fill(trazo(q)); if (borde) ctx.stroke(trazo(q)); }); fill(r); if (r.u) f(); else lado(f); } };
  ctx.fillStyle = t.base;
  if (t.contorno) { // transparente: relleno claro + contorno blanco fino + sombra oscura detrás (legible sobre cualquier foto)
    ctx.strokeStyle = t.contorno; ctx.lineWidth = 2.4 / s; ctx.lineJoin = 'round';
    ctx.shadowColor = t.sombra.c; ctx.shadowBlur = t.sombra.b * K; ctx.shadowOffsetY = 2 * K;
  }
  ctx.beginPath(); ctx.ellipse(100, 26, 16, 20, 0, 0, Math.PI * 2); ctx.fill(); if (t.contorno) ctx.stroke(); // cabeza
  pintar(BASE.map((b) => ({ d: [b.d], u: b.u })), () => {}, !!t.contorno);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // regiones sin trabajar: mismo color de la silueta (limpio); las trabajadas, encima y con brillo
  const trabajadas = REGIONES[vista].filter((r) => d.inten[r.k]);
  ctx.save();
  ctx.shadowColor = ACENTO; ctx.shadowBlur = 20 * K;
  pintar(trabajadas, (r) => { ctx.fillStyle = `rgba(242,190,26,${(0.45 + 0.55 * d.inten[r.k]).toFixed(3)})`; });
  ctx.restore();
  ctx.restore();
}

/* ---------- utilidades de texto ---------- */
function recortar(ctx, s, max, esp = 0) {
  const w = (q) => ctx.measureText(q).width + esp * Math.max(0, [...q].length - 1);
  if (w(s) <= max) return s;
  let q = s; while (q.length > 1 && w(q + '…') > max) q = q.slice(0, -1);
  return q.trimEnd() + '…';
}
function lineas(ctx, s, max, maxLin) { // parte en líneas por palabras; la última acaba en «…» si no cabe
  const pal = String(s).split(/\s+/).filter(Boolean), out = []; let cur = '';
  for (let i = 0; i < pal.length; i++) {
    const prueba = cur ? `${cur} ${pal[i]}` : pal[i];
    if (ctx.measureText(prueba).width <= max || !cur) cur = prueba; else { out.push(cur); cur = pal[i]; }
    if (out.length === maxLin) break;
  }
  if (cur && out.length < maxLin) out.push(cur);
  const resto = pal.join(' ').length > out.join(' ').length;
  if (resto && out.length) out[out.length - 1] = recortar(ctx, out[out.length - 1] + '…', max);
  return out.map((l) => (ctx.measureText(l).width > max ? recortar(ctx, l, max) : l));
}

// Todo el dibujo vive aquí: cada plantilla es una función (ctx, d, t, K) con coordenadas en el espacio de 1080 px.
function crearPincel(ctx, t, K) {
  const sombra = (on) => { if (on && t.sombra) { ctx.shadowColor = t.sombra.c; ctx.shadowBlur = t.sombra.b * K; ctx.shadowOffsetY = 2 * K; } else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; } };
  const txt = (s, x, y, { fuente, color, align = 'left', esp = 0, max }) => {
    ctx.font = fuente; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const q = max ? recortar(ctx, s, max, esp) : s;
    const w = ctx.measureText(q).width + esp * Math.max(0, [...q].length - 1);
    let x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    sombra(true);
    if (!esp) ctx.fillText(q, x0, y); else for (const ch of q) { ctx.fillText(ch, x0, y); x0 += ctx.measureText(ch).width + esp; }
    sombra(false);
    return w;
  };
  const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const etiqueta = (s, x, y, o = {}) => txt(s.toUpperCase(), x, y, { fuente: fnt(700, o.px || 28), color: o.color || t.mute, esp: o.esp == null ? 5 : o.esp, align: o.align, max: o.max });
  // Valor grande con su unidad: partes = [['1','H'],['12','MIN']]. Se encoge solo si no cabe en `max`.
  const valor = (partes, x, y, px, { align = 'left', max = 9999, color = t.ink } = {}) => {
    const medir = (p) => { let w = 0; partes.forEach(([n, u], i) => { ctx.font = fnt(800, p); w += ctx.measureText(n).width; if (u) { ctx.font = fnt(700, p * 0.4); w += p * 0.1 + ctx.measureText(u).width; } if (i < partes.length - 1) w += p * 0.28; }); return w; };
    let p = px; while (medir(p) > max && p > 24) p *= 0.94;
    const tot = medir(p); let cx = align === 'center' ? x - tot / 2 : align === 'right' ? x - tot : x;
    sombra(true); ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    partes.forEach(([n, u], i) => {
      ctx.font = fnt(800, p); ctx.fillStyle = color; ctx.fillText(n, cx, y); cx += ctx.measureText(n).width;
      if (u) { ctx.font = fnt(700, p * 0.4); ctx.fillStyle = t.mute; cx += p * 0.1; ctx.fillText(u, cx, y); cx += ctx.measureText(u).width; }
      if (i < partes.length - 1) cx += p * 0.28;
    });
    sombra(false);
    return p;
  };
  const titulo = (s, x, y, max, { align = 'left', tams = [104, 88, 72, 60], maxLin = 2, interlinea = 1.08, seco = false } = {}) => {
    const S = s.toUpperCase();
    let px = tams[0], ls = [];
    for (const q of tams) { px = q; ctx.font = fnt(800, q); ls = lineas(ctx, S, max, maxLin); if (ls.length <= maxLin && ls.every((l) => !l.endsWith('…'))) break; }
    if (!seco) ls.forEach((l, i) => txt(l, x, y + i * px * interlinea, { fuente: fnt(800, px), color: t.ink, align }));
    return { px, n: ls.length, alto: ls.length * px * interlinea };
  };
  const marca = (y, usuario, modo = 'lados', W = 1080) => {
    if (modo === 'centro') {
      txt(MARCA, W / 2, y, { fuente: fnt(800, 46), color: t.ink, esp: 12, align: 'center' });
      if (usuario) txt(usuario, W / 2, y + 52, { fuente: fnt(700, 32), color: t.mute, align: 'center', max: 760 });
      return;
    }
    rect(80, y - 40, 10, 44, ACENTO);
    const w = txt(MARCA, 108, y, { fuente: fnt(800, 44), color: t.ink, esp: 11 });
    if (usuario) txt(usuario, 1000, y, { fuente: fnt(700, 34), color: t.mute, align: 'right', max: 960 - 108 - w });
  };
  return { txt, rect, etiqueta, valor, titulo, marca, sombra };
}

/* ---------- plantillas ---------- */
const PLANT = {
  // 1) Resumen completo (cuadrada)
  resumen(ctx, d, t, K) {
    const { txt, rect, etiqueta, valor, titulo, marca } = crearPincel(ctx, t, K);
    etiqueta('Entreno completado', 80, 134, { px: 26 });
    etiqueta(d.fechaTxt, 1000, 134, { px: 26, align: 'right' });
    rect(80, 176, 96, 8, ACENTO);
    titulo(d.nombre, 80, 296, 920, { tams: [112, 96, 80, 64], maxLin: 2 });
    const celdas = [['Duración', d.durPartes], ['Series', [[String(d.series)]]], ['Volumen total', [[nf(d.vol), 'KG']]], ['Ejercicios', [[String(d.nEj)]]]];
    celdas.forEach(([l, p], i) => {
      const x = 80 + (i % 2) * 480, y = 470 + Math.floor(i / 2) * 240;
      rect(x, y, 440, 2, t.linea);
      etiqueta(l, x, y + 62, { px: 26 });
      valor(p, x, y + 176, 124, { max: 430 });
    });
    rect(80, 962, 920, 2, t.linea);
    marca(1022, d.usuario);
  },

  // 2) Mapa muscular (cuadrada)
  mapa(ctx, d, t, K) {
    const { txt, rect, etiqueta, valor, titulo, marca } = crearPincel(ctx, t, K);
    etiqueta(d.fechaTxt, 80, 134, { px: 26 });
    rect(80, 166, 96, 8, ACENTO);
    titulo(d.nombre, 80, 250, 920, { tams: [68, 58, 48], maxLin: 1 });
    [['Duración', d.durPartes], ['Series', [[String(d.series)]]], ['Volumen', [[nf(d.vol), 'KG']]]].forEach(([l, p], i) => {
      const y = 350 + i * 190;
      etiqueta(l, 80, y, { px: 26 });
      valor(p, 80, y + 112, 108, { max: 380 });
    });
    const s = 1.16;
    figura(ctx, 'frente', 500, 318, s, d, t, K);
    figura(ctx, 'espalda', 760, 318, s, d, t, K);
    etiqueta('Frente', 500 + 116, 846, { px: 22, align: 'center', esp: 4 });
    etiqueta('Espalda', 760 + 116, 846, { px: 22, align: 'center', esp: 4 });
    txt(d.top.length ? d.top.join(' · ') : 'Sin datos de músculos', 750, 906, { fuente: fnt(700, 30), color: t.ink, align: 'center', max: 500 });
    marca(1022, d.usuario);
  },

  // 3) Minimalista vertical 9:16 (pensada como sticker: todo en la franja central, lejos de los bordes que tapa Instagram)
  vertical(ctx, d, t, K) {
    const { txt, rect, etiqueta, valor, titulo, marca } = crearPincel(ctx, t, K);
    const W = 1080, cx = W / 2;
    // Altura total del bloque para centrarlo: etiqueta + título + barra + 3 cifras (+ Coach AI)
    const hTit = titulo(d.nombre, 0, 0, 880, { tams: [104, 88, 72], maxLin: 3, seco: true }).alto, hStats = 3 * 250, hAI = d.ai ? 330 : 0;
    const total = 96 + hTit + 170 + hStats - 120 + (d.ai ? 20 + hAI : 0);
    let y = Math.max(300, (1920 - total) / 2);
    etiqueta('Entreno completado', cx, y, { px: 26, align: 'center' }); y += 96;
    const tt = titulo(d.nombre, cx, y, 880, { align: 'center', tams: [104, 88, 72], maxLin: 3 }); y += tt.alto - 20;
    rect(cx - 48, y, 96, 8, ACENTO); y += 200;
    [['Duración', d.durPartes], ['Series', [[String(d.series)]]], ['Volumen', [[nf(d.vol), 'KG']]]].forEach(([l, p]) => {
      valor(p, cx, y, 150, { align: 'center', max: 820 });
      etiqueta(l, cx, y + 52, { px: 26, align: 'center' });
      y += 250;
    });
    if (d.ai) {
      y += 20;
      etiqueta('Coach AI', cx, y, { px: 26, align: 'center', color: ACENTO });
      const nota = nf(d.ai.nota, 1);
      ctx.font = fnt(800, 120); const wN = ctx.measureText(nota).width; ctx.font = fnt(700, 48); const wD = ctx.measureText('/10').width;
      const x0 = cx - (wN + 10 + wD) / 2;
      txt(nota, x0, y + 128, { fuente: fnt(800, 120), color: ACENTO });
      txt('/10', x0 + wN + 10, y + 128, { fuente: fnt(700, 48), color: t.mute });
      if (d.ai.titulo) txt(d.ai.titulo, cx, y + 196, { fuente: fnt(700, 34), color: t.ink, align: 'center', max: 820 });
    }
    marca(1768, d.usuario, 'centro');
  },

  // 4) Lista de ejercicios con la mejor serie (PR o mayor peso) de cada uno
  lista(ctx, d, t, K) {
    const { txt, rect, etiqueta, titulo, marca } = crearPincel(ctx, t, K);
    etiqueta('Entreno completado', 80, 120, { px: 26 });
    etiqueta(d.fechaTxt, 1000, 120, { px: 26, align: 'right' });
    rect(80, 160, 96, 8, ACENTO);
    const tt = titulo(d.nombre, 80, 254, 920, { tams: [84, 72, 60], maxLin: 2 });
    let y = 254 + tt.alto - 12;
    txt(`${d.durTxt} · ${d.series} ${d.series === 1 ? 'serie' : 'series'} · ${nf(d.vol)} kg`, 80, y + 18, { fuente: fnt(700, 32), color: t.mute, max: 920 });
    y += 62; rect(80, y, 920, 2, t.linea);
    const MAX = 8, lista = d.ejercicios.slice(0, MAX), resto = d.ejercicios.length - lista.length;
    const fin = 1190, pie = resto > 0 ? 44 : 0;
    const alto = Math.min(104, (fin - pie - y) / Math.max(1, lista.length));
    lista.forEach((e, i) => {
      const yy = y + i * alto, base = yy + alto / 2 + 14;
      txt(String(i + 1).padStart(2, '0'), 80, base, { fuente: fnt(800, 32), color: ACENTO });
      ctx.font = fnt(800, 40); const wSet = ctx.measureText(e.set).width;
      let tope = 1000 - wSet - 24;
      if (e.pr) { // etiqueta «PR» en amarillo a la izquierda de la serie
        ctx.font = fnt(800, 26); const wPR = ctx.measureText('PR').width + 30;
        const px = 1000 - wSet - 20 - wPR; ctx.fillStyle = ACENTO; ctx.fillRect(px, base - 32, wPR, 42);
        txt('PR', px + wPR / 2, base - 2, { fuente: fnt(800, 26), color: '#000000', align: 'center' });
        tope = px - 24;
      }
      txt(e.set, 1000, base, { fuente: fnt(800, 40), color: t.ink, align: 'right' });
      txt(e.n, 150, base, { fuente: fnt(700, 38), color: t.ink, max: tope - 150 });
      rect(80, yy + alto - 1, 920, 1.5, t.linea);
    });
    if (!lista.length) txt('Sin ejercicios de fuerza en esta sesión', 80, y + 80, { fuente: fnt(700, 34), color: t.mute });
    if (resto > 0) txt(`+${resto} ${resto === 1 ? 'ejercicio más' : 'ejercicios más'}`, 80, y + lista.length * alto + 34, { fuente: fnt(700, 28), color: t.mute });
    marca(1272, d.usuario);
  },
};

/* ---------- foto de fondo ---------- */
let foto = null, fotoN = 0; // { c: canvas reducido } y contador (para la caché)
function cubrir(ctx, im, W, H) { const iw = im.width, ih = im.height, s = Math.max(W / iw, H / ih), dw = iw * s, dh = ih * s; ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh); }

// Dibuja la plantilla `idx` y devuelve el <canvas> (W×H × escala). fondo: 'oscuro' | 'transparente' | 'foto'.
export function dibujar(idx, d, { fondo = 'oscuro', escala = 1 } = {}) {
  const P = PLANTILLAS[idx] || PLANTILLAS[0];
  const c = document.createElement('canvas');
  c.width = Math.round(P.w * escala); c.height = Math.round(P.h * escala);
  const ctx = c.getContext('2d');
  ctx.scale(escala, escala);
  const modo = fondo === 'foto' && foto ? 'foto' : fondo === 'transparente' ? 'transparente' : 'oscuro';
  const t = TEMAS[modo];
  if (modo === 'oscuro') {
    ctx.fillStyle = '#0B0B0B'; ctx.fillRect(0, 0, P.w, P.h);
    const g = ctx.createRadialGradient(P.w, 0, 0, P.w, 0, P.w * 0.95); g.addColorStop(0, 'rgba(242,190,26,.13)'); g.addColorStop(1, 'rgba(242,190,26,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, P.w, P.h);
  } else if (modo === 'foto') {
    cubrir(ctx, foto.c, P.w, P.h);
    const g = ctx.createLinearGradient(0, 0, 0, P.h); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(0.45, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,.7)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, P.w, P.h);
  }
  PLANT[P.id](ctx, d, t, escala);
  return c;
}
const escalaExport = (P) => Math.min(ESCALA_EXPORT, Math.sqrt(16e6 / (P.w * P.h))); // iOS Safari no dibuja canvas de más de ~16,7 M px

// Fuentes: hay que esperar a Archivo antes de dibujar o el canvas usa la fuente de repuesto (en iOS pasa a menudo).
let fuentes = null, fuentesOk = false;
export function cargarFuentes() {
  if (fuentes) return fuentes;
  const fs = typeof document !== 'undefined' && document.fonts;
  const muestra = 'ÁÉÍÓÚÑáéíóúñ0123456789';
  fuentes = (fs && fs.load ? Promise.all([fs.load(fnt(800, 40), muestra), fs.load(fnt(700, 30), muestra)]) : Promise.resolve()).catch(() => {}).then(() => { fuentesOk = true; });
  return fuentes;
}

/* ---------- controlador (estado en st.compartir = { id, i, fondo, menu }) ---------- */
const ICO = (d) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONOS = {
  fondo: ICO('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3L16 12l4 4.5"/>'),
  copiar: ICO('<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>'),
  guardar: ICO('<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19h14"/>'),
  mas: ICO('<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>'),
};
const FONDOS = [['oscuro', 'Oscuro'], ['transparente', 'Transparente'], ['foto', 'Foto']];

export function crearCompartir(ctx) {
  const { st, root } = ctx;
  const render = () => ctx.render();
  const cache = new Map();
  let memo = null, inputFoto = null;

  const workout = () => st.compartir && (st.workouts || []).find((x) => x.id === st.compartir.id);
  const datos = () => {
    const w = workout(); if (!w) return null;
    const ai = ctx.aiDe ? ctx.aiDe(w) : null, ws = st.workouts;
    if (memo && memo.w === w && memo.ws === ws && memo.p === st.profile && memo.ai === (ai ? ai.nota : null)) return memo.d;
    const d = datosDe(w, ws, st.profile, st.user, ai);
    memo = { w, ws, p: st.profile, ai: ai ? ai.nota : null, d };
    return d;
  };

  function abrir(id, i = 0) { st.compartir = { id, i: i >= 0 && i < PLANTILLAS.length ? i : 0, fondo: 'oscuro', menu: false }; render(); }
  const cerrar = () => { st.compartir = null; render(); };

  function sheetHTML() {
    const c = st.compartir, d = datos();
    if (!c || !d) return '';
    const slides = PLANTILLAS.map((P, i) => `<div class="cp-slide"><div class="cp-frame${c.fondo === 'transparente' ? ' cp-trans' : ''}" style="aspect-ratio:${P.w} / ${P.h};--ar:${(P.w / P.h).toFixed(4)}"><canvas data-cp="${i}" role="img" aria-label="Plantilla ${i + 1} de ${PLANTILLAS.length}: ${esc(P.n)}"></canvas></div></div>`).join('');
    const dots = PLANTILLAS.map((P, i) => `<button type="button" class="cp-dot${i === c.i ? ' on' : ''}" data-act="cp-dot" data-v="${i}" aria-label="${esc(P.n)} (${i + 1} de ${PLANTILLAS.length})"></button>`).join('');
    const chips = c.menu ? `<div class="cp-fondos" role="group" aria-label="Fondo de la tarjeta">${FONDOS.map(([k, n]) => `<button type="button" class="cp-chip${c.fondo === k ? ' on' : ''}" data-act="${k === 'foto' ? 'cp-foto' : 'cp-bg'}" data-v="${k}" aria-pressed="${c.fondo === k}">${n}</button>`).join('')}</div>` : '';
    const act = (a, ico, n, extra = '') => `<button type="button" class="cp-act${extra}" data-act="${a}"><span class="cp-circ">${ICONOS[ico]}</span><span class="cp-lbl">${n}</span></button>`;
    return `<div class="sheet-back" data-act="cp-close"></div>
    <div class="sheet short cp-sheet" role="dialog" aria-modal="true" aria-label="Compartir entreno">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><span style="width:36px"></span><h2>Compartir Entreno</h2><button type="button" class="iconbtn" data-act="cp-close" aria-label="Cerrar">${I.back}</button></div>
      <div class="cp-body">
        <p class="cp-sub">Hiciste el trabajo. Es hora de presumirlo.</p>
        <div class="cp-car" data-cpcar>${slides}</div>
        <div class="cp-dots" role="group" aria-label="Plantillas">${dots}</div>
        ${chips}
        <div class="cp-acts" role="group" aria-label="Acciones">
          ${act('cp-fondo', 'fondo', 'Fondo', c.menu ? ' on' : '')}${act('cp-copiar', 'copiar', 'Copiar')}${act('cp-guardar', 'guardar', 'Guardar')}${act('cp-compartir', 'mas', 'Más')}
        </div>
        <p class="cp-tag">${esc(TEXTO_ETIQUETA)}</p>
      </div>
      <div class="cp-foot"><button type="button" class="btn block" data-act="cp-close">LISTO</button></div>
    </div>`;
  }

  // Vistas previas: se dibujan tras cada render() (el DOM se reconstruye). Una caché evita volver a dibujar lo mismo.
  function pintar() {
    const c = st.compartir; if (!c) return;
    const d = datos(); if (!d) return;
    if (!fuentesOk) cargarFuentes().then(() => { cache.clear(); if (st.compartir) pintar(); });
    root.querySelectorAll('canvas[data-cp]').forEach((cv) => {
      const i = Number(cv.dataset.cp), clave = `${d.id}|${i}|${c.fondo}|${fotoN}|${fuentesOk}|${d.ai ? d.ai.nota : ''}|${d.ejercicios.length}`;
      let src = cache.get(clave);
      if (!src) { src = dibujar(i, d, { fondo: c.fondo, escala: ESCALA_PREVIA }); if (cache.size > 24) cache.clear(); cache.set(clave, src); }
      cv.width = src.width; cv.height = src.height;
      cv.getContext('2d').drawImage(src, 0, 0);
    });
    const car = root.querySelector('[data-cpcar]');
    if (car && c.i) { car.style.scrollBehavior = 'auto'; car.scrollLeft = c.i * car.clientWidth; car.style.scrollBehavior = ''; }
  }

  // Punto del carrusel según el desplazamiento (sin render(): solo se tocan las clases)
  root.addEventListener('scroll', (e) => {
    const car = e.target; if (!st.compartir || !car.matches || !car.matches('[data-cpcar]') || !car.clientWidth) return;
    const i = Math.max(0, Math.min(PLANTILLAS.length - 1, Math.round(car.scrollLeft / car.clientWidth)));
    if (i === st.compartir.i) return;
    st.compartir.i = i;
    root.querySelectorAll('.cp-dot').forEach((b, k) => b.classList.toggle('on', k === i));
  }, true);

  /* ---- imagen final ---- */
  async function blobActual() {
    const c = st.compartir, d = datos(); if (!c || !d) return null;
    await cargarFuentes();
    const P = PLANTILLAS[c.i], cv = dibujar(c.i, d, { fondo: c.fondo, escala: escalaExport(P) });
    return new Promise((res) => cv.toBlob((b) => res(b), 'image/png'));
  }
  const nombreArchivo = () => `cadencia-entreno-${(workout() || {}).fecha || 'hoy'}-${PLANTILLAS[st.compartir.i].id}.png`;
  const flash = (act, txt) => { // cambia un momento la etiqueta del botón (sin render())
    const l = root.querySelector(`[data-act="${act}"] .cp-lbl`); if (!l) return;
    const ant = l.textContent; l.textContent = txt;
    setTimeout(() => { if (l.isConnected && l.textContent === txt) l.textContent = ant; }, 1900);
  };
  function descargar(blob, nombre) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nombre; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function copiar() {
    if (!(navigator.clipboard && window.ClipboardItem && navigator.clipboard.write)) { toast('Tu navegador no permite copiar imágenes. Usa Guardar o Más.'); return; }
    try {
      // La promesa va DENTRO del ClipboardItem: Safari exige crearlo dentro del gesto del toque y rellenarlo después.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobActual().then((b) => { if (!b) throw new Error('sin imagen'); return b; }) })]);
      toast('Copiado para pegar en Stories'); flash('cp-copiar', '¡Copiado!');
    } catch (e) { toast('No se ha podido copiar la imagen. Prueba con Guardar o Más.'); }
  }
  async function guardar() {
    const b = await blobActual(); if (!b) return toast('No se ha podido crear la imagen.');
    descargar(b, nombreArchivo()); toast('Imagen guardada'); flash('cp-guardar', '¡Guardado!');
  }
  async function compartirNativo() {
    const b = await blobActual(); if (!b) return toast('No se ha podido crear la imagen.');
    const nombre = nombreArchivo(), file = new File([b], nombre, { type: 'image/png' });
    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Mi entreno en Cadencia' }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; /* cerró el menú: nada */ }
    descargar(b, nombre); toast('Tu navegador no puede compartir archivos: se ha descargado la imagen'); // sin Web Share con archivos
  }

  /* ---- foto de la galería ---- */
  function elegirFoto() {
    if (!inputFoto) {
      inputFoto = document.createElement('input');
      inputFoto.type = 'file'; inputFoto.accept = 'image/*'; inputFoto.tabIndex = -1; inputFoto.setAttribute('aria-hidden', 'true');
      inputFoto.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
      inputFoto.addEventListener('change', async () => {
        const f = inputFoto.files && inputFoto.files[0]; inputFoto.value = '';
        if (!f || !st.compartir) return;
        const url = URL.createObjectURL(f), im = new Image();
        try {
          im.src = url;
          await (im.decode ? im.decode() : new Promise((ok, ko) => { im.onload = ok; im.onerror = ko; }));
          const r = Math.min(1, FOTO_MAX / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(im.naturalWidth * r)); c.height = Math.max(1, Math.round(im.naturalHeight * r));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); // el navegador ya corrige la orientación EXIF
          foto = { c }; fotoN++; cache.clear();
          if (st.compartir) { st.compartir.fondo = 'foto'; st.compartir.menu = false; render(); }
        } catch (e) { toast('No se ha podido abrir esa foto. Prueba con otra (JPG o PNG).'); } finally { URL.revokeObjectURL(url); }
      });
      document.body.appendChild(inputFoto);
    }
    inputFoto.click(); // dentro del gesto del toque (iOS lo exige)
  }

  // Acciones `cp-*` (las llama el listener de clics de entreno-ui.js, antes de cualquier await)
  function click(act, b) {
    const c = st.compartir;
    if (act === 'cp-close') return cerrar();
    if (!c) return;
    if (act === 'cp-dot') { const i = Number(b.dataset.v), car = root.querySelector('[data-cpcar]'); c.i = i; if (car) car.scrollTo({ left: i * car.clientWidth, behavior: 'smooth' }); root.querySelectorAll('.cp-dot').forEach((x, k) => x.classList.toggle('on', k === i)); return; }
    if (act === 'cp-fondo') { c.menu = !c.menu; return render(); }
    if (act === 'cp-bg') { c.fondo = b.dataset.v === 'transparente' ? 'transparente' : 'oscuro'; c.menu = false; return render(); }
    if (act === 'cp-foto') return elegirFoto();
    if (act === 'cp-copiar') return void copiar();
    if (act === 'cp-guardar') return void guardar();
    if (act === 'cp-compartir') return void compartirNativo();
  }

  return { abrir, sheetHTML, pintar, click, cerrar };
}
