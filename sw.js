// Service worker: permite instalar la app y abrirla sin conexión.
// Sube el número de versión cada vez que publiques cambios para que los móviles se actualicen.
const VERSION = 'cadencia-v12';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/data.js',
  './js/config.js',
  './js/entreno.js',
  './js/ejercicios.js',
  './js/secciones.js',
  './js/entreno-ui.js',
  './js/util.js',
  './js/legal.js',
  './js/alimentos.js',
  './js/br.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Páginas: primero la red (para ver siempre lo último), si no hay conexión, la copia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Archivos propios: primero la red (siempre la última versión); sin conexión, la copia guardada.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  // Tipografías, librería de Firebase e imágenes de ejercicios (versiones fijas): se guardan la primera vez.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) || (url.hostname === 'raw.githubusercontent.com' && url.pathname.startsWith('/yuhonas/free-exercise-db/'))) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; }))
    );
  }
  // Todo lo demás (base de datos, inicio de sesión) va directo a la red.
});
