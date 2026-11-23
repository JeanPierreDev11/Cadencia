// Configuración de la app.
// Con FIREBASE_CONFIG rellena, las cuentas y los datos se guardan en la nube (Firebase).
// Si lo pones a null, la app vuelve al "modo prueba" (datos solo en el dispositivo).

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDCT3X0DK1lMji6BWtC9h2SgpXknJfCB0M",
  authDomain: "cadencia-11cb6.firebaseapp.com",
  projectId: "cadencia-11cb6",
  storageBucket: "cadencia-11cb6.firebasestorage.app",
  messagingSenderId: "1098610128516",
  appId: "1:1098610128516:web:2de3814aa3179a46d534d1"
};

// Firebase App Check (reCAPTCHA v3): clave de SITIO, pública por diseño (la clave secreta vive en la consola de Firebase).
export const APPCHECK_SITE_KEY = '6LfEHC4uAAAAAA1k8h4skLI0Atrug4UnlEgzi1oo';

export const APP_NAME = 'Cadencia';

// Interruptor del ciclismo (pestaña Bici, rutas y mapas, Taller, Strava y tipo de entreno «Bici»).
// En false todo queda oculto; el código y los datos guardados se conservan. Poner true para volver a enseñarlo.
export const CICLISMO = false;
