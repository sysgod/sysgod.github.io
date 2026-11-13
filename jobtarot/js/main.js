// JobTarot - composition root + view (three.js). Flow: intro (role) -> shuffle (deck swirls over the table) -> pick 3 from a fanned hand ->
// each card flies to Past / Present / Future and slams down -> flips one by one with a burst, a shock ring and a meaning aura -> prophecy.
// Core rules live in js/oracle.js (pure); data + texts in js/cards.js; card faces in js/cardart.js; shaders in js/shaders.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as SH from './shaders.js';
import { drawFront, drawBack } from './cardart.js';
import { Sfx } from './audio.js';

const { CARDS, ROLES, UI } = window.TAROT, O = window.Oracle;
const qs = new URLSearchParams(location.search);
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
let LANG = qs.get('lang') || store.get('jobtarot.lang') || ((navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en');
if (!UI[LANG]) LANG = 'en';
const U = () => UI[LANG];
const KIND = { good: 0, bad: 1, chaos: 2 };
const VCOL = { good: ['#fff0a0', '#ffc040', '#ffffff'], bad: ['#7aff80', '#b040ff', '#30c050'], chaos: ['#9a70ff', '#40e8ff', '#ff60e0'] };
const TOP = 0.78, CWm = 0.26, CHm = 0.4, PAD = 1.9;
const SLOTS = [-0.36, 0, 0.36].map((x) => new THREE.Vector3(x, TOP + 0.004, 0.0));
const DECK = new THREE.Vector3(0.74, TOP + 0.004, -0.3);

// ---------------- renderer / scene ----------------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#07040c'); scene.fog = new THREE.FogExp2('#07040c', 0.16);
const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 40);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, cam));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.42, 0.45, 0.9); composer.addPass(bloom);
composer.addPass(new OutputPass());
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.25;

scene.add(new THREE.AmbientLight('#4a3070', 0.55), new THREE.HemisphereLight('#7a5aa8', '#120808', 0.4));
const key = new THREE.SpotLight('#ffd8a0', 26, 7, 0.62, 0.85, 1.6); key.position.set(0.3, 3.1, 1.0); key.target.position.set(0, TOP, 0);
key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; scene.add(key, key.target);
const rim = new THREE.DirectionalLight('#6a50ff', 0.6); rim.position.set(-2, 2, -3); scene.add(rim);
const flash = new THREE.PointLight('#ffffff', 0, 3, 2); flash.position.set(0, TOP + 0.4, 0); scene.add(flash);
const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshStandardMaterial({ color: '#1a1216', roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
// a rune circle glowing faintly on the floor under the table (the mage's room)
const floorRune = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), SH.circleMaterial()); floorRune.rotation.x = -Math.PI / 2; floorRune.position.y = 0.005;
floorRune.material.uniforms.uCol.value.set('#7a50ff'); scene.add(floorRune);

// ---------------- particles ----------------
class Particles {
  constructor(max) {
    this.max = max; this.n = 0; const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g; this.mat = SH.particleMaterial(); this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 10;
    this.P = []; scene.add(this.points);
  }
  emit(o) {
    if (this.P.length >= this.max) this.P.shift();
    const c = new THREE.Color(o.color || '#ffffff');
    this.P.push({ x: o.p.x, y: o.p.y, z: o.p.z, vx: o.v ? o.v.x : 0, vy: o.v ? o.v.y : 0, vz: o.v ? o.v.z : 0, life: 0, max: o.life || 1, r: c.r, g: c.g, b: c.b,
      s: o.size || 0.02, s1: o.size1 ?? (o.size || 0.02) * 0.2, drag: o.drag ?? 1.5, grav: o.grav ?? 0, a: o.alpha ?? 1, flick: o.flick || 0 });
  }
  burst(p, colors, n, speed, o = {}) {
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, sp = speed * (0.35 + Math.random() * 0.75), q = Math.sqrt(1 - u * u);
      const v = new THREE.Vector3(Math.cos(th) * q, Math.abs(u) * (o.up ?? 1) + (o.lift || 0), Math.sin(th) * q).multiplyScalar(sp);
      this.emit({ p, v, color: colors[i % colors.length], life: (o.life || 1) * (0.6 + Math.random() * 0.7), size: (o.size || 0.03) * (0.6 + Math.random() * 0.8), drag: o.drag ?? 2.2, grav: o.grav ?? -0.6 });
    }
  }
  update(dt) {
    let n = 0;
    for (let i = this.P.length - 1; i >= 0; i--) {
      const q = this.P[i]; q.life += dt; if (q.life >= q.max) { this.P.splice(i, 1); continue; }
      const dr = Math.exp(-q.drag * dt); q.vx *= dr; q.vy = q.vy * dr + q.grav * dt; q.vz *= dr; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
    }
    for (const q of this.P) {
      const k = q.life / q.max, fade = Math.min(1, k * 8) * (1 - k) * (1 - k) * 1.6;
      const fl = q.flick ? 0.6 + 0.4 * Math.sin(q.life * 20 + q.x * 50) : 1;
      this.pos.set([q.x, q.y, q.z], n * 3); this.col.set([q.r, q.g, q.b, Math.min(1, fade * q.a * fl)], n * 4); this.size[n] = q.s + (q.s1 - q.s) * k; n++;
    }
    this.geo.setDrawRange(0, n);
    for (const a of ['position', 'aCol', 'aSize']) this.geo.attributes[a].needsUpdate = true;
  }
}
const fx = new Particles(3000);

