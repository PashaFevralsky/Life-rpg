"use strict";

/* Life RPG — Life Ops
   Daily close, financial data quality, post-income allocation and Android local notifications.
   Web/PWA remains functional; native scheduling is enabled only when the Android bundle exposes
   globalThis.LifeRpgNativeNotifications. */

const LIFE_OPS_DEFAULTS={
  notificationsEnabled:true,
  activatedAt:"",
  closeTime:"20:30",
  followupTime:"22:00",
  freshnessDays:3,
  scheduleDays:14
};
let LIFE_OPS_INSTALLED=false;
let LIFE_OPS_NATIVE_READY=false;
let LIFE_OPS_INCOME_HOOKED=false;
let LIFE_OPS_ACTIVITY_HOOKS=false;
let LIFE_OPS_LAST_INCOME_ID="";

function lifeOpsCfg(){
  S.settings=S.settings||{};
  const raw=S.settings.lifeOps&&typeof S.settings.lifeOps==="object"&&!Array.isArray(S.settings.lifeOps)?S.settings.lifeOps:{};
  S.settings.lifeOps={...LIFE_OPS_DEFAULTS,...raw};
  S.settings.lifeOps.notificationsEnabled=S.settings.lifeOps.notificationsEnabled!==false;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(S.settings.lifeOps.activatedAt||"")))S.settings.lifeOps.activatedAt=localDateKey();
  S.settings.lifeOps.freshnessDays=clamp(Math.round(+S.settings.lifeOps.freshnessDays||3),1,14);
  S.settings.lifeOps.scheduleDays=clamp(Math.round(+S.settings.lifeOps.scheduleDays||14),3,30);
  for(const k of ["closeTime","followupTime"]){
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(S.settings.lifeOps[k]||"")))S.settings.lifeOps[k]=LIFE_OPS_DEFAULTS[k];
  }
  return S.settings.lifeOps
}
function lifeOpsDayState(key=localDateKey()){
  S.checks=S.checks||{};S.checks[key]=S.checks[key]||{};
  const raw=S.checks[key].lifeOps&&typeof S.checks[key].lifeOps==="object"&&!Array.isArray(S.checks[key].lifeOps)?S.checks[key].lifeOps:{};
  S.checks[key].lifeOps={...raw,confirmations:{expenses:false,income:false,payments:false,work:false,training:false,...(raw.confirmations||{})},closed:!!raw.closed,closedAt:String(raw.closedAt||"")};
  return S.checks[key].lifeOps
}
function lifeOpsIsClosed(key=localDateKey()){return !!S.checks?.[key]?.lifeOps?.closed}
function lifeOpsParseTime(dateKey,hhmm){const [y,m,d]=String(dateKey).split("-").map(Number),[h,mi]=String(hhmm).split(":").map(Number);return new Date(y,m-1,d,h,mi,0,0)}
function lifeOpsNotificationId(dateKey,slot){return Number(String(dateKey).replace(/-/g,""))*10+slot}
function lifeOpsDateOffset(n){return localDateKey(addDays(new Date(),n))}
function lifeOpsTodayCounts(){
  const k=localDateKey();
  const expenses=(S.expenses||[]).filter(x=>String(x.dateKey||x.date||"").slice(0,10)===k).length;
  const income=(S.incomeLogs||[]).filter(x=>String(x.dateKey||x.date||"").slice(0,10)===k).length;
  const payments=(S.payments||[]).filter(x=>String(x.localDate||x.date||"").slice(0,10)===k).length;
  const work=(S.workLogs||[]).filter(x=>String(x.date||x.dateKey||"").slice(0,10)===k).length;
  const training=(S.tennis||[]).filter(x=>String(x.dateKey||x.date||"").slice(0,10)===k).length;
  const plannedIncome=typeof plannedIncomeOnDate==="function"?plannedIncomeOnDate(new Date()):0;
  const due=(typeof financialEvents==="function"?financialEvents():[]).filter(x=>x.type==="payment"&&(x.overdue||String(x.dateKey||localDateKey(x.date))===k));
  return {expenses,income,payments,work,training,plannedIncome,due,dueAmount:due.reduce((s,x)=>moneyAdd(s,x.amount||0),0)}
}
function lifeOpsPreviousDayClosed(){const key=localDateKey(addDays(new Date(),-1));return !!S.checks?.[key]?.lifeOps?.closed}
function lifeOpsVerificationAgeDays(){
  const ts=Date.parse(typeof primaryCashVerifiedAt==="function"?primaryCashVerifiedAt():"");
  if(!Number.isFinite(ts))return null;
  return Math.max(0,Math.floor((Date.now()-ts)/86400000))
}
function lifeOpsDataQuality(){
  const cfg=lifeOpsCfg(),age=lifeOpsVerificationAgeDays(),reasons=[];
  if(age==null)reasons.push("денежный баланс ещё не сверялся");
  else if(age>cfg.freshnessDays)reasons.push(`сверка денег была ${age} дн. назад`);
  const yesterday=localDateKey(addDays(new Date(),-1)),activated=String(cfg.activatedAt||localDateKey());
  if(yesterday>=activated&&reportingDateAllowed(yesterday)&&!lifeOpsPreviousDayClosed())reasons.push("вчерашний день не закрыт");
  const p=typeof buildFinancialProjection==="function"?buildFinancialProjection(30):null;
  for(const w of (p?.warnings||[])){
    if(/долгов отсутствует|бюджет повседневных|подтверждённого банковского/i.test(w))reasons.push(w)
  }
  return {good:reasons.length===0,age,reasons,projection:p}
}
function lifeOpsSafeAllocation(options={}){
  const ignoreReservations=options.ignoreReservations!==false;
  const p=autopilotPlan({ignoreReservations});
  const q=lifeOpsDataQuality(),projection=q.projection||buildFinancialProjection(30),floor=Math.max(0,+S.settings.minimumCashFloor||0);
  const capacity=Math.max(0,moneySub(projection.minBalance,floor));
  const baseGap=!!projection.cashGapDate;
  const safeDebtExtra=(!q.good||baseGap)?0:Math.max(0,Math.min(p.debtExtra,capacity));
  const withheld=Math.max(0,moneySub(p.debtExtra,safeDebtExtra));
  return {...p,projection,dataQuality:q,floor,safeDebtExtra,debtSafetyWithheld:withheld,finalUnallocated:moneyAdd(p.unallocated,withheld)}
}
function lifeOpsAllocationHtml(plan,income=null){
  const q=plan.dataQuality,proj=plan.projection,best=plan.best?escapeHtml(plan.best.name):"долги закрыты";
  const incomeTitle=income?`Поступило ${rub(income.amount)} • ${escapeHtml(income.source||"Доход")}`:"Безопасное распределение денег";
  const mandatory=plan.mandatory.length?plan.mandatory.slice(0,6).map(x=>`<div class="qmeta">${fmtDate(x.date)} • ${escapeHtml(x.label||x.debt||"Платёж")} — ${rub(x.amount)}</div>`).join(""):"<div class=\"qmeta\">До следующего дохода новых обязательных платежей нет.</div>";
  return `<div class="eyebrow">Money Autopilot</div><div class="section-title">${incomeTitle}</div>
    <div class="muted" style="margin-top:6px">План пересчитан по всему текущему денежному балансу после поступления, а не только по сумме зарплаты.</div>
    <div class="report-grid" style="margin-top:12px">
      <div class="report-item"><div class="smallcaps">Обязательные</div><b>${rub(plan.mandatoryReserve)}</b></div>
      <div class="report-item"><div class="smallcaps">Жизнь до дохода</div><b>${rub(plan.livingReserve)}</b><div class="sub">${plan.days} дн. • ${rub(plan.daily)}/день</div></div>
      <div class="report-item"><div class="smallcaps">В резерв</div><b>${rub(plan.emergencyTopUp)}</b></div>
      <div class="report-item"><div class="smallcaps">Безопасная досрочка</div><b class="${plan.safeDebtExtra>0?"income-good":""}">${rub(plan.safeDebtExtra)}</b><div class="sub">${best}</div></div>
    </div>
    <div class="notice" style="margin-top:10px"><b>30-дневный предохранитель.</b><br>Минимальный прогноз до досрочки: ${rub(proj.minBalance)} • неснижаемый остаток ${rub(plan.floor)}.${plan.debtSafetyWithheld>0?` Поэтому ${rub(plan.debtSafetyWithheld)} не направляем в досрочку.`:""}${proj.cashGapDate?` Базовый прогноз уже показывает риск разрыва ${fmtDate(parseLocal(proj.cashGapDate))}.`:""}</div>
    ${q.good?'<div class="status" style="margin-top:10px">Качество финансовых данных достаточное для рекомендации досрочки.</div>':`<div class="notice" style="margin-top:10px"><b>Досрочка заблокирована до обновления данных.</b><br>${q.reasons.map(escapeHtml).join(" • ")}</div>`}
    <div style="margin-top:10px">${mandatory}</div>
    ${plan.shortage>0?`<div class="notice" style="margin-top:10px"><b>Не хватает ${rub(plan.shortage)}</b> даже на обязательные платежи и жизнь до следующего дохода.</div>`:""}
    ${plan.finalUnallocated>0?`<div class="status" style="margin-top:10px">Пока не распределяем: ${rub(plan.finalUnallocated)}.</div>`:""}`
}
async function lifeOpsAcceptAllocation(){
  if(!primaryCashVerifiedAt()){toast("Сначала сверь текущий денежный баланс");if(typeof ux7Go==="function")ux7Go("finance","overview");return}
  const before=deepClone(S);
  try{
    releaseActiveReservations(true);
    const p=lifeOpsSafeAllocation({ignoreReservations:true}),planId=uid(),createdAt=new Date().toISOString(),untilDate=p.next?localDateKey(p.next.date):localDateKey(addDays(new Date(),7));
    let leftCents=Math.max(0,moneyCents(p.mandatoryReserve));
    for(const m of p.mandatory){if(leftCents<=0)break;const amountCents=Math.min(leftCents,Math.max(0,moneyCents(m.amount))),amount=moneyFromCents(amountCents);if(amountCents>0)S.reservations.push({id:uid(),planId,type:"mandatory",label:m.label||m.debt,debtIndex:m.debtIndex??null,regularPaymentId:m.regularPaymentId||null,amount,remaining:amount,createdAt,untilDate,status:"active"});leftCents-=amountCents}
    if(moneyCents(p.livingReserve)>0)S.reservations.push({id:uid(),planId,type:"living",label:"Жизнь до следующего дохода",amount:p.livingReserve,remaining:p.livingReserve,createdAt,untilDate,status:"active"});
    if(moneyCents(p.emergencyTopUp)>0)S.reservations.push({id:uid(),planId,type:"emergency",label:"Пополнение резерва",amount:p.emergencyTopUp,remaining:p.emergencyTopUp,createdAt,untilDate,status:"active"});
    if(moneyCents(p.safeDebtExtra)>0&&p.best)S.reservations.push({id:uid(),planId,type:"debt",label:`Досрочка: ${p.best.name}`,debtIndex:p.best.i,amount:p.safeDebtExtra,remaining:p.safeDebtExtra,createdAt,untilDate,status:"active"});
    audit("Life Ops: распределение денег","finance",`обязательные ${rub(p.mandatoryReserve)} • жизнь ${rub(p.livingReserve)} • резерв ${rub(p.emergencyTopUp)} • досрочка ${rub(p.safeDebtExtra)}`);
    await persistPreparedStateAtomically(before);
    render();
    closeModal("lifeOpsIncomePlanModal");
    toast("Безопасное распределение принято — суммы зарезервированы");
  }catch(e){S=before;render();toast(`План не сохранён: ${e.message}`);throw e}
}
function lifeOpsShowIncomePlan(income){
  ensureLifeOpsUi();LIFE_OPS_LAST_INCOME_ID=income?.id||"";
  const plan=lifeOpsSafeAllocation({ignoreReservations:true}),box=$("lifeOpsIncomePlanBody");
  if(box)box.innerHTML=lifeOpsAllocationHtml(plan,income);
  openModal("lifeOpsIncomePlanModal")
}
function lifeOpsMarkDirty(){const d=lifeOpsDayState();if(!d.closed)return;d.closed=false;d.closedAt=""}
function lifeOpsInstallIncomeHook(){
  if(LIFE_OPS_INCOME_HOOKED||typeof addIncome!=="function")return;LIFE_OPS_INCOME_HOOKED=true;
  const base=addIncome;
  globalThis.addIncome=async function(){
    const beforeIds=new Set((S.incomeLogs||[]).map(x=>x.id));
    await base.apply(this,arguments);
    const added=(S.incomeLogs||[]).find(x=>!beforeIds.has(x.id));
    if(added){lifeOpsMarkDirty();await persist();render();setTimeout(()=>lifeOpsShowIncomePlan(added),80)}
  }
}
function lifeOpsWrapActivity(name,collection){
  const base=globalThis[name];if(typeof base!=="function"||base.__lifeOpsWrapped)return;
  const wrapped=async function(){const before=Array.isArray(S[collection])?S[collection].length:-1;const out=await base.apply(this,arguments);const after=Array.isArray(S[collection])?S[collection].length:-1;if(after!==before){lifeOpsMarkDirty();await persist();render()}return out};
  wrapped.__lifeOpsWrapped=true;globalThis[name]=wrapped
}
function lifeOpsInstallActivityHooks(){
  if(LIFE_OPS_ACTIVITY_HOOKS)return;LIFE_OPS_ACTIVITY_HOOKS=true;
  for(const [fn,col] of [["addExpense","expenses"],["addPayment","payments"],["addWorkLog","workLogs"],["addTennis","tennis"],["addReading","readingLogs"]])lifeOpsWrapActivity(fn,col)
}
function lifeOpsSetConfirmation(key,checked){
  const d=lifeOpsDayState();d.confirmations[key]=!!checked;d.closed=false;d.closedAt="";
  void save().catch(()=>{})
}
async function lifeOpsCloseDay(){
  const d=lifeOpsDayState(),need=["expenses","income","payments","work","training"],missing=need.filter(k=>!d.confirmations[k]);
  if(missing.length){toast("Перед закрытием подтверди все 5 пунктов");return}
  d.closed=true;d.closedAt=new Date().toISOString();audit("День закрыт","life-ops",localDateKey());
  await save("День закрыт — вечерние напоминания на сегодня отменены");
  await lifeOpsSyncNotifications(false)
}
async function lifeOpsReopenDay(){const d=lifeOpsDayState();d.closed=false;d.closedAt="";await save("День снова открыт");await lifeOpsSyncNotifications(false)}
function lifeOpsOpenQuick(kind){if(typeof quickAction==="function")quickAction(kind)}
function lifeOpsTodayHtml(){
  const d=lifeOpsDayState(),c=lifeOpsTodayCounts(),q=lifeOpsDataQuality(),items=[
    ["expenses","Расходы проверены / за день расходов не было",`${c.expenses} записей`],
    ["income","Доходы проверены / поступлений не было",`${c.income} записей${c.plannedIncome>0?` • ожидалось ${rub(c.plannedIncome)}`:""}`],
    ["payments","Обязательные платежи проверены",c.due.length?`${c.due.length} требуют внимания • ${rub(c.dueAmount)}`:`сегодня просроченных/срочных нет`],
    ["work","Работа внесена / сегодня не требовалось",`${c.work} записей`],
    ["training","Тренировка внесена / сегодня не было",`${c.training} сессий`]
  ];
  const checked=Object.values(d.confirmations||{}).filter(Boolean).length;
  return `<div class="split"><div><div class="eyebrow">Life Ops</div><div class="section-title">Закрытие дня</div></div><span class="tag ${d.closed?"good":""}">${d.closed?"День закрыт":`${checked}/5`}</span></div>
    <div class="muted" style="margin-top:6px">Закрытие дня подтверждает, что Life RPG располагает актуальными данными перед финансовыми решениями.</div>
    <div style="margin-top:12px">${items.map(([k,title,meta])=>`<label class="toggle-line" style="margin-top:8px"><input type="checkbox" ${d.confirmations[k]?"checked":""} onchange="lifeOpsSetConfirmation('${k}',this.checked)"><span><b>${escapeHtml(title)}</b><span class="sub" style="display:block">${meta}</span></span></label>`).join("")}</div>
    ${c.due.length?`<div class="notice" style="margin-top:10px"><b>Проверь обязательства:</b><br>${c.due.slice(0,5).map(x=>`${escapeHtml(x.label)} — ${rub(x.amount)}${x.overdue?" • просрочено":" • сегодня"}`).join("<br>")}</div>`:""}
    <div class="notice" style="margin-top:10px"><b>Качество финансовых данных: ${q.good?"достаточное":"нужно обновить"}.</b>${q.good?`<br>Сверка денег ${q.age===0?"сегодня":`${q.age} дн. назад`}.`:`<br>${q.reasons.map(escapeHtml).join(" • ")}`}</div>
    <div class="split" style="margin-top:12px"><button class="btn" onclick="lifeOpsCloseDay()" ${d.closed?"disabled":""}>${d.closed?"День закрыт":"Закрыть день"}</button>${d.closed?'<button class="btn ghost" onclick="lifeOpsReopenDay()">Открыть снова</button>':''}<button class="btn secondary" onclick="lifeOpsOpenQuick('expense')">+ Расход</button><button class="btn secondary" onclick="lifeOpsOpenQuick('income')">+ Доход</button></div>`
}
function lifeOpsSettingsHtml(){
  const cfg=lifeOpsCfg(),native=!!globalThis.LifeRpgNativeNotifications;
  return `<div class="eyebrow">Life Ops</div><div class="section-title">Напоминания и качество данных</div>
    <div class="muted" style="margin-top:6px">На Android вечерние уведомления планируются локально и могут прийти при закрытом приложении. Если день уже закрыт, его уведомления отменяются.</div>
    <div class="formgrid" style="margin-top:12px"><div class="field"><label>Первое напоминание</label><input id="lifeOpsCloseTime" type="time" value="${cfg.closeTime}"></div><div class="field"><label>Повторное напоминание</label><input id="lifeOpsFollowupTime" type="time" value="${cfg.followupTime}"></div><div class="field"><label>Сверка денег считается свежей, дней</label><input id="lifeOpsFreshnessDays" type="number" min="1" max="14" value="${cfg.freshnessDays}"></div></div>
    <label class="toggle-line" style="margin-top:10px"><input id="lifeOpsNotificationsEnabled" type="checkbox" ${cfg.notificationsEnabled?"checked":""}><span>Вечерние напоминания включены</span></label>
    <div class="split" style="margin-top:12px"><button class="btn" onclick="lifeOpsSaveSettings()">Сохранить</button><button class="btn secondary" onclick="lifeOpsEnableNotifications()">${native?"Разрешить Android-уведомления":"Включить уведомления"}</button></div>
    <div id="lifeOpsNotificationStatus" class="status" style="margin-top:10px">Проверяю…</div>`
}
function ensureLifeOpsUi(){
  lifeOpsCfg();lifeOpsInstallIncomeHook();lifeOpsInstallActivityHooks();
  if(!$("lifeOpsDayClose")){
    const quick=document.querySelector("#today .quick-card"),card=document.createElement("div");card.className="card ux7-card span-12";card.dataset.ux7View="focus";card.innerHTML='<div id="lifeOpsDayClose"></div>';if(quick)quick.after(card);else document.querySelector("#today .grid")?.prepend(card)
  }
  if(!$("lifeOpsSettings")){
    const anchor=$("notificationStatus")?.closest(".card")||document.querySelector("#more [data-ux7-view~='settings']"),card=document.createElement("div");card.className="card ux7-card span-12";card.dataset.ux7View="settings";card.innerHTML='<div id="lifeOpsSettings"></div>';if(anchor)anchor.after(card);else document.querySelector("#more .grid")?.append(card)
  }
  if(!$("lifeOpsIncomePlanModal")){
    const modal=document.createElement("div");modal.className="modal";modal.id="lifeOpsIncomePlanModal";modal.innerHTML='<div class="modal-card"><div class="modal-head"><div class="title">Что делать с поступлением</div><button class="close" onclick="closeModal(\'lifeOpsIncomePlanModal\')">×</button></div><div id="lifeOpsIncomePlanBody"></div><div class="split" style="margin-top:14px"><button class="btn" onclick="lifeOpsAcceptAllocation()">Принять распределение</button><button class="btn secondary" onclick="closeModal(\'lifeOpsIncomePlanModal\');ux7Go(\'finance\',\'overview\')">Открыть Деньги</button><button class="btn ghost" onclick="closeModal(\'lifeOpsIncomePlanModal\')">Позже</button></div></div>';document.body.appendChild(modal)
  }
  if(globalThis.__LIFE_RPG_ANDROID__){const legacy=$("notificationStatus")?.closest(".card");if(legacy)legacy.style.display="none"}
  if(!LIFE_OPS_INSTALLED){LIFE_OPS_INSTALLED=true;setTimeout(()=>{void lifeOpsInitNative()},900)}
}
function renderLifeOps(){
  const day=$("lifeOpsDayClose"),settings=$("lifeOpsSettings");if(day)day.innerHTML=lifeOpsTodayHtml();if(settings)settings.innerHTML=lifeOpsSettingsHtml();
  lifeOpsRenderFinanceGuard();void lifeOpsRenderNotificationStatus()
}
function lifeOpsRenderFinanceGuard(){
  const box=$("autopilotPlan");if(!box)return;let guard=$("lifeOpsAutopilotGuard");if(!guard){guard=document.createElement("div");guard.id="lifeOpsAutopilotGuard";guard.style.marginTop="10px";box.after(guard)}
  const p=lifeOpsSafeAllocation({ignoreReservations:false}),q=p.dataQuality;
  guard.innerHTML=`<div class="notice"><b>Life Ops • 30-дневный предохранитель:</b> безопасная досрочка сейчас ${rub(p.safeDebtExtra)}${p.debtSafetyWithheld>0?` вместо ${rub(p.debtExtra)}`:""}.${q.good?"":" Досрочка заблокирована до обновления данных."}</div>`
}
async function lifeOpsSaveSettings(){
  const cfg=lifeOpsCfg();cfg.closeTime=$("lifeOpsCloseTime")?.value||cfg.closeTime;cfg.followupTime=$("lifeOpsFollowupTime")?.value||cfg.followupTime;cfg.freshnessDays=clamp(Math.round(+$('lifeOpsFreshnessDays')?.value||3),1,14);cfg.notificationsEnabled=!!$("lifeOpsNotificationsEnabled")?.checked;
  await save("Настройки Life Ops сохранены");await lifeOpsSyncNotifications(false)
}
function lifeOpsNative(){return globalThis.LifeRpgNativeNotifications||null}
async function lifeOpsNotificationPermission(request=false){
  const n=lifeOpsNative();if(!n)return {mode:"web",granted:("Notification" in window)&&Notification.permission==="granted",status:("Notification" in window)?Notification.permission:"unsupported"};
  try{let p=await n.checkPermissions();if(request&&p.display!=="granted")p=await n.requestPermissions();return {mode:"android",granted:p.display==="granted",status:p.display||"unknown"}}catch(e){return {mode:"android",granted:false,status:`error: ${e.message}`}}
}
async function lifeOpsEnableNotifications(){
  const n=lifeOpsNative();
  if(!n){if(typeof enableNotifications==="function")await enableNotifications();await lifeOpsRenderNotificationStatus();return}
  const p=await lifeOpsNotificationPermission(true);if(!p.granted){toast("Разрешение на уведомления не выдано");await lifeOpsRenderNotificationStatus();return}lifeOpsCfg().notificationsEnabled=true;await save("Android-уведомления включены");await lifeOpsSyncNotifications(false);toast("Вечерние уведомления запланированы")
}
async function lifeOpsRenderNotificationStatus(){
  const box=$("lifeOpsNotificationStatus");if(!box)return;const p=await lifeOpsNotificationPermission(false),cfg=lifeOpsCfg();
  let pending="";if(p.mode==="android"&&p.granted){try{const x=await lifeOpsNative().getPending();const count=(x?.notifications||[]).filter(n=>Number(n.id)>=200000000).length;pending=` • запланировано ${count}`}catch{}}
  box.textContent=p.mode==="android"?`Android: ${p.status}${pending} • ${cfg.closeTime} / ${cfg.followupTime}`:`Web: ${p.status} • фоновые гарантии доступны только в APK`
}
async function lifeOpsSyncNotifications(requestPermission=false){
  const n=lifeOpsNative(),cfg=lifeOpsCfg();if(!n||!cfg.notificationsEnabled)return false;
  const perm=await lifeOpsNotificationPermission(requestPermission);if(!perm.granted)return false;
  const now=new Date(),ids=[];for(let i=0;i<cfg.scheduleDays;i++){const key=lifeOpsDateOffset(i);ids.push({id:lifeOpsNotificationId(key,1)},{id:lifeOpsNotificationId(key,2)})}
  try{await n.cancel({notifications:ids})}catch{}
  const notifications=[];
  for(let i=0;i<cfg.scheduleDays;i++){
    const key=lifeOpsDateOffset(i);if(lifeOpsIsClosed(key))continue;
    for(const [slot,time,title,body] of [
      [1,cfg.closeTime,"Life RPG • закрытие дня","Проверь расходы, доходы, обязательные платежи, работу и тренировку. Закрой день в Life RPG."],
      [2,cfg.followupTime,"Life RPG • день ещё не закрыт","Данные за день не подтверждены. Закрой день, чтобы финансовые рекомендации оставались надёжными."]
    ]){
      const at=lifeOpsParseTime(key,time);if(at<=now)continue;notifications.push({id:lifeOpsNotificationId(key,slot),title,body,schedule:{at},extra:{lifeOps:"day-close",dateKey:key,slot}})
    }
  }
  if(notifications.length)await n.schedule({notifications});await lifeOpsRenderNotificationStatus();return true
}
async function lifeOpsCancelTodayNotifications(){const n=lifeOpsNative();if(!n)return;const k=localDateKey();try{await n.cancel({notifications:[{id:lifeOpsNotificationId(k,1)},{id:lifeOpsNotificationId(k,2)}]})}catch{}}
async function lifeOpsInitNative(){
  if(LIFE_OPS_NATIVE_READY)return;LIFE_OPS_NATIVE_READY=true;
  const n=lifeOpsNative();if(!n){await lifeOpsRenderNotificationStatus();return}
  try{await n.addListener("localNotificationActionPerformed",()=>{setTimeout(()=>{try{ux7Go("today","focus");document.getElementById("lifeOpsDayClose")?.scrollIntoView({behavior:"smooth",block:"start"})}catch{}},200)})}catch{}
  await lifeOpsSyncNotifications(false);await lifeOpsRenderNotificationStatus()
}

/* Existing Finance Autopilot button uses the same 30-day safety gate once Life Ops loads. */
function lifeOpsInstallAutopilotGuard(){
  if(typeof acceptAutopilotPlan!=="function"||acceptAutopilotPlan.__lifeOpsSafe)return;
  const wrapped=async function(){return lifeOpsAcceptAllocation()};wrapped.__lifeOpsSafe=true;globalThis.acceptAutopilotPlan=wrapped
}
const LIFE_OPS_ORIGINAL_ENSURE=ensureLifeOpsUi;
ensureLifeOpsUi=function(){LIFE_OPS_ORIGINAL_ENSURE();lifeOpsInstallAutopilotGuard()};
