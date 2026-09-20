"use strict";

/* Life RPG 8.0.3 — UI rendering and UX shell */

function toast(t){const x=$("toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),1800)}

let lastModalFocus=null;

function openModal(id){const m=$(id);if(!m)return;lastModalFocus=document.activeElement;m.classList.add("open");m.setAttribute("aria-hidden","false");setTimeout(()=>m.querySelector("input:not([type=hidden]),select,textarea,button")?.focus(),0)}

function closeModal(id){const m=$(id);if(!m)return;m.classList.remove("open");m.setAttribute("aria-hidden","true");lastModalFocus?.focus?.()}

function switchTab(id){document.querySelectorAll(".navbtn").forEach(x=>x.classList.toggle("active",x.dataset.tab===id));document.querySelectorAll(".section").forEach(s=>s.classList.toggle("active",s.id===id));window.scrollTo({top:0,behavior:"smooth"})}

function quickAction(type){if(type==="income"){switchTab("finance");openIncomeModal()}if(type==="payment"){switchTab("finance");openModal("paymentModal")}if(type==="expense"){openModal("expenseModal")}if(type==="work"){ux7Go("work","log");setTimeout(()=>$("workContacts")?.focus(),40)}if(type==="tennis"){ux7Go("tennis","training");setTimeout(()=>$("ttMinutes")?.focus(),40)}if(type==="reading"){switchTab("more");openModal("readingModal")}}

function render(){$("headerName").textContent=S.profile.name||"Павел";$("avatar").textContent=(S.profile.name||"P").trim().charAt(0).toUpperCase()||"P";renderToday();renderFinance();renderWork();renderTennis();renderMore();renderAccountSelects()}

function renderMore(){renderBooks();renderReadingDashboard();renderSkillTree();renderRewards();renderAchievements();renderSeasonHistory();renderMonthlyLifeReport();renderIncomeScheduleEditor();renderSnapshots();renderEmergencyFund();renderPersonalAnalytics();renderWeeklyReview();renderXpBreakdown();renderKnowledgeBase();renderAudit();renderSystemDiagnostics();$("profileName").value=S.profile.name||"";$("profileGoal").value=S.profile.goal||"";$("settingWorkPlan").value=S.settings.workMonthlyPlan;$("settingIncome").value=plannedIncomeForMonth();$("settingDebtGoal").value=S.settings.monthlyDebtGoal;$("settingDailySpend").value=S.settings.dailySpendLimit;if($("settingCashFloor"))$("settingCashFloor").value=S.settings.minimumCashFloor||0;if($("settingLiquidityDays"))$("settingLiquidityDays").value=S.settings.liquidityTargetDays||14;if($("settingTennisTarget"))$("settingTennisTarget").value=S.settings.tennisMonthlyTarget||12;if($("settingReadingMin"))$("settingReadingMin").value=S.settings.readingDailyMin||30;if($("settingTennisBaseElo"))$("settingTennisBaseElo").value=finiteNumberOr(S.settings.tennisBaseElo,1000);for(const [k,id,f] of [["contacts","settingWorkContacts",20],["followups","settingWorkFollowups",10],["lpr","settingWorkLpr",3],["meetings","settingWorkMeetings",3],["proposals","settingWorkProposals",3]])if($(id))$(id).value=workTarget(k,f);if($("learnImportRules"))$("learnImportRules").checked=S.settings.learnImportRules!==false;if($("autoReserveAfterImport"))$("autoReserveAfterImport").checked=S.settings.autoReserveAfterImport!==false;$("notificationStatus").textContent=`Разрешение: ${("Notification" in window)?Notification.permission:"не поддерживается"}`;$("versionStatus").textContent=`Life RPG ${APP_VERSION} • схема данных v${S.version} • обновлено ${new Date(S.updated).toLocaleString("ru-RU")}`}

async function saveSettings(){S.profile.name=$("profileName").value.trim()||"Павел";S.profile.goal=$("profileGoal").value.trim();S.settings.workMonthlyPlan=Math.max(0,+$("settingWorkPlan").value||0);S.settings.monthlyIncome=plannedIncomeForMonth();S.settings.monthlyDebtGoal=Math.max(0,+$("settingDebtGoal").value||0);S.settings.dailySpendLimit=Math.max(0,+$("settingDailySpend").value||0);S.settings.minimumCashFloor=Math.max(0,+$("settingCashFloor")?.value||0);S.settings.liquidityTargetDays=clamp(Math.round(+$("settingLiquidityDays")?.value||14),1,180);S.settings.tennisMonthlyTarget=Math.max(1,+$("settingTennisTarget")?.value||12);S.settings.readingDailyMin=Math.max(1,+$("settingReadingMin")?.value||30);S.settings.tennisBaseElo=Math.max(0,finiteNumberOr($("settingTennisBaseElo")?.value,1000));for(const [k,id,f] of [["contacts","settingWorkContacts",20],["followups","settingWorkFollowups",10],["lpr","settingWorkLpr",3],["meetings","settingWorkMeetings",3],["proposals","settingWorkProposals",3]]){S.workTargets[k]=Math.max(0,finiteNumberOr($(id)?.value,f))}recomputeTennisElo();audit("Настройки сохранены","settings","");await save("Настройки сохранены")}

function initUi(){if(window.__LIFE_RPG_HTML_VERSION__&&window.__LIFE_RPG_HTML_VERSION__!==APP_VERSION){location.replace(`./?v=${encodeURIComponent(APP_VERSION)}&t=${Date.now()}`);return}for(const id of ["workDate","ttDate","readDate","incomeDate"]){if(!$(id))continue;$(id).max=localDateKey();if(!$(id).value)$(id).value=localDateKey()}if($("crmNextDate")&&!$("crmNextDate").value)$("crmNextDate").value="";
  $("whatIfMonthly")?.addEventListener("input",e=>e.target.dataset.touched="1");document.querySelectorAll(".navbtn").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  $("bankCsvInput")?.addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{await importBankCsv(f)}catch(err){$("bankImportStatus").innerHTML=`<span class="csv-bad">${escapeHtml(err.message)}</span>`}e.target.value=""});
  $("bankBalanceScreenshotInput")?.addEventListener("change",async e=>{const f=e.target.files?.[0];if(f)await recognizeBankBalanceScreenshot(f);e.target.value=""});
  $("bankOperationsScreenshotInput")?.addEventListener("change",async e=>{const fs=e.target.files;if(!fs?.length)return;try{await recognizeBankSyncOperations(fs)}catch(err){$("screenshotImportStatus").innerHTML=`<span class="csv-bad">${escapeHtml(err.message||String(err))}</span>`}e.target.value=""});
  $("smartInboxInput")?.addEventListener("change",async e=>{const fs=e.target.files;if(fs?.length)await recognizeSmartInbox(fs);e.target.value=""});
  $("aiImportInput")?.addEventListener("change",async e=>{const f=e.target.files?.[0];if(f)await handleAiImportFile(f);e.target.value=""});
  document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id)}));document.addEventListener("keydown",e=>{if(e.key==="Escape"){const m=[...document.querySelectorAll(".modal.open")].at(-1);if(m)closeModal(m.id)}});$("importFile").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{await importBackupFile(f)}catch(err){alert("Не удалось импортировать файл: "+err.message)}e.target.value=""});setupPwa()
}

