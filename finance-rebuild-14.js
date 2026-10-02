"use strict";

/* Life RPG 14.0 RC — Finance Rebuild
   Atomic finance-only replacement, preview-first import and post-import integrity audit.
   State schema remains v18. */

const FINANCE_REBUILD14_FORMAT="life-rpg-finance-rebuild-v1";
const FINANCE_REBUILD14_VERSION=1;
let FINANCE_REBUILD14_PREVIEW=null;
let FINANCE_REBUILD14_APPLY_PENDING=false;

function financeRebuild14Now(){return new Date().toISOString()}
function financeRebuild14Text(v){return String(v??"").trim()}
function financeRebuild14Num(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback}
function financeRebuild14Money(v){return Math.max(0,financeRebuild14Num(v,0))}
function financeRebuild14Id(prefix,i,name=""){
  const raw=financeRebuild14Text(name).toLowerCase().replace(/[^a-zа-яё0-9_-]+/gi,"-").replace(/^-+|-+$/g,"").slice(0,70);
  return `${prefix}-${raw||i+1}-${i+1}`
}
function financeRebuild14Iso(v){
  const s=financeRebuild14Text(v);if(!s)return"";
  const t=Date.parse(s);if(!Number.isFinite(t)||t>Date.now()+300000)return"";
  return new Date(t).toISOString()
}
function financeRebuild14Date(v){
  const s=financeRebuild14Text(v);return typeof validDateKey==="function"&&validDateKey(s)?s:""
}
function financeRebuild14CloneSafe(value,key="",depth=0){
  if(depth>12)throw new Error("Finance Rebuild: слишком глубокая структура");
  if(value==null||typeof value==="boolean")return value;
  if(typeof value==="number"){
    if(!Number.isFinite(value))throw new Error(`Finance Rebuild: некорректное число ${key}`);
    return value
  }
  if(typeof value==="string"){
    if(value.length>50000)throw new Error(`Finance Rebuild: слишком длинное поле ${key}`);
    return value
  }
  if(Array.isArray(value)){
    if(value.length>50000)throw new Error(`Finance Rebuild: слишком большой список ${key}`);
    return value.map((x,i)=>financeRebuild14CloneSafe(x,`${key}[${i}]`,depth+1))
  }
  if(typeof value!=="object")throw new Error(`Finance Rebuild: неподдерживаемое поле ${key}`);
  const out={};
  for(const [k,v] of Object.entries(value)){
    if(["__proto__","prototype","constructor"].includes(k))throw new Error(`Finance Rebuild: запрещённое поле ${k}`);
    out[k]=financeRebuild14CloneSafe(v,k,depth+1)
  }
  return out
}

