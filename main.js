import * as THREE from 'three';

/* ================================================================
   EVERYWHEN — a fintech landscape you travel through.
   Everything is procedural: no model files, no textures on disk.
   ================================================================ */

/* ---------------- math helpers ---------------- */

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const bell = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (w * w));

function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const h = (a, b) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  return h(xi, zi) * (1 - u) * (1 - v) + h(xi + 1, zi) * u * (1 - v) +
         h(xi, zi + 1) * (1 - u) * v + h(xi + 1, zi + 1) * u * v;
}

function fbm(x, z) {
  let amp = 0.5, freq = 1, sum = 0;
  for (let i = 0; i < 5; i++) {
    sum += amp * vnoise(x * freq, z * freq);
    freq *= 2; amp *= 0.5;
  }
  return sum;
}

/* The valley's winding centerline — camera, river and terrain all follow it. */
const pathX = (z) => Math.sin(z * 0.011) * 30 + Math.sin(z * 0.0042 + 1.7) * 22;

/* Terrain height field. */
function terrainH(x, z) {
  const d = Math.abs(x - pathX(z));
  const valley = sstep(10, 75, d);
  const mountains = Math.pow(fbm(x * 0.013 + 7.3, z * 0.013), 1.6) * 110 * valley;
  const floor = fbm(x * 0.06, z * 0.06) * 2.5;
  const rim = sstep(190, 300, Math.abs(x)) * 50;
  return floor + mountains + rim;
}

/* ---------------- renderer / scene ---------------- */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb288a8, 70, 460);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);

const uTime = { value: 0 };

/* ---------------- mood system (palette per chapter) ---------------- */

const MOODS = [
  { p: 0.00, top: '#241a4f', mid: '#8f4f8f', low: '#ffb287', fog: '#b288a8', fogFar: 460,
    sun: '#ffd9a8', hemiS: '#8f7fd8', hemiG: '#241a3d', dir: '#ffb88f', dirI: 1.1, stars: 0.15 },
  { p: 0.24, top: '#173a52', mid: '#2f8a78', low: '#ffe2a8', fog: '#8fc3ae', fogFar: 470,
    sun: '#fff2c8', hemiS: '#9fd8c8', hemiG: '#1c3030', dir: '#ffe9b8', dirI: 1.2, stars: 0.0 },
  { p: 0.47, top: '#070d2b', mid: '#15295e', low: '#3a5fa8', fog: '#233a6e', fogFar: 380,
    sun: '#bfe2ff', hemiS: '#4a6abf', hemiG: '#0c1228', dir: '#9fc4ff', dirI: 0.9, stars: 1.0 },
  { p: 0.70, top: '#0d0726', mid: '#34185e', low: '#7a4898', fog: '#3a2a60', fogFar: 360,
    sun: '#cfa8ff', hemiS: '#6a4fbf', hemiG: '#120c28', dir: '#b89fff', dirI: 0.95, stars: 0.8 },
  { p: 0.92, top: '#4f7ec8', mid: '#ff9e5e', low: '#ffe5b0', fog: '#f2b88a', fogFar: 760,
    sun: '#fff6d8', hemiS: '#cfe2ff', hemiG: '#5e4a3a', dir: '#ffd9a0', dirI: 1.4, stars: 0.0 },
];
MOODS.forEach((m) => {
  for (const k of ['top', 'mid', 'low', 'fog', 'sun', 'hemiS', 'hemiG', 'dir']) {
    m[k] = new THREE.Color(m[k]);
  }
});

const moodNow = {
  top: new THREE.Color(), mid: new THREE.Color(), low: new THREE.Color(),
  fog: new THREE.Color(), sun: new THREE.Color(), hemiS: new THREE.Color(),
  hemiG: new THREE.Color(), dir: new THREE.Color(), dirI: 1, stars: 0, fogFar: 460,
};

