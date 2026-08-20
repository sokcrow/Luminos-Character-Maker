(function (global) {
  "use strict";
  const doc = global.document;
  if (!doc) return;
  const ABILITIES = Object.freeze([
    { id: "str", key: "fuerza", code: "STR", name: "STRENGTH", spanish: "Fuerza", skills: [{ id: "athletics", name: "Athletics", spanish: "Atletismo" }] },
    { id: "dex", key: "destreza", code: "DEX", name: "DEXTERITY", spanish: "Destreza", skills: [
      { id: "acrobatics", name: "Acrobatics", spanish: "Acrobacias" },
      { id: "sleight_of_hand", name: "Sleight of Hand", spanish: "Juego de Manos" },
      { id: "stealth", name: "Stealth", spanish: "Sigilo" },
    ] },
    { id: "con", key: "constitucion", code: "CON", name: "CONSTITUTION", spanish: "Constitución", skills: [] },
    { id: "int", key: "inteligencia", code: "INT", name: "INTELLIGENCE", spanish: "Inteligencia", skills: [
      { id: "arcana", name: "Arcana", spanish: "Arcanos" },
      { id: "history", name: "History", spanish: "Historia" },
      { id: "investigation", name: "Investigation", spanish: "Investigación" },
      { id: "nature", name: "Nature", spanish: "Naturaleza" },
      { id: "religion", name: "Religion", spanish: "Religión" },
    ] },
    { id: "wis", key: "sabiduria", code: "WIS", name: "WISDOM", spanish: "Sabiduría", skills: [
      { id: "animal_handling", name: "Animal Handling", spanish: "Trato con Animales" },
      { id: "insight", name: "Insight", spanish: "Perspicacia" },
      { id: "medicine", name: "Medicine", spanish: "Medicina" },
      { id: "perception", name: "Perception", spanish: "Percepción" },
      { id: "survival", name: "Survival", spanish: "Supervivencia" },
    ] },
    { id: "cha", key: "carisma", code: "CHA", name: "CHARISMA", spanish: "Carisma", skills: [
      { id: "deception", name: "Deception", spanish: "Engaño" },
      { id: "intimidation", name: "Intimidation", spanish: "Intimidación" },
      { id: "performance", name: "Performance", spanish: "Interpretación" },
      { id: "persuasion", name: "Persuasion", spanish: "Persuasión" },
    ] },
  ]);
  const PROFICIENCY_STATES = Object.freeze({
    none: Object.freeze({ label: "Not Proficient", multiplier: 0 }),
    half: Object.freeze({ label: "Half Proficient", multiplier: 0.5 }),
    proficient: Object.freeze({ label: "Proficient", multiplier: 1 }),
    expertise: Object.freeze({ label: "Expertise", multiplier: 2 }),
  });
  const rollAdjustment = {
    bonus: 0,
    ignoreNextMutation: false,
    observer: null,
    resultNode: null,
    label: "",
  };
  const SWORD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 2.2 22 3.4 10.2 15.2 8.8 13.8z" fill="currentColor"/><path d="M7.2 12.2 11.8 16.8M5.7 13.7 10.3 18.3M8 18l-4.3 4.3M2.8 21.2l1 1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  const SHIELD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 19 5v5.8c0 4.4-2.3 8-7 10.7-4.7-2.7-7-6.3-7-10.7V5z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 5.5v12" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  const HEART_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.7 13C1.9 10.2 2.3 5.7 5.6 3.9c2.2-1.2 4.8-.6 6.4 1.2 1.6-1.8 4.2-2.4 6.4-1.2 3.3 1.8 3.7 6.3.9 9.1z"/></svg>';
  const playerData = () => global.datosJugador || {};
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integerOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const currentLevel = (data = playerData()) => Math.max(1, Math.trunc(numberOr(data?.level, 1)));
  function proficiencyBonus(level) {
    return Math.ceil(Math.max(0, numberOr(level, 0)) / 20);
  }
  function normalizeProficiencyState(value) {
    const normalized = String(value || "none").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(PROFICIENCY_STATES, normalized) ? normalized : "none";
  }
  function abilityProficiencyState(ability, data = playerData()) {
    const map = data?.abilityProficiency || data?.abilityProficiencies || {};
    return normalizeProficiencyState(map?.[ability.id] ?? map?.[ability.key]);
  }
  function skillProficiencyState(skill, data = playerData()) {
    const map = data?.skillProficiency || data?.skillProficiencies || data?.dndSkillProficiency || {};
    const nested = data?.dndSkills?.[skill.id];
    return normalizeProficiencyState(map?.[skill.id] ?? nested?.proficiency ?? nested?.proficiencyState);
  }
  function proficiencyContribution(level, profState) {
    const definition = PROFICIENCY_STATES[normalizeProficiencyState(profState)];
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
  function levelProgress(data = playerData()) {
    const stored = integerOr(data?.xpPercent, -1);
    if (stored >= 0) return Math.max(0, Math.min(100, stored));
    if (typeof global.calculateLevelData === "function") {
      try {
        return Math.max(0, Math.min(100, integerOr(global.calculateLevelData(data?.xp || 0)?.xpPercent, 0)));
      } catch (_) {}
    }
    return 0;
  }
  function xpMissing(data = playerData()) {
    const stored = integerOr(data?.xpMissing, -1);
    if (stored >= 0) return stored;
    if (typeof global.calculateLevelData === "function") {
      try {
        return Math.max(0, integerOr(global.calculateLevelData(data?.xp || 0)?.xpMissing, 0));
      } catch (_) {}
    }
    return 0;
  }
  function combatLevelBreakdown(kind, data = playerData()) {
    const level = currentLevel(data);
    const source = data?.combatLevels?.[kind] || {};
    const isOffense = kind === "offensive";
    const classModifier = numberOr(source.classModifier ?? data?.classModifiers?.[isOffense ? "offensiveLevel" : "defensiveLevel"], 0);
    const raceModifier = isOffense ? 0 : numberOr(source.raceModifier ?? data?.raceModifiers?.defensiveLevel, 0);
    const itemModifier = numberOr(source.itemModifier ?? data?.equipmentModifiers?.[isOffense ? "offensiveLevel" : "defensiveLevel"], 0);
    const legacyDm = data?.combatStats?.[isOffense ? "off_lvl_mod" : "def_lvl_mod"];
    const dmModifier = numberOr(source.dmModifier ?? legacyDm, 0);
    return { level, classModifier, raceModifier, dmModifier, itemModifier, total: level + classModifier + raceModifier + dmModifier + itemModifier };
  }
  const playerSheetArt = (data = playerData()) => String(data?.sheetArt || data?.playerSheetArt || "").trim();
  const playerIcon = (data = playerData()) => String(data?.icono_jugador || data?.icono || data?.perfil?.icono || "").trim();
  const playerName = (data = playerData()) => String(data?.characterName || data?.character_name || data?.nombre || data?.name || "PLAYER").trim();
  const currentHp = (data = playerData()) => Math.trunc(numberOr(data?.combatStats?.hp_actual ?? data?.hp_actual ?? data?.hp, 0));
  const maxHp = (data = playerData()) => Math.trunc(numberOr(data?.combatStats?.hp_max ?? data?.hp_max, currentHp(data)));
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
  function skillValue(skill, ability, data = playerData()) {
    const stored = data?.dndSkills?.[skill.id]?.value;
    if (Number.isFinite(Number(stored))) return Number(stored);
    const state = skillProficiencyState(skill, data);
    return abilityModifier(abilityScore(ability, data)) + proficiencyContribution(currentLevel(data), state);
  }
  function setText(root, selector, value) {
    const node = root?.querySelector?.(selector);
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
  function syncCharacterIcon(panel, data) {
    const image = panel.querySelector("[data-player-character-icon]");
    const fallback = panel.querySelector("[data-player-character-icon-empty]");
    if (!image || !fallback) return;
    const icon = playerIcon(data);
    if (!icon) {
      image.hidden = true;
      image.removeAttribute("src");
      fallback.hidden = false;
      return;
    }
    if (image.getAttribute("src") !== icon) image.src = icon;
    image.hidden = false;
    fallback.hidden = true;
    image.onerror = () => { image.hidden = true; fallback.hidden = false; };
  }
  function syncOverview(panel, data) {
    const level = currentLevel(data);
    const proficiency = proficiencyBonus(level);
    const offensive = combatLevelBreakdown("offensive", data);
    const defensive = combatLevelBreakdown("defensive", data);
    const progress = levelProgress(data);
    const missing = xpMissing(data);
    setText(panel, "[data-player-name]", playerName(data));
    setText(panel, "[data-player-level]", level);
    setText(panel, "[data-player-proficiency]", formatModifier(proficiency));
    setText(panel, "[data-player-offensive-level]", offensive.total);
    setText(panel, "[data-player-defensive-level]", defensive.total);
    setText(panel, "[data-player-hp-current]", currentHp(data));
    setText(panel, "[data-player-hp-max]", maxHp(data));
    setText(panel, "[data-player-xp-current]", Math.max(0, integerOr(data?.xp, 0)));
    setText(panel, "[data-player-xp-progress]", `${progress}%`);
    setText(panel, "[data-player-xp-missing]", level >= 100 ? "MAX" : `${missing} XP TO NEXT`);
    setText(panel, "[data-player-heads-chance]", `${headsChance(data)}%`);
    const xpFill = panel.querySelector("[data-player-xp-fill]");
    const xpTrack = panel.querySelector("[data-player-xp-track]");
    if (xpFill) xpFill.style.width = `${progress}%`;
    if (xpTrack) xpTrack.setAttribute("aria-valuenow", String(progress));
    syncArt(panel, data);
    syncCharacterIcon(panel, data);
    const offensiveNode = panel.querySelector("[data-combat-level='offensive']");
    const defensiveNode = panel.querySelector("[data-combat-level='defensive']");
    if (offensiveNode) offensiveNode.title = `Nivel ${level} + Clase ${formatModifier(offensive.classModifier)} + DM ${formatModifier(offensive.dmModifier)} + Items ${formatModifier(offensive.itemModifier)}`;
    if (defensiveNode) defensiveNode.title = `Nivel ${level} + Clase ${formatModifier(defensive.classModifier)} + Raza ${formatModifier(defensive.raceModifier)} + DM ${formatModifier(defensive.dmModifier)} + Items ${formatModifier(defensive.itemModifier)}`;
  }
  function renderSkills(panel, ability, data) {
    const list = panel.querySelector("[data-player-skill-list]");
    if (!list) return;
    list.replaceChildren();
    if (!ability.skills.length) {
      const empty = doc.createElement("div");
      empty.className = "dnd-skill dnd-skill--empty";
      empty.innerHTML = '<span class="skill-proficiency" data-prof-state="none"></span><div class="dnd-skill-name">No Skills<span>No associated skills</span></div><div class="dnd-skill-value">—</div>';
      list.appendChild(empty);
      return;
    }
    ability.skills.forEach((skill) => {
      const profState = skillProficiencyState(skill, data);
      const definition = PROFICIENCY_STATES[profState];
      const value = skillValue(skill, ability, data);
      const row = doc.createElement("button");
      row.type = "button";
      row.className = "dnd-skill player-dnd-roll";
      row.dataset.dndRoll = "skill";
      row.dataset.skillId = skill.id;
      row.dataset.profState = profState;
      row.title = `Tirar ${skill.name} · ${definition.label} · Base ${formatModifier(value)} · Coin Engine`;
      row.innerHTML = `
        <span class="skill-proficiency" data-prof-state="${profState}" aria-label="${definition.label}"></span>
        <div class="dnd-skill-name">${skill.name}<span>${skill.spanish} · click to roll</span></div>
        <div class="dnd-skill-value">${formatModifier(value)}</div>`;
      list.appendChild(row);
    });
  }
  function syncPanel() {
    const panel = doc.querySelector("#stats-modal .player-ability-console");
    if (!panel) return false;
    const data = playerData();
    syncOverview(panel, data);
    ABILITIES.forEach((ability) => {
      const profState = abilityProficiencyState(ability, data);
      const button = panel.querySelector(`.player-ability[data-stat="${ability.id}"]`);
      if (!button) return;
      const indicator = button.querySelector(".player-prof-indicator");
      if (indicator) {
        indicator.dataset.profState = profState;
        indicator.title = PROFICIENCY_STATES[profState].label;
        indicator.setAttribute("aria-label", PROFICIENCY_STATES[profState].label);
      }
    });
    const ability = selectedAbility(panel);
    const math = abilityRollMath(ability, data);
    const stateDefinition = PROFICIENCY_STATES[math.state];
    const saveValue = math.modifier + math.proficiencyValue;
    setText(panel, "[data-stat-full-name]", ability.name);
    setText(panel, "[data-stat-spanish]", ability.spanish);
    setText(panel, "[data-stat-score]", math.score);
    setText(panel, "[data-stat-modifier]", formatModifier(math.modifier));
    setText(panel, "[data-stat-save]", formatModifier(saveValue));
    setText(panel, "[data-stat-save-state]", stateDefinition.label);
    setText(panel, "[data-stat-prof-value]", formatModifier(math.proficiencyValue));
    const saveIndicator = panel.querySelector("[data-stat-save-prof]");
    if (saveIndicator) saveIndicator.dataset.profState = math.state;
    panel.querySelectorAll(".player-ability").forEach((button) => {
      const active = button.dataset.stat === ability.id;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    });
    renderSkills(panel, ability, data);
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
  function armRollAdjustment(bonus, label) {
    rollAdjustment.bonus = Number.isFinite(Number(bonus)) ? Number(bonus) : 0;
    rollAdjustment.label = String(label || "");
    rollAdjustment.ignoreNextMutation = false;
  }
  function triggerCoinRoll(ability, label, desiredBase) {
    const panel = doc.querySelector("#stats-modal .player-ability-console");
    const proxyRow = panel?.querySelector(".player-roll-proxy");
    const proxyButton = proxyRow?.querySelector(".sheet-roll-skill-btn");
    const proxyLabel = proxyRow?.querySelector(".sheet-skill-name");
    if (!proxyRow || !proxyButton || !proxyLabel || !ability) return false;
    const rawModifier = abilityModifier(abilityScore(ability, playerData()));
    armRollAdjustment(numberOr(desiredBase, rawModifier) - rawModifier, label);
    proxyLabel.textContent = label;
    proxyButton.name = `act_roll_skill_${ability.key}`;
    proxyButton.setAttribute("aria-label", `Tirar ${label} con Coin Engine`);
    installCoinResultAdjustment();
    const coinPanel = doc.getElementById("coin-toss-panel");
    if (coinPanel) coinPanel.classList.add("player-stats-coin-active");
    proxyButton.click();
    return true;
  }
  function handleHudRoll(panel, target) {
    const ability = selectedAbility(panel);
    const data = playerData();
    const kind = target?.dataset?.dndRoll;
    if (!kind) return;
    if (kind === "ability") {
      const math = abilityRollMath(ability, data);
      triggerCoinRoll(ability, ability.name, math.base);
      return;
    }
    if (kind === "save") {
      const math = abilityRollMath(ability, data);
      triggerCoinRoll(ability, `${ability.name} Saving Throw`, math.modifier + math.proficiencyValue);
      return;
    }
    if (kind === "skill") {
      const skill = ability.skills.find((entry) => entry.id === target.dataset.skillId);
      if (!skill) return;
      triggerCoinRoll(ability, skill.name, skillValue(skill, ability, data));
    }
  }
  function buildPanel() {
    const statsContainer = doc.querySelector("#stats-modal #stats-container");
    if (!statsContainer) return false;
    removeLegacyStats(statsContainer);
    let panel = statsContainer.querySelector(":scope > .player-ability-console");
    if (!panel) {
      panel = doc.createElement("section");
      panel.className = "player-ability-console player-stats-mock-hud";
      panel.dataset.activeStat = ABILITIES[0].id;
      panel.setAttribute("aria-label", "D&D player stats");
      panel.innerHTML = `
        <div class="player-stats-screen-border" aria-hidden="true"></div>
        <div class="player-stats-frame">
          <section class="player-stats-character-panel" aria-label="Player art">
            <div class="player-stats-character-image">
              <img data-player-sheet-art alt="Player art assigned by the DM" hidden>
              <div class="player-stats-art-empty" data-player-sheet-art-empty><strong>PLAYER ART</strong><span>Asignada por el DM en Gestión de Jugadores</span></div>
            </div>
            <div class="player-stats-bottom-info">
              <div class="player-info-block">
                <div class="player-info-label">Status</div>
                <div class="player-info-value player-info-hp">${HEART_ICON}<span data-player-hp-current>0</span><small>/ <span data-player-hp-max>0</span></small></div>
              </div>
              <div class="player-info-block player-info-resistances">
                <div class="player-info-label">Resistances</div>
                <div class="player-resistance-list"><div class="player-resistance-item player-resistance-pending">EQUIPMENT · PENDING</div></div>
              </div>
            </div>
          </section>
          <section class="player-stats-information-panel">
            <div class="player-stats-top-decoration" aria-hidden="true">◇◇◇</div>
            <div class="player-stats-season">D&amp;D · STATS</div>
            <header class="player-stats-header">
              <div class="player-character-name">
                <div class="player-character-icon"><img data-player-character-icon alt="Character icon" hidden><span data-player-character-icon-empty>◈</span></div>
                <span data-player-name>PLAYER</span>
              </div>
              <div class="player-level-section">
                <div class="player-level-main">
                  <div class="player-level-text"><span>LV</span><strong data-player-level>1</strong></div>
                  <div class="player-xp-track" data-player-xp-track role="progressbar" aria-label="Progreso de experiencia" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i data-player-xp-fill></i></div>
                  <div class="player-xp-copy"><span><b data-player-xp-current>0</b> XP</span><span data-player-xp-progress>0%</span><span data-player-xp-missing>0 XP TO NEXT</span></div>
                </div>
                <div class="player-mock-metric player-mock-metric--prof"><span>PROF</span><strong data-player-proficiency>+1</strong></div>
                <div class="player-mock-metric" data-combat-level="offensive"><span class="player-metric-icon player-metric-icon--sword">${SWORD_ICON}</span><strong data-player-offensive-level>1</strong><small>OFF</small></div>
                <div class="player-mock-metric" data-combat-level="defensive"><span class="player-metric-icon player-metric-icon--shield">${SHIELD_ICON}</span><strong data-player-defensive-level>1</strong><small>DEF</small></div>
              </div>
            </header>
            <div class="player-stats-tabline"><span class="player-stats-tab active">Stats</span><span class="player-stats-engine">5 COINS · <b data-player-heads-chance>50%</b> HEADS · +4 / HEAD</span></div>
            <div class="player-ability-bar" role="tablist" aria-label="D&D abilities">
              ${ABILITIES.map((ability, index) => `<button type="button" class="player-ability${index === 0 ? " active" : ""}" data-stat="${ability.id}" role="tab" aria-selected="${index === 0 ? "true" : "false"}" tabindex="${index === 0 ? "0" : "-1"}"><span class="player-prof-indicator" data-prof-state="none"></span><span class="player-ability-name">${ability.code}</span><span class="player-ability-subtitle">${ability.name.charAt(0) + ability.name.slice(1).toLowerCase()}</span></button>`).join("")}
            </div>
            <div class="player-stat-content">
              <div class="player-stat-header">
                <div class="player-stat-title"><span data-stat-full-name>STRENGTH</span><small data-stat-spanish>Fuerza</small></div>
                <button type="button" class="player-stat-main player-dnd-roll" data-dnd-roll="ability">
                  <span class="player-stat-score-label">SCORE</span>
                  <strong class="player-stat-score" data-stat-score>10</strong>
                  <span class="player-stat-modifier" data-stat-modifier>+0</span>
                  <small>CLICK TO ROLL · COIN ENGINE</small>
                </button>
                <button type="button" class="player-stat-save player-dnd-roll" data-dnd-roll="save">
                  <span class="player-save-label">SAVING THROW</span>
                  <span class="player-save-line"><i class="skill-proficiency player-save-prof" data-stat-save-prof data-prof-state="none"></i><strong class="player-save-value" data-stat-save>+0</strong></span>
                  <small data-stat-save-state>Not Proficient</small>
                  <em>PROF <span data-stat-prof-value>+0</span> · CLICK TO ROLL</em>
                </button>
              </div>
              <div class="player-stats-divider"><span>SKILLS</span><small>Click any Skill to launch the same Coin Engine.</small></div>
              <div class="player-skill-list" data-player-skill-list></div>
              <div class="player-prof-legend" aria-label="Proficiency states">${Object.entries(PROFICIENCY_STATES).map(([profState, definition]) => `<span><i class="skill-proficiency" data-prof-state="${profState}"></i>${definition.label}</span>`).join("")}</div>
            </div>
          </section>
        </div>
        <div class="player-roll-proxy sheet-skill-row" aria-hidden="true">
          <span class="sheet-skill-name">D&amp;D Roll</span>
          <button type="action" name="act_roll_skill_fuerza" class="sheet-roll-skill-btn" tabindex="-1">ROLL</button>
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
      panel.addEventListener("click", (event) => {
        const rollTarget = event.target?.closest?.("[data-dnd-roll]");
        if (!rollTarget || !panel.contains(rollTarget)) return;
        event.preventDefault();
        handleHudRoll(panel, rollTarget);
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
      if (rollAdjustment.ignoreNextMutation) {
        rollAdjustment.ignoreNextMutation = false;
        return;
      }
      const raw = Number.parseInt(resultNode.textContent, 10);
      if (!Number.isFinite(raw)) return;
      rollAdjustment.ignoreNextMutation = true;
      resultNode.textContent = String(raw + rollAdjustment.bonus);
    });
    rollAdjustment.observer.observe(resultNode, { childList: true, characterData: true, subtree: true });
    doc.getElementById("coin-toss-close-btn")?.addEventListener("click", () => {
      rollAdjustment.bonus = 0;
      rollAdjustment.label = "";
      rollAdjustment.ignoreNextMutation = false;
      doc.getElementById("coin-toss-panel")?.classList.remove("player-stats-coin-active");
    });
    return true;
  }
  function boot() {
    buildPanel();
    installCoinResultAdjustment();
    global.setInterval(() => {
      buildPanel();
      syncPanel();
      installCoinResultAdjustment();
    }, 1000);
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
  global.LuminousPlayerStats = Object.freeze({
    ABILITIES,
    PROFICIENCY_STATES,
    abilityModifier,
    proficiencyBonus,
    proficiencyContribution,
    combatLevelBreakdown,
    skillProficiencyState,
    skillValue,
    headsChance,
    levelProgress,
    triggerCoinRoll,
    buildPanel,
    syncPanel,
  });
})(window);