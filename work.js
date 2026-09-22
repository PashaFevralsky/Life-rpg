"use strict";

/* Life RPG 10.0.2 — Work OS and CRM Decision Engine */

const WORK_WEEKLY=[
  {id:"contacts20",title:()=>`${workTarget("contacts",20)} новых целевых контактов`,stat:"Карьера",xp:120,enabled:()=>workTarget("contacts",20)>0,condition:()=>workWeek().contacts>=workTarget("contacts",20)},
  {id:"follow10",title:()=>`${workTarget("followups",10)} follow-up`,stat:"Карьера",xp:100,enabled:()=>workTarget("followups",10)>0,condition:()=>workWeek().followups>=workTarget("followups",10)},
  {id:"lpr3",title:()=>`${workTarget("lpr",3)} разговора с ЛПР`,stat:"Карьера",xp:150,enabled:()=>workTarget("lpr",3)>0,condition:()=>workWeek().lpr>=workTarget("lpr",3)},
  {id:"meetings3",title:()=>`${workTarget("meetings",3)} встречи / созвона`,stat:"Карьера",xp:120,enabled:()=>workTarget("meetings",3)>0,condition:()=>workWeek().meetings>=workTarget("meetings",3)},
  {id:"proposals3",title:()=>`${workTarget("proposals",3)} качественных КП / расчёта`,stat:"Карьера",xp:120,enabled:()=>workTarget("proposals",3)>0,condition:()=>workWeek().proposals>=workTarget("proposals",3)},
  {id:"crm",title:"CRM без просроченных следующих шагов",stat:"Дисциплина",xp:150,condition:()=>S.crmDeals.some(d=>!["Выиграно","Проиграно"].includes(d.stage))&&crmOverdue().length===0}
];

function workingDaysLeft(d=new Date()){let n=0,x=new Date(d.getFullYear(),d.getMonth(),d.getDate(),12),end=new Date(d.getFullYear(),d.getMonth()+1,0,12);while(x<=end){const wd=x.getDay();if(wd!==0&&wd!==6)n++;x=addDays(x,1)}return n}

function workTarget(key,fallback=0){const v=Number(S.workTargets?.[key]);return Number.isFinite(v)&&v>=0?v:fallback}

function workWeek(){const [a,b]=weekBounds();return aggregateWork(S.workLogs.filter(x=>inRange(x.date,a,b)))}

function workMonth(){return aggregateWork(S.workLogs.filter(x=>x.date.startsWith(localMonthKey())))}

function aggregateWork(arr){return arr.reduce((o,x)=>({sales:o.sales+(+x.sales||0),contacts:o.contacts+(+x.contacts||0),followups:o.followups+(+x.followups||0),lpr:o.lpr+(+x.lpr||0),meetings:o.meetings+(+x.meetings||0),proposals:o.proposals+(+x.proposals||0),wins:o.wins+(+x.wins||0),pipeline:o.pipeline+(+x.pipeline||0)}),{sales:0,contacts:0,followups:0,lpr:0,meetings:0,proposals:0,wins:0,pipeline:0})}

function workXpOnDate(dateKey){return (S.workLogs||[]).filter(x=>x.date===dateKey).reduce((s,x)=>s+(+x.xpAward||0),0)}

async function addWorkLog(){
  const date=$("workDate")?.value||localDateKey();if(!validActivityDate(date)){toast("Рабочую запись можно добавить только за сегодня или прошедшую дату");return}
  const editId=$("workEditId")?.value||"",old=editId?S.workLogs.find(x=>x.id===editId):null;
  if(old?.sourceDealId&&(+$("workSales").value||0)<=0){toast("Для отмены реализации удали связанную запись");return}if(old){S.workLogs=S.workLogs.filter(x=>x.id!==editId);removeXp(old.xpAward||0,"Карьера","Редактирование рабочей записи",`work:${editId}`,old.date)}
  const x={id:old?.id||uid(),date,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),sourceDealId:old?.sourceDealId||"",sales:Math.max(0,+$("workSales").value||0),contacts:Math.max(0,+$("workContacts").value||0),followups:Math.max(0,+$("workFollowups").value||0),lpr:Math.max(0,+$("workLpr").value||0),meetings:Math.max(0,+$("workMeetings").value||0),proposals:Math.max(0,+$("workProposals").value||0),wins:Math.max(0,+$("workWins").value||0),pipeline:Math.max(0,+$("workPipeline").value||0),note:$("workNote").value.trim()};
  const raw=Math.min(120,Math.min(15,x.contacts*3)+Math.min(20,x.followups*2)+Math.min(30,x.lpr*10)+Math.min(20,x.meetings*10)+Math.min(24,x.proposals*8)+Math.min(20,x.wins*10)+(x.sales>0?10:0));x.xpAward=Math.min(raw,Math.max(0,120-workXpOnDate(date)));
  S.workLogs.unshift(x);S.workLogs.sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt||"").localeCompare(String(a.createdAt||"")));addXp(x.xpAward,"Карьера",old?"Рабочая запись обновлена":"Рабочая запись",`work:${x.id}`,"process",date);
  if(x.sourceDealId){const deal=S.crmDeals.find(d=>d.id===x.sourceDealId);if(deal){deal.realizedAmount=x.sales;deal.realizationDate=x.date;crmAddTimeline(deal,"realization-update",`Факт изменён: ${rub(x.sales)}`)}}audit(old?"Рабочая запись изменена":"Рабочая запись","work",`${date} • ${rub(x.sales)}`);cancelWorkEdit();await save(`${old?"Рабочая запись обновлена":"Рабочая запись сохранена"}${x.xpAward?` • +${x.xpAward} XP`:" • дневной лимит XP достигнут"}`)
}

async function deleteWork(id){const i=S.workLogs.findIndex(x=>x.id===id);if(i<0)return;const x=S.workLogs[i];if(!confirm("Удалить эту рабочую запись? Её можно будет восстановить из корзины."))return;await createPreActionSnapshot("Перед удалением рабочей записи");trashPush("work",x);S.workLogs.splice(i,1);removeXp(x.xpAward||0,"Карьера","Удалена рабочая запись",`work:${id}`,x.date);await save("Рабочая запись удалена • доступно восстановление") }

