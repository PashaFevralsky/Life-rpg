"use strict";

/* Body / Recovery OS — self-reported trends only, not medical interpretation. */

const BODY_TRACKERS=[
  {id:"tracker-sleep",name:"Сон",type:"value",unit:"ч",area:"Тело"},
  {id:"tracker-energy",name:"Энергия",type:"range",unit:"/10",area:"Тело",min:1,max:10},
  {id:"tracker-mood",name:"Настроение",type:"range",unit:"/10",area:"Тело",min:1,max:10},
  {id:"tracker-weight",name:"Вес",type:"value",unit:"кг",area:"Тело"},
  {id:"tracker-water",name:"Вода",type:"value",unit:"л",area:"Тело"},
  {id:"tracker-recovery",name:"Восстановление",type:"range",unit:"/10",area:"Тело",min:1,max:10}
];
function bodyEnsureTrackers(){
  if(typeof growthData!=="function")return;const g=growthData();
  for(const d of BODY_TRACKERS)if(!g.trackers.some(x=>x.id===d.id))g.trackers.push({...d,active:true,createdAt:personalNow()});
  for(const x of g.trackers){const d=BODY_TRACKERS.find(q=>q.id===x.id);if(d&&x.area==="Личное")x.area="Тело"}
}
function bodyEvents(id,days=30){const start=localDateKey(addDays(new Date(),-(days-1)));return (typeof growthExplicitEvents==="function"?growthExplicitEvents():[]).filter(x=>x.trackerId===id&&growthEventDate(x)>=start&&x.value!=null)}
function bodyAvg(id,days=7){const a=bodyEvents(id,days).map(x=>+x.value).filter(Number.isFinite);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null}
function bodyTrend(id){const a=bodyAvg(id,7),all=bodyEvents(id,14),cut=localDateKey(addDays(new Date(),-7)),prev=all.filter(x=>growthEventDate(x)<cut).map(x=>+x.value).filter(Number.isFinite),b=prev.length?prev.reduce((s,x)=>s+x,0)/prev.length:null;return {now:a,prev:b,delta:a!=null&&b!=null?a-b:null}}
function bodyLatest(id){return bodyEvents(id,365).sort((a,b)=>String(b.occurredAt).localeCompare(String(a.occurredAt)))[0]||null}
function bodyReadiness(){
  const sleep=bodyAvg("tracker-sleep",7),energy=bodyAvg("tracker-energy",7),rec=bodyAvg("tracker-recovery",7);
  let vals=[];if(sleep!=null)vals.push(clamp(sleep/8*100,0,100));if(energy!=null)vals.push(clamp(energy/10*100,0,100));if(rec!=null)vals.push(clamp(rec/10*100,0,100));
  return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null
}
async function bodyQuickLog(id){
  const el=document.getElementById(`body_${id}`);let v=Number(el?.value);if(!Number.isFinite(v)){toast("Укажи значение");return}
  if(["tracker-energy","tracker-mood","tracker-recovery"].includes(id))v=clamp(v,1,10);
  if(typeof growthLogEvent!=="function")return;growthLogEvent(id,{value:v});if(el&&![ "tracker-energy","tracker-mood","tracker-recovery"].includes(id))el.value="";await save("Показатель записан")
}
function bodyHabitObservation(){
  if(typeof routineActive!=="function"||typeof routineDoneOn!=="function")return null;const moodByDay={};for(const x of bodyEvents("tracker-mood",30)){const k=growthEventDate(x);(moodByDay[k]??=[]).push(+x.value)}
  const days=Object.keys(moodByDay);if(days.length<10)return null;const rows=[];
  for(const r of routineActive()){let yes=[],no=[];for(const k of days){const m=moodByDay[k].reduce((a,b)=>a+b,0)/moodByDay[k].length;(routineDoneOn(r,k)?yes:no).push(m)}if(yes.length>=4&&no.length>=4)rows.push({title:r.title,yes:yes.reduce((a,b)=>a+b,0)/yes.length,no:no.reduce((a,b)=>a+b,0)/no.length,diff:yes.reduce((a,b)=>a+b,0)/yes.length-no.reduce((a,b)=>a+b,0)/no.length})}
  return rows.sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff))[0]||null
}
function ensureBodyOsUi(){
  bodyEnsureTrackers();if(document.getElementById("bodyOsCommand"))return;const grid=document.querySelector("#more .grid");if(!grid)return;const anchor=document.querySelector('[data-personal-widget="people"]')||grid.firstElementChild;
  anchor?.insertAdjacentHTML("afterend",`<div data-ux7-view="overview" data-personal-widget="body" class="card ux7-card span-12"><div><div class="eyebrow">Body / Recovery</div><div class="section-title">Состояние и восстановление</div><div class="sub">Самонаблюдение, не медицинская оценка.</div></div><div id="bodyOsCommand" style="margin-top:10px"></div><div id="bodyQuick" class="growth-trackers" style="margin-top:10px"></div><div id="bodyObservation" style="margin-top:10px"></div></div>`);personalRegisterWidget("body","Состояние и восстановление","more")
}
function renderBodyOs(){
  bodyEnsureTrackers();const box=document.getElementById("bodyOsCommand"),quick=document.getElementById("bodyQuick"),obs=document.getElementById("bodyObservation");if(!box||!quick||!obs)return;
  const ready=bodyReadiness(),sleep=bodyTrend("tracker-sleep"),energy=bodyTrend("tracker-energy"),mood=bodyTrend("tracker-mood"),weight=bodyLatest("tracker-weight");
  const fmt=x=>x==null?"—":Math.round(x*10)/10;
  box.innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Самооценка готовности</div><b>${ready==null?"—":ready+"%"}</b></div><div class="report-item"><div class="smallcaps">Сон 7д</div><b>${fmt(sleep.now)} ч</b></div><div class="report-item"><div class="smallcaps">Энергия 7д</div><b>${fmt(energy.now)}/10</b></div><div class="report-item"><div class="smallcaps">Настроение 7д</div><b>${fmt(mood.now)}/10</b></div><div class="report-item"><div class="smallcaps">Последний вес</div><b>${weight?fmt(weight.value)+" кг":"—"}</b></div></div>`;
  quick.innerHTML=BODY_TRACKERS.map(t=>`<div class="growth-tracker"><div class="qtitle">${escapeHtml(t.name)}</div><div class="qmeta">7 дней: ${fmt(bodyAvg(t.id,7))}${escapeHtml(t.unit)}</div><div class="split" style="margin-top:8px"><input id="body_${t.id}" type="number" step="any" ${t.type==="range"?'min="1" max="10" value="5"':""} placeholder="${escapeHtml(t.unit)}"><button class="btn secondary small" onclick="bodyQuickLog('${t.id}')">Записать</button></div></div>`).join("");
  const o=bodyHabitObservation();obs.innerHTML=o?`<div class="notice"><b>Наблюдение, не причинность:</b> в дни «${escapeHtml(o.title)}» среднее настроение ${fmt(o.yes)}, в остальные ${fmt(o.no)}. Данных пока немного — используй как гипотезу для наблюдения.</div>`:'<div class="status">Для описательных связей нужно ≥10 дней настроения и достаточно выполнений/пропусков привычек.</div>'
}
