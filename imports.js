"use strict";

/* Life RPG 8.0.2 — Bank, OCR and import engine */

let bankSyncSession={accountId:"",bankBalance:null,balanceConfidence:0,balanceLabel:"",balanceSource:"",baseExpected:0,wasVerified:false,importedNet:0,detectedAt:"",lastText:""};

function bankSyncTolerance(){return Math.max(0,finiteNumberOr($("bankSyncTolerance")?.value,1))}

function selectedBankSyncAccountId(){return $("bankSyncAccount")?.value||bankSyncSession.accountId||defaultAccountId()}

function bankSyncAccount(){return S.accounts.find(a=>a.id===selectedBankSyncAccountId())||S.accounts.find(a=>a.id===defaultAccountId())||S.accounts[0]}

function resetBankSyncSession(keepAccount=true){const id=keepAccount?selectedBankSyncAccountId():defaultAccountId();bankSyncSession={accountId:id,bankBalance:null,balanceConfidence:0,balanceLabel:"",balanceSource:"",baseExpected:accountBalanceById(id),wasVerified:!!S.accounts.find(a=>a.id===id)?.verifiedAt,importedNet:0,detectedAt:"",lastText:""};screenshotImportQueue=[];renderScreenshotQueue();if($("screenshotImportStatus"))$("screenshotImportStatus").textContent="Скрины операций ещё не выбраны.";renderBankSync()}

function changeBankSyncAccount(){resetBankSyncSession(true)}

function parseOcrAmount(s){const n=Number(String(s||"").replace(/[ \u00A0]/g,"").replace(",","."));return Number.isFinite(n)?n:NaN}

function extractBankBalance(text){
  const raw=String(text||"").replace(/\r/g,"");
  const patterns=[
    {re:/(?:^|\n)\s*(баланс(?:\s+сч[её]та|\s+карты)?|остаток(?:\s+на\s+сч[её]те)?|доступно(?:\s+средств)?|на\s+сч[её]те)\s*[:\-]?\s*([+\-−]?\s*\d[\d \u00A0]*(?:[.,]\d{1,2})?)\s*(₽|руб\.?|р\b)?/ig,score:.96},
    {re:/(баланс|остаток|доступно|на\s+сч[её]те)[^\n\d]{0,28}([+\-−]?\s*\d[\d \u00A0]*(?:[.,]\d{1,2})?)\s*(₽|руб\.?|р\b)?/ig,score:.88},
    {re:/(?:средств[ао]?|денег)\s+(?:на|в)\s+сч[её]т[еа]?[^\n\d]{0,20}([+\-−]?\s*\d[\d \u00A0]*(?:[.,]\d{1,2})?)\s*(₽|руб\.?|р\b)?/ig,score:.8,noLabel:true}
  ];
  const found=[];for(const p of patterns){p.re.lastIndex=0;let m;while((m=p.re.exec(raw))){const val=parseOcrAmount(p.noLabel?m[1]:m[2]);if(!Number.isFinite(val)||val<0||val>1e9)continue;const label=p.noLabel?"Средства на счёте":m[1].replace(/\s+/g," ").trim();const currency=!!(p.noLabel?m[2]:m[3]);found.push({amount:val,label,confidence:clamp(p.score+(currency?0.02:0),0,.99),raw:m[0].trim()})}}
  if(!found.length)return null;found.sort((a,b)=>b.confidence-a.confidence);return found[0]
}

function pendingBankSyncNet(){const id=selectedBankSyncAccountId();return screenshotImportQueue.filter(c=>c.include!==false&&(c.accountId||id)===id).reduce((s,c)=>s+candidateSyncEffect(c),0)}

function bankSyncProjection(){const pending=pendingBankSyncNet(),projected=bankSyncSession.baseExpected+(bankSyncSession.importedNet||0)+pending,residual=bankSyncSession.bankBalance==null?null:bankSyncSession.bankBalance-projected;return {pending,projected,residual}}

function renderBankSync(){
  const box=$("bankSyncStatus"),rec=$("bankSyncReconcile");if(!box||!rec)return;const a=bankSyncAccount();if(!a){box.innerHTML='<div class="notice">Сначала добавь банковский счёт.</div>';rec.innerHTML="";return}
  const current=accountBalanceById(a.id),last=a.verifiedAt?new Date(a.verifiedAt).toLocaleString("ru-RU"):"ещё не сверялся";
  if(bankSyncSession.accountId!==a.id&&bankSyncSession.bankBalance==null){bankSyncSession.accountId=a.id;bankSyncSession.baseExpected=current;bankSyncSession.wasVerified=!!a.verifiedAt}
  if(bankSyncSession.bankBalance==null){box.innerHTML=`<div class="bank-sync-summary"><div><span>Счёт</span><b>${escapeHtml(a.name)}</b></div><div><span>Life RPG</span><b>${rub(current)}</b></div><div><span>Последняя сверка</span><b>${escapeHtml(last)}</b></div></div><div class="notice" style="margin-top:10px">Начни со скриншота главного экрана банка, где виден текущий баланс или «Доступно».</div>`;rec.innerHTML="";return}
  const p=bankSyncProjection(),tol=bankSyncTolerance(),initial=!bankSyncSession.wasVerified;
  box.innerHTML=`<div class="bank-sync-summary"><div><span>Банк</span><b>${rub(bankSyncSession.bankBalance)}</b><small>${escapeHtml(bankSyncSession.balanceLabel)} • уверенность ${Math.round(bankSyncSession.balanceConfidence*100)}%</small></div><div><span>Life RPG до сверки</span><b>${rub(bankSyncSession.baseExpected)}</b></div><div><span>После выбранных операций</span><b>${rub(p.projected)}</b></div><div><span>Расхождение</span><b class="${Math.abs(p.residual||0)<=tol?'income-good':'income-bad'}">${p.residual==null?'—':`${p.residual>0?'+':''}${rub(p.residual)}`}</b></div></div>`;
  if(initial){rec.innerHTML=`<div class="notice"><b>Первичная сверка.</b> У Life RPG ещё нет подтверждённого остатка этого счёта. Прими банковский баланс как текущую точку отсчёта. Историю операций можно загрузить после этого — она сохранится для аналитики и не изменит уже подтверждённый текущий остаток.</div><div class="split" style="margin-top:10px"><button class="btn" onclick="acceptDetectedBankBalance('initial')">Принять ${rub(bankSyncSession.bankBalance)} как текущий баланс</button></div>`;return}
  if(Math.abs(p.residual)<=tol){const hasPending=screenshotImportQueue.some(x=>x.include&&x.amount>0);rec.innerHTML=hasPending?`<div class="notice good-notice"><b>Сверка сходится.</b> После импорта выбранных операций приложение зафиксирует банковский баланс ${rub(bankSyncSession.bankBalance)}.</div>`:`<div class="notice good-notice"><b>Баланс совпадает.</b> Можно завершить сверку.</div><div class="split" style="margin-top:10px"><button class="btn" onclick="finalizeBankSync()">Завершить сверку</button></div>`;return}
  const direction=p.residual<0?`не хватает расходов/списаний примерно на ${rub(Math.abs(p.residual))}`:`не хватает поступлений примерно на ${rub(Math.abs(p.residual))}`;
  rec.innerHTML=`<div class="notice"><b>Нужно найти расхождение:</b> ${direction}. Загрузите скрины истории операций после предыдущей сверки. Life RPG пересчитает остаток и покажет, сколько ещё не найдено.</div><div class="split" style="margin-top:10px"><button class="btn ghost" onclick="forceBankBalanceCorrection()">Не нашёл операции — принять баланс банка</button></div>`
}

async function finalizeBankSync(){if(bankSyncSession.bankBalance==null)return;const p=bankSyncProjection();if(Math.abs(p.residual)>bankSyncTolerance()){toast("Сверка пока не сходится");return}await acceptDetectedBankBalance("reconciled")}

async function forceBankBalanceCorrection(){if(bankSyncSession.bankBalance==null)return;const p=bankSyncProjection();if(!confirm(`Осталось необъяснённое расхождение ${rub(Math.abs(p.residual||0))}. Принять банковский баланс без найденной операции?`))return;await acceptDetectedBankBalance("forced")}

async function recognizeBankSyncOperations(files){
  const id=selectedBankSyncAccountId();if(!bankSyncSession.accountId)bankSyncSession.accountId=id;await recognizeBankScreenshots(files,id);renderBankSync()
}

function importHistoricalCutoff(){return S.settings.cashBalanceVerifiedAt||""}

function importIsHistorical(dateKey,occurredAt=""){
  const cutoff=S.settings.cashBalanceVerifiedAt;if(!cutoff)return false;const cutoffTs=Date.parse(cutoff);if(!Number.isFinite(cutoffTs))return false;const cutoffDate=localDateKey(new Date(cutoffTs));
  if(dateKey<cutoffDate)return true;if(dateKey>cutoffDate)return false;
  const txTs=occurredAt?Date.parse(occurredAt):NaN;return Number.isFinite(txTs)&&txTs<=cutoffTs
}

function adjustImportCompensationOnDelete(x){if(!x?.importBatchId||!x.importCashContribution)return;const a=(S.cashAdjustments||[]).find(z=>z.importBatchId===x.importBatchId);if(a)a.delta=(+a.delta||0)+(+x.importCashContribution||0)}

