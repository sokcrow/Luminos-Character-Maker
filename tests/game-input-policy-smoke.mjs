import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const js=await fs.readFile('js/game-input-policy.js','utf8');
const dom=new JSDOM(`<!doctype html><html><body>
<button id="action">Acción</button><img id="portrait"><a id="link" href="#">Ver ficha</a><svg><path id="shape"></path></svg>
<input id="input"><input id="readonly" readonly><textarea id="textarea"></textarea><select id="select"><option>Uno</option></select>
<div contenteditable="true"><span id="edit">Texto</span><div contenteditable="false"><span id="locked">Juego</span><input id="nested-input"></div></div>
<div contenteditable="plaintext-only"><span id="plain">Texto</span></div>
<div data-native-contextmenu="true"><span id="native">Copiable</span></div>
<div draggable="true"><img id="inventory-image"></div><button draggable="true" id="deck-card">Carta</button>
</body></html>`,{runScripts:'outside-only'});
const w=dom.window,d=w.document;w.eval(js);w.eval(js);
assert.ok(d.documentElement.classList.contains('limbus-game-interactions'));
const context=id=>{const event=new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2});d.getElementById(id).dispatchEvent(event);return event;};
for(const id of ['action','portrait','link','shape','locked'])assert.equal(context(id).defaultPrevented,true,id);
for(const id of ['input','readonly','textarea','select','edit','plain','native','nested-input'])assert.equal(context(id).defaultPrevented,false,id);
let gameCalls=0;d.getElementById('portrait').addEventListener('contextmenu',event=>{gameCalls++;assert.equal(event.defaultPrevented,false,'target game handler runs before browser-menu suppression');});context('portrait');assert.equal(gameCalls,1,'game handlers still receive the same context event');
for(const id of ['portrait','link','shape']){const e=new w.Event('dragstart',{bubbles:true,cancelable:true});d.getElementById(id).dispatchEvent(e);assert.equal(e.defaultPrevented,true,id);}
for(const id of ['input','edit','inventory-image','deck-card']){const e=new w.Event('dragstart',{bubbles:true,cancelable:true});d.getElementById(id).dispatchEvent(e);assert.equal(e.defaultPrevented,false,id);}
for(const type of ['pointerdown','pointerup','touchstart','touchmove','touchend','keydown','keyup','copy','cut','paste','click']){
 const e=new w.Event(type,{bubbles:true,cancelable:true});d.getElementById('action').dispatchEvent(e);assert.equal(e.defaultPrevented,false,type+' stays available to game/native handlers');
}
// Shadow DOM fields retain their native menus via the composed event path.
const host=d.createElement('div');d.body.append(host);const shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<textarea></textarea><img>';
for(const [selector,prevented]of [['textarea',false],['img',true]]){const e=new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,composed:true});shadow.querySelector(selector).dispatchEvent(e);assert.equal(e.defaultPrevented,prevented);}
for(const page of ['hoja_de_DM.html','pantalla_dm.html','hoja_personaje.html','combate.html','mirror.html']){
 const html=await fs.readFile(page,'utf8');assert.equal((html.match(/src="js\/game-input-policy\.js/g)||[]).length,1,page);assert.equal((html.match(/href="css\/game-input-policy\.css/g)||[]).length,1,page);
}
const battle=await fs.readFile('Battle-viewer.html','utf8');const injection=battle.indexOf('css/game-input-policy.css');assert.ok(injection>battle.indexOf('const responses='));assert.ok(injection<battle.indexOf('document.open();document.write(html)'),'policy is installed inside the rewritten Combat document');
dom.window.close();console.log('Game input policy: native menus blocked on game surfaces, editing/shadow fields preserved, inventory/deck drag and game handlers preserved, gestures/keyboard untouched, all entrypoints wired.');
