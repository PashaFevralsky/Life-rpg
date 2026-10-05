"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const read=p=>fs.readFileSync(p,"utf8");
const cfg=JSON.parse(read("android-release-config.json"));
const stable=JSON.parse(read("android-stable-config.json"));
const tool=JSON.parse(read("android-toolchain.lock.json"));
const meta=JSON.parse(read("android-release-meta.json"));
const cap=JSON.parse(read("capacitor.config.json"));

function semver(v){
  const m=/^(\d+)\.(\d+)\.(\d+)$/.exec(String(v||""));
  assert.ok(m,`Invalid semver: ${v}`);
  return {major:+m[1],minor:+m[2],patch:+m[3]};
}
function versionCodeFloor(v,slot=99){
  const x=semver(v);
  return x.major*1000000+x.minor*10000+x.patch*100+slot;
}
function cmp(a,b){
  const x=semver(a),y=semver(b);
  return x.major-y.major||x.minor-y.minor||x.patch-y.patch;
}

assert.equal(cfg.channel,"rc");
assert.equal(cfg.stateVersion,18);
assert.equal(cfg.androidShareEnabled,false);
assert.ok(cmp(cfg.targetVersion,stable.targetVersion)>0,
  `RC target ${cfg.targetVersion} must be newer than installed stable ${stable.targetVersion}`);

assert.equal(tool.node,"22");
assert.equal(tool.java,"21");
assert.equal(tool.capacitorCore,"8.5.2");
assert.equal(tool.capacitorAndroid,"8.5.2");
assert.equal(tool.capacitorCli,"8.5.2");
assert.equal(tool.localNotifications,"8.3.1");

assert.equal(meta.targetVersion,cfg.targetVersion);
const escaped=cfg.targetVersion.replace(/\./g,"\\.");
assert.match(meta.versionName,new RegExp(`^${escaped}-rc\\.\\d+$`));
assert.ok(meta.versionCode>versionCodeFloor(stable.targetVersion),
  `${cfg.targetVersion} RC must update over installed ${stable.targetVersion} stable`);
assert.equal(meta.androidShareEnabled,false);
assert.equal(meta.stateVersion,18);

const assets=path.join("android","app","src","main","assets","public");
for(const f of [
  "index.html","core.js","bootstrap.js","pwa.js",
  "android-safe-area.css","android-life-ops-native.js","finance-rebuild-14.js",
  "android-ui-14.css","android-tab-swipe-14.css","android-tab-swipe-14.js",
  "product-core-14.1.js","product-core-14.1.1.js","product-core-14.1.2.js"
]){
  assert.ok(fs.existsSync(path.join(assets,f)),`Android asset missing: ${f}`);
}
assert.ok(!fs.existsSync(path.join(assets,"share-hub.js")),"Share Hub must not ship in Android RC");
assert.ok(!fs.existsSync(path.join(assets,"share-target-sw.js")),"Share Target worker must not ship in Android RC");
assert.ok(!fs.existsSync(path.join(assets,"android-native-share.js")),"Native Share bridge must not ship in Android RC");
assert.ok(!fs.existsSync(path.join(assets,"android-native-share-plugin.js")),"Native Share proxy must not ship in Android RC");
assert.ok(!fs.existsSync(path.join(assets,"sw.js")),"PWA service worker must not ship in Android RC");

const html=read(path.join(assets,"index.html"));
const core=read(path.join(assets,"core.js"));
const boot=read(path.join(assets,"bootstrap.js"));
const pwa=read(path.join(assets,"pwa.js"));
const manifestWeb=JSON.parse(read(path.join(assets,"manifest.webmanifest")));

assert.ok(html.includes("window.__LIFE_RPG_ANDROID__=true"));
assert.ok(html.includes("window.__LIFE_RPG_ANDROID_SHARE_ENABLED__=false"));
assert.ok(html.includes("android-life-ops-native.js"));
assert.ok(html.includes("finance-rebuild-14.js"));
assert.ok(html.includes("android-ui-14.css"));
assert.ok(html.includes("android-tab-swipe-14.css"));
assert.ok(html.includes("android-tab-swipe-14.js"));
assert.ok(html.indexOf("android-ui-14.css")>html.indexOf("android-safe-area.css"));
assert.ok(html.indexOf("android-tab-swipe-14.css")>html.indexOf("android-ui-14.css"));
assert.ok(html.indexOf("android-tab-swipe-14.js")>html.indexOf("bootstrap.js"));
const androidUi=read(path.join(assets,"android-ui-14.css"));
const swipeJs=read(path.join(assets,"android-tab-swipe-14.js"));
assert.ok(androidUi.includes("--life-ui-nav-clearance"));
assert.ok(androidUi.includes("background:#0f1218!important"));
assert.ok(androidUi.includes('[data-section="finance"] .ux7-fab'));
assert.ok(swipeJs.includes("life-rpg:tab-swipe"));
assert.ok(swipeJs.includes("pointerType!=='touch'"));
assert.ok(html.indexOf("android-life-ops-native.js")<html.indexOf("bootstrap.js"));
assert.ok(html.indexOf("finance-rebuild-14.js")<html.indexOf("bootstrap.js"));
assert.ok(boot.includes('["ensureFinanceRebuild14Ui","renderFinanceRebuild14"]'));
assert.ok(boot.includes('"product-core-14.1.js"'));
assert.ok(boot.includes('"product-core-14.1.1.js"'));
assert.ok(boot.includes('"product-core-14.1.2.js"'));
assert.ok(read(path.join(assets,"finance-rebuild-14.js")).includes("life-rpg-finance-rebuild-v1"));
assert.ok(core.includes(`APP_VERSION="${meta.versionName}"`));
assert.ok(!boot.includes('"share-hub.js"'));
assert.ok(!boot.includes("ensureShare131Ui"));
assert.ok(pwa.includes("__LIFE_RPG_ANDROID__"));
assert.equal("share_target" in manifestWeb,false);
assert.equal("file_handlers" in manifestWeb,false);

const nativeManifest=read(path.join("android","app","src","main","AndroidManifest.xml"));
assert.ok(!nativeManifest.includes("android.intent.action.SEND"));
assert.ok(!nativeManifest.includes("android.intent.action.SEND_MULTIPLE"));
assert.ok(nativeManifest.includes('android:allowBackup="false"'),"Android backup must be disabled");
assert.ok(nativeManifest.includes('android:fullBackupContent="false"'),"Android full backup must be disabled");

const gradle=read(path.join("android","app","build.gradle"));
assert.ok(gradle.includes(`versionCode ${meta.versionCode}`));
assert.ok(gradle.includes(`versionName "${meta.versionName}"`));

const settings=read(path.join("android","capacitor.settings.gradle"));
assert.ok(settings.includes("capacitor-local-notifications"),"Local Notifications plugin missing from Android Gradle settings");

const javaDir=path.join("android","app","src","main","java",...String(cap.appId).split("."));
const main=read(path.join(javaDir,"MainActivity.java"));
assert.ok(main.includes("refreshBundledWebAssets()"));
assert.ok(main.includes("navigator.serviceWorker.getRegistrations()"));
assert.ok(!main.includes("NativeSharePlugin"));

console.log(`OK — Android RC release gate passed: ${meta.versionName} / ${meta.versionCode}`);