function sampleMood(p) {
  let a = MOODS[0], b = MOODS[0], t = 0;
  for (let i = 0; i < MOODS.length - 1; i++) {
    if (p >= MOODS[i].p) {
      a = MOODS[i]; b = MOODS[i + 1];
      t = sstep(a.p, b.p, p);
    }
  }
  if (p >= MOODS[MOODS.length - 1].p) { a = b = MOODS[MOODS.length - 1]; t = 0; }
  for (const k of ['top', 'mid', 'low', 'fog', 'sun', 'hemiS', 'hemiG', 'dir']) {
    moodNow[k].lerpColors(a[k], b[k], t);
  }
  moodNow.dirI = lerp(a.dirI, b.dirI, t);
  moodNow.stars = lerp(a.stars, b.stars, t);
  moodNow.fogFar = lerp(a.fogFar, b.fogFar, t);
}

/* ---------------- lights ---------------- */

const hemi = new THREE.HemisphereLight(0x8f7fd8, 0x241a3d, 0.75);
scene.add(hemi);

const sunLight = new THREE.DirectionalLight(0xffb88f, 1.25);
sunLight.position.set(30, 80, -160);
scene.add(sunLight);

/* ---------------- sky ---------------- */

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    uTop: { value: moodNow.top }, uMid: { value: moodNow.mid }, uLow: { value: moodNow.low },
    uSunDir: { value: new THREE.Vector3(0, 0.1, -1) },
    uSunColor: { value: moodNow.sun },
    uStars: { value: 0 },
    uTime: uTime,
  },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow;
    uniform vec3 uSunDir; uniform vec3 uSunColor;
    uniform float uStars; uniform float uTime;
    varying vec3 vDir;
    void main() {
      float h = vDir.y;
      vec3 col = mix(uLow, uMid, smoothstep(-0.08, 0.16, h));
      col = mix(col, uTop, smoothstep(0.16, 0.55, h));
      float d = max(dot(vDir, normalize(uSunDir)), 0.0);
      col += uSunColor * (pow(d, 60.0) * 1.1 + pow(d, 8.0) * 0.22);
      float sh = fract(sin(dot(floor(vDir * 230.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      float star = smoothstep(0.9975, 1.0, sh) * uStars * smoothstep(0.04, 0.25, h);
      col += vec3(0.8, 0.9, 1.0) * star * (0.5 + 0.5 * sin(uTime * 3.0 + sh * 40.0));
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat);
sky.renderOrder = -1;
scene.add(sky);

/* ---------------- canvas texture helpers ---------------- */

function radialTexture(stops, size = 256) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cv);
}

function cloudTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const ctx = cv.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const r = 18 + Math.random() * 26;
    const x = r + 12 + Math.random() * (232 - 2 * r);
    const y = r + 8 + Math.random() * (112 - 2 * r);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 128);
  }
  return new THREE.CanvasTexture(cv);
}

/* ---------------- sun sprite ---------------- */

const sunPos = new THREE.Vector3(10, 85, -700);
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: radialTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,224,170,0.85)'], [1, 'rgba(255,200,140,0)']]),
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
}));
sunSprite.position.copy(sunPos);
sunSprite.scale.setScalar(240);
scene.add(sunSprite);

/* ---------------- terrain ---------------- */

{
  const geo = new THREE.PlaneGeometry(620, 880, 190, 250);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -110);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cFloorA = new THREE.Color('#16323e'), cFloorB = new THREE.Color('#1d4a44');
  const cRock = new THREE.Color('#2c2654'), cMid = new THREE.Color('#54407f');
  const cSnow = new THREE.Color('#d9a8c8');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainH(x, z);
    pos.setY(i, h);
    const n = vnoise(x * 0.1, z * 0.1);
    c.lerpColors(cFloorA, cFloorB, n);
    c.lerp(cRock, sstep(2.5, 12, h));
    c.lerp(cMid, sstep(12, 42, h));
    c.lerp(cSnow, sstep(42, 80, h));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 1, metalness: 0,
  });
  scene.add(new THREE.Mesh(geo, mat));
}

