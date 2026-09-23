"use strict";

/* Home OS — chores, inventory and shopping. */

function homeChores(){return personalData().chores.filter(x=>x&&x.archived!==true)}
function homeInventory(){return personalData().inventory.filter(x=>x&&x.archived!==true)}
function homeShopping(){return personalData().shopping.filter(x=>x&&x.done!==true)}
function homeChoreDueDate(c){if(validDateKey(c.nextDue))return c.nextDue;const last=String(c.lastDone||c.createdAt||"").slice(0,10);return validDateKey(last)?personalDatePlus(+c.cadenceDays||7,parseLocal(last)):localDateKey()}
function homeDueChores(){const t=localDateKey();return homeChores().map(c=>({c,due:homeChoreDueDate(c)})).filter(x=>x.due<=t).sort((a,b)=>a.due.localeCompare(b.due))}
async function homeAddChore(){
  const title=personalText(document.getElementById("homeChoreTitle")?.value);if(!title){toast("Укажи дело");return}const cadenceDays=clamp(Math.round(+document.getElementById("homeChoreCadence")?.value||7),1,365);
  personalData().chores.push({id:uid(),title,cadenceDays,createdAt:personalNow(),lastDone:"",nextDue:localDateKey(),archived:false});document.getElementById("homeChoreTitle").value="";await save("Домашнее дело добавлено")
}
async function homeCompleteChore(id){const c=homeChores().find(x=>x.id===id);if(!c)return;c.lastDone=localDateKey();c.nextDue=personalDatePlus(+c.cadenceDays||7);personalData().choreLogs.unshift({id:uid(),choreId:id,dateKey:localDateKey(),createdAt:personalNow()});await save("Дело выполнено")}
async function homeArchiveChore(id){const c=homeChores().find(x=>x.id===id);if(c){c.archived=true;await save("Дело скрыто")}}
async function homeAddInventory(){
  const name=personalText(document.getElementById("homeItemName")?.value);if(!name){toast("Укажи предмет");return}const qty=Math.max(0,+document.getElementById("homeItemQty")?.value||0),minQty=Math.max(0,+document.getElementById("homeItemMin")?.value||0),unit=personalText(document.getElementById("homeItemUnit")?.value);
  personalData().inventory.push({id:uid(),name,qty,minQty,unit,createdAt:personalNow(),archived:false});document.getElementById("homeItemName").value="";await save("Запас добавлен")
}
async function homeAdjustInventory(id,delta){const x=homeInventory().find(q=>q.id===id);if(!x)return;x.qty=Math.max(0,(+x.qty||0)+delta);await save("Остаток обновлён")}
async function homeAddInventoryToShopping(id){const x=homeInventory().find(q=>q.id===id);if(!x)return;return homeAddShopping(x.name,x.id)}
async function homeAddShopping(name="",inventoryId=""){
  if(!name){name=personalText(document.getElementById("homeShoppingInput")?.value);if(!name){toast("Укажи покупку");return}}
  if(!personalData().shopping.some(x=>x.done!==true&&x.name.toLowerCase()===name.toLowerCase()))personalData().shopping.push({id:uid(),name,inventoryId,createdAt:personalNow(),done:false});
  const el=document.getElementById("homeShoppingInput");if(el)el.value="";await save("Добавлено в покупки")
}
async function homeBought(id){const x=personalData().shopping.find(q=>q.id===id);if(!x)return;x.done=true;x.doneAt=personalNow();if(x.inventoryId){const item=homeInventory().find(q=>q.id===x.inventoryId);if(item)item.qty=Math.max(+item.qty||0,+item.minQty||0)}await save("Покупка отмечена")}
function ensureHomeOsUi(){
  if(document.getElementById("homeOsCommand"))return;const grid=document.querySelector("#more .grid");if(!grid)return;const anchor=document.querySelector('[data-personal-widget="body"]')||grid.firstElementChild;
  anchor?.insertAdjacentHTML("afterend",`<div data-ux7-view="overview" data-personal-widget="home" class="card ux7-card span-12"><div><div class="eyebrow">Home OS</div><div class="section-title">Быт без удержания в голове</div></div><div id="homeOsCommand" style="margin-top:10px"></div><div class="grid" style="margin-top:10px"><div class="card span-6"><div class="title">Повторяющиеся дела</div><div class="split" style="margin-top:8px"><input id="homeChoreTitle" placeholder="Например: фильтр, уборка"><input id="homeChoreCadence" type="number" min="1" value="7" style="max-width:110px"><button class="btn secondary small" onclick="homeAddChore()">+</button></div><div id="homeChoresList" style="margin-top:8px"></div></div><div class="card span-6"><div class="title">Запасы и покупки</div><div class="formgrid" style="margin-top:8px"><div class="field"><input id="homeItemName" placeholder="Предмет"></div><div class="field"><input id="homeItemQty" type="number" min="0" step="any" placeholder="Есть"></div><div class="field"><input id="homeItemMin" type="number" min="0" step="any" placeholder="Мин."></div><div class="field"><input id="homeItemUnit" placeholder="шт, л..."></div></div><button class="btn ghost small" style="margin-top:6px" onclick="homeAddInventory()">Добавить запас</button><div id="homeInventoryList" style="margin-top:8px"></div><div class="split" style="margin-top:8px"><input id="homeShoppingInput" placeholder="В список покупок"><button class="btn secondary small" onclick="homeAddShopping()">+</button></div><div id="homeShoppingList" style="margin-top:8px"></div></div></div></div>`);personalRegisterWidget("home","Дом и быт","more")
}
function renderHomeOs(){
  const box=document.getElementById("homeOsCommand"),chores=document.getElementById("homeChoresList"),inv=document.getElementById("homeInventoryList"),shop=document.getElementById("homeShoppingList");if(!box||!chores||!inv||!shop)return;const due=homeDueChores(),low=homeInventory().filter(x=>(+x.qty||0)<= (+x.minQty||0)),shopping=homeShopping();
  box.innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Дел пора</div><b>${due.length}</b></div><div class="report-item"><div class="smallcaps">Запасов мало</div><b>${low.length}</b></div><div class="report-item"><div class="smallcaps">Покупок</div><b>${shopping.length}</b></div></div>`;
  chores.innerHTML=homeChores().length?homeChores().map(c=>{const dueDate=homeChoreDueDate(c),late=dueDate<=localDateKey();return `<div class="quest"><span class="tag ${late?"warn":""}">${dueDate}</span><div class="qbody"><div class="qtitle">${escapeHtml(c.title)}</div><div class="qmeta">каждые ${c.cadenceDays} дн.</div></div><div class="split"><button class="btn secondary small" onclick="homeCompleteChore('${c.id}')">✓</button><button class="btn ghost small" onclick="homeArchiveChore('${c.id}')">×</button></div></div>`}).join(""):'<div class="empty">Домашних циклов пока нет.</div>';
  inv.innerHTML=homeInventory().length?homeInventory().map(x=>`<div class="log-item"><div class="split"><div><div class="qtitle">${escapeHtml(x.name)}</div><div class="qmeta">${x.qty} ${escapeHtml(x.unit||"")} • минимум ${x.minQty}</div></div><div class="split"><button class="btn ghost small" onclick="homeAdjustInventory('${x.id}',-1)">−</button><button class="btn ghost small" onclick="homeAdjustInventory('${x.id}',1)">+</button>${(+x.qty||0)<= (+x.minQty||0)?`<button class="btn secondary small" onclick="homeAddInventoryToShopping('${x.id}')">Купить</button>`:""}</div></div></div>`).join(""):'<div class="empty">Запасов пока нет.</div>';
  shop.innerHTML=shopping.length?shopping.map(x=>`<div class="quest"><div class="qbody"><div class="qtitle">${escapeHtml(x.name)}</div></div><button class="btn secondary small" onclick="homeBought('${x.id}')">Куплено</button></div>`).join(""):'<div class="empty">Список покупок пуст.</div>'
}
