"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const read=f=>fs.readFileSync(f,"utf8");

for(const f of [
  "android-release-config.json","android-toolchain.lock.json","android-release-prepare.mjs",
  "android-release-patch.mjs","android-release-gate.test.js",
  "release-readiness-14.0.test.js",
  "android-life-ops-native-entry.js","android-life-ops-native.vite.mjs",
  "finance-rebuild-14.js","finance-rebuild-14.test.js",
  "android-ui-14.css","android-ui-14.test.js","android-ui-14.e2e.test.js",
  "android-tab-swipe-14.js","android-tab-swipe-14.css","android-tab-swipe-14.test.js","android-tab-swipe-14.e2e.test.js",
  "playwright.android-rc.config.mjs",
  "ANDROID-ACCEPTANCE-14.0.md","RELEASE-14.0.md",
  ".github/workflows/android-rc.yml",".github/workflows/android-beta.yml"
]) assert.ok(fs.existsSync(f),`${f} missing`);

const cfg=JSON.parse(read("android-release-config.json"));
assert.equal(cfg.targetVersion,"14.0.1");
assert.equal(cfg.channel,"rc");
assert.equal(cfg.stateVersion,18);
assert.equal(cfg.androidShareEnabled,false);

const rc=read(".github/workflows/android-rc.yml");
assert.ok(rc.includes("npm test"));
assert.ok(rc.includes("npm run test:e2e"));
assert.ok(rc.includes("android-release-gate.test.js"));
assert.ok(rc.includes("apksigner"));
assert.ok(rc.includes("ANDROID_KEYSTORE_BASE64"));
assert.ok(!rc.includes("android-native-share-patch.mjs"));
assert.ok(!rc.includes("Build real Capacitor NativeShare JS proxy"));

const legacy=read(".github/workflows/android-beta.yml");
assert.ok(legacy.includes("workflow_dispatch"));
assert.ok(!/push:\s*\n/.test(legacy),"Legacy beta must not auto-build on push");

const prep=read("android-release-prepare.mjs");
assert.ok(prep.includes('bootstrap.replace(\'"share-hub.js",\''));
assert.ok(prep.includes("delete manifest.share_target"));
assert.ok(prep.includes('"sw.js"'),"Android RC preparation must include sw.js in removal set");
assert.ok(prep.includes("fs.rmSync(path.join(dist, name)"),"Android RC preparation must remove excluded assets");
assert.ok(prep.includes("__LIFE_RPG_ANDROID_SHARE_ENABLED__"));
assert.ok(prep.includes('delete manifest.file_handlers'));
assert.ok(prep.includes('"share-target-sw.js"'));
assert.ok(prep.includes('"android-native-share.js"'));
assert.ok(prep.includes('"android-native-share-plugin.js"'));

const patch=read("android-release-patch.mjs");
assert.ok(patch.includes("refreshBundledWebAssets()"));
assert.ok(patch.includes("navigator.serviceWorker.getRegistrations()"));
assert.ok(patch.includes("Native Android Share filters must not exist in RC"));
assert.ok(patch.includes('android:allowBackup="false"'));
assert.ok(patch.includes('android:fullBackupContent="false"'));

const androidUi=read("android-ui-14.css");
const swipeJs=read("android-tab-swipe-14.js");
assert.ok(androidUi.includes("--life-ui-nav-clearance"));
assert.ok(androidUi.includes('#today>.ux7-section-head .ux7-tabs'));
assert.ok(androidUi.includes('#finance>.ux7-section-head .ux7-tabs'));
assert.ok(androidUi.includes('#work>.ux7-section-head .ux7-tabs'));
assert.ok(androidUi.includes('#tennis>.ux7-section-head .ux7-tabs'));
assert.ok(androidUi.includes('#more>.ux7-section-head .ux7-tabs'));
assert.ok(swipeJs.includes("life-rpg:tab-swipe"));
assert.ok(swipeJs.includes("horizontalScroller"));
assert.ok(swipeJs.includes("hasOpenModal"));

const finance=read("finance-rebuild-14.js");
assert.ok(finance.includes("life-rpg-finance-rebuild-v1"));
assert.ok(finance.includes("createPreActionSnapshot"));
assert.ok(finance.includes("commitStateAtomically"));
assert.ok(finance.includes("financeRebuild14CurrentAudit"));
assert.ok(finance.includes("ЗАМЕНИТЬ ФИНАНСЫ"));

const acceptance=read("ANDROID-ACCEPTANCE-14.0.md");
for(const phrase of ["Обновление поверх","Сохранность данных","Офлайн","уведомлен","Backup","Restore","Share Target"]) {
  assert.ok(acceptance.toLowerCase().includes(phrase.toLowerCase()),`Acceptance checklist missing: ${phrase}`);
}

console.log("OK — Life RPG 14.0 release-hardening source gate passed");
