// Phase 1 tối giản của "Local Fallback": cache app shell để mở được app khi mất mạng.
// Chưa xử lý sync nền thật sự (iOS Safari hạn chế Background Sync API) —
// đây là nơi để mở rộng ở các phase sau nếu Apple hỗ trợ thêm.

const CACHE_NAME = "coai-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/gemini-client.js",
  "./js/tool-registry.js",
  "./js/tools/example-tools.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Không cache request tới Gemini API — luôn cần dữ liệu mới/gọi mạng thật.
  if (event.request.url.includes("generativelanguage.googleapis.com")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
