"use strict";

/* Life RPG 8.0.3 — Finance domain */

function totalDebt(){return moneyFromCents(S.debts.reduce((a,d)=>a+Math.max(0,moneyCents(d.balance)),0))}

function startingDebt(){return S.debts.reduce((a,d)=>a+Math.max(0,Number(d.initial??d.balance)||0),0)}

function debtPaid(){return Math.max(0,startingDebt()-totalDebt())}

function debtPct(){const start=startingDebt();return start>0?clamp(debtPaid()/start*100,0,100):0}

function monthPayments(month=localMonthKey()){return moneySum(S.payments.filter(p=>(p.monthKey||String(p.date||"").slice(0,7))===month).map(p=>p.amount))}

function monthExpenses(month=localMonthKey()){return moneySum(S.expenses.filter(x=>x.dateKey?.startsWith(month)).map(x=>x.amount))}

function monthLivingExpenses(month=localMonthKey()){return S.expenses.filter(x=>x.dateKey?.startsWith(month)&&!x.regularPaymentId).reduce((a,x)=>a+(+x.amount||0),0)}

function monthRegularExpenses(month=localMonthKey()){return S.expenses.filter(x=>x.dateKey?.startsWith(month)&&!!x.regularPaymentId).reduce((a,x)=>a+(+x.amount||0),0)}

function monthIncome(month=localMonthKey()){return moneySum(S.incomeLogs.filter(x=>x.dateKey?.startsWith(month)).map(x=>x.amount))}

function trackedCash(month=localMonthKey()){return monthIncome(month)-monthExpenses(month)-monthPayments(month)}

function totalLoggedIncome(){return moneySum(S.incomeLogs.map(x=>x.amount))}

function totalLoggedExpenses(){return moneySum(S.expenses.map(x=>x.amount))}

function totalLoggedPayments(){return moneySum(S.payments.map(x=>x.amount))}

function cashAdjustmentTotal(){return moneySum((S.cashAdjustments||[]).map(x=>x.delta))}

function fundCashDelta(){return (S.fundTransfers||[]).reduce((a,x)=>a+(x.direction==="fromFund"?+x.amount||0:-(+x.amount||0)),0)}

function legacyOperatingCashBalance(){return moneyAdd(totalLoggedIncome(),-totalLoggedExpenses(),-totalLoggedPayments(),cashAdjustmentTotal(),fundCashDelta())}

function activeAccounts(){return (S.accounts||[]).filter(a=>a.active!==false)}

function defaultAccountId(){const active=activeAccounts(),wanted=String(S.settings?.primaryAccountId||"");if(wanted&&active.some(a=>a.id===wanted))return wanted;const verified=active.filter(a=>a.verifiedAt&&a.verifiedBalance!=null).sort((a,b)=>Date.parse(b.verifiedAt)-Date.parse(a.verifiedAt));return verified[0]?.id||active.find(a=>a.id==="main")?.id||active[0]?.id||"main"}

function primaryAccount(){return (S.accounts||[]).find(a=>a.id===defaultAccountId()&&a.active!==false)||null}
function primaryCashVerifiedAt(){return primaryAccount()?.verifiedAt||""}

function accountsModeActive(){return activeAccounts().some(a=>a.verifiedAt&&a.verifiedBalance!=null)}

function eventTs(x){const occurred=Date.parse(x?.occurredAt||"");if(Number.isFinite(occurred))return occurred;const d=x?.dateKey||x?.localDate||"",dateRaw=String(x?.date||""),dateTs=Date.parse(dateRaw||x?.createdAt||"");if(validDateKey(d)){const dateKeyFromRaw=/^\d{4}-\d{2}-\d{2}/.test(dateRaw)?dateRaw.slice(0,10):"";if(!Number.isFinite(dateTs)||(dateKeyFromRaw&&dateKeyFromRaw!==d))return Date.parse(`${d}T12:00:00`)}return Number.isFinite(dateTs)?dateTs:0}

function accountBalanceById(id){const a=(S.accounts||[]).find(x=>x.id===id);if(!a)return 0;if(a.verifiedAt&&a.verifiedBalance!=null){const t=Date.parse(a.verifiedAt)||0;return moneyAdd(a.verifiedBalance,accountDeltaAfter(a.id,t))}if(a.id===defaultAccountId()&&!accountsModeActive())return legacyOperatingCashBalance();return 0}

function operatingCashBalance(){return accountsModeActive()?moneySum(activeAccounts().map(a=>accountBalanceById(a.id))):legacyOperatingCashBalance()}

function accountName(id){return (S.accounts||[]).find(a=>a.id===id)?.name||"Основной счёт"}

function accountOptions(selected=""){return activeAccounts().map(a=>`<option value="${escapeHtml(a.id)}" ${a.id===selected?"selected":""}>${escapeHtml(a.name)} • ${rub(accountBalanceById(a.id))}</option>`).join("")}

function addAccount(){const name=$("accountName").value.trim(),type=$("accountType").value,raw=$("accountStartBalance").value.trim(),provided=raw!=="",balance=provided?Number(raw):NaN;if(!name){toast("Укажи название счёта");return}if(provided&&(!Number.isFinite(balance)||balance<0)){toast("Укажи корректный остаток или оставь поле пустым");return}const a={id:uid(),name,type,verifiedBalance:provided?balance:null,verifiedAt:provided?new Date().toISOString():"",active:true};S.accounts.push(a);$("accountName").value=$("accountStartBalance").value="";audit("Добавлен счёт","account",name);save(provided?"Счёт добавлен и остаток подтверждён":"Счёт добавлен — сверь остаток") }

function syncAccountBalance(id){const el=$(`account-sync-${id}`),v=+el?.value;if(!Number.isFinite(v)||v<0){toast("Укажи фактический остаток");return}const a=S.accounts.find(x=>x.id===id);if(!a)return;a.verifiedBalance=v;a.verifiedAt=new Date().toISOString();if(id===defaultAccountId())S.settings.cashBalanceVerifiedAt=a.verifiedAt;el.value="";audit("Сверка счёта","account",`${a.name}: ${rub(v)}`);save("Остаток счёта подтверждён")}

function archiveAccount(id){const a=S.accounts.find(x=>x.id===id);if(!a||a.id===defaultAccountId()){toast("Основной счёт архивировать нельзя");return}if(accountBalanceById(id)>0.01&&!confirm("На счёте есть остаток. Всё равно скрыть его?"))return;a.active=false;audit("Счёт архивирован","account",a.name);save("Счёт скрыт")}

function renderAccounts(){const box=$("accountList");if(!box)return;const primary=defaultAccountId();box.innerHTML=activeAccounts().map(a=>{const bal=accountBalanceById(a.id);return `<div class="account-row"><div><div class="qtitle">${escapeHtml(a.name)} ${a.id===primary?'<span class="tag good">основной</span>':''}</div><div class="qmeta">${escapeHtml(a.type)} • ${a.verifiedAt?`сверено ${new Date(a.verifiedAt).toLocaleString("ru-RU")}`:"не сверено"}${bal<-.01?' • <span class="income-bad">нужна сверка</span>':''}</div></div><b class="${bal<0?'income-bad':''}">${rub(bal)}</b><input id="account-sync-${a.id}" type="number" min="0" placeholder="Факт"><button class="btn ghost small" onclick="syncAccountBalance('${a.id}')">Сверить</button>${a.id!==primary?`<button class="btn ghost small" onclick="setPrimaryAccount('${a.id}')">Основной</button><button class="btn ghost small" onclick="archiveAccount('${a.id}')">Скрыть</button>`:""}</div>`}).join("");renderAccountSelects()}

async function setPrimaryAccount(id){const a=(S.accounts||[]).find(x=>x.id===id&&x.active!==false);if(!a)return;S.settings.primaryAccountId=id;S.settings.cashBalanceVerifiedAt=a.verifiedAt||"";audit("Основной счёт изменён","account",a.name);await save(`Основной счёт: ${a.name}`)}

async function addBankTransfer(){const from=$("transferFrom").value,to=$("transferTo").value,amount=+$("transferAmount").value||0;if(!from||!to||from===to){toast("Выбери два разных счёта");return}if(amount<=0){toast("Укажи сумму перевода");return}const x={id:uid(),dateKey:localDateKey(),date:new Date().toISOString(),amount,fromAccountId:from,toAccountId:to,note:$("transferNote").value.trim()||"Перевод между своими счетами"};S.bankTransfers.unshift(x);$("transferAmount").value=$("transferNote").value="";closeModal("transferModal");audit("Перевод между счетами","transfer",`${accountName(from)} → ${accountName(to)} ${rub(amount)}`);await save("Перевод сохранён")}

async function deleteTransfer(id){const i=S.bankTransfers.findIndex(x=>x.id===id);if(i<0)return;trashPush("transfer",S.bankTransfers[i]);S.bankTransfers.splice(i,1);await save("Перевод удалён")}

function activeReservations(){return (S.reservations||[]).filter(x=>x.status==="active"&&(+x.remaining||0)>0.009)}

function reservedCashTotal(){return moneySum(activeReservations().map(x=>x.remaining))}

function freeCashBalance(){return moneySub(operatingCashBalance(),reservedCashTotal())}

function reservationAmount(type,debtIndex=null){return activeReservations().filter(x=>x.type===type&&(debtIndex==null||x.debtIndex===debtIndex)).reduce((a,x)=>a+(+x.remaining||0),0)}

function reservationBreakdown(){return {mandatory:reservationAmount("mandatory"),living:reservationAmount("living"),emergency:reservationAmount("emergency"),debt:reservationAmount("debt"),total:reservedCashTotal()}}

function consumeReservation(types,amount,debtIndex=null,regularPaymentId=null){
  types=Array.isArray(types)?types:[types];let left=Math.max(0,+amount||0),use=[];
  const matches=r=>{if(!types.includes(r.type))return false;if(debtIndex!=null&&r.debtIndex!==debtIndex)return false;if(regularPaymentId!=null&&r.regularPaymentId!==regularPaymentId)return false;return true};
  for(const type of types){for(const r of activeReservations().filter(x=>x.type===type&&matches(x)).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)))){if(left<=0.009)break;const take=Math.min(left,+r.remaining||0);if(take<=0)continue;r.remaining=Math.max(0,(+r.remaining||0)-take);if(r.remaining<=0.009)r.status="consumed";use.push({id:r.id,amount:take});left-=take}if(left<=0.009)break}
  return use
}

function restoreReservationUse(use){for(const u of (use||[])){const r=(S.reservations||[]).find(x=>x.id===u.id);if(!r)continue;r.remaining=(+r.remaining||0)+(+u.amount||0);r.status="active"}}

function reapplyReservationUse(use){for(const u of (use||[])){const r=(S.reservations||[]).find(x=>x.id===u.id);if(!r)continue;r.remaining=Math.max(0,(+r.remaining||0)-(+u.amount||0));if(r.remaining<=0.009)r.status="consumed"}}

function monthFromKey(mk){const [y,m]=String(mk).split("-").map(Number);return new Date(y,m-1,1,12)}

function nextMonthKey(mk){const d=monthFromKey(mk);d.setMonth(d.getMonth()+1);return localMonthKey(d)}

function envelopeCarry(cat,month=localMonthKey()){return Math.max(0,+S.envelopeCarryovers?.[month]?.[cat]||0)}

function effectiveEnvelopeLimit(cat,month=localMonthKey()){return Math.max(0,(+S.envelopeLimits?.[cat]||0)+envelopeCarry(cat,month))}

function activeRegularPayments(){return (S.regularPayments||[]).filter(x=>x.active!==false&&(+x.amount||0)>0)}

function regularPaidAmount(r,month=localMonthKey()){return S.expenses.filter(x=>x.regularPaymentId===r.id&&x.dateKey?.startsWith(month)).reduce((a,x)=>a+(+x.amount||0),0)}

function regularRemaining(r,month=localMonthKey()){return Math.max(0,(+r.amount||0)-regularPaidAmount(r,month))}

function regularDueDate(r,y,m){return new Date(y,m,Math.min(Math.max(1,+r.dueDay||1),new Date(y,m+1,0).getDate()),12)}

function regularPaymentsBefore(dateLimit){
  const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),1),limit=new Date(dateLimit.getFullYear(),dateLimit.getMonth(),dateLimit.getDate(),23,59,59),items=[];
  for(let off=0;off<2;off++){const y=now.getFullYear(),m=now.getMonth()+off,mk=`${y}-${String(m+1).padStart(2,"0")}`;for(const r of activeRegularPayments()){if(r.mandatory===false)continue;const due=regularDueDate(r,y,m),need=regularRemaining(r,mk);if(due>=start&&due<=limit&&need>0)items.push({kind:"regular",label:r.name,regularPaymentId:r.id,date:due,amount:need})}}
  return items.sort((a,b)=>a.date-b.date)
}

function recurringOnDate(d){const mk=localMonthKey(d);return activeRegularPayments().filter(r=>r.mandatory!==false&&regularDueDate(r,d.getFullYear(),d.getMonth()).getDate()===d.getDate()).reduce((a,r)=>a+regularRemaining(r,mk),0)}

function matchRegularPayment(desc,amount,dateKey=localDateKey()){
  const s=String(desc||"").toLowerCase(),mk=String(dateKey).slice(0,7),candidates=activeRegularPayments().filter(r=>regularRemaining(r,mk)>0).map(r=>{const kw=String(r.keywords||"").toLowerCase().split(/[,;]+/).map(x=>x.trim()).filter(Boolean),name=String(r.name||"").toLowerCase(),textHit=(name&&s.includes(name))||kw.some(k=>s.includes(k)),amountHit=Math.abs((+r.amount||0)-(+amount||0))<=Math.max(2,(+r.amount||0)*0.03);return {r,score:(textHit?2:0)+(amountHit?1:0)}}).filter(x=>x.score>=2).sort((a,b)=>b.score-a.score);return candidates[0]?.r||null
}

function matchPlannedIncome(dateKey,amount,desc=""){
  const d=parseLocal(dateKey),y=d.getFullYear(),m=d.getMonth(),text=String(desc||"").toLowerCase(),cand=(S.settings.incomeEvents||[]).map(ev=>{const dateDiff=Math.abs(Math.min(ev.day,daysInMonth(d))-d.getDate()),amountDiff=Math.abs((+ev.amount||0)-(+amount||0)),labelHit=text.includes(String(ev.label||"").toLowerCase());return {ev,score:(amountDiff<=Math.max(10,(+ev.amount||0)*0.05)?3:0)+(dateDiff<=2?2:dateDiff<=5?1:0)+(labelHit?2:0)}}).sort((a,b)=>b.score-a.score)[0];return cand&&cand.score>=4?{eventId:cand.ev.id,monthKey:`${y}-${String(m+1).padStart(2,"0")}`} : null
}

function applyEnvelopeCarryover(month){
  if(!S.settings.envelopeRollover)return;const next=nextMonthKey(month),carry={};for(const cat of Object.keys(S.envelopeLimits||{})){const limit=effectiveEnvelopeLimit(cat,month),spent=monthCategorySpend(cat,month);if(limit>0)carry[cat]=Math.max(0,limit-spent)}S.envelopeCarryovers[next]=carry
}

