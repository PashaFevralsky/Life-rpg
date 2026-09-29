import { test, expect } from "@playwright/test";

async function boot(page,width=390){
  await page.setViewportSize({width,height:844});
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await expect(page.locator("body")).toHaveClass(/ui139/);
}

test("13.9 mobile interface: compact chrome, visible navigation and touch-safe controls",async({page})=>{
  await boot(page,390);
  await expect(page).toHaveTitle(/Life RPG 13\.9\.1/);

  const todayTop=await page.locator(".top").evaluate(el=>getComputedStyle(el).display);
  expect(todayTop).not.toBe("none");

  const quick=await page.locator("#today .quick").evaluate(el=>({
    display:getComputedStyle(el).display,
    client:el.clientWidth,
    scroll:el.scrollWidth,
    height:el.getBoundingClientRect().height,
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
  }));
  expect(quick.display).toBe("flex");
  expect(quick.scroll).toBeGreaterThan(quick.client);
  expect(quick.height).toBeLessThan(90);
  expect(quick.overflow).toBeLessThanOrEqual(1);

  await page.evaluate(()=>ux7Go("finance","overview"));
  await page.waitForTimeout(80);

  const finance=await page.evaluate(()=>{
    const top=document.querySelector(".top"),head=document.querySelector("#finance .ux7-section-head"),
          tabs=document.querySelector("#finance .ux7-tabs"),buttons=[...tabs.querySelectorAll(".ux7-tab")],
          bottom=document.querySelector(".bottom");
    const boxes=buttons.map(b=>b.getBoundingClientRect());
    return {
      topDisplay:getComputedStyle(top).display,
      headPosition:getComputedStyle(head).position,
      tabDisplay:getComputedStyle(tabs).display,
      tabColumns:getComputedStyle(tabs).gridTemplateColumns.split(" ").filter(Boolean).length,
      tabsVisible:boxes.filter(r=>r.width>0&&r.height>0&&r.left>=-1&&r.right<=document.documentElement.clientWidth+1).length,
      bottomHeight:bottom.getBoundingClientRect().height,
      bodyOverflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-document.documentElement.clientWidth
    };
  });
  expect(finance.topDisplay).toBe("none");
  expect(finance.headPosition).toBe("sticky");
  expect(finance.tabDisplay).toBe("grid");
  expect(finance.tabColumns).toBe(4);
  expect(finance.tabsVisible).toBe(4);
  expect(finance.bottomHeight).toBeLessThanOrEqual(72);
  expect(finance.bodyOverflow).toBeLessThanOrEqual(1);

  await page.evaluate(()=>ux7Go("work","overview"));
  await page.waitForTimeout(60);
  const workRail=await page.locator("#work .work-hero .kpi-row").evaluate(el=>({
    display:getComputedStyle(el).display,
    height:el.getBoundingClientRect().height
  }));
  expect(workRail.display).toBe("flex");
  expect(workRail.height).toBeLessThan(100);

  await page.evaluate(()=>ux7Go("finance","overview"));
  await page.waitForTimeout(60);
  const nav=page.locator('.navbtn[data-tab="finance"]');
  await expect(nav).toHaveAttribute("aria-current","page");
  await expect(page.locator("#finance .ux7-tab.active")).toContainText("Сейчас");

  await expect(page.locator("#finance .ux7-section-shortcuts")).toHaveCount(0);
  await expect(page.locator("#finance .ux7-tab")).toHaveCount(4);

  await page.evaluate(()=>{window.scrollTo(0,160);window.dispatchEvent(new Event("scroll"))});
  await page.waitForTimeout(60);
  await expect(page.locator("body")).toHaveClass(/ui139-scrolled/);
  await page.evaluate(()=>window.scrollTo(0,0));

  await page.evaluate(()=>ux7Go("more","overview"));
  await page.waitForTimeout(90);
  await expect(page.locator("#more .ui139-more-hub")).toBeVisible();
  expect(await page.locator("#more .ui139-hub-row").count()).toBeGreaterThanOrEqual(6);

  await page.evaluate(()=>ux7Go("finance","analysis"));
  await page.waitForTimeout(60);
  await page.waitForTimeout(60);
  await expect(page.locator(".ui-polish-model-note").first()).toBeVisible();
  await expect(page.locator(".ui-polish-chart-details")).toHaveCount(1);
  const chart=await page.locator("#finance .cashflow-chart").first().evaluate(el=>el.getBoundingClientRect().height);
  expect(chart).toBeLessThanOrEqual(150);
});
