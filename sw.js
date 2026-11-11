// Service worker: permite instalar la app y abrirla sin conexión.
// Sube el número de versión cada vez que publiques cambios para que los móviles se actualicen.
const VERSION = 'cadencia-v29';
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
  './js/pro.js',
  './js/gpx.js',
  './js/mapa.js',
  './js/trazados.js',
  './js/strava.js',
  './js/strava-ui.js',
  './js/push.js',
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

// Notificaciones push (recordatorios). FCM entrega un mensaje solo con datos y aquí se muestra el aviso.
// Es independiente de la caché de arriba: no toca los archivos guardados.
self.addEventListener('push', (e) => {
  let j = {};
  try { j = e.data ? e.data.json() : {}; } catch (err) { j = {}; }
  const d = Object.assign({}, j.notification || {}, j.data || {});
  const titulo = d.title || 'Cadencia';
  const opciones = { body: d.body || '', icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: d.tag || 'cadencia', data: { url: d.url || './' } };
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      // Si la app está abierta y a la vista, no hace falta molestar.
      if (cs.some((c) => c.visibilityState === 'visible' && c.focused)) return;
      return self.registration.showNotification(titulo, opciones);
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) { if ('focus' in c && c.url.startsWith(self.registration.scope)) { return c.navigate(destino).then((x) => (x || c).focus()).catch(() => c.focus()); } }
      return self.clients.openWindow(destino);
    })
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
