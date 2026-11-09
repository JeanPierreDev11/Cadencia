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
| `js/app.js` | Pantallas y lógica |
| `js/data.js` | Conexión con Firebase y modo prueba |
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

## Estructura de datos en Firestore

```
users/{uid}
  nombre, email, objetivos[], sexo, edad, alturaCm, pesoKg, pesoInicial, pesoObjetivo, fechaInicio, onboarded
users/{uid}/pesos/{AAAA-MM-DD}
  fecha, kg
users/{uid}  → campo rutina
  tipos[], otro, dias[] (0 = lunes), modo (propuesta | propia), sesiones{dia: {t, nombre, min, ej[] | ses | det}}
users/{uid}/entrenos/{id}
  fecha, tipo (gym | bici | cardio | otro), nombre, min, km, elev, pulso, esf, kcal, ejercicios[{n, series[{kg, reps}]}]
```
