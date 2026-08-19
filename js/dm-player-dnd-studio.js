(function (global) {
  "use strict";
  const doc = global.document;
  if (!doc) return;
  const PLAYERS_ROOT = "campaña/jugadores";
  const ABILITIES = Object.freeze([
    { id: "str", key: "fuerza", code: "STR", name: "Strength", spanish: "Fuerza", skills: [{ id: "athletics", name: "Athletics", spanish: "Atletismo" }] },
    { id: "dex", key: "destreza", code: "DEX", name: "Dexterity", spanish: "Destreza", skills: [
      { id: "acrobatics", name: "Acrobatics", spanish: "Acrobacias" },
      { id: "sleight_of_hand", name: "Sleight of Hand", spanish: "Juego de Manos" },
      { id: "stealth", name: "Stealth", spanish: "Sigilo" },
    ] },
    { id: "con", key: "constitucion", code: "CON", name: "Constitution", spanish: "Constitución", skills: [] },
    { id: "int", key: "inteligencia", code: "INT", name: "Intelligence", spanish: "Inteligencia", skills: [
      { id: "arcana", name: "Arcana", spanish: "Arcanos" },
      { id: "history", name: "History", spanish: "Historia" },
      { id: "investigation", name: "Investigation", spanish: "Investigación" },
      { id: "nature", name: "Nature", spanish: "Naturaleza" },
      { id: "religion", name: "Religion", spanish: "Religión" },
    ] },
    { id: "wis", key: "sabiduria", code: "WIS", name: "Wisdom", spanish: "Sabiduría", skills: [
      { id: "animal_handling", name: "Animal Handling", spanish: "Trato con Animales" },
      { id: "insight", name: "Insight", spanish: "Perspicacia" },
      { id: "medicine", name: "Medicine", spanish: "Medicina" },
      { id: "perception", name: "Perception", spanish: "Percepción" },
      { id: "survival", name: "Survival", spanish: "Supervivencia" },
    ] },
    { id: "cha", key: "carisma", code: "CHA", name: "Charisma", spanish: "Carisma", skills: [
      { id: "deception", name: "Deception", spanish: "Engaño" },
      { id: "intimidation", name: "Intimidation", spanish: "Intimidación" },
      { id: "performance", name: "Performance", spanish: "Interpretación" },
      { id: "persuasion", name: "Persuasion", spanish: "Persuasión" },
    ] },
  ]);
  const PROFICIENCY_STATES = Object.freeze([
    { value: "none", label: "Not Proficient", multiplier: 0 },
    { value: "half", label: "Half Proficient", multiplier: 0.5 },
    { value: "proficient", label: "Proficient", multiplier: 1 },
    { value: "expertise", label: "Expertise", multiplier: 2 },
  ]);
  const state = {
    db: null,
    players: {},
    playerId: null,
    dirty: false,
    mounted: false,
    legacyObserver: null,
    legacyCaptureBound: false,
  };
  const field = (id) => doc.getElementById(id);
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integerOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const abilityModifier = (score) => Math.floor((numberOr(score, 10) - 10) / 2);
  const proficiencyBonus = (level) => Math.ceil(Math.max(0, numberOr(level, 0)) / 20);
  const formatSigned = (value) => numberOr(value, 0) >= 0 ? `+${numberOr(value, 0)}` : String(numberOr(value, 0));
  function playerLabel(id, player) {
    return player?.characterName || player?.character_name || player?.nombre || player?.name || id;
  }
  function normalizeProficiencyState(value) {
    const normalized = String(value || "none").trim().toLowerCase();
    return PROFICIENCY_STATES.some((entry) => entry.value === normalized) ? normalized : "none";
  }
  function proficiencyContribution(level, profState) {
    const definition = PROFICIENCY_STATES.find((entry) => entry.value === normalizeProficiencyState(profState)) || PROFICIENCY_STATES[0];
    return Math.floor(proficiencyBonus(level) * definition.multiplier);
  }
  function levelDataFromXp(xp) {
    const numericXp = Math.max(0, integerOr(xp, 0));
    if (typeof global.calculateLevelData === "function") {
      try {
        const result = global.calculateLevelData(numericXp);
        if (result && Number.isFinite(Number(result.level))) {
          return {
            level: Math.max(1, integerOr(result.level, 1)),
            xpPercent: Math.max(0, Math.min(100, integerOr(result.xpPercent, 0))),
            xpMissing: Math.max(0, integerOr(result.xpMissing, 0)),
          };
        }
      } catch (error) {
        console.warn("No se pudo calcular el nivel con calculateLevelData:", error);
      }
    }
    return { level: 1, xpPercent: 0, xpMissing: 0 };
  }
  function playerSkillState(player, skill) {
    const map = player?.skillProficiency || player?.skillProficiencies || player?.dndSkillProficiency || {};
    const nested = player?.dndSkills?.[skill.id];
    return normalizeProficiencyState(map?.[skill.id] ?? nested?.proficiency ?? nested?.proficiencyState);
  }
  function combatBreakdown(player, kind, levelOverride) {
    const level = Math.max(1, Math.trunc(numberOr(levelOverride ?? player?.level, 1)));
    const source = player?.combatLevels?.[kind] || {};
    const offense = kind === "offensive";
    const classModifier = numberOr(source.classModifier ?? player?.classModifiers?.[offense ? "offensiveLevel" : "defensiveLevel"], 0);
    const itemModifier = numberOr(source.itemModifier ?? player?.equipmentModifiers?.[offense ? "offensiveLevel" : "defensiveLevel"], 0);
    const legacyDm = player?.combatStats?.[offense ? "off_lvl_mod" : "def_lvl_mod"];
    const dmModifier = numberOr(source.dmModifier ?? legacyDm, 0);
    return { level, classModifier, dmModifier, itemModifier, total: level + classModifier + dmModifier + itemModifier };
  }
  const proficiencyOptions = () => PROFICIENCY_STATES
    .map((entry) => `<option value="${entry.value}">${entry.label} · ×${entry.multiplier}</option>`)
    .join("");
  function skillEditorMarkup() {
    return ABILITIES.filter((ability) => ability.skills.length).map((ability) => `
      <section class="dm-player-dnd-skill-group" data-skill-ability="${ability.id}">
        <header><b>${ability.code}</b><span>${ability.name} Skills</span></header>
        <div class="dm-player-dnd-skill-grid">
          ${ability.skills.map((skill) => `
            <label class="dm-player-dnd-skill">
              <span>${skill.name}<small>${skill.spanish}</small></span>
              <select id="dm-player-skill-${skill.id}">${proficiencyOptions()}</select>
              <b data-skill-total="${skill.id}">+0</b>
            </label>`).join("")}
        </div>
      </section>`).join("");
  }
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
      <header class="dm-player-dnd-header">
        <div><span>PLAYER RULESET / D&amp;D</span><h4>JUGADOR · PROGRESIÓN · STATS · SKILLS · COMBATE</h4></div>
        <label>JUGADOR<select id="dm-player-dnd-select"><option value="">— Selecciona jugador —</option></select></label>
      </header>
      <div id="dm-player-dnd-editor" hidden>
        <section class="dm-player-dnd-progression">
          <label class="dm-player-xp-editor"><span>EXPERIENCE · XP</span><input id="dm-player-dnd-xp" type="number" min="0" step="1" value="0"></label>
          <div class="dm-player-dnd-summary-card"><span>LEVEL</span><strong id="dm-player-dnd-level">1</strong></div>
          <div class="dm-player-dnd-summary-card"><span>PROFICIENCY</span><strong id="dm-player-dnd-prof">+1</strong><small>ceil(Level / 20)</small></div>
          <div class="dm-player-xp-progress">
            <div class="dm-player-xp-progress-copy"><span>PROGRESO AL SIGUIENTE NIVEL</span><b id="dm-player-dnd-xp-copy">0%</b></div>
            <div class="dm-player-xp-track" role="progressbar" aria-label="Progreso de experiencia" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="dm-player-dnd-xp-fill"></i></div>
            <small id="dm-player-dnd-xp-missing">0 XP para el siguiente nivel</small>
          </div>
        </section>
        <div class="dm-player-dnd-art-row">
          <label><span>PLAYER ART · STATS</span><input id="dm-player-dnd-art" type="url" placeholder="https://... art del jugador"></label>
          <div class="dm-player-dnd-art-preview"><img id="dm-player-dnd-art-preview" alt="Vista previa del art del jugador" hidden><span id="dm-player-dnd-art-empty">SIN ART</span></div>
        </div>
        <h5 class="dm-player-dnd-section-title">ABILITY SCORES &amp; SAVING THROW PROFICIENCY</h5>
        <div class="dm-player-dnd-abilities">
          ${ABILITIES.map((ability) => `<label class="dm-player-dnd-ability"><b>${ability.code}</b><span>${ability.name}</span><input id="dm-player-stat-${ability.id}" type="number" step="1" min="1" value="10"><select id="dm-player-prof-${ability.id}">${proficiencyOptions()}</select></label>`).join("")}
        </div>
        <div class="dm-player-dnd-prof-rules">
          <span><i data-prof-state="none"></i>Not Proficient = PROF × 0</span>
          <span><i data-prof-state="half"></i>Half Proficient = floor(PROF × 0.5)</span>
          <span><i data-prof-state="proficient"></i>Proficient = PROF × 1</span>
          <span><i data-prof-state="expertise"></i>Expertise = PROF × 2</span>
        </div>
        <h5 class="dm-player-dnd-section-title">D&amp;D SKILLS · PROFICIENCY</h5>
        <div class="dm-player-dnd-skills">${skillEditorMarkup()}</div>
        <h5 class="dm-player-dnd-section-title">OFFENSIVE / DEFENSIVE LEVEL</h5>
        <div class="dm-player-dnd-combat-levels">
          <div class="dm-player-dnd-combat-row" data-level-kind="offensive"><strong>OFFENSIVE LEVEL</strong><span>Base <b data-level-source="base">1</b></span><span>Clase <b data-level-source="class">+0</b></span><label>DM <input id="dm-player-offensive-dm" type="number" step="1" value="0"></label><span>Items <b data-level-source="items">+0</b></span><span>Total <b data-level-source="total">1</b></span></div>
          <div class="dm-player-dnd-combat-row" data-level-kind="defensive"><strong>DEFENSIVE LEVEL</strong><span>Base <b data-level-source="base">1</b></span><span>Clase <b data-level-source="class">+0</b></span><label>DM <input id="dm-player-defensive-dm" type="number" step="1" value="0"></label><span>Items <b data-level-source="items">+0</b></span><span>Total <b data-level-source="total">1</b></span></div>
        </div>
        <h5 class="dm-player-dnd-section-title">COMBAT STATS · COMPATIBILIDAD DEL EDITOR ANTIGUO</h5>
        <div class="dm-player-dnd-legacy-combat">
          <label><span>HP BASE</span><input id="dm-player-hp-base" type="number" step="1" value="0"></label>
          <label><span>HP COEFFICIENT</span><input id="dm-player-hp-coef" type="number" step="0.01" value="0"></label>
          <label><span>HP ACTUAL</span><input id="dm-player-hp-actual" type="number" step="1" value="0"></label>
          <label><span>HP MAX · CALCULADO</span><input id="dm-player-hp-max" type="number" value="0" readonly></label>
          <label><span>SP ACTUAL</span><input id="dm-player-sp" type="number" step="1" value="0"></label>
          <label><span>ACTION SLOTS</span><input id="dm-player-action-slots" type="number" min="1" step="1" value="1"></label>
          <label class="dm-player-dnd-stagger"><span>STAGGER THRESHOLDS</span><input id="dm-player-stagger" type="text" placeholder="70, 40, 20"></label>
        </div>
        <p class="dm-player-dnd-resistance-note"><strong>RESISTENCIAS:</strong> permanecen reservadas para Equipamiento; OFF/DEF pertenecen al bloque de Level, no a Resistances.</p>
        <div class="dm-player-dnd-actions"><button id="dm-player-dnd-save" type="button">GUARDAR JUGADOR / STATS D&amp;D</button><span id="dm-player-dnd-feedback" aria-live="polite"></span></div>
      </div>`;
    if (grid && grid.parentNode === host) host.insertBefore(panel, grid);
    else host.prepend(panel);
    bindPanel(panel);
    bindLegacyEditorTakeover();
    state.mounted = true;
    return true;
  }
  function markDirty() {
    state.dirty = true;
    const feedback = field("dm-player-dnd-feedback");
    if (feedback) feedback.textContent = "CAMBIOS SIN GUARDAR";
  }
  function bindPanel(panel) {
    field("dm-player-dnd-select")?.addEventListener("change", (event) => loadPlayer(event.target.value));
    panel.querySelectorAll("#dm-player-dnd-editor input, #dm-player-dnd-editor select").forEach((control) => {
      control.addEventListener("input", () => {
        markDirty();
        if (control.id === "dm-player-dnd-art") updateArtPreview();
        updatePreviewFromForm();
      });
      control.addEventListener("change", () => {
        markDirty();
        updatePreviewFromForm();
      });
    });
    field("dm-player-dnd-save")?.addEventListener("click", savePlayerDnd);
  }
  function bindLegacyEditorTakeover() {
    const grid = field("grid-jugadores");
    if (!grid) return;
    const retargetButtons = () => {
      grid.querySelectorAll(".btn-open-modal").forEach((button) => {
        button.dataset.dndStudioProxy = "true";
        button.textContent = "⚙️ EDITAR JUGADOR / STATS D&D";
        button.title = "Abre el editor unificado de progresión, Stats, Skills y combate";
      });
    };
    retargetButtons();
    state.legacyObserver?.disconnect();
    state.legacyObserver = new MutationObserver(retargetButtons);
    state.legacyObserver.observe(grid, { childList: true, subtree: true });
    if (!state.legacyCaptureBound) {
      doc.addEventListener("click", (event) => {
        const button = event.target?.closest?.("#grid-jugadores .btn-open-modal");
        if (!button) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const playerId = button.getAttribute("data-id");
        if (!playerId || !state.players[playerId]) return;
        const select = field("dm-player-dnd-select");
        if (select) select.value = playerId;
        loadPlayer(playerId);
        field("dm-combat-modal")?.style?.setProperty("display", "none");
        field("dm-player-dnd-studio")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }, true);
      state.legacyCaptureBound = true;
    }
  }
  function renderPlayerOptions() {
    const select = field("dm-player-dnd-select");
    if (!select) return;
    const previous = state.playerId || select.value;
    select.innerHTML = '<option value="">— Selecciona jugador —</option>';
    Object.entries(state.players)
      .sort((a, b) => playerLabel(a[0], a[1]).localeCompare(playerLabel(b[0], b[1])))
      .forEach(([id, player]) => {
        const option = doc.createElement("option");
        option.value = id;
        option.textContent = playerLabel(id, player);
        select.appendChild(option);
      });
    if (previous && state.players[previous]) select.value = previous;
    bindLegacyEditorTakeover();
  }
  function updateArtPreview() {
    const image = field("dm-player-dnd-art-preview");
    const empty = field("dm-player-dnd-art-empty");
    const url = String(field("dm-player-dnd-art")?.value || "").trim();
    if (!image || !empty) return;
    if (!url) {
      image.hidden = true;
      image.removeAttribute("src");
      empty.hidden = false;
      return;
    }
    image.src = url;
    image.hidden = false;
    empty.hidden = true;
    image.onerror = () => { image.hidden = true; empty.hidden = false; };
  }
  function formLevelData() {
    return levelDataFromXp(field("dm-player-dnd-xp")?.value || 0);
  }
  function formCombatBreakdown(kind, level) {
    const player = state.players[state.playerId] || {};
    const breakdown = combatBreakdown(player, kind, level);
    const input = field(kind === "offensive" ? "dm-player-offensive-dm" : "dm-player-defensive-dm");
    breakdown.dmModifier = numberOr(input?.value, 0);
    breakdown.total = breakdown.level + breakdown.classModifier + breakdown.dmModifier + breakdown.itemModifier;
    return breakdown;
  }
  function setCombatRow(kind, breakdown) {
    const row = doc.querySelector(`#dm-player-dnd-studio [data-level-kind="${kind}"]`);
    if (!row) return;
    row.querySelector('[data-level-source="base"]').textContent = String(breakdown.level);
    row.querySelector('[data-level-source="class"]').textContent = formatSigned(breakdown.classModifier);
    row.querySelector('[data-level-source="items"]').textContent = formatSigned(breakdown.itemModifier);
    row.querySelector('[data-level-source="total"]').textContent = String(breakdown.total);
    const input = field(kind === "offensive" ? "dm-player-offensive-dm" : "dm-player-defensive-dm");
    if (input && doc.activeElement !== input) input.value = String(breakdown.dmModifier);
  }
  function updateSkillTotalsFromForm(level) {
    ABILITIES.forEach((ability) => {
      const score = integerOr(field(`dm-player-stat-${ability.id}`)?.value, 10);
      const modifier = abilityModifier(score);
      ability.skills.forEach((skill) => {
        const profState = normalizeProficiencyState(field(`dm-player-skill-${skill.id}`)?.value);
        const total = modifier + proficiencyContribution(level, profState);
        const node = doc.querySelector(`[data-skill-total="${skill.id}"]`);
        if (node) node.textContent = formatSigned(total);
      });
    });
  }
  function calculatedHpMax(defensiveLevel) {
    const hpBase = numberOr(field("dm-player-hp-base")?.value, 0);
    const hpCoef = numberOr(field("dm-player-hp-coef")?.value, 0);
    return Math.max(0, Math.floor(hpBase + defensiveLevel * hpCoef));
  }
  function updatePreviewFromForm() {
    if (!state.playerId) return;
    const xpData = formLevelData();
    field("dm-player-dnd-level").textContent = String(xpData.level);
    field("dm-player-dnd-prof").textContent = formatSigned(proficiencyBonus(xpData.level));
    field("dm-player-dnd-xp-copy").textContent = `${xpData.xpPercent}%`;
    field("dm-player-dnd-xp-missing").textContent = xpData.level >= 100 ? "NIVEL MÁXIMO" : `${xpData.xpMissing} XP para el siguiente nivel`;
    const track = doc.querySelector("#dm-player-dnd-studio .dm-player-xp-track");
    const fill = field("dm-player-dnd-xp-fill");
    if (track) track.setAttribute("aria-valuenow", String(xpData.xpPercent));
    if (fill) fill.style.width = `${xpData.xpPercent}%`;
    const offensive = formCombatBreakdown("offensive", xpData.level);
    const defensive = formCombatBreakdown("defensive", xpData.level);
    setCombatRow("offensive", offensive);
    setCombatRow("defensive", defensive);
    updateSkillTotalsFromForm(xpData.level);
    const hpMax = field("dm-player-hp-max");
    if (hpMax) hpMax.value = String(calculatedHpMax(defensive.total));
  }
  function loadPlayer(playerId) {
    const editor = field("dm-player-dnd-editor");
    const player = state.players[playerId];
    state.playerId = player ? playerId : null;
    if (!editor || !player) {
      if (editor) editor.hidden = true;
      return false;
    }
    editor.hidden = false;
    field("dm-player-dnd-xp").value = String(Math.max(0, integerOr(player?.xp, 0)));
    ABILITIES.forEach((ability) => {
      const score = Number.parseInt(player?.stats?.[ability.key], 10);
      field(`dm-player-stat-${ability.id}`).value = String(Number.isFinite(score) ? score : 10);
      field(`dm-player-prof-${ability.id}`).value = normalizeProficiencyState(player?.abilityProficiency?.[ability.id] ?? player?.abilityProficiency?.[ability.key]);
      ability.skills.forEach((skill) => {
        const select = field(`dm-player-skill-${skill.id}`);
        if (select) select.value = playerSkillState(player, skill);
      });
    });
    field("dm-player-dnd-art").value = String(player?.sheetArt || player?.playerSheetArt || "");
    updateArtPreview();
    const combatStats = player?.combatStats || {};
    field("dm-player-offensive-dm").value = String(combatBreakdown(player, "offensive").dmModifier);
    field("dm-player-defensive-dm").value = String(combatBreakdown(player, "defensive").dmModifier);
    field("dm-player-hp-base").value = String(numberOr(combatStats.hp_base ?? player?.hp_base, 0));
    field("dm-player-hp-coef").value = String(numberOr(combatStats.hp_coefficient ?? player?.hp_coefficient, 0));
    field("dm-player-hp-actual").value = String(numberOr(combatStats.hp_actual ?? player?.hp_actual, 0));
    field("dm-player-sp").value = String(numberOr(combatStats.sp_actual ?? player?.sp, 0));
    field("dm-player-action-slots").value = String(Math.max(1, integerOr(combatStats.action_slots, 1)));
    field("dm-player-stagger").value = Array.isArray(combatStats.stagger_thresholds) ? combatStats.stagger_thresholds.join(", ") : "";
    field("dm-player-dnd-feedback").textContent = "";
    state.dirty = false;
    updatePreviewFromForm();
    state.dirty = false;
    return true;
  }
  function parseStaggerThresholds(value) {
    return String(value || "")
      .split(/[;,\s]+/)
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  }
  async function savePlayerDnd() {
    const playerId = state.playerId;
    const feedback = field("dm-player-dnd-feedback");
    const button = field("dm-player-dnd-save");
    const player = state.players[playerId];
    if (!playerId || !player || !state.db) {
      if (feedback) feedback.textContent = "Selecciona un jugador primero.";
      return;
    }
    const xp = Math.max(0, integerOr(field("dm-player-dnd-xp")?.value, 0));
    const xpData = levelDataFromXp(xp);
    const offensive = formCombatBreakdown("offensive", xpData.level);
    const defensive = formCombatBreakdown("defensive", xpData.level);
    const hpBase = numberOr(field("dm-player-hp-base")?.value, 0);
    const hpCoef = numberOr(field("dm-player-hp-coef")?.value, 0);
    const hpActual = numberOr(field("dm-player-hp-actual")?.value, 0);
    const hpMax = Math.max(0, Math.floor(hpBase + defensive.total * hpCoef));
    const spActual = numberOr(field("dm-player-sp")?.value, 0);
    const actionSlots = Math.max(1, integerOr(field("dm-player-action-slots")?.value, 1));
    const staggerThresholds = parseStaggerThresholds(field("dm-player-stagger")?.value);
    const updates = {
      xp,
      level: xpData.level,
      xpPercent: xpData.xpPercent,
      xpMissing: xpData.xpMissing,
      sheetArt: String(field("dm-player-dnd-art")?.value || "").trim() || null,
      hp_base: hpBase,
      hp_coefficient: hpCoef,
      hp_max: hpMax,
      hp_actual: hpActual,
      "combatLevels/offensive/dmModifier": offensive.dmModifier,
      "combatLevels/defensive/dmModifier": defensive.dmModifier,
      "combatStats/off_lvl_mod": offensive.dmModifier,
      "combatStats/def_lvl_mod": defensive.dmModifier,
      "combatStats/hp_base": hpBase,
      "combatStats/hp_coefficient": hpCoef,
      "combatStats/hp_max": hpMax,
      "combatStats/hp_actual": hpActual,
      "combatStats/sp_actual": spActual,
      "combatStats/action_slots": actionSlots,
      "combatStats/stagger_thresholds": staggerThresholds,
    };
    ABILITIES.forEach((ability) => {
      const raw = Number.parseInt(field(`dm-player-stat-${ability.id}`)?.value, 10);
      updates[`stats/${ability.key}`] = Number.isFinite(raw) ? raw : 10;
      updates[`abilityProficiency/${ability.id}`] = normalizeProficiencyState(field(`dm-player-prof-${ability.id}`)?.value);
      ability.skills.forEach((skill) => {
        updates[`skillProficiency/${skill.id}`] = normalizeProficiencyState(field(`dm-player-skill-${skill.id}`)?.value);
      });
    });
    if (button) button.disabled = true;
    if (feedback) feedback.textContent = "GUARDANDO...";
    try {
      await state.db.ref(`${PLAYERS_ROOT}/${playerId}`).update(updates);
      state.dirty = false;
      if (feedback) feedback.textContent = "JUGADOR / STATS D&D GUARDADOS";
    } catch (error) {
      console.error("No se pudieron guardar los datos D&D del jugador:", error);
      if (feedback) feedback.textContent = "ERROR AL GUARDAR";
    } finally {
      if (button) button.disabled = false;
    }
  }
  function connectFirebase() {
    try {
      if (!global.firebase?.database || !global.firebase?.apps?.length) return false;
      state.db = global.firebase.database();
      state.db.ref(PLAYERS_ROOT).on("value", (snapshot) => {
        state.players = snapshot.val() || {};
        renderPlayerOptions();
        if (state.playerId && state.players[state.playerId] && !state.dirty) loadPlayer(state.playerId);
      });
      return true;
    } catch (_) {
      return false;
    }
  }
  function boot() {
    mountPanel();
    if (connectFirebase()) return;
    const retry = global.setInterval(() => {
      mountPanel();
      if (connectFirebase()) global.clearInterval(retry);
    }, 250);
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
  global.LuminousDmPlayerDndStudio = Object.freeze({
    ABILITIES,
    PROFICIENCY_STATES,
    proficiencyBonus,
    proficiencyContribution,
    levelDataFromXp,
    combatBreakdown,
    loadPlayer,
    savePlayerDnd,
    updatePreviewFromForm,
  });
})(window);
