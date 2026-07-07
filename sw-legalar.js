// sw-legalar.js — legalAR v2.0
const CACHE_NAME = 'legalar-v2.0';
const SHELL = [
  '/legalar/',
  '/legalar/legalar.html',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('securetoken.googleapis.com') ||
      url.pathname.includes('/.netlify/functions/')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 &&
            (url.origin === self.location.origin ||
             url.hostname.includes('googleapis.com') ||
             url.hostname.includes('gstatic.com'))) {
          const clon = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clon));
        }
        return res;
      }).catch(() => {
        if (e.request.mode === 'navigate') return caches.match('/legalar/legalar.html');
      });
    })
  );
});
