var CACHE_NAME = 'goodarts-v3';
var STATIC_ASSETS = [
    '/',
    '/static/css/styles.css',
    '/static/css/art-theme.css',
    '/static/js/art-theme.js',
    '/static/js/api.js',
    '/static/js/app.js',
    '/static/js/components/rating-stars.js',
    '/static/js/components/artwork-card.js',
    '/static/js/components/swipe-deck.js',
    '/static/js/components/expandable.js',
    '/static/js/components/photo-upload.js',
    '/static/js/views/feed.js',
    '/static/js/views/events.js',
    '/static/js/views/search.js',
    '/static/js/views/collection.js',
    '/static/js/views/artwork-detail.js',
    '/static/js/views/onboarding.js',
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(STATIC_ASSETS).then(function() {
                return self.skipWaiting();
            });
        })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        Promise.all([
            clients.claim(),
            caches.keys().then(function(names) {
                return Promise.all(
                    names.filter(function(n) { return n !== CACHE_NAME; })
                         .map(function(n) { return caches.delete(n); })
                );
            })
        ])
    );
});

self.addEventListener('fetch', function(event) {
    var url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request).then(function(resp) {
                var clone = resp.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    if (event.request.method === 'GET') cache.put(event.request, clone);
                });
                return resp;
            }).catch(function() {
                return caches.match(event.request);
            })
        );
        return;
    }
    event.respondWith(
        caches.match(event.request).then(function(resp) {
            return resp || fetch(event.request);
        })
    );
});
