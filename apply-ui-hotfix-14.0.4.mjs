import fs from "node:fs";

const read = p => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s);
function replaceOnce(s, from, to, label){
  const i=s.indexOf(from);
  if(i<0) throw new Error(`${label}: anchor not found`);
  if(s.indexOf(from,i+1)>=0) throw new Error(`${label}: anchor is not unique`);
  return s.slice(0,i)+to+s.slice(i+from.length);
}
function requireText(s, token, label){
  if(!s.includes(token)) throw new Error(`${label}: required token not found: ${token}`);
}
function versionAtLeast(v, major, minor, patch){
  const a=String(v||"").split(".").map(Number);
  return a.length===3&&a.every(Number.isInteger)&&(a[0]>major||(a[0]===major&&(a[1]>minor||(a[1]===minor&&a[2]>=patch))));
}

const changed=[];

// ui.js — dynamic modal semantics, keyboard-accessible tabs, Recent entry, focused Quick Add.
{
  const p="ui.js";
  let s=read(p);

  const modalOld=`function modalTop(){return [...document.querySelectorAll(".modal.open")].at(-1)||null}
function modalFocusables(m){return m?[...m.querySelectorAll(MODAL_FOCUSABLE_SELECTOR)].filter(el=>!el.hidden&&el.getAttribute("aria-hidden")!=="true"&&(!el.getClientRects||el.getClientRects().length>0)):[]}
function syncModalDocumentState(){const open=!!modalTop();document.documentElement?.classList.toggle("modal-open",open);document.body?.classList.toggle("modal-open",open)}
function openModal(id){const m=$(id);if(!m)return;lastModalFocus=document.activeElement;m.classList.add("open");m.setAttribute("aria-hidden","false");syncModalDocumentState();setTimeout(()=>modalFocusables(m)[0]?.focus(),0)}
function closeModal(id){const m=$(id);if(!m)return;m.classList.remove("open");m.setAttribute("aria-hidden","true");syncModalDocumentState();const top=modalTop();if(top){modalFocusables(top)[0]?.focus();return}lastModalFocus?.focus?.()}
function handleModalKeydown(e){const m=modalTop();if(!m)return;if(e.key==="Escape"){e.preventDefault();closeModal(m.id);return}if(e.key!=="Tab")return;const a=modalFocusables(m);if(!a.length){e.preventDefault();return}const first=a[0],last=a[a.length-1],active=document.activeElement;if(e.shiftKey&&(active===first||!m.contains(active))){e.preventDefault();last.focus()}else if(!e.shiftKey&&(active===last||!m.contains(active))){e.preventDefault();first.focus()}}`;

  const modalNew=`function modalTop(){return [...document.querySelectorAll(".modal.open")].at(-1)||null}
function modalFocusables(m){return m?[...m.querySelectorAll(MODAL_FOCUSABLE_SELECTOR)].filter(el=>!el.hidden&&el.getAttribute("aria-hidden")!=="true"&&(!el.getClientRects||el.getClientRects().length>0)):[]}
function prepareModalAccessibility(m){
  if(!m)return null;
  m.setAttribute("role","dialog");m.setAttribute("aria-modal","true");m.setAttribute("aria-hidden",m.classList.contains("open")?"false":"true");
  const title=m.querySelector(".modal-head .title,.modal-head .section-title");
  if(title){if(!title.id&&m.id)title.id=\`\${m.id}Title\`;if(title.id)m.setAttribute("aria-labelledby",title.id)}
  m.querySelectorAll("button.close").forEach(b=>{if(!b.getAttribute("aria-label"))b.setAttribute("aria-label","Закрыть")});
  return m
}
function syncModalDocumentState(){const open=!!modalTop();document.documentElement?.classList.toggle("modal-open",open);document.body?.classList.toggle("modal-open",open)}
function openModal(id){const m=prepareModalAccessibility($(id));if(!m)return;lastModalFocus=document.activeElement;m.classList.add("open");m.setAttribute("aria-hidden","false");syncModalDocumentState();setTimeout(()=>modalFocusables(m)[0]?.focus(),0)}
function closeModal(id){const m=$(id);if(!m)return;m.classList.remove("open");m.setAttribute("aria-hidden","true");syncModalDocumentState();const top=modalTop();if(top){modalFocusables(top)[0]?.focus();return}lastModalFocus?.focus?.()}
function handleModalKeydown(e){const m=modalTop();if(!m)return;if(e.key==="Escape"){e.preventDefault();closeModal(m.id);return}if(e.key!=="Tab")return;const a=modalFocusables(m);if(!a.length){e.preventDefault();return}const first=a[0],last=a[a.length-1],active=document.activeElement;if(e.shiftKey&&(active===first||!m.contains(active))){e.preventDefault();last.focus()}else if(!e.shiftKey&&(active===last||!m.contains(active))){e.preventDefault();first.focus()}}`;
  s=replaceOnce(s,modalOld,modalNew,"ui.js modal accessibility");

  const hubOld=`    <button type="button" class="ui139-hub-row" data-ui139-view="settings" data-ui139-target="#import127Command"><span><b>Импорт и Share</b><small>Файлы, скриншоты и внешние данные</small></span><i>›</i></button>
    <button type="button" class="ui139-hub-row" data-ui139-view="settings" data-ui139-target="#recovery133Center"><span><b>Backup и Recovery</b><small>Резервные копии и восстановление</small></span><i>›</i></button>`;
  const hubNew=`    <button type="button" class="ui139-hub-row" data-ui139-view="settings" data-ui139-target="#import127Command"><span><b>Импорт и Share</b><small>Файлы, скриншоты и внешние данные</small></span><i>›</i></button>
    <button type="button" class="ui139-hub-row" data-ui139-action="recent"><span><b>Недавние действия</b><small>Последние изменения и быстрый возврат к ним</small></span><i>›</i></button>
    <button type="button" class="ui139-hub-row" data-ui139-view="settings" data-ui139-target="#recovery133Center"><span><b>Backup и Recovery</b><small>Резервные копии и восстановление</small></span><i>›</i></button>`;
  s=replaceOnce(s,hubOld,hubNew,"ui.js Recent hub row");

  const hubBindOld=`  card.querySelectorAll(".ui139-hub-row").forEach(b=>b.addEventListener("click",()=>ui139MoreNavigate(b.dataset.ui139View,b.dataset.ui139Target||"")))
}`;
  const hubBindNew=`  card.querySelectorAll(".ui139-hub-row").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.ui139Action==="recent"&&typeof ux128OpenRecent==="function")return ux128OpenRecent();ui139MoreNavigate(b.dataset.ui139View,b.dataset.ui139Target||"")}))
}`;
  s=replaceOnce(s,hubBindOld,hubBindNew,"ui.js More hub binding");

  const buildOld=`function ux7BuildSectionHeader(sectionId){
  const section=$(sectionId),meta=UX7_META[sectionId];if(!section||!meta||section.querySelector(":scope > .ux7-section-head"))return;
  const clarity=UX7_CLARITY_SECTIONS.includes(sectionId)?\`<button type="button" class="ux7-clarity-toggle" data-section="\${sectionId}" aria-expanded="false">Детали</button>\`:"";
  const head=document.createElement("div");head.className="ux7-section-head";head.innerHTML=\`<div class="ux7-head-copy"><h1>\${meta.title}</h1><div class="ux7-head-actions"><div class="ux7-head-desc" id="ux7-desc-\${sectionId}"></div>\${clarity}</div></div><div class="ux7-tabs" role="tablist" aria-label="\${meta.title}">\${meta.tabs.map(([id,label])=>\`<button type="button" class="ux7-tab" data-section="\${sectionId}" data-view="\${id}" role="tab">\${label}</button>\`).join("")}</div>\`;
  section.insertBefore(head,section.firstChild);
  head.querySelector(\`#ux7-desc-\${sectionId}\`).textContent=meta.desc();
  head.querySelectorAll(".ux7-tab").forEach(b=>b.addEventListener("click",()=>ux7SetView(sectionId,b.dataset.view,true)));
  head.querySelector(".ux7-clarity-toggle")?.addEventListener("click",()=>ux7ToggleClarity(sectionId));
}`;

  const buildNew=`function ux7BindTabKeyboard(sectionId,head){
  const rail=head?.querySelector(".ux7-tabs");if(!rail||rail.dataset.keyboardBound==="1")return;rail.dataset.keyboardBound="1";
  rail.addEventListener("keydown",e=>{
    if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(e.key))return;
    const tabs=[...rail.querySelectorAll(".ux7-tab")],current=tabs.indexOf(document.activeElement);if(current<0||!tabs.length)return;
    let next=current;if(e.key==="Home")next=0;else if(e.key==="End")next=tabs.length-1;else if(e.key==="ArrowLeft"||e.key==="ArrowUp")next=(current-1+tabs.length)%tabs.length;else next=(current+1)%tabs.length;
    e.preventDefault();const target=tabs[next];ux7SetView(sectionId,target.dataset.view,false);target.focus()
  })
}
function ux7BuildSectionHeader(sectionId){
  const section=$(sectionId),meta=UX7_META[sectionId];if(!section||!meta||section.querySelector(":scope > .ux7-section-head"))return;
  const clarity=UX7_CLARITY_SECTIONS.includes(sectionId)?\`<button type="button" class="ux7-clarity-toggle" data-section="\${sectionId}" aria-expanded="false">Детали</button>\`:"";
  const head=document.createElement("div");head.className="ux7-section-head";head.innerHTML=\`<div class="ux7-head-copy"><h1>\${meta.title}</h1><div class="ux7-head-actions"><div class="ux7-head-desc" id="ux7-desc-\${sectionId}"></div>\${clarity}</div></div><div class="ux7-tabs" role="tablist" aria-label="\${meta.title}">\${meta.tabs.map(([id,label])=>\`<button type="button" class="ux7-tab" id="ux7-tab-\${sectionId}-\${id}" data-section="\${sectionId}" data-view="\${id}" role="tab" aria-selected="false" tabindex="-1">\${label}</button>\`).join("")}</div>\`;
  section.insertBefore(head,section.firstChild);
  const panels=[...section.children].filter(el=>el!==head&&(el.classList.contains("hero")||el.classList.contains("grid")));
  panels.forEach((panel,i)=>{if(!panel.id)panel.id=\`ux7-panel-\${sectionId}-\${i+1}\`;panel.setAttribute("role","tabpanel")});
  const controls=panels.map(x=>x.id).join(" ");
  head.querySelector(\`#ux7-desc-\${sectionId}\`).textContent=meta.desc();
  head.querySelectorAll(".ux7-tab").forEach(b=>{if(controls)b.setAttribute("aria-controls",controls);b.addEventListener("click",()=>ux7SetView(sectionId,b.dataset.view,true))});
  ux7BindTabKeyboard(sectionId,head);
  head.querySelector(".ux7-clarity-toggle")?.addEventListener("click",()=>ux7ToggleClarity(sectionId));
}`;
  s=replaceOnce(s,buildOld,buildNew,"ui.js tab semantics");

  const setViewOld=`  section.querySelectorAll(".ux7-tab").forEach(b=>{const on=b.dataset.view===view;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false")});
  section.querySelectorAll(".ux7-card").forEach(card=>{const views=(card.dataset.ux7View||"").split(/\\s+/);card.classList.toggle("ux7-hidden",!views.includes(view));card.classList.add("ux7-view-ready")});`;
  const setViewNew=`  section.querySelectorAll(".ux7-tab").forEach(b=>{const on=b.dataset.view===view;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false");b.tabIndex=on?0:-1});
  const activeTab=section.querySelector(\`.ux7-tab[data-view="\${view}"]\`);for(const id of String(activeTab?.getAttribute("aria-controls")||"").split(/\\s+/).filter(Boolean)){const panel=$(id);if(panel&&activeTab?.id)panel.setAttribute("aria-labelledby",activeTab.id)}
  section.querySelectorAll(".ux7-card").forEach(card=>{const views=(card.dataset.ux7View||"").split(/\\s+/);card.classList.toggle("ux7-hidden",!views.includes(view));card.classList.add("ux7-view-ready")});`;
  s=replaceOnce(s,setViewOld,setViewNew,"ui.js tab state");

  const quickSpend=`<button onclick="closeModal('ux7QuickSheet');ux7Go('finance','overview');setTimeout(()=>document.getElementById('decisionSpendAmount')?.focus(),250)">\${ui82Icon("spend")}<span>Можно потратить?</span></button>`;
  if(!s.includes(quickSpend)) throw new Error("ui.js Quick Add spend action anchor not found");
  s=s.replace(quickSpend,"");

  const a11yOld=`function ux7EnhanceAccessibility(){document.querySelectorAll(".modal").forEach(m=>{m.setAttribute("role","dialog");m.setAttribute("aria-modal","true");m.setAttribute("aria-hidden",m.classList.contains("open")?"false":"true")});document.querySelectorAll("button.close").forEach(b=>{if(!b.getAttribute("aria-label"))b.setAttribute("aria-label","Закрыть")});document.querySelectorAll(".iconbtn").forEach((b,i)=>{if(!b.getAttribute("aria-label"))b.setAttribute("aria-label",b.title||b.textContent.trim()||\`Действие \${i+1}\`)})}`;
  const a11yNew=`function ux7EnhanceAccessibility(){document.querySelectorAll(".modal").forEach(prepareModalAccessibility);document.querySelectorAll("button.close").forEach(b=>{if(!b.getAttribute("aria-label"))b.setAttribute("aria-label","Закрыть")});document.querySelectorAll(".iconbtn").forEach((b,i)=>{if(!b.getAttribute("aria-label"))b.setAttribute("aria-label",b.title||b.textContent.trim()||\`Действие \${i+1}\`)})}`;
  s=replaceOnce(s,a11yOld,a11yNew,"ui.js accessibility enhancer");

  requireText(s,'data-ui139-action="recent"',"ui.js");
  requireText(s,"function ux7BindTabKeyboard","ui.js");
  requireText(s,"prepareModalAccessibility","ui.js");
  if(s.includes("Можно потратить?</span></button>")) throw new Error("ui.js: non-entry spend action still present in Quick Add");
  write(p,s);changed.push(p);
}

