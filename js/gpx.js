// Lector de archivos GPX. Todo ocurre en el móvil: el archivo no se envía a ningún servidor.
// leerGPX(texto) → { nombre, km, desnivel, altMax, puntos: [lat, lon, lat, lon…] (simplificados), total }
// Lanza un Error con un mensaje en español si el archivo no sirve.

const R = 6371008.8; // radio medio de la Tierra, en metros
const rad = Math.PI / 180;
export const MAX_BYTES = 25 * 1024 * 1024;
const MAX_PUNTOS_GUARDADOS = 700; // para que la ruta quepa de sobra en un documento de Firestore

export function distM(lat1, lon1, lat2, lon2) {
  const dLa = (lat2 - lat1) * rad, dLo = (lon2 - lon1) * rad;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Desnivel positivo acumulado. Se suaviza un poco la altitud (mediana de 3) y solo se cuenta una subida
// cuando supera 3 m, para que el ruido del GPS no infle el desnivel.
export function desnivelPositivo(ele, umbral = 3) {
  const e = ele.filter((x) => Number.isFinite(x));
  if (e.length < 2) return 0;
  const s = e.map((_, i) => {
    if (i === 0 || i === e.length - 1) return e[i];
    const t = [e[i - 1], e[i], e[i + 1]].sort((a, b) => a - b);
    return t[1];
  });
  let ref = s[0], ganado = 0;
  for (let i = 1; i < s.length; i++) {
    if (s[i] - ref >= umbral) { ganado += s[i] - ref; ref = s[i]; }
    else if (ref - s[i] >= umbral) ref = s[i];
  }
  return ganado;
}

// Quita puntos sobrantes (Douglas-Peucker) hasta que queden como mucho `max`.
export function simplificar(pts, max = MAX_PUNTOS_GUARDADOS) {
  if (pts.length <= max) return pts.slice();
  const lat0 = pts[0][0] * rad;
  const X = pts.map((p) => [p[1] * rad * Math.cos(lat0) * R, p[0] * rad * R]);
  const dp = (eps) => {
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const pila = [[0, pts.length - 1]];
    while (pila.length) {
      const [a, b] = pila.pop();
      let dMax = 0, idx = -1;
      const [ax, ay] = X[a], [bx, by] = X[b], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      for (let i = a + 1; i < b; i++) {
        const [px, py] = X[i];
        let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
        if (d > dMax) { dMax = d; idx = i; }
      }
      if (dMax > eps && idx > 0) { keep[idx] = 1; pila.push([a, idx], [idx, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  };
  let eps = 2, out = dp(eps);
  while (out.length > max && eps < 5000) { eps *= 1.6; out = dp(eps); }
  return out;
}

const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

export function leerGPX(texto) {
  if (typeof texto !== 'string' || !texto.trim()) throw new Error('El archivo está vacío.');
  const doc = new DOMParser().parseFromString(texto, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('No parece un archivo GPX válido.');
  const por = (el, tag) => Array.from(el.getElementsByTagName(tag));
  // Se prefieren los tracks (trkpt); si no hay, se usan las rutas planificadas (rtept).
  let segs = por(doc, 'trkseg').map((s) => por(s, 'trkpt')).filter((s) => s.length);
  if (!segs.length) segs = por(doc, 'rte').map((s) => por(s, 'rtept')).filter((s) => s.length);
  if (!segs.length) throw new Error('El archivo no tiene ningún recorrido (track o ruta).');

  const pts = [], ele = [];
  let m = 0, prev = null;
  for (const seg of segs) {
    for (const p of seg) {
      const lat = num(p.getAttribute('lat')), lon = num(p.getAttribute('lon'));
      if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      if (prev) m += distM(prev[0], prev[1], lat, lon);
      prev = [lat, lon];
      pts.push(prev);
      const el = p.getElementsByTagName('ele')[0];
      ele.push(el ? num(el.textContent) : null);
    }
  }
  if (pts.length < 2) throw new Error('El recorrido tiene muy pocos puntos.');
  const conAlt = ele.filter((x) => x != null);
  const tieneAltitud = conAlt.length >= pts.length * 0.8 && conAlt.length > 1;
  const nombreEl = doc.getElementsByTagName('trk')[0] ? doc.getElementsByTagName('trk')[0].getElementsByTagName('name')[0] : null;
  const meta = doc.getElementsByTagName('metadata')[0] ? doc.getElementsByTagName('metadata')[0].getElementsByTagName('name')[0] : null;
  const rteName = doc.getElementsByTagName('rte')[0] ? doc.getElementsByTagName('rte')[0].getElementsByTagName('name')[0] : null;
  const nombre = ((nombreEl || meta || rteName || {}).textContent || '').trim().slice(0, 80);
  const simple = simplificar(pts);
  const puntos = [];
  simple.forEach(([la, lo]) => puntos.push(Math.round(la * 1e5) / 1e5, Math.round(lo * 1e5) / 1e5));
  return {
    nombre,
    km: Math.round(m / 100) / 10,
    desnivel: tieneAltitud ? Math.round(desnivelPositivo(ele)) : null,
    altMax: tieneAltitud ? Math.round(Math.max(...conAlt)) : null,
    puntos,
    total: pts.length,
  };
}
