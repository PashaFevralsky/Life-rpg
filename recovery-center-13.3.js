"use strict";

/* Life RPG 13.3.0 — Backup, Recovery, Integrity & Safe Mode */

const RECOVERY133_FORMAT="life-rpg-disaster-recovery-v1";
const RECOVERY133_ENCRYPTED_FORMAT="life-rpg-disaster-recovery-encrypted-v1";
const RECOVERY133_LOG_KEY="lifeRpgRecovery133Log";
const RECOVERY133_SAFE_KEY="lifeRpgRecovery133SafeMode";
const RECOVERY133_ROLLBACK_KEY="lifeRpgRecovery133RollbackTs";
const RECOVERY133_MAX_SNAPSHOTS=60;
const RECOVERY133_BUNDLE_SNAPSHOTS=20;
const RECOVERY133_DOMAIN_KEYS={
  finance:["debts","payments","balanceHistory","expenses","incomeLogs","bankImportIds","screenshotImportIds","bankTransfers","regularPayments","financeClosures","cashAdjustments","reservations","fundTransfers","accounts","assets","assetTransfers","importBatches","reconciliationSessions","importRules","envelopeCarryovers","envelopeLimits"],
  work:["workLogs","crmDeals","workTargets"],
  tennis:["tennis"],
  knowledge:["books","readingLogs"],
  rpg:["profile","xpEarned","xpSpent","stats","xpEvents","checks","questDone","achievements","rewardPurchases"]
};
const RECOVERY133_SETTING_KEYS={
  finance:["primaryAccountId","monthlyIncome","monthlyDebtGoal","campaignStart","campaignMonths","dailySpendLimit","emergencyFundTarget","emergencyFundBalance","miniBufferTarget","highInterestThreshold","cashBalanceVerifiedAt","envelopeRollover","autoReserveAfterImport","learnImportRules","incomeEvents","liquidityTargetDays","minimumCashFloor","forecastIncomeFactor"],
  work:["workMonthlyPlan"],
  tennis:["tennisElo","tennisBaseElo","tennisMonthlyTarget","tennisOfficialRating"],
  knowledge:["readingDailyMin","readingReviewDays"]
};
const RECOVERY133_DOMAIN_LABELS={finance:"Финансы",work:"Работа / CRM",tennis:"Теннис",knowledge:"Знания",planning:"Планы и задачи",rpg:"Профиль / RPG"};

let recovery133SelectedTs=0;
let recovery133PendingBundle=null;
let recovery133LastScan=null;
let recovery133SafeGuardInstalled=false;

