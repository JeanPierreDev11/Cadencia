// Capa de datos: misma interfaz para Firebase (real) y para el modo prueba (local).
import { FIREBASE_CONFIG } from './config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.14.1/';

/* ------------------------------------------------------------------ */
/* Firebase                                                           */
/* ------------------------------------------------------------------ */
async function firebaseBackend(config) {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(FB + 'firebase-app.js'),
    import(FB + 'firebase-auth.js'),
    import(FB + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(config);
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

  const toUser = (u) => (u ? { uid: u.uid, email: u.email, name: u.displayName || '' } : null);
  let iaFn = null; // función «ia» en Cloud Functions (europe-west1), se carga la primera vez

  return {
    mode: 'firebase',
    onAuth(cb) { return A.onAuthStateChanged(auth, (u) => cb(toUser(u))); },
    async register(name, email, pass) {
      const cred = await A.createUserWithEmailAndPassword(auth, email, pass);
      if (name) await A.updateProfile(cred.user, { displayName: name });
      await F.setDoc(userRef(cred.user.uid), { nombre: name, email, creado: F.serverTimestamp(), onboarded: false }, { merge: true });
      return toUser(cred.user);
    },
    async login(email, pass) { return toUser((await A.signInWithEmailAndPassword(auth, email, pass)).user); },
    async logout() { await A.signOut(auth); },
    async resetPassword(email) { await A.sendPasswordResetEmail(auth, email); },
    async getProfile(uid) {
      const s = await F.getDoc(userRef(uid));
      return s.exists() ? s.data() : null;
    },
    async saveProfile(uid, data) {
      await F.setDoc(userRef(uid), { ...data, actualizado: F.serverTimestamp() }, { merge: true });
    },
    async addWeight(uid, date, kg, extra = {}) {
      await F.setDoc(weightRef(uid, date), { fecha: date, kg, ...extra }, { merge: true });
    },
    async deleteWeight(uid, date) { await F.deleteDoc(weightRef(uid, date)); },
    async listWeights(uid, n = 120) {
      const q = F.query(F.collection(db, 'users', uid, 'pesos'), F.orderBy('fecha', 'desc'), F.limit(n));
      const s = await F.getDocs(q);
      return s.docs.map((d) => d.data()).reverse();
    },
    async saveWorkout(uid, w) { await F.setDoc(F.doc(db, 'users', uid, 'entrenos', w.id), w); },
    async deleteWorkout(uid, id) { await F.deleteDoc(F.doc(db, 'users', uid, 'entrenos', id)); },
    async saveDia(uid, fecha, data) { await F.setDoc(F.doc(db, 'users', uid, 'comidas', fecha), { ...data, fecha }); },
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
      for (const sub of ['pesos', 'entrenos', 'comidas']) {
        const snap = await F.getDocsFromServer(F.collection(db, 'users', u.uid, sub));
        let b = F.writeBatch(db), n = 0;
        for (const d of snap.docs) { b.delete(d.ref); if (++n === 450) { await b.commit(); b = F.writeBatch(db); n = 0; } }
        if (n) await b.commit();
      }
      try { await this.ia({ modo: 'borrar' }); } catch (e) { /* si no hay IA, no hay contadores que borrar */ }
      await F.deleteDoc(userRef(u.uid));
      await A.deleteUser(u);
    },
    // IA (foto del plato y Taller) a través de la Cloud Function «ia».
    async ia(data) {
      if (!iaFn) {
        const Fn = await import(FB + 'firebase-functions.js');
        iaFn = Fn.httpsCallable(Fn.getFunctions(app, 'europe-west1'), 'ia', { timeout: 95000 });
      }
      return (await iaFn(data)).data;
    },
    async listWorkouts(uid, n = 500) { // de más reciente a más antiguo
      const q = F.query(F.collection(db, 'users', uid, 'entrenos'), F.orderBy('fecha', 'desc'), F.limit(n));
      const s = await F.getDocs(q);
      return s.docs.map((d) => d.data());
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
      s.users[email] = { uid, email, pass: await hash(pass), profile: { nombre: name, email, onboarded: false, creado: Date.now() }, pesos: {} };
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
    async logout() { const s = read(); s.session = null; write(s); emit(); },
    async resetPassword() { throw err('local/no-reset'); },
    async getProfile(uid) { const u = byUid(read(), uid); return u ? u.profile : null; },
    async saveProfile(uid, data) {
      const s = read(); const u = byUid(s, uid); if (!u) return;
      u.profile = { ...u.profile, ...data, actualizado: Date.now() }; write(s);
    },
    async addWeight(uid, date, kg, extra = {}) { const s = read(); const u = byUid(s, uid); if (!u) return; u.pesos[date] = { ...(u.pesos[date] || {}), fecha: date, kg, ...extra }; write(s); },
    async deleteWeight(uid, date) { const s = read(); const u = byUid(s, uid); if (!u) return; delete u.pesos[date]; write(s); },
    async listWeights(uid, n = 120) {
      const u = byUid(read(), uid); if (!u) return [];
      return Object.values(u.pesos).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-n);
    },
    async saveWorkout(uid, w) { const s = read(); const u = byUid(s, uid); if (!u) return; (u.entrenos = u.entrenos || {})[w.id] = w; write(s); },
    async deleteWorkout(uid, id) { const s = read(); const u = byUid(s, uid); if (!u || !u.entrenos) return; delete u.entrenos[id]; write(s); },
    async saveDia(uid, fecha, data) { const s = read(); const u = byUid(s, uid); if (!u) return; (u.comidas = u.comidas || {})[fecha] = { ...data, fecha }; write(s); },
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
    async listWorkouts(uid, n = 500) {
      const u = byUid(read(), uid); if (!u || !u.entrenos) return [];
      return Object.values(u.entrenos).sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.id > a.id ? 1 : -1)).slice(0, n);
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
  'auth/operation-not-allowed': 'El acceso con email no está activado en Firebase (Authentication → Sign-in method).',
  'auth/unauthorized-domain': 'Esta dirección web no está autorizada en Firebase (Authentication → Settings → Authorized domains).',
  'permission-denied': 'La base de datos ha rechazado la operación. Revisa las reglas de Firestore.',
  'unavailable': 'Sin conexión con la base de datos. Se guardará al volver la conexión.',
  'auth/no-current-user': 'No hay ninguna sesión iniciada.',
  'auth/requires-recent-login': 'Por seguridad, vuelve a escribir tu contraseña.',
  'local/no-ia': 'La IA solo funciona con la app conectada a Firebase.',
  'functions/not-found': 'La IA todavía no está activada en el servidor.',
  'functions/unauthenticated': 'Inicia sesión otra vez para usar la IA.',
  'functions/deadline-exceeded': 'La IA ha tardado demasiado. Prueba otra vez.',
  'functions/internal': 'La IA no está disponible ahora mismo. Prueba más tarde.',
  'local/no-reset': 'En modo prueba no se puede recuperar la contraseña: crea una cuenta nueva.',
};
export const errorText = (e) => MESSAGES[e && e.code] || (e && e.message) || 'Algo ha fallado. Vuelve a probar.';