function parseCsvDate(v){v=String(v||"").trim();let m;if((m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;if((m=v.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/)))return `${m[3]}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;return ""}

function parseMoney(v){let s=String(v??"").replace(/\s/g,"").replace(/[₽рRUB]/gi,"").replace(",",".");s=s.replace(/(?!^)-/g,"");const n=Number(s);return Number.isFinite(n)?n:0}

function detectDelimiter(line){const opts=[";","\t",","];return opts.sort((a,b)=>(line.split(b).length-line.split(a).length))[0]}

function splitCsvLine(line,delim){const out=[];let cur="",q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(c===delim&&!q){out.push(cur);cur=""}else cur+=c}out.push(cur);return out}

function transactionFingerprint(date,amount,desc,occurrence=1){let h=0,s=`${date}|${amount}|${desc}|${occurrence}`;for(let i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0;return String(h)}

let screenshotImportQueue=[];

function importFingerprint(dateKey,amount,type,desc,occurrence=1){return transactionFingerprint(dateKey,(type==="expense"?-1:1)*amount,`${type}|${desc}`,occurrence)}

function dateFromOcrText(text,fallbackDate=localDateKey()){
  const raw=String(text||""),s=raw.toLowerCase().replace(/ё/g,"е"),base=parseLocal(fallbackDate);let m;
  if(/сегодня/.test(s))return localDateKey(base);
  if(/позавчера/.test(s))return localDateKey(addDays(base,-2));
  if(/вчера/.test(s))return localDateKey(addDays(base,-1));
  if((m=raw.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\b/)))return `${m[3]}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
  if((m=raw.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2})\b/)))return `20${m[3]}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
  const months={"января":1,"январь":1,"янв":1,"февраля":2,"февраль":2,"фев":2,"марта":3,"март":3,"мар":3,"апреля":4,"апрель":4,"апр":4,"мая":5,"май":5,"июня":6,"июнь":6,"июн":6,"июля":7,"июль":7,"июл":7,"августа":8,"август":8,"авг":8,"сентября":9,"сентябрь":9,"сен":9,"сент":9,"октября":10,"октябрь":10,"окт":10,"ноября":11,"ноябрь":11,"ноя":11,"декабря":12,"декабрь":12,"дек":12};
  if((m=s.match(/(?:^|\s)(\d{1,2})\s+(января|январь|янв|февраля|февраль|фев|марта|март|мар|апреля|апрель|апр|мая|май|июня|июнь|июн|июля|июль|июл|августа|август|авг|сентября|сентябрь|сен|сент|октября|октябрь|окт|ноября|ноябрь|ноя|декабря|декабрь|дек)\.?(?:\s+(\d{4}))?(?=\s|$)/))){
    let y=m[3]?Number(m[3]):base.getFullYear(),month=months[m[2]],d=Number(m[1]),candidate=new Date(y,month-1,d,12);
    if(!m[3]&&candidate-base>180*86400000){y--;candidate=new Date(y,month-1,d,12)}
    if(candidate.getMonth()===month-1&&candidate.getDate()===d)return localDateKey(candidate)
  }
  return fallbackDate
}

function hasExplicitOcrDate(text){return /сегодня|позавчера|вчера|\b\d{1,2}[.\/-]\d{1,2}(?:[.\/-]\d{2,4})?\b|\b\d{1,2}\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)/i.test(String(text||""))}

function timeFromOcrText(text){const m=String(text||"").match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);return m?`${String(m[1]).padStart(2,"0")}:${m[2]}`:""}

async function hashFile(file){const b=await file.arrayBuffer(),d=await crypto.subtle.digest("SHA-256",b);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("")}

function screenshotCategoryOptions(v){return Object.keys(S.envelopeLimits||{}).map(x=>`<option ${x===v?"selected":""}>${escapeHtml(x)}</option>`).join("")}

function removeScreenshotCandidate(id){screenshotImportQueue=screenshotImportQueue.filter(x=>x.id!==id);renderScreenshotQueue();renderBankSync()}

function selectHighConfidence(){screenshotImportQueue.forEach(x=>x.include=x.confidence>=.82);renderScreenshotQueue();renderBankSync()}

function ruleKeyword(desc){const stop=/^(оплата|покупка|перевод|операция|зачисление|списание)$/i;return String(desc||"").replace(/\d+[\s.,]?/g," ").split(/\s+/).map(x=>x.replace(/[^a-zа-яё0-9_-]/gi,"")).filter(x=>x.length>=4&&!stop.test(x))[0]?.toLowerCase()||""}

function learnScreenshotRule(id){const c=screenshotImportQueue.find(x=>x.id===id);if(!c)return;const keyword=ruleKeyword(c.desc);if(!keyword){toast("Не удалось выделить ключевое слово");return}const old=(S.importRules||[]).find(r=>r.keyword===keyword);const rule={id:old?.id||uid(),keyword,type:c.type,category:c.type==="expense"?c.category:"",active:true};if(old)Object.assign(old,rule);else S.importRules.push(rule);audit("Правило импорта","ocr",`${keyword} → ${c.type}${c.category?` / ${c.category}`:""}`);persist();toast(`Правило «${keyword}» сохранено`)}

async function clearScreenshotQueue(){screenshotImportQueue=[];renderScreenshotQueue();$("screenshotImportStatus").textContent="Очередь очищена";renderBankSync()}

async function restoreLastDeleted(){const z=S.trash?.shift();if(!z){toast("Корзина пуста");return}const x=deepClone(z.item);if(z.kind==="income")S.incomeLogs.unshift(x);else if(z.kind==="expense"){x.reservationUse=[];S.expenses.unshift(x)}else if(z.kind==="transfer")S.bankTransfers.unshift(x);else{toast("Этот тип нельзя восстановить автоматически");return}audit("Восстановлено",z.kind,x.note||x.source||"");await save("Последняя удалённая операция восстановлена")}

function csvCell(v){return `"${String(v??"").replaceAll('"','""')}"`}