function financeRebuild14NormalizePackage(raw){
  const obj=financeRebuild14CloneSafe(raw);
  if(!obj||typeof obj!=="object"||Array.isArray(obj))throw new Error("Finance Rebuild: JSON должен быть объектом");
  if(obj.format!==FINANCE_REBUILD14_FORMAT)throw new Error(`Finance Rebuild: ожидается format=${FINANCE_REBUILD14_FORMAT}`);
  if(Number(obj.version)!==FINANCE_REBUILD14_VERSION)throw new Error(`Finance Rebuild: неподдерживаемая версия ${obj.version}`);

  const accounts=(Array.isArray(obj.accounts)?obj.accounts:[]).map((a,i)=>({
    id:financeRebuild14Text(a?.id)||financeRebuild14Id("account",i,a?.name),
    name:financeRebuild14Text(a?.name)||`Счёт ${i+1}`,
    type:financeRebuild14Text(a?.type)||"Счёт",
    verifiedBalance:a?.verifiedBalance==null?null:financeRebuild14Money(a.verifiedBalance),
    verifiedAt:financeRebuild14Iso(a?.verifiedAt),
    active:a?.active!==false
  }));

  const debts=(Array.isArray(obj.debts)?obj.debts:[]).map((d,i)=>{
    const type=financeRebuild14Text(d?.type)||"Долг";
    const balance=financeRebuild14Money(d?.balance);
    return {
      id:financeRebuild14Text(d?.id)||financeRebuild14Id("debt",i,d?.name),
      name:financeRebuild14Text(d?.name)||`Долг ${i+1}`,
      type,
      initial:Math.max(balance,financeRebuild14Money(d?.initial??balance)),
      balance,
      rate:financeRebuild14Money(d?.rate),
      rateKnown:d?.rateKnown!==false,
      min:financeRebuild14Money(d?.min),
      dueDay:Math.min(31,Math.max(1,Math.round(financeRebuild14Num(d?.dueDay,1)))),
      limit:financeRebuild14Money(d?.limit),
      nextPaymentDate:financeRebuild14Date(d?.nextPaymentDate),
      nextPaymentAmount:financeRebuild14Money(d?.nextPaymentAmount),
      paymentMode:financeRebuild14Text(d?.paymentMode)||(type==="Кредит"?"fixed":"statement"),
      balanceVerifiedAt:financeRebuild14Iso(d?.balanceVerifiedAt),
      active:d?.active!==false,
      parts:(Array.isArray(d?.parts)?d.parts:[]).map((p,j)=>({
        id:financeRebuild14Text(p?.id)||financeRebuild14Id(`part-${i+1}`,j,p?.name),
        name:financeRebuild14Text(p?.name)||`Часть ${j+1}`,
        balance:financeRebuild14Money(p?.balance),
        rate:financeRebuild14Money(p?.rate),
        rateKnown:p?.rateKnown!==false
      }))
    }
  });

  const regularPayments=(Array.isArray(obj.regularPayments)?obj.regularPayments:[]).map((x,i)=>({
    id:financeRebuild14Text(x?.id)||financeRebuild14Id("regular",i,x?.name),
    name:financeRebuild14Text(x?.name)||`Платёж ${i+1}`,
    amount:financeRebuild14Money(x?.amount),
    dueDay:Math.min(31,Math.max(1,Math.round(financeRebuild14Num(x?.dueDay,1)))),
    category:financeRebuild14Text(x?.category)||"Другое",
    mandatory:x?.mandatory!==false,
    keywords:Array.isArray(x?.keywords)?x.keywords.map(financeRebuild14Text).filter(Boolean):financeRebuild14Text(x?.keywords),
    active:x?.active!==false
  }));

  const assets=(Array.isArray(obj.assets)?obj.assets:[]).map((a,i)=>({
    id:financeRebuild14Text(a?.id)||financeRebuild14Id("asset",i,a?.name),
    name:financeRebuild14Text(a?.name)||`Актив ${i+1}`,
    type:financeRebuild14Text(a?.type)||"Инвестиции",
    verifiedValue:financeRebuild14Money(a?.verifiedValue??a?.value),
    verifiedAt:financeRebuild14Iso(a?.verifiedAt),
    liquid:a?.liquid!==false,
    available:!!a?.available,
    active:a?.active!==false,
    note:financeRebuild14Text(a?.note)
  }));

  const settingsRaw=obj.settings&&typeof obj.settings==="object"&&!Array.isArray(obj.settings)?obj.settings:{};
  const incomeEvents=(Array.isArray(settingsRaw.incomeEvents)?settingsRaw.incomeEvents:[]).map((x,i)=>({
    id:financeRebuild14Text(x?.id)||financeRebuild14Id("income",i,x?.label),
    day:Math.min(31,Math.max(1,Math.round(financeRebuild14Num(x?.day,1)))),
    label:financeRebuild14Text(x?.label)||"Доход",
    amount:financeRebuild14Money(x?.amount)
  })).filter(x=>x.amount>0).sort((a,b)=>a.day-b.day);

  const settings={
    primaryAccountId:financeRebuild14Text(settingsRaw.primaryAccountId),
    monthlyIncome:financeRebuild14Money(settingsRaw.monthlyIncome),
    monthlyDebtGoal:financeRebuild14Money(settingsRaw.monthlyDebtGoal),
    dailySpendLimit:financeRebuild14Money(settingsRaw.dailySpendLimit),
    emergencyFundTarget:financeRebuild14Money(settingsRaw.emergencyFundTarget),
    emergencyFundBalance:financeRebuild14Money(settingsRaw.emergencyFundBalance),
    miniBufferTarget:financeRebuild14Money(settingsRaw.miniBufferTarget??15000),
    highInterestThreshold:Math.max(0,financeRebuild14Num(settingsRaw.highInterestThreshold,40)),
    cashBalanceVerifiedAt:financeRebuild14Iso(settingsRaw.cashBalanceVerifiedAt),
    envelopeRollover:settingsRaw.envelopeRollover!==false,
    autoReserveAfterImport:settingsRaw.autoReserveAfterImport!==false,
    learnImportRules:settingsRaw.learnImportRules!==false,
    incomeEvents,
    liquidityTargetDays:Math.max(1,Math.round(financeRebuild14Num(settingsRaw.liquidityTargetDays,14))),
    minimumCashFloor:financeRebuild14Money(settingsRaw.minimumCashFloor),
    forecastIncomeFactor:Math.max(0,financeRebuild14Num(settingsRaw.forecastIncomeFactor,100))
  };

  const transactions=(Array.isArray(obj.transactions)?obj.transactions:[]).map((x,i)=>{
    const type=financeRebuild14Text(x?.type).toLowerCase();
    const dateKey=financeRebuild14Date(x?.dateKey||x?.date);
    const occurredAt=financeRebuild14Iso(x?.occurredAt||x?.timestamp);
    return {
      id:financeRebuild14Text(x?.id)||`finance-tx-${i+1}`,
      include:x?.include!==false,
      dateKey,
      occurredAt,
      amount:financeRebuild14Money(x?.amount),
      type,
      category:financeRebuild14Text(x?.category),
      desc:financeRebuild14Text(x?.description??x?.desc??x?.note)||`Finance rebuild ${i+1}`,
      accountId:financeRebuild14Text(x?.accountId),
      fromAccountId:financeRebuild14Text(x?.fromAccountId),
      toAccountId:financeRebuild14Text(x?.toAccountId),
      debtId:financeRebuild14Text(x?.debtId),
      assetId:financeRebuild14Text(x?.assetId),
      ocrSign:financeRebuild14Text(x?.ocrSign),
      sourceName:financeRebuild14Text(x?.sourceName)
    }
  });

  const defaultLimits=deepClone(DEFAULT_STATE.envelopeLimits||{});
  const envelopeLimits={...defaultLimits};
  for(const [k,v] of Object.entries(obj.envelopeLimits&&typeof obj.envelopeLimits==="object"&&!Array.isArray(obj.envelopeLimits)?obj.envelopeLimits:{})){
    if(["__proto__","prototype","constructor"].includes(k))continue;
    envelopeLimits[String(k)]=financeRebuild14Money(v)
  }

  const balanceHistory=(Array.isArray(obj.balanceHistory)?obj.balanceHistory:[]).map((x,i)=>({
    id:financeRebuild14Text(x?.id)||`balance-${i+1}`,
    date:financeRebuild14Date(x?.date)||financeRebuild14Date(obj.baselineDate)||localDateKey(),
    total:financeRebuild14Money(x?.total),
    type:financeRebuild14Text(x?.type)||"checkpoint"
  }));

  const importRules=(Array.isArray(obj.importRules)?obj.importRules:[]).map((x,i)=>({
    id:financeRebuild14Text(x?.id)||financeRebuild14Id("rule",i,x?.keyword),
    keyword:financeRebuild14Text(x?.keyword),
    type:financeRebuild14Text(x?.type),
    category:financeRebuild14Text(x?.category),
    active:x?.active!==false
  })).filter(x=>x.keyword);

  return {
    format:FINANCE_REBUILD14_FORMAT,
    version:FINANCE_REBUILD14_VERSION,
    generatedAt:financeRebuild14Iso(obj.generatedAt)||financeRebuild14Now(),
    baselineDate:financeRebuild14Date(obj.baselineDate)||localDateKey(),
    note:financeRebuild14Text(obj.note),
    settings,accounts,debts,regularPayments,assets,envelopeLimits,balanceHistory,importRules,transactions
  }
}

