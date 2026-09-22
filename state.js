"use strict";

/* Life RPG 8.0.3 — State, persistence and migrations */

const DEFAULT_STATE={
  version:STATE_VERSION,
  profile:{name:"Павел",goal:"Закрыть долги и прокачать жизнь системно"},
  settings:{primaryAccountId:"",monthlyIncome:0,monthlyDebtGoal:0,workMonthlyPlan:0,campaignStart:"2026-09-19",campaignMonths:10,dailySpendLimit:0,emergencyFundTarget:0,emergencyFundBalance:0,miniBufferTarget:15000,highInterestThreshold:40,cashBalanceVerifiedAt:"",envelopeRollover:true,autoReserveAfterImport:true,learnImportRules:true,tennisElo:1000,tennisBaseElo:1000,tennisMonthlyTarget:12,tennisOfficialRating:0,readingDailyMin:30,readingReviewDays:7,incomeEvents:[],liquidityTargetDays:14,minimumCashFloor:0,forecastIncomeFactor:100},
  xpEarned:0,xpSpent:0,
  stats:{Финансы:0,Карьера:0,Разум:0,Теннис:0,Тело:0,Отношения:0,Дисциплина:0},
  xpEvents:[],
  debts:[],
  payments:[],balanceHistory:[],
  checks:{},questDone:{},achievements:{},rewardPurchases:[],
  workLogs:[],tennis:[],books:[],readingLogs:[],expenses:[],incomeLogs:[],bankImportIds:[],screenshotImportIds:[],bankTransfers:[],regularPayments:[],financeClosures:[],cashAdjustments:[],reservations:[],fundTransfers:[],accounts:[{id:"main",name:"Основной счёт",type:"Дебетовый счёт",verifiedBalance:null,verifiedAt:"",active:true}],assets:[],assetTransfers:[],importBatches:[],reconciliationSessions:[],importRules:[],crmDeals:[],auditLog:[],trash:[],envelopeCarryovers:{},envelopeLimits:{"Еда":0,"Транспорт":0,"Дом":0,"Связь":0,"Развлечения":0,"Теннис":0,"Покупки":0,"Другое":0},workTargets:{contacts:20,followups:10,lpr:3,meetings:3,proposals:3},
  created:new Date().toISOString(),updated:new Date().toISOString()
};

let S=deepClone(DEFAULT_STATE),db=null,deferredInstall=null;

function looksLikeLegacyReset(raw){
  if(!raw||Number(raw.version||0)>12)return false;
  const activityKeys=["payments","workLogs","tennis","books","readingLogs","expenses","incomeLogs","bankTransfers","regularPayments","financeClosures","cashAdjustments","reservations","fundTransfers","crmDeals"];
  if(activityKeys.some(k=>Array.isArray(raw[k])&&raw[k].length))return false;
  const debts=Array.isArray(raw.debts)?raw.debts:[];
  const legacyBalances=[800000,476307.16,48357.57,16858.21];
  if(debts.length!==4||!legacyBalances.every((v,i)=>Math.abs(Number(debts[i]?.balance||0)-v)<0.02))return false;
  const accounts=Array.isArray(raw.accounts)?raw.accounts:[];
  if(accounts.some(a=>a?.verifiedAt||a?.verifiedBalance!=null))return false;
  const ev=Array.isArray(raw?.settings?.incomeEvents)?raw.settings.incomeEvents:[];
  return ev.length===3&&[5,15,25].every((d,i)=>Number(ev[i]?.day||0)===d)&&[50000,50000,50000].every((a,i)=>Number(ev[i]?.amount||0)===a)
}

