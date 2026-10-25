import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,runInNewContext} from "node:vm";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const html=read("Battle-viewer.html");
const loader=read("js/combat-v073-spell-bootstrap.js");
const menu=read("js/combat-v073-economy-menu.js");
const authority=read("js/combat-v073-authority.js");
assert.match(html,/combat-v073-spell-bootstrap\.js/);
assert.match(html,/combat-v073-spell-availability\.css/);
assert.match(loader,/spellcasting-basic-rules-runtime\.js/);
assert.match(loader,/battle-viewer-spell-adapter-074\.js/);
assert.match(loader,/battle-viewer-spell-runtime-074\.js/);
assert.match(loader,/__spellAdapter074/);
assert.match(loader,/__spellRuntime074/);
assert.doesNotMatch(loader,/battle-viewer-runtime-074\.js/);
assert.match(menu,/__spellUnavailableReason/);
assert.match(menu,/button\.disabled=true/);
assert.match(menu,/if\(explicit\)/);
assert.match(authority,/SPELL_PLAN_REJECTED:/);
assert.match(authority,/resolveSpellForCombatant\(unit,spellId/);
assert.match(read("js/combat-v073-live-adapter.js"),/LuminousSpellLoadout\.canonical\(authoritativePlayer\)/);
for(const path of ["js/combat-v073-spell-bootstrap.js","js/combat-v073-economy-menu.js","js/combat-v073-authority.js","js/spell-loadout-core.js","js/combat-v073-live-adapter.js"]){
  assert.doesNotThrow(()=>new Script(read(path),{filename:path}),path);
}
const fake={addEventListener(){},setTimeout(){return 1},clearTimeout(){},console:{error(){}}};
fake.document={head:{appendChild(){}},getElementById(){return null},createElement(){return {addEventListener(){}}}};
runInNewContext(loader,{window:fake,globalThis:fake,Promise,Date});
assert.equal(fake.LuminousCombatSpellBootstrap073.state.ready,false);
assert.ok(fake.LuminousCombatSpellBootstrap073.MODULES.length>=12);

// Load and execute the actual bundle wrapper. The source file alone is NOT
// proof that the decompressed production combat document imports this bridge.
import {gunzipSync} from "node:zlib";
const parts=[
 ...["01","02","03","04","05","06"].map(n=>"combat/combat-v073-live.bundle.part"+n),
 ...["r1","r2","r3"].map(n=>"combat/repair/combat-v073-live.bundle.part07."+n),
 ...["08","09","10","11"].map(n=>"combat/combat-v073-live.bundle.part"+n),
];
const original=gunzipSync(Buffer.from(parts.map(read).join("").replace(/\s+/g,""),"base64")).toString("utf8");
assert.ok(original.includes("window.LuminousCombatLiveMode=true"));
let written="";
let complete;
const writtenPromise=new Promise(resolve=>{complete=resolve});
const browserWindow={addEventListener(){},parent:null};
browserWindow.parent=browserWindow;
const document={
 getElementById(){return {set textContent(value){throw Error(String(value))}}},
 open(){},write(value){written=value;complete()},close(){}
};
const wrapperScript=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(wrapperScript);
runInNewContext(wrapperScript,{
 window:browserWindow,document,Blob,Response,DecompressionStream,Uint8Array,atob,
 location:{origin:"http://localhost"},console,
 fetch:async file=>{assert.ok(parts.includes(file));return {ok:true,text:async()=>read(file)}}
});
await writtenPromise;
assert.ok(written.length>200000);
assert.match(written,/src="js\/combat-v073-spell-bootstrap\.js/);
assert.match(written,/href="css\/combat-v073-spell-availability\.css/);
assert.match(written,/src="js\/combat-v073-plan-sync\.js/);
// A dependency preflight can complete without introducing a second Viewer role runtime.
assert.doesNotMatch(written,/src="js\/battle-viewer-runtime-074\.js/);

console.log("Combat SP-01: real packed Viewer injection + canonical Spell bridge contract OK");