function financeRebuild14PackageIssues(pkg){
  const issues=[],add=(level,title,detail="")=>issues.push({level,title,detail});
  const activeAccounts=pkg.accounts.filter(x=>x.active!==false);
  if(!activeAccounts.length)add("blocker","Нет активных денежных счетов","Нужен хотя бы один счёт или наличные");

  const ids=new Set();
  for(const [label,rows] of [["счёт",pkg.accounts],["долг",pkg.debts],["актив",pkg.assets],["регулярный платёж",pkg.regularPayments]]){
    for(const x of rows){
      if(typeof isSafeStateId==="function"&&!isSafeStateId(x.id))add("blocker",`Небезопасный ID: ${label}`,x.id);
      const key=`${label}:${x.id}`;if(ids.has(key))add("blocker",`Дублирующийся ID: ${label}`,x.id);ids.add(key)
    }
  }

  const accountIds=new Set(pkg.accounts.map(x=>x.id)),debtIds=new Set(pkg.debts.map(x=>x.id)),assetIds=new Set(pkg.assets.map(x=>x.id));
  const primary=pkg.settings.primaryAccountId||activeAccounts[0]?.id||"";
  if(primary&&!accountIds.has(primary))add("blocker","Основной счёт отсутствует в пакете",primary);

  for(const a of activeAccounts){
    if(a.verifiedBalance==null)add("blocker",`Нет фактического остатка: ${a.name}`,"Для rebuild каждый активный счёт должен иметь verifiedBalance");
    if(!a.verifiedAt)add("blocker",`Нет времени сверки: ${a.name}`,"Укажи verifiedAt, чтобы история не меняла текущий остаток");
  }

  for(const d of pkg.debts.filter(x=>x.active!==false&&x.balance>0)){
    if(!d.balanceVerifiedAt)add("blocker",`Нет времени сверки долга: ${d.name}`,"Нужен balanceVerifiedAt для текущего остатка");
    if(d.rateKnown===false)add("warn",`Неизвестная ставка: ${d.name}`,"Досрочка будет менее точной");
    if(!d.nextPaymentDate)add("warn",`Нет следующей даты платежа: ${d.name}`,"Заполни для финансового календаря");
    if(!d.nextPaymentAmount&&d.min<=0)add("warn",`Нет суммы обязательного платежа: ${d.name}`,"Проверь min / nextPaymentAmount");
  }

  if(!pkg.settings.incomeEvents.length)add("warn","Нет графика ожидаемых доходов","Autopilot не сможет корректно определить горизонт до следующего поступления");
  if(!pkg.regularPayments.some(x=>x.active!==false&&x.mandatory!==false))add("warn","Нет регулярных обязательных платежей","Проверь аренду, связь, подписки и прочие обязательства");

  const allowed=new Set(["income","expense","transfer","asset_transfer","debt_payment","ignore"]);
  const today=localDateKey();
  let future=0,bad=0;
  for(const [i,x] of pkg.transactions.entries()){
    if(!allowed.has(x.type)){add("blocker","Неизвестный тип операции",`#${i+1}: ${x.type||"пусто"}`);continue}
    if(x.type==="ignore"||x.include===false)continue;
    if(!x.dateKey){bad++;continue}
    if(x.dateKey>today){future++;continue}
    if(!(x.amount>0)){bad++;continue}
    if(x.accountId&&!accountIds.has(x.accountId))add("blocker","Операция ссылается на отсутствующий счёт",`#${i+1}: ${x.accountId}`);
    if(x.type==="debt_payment"&&x.debtId&&!debtIds.has(x.debtId))add("blocker","Платёж ссылается на отсутствующий долг",`#${i+1}: ${x.debtId}`);
    if(x.type==="asset_transfer"&&x.assetId&&!assetIds.has(x.assetId))add("blocker","Перевод ссылается на отсутствующий актив",`#${i+1}: ${x.assetId}`);
    if(x.type==="transfer"){
      if(x.fromAccountId&&!accountIds.has(x.fromAccountId))add("blocker","Перевод: отсутствует счёт-источник",x.fromAccountId);
      if(x.toAccountId&&!accountIds.has(x.toAccountId))add("blocker","Перевод: отсутствует счёт-получатель",x.toAccountId)
    }
  }
  if(bad)add("blocker","Есть операции с некорректной датой или суммой",`${bad} шт.`);
  if(future)add("blocker","Есть фактические операции из будущего",`${future} шт.`);

  const blocker=issues.filter(x=>x.level==="blocker").length,warn=issues.filter(x=>x.level==="warn").length;
  return {issues,blocker,warn,ok:blocker===0}
}

