// JobTarot shaders. Aura kinds follow the card's meaning: 0 = good (holy gold rays + sparkles), 1 = bad (cursed green-violet flames
// licking upward + smoke), 2 = chaos (arcane violet-cyan swirl with lightning threads). No pow() of a value that can be 0 (ANGLE NaN trap).
import * as THREE from 'three';

const NOISE = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
float sdRBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
`;

// the aura plane lies under the card (same transform), PAD x larger; uv -> card space in metres
export function auraMaterial(kind, cardW, cardH, pad) {
  const C = [[new THREE.Color('#ffd36a'), new THREE.Color('#fff4c8')], [new THREE.Color('#5cff7a'), new THREE.Color('#b040ff')], [new THREE.Color('#7a5cff'), new THREE.Color('#40e8ff')]][kind];
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uKind: { value: kind }, uC1: { value: C[0] }, uC2: { value: C[1] },
      uHalf: { value: new THREE.Vector2(cardW / 2, cardH / 2) }, uSize: { value: new THREE.Vector2(cardW * pad, cardH * pad) }, uBoost: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uAlpha, uKind, uBoost; uniform vec3 uC1, uC2; uniform vec2 uHalf, uSize; varying vec2 vUv;
${NOISE}
void main(){
  vec2 p = (vUv - 0.5) * uSize;                  // metres, card centre = 0, +y = card top
  float d = sdRBox(p, uHalf, 0.018);             // > 0 outside the card
  float t = uTime, a = atan(p.y, p.x);
  vec3 col = vec3(0.0); float k = 0.0;
  if (uKind < 0.5) {                             // GOOD: holy light
    float glow = exp(-max(d, 0.0) * 26.0);
    float rays = 0.5 + 0.5 * sin(a * 13.0 + t * 0.9) * sin(a * 7.0 - t * 1.3);
    rays = rays * rays * rays * exp(-max(d, 0.0) * 9.0);
    vec2 g = p * 60.0; vec2 cell = floor(g); float sp = h21(cell);
    float tw = step(0.93, sp) * (0.5 + 0.5 * sin(t * 4.0 + sp * 40.0)) * smoothstep(0.4, 0.0, length(fract(g) - 0.5)) * exp(-max(d, 0.0) * 10.0);
    k = glow * 0.9 + rays * 0.8 + tw * 1.6;
    col = mix(uC1, uC2, clamp(glow + tw, 0.0, 1.0));
  } else if (uKind < 1.5) {                      // BAD: cursed flames rising from the edges
    vec2 q = vec2(p.x * 9.0, p.y * 6.0 - t * 1.6);
    float n = fbm(q + fbm(q * 0.7 + t * 0.3));
    float rise = clamp((p.y + uHalf.y + 0.1) / (uHalf.y * 2.4), 0.0, 1.0);
    float flame = smoothstep(0.0, 0.55, n * 1.25 - max(d, 0.0) * (11.0 - rise * 5.0));
    float smoke = fbm(p * 7.0 + vec2(0.0, -t * 0.6)) * exp(-max(d, 0.0) * 8.0);
    k = flame * 1.25 + smoke * 0.25 + exp(-max(d, 0.0) * 40.0) * 0.6;
    col = mix(uC2, uC1, clamp(flame * 1.3 - 0.15, 0.0, 1.0));
  } else {                                       // CHAOS: arcane swirl + lightning threads
    float r = length(p);
    float sw = a + r * 9.0 - t * 1.2;
    vec2 q = vec2(cos(sw), sin(sw)) * r * 7.0;
    float n = fbm(q + t * 0.2);
    float band = exp(-max(d, 0.0) * 14.0) * (0.45 + n);
    float bolt = abs(fbm(vec2(a * 3.0, t * 2.0)) - 0.5);
    bolt = smoothstep(0.035, 0.0, bolt) * exp(-max(d, 0.0) * 10.0) * step(0.0, d);
    k = band + bolt * 1.4 + exp(-max(d, 0.0) * 40.0) * 0.5;
    col = mix(uC1, uC2, 0.5 + 0.5 * sin(a * 2.0 + t + n * 4.0));
  }
  k *= step(-0.004, d) * uAlpha * (0.45 + uBoost * 0.7);   /* owner 11-13: "приглуши немного эффекты" */
  float edge = smoothstep(0.5, 0.42, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));   // fade at the quad border
  gl_FragColor = vec4(col * k * edge, 1.0);
}` });
}

