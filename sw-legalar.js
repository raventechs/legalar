// sw-legalar.js — legalAR v2.0
const CACHE_NAME = 'legalar-v2.0';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // No interceptar Firebase, Netlify Functions ni Google APIs
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('securetoken.googleapis.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.pathname.includes('/.netlify/functions/') ||
      url.pathname.includes('/__/auth/')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clon = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clon));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
