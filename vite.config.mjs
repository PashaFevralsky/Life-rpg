import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const classicRuntime=[
  "platform.js","core.js","state.js","finance.js","imports.js","work.js","tennis.js","knowledge.js","gamification.js","pwa.js","ui.js",
  "data-os.js","projects-os.js","goals-os.js","review-os.js","calendar-os.js","tasks-os.js","routines-os.js","inbox-os.js","rules-os.js","insights-os.js","command-os.js","calibration-os.js","execution-os.js","decision-os.js","recovery-os.js",
  "tracking-os.js","personal-os.js","journal-os.js","people-os.js","focus-os.js","body-os.js","home-os.js","capture2-os.js","personal-import-os.js","dashboard-os.js",
  "knowledge-growth.js","knowledge-decision.js","work-growth.js","tennis-growth.js","tennis-huawei.js","tennis-decision.js","rpg-growth.js","life-os.js","today-execution.js","personal-integration-os.js","integration-12.5.js","personal-stabilization-os.js",
  "bootstrap.js","app.js","mobile-layout.css","READING-LIST-27.json","manifest.webmanifest","icon-192.png","icon-512.png"
];
function copyClassicRuntime(){return {name:"life-rpg-classic-runtime",writeBundle(){mkdirSync("dist",{recursive:true});for(const file of classicRuntime){if(existsSync(file))cpSync(file,resolve("dist",file))}}}}
export default defineConfig({base:"./",publicDir:false,plugins:[copyClassicRuntime(),VitePWA({strategies:"generateSW",registerType:"prompt",injectRegister:null,manifest:false,includeAssets:["icon-192.png","icon-512.png"],workbox:{cacheId:"life-rpg-12.5.0",clientsClaim:false,skipWaiting:false,cleanupOutdatedCaches:true,ignoreURLParametersMatching:[/^v$/, /^utm_/, /^fbclid$/],navigateFallback:"index.html",globPatterns:["**/*.{html,js,css,png,json,webmanifest}"],maximumFileSizeToCacheInBytes:3*1024*1024,runtimeCaching:[{urlPattern:/^https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract\.js@5\.1\.1\//,handler:"CacheFirst",options:{cacheName:"life-rpg-tesseract",expiration:{maxEntries:4,maxAgeSeconds:60*60*24*30},cacheableResponse:{statuses:[0,200]}}}]}})],build:{outDir:"dist",emptyOutDir:true,target:"es2022",sourcemap:false}});
