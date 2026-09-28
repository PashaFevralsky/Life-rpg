import { test, expect } from "@playwright/test";

async function boot(page){
  await page.setViewportSize({width:390,height:844});
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
}

test("13.8.0 release: native reportStart boundary and integrated mobile UI",async({page})=>{
  await boot(page);
  await expect(page).toHaveTitle(/Life RPG 13\.8\.0/);

  const runtime=await page.evaluate(()=>({
    version:APP_VERSION,
    oldHotfix:[...document.scripts].some(s=>/report-start-hotfix|ui-polish-13\.7\.5/.test(s.src)),
    core:typeof reportStartKey==="function"&&typeof reportingDateAllowed==="function"
  }));
  expect(runtime.version).toBe("13.8.0");
  expect(runtime.oldHotfix).toBe(false);
  expect(runtime.core).toBe(true);

  await page.evaluate(()=>{
    const start=new Date();
    start.setMonth(start.getMonth()+1,1);
    S.settings.reportStart=localDateKey(start);
    S.settings.campaignStart=localDateKey(start);
    S.settings.monthlyDebtGoal=91000;
    S.envelopeLimits={"Еда":17000,"Транспорт":10000,"Дом":0,"Связь":2000,"Развлечения":1000,"Теннис":9000,"Покупки":2000,"Другое":8000};
    switchTab("finance");
    ux7SetView("finance","analysis",false);
    render();
  });
  await page.waitForTimeout(100);

  const pre=await page.evaluate(()=>({
    extra:plannedExtraDebtOnDate(new Date()),
    living:projectedDailyLiving(new Date()),
    phase:financialPhase().id,
    need:document.getElementById("finNeed")?.textContent||""
  }));
  expect(pre.extra).toBe(0);
  expect(pre.living).toBe(0);
  expect(pre.phase).toBe("scheduled");
  expect(pre.need).toContain("Старт");

  const nav=await page.locator("#finance .ux7-tabs").evaluate(el=>({
    display:getComputedStyle(el).display,
    count:el.querySelectorAll(".ux7-tab").length
  }));
  expect(nav.display).toBe("grid");
  expect(nav.count).toBe(6);
  await expect(page.locator(".ui-polish-model-note").first()).toBeVisible();
  await expect(page.locator(".ui-polish-chart-details")).toHaveCount(1);
});
