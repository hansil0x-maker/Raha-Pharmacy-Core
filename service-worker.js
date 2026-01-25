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

// حدث الجلب (Fetch): استراتيجية هجينة (Network-First للبرمجيات، Cache-First للأصول)
self.addEventListener('fetch', (event) => {
  // استثناء الطلبات التي ليست GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isCodeFile = 
    url.pathname.endsWith('.tsx') || 
    url.pathname.endsWith('.ts') || 
    url.pathname.endsWith('.js') || 
    url.pathname === '/' || 
    url.pathname.endsWith('index.html');

  if (isCodeFile) {
    // استراتيجية الشبكة أولاً (Network-First) للملفات البرمجية لضمان التحديث الفوري
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // في حالة فشل الشبكة (أوفلاين)، ابحث في الكاش
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            // إذا لم يوجد في الكاش وكان طلباً للمسار الأساسي، أرجع صفحة الأوفلاين
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
          });
        })
    );
  } else {
    // استراتيجية الكاش أولاً (Cache-First) للصور والخطوط والمكتبات الخارجية لضمان السرعة
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        }).catch(() => {
          // صمت عند الفشل للأصول غير الضرورية
        });
      })
    );
  }
});