import { test, expect } from '@playwright/test';

test('Finance snapshot preserves balances, ledger and progress after two imports and reload', async ({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>typeof financeRebuild14CurrentPackage)).toBe('function');
  await expect(page.locator('html')).not.toHaveClass(/life-rpg-booting/);
  const exported=await page.evaluate(async()=>{
    S=deepClone(DEFAULT_STATE);
    S.settings.reportStart='2026-09-01';S.settings.reportStartMigration='report-boundary-core-v1';
    S.settings.reportStartCleanupVersion='13.9.1-core';S.settings.reportStartEnvelopeFixVersion='13.9.1-core';
    S.accounts=[{id:'main',name:'Основной',type:'Счёт',verifiedBalance:10000,verifiedAt:'2026-09-01T00:00:00Z',active:true}];
    S.settings.primaryAccountId='main';S.settings.emergencyFundBalance=1000;S.settings.forecastIncomeFactor=0;
    S.debts=[{id:'loan',name:'Кредит',type:'Кредит',initial:1000,balance:900,rate:20,min:100,dueDay:10,balanceVerifiedAt:'2026-09-01T00:00:00Z',active:true}];
    S.payments=[{id:'p1',debtId:'loan',debt:'Кредит',debtIndex:0,amount:100,date:'2026-09-02T12:00:00Z',localDate:'2026-09-02',monthKey:'2026-09',accountId:'main',historicalOnly:false}];
    S.fundTransfers=[{id:'f1',date:'2026-09-02T12:00:00Z',dateKey:'2026-09-02',direction:'toFund',amount:1000,accountId:'main'}];
    S.bankTransfers=[{id:'t1',date:'2026-09-02T12:00:00Z',dateKey:'2026-09-02',amount:500,syncAccountId:'main',syncEffect:-500,note:'Перевод'}];
    S.expenses=[{id:'e1',amount:30,date:'2026-09-02T12:00:00Z',dateKey:'2026-09-02',accountId:'main',category:'Комиссия',note:'Платёж по кредиту'}];
    S.profile.name='Roundtrip';S.workLogs=[{id:'w1',date:'2026-09-02',sales:100,xpAward:0}];
    await persist();render();ux7Go('more','settings');renderFinanceRebuild14();
    return financeRebuild14CurrentPackage();
  });
  page.on('dialog',d=>d.accept('ЗАМЕНИТЬ ФИНАНСЫ'));
  for(let i=0;i<2;i++){
    await page.evaluate(async()=>{S.accounts[0].verifiedBalance=1;S.debts[0].balance=2;S.fundTransfers=[];await persist()});
    await page.locator('#financeRebuild14File').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
    await expect(page.locator('#financeRebuild14Apply')).toBeEnabled();
    await page.locator('#financeRebuild14Apply').click();
    await expect.poll(()=>page.evaluate(()=>!!S.settings.financeRebuild14?.snapshotTs)).toBe(true);
    await expect.poll(()=>page.evaluate(()=>FINANCE_REBUILD14_APPLY_PENDING)).toBe(false);
    expect(await page.evaluate(()=>financeRebuild14FinancialSnapshot(S))).toEqual(exported.financialState);
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/life-rpg-booting/);
    await expect.poll(()=>page.evaluate(()=>S.profile.name)).toBe('Roundtrip');
    expect(await page.evaluate(()=>({cash:accountBalanceById('main'),debt:S.debts[0].balance,fund:S.settings.emergencyFundBalance,work:S.workLogs.length,expense:S.expenses[0].category,factor:S.settings.forecastIncomeFactor})))
      .toEqual({cash:8370,debt:900,fund:1000,work:1,expense:'Комиссия',factor:0});
    await page.evaluate(()=>{ux7Go('more','settings');renderFinanceRebuild14()});
  }
  expect(errors).toEqual([]);
});

test('Finance rebuild blocks malformed amount before confirmation and leaves data intact',async({page})=>{
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/life-rpg-booting/);
  await page.evaluate(()=>{ux7Go('more','settings');renderFinanceRebuild14()});
  const data=await page.evaluate(()=>{const pkg=financeRebuild14Template();pkg.accounts[0].verifiedBalance='ошибка';return {pkg,state:JSON.stringify(S)}});
  await page.locator('#financeRebuild14File').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data.pkg))});
  await expect(page.locator('#financeRebuild14Preview')).toContainText('некорректное число');
  await expect(page.locator('#financeRebuild14Apply')).toBeDisabled();
  expect(await page.evaluate(()=>JSON.stringify(S))).toBe(data.state);
});
