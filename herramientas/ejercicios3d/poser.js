// Poser: aplica poses anatómicas (en grados) a un cuerpo con esqueleto, igual para cualquier modelo.
// Cada hueso tiene un marco de reposo (del modelo) y un marco "neutro canónico" (de pie, brazos colgando,
// palmas hacia el muslo, dedos estirados). Las poses se expresan respecto al neutro, así que el mismo
// ejercicio sirve para el modelo de hombre y el de mujer aunque estén en reposo de forma distinta.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const V = (x, y, z) => new T.Vector3(x, y, z), D = Math.PI / 180;
const ladoDe = (n) => (n.endsWith('.R') ? 'R' : n.endsWith('.L') ? 'L' : '');
function marco(Y, ref) {
  Y = Y.clone().normalize();
  const X = ref.clone().sub(Y.clone().multiplyScalar(ref.dot(Y))).normalize();
  const Z = new T.Vector3().crossVectors(X, Y);
  return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z));
}
const rot = (eje, g) => new T.Quaternion().setFromAxisAngle(eje, g * D);
const X1 = V(1, 0, 0), Y1 = V(0, 1, 0), Z1 = V(0, 0, 1);
const MANO = /^(hand|f_|thumb)/;
const CANON = { upper_arm: 'abajo', forearm: 'abajo', hand: 'abajo', thigh: 'abajo', shin: 'abajo', foot: 'pie', f_index: 'abajo', f_middle: 'abajo', f_ring: 'abajo', f_pinky: 'abajo' };
const base = (n) => n.replace(/\.(R|L)$/, '').replace(/\.0\d$/, '');

