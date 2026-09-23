"use strict";

/* Focus / Timeboxing OS — plan vs fact, linked tasks and focus sessions. */

function focusTimeboxes(){return personalData().timeboxes.filter(x=>x&&x.archived!==true)}
function focusSessions(){return personalData().focusSessions.filter(x=>x&&x.archived!==true)}
function focusSyncLinkedTask(tb){const task=personalFindTask(tb?.taskId);if(task&&validDateKey(tb.dateKey)){task.plannedDate=tb.dateKey;task.updatedAt=personalNow()}return task}

function focusAutoCarry(){
  const p=personalData(),today=localDateKey();if(p.lastAutoCarryDate===today)return;
  const moved=focusTimeboxes().filter(x=>x.status==="planned"&&validDateKey(x.dateKey)&&x.dateKey<today);
  for(const x of moved){x.dateKey=today;x.startTime="";x.carryCount=Math.max(0,+x.carryCount||0)+1;focusSyncLinkedTask(x)}
  p.lastAutoCarryDate=today;
  if(moved.length)setTimeout(()=>save(`Автоперенос фокус-блоков: ${moved.length}`),0)
}

function focusToday(){const k=localDateKey();return focusTimeboxes().filter(x=>x.dateKey===k).sort((a,b)=>String(a.startTime||"99:99").localeCompare(String(b.startTime||"99:99")))}
function focusTaskOptions(selected=""){const rows=typeof taskActive==="function"?taskActive().slice().sort((a,b)=>(a.plannedDate===localDateKey()?0:1)-(b.plannedDate===localDateKey()?0:1)||a.priority-b.priority):[];return `<option value="">Без задачи</option>`+rows.map(x=>`<option value="${x.id}" ${x.id===selected?"selected":""}>${escapeHtml(x.title)}</option>`).join("")}
async function focusAddTimebox(){
  const taskId=String(document.getElementById("focusTask")?.value||""),task=personalFindTask(taskId),title=personalText(document.getElementById("focusTitle")?.value)||task?.title||"Фокус-блок",dateKey=String(document.getElementById("focusDate")?.value||localDateKey()),startTime=String(document.getElementById("focusStart")?.value||""),minutes=clamp(Math.round(+document.getElementById("focusMinutes")?.value||45),5,240);
  if(!validDateKey(dateKey)){toast("Укажи дату");return}
  const tb={id:uid(),taskId,title,dateKey,startTime,minutes,status:"planned",createdAt:personalNow(),archived:false};personalData().timeboxes.push(tb);focusSyncLinkedTask(tb);
  document.getElementById("focusTitle").value="";audit("Timebox создан","system",`${title} • ${minutes} мин`);await save("Фокус-блок добавлен")
}
async function focusStart(id){
  const tb=focusTimeboxes().find(x=>x.id===id);if(!tb)return;const p=personalData();if(p.activeFocus?.startedAt){toast("Сначала заверши активный фокус");return}const task=personalFindTask(tb.taskId);if(task?.timerStartedAt){toast("Сначала останови таймер этой задачи");return}focusSyncLinkedTask(tb);
  p.activeFocus={timeboxId:id,taskId:tb.taskId||"",title:tb.title,startedAt:personalNow()};tb.status="active";await save("Фокус начат")
}
async function focusStop(){
  const p=personalData(),a=p.activeFocus;if(!a?.startedAt)return;const minutes=Math.max(1,Math.round((Date.now()-Date.parse(a.startedAt))/60000)),tb=focusTimeboxes().find(x=>x.id===a.timeboxId);
  const session={id:uid(),timeboxId:a.timeboxId||"",taskId:a.taskId||"",title:a.title||tb?.title||"Фокус",dateKey:localDateKey(),startedAt:a.startedAt,endedAt:personalNow(),minutes,createdAt:personalNow(),archived:false};p.focusSessions.unshift(session);if(tb){tb.status="done";tb.actualMinutes=(+tb.actualMinutes||0)+minutes}
  const task=personalFindTask(a.taskId);if(task)task.actualMinutes=(+task.actualMinutes||0)+minutes;
  p.activeFocus={};if(minutes>=50)toast(`Фокус ${minutes} мин. Полезно сделать короткий перерыв.`);await save(`Фокус завершён: ${minutes} мин`)
}
async function focusCarry(id){const tb=focusTimeboxes().find(x=>x.id===id);if(!tb)return;tb.dateKey=personalDatePlus(1);tb.status="planned";tb.startTime="";focusSyncLinkedTask(tb);await save("Перенесено на завтра")}
async function focusArchive(id){const tb=focusTimeboxes().find(x=>x.id===id);if(!tb)return;tb.archived=true;await save("Фокус-блок скрыт")}
function focusStats(days=30){
  const start=localDateKey(addDays(new Date(),-(days-1))),boxes=focusTimeboxes().filter(x=>x.dateKey>=start),sessions=focusSessions().filter(x=>x.dateKey>=start),planned=boxes.reduce((s,x)=>s+(+x.minutes||0),0),actual=sessions.reduce((s,x)=>s+(+x.minutes||0),0),paired=boxes.filter(x=>(+x.actualMinutes||0)>0&&(+x.minutes||0)>0),ratios=paired.map(x=>x.actualMinutes/x.minutes),ratio=ratios.length?ratios.reduce((a,b)=>a+b,0)/ratios.length:null;return {planned,actual,blocks:boxes.length,sessions:sessions.length,ratio}
}
function focusTodayPlanFromTasks(){
  if(typeof taskActive!=="function")return 0;return taskActive().filter(x=>x.plannedDate===localDateKey()).reduce((s,x)=>s+(+x.minutes||0),0)
}
function ensureFocusOsUi(){
  if(document.getElementById("focusOsCommand"))return;const grid=document.querySelector("#today .grid");if(!grid)return;const anchor=document.getElementById("trackingOsCommand")?.closest(".card")||document.getElementById("tasksOsCommand")?.closest(".card")||grid.firstElementChild;
  anchor?.insertAdjacentHTML("afterend",`<div data-ux7-view="focus" data-personal-widget="focus" class="card ux7-card span-12"><div class="split"><div><div class="eyebrow">Focus / Timeboxing</div><div class="section-title">План времени → фактический фокус</div></div><button class="btn secondary small" data-testid="focus-add" onclick="document.getElementById('focusEditor').hidden=false;focusSyncTaskSelect()">+ Блок</button></div><div id="focusOsCommand" style="margin-top:10px"></div><div id="focusActive" style="margin-top:10px"></div><div id="focusTodayList" style="margin-top:10px"></div></div><div data-ux7-view="focus" class="card ux7-card span-12" id="focusEditor" hidden><div class="title">Новый timebox</div><div class="formgrid" style="margin-top:10px"><div class="field"><label>Связанная задача</label><select id="focusTask"></select></div><div class="field"><label>Название</label><input id="focusTitle" placeholder="если без задачи"></div><div class="field"><label>Дата</label><input id="focusDate" type="date" value="${localDateKey()}"></div><div class="field"><label>Старт</label><input id="focusStart" type="time"></div><div class="field"><label>План, мин</label><input id="focusMinutes" type="number" min="5" max="240" value="45"><div class="split" style="margin-top:5px"><button class="btn ghost small" onclick="document.getElementById('focusMinutes').value=25">25</button><button class="btn ghost small" onclick="document.getElementById('focusMinutes').value=50">50</button></div></div></div><div class="split" style="margin-top:10px"><button class="btn" onclick="focusAddTimebox()">Добавить</button><button class="btn ghost" onclick="document.getElementById('focusEditor').hidden=true">Отмена</button></div></div>`);personalRegisterWidget("focus","Фокус и timeboxing","today");focusSyncTaskSelect()
}
function focusSyncTaskSelect(){const el=document.getElementById("focusTask");if(el){const cur=el.value;el.innerHTML=focusTaskOptions(cur);if(cur)el.value=cur}}
function renderFocusOs(){
  const box=document.getElementById("focusOsCommand"),active=document.getElementById("focusActive"),list=document.getElementById("focusTodayList");if(!box||!active||!list)return;focusSyncTaskSelect();focusAutoCarry();const s=focusStats(30),today=focusToday(),a=personalData().activeFocus,taskPlan=focusTodayPlanFromTasks();
  box.innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">План сегодня</div><b>${today.reduce((n,x)=>n+(+x.minutes||0),0)} мин</b></div><div class="report-item"><div class="smallcaps">Задачи сегодня</div><b>${taskPlan} мин</b></div><div class="report-item"><div class="smallcaps">Фокус 30 дней</div><b>${s.actual} мин</b></div><div class="report-item"><div class="smallcaps">Ошибка оценки</div><b>${s.ratio==null?"—":Math.round(s.ratio*100)+"%"}</b><div class="sub">${s.ratio==null?"нужны завершённые блоки":s.ratio>1.15?"обычно недооцениваешь":s.ratio<.85?"обычно переоцениваешь":"оценка близка к факту"}</div></div></div>`;
  active.innerHTML=a?.startedAt?`<div class="notice"><div class="split"><div><b>Сейчас: ${escapeHtml(a.title||"Фокус")}</b><div class="sub">старт ${new Date(a.startedAt).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</div></div><button class="btn secondary" onclick="focusStop()">■ Завершить</button></div></div>`:"";
  list.innerHTML=today.length?today.map(x=>`<div class="quest"><span class="tag ${x.status==="done"?"good":x.status==="active"?"warn":""}">${x.startTime||"—"}</span><div class="qbody"><div class="qtitle">${escapeHtml(x.title)}</div><div class="qmeta">план ${x.minutes} мин${x.actualMinutes?` • факт ${x.actualMinutes} мин`:""}${x.taskId?" • задача":""}</div></div><div class="split">${x.status!=="done"?`<button class="btn secondary small" onclick="focusStart('${x.id}')">▶</button><button class="btn ghost small" onclick="focusCarry('${x.id}')">→ завтра</button>`:""}<button class="btn ghost small" onclick="focusArchive('${x.id}')">×</button></div></div>`).join(""):'<div class="empty">На сегодня timebox-блоков нет.</div>'
}
