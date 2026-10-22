/* Forja de habilidades: a guided DM experience above canonical Schema v2.
 * Does not implement a second Skill engine or an independent save path.
 */
(function(global){
  "use strict";
  const doc=global.document;
  if(!doc || !doc.getElementById("editorScroll"))return;
  const byId=id=>doc.getElementById(id);
  const storage={step:0,preset:"attack",authorized:false};
  const sections=Array.from(doc.querySelectorAll(".editor-scroll > .section"));
  const guide=[
    ["Dale identidad a la Skill","Elige qué hace: atacar, protegerse o responder con un Clash. Después ponle nombre."],
    ["Forja sus Coins","Ajusta el poder y sus Coins. Cada Coin puede tener sus propios efectos al impactar."],
    ["Escribe sus efectos","Escoge qué sucede y cuándo. No necesitas escribir comandos ni conocer el motor."],
    ["Detalles de la técnica","Ajusta las reglas avanzadas solo si tu Skill lo necesita."]
  ];
  const presets=[
    {key:"attack",name:"Ataque",desc:"Enfrenta a un enemigo en un Clash normal.",type:"Attack",subtype:""},
    {key:"clashableguard",name:"Guard Clashable",desc:"Gana: Tremor. Pierde: mitiga el ataque.",type:"Defense",subtype:"ClashableGuard"},
    {key:"clashablecounter",name:"Counter Clashable",desc:"Gana el Clash y contraataca. Solo Action Slot.",type:"Defense",subtype:"ClashableCounter"},
    {key:"guard",name:"Guard",desc:"Protección mediante Shield.",type:"Defense",subtype:"Guard"},
    {key:"evade",name:"Evade",desc:"Elude ataques con una tirada defensiva.",type:"Defense",subtype:"Evade"},
    {key:"counter",name:"Counter",desc:"Responde después de recibir el golpe.",type:"Defense",subtype:"Counter"},
    {key:"spell",name:"Conjuro ofensivo",desc:"Skill de combate con tipo Spell.",type:"Spell",subtype:""}
  ];
  const sectionIndex=[0,1,2,3,4,5,6];
  const stepGroups=[[0],[1,2,3],[5],[4,6]];
  const labels={
    "Nombre":"Nombre de la habilidad",
    "Type":"Función de combate",
    "Base Power":"Poder base",
    "Coin Power":"Poder por cara",
    "Coin Amount":"Cantidad de Coins",
    "Coin Sign":"Polaridad de Coins",
    "Tier":"Nivel de la técnica",
    "Attack Weight":"Objetivos / peso de ataque",
    "Range":"Alcance",
    "Skill Amount":"Copias en el Deck",
    "Damage Type":"Tipo de daño",
    "Scaling Stat":"Atributo utilizado",
    "Skill Used":"Competencia",
    "Targeting Type":"Tipo de objetivo",
    "AoE Pattern":"Área de efecto",
    "Defense Subtype":"Estilo defensivo",
    "Source":"Origen",
    "Defense Skill":"Es una defensa",
    "Item Skill":"Es una habilidad de objeto",
    "Clashable":"Puede hacer Clash",
    "Unclashable":"No puede hacer Clash",
    "Indiscriminate":"Sin distinguir objetivos",
    "Target Fixed":"Objetivo fijo",
    "Requires Unlock":"Requiere desbloqueo",
    "Status ID":"Estado",
    "Potency":"Potencia",
    "Count":"Conteo",
    "Max Cap":"Máximo",
    "Target":"Objetivo",
    "Trigger":"Cuándo ocurre",
    "Type of Effect":"Qué sucede"
  };
  const triggers={
    "[Turn Start]":"Al comenzar turno",
    "[Combat Start]":"Al empezar combate",
    "[Before Use]":"Antes de usar",
    "[On Use]":"Al usar la Skill",
    "[Clash Start]":"Al iniciar Clash",
    "[Before Clash]":"Antes del Clash",
    "[Clash Win]":"Al ganar Clash",
    "[On Clash Win]":"Al ganar Clash",
    "[Clash Lose]":"Al perder Clash",
    "[On Clash Lose]":"Al perder Clash",
    "[Before Attack]":"Antes de atacar",
    "[On Unopposed Attack]":"Ataque sin oposición",
    "[On Kill]":"Al derrotar enemigo",
    "[Attack End]":"Al terminar el ataque",
    "[On Evade]":"Al esquivar",
    "[Coin Start]":"Al iniciar Coin",
    "[On Hit]":"Al impactar",
    "[Heads Hit]":"Cara al impactar",
    "[Tails Hit]":"Cruz al impactar",
    "[Hit after Clash Win]":"Impacto tras ganar Clash",
    "[Hit after Clash Lose]":"Impacto tras perder Clash",
    "[On Crit]":"Al impactar crítico",
    "[On Crit - Heads Hit]":"Crítico con cara",
    "[On Crit - Tails Hit]":"Crítico con cruz",
    "[On Hit without Cracking]":"Impacto sin romper Coin",
    "[Heads]":"Al sacar cara",
    "[Tails]":"Al sacar cruz",
    "[Current Coin Attack End]":"Al terminar esta Coin",
    "[Heads Attack End]":"Al finalizar con cara",
    "[Tails Attack End]":"Al finalizar con cruz",
    "[Before Getting Hit]":"Antes de recibir daño",
    "[On Crit Kill]":"Al derrotar con crítico",
    "[On Crit Kill Against Enemy]":"Crítico letal contra enemigo"
  };
  function renameLabels(root){
    root.querySelectorAll(".field-name").forEach(node=>{
      const raw=node.textContent.trim();
      if(labels[raw] && node.textContent!==labels[raw])node.textContent=labels[raw];
    });
    root.querySelectorAll("select.trigger-select option").forEach(op=>{
      const text=triggers[op.value];
      if(text && op.textContent!==text)op.textContent=text;
    });
  }
  function el(tag,className,text){
    const n=doc.createElement(tag);
    if(className)n.className=className;
    if(text!==undefined)n.textContent=text;
    return n;
  }
  function attr(node,key,value){node.setAttribute(key,value);return node;}
  const editor=byId("editorScroll");
  const intro=el("div","forge-intro");
  const introTitle=el("strong","","Forja tu próxima habilidad");
  const introText=el("p","","De la idea al combate: define la técnica, configura sus Coins y decide qué sucede cuando se activa.");
  intro.append(introTitle,introText);
  const nav=el("nav","forge-steps");nav.setAttribute("aria-label","Etapas de creación");
  ["Concepto","Coins y poder","Efectos","Detalles"].forEach((label,index)=>{
    const b=el("button","forge-step",label);b.type="button";
    b.dataset.step=String(index);
    b.setAttribute("aria-current",index===0?"step":"false");
    b.prepend(el("span","",String(index+1).padStart(2,"0")));
    b.addEventListener("click",()=>showStep(index));
    nav.appendChild(b);
  });
  const presetHost=el("div","forge-presets");
  presets.forEach(p=>{
    const b=el("button","forge-preset");
    b.type="button";b.dataset.preset=p.key;
    b.append(el("strong","",p.name),el("small","",p.desc));
    b.addEventListener("click",()=>applyPreset(p));
    presetHost.appendChild(b);
  });
  const guideBox=el("div","forge-guide");
  const guideCopy=el("span","");
  guideBox.append(guideCopy);
  const stepsNext=el("div","forge-advance");
  const previous=el("button","btn","","");
  previous.type="button";previous.textContent="Anterior";
  const next=el("button","btn primary","Siguiente paso");next.type="button";
  previous.addEventListener("click",()=>showStep(storage.step-1));
  next.addEventListener("click",()=>{if(storage.step===3)byId("btnSave").click();else showStep(storage.step+1);});
  stepsNext.append(previous,next);
  const slot=sections[0];
  editor.insertBefore(intro,slot);
  editor.insertBefore(nav,slot);
  editor.insertBefore(guideBox,slot);
  editor.insertBefore(presetHost,slot);
  editor.appendChild(stepsNext);
  const originalTitles=[
    "La identidad de tu técnica","Poder y Coins","Perfil de combate",
    "Objetivo y alcance","Reglas especiales","Efectos de la habilidad","Evolución"
  ];
  sections.forEach((section,i)=>{
    const heading=section.querySelector(".section-title");
    if(heading)heading.textContent=originalTitles[i];
  });
  const help={
    1:"Poder base es la fuerza inicial. Cada Coin con cara suma el poder indicado. Las Coins rojas pueden ser irrompibles.",
    2:"No necesitas aprender códigos de estado: elige el estado, su potencia y cuándo se aplica.",
    3:"Esta sección reúne controles especiales. Puedes dejar sus valores predeterminados."
  };
  sections[1].querySelector(".section-body")?.prepend(el("p","forge-progress-copy",help[1]));
  sections[5].querySelector(".section-body")?.prepend(el("p","forge-progress-copy",help[2]));
  sections[4].querySelector(".section-body")?.prepend(el("p","forge-progress-copy",help[3]));
  const fId=byId("f-id");if(fId)fId.closest(".field").hidden=true;
  const type=byId("f-type");if(type){
    Array.from(type.options).forEach(option=>{
      const m={Attack:"Ataque",Defense:"Defensa",Spell:"Conjuro",Roll:"Tirada"};
      if(m[option.value])option.textContent=m[option.value];
    });
  }
  const defenseSelect=byId("f-defense-subtype");
  if(defenseSelect){
    Array.from(defenseSelect.options).forEach(option=>{
      const m={Guard:"Guard · escudo",Evade:"Evade · evasión",Counter:"Counter · contraataque",
        ClashableGuard:"Guard Clashable",ClashableCounter:"Counter Clashable"};
      if(m[option.value])option.textContent=m[option.value];
    });
  }
  const search=byId("search");if(search)search.placeholder="Buscar por nombre...";
  const searchWelcome=el("p","forge-welcome","Tu biblioteca de habilidades. Selecciona una para editarla.");
  byId("skillList")?.parentNode.insertBefore(searchWelcome,byId("skillList"));
  const header=doc.querySelector(".brand h1");if(header)header.textContent="FORJA DE HABILIDADES";
  const kicker=doc.querySelector(".brand small");if(kicker)kicker.textContent="Taller del Director • Limbus";
  const previewTitle=doc.querySelector(".preview-pane .pane-header h2");
  if(previewTitle)previewTitle.textContent="Carta de habilidad";
  const btnNew=byId("btnNew");if(btnNew)btnNew.textContent="Nueva Skill";
  const btnDuplicate=byId("btnDuplicate");if(btnDuplicate)btnDuplicate.textContent="Duplicar";
  const btnSave=byId("btnSave");if(btnSave)btnSave.textContent="Guardar en biblioteca";
  const btnEffect=byId("btnAddGlobalEffect");if(btnEffect)btnEffect.textContent="+ Añadir efecto";
  const equip=el("a","forge-link","Ir al equipamiento");equip.href="pantalla_dm.html";equip.title="Abre el panel del Director para equipar las Skills guardadas.";
  doc.querySelector(".toolbar")?.appendChild(equip);
  const legend=el("p","forge-preview-legend","Esta carta muestra cómo se leerá la técnica. El combate real resolverá las tiradas, estados y Coins.");
  doc.querySelector(".preview-body")?.appendChild(legend);
  const coinInput=byId("f-coin-amount");if(coinInput){
    const wrap=el("div","forge-footer-actions");
    const minus=el("button","btn small","− Coin");
    const plus=el("button","btn small","+ Coin");
    for(const b of [minus,plus])b.type="button";
    minus.addEventListener("click",()=>adjustCoins(-1));
    plus.addEventListener("click",()=>adjustCoins(1));
    wrap.append(minus,plus);coinInput.closest(".field")?.append(wrap);
  }
  function adjustCoins(change){
    const count=Math.max(1,Math.min(12,(Number(coinInput.value)||1)+change));
    coinInput.value=String(count);
    coinInput.dispatchEvent(new Event("input",{bubbles:true}));
  }
  function showStep(index){
    storage.step=Math.min(3,Math.max(0,index));
    sections.forEach((section,i)=>{section.hidden=!stepGroups[storage.step].includes(sectionIndex[i]);});
    Array.from(nav.children).forEach((node,i)=>node.setAttribute("aria-current",storage.step===i?"step":"false"));
    guideCopy.textContent=guide[storage.step][1];
    introTitle.textContent=guide[storage.step][0];
    previous.hidden=storage.step===0;
    next.textContent=storage.step===3?"Guardar Skill":"Continuar";
    presetHost.hidden=storage.step!==0;
    renameLabels(editor);
    if(global.innerWidth<=760)nav.scrollIntoView({block:"start",behavior:"smooth"});
  }
  function matchPreset(){
    const currentType=type?.value||"Attack";
    const sub=defenseSelect?.value||"";
    const preset=presets.find(p=>p.type===currentType&&p.subtype===sub);
    storage.preset=preset?.key||"attack";
    Array.from(presetHost.children).forEach(b=>b.classList.toggle("active",b.dataset.preset===storage.preset));
  }
  function applyPreset(p){
    if(type)type.value=p.type;
    if(byId("f-defense"))byId("f-defense").checked=p.type==="Defense";
    if(defenseSelect)defenseSelect.value=p.subtype;
    const unclashable=byId("f-unclashable");
    const clashable=byId("f-clashable");
    if(unclashable)unclashable.checked=false;
    if(clashable)clashable.checked=p.subtype.startsWith("Clashable")||p.type!=="Defense";
    if(p.subtype==="Guard"||p.subtype==="Evade"||p.subtype==="Counter"){
      if(clashable)clashable.checked=false;
    }
    if(p.key==="clashablecounter"||p.key==="clashableguard"){
      if(byId("f-coin-amount")&&(Number(byId("f-coin-amount").value)||0)<1)adjustCoins(1);
    }
    storage.preset=p.key;
    if(type)type.dispatchEvent(new Event("change",{bubbles:true}));
    if(defenseSelect)defenseSelect.dispatchEvent(new Event("change",{bubbles:true}));
    matchPreset();
    showStep(0);
  }
  function addFeedback(){
    const footer=byId("status");
    if(footer){footer.setAttribute("aria-live","polite");footer.setAttribute("role","status");}
    doc.querySelectorAll("[data-skill-meta],[data-source-id]").forEach(n=>n.hidden=true);
  }
  function authGate(){
    const gate=byId("forgeAuth");
    const status=byId("forgeAuthText");
    function message(text){if(status)status.textContent=text;}
    if(!global.firebase?.auth||!global.firebase?.database){
      message("No se pudo conectar con la campaña.");
      return;
    }
    const auth=global.firebase.auth(),db=global.firebase.database();
    auth.onAuthStateChanged(async user=>{
      storage.authorized=false;
      if(btnSave)btnSave.disabled=true;
      if(!user){message("Para usar la Forja, entra con tu cuenta de Director.");return;}
      try{
        const snap=await db.ref("campaña/config/dm_uid").once("value");
        const director=String(snap.val()||"").trim();
        // Consistent with pantalla_dm.html's existing director bootstrap.
        const bootstrap="e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1";
        if(user.uid!==director&&user.uid!==bootstrap){
          message("Esta herramienta pertenece al Director de la campaña.");
          return;
        }
        storage.authorized=true;
        if(btnSave)btnSave.disabled=false;
        if(gate)gate.hidden=true;
      }catch(error){
        message("No se pudo comprobar el acceso al taller. Entra desde el panel del Director.");
      }
    },()=>message("No se pudo comprobar la sesión. Abre de nuevo el panel del Director."));
  }
  doc.querySelectorAll(".skill-row").forEach(()=>{});
  byId("skillList")?.addEventListener("click",event=>{
    if(event.target.closest(".skill-row")){
      global.setTimeout(()=>{matchPreset();showStep(0);},0);
    }
  });
  btnNew?.addEventListener("click",()=>{global.setTimeout(()=>{matchPreset();showStep(0);},0);});
  btnDuplicate?.addEventListener("click",()=>{global.setTimeout(()=>{matchPreset();showStep(0);},0);});
  const observer=new MutationObserver(()=>{
    renameLabels(editor);
  });
  observer.observe(editor,{childList:true,subtree:true});
  editor.addEventListener("change",event=>{
    if(event.target===type||event.target===defenseSelect)matchPreset();
  });
  addFeedback();
  matchPreset();
  showStep(0);
  authGate();
})(window);