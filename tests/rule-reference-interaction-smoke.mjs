import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
class Element {
  constructor(tag) {
    this.tag=tag;this.children=[];this.attributes={};this.dataset={};this.style={};
    this.hidden=false;this.isConnected=false;this.events={};this.textContent="";
    const self=this;
    this.classList={contains(name){return (self.className||"").split(/\s+/).includes(name);},
      toggle(name,enabled){
        const names=new Set((self.className||"").split(/\s+/).filter(Boolean));
        if(enabled)names.add(name);else names.delete(name);
        self.className=[...names].join(" ");
      }};
  }
  append(...children){children.forEach(child=>{this.children.push(child);child.parentNode=this;child.isConnected=true;});}
  appendChild(child){this.append(child);return child;}
  addEventListener(name,cb){(this.events[name] ||= []).push(cb);}
  fire(name,data={}){(this.events[name]||[]).forEach(fn=>fn(data));}
  setAttribute(key,val){this.attributes[key]=val;}
  getBoundingClientRect(){return {left:15,top:50,bottom:80};}
  focus(){this.focused=true;}
  contains(node){return node===this||this.children.some(child=>child.contains?.(node));}
  find(fn){
    for(const child of this.children){
      if(fn(child))return child;
      const nested=child.find?.(fn);if(nested)return nested;
    }
    return null;
  }
  querySelector(css){
    if(css[0]===".")return this.find(x=>(x.className||"").split(/\s+/).includes(css.slice(1)));
    return this.find(x=>x.tag===css);
  }
}
const head=new Element("head"),body=new Element("body");
body.isConnected=true;
const document={
  head,body,documentElement:{clientWidth:390,clientHeight:844},events:{},
  createElement:tag=>new Element(tag),
  createTextNode:text=>({tag:"#text",nodeValue:text,parentElement:null}),
  createDocumentFragment:()=>new Element("fragment"),
  getElementById(id){return head.find(x=>x.id===id) || body.find(x=>x.id===id);},
  addEventListener(name,handler){(this.events[name]||=[]).push(handler);},
  fire(name,event={}){(this.events[name]||[]).forEach(cb=>cb(event));},
  createTreeWalker(root) {
    let done=false;
    return {currentNode:null,nextNode(){if(done)return false;done=true;this.currentNode=root.textNode;return true;}};
  }
};
const window={document,innerWidth:390,innerHeight:844,events:{},
  addEventListener(name,fn){(this.events[name]||=[]).push(fn);}};
const sandbox={window,console};
const status=fs.readFileSync(path.join(base,"js/status-library.js"),"utf8");
const runtime=fs.readFileSync(path.join(base,"js/rule-reference-ui.js"),"utf8");
vm.runInNewContext(status,sandbox);
vm.runInNewContext(runtime,sandbox);
const refs=window.LuminousRuleReferences;
assert.ok(refs);
const changed=[];
const parent={closest(){return null;}};
const old={
  nodeValue:"On Hit: inflict Rupture. Make a CON Save.",
  parentElement:parent,
  parentNode:{replaceChild(fragment){changed.push(fragment);}}
};
const root={textNode:old};
assert.equal(refs.decorate(root,{mode:"tooltip"}),2);
const chips=changed[0].children.filter(x=>x.tag==="button");
assert.equal(chips.length,2);
assert.ok(chips.every(x=>x.type==="button"&&x.attributes["aria-haspopup"]==="dialog"));
assert.ok(chips.every(x=>x.events.click?.length===1),"Touch tap needs click");
assert.ok(chips.every(x=>x.events.pointerenter?.length===1),"Desktop tooltip needs hover");