/* ---------------- the luminous river ---------------- */

const riverUniforms = {
  uTime: uTime,
  uColA: { value: new THREE.Color('#2fd8ff') },
  uColB: { value: new THREE.Color('#bfffe8') },
  uBoost: { value: 1.0 },
};

function riverMaterial(alphaScale) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { ...riverUniforms, uAlphaScale: { value: alphaScale } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uColA; uniform vec3 uColB;
      uniform float uBoost; uniform float uAlphaScale;
      varying vec2 vUv;
      void main() {
        float flow = fract(vUv.x * 60.0 - uTime * 0.9);
        float pulse = smoothstep(0.0, 0.25, flow) * smoothstep(0.6, 0.25, flow);
        float a = (0.4 + 0.6 * pulse) * uAlphaScale * uBoost;
        a *= smoothstep(0.0, 0.05, vUv.x) * (1.0 - smoothstep(0.95, 1.0, vUv.x));
        vec3 col = mix(uColA, uColB, pulse);
        gl_FragColor = vec4(col, a);
      }`,
  });
}

{
  const pts = [];
  for (let z = 300; z >= -480; z -= 10) {
    pts.push(new THREE.Vector3(pathX(z), terrainH(pathX(z), z) + 0.6, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.55, 6, false), riverMaterial(0.9)));
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 2.4, 6, false), riverMaterial(0.12)));
}

/* ---------------- crystals, trees, islands, citadel ---------------- */

const crystalMats = [];

function crystalCluster(x, y, z, baseColor, scale = 1) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: baseColor, emissive: baseColor, emissiveIntensity: 0.8,
    flatShading: true, roughness: 0.3, metalness: 0.1,
  });
  mat.userData.phase = Math.random() * Math.PI * 2;
  crystalMats.push(mat);
  const n = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const s = (0.5 + Math.random() * 1.4) * scale;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mat);
    m.scale.set(s * 0.45, s * 1.7, s * 0.45);
    m.position.set((Math.random() - 0.5) * 3 * scale, s * 1.2, (Math.random() - 0.5) * 3 * scale);
    m.rotation.set((Math.random() - 0.5) * 0.35, Math.random() * Math.PI, (Math.random() - 0.5) * 0.35);
    group.add(m);
  }
  group.position.set(x, y, z);
  scene.add(group);
}

/* crystal terraces — the GROW zone */
const crystalColors = ['#7dffd4', '#6fd8ff', '#aef2c8'];
for (let i = 0; i < 9; i++) {
  const z = 150 - i * 12 + Math.random() * 6;
  const side = i % 2 === 0 ? 1 : -1;
  const x = pathX(z) + side * (9 + Math.random() * 18);
  crystalCluster(x, terrainH(x, z), z, crystalColors[i % 3], 0.8 + Math.random() * 0.8);
}
/* a few violet ones near the citadel */
for (let i = 0; i < 3; i++) {
  const z = -150 - i * 14;
  const x = pathX(z) + (i % 2 ? 14 : -16);
  crystalCluster(x, terrainH(x, z), z, '#c79fff', 1.1);
}

/* stylized trees scattered through the valley */
{
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#3a2b4f', flatShading: true, roughness: 1 });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: '#ff8fb8', flatShading: true, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: '#6fe3c1', flatShading: true, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: '#9fd8ff', flatShading: true, roughness: 0.9 }),
  ];
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 2.2, 5);
  const leafGeo = new THREE.IcosahedronGeometry(1.15, 0);
  for (let i = 0; i < 26; i++) {
    const z = 230 - i * 14 + Math.random() * 8;
    const side = Math.random() > 0.5 ? 1 : -1;
    const x = pathX(z) + side * (7 + Math.random() * 24);
    const y = terrainH(x, z);
    const s = 0.8 + Math.random() * 1.6;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.1;
    const crown = new THREE.Mesh(leafGeo, leafMats[i % 3]);
    crown.position.y = 2.6;
    crown.scale.set(1, 1.35, 1);
    tree.add(trunk, crown);
    tree.scale.setScalar(s);
    tree.position.set(x, y, z);
    tree.rotation.y = Math.random() * Math.PI;
    scene.add(tree);
  }
}

/* floating islands */
const islands = [];
{
  const rockMat = new THREE.MeshStandardMaterial({
    color: '#4a3d7d', emissive: '#221a45', emissiveIntensity: 0.45, flatShading: true, roughness: 1,
  });
  const topMat = new THREE.MeshStandardMaterial({
    color: '#3aa88e', emissive: '#16403a', emissiveIntensity: 0.4, flatShading: true, roughness: 0.9,
  });
  for (let i = 0; i < 7; i++) {
    const z = 60 - i * 50 + Math.random() * 20;
    const side = i % 2 === 0 ? 1 : -1;
    const x = pathX(z) + side * (22 + Math.random() * 18);
    const y = 26 + Math.random() * 26;
    const r = 3.5 + Math.random() * 3;
    const island = new THREE.Group();
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(r, 0.4, r * 1.6, 7), rockMat);
    rock.position.y = -r * 0.8;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 0.9, 0.8, 7), topMat);
    top.position.y = 0.1;
    island.add(rock, top);
    /* small crystals on top */
    const cm = new THREE.MeshStandardMaterial({
      color: '#8af2ff', emissive: '#8af2ff', emissiveIntensity: 0.7, flatShading: true, roughness: 0.3,
    });
    cm.userData.phase = Math.random() * 6;
    crystalMats.push(cm);
    for (let j = 0; j < 3; j++) {
      const s = 0.4 + Math.random() * 0.9;
      const cr = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), cm);
      cr.scale.set(s * 0.4, s * 1.5, s * 0.4);
      cr.position.set((Math.random() - 0.5) * r, s + 0.4, (Math.random() - 0.5) * r);
      island.add(cr);
    }
    island.position.set(x, y, z);
    island.userData = { y0: y, ph: Math.random() * Math.PI * 2 };
    islands.push(island);
    scene.add(island);
  }
}

/* the Citadel — obsidian spires with glowing seams */
{
  const cz = -170;
  const cx = pathX(cz) - 26;
  const spireMat = new THREE.MeshStandardMaterial({ color: '#151033', flatShading: true, roughness: 0.7 });
  const seamMat = new THREE.MeshStandardMaterial({
    color: '#9fffe8', emissive: '#9fffe8', emissiveIntensity: 1.6,
  });
  crystalMats.push(seamMat);
  seamMat.userData.phase = 0;
  const heights = [46, 36, 28, 40, 24, 32];
  heights.forEach((h, i) => {
    const a = (i / heights.length) * Math.PI * 2;
    const x = cx + Math.cos(a) * (6 + (i % 3) * 5);
    const z = cz + Math.sin(a) * (6 + (i % 2) * 7);
    const y = terrainH(x, z);
    const r = 2.4 + (i % 3);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r, h, 6), spireMat);
    spire.position.set(x, y + h / 2 - 1, z);
    spire.rotation.y = a;
    scene.add(spire);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.28, h * 0.62, 0.28), seamMat);
    seam.position.set(x + Math.cos(a + 2.6) * r * 0.92, y + h * 0.36, z + Math.sin(a + 2.6) * r * 0.92);
    scene.add(seam);
  });
}

/* ---------------- aurora over the citadel ---------------- */

const auroraUniforms = { uTime: uTime, uAlpha: { value: 0.5 } };
{
  const auroraMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: auroraUniforms,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uAlpha;
      varying vec2 vUv;
      void main() {
        float wave = sin(vUv.x * 8.0 + uTime * 0.7) * 0.5 + sin(vUv.x * 17.0 - uTime * 1.3) * 0.25;
        float band = vUv.y + wave * 0.15;
        float a = smoothstep(0.0, 0.25, band) * (1.0 - smoothstep(0.45, 1.0, band));
        a *= smoothstep(0.0, 0.14, vUv.x) * (1.0 - smoothstep(0.86, 1.0, vUv.x));
        a *= smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.8, 1.0, vUv.y));
        a *= uAlpha;
        vec3 col = mix(vec3(0.2, 1.0, 0.7), vec3(0.5, 0.4, 1.0), clamp(vUv.y + wave * 0.3, 0.0, 1.0));
        gl_FragColor = vec4(col, a);
      }`,
  });
  const g = new THREE.PlaneGeometry(170, 60, 64, 1);
  const a1 = new THREE.Mesh(g, auroraMat);
  a1.position.set(pathX(-190) - 10, 82, -210);
  const a2 = new THREE.Mesh(g, auroraMat);
  a2.position.set(pathX(-220) + 30, 96, -250);
  a2.rotation.y = 0.3;
  scene.add(a1, a2);
}

