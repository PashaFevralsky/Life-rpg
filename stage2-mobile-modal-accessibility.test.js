"use strict";
const fs=require("fs"),path=require("path"),assert=require("assert");
const root=__dirname,ui=fs.readFileSync(path.join(root,"ui.js"),"utf8"),css=fs.readFileSync(path.join(root,"mobile-layout.css"),"utf8");

assert.ok(ui.includes("MODAL_FOCUSABLE_SELECTOR"),"modal focus selector missing");
assert.ok(ui.includes('document.addEventListener("keydown",handleModalKeydown)'),"central modal keyboard handler missing");
assert.ok(ui.includes('if(e.key==="Escape")'),"Escape close contract missing");
assert.ok(ui.includes('if(e.key!=="Tab")return'),"Tab focus-trap contract missing");
assert.ok(ui.includes("!m.contains(active)"),"focus escaping the modal is not trapped");
assert.ok(ui.includes('classList.toggle("modal-open",open)'),"document scroll-lock state missing");
assert.ok(ui.includes('m.setAttribute("aria-hidden",m.classList.contains("open")?"false":"true")'),"initial modal aria-hidden state missing");
assert.ok(ui.includes("lastModalFocus?.focus?.()"),"focus restoration after close missing");

assert.ok(css.includes("html.modal-open,body.modal-open{overflow:hidden;overscroll-behavior:none}"),"background scroll lock CSS missing");
assert.ok(css.includes("100dvh"),"dynamic viewport modal sizing missing");
assert.ok(css.includes("scroll-padding-bottom:calc(24px + env(safe-area-inset-bottom))"),"modal safe-area scroll padding missing");
assert.ok(/\.ui82 \.close\{[\s\S]*?min-width:44px;[\s\S]*?min-height:44px;/.test(css),"44px modal close target missing");

console.log("OK — Stage 2.10 mobile modal accessibility: focus trap, background lock, dynamic viewport, touch target");
