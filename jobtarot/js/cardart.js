// JobTarot card faces and the card back, drawn once into canvases (then used as textures and as the zoom image).
// Layout (512 x 788, the card is 0.26 x 0.40 m): a chunky gilded frame, a gothic-arch picture window holding the SdfForge miniature,
// a numeral medallion on top, a ribbon with the name, the keyword under it and a meaning gem (gold sun / green skull / violet eye).
export const CW = 512, CH = 788;
const RIBBON = { good: ['#c8962e', '#7a5214'], bad: ['#3a7a3a', '#173a1a'], chaos: ['#5a3a9a', '#26164a'] };
const GEM = { good: ['#fff2a0', '#e0a020', '#7a4a08'], bad: ['#c8ff90', '#3aa040', '#0e3a14'], chaos: ['#f0d8ff', '#9050ff', '#2a0a5a'] };

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function arch(g, x, y, w, h) { const top = w * 0.42; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + top); g.quadraticCurveTo(x, y + top * 0.15, x + w / 2, y); g.quadraticCurveTo(x + w, y + top * 0.15, x + w, y + top); g.lineTo(x + w, y + h); g.closePath(); }
function gold(g, x0, y0, x1, y1) { const q = g.createLinearGradient(x0, y0, x1, y1); q.addColorStop(0, '#fff0b0'); q.addColorStop(0.25, '#d9a441'); q.addColorStop(0.5, '#8a5a18'); q.addColorStop(0.72, '#f2cc6a'); q.addColorStop(1, '#7a4c12'); return q; }
function grain(g, w, h, n, a) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,240,200' : '40,20,10'},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } }
function fitText(g, text, maxW, size, font) { let s = size; do { g.font = `${s}px ${font}`; s -= 1; } while (g.measureText(text).width > maxW && s > 10); return s + 1; }

