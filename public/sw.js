// Elle yazılmış servis çalışanı.
// - Gezinme ve index.html: ağ önce, ağ yoksa önbellek (çevrimdışı çalışır).
// - /assets/ (hash'li, değişmez): önbellek önce.
// - Diğer aynı kaynaklı GET: önbellek önce, arkada tazele.
// Yeni sürümde VERSION'ı artır; eski önbellekler activate'te silinir.
const VERSION = 'v2';
const CACHE = `kalip-ogrenme-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(['./', './index.html']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function store(req, res) {
  if (res && res.ok && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE).then((cache) => cache.put(req, copy));
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/index.html');
  const isAsset = url.pathname.includes('/assets/');

  if (isPage) {
    event.respondWith(
      fetch(req)
        .then((res) => store(req, res))
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html') || caches.match('./'))),
    );
    return;
  }

  if (isAsset) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => store(req, res))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => store(req, res)).catch(() => hit || Response.error());
      return hit || net;
    }),
  );
});