function exportTransactionsCsv(){const rows=[["Дата","Тип","Описание","Категория","Счёт","Сумма"]];for(const x of unifiedTransactions().slice().reverse())rows.push([x.dateKey,x.kind,x.title,x.category,x.account,x.amount]);const csv='\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`life-rpg-transactions-${localDateKey()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);audit("Экспорт CSV","finance",`${rows.length-1} операций`)}

function renderImportRules(){const box=$("importRuleList");if(!box)return;box.innerHTML=(S.importRules||[]).length?S.importRules.map(r=>`<div class="log-item"><div class="qtitle">${escapeHtml(r.keyword)} → ${escapeHtml(r.type||"expense")}${r.category?` / ${escapeHtml(r.category)}`:""}</div><button class="btn ghost small" onclick="deleteImportRule('${r.id}')">Удалить</button></div>`).join(""):'<div class="empty">Правил пока нет.</div>'}

function addImportRule(){const keyword=$("ruleKeyword").value.trim().toLowerCase(),type=$("ruleType").value,category=$("ruleCategory").value;if(!keyword){toast("Укажи ключевое слово");return}S.importRules.push({id:uid(),keyword,type,category:type==="expense"?category:"",active:true});$("ruleKeyword").value="";audit("Правило импорта","ocr",keyword);save("Правило добавлено")}

function deleteImportRule(id){S.importRules=S.importRules.filter(x=>x.id!==id);save("Правило удалено")}

async function importBankCsv(file){
  const text=await file.text(),lines=text.replace(/\r/g,"").split("\n").filter(x=>x.trim());if(lines.length<2)throw new Error("CSV пустой");const delim=detectDelimiter(lines[0]),headers=splitCsvLine(lines[0],delim).map(x=>x.trim().toLowerCase());const find=patterns=>headers.findIndex(h=>patterns.some(p=>h.includes(p)));let di=find(["дата","date"]),ai=find(["сумма","amount","операц","руб"]),xi=find(["опис","назнач","description","merchant","детал"]);let start=1;if(di<0||ai<0){di=0;xi=1;ai=2;start=0}const candidates=[];
  for(let n=start;n<Math.min(lines.length,5001);n++){const cols=splitCsvLine(lines[n],delim);if(cols.length<=Math.max(di,ai,xi))continue;const dateKey=parseCsvDate(cols[di]),raw=parseMoney(cols[ai]),desc=xi>=0?cols[xi]:"Импорт CSV";if(!dateKey||!raw)continue;const amount=Math.abs(raw),strongTransfer=/между своими|между счетами|собственн|на свой|себе/i.test(String(desc||"")),type=strongTransfer?"transfer":raw>0?"income":"expense";candidates.push({include:true,dateKey,amount,type,category:type==="expense"?classifyImportedExpense(desc):"Другое",desc:String(desc||"").trim()})}
  const r=await applyImportedCandidates(candidates,"csv");await save(`Импортировано: доходов ${r.income}, расходов ${r.expense}, переводов ${r.transfer}`);$("bankImportStatus").innerHTML=`<span class="csv-ok">Доходов: ${r.income} • расходов: ${r.expense} • переводов: ${r.transfer}</span>${r.dupes?` • дублей пропущено: ${r.dupes}`:""}`;if(S.settings.autoReserveAfterImport&&S.settings.cashBalanceVerifiedAt)await acceptAutopilotPlan()
}

async function clearImportedTransactions(){if(!confirm("Удалить все импортированные операции? Перед удалением будет создан отдельный снимок. Банковские сверки останутся."))return;const importedPayments=(S.payments||[]).filter(x=>x.imported),locked=importedPayments.filter(x=>!x.historicalOnly&&paymentLockedBySync(x));if(locked.length){toast(`Нельзя очистить импорт: ${locked.length} платежей уже зафиксированы более поздней банковской сверкой`);return}await createPreActionSnapshot("Перед очисткой импортированных операций");for(const x of importedPayments){if(!x.historicalOnly){const d=debtById(x.debtId);if(d)d.balance+=+x.amount||0}restoreReservationUse(x.reservationUse)}for(const x of (S.expenses||[]).filter(x=>x.imported))restoreReservationUse(x.reservationUse);S.incomeLogs=(S.incomeLogs||[]).filter(x=>!x.imported);S.expenses=(S.expenses||[]).filter(x=>!x.imported);S.payments=(S.payments||[]).filter(x=>!x.imported);S.bankTransfers=(S.bankTransfers||[]).filter(x=>!x.imported);S.assetTransfers=(S.assetTransfers||[]).filter(x=>!x.imported);S.cashAdjustments=(S.cashAdjustments||[]).filter(x=>!x.importBatchId);S.importBatches=[];S.bankImportIds=[];S.screenshotImportIds=[];audit("Импортированные операции очищены","finance","");await save("Импортированные операции удалены • предыдущее состояние сохранено в снимках")}

let smartInboxProposals=[];

let aiImportQueue=[];

function renderImportBatches(){const box=$("importBatchHistory");if(!box)return;box.innerHTML=(S.importBatches||[]).slice(0,8).map(b=>{const legacy=b.source==="statement"&&!b.preSnapshotTs;return `<div class="log-item"><div class="qtitle">${new Date(b.date).toLocaleString("ru-RU")} • ${escapeHtml(b.source)}</div><div class="qmeta">${b.count} операций${legacy?' • <span class="csv-warn">legacy 7.0.x: полного снимка до импорта нет</span>':''}</div>${legacy?'<div class="status">Для этого старого пакета полный откат через интерфейс заблокирован. Используй резервную копию.</div>':`<button class="btn ghost small" onclick="rollbackImportBatch('${b.id}')">Откатить пакет</button>`}</div>`}).join("")||'<div class="empty">Подтверждённых импортов пока нет.</div>'}

function parseMoneyNear(text,labelRe){const re=new RegExp(`(?:${labelRe})[^\\d]{0,45}([0-9][0-9 \\u00A0]*(?:[.,][0-9]{1,2})?)\\s*(?:₽|руб|р\\b)?`,"i"),m=String(text||"").match(re);return m?parseOcrAmount(m[1]):null}

function matchDebtFromText(text){const s=String(text||"").toLowerCase().replace(/ё/g,"е"),debts=(S.debts||[]).filter(d=>d.balance>0);let candidates=debts;if(/райфф/.test(s))candidates=debts.filter(d=>/райфф/i.test(d.name));else if(/альфа/.test(s))candidates=debts.filter(d=>/альфа/i.test(d.name));else if(/т.?банк|тинькофф|платинум/.test(s)){candidates=debts.filter(d=>/т.?банк|тинькофф/i.test(d.name));if(/платинум|кредитн.*карт/.test(s))candidates=candidates.filter(d=>/платин|карт/i.test(d.name)||d.type==="Кредитная карта");else if(/кредит(?!н.*карт)/.test(s))candidates=candidates.filter(d=>d.type==="Кредит")}return candidates.length===1?candidates[0]:null}

function extractDebtSnapshot(text){const debt=matchDebtFromText(text),balance=parseMoneyNear(text,"общ(?:ая|ий)\\s+задолженность|задолженность|долг\\s+на"),minWith=parseMoneyNear(text,"минимальн(?:ый|ого)\\s+платеж\\s+с\\s+рассрочк\\w*"),minPay=minWith??parseMoneyNear(text,"минимальн(?:ый|ого)\\s+платеж"),limit=parseMoneyNear(text,"кредитн(?:ый|ого)\\s+лимит"),rateMatch=String(text||"").match(/(\d{1,2}(?:[.,]\d{1,3})?)\s*%\s*(?:годовых)?/i),rate=rateMatch?Number(rateMatch[1].replace(",",".")):null;let date="";const dm=String(text||"").match(/(?:до|оплатить\s+до)\s*(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?/i);if(dm){let y=dm[3]?Number(dm[3]):new Date().getFullYear();if(y<100)y+=2000;date=`${y}-${String(dm[2]).padStart(2,"0")}-${String(dm[1]).padStart(2,"0")}`}return {debtId:debt?.id||"",debtName:debt?.name||"",balance,minPay,limit,rate,date}}

function extractAssetSnapshot(text){const s=String(text||"");let name="";if(/инвесткопил/i.test(s))name="Инвесткопилка";else if(/брокерск/i.test(s))name="Брокерский счёт";if(!name)return null;let amount=parseMoneyNear(s,name==="Инвесткопилка"?"инвесткопилк\\w*":"брокерск\\w*\\s+счет");if(amount==null){const m=s.match(/(?:^|\n)\s*([0-9][0-9 \\u00A0]*(?:[.,]\d{1,2})?)\s*₽/m);amount=m?parseOcrAmount(m[1]):null}return amount!=null?{name,amount}:null}

async function applySmartProposal(id){const p=smartInboxProposals.find(x=>x.id===id);if(!p)return;if(p.kind==="balance"){const a=S.accounts.find(x=>x.id===p.accountId);bankSyncSession={accountId:p.accountId,bankBalance:p.amount,balanceConfidence:p.confidence||.8,balanceLabel:p.label||"Баланс",balanceSource:p.file,baseExpected:accountBalanceById(p.accountId),wasVerified:!!a?.verifiedAt,importedNet:0,detectedAt:new Date().toISOString(),lastText:""};renderBankSync();document.getElementById("bankSyncCard")?.scrollIntoView({behavior:"smooth"});toast("Баланс передан в сверку");return}if(p.kind==="debt"){const d=debtById(p.debtId);if(!d)return;if(!confirm(`Применить распознанные данные к «${d.name}»?`))return;if(p.balance!=null){d.balance=p.balance;d.balanceVerifiedAt=new Date().toISOString();}if(p.minPay!=null){d.nextPaymentAmount=p.minPay;d.min=p.minPay}if(p.date)d.nextPaymentDate=p.date;if(p.limit!=null)d.limit=p.limit;if(p.rate!=null){d.rate=p.rate;d.rateKnown=true}audit("Обновление долга по скриншоту","debt",d.name);await save("Долг обновлён");return}if(p.kind==="asset"){let a=(S.assets||[]).find(x=>x.name.toLowerCase()===p.name.toLowerCase());if(!a){a={id:uid(),name:p.name,type:"Инвестиции",verifiedValue:0,verifiedAt:"",liquid:true,available:false,active:true};S.assets.push(a)}a.verifiedValue=p.amount;a.verifiedAt=new Date().toISOString();audit("Сверка актива по скриншоту","asset",`${a.name}: ${rub(p.amount)}`);await save("Актив обновлён")}}

async function acceptDetectedBankBalance(reason="initial"){if(bankSyncSession.bankBalance==null){toast("Сначала распознай баланс со скриншота");return}const a=bankSyncAccount();if(!a)return;const before=accountBalanceById(a.id),p=bankSyncProjection();a.verifiedBalance=bankSyncSession.bankBalance;a.verifiedAt=new Date().toISOString();if(a.id===defaultAccountId())S.settings.cashBalanceVerifiedAt=a.verifiedAt;S.reconciliationSessions=S.reconciliationSessions||[];S.reconciliationSessions.unshift({id:uid(),date:a.verifiedAt,accountId:a.id,bankBalance:a.verifiedBalance,expectedBefore:before,residualBefore:p.residual,reason,source:bankSyncSession.balanceSource||""});audit(reason==="initial"?"Первичная сверка по скриншоту":"Сверка по скриншоту","account",`${a.name}: ${rub(a.verifiedBalance)}`);bankSyncSession.wasVerified=true;bankSyncSession.baseExpected=a.verifiedBalance;bankSyncSession.importedNet=0;await persist(true);render();renderBankSync();toast("Баланс счёта подтверждён")}

function buildAiContext(){return {format:"life-rpg-context-v1",appVersion:APP_VERSION,stateVersion:S.version,generatedAt:new Date().toISOString(),forecastSettings:{primaryAccount:accountName(defaultAccountId()),dailySpendLimit:+S.settings.dailySpendLimit||0,minimumCashFloor:+S.settings.minimumCashFloor||0,monthlyDebtGoal:+S.settings.monthlyDebtGoal||0,emergencyFundBalance:+S.settings.emergencyFundBalance||0,liquidityTargetDays:+S.settings.liquidityTargetDays||14,envelopeLimits:{...(S.envelopeLimits||{})}},accounts:activeAccounts().map(a=>({name:a.name,type:a.type,balance:accountBalanceById(a.id),verifiedAt:a.verifiedAt||"",primary:a.id===defaultAccountId()})),assets:(S.assets||[]).filter(a=>a.active!==false).map(a=>({name:a.name,type:a.type,value:assetValueById(a.id),liquid:a.liquid,available:a.available,verifiedAt:a.verifiedAt||""})),debts:(S.debts||[]).filter(d=>d.active!==false).map(d=>({name:d.name,type:d.type,balance:d.balance,rate:d.rate,rateKnown:d.rateKnown!==false,basePayment:d.min,nextPaymentAmount:d.nextPaymentAmount||0,nextPaymentDate:d.nextPaymentDate||"",paymentMode:d.paymentMode,limit:d.limit||0})),incomeSchedule:(S.settings.incomeEvents||[]).map(x=>({day:x.day,label:x.label,amount:x.amount})),regularPayments:(S.regularPayments||[]).filter(x=>x.active!==false).map(x=>({name:x.name,amount:x.amount,dueDay:x.dueDay,category:x.category,mandatory:x.mandatory!==false})),recentTransactions:unifiedTransactions().slice(0,80).map(x=>({date:x.dateKey,type:x.kind,title:x.title,category:x.category,account:x.account,amount:x.amount,note:x.note})),importRules:(S.importRules||[]).filter(x=>x.active!==false).map(x=>({keyword:x.keyword,type:x.type,category:x.category||""})),netWorth:netWorth()}}

function downloadJson(obj,name){const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

function exportAiContext(){downloadJson(buildAiContext(),`life-rpg-context-${localDateKey()}.json`);audit("Экспорт AI-контекста","ai","без идентификаторов банковских договоров")}

function findAccountByName(name){const s=String(name||"").toLowerCase();return activeAccounts().find(a=>a.name.toLowerCase()===s||a.name.toLowerCase().includes(s)||s.includes(a.name.toLowerCase()))}

function findDebtByName(name){const s=String(name||"").toLowerCase();return S.debts.find(d=>d.name.toLowerCase()===s||d.name.toLowerCase().includes(s)||s.includes(d.name.toLowerCase()))}

function matchDebtPaymentCandidate(desc,amount=0){const s=String(desc||"").toLowerCase().replace(/ё/g,"е"),open=(S.debts||[]).filter(d=>d.balance>0);let c=open;if(/платинум|platinum/.test(s))c=open.filter(d=>/платин/i.test(d.name));else if(/райфф/.test(s))c=open.filter(d=>/райфф/i.test(d.name));else if(/альфа/.test(s))c=open.filter(d=>/альфа/i.test(d.name));else if(/т.?банк|тинькофф/.test(s)&&/кредит/.test(s))c=open.filter(d=>/т.?банк|тинькофф/i.test(d.name));if(c.length===1)return c[0];if(amount>0){const ranked=open.map(d=>({d,delta:Math.min(Math.abs((+d.nextPaymentAmount||0)-amount),Math.abs((+d.min||0)-amount))})).sort((a,b)=>a.delta-b.delta);if(ranked[0]&&ranked[0].delta<=Math.max(10,amount*.03)&&(ranked.length<2||ranked[1].delta>ranked[0].delta+1))return ranked[0].d}return null}

function refineFinancialCandidate(c){const s=String(c.desc||"").toLowerCase().replace(/ё/g,"е");if(/досрочн.*погашен|погашен.*кредит|плат[её]ж.*(?:по\s+)?кредит/.test(s)){const d=matchDebtPaymentCandidate(c.desc,c.amount);return {...c,type:"debt_payment",suggestedType:"debt_payment",debtId:d?.id||"",confidence:Math.max(c.confidence||0,.86)}}if(/инвесткопил|брокерск.*счет|брокерск.*счёт/.test(s)){const a=matchAssetByDescription(c.desc);return {...c,type:"asset_transfer",suggestedType:"asset_transfer",assetId:a?.id||"",confidence:Math.max(c.confidence||0,.86)}}return c}

function screenshotTypeOptions(v){return [["expense","Расход"],["income","Доход"],["transfer","Между своими счетами"],["asset_transfer","Перевод актив ↔ счёт"],["debt_payment","Платёж по долгу"],["ignore","Не импортировать"]].map(([x,t])=>`<option value="${x}" ${x===v?"selected":""}>${t}</option>`).join("")}

function candidateSyncEffect(c){const a=Math.max(0,+c.amount||0);if(c.type==="income")return a;if(c.type==="expense"||c.type==="debt_payment")return -a;if(c.type==="asset_transfer"||c.type==="transfer")return c.ocrSign==="+"?a:(c.ocrSign==="-"?-a:0);return 0}

function debtCandidateOptions(selected=""){return '<option value="">Не сопоставлено</option>'+(S.debts||[]).filter(d=>d.balance>0).map(d=>`<option value="${escapeHtml(d.id)}" ${d.id===selected?"selected":""}>${escapeHtml(d.name)}</option>`).join("")}

function assetCandidateOptions(selected=""){return '<option value="">Не сопоставлено</option>'+(S.assets||[]).filter(a=>a.active!==false).map(a=>`<option value="${escapeHtml(a.id)}" ${a.id===selected?"selected":""}>${escapeHtml(a.name)}</option>`).join("")}

function paymentIsBeforeDebtBaseline(d,dateKey,occurredAt=""){const t=Date.parse(d?.balanceVerifiedAt||"");if(!t)return false;const et=occurredAt?Date.parse(occurredAt):Date.parse(`${dateKey}T23:59:59`);return Number.isFinite(et)&&et<=t}

async function applyImportedCandidates(candidates,source="import"){const batchId=uid(),seen=new Map(),added={income:0,expense:0,transfer:0,debtPayment:0,ignored:0,dupes:0},created=[];let historicalNet=0;for(const c0 of candidates){if(c0.include===false||c0.type==="ignore"){added.ignored++;continue}const c=refineFinancialCandidate({...c0}),amount=Math.max(0,+c.amount||0),dateKey=parseCsvDate(c.dateKey)||c.dateKey;if(!amount||!/^\d{4}-\d{2}-\d{2}$/.test(dateKey))continue;const desc=String(c.desc||source).trim(),type=["income","expense","transfer","asset_transfer","debt_payment"].includes(c.type)?c.type:"expense",base=`${dateKey}|${amount}|${type}|${desc}`,n=(seen.get(base)||0)+1;seen.set(base,n);const fp=importFingerprint(dateKey,amount,type,desc,n);if(S.bankImportIds.includes(fp)){added.dupes++;continue}S.bankImportIds.push(fp);const historical=importIsHistorical(dateKey,c.occurredAt||""),eventDate=c.occurredAt||`${dateKey}T12:00:00`,accountId=c.accountId||defaultAccountId();if(type==="income"){const link=matchPlannedIncome(dateKey,amount,desc),x={id:uid(),dateKey,date:eventDate,amount,accountId,source:source==="screenshot"?"Импорт скриншота":"Импорт CSV",note:desc,plannedEventId:link?.eventId||"",plannedMonth:link?.monthKey||"",imported:source,fp,importBatchId:batchId,importCashContribution:historical?amount:0,importKind:"income"};S.incomeLogs.unshift(x);if(historical)historicalNet+=amount;created.push(x);added.income++}else if(type==="expense"){const r=matchRegularPayment(desc,amount,dateKey),reservationUse=r?consumeReservation("mandatory",amount,null,r.id):consumeReservation("living",amount),x={id:uid(),dateKey,date:eventDate,amount,accountId,category:c.category||classifyImportedExpense(desc),note:desc,regularPaymentId:r?.id||"",reservationUse,imported:source,fp,importBatchId:batchId,importCashContribution:historical?-amount:0,importKind:"expense"};S.expenses.unshift(x);if(historical)historicalNet-=amount;created.push(x);added.expense++}else if(type==="debt_payment"){const d=debtById(c.debtId)||matchDebtPaymentCandidate(desc,amount),historicalDebt=d?paymentIsBeforeDebtBaseline(d,dateKey,c.occurredAt||""):true,affectsBalance=!!d&&!historicalDebt,idx=d?S.debts.findIndex(z=>z.id===d.id):-1,before=d?.balance||0,actual=d?Math.min(amount,d.balance):amount;if(affectsBalance)d.balance=Math.max(0,d.balance-actual);const reservationUse=d?consumeReservation("debt",actual,idx):[],x={id:uid(),debtIndex:idx,debtId:d?.id||"",debt:d?.name||"Не сопоставленный долг",amount:actual,before,after:affectsBalance?d.balance:before,date:eventDate,localDate:dateKey,monthKey:dateKey.slice(0,7),accountId,reservationUse,imported:source,fp,importBatchId:batchId,importKind:"debt_payment",historicalOnly:!affectsBalance};S.payments.push(x);if(historical)historicalNet-=actual;created.push(x);added.debtPayment++}else if(type==="asset_transfer"){const asset=(S.assets||[]).find(a=>a.id===c.assetId)||matchAssetByDescription(desc);if(asset){const direction=c.ocrSign==="+"?"fromAsset":"toAsset",x={id:uid(),dateKey,date:eventDate,amount,accountId,assetId:asset.id,direction,note:desc,imported:source,fp,importBatchId:batchId,importKind:"asset_transfer"};S.assetTransfers.unshift(x);created.push(x);added.transfer++}else{const x={id:uid(),dateKey,date:eventDate,amount,fromAccountId:c.fromAccountId||"",toAccountId:c.toAccountId||"",syncAccountId:accountId,syncEffect:candidateSyncEffect(c),note:desc,imported:source,fp,importBatchId:batchId,importKind:"transfer"};S.bankTransfers.unshift(x);created.push(x);added.transfer++}}else{const asset=matchAssetByDescription(desc);if(asset){const direction=c.ocrSign==="+"?"fromAsset":"toAsset",x={id:uid(),dateKey,date:eventDate,amount,accountId,assetId:asset.id,direction,note:desc,imported:source,fp,importBatchId:batchId,importKind:"asset_transfer"};S.assetTransfers.unshift(x);created.push(x);added.transfer++}else{const x={id:uid(),dateKey,date:eventDate,amount,fromAccountId:c.fromAccountId||"",toAccountId:c.toAccountId||"",syncAccountId:accountId,syncEffect:candidateSyncEffect(c),note:desc,imported:source,fp,importBatchId:batchId,importKind:"transfer"};S.bankTransfers.unshift(x);created.push(x);added.transfer++}}if(source==="screenshot"&&S.settings.learnImportRules!==false&&["income","expense","transfer"].includes(type)&&(c.type!==c.suggestedType||c.category!==c.suggestedCategory)){const keyword=ruleKeyword(desc);if(keyword){const old=S.importRules.find(r=>r.keyword===keyword),rule={id:old?.id||uid(),keyword,type,category:type==="expense"?(c.category||""):"",active:true};if(old)Object.assign(old,rule);else S.importRules.push(rule)}}}if(!accountsModeActive()&&Math.abs(historicalNet)>.005)S.cashAdjustments.push({id:uid(),date:new Date().toISOString(),dateKey:localDateKey(),delta:-historicalNet,note:"Компенсация исторического импорта после сверки",importBatchId:batchId});S.importBatches=S.importBatches||[];if(created.length)S.importBatches.unshift({id:batchId,date:new Date().toISOString(),source,count:created.length,items:created.map(x=>({id:x.id,kind:x.importKind,fp:x.fp||"",historicalOnly:!!x.historicalOnly}))});audit("Импорт операций","finance",`доход ${added.income}, расход ${added.expense}, платежи долгов ${added.debtPayment}, переводы ${added.transfer}`);return {...added,batchId,created}}

function importedResultNet(result,accountId){return (result?.created||[]).reduce((ss,x)=>{if(x.importKind==="income"&&(x.accountId||defaultAccountId())===accountId)return ss+(+x.amount||0);if(x.importKind==="expense"&&(x.accountId||defaultAccountId())===accountId)return ss-(+x.amount||0);if(x.importKind==="debt_payment"&&(x.accountId||defaultAccountId())===accountId)return ss-(+x.amount||0);if(x.importKind==="transfer"&&x.syncAccountId===accountId)return ss+(+x.syncEffect||0);if(x.importKind==="asset_transfer"&&x.accountId===accountId)return ss+(x.direction==="fromAsset"?(+x.amount||0):-(+x.amount||0));return ss},0)}

async function confirmScreenshotImport(){const selected=screenshotImportQueue.filter(x=>x.include!==false&&x.type!=="ignore"&&x.amount>0);if(!selected.length){toast("Нет выбранных операций");return}const syncId=selectedBankSyncAccountId(),hadSync=bankSyncSession.bankBalance!=null&&bankSyncSession.accountId===syncId,result=await applyImportedCandidates(selected,"screenshot");if(hadSync)bankSyncSession.importedNet+=importedResultNet(result,syncId);screenshotImportQueue=[];await persist();renderScreenshotQueue();render();$("screenshotImportStatus").innerHTML=`Импортировано: доходов ${result.income}, расходов ${result.expense}, платежей по долгам ${result.debtPayment}, переводов ${result.transfer}${result.dupes?` • дублей ${result.dupes}`:""}`;if(hadSync){const p=bankSyncProjection();if(Math.abs(p.residual)<=bankSyncTolerance())await acceptDetectedBankBalance("reconciled");else renderBankSync()}if(S.settings.autoReserveAfterImport&&S.settings.cashBalanceVerifiedAt)await acceptAutopilotPlan()}

function restoreUniqueRecords(key,rows){if(!Array.isArray(rows)||!rows.length)return;const arr=S[key]||=[],ids=new Set(arr.map(x=>x.id));for(const x of rows)if(!ids.has(x.id)){arr.push(deepClone(x));ids.add(x.id)}S[key]=arr}

function restoreStatementCleanupUndo(undo){if(!undo)return;for(const key of ["incomeLogs","expenses","bankTransfers","assetTransfers","payments"])restoreUniqueRecords(key,undo[key]);for(const x of undo.expenses||[])reapplyReservationUse(x.reservationUse);for(const x of undo.payments||[])reapplyReservationUse(x.reservationUse);const fps=new Set(S.bankImportIds||[]);for(const fp of undo.bankImportIds||[])fps.add(fp);S.bankImportIds=[...fps];for(const old of undo.importBatches||[]){const i=(S.importBatches||[]).findIndex(x=>x.id===old.id);if(i>=0)S.importBatches[i]=deepClone(old);else S.importBatches.push(deepClone(old))}restoreUniqueRecords("cashAdjustments",undo.cashAdjustments)}

async function rollbackImportBatch(id){const b=(S.importBatches||[]).find(x=>x.id===id);if(!b){toast("Пакет не найден");return}if(b.source==="statement"&&!b.preSnapshotTs&&!b.cleanupUndo){toast("Старый statement-пакет не имеет безопасных данных для полного отката. Используй резервную копию.");return}const lockedPayments=(b.items||[]).filter(it=>it.kind==="debt_payment").map(it=>S.payments.find(x=>x.id===it.id)).filter(x=>x&&!x.historicalOnly&&paymentLockedBySync(x));if(lockedPayments.length){toast("Нельзя откатить пакет: платёж по долгу уже зафиксирован более поздней банковской сверкой");return}if(!confirm(`Отменить импорт из ${b.count} операций? Изменения, сделанные после импорта, будут сохранены.`))return;await createPreActionSnapshot(`Перед откатом импорта ${b.packageId||b.id}`);for(const it of b.items||[]){if(it.kind==="income")S.incomeLogs=S.incomeLogs.filter(x=>x.id!==it.id);else if(it.kind==="expense"){const x=S.expenses.find(z=>z.id===it.id);if(x)restoreReservationUse(x.reservationUse);S.expenses=S.expenses.filter(x=>x.id!==it.id)}else if(it.kind==="debt_payment"){const x=S.payments.find(z=>z.id===it.id);if(x&&!x.historicalOnly){const d=debtById(x.debtId);if(d)d.balance+=+x.amount||0}if(x)restoreReservationUse(x.reservationUse);S.payments=S.payments.filter(x=>x.id!==it.id)}else if(it.kind==="transfer")S.bankTransfers=S.bankTransfers.filter(x=>x.id!==it.id);else if(it.kind==="asset_transfer")S.assetTransfers=S.assetTransfers.filter(x=>x.id!==it.id);if(it.fp)S.bankImportIds=S.bankImportIds.filter(x=>x!==it.fp)}if(b.accountId&&b.accountBefore){const a=S.accounts.find(x=>x.id===b.accountId);const sameAnchor=!b.accountAfter||!a||String(a.verifiedAt||"")===String(b.accountAfter.verifiedAt||"");if(a&&sameAnchor){a.verifiedBalance=b.accountBefore.verifiedBalance;a.verifiedAt=b.accountBefore.verifiedAt||"";if(b.settingsBefore){S.settings.primaryAccountId=b.settingsBefore.primaryAccountId||S.settings.primaryAccountId;S.settings.cashBalanceVerifiedAt=b.settingsBefore.cashBalanceVerifiedAt||""}}}restoreStatementCleanupUndo(b.cleanupUndo);S.cashAdjustments=S.cashAdjustments.filter(x=>x.importBatchId!==id);S.importBatches=S.importBatches.filter(x=>x.id!==id);audit("Откат импорта","finance",`${b.count} операций • безопасный обратный откат`);await save("Импорт отменён • последующие изменения сохранены")}

function classifyImportedExpense(desc){const s=String(desc||"").toLowerCase().replace(/ё/g,"е"),rule=(S.importRules||[]).find(r=>r.active!==false&&r.type!=="income"&&String(r.keyword||"").trim()&&s.includes(String(r.keyword).toLowerCase()));if(rule?.category)return rule.category;if(/газпромнефт|лукойл|такси|yandex\s*(?:go|taxi)|яндекс\s*(?:go|такси)|метро|автобус|транспорт|парков/.test(s))return"Транспорт";if(/пятер|магнит|монетк|верный|перекрест|перекрёст|вкусно|kfc|simple\s*coffee|кафе|ресторан|фастфуд|столов|еда|продукт|сиба[-_ ]?(?:кафе|вендинг)|чайхана/.test(s))return"Еда";if(/t2\b|tele2|мобил|интернет|телефон|связ/.test(s))return"Связь";if(/rustt|настольн.*теннис|теннис|спорттовар/.test(s))return"Теннис";if(/37games|digital\s*market|игр[аы]|steam|playstation|xbox/.test(s))return"Развлечения";if(/ozon|wildberries|\bwb\b|market|маркет|аптек|фармленд/.test(s))return"Покупки";return"Другое"}

let ocrHotfixDebugRuns=[];

function normalizeOcrFinancialText(text){
  return String(text||"")
    .replace(/\r/g,"")
    .replace(/[\u2212\u2012\u2013\u2014]/g,"-")
    .replace(/\u00A0/g," ")
    .replace(/([+\-]?\s*\d[\d .,]{0,18})\s*[PРBВ](?=\s|$|[•·])/gi,"$1 ₽")
    .replace(/([+\-]?\s*\d[\d .,]{0,18})\s*(?:руб(?:\.|ля|лей)?|р\.)(?=\s|$|[•·])/gi,"$1 ₽");
}

function isOcrDateHeaderLine(line){
  const s=String(line||"").trim().toLowerCase().replace(/ё/g,"е");
  if(!s)return false;
  if(/^(?:сегодня|вчера|позавчера)(?:\s|$)/.test(s))return true;
  return /^\d{1,2}\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)/i.test(s);
}

function parseRelaxedOcrMoney(rawToken){
  const original=String(rawToken||"").trim();
  const sign=(original.match(/[+\-−]/)||[""])[0].replace("−","-");
  let body=original.replace(/[+\-−]/g,"").replace(/(?:₽|руб(?:\.|ля|лей)?|р\.?|[PРBВ])\s*$/i,"").trim();
  body=body.replace(/\u00A0/g," ").replace(/(?<=\d)[oOоО](?=\d)/g,"0").replace(/(?<=\d)[lI|](?=\d)/g,"1");
  body=body.replace(/[^\d., ]/g,"").replace(/\s+/g," ").trim();
  if(!/\d/.test(body))return null;
  let needsReview=false, inferredDecimal=false, amount=NaN;
  const explicit=body.match(/^(.*?)[.,](\d{1,2})$/);
  if(explicit){
    const whole=explicit[1].replace(/[ .,]/g,"")||"0", cents=explicit[2].padEnd(2,"0");
    amount=Number(`${whole}.${cents}`);
  }else{
    const groups=body.split(" ").filter(Boolean);
    if(groups.length>1 && groups.slice(1).every(g=>/^\d{3}$/.test(g))){
      amount=Number(groups.join(""));
    }else if(groups.length>1 && /^\d{4,6}$/.test(groups.at(-1))){
      const digits=groups.join("");
      amount=Number(digits.slice(0,-2)+"."+digits.slice(-2));
      needsReview=true;inferredDecimal=true;
    }else{
      const digits=body.replace(/[ .,]/g,"");
      if(/^\d{5,7}$/.test(digits) && !digits.endsWith("00")){
        amount=Number(digits.slice(0,-2)+"."+digits.slice(-2));
        needsReview=true;inferredDecimal=true;
      }else amount=Number(digits);
    }
  }
  if(!Number.isFinite(amount)||amount<=0||amount>100000000)return null;
  return {amount,sign,needsReview,inferredDecimal,raw:original};
}

function relaxedMoneyMatches(line){
  const src=String(line||"").replace(/\u00A0/g," "),out=[];
  const currency=/([+\-−]\s*\d[\d .,]{0,18}?)\s*(₽|руб(?:\.|ля|лей)?|р\.?|[PРBВ])(?=\s|$|[•·])/ig;
  let m;
  while((m=currency.exec(src))){const p=parseRelaxedOcrMoney(m[0]);if(p)out.push({...p,currencySeen:true,index:m.index});}
  if(!out.length){
    const signed=/([+\-−]\s*(?:\d{1,3}(?:[ ]\d{3})+(?:[.,]\d{1,2})?|\d{1,7}(?:[.,]\d{1,2})?))(?=\s|$)/g;
    while((m=signed.exec(src))){const p=parseRelaxedOcrMoney(m[0]);if(p)out.push({...p,currencySeen:false,index:m.index});}
  }
  if(out.length>1 && /(?:дебетов|black\s*premium|мир\s*танков|карта)/i.test(src)){
    const meaningful=out.filter(x=>!(x.sign==="+"&&x.amount<=200&&!x.currencySeen));
    if(meaningful.length)return meaningful;
  }
  return out;
}

function financialTextScore(text){
  const raw=String(text||""),norm=normalizeOcrFinancialText(raw),lines=norm.split("\n");
  let signed=0,currency=0,keywords=0,dates=0;
  for(const line of lines){signed+=relaxedMoneyMatches(line).length;if(/[₽]|руб|\d\s*[PРBВ](?:\s|$)/i.test(line))currency++;if(isOcrDateHeaderLine(line))dates++;}
  const s=norm.toLowerCase().replace(/ё/g,"е");
  for(const re of [/операци/,/траты/,/доходы/,/перевод/,/пополн/,/магазин|кафе|ресторан|аптек|азс|супермаркет/,/кредит|задолжен/,/инвесткопил/])if(re.test(s))keywords++;
  return signed*4+currency+keywords*2+dates*2;
}

async function preprocessFinancialScreenshot(file){
  try{
    const bitmap=await createImageBitmap(file),maxW=1500,maxH=3000;
    let scale=Math.max(1,Math.min(2,1200/Math.max(1,bitmap.width)));
    if(bitmap.width*scale>maxW)scale=maxW/bitmap.width;if(bitmap.height*scale>maxH)scale=Math.min(scale,maxH/bitmap.height);
    const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale)),canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(bitmap,0,0,w,h);bitmap.close?.();
    const im=ctx.getImageData(0,0,w,h),d=im.data;let lumSum=0,samples=0,step=Math.max(4,Math.floor(Math.sqrt((w*h)/18000))*4);
    for(let i=0;i<d.length;i+=step){lumSum+=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];samples++;}
    const dark=(lumSum/Math.max(1,samples))<118;
    for(let i=0;i<d.length;i+=4){let y=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];if(dark)y=255-y;y=Math.max(0,Math.min(255,(y-128)*1.45+128));d[i]=d[i+1]=d[i+2]=y;d[i+3]=255;}
    ctx.putImageData(im,0,0);
    const blob=await new Promise(res=>canvas.toBlob(res,"image/png",.95));return {image:blob||file,dark,width:w,height:h};
  }catch(e){return {image:file,dark:false,width:0,height:0,error:String(e?.message||e)}}
}

