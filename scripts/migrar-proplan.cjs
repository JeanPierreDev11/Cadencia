// Migración única: pone `proPlan: 'none'` a las cuentas GRATUITAS que no tienen el campo (las anteriores al 2026-11-12).
// - Solo toca `users/{uid}` con isPro distinto de true y sin `proPlan`. No toca ningún otro campo (ni `actualizado`).
// - No toca a las cuentas Pro (aunque les falte `proPlan`: de eso se encarga el webhook de Stripe) ni a las que ya tienen un valor.
// - Cada cuenta se comprueba y escribe dentro de una transacción: si mientras tanto pasa a Pro o recibe `proPlan`, se salta.
// - Es repetible: la segunda vez no encuentra nada que cambiar. Por defecto solo cuenta (simulacro); con APLICAR=true escribe.
// - Solo imprime cifras, nunca correos ni uids.
// Uso real: GitHub → Actions → «Migrar proPlan» → Run workflow (primero sin marcar «aplicar», luego marcándolo).
const path = require('path');

async function migrar(db, aplicar, log = console.log) {
  const r = { total: 0, yaTienen: 0, proSinPlan: 0, aMigrar: 0, migradas: 0, saltadas: 0 };
  const pendientes = [];
  const snap = await db.collection('users').select('isPro', 'proPlan').get();
  snap.forEach((d) => {
    r.total++;
    const x = d.data();
    if (x.proPlan !== undefined && x.proPlan !== null) r.yaTienen++;
    else if (x.isPro === true) r.proSinPlan++;
    else { r.aMigrar++; pendientes.push(d.ref); }
  });
  if (aplicar) {
    for (let i = 0; i < pendientes.length; i += 20) {
      await Promise.all(pendientes.slice(i, i + 20).map((ref) => db.runTransaction(async (t) => {
        const d = await t.get(ref), x = d.exists ? d.data() : null;
        if (!x || x.isPro === true || (x.proPlan !== undefined && x.proPlan !== null)) { r.saltadas++; return; }
        t.update(ref, { proPlan: 'none' });
        r.migradas++;
      })));
    }
  }
  log(`Cuentas en total:                      ${r.total}`);
  log(`Ya tenían proPlan (no se tocan):       ${r.yaTienen}`);
  log(`Pro sin proPlan (no se tocan):         ${r.proSinPlan}`);
  log(`Gratuitas sin proPlan (a migrar):      ${r.aMigrar}`);
  if (aplicar) log(`Migradas ahora: ${r.migradas} · saltadas por cambiar mientras tanto: ${r.saltadas}`);
  else log('SIMULACRO: no se ha escrito nada. Vuelve a lanzarlo marcando «aplicar» para migrar.');
  return r;
}

module.exports = { migrar };

if (require.main === module) {
  const desdeFunctions = (m) => require(require.resolve(m, { paths: [path.join(__dirname, '..', 'functions')] }));
  const { initializeApp } = desdeFunctions('firebase-admin/app');
  const { getFirestore } = desdeFunctions('firebase-admin/firestore');
  initializeApp({ projectId: 'cadencia-11cb6' });
  migrar(getFirestore(), process.env.APLICAR === 'true').then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
}