/* ---------------- clouds for the ascent ---------------- */

const clouds = [];
const cloudMat = new THREE.SpriteMaterial({
  map: cloudTexture(), transparent: true, opacity: 0.5, depthWrite: false,
});
for (let i = 0; i < 12; i++) {
  const s = new THREE.Sprite(cloudMat);
  const z = -240 - Math.random() * 130;
  s.position.set(pathX(z) + (Math.random() - 0.5) * 160, 52 + Math.random() * 30, z);
  s.scale.set(70 + Math.random() * 60, 24 + Math.random() * 16, 1);
  s.userData = { x0: s.position.x, ph: Math.random() * 6 };
  clouds.push(s);
  scene.add(s);
}

/* ---------------- fireflies / spores ---------------- */

{
  const N = 420;
  const positions = new Float32Array(N * 3);
  const seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const z = 240 - Math.random() * 460;
    positions[i * 3] = pathX(z) + (Math.random() - 0.5) * 60;
    positions[i * 3 + 1] = 1 + Math.random() * 20;
    positions[i * 3 + 2] = z;
    seeds[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: uTime },
    vertexShader: /* glsl */`
      uniform float uTime;
      attribute float aSeed;
      varying float vSeed; varying float vFade;
      void main() {
        vSeed = aSeed;
        vec3 p = position;
        p.y += sin(uTime * 0.5 + aSeed * 40.0) * 1.6;
        p.x += sin(uTime * 0.3 + aSeed * 21.0) * 1.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float tw = 0.6 + 0.4 * sin(uTime * 2.0 + aSeed * 60.0);
        gl_PointSize = (2.0 + aSeed * 4.0) * (170.0 / -mv.z) * tw;
        vFade = smoothstep(380.0, 60.0, -mv.z) * tw;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vSeed; varying float vFade;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d) * vFade * 0.85;
        vec3 col = mix(vec3(0.54, 0.95, 1.0), vec3(1.0, 0.85, 0.63), step(0.5, fract(vSeed * 7.0)));
        gl_FragColor = vec4(col, a);
      }`,
  });
  scene.add(new THREE.Points(geo, mat));
}