// ux-12.8.js — Quick Add keeps one extra entry action; service actions remain elsewhere.
{
  const p="ux-12.8.js";let s=read(p);
  const old=`function ux128PatchQuickSheet(){
  const grid=document.querySelector("#ux7QuickSheet .ux7-action-grid");if(!grid||grid.querySelector("[data-ux128-action]"))return;
  grid.append(
    ux128QuickButton("task","Задача","work",ux128OpenTask),
    ux128QuickButton("inbox","В Inbox","plus",ux128OpenCapture),
    ux128QuickButton("recent","Недавнее","activity",ux128OpenRecent),
    ux128QuickButton("search","Поиск","spend",ux128OpenSearch),
    ux128QuickButton("import","Импорт","bank",ux128OpenImport)
  );window.LifePlatform?.refreshIcons?.(grid)
}`;
  const neu=`function ux128PatchQuickSheet(){
  const grid=document.querySelector("#ux7QuickSheet .ux7-action-grid");if(!grid||grid.querySelector("[data-ux128-action]"))return;
  grid.append(ux128QuickButton("task","Задача","work",ux128OpenTask));window.LifePlatform?.refreshIcons?.(grid)
}`;
  s=replaceOnce(s,old,neu,"ux-12.8.js compact Quick Add");
  write(p,s);changed.push(p);
}

