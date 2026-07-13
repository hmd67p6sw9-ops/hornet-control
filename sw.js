const CACHE_NAME = "hornet-control-static-v150-alpha1-modular";

const STATIC_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./utils.js",
  "./ui.js",
  "./api.js",
  "./scanner.js",
  "./aircraft.js",
  "./starlink.js",
  "./history.js",
  "./qr.js",
  "./print.js",
  "./dashboard.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_FILES);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function (name) {
              return name !== CACHE_NAME;
            })
            .map(function (name) {
              return caches.delete(name);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (event) {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, {
        cache: "no-store"
      }).catch(function () {
        return caches.match("./index.html");
      })
    );

    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then(function (networkResponse) {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const copy = networkResponse.clone();

        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, copy);
        });

        return networkResponse;
      });
    })
  );
});
