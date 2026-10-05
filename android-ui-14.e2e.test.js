import { test, expect } from "@playwright/test";
import fs from "node:fs";

/* Android RC UI gate.
   Covers all five sections at 360–430px, fixed bottom navigation clearance,
   deterministic tabs, sticky chrome, horizontal containment and modal geometry. */

const androidCfg=JSON.parse(fs.readFileSync("android-release-config.json","utf8"));
const androidVersionRe=new RegExp(`Life RPG ${String(androidCfg.targetVersion).replace(/\./g,"\\.")}-rc\\.\\d+$`);

const widths=[360,390,412,430];
const views={
  today:["focus","progress"],
  finance:["overview","operations","debts","analysis"],
  work:["overview","crm","log"],
  tennis:["overview","training","analytics"],
  more:["overview","knowledge","rewards","settings"]
};
const expectedTabs={today:2,finance:4,work:3,tennis:3,more:4};

async function boot(page,width=390,height=844){
  await page.setViewportSize({width,height});
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await expect(page.locator("body")).toHaveClass(/ui139/);
  await expect(page).toHaveTitle(androidVersionRe);
  return errors;
}

async function geometry(page){
  return page.evaluate(()=>{
    const visible=el=>{
      if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();
      return s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0
    };
    const vw=document.documentElement.clientWidth,bottom=document.querySelector(".bottom"),br=bottom?.getBoundingClientRect();
    const bodyOverflow=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-vw;
    const offenders=[...document.querySelectorAll(".section.active .card,.section.active .btn,.section.active input,.section.active select,.section.active textarea,.section.active .ux7-tab,.bottom")]
      .filter(visible).map(el=>{const r=el.getBoundingClientRect();return {el,r}})
      .filter(x=>x.r.left<-1||x.r.right>vw+1)
      .map(x=>({tag:x.el.tagName,id:x.el.id||"",className:String(x.el.className||""),left:Math.round(x.r.left),right:Math.round(x.r.right)}));
    return {
      bodyOverflow,offenders,
      bottom:br?{top:br.top,left:br.left,right:br.right,height:br.height}:null,
      bottomBackground:bottom?getComputedStyle(bottom).backgroundColor:""
    }
  })
}

for(const width of widths){
  test(`Android RC all five sections fit ${width}px`,async({page})=>{
    const errors=await boot(page,width,900);

    for(const [section,sectionViews] of Object.entries(views)){
      for(const view of sectionViews){
        await page.evaluate(([s,v])=>ux7Go(s,v),[section,view]);
        await page.waitForTimeout(35);

        const g=await geometry(page);
        expect(g.bodyOverflow,`${section}/${view}: page-level horizontal overflow`).toBeLessThanOrEqual(1);
        expect(g.offenders,`${section}/${view}: controls outside viewport`).toEqual([]);
        expect(g.bottom?.left??0,`${section}/${view}: bottom navigation left`).toBeGreaterThanOrEqual(-1);
        expect(g.bottom?.right??width,`${section}/${view}: bottom navigation right`).toBeLessThanOrEqual(width+1);
        expect(g.bottom?.height??999,`${section}/${view}: bottom navigation height`).toBeLessThanOrEqual(86);

        const tabs=await page.locator(`#${section}>.ux7-section-head .ux7-tabs`).evaluate(el=>({
          display:getComputedStyle(el).display,
          columns:getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length,
          overflowX:getComputedStyle(el).overflowX
        }));
        expect(tabs.display,`${section}: tabs must be grid`).toBe("grid");
        expect(tabs.columns,`${section}: visible tab columns`).toBe(expectedTabs[section]);
        expect(["visible","clip"],`${section}: tabs should not require horizontal discovery`).toContain(tabs.overflowX);
      }

      await page.evaluate(([s,v])=>ux7Go(s,v),[section,sectionViews[0]]);
      await page.evaluate(()=>window.scrollTo(0,Math.max(document.body.scrollHeight,document.documentElement.scrollHeight)));
      await page.waitForTimeout(40);

      const end=await page.evaluate(()=>{
        const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0};
        const bottom=document.querySelector(".bottom")?.getBoundingClientRect();
        const cards=[...document.querySelectorAll(".section.active .ux7-card")].filter(visible);
        const last=cards.at(-1)?.getBoundingClientRect();
        return {navTop:bottom?.top??innerHeight,lastBottom:last?.bottom??0}
      });
      expect(end.lastBottom,`${section}: final card must scroll above bottom navigation`).toBeLessThanOrEqual(end.navTop-24);
      await page.evaluate(()=>window.scrollTo(0,0));
    }

    const bg=await page.locator(".bottom").evaluate(el=>getComputedStyle(el).backgroundColor);
    expect(bg,"bottom navigation must be opaque").toMatch(/^rgb\(/);
    expect(errors).toEqual([]);
  })
}