function convertLegacyResetToFresh(raw){
  if(!looksLikeLegacyReset(raw))return raw;
  const x=deepClone(raw);x.debts=[];x.balanceHistory=[];x.payments=[];x.accounts=[{id:"main",name:"Основной счёт",type:"Дебетовый счёт",verifiedBalance:null,verifiedAt:"",active:true}];
  x.settings={...(x.settings||{}),monthlyIncome:0,monthlyDebtGoal:0,workMonthlyPlan:0,dailySpendLimit:0,cashBalanceVerifiedAt:"",incomeEvents:[]};
  x.auditLog=[];x.cashAdjustments=[];x.reservations=[];x.fundTransfers=[];x.bankTransfers=[];x.bankImportIds=[];x.screenshotImportIds=[];return x
}

function normalizeLegacyStatementFingerprints(out){
  const bankIds=new Set(out.bankImportIds||[]),records=[...(out.incomeLogs||[]),...(out.expenses||[]),...(out.payments||[]),...(out.bankTransfers||[]),...(out.assetTransfers||[])],itemById=new Map();
  for(const b of out.importBatches||[])for(const it of b.items||[])itemById.set(it.id,it);
  let changed=0;
  for(const x of records){
    if(x?.imported!=="statement"||!x.statementId)continue;
    const dateKey=x.dateKey||x.localDate||String(x.date||"").slice(0,10),amount=Math.abs(+x.amount||0),kind=x.statementKind||x.importKind||"",signed=kind==="income"||kind==="refund"||kind==="debt_drawdown"?amount:kind==="asset_transfer"?(x.direction==="fromAsset"?amount:-amount):kind==="transfer"?(Number.isFinite(+x.syncEffect)?+x.syncEffect:(x.toAccountId&&!x.fromAccountId?amount:-amount)):-amount;
    if(!dateKey||!amount)continue;
    const canonical=`statement:${transactionFingerprint(dateKey,signed,x.statementId,1)}`;
    if(x.fp&&x.fp!==canonical){bankIds.delete(x.fp);changed++}
    bankIds.add(canonical);x.fp=canonical;
    const it=itemById.get(x.id);if(it)it.fp=canonical
  }
  out.bankImportIds=[...bankIds];return changed
}

