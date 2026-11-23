// Capa de datos: misma interfaz para Firebase (real) y para el modo prueba (local).
// Respaldo para cuentas Pro antiguas sin `proPlan`: solo en memoria, NUNCA se guarda en Firestore.
// Cuentas gratuitas sin `proPlan` (anteriores a este campo): se ven con `proPlan: 'none'`, igual que las nuevas.
const conPlan = (p) => {
  if (!p) return p;
  if (p.isPro === true && Number(p.proCaduca) > 0 && Number(p.proCaduca) <= Date.now()) p = { ...p, isPro: false }; // días de Pro regalados (referidos) ya caducados: el servidor lo confirma en menos de una hora
  if (p.isPro === true) return ['mensual', 'anual', 'siempre'].includes(p.proPlan) || Number(p.proCaduca) > 0 ? p : { ...p, proPlan: 'mensual' }; // el Pro regalado (proCaduca) no es un plan de pago
  return p.proPlan ? p : { ...p, proPlan: 'none' };
};

import { FIREBASE_CONFIG, CICLISMO, APPCHECK_SITE_KEY } from './config.js';
const sinBici = (l) => (CICLISMO ? l : l.filter((w) => w.tipo !== 'bici')); // con el ciclismo apagado, los entrenos de bici guardados no se enseñan

const FB = 'https://www.gstatic.com/firebasejs/10.14.1/';
// Referidos: 1 semana de Pro por amigo invitado (máx. 10). Mismas cifras que las Cloud Functions miCodigo / canjearCodigo / reclamarReferido.
export const REF_MAX = 10;
export const REF_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
const REF_ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const refNuevo = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => REF_ALFABETO[b % REF_ALFABETO.length]).join('');
const refCodigoLimpio = (c) => String(c || '').trim().toUpperCase().replace(/[\s-]/g, '');
// Código corto para compartir rutinas: 6 caracteres sin letras que se confunden (I, O) ni 0/1.
const nuevoCodigo = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