const trigger=chips[0];
trigger.fire("pointerenter",{pointerType:"mouse"});
const panel=body.find(x=>x.className?.includes("luminous-rule-card"));
assert.ok(panel && !panel.hidden,"Hover should reveal tooltip");
assert.equal(panel.parentNode,body,"Tooltip lives in document.body, NOT overflow-y:auto Traits list");
assert.equal(panel.querySelector("strong").textContent,"Rupture");
trigger.fire("pointerleave",{pointerType:"mouse"});
assert.equal(panel.hidden,true,"Unpinned hover tooltip should close");
trigger.fire("pointerenter",{pointerType:"touch"});
assert.equal(panel.hidden,true,"Touch pointerenter must not show a fleeting hover tooltip");
trigger.fire("click");
assert.equal(panel.hidden,false,"Touch click opens tooltip");
assert.equal(trigger.attributes["aria-expanded"],"true");
trigger.fire("pointerleave",{pointerType:"mouse"});
assert.equal(panel.hidden,false,"Tapped card remains open after pointer leaves");
document.fire("keydown",{key:"Escape",preventDefault(){}});
assert.equal(panel.hidden,true,"Escape closes card");
trigger.fire("click");
assert.equal(panel.hidden,false,"Keyboard button activation (click) opens");
// Codex P2: the help card has max-height and is independently scrollable;
// scrolling its long description must not dismiss the card mid-reading.
const cardDescription=panel.querySelector(".luminous-rule-card__description");
assert.ok(cardDescription,"Card contains a scrollable explanation");
document.fire("scroll",{target:cardDescription});
assert.equal(panel.hidden,false,"Scrolling long rule text inside the card keeps it open");
document.fire("scroll",{target:panel});
assert.equal(panel.hidden,false,"Scrolling the card itself keeps the card open");
document.fire("scroll",{target:new Element("traits-scroll-list")});
assert.equal(panel.hidden,true,"Scrolling the Traits list still closes stale help");

const second=chips[1];
second.fire("click");
assert.equal(panel.querySelector("strong").textContent,"CON Save");
assert.ok(panel.style.top==="", "Narrow layout uses CSS bottom sheet");
panel.querySelector(".luminous-rule-card__close").fire("click");
assert.equal(panel.hidden,true,"Touch close button works");
assert.equal(second.focused,true,"Closing returns keyboard focus");

// A resolved formula is a nested button in the Trait description. A
// following sibling text node still needs the preceding mechanical context.
let formulaFragment=null;
const afterFormula={
  nodeValue:" Haste and move quickly.",
  parentElement:parent,
  parentNode:{replaceChild(fragment){formulaFragment=fragment;}}
};
const textContexts=new WeakMap([[afterFormula,"Gain 1"]]);
assert.equal(refs.decorate({textNode:afterFormula},{mode:"tooltip",textContexts}),1);
assert.ok(formulaFragment,"Formula-adjacent text is decorated without moving its control");
const hasteChip=formulaFragment.children.find(child=>child.dataset?.refId==="haste");
assert.ok(hasteChip && hasteChip.dataset.refKind==="status");
assert.equal(formulaFragment.children.map(child=>child.tag==="#text"
  ? child.nodeValue : child.querySelector("span")?.textContent).join(""),
  " Haste and move quickly.","Analysis prefix must not appear in visible text");
const plainNode={nodeValue:" Haste",parentElement:parent,
  parentNode:{replaceChild(){throw Error("Narrative text should not be decorated");}}};
assert.equal(refs.decorate({textNode:plainNode},{mode:"tooltip"}),0,
  "Haste without a mechanical context stays plain text");