/* ---------------- birds ---------------- */

let birdMesh;
const birdFlocks = [
  { cx: pathX(120) + 12, cy: 30, cz: 120, r: 16, speed: 0.32, n: 18 },
  { cx: pathX(-240), cy: 58, cz: -240, r: 22, speed: 0.24, n: 18 },
];
{
  const total = birdFlocks.reduce((s, f) => s + f.n, 0);
  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    0, 0, 0.28,   0, 0, -0.28,  -0.95, 0, 0.05,
    0, 0, 0.28,   0, 0, -0.28,   0.95, 0, 0.05,
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  const phases = new Float32Array(total);
  for (let i = 0; i < total; i++) phases[i] = Math.random() * Math.PI * 2;
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  const mat = new THREE.MeshBasicMaterial({ color: '#241c3f', side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = 'uniform float uTime;\nattribute float aPhase;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  transformed.y += sin(uTime * 9.0 + aPhase) * abs(position.x) * 0.8;'
      );
  };
  birdMesh = new THREE.InstancedMesh(geo, mat, total);
  birdMesh.frustumCulled = false;
  scene.add(birdMesh);
}

const birdDummy = new THREE.Object3D();
function updateBirds(t) {
  let idx = 0;
  for (const f of birdFlocks) {
    for (let i = 0; i < f.n; i++) {
      const a = t * f.speed + (i / f.n) * Math.PI * 2;
      birdDummy.position.set(
        f.cx + Math.cos(a) * (f.r + (i % 4) * 2.2),
        f.cy + Math.sin(t * 0.9 + i) * 2.4,
        f.cz + Math.sin(a) * f.r * 0.7
      );
      birdDummy.rotation.set(0, -a, 0);
      birdDummy.scale.setScalar(0.8 + (i % 5) * 0.12);
      birdDummy.updateMatrix();
      birdMesh.setMatrixAt(idx++, birdDummy.matrix);
    }
  }
  birdMesh.instanceMatrix.needsUpdate = true;
}

