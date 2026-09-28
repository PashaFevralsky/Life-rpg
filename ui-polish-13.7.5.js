"use strict";

/* Life RPG 13.7.5 — mobile UI polish.
   Presentation only: navigation, density, forecast readability and visual hierarchy.
   No finance/state calculations are changed here. */

(function(){
  const STYLE_ID="life-ui-polish-13-7-5";
  const FLAG="__lifeUiPolish1375";

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      /* Clearer hierarchy without changing domain cards. */
      .ui82 .ux7-section-head{box-shadow:0 1px 0 rgba(255,255,255,.025)}
      .ui82 .ux7-head-copy{gap:6px}
      .ui82 .ux7-head-desc{max-width:58ch}
      .ui82 .card{scroll-margin-top:132px}
      .ui82 .section-title,.ui82 .title{letter-spacing:-.015em}
      .ui82 .formgrid{align-items:end}
      .ui82 .ux7-section-shortcuts{gap:6px}

      /* Forecast content is explicitly marked as a model, not as a factual balance. */
      .ui82 .ui-polish-model-note{
        margin:9px 0 10px;
        padding:9px 11px;
        border:1px solid var(--ui82-divider);
        border-radius:12px;
        background:#0d0f14;
        color:var(--muted);
        font-size:11px;
        line-height:1.45;
      }
      .ui82 .ui-polish-model-note b{color:#d8dbe3;font-weight:700}

      /* Cash-flow graph becomes optional detail; key dates stay immediately visible. */
      .ui82 .ui-polish-chart-details{
        margin-top:10px;
        border-top:1px solid var(--ui82-divider);
      }
      .ui82 .ui-polish-chart-details>summary{
        min-height:44px;
        display:flex;
        align-items:center;
        gap:8px;
        cursor:pointer;
        color:#9ba3b2;
        font-size:12px;
        font-weight:680;
        list-style:none;
        user-select:none;
      }
      .ui82 .ui-polish-chart-details>summary::-webkit-details-marker{display:none}
      .ui82 .ui-polish-chart-details>summary::before{
        content:"›";
        width:18px;
        text-align:center;
        font-size:20px;
        line-height:1;
        transform:rotate(0deg);
        transition:transform .14s ease;
      }
      .ui82 .ui-polish-chart-details[open]>summary::before{transform:rotate(90deg)}
      .ui82 .ui-polish-chart-details .cashflow-chart{margin-top:2px}

      @media(max-width:850px){
        /* Bottom navigation remains reachable but occupies less visual space. */
        .ui82 .shell{padding-bottom:calc(132px + env(safe-area-inset-bottom))!important}
        .ui82 .bottom{
          width:calc(100% - 12px);
          bottom:max(6px,env(safe-area-inset-bottom));
          padding:3px 5px;
          border-radius:18px;
          box-shadow:0 10px 28px rgba(0,0,0,.34);
        }
        .ui82 .navbtn{
          min-height:54px;
          padding:5px 2px 6px;
          font-size:9.5px;
        }
        .ui82 .navbtn b{
          width:30px;
          height:25px;
          margin-bottom:1px;
        }
        .ui82 .navbtn b svg,
        .ui82 .navbtn b [data-lucide]{width:22px;height:22px}

        /* Dense finance forecast is easier to scan on a phone. */
        .ui82 #finance .cashflow-chart{height:138px}
        .ui82 #finance .cashflow-event{
          grid-template-columns:58px minmax(0,1fr) auto;
          gap:7px;
          padding:7px 0;
          font-size:11px;
        }
        .ui82 #finance .cashflow-event>div{min-width:0;overflow-wrap:anywhere}
        .ui82 #finance .cashflow-event>b{white-space:nowrap}
        .ui82 #finance #cashFlowSummary .report-item{padding:10px}
        .ui82 #finance #cashFlowSummary .report-item>b{font-size:19px}
      }

      @media(max-width:600px){
        /*
          Finance has six primary modes. A compact 3×2 grid is clearer than a
          horizontally clipped rail and makes every destination visible.
        */
        body.ui82[data-section="finance"] #finance .ux7-tabs{
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:0 12px;
          overflow:visible;
          padding:0;
          scroll-snap-type:none;
        }
        body.ui82[data-section="finance"] #finance .ux7-tab{
          width:100%;
          min-width:0;
          min-height:44px;
          margin-right:0;
          padding:9px 2px 8px;
          text-align:center;
          scroll-snap-align:none;
        }
        body.ui82[data-section="finance"] #finance .ux7-tab.active::after{
          left:16%;
          right:16%;
        }

        .ui82 #finance .ux7-section-head{padding-bottom:5px}
        .ui82 #finance .report-grid{gap:1px}
        .ui82 #finance .notice,.ui82 #finance .status{line-height:1.45}
      }

      @media(max-width:370px){
        body.ui82[data-section="finance"] #finance .ux7-tabs{gap:0 8px}
        body.ui82[data-section="finance"] #finance .ux7-tab{font-size:12px}
      }
    `;
    document.head.appendChild(style)
  }

  function financeModelNotes(){
    const flow=document.getElementById("cashFlowSummary");
    const flowCard=flow?.closest(".card");
    if(flowCard&&!flowCard.querySelector(".ui-polish-model-note")){
      const note=document.createElement("div");
      note.className="ui-polish-model-note";
      note.innerHTML="<b>Расчётная модель.</b> Суммы ниже — прогноз сценариев, а не фактический остаток на счёте.";
      flow.insertAdjacentElement("beforebegin",note)
    }

    const forecast=document.getElementById("financialForecast");
    const forecastCard=forecast?.closest(".card");
    if(forecastCard&&!forecastCard.querySelector(".ui-polish-model-note")){
      const note=document.createElement("div");
      note.className="ui-polish-model-note";
      note.innerHTML="<b>Прогноз.</b> Результат зависит от графика доходов, обязательств и заданных расходов.";
      forecast.insertAdjacentElement("beforebegin",note)
    }
  }

  function compactCashFlow(){
    const chart=document.querySelector("#finance .cashflow-chart");
    const events=document.getElementById("cashFlowEvents");
    if(!chart||!events||chart.closest(".ui-polish-chart-details"))return;
    const details=document.createElement("details");
    details.className="ui-polish-chart-details";
    const summary=document.createElement("summary");
    summary.textContent="График сценариев";
    chart.parentNode.insertBefore(details,chart);
    details.append(summary,chart);
    events.insertAdjacentElement("afterend",details)
  }

  function alignActiveRailTab(sectionId,view){
    const section=document.getElementById(sectionId);
    const rail=section?.querySelector(".ux7-tabs");
    const tab=section?.querySelector(`.ux7-tab[data-view="${view}"]`);
    if(!rail||!tab)return;
    const style=getComputedStyle(rail);
    if(style.display==="grid"||style.overflowX==="visible")return;
    const rr=rail.getBoundingClientRect(),tr=tab.getBoundingClientRect();
    if(tr.left>=rr.left+1&&tr.right<=rr.right-1)return;
    try{tab.scrollIntoView({block:"nearest",inline:"nearest",behavior:"auto"})}catch{}
  }

  function patchChrome(){
    const current=globalThis.ui82SyncChrome;
    if(typeof current!=="function"||current[FLAG])return;
    const patched=function(sectionId,view){
      const active=document.querySelector?.(".section.active")?.id||sectionId;
      if(sectionId!==active)return;
      if(document.body?.dataset){document.body.dataset.section=sectionId;document.body.dataset.view=view}
      const fab=document.getElementById("ux7Fab");
      const hideFab=(sectionId==="today")||(sectionId==="more"&&view==="settings")||(sectionId==="finance"&&view==="analysis");
      fab?.classList.toggle("ui82-fab-hidden",hideFab);
      requestAnimationFrame(()=>alignActiveRailTab(sectionId,view))
    };
    try{Object.defineProperty(patched,FLAG,{value:true})}catch{patched[FLAG]=true}
    globalThis.ui82SyncChrome=patched
  }

  function apply(){
    ensureStyle();
    financeModelNotes();
    compactCashFlow();
    const active=document.querySelector(".section.active")?.id;
    if(active&&globalThis.UX7_PREFS)alignActiveRailTab(active,UX7_PREFS[active]||"overview")
  }

  function patchRender(){
    const current=globalThis.render;
    if(typeof current!=="function"||current[FLAG])return;
    const patched=function(...args){
      const result=current.apply(this,args);
      requestAnimationFrame(apply);
      return result
    };
    try{Object.defineProperty(patched,FLAG,{value:true})}catch{patched[FLAG]=true}
    globalThis.render=patched
  }

  function install(){
    ensureStyle();
    patchChrome();
    patchRender();
    requestAnimationFrame(apply);
    return true
  }

  globalThis.lifeUiPolishInstall=install;
  ensureStyle()
})();
