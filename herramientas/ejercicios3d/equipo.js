// Equipamiento procedural para las ilustraciones de ejercicios. Todo se coloca a partir del cuerpo ya posado
// (agarres de las manos, hombros, codos…), así que sirve para cualquier modelo y cualquier pose.
import * as T from 'three';
const V = (x, y, z) => new T.Vector3(x, y, z), Y = V(0, 1, 0);
export const MAT = {
  acero: new T.MeshStandardMaterial({ color: 0xb9bec6, metalness: 0.85, roughness: 0.28 }),
  goma: new T.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.05, roughness: 0.7 }),
  tapiz: new T.MeshStandardMaterial({ color: 0x2b2c31, metalness: 0, roughness: 0.6 }),
  marco: new T.MeshStandardMaterial({ color: 0x7a808a, metalness: 0.55, roughness: 0.35 }),
  acento: new T.MeshStandardMaterial({ color: 0xf2be1a, metalness: 0.1, roughness: 0.45 }),
  cable: new T.MeshStandardMaterial({ color: 0x15161a, metalness: 0.3, roughness: 0.5 }),
  placa: new T.MeshStandardMaterial({ color: 0x4a4e56, metalness: 0.6, roughness: 0.32 }),
};
export const malla = (geo, mat, pos, quat) => { const o = new T.Mesh(geo, mat); if (pos) o.position.copy(pos); if (quat) o.quaternion.copy(quat); o.castShadow = o.receiveShadow = true; return o; };
// cilindro (o tubo) entre dos puntos
export function barra(a, b, r, mat, seg = 18) {
  const d = b.clone().sub(a), o = malla(new T.CylinderGeometry(r, r, d.length(), seg), mat);
  o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(Y, d.normalize()); return o;
}
// caja orientada con su eje Y entre dos puntos
export function caja(a, b, ancho, fondo, mat, ref = V(1, 0, 0)) {
  const d = b.clone().sub(a), L = d.length(); d.normalize();
  const x = ref.clone().sub(d.clone().multiplyScalar(ref.dot(d))).normalize(), z = new T.Vector3().crossVectors(x, d);
  const o = malla(new T.BoxGeometry(ancho, L, fondo), mat); o.position.copy(a).addScaledVector(d, L / 2);
  o.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, d, z)); return o;
}
const cajaEn = (c, s, mat) => malla(new T.BoxGeometry(...s), mat, V(...c));

// Mancuerna hexagonal con el mango en el puño
export function mancuerna(ag, { cabeza = 0.052, largoCabeza = 0.055, mango = 0.118 } = {}) {
  const g = new T.Group();
  g.add(malla(new T.CylinderGeometry(0.0155, 0.0155, mango + 0.02, 20), MAT.acero));
  for (const s of [-1, 1]) {
    const y = s * (mango / 2 + largoCabeza / 2);
    g.add(malla(new T.CylinderGeometry(cabeza, cabeza, largoCabeza, 6), MAT.goma, V(0, y, 0)));
    g.add(malla(new T.CylinderGeometry(cabeza * 0.42, cabeza * 0.42, largoCabeza + 0.006, 20), MAT.acero, V(0, y, 0)));
    g.add(malla(new T.CylinderGeometry(0.024, 0.024, 0.008, 20), MAT.acero, V(0, s * (mango / 2 + 0.002), 0)));
  }
  g.position.copy(ag.centro); g.quaternion.setFromUnitVectors(Y, ag.eje); return g;
}

// Polea baja: torre con columna, carro, polea, cable y estribo (mango en D) en la mano
export function polea(ag, { torre, alturaPolea = 0.12, suelo }) {
  const g = new T.Group(), base = V(torre[0], suelo, torre[1]), alta = new T.Group(); alta.userData.sinEncuadre = true; g.add(alta);
  const pol = V(torre[0] + 0.05 * Math.sign(-torre[0] || 1), suelo + alturaPolea, torre[1] + 0.2);
  g.add(cajaEn([base.x, suelo + 0.015, base.z], [0.42, 0.03, 0.42], MAT.marco));
  alta.add(cajaEn([base.x, suelo + 1.1, base.z - 0.1], [0.08, 2.2, 0.08], MAT.marco));
  alta.add(cajaEn([base.x, suelo + 1.1, base.z + 0.1], [0.08, 2.2, 0.08], MAT.marco));
  alta.add(cajaEn([base.x, suelo + 2.2, base.z], [0.12, 0.06, 0.34], MAT.marco));
  // pila de placas entre las dos columnas
  for (let k = 0; k < 14; k++) g.add(cajaEn([base.x, suelo + 0.1 + k * 0.046, base.z], [0.08, 0.04, 0.12], k === 7 ? MAT.acento : MAT.placa));
  alta.add(barra(V(base.x, suelo + 0.1, base.z), V(base.x, suelo + 2.0, base.z), 0.006, MAT.acero));
  // carro y polea
  g.add(cajaEn([base.x, pol.y + 0.03, (base.z + pol.z) / 2 + 0.02], [0.06, 0.07, pol.z - base.z + 0.04], MAT.acero));
  const rueda = malla(new T.CylinderGeometry(0.055, 0.055, 0.028, 32), MAT.goma, pol); rueda.rotation.x = Math.PI / 2; g.add(rueda);
  const buje = malla(new T.CylinderGeometry(0.02, 0.02, 0.034, 16), MAT.acento, pol); buje.rotation.x = Math.PI / 2; g.add(buje);
  // estribo: mango en el puño, dos brazos que convergen en la anilla, hacia la polea
  const haciaPol = pol.clone().sub(ag.centro).normalize();
  const lado = new T.Vector3().crossVectors(ag.eje, haciaPol).normalize();
  const fuera = haciaPol.clone().sub(ag.eje.clone().multiplyScalar(haciaPol.dot(ag.eje))).normalize();
  const anilla = ag.centro.clone().addScaledVector(fuera, 0.085);
  g.add(barra(ag.centro.clone().addScaledVector(ag.eje, -0.065), ag.centro.clone().addScaledVector(ag.eje, 0.065), 0.016, MAT.goma));
  for (const s of [-1, 1]) {
    const e = ag.centro.clone().addScaledVector(ag.eje, s * 0.07);
    g.add(barra(e, e.clone().addScaledVector(fuera, 0.03), 0.006, MAT.acero));
    g.add(barra(e.clone().addScaledVector(fuera, 0.03), anilla, 0.006, MAT.acero));
  }
  g.add(malla(new T.SphereGeometry(0.011, 12, 8), MAT.acero, anilla));
  g.add(barra(anilla, pol.clone().addScaledVector(lado, 0).add(V(0, 0.045 * Math.sign(anilla.y - pol.y), 0)), 0.0045, MAT.cable));
  return g;
}

