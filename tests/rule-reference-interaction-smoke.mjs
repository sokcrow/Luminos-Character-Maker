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
document.fire("scroll");
assert.equal(panel.hidden,true,"Scrolling the Traits list closes the floating tooltip");

const second=chips[1];
second.fire("click");
assert.equal(panel.querySelector("strong").textContent,"CON Save");
assert.ok(panel.style.top==="", "Narrow layout uses CSS bottom sheet");
panel.querySelector(".luminous-rule-card__close").fire("click");
assert.equal(panel.hidden,true,"Touch close button works");
assert.equal(second.focused,true,"Closing returns keyboard focus");

const css=fs.readFileSync(path.join(base,"css/rule-reference-ui.css"),"utf8");
assert.doesNotMatch(css,/\.is-tooltip:hover::after/);
assert.match(css,/position:fixed/);
console.log("rule-reference-interaction-smoke: ok (mobile tap, keyboard, hover, body portal, scroll)");
