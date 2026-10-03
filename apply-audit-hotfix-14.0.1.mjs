import fs from "node:fs";

const marker="AUDIT-HOTFIX-14.0.1.md";
if(fs.existsSync(marker)) throw new Error("Audit hotfix 14.0.1 is already applied");

function read(file){return fs.readFileSync(file,"utf8")}
function write(file,s){fs.writeFileSync(file,s)}
function replaceOnce(file,oldText,newText,label){
  let s=read(file);
  const first=s.indexOf(oldText),last=s.lastIndexOf(oldText);
  if(first<0) throw new Error(`${label}: anchor not found in ${file}`);
  if(first!==last) throw new Error(`${label}: anchor is not unique in ${file}`);
  s=s.slice(0,first)+newText+s.slice(first+oldText.length);
  write(file,s);
}
function assertContains(file,token,label=token){
  if(!read(file).includes(token))throw new Error(`${label}: missing in ${file}`);
}

// 1) Statement import: strict kinds + unambiguous balance anchor timestamp.
replaceOnce("platform.vite.mjs",
`const StatementTxSchema=z.object({date:z.string().min(8),amount:z.number().finite().optional(),signedAmount:z.number().finite().optional(),kind:z.string().min(1)}).passthrough().refine(x=>Number.isFinite(x.amount)||Number.isFinite(x.signedAmount),{message:"Операция выписки без суммы"});`,
`const StatementTxSchema=z.object({date:z.string().min(8),amount:z.number().finite().optional(),signedAmount:z.number().finite().optional(),kind:z.enum(["income","expense","refund","transfer","asset_transfer","debt_payment"])}).passthrough().refine(x=>Number.isFinite(x.amount)||Number.isFinite(x.signedAmount),{message:"Операция выписки без суммы"});`,
"strict statement kind schema");

replaceOnce("imports.js",
`let statementImportPackage=null;

function statementTxDateKey(x)`,
`let statementImportPackage=null;
const STATEMENT_IMPORT_KINDS=new Set(["income","expense","refund","transfer","asset_transfer","debt_payment"]);

function statementInvalidKinds(pkg){
  return (Array.isArray(pkg?.transactions)?pkg.transactions:[]).filter(x=>!STATEMENT_IMPORT_KINDS.has(String(x?.kind||"")))
}
function statementAnchorIso(pkg){
  const a=pkg?.balanceAnchor||{};
  if(!Number.isFinite(Number(a.balance)))return "";
  const raw=String(a.asOf||"").trim();
  if(!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}/.test(raw))return "";
  const ts=Date.parse(raw);
  if(!Number.isFinite(ts)||ts>Date.now()+300000)return "";
  return new Date(ts).toISOString()
}

function statementTxDateKey(x)`,
"statement validation helpers");

replaceOnce("imports.js",
`const badDates=obj.transactions.filter(x=>!statementTxDateKey(x));if(badDates.length)throw new Error(\`В выписке некорректных или будущих дат: \${badDates.length}\`);const anchorDate=String(obj?.balanceAnchor?.asOf||"").slice(0,10);if(anchorDate&&!validActivityDate(anchorDate))throw new Error("Дата контрольного остатка выписки некорректна или находится в будущем");statementImportPackage=obj;`,
`const badDates=obj.transactions.filter(x=>!statementTxDateKey(x));if(badDates.length)throw new Error(\`В выписке некорректных или будущих дат: \${badDates.length}\`);const badKinds=statementInvalidKinds(obj);if(badKinds.length)throw new Error(\`В выписке неподдерживаемых типов операций: \${badKinds.length}\`);if(Number.isFinite(Number(obj?.balanceAnchor?.balance))){const anchorIso=statementAnchorIso(obj);if(!anchorIso)throw new Error("Контрольный остаток требует точного ISO timestamp balanceAnchor.asOf, а не только даты");obj.balanceAnchor={...(obj.balanceAnchor||{}),asOf:anchorIso}}statementImportPackage=obj;`,
"statement preview hardening");