// ---------------- tweens + shake ----------------
const tweens = [];
const ease = { io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), out: (t) => 1 - Math.pow(1 - t, 3), back: (t) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }, lin: (t) => t };
function tween(o, d) { return new Promise((res) => tweens.push({ o, d: { dur: 0.5, delay: 0, ease: ease.io, ...d }, t: 0, s: null, res })); }
function runTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i], d = w.d; w.t += dt; if (w.t < d.delay) continue;
    if (!w.s) w.s = { p: w.o.position.clone(), q: w.o.quaternion.clone(), sc: w.o.scale.clone() };
    const k = Math.min(1, (w.t - d.delay) / d.dur), e = d.ease(k);
    if (d.pos) { w.o.position.lerpVectors(w.s.p, d.pos, e); if (d.lift) w.o.position.y += Math.sin(Math.PI * e) * d.lift; }
    if (d.quat) w.o.quaternion.slerpQuaternions(w.s.q, d.quat, e);
    if (d.scale != null) w.o.scale.setScalar(w.s.sc.x + (d.scale - w.s.sc.x) * e);
    d.update && d.update(e, k);
    if (k >= 1) { tweens.splice(i, 1); w.res(); }
  }
}
let shakeT = 0, shakeA = 0;
const shake = (a) => { shakeA = Math.max(shakeA, a); shakeT = 0.45; };
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

// ---------------- models (one SdfForge set = one atlas, one material) ----------------
const STUB = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PROPS = [['Table', 0, 0, 0, 0], ['Candles', -0.8, TOP, -0.38, 0.3], ['Flask', -0.5, TOP, -0.46, 0], ['CrystalBall', 0.0, TOP, -0.44, 0], ['Books', 0.46, TOP, -0.46, -0.25],
  ['SkullCandle', -0.8, TOP, 0.34, 0.5], ['Vial', -0.62, TOP, 0.44, 0], ['Hourglass', 0.8, TOP, 0.36, 0.2], ['Candles', 0.86, TOP, -0.02, 1.2]];
