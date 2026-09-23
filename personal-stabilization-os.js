"use strict";

/* Life RPG 12.0.0 — Personal OS stabilization compatibility layer.
   Keeps v18 data intact while correcting cross-module semantics. */

// One Capture surface: the legacy Inbox store/routes stay as the data/service layer,
// but the old duplicate card is no longer rendered.
ensureInboxOsUi=function(){};
renderInboxOs=function(){};

// Flexible habits are counted by unique active days by default. Existing trackers
// may opt into event counting with countMode:"events".
growthHabitTrackerStrength=function(t){
  const target=Math.max(1,+t.weeklyTarget||3),events=growthExplicitEvents().filter(x=>x.trackerId===t.id),weeks=[];
  for(let w=0;w<12;w++){
    const end=addDays(new Date(),-w*7),start=addDays(end,-6),a=localDateKey(start),b=localDateKey(end),matched=events.filter(x=>{const k=growthEventDate(x);return k>=a&&k<=b});
    const done=t.countMode==="events"?matched.length:new Set(matched.map(growthEventDate)).size,rate=Math.min(1,done/target),weight=Math.exp(-w/5);weeks.push({rate,weight,done})
  }
  const ws=weeks.reduce((s,x)=>s+x.weight,0),strength=ws?weeks.reduce((s,x)=>s+x.rate*x.weight,0)/ws*100:0,current=(weeks[0]?.rate||0)*100,prev=weeks.slice(1,5),prevRate=prev.length?prev.reduce((s,x)=>s+x.rate,0)/prev.length*100:current;
  return {strength,rate30:current,trend:current-prevRate}
};

// Body averages are day-weighted, not event-weighted. Multiple measurements on one
// day first collapse into a daily mean.
function bodyDailySeriesStable(id,days=30){
  const map=new Map();for(const x of bodyEvents(id,days)){const k=growthEventDate(x),v=+x.value;if(!Number.isFinite(v))continue;const a=map.get(k)||[];a.push(v);map.set(k,a)}
  return [...map.entries()].map(([dateKey,a])=>({dateKey,value:a.reduce((s,x)=>s+x,0)/a.length})).sort((a,b)=>a.dateKey.localeCompare(b.dateKey))
}
bodyAvg=function(id,days=7){const a=bodyDailySeriesStable(id,days);return a.length?a.reduce((s,x)=>s+x.value,0)/a.length:null};
bodyLatest=function(id){return bodyEvents(id,365).slice().sort((a,b)=>growthEventDate(b).localeCompare(growthEventDate(a))||String(b.occurredAt||b.createdAt||"").localeCompare(String(a.occurredAt||a.createdAt||"")))[0]||null};
bodyTrend=function(id){const all=bodyDailySeriesStable(id,14),cut=localDateKey(addDays(new Date(),-6)),now=all.filter(x=>x.dateKey>=cut),prev=all.filter(x=>x.dateKey<cut),avg=a=>a.length?a.reduce((s,x)=>s+x.value,0)/a.length:null,a=avg(now),b=avg(prev);return {now:a,prev:b,delta:a!=null&&b!=null?a-b:null}};
bodyReadiness=function(){
  const last=id=>{const a=bodyEvents(id,7).slice().sort((x,y)=>growthEventDate(y).localeCompare(growthEventDate(x))||String(y.occurredAt||y.createdAt||"").localeCompare(String(x.occurredAt||x.createdAt||"")));return a[0]?.value}, sleep=last("tracker-sleep"),energy=last("tracker-energy"),rec=last("tracker-recovery"),vals=[];
  if(Number.isFinite(+sleep))vals.push(clamp(+sleep/8*100,0,100));if(Number.isFinite(+energy))vals.push(clamp(+energy/10*100,0,100));if(Number.isFinite(+rec))vals.push(clamp(+rec/10*100,0,100));
  return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null
};

// A newly-created person is not treated as a real recent interaction.
peopleHealth=function(person){
  const last=peopleLastInteraction(person.id),cad=Math.max(1,+person.cadenceDays||30);
  if(!last)return {last:null,days:null,due:false,score:null,needsBaseline:true};
  const days=personalDaysSince(last.occurredAt||last.dateKey),ratio=days==null?0:days/cad,score=Math.round(clamp(100-ratio*60,0,100));return {last,days,due:days!=null&&days>=cad,score,needsBaseline:false}
};

// Buying an item does not invent a stock quantity. The user updates the factual
// inventory separately.
homeBought=async function(id){const x=personalData().shopping.find(q=>q.id===id);if(!x)return;x.done=true;x.doneAt=personalNow();await save(x.inventoryId?"Покупка отмечена — обнови фактический остаток":"Покупка отмечена")};