// training-os.js — keep outdoor/conditioning entry in its own Training OS surface, not Quick Add.
{
  const p="training-os.js";let s=read(p);
  const start='function training129PatchQuick(){',end='\nlet TRAINING129_INTEGRATED=false;';
  const i=s.indexOf(start),j=i<0?-1:s.indexOf(end,i);
  if(i<0||j<0)throw new Error("training-os.js compact Quick Add: function boundary not found");
  s=s.slice(0,i)+"function training129PatchQuick(){}"+s.slice(j);
  write(p,s);changed.push(p);
}

// training E2E — Training OS remains reachable in More / Overview and via Life OS routing.
{
  const p="training-12.9.e2e.test.js";let s=read(p);
  s=s.replace('test("Training OS 12.9 plans only after confirmation and is reachable from Life/quick shell"','test("Training OS 12.9 plans only after confirmation and is reachable from Life OS and More"');
  const old=`  await page.evaluate(()=>openModal("ux7QuickSheet"));await expect(page.locator('[data-training129-action="1"]')).toBeVisible();await page.evaluate(()=>closeModal("ux7QuickSheet"));`;
  const neu=`  await expect(page.locator("#training129Editor")).toBeVisible();await page.evaluate(()=>training129OpenRoute());await expect(page.locator("#training129Command")).toBeVisible();`;
  s=replaceOnce(s,old,neu,"training-12.9.e2e Quick Add decoupling");
  write(p,s);changed.push(p);
}

