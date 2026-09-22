const CACHE="life-rpg-v11.0.0-core-intelligence";
const ASSETS=[
  "./","./index.html",
  "./platform.js?v=11.0.0","./styles.css?v=11.0.0",
  "./core.js?v=11.0.0","./state.js?v=11.0.0","./finance.js?v=11.0.0","./imports.js?v=11.0.0","./work.js?v=11.0.0","./tennis.js?v=11.0.0","./knowledge.js?v=11.0.0","./gamification.js?v=11.0.0","./pwa.js?v=11.0.0","./ui.js?v=11.0.0","./bootstrap.js?v=11.0.0",
  "./data-os.js?v=11.0.0","./projects-os.js?v=11.0.0","./goals-os.js?v=11.0.0","./review-os.js?v=11.0.0","./calendar-os.js?v=11.0.0","./tasks-os.js?v=11.0.0","./routines-os.js?v=11.0.0","./inbox-os.js?v=11.0.0","./rules-os.js?v=11.0.0","./insights-os.js?v=11.0.0","./command-os.js?v=11.0.0","./execution-os.js?v=11.0.0","./decision-os.js?v=11.0.0","./recovery-os.js?v=11.0.0","./life-os.js?v=11.0.0",
  "./manifest.webmanifest?v=11.0.0","./icon-192.png","./icon-512.png"
];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("life-rpg-v")&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;const url=new URL(e.request.url);if(url.origin!==self.location.origin||url.searchParams.has("check"))return;e.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(e.request);if(cached)return cached;try{return await fetch(e.request)}catch(error){if(e.request.mode==="navigate")return cache.match("./index.html");throw error}}))});
self.addEventListener("message",e=>{if(e.data?.type==="SKIP_WAITING")self.skipWaiting();if(e.data?.type==="NOTIFY")self.registration.showNotification(e.data.title||"Life RPG",{body:e.data.body||"",icon:"./icon-192.png",badge:"./icon-192.png",tag:e.data.tag||"life-rpg"})});
