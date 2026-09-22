"use strict";

/* Life RPG 10.0.2 — Knowledge OS */

function readingDaysThisWeek(){const wk=isoWeekKey();return new Set(S.readingLogs.filter(x=>isoWeekKey(parseLocal(x.dateKey))===wk).map(x=>x.dateKey)).size}
function currentBook(){return S.books.find(b=>b.status==="reading")||null}
function readingQueueSorted(){return (S.books||[]).filter(b=>b.status==="queued").slice().sort((a,b)=>(+a.readingOrder||999999)-(+b.readingOrder||999999)||String(a.created||"").localeCompare(String(b.created||""))||String(a.title||"").localeCompare(String(b.title||""),"ru"))}
function nextQueuedBook(){return readingQueueSorted()[0]||null}
function nextReadingOrder(){return (S.books||[]).reduce((m,b)=>Math.max(m,+b.readingOrder||0),0)+1}
function normalizeBookText(s){return String(s||"").normalize("NFKC").toLowerCase().replace(/[«»„“”"'’]/g,"").replace(/\s+/g," ").trim()}
function bookIdentityKey(author,title){return `${normalizeBookText(author)}|${normalizeBookText(title)}`}

function normalizeReadingListPackage(obj){if(!obj||obj.format!=="life-rpg-reading-list-v1"||!Array.isArray(obj.books))throw new Error("Неподдерживаемый формат списка чтения");const books=obj.books.map((x,i)=>({order:Math.max(1,Math.round(+x.order||i+1)),author:String(x.author||"").trim(),title:String(x.title||"").trim(),totalPages:Math.max(0,Math.round(+x.totalPages||0))})).filter(x=>x.title).sort((a,b)=>a.order-b.order);if(!books.length)throw new Error("В списке нет книг");return {title:String(obj.title||"Список чтения").trim(),books}}
function mergeReadingListPackage(obj){const pkg=normalizeReadingListPackage(obj),existing=new Set((S.books||[]).map(b=>bookIdentityKey(b.author,b.title))),added=[],skipped=[];let order=nextReadingOrder();for(const item of pkg.books){const key=bookIdentityKey(item.author,item.title);if(existing.has(key)){skipped.push(item);continue}const b={id:uid(),title:item.title,author:item.author,totalPages:item.totalPages,currentPage:0,status:"queued",readingOrder:order++,created:localDateKey(),notes:"",source:"reading-list-import"};S.books.push(b);existing.add(key);added.push(b)}return {title:pkg.title,added,skipped,total:pkg.books.length}}
async function importReadingListFile(file){if(!file)return;try{let obj=JSON.parse(await file.text());const checked=window.LifePlatform?.validateReadingList?.(obj);if(checked&&!checked.ok)throw new Error(checked.error||"Список чтения не прошёл проверку");obj=checked?.data||obj;await createPreActionSnapshot("Перед импортом списка чтения");const r=mergeReadingListPackage(obj);audit("Импорт списка чтения","knowledge",`${r.added.length} добавлено • ${r.skipped.length} пропущено`);await persist();render();const box=$("readingListImportStatus");if(box)box.innerHTML=`<b>Импортировано: ${r.added.length}</b> • уже было: ${r.skipped.length} • всего в файле: ${r.total}`;toast(r.added.length?`Добавлено книг: ${r.added.length}`:"Новых книг в списке нет")}catch(e){const box=$("readingListImportStatus");if(box)box.textContent=`Ошибка импорта: ${e.message||e}`;toast("Не удалось импортировать список чтения")}finally{const input=$("readingListImport");if(input)input.value=""}}

async function addBook(){const title=$("bookTitle").value.trim(),pages=+$("bookPages").value||0;if(!title||pages<=0){toast("Укажи название и страницы");return}const queued=!!currentBook(),book={id:uid(),title,author:$("bookAuthor").value.trim(),totalPages:pages,currentPage:0,status:queued?"queued":"reading",readingOrder:queued?nextReadingOrder():0,created:localDateKey(),started:queued?"":localDateKey(),notes:""};S.books.push(book);$("bookTitle").value=$("bookAuthor").value=$("bookPages").value="";closeModal("bookModal");await save(queued?"Книга добавлена в очередь":"Книга добавлена и начата")}
async function startQueuedBook(id){const b=S.books.find(x=>x.id===id);if(!b||!["queued","paused"].includes(b.status))return;const active=currentBook();if(active&&active.id!==id){toast(`Сначала заверши текущую книгу: ${active.title}`);return}let pages=Math.max(0,+b.totalPages||0);if(!pages){const raw=prompt(`Сколько страниц в твоём издании «${b.title}»?`,"");if(raw==null)return;pages=Math.max(0,Math.round(+raw||0))}if(pages<=0){toast("Укажи количество страниц");return}b.totalPages=pages;b.currentPage=Math.max(0,+b.currentPage||0);b.status="reading";b.started=b.started||localDateKey();audit("Книга начата","knowledge",b.title);await save(`Начата книга: ${b.title}`)}
async function setBookStatus(id,status){const b=S.books.find(x=>x.id===id);if(!b)return;if(status==="reading")return startQueuedBook(id);if(!["queued","paused","done","dropped","archived"].includes(status))return;if(status==="queued")b.readingOrder=b.readingOrder||nextReadingOrder();b.status=status;if(status==="done"){b.currentPage=Math.max(+b.totalPages||0,+b.currentPage||0);b.completed=b.completed||localDateKey()}if(status!=="done")delete b.completed;audit("Статус книги","knowledge",`${b.title} → ${status}`);await save("Статус книги обновлён")}
async function moveBookQueue(id,dir){const arr=readingQueueSorted(),i=arr.findIndex(b=>b.id===id),j=i+dir;if(i<0||j<0||j>=arr.length)return;const a=arr[i],b=arr[j],ao=+a.readingOrder||i+1,bo=+b.readingOrder||j+1;a.readingOrder=bo;b.readingOrder=ao;await save("Очередь чтения обновлена")}

function readingBaseXpOnDate(dateKey,excludeId=""){return (S.readingLogs||[]).filter(x=>x.dateKey===dateKey&&x.id!==excludeId).reduce((s,x)=>s+(x.baseXpAward!=null?Math.max(0,+x.baseXpAward||0):Math.min(40,+x.xpAward||0)),0)}
function recomputeBookProgress(bookId){const b=S.books.find(x=>x.id===bookId);if(!b)return;const pages=(S.readingLogs||[]).filter(x=>x.bookId===bookId).reduce((s,x)=>s+Math.max(0,+x.pages||0),0);b.currentPage=Math.min(Math.max(0,+b.totalPages||0),pages);if(b.currentPage>=b.totalPages&&b.totalPages>0){if(!["archived","dropped","queued"].includes(b.status))b.status="done";const last=(S.readingLogs||[]).filter(x=>x.bookId===bookId).map(x=>x.dateKey).sort().at(-1);b.completed=last||b.completed||localDateKey()}else if(b.status==="done"){b.status=S.books.some(x=>x.id!==b.id&&x.status==="reading")?"paused":"reading";delete b.completed}}

async function addReading(){const id=$("readBook").value,dateKey=$("readDate")?.value||localDateKey();if(!validActivityDate(dateKey)){toast("Чтение можно добавить только за сегодня или прошедшую дату");return}const min=Math.max(0,+$("readMinutes").value||0),requestedPages=Math.max(0,+$("readPages").value||0),editId=$("readEditId")?.value||"",old=editId?S.readingLogs.find(x=>x.id===editId):null,b=S.books.find(x=>x.id===id);if(min<=0){toast("Укажи время чтения");return}if(!b||(b.status!=="reading"&&!(old&&b.status==="done"))){toast("Сначала начни книгу из очереди");return}const otherActive=currentBook();if(old){S.readingLogs=S.readingLogs.filter(x=>x.id!==editId);removeXp(old.xpAward||0,"Разум","Редактирование чтения",`read:${editId}`,old.dateKey);recomputeBookProgress(old.bookId)}const before=(S.readingLogs||[]).filter(x=>x.bookId===id).reduce((s,x)=>s+Math.max(0,+x.pages||0),0),remainingPages=Math.max(0,(+b.totalPages||0)-before),actualPages=Math.min(requestedPages,remainingPages),after=before+actualPages,completed=before<(+b.totalPages||0)&&after>=(+b.totalPages||0);const rawBase=Math.min(40,Math.floor(min/15)*10),baseXpAward=Math.min(rawBase,Math.max(0,40-readingBaseXpOnDate(dateKey))),completionBonus=completed?300:0,x={id:old?.id||uid(),bookId:id,dateKey,minutes:min,pages:actualPages,chapter:$("readChapter")?.value.trim()||"",tags:$("readTags")?.value.split(",").map(v=>v.trim()).filter(Boolean)||[],note:$("readNote")?.value.trim()||"",application:$("readApply")?.value.trim()||"",reviewedAt:old?.reviewedAt||"",baseXpAward,completionBonus,xpAward:baseXpAward+completionBonus};S.readingLogs.unshift(x);S.readingLogs.sort((a,b)=>String(b.dateKey).localeCompare(String(a.dateKey)));recomputeBookProgress(id);if(b.status==="reading"&&otherActive&&otherActive.id!==b.id)b.status="paused";addXp(x.xpAward,"Разум",completed?"Книга закончена":old?"Сессия чтения обновлена":"Чтение",`read:${x.id}`,completed?"result":"process",dateKey);reconcileReadingAwards();if(old)syncAutoDailyQuests(old.dateKey);syncAutoDailyQuests(dateKey);audit(old?"Чтение изменено":"Чтение","knowledge",`${b.title} • ${min} мин • ${actualPages} стр.`);cancelReadingEdit();closeModal("readingModal");await save(completed?"Книга завершена • бонус 300 XP":baseXpAward?`${old?"Чтение обновлено":"Чтение сохранено"} • +${baseXpAward} XP`:`${old?"Чтение обновлено":"Чтение сохранено"} • дневной лимит XP достигнут`)}
function reconcileReadingAwards(){
  const daily=new Map(),pages=new Map(),completed=new Set();
  const rows=S.readingLogs.slice().sort((a,b)=>String(a.dateKey).localeCompare(String(b.dateKey))||String(a.id).localeCompare(String(b.id)));
  for(const x of rows){
    const used=daily.get(x.dateKey)||0,base=Math.min(Math.min(40,Math.floor(Math.max(0,+x.minutes||0)/15)*10),Math.max(0,40-used));daily.set(x.dateKey,used+base);
    const b=S.books.find(b=>b.id===x.bookId),sum=(pages.get(x.bookId)||0)+Math.max(0,+x.pages||0);pages.set(x.bookId,sum);
    const bonus=b&&+b.totalPages>0&&sum>=+b.totalPages&&!completed.has(b.id)?300:0;if(bonus)completed.add(b.id);
    const next=base+bonus,old=Math.max(0,+x.xpAward||0),diff=next-old;
    if(diff>0)addXp(diff,"Разум","Пересчёт чтения",`read:${x.id}`,bonus?"result":"process",x.dateKey);
    if(diff<0)removeXp(-diff,"Разум","Пересчёт чтения",`read:${x.id}`,x.dateKey);
    x.baseXpAward=base;x.completionBonus=bonus;x.xpAward=next;
  }
}
function editReading(id){const x=S.readingLogs.find(z=>z.id===id),b=x&&S.books.find(q=>q.id===x.bookId);if(!x||!b)return;if(b.status!=="reading"&&b.status!=="done"){toast("Редактирование доступно для активной/завершённой книги");return}openModal("readingModal");if($("readBook")){$("readBook").innerHTML=`<option value="${escapeHtml(b.id)}">${escapeHtml(b.title)}</option>`;$("readBook").value=b.id;}const vals={readEditId:x.id,readDate:x.dateKey,readMinutes:x.minutes,readPages:x.pages||0,readChapter:x.chapter||"",readTags:(x.tags||[]).join(", "),readNote:x.note||"",readApply:x.application||""};for(const [id,v] of Object.entries(vals))if($(id))$(id).value=v??"";if($("readSaveBtn"))$("readSaveBtn").textContent="Обновить чтение";if($("readCancelEdit"))$("readCancelEdit").hidden=false}
function cancelReadingEdit(){for(const id of ["readEditId","readChapter","readTags","readNote","readApply"])if($(id))$(id).value="";if($("readMinutes"))$("readMinutes").value=30;if($("readPages"))$("readPages").value=0;if($("readDate"))$("readDate").value=localDateKey();if($("readSaveBtn"))$("readSaveBtn").textContent="Сохранить чтение";if($("readCancelEdit"))$("readCancelEdit").hidden=true}
async function deleteReading(id){const i=S.readingLogs.findIndex(x=>x.id===id);if(i<0)return;const x=S.readingLogs[i];if(!confirm("Удалить эту сессию чтения? Её можно будет восстановить из корзины."))return;await createPreActionSnapshot("Перед удалением сессии чтения");trashPush("reading",x);S.readingLogs.splice(i,1);removeXp(x.xpAward||0,"Разум","Удалена сессия чтения",`read:${id}`,x.dateKey);recomputeBookProgress(x.bookId);reconcileReadingAwards();syncAutoDailyQuests(x.dateKey);await save("Сессия чтения удалена • прогресс пересчитан")}
async function deleteBook(id){const b=S.books.find(x=>x.id===id);if(!b)return;if(!confirm(`Архивировать книгу «${b.title}»? История чтения сохранится.`))return;b.status="archived";b.archivedAt=new Date().toISOString();audit("Книга архивирована","knowledge",b.title);await save("Книга перемещена в архив")}

function readingPaceData(){const b=currentBook();if(!b||!b.totalPages)return null;const since=localDateKey(addDays(new Date(),-13)),logs=S.readingLogs.filter(x=>x.bookId===b.id&&x.dateKey>=since),pages=logs.reduce((s,x)=>s+(+x.pages||0),0),days=new Set(logs.map(x=>x.dateKey)).size,pace=days?pages/days:0,remaining=Math.max(0,b.totalPages-b.currentPage),readingDays=pace>0?Math.ceil(remaining/pace):null;return {book:b,pages,days,pace,remaining,readingDays}}
function knowledgeReviewQueue(){const days=Math.max(1,+S.settings.readingReviewDays||7),cut=Date.now()-days*86400000;return (S.readingLogs||[]).filter(x=>x.note||x.application).filter(x=>!x.reviewedAt||Date.parse(x.reviewedAt)<cut).slice().sort((a,b)=>String(a.reviewedAt||a.dateKey).localeCompare(String(b.reviewedAt||b.dateKey))).slice(0,8)}
async function markKnowledgeReviewed(id){const x=S.readingLogs.find(z=>z.id===id);if(!x)return;x.reviewedAt=new Date().toISOString();audit("Повторение знания","knowledge",x.note||x.application||id);await save("Тезис отмечен повторённым")}

function renderKnowledgeBase(){const box=$("knowledgeBase");if(!box)return;const q=String($("knowledgeSearch")?.value||"").toLowerCase(),notes=S.readingLogs.filter(x=>x.note||x.application||x.chapter||(x.tags||[]).length).filter(x=>{const b=S.books.find(z=>z.id===x.bookId);return !q||`${x.note||""} ${x.application||""} ${x.chapter||""} ${(x.tags||[]).join(" ")} ${b?.title||""} ${b?.author||""}`.toLowerCase().includes(q)}).slice(0,80);box.innerHTML=notes.length?notes.map(x=>{const b=S.books.find(z=>z.id===x.bookId);return `<div class="log-item"><div class="qtitle">${escapeHtml(b?.title||"Книга")} • ${fmtDate(parseLocal(x.dateKey))}${x.chapter?` • ${escapeHtml(x.chapter)}`:""}</div>${x.tags?.length?`<div class="qmeta">${x.tags.map(t=>`#${escapeHtml(t)}`).join(" ")}</div>`:""}${x.note?`<div class="qmeta">Тезис: ${escapeHtml(x.note)}</div>`:""}${x.application?`<div class="qmeta">Применение: ${escapeHtml(x.application)}</div>`:""}</div>`}).join(""):'<div class="empty">Заметки не найдены.</div>'}
function renderReadingDashboard(){const month=S.readingLogs.filter(x=>x.dateKey?.startsWith(localMonthKey())),mins=month.reduce((a,x)=>a+(+x.minutes||0),0),pages=month.reduce((a,x)=>a+(+x.pages||0),0),completed=S.books.filter(b=>b.status==="done"&&String(b.completed||"").startsWith(localMonthKey())).length,pace=readingPaceData(),review=knowledgeReviewQueue(),recent=S.readingLogs.slice(0,8);$("readingDashboard").innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Минуты месяца</div><b>${mins}</b></div><div class="report-item"><div class="smallcaps">Страницы</div><b>${pages}</b></div><div class="report-item"><div class="smallcaps">Книг завершено</div><b>${completed}</b></div><div class="report-item"><div class="smallcaps">На повторение</div><b>${review.length}</b></div></div>${pace?`<div class="notice" style="margin-top:10px"><b>${escapeHtml(pace.book.title)}</b>: ${pace.remaining} стр. осталось • темп ${pace.pace.toFixed(1)} стр./день чтения${pace.readingDays!=null?` • примерно ${pace.readingDays} дней чтения до конца`:""}.</div>`:""}<div class="title" style="margin-top:14px">Повторить знания</div>${review.length?review.slice(0,4).map(x=>{const b=S.books.find(q=>q.id===x.bookId);return `<div class="log-item"><div class="qtitle">${escapeHtml(b?.title||"Книга")}</div><div class="qmeta">${escapeHtml(x.note||x.application||"")}</div><button class="btn ghost small" style="margin-top:7px" onclick="markKnowledgeReviewed('${x.id}')">Повторил</button></div>`}).join(""):`<div class="empty">Очередь повторения пуста.</div>`}<div class="title" style="margin-top:14px">Последние сессии</div>${recent.length?recent.map(x=>{const b=S.books.find(q=>q.id===x.bookId);return `<div class="log-item"><div class="qtitle">${fmtDate(parseLocal(x.dateKey))} • ${escapeHtml(b?.title||"Архивная книга")} • ${x.minutes} мин</div><div class="qmeta">${x.pages||0} стр. • +${x.xpAward||0} XP${x.chapter?` • ${escapeHtml(x.chapter)}`:""}</div><div class="split" style="margin-top:7px"><button class="btn ghost small" onclick="editReading('${x.id}')">Изменить</button><button class="btn ghost small" onclick="deleteReading('${x.id}')">Удалить</button></div></div>`}).join(""):`<div class="empty">Сессий пока нет.</div>`}`}
function renderBooks(){const reading=(S.books||[]).filter(b=>b.status==="reading"),queued=readingQueueSorted(),paused=(S.books||[]).filter(b=>b.status==="paused"),done=(S.books||[]).filter(b=>b.status==="done").slice().sort((a,b)=>String(b.completed||"").localeCompare(String(a.completed||""))),dropped=(S.books||[]).filter(b=>b.status==="dropped"),ordered=[...reading,...queued,...paused,...done,...dropped];$("readBook").innerHTML=reading.length?reading.map(b=>`<option value="${b.id}">${escapeHtml(b.title)}</option>`).join(""):'<option value="">Сначала начни книгу из очереди</option>';$("bookList").innerHTML=ordered.length?ordered.map(b=>{const isDone=b.status==="done",isQueued=b.status==="queued",isPaused=b.status==="paused",pages=Math.max(0,+b.totalPages||0),current=Math.max(0,+b.currentPage||0),p=pages>0?clamp(current/pages*100,0,100):0,tag=isDone?"прочитано":isQueued?`№${+b.readingOrder||"—"} в очереди`:isPaused?"пауза":b.status==="dropped"?"отложено":`читаю • ${current}/${pages}`;return `<div class="book"><div class="book-head"><div><b>${escapeHtml(b.title)}</b><div class="sub">${escapeHtml(b.author||"")}</div></div><span class="tag ${isDone?"good":""}">${tag}</span></div>${isQueued?`<div class="sub" style="margin-top:9px">${pages?`${pages} стр.`:"Количество страниц укажешь при старте книги."}</div>`:`<div class="progress" style="margin-top:9px"><i style="width:${p}%"></i></div>`}<div class="split" style="margin-top:9px">${isQueued?`<button class="btn secondary small" onclick="startQueuedBook('${b.id}')">Начать</button><button class="btn ghost small" onclick="moveBookQueue('${b.id}',-1)">↑</button><button class="btn ghost small" onclick="moveBookQueue('${b.id}',1)">↓</button>`:isPaused?`<button class="btn secondary small" onclick="startQueuedBook('${b.id}')">Продолжить</button>`:!isDone&&b.status==="reading"?`<button class="btn ghost small" onclick="openReadingFor('${b.id}')">+ Читать</button><button class="btn ghost small" onclick="setBookStatus('${b.id}','paused')">Пауза</button>`:""}${!isDone?`<button class="btn ghost small" onclick="setBookStatus('${b.id}','dropped')">Отложить</button>`:""}<button class="btn ghost small" onclick="deleteBook('${b.id}')">Архив</button></div></div>`}).join(""):'<div class="empty">Добавь книгу или импортируй список чтения.</div>'}
function openReadingFor(id){const b=S.books.find(x=>x.id===id);if(!b||b.status!=="reading"){toast("Эта книга сейчас не активна");return}openModal("readingModal");if($("readBook"))$("readBook").value=id}


/* Knowledge OS deep analytics layer — first iteration.
   No new mandatory input fields. Existing readingReviewDays becomes the anchor
   for the staged review schedule: 1, 3, N, 2N, 4N days. */

function knowledgeOsNumber(key,fallback,min=0,max=Number.POSITIVE_INFINITY){
  const v=Number(S.settings?.[key]);
  return Number.isFinite(v)?clamp(v,min,max):fallback
}
function knowledgeReviewIntervals(){
  const base=Math.max(3,Math.round(knowledgeOsNumber("readingReviewDays",7,3,90)));
  return [...new Set([1,3,base,base*2,base*4])].sort((a,b)=>a-b)
}
function knowledgeReviewState(x){
  const intervals=knowledgeReviewIntervals(),legacyReviewed=!!x.reviewedAt&&x.reviewCount==null,count=Math.max(0,Math.round(legacyReviewed?1:(+x.reviewCount||0)));
  const nextIndex=x.reviewedAt?Math.max(0,count-1):0,interval=intervals[Math.min(nextIndex,intervals.length-1)];
  let anchor;
  if(x.reviewedAt)anchor=new Date(x.reviewedAt);
  else anchor=parseLocal(x.dateKey||localDateKey());
  if(Number.isNaN(anchor.getTime()))anchor=new Date();
  const dueAt=x.reviewedAt?new Date(anchor.getTime()+interval*86400000):anchor;
  return {count,interval,dueAt,due:!x.reviewedAt||Date.now()>=dueAt.getTime(),complete:false}
}
knowledgeReviewQueue=function(){
  return (S.readingLogs||[])
    .filter(x=>x.note||x.application)
    .map(x=>({x,s:knowledgeReviewState(x)}))
    .filter(z=>z.s.due)
    .sort((a,b)=>a.s.dueAt-b.s.dueAt||String(a.x.dateKey||"").localeCompare(String(b.x.dateKey||"")))
    .map(z=>z.x)
};
markKnowledgeReviewed=async function(id){
  const x=S.readingLogs.find(z=>z.id===id);if(!x)return;
  const s=knowledgeReviewState(x);
  x.reviewCount=s.count+1;x.reviewedAt=new Date().toISOString();
  audit("Повторение знания","knowledge",`${x.note||x.application||id} • повтор ${x.reviewCount}`);
  await save(`Тезис повторён • следующий интервал ${knowledgeReviewState(x).interval} дн.`)
};

function readingWindowLogs(days=28,bookId=""){
  const start=localDateKey(addDays(new Date(),-(days-1)));
  return (S.readingLogs||[]).filter(x=>String(x.dateKey||"")>=start&&(!bookId||x.bookId===bookId))
}
function readingTodayMinutes(){
  const today=localDateKey();
  return (S.readingLogs||[]).filter(x=>x.dateKey===today).reduce((s,x)=>s+Math.max(0,+x.minutes||0),0)
}
function readingConsistencyData(days=28){
  const logs=readingWindowLogs(days),byDay=new Map();
  for(const x of logs)byDay.set(x.dateKey,(byDay.get(x.dateKey)||0)+Math.max(0,+x.minutes||0));
  const target=Math.max(1,Math.round(knowledgeOsNumber("readingDailyMin",30,1,1440)));
  let compliant=0;for(const v of byDay.values())if(v>=target)compliant++;
  let streak=0,d=new Date();
  while(true){const k=localDateKey(d),v=byDay.get(k)||0;if(v<target)break;streak++;d=addDays(d,-1)}
  const activeDays=byDay.size,weeklyDays=days>0?activeDays/days*7:0;
  return {days,target,activeDays,compliant,weeklyDays,streak,today:byDay.get(localDateKey())||0}
}
function readingVelocityData(days=28){
  const b=currentBook(),logs=readingWindowLogs(days,b?.id||""),minutes=logs.reduce((s,x)=>s+Math.max(0,+x.minutes||0),0),pages=logs.reduce((s,x)=>s+Math.max(0,+x.pages||0),0);
  const pagesPerHour=minutes>0?pages/(minutes/60):0,activeDays=new Set(logs.map(x=>x.dateKey)).size,pagesPerReadingDay=activeDays?pages/activeDays:0;
  const consistency=readingConsistencyData(days),calendarPagesPerDay=pagesPerReadingDay*(consistency.weeklyDays/7);
  const remaining=b?Math.max(0,(+b.totalPages||0)-(+b.currentPage||0)):0,calendarDays=b&&calendarPagesPerDay>0?Math.ceil(remaining/calendarPagesPerDay):null;
  const finishDate=calendarDays!=null?addDays(new Date(),calendarDays):null;
  return {book:b,days,minutes,pages,pagesPerHour,activeDays,pagesPerReadingDay,calendarPagesPerDay,remaining,calendarDays,finishDate}
}
function knowledgeCaptureData(days=28){
  const logs=readingWindowLogs(days),withKnowledge=logs.filter(x=>String(x.note||"").trim()||String(x.application||"").trim()),withApplication=logs.filter(x=>String(x.application||"").trim()),tagged=logs.filter(x=>Array.isArray(x.tags)&&x.tags.length);
  return {sessions:logs.length,withKnowledge:withKnowledge.length,withApplication:withApplication.length,tagged:tagged.length,captureRate:logs.length?withKnowledge.length/logs.length*100:0,applicationRate:logs.length?withApplication.length/logs.length*100:0}
}
function knowledgeReviewStats(){
  const all=(S.readingLogs||[]).filter(x=>x.note||x.application),due=knowledgeReviewQueue(),reviewed=all.filter(x=>x.reviewedAt),rounds=all.reduce((s,x)=>s+Math.max(0,+x.reviewCount||0),0);
  return {items:all.length,due:due.length,reviewed:reviewed.length,rounds,intervals:knowledgeReviewIntervals()}
}
function readingQueueHorizon(){
  const v=readingVelocityData(28),books=[...(currentBook()?[currentBook()]:[]),...readingQueueSorted()],known=books.filter(b=>(+b.totalPages||0)>0),unknown=books.length-known.length;
  let pages=0;
  for(const b of known)pages+=b.status==="reading"?Math.max(0,(+b.totalPages||0)-(+b.currentPage||0)):Math.max(0,+b.totalPages||0);
  const hours=v.pagesPerHour>0?pages/v.pagesPerHour:null,weeks=hours!=null&&v.minutes>0?(hours/(v.minutes/60))*4:null;
  return {books:books.length,known:known.length,unknown,pages,hours,weeks,next:nextQueuedBook()}
}
function knowledgeMonthData(){
  const month=localMonthKey(),logs=(S.readingLogs||[]).filter(x=>String(x.dateKey||"").startsWith(month)),mins=logs.reduce((s,x)=>s+Math.max(0,+x.minutes||0),0),pages=logs.reduce((s,x)=>s+Math.max(0,+x.pages||0),0),days=new Set(logs.map(x=>x.dateKey)).size,done=(S.books||[]).filter(b=>b.status==="done"&&String(b.completed||"").startsWith(month)).length;
  const now=new Date(),elapsed=now.getDate(),target=Math.max(1,knowledgeOsNumber("readingDailyMin",30,1,1440)),weeklyDays=Math.max(1,knowledgeOsNumber("readingWeeklyDaysTarget",7,1,7)),planned=Math.round(elapsed*target*weeklyDays/7);
  return {mins,pages,days,done,planned,pace:planned>0?mins/planned*100:0}
}
function knowledgeDecisionEngine(){
  const out=[],review=knowledgeReviewStats(),today=readingTodayMinutes(),target=Math.max(1,Math.round(knowledgeOsNumber("readingDailyMin",30,1,1440))),b=currentBook(),queue=readingQueueSorted(),v=readingVelocityData(28),c=knowledgeCaptureData(28),cons=readingConsistencyData(28);
  if(review.due)out.push({kind:"review",title:"Повторить знания",meta:`Сейчас к повторению готовы ${review.due} тезисов. Начни с самых просроченных.`});
  if(!b&&queue.length)out.push({kind:"book",title:`Начать следующую книгу: ${queue[0].title}`,meta:"Активной книги сейчас нет; порядок берётся из твоей очереди."});
  if(b&&today<target)out.push({kind:"read",title:`Дочитать дневной минимум: ещё ${target-today} мин`,meta:`Сегодня зафиксировано ${today}/${target} мин.`});
  if(b&&v.minutes>0&&v.pages===0)out.push({kind:"data",title:"Указывать страницы после чтения",meta:"Без страниц приложение видит время, но не может оценить скорость и срок завершения книги."});
  if(c.sessions>=5&&c.captureRate<40)out.push({kind:"capture",title:"Зафиксировать хотя бы один тезис",meta:`За 28 дней знания сохранены в ${pct(c.captureRate,0)} сессий. Не нужно конспектировать всё — достаточно ключевых идей.`});
  if(cons.weeklyDays+0.01<Math.max(1,Math.round(knowledgeOsNumber("readingWeeklyDaysTarget",7,1,7)))&&cons.days>=7)out.push({kind:"consistency",title:"Вернуть регулярность чтения",meta:`За последние 28 дней чтение было в ${cons.activeDays} днях; средняя частота ${cons.weeklyDays.toFixed(1)} дн./нед.`});
  if(b&&v.calendarDays!=null)out.push({kind:"pace",title:`Текущий прогноз: закончить примерно за ${v.calendarDays} дн.`,meta:`${v.remaining} стр. осталось • ${v.pagesPerHour.toFixed(1)} стр./ч • ${cons.weeklyDays.toFixed(1)} дней чтения в неделю.`});
  return out.slice(0,7)
}
function knowledgeOsSetHtml(id,html){const el=document.getElementById(id);if(el)el.innerHTML=html}
function knowledgeOsDate(d){return d&&d instanceof Date&&!Number.isNaN(d.getTime())?d.toLocaleDateString("ru-RU"):"—"}

function ensureKnowledgeOsUi(){
  if(document.getElementById("knowledgeOsCommand"))return;
  const grid=document.querySelector?.("#more .grid");if(!grid)return;
  const anchor=grid.querySelector?.(".book-hero")||null,target=anchor||grid;if(typeof target.insertAdjacentHTML!=="function")return;
  target.insertAdjacentHTML(anchor?"afterend":"beforeend",`
    <div data-ux7-view="knowledge" class="card ux7-card span-12"><div class="eyebrow">Knowledge OS</div><div class="section-title">Центр чтения и удержания знаний</div><div class="muted" style="margin-top:6px">Темп, регулярность, повторение и фиксация идей. Метрики повторения показывают дисциплину работы с заметками, а не измеряют память напрямую.</div><div id="knowledgeOsCommand" style="margin-top:12px"></div></div>
    <div data-ux7-view="knowledge" class="card ux7-card span-6"><div class="eyebrow">Reading Engine</div><div class="title">Темп и прогноз книги</div><div id="knowledgeOsPace"></div></div>
    <div data-ux7-view="knowledge" class="card ux7-card span-6"><div class="eyebrow">Consistency</div><div class="title">Регулярность</div><div id="knowledgeOsConsistency"></div></div>
    <div data-ux7-view="knowledge" class="card ux7-card span-6"><div class="eyebrow">Review Engine</div><div class="title">Интервальные повторения</div><div id="knowledgeOsReview"></div></div>
    <div data-ux7-view="knowledge" class="card ux7-card span-6"><div class="eyebrow">Capture</div><div class="title">Фиксация и применение</div><div id="knowledgeOsCapture"></div></div>
    <div data-ux7-view="knowledge" class="card ux7-card span-6"><div class="title">Очередь: горизонт</div><div id="knowledgeOsQueue"></div></div>
    <div data-ux7-view="knowledge" class="card ux7-card span-6"><div class="title">Месяц: план → факт</div><div id="knowledgeOsMonth"></div></div>
    <div data-ux7-view="knowledge" class="card ux7-card span-12"><details><summary>Настройки Knowledge OS</summary><div class="formgrid" style="margin-top:12px"><div class="field"><label>Чтение / день, мин</label><input id="knowledgeOsDailyMin" type="number" min="1" max="1440"></div><div class="field"><label>Целевых дней чтения / неделю</label><input id="knowledgeOsWeeklyDays" type="number" min="1" max="7"></div><div class="field"><label>Базовый интервал повторения, дней</label><input id="knowledgeOsReviewBase" type="number" min="3" max="90"></div></div><button class="btn secondary" style="margin-top:12px" onclick="saveKnowledgeOsSettings()">Сохранить настройки</button><div class="notice" style="margin-top:10px">Новая заметка сразу попадает в очередь первого повторения. После него интервалы: 1 день → 3 дня → базовый интервал → ×2 → ×4. После последней ступени используется самый длинный интервал повторно.</div></details></div>
  `)
}
function renderKnowledgeOsCommand(){
  const m=knowledgeMonthData(),r=knowledgeReviewStats(),v=readingVelocityData(28),actions=knowledgeDecisionEngine();
  knowledgeOsSetHtml("knowledgeOsCommand",`<div class="report-grid"><div class="report-item"><div class="smallcaps">Сегодня</div><b>${readingTodayMinutes()} мин</b></div><div class="report-item"><div class="smallcaps">Месяц</div><b>${m.mins} мин</b></div><div class="report-item"><div class="smallcaps">Страниц месяца</div><b>${m.pages}</b></div><div class="report-item"><div class="smallcaps">На повторение</div><b>${r.due}</b></div><div class="report-item"><div class="smallcaps">Скорость</div><b>${v.pagesPerHour?v.pagesPerHour.toFixed(1)+" стр./ч":"—"}</b></div><div class="report-item"><div class="smallcaps">Книг завершено</div><b>${m.done}</b></div></div>${actions.length?`<div class="title" style="margin-top:14px">Что делать дальше</div>${actions.map(a=>`<div class="quest"><span class="tag ${a.kind==="review"?"warn":""}">${a.kind==="review"?"Повтор":a.kind==="read"?"Чтение":a.kind==="book"?"Книга":"Приоритет"}</span><div class="qbody"><div class="qtitle">${escapeHtml(a.title)}</div><div class="qmeta">${escapeHtml(a.meta)}</div></div></div>`).join("")}`:""}`)
}
function renderKnowledgeOsPace(){
  const v=readingVelocityData(28);
  if(!v.book){knowledgeOsSetHtml("knowledgeOsPace",'<div class="empty">Нет активной книги.</div>');return}
  knowledgeOsSetHtml("knowledgeOsPace",`<div class="goal"><div class="goal-top"><span>${escapeHtml(v.book.title)}</span><b>${v.book.currentPage||0}/${v.book.totalPages||0}</b></div><div class="goal-top" style="margin-top:7px"><span>Осталось</span><b>${v.remaining} стр.</b></div><div class="goal-top" style="margin-top:7px"><span>Скорость за 28 дней</span><b>${v.pagesPerHour?v.pagesPerHour.toFixed(1)+" стр./ч":"—"}</b></div><div class="goal-top" style="margin-top:7px"><span>Страниц / день чтения</span><b>${v.pagesPerReadingDay?v.pagesPerReadingDay.toFixed(1):"—"}</b></div><div class="goal-top" style="margin-top:7px"><span>Прогноз завершения</span><b>${knowledgeOsDate(v.finishDate)}</b></div></div><div class="sub" style="margin-top:8px">Прогноз использует фактическую скорость и частоту чтения за последние 28 дней, поэтому при изменении режима автоматически перестраивается.</div>`)
}
function renderKnowledgeOsConsistency(){
  const x=readingConsistencyData(28),target=Math.round(knowledgeOsNumber("readingWeeklyDaysTarget",7,1,7));
  knowledgeOsSetHtml("knowledgeOsConsistency",`<div class="report-grid"><div class="report-item"><div class="smallcaps">Дней с чтением • 28</div><b>${x.activeDays}</b></div><div class="report-item"><div class="smallcaps">Средне / неделю</div><b>${x.weeklyDays.toFixed(1)}/${target}</b></div><div class="report-item"><div class="smallcaps">Дней с дневным минимумом</div><b>${x.compliant}</b></div><div class="report-item"><div class="smallcaps">Текущая серия</div><b>${x.streak} дн.</b></div></div><div class="status" style="margin-top:10px">Дневной минимум: <b>${x.target} мин</b>. Сегодня: <b>${x.today} мин</b>.</div>`)
}
function renderKnowledgeOsReview(){
  const r=knowledgeReviewStats(),q=knowledgeReviewQueue(),ints=r.intervals;
  knowledgeOsSetHtml("knowledgeOsReview",`<div class="goal"><div class="goal-top"><span>Заметок / применений</span><b>${r.items}</b></div><div class="goal-top" style="margin-top:7px"><span>Сейчас к повторению</span><b>${r.due}</b></div><div class="goal-top" style="margin-top:7px"><span>Всего раундов повторения</span><b>${r.rounds}</b></div><div class="qmeta">Интервалы: ${ints.join(" → ")} дней</div></div>${q.length?`<div class="title" style="margin-top:12px">Ближайшие</div>${q.slice(0,5).map(x=>{const b=S.books.find(z=>z.id===x.bookId),s=knowledgeReviewState(x);return `<div class="log-item"><div class="qtitle">${escapeHtml(b?.title||"Книга")} • раунд ${s.count+1}</div><div class="qmeta">${escapeHtml(x.note||x.application||"")}</div><button class="btn ghost small" style="margin-top:7px" onclick="markKnowledgeReviewed('${x.id}')">Повторил</button></div>`}).join("")}`:'<div class="empty" style="margin-top:10px">Просроченных повторений нет.</div>'}`)
}
function renderKnowledgeOsCapture(){
  const c=knowledgeCaptureData(28);
  knowledgeOsSetHtml("knowledgeOsCapture",`<div class="report-grid"><div class="report-item"><div class="smallcaps">Сессий • 28 дней</div><b>${c.sessions}</b></div><div class="report-item"><div class="smallcaps">С тезисом / применением</div><b>${c.withKnowledge}</b></div><div class="report-item"><div class="smallcaps">Доля фиксации</div><b>${pct(c.captureRate,0)}</b></div><div class="report-item"><div class="smallcaps">С применением</div><b>${c.withApplication}</b></div></div><div class="sub" style="margin-top:8px">Доля фиксации — это только показатель ведения заметок. Она не является измерением понимания или запоминания текста.</div>`)
}
function renderKnowledgeOsQueue(){
  const q=readingQueueHorizon();
  knowledgeOsSetHtml("knowledgeOsQueue",`<div class="goal"><div class="goal-top"><span>Активная + очередь</span><b>${q.books} книг</b></div><div class="goal-top" style="margin-top:7px"><span>Известно страниц</span><b>${q.pages}</b></div><div class="goal-top" style="margin-top:7px"><span>Без объёма страниц</span><b>${q.unknown}</b></div><div class="goal-top" style="margin-top:7px"><span>Оценка часов по текущей скорости</span><b>${q.hours!=null?q.hours.toFixed(1):"—"}</b></div></div>${q.next?`<div class="status" style="margin-top:10px">Следующая по очереди: <b>${escapeHtml(q.next.title)}</b>${q.next.author?` • ${escapeHtml(q.next.author)}`:""}.</div>`:""}`)
}
function renderKnowledgeOsMonth(){
  const m=knowledgeMonthData(),p=m.planned>0?clamp(m.mins/m.planned*100,0,100):0;
  knowledgeOsSetHtml("knowledgeOsMonth",`<div class="goal"><div class="goal-top"><span>Чтение</span><b>${m.mins}/${m.planned} мин к текущей дате</b></div><div class="progress"><i style="width:${p}%"></i></div><div class="goal-top" style="margin-top:9px"><span>Выполнение текущего темпа</span><b>${pct(m.pace,0)}</b></div><div class="goal-top" style="margin-top:7px"><span>Дней чтения</span><b>${m.days}</b></div><div class="goal-top" style="margin-top:7px"><span>Страниц</span><b>${m.pages}</b></div><div class="goal-top" style="margin-top:7px"><span>Завершено книг</span><b>${m.done}</b></div></div>`)
}
function renderKnowledgeOsSettings(){
  const vals={knowledgeOsDailyMin:Math.round(knowledgeOsNumber("readingDailyMin",30,1,1440)),knowledgeOsWeeklyDays:Math.round(knowledgeOsNumber("readingWeeklyDaysTarget",7,1,7)),knowledgeOsReviewBase:Math.round(knowledgeOsNumber("readingReviewDays",7,3,90))};
  for(const [id,v] of Object.entries(vals)){const el=document.getElementById(id);if(el&&!el.dataset.ready){el.value=String(v);el.dataset.ready="1"}}
}
async function saveKnowledgeOsSettings(){
  const n=(id,min,max)=>clamp(Number(document.getElementById(id)?.value)||0,min,max);
  S.settings.readingDailyMin=Math.round(n("knowledgeOsDailyMin",1,1440));
  S.settings.readingWeeklyDaysTarget=Math.round(n("knowledgeOsWeeklyDays",1,7));
  S.settings.readingReviewDays=Math.round(n("knowledgeOsReviewBase",3,90));
  audit("Настройки Knowledge OS","knowledge",`Чтение ${S.settings.readingDailyMin} мин • ${S.settings.readingWeeklyDaysTarget} дн./нед.`);
  await save("Настройки Knowledge OS сохранены")
}
function renderKnowledgeOsPanels(){
  if(!document.getElementById("knowledgeOsCommand"))return;
  renderKnowledgeOsCommand();renderKnowledgeOsPace();renderKnowledgeOsConsistency();renderKnowledgeOsReview();renderKnowledgeOsCapture();renderKnowledgeOsQueue();renderKnowledgeOsMonth();renderKnowledgeOsSettings()
}

const renderReadingDashboard1002=renderReadingDashboard;
renderReadingDashboard=function(){renderReadingDashboard1002();ensureKnowledgeOsUi();renderKnowledgeOsPanels()};