function recovery133Canonical(value){
  if(value===null)return "null";
  const t=typeof value;
  if(t==="number")return Number.isFinite(value)?JSON.stringify(value):"null";
  if(t==="boolean"||t==="string")return JSON.stringify(value);
  if(t!=="object")return "null";
  if(Array.isArray(value))return `[${value.map(recovery133Canonical).join(",")}]`;
  const keys=Object.keys(value).filter(k=>value[k]!==undefined&&typeof value[k]!=="function"&&typeof value[k]!=="symbol").sort();
  return `{${keys.map(k=>`${JSON.stringify(k)}:${recovery133Canonical(value[k])}`).join(",")}}`
}
async function recovery133Digest(value){
  const text=typeof value==="string"?value:recovery133Canonical(value),bytes=new TextEncoder().encode(text);
  if(globalThis.crypto?.subtle){const hash=await crypto.subtle.digest("SHA-256",bytes);return `sha256:${[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("")}`}
  let h=2166136261;for(const b of bytes){h^=b;h=Math.imul(h,16777619)}return `fnv1a:${(h>>>0).toString(16).padStart(8,"0")}`
}
function recovery133ByteSize(value){return new TextEncoder().encode(typeof value==="string"?value:recovery133Canonical(value)).length}
function recovery133StateStats(state){
  const s=state||{},entities=s.entities||{};
  const entityCounts=Object.fromEntries(Object.entries(entities).map(([k,v])=>[k,Array.isArray(v)?v.length:0]));
  const directKeys=["debts","payments","workLogs","tennis","books","readingLogs","expenses","incomeLogs","crmDeals","auditLog","trash"];
  const directCounts=Object.fromEntries(directKeys.map(k=>[k,Array.isArray(s[k])?s[k].length:0]));
  return {entities:entityCounts,direct:directCounts,total:Object.values(entityCounts).reduce((a,b)=>a+b,0)+Object.values(directCounts).reduce((a,b)=>a+b,0)}
}
function recovery133KindFromLabel(label=""){
  const s=String(label||"").toLowerCase();
  if(s.includes("ручн")||s.includes("checkpoint"))return "manual";
  if(s.includes("восстанов")||s.includes("откат")||s.includes("rollback"))return "rollback";
  if(s.includes("импорт"))return "import";
  if(s.includes("ремонт")||s.includes("сброс")||s.includes("перед"))return "operation";
  return "operation"
}
function recovery133SnapshotKind(snapshot){if(snapshot?.meta?.kind)return snapshot.meta.kind;const label=String(snapshot?.label||"");return label?recovery133KindFromLabel(label):"daily"}
function recovery133FormatBytes(n){const x=Number(n)||0;if(x<1024)return `${x} Б`;if(x<1048576)return `${(x/1024).toFixed(1)} КБ`;return `${(x/1048576).toFixed(1)} МБ`}
function recovery133Log(action,status="ok",detail=""){
  try{const rows=JSON.parse(localStorage.getItem(RECOVERY133_LOG_KEY)||"[]");rows.unshift({id:uid(),at:new Date().toISOString(),action:String(action),status:String(status),detail:String(detail||"")});localStorage.setItem(RECOVERY133_LOG_KEY,JSON.stringify(rows.slice(0,120)))}catch{}
}
function recovery133Logs(){try{return JSON.parse(localStorage.getItem(RECOVERY133_LOG_KEY)||"[]")}catch{return []}}
function recovery133SafeModeActive(){try{return localStorage.getItem(RECOVERY133_SAFE_KEY)==="1"}catch{return false}}
function recovery133SetSafeMode(on,reason="manual"){
  try{if(on)localStorage.setItem(RECOVERY133_SAFE_KEY,"1");else localStorage.removeItem(RECOVERY133_SAFE_KEY)}catch{}
  recovery133Log(on?"Safe Mode включён":"Safe Mode выключен","ok",reason);recovery133ApplySafeModeUi();renderRecovery133()
}
function recovery133ApplySafeModeUi(){
  const on=recovery133SafeModeActive();document.documentElement.classList.toggle("recovery133-safe",on);
  let style=document.getElementById("recovery133SafeStyle");if(!style){style=document.createElement("style");style.id="recovery133SafeStyle";style.textContent=`html.recovery133-safe .section input,html.recovery133-safe .section textarea,html.recovery133-safe .section select,html.recovery133-safe .section button{pointer-events:none;opacity:.55}html.recovery133-safe #recovery133Center input,html.recovery133-safe #recovery133Center button,html.recovery133-safe #recovery133Center select{pointer-events:auto;opacity:1}html.recovery133-safe #recovery133Center{outline:1px solid rgba(255,180,0,.35)}`;document.head.appendChild(style)}
}
function recovery133InstallSafeModeGuard(){
  if(recovery133SafeGuardInstalled)return;recovery133SafeGuardInstalled=true;
  const blockedTarget=target=>recovery133SafeModeActive()&&target?.closest?.(".section")&&!target?.closest?.("#recovery133Center");
  document.addEventListener("click",e=>{if(blockedTarget(e.target)&&e.target.closest?.("button,input,select,textarea")){e.preventDefault();e.stopImmediatePropagation();try{toast("Safe Mode: изменения заблокированы") }catch{}}},true);
  document.addEventListener("beforeinput",e=>{if(blockedTarget(e.target)){e.preventDefault();e.stopImmediatePropagation()}},true);
  document.addEventListener("submit",e=>{if(blockedTarget(e.target)){e.preventDefault();e.stopImmediatePropagation()}},true);
  document.addEventListener("change",e=>{if(blockedTarget(e.target)){e.preventDefault();e.stopImmediatePropagation();try{render()}catch{}}},true)
}
function recovery133SetRollback(ts){try{localStorage.setItem(RECOVERY133_ROLLBACK_KEY,String(ts||""))}catch{}}
function recovery133RollbackTs(){try{return Number(localStorage.getItem(RECOVERY133_ROLLBACK_KEY)||0)||0}catch{return 0}}