function plannedIncomeForMonth(){return (S.settings.incomeEvents||[]).reduce((a,x)=>a+(+x.amount||0),0)}

function plannedIncomeToDate(d=new Date()){const today=d.getDate();return (S.settings.incomeEvents||[]).filter(x=>x.day<=today).reduce((a,x)=>a+(+x.amount||0),0)}

function plannedIncomeReceived(ev,y,m){const mk=`${y}-${String(m+1).padStart(2,"0")}`,day=String(Math.min(ev.day,new Date(y,m+1,0).getDate())).padStart(2,"0"),dateKey=`${mk}-${day}`;return S.incomeLogs.filter(x=>{const xmk=x.plannedMonth||String(x.dateKey||"").slice(0,7);if(xmk!==mk)return false;if(x.plannedEventId)return x.plannedEventId===ev.id;if(x.dateKey===dateKey&&String(x.source||"")===String(ev.label||""))return true;const link=matchPlannedIncome(x.dateKey,+x.amount||0,`${x.source||""} ${x.note||""}`);return link?.eventId===ev.id&&link?.monthKey===mk}).reduce((a,x)=>a+(+x.amount||0),0)}

function plannedIncomeForecastAmount(ev,y,m,asOf=new Date()){const planned=Math.max(0,+ev.amount||0);if(!planned)return 0;const last=new Date(y,m+1,0).getDate(),due=new Date(y,m,Math.min(+ev.day||1,last),0,0,0),today=new Date(asOf.getFullYear(),asOf.getMonth(),asOf.getDate(),0,0,0),received=plannedIncomeReceived(ev,y,m);if(received>0)return 0;if(due<today)return 0;return planned}

function planGap(){return (+S.settings.monthlyDebtGoal||0)-(+S.settings.monthlyIncome||0)}

function planWarningHtml(){const g=planGap();if(g<=0)return "";return `<div class="notice income-warn" style="margin-top:10px"><b>План требует ещё ${rub(g)} сверх ожидаемого дохода.</b><br>Чтобы выполнить цель ${rub(S.settings.monthlyDebtGoal)} при плане дохода ${rub(S.settings.monthlyIncome)}, нужен стартовый остаток, дополнительное фактическое поступление или снижение цели.</div>`}

function paymentMatchesDebt(p,i){const d=S.debts[i];return !!d&&((p.debtId&&p.debtId===d.id)||(!p.debtId&&p.debtIndex===i))}
function paymentToDebtMonth(i,month){return S.payments.filter(p=>paymentMatchesDebt(p,i)&&(p.dueMonth||p.monthKey||String(p.date||"").slice(0,7))===month).reduce((a,p)=>a+(+p.amount||0),0)}
function paymentDueMonthForDebt(d,dateKey=localDateKey()){return validDateKey(d?.nextPaymentDate)?d.nextPaymentDate.slice(0,7):String(dateKey||localDateKey()).slice(0,7)}
function advanceDebtScheduleAfterPayment(d,i){if(!d||!validDateKey(d.nextPaymentDate))return;const due=parseLocal(d.nextPaymentDate),mk=localMonthKey(due),required=Math.max(0,+d.nextPaymentAmount||+d.min||0),paid=paymentToDebtMonth(i,mk);if(required>0&&paid+0.01>=required){if(d.paymentMode==="fixed"){d.nextPaymentDate=localDateKey(addMonthsDate(due,1));d.nextPaymentAmount=+d.min||0}else{d.nextPaymentDate="";d.nextPaymentAmount=0}}}

function nextPlannedIncomeDate(from=new Date()){const start=new Date(from.getFullYear(),from.getMonth(),from.getDate(),0,0,0),candidates=[];for(let off=0;off<3;off++){const base=new Date(start.getFullYear(),start.getMonth()+off,1,12),y=base.getFullYear(),m=base.getMonth(),last=new Date(y,m+1,0).getDate();for(const ev of (S.settings.incomeEvents||[])){const dt=new Date(y,m,Math.min(ev.day,last),12),amount=plannedIncomeForecastAmount(ev,y,m,start);if(dt>=start&&amount>0)candidates.push({date:dt,label:ev.label,amount,eventId:ev.id,monthKey:`${y}-${String(m+1).padStart(2,"0")}`})}}return candidates.sort((a,b)=>a.date-b.date)[0]||null}

function cashAdvice(){
  const cash=trackedCash(),next=nextPlannedIncomeDate(),today=new Date();
  const days=next?Math.max(1,daysBetween(today,next.date)):7;
  const living=Math.max(0,days*(+S.settings.dailySpendLimit||0));
  const mandatory=next?mandatoryBefore(next.date):[];
  const mandatorySum=mandatory.reduce((a,x)=>a+x.amount,0);
  const reserve=living+mandatorySum;
  const safe=Math.max(0,cash-reserve);
  const unpaidMins=remainingMinimumsThisMonth();
  const extraNeeded=Math.max(0,S.settings.monthlyDebtGoal-monthPayments()-unpaidMins);
  const recommended=Math.max(0,Math.min(safe,extraNeeded));
  return {cash,next,days,living,mandatory,mandatorySum,reserve,safe,unpaidMins,extraNeeded,recommended};
}

function monthlyLivingBudget(d=new Date()){
  const mk=localMonthKey(d),cats=Object.keys(S.envelopeLimits||{}),envelopeTotal=cats.reduce((a,cat)=>a+effectiveEnvelopeLimit(cat,mk),0);
  return envelopeTotal>0?envelopeTotal:(+S.settings.dailySpendLimit||0)*daysInMonth(d)
}

function remainingLivingBudget(d=new Date()){
  const mk=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;return Math.max(0,monthlyLivingBudget(d)-monthLivingExpenses(mk))
}

function daysLeftInMonth(d=new Date()){return Math.max(1,daysInMonth(d)-d.getDate()+1)}

function dynamicDailyBudget(d=new Date()){
  const calculated=remainingLivingBudget(d)/daysLeftInMonth(d),envelopeTotal=Object.values(S.envelopeLimits||{}).reduce((a,x)=>a+(+x||0),0),base=+S.settings.dailySpendLimit||0;
  return envelopeTotal>0?calculated:Math.min(base,calculated)
}

function emergencyFundGap(){return Math.max(0,(+S.settings.emergencyFundTarget||0)-(+S.settings.emergencyFundBalance||0))}

function miniBufferGap(){return Math.max(0,(+S.settings.miniBufferTarget||0)-(+S.settings.emergencyFundBalance||0))}

function financialPhase(){
  const fund=+S.settings.emergencyFundBalance||0,mini=+S.settings.miniBufferTarget||0,full=+S.settings.emergencyFundTarget||0,high=highestHighInterestDebt();
  if(mini>0&&fund<mini)return {id:"mini_buffer",name:"Мини-буфер",detail:`Сначала довести резерв до ${rub(mini)}.`};
  if(high)return {id:"debt_attack",name:"Атака дорогих долгов",detail:`Приоритет: ${high.name} • ${high.rate}%. Полный резерв пока не наращиваем.`};
  if(full>0&&fund<full)return {id:"full_reserve",name:"Полный резерв",detail:`Дорогих долгов выше ${finiteNumberOr(S.settings.highInterestThreshold,40)}% нет — доводим резерв до ${rub(full)}.`};
  if(totalDebt()>0)return {id:"debt_finish",name:"Добивание долгов",detail:"Минимальный резерв сформирован — свободные деньги направляются в самый дорогой открытый долг."};
  return {id:"debt_free",name:"Долги закрыты",detail:"Можно перенастроить цели резерва и накоплений."}
}

function autopilotPlan(options={}){
  const ignoreReservations=!!options.ignoreReservations,cash=operatingCashBalance(),reserved=ignoreReservations?0:reservedCashTotal(),available=Math.max(0,cash-reserved),next=nextPlannedIncomeDate(),today=new Date(),days=next?Math.max(1,daysBetween(today,next.date)):7;
  const mandatory=next?mandatoryBefore(next.date):overdueMinimums(),alreadyMandatory=ignoreReservations?0:reservationAmount("mandatory"),mandatoryNeed=Math.max(0,mandatory.reduce((a,x)=>a+x.amount,0)-alreadyMandatory);
  const daily=dynamicDailyBudget(),alreadyLiving=ignoreReservations?0:reservationAmount("living"),livingNeed=Math.max(0,Math.min(remainingLivingBudget(),Math.max(0,days*daily))-alreadyLiving);
  const phase=financialPhase();let left=available;
  const mandatoryReserve=Math.min(left,mandatoryNeed);left-=mandatoryReserve;
  const livingReserve=Math.min(left,livingNeed);left-=livingReserve;
  let emergencyNeed=0,emergencyTopUp=0,best=null,debtExtra=0;
  if(phase.id==="mini_buffer"){
    emergencyNeed=Math.max(0,miniBufferGap()-(ignoreReservations?0:reservationAmount("emergency")));emergencyTopUp=Math.min(left,emergencyNeed);left-=emergencyTopUp;best=bestDebt();debtExtra=best?Math.min(left,best.balance):0;left-=debtExtra
  }else if(phase.id==="debt_attack"){
    best=highestHighInterestDebt()||bestDebt();debtExtra=best?Math.min(left,best.balance):0;left-=debtExtra
  }else if(phase.id==="full_reserve"){
    emergencyNeed=Math.max(0,emergencyFundGap()-(ignoreReservations?0:reservationAmount("emergency")));emergencyTopUp=Math.min(left,emergencyNeed);left-=emergencyTopUp;best=bestDebt();debtExtra=best?Math.min(left,best.balance):0;left-=debtExtra
  }else if(phase.id==="debt_finish"){
    best=bestDebt();debtExtra=best?Math.min(left,best.balance):0;left-=debtExtra
  }
  return {cash,reserved,available,next,days,daily,mandatory,mandatoryNeed,mandatoryReserve,livingNeed,livingReserve,emergencyNeed,emergencyTopUp,best,debtExtra,phase,unallocated:Math.max(0,left),shortage:Math.max(0,mandatoryNeed+livingNeed-available)}
}

function releaseActiveReservations(silent=false){let n=0;for(const r of activeReservations()){r.status="released";r.releasedAt=new Date().toISOString();n++}if(!silent&&n===0)toast("Активных резервов нет");return n}

async function acceptAutopilotPlan(){
  if(!primaryCashVerifiedAt()){toast("Сначала сверь текущий денежный баланс");$("cashSyncInput")?.focus();return}
  releaseActiveReservations(true);const p=autopilotPlan({ignoreReservations:true}),planId=uid(),createdAt=new Date().toISOString(),untilDate=p.next?localDateKey(p.next.date):localDateKey(addDays(new Date(),7));let left=p.mandatoryReserve;
  for(const m of p.mandatory){if(left<=0.009)break;const amount=Math.min(left,m.amount);if(amount>0)S.reservations.push({id:uid(),planId,type:"mandatory",label:m.label||m.debt,debtIndex:m.debtIndex??null,regularPaymentId:m.regularPaymentId||null,amount,remaining:amount,createdAt,untilDate,status:"active"});left-=amount}
  if(p.livingReserve>0)S.reservations.push({id:uid(),planId,type:"living",label:"Жизнь до следующего дохода",amount:p.livingReserve,remaining:p.livingReserve,createdAt,untilDate,status:"active"});
  if(p.emergencyTopUp>0)S.reservations.push({id:uid(),planId,type:"emergency",label:"Пополнение резерва",amount:p.emergencyTopUp,remaining:p.emergencyTopUp,createdAt,untilDate,status:"active"});
  if(p.debtExtra>0&&p.best)S.reservations.push({id:uid(),planId,type:"debt",label:`Досрочка: ${p.best.name}`,debtIndex:p.best.i,amount:p.debtExtra,remaining:p.debtExtra,createdAt,untilDate,status:"active"});
  await save("План денег принят — суммы больше не считаются свободными")
}

async function releaseAutopilotPlan(){const n=releaseActiveReservations(true);if(!n){toast("Активных резервов нет");return}await save("Резервы плана освобождены")}

async function syncCashBalance(){const desired=+$("cashSyncInput").value;if(!Number.isFinite(desired)||desired<0){toast("Укажи фактический баланс денег");return}const a=S.accounts.find(x=>x.id===defaultAccountId())||S.accounts[0];a.verifiedBalance=desired;a.verifiedAt=new Date().toISOString();S.settings.cashBalanceVerifiedAt=a.verifiedAt;$("cashSyncInput").value="";audit("Сверка Money Engine","account",`${a.name}: ${rub(desired)}`);await save("Баланс основного счёта подтверждён")}

async function moveEmergencyFund(direction){
  const amount=Math.max(0,+$('emergencyMoveAmount').value||0);if(amount<=0){toast("Укажи сумму перевода");return}
  if(direction==="toFund"){
    const emergencyReserved=reservationAmount("emergency"),available=Math.max(0,freeCashBalance()+emergencyReserved);if(amount>available+0.01){toast(`Доступно для перевода не больше ${rub(available)}`);return}
    const use=consumeReservation("emergency",amount);S.settings.emergencyFundBalance=(+S.settings.emergencyFundBalance||0)+amount;S.fundTransfers.unshift({id:uid(),date:new Date().toISOString(),dateKey:localDateKey(),direction:"toFund",amount,reservationUse:use})
  }else{
    const balance=+S.settings.emergencyFundBalance||0;if(amount>balance+0.01){toast(`В резерве только ${rub(balance)}`);return}S.settings.emergencyFundBalance=Math.max(0,balance-amount);S.fundTransfers.unshift({id:uid(),date:new Date().toISOString(),dateKey:localDateKey(),direction:"fromFund",amount})
  }
  $('emergencyMoveAmount').value="";await save(direction==="toFund"?"Деньги переведены в отдельный резерв":"Деньги возвращены из резерва")
}

function plannedIncomeOnDate(d){const y=d.getFullYear(),m=d.getMonth(),day=d.getDate();let total=0;for(const ev of (S.settings.incomeEvents||[])){const due=Math.min(ev.day,daysInMonth(d));if(due!==day)continue;total+=plannedIncomeForecastAmount(ev,y,m)}return total}

function mandatoryOnDate(d){
  const y=d.getFullYear(),m=d.getMonth(),day=d.getDate(),mk=`${y}-${String(m+1).padStart(2,"0")}`;let total=0;
  S.debts.forEach((debt,i)=>{if(debt.balance<=0)return;const due=Math.min(debt.dueDay,daysInMonth(d));if(due!==day)return;total+=Math.max(0,(+debt.min||0)-paymentToDebtMonth(i,mk))});
  total+=recurringOnDate(d);return total
}

function plannedExtraDebtOnDate(d){const now=new Date(),mk=localMonthKey(d),current=mk===localMonthKey(now),triggerBase=Math.max(...(S.settings.incomeEvents||[]).map(x=>+x.day||1),1),trigger=current&&triggerBase<now.getDate()?now.getDate():triggerBase,day=Math.min(trigger,daysInMonth(d));if(d.getDate()!==day)return 0;const goal=current?Math.max(0,(+S.settings.monthlyDebtGoal||0)-monthPayments(mk)):(+S.settings.monthlyDebtGoal||0),mins=current?remainingMinimumsThisMonth():S.debts.filter(x=>x.balance>0).reduce((a,x)=>a+(+x.min||0),0);return Math.max(0,goal-mins)}