replaceOnce("imports.js",
`if(!String(pkg.packageId||"").trim()){toast("Выписка без packageId не может быть применена");return}const badDates=(pkg.transactions||[]).filter(x=>!statementTxDateKey(x));if(badDates.length){toast(\`Импорт заблокирован: некорректных или будущих дат \${badDates.length}\`);return}const old=`,
`if(!String(pkg.packageId||"").trim()){toast("Выписка без packageId не может быть применена");return}const badDates=(pkg.transactions||[]).filter(x=>!statementTxDateKey(x));if(badDates.length){toast(\`Импорт заблокирован: некорректных или будущих дат \${badDates.length}\`);return}const badKinds=statementInvalidKinds(pkg);if(badKinds.length){toast(\`Импорт заблокирован: неподдерживаемых типов операций \${badKinds.length}\`);return}if(Number.isFinite(Number(pkg?.balanceAnchor?.balance))&&!statementAnchorIso(pkg)){toast("Импорт заблокирован: нужен точный timestamp контрольного остатка");return}const old=`,
"statement apply preflight");

replaceOnce("imports.js",
`}else{const signed=statementSigned(tx),incoming=signed>0;x={...common,amount,fromAccountId:incoming?"":account.id,toAccountId:incoming?account.id:"",syncAccountId:account.id,syncEffect:incoming?amount:-amount,note:desc,importKind:"transfer",transferClass:tx.kind||"transfer"};S.bankTransfers.unshift(x)}if(x){`,
`}else if(tx.kind==="transfer"){const signed=statementSigned(tx),incoming=signed>0;x={...common,amount,fromAccountId:incoming?"":account.id,toAccountId:incoming?account.id:"",syncAccountId:account.id,syncEffect:incoming?amount:-amount,note:desc,importKind:"transfer",transferClass:"transfer"};S.bankTransfers.unshift(x)}else throw new Error(\`Неподдерживаемый тип операции выписки: \${String(tx.kind||"")}\`);if(x){`,
"statement unknown kind fail closed");

replaceOnce("imports.js",
`const anchor=pkg.balanceAnchor||{},prev=before.accounts?.find(a=>a.id===account.id),accountBefore=`,
`const anchor=pkg.balanceAnchor||{},anchorIso=statementAnchorIso(pkg),prev=before.accounts?.find(a=>a.id===account.id),accountBefore=`,
"statement anchor timestamp binding");
replaceOnce("imports.js",
`if(Number.isFinite(Number(anchor.balance))){account.verifiedBalance=Math.max(0,Number(anchor.balance));account.verifiedAt=anchor.asOf||new Date().toISOString();`,
`if(Number.isFinite(Number(anchor.balance))){if(!anchorIso)throw new Error("Некорректный timestamp контрольного остатка");account.verifiedBalance=Math.max(0,Number(anchor.balance));account.verifiedAt=anchorIso;`,
"statement anchor application");

// 2) Finance snapshot must preserve refunds (negative expense rows).
replaceOnce("finance-rebuild-14.js",
`if(typeof row[field]!=="number"||!Number.isFinite(row[field])||(field!=="delta"&&row[field]<0))throw new Error(\`Finance Rebuild: некорректное число \${key}.\${field}\`)`,
`const negativeRefund=key==="expenses"&&field==="amount"&&row[field]<0;
      if(typeof row[field]!=="number"||!Number.isFinite(row[field])||(field!=="delta"&&row[field]<0&&!negativeRefund))throw new Error(\`Finance Rebuild: некорректное число \${key}.\${field}\`)`,
"refund-safe snapshot validation");

// 3) Reservation expiry is enforced by calculations and undo paths.
replaceOnce("finance.js",
`function activeReservations(){return (S.reservations||[]).filter(x=>x.status==="active"&&(+x.remaining||0)>0.009)}`,
`function reservationExpired(r,today=localDateKey()){const until=String(r?.untilDate||"");return validDateKey(until)&&until<today}
function activeReservations(){return (S.reservations||[]).filter(x=>x.status==="active"&&(+x.remaining||0)>0.009&&!reservationExpired(x))}`,
"reservation expiry");

replaceOnce("finance.js",
`r.remaining=moneyAdd(r.remaining,u.amount);r.status="active"`,
`r.remaining=moneyAdd(r.remaining,u.amount);r.status=reservationExpired(r)?"expired":"active"`,
"expired reservation restore");

// 4) Unknown debt rates become an explicit blocked state for rate-sensitive advice.
replaceOnce("finance.js",
`function debtEffectiveRate(d){`,
`function debtRateKnown(d){
  const balance=Math.max(0,+d?.balance||0),parts=Array.isArray(d?.parts)?d.parts.filter(p=>(+p.balance||0)>0):[];
  if(balance<=0)return true;
  if(parts.some(p=>p?.rateKnown===false||!Number.isFinite(Number(p?.rate))))return false;
  const partsBalance=parts.reduce((s,p)=>s+(+p.balance||0),0);
  if(parts.length&&partsBalance>=balance-.01)return true;
  return d?.rateKnown!==false&&Number.isFinite(Number(d?.rate))
}
function unknownRateDebts(debts=S.debts){return (debts||[]).filter(d=>(+d?.balance||0)>0&&!debtRateKnown(d))}

function debtEffectiveRate(d){`,
"unknown-rate helpers");