async function recovery133BuildMeta(state,{kind="operation",label="",ts=Date.now()}={}){
  const canonical=recovery133Canonical(state);return {format:"life-rpg-snapshot-v2",appVersion:APP_VERSION,stateVersion:STATE_VERSION,createdAt:new Date(ts).toISOString(),kind,label:String(label||""),checksum:await recovery133Digest(canonical),sizeBytes:new TextEncoder().encode(canonical).length,stats:recovery133StateStats(state)}
}
async function recovery133CreateSnapshot(label="",kind="operation"){
  if(!db)await openDB();let ts=Date.now();while(await dbGet("backups",ts))ts++;
  const state=deepClone(S),meta=await recovery133BuildMeta(state,{kind,label,ts});await dbPut("backups",{ts,day:localDateKey(),label,state,meta});await recovery133CleanupBackups(RECOVERY133_MAX_SNAPSHOTS);recovery133Log("Snapshot создан","ok",`${kind} • ${label||"без метки"}`);return ts
}
async function recovery133CleanupBackups(limit=RECOVERY133_MAX_SNAPSHOTS){
  if(!db)await openDB();const all=(await dbGetAll("backups")).sort((a,b)=>b.ts-a.ts),groups={manual:[],rollback:[],import:[],operation:[],daily:[]};
  for(const x of all){const k=recovery133SnapshotKind(x);(groups[k]||groups.operation).push(x)}
  const keep=new Set();const quotas={manual:12,rollback:10,import:8,operation:20,daily:14};for(const [k,rows] of Object.entries(groups))for(const x of rows.slice(0,quotas[k]||10))keep.add(x.ts);
  for(const x of all.slice(0,Math.max(8,Math.min(20,limit))))keep.add(x.ts);
  const kept=all.filter(x=>keep.has(x.ts)).slice(0,Math.max(30,limit)),keptSet=new Set(kept.map(x=>x.ts));let removed=0;
  for(const x of all)if(!keptSet.has(x.ts)){await dbDelete("backups",x.ts);removed++}
  if(removed)recovery133Log("Старые snapshots очищены","ok",`Удалено: ${removed}`);return removed
}

// Existing application snapshots remain compatible; Recovery 13.3 upgrades legacy metadata during verification.

async function recovery133EnsureMeta(snapshot,persistUpgrade=false){
  if(!snapshot?.state)throw new Error("Snapshot без state");
  let meta=snapshot.meta;if(!meta?.checksum){meta=await recovery133BuildMeta(snapshot.state,{kind:recovery133SnapshotKind(snapshot),label:snapshot.label||"",ts:snapshot.ts});if(persistUpgrade){snapshot.meta=meta;await dbPut("backups",snapshot)}}
  return meta
}
async function recovery133VerifySnapshot(snapshot,{upgradeLegacy=false}={}){
  const result={ts:Number(snapshot?.ts)||0,label:String(snapshot?.label||""),kind:recovery133SnapshotKind(snapshot),ok:false,checksumOk:null,recoverable:false,error:"",legacy:!snapshot?.meta?.checksum};
  try{validateStateShape(snapshot.state);const normalized=normalizeState(snapshot.state);validateStateShape(normalized);result.recoverable=true;const meta=await recovery133EnsureMeta(snapshot,upgradeLegacy);const actual=await recovery133Digest(snapshot.state);result.checksumOk=actual===meta.checksum;result.ok=result.recoverable&&result.checksumOk;if(!result.checksumOk)result.error="Checksum не совпадает";result.meta=meta}catch(e){result.error=String(e?.message||e)}return result
}
async function recovery133LoadAllSnapshots(){if(!db)await openDB();return (await dbGetAll("backups")).sort((a,b)=>b.ts-a.ts)}
async function recovery133LoadSnapshot(ts){if(!db)await openDB();const snap=await dbGet("backups",Number(ts));if(!snap?.state)throw new Error("Snapshot не найден");return snap}

