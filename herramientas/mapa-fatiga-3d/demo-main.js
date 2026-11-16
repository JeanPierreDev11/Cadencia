import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const NOM = { ne:'Cuello', sh:'Hombros', ch:'Pecho', bi:'Bíceps', fo:'Antebrazos', ab:'Abdomen y oblicuos', abd:'Abductores (cadera)', qu:'Cuádriceps', ad:'Aductores', ca:'Gemelos', tp:'Trapecio', mb:'Espalda media', la:'Dorsales', lb:'Lumbar', tr:'Tríceps', gl:'Glúteos', ha:'Isquiotibiales' };
const KEYS = ['none','ne','sh','ch','bi','fo','ab','abd','qu','ad','ca','tp','mb','la','lb','tr','gl','ha'];
// % de fatiga de ejemplo (0 = listo, 100 = muy fatigado)
const PRESETS = {
  'Día de pecho': { ch:85, sh:55, tr:60, ab:25, bi:15, tp:20 },
  'Día de pierna': { qu:90, ha:80, gl:75, ca:55, ad:50, abd:45, lb:35, ab:20 },
  'Día de espalda': { la:85, mb:75, tp:60, bi:65, fo:50, lb:45, sh:30 },
  'Todo fresco': {},
};
const colFat = (p) => { // verde → ámbar → rojo (los mismos colores de la app)
  const g = new T.Color('#3DDC84'), a = new T.Color('#FFB020'), r = new T.Color('#FF453A');
  return p < 50 ? g.clone().lerp(a, p / 50) : a.clone().lerp(r, (p - 50) / 50);
};

const cont = document.getElementById('v');
const R = new T.WebGLRenderer({ antialias: true, alpha: true });
R.setPixelRatio(Math.min(devicePixelRatio, 2));
cont.appendChild(R.domElement);
const S = new T.Scene();
const cam = new T.PerspectiveCamera(28, 1, .1, 50);
S.add(new T.HemisphereLight(0xffffff, 0x4a4a55, 2.3));
const dl = new T.DirectionalLight(0xffffff, 2.2); dl.position.set(1.5, 2.5, 3); S.add(dl);
const rim = new T.DirectionalLight(0xbfd4ff, 1.2); rim.position.set(-2, 1, -3); S.add(rim);

const cols = Array.from({ length: 18 }, () => new T.Color(0, 0, 0));
const mix = new Float32Array(18);
const uCol = { value: cols }, uMix = { value: mix }, uSel = { value: -1 };
let idData, idW = 2048;
const root = new T.Group(); S.add(root);
let body;

const texL = new T.TextureLoader();
const zon = texL.load('zonas.png');
zon.flipY = false; zon.magFilter = zon.minFilter = T.NearestFilter; zon.generateMipmaps = false;
const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = im.width; idW = im.width; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); idData = x.getImageData(0, 0, c.width, c.height).data; }; im.src = 'zonas.png';

fetch('cuerpo.txt').then((r) => r.text()).then((t) => { const bin = atob(t), ab = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) ab[i] = bin.charCodeAt(i); new GLTFLoader().parse(ab.buffer, '', (g) => {
  g.scene.traverse((o) => { if (o.isMesh) body = o; });
  const m = body.material;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tZ = { value: zon }; sh.uniforms.uCol = uCol; sh.uniforms.uMix = uMix; sh.uniforms.uSel = uSel;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vZ;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvZ = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vZ; uniform sampler2D tZ; uniform vec3 uCol[18]; uniform float uMix[18]; uniform float uSel;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        int zid = int(floor(texture2D(tZ, vZ).r * 255.0 + 0.5)) / 2;
        vec3 fc = uCol[zid]; float fm = uMix[zid];
        diffuseColor.rgb = mix(diffuseColor.rgb, fc, fm * 0.92);
        if (float(zid) == uSel) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.28);`);
  };
  m.roughness = .55;
  root.add(g.scene);
  const bb = new T.Box3().setFromObject(g.scene); g.scene.position.y = -(bb.min.y + bb.max.y) / 2;
  root.position.y = .1; resize(); aplicar('Día de pierna'); loop();
}); });

function aplicar(nombre) {
  const p = PRESETS[nombre]; estado = {};
  KEYS.forEach((k, i) => { const v = k === 'none' ? 0 : (p[k] || 0); estado[k] = v; mix[i] = k === 'none' ? 0 : 1; cols[i].copy(colFat(v)); });
  document.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b.dataset.n === nombre));
  sel(null);
}
let estado = {};
const info = document.getElementById('info');
function sel(k) {
  uSel.value = k ? KEYS.indexOf(k) : -1;
  if (!k) { info.innerHTML = '<span>Toca un músculo</span>'; return; }
  const v = estado[k], e = v < 34 ? 'Listo' : v < 67 ? 'Descansando' : 'Fatigado';
  info.innerHTML = `<b>${NOM[k]}</b><span><i style="background:#${colFat(v).getHexString()}"></i>${e} · ${Math.round(100 - v)} % recuperado</span>`;
}

// giro con el dedo + toque para elegir
let ry = 0, vel = 0, drag = false, moved = 0, lx = 0, auto = true;
const el = R.domElement;
el.style.touchAction = 'pan-y';
el.addEventListener('pointerdown', (e) => { drag = true; moved = 0; lx = e.clientX; vel = 0; auto = false; el.setPointerCapture(e.pointerId); });
el.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - lx; lx = e.clientX; moved += Math.abs(dx); ry += dx * .012; vel = dx * .012; });
el.addEventListener('pointerup', (e) => {
  drag = false;
  if (moved < 6 && body && idData) {
    const r = el.getBoundingClientRect();
    const ndc = new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const rc = new T.Raycaster(); rc.setFromCamera(ndc, cam);
    const h = rc.intersectObject(body, false)[0];
    if (h && h.uv) { const px = Math.min(idW - 1, Math.floor(h.uv.x * idW)), py = Math.min(idW - 1, Math.floor(h.uv.y * idW)); const id = idData[(py * idW + px) * 4]; const k = KEYS[id >> 1]; sel(k === 'none' || k === undefined ? null : k); }
    else sel(null);
  }
});
document.getElementById('cara').onclick = () => { ry = Math.round(ry / Math.PI) % 2 ? ry + Math.PI : ry + Math.PI; auto = false; };
const chips = document.getElementById('chips');
Object.keys(PRESETS).forEach((n) => { const b = document.createElement('button'); b.className = 'chip'; b.dataset.n = n; b.textContent = n; b.onclick = () => aplicar(n); chips.appendChild(b); });

function resize() {
  const w = cont.clientWidth, h = cont.clientHeight; R.setSize(w, h); cam.aspect = w / h;
  const need = 1.0 / Math.tan(T.MathUtils.degToRad(cam.fov / 2)) * 1.2; cam.position.set(0, 0, Math.max(need, need / cam.aspect * .52)); cam.updateProjectionMatrix();
}
addEventListener('resize', resize);
function loop() {
  if (!drag) { if (auto) ry += .004; else { ry += vel; vel *= .93; } }
  root.rotation.y = ry; R.render(S, cam); requestAnimationFrame(loop);
}