test("Android RC sticky header remains opaque and compact while scrolling",async({page})=>{
  const errors=await boot(page,390,844);
  for(const section of ["finance","work","tennis","more"]){
    await page.evaluate(s=>ux7Go(s,"overview"),section);
    await page.evaluate(()=>window.scrollTo(0,220));
    await page.waitForTimeout(35);
    const h=await page.locator(`#${section}>.ux7-section-head`).evaluate(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return {top:r.top,height:r.height,background:s.backgroundColor,position:s.position,headCopyDisplay:getComputedStyle(el.querySelector(".ux7-head-copy")).display}
    });
    expect(h.position).toBe("sticky");
    expect(h.top).toBeGreaterThanOrEqual(-1);
    expect(h.height).toBeLessThanOrEqual(90);
    expect(h.headCopyDisplay).toBe("none");
    expect(h.background).toMatch(/^rgb\(/);
    await page.evaluate(()=>window.scrollTo(0,0));
  }
  expect(errors).toEqual([]);
});

test("Android RC modal stays usable at keyboard-like 360x480 viewport",async({page})=>{
  const errors=await boot(page,360,480);
  for(const id of ["expenseModal","incomeModal","paymentModal","readingModal"]){
    if(!(await page.locator("#"+id).count()))continue;
    await page.evaluate(id=>openModal(id),id);
    await page.waitForTimeout(25);

    const card=page.locator(`#${id} .modal-card`);
    const geom=await card.evaluate(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return {top:r.top,bottom:r.bottom,height:r.height,overflowY:s.overflowY,viewport:innerHeight}
    });
    expect(geom.top,`${id}: modal top`).toBeGreaterThanOrEqual(-1);
    expect(geom.bottom,`${id}: modal bottom`).toBeLessThanOrEqual(geom.viewport+1);
    expect(geom.height,`${id}: modal height`).toBeLessThanOrEqual(geom.viewport+1);
    expect(["auto","scroll"],`${id}: modal must scroll`).toContain(geom.overflowY);

    const close=page.locator(`#${id} .close`).first();
    if(await close.count()){
      const box=await close.boundingBox();
      expect(box?.width??0,`${id}: close touch width`).toBeGreaterThanOrEqual(44);
      expect(box?.height??0,`${id}: close touch height`).toBeGreaterThanOrEqual(44)
    }

    const field=page.locator(`#${id} input:not([type="hidden"]),#${id} select,#${id} textarea`).first();
    if(await field.count()){
      await field.focus();
      await field.evaluate(el=>el.scrollIntoView({block:"center"}));
      const r=await field.boundingBox();
      expect(r?.y??0,`${id}: focused field top`).toBeGreaterThanOrEqual(-1);
      expect((r?.y??0)+(r?.height??0),`${id}: focused field visible`).toBeLessThanOrEqual(481)
    }

    await page.evaluate(id=>closeModal(id),id)
  }
  expect(errors).toEqual([]);
});