function editWork(id){const x=S.workLogs.find(z=>z.id===id);if(!x)return;const vals={workEditId:x.id,workDate:x.date,workSales:x.sales,workContacts:x.contacts,workFollowups:x.followups,workLpr:x.lpr,workMeetings:x.meetings,workProposals:x.proposals,workWins:x.wins||0,workPipeline:x.pipeline||0,workNote:x.note||""};for(const [id,v] of Object.entries(vals))if($(id))$(id).value=v??"";if($("workSaveBtn"))$("workSaveBtn").textContent="Обновить запись";if($("workCancelEdit"))$("workCancelEdit").hidden=false;$("workDate")?.scrollIntoView({behavior:"smooth",block:"center"})}

function cancelWorkEdit(){for(const id of ["workSales","workContacts","workFollowups","workLpr","workMeetings","workProposals","workWins","workPipeline"])if($(id))$(id).value=0;if($("workNote"))$("workNote").value="";if($("workDate"))$("workDate").value=localDateKey();if($("workEditId"))$("workEditId").value="";if($("workSaveBtn"))$("workSaveBtn").textContent="Сохранить запись";if($("workCancelEdit"))$("workCancelEdit").hidden=true}

const CRM_STAGE_PROB={"Лид":10,"Контакт":20,"ЛПР":35,"Расчёт / КП":50,"Тендер":65,"Согласование":80,"Заказ":95,"Выиграно":100,"Проиграно":0};

function crmWeightedPipeline(){return (S.crmDeals||[]).filter(d=>!["Выиграно","Проиграно"].includes(d.stage)).reduce((a,d)=>a+(+d.potential||0)*(+d.probability||0)/100,0)}

function crmMonthlyWeightedPipeline(month=localMonthKey()){return (S.crmDeals||[]).filter(d=>!["Выиграно","Проиграно"].includes(d.stage)&&String(d.closeDate||"").startsWith(month)).reduce((a,d)=>a+(+d.potential||0)*(+d.probability||0)/100,0)}

function crmOpenPipeline(){return (S.crmDeals||[]).filter(d=>!["Выиграно","Проиграно"].includes(d.stage)).reduce((a,d)=>a+(+d.potential||0),0)}

function crmOverdue(){const today=localDateKey();return (S.crmDeals||[]).filter(d=>!["Выиграно","Проиграно"].includes(d.stage)&&d.nextDate&&d.nextDate<today).sort((a,b)=>String(a.nextDate).localeCompare(String(b.nextDate))||(+b.potential||0)-(+a.potential||0))}

function crmNewPipelineThisMonth(month=localMonthKey()){return (S.crmDeals||[]).filter(d=>String(d.createdAt||"").slice(0,7)===month).reduce((a,d)=>a+(+d.potential||0),0)}

function crmForecastData(month=localMonthKey()){const plan=+S.settings.workMonthlyPlan||0,sales=aggregateWork((S.workLogs||[]).filter(x=>String(x.date||"").startsWith(month))).sales,weighted=crmMonthlyWeightedPipeline(month),forecast=sales+weighted,gap=plan>0?Math.max(0,plan-forecast):0,coverage=plan>0?forecast/plan*100:0;return {plan,sales,weighted,forecast,gap,coverage,open:crmOpenPipeline(),newPipeline:crmNewPipelineThisMonth(month)}}

function crmAddTimeline(d,type,text,meta={}){if(!d)return;d.timeline=Array.isArray(d.timeline)?d.timeline:[];d.timeline.unshift({id:uid(),date:new Date().toISOString(),type:String(type||"event"),text:String(text||""),...meta});d.timeline=d.timeline.slice(0,100)}

function crmTimelineHtml(d){const rows=(d.timeline||[]).slice(0,8);return rows.length?rows.map(e=>`<div class="log-item"><div class="qtitle">${new Date(e.date).toLocaleString("ru-RU")} • ${escapeHtml(e.text||e.type)}</div></div>`).join(""):'<div class="empty">История начнёт собираться после следующего изменения.</div>'}

function crmDecisionEngine(){const today=localDateKey(),items=[],staleDays=typeof workOsNumber==="function"?Math.round(workOsNumber("workStaleDays",14,1,365)):14;for(const d of S.crmDeals||[]){if(["Выиграно","Проиграно"].includes(d.stage))continue;const potential=+d.potential||0,q=crmCompleteness(d),boost=Math.min(25,potential/100000);if(d.nextDate&&d.nextDate<today)items.push({score:120+boost,dealId:d.id,title:d.name,meta:`Просрочено: ${d.nextStep||"следующий шаг"} • ${rub(potential)}`,kind:"overdue"});else if(!d.nextStep||!d.nextDate)items.push({score:105+boost,dealId:d.id,title:d.name,meta:`Нет следующего шага • ${rub(potential)}`,kind:"next"});else if(d.updatedAt&&Date.now()-Date.parse(d.updatedAt)>staleDays*86400000)items.push({score:92+boost,dealId:d.id,title:d.name,meta:`Нет обновлений >${staleDays} дней • следующий шаг ${fmtDate(parseLocal(d.nextDate))}`,kind:"stale"});else if(q&&!q.ok)items.push({score:85+boost,dealId:d.id,title:d.name,meta:`Карточка ≥500k ${q.done}/${q.total} • следующий шаг ${fmtDate(parseLocal(d.nextDate))}`,kind:"quality"});else if(String(d.closeDate||"").startsWith(localMonthKey()))items.push({score:70+boost+(+d.probability||0)/10,dealId:d.id,title:d.name,meta:`${d.nextStep} • ${fmtDate(parseLocal(d.nextDate))} • ${d.probability||0}%`,kind:"close"})}return items.sort((a,b)=>b.score-a.score).slice(0,8)}

const crmRealizationPending=new Set();
async function recordCrmRealization(id){if(crmRealizationPending.has(id))return;crmRealizationPending.add(id);try{const d=S.crmDeals.find(x=>x.id===id);if(!d)return;if(S.workLogs.some(x=>x.sourceDealId===id&&(+x.sales||0)>0)){toast("Реализация этой сделки уже учтена");return}const amount=Math.max(0,+d.realizedAmount||+d.potential||0),date=d.realizationDate||localDateKey();if(amount<=0){toast("Укажи сумму реализации");return}if(!validActivityDate(date)){toast("Дата реализации не может быть в будущем");return}await createPreActionSnapshot("Перед зачётом реализации CRM");const x={id:uid(),date,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),sourceDealId:id,sales:amount,contacts:0,followups:0,lpr:0,meetings:0,proposals:0,wins:1,pipeline:0,note:`CRM: ${d.name}`,xpAward:0};S.workLogs.unshift(x);d.stage="Выиграно";d.probability=100;d.realizedAmount=amount;d.realizationDate=date;d.updatedAt=new Date().toISOString();crmAddTimeline(d,"realization",`Реализация зачтена: ${rub(amount)}`,{amount});audit("CRM реализация","work",`${d.name} • ${rub(amount)}`);await save(`Реализация ${rub(amount)} добавлена в факт продаж`)}finally{crmRealizationPending.delete(id)}}