/* ---------------- sky mantas ---------------- */

const mantaMat = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  fog: true,
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uBase: { value: new THREE.Color('#2a2152') },
      uTip: { value: new THREE.Color('#79f0ff') },
    },
  ]),
  vertexShader: /* glsl */`
    uniform float uTime;
    varying vec2 vUv; varying vec3 vN;
    #include <fog_pars_vertex>
    void main() {
      vUv = uv;
      vec3 p = position;
      float w = abs(p.x);
      p.y += sin(uTime * 2.0 - w * 1.1) * pow(w * 0.22, 1.6) * 2.4;
      p.y += sin(uTime * 2.4 + p.z * 0.6) * 0.08;
      float tail = smoothstep(1.2, 6.5, -p.z);
      p.x += sin(uTime * 2.0 + p.z * 0.9) * tail * 0.7;
      vN = normalMatrix * normal;
      vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uBase; uniform vec3 uTip;
    varying vec2 vUv; varying vec3 vN;
    #include <fog_pars_fragment>
    void main() {
      float t = pow(abs(vUv.x - 0.5) * 2.0, 1.8);
      vec3 col = mix(uBase, uTip, t);
      col += uTip * pow(t, 3.0) * 0.8;
      float up = max(normalize(vN).y, 0.0);
      col *= 0.55 + 0.45 * up;
      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
    }`,
});

function mantaBodyGeo() {
  const g = new THREE.PlaneGeometry(9, 5, 32, 18);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const nx = Math.abs(x) / 4.5;
    pos.setY(i, y * (1 - Math.pow(nx, 1.35) * 0.8) + nx * 1.6);
  }
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function mantaTailGeo() {
  const g = new THREE.PlaneGeometry(0.5, 7, 1, 14);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -5.5);
  g.computeVertexNormals();
  return g;
}

function makeManta(scale) {
  const m = new THREE.Group();
  m.add(new THREE.Mesh(mantaBodyGeo(), mantaMat));
  m.add(new THREE.Mesh(mantaTailGeo(), mantaMat));
  m.scale.setScalar(scale);
  scene.add(m);
  return m;
}

const mantaCurve = new THREE.CatmullRomCurve3(
  [...Array(6)].map((_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return new THREE.Vector3(
      pathX(-80) + Math.cos(a) * 70,
      38 + Math.sin(a * 2) * 12,
      -80 + Math.sin(a) * 75
    );
  }),
  true
);

const mantas = [
  { mesh: makeManta(3.6), offset: 0.0, bank: 0.2 },
  { mesh: makeManta(1.5), offset: 0.94, bank: 0.3 },
  { mesh: makeManta(1.2), offset: 0.9, bank: 0.25 },
];

