// Mapa de Rutas con Leaflet + OpenStreetMap (Leaflet se carga desde un CDN en index.html).
// La app vuelve a pintar toda la pantalla en cada cambio, así que el mapa vive en un <div> propio
// que se vuelve a colgar del hueco #rutamap después de cada pintado: no se recarga ni parpadea.
const hayLeaflet = () => typeof window !== 'undefined' && !!window.L;
const AZUL = '#2B3BD6';

export function crearMapa() {
  let el = null, map = null, capa = null, clave = '';

  function montar(host) {
    if (!host) return false;
    if (!hayLeaflet()) {
      host.innerHTML = '<p class="small muted maperr">No se ha podido cargar el mapa. Comprueba tu conexión y vuelve a abrir la pestaña.</p>';
      return false;
    }
    const L = window.L;
    if (!el) { el = document.createElement('div'); el.className = 'mapa-el'; el.setAttribute('role', 'application'); el.setAttribute('aria-label', 'Mapa de la ruta'); }
    if (el.parentNode !== host) host.appendChild(el);
    if (!map) {
      map = L.map(el, { zoomControl: true, scrollWheelZoom: false, touchZoom: true, dragging: true, tap: true, bounceAtZoomLimits: false, worldCopyJump: false }).setView([43.263, -2.935], 11);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
      capa = L.layerGroup().addTo(map);
    }
    map.invalidateSize();
    return true;
  }

  // pts: [[lat, lon], …]. `k` identifica lo que se dibuja: si no cambia, no se vuelve a encuadrar.
  function dibujar(k, pts) {
    if (!map || !pts || pts.length < 2) return;
    const L = window.L;
    if (k === clave) return;
    clave = k; capa.clearLayers();
    L.polyline(pts, { color: '#ffffff', weight: 9, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }).addTo(capa); // borde blanco para que se vea sobre cualquier fondo
    const linea = L.polyline(pts, { color: AZUL, weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(capa);
    L.circleMarker(pts[0], { radius: 8, color: '#fff', weight: 3, fillColor: '#16a34a', fillOpacity: 1 }).addTo(capa).bindTooltip('Salida');
    L.circleMarker(pts[pts.length - 1], { radius: 8, color: '#fff', weight: 3, fillColor: '#dc2626', fillOpacity: 1 }).addTo(capa).bindTooltip('Llegada');
    map.fitBounds(linea.getBounds(), { padding: [24, 24], maxZoom: 15, animate: false });
  }

  const redimensionar = () => { if (map) { map.invalidateSize(); } };
  const info = () => (map ? { zoom: map.getZoom(), touchZoom: !!map.touchZoom.enabled(), dragging: !!map.dragging.enabled() } : null);
  return { montar, dibujar, redimensionar, info };
}