function financeRebuild14Counts(pkg){
  const tx=pkg.transactions.filter(x=>x.include!==false&&x.type!=="ignore");
  const byType={};
  for(const x of tx)byType[x.type]=(byType[x.type]||0)+1;
  return {
    accounts:pkg.accounts.length,debts:pkg.debts.length,regular:pkg.regularPayments.length,
    assets:pkg.assets.length,transactions:tx.length,byType,
    verifiedCash:moneySum(pkg.accounts.filter(x=>x.active!==false).map(x=>x.verifiedBalance||0)),
    totalDebt:moneySum(pkg.debts.filter(x=>x.active!==false).map(x=>x.balance||0)),
    monthlyIncome:moneySum(pkg.settings.incomeEvents.map(x=>x.amount||0))
  }
}

function financeRebuild14BaseState(pkg){
  const out=deepClone(S),def=deepClone(DEFAULT_STATE);
  const settingKeys=[
    "primaryAccountId","monthlyIncome","monthlyDebtGoal","dailySpendLimit","emergencyFundTarget",
    "emergencyFundBalance","miniBufferTarget","highInterestThreshold","cashBalanceVerifiedAt",
    "envelopeRollover","autoReserveAfterImport","learnImportRules","incomeEvents","liquidityTargetDays",
    "minimumCashFloor","forecastIncomeFactor"
  ];
  for(const key of settingKeys)out.settings[key]=deepClone(pkg.settings[key]??def.settings[key]);

  out.accounts=deepClone(pkg.accounts.length?pkg.accounts:def.accounts);
  if(!out.settings.primaryAccountId)out.settings.primaryAccountId=out.accounts.find(a=>a.active!==false)?.id||out.accounts[0]?.id||"main";
  const primary=out.accounts.find(a=>a.id===out.settings.primaryAccountId)||out.accounts.find(a=>a.active!==false)||out.accounts[0];
  out.settings.primaryAccountId=primary?.id||"main";
  out.settings.cashBalanceVerifiedAt=primary?.verifiedAt||"";

  out.debts=deepClone(pkg.debts);
  out.regularPayments=deepClone(pkg.regularPayments);
  out.assets=deepClone(pkg.assets);
  out.envelopeLimits=deepClone(pkg.envelopeLimits);
  out.envelopeCarryovers={};
  out.balanceHistory=deepClone(pkg.balanceHistory.length?pkg.balanceHistory:[{
    id:"finance-rebuild-baseline",
    date:pkg.baselineDate,
    total:moneySum(pkg.debts.map(x=>x.initial||x.balance||0)),
    type:"start"
  }]);
  out.importRules=deepClone(pkg.importRules);

  for(const key of [
    "payments","expenses","incomeLogs","bankImportIds","screenshotImportIds","bankTransfers",
    "financeClosures","cashAdjustments","reservations","fundTransfers","assetTransfers",
    "importBatches","reconciliationSessions"
  ]) out[key]=[];

  const today=localDateKey(),day=out.checks?.[today]?.lifeOps;
  if(day&&typeof day==="object"){
    day.confirmations={...(day.confirmations||{}),expenses:false,income:false,payments:false};
    day.closed=false;day.closedAt=""
  }

  if(out.settings.importHub127&&typeof out.settings.importHub127==="object"){
    const h=Array.isArray(out.settings.importHub127.history)?out.settings.importHub127.history:[];
    out.settings.importHub127.history=h.filter(x=>!["bank-csv","backup"].includes(x?.kind)).slice(0,60)
  }

  return normalizeState(out)
}