const FLAMES = [[-0.845, TOP + 0.28, -0.36], [-0.8, TOP + 0.29, 0.34], [0.84, TOP + 0.28, 0.0]];
async function loadModels(onP) {
  const stubMgr = new THREE.LoadingManager(); stubMgr.setURLModifier((u) => (/\.png(\?|$)/i.test(u) ? STUB : u));
  const real = new GLTFLoader(), stub = new GLTFLoader(stubMgr), ids = [...new Set(PROPS.map((p) => p[0]))], M = {};
  let mat = null, done = 0;
  const one = async (id, loader) => {
    const g = await loader.loadAsync(`art/models/${id}.glb`);
    if (!mat) { const m0 = g.scene.getObjectByProperty('isMesh', true).material; if (m0.map) m0.map.colorSpace = THREE.SRGBColorSpace;
      mat = new THREE.MeshStandardMaterial({ map: m0.map, normalMap: m0.normalMap, roughnessMap: m0.roughnessMap, metalnessMap: m0.metalnessMap, aoMap: m0.aoMap,
        emissiveMap: m0.emissiveMap, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0.55, roughness: 1, metalness: 1, envMapIntensity: 0.6 }); }
    g.scene.traverse((o) => { if (o.isMesh) { if (o.material !== mat) o.material.dispose(); o.material = mat; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    M[id] = g.scene; onP(++done / ids.length);
  };
  await one(ids[0], real);
  await Promise.all(ids.slice(1).map((id) => one(id, stub)));
  for (const [id, x, y, z, ry] of PROPS) { const s = M[id].parent ? M[id].clone(true) : M[id]; s.position.set(x, y, z); s.rotation.y = ry; scene.add(s); }
}
const candles = FLAMES.map(([x, y, z]) => { const l = new THREE.PointLight('#ff9a40', 0.45, 2.6, 2); l.position.set(x, y + 0.16, z); scene.add(l); return l; });
const orb = new THREE.PointLight('#8a60ff', 0.9, 1.8, 2); orb.position.set(0, TOP + 0.22, -0.4); scene.add(orb);
const brew = new THREE.PointLight('#50ff70', 0.5, 1.2, 2); brew.position.set(-0.5, TOP + 0.15, -0.42); scene.add(brew);
const tableRune = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.1), SH.circleMaterial()); tableRune.rotation.x = -Math.PI / 2; tableRune.position.set(0, TOP + 0.002, 0); tableRune.renderOrder = 1; scene.add(tableRune);

// ---------------- cards ----------------
const qFaceUp = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const qFaceDown = qFaceUp.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
const geo = new THREE.PlaneGeometry(CWm, CHm);
let backTex = null;
const cards = [];
function makeCard(data, img) {
  const g = new THREE.Group(); g.userData.card = data;
  const fc = drawFront(data, LANG, img), tex = new THREE.CanvasTexture(fc); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const fm = SH.cardFrontMaterial(tex, KIND[data.v]); fm.transparent = false;
  fm.fragmentShader = fm.fragmentShader.replace('vec4 c = texture2D(uMap, vUv);', 'vec4 c = texture2D(uMap, vUv); if (c.a < 0.5) discard;');
  const front = new THREE.Mesh(geo, fm); front.castShadow = true; front.position.z = 0.0008;
  const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: backTex, alphaTest: 0.5, roughness: 0.55, metalness: 0.1, emissive: '#ffc860', emissiveIntensity: 0 })   /* hover glow starts OFF: the default intensity 1 left fast-picked backs white-hot */); back.rotation.y = Math.PI; back.castShadow = true; back.receiveShadow = true;
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(CWm * PAD, CHm * PAD), SH.auraMaterial(KIND[data.v], CWm, CHm, PAD)); aura.position.z = -0.003; aura.renderOrder = 5;
  g.add(front, back, aura); front.userData.root = g; back.userData.root = g;
  g.userData = { card: data, front, back, aura, canvas: fc, mode: 'deck', fan: null };
  scene.add(g); return g;
}
function stackDeck() {
  cards.forEach((c, i) => { scene.attach(c); c.position.copy(DECK).add(new THREE.Vector3((Math.random() - 0.5) * 0.006, i * 0.0035, (Math.random() - 0.5) * 0.006)); c.quaternion.copy(qFaceDown); c.scale.setScalar(1); c.userData.mode = 'deck';
    c.userData.aura.material.uniforms.uAlpha.value = 0; c.userData.front.material.uniforms.uLit.value = 0; });
}

// ---------------- hand (a fan in front of the camera, Hearthstone-like) ----------------
const hand = new THREE.Object3D(); scene.add(hand);
let handList = [], hover = null;
const HAND_D = 0.9;
function placeHand() {
  const vh = 2 * HAND_D * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), vw = vh * cam.aspect;
  const s = Math.min(0.3, (0.88 * vw) / 1.62);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
  hand.position.copy(cam.position).addScaledVector(fwd, HAND_D).addScaledVector(up, -vh / 2 + 0.2 * s); hand.quaternion.copy(cam.quaternion); hand.scale.setScalar(s);
}
function layoutHand() {
  const n = handList.length; if (!n) return;
  const spread = Math.min(0.38, 0.034 * (n - 1));
  handList.forEach((c, i) => { const t = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0, a = t * spread;
    c.userData.fan = { p: new THREE.Vector3(Math.sin(a) * 1.75, -1.6 + Math.cos(a) * 1.75, i * 0.004), r: -a }; });
}
const qTmp = new THREE.Quaternion(), eTmp = new THREE.Euler();
function updateHand(dt) {
  const k = 1 - Math.exp(-dt * 11);
  for (const c of handList) {
    const f = c.userData.fan; if (!f) continue; const h = c === hover;
    const tp = f.p.clone(); if (h) { tp.y += 0.16; tp.z += 0.08; }
    c.position.lerp(tp, k); qTmp.setFromEuler(eTmp.set(0, Math.PI, h ? 0 : f.r)); c.quaternion.slerp(qTmp, k);
    const ts = h ? 1.22 : 1; c.scale.setScalar(c.scale.x + (ts - c.scale.x) * k);
    const bm = c.userData.back.material; bm.emissiveIntensity += ((h ? 0.16 : 0) - bm.emissiveIntensity) * k;
  }
}