async function runFinancialOcr(file,onProgress=()=>{}){
  const prepared=await preprocessFinancialScreenshot(file),primary=prepared.image||file;
  const rec=async(img,label)=>Tesseract.recognize(img,"rus+eng",{logger:m=>{if(m.status==="recognizing text")onProgress(Math.round((m.progress||0)*100),label)}});
  let r1=await rec(primary,prepared.image!==file?"контраст":"оригинал"),t1=r1?.data?.text||"",score1=financialTextScore(t1),best={text:t1,score:score1,mode:prepared.image!==file?"контраст":"оригинал",prepared};
  if(score1<18 && primary!==file){
    const r2=await rec(file,"оригинал"),t2=r2?.data?.text||"",score2=financialTextScore(t2);if(score2>best.score)best={text:t2,score:score2,mode:"оригинал",prepared};
  }
  return best;
}

function isOcrLoyaltyMetaLine(line){const ms=relaxedMoneyMatches(line);return ms.length>0&&ms.every(x=>x.sign==="+"&&x.amount<=200&&!x.currencySeen)&&/(?:дебетов|black\s*premium|мир\s*танков|карта)/i.test(String(line||""))}

function ocrContextLines(lines,index){
  const picked=[lines[index]];let meaningful=0;
  for(let j=index-1;j>=0&&index-j<=7;j--){if(isOcrDateHeaderLine(lines[j]))break;const ms=relaxedMoneyMatches(lines[j]);if(ms.length&&!isOcrLoyaltyMetaLine(lines[j]))break;if(isOcrLoyaltyMetaLine(lines[j]))continue;picked.unshift(lines[j]);meaningful++;if(meaningful>=2)break;}
  return picked;
}

