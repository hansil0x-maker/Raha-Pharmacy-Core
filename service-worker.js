
const CACHE_NAME = 'raha-pro-v5-static';
const OFFLINE_URL = '/index.html';

// قائمة الملفات الأساسية للتشغيل (Hard Cache)
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.tsx',
  '/App.tsx',
  '/db.ts',
  '/types.ts',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;700;900&display=swap',
  'https://esm.sh/lucide-react@^0.562.0',
  'https://esm.sh/react@^19.2.3',
  'https://esm.sh/react-dom@^19.2.3/',
  'https://esm.sh/dexie@^4.2.1',
  'https://cdn-icons-png.flaticon.com/512/4320/4320337.png'
];

// حدث التثبيت: تخزين الملفات فوراً
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Raha Pro SW: Starting Pre-cache...');
      return cache.addAll(ASSETS_TO_CACHE).then(() => {
        console.log('App is Offline Ready'); // الرسالة المطلوبة عند نجاح التخزين
      });
    })
  );
  self.skipWaiting();
});

// حدث التفعيل: مسح الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// حدث الجلب (Fetch): استراتيجية Cache-First الصارمة
self.addEventListener('fetch', (event) => {
  // استثناء الطلبات التي ليست GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 1. إذا وجد في الكاش، أرجعه فوراً (Cache-First)
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. إذا لم يوجد، اطلبه من الشبكة
      return fetch(event.request).then((networkResponse) => {
        // فحص صحة الاستجابة قبل تخزينها
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && !event.request.url.startsWith('https://')) {
          return networkResponse;
        }

        // تخزين النسخة الجديدة في الكاش للاستخدام اللاحق
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // 3. في حالة فشل الشبكة تماماً (أوفلاين) وفقدان الملف من الكاش
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});
