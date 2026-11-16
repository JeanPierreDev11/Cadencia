// Cuerpo 3D de Cadencia (se carga SOLO al abrir Recuperación muscular; incluye three.js, por eso vive en vendor/ y no se ofusca).
// Un modelo por sexo (public/models/hombre-1.glb y mujer-1.glb) con una textura de zonas (zonas-*.png): cada píxel dice a qué músculo
// pertenece (id = índice del músculo × 2 + lado). El sombreador mezcla el color de cada músculo con la piel gris.
import { WebGLRenderer, Scene, Group, PerspectiveCamera, OrthographicCamera, HemisphereLight, DirectionalLight, Color, Texture, Box3, Raycaster, Vector2, NearestFilter, MathUtils } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Mismo orden que el mapa de zonas (no cambiar sin regenerar zonas-*.png).
export const CLAVES = ['none', 'ne', 'sh', 'ch', 'bi', 'fo', 'ab', 'abd', 'qu', 'ad', 'ca', 'tp', 'mb', 'la', 'lb', 'tr', 'gl', 'ha'];
const BASE = '/models/';
const ARCHIVOS = { hombre: ['hombre-1.glb', 'zonas-hombre-1.png'], mujer: ['mujer-1.glb', 'zonas-mujer-1.png'] };

const escena = new Scene();
escena.add(new HemisphereLight(0xffffff, 0x4a4a55, 2.3));
const luz = new DirectionalLight(0xffffff, 2.2); luz.position.set(1.5, 2.5, 3); escena.add(luz);
const contra = new DirectionalLight(0xbfd4ff, 1.2); contra.position.set(-2, 1, -3); escena.add(contra);

