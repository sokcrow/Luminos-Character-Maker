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
      sin: clean(raw.sinAffinity || raw.sin || raw.pecado || "sinless"),
      damageType: clean(raw.damageType || raw.tipo_dano || raw.dmgType || ""),
      targetingType: clean(raw.targetingType || raw.targeting_type || ""),
      range: Number(raw.skillRange ?? raw.range ?? 0) || 0,
      description: clean(raw.description || raw.descripcion || raw.metadata?.description || ""),
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
    const selectedSpellIds = rawIds(character, [
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
    const sword = button.querySelector("[data-player-skills-menu-sword]");
    const spells = button.querySelector("[data-player-skills-menu-spell]");
    const caster = isSpellcaster(character, options);
    if (sword) sword.hidden = caster;
    if (spells) spells.hidden = !caster;
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
              <span>COMBAT LOADOUT // PLAYER</span>
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
              <header><span>COMBAT ENGINE</span><strong>ASSIGNED DECK</strong></header>
              <div class="player-skills-deck" data-player-skills-deck></div>
              <div class="player-skills-source-note">
                <b>LOADOUT SOURCE</b>
                <span>Assigned Skills come from the same Skill Deck / slot carriers consumed by Combat Engine.</span>
              </div>
            </aside>
            <main class="player-skills-library-panel">
              <div class="player-skills-library-toolbar">
                <div>
                  <span>SKILL ARCHIVE</span>
                  <strong>AVAILABLE COMBAT SKILLS</strong>
                </div>
                <nav aria-label="Skill filters">
                  <button type="button" data-player-skills-filter="all">ALL</button>
                  <button type="button" data-player-skills-filter="assigned">ASSIGNED</button>
                  <button type="button" data-player-skills-filter="learned">LEARNED</button>
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
      return '<div class="player-skills-empty"><strong>NO ASSIGNED SKILLS</strong><span>Combat Engine has no active Skill loadout for this Player.</span></div>';
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
      <span class="player-skills-row-name"><strong>${escapeHtml(skill.name)}</strong><small>${escapeHtml(skill.id)}</small></span>
      <span class="player-skills-row-power">${escapeHtml(power)}</span>
      <span class="player-skills-row-badges">${badges}</span>
    </button>`;
  }

  function detailMarkup(skill, model) {
    if (!skill) {
      return `<div class="player-skills-detail-empty"><span>SKILL DATA</span><strong>SELECT A SKILL</strong><p>Inspect the same combat definition used by Combat Engine.</p>${model.spellcaster ? '<em>Spellcaster detected · the menu uses the local Spells icon.</em>' : ""}</div>`;
    }
    const tags = [
      skill.assigned ? '<span class="is-assigned">ASSIGNED</span>' : "",
      skill.learned ? '<span class="is-learned">LEARNED</span>' : "",
    ].join("");
    return `
      <header class="player-skills-detail-header">
        <span>COMBAT DEFINITION</span>
        <strong>${escapeHtml(skill.name)}</strong>
        <small>${escapeHtml(skill.id)}</small>
        <div class="player-skills-detail-badges">${tags}</div>
      </header>
      <div class="player-skills-detail-grid">
        <div><span>TYPE</span><b>${escapeHtml(skill.type || "Skill")}</b></div>
        <div><span>TIER</span><b>${skill.tier || "—"}</b></div>
        <div><span>BASE POWER</span><b>${skill.basePower}</b></div>
        <div><span>COIN POWER</span><b>${skill.coinPower}</b></div>
        <div><span>COINS</span><b>${skill.coinAmount || "—"}</b></div>
        <div><span>COPIES</span><b>${skill.copies || "—"}</b></div>
        <div><span>SIN</span><b>${escapeHtml(skill.sin || "sinless")}</b></div>
        <div><span>DAMAGE</span><b>${escapeHtml(skill.damageType || "—")}</b></div>
        <div><span>TARGETING</span><b>${escapeHtml(skill.targetingType || "—")}</b></div>
        <div><span>RANGE</span><b>${skill.range || "—"}</b></div>
      </div>
      <div class="player-skills-detail-description">
        <span>DESCRIPTION</span>
        <p>${escapeHtml(skill.description || "No additional description registered. Combat values above remain authoritative.")}</p>
      </div>`;
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
    if (detail) detail.innerHTML = detailMarkup(selected, model);
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
    visibleSelectionId,
    hudScaleForViewport,
    syncHudCanvasScale,
    syncMenuIcon,
    render,
    init,
    stop,
  });
});
