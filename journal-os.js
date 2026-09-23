"use strict";

/* Journal / Reflection OS — daily reflection, decisions and revisit loop. */

function journalEntries(){return personalData().journal.filter(x=>x&&x.archived!==true)}
function journalDecisions(){return personalData().decisions.filter(x=>x&&x.archived!==true)}
function journalCreate(data={}){
  const x={id:uid(),dateKey:validDateKey(data.dateKey)?data.dateKey:localDateKey(),type:String(data.type||"note"),text:personalText(data.text),happened:personalText(data.happened),learned:personalText(data.learned),change:personalText(data.change),tags:Array.isArray(data.tags)?data.tags:[],createdAt:personalNow(),archived:false};
  if(!x.text&&!x.happened&&!x.learned&&!x.change)return null;
  personalData().journal.unshift(x);return x
}
async function journalQuickSave(){
  const happened=personalText(document.getElementById("journalHappened")?.value),learned=personalText(document.getElementById("journalLearned")?.value),change=personalText(document.getElementById("journalChange")?.value);
  const x=journalCreate({type:"reflection",happened,learned,change});
  if(!x){toast("Заполни хотя бы одно поле");return}
  for(const id of ["journalHappened","journalLearned","journalChange"]){const el=document.getElementById(id);if(el)el.value=""}
  audit("Рефлексия","system",x.happened||x.learned||x.change);await save("Рефлексия сохранена")
}
function journalDecisionCreate(data={}){
  const title=personalText(data.title);if(!title)return null;
  const x={id:uid(),title,rationale:personalText(data.rationale),dateKey:validDateKey(data.dateKey)?data.dateKey:localDateKey(),revisitDate:validDateKey(data.revisitDate)?data.revisitDate:personalDatePlus(30),status:"active",result:"",createdAt:personalNow(),reviewedAt:"",archived:false};
  personalData().decisions.unshift(x);return x
}
async function journalSaveDecision(){
  const title=personalText(document.getElementById("decisionTitle")?.value),rationale=personalText(document.getElementById("decisionRationale")?.value),revisitDate=document.getElementById("decisionRevisit")?.value||personalDatePlus(30);
  const x=journalDecisionCreate({title,rationale,revisitDate});if(!x){toast("Укажи решение");return}
  document.getElementById("decisionTitle").value="";document.getElementById("decisionRationale").value="";document.getElementById("decisionEditor").hidden=true;
  audit("Решение зафиксировано","system",title);await save("Решение сохранено")
}
function journalDueDecisions(){const t=localDateKey();return journalDecisions().filter(x=>x.status==="active"&&validDateKey(x.revisitDate)&&x.revisitDate<=t).sort((a,b)=>a.revisitDate.localeCompare(b.revisitDate))}
async function journalReviewDecision(id){
  const x=journalDecisions().find(q=>q.id===id);if(!x)return;
  const el=document.getElementById(`decisionResult_${id}`),result=personalText(el?.value);
  if(!result){toast("Запиши, что показало решение");return}
  x.result=result;x.status="reviewed";x.reviewedAt=personalNow();await save("Решение пересмотрено")
}
async function journalArchive(id,kind="journal"){
  const arr=kind==="decision"?personalData().decisions:personalData().journal,x=arr.find(q=>q.id===id);if(!x)return;x.archived=true;await save("Запись скрыта")
}
function journalWeekSummary(){
  const start=localDateKey(addDays(new Date(),-6)),tasks=(S.entities?.tasks||[]).filter(x=>x.status==="done"&&String(x.completedAt||"").slice(0,10)>=start),read=(S.readingLogs||[]).filter(x=>String(x.dateKey||"")>=start),tennis=(S.tennis||[]).filter(x=>String(x.dateKey||"")>=start),j=journalEntries().filter(x=>x.dateKey>=start),people=personalData().interactions.filter(x=>String(x.dateKey||"")>=start),events=typeof lifeTimelineEvents==="function"?lifeTimelineEvents(7):[],active=new Set(events.map(x=>x.dateKey)).size;
  const readMin=read.reduce((s,x)=>s+(+x.minutes||0),0),tennisMin=tennis.reduce((s,x)=>s+(+x.min||0),0),habit=typeof habitStrengthRows==="function"?habitStrengthRows():[],habitAvg=habit.length?habit.reduce((s,x)=>s+(+x.strength||0),0)/habit.length:null;
  return {tasks:tasks.length,readMin,tennis:tennis.length,tennisMin,journal:j.length,people:people.length,active,habitAvg}
}