const UX7_STORAGE_KEY="life-rpg-ux7";

const UX7_DEFAULTS={today:"focus",finance:"overview",work:"overview",tennis:"overview",more:"overview",advanced:false};

let UX7_PREFS={...UX7_DEFAULTS};

function ux7LoadPrefs(){try{UX7_PREFS={...UX7_DEFAULTS,...JSON.parse(localStorage.getItem(UX7_STORAGE_KEY)||"{}")}}catch{UX7_PREFS={...UX7_DEFAULTS}}}

function ux7SavePrefs(){try{localStorage.setItem(UX7_STORAGE_KEY,JSON.stringify(UX7_PREFS))}catch{}}

function ux7NormalizeText(v){return String(v||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim()}

function ux7CardText(card){return ux7NormalizeText(card?.textContent||"")}

function ux7DateTitle(){return new Intl.DateTimeFormat("ru-RU",{weekday:"long",day:"numeric",month:"long"}).format(new Date()).replace(/^./,m=>m.toUpperCase())}

const UX7_META={
  today:{title:"Сегодня",desc:()=>ux7DateTitle(),tabs:[["focus","Главное"],["progress","Прогресс"]]},
  finance:{title:"Деньги",desc:()=>"Что есть → что делать → почему",tabs:[["overview","Сейчас"],["operations","Операции"],["bank","Банк"],["debts","Долги"],["analysis","Прогноз"],["more","Ещё"]]},
  work:{title:"Работа",desc:()=>"Продажи, действия и сделки",tabs:[["overview","Обзор"],["crm","CRM"],["log","День"]]},
  tennis:{title:"Теннис",desc:()=>"Тренировки и прогресс",tabs:[["overview","Обзор"],["training","Тренировки"],["analytics","Аналитика"]]},
  more:{title:"Ещё",desc:()=>"Знания, прогресс и настройки",tabs:[["overview","Обзор"],["knowledge","Знания"],["rewards","Прогресс"],["settings","Настройки"]]}
};

function ux7ViewsForCard(sectionId,card,index){if(card?.dataset?.ux7View)return card.dataset.ux7View;const t=ux7CardText(card);if(sectionId==="today"){if(/быстрые действия|daily engine|план дня|главные цели месяца|что сделать сегодня/.test(t))return "focus";return "progress"}if(sectionId==="finance"){if(/финансовый центр|обновить данные из банка|счета и реальные остатки|правила авторазбора|пакеты импорта|импорт банковской выписки/.test(t))return "bank";if(/кампания против долгов|состояние финансов|что делать сейчас|реальный денежный баланс|как распределить деньги сейчас|money engine|можно потратить/.test(t))return "overview";if(/денежный поток|расходы месяца|регулярные обязательные платежи|добавить регулярный платеж|единый журнал операций|transaction engine/.test(t))return "operations";if(/долги-боссы|следующее действие|история платежей|debt engine|сценарии погашения|долг → ноль|проценты|avalanche vs snowball/.test(t))return "debts";if(/прогноз|calendar center|финансовый календарь|динамический бюджет|конверты расходов|cash-flow по дням|ключевые даты|отдельный резерв|лаборатория «что если|smart budget|рекомендованный бюджет|financial health|decision engine/.test(t))return "analysis";return "more"}if(sectionId==="work"){if(/work crm|карточка сделки|сделки и следующие шаги/.test(t))return "crm";if(/добавить рабочий день|последние записи/.test(t))return "log";return "overview"}if(sectionId==="tennis"){if(/добавить сессию|история тренировок/.test(t))return "training";if(/tennis analytics|соперники/.test(t))return "analytics";return "overview"}if(sectionId==="more"){if(/библиотека|навыки \/ skill tree|чтение и знания|база знаний/.test(t))return "knowledge";if(/магазин наград|xp: процесс|история сезонов|все достижения/.test(t))return "rewards";if(/уведомления|график ожидаемых доходов|локальные снимки|профиль и настройки|облако и android|данные, версия|опасная зона|журнал изменений/.test(t))return "settings";return "overview"}return "overview"}

function ux7BuildSectionHeader(sectionId){
  const section=$(sectionId),meta=UX7_META[sectionId];if(!section||!meta||section.querySelector(":scope > .ux7-section-head"))return;
  const head=document.createElement("div");head.className="ux7-section-head";head.innerHTML=`<div class="ux7-head-copy"><h1>${meta.title}</h1><div class="ux7-head-desc" id="ux7-desc-${sectionId}"></div></div><div class="ux7-tabs" role="tablist" aria-label="${meta.title}">${meta.tabs.map(([id,label])=>`<button type="button" class="ux7-tab" data-section="${sectionId}" data-view="${id}" role="tab">${label}</button>`).join("")}</div>`;
  section.insertBefore(head,section.firstChild);
  head.querySelector(`#ux7-desc-${sectionId}`).textContent=meta.desc();
  head.querySelectorAll(".ux7-tab").forEach(b=>b.addEventListener("click",()=>ux7SetView(sectionId,b.dataset.view,true)));
}

function ux7TagCards(sectionId){
  const section=$(sectionId);if(!section)return;let i=0;
  section.querySelectorAll(".card").forEach(card=>{if(card.closest(".modal"))return;card.dataset.ux7View=ux7ViewsForCard(sectionId,card,i++);card.classList.add("ux7-card")});
}

function ux7SetView(sectionId,view,scrollTop=false){
  const section=$(sectionId);if(!section)return;const valid=(UX7_META[sectionId]?.tabs||[]).map(x=>x[0]);if(valid.length&&!valid.includes(view))view=UX7_DEFAULTS[sectionId]||valid[0];UX7_PREFS[sectionId]=view;ux7SavePrefs();
  section.querySelectorAll(".ux7-tab").forEach(b=>{const on=b.dataset.view===view;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false")});
  section.querySelectorAll(".ux7-card").forEach(card=>{const views=(card.dataset.ux7View||"").split(/\s+/);card.classList.toggle("ux7-hidden",!views.includes(view))});
  if(scrollTop){const y=Math.max(0,section.getBoundingClientRect().top+window.scrollY-74);window.scrollTo({top:y,behavior:"smooth"})}
  requestAnimationFrame(()=>ux7UpdateSubViewMetrics(sectionId,view));
}

function ux7UpdateSubViewMetrics(sectionId,view){
  const section=$(sectionId);if(!section)return;const visible=[...section.querySelectorAll(".ux7-card:not(.ux7-hidden)")];section.dataset.ux7VisibleCards=String(visible.length);
}

function ux7SetupFinancePulse(){
  const section=$("finance");if(!section||$("ux7FinancePulse"))return;
  const grid=section.querySelector(":scope > .grid");if(!grid)return;const card=document.createElement("div");card.id="ux7FinancePulse";card.className="card span-12 ux7-card ux7-pulse";card.dataset.ux7View="overview";grid.insertBefore(card,grid.firstChild);
}

function ux7NextMoneyEvent(){
  try{const start=new Date(),end=addDays(start,90),events=[...debtEventsBetween(start,end),...regularEventsBetween(start,end)].filter(x=>(+x.amount||0)>0).sort((a,b)=>a.date-b.date);return events[0]||null}catch{return null}
}

function ux7SetupTodayPulse(){
  const section=$("today");if(!section||$("ux7TodayPulse"))return;const grid=section.querySelector(":scope > .grid");if(!grid)return;const card=document.createElement("div");card.id="ux7TodayPulse";card.className="card span-12 ux7-card ux7-today-pulse";card.dataset.ux7View="focus";grid.insertBefore(card,grid.firstChild);
}

function renderUx7TodayPulse(){
  const box=$("ux7TodayPulse");if(!box||!S)return;let next=null;try{next=ux7NextMoneyEvent()}catch{}const free=freeCashBalance(),over=overdueMinimums?.()||[];let status="Стабильно",cls="good";if(over.length){status="Есть просрочка",cls="bad"}else if(free<0){status="Кассовый разрыв",cls="bad"}else if(free<Math.max(3000,dynamicDailyBudget()*3)){status="Нужна осторожность",cls="warn"}
  box.innerHTML=`<div class="ux7-today-line"><div><div class="smallcaps">Финансовый статус</div><b class="ux7-status-${cls}">${status}</b></div><div><div class="smallcaps">Свободно</div><b>${rub(free)}</b></div><div><div class="smallcaps">Следующий платёж</div><b>${next?rub(next.amount):"—"}</b><small>${next?`${fmtDate(next.date)} • ${escapeHtml(next.label)}`:"нет данных"}</small></div><button class="btn secondary small" onclick="ux7Go('finance','overview')">Открыть деньги</button></div>`;
}

function ux7CreateQuickSheet(){if($("ux7QuickSheet"))return;const m=document.createElement("div");m.className="modal ux7-sheet";m.id="ux7QuickSheet";m.innerHTML=`<div class="modal-card"><div class="modal-head"><div><div class="eyebrow">Быстрое действие</div><div class="title">Что добавить?</div></div><button class="close" onclick="closeModal('ux7QuickSheet')">×</button></div><div class="ux7-action-grid"><button onclick="closeModal('ux7QuickSheet');openModal('expenseModal')"><b>−</b><span>Расход</span></button><button onclick="closeModal('ux7QuickSheet');openIncomeModal()"><b>+</b><span>Доход</span></button><button onclick="closeModal('ux7QuickSheet');openModal('paymentModal')"><b>₽</b><span>Платёж долга</span></button><button onclick="closeModal('ux7QuickSheet');ux7OpenInbox(true)"><b>▣</b><span>Скрин банка</span></button><button onclick="closeModal('ux7QuickSheet');ux7Go('work','log');setTimeout(()=>document.getElementById('workContacts')?.focus(),250)"><b>↗</b><span>Рабочий день</span></button><button onclick="closeModal('ux7QuickSheet');ux7Go('tennis','training');setTimeout(()=>document.getElementById('ttMinutes')?.focus(),250)"><b>🏓</b><span>Тренировка</span></button><button onclick="closeModal('ux7QuickSheet');openModal('readingModal')"><b>⌁</b><span>Чтение</span></button><button onclick="closeModal('ux7QuickSheet');ux7Go('finance','overview');setTimeout(()=>document.getElementById('decisionSpendAmount')?.focus(),250)"><b>?</b><span>Можно потратить?</span></button></div></div>`;document.body.appendChild(m);m.addEventListener("click",e=>{if(e.target===m)closeModal("ux7QuickSheet")});
  const fab=document.createElement("button");fab.id="ux7Fab";fab.className="ux7-fab";fab.type="button";fab.setAttribute("aria-label","Добавить");fab.textContent="＋";fab.onclick=()=>openModal("ux7QuickSheet");document.body.appendChild(fab)
}

function ux7OpenInbox(triggerFile=false){ux7Go("finance","bank");if(triggerFile)setTimeout(()=>$("smartInboxInput")?.click(),300)}

function ux7Go(sectionId,view){switchTab(sectionId);setTimeout(()=>ux7SetView(sectionId,view,true),0)}

function ux7SetupTodayQuests(){
  const list=$("todayQuestList");if(!list||list.closest("details.ux7-quests-details"))return;const card=list.closest(".card"),titles=card?[...card.querySelectorAll(":scope > .title")]:[],secondary=titles.find(x=>/ежедневные квесты/i.test(x.textContent||""));if(!card||!secondary)return;
  const d=document.createElement("details");d.className="ux7-quests-details";const sm=document.createElement("summary");sm.textContent="Ежедневные квесты";d.appendChild(sm);secondary.replaceWith(d);d.appendChild(list)
}

function ux7SetupDebtEditor(){
  const card=$("debtEditorCard");if(!card||card.dataset.ux7Prepared==="1")return;card.dataset.ux7Prepared="1";
  const list=$("debtEditorList"),title=card.querySelector(".title"),panel=document.createElement("div");panel.className="ux7-debt-editor-panel";
  const movable=[...card.children].filter(el=>el!==list&&!el.classList.contains("eyebrow")&&!el.classList.contains("title"));movable.forEach(el=>panel.appendChild(el));
  const controls=document.createElement("div");controls.className="split ux7-debt-controls";controls.innerHTML='<button type="button" class="btn secondary small" id="ux7NewDebtBtn">+ Новый долг</button><button type="button" class="btn ghost small" id="ux7ToggleDebtForm">Показать форму</button>';
  title?.after(controls);controls.after(list);list.after(panel);card.classList.add("ux7-debt-form-hidden");
  $("ux7NewDebtBtn").onclick=()=>{clearDebtForm();card.classList.remove("ux7-debt-form-hidden");$("ux7ToggleDebtForm").textContent="Скрыть форму";setTimeout(()=>$("debtName")?.focus(),50)};
  $("ux7ToggleDebtForm").onclick=()=>{const hidden=card.classList.toggle("ux7-debt-form-hidden");$("ux7ToggleDebtForm").textContent=hidden?"Показать форму":"Скрыть форму"};
}

function ux7OpenDebtForm(){const card=$("debtEditorCard");if(!card)return;card.classList.remove("ux7-debt-form-hidden");if($("ux7ToggleDebtForm"))$("ux7ToggleDebtForm").textContent="Скрыть форму"}

function ux7SetupFinanceEditors(){
  const assetName=$("assetName"),assetList=$("assetList");if(assetName&&assetList&&!$("ux7AssetForm")){
    const card=assetName.closest(".card"),form=assetName.closest(".formgrid"),toggle=card?.querySelector("#assetAvailable")?.closest("label"),button=[...card?.querySelectorAll("button")||[]].find(b=>/addAsset\(/.test(b.getAttribute("onclick")||"")),panel=document.createElement("div");panel.id="ux7AssetForm";panel.className="ux7-inline-editor ux7-inline-editor-hidden";if(form)panel.appendChild(form);if(toggle)panel.appendChild(toggle);if(button)panel.appendChild(button);const open=document.createElement("button");open.type="button";open.className="btn ghost small ux7-inline-toggle";open.textContent="+ Добавить / обновить актив";open.onclick=()=>{panel.classList.toggle("ux7-inline-editor-hidden");open.textContent=panel.classList.contains("ux7-inline-editor-hidden")?"+ Добавить / обновить актив":"Скрыть форму"};assetList.after(open,panel)
  }
  const accountName=$("accountName"),accountList=$("accountList");if(accountName&&accountList&&!$("ux7AccountForm")){
    const card=accountName.closest(".card"),form=accountName.closest(".formgrid"),split=form?.nextElementSibling,panel=document.createElement("div");panel.id="ux7AccountForm";panel.className="ux7-inline-editor ux7-inline-editor-hidden";if(form)panel.appendChild(form);if(split&&split.classList.contains("split"))panel.appendChild(split);const open=document.createElement("button");open.type="button";open.className="btn ghost small ux7-inline-toggle";open.textContent="Управление счетами";open.onclick=()=>{panel.classList.toggle("ux7-inline-editor-hidden");open.textContent=panel.classList.contains("ux7-inline-editor-hidden")?"Управление счетами":"Скрыть управление"};accountList.after(open,panel)
  }
  const regular=[...$("finance")?.querySelectorAll(".card")||[]].find(c=>/добавить регулярный платеж/.test(ux7CardText(c)));if(regular&&!regular.querySelector(".ux7-editor-toggle")){const btn=document.createElement("button");btn.type="button";btn.className="btn ghost small ux7-editor-toggle";btn.textContent="Открыть форму";btn.onclick=()=>ux7ToggleEditor(regular);regular.querySelector(".title")?.after(btn);regular.classList.add("ux7-editor-collapsed")}
}

function ux7SetupEditors(){
  // CRM editor starts compact. Debt editor remains visible because its debt list lives inside the same card.
  const crm=$("crmEditorCard");if(crm&&!crm.querySelector(".ux7-editor-toggle")){const btn=document.createElement("button");btn.type="button";btn.className="btn ghost small ux7-editor-toggle";btn.textContent="Показать форму";btn.onclick=()=>ux7ToggleEditor(crm);const title=crm.querySelector(".title");title?.after(btn);crm.classList.add("ux7-editor-collapsed")}
  const workCard=[...$("work")?.querySelectorAll(".card")||[]].find(c=>/добавить рабочий день/.test(ux7CardText(c)));if(workCard&&!workCard.querySelector(".ux7-editor-toggle")){const btn=document.createElement("button");btn.type="button";btn.className="btn ghost small ux7-editor-toggle";btn.textContent="Открыть форму дня";btn.onclick=()=>ux7ToggleEditor(workCard);workCard.querySelector(".title")?.after(btn);workCard.classList.add("ux7-editor-collapsed")}
  const ttCard=[...$("tennis")?.querySelectorAll(".card")||[]].find(c=>/добавить сессию/.test(ux7CardText(c)));if(ttCard&&!ttCard.querySelector(".ux7-editor-toggle")){const btn=document.createElement("button");btn.type="button";btn.className="btn ghost small ux7-editor-toggle";btn.textContent="Открыть форму тренировки";btn.onclick=()=>ux7ToggleEditor(ttCard);ttCard.querySelector(".title")?.after(btn);ttCard.classList.add("ux7-editor-collapsed")}
}

function ux7ToggleEditor(card,force){if(!card)return;const shouldOpen=force===true?true:force===false?false:card.classList.contains("ux7-editor-collapsed");card.classList.toggle("ux7-editor-collapsed",!shouldOpen);const btn=card.querySelector(".ux7-editor-toggle");if(btn)btn.textContent=shouldOpen?"Скрыть форму":"Показать форму"}

function ux7PatchEditorActions(){
  if(typeof editCrmDeal==="function"&&!editCrmDeal.__ux7){const base=editCrmDeal;const wrapped=function(id){ux7Go("work","crm");ux7ToggleEditor($("crmEditorCard"),true);return base(id)};wrapped.__ux7=true;editCrmDeal=wrapped}
  if(typeof editDebt==="function"&&!editDebt.__ux7){const base=editDebt;const wrapped=function(id){ux7Go("finance","debts");ux7OpenDebtForm();return base(id)};wrapped.__ux7=true;editDebt=wrapped}
}

function ux7RefreshHeaders(){for(const [id,meta] of Object.entries(UX7_META)){const d=$(`ux7-desc-${id}`);if(d)d.textContent=meta.desc()}}

function ux7UpdateActiveNavLabel(sectionId){const labels={today:"Сегодня",finance:"Деньги",work:"Работа",tennis:"Теннис",more:"Ещё"};document.querySelectorAll('.navbtn').forEach(b=>{if(b.dataset.tab===sectionId){const strong=b.querySelector('b');const icon=strong?.outerHTML||'';b.innerHTML=icon+labels[sectionId]}})}

function ux7EnhanceAccessibility(){document.querySelectorAll(".modal").forEach(m=>{m.setAttribute("role","dialog");m.setAttribute("aria-modal","true")});document.querySelectorAll("button.close").forEach(b=>{if(!b.getAttribute("aria-label"))b.setAttribute("aria-label","Закрыть")});document.querySelectorAll(".iconbtn").forEach((b,i)=>{if(!b.getAttribute("aria-label"))b.setAttribute("aria-label",b.title||b.textContent.trim()||`Действие ${i+1}`)})}

function ux7InstallShell(){
  document.body.classList.add("ux7");ux7LoadPrefs();
  for(const id of Object.keys(UX7_META)){ux7BuildSectionHeader(id);ux7TagCards(id)}
  ux7SetupFinancePulse();ux7SetupTodayPulse();ux7CreateQuickSheet();ux7SetupTodayQuests();ux7SetupDebtEditor();ux7SetupFinanceEditors();ux7SetupEditors();ux7PatchEditorActions();ux7EnhanceAccessibility();
  for(const id of Object.keys(UX7_META))ux7SetView(id,UX7_PREFS[id]||UX7_DEFAULTS[id],false);
  const financeNav=document.querySelector('.navbtn[data-tab="finance"]');if(financeNav){const b=financeNav.querySelector('b')?.outerHTML||'<b>₽</b>';financeNav.innerHTML=b+'Деньги'}
  renderUx7FinancePulse();renderUx7TodayPulse();ux7RefreshHeaders();
}
