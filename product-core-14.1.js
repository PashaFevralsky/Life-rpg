"use strict";

/* Life RPG 14.1 Product Core v1
   Product-shell consolidation only. No state migration and no external telemetry. */

const PRODUCT_CORE141_USAGE_KEY="life-rpg-product-usage-v1";
const PRODUCT_CORE141_USAGE_DAYS=45;
let PRODUCT_CORE141_EXPANDED=false;
let PRODUCT_CORE141_USAGE_BOUND=false;

function productCore141Today(){return document.getElementById("today")}
function productCore141Card(id){return document.getElementById(id)?.closest?.(".card")||null}

function productCore141EnsureCss(){
  if(document.getElementById("productCore141Css"))return;
  const s=document.createElement("style");s.id="productCore141Css";s.textContent=`
    #today.product-core141 .product-core141-primary{border-color:rgba(34,211,238,.22)}
    #today.product-core141 .product-core141-legacy{display:none!important}
    #today.product-core141:not(.product-core141-expanded) .product-core141-secondary{display:none!important}
    #today.product-core141 .product-core141-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    #today.product-core141 .product-core141-toolbar .btn{min-height:44px}
    #today.product-core141 .product-core141-note{margin-top:10px}
    #productUsage141List .product-usage141-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line,#242b36)}
    #productUsage141List .product-usage141-row:last-child{border-bottom:0}
    @media(max-width:520px){
      #today.product-core141 .product-core141-toolbar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
      #today.product-core141 .product-core141-toolbar .btn{padding-left:8px;padding-right:8px}
    }
  `;document.head.appendChild(s)
}

function productCore141MarkSecondary(id){
  const c=productCore141Card(id);if(c)c.classList.add("product-core141-secondary");return c
}
function productCore141MarkLegacy(id){
  const c=productCore141Card(id);if(c)c.classList.add("product-core141-legacy");return c
}

function productCore141SetExpanded(value,track=true){
  PRODUCT_CORE141_EXPANDED=!!value;
  const section=productCore141Today();if(section)section.classList.toggle("product-core141-expanded",PRODUCT_CORE141_EXPANDED);
  const b=document.querySelector('[data-product-core-action="details"]');
  if(b){b.setAttribute("aria-expanded",PRODUCT_CORE141_EXPANDED?"true":"false");b.textContent=PRODUCT_CORE141_EXPANDED?"Скрыть инструменты":"Инструменты"}
  if(track)productUsage141Track(PRODUCT_CORE141_EXPANDED?"today:tools-open":"today:tools-close")
}

function productCore141OpenCapture(){
  productUsage141Track("today:capture");
  const card=productCore141Card("capture2Command");
  card?.scrollIntoView?.({behavior:"smooth",block:"center"});
  setTimeout(()=>document.getElementById("inboxCaptureInput")?.focus(),120)
}

function productCore141OpenTask(){
  productUsage141Track("today:new-task");
  productCore141SetExpanded(true,false);
  const card=document.getElementById("taskEditorCard");
  if(card)card.hidden=false;
  const tasks=productCore141Card("tasksOsCommand");
  tasks?.scrollIntoView?.({behavior:"smooth",block:"start"});
  setTimeout(()=>document.getElementById("taskTitle")?.focus(),120)
}

function productCore141EnsureToolbar(primary){
  if(!primary||document.getElementById("productCore141Toolbar"))return;
  const command=document.getElementById("today123Command");if(!command)return;
  const bar=document.createElement("div");bar.id="productCore141Toolbar";bar.className="product-core141-toolbar";
  bar.innerHTML=`
    <button type="button" class="btn secondary small" data-product-core-action="capture">Inbox</button>
    <button type="button" class="btn secondary small" data-product-core-action="task">+ Задача</button>
    <button type="button" class="btn ghost small" data-product-core-action="details" aria-expanded="false">Инструменты</button>
  `;
  bar.querySelector('[data-product-core-action="capture"]')?.addEventListener("click",productCore141OpenCapture);
  bar.querySelector('[data-product-core-action="task"]')?.addEventListener("click",productCore141OpenTask);
  bar.querySelector('[data-product-core-action="details"]')?.addEventListener("click",()=>productCore141SetExpanded(!PRODUCT_CORE141_EXPANDED));
  command.insertAdjacentElement("beforebegin",bar);

  const note=document.createElement("div");note.id="productCore141Note";note.className="sub product-core141-note";
  note.textContent="Life OS, календарь, задачи и ограничения продолжают рассчитываться автоматически. Расширенные панели скрыты, пока они не нужны.";
  bar.insertAdjacentElement("afterend",note)
}