async function journalSaveWeeklyReview(){
  const w=journalWeekSummary(),text=`Неделя: активных дней ${w.active}/7; задач закрыто ${w.tasks}; чтение ${w.readMin} мин; теннис ${w.tennis} сесс. (${w.tennisMin} мин); контактов ${w.people}; рефлексий ${w.journal}${w.habitAvg==null?"":`; средняя сила привычек ${Math.round(w.habitAvg)}%`}.`;
  journalCreate({type:"weekly",text});await save("Недельный обзор сохранён")
}

function ensureJournalOsUi(){
  if(document.getElementById("journalOsCommand"))return;const grid=document.querySelector("#more .grid");if(!grid)return;
  const anchor=document.getElementById("monthlyLifeReport")?.closest(".card")||grid.firstElementChild;
  const html=`<div data-ux7-view="overview" data-personal-widget="journal" class="card ux7-card span-12"><div class="split"><div><div class="eyebrow">Journal / Reflection OS</div><div class="section-title">Событие → вывод → изменение</div></div><button class="btn secondary small" onclick="document.getElementById('decisionEditor').hidden=false">+ Решение</button></div><div id="journalOsCommand" style="margin-top:10px"></div><button class="btn ghost small" style="margin-top:8px" onclick="journalSaveWeeklyReview()">Сохранить недельный обзор</button><div class="formgrid" style="margin-top:12px"><div class="field"><label>Что произошло</label><textarea id="journalHappened" placeholder="Факты без интерпретации"></textarea></div><div class="field"><label>Что понял</label><textarea id="journalLearned" placeholder="Вывод / наблюдение"></textarea></div><div class="field"><label>Что изменить</label><textarea id="journalChange" placeholder="Следующее изменение"></textarea></div></div><button class="btn" style="margin-top:10px" onclick="journalQuickSave()">Сохранить рефлексию</button><div class="title" style="margin-top:14px">Решения к пересмотру</div><div id="journalDueDecisions"></div><div class="title" style="margin-top:14px">Последние записи</div><div id="journalRecent"></div></div><div data-ux7-view="overview" class="card ux7-card span-12" id="decisionEditor" hidden><div class="title">Журнал решения</div><div class="formgrid" style="margin-top:10px"><div class="field"><label>Решение</label><input id="decisionTitle"></div><div class="field"><label>Вернуться к решению</label><input id="decisionRevisit" type="date" value="${personalDatePlus(30)}"></div><div class="field span-2"><label>Почему решил именно так</label><textarea id="decisionRationale"></textarea></div></div><div class="split" style="margin-top:10px"><button class="btn" onclick="journalSaveDecision()">Сохранить</button><button class="btn ghost" onclick="document.getElementById('decisionEditor').hidden=true">Отмена</button></div></div>`;
  anchor?.insertAdjacentHTML("afterend",html);personalRegisterWidget("journal","Журнал и решения","more")
}
function renderJournalOs(){
  const box=document.getElementById("journalOsCommand"),dueBox=document.getElementById("journalDueDecisions"),recent=document.getElementById("journalRecent");if(!box||!dueBox||!recent)return;
  const w=journalWeekSummary(),due=journalDueDecisions(),entries=journalEntries().slice(0,6);
  box.innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Активных дней 7д</div><b>${w.active}/7</b></div><div class="report-item"><div class="smallcaps">Задач закрыто</div><b>${w.tasks}</b></div><div class="report-item"><div class="smallcaps">Чтение</div><b>${w.readMin} мин</b></div><div class="report-item"><div class="smallcaps">Теннис</div><b>${w.tennis} сесс.</b></div><div class="report-item"><div class="smallcaps">Контакты с людьми</div><b>${w.people}</b></div><div class="report-item"><div class="smallcaps">Сила привычек</div><b>${w.habitAvg==null?"—":Math.round(w.habitAvg)+"%"}</b></div></div>`;
  dueBox.innerHTML=due.length?due.slice(0,5).map(x=>`<div class="log-item"><div class="qtitle">${escapeHtml(x.title)}</div><div class="qmeta">Решение ${x.dateKey} • пересмотр ${x.revisitDate}${x.rationale?` • ${escapeHtml(x.rationale)}`:""}</div><div class="split" style="margin-top:7px"><input id="decisionResult_${x.id}" placeholder="Что показала практика?"><button class="btn secondary small" onclick="journalReviewDecision('${x.id}')">Закрыть цикл</button></div></div>`).join(""):'<div class="empty">Нет решений, которые пора пересмотреть.</div>';
  recent.innerHTML=entries.length?entries.map(x=>`<div class="log-item"><div class="qtitle">${x.dateKey} • ${x.type==="reflection"?"Рефлексия":"Запись"}</div><div class="qmeta">${escapeHtml([x.text,x.happened,x.learned,x.change].filter(Boolean).join(" • "))}</div><button class="btn ghost small" style="margin-top:6px" onclick="journalArchive('${x.id}')">Скрыть</button></div>`).join(""):'<div class="empty">Записей пока нет.</div>'
}