function projectedDailyLiving(d){
  const now=new Date();if(d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth())return dynamicDailyBudget(now);
  const mk=localMonthKey(d),envelopeTotal=Object.keys(S.envelopeLimits||{}).reduce((a,cat)=>a+effectiveEnvelopeLimit(cat,mk),0);return envelopeTotal>0?envelopeTotal/daysInMonth(d):(+S.settings.dailySpendLimit||0)
}

function dailyCashFlow(days=30,mode="safe"){const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12),end=addDays(start,days-1),payments=projectionPaymentEvents(start,end),incomes=incomeEventsBetween(start,end),byPay={},byIncome={};for(const e of payments)byPay[e.dateKey]=(byPay[e.dateKey]||0)+e.amount;for(const e of incomes)byIncome[e.dateKey]=(byIncome[e.dateKey]||0)+e.amount;const rows=[];let balance=operatingCashBalance();for(let i=0;i<days;i++){const d=addDays(start,i),key=localDateKey(d),income=byIncome[key]||0,debt=byPay[key]||0,living=projectedDailyLiving(d),extraDebt=mode==="plan"?plannedExtraDebtOnDate(d):0;balance+=income-debt-living-extraDebt;rows.push({date:d,income,debt,living,extraDebt,balance})}const min=rows.reduce((a,x)=>Math.min(a,x.balance),Infinity),deficit=rows.find(x=>x.balance<0)||null;return {rows,min,deficit,end:rows.at(-1)?.balance??operatingCashBalance(),mode}}

function simulateScenario(monthlyBudget,immediateExtra=0){
  const copy=deepClone(S.debts),i=highestRateDebtIndex();if(i>=0&&immediateExtra>0)copy[i].balance=Math.max(0,copy[i].balance-immediateExtra);return {result:simulateDebt(monthlyBudget,copy),debt:i>=0?S.debts[i]:null}
}

function financeMonthMetrics(month=localMonthKey()){
  const income=monthIncome(month),expenses=monthExpenses(month),livingExpenses=monthLivingExpenses(month),regularExpenses=monthRegularExpenses(month),payments=monthPayments(month),livingBudget=month===localMonthKey()?monthlyLivingBudget():0;
  return {month,income,expenses,livingExpenses,regularExpenses,payments,cash:income-expenses-payments,livingBudget,incomePlan:+S.settings.monthlyIncome||0,debtGoal:+S.settings.monthlyDebtGoal||0,totalDebt:totalDebt(),operatingCash:operatingCashBalance(),reservedCash:reservedCashTotal(),freeCash:freeCashBalance(),emergencyFund:+S.settings.emergencyFundBalance||0}
}

function monthCategorySpend(cat,month=localMonthKey()){return S.expenses.filter(x=>x.dateKey?.startsWith(month)&&x.category===cat&&!x.regularPaymentId).reduce((a,x)=>a+(+x.amount||0),0)}

function plannedIncomeOverDays(days){const start=new Date(),end=addDays(start,days),seen=new Set();let sum=0;for(let i=0;i<=days;i++){const d=addDays(new Date(start.getFullYear(),start.getMonth(),start.getDate(),12),i),k=localDateKey(d);if(k>localDateKey(end)||seen.has(k))continue;seen.add(k);sum+=plannedIncomeOnDate(d)}return sum}

function debtTargetOverDays(days){const now=new Date(),goal=+S.settings.monthlyDebtGoal||0,groups=new Map();for(let i=0;i<days;i++){const d=addDays(new Date(now.getFullYear(),now.getMonth(),now.getDate(),12),i),mk=localMonthKey(d);groups.set(mk,(groups.get(mk)||0)+1)}let total=0;for(const [mk,count] of groups){const [y,m]=mk.split("-").map(Number),dim=new Date(y,m,0).getDate();if(mk===localMonthKey()){const remaining=Math.max(0,goal-monthPayments(mk)),left=daysLeftInMonth(now);total+=remaining*Math.min(1,count/left)}else total+=goal*Math.min(1,count/dim)}return total}

function cashForecast(days){const flow=dailyCashFlow(days,"plan"),income=flow.rows.reduce((a,x)=>a+x.income,0),living=flow.rows.reduce((a,x)=>a+x.living,0),mandatory=flow.rows.reduce((a,x)=>a+x.debt,0);return {income,living,mandatory,debtGoal:debtTargetOverDays(days),net:flow.end}}

function highestRateDebtIndex(){let best=-1;S.debts.forEach((d,i)=>{if(d.balance>0&&(best<0||d.rate>S.debts[best].rate))best=i});return best}

function simulateWithImmediatePayment(amount){const base=simulateDebt(S.settings.monthlyDebtGoal),copy=deepClone(S.debts),i=highestRateDebtIndex();if(i<0)return null;copy[i].balance=Math.max(0,copy[i].balance-Math.max(0,amount));const alt=simulateDebt(S.settings.monthlyDebtGoal,copy);return {base,alt,debt:S.debts[i]}}

function debtById(id){return S.debts.find(d=>d.id===id)}

function debtIndexById(id){return S.debts.findIndex(d=>d.id===id)}

function paymentToDebtThisMonth(i){const m=localMonthKey();return S.payments.filter(p=>p.debtIndex===i&&(p.monthKey||String(p.date||"").slice(0,7))===m).reduce((a,p)=>a+(+p.amount||0),0)}

function incomeScheduleRow(ev={id:uid(),day:1,label:"Доход",amount:0}){return `<div class="income-schedule-row"><input data-income-id type="hidden" value="${escapeHtml(ev.id||uid())}"><div class="field"><label>День</label><input data-income-day type="number" min="1" max="31" value="${ev.day||1}"></div><div class="field"><label>Название</label><input data-income-label value="${escapeHtml(ev.label||"Доход")}"></div><div class="field"><label>Сумма, ₽</label><input data-income-amount type="number" min="0" value="${+ev.amount||0}"></div><button class="btn ghost small" type="button" onclick="removeIncomeScheduleRow(this)">Удалить</button></div>`}

function renderIncomeScheduleEditor(){const box=$("incomeScheduleEditor");if(!box)return;box.innerHTML=(S.settings.incomeEvents||[]).map(incomeScheduleRow).join("");$("incomeScheduleTotal").textContent=rub(plannedIncomeForMonth())}

function addIncomeScheduleRow(){const box=$("incomeScheduleEditor");box.insertAdjacentHTML("beforeend",incomeScheduleRow({id:uid(),day:1,label:"Доход",amount:0}))}

function removeIncomeScheduleRow(btn){btn.closest(".income-schedule-row")?.remove()}

async function saveIncomeSchedule(){const rows=[...document.querySelectorAll("#incomeScheduleEditor .income-schedule-row")],events=rows.map(row=>({id:row.querySelector("[data-income-id]").value||uid(),day:clamp(Math.round(+row.querySelector("[data-income-day]").value||1),1,31),label:row.querySelector("[data-income-label]").value.trim()||"Доход",amount:Math.max(0,+row.querySelector("[data-income-amount]").value||0)})).filter(x=>x.amount>0).sort((a,b)=>a.day-b.day);if(!events.length){toast("Добавь хотя бы одно плановое поступление");return}S.settings.incomeEvents=events;S.settings.monthlyIncome=events.reduce((a,x)=>a+x.amount,0);$("settingIncome").value=S.settings.monthlyIncome;await save("График доходов сохранён")}

function refreshIncomePlanLinks(){const select=$("incomePlanEvent");if(!select)return;const date=$("incomeDate").value||localDateKey(),d=parseLocal(date),y=d.getFullYear(),m=d.getMonth(),mk=`${y}-${String(m+1).padStart(2,"0")}`;select.innerHTML='<option value="">Не связывать с планом</option>'+(S.settings.incomeEvents||[]).map(ev=>`<option value="${mk}|${ev.id}" ${ev.day===d.getDate()?"selected":""}>${ev.day}-е • ${escapeHtml(ev.label)} • ${rub(ev.amount)}</option>`).join("")}

function openIncomeModal(){$("incomeDate").value=localDateKey();refreshIncomePlanLinks();openModal("incomeModal")}

async function addIncome(){const dateKey=$("incomeDate").value||localDateKey(),amount=+$("incomeAmount").value||0;if(!validActivityDate(dateKey)){toast("Фактический доход можно записать только за сегодня или прошедшую дату");return}if(amount<=0){toast("Укажи сумму поступления");return}const link=$("incomePlanEvent")?.value||"",parts=link.split("|"),plannedMonth=parts.length===2?parts[0]:"",plannedEventId=parts.length===2?parts[1]:"",accountId=$("incomeAccount")?.value||defaultAccountId();const x={id:uid(),dateKey,date:`${dateKey}T12:00:00`,createdAt:new Date().toISOString(),amount,accountId,source:$("incomeSource").value,note:$("incomeNote").value.trim(),plannedEventId,plannedMonth};S.incomeLogs.unshift(x);$("incomeAmount").value=$("incomeNote").value="";closeModal("incomeModal");audit("Доход","finance",`${rub(amount)} • ${accountName(accountId)}`);await save(`Поступление ${rub(amount)} сохранено`)}

async function deleteIncome(id){const i=S.incomeLogs.findIndex(x=>x.id===id);if(i<0)return;const x=S.incomeLogs[i];adjustImportCompensationOnDelete(x);trashPush("income",x);S.incomeLogs.splice(i,1);await save("Поступление удалено") }

async function addExpense(){const amount=+$("expenseAmount").value||0;if(amount<=0){toast("Укажи сумму");return}const regularPaymentId=$("expenseRegularPayment")?.value||"",r=S.regularPayments.find(x=>x.id===regularPaymentId),reservationUse=r?consumeReservation("mandatory",amount,null,r.id):consumeReservation("living",amount),accountId=$("expenseAccount")?.value||defaultAccountId(),x={id:uid(),dateKey:localDateKey(),date:new Date().toISOString(),amount,accountId,category:r?.category||$("expenseCategory").value,note:$("expenseNote").value.trim(),regularPaymentId:r?.id||"",reservationUse};S.expenses.unshift(x);if(!dailyQuestState("expenses")){S.checks[localDateKey()]=S.checks[localDateKey()]||{};S.checks[localDateKey()].expenses=true;const q=DAILY_QUESTS.find(q=>q.id==="expenses");addXp(q.xp,q.stat,q.title,`daily:${localDateKey()}:expenses`)}$("expenseAmount").value=$("expenseNote").value="";if($("expenseRegularPayment"))$("expenseRegularPayment").value="";closeModal("expenseModal");audit("Расход","finance",`${rub(amount)} • ${x.category} • ${accountName(accountId)}`);await save("Расход сохранён")}

async function deleteExpense(id){const i=S.expenses.findIndex(x=>x.id===id);if(i<0)return;const x=S.expenses[i];restoreReservationUse(x.reservationUse);adjustImportCompensationOnDelete(x);trashPush("expense",x);S.expenses.splice(i,1);await save("Расход удалён")}

function paymentLockedBySync(p){const pTs=Date.parse(p.date||`${p.localDate||""}T00:00:00`)||0,pDebtId=p.debtId||S.debts[p.debtIndex]?.id||"";return S.balanceHistory.some(h=>{if(h.type!=="sync")return false;const hDebtId=h.debtId||S.debts[h.debtIndex]?.id||"";if(pDebtId&&hDebtId&&pDebtId!==hDebtId)return false;const hTs=Date.parse(h.ts||`${h.date||""}T23:59:59`)||0;return hTs>=pTs})}

function recordDebtBalanceCheckpoint(d,i,source="sync",ts=new Date().toISOString()){if(!d)return "";d.balanceVerifiedAt=ts;d.balanceVerificationSource=source;S.balanceHistory.push({id:uid(),date:localDateKey(new Date(ts)),ts,total:totalDebt(),type:"sync",source,debtIndex:i,debtId:d.id,balance:+d.balance||0});return ts}
async function syncBalance(){const i=+$("syncDebt").value,b=+$("syncBalanceInput").value;if(!Number.isFinite(b)||b<0){toast("Укажи корректный остаток");return}const d=S.debts[i];if(!d){toast("Долг не найден");return}d.balance=b;recordDebtBalanceCheckpoint(d,i,"manual_sync");$("syncBalanceInput").value="";closeModal("syncModal");await save("Остаток синхронизирован")}

function projectedDate(months){if(!Number.isFinite(months))return "не сходится";const d=new Date();d.setMonth(d.getMonth()+months);return d.toLocaleDateString("ru-RU",{month:"long",year:"numeric"})}

function nextDebtEvent(){return financialEvents().find(x=>x.type==="payment")}

function priorMonthKeys(n=3){const out=[];const d=new Date();for(let i=1;i<=n;i++){const x=new Date(d.getFullYear(),d.getMonth()-i,1,12);out.push(localMonthKey(x))}return out}

function smartBudgetSuggestions(){const months=priorMonthKeys(3),cats=Object.keys(S.envelopeLimits||{}),hasPast=months.some(m=>monthLivingExpenses(m)>0);const use=hasPast?months:[localMonthKey()];const out={};for(const cat of cats){const vals=use.map(m=>monthCategorySpend(cat,m)).filter(v=>v>0);const avg=vals.length?vals.reduce((a,x)=>a+x,0)/vals.length:(+S.envelopeLimits[cat]||0);out[cat]=avg>0?Math.ceil(avg*1.05/500)*500:0}return out}

function applySmartBudget(){const s=smartBudgetSuggestions();for(const [k,v] of Object.entries(s))if(v>0)S.envelopeLimits[k]=v;audit("Smart Budget","finance","Применены рекомендованные лимиты");save("Умный бюджет применён")}

function renderSmartBudget(){const box=$("smartBudget");if(!box)return;const s=smartBudgetSuggestions();box.innerHTML=Object.entries(s).map(([k,v])=>`<div class="envelope"><div class="envelope-top"><span>${escapeHtml(k)}</span><span>сейчас ${rub(S.envelopeLimits[k]||0)} → <b>${rub(v)}</b></span></div></div>`).join("")+'<button class="btn secondary" style="margin-top:12px" onclick="applySmartBudget()">Применить рекомендации</button>'}

function regularCategoryOptions(selected="Другое"){return Object.keys(S.envelopeLimits||{}).map(x=>`<option ${x===selected?"selected":""}>${escapeHtml(x)}</option>`).join("")}

async function addRegularPayment(){
  const name=$("regularName").value.trim(),amount=Math.max(0,+$("regularAmount").value||0),dueDay=clamp(Math.round(+$("regularDueDay").value||1),1,31),category=$("regularCategory").value||"Другое",keywords=$("regularKeywords").value.trim(),mandatory=$("regularMandatory").checked;if(!name||amount<=0){toast("Укажи название и сумму");return}
  S.regularPayments.push({id:uid(),name,amount,dueDay,category,keywords,mandatory,active:true,createdAt:new Date().toISOString()});$("regularName").value=$("regularAmount").value=$("regularKeywords").value="";await save("Регулярный платёж добавлен")
}

