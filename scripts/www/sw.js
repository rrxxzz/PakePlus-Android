/* 掼蛋纪事 — Service Worker：全量离线缓存 */
const CACHE = 'gd-chronicle-v1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;
    try {
      const res = await fetch(e.request);
      /* 运行时缓存：站点资源 + Google Fonts（CSS 与 woff2） */
      if (res && (res.ok || res.type === 'opaque')){
        const c = await caches.open(CACHE);
        c.put(e.request, res.clone());
      }
      return res;
    } catch (err) {
      /* 断网时：页面导航兜底到缓存的 index.html */
      if (e.request.mode === 'navigate'){
        const nav = await caches.match('./index.html');
        if (nav) return nav;
      }
      return new Response('离线中', { status: 503, statusText: 'offline' });
    }
  })());
});