function crmParticipantsCount(d){const base=[d.client,d.investor,d.developer,d.generalContractor,d.hvacContractor,d.installer,d.designer,d.equipmentCustomer].filter(x=>String(x||"").trim()).length,contacts=String(d.contactsText||"").split(/\n+/).map(x=>x.trim()).filter(Boolean).length;return base+contacts}

function crmCompleteness(d){if((+d.potential||0)<500000)return null;const checks=[!!(d.name&&d.city&&+d.potential>0),crmParticipantsCount(d)>=2,!!(d.nextStep&&d.nextDate),!!(d.decisionDate||d.tenderDate||d.closeDate),!!d.manufacturers,!!d.competitor,!!d.projectDocs,!!(d.lpr||d.procurement)];const done=checks.filter(Boolean).length;return {done,total:checks.length,ok:done===checks.length}}

function crmStageChanged(){const p=CRM_STAGE_PROB[$("crmStage").value];if(p!=null)$("crmProbability").value=p}

async function saveCrmDeal(){const id=$("crmDealId").value||"",name=$("crmName").value.trim(),potential=Math.max(0,+$("crmPotential").value||0);if(!name||potential<=0){toast("Укажи объект и потенциал");return}const val=x=>$(x)?.value?.trim?.()||"",data={name,client:val("crmClient"),city:val("crmCity"),region:val("crmRegion"),link:val("crmLink"),potential,stage:$("crmStage").value,probability:clamp(+$("crmProbability").value||0,0,100),lpr:val("crmLpr"),competitor:val("crmCompetitor"),nextStep:val("crmNextStep"),nextDate:$("crmNextDate").value,closeDate:$("crmCloseDate").value,investor:val("crmInvestor"),developer:val("crmDeveloper"),generalContractor:val("crmGeneralContractor"),hvacContractor:val("crmHvacContractor"),installer:val("crmInstaller"),designer:val("crmDesigner"),equipmentCustomer:val("crmEquipmentCustomer"),procurement:val("crmProcurement"),projectDocs:val("crmProjectDocs"),manufacturers:val("crmManufacturers"),decisionDate:$("crmDecisionDate")?.value||"",tenderDate:$("crmTenderDate")?.value||"",realizationDate:$("crmRealizationDate")?.value||"",realizedAmount:Math.max(0,+$("crmRealizedAmount")?.value||0),contactsText:val("crmContactsText"),lostReason:val("crmLostReason"),updatedAt:new Date().toISOString()};let deal;if(id){deal=S.crmDeals.find(x=>x.id===id);if(!deal)return;const before=deepClone(deal),changes=[];for(const k of ["stage","probability","potential","nextStep","nextDate","closeDate","competitor","realizationDate","realizedAmount"])if(String(before[k]??"")!==String(data[k]??""))changes.push(`${k}: ${before[k]??"—"} → ${data[k]??"—"}`);const linked=S.workLogs.filter(w=>w.sourceDealId===id);if(linked.length){if(linked.length!==1||data.stage!=="Выиграно"||data.realizedAmount<=0||!validActivityDate(data.realizationDate)){toast("Для учтённой реализации нужны стадия Выиграно, сумма и прошедшая/сегодняшняя дата. Для отмены сначала удали факт продаж.");return}linked[0].sales=data.realizedAmount;linked[0].date=data.realizationDate;linked[0].updatedAt=data.updatedAt;}Object.assign(deal,data);if(changes.length)crmAddTimeline(deal,"update",changes.join(" • "));audit("CRM сделка изменена","work",name)}else{deal={id:uid(),createdAt:new Date().toISOString(),timeline:[],...data};crmAddTimeline(deal,"created",`Сделка создана • ${rub(potential)}`);S.crmDeals.unshift(deal);audit("CRM сделка добавлена","work",name)}const q=crmCompleteness(deal);clearCrmForm();await save(q&&!q.ok?`Сделка сохранена • карточка ≥500k заполнена ${q.done}/${q.total}`:"Сделка сохранена")}

function editCrmDeal(id){const d=S.crmDeals.find(x=>x.id===id);if(!d)return;const map={crmDealId:"id",crmName:"name",crmClient:"client",crmCity:"city",crmRegion:"region",crmLink:"link",crmPotential:"potential",crmStage:"stage",crmProbability:"probability",crmLpr:"lpr",crmCompetitor:"competitor",crmNextStep:"nextStep",crmNextDate:"nextDate",crmCloseDate:"closeDate",crmInvestor:"investor",crmDeveloper:"developer",crmGeneralContractor:"generalContractor",crmHvacContractor:"hvacContractor",crmInstaller:"installer",crmDesigner:"designer",crmEquipmentCustomer:"equipmentCustomer",crmProcurement:"procurement",crmProjectDocs:"projectDocs",crmManufacturers:"manufacturers",crmDecisionDate:"decisionDate",crmTenderDate:"tenderDate",crmRealizationDate:"realizationDate",crmRealizedAmount:"realizedAmount",crmContactsText:"contactsText",crmLostReason:"lostReason"};for(const [el,k] of Object.entries(map))if($(el))$(el).value=d[k]??"";document.getElementById("crmEditorCard")?.scrollIntoView({behavior:"smooth",block:"center"})}

function clearCrmForm(){for(const id of ["crmDealId","crmName","crmClient","crmCity","crmRegion","crmLink","crmPotential","crmLpr","crmCompetitor","crmNextStep","crmNextDate","crmCloseDate","crmInvestor","crmDeveloper","crmGeneralContractor","crmHvacContractor","crmInstaller","crmDesigner","crmEquipmentCustomer","crmProcurement","crmProjectDocs","crmManufacturers","crmDecisionDate","crmTenderDate","crmRealizationDate","crmRealizedAmount","crmContactsText","crmLostReason"])if($(id))$(id).value="";if($("crmStage"))$("crmStage").value="Лид";if($("crmProbability"))$("crmProbability").value=10}

async function deleteCrmDeal(id){const d=S.crmDeals.find(x=>x.id===id);if(!d)return;if(S.workLogs.some(x=>x.sourceDealId===id)){toast("Нельзя удалить CRM-сделку, пока с ней связана реализация. Сначала исправь связанную рабочую запись или оставь сделку в истории.");return}if(!confirm(`Удалить сделку «${d.name}»? Её можно будет восстановить из корзины.`))return;await createPreActionSnapshot("Перед удалением CRM-сделки");trashPush("crm",d);S.crmDeals=S.crmDeals.filter(x=>x.id!==id);audit("CRM сделка удалена","work",d.name);await save("Сделка удалена • доступно восстановление")}