const mantaAhead = new THREE.Vector3();
function updateMantas(t) {
  for (const m of mantas) {
    const u = (((t * 0.008 + m.offset) % 1) + 1) % 1;
    const p = mantaCurve.getPointAt(u);
    mantaCurve.getPointAt((u + 0.005) % 1, mantaAhead);
    m.mesh.position.copy(p);
    m.mesh.lookAt(mantaAhead);
    m.mesh.rotateZ(Math.sin(t * 0.5 + m.offset * 12) * m.bank);
  }
}

/* ---------------- camera journey ---------------- */

const camPath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(pathX(260) + 6, 30, 260),
  new THREE.Vector3(pathX(190) - 5, 22, 190),
  new THREE.Vector3(pathX(130) + 6, 15, 130),
  new THREE.Vector3(pathX(70) - 4, 13, 70),
  new THREE.Vector3(pathX(10) + 5, 12, 10),
  new THREE.Vector3(pathX(-60) - 6, 14, -60),
  new THREE.Vector3(pathX(-130) + 4, 18, -130),
  new THREE.Vector3(pathX(-200), 30, -200),
  new THREE.Vector3(pathX(-250), 48, -250),
  new THREE.Vector3(pathX(-295), 72, -295),
]);

const lookPath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(pathX(170), 14, 170),
  new THREE.Vector3(pathX(110), 10, 110),
  new THREE.Vector3(pathX(50), 8, 50),
  new THREE.Vector3(pathX(-10), 6, -10),
  new THREE.Vector3(pathX(-90), 9, -90),
  new THREE.Vector3(pathX(-170) - 20, 24, -170),
  new THREE.Vector3(pathX(-230), 34, -230),
  new THREE.Vector3(pathX(-280), 58, -280),
  new THREE.Vector3(0, 56, -420),
  new THREE.Vector3(5, 48, -620),
]);

/* ---------------- scroll + overlay choreography ---------------- */

let scrollTarget = 0;
let scrollCur = 0;

function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollTarget = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
}
window.addEventListener('scroll', readScroll, { passive: true });
readScroll();

const stages = [...document.querySelectorAll('.stage')].map((el) => ({
  el,
  start: parseFloat(el.dataset.start),
  end: parseFloat(el.dataset.end),
}));

const railButtons = [...document.querySelectorAll('.rail button')];
const railAnchors = railButtons.map((b) => parseFloat(b.dataset.goto));

function updateOverlays(p) {
  for (const s of stages) {
    const t = (p - s.start) / (s.end - s.start);
    const op = sstep(0, 0.18, t) * (1 - sstep(0.82, 1, t));
    s.el.style.opacity = op.toFixed(3);
    const dy = (1 - op) * 28;
    s.el.style.transform = `translateY(${dy.toFixed(1)}px)`;
    s.el.style.pointerEvents = op > 0.45 ? 'auto' : 'none';
  }
  let best = 0, bestD = 1e9;
  railAnchors.forEach((a, i) => {
    const d = Math.abs(p - a);
    if (d < bestD) { bestD = d; best = i; }
  });
  railButtons.forEach((b, i) => b.classList.toggle('active', i === best));
}

function gotoProgress(p) {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo({ top: p * max, behavior: 'smooth' });
}

document.querySelectorAll('[data-goto]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    gotoProgress(parseFloat(el.dataset.goto));
  });
});

/* toast */
const toast = document.getElementById('toast');
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
}
document.getElementById('enter-app').addEventListener('click', () =>
  showToast('✦ The app gates open soon. The world, however, is already here.'));
document.getElementById('begin-ascent').addEventListener('click', () =>
  showToast('✦ This is a demo world — but your curiosity is real.'));

/* auto-flight */
let flying = false;
document.getElementById('auto-fly').addEventListener('click', () => {
  if (flying) return;
  flying = true;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const from = window.scrollY;
  const start = performance.now();
  const dur = 42000;
  const cancel = () => { flying = false; };
  window.addEventListener('wheel', cancel, { once: true, passive: true });
  window.addEventListener('touchstart', cancel, { once: true, passive: true });
  window.addEventListener('keydown', cancel, { once: true });
  (function step(now) {
    if (!flying) return;
    const t = clamp((now - start) / dur, 0, 1);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    window.scrollTo(0, from + (max - from) * e);
    if (t < 1) requestAnimationFrame(step);
    else flying = false;
  })(performance.now());
});

