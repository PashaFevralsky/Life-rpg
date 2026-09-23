"use strict";

/* Universal Capture 2.0 — capture once, route later. */

function capture2Suggest(text){
  const s=String(text||"").toLowerCase();
  if(/решил|решение|выбираю|оставляю/.test(s))return "decision";
  if(/позвонить|сделать|купить|написать|заказать|проверить|забрать|отправить/.test(s))return "task";
  if(/встреча|приём|запись|турнир|тренировка|в \d{1,2}[:.]\d{2}|завтра|сегодня/.test(s))return "calendar";
  if(/идея|книга|прочитал|мысль|тезис|цитата/.test(s))return "knowledge";
  if(/сон|вес|настроение|энергия|восстановление|вода/.test(s))return "tracker";
  if(/говорил|созвонился|встретил|общался|написал .*:/.test(s))return "person";
  return "journal"
}
function capture2Label(route){return ({decision:"Решение",task:"Задача",calendar:"Календарь",knowledge:"Знание",tracker:"Трекер",person:"Человек",journal:"Дневник"})[route]||route}
async function capture2Add(){
  const el=document.getElementById("capture2Input"),text=personalText(el?.value);if(!text){toast("Запиши мысль");return}
  const x=typeof inboxCapture==="function"?inboxCapture(text):null;if(!x)return;if(el)el.value="";audit("Universal capture","system",text);await save("Записано во входящие")
}
async function capture2ToJournal(id,decision=false){
  const x=typeof inboxAll==="function"?inboxAll().find(q=>q.id===id):null;if(!x)return;
  if(decision)journalDecisionCreate({title:x.text,revisitDate:personalDatePlus(30)});else journalCreate({type:"note",text:x.text});
  markInboxProcessed(x,decision?"decision":"journal");await save(decision?"Inbox → решение":"Inbox → дневник")
}
function capture2ParsePerson(text){
  const s=personalText(text),m=s.match(/^([^:—-]{2,50})\s*[:—-]\s*(.+)$/);return m?{name:m[1].trim(),note:m[2].trim()}:{name:s.slice(0,50),note:"Из Inbox"}
}
async function capture2ToPerson(id){
  const x=inboxAll().find(q=>q.id===id);if(!x)return;const p=capture2ParsePerson(x.text);let person=peopleAll().find(q=>q.name.toLowerCase()===p.name.toLowerCase());if(!person)person=peopleCreate({name:p.name,relation:"Другое",cadenceDays:30,note:"Создано из Inbox"});
  personalData().interactions.unshift({id:uid(),personId:person.id,dateKey:localDateKey(),occurredAt:personalNow(),type:"note",note:p.note,createdAt:personalNow(),archived:false});markInboxProcessed(x,"person",person.id);await save("Inbox → человек")
}
function capture2TrackerMatch(text){
  const s=String(text||"").toLowerCase(),n=String(text||"").match(/[-+]?\d+(?:[.,]\d+)?/),value=n?Number(n[0].replace(",",".")):NaN;
  const trackers=typeof growthTrackers==="function"?growthTrackers():[];const t=trackers.find(x=>s.includes(String(x.name||"").toLowerCase()));
  return t&&Number.isFinite(value)?{t,value}:null
}
async function capture2ToTracker(id){
  const x=inboxAll().find(q=>q.id===id);if(!x)return;const m=capture2TrackerMatch(x.text);if(!m){toast("Формат: название трекера + число, например «Сон 7.5»");return}
  growthLogEvent(m.t.id,{value:m.value,note:"Из Inbox"});markInboxProcessed(x,"tracker",m.t.id);await save("Inbox → трекер")
}
async function capture2Route(id,route){
  if(route==="task")return inboxToTask(id);
  if(route==="calendar")return inboxToCalendar(id);
  if(route==="knowledge")return inboxToKnowledge(id);
  if(route==="journal")return capture2ToJournal(id,false);
  if(route==="decision")return capture2ToJournal(id,true);
  if(route==="person")return capture2ToPerson(id);
  if(route==="tracker")return capture2ToTracker(id)
}
function ensureCapture2Ui(){
  if(document.getElementById("capture2Command"))return;const grid=document.querySelector("#today .grid");if(!grid)return;const anchor=document.getElementById("lifeOsCommand")?.closest(".card")||grid.firstElementChild;
  anchor?.insertAdjacentHTML("afterend",`<div data-ux7-view="focus" data-personal-widget="capture" class="card ux7-card span-12"><div><div class="eyebrow">Universal Capture 2.0</div><div class="section-title">Сначала зафиксировать, потом решить куда</div></div><div class="split" style="margin-top:10px"><textarea id="capture2Input" placeholder="Мысль, задача, решение, человек, показатель..." style="min-height:62px"></textarea><button class="btn secondary" onclick="capture2Add()">В Inbox</button></div><div id="capture2Command" style="margin-top:10px"></div></div>`);personalRegisterWidget("capture","Универсальный Inbox","today")
}
function renderCapture2(){
  const box=document.getElementById("capture2Command");if(!box||typeof inboxOpen!=="function")return;const rows=inboxOpen().slice(0,5);
  box.innerHTML=rows.length?rows.map(x=>{const s=capture2Suggest(x.text);return `<div class="log-item"><div class="split"><div><div class="qtitle">${escapeHtml(x.text)}</div><div class="qmeta">Предположение: ${capture2Label(s)} • ${escapeHtml(x.area||"Личное")}</div></div><button class="btn secondary small" onclick="capture2Route('${x.id}','${s}')">→ ${capture2Label(s)}</button></div><div class="split" style="margin-top:7px"><button class="btn ghost small" onclick="capture2Route('${x.id}','task')">Задача</button><button class="btn ghost small" onclick="capture2Route('${x.id}','calendar')">Событие</button><button class="btn ghost small" onclick="capture2Route('${x.id}','journal')">Дневник</button><button class="btn ghost small" onclick="capture2Route('${x.id}','person')">Человек</button><button class="btn ghost small" onclick="capture2Route('${x.id}','knowledge')">Знание</button><button class="btn ghost small" onclick="capture2Route('${x.id}','tracker')">Трекер</button></div></div>`}).join(""):'<div class="empty">Inbox пуст.</div>'
}