// ---------------- UI (DOM) ----------------
const $ = (id) => document.getElementById(id);
const ui = $('ui');
function setHint(t) { $('hint').textContent = t || ''; $('hint').classList.toggle('on', !!t); }
let role = ROLES[0];
function renderIntro() {
  const T = U();
  $('intro').innerHTML = `<div class="sheet"><div class="crest">✶</div><h1>${T.title}</h1><p class="sub">${T.sub}</p><p class="who">${T.who}</p>
  <div class="roles">${ROLES.map((r) => `<button class="chip${r === role ? ' on' : ''}" data-r="${r.id}">${r[LANG][0]}</button>`).join('')}</div>
  <button id="go" class="big">${T.start}</button><p class="fine">${T.disclaimer}</p></div>`;
  $('intro').querySelectorAll('.chip').forEach((b) => (b.onclick = () => { role = ROLES.find((r) => r.id === b.dataset.r); sfx.play('tick'); renderIntro(); }));
  $('go').onclick = () => { sfx.unlock(); sfx.play('click'); sfx.music('music_main_loop'); startReading(); };
  $('lang').textContent = T.lang; document.title = T.title; document.documentElement.lang = LANG;
}
$('lang').onclick = () => { store.set('jobtarot.lang', LANG === 'ru' ? 'en' : 'ru'); const u = new URL(location.href); u.searchParams.set('lang', LANG === 'ru' ? 'en' : 'ru'); location.href = u.toString(); };
$('snd').onclick = () => { sfx.unlock(); sfx.setMuted(!sfx.muted); $('snd').classList.toggle('off', sfx.muted); store.set('jobtarot.mute', sfx.muted ? '1' : '0'); };