function productCore141MoveBossesToProgress(){
  const c=productCore141Card("lifeBosses");if(!c)return;
  c.dataset.ux7View="progress";c.classList.add("ux7-view-ready");
  const view=(globalThis.UX7_PREFS?.today||globalThis.UX7_DEFAULTS?.today||"focus");
  c.classList.toggle("ux7-hidden",view!=="progress")
}

function productCore141Apply(){
  const section=productCore141Today(),grid=section?.querySelector(".grid"),primary=productCore141Card("today123Command");
  if(!section||!grid||!primary)return;
  productCore141EnsureCss();section.classList.add("product-core141");section.classList.toggle("product-core141-expanded",PRODUCT_CORE141_EXPANDED);

  primary.classList.add("product-core141-primary");
  if(primary.dataset.productCore141!=="1"){
    primary.dataset.productCore141="1";
    const eyebrow=primary.querySelector(".eyebrow"),title=primary.querySelector(".section-title"),muted=primary.querySelector(".muted");
    if(eyebrow)eyebrow.textContent="Сегодня";
    if(title)title.textContent="Что делать сейчас";
    if(muted)muted.textContent="Один рабочий контур: обязательства, календарь, задачи и приоритеты уже сведены в исполнимую очередь.";
  }
  productCore141EnsureToolbar(primary);

  for(const id of ["lifeOsCommand","todayFlowCommand","decisionOsCommand","tasksOsCommand","routinesOsCommand","trackingOsCommand","focusOsCommand","executionOsCommand","today123Reserved","today123Deferred"]){
    productCore141MarkSecondary(id)
  }
  for(const id of ["dailyEngine","todayPriorities"])productCore141MarkLegacy(id);
  productCore141MoveBossesToProgress();

  if(grid.firstElementChild!==primary)grid.insertBefore(primary,grid.firstElementChild);
  const capture=productCore141Card("capture2Command");
  if(capture&&capture!==primary&&primary.nextElementSibling!==capture)primary.insertAdjacentElement("afterend",capture);

  productCore141SetExpanded(PRODUCT_CORE141_EXPANDED,false)
}