// the card front: printed texture + a foil sheen that sweeps with the view angle and time; good cards get a stronger gold foil
export function cardFrontMaterial(tex, kind) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: tex }, uTime: { value: 0 }, uFoil: { value: kind === 0 ? 1 : 0.45 }, uLit: { value: 0 }, uTint: { value: new THREE.Color(['#ffe9a0', '#9cffb0', '#c0a8ff'][kind]) } },
    vertexShader: `varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uTime, uFoil, uLit; uniform vec3 uTint; varying vec2 vUv; varying vec3 vN, vV;
void main(){
  vec4 c = texture2D(uMap, vUv);
  float s = vUv.x * 0.8 + vUv.y * 0.6 + dot(vN, vV) * 0.6 - uTime * 0.18;
  float band = smoothstep(0.08, 0.0, abs(fract(s) - 0.5) - 0.02);
  float lum = dot(c.rgb, vec3(0.3, 0.59, 0.11));
  vec3 foil = uTint * band * (0.25 + lum) * uFoil;
  vec3 col = c.rgb * (0.8 + 0.25 * uLit) + foil * 0.35;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}` });
}

// the transmutation circle painted on the table: rings, a hexagram, rune ticks, slow rotation; uPulse flashes on each reveal
export function circleMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPulse: { value: 0 }, uCol: { value: new THREE.Color('#ffb84a') } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uPulse; uniform vec3 uCol; varying vec2 vUv;
${NOISE}
float ring(float r, float R, float w){ return smoothstep(w, 0.0, abs(r - R)); }
float seg(vec2 p, vec2 a, vec2 b, float w){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return smoothstep(w, 0.0, length(pa - ba * h)); }
void main(){
  vec2 p = (vUv - 0.5) * vec2(1.7, 1.1);
  float r = length(p), a = atan(p.y, p.x), t = uTime * 0.05;
  float k = ring(r, 0.5, 0.004) + ring(r, 0.47, 0.0025) + ring(r, 0.3, 0.003) + ring(r, 0.12, 0.003);
  float ra = a + t; float tick = step(0.47, r) * step(r, 0.5) * smoothstep(0.08, 0.0, abs(fract(ra * 36.0 / 6.2832) - 0.5) - 0.38);
  k += tick * 0.8;
  float rb = a - t * 1.6; float glyph = step(0.31, r) * step(r, 0.46) * step(0.72, vn(vec2(floor(rb * 24.0 / 6.2832) * 3.1, floor(r * 60.0)))) * 0.5;
  k += glyph * step(0.5, fract(rb * 24.0 / 6.2832 + 0.25));
  for (int i = 0; i < 6; i++){ float a0 = float(i) * 2.0944 * 0.5 * 2.0 + t * 2.0; vec2 A = vec2(cos(a0), sin(a0)) * 0.47; vec2 B = vec2(cos(a0 + 2.0944), sin(a0 + 2.0944)) * 0.47; k += seg(p, A, B, 0.003) * 0.7; }
  for (int i = 0; i < 6; i++){ float a0 = float(i) * 1.0472 + t * 2.0; vec2 c = vec2(cos(a0), sin(a0)) * 0.3; k += ring(length(p - c), 0.05, 0.0025) * 0.8; }
  float flick = 0.75 + 0.25 * vn(vec2(uTime * 1.5, 0.0));
  float fade = smoothstep(0.62, 0.5, r);
  gl_FragColor = vec4(uCol * k * fade * (0.22 * flick + uPulse * 0.6), 1.0);
}` });
}

// soft additive particles (sparks, embers, dust, bursts)
export function particleMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uScale: { value: 400 } },
    vertexShader: `attribute float aSize; attribute vec4 aCol; varying vec4 vCol; uniform float uScale;
void main(){ vCol = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.05, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec4 vCol; void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); float a = smoothstep(0.5, 0.0, d); a = a * a; gl_FragColor = vec4(vCol.rgb * vCol.a * a, 1.0); }` });
}

// a shock ring on the table under a card that slams down / flips
export function shockMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color(color) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT; uniform vec3 uCol; varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; float R = uT; float k = smoothstep(0.08, 0.0, abs(r - R)) * (1.0 - uT); k += smoothstep(R, 0.0, r) * 0.25 * (1.0 - uT); gl_FragColor = vec4(uCol * k, 1.0); }` });
}