// share-hub.js — Share stays in More / Settings and Android share flows, not Quick Add.
{
  const p="share-hub.js";let s=read(p);
  const start='function share131PatchQuickSheet(){',end='\nfunction ensureShare131Ui(){';
  const i=s.indexOf(start),j=i<0?-1:s.indexOf(end,i);
  if(i<0||j<0)throw new Error("share-hub.js compact Quick Add: function boundary not found");
  s=s.slice(0,i)+"function share131PatchQuickSheet(){}"+s.slice(j);
  write(p,s);changed.push(p);
}

// interface-13.9.css — raise inactive bottom-nav text contrast above WCAG AA.
{
  const p="interface-13.9.css";let s=read(p);
  s=replaceOnce(s,"color:#727c8c;font-size:9.5px;font-weight:620;","color:#768192;font-size:9.5px;font-weight:620;","interface nav contrast");
  write(p,s);changed.push(p);
}

// UX 12.8 static contract — service actions are no longer injected into Quick Add.
{
  const p="ux-12.8.test.js";let s=read(p);
  const old=`for(const action of ["task","inbox","recent","search","import"])assert.ok(js.includes(\`"\${action}"\`),\`missing quick action \${action}\`);`;
  const neu=`assert.ok(js.includes('ux128QuickButton("task","Задача"'),"task quick action missing");
for(const action of ["inbox","recent","search","import"])assert.ok(!js.includes(\`ux128QuickButton("\${action}"\`),\`service action \${action} must stay out of Quick Add\`);`;
  s=replaceOnce(s,old,neu,"ux-12.8.test.js quick actions");
  write(p,s);changed.push(p);
}