function normalizeState(raw){
  raw=convertLegacyResetToFresh(raw||{});const out=deepClone(DEFAULT_STATE);
  out.version=STATE_VERSION;out.created=String(raw.created||out.created);out.updated=String(raw.updated||out.updated);out.profile={...out.profile,...(raw.profile||{})};out.settings={...out.settings,...(raw.settings||{})};
  const legacyIncome=Number(raw?.settings?.monthlyIncome||0)===200000;
  const legacyEvents=Array.isArray(raw?.settings?.incomeEvents)&&raw.settings.incomeEvents.length===4&&[75000,50000,25000,50000].every((v,i)=>Number(raw.settings.incomeEvents[i]?.amount||0)===v)&&[5,15,20,25].every((v,i)=>Number(raw.settings.incomeEvents[i]?.day||0)===v);
  if(legacyIncome&&legacyEvents){out.settings.monthlyIncome=150000;out.settings.incomeEvents=deepClone(DEFAULT_STATE.settings.incomeEvents)}
  const rawIncomeEvents=Array.isArray(out.settings.incomeEvents)?out.settings.incomeEvents:[];
  out.settings.incomeEvents=rawIncomeEvents.map((ev,i)=>({id:String(ev?.id||`income-${Number(ev?.day)||i+1}-${i+1}`),day:clamp(Math.round(Number(ev?.day)||1),1,31),label:String(ev?.label||"Доход"),amount:Math.max(0,Number(ev?.amount)||0)})).filter(ev=>ev.amount>0).sort((a,b)=>a.day-b.day);
  out.settings.monthlyIncome=out.settings.incomeEvents.length?out.settings.incomeEvents.reduce((sum,ev)=>sum+ev.amount,0):Math.max(0,Number(raw?.settings?.monthlyIncome||0)||0);
  out.xpEarned=Number(raw.xpEarned??raw.xp??0)||0;out.xpSpent=Number(raw.xpSpent||0)||0;out.stats={...out.stats,...(raw.stats||{})};out.xpEvents=Array.isArray(raw.xpEvents)?raw.xpEvents:[];
  const rb=Array.isArray(raw.debts)?raw.debts:[];out.debts=(rb.length?rb:out.debts).map((d,i)=>{const base=DEFAULT_STATE.debts[i]||{},type=String(d?.type||base.type||"Долг"),rate=Math.max(0,Number(d?.rate??base.rate??0)||0),min=Math.max(0,Number(d?.min??base.min??0)||0);return {...base,...d,id:String(d?.id||base.id||`debt-${i+1}`),type,initial:Number(d?.initial??base.initial??d?.balance??0)||0,balance:Math.max(0,Number(d?.balance??base.balance??0)||0),rate,min,dueDay:clamp(Math.round(Number(d?.dueDay??base.dueDay??1)||1),1,31),limit:Math.max(0,Number(d?.limit??base.limit??0)||0),nextPaymentDate:String(d?.nextPaymentDate||""),nextPaymentAmount:Math.max(0,Number(d?.nextPaymentAmount??0)||0),paymentMode:String(d?.paymentMode||(type==="Кредит"?"fixed":"statement")),rateKnown:d?.rateKnown!==false,parts:Array.isArray(d?.parts)?d.parts.map((p,j)=>({id:String(p?.id||`part-${j+1}`),name:String(p?.name||`Часть ${j+1}`),balance:Math.max(0,Number(p?.balance||0)||0),rate:Math.max(0,Number(p?.rate||0)||0),rateKnown:p?.rateKnown!==false})):[],balanceVerifiedAt:String(d?.balanceVerifiedAt||""),active:d?.active!==false}});
  out.payments=(Array.isArray(raw.payments)?raw.payments:[]).map(p=>{const debtId=String(p?.debtId||"");const idx=debtId?out.debts.findIndex(d=>d.id===debtId):Number.isInteger(+p?.debtIndex)?+p.debtIndex:-1;return {...p,debtId:debtId||(idx>=0?out.debts[idx]?.id||"":""),debtIndex:idx>=0?idx:(Number.isInteger(+p?.debtIndex)?+p.debtIndex:-1)}});out.balanceHistory=Array.isArray(raw.balanceHistory)&&raw.balanceHistory.length?raw.balanceHistory:[{date:out.settings.campaignStart,total:out.debts.reduce((a,d)=>a+(d.initial||0),0),type:"start"}];
  out.checks=raw.checks&&typeof raw.checks==="object"?raw.checks:{};out.questDone=raw.questDone&&typeof raw.questDone==="object"?raw.questDone:{};out.achievements=raw.achievements&&typeof raw.achievements==="object"?raw.achievements:{};out.rewardPurchases=Array.isArray(raw.rewardPurchases)?raw.rewardPurchases:[];
  for(const k of ["workLogs","tennis","books","readingLogs","expenses","incomeLogs","bankImportIds","screenshotImportIds","bankTransfers","regularPayments","financeClosures","cashAdjustments","reservations","fundTransfers","assets","assetTransfers","importBatches","reconciliationSessions","importRules","crmDeals","auditLog","trash"])out[k]=Array.isArray(raw[k])?raw[k]:out[k];
  out.accounts=Array.isArray(raw.accounts)&&raw.accounts.length?raw.accounts.map((a,i)=>({id:String(a.id||`account-${i+1}`),name:String(a.name||`Счёт ${i+1}`),type:String(a.type||"Счёт"),verifiedBalance:a.verifiedBalance==null?null:Math.max(0,Number(a.verifiedBalance)||0),verifiedAt:String(a.verifiedAt||""),active:a.active!==false})):deepClone(DEFAULT_STATE.accounts);
  if(!out.accounts.some(a=>a.id==="main"))out.accounts.unshift(deepClone(DEFAULT_STATE.accounts[0]));
  // v15: explicit primary account. Move legacy placeholder operations to the freshest verified real account.
  const legacyMain=out.accounts.find(a=>a.id==="main"),verifiedAccounts=out.accounts.filter(a=>a.active!==false&&a.verifiedAt&&a.verifiedBalance!=null).sort((a,b)=>Date.parse(b.verifiedAt)-Date.parse(a.verifiedAt)),preferredVerified=verifiedAccounts[0]||null;
  if(!out.settings.primaryAccountId||!out.accounts.some(a=>a.id===out.settings.primaryAccountId&&a.active!==false))out.settings.primaryAccountId=(legacyMain&&!legacyMain.verifiedAt&&legacyMain.verifiedBalance==null&&preferredVerified)?preferredVerified.id:(legacyMain?.id||preferredVerified?.id||out.accounts[0]?.id||"main");
  if(legacyMain&&!legacyMain.verifiedAt&&legacyMain.verifiedBalance==null&&out.settings.primaryAccountId!=="main"){
    const target=out.settings.primaryAccountId;
    for(const x of out.incomeLogs||[])if(!x.accountId||x.accountId==="main")x.accountId=target;
    for(const x of out.expenses||[])if(!x.accountId||x.accountId==="main")x.accountId=target;
    for(const x of out.payments||[])if(!x.accountId||x.accountId==="main")x.accountId=target;
    for(const x of out.assetTransfers||[])if(!x.accountId||x.accountId==="main")x.accountId=target;
    for(const x of out.cashAdjustments||[])if(!x.accountId||x.accountId==="main")x.accountId=target;
    legacyMain.active=false;
  }
  out.assets=(out.assets||[]).map((a,i)=>({id:String(a.id||`asset-${i+1}`),name:String(a.name||`Актив ${i+1}`),type:String(a.type||"Инвестиции"),verifiedValue:Math.max(0,Number(a.verifiedValue??a.value??0)||0),verifiedAt:String(a.verifiedAt||""),liquid:a.liquid!==false,available:!!a.available,active:a.active!==false,note:String(a.note||"")}));
  const main=out.accounts.find(a=>a.id===out.settings.primaryAccountId)||out.accounts.find(a=>a.id==="main")||out.accounts[0];
  out.incomeLogs=out.incomeLogs.map(x=>({...x,accountId:x.accountId||main.id}));out.expenses=out.expenses.map(x=>({...x,accountId:x.accountId||main.id}));out.payments=out.payments.map(x=>({...x,debtId:x.debtId||out.debts[x.debtIndex]?.id||"",accountId:x.accountId||main.id}));out.bankTransfers=out.bankTransfers.map(x=>({...x,fromAccountId:x.fromAccountId||"",toAccountId:x.toAccountId||""}));normalizeLegacyStatementFingerprints(out);
  out.envelopeCarryovers=raw.envelopeCarryovers&&typeof raw.envelopeCarryovers==="object"?raw.envelopeCarryovers:{};out.envelopeLimits={...out.envelopeLimits,...(raw.envelopeLimits||{})};out.workTargets={...out.workTargets,...(raw.workTargets||{})};
  if(!out.xpEvents.length&&out.xpEarned>0)out.xpEvents.push({id:uid(),date:out.created||new Date().toISOString(),xp:out.xpEarned,stat:"Миграция",label:"Перенесённый XP",kind:"process"});
  return out
}

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=e=>{const x=e.target.result;if(!x.objectStoreNames.contains("state"))x.createObjectStore("state");if(!x.objectStoreNames.contains("backups"))x.createObjectStore("backups",{keyPath:"ts"})};r.onsuccess=()=>{db=r.result;res(db)};r.onerror=()=>rej(r.error)})}