function cleanOcrDescription(lines,index,rawAmount=""){
  const ctx=ocrContextLines(lines,index),moneyRx=/[+\-−]\s*\d[\d .,]{0,18}\s*(?:₽|руб(?:\.|ля|лей)?|р\.?|[PРBВ])?/ig;
  const cleaned=[];
  for(let x of ctx){
    x=String(x||"").replace(rawAmount,"").replace(moneyRx,"").replace(/\b(?:дебетовая\s+карта|black\s+premium|мир\s+танков)\b/ig,"").replace(/^\s*[+]?\d{1,3}\s*$/g,"").replace(/\s+/g," ").trim();
    if(!x||isOcrDateHeaderLine(x)||/^(?:траты|доходы|счета и карты|без переводов)$/i.test(x))continue;
    cleaned.push(x);
  }
  return [...new Set(cleaned)].join(" • ").slice(0,180)||"Операция со скриншота";
}

function detectImportedType(context,sign=""){
  const s=String(context||"").toLowerCase().replace(/ё/g,"е"),rule=(S.importRules||[]).find(r=>r.active!==false&&r.type&&String(r.keyword||"").trim()&&s.includes(String(r.keyword).toLowerCase()));
  if(rule?.type)return rule.type;
  if(/между своими|между собственными|свой счет|свой счёт|на свой|себе в другой банк|внутренн.*перевод|инвесткопил|брокерск.*счет|брокерск.*счёт/.test(s))return "transfer";
  if(/переводы|перевод на карту|перевод\s+(?:денежных\s+)?средств/.test(s)&&!/аванс|зарплат|преми|зачислен.*доход/.test(s))return "transfer";
  if(sign==="+"||/перевод\s+от(?:\s|$)|получен\w*\s+перевод|входящ\w*\s+перевод|зачисл|поступл|пополн|зарплат|аванс|преми|возврат|кэшбэк|cashback|входящ/.test(s))return "income";
  return "expense";
}

function extractScreenshotTransactions(text,meta={}){
  const rawText=normalizeOcrFinancialText(text),fallback=meta.dateKey||localDateKey(),lines=rawText.split("\n").map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean),out=[],occ=new Map();
  let currentDate=fallback;
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(isOcrDateHeaderLine(line)){currentDate=dateFromOcrText(line,fallback);continue;}
    const matches=relaxedMoneyMatches(line);if(!matches.length)continue;
    const contextLines=ocrContextLines(lines,i),context=contextLines.join(" ");
    if(/(?:баланс|остаток|доступно|кредитн.*лимит)/i.test(context)&&!/покупк|оплат|списан|зачисл|поступл|перевод|погашен|инвесткопил/i.test(context))continue;
    for(const m of matches){
      if(m.sign==="+"&&m.amount<=200&&!m.currencySeen&&/(?:дебетов|black\s*premium|карта)/i.test(context))continue;
      let dateKey=currentDate;if(hasExplicitOcrDate(context)&&!isOcrDateHeaderLine(line))dateKey=dateFromOcrText(context,currentDate);
      const time=timeFromOcrText(context),occurredAt=time?`${dateKey}T${time}:00`:"",desc=cleanOcrDescription(lines,i,m.raw),type=detectImportedType(context,m.sign),key=`${dateKey}|${m.amount}|${type}|${desc}`,n=(occ.get(key)||0)+1;occ.set(key,n);
      const explicit=/зачисл|поступл|пополн|покупк|оплат|списан|перевод|зарплат|аванс|преми|погашен|инвесткопил|супермаркет|ресторан|фастфуд|аптек|заправ/i.test(context),confidence=clamp(.52+(m.currencySeen?.15:0)+(m.sign?.1:0)+(explicit?.12:0)+(dateKey!==fallback?.06:0)-(m.needsReview?.25:0),0,.98);
      const candidate=refineFinancialCandidate({id:uid(),include:!m.needsReview,dateKey,occurredAt,amount:m.amount,type,suggestedType:type,category:type==="expense"?classifyImportedExpense(desc):"Другое",suggestedCategory:type==="expense"?classifyImportedExpense(desc):"Другое",accountId:meta.accountId||defaultAccountId(),ocrSign:m.sign,desc,confidence,needsReview:!!m.needsReview,amountInferred:!!m.inferredDecimal,rawAmount:m.raw,sourceName:meta.name||"скриншот",imageHash:meta.hash||"",fp:importFingerprint(dateKey,m.amount,type,desc,n)});
      out.push(candidate);
    }
  }
  return out.slice(0,60);
}

