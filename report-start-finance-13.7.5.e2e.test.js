import { test, expect } from "@playwright/test";

async function boot(page){
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/)
}

test("13.7.5 reportStart finance boundary: no pre-start debt goal or false cash-flow",async({page})=>{
  await boot(page);
  const x=await page.evaluate(()=>{
    const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
    const start=new Date(now.getFullYear(),now.getMonth()+1,1,12),startKey=localDateKey(start);
    const y=start.getFullYear(),m=start.getMonth(),dueKey=localDateKey(new Date(y,m,10,12));

    S.settings.reportStart=startKey;
    S.settings.campaignStart=startKey;
    S.settings.monthlyDebtGoal=91000;
    S.settings.monthlyIncome=150000;
    S.settings.incomeEvents=[
      {id:"salary-5",day:5,label:"Доход 5",amount:50000},
      {id:"salary-15",day:15,label:"Доход 15",amount:50000},
      {id:"salary-20",day:20,label:"Доход 20",amount:50000}
    ];
    S.envelopeLimits={"Еда":17000,"Транспорт":10000,"Дом":0,"Связь":2000,"Развлечения":1000,"Теннис":9000,"Покупки":2000,"Другое":8000};
    S.envelopeCarryovers={};
    S.debts=[{id:"d1",name:"Тестовый долг",type:"Карта",balance:100000,initial:100000,rate:50,rateKnown:true,min:5000,dueDay:10,nextPaymentDate:dueKey,nextPaymentAmount:5000,paymentMode:"fixed",parts:[]}];
    S.payments=[];

    const flow=dailyCashFlow(40,"plan"),pre=flow.rows.filter(r=>localDateKey(r.date)<startKey);
    const next=nextPlannedIncomeDate(today),metrics=financeMonthMetrics(localMonthKey(today)),advice=cashAdvice(),auto=autopilotPlan(),phase=financialPhase();
    renderFinance();

    return {
      startKey,
      plannedIncome:plannedIncomeForMonth(),
      todayExtra:plannedExtraDebtOnDate(today),
      preExtra:pre.reduce((s,r)=>s+(+r.extraDebt||0),0),
      preLiving:pre.reduce((s,r)=>s+(+r.living||0),0),
      nextKey:next?localDateKey(next.date):"",
      currentMin:remainingMinimumsThisMonth(),
      metricsDebtGoal:metrics.debtGoal,
      metricsIncomePlan:metrics.incomePlan,
      adviceRecommended:advice.recommended,
      autoDebtExtra:auto.debtExtra,
      phaseId:phase.id,
      finNeed:document.getElementById("finNeed")?.textContent||""
    }
  });

  expect(x.plannedIncome).toBe(150000);
  expect(x.todayExtra).toBe(0);
  expect(x.preExtra).toBe(0);
  expect(x.preLiving).toBe(0);
  expect(x.nextKey>=x.startKey).toBe(true);
  expect(x.currentMin).toBe(0);
  expect(x.metricsDebtGoal).toBe(0);
  expect(x.metricsIncomePlan).toBe(0);
  expect(x.adviceRecommended).toBe(0);
  expect(x.autoDebtExtra).toBe(0);
  expect(x.phaseId).toBe("scheduled");
  expect(x.finNeed).toContain("Старт")
});
