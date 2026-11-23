// PrototypeForge team area - shared crypto/pack helpers. ONE file used by the browser page (play/index.html) and by Node
// (teamsite/publisher.js + selftest.js), so the published format and the reader can never drift apart.
//   key   = PBKDF2-SHA256(password, meta.salt, meta.iter) -> AES-256-GCM
//   blob  = iv(12) | ciphertext+tag          (catalog.bin = JSON, p/<id>.bin = gzip(pack))
//   pack  = u32le headerLen | header JSON [{p: path, n: size, t: mime}] | file bytes back to back
(function (root) {
  'use strict';
  var subtle = (root.crypto || require('node:crypto').webcrypto).subtle, getRandom = function (n) { return (root.crypto || require('node:crypto').webcrypto).getRandomValues(new Uint8Array(n)); };
  var enc = new TextEncoder(), dec = new TextDecoder();
  function b64e(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return (root.btoa || function (x) { return Buffer.from(x, 'binary').toString('base64'); })(s); }
  function b64d(s) { var b = (root.atob || function (x) { return Buffer.from(x, 'base64').toString('binary'); })(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  async function deriveKey(password, meta) {
    var base = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', salt: b64d(meta.salt), iterations: meta.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }
  async function exportKey(key) { return b64e(new Uint8Array(await subtle.exportKey('raw', key))); }
  function importKey(b64) { return subtle.importKey('raw', b64d(b64), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']); }
  async function encrypt(key, data) {
    var iv = getRandom(12), ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, data)), out = new Uint8Array(12 + ct.length);
    out.set(iv, 0); out.set(ct, 12); return out;
  }
  async function decrypt(key, buf) { var u = new Uint8Array(buf); return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, key, u.slice(12))); }
  async function gunzip(u8) { var ds = new DecompressionStream('gzip'); return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer()); }
  function pack(files) {   // files: [{p, t, bytes(Uint8Array)}]
    var header = enc.encode(JSON.stringify(files.map(function (f) { return { p: f.p, n: f.bytes.length, t: f.t }; })));
    var total = 4 + header.length; files.forEach(function (f) { total += f.bytes.length; });
    var out = new Uint8Array(total), dv = new DataView(out.buffer); dv.setUint32(0, header.length, true); out.set(header, 4); var o = 4 + header.length;
    files.forEach(function (f) { out.set(f.bytes, o); o += f.bytes.length; }); return out;
  }
  function unpack(u8) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), hl = dv.getUint32(0, true), hdr = JSON.parse(dec.decode(u8.subarray(4, 4 + hl))), o = 4 + hl, out = [];
    hdr.forEach(function (h) { out.push({ p: h.p, t: h.t, bytes: u8.subarray(o, o + h.n) }); o += h.n; }); return out;
  }
  function newMeta() { return { v: 1, kdf: 'PBKDF2-SHA256', iter: 600000, salt: b64e(getRandom(16)) }; }
  var api = { b64e: b64e, b64d: b64d, deriveKey: deriveKey, exportKey: exportKey, importKey: importKey, encrypt: encrypt, decrypt: decrypt, gunzip: gunzip, pack: pack, unpack: unpack, newMeta: newMeta };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PFCrypto = api;
})(typeof self !== 'undefined' ? self : this);
