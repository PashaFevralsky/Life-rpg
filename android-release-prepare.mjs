import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cfg = JSON.parse(fs.readFileSync(path.join(root, "android-release-config.json"), "utf8"));
const run = Number(process.env.GITHUB_RUN_NUMBER || 1);

function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || ""));
  if (!m) throw new Error(`Invalid targetVersion: ${v}`);
  return { major:+m[1], minor:+m[2], patch:+m[3] };
}
function releaseMeta() {
  const v = parseVersion(cfg.targetVersion);
  const slot = cfg.channel === "stable" ? 99 : Math.max(1, Math.min(89, run));
  if (cfg.channel !== "stable" && run > 89) throw new Error("RC run_number > 89; bump target version or reset release workflow strategy");
  return {
    targetVersion: cfg.targetVersion,
    channel: cfg.channel,
    runNumber: run,
    versionName: cfg.channel === "stable" ? cfg.targetVersion : `${cfg.targetVersion}-rc.${run}`,
    versionCode: v.major * 1000000 + v.minor * 10000 + v.patch * 100 + slot,
    stateVersion: Number(cfg.stateVersion || 0),
    androidShareEnabled: cfg.androidShareEnabled === true
  };
}

const meta = releaseMeta();
fs.writeFileSync(path.join(root, "android-release-meta.json"), JSON.stringify(meta, null, 2) + "\n");

const dist = path.join(root, "dist");
const read = name => fs.readFileSync(path.join(dist, name), "utf8");
const write = (name, value) => fs.writeFileSync(path.join(dist, name), value);

if (!fs.existsSync(path.join(dist, "index.html"))) throw new Error("dist/index.html missing");
if (!fs.existsSync(path.join(dist, "core.js"))) throw new Error("dist/core.js missing");
if (!fs.existsSync(path.join(dist, "bootstrap.js"))) throw new Error("dist/bootstrap.js missing");
if (!fs.existsSync(path.join(dist, "pwa.js"))) throw new Error("dist/pwa.js missing");
if (!fs.existsSync(path.join(dist, "android-life-ops-native.js"))) throw new Error("Android Life Ops native bridge missing");
if (!fs.existsSync(path.join(root, "finance-rebuild-14.js"))) throw new Error("finance-rebuild-14.js missing");
if (!fs.existsSync(path.join(root, "android-safe-area.css"))) throw new Error("android-safe-area.css missing");
if (!fs.existsSync(path.join(root, "android-ui-14.css"))) throw new Error("android-ui-14.css missing");

/* Android RC gets its own runtime version without changing the accepted web/PWA source release yet. */
let core = read("core.js");
if (!/const APP_VERSION="[^"]+";/.test(core)) throw new Error("APP_VERSION not found in dist/core.js");
core = core.replace(/const APP_VERSION="[^"]+";/, `const APP_VERSION="${meta.versionName}";`);
write("core.js", core);

fs.copyFileSync(path.join(root, "finance-rebuild-14.js"), path.join(dist, "finance-rebuild-14.js"));

