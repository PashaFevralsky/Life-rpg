"use strict";
const fs=require("node:fs"),assert=require("node:assert");
const read=f=>fs.readFileSync(f,"utf8");
const html=read("index.html"),ui=read("ui.js"),imports=read("imports.js"),finance=read("finance.js"),css=read("interface-13.9.css"),e2e=read("android-ui-14.e2e.test.js");

assert(ui.includes('$("readingListImport")?.addEventListener("change"'),"reading-list input must be wired");
assert(html.includes('id="bankCsvAccount"'),"CSV import must require an account selector");
assert(html.includes('id="bankCsvPreview"'),"CSV import must expose preview");
assert(html.includes('id="bankCsvApplyBtn"'),"CSV import must require explicit apply");
assert(imports.includes("let bankCsvPending=null"),"CSV import must use pending preview state");
assert(imports.includes('accountId,ocrSign:raw>0?"+":"-"'),"CSV candidates must preserve source account and sign");
assert(imports.includes("async function confirmBankCsvImport()"),"CSV apply must be explicit");
assert(imports.includes("Перед CSV-импортом"),"CSV apply must snapshot first");
assert(finance.includes("async function deleteAssetTransfer(id)"),"asset transfers need dedicated trash-aware deletion");
assert(imports.includes('if(kind==="asset_transfer")return deleteAssetTransfer(id)'),"journal must route asset transfer deletion through undo-aware helper");
assert(finance.includes("Перед освобождением резервов Money Engine"),"reservation release must snapshot");
assert(finance.includes("Эти деньги снова будут считаться свободными"),"reservation release must require explicit confirmation");
assert(finance.includes("Погашено с начала отслеживания"),"debt UI must state tracking baseline accurately");
assert(css.includes("AUDIT-FIX-2026-10-05-STICKY"),"compact sticky fix missing");
assert(e2e.includes('expect(h.headCopyDisplay).not.toBe("none")'),"E2E must preserve sticky command container");
assert(e2e.includes('expect(h.titleDisplay).toBe("none")'),"E2E must hide sticky title");
assert(e2e.includes('expect(h.descDisplay).toBe("none")'),"E2E must hide sticky description");
assert(e2e.includes('expect([null,"none"]).toContain(h.clarityDisplay)'),"E2E must hide clarity control when present");
assert(e2e.includes('expect(h.commandDisplay).toBe("grid")'),"E2E must keep command control visible");
assert(e2e.includes('expect(h.commandWidth).toBeGreaterThanOrEqual(44)'),"E2E must verify command touch width");
assert(e2e.includes('expect(h.commandHeight).toBeGreaterThanOrEqual(44)'),"E2E must verify command touch height");
assert(html.includes("JSON без шифрования"),"plaintext backup must be labelled");
assert(html.includes("Android RC собирается через GitHub Actions"),"Android build status text is stale");

const fileInputs=[...html.matchAll(/<input\b[^>]*type=["']file["'][^>]*>/gi)].map(m=>m[0]);
const runtime=ui+"\n"+imports+"\n"+read("knowledge.js")+"\n"+read("tennis-huawei.js")+"\n"+read("share-hub.js")+"\n"+read("gpt-exchange-13.5.js");
for(const tag of fileInputs){
  const id=(tag.match(/\bid=["']([^"']+)["']/i)||[])[1];
  if(!id)continue;
  if(/\bonchange\s*=/.test(tag))continue;
  const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const patterns=[
    new RegExp('\\$\\(["\\\']'+escaped+'["\\\']\\)\\?*\\.addEventListener\\(["\\\']change["\\\']'),
    new RegExp('getElementById\\(["\\\']'+escaped+'["\\\']\\)[\\s\\S]{0,100}addEventListener\\(["\\\']change["\\\']')
  ];
  assert(patterns.some(re=>re.test(runtime)),"file input #"+id+" has no reachable change handler")
}
console.log("OK — Audit Fix 2026-10-05 contracts");
