"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const read=f=>fs.readFileSync(f,"utf8");
for(const f of [
  "android-release-config.json","android-toolchain.lock.json","android-release-prepare.mjs",
  "android-release-patch.mjs","android-release-gate.test.js",
  "android-life-ops-native-entry.js","android-life-ops-native.vite.mjs",
  "ANDROID-ACCEPTANCE-14.0.md","RELEASE-14.0.md",
  ".github/workflows/android-rc.yml",".github/workflows/android-beta.yml"
]) assert.ok(fs.existsSync(f),`${f} missing`);

const cfg=JSON.parse(read("android-release-config.json"));
assert.equal(cfg.targetVersion,"14.0.0");
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
assert.ok(prep.includes('delete manifest.share_target'));
assert.ok(prep.includes('fs.rmSync(path.join(dist, "sw.js")'));
assert.ok(prep.includes("__LIFE_RPG_ANDROID_SHARE_ENABLED__"));

const acceptance=read("ANDROID-ACCEPTANCE-14.0.md");
for(const phrase of ["Обновление поверх","Сохранность данных","Офлайн","уведомлен","Backup","Restore","Share Target"]) {
  assert.ok(acceptance.toLowerCase().includes(phrase.toLowerCase()),`Acceptance checklist missing: ${phrase}`);
}
console.log("OK — Life RPG 14.0 release-hardening source gate passed");