export async function cargarCuerpo(url) {
  const [gltf, J] = await Promise.all([
    new Promise((ok, mal) => new GLTFLoader().load(url + '.glb', ok, undefined, mal)),
    fetch(url + '.json').then((r) => r.json()),
  ]);
  let malla; gltf.scene.traverse((o) => { if (o.isSkinnedMesh) malla = o; });
  gltf.scene.updateMatrixWorld(true);
  const sk = malla.skeleton, P = (k) => V(...J.joints[k]);
  const H = {}; J.bones.forEach((b) => (H[b.n] = b));
  const orden = J.bones.map((b) => b.n);
  // GLTFLoader quita los puntos de los nombres (upper_arm.R → upper_armR)
  const limpio = (n) => T.PropertyBinding.sanitizeNodeName(n);
  const porNombre = Object.fromEntries(sk.bones.map((b, i) => [b.name, i]));
  const hueso = {}, restMundo = {};
  for (const n of J.bones.map((b) => b.n)) { const i = porNombre[limpio(n)]; if (i == null) continue; hueso[n] = sk.bones[i]; restMundo[n] = sk.boneInverses[i].clone().invert(); }
  // referencia de giro de cada hueso: línea de nudillos (meñique→índice) en la mano; eje lateral en el resto
  const nudillos = (l) => P('f_index_mcp.' + l).sub(P('f_pinky_mcp.' + l)).normalize();
  const refDe = (n) => (MANO.test(n) ? nudillos(ladoDe(n)) : base(n) === 'shoulder' ? Y1.clone() : X1.clone());
  const R = {}, N = {}, cab = {}, dirR = {};
  for (const n of orden) {
    const b = H[n]; cab[n] = P(b.h); dirR[n] = P(b.t).sub(P(b.h));
    R[n] = marco(dirR[n], refDe(n));
  }
  const padreOr = (n) => (base(n) === 'upper_arm' ? 'upper_chest' : H[n].p);
  for (const n of orden) {
    const c = CANON[base(n)], p = padreOr(n);
    if (c === 'abajo') N[n] = marco(V(0, -1, 0), MANO.test(n) ? Z1.clone() : X1.clone());
    else if (c === 'pie') { const d = dirR[n].clone(), h = Math.hypot(d.x, d.z), s = ladoDe(n) === 'L' ? -1 : 1; N[n] = marco(V(s * Math.sin(8 * D) * h, d.y, Math.cos(8 * D) * h), X1.clone()); }
    else N[n] = p ? N[p].clone().multiply(R[p].clone().invert()).multiply(R[n]) : R[n].clone();
  }
  sk.bones.forEach((b) => { b.matrixAutoUpdate = false; });
  const estado = { W: {}, Dl: {}, cab: {} };

  function fk(local, rq, rp, piesPlanos) {
    for (const n of orden) {
      const p = padreOr(n); let q = local[n] || new T.Quaternion();
      const base0 = p ? estado.W[p].clone().multiply(N[p].clone().invert()).multiply(N[n]) : rq.clone().multiply(N[n]);
      // pies planos: el pie conserva su orientación neutra respecto al suelo, sea cual sea la pierna
      if (piesPlanos && /^foot\./.test(n)) q = base0.clone().invert().multiply(rq.clone().multiply(N[n])).multiply(q);
      const W = base0.multiply(q);
      estado.W[n] = W; estado.Dl[n] = W.clone().multiply(R[n].clone().invert());
      const sp = H[n].p;
      estado.cab[n] = sp ? estado.cab[sp].clone().add(cab[n].clone().sub(cab[sp]).applyQuaternion(estado.Dl[sp])) : cab[n].clone().add(rp);
    }
  }
  function posar(local = {}, raiz = {}) {
    // local: { hueso: Quaternion } rotaciones respecto al neutro
    // raiz: { pos:[x,y,z], rot:[x,y,z] grados, plantar: true (los pies no se mueven en el suelo), piesPlanos: true }
    const rq = new T.Quaternion().setFromEuler(new T.Euler(...(raiz.rot || [0, 0, 0]).map((g) => g * D), 'YXZ'));
    const rp = V(...(raiz.pos || [0, 0, 0]));
    fk(local, rq, rp, raiz.piesPlanos);
    if (raiz.plantar) {
      const medio = () => ['R', 'L'].map((l) => estado.cab['toe.' + l].clone().add(estado.cab['foot.' + l]).multiplyScalar(0.5)).reduce((a, b) => a.add(b)).multiplyScalar(0.5);
      const ahora = medio(), antes = ['R', 'L'].map((l) => cab['toe.' + l].clone().add(cab['foot.' + l]).multiplyScalar(0.5)).reduce((a, b) => a.add(b)).multiplyScalar(0.5);
      rp.x += antes.x - ahora.x; rp.z += antes.z - ahora.z;
      fk(local, rq, rp, raiz.piesPlanos);
    }
    const Mm = {};
    for (const n of orden) {
      const b = hueso[n]; if (!b) continue;
      const m = Mm[n] = new T.Matrix4().makeTranslation(estado.cab[n].x, estado.cab[n].y, estado.cab[n].z)
        .multiply(new T.Matrix4().makeRotationFromQuaternion(estado.Dl[n]))
        .multiply(new T.Matrix4().makeTranslation(-cab[n].x, -cab[n].y, -cab[n].z))
        .multiply(restMundo[n]);
    }
    // matrices locales (relativas al hueso padre) para que cualquier transformación de la escena se respete
    for (const n of orden) {
      const b = hueso[n]; if (!b) continue;
      const pb = b.parent && b.parent.isBone ? Object.keys(hueso).find((k) => hueso[k] === b.parent) : null;
      b.matrix.copy(pb ? Mm[pb].clone().invert().multiply(Mm[n]) : Mm[n]);
      b.matrixWorldNeedsUpdate = true;
    }
    gltf.scene.updateMatrixWorld(true);
  }
  // posición final de un punto de reposo que se mueve con un hueso
  const punto = (n, pRest) => estado.cab[n].clone().add(pRest.clone().sub(cab[n]).applyQuaternion(estado.Dl[n]));
  const junta = (k, n) => punto(n, P(k));
  // agarre: centro del puño y eje del mango (meñique→índice) ya posados
  function agarre(l) {
    const fs = ['index', 'middle', 'ring', 'pinky'];
    const pts = [];
    for (const f of fs) { pts.push(junta(`f_${f}_pip.${l}`, `f_${f}.01.${l}`), junta(`f_${f}_dip.${l}`, `f_${f}.02.${l}`), junta(`f_${f}_tip.${l}`, `f_${f}.03.${l}`), junta(`f_${f}_mcp.${l}`, `hand.${l}`)); }
    const c = pts.reduce((a, p) => a.add(p), V(0, 0, 0)).multiplyScalar(1 / pts.length);
    const eje = junta(`f_index_mcp.${l}`, `hand.${l}`).sub(junta(`f_pinky_mcp.${l}`, `hand.${l}`)).normalize();
    return { centro: c, eje, marcoMano: estado.W['hand.' + l].clone() };
  }
  return { escena: gltf.scene, malla, J, posar, punto, junta, agarre, estado, N, R, ladoDe, alto: () => J.joints.head_top[1] };
}