function dbGet(store,key){return new Promise((res,rej)=>{const q=db.transaction(store,"readonly").objectStore(store).get(key);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}

function dbPut(store,val,key){return new Promise((res,rej)=>{const os=db.transaction(store,"readwrite").objectStore(store),q=key===undefined?os.put(val):os.put(val,key);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})}

function dbGetAll(store){return new Promise((res,rej)=>{const q=db.transaction(store,"readonly").objectStore(store).getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error)})}

function dbDelete(store,key){return new Promise((res,rej)=>{const q=db.transaction(store,"readwrite").objectStore(store).delete(key);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})}

async function createPreActionSnapshot(label=""){if(!db)await openDB();let ts=Date.now();while(await dbGet("backups",ts))ts++;await dbPut("backups",{ts,day:localDateKey(),label,state:deepClone(S)});await cleanupBackups(40);return ts}

async function cleanupBackups(limit=30){const all=(await dbGetAll("backups")).sort((a,b)=>b.ts-a.ts);for(const x of all.slice(limit))await dbDelete("backups",x.ts)}

async function loadState(){try{await openDB();const saved=await dbGet("state","current");if(saved)S=normalizeState(saved);else{const legacy=localStorage.getItem("lifeRpg3")||localStorage.getItem("lifeRpgPwa");if(legacy)S=normalizeState(JSON.parse(legacy));await persist(true)}$("storageStatus").textContent="IndexedDB подключена • локальная база работает офлайн."}catch(e){const x=localStorage.getItem("lifeRpg4");if(x)S=normalizeState(JSON.parse(x));$("storageStatus").textContent="IndexedDB недоступна • используется резервное localStorage."}if(checkAchievements())await persist();render();requestAnimationFrame(()=>document.documentElement.classList.remove("life-rpg-booting"));runReminderCheck();setInterval(runReminderCheck,3600000)}

async function persist(makeBackup=false){if(typeof syncAutoDailyQuests==="function")syncAutoDailyQuests();checkAchievements();S.version=STATE_VERSION;S.updated=new Date().toISOString();try{if(!db)await openDB();await dbPut("state",S,"current");const day=localDateKey(),last=localStorage.getItem("lifeRpgBackupDay");if(makeBackup||day!==last){await dbPut("backups",{ts:Date.now(),day,state:deepClone(S)});await cleanupBackups(30);localStorage.setItem("lifeRpgBackupDay",day)}}catch(e){localStorage.setItem("lifeRpg4",JSON.stringify(S))}}

async function save(msg){await persist();render();if(msg)toast(msg)}

function audit(action,entity="",detail=""){S.auditLog=S.auditLog||[];S.auditLog.unshift({id:uid(),date:new Date().toISOString(),action,entity,detail:String(detail||"")});S.auditLog=S.auditLog.slice(0,300)}

function trashPush(kind,item){S.trash=S.trash||[];S.trash.unshift({id:uid(),kind,item:deepClone(item),deletedAt:new Date().toISOString()});S.trash=S.trash.slice(0,30);audit("Удалено",kind,item.note||item.name||item.debt||"")}

function renderAudit(){const box=$("auditLog");if(!box)return;box.innerHTML=(S.auditLog||[]).slice(0,20).map(x=>`<div class="log-item"><div class="qtitle">${new Date(x.date).toLocaleString("ru-RU")} • ${escapeHtml(x.action)}</div><div class="qmeta">${escapeHtml(x.entity||"")}${x.detail?` • ${escapeHtml(x.detail)}`:""}</div></div>`).join("")||'<div class="empty">Журнал пока пуст.</div>'}

async function renderSnapshots(){const box=$("snapshotList");if(!box)return;try{if(!db)await openDB();const all=(await dbGetAll("backups")).sort((a,b)=>b.ts-a.ts).slice(0,8);box.innerHTML=all.length?all.map(x=>`<div class="log-item"><div class="qtitle">${new Date(x.ts).toLocaleString("ru-RU")}</div><div class="qmeta">${escapeHtml(x.label||"Локальный снимок")} • ${escapeHtml(x.day||"")}</div><button class="btn ghost small" style="margin-top:7px" onclick="restoreSnapshot(${x.ts})">Восстановить</button></div>`).join(""):'<div class="empty">Снимков пока нет.</div>'}catch(e){box.innerHTML='<div class="empty">Локальные снимки недоступны.</div>'}}

async function restoreSnapshot(ts){if(!confirm("Восстановить этот снимок? Текущее состояние сначала будет сохранено отдельной копией."))return;try{if(!db)await openDB();const snap=await dbGet("backups",ts);if(!snap?.state){toast("Снимок не найден");return}await persist(true);S=normalizeState(snap.state);await persist(true);render();toast("Снимок восстановлен")}catch(e){toast("Не удалось восстановить снимок")}}

async function exportBackup(encrypted){const data=JSON.stringify(S);let blob,name;if(encrypted){const pass=$("backupPassword").value;if(!pass){toast("Укажи пароль");return}const enc=new TextEncoder(),salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),keyMat=await crypto.subtle.importKey("raw",enc.encode(pass),"PBKDF2",false,["deriveKey"]),key=await crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:200000,hash:"SHA-256"},keyMat,{name:"AES-GCM",length:256},false,["encrypt"]),cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,enc.encode(data));blob=new Blob([JSON.stringify({format:"life-rpg-encrypted-v1",salt:bytesToBase64(salt),iv:bytesToBase64(iv),data:bytesToBase64(new Uint8Array(cipher))})],{type:"application/octet-stream"});name=`life-rpg-${localDateKey()}.lrpg`;closeModal("encryptedBackupModal")}else{blob=new Blob([JSON.stringify(S,null,2)],{type:"application/json"});name=`life-rpg-${localDateKey()}.json`}const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

