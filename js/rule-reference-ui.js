(function (global) {
  "use strict";
  if (global.LuminousRuleReferences) return;
  const doc = global.document || null;
  const STATS = Object.freeze({
    str:["Strength","Fuerza"],dex:["Dexterity","Destreza"],con:["Constitution","Constitución"],
    int:["Intelligence","Inteligencia"],wis:["Wisdom","Sabiduría"],cha:["Charisma","Carisma"]
  });
  // Icon IDs and Stat assignments are identical to the existing player Stats runtime.
  const SKILLS = Object.freeze({
    athletics:["Athletics","Atletismo","Fuerza física, trepar, nadar y superar obstáculos."],
    acrobatics:["Acrobatics","Acrobacias","Equilibrio y movimientos acrobáticos."],
    sleight_of_hand:["Sleight of Hand","Juego de Manos","Destreza manual y manipulación discreta."],
    stealth:["Stealth","Sigilo","Moverse y ocultarse sin ser detectado."],
    arcana:["Arcana","Arcanos","Conocimiento de fenómenos arcanos."],
    history:["History","Historia","Conocimiento de acontecimientos históricos."],
    investigation:["Investigation","Investigación","Examinar pistas y deducir información."],
    nature:["Nature","Naturaleza","Conocimiento del mundo natural."],
    religion:["Religion","Religión","Conocimiento de creencias y tradiciones religiosas."],
    animal_handling:["Animal Handling","Trato con Animales","Calmar, guiar e interactuar con animales."],
    insight:["Insight","Perspicacia","Interpretar intenciones y comportamientos."],
    medicine:["Medicine","Medicina","Examinar lesiones, enfermedades y prestar asistencia."],
    perception:["Perception","Percepción","Notar detalles, señales o presencias."],
    survival:["Survival","Supervivencia","Orientación, rastreo y subsistencia."],
    deception:["Deception","Engaño","Ocultar intenciones y convencer mediante engaños."],
    intimidation:["Intimidation","Intimidación","Ejercer presión mediante amenazas o presencia."],
    performance:["Performance","Interpretación","Actuación y expresión escénica."],
    persuasion:["Persuasion","Persuasión","Convencer mediante razones o negociación."]
  });
  const SKILL_STATS = Object.freeze({
    athletics:"str",acrobatics:"dex",sleight_of_hand:"dex",stealth:"dex",
    arcana:"int",history:"int",investigation:"int",nature:"int",religion:"int",
    animal_handling:"wis",insight:"wis",medicine:"wis",perception:"wis",survival:"wis",
    deception:"cha",intimidation:"cha",performance:"cha",persuasion:"cha"
  });
  const spellEffects = new Map();
  const normalize = value => String(value == null ? "" : value).trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");

  function registerSpellEffect(def = {}) {
    const id = normalize(def.id || def.name);
    // Unique Spell effects need actual source definitions; never guess rules.
    if (!id || !String(def.description || "").trim()) return null;
    const entry = Object.freeze({id,name:String(def.name || id),
      description:String(def.description),icon:String(def.icon || ""),
      aliases:Array.isArray(def.aliases) ? def.aliases.map(String) : []});
    spellEffects.set(id,entry);
    return entry;
  }
  function resolve(kind,id) {
    const key = normalize(id);
    if (kind === "skill" && SKILLS[key]) {
      const [name,spanish,description] = SKILLS[key], stat = SKILL_STATS[key];
      return {kind,id:key,name,category:"Skill · " + stat.toUpperCase(),
        icon:"Assets/Icons/skills/" + key + ".png",
        description:description + " Asociada a " + STATS[stat][0] +
          "; el resultado depende del Score, la competencia y los modificadores aplicables."};
    }
    if ((kind === "save" || kind === "check") && STATS[key]) {
      const ab = STATS[key];
      return {kind,id:key,name:key.toUpperCase() + (kind === "save" ? " Save" : " Check"),
        category:kind === "save" ? "Saving Throw" : "Ability Check",
        icon:"Assets/Icons/stats/" + key + ".png",
        description:(kind === "save" ? "Salvación de " + ab[1] +
          " para resistir el efecto que la solicita." : "Check de " + ab[1] +
          " para intentar una acción relacionada con esa característica.") +
          " El Threshold y las consecuencias los determina la fuente del efecto."};
    }
    if (kind === "status") {
      const entry = global.LuminousStatusLibrary?.get?.(key)
        || global.STATUS_REGISTRY?.[key] || null;
      if (!entry?.description) return null;
      return {kind,id:key,name:String(entry.name || key),category:"Status Effect",
        description:String(entry.description),icon:String(entry.icon || "")};
    }
    if (kind === "spell_effect") {
      const entry = spellEffects.get(key);
      return entry ? {...entry,kind,category:"Spell Effect"} : null;
    }
    return null;
  }
  function names() {
    const entries=[];
    Object.entries(SKILLS).forEach(([id, [name,spanish]]) => {
      entries.push({name,id,kind:"skill"});
      entries.push({name:spanish,id,kind:"skill"});
    });
    (global.LuminousStatusLibrary?.list?.() || []).forEach(x => {
      if (x?.name && x.description) entries.push({name:String(x.name),id:x.id,kind:"status"});
    });
    spellEffects.forEach(x => {
      entries.push({name:x.name,id:x.id,kind:"spell_effect"});
      x.aliases.forEach(name => entries.push({name,id:x.id,kind:"spell_effect"}));
    });
    return entries.filter(x => x.name.length >= 4).sort((a,b) => b.name.length-a.name.length);
  }
  function tokenize(source) {
    const value=String(source || ""), list=names(), byName=new Map();
    list.forEach(item => {const k=item.name.toLowerCase();if(!byName.has(k))byName.set(k,item);});
    const escaped = [...byName.keys()].map(x => x.replace(/[\^$*+?.()|[\]{}]/g,"\\$&"));
    const alternative=escaped.length ? "(?:" + escaped.join("|") + ")" : "(?!)";
    const statName="(?:STR|DEX|CON|INT|WIS|CHA|Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)";
    const save=statName + "\\s+(?:Saving\\s+Throws?|Saves?|Checks?)";
    const regex=new RegExp("\\b(?:" + save + "|" + alternative + ")\\b","gi");
    const result=[];let last=0,hit;
    while ((hit=regex.exec(value))) {
      const word=hit[0];let found=null;
      const stat=word.match(/^(STR|DEX|CON|INT|WIS|CHA|Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+(Saving\s+Throws?|Saves?|Checks?)$/i);
      if (stat) {
        const key=Object.keys(STATS).find(k => k===stat[1].toLowerCase()
          || STATS[k][0].toLowerCase()===stat[1].toLowerCase());
        if (key) found={kind:/check/i.test(stat[2]) ? "check" : "save",id:key};
      } else {
        const entry=byName.get(word.toLowerCase());
        if (entry) found={kind:entry.kind,id:entry.id};
      }
      if (!found || !resolve(found.kind,found.id)) continue;
      if (hit.index>last) result.push({text:value.slice(last,hit.index)});
      result.push({text:word,kind:found.kind,id:found.id});
      last=hit.index+word.length;
    }
    if (last<value.length) result.push({text:value.slice(last)});
    return result.length ? result : [{text:value}];
  }

  let popover=null,active=null;
  function ensureStyles() {
    if (!doc?.head || doc.getElementById("luminous-rule-references-css")) return;
    const css=doc.createElement("link");
    css.id="luminous-rule-references-css";
    css.rel="stylesheet";css.href="css/rule-reference-ui.css";doc.head.appendChild(css);
  }
  function dismiss(restore=false) {
    if (!popover) return;
    const old=active;
    popover.hidden=true;active=null;
    old?.setAttribute?.("aria-expanded","false");
    if (restore) old?.focus?.();
  }
  function ensurePopover() {
    if (!doc?.body) return null;
    if (popover?.isConnected) return popover;
    popover=doc.createElement("section");
    popover.className="luminous-rule-card";popover.hidden=true;
    popover.setAttribute("role","dialog");popover.setAttribute("aria-modal","false");
    popover.setAttribute("aria-label","Referencia de reglas");
    const head=doc.createElement("header");
    const image=doc.createElement("img");
    image.className="luminous-rule-card__icon";image.alt="";
    image.setAttribute("aria-hidden","true");
    const texts=doc.createElement("div");
    const category=doc.createElement("small"), title=doc.createElement("strong");
    texts.append(category,title);
    const close=doc.createElement("button");close.type="button";
    close.className="luminous-rule-card__close";close.textContent="×";
    close.setAttribute("aria-label","Cerrar explicación");
    close.addEventListener("click",()=>dismiss(true));
    head.append(image,texts,close);
    const description=doc.createElement("p");description.className="luminous-rule-card__description";
    popover.append(head,description);doc.body.appendChild(popover);
    doc.addEventListener("keydown",event=>{
      if(event.key==="Escape" && !popover.hidden){event.preventDefault();dismiss(true);}
    });
    doc.addEventListener("pointerdown",event=>{
      if(!popover.hidden && !popover.contains(event.target)
        && !event.target?.closest?.(".luminous-rule-reference"))dismiss();
    });
    return popover;
  }
  function show(trigger) {
    const info=resolve(trigger.dataset.refKind,trigger.dataset.refId);
    if (!info) return;
    if (active===trigger && popover && !popover.hidden) {dismiss();return;}
    dismiss();ensureStyles();
    const card=ensurePopover();if (!card) return;
    const image=card.querySelector(".luminous-rule-card__icon");
    image.hidden=!info.icon;
    if(info.icon)image.src=info.icon;
    card.querySelector("small").textContent=info.category;
    card.querySelector("strong").textContent=info.name;
    card.querySelector("p").textContent=info.description;
    card.hidden=false;active=trigger;trigger.setAttribute("aria-expanded","true");
    const rect=trigger.getBoundingClientRect();
    const vw=doc.documentElement.clientWidth || global.innerWidth || 800;
    const vh=doc.documentElement.clientHeight || global.innerHeight || 700;
    if (vw>760) {
      const width=Math.min(390,vw-20);
      card.style.width=width+"px";
      card.style.left=Math.max(10,Math.min(vw-width-10,rect.left))+"px";
      const height=Math.min(card.offsetHeight,vh-20);
      card.style.top=(rect.bottom+height+12<vh?rect.bottom+8:Math.max(10,rect.top-height-8))+"px";
    } else {card.style.left="";card.style.top="";card.style.width="";}
  }
  function createReference(part,mode) {
    const info=resolve(part.kind,part.id);
    if (!info) return doc.createTextNode(part.text);
    const ref=doc.createElement(mode==="tooltip"?"span":"button");
    ref.className="luminous-rule-reference is-"+mode;
    ref.dataset.refKind=part.kind;ref.dataset.refId=part.id;
    if (mode==="tooltip") {
      ref.tabIndex=0;ref.setAttribute("role","note");
      ref.title=info.name+" — "+info.description;
      ref.setAttribute("aria-label",info.name+". "+info.description);
    } else {
      ref.type="button";ref.setAttribute("aria-haspopup","dialog");
      ref.setAttribute("aria-expanded","false");
      ref.setAttribute("aria-label","Consultar "+info.name);
      ref.addEventListener("click",()=>show(ref));
    }
    if(info.icon){
      const image=doc.createElement("img");image.src=info.icon;image.alt="";
      image.setAttribute("aria-hidden","true");
      image.addEventListener("error",()=>{image.hidden=true;},{once:true});
      ref.appendChild(image);
    }
    const label=doc.createElement("span");label.textContent=part.text;ref.appendChild(label);
    return ref;
  }
  function decorate(root,{mode="card"}={}) {
    if (!doc?.createTreeWalker || !root) return 0;
    ensureStyles();
    const walker=doc.createTreeWalker(root,4), nodes=[];
    while(walker.nextNode()){
      const node=walker.currentNode,parent=node.parentElement;
      if(!node.nodeValue?.trim() || !parent)continue;
      if(parent.closest?.("button,a,textarea,input,select,script,style,code,pre,.luminous-rule-reference,.luminous-rule-card,[contenteditable]"))continue;
      nodes.push(node);
    }
    let count=0;
    nodes.forEach(node=>{
      const parts=tokenize(node.nodeValue);
      if(!parts.some(p=>p.kind))return;
      const fragment=doc.createDocumentFragment();
      parts.forEach(part=>fragment.appendChild(part.kind?createReference(part,mode):doc.createTextNode(part.text)));
      node.parentNode?.replaceChild(fragment,node);
      count+=parts.filter(p=>p.kind).length;
    });
    return count;
  }
  const api=Object.freeze({STATS,SKILLS,SKILL_STATS,resolve,tokenize,decorate,registerSpellEffect,dismiss});
  global.LuminousRuleReferences=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
