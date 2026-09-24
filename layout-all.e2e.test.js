import { test, expect } from "@playwright/test";

const widths=[360,390,412,430];
const views={
  today:["focus","progress"],
  finance:["overview","operations","bank","debts","analysis","more"],
  work:["overview","crm","log"],
  tennis:["overview","training","analytics"],
  more:["overview","knowledge","rewards","settings"]
};

async function boot(page,width){
  await page.setViewportSize({width,height:900});
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).not.toHaveClass(/life-rpg-booting/);
  return errors
}
async function inspect(page){
  return page.evaluate(()=>{
    const visible=el=>{if(!el)return false;const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>0&&r.height>0};
    const vw=document.documentElement.clientWidth;
    const bodyOverflow=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-vw;
    const bad=[...document.querySelectorAll(".section.active .card,.section.active .btn,.section.active input,.section.active select,.section.active textarea,.bottom")]
      .filter(visible).map(el=>{const r=el.getBoundingClientRect();return {el,left:r.left,right:r.right,width:r.width}})
      .filter(x=>x.left<-1||x.right>vw+1)
      .map(x=>({tag:x.el.tagName,id:x.el.id||"",className:String(x.el.className||""),left:Math.round(x.left),right:Math.round(x.right),width:Math.round(x.width),text:String(x.el.textContent||"").trim().slice(0,80)}));
    const bottom=document.querySelector(".bottom"),shell=document.querySelector(".shell"),br=bottom?.getBoundingClientRect();
    const safe=bottom&&shell?(parseFloat(getComputedStyle(shell).paddingBottom)||0)-(br?.height||0):999;
    return {vw,bodyOverflow,bad,safe,bottom:br?{left:br.left,right:br.right,bottom:br.bottom}:null}
  })
}

for(const width of widths){
  test(`all views fit ${width}px viewport`,async({page})=>{
    const errors=await boot(page,width);
    for(const [section,list] of Object.entries(views)){
      for(const view of list){
        await page.evaluate(([s,v])=>{switchTab(s);ux7SetView(s,v,false)},[section,view]);
        await page.waitForTimeout(25);
        const g=await inspect(page);
        expect(g.bodyOverflow,`${section}/${view}: body overflow ${g.bodyOverflow}px`).toBeLessThanOrEqual(1);
        expect(g.bad,`${section}/${view}: controls/cards outside viewport`).toEqual([]);
        expect(g.safe,`${section}/${view}: bottom safe area`).toBeGreaterThanOrEqual(28);
        expect(g.bottom?.left??0,`${section}/${view}: bottom nav left`).toBeGreaterThanOrEqual(-1);
        expect(g.bottom?.right??width,`${section}/${view}: bottom nav right`).toBeLessThanOrEqual(width+1)
      }
    }
    if(width===360){
      for(const id of ["expenseModal","incomeModal","paymentModal","readingModal","bookModal","transferModal","syncModal","envelopeModal","encryptedBackupModal"]){
        if(!(await page.locator("#"+id).count()))continue;
        await page.evaluate(id=>openModal(id),id);await page.waitForTimeout(20);
        const m=await page.locator("#"+id+" .modal-card").boundingBox();
        expect(m,`${id} missing modal card`).not.toBeNull();
        expect(m.x,`${id} left`).toBeGreaterThanOrEqual(-1);
        expect(m.x+m.width,`${id} right`).toBeLessThanOrEqual(width+1);
        expect(m.height,`${id} height`).toBeLessThanOrEqual(900);
        await page.evaluate(id=>closeModal(id),id)
      }
    }
    expect(errors).toEqual([])
  })
}
