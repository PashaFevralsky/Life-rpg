import { test, expect } from "@playwright/test";

async function boot(page){
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  await expect(page.locator("#versionStatus")).toContainText("13.2.2");
  return errors
}

test("GPT Exchange exports locally and safely imports tasks/calendar",async({page})=>{
  const errors=await boot(page);
  await page.evaluate(()=>{switchTab("more");ux7SetView("more","overview",false)});
  await expect(page.locator("#gpt135Card")).toBeVisible();
  await expect(page.locator("#ai134Card")).toHaveCount(0);
  expect(await page.evaluate(()=>typeof ai134Ask)).toBe("undefined");

  const today=await page.evaluate(()=>localDateKey()),tomorrow=await page.evaluate(()=>localDateKey(addDays(new Date(),1)));
  const payload={
    format:"life-rpg-gpt-response-v1",version:1,packageId:"pkg-e2e",generatedAt:new Date().toISOString(),
    summary:"E2E GPT plan",
    tasks:[{title:"GPT E2E задача",area:"Работа",priority:1,plannedDate:today,dueDate:"",notBefore:"",minutes:25,note:"test"}],
    calendar:[{title:"GPT E2E событие",type:"Работа",dateKey:tomorrow,minutes:30,priority:2,note:"test"}],
    recommendations:[{area:"Работа",title:"E2E recommendation",detail:"test"}],assumptions:[]
  };
  await page.locator("#gpt135ImportFile").setInputFiles({
    name:"gpt-response.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(payload))
  });
  await expect(page.locator("#gpt135Preview")).toContainText("E2E GPT plan");
  await expect(page.locator("#gpt135Preview")).toContainText("GPT E2E задача");
  await expect(page.locator("#gpt135Preview")).toContainText("GPT E2E событие");

  page.once("dialog",dialog=>dialog.accept());
  await page.locator("#gpt135ApplyBtn").click();
  await expect(page.locator("#gpt135Last")).toContainText("E2E GPT plan");
  expect(await page.evaluate(()=>taskActive().some(x=>x.title==="GPT E2E задача"))).toBe(true);
  expect(await page.evaluate(()=>calendarManualEvents().some(x=>x.title==="GPT E2E событие"))).toBe(true);
  expect(errors).toEqual([])
});

test("GPT Exchange package download contains no backend dependency",async({page})=>{
  await boot(page);
  await page.evaluate(()=>{switchTab("more");ux7SetView("more","overview",false)});
  await page.locator("#gpt135Question").fill("Составь план на сегодня");
  const downloadPromise=page.waitForEvent("download");
  await page.locator("#gpt135ExportBtn").click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^life-rpg-gpt-context-\d{4}-\d{2}-\d{2}\.json$/);
});