/* ---------------- mouse parallax ---------------- */

const mouse = { x: 0, y: 0 };
const sway = { x: 0, y: 0 };
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
});

/* ---------------- resize ---------------- */

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------------- loader ---------------- */

window.addEventListener('load', () => {
  setTimeout(() => document.getElementById('loader').classList.add('done'), 500);
});
/* fallback in case 'load' already fired or fonts hang */
setTimeout(() => document.getElementById('loader').classList.add('done'), 4000);

/* ---------------- main loop ---------------- */

const camPos = new THREE.Vector3();
const lookPos = new THREE.Vector3();
const startTime = performance.now();
let lastT = startTime;

function tick(now) {
  const dt = clamp((now - lastT) / 1000, 0.001, 0.05);
  lastT = now;
  const t = Math.max((now - startTime) / 1000, 0);
  uTime.value = t;
  mantaMat.uniforms.uTime.value = t;

  /* smooth scroll */
  scrollCur += (scrollTarget - scrollCur) * (1 - Math.pow(0.002, dt));
  const p = clamp(scrollCur, 0, 1);

  /* mood */
  sampleMood(p);
  scene.fog.color.copy(moodNow.fog);
  scene.fog.far = moodNow.fogFar;
  hemi.color.copy(moodNow.hemiS);
  hemi.groundColor.copy(moodNow.hemiG);
  sunLight.color.copy(moodNow.dir);
  sunLight.intensity = moodNow.dirI;
  skyMat.uniforms.uStars.value = moodNow.stars;
  sunSprite.material.color.copy(moodNow.sun);
  cloudMat.color.copy(moodNow.fog).lerp(new THREE.Color('#ffffff'), 0.55);

  riverUniforms.uBoost.value = 0.55 + bell(p, 0.48, 0.3) * 0.9;
  auroraUniforms.uAlpha.value = 0.12 + bell(p, 0.7, 0.22) * 0.55;

  /* camera */
  const sx = reduceMotion ? 0 : mouse.x;
  const sy = reduceMotion ? 0 : mouse.y;
  sway.x += (sx * 2.6 - sway.x) * (1 - Math.pow(0.01, dt));
  sway.y += (-sy * 1.4 - sway.y) * (1 - Math.pow(0.01, dt));

  camPath.getPointAt(p, camPos);
  lookPath.getPointAt(p, lookPos);

  const intro = clamp((now - startTime) / 2600, 0, 1);
  const ie = 1 - Math.pow(1 - intro, 3);

  camera.position.set(
    camPos.x + sway.x,
    camPos.y + sway.y + Math.sin(t * 0.5) * 0.4 + (1 - ie) * 16,
    camPos.z + (1 - ie) * 28
  );
  camera.lookAt(lookPos.x + sway.x * 3, lookPos.y - sway.y * 2, lookPos.z);

  const targetFov = 55 + sstep(0.85, 1, p) * 8;
  if (Math.abs(camera.fov - targetFov) > 0.01) {
    camera.fov = targetFov;
    camera.updateProjectionMatrix();
  }

  sky.position.copy(camera.position);
  skyMat.uniforms.uSunDir.value.copy(sunPos).sub(camera.position).normalize();

  /* life */
  updateBirds(t);
  updateMantas(t);
  for (const isl of islands) {
    isl.position.y = isl.userData.y0 + Math.sin(t * 0.6 + isl.userData.ph) * 1.2;
    isl.rotation.y += dt * 0.02;
  }
  for (const c of clouds) c.position.x = c.userData.x0 + Math.sin(t * 0.02 + c.userData.ph) * 14;
  for (const m of crystalMats) m.emissiveIntensity = 0.65 + 0.35 * Math.sin(t * 1.4 + m.userData.phase);

  updateOverlays(p);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
