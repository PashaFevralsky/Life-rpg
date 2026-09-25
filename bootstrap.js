"use strict";

/* Life RPG 12.5.0 — modular runtime bootstrap + integrated domain OS */
const LIFE_RPG_RUNTIME_MODULES=[
  "data-os.js","projects-os.js","goals-os.js","review-os.js","calendar-os.js","tasks-os.js","routines-os.js","inbox-os.js","rules-os.js","insights-os.js","command-os.js","calibration-os.js","execution-os.js","decision-os.js","recovery-os.js",
  "tracking-os.js","personal-os.js","journal-os.js","people-os.js","focus-os.js","body-os.js","home-os.js","capture2-os.js","personal-import-os.js","dashboard-os.js",
  "knowledge-growth.js","knowledge-decision.js","work-growth.js","tennis-growth.js","tennis-huawei.js","tennis-decision.js","rpg-growth.js","life-os.js","today-execution.js","personal-integration-os.js","integration-12.5.js"
];
function lifeRuntimeLoadScript(file){return new Promise((resolve,reject)=>{const existing=document.querySelector?.(`script[data-life-runtime="${file}"]`);if(existing){if(existing.dataset.ready==="1")resolve();else existing.addEventListener("load",resolve,{once:true});return}const s=document.createElement("script");s.src=`./${file}?v=${APP_VERSION}`;s.async=false;s.dataset.lifeRuntime=file;s.onload=()=>{s.dataset.ready="1";resolve()};s.onerror=()=>reject(new Error(`Не удалось загрузить ${file}`));document.head.appendChild(s)})}
function lifeRefreshReleaseLabels(){
  document.title=`Life RPG ${APP_VERSION}`;
  window.__LIFE_RPG_HTML_VERSION__=APP_VERSION
}
function lifeInstallRuntime(){
  if(window.__LIFE_RPG_RUNTIME__)return;window.__LIFE_RPG_RUNTIME__=true;
  const baseRender=render;
  const renderPipeline=[
    ["ensureProjectsOsUi","renderProjectsOs"],["ensureGoalsOsUi","renderGoalsOs"],["ensureReviewOsUi","renderReviewOs"],["ensureCalendarOsUi","renderCalendarOs"],["ensureTasksOsUi","renderTasksOs"],["ensureRoutinesOsUi","renderRoutinesOs"],
    ["ensureTrackingOsUi","renderTrackingOs"],["ensureJournalOsUi","renderJournalOs"],["ensurePeopleOsUi","renderPeopleOs"],["ensureFocusOsUi","renderFocusOs"],["ensureBodyOsUi","renderBodyOs"],["ensureHomeOsUi","renderHomeOs"],["ensureCapture2Ui","renderCapture2"],
    ["ensureExecutionOsUi","renderExecutionOs"],["ensureCalibrationOsUi","renderCalibrationOs"],["ensureDecisionOsUi","renderDecisionOs"],["ensureRulesOsUi","renderRulesOs"],["ensureInsightsOsUi","renderInsightsOs"],["ensureCommandOsUi","renderCommandOs"],["ensureDataOsUi","renderDataOs"],["ensureRecoveryOsUi","renderRecoveryOs"],
    ["ensureKnowledgeGrowthUi","renderKnowledgeGrowth"],["ensureKnowledge124Ui","renderKnowledge124"],["ensureTennisGrowthUi","renderTennisGrowth"],["ensureTennisDecision22Ui","renderTennisDecision22"],["ensureTodayExecution123Ui","renderTodayExecution123"],["ensureRpgGrowthUi","renderRpgGrowth"],["ensurePersonalImportUi","renderPersonalImportUi"],["ensureDashboardOsUi","renderDashboardOs"],["ensureIntegration125Ui","renderIntegration125"]
  ];
  render=function(){
    baseRender();
    for(const [ensureName,renderName] of renderPipeline){
      const ensureUi=globalThis[ensureName],renderUi=globalThis[renderName];
      if(typeof ensureUi==="function")ensureUi();
      if(typeof renderUi==="function")renderUi()
    }
    requestAnimationFrame(()=>{lifeRefreshReleaseLabels();renderUx7FinancePulse();renderUx7TodayPulse();ux7RefreshHeaders();const active=document.querySelector(".section.active")?.id||"today";for(const id of Object.keys(UX7_META)){const section=$(id);if(id===active||section?.querySelector(".ux7-card:not(.ux7-view-ready)"))ux7SetView(id,UX7_PREFS[id]||UX7_DEFAULTS[id],false)}window.LifePlatform?.refreshIcons?.();if(typeof dashboardApply==="function")dashboardApply()})
  };
  const baseSwitchTab=switchTab;switchTab=function(id){baseSwitchTab(id);requestAnimationFrame(()=>{const view=UX7_PREFS[id]||UX7_DEFAULTS[id];ux7SetView(id,view,false);ux7RefreshHeaders();ui82SyncChrome(id,view);if(typeof dashboardApply==="function")dashboardApply()})}
}
async function lifeBoot(){lifeRefreshReleaseLabels();if(!window.__LIFE_RPG_MODULES_PRELOADED__)await Promise.all(LIFE_RPG_RUNTIME_MODULES.map(lifeRuntimeLoadScript));lifeInstallRuntime();ux7InstallShell();initUi();await loadState();if(typeof calibrationOnBoot==="function")await calibrationOnBoot()}
lifeBoot().catch(e=>{console.error("Life RPG boot failed",e);document.documentElement.classList.remove("life-rpg-booting");const box=document.getElementById("versionStatus");if(box)box.textContent=`Life RPG ${APP_VERSION} • ошибка загрузки: ${e.message}`;try{toast(`Ошибка запуска: ${e.message}`)}catch{}});