async function recovery133ScanStorage({upgradeLegacy=true,limit=30,quiet=false}={}){
  const report={at:new Date().toISOString(),appVersion:APP_VERSION,stateVersion:STATE_VERSION,current:{ok:false,issues:[],checksum:"",sizeBytes:0,stats:null},copies:{indexedDb:"unknown",localStorage:"unknown"},snapshots:{checked:0,ok:0,failed:0,legacy:0,upgraded:0,rows:[]},warnings:[]};
  try{validateStateShape(S);const normalized=normalizeState(S);validateStateShape(normalized);report.current.ok=true;report.current.checksum=await recovery133Digest(S);report.current.sizeBytes=recovery133ByteSize(S);report.current.stats=recovery133StateStats(S);report.current.issues=typeof dataIntegrityIssues==="function"?dataIntegrityIssues():[]}catch(e){report.current.ok=false;report.current.error=String(e?.message||e)}
  try{if(!db)await openDB();const saved=await dbGet("state","current");if(!saved)report.copies.indexedDb="missing";else report.copies.indexedDb=(await recovery133Digest(saved))===report.current.checksum?"match":"diff"}catch(e){report.copies.indexedDb="error";report.warnings.push("IndexedDB state недоступен")}
  try{const raw=localStorage.getItem("lifeRpg4");if(!raw)report.copies.localStorage="missing";else{const parsed=JSON.parse(raw);report.copies.localStorage=(await recovery133Digest(parsed))===report.current.checksum?"match":"diff"}}catch(e){report.copies.localStorage="error";report.warnings.push("localStorage copy повреждена")}
  try{const snaps=(await recovery133LoadAllSnapshots()).slice(0,limit);for(const snap of snaps){const wasLegacy=!snap?.meta?.checksum,check=await recovery133VerifySnapshot(snap,{upgradeLegacy});report.snapshots.checked++;if(check.ok)report.snapshots.ok++;else report.snapshots.failed++;if(wasLegacy){report.snapshots.legacy++;if(upgradeLegacy&&check.ok)report.snapshots.upgraded++}report.snapshots.rows.push(check)}}catch(e){report.warnings.push(`Snapshots: ${String(e?.message||e)}`)}
  recovery133LastScan=report;recovery133Log("Data Integrity Scanner",report.current.ok&&report.snapshots.failed===0?"ok":"warn",`state=${report.current.ok?"ok":"bad"}; snapshots=${report.snapshots.ok}/${report.snapshots.checked}`);if(!quiet){renderRecovery133();try{toast(report.current.ok&&report.snapshots.failed===0?"Проверка целостности завершена: критичных ошибок нет":"Проверка завершена: есть предупреждения")}catch{}}return report
}
async function recovery133TestRestore(ts){const snap=await recovery133LoadSnapshot(ts),check=await recovery133VerifySnapshot(snap,{upgradeLegacy:true});if(!check.ok)throw new Error(check.error||"Snapshot не прошёл проверку");const dry=normalizeState(deepClone(snap.state));validateStateShape(dry);const before=check.meta?.stats||recovery133StateStats(snap.state),after=recovery133StateStats(dry);return {ok:true,before,after,checksum:check.meta.checksum}}

function recovery133CopyKeys(target,source,keys){for(const key of keys)target[key]=deepClone(source[key])}
function recovery133CopySettings(target,source,keys){target.settings=target.settings||{};for(const key of keys||[])if(source?.settings&&Object.prototype.hasOwnProperty.call(source.settings,key))target.settings[key]=deepClone(source.settings[key])}
async function recovery133RestoreDomain(ts,domain){
  if(!RECOVERY133_DOMAIN_LABELS[domain])throw new Error("Неизвестный раздел");if(!confirm(`Восстановить раздел «${RECOVERY133_DOMAIN_LABELS[domain]}» из выбранного snapshot? Перед изменением будет создан rollback.`))return;
  {const snap=await recovery133LoadSnapshot(ts),check=await recovery133VerifySnapshot(snap,{upgradeLegacy:true});if(!check.ok)throw new Error(check.error||"Snapshot повреждён");const source=normalizeState(snap.state),rollback=await recovery133CreateSnapshot(`Перед восстановлением ${RECOVERY133_DOMAIN_LABELS[domain]} 13.3`,"rollback");let next=deepClone(S);
    if(domain==="planning")next.entities=deepClone(source.entities);else{recovery133CopyKeys(next,source,RECOVERY133_DOMAIN_KEYS[domain]||[]);recovery133CopySettings(next,source,RECOVERY133_SETTING_KEYS[domain]||[])}
    S=normalizeState(next);validateStateShape(S);recovery133SetRollback(rollback);audit("Selective restore 13.3","system",RECOVERY133_DOMAIN_LABELS[domain]);await persist(true);recovery133Log("Selective restore","ok",RECOVERY133_DOMAIN_LABELS[domain]);render();await renderRecovery133();toast(`Восстановлено: ${RECOVERY133_DOMAIN_LABELS[domain]}`)}
}
async function recovery133RestoreFull(ts,{confirmUser=true,label="Полное восстановление 13.3"}={}){
  if(confirmUser&&!confirm("Полностью восстановить выбранный snapshot? Текущее состояние будет сохранено как rollback."))return;
  {const snap=await recovery133LoadSnapshot(ts),check=await recovery133VerifySnapshot(snap,{upgradeLegacy:true});if(!check.ok)throw new Error(check.error||"Snapshot повреждён");const rollback=await recovery133CreateSnapshot("Перед полным восстановлением 13.3","rollback");S=normalizeState(deepClone(snap.state));validateStateShape(S);recovery133SetRollback(rollback);audit(label,"system",new Date(Number(ts)).toISOString());await persist(true);recovery133Log(label,"ok",String(ts));render();await renderRecovery133();toast("Snapshot полностью восстановлен")}
}
async function recovery133RollbackLast(){const ts=recovery133RollbackTs();if(!ts){toast("Rollback пока отсутствует");return}if(!confirm("Вернуться к состоянию до последней операции восстановления?"))return;await recovery133RestoreFull(ts,{confirmUser:false,label:"Rollback восстановления 13.3"})}

