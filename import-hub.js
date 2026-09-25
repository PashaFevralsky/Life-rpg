"use strict";

/* Universal Import Hub 12.7 — preview-first routing and safe apply.
   No state migration. Existing domain import engines remain the source of truth. */

let IMPORT127_PREVIEW=null;

function import127State(){
  let x=S.settings.importHub127;
  if(!x||typeof x!=="object"||Array.isArray(x))x={};
  if(!Array.isArray(x.history))x.history=[];
  if(!Array.isArray(x.fingerprints))x.fingerprints=[];
  x.version=1;
  S.settings.importHub127=x;
  return x
}
function import127Ext(name){const m=String(name||"").toLowerCase().match(/\.([a-z0-9]+)$/);return m?m[1]:""}
function import127NormHeader(x){return String(x||"").trim().toLowerCase().replace(/ё/g,"е").replace(/[\s_\-./]+/g,"")}
function import127HeaderMap(headers){const m=new Map();headers.forEach((h,i)=>m.set(import127NormHeader(h),i));return m}
function import127FindHeader(map,patterns){for(const [k,i] of map)if(patterns.some(p=>k.includes(import127NormHeader(p))))return i;return -1}
function import127CsvTable(text){
  const lines=String(text||"").replace(/\r/g,"").split("\n").filter(x=>x.trim());
  if(lines.length<2)throw new Error("В файле нет строк данных");
  const delim=typeof detectDelimiter==="function"?detectDelimiter(lines[0]):";";
  const split=line=>typeof splitCsvLine==="function"?splitCsvLine(line,delim):line.split(delim);
  const headers=split(lines[0]).map(x=>x.trim()),rows=[];
  for(let n=1;n<Math.min(lines.length,10001);n++){
    const cols=split(lines[n]);if(!cols.some(x=>String(x||"").trim()))continue;
    const row={};headers.forEach((h,i)=>row[h]=cols[i]??"");rows.push(row)
  }
  return {headers,rows,delim}
}
function import127CsvKind(headers){
  const h=headers.map(import127NormHeader),has=(...xs)=>xs.some(x=>h.some(y=>y.includes(import127NormHeader(x))));
  if(has("tracker","metric","показатель")&&(has("value","значение")||has("durationmin","minutes","минут")))return"personal-csv";
  if(has("sales","продажи","реализация")||has("contacts","контакты")||has("followups","фоллоу","лпр","meetings","встречи","proposals","кп"))return"work-csv";
  if(has("minutes","min","длительность","минуты")&&(has("focus","фокус","serve","подача","foot","ноги","opponent","соперник","wins","победы")))return"tennis-csv";
  if(has("amount","сумма","операц","руб")&&has("date","дата"))return"bank-csv";
  return"unknown-csv"
}
function import127Fingerprint(parts){let h=2166136261,s=parts.map(x=>String(x??"")).join("|");for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return `hub127:${(h>>>0).toString(16)}`}
function import127Seen(fp){return import127State().fingerprints.includes(fp)}
function import127Remember(fps){const s=import127State(),set=new Set(s.fingerprints);for(const fp of fps||[])if(fp)set.add(fp);s.fingerprints=[...set].slice(-30000)}
function import127Num(v){if(v==null||String(v).trim()==="")return 0;const n=Number(String(v).replace(/\s/g,"").replace(",","."));return Number.isFinite(n)?n:0}
function import127Cell(row,map,patterns){const i=import127FindHeader(map,patterns);if(i<0)return"";return Object.values(row)[i]??""}
function import127BankPreview(table){
  const map=import127HeaderMap(table.headers),di=import127FindHeader(map,["дата","date"]),ai=import127FindHeader(map,["сумма","amount","операц","руб"]),xi=import127FindHeader(map,["опис","назнач","description","merchant","детал"]);
  if(di<0||ai<0)throw new Error("Для банковского CSV нужны дата и сумма");
  const candidates=[];for(const row of table.rows){
    const cols=Object.values(row),dateKey=typeof parseCsvDate==="function"?parseCsvDate(cols[di]):String(cols[di]||""),raw=typeof parseMoney==="function"?parseMoney(cols[ai]):import127Num(cols[ai]),desc=xi>=0?cols[xi]:"Импорт CSV";
    if(!dateKey||!raw)continue;const amount=Math.abs(raw),strongTransfer=/между своими|между счетами|собственн|на свой|себе/i.test(String(desc||"")),type=strongTransfer?"transfer":raw>0?"income":"expense";
    candidates.push({include:true,dateKey,amount,type,category:type==="expense"&&typeof classifyImportedExpense==="function"?classifyImportedExpense(desc):"Другое",desc:String(desc||"").trim()})
  }
  let dupes=0,seen=new Map();for(const c of candidates){const base=`${c.dateKey}|${c.amount}|${c.type}|${c.desc}`,n=(seen.get(base)||0)+1;seen.set(base,n);const fp=typeof importFingerprint==="function"?importFingerprint(c.dateKey,c.amount,c.type,c.desc,n):import127Fingerprint([base,n]);if((S.bankImportIds||[]).includes(fp))dupes++}
  return {kind:"bank-csv",rows:candidates,total:table.rows.length,valid:candidates.length,invalid:table.rows.length-candidates.length,duplicates:dupes}
}
function import127WorkPreview(table){
  const map=import127HeaderMap(table.headers),get=(row,p)=>import127Cell(row,map,p),out=[],bad=[],dupes=[];
  for(let i=0;i<table.rows.length;i++){const r=table.rows[i],date=typeof parseCsvDate==="function"?parseCsvDate(get(r,["date","дата"])):String(get(r,["date","дата"])),x={
    date,sales:Math.max(0,import127Num(get(r,["sales","продажи","реализация"]))),contacts:Math.max(0,import127Num(get(r,["contacts","контакты"]))),followups:Math.max(0,import127Num(get(r,["followups","followup","фоллоу","повтор"]))),lpr:Math.max(0,import127Num(get(r,["lpr","лпр"]))),meetings:Math.max(0,import127Num(get(r,["meetings","встречи"]))),proposals:Math.max(0,import127Num(get(r,["proposals","proposal","кп","предложения"]))),wins:Math.max(0,import127Num(get(r,["wins","победы","заказы"]))),pipeline:Math.max(0,import127Num(get(r,["pipeline","воронка","потенциал"]))),note:String(get(r,["note","comment","примеч","коммент"])||"").trim()
  };if(!date||date>localDateKey()){bad.push({index:i+2});continue}x.fp=import127Fingerprint(["work",date,x.sales,x.contacts,x.followups,x.lpr,x.meetings,x.proposals,x.wins,x.pipeline,x.note]);if(import127Seen(x.fp)){dupes.push(x);continue}out.push(x)}
  return {kind:"work-csv",rows:out,total:table.rows.length,valid:out.length,invalid:bad.length,duplicates:dupes.length}
}
function import127TennisPreview(table){
  const map=import127HeaderMap(table.headers),get=(row,p)=>import127Cell(row,map,p),out=[],bad=[],dupes=[];
  for(let i=0;i<table.rows.length;i++){const r=table.rows[i],dateKey=typeof parseCsvDate==="function"?parseCsvDate(get(r,["date","дата"])):String(get(r,["date","дата"])),min=Math.max(0,Math.round(import127Num(get(r,["minutes","min","длительность","минуты"])))),serveMin=Math.max(0,Math.round(import127Num(get(r,["serve","подача"])))),footMin=Math.max(0,Math.round(import127Num(get(r,["foot","ноги"])))),x={
    dateKey,min,type:String(get(r,["type","тип"])||"Тренировка").trim()||"Тренировка",focus:String(get(r,["focus","фокус"])||"Смешанная").trim()||"Смешанная",load:clamp(Math.round(import127Num(get(r,["load","нагрузка"]))||7),1,10),serveMin,footMin,w:Math.max(0,Math.round(import127Num(get(r,["wins","w","победы"])))),l:Math.max(0,Math.round(import127Num(get(r,["losses","l","поражения"])))),opponent:String(get(r,["opponent","соперник"])||"").trim(),opponentRating:Math.max(0,Math.round(import127Num(get(r,["opponentrating","rating","рейтинг"]))||0)),score:String(get(r,["score","счет","счёт"])||"").trim(),note:String(get(r,["note","comment","примеч","коммент"])||"").trim()
  };if(!dateKey||dateKey>localDateKey()||min<=0||serveMin+footMin>min){bad.push({index:i+2});continue}x.fp=import127Fingerprint(["tennis",dateKey,min,x.type,x.focus,x.load,serveMin,footMin,x.w,x.l,x.opponent,x.score,x.note]);if(import127Seen(x.fp)){dupes.push(x);continue}out.push(x)}
  return {kind:"tennis-csv",rows:out,total:table.rows.length,valid:out.length,invalid:bad.length,duplicates:dupes.length}
}
function import127PersonalPreview(table){
  if(typeof personalImportPreviewRows!=="function")throw new Error("Personal importer недоступен");
  const p=personalImportPreviewRows(table.rows);return {kind:"personal-csv",personal:p,total:p.total,valid:p.valid.length,invalid:p.invalid.length,duplicates:p.duplicates.length}
}
async function import127Decrypt(obj){
  if(obj?.format!=="life-rpg-encrypted-v1")return obj;
  const pass=prompt("Пароль от резервной копии:");if(!pass)throw new Error("Пароль не указан");
  const dec64=base64ToBytes,enc=new TextEncoder(),keyMat=await crypto.subtle.importKey("raw",enc.encode(pass),"PBKDF2",false,["deriveKey"]),key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:dec64(obj.salt),iterations:200000,hash:"SHA-256"},keyMat,{name:"AES-GCM",length:256},false,["decrypt"]),plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:dec64(obj.iv)},key,dec64(obj.data));
  return JSON.parse(new TextDecoder().decode(plain))
}
function import127BackupCounts(obj){const entities=obj?.entities||{};return {accounts:obj?.accounts?.length||0,debts:obj?.debts?.length||0,transactions:(obj?.incomeLogs?.length||0)+(obj?.expenses?.length||0)+(obj?.payments?.length||0)+(obj?.bankTransfers?.length||0),work:obj?.workLogs?.length||0,tennis:obj?.tennis?.length||0,books:obj?.books?.length||0,tasks:entities.tasks?.length||obj?.settings?.tasks?.length||0,reviews:entities.reviews?.length||obj?.settings?.reviews?.length||0}}
function import127JsonKind(obj){
  if(obj?.format==="life-rpg-reading-list-v1")return"reading-list";
  if(obj?.format==="life-rpg-personal-os-v1")return"personal-portable";
  if(obj?.format==="life-rpg-statement-import-v1"||obj?.format==="life-rpg-ai-import-v1")return"ai-package";
  if(Array.isArray(obj)||Array.isArray(obj?.events)||Array.isArray(obj?.rows))return"personal-json";
  if(obj&&typeof obj==="object"&&(Number.isFinite(+obj.version)||obj.profile||obj.settings||obj.entities)&&Array.isArray(obj.accounts||[]))return"backup";
  return"unknown-json"
}
async function import127Prepare(input){
  const file=input?.files?.[0];if(!file)return;const ext=import127Ext(file.name),base={file,name:file.name,size:file.size||0,ext,preparedAt:new Date().toISOString()};
  try{
    if(["pdf","xlsx","xls"].includes(ext)){IMPORT127_PREVIEW={...base,kind:"finance-route",route:"finance",message:"Этот бинарный формат не разбирается локально без отдельного парсера. Для выписки используй CSV либо пакет life-rpg-statement-import-v1; PDF/XLSX можно преобразовать через ChatGPT и затем загрузить JSON сюда."};renderImport127();return}
    if((file.type||"").startsWith("image/")||["png","jpg","jpeg","webp"].includes(ext)){IMPORT127_PREVIEW={...base,kind:"image-route",route:"finance",message:"Изображение будет обрабатываться существующим Financial OCR. Hub не записывает данные со скрина напрямую."};renderImport127();return}
    const text=await file.text();
    if(["json","lrpg"].includes(ext)||String(text).trim().startsWith("{")||String(text).trim().startsWith("[")){
      let obj=JSON.parse(text);obj=await import127Decrypt(obj);const checkedBackup=import127JsonKind(obj)==="backup"?window.LifePlatform?.validateBackup?.(obj):null;if(checkedBackup&&!checkedBackup.ok)throw new Error(checkedBackup.error||"Backup не прошёл проверку");if(checkedBackup?.data)obj=checkedBackup.data;
      const kind=import127JsonKind(obj);let meta={};
      if(kind==="backup")meta={counts:import127BackupCounts(obj)};
      else if(kind==="reading-list"){const q=normalizeReadingListPackage(obj),existing=new Set((S.books||[]).map(b=>bookIdentityKey(b.author,b.title)));meta={total:q.books.length,newCount:q.books.filter(b=>!existing.has(bookIdentityKey(b.author,b.title))).length}}
      else if(kind==="personal-portable")meta={counts:personalPortableCounts(obj)};
      else if(kind==="personal-json"){const rows=Array.isArray(obj)?obj:Array.isArray(obj.events)?obj.events:obj.rows;const p=personalImportPreviewRows(rows);meta={personal:p,total:p.total,valid:p.valid.length,invalid:p.invalid.length,duplicates:p.duplicates.length}}
      else if(kind==="ai-package")meta={actions:Array.isArray(obj.actions)?obj.actions.length:Array.isArray(obj.transactions)?obj.transactions.length:0,format:obj.format};
      IMPORT127_PREVIEW={...base,kind,payload:obj,...meta};renderImport127();return
    }
    const table=import127CsvTable(text),kind=import127CsvKind(table.headers);let p;
    if(kind==="bank-csv")p=import127BankPreview(table);else if(kind==="work-csv")p=import127WorkPreview(table);else if(kind==="tennis-csv")p=import127TennisPreview(table);else if(kind==="personal-csv")p=import127PersonalPreview(table);else p={kind:"unknown-csv",total:table.rows.length,headers:table.headers};
    IMPORT127_PREVIEW={...base,...p,table};renderImport127()
  }catch(e){IMPORT127_PREVIEW={...base,kind:"error",error:String(e?.message||e)};renderImport127()}
  finally{input.value=""}
}
function import127Label(kind){return({"backup":"Полная резервная копия","reading-list":"Список чтения","personal-portable":"Personal OS backup","personal-json":"Personal JSON","personal-csv":"Personal CSV","bank-csv":"Банковский CSV","work-csv":"Work CSV","tennis-csv":"Tennis CSV","ai-package":"Пакет ChatGPT / выписка","finance-route":"PDF/XLSX → Financial import","image-route":"Скрин → Financial OCR","unknown-csv":"Неизвестный CSV","unknown-json":"Неизвестный JSON","error":"Ошибка"})[kind]||kind}
function import127CanApply(p=IMPORT127_PREVIEW){
  if(!p)return false;if(["backup","reading-list","personal-portable","personal-json","personal-csv","bank-csv","work-csv","tennis-csv"].includes(p.kind))return p.kind==="backup"||p.kind==="personal-portable"||p.kind==="reading-list"?(p.kind!=="reading-list"||p.newCount>0):(+p.valid||0)>0;
  return false
}
function import127HistoryAdd(row){const s=import127State();s.history.unshift({id:uid(),at:new Date().toISOString(),...row});s.history=s.history.slice(0,60);return s.history[0]}
async function import127Apply(){
  const p=IMPORT127_PREVIEW;if(!p||!import127CanApply(p))return;const beforeTs=await createPreActionSnapshot(`Import Hub 12.7 • ${p.name||p.kind}`),now=new Date().toISOString();let history=null;
  try{
    if(p.kind==="backup"){S=normalizeState(p.payload);storageLoadBlocked=false;history=import127HistoryAdd({kind:p.kind,name:p.name,count:Object.values(p.counts||{}).reduce((a,b)=>a+(+b||0),0),snapshotTs:beforeTs,rollback:"snapshot"});await persist();render();toast("Резервная копия восстановлена через Import Hub")}
    else if(p.kind==="reading-list"){const r=mergeReadingListPackage(p.payload);history=import127HistoryAdd({kind:p.kind,name:p.name,count:r.added.length,ids:r.added.map(x=>x.id),snapshotTs:beforeTs,rollback:"books"});audit("Import Hub • Reading","knowledge",`${r.added.length} добавлено • ${r.skipped.length} дублей`);await persist();render();toast(`Добавлено книг: ${r.added.length}`)}
    else if(p.kind==="personal-portable"){const d=personalData(),o=p.payload,created={journal:[],decisions:[],people:[],interactions:[],timeboxes:[],focusSessions:[],chores:[],inventory:[],shopping:[],trackers:[],events:[]};const merge=(target,rows,key)=>{const ids=new Set(target.map(x=>String(x?.id||"")));for(const row of rows||[]){if(!row?.id||ids.has(String(row.id)))continue;target.push(personalSafeJsonClone(row));ids.add(String(row.id));created[key].push(String(row.id))}};merge(d.journal,o.journal,"journal");merge(d.decisions,o.decisions,"decisions");merge(d.people,o.people,"people");merge(d.interactions,o.interactions,"interactions");merge(d.timeboxes,o.timeboxes,"timeboxes");merge(d.focusSessions,o.focusSessions,"focusSessions");merge(d.chores,o.home?.chores,"chores");merge(d.inventory,o.home?.inventory,"inventory");merge(d.shopping,o.home?.shopping,"shopping");if(typeof growthData==="function"){const g=growthData();merge(g.trackers,o.tracking?.trackers,"trackers");merge(g.events,o.tracking?.events,"events")}const count=Object.values(created).reduce((n,a)=>n+a.length,0);history=import127HistoryAdd({kind:p.kind,name:p.name,count,created,snapshotTs:beforeTs,rollback:"snapshot"});audit("Import Hub • Personal restore","system",`добавлено ${count}`);await persist();render();toast(`Восстановлено записей: ${count}`)}
    else if(p.kind==="personal-json"||p.kind==="personal-csv"){const q=p.personal,seen=new Set(personalData().importFingerprints),eventIds=[],trackerBefore=new Set((typeof growthTrackers==="function"?growthTrackers():[]).map(x=>x.id));for(const row of q.valid){const t=personalImportEnsureTracker(row);if(!t)continue;const ev=growthLogEvent(t.id,{dateKey:row.dateKey,occurredAt:`${row.dateKey}T12:00:00`,value:row.value,durationMin:row.durationMin,note:row.note});if(ev?.id)eventIds.push(ev.id);seen.add(row.fingerprint)}personalData().importFingerprints=[...seen].slice(-20000);const trackerIds=(typeof growthTrackers==="function"?growthTrackers():[]).filter(x=>!trackerBefore.has(x.id)).map(x=>x.id);history=import127HistoryAdd({kind:p.kind,name:p.name,count:q.valid.length,eventIds,trackerIds,snapshotTs:beforeTs,rollback:"snapshot"});audit("Import Hub • Personal","system",`импорт ${q.valid.length}`);await persist();render();toast(`Импортировано ${q.valid.length}`)}
    else if(p.kind==="bank-csv"){const r=await applyImportedCandidates(p.rows,"csv");history=import127HistoryAdd({kind:p.kind,name:p.name,count:r.created?.length||0,batchId:r.batchId||"",snapshotTs:beforeTs,rollback:"bank-batch"});await save(`Import Hub: банковских операций ${r.created?.length||0}`);toast(`Импортировано операций: ${r.created?.length||0}`)}
    else if(p.kind==="work-csv"){const ids=[],fps=[];for(const x of p.rows){const row={id:uid(),date:x.date,createdAt:now,updatedAt:now,sourceDealId:"",sales:x.sales,contacts:x.contacts,followups:x.followups,lpr:x.lpr,meetings:x.meetings,proposals:x.proposals,wins:x.wins,pipeline:x.pipeline,note:x.note,xpAward:0,imported:"hub-12.7",importFp:x.fp};S.workLogs.unshift(row);ids.push(row.id);fps.push(x.fp)}S.workLogs.sort((a,b)=>String(b.date).localeCompare(String(a.date)));import127Remember(fps);history=import127HistoryAdd({kind:p.kind,name:p.name,count:ids.length,ids,fps,snapshotTs:beforeTs,rollback:"work"});audit("Import Hub • Work","work",`${ids.length} строк`);await save(`Work импорт: ${ids.length}`)}
    else if(p.kind==="tennis-csv"){const ids=[],fps=[];for(const x of p.rows){const row={id:uid(),dateKey:x.dateKey,date:parseLocal(x.dateKey).toLocaleDateString("ru-RU"),createdAt:now,updatedAt:now,type:x.type,min:x.min,focus:x.focus,load:x.load,w:x.w,l:x.l,serveMin:x.serveMin,footMin:x.footMin,matches:[],opponent:x.opponent,opponentRating:x.opponentRating,score:x.score,note:x.note,xpAward:0,imported:"hub-12.7",importFp:x.fp};S.tennis.unshift(row);ids.push(row.id);fps.push(x.fp)}import127Remember(fps);if(typeof recomputeTennisElo==="function")recomputeTennisElo();history=import127HistoryAdd({kind:p.kind,name:p.name,count:ids.length,ids,fps,snapshotTs:beforeTs,rollback:"tennis"});audit("Import Hub • Tennis","sport",`${ids.length} строк`);await save(`Tennis импорт: ${ids.length}`)}
    IMPORT127_PREVIEW=null;renderImport127()
  }catch(e){if(!history)toast("Импорт не применён: "+String(e?.message||e));throw e}
}
async function import127Rollback(id){
  const h=import127State().history.find(x=>x.id===id);if(!h)return;
  if(h.rollback==="bank-batch"&&h.batchId){await rollbackImportBatch(h.batchId);h.rolledBackAt=new Date().toISOString();await persist();renderImport127();return}
  if(h.rollback==="work"){if(!confirm(`Удалить ${h.ids?.length||0} рабочих записей этого импорта?`))return;const set=new Set(h.ids||[]);S.workLogs=(S.workLogs||[]).filter(x=>!set.has(x.id));h.rolledBackAt=new Date().toISOString();await save("Work импорт отменён");return}
  if(h.rollback==="tennis"){if(!confirm(`Удалить ${h.ids?.length||0} теннисных записей этого импорта?`))return;const set=new Set(h.ids||[]);S.tennis=(S.tennis||[]).filter(x=>!set.has(x.id));if(typeof recomputeTennisElo==="function")recomputeTennisElo();h.rolledBackAt=new Date().toISOString();await save("Tennis импорт отменён");return}
  if(h.rollback==="books"){if(!confirm("Удалить книги, добавленные этим импортом, если по ним ещё нет чтения?"))return;const used=new Set((S.readingLogs||[]).map(x=>x.bookId)),set=new Set((h.ids||[]).filter(x=>!used.has(x)));S.books=(S.books||[]).filter(x=>!set.has(x.id));h.rolledBackAt=new Date().toISOString();await save(`Удалено книг: ${set.size}`);return}
  if(h.snapshotTs){if(!confirm("Этот импорт требует восстановления страховочного snapshot. Изменения после импорта могут быть потеряны. Открыть восстановление?"))return;await restoreSnapshot(h.snapshotTs);return}
}
function import127Route(){
  const p=IMPORT127_PREVIEW;if(!p)return;if(p.kind==="image-route"){switchTab("finance");ux7SetView("finance","bank",false);requestAnimationFrame(()=>document.querySelector(".financial-command-card")?.scrollIntoView({behavior:"smooth",block:"start"}));if(typeof recognizeSmartInbox==="function")Promise.resolve(recognizeSmartInbox([p.file])).catch(e=>toast("OCR: "+String(e?.message||e)));return}
  if(p.kind==="finance-route"){switchTab("finance");ux7SetView("finance","bank",false);requestAnimationFrame(()=>document.getElementById("bankSyncCard")?.scrollIntoView({behavior:"smooth",block:"start"}));return}
  if(p.kind==="ai-package"){handleAiImportFile(p.file).then(()=>{switchTab("more");ux7SetView("more","overview",false);requestAnimationFrame(()=>document.getElementById("aiImportPreview")?.scrollIntoView({behavior:"smooth",block:"center"}))});return}
}
function import127Cancel(){IMPORT127_PREVIEW=null;renderImport127()}
function import127PreviewHtml(p){
  if(!p)return'<div class="empty">Выбери файл — запись данных начнётся только после preview и подтверждения.</div>';
  if(p.kind==="error")return`<div class="notice danger"><b>Ошибка:</b> ${escapeHtml(p.error||"")}</div>`;
  if(["finance-route","image-route"].includes(p.kind))return`<div class="notice"><b>${escapeHtml(import127Label(p.kind))}</b><div class="qmeta">${escapeHtml(p.message||"")}</div></div>`;
  if(p.kind==="unknown-csv")return`<div class="notice"><b>CSV не классифицирован.</b><div class="qmeta">Заголовки: ${escapeHtml((p.headers||[]).join(", "))}</div></div>`;
  if(p.kind==="unknown-json")return'<div class="notice danger">JSON не соответствует известному формату Life RPG.</div>';
  if(p.kind==="backup")return`<div class="notice"><b>Полная замена состояния после подтверждения.</b><div class="qmeta">${Object.entries(p.counts||{}).map(([k,v])=>`${k}: ${v}`).join(" • ")}</div><div class="qmeta">Перед применением автоматически создаётся snapshot.</div></div>`;
  if(p.kind==="reading-list")return`<div class="report-grid"><div class="report-item"><div class="smallcaps">В файле</div><b>${p.total}</b></div><div class="report-item"><div class="smallcaps">Новых</div><b>${p.newCount}</b></div><div class="report-item"><div class="smallcaps">Дубли</div><b>${p.total-p.newCount}</b></div></div>`;
  if(p.kind==="personal-portable")return`<div class="notice"><b>Personal OS backup</b><div class="qmeta">${Object.entries(p.counts||{}).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join(" • ")||"нет данных"}</div></div>`;
  if(p.kind==="ai-package")return`<div class="notice"><b>${escapeHtml(p.format||"Пакет")}</b><div class="qmeta">Элементов: ${p.actions||0}. Hub передаст файл в существующий AI Bridge, где остаётся его собственный preview.</div></div>`;
  const valid=typeof p.valid==="number"?p.valid:p.rows?.length||0,invalid=+p.invalid||0,dupes=+p.duplicates||0;
  const samples=(p.rows||p.personal?.valid||[]).slice(0,5).map(x=>`<div class="log-item"><div class="qtitle">${escapeHtml(x.date||x.dateKey||x.tracker||"строка")}</div><div class="qmeta">${escapeHtml(x.desc||x.note||x.type||x.tracker||"")}</div></div>`).join("");
  return`<div class="report-grid"><div class="report-item"><div class="smallcaps">Строк</div><b>${p.total||0}</b></div><div class="report-item"><div class="smallcaps">Готово</div><b>${valid}</b></div><div class="report-item"><div class="smallcaps">Дубли</div><b>${dupes}</b></div><div class="report-item"><div class="smallcaps">Ошибки</div><b>${invalid}</b></div></div>${samples}`
}
function import127HistoryHtml(){
  const all=import127State().history.slice(0,12);if(!all.length)return'<div class="empty">Импортов через Hub ещё не было.</div>';
  return all.map(h=>`<div class="log-item"><div class="qtitle">${new Date(h.at).toLocaleString("ru-RU")} • ${escapeHtml(import127Label(h.kind))}</div><div class="qmeta">${escapeHtml(h.name||"")} • применено ${h.count||0}${h.rolledBackAt?" • отменено":""}</div>${!h.rolledBackAt&&h.rollback?`<button class="btn ghost small" style="margin-top:7px" onclick="import127Rollback('${h.id}')">${h.rollback==="snapshot"?"Восстановить snapshot":"Откатить импорт"}</button>`:""}</div>`).join("")
}
function ensureImport127Ui(){
  if(document.getElementById("import127Command"))return;const grid=document.querySelector?.("#more .grid");if(!grid)return;const anchor=document.getElementById("systemDiagnostics")?.closest(".card")||grid.lastElementChild;
  const html=`<div data-ux7-view="settings" class="card ux7-card span-12"><div class="eyebrow">Universal Import Hub 12.7</div><div class="section-title">Один вход для внешних данных</div><div class="muted" style="margin-top:6px">CSV/JSON классифицируются локально. До подтверждения состояние не меняется. Каждый применяемый импорт получает страховочный snapshot; банковские пакеты используют существующий пакетный rollback.</div><div id="import127Command" style="margin-top:10px"></div><div class="split" style="margin-top:10px"><label class="btn">Выбрать файл<input id="import127File" type="file" accept=".json,.lrpg,.csv,.tsv,.txt,.pdf,.xlsx,.xls,image/*,application/json,text/csv" style="display:none" onchange="import127Prepare(this)"></label><button class="btn ghost" onclick="import127Cancel()">Очистить preview</button><button class="btn ghost" onclick="personalExportPortable()">Экспорт Personal OS</button></div><div id="import127Preview" style="margin-top:10px"></div><div class="split" style="margin-top:10px"><button class="btn" id="import127Apply" onclick="import127Apply()" disabled>Применить проверенное</button><button class="btn secondary" id="import127Route" onclick="import127Route()" hidden>Открыть специализированный импорт</button></div><div class="status" style="margin-top:9px">Work CSV: date, sales, contacts, followups, lpr, meetings, proposals, wins, pipeline, note. Tennis CSV: date, minutes, type, focus, load, serve, foot, wins, losses, opponent, rating, score, note.</div></div><div data-ux7-view="settings" class="card ux7-card span-12"><div class="title">Журнал Import Hub</div><div id="import127History"></div></div>`;
  anchor?.insertAdjacentHTML("afterend",html)
}
function import127Consolidate(){
  const hub=document.getElementById("import127Command"),legacy=document.getElementById("personalImportCommand")?.closest(".card");if(hub&&legacy)legacy.hidden=true
}
function renderImport127(){
  const cmd=document.getElementById("import127Command");if(!cmd)return;const s=import127State(),p=IMPORT127_PREVIEW,bank=(S.importBatches||[]).length;
  cmd.innerHTML=`<div class="report-grid"><div class="report-item"><div class="smallcaps">Hub imports</div><b>${s.history.length}</b></div><div class="report-item"><div class="smallcaps">Hub fingerprints</div><b>${s.fingerprints.length}</b></div><div class="report-item"><div class="smallcaps">Finance batches</div><b>${bank}</b></div><div class="report-item"><div class="smallcaps">Preview</div><b>${p?escapeHtml(import127Label(p.kind)):"—"}</b></div></div>`;
  const box=document.getElementById("import127Preview");if(box)box.innerHTML=import127PreviewHtml(p);const apply=document.getElementById("import127Apply");if(apply)apply.disabled=!import127CanApply(p);const route=document.getElementById("import127Route");if(route)route.hidden=![ "finance-route","image-route","ai-package"].includes(p?.kind);const hist=document.getElementById("import127History");if(hist)hist.innerHTML=import127HistoryHtml();import127Consolidate()
}
