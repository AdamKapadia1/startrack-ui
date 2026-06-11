const CACHE = 'startrack-v1';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>StarTrack AI — Offline</title>
<style>
  body{margin:0;background:#0a0f0c;color:#e8f0ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}
  .wrap{max-width:320px}
  .icon{font-size:48px;margin-bottom:16px}
  h1{font-size:20px;font-weight:700;margin:0 0 10px;color:#1D9E75}
  p{font-size:14px;color:#7a9187;line-height:1.6;margin:0}
</style>
</head>
<body>
<div class="wrap">
  <div class="icon">📡</div>
  <h1>StarTrack AI</h1>
  <p>You are offline. Satellite data will resume when connected.</p>
</div>
</body>
</html>`;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Only handle GET requests; skip cross-origin API calls
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        // Cache successful responses for app shell
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then(cached =>
          cached ?? new Response(OFFLINE_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          })
        )
      )
  );
});