test("Android RC FAB appears only on data-entry views and never covers overview cards",async({page})=>{
  const errors=await boot(page,390,844);

  const hidden=[
    ["today","focus"],
    ["finance","overview"],["finance","operations"],["finance","debts"],["finance","analysis"],
    ["work","overview"],
    ["tennis","overview"],["tennis","analytics"],
    ["more","overview"],["more","settings"]
  ];
  for(const [section,view] of hidden){
    await page.evaluate(([s,v])=>ux7Go(s,v),[section,view]);
    await expect(page.locator("#ux7Fab"),`${section}/${view}: FAB must not cover read-only content`).toBeHidden();
  }

  const visible=[
    ["work","crm"],["work","log"],
    ["tennis","training"],
    ["more","knowledge"],["more","rewards"]
  ];
  for(const [section,view] of visible){
    await page.evaluate(([s,v])=>ux7Go(s,v),[section,view]);
    await expect(page.locator("#ux7Fab"),`${section}/${view}: data-entry FAB should remain available`).toBeVisible();
  }

  expect(errors).toEqual([]);
});


test("Android RC top action buttons share one visual geometry",async({page})=>{
  const errors=await boot(page,390,844);
  const actions=await page.locator(".top-actions>.iconbtn").evaluateAll(nodes=>nodes
    .filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return !el.hidden&&s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0})
    .map(el=>{
      const r=el.getBoundingClientRect(),icon=el.querySelector("svg,i"),ir=icon?.getBoundingClientRect();
      return {width:r.width,height:r.height,fontSize:parseFloat(getComputedStyle(el).fontSize)||0,iconWidth:ir?.width||0,iconHeight:ir?.height||0}
    }));
  expect(actions.length,"Today header should expose visible actions").toBeGreaterThanOrEqual(2);
  for(const a of actions){
    expect(a.width,"header action width").toBeGreaterThanOrEqual(47);
    expect(a.width,"header action width").toBeLessThanOrEqual(49);
    expect(a.height,"header action height").toBeGreaterThanOrEqual(47);
    expect(a.height,"header action height").toBeLessThanOrEqual(49);
    expect(a.fontSize,"text-icon visual size").toBeGreaterThanOrEqual(18);
    expect(a.fontSize,"text-icon visual size").toBeLessThanOrEqual(20);
    if(a.iconWidth){
      expect(a.iconWidth,"SVG/icon width").toBeGreaterThanOrEqual(19);
      expect(a.iconWidth,"SVG/icon width").toBeLessThanOrEqual(21);
      expect(a.iconHeight,"SVG/icon height").toBeGreaterThanOrEqual(19);
      expect(a.iconHeight,"SVG/icon height").toBeLessThanOrEqual(21);
    }
  }
  expect(errors).toEqual([]);
});


test("Android RC mobile header exposes search and Quick Add only",async({page})=>{
  const errors=await boot(page,390,844);
  const actions=await page.locator(".top-actions>.iconbtn").evaluateAll(nodes=>nodes
    .filter(el=>{
      const s=getComputedStyle(el),r=el.getBoundingClientRect();
      return !el.hidden&&s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0;
    })
    .map(el=>{
      const r=el.getBoundingClientRect(),icon=el.querySelector("svg,i"),ir=icon?.getBoundingClientRect();
      return {
        id:el.id,
        width:r.width,height:r.height,
        iconWidth:ir?.width||0,iconHeight:ir?.height||0
      };
    }));

  expect(actions.map(x=>x.id),"mobile Today header actions").toEqual(["ux128SearchBtn","ux7HeaderQuickAddBtn"]);

  for(const a of actions){
    expect(a.width,"header action width").toBeGreaterThanOrEqual(47);
    expect(a.width,"header action width").toBeLessThanOrEqual(49);
    expect(a.height,"header action height").toBeGreaterThanOrEqual(47);
    expect(a.height,"header action height").toBeLessThanOrEqual(49);
    expect(a.iconWidth,"header icon width").toBeGreaterThanOrEqual(19);
    expect(a.iconWidth,"header icon width").toBeLessThanOrEqual(21);
    expect(a.iconHeight,"header icon height").toBeGreaterThanOrEqual(19);
    expect(a.iconHeight,"header icon height").toBeLessThanOrEqual(21);
  }

  await page.locator("#ux7HeaderQuickAddBtn").click();
  await expect(page.locator("#ux7QuickSheet")).toHaveClass(/open/);
  expect(errors).toEqual([]);
});

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
  const controls=(await overview.getAttribute("aria-controls")||"").trim().split(/\s+/).filter(Boolean);
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