async function importBackupFile(file){const text=await file.text();let obj=JSON.parse(text);if(obj.format==="life-rpg-encrypted-v1"){const pass=prompt("Пароль от резервной копии:");if(!pass)throw new Error("Пароль не указан");const dec64=base64ToBytes,enc=new TextEncoder(),keyMat=await crypto.subtle.importKey("raw",enc.encode(pass),"PBKDF2",false,["deriveKey"]),key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:dec64(obj.salt),iterations:200000,hash:"SHA-256"},keyMat,{name:"AES-GCM",length:256},false,["decrypt"]),plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:dec64(obj.iv)},key,dec64(obj.data));obj=JSON.parse(new TextDecoder().decode(plain))}const checked=window.LifePlatform?.validateBackup?.(obj);if(checked&&!checked.ok)throw new Error(checked.error||"Резервная копия не прошла проверку");obj=checked?.data||obj;await createPreActionSnapshot("Перед импортом резервной копии");S=normalizeState(obj);await persist();render();toast("Резервная копия восстановлена • предыдущее состояние сохранено в снимках")}

function dataIntegrityIssues(){
  const issues=[],ids=new Map(),add=(level,title,detail="")=>issues.push({level,title,detail});
  const primary=(S.accounts||[]).find(a=>a.id===S.settings.primaryAccountId&&a.active!==false);if(!primary)add("bad","Основной счёт не найден","Выбери основной активный счёт");
  for(const a of activeAccounts()){const b=accountBalanceById(a.id);if(b<-.01)add("bad",`Отрицательный учётный остаток: ${a.name}`,rub(b));if(!a.verifiedAt)add("warn",`Счёт не сверялся: ${a.name}`,"Подтверди фактический остаток")}
  const today=localDateKey();for(const d of (S.debts||[]).filter(x=>x.active!==false&&x.balance>0)){if(!validDateKey(d.nextPaymentDate))add("warn",`Нет следующей даты платежа: ${d.name}`,"Обнови данные долга");else if(d.nextPaymentDate<today)add("bad",`Просрочена дата платежа: ${d.name}`,fmtDate(parseLocal(d.nextPaymentDate)))}
  const collections=[["incomeLogs",S.incomeLogs],["expenses",S.expenses],["payments",S.payments],["workLogs",S.workLogs],["tennis",S.tennis],["books",S.books],["readingLogs",S.readingLogs],["crmDeals",S.crmDeals]];for(const [name,arr] of collections)for(const x of arr||[]){if(!x?.id)continue;const key=`${name}:${x.id}`;if(ids.has(key))add("bad",`Дублирующийся ID в ${name}`,x.id);ids.set(key,true)}
  for(const p of S.payments||[]){if(p.debtId&&!debtById(p.debtId))add("warn","Платёж ссылается на отсутствующий долг",p.debt||p.debtId)}
  const future=[];for(const x of S.incomeLogs||[])if(x.dateKey>today)future.push(`доход ${x.dateKey}`);for(const x of S.expenses||[])if(x.dateKey>today)future.push(`расход ${x.dateKey}`);for(const x of S.workLogs||[])if(x.date>today)future.push(`работа ${x.date}`);for(const x of S.tennis||[])if(x.dateKey>today)future.push(`теннис ${x.dateKey}`);for(const x of S.readingLogs||[])if(x.dateKey>today)future.push(`чтение ${x.dateKey}`);if(future.length)add("warn","Есть фактические записи из будущего",future.slice(0,4).join(" • "));

  // Work / CRM integrity.
  for(const w of S.workLogs||[]){if((+w.sales||0)<0||(+w.pipeline||0)<0)add("bad","Некорректная рабочая запись",w.date||w.id);if(w.sourceDealId&&!S.crmDeals.some(d=>d.id===w.sourceDealId))add("warn","Реализация ссылается на отсутствующую CRM-сделку",w.note||w.sourceDealId);if(w.sourceDealId){const d=S.crmDeals.find(x=>x.id===w.sourceDealId);if(d&&+d.realizedAmount>0&&Math.abs((+w.sales||0)-(+d.realizedAmount||0))>.01)add("warn",`CRM и факт продаж расходятся: ${d.name}`,`${rub(d.realizedAmount)} в CRM • ${rub(w.sales)} в рабочем журнале`)}}
  for(const d of S.crmDeals||[]){const open=!["Выиграно","Проиграно"].includes(d.stage);if(open&&(!d.nextStep||!validDateKey(d.nextDate)))add("warn",`CRM без следующего шага: ${d.name||"без названия"}`,"Укажи действие и дату");if((+d.potential||0)>=500000&&typeof crmCompleteness==="function"){const q=crmCompleteness(d);if(q&&!q.ok)add("warn",`Неполная карточка ≥500k: ${d.name||"объект"}`,`${q.done}/${q.total}`)}const dates=[d.decisionDate,d.tenderDate,d.realizationDate,d.closeDate].filter(validDateKey);if(dates.some(x=>x<"2000-01-01"))add("warn",`Некорректная дата CRM: ${d.name||"объект"}`);if(d.stage==="Выиграно"&&!S.workLogs.some(w=>w.sourceDealId===d.id&&(+w.sales||0)>0))add("warn",`Выигранная сделка не отражена в продажах: ${d.name||"объект"}`,"Зачти реализацию из карточки CRM")}

  // Tennis integrity.
  for(const t of S.tennis||[]){if((+t.min||0)<=0)add("bad","Теннисная сессия без длительности",t.dateKey||t.id);if((+t.serveMin||0)+(+t.footMin||0)>(+t.min||0)+.01)add("bad","Теннис: специализированные минуты больше длительности",t.dateKey||t.id);const matches=Array.isArray(t.matches)?t.matches:[];for(const m of matches){if(!["W","L"].includes(m.result))add("warn","Матч без результата W/L",m.opponent||t.dateKey);if((+m.opponentRating||0)<0)add("bad","Отрицательный рейтинг соперника",m.opponent||"")}}

  // Knowledge integrity.
  const activeBooks=(S.books||[]).filter(b=>b.status==="reading");if(activeBooks.length>1)add("bad","Одновременно начато несколько книг",activeBooks.map(b=>b.title).join(" • "));
  const orders=new Map();for(const b of S.books||[]){if(b.status==="queued"&&b.readingOrder){const k=String(b.readingOrder);if(orders.has(k))add("warn","Повторяется номер в очереди чтения",`№${k}: ${orders.get(k)} / ${b.title}`);else orders.set(k,b.title)}const sum=(S.readingLogs||[]).filter(x=>x.bookId===b.id).reduce((n,x)=>n+Math.max(0,+x.pages||0),0),expected=Math.min(Math.max(0,+b.totalPages||0),sum);if(b.status!=="queued"&&b.status!=="archived"&&Math.abs((+b.currentPage||0)-expected)>.01)add("warn",`Прогресс книги требует пересчёта: ${b.title}`,`${b.currentPage||0} → ${expected}`)}
  for(const r of S.readingLogs||[])if(r.bookId&&!S.books.some(b=>b.id===r.bookId))add("warn","Сессия чтения ссылается на отсутствующую книгу",r.dateKey||r.id);

  return issues
}