replaceOnce("finance.js",
`const fund=+S.settings.emergencyFundBalance||0,mini=+S.settings.miniBufferTarget||0,full=+S.settings.emergencyFundTarget||0,high=highestHighInterestDebt();
  if(mini>0&&fund<mini)return {id:"mini_buffer",name:"Мини-буфер",detail:\`Сначала довести резерв до \${rub(mini)}.\`};
  if(high)return`,
`const fund=+S.settings.emergencyFundBalance||0,mini=+S.settings.miniBufferTarget||0,full=+S.settings.emergencyFundTarget||0,unknown=unknownRateDebts(),high=highestHighInterestDebt();
  if(mini>0&&fund<mini)return {id:"mini_buffer",name:"Мини-буфер",detail:\`Сначала довести резерв до \${rub(mini)}.\`};
  if(unknown.length)return {id:"rate_unknown",name:"Нужны ставки долгов",detail:\`У \${unknown.length} открытых долгов ставка не подтверждена — досрочные приоритеты заблокированы.\`};
  if(high)return`,
"financial phase unknown rate");

replaceOnce("finance.js",
`if(phase.id==="mini_buffer"){emergencyNeed=Math.max(0,moneySub(miniBufferGap(),ignoreReservations?0:reservationAmount("emergency")));emergencyTopUp=take(emergencyNeed);best=bestDebt();debtExtra=best?take(best.balance):0}`,
`if(phase.id==="mini_buffer"){emergencyNeed=Math.max(0,moneySub(miniBufferGap(),ignoreReservations?0:reservationAmount("emergency")));emergencyTopUp=take(emergencyNeed);if(!unknownRateDebts().length){best=bestDebt();debtExtra=best?take(best.balance):0}}`,
"autopilot mini-buffer unknown rate");

replaceOnce("finance.js",
`function highestRateDebtIndex(){let best=-1,bestRate=-Infinity;S.debts.forEach((d,i)=>{if(d.balance<=0)return;const rate=debtEffectiveRate(d);if(best<0||rate>bestRate){best=i;bestRate=rate}});return best}`,
`function highestRateDebtIndex(){if(unknownRateDebts().length)return-1;let best=-1,bestRate=-Infinity;S.debts.forEach((d,i)=>{if(d.balance<=0||!debtRateKnown(d))return;const rate=debtEffectiveRate(d);if(best<0||rate>bestRate){best=i;bestRate=rate}});return best}`,
"highest rate unknown guard");

replaceOnce("finance.js",
`function highestHighInterestDebt(){const t=Math.max(0,finiteNumberOr(S.settings.highInterestThreshold,40));return S.debts.map((d,i)=>({...d,i,_er:debtEffectiveRate(d)})).filter(d=>d.balance>0&&d._er>=t).sort((a,b)=>b._er-a._er)[0]||null}

function bestDebt(){return S.debts.map((d,i)=>({...d,i,_er:debtEffectiveRate(d)})).filter(d=>d.balance>0).sort((a,b)=>b._er-a._er)[0]}`,
`function highestHighInterestDebt(){const t=Math.max(0,finiteNumberOr(S.settings.highInterestThreshold,40));return S.debts.map((d,i)=>({...d,i,_known:debtRateKnown(d),_er:debtEffectiveRate(d)})).filter(d=>d.balance>0&&d._known&&d._er>=t).sort((a,b)=>b._er-a._er)[0]||null}

function bestDebt(){return S.debts.map((d,i)=>({...d,i,_known:debtRateKnown(d),_er:debtEffectiveRate(d)})).filter(d=>d.balance>0&&d._known).sort((a,b)=>b._er-a._er)[0]||null}`,
"known-rate debt priority");