// ---------------- flow ----------------
const S = { log: [], phase: 'boot', spread: [], t: 0, swirl: 0, rng: O.rng((Date.now() ^ (Math.random() * 1e9)) >>> 0) };
async function startReading() {
  $('intro').classList.remove('on'); $('verdict').classList.remove('on'); $('reading').innerHTML = ''; $('reading').classList.remove('on');
  S.spread = []; handList = []; hover = null; stackDeck();
  const order = O.shuffle(cards, S.rng);
  S.phase = 'shuffle'; S.swirl = 0; sfx.play('shuffle'); setHint('');
  order.forEach((c, i) => { c.userData.mode = 'swirl'; c.userData.si = i; c.userData.sp = c.position.clone(); });
  S.order = order;
  await wait(2.5);
  order.forEach((c, i) => setTimeout(() => { hand.attach(c); c.userData.mode = 'hand'; handList.push(c); layoutHand(); sfx.play('deal', 0.35); }, i * 70));
  await wait(order.length * 0.07 + 0.3);
  S.phase = 'pick'; setHint(U().pick);
}
function swirlPose(c, t) {
  const i = c.userData.si, n = cards.length, k = Math.min(1, Math.max(0, (t - i * 0.05) / 0.45)), e = ease.out(k);
  const a = (i / n) * Math.PI * 2 + t * 2.3, R = 0.5 + 0.04 * Math.sin(t * 3 + i);
  const orbit = new THREE.Vector3(Math.cos(a) * R, TOP + 0.3 + 0.05 * Math.sin(t * 2.6 + i * 1.7), Math.sin(a) * R * 0.55 - 0.05);
  c.position.lerpVectors(c.userData.sp, orbit, e);
  const look = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a + Math.PI / 2, 0.25 * Math.sin(t * 2 + i)));
  c.quaternion.slerpQuaternions(qFaceDown, look.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)), e);
  if (k > 0 && Math.random() < 0.18) fx.emit({ p: c.position.clone(), v: new THREE.Vector3(0, 0.05, 0), color: Math.random() < 0.5 ? '#a070ff' : '#e0a040', life: 0.5, size: 0.012, drag: 1, alpha: 0.6 });
}
async function pick(c) {
  if (S.phase !== 'pick' || S.spread.length >= 3 || c.userData.mode !== 'hand') return;
  S.log.push('pick');
  const k = S.spread.length; S.spread.push(c); c.userData.rev = O.draw(c.userData.card, S.rng).rev; handList = handList.filter((x) => x !== c); hover = null; layoutHand();
  scene.attach(c); c.userData.mode = 'fly'; c.userData.back.material.emissiveIntensity = 0; sfx.play('deal');
  setHint(S.spread.length < 3 ? U().pickN.replace('{n}', 3 - S.spread.length) : '');
  const trail = setInterval(() => fx.emit({ p: c.position.clone(), color: '#ffd890', life: 0.5, size: 0.025, drag: 3 }), 16);
  await tween(c, { pos: SLOTS[k], quat: qFaceDown, scale: 1, dur: 0.6, lift: 0.28, ease: ease.io });
  clearInterval(trail); c.userData.mode = 'slot';
  /* placing a card is quiet (a soft tap): the ONE big effect of a card is its reveal (owner 11-13: "по два раза одну и ту же выкладывать") */
  S.log.push('place'); sfx.play('tick', 0.6);
  addLabel(k);
  /* only the THIRD pick starts the reveal: every pick awaits its own flight, so with quick picks all three continuations saw length 3 and the
     reveal ran 2-3 times (owner 11-13: "действия все двоятся в операциях с картами"); acceptance A12 replays this */
  if (k === 2) { S.phase = 'reveal'; await wait(0.4); await returnHand(); await wait(0.35); await revealAll(); }
}
async function returnHand() {
  const rest = handList.slice(); handList = [];
  rest.forEach((c, i) => { scene.attach(c); c.userData.mode = 'fly'; tween(c, { pos: DECK.clone().add(new THREE.Vector3(0, i * 0.0035, 0)), quat: qFaceDown, scale: 1, dur: 0.45, delay: i * 0.03, lift: 0.12 }).then(() => (c.userData.mode = 'deck')); });
  if (rest.length) sfx.play('shuffle', 0.5);
  await wait(0.45 + rest.length * 0.03);
}
const shocks = [];
function slam(p, color, big) {
  S.log.push('slam');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), SH.shockMaterial(color)); m.rotation.x = -Math.PI / 2; m.position.copy(p).setY(TOP + 0.003); m.scale.setScalar(0.5 * big); m.renderOrder = 4; scene.add(m);
  shocks.push({ m, t: 0, big });
  for (let i = 0; i < 26 * big; i++) { const a = Math.random() * Math.PI * 2; fx.emit({ p: p.clone().add(new THREE.Vector3(Math.cos(a) * 0.12, 0.01, Math.sin(a) * 0.16)), v: new THREE.Vector3(Math.cos(a) * 0.5, 0.15 + Math.random() * 0.2, Math.sin(a) * 0.5), color: '#c8a078', life: 0.7, size: 0.02, drag: 4, grav: -0.3, alpha: 0.5 }); }
}
async function revealAll() {
  await wait(0.9);
  for (let k = 0; k < 3; k++) { await revealOne(k); await wait(2.4); }   /* owner 11-13: a longer pause to read each card */
  await wait(0.6); showVerdict();
}
async function revealOne(k) {
  const c = S.spread[k], d = c.userData.card, rev = !!c.userData.rev, ev = rev ? d.rv : d.v, kind = KIND[ev], col = VCOL[ev];
  const old = c.userData.aura.material; c.userData.aura.material = SH.auraMaterial(kind, CWm, CHm, PAD); old.dispose();
  /* a reversed card is NOT laid upside down: owner 11-13 "выпадающие вверх ногами карты странно выглядят как будто баг". It lies upright and its
     slot label says it is reversed; the meaning, the aura and the reading use the reversed side. */
  const qUp = qFaceUp;
  if (rev) markReversed(k);
  /* ONE motion and ONE impact (owner 11-13: "эффект показа из двух взрывов странный ... действия все двоятся"): the card rises, turns over
     and lands in a single arc; the burst, the shock ring, the flash, the shake and the sound all fire once, at the moment it touches the table.
     It used to be three beats (charge, a mid-air burst on the flip, a bouncy landing with a second ring) and read as the same reveal twice. */
  const base = SLOTS[k].clone();
  await tween(c, { dur: 0.8, ease: ease.lin, update: (t) => {
    const e = ease.io(t);
    c.quaternion.copy(qUp).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * (1 - e)));
    c.position.copy(base).add(new THREE.Vector3(0, Math.sin(Math.PI * t) * 0.16, Math.sin(Math.PI * t) * 0.03));
    c.scale.setScalar(1 + Math.sin(Math.PI * t) * 0.15);
  } });
  c.position.copy(base); c.quaternion.copy(qUp); c.scale.setScalar(1);
  impact(c, ev, col);
  const au = c.userData.aura.material.uniforms, fr = c.userData.front.material.uniforms;
  tween({ position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1) }, { dur: 1.2, ease: ease.out, update: (e) => { au.uAlpha.value = e; au.uBoost.value = 1.4 * (1 - e); fr.uLit.value = 1 - e; } });
  showLine(k);
  await wait(0.45);
}
function impact(c, v, col) {
  S.log.push('impact');
  const p = c.position.clone().add(new THREE.Vector3(0, 0.02, 0));
  slam(c.position, col[0], 1);
  fx.burst(p, col, 70, 1.2, { life: 0.9, size: 0.022, up: 1, lift: 0.3, grav: v === 'bad' ? 0.25 : -0.5 });
  fx.burst(p, ['#ffffff'], 20, 2.2, { life: 0.35, size: 0.016 });
  if (v === 'good') for (let i = 0; i < 40; i++) fx.emit({ p: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.7 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3)), v: new THREE.Vector3(0, -0.3, 0), color: '#ffe080', life: 1.6, size: 0.03, drag: 0.2, flick: 1 });
  if (v === 'bad') for (let i = 0; i < 50; i++) fx.emit({ p: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, -0.1, (Math.random() - 0.5) * 0.4)), v: new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.4 + Math.random() * 0.4, 0), color: Math.random() < 0.5 ? '#40ff60' : '#9030ff', life: 1.6, size: 0.05, size1: 0.12, drag: 0.6, alpha: 0.5 });
  if (v === 'chaos') for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2; fx.emit({ p: p.clone(), v: new THREE.Vector3(Math.cos(a) * 1.1, 0.15, Math.sin(a) * 1.1), color: i % 2 ? '#40e8ff' : '#b070ff', life: 0.9, size: 0.03, drag: 1.2 }); }
  flash.color.set(col[1]); flash.position.copy(p); flash.intensity = 3.5;
  tableRune.material.uniforms.uPulse.value = 1; tableRune.material.uniforms.uCol.value.set(col[1]);
  shake(0.012); sfx.play('flip'); sfx.play(v, 0.9);
}
function markReversed(k) {
  const el = $('labels').querySelector(`.slotlabel[data-k="${k}"]`); if (!el) return;
  el.classList.add('rev'); el.innerHTML = `${U().pos[k]}<small>⟲ ${U().reversed}</small>`;
}
function addLabel(k) {
  const el = document.createElement('div'); el.className = 'slotlabel'; el.dataset.k = k; el.textContent = U().pos[k]; $('labels').appendChild(el);
}
function showLine(k) {
  const l = O.line(drawOf(S.spread[k]), k, LANG, U()), el = $('reading');
  el.classList.add('on');
  el.innerHTML = lineHtml(l);
}
const drawOf = (c) => ({ card: c.userData.card, rev: !!c.userData.rev });
const arcTag = (l) => `${l.arc}${l.rev ? ', ' + U().reversed : ''}`;
const lineHtml = (l, i) => `<div class="line v-${l.v}"${i != null ? ` data-k="${i}"` : ''}><b>${l.pos} · ${l.name} <em>(${arcTag(l)})</em></b><i class="key">${U().meaning}: ${l.key}</i><span>${l.text}</span></div>`;
function showVerdict() {
  S.phase = 'final'; setHint(''); $('reading').classList.remove('on');
  let recent = []; try { recent = JSON.parse(store.get('jobtarot.recent') || '[]'); } catch (e) {}
  const F = O.forecast(S.spread.map(drawOf), role, LANG, S.rng, UI, recent), T = U(); store.set('jobtarot.recent', JSON.stringify(recent));
  S.F = F;
  $('verdict').innerHTML = `<div class="scroll"><h2>${T.verdictTitle}</h2><p class="head">${F.head}</p>
  <div class="prob"><span>${T.prob}</span><b>${F.prob}%</b><i style="--p:${F.prob}%"></i></div>
  <dl><dt>${T.when}</dt><dd>${F.when}</dd><dt>${T.salary}</dt><dd>${F.salary}</dd><dt>${T.perk}</dt><dd>${F.perk}</dd><dt>${T.charm}</dt><dd>${F.charm}</dd><dt>${T.advice}</dt><dd>${F.advice}</dd></dl>
  <div class="lines">${F.lines.map((l, i) => lineHtml(l, i)).join('')}</div>
  <div class="btns"><button id="share" class="big">${T.share}</button><button id="copy">${T.copy}</button><button id="again">${T.again}</button></div>
  <p class="fine">${T.tap}</p></div>`;
  $('verdict').classList.add('on'); document.body.classList.add('final'); sfx.play('prophecy');
  $('share').onclick = () => { sfx.play('click'); copyText(); window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareUrl()), '_blank', 'noopener'); };
  $('copy').onclick = () => { sfx.play('click'); copyText(); $('copy').textContent = T.copied; };
  $('again').onclick = () => { sfx.play('click'); document.body.classList.remove('final'); $('labels').innerHTML = ''; $('verdict').classList.remove('on'); renderIntro(); $('intro').classList.add('on'); S.phase = 'intro'; stackDeck(); };
  $('verdict').querySelectorAll('.line').forEach((el) => (el.onclick = () => zoom(S.spread[+el.dataset.k])));
  const p = new THREE.Vector3(0, TOP + 0.5, 0);
  const col = F.tier >= 3 ? VCOL.good : F.tier <= 1 ? VCOL.bad : VCOL.chaos;
  for (let i = 0; i < 90; i++) fx.emit({ p: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 0.6, (Math.random() - 0.5) * 0.8)), v: new THREE.Vector3(0, -0.25 - Math.random() * 0.2, 0), color: col[i % 3], life: 2.2, size: 0.028, drag: 0.3, flick: 1 });
}
const shareUrl = () => location.origin + location.pathname;
function copyText() {
  const F = S.F, T = U(); if (!F) return;
  const txt = T.shareText.replace('{head}', F.head).replace('{p}', F.prob) + '\n' + F.lines.map((l) => `${l.pos}: ${l.name} (${arcTag(l)})`).join(' · ') + '\n' + shareUrl();
  try { navigator.clipboard.writeText(txt); } catch (e) {}
}
function zoom(c) {
  if (!c) return; const k = Math.max(0, S.spread.indexOf(c)), l = O.line(drawOf(c), k, LANG, U());
  $('zoom').innerHTML = `<div class="zc"><img src="${c.userData.canvas.toDataURL('image/jpeg', 0.9)}" alt=""><div class="zt">${lineHtml(l)}<button id="zclose">${U().close}</button></div></div>`;
  $('zoom').classList.add('on'); sfx.play('tick');
  $('zoom').onclick = (e) => { if (e.target.id === 'zoom' || e.target.id === 'zclose') $('zoom').classList.remove('on'); };
}

