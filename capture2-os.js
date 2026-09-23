"use strict";

/* Universal Capture 2.0 — one capture surface over the existing Inbox store. */
function capture2Suggest(text){
  const s=String(text||"").toLowerCase();
  if(/решил|решение|выбираю|оставляю/.test(s))return "decision";
  if(/позвонить|сделать|купить|написать|заказать|проверить|забрать|отправить/.test(s))return "task";
  if(/встреча|приём|запись|турнир|тренировка|в \d{1,2}[:.]\d{2}|завтра|сегодня/.test(s))return "calendar";
  if(/идея|книга|прочитал|мысль|тезис|цитата/.test(s))return "knowledge";
  if(/сон|вес|настроение|энергия|восстановление|вода/.test(s))return "tracker";
  if(/говорил|созвонился|встретил|общался|написал/.test(s))return "person";
  return "journal"
}
function capture2Label(route){return ({decision:"Решение",task:"Задача",calendar:"Календарь",project:"Проект",crm:"CRM",knowledge:"Знание",tracker:"Трекер",person:"Человек",journal:"Дневник"})[route]||route}
async function capture2Add(){const el=document.getElementById("inboxCaptureInput"),x=inboxCapture(el?.value);if(!x){toast("Запиши мысль");return}if(el)el.value="";audit("Universal capture","system",x.text);await save("Записано во входящие")}
async function capture2ToJournal(id,decision=false){const x=inboxAll().find(q=>q.id===id);if(!x)return;if(decision)journalDecisionCreate({title:x.text,revisitDate:personalDatePlus(30)});else journalCreate({type:"note",text:x.text});markInboxProcessed(x,decision?"decision":"journal");await save(decision?"Inbox → решение":"Inbox → дневник")}
function capture2KnownPerson(text){const s=personalText(text).toLowerCase();return peopleAll().find(p=>{const n=p.name.toLowerCase();return n.length>=2&&(s===n||s.includes(n))})||null}
function capture2ParsePerson(text){const s=personalText(text),m=s.match(/^([^:—-]{2,50})\s*[:—-]\s*(.+)$/);return m?{name:m[1].trim(),note:m[2].trim()}:null}
async function capture2ToPerson(id){
  const x=inboxAll().find(q=>q.id===id);if(!x)return;let person=capture2KnownPerson(x.text),note=x.text;
  if(!person){const p=capture2ParsePerson(x.text);if(!p){toast("Для нового человека используй формат «Имя: что важно запомнить»");return}person=peopleCreate({name:p.name,relation:"Другое",cadenceDays:30,note:"Создано из Inbox"});note=p.note}
  personalData().interactions.unshift({id:uid(),personId:person.id,dateKey:localDateKey(),occurredAt:personalNow(),type:"note",note,createdAt:personalNow(),archived:false});markInboxProcessed(x,"person",person.id);await save("Inbox → человек")
}
function capture2TrackerMatch(text){const s=String(text||"").toLowerCase(),n=String(text||"").match(/[-+]?\d+(?:[.,]\d+)?/),value=n?Number(n[0].replace(",",".")):NaN,trackers=typeof growthTrackers==="function"?growthTrackers():[],t=trackers.find(x=>s.includes(String(x.name||"").toLowerCase()));return t&&Number.isFinite(value)?{t,value}:null}
async function capture2ToTracker(id){const x=inboxAll().find(q=>q.id===id);if(!x)return;const m=capture2TrackerMatch(x.text);if(!m){toast("Формат: название трекера + число, например «Сон 7.5»");return}growthLogEvent(m.t.id,{value:m.value,note:"Из Inbox"});markInboxProcessed(x,"tracker",m.t.id);await save("Inbox → трекер")}
async function capture2Route(id,route){
  if(route==="task")return inboxToTask(id);if(route==="calendar")return inboxToCalendar(id);if(route==="project")return inboxToProject(id);if(route==="crm")return inboxToCrm(id);if(route==="knowledge")return inboxToKnowledge(id);if(route==="journal")return capture2ToJournal(id,false);if(route==="decision")return capture2ToJournal(id,true);if(route==="person")return capture2ToPerson(id);if(route==="tracker")return capture2ToTracker(id)
}
function ensureCapture2Ui(){
  if(document.getElementById("capture2Command"))return;const grid=document.querySelector("#today .grid");if(!grid)return;const anchor=document.getElementById("lifeOsCommand")?.closest(".card")||grid.firstElementChild;
  anchor?.insertAdjacentHTML("afterend",`<div data-ux7-view="focus" data-personal-widget="capture" class="card ux7-card span-12"><div><div class="eyebrow">Universal Capture</div><div class="section-title">Один Inbox для всего</div></div><div class="split" style="margin-top:10px"><textarea id="inboxCaptureInput" placeholder="Мысль, задача, решение, человек, показатель..." style="min-height:62px"></textarea><button class="btn secondary" onclick="captureInbox()">В Inbox</button></div><div id="capture2Command" style="margin-top:10px"><div id="inboxOsCommand"></div></div></div>`);personalRegisterWidget("capture","Универсальный Inbox","today")
}
function renderCapture2(){
  const box=document.getElementById("inboxOsCommand");if(!box)return;
  const rows=inboxOpen().slice(0,8),deals=(S.crmDeals||[]).filter(d=>!["Выиграно","Проиграно"].includes(d.stage));
  const routes=[["task","→ Задача"],["calendar","Событие"],["project","Проект"],["decision","Решение"],["journal","Дневник"],["person","Человек"],["knowledge","Знание"],["tracker","Трекер"]];
  box.innerHTML=rows.length?rows.map(x=>{
    const s=capture2Suggest(x.text);
    const alternatives=routes.filter(([route])=>route!==s).map(([route,label])=>`<button class="btn ghost small" onclick="capture2Route('${x.id}','${route}')">${label}</button>`).join("");
    return `<div class="log-item"><div class="split"><div><div class="qtitle">${escapeHtml(x.text)}</div><div class="qmeta">Предположение: ${capture2Label(s)} • ${escapeHtml(x.area||"Личное")}${x.dateKey?` • ${fmtDate(parseLocal(x.dateKey))}`:""}</div></div><button class="btn secondary small" onclick="capture2Route('${x.id}','${s}')">→ ${capture2Label(s)}</button></div><div class="split" style="margin-top:7px">${alternatives}</div>${deals.length?`<div class="split" style="margin-top:7px"><select id="inboxCrm_${x.id}"><option value="">CRM-сделка…</option>${deals.map(d=>`<option value="${d.id}">${escapeHtml(d.name||"Сделка")}</option>`).join("")}</select><button class="btn ghost small" onclick="capture2Route('${x.id}','crm')">→ CRM</button><button class="btn ghost small" onclick="discardInbox('${x.id}')">×</button></div>`:`<button class="btn ghost small" style="margin-top:7px" onclick="discardInbox('${x.id}')">Закрыть</button>`}</div>`
  }).join(""):'<div class="empty">Inbox пуст.</div>'
}