replaceOnce("finance.js",
`function simulateDebt(monthlyBudget,debts=S.debts,maxMonths=120){let arr=debts.filter(d=>d.balance>0).map(d=>`,
`function simulateDebt(monthlyBudget,debts=S.debts,maxMonths=120){const unknown=unknownRateDebts(debts),startTotal=moneySum((debts||[]).filter(d=>d.balance>0).map(d=>d.balance));if(unknown.length)return {months:Infinity,interest:NaN,series:[startTotal],feasible:false,remaining:startTotal,reason:\`Неизвестна ставка: \${unknown.map(d=>d.name).join(", ")}\`,unreliable:true};let arr=debts.filter(d=>d.balance>0).map(d=>`,
"simulateDebt unknown guard");

replaceOnce("finance.js",
`function simulateDebtStrategy(monthlyBudget,strategy="avalanche"){const ds=deepClone(S.debts).filter(d=>d.balance>0).map(d=>`,
`function simulateDebtStrategy(monthlyBudget,strategy="avalanche"){const unknown=unknownRateDebts();if(unknown.length){const remaining=moneySum(unknownRateDebts().concat(S.debts.filter(d=>(+d.balance||0)>0&&debtRateKnown(d))).map(d=>d.balance));return {months:Infinity,interest:NaN,order:[],feasible:false,remaining,reason:\`Неизвестна ставка: \${unknown.map(d=>d.name).join(", ")}\`,unreliable:true}}const ds=deepClone(S.debts).filter(d=>d.balance>0).map(d=>`,
"simulate strategy unknown guard");

replaceOnce("finance.js",
`warnings:[...(accountsModeActive()?[]:["Нет подтверждённого банковского остатка"]),...(debtScheduleIssues().length?[\`У \${debtScheduleIssues().length} долгов отсутствует или просрочена следующая дата платежа\`]:[]),...((!+S.settings.dailySpendLimit&&!Object.values(S.envelopeLimits||{}).some(x=>+x>0))?["Не задан бюджет повседневных расходов"]:[])]}`,
`warnings:[...(accountsModeActive()?[]:["Нет подтверждённого банковского остатка"]),...(debtScheduleIssues().length?[\`У \${debtScheduleIssues().length} долгов отсутствует или просрочена следующая дата платежа\`]:[]),...(unknownRateDebts().length?[\`У \${unknownRateDebts().length} долгов не подтверждена ставка\`]:[]),...((!+S.settings.dailySpendLimit&&!Object.values(S.envelopeLimits||{}).some(x=>+x>0))?["Не задан бюджет повседневных расходов"]:[])]}`,
"projection unknown rate warning");

replaceOnce("finance.js",
`if(!p.cashGapDate&&free>0){const phase=financialPhase(),target=highestHighInterestDebt()||bestDebt();if(target)actions.push({level:"good",title:\`Свободно \${rub(free)} — приоритет \${target.name}\`,meta:\`фаза: \${phase.name} • ставка \${debtEffectiveRate(target).toFixed(2)}%\`})}`,
`const unknownRates=unknownRateDebts();if(unknownRates.length)actions.push({level:"warn",title:\`Обновить ставки долгов: \${unknownRates.length}\`,meta:unknownRates.map(x=>x.name).join(", ")});if(!p.cashGapDate&&free>0&&!unknownRates.length){const phase=financialPhase(),target=highestHighInterestDebt()||bestDebt();if(target)actions.push({level:"good",title:\`Свободно \${rub(free)} — приоритет \${target.name}\`,meta:\`фаза: \${phase.name} • ставка \${debtEffectiveRate(target).toFixed(2)}%\`})}`,
"decision engine unknown rate");

// 5) Life Ops: all training types + edit/delete/import invalidation.
replaceOnce("life-ops.js",
`const training=(S.tennis||[]).filter(x=>String(x.dateKey||x.date||"").slice(0,10)===k).length;`,
`const training=typeof training129AllSessions==="function"?training129AllSessions(2).filter(x=>String(x.dateKey||"")===k).length:(S.tennis||[]).filter(x=>String(x.dateKey||x.date||"").slice(0,10)===k).length;`,
"Life Ops training count");

