(function (global) {
  "use strict";
  const doc = global.document;
  if (!doc) return;

  const PLAYERS_ROOT = "campaña/jugadores";
  const ABILITIES = Object.freeze([
    { id: "str", key: "fuerza", code: "STR", name: "Strength" },
    { id: "dex", key: "destreza", code: "DEX", name: "Dexterity" },
    { id: "con", key: "constitucion", code: "CON", name: "Constitution" },
    { id: "int", key: "inteligencia", code: "INT", name: "Intelligence" },
    { id: "wis", key: "sabiduria", code: "WIS", name: "Wisdom" },
    { id: "cha", key: "carisma", code: "CHA", name: "Charisma" },
  ]);
  const PROFICIENCY_STATES = Object.freeze([
    { value: "none", label: "Not Proficient", multiplier: 0 },
    { value: "half", label: "Half Proficient", multiplier: 0.5 },
    { value: "proficient", label: "Proficient", multiplier: 1 },
    { value: "expertise", label: "Expertise", multiplier: 2 },
  ]);
  const state = { db: null, players: {}, playerId: null, dirty: false, mounted: false };
  const field = (id) => doc.getElementById(id);
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const proficiencyBonus = (level) => Math.ceil(Math.max(0, numberOr(level, 0)) / 20);
  const formatSigned = (value) => numberOr(value, 0) >= 0 ? `+${numberOr(value, 0)}` : String(numberOr(value, 0));

  function playerLabel(id, player) { return player?.characterName || player?.character_name || player?.nombre || player?.name || id; }
  function normalizeProficiencyState(value) {
    const normalized = String(value || "none").trim().toLowerCase();
    return PROFICIENCY_STATES.some((entry) => entry.value === normalized) ? normalized : "none";
  }
  function combatBreakdown(player, kind) {
    const level = Math.max(0, Math.trunc(numberOr(player?.level, 1)));
    const source = player?.combatLevels?.[kind] || {};
    const offense = kind === "offensive";
    const classModifier = numberOr(source.classModifier ?? player?.classModifiers?.[offense ? "offensiveLevel" : "defensiveLevel"], 0);
    const itemModifier = numberOr(source.itemModifier ?? player?.equipmentModifiers?.[offense ? "offensiveLevel" : "defensiveLevel"], 0);
    const legacyDm = player?.combatStats?.[offense ? "off_lvl_mod" : "def_lvl_mod"];
    const dmModifier = numberOr(source.dmModifier ?? legacyDm, 0);
    return { level, classModifier, dmModifier, itemModifier, total: level + classModifier + dmModifier + itemModifier };
  }
  const proficiencyOptions = () => PROFICIENCY_STATES.map((entry) => `<option value="${entry.value}">${entry.label} · ×${entry.multiplier}</option>`).join("");

  function mountPanel() {
    if (state.mounted && field("dm-player-dnd-studio")) return true;
    const tab = field("dashboard-jugadores");
    const grid = field("grid-jugadores");
    const host = grid?.closest?.(".panel-cyber") || tab;
    if (!tab || !host) return false;
    const panel = doc.createElement("section");
    panel.id = "dm-player-dnd-studio";
    panel.className = "dm-player-dnd-studio";
    panel.innerHTML = `
      <header class="dm-player-dnd-header"><div><span>PLAYER RULESET / D&D</span><h4>ATRIBUTOS, PROFICIENCY Y COMBAT LEVELS</h4></div><label>JUGADOR<select id="dm-player-dnd-select"><option value="">— Selecciona jugador —</option></select></label></header>
      <div id="dm-player-dnd-editor" hidden>
        <div class="dm-player-dnd-summary"><div><span>LEVEL</span><strong id="dm-player-dnd-level">1</strong></div><div><span>PROFICIENCY</span><strong id="dm-player-dnd-prof">+1</strong><small>ceil(Level / 20)</small></div></div>
        <div class="dm-player-dnd-art-row"><label><span>PLAYER ART · STATS</span><input id="dm-player-dnd-art" type="url" placeholder="https://... art del jugador"></label><div class="dm-player-dnd-art-preview"><img id="dm-player-dnd-art-preview" alt="Vista previa del art del jugador" hidden><span id="dm-player-dnd-art-empty">SIN ART</span></div></div>
        <div class="dm-player-dnd-abilities">${ABILITIES.map((ability) => `<label class="dm-player-dnd-ability"><b>${ability.code}</b><span>${ability.name}</span><input id="dm-player-stat-${ability.id}" type="number" step="1" min="1" value="10"><select id="dm-player-prof-${ability.id}">${proficiencyOptions()}</select></label>`).join("")}</div>
        <div class="dm-player-dnd-prof-rules"><span><i data-prof-state="none"></i>Not Proficient = PROF × 0</span><span><i data-prof-state="half"></i>Half Proficient = floor(PROF × 0.5)</span><span><i data-prof-state="proficient"></i>Proficient = PROF × 1</span><span><i data-prof-state="expertise"></i>Expertise = PROF × 2</span></div>
        <div class="dm-player-dnd-combat-levels"><div class="dm-player-dnd-combat-row" data-level-kind="offensive"><strong>OFFENSIVE LEVEL</strong><span>Base <b data-level-source="base">1</b></span><span>Clase <b data-level-source="class">+0</b></span><label>DM <input id="dm-player-offensive-dm" type="number" step="1" value="0"></label><span>Items <b data-level-source="items">+0</b></span><span>Total <b data-level-source="total">1</b></span></div><div class="dm-player-dnd-combat-row" data-level-kind="defensive"><strong>DEFENSIVE LEVEL</strong><span>Base <b data-level-source="base">1</b></span><span>Clase <b data-level-source="class">+0</b></span><label>DM <input id="dm-player-defensive-dm" type="number" step="1" value="0"></label><span>Items <b data-level-source="items">+0</b></span><span>Total <b data-level-source="total">1</b></span></div></div>
        <p class="dm-player-dnd-resistance-note"><strong>RESISTENCIAS:</strong> quedan reservadas para Equipamiento. Este bloque no las edita todavía.</p>
        <div class="dm-player-dnd-actions"><button id="dm-player-dnd-save" type="button">GUARDAR STATS D&D</button><span id="dm-player-dnd-feedback" aria-live="polite"></span></div>
      </div>`;
    if (grid && grid.parentNode === host) host.insertBefore(panel, grid); else host.prepend(panel);
    bindPanel(panel); state.mounted = true; return true;
  }

  function bindPanel(panel) {
    field("dm-player-dnd-select")?.addEventListener("change", (event) => loadPlayer(event.target.value));
    panel.querySelectorAll("#dm-player-dnd-editor input, #dm-player-dnd-editor select").forEach((control) => {
      control.addEventListener("input", () => { state.dirty = true; if (control.id === "dm-player-dnd-art") updateArtPreview(); if (control.id === "dm-player-offensive-dm" || control.id === "dm-player-defensive-dm") updateCombatTotalsFromForm(); });
      control.addEventListener("change", () => { state.dirty = true; });
    });
    field("dm-player-dnd-save")?.addEventListener("click", savePlayerDnd);
  }

  function renderPlayerOptions() {
    const select = field("dm-player-dnd-select"); if (!select) return;
    const previous = state.playerId || select.value;
    select.innerHTML = '<option value="">— Selecciona jugador —</option>';
    Object.entries(state.players).sort((a,b) => playerLabel(a[0],a[1]).localeCompare(playerLabel(b[0],b[1]))).forEach(([id,player]) => { const option = doc.createElement("option"); option.value=id; option.textContent=playerLabel(id,player); select.appendChild(option); });
    if (previous && state.players[previous]) select.value = previous;
  }
  function updateArtPreview() {
    const image=field("dm-player-dnd-art-preview"), empty=field("dm-player-dnd-art-empty"), url=String(field("dm-player-dnd-art")?.value||"").trim();
    if(!image||!empty)return; if(!url){image.hidden=true;image.removeAttribute("src");empty.hidden=false;return;} image.src=url;image.hidden=false;empty.hidden=true;image.onerror=()=>{image.hidden=true;empty.hidden=false;};
  }
  function setCombatRow(kind, breakdown) {
    const row=doc.querySelector(`#dm-player-dnd-studio [data-level-kind="${kind}"]`); if(!row)return;
    row.querySelector('[data-level-source="base"]').textContent=String(breakdown.level); row.querySelector('[data-level-source="class"]').textContent=formatSigned(breakdown.classModifier); row.querySelector('[data-level-source="items"]').textContent=formatSigned(breakdown.itemModifier); row.querySelector('[data-level-source="total"]').textContent=String(breakdown.total);
    const input=field(kind==="offensive"?"dm-player-offensive-dm":"dm-player-defensive-dm"); if(input&&doc.activeElement!==input)input.value=String(breakdown.dmModifier);
  }
  function updateCombatTotalsFromForm() {
    if(!state.playerId)return; const player=state.players[state.playerId]||{};
    ["offensive","defensive"].forEach((kind)=>{const breakdown=combatBreakdown(player,kind);const input=field(kind==="offensive"?"dm-player-offensive-dm":"dm-player-defensive-dm");breakdown.dmModifier=numberOr(input?.value,0);breakdown.total=breakdown.level+breakdown.classModifier+breakdown.dmModifier+breakdown.itemModifier;const row=doc.querySelector(`#dm-player-dnd-studio [data-level-kind="${kind}"]`);if(row)row.querySelector('[data-level-source="total"]').textContent=String(breakdown.total);});
  }
  function loadPlayer(playerId) {
    const editor=field("dm-player-dnd-editor"),player=state.players[playerId];state.playerId=player?playerId:null;if(!editor||!player){if(editor)editor.hidden=true;return false;}editor.hidden=false;
    const level=Math.max(0,Math.trunc(numberOr(player.level,1)));field("dm-player-dnd-level").textContent=String(level);field("dm-player-dnd-prof").textContent=formatSigned(proficiencyBonus(level));
    ABILITIES.forEach((ability)=>{const score=Number.parseInt(player?.stats?.[ability.key],10);field(`dm-player-stat-${ability.id}`).value=String(Number.isFinite(score)?score:10);field(`dm-player-prof-${ability.id}`).value=normalizeProficiencyState(player?.abilityProficiency?.[ability.id]);});
    field("dm-player-dnd-art").value=String(player?.sheetArt||player?.playerSheetArt||"");updateArtPreview();setCombatRow("offensive",combatBreakdown(player,"offensive"));setCombatRow("defensive",combatBreakdown(player,"defensive"));field("dm-player-dnd-feedback").textContent="";state.dirty=false;return true;
  }
  async function savePlayerDnd() {
    const playerId=state.playerId,feedback=field("dm-player-dnd-feedback"),button=field("dm-player-dnd-save");if(!playerId||!state.players[playerId]||!state.db){if(feedback)feedback.textContent="Selecciona un jugador primero.";return;}
    const updates={};ABILITIES.forEach((ability)=>{const raw=Number.parseInt(field(`dm-player-stat-${ability.id}`)?.value,10);updates[`stats/${ability.key}`]=Number.isFinite(raw)?raw:10;updates[`abilityProficiency/${ability.id}`]=normalizeProficiencyState(field(`dm-player-prof-${ability.id}`)?.value);});
    const offensiveDm=Math.trunc(numberOr(field("dm-player-offensive-dm")?.value,0)),defensiveDm=Math.trunc(numberOr(field("dm-player-defensive-dm")?.value,0));updates.sheetArt=String(field("dm-player-dnd-art")?.value||"").trim()||null;updates["combatLevels/offensive/dmModifier"]=offensiveDm;updates["combatLevels/defensive/dmModifier"]=defensiveDm;updates["combatStats/off_lvl_mod"]=offensiveDm;updates["combatStats/def_lvl_mod"]=defensiveDm;
    if(button)button.disabled=true;if(feedback)feedback.textContent="GUARDANDO...";try{await state.db.ref(`${PLAYERS_ROOT}/${playerId}`).update(updates);state.dirty=false;if(feedback)feedback.textContent="STATS D&D GUARDADOS";}catch(error){console.error("No se pudieron guardar los Stats D&D del jugador:",error);if(feedback)feedback.textContent="ERROR AL GUARDAR";}finally{if(button)button.disabled=false;}
  }
  function connectFirebase() {
    try{if(!global.firebase?.database||!global.firebase?.apps?.length)return false;state.db=global.firebase.database();state.db.ref(PLAYERS_ROOT).on("value",(snapshot)=>{state.players=snapshot.val()||{};renderPlayerOptions();if(state.playerId&&state.players[state.playerId]&&!state.dirty)loadPlayer(state.playerId);});return true;}catch(_){return false;}
  }
  function boot(){mountPanel();if(connectFirebase())return;const retry=global.setInterval(()=>{mountPanel();if(connectFirebase())global.clearInterval(retry);},250);}
  if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  global.LuminousDmPlayerDndStudio=Object.freeze({ABILITIES,PROFICIENCY_STATES,proficiencyBonus,combatBreakdown,loadPlayer,savePlayerDnd});
})(window);