function financeRebuild14CandidateFromTransaction(x,defaultId){
  return {
    include:x.include!==false,
    dateKey:x.dateKey,
    occurredAt:x.occurredAt||`${x.dateKey}T12:00:00`,
    amount:x.amount,
    type:x.type,
    category:x.category,
    desc:x.desc,
    accountId:x.accountId||defaultId,
    fromAccountId:x.fromAccountId,
    toAccountId:x.toAccountId,
    debtId:x.debtId,
    assetId:x.assetId,
    ocrSign:x.ocrSign
  }
}

function financeRebuild14CurrentAudit(){
  const rows=[],add=(level,title,detail="")=>rows.push({level,title,detail}),today=localDateKey();
  const accounts=typeof activeAccounts==="function"?activeAccounts():(S.accounts||[]).filter(x=>x.active!==false);
  const primary=(S.accounts||[]).find(a=>a.id===S.settings.primaryAccountId&&a.active!==false);
  if(!primary)add("blocker","Основной счёт не найден","Нужно выбрать активный основной счёт");

  for(const a of accounts){
    const bal=typeof accountBalanceById==="function"?accountBalanceById(a.id):a.verifiedBalance;
    if(bal<-.01)add("blocker",`Отрицательный остаток: ${a.name}`,rub(bal));
    if(!a.verifiedAt)add("blocker",`Счёт не сверялся: ${a.name}`,"Нет verifiedAt");
    else{
      const age=Math.floor((Date.now()-Date.parse(a.verifiedAt))/86400000);
      if(Number.isFinite(age)&&age>3)add("warn",`Сверка счёта устарела: ${a.name}`,`${age} дн. назад`)
    }
  }

  for(const d of (S.debts||[]).filter(x=>x.active!==false&&x.balance>0)){
    if(!d.balanceVerifiedAt)add("blocker",`Долг не имеет базовой сверки: ${d.name}`,"Нет balanceVerifiedAt");
    if(!validDateKey(String(d.nextPaymentDate||"")))add("warn",`Нет следующей даты платежа: ${d.name}`);
    else if(d.nextPaymentDate<today)add("blocker",`Просрочена дата платежа: ${d.name}`,d.nextPaymentDate);
    if(d.rateKnown===false)add("warn",`Неизвестна ставка: ${d.name}`)
  }

  const accountIds=new Set((S.accounts||[]).map(x=>String(x.id||""))),debtIds=new Set((S.debts||[]).map(x=>String(x.id||"")));
  for(const [label,list] of [["Доход",S.incomeLogs],["Расход",S.expenses],["Платёж",S.payments]]){
    for(const x of list||[])if(x.accountId&&!accountIds.has(String(x.accountId)))add("blocker",`${label} ссылается на отсутствующий счёт`,String(x.accountId))
  }
  for(const x of S.payments||[])if(x.debtId&&!debtIds.has(String(x.debtId)))add("blocker","Платёж ссылается на отсутствующий долг",String(x.debtId));

  const cash=typeof operatingCashBalance==="function"?operatingCashBalance():0;
  const reserved=typeof reservedCashTotal==="function"?reservedCashTotal():0;
  if(reserved>cash+.01)add("blocker","Резервы превышают реальные деньги",`${rub(reserved)} > ${rub(cash)}`);

  let projection=null;
  if(typeof buildFinancialProjection==="function"){
    try{
      projection=buildFinancialProjection(30);
      const floor=Math.max(0,+S.settings.minimumCashFloor||0);
      if(Number.isFinite(projection?.minBalance)&&projection.minBalance<floor-.01)
        add("warn","30-дневный cash-flow ниже неснижаемого остатка",`${rub(projection.minBalance)} • минимум ${rub(floor)}`)
    }catch(e){add("warn","30-дневный прогноз не рассчитан",String(e?.message||e))}
  }

  const integrity=typeof dataIntegrityIssues==="function"?dataIntegrityIssues():[];
  for(const x of integrity.filter(x=>/сч[её]т|доход|расход|плат[её]ж|долг|остаток|финанс/i.test(`${x.title} ${x.detail}`))){
    const level=x.level==="bad"?"blocker":"warn";
    if(!rows.some(y=>y.title===x.title&&y.detail===x.detail))add(level,x.title,x.detail||"")
  }

  const blocker=rows.filter(x=>x.level==="blocker").length,warn=rows.filter(x=>x.level==="warn").length;
  return {rows,blocker,warn,ok:blocker===0,cash,reserved,free:moneySub(cash,reserved),projection}
}