/* ------------------------------------------------------------------ */
/* Firebase                                                           */
/* ------------------------------------------------------------------ */
async function firebaseBackend(config) {
  const [{ initializeApp }, A, F, AC] = await Promise.all([
    import(/* @vite-ignore */ FB + 'firebase-app.js'),
    import(/* @vite-ignore */ FB + 'firebase-auth.js'),
    import(/* @vite-ignore */ FB + 'firebase-firestore.js'),
    import(/* @vite-ignore */ FB + 'firebase-app-check.js').catch(() => null), // si no carga, la app sigue sin App Check
  ]);
  const app = initializeApp(config);
  // App Check (reCAPTCHA v3): va justo tras initializeApp y ANTES de Auth/Firestore/Functions, que lo recogen al crearse.
  // Mientras EXIGIR_APPCHECK sea false en el servidor, esto solo envía tokens (métricas) y nunca bloquea: un fallo aquí no debe romper la app.
  if (AC && APPCHECK_SITE_KEY) {
    try {
      if (location.hostname === 'localhost') self.FIREBASE_APPCHECK_DEBUG_TOKEN = true; // solo en local: el SDK imprime un token de depuración en la consola para registrarlo en Firebase
      AC.initializeAppCheck(app, { provider: new AC.ReCaptchaV3Provider(APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
    } catch (e) { console.warn('App Check no se pudo iniciar', e); }
  }
  const auth = A.getAuth(app);
  auth.languageCode = 'es';
  let db;
  try {
    db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch (e) {
    db = F.getFirestore(app);
  }

  const userRef = (uid) => F.doc(db, 'users', uid);
  const weightRef = (uid, date) => F.doc(db, 'users', uid, 'pesos', date);

  const err = (code) => { const e = new Error(code); e.code = code; return e; };
  const toUser = (u) => (u ? { uid: u.uid, email: u.email, name: u.displayName || '' } : null);
  // Llama a una Cloud Function de referidos y traduce sus errores (los mensajes de la IA no valen aquí).
  const llamar = async (nombre, data) => {
    const Fn = await import(/* @vite-ignore */ FB + 'firebase-functions.js');
    try { return (await Fn.httpsCallable(Fn.getFunctions(app, 'europe-west1'), nombre, { timeout: 30000 })(data || {})).data; }
    catch (e) {
      const c = String((e && e.code) || ''), hayMsg = e && e.details && e.details.codigo;
      const msg = hayMsg ? e.message : c === 'functions/not-found' ? 'Los referidos todavía no están activados en el servidor.' : c === 'functions/unauthenticated' ? 'Inicia sesión otra vez para continuar.' : c === 'functions/failed-precondition' || c === 'functions/invalid-argument' || c === 'functions/already-exists' || c === 'functions/resource-exhausted' ? e.message : 'No se ha podido completar ahora mismo. Prueba más tarde.';
      throw Object.assign(new Error(msg), { code: 'ref/' + (hayMsg || c) });
    }
  };
  let iaFn = null, stravaFn = null; // funciones «ia» y «strava» en Cloud Functions (europe-west1), se cargan la primera vez

  return {
    mode: 'firebase',
    onAuth(cb) { return A.onAuthStateChanged(auth, (u) => cb(toUser(u))); },
    async register(name, email, pass) {
      const cred = await A.createUserWithEmailAndPassword(auth, email, pass);
      if (name) await A.updateProfile(cred.user, { displayName: name });
      const nombre = (name || '').trim().split(/\s+/)[0] || '';
      await F.setDoc(userRef(cred.user.uid), { nombre, nombreCompleto: (name || '').trim(), email, creado: F.serverTimestamp(), onboarded: false, onboardingCompletado: false, isPro: false, proPlan: 'none', referidos: 0, recompensas: [] }, { merge: true });
      llamar('miCodigo').catch(() => {}); // el servidor le asigna su código de invitación (si falla, se pide al abrir la app)
      return toUser(cred.user);
    },
    async login(email, pass) { return toUser((await A.signInWithEmailAndPassword(auth, email, pass)).user); },
    // Entrar o crear la cuenta con Google / Apple (ventana emergente). Requieren el proveedor activado en Firebase Authentication (Apple, además, la configuración de Apple Developer).
    async loginGoogle() { return toUser((await A.signInWithPopup(auth, new A.GoogleAuthProvider())).user); },
    async loginApple() { const p = new A.OAuthProvider('apple.com'); p.addScope('email'); p.addScope('name'); return toUser((await A.signInWithPopup(auth, p)).user); },
    async logout() { await A.signOut(auth); },
    // Cuenta: proveedores de acceso, contraseña, Google y foto de perfil (Firebase Storage).
    providers() { return ((auth.currentUser && auth.currentUser.providerData) || []).map((p) => p.providerId); },
    async changePassword(actual, nueva) {
      const u = auth.currentUser;
      if (!u || !u.email) throw err('auth/no-current-user');
      await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, actual));
      await A.updatePassword(u, nueva);
    },
    async linkGoogle() { await A.linkWithPopup(auth.currentUser, new A.GoogleAuthProvider()); },
    async uploadAvatar(uid, blob) {
      const S = await import(/* @vite-ignore */ FB + 'firebase-storage.js');
      const r = S.ref(S.getStorage(app), `profile_pictures/${uid}/avatar.jpg`);
      await S.uploadBytes(r, blob, { contentType: 'image/jpeg', cacheControl: 'public,max-age=3600' });
      return `${await S.getDownloadURL(r)}&v=${Date.now()}`;
    },
    async addFeatureRequest(uid, email, texto) { await F.addDoc(F.collection(db, 'feature_requests'), { uid, email: email || '', texto, creado: F.serverTimestamp() }); },
    // Sugerencia o fallo (colección «feedback»: solo se crea desde la app; se lee en la consola de Firebase). puntuacion = 1-5 o null.
    async enviarFeedback(uid, email, mensaje, puntuacion) { await F.addDoc(F.collection(db, 'feedback'), { uid, email: email || '', mensaje, puntuacion: puntuacion || null, fecha: F.serverTimestamp() }); },
    // Rutinas compartidas: colección «shared_routines», el id del documento es el código.
    async shareRutina(uid, rut) {
      let code = rut.shareCode;
      for (let i = 0; !code && i < 8; i++) { const c = nuevoCodigo(); if (!(await F.getDoc(F.doc(db, 'shared_routines', c))).exists()) code = c; }
      if (!code) throw err('share/codigo');
      await F.setDoc(F.doc(db, 'shared_routines', code), { ...JSON.parse(JSON.stringify(rut)), shareCode: code, userId: uid, compartida: F.serverTimestamp() });
      return code;
    },
    async getSharedRutina(code) { const s = await F.getDoc(F.doc(db, 'shared_routines', code)); return s.exists() ? s.data() : null; },
    async resetPassword(email) { await A.sendPasswordResetEmail(auth, email); },
    async getProfile(uid) {
      const s = await F.getDoc(userRef(uid));
      return s.exists() ? conPlan(s.data()) : null;
    },
    async saveProfile(uid, data) {
      await F.setDoc(userRef(uid), { ...data, actualizado: F.serverTimestamp() }, { merge: true });
    },
    // Lista prioritaria de Cadencia PRO (beta, sin cobros): guarda el interés con fecha del SERVIDOR en users/{uid}.
    async interesPro(uid) {
      await F.setDoc(userRef(uid), { interesPro: true, fechaInteresPro: F.serverTimestamp(), actualizado: F.serverTimestamp() }, { merge: true });
    },
    // Avisa en directo de los cambios del perfil (p. ej. cuando el servidor activa Pro). Devuelve la función para dejar de escuchar.
    watchProfile(uid, cb) {
      return F.onSnapshot(userRef(uid), (s) => { if (s.exists()) cb(conPlan(s.data())); }, () => {});
    },
    async addWeight(uid, date, kg, extra = {}) {
      await F.setDoc(weightRef(uid, date), { fecha: date, kg, ...extra }, { merge: true });
    },
    // Sustituye el registro de ese día (misma estructura {fecha, kg, grasa?, musculo?, agua?, hueso?}); sirve para editar y poder quitar un dato.
    async setWeight(uid, date, kg, extra = {}) { await F.setDoc(weightRef(uid, date), { fecha: date, kg, ...extra }); },
    async deleteWeight(uid, date) { await F.deleteDoc(weightRef(uid, date)); },
    async listWeights(uid, n = 120) {
      const q = F.query(F.collection(db, 'users', uid, 'pesos'), F.orderBy('fecha', 'desc'), F.limit(n));
      const s = await F.getDocs(q);
      return s.docs.map((d) => d.data()).reverse();
    },
    async saveWorkout(uid, w) { await F.setDoc(F.doc(db, 'users', uid, 'entrenos', w.id), w); },
    async deleteWorkout(uid, id) { await F.deleteDoc(F.doc(db, 'users', uid, 'entrenos', id)); },
    async saveDia(uid, fecha, data) { await F.setDoc(F.doc(db, 'users', uid, 'comidas', fecha), { ...data, fecha }); },
    // Rutas importadas de un GPX (recorrido simplificado, km y desnivel).
    async saveRuta(uid, r) { await F.setDoc(F.doc(db, 'users', uid, 'rutas', r.id), r); },
    async listRutas(uid) { const s = await F.getDocs(F.collection(db, 'users', uid, 'rutas')); return s.docs.map((d) => d.data()).sort((a, b) => (b.creado || '').localeCompare(a.creado || '')); },
    async deleteRuta(uid, id) { await F.deleteDoc(F.doc(db, 'users', uid, 'rutas', id)); },
    async listDias(uid, desde) {
      const q = F.query(F.collection(db, 'users', uid, 'comidas'), F.where('fecha', '>=', desde));
      const s = await F.getDocs(q);
      return s.docs.map((d) => d.data());
    },
    // Borra la cuenta: primero confirma la contraseña, luego todos los datos (pesos, entrenos, comidas y perfil) y por último el usuario.
    async deleteAccount(pass) {
      const u = auth.currentUser;
      if (!u) throw Object.assign(new Error('no-user'), { code: 'auth/no-current-user' });
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw Object.assign(new Error('offline'), { code: 'auth/network-request-failed' });
      await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, pass));
      for (const sub of ['pesos', 'entrenos', 'comidas', 'rutas']) {
        const snap = await F.getDocsFromServer(F.collection(db, 'users', u.uid, sub));
        let b = F.writeBatch(db), n = 0;
        for (const d of snap.docs) { b.delete(d.ref); if (++n === 450) { await b.commit(); b = F.writeBatch(db); n = 0; } }
        if (n) await b.commit();
      }
      try { await this.strava({ modo: 'desconectar' }); } catch (e) { /* sin Strava conectado */ }
      try { await this.ia({ modo: 'borrar' }); } catch (e) { /* si no hay IA, no hay contadores que borrar */ }
      try { const S = await import(/* @vite-ignore */ FB + 'firebase-storage.js'); await S.deleteObject(S.ref(S.getStorage(app), `profile_pictures/${u.uid}/avatar.jpg`)); } catch (e) { /* sin foto */ }
      await F.deleteDoc(userRef(u.uid));
      await A.deleteUser(u);
    },
    // IA (foto del plato y Taller) a través de la Cloud Function «ia».
    async ia(data) {
      if (!iaFn) {
        const Fn = await import(/* @vite-ignore */ FB + 'firebase-functions.js');
        iaFn = Fn.httpsCallable(Fn.getFunctions(app, 'europe-west1'), 'ia', { timeout: 95000 });
      }
      return (await iaFn(data)).data;
    },
    // Coach AI (Gemini) a través de la Cloud Function «coach»: analiza el entreno guardado y lo guarda en su documento.
    async coach(id) {
      const Fn = await import(/* @vite-ignore */ FB + 'firebase-functions.js');
      return (await Fn.httpsCallable(Fn.getFunctions(app, 'europe-west1'), 'coach', { timeout: 95000 })({ id })).data;
    },
    // Ajustes de la rutina propuesta con IA (Gemini) a través de «ajustarRutina»: { modo:'estado' } = cuántos ajustes quedan hoy; con { rutina, catalogo, contexto, instruccion } devuelve la rutina modificada.
    // El contador diario (3 sin Pro, 10 con Pro) lo lleva el servidor.
    async ajustarRutina(data) {
      const Fn = await import(/* @vite-ignore */ FB + 'firebase-functions.js');
      return (await Fn.httpsCallable(Fn.getFunctions(app, 'europe-west1'), 'ajustarRutina', { timeout: 95000 })(data || {})).data;
    },
    // Strava a través de la Cloud Function «strava» (conectar, actividades, desconectar). Los tokens nunca llegan al móvil.
    async strava(data) {
      if (!stravaFn) {
        const Fn = await import(/* @vite-ignore */ FB + 'firebase-functions.js');
        stravaFn = Fn.httpsCallable(Fn.getFunctions(app, 'europe-west1'), 'strava', { timeout: 60000 });
      }
      return (await stravaFn(data)).data;
    },
    // Referidos (todo lo decide el servidor): su código, canjear el de un amigo y reclamar una semana por hito.
    miCodigo() { return llamar('miCodigo'); },
    canjearCodigo(codigo) { return llamar('canjearCodigo', { codigo }); },
    reclamarReferido(hito) { return llamar('reclamarReferido', { hito }); },
    // Sesión del portal de Stripe (cambiar tarjeta / cancelar). Devuelve { url }.
    async portal(volver) {
      const Fn = await import(/* @vite-ignore */ FB + 'firebase-functions.js');
      return (await Fn.httpsCallable(Fn.getFunctions(app, 'europe-west1'), 'portalStripe', { timeout: 30000 })({ volver })).data;
    },
    // Notificaciones push (Firebase Cloud Messaging). El token identifica este dispositivo; se guarda en users/{uid}.fcmTokens.
    async pushToken(vapidKey) {
      const M = await import(/* @vite-ignore */ FB + 'firebase-messaging.js');
      if (!(await M.isSupported())) throw err('push/no-soportado');
      const espera = new Promise((_, no) => setTimeout(() => no(err('push/sin-sw')), 10000));
      const reg = await Promise.race([navigator.serviceWorker.ready, espera]);
      return M.getToken(M.getMessaging(app), { vapidKey, serviceWorkerRegistration: reg });
    },
    async pushBorrarToken() {
      try { const M = await import(/* @vite-ignore */ FB + 'firebase-messaging.js'); await M.deleteToken(M.getMessaging(app)); } catch (e) { /* ya no había token */ }
    },
    async saveToken(uid, token) { await F.setDoc(userRef(uid), { fcmTokens: F.arrayUnion(token) }, { merge: true }); },
    async removeToken(uid, token) { await F.setDoc(userRef(uid), { fcmTokens: F.arrayRemove(token) }, { merge: true }); },
    async listWorkouts(uid, n = 500) { // de más reciente a más antiguo
      const q = F.query(F.collection(db, 'users', uid, 'entrenos'), F.orderBy('fecha', 'desc'), F.limit(n));
      const s = await F.getDocs(q);
      return sinBici(s.docs.map((d) => d.data()));
    },
  };
}

