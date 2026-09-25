"use strict";

/* Knowledge OS 12.4 — daily reading prescription, unified review queue,
   linear 27-book track and application feedback loop. Additive layer. */

const KNOWLEDGE124_TRACK=[
  [1,"Стюарт Ричи","Наукообразная чушь"],[2,"Эпиктет","Энхиридион"],[3,"Роберт Сапольски","Биология добра и зла"],[4,"Сенека","О краткости жизни"],[5,"Эллиот Аронсон","Общественное животное"],[6,"Ли Росс, Ричард Нисбетт","Человек и ситуация. Уроки социальной психологии"],[7,"Эпиктет","Беседы"],[8,"Кэрол Таврис, Эллиот Аронсон","Ошибки, которые были допущены (но не мной)"],[9,"Сенека","О спокойствии духа"],[10,"Джозеф Хенрик","Секрет нашего успеха"],[11,"Герд Гигеренцер","Понимать риски. Как выбирать правильный курс"],[12,"Марк Аврелий","Наедине с собой"],[13,"Даниэль Канеман, Оливье Сибони, Касс Санстейн","Шум. Несовершенство человеческих суждений"],[14,"Станислас Деан","Сознание и мозг"],[15,"Лиза Фельдман Барретт","Как рождаются эмоции"],[16,"Сенека","О блаженной жизни"],[17,"Даниэль Канеман","Думай медленно… решай быстро"],[18,"Ричард Талер, Касс Санстейн","Nudge. Архитектура выбора"],[19,"Нил Рэкхем","СПИН-продажи"],[20,"Роберт Чалдини","Психология влияния"],[21,"Роджер Фишер, Уильям Юри, Брюс Паттон","Переговоры без поражения"],[22,"Крис Восс","Никаких компромиссов"],[23,"Уильям Юри","Преодолевая „нет“"],[24,"Роберт Чалдини","Пре-убеждение"],[25,"Ноа Гольдштейн, Стив Мартин, Роберт Чалдини","Психология убеждения. 50 доказанных способов быть убедительным"],[26,"Джордж Саймон","Манипулятор в овечьей шкуре"],[27,"Сенека","Нравственные письма к Луцилию"]
].map(([order,author,title])=>({order,author,title}));