// UX 12.8 E2E — compact Quick Add and Recent moved to More hub.
{
  const p="ux-12.8.e2e.test.js";let s=read(p);
  s=s.replace('test("12.8 shell exposes global search, expanded quick actions and Recent"', 'test("12.8 shell exposes global search, focused Quick Add and Recent"');
  const old=`  await page.evaluate(()=>openModal("ux7QuickSheet"));
  for(const action of ["task","inbox","recent","search","import"])await expect(page.locator(\`[data-ux128-action="\${action}"]\`)).toBeVisible();
  await page.evaluate(()=>closeModal("ux7QuickSheet"));

  await page.evaluate(()=>ux128OpenRecent());
  await expect(page.locator("#ux128RecentSheet")).toHaveClass(/open/);
  await expect(page.locator("#ux128RecentList")).toContainText("E2E recent");`;
  const neu=`  await page.evaluate(()=>openModal("ux7QuickSheet"));
  await expect(page.locator('#ux7QuickSheet [data-ux128-action="task"]')).toBeVisible();
  expect(await page.locator("#ux7QuickSheet .ux7-action-grid>button").count()).toBe(8);
  for(const action of ["inbox","recent","search","import"])await expect(page.locator(\`#ux7QuickSheet [data-ux128-action="\${action}"]\`)).toHaveCount(0);
  await page.evaluate(()=>closeModal("ux7QuickSheet"));

  await page.evaluate(()=>ux7Go("more","overview"));
  await page.locator('[data-ui139-action="recent"]').click();
  await expect(page.locator("#ux128RecentSheet")).toHaveClass(/open/);
  await expect(page.locator("#ux128RecentList")).toContainText("E2E recent");`;
  s=replaceOnce(s,old,neu,"ux-12.8.e2e compact Quick Add");
  write(p,s);changed.push(p);
}

