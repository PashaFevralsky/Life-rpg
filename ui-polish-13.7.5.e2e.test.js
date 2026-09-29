import { test, expect } from "@playwright/test";

async function boot(page){
  await page.setViewportSize({width:390,height:844});
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/)
}

test("13.7.5 UI polish: finance navigation is fully visible and forecast is compact",async({page})=>{
  await boot(page);
  await page.evaluate(()=>{switchTab("finance");ux7SetView("finance","analysis",false)});
  await page.waitForTimeout(80);

  const nav=await page.locator("#finance .ux7-tabs").evaluate(el=>{
    const r=el.getBoundingClientRect(),buttons=[...el.querySelectorAll(".ux7-tab")].map(b=>{
      const x=b.getBoundingClientRect();return {left:x.left,right:x.right,top:x.top,bottom:x.bottom,text:b.textContent.trim()}
    });
    return {display:getComputedStyle(el).display,left:r.left,right:r.right,buttons}
  });
  expect(nav.display).toBe("grid");
  expect(nav.buttons).toHaveLength(4);
  expect(nav.buttons.filter(x=>x.left<nav.left-1||x.right>nav.right+1)).toEqual([]);

  const active=await page.locator('#finance .ux7-tab[data-view="analysis"]').getAttribute("aria-selected");
  expect(active).toBe("true");

  const bottomHeight=await page.locator(".bottom").evaluate(el=>el.getBoundingClientRect().height);
  expect(bottomHeight).toBeLessThanOrEqual(72);

  await expect(page.locator("#cashFlowSummary").locator("xpath=preceding-sibling::*[1]")).toContainText("Расчётная модель");
  await expect(page.locator(".ui-polish-chart-details")).toHaveCount(1);
  await expect(page.locator(".ui-polish-chart-details")).not.toHaveAttribute("open",/.+/);

  const chartHeight=await page.locator("#finance .cashflow-chart").evaluate(el=>parseFloat(getComputedStyle(el).height));
  expect(chartHeight).toBeLessThanOrEqual(150);
});