// ---------------- input ----------------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function hitCard(e) {
  const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
  const list = S.phase === 'pick' ? handList : S.spread; const meshes = list.flatMap((c) => [c.userData.front, c.userData.back]);
  const h = ray.intersectObjects(meshes, false)[0]; return h ? h.object.userData.root : null;
}
canvas.addEventListener('pointermove', (e) => { if (S.phase !== 'pick' || e.pointerType === 'touch') return; const c = hitCard(e); if (c !== hover) { hover = c; if (c) sfx.play('tick', 0.3); } canvas.style.cursor = c ? 'pointer' : ''; });
canvas.addEventListener('pointerdown', (e) => { sfx.unlock(); const c = hitCard(e); if (!c) return; if (S.phase === 'pick') pick(c); /* one tap = one card on touch too: a preview-first second tap is a trap for phone players from a link */ else if (S.phase === 'final') zoom(c); });

// ---------------- frame ----------------
function resize() {
  const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); composer.setPixelRatio(dpr); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2);
  cam.aspect = w / h; const portrait = cam.aspect < 1;
  const hf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect), needW = portrait ? 1.75 : 1.5;
  const dist = Math.max(portrait ? 1.7 : 2.25, needW / 2 / Math.tan(hf / 2) + 0.35);
  const dir = new THREE.Vector3(0, portrait ? 1.25 : 1.0, 0.95).normalize();
  S.camBase = new THREE.Vector3(0, TOP, 0.02).addScaledVector(dir, dist); S.camLook = new THREE.Vector3(0, TOP - 0.02, portrait ? 0.2 : 0.16);
  // close-up on the spread while the cards turn (fits the three cards + their auras), and the final framing beside / above the prophecy
  const needC = portrait ? 0.98 : 1.5, distC = Math.max(1.05, needC / 2 / Math.tan(hf / 2) + 0.2);
  // owner 11-13 "камера фокусируется на картах под углом": the close-up looks almost straight DOWN on the spread (cards read face-on), and the
  // final framing is a pure sideways / forward slide of that same camera (camera and target move together), never a turn
  const dirC = new THREE.Vector3(0, 1, 0.2).normalize();
  S.camClose = new THREE.Vector3(0, TOP, 0.0).addScaledVector(dirC, distC); S.lookClose = new THREE.Vector3(0, TOP, 0.0);
  const slide = portrait ? new THREE.Vector3(0, 0, 0.42) : new THREE.Vector3(0.36, 0, 0);
  S.camFinal = S.camClose.clone().add(slide).addScaledVector(dirC, 0.15); S.lookFinal = S.lookClose.clone().add(slide);
  cam.updateProjectionMatrix();
  fx.mat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
}
window.addEventListener('resize', resize);
const lp = new THREE.Vector3();
function labels() {
  const r = canvas.getBoundingClientRect();
  $('labels').querySelectorAll('.slotlabel').forEach((el) => { lp.copy(SLOTS[+el.dataset.k]).add(new THREE.Vector3(0, 0, CHm / 2 + 0.035)).project(cam); el.style.left = ((lp.x + 1) / 2) * r.width + 'px'; el.style.top = ((1 - lp.y) / 2) * r.height + 'px'; });
}
let last = performance.now(), T = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  // camera: slow breathing drift + shake
  const zt = S.phase === 'reveal' && S.spread.length === 3 ? 1 : S.phase === 'final' ? 2 : 0;
  S.z = S.z ?? 0; S.z += (zt - S.z) * (1 - Math.exp(-dt * 2.2));
  const z1 = Math.min(1, S.z), z2 = Math.max(0, S.z - 1);
  const cp = S.camBase.clone().lerp(S.camClose, z1).lerp(S.camFinal, z2), lk = S.camLook.clone().lerp(S.lookClose, z1).lerp(S.lookFinal, z2);
  cam.position.copy(cp).add(new THREE.Vector3(Math.sin(T * 0.25) * 0.03, Math.sin(T * 0.33) * 0.015, 0));
  if (shakeT > 0) { shakeT -= dt; const a = shakeA * (shakeT / 0.45); cam.position.add(new THREE.Vector3((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, 0)); if (shakeT <= 0) shakeA = 0; }
  cam.lookAt(lk);
  placeHand();
  if (S.phase === 'shuffle') { S.swirl += dt; for (const c of cards) if (c.userData.mode === 'swirl') swirlPose(c, S.swirl); }
  updateHand(dt); runTweens(dt);
  for (let i = shocks.length - 1; i >= 0; i--) { const s = shocks[i]; s.t += dt / 0.7; s.m.material.uniforms.uT.value = Math.min(1, s.t); s.m.scale.setScalar(0.5 * s.big + s.t * 0.9 * s.big); if (s.t >= 1) { scene.remove(s.m); s.m.material.dispose(); shocks.splice(i, 1); } }
  for (const c of cards) { c.userData.aura.material.uniforms.uTime.value = T; c.userData.front.material.uniforms.uTime.value = T; }
  tableRune.material.uniforms.uTime.value = T; floorRune.material.uniforms.uTime.value = T * 0.6;
  const pu = tableRune.material.uniforms.uPulse; pu.value = Math.max(0, pu.value - dt * 0.9); if (pu.value <= 0) tableRune.material.uniforms.uCol.value.lerp(new THREE.Color('#ffb84a'), dt);
  flash.intensity = Math.max(0, flash.intensity - dt * 30);
  candles.forEach((l, i) => (l.intensity = 0.42 + 0.14 * Math.sin(T * 11 + i * 3) * Math.sin(T * 7.3 + i) + (Math.random() - 0.5) * 0.15));
  orb.intensity = 0.8 + 0.3 * Math.sin(T * 1.7);
  // ambience: candle embers, orb sparkles, brew bubbles, room dust
  if (Math.random() < dt * 9) { const f = FLAMES[(Math.random() * FLAMES.length) | 0]; fx.emit({ p: new THREE.Vector3(f[0] + (Math.random() - 0.5) * 0.03, f[1] + 0.06, f[2]), v: new THREE.Vector3((Math.random() - 0.5) * 0.05, 0.18 + Math.random() * 0.1, 0), color: '#ffa040', life: 1.4, size: 0.008, drag: 0.4, flick: 1 }); }
  if (Math.random() < dt * 6) { const a = Math.random() * 6.28; fx.emit({ p: new THREE.Vector3(Math.cos(a) * 0.11, TOP + 0.22 + Math.sin(a) * 0.1, -0.44), v: new THREE.Vector3(0, 0.05, 0), color: '#b090ff', life: 1, size: 0.012, drag: 0.5, flick: 1 }); }
  if (Math.random() < dt * 4) fx.emit({ p: new THREE.Vector3(-0.5 + (Math.random() - 0.5) * 0.04, TOP + 0.3, -0.46), v: new THREE.Vector3(0, 0.1, 0), color: '#70ff80', life: 1.5, size: 0.012, drag: 0.2 });
  if (Math.random() < dt * 5) fx.emit({ p: new THREE.Vector3((Math.random() - 0.5) * 3, TOP + Math.random() * 1.2, (Math.random() - 0.5) * 2), v: new THREE.Vector3((Math.random() - 0.5) * 0.02, 0.01, 0), color: '#c0a0ff', life: 5, size: 0.01, drag: 0, alpha: 0.35 });
  fx.update(dt); labels();
  composer.render();
}

