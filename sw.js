const CACHE='kalevala-1.2.1';
const FILES=['./','index.html','styles.css','app.js','icon.svg','manifest.webmanifest','data/kalevala_fi.json','data/kalevala_en.json','data/catalog.json'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request))));