async function recovery133CreateManualCheckpoint(){await recovery133CreateSnapshot("Ручной checkpoint 13.3","manual");recoverySnapshotsCache=await recovery133LoadAllSnapshots();renderRecovery133();toast("Checkpoint 13.3 создан")}
async function recovery133SelectSnapshot(ts){recovery133SelectedTs=Number(ts)||0;renderRecovery133()}
async function recovery133DeleteOldSnapshots(){const removed=await recovery133CleanupBackups(RECOVERY133_MAX_SNAPSHOTS);recoverySnapshotsCache=await recovery133LoadAllSnapshots();renderRecovery133();toast(removed?`Удалено старых snapshots: ${removed}`:"Лишних snapshots нет")}

async function recovery133PrepareBundle(){
  const currentState=deepClone(S),currentMeta=await recovery133BuildMeta(currentState,{kind:"current",label:"Current state",ts:Date.now()}),all=await recovery133LoadAllSnapshots(),snapshots=[];
  for(const row of all.slice(0,RECOVERY133_BUNDLE_SNAPSHOTS)){const snap=deepClone(row);snap.meta=await recovery133EnsureMeta(snap,false);snapshots.push(snap)}
  const bundle={format:RECOVERY133_FORMAT,version:1,createdAt:new Date().toISOString(),appVersion:APP_VERSION,stateVersion:STATE_VERSION,current:{state:currentState,meta:currentMeta},snapshots,operationLog:recovery133Logs().slice(0,80)};
  bundle.bundleChecksum=await recovery133Digest(bundle);return bundle
}
async function recovery133EncryptJson(obj,password){const enc=new TextEncoder(),salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),keyMat=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveKey"]),key=await crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:250000,hash:"SHA-256"},keyMat,{name:"AES-GCM",length:256},false,["encrypt"]),cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,enc.encode(JSON.stringify(obj)));return {format:RECOVERY133_ENCRYPTED_FORMAT,kdf:"PBKDF2-SHA256",iterations:250000,cipher:"AES-GCM-256",salt:bytesToBase64(salt),iv:bytesToBase64(iv),data:bytesToBase64(new Uint8Array(cipher))}}
async function recovery133DecryptJson(obj,password){const dec64=base64ToBytes,enc=new TextEncoder(),keyMat=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveKey"]),key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:dec64(obj.salt),iterations:Number(obj.iterations)||250000,hash:"SHA-256"},keyMat,{name:"AES-GCM",length:256},false,["decrypt"]),plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:dec64(obj.iv)},key,dec64(obj.data));return JSON.parse(new TextDecoder().decode(plain))}
async function recovery133BundleFile({encrypted=false}={}){
  let payload=await recovery133PrepareBundle(),suffix="";if(encrypted){const password=prompt("Пароль для disaster-recovery пакета:");if(!password)throw new Error("Пароль не указан");payload=await recovery133EncryptJson(payload,password);suffix="-encrypted"}
  const text=JSON.stringify(payload,null,2),name=`life-rpg-disaster-recovery-${localDateKey()}${suffix}.lrpgdr`,blob=new Blob([text],{type:"application/octet-stream"});return {blob,name,file:new File([blob],name,{type:"application/octet-stream"})}
}
async function recovery133ExportBundle(encrypted=false){try{const {blob,name}=await recovery133BundleFile({encrypted}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);recovery133Log("DR bundle экспортирован","ok",encrypted?"encrypted":"plain");toast("Disaster-recovery пакет создан") }catch(e){if(String(e?.message||e)!=="Пароль не указан")toast(`Экспорт не выполнен: ${e.message}`)}}
async function recovery133ShareBundle(){try{const pack=await recovery133BundleFile({encrypted:false});if(!navigator.share||!navigator.canShare?.({files:[pack.file]}))throw new Error("Системный обмен файлами не поддерживается");await navigator.share({files:[pack.file],title:"Life RPG disaster recovery",text:"Резервный пакет Life RPG"});recovery133Log("DR bundle передан через Share","ok",pack.name)}catch(e){if(e?.name!=="AbortError")toast(`Не удалось поделиться: ${e.message}`)}}
async function recovery133ParseBundleText(text){let obj=JSON.parse(text);if(obj?.format===RECOVERY133_ENCRYPTED_FORMAT){const password=prompt("Пароль от disaster-recovery пакета:");if(!password)throw new Error("Пароль не указан");obj=await recovery133DecryptJson(obj,password)}if(obj?.format!==RECOVERY133_FORMAT)throw new Error("Это не пакет Life RPG Recovery 13.3");const expected=obj.bundleChecksum,copy=deepClone(obj);delete copy.bundleChecksum;const actual=await recovery133Digest(copy);if(expected&&actual!==expected)throw new Error("Checksum всего recovery-пакета не совпадает");validateStateShape(obj.current?.state);const currentActual=await recovery133Digest(obj.current.state);if(obj.current?.meta?.checksum&&currentActual!==obj.current.meta.checksum)throw new Error("Checksum current state не совпадает");for(const snap of obj.snapshots||[]){const check=await recovery133VerifySnapshot(snap,{upgradeLegacy:false});if(!check.ok)throw new Error(`Повреждён snapshot ${snap.ts}: ${check.error}`)}return obj}
async function recovery133LoadBundleFile(input){const file=input?.files?.[0];if(!file)return;try{const obj=await recovery133ParseBundleText(await file.text());recovery133PendingBundle=obj;recovery133Log("DR bundle проверен","ok",`${obj.snapshots?.length||0} snapshots`);renderRecovery133();toast("Пакет проверен. Можно восстановить данные.")}catch(e){recovery133PendingBundle=null;recovery133Log("DR bundle отклонён","bad",String(e?.message||e));renderRecovery133();toast(`Пакет отклонён: ${e.message}`)}finally{if(input)input.value=""}}
async function recovery133StoreImportedSnapshot(row){let snap=deepClone(row),ts=Number(snap.ts)||Date.now();while(await dbGet("backups",ts))ts++;snap.ts=ts;snap.day=snap.day||localDateKey(new Date(ts));if(snap.meta){snap.meta={...snap.meta,createdAt:new Date(ts).toISOString()}}await dbPut("backups",snap);return ts}
async function recovery133ApplyPendingBundle(mode="full"){
  if(!recovery133PendingBundle)throw new Error("Сначала выбери recovery-пакет");if(!confirm(mode==="snapshots"?"Добавить snapshots из пакета без замены текущих данных?":"Восстановить текущие данные и snapshots из пакета? Текущее состояние будет сохранено как rollback."))return;
  {if(!db)await openDB();const rollback=await recovery133CreateSnapshot("Перед импортом DR bundle 13.3","rollback");for(const row of recovery133PendingBundle.snapshots||[])await recovery133StoreImportedSnapshot(row);if(mode!=="snapshots"){S=normalizeState(deepClone(recovery133PendingBundle.current.state));validateStateShape(S);recovery133SetRollback(rollback);audit("DR bundle restore 13.3","system",recovery133PendingBundle.createdAt||"");await persist(true)}await recovery133CleanupBackups(RECOVERY133_MAX_SNAPSHOTS);recovery133Log("DR bundle применён","ok",mode);recoverySnapshotsCache=await recovery133LoadAllSnapshots();render();await renderRecovery133();toast(mode==="snapshots"?"Snapshots импортированы":"Recovery-пакет восстановлен")}
}
function recovery133ClearPendingBundle(){recovery133PendingBundle=null;renderRecovery133()}

function recovery133StatusBadge(status){const label={match:"совпадает",diff:"отличается",missing:"нет копии",error:"ошибка",unknown:"не проверено"}[status]||status;return `<span class="tag">${escapeHtml(label)}</span>`}
function recovery133ScanHtml(){const r=recovery133LastScan;if(!r)return '<div class="muted">Проверка ещё не запускалась.</div>';const bad=(r.current.issues||[]).filter(x=>x.level==="bad").length,warn=(r.current.issues||[]).filter(x=>x.level!=="bad").length;return `<div class="report-grid"><div class="report-item"><div class="smallcaps">STATE</div><b>${r.current.ok?"OK":"ERROR"}</b></div><div class="report-item"><div class="smallcaps">Размер</div><b>${recovery133FormatBytes(r.current.sizeBytes)}</b></div><div class="report-item"><div class="smallcaps">Проблемы</div><b>${bad} / ${warn}</b></div><div class="report-item"><div class="smallcaps">Snapshots</div><b>${r.snapshots.ok}/${r.snapshots.checked}</b></div></div><div class="qmeta" style="margin-top:8px">IndexedDB ${recovery133StatusBadge(r.copies.indexedDb)} • localStorage ${recovery133StatusBadge(r.copies.localStorage)}</div>${r.snapshots.failed?`<div class="notice diagnostic-bad" style="margin-top:8px"><b>Повреждённых snapshots: ${r.snapshots.failed}</b></div>`:""}${r.current.issues?.length?`<div class="muted" style="margin-top:7px">Data Integrity: ${r.current.issues.slice(0,4).map(x=>escapeHtml(x.title)).join(" • ")}</div>`:""}`}
function recovery133PendingHtml(){const b=recovery133PendingBundle;if(!b)return "";const stats=b.current?.meta?.stats||recovery133StateStats(b.current?.state);return `<div class="notice" style="margin-top:10px"><b>Recovery-пакет проверен</b><div class="sub">${escapeHtml(b.createdAt||"")} • snapshots: ${b.snapshots?.length||0} • записей: ${stats.total||0}</div><div class="split" style="margin-top:8px;gap:6px;flex-wrap:wrap"><button data-recovery-safe class="btn secondary small" onclick="recovery133ApplyPendingBundle('full')">Восстановить всё</button><button data-recovery-safe class="btn ghost small" onclick="recovery133ApplyPendingBundle('snapshots')">Только snapshots</button><button data-recovery-safe class="btn ghost small" onclick="recovery133ClearPendingBundle()">Закрыть</button></div></div>`}
function recovery133SnapshotPreviewHtml(snap,check){if(!snap)return "";const stats=snap.meta?.stats||recovery133StateStats(snap.state),domains=Object.keys(RECOVERY133_DOMAIN_LABELS).map(k=>`<button data-recovery-safe class="btn ghost small" onclick="recovery133RestoreDomain(${snap.ts},'${k}')">${RECOVERY133_DOMAIN_LABELS[k]}</button>`).join("");return `<div class="notice" style="margin-top:10px"><div class="split"><div><b>${new Date(snap.ts).toLocaleString("ru-RU")}</b><div class="sub">${escapeHtml(snap.label||"Локальный snapshot")} • ${escapeHtml(recovery133SnapshotKind(snap))}</div></div><span class="tag">${check?.ok?"checksum OK":check?.legacy?"legacy":"проверить"}</span></div><div class="qmeta" style="margin-top:7px">${recovery133FormatBytes(snap.meta?.sizeBytes||recovery133ByteSize(snap.state))} • записей: ${stats.total||0}</div><div class="split" style="margin-top:9px;gap:6px;flex-wrap:wrap">${domains}</div><div class="split" style="margin-top:8px;gap:6px;flex-wrap:wrap"><button data-recovery-safe class="btn secondary small" onclick="recovery133RestoreFull(${snap.ts})">Полный restore</button><button data-recovery-safe class="btn ghost small" onclick="recovery133TestRestore(${snap.ts}).then(()=>toast('Dry-run восстановления: OK')).catch(e=>toast('Dry-run: '+e.message))">Dry-run</button></div></div>`}
function recovery133LogsHtml(){const rows=recovery133Logs().slice(0,8);return rows.length?rows.map(x=>`<div class="log-item"><div class="qtitle">${new Date(x.at).toLocaleString("ru-RU")} • ${escapeHtml(x.action)}</div><div class="qmeta">${escapeHtml(x.status)}${x.detail?` • ${escapeHtml(x.detail)}`:""}</div></div>`).join(""):'<div class="empty">Операций восстановления пока нет.</div>'}

function ensureRecovery133Ui(){
  recovery133InstallSafeModeGuard();recovery133ApplySafeModeUi();if(document.getElementById("recovery133Center"))return;const grid=document.querySelector?.("#more .grid");if(!grid)return;const legacy=document.getElementById("recoveryOsCommand")?.closest?.(".card");if(legacy)legacy.style.display="none";
  grid.insertAdjacentHTML("beforeend",`<div id="recovery133Center" data-ux7-view="settings" class="card ux7-card span-12"><div class="split"><div><div class="eyebrow">Recovery Center 13.3</div><div class="section-title">Backup, integrity, rollback</div></div><span id="recovery133SafeBadge" class="tag"></span></div><div class="muted" style="margin-top:6px">Локальные поколения snapshots с checksum, проверка восстанавливаемости, selective/full restore, rollback и перенос на новый телефон через disaster-recovery пакет.</div><div class="split" style="margin-top:10px;gap:6px;flex-wrap:wrap"><button data-recovery-safe class="btn secondary small" onclick="recovery133ScanStorage()">Сканировать</button><button data-recovery-safe class="btn ghost small" onclick="recovery133CreateManualCheckpoint()">+ Checkpoint</button><button data-recovery-safe class="btn ghost small" onclick="recovery133ExportBundle(false)">DR-пакет</button><button data-recovery-safe class="btn ghost small" onclick="recovery133ExportBundle(true)">DR + пароль</button><button data-recovery-safe class="btn ghost small" onclick="recovery133ShareBundle()">Поделиться</button><button data-recovery-safe class="btn ghost small" onclick="document.getElementById('recovery133Import').click()">Импорт</button><input id="recovery133Import" type="file" hidden accept=".lrpgdr,.json,application/json,application/octet-stream" onchange="recovery133LoadBundleFile(this)"><button data-recovery-safe id="recovery133SafeButton" class="btn ghost small"></button></div><div id="recovery133Pending"></div><div id="recovery133Scan" style="margin-top:10px"></div><div class="split" style="margin-top:12px"><div class="title">Snapshots</div><div class="split" style="gap:6px"><button data-recovery-safe id="recovery133RollbackBtn" class="btn ghost small" onclick="recovery133RollbackLast()">Rollback</button><button data-recovery-safe class="btn ghost small" onclick="recovery133DeleteOldSnapshots()">Очистить старые</button></div></div><div id="recovery133Snapshots" style="margin-top:8px"></div><div id="recovery133Preview"></div><div class="title" style="margin-top:12px">Журнал Recovery</div><div id="recovery133Log" style="margin-top:8px"></div></div>`)
}
async function renderRecovery133(){
  const center=document.getElementById("recovery133Center");if(!center)return;recovery133ApplySafeModeUi();const safe=recovery133SafeModeActive(),badge=document.getElementById("recovery133SafeBadge"),safeBtn=document.getElementById("recovery133SafeButton"),rollbackBtn=document.getElementById("recovery133RollbackBtn");if(badge)badge.textContent=safe?"SAFE MODE":"WRITE MODE";if(safeBtn){safeBtn.textContent=safe?"Выйти из Safe Mode":"Safe Mode";safeBtn.onclick=()=>recovery133SetSafeMode(!safe)}if(rollbackBtn)rollbackBtn.disabled=!recovery133RollbackTs();
  const pending=document.getElementById("recovery133Pending"),scan=document.getElementById("recovery133Scan"),list=document.getElementById("recovery133Snapshots"),preview=document.getElementById("recovery133Preview"),log=document.getElementById("recovery133Log");if(pending)pending.innerHTML=recovery133PendingHtml();if(scan)scan.innerHTML=recovery133ScanHtml();if(log)log.innerHTML=recovery133LogsHtml();
  let snaps=[];try{snaps=await recovery133LoadAllSnapshots();for(const row of snaps.slice(0,5))if(!row?.meta?.checksum)await recovery133EnsureMeta(row,true)}catch{}recoverySnapshotsCache=snaps;if(list)list.innerHTML=snaps.length?snaps.slice(0,20).map(x=>`<div class="log-item"><div class="split"><div><div class="qtitle">${new Date(x.ts).toLocaleString("ru-RU")}</div><div class="qmeta">${escapeHtml(x.label||"Автоматический snapshot")} • ${escapeHtml(recovery133SnapshotKind(x))}</div></div><button data-recovery-safe class="btn ghost small" onclick="recovery133SelectSnapshot(${x.ts})">Открыть</button></div></div>`).join(""):'<div class="empty">Snapshots пока нет.</div>';
  if(preview){const snap=snaps.find(x=>x.ts===recovery133SelectedTs);let check=null;if(snap)check=await recovery133VerifySnapshot(snap,{upgradeLegacy:true});preview.innerHTML=recovery133SnapshotPreviewHtml(snap,check)}
}

// Explicit emergency boot: append ?safe=1 to the app URL.
try{if(new URLSearchParams(location.search).get("safe")==="1")localStorage.setItem(RECOVERY133_SAFE_KEY,"1")}catch{}