function classifyFinancialScreenshot(text){
  const norm=normalizeOcrFinancialText(text),s=norm.toLowerCase().replace(/ё/g,"е"),tx=extractScreenshotTransactions(norm,{dateKey:localDateKey()}),operationShell=/\bопераци[ияй]|счета и карты|без переводов|\bтраты\b.*\bдоходы\b|\bдоходы\b.*\bтраты\b/.test(s);
  if(operationShell||tx.length>=2)return "operations";
  if(/минимальн.*платеж|задолженность|кредитн.*лимит|процентн.*ставк/.test(s))return "debt";
  if(/инвесткопил|действующ.*стратег|фонд денежного рынка|брокерск.*счет/.test(s))return "asset";
  if(extractBankBalance(norm))return "balance";
  if(tx.length)return "operations";
  return "unknown";
}

function ocrMoneyDisplay(n){return Number(n||0).toLocaleString("ru-RU",{minimumFractionDigits:0,maximumFractionDigits:2})+" ₽"}

function ocrDebugHtml(){
  if(!ocrHotfixDebugRuns.length)return "";
  return `<details class="ocr-debug" style="margin-top:10px"><summary>OCR-диагностика (${ocrHotfixDebugRuns.length})</summary>${ocrHotfixDebugRuns.map(x=>`<div class="status" style="margin-top:8px"><b>${escapeHtml(x.file)}</b> • ${escapeHtml(x.mode)} • score ${x.score}<pre>${escapeHtml(String(x.text||"").slice(0,6500))}</pre></div>`).join("")}</details>`;
}

function renderSmartInbox(){
  const box=$("smartInboxResults");if(!box)return;
  const proposals=smartInboxProposals.length?smartInboxProposals.map(p=>{if(p.kind==="balance")return `<div class="smart-proposal"><div><b>Баланс • ${escapeHtml(p.file)}</b><div class="sub">${escapeHtml(accountName(p.accountId))}: ${rub(p.amount)} • уверенность ${Math.round((p.confidence||0)*100)}%</div></div><button class="btn secondary small" onclick="applySmartProposal('${p.id}')">Открыть сверку</button></div>`;if(p.kind==="debt")return `<div class="smart-proposal"><div><b>Долг • ${escapeHtml(p.debtName||"не удалось сопоставить")}</b><div class="sub">${p.balance!=null?`остаток ${rub(p.balance)} • `:""}${p.minPay!=null?`платёж ${rub(p.minPay)} • `:""}${p.date?`до ${fmtDate(parseLocal(p.date))} • `:""}${p.rate!=null?`${p.rate}%`:""}</div></div><button class="btn secondary small" onclick="applySmartProposal('${p.id}')" ${p.debtId?"":"disabled"}>Применить</button></div>`;if(p.kind==="asset")return `<div class="smart-proposal"><div><b>Актив • ${escapeHtml(p.name||"не распознан")}</b><div class="sub">${p.amount!=null?rub(p.amount):"сумма не найдена"}</div></div><button class="btn secondary small" onclick="applySmartProposal('${p.id}')" ${p.name&&p.amount!=null?"":"disabled"}>Применить</button></div>`;return `<div class="smart-proposal"><div><b>Не удалось определить • ${escapeHtml(p.file)}</b><div class="sub">Открой OCR-диагностику ниже: теперь сырой текст не теряется.</div></div></div>`}).join(""):"";
  box.innerHTML=proposals+ocrDebugHtml();
}

async function recognizeSmartInbox(files){
  const list=[...files].slice(0,20),status=$("smartInboxStatus");if(!list.length)return;if(!window.Tesseract){status.innerHTML='<span class="csv-bad">OCR-модуль не загрузился. Нужен интернет.</span>';return}
  smartInboxProposals=[];screenshotImportQueue=[];ocrHotfixDebugRuns=[];let operationCount=0,reviewCount=0;
  for(let i=0;i<list.length;i++){
    const file=list[i];status.textContent=`Разбор ${i+1}/${list.length}: ${file.name}`;
    try{
      const ocr=await runFinancialOcr(file,(p,mode)=>status.textContent=`${file.name}: ${p}% • ${mode}`),text=ocr.text||"",kind=classifyFinancialScreenshot(text),hash=await hashFile(file),dateKey=file.lastModified?localDateKey(new Date(file.lastModified)):localDateKey();ocrHotfixDebugRuns.push({file:file.name,text,mode:ocr.mode,score:ocr.score});
      if(kind==="operations"){
        const items=extractScreenshotTransactions(text,{name:file.name,hash,dateKey,accountId:$("smartInboxAccount")?.value||defaultAccountId()});screenshotImportQueue.push(...items);operationCount+=items.length;reviewCount+=items.filter(x=>x.needsReview).length;if(!items.length)smartInboxProposals.push({id:uid(),kind:"unknown",file:file.name});
      }else if(kind==="balance"){const b=extractBankBalance(text);if(b)smartInboxProposals.push({id:uid(),kind:"balance",file:file.name,amount:b.amount,label:b.label,accountId:$("smartInboxAccount")?.value||defaultAccountId(),confidence:b.confidence});}
      else if(kind==="debt")smartInboxProposals.push({id:uid(),kind:"debt",file:file.name,...extractDebtSnapshot(text)});
      else if(kind==="asset"){const a=extractAssetSnapshot(text);smartInboxProposals.push({id:uid(),kind:"asset",file:file.name,...(a||{})});}
      else smartInboxProposals.push({id:uid(),kind:"unknown",file:file.name});
    }catch(e){smartInboxProposals.push({id:uid(),kind:"unknown",file:file.name,error:String(e.message||e)});}
  }
  renderSmartInbox();renderScreenshotQueue();if(operationCount)$("screenshotImportStatus").innerHTML=`Из универсального входа найдено операций: <b>${operationCount}</b>${reviewCount?` • <span class="csv-warn">проверить суммы: ${reviewCount}</span>`:""}. Проверь строки перед импортом.`;
  status.innerHTML=`Разобрано файлов: <b>${list.length}</b>. Операций: <b>${operationCount}</b>, предложений: <b>${smartInboxProposals.length}</b>${reviewCount?` • требуют проверки: <b>${reviewCount}</b>`:""}.`;
}

async function recognizeBankScreenshots(files,accountId=defaultAccountId()){
  const list=[...files].slice(0,20);if(!list.length)return;if(!window.Tesseract){$("screenshotImportStatus").innerHTML='<span class="csv-bad">OCR-модуль не загрузился. Для распознавания нужен интернет.</span>';return}
  screenshotImportQueue=[];ocrHotfixDebugRuns=[];let done=0;
  for(const file of list){const hash=await hashFile(file);$("screenshotImportStatus").textContent=`OCR: ${done+1}/${list.length} • ${file.name}`;try{const ocr=await runFinancialOcr(file,(p,mode)=>$("screenshotImportStatus").textContent=`${file.name}: ${p}% • ${mode}`),dateKey=file.lastModified?localDateKey(new Date(file.lastModified)):localDateKey(),items=extractScreenshotTransactions(ocr.text||"",{name:file.name,hash,dateKey,accountId});ocrHotfixDebugRuns.push({file:file.name,text:ocr.text||"",mode:ocr.mode,score:ocr.score});screenshotImportQueue.push(...items)}catch(e){ocrHotfixDebugRuns.push({file:file.name,text:String(e.message||e),mode:"ошибка",score:0})}done++}
  renderScreenshotQueue();const found=screenshotImportQueue.filter(x=>x.amount>0),review=found.filter(x=>x.needsReview).length;$("screenshotImportStatus").innerHTML=found.length?`Найдено операций: <b>${found.length}</b>${review?` • <span class="csv-warn">проверь суммы: ${review}</span>`:""}. Перед импортом проверь дату, сумму и тип.`:`<span class="csv-warn">Операции не найдены автоматически.</span>${ocrDebugHtml()}`;
}

async function recognizeBankBalanceScreenshot(file){
  if(!file)return;if(!window.Tesseract){$("bankSyncStatus").innerHTML='<span class="csv-bad">OCR-модуль не загрузился. Нужен интернет.</span>';return}const id=selectedBankSyncAccountId(),a=S.accounts.find(x=>x.id===id);$("bankSyncStatus").textContent=`Распознаю баланс • ${file.name}`;try{const ocr=await runFinancialOcr(file,(p,mode)=>$("bankSyncStatus").textContent=`Баланс: ${p}% • ${mode}`),text=ocr.text||"",b=extractBankBalance(normalizeOcrFinancialText(text));ocrHotfixDebugRuns=[{file:file.name,text,mode:ocr.mode,score:ocr.score}];if(!b){$("bankSyncStatus").innerHTML='<span class="csv-warn">Не нашёл текущий баланс.</span>'+ocrDebugHtml();return}bankSyncSession={accountId:id,bankBalance:b.amount,balanceConfidence:b.confidence,balanceLabel:b.label,balanceSource:file.name,baseExpected:accountBalanceById(id),wasVerified:!!a?.verifiedAt,importedNet:0,detectedAt:new Date().toISOString(),lastText:text};screenshotImportQueue=[];renderScreenshotQueue();renderBankSync()}catch(e){$("bankSyncStatus").innerHTML=`<span class="csv-bad">Не удалось распознать баланс: ${escapeHtml(e.message||String(e))}</span>`}
}

function updateScreenshotCandidate(id,field,value){
  const x=screenshotImportQueue.find(z=>z.id===id);if(!x)return;
  if(field==="amount"){x.amount=Math.max(0,+value||0);x.needsReview=false;x.amountInferred=false;x.include=true;x.confidence=Math.max(x.confidence||0,.72)}
  else if(field==="include")x.include=!!value;else x[field]=value;
  if(field==="desc"||field==="amount"){const y=refineFinancialCandidate(x);Object.assign(x,y)}
  if(field==="type"&&value==="debt_payment"&&!x.debtId)x.debtId=matchDebtPaymentCandidate(x.desc,x.amount)?.id||"";
  if(field==="type"&&value==="asset_transfer"&&!x.assetId)x.assetId=matchAssetByDescription(x.desc)?.id||"";
  renderScreenshotQueue(false);renderBankSync();
}