async function repairDomainIntegrity(){if(!confirm("Выполнить безопасный пересчёт производных данных? Перед этим будет создан снимок."))return;await createPreActionSnapshot("Перед безопасным ремонтом данных");for(const b of S.books||[]){const pages=(S.readingLogs||[]).filter(x=>x.bookId===b.id).reduce((n,x)=>n+Math.max(0,+x.pages||0),0);b.currentPage=Math.min(Math.max(0,+b.totalPages||0),pages)}const q=(S.books||[]).filter(b=>b.status==="queued").slice().sort((a,b)=>(+a.readingOrder||999999)-(+b.readingOrder||999999)||String(a.created||"").localeCompare(String(b.created||"")));q.forEach((b,i)=>b.readingOrder=i+1);for(const d of S.crmDeals||[])d.probability=clamp(+d.probability||0,0,100);for(const t of S.tennis||[]){if(Array.isArray(t.matches)&&t.matches.length){t.w=t.matches.filter(m=>String(m.result||"").toUpperCase()==="W").length;t.l=t.matches.filter(m=>String(m.result||"").toUpperCase()==="L").length}}if(typeof recomputeTennisElo==="function")recomputeTennisElo();audit("Безопасный ремонт данных","system","очередь книг • прогресс • CRM probability • Tennis Elo");await save("Производные данные пересчитаны")}