// Máquina de elevaciones laterales sentado: asiento, respaldo, ejes a la altura de los hombros,
// palancas con rodillo por fuera del codo y empuñadura delante. Las palancas siguen al brazo posado.
export function maquinaLaterales(c, { suelo, asiento }) {
  const g = new T.Group(), E = c.estado.cab;
  const hR = E['upper_arm.R'], hL = E['upper_arm.L'];
  const zEje = Math.min(hR.z, hL.z) - 0.2, yEje = (hR.y + hL.y) / 2;
  const espalda = Math.min(E['chest'].z, E['spine'].z) - 0.12;
  // estructura
  g.add(cajaEn([0, suelo + 0.02, -0.12], [0.62, 0.04, 0.95], MAT.marco));
  g.add(cajaEn([0, (suelo + asiento) / 2, -0.05], [0.09, asiento - suelo, 0.09], MAT.marco));
  g.add(cajaEn([0, asiento - 0.045, 0.02], [0.4, 0.07, 0.42], MAT.tapiz));
  { const y0 = asiento + 0.03, y1 = yEje - 0.08; g.add(cajaEn([0, (y0 + y1) / 2, espalda - 0.04], [0.32, y1 - y0, 0.075], MAT.tapiz)); }
  g.add(cajaEn([0, (suelo + yEje + 0.25) / 2, zEje - 0.06], [0.08, yEje + 0.25 - suelo, 0.08], MAT.marco));
  g.add(cajaEn([0, yEje + 0.22, zEje - 0.02], [Math.abs(hR.x - hL.x) + 0.12, 0.07, 0.07], MAT.marco));
  // pila de placas detrás
  const zp = zEje - 0.32;
  g.add(cajaEn([0, (suelo + yEje + 0.3) / 2, zp - 0.13], [0.36, yEje + 0.3 - suelo, 0.06], MAT.marco));
  for (let k = 0; k < 13; k++) g.add(cajaEn([0, suelo + 0.1 + k * 0.05, zp], [0.3, 0.044, 0.16], k === 5 ? MAT.acento : MAT.placa));
  for (const l of ['R', 'L']) {
    const s = l === 'R' ? 1 : -1, H = E['upper_arm.' + l], C = E['forearm.' + l];
    const eje = V(H.x, yEje, zEje);
    g.add(barra(V(H.x, yEje + 0.22, zEje - 0.02), eje, 0.03, MAT.marco));
    const cub = malla(new T.CylinderGeometry(0.05, 0.05, 0.07, 28), MAT.acero, eje); cub.rotation.x = Math.PI / 2; g.add(cub);
    const brazo = C.clone().sub(H).normalize();
    const fuera = V(-brazo.y * s, brazo.x * s, 0).normalize(); // perpendicular al brazo en el plano frontal, hacia fuera
    const rod = C.clone().addScaledVector(brazo, -0.075).addScaledVector(fuera, 0.075);
    const atras = V(rod.x, rod.y, zEje);
    g.add(caja(eje, atras, 0.05, 0.05, MAT.acento, V(0, 0, 1)));
    g.add(barra(atras, rod.clone().add(V(0, 0, -0.05)), 0.022, MAT.acento));
    g.add(barra(rod.clone().addScaledVector(brazo, -0.08), rod.clone().addScaledVector(brazo, 0.08), 0.042, MAT.tapiz, 24));
    const ag = c.agarre(l);
    const ext = ag.centro.clone().addScaledVector(ag.eje, -0.08);
    g.add(barra(rod.clone().add(V(0, 0, 0.04)), ext, 0.014, MAT.acero));
    g.add(barra(ag.centro.clone().addScaledVector(ag.eje, -0.075), ag.centro.clone().addScaledVector(ag.eje, 0.07), 0.017, MAT.goma));
  }
  return g;
}

// Sombra de contacto suave en el suelo
export function sombra(cx, cz, rx, rz, y) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
  const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const tx = new T.CanvasTexture(cv);
  const o = new T.Mesh(new T.PlaneGeometry(rx * 2, rz * 2), new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false }));
  o.rotation.x = -Math.PI / 2; o.position.set(cx, y + 0.002, cz); return o;
}
