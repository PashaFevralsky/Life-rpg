import { test, expect } from '@playwright/test';

async function boot(page){
  await page.setViewportSize({width:390,height:844});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('html')).not.toHaveClass(/life-rpg-booting/);
  await expect.poll(()=>page.evaluate(()=>globalThis.LifeTabSwipe14?.isReady?.()===true)).toBe(true);
}
async function gesture(page,selector,{x1=300,y1=520,x2=210,y2=525,duration=100,wait=380}={}){
  await page.evaluate(({selector,x1,y1,x2,y2,duration})=>new Promise(resolve=>{
    const el=document.querySelector(selector);if(!el)throw new Error(`target not found: ${selector}`);
    const init=(x,y)=>({bubbles:true,cancelable:true,pointerId:71,pointerType:'touch',isPrimary:true,clientX:x,clientY:y});
    el.dispatchEvent(new PointerEvent('pointerdown',init(x1,y1)));
    setTimeout(()=>{el.dispatchEvent(new PointerEvent('pointerup',init(x2,y2)));resolve()},duration);
  }),{selector,x1,y1,x2,y2,duration});
  if(wait)await page.waitForTimeout(wait);
}
async function view(page){return page.evaluate(()=>({section:document.body.dataset.section,view:document.body.dataset.view}))}

test('swipe changes only sub-tabs inside the current main section',async({page})=>{
  await boot(page);
  await page.evaluate(()=>ux7Go('finance','overview'));
  await page.waitForTimeout(100);
  await gesture(page,'#finance .ux7-card:not(.ux7-hidden)',{x1:310,x2:220});
  expect(await view(page)).toEqual({section:'finance',view:'operations'});
  await gesture(page,'#finance .ux7-card:not(.ux7-hidden)',{x1:310,x2:220});
  expect(await view(page)).toEqual({section:'finance',view:'debts'});
  await gesture(page,'#finance .ux7-card:not(.ux7-hidden)',{x1:80,x2:175});
  expect(await view(page)).toEqual({section:'finance',view:'operations'});
});

test('swipe transition delays the view switch and then settles cleanly',async({page})=>{
  await page.clock.install();
  await boot(page);
  await page.evaluate(()=>ux7Go('finance','overview'));
  await page.waitForTimeout(100);

  await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.evaluate(()=>{
    const el=document.querySelector('#finance .ux7-card:not(.ux7-hidden)');
    const init=x=>({bubbles:true,cancelable:true,pointerId:71,pointerType:'touch',isPrimary:true,clientX:x,clientY:520});
    el.dispatchEvent(new PointerEvent('pointerdown',init(310)));
    el.dispatchEvent(new PointerEvent('pointerup',init(220)));
  });
  expect(await page.evaluate(()=>LifeTabSwipe14.isTransitioning())).toBe(true);
  expect((await view(page)).view).toBe('overview');
  await page.clock.runFor(89);
  expect((await view(page)).view).toBe('overview');
  // Chrome dataset is synchronized on the next animation frame after leaveMs.
  await page.clock.runFor(36);
  expect((await view(page)).view).toBe('operations');
  await page.clock.runFor(250);
  expect(await page.evaluate(()=>LifeTabSwipe14.isTransitioning())).toBe(false);
  await expect(page.locator('#finance')).not.toHaveClass(/life-tab-swipe-transitioning/);
});

test('swipe never wraps past first or last sub-tab',async({page})=>{
  await boot(page);
  await page.evaluate(()=>ux7Go('work','overview'));await page.waitForTimeout(80);
  await gesture(page,'#work .ux7-card:not(.ux7-hidden)',{x1:100,x2:190});
  expect((await view(page)).view).toBe('overview');
  await page.evaluate(()=>ux7Go('work','log'));await page.waitForTimeout(80);
  await gesture(page,'#work .ux7-card:not(.ux7-hidden)',{x1:310,x2:210});
  expect((await view(page)).view).toBe('log');
});

test('edge, vertical, interactive and horizontal-scroll gestures are ignored',async({page})=>{
  await boot(page);
  await page.evaluate(()=>ux7Go('today','focus'));await page.waitForTimeout(80);
  await gesture(page,'#today .ux7-card:not(.ux7-hidden)',{x1:12,x2:110});
  expect((await view(page)).view).toBe('focus');
  await gesture(page,'#today .ux7-card:not(.ux7-hidden)',{x1:250,y1:300,x2:175,y2:430});
  expect((await view(page)).view).toBe('focus');
  await gesture(page,'#today .quick',{x1:300,x2:210});
  expect((await view(page)).view).toBe('focus');

  await page.evaluate(()=>ux7Go('work','log'));await page.waitForTimeout(80);
  const input=page.locator('#work input:not([type="hidden"])').first();
  if(await input.count()){
    const box=await input.boundingBox();
    if(box)await gesture(page,'#work input:not([type="hidden"])',{x1:Math.max(40,box.x+box.width*.8),y1:box.y+box.height/2,x2:Math.max(35,box.x+10),y2:box.y+box.height/2});
    expect((await view(page)).view).toBe('log');
  }
});

test('open modal suppresses tab swipe',async({page})=>{
  await boot(page);
  await page.evaluate(()=>ux7Go('finance','overview'));await page.waitForTimeout(80);
  await page.evaluate(()=>openModal('expenseModal'));await expect(page.locator('#expenseModal')).toHaveClass(/open/);
  await gesture(page,'#expenseModal .modal-card',{x1:300,x2:210});
  expect(await view(page)).toEqual({section:'finance',view:'overview'});
  await page.evaluate(()=>closeModal('expenseModal'));
});
