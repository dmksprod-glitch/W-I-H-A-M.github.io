// Defines the cache name, including a version string.
const CACHE_NAME = "wiham-cache-v7";

// Lists the application files to be cached for offline availability.
const urlsToCache = [
    "/",
    "/index.html",
    "/locales.json",
    "/css/style.css",
    "/css/rulesHelp.css",
    "/js/main.js",
    "/js/data.js",
    "/js/locales.js",
    "/js/meta.js",
    "/js/npcEditor.js",
    "/js/objectEditor.js",
    "/js/eventEditor.js",
    "/js/grid.js",
    "/js/placeEditor.js",
    "/js/timelineEditor.js",
    "/js/editScenario.js",
    "/js/inventory.js",
    "/js/menunavigation.js",
    "/js/export.js",
    "/js/import.js",
    "/js/notification.js",
    "/js/cockpit.js",
    "/js/audio.js",
    "/js/db.js",
    "/js/htbahRules.js",
    "/assets/logo.png",
    "/assets/favicon.ico",
    "/assets/default_place.png",
    "/assets/default_object.png",
    "/assets/default_npc.png"
];

/**
 * Handles the 'install' event for the service worker.
 * Opens the specified cache and stores the predefined URLs.
 */
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(urlsToCache);
        }).then(() => self.skipWaiting())
    );
});

/**
 * Handles the 'activate' event for the service worker.
 * Cleans up old caches, keeping only the current cache version.
 */
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

/**
 * Intercepts fetch requests:
 * 1) Attempts to fetch the resource from the network.
 * 2) If the request succeeds, clones the response and caches it.
 * 3) If the request fails, attempts to serve the resource from the cache.
 * 4) Falls back to the index.html if no cached resource is found.
 */
self.addEventListener("fetch", event => {
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then(cachedResponse => {
                    return cachedResponse || caches.match("/index.html");
                });
            })
    );
});