replaceOnce("life-ops.js",
`function lifeOpsWrapActivity(name,collection){
  const base=globalThis[name];if(typeof base!=="function"||base.__lifeOpsWrapped)return;
  const wrapped=async function(){const before=Array.isArray(S[collection])?S[collection].length:-1;const out=await base.apply(this,arguments);const after=Array.isArray(S[collection])?S[collection].length:-1;if(after!==before){lifeOpsMarkDirty();await persist();render()}return out};
  wrapped.__lifeOpsWrapped=true;globalThis[name]=wrapped
}
function lifeOpsInstallActivityHooks(){
  if(LIFE_OPS_ACTIVITY_HOOKS)return;LIFE_OPS_ACTIVITY_HOOKS=true;
  for(const [fn,col] of [["addExpense","expenses"],["addPayment","payments"],["addWorkLog","workLogs"],["addTennis","tennis"],["addReading","readingLogs"]])lifeOpsWrapActivity(fn,col)
}`,
`function lifeOpsActivityFingerprint(){
  const k=localDateKey(),rows=(arr,key)=>JSON.stringify((arr||[]).filter(x=>String(x?.[key]||x?.date||"").slice(0,10)===k));
  const training=typeof training129AllSessions==="function"?training129AllSessions(2).filter(x=>String(x.dateKey||"")===k).map(x=>[x.id,x.dateKey,x.minutes,x.rpe,x.type,x.domain,x.source]):[];
  return JSON.stringify({expenses:rows(S.expenses,"dateKey"),income:rows(S.incomeLogs,"dateKey"),payments:rows(S.payments,"localDate"),work:rows(S.workLogs,"date"),tennis:rows(S.tennis,"dateKey"),reading:rows(S.readingLogs,"dateKey"),training})
}
function lifeOpsWrapActivity(name){
  const base=globalThis[name];if(typeof base!=="function"||base.__lifeOpsWrapped)return;
  const wrapped=async function(){const before=lifeOpsActivityFingerprint(),out=await base.apply(this,arguments),after=lifeOpsActivityFingerprint();if(after!==before){lifeOpsMarkDirty();await persist();render()}return out};
  wrapped.__lifeOpsWrapped=true;globalThis[name]=wrapped
}
function lifeOpsInstallActivityHooks(){
  if(LIFE_OPS_ACTIVITY_HOOKS)return;LIFE_OPS_ACTIVITY_HOOKS=true;
  for(const fn of ["addExpense","deleteExpense","addPayment","undoPayment","addWorkLog","deleteWork","recordCrmRealization","addTennis","deleteTennis","addReading","deleteReading","training129Save","training129Delete","restoreLastDeleted","rollbackImportBatch","applyAiImportQueue","applyStatementImportPackage"])lifeOpsWrapActivity(fn)
}`,
"Life Ops mutation fingerprint");

// 6) Core diagnostics understand expired reservations + unknown rates and can repair stale status.
replaceOnce("state.js",
`const today=localDateKey();for(const d of (S.debts||[]).filter(x=>x.active!==false&&x.balance>0)){if(!validDateKey(d.nextPaymentDate))add("warn",\`Нет следующей даты платежа: \${d.name}\`,"Обнови данные долга");else if(d.nextPaymentDate<today)add("bad",\`Просрочена дата платежа: \${d.name}\`,fmtDate(parseLocal(d.nextPaymentDate)))}`,
`const today=localDateKey();for(const d of (S.debts||[]).filter(x=>x.active!==false&&x.balance>0)){if(!validDateKey(d.nextPaymentDate))add("warn",\`Нет следующей даты платежа: \${d.name}\`,"Обнови данные долга");else if(d.nextPaymentDate<today)add("bad",\`Просрочена дата платежа: \${d.name}\`,fmtDate(parseLocal(d.nextPaymentDate)));if(typeof debtRateKnown==="function"&&!debtRateKnown(d))add("warn",\`Ставка долга не подтверждена: \${d.name}\`,"Досрочные приоритеты заблокированы до обновления ставки")}
  for(const r of S.reservations||[]){if(r?.status==="active"&&r.untilDate&&(!validDateKey(r.untilDate)||r.untilDate<today))add("warn",\`Устаревший резерв: \${r.label||r.type||r.id}\`,String(r.untilDate||"без даты"))}`,
"integrity reservation/rate diagnostics");

replaceOnce("state.js",
`for(const b of S.books||[])recomputeBookProgress(b.id);`,
`for(const r of S.reservations||[])if(r?.status==="active"&&typeof reservationExpired==="function"&&reservationExpired(r)){r.status="expired";r.expiredAt=new Date().toISOString()}
    for(const b of S.books||[])recomputeBookProgress(b.id);`,
"repair expired reservations");

