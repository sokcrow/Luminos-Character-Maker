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
let selectedId = new URLSearchParams(location.search).get("entry") || "flamebound";
function addOption(select, text, value) {
  const option = document.createElement("option");
  option.value = value; option.textContent = text;
  select.appendChild(option);
}
data.SCHOOLS.forEach((s) => addOption(school, s, s));
const slots = [...new Set(entries.flatMap((entry) => entry.items))].sort();
slots.forEach((s) => addOption(slot, s, s));
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
  if (e.name === "Flamebound") return "Example Item: Flamebound Longsword";
  return "Compatible with: " + e.items.join(" / ");
}
function renderDetail(entry) {
  const target=$("detail");
  target.replaceChildren();
  appendText(target,"div","discipline",entry.school + " / Inscription");
  appendText(target,"h2","",entry.name + " III");
  appendText(target,"p","item-name",displayItem(entry));
  appendText(target,"p","lore","“" + entry.lore + "”");
  const ranks=appendText(target,"section","ranks","");
  ["I","II","III"].forEach((tier) => {
    const wrap=node("article","rank");
    appendText(wrap,"h3","","RANK " + tier + (tier==="III" ? " — FINAL INSCRIPTION" : ""));
    appendText(wrap,"p","",entry.tiers[tier]);
    ranks.appendChild(wrap);
  });
  appendText(target,"h3","rule-heading","CONSTRAINTS & COUNTERPLAY");
  appendText(target,"p","limits",entry.limits);
  appendText(target,"h3","rule-heading","MECHANICAL REFERENCES");
  const tags=node("div","tags");
  entry.statuses.split(";").map(x=>x.trim()).filter(Boolean).forEach((tag)=>appendText(tags,"span","tag",tag));
  target.appendChild(tags);
  appendText(target,"p","risk","Requires engine work: " + (entry.requiresEngine ? "Yes — concept has not been implemented or QA tested." : "Review required."));
  const review=node("div","review");
  appendText(review,"strong","","PROPOSED · NOT APPROVED · NOT PLAYABLE");
  appendText(review,"p","","Design pass needed: name, fantasy, trigger timing, stack caps, exclusions, interaction with other enchants, attunement, recipes, production cost and rarity.");
  target.appendChild(review);
}
function visible() {
  const term=search.value.trim().toLowerCase();
  return entries.filter(e=>(!school.value||e.school===school.value)&&(!slot.value||e.items.includes(slot.value))&&(!term||[e.name,e.school,e.lore,e.statuses,...Object.values(e.tiers)].join(" ").toLowerCase().includes(term)));
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
[search,school,slot].forEach(control=>control.addEventListener("input",render));
render();
})();