async function deleteRegularPayment(id){if(!confirm("Удалить регулярный платёж из плана? История расходов останется."))return;S.regularPayments=S.regularPayments.filter(x=>x.id!==id);await save("Регулярный платёж удалён")}

async function payRegularPayment(id){const r=S.regularPayments.find(x=>x.id===id);if(!r)return;const amount=regularRemaining(r);if(amount<=0){toast("Платёж уже закрыт в этом месяце");return}const reservationUse=consumeReservation("mandatory",amount,null,r.id);S.expenses.unshift({id:uid(),dateKey:localDateKey(),date:new Date().toISOString(),amount,category:r.category||"Другое",note:`Регулярный платёж: ${r.name}`,regularPaymentId:r.id,reservationUse});await save(`${r.name}: ${rub(amount)} записано`)}

function renderRegularPayments(){
  if(!$("regularPaymentList"))return;$("regularCategory").innerHTML=regularCategoryOptions($("regularCategory").value||"Дом");const mk=localMonthKey(),rows=activeRegularPayments().slice().sort((a,b)=>a.dueDay-b.dueDay);$("regularPaymentList").innerHTML=rows.length?rows.map(r=>{const paid=regularPaidAmount(r,mk),rem=regularRemaining(r,mk);return `<div class="regular-row"><div><b>${escapeHtml(r.name)}</b><div class="qmeta">${r.dueDay}-е • ${escapeHtml(r.category||"Другое")} • ${r.mandatory===false?"плановый":"обязательный"}${r.keywords?` • ключи: ${escapeHtml(r.keywords)}`:""}</div></div><div class="right"><b>${rub(r.amount)}</b><div class="${rem<=0?"income-good":"sub"}">${rem<=0?"оплачено":`осталось ${rub(rem)}`}</div></div><div class="split"><button class="btn ${rem>0?"secondary":"ghost"} small" onclick="payRegularPayment('${r.id}')" ${rem<=0?"disabled":""}>Записать оплату</button><button class="btn ghost small" onclick="deleteRegularPayment('${r.id}')">Удалить</button></div></div>`}).join(""):'<div class="empty">Добавь аренду, связь, подписки и другие повторяющиеся обязательства.</div>'
}

function refreshExpenseRegularOptions(){if(!$("expenseRegularPayment"))return;$("expenseRegularPayment").innerHTML='<option value="">Обычный расход</option>'+activeRegularPayments().map(r=>`<option value="${r.id}">${escapeHtml(r.name)} • ${rub(r.amount)}</option>`).join("")}

function onExpenseRegularChange(){const id=$("expenseRegularPayment").value,r=S.regularPayments.find(x=>x.id===id);if(r){$("expenseCategory").value=r.category||"Другое";if(!+$('expenseAmount').value)$('expenseAmount').value=regularRemaining(r)||r.amount;$('expenseNote').value=$('expenseNote').value||r.name}}

function renderMoneyEngine(){
  const actual=operatingCashBalance(),reserved=reservedCashTotal(),free=freeCashBalance(),fund=+S.settings.emergencyFundBalance||0,verified=primaryCashVerifiedAt()?new Date(primaryCashVerifiedAt()).toLocaleString("ru-RU"):"не сверялся";
  $("moneyEngineSummary").innerHTML=`<div class="money-balance-grid"><div class="money-balance"><div class="smallcaps">На счетах / наличные</div><b>${rub(actual)}</b></div><div class="money-balance"><div class="smallcaps">Зарезервировано</div><b>${rub(reserved)}</b></div><div class="money-balance"><div class="smallcaps">Свободно</div><b class="${free>=0?"income-good":"income-bad"}">${rub(free)}</b></div><div class="money-balance"><div class="smallcaps">Отдельный резерв</div><b>${rub(fund)}</b></div></div><div class="sub" style="margin-top:9px">Последняя сверка денежного баланса: ${verified}. Резерв хранится отдельно и не считается свободными деньгами.</div>`;
  if(!primaryCashVerifiedAt())$("moneyEngineWarning").innerHTML='<div class="notice"><b>Нужна первичная сверка.</b> Введи фактическую сумму денег на обычных счетах и наличными. После этого автопилот сможет фиксировать распределение без двойного использования денег.</div>';else $("moneyEngineWarning").innerHTML=""
}

function renderIncomeFlow(){
  const actual=monthIncome(),planned=S.settings.monthlyIncome||plannedIncomeForMonth(),toDate=plannedIncomeToDate(),monthNet=trackedCash(),cash=operatingCashBalance();
  $("incomeSummary").innerHTML=`<div class="goal"><div class="goal-top"><span>Факт поступлений</span><b>${rub(actual)}</b></div><div class="goal-top" style="margin-top:7px"><span>План месяца</span><b>${rub(planned)}</b></div><div class="goal-top" style="margin-top:7px"><span>План к сегодняшней дате</span><b>${rub(toDate)}</b></div><div class="goal-top" style="margin-top:7px"><span>Чистый поток месяца</span><b class="${monthNet>=0?"income-good":"income-bad"}">${rub(monthNet)}</b></div><div class="goal-top" style="margin-top:7px"><span>Реальный учётный баланс</span><b class="${cash>=0?"income-good":"income-bad"}">${rub(cash)}</b></div></div>${planWarningHtml()}<div class="sub" style="margin-top:8px">Баланс переносится между месяцами: все поступления − все расходы − все платежи по долгам ± сверки − переводы в отдельный резерв.</div>`;
  const arr=S.incomeLogs.filter(x=>x.dateKey?.startsWith(localMonthKey())).slice(0,10);$("incomeHistory").innerHTML=arr.length?arr.map(x=>`<div class="log-item"><div class="qtitle">${fmtDate(parseLocal(x.dateKey))} • ${escapeHtml(x.source)} • +${rub(x.amount)}</div>${x.note?`<div class="qmeta">${escapeHtml(x.note)}</div>`:""}<button class="btn ghost small" style="margin-top:7px" onclick="deleteIncome('${x.id}')">Удалить</button></div>`).join(""):'<div class="empty">Поступлений за месяц ещё не записано.</div>'
}

function renderCashAdvisor(){
  const p=autopilotPlan(),nextText=p.next?`${fmtDate(p.next.date)} • ${escapeHtml(p.next.label)} • ${rub(p.next.amount)}`:"нет в расписании",best=p.best;
  const mandatoryText=p.mandatory.length?p.mandatory.map(x=>`${escapeHtml(x.debt)} — ${rub(x.amount)} до ${fmtDate(x.date)}`).join("<br>"):"до следующего дохода обязательных платежей нет";
  const headline=p.debtExtra>0?rub(p.debtExtra):"0 ₽",cls=p.debtExtra>0?"income-good":"income-warn";
  $("cashAdvisor").innerHTML=`<div class="cash-advisor"><div class="smallcaps">Новая свободная досрочка</div><div class="cash-number ${cls}">${headline}</div><div class="muted">${best?`в ${escapeHtml(best.name)} (${best.rate}%)`:"долги закрыты"}</div><div class="cash-lines"><div class="cash-line"><span>Деньги сейчас</span><b>${rub(p.cash)}</b></div><div class="cash-line"><span>Уже зарезервировано</span><b>${rub(p.reserved)}</b></div><div class="cash-line"><span>Свободно до нового плана</span><b>${rub(p.available)}</b></div><div class="cash-line"><span>Финансовая фаза</span><b>${escapeHtml(p.phase.name)}</b></div><div class="cash-line"><span>Следующее поступление</span><b>${nextText}</b></div></div></div><div class="notice" style="margin-top:10px">${mandatoryText}</div>`
}

function renderAutopilot(){
  const p=autopilotPlan(),next=p.next?`${fmtDate(p.next.date)} • ${escapeHtml(p.next.label)}`:"нет в расписании",best=p.best?`${escapeHtml(p.best.name)} • ${p.best.rate}%`:"долги закрыты",r=reservationBreakdown(),hasActive=r.total>0;
  const shortage=p.shortage>0?`<div class="notice" style="margin-top:10px"><b>Не хватает ${rub(p.shortage)}</b> для обязательных платежей и резерва жизни до следующего дохода.</div>`:"";
  const accepted=hasActive?`<div class="accepted-plan"><div class="smallcaps">Принятый план</div><div class="report-grid" style="margin-top:8px"><div class="report-item"><span>Обязательные</span><b>${rub(r.mandatory)}</b></div><div class="report-item"><span>Жизнь</span><b>${rub(r.living)}</b></div><div class="report-item"><span>В резерв</span><b>${rub(r.emergency)}</b></div><div class="report-item"><span>Досрочка</span><b>${rub(r.debt)}</b></div></div></div>`:"";
  $("autopilotPlan").innerHTML=`<div class="phase-box"><span class="tag good">${escapeHtml(p.phase.name)}</span><b>${escapeHtml(p.phase.detail)}</b></div>${accepted}<div class="autopilot-grid"><div class="autopilot-step"><span>1</span><div><div class="smallcaps">Новый резерв обязательных</div><b>${rub(p.mandatoryReserve)}</b><div class="sub">ещё нужно ${rub(p.mandatoryNeed)}</div></div></div><div class="autopilot-step"><span>2</span><div><div class="smallcaps">Новый резерв жизни</div><b>${rub(p.livingReserve)}</b><div class="sub">${p.days} дн. • ${rub(p.daily)}/день</div></div></div><div class="autopilot-step"><span>3</span><div><div class="smallcaps">Новый резерв буфера</div><b>${rub(p.emergencyTopUp)}</b><div class="sub">отдельный кошелёк</div></div></div><div class="autopilot-step featured"><span>4</span><div><div class="smallcaps">Новая досрочка</div><b class="income-good">${rub(p.debtExtra)}</b><div class="sub">${best}</div></div></div></div><div class="goal"><div class="goal-top"><span>Деньги сейчас</span><b>${rub(p.cash)}</b></div><div class="goal-top" style="margin-top:7px"><span>Уже зарезервировано</span><b>${rub(p.reserved)}</b></div><div class="goal-top" style="margin-top:7px"><span>Свободно до нового плана</span><b>${rub(p.available)}</b></div><div class="goal-top" style="margin-top:7px"><span>Следующий доход</span><b>${next}</b></div></div>${shortage}`;
  $("autopilotAcceptBtn").disabled=!primaryCashVerifiedAt()||p.available<=0;$("autopilotReleaseBtn").disabled=!hasActive;$("autopilotPayBtn").disabled=!(reservationAmount("debt")>0||p.debtExtra>0)
}

function prepareAutopilotPayment(){const debtReservation=activeReservations().find(x=>x.type==="debt"&&x.remaining>0.009);if(debtReservation){$("payDebt").value=String(debtReservation.debtIndex);$("payAmount").value=Math.floor(debtReservation.remaining);openModal("paymentModal");return}const p=autopilotPlan();if(!p.best||p.debtExtra<=0){toast("Сейчас свободная досрочка не рассчитана");return}const i=p.best.i??S.debts.indexOf(p.best);$("payDebt").value=String(i);$("payAmount").value=Math.floor(p.debtExtra);openModal("paymentModal")}

function renderDynamicBudget(){
  const budget=monthlyLivingBudget(),spent=monthExpenses(),remaining=Math.max(0,budget-spent),days=daysLeftInMonth(),daily=dynamicDailyBudget(),source=Object.values(S.envelopeLimits||{}).some(x=>+x>0)?"по лимитам конвертов":"по дневному резерву";
  $("dynamicBudget").innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Бюджет жизни</div><b>${rub(budget)}</b><div class="sub">${source}</div></div><div class="report-item"><div class="smallcaps">Потрачено</div><b>${rub(spent)}</b></div><div class="report-item"><div class="smallcaps">Осталось</div><b>${rub(remaining)}</b></div><div class="report-item"><div class="smallcaps">Безопасно / день</div><b class="${daily>0?"income-good":"income-bad"}">${rub(daily)}</b><div class="sub">${days} дн. до конца месяца</div></div></div>`
}

function renderDailyCashFlow(){
  const safe=dailyCashFlow(30,"safe"),plan=dailyCashFlow(30,"plan"),rows=safe.rows,W=900,H=190,pad=18,vals=[...safe.rows,...plan.rows].map(x=>x.balance),min=Math.min(0,...vals),max=Math.max(1,...vals),span=max-min||1;
  const makePath=rs=>rs.map((x,i)=>`${i?"L":"M"}${(pad+(W-2*pad)*i/Math.max(1,rs.length-1)).toFixed(1)},${(H-pad-(H-2*pad)*(x.balance-min)/span).toFixed(1)}`).join(" ");
  $("cashFlowChart").innerHTML=`<line x1="${pad}" y1="${H-pad-(H-2*pad)*(0-min)/span}" x2="${W-pad}" y2="${H-pad-(H-2*pad)*(0-min)/span}" stroke="#44536a" stroke-dasharray="6 6"/><path d="${makePath(safe.rows)}" fill="none" stroke="#22d3ee" stroke-width="4"/><path d="${makePath(plan.rows)}" fill="none" stroke="#8b5cf6" stroke-width="3" stroke-dasharray="7 5"/>`;
  const eventRows=plan.rows.filter(x=>x.income>0||x.debt>0||x.extraDebt>0).slice(0,10);$("cashFlowEvents").innerHTML=eventRows.length?eventRows.map(x=>`<div class="cashflow-event"><span>${fmtDate(x.date)}</span><div>${x.income?`<span class="income-good">+${rub(x.income)}</span>`:""}${x.debt?` <span class="income-bad">−${rub(x.debt)} обяз.</span>`:""}${x.extraDebt?` <span class="income-warn">−${rub(x.extraDebt)} план</span>`:""}</div><b class="${x.balance>=0?"":"income-bad"}">${rub(x.balance)}</b></div>`).join(""):'<div class="empty">В ближайшие 30 дней нет плановых финансовых событий.</div>';
  $("cashFlowSummary").innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Безопасный • 30 дней</div><b class="${safe.end>=0?"income-good":"income-bad"}">${rub(safe.end)}</b><div class="sub">обязательные долги + регулярные платежи + жизнь</div></div><div class="report-item"><div class="smallcaps">Плановый • 30 дней</div><b class="${plan.end>=0?"income-good":"income-bad"}">${rub(plan.end)}</b><div class="sub">включая цель ${rub(S.settings.monthlyDebtGoal)}/мес.</div></div></div><div class="legend"><span><i class="dot" style="background:#22d3ee"></i>безопасный</span><span><i class="dot" style="background:#8b5cf6"></i>плановый</span></div>${safe.deficit?`<div class="notice" style="margin-top:10px">Даже обязательный сценарий уходит ниже нуля ${fmtDate(safe.deficit.date)} примерно на ${rub(Math.abs(safe.deficit.balance))}.</div>`:plan.deficit?`<div class="notice" style="margin-top:10px">Обязательные расходы укладываются, но план погашения создаёт кассовый разрыв ${fmtDate(plan.deficit.date)}. Нужно увеличить доход, снизить траты или скорректировать темп долгов.</div>`:'<div class="status" style="margin-top:10px">В обоих сценариях кассового разрыва в ближайшие 30 дней не видно.</div>'}`
}