// Android UI E2E — 14.0.4 title and regression coverage for the audit fixes.
{
  const p="android-ui-14.e2e.test.js";let s=read(p);
  s=replaceOnce(s,"Life RPG 14\\.0\\.3-rc\\.","Life RPG 14\\.0\\.4-rc\\.","android E2E version");
  // The string replacement above works on the regex source substring inside the file.
  const extra=`

test("Android RC dynamic sheets expose dialog semantics",async({page})=>{
  const errors=await boot(page,390,844);
  await page.locator("#ux128SearchBtn").click();
  const search=page.locator("#ux128SearchSheet");
  await expect(search).toHaveAttribute("role","dialog");
  await expect(search).toHaveAttribute("aria-modal","true");
  await expect(search).toHaveAttribute("aria-hidden","false");
  await page.keyboard.press("Escape");
  await expect(search).toHaveAttribute("aria-hidden","true");

  await page.evaluate(()=>ux7Go("more","overview"));
  await page.locator('[data-ui139-action="recent"]').click();
  const recent=page.locator("#ux128RecentSheet");
  await expect(recent).toHaveAttribute("role","dialog");
  await expect(recent).toHaveAttribute("aria-modal","true");
  await expect(recent).toHaveAttribute("aria-hidden","false");
  expect(errors).toEqual([]);
});

test("Android RC internal tabs use roving keyboard navigation",async({page})=>{
  const errors=await boot(page,390,844);
  await page.evaluate(()=>ux7Go("finance","overview"));
  const overview=page.locator('#finance .ux7-tab[data-view="overview"]');
  const operations=page.locator('#finance .ux7-tab[data-view="operations"]');
  await expect(overview).toHaveAttribute("aria-selected","true");
  await expect(overview).toHaveAttribute("tabindex","0");
  const controls=(await overview.getAttribute("aria-controls")||"").trim().split(/\\s+/).filter(Boolean);
  expect(controls.length).toBeGreaterThan(0);
  for(const id of controls){
    await expect(page.locator("#"+id)).toHaveAttribute("role","tabpanel");
    await expect(page.locator("#"+id)).toHaveAttribute("aria-labelledby",await overview.getAttribute("id"));
  }
  await overview.focus();
  await overview.press("ArrowRight");
  await expect(operations).toHaveAttribute("aria-selected","true");
  await expect(operations).toHaveAttribute("tabindex","0");
  await expect(overview).toHaveAttribute("tabindex","-1");
  expect(await page.evaluate(()=>document.activeElement?.getAttribute("data-view"))).toBe("operations");
  for(const id of controls)await expect(page.locator("#"+id)).toHaveAttribute("aria-labelledby",await operations.getAttribute("id"));
  expect(errors).toEqual([]);
});

test("Android RC Quick Add contains eight entry actions only",async({page})=>{
  const errors=await boot(page,390,844);
  await page.locator("#ux7HeaderQuickAddBtn").click();
  const buttons=page.locator("#ux7QuickSheet .ux7-action-grid>button");
  await expect(buttons).toHaveCount(8);
  await expect(page.locator('#ux7QuickSheet [data-ux128-action="task"]')).toBeVisible();
  await expect(page.locator('#ux7QuickSheet [data-ux128-action="recent"]')).toHaveCount(0);
  await expect(page.locator('#ux7QuickSheet [data-ux128-action="search"]')).toHaveCount(0);
  await expect(page.locator('#ux7QuickSheet [data-ux128-action="import"]')).toHaveCount(0);
  await expect(page.locator("#ux7QuickSheet")).not.toContainText("Можно потратить?");
  expect(errors).toEqual([]);
});
`;
  s=s.trimEnd()+extra;
  write(p,s);changed.push(p);
}

