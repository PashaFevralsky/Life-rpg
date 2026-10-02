"use strict";
/* Life RPG 14.0 — Android tab swipe navigation.
   Scope: sub-tabs only. Main bottom navigation is never changed by a swipe.
   Smooth transition: short leave phase -> view switch -> eased enter phase. */
(()=>{
  const CFG={
    edge:28,minX:64,ratio:1.35,maxMs:950,
    leaveMs:90,enterMs:190,settleMs:34
  };
  let state=null,installed=false,transitioning=false;

  function activeSection(){return document.querySelector('.section.active')}
  function tabs(section){return [...section?.querySelectorAll(':scope > .ux7-section-head .ux7-tab')||[]].filter(x=>!x.disabled)}
  function currentIndex(section,list){
    const view=document.body?.dataset?.view||'';
    const byData=list.findIndex(x=>x.dataset.view===view);
    if(byData>=0)return byData;
    return list.findIndex(x=>x.classList.contains('active'))
  }
  function hasOpenModal(){return !!document.querySelector('.modal.open')}
  function interactiveTarget(el){return !!el?.closest?.('input,textarea,select,button,a,label,[contenteditable="true"],[role="button"],[role="slider"],[role="spinbutton"]')}
  function explicitIgnore(el){return !!el?.closest?.('.ux7-tabs,.quick,.kpi-row,[data-swipe-ignore]')}
  function horizontalScroller(el){
    for(let n=el;n&&n!==document.body;n=n.parentElement){
      if(!(n instanceof HTMLElement))continue;
      const s=getComputedStyle(n),ox=s.overflowX;
      if((ox==='auto'||ox==='scroll')&&n.scrollWidth>n.clientWidth+8)return true;
    }
    return false
  }
  function reducedMotion(){
    try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}
  }
  function eligibleStart(e){
    if(installed!==true||transitioning||e.pointerType!=='touch'||e.isPrimary===false||hasOpenModal())return false;
    const section=activeSection();if(!section||!section.contains(e.target))return false;
    const x=Number(e.clientX||0),vw=document.documentElement.clientWidth||innerWidth;
    if(x<CFG.edge||x>vw-CFG.edge)return false;
    if(interactiveTarget(e.target)||explicitIgnore(e.target)||horizontalScroller(e.target))return false;
    const list=tabs(section);if(list.length<2)return false;
    return true
  }
  function clear(){state=null}
  function clearTransition(section){
    section?.classList.remove(
      'life-tab-swipe-transitioning',
      'life-tab-swipe-leave-next','life-tab-swipe-leave-prev',
      'life-tab-swipe-enter-next','life-tab-swipe-enter-prev'
    )
  }
  function onDown(e){
    if(!eligibleStart(e)){clear();return}
    state={id:e.pointerId,x:Number(e.clientX),y:Number(e.clientY),t:performance.now(),section:activeSection()}
  }
  function onCancel(){clear()}
  function dispatchSwipe(section,from,to,dir){
    document.dispatchEvent(new CustomEvent('life-rpg:tab-swipe',{
      detail:{section:section.id,from,to,direction:dir>0?'next':'previous'}
    }))
  }
  function switchImmediate(section,view,from,dir){
    globalThis.ux7SetView(section.id,view,true);
    dispatchSwipe(section,from,view,dir)
  }
  function transition(section,view,from,dir){
    if(reducedMotion()){
      switchImmediate(section,view,from,dir);
      return
    }

    transitioning=true;
    clearTransition(section);
    section.classList.add(
      'life-tab-swipe-transitioning',
      dir>0?'life-tab-swipe-leave-next':'life-tab-swipe-leave-prev'
    );

    setTimeout(()=>{
      if(section!==activeSection()){
        clearTransition(section);transitioning=false;return
      }

      section.classList.remove('life-tab-swipe-leave-next','life-tab-swipe-leave-prev');
      globalThis.ux7SetView(section.id,view,true);
      section.classList.add(dir>0?'life-tab-swipe-enter-next':'life-tab-swipe-enter-prev');
      dispatchSwipe(section,from,view,dir);

      setTimeout(()=>{
        clearTransition(section);
        transitioning=false
      },CFG.enterMs+CFG.settleMs)
    },CFG.leaveMs)
  }
  function onUp(e){
    const s=state;clear();
    if(!s||e.pointerId!==s.id||hasOpenModal()||s.section!==activeSection()||transitioning)return;
    const dx=Number(e.clientX)-s.x,dy=Number(e.clientY)-s.y,ax=Math.abs(dx),ay=Math.abs(dy),dt=performance.now()-s.t;
    if(dt>CFG.maxMs||ax<CFG.minX||ax<ay*CFG.ratio)return;
    const section=s.section,list=tabs(section),i=currentIndex(section,list);if(i<0)return;
    const dir=dx<0?1:-1,next=i+dir;
    if(next<0||next>=list.length)return;
    const view=list[next]?.dataset?.view,from=list[i]?.dataset?.view||'';
    if(!view||typeof globalThis.ux7SetView!=='function')return;
    transition(section,view,from,dir)
  }
  function install(){
    if(installed)return true;
    if(!document.body?.classList.contains('ui139')||typeof globalThis.ux7SetView!=='function')return false;
    document.addEventListener('pointerdown',onDown,{passive:true});
    document.addEventListener('pointerup',onUp,{passive:true});
    document.addEventListener('pointercancel',onCancel,{passive:true});
    installed=true;document.documentElement.classList.add('life-tab-swipe-ready');return true
  }
  function boot(){
    let tries=0;const tick=()=>{if(install())return;if(++tries<120)setTimeout(tick,50)};tick()
  }
  globalThis.LifeTabSwipe14={
    install,
    config:{...CFG},
    isReady:()=>installed,
    isTransitioning:()=>transitioning
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
