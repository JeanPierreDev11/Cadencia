// Mapa de calor regional de la composición corporal (estilo escáner de bioimpedancia).
// Cinco zonas (centro, brazos, piernas) sobre el maniquí 3D: el COLOR lo da la métrica (músculo verde, grasa rojo…)
// y la OPACIDAD de cada zona, cuánto pesa frente a su valor «ideal». Sin estado propio.
import { esc, nf } from './util.js';

// Orden de la lista. `k` = clave de los datos · `n` = texto · `r` = valor de `data-region` del SVG.
export const REGIONES = [
  { k: 'tronco', n: 'Centro', r: 'tronco' },
  { k: 'brazoI', n: 'Brazo izq.', r: 'brazo-izq' },
  { k: 'brazoD', n: 'Brazo der.', r: 'brazo-der' },
  { k: 'piernaI', n: 'Pierna izq.', r: 'pierna-izq' },
  { k: 'piernaD', n: 'Pierna der.', r: 'pierna-der' },
];

// Reparto típico de cada métrica entre las 5 zonas (cada fila suma 1; la cabeza no cuenta, como en las básculas segmentales).
// Son proporciones medias de adultos (tipo DXA), no tus datos: solo se usan cuando la báscula no da el desglose.
const LEAN_H = { tronco: 0.5, brazoI: 0.07, brazoD: 0.07, piernaI: 0.18, piernaD: 0.18 };
const LEAN_M = { tronco: 0.47, brazoI: 0.065, brazoD: 0.065, piernaI: 0.2, piernaD: 0.2 };
export const REPARTO = {
  hombre: { musculo: LEAN_H, agua: LEAN_H, grasa: { tronco: 0.56, brazoI: 0.05, brazoD: 0.05, piernaI: 0.17, piernaD: 0.17 }, hueso: { tronco: 0.44, brazoI: 0.07, brazoD: 0.07, piernaI: 0.21, piernaD: 0.21 } },
  mujer: { musculo: LEAN_M, agua: LEAN_M, grasa: { tronco: 0.46, brazoI: 0.055, brazoD: 0.055, piernaI: 0.215, piernaD: 0.215 }, hueso: { tronco: 0.44, brazoI: 0.07, brazoD: 0.07, piernaI: 0.21, piernaD: 0.21 } },
};
// «Ideal» de cada métrica como % del peso corporal (referencia orientativa, mitad de los rangos habituales).
export const IDEAL_PCT = { hombre: { musculo: 42, grasa: 15, agua: 58, hueso: 4.2 }, mujer: { musculo: 33, grasa: 24, agua: 52, hueso: 3.6 } };

const sx = (s) => (s === 'mujer' ? 'mujer' : 'hombre');
export const repartoEstimado = (total, sexo, tipo) => Object.fromEntries(REGIONES.map(({ k }) => [k, total * REPARTO[sx(sexo)][tipo][k]]));
export const idealRegional = (kgCuerpo, sexo, tipo) => Object.fromEntries(REGIONES.map(({ k }) => [k, (kgCuerpo * IDEAL_PCT[sx(sexo)][tipo] / 100) * REPARTO[sx(sexo)][tipo][k]]));

// ¿Trae el desglose completo y válido? (kg por zona)
export const completo = (d) => !!d && REGIONES.every(({ k }) => typeof d[k] === 'number' && isFinite(d[k]) && d[k] >= 0);

// Ideal en kg de cada zona para pintar. Estimado: el reparto típico del ideal de tu peso. Medido: las básculas segmentales no siempre miden
// «lo mismo» que el total del pesaje (p. ej. masa magra vs. masa muscular), así que se compara el REPARTO medido con el típico y se multiplica
// por tu nivel global (total / ideal). Así, con un reparto típico, medido y estimado dan lo mismo, y un lado más fuerte que otro sí se nota.
export function idealPara({ datos, medido, total, kgCuerpo, sexo, tipo }) {
  const base = idealRegional(kgCuerpo, sexo, tipo);
  if (!medido) return base;
  const idealTotal = kgCuerpo * IDEAL_PCT[sx(sexo)][tipo] / 100, nivel = idealTotal > 0 ? total / idealTotal : 0, suma = REGIONES.reduce((a, { k }) => a + datos[k], 0);
  return nivel > 0 && suma > 0 ? Object.fromEntries(REGIONES.map(({ k }) => [k, (suma * REPARTO[sx(sexo)][tipo][k]) / nivel])) : base;
}

// Opacidad según valor/ideal: 0,5 → 0,20 · 1 (justo el ideal) → 0,55 · 1,5 o más → 0,90. Con poca masa casi no se ve; con mucha, intenso.
export const OP_MIN = 0.12, OP_MAX = 0.9;
export const opacidad = (ratio) => (ratio == null || !isFinite(ratio) ? 0 : Math.max(OP_MIN, Math.min(OP_MAX, 0.2 + (ratio - 0.5) * 0.7)));