// 7) Android privacy: disable system backup for local personal/financial data.
replaceOnce("android-release-patch.mjs",
`const manifestPath = path.join("android", "app", "src", "main", "AndroidManifest.xml");
const manifest = fs.readFileSync(manifestPath, "utf8");
if (manifest.includes("android.intent.action.SEND") || manifest.includes("android.intent.action.SEND_MULTIPLE")) {`,
`const manifestPath = path.join("android", "app", "src", "main", "AndroidManifest.xml");
let manifest = fs.readFileSync(manifestPath, "utf8");
if (/android:allowBackup="[^"]*"/.test(manifest)) manifest=manifest.replace(/android:allowBackup="[^"]*"/,'android:allowBackup="false"');
else manifest=manifest.replace("<application",'<application android:allowBackup="false"');
if (/android:fullBackupContent="[^"]*"/.test(manifest)) manifest=manifest.replace(/android:fullBackupContent="[^"]*"/,'android:fullBackupContent="false"');
else manifest=manifest.replace("<application",'<application android:fullBackupContent="false"');
fs.writeFileSync(manifestPath,manifest);
if (manifest.includes("android.intent.action.SEND") || manifest.includes("android.intent.action.SEND_MULTIPLE")) {`,
"Android backup hardening");

// 8) Runtime privacy: Android never executes OCR JavaScript from a CDN.
// Manual/JSON/CSV import remains available; PWA keeps the existing pinned external OCR path.
replaceOnce("imports.js",
`function ensureFinancialOcrLoaded(){
  if(window.Tesseract?.recognize)return Promise.resolve(window.Tesseract);`,
`function ensureFinancialOcrLoaded(){
  if(globalThis.__LIFE_RPG_ANDROID__)return Promise.reject(new Error("Android: внешний OCR-код отключён; используй ручной ввод/JSON/CSV"));
  if(window.Tesseract?.recognize)return Promise.resolve(window.Tesseract);`,
"Android finance OCR fail closed");

replaceOnce("tennis-huawei.js",
`async function tennisHuaweiLoadTesseract(){
  if(window.Tesseract?.recognize)return window.Tesseract;`,
`async function tennisHuaweiLoadTesseract(){
  if(globalThis.__LIFE_RPG_ANDROID__)throw new Error("Android: внешний OCR-код отключён; внеси данные Huawei вручную");
  if(window.Tesseract?.recognize)return window.Tesseract;`,
"Android tennis OCR fail closed");

// 9) 14.0.1 RC version line: must install over stable 14.0.0 (versionCode 14000099).
{
  const c=JSON.parse(read("android-release-config.json"));
  if(c.targetVersion!=="14.0.0"||c.channel!=="rc")throw new Error("Unexpected Android RC source config");
  c.targetVersion="14.0.1";
  c.notes="Android 14.0.1 RC: audit hotfix for import validation, refunds, debt-rate safety, reservation expiry, Life Ops consistency and Android privacy.";
  write("android-release-config.json",JSON.stringify(c,null,2)+"\n");
}
replaceOnce("release-readiness-14.0.test.js",
`assert.equal(cfg.targetVersion,"14.0.0");`,
`assert.equal(cfg.targetVersion,"14.0.1");`,
"readiness version");
replaceOnce("android-release-gate.test.js",
`assert.equal(cfg.targetVersion,"14.0.0");`,
`assert.equal(cfg.targetVersion,"14.0.1");`,
"release gate version");
replaceOnce("android-release-gate.test.js",
`assert.match(meta.versionName,/^14\\.0\\.0-rc\\.\\d+$/);
assert.ok(meta.versionCode>1309019,"RC must update over signed 13.9.1 beta line");`,
`assert.match(meta.versionName,/^14\\.0\\.1-rc\\.\\d+$/);
assert.ok(meta.versionCode>14000099,"14.0.1 RC must update over signed 14.0.0 Stable");`,
"release gate version code");
replaceOnce("android-ui-14.e2e.test.js",
`await expect(page).toHaveTitle(/Life RPG 14\\.0\\.0-rc\\./);`,
`await expect(page).toHaveTitle(/Life RPG 14\\.0\\.1-rc\\./);`,
"Android UI title");

replaceOnce("android-release-gate.test.js",
`assert.ok(!nativeManifest.includes("android.intent.action.SEND_MULTIPLE"));`,
`assert.ok(!nativeManifest.includes("android.intent.action.SEND_MULTIPLE"));
assert.ok(nativeManifest.includes('android:allowBackup="false"'),"Android backup must be disabled");
assert.ok(nativeManifest.includes('android:fullBackupContent="false"'),"Android full backup must be disabled");`,
"Android backup release gate");