function financeRebuild14AuditHtml(a){
  const status=a.ok?`PASS • ${a.warn} предупрежд.`:`BLOCKER ${a.blocker} • WARN ${a.warn}`;
  const cls=a.ok?"":"danger";
  return `<div class="notice ${cls}"><b>Finance Integrity: ${status}</b>
    <div class="qmeta">Деньги ${rub(a.cash)} • резерв ${rub(a.reserved)} • свободно ${rub(a.free)}</div>
    ${a.projection&&Number.isFinite(a.projection.minBalance)?`<div class="qmeta">Минимум 30-дневного прогноза: ${rub(a.projection.minBalance)}</div>`:""}
  </div>${a.rows.length?a.rows.map(x=>`<div class="log-item"><div class="qtitle">${x.level==="blocker"?"BLOCKER":"WARN"} • ${escapeHtml(x.title)}</div>${x.detail?`<div class="qmeta">${escapeHtml(x.detail)}</div>`:""}</div>`).join(""):'<div class="status"><b>PASS.</b> Финансовых блокеров не найдено.</div>'}`
}

function financeRebuild14PreviewHtml(){
  const p=FINANCE_REBUILD14_PREVIEW;
  if(!p)return'<div class="empty">Загрузи Finance Rebuild JSON. До подтверждения текущее состояние не меняется.</div>';
  if(p.error)return`<div class="notice danger"><b>Ошибка пакета:</b><div class="qmeta">${escapeHtml(p.error)}</div></div>`;
  const c=p.counts,q=p.quality;
  return `<div class="report-grid">
    <div class="report-item"><div class="smallcaps">Счета</div><b>${c.accounts}</b></div>
    <div class="report-item"><div class="smallcaps">Долги</div><b>${c.debts}</b></div>
    <div class="report-item"><div class="smallcaps">Операции</div><b>${c.transactions}</b></div>
    <div class="report-item"><div class="smallcaps">Регулярные</div><b>${c.regular}</b></div>
    <div class="report-item"><div class="smallcaps">Сверенные деньги</div><b>${rub(c.verifiedCash)}</b></div>
    <div class="report-item"><div class="smallcaps">Текущий долг</div><b>${rub(c.totalDebt)}</b></div>
  </div>
  <div class="notice ${q.ok?"":"danger"}" style="margin-top:10px"><b>${q.ok?"Пакет готов к применению":"Пакет заблокирован"}</b><div class="qmeta">BLOCKER ${q.blocker} • WARN ${q.warn} • плановый доход ${rub(c.monthlyIncome)}</div></div>
  ${q.issues.map(x=>`<div class="log-item"><div class="qtitle">${x.level==="blocker"?"BLOCKER":"WARN"} • ${escapeHtml(x.title)}</div>${x.detail?`<div class="qmeta">${escapeHtml(x.detail)}</div>`:""}</div>`).join("")}`
}

async function financeRebuild14Prepare(input){
  const file=input?.files?.[0];if(!file)return;
  try{
    if(file.size>15*1024*1024)throw new Error("Finance Rebuild JSON больше 15 МБ");
    const raw=JSON.parse(await file.text()),pkg=financeRebuild14NormalizePackage(raw),quality=financeRebuild14PackageIssues(pkg),counts=financeRebuild14Counts(pkg);
    FINANCE_REBUILD14_PREVIEW={fileName:file.name,pkg,quality,counts,error:""};
  }catch(e){
    FINANCE_REBUILD14_PREVIEW={fileName:file.name,error:String(e?.message||e)}
  }finally{
    input.value="";
    renderFinanceRebuild14()
  }
}

function financeRebuild14Cancel(){FINANCE_REBUILD14_PREVIEW=null;renderFinanceRebuild14()}

