const CACHE="life-rpg-v10.2.0-direction-execution";
const ASSETS=[
  "./","./index.html",
  "./platform.js?v=10.2.0","./styles.css?v=10.2.0",
  "./core.js?v=10.2.0","./state.js?v=10.2.0","./finance.js?v=10.2.0","./imports.js?v=10.2.0","./work.js?v=10.2.0","./tennis.js?v=10.2.0","./knowledge.js?v=10.2.0","./gamification.js?v=10.2.0","./pwa.js?v=10.2.0","./ui.js?v=10.2.0","./bootstrap.js?v=10.2.0",
  "./life-os.js?v=10.2.0","./projects-os.js?v=10.2.0","./goals-os.js?v=10.2.0","./review-os.js?v=10.2.0","./calendar-os.js?v=10.2.0","./tasks-os.js?v=10.2.0","./routines-os.js?v=10.2.0","./inbox-os.js?v=10.2.0","./rules-os.js?v=10.2.0","./insights-os.js?v=10.2.0","./command-os.js?v=10.2.0",
  "./manifest.webmanifest?v=10.2.0","./icon-192.png","./icon-512.png"
];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("life-rpg-v")&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;const url=new URL(e.request.url);if(url.origin!==self.location.origin||url.searchParams.has("check"))return;e.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(e.request);if(cached)return cached;try{return await fetch(e.request)}catch(error){if(e.request.mode==="navigate")return cache.match("./index.html");throw error}}))});
self.addEventListener("message",e=>{if(e.data?.type==="SKIP_WAITING")self.skipWaiting();if(e.data?.type==="NOTIFY")self.registration.showNotification(e.data.title||"Life RPG",{body:e.data.body||"",icon:"./icon-192.png",badge:"./icon-192.png",tag:e.data.tag||"life-rpg"})});
