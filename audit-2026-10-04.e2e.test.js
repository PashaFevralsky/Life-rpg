import {test,expect} from '@playwright/test';

test('financial verification rejects blank values and today income survives reload',async({page})=>{
 await page.clock.install({time:new Date('2026-10-04T20:00:00Z')});
 await page.goto('/');await expect(page.locator('html')).not.toHaveClass(/life-rpg-booting/);
 await page.evaluate(async()=>{
  S.accounts=[{id:'main',name:'Main',verifiedBalance:1000,verifiedAt:new Date(Date.now()-3600000).toISOString(),active:true}];S.settings.primaryAccountId='main';
  await persist();render();
  document.getElementById('account-sync-main').value='';syncAccountBalance('main');
 });
 expect(await page.evaluate(()=>S.accounts[0].verifiedBalance)).toBe(1000);
 await page.evaluate(async()=>{
  openIncomeModal();document.getElementById('incomeAmount').value='100';await addIncome();
 });
 expect(await page.evaluate(()=>accountBalanceById('main'))).toBe(1100);
 await page.reload();await expect(page.locator('html')).not.toHaveClass(/life-rpg-booting/);
 expect(await page.evaluate(()=>accountBalanceById('main'))).toBe(1100);
});

test('GPT import storage failure is atomic and retry creates one task',async({page})=>{
 await page.goto('/');await expect(page.locator('html')).not.toHaveClass(/life-rpg-booting/);
 page.on('dialog',d=>d.accept());
 const result=await page.evaluate(async()=>{
  gpt135Store();gpt136Store();await persist();await persistenceQueue;
  GPT135_PREVIEW={boundExport:true,fingerprint:'audit-failure',fileName:'audit.json',payload:{packageId:'audit',tasks:[{include:true,title:'Audit atomic task',minutes:15}],calendar:[],recommendations:[],assumptions:[],feedbackDecisions:[]}};
  const before=JSON.stringify(S),original=writeStateSnapshot;
  writeStateSnapshot=async()=>{throw new Error('simulated storage failure')};
  let error='';try{await gpt135Apply()}catch(e){error=e.message}finally{writeStateSnapshot=original}
  const rolledBack=JSON.stringify(S)===before,retryable=!!GPT135_PREVIEW;
  await gpt135Apply();
  return {error,rolledBack,retryable,count:S.entities.tasks.filter(x=>x.title==='Audit atomic task').length};
 });
 expect(result).toEqual({error:'simulated storage failure',rolledBack:true,retryable:true,count:1});
 await page.reload();await expect(page.locator('html')).not.toHaveClass(/life-rpg-booting/);
 expect(await page.evaluate(()=>S.entities.tasks.filter(x=>x.title==='Audit atomic task').length)).toBe(1);
});
