"use strict";

/* Life RPG 14.1.2 — Domain Focus.
   Consolidates Finance / Work / Tennis overview hierarchy.
   No calculations, state schema, finance core or domain data are changed. */

let PRODUCT_CORE1412_CLARITY_READY=false;

function productCore1412Card(id){
  return document.getElementById(id)?.closest?.(".card")||null
}

function productCore1412Contains(card,ids){
  if(!card)return false;
  return ids.some(id=>card.querySelector?.(`#${id}`))
}

function productCore1412Secondary(sectionId,card){
  if(sectionId==="finance")return productCore1412Contains(card,[
    "financialHealth","decisionEngine","moneyEngineSummary"
  ]);
  if(sectionId==="work")return productCore1412Contains(card,[
    "workActivitySummary","workQuests","workPace","workFunnel",
    "work121Pace","work121Activity","work121Concentration",
    "workOsCoverage","workOsHistory"
  ]);
  if(sectionId==="tennis")return productCore1412Contains(card,[
    "tennisOsCommand","tennisOsPlan","tennisSkills","tennisMonthlyReport"
  ]);
  return false
}

function productCore1412InstallClarity(){
  if(PRODUCT_CORE1412_CLARITY_READY)return;
  PRODUCT_CORE1412_CLARITY_READY=true;
  if(typeof ux7RegisterClarityProvider==="function"){
    ux7RegisterClarityProvider("product-core-14.1.2",productCore1412Secondary)
  }
}

function productCore1412Retitle(card,eyebrow,title){
  if(!card||card.dataset.productCore1412==="1")return;
  card.dataset.productCore1412="1";
  card.classList.add("product-core1412-primary");
  const e=card.querySelector(".eyebrow"),t=card.querySelector(".section-title");
  if(e)e.textContent=eyebrow;
  if(t)t.textContent=title
}

function productCore1412OrderFinance(){
  const grid=document.querySelector("#finance .grid"),primary=productCore1412Card("autopilotPlan");
  if(!grid||!primary)return;
  productCore1412Retitle(primary,"Деньги","Что делать с деньгами сейчас");
  if(grid.firstElementChild!==primary)grid.insertBefore(primary,grid.firstElementChild)
}

function productCore1412OrderWork(){
  const grid=document.querySelector("#work .grid"),hero=grid?.querySelector(".work-hero"),primary=productCore1412Card("workOsCommand");
  if(!grid||!primary)return;
  productCore1412Retitle(primary,"Работа","Что делать сейчас");
  if(hero&&hero.nextElementSibling!==primary)hero.insertAdjacentElement("afterend",primary)
}

function productCore1412OrderTennis(){
  const grid=document.querySelector("#tennis .grid"),hero=grid?.querySelector(".tennis-hero"),primary=productCore1412Card("tennisDecision22Next");
  if(!grid||!primary)return;
  productCore1412Retitle(primary,"Теннис","Следующая тренировка");
  if(hero&&hero.nextElementSibling!==primary)hero.insertAdjacentElement("afterend",primary)
}

function productCore1412RefreshClarity(sectionId){
  if(typeof ux7ApplyClarity!=="function")return;
  const section=document.getElementById(sectionId);
  const view=section?.querySelector(".ux7-tab.active")?.dataset?.view||"overview";
  ux7ApplyClarity(sectionId,view)
}

function productCore1412Apply(){
  productCore1412InstallClarity();
  productCore1412OrderFinance();
  productCore1412OrderWork();
  productCore1412OrderTennis();
  for(const section of ["finance","work","tennis"])productCore1412RefreshClarity(section)
}

function ensureProductCore1412Ui(){productCore1412Apply()}
function renderProductCore1412(){productCore1412Apply()}