replaceOnce("release-readiness-14.0.test.js",
`assert.ok(patch.includes("Native Android Share filters must not exist in RC"));`,
`assert.ok(patch.includes("Native Android Share filters must not exist in RC"));
assert.ok(patch.includes('android:allowBackup="false"'));
assert.ok(patch.includes('android:fullBackupContent="false"'));`,
"backup source contract");

// 10) Add focused regression suite.
const test=`"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("node:assert/strict");

const elements={};
const ctx=vm.createContext({
  console,Date,Math,JSON,Intl,Promise,setTimeout,clearTimeout,setInterval:()=>0,structuredClone,crypto,
  document:{getElementById:id=>elements[id]||(elements[id]={textContent:"",innerHTML:"",value:"",checked:false,classList:{add(){},remove(){},contains(){return false}},addEventListener(){},closest(){return null}}),querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},head:{appendChild(){}},body:{classList:{add(){},remove(){},contains(){return true}},appendChild(){}}},
  window:{addEventListener(){},location:{},Tesseract:null},navigator:{},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  confirm:()=>true,prompt:()=>null,requestAnimationFrame:f=>f()
});
for(const f of ["core.js","state.js","finance.js","imports.js","work.js","tennis.js","knowledge.js","gamification.js","ui.js","life-ops.js","finance-rebuild-14.js"])vm.runInContext(fs.readFileSync(f,"utf8"),ctx,{filename:f});
const run=s=>vm.runInContext(s,ctx),plain=x=>JSON.parse(JSON.stringify(x));
const reset=()=>run(\`S=deepClone(DEFAULT_STATE);S.settings.reportStart="";S.settings.reportStartMigration="";S.settings.miniBufferTarget=0;S.settings.emergencyFundTarget=0;S.settings.dailySpendLimit=1000;S.accounts=[{id:"a",name:"A",type:"Счёт",verifiedBalance:10000,verifiedAt:new Date().toISOString(),active:true}];S.settings.primaryAccountId="a";S.settings.incomeEvents=[];S.debts=[];S.reservations=[];S.expenses=[];S.incomeLogs=[];S.payments=[];S.workLogs=[];S.tennis=[];S.readingLogs=[];save=async()=>{};persist=async()=>{};render=()=>{};toast=()=>{};\`);

(async()=>{
  reset();

  // Statement packages accept only explicitly supported semantic kinds.
  ctx.pkg={transactions:[{kind:"expense"},{kind:"expnese"}]};
  assert.equal(run("statementInvalidKinds(pkg).length"),1);
  assert.ok(run("STATEMENT_IMPORT_KINDS.has('refund')"));
  assert.ok(!run("STATEMENT_IMPORT_KINDS.has('debt_drawdown')"));

  // A verified balance anchor must be a real instant, not an ambiguous day.
  ctx.anchorDate={balanceAnchor:{balance:100,asOf:"2026-10-02"}};
  ctx.anchorIso={balanceAnchor:{balance:100,asOf:"2026-10-02T20:00:00+05:00"}};
  assert.equal(run("statementAnchorIso(anchorDate)"),"");
  assert.match(run("statementAnchorIso(anchorIso)"),/^2026-10-02T15:00:00\\.000Z$/);

  // Refunds are valid ledger rows and survive Finance Rebuild snapshot validation.
  run(\`S.expenses=[{id:"refund1",dateKey:"2026-10-02",date:"2026-10-02T12:00:00Z",amount:-350,accountId:"a",category:"Другое",note:"Возврат",isRefund:true,reservationUse:[]}]\`);
  const snap=plain(run("financeRebuild14FinancialSnapshot(S)"));
  ctx.snap=snap;
  assert.doesNotThrow(()=>run("financeRebuild14ValidateSnapshot(snap)"));
  assert.equal(snap.expenses[0].amount,-350);

  // Expired reservations never reduce free cash and cannot be resurrected by undo.
  run(\`S.reservations=[{id:"old",type:"living",remaining:500,status:"active",untilDate:"2026-01-01"},{id:"live",type:"living",remaining:200,status:"active",untilDate:"2099-01-01"}]\`);
  assert.equal(run("reservedCashTotal()"),200);
  run(\`restoreReservationUse([{id:"old",amount:50}])\`);
  assert.equal(run("S.reservations[0].status"),"expired");

  // Unknown debt rates block rate-sensitive payoff logic rather than acting like 0%.
  run(\`S.debts=[{id:"u",name:"Unknown",balance:5000,initial:5000,rate:0,rateKnown:false,min:100,nextPaymentDate:"2099-01-10",nextPaymentAmount:100,paymentMode:"fixed",active:true},{id:"k",name:"Known",balance:5000,initial:5000,rate:30,rateKnown:true,min:100,nextPaymentDate:"2099-01-10",nextPaymentAmount:100,paymentMode:"fixed",active:true}]\`);
  assert.equal(run("financialPhase().id"),"rate_unknown");
  assert.equal(run("autopilotPlan().debtExtra"),0);
  assert.equal(run("autopilotPlan().best"),null);
  assert.equal(run("simulateDebt(1000).unreliable"),true);
  assert.equal(run("highestRateDebtIndex()"),-1);
  assert.ok(run("buildFinancialProjection(5).warnings.some(x=>x.includes('не подтверждена ставка'))"));

  // Life Ops sees outdoor Training OS sessions, not only table tennis.
  run(\`globalThis.training129AllSessions=()=>[{id:"out",dateKey:localDateKey(),minutes:30,rpe:4,type:"easy",domain:"outdoor",source:"manual"}]\`);
  assert.equal(run("lifeOpsTodayCounts().training"),1);

  // Editing today's row without changing array length re-opens a closed day.
  run(\`S.checks[localDateKey()]={lifeOps:{confirmations:{expenses:true,income:true,payments:true,work:true,training:true},closed:true,closedAt:new Date().toISOString()}};S.expenses=[{id:"e",dateKey:localDateKey(),date:new Date().toISOString(),amount:10,note:"old"}];globalThis.__auditEdit=async()=>{S.expenses[0].note="new"};lifeOpsWrapActivity("__auditEdit")\`);
  await run("__auditEdit()");
  assert.equal(run("lifeOpsIsClosed()"),false);

  // Android OCR is fail-closed; no remote JS may execute in the APK.
  run("globalThis.__LIFE_RPG_ANDROID__=true");
  await assert.rejects(run("ensureFinancialOcrLoaded()"),/внешний OCR-код отключён/);

  // Source contracts for Android privacy + strict schema/version.
  assert.ok(fs.readFileSync("tennis-huawei.js","utf8").includes("Android: внешний OCR-код отключён"));
  assert.ok(fs.readFileSync("android-release-patch.mjs","utf8").includes('android:allowBackup="false"'));
  assert.ok(fs.readFileSync("android-release-patch.mjs","utf8").includes('android:fullBackupContent="false"'));
  assert.ok(fs.readFileSync("platform.vite.mjs","utf8").includes('z.enum(["income","expense","refund","transfer","asset_transfer","debt_payment"])'));
  assert.equal(JSON.parse(fs.readFileSync("android-release-config.json","utf8")).targetVersion,"14.0.1");

  console.log("OK — 14.0.1 audit hotfix: statement validation, refunds, reservations, rates, Life Ops and Android privacy");
})().catch(e=>{console.error(e);process.exit(1)});
`;
write("audit-hotfix-14.0.1.test.js",test);