/* ------------------------------------------------------------------ */
/* Modo prueba: cuentas y datos en este dispositivo                    */
/* ------------------------------------------------------------------ */
function localBackend() {
  const KEY = 'cadencia-local-v1';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { users: {}, session: null }; } catch (e) { return { users: {}, session: null }; } };
  const write = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* sin almacenamiento */ } };
  const listeners = new Set();
  const err = (code) => { const e = new Error(code); e.code = code; return e; };
  const hash = async (txt) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cadencia:' + txt));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  const current = () => {
    const s = read();
    const u = s.session && s.users[s.session];
    return u ? { uid: u.uid, email: u.email, name: u.profile.nombre || '' } : null;
  };
  const emit = () => { const u = current(); listeners.forEach((cb) => cb(u)); };
  const byUid = (s, uid) => Object.values(s.users).find((u) => u.uid === uid);
  const refNuevoLocal = (s) => { let c; do c = refNuevo(); while (Object.values(s.users).some((u) => u.profile.refCode === c)); return c; };
  const refErr = (c, m) => Object.assign(new Error(m), { code: 'ref/' + c });
  const refPagado = (p) => p.isPro === true && !(Number(p.proCaduca) > 0);
  const refMas = (p) => Math.max(Date.now(), p.isPro === true && Number(p.proCaduca) > Date.now() ? Number(p.proCaduca) : 0) + REF_SEMANA_MS;
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  return {
    mode: 'local',
    onAuth(cb) { listeners.add(cb); setTimeout(() => cb(current()), 0); return () => listeners.delete(cb); },
    async register(name, email, pass) {
      email = email.trim().toLowerCase();
      if (!validEmail(email)) throw err('auth/invalid-email');
      if (pass.length < 6) throw err('auth/weak-password');
      const s = read();
      if (s.users[email]) throw err('auth/email-already-in-use');
      const uid = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      s.users[email] = { uid, email, pass: await hash(pass), profile: { nombre: (name || '').trim().split(/\s+/)[0] || '', nombreCompleto: (name || '').trim(), email, onboarded: false, onboardingCompletado: false, creado: Date.now(), isPro: false, proPlan: 'none', refCode: refNuevoLocal(s), referidos: 0, recompensas: [] }, pesos: {} };
      s.session = email;
      write(s); emit();
      return current();
    },
    async login(email, pass) {
      email = email.trim().toLowerCase();
      const s = read();
      const u = s.users[email];
      if (!u || u.pass !== (await hash(pass))) throw err('auth/invalid-credential');
      s.session = email; write(s); emit();
      return current();
    },
    async loginGoogle() { throw err('local/no-social'); },
    async loginApple() { throw err('local/no-social'); },
    async logout() { const s = read(); s.session = null; write(s); emit(); },
    providers() { return ['password']; },
    async changePassword(actual, nueva) {
      const s = read(), u = s.session && s.users[s.session];
      if (!u || u.pass !== (await hash(actual))) throw err('auth/invalid-credential');
      u.pass = await hash(nueva); write(s);
    },
    async linkGoogle() { throw err('local/no-google'); },
    async uploadAvatar(uid, blob) {
      return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(err('local/foto')); r.readAsDataURL(blob); });
    },
    async addFeatureRequest(uid, email, texto) { const s = read(); (s.requests = s.requests || []).push({ uid, email, texto, creado: Date.now() }); write(s); },
    async enviarFeedback(uid, email, mensaje, puntuacion) { const s = read(); (s.feedback = s.feedback || []).push({ uid, email: email || '', mensaje, puntuacion: puntuacion || null, fecha: Date.now() }); write(s); },
    async shareRutina(uid, rut) {
      const s = read(); s.shared = s.shared || {};
      let code = rut.shareCode; while (!code || (s.shared[code] && s.shared[code].userId !== uid)) code = nuevoCodigo();
      s.shared[code] = { ...JSON.parse(JSON.stringify(rut)), shareCode: code, userId: uid }; write(s); return code;
    },
    async getSharedRutina(code) { const r = (read().shared || {})[code]; return r ? JSON.parse(JSON.stringify(r)) : null; },
    async resetPassword() { throw err('local/no-reset'); },
    async getProfile(uid) { const u = byUid(read(), uid); return u ? conPlan(u.profile) : null; },
    watchProfile(uid, cb) { const t = setInterval(() => { const u = byUid(read(), uid); if (u) cb(conPlan(u.profile)); }, 1500); return () => clearInterval(t); },
    async saveProfile(uid, data) {
      const s = read(); const u = byUid(s, uid); if (!u) return;
      u.profile = { ...u.profile, ...data, actualizado: Date.now() }; write(s);
    },
    async interesPro(uid) {
      const s = read(); const u = byUid(s, uid); if (!u) return;
      u.profile = { ...u.profile, interesPro: true, fechaInteresPro: Date.now(), actualizado: Date.now() }; write(s);
    },
    async addWeight(uid, date, kg, extra = {}) { const s = read(); const u = byUid(s, uid); if (!u) return; u.pesos[date] = { ...(u.pesos[date] || {}), fecha: date, kg, ...extra }; write(s); },
    async setWeight(uid, date, kg, extra = {}) { const s = read(); const u = byUid(s, uid); if (!u) return; u.pesos[date] = { fecha: date, kg, ...extra }; write(s); },
    async deleteWeight(uid, date) { const s = read(); const u = byUid(s, uid); if (!u) return; delete u.pesos[date]; write(s); },
    async listWeights(uid, n = 120) {
      const u = byUid(read(), uid); if (!u) return [];
      return Object.values(u.pesos).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-n);
    },
    async saveWorkout(uid, w) { const s = read(); const u = byUid(s, uid); if (!u) return; (u.entrenos = u.entrenos || {})[w.id] = w; write(s); },
    async deleteWorkout(uid, id) { const s = read(); const u = byUid(s, uid); if (!u || !u.entrenos) return; delete u.entrenos[id]; write(s); },
    async saveDia(uid, fecha, data) { const s = read(); const u = byUid(s, uid); if (!u) return; (u.comidas = u.comidas || {})[fecha] = { ...data, fecha }; write(s); },
    async saveRuta(uid, r) { const s = read(); const u = byUid(s, uid); if (!u) return; (u.rutas = u.rutas || {})[r.id] = r; write(s); },
    async listRutas(uid) { const u = byUid(read(), uid); return u && u.rutas ? Object.values(u.rutas).sort((a, c) => (c.creado || '').localeCompare(a.creado || '')) : []; },
    async deleteRuta(uid, id) { const s = read(); const u = byUid(s, uid); if (u && u.rutas) { delete u.rutas[id]; write(s); } },
    async listDias(uid, desde) { const u = byUid(read(), uid); if (!u || !u.comidas) return []; return Object.values(u.comidas).filter((d) => d.fecha >= desde); },
    async deleteAccount(pass) {
      const s = read(), email = s.session, u = email && s.users[email];
      if (!u) throw err('auth/no-current-user');
      if (u.pass !== (await hash(pass))) throw err('auth/invalid-credential');
      delete s.users[email]; s.session = null; write(s); emit();
    },
    // En modo prueba no hay servidor: la IA solo responde si una prueba automática la simula.
    async ia(data) {
      if (typeof globalThis.cadenciaIAPrueba === 'function') return globalThis.cadenciaIAPrueba(data);
      throw err('local/no-ia');
    },
    async portal() { throw err('local/no-portal'); },
    // Referidos en modo prueba: misma lógica que las Cloud Functions, pero con las cuentas guardadas en este dispositivo.
    async miCodigo() {
      const s = read(), u = s.session && s.users[s.session]; if (!u) throw err('auth/no-current-user');
      if (!u.profile.refCode) { u.profile = { ...u.profile, refCode: refNuevoLocal(s), referidos: u.profile.referidos || 0, recompensas: u.profile.recompensas || [] }; write(s); }
      return { refCode: u.profile.refCode };
    },
    async canjearCodigo(codigo) {
      const s = read(), yo = s.session && s.users[s.session]; if (!yo) throw err('auth/no-current-user');
      const c = refCodigoLimpio(codigo);
      if (!/^[A-Z0-9]{6}$/.test(c)) throw refErr('ref-formato', 'El código tiene 6 letras y números.');
      const el = Object.values(s.users).find((u) => u.profile.refCode === c);
      if (!el) throw refErr('ref-no-existe', 'Ese código no existe. Revísalo y vuelve a probar.');
      if (el.uid === yo.uid) throw refErr('ref-propio', 'No puedes usar tu propio código.');
      if (yo.profile.codigoUsado === true) throw refErr('ref-usado', 'Ya has usado un código de invitación en esta cuenta.');
      if (refPagado(yo.profile)) throw refErr('ref-pro-pago', 'Ya tienes Cadencia PRO de pago: la semana de regalo no te haría falta.');
      if ((el.profile.referidos || 0) >= REF_MAX) throw refErr('ref-lleno', 'Este código ya ha llegado a su límite de invitados.');
      const caduca = refMas(yo.profile);
      yo.profile = { ...yo.profile, isPro: true, proCaduca: caduca, codigoUsado: true };
      el.profile = { ...el.profile, referidos: (el.profile.referidos || 0) + 1 };
      write(s); return { proCaduca: caduca };
    },
    async reclamarReferido(hito) {
      const s = read(), u = s.session && s.users[s.session]; if (!u) throw err('auth/no-current-user');
      const h = Number(hito), p = u.profile, rec = p.recompensas || [];
      if (!Number.isInteger(h) || h < 1 || h > REF_MAX) throw refErr('ref-formato', 'Recompensa no válida.');
      if (rec.includes(h)) throw refErr('ref-reclamado', 'Esa semana ya está reclamada.');
      if ((p.referidos || 0) < h) throw refErr('ref-faltan', `Aún no has invitado a ${h} ${h === 1 ? 'amigo' : 'amigos'}.`);
      if (refPagado(p)) throw refErr('ref-pro-pago', 'Ya tienes Cadencia PRO de pago. Reclama la semana cuando tu plan termine: no se pierde.');
      const caduca = refMas(p), recompensas = [...rec, h].sort((a, b) => a - b);
      u.profile = { ...p, isPro: true, proCaduca: caduca, recompensas };
      write(s); return { proCaduca: caduca, recompensas };
    },
    local: true, // modo prueba: el Coach AI devuelve un ejemplo y lo guarda la propia app
    async coach() { throw err('local/no-ia'); },
    // Ajustes de rutina con IA en modo prueba: mismo contador diario que el servidor (3 sin Pro, 10 con Pro; guardado en este dispositivo) y una respuesta SIMULADA
    // (sube una serie al primer ejercicio de fuerza) para poder ver cómo se aplica un ajuste. Una prueba automática puede sustituirla con globalThis.cadenciaAjusteRutinaPrueba.
    async ajustarRutina(data) {
      const s = read(), u = s.session && s.users[s.session]; if (!u) throw err('auth/no-current-user');
      const pro = conPlan(u.profile).isPro === true, limite = pro ? 10 : 3, dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
      const usadas = ((s.ajustes || {})[u.uid + '_' + dia]) || 0;
      if (data && data.modo === 'estado') return { usadas, quedan: Math.max(0, limite - usadas), limite, pro };
      if (!data || String(data.instruccion || '').trim().length < 3 || !data.rutina) throw Object.assign(new Error('Escribe qué quieres cambiar de la rutina.'), { code: 'functions/invalid-argument' });
      if (usadas >= limite) throw Object.assign(new Error(pro ? `Ya has usado tus ${limite} ajustes PRO de hoy. Mañana tendrás otros ${limite}.` : `Ya has usado tus ${limite} ajustes de hoy. Con Cadencia PRO tienes hasta 10 al día.`), { code: 'functions/resource-exhausted', details: { codigo: 'ajustes-limite', usadas, limite, pro } });
      let res;
      if (typeof globalThis.cadenciaAjusteRutinaPrueba === 'function') res = await globalThis.cadenciaAjusteRutinaPrueba(data);
      else {
        const dias = JSON.parse(JSON.stringify(data.rutina.dias || [])), d = dias.find((x) => x.tipo === 'fuerza' && x.ejercicios && x.ejercicios.length);
        if (d) { d.ejercicios[0].series = Math.min(10, (Number(d.ejercicios[0].series) || 3) + 1); }
        res = { mensaje: d ? `Modo prueba (sin servidor de IA): he subido una serie a «${d.ejercicios[0].nombre}» el ${['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][d.dia]} para que veas cómo se aplica un ajuste.` : 'Modo prueba (sin servidor de IA): no hay nada que ajustar.', dias: dias.map((x) => ({ ...x, origen: x.dia })) };
      }
      (s.ajustes = s.ajustes || {})[u.uid + '_' + dia] = usadas + 1; write(s);
      return { ...res, usadas: usadas + 1, quedan: limite - usadas - 1, limite, pro };
    },
    // En modo prueba no hay servidor: Strava solo responde si una prueba automática lo simula.
    async strava(data) {
      if (typeof globalThis.cadenciaStravaPrueba === 'function') return globalThis.cadenciaStravaPrueba(data);
      throw err('local/no-strava');
    },
    // En modo prueba no hay servidor de notificaciones: solo responde si una prueba automática lo simula.
    async pushToken(vapidKey) {
      if (typeof globalThis.cadenciaPushPrueba === 'function') return globalThis.cadenciaPushPrueba(vapidKey);
      throw err('local/no-push');
    },
    async pushBorrarToken() { /* nada que borrar */ },
    async saveToken(uid, token) { const s = read(); const u = byUid(s, uid); if (!u) return; const a = u.profile.fcmTokens || []; if (!a.includes(token)) a.push(token); u.profile.fcmTokens = a; write(s); },
    async removeToken(uid, token) { const s = read(); const u = byUid(s, uid); if (!u) return; u.profile.fcmTokens = (u.profile.fcmTokens || []).filter((x) => x !== token); write(s); },
    async listWorkouts(uid, n = 500) {
      const u = byUid(read(), uid); if (!u || !u.entrenos) return [];
      return sinBici(Object.values(u.entrenos)).sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.id > a.id ? 1 : -1)).slice(0, n);
    },
  };
}

