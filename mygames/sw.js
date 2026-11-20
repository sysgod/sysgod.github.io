// Serves the decrypted prototype files from the browser's own Cache (written by play/index.html after the team password unlocked them).
// Nothing here ever fetches from the network for /play/run/*: the site itself only holds ciphertext.
var BASE = new URL('./', self.location.href).href, RUN = BASE + 'run/';
function canon(p) { return p.split('/').map(function (s) { try { return encodeURIComponent(decodeURIComponent(s)); } catch (x) { return s; } }).join('/'); }
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  // The page stores files under encodeURIComponent'd segments ('@' -> %40) but the browser requests a literal '@' (enemy_goblin@2x.json): without canonicalising,
  // every file whose name has @ , + $ & = : ... missed the cache -> 404 -> the game silently fell back to its old art (WordDefense 2026-10-02). canon() makes both sides equal.
  var u = new URL(e.request.url), key = u.origin + canon(u.pathname);
  if (key.indexOf(RUN) !== 0) return;
  if (key.charAt(key.length - 1) === '/') key += 'index.html';
  e.respondWith(caches.open('pf-run').then(function (c) { return c.match(key); }).then(function (r) { if (!r) return r; var h = new Headers(r.headers); h.set('Cache-Control', 'no-store'); return new Response(r.body, { status: r.status, headers: h }); }).then(function (r) { return r || new Response('Not unlocked on this device: open the team page and press Play.', { status: 404, headers: { 'Content-Type': 'text/plain' } }); }));
});