{
  const p=JSON.parse(read("package.json"));
  if(!String(p.scripts?.test||"").includes("audit-hotfix-14.0.1.test.js"))p.scripts.test+=" && node audit-hotfix-14.0.1.test.js";
  write("package.json",JSON.stringify(p,null,2)+"\n");
}


// Marker and final static checks.
write(marker,`# Life RPG 14.0.1 — Audit Hotfix

Applied automatically after the post-14.0.0 full-system audit.

Fixes:
- strict bank statement transaction kinds;
- exact timestamp semantics for verified balance anchors;
- Finance Rebuild refund roundtrip;
- reservation expiry and undo safety;
- unknown debt-rate safety gates;
- Life Ops outdoor training + edit/delete/import invalidation;
- Android system backup disabled;
- Android external CDN OCR disabled (manual/JSON/CSV entry remains);
- Android RC version bumped to 14.0.1.

The earlier suspected AI-import dateKey defect was rechecked and was not a defect: the source uses valid JavaScript object shorthand {dateKey,date}.
`);

for(const [file,token] of [
  ["imports.js","STATEMENT_IMPORT_KINDS"],
  ["finance.js","function reservationExpired"],
  ["finance.js","function debtRateKnown"],
  ["life-ops.js","function lifeOpsActivityFingerprint"],
  ["android-release-patch.mjs",'android:allowBackup="false"'],
  ["audit-hotfix-14.0.1.test.js","14.0.1 audit hotfix"]
])assertContains(file,token);

console.log("OK — audit hotfix 14.0.1 patch applied");
