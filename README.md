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