async function saveEmergencyFund(){S.settings.miniBufferTarget=Math.max(0,+$("miniBufferTarget").value||0);S.settings.emergencyFundTarget=Math.max(0,+$("emergencyTarget").value||0);S.settings.emergencyFundBalance=Math.max(0,+$("emergencyBalance").value||0);S.settings.highInterestThreshold=Math.max(0,finiteNumberOr($("highInterestThreshold")?.value,40));await save("Параметры финансовой фазы сохранены")}

function renderEmergencyFund(){if(!$("emergencyTarget"))return;$("miniBufferTarget").value=+S.settings.miniBufferTarget||0;$("emergencyTarget").value=+S.settings.emergencyFundTarget||0;$("emergencyBalance").value=+S.settings.emergencyFundBalance||0;$("highInterestThreshold").value=finiteNumberOr(S.settings.highInterestThreshold,40);const target=+S.settings.emergencyFundTarget||0,balance=+S.settings.emergencyFundBalance||0,mini=+S.settings.miniBufferTarget||0,pctv=target>0?clamp(balance/target*100,0,100):0,phase=financialPhase(),reserved=reservationAmount("emergency");$("emergencyProgress").innerHTML=`<div class="goal"><div class="goal-top"><span>Текущий резерв</span><b>${rub(balance)}</b></div><div class="goal-top" style="margin-top:7px"><span>Мини-буфер</span><b>${rub(mini)}</b></div><div class="goal-top" style="margin-top:7px"><span>Зарезервировано на перевод</span><b>${rub(reserved)}</b></div><div class="goal-top" style="margin-top:7px"><span>Фаза</span><b>${escapeHtml(phase.name)}</b></div>${target>0?`<div class="progress green" style="margin-top:9px"><i style="width:${pctv}%"></i></div>`:""}</div><div class="sub" style="margin-top:8px">Фактический остаток резерва считается отдельным кошельком и не входит в свободные деньги.</div>`}

function setWhatIf(extra){$("whatIfExtra").value=extra;calcScenarioLab()}

function calcScenarioLab(){
  if(!$("whatIfMonthly"))return;const extra=Math.max(0,+$("whatIfExtra").value||0),monthly=Math.max(1,+$("whatIfMonthly").value||S.settings.monthlyDebtGoal),base=simulateScenario(S.settings.monthlyDebtGoal,0),alt=simulateScenario(monthly,extra),b=base.result,a=alt.result;
  const saved=Number.isFinite(b.interest)&&Number.isFinite(a.interest)?b.interest-a.interest:0,months=Number.isFinite(b.months)&&Number.isFinite(a.months)?b.months-a.months:0;
  const minRequired=S.debts.filter(d=>d.balance>0).reduce((sum,d)=>sum+(+d.min||0),0),warning=monthly<minRequired?`<div class="notice" style="margin-top:10px">Сценарий ${rub(monthly)}/мес. ниже текущей суммы минимальных платежей ${rub(minRequired)}. Такой бюджет может привести к невыполнению обязательных платежей.</div>`:"";
  $("scenarioLabResult").innerHTML=`<div class="compare-grid"><div class="compare-card"><div class="smallcaps">Текущий сценарий</div><b>${rub(S.settings.monthlyDebtGoal)}/мес.</b><div class="sub">${Number.isFinite(b.months)?`${b.months} мес. • ${projectedDate(b.months)}`:"не сходится"}<br>проценты ≈ ${Number.isFinite(b.interest)?rub(b.interest):"—"}</div></div><div class="compare-card"><div class="smallcaps">Новый сценарий</div><b>${rub(monthly)}/мес. + ${rub(extra)} сейчас</b><div class="sub">${Number.isFinite(a.months)?`${a.months} мес. • ${projectedDate(a.months)}`:"не сходится"}<br>проценты ≈ ${Number.isFinite(a.interest)?rub(a.interest):"—"}</div></div></div><div class="goal"><div class="goal-top"><span>Разница процентов</span><b class="${saved>=0?"income-good":"income-bad"}">${saved>=0?"экономия ":"дороже на "}${rub(Math.abs(saved))}</b></div><div class="goal-top" style="margin-top:7px"><span>Разница срока</span><b>${months>0?`быстрее на ${months} мес.`:months<0?`дольше на ${Math.abs(months)} мес.`:"без изменения полного месяца"}</b></div><div class="goal-top" style="margin-top:7px"><span>Первый приоритет</span><b>${alt.debt?`${escapeHtml(alt.debt.name)} • ${alt.debt.rate}%`:"—"}</b></div></div>${warning}`
}

function financeCloseAnalysis(m){const issues=[];if(m.income<m.incomePlan)issues.push(`доход ниже плана на ${rub(m.incomePlan-m.income)}`);if(m.livingBudget>0&&m.expenses>m.livingBudget)issues.push(`расходы выше бюджета на ${rub(m.expenses-m.livingBudget)}`);if(m.payments<m.debtGoal)issues.push(`в долги направлено на ${rub(m.debtGoal-m.payments)} меньше цели`);return issues.length?issues.join("; "):"ключевые финансовые показатели в рамках заданного плана"}

async function closeFinanceMonth(){
  const now=new Date(),m=financeMonthMetrics(),last=daysInMonth(now);if(now.getDate()<last&&!confirm(`До конца месяца ещё ${last-now.getDate()} дн. Зафиксировать промежуточный итог?`))return;
  if(now.getDate()>=last)applyEnvelopeCarryover(m.month);const entry={...m,id:uid(),closedAt:new Date().toISOString(),analysis:financeCloseAnalysis(m),rolloverApplied:now.getDate()>=last&&S.settings.envelopeRollover!==false};const i=S.financeClosures.findIndex(x=>x.month===m.month);if(i>=0)S.financeClosures[i]=entry;else S.financeClosures.unshift(entry);await save("Финансовый итог месяца зафиксирован")
}

function renderFinanceClosures(){
  const m=financeMonthMetrics(),analysis=financeCloseAnalysis(m);$("financeMonthClose").innerHTML=`<div class="goal"><div class="goal-top"><span>Доход</span><b>${rub(m.income)} / ${rub(m.incomePlan)}</b></div><div class="goal-top" style="margin-top:7px"><span>Расходы</span><b>${rub(m.expenses)} / ${rub(m.livingBudget)}</b></div><div class="goal-top" style="margin-top:7px"><span>В долги</span><b>${rub(m.payments)} / ${rub(m.debtGoal)}</b></div><div class="goal-top" style="margin-top:7px"><span>Деньги сейчас</span><b>${rub(m.operatingCash)}</b></div><div class="goal-top" style="margin-top:7px"><span>Свободно</span><b>${rub(m.freeCash)}</b></div></div><div class="status" style="margin-top:10px">${escapeHtml(analysis)}</div>`;
  $("financeClosureHistory").innerHTML=S.financeClosures.length?S.financeClosures.slice(0,6).map(x=>`<div class="log-item"><div class="qtitle">${escapeHtml(x.month)} • ${rub(x.payments)} в долги</div><div class="qmeta">доход ${rub(x.income)} • жизнь ${rub(x.expenses)} • поток ${rub(x.cash)}</div>${x.operatingCash!=null?`<div class="qmeta">деньги ${rub(x.operatingCash)} • свободно ${rub(x.freeCash||0)} • резерв ${rub(x.emergencyFund||0)}</div>`:""}<div class="sub" style="margin-top:4px">${escapeHtml(x.analysis||"")}</div></div>`).join(""):'<div class="empty">Закрытых финансовых месяцев пока нет.</div>'
}

function openEnvelopeEditor(){
  $("envelopeEditor").innerHTML=Object.keys(S.envelopeLimits).map(cat=>`<div class="field"><label>${escapeHtml(cat)}, ₽/мес.</label><input data-envelope="${escapeHtml(cat)}" type="number" min="0" value="${+S.envelopeLimits[cat]||0}"></div>`).join("");$("envelopeRollover").checked=S.settings.envelopeRollover!==false;openModal("envelopeModal")
}

async function saveEnvelopeLimits(){document.querySelectorAll("[data-envelope]").forEach(el=>S.envelopeLimits[el.dataset.envelope]=Math.max(0,+el.value||0));S.settings.envelopeRollover=!!$("envelopeRollover").checked;closeModal("envelopeModal");await save("Лимиты конвертов сохранены")}

function renderEnvelopes(){
  const mk=localMonthKey();$("envelopeList").innerHTML=Object.entries(S.envelopeLimits).map(([cat,base])=>{const carry=envelopeCarry(cat,mk),lim=effectiveEnvelopeLimit(cat,mk),spent=monthCategorySpend(cat),pctv=lim>0?clamp(spent/lim*100,0,150):0;return `<div class="envelope"><div class="envelope-top"><b>${escapeHtml(cat)}</b><span>${rub(spent)}${lim>0?` / ${rub(lim)}`:" • лимит не задан"}</span></div>${carry>0?`<div class="qmeta">перенесено с прошлого месяца: +${rub(carry)}</div>`:""}${lim>0?`<div class="progress ${pctv>100?"warn":"ok"}" style="margin-top:8px"><i style="width:${Math.min(100,pctv)}%"></i></div>`:""}</div>`}).join("")
}

function renderCashForecast(){const rows=[30,60,90].map(days=>[days,cashForecast(days)]);$("cashForecast").innerHTML=`<div class="forecast-grid">${rows.map(([d,x])=>`<div class="forecast-card"><div class="smallcaps">${d} дней</div><b class="${x.net>=0?"income-good":"income-bad"}">${rub(x.net)}</b><div class="sub">доход ${rub(x.income)}<br>жизнь ${rub(x.living)}<br>обязательные ${rub(x.mandatory)}<br>цель долгов ${rub(x.debtGoal)}</div></div>`).join("")}</div>`}

function calcExtraSavings(){if($("whatIfExtra"))calcScenarioLab()}