function renderSystemDiagnostics(){const box=$("systemDiagnostics");if(!box)return;const issues=dataIntegrityIssues();if($("trashStatus"))$("trashStatus").textContent=(S.trash||[]).length?`В корзине: ${S.trash.length}`:"Корзина пуста";if(!issues.length){box.innerHTML='<div class="status"><b>OK.</b> Финансы, CRM, Work, Tennis и Knowledge не показывают критичных проблем целостности.</div>';return}box.innerHTML=issues.map(x=>`<div class="notice ${x.level==="bad"?"diagnostic-bad":""}" style="margin-top:8px"><b>${escapeHtml(x.title)}</b>${x.detail?`<div class="sub">${escapeHtml(x.detail)}</div>`:""}</div>`).join("")}

async function resetAll(){if(!confirm("Точно сбросить весь прогресс и начать с чистого профиля? Текущее состояние будет сохранено отдельным снимком."))return;await createPreActionSnapshot("Перед полным сбросом");S=deepClone(DEFAULT_STATE);bankSyncSession={accountId:"main",bankBalance:null,balanceConfidence:0,balanceLabel:"",balanceSource:"",baseExpected:0,wasVerified:false,importedNet:0,detectedAt:"",lastText:""};screenshotImportQueue=[];await persist();render();toast("Создан чистый профиль • предыдущее состояние сохранено в снимках")}