function renderScreenshotQueue(){
  const box=$("screenshotImportQueue");if(!box)return;if(!screenshotImportQueue.length){box.innerHTML='<div class="empty">После распознавания здесь появятся найденные операции.</div>';return}
  const hi=screenshotImportQueue.filter(x=>x.confidence>=.82&&!x.needsReview).length,mid=screenshotImportQueue.filter(x=>x.confidence>=.65&&x.confidence<.82&&!x.needsReview).length,low=screenshotImportQueue.filter(x=>x.confidence<.65||x.needsReview).length;
  box.innerHTML=`<div class="status">Уверенность: высокая ${hi} • средняя ${mid} • проверить ${low}</div>`+screenshotImportQueue.map(x=>`<div class="ocr-row ${(x.confidence<.65||x.needsReview)?"ocr-low":""}"><label class="ocr-check"><input type="checkbox" ${x.include?"checked":""} onchange="updateScreenshotCandidate('${x.id}','include',this.checked)"></label><div class="ocr-fields"><div class="formgrid"><div class="field"><label>Дата</label><input type="date" value="${escapeHtml(x.dateKey)}" onchange="updateScreenshotCandidate('${x.id}','dateKey',this.value)"></div><div class="field"><label>Сумма, ₽</label><input type="number" min="0" step="0.01" value="${Number(x.amount||0)}" onchange="updateScreenshotCandidate('${x.id}','amount',this.value)"></div><div class="field"><label>Тип</label><select onchange="updateScreenshotCandidate('${x.id}','type',this.value)">${screenshotTypeOptions(x.type)}</select></div><div class="field"><label>Категория</label><select ${x.type!=="expense"?"disabled":""} onchange="updateScreenshotCandidate('${x.id}','category',this.value)">${screenshotCategoryOptions(x.category)}</select></div><div class="field"><label>Счёт</label><select onchange="updateScreenshotCandidate('${x.id}','accountId',this.value)">${accountOptions(x.accountId||defaultAccountId())}</select></div></div><div class="field" style="margin-top:8px"><label>Описание</label><input value="${escapeHtml(x.desc)}" onchange="updateScreenshotCandidate('${x.id}','desc',this.value)"></div>${x.needsReview?`<div class="notice" style="margin-top:8px">OCR потерял разделитель суммы. Предложено <b>${ocrMoneyDisplay(x.amount)}</b> из «${escapeHtml(x.rawAmount||"")}». Проверь сумму по скриншоту; строка пока не выбрана для импорта.</div>`:""}<div class="qmeta">уверенность OCR: ${Math.round((x.confidence||0)*100)}% • ${escapeHtml(x.sourceName||"")}${x.rawAmount?` • raw: ${escapeHtml(x.rawAmount)}`:""}</div><div class="split" style="margin-top:7px"><button class="btn ghost small" onclick="learnScreenshotRule('${x.id}')">Запомнить правило</button></div></div><button class="btn ghost small" onclick="removeScreenshotCandidate('${x.id}')">×</button></div>`).join("");
}

let statementImportPackage=null;

function statementTxDateKey(x){return validDateKey(x?.date)?x.date:parseCsvDate(x?.date||"")}

function statementTxOccurredAt(x){const d=statementTxDateKey(x);return x?.occurredAt||`${d}T12:00:00`}

function statementFp(pkg,x){const key=x.id||`${statementTxDateKey(x)}|${statementSigned(x)}|${x.description||x.reason||""}`;return `statement:${transactionFingerprint(statementTxDateKey(x),statementSigned(x),key,1)}`}

function statementAccount(name){const exact=findAccountByName(name);if(exact)return exact;const active=(S.accounts||[]).filter(a=>a.active!==false),verified=active.filter(a=>a.verifiedAt&&a.verifiedBalance!=null);if(verified.length===1)return verified[0];if(active.length===1)return active[0];return null}

function statementAsset(name){const q=String(name||"").toLowerCase();return (S.assets||[]).find(a=>a.active!==false&&(a.name.toLowerCase()===q||a.name.toLowerCase().includes(q)||q.includes(a.name.toLowerCase())))||null}

function statementDebt(name){return findDebtByName(name)||null}

function statementSigned(tx){const n=Number(tx?.signedAmount);if(Number.isFinite(n)&&n!==0)return n;const a=Math.max(0,+tx?.amount||0);return tx?.direction==="in"||tx?.direction==="fromAsset"?a:-a}

function statementImportedDate(x){return x?.dateKey||x?.localDate||String(x?.date||"").slice(0,10)}

function cleanupStatementPrerequisites(pkg){const c=pkg?.cleanup||{},sources=new Set(c.removeImportedSources||[]),from=String(c.dateFrom||""),undo={incomeLogs:[],expenses:[],bankTransfers:[],assetTransfers:[],payments:[],bankImportIds:[],importBatches:[],cashAdjustments:[]};if(!sources.size)return {count:0,undo};const removedIds=new Set(),removedFps=new Set();let count=0;const hit=x=>sources.has(x?.imported)&&(!from||statementImportedDate(x)>=from),track=(x,key)=>{count++;removedIds.add(x.id);undo[key].push(deepClone(x));if(x.fp)removedFps.add(x.fp)};S.incomeLogs=(S.incomeLogs||[]).filter(x=>{if(!hit(x))return true;track(x,"incomeLogs");return false});S.expenses=(S.expenses||[]).filter(x=>{if(!hit(x))return true;restoreReservationUse(x.reservationUse);track(x,"expenses");return false});S.bankTransfers=(S.bankTransfers||[]).filter(x=>{if(!hit(x))return true;track(x,"bankTransfers");return false});S.assetTransfers=(S.assetTransfers||[]).filter(x=>{if(!hit(x))return true;track(x,"assetTransfers");return false});S.payments=(S.payments||[]).filter(x=>{if(!x?.historicalOnly||!hit(x))return true;restoreReservationUse(x.reservationUse);track(x,"payments");return false});undo.bankImportIds=[...removedFps];if(removedFps.size)S.bankImportIds=(S.bankImportIds||[]).filter(x=>!removedFps.has(x));S.importBatches=(S.importBatches||[]).map(b=>{const items=(b.items||[]).filter(i=>!removedIds.has(i.id));if(items.length===(b.items||[]).length)return b;undo.importBatches.push(deepClone(b));return items.length?{...b,items,count:items.length}:null}).filter(Boolean);const affectedBatchIds=new Set(undo.importBatches.map(b=>b.id));S.cashAdjustments=(S.cashAdjustments||[]).filter(x=>{if(!affectedBatchIds.has(x.importBatchId))return true;undo.cashAdjustments.push(deepClone(x));return false});return {count,undo}}

function statementReviewStats(pkg){const tx=Array.isArray(pkg?.transactions)?pkg.transactions:[],uncertain=tx.filter(x=>x?.needsReview||String(x?.confidence||"").toLowerCase()==="medium"||String(x?.confidence||"").toLowerCase()==="low"||(typeof x?.confidence==="number"&&x.confidence<.82));return {total:tx.length,uncertain,needsReview:uncertain.length}}

function statementImportSummary(pkg){const s=pkg?.summary||{},k=s.countsByKind||{},period=pkg?.source||{},review=statementReviewStats(pkg),rows=review.uncertain.slice(0,50);return `<div class="notice"><b>${escapeHtml(pkg?.source?.bank||"Банк")} • ${escapeHtml(period.periodStart||"")} → ${escapeHtml(period.periodEnd||"")}</b><br>${Number(s.transactions||pkg?.transactions?.length||0).toLocaleString("ru-RU")} операций • входящие ${rub(s.incomingTotal||0)} • исходящие ${rub(s.outgoingTotal||0)}</div><div class="report-grid" style="margin-top:10px"><div class="report-item"><div class="smallcaps">Расходы</div><b>${k.expense||0}</b></div><div class="report-item"><div class="smallcaps">Доходы</div><b>${k.income||0}</b></div><div class="report-item"><div class="smallcaps">Переводы</div><b>${k.transfer||0}</b></div><div class="report-item"><div class="smallcaps">Активы</div><b>${k.asset_transfer||0}</b></div><div class="report-item"><div class="smallcaps">Платежи долгов</div><b>${k.debt_payment||0}</b></div><div class="report-item"><div class="smallcaps">Возвраты</div><b>${k.refund||0}</b></div></div>${review.needsReview?`<div class="notice" style="margin-top:10px"><b>Требуют проверки: ${review.needsReview}</b>. Показаны первые ${Math.min(50,review.needsReview)}.${rows.map(x=>`<div class="log-item"><div class="qtitle">${escapeHtml(statementTxDateKey(x)||"")} • ${rub(Math.abs(Number(x.amount)||statementSigned(x)))} • ${escapeHtml(x.kind||"?")}</div><div class="qmeta">${escapeHtml(x.description||x.reason||"")}</div></div>`).join("")}<label class="toggle-line" style="margin-top:10px"><input id="statementReviewAck" type="checkbox" onchange="$('aiApplyBtn').disabled=!this.checked"><span>Я просмотрел неоднозначные операции и подтверждаю импорт пакета.</span></label></div>`:""}<div class="status" style="margin-top:10px">Перед изменением базы будет создан отдельный снимок. Откат пакета удалит только изменения этого импорта и сохранит более поздние действия.</div>`}

async function handleAiImportFile(file){try{const obj=JSON.parse(await file.text());if(obj.format==="life-rpg-statement-import-v1"){if(!Array.isArray(obj.transactions)||!obj.transactions.length)throw new Error("В пакете выписки нет операций");statementImportPackage=obj;aiImportQueue=[];renderAiImportPreview();$("aiImportStatus").textContent=`Выписка готова: ${obj.transactions.length} операций`;const review=statementReviewStats(obj);$("aiApplyBtn").disabled=review.needsReview>0;$("aiApplyBtn").textContent=review.needsReview?`Проверить ${review.needsReview} и импортировать`:"Импортировать выписку";return}statementImportPackage=null;if(obj.format!=="life-rpg-ai-import-v1"||!Array.isArray(obj.actions))throw new Error("Неверный формат пакета");aiImportQueue=obj.actions.map((a,i)=>({id:a.id||`a${i+1}`,include:a.include!==false,...a}));renderAiImportPreview();$("aiImportStatus").textContent=`Загружено действий: ${aiImportQueue.length}`;$("aiApplyBtn").disabled=!aiImportQueue.length;$("aiApplyBtn").textContent="Применить подтверждённые действия"}catch(e){statementImportPackage=null;$("aiImportStatus").innerHTML=`<span class="csv-bad">${escapeHtml(e.message||String(e))}</span>`;aiImportQueue=[];renderAiImportPreview();$("aiApplyBtn").disabled=true;$("aiApplyBtn").textContent="Применить подтверждённые действия"}}

function renderAiImportPreview(){
  const box=$("aiImportPreview");if(!box)return;if(statementImportPackage){box.innerHTML=statementImportSummary(statementImportPackage);return}
  box.innerHTML=aiImportQueue.length?aiImportQueue.map(a=>`<label class="ai-action"><input type="checkbox" ${a.include!==false?"checked":""} onchange="aiImportQueue.find(x=>x.id==='${escapeHtml(a.id)}').include=this.checked"><span><b>${escapeHtml(a.type||"action")}</b> • ${escapeHtml(a.reason||a.note||a.name||"")}<br><small>${escapeHtml(JSON.stringify(Object.fromEntries(Object.entries(a).filter(([k])=>!["id","include","reason"].includes(k)))).slice(0,240))}</small></span></label>`).join(""):'<div class="empty">Нет действий для применения.</div>'
}

function statementIncomeLink(tx){if(tx?.plannedLabel){const label=String(tx.plannedLabel).toLowerCase(),ev=(S.settings.incomeEvents||[]).find(x=>String(x.label||"").toLowerCase()===label);if(ev)return {eventId:ev.id,monthKey:String(tx.date).slice(0,7)}}const dateKey=statementTxDateKey(tx),amount=Math.abs(Number(tx?.amount)||statementSigned(tx)),desc=`${tx?.source||""} ${tx?.reason||""} ${tx?.description||""}`;return dateKey&&amount?matchPlannedIncome(dateKey,amount,desc):null}