// Focus and Tasks share planning dates. A linked Task timer and Focus timer may not
// run at the same time, preventing double-counting actualMinutes.
function focusSyncLinkedTaskStable(tb){const task=personalFindTask(tb?.taskId);if(task&&validDateKey(tb.dateKey)){task.plannedDate=tb.dateKey;task.updatedAt=personalNow()}return task}
const focusAddTimeboxStableBase=focusAddTimebox;
focusAddTimebox=async function(){
  const taskId=String(document.getElementById("focusTask")?.value||""),task=personalFindTask(taskId),title=personalText(document.getElementById("focusTitle")?.value)||task?.title||"Фокус-блок",dateKey=String(document.getElementById("focusDate")?.value||localDateKey()),startTime=String(document.getElementById("focusStart")?.value||""),minutes=clamp(Math.round(+document.getElementById("focusMinutes")?.value||45),5,240);
  if(!validDateKey(dateKey)){toast("Укажи дату");return}const tb={id:uid(),taskId,title,dateKey,startTime,minutes,status:"planned",createdAt:personalNow(),archived:false};personalData().timeboxes.push(tb);focusSyncLinkedTaskStable(tb);const el=document.getElementById("focusTitle");if(el)el.value="";audit("Timebox создан","system",`${title} • ${minutes} мин`);await save("Фокус-блок добавлен")
};
focusAutoCarry=function(){
  const p=personalData(),today=localDateKey();if(p.lastAutoCarryDate===today)return;const moved=focusTimeboxes().filter(x=>x.status==="planned"&&validDateKey(x.dateKey)&&x.dateKey<today);
  for(const x of moved){x.dateKey=today;x.startTime="";x.carryCount=Math.max(0,+x.carryCount||0)+1;focusSyncLinkedTaskStable(x)}p.lastAutoCarryDate=today;if(moved.length)setTimeout(()=>save(`Автоперенос фокус-блоков: ${moved.length}`),0)
};
focusCarry=async function(id){const tb=focusTimeboxes().find(x=>x.id===id);if(!tb)return;tb.dateKey=personalDatePlus(1);tb.status="planned";tb.startTime="";focusSyncLinkedTaskStable(tb);await save("Перенесено на завтра")};
focusStart=async function(id){
  const tb=focusTimeboxes().find(x=>x.id===id);if(!tb)return;const p=personalData();if(p.activeFocus?.startedAt){toast("Сначала заверши активный фокус");return}const task=personalFindTask(tb.taskId);if(task?.timerStartedAt){toast("Сначала останови таймер этой задачи");return}focusSyncLinkedTaskStable(tb);p.activeFocus={timeboxId:id,taskId:tb.taskId||"",title:tb.title,startedAt:personalNow()};tb.status="active";await save("Фокус начат")
};
if(typeof calibrationStartTaskTimer==="function"){
  const calibrationStartTaskTimerStableBase=calibrationStartTaskTimer;
  calibrationStartTaskTimer=function(id){const a=personalData().activeFocus;if(a?.startedAt&&String(a.taskId||"")===String(id)){toast("Для этой задачи уже идёт Focus-блок");return false}return calibrationStartTaskTimerStableBase(id)}
}

// Render corrections that depend on the revised semantics.
const renderPeopleOsStableBase=renderPeopleOs;
renderPeopleOs=function(){renderPeopleOsStableBase();const list=document.getElementById("peopleOsList");if(!list)return;for(const p of peopleAll()){const h=peopleHealth(p);if(!h.needsBaseline)continue;const row=[...list.querySelectorAll(".log-item")].find(x=>x.textContent.includes(p.name));if(row){const meta=row.querySelector(".qmeta");if(meta)meta.textContent=`Последний контакт: ещё не зафиксирован • ритм ${p.cadenceDays} дн. • связь —`}}};

// Flexible-habit counting is an explicit setting for new trackers.
const ensureTrackingOsUiStableBase=ensureTrackingOsUi;
ensureTrackingOsUi=function(){
  ensureTrackingOsUiStableBase();
  if(document.getElementById("growthTrackerCountMode"))return;
  const weekly=document.getElementById("growthTrackerWeekly")?.closest(".field");if(!weekly)return;
  weekly.insertAdjacentHTML("afterend",`<div class="field"><label>Как считать гибкую привычку</label><select id="growthTrackerCountMode"><option value="days">По уникальным дням</option><option value="events">По событиям</option></select><div class="sub">«3 тренировки/нед.» → дни; «7 стаканов/день» → события.</div></div>`)
};
growthSaveTracker=async function(){
  const name=String(document.getElementById("growthTrackerName")?.value||"").trim();if(!name){toast("Укажи название трекера");return}
  const type=String(document.getElementById("growthTrackerType")?.value||"tick"),area=String(document.getElementById("growthTrackerArea")?.value||"Личное"),unit=String(document.getElementById("growthTrackerUnit")?.value||"").trim(),weeklyTarget=clamp(Math.round(+document.getElementById("growthTrackerWeekly")?.value||3),1,14),countMode=String(document.getElementById("growthTrackerCountMode")?.value||"days")==="events"?"events":"days";
  growthData().trackers.push({id:uid(),name,area,type,unit,min:type==="range"?1:null,max:type==="range"?10:null,weeklyTarget:type==="habit"?weeklyTarget:null,countMode:type==="habit"?countMode:null,active:true,createdAt:new Date().toISOString()});
  const n=document.getElementById("growthTrackerName"),u=document.getElementById("growthTrackerUnit"),e=document.getElementById("growthTrackerEditor");if(n)n.value="";if(u)u.value="";if(e)e.hidden=true;audit("Трекер создан","system",name);await save("Трекер создан")
};