// Con kg MEDIDOS por zona se estira el contraste (más rango de opacidad) para que se note dónde se concentra más.
export const opacidadMedida = (ratio) => (ratio == null || !isFinite(ratio) ? 0 : Math.max(0.1, Math.min(0.95, 0.1 + (ratio - 0.5))));
// Zona donde más se concentra (mayor % sobre su ideal), solo con datos medidos y si destaca (>= 3 puntos sobre la siguiente).
export function zonaTop(c) {
  const z = REGIONES.map(({ k }) => [k, c[k].ratio]).filter(([, r]) => r != null).sort((a, b) => b[1] - a[1]);
  return z.length > 1 && z[0][1] - z[1][1] >= 0.03 ? z[0][0] : z.length === 1 ? z[0][0] : null;
}

// { zona: { valor, ideal, ratio, op } } para las 5 zonas.
export function calcular(datos, ideal, medido = false) {
  return Object.fromEntries(REGIONES.map(({ k }) => {
    const v = datos && typeof datos[k] === 'number' && isFinite(datos[k]) ? datos[k] : null, i = ideal && ideal[k] > 0 ? ideal[k] : null;
    const ratio = v != null && i != null ? v / i : null;
    return [k, { valor: v, ideal: i, ratio, op: (medido ? opacidadMedida : opacidad)(ratio) }];
  }));
}

/* ---------- Geometría: 5 bloques en el espacio SVG 500×800 ---------- */
// La imagen del maniquí va «contain» dentro de la caja 500×800 (ocupa todo el alto y se centra), así que se miden los cortes
// en píxeles de la imagen y se pasan a coordenadas SVG. Las zonas se RECORTAN con la silueta del cuerpo (máscara CSS), por eso
// basta con dividir la caja en cinco trozos: no hay que calcar el contorno. Los puntos son del lado izquierdo de la imagen
// (el DERECHO de la persona, porque la miramos de frente); el otro lado se espeja.
const GEO = {
  hombre: { w: 236, h: 480, hombro: [78, 74], axila: [67, 142], cintura: [66, 200], cadera: [48, 236], mano: [40, 300], ingleY: 266,
    nodos: { pecho: [118, 118], codoD: [22, 192], codoI: [214, 192], rodD: [80, 345], rodI: [156, 345] } },
  mujer: { w: 194, h: 480, hombro: [66, 74], axila: [54, 142], cintura: [55, 190], cadera: [38, 236], mano: [30, 300], ingleY: 258,
    nodos: { pecho: [97, 114], codoD: [22, 192], codoI: [172, 192], rodD: [54, 345], rodI: [127, 345] } },
};
const TOP = -10, BOT = 500; // margen fuera de la imagen para que el recorte por la silueta llegue al borde

export function zonas(sexo) {
  const g = GEO[sx(sexo)], s = 800 / g.h, ox = (500 - g.w * s) / 2;
  const P = ([x, y]) => `${(ox + x * s).toFixed(1)},${(y * s).toFixed(1)}`, M = ([x, y]) => [g.w - x, y];
  const cx = g.w / 2, ingle = [cx, g.ingleY];
  const poli = (pts) => `M${pts.map(P).join(' L')} Z`;
  const brazo = [[TOP, 72], [g.hombro[0], 72], g.axila, g.cintura, g.cadera, g.mano, [TOP, g.mano[1]]];
  const pierna = [g.cadera, ingle, [cx, BOT], [TOP, BOT], [TOP, g.mano[1]], g.mano];
  const brazoR = [[g.w - TOP, 72], [g.w - g.hombro[0], 72], M(g.axila), M(g.cintura), M(g.cadera), M(g.mano), [g.w - TOP, g.mano[1]]];
  const piernaR = [M(g.cadera), ingle, [cx, BOT], [g.w - TOP, BOT], [g.w - TOP, g.mano[1]], M(g.mano)];
  const tronco = [[g.hombro[0], 72], [g.w - g.hombro[0], 72], M(g.axila), M(g.cintura), M(g.cadera), ingle, g.cadera, g.cintura, g.axila];
  // Izquierda de la imagen = lado DERECHO de la persona.
  return { tronco: poli(tronco), 'brazo-der': poli(brazo), 'brazo-izq': poli(brazoR), 'pierna-der': poli(pierna), 'pierna-izq': poli(piernaR) };
}
const nodos = (sexo) => { const g = GEO[sx(sexo)], s = 800 / g.h, ox = (500 - g.w * s) / 2; return Object.values(g.nodos).map(([x, y]) => [ox + x * s, y * s]); };

/* ---------- HTML ---------- */
const srcDe = (sexo) => `/models/maniqui-${sx(sexo)}-1.png`;

