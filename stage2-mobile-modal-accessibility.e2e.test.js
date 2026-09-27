import { test, expect } from "@playwright/test";

async function boot(page,width=390,height=600){
  await page.setViewportSize({width,height});
  const errors=[];
  page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  return errors;
}

test("Stage 2.11 modal browser gate: focus trap, Escape restore and scroll lock",async({page})=>{
  const errors=await boot(page,390,600);

  const trigger=page.locator("#ux128SearchBtn");
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await page.evaluate(()=>openModal("expenseModal"));

  const modal=page.locator("#expenseModal");
  await expect(modal).toHaveClass(/open/);
  await expect(modal).toHaveAttribute("aria-hidden","false");
  await expect(page.locator("html")).toHaveClass(/modal-open/);
  await expect(page.locator("body")).toHaveClass(/modal-open/);

  const overflow=await page.evaluate(()=>({
    html:getComputedStyle(document.documentElement).overflow,
    body:getComputedStyle(document.body).overflow
  }));
  expect(overflow.html).toBe("hidden");
  expect(overflow.body).toBe("hidden");

  const focusable=modal.locator('button:not([disabled]),[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
  const count=await focusable.count();
  expect(count).toBeGreaterThan(1);

  const first=focusable.first(),last=focusable.last();
  await first.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(last).toBeFocused();

  await last.focus();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(modal).not.toHaveClass(/open/);
  await expect(modal).toHaveAttribute("aria-hidden","true");
  await expect(page.locator("html")).not.toHaveClass(/modal-open/);
  await expect(page.locator("body")).not.toHaveClass(/modal-open/);
  await expect(trigger).toBeFocused();

  expect(errors).toEqual([]);
});

test("Stage 2.11 modal browser gate: reduced mobile viewport keeps sheet usable",async({page})=>{
  const errors=await boot(page,360,480);
  await page.evaluate(()=>openModal("readingModal"));

  const card=page.locator("#readingModal .modal-card");
  await expect(card).toBeVisible();

  const geometry=await card.evaluate(el=>{
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return {
      top:r.top,
      bottom:r.bottom,
      height:r.height,
      viewport:window.innerHeight,
      maxHeight:s.maxHeight,
      overflowY:s.overflowY,
      scrollHeight:el.scrollHeight,
      clientHeight:el.clientHeight
    };
  });

  expect(geometry.top).toBeGreaterThanOrEqual(-1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewport+1);
  expect(geometry.height).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.maxHeight).toMatch(/px$/);
  expect(["auto","scroll"]).toContain(geometry.overflowY);
  expect(geometry.scrollHeight).toBeGreaterThanOrEqual(geometry.clientHeight);

  await page.locator("#readApply").focus();
  const focusedInside=await page.evaluate(()=>document.querySelector("#readingModal")?.contains(document.activeElement));
  expect(focusedInside).toBe(true);

  await page.keyboard.press("Escape");
  await expect(page.locator("#readingModal")).not.toHaveClass(/open/);
  expect(errors).toEqual([]);
});
