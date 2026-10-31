import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.textContent='';this.listeners={};}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;this.textContent='';}
  addEventListener(name,cb){this.listeners[name]=cb;}
  setAttribute(){}
  querySelector(){return null;}
}
const ids=Object.fromEntries(['dashboard-actores','character-manager-tags','character-manager-social-enabled','character-manager-social-kind','character-manager-social-description','character-manager-social-fields','character-manager-social-help','character-manager-relations-list','character-manager-type','character-manager-player'].map(id=>[id,new Element()]));
ids['character-manager-type'].value='NPC';
const doc={readyState:'loading',getElementById:id=>ids[id]||null,querySelector:()=>null,createElement:tag=>new Element(tag),addEventListener(){}};
let deliver;
const database=()=>({ref:()=>({on:(event,callback)=>{deliver=callback;}})});database.ServerValue={TIMESTAMP:1};
const manager={subscribeActors(){},subscribePlayers(){},getPlayer:()=>({label:'Alice'}),listPlayers:()=>[],getActor:()=>null};
const c=vm.createContext({console,document:doc,LuminousCharacterManager:manager,firebase:{apps:[{}],database},setTimeout:()=>1,clearTimeout(){}});c.window=c;
for(const file of ['js/social-link-core.js','js/bond-engine.js','js/character-manager-social-studio.js'])vm.runInContext(read(file),c,{filename:file});
assert.equal(c.LuminousBondManager.isLoaded(),false);
c.LuminousSocialLinkStudio.load({actorId:'hopkins',actor:{socialLink:{enabled:true,players:{alice:true}}}});
const host=ids['character-manager-relations-list'];
assert.equal(host.children.length,0,'No editable zero-valued form before the initial snapshot');
assert.match(host.textContent,/Cargando/);
deliver({val:()=>({alice:{hopkins:{nivel:8,puntos:42,historia:'Historia real',beneficios:['Beneficio real']}}})});
assert.equal(c.LuminousBondManager.isLoaded(),true);
assert.equal(host.children.length,1,'Initial snapshot replaces the loading placeholder');
const body=host.children[0].children[1];
assert.equal(body.children[0].children[1].value,8);
assert.equal(body.children[1].children[1].value,42);
assert.equal(body.children[2].children[1].value,'Historia real');
const input=body.children[2].children[1];input.value='Borrador sin guardar';
deliver({val:()=>({alice:{hopkins:{nivel:9,puntos:0,historia:'Actualización remota'}}})});
assert.equal(host.children[0].children[1],body,'Subsequent realtime updates do not rebuild an editable draft');
assert.equal(input.value,'Borrador sin guardar');
console.log('Social Link initial load: deferred editing, actual saved values, and draft preservation OK.');