function productUsage141DateKey(){
  try{if(typeof localDateKey==="function")return localDateKey()}catch{}
  return new Date().toISOString().slice(0,10)
}
function productUsage141Read(){
  try{
    const x=JSON.parse(localStorage.getItem(PRODUCT_CORE141_USAGE_KEY)||"{}");
    if(!x||typeof x!=="object"||Array.isArray(x))return {version:1,days:{}};
    if(!x.days||typeof x.days!=="object"||Array.isArray(x.days))x.days={};
    x.version=1;return x
  }catch{return {version:1,days:{}}}
}
function productUsage141Write(x){
  try{localStorage.setItem(PRODUCT_CORE141_USAGE_KEY,JSON.stringify(x))}catch{}
}
function productUsage141Track(feature){
  feature=String(feature||"").trim();if(!feature)return;
  const x=productUsage141Read(),day=productUsage141DateKey(),bucket=x.days[day]||(x.days[day]={});
  bucket[feature]=Math.max(0,+bucket[feature]||0)+1;
  const keys=Object.keys(x.days).sort();while(keys.length>PRODUCT_CORE141_USAGE_DAYS){delete x.days[keys.shift()]}
  x.updatedAt=new Date().toISOString();productUsage141Write(x);productUsage141Render()
}
function productUsage141Totals(days=30){
  const x=productUsage141Read(),keys=Object.keys(x.days).sort().slice(-Math.max(1,days)),totals={};
  for(const day of keys)for(const [k,v] of Object.entries(x.days[day]||{}))totals[k]=(totals[k]||0)+Math.max(0,+v||0);
  return Object.entries(totals).map(([feature,count])=>({feature,count})).sort((a,b)=>b.count-a.count||a.feature.localeCompare(b.feature))
}
function productUsage141Label(feature){
  const map={
    "today:primary-action":"Главное действие дня",
    "today:capture":"Inbox",
    "today:new-task":"Новая задача",
    "today:tools-open":"Открытие инструментов дня",
    "today:tools-close":"Скрытие инструментов дня",
    "search":"Глобальный поиск",
    "recent":"Недавние действия"
  };
  if(map[feature])return map[feature];
  if(feature.startsWith("nav:"))return "Раздел: "+({"today":"Сегодня","finance":"Деньги","work":"Работа","tennis":"Теннис","more":"Ещё"}[feature.slice(4)]||feature.slice(4));
  if(feature.startsWith("quick:"))return "Quick Add: "+feature.slice(6);
  return feature
}
function productUsage141Render(){
  const box=document.getElementById("productUsage141List"),meta=document.getElementById("productUsage141Meta");if(!box)return;
  const rows=productUsage141Totals(30);
  if(meta)meta.textContent=rows.length?"Локально на устройстве • последние 30 дней":"Статистика появится после использования приложения";
  box.innerHTML=rows.length?rows.slice(0,10).map(x=>`<div class="product-usage141-row"><span>${escapeHtml(productUsage141Label(x.feature))}</span><b>${x.count}</b></div>`).join(""):'<div class="empty">Пока недостаточно данных.</div>'
}
function productUsage141Reset(){
  try{localStorage.removeItem(PRODUCT_CORE141_USAGE_KEY)}catch{}
  productUsage141Render();if(typeof toast==="function")toast("Статистика использования очищена")
}
function productUsage141Click(e){
  const el=e.target?.closest?.("button,[data-ui139-action]");if(!el)return;
  if(el.matches?.(".navbtn")&&el.dataset.tab){productUsage141Track(`nav:${el.dataset.tab}`);return}
  if(el.id==="ux128SearchBtn"){productUsage141Track("search");return}
  if(el.dataset?.ui139Action==="recent"){productUsage141Track("recent");return}
  if(el.dataset?.ux128Action){productUsage141Track(`quick:${el.dataset.ux128Action}`);return}
  if(el.closest?.("#today123Command")&&String(el.getAttribute("onclick")||"").includes("today123DoPrimary")){productUsage141Track("today:primary-action");return}
  const q=el.closest?.("#today .quick button");
  if(q){const m=String(q.getAttribute("onclick")||"").match(/quickAction\('([^']+)'\)/);if(m)productUsage141Track(`quick:${m[1]}`)}
}
function productUsage141Install(){
  if(PRODUCT_CORE141_USAGE_BOUND)return;PRODUCT_CORE141_USAGE_BOUND=true;
  document.addEventListener("click",productUsage141Click,{passive:true})
}
function productUsage141EnsureUi(){
  if(document.getElementById("productUsage141Card"))return;
  const grid=document.querySelector("#more .grid");if(!grid)return;
  grid.insertAdjacentHTML("beforeend",`<div id="productUsage141Card" data-ux7-view="settings" class="card ux7-card span-12">
    <div class="eyebrow">Product usage</div><div class="section-title">Что реально используется</div>
    <div class="muted" style="margin-top:6px">Счётчики хранятся только в localStorage этого устройства. Текст задач, финансов и заметок не записывается и никуда не отправляется.</div>
    <div id="productUsage141Meta" class="sub" style="margin-top:10px"></div>
    <div id="productUsage141List" style="margin-top:8px"></div>
    <button type="button" class="btn ghost small" style="margin-top:10px" onclick="productUsage141Reset()">Очистить статистику</button>
  </div>`)
}

function ensureProductCore141Ui(){
  productCore141EnsureCss();productUsage141Install();productUsage141EnsureUi();productCore141Apply()
}
function renderProductCore141(){
  productUsage141EnsureUi();productUsage141Render();productCore141Apply()
}
