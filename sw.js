const CACHE="life-rpg-v7.0.1-20260920";
const ASSETS=["./","./index.html","./styles.css?v=7.0.1","./app.js?v=7.0.1","./manifest.webmanifest?v=7.0.1","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;const url=new URL(e.request.url);if(url.origin!==self.location.origin)return;e.respondWith(fetch(e.request).then(resp=>{if(resp&&resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return resp}).catch(()=>caches.match(e.request).then(cached=>cached||(e.request.mode==="navigate"?caches.match("./index.html"):undefined))))});
self.addEventListener("message",e=>{if(e.data?.type==="SKIP_WAITING")self.skipWaiting();if(e.data?.type==="NOTIFY")self.registration.showNotification(e.data.title||"Life RPG",{body:e.data.body||"",icon:"./icon-192.png",badge:"./icon-192.png",tag:e.data.tag||"life-rpg"})});