async function financeRebuild14Apply(){
  if(FINANCE_REBUILD14_APPLY_PENDING){toast("Finance Rebuild уже выполняется");return}
  const p=FINANCE_REBUILD14_PREVIEW;if(!p?.pkg||p.error||!p.quality?.ok)return;
  const answer=typeof prompt==="function"?String(prompt('Для полной замены финансов введи: ЗАМЕНИТЬ ФИНАНСЫ')||"").trim():"";
  if(answer!=="ЗАМЕНИТЬ ФИНАНСЫ"){toast("Finance Rebuild отменён");return}

  FINANCE_REBUILD14_APPLY_PENDING=true;
  const old=deepClone(S);
  try{
    const snapshotTs=await createPreActionSnapshot(`Finance Rebuild 14.0 • ${p.fileName||"package"}`);
    let result=null;
    await commitStateAtomically(async()=>{
      S=financeRebuild14BaseState(p.pkg);
      const defaultId=defaultAccountId();
      const rows=p.pkg.transactions.map(x=>financeRebuild14CandidateFromTransaction(x,defaultId));
      result=rows.length?await applyImportedCandidates(rows,"finance-rebuild"):{created:[],income:0,expense:0,debtPayment:0,transfer:0,dupes:0};
      S.settings.financeRebuild14={
        format:FINANCE_REBUILD14_FORMAT,
        appliedAt:financeRebuild14Now(),
        packageGeneratedAt:p.pkg.generatedAt,
        baselineDate:p.pkg.baselineDate,
        sourceFile:p.fileName||"",
        snapshotTs,
        transactionCount:result?.created?.length||0
      };
      const day=S.checks?.[localDateKey()]?.lifeOps;
      if(day&&typeof day==="object"){
        day.confirmations={...(day.confirmations||{}),expenses:false,income:false,payments:false};
        day.closed=false;day.closedAt=""
      }
      audit("Finance Rebuild 14.0","finance",`${p.fileName||"package"} • операций ${result?.created?.length||0}`)
    });

    FINANCE_REBUILD14_PREVIEW=null;
    if(typeof render==="function")render();
    renderFinanceRebuild14();
    const auditResult=financeRebuild14CurrentAudit();
    const box=document.getElementById("financeRebuild14Audit");if(box)box.innerHTML=financeRebuild14AuditHtml(auditResult);
    toast(auditResult.ok?"Финансы заменены • Finance Integrity PASS":"Финансы заменены • есть блокеры проверки");
  }catch(e){
    try{if(typeof storageStateMatches==="function"&&typeof storageLastDurableState!=="undefined"&&storageStateMatches(S,old))S=old}catch{}
    try{render()}catch{}
    toast("Finance Rebuild не применён: "+String(e?.message||e));
    throw e
  }finally{
    FINANCE_REBUILD14_APPLY_PENDING=false
  }
}

function financeRebuild14CurrentPackage(){
  const primary=defaultAccountId();
  const transactions=[];
  for(const x of S.incomeLogs||[])transactions.push({dateKey:x.dateKey,occurredAt:x.date,amount:x.amount,type:"income",description:x.note||x.source||"Доход",accountId:x.accountId||primary});
  for(const x of S.expenses||[])transactions.push({dateKey:x.dateKey,occurredAt:x.date,amount:x.amount,type:"expense",description:x.note||x.category||"Расход",category:x.category||"Другое",accountId:x.accountId||primary});
  for(const x of S.payments||[])transactions.push({dateKey:x.localDate||x.monthKey,occurredAt:x.date,amount:x.amount,type:"debt_payment",description:x.debt||"Платёж по долгу",debtId:x.debtId||"",accountId:x.accountId||primary});
  for(const x of S.bankTransfers||[])transactions.push({dateKey:x.dateKey,occurredAt:x.date,amount:x.amount,type:"transfer",description:x.note||"Перевод",accountId:x.syncAccountId||primary,fromAccountId:x.fromAccountId||"",toAccountId:x.toAccountId||""});
  for(const x of S.assetTransfers||[])transactions.push({dateKey:x.dateKey,occurredAt:x.date,amount:x.amount,type:"asset_transfer",description:x.note||"Перевод актива",assetId:x.assetId||"",accountId:x.accountId||primary,ocrSign:x.direction==="fromAsset"?"+":"-"});

  return {
    format:FINANCE_REBUILD14_FORMAT,version:FINANCE_REBUILD14_VERSION,generatedAt:financeRebuild14Now(),baselineDate:localDateKey(),
    note:"Экспорт текущего финансового контура Life RPG",
    settings:{
      primaryAccountId:S.settings.primaryAccountId||primary,
      monthlyIncome:+S.settings.monthlyIncome||0,monthlyDebtGoal:+S.settings.monthlyDebtGoal||0,dailySpendLimit:+S.settings.dailySpendLimit||0,
      emergencyFundTarget:+S.settings.emergencyFundTarget||0,emergencyFundBalance:+S.settings.emergencyFundBalance||0,miniBufferTarget:+S.settings.miniBufferTarget||0,
      highInterestThreshold:+S.settings.highInterestThreshold||40,cashBalanceVerifiedAt:S.settings.cashBalanceVerifiedAt||"",
      envelopeRollover:S.settings.envelopeRollover!==false,autoReserveAfterImport:S.settings.autoReserveAfterImport!==false,learnImportRules:S.settings.learnImportRules!==false,
      incomeEvents:deepClone(S.settings.incomeEvents||[]),liquidityTargetDays:+S.settings.liquidityTargetDays||14,minimumCashFloor:+S.settings.minimumCashFloor||0,forecastIncomeFactor:+S.settings.forecastIncomeFactor||100
    },
    accounts:deepClone(S.accounts||[]),debts:deepClone(S.debts||[]),regularPayments:deepClone(S.regularPayments||[]),assets:deepClone(S.assets||[]),
    envelopeLimits:deepClone(S.envelopeLimits||{}),balanceHistory:deepClone(S.balanceHistory||[]),importRules:deepClone(S.importRules||[]),transactions
  }
}

