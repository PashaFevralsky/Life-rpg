import { test, expect } from "@playwright/test";

async function boot(page){const errors=[];page.on("pageerror",e=>errors.push(String(e)));await page.goto("/",{waitUntil:"domcontentloaded"});await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);await page.evaluate(()=>{switchTab("more");ux7SetView("more","settings",false)});return errors}

test("Share Hub 13.1 captures text into Inbox",async({page})=>{
  const errors=await boot(page);await expect(page.locator("#share131Command")).toBeVisible();await page.locator("#share131Text").fill("E2E share inbox https://example.com");await page.getByRole("button",{name:"В Inbox"}).click();
  await expect.poll(()=>page.evaluate(()=>(S.entities?.inbox||[]).some(x=>String(x.text||"").includes("E2E share inbox")))).toBe(true);expect(errors).toEqual([])
});

test("Share Hub 13.1 previews and imports ICS without duplicate writes",async({page})=>{
  const errors=await boot(page);page.on("dialog",d=>d.accept());const ics=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:e2e-131\r\nDTSTART;VALUE=DATE:20261003\r\nSUMMARY:E2E теннис 13.1\r\nDESCRIPTION:Групповая тренировка\r\nDURATION:PT90M\r\nEND:VEVENT\r\nEND:VCALENDAR`;
  await page.locator("#share131File").setInputFiles({name:"e2e-calendar.ics",mimeType:"text/calendar",buffer:Buffer.from(ics)});await expect(page.locator("#share131Queue")).toContainText("e2e-calendar.ics");await page.getByRole("button",{name:"ICS preview"}).click();await expect(page.locator("#share131IcsPreview")).toContainText("E2E теннис 13.1");await page.getByRole("button",{name:"Добавить в Calendar OS"}).click();
  await expect.poll(()=>page.evaluate(()=>calendarManualEvents().filter(x=>x.title==="E2E теннис 13.1").length)).toBe(1);expect(errors).toEqual([])
});
