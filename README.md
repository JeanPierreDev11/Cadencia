# Cadencia

App web instalable (PWA) para iPhone y Android: registro e inicio de sesión, cuestionario inicial
(objetivos, sexo, edad, estatura, peso), pantalla de inicio con IMC y gasto en reposo, historial de peso y perfil editable.

- **Base de datos y cuentas:** Firebase (Authentication con email y contraseña + Cloud Firestore).
- **Sin Firebase configurado** la app funciona en *modo prueba*: cuentas y datos solo en ese dispositivo.
- **Sin servidor propio:** son archivos estáticos, se publica en GitHub Pages.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Página de la app |
| `css/app.css` | Diseño (colores, tipografía, modo oscuro) |
| `js/app.js` | Núcleo: acceso, cuestionario inicial, Inicio, Peso, Perfil, navegación y arranque |
| `js/entreno-ui.js` | Entreno: semana, historial, rutinas, asistente, biblioteca, entreno en directo con descanso, registro |
| `js/legal.js` | Términos de uso, privacidad y aviso de salud (`LEGAL_V` = versión; `CONTACTO` = correo de privacidad) |
| `js/util.js` | Utilidades compartidas (formato, avisos, iconos) |
| `js/vendor/zxing.js` | Lector de códigos de barras (ZXing, MIT/Apache-2.0), solo se carga al escanear en iPhone |
| `js/data.js` | Conexión con Firebase y modo prueba |
| `js/secciones.js` | Nutrición, Rutas, Taller y Progreso |
| `js/br.js`, `js/alimentos.js` | Cálculos (calorías, carga, nutrición en ruta, presión de ruedas, % graso) y tabla de alimentos de la app Bilbao Ride |
| `js/config.js` | **Aquí va la configuración de Firebase** |
| `manifest.webmanifest`, `sw.js`, `icons/` | Lo que hace que se instale como app y abra sin conexión |
| `firestore.rules` | Reglas de seguridad: cada persona solo ve sus datos |

## 1. Configurar Firebase (una vez)

1. Entra en https://console.firebase.google.com y pulsa **Crear proyecto** (puedes desactivar Google Analytics).
2. **Authentication → Comenzar → Sign-in method → Correo electrónico/contraseña → Habilitar → Guardar.**
3. **Firestore Database → Crear base de datos →** ubicación `eur3 (europe-west)` → modo producción.
4. En Firestore, pestaña **Reglas**: pega el contenido de `firestore.rules` y pulsa **Publicar**.
5. **Configuración del proyecto (rueda dentada) → Tus apps → icono web `</>`** → ponle un nombre → **Registrar app**.
   Copia el bloque `firebaseConfig` y pégalo en `js/config.js` en lugar de `null`.
6. **Authentication → Settings → Authorized domains → Add domain:** `TU-USUARIO.github.io`.

La `apiKey` de Firebase no es secreta: está pensada para ir en la web. La seguridad la dan las reglas del paso 4.

## 2. Publicar en GitHub Pages

1. Crea un repositorio en GitHub (por ejemplo `cadencia`) y sube todos estos archivos a la raíz.
2. **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save.**
3. En un minuto estará en `https://TU-USUARIO.github.io/cadencia/`.

## 3. Instalar en el móvil

- **iPhone:** abre la dirección en **Safari** → botón Compartir → **Añadir a pantalla de inicio**.
- **Android:** abre la dirección en **Chrome** → aparece **Instalar Cadencia** en la app (o menú ⋮ → **Instalar aplicación**).

## Publicar cambios

Cada vez que cambies archivos, sube el número de `VERSION` en `sw.js` (por ejemplo `cadencia-v2`) para que los móviles con la app instalada descarguen la versión nueva.

## Ejercicios e imágenes