// Maniquí con las 5 zonas. Las zonas nacen con opacidad 0 (CSS) y `pintarMapas` las enciende tras pintar, para que se vea la transición.
// `datos` (kg por zona) e `ideal` (kg por zona) viajan en `data-regional`; sin ellos el cuerpo queda apagado (sin datos).
export function mapaHTML({ tipo, sexo, datos = null, ideal = null, medido = false, compacto = false, conNodos = false, titulo = '' }) {
  const d = zonas(sexo), src = srcDe(sexo);
  const info = datos ? ` data-regional="${esc(JSON.stringify({ tipo, datos, ideal, medido: !!medido }))}"` : '';
  return `<div class="regional-mannequin-container m-${tipo}${compacto ? ' compacto' : ''}" style="--mq:url(${src})"${info} role="img" aria-label="${esc(titulo || `Mapa regional de ${tipo}`)}">
    <img class="regional-bg" src="${src}" alt="" draggable="false" decoding="async">
    <svg class="regional-overlay" viewBox="0 0 500 800" aria-hidden="true" focusable="false">${REGIONES.map(({ r }) => `<path data-region="${r}" d="${d[r]}"/>`).join('')}</svg>
    ${conNodos ? `<svg class="regional-nodes" viewBox="0 0 500 800" aria-hidden="true" focusable="false">${nodos(sexo).map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" style="animation-delay:${(i * 0.35).toFixed(2)}s"/>`).join('')}</svg>` : ''}
  </div>`;
}

// Tarjeta de dos columnas: maniquí a la izquierda (~120 px) y lista de las 5 zonas a la derecha.
// `medido` = el desglose viene de la báscula; si no, es un reparto estimado y se avisa.
export function tarjetaHTML({ tipo, sexo, datos, ideal, medido, titulo }) {
  const c = calcular(datos, ideal, medido), top = medido ? zonaTop(c) : null;
  return `<section class="regional-card m-${tipo}" aria-label="${esc(titulo)}">
    ${mapaHTML({ tipo, sexo, datos, ideal, medido, conNodos: true, titulo })}
    <div class="regional-side">
      <ul class="regional-metrics-list">${REGIONES.map(({ k, n }) => {
        const z = c[k], pct = z.ratio != null ? Math.round(z.ratio * 100) : null;
        return `<li data-zona="${k}"${k === top ? ' class="is-top"' : ''}><span class="rg-n">${n}</span><b class="num">${z.valor != null ? nf(z.valor, 1) : '—'}<em>kg</em></b>
          <i class="rg-bar" aria-hidden="true"><i style="width:${z.ratio != null ? Math.min(100, z.ratio * 66.7).toFixed(0) : 0}%;opacity:${(0.35 + z.op * 0.65).toFixed(2)}"></i></i>
          ${medido && pct != null ? `<span class="rg-d">${pct} % del ideal${k === top ? ' · <strong>mayor concentración</strong>' : ''}</span>` : ''}</li>`;
      }).join('')}</ul>
      <p class="regional-nota">${medido ? 'Desglose medido por tu báscula.' : 'Reparto estimado a partir de tu total y de proporciones típicas; no es una medición por zonas.'}</p>
    </div>
  </section>`;
}

/* ---------- DOM ---------- */
// Pone el color de la métrica y la opacidad de cada zona. `datos` = kg por zona ({ tronco: 32.6, brazoI: 3.6, … }),
// `tipo` = 'musculo' | 'grasa' | 'agua' | 'hueso'. `ideal` = kg ideal por zona (si falta, no se enciende ninguna zona).
export function actualizarMapaRegional(datos, tipo, { ideal = null, medido = false, contenedor = null } = {}) {
  const cont = contenedor || document.querySelector('.regional-mannequin-container');
  if (!cont) return;
  for (const el of [cont, cont.closest('.regional-card')]) if (el) { el.className = el.className.replace(/\bm-\w+/g, '').trim() + ` m-${tipo}`; } // el color base sale del CSS (--color-metrica)
  const c = calcular(datos, ideal, medido), top = medido ? zonaTop(c) : null;
  for (const { k, r } of REGIONES) { const p = cont.querySelector(`path[data-region="${r}"]`); if (p) { p.style.opacity = c[k].op.toFixed(2); p.classList.toggle('is-top', k === top); } }
}

// Se llama tras cada render(): enciende todos los mapas de la pantalla con su transición.
export function pintarMapas(raiz) {
  const mapas = raiz.querySelectorAll('.regional-mannequin-container[data-regional]');
  if (!mapas.length) return;
  void raiz.offsetWidth; // fija opacidad 0 antes de cambiarla: así la transición se ve
  mapas.forEach((el) => { try { const r = JSON.parse(el.dataset.regional); actualizarMapaRegional(r.datos, r.tipo, { ideal: r.ideal, medido: r.medido, contenedor: el }); } catch (e) { /* datos ilegibles: se queda apagado */ } });
}