async function applyStatementImportPackage(pkg){if(!pkg||pkg.format!=="life-rpg-statement-import-v1")return;const old=(S.importBatches||[]).find(b=>b.packageId===pkg.packageId);if(old){toast("Эта выписка уже импортирована");return}const review=statementReviewStats(pkg);if(review.needsReview>0&&!$("statementReviewAck")?.checked){toast("Сначала проверь и подтверди неоднозначные операции");return}const account=statementAccount(pkg?.source?.sourceAccount||pkg?.balanceAnchor?.account);if(!account){toast("Не удалось однозначно определить счёт. Сначала создай/назови нужный счёт как в выписке.");return}if(!confirm(`Импортировать ${pkg.transactions.length} операций в «${account.name}»? Перед импортом будет создан страховочный снимок; обычный откат затронет только этот импорт.`))return;const before=deepClone(S),batchId=uid();let preSnapshotTs=0;try{preSnapshotTs=await createPreActionSnapshot(`До импорта выписки ${pkg.packageId||""}`);const cleanup=cleanupStatementPrerequisites(pkg),removed=cleanup.count,items=[];let added=0,dupes=0;for(const tx of pkg.transactions){const dateKey=statementTxDateKey(tx),amount=Math.abs(Number(tx.amount)||statementSigned(tx));if(!dateKey||!amount)continue;const fp=statementFp(pkg,tx);if((S.bankImportIds||[]).includes(fp)){dupes++;continue}S.bankImportIds.push(fp);const date=statementTxOccurredAt(tx),desc=String(tx.description||tx.reason||"Операция по выписке"),common={id:uid(),dateKey,date,accountId:account.id,imported:"statement",fp,importBatchId:batchId,statementId:tx.id||"",statementKind:tx.kind||""};let x=null;if(tx.kind==="income"){const link=statementIncomeLink(tx);x={...common,amount,source:tx.source||desc,note:desc,plannedEventId:link?.eventId||"",plannedMonth:link?.monthKey||"",importKind:"income"};S.incomeLogs.unshift(x)}else if(tx.kind==="expense"){x={...common,amount,category:tx.category||"Другое",note:desc,reservationUse:[],importKind:"expense"};S.expenses.unshift(x)}else if(tx.kind==="refund"){x={...common,amount:-amount,category:tx.category||"Другое",note:desc,isRefund:true,reservationUse:[],importKind:"expense"};S.expenses.unshift(x)}else if(tx.kind==="asset_transfer"){const asset=statementAsset(tx.asset);x={...common,amount,assetId:asset?.id||"",assetName:tx.asset||"Инвестиции",direction:tx.direction||(statementSigned(tx)>0?"fromAsset":"toAsset"),note:desc,importKind:"asset_transfer"};S.assetTransfers.unshift(x)}else if(tx.kind==="debt_payment"){const d=statementDebt(tx.debt);if(d){const di=S.debts.findIndex(z=>z.id===d.id);x={...common,localDate:dateKey,monthKey:dateKey.slice(0,7),debtIndex:di,debtId:d.id,debt:d.name,amount,xpAward:0,after:d.balance,reservationUse:[],historicalOnly:true,importKind:"debt_payment"};S.payments.push(x)}else{x={...common,amount,fromAccountId:account.id,toAccountId:"",syncAccountId:account.id,syncEffect:-amount,note:desc,importKind:"transfer"};S.bankTransfers.unshift(x)}}else{const signed=statementSigned(tx),incoming=signed>0;x={...common,amount,fromAccountId:incoming?"":account.id,toAccountId:incoming?account.id:"",syncAccountId:account.id,syncEffect:incoming?amount:-amount,note:desc,importKind:"transfer",transferClass:tx.kind||"transfer"};S.bankTransfers.unshift(x)}if(x){items.push({id:x.id,kind:x.importKind,fp,historicalOnly:!!x.historicalOnly});added++}}const anchor=pkg.balanceAnchor||{},prev=before.accounts?.find(a=>a.id===account.id),accountBefore={verifiedBalance:prev?.verifiedBalance??null,verifiedAt:prev?.verifiedAt||""},settingsBefore={primaryAccountId:before.settings?.primaryAccountId||"",cashBalanceVerifiedAt:before.settings?.cashBalanceVerifiedAt||""};if(Number.isFinite(Number(anchor.balance))){account.verifiedBalance=Math.max(0,Number(anchor.balance));account.verifiedAt=anchor.asOf||new Date().toISOString();S.settings.cashBalanceVerifiedAt=account.verifiedAt;S.settings.primaryAccountId=account.id}if(items.length||removed>0||Number.isFinite(Number(anchor.balance)))(S.importBatches||=[]).unshift({id:batchId,date:new Date().toISOString(),source:"statement",packageId:pkg.packageId||"",count:items.length,items,preSnapshotTs,accountId:account.id,accountBefore,accountAfter:{verifiedBalance:account.verifiedBalance,verifiedAt:account.verifiedAt||""},settingsBefore,cleanupUndo:cleanup.undo,cleanupRemovedCount:removed});audit("Импорт банковской выписки","finance",`${added} операций • удалено тестовых импортов ${removed}`);statementImportPackage=null;aiImportQueue=[];await persist();render();renderAiImportPreview();$("aiImportStatus").textContent=`Выписка импортирована: ${added} операций${dupes?` • дублей ${dupes}`:""}${removed?` • очищено тестовых ${removed}`:""}`;$("aiApplyBtn").disabled=true;$("aiApplyBtn").textContent="Применить подтверждённые действия";toast(`Импортировано ${added} операций`)}catch(e){S=before;await persist();render();throw e}}

async function applyAiImportQueue(){
  if(statementImportPackage)return applyStatementImportPackage(statementImportPackage);
  const list=aiImportQueue.filter(a=>a.include!==false);if(!list.length){toast("Нет выбранных действий");return}if(!confirm(`Применить ${list.length} действий из пакета ChatGPT?`))return;for(const a of list){const dateKey=validDateKey(a.date)?a.date:localDateKey(),date=`${dateKey}T12:00:00`;if(a.type==="income"){const acc=findAccountByName(a.account)?.id||defaultAccountId();S.incomeLogs.unshift({id:uid(),dateKey,date,amount:Math.max(0,+a.amount||0),accountId:acc,source:a.source||"Импорт ChatGPT",note:a.note||a.reason||"",imported:"ai"})}else if(a.type==="expense"){const acc=findAccountByName(a.account)?.id||defaultAccountId();S.expenses.unshift({id:uid(),dateKey,date,amount:Math.max(0,+a.amount||0),accountId:acc,category:a.category||"Другое",note:a.note||a.reason||"",imported:"ai",reservationUse:[]})}else if(a.type==="debt_update"){const d=findDebtByName(a.debt||a.name);if(d){for(const k of ["balance","rate","min","nextPaymentAmount","limit"])if(a[k]!=null)d[k]=Math.max(0,+a[k]||0);if(a.balance!=null)d.balanceVerifiedAt=new Date().toISOString();if(validDateKey(a.nextPaymentDate))d.nextPaymentDate=a.nextPaymentDate;if(a.rateKnown!=null)d.rateKnown=!!a.rateKnown}}else if(a.type==="asset_update"){let asset=(S.assets||[]).find(x=>x.name.toLowerCase()===String(a.name||"").toLowerCase());if(!asset){asset={id:uid(),name:a.name||"Актив",type:a.assetType||"Инвестиции",liquid:a.liquid!==false,available:!!a.available,active:true};S.assets.push(asset)}asset.verifiedValue=Math.max(0,+a.value||0);asset.verifiedAt=new Date().toISOString()}else if(a.type==="transfer"){const from=findAccountByName(a.from),to=findAccountByName(a.to),amount=Math.max(0,+a.amount||0);if(amount>0)S.bankTransfers.unshift({id:uid(),dateKey,date,amount,fromAccountId:from?.id||"",toAccountId:to?.id||"",syncAccountId:from?.id||to?.id||defaultAccountId(),syncEffect:from?-amount:to?amount:0,note:a.note||a.reason||"Перевод",imported:"ai"})}}audit("AI Bridge импорт","ai",`${list.length} действий`);aiImportQueue=[];await persist(true);render();renderAiImportPreview();$("aiImportStatus").textContent="Пакет применён";$("aiApplyBtn").disabled=true;toast("Действия применены")
}

function unifiedTransactions(){const arr=[];for(const x of S.incomeLogs||[])arr.push({kind:"income",id:x.id,date:x.date,dateKey:x.dateKey,amount:+x.amount||0,title:x.source||"Доход",note:x.note||"",account:accountName(x.accountId||defaultAccountId()),category:"Доход"});for(const x of S.expenses||[]){const refund=(+x.amount||0)<0;arr.push({kind:refund?"refund":"expense",id:x.id,date:x.date,dateKey:x.dateKey,amount:-(+x.amount||0),title:refund?`Возврат • ${x.note||x.category||"Расход"}`:(x.note||x.category||"Расход"),note:x.note||"",account:accountName(x.accountId||defaultAccountId()),category:x.category||"Другое"})}for(const x of S.payments||[])arr.push({kind:"payment",id:x.id,date:x.date,dateKey:x.localDate,amount:-(+x.amount||0),title:x.debt||"Платёж по долгу",note:x.historicalOnly?"исторический платёж • текущий остаток не изменён":"",account:accountName(x.accountId||defaultAccountId()),category:"Долг"});for(const x of S.bankTransfers||[]){const a=Number.isFinite(+x.syncEffect)?+x.syncEffect:(x.toAccountId?+x.amount||0:x.fromAccountId?-(+x.amount||0):0);arr.push({kind:"transfer",id:x.id,date:x.date,dateKey:x.dateKey,amount:a,title:x.note||"Перевод",note:`${x.fromAccountId?accountName(x.fromAccountId):"внешний источник"} → ${x.toAccountId?accountName(x.toAccountId):"внешний получатель"} • ${rub(x.amount)}`,account:x.syncAccountId?accountName(x.syncAccountId):"",category:"Перевод"})}for(const x of S.assetTransfers||[]){const a=x.direction==="fromAsset"?(+x.amount||0):-(+x.amount||0),asset=(S.assets||[]).find(z=>z.id===x.assetId)?.name||x.assetName||"Актив";arr.push({kind:"asset_transfer",id:x.id,date:x.date,dateKey:x.dateKey,amount:a,title:x.note||"Перевод в актив",note:`${x.direction==="toAsset"?"Счёт → ":"Актив → "}${asset} • ${rub(x.amount)}`,account:accountName(x.accountId||defaultAccountId()),category:"Актив"})}return arr.sort((a,b)=>(Date.parse(b.date)||Date.parse(`${b.dateKey}T12:00:00`))-(Date.parse(a.date)||Date.parse(`${a.dateKey}T12:00:00`)))}

function renderTransactionJournal(){const box=$("transactionJournal");if(!box)return;const q=String($("transactionSearch")?.value||"").toLowerCase(),type=$("transactionType")?.value||"all";const arr=unifiedTransactions().filter(x=>(type==="all"||x.kind===type||(type==="expense"&&x.kind==="refund"))&&(!q||`${x.title} ${x.note} ${x.account} ${x.category}`.toLowerCase().includes(q))).slice(0,50);box.innerHTML=arr.length?arr.map(x=>`<div class="transaction-row"><div><div class="qtitle">${fmtDate(parseLocal(x.dateKey))} • ${escapeHtml(x.title)}</div><div class="qmeta">${escapeHtml(x.category)}${x.account?` • ${escapeHtml(x.account)}`:""}${x.note?` • ${escapeHtml(x.note)}`:""}</div></div><b class="${x.amount>0?"income-good":x.amount<0?"income-bad":""}">${x.amount>0?"+":x.amount<0?"−":"↔"}${x.amount?rub(Math.abs(x.amount)):""}</b><button class="btn ghost small" onclick="deleteJournalTransaction('${x.kind}','${x.id}')">Удалить</button></div>`).join(""):'<div class="empty">Операции не найдены.</div>'}

async function deleteJournalTransaction(kind,id){if(kind==="income")return deleteIncome(id);if(kind==="expense"||kind==="refund")return deleteExpense(id);if(kind==="payment")return undoPayment(id);if(kind==="transfer")return deleteTransfer(id);if(kind==="asset_transfer"){S.assetTransfers=(S.assetTransfers||[]).filter(x=>x.id!==id);return save("Перевод актива удалён")}}
