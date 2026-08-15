/* ═══════════════════════════════════════════════════
   Service Worker — بركات المناسك v26.2
   ═══════════════════════════════════════════════════
   
   للتبديل بين الأوضاع:
     true  = وضع التطوير (Network First للملفات)
     false = وضع الإنتاج (Cache First كامل)
   
   غيّر السطر التالي فقط:
   ═══════════════════════════════════════════════════ */

var DEV_MODE = false;

/* ═══════════════════════════════════════════════════
   الإعدادات
   ═══════════════════════════════════════════════════ */

var CACHE_NAME = DEV_MODE ? 'barakat-dev-v26.2.0' : 'barakat-prod-v26.2.0';
var CACHE_OLD_PREFIX = 'barakat-';
var FONT_CACHE = 'barakat-fonts-v1';

var STATIC_ASSETS = [
    './icons/icon-48.png',
    './icons/icon-96.png',
    './icons/icon-192.png',
    './icons/icon-192-maskable.png',
    './icons/icon-512.png',
    './icons/icon-512-maskable.png',
    './icons/favicon-32.png',
    './icons/favicon-16.png'
];

var DEV_NO_CACHE = [
    './index.html',
    './style.css',
    './script.js',
    './migration.js',
    './config.js',
    './supabase-client.js',
    './supabase-db.js'
];

/* ملفات تُجلب دائماً من الشبكة أولاً (Network First)
   حتى في وضع الإنتاج — خاصة config.js الذي يحتوي
   على بيانات الاتصال التي يجب ألا تُخزّن نهائياً */
var NETWORK_FIRST = [
    './index.html',
    './config.js',
    './supabase-client.js',
    './supabase-db.js',
    './migration.js',
    './script.js'
];

/* ═══════════════════════════════════════════════════
   Install
   ═══════════════════════════════════════════════════ */

self.addEventListener('install', function(e) {
    if (DEV_MODE) {
        e.waitUntil(self.skipWaiting());
        return;
    }
    e.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(['./'].concat(STATIC_ASSETS));
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

/* ═══════════════════════════════════════════════════
   Activate — حذف كل الكاش القديم
   ═══════════════════════════════════════════════════ */

self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(names) {
            return Promise.all(
                names.map(function(name) {
                    if (name !== CACHE_NAME && name !== FONT_CACHE && name.indexOf(CACHE_OLD_PREFIX) === 0) {
                        return caches.delete(name);
                    }
                    return Promise.resolve();
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

/* ═══════════════════════════════════════════════════
   Fetch
   ═══════════════════════════════════════════════════ */

self.addEventListener('fetch', function(e) {
    var url = new URL(e.request.url);

    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        e.respondWith(
            caches.open(FONT_CACHE).then(function(cache) {
                return cache.match(e.request).then(function(cached) {
                    var fetchPromise = fetch(e.request).then(function(resp) {
                        if (resp && resp.status === 200) {
                            cache.put(e.request, resp.clone());
                        }
                        return resp;
                    }).catch(function() {
                        return cached;
                    });
                    return cached || fetchPromise;
                });
            })
        );
        return;
    }

    if (url.origin === self.location.origin) {

        /* ── ملفات حساسة: شبكة أولاً دائماً ── */
        var path = url.pathname.replace(/^\.\//, '/');
        var isNetworkFirst = false;
        for (var i = 0; i < NETWORK_FIRST.length; i++) {
            var p = NETWORK_FIRST[i].replace('./', '/');
            if (path === p || path === '/' + p) { isNetworkFirst = true; break; }
        }
        if (isNetworkFirst) {
            e.respondWith(
                fetch(e.request).then(function(resp) {
                    if (resp && resp.status === 200) {
                        var clone = resp.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(e.request, clone);
                        });
                    }
                    return resp;
                }).catch(function() {
                    return caches.match(e.request);
                })
            );
            return;
        }

        /* ── وضع التطوير: لا كاش للملفات المتغيرة ── */
        if (DEV_MODE) {
            var path = url.pathname.replace(/^\.\//, '/');
            var isNoCache = false;
            for (var i = 0; i < DEV_NO_CACHE.length; i++) {
                if (path === DEV_NO_CACHE[i] || path === '/' + DEV_NO_CACHE[i] || path === DEV_NO_CACHE[i].replace('./', '/')) {
                    isNoCache = true;
                    break;
                }
            }
            if (isNoCache) {
                e.respondWith(fetch(e.request));
                return;
            }
            e.respondWith(
                caches.match(e.request).then(function(cached) {
                    return cached || fetch(e.request);
                })
            );
            return;
        }

        /* ── وضع الإنتاج: كاش كامل ── */
        e.respondWith(
            caches.match(e.request).then(function(cached) {
                if (cached) {
                    var fetchPromise = fetch(e.request).then(function(resp) {
                        if (resp && resp.status === 200) {
                            caches.open(CACHE_NAME).then(function(cache) {
                                cache.put(e.request, resp.clone());
                            });
                        }
                        return resp;
                    }).catch(function() {});
                    return cached;
                }
                return fetch(e.request).then(function(resp) {
                    if (resp && resp.status === 200) {
                        var clone = resp.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(e.request, clone);
                        });
                    }
                    return resp;
                });
            })
        );
        return;
    }

    e.respondWith(
        fetch(e.request).then(function(resp) {
            return resp;
        }).catch(function() {
            return caches.match(e.request);
        })
    );
});

/* ── Message ── */
self.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