const cargados = [];
const cuerpos = {}; // sexo → Promise<{ raiz, malla, u, datos, ancho }>
function cargarImagen(url) {
  return new Promise((ok, mal) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => mal(new Error('zonas')); im.src = url; });
}
export function cargar(sexo) {
  sexo = sexo === 'mujer' ? 'mujer' : 'hombre';
  if (cuerpos[sexo]) return cuerpos[sexo];
  const [glb, zon] = ARCHIVOS[sexo];
  cuerpos[sexo] = (async () => {
    const [gltf, im] = await Promise.all([
      new Promise((ok, mal) => new GLTFLoader().load(BASE + glb, ok, undefined, mal)),
      cargarImagen(BASE + zon),
    ]);
    let malla = null;
    gltf.scene.traverse((o) => { if (o.isMesh) malla = o; });
    if (!malla) throw new Error('modelo');
    const c = document.createElement('canvas'); c.width = c.height = im.width;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
    const datos = x.getImageData(0, 0, c.width, c.height).data;
    const tex = new Texture(im); tex.flipY = false; tex.magFilter = tex.minFilter = NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
    const u = { tZ: { value: tex }, uCol: { value: Array.from({ length: 18 }, () => new Color(0, 0, 0)) }, uMix: { value: new Float32Array(18) }, uSel: { value: -1 } };
    const m = malla.material;
    m.roughness = 0.55;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vZ;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvZ = uv;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vZ; uniform sampler2D tZ; uniform vec3 uCol[18]; uniform float uMix[18]; uniform float uSel;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          int zid = int(floor(texture2D(tZ, vZ).r * 255.0 + 0.5)) / 2;
          vec3 fc = uCol[zid]; float fm = uMix[zid];
          diffuseColor.rgb = mix(diffuseColor.rgb, fc, fm);
          if (float(zid) == uSel) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.3);`);
    };
    const raiz = new Group(); raiz.add(gltf.scene);
    const bb = new Box3().setFromObject(gltf.scene); gltf.scene.position.y = -(bb.min.y + bb.max.y) / 2;
    raiz.visible = false; escena.add(raiz);
    const o = { raiz, malla, u, datos, ancho: c.width }; cargados.push(o);
    return o;
  })();
  cuerpos[sexo].catch(() => { delete cuerpos[sexo]; });
  return cuerpos[sexo];
}

// colores: { clave: ['#RRGGBB', opacidad 0‑1] }; lo que no está queda con la piel.
function pintar(c, colores, sel) {
  const { uCol, uMix } = c.u;
  CLAVES.forEach((k, i) => {
    const v = k === 'none' ? null : colores[k];
    uMix.value[i] = v ? Math.max(0, Math.min(1, v[1] == null ? 1 : v[1])) : 0;
    if (v) uCol.value[i].set(v[0]);
  });
  c.u.uSel.value = sel ? CLAVES.indexOf(sel) : -1;
}
function mostrar(c) { cargados.forEach((o) => { o.raiz.visible = o === c; }); }

// ── Imagen fija de frente o de espalda (se enseña por defecto) ──
let fijo = null;
export async function foto(sexo, colores, lado, ancho = 480, alto = 960) {
  const c = await cargar(sexo);
  if (!fijo) {
    const r = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    fijo = { r, cam: new OrthographicCamera(-0.515, 0.515, 1.03, -1.03, 0.1, 20) };
    fijo.cam.position.set(0, 0, 6); r.setClearColor(0x000000, 0);
  }
  fijo.r.setPixelRatio(1); fijo.r.setSize(ancho, alto, false);
  mostrar(c); pintar(c, colores, null);
  c.raiz.rotation.y = lado === 'back' ? Math.PI : 0;
  fijo.r.render(escena, fijo.cam);
  const dos = document.createElement('canvas'); dos.width = ancho; dos.height = alto;
  dos.getContext('2d').drawImage(fijo.r.domElement, 0, 0);
  return new Promise((ok) => dos.toBlob((b) => ok(b ? URL.createObjectURL(b) : ''), 'image/png'));
}

// ── Visor giratorio ──
export async function visor(el, sexo, colores, { onElegir } = {}) {
  const c = await cargar(sexo);
  const r = new WebGLRenderer({ antialias: true, alpha: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.setClearColor(0x000000, 0);
  const cam = new PerspectiveCamera(28, 1, 0.1, 50);
  const cv = r.domElement; cv.className = 'c3-canvas'; cv.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
  el.appendChild(cv);
  let sel = null, giro = 0, vel = 0, arrastra = false, movido = 0, ultimo = 0, auto = !matchMedia('(prefers-reduced-motion: reduce)').matches, destino = null, vivo = true, cols = colores;
  const ajustar = () => {
    const w = el.clientWidth || 1, h = el.clientHeight || 1; r.setSize(w, h, false); cam.aspect = w / h;
    const t = Math.tan(MathUtils.degToRad(cam.fov / 2));
    cam.position.set(0, 0, Math.max(1.08 / t, 0.56 / (cam.aspect * t))); cam.updateProjectionMatrix();
  };
  ajustar();
  const ro = new ResizeObserver(ajustar); ro.observe(el);
  const dibujar = () => {
    if (!vivo) return;
    if (destino != null) { const d = destino - giro; if (Math.abs(d) < 0.01) { giro = destino; destino = null; } else giro += d * 0.14; }
    else if (!arrastra) { if (auto) giro += 0.004; else { giro += vel; vel *= 0.93; } }
    mostrar(c); pintar(c, cols, sel);
    c.raiz.rotation.y = giro; r.render(escena, cam);
    requestAnimationFrame(dibujar);
  };
  requestAnimationFrame(dibujar);
  const elegir = (k) => { sel = k; if (onElegir) onElegir(k); };
  cv.addEventListener('pointerdown', (e) => { arrastra = true; movido = 0; ultimo = e.clientX; vel = 0; auto = false; destino = null; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
  cv.addEventListener('pointermove', (e) => { if (!arrastra) return; const dx = e.clientX - ultimo; ultimo = e.clientX; movido += Math.abs(dx); giro += dx * 0.012; vel = dx * 0.012; });
  const soltar = (e) => {
    if (!arrastra) return; arrastra = false; cv.style.cursor = 'grab';
    if (movido >= 6 || e.type === 'pointercancel') return;
    mostrar(c); c.raiz.rotation.y = giro; c.raiz.updateMatrixWorld(true);
    const b = cv.getBoundingClientRect(), rc = new Raycaster();
    rc.setFromCamera(new Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1), cam);
    const h = rc.intersectObject(c.malla, false)[0];
    if (!h || !h.uv) return elegir(null);
    const px = Math.min(c.ancho - 1, Math.floor(h.uv.x * c.ancho)), py = Math.min(c.ancho - 1, Math.floor(h.uv.y * c.ancho));
    const k = CLAVES[c.datos[(py * c.ancho + px) * 4] >> 1];
    elegir(!k || k === 'none' ? null : k);
  };
  cv.addEventListener('pointerup', soltar); cv.addEventListener('pointercancel', soltar);
  return {
    actualizar(nuevos) { cols = nuevos; },
    elegir,
    girarA(lado) { auto = false; const vuelta = Math.round(giro / (2 * Math.PI)); destino = vuelta * 2 * Math.PI + (lado === 'back' ? Math.PI : 0); if (Math.abs(destino - giro) > Math.PI) destino += destino < giro ? 2 * Math.PI : -2 * Math.PI; },
    destruir() { vivo = false; ro.disconnect(); r.dispose(); try { r.forceContextLoss(); } catch (e) { /* ya perdido */ } cv.remove(); },
  };
}