// ---- Traducción de una pose anatómica (grados) a rotaciones locales ----
// hombro: { elev, plano, rot }  elev 0 = colgando, 90 = horizontal; plano 0 = lateral, 90 = al frente
// codo: { flex, pron }  muneca: { flex, desv }  mano: 'agarre' | 'abierta' | 'relajada' | { mcp, pip, dip, pulgar }
// cadera: { flex, abd, rot }  rodilla: { flex }  tobillo: { flex }  tronco: { flex, lat, rot }  cuello: { flex, lat, rot }
const MANOS = {
  abierta: { mcp: 0, pip: 0, dip: 0, pulgar: 0, sep: 4 },
  relajada: { mcp: 12, pip: 18, dip: 10, pulgar: 10, sep: 2 },
  agarre: { mcp: 62, pip: 88, dip: 48, pulgar: 45, sep: 0 },
  apoyo: { mcp: -8, pip: 4, dip: 2, pulgar: 0, sep: 6 },
};
export function poseLocal(c, pose) {
  const q = {};
  const mul = (n, r) => { if (!c.N[n]) return; q[n] = (q[n] || new T.Quaternion()).multiply(r); };
  const espejo = (v, l) => (v == null ? null : typeof v === 'object' && !Array.isArray(v) && (v.R || v.L) ? v[l] ?? v.R : v);
  for (const l of ['R', 'L']) {
    const s = l === 'R' ? 1 : -1;
    const h = espejo(pose.hombro, l) || { elev: 8, plano: 0 };
    const e = (h.elev ?? 8) * D, f = (h.plano ?? 0) * D;
    // dirección del brazo en el marco del tórax (x lateral de ese lado, y arriba, z al frente)
    const d = V(s * Math.sin(e) * Math.cos(f), -Math.cos(e), Math.sin(e) * Math.sin(f));
    // mundo: la dirección se da respecto al suelo (p. ej. brazos colgando con el tronco inclinado), no respecto al tórax
    if (h.mundo) d.applyAxisAngle(X1, -((pose.pelvis?.flex ?? 0) + (pose.tronco?.flex ?? 0)) * D);
    // en el marco neutro del brazo: Y local = abajo, X local = +x mundo, Z local = -z mundo
    const dl = V(d.x, -d.y, -d.z);
    const sw = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), dl.normalize());
    mul('upper_arm.' + l, sw.multiply(rot(Y1, s * (h.rot ?? 0))));
    // ritmo escapulohumeral: la clavícula sube al pasar de 30° (≈1/3 del exceso)
    const el = Math.max(0, (h.elev ?? 8) - 30) * (h.ritmo ?? 0.28);
    mul('shoulder.' + l, rot(Z1, s * el));
    const co = espejo(pose.codo, l) || {};
    mul('forearm.' + l, rot(X1, -(co.flex ?? 5)).multiply(rot(Y1, -s * (co.pron ?? 0) * 0.5)));
    const mu = espejo(pose.muneca, l) || {};
    mul('hand.' + l, rot(Y1, -s * (co.pron ?? 0) * 0.5).multiply(rot(X1, -s * (mu.flex ?? 0))).multiply(rot(Z1, mu.desv ?? 0)));
    let m = espejo(pose.mano, l) ?? 'relajada'; if (typeof m === 'string') m = MANOS[m];
    const fs = ['index', 'middle', 'ring', 'pinky'];
    fs.forEach((f, i) => {
      const sep = (m.sep ?? 0) * (i - 1.5);
      mul(`f_${f}.01.${l}`, rot(Z1, -s * sep).multiply(rot(X1, -s * (m.mcp * (1 + (i - 1.5) * 0.06)))));
      mul(`f_${f}.02.${l}`, rot(X1, -s * m.pip));
      mul(`f_${f}.03.${l}`, rot(X1, -s * m.dip));
    });
    const ej = X1, sg = 1;
    mul('thumb.01.' + l, rot(ej, sg * s * m.pulgar * 0.6)); mul('thumb.02.' + l, rot(X1, -s * m.pulgar * 0.5)); mul('thumb.03.' + l, rot(X1, -s * m.pulgar * 0.6));
    const ca = espejo(pose.cadera, l) || {};
    mul('thigh.' + l, rot(X1, -(ca.flex ?? 0)).multiply(rot(Z1, -s * (ca.abd ?? 3))).multiply(rot(Y1, s * (ca.rot ?? 0))));
    const ro = espejo(pose.rodilla, l) || {};
    mul('shin.' + l, rot(X1, ro.flex ?? 0));
    const to = espejo(pose.tobillo, l) || {};
    mul('foot.' + l, rot(X1, -(to.flex ?? 0)));
  }
  const tr = pose.tronco || {};
  [['spine', 0.4], ['chest', 0.35], ['upper_chest', 0.25]].forEach(([n, k]) => mul(n, rot(X1, (tr.flex ?? 0) * k).multiply(rot(Z1, -(tr.lat ?? 0) * k)).multiply(rot(Y1, -(tr.rot ?? 0) * k))));
  const cu = pose.cuello || {};
  mul('neck', rot(X1, (cu.flex ?? 0) * 0.6).multiply(rot(Z1, -(cu.lat ?? 0) * 0.6)).multiply(rot(Y1, -(cu.rot ?? 0) * 0.6)));
  mul('head', rot(X1, (cu.flex ?? 0) * 0.4).multiply(rot(Z1, -(cu.lat ?? 0) * 0.4)).multiply(rot(Y1, -(cu.rot ?? 0) * 0.4)));
  if (pose.pelvis) mul('hips', rot(X1, pose.pelvis.flex ?? 0));
  return q;
}
