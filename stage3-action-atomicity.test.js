"use strict";
const fs=require("fs"),assert=require("assert");
const read=p=>fs.readFileSync(p,"utf8");
const part=(src,start,end)=>{const a=src.indexOf(start),b=src.indexOf(end,a+start.length);assert(a>=0&&b>a,`missing ${start}`);return src.slice(a,b)};

const state=read("state.js"),finance=read("finance.js"),imports=read("imports.js"),hub=read("import-hub.js"),knowledge=read("knowledge.js"),cal=read("calibration-os.js"),share=read("share-hub.js"),vite=read("vite.config.mjs"),pwa=read("pwa.js");
assert(state.includes("async function persistPreparedStateAtomically(before"));
assert(state.includes("storageStateMatches(S,attempted)"));

for(const [a,b] of [["async function addDebtPart(){","async function deleteDebtPart"],["async function deleteDebtPart","function editDebt"],["async function saveDebtForm(){","function renderDebtEngine"]]){
  const x=part(finance,a,b);assert(x.includes("persistPreparedStateAtomically"),a);assert(!x.includes("await persist("),a);
}
for(const name of ["function simulateDebt(","function simulateDebtStrategy("]){
  const i=finance.indexOf(name);assert(i>=0);const x=finance.slice(i,i+3600);assert(x.includes("moneyCents"),name);assert(x.includes("moneyFromCents"),name);
}

const bank=part(imports,'async function acceptDetectedBankBalance(reason="initial"){',"function buildAiContext");
assert(bank.includes('typeof persistPreparedStateAtomically==="function"?persistPreparedStateAtomically(beforeState,{makeBackup:true}):persist(true)'));
assert(bank.indexOf("persistPreparedStateAtomically")<bank.indexOf("bankSyncSession.wasVerified=true"));
assert(imports.includes('typeof persistPreparedStateAtomically==="function"?persistPreparedStateAtomically(before,{makeBackup:true}):persist(true)'));
assert(!imports.includes("if(!committed){S=before;"));

const apply=part(hub,"async function import127Apply(){","async function import127Rollback");
assert(apply.includes('typeof deepClone==="function"?deepClone(S)'));
assert(apply.includes("storageStateMatches(S,attempted)"));
assert(apply.includes("persistPreparedStateAtomically(before)"));
assert(!hub.includes('h.rolledBackAt=new Date().toISOString();await persist();'));

const reading=part(knowledge,"async function importReadingListFile(file){","async function addBook");
assert(reading.includes('typeof persistPreparedStateAtomically==="function"?persistPreparedStateAtomically(before):persist()'));

const tune=part(cal,"async function calibrationMaybeAutoTune(force=false){","async function calibrationOnBoot");
assert(tune.includes("persistPreparedStateAtomically(beforeState)"));
assert(!tune.includes("await persist()"));
const exposure=part(cal,"function calibrationRecordDecisionExposure(rows){","function calibrationRecordDecisionAction");
assert(exposure.includes("persistPreparedStateAtomically(beforeState)"));

const capture=part(share,"async function share131CaptureText(row,auto=false){","async function share131RouteImport");
assert(capture.indexOf("await save(")<capture.lastIndexOf("share131QueueDelete(row.id)"));
const ics=part(share,"async function share131ApplyIcs(){","function share131IcsEscape");
assert(ics.indexOf("await save(")<ics.indexOf("share131QueueDelete(p.queueId)"));
const done=part(share,"async function share131MarkDone(id){","async function share131Discard");
assert(done.indexOf("await save()")<done.indexOf("share131QueueDelete(id)"));
const discard=part(share,"async function share131Discard(id){","async function share131EnqueueFiles");
assert(discard.indexOf("await save()")<discard.indexOf("share131QueueDelete(id)"));
assert(share.includes("persistPreparedStateAtomically(before)"));

assert(vite.includes("clientsClaim:false"));
assert(vite.includes("skipWaiting:false"));
assert(pwa.includes('updateViaCache:"none"'));

console.log("OK — Stage 3.4 action atomicity, Share Queue durability, calibration persistence and cent-accurate debt simulation");