// 14.0.3 contract becomes forward-compatible.
{
  const p="ui-hotfix-14.0.3.test.js";let s=read(p);
  s=replaceOnce(s,'assert.ok(e2e.includes("14\\\\.0\\\\.3-rc"));\nassert.ok(prev.includes("Android targetVersion must be >= 14.0.2"));\nassert.equal(cfg.targetVersion,"14.0.3");',
`assert.ok(prev.includes("Android targetVersion must be >= 14.0.2"));
{
  const v=String(cfg.targetVersion||"").split(".").map(Number);
  assert.ok(v.length===3&&v.every(Number.isInteger)&&(v[0]>14||(v[0]===14&&(v[1]>0||(v[1]===0&&v[2]>=3)))),"Android targetVersion must be >= 14.0.3");
}`, "14.0.3 forward compatibility");
  write(p,s);changed.push(p);
}

// Release target -> 14.0.4, schema remains v18.
{
  const p="android-release-config.json";
  const cfg=JSON.parse(read(p));
  if(cfg.targetVersion!=="14.0.3") throw new Error(`Unexpected current Android targetVersion: ${cfg.targetVersion}`);
  cfg.targetVersion="14.0.4";
  cfg.channel="rc";
  cfg.stateVersion=18;
  cfg.androidShareEnabled=false;
  cfg.notes="Android 14.0.4 RC: audited UI accessibility, keyboard tabs, stronger bottom-nav contrast and focused Quick Add.";
  write(p,JSON.stringify(cfg,null,2)+"\n");changed.push(p);
}
{
  const p="release-readiness-14.0.test.js";let s=read(p);
  s=replaceOnce(s,'assert.equal(cfg.targetVersion,"14.0.3");','assert.equal(cfg.targetVersion,"14.0.4");',"release readiness version");
  write(p,s);changed.push(p);
}
{
  const p="android-release-gate.test.js";let s=read(p);
  s=replaceOnce(s,'assert.equal(cfg.targetVersion,"14.0.3");','assert.equal(cfg.targetVersion,"14.0.4");',"release gate config version");
  s=replaceOnce(s,'assert.match(meta.versionName,/^14\\.0\\.3-rc\\.\\d+$/);','assert.match(meta.versionName,/^14\\.0\\.4-rc\\.\\d+$/);',"release gate versionName");
  s=replaceOnce(s,'assert.ok(meta.versionCode>14000217,"14.0.3 RC must update over installed 14.0.2 RC run 17");',
                  'assert.ok(meta.versionCode>14000319,"14.0.4 RC must update over installed 14.0.3 RC run 19");',"release gate versionCode");
  write(p,s);changed.push(p);
}

