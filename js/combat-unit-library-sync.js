(function (global) {
  'use strict';
  if (global.LuminousCombatUnitLibrarySync) return;

  const ROOTS = Object.freeze({
    units: 'campaña/base_datos_unidades',
    skills: 'campaña/base_datos_skills'
  });

  // Library materialization must not depend on the FIELD deployment runtime.
  // The catalog is useful to the DM even when Firebase is empty/offline or the
  // deploy bridge is still loading.
  const CATALOG_SCRIPTS = Object.freeze([
    'js/combat-skill-schema.js',
    'js/skill-catalog-kobold-tier1.js',
    'js/skill-catalog-goblin-tier1.js',
    'js/skill-catalog-wolf.js',
    'js/unit-rank-runtime.js',
    'js/universal-action-economy.js',
    'js/universal-ranged-ammo-runtime.js',
    'js/creature-type-catalog.js',
    'js/goblin-unit-runtime.js',
    'js/wolf-unit-runtime.js',
    'js/unit-catalog-kobold-tier1.js',
    'js/unit-catalog-goblin.js',
    'js/unit-catalog-wolf.js'
  ]);

  const DEPLOYMENT_SCRIPTS = Object.freeze([
    'js/unit-combat-instantiator.js',
    'js/combat-v073-unit-deploy-bridge.js'
  ]);

  const state = {
    loading: null,
    deploymentLoading: null,
    localUnits: {},
    localSkills: {},
    fallbackDb: null,
    fallbackUnsubscribers: []
  };

  const clean = (value) => String(value ?? '').trim();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function readyForScript(src) {
    const checks = {
      'js/combat-skill-schema.js': () => Boolean(global.CombatSkillSchema),
      'js/skill-catalog-kobold-tier1.js': () => Boolean(global.LuminousKoboldTier1SkillCatalog),
      'js/skill-catalog-goblin-tier1.js': () => Boolean(global.LuminousGoblinTier1SkillCatalog),
      'js/skill-catalog-wolf.js': () => Boolean(global.LuminousWolfSkillCatalog),
      'js/unit-rank-runtime.js': () => Boolean(global.LuminousUnitRankRuntime),
      'js/universal-action-economy.js': () => Boolean(global.LuminousActionEconomy),
      'js/universal-ranged-ammo-runtime.js': () => Boolean(global.LuminousUniversalRangedAmmoRuntime),
      'js/creature-type-catalog.js': () => Boolean(global.LuminousCreatureTypeCatalog),
      'js/goblin-unit-runtime.js': () => Boolean(global.LuminousGoblinUnitRuntime),
      'js/wolf-unit-runtime.js': () => Boolean(global.LuminousWolfUnitRuntime),
      'js/unit-catalog-kobold-tier1.js': () => Boolean(global.LuminousKoboldUnitCatalog),
      'js/unit-catalog-goblin.js': () => Boolean(global.LuminousGoblinUnitCatalog),
      'js/unit-catalog-wolf.js': () => Boolean(global.LuminousWolfUnitCatalog),
      'js/unit-combat-instantiator.js': () => Boolean(global.LuminousUnitCombatInstantiator),
      'js/combat-v073-unit-deploy-bridge.js': () => Boolean(global.LuminousCombat073UnitDeployBridge)
    };
    const check = checks[src];
    if (!check) return false;
    try { return check(); } catch (_) { return false; }
  }

  function loadScript(src, timeoutMs = 5000) {
    if (readyForScript(src)) return Promise.resolve(null);
    if (!global.document?.head) return Promise.reject(new Error('DOCUMENT_UNAVAILABLE'));

    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      let poll = null;
      const existing = global.document.querySelector?.(`script[src="${src}"]`) || null;
      const script = existing || global.document.createElement('script');

      const cleanup = () => {
        if (timer) global.clearTimeout?.(timer);
        if (poll) global.clearInterval?.(poll);
        script.removeEventListener?.('load', onLoad);
        script.removeEventListener?.('error', onError);
      };
      const finish = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve(script);
      };
      const onLoad = () => {
        script.dataset.loaded = '1';
        // Some catalog scripts initialize synchronously on load. Give dependent
        // globals one microtask before moving to the next dependency.
        Promise.resolve().then(() => finish());
      };
      const onError = () => finish(new Error(`SCRIPT_LOAD_FAILED:${src}`));

      script.addEventListener?.('load', onLoad, { once: true });
      script.addEventListener?.('error', onError, { once: true });

      // The previous loader could wait forever when a script element already
      // existed and its load event had fired before these listeners were added.
      // Poll the canonical global as an authoritative ready signal instead.
      poll = global.setInterval?.(() => {
        if (readyForScript(src) || script.dataset?.loaded === '1' || script.readyState === 'complete') finish();
      }, 25);
      timer = global.setTimeout?.(() => {
        if (readyForScript(src) || script.dataset?.loaded === '1' || script.readyState === 'complete') return finish();
        finish(new Error(`SCRIPT_LOAD_TIMEOUT:${src}`));
      }, timeoutMs);

      if (!existing) {
        script.src = src;
        script.async = false;
        global.document.head.appendChild(script);
      } else if (readyForScript(src) || existing.dataset?.loaded === '1' || existing.readyState === 'complete') {
        finish();
      }
    });
  }

  function catalogsReady() {
    return Boolean(
      global.CombatSkillSchema &&
      global.LuminousKoboldUnitCatalog &&
      global.LuminousGoblinTier1SkillCatalog &&
      global.LuminousGoblinUnitCatalog &&
      global.LuminousWolfUnitCatalog
    );
  }

  async function ensureCatalogs() {
    if (catalogsReady()) return true;
    if (state.loading) return state.loading;
    state.loading = (async () => {
      for (const src of CATALOG_SCRIPTS) {
        if (!readyForScript(src)) await loadScript(src);
      }
      if (!catalogsReady()) throw new Error('CATALOGS_NOT_READY');
      return true;
    })().finally(() => { state.loading = null; });
    return state.loading;
  }

  async function ensureDeploymentRuntime() {
    if (global.LuminousUnitCombatInstantiator && global.LuminousCombat073UnitDeployBridge) return true;
    if (state.deploymentLoading) return state.deploymentLoading;
    state.deploymentLoading = (async () => {
      for (const src of DEPLOYMENT_SCRIPTS) {
        if (!readyForScript(src)) await loadScript(src);
      }
      return Boolean(global.LuminousUnitCombatInstantiator && global.LuminousCombat073UnitDeployBridge);
    })().finally(() => { state.deploymentLoading = null; });
    return state.deploymentLoading;
  }

  function mergePayloads(...payloads) {
    const merged = {};
    for (const payload of payloads) {
      for (const [id, value] of Object.entries(payload || {})) {
        if (Object.prototype.hasOwnProperty.call(merged, id)) throw new Error(`DUPLICATE_LIBRARY_ID:${id}`);
        merged[id] = value;
      }
    }
    return merged;
  }

  async function buildPayloads() {
    await ensureCatalogs();
    const schema = global.CombatSkillSchema;
    const kobolds = global.LuminousKoboldUnitCatalog;
    const goblins = global.LuminousGoblinUnitCatalog;
    const wolves = global.LuminousWolfUnitCatalog;
    const units = mergePayloads(
      kobolds.firebasePayload(),
      goblins.firebasePayload(),
      wolves.firebasePayload()
    );
    const skills = mergePayloads(
      kobolds.firebaseSkillPayload(schema),
      goblins.firebaseSkillPayload(schema),
      wolves.firebaseSkillPayload(schema)
    );
    state.localUnits = clone(units) || {};
    state.localSkills = clone(skills) || {};
    return { units, skills };
  }

  function diagnostics(units = {}) {
    const rows = Object.entries(units || {}).map(([id, unit]) => ({ id, unit: unit || {} }));
    const pendingSprites = rows.filter(({ unit }) => unit.metadata?.spritePending === true || !clean(
      unit.combatSprite || unit.sprite_combate || unit.combat_sprite || unit.visual?.spriteUrl ||
      unit.tokenImage || unit.sprite || unit.idle_sprite || unit.icono || unit.img || unit.image
    )).map(({ id }) => id);
    const pendingWeaponSkills = rows.filter(({ unit }) => unit.metadata?.weaponSkillsPendingCanonicalCatalog === true).map(({ id }) => id);
    const families = {
      kobold: rows.filter(({ unit, id }) => clean(unit.species || unit.family || id).toLowerCase().includes('kobold')).length,
      goblin: rows.filter(({ unit, id }) => clean(unit.species || unit.family || id).toLowerCase().includes('goblin')).length,
      wolf: rows.filter(({ unit, id }) => clean(unit.species || unit.family || id).toLowerCase().includes('wolf')).length
    };
    return { pendingSprites, pendingWeaponSkills, families };
  }

  async function readObject(db, path) {
    if (!db?.ref) throw new Error('FIREBASE_DB_REQUIRED');
    const snapshot = await db.ref(path).once('value');
    const value = snapshot.val();
    return value && typeof value === 'object' ? value : {};
  }

  function canonicalUpgradeNeeded(existing = {}, canonical = {}) {
    if (existing?.metadata?.canonicalUnit !== true || canonical?.metadata?.canonicalUnit !== true) return false;
    const beforeSkills = Array.isArray(existing.action_slots) ? existing.action_slots.length : Array.isArray(existing.mechanics?.skills) ? existing.mechanics.skills.length : 0;
    const afterSkills = Array.isArray(canonical.action_slots) ? canonical.action_slots.length : Array.isArray(canonical.mechanics?.skills) ? canonical.mechanics.skills.length : 0;
    return Number(existing.schemaVersion || 0) < Number(canonical.schemaVersion || 0) ||
      (existing.metadata?.weaponSkillsPendingCanonicalCatalog === true && canonical.metadata?.weaponSkillsPendingCanonicalCatalog === false) ||
      beforeSkills < afterSkills;
  }

  function mergeCanonicalUpgrade(existing = {}, canonical = {}) {
    const upgraded = {
      ...clone(canonical),
      visual: { ...(clone(canonical.visual) || {}), ...(clone(existing.visual) || {}) },
      combatVisual: { ...(clone(canonical.combatVisual) || {}), ...(clone(existing.combatVisual) || {}) },
      metadata: { ...(clone(canonical.metadata) || {}), ...(clone(existing.metadata) || {}) }
    };
    if (canonical.metadata?.weaponSkillsPendingCanonicalCatalog === false) upgraded.metadata.weaponSkillsPendingCanonicalCatalog = false;
    for (const key of ['combatSprite', 'sprite_combate', 'combat_sprite', 'spriteX', 'spriteY', 'scale', 'visualScale']) {
      if (existing[key] != null && existing[key] !== '') upgraded[key] = clone(existing[key]);
    }
    return upgraded;
  }

  function isPlayerUnit(unit = {}) {
    const category = clean(unit.actorCategory || unit.category || unit.type || unit.canonicalScope).toLowerCase();
    return unit.isPlayer === true || category === 'player';
  }

  function unitName(unit = {}, fallback = 'Unit') {
    return clean(unit.characterName || unit.nombre || unit.name || unit.displayName || fallback) || fallback;
  }

  function spriteFor(unit = {}) {
    return clean(unit.combatSprite || unit.sprite_combate || unit.combat_sprite || unit.visual?.spriteUrl || unit.tokenImage || unit.sprite || unit.idle_sprite || unit.img || unit.image || unit.icono);
  }

  function skillCount(unit = {}) {
    const source = unit.action_slots || unit.skillIds || unit.skillSlotIds || unit.mechanics?.skills || [];
    return Array.isArray(source) ? source.length : (source && typeof source === 'object' ? Object.keys(source).length : 0);
  }

  function mergeLocalWithRemote(local, remote) {
    return { ...(clone(local) || {}), ...(clone(remote) || {}) };
  }

  function refreshCombatTabSelector() {
    const manager = global.LuminousDmCombatTabManager;
    const doc = global.document;
    const type = doc?.getElementById?.('dm-combat-tab-type');
    const entity = doc?.getElementById?.('dm-combat-tab-entity');
    if (!manager?.state || !type || !entity) return false;

    const selectedType = manager.state.selectedType || type.value || 'enemy';
    const selectedKey = manager.state.selectedKey || entity.value || '';
    type.value = selectedType;
    try { type.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) { return false; }

    if (selectedKey && manager.descriptorsFor?.(selectedType)?.some?.((row) => row.key === selectedKey)) {
      manager.state.selectedKey = selectedKey;
      entity.value = selectedKey;
      try { entity.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    }
    return true;
  }

  function refreshEncounterSelector() {
    const setup = global.LuminousCombatDmSetup073;
    const select = global.document?.getElementById?.('c073-unit');
    if (!setup?.state || !select) return false;
    const previous = select.value;
    const rows = Object.entries(setup.state.units || {})
      .filter(([, unit]) => !isPlayerUnit(unit || {}))
      .sort((a, b) => unitName(a[1], a[0]).localeCompare(unitName(b[1], b[0])));
    select.innerHTML = '<option value="">— Enemy / NPC Unit Library —</option>' + rows.map(([id, unit]) =>
      `<option value="${String(id).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}">${unitName(unit, id)}${spriteFor(unit) ? ' · SPRITE' : ' · SIN SPRITE'}${skillCount(unit) ? ` · ${skillCount(unit)} SKILLS` : ''}</option>`
    ).join('');
    if (setup.state.units?.[previous]) select.value = previous;
    return true;
  }

  function applyRuntimeFallback(units = state.localUnits, skills = state.localSkills, remoteUnits = null, remoteSkills = null) {
    const mergedUnits = mergeLocalWithRemote(units, remoteUnits || {});
    const mergedSkills = mergeLocalWithRemote(skills, remoteSkills || {});

    if (global.LuminousDmCombatTabManager?.state) {
      global.LuminousDmCombatTabManager.state.units = clone(mergedUnits) || {};
      global.LuminousDmCombatTabManager.state.skills = clone(mergedSkills) || {};
      refreshCombatTabSelector();
    }
    if (global.LuminousCombatDmSetup073?.state) {
      global.LuminousCombatDmSetup073.state.units = clone(mergedUnits) || {};
      refreshEncounterSelector();
    }

    try {
      global.dispatchEvent?.(new CustomEvent('luminous:combat-unit-library-local-ready', {
        detail: { units: clone(mergedUnits), skills: clone(mergedSkills), diagnostics: diagnostics(mergedUnits) }
      }));
    } catch (_) {}
    return { units: mergedUnits, skills: mergedSkills };
  }

  function uninstallRuntimeFallback() {
    state.fallbackUnsubscribers.splice(0).forEach((unsubscribe) => {
      try { unsubscribe(); } catch (_) {}
    });
    state.fallbackDb = null;
  }

  function installRuntimeFallback(db, payloads = {}) {
    const units = payloads.units || state.localUnits || {};
    const skills = payloads.skills || state.localSkills || {};
    state.localUnits = clone(units) || {};
    state.localSkills = clone(skills) || {};
    applyRuntimeFallback(units, skills);

    if (!db?.ref || state.fallbackDb === db) return true;
    uninstallRuntimeFallback();
    state.fallbackDb = db;

    let remoteUnits = {};
    let remoteSkills = {};
    const unitRef = db.ref(ROOTS.units);
    const skillRef = db.ref(ROOTS.skills);
    const rerender = () => applyRuntimeFallback(state.localUnits, state.localSkills, remoteUnits, remoteSkills);
    const onUnits = (snapshot) => {
      const value = snapshot?.val?.();
      remoteUnits = value && typeof value === 'object' ? value : {};
      rerender();
    };
    const onSkills = (snapshot) => {
      const value = snapshot?.val?.();
      remoteSkills = value && typeof value === 'object' ? value : {};
      rerender();
    };
    unitRef.on?.('value', onUnits);
    skillRef.on?.('value', onSkills);
    state.fallbackUnsubscribers.push(() => unitRef.off?.('value', onUnits));
    state.fallbackUnsubscribers.push(() => skillRef.off?.('value', onSkills));
    return true;
  }

  async function materialize(db, { force = false } = {}) {
    if (!db?.ref) throw new Error('FIREBASE_DB_REQUIRED');
    const { units, skills } = await buildPayloads();

    // Make bundled canonical Units immediately usable by the real DM UI before
    // any network write. Firebase is persistence, not the prerequisite for the
    // selector to know that Kobolds/Goblins/Wolves exist.
    installRuntimeFallback(db, { units, skills });
    ensureDeploymentRuntime().catch((error) => global.console?.warn?.('[Combat Unit Library] deploy runtime load failed', error));

    const [existingUnits, existingSkills] = await Promise.all([
      readObject(db, ROOTS.units),
      readObject(db, ROOTS.skills)
    ]);
    const updates = {};
    let unitsWritten = 0;
    let unitsUpgraded = 0;
    let skillsWritten = 0;
    for (const [id, value] of Object.entries(units)) {
      const existing = existingUnits[id];
      if (!force && existing) {
        if (!canonicalUpgradeNeeded(existing, value)) continue;
        updates[`${ROOTS.units}/${id}`] = mergeCanonicalUpgrade(existing, value);
        unitsUpgraded += 1;
        continue;
      }
      updates[`${ROOTS.units}/${id}`] = value;
      unitsWritten += 1;
    }
    for (const [id, value] of Object.entries(skills)) {
      if (!force && existingSkills[id]) continue;
      updates[`${ROOTS.skills}/${id}`] = value;
      skillsWritten += 1;
    }
    if (Object.keys(updates).length) await db.ref().update(updates);
    return {
      unitCount: Object.keys(units).length,
      skillCount: Object.keys(skills).length,
      unitsWritten,
      unitsUpgraded,
      skillsWritten,
      force,
      localFallbackActive: true,
      diagnostics: diagnostics(units)
    };
  }

  async function ensureMissing(db) {
    return materialize(db, { force: false });
  }

  async function syncAll(db) {
    return materialize(db, { force: true });
  }

  global.LuminousCombatUnitLibrarySync = Object.freeze({
    version: '1.3.0-real-ui',
    ROOTS,
    CATALOG_SCRIPTS,
    DEPLOYMENT_SCRIPTS,
    state,
    readyForScript,
    loadScript,
    catalogsReady,
    ensureCatalogs,
    ensureDeploymentRuntime,
    buildPayloads,
    diagnostics,
    canonicalUpgradeNeeded,
    mergeCanonicalUpgrade,
    mergeLocalWithRemote,
    applyRuntimeFallback,
    installRuntimeFallback,
    uninstallRuntimeFallback,
    ensureMissing,
    syncAll,
    materialize
  });
})(window);