// ---------------- boot ----------------
const sfx = new Sfx('audio/');
if (store.get('jobtarot.mute') === '1') { sfx.setMuted(true); $('snd').classList.add('off'); }
async function boot() {
  resize(); requestAnimationFrame(frame);
  const prog = (k) => ($('bootfill').style.width = Math.round(k * 100) + '%');
  /* load BOTH subsets (the sample text has Cyrillic + Latin) before drawing the card faces into canvases: a canvas never redraws when a font arrives later */
  const fonts = Promise.race([Promise.all(['40px "Ruslan Display"', '30px "Alegreya"', 'bold 30px "Alegreya"', 'italic 30px "Alegreya"'].map((f) => document.fonts.load(f, 'Таро Tarot'))), wait(8)]).catch(() => {});
  const imgs = Promise.all(CARDS.map((c) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = `art/cards/${c.id}.jpg`; })));
  const models = loadModels((k) => prog(k * 0.8)).catch((e) => console.error('models', e));
  sfx.load(['shuffle', 'deal', 'slam', 'rise', 'flip', 'good', 'bad', 'chaos', 'prophecy', 'tick', 'click', 'music_main_loop']);
  const [im] = await Promise.all([imgs, fonts, models]);
  backTex = new THREE.CanvasTexture(drawBack()); backTex.colorSpace = THREE.SRGBColorSpace; backTex.anisotropy = 8;
  CARDS.forEach((d, i) => cards.push(makeCard(d, im[i])));
  stackDeck(); prog(1);
  renderIntro(); $('boot').classList.add('done'); $('intro').classList.add('on'); S.phase = 'intro';
  window.JT = { S, cards, startReading, pick: (i) => pick(handList[i]), zoom, U, setLang: (l) => (LANG = l) };   // test hook
}
boot();