export async function createBackend() {
  if (FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey) return firebaseBackend(FIREBASE_CONFIG);
  return localBackend();
}

const MESSAGES = {
  'auth/email-already-in-use': 'Ya hay una cuenta con ese email. Inicia sesión o usa otro.',
  'auth/invalid-email': 'Ese email no parece válido. Revísalo.',
  'auth/weak-password': 'La contraseña necesita al menos 6 caracteres.',
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/wrong-password': 'Email o contraseña incorrectos.',
  'auth/user-not-found': 'Email o contraseña incorrectos.',
  'auth/missing-password': 'Escribe tu contraseña.',
  'auth/too-many-requests': 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.',
  'auth/network-request-failed': 'Sin conexión. Comprueba internet y vuelve a probar.',
  'auth/operation-not-allowed': 'Ese método de acceso no está activado en Firebase (Authentication → Sign-in method).',
  'auth/unauthorized-domain': 'Esta dirección web no está autorizada en Firebase (Authentication → Settings → Authorized domains).',
  'permission-denied': 'La base de datos ha rechazado la operación. Revisa las reglas de Firestore.',
  'unavailable': 'Sin conexión con la base de datos. Se guardará al volver la conexión.',
  'auth/no-current-user': 'No hay ninguna sesión iniciada.',
  'auth/requires-recent-login': 'Por seguridad, vuelve a escribir tu contraseña.',
  'local/no-social': 'Google y Apple solo funcionan con la app conectada a Firebase. En modo prueba usa el email.',
  'auth/account-exists-with-different-credential': 'Ya existe una cuenta con ese email y otro método de acceso. Entra con ese método.',
  'local/no-google': 'Vincular Google solo funciona con la app conectada a Firebase.',
  'local/foto': 'No se ha podido leer la foto.',
  'auth/credential-already-in-use': 'Esa cuenta de Google ya está vinculada a otra cuenta de Cadencia.',
  'auth/provider-already-linked': 'Tu cuenta ya está vinculada con Google.',
  'auth/popup-blocked': 'El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes y vuelve a probar.',
  'auth/popup-closed-by-user': 'Has cerrado la ventana de Google antes de terminar.',
  'auth/cancelled-popup-request': 'Has cerrado la ventana de Google antes de terminar.',
  'storage/unauthorized': 'Firebase Storage ha rechazado la foto. Revisa que Storage esté activado y sus reglas publicadas.',
  'storage/unknown': 'No se ha podido subir la foto. Comprueba que Firebase Storage está activado.',
  'storage/bucket-not-found': 'Firebase Storage todavía no está activado en el proyecto.',
  'local/no-push': 'Las notificaciones solo funcionan con la app conectada a Firebase.',
  'push/no-soportado': 'Este navegador no permite notificaciones push.',
  'local/no-strava': 'En el modo de prueba no se puede conectar Strava.',
  'local/no-ia': 'La IA solo funciona con la app conectada a Firebase.',
  'functions/not-found': 'La IA todavía no está activada en el servidor.',
  'functions/permission-denied': 'La IA es de Cadencia Pro.',
  'functions/unauthenticated': 'Inicia sesión otra vez para usar la IA.',
  'functions/deadline-exceeded': 'La IA ha tardado demasiado. Prueba otra vez.',
  'functions/internal': 'La IA no está disponible ahora mismo. Prueba más tarde.',
  'local/no-reset': 'En modo prueba no se puede recuperar la contraseña: crea una cuenta nueva.',
};
export const errorText = (e) => MESSAGES[e && e.code] || (e && e.message) || 'Algo ha fallado. Vuelve a probar.';