let html = read("index.html");
html = html.replace(/<title>Life RPG [^<]+<\/title>/, `<title>Life RPG ${meta.versionName}</title>`);
html = html.replace(/window\.__LIFE_RPG_HTML_VERSION__="[^"]+"/, `window.__LIFE_RPG_HTML_VERSION__="${meta.versionName}"`);
html = html.replace(/\?v=[^"&<]+/g, `?v=${meta.versionName}`);

const marker = `<script>window.__LIFE_RPG_ANDROID__=true;window.__LIFE_RPG_ANDROID_SHARE_ENABLED__=${meta.androidShareEnabled ? "true" : "false"};window.__LIFE_RPG_RELEASE_CHANNEL__=${JSON.stringify(meta.channel)};</script>`;
if (!html.includes("__LIFE_RPG_ANDROID__")) {
  if (!html.includes("</head>")) throw new Error("dist/index.html has no </head>");
  html = html.replace("</head>", `${marker}\n</head>`);
}

const css = '<link rel="stylesheet" href="./android-safe-area.css">';
const uiCss = '<link rel="stylesheet" href="./android-ui-14.css">';
if (!html.includes(css)) {
  if (!html.includes("</head>")) throw new Error("dist/index.html has no </head>");
  html = html.replace("</head>", `${css}\n</head>`);
}
if (!html.includes(uiCss)) {
  if (!html.includes(css)) throw new Error("Android safe-area stylesheet injection failed");
  html = html.replace(css, `${css}\n${uiCss}`);
}

const financeRebuild = '<script src="./finance-rebuild-14.js"></script>';
const nativeOps = '<script src="./android-life-ops-native.js"></script>';
if (!html.includes(financeRebuild) || !html.includes(nativeOps)) {
  const re = /<script src="\.\/bootstrap\.js[^\"]*"><\/script>/;
  if (!re.test(html)) throw new Error("bootstrap.js script tag not found");
  html = html.replace(re, `${financeRebuild}\n${nativeOps}\n$&`);
}

if (/android-native-share(?:-plugin)?\.js/.test(html)) {
  throw new Error("Native Share scripts must not ship in 14.0 RC");
}
write("index.html", html);

/* Native Android Share is intentionally excluded from RC.
   Manual file/camera/import workflows remain elsewhere in the app. */
let bootstrap = read("bootstrap.js");
bootstrap = bootstrap.replace('"share-hub.js",', "");
bootstrap = bootstrap.replace('["ensureShare131Ui","renderShare131"],', "");
if (bootstrap.includes('"share-hub.js"') || bootstrap.includes("ensureShare131Ui")) {
  throw new Error("Could not remove Share Hub from Android RC bootstrap");
}
if (!bootstrap.includes('["ensureFinanceRebuild14Ui","renderFinanceRebuild14"]')) {
  const hook='["ensureLifeOpsUi","renderLifeOps"],';
  if (!bootstrap.includes(hook)) throw new Error("Life Ops runtime init hook not found");
  bootstrap=bootstrap.replace(hook,`${hook}["ensureFinanceRebuild14Ui","renderFinanceRebuild14"],`);
}
write("bootstrap.js", bootstrap);

for (const name of [
  "share-hub.js",
  "share-target-sw.js",
  "android-native-share.js",
  "android-native-share-plugin.js",
  "sw.js"
]) {
  try { fs.rmSync(path.join(dist, name), { force:true }); } catch {}
}
for (const name of fs.readdirSync(dist)) {
  if (/^workbox-[^.]+\.js$/.test(name)) {
    try { fs.rmSync(path.join(dist, name), { force:true }); } catch {}
  }
}

/* Android APK must never register the PWA Service Worker. */
let pwa = read("pwa.js");
const setupNeedle = "function setupPwa(){";
if (!pwa.includes("__LIFE_RPG_ANDROID__")) {
  if (!pwa.includes(setupNeedle)) throw new Error("setupPwa() signature not found");
  pwa = pwa.replace(setupNeedle, `function setupPwa(){
    if(globalThis.__LIFE_RPG_ANDROID__){
      pwaSetupDone=true;
      const box=typeof $==="function"?$("versionStatus"):null;
      if(box)box.textContent=\`Life RPG \${APP_VERSION} • Android ${meta.channel.toUpperCase()} • локальные данные v\${STATE_VERSION}\`;
      return;
    }`);
}
write("pwa.js", pwa);

const manifestPath = path.join(dist, "manifest.webmanifest");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.name = `Life RPG ${meta.versionName}`;
manifest.description = `Life RPG ${meta.versionName} — Android ${meta.channel.toUpperCase()} candidate`;
manifest.start_url = `./?v=${meta.versionName}`;
delete manifest.share_target;
delete manifest.file_handlers;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

fs.copyFileSync(path.join(root, "android-safe-area.css"), path.join(dist, "android-safe-area.css"));
fs.copyFileSync(path.join(root, "android-ui-14.css"), path.join(dist, "android-ui-14.css"));

const finalHtml = read("index.html");
const safeCssPos = finalHtml.indexOf("android-safe-area.css");
const uiCssPos = finalHtml.indexOf("android-ui-14.css");
const financePos = finalHtml.indexOf("finance-rebuild-14.js");
const opsPos = finalHtml.indexOf("android-life-ops-native.js");
const bootPos = finalHtml.indexOf("bootstrap.js");
if (safeCssPos < 0 || uiCssPos < 0 || uiCssPos < safeCssPos) throw new Error("Android UI hardening CSS must load after safe-area CSS");
if (financePos < 0 || opsPos < 0 || bootPos < 0 || financePos > bootPos || opsPos > bootPos) throw new Error("Finance Rebuild and Life Ops native bridge must load before bootstrap.js");
if (!finalHtml.includes(`__LIFE_RPG_ANDROID_SHARE_ENABLED__=${meta.androidShareEnabled ? "true" : "false"}`)) throw new Error("Android Share release flag missing");
if (!read("core.js").includes(`APP_VERSION="${meta.versionName}"`)) throw new Error("Android runtime version transform failed");

console.log(`OK — prepared Android ${meta.channel}: ${meta.versionName} (${meta.versionCode})`);