// New regression contract.
{
  const p="ui-audit-hotfix-14.0.4.test.js";
  const content=`"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const read=f=>fs.readFileSync(f,"utf8");
const ui=read("ui.js"),ux=read("ux-12.8.js"),training=read("training-os.js"),share=read("share-hub.js"),css=read("interface-13.9.css"),e2e=read("android-ui-14.e2e.test.js"),trainingE2e=read("training-12.9.e2e.test.js"),prev=read("ui-hotfix-14.0.3.test.js"),pkg=JSON.parse(read("package.json")),cfg=JSON.parse(read("android-release-config.json"));

for(const token of ["function prepareModalAccessibility","aria-modal","aria-labelledby","function ux7BindTabKeyboard","ArrowRight","ArrowLeft","aria-controls","tabIndex=on?0:-1",'data-ui139-action="recent"'])
  assert.ok(ui.includes(token),\`14.0.4 UI accessibility token missing: \${token}\`);

assert.ok(ux.includes('ux128QuickButton("task","Задача"'),"Quick Add task action missing");
for(const action of ["inbox","recent","search","import"])assert.ok(!ux.includes(\`ux128QuickButton("\${action}"\`),\`service action \${action} leaked into Quick Add\`);
assert.ok(!ui.includes("Можно потратить?</span></button>"),"decision action must not remain in Quick Add");
assert.ok(training.includes("function training129PatchQuick(){}"),"Training OS must not inject Quick Add action");
assert.ok(share.includes("function share131PatchQuickSheet(){}"),"Share Hub must not inject Quick Add action");
assert.ok(!training.includes("data-training129-action"),"Training OS Quick Add marker must be removed");
assert.ok(!share.includes("data-share131-action"),"Share Hub Quick Add marker must be removed");
assert.ok(trainingE2e.includes("reachable from Life OS and More"),"Training E2E must cover the retained navigation path");

const m=css.match(/\\.ui82\\.ui139 \\.navbtn\\{[\\s\\S]*?color:(#[0-9a-f]{6})/i);assert.ok(m,"bottom nav color not found");
function rgb(h){return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255)}
function lum(h){const f=x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4,[r,g,b]=rgb(h).map(f);return .2126*r+.7152*g+.0722*b}
function contrast(a,b){const x=lum(a),y=lum(b),hi=Math.max(x,y),lo=Math.min(x,y);return (hi+.05)/(lo+.05)}
assert.ok(contrast(m[1],"#0f1218")>=4.5,\`bottom-nav contrast below AA: \${contrast(m[1],"#0f1218")}\`);

assert.ok(e2e.includes("dynamic sheets expose dialog semantics"));
assert.ok(e2e.includes("internal tabs use roving keyboard navigation"));
assert.ok(e2e.includes("Quick Add contains eight entry actions only"));
assert.ok(prev.includes("Android targetVersion must be >= 14.0.3"));
assert.equal(cfg.targetVersion,"14.0.4");
assert.equal(cfg.channel,"rc");
assert.equal(cfg.stateVersion,18);
assert.ok(pkg.scripts.test.includes("ui-audit-hotfix-14.0.4.test.js"));

console.log("OK — Life RPG 14.0.4 audited UI hotfix contract passed");
`;
  write(p,content);changed.push(p);
}

// package test chain.
{
  const p="package.json";const pkg=JSON.parse(read(p));
  if(!pkg.scripts?.test?.includes("ui-audit-hotfix-14.0.4.test.js"))pkg.scripts.test += " && node ui-audit-hotfix-14.0.4.test.js";
  write(p,JSON.stringify(pkg,null,2)+"\n");changed.push(p);
}

// Marker.
{
  const p="UI-AUDIT-HOTFIX-14.0.4.md";
  const content=`# Life RPG 14.0.4 — audited interface hotfix

Scope: interface and accessibility only. State schema remains v18.

Changes:
- dynamic Search / Recent / other late-created sheets receive dialog semantics on open;
- internal section tabs retain tab semantics, gain aria-controls / tabpanel linkage, roving tabindex and Arrow/Home/End keyboard navigation;
- inactive bottom-navigation text contrast is raised above WCAG AA 4.5:1 against Android nav background;
- Quick Add is reduced to eight entry-oriented actions across the full PWA runtime and Android;
- Training OS no longer injects "ОФП / кардио" into Quick Add; it remains in More / Overview and Life OS routing;
- Share Hub no longer injects "Share Inbox" into Quick Add; it remains in More / Settings and the native/share flows;
- Search stays in the header, Recent moves to More / Overview, Import stays in More / Settings, Inbox remains on Today, and "Can I spend?" remains in Money;
- Android target becomes 14.0.4 RC without state migration.

Acceptance:
- full npm regression;
- production build and dist audit;
- full Playwright E2E;
- Android UI E2E including dynamic dialog semantics, keyboard tabs and Quick Add cardinality;
- Android source gates and release gate on the next RC build.
`;
  write(p,content);changed.push(p);
}

// Final self-checks before workflow tests.
const cfg=JSON.parse(read("android-release-config.json"));
if(!versionAtLeast(cfg.targetVersion,14,0,4)) throw new Error("14.0.4 target was not applied");
for(const p of changed) if(!fs.existsSync(p)) throw new Error(`Missing changed file ${p}`);
console.log(`Applied Life RPG 14.0.4 audited UI hotfix to ${changed.length} files:`);
for(const p of changed) console.log(`- ${p}`);