function renderCrm(){const f=crmForecastData(),over=crmOverdue(),undated=(S.crmDeals||[]).filter(d=>!["Выиграно","Проиграно"].includes(d.stage)&&!d.closeDate).length,actions=crmDecisionEngine();$("crmSummary").innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Открытая воронка</div><b>${rub(f.open)}</b></div><div class="report-item"><div class="smallcaps">Новая воронка месяца</div><b>${rub(f.newPipeline)}</b></div><div class="report-item"><div class="smallcaps">Взвешено на месяц</div><b>${rub(f.weighted)}</b></div><div class="report-item"><div class="smallcaps">Факт + прогноз</div><b>${rub(f.forecast)}</b></div><div class="report-item"><div class="smallcaps">Покрытие плана</div><b>${f.plan?pct(f.coverage,0):"—"}</b></div><div class="report-item"><div class="smallcaps">Дефицит</div><b class="${f.gap?"income-bad":"income-good"}">${f.plan?rub(f.gap):"—"}</b></div></div>${actions.length?`<div class="title" style="margin-top:14px">Sales Decision Engine</div>${actions.slice(0,4).map(a=>`<div class="quest"><span class="tag ${a.kind==="overdue"?"bad":a.kind==="quality"?"warn":""}">${a.kind==="overdue"?"Срочно":a.kind==="quality"?"Качество":"Действие"}</span><div class="qbody"><div class="qtitle">${escapeHtml(a.title)}</div><div class="qmeta">${escapeHtml(a.meta)}</div></div><button class="btn ghost small" onclick="editCrmDeal('${a.dealId}')">Открыть</button></div>`).join("")}`:""}${undated?`<div class="status" style="margin-top:10px">Без даты закрытия: <b>${undated}</b> — не входят в прогноз месяца.</div>`:""}${over.length?`<div class="notice" style="margin-top:10px"><b>Просрочено следующих шагов: ${over.length}</b></div>`:""}`;const deals=(S.crmDeals||[]).slice().sort((a,b)=>(a.nextDate||"9999").localeCompare(b.nextDate||"9999")||(+b.potential||0)-(+a.potential||0));$("crmDealList").innerHTML=deals.length?deals.map(d=>{const q=crmCompleteness(d),due=d.nextDate===localDateKey(),openDeal=!["Выиграно","Проиграно"].includes(d.stage),realized=S.workLogs.some(w=>w.sourceDealId===d.id&&(+w.sales||0)>0);return `<div class="crm-deal ${openDeal&&d.nextDate&&d.nextDate<localDateKey()?"crm-overdue":""}"><div class="crm-head"><div><b>${escapeHtml(d.name)}</b><div class="sub">${escapeHtml(d.client||"")} ${d.city?`• ${escapeHtml(d.city)}`:""}${d.region?` • ${escapeHtml(d.region)}`:""}</div></div><b>${rub(d.potential)}</b></div><div class="qmeta">${escapeHtml(d.stage)} • ${d.probability}% • weighted ${rub(d.potential*d.probability/100)}${d.lpr?` • ЛПР: ${escapeHtml(d.lpr)}`:""}${d.competitor?` • конкурент: ${escapeHtml(d.competitor)}`:""}</div>${q?`<div class="qmeta"><span class="tag ${q.ok?"good":"warn"}">карточка ≥500k ${q.done}/${q.total}</span> • участников/контактов ${crmParticipantsCount(d)}</div>`:""}<div class="goal"><div class="goal-top"><span>${escapeHtml(d.nextStep||"Следующий шаг не указан")}</span><b>${d.nextDate?fmtDate(parseLocal(d.nextDate)):"—"}${due?" • сегодня":""}</b></div></div>${d.stage==="Выиграно"?`<div class="status">${realized?`✓ Реализация учтена в продажах`: `Выиграно, но ещё не отражено в факте продаж`}</div>`:""}${d.stage==="Проиграно"&&d.lostReason?`<div class="notice">Причина: ${escapeHtml(d.lostReason)}</div>`:""}<div class="split"><button class="btn ghost small" onclick="editCrmDeal('${d.id}')">Изменить</button>${d.stage==="Выиграно"&&!realized?`<button class="btn secondary small" onclick="recordCrmRealization('${d.id}')">Зачесть реализацию</button>`:""}<button class="btn ghost small" onclick="deleteCrmDeal('${d.id}')">Удалить</button></div><details class="crm-details" style="margin-top:8px"><summary>История сделки</summary><div style="margin-top:8px">${crmTimelineHtml(d)}</div></details></div>`}).join(""):`<div class="empty">Добавь первый объект / сделку.</div>`}

function renderWork(){const m=workMonth(),plan=S.settings.workMonthlyPlan||0,p=plan?clamp(m.sales/plan*100,0,100):0,f=crmForecastData();$("workPlanKpi").textContent=rub(plan);$("workSalesKpi").textContent=rub(m.sales);$("workPctKpi").textContent=pct(p,0);$("workProgress").style.width=p+"%";$("workProgressText").textContent=`${rub(m.sales)} / ${rub(plan)}`;$("workActivitySummary").innerHTML=[["Контакты",m.contacts],["Follow-up",m.followups],["ЛПР",m.lpr],["Встречи",m.meetings],["КП / расчёты",m.proposals],["Победы",m.wins],["CRM-воронка",compactRub(f.newPipeline)],["Прогноз",compactRub(f.forecast)]].map(x=>`<div class="report-item"><div class="smallcaps">${x[0]}</div><div style="font-weight:900;margin-top:4px">${x[1]}</div></div>`).join("");$("workQuests").innerHTML=renderQuestGroup(WORK_WEEKLY,"work")+renderMonthlyWorkQuest();renderWorkPace();renderWorkFunnel();renderCrm();$("workLogList").innerHTML=S.workLogs.length?S.workLogs.slice(0,10).map(x=>`<div class="log-item"><div class="qtitle">${fmtDate(parseLocal(x.date))} • ${rub(x.sales)}${x.sourceDealId?` • CRM`:""}</div><div class="score">контакты ${x.contacts||0} • follow-up ${x.followups||0} • ЛПР ${x.lpr||0} • КП ${x.proposals||0} • победы ${x.wins||0}</div>${x.note?`<div class="qmeta">${escapeHtml(x.note)}</div>`:""}<div class="split" style="margin-top:7px"><button class="btn ghost small" onclick="editWork('${x.id}')">Изменить</button><button class="btn ghost small" onclick="deleteWork('${x.id}')">Удалить</button></div></div>`).join(""):'<div class="empty">Добавь первый рабочий день.</div>'}

function renderWorkPace(){const m=workMonth(),remain=Math.max(0,S.settings.workMonthlyPlan-m.sales),days=Math.max(1,workingDaysLeft()),need=remain/days,logged=new Set(S.workLogs.filter(x=>x.date.startsWith(localMonthKey())).map(x=>x.date)).size,avg=logged?m.sales/logged:0;$("workPace").innerHTML=`<div class="goal"><div class="goal-top"><span>Осталось до плана</span><b>${rub(remain)}</b></div><div class="goal-top" style="margin-top:7px"><span>Рабочих дней осталось</span><b>${days}</b></div><div class="goal-top" style="margin-top:7px"><span>Нужно в среднем / рабочий день</span><b>${rub(need)}</b></div><div class="goal-top" style="margin-top:7px"><span>Текущий средний факт / записанный день</span><b>${rub(avg)}</b></div></div>`}

function renderWorkFunnel(){const m=workMonth(),pipeline=crmNewPipelineThisMonth(),wins=(S.crmDeals||[]).filter(d=>d.stage==="Выиграно"&&String(d.realizationDate||d.updatedAt||"").slice(0,7)===localMonthKey()).length,rows=[["Контакты",m.contacts],["ЛПР",m.lpr],["КП",m.proposals],["Выиграно CRM",wins]];$("workFunnel").innerHTML=`<div class="funnel">${rows.map((x,i)=>`<div class="funnel-row"><span>${x[0]}</span><div class="funnel-bar"><i style="width:${Math.min(100,i===0?100:(x[1]/Math.max(1,rows[0][1])*100))}%"></i></div><b>${x[1]}</b></div>`).join("")}</div><div class="status" style="margin-top:10px">Новая CRM-воронка за месяц: <b>${rub(pipeline)}</b>. Проценты между строками не называются «конверсией», потому что действия могут относиться к разным сделкам.</div>`}

function renderMonthlyWorkQuest(){const key=`work:monthly:${localMonthKey()}:salesplan`,done=!!S.questDone[key],plan=+S.settings.workMonthlyPlan||0,ready=plan>0&&workMonth().sales>=plan,p=plan>0?clamp(workMonth().sales/plan*100,0,100):0;return `<div class="quest"><button class="check ${done?"done":""} ${!ready&&!done?"locked":""}" onclick="claimMonthlyWork()">${done?"✓":ready?"":"·"}</button><div class="qbody"><div class="qtitle">Выполнить месячный план продаж</div><div class="qmeta">Карьера • ${plan<=0?"сначала задай план":ready&&!done?"готово к получению":pct(p,0)}</div></div><div class="xp">+600 XP</div></div>`}

async function claimMonthlyWork(){const key=`work:monthly:${localMonthKey()}:salesplan`,plan=+S.settings.workMonthlyPlan||0;if(S.questDone[key])return;if(plan<=0){toast("Сначала задай месячный план продаж");return}if(workMonth().sales<plan){toast("План ещё не выполнен");return}S.questDone[key]=true;addXp(600,"Карьера","Выполнен месячный план",key);await save("План продаж закрыт • +600 XP")}


/* Work OS deep analytics layer — first iteration.
   Uses existing state/settings; no schema migration is required. */

function workOsNumber(key,fallback,min=0,max=Number.POSITIVE_INFINITY){
  const v=Number(S.settings?.[key]);
  return Number.isFinite(v)?clamp(v,min,max):fallback
}
function workMonthKeyFromDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function workDaysBetweenInclusive(a,b){
  let n=0,x=new Date(a.getFullYear(),a.getMonth(),a.getDate(),12),end=new Date(b.getFullYear(),b.getMonth(),b.getDate(),12);
  while(x<=end){const wd=x.getDay();if(wd!==0&&wd!==6)n++;x=addDays(x,1)}
  return n
}
function workPaceData(d=new Date()){
  const month=workMonthKeyFromDate(d),plan=Math.max(0,+S.settings.workMonthlyPlan||0),sales=aggregateWork((S.workLogs||[]).filter(x=>String(x.date||"").startsWith(month))).sales;
  const start=new Date(d.getFullYear(),d.getMonth(),1,12),end=new Date(d.getFullYear(),d.getMonth()+1,0,12),yesterday=addDays(new Date(d.getFullYear(),d.getMonth(),d.getDate(),12),-1);
  const total=workDaysBetweenInclusive(start,end),elapsedBefore=yesterday<start?0:workDaysBetweenInclusive(start,yesterday),left=workDaysBetweenInclusive(new Date(d.getFullYear(),d.getMonth(),d.getDate(),12),end);
  const expectedBefore=total>0?plan*elapsedBefore/total:0,gap=Math.max(0,plan-sales),requiredDaily=left>0?gap/left:(gap>0?Number.POSITIVE_INFINITY:0);
  return {month,plan,sales,total,elapsedBefore,left,expectedBefore,paceDelta:sales-expectedBefore,gap,requiredDaily}
}
function crmOpenDeals(){return (S.crmDeals||[]).filter(d=>!["Выиграно","Проиграно"].includes(d.stage))}
function crmClosedDeals(){return (S.crmDeals||[]).filter(d=>["Выиграно","Проиграно"].includes(d.stage))}
function crmMonthlyOpenDeals(month=localMonthKey()){return crmOpenDeals().filter(d=>String(d.closeDate||"").startsWith(month))}
function crmWinRateStats(){
  const closed=crmClosedDeals(),wins=closed.filter(d=>d.stage==="Выиграно").length,losses=closed.length-wins,empirical=closed.length?wins/closed.length*100:null;
  const assumed=workOsNumber("workWinRateAssumption",25,0,100),minSample=Math.round(workOsNumber("workWinRateMinSample",5,1,100));
  const useEmpirical=closed.length>=minSample,used=useEmpirical?(empirical??0):assumed;
  return {wins,losses,closed:closed.length,empirical,assumed,minSample,used,source:useEmpirical?"history":"assumption"}
}
function crmCoverageData(month=localMonthKey()){
  const plan=Math.max(0,+S.settings.workMonthlyPlan||0),sales=aggregateWork((S.workLogs||[]).filter(x=>String(x.date||"").startsWith(month))).sales,gap=Math.max(0,plan-sales);
  const deals=crmMonthlyOpenDeals(month),raw=deals.reduce((s,d)=>s+(+d.potential||0),0),weighted=deals.reduce((s,d)=>s+(+d.potential||0)*(+d.probability||0)/100,0),wr=crmWinRateStats(),rate=wr.used/100;
  const requiredRaw=gap<=0?0:(rate>0?gap/rate:Number.POSITIVE_INFINITY),additional=Number.isFinite(requiredRaw)?Math.max(0,requiredRaw-raw):Number.POSITIVE_INFINITY;
  const rawCoverage=gap<=0?100:(Number.isFinite(requiredRaw)&&requiredRaw>0?raw/requiredRaw*100:0);
  const probabilityForecast=sales+weighted,historyRateForecast=sales+raw*rate;
  return {month,plan,sales,gap,deals:deals.length,raw,weighted,wr,requiredRaw,additional,rawCoverage,probabilityForecast,historyRateForecast}
}
function crmDataQuality(){
  const today=localDateKey(),open=crmOpenDeals(),staleDays=Math.round(workOsNumber("workStaleDays",14,1,365)),staleMs=staleDays*86400000;
  const missingNext=open.filter(d=>!String(d.nextStep||"").trim()||!d.nextDate);
  const overdue=open.filter(d=>d.nextDate&&d.nextDate<today);
  const noClose=open.filter(d=>!d.closeDate);
  const pastClose=open.filter(d=>d.closeDate&&d.closeDate<today);
  const stale=open.filter(d=>{const ts=Date.parse(d.updatedAt||d.createdAt||"");return Number.isFinite(ts)&&Date.now()-ts>staleMs});
  const largeIncomplete=open.filter(d=>{const q=crmCompleteness(d);return q&&!q.ok});
  return {open:open.length,staleDays,missingNext:missingNext.length,overdue:overdue.length,noClose:noClose.length,pastClose:pastClose.length,stale:stale.length,largeIncomplete:largeIncomplete.length}
}
function crmCreatedPipelineForMonth(month){return (S.crmDeals||[]).filter(d=>String(d.createdAt||"").slice(0,7)===month).reduce((s,d)=>s+(+d.potential||0),0)}
function workRecentMonths(n=6,d=new Date()){
  const rows=[];
  for(let i=n-1;i>=0;i--){const x=new Date(d.getFullYear(),d.getMonth()-i,1,12),month=workMonthKeyFromDate(x),sales=aggregateWork((S.workLogs||[]).filter(w=>String(w.date||"").startsWith(month))).sales,created=crmCreatedPipelineForMonth(month);rows.push({month,sales,created})}
  return rows
}
function crmLostAnalysis(){
  const lost=(S.crmDeals||[]).filter(d=>d.stage==="Проиграно"),total=lost.reduce((s,d)=>s+(+d.potential||0),0),map=new Map();
  for(const d of lost){const reason=String(d.lostReason||"Причина не указана").trim().replace(/\s+/g," ")||"Причина не указана";const key=reason.toLocaleLowerCase("ru-RU"),cur=map.get(key)||{reason,count:0,potential:0};cur.count++;cur.potential+=+d.potential||0;map.set(key,cur)}
  const reasons=[...map.values()].sort((a,b)=>b.potential-a.potential||b.count-a.count);
  return {count:lost.length,total,reasons}
}
function workActivityGaps(){
  const w=workWeek(),pairs=[["contacts","Контакты",w.contacts],["followups","Follow-up",w.followups],["lpr","ЛПР",w.lpr],["meetings","Встречи",w.meetings],["proposals","КП / расчёты",w.proposals]];
  return pairs.map(([key,label,fact])=>{const target=workTarget(key,0);return {key,label,fact,target,missing:Math.max(0,target-fact),ratio:target>0?fact/target:1}}).filter(x=>x.target>0&&x.missing>0).sort((a,b)=>a.ratio-b.ratio)
}
function workDecisionEngineDeep(){
  const items=[],pace=workPaceData(),coverage=crmCoverageData(),q=crmDataQuality(),crm=crmDecisionEngine();
  if(pace.plan<=0)items.push({kind:"setup",title:"Задать месячный план продаж",meta:"Без плана нельзя оценить темп и достаточность воронки."});
  else if(pace.paceDelta<0)items.push({kind:"pace",title:"Вернуться к темпу плана",meta:`Отставание от линейного рабочего темпа: ${rub(Math.abs(pace.paceDelta))}. Нужно в среднем ${Number.isFinite(pace.requiredDaily)?rub(pace.requiredDaily):"—"} за каждый оставшийся рабочий день.`});
  if(coverage.gap>0&&coverage.additional>0)items.push({kind:"pipeline",title:"Нарастить воронку месяца",meta:Number.isFinite(coverage.additional)?`При используемой конверсии ${pct(coverage.wr.used,0)} не хватает примерно ${rub(coverage.additional)} сырой воронки.`:`Используемая конверсия равна 0%; требуемую воронку математически определить нельзя.`});
  if(q.pastClose)items.push({kind:"date",title:"Перепланировать просроченные даты закрытия",meta:`Открытых сделок с датой закрытия в прошлом: ${q.pastClose}.`});
  if(q.noClose)items.push({kind:"date",title:"Поставить даты закрытия",meta:`Без даты закрытия: ${q.noClose}. Эти сделки не участвуют в месячном прогнозе.`});
  for(const a of crm.slice(0,4))items.push({kind:a.kind,title:a.title,meta:a.meta,dealId:a.dealId});
  const ag=workActivityGaps()[0];if(ag)items.push({kind:"activity",title:`Добрать активность: ${ag.label}`,meta:`Неделя: ${ag.fact}/${ag.target}; осталось ${ag.missing}.`});
  return items.slice(0,8)
}
function crmScenarioData(ratePct,extraPipeline=0,month=localMonthKey()){
  const rate=clamp(Number(ratePct)||0,0,100)/100,coverage=crmCoverageData(month),extra=Math.max(0,Number(extraPipeline)||0),forecast=coverage.sales+(coverage.raw+extra)*rate,gap=Math.max(0,coverage.plan-forecast);
  const requiredExtra=coverage.plan<=coverage.sales?0:(rate>0?Math.max(0,(coverage.plan-coverage.sales)/rate-coverage.raw):Number.POSITIVE_INFINITY);
  return {rate:rate*100,extra,forecast,gap,requiredExtra,raw:coverage.raw,sales:coverage.sales,plan:coverage.plan}
}
function workOsMonthLabel(month){const [y,m]=String(month).split("-").map(Number);return new Date(y,m-1,1,12).toLocaleDateString("ru-RU",{month:"short",year:"2-digit"})}
function workOsSetHtml(id,html){const el=$(id);if(el)el.innerHTML=html}
function ensureWorkOsUi(){
  if(document.getElementById("workOsCommand"))return;
  const grid=document.querySelector?.("#work .grid");if(!grid)return;
  const anchor=grid.querySelector?.(".work-hero")||null,target=anchor||grid;
  if(typeof target.insertAdjacentHTML!=="function")return;
  target.insertAdjacentHTML(anchor?"afterend":"beforeend",`
    <div data-ux7-view="overview" class="card ux7-card span-12"><div class="eyebrow">Work OS</div><div class="section-title">Центр управления продажами</div><div class="muted" style="margin-top:6px">Факт, рабочий темп, достаточность воронки и конкретные действия. Прогнозы — математические сценарии, а не гарантии продаж.</div><div id="workOsCommand" style="margin-top:12px"></div></div>
    <div data-ux7-view="overview" class="card ux7-card span-6"><div class="eyebrow">Pipeline Engine</div><div class="title">Хватит ли воронки</div><div id="workOsCoverage"></div></div>
    <div data-ux7-view="crm" class="card ux7-card span-6"><div class="eyebrow">CRM Hygiene</div><div class="title">Качество данных и дисциплина</div><div id="workOsQuality"></div></div>
    <div data-ux7-view="overview" class="card ux7-card span-6"><div class="title">Факт и созданная воронка • 6 месяцев</div><div id="workOsHistory"></div></div>
    <div data-ux7-view="crm" class="card ux7-card span-6"><div class="title">Проигранные сделки</div><div id="workOsLosses"></div></div>
    <div data-ux7-view="crm" class="card ux7-card span-12"><div class="eyebrow">Scenario Lab</div><div class="section-title">Что если?</div><div class="formgrid" style="margin-top:12px"><div class="field"><label>Конверсия в победу, %</label><input id="workScenarioRate" type="number" min="0" max="100" step="1" oninput="renderWorkScenario()"></div><div class="field"><label>Дополнительная воронка месяца, ₽</label><input id="workScenarioExtra" type="number" min="0" step="10000" value="0" oninput="renderWorkScenario()"></div></div><div id="workScenarioResult" style="margin-top:12px"></div></div>
    <div data-ux7-view="crm" class="card ux7-card span-12"><details><summary>Настройки Work OS</summary><div class="formgrid" style="margin-top:12px"><div class="field"><label>План продаж / месяц, ₽</label><input id="workOsPlan" type="number" min="0"></div><div class="field"><label>Базовая конверсия в победу, %</label><input id="workOsWinRate" type="number" min="0" max="100"></div><div class="field"><label>Минимум закрытых сделок для своей статистики</label><input id="workOsMinSample" type="number" min="1" max="100"></div><div class="field"><label>Сделка считается без обновлений через, дней</label><input id="workOsStaleDays" type="number" min="1" max="365"></div><div class="field"><label>Контакты / нед.</label><input id="workOsContacts" type="number" min="0"></div><div class="field"><label>Follow-up / нед.</label><input id="workOsFollowups" type="number" min="0"></div><div class="field"><label>ЛПР / нед.</label><input id="workOsLpr" type="number" min="0"></div><div class="field"><label>Встречи / нед.</label><input id="workOsMeetings" type="number" min="0"></div><div class="field"><label>КП / расчёты / нед.</label><input id="workOsProposals" type="number" min="0"></div></div><button class="btn secondary" style="margin-top:12px" onclick="saveWorkOsSettings()">Сохранить настройки</button><div class="notice" style="margin-top:10px">Своя историческая конверсия начинает использоваться только после заданного минимального числа закрытых CRM-сделок. До этого применяется базовая гипотеза.</div></details></div>
  `)
}
function renderWorkOsCommand(){
  const p=workPaceData(),c=crmCoverageData(),actions=workDecisionEngineDeep(),paceText=p.plan<=0?"План не задан":p.paceDelta>=0?`Выше ориентира к началу дня на ${rub(p.paceDelta)}`:`Ниже ориентира к началу дня на ${rub(Math.abs(p.paceDelta))}`;
  workOsSetHtml("workOsCommand",`<div class="report-grid"><div class="report-item"><div class="smallcaps">Факт месяца</div><b>${rub(p.sales)}</b></div><div class="report-item"><div class="smallcaps">Осталось до плана</div><b>${p.plan?rub(p.gap):"—"}</b></div><div class="report-item"><div class="smallcaps">Нужно / рабочий день</div><b>${p.plan?(Number.isFinite(p.requiredDaily)?rub(p.requiredDaily):"—"):"—"}</b></div><div class="report-item"><div class="smallcaps">Прогноз по вероятностям CRM</div><b>${p.plan?rub(c.probabilityForecast):"—"}</b></div></div><div class="status" style="margin-top:10px">${paceText}. Рабочих дней до конца месяца, включая сегодня: <b>${p.left}</b>.</div>${actions.length?`<div class="title" style="margin-top:14px">Что делать сейчас</div>${actions.map(a=>`<div class="quest"><span class="tag ${["overdue","pace"].includes(a.kind)?"bad":["pipeline","quality","date"].includes(a.kind)?"warn":""}">${a.kind==="pipeline"?"Воронка":a.kind==="pace"?"Темп":a.kind==="overdue"?"Срочно":a.kind==="quality"?"Качество":"Действие"}</span><div class="qbody"><div class="qtitle">${escapeHtml(a.title)}</div><div class="qmeta">${escapeHtml(a.meta)}</div></div>${a.dealId?`<button class="btn ghost small" onclick="editCrmDeal('${a.dealId}')">Открыть</button>`:""}</div>`).join("")}`:""}`)
}
function renderWorkOsCoverage(){
  const c=crmCoverageData(),source=c.wr.source==="history"?`история CRM: ${c.wr.wins}/${c.wr.closed} побед`:`базовая гипотеза; закрытых сделок ${c.wr.closed}/${c.wr.minSample}`;
  const required=c.gap<=0?"План уже закрыт":Number.isFinite(c.requiredRaw)?rub(c.requiredRaw):"не определяется при 0%";
  const additional=c.gap<=0?"0 ₽":Number.isFinite(c.additional)?rub(c.additional):"не определяется";
  workOsSetHtml("workOsCoverage",`<div class="goal"><div class="goal-top"><span>Открытая воронка с закрытием в этом месяце</span><b>${rub(c.raw)}</b></div><div class="goal-top" style="margin-top:7px"><span>Взвешенная по вероятностям сделок</span><b>${rub(c.weighted)}</b></div><div class="goal-top" style="margin-top:7px"><span>Используемая конверсия</span><b>${pct(c.wr.used,0)}</b></div><div class="qmeta">${escapeHtml(source)}</div><div class="goal-top" style="margin-top:7px"><span>Сырая воронка, нужная для остатка плана</span><b>${required}</b></div><div class="goal-top" style="margin-top:7px"><span>Не хватает сырой воронки</span><b>${additional}</b></div></div><div class="status" style="margin-top:10px">Модель 1 — вероятности каждой сделки: <b>${rub(c.probabilityForecast)}</b>. Модель 2 — единая историческая/базовая конверсия: <b>${rub(c.historyRateForecast)}</b>.</div><div class="sub" style="margin-top:8px">Вероятности и конверсия являются входными предпосылками модели. Они не превращают прогноз в факт.</div>`)
}
function renderWorkOsQuality(){
  const q=crmDataQuality(),rows=[["Просрочен следующий шаг",q.overdue],["Нет следующего шага/даты",q.missingNext],["Нет даты закрытия",q.noClose],["Дата закрытия уже прошла",q.pastClose],[`Нет обновлений >${q.staleDays} дней`,q.stale],["Неполные карточки ≥500 тыс.",q.largeIncomplete]];
  workOsSetHtml("workOsQuality",`<div class="report-grid">${rows.map(x=>`<div class="report-item"><div class="smallcaps">${x[0]}</div><b class="${x[1]?"income-bad":"income-good"}">${x[1]}</b></div>`).join("")}</div><div class="status" style="margin-top:10px">Открытых CRM-сделок: <b>${q.open}</b>. Нулевые значения означают, что соответствующее нарушение сейчас не найдено.</div>`)
}
function renderWorkOsHistory(){
  const rows=workRecentMonths();
  workOsSetHtml("workOsHistory",rows.map(r=>`<div class="goal"><div class="goal-top"><span>${escapeHtml(workOsMonthLabel(r.month))}</span><b>${rub(r.sales)}</b></div><div class="qmeta">Создано новой CRM-воронки: ${rub(r.created)}</div></div>`).join("")||'<div class="empty">Пока недостаточно данных.</div>')
}
function renderWorkOsLosses(){
  const x=crmLostAnalysis();
  workOsSetHtml("workOsLosses",x.count?`<div class="goal"><div class="goal-top"><span>Проиграно сделок</span><b>${x.count}</b></div><div class="goal-top" style="margin-top:7px"><span>Потенциал проигранных</span><b>${rub(x.total)}</b></div></div><div class="title" style="margin-top:12px">Причины по текущим карточкам</div>${x.reasons.slice(0,5).map(r=>`<div class="log-item"><div class="qtitle">${escapeHtml(r.reason)}</div><div class="qmeta">${r.count} сделок • ${rub(r.potential)}</div></div>`).join("")}`:'<div class="empty">Проигранных CRM-сделок пока нет.</div>')
}
function renderWorkScenario(){
  const rateEl=document.getElementById("workScenarioRate"),extraEl=document.getElementById("workScenarioExtra");if(!rateEl||!extraEl)return;
  if(!rateEl.dataset.ready){rateEl.value=String(Math.round(crmWinRateStats().used));rateEl.dataset.ready="1"}
  const x=crmScenarioData(rateEl.value,extraEl.value),req=Number.isFinite(x.requiredExtra)?rub(x.requiredExtra):"не определяется при 0%";
  workOsSetHtml("workScenarioResult",`<div class="report-grid"><div class="report-item"><div class="smallcaps">Факт</div><b>${rub(x.sales)}</b></div><div class="report-item"><div class="smallcaps">Воронка месяца + добавка</div><b>${rub(x.raw+x.extra)}</b></div><div class="report-item"><div class="smallcaps">Сценарный прогноз</div><b>${rub(x.forecast)}</b></div><div class="report-item"><div class="smallcaps">Остаток до плана</div><b>${x.plan?rub(x.gap):"—"}</b></div></div><div class="status" style="margin-top:10px">При конверсии <b>${pct(x.rate,0)}</b> дополнительная сырая воронка, необходимая для математического покрытия плана: <b>${x.plan?req:"сначала задай план"}</b>.</div>`)
}
function renderWorkOsSettings(){
  const vals={workOsPlan:+S.settings.workMonthlyPlan||0,workOsWinRate:workOsNumber("workWinRateAssumption",25,0,100),workOsMinSample:Math.round(workOsNumber("workWinRateMinSample",5,1,100)),workOsStaleDays:Math.round(workOsNumber("workStaleDays",14,1,365)),workOsContacts:workTarget("contacts",20),workOsFollowups:workTarget("followups",10),workOsLpr:workTarget("lpr",3),workOsMeetings:workTarget("meetings",3),workOsProposals:workTarget("proposals",3)};
  for(const [id,v] of Object.entries(vals)){const el=$(id);if(el&&!el.dataset.ready){el.value=String(v);el.dataset.ready="1"}}
}
async function saveWorkOsSettings(){
  const num=(id,min,max)=>clamp(Number($(id)?.value)||0,min,max);
  S.settings.workMonthlyPlan=num("workOsPlan",0,1e12);S.settings.workWinRateAssumption=num("workOsWinRate",0,100);S.settings.workWinRateMinSample=Math.round(num("workOsMinSample",1,100));S.settings.workStaleDays=Math.round(num("workOsStaleDays",1,365));
  S.workTargets={...(S.workTargets||{}),contacts:Math.round(num("workOsContacts",0,10000)),followups:Math.round(num("workOsFollowups",0,10000)),lpr:Math.round(num("workOsLpr",0,10000)),meetings:Math.round(num("workOsMeetings",0,10000)),proposals:Math.round(num("workOsProposals",0,10000))};
  audit("Настройки Work OS","work",`План ${rub(S.settings.workMonthlyPlan)} • конверсия ${S.settings.workWinRateAssumption}%`);await save("Настройки Work OS сохранены")
}
function renderWorkOsPanels(){
  if(!document.getElementById("workOsCommand"))return;
  renderWorkOsCommand();renderWorkOsCoverage();renderWorkOsQuality();renderWorkOsHistory();renderWorkOsLosses();renderWorkScenario();renderWorkOsSettings()
}

const renderWork1002=renderWork;
renderWork=function(){renderWork1002();ensureWorkOsUi();renderWorkOsPanels()};
