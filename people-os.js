"use strict";

/* People / Relationships OS — personal relationship memory, cadence and interactions. */

function peopleAll(){return personalData().people.filter(x=>x&&x.archived!==true)}
function peopleInteractions(){return personalData().interactions.filter(x=>x&&x.archived!==true)}
function peopleNormalize(x={}){return {id:String(x.id||uid()),name:personalText(x.name)||"Без имени",relation:personalText(x.relation)||"Другое",cadenceDays:clamp(Math.round(+x.cadenceDays||30),1,365),birthday:String(x.birthday||""),note:personalText(x.note),createdAt:String(x.createdAt||personalNow()),archived:!!x.archived}}
function peopleCreate(data={}){const x=peopleNormalize({...data,id:uid(),createdAt:personalNow()});personalData().people.unshift(x);return x}
function peopleFind(id){return peopleAll().find(x=>x.id===id)||null}
function peopleLastInteraction(personId){return peopleInteractions().filter(x=>x.personId===personId).sort((a,b)=>String(b.occurredAt||b.dateKey).localeCompare(String(a.occurredAt||a.dateKey)))[0]||null}
function peopleHealth(person){const last=peopleLastInteraction(person.id),days=last?personalDaysSince(last.occurredAt||last.dateKey):personalDaysSince(person.createdAt),cad=Math.max(1,+person.cadenceDays||30),ratio=days==null?0:days/cad,score=Math.round(clamp(100-ratio*60,0,100));return {last,days:days??0,due:days!=null&&days>=cad,score}}
function peopleDue(){return peopleAll().map(p=>({p,h:peopleHealth(p)})).filter(x=>x.h.due).sort((a,b)=>b.h.days-a.h.days)}
async function peopleSave(){
  const id=personalText(document.getElementById("peopleEditId")?.value),name=personalText(document.getElementById("peopleName")?.value);if(!name){toast("Укажи имя");return}
  const data={name,relation:personalText(document.getElementById("peopleRelation")?.value)||"Другое",cadenceDays:Math.max(1,+document.getElementById("peopleCadence")?.value||30),birthday:String(document.getElementById("peopleBirthday")?.value||""),note:personalText(document.getElementById("peopleNote")?.value)};
  const old=id?peopleAll().find(x=>x.id===id):null;if(old)Object.assign(old,data);else peopleCreate(data);
  for(const k of ["peopleEditId","peopleName","peopleBirthday","peopleNote"]){const el=document.getElementById(k);if(el)el.value=""}
  document.getElementById("peopleEditor").hidden=true;audit(old?"Контакт обновлён":"Контакт создан","system",name);await save(old?"Контакт обновлён":"Контакт добавлен")
}
function peopleEdit(id){const p=peopleFind(id);if(!p)return;const vals={peopleEditId:p.id,peopleName:p.name,peopleRelation:p.relation,peopleCadence:p.cadenceDays,peopleBirthday:p.birthday,peopleNote:p.note};for(const [k,v] of Object.entries(vals)){const el=document.getElementById(k);if(el)el.value=String(v??"")}document.getElementById("peopleEditor").hidden=false}
async function peopleAddInteraction(id){
  const p=peopleFind(id);if(!p)return;const el=document.getElementById(`peopleInteraction_${id}`),note=personalText(el?.value);
  personalData().interactions.unshift({id:uid(),personId:id,dateKey:localDateKey(),occurredAt:personalNow(),type:"contact",note,createdAt:personalNow(),archived:false});if(el)el.value="";
  audit("Контакт с человеком","system",p.name+(note?`: ${note}`:""));await save("Взаимодействие сохранено")
}
async function peopleArchive(id){const p=peopleFind(id);if(!p)return;p.archived=true;await save("Контакт скрыт")}
function peopleBirthdayDays(p){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(p.birthday||"")))return null;const [,m,d]=p.birthday.split("-").map(Number),now=new Date(),candidate=new Date(now.getFullYear(),m-1,d,12);if(candidate<new Date(now.getFullYear(),now.getMonth(),now.getDate(),0))candidate.setFullYear(candidate.getFullYear()+1);return Math.round((candidate-new Date(now.getFullYear(),now.getMonth(),now.getDate(),12))/86400000)
}
function ensurePeopleOsUi(){
  if(document.getElementById("peopleOsCommand"))return;const grid=document.querySelector("#more .grid");if(!grid)return;
  const anchor=document.querySelector('[data-personal-widget="journal"]')||grid.firstElementChild;
  anchor?.insertAdjacentHTML("afterend",`<div data-ux7-view="overview" data-personal-widget="people" class="card ux7-card span-12"><div class="split"><div><div class="eyebrow">People / Relationships</div><div class="section-title">Не терять важные связи</div></div><button class="btn secondary small" onclick="document.getElementById('peopleEditor').hidden=false;document.getElementById('peopleName').focus()">+ Человек</button></div><div id="peopleOsCommand" style="margin-top:10px"></div><div id="peopleOsList" style="margin-top:10px"></div></div><div data-ux7-view="overview" class="card ux7-card span-12" id="peopleEditor" hidden><div class="title">Человек</div><input id="peopleEditId" type="hidden"><div class="formgrid" style="margin-top:10px"><div class="field"><label>Имя</label><input id="peopleName"></div><div class="field"><label>Роль / отношение</label><input id="peopleRelation" placeholder="друг, семья, знакомый..."></div><div class="field"><label>Желаемая частота контакта, дней</label><input id="peopleCadence" type="number" min="1" value="30"></div><div class="field"><label>Дата рождения</label><input id="peopleBirthday" type="date"></div><div class="field span-2"><label>Что важно помнить</label><textarea id="peopleNote"></textarea></div></div><div class="split" style="margin-top:10px"><button class="btn" onclick="peopleSave()">Сохранить</button><button class="btn ghost" onclick="document.getElementById('peopleEditor').hidden=true">Отмена</button></div></div>`);personalRegisterWidget("people","Люди и отношения","more")
}
function renderPeopleOs(){
  const box=document.getElementById("peopleOsCommand"),list=document.getElementById("peopleOsList");if(!box||!list)return;const all=peopleAll(),due=peopleDue(),week=peopleInteractions().filter(x=>String(x.dateKey||"")>=localDateKey(addDays(new Date(),-6))).length,birthdays=all.map(p=>({p,d:peopleBirthdayDays(p)})).filter(x=>x.d!=null&&x.d<=30).sort((a,b)=>a.d-b.d);
  box.innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Людей</div><b>${all.length}</b></div><div class="report-item"><div class="smallcaps">Пора связаться</div><b>${due.length}</b></div><div class="report-item"><div class="smallcaps">Контактов 7 дней</div><b>${week}</b></div><div class="report-item"><div class="smallcaps">Дни рождения ≤30д</div><b>${birthdays.length}</b></div></div>${birthdays.length?`<div class="notice" style="margin-top:10px">${birthdays.slice(0,3).map(x=>`${escapeHtml(x.p.name)} — через ${x.d} дн.`).join(" • ")}</div>`:""}`;
  list.innerHTML=all.length?all.map(p=>{const h=peopleHealth(p);return `<div class="log-item"><div class="split"><div><div class="qtitle">${escapeHtml(p.name)} <span class="tag ${h.due?"warn":""}">${escapeHtml(p.relation)}</span></div><div class="qmeta">Последний контакт: ${h.last?h.days+" дн. назад":"ещё не зафиксирован"} • ритм ${p.cadenceDays} дн. • связь ${h.score}%</div>${p.note?`<div class="qmeta">${escapeHtml(p.note)}</div>`:""}</div><div class="split"><button class="btn ghost small" onclick="peopleEdit('${p.id}')">Изм.</button><button class="btn ghost small" onclick="peopleArchive('${p.id}')">×</button></div></div><div class="split" style="margin-top:8px"><input id="peopleInteraction_${p.id}" placeholder="О чём общались / договорились"><button class="btn secondary small" onclick="peopleAddInteraction('${p.id}')">Контакт ✓</button></div></div>`}).join(""):'<div class="empty">Добавь людей, которых действительно важно не терять из внимания.</div>'
}
