"use strict";
const fs=require("fs"),assert=require("assert");
const read=p=>fs.readFileSync(p,"utf8");
const part=(src,start,end)=>{const a=src.indexOf(start),b=src.indexOf(end,a+start.length);assert(a>=0&&b>a,`missing ${start}`);return src.slice(a,b)};

const state=read("state.js"),share=read("share-hub.js"),recovery=read("recovery-center-13.3.js"),pwa=read("pwa.js"),mobile=read("mobile-layout.css"),pkg=JSON.parse(read("package.json"));

const restore=part(state,"async function restoreSnapshot(ts){","async function exportBackup");
assert(restore.includes("commitStateAtomically"));
assert(!restore.includes("storageRollbackMemory()"),"legacy restore must not blindly roll back newer memory");

const dedup=part(share,"async function share131DedupQueue(){","async function share131CaptureText");
assert(dedup.includes("duplicates=[]"));
assert(dedup.includes("persistPreparedStateAtomically"));
assert(dedup.indexOf("persistPreparedStateAtomically")<dedup.indexOf("for(const row of duplicates)"),"Share history must persist before queue delete");

assert(recovery.includes("RECOVERY133_BUNDLE_BUDGET_BYTES=32*1024*1024"));
assert(recovery.includes("RECOVERY133_MAX_IMPORT_BYTES=96*1024*1024"));
assert(recovery.includes("navigator.storage.estimate()"));
assert(recovery.includes("snapshotSelection:{available:"));
assert(recovery.includes("file.size")&&recovery.includes("RECOVERY133_MAX_IMPORT_BYTES"));

assert(pwa.includes("function pwaMaybeRefreshRegistration"));
assert(pwa.includes('document.addEventListener("visibilitychange"'));
assert(pwa.includes('window.addEventListener("online"'));
assert(!pwa.includes("location.reload("),"PWA lifecycle must not force reload loops");

assert(mobile.includes("safe-area-inset-left"));
assert(mobile.includes("safe-area-inset-right"));
assert(mobile.includes("100dvh"));
assert(mobile.includes("orientation:landscape"));

assert(!fs.existsSync(".github/workflows/stage3-2-hardening.yml"),"stale duplicate Stage 3.3 workflow must be removed");
assert(String(pkg.version)==="13.7.5");
console.log("OK — Stage 3.5 final hardening: restore races, Share durability, Recovery quota, PWA resume and mobile viewport");
