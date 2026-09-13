(function (global) {
  'use strict';
  if (global.LuminousCombatUnitLibrarySync) return;

  const ROOTS = Object.freeze({
    units: 'campaña/base_datos_unidades',
    skills: 'campaña/base_datos_skills'
  });

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
    'js/unit-catalog-wolf.js',
    'js/unit-combat-instantiator.js',
    'js/combat-v073-unit-deploy-bridge.js'
  ]);

  const state = { loading: null };
  const clean = (value) => String(value ?? '').trim();

  function loadScript(src) {
    if (!global.document?.head) return Promise.reject(new Error('DOCUMENT_UNAVAILABLE'));
    return new Promise((resolve, reject) => {
      const existing = global.document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === '1' || existing.readyState === 'complete') return resolve(existing);
        existing.addEventListener('load', () => resolve(existing), { once: true });
        existing.addEventListener('error', () => reject(new Error(`SCRIPT_LOAD_FAILED:${src}`)), { once: true });
        return;
      }
      const script = global.document.createElement('script');
      script.src = src;
      script.async = false;
      script.addEventListener('load', () => {
        script.dataset.loaded = '1';
        resolve(script);
      }, { once: true });
      script.addEventListener('error', () => reject(new Error(`SCRIPT_LOAD_FAILED:${src}`)), { once: true });
      global.document.head.appendChild(script);
    });
  }

  function catalogsReady() {
    return Boolean(
      global.CombatSkillSchema &&
      global.LuminousKoboldUnitCatalog &&
      global.LuminousGoblinTier1SkillCatalog &&
      global.LuminousGoblinUnitCatalog &&
      global.LuminousWolfUnitCatalog &&
      global.LuminousUnitCombatInstantiator
    );
  }

  async function ensureCatalogs() {
    if (catalogsReady()) return true;
    if (state.loading) return state.loading;
    state.loading = (async () => {
      for (const src of CATALOG_SCRIPTS) await loadScript(src);
      if (!catalogsReady()) throw new Error('CATALOGS_NOT_READY');
      return true;
    })().finally(() => { state.loading = null; });
    return state.loading;
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

  async function materialize(db, { force = false } = {}) {
    if (!db?.ref) throw new Error('FIREBASE_DB_REQUIRED');
    const { units, skills } = await buildPayloads();
    const [existingUnits, existingSkills] = await Promise.all([
      readObject(db, ROOTS.units),
      readObject(db, ROOTS.skills)
    ]);
    const updates = {};
    let unitsWritten = 0;
    let skillsWritten = 0;
    for (const [id, value] of Object.entries(units)) {
      if (!force && existingUnits[id]) continue;
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
      skillsWritten,
      force,
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
    version: '1.1.0',
    ROOTS,
    CATALOG_SCRIPTS,
    ensureCatalogs,
    buildPayloads,
    diagnostics,
    ensureMissing,
    syncAll,
    materialize
  });
})(window);