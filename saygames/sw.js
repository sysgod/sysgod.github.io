// Serves the decrypted prototype files from the browser's own Cache (written by play/index.html after the team password unlocked them).
// Nothing here ever fetches from the network for /play/run/*: the site itself only holds ciphertext.
var BASE = new URL('./', self.location.href).href, RUN = BASE + 'run/';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url), key = u.origin + u.pathname;
  if (key.indexOf(RUN) !== 0) return;
  if (key.charAt(key.length - 1) === '/') key += 'index.html';
  e.respondWith(caches.open('pf-run').then(function (c) { return c.match(key); }).then(function (r) { return r || new Response('Not unlocked on this device: open the team page and press Play.', { status: 404, headers: { 'Content-Type': 'text/plain' } }); }));
});
