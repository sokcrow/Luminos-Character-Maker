(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc) return;

  const ABILITIES = Object.freeze([
    {
      id: "str", key: "fuerza", code: "STR", name: "STRENGTH", spanish: "Fuerza",
      skills: [{ id: "athletics", name: "Athletics", spanish: "Atletismo" }],
    },
    {
      id: "dex", key: "destreza", code: "DEX", name: "DEXTERITY", spanish: "Destreza",
      skills: [
        { id: "acrobatics", name: "Acrobatics", spanish: "Acrobacias" },
        { id: "sleight_of_hand", name: "Sleight of Hand", spanish: "Juego de Manos" },
        { id: "stealth", name: "Stealth", spanish: "Sigilo" },
      ],
    },
    { id: "con", key: "constitucion", code: "CON", name: "CONSTITUTION", spanish: "Constitución", skills: [] },
    {
      id: "int", key: "inteligencia", code: "INT", name: "INTELLIGENCE", spanish: "Inteligencia",
      skills: [
        { id: "arcana", name: "Arcana", spanish: "Arcanos" },
        { id: "history", name: "History", spanish: "Historia" },
        { id: "investigation", name: "Investigation", spanish: "Investigación" },
        { id: "nature", name: "Nature", spanish: "Naturaleza" },
        { id: "religion", name: "Religion", spanish: "Religión" },
      ],
    },
    {
      id: "wis", key: "sabiduria", code: "WIS", name: "WISDOM", spanish: "Sabiduría",
      skills: [
        { id: "animal_handling", name: "Animal Handling", spanish: "Trato con Animales" },
        { id: "insight", name: "Insight", spanish: "Perspicacia" },
        { id: "medicine", name: "Medicine", spanish: "Medicina" },
        { id: "perception", name: "Perception", spanish: "Percepción" },
        { id: "survival", name: "Survival", spanish: "Supervivencia" },
      ],
    },
    {
      id: "cha", key: "carisma", code: "CHA", name: "CHARISMA", spanish: "Carisma",
      skills: [
        { id: "deception", name: "Deception", spanish: "Engaño" },
        { id: "intimidation", name: "Intimidation", spanish: "Intimidación" },
        { id: "performance", name: "Performance", spanish: "Interpretación" },
        { id: "persuasion", name: "Persuasion", spanish: "Persuasión" },
      ],
    },
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
  const HEART_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.7 13C1.9 10.2 2.3 5.7 5.6 3.9c2.2-1.2 4.8-.6 6.4 1.2 1.6-1.8 4.2-2.4 6.4-1.2 3.3 1.8 3.7 6.3.9 9.1z"/></svg>';

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

  function skillProficiencyState(skill, data = playerData()) {
    const map = data?.skillProficiency || data?.skillProficiencies || data?.dndSkillProficiency || {};
    const nested = data?.dndSkills?.[skill.id];
    return normalizeProficiencyState(map?.[skill.id] ?? nested?.proficiency ?? nested?.proficiencyState);
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
    setText(panel, "[data-player-name]", playerName(data));
    setText(panel, "[data-player-level]", level);
    setText(panel, "[data-player-proficiency]", formatModifier(proficiency));
    setText(panel, "[data-player-offensive-level]", offensive.total);
    setText(panel, "[data-player-defensive-level]", defensive.total);
    setText(panel, "[data-player-hp-current]", currentHp(data));
    setText(panel, "[data-player-hp-max]", maxHp(data));
    setText(panel, "[data-player-xp-progress]", `${Math.max(0, Math.min(100, Math.trunc(numberOr(data?.xpPercent, 0))))}%`);
    setText(panel, "[data-player-heads-chance]", `${headsChance(data)}%`);
    syncArt(panel, data);
    syncCharacterIcon(panel, data);

    const offensiveNode = panel.querySelector("[data-combat-level='offensive']");
    const defensiveNode = panel.querySelector("[data-combat-level='defensive']");
    if (offensiveNode) offensiveNode.title = `Nivel ${level} + Clase ${formatModifier(offensive.classModifier)} + DM ${formatModifier(offensive.dmModifier)} + Items ${formatModifier(offensive.itemModifier)}`;
    if (defensiveNode) defensiveNode.title = `Nivel ${level} + Clase ${formatModifier(defensive.classModifier)} + DM ${formatModifier(defensive.dmModifier)} + Items ${formatModifier(defensive.itemModifier)}`;
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
      const state = skillProficiencyState(skill, data);
      const definition = PROFICIENCY_STATES[state];
      const row = doc.createElement("div");
      row.className = "dnd-skill";
      row.dataset.profState = state;
      row.title = `${definition.label} · ${formatModifier(proficiencyContribution(currentLevel(data), state))}`;
      row.innerHTML = `
        <span class="skill-proficiency" data-prof-state="${state}" aria-label="${definition.label}"></span>
        <div class="dnd-skill-name">${skill.name}<span>${skill.spanish}</span></div>
        <div class="dnd-skill-value">${formatModifier(skillValue(skill, ability, data))}</div>`;
      list.appendChild(row);
    });
  }

  function syncPanel() {
    const panel = doc.querySelector("#stats-modal .player-ability-console");
    if (!panel) return false;
    const data = playerData();
    syncOverview(panel, data);

    ABILITIES.forEach((ability) => {
      const state = abilityProficiencyState(ability, data);
      const button = panel.querySelector(`.player-ability[data-stat="${ability.id}"]`);
      if (!button) return;
      const indicator = button.querySelector(".player-prof-indicator");
      if (indicator) {
        indicator.dataset.profState = state;
        indicator.title = PROFICIENCY_STATES[state].label;
        indicator.setAttribute("aria-label", PROFICIENCY_STATES[state].label);
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

    const rollButton = panel.querySelector(".player-stat-roll");
    if (rollButton) {
      rollButton.name = `act_roll_skill_${ability.key}`;
      rollButton.dataset.stat = ability.id;
      rollButton.dataset.proficiencyContribution = String(math.proficiencyValue);
      rollButton.setAttribute("aria-label", `Tirar ${ability.name}: MOD ${formatModifier(math.modifier)} + ${stateDefinition.label} ${formatModifier(math.proficiencyValue)}, cinco monedas`);
      rollButton.title = `Tirar ${ability.name} · MOD ${formatModifier(math.modifier)} + PROF ${formatModifier(math.proficiencyValue)} · 5 coins · ${headsChance(data)} cara`;
    }

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
              <div class="player-stats-art-empty" data-player-sheet-art-empty>
                <strong>PLAYER ART</strong>
                <span>Asignada por el DM en Gestión de Jugadores</span>
              </div>
            </div>
            <div class="player-stats-bottom-info">
              <div class="player-info-block">
                <div class="player-info-label">Status</div>
                <div class="player-info-value player-info-hp">${HEART_ICON}<span data-player-hp-current>0</span><small>/ <span data-player-hp-max>0</span></small></div>
              </div>
              <div class="player-info-block player-info-resistances">
                <div class="player-info-label">Resistances</div>
                <div class="player-resistance-list">
                  <div class="player-resistance-item" data-combat-level="offensive"><span class="player-combat-icon">${SWORD_ICON}</span><b data-player-offensive-level>1</b><small>OFF</small></div>
                  <div class="player-resistance-item" data-combat-level="defensive"><span class="player-combat-icon">${SHIELD_ICON}</span><b data-player-defensive-level>1</b><small>DEF</small></div>
                  <div class="player-resistance-item player-resistance-pending">EQUIPMENT · PENDING</div>
                </div>
              </div>
            </div>
          </section>

          <section class="player-stats-information-panel">
            <div class="player-stats-top-decoration" aria-hidden="true">◇◇◇</div>
            <div class="player-stats-season">D&amp;D · STATS</div>

            <header class="player-stats-header">
              <div class="player-character-name">
                <div class="player-character-icon">
                  <img data-player-character-icon alt="Character icon" hidden>
                  <span data-player-character-icon-empty>◈</span>
                </div>
                <span data-player-name>PLAYER</span>
              </div>
              <div class="player-level-section">
                <div class="player-level-text"><span>LV</span><strong data-player-level>1</strong><small data-player-xp-progress>0%</small></div>
                <div class="player-mock-metric player-mock-metric--prof"><span>PROF</span><strong data-player-proficiency>+1</strong></div>
                <div class="player-mock-metric" data-combat-level="offensive"><span class="player-metric-icon">${SWORD_ICON}</span><strong data-player-offensive-level>1</strong><small>OFF</small></div>
                <div class="player-mock-metric" data-combat-level="defensive"><span class="player-metric-icon">${SHIELD_ICON}</span><strong data-player-defensive-level>1</strong><small>DEF</small></div>
              </div>
            </header>

            <div class="player-stats-tabline">
              <span class="player-stats-tab active">Stats</span>
              <span class="player-stats-engine">5 COINS · <b data-player-heads-chance>50%</b> HEADS</span>
            </div>

            <div class="player-ability-bar" role="tablist" aria-label="D&D abilities">
              ${ABILITIES.map((ability, index) => `<button type="button" class="player-ability${index === 0 ? " active" : ""}" data-stat="${ability.id}" role="tab" aria-selected="${index === 0 ? "true" : "false"}" tabindex="${index === 0 ? "0" : "-1"}"><span class="player-prof-indicator" data-prof-state="none"></span><span class="player-ability-name">${ability.code}</span><span class="player-ability-subtitle">${ability.name.charAt(0) + ability.name.slice(1).toLowerCase()}</span></button>`).join("")}
            </div>

            <div class="player-stat-content">
              <div class="player-stat-header">
                <div class="player-stat-title"><span data-stat-full-name>STRENGTH</span><small data-stat-spanish>Fuerza</small></div>
                <button type="action" name="act_roll_skill_fuerza" class="sheet-roll-skill-btn player-stat-main player-stat-roll">
                  <span class="player-stat-score-label">SCORE</span>
                  <strong class="player-stat-score" data-stat-score>10</strong>
                  <span class="player-stat-modifier" data-stat-modifier>+0</span>
                  <small>CLICK TO ROLL</small>
                </button>
                <div class="player-stat-save">
                  <div class="player-save-label">SAVING THROW</div>
                  <div class="player-save-line"><span class="skill-proficiency player-save-prof" data-stat-save-prof data-prof-state="none"></span><strong class="player-save-value" data-stat-save>+0</strong></div>
                  <small data-stat-save-state>Not Proficient</small>
                  <em>PROF <span data-stat-prof-value>+0</span></em>
                </div>
              </div>

              <div class="player-stats-divider"><span>SKILLS</span><small>Skill proficiency is read from player D&amp;D data when available.</small></div>
              <div class="player-skill-list" data-player-skill-list></div>
              <div class="player-prof-legend" aria-label="Proficiency states">
                ${Object.entries(PROFICIENCY_STATES).map(([state, definition]) => `<span><i class="skill-proficiency" data-prof-state="${state}"></i>${definition.label}</span>`).join("")}
              </div>
            </div>
          </section>
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

      panel.querySelector(".player-stat-roll")?.addEventListener("click", (event) => {
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
    doc.getElementById("coin-toss-close-btn")?.addEventListener("click", () => {
      rollAdjustment.bonus = 0;
      rollAdjustment.ignoreNextMutation = false;
    });
    return true;
  }

  function boot() {
    buildPanel();
    installCoinResultAdjustment();
    global.setInterval(() => { buildPanel(); syncPanel(); installCoinResultAdjustment(); }, 1000);
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
    buildPanel,
    syncPanel,
  });
})(window);
