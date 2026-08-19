(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc) return;

  const ABILITIES = Object.freeze([
    { id: "str", key: "fuerza", code: "STR", name: "Strength" },
    { id: "dex", key: "destreza", code: "DEX", name: "Dexterity" },
    { id: "con", key: "constitucion", code: "CON", name: "Constitution" },
    { id: "int", key: "inteligencia", code: "INT", name: "Intelligence" },
    { id: "wis", key: "sabiduria", code: "WIS", name: "Wisdom" },
    { id: "cha", key: "carisma", code: "CHA", name: "Charisma" },
  ]);

  const PROFICIENCY_STATES = Object.freeze({
    none: Object.freeze({ label: "Not Proficient", multiplier: 0 }),
    half: Object.freeze({ label: "Half Proficient", multiplier: 0.5 }),
    proficient: Object.freeze({ label: "Proficient", multiplier: 1 }),
    expertise: Object.freeze({ label: "Expertise", multiplier: 2 }),
  });

  const rollAdjustment = { bonus: 0, ignoreNextMutation: false, observer: null, resultNode: null };
  const SWORD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4.5 19.5 2l-2.5 5-7.7 7.7-2-2z"/><path d="m8.4 13.6 2 2-4.7 4.7-2-2zM5 15l4 4M15.5 3.8l4.7 4.7"/></svg>';
  const SHIELD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 19 5v5.8c0 4.4-2.3 8-7 10.7-4.7-2.7-7-6.3-7-10.7V5z"/><path d="M12 5.5v12"/></svg>';

  const playerData = () => global.datosJugador || {};
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const currentLevel = (data = playerData()) => Math.max(0, Math.trunc(numberOr(data?.level, 1)));

  function proficiencyBonus(level) {
    const numericLevel = Math.max(0, numberOr(level, 0));
    return Math.ceil(numericLevel / 20);
  }

  function normalizeProficiencyState(value) {
    const normalized = String(value || "none").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(PROFICIENCY_STATES, normalized) ? normalized : "none";
  }

  function abilityProficiencyState(ability, data = playerData()) {
    const map = data?.abilityProficiency || data?.abilityProficiencies || {};
    return normalizeProficiencyState(map?.[ability.id] ?? map?.[ability.key]);
  }

  function proficiencyContribution(level, state) {
    const definition = PROFICIENCY_STATES[normalizeProficiencyState(state)];
    return Math.floor(proficiencyBonus(level) * definition.multiplier);
  }

  function abilityScore(ability, data = playerData()) {
    const fromData = Number.parseInt(data?.stats?.[ability.key], 10);
    if (Number.isFinite(fromData)) return fromData;
    const fromInput = Number.parseInt(doc.getElementById(`stat-${ability.key}`)?.value, 10);
    return Number.isFinite(fromInput) ? fromInput : 10;
  }

  const abilityModifier = (score) => Math.floor((numberOr(score, 10) - 10) / 2);
  const formatModifier = (value) => numberOr(value, 0) >= 0 ? `+${numberOr(value, 0)}` : String(numberOr(value, 0));
  const currentSp = (data = playerData()) => Number.parseInt(data?.combatStats?.sp_actual ?? data?.sp, 10) || 0;
  const headsChance = (data = playerData()) => Math.max(5, Math.min(95, 50 + currentSp(data)));

  function combatLevelBreakdown(kind, data = playerData()) {
    const level = currentLevel(data);
    const source = data?.combatLevels?.[kind] || {};
    const isOffense = kind === "offensive";
    const classModifier = numberOr(source.classModifier ?? data?.classModifiers?.[isOffense ? "offensiveLevel" : "defensiveLevel"], 0);
    const itemModifier = numberOr(source.itemModifier ?? data?.equipmentModifiers?.[isOffense ? "offensiveLevel" : "defensiveLevel"], 0);
    const legacyDm = data?.combatStats?.[isOffense ? "off_lvl_mod" : "def_lvl_mod"];
    const dmModifier = numberOr(source.dmModifier ?? legacyDm, 0);
    return { level, classModifier, dmModifier, itemModifier, total: level + classModifier + dmModifier + itemModifier };
  }

  const playerSheetArt = (data = playerData()) => String(data?.sheetArt || data?.playerSheetArt || "").trim();

  function selectedAbility(panel) {
    const id = panel?.dataset?.activeStat || ABILITIES[0].id;
    return ABILITIES.find((ability) => ability.id === id) || ABILITIES[0];
  }

  function abilityRollMath(ability, data = playerData()) {
    const score = abilityScore(ability, data);
    const modifier = abilityModifier(score);
    const state = abilityProficiencyState(ability, data);
    const proficiency = proficiencyBonus(currentLevel(data));
    const proficiencyValue = proficiencyContribution(currentLevel(data), state);
    return { score, modifier, state, proficiency, proficiencyValue, base: modifier + proficiencyValue };
  }

  function setText(panel, selector, value) {
    const node = panel.querySelector(selector);
    if (node && node.textContent !== String(value)) node.textContent = String(value);
  }

  function syncArt(panel, data) {
    const image = panel.querySelector("[data-player-sheet-art]");
    const fallback = panel.querySelector("[data-player-sheet-art-empty]");
    if (!image || !fallback) return;
    const art = playerSheetArt(data);
    if (!art) {
      image.hidden = true;
      image.removeAttribute("src");
      fallback.hidden = false;
      return;
    }
    if (image.getAttribute("src") !== art) image.src = art;
    image.hidden = false;
    fallback.hidden = true;
    image.onerror = () => { image.hidden = true; fallback.hidden = false; };
  }

  function syncCombatLevels(panel, data) {
    const level = currentLevel(data);
    const proficiency = proficiencyBonus(level);
    const offensive = combatLevelBreakdown("offensive", data);
    const defensive = combatLevelBreakdown("defensive", data);
    setText(panel, "[data-player-level]", level);
    setText(panel, "[data-player-proficiency]", formatModifier(proficiency));
    setText(panel, "[data-player-offensive-level]", offensive.total);
    setText(panel, "[data-player-defensive-level]", defensive.total);
    const offensiveCard = panel.querySelector("[data-combat-level='offensive']");
    const defensiveCard = panel.querySelector("[data-combat-level='defensive']");
    if (offensiveCard) offensiveCard.title = `Nivel ${level} + Clase ${formatModifier(offensive.classModifier)} + DM ${formatModifier(offensive.dmModifier)} + Items ${formatModifier(offensive.itemModifier)}`;
    if (defensiveCard) defensiveCard.title = `Nivel ${level} + Clase ${formatModifier(defensive.classModifier)} + DM ${formatModifier(defensive.dmModifier)} + Items ${formatModifier(defensive.itemModifier)}`;
  }

  function syncPanel() {
    const panel = doc.querySelector("#stats-modal .player-ability-console");
    if (!panel) return false;
    const data = playerData();
    syncCombatLevels(panel, data);
    syncArt(panel, data);

    ABILITIES.forEach((ability) => {
      const math = abilityRollMath(ability, data);
      const button = panel.querySelector(`.player-ability[data-stat="${ability.id}"]`);
      if (!button) return;
      setText(button, ".player-ability-score", math.score);
      const indicator = button.querySelector(".player-prof-indicator");
      if (indicator) {
        indicator.dataset.profState = math.state;
        indicator.title = `${PROFICIENCY_STATES[math.state].label}: ${formatModifier(math.proficiencyValue)}`;
        indicator.setAttribute("aria-label", indicator.title);
      }
    });

    const ability = selectedAbility(panel);
    const math = abilityRollMath(ability, data);
    const sp = currentSp(data);
    const stateDefinition = PROFICIENCY_STATES[math.state];
    setText(panel, "[data-ability-detail-code]", ability.code);
    setText(panel, "[data-ability-detail-name]", ability.name);
    setText(panel, "[data-ability-detail-score]", math.score);
    setText(panel, "[data-ability-detail-mod]", formatModifier(math.modifier));
    setText(panel, "[data-ability-detail-prof-label]", stateDefinition.label);
    setText(panel, "[data-ability-detail-prof-value]", formatModifier(math.proficiencyValue));
    setText(panel, "[data-ability-roll-base]", formatModifier(math.base));
    setText(panel, "[data-ability-heads-chance]", `${headsChance(data)}%`);
    setText(panel, "[data-ability-heads-formula]", `50 + ${sp} SP`);

    const detailIndicator = panel.querySelector("[data-ability-detail-prof-icon]");
    if (detailIndicator) detailIndicator.dataset.profState = math.state;
    const rollRow = panel.querySelector(".player-ability-roll-row");
    const rollLabel = rollRow?.querySelector(".sheet-skill-name");
    const rollButton = rollRow?.querySelector(".sheet-roll-skill-btn");
    if (rollLabel) rollLabel.textContent = ability.name;
    if (rollButton) {
      rollButton.name = `act_roll_skill_${ability.key}`;
      rollButton.dataset.stat = ability.id;
      rollButton.dataset.proficiencyContribution = String(math.proficiencyValue);
      rollButton.setAttribute("aria-label", `Tirar ${ability.name}: MOD ${formatModifier(math.modifier)} + ${stateDefinition.label} ${formatModifier(math.proficiencyValue)}, cinco monedas`);
    }

    panel.querySelectorAll(".player-ability").forEach((button) => {
      const active = button.dataset.stat === ability.id;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    });
    return true;
  }

  function activate(panel, abilityId, focus = false) {
    if (!panel || !ABILITIES.some((ability) => ability.id === abilityId)) return;
    panel.dataset.activeStat = abilityId;
    syncPanel();
    if (focus) panel.querySelector(`.player-ability[data-stat="${abilityId}"]`)?.focus();
  }

  function removeLegacyStats(statsContainer) {
    statsContainer.querySelectorAll(":scope > .sheet-attributes-grid, :scope > .player-secondary-stats").forEach((node) => node.remove());
  }

  function buildPanel() {
    const statsContainer = doc.querySelector("#stats-modal #stats-container");
    if (!statsContainer) return false;
    removeLegacyStats(statsContainer);

    let panel = statsContainer.querySelector(":scope > .player-ability-console");
    if (!panel) {
      panel = doc.createElement("section");
      panel.className = "player-ability-console";
      panel.dataset.activeStat = ABILITIES[0].id;
      panel.setAttribute("aria-label", "D&D player stats");
      panel.innerHTML = `
        <div class="player-ability-heading"><div><span class="player-ability-kicker">D&D ATTRIBUTE MATRIX</span><h3>PLAYER STATS</h3></div><span class="player-ability-engine">COIN ENGINE / 5 COINS</span></div>
        <div class="player-combat-level-strip" aria-label="Nivel y niveles de combate">
          <div class="player-level-card"><span>LEVEL</span><strong data-player-level>1</strong></div>
          <div class="player-level-card player-level-card--proficiency"><span>PROFICIENCY</span><strong data-player-proficiency>+1</strong><small>ceil(Level / 20)</small></div>
          <div class="player-level-card player-level-card--combat" data-combat-level="offensive"><span class="player-level-icon">${SWORD_ICON}</span><span>OFFENSIVE LEVEL</span><strong data-player-offensive-level>1</strong></div>
          <div class="player-level-card player-level-card--combat" data-combat-level="defensive"><span class="player-level-icon">${SHIELD_ICON}</span><span>DEFENSIVE LEVEL</span><strong data-player-defensive-level>1</strong></div>
        </div>
        <div class="player-ability-bar" role="tablist" aria-label="D&D abilities">
          ${ABILITIES.map((ability, index) => `<button type="button" class="player-ability${index === 0 ? " active" : ""}" data-stat="${ability.id}" role="tab" aria-selected="${index === 0 ? "true" : "false"}" tabindex="${index === 0 ? "0" : "-1"}"><span class="player-prof-indicator" data-prof-state="none" aria-hidden="false"></span><span class="player-ability-name">${ability.code}</span><span class="player-ability-score">10</span><span class="player-ability-subtitle">${ability.name}</span></button>`).join("")}
        </div>
        <div class="player-ability-detail">
          <div class="player-ability-primary"><div class="player-ability-identity"><span class="player-ability-detail-code" data-ability-detail-code>STR</span><span class="player-ability-detail-name" data-ability-detail-name>Strength</span><div class="player-ability-prof-detail"><span class="player-prof-indicator player-prof-indicator--large" data-ability-detail-prof-icon data-prof-state="none"></span><span data-ability-detail-prof-label>Not Proficient</span><strong data-ability-detail-prof-value>+0</strong></div></div><div class="player-ability-numbers"><div><span class="player-ability-number-label">SCORE</span><strong data-ability-detail-score>10</strong></div><div><span class="player-ability-number-label">MOD</span><strong data-ability-detail-mod>+0</strong></div><div><span class="player-ability-number-label">ROLL BASE</span><strong data-ability-roll-base>+0</strong></div></div></div>
          <div class="player-ability-art" aria-label="Assigned player art"><img data-player-sheet-art alt="Player art assigned by the DM" hidden><div data-player-sheet-art-empty class="player-ability-art-empty"><span>PLAYER ART</span><small>Asignada por el DM en Gestión de Jugadores</small></div></div>
          <div class="player-ability-mechanics" aria-label="Reglas de tirada"><div><span>BASE</span><strong>MOD + PROF</strong></div><div><span>CADA CARA</span><strong>+4</strong></div><div><span>P(CARA)</span><strong data-ability-heads-chance>50%</strong><small data-ability-heads-formula>50 + 0 SP</small></div><div><span>MONEDAS</span><strong>5</strong></div></div>
          <div class="player-proficiency-legend" aria-label="Estados de proficiency">${Object.entries(PROFICIENCY_STATES).map(([state, definition]) => `<span><i class="player-prof-indicator" data-prof-state="${state}"></i>${definition.label}</span>`).join("")}</div>
          <div class="player-ability-roll-row sheet-skill-row"><span class="sheet-skill-name">Strength</span><div class="player-ability-roll-copy"><strong>MOD + PROF + (4 × CARAS)</strong><small>Prof = Proficiency × estado. Cada cara usa (50 + SP)%.</small></div><button type="action" name="act_roll_skill_fuerza" class="sheet-roll-skill-btn player-ability-roll">TIRAR ABILITY</button></div>
        </div>`;
      statsContainer.prepend(panel);

      panel.querySelectorAll(".player-ability").forEach((button) => {
        button.addEventListener("click", () => activate(panel, button.dataset.stat));
        button.addEventListener("keydown", (event) => {
          const index = ABILITIES.findIndex((ability) => ability.id === button.dataset.stat);
          let next = index;
          if (event.key === "ArrowRight") next = (index + 1) % ABILITIES.length;
          else if (event.key === "ArrowLeft") next = (index - 1 + ABILITIES.length) % ABILITIES.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = ABILITIES.length - 1;
          else return;
          event.preventDefault();
          activate(panel, ABILITIES[next].id, true);
        });
      });
      panel.querySelector(".player-ability-roll")?.addEventListener("click", (event) => {
        rollAdjustment.bonus = Number.parseInt(event.currentTarget.dataset.proficiencyContribution, 10) || 0;
        rollAdjustment.ignoreNextMutation = false;
      });
    }
    syncPanel();
    return true;
  }

  function installCoinResultAdjustment() {
    const resultNode = doc.getElementById("roll-total-score");
    if (!resultNode || rollAdjustment.resultNode === resultNode) return Boolean(resultNode);
    rollAdjustment.observer?.disconnect();
    rollAdjustment.resultNode = resultNode;
    rollAdjustment.observer = new MutationObserver(() => {
      if (!rollAdjustment.bonus) return;
      if (rollAdjustment.ignoreNextMutation) { rollAdjustment.ignoreNextMutation = false; return; }
      const raw = Number.parseInt(resultNode.textContent, 10);
      if (!Number.isFinite(raw)) return;
      rollAdjustment.ignoreNextMutation = true;
      resultNode.textContent = String(raw + rollAdjustment.bonus);
    });
    rollAdjustment.observer.observe(resultNode, { childList: true, characterData: true, subtree: true });
    doc.getElementById("coin-toss-close-btn")?.addEventListener("click", () => { rollAdjustment.bonus = 0; rollAdjustment.ignoreNextMutation = false; });
    return true;
  }

  function boot() {
    buildPanel();
    installCoinResultAdjustment();
    global.setInterval(() => { buildPanel(); syncPanel(); installCoinResultAdjustment(); }, 1000);
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousPlayerStats = Object.freeze({ ABILITIES, PROFICIENCY_STATES, abilityModifier, proficiencyBonus, proficiencyContribution, combatLevelBreakdown, headsChance, buildPanel, syncPanel });
})(window);
