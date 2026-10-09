(() => {
"use strict";
const data = window.LuminousEnchantmentDesignReview;
const $ = (id) => document.getElementById(id);
if (!data || !Array.isArray(data.ENCHANTMENTS)) {
  $("detail").textContent = "The design archive could not be loaded.";
  return;
}
const entries = data.ENCHANTMENTS;
const search = $("search");
const school = $("school");
const slot = $("slot");
const axis = $("axis");
let selectedId = new URLSearchParams(location.search).get("entry") || "flamebound";
function addOption(select, text, value) {
  const option = document.createElement("option");
  option.value = value; option.textContent = text;
  select.appendChild(option);
}
data.SCHOOLS.forEach((s) => addOption(school, s, s));
const slots = [...new Set(entries.flatMap((entry) => entry.items))].sort();
slots.forEach((s) => addOption(slot, s, s));
const AXES = [
  ["elemental","Elemental"], ["hp","HP / Healing"], ["sp","SP / Sanity"],
  ["speed","Speed / Haste / Bind"], ["offense","Offensive Level"], ["defense","Defensive Level"],
  ["scores","STR / DEX / CON / INT / WIS / CHA"], ["maxhp","Max HP"], ["regen","HP / SP Regen"],
  ["physicalward","Physical damage ward"], ["sinward","SIN damage ward"], ["sploss","SP loss reduction"],
  ["damageboost","Damage amplification"], ["premium","Premium universal damage"],
  ["on_turn_start","Turn Start"], ["encounter_start","Encounter Start"],
  ["on_hit","On Hit"], ["before_getting_hit","Before Getting Hit"]
];
AXES.forEach(([id,label]) => addOption(axis,label,id));
const elementalSchools = new Set(["Infernal","Glacial","Tempest","Corrosive","Venomous","Tidal","Geomantic"]);
function hasAxis(entry, axisId) {
  const text = [entry.baseEffect || "", entry.tiers.I, entry.statuses || "", ...(entry.axes || [])].join(" ");
  switch (axisId) {
    case "elemental": return elementalSchools.has(entry.school);
    case "hp": return /\bHP\b|healing|recover.*\bHP\b/i.test(text);
    case "sp": return /\bSP\b|Sinking|sanity/i.test(text);
    case "speed": return /\bSpeed\b|\bHaste\b|\bBind\b/i.test(text);
    case "offense": return /Offensive Level/i.test(text);
    case "defense": return /Defensive Level/i.test(text);
    case "scores": return /\b(?:STR|DEX|CON|INT|WIS|CHA) Score\b/i.test(text);
    case "maxhp": return /Base Max HP|Max HP/i.test(text);
    case "regen": return /HP Regeneration|SP Recovery|At Turn Start, recover/i.test(text) || (entry.axes||[]).some(x=>/Regen|Recovery/.test(x));
    case "physicalward": return entry.resistance?.scope === "physical";
    case "sinward": return entry.resistance?.scope === "sin";
    case "sploss": return /SP Loss Reduction/i.test(text);
    case "damageboost": return Boolean(entry.damageBonus);
    case "premium": return entry.damageBonus?.priority==="premium";
    case "on_turn_start": return entry.event==="turn_start" || /At Turn Start/i.test(entry.baseEffect || "");
    case "encounter_start": return entry.event==="encounter_start" || /At Encounter Start/i.test(entry.baseEffect || "");
    case "on_hit": return entry.event==="on_hit" || /weapon-linked Hit|after a Hit|when a Hit/i.test(entry.baseEffect || "");
    case "before_getting_hit": return entry.event==="before_getting_hit" || /Before Getting Hit/i.test(entry.baseEffect || "");
    default: return true;
  }
}
const node = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
};
function appendText(host,tag,className,text) {
  const el=node(tag,className,text);host.appendChild(el);return el;
}
function displayItem(e) {
  return "Example Item: " + e.exampleItem + "  ·  Equipment: " + e.kind.toUpperCase();
}
function renderDetail(entry) {
  const target=$("detail");
  target.replaceChildren();
  appendText(target,"div","discipline",entry.school + " / Inscription");
  appendText(target,"h2","",entry.name + " III");
  appendText(target,"p","item-name",displayItem(entry));
  if(Array.isArray(entry.axes)&&entry.axes.length) appendText(target,"p","item-name","Combat axes: " + entry.axes.join(" · "));
  if(entry.resistance) appendText(target,"p","item-name","Specific resistance: " + entry.resistance.type.toUpperCase() + " (" + entry.resistance.scope + " damage only)");
  if(entry.damageBonus) appendText(target,"p","item-name","Damage amplifier: " + entry.damageBonus.scope.toUpperCase() + " / " + entry.damageBonus.type + (entry.damageBonus.priority === "premium" ? " · PREMIUM / COSTLIER · BASE UNDER REVIEW" : " · SPECIALIST / LOWER COST"));
  if(entry.magicDurabilityRequired) appendText(target,"p","risk","Magic Durability: 1 point per valid property use; depleted enchantments do not activate. Charge-pool rules for non-weapon items and multi-Coin Skill usage are pending.");
  appendText(target,"h3","rule-heading","COMPATIBLE CHASSIS IDS");
  appendText(target,"p","limits",entry.allowedChassisIds.join(" · "));
  appendText(target,"p","lore","“" + entry.lore + "”");
  const ranks=appendText(target,"section","ranks","");
  ["I","II","III"].forEach((tier) => {
    const wrap=node("article","rank");
    appendText(wrap,"h3","","RANK " + tier + " — " + ({I:"BASE ×1.00",II:"BASE ×1.50 (CEIL)",III:"BASE ×2.50 (CEIL)"}[tier]));
    appendText(wrap,"p","",entry.tiers[tier]);
    ranks.appendChild(wrap);
  });
  appendText(target,"h3","rule-heading","ONE BASE EFFECT · THREE SCALED RANKS");
  appendText(target,"p","limits","Every Rank retains the same trigger and behavior. Only named effect magnitudes are scaled with ceil(Base × Multiplier).");
  appendText(target,"h3","rule-heading","CONSTRAINTS & COUNTERPLAY");
  appendText(target,"p","limits",entry.limits);
  appendText(target,"h3","rule-heading","MECHANICAL REFERENCES");
  const tags=node("div","tags");
  entry.statuses.split(";").map(x=>x.trim()).filter(Boolean).forEach((tag)=>appendText(tags,"span","tag",tag));
  target.appendChild(tags);
  appendText(target,"p","risk","Requires engine work: " + (entry.requiresEngine ? "Yes — concept has not been implemented or QA tested." : "Review required."));
  const review=node("div","review");
  appendText(review,"strong","","PROPOSED · NOT APPROVED · NOT PLAYABLE");
  appendText(review,"p","","Design pass needed: name, compatible chassis, base effect, magnitude caps, trigger timing, source binding, attunement, recipes, production cost and rarity. Ranks cannot unlock extra abilities.");
  target.appendChild(review);
}
function visible() {
  const term=search.value.trim().toLowerCase();
  return entries.filter(e=>(!school.value||e.school===school.value)&&(!slot.value||e.items.includes(slot.value))&&(!axis.value||hasAxis(e,axis.value))&&(!term||[e.name,e.school,e.lore,e.statuses,e.baseEffect||"",...(e.axes||[]),...Object.values(e.tiers)].join(" ").toLowerCase().includes(term)));
}
function render() {
  const list=visible();
  $("count").textContent=list.length+" / "+entries.length;
  const nav=$("entries");nav.replaceChildren();
  if(!list.length){appendText(nav,"div","empty","No inscriptions match these filters.");$("detail").replaceChildren();appendText($("detail"),"div","detail-placeholder","Choose a different search or discipline.");return;}
  const selected=list.find(e=>e.id===selectedId)||list[0];selectedId=selected.id;
  list.forEach((e)=>{
    const button=node("button","");
    button.type="button";
    button.setAttribute("aria-current",String(e.id===selectedId));
    appendText(button,"strong","",e.name);
    appendText(button,"span","",e.school+" · "+e.items.join(" / "));
    button.addEventListener("click",()=>{
      selectedId=e.id;render();
      $("detail").focus({preventScroll:true});
    });
    nav.appendChild(button);
  });
  renderDetail(selected);
}
[search,school,slot,axis].forEach(control=>control.addEventListener("input",render));
render();
})();