function gemSymbol(g, v, cx, cy, r) {
  g.save(); g.translate(cx, cy); g.strokeStyle = 'rgba(30,14,4,0.85)'; g.fillStyle = 'rgba(30,14,4,0.85)'; g.lineWidth = 3;
  if (v === 'good') { g.beginPath(); g.arc(0, 0, r * 0.32, 0, Math.PI * 2); g.fill(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45); g.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72); g.stroke(); } }
  else if (v === 'bad') { g.beginPath(); g.ellipse(0, -r * 0.08, r * 0.42, r * 0.38, 0, 0, Math.PI * 2); g.fill(); g.fillRect(-r * 0.24, r * 0.18, r * 0.48, r * 0.3); g.fillStyle = GEM.bad[1]; g.beginPath(); g.arc(-r * 0.16, -r * 0.08, r * 0.11, 0, 7); g.arc(r * 0.16, -r * 0.08, r * 0.11, 0, 7); g.fill(); }
  else { g.beginPath(); g.ellipse(0, 0, r * 0.62, r * 0.3, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, r * 0.17, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

export function drawFront(card, lang, img) {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const g = c.getContext('2d'), T = card[lang];
  // outer frame: gilded, with a dark bevel
  rr(g, 4, 4, CW - 8, CH - 8, 34); g.fillStyle = gold(g, 0, 0, CW, CH); g.fill();
  rr(g, 4, 4, CW - 8, CH - 8, 34); g.lineWidth = 6; g.strokeStyle = '#3a220a'; g.stroke();
  rr(g, 20, 20, CW - 40, CH - 40, 24); g.fillStyle = '#2a1608'; g.fill();
  // parchment body
  rr(g, 28, 28, CW - 56, CH - 56, 20); const pq = g.createRadialGradient(CW / 2, CH * 0.45, 40, CW / 2, CH / 2, CH * 0.7); pq.addColorStop(0, '#f4e6c0'); pq.addColorStop(1, '#c8a870'); g.fillStyle = pq; g.fill();
  g.save(); rr(g, 28, 28, CW - 56, CH - 56, 20); g.clip(); grain(g, CW, CH, 2600, 0.12); g.restore();
  // picture window (gothic arch) with the miniature
  const wx = 52, wy = 62, ww = CW - 104, wh = 470;
  g.save(); arch(g, wx, wy, ww, wh); g.clip();
  if (img) { const k = Math.max(ww / img.width, wh / img.height), iw = img.width * k, ih = img.height * k; g.drawImage(img, wx + (ww - iw) / 2, wy + wh - ih, iw, ih); }
  const sh = g.createLinearGradient(0, wy, 0, wy + wh); sh.addColorStop(0, 'rgba(0,0,0,0.25)'); sh.addColorStop(0.2, 'rgba(0,0,0,0)'); sh.addColorStop(0.9, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = sh; g.fillRect(wx, wy, ww, wh);
  g.restore();
  arch(g, wx, wy, ww, wh); g.lineWidth = 12; g.strokeStyle = gold(g, wx, wy, wx + ww, wy + wh); g.stroke();
  arch(g, wx, wy, ww, wh); g.lineWidth = 2.5; g.strokeStyle = '#3a220a'; g.stroke();
  arch(g, wx - 7, wy - 7, ww + 14, wh + 7); g.lineWidth = 2; g.strokeStyle = 'rgba(58,34,10,0.8)'; g.stroke();
  // numeral medallion
  g.beginPath(); g.arc(CW / 2, 40, 30, 0, Math.PI * 2); g.fillStyle = gold(g, CW / 2 - 30, 10, CW / 2 + 30, 70); g.fill(); g.lineWidth = 4; g.strokeStyle = '#3a220a'; g.stroke();
  g.beginPath(); g.arc(CW / 2, 40, 22, 0, Math.PI * 2); g.fillStyle = '#3a1a3a'; g.fill();
  g.fillStyle = '#ffe9a8'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, card.n, 38, 24, '"Ruslan Display", serif'); g.fillText(card.n, CW / 2, 42);
  // ribbon with the name
  const ry = 552, rc = RIBBON[card.v];
  g.beginPath(); g.moveTo(24, ry); g.lineTo(CW - 24, ry); g.lineTo(CW - 46, ry + 38); g.lineTo(CW - 24, ry + 76); g.lineTo(24, ry + 76); g.lineTo(46, ry + 38); g.closePath();
  const rq = g.createLinearGradient(0, ry, 0, ry + 76); rq.addColorStop(0, rc[0]); rq.addColorStop(1, rc[1]); g.fillStyle = rq; g.fill(); g.lineWidth = 4; g.strokeStyle = '#2a1608'; g.stroke();
  g.fillStyle = '#fff3d0'; g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
  fitText(g, T.name, CW - 120, 36, '"Ruslan Display", serif'); g.fillText(T.name, CW / 2, ry + 40);
  g.shadowBlur = 0; g.shadowOffsetY = 0;
  // keyword
  g.fillStyle = '#4a2810'; fitText(g, T.arc, CW - 120, 30, '"Ruslan Display", serif'); g.fillText(T.arc, CW / 2, 668);   /* the real arcanum this card is (owner 11-13: real tarot rules) */
  // meaning gem
  const gq = g.createRadialGradient(CW / 2 - 8, 728, 4, CW / 2, 736, 34), gc = GEM[card.v]; gq.addColorStop(0, gc[0]); gq.addColorStop(0.55, gc[1]); gq.addColorStop(1, gc[2]);
  g.beginPath(); g.arc(CW / 2, 734, 34, 0, Math.PI * 2); g.fillStyle = gold(g, CW / 2 - 34, 700, CW / 2 + 34, 768); g.fill(); g.lineWidth = 3; g.strokeStyle = '#3a220a'; g.stroke();
  g.beginPath(); g.arc(CW / 2, 734, 26, 0, Math.PI * 2); g.fillStyle = gq; g.fill(); gemSymbol(g, card.v, CW / 2, 734, 26);
  // corner studs
  for (const [x, y] of [[44, 44], [CW - 44, 44], [44, CH - 44], [CW - 44, CH - 44]]) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fillStyle = gold(g, x - 9, y - 9, x + 9, y + 9); g.fill(); g.lineWidth = 2; g.strokeStyle = '#3a220a'; g.stroke(); }
  return c;
}

export function drawBack() {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const g = c.getContext('2d');
  rr(g, 4, 4, CW - 8, CH - 8, 34); g.fillStyle = gold(g, 0, 0, CW, CH); g.fill(); g.lineWidth = 6; g.strokeStyle = '#3a220a'; g.stroke();
  rr(g, 22, 22, CW - 44, CH - 44, 24); const q = g.createRadialGradient(CW / 2, CH / 2, 20, CW / 2, CH / 2, CH * 0.6); q.addColorStop(0, '#5a2a7a'); q.addColorStop(0.6, '#2a0f3e'); q.addColorStop(1, '#12061c'); g.fillStyle = q; g.fill();
  g.save(); rr(g, 22, 22, CW - 44, CH - 44, 24); g.clip();
  g.strokeStyle = 'rgba(230,180,90,0.16)'; g.lineWidth = 1.5;
  for (let i = -20; i < 40; i++) { g.beginPath(); g.moveTo(i * 30, 0); g.lineTo(i * 30 + CH, CH); g.stroke(); g.beginPath(); g.moveTo(i * 30, 0); g.lineTo(i * 30 - CH, CH); g.stroke(); }
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,230,160,${Math.random() * 0.7})`; g.beginPath(); g.arc(Math.random() * CW, Math.random() * CH, Math.random() * 1.8, 0, 7); g.fill(); }
  g.restore();
  rr(g, 40, 40, CW - 80, CH - 80, 16); g.lineWidth = 3; g.strokeStyle = '#d9a441'; g.stroke();
  const cx = CW / 2, cy = CH / 2; g.strokeStyle = '#e8b858'; g.lineWidth = 3;
  for (const R of [150, 138, 92]) { g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke(); }
  for (let k = 0; k < 2; k++) { g.beginPath(); for (let i = 0; i <= 3; i++) { const a = (i / 3) * Math.PI * 2 + k * Math.PI + Math.PI / 2; const x = cx + Math.cos(a) * 138, y = cy + Math.sin(a) * 138; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 150, cy + Math.sin(a) * 150); g.lineTo(cx + Math.cos(a) * 172, cy + Math.sin(a) * 172); g.stroke(); }
  // the all-seeing eye
  g.beginPath(); g.moveTo(cx - 70, cy); g.quadraticCurveTo(cx, cy - 58, cx + 70, cy); g.quadraticCurveTo(cx, cy + 58, cx - 70, cy); g.closePath(); g.fillStyle = '#f4e6c0'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#d9a441'; g.stroke();
  const iq = g.createRadialGradient(cx, cy, 2, cx, cy, 26); iq.addColorStop(0, '#80f0ff'); iq.addColorStop(1, '#1a4a8a'); g.beginPath(); g.arc(cx, cy, 26, 0, 7); g.fillStyle = iq; g.fill();
  g.beginPath(); g.arc(cx, cy, 10, 0, 7); g.fillStyle = '#0a0410'; g.fill();
  g.fillStyle = '#e8b858'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '30px "Ruslan Display", serif'; g.fillText('ORACVLVM', cx, 110); g.fillText('LABORIS', cx, CH - 110);
  return c;
}
