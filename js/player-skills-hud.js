(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.LuminousPlayerSkillsHud = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = "1.0.0";
  const HUD_CANVAS = Object.freeze({ width: 1600, height: 920, gutter: 24 });
  const SKILL_DB_ROOT = "campaña/base_datos_skills";

  const state = {
    selectedSkillId: null,
    filter: "all",
    initialized: false,
    dbRef: null,
    dbHandler: null,
    resizeBound: false,
  };

  const clean = (value) => String(value ?? "").trim();
  const normalizeId = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const escapeHtml = (value) => clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function playerData() {
    return global.datosJugador && typeof global.datosJugador === "object" ? global.datosJugador : {};
  }

  function skillLoadout() {
    return global.LuminousCombatSkillLoadout074 || null;
  }

  function progressionCore() {
    return global.LuminousPlayerProgressionTreeCore || null;
  }

  function spellcastingRuntime() {
    return global.LuminousSpellcastingRuntime || null;
  }

  function normalizeClasses(character = {}, core = progressionCore()) {
    if (typeof core?.normalizeClasses === "function") {
      try { return core.normalizeClasses(character); } catch (_) {}
    }
    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const raw = build.classes || character.classes || character.classLevels || {};
    const rows = Array.isArray(raw)
      ? raw
      : Object.entries(raw || {}).map(([classId, value]) => typeof value === "object" ? { classId, ...value } : { classId, levels: value });
    return rows.map((entry) => ({
      classId: normalizeId(entry?.classId || entry?.id || entry?.name),
      levels: Math.max(0, Number.parseInt(entry?.levels ?? entry?.level ?? entry?.classLevel ?? 0, 10) || 0),
    })).filter((entry) => entry.classId && entry.levels > 0);
  }

  function spellcastingClasses(character = {}, options = {}) {
    const core = options.progressionCore || progressionCore();
    const runtime = options.spellcasting || spellcastingRuntime();
    return normalizeClasses(character, core).map((entry) => {
      let profile = null;
      try { profile = runtime?.getClassSpellcastingProfile?.(entry.classId) || null; } catch (_) {}
      if (!profile) return null;
      const start = Math.max(1, Number.parseInt(profile.spellcastingStartLimbusLevel ?? 1, 10) || 1);
      if (entry.levels < start) return null;
      return { classId: entry.classId, levels: entry.levels, profile, startLevel: start };
    }).filter(Boolean);
  }

  function isSpellcaster(character = {}, options = {}) {
    return spellcastingClasses(character, options).length > 0;
  }

  function rawIds(value, keys = []) {
    const ids = [];
    keys.forEach((key) => {
      const source = key.split(".").reduce((cursor, part) => cursor?.[part], value);
      if (Array.isArray(source)) {
        source.forEach((entry) => {
          const id = normalizeId(entry?.skillId || entry?.id || entry);
          if (id) ids.push(id);
        });
      } else if (source && typeof source === "object") {
        Object.entries(source).forEach(([id, enabled]) => {
          if (enabled === true || (enabled && typeof enabled === "object")) {
            const normalized = normalizeId(enabled?.skillId || enabled?.id || id);
            if (normalized) ids.push(normalized);
          }
        });
      }
    });
    return [...new Set(ids)];
  }

  function explicitLearnedSkillIds(character = {}) {
    return rawIds(character, [
      "learnedSkillIds",
      "learnedSkills",
      "knownSkillIds",
      "knownSkills",
      "unlockedSkillIds",
      "characterBuild.learnedSkillIds",
      "characterBuild.learnedSkills",
      "characterBuild.knownSkillIds",
      "characterBuild.knownSkills",
      "characterBuild.unlockedSkillIds",
    ]);
  }

  function progressionEarned(character = {}, options = {}) {
    const core = options.progressionCore || progressionCore();
    if (typeof core?.buildProgressionModel !== "function") return { skills: [], spells: [] };
    let model;
    try { model = core.buildProgressionModel(character); } catch (_) { return { skills: [], spells: [] }; }
    const skills = [];
    const spells = [];
    const collectNode = (node) => {
      if (!node || node.status !== "earned") return;
      (node.items || []).forEach((item) => {
        const id = normalizeId(item?.id || item?.grant?.skillId || item?.grant?.spellId);
        if (!id) return;
        if (item.kind === "skill" && !skills.includes(id)) skills.push(id);
        if (item.kind === "spell" && !spells.includes(id)) spells.push(id);
      });
    };
    (model?.classes || []).forEach((classModel) => {
      (classModel.commonNodes || []).forEach(collectNode);
      (classModel.branches || []).forEach((branch) => (branch.nodes || []).forEach(collectNode));
    });
    return { skills, spells };
  }

  function assignedSkillEntries(character = {}, options = {}) {
    const loadout = options.skillLoadout || skillLoadout();
    if (typeof loadout?.skillSlotEntries === "function") {
      try {
        const entries = loadout.skillSlotEntries(character)
          .map((entry) => ({ index: entry.index, skillId: normalizeId(entry.skillId) }))
          .filter((entry) => entry.skillId);
        if (entries.length) return entries;
      } catch (_) {}
    }
    if (typeof loadout?.skillIdsFor === "function") {
      try {
        const ids = loadout.skillIdsFor(character).map(normalizeId).filter(Boolean);
        if (ids.length) return ids.map((skillId, index) => ({ index, skillId }));
      } catch (_) {}
    }
    const values = rawIds(character, [
      "characterBuild.skillSlotIds",
      "skillSlotIds",
      "characterBuild.skillIds",
      "skillIds",
      "characterBuild.equippedSkillIndex",
      "equippedSkillIndex",
    ]);
    return values.map((skillId, index) => ({ index, skillId }));
  }

  function skillLibrary(options = {}) {
    const loadout = options.skillLoadout || skillLoadout();
    try {
      const library = loadout?.skillLibrary?.();
      if (library && typeof library === "object") return library;
    } catch (_) {}
    return global.LuminousPlayerSignatureSkillCatalog?.DEFINITIONS || {};
  }

  function definitionFor(id, library = {}) {
    const raw = library[id] || {};
    return {
      id,
      name: clean(raw.name || raw.nombre) || id,
      nombre: clean(raw.nombre || raw.name) || id,
      tier: Math.max(0, Number.parseInt(raw.tier ?? raw.skillTier ?? raw.metadata?.tier ?? 0, 10) || 0),
      type: clean(raw.type || raw.skillType || (raw.isDefense ? "Defense" : "Attack")) || "Skill",
      basePower: Number(raw.basePower ?? raw.base_power ?? 0) || 0,
      coinPower: Number(raw.coinPower ?? raw.coin_power ?? 0) || 0,
      coinAmount: Math.max(0, Number.parseInt(raw.coinAmount ?? raw.coinCount ?? raw.coin_count ?? 0, 10) || 0),
      attackWeight: Number(raw.attackWeight ?? raw.attack_weight ?? 1) || 1,
      sin: clean(raw.sinAffinity || raw.sin || raw.pecado || "sinless"),
      damageType: clean(raw.damageType || raw.tipo_dano || raw.dmgType || ""),
      targetingType: clean(raw.targetingType || raw.targeting_type || ""),
      range: Number(raw.skillRange ?? raw.range ?? 0) || 0,
      description: clean(raw.description || raw.descripcion || raw.metadata?.description || ""),
      effects: Array.isArray(raw.effects) ? raw.effects : [],
      coins: Array.isArray(raw.coins) ? raw.coins : [],
      isDefense: raw.isDefense === true,
      sourceType: clean(raw.sourceType || raw.metadata?.sourceType || ""),
    };
  }

  function buildSkillViewModel(character = {}, options = {}) {
    const assignedEntries = assignedSkillEntries(character, options);
    const assignedCount = new Map();
    assignedEntries.forEach((entry) => assignedCount.set(entry.skillId, (assignedCount.get(entry.skillId) || 0) + 1));

    const earned = progressionEarned(character, options);
    const learned = new Set([...explicitLearnedSkillIds(character), ...earned.skills]);
    const ids = [...new Set([...assignedCount.keys(), ...learned])];
    const library = skillLibrary(options);
    const skills = ids.map((id) => ({
      ...definitionFor(id, library),
      assigned: assignedCount.has(id),
      learned: learned.has(id),
      copies: assignedCount.get(id) || 0,
    })).sort((a, b) => {
      if (a.assigned !== b.assigned) return a.assigned ? -1 : 1;
      if (a.tier !== b.tier) return (a.tier || 99) - (b.tier || 99);
      return a.name.localeCompare(b.name);
    });

    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const deck = build.skillDeck || character.skillDeck || {};
    const casters = spellcastingClasses(character, options);
    const selectedSpellIds = global.LuminousSpellLoadout?.selectedIds(character) || rawIds(character, [
      "spellIds",
      "spellSelections",
      "characterBuild.spellIds",
      "characterBuild.spellSelections",
    ]);

    return {
      characterName: clean(character.characterName || character.character_name || character.nombre || character.name) || "PLAYER",
      assignedEntries,
      assignedUnique: assignedCount.size,
      learnedUnique: learned.size,
      progressionSpellIds: earned.spells,
      selectedSpellIds,
      skills,
      deck: {
        tier1: normalizeId(deck.tier1 ?? deck.t1 ?? deck["1"] ?? deck.skill1),
        tier2: normalizeId(deck.tier2 ?? deck.t2 ?? deck["2"] ?? deck.skill2),
        tier3: normalizeId(deck.tier3 ?? deck.t3 ?? deck["3"] ?? deck.skill3),
      },
      spellcaster: casters.length > 0,
      spellcastingClasses: casters,
    };
  }

  function hudScaleForViewport(width, height) {
    const viewportWidth = Math.max(1, Number(width) || 1);
    const viewportHeight = Math.max(1, Number(height) || 1);
    // Compact screens use an actual responsive layout, never a 1600px
    // screenshot scaled down to unreadable text and touch targets.
    if (viewportWidth <= 900) return 1;
    const availableWidth = Math.max(1, viewportWidth - HUD_CANVAS.gutter);
    const availableHeight = Math.max(1, viewportHeight - HUD_CANVAS.gutter);
    return Math.min(1, availableWidth / HUD_CANVAS.width, availableHeight / HUD_CANVAS.height);
  }

  function syncHudCanvasScale() {
    const doc = global.document;
    const modal = doc?.getElementById("skills-modal");
    if (!modal) return 1;
    const viewport = global.visualViewport;
    const width = viewport?.width || doc.documentElement?.clientWidth || global.innerWidth || HUD_CANVAS.width;
    const height = viewport?.height || doc.documentElement?.clientHeight || global.innerHeight || HUD_CANVAS.height;
    const scale = hudScaleForViewport(width, height);
    modal.style.setProperty("--player-skills-hud-scale", scale.toFixed(5));
    modal.dataset.playerSkillsHudScale = scale.toFixed(5);
    return scale;
  }

  function syncMenuIcon(character = playerData(), options = {}) {
    const doc = global.document;
    const button = doc?.querySelector('button[name="act_hud_skills"]');
    if (!button) return false;
    const icon = button.querySelector("[data-player-skills-menu-icon]");
    const caster = isSpellcaster(character, options);
    if (icon) {
      icon.src = caster
        ? "Assets/Images/Buttons/Spells.png"
        : "Assets/Images/Buttons/Skills.png";
    }
    button.dataset.playerSkillsMenuMode = caster ? "spells" : "skills";
    button.title = caster ? "Habilidades y Spells" : "Habilidades";
    button.setAttribute("aria-label", caster ? "Abrir habilidades y spells" : "Abrir habilidades");
    return caster;
  }

  function mount() {
    const doc = global.document;
    const modal = doc?.getElementById("skills-modal");
    const body = modal?.querySelector(".hud-modal-body");
    if (!body) return null;
    if (!body.querySelector(".player-combat-skills-console")) {
      body.innerHTML = `
        <section class="player-combat-skills-console" aria-label="Combat Skills">
          <header class="player-skills-header">
            <div class="player-skills-title">
              <span>HABILIDADES DE COMBATE</span>
              <strong data-player-skills-character>PLAYER</strong>
            </div>
            <div class="player-skills-metrics">
              <div><span>ASSIGNED</span><b data-player-skills-assigned>0</b></div>
              <div><span>LEARNED</span><b data-player-skills-learned>0</b></div>
              <div data-player-skills-caster-card><span>CASTING</span><b data-player-skills-caster>—</b></div>
            </div>
          </header>
          <div class="player-skills-main">
            <aside class="player-skills-deck-panel">
              <header><span>HABILIDADES</span><strong>SKILLS EQUIPADAS</strong></header>
              <div class="player-skills-deck" data-player-skills-deck></div>
              
            </aside>
            <main class="player-skills-library-panel">
              <div class="player-skills-library-toolbar">
                <div>
                  <span>COLECCIÓN</span>
                  <strong>TUS HABILIDADES</strong>
                </div>
                <nav aria-label="Skill filters">
                  <button type="button" data-player-skills-filter="all">TODAS</button>
                  <button type="button" data-player-skills-filter="assigned">EQUIPADAS</button>
                  <button type="button" data-player-skills-filter="learned">APRENDIDAS</button>
                </nav>
              </div>
              <div class="player-skills-list" data-player-skills-list></div>
            </main>
            <aside class="player-skills-detail-panel" data-player-skills-detail></aside>
          </div>
        </section>`;

      body.addEventListener("click", (event) => {
        const filter = event.target?.closest?.("[data-player-skills-filter]");
        if (filter) {
          state.filter = filter.getAttribute("data-player-skills-filter") || "all";
          render();
          return;
        }
        const row = event.target?.closest?.("[data-player-skill-id]");
        if (row) {
          state.selectedSkillId = row.getAttribute("data-player-skill-id");
          render();
        }
      });
    }
    return body.querySelector(".player-combat-skills-console");
  }

  function skillLabel(id, model) {
    if (!id) return "EMPTY";
    return model.skills.find((skill) => skill.id === id)?.name || skillLibrary()?.[id]?.name || id;
  }

  function deckMarkup(model) {
    const slots = [
      { key: "tier1", label: "TIER I", copies: 3 },
      { key: "tier2", label: "TIER II", copies: 2 },
      { key: "tier3", label: "TIER III", copies: 1 },
    ];
    const hasDeck = slots.some((slot) => model.deck[slot.key]);
    if (hasDeck) {
      return slots.map((slot) => {
        const id = model.deck[slot.key];
        return `<button type="button" class="player-skills-deck-slot${id ? "" : " is-empty"}" ${id ? `data-player-skill-id="${escapeHtml(id)}"` : ""}>
          <span>${slot.label}</span>
          <strong>${escapeHtml(skillLabel(id, model))}</strong>
          <b>×${slot.copies}</b>
        </button>`;
      }).join("");
    }
    if (!model.skills.some((skill) => skill.assigned)) {
      return '<div class="player-skills-empty"><strong>SIN SKILLS EQUIPADAS</strong><span>El DM puede equipar tus habilidades en el menú de personaje.</span></div>';
    }
    return model.skills.filter((skill) => skill.assigned).map((skill) => `
      <button type="button" class="player-skills-deck-slot" data-player-skill-id="${escapeHtml(skill.id)}">
        <span>ASSIGNED</span><strong>${escapeHtml(skill.name)}</strong><b>×${skill.copies}</b>
      </button>`).join("");
  }

  function skillRowMarkup(skill) {
    const badges = [
      skill.assigned ? '<span class="is-assigned">ASSIGNED</span>' : "",
      skill.learned ? '<span class="is-learned">LEARNED</span>' : "",
    ].join("");
    const tier = skill.tier ? `T${skill.tier}` : "—";
    const power = skill.coinAmount ? `${skill.basePower} + ${skill.coinPower} × ${skill.coinAmount}` : String(skill.basePower || "—");
    return `<button type="button" class="player-skills-row${state.selectedSkillId === skill.id ? " is-selected" : ""}" data-player-skill-id="${escapeHtml(skill.id)}">
      <span class="player-skills-row-tier">${escapeHtml(tier)}</span>
      <span class="player-skills-row-name"><strong>${escapeHtml(skill.name)}</strong><small>${escapeHtml([skill.sin, skill.damageType].filter(Boolean).join(" · "))}</small></span>
      <span class="player-skills-row-power">${escapeHtml(power)}<small>${" ●".repeat(Math.min(skill.coinAmount, 6))}</small></span>
      <span class="player-skills-row-badges">${badges}</span>
    </button>`;
  }

  function statusEffectsForSkill(skill = {}) {
  const rows = (Array.isArray(skill.effects) ? skill.effects : []).map((effect) => ({ effect, coinIndex: null }));
  (Array.isArray(skill.coins) ? skill.coins : []).forEach((coin, index) => {
    if (Array.isArray(coin?.effects)) coin.effects.forEach((effect) => rows.push({ effect, coinIndex: index + 1 }));
  });
  const seen = new Set();
  return rows.map(({ effect, coinIndex }) => {
    if (!effect || typeof effect !== "object") return null;
    const statusId = clean(effect.statusId || effect.statusEffectId || effect.status || effect.status_effect);
    const definition = statusId ? global.LuminousStatusLibrary?.get?.(statusId) : null;
    const explicitName = clean(effect.statusName || effect.name || effect.label || definition?.name);
    if (!statusId && !explicitName) return null;
    const name = explicitName || statusId.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    const description = clean(effect.description || effect.descripcion || definition?.description);
    const iconRaw = clean(definition?.icon);
    const icon = /^(https:\/\/|Assets\/)/.test(iconRaw) ? iconRaw : "";
    const potency = effect.potency == null ? null : Number(effect.potency);
    const count = effect.count == null ? null : Number(effect.count);
    const rawTrigger = clean(effect.trigger).toLowerCase().replace(/[\[\]]/g, "").replace(/[\s-]+/g, "_");
    const trigger = ["on_hit", "onhit"].includes(rawTrigger) ? "Al impactar" : (["on_use", "onuse"].includes(rawTrigger) ? "Al usar" : "");
    const target = clean(effect.target).toLowerCase() === "self" ? "Usuario" : (clean(effect.target).toLowerCase() === "target" ? "Objetivo" : "");
    const key = [name.toLowerCase(), coinIndex, potency, count, trigger, target].join("|");
    if (seen.has(key)) return null;
    seen.add(key);
    return {
      name, description, icon, coinIndex,
      potency: Number.isFinite(potency) ? potency : null,
      count: Number.isFinite(count) ? count : null,
      trigger, target,
    };
  }).filter(Boolean);
}


  function effectLines(skill = {}) {
    const known = (effect, index) => {
      if (typeof effect === "string") return { text: effect, trigger: index == null ? "On Use" : "On Hit", icon: "", status: "" };
      if (!effect || typeof effect !== "object") return null;
      const status = clean(effect.statusId || effect.statusEffectId || effect.status || effect.status_effect);
      const definition = status ? global.LuminousStatusLibrary?.get?.(status) : null;
      const name = clean(definition?.name || effect.statusName || (status ? status.replace(/[_-]+/g, " ") : ""));
      const sourceText = clean(effect.description || effect.descripcion || effect.text || effect.label || effect.tooltip);
      const parts = [];
      const action = clean(effect.action || effect.operation || effect.applyType || effect.mode).toLowerCase();
      const verb = action === "gain" || clean(effect.target).toLowerCase() === "self" ? "Gain" : "Inflict";
      const potency = effect.potency == null ? null : Number(effect.potency);
      const count = effect.count == null ? null : Number(effect.count);
      if (Number.isFinite(potency)) parts.push(verb + " " + (potency >= 0 ? "+" : "") + potency + " " + name);
      if (Number.isFinite(count)) parts.push(verb + " " + (count >= 0 ? "+" : "") + count + " " + name + " Count");
      if (!parts.length && name) parts.push(verb + " " + name);
      const triggerText = clean(effect.trigger || effect.activation || effect.when || (index == null ? "On Use" : "On Hit"))
        .replace(/[\[\]]/g, "").replace(/_/g, " ");
      return { trigger: triggerText || "On Use", text: sourceText || parts.join("; ") || clean(effect.name || effect.type) || "Effect",
        icon: clean(definition?.icon), status: name };
    };
    const general = (Array.isArray(skill.effects) ? skill.effects : []).map((effect) => known(effect, null)).filter(Boolean);
    const coins = Array.from({ length: Math.max(Number(skill.coinAmount) || 0, Array.isArray(skill.coins) ? skill.coins.length : 0) }, (_, i) => ({
      index: i + 1, effects: (Array.isArray(skill.coins?.[i]?.effects) ? skill.coins[i].effects : []).map((effect) => known(effect, i + 1)).filter(Boolean)
    }));
    return { general, coins };
  }

  function detailMarkup(skill) {
    if (!skill) return '<div class="player-skills-detail-empty"><strong>ELIGE UNA HABILIDAD</strong></div>';
    const count = Math.max(Number(skill.coinAmount) || 0, skill.coins?.length || 0);
    const icon = (value, alt) => /^(https:\/\/|Assets\/)/.test(value || "")
      ? '<img class="limbus-effect-icon" src="' + escapeHtml(value) + '" alt="' + escapeHtml(alt) + '">'
      : "";
    const richLine = (row) => '<div class="limbus-effect-line"><span class="limbus-effect-trigger">[' +
      escapeHtml(row.trigger) + ']</span> <span class="limbus-effect-description">' +
      icon(row.icon, row.status) + escapeHtml(row.text) + '</span></div>';
    const lines = effectLines(skill);
    const coinMark = (i) => '<span class="limbus-coin-emblem" aria-label="Coin ' + i + '">' + ["","I","II","III","IV","V","VI"][i % 7] + '</span>';
    const coinTrack = Array.from({length: Math.min(count,16)},(_,i)=>'<span class="limbus-coin-top" aria-hidden="true">⬡</span>').join("");
    return '<article class="limbus-skill-tooltip">' +
      '<header class="limbus-skill-heading"><div class="limbus-skill-top-coins">' + coinTrack + '</div>' +
      '<div class="limbus-skill-name"><span class="limbus-skill-tier">T' + escapeHtml(skill.tier || "—") +
      '</span><strong>' + escapeHtml(skill.name) + '</strong></div>' +
      '<div class="limbus-skill-stats"><span>⚔ ' + escapeHtml(skill.basePower) + ' (' + escapeHtml(skill.basePower) +
      (skill.coinPower >= 0 ? '+' : '') + escapeHtml(skill.coinPower) + ')</span><span>Atk Weight ' +
      escapeHtml(skill.attackWeight ?? 1) + '</span></div>' +
      '<div class="limbus-skill-power"><b>' + escapeHtml(skill.coinPower >= 0 ? "+" + skill.coinPower : skill.coinPower) +
      '</b><span>Amt. x' + count + '</span><span>' + escapeHtml(skill.sin || "") + '</span></div></header>' +
      '<div class="limbus-skill-effect-sections"><section class="limbus-effect-general">' +
      (lines.general.length ? lines.general.map(richLine).join("") : "") + '</section>' +
      lines.coins.map((coin) => '<section class="limbus-coin-section">' + coinMark(coin.index) +
        '<div class="limbus-coin-effects">' + (coin.effects.length ? coin.effects.map(richLine).join("") :
          '<span class="limbus-effect-empty">—</span>') + '</div></section>').join("") +
      (skill.description ? '<p class="limbus-skill-description">' + escapeHtml(skill.description) + '</p>' : "") +
      '</div></article>';
  }

  function visibleSelectionId(rows = [], selectedSkillId = null) {
    const selected = normalizeId(selectedSkillId);
    if (selected && rows.some((skill) => skill.id === selected)) return selected;
    return rows[0]?.id || null;
  }

  function render(character = playerData()) {
    const root = mount();
    if (!root) return false;
    const model = buildSkillViewModel(character);
    syncMenuIcon(character);
    syncHudCanvasScale();

    const characterName = root.querySelector("[data-player-skills-character]");
    if (characterName) characterName.textContent = model.characterName;
    const assigned = root.querySelector("[data-player-skills-assigned]");
    if (assigned) assigned.textContent = String(model.assignedUnique);
    const learned = root.querySelector("[data-player-skills-learned]");
    if (learned) learned.textContent = String(model.learnedUnique);
    const caster = root.querySelector("[data-player-skills-caster]");
    if (caster) caster.textContent = model.spellcaster
      ? model.spellcastingClasses.map((entry) => entry.classId.toUpperCase()).join(" / ")
      : "NON-CASTER";
    root.querySelector("[data-player-skills-caster-card]")?.classList.toggle("is-caster", model.spellcaster);

    const deck = root.querySelector("[data-player-skills-deck]");
    if (deck) deck.innerHTML = deckMarkup(model);

    let rows = model.skills;
    if (state.filter === "assigned") rows = rows.filter((skill) => skill.assigned);
    if (state.filter === "learned") rows = rows.filter((skill) => skill.learned);
    state.selectedSkillId = visibleSelectionId(rows, state.selectedSkillId);

    root.querySelectorAll("[data-player-skills-filter]").forEach((button) => {
      button.classList.toggle("is-active", button.getAttribute("data-player-skills-filter") === state.filter);
    });

    const list = root.querySelector("[data-player-skills-list]");
    if (list) list.innerHTML = rows.length
      ? rows.map(skillRowMarkup).join("")
      : '<div class="player-skills-empty"><strong>NO SKILLS IN THIS VIEW</strong><span>The Player has no Skills matching this filter.</span></div>';

    const selected = rows.find((skill) => skill.id === state.selectedSkillId) || null;
    const detail = root.querySelector("[data-player-skills-detail]");
    if (detail) {
      detail.innerHTML = detailMarkup(selected, model);
      global.LuminousRuleReferences?.decorate?.(detail, { mode: "card" });
    }
    return model;
  }

  function bindSkillCatalog() {
    if (state.dbRef) return true;
    const db = global.firebase?.database?.();
    if (!db?.ref) return false;
    const ref = db.ref(SKILL_DB_ROOT);
    const handler = (snapshot) => {
      try { skillLoadout()?.applySkills?.(snapshot.val() || {}); } catch (_) {}
      render();
    };
    ref.on("value", handler);
    state.dbRef = ref;
    state.dbHandler = handler;
    return true;
  }

  function init() {
    if (!global.document) return false;
    mount();
    syncMenuIcon();
    bindSkillCatalog();
    render();
    if (!state.initialized) {
      global.addEventListener?.("luminous:player-data", (event) => render(event?.detail?.data || playerData()));
      global.addEventListener?.("luminous:class-runtime-loaded", () => render());
      global.addEventListener?.("resize", syncHudCanvasScale);
      global.visualViewport?.addEventListener?.("resize", syncHudCanvasScale);
      state.initialized = true;
    }
    return true;
  }

  function stop() {
    if (state.dbRef && state.dbHandler) {
      try { state.dbRef.off("value", state.dbHandler); } catch (_) {}
    }
    state.dbRef = null;
    state.dbHandler = null;
    return true;
  }

  if (global.document) {
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
  }

  return Object.freeze({
    VERSION,
    HUD_CANVAS,
    SKILL_DB_ROOT,
    state,
    normalizeId,
    normalizeClasses,
    spellcastingClasses,
    isSpellcaster,
    explicitLearnedSkillIds,
    progressionEarned,
    assignedSkillEntries,
    buildSkillViewModel,
    statusEffectsForSkill,
    detailMarkup,
    effectLines,
    visibleSelectionId,
    hudScaleForViewport,
    syncHudCanvasScale,
    syncMenuIcon,
    render,
    init,
    stop,
  });
});