function knowledge124Identity(author,title){
  if(typeof bookIdentityKey==="function")return bookIdentityKey(author,title);
  const n=s=>String(s||"").normalize("NFKC").toLowerCase().replace(/[«»„“”"'’]/g,"").replace(/\s+/g," ").trim();
  return `${n(author)}|${n(title)}`
}
function knowledge124TrackState(){
  const map=new Map((S.books||[]).map(b=>[knowledge124Identity(b.author,b.title),b]));
  const rows=KNOWLEDGE124_TRACK.map(x=>({...x,book:map.get(knowledge124Identity(x.author,x.title))||null}));
  const done=rows.filter(x=>x.book?.status==="done").length,present=rows.filter(x=>x.book).length,missing=rows.filter(x=>!x.book);
  const active=rows.find(x=>x.book?.status==="reading")||null;
  const next=rows.find(x=>x.book?.status==="queued")||rows.find(x=>!x.book)||null;
  return {rows,done,present,missing,total:rows.length,active,next,remaining:rows.length-done,progress:rows.length?done/rows.length*100:0}
}
async function knowledge124SyncTrack(){
  if(typeof createPreActionSnapshot==="function")await createPreActionSnapshot("Перед синхронизацией основного трека чтения");
  const map=new Map((S.books||[]).map(b=>[knowledge124Identity(b.author,b.title),b])),added=[];let aligned=0;
  for(const item of KNOWLEDGE124_TRACK){
    const key=knowledge124Identity(item.author,item.title),b=map.get(key);
    if(b){if(["queued","paused"].includes(b.status)&&+b.readingOrder!==item.order){b.readingOrder=item.order;aligned++}continue}
    const book={id:uid(),title:item.title,author:item.author,totalPages:0,currentPage:0,status:"queued",readingOrder:item.order,created:localDateKey(),started:"",notes:"",source:"reading-list-27-12.4"};
    S.books.push(book);map.set(key,book);added.push(book)
  }
  audit("Основной трек чтения синхронизирован","knowledge",`${added.length} добавлено • ${aligned} позиций выровнено`);
  await save(`Трек 27 книг: добавлено ${added.length}`)
}
function knowledge124UnifiedReviewQueue(){
  const out=[];
  if(typeof knowledgeReviewQueue==="function")for(const x of knowledgeReviewQueue()){
    const st=typeof knowledgeReviewState==="function"?knowledgeReviewState(x):null,b=(S.books||[]).find(z=>z.id===x.bookId),dueKey=st?.dueAt?localDateKey(st.dueAt):String(x.dateKey||localDateKey());
    out.push({token:`read:${x.id}`,source:"reading",id:x.id,bookId:x.bookId,book:b?.title||"Книга",text:String(x.note||x.application||""),dueKey,round:st?.count||0})
  }
  if(typeof knowledgeGrowthDueNotes==="function")for(const x of knowledgeGrowthDueNotes()){
    const b=(S.books||[]).find(z=>z.id===x.bookId),dueKey=String(x.nextReviewAt||x.dateKey||localDateKey()).slice(0,10);
    out.push({token:`growth:${x.id}`,source:"growth",id:x.id,bookId:x.bookId,book:b?.title||"Книга",text:String(x.text||""),dueKey,round:+x.reviewCount||0})
  }
  const seen=new Set();return out.sort((a,b)=>a.dueKey.localeCompare(b.dueKey)||a.token.localeCompare(b.token)).filter(x=>{const k=`${x.source}:${x.id}`;if(seen.has(k))return false;seen.add(k);return true})
}
async function knowledge124Review(token){
  const [source,...rest]=String(token||"").split(":"),id=rest.join(":");
  if(source==="read"&&typeof markKnowledgeReviewed==="function")return markKnowledgeReviewed(id);
  if(source==="growth"&&typeof knowledgeGrowthReview==="function")return knowledgeGrowthReview(id)
}
function knowledge124DaysOverdue(dateKey){
  if(!validDateKey(dateKey))return 0;return Math.max(0,Math.floor((parseLocal(localDateKey())-parseLocal(dateKey))/86400000))
}
function knowledge124ApplicationStore(){
  if(!S.settings.knowledge124ApplicationResults||typeof S.settings.knowledge124ApplicationResults!=="object"||Array.isArray(S.settings.knowledge124ApplicationResults))S.settings.knowledge124ApplicationResults={};
  return S.settings.knowledge124ApplicationResults
}
function knowledge124Applications(){
  const rows=[];
  for(const x of S.readingLogs||[])if(String(x.application||"").trim()){
    const b=(S.books||[]).find(z=>z.id===x.bookId);rows.push({token:`read:${x.id}`,book:b?.title||"Книга",text:String(x.application).trim(),thesis:String(x.note||"").trim(),dateKey:x.dateKey||""})
  }
  if(typeof knowledgeGrowthNotes==="function")for(const x of knowledgeGrowthNotes())if(x.type==="application"&&String(x.text||"").trim()){
    const b=(S.books||[]).find(z=>z.id===x.bookId);rows.push({token:`growth:${x.id}`,book:b?.title||"Книга",text:String(x.text).trim(),thesis:"",dateKey:x.dateKey||""})
  }
  const store=knowledge124ApplicationStore();return rows.map(x=>({...x,result:store[x.token]||null})).sort((a,b)=>String(a.dateKey).localeCompare(String(b.dateKey)))
}
function knowledge124ApplicationCandidate(){return knowledge124Applications().find(x=>!x.result)||null}
async function knowledge124RecordApplication(token,result){
  if(!["worked","mixed","failed"].includes(result))return;
  const item=knowledge124Applications().find(x=>x.token===token);if(!item)return;
  knowledge124ApplicationStore()[token]={result,dateKey:localDateKey(),updatedAt:new Date().toISOString()};
  audit("Результат применения знания","knowledge",`${result} • ${item.book}`);await save("Результат применения сохранён")
}
function knowledge124ApplicationStats(){
  const a=knowledge124Applications(),tested=a.filter(x=>x.result),count=k=>tested.filter(x=>x.result?.result===k).length;
  return {all:a.length,tested:tested.length,pending:a.length-tested.length,worked:count("worked"),mixed:count("mixed"),failed:count("failed")}
}
function knowledge124TodayCapture(){
  const today=localDateKey(),logs=(S.readingLogs||[]).filter(x=>x.dateKey===today),captured=logs.some(x=>String(x.note||"").trim()||String(x.application||"").trim());
  const growth=typeof knowledgeGrowthNotes==="function"?knowledgeGrowthNotes().some(x=>x.dateKey===today):false;
  return {sessions:logs.length,captured:captured||growth}
}
function knowledge124TodayPlan(){
  const book=currentBook(),target=Math.max(1,Math.round(+S.settings.readingDailyMin||30)),today=typeof readingTodayMinutes==="function"?readingTodayMinutes():0,remainingMin=Math.max(0,target-today),v=typeof readingVelocityData==="function"?readingVelocityData(28):null,reviews=knowledge124UnifiedReviewQueue(),capture=knowledge124TodayCapture(),app=knowledge124ApplicationCandidate(),track=knowledge124TrackState(),actions=[];
  let pages=null;if(book&&remainingMin>0&&v?.pagesPerHour>0)pages=Math.min(Math.max(0,(+book.totalPages||0)-(+book.currentPage||0)),Math.max(1,Math.ceil(v.pagesPerHour*remainingMin/60)));
  if(!book){const q=typeof nextQueuedBook==="function"?nextQueuedBook():null;if(q)actions.push({kind:"book",title:`Начать: ${q.title}`,meta:"Следующая книга по текущей очереди.",bookId:q.id,minutes:0});else if(track.missing.length)actions.push({kind:"track",title:"Синхронизировать основной трек из 27 книг",meta:`В приложении отсутствует ${track.missing.length} книг из основного списка.`,minutes:5})}
  else if(remainingMin>0)actions.push({kind:"read",title:`Читать ${remainingMin} мин`,meta:`${book.title}${pages!=null?` • ориентир ~${pages} стр.`:""} • сегодня ${today}/${target} мин.`,bookId:book.id,minutes:remainingMin,pages});
  if(reviews.length)actions.push({kind:"review",title:`Повторить ${Math.min(3,reviews.length)} тезиса`,meta:`Всего в объединённой очереди: ${reviews.length}.`,minutes:Math.min(15,Math.max(5,reviews.length*3))});
  if(today>0&&!capture.captured)actions.push({kind:"capture",title:"Зафиксировать один вывод",meta:"После сегодняшнего чтения ещё нет тезиса или применения.",minutes:5});
  if(app)actions.push({kind:"apply",title:"Проверить одно знание на практике",meta:`${app.book}: ${app.text}`,minutes:10});
  return {book,target,today,remainingMin,pages,reviews,capture,app,track,actions:actions.slice(0,4)}
}
function knowledge124OpenReading(){
  const p=knowledge124TodayPlan(),b=p.book;if(!b)return;
  if(typeof openReadingFor==="function")openReadingFor(b.id);
  const min=document.getElementById("readMinutes"),pages=document.getElementById("readPages");if(min)min.value=String(Math.max(1,p.remainingMin||p.target));if(pages&&p.pages!=null)pages.value=String(p.pages)
}
function knowledge124OpenCapture(){
  if(typeof ux7Go==="function")ux7Go("more","knowledge");
  const ed=document.getElementById("knowledgeGrowthEditor");if(ed)ed.hidden=false;
  if(typeof knowledgeGrowthSyncBookSelect==="function")knowledgeGrowthSyncBookSelect();
  setTimeout(()=>document.getElementById("knowledgeGrowthText")?.focus?.(),100)
}
function knowledge124TopicGaps(){
  const map=new Map(),add=(tag,application)=>{const k=String(tag||"").trim().toLowerCase();if(!k)return;const x=map.get(k)||{tag:k,captures:0,applications:0};x.captures++;if(application)x.applications++;map.set(k,x)};
  for(const x of S.readingLogs||[]){const tags=Array.isArray(x.tags)?x.tags:[];for(const tag of tags)add(tag,!!String(x.application||"").trim())}
  if(typeof knowledgeGrowthNotes==="function")for(const x of knowledgeGrowthNotes()){for(const tag of x.tags||[])add(tag,x.type==="application")}
  return [...map.values()].filter(x=>x.captures>=2).map(x=>({...x,gap:x.captures-x.applications})).sort((a,b)=>b.gap-a.gap||b.captures-a.captures||a.tag.localeCompare(b.tag,"ru")).slice(0,6)
}
function knowledge124Workflow(){
  const logs=typeof readingWindowLogs==="function"?readingWindowLogs(28):(S.readingLogs||[]),n=logs.length,pages=logs.filter(x=>(+x.pages||0)>0).length,capture=logs.filter(x=>String(x.note||"").trim()||String(x.application||"").trim()).length,apps=logs.filter(x=>String(x.application||"").trim()).length,tagged=logs.filter(x=>Array.isArray(x.tags)&&x.tags.length).length,reviews=knowledge124UnifiedReviewQueue();
  const pct0=x=>n?x/n*100:null;return {n,pages,capture,apps,tagged,pagesPct:pct0(pages),capturePct:pct0(capture),appPct:pct0(apps),tagPct:pct0(tagged),due:reviews.length}
}
function knowledge124ExtendDecisionEngine(){
  if(globalThis.__KNOWLEDGE124_DECISION_PATCHED__||typeof knowledgeDecisionEngine!=="function")return;globalThis.__KNOWLEDGE124_DECISION_PATCHED__=true;
  const base=knowledgeDecisionEngine;knowledgeDecisionEngine=function(){
    let rows=base().slice(),review=knowledge124UnifiedReviewQueue(),track=knowledge124TrackState(),app=knowledge124ApplicationCandidate();
    const r=rows.find(x=>x.kind==="review");if(r&&review.length)r.meta=`Объединённая очередь: ${review.length} тезисов из чтения и Knowledge Growth.`;else if(review.length)rows.unshift({kind:"review",title:"Повторить знания",meta:`Объединённая очередь: ${review.length} тезисов.`});
    if(track.missing.length)rows.push({kind:"track",title:"Синхронизировать основной трек чтения",meta:`Не хватает ${track.missing.length} из 27 книг.`});
    if(app)rows.push({kind:"apply",title:"Применить одно сохранённое знание",meta:`${app.book}: ${app.text}`});
    const seen=new Set();return rows.filter(x=>{const k=`${x.kind}|${x.title}`;if(seen.has(k))return false;seen.add(k);return true}).slice(0,7)
  }
}
function knowledge124SetHtml(id,html){const el=document.getElementById(id);if(el)el.innerHTML=html}
function ensureKnowledge124Ui(){
  knowledge124ExtendDecisionEngine();
  if(document.getElementById("knowledge124Today"))return;
  const grid=document.querySelector?.("#more .grid"),anchor=document.getElementById("knowledgeOsCommand")?.closest?.(".card");if(!grid||!anchor||typeof anchor.insertAdjacentHTML!=="function")return;
  anchor.insertAdjacentHTML("afterend",`
    <div data-ux7-view="knowledge" class="card ux7-card span-12"><div class="eyebrow">Knowledge OS 12.4</div><div class="section-title">Что делать со знаниями сегодня</div><div class="muted" style="margin-top:6px">Чтение, повторение, фиксация и применение сведены в один короткий цикл. Показатели описывают работу с данными и заметками, а не измеряют память или интеллект.</div><div id="knowledge124Today" style="margin-top:12px"></div></div>
    <div data-ux7-view="knowledge" class="card ux7-card span-6"><div class="eyebrow">27-book Track</div><div class="title">Основной линейный трек</div><div id="knowledge124Track"></div></div>
    <div data-ux7-view="knowledge" class="card ux7-card span-6"><div class="eyebrow">Unified Review</div><div class="title">Просроченные повторения</div><div id="knowledge124Review"></div></div>
    <div data-ux7-view="knowledge" class="card ux7-card span-6"><div class="eyebrow">Application Loop</div><div class="title">Тезис → применение → результат</div><div id="knowledge124Apply"></div></div>
    <div data-ux7-view="knowledge" class="card ux7-card span-6"><div class="eyebrow">Workflow Quality</div><div class="title">Полнота цикла знаний • 28 дней</div><div id="knowledge124Workflow"></div></div>
    <div data-ux7-view="knowledge" class="card ux7-card span-12"><div class="eyebrow">Theme Gaps</div><div class="title">Темы, которые чаще фиксируются, чем применяются</div><div id="knowledge124Themes"></div></div>
  `)
}
function renderKnowledge124Today(){
  const p=knowledge124TodayPlan(),actions=p.actions;
  const button=a=>a.kind==="read"?'<button class="btn secondary small" onclick="knowledge124OpenReading()">Открыть чтение</button>':a.kind==="book"?`<button class="btn secondary small" onclick="startQueuedBook('${a.bookId}')">Начать книгу</button>`:a.kind==="track"?'<button class="btn secondary small" onclick="knowledge124SyncTrack()">Синхронизировать</button>':a.kind==="capture"?'<button class="btn secondary small" onclick="knowledge124OpenCapture()">Записать вывод</button>':a.kind==="review"?'<button class="btn ghost small" onclick="document.getElementById(\'knowledge124Review\')?.scrollIntoView({behavior:\'smooth\',block:\'center\'})">К повторениям</button>':a.kind==="apply"?'<button class="btn ghost small" onclick="document.getElementById(\'knowledge124Apply\')?.scrollIntoView({behavior:\'smooth\',block:\'center\'})">К применению</button>':"";
  knowledge124SetHtml("knowledge124Today",`<div class="report-grid"><div class="report-item"><div class="smallcaps">Сегодня прочитано</div><b>${p.today}/${p.target} мин</b></div><div class="report-item"><div class="smallcaps">Повторений в очереди</div><b>${p.reviews.length}</b></div><div class="report-item"><div class="smallcaps">Трек</div><b>${p.track.done}/${p.track.total}</b></div><div class="report-item"><div class="smallcaps">До конца текущей</div><b>${p.book?Math.max(0,(+p.book.totalPages||0)-(+p.book.currentPage||0))+" стр.":"—"}</b></div></div>${actions.length?`<div class="title" style="margin-top:14px">План знаний</div>${actions.map((a,i)=>`<div class="quest"><span class="tag">#${i+1}</span><div class="qbody"><div class="qtitle">${escapeHtml(a.title)}</div><div class="qmeta">${escapeHtml(a.meta)}</div></div>${button(a)}</div>`).join("")}`:'<div class="notice" style="margin-top:12px">Дневной цикл закрыт: чтение, повторения и фиксация не требуют срочного действия.</div>'}`)
}
function renderKnowledge124Track(){
  const x=knowledge124TrackState(),next=x.next;
  knowledge124SetHtml("knowledge124Track",`<div class="goal"><div class="goal-top"><span>Прочитано</span><b>${x.done}/${x.total}</b></div><div class="progress green"><i style="width:${clamp(x.progress,0,100)}%"></i></div><div class="goal-top" style="margin-top:9px"><span>Есть в приложении</span><b>${x.present}/${x.total}</b></div><div class="goal-top" style="margin-top:7px"><span>Отсутствует</span><b>${x.missing.length}</b></div></div>${x.active?`<div class="status" style="margin-top:10px">Сейчас: <b>№${x.active.order} ${escapeHtml(x.active.title)}</b>.</div>`:""}${next?`<div class="status" style="margin-top:7px">Следующая: <b>№${next.order} ${escapeHtml(next.title)}</b>.</div>`:""}${x.missing.length?'<button class="btn secondary small" style="margin-top:10px" onclick="knowledge124SyncTrack()">Добавить недостающие и выровнять очередь</button>':'<div class="sub" style="margin-top:8px">Все 27 книг присутствуют в базе.</div>'}`)
}
function renderKnowledge124Review(){
  const rows=knowledge124UnifiedReviewQueue().slice(0,6);
  knowledge124SetHtml("knowledge124Review",rows.length?rows.map(x=>`<div class="log-item"><div class="qtitle">${escapeHtml(x.book)} • раунд ${x.round+1}</div><div class="qmeta">${escapeHtml(x.text)}</div><div class="split" style="margin-top:7px"><span class="tag ${knowledge124DaysOverdue(x.dueKey)>=7?"warn":""}">${knowledge124DaysOverdue(x.dueKey)?`просрочено ${knowledge124DaysOverdue(x.dueKey)} дн.`:"сегодня"}</span><button class="btn ghost small" onclick="knowledge124Review('${x.token}')">Повторил</button></div></div>`).join(""):'<div class="empty">Очередь повторения пуста.</div>')
}
function renderKnowledge124Apply(){
  const c=knowledge124ApplicationCandidate(),s=knowledge124ApplicationStats();
  knowledge124SetHtml("knowledge124Apply",`<div class="report-grid"><div class="report-item"><div class="smallcaps">Сохранено применений</div><b>${s.all}</b></div><div class="report-item"><div class="smallcaps">Проверено результатом</div><b>${s.tested}</b></div><div class="report-item"><div class="smallcaps">Сработало</div><b>${s.worked}</b></div><div class="report-item"><div class="smallcaps">Частично / нет</div><b>${s.mixed}/${s.failed}</b></div></div>${c?`<div class="log-item" style="margin-top:10px"><div class="qtitle">${escapeHtml(c.book)}</div>${c.thesis?`<div class="qmeta">Тезис: ${escapeHtml(c.thesis)}</div>`:""}<div class="score" style="margin-top:5px">Применение: ${escapeHtml(c.text)}</div><div class="split" style="margin-top:8px"><button class="btn ghost small" onclick="knowledge124RecordApplication('${c.token}','worked')">Сработало</button><button class="btn ghost small" onclick="knowledge124RecordApplication('${c.token}','mixed')">Частично</button><button class="btn ghost small" onclick="knowledge124RecordApplication('${c.token}','failed')">Не сработало</button></div></div>`:'<div class="empty" style="margin-top:10px">Нет непроверенных применений. Добавь применение к следующему тезису.</div>'}`)
}
function renderKnowledge124Workflow(){
  const x=knowledge124Workflow(),f=v=>v==null?"—":pct(v,0);
  knowledge124SetHtml("knowledge124Workflow",`<div class="report-grid"><div class="report-item"><div class="smallcaps">Сессий</div><b>${x.n}</b></div><div class="report-item"><div class="smallcaps">Со страницами</div><b>${f(x.pagesPct)}</b></div><div class="report-item"><div class="smallcaps">С тезисом</div><b>${f(x.capturePct)}</b></div><div class="report-item"><div class="smallcaps">С применением</div><b>${f(x.appPct)}</b></div><div class="report-item"><div class="smallcaps">С тегами</div><b>${f(x.tagPct)}</b></div><div class="report-item"><div class="smallcaps">К повторению</div><b>${x.due}</b></div></div><div class="sub" style="margin-top:8px">Это полнота рабочего цикла заметок, а не оценка усвоения материала.</div>`)
}
function renderKnowledge124Themes(){
  const rows=knowledge124TopicGaps();
  knowledge124SetHtml("knowledge124Themes",rows.length?`<div class="report-grid">${rows.map(x=>`<div class="report-item"><div class="smallcaps">${escapeHtml(x.tag)}</div><b>${x.applications}/${x.captures}</b><div class="sub">применений / фиксаций</div></div>`).join("")}</div><div class="sub" style="margin-top:8px">Приоритетны темы, по которым накопились заметки, но мало конкретных применений.</div>`:'<div class="empty">Нужно больше тегированных заметок, чтобы увидеть тематические разрывы.</div>')
}
function renderKnowledge124(){
  knowledge124ExtendDecisionEngine();if(!document.getElementById("knowledge124Today"))return;
  renderKnowledge124Today();renderKnowledge124Track();renderKnowledge124Review();renderKnowledge124Apply();renderKnowledge124Workflow();renderKnowledge124Themes()
}