// A general Trait picker renders asynchronously and replaces its description
// on every change. Exercise the actual milestone renderer with a minimal DOM:
// previously selected chips must be discarded before redecorating the new text.
class ChoiceElement {
  constructor(tag) {
    this.tag=tag;this.children=[];this.className="";this.value="";this.dataset={};
    this.hidden=false;this.events={};this._text="";
  }
  set textContent(value){this._text=String(value);this.children=[];this.chips=[];}
  get textContent(){return this._text;}
  append(...items){this.children.push(...items);}
  appendChild(item){this.append(item);return item;}
  replaceChildren(...items){this.children=[...items];}
  setAttribute(){}
  addEventListener(name,fn){(this.events[name] ||= []).push(fn);}
  fire(name){for(const fn of this.events[name] || [])fn();}
  findByClass(name) {
    if(this.className.split(/\\s+/).includes(name))return this;
    for(const child of this.children){const found=child.findByClass?.(name);if(found)return found;}
    return null;
  }
}
const choiceDoc={createElement:tag=>new ChoiceElement(tag)};
const decorations=[];
const choiceWindow={
  document:choiceDoc,
  LuminousClassMilestones:{
    earnedMilestones:()=>[{classId:"fighter",milestoneLevel:20}],
    choiceAt:()=>null,selectedGeneralTraitIds:()=>[],
    isGeneralTraitDefinition:definition=>definition.category==="general",
  },
  LuminousPlayerProgressionTreeCore:{normalizeClasses:()=>[{classId:"fighter",levels:20}]},
  LuminousTraitCatalogCore:{allDefinitions:()=>({
    endurance:{id:"endurance",name:"Endurance",category:"general",
      description:"Make a CON Save against the effect."},
    ember_touch:{id:"ember_touch",name:"Ember Touch",category:"general",
      description:"On Hit: inflict 2 Burn."},
  })},
  LuminousRuleReferences:{
    decorate(node,{mode}) {
      const chips=refs.tokenize(node.textContent).filter(part=>part.kind)
        .map(part=>part.kind+":"+part.id);
      node.chips=chips;
      decorations.push({mode,text:node.textContent,chips});
      return chips.length;
    }
  }
};
vm.runInNewContext(fs.readFileSync(path.join(base,"js/player-progression-choices.js"),"utf8"),
  {window:choiceWindow});
const milestoneHost=new ChoiceElement("section");
assert.equal(choiceWindow.LuminousPlayerProgressionChoices.renderMilestone(milestoneHost,{
  character:{},classId:"fighter",level:20,
}),true);
const pickerMode=milestoneHost.findByClass("player-progression-choice-select");
assert.ok(pickerMode,"Unlocked milestone exposes its selection mode");
pickerMode.value="trait";pickerMode.fire("change");
// allDefinitions() is asynchronous even when backed by a local catalog.
await new Promise(resolve=>setImmediate(resolve));
const traitPicker=milestoneHost.findByClass("player-progression-choice-trait");
const traitDescription=milestoneHost.findByClass("player-progression-choice-trait-description");
assert.ok(traitPicker && traitDescription,
  "General Trait picker and its description render after async catalog load");
traitPicker.value="endurance";traitPicker.fire("change");
assert.deepEqual(Array.from(traitDescription.chips),["save:con"]);
assert.equal(traitDescription.textContent,"Make a CON Save against the effect.");
traitPicker.value="ember_touch";traitPicker.fire("change");
assert.deepEqual(Array.from(traitDescription.chips),["status:burn"],
  "Switching Traits replaces the old reference chips");
traitPicker.value="";traitPicker.fire("change");
assert.deepEqual(Array.from(traitDescription.chips),[],
  "The no-selection state clears outdated references");
traitPicker.value="endurance";traitPicker.fire("change");
assert.deepEqual(Array.from(traitDescription.chips),["save:con"],
  "Reselecting a Trait rebuilds its references");
assert.equal(decorations.length,4);
assert.ok(decorations.every(item=>item.mode==="card"),
  "Progression uses rule cards, not trait-panel tooltips");

const css=fs.readFileSync(path.join(base,"css/rule-reference-ui.css"),"utf8");
assert.doesNotMatch(css,/\.is-tooltip:hover::after/);
assert.match(css,/position:fixed/);
console.log("rule-reference-interaction-smoke: ok (mobile tap, keyboard, hover, body portal, scroll)");