Los ejercicios con foto vienen de [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (dominio público, licencia Unlicense), con los nombres traducidos al español. Las imágenes se cargan desde GitHub y la app las guarda para verlas sin conexión. El mapa de músculos es un dibujo propio de la app.

## Estructura de datos en Firestore

```
users/{uid}
  nombre, email, objetivos[], sexo, edad, alturaCm, pesoKg, pesoInicial, pesoObjetivo, fechaInicio, onboarded
users/{uid}/pesos/{AAAA-MM-DD}
  fecha, kg, grasa (%), musculo (kg), agua (%), hueso (kg)
users/{uid}  → campo rutina
  tipos[], otro, dias[] (0 = lunes), modo (propuesta | propia), sesiones{dia: {t, nombre, min, ej[] | ses | det}}
users/{uid}/entrenos/{id}
  fecha, tipo (gym | bici | cardio | otro), nombre, min, km, elev, pulso, np, bici, esf, kcal, ejercicios[{n, series[{kg, reps}]}]
users/{uid}/comidas/{AAAA-MM-DD}
  fecha, items[{id, m (0 desayuno … 4 otros), n, g, k, p, c, f, fid, prep}]
users/{uid}  → campos nutri {neat, rate, eat}, atleta {fcMax, fcRep, ftp}, novVista, misAlimentos[{id, n, k, p, c, f, u}]
users/{uid}  → rutinas[{id, nombre, …misma forma que rutina}] (rutina = la que está en uso)
users/{uid}  → metas[{id, tipo, valor, ej?, hasta?, creado}]
users/{uid}  → campo garaje
  bicis[{id, nombre, tipo, marcaModelo, anio, pesoKg, cubiertaMm, tubeless, kmPrevios, comps[{id, cat, nombre, desde, kmIni, cadaKm, precio}]}]
  mejora {presupuesto, metas[], deseos[{id, n, precio}]}
```

## IA (foto del plato y Taller)

Una sola Cloud Function, `ia` (carpeta `functions/`, región `europe-west1`), llama a la API de Claude:
`claude-haiku-5-5` para la foto del plato y `claude-sonnet-5-5` para el Taller. Límites: 10 consultas al día por persona
(`iaUso/{uid}_{día}`) y 300 al día en total (`iaGlobal/{día}`), solo accesibles desde el servidor.
La clave se guarda como secreto `ANTHROPIC_API_KEY` en Firebase. Si cambias la tabla de alimentos, ejecuta
`node functions/generar-catalogo.mjs` para que la IA la conozca.

Se publica sola con GitHub Actions (`.github/workflows/desplegar-ia.yml`) al cambiar `functions/`, y necesita
dos secretos en el repositorio: `FIREBASE_SERVICE_ACCOUNT` (JSON de una cuenta de servicio) y `ANTHROPIC_API_KEY`.

## Privacidad

Al crear la cuenta hay que aceptar los términos (se guarda `legal {v, fecha}` en el perfil). En Perfil → Privacidad y cuenta se pueden leer y se puede borrar la cuenta: pide la contraseña y escribir BORRAR, borra `pesos`, `entrenos`, `comidas`, el documento `users/{uid}` y el usuario de Firebase Auth. Antes de abrir la app al público, rellena `CONTACTO` en `js/legal.js` y revisa los textos con un profesional.

## Novedades

Cuando publiques algo nuevo, cambia `NOV_V` y la lista de `novItems()` en `js/secciones.js`: a cada persona le saldrá la nota en Inicio hasta que pulse «Entendido».

## Productos de marca

La búsqueda de productos de marca usa [Open Food Facts](https://es.openfoodfacts.org) (base abierta, licencia ODbL: hay que citarla, como hace la app).

## Tiempo

La previsión de Rutas viene de [Open-Meteo](https://open-meteo.com/) (sin clave). Su uso gratuito es solo para fines no comerciales: si la app pasa a cobrar suscripciones, hay que contratar su plan de pago o cambiar de servicio.

## Cadencia Pro (Stripe)
- La IA (Foto con IA y Recomendación del Taller) es de pago: 4,99 €/mes con un Payment Link de Stripe.
- `users/{uid}.isPro` (false por defecto). **Solo lo cambia el servidor**: las reglas de Firestore impiden que la app lo modifique (igual que `stripeCustomerId` y `stripeSubscriptionId`).
- La función `ia` comprueba `isPro` en el servidor antes de procesar nada (error `permission-denied`); la app lo recibe y enseña el paywall.
- `stripeWebhook` (europe-west1) recibe `checkout.session.completed`, `customer.subscription.updated` y `customer.subscription.deleted`, valida la firma y activa o quita `isPro`. Localiza a la persona por `client_reference_id` (el uid, que la app añade al enlace) o por el email.
- Enlace de pago y portal: `js/pro.js` (`PRO_LINK`, `PORTAL_LINK`). Secretos de Firebase: `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` (se guardan desde los secretos de GitHub con el workflow «Publicar IA en Firebase»).

## Mapas y rutas GPX (gratis para todos)
- Pestaña Bici → Rutas: mapa interactivo con **Leaflet 1.9.4** (cargado desde unpkg con huella SRI en `index.html`) y teselas de OpenStreetMap, sin clave de API. Atribución de OSM visible. Si en el futuro hay mucho tráfico o uso comercial intensivo, hay que cambiar a un proveedor de teselas propio o de pago (la política de OSM no admite uso masivo).
- `js/trazados.js`: trazados **orientativos** (puntos de paso suavizados) de las 6 rutas de Bilbao. Sustituirlos por GPX reales cuando se tengan.
- `js/gpx.js`: `leerGPX(texto)` lee el archivo **en el móvil** (DOMParser): distancia (haversine), desnivel positivo (mediana de 3 + umbral de 3 m) y recorrido simplificado (Douglas-Peucker, ≤ 700 puntos) para que quepa en Firestore.
- `js/mapa.js`: el mapa vive en un `<div>` propio que se recoloca tras cada `render()` (no se recarga).
- Rutas guardadas: `users/{uid}/rutas/{id}` = `{id, nombre, km, desnivel, altMax, puntos:[lat,lon,…], creado, origen}`. Se borran con la cuenta.

## Strava
- Perfil → **Integraciones**: «Conectar con Strava» / «Desconectar Strava». Entreno → **Sincronizar Strava** (solo si está conectado).
- Flujo OAuth 2.0: la app manda a la persona a `strava.com/oauth/authorize` (scope `activity:read_all`, `state` aleatorio comprobado al volver, `redirect_uri` = la URL de la app). Strava devuelve `?code=…`; la app lo envía a la Cloud Function **`strava`** (modo `conectar`), que lo cambia por los tokens con el Client Secret.
- Tokens (`access_token`, `refresh_token`, `expires_at`) en **`stravaTokens/{uid}`**: colección sin reglas de cliente (solo el servidor la lee y escribe). En `users/{uid}.strava` solo hay `{conectado, atleta, desde}` y el campo está protegido en `firestore.rules` (solo lo cambia el servidor). El `access_token` (dura 6 h) se renueva solo con el `refresh_token`; si Strava lo revoca se limpia la conexión.
- Modos de `strava`: `conectar`, `actividades` (lee `/athlete/activities`, filtra y devuelve campos normalizados; tiene un tiempo mínimo de 20 s entre sincronizaciones por persona y un tope global diario), `desconectar` (revoca en Strava y borra tokens).
- La app guarda cada actividad en `users/{uid}/entrenos/strava_<id>` (id fijo = sin duplicados). `Ride`/`VirtualRide` → `bici` (km, elev, pulso, np); `Run` → `cardio` (km). Se añade `fuente: 'strava'`. kcal e intensidad (`esf`) se calculan en el móvil con las mismas fórmulas que los entrenos manuales; si ya apuntaste esa salida a mano (misma fecha y tipo, con duración o km casi iguales) no se duplica.
- Secretos de Firebase: `STRAVA_CLIENT_ID` y `STRAVA_CLIENT_SECRET` (desde los secretos de GitHub, con el workflow «Publicar IA en Firebase»). El Client ID (público) también va en `js/strava.js`.
- Límites de Strava: las apps nuevas empiezan en «single-player» (solo el propietario); hay que pedir más capacidad y pasar la revisión de Strava antes de abrirlo a más gente. 200 peticiones/15 min y 2.000/día.

## Recordatorios (notificaciones push)
- **Pregunta inicial:** la primera vez que entras (tras el registro, o al abrir la app si aún no respondiste) sale «¿Quieres recibir recordatorios?» con los tres tipos para marcar. «Activar avisos» pide el permiso del navegador; «Ahora no» no vuelve a preguntar (`recPreguntado`). Si el navegador no admite notificaciones (p. ej. iPhone sin instalar la app), no se pregunta.
- **Perfil → Recordatorios:** tres interruptores con sus ajustes.
  - Peso: por defecto **una vez a la semana** (lunes 08:00); se puede elegir cada día, cada semana (y qué día), cada 2 semanas o cada mes (día 1), y la hora.
  - Comidas: **10:00, 14:30 y 21:00** (cada una editable o «No avisar»). El aviso de cada hora comprueba su momento del día: desayuno (antes de las 12:00), comida, merienda (18:00–19:59) o cena.
  - Entreno: **los días que te toca** según tu rutina, a las 18:00 por defecto.
- **Datos en `users/{uid}`:** `fcmTokens` (dispositivos), `recordatorios {peso:{on,t,f,d}, comidas:{on,ts:[min…]}, entreno:{on,t}}` (`t` = minutos desde las 00:00, de 30 en 30), `recTz` (zona horaria), `recActivo`, `recPreguntado`; el servidor guarda `recEnviado` para no repetir.
- **`js/push.js`** lleva la clave pública VAPID (`VAPID_KEY`) y toda la lógica; `data.js` obtiene el token con `firebase-messaging.js` usando el service worker de la app (`sw.js`): no hace falta un `firebase-messaging-sw.js`.
- **`sw.js`:** eventos `push` (muestra el aviso; si la app está abierta y a la vista, no) y `notificationclick` (abre `./?ir=peso|comidas|entreno`). No toca la caché.
- **Cloud Function `recordatorios`** (`onSchedule`, `0,30 * * * *`, Cloud Scheduler): busca `recActivo == true`, calcula el tramo de 30 min en la zona horaria de cada persona y manda con `sendEach` un mensaje solo de datos. No avisa si ya está hecho (peso de hoy, esa comida, entreno de hoy), ni en días de descanso (entreno), ni dos veces el mismo aviso el mismo día. Borra los tokens caducados.
- iPhone: las notificaciones web solo funcionan con la app añadida a la pantalla de inicio (iOS 16.4 o superior).
- Escala: cada 30 min lee los usuarios con avisos activos; con muchos miles habrá que filtrar por tramo en la consulta.

## Progreso → Peso
- **Evolución** muestra solo la gráfica del peso. Las 4 tarjetas de composición (Grasa, Músculo, Agua, Hueso) enseñan el último registro y, al tocarlas, abren su **evolución semanal** (media de cada semana, lunes a domingo, últimas 26 semanas).
- **«Añadir registro»** (botón flotante) abre el formulario en una ventana. Selector **% del peso / kilos**: se convierte con el peso del registro y se guarda como siempre (`users/{uid}/pesos/{fecha}` = `{fecha, kg, grasa % , musculo kg, agua %, hueso kg}`). La última unidad elegida se recuerda en el dispositivo.
- **Historial** (icono de reloj arriba a la derecha): lista de registros; «Modificar» muestra lápiz (editar ese día; los datos que no toques se conservan tal cual, la fecha no se cambia) y papelera roja (pide confirmación). Editar usa `setWeight` (sustituye el documento del día con la misma estructura, así se puede quitar un dato); añadir sigue usando `addWeight` (merge).