function financeRebuild14Download(obj,name){
  const a=document.createElement("a"),blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
  a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0)
}
function financeRebuild14ExportCurrent(){financeRebuild14Download(financeRebuild14CurrentPackage(),`life-rpg-finance-${localDateKey()}.json`)}
function financeRebuild14Template(){
  const now=financeRebuild14Now();
  return {format:FINANCE_REBUILD14_FORMAT,version:1,generatedAt:now,baselineDate:localDateKey(),note:"Шаблон Finance Rebuild",
    settings:{primaryAccountId:"main",monthlyDebtGoal:0,dailySpendLimit:0,emergencyFundTarget:0,emergencyFundBalance:0,miniBufferTarget:15000,highInterestThreshold:40,envelopeRollover:true,autoReserveAfterImport:true,learnImportRules:true,incomeEvents:[],liquidityTargetDays:14,minimumCashFloor:0,forecastIncomeFactor:100},
    accounts:[{id:"main",name:"Основной счёт",type:"Дебетовый счёт",verifiedBalance:0,verifiedAt:now,active:true}],
    debts:[],regularPayments:[],assets:[],envelopeLimits:deepClone(DEFAULT_STATE.envelopeLimits),balanceHistory:[],importRules:[],transactions:[]}
}
function financeRebuild14DownloadTemplate(){financeRebuild14Download(financeRebuild14Template(),"life-rpg-finance-rebuild-template.json")}

function financeRebuild14RunAudit(){
  const box=document.getElementById("financeRebuild14Audit");if(!box)return;
  try{box.innerHTML=financeRebuild14AuditHtml(financeRebuild14CurrentAudit())}
  catch(e){box.innerHTML=`<div class="notice danger"><b>Audit не выполнен</b><div class="qmeta">${escapeHtml(String(e?.message||e))}</div></div>`}
}

function ensureFinanceRebuild14Ui(){
  if(document.getElementById("financeRebuild14"))return;
  const grid=document.querySelector("#more .grid");if(!grid)return;
  const anchor=document.getElementById("import127Command")?.closest(".card")||document.getElementById("recovery133Command")?.closest(".card")||grid.lastElementChild;
  const html=`<div id="financeRebuild14" data-ux7-view="settings" class="card ux7-card span-12">
    <div class="eyebrow">Release 14.0 • Data Integrity</div>
    <div class="section-title">Finance Rebuild</div>
    <div class="muted" style="margin-top:6px">Полная замена только финансового контура. Работа, теннис, знания, профиль, задачи и настройки Life Ops сохраняются. Перед применением автоматически создаётся Recovery snapshot.</div>
    <div class="split" style="margin-top:12px">
      <label class="btn">Выбрать Finance JSON<input id="financeRebuild14File" type="file" accept=".json,application/json" style="display:none" onchange="financeRebuild14Prepare(this)"></label>
      <button class="btn secondary" onclick="financeRebuild14ExportCurrent()">Экспорт текущих финансов</button>
      <button class="btn ghost" onclick="financeRebuild14DownloadTemplate()">Шаблон JSON</button>
    </div>
    <div id="financeRebuild14Preview" style="margin-top:12px"></div>
    <div class="split" style="margin-top:10px">
      <button id="financeRebuild14Apply" class="btn" onclick="financeRebuild14Apply()" disabled>Заменить финансы</button>
      <button class="btn ghost" onclick="financeRebuild14Cancel()">Очистить preview</button>
      <button class="btn secondary" onclick="financeRebuild14RunAudit()">Проверить текущие финансы</button>
    </div>
    <div class="title" style="margin-top:16px">Finance Integrity Audit</div>
    <div id="financeRebuild14Audit" style="margin-top:8px"></div>
  </div>`;
  anchor?.insertAdjacentHTML("afterend",html)
}

function renderFinanceRebuild14(){
  ensureFinanceRebuild14Ui();
  const preview=document.getElementById("financeRebuild14Preview"),apply=document.getElementById("financeRebuild14Apply");
  if(preview)preview.innerHTML=financeRebuild14PreviewHtml();
  if(apply)apply.disabled=!FINANCE_REBUILD14_PREVIEW?.pkg||!!FINANCE_REBUILD14_PREVIEW?.error||!FINANCE_REBUILD14_PREVIEW?.quality?.ok||FINANCE_REBUILD14_APPLY_PENDING;
  const audit=document.getElementById("financeRebuild14Audit");
  if(audit&&!audit.innerHTML)financeRebuild14RunAudit()
}

globalThis.financeRebuild14Prepare=financeRebuild14Prepare;
globalThis.financeRebuild14Apply=financeRebuild14Apply;
globalThis.financeRebuild14Cancel=financeRebuild14Cancel;
globalThis.financeRebuild14ExportCurrent=financeRebuild14ExportCurrent;
globalThis.financeRebuild14DownloadTemplate=financeRebuild14DownloadTemplate;
globalThis.financeRebuild14RunAudit=financeRebuild14RunAudit;
