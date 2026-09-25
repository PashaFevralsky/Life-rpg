"use strict";

/* Life RPG 12.5.0 — integration/stabilization layer.
   No state migration. Removes superseded summary cards while preserving their engines. */

function integration125HideSupersededCard(commandId,replacementId){
  const command=document.getElementById(commandId),replacement=document.getElementById(replacementId);
  const card=command?.closest?.(".card");
  if(card&&replacement){card.hidden=true;card.dataset.supersededBy=replacementId}
}
function integration125RefreshStaticReleaseLabels(){
  document.querySelectorAll?.(".eyebrow").forEach(el=>{
    if(el.childElementCount)return;
    const text=String(el.textContent||"");
    if(text.includes("12.0.3"))el.textContent=text.replaceAll("12.0.3",APP_VERSION)
  })
}
function integration125Consolidate(){
  integration125HideSupersededCard("todayFlowCommand","today123Command");
  integration125HideSupersededCard("knowledgeOsCommand","knowledge124Today");
  integration125RefreshStaticReleaseLabels()
}
function ensureIntegration125Ui(){integration125Consolidate()}
function renderIntegration125(){integration125Consolidate()}