function renderFinanceMonthlyReport(){const r=currentMonthReport(),ratio=r.income>0?(r.payments/r.income*100):0,budget=monthlyLivingBudget(),living=monthLivingExpenses(),regular=monthRegularExpenses(),safeDaily=dynamicDailyBudget();$("financeMonthlyReport").innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Доход</div><b>${rub(r.income)}</b></div><div class="report-item"><div class="smallcaps">В долги</div><b>${rub(r.payments)}</b></div><div class="report-item"><div class="smallcaps">Переменные расходы</div><b>${rub(living)} / ${rub(budget)}</b></div><div class="report-item"><div class="smallcaps">Регулярные платежи</div><b>${rub(regular)}</b></div><div class="report-item"><div class="smallcaps">Поток месяца</div><b class="${r.cash>=0?"income-good":"income-bad"}">${rub(r.cash)}</b></div><div class="report-item"><div class="smallcaps">Деньги сейчас</div><b>${rub(operatingCashBalance())}</b></div><div class="report-item"><div class="smallcaps">Свободно</div><b class="${freeCashBalance()>=0?"income-good":"income-bad"}">${rub(freeCashBalance())}</b></div><div class="report-item"><div class="smallcaps">Безопасно / день</div><b>${rub(safeDaily)}</b></div></div>`}

function renderFinanceCalendar(){$("financeCalendar").innerHTML=financialEvents().map(e=>`<div class="event ${e.type}"><div class="date">${fmtDate(e.date)}</div><div><b>${escapeHtml(e.label)}</b><div class="sub">${e.type==="income"?"ожидаемое поступление":e.kind==="regular"?(e.overdue?'<span class="income-bad">просрочено • регулярный платёж</span>':"регулярный платёж"):(e.overdue?'<span class="income-bad">просрочено • остаток минимума</span>':"остаток обязательного платежа")}</div></div><b>${e.type==="income"?"+":"−"}${rub(e.amount)}</b></div>`).join("")||'<div class="empty">Ближайших финансовых событий нет.</div>'}

function renderScenarios(){if(totalDebt()<=0){$("scenarioList").innerHTML='<div class="empty">Добавьте актуальные долги в Debt Engine — после этого появятся сценарии погашения.</div>';$("interestCurrent").textContent="—";$("interestSaved").textContent="—";return}const goal=Math.max(1,+S.settings.monthlyDebtGoal||1),budgets=[110000,130000,goal].filter((x,i,a)=>a.indexOf(x)===i).sort((a,b)=>a-b),base=simulateDebt(110000);$("scenarioList").innerHTML=budgets.map(b=>{const r=simulateDebt(b),save=Math.max(0,base.interest-r.interest);return `<div class="scenario"><div><b>${rub(b)}/мес.</b><div class="sub">${Number.isFinite(r.months)?`${r.months} мес. • ${projectedDate(r.months)}`:"не сходится"}</div></div><div class="hide-mobile">проценты <b>${Number.isFinite(r.interest)?rub(r.interest):"—"}</b></div><div class="hide-mobile">экономия <b>${b===110000?"—":rub(save)}</b></div><span class="tag ${b===goal?"good":""}">${b===goal?"текущий":"сценарий"}</span></div>`}).join("");const cur=simulateDebt(goal);$("interestCurrent").textContent=Number.isFinite(cur.interest)?rub(cur.interest):"—";$("interestSaved").textContent=Number.isFinite(cur.interest)?rub(Math.max(0,base.interest-cur.interest)):"—"}

function renderExpenses(){const total=monthExpenses(),living=monthLivingExpenses(),regular=monthRegularExpenses(),actual=monthIncome(),paid=monthPayments(),left=actual-total-paid;$("expenseSummary").innerHTML=`<div class="goal"><div class="goal-top"><span>Фактически пришло</span><b>${rub(actual)}</b></div><div class="goal-top" style="margin-top:7px"><span>Ушло в долги</span><b>${rub(paid)}</b></div><div class="goal-top" style="margin-top:7px"><span>Переменные расходы</span><b>${rub(living)}</b></div><div class="goal-top" style="margin-top:7px"><span>Регулярные платежи</span><b>${rub(regular)}</b></div><div class="goal-top" style="margin-top:7px"><span>Всего расходов</span><b>${rub(total)}</b></div><div class="goal-top" style="margin-top:7px"><span>Поток месяца</span><b style="color:${left>=0?'#a7f3d0':'#fecdd3'}">${rub(left)}</b></div><div class="goal-top" style="margin-top:7px"><span>Свободные деньги сейчас</span><b>${rub(freeCashBalance())}</b></div></div>`;$("expenseHistory").innerHTML=S.expenses.length?S.expenses.filter(x=>x.dateKey.startsWith(localMonthKey())).slice(0,8).map(x=>`<div class="log-item"><div class="qtitle">${fmtDate(parseLocal(x.dateKey))} • ${escapeHtml(x.category)} • ${rub(x.amount)}</div>${x.regularPaymentId?'<span class="tag">регулярный</span>':''}${x.note?`<div class="qmeta">${escapeHtml(x.note)}</div>`:""}<button class="btn ghost small" style="margin-top:7px" onclick="deleteExpense('${x.id}')">Удалить</button></div>`).join(""):'<div class="empty">Расходов в этом месяце ещё нет.</div>'}

function renderDebtChart(){const svg=$("debtChart"),W=900,H=210,pad=18,start=parseLocal(S.settings.campaignStart),startDebt=startingDebt();if(!svg)return;if(startDebt<=0){svg.innerHTML='<text x="450" y="108" text-anchor="middle" fill="#8fa0b8" font-size="18">Добавьте долги — график появится здесь</text>';return}const plan=simulateDebt(S.settings.monthlyDebtGoal,S.debts).series,maxMonths=Math.max(plan.length-1,S.settings.campaignMonths,10),max=Math.max(startDebt,1);const pp=plan.slice(0,maxMonths+1).map((v,i)=>[pad+(W-2*pad)*i/maxMonths,H-pad-(H-2*pad)*v/max]);const monthActual=new Map();S.balanceHistory.forEach(x=>{const d=parseLocal(x.date),idx=clamp(monthDiff(start,d),0,maxMonths);monthActual.set(idx,x.total)});monthActual.set(0,monthActual.get(0)??startDebt);const aa=[...monthActual.entries()].sort((a,b)=>a[0]-b[0]).map(([i,v])=>[pad+(W-2*pad)*i/maxMonths,H-pad-(H-2*pad)*v/max]);const path=a=>a.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ");svg.innerHTML=`<line x1="${pad}" y1="${H-pad}" x2="${W-pad}" y2="${H-pad}" stroke="#263c59"/><line x1="${pad}" y1="${pad}" x2="${pad}" y2="${H-pad}" stroke="#263c59"/><path d="${path(pp)}" fill="none" stroke="#8b5cf6" stroke-width="3"/><path d="${path(aa)}" fill="none" stroke="#22d3ee" stroke-width="4"/>`}

function debtPaymentAmount(d){return Math.min(+d.balance||0,Math.max(0,+d.nextPaymentAmount||+d.min||0))}

function debtNextDueDate(d,from=new Date()){
  const start=new Date(from.getFullYear(),from.getMonth(),from.getDate(),0,0,0);
  if(validDateKey(d.nextPaymentDate)){const x=parseLocal(d.nextPaymentDate);if(x>=start)return x}
  return null
}

function debtScheduleIssues(){const today=localDateKey();return (S.debts||[]).filter(d=>d.balance>0&&(!validDateKey(d.nextPaymentDate)||d.nextPaymentDate<today))}

function debtEventsBetween(start,end){const out=[];(S.debts||[]).forEach((d,i)=>{if(d.balance<=0||!validDateKey(d.nextPaymentDate))return;const stored=parseLocal(d.nextPaymentDate),startDay=new Date(start.getFullYear(),start.getMonth(),start.getDate(),0);let dt=new Date(stored),confirmed=dt>=startDay;if(dt<startDay){if(d.paymentMode!=="fixed")return;let guard=0;while(dt<startDay&&guard++<24)dt=addMonthsDate(dt,1);confirmed=false}let guard=0;while(dt<=end&&guard++<6){const mk=localMonthKey(dt),base=confirmed&&localDateKey(dt)===d.nextPaymentDate&&+d.nextPaymentAmount>0?+d.nextPaymentAmount:(+d.min||0),paid=paymentToDebtMonth(i,mk),amount=Math.max(0,Math.min(d.balance,base-paid));if(amount>0)out.push({date:new Date(dt),dateKey:localDateKey(dt),type:"payment",kind:"debt",label:d.name,amount,debtIndex:i,debtId:d.id,confirmed:confirmed&&localDateKey(dt)===d.nextPaymentDate,estimated:!(confirmed&&localDateKey(dt)===d.nextPaymentDate)});dt=addMonthsDate(dt,1);confirmed=false}});return out.sort((a,b)=>a.date-b.date)}

function regularEventsBetween(start,end){const out=[];for(const r of activeRegularPayments()){if(r.mandatory===false)continue;let cur=new Date(start.getFullYear(),start.getMonth(),1,12),guard=0;while(cur<=end&&guard++<6){const dt=regularDueDate(r,cur.getFullYear(),cur.getMonth());if(dt>=start&&dt<=end){const mk=localMonthKey(dt),amount=regularRemaining(r,mk);if(amount>0)out.push({date:dt,dateKey:localDateKey(dt),type:"payment",kind:"regular",label:r.name,amount,regularPaymentId:r.id,confirmed:true,estimated:false})}cur=addMonthsDate(cur,1)}}return out}

function incomeEventsBetween(start,end){const out=[];let cur=new Date(start.getFullYear(),start.getMonth(),1,12),guard=0;while(cur<=end&&guard++<8){const y=cur.getFullYear(),m=cur.getMonth(),last=daysInMonth(cur);for(const ev of (S.settings.incomeEvents||[])){const dt=new Date(y,m,Math.min(ev.day,last),9),amount=plannedIncomeForecastAmount(ev,y,m);if(dt>=start&&dt<=end&&amount>0)out.push({date:dt,dateKey:localDateKey(dt),type:"income",kind:"income",label:ev.label,amount,confirmed:false,estimated:true})}cur=addMonthsDate(cur,1)}return out}

function projectionLivingPerDay(d){const env=Object.values(S.envelopeLimits||{}).reduce((s,x)=>s+(+x||0),0);if(env>0)return monthlyLivingBudget(d)/Math.max(1,daysInMonth(d));return Math.max(0,+S.settings.dailySpendLimit||0)}

function buildFinancialProjection(days=90,opts={}){days=clamp(Math.round(+days||90),1,180);const start=new Date(),startDay=new Date(start.getFullYear(),start.getMonth(),start.getDate(),12),end=addDays(startDay,days-1),incomeFactor=Math.max(0,opts.incomeFactor==null?100:(+opts.incomeFactor||0))/100,oneOff=Math.max(0,+opts.oneOffExpense||0),extraMonthly=Math.max(0,+opts.extraDebtMonthly||0),floor=Math.max(0,+S.settings.minimumCashFloor||0),events=[...incomeEventsBetween(startDay,end),...projectionPaymentEvents(startDay,end)];const by={};for(const e of events)(by[e.dateKey]??=[]).push(e);let balance=operatingCashBalance(),minBalance=balance,minDate=localDateKey(startDay),cashGapDate="",income=0,outflow=0,living=0;const series=[];for(let i=0;i<days;i++){const d=addDays(startDay,i),key=localDateKey(d),dayEvents=by[key]||[];for(const e of dayEvents){if(e.type==="income"){const v=e.amount*incomeFactor;balance+=v;income+=v}else{balance-=e.amount;outflow+=e.amount}}const live=projectionLivingPerDay(d);balance-=live;living+=live;if(i===0&&oneOff>0){balance-=oneOff;outflow+=oneOff}if(extraMonthly>0&&d.getDate()===25){balance-=extraMonthly;outflow+=extraMonthly}if(balance<minBalance){minBalance=balance;minDate=key}if(!cashGapDate&&balance<floor)cashGapDate=key;series.push({date:key,balance})}return {days,start:startDay,end,balanceStart:operatingCashBalance(),endingBalance:balance,minBalance,minDate,cashGapDate,income,outflow,living,series,events:events.sort((a,b)=>a.date-b.date),warnings:[...(accountsModeActive()?[]:["Нет подтверждённого банковского остатка"]),...(debtScheduleIssues().length?[`У ${debtScheduleIssues().length} долгов отсутствует или просрочена следующая дата платежа`]:[]),...((!+S.settings.dailySpendLimit&&!Object.values(S.envelopeLimits||{}).some(x=>+x>0))?["Не задан бюджет повседневных расходов"]:[])]}}

function financialHealthData(){const p=buildFinancialProjection(30),cash=operatingCashBalance(),out30=p.outflow+p.living,liq=out30>0?cash/out30:null,debt30=p.events.filter(x=>x.kind==="debt").reduce((s,x)=>s+x.amount,0),income30=Math.max(0,p.income),burden=income30>0?debt30/income30:null,availableReserve=availableAssetValue()+(+S.settings.emergencyFundBalance||0),dailyEssential=out30/30,reserveDays=dailyEssential>0?availableReserve/dailyEssential:null;const verified=(S.accounts||[]).filter(a=>a.active!==false&&a.verifiedAt).map(a=>(Date.now()-Date.parse(a.verifiedAt))/86400000),fresh=verified.length?Math.max(...verified):null;return {liq,burden,reserveDays,fresh,cash,out30,income30,debt30,availableReserve,p}}

function healthBadge(label,value,detail,kind=""){return `<div class="health-item ${kind}"><div class="smallcaps">${label}</div><b>${value}</b><div class="sub">${detail}</div></div>`}

function safeSpendCapacity(){const p=buildFinancialProjection(30),complete=!p.warnings.some(x=>/бюджет повседневных/.test(x));if(!complete)return null;return Math.max(0,Math.min(freeCashBalance(),p.minBalance-(+S.settings.minimumCashFloor||0)))}

function renderDecisionEngine(){const box=$("decisionEngine");if(!box)return;const d=decisionEngineData();box.innerHTML=`<div class="decision-kpis"><div><span>Свободно сейчас</span><b>${rub(d.free)}</b></div><div><span>Минимум 30 дней</span><b class="${d.p.minBalance<0?"income-bad":""}">${rub(d.p.minBalance)}</b></div><div><span>Безопасный разовый расход</span><b>${d.safe==null?"нужен бюджет":rub(d.safe)}</b></div></div>${d.actions.length?d.actions.slice(0,4).map(a=>`<div class="decision-row ${a.level}"><b>${escapeHtml(a.title)}</b><div class="sub">${escapeHtml(a.meta)}</div></div>`).join(""):'<div class="empty">Критичных действий по финансовой модели нет.</div>'}`}

function checkCanSpend(){const amount=Math.max(0,+$("decisionSpendAmount")?.value||0),out=$("decisionSpendResult");if(!out)return;const base=decisionEngineData();if(base.safe==null){out.innerHTML='<div class="notice">Сначала задай дневной бюджет или конверты расходов. Без этого проверка будет ложной.</div>';return}const p=buildFinancialProjection(30,{oneOffExpense:amount});const ok=amount<=base.safe&&!p.cashGapDate;out.innerHTML=`<div class="notice ${ok?"good-notice":""}"><b>${ok?"По текущей модели расход помещается":"По текущей модели расход небезопасен"}.</b><br>После расхода минимальный прогнозный остаток: ${rub(p.minBalance)}${p.cashGapDate?` • риск разрыва ${fmtDate(parseLocal(p.cashGapDate))}`:""}.</div>`}

function renderFinancialForecast(){const box=$("financialForecast");if(!box)return;const days=+$(("forecastDays"))?.value||90,incomeFactor=clamp(finiteNumberOr($("forecastIncomeFactor")?.value,100),0,200),oneOff=Math.max(0,+$("forecastOneOff")?.value||0),extraDebtMonthly=Math.max(0,+$("forecastExtraDebt")?.value||0),p=buildFinancialProjection(days,{incomeFactor,oneOffExpense:oneOff,extraDebtMonthly});const pts=p.series.filter((x,i)=>i===0||i===p.series.length-1||i%Math.max(1,Math.floor(days/6))===0);box.innerHTML=`<div class="forecast-os-grid"><div class="report-item"><div class="smallcaps">Старт</div><b>${rub(p.balanceStart)}</b></div><div class="report-item"><div class="smallcaps">Конец периода</div><b class="${p.endingBalance<0?"income-bad":""}">${rub(p.endingBalance)}</b></div><div class="report-item"><div class="smallcaps">Минимум</div><b class="${p.minBalance<0?"income-bad":""}">${rub(p.minBalance)}</b><div class="sub">${fmtDate(parseLocal(p.minDate))}</div></div><div class="report-item"><div class="smallcaps">Кассовый разрыв</div><b>${p.cashGapDate?fmtDate(parseLocal(p.cashGapDate)):"нет"}</b></div></div><div class="mini-forecast">${pts.map(x=>`<div><span>${fmtDate(parseLocal(x.date))}</span><b class="${x.balance<0?"income-bad":""}">${rub(x.balance)}</b></div>`).join("")}</div>${p.warnings.length?`<div class="status">Ограничения модели: ${p.warnings.map(escapeHtml).join(" • ")}</div>`:""}`}

function renderFinancialControlCalendar(){const box=$("financialControlCalendar");if(!box)return;const p=buildFinancialProjection(90),events=p.events.slice(0,30);box.innerHTML=events.length?events.map(e=>`<div class="event ${e.type}"><div class="date">${fmtDate(e.date)}</div><div><b>${escapeHtml(e.label)}</b><div class="sub">${e.type==="income"?"ожидаемый доход":e.kind==="debt"?(e.confirmed?"подтверждённый платёж":"оценка по текущему графику"):"регулярное обязательство"}</div></div><b>${e.type==="income"?"+":"−"}${rub(e.amount)}</b></div>`).join(""):'<div class="empty">Нет событий на ближайшие 90 дней. Проверь график доходов и даты платежей.</div>'}

function assetValueById(id){const a=(S.assets||[]).find(x=>x.id===id);if(!a)return 0;let value=+a.verifiedValue||0;if(a.verifiedAt){const t=Date.parse(a.verifiedAt)||0;for(const x of S.assetTransfers||[]){if(x.assetId!==id||eventTs(x)<=t)continue;value+=x.direction==="toAsset"?(+x.amount||0):-(+x.amount||0)}}return Math.max(0,value)}

function totalAssetValue(){return moneySum((S.assets||[]).filter(a=>a.active!==false).map(a=>assetValueById(a.id)))}

function liquidAssetValue(){return (S.assets||[]).filter(a=>a.active!==false&&a.liquid).reduce((s,a)=>s+assetValueById(a.id),0)}

function availableAssetValue(){return moneySum((S.assets||[]).filter(a=>a.active!==false&&a.available).map(a=>assetValueById(a.id)))}

function netWorth(){return moneyAdd(operatingCashBalance(),totalAssetValue(),S.settings.emergencyFundBalance,-totalDebt())}

function renderAssets(){const sum=$("netWorthSummary"),list=$("assetList");if(!sum||!list)return;sum.innerHTML=`<div class="money-balance-grid"><div class="money-balance"><div class="smallcaps">Деньги</div><b>${rub(operatingCashBalance())}</b></div><div class="money-balance"><div class="smallcaps">Активы</div><b>${rub(totalAssetValue())}</b></div><div class="money-balance"><div class="smallcaps">Долги</div><b>${rub(totalDebt())}</b></div><div class="money-balance"><div class="smallcaps">Чистый капитал</div><b class="${netWorth()>=0?"income-good":"income-bad"}">${rub(netWorth())}</b></div></div>`;list.innerHTML=(S.assets||[]).filter(a=>a.active!==false).length?(S.assets||[]).filter(a=>a.active!==false).map(a=>`<div class="asset-row"><div><b>${escapeHtml(a.name)}</b><div class="qmeta">${escapeHtml(a.type)} • ${a.liquid?"ликвидный":"неликвидный"}${a.available?" • доступен Money Engine":" • не тратить автоматически"}</div></div><b>${rub(assetValueById(a.id))}</b><button class="btn ghost small" onclick="archiveAsset('${a.id}')">Скрыть</button></div>`).join(""):'<div class="empty">Добавь Инвесткопилку, накопления или другие активы.</div>'}

async function addAsset(){const name=$("assetName")?.value.trim(),value=Math.max(0,+$("assetValue")?.value||0);if(!name){toast("Укажи название актива");return}let a=(S.assets||[]).find(x=>x.active!==false&&x.name.toLowerCase()===name.toLowerCase());const data={name,type:$("assetType")?.value||"Инвестиции",verifiedValue:value,verifiedAt:new Date().toISOString(),liquid:$("assetLiquid")?.value!=="false",available:!!$("assetAvailable")?.checked,active:true};if(a)Object.assign(a,data);else(S.assets??=[]).push({id:uid(),...data});$("assetName").value=$("assetValue").value="";audit("Актив обновлён","asset",`${name}: ${rub(value)}`);await save("Актив сохранён")}

async function archiveAsset(id){const a=(S.assets||[]).find(x=>x.id===id);if(!a)return;if(!confirm(`Скрыть актив «${a.name}»?`))return;a.active=false;audit("Актив скрыт","asset",a.name);await save("Актив скрыт")}

function matchAssetByDescription(desc){const s=String(desc||"").toLowerCase();return (S.assets||[]).find(a=>a.active!==false&&(s.includes(a.name.toLowerCase())||(a.name.toLowerCase().includes("инвест")&&s.includes("инвесткопил"))))||null}

function remainingMinimumsThisMonth(){const mk=localMonthKey(),start=new Date(),end=new Date(start.getFullYear(),start.getMonth()+1,0,23,59,59);return debtEventsBetween(new Date(start.getFullYear(),start.getMonth(),1,0),end).filter(x=>localMonthKey(x.date)===mk).reduce((s,x)=>s+x.amount,0)}

function overdueMinimums(){const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),0),todayKey=localDateKey(today),out=[];(S.debts||[]).forEach((d,i)=>{if(d.balance<=0||!validDateKey(d.nextPaymentDate)||d.nextPaymentDate>=todayKey)return;const due=parseLocal(d.nextPaymentDate),mk=localMonthKey(due),base=Math.max(0,+d.nextPaymentAmount||+d.min||0),paid=paymentToDebtMonth(i,mk),amount=Math.max(0,Math.min(d.balance,base-paid));if(amount>0)out.push({date:due,dateKey:d.nextPaymentDate,type:"payment",kind:"debt",label:d.name,amount,debtIndex:i,debtId:d.id,overdue:true,confirmed:true,estimated:false})});const mk=localMonthKey(today);for(const r of activeRegularPayments()){if(r.mandatory===false)continue;const due=regularDueDate(r,today.getFullYear(),today.getMonth());if(due>=today)continue;const amount=regularRemaining(r,mk);if(amount>0)out.push({date:due,dateKey:localDateKey(due),type:"payment",kind:"regular",label:r.name,amount,regularPaymentId:r.id,overdue:true,confirmed:true,estimated:false})}return out.sort((a,b)=>a.date-b.date)}

function projectionPaymentEvents(start,end){const day0=new Date(start.getFullYear(),start.getMonth(),start.getDate(),12),day0Key=localDateKey(day0),overdue=overdueMinimums().map(e=>({...e,originalDate:new Date(e.date),date:new Date(day0),dateKey:day0Key,overdue:true})),future=[...debtEventsBetween(day0,end),...regularEventsBetween(day0,end)];return [...overdue,...future].sort((a,b)=>a.date-b.date)}

function mandatoryBefore(dateLimit){const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate(),0),limit=new Date(dateLimit.getFullYear(),dateLimit.getMonth(),dateLimit.getDate(),23,59,59);return projectionPaymentEvents(start,limit)}

function financialEvents(){const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),0),end=addDays(today,62),events=[...incomeEventsBetween(today,end),...overdueMinimums(),...debtEventsBetween(today,end),...regularEventsBetween(today,end)];for(const e of events)e.overdue=!!e.overdue||(e.type==="payment"&&e.date<today);return events.sort((a,b)=>a.date-b.date).slice(0,24)}

async function addPayment(){const i=+$("payDebt").value,amt=+$("payAmount").value||0;if(amt<=0)return;const d=S.debts[i];if(!d||d.balance<=0){toast("Этот долг уже закрыт");return}const used=Math.min(amt,d.balance),reservationUse=consumeReservation(["mandatory","debt"],used,i),accountId=$("payAccount")?.value||defaultAccountId(),beforeBalance=d.balance,scheduleBefore={nextPaymentDate:d.nextPaymentDate||"",nextPaymentAmount:+d.nextPaymentAmount||0},historyId=uid();d.balance=Math.max(0,d.balance-used);const x={id:uid(),date:new Date().toISOString(),localDate:localDateKey(),monthKey:localMonthKey(),dueMonth:paymentDueMonthForDebt(d),debtIndex:i,debtId:d.id,debt:d.name,accountId,amount:used,beforeBalance,scheduleBefore,historyId,xpAward:Math.max(5,Math.floor(used/5000)*5),after:totalDebt(),reservationUse};S.payments.push(x);S.balanceHistory.push({id:historyId,date:x.localDate,total:x.after,type:"payment",paymentId:x.id});addXp(x.xpAward,"Финансы","Платёж по долгу",`payment:${x.id}`,"process",x.localDate);advanceDebtScheduleAfterPayment(d,i);$("payAmount").value="";closeModal("paymentModal");audit("Платёж по долгу","finance",`${d.name}: ${rub(used)}`);await save(amt>used?`Зачтено только ${rub(used)} — остаток закрыт`:`Платёж ${rub(used)} сохранён`)}

function renderFinance(){const mp=monthPayments(),best=bestDebt();$("finDebt").textContent=rub(totalDebt());$("finIncome").textContent=rub(monthIncome());$("finMonth").textContent=rub(mp);$("finNeed").textContent=rub(Math.max(0,S.settings.monthlyDebtGoal-mp));$("finExpenses").textContent=rub(monthExpenses());$("finCash").textContent=rub(operatingCashBalance());$("finFreeCash").textContent=rub(freeCashBalance());$("finDailyBudget").textContent=rub(dynamicDailyBudget());$("bossList").innerHTML=S.debts.map((d,i)=>{const hp=d.initial>0?clamp(d.balance/d.initial*100,0,100):0,due=validDateKey(d.nextPaymentDate)?fmtDate(parseLocal(d.nextPaymentDate)):(d.paymentMode==="fixed"?`${d.dueDay}-е`:`обновить выписку`);return `<div class="boss"><div class="boss-top"><div><div class="debt-name">${escapeHtml(d.name)}</div><div class="sub">${d.rateKnown===false?"ставка не подтверждена":`${debtEffectiveRate(d).toFixed(2)}%`} • следующий ${due}</div></div><div class="right"><b>${rub(d.balance)}</b><div class="tag">HP ${hp.toFixed(0)}%</div></div></div><div class="boss-hp">${rub(Math.max(0,(d.initial||d.balance)-d.balance))} урона нанесено</div><div class="progress red"><i style="width:${hp}%"></i></div></div>`}).join("");if(best){const remaining=Math.max(0,S.settings.monthlyDebtGoal-mp),interest=best.balance*debtEffectiveRate(best)/100/12;$("payoffRecommendation").innerHTML=`<div class="boss"><span class="tag bad">Цель №1</span><div class="section-title" style="font-size:19px;margin-top:6px">${escapeHtml(best.name)}</div><div class="qmeta">Наибольшая рабочая ставка: ${debtEffectiveRate(best).toFixed(2)}%</div><div class="goal"><div class="goal-top"><span>Остаток</span><b>${rub(best.balance)}</b></div><div class="goal-top" style="margin-top:7px"><span>≈ проценты за месяц</span><b>${rub(interest)}</b></div><div class="goal-top" style="margin-top:7px"><span>Свободно до месячной цели</span><b>${rub(remaining)}</b></div></div></div>`}else $("payoffRecommendation").innerHTML='<div class="empty">Все долги закрыты.</div>';const opts=S.debts.map((d,i)=>`<option value="${i}">${escapeHtml(d.name)}</option>`).join("");$("payDebt").innerHTML=opts;$("syncDebt").innerHTML=opts;renderFinancialHealth();renderDecisionEngine();renderFinancialForecast();renderFinancialControlCalendar();renderAssets();renderSmartInbox();renderImportBatches();renderMoneyEngine();renderRegularPayments();refreshExpenseRegularOptions();renderIncomeFlow();renderCashAdvisor();renderAutopilot();renderDynamicBudget();renderDailyCashFlow();renderEnvelopes();renderCashForecast();renderFinanceMonthlyReport();renderFinanceClosures();renderFinanceCalendar();renderScenarios();renderDebtChart();renderPaymentHistory();renderExpenses();if($("whatIfMonthly")&&!$("whatIfMonthly").dataset.touched)$("whatIfMonthly").value=S.settings.monthlyDebtGoal;renderEmergencyFund();renderAccounts();renderBankSync();renderTransactionJournal();renderImportRules();renderDebtEngine();renderSmartBudget();calcScenarioLab()}

function renderAccountSelects(){const def=defaultAccountId();for(const id of ["incomeAccount","expenseAccount","payAccount","transferFrom","transferTo","bankSyncAccount","smartInboxAccount"]){const el=$(id);if(!el)continue;const old=el.value||def;el.innerHTML=accountOptions(old);if([...el.options].some(o=>o.value===old))el.value=old}if($("transferTo")&&$("transferTo").options.length>1&&$("transferTo").value===$("transferFrom")?.value)$("transferTo").selectedIndex=1}

function debtEffectiveRate(d){
  const balance=Math.max(0,+d?.balance||0),parts=Array.isArray(d?.parts)?d.parts.filter(p=>(+p.balance||0)>0):[];
  if(!balance||!parts.length)return +d?.rate||0;
  const partsBalance=parts.reduce((s,p)=>s+(+p.balance||0),0),baseRate=+d.rate||0;
  if(partsBalance>=balance-.01)return parts.reduce((s,p)=>s+(+p.balance||0)*(+p.rate||0),0)/Math.max(partsBalance,.01);
  const weighted=parts.reduce((s,p)=>s+(+p.balance||0)*(+p.rate||0),0)+(balance-partsBalance)*baseRate;
  return weighted/balance
}

function highestHighInterestDebt(){const t=Math.max(0,finiteNumberOr(S.settings.highInterestThreshold,40));return S.debts.map((d,i)=>({...d,i,_er:debtEffectiveRate(d)})).filter(d=>d.balance>0&&d._er>=t).sort((a,b)=>b._er-a._er)[0]||null}

function bestDebt(){return S.debts.map((d,i)=>({...d,i,_er:debtEffectiveRate(d)})).filter(d=>d.balance>0).sort((a,b)=>b._er-a._er)[0]}

function simulateDebt(monthlyBudget,debts=S.debts,maxMonths=120){let arr=debts.filter(d=>d.balance>0).map(d=>({b:+d.balance||0,r:debtEffectiveRate(d),min:+d.min||0,name:d.name})),interest=0,series=[arr.reduce((a,d)=>a+d.b,0)],months=0;monthlyBudget=Math.max(0,+monthlyBudget||0);const requiredMin=arr.reduce((s,d)=>s+Math.min(d.b,d.min),0);if(monthlyBudget<=0||monthlyBudget+0.01<requiredMin)return {months:Infinity,interest:0,series,feasible:false,remaining:series[0],reason:"Бюджет ниже суммы обязательных платежей"};while(arr.some(d=>d.b>0.01)&&months<maxMonths){months++;for(const d of arr){if(d.b>0){const it=d.b*d.r/100/12;d.b+=it;interest+=it}}let budget=monthlyBudget;for(const d of arr.filter(x=>x.b>0)){const p=Math.min(d.b,d.min,budget);d.b-=p;budget-=p}while(budget>0.01&&arr.some(d=>d.b>0.01)){const target=arr.filter(d=>d.b>0.01).sort((a,b)=>b.r-a.r)[0],p=Math.min(target.b,budget);target.b-=p;budget-=p}series.push(arr.reduce((a,d)=>a+d.b,0))}const remaining=series.at(-1)||0,feasible=remaining<=0.01;return {months:feasible?months:Infinity,interest,series,feasible,remaining,reason:feasible?"":"Не погашается в пределах горизонта модели"}}

function simulateDebtStrategy(monthlyBudget,strategy="avalanche"){const ds=deepClone(S.debts).filter(d=>d.balance>0).map(d=>({...d,_er:debtEffectiveRate(d)})),budget=Math.max(0,+monthlyBudget||0),order=[],requiredMin=ds.reduce((s,d)=>s+Math.min(+d.balance||0,+d.min||0),0);if(budget<=0||budget+0.01<requiredMin)return {months:Infinity,interest:0,order,feasible:false,remaining:ds.reduce((s,d)=>s+(+d.balance||0),0),reason:"Бюджет ниже суммы обязательных платежей"};let months=0,interest=0;while(ds.some(d=>d.balance>.01)&&months<600){months++;for(const d of ds){if(d.balance<=.01)continue;const x=d.balance*d._er/100/12;d.balance+=x;interest+=x}let left=budget;for(const d of ds){if(d.balance<=.01)continue;const p=Math.min(d.balance,+d.min||0,left);d.balance-=p;left-=p}while(left>.01&&ds.some(d=>d.balance>.01)){const open=ds.filter(d=>d.balance>.01);open.sort((a,b)=>strategy==="snowball"?a.balance-b.balance:b._er-a._er);const t=open[0];if(!order.includes(t.id))order.push(t.id);const p=Math.min(left,t.balance);t.balance-=p;left-=p}}const remaining=ds.reduce((s,d)=>s+Math.max(0,+d.balance||0),0),feasible=remaining<=.01;return {months:feasible?months:Infinity,interest,order,feasible,remaining,reason:feasible?"":"Не погашается в пределах горизонта модели"}}

function renderDebtPartEditor(){const box=$("debtPartList");if(!box)return;const id=$("debtEditId")?.value||"",d=id?debtById(id):null;if(!d){box.innerHTML='<div class="empty">Сначала сохрани долг, затем нажми «Изменить».</div>';return}const parts=Array.isArray(d.parts)?d.parts:[],sum=parts.reduce((s,p)=>s+(+p.balance||0),0),delta=(+d.balance||0)-sum;box.innerHTML=(parts.length?parts.map(p=>`<div class="debt-part-row"><div><b>${escapeHtml(p.name)}</b><div class="qmeta">${rub(p.balance)} • ${(+p.rate||0).toFixed(2)}%</div></div><button class="btn ghost small" onclick="deleteDebtPart('${d.id}','${p.id}')">Удалить</button></div>`).join(""):'<div class="empty">Части долга не заданы — используется общая ставка.</div>')+(parts.length?`<div class="status">Сумма частей: <b>${rub(sum)}</b> • остаток долга: <b>${rub(d.balance)}</b>${Math.abs(delta)>.01?` • <span class="csv-warn">не распределено ${rub(Math.abs(delta))}</span>`:' • <span class="csv-ok">сходится</span>'}<br>Рабочая эффективная ставка: <b>${debtEffectiveRate(d).toFixed(2)}%</b></div>`:'')}

async function addDebtPart(){const debtId=$("debtEditId")?.value||"",d=debtById(debtId);if(!d){toast("Сначала сохрани долг и открой его через «Изменить»");return}const name=$("debtPartName")?.value.trim()||"Часть долга",balance=Math.max(0,+$("debtPartBalance")?.value||0),rate=Math.max(0,+$("debtPartRate")?.value||0);if(balance<=0){toast("Укажи остаток части долга");return}d.parts=Array.isArray(d.parts)?d.parts:[];d.parts.push({id:uid(),name,balance,rate});$("debtPartName").value=$("debtPartBalance").value=$("debtPartRate").value="";audit("Часть долга добавлена","debt",`${d.name}: ${name}`);await persist();renderDebtPartEditor();renderDebtEngine();renderFinance();toast("Часть долга добавлена")}

async function deleteDebtPart(debtId,partId){const d=debtById(debtId);if(!d)return;d.parts=(d.parts||[]).filter(p=>p.id!==partId);audit("Часть долга удалена","debt",d.name);await persist();renderDebtPartEditor();renderDebtEngine();renderFinance()}

function editDebt(id){const d=debtById(id);if(!d)return;const map={debtEditId:"id",debtName:"name",debtBalance:"balance",debtRate:"rate",debtMin:"min",debtDueDay:"dueDay",debtType:"type",debtLimit:"limit",debtNextPaymentDate:"nextPaymentDate",debtNextPaymentAmount:"nextPaymentAmount",debtPaymentMode:"paymentMode"};for(const [el,k] of Object.entries(map))if($(el))$(el).value=d[k]??"";if($("debtRateKnown"))$("debtRateKnown").checked=d.rateKnown!==false;renderDebtPartEditor();document.getElementById("debtEditorCard")?.scrollIntoView({behavior:"smooth",block:"center"})}

function clearDebtForm(){for(const id of ["debtEditId","debtName","debtBalance","debtRate","debtMin","debtLimit","debtNextPaymentDate","debtNextPaymentAmount","debtPartName","debtPartBalance","debtPartRate"])if($(id))$(id).value="";if($("debtDueDay"))$("debtDueDay").value=1;if($("debtPaymentMode"))$("debtPaymentMode").value="statement";if($("debtRateKnown"))$("debtRateKnown").checked=true;renderDebtPartEditor()}

async function saveDebtForm(){const id=$("debtEditId").value||"",name=$("debtName").value.trim(),balance=Math.max(0,+$("debtBalance").value||0),rate=Math.max(0,+$("debtRate").value||0),min=Math.max(0,+$("debtMin").value||0),dueDay=clamp(Math.round(+$("debtDueDay").value||1),1,31),type=$("debtType").value,limit=Math.max(0,+$("debtLimit").value||0),nextPaymentDate=$("debtNextPaymentDate")?.value||"",nextPaymentAmount=Math.max(0,+$("debtNextPaymentAmount")?.value||0),paymentMode=$("debtPaymentMode")?.value||(type==="Кредит"?"fixed":"statement"),rateKnown=!!$("debtRateKnown")?.checked;if(!name){toast("Укажи название долга");return}const data={name,balance,rate,min,dueDay,type,limit,nextPaymentDate,nextPaymentAmount,paymentMode,rateKnown,active:true};let target;if(id){target=debtById(id);if(!target)return;const oldBalance=+target.balance||0,oldVerified=target.balanceVerifiedAt||"",oldSource=target.balanceVerificationSource||"";Object.assign(target,data);if(Math.abs(balance-oldBalance)>.005){const i=S.debts.findIndex(d=>d.id===target.id);recordDebtBalanceCheckpoint(target,i,"manual_edit")}else{target.balanceVerifiedAt=oldVerified;target.balanceVerificationSource=oldSource}audit("Долг изменён","debt",name)}else{target={id:uid(),initial:balance,priority:S.debts.length+1,parts:[],balanceVerifiedAt:"",balanceVerificationSource:"",...data};S.debts.push(target);recordDebtBalanceCheckpoint(target,S.debts.length-1,"manual_create");audit("Долг добавлен","debt",name)}await persist();render();editDebt(target.id);toast("Долг сохранён")}

function renderDebtEngine(){const box=$("debtEditorList");if(!box)return;box.innerHTML=S.debts.length?S.debts.map(d=>{const due=debtNextDueDate(d),next=validDateKey(d.nextPaymentDate)?`${fmtDate(parseLocal(d.nextPaymentDate))} • ${rub(debtPaymentAmount(d))}`:(d.paymentMode==="fixed"&&due?`≈ ${fmtDate(due)} • ${rub(d.min)}`:"нужно обновить по выписке"),parts=(d.parts||[]).length?` • частей ${(d.parts||[]).length}`:"";return `<div class="debt-engine-row"><div><div class="qtitle">${escapeHtml(d.name)}</div><div class="qmeta">${escapeHtml(d.type||"Долг")} • ${d.rateKnown===false?"ставка ?":`${debtEffectiveRate(d).toFixed(2)}%`} • следующий: ${next}${d.limit?` • лимит ${rub(d.limit)}`:""}${parts}</div></div><b>${rub(d.balance)}</b><button class="btn ghost small" onclick="editDebt('${d.id}')">Изменить</button></div>`}).join(""):'<div class="empty">Долги не добавлены.</div>';const goal=+S.settings.monthlyDebtGoal||0,a=simulateDebtStrategy(goal,"avalanche"),sn=simulateDebtStrategy(goal,"snowball"),name=id=>escapeHtml(debtById(id)?.name||"—"),unknown=S.debts.filter(d=>d.rateKnown===false).length;$("debtStrategyCompare").innerHTML=goal>0?`<div class="compare-grid"><div class="compare-card"><div class="smallcaps">Avalanche</div><b>${Number.isFinite(a.months)?a.months+" мес.":"—"}</b><div class="sub">проценты ≈ ${Number.isFinite(a.interest)?rub(a.interest):"—"}<br>первый: ${name(a.order[0])}</div></div><div class="compare-card"><div class="smallcaps">Snowball</div><b>${Number.isFinite(sn.months)?sn.months+" мес.":"—"}</b><div class="sub">проценты ≈ ${Number.isFinite(sn.interest)?rub(sn.interest):"—"}<br>первый: ${name(sn.order[0])}</div></div></div>${unknown?`<div class="notice" style="margin-top:10px">У ${unknown} долгов ставка не подтверждена — сравнение приблизительное.</div>`:""}`:'<div class="empty">Задай месячную цель на долги в настройках для сравнения стратегий.</div>';renderDebtPartEditor()}

function renderFinancialHealth(){const box=$("financialHealth");if(!box)return;const h=financialHealthData(),target=Math.max(1,+S.settings.liquidityTargetDays||14),liq=h.liq==null?"—":h.liq.toFixed(2)+"×",burden=h.burden==null?"—":pct(h.burden*100,0),reserve=h.reserveDays==null?"—":`${Math.floor(h.reserveDays)} дн.`,fresh=h.fresh==null?"не сверено":`${Math.floor(h.fresh)} дн.`;box.innerHTML=`<div class="health-grid">${healthBadge("Ликвидность",liq,"деньги / потребности 30 дней",h.liq!=null&&h.liq<1?"bad":"")}${healthBadge("Долговая нагрузка",burden,h.burden==null?"нет ожидаемых доходов на 30 дней":"обязательные долги / доход ближайших 30 дней",h.burden!=null&&h.burden>.5?"bad":"")}${healthBadge("Доступный резерв",reserve,`цель ${target} дней • только разрешённые к использованию активы`,h.reserveDays!=null&&h.reserveDays<target?"warn":"")}${healthBadge("Свежесть данных",fresh,"самая старая активная банковская сверка",h.fresh==null||h.fresh>7?"warn":"")}</div>${h.p.warnings.length?`<div class="notice" style="margin-top:10px">${h.p.warnings.map(escapeHtml).join(" • ")}</div>`:""}` }

function decisionEngineData(){const p=buildFinancialProjection(30),overdue=financialEvents().filter(x=>x.overdue),issues=debtScheduleIssues(),free=freeCashBalance(),safe=safeSpendCapacity(),availableReserve=availableAssetValue()+(+S.settings.emergencyFundBalance||0),actions=[];if(!accountsModeActive())actions.push({level:"bad",title:"Сверить банковский остаток",meta:"Без точки отсчёта решения по деньгам ненадёжны"});if(issues.length)actions.push({level:"warn",title:`Обновить даты платежей: ${issues.length}`,meta:issues.map(x=>x.name).join(", ")});if(overdue.length)actions.push({level:"bad",title:`Закрыть просроченное ${rub(overdue.reduce((ss,x)=>ss+x.amount,0))}`,meta:overdue[0].label});if(p.cashGapDate){actions.push({level:"bad",title:`Риск кассового разрыва ${fmtDate(parseLocal(p.cashGapDate))}`,meta:`минимум по прогнозу ${rub(p.minBalance)}`});if(availableReserve>0)actions.push({level:"warn",title:`Есть резерв ${rub(availableReserve)}`,meta:"Он не считается обычными деньгами; использовать только после отдельного решения"})}if(!p.cashGapDate&&free>0){const phase=financialPhase(),target=highestHighInterestDebt()||bestDebt();if(target)actions.push({level:"good",title:`Свободно ${rub(free)} — приоритет ${target.name}`,meta:`фаза: ${phase.name} • ставка ${debtEffectiveRate(target).toFixed(2)}%`})}return {p,overdue,issues,free,safe,availableReserve,actions}}

async function undoPayment(id){const pmt=S.payments.find(x=>x.id===id);if(!pmt)return;if(paymentLockedBySync(pmt)&&!pmt.historicalOnly){toast("После этого платежа была банковская сверка. Откатите сверку/импорт или скорректируйте остаток.");return}const sameDebt=(S.payments||[]).filter(x=>!x.historicalOnly&&(x.debtId||"")===(pmt.debtId||"")),latest=sameDebt.at(-1);if(latest&&latest.id!==pmt.id){toast("Сначала отмените более поздний платёж по этому долгу");return}const idx=S.debts.findIndex(d=>d.id===(pmt.debtId||""));if(idx>=0&&!pmt.historicalOnly){const d=S.debts[idx];d.balance=Number.isFinite(+pmt.beforeBalance)?Math.max(0,+pmt.beforeBalance):Math.max(0,(+d.balance||0)+(+pmt.amount||0));if(pmt.scheduleBefore){d.nextPaymentDate=pmt.scheduleBefore.nextPaymentDate||"";d.nextPaymentAmount=Math.max(0,+pmt.scheduleBefore.nextPaymentAmount||0)}}restoreReservationUse(pmt.reservationUse);removeXp(pmt.xpAward||0,"Финансы","Отмена платежа по долгу",`payment:${pmt.id}`,pmt.localDate);S.payments=S.payments.filter(x=>x.id!==id);if(pmt.historyId)S.balanceHistory=S.balanceHistory.filter(x=>x.id!==pmt.historyId);else{for(let j=S.balanceHistory.length-1;j>=0;j--){const h=S.balanceHistory[j];if(h.type==="payment"&&h.date===pmt.localDate&&Math.abs((+h.total||0)-(+pmt.after||0))<0.01){S.balanceHistory.splice(j,1);break}}}audit("Платёж отменён","debt",pmt.debt||"");await save("Платёж отменён • баланс, график и XP восстановлены")}

function renderUx7FinancePulse(){
  const box=$("ux7FinancePulse");if(!box||!S)return;const next=ux7NextMoneyEvent(),cash=operatingCashBalance(),free=freeCashBalance(),worth=netWorth();
  box.innerHTML=`<div class="ux7-pulse-head"><div><div class="eyebrow">Сейчас</div><div class="ux7-pulse-main">${rub(free)}</div><div class="muted">свободно из ${rub(cash)} на счетах</div></div><button class="btn secondary small" onclick="ux7OpenInbox()">Обновить банк</button></div><div class="ux7-pulse-grid"><div><span>Ближайшее</span><b>${next?escapeHtml(next.label):"Нет"}</b><small>${next?`${fmtDate(next.date)} • ${rub(next.amount)}`:"на 90 дней"}</small></div><div><span>Долги</span><b>${rub(totalDebt())}</b><small>${S.debts.filter(d=>d.balance>0).length} активных</small></div><div><span>Чистый капитал</span><b class="${worth>=0?"income-good":"income-bad"}">${rub(worth)}</b><small>с учётом активов</small></div></div>`;
}

function accountDeltaAfter(accountId,sinceTs){let cents=0;const add=v=>{cents+=moneyCents(v)},sub=v=>{cents-=moneyCents(v)};for(const x of S.incomeLogs||[])if((x.accountId||defaultAccountId())===accountId&&eventTs(x)>sinceTs)add(x.amount);for(const x of S.expenses||[])if((x.accountId||defaultAccountId())===accountId&&eventTs(x)>sinceTs)sub(x.amount);for(const x of S.payments||[])if((x.accountId||defaultAccountId())===accountId&&eventTs(x)>sinceTs&&!x.historicalOnly)sub(x.amount);for(const x of S.bankTransfers||[]){if(eventTs(x)<=sinceTs)continue;if(x.syncAccountId===accountId&&Number.isFinite(+x.syncEffect))add(x.syncEffect);else{if(x.fromAccountId===accountId)sub(x.amount);if(x.toAccountId===accountId)add(x.amount)}}for(const x of S.assetTransfers||[]){if(eventTs(x)<=sinceTs||(x.accountId||defaultAccountId())!==accountId)continue;(x.direction==="fromAsset"?add:sub)(x.amount)}for(const x of S.fundTransfers||[]){if(eventTs(x)<=sinceTs)continue;const a=x.accountId||defaultAccountId();if(a!==accountId)continue;(x.direction==="fromFund"?add:sub)(x.amount)}for(const x of S.cashAdjustments||[]){if(eventTs(x)<=sinceTs)continue;if((x.accountId||defaultAccountId())===accountId)add(x.delta)}return moneyFromCents(cents)}

function renderPaymentHistory(){const box=$("paymentHistory");if(!box)return;box.innerHTML=S.payments.length?S.payments.slice().reverse().slice(0,12).map(p=>p.historicalOnly?`<div class="log-item"><div class="qtitle">${fmtDate(parseLocal(p.localDate||String(p.date).slice(0,10)))} • ${escapeHtml(p.debt)}</div><div class="score">${rub(p.amount)}</div><span class="tag">исторический • остаток долга не менялся</span></div>`:`<div class="log-item"><div class="qtitle">${fmtDate(parseLocal(p.localDate||String(p.date).slice(0,10)))} • ${escapeHtml(p.debt)}</div><div class="score">${rub(p.amount)} • после платежа ${rub(p.after)}</div>${paymentLockedBySync(p)?'<span class="tag">зафиксировано сверкой банка</span>':`<button class="btn ghost small" style="margin-top:7px" onclick="undoPayment('${p.id}')">Отменить</button>`}</div>`).join(""):'<div class="empty">Платежей пока нет.</div>'}
