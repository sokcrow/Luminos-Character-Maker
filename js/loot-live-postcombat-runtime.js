(function (global) {
  "use strict";

  if (global.LuminousLootLivePostCombatRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousLootLivePostCombatRuntime;
    return;
  }

  const VERSION = 1;
  const ROOTS = Object.freeze({
    combatState: "campaña/combate/estado",
    combatants: "campaña/combate/combatants",
    defeated: "campaña/combate/defeated",
    units: "campaña/base_datos_unidades",
    players: "campaña/jugadores",
    lootInstances: "campaña/loot_instances",
    postCombat: "campaña/loot_postcombat",
    encounterLoot: "campaña/loot_encounters",
    requests: "campaña/loot_requests",
    claims: "campaña/loot_claims",
  });

  const BROWSER_DEPENDENCIES = Object.freeze([
    "js/content-registry.js",
    "js/item-runtime-engine.js",
    "js/item-inventory-runtime.js",
    "js/item-catalog-hp-healing.js",
    "js/item-catalog-culinary-staples.js",
    "js/item-quality-engine.js",
    "js/item-size-lineage-engine.js",
    "js/item-culinary-affinity-data.js",
    "js/item-affinity-engine.js",
    "js/item-processing-engine.js",
    "js/item-harvest-integrity-engine.js",
    "js/item-economy-standard.js",
    "js/coin-engine-core.js",
    "js/creature-type-catalog.js",
    "js/loot-social-profile-contract.js",
    "js/loot-encounter-context.js",
    "js/corpse-harvest-runtime.js",
    "js/loot-ammo-reconciliation.js",
    "js/item-catalog-meat.js",
    "js/item-catalog-hide-pelt.js",
    "js/item-catalog-hard-parts.js",
    "js/item-catalog-organ-gland.js",
    "js/item-catalog-blood-ichor.js",
    "js/item-catalog-venom-secretion.js",
    "js/item-catalog-ooze-gel.js",
    "js/item-catalog-scale-shell-chitin.js",
    "js/item-catalog-feather-raw-fiber.js",
    "js/item-catalog-salvage-raw.js",
    "js/loot-instance-runtime.js",
    "js/loot-check-runtime.js?v=20261022-pickpocket-3",
    "js/loot-knowledge-runtime.js",
    "js/loot-postcombat-runtime.js?v=20261022-pickpocket-3",
    "js/loot-recovery-delivery-runtime.js",
  ]);

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  function inventory() { return global.LuminousItemInventoryRuntime || safeRequire("./item-inventory-runtime.js"); }
  function lootInstances() { return global.LuminousLootInstanceRuntime || safeRequire("./loot-instance-runtime.js"); }
  function postCombat() { return global.LuminousLootPostCombatRuntime || safeRequire("./loot-postcombat-runtime.js"); }
  function delivery() { return global.LuminousLootRecoveryDeliveryRuntime || safeRequire("./loot-recovery-delivery-runtime.js"); }
  function knowledge() { return global.LuminousLootKnowledgeRuntime || safeRequire("./loot-knowledge-runtime.js"); }
  function checks() { return global.LuminousLootCheckRuntime || safeRequire("./loot-check-runtime.js"); }

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function clean(value) { return String(value ?? "").trim(); }
  function normalizeId(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function safeKey(value, fallback = "entry") {
    return clean(value).replace(/[.#$\[\]\/]/g, "_") || fallback;
  }
  function int(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }
  function dbFrom(options = {}) {
    if (options.db?.ref) return options.db;
    const adapter = global.LuminousCombatLiveAdapter073?.state?.db;
    if (adapter?.ref) return adapter;
    try { return global.firebase?.database?.() || null; } catch (_) { return null; }
  }
  function snapshotValue(snapshot) {
    return typeof snapshot?.val === "function" ? snapshot.val() : snapshot?.value ?? null;
  }
  async function onceValue(db, path) {
    const snap = await db.ref(path).once("value");
    return clone(snapshotValue(snap));
  }

  let dependencyPromise = null;
  function browserScriptLoaded(src) {
    const wanted = clean(src).split("?")[0];
    return [...(global.document?.scripts || [])].some((script) => clean(script.getAttribute?.("src") || script.src).split("?")[0].endsWith(wanted));
  }
  function loadBrowserScript(src) {
    if (!global.document?.head) return Promise.reject(new Error("DOCUMENT_HEAD_REQUIRED"));
    if (browserScriptLoaded(src)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = global.document.createElement("script");
      script.src = src;
      script.async = false;
      script.dataset.lootLiveDependency = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`LOOT_LIVE_DEPENDENCY_FAILED:${src}`));
      global.document.head.appendChild(script);
    });
  }
  async function ensureDependencies() {
    if (typeof document === "undefined") {
      BROWSER_DEPENDENCIES.forEach((src) => safeRequire("./" + src.replace(/^js\//, "")));
      return true;
    }
    if (dependencyPromise) return dependencyPromise;
    dependencyPromise = (async () => {
      // async=false preserves execution order while downloads overlap.
      await Promise.all(BROWSER_DEPENDENCIES.map(loadBrowserScript));
      if (!inventory()?.createItemInstance || !lootInstances()?.generateLootInstance || !postCombat()?.applyResolvedAction || !delivery()?.materializeRecovery || !knowledge()?.mergeFacts) {
        throw new Error("LOOT_LIVE_RUNTIME_DEPENDENCIES_INCOMPLETE");
      }
      return true;
    })();
    return dependencyPromise;
  }

  function generatedEncounterId(db, options = {}) {
    if (typeof options.idFactory === "function") return clean(options.idFactory());
    try {
      const pushKey = db?.ref?.("campaña/combate/encounters")?.push?.()?.key;
      if (pushKey) return `encounter_${safeKey(pushKey)}`;
    } catch (_) {}
    const entropy = Math.random().toString(36).slice(2, 9);
    return `encounter_${Date.now().toString(36)}_${entropy}`;
  }

  async function ensureEncounterId(options = {}) {
    const db = dbFrom(options);
    if (!db?.ref) throw new Error("LOOT_LIVE_DATABASE_REQUIRED");
    const stateRef = db.ref(ROOTS.combatState);
    const current = await onceValue(db, ROOTS.combatState) || {};
    if (clean(current.encounterId)) return clean(current.encounterId);

    const candidate = generatedEncounterId(db, options);
    if (typeof stateRef.transaction !== "function") {
      await stateRef.update({ encounterId: candidate, encounterCreatedAt: options.now ?? Date.now() });
      return candidate;
    }

    const tx = await stateRef.transaction((raw) => {
      const next = raw && typeof raw === "object" ? clone(raw) : {};
      if (clean(next.encounterId)) return next;
      next.encounterId = candidate;
      next.encounterCreatedAt = options.now ?? Date.now();
      return next;
    });
    const finalState = snapshotValue(tx?.snapshot) || await onceValue(db, ROOTS.combatState) || {};
    return clean(finalState.encounterId || candidate);
  }

  function sideOf(unit = {}) {
    return normalizeId(unit.faction ?? unit.faccion ?? unit.side ?? unit.category ?? unit.actorCategory ?? unit.unitType);
  }
  function isEnemy(unit = {}) {
    const side = sideOf(unit);
    return side === "enemy" || side === "enemigo" || side === "hostile" || side.includes("enemy");
  }
  function isDefeated(unit = {}) {
    const state = normalizeId(unit.resolutionState ?? unit.deploymentState ?? unit.deployment);
    return unit.defeated === true || unit.dead === true || unit.isDead === true || state === "defeated" || (unit.hp != null && Number(unit.hp)<=0 && unit.isBackup!==true && !['backup','reserve','reserves'].includes(state));
  }
  function isLootEligible(unit = {}) {
    return isEnemy(unit) && isDefeated(unit) && unit.lootEligible !== false && unit.escaped !== true && normalizeId(unit.resolutionState) !== "escaped";
  }
  function eligibleCombatants(combatants = {}) {
    return Object.entries(combatants || {})
      .filter(([, unit]) => unit && typeof unit === "object" && isLootEligible(unit))
      .map(([key, unit]) => ({ key, unit: clone(unit) }));
  }
  function canonicalUnitId(unit = {}) {
    return normalizeId(unit.libraryUnitId ?? unit.actorRef?.id ?? unit.unitRef?.id ?? unit.canonicalUnitId ?? unit.definitionId ?? unit.id);
  }
  function combatantId(key, unit = {}) {
    return clean(unit.combatId ?? unit.instanceId ?? unit.runtimeId ?? unit.id ?? key);
  }
  function corpseIdFor(key, unit = {}) {
    return clean(unit.corpseId) || `corpse:${combatantId(key, unit)}`;
  }
  function mergeUnitTruth(base = {}, combatant = {}) {
    return {
      ...clone(base || {}),
      ...clone(combatant || {}),
      id: canonicalUnitId(combatant) || normalizeId(base?.id),
      bodyProfile: clone(base?.bodyProfile || combatant?.bodyProfile || null),
      lootProfile: clone(base?.lootProfile || combatant?.lootProfile || null),
      wealthProfile: clone(base?.wealthProfile || combatant?.wealthProfile || null),
      roleProfile: clone(base?.roleProfile || combatant?.roleProfile || null),
      mechanics: { ...clone(base?.mechanics || {}), ...clone(combatant?.mechanics || {}) },
    };
  }

  // Keep the defeated combatant's own sprite rather than an unrelated NPC
  // illustration. Saved with the corpse index so roster changes cannot swap it.
  function defeatedSprite(unit = {}, base = {}) {
    const candidates = [unit,base];
    for (const source of candidates) {
      const sprite = [
        source?.combatSprite, source?.sprite_combate, source?.combat_sprite,
        source?.visual?.spriteUrl, source?.combatVisual?.spriteUrl,
        source?.tokenImage, source?.sprite, source?.idle_sprite,
        source?.img, source?.image, source?.icono,
      ].find(value => typeof value === "string" && value.trim());
      if (sprite) return sprite.trim();
    }
    return "";
  }

  function encounterContextFromState(combatState = {}, options = {}) {
    const loot = combatState.lootContext || combatState.loot || {};
    const zone = clone(options.zone || loot.zone || combatState.encounterZone || combatState.zone || null);
    const events = clone(options.events || loot.events || combatState.encounterEvents || combatState.events || []);
    return { zone, events: Array.isArray(events) ? events : [] };
  }

  async function finalizeEncounterLoot(options = {}) {
    await ensureDependencies();
    const db = dbFrom(options);
    if (!db?.ref) throw new Error("LOOT_LIVE_DATABASE_REQUIRED");
    const encounterId = clean(options.encounterId) || await ensureEncounterId(options);
    const [combatState, active, defeated, prior] = await Promise.all([
      options.combatState || onceValue(db, ROOTS.combatState),
      options.combatants || onceValue(db, ROOTS.combatants),
      onceValue(db, ROOTS.defeated),
      onceValue(db, `${ROOTS.encounterLoot}/${safeKey(encounterId)}`),
    ]);
    const combatants = {...(active || {}), ...(defeated || {})};
    if (prior?.meta?.closedByDm === true) return deepFreeze({ encounterId, finalized: [], skipped: [], closed: true });
    const eligible = eligibleCombatants(combatants);
    // Fetch only the defeated definitions, never the entire unit library.
    const authoredUnits = options.units || Object.fromEntries(await Promise.all(
      [...new Set(eligible.map(entry=>canonicalUnitId(entry.unit)))].filter(Boolean)
        .map(async id=>[id,await onceValue(db, `${ROOTS.units}/${safeKey(id)}`)])));
    const context = encounterContextFromState(combatState || {}, options);
    const finalized = [];
    const skipped = [];

    async function finalizeCorpse(entry) {
      const sourceUnitId = canonicalUnitId(entry.unit);
      const unitInstanceId = combatantId(entry.key, entry.unit);
      const corpseId = corpseIdFor(entry.key, entry.unit);
      const corpseKey = safeKey(unitInstanceId, entry.key);
      const indexPath = `${ROOTS.encounterLoot}/${safeKey(encounterId)}/corpses/${corpseKey}`;
      const existingIndex = prior?.corpses?.[corpseKey];
      if (existingIndex?.lootInstanceId) {
        return { ...existingIndex, reused: true };
      }

      const baseTruth = authoredUnits[sourceUnitId] || {};
      const unitTruth = mergeUnitTruth(baseTruth, entry.unit);
      if (!unitTruth.lootProfile || !unitTruth.bodyProfile) {
        skipped.push({ unitInstanceId, sourceUnitId, reason: "unit_loot_profile_missing" });
        return null;
      }

      const generated = lootInstances().generateLootInstance(unitTruth, {
        encounterId,
        unitId: sourceUnitId,
        unitInstanceId,
        corpseId,
        zone: context.zone || undefined,
        events: context.events,
        carriedCandidates: options.carriedCandidates,
        catalog: options.catalog,
        equipmentInstances: options.equipmentInstancesByUnit?.[unitInstanceId],
        damageRecord: entry.unit.damageRecord || entry.unit.combatDamageRecord || options.damageRecordByUnit?.[unitInstanceId],
        now: options.now ?? Date.now(),
      });
      const locked = lootInstances().lockLootInstance(generated, {
        unit: unitTruth,
        reason: "encounter_victory_auto_finalize",
        now: options.now ?? Date.now(),
      });
      const interaction = postCombat().createInteractionState(locked, { now: options.now ?? Date.now() });
      const index = {
        encounterId,
        lootInstanceId: locked.lootInstanceId,
        corpseId,
        sourceUnitId,
        sourceUnitInstanceId: unitInstanceId,
        name: clean(entry.unit.name || entry.unit.characterName || sourceUnitId),
        spriteUrl: defeatedSprite(entry.unit, baseTruth),
        finalizedAt: options.now ?? Date.now(),
      };

      // Initialize once even when two DM windows finalize together. Existing
      // attempts, depleted resources and receipts must never be overwritten.
      await Promise.all([
        transactionValue(db.ref(`${ROOTS.lootInstances}/${locked.lootInstanceId}`), raw=>raw || clone(locked)),
        transactionValue(db.ref(`${ROOTS.postCombat}/${locked.lootInstanceId}`), raw=>raw || clone(interaction)),
      ]);
      const saved=await transactionValue(db.ref(indexPath), raw=>raw || clone(index));
      return snapshotValue(saved.snapshot) || index;
    }
    // Bound fan-out while keeping independent corpse I/O off a serial chain.
    for(let start=0;start<eligible.length;start+=4){
      const rows=await Promise.all(eligible.slice(start,start+4).map(finalizeCorpse));
      finalized.push(...rows.filter(Boolean));
    }

    await transactionValue(db.ref(`${ROOTS.encounterLoot}/${safeKey(encounterId)}/meta`), raw => raw?.closedByDm === true ? raw : ({ ...(raw || {}),
      encounterId,
      result: normalizeId(options.result || combatState?.result || combatState?.outcome),
      finalizedAt: options.now ?? Date.now(),
      corpseCount: finalized.length,
      open: true,
      participants: clone(options.participants || {}),
    }));

    return deepFreeze({ encounterId, finalized: deepFreeze(finalized), skipped: deepFreeze(skipped) });
  }

  async function encounterCorpses(encounterId, options = {}) {
    const db = dbFrom(options);
    if (!db?.ref || !clean(encounterId)) return [];
    const rows = await onceValue(db, `${ROOTS.encounterLoot}/${safeKey(encounterId)}/corpses`) || {};
    return Object.values(rows).filter(Boolean).map(clone);
  }

  function transactionSupported(ref) { return ref && typeof ref.transaction === "function"; }

  async function transactionValue(ref, updater) {
    if (!transactionSupported(ref)) {
      const snap = await ref.once("value");
      const current = clone(snapshotValue(snap));
      const next = updater(current);
      if (next === undefined) return { committed: false, snapshot: snap };
      await ref.set(clone(next));
      return { committed: true, snapshot: { val: () => clone(next) } };
    }
    let failure = null;
    const response = await ref.transaction((raw) => {
      // The legacy SDK does not reject its promise when an updater throws on
      // a server retry. Abort cleanly and propagate the error after completion.
      try {
        failure = null;
        const result = updater(clone(raw));
        return result === undefined ? undefined : clone(result);
      } catch (error) { failure = error;return undefined; }
    }, undefined, false);
    if (failure) throw failure;
    return response;
  }

  function unitOptions(unitTruth = {}, interaction = {}) {
    return {
      sourceUnitId: interaction.sourceUnitId,
      sourceUnitName: clean(unitTruth.name || unitTruth.characterName || interaction.sourceUnitId),
      species: normalizeId(unitTruth.species),
      originCreatureType: normalizeId(unitTruth.creatureType || unitTruth.metadata?.creatureType),
      creatureSize: normalizeId(unitTruth.bodyProfile?.sizeClass || unitTruth.size || "medium"),
      corpseId: interaction.corpseId,
    };
  }

  async function reserveAction(options = {}) {
    await ensureDependencies();
    const db = dbFrom(options);
    const lootInstanceId = clean(options.lootInstanceId);
    const actor = clone(options.actor || {});
    const actionId = normalizeId(options.actionId);
    if (!db?.ref || !lootInstanceId || !actionId) throw new Error("LOOT_LIVE_ACTION_INPUT_REQUIRED");

    const locked = clone(options.lootInstance || await onceValue(db, `${ROOTS.lootInstances}/${lootInstanceId}`));
    if (!locked?.locked) throw new Error("LOOT_LIVE_LOCKED_INSTANCE_REQUIRED");
    let unitTruth = clone(options.unitTruth || null);
    if (!unitTruth && ["autopsy", "examine"].includes(actionId)) {
      unitTruth = await onceValue(db, `${ROOTS.units}/${safeKey(locked.sourceUnitId)}`);
    }
    unitTruth = mergeUnitTruth(unitTruth || {}, {
      id: locked.sourceUnitId,
      bodyProfile: unitTruth?.bodyProfile,
      lootProfile: unitTruth?.lootProfile,
    });

    const actorIdentityOptions = {
      ...options,
      actorId: clean(options.actorId || options.playerId),
    };
    const actorId = postCombat().actorIdOf(actor, actorIdentityOptions);
    if (!actorId) throw new Error("POST_COMBAT_ACTOR_ID_REQUIRED");
    const definition = postCombat().checkDefinition(actor, actionId, {
      ...actorIdentityOptions,
      corpseId: locked.corpseId,
    });
    const checkResult = options.checkResult || checks().rollCheck(definition, options);
    const stateRef = db.ref(`${ROOTS.postCombat}/${lootInstanceId}`);
    let committedResult = null;
    let committedMaterialized = null;
    let committedKnowledgeFacts = [];

    const tx = await transactionValue(stateRef, (rawState) => {
      const current = rawState || postCombat().createInteractionState(locked, { now: options.now ?? Date.now() });
      let outcome;
      try {
        outcome = postCombat().applyResolvedAction(current, actor, actionId, checkResult, {
          ...actorIdentityOptions,
          lootInstance: locked,
          unitTruth,
        });
      } catch (error) {
        if (/POST_COMBAT_ATTEMPT_ALREADY_USED/.test(String(error?.message || error))) return undefined;
        throw error;
      }

      const materialized = delivery().materializeRecovery(outcome.result, {
        ...unitOptions(unitTruth, current),
        actionId,
      });
      if (materialized.unresolved?.length) {
        const error = new Error(materialized.unresolved[0]?.reason || "LOOT_LIVE_MATERIALIZATION_FAILED");
        error.code = "LOOT_LIVE_MATERIALIZATION_FAILED";
        throw error;
      }

      let next = outcome.state;
      const hasPayload = (materialized.items || []).length > 0 || int(materialized.currency?.amount, 0) > 0;
      if (hasPayload) {
        next = delivery().addPendingDelivery(next, outcome.result, materialized, "awaiting_player_delivery").state;
      }
      committedResult = clone(outcome.result);
      committedMaterialized = clone(materialized);
      committedKnowledgeFacts = clone(outcome.result.knowledge?.facts || []);
      return next;
    });

    if (!tx?.committed) {
      return deepFreeze({
        committed: false,
        reason: "post_combat_attempt_already_used_or_contested",
        check: clone(checkResult),
      });
    }

    const finalState = clone(snapshotValue(tx.snapshot));
    const pending = [...(finalState?.pendingDeliveries || [])]
      .reverse()
      .find((entry) => entry.actorId === actorId && normalizeId(entry.actionId) === actionId) || null;

    return deepFreeze({
      committed: true,
      state: finalState,
      result: committedResult,
      materialized: committedMaterialized,
      pending,
      knowledgeFacts: committedKnowledgeFacts,
      check: clone(checkResult),
    });
  }

  function playerBalance(player = {}) {
    const finance = Number(player.finance?.currentBalance);
    if (Number.isFinite(finance)) return Math.trunc(finance);
    return int(player.ahn, 0);
  }

  function transactionRecord(amount, concept, now) {
    return {
      monto: int(amount, 0),
      concepto: clean(concept),
      timestamp: now,
      fecha: now,
      unread: true,
    };
  }

  function mergeCompendiumFacts(raw, playerId, unitId, facts, options = {}) {
    const base = raw && typeof raw === "object" ? clone(raw) : knowledge().createCompendium(playerId, { now: options.now });
    for (const entry of Object.values(base.units || {})) {
      entry.facts = Object.fromEntries(Object.values(entry.facts || {}).map(fact => [fact.id, fact]));
    }
    const saved = clone(knowledge().mergeFacts(base, normalizeId(unitId), facts, {
      visibility: options.visibility || "private", now: options.now ?? Date.now(),
    }));
    for (const entry of Object.values(saved.units || {})) {
      entry.facts = Object.fromEntries(Object.values(entry.facts || {}).map(fact =>
        [encodeURIComponent(fact.id).split(".").join("%2E"), fact]));
    }
    return saved;
  }

  function applyPendingToPlayer(player = {}, pending = {}, options = {}) {
    const playerId = clean(options.playerId || player.id || player.playerId);
    const deliveryId = clean(pending.id);
    if (!playerId || !deliveryId) throw new Error("LOOT_PENDING_PLAYER_INPUT_REQUIRED");

    const receipts = player.lootRecoveryReceipts || {};
    if (receipts[deliveryId]) {
      return { player: clone(player), receipt: clone(receipts[deliveryId]), duplicate: true };
    }

    const inserted = delivery().insertBatchAtomic(player, pending.items || [], {
      ownerId: playerId,
      preferredContainer: options.preferredContainer || "active",
      fallbackContainer: options.fallbackContainer || "stash",
    });
    if (!inserted.inserted) {
      return { player: clone(player), receipt: null, duplicate: false, blocked: true, reason: inserted.reason || "inventory_capacity_exceeded" };
    }

    const next = clone(inserted.recipient);
    const amount = Math.max(0, int(pending.currency?.amount, 0));
    const now = options.now ?? Date.now();
    if (amount > 0) {
      const balance = playerBalance(next) + amount;
      next.ahn = balance;
      next.finance = next.finance && typeof next.finance === "object" ? next.finance : {};
      next.finance.currentBalance = balance;
      next.finance.transactionHistory = next.finance.transactionHistory && typeof next.finance.transactionHistory === "object" ? next.finance.transactionHistory : {};
      next.transacciones = next.transacciones && typeof next.transacciones === "object" ? next.transacciones : {};
      const txKey = `loot_${safeKey(deliveryId)}`;
      const tx = transactionRecord(amount, `Loot recuperado · ${pending.actionId || "post-combat"}`, now);
      next.finance.transactionHistory[txKey] = tx;
      next.transacciones[txKey] = clone(tx);
    }

    next.lootRecoveryReceipts = next.lootRecoveryReceipts && typeof next.lootRecoveryReceipts === "object" ? next.lootRecoveryReceipts : {};
    const receipt = {
      deliveryId,
      lootInstanceId: options.lootInstanceId || null,
      actionId: pending.actionId || null,
      amountAhn: amount,
      itemInstanceIds: (pending.items || []).map((item) => item.instanceId).filter(Boolean),
      deliveredAt: now,
    };
    next.lootRecoveryReceipts[deliveryId] = receipt;
    return { player: next, receipt, duplicate: false, blocked: false };
  }

  async function acknowledgePending(lootInstanceId, deliveryId, options = {}) {
    const db = dbFrom(options);
    const ref = db.ref(`${ROOTS.postCombat}/${lootInstanceId}`);
    const tx = await transactionValue(ref, (raw) => {
      if (!raw || !Array.isArray(raw.pendingDeliveries)) return raw;
      const next = clone(raw);
      const index = next.pendingDeliveries.findIndex((entry) => clean(entry.id) === clean(deliveryId));
      if (index < 0) return next;
      const [claimed] = next.pendingDeliveries.splice(index, 1);
      next.history = Array.isArray(next.history) ? next.history : [];
      next.history.push({
        type: "delivery_claimed",
        deliveryId: clean(deliveryId),
        actorId: claimed.actorId || null,
        actionId: claimed.actionId || null,
        at: options.now ?? Date.now(),
      });
      next.revision = int(next.revision, 0) + 1;
      return next;
    });
    return Boolean(tx?.committed);
  }

  async function deliverPending(options = {}) {
    await ensureDependencies();
    const db = dbFrom(options);
    const lootInstanceId = clean(options.lootInstanceId);
    const deliveryId = clean(options.deliveryId);
    const playerId = clean(options.playerId);
    if (!db?.ref || !lootInstanceId || !deliveryId || !playerId) throw new Error("LOOT_PENDING_DELIVERY_INPUT_REQUIRED");

    const state = options.interactionState || await onceValue(db, `${ROOTS.postCombat}/${lootInstanceId}`) || {};
    const pending = (state.pendingDeliveries || []).find((entry) => clean(entry.id) === deliveryId);
    if (!pending) {
      const player = await onceValue(db, `${ROOTS.players}/${playerId}`) || {};
      const prior = player.lootRecoveryReceipts?.[deliveryId];
      if (prior) return deepFreeze({ delivered: true, duplicate: true, receipt: clone(prior) });
      return deepFreeze({ delivered: false, reason: "pending_delivery_not_found" });
    }
    if (clean(pending.actorId) !== playerId) throw new Error("LOOT_DELIVERY_OWNER_REQUIRED");

    const playerRef = db.ref(`${ROOTS.players}/${playerId}`);
    let result = null;
    const tx = await transactionValue(playerRef, (rawPlayer) => {
      const current = rawPlayer && typeof rawPlayer === "object" ? rawPlayer : { id: playerId };
      result = applyPendingToPlayer(current, pending, { ...options, playerId, lootInstanceId });
      if (result.blocked) return undefined;
      return result.player;
    });

    if (!tx?.committed) {
      return deepFreeze({ delivered: false, reason: result?.reason || "inventory_capacity_exceeded", pending: clone(pending) });
    }

    const finalPlayer = clone(snapshotValue(tx.snapshot));
    const receipt = finalPlayer?.lootRecoveryReceipts?.[deliveryId] || result?.receipt || null;
    await acknowledgePending(lootInstanceId, deliveryId, options);
    return deepFreeze({ delivered: true, duplicate: result?.duplicate === true, receipt: clone(receipt), player: finalPlayer });
  }

  async function persistKnowledgeFacts(options = {}) {
    const facts = clone(options.facts || []);
    if (!facts.length) return deepFreeze({ saved: false, reason: "no_facts" });
    const db = dbFrom(options);
    const playerId = clean(options.playerId);
    const unitId = normalizeId(options.unitId);
    if (!db?.ref || !playerId || !unitId) throw new Error("LOOT_KNOWLEDGE_PERSIST_INPUT_REQUIRED");
    const ref = db.ref(`${ROOTS.players}/${playerId}/compendium`);
    let saved = null;
    const tx = await transactionValue(ref, (raw) => {
      const base = raw && typeof raw === "object" ? raw : knowledge().createCompendium(playerId, { now: options.now });
      for (const entry of Object.values(base.units || {})) entry.facts = Object.fromEntries(Object.values(entry.facts || {}).map(fact => [fact.id, fact]));
      saved = knowledge().mergeFacts(base, unitId, facts, {
        visibility: options.visibility || "private",
        now: options.now ?? Date.now(),
      });
      // Fact IDs are semantic names such as loot.known_uses; RTDB forbids dots
      // in object keys. Keep the ID in the fact and encode only its storage key.
      saved = clone(saved);
      for (const entry of Object.values(saved.units || {})) entry.facts = Object.fromEntries(Object.values(entry.facts || {}).map(fact => [encodeURIComponent(fact.id).replace(/\./g,'%2E'), fact]));
      return saved;
    });
    return deepFreeze({ saved: Boolean(tx?.committed), compendium: clone(snapshotValue(tx?.snapshot) || saved) });
  }

  async function executeAction(options = {}) {
    const reserved = await reserveAction(options);
    if (!reserved.committed) return reserved;

    const locked = options.lootInstance || await onceValue(dbFrom(options), `${ROOTS.lootInstances}/${clean(options.lootInstanceId)}`);
    const playerId = clean(options.playerId || postCombat().actorIdOf(options.actor || {}, options));
    const materialFacts = reserved.materialized?.items?.length
      ? knowledge().materializedLootFacts(reserved.materialized.items, {
          discoveredBy: playerId,
          discoveredAt: options.now ?? Date.now(),
          visibility: "private",
        })
      : [];
    const facts = [...(reserved.knowledgeFacts || []), ...materialFacts];
    let compendium = null;
    if (facts.length) {
      compendium = await persistKnowledgeFacts({
        ...options,
        playerId,
        unitId: locked.sourceUnitId,
        facts,
      });
    }

    let deliveryResult = null;
    if (reserved.pending?.id) {
      deliveryResult = await deliverPending({
        ...options,
        lootInstanceId: clean(options.lootInstanceId),
        deliveryId: reserved.pending.id,
        interactionState: reserved.state,
        playerId,
      });
    }

    return deepFreeze({
      ...clone(reserved),
      delivery: deliveryResult,
      compendium,
    });
  }

  function availableActions(state = {}, actor = {}, options = {}) {
    const actorId = postCombat()?.actorIdOf?.(actor, {
      ...options,
      actorId: clean(options.actorId || options.playerId),
    }) || clean(options.playerId);
    const actions = [];
    const searchAvailable = (state.carried || []).some((entry) => int(entry.remaining, 0) > 0) || int(state.currency?.remaining, 0) > 0;
    if (searchAvailable && !postCombat().hasAttempted(state, actorId, "search", {})) actions.push("search");
    if (searchAvailable && !postCombat().hasAttempted(state, actorId, "pickpocket", {})) actions.push("pickpocket");
    for (const id of ["harvest", "extract", "salvage"]) {
      if (postCombat().eligibleResources(state, id).length && !postCombat().hasAttempted(state, actorId, id, {})) actions.push(id);
    }
    if (!postCombat().hasAttempted(state, actorId, "examine", {})) actions.push("examine");
    if (!postCombat().hasAttempted(state, actorId, "autopsy", {})) actions.push("autopsy");
    return deepFreeze(actions);
  }

  const CORPSE_LEASE_MS = 90000;
  async function claimCorpse(options = {}) {
    const db = dbFrom(options), lootInstanceId = clean(options.lootInstanceId);
    const user = global.firebase?.auth?.().currentUser;
    const playerId = clean(options.playerId);
    if (!db?.ref || !lootInstanceId || !playerId || !user?.uid) throw Error("LOOT_CLAIM_AUTH_REQUIRED");
    if (options.skipAccess !== true) await checkPlayerLootAccess({db,lootInstanceId,playerId});
    const ref = db.ref(`${ROOTS.claims}/${lootInstanceId}`);
    // Warm RTDB's local transaction cache; an uncached null would otherwise
    // be mistaken for an unoccupied corpse on first invocation.
    await ref.once("value");
    const tx = await ref.transaction(raw => {
      const now = Date.now();
      if (raw?.uid && Number(raw.expiresAt) > now && (raw.uid !== user.uid || clean(raw.playerId) !== playerId)) return;
      return {uid:user.uid,playerId,expiresAt:now + CORPSE_LEASE_MS,updatedAt:now};
    },undefined,false);
    const claim = tx.snapshot?.val?.() || null;
    return {acquired:tx.committed===true && claim?.uid===user.uid && claim?.playerId===playerId,
      claim};
  }
  async function releaseCorpse(options = {}) {
    const db = dbFrom(options), lootInstanceId = clean(options.lootInstanceId);
    const uid = clean(global.firebase?.auth?.().currentUser?.uid);
    const playerId = clean(options.playerId);
    if (!db?.ref || !uid || !playerId || !lootInstanceId) return false;
    const ref = db.ref(`${ROOTS.claims}/${lootInstanceId}`);
    await ref.once("value");
    const tx = await ref.transaction(row => row?.uid===uid && row?.playerId===playerId ? null : undefined,undefined,false);
    return tx.committed === true;
  }

  async function checkPlayerLootAccess(options = {}) {
    const db = dbFrom(options), playerId = clean(options.playerId);
    const lootId = clean(options.lootInstanceId);
    const user = global.firebase?.auth?.().currentUser;
    if (!db?.ref || !user || !playerId) throw Error('Inicia sesión con el personaje que participó en el combate.');
    const [player,loot] = await Promise.all([
      onceValue(db, `${ROOTS.players}/${playerId}`),
      lootId ? onceValue(db, `${ROOTS.lootInstances}/${lootId}`) : Promise.resolve(null),
    ]);
    if (![player?.uid,player?.vinculado_a,player?.vinculo_jugador].some(uid=>clean(uid)===user.uid))
      throw Error('Tu cuenta no está vinculada al personaje seleccionado. El DM debe revisar la vinculación del personaje.');
    if (!loot?.locked || !loot?.encounterId)
      throw Error('Este enemigo no tiene un botín confirmado. El DM debe revisar el registro de la victoria.');
    const meta = await onceValue(db,`${ROOTS.encounterLoot}/${safeKey(loot.encounterId)}/meta`);
    if (meta?.participants?.[playerId] !== true)
      throw Error('Este personaje no aparece entre los participantes del encuentro que generó el botín.');
    if (meta?.open !== true || meta?.result !== 'victory')
      throw Error('El botín de este encuentro no está abierto como victoria.');
    return true;
  }

  // Players submit intentions; only the DM mutates shared corpse resources.
  // A stable request key and the existing attempt/delivery receipts make retries
  // safe across reloads, competing players and multiple open DM viewers.
  async function requestAction(options = {}) {
    const db = dbFrom(options), user = global.firebase?.auth?.().currentUser;
    const playerId = clean(options.playerId), lootInstanceId = clean(options.lootInstanceId);
    if (!db?.ref || !user || !playerId || !lootInstanceId) throw Error('Entra con tu personaje para recuperar el botín.');
    const actionId = normalizeId(options.actionId || 'claim');
    const targetResourceId = clean(options.targetResourceId), deliveryId = clean(options.deliveryId);
    let key = [lootInstanceId, actionId, targetResourceId, deliveryId].map(v => encodeURIComponent(v).replace(/\./g, '%2E')).join('|');
    const [occupation, existingInitial] = await Promise.all([
      onceValue(db,`${ROOTS.claims}/${lootInstanceId}`),
      onceValue(db, `${ROOTS.requests}/${playerId}/${key}`),
    ]);
    if (!occupation || occupation.uid !== user.uid || occupation.playerId !== playerId || Number(occupation.expiresAt) <= Date.now()) {
      throw Error("Selecciona un cadáver libre antes de empezar a saquearlo.");
    }
    let existing = existingInitial;
    if (existing?.status === 'rejected' || (actionId === 'claim' && existing?.status === 'resolved' && !existing.response?.delivered)) {
      key += '|'+db.ref(`${ROOTS.requests}/${playerId}`).push().key;existing=null;
    }
    const ref = db.ref(`${ROOTS.requests}/${playerId}/${key}`);
    if (!existing) {
      try {
        await ref.set({uid:user.uid,playerId,lootInstanceId,actionId,targetResourceId,deliveryId,
          checkHeads: int(options.checkResult?.heads, 0),status:'pending',createdAt:Date.now()});
      } catch(error) {
        if (/permission[_-]denied/i.test(String(error?.code || error?.message || ''))) {
          throw Error('Firebase rechazó la solicitud de recuperación aunque el personaje participa en la victoria. El DM debe revisar las condiciones de acceso de Loot en esta campaña.');
        }
        throw error;
      }
    }
    return new Promise((resolve,reject) => {
      const finish = (error,value) => { global.clearTimeout(timer);ref.off('value',listener);error?reject(error):resolve(value); };
      const listener = snapshot => {
        const row = snapshot.val();
        if (row?.status === 'resolved') finish(null,row.response);
        if (row?.status === 'rejected') finish(Error(row.message || 'No se pudo recuperar el botín.'));
      };
      const timer = global.setTimeout(() => finish(Error('La recuperación sigue pendiente. Mantén abierta la sesión del DM y vuelve a intentarlo.')),30000);
      ref.on('value',listener,error=>finish(error));
    });
  }

  const authorities = new Map();
  async function resolveRequest(db, playerId, row) {
    await ensureDependencies();
    const [actor,locked,occupation] = await Promise.all([onceValue(db,`${ROOTS.players}/${playerId}`),onceValue(db,`${ROOTS.lootInstances}/${row.lootInstanceId}`),onceValue(db,`${ROOTS.claims}/${row.lootInstanceId}`)]);
    const owner = actor?.uid || actor?.vinculado_a || actor?.vinculo_jugador;
    const meta = locked && await onceValue(db,`${ROOTS.encounterLoot}/${safeKey(locked.encounterId)}/meta`);
    if (!owner || owner !== row.uid || row.playerId !== playerId || !locked?.locked || meta?.participants?.[playerId] !== true || meta.open === false || meta.result !== 'victory') throw Error('Tu personaje no participa en este botín.');
    if (!occupation || occupation.uid !== row.uid || occupation.playerId !== playerId || Number(occupation.expiresAt) <= Date.now()) {
      throw Error("Este cadáver está ocupado por otro personaje o la reserva de saqueo expiró.");
    }
    const options = {db,playerId,actor:{...actor,id:playerId},lootInstance:locked,lootInstanceId:row.lootInstanceId,targetResourceId:row.targetResourceId||undefined};
    if (row.actionId === 'claim') return deliverPending({...options,deliveryId:row.deliveryId});
    if (!['search','pickpocket','harvest','extract','salvage','examine','autopsy'].includes(row.actionId)) throw Error('Esta acción de recuperación no está disponible.');
    const definition = postCombat().checkDefinition(options.actor,row.actionId,options);
    const heads = Number(row.checkHeads);
    if (!Number.isInteger(heads) || heads < 0 || heads > definition.coinCount) throw Error('La tirada de recuperación no es válida.');
    const checkResult = checks().resultFromRoll(definition,{heads,coinCount:definition.coinCount,total:definition.base+heads*definition.headBonus});
    const result = await executeAction({...options,actionId:row.actionId,checkResult});
    return {committed:result.committed,check:result.check,materialized:result.materialized||null,
      delivery:result.delivery?{delivered:result.delivery.delivered,duplicate:result.delivery.duplicate===true}:null};
  }

  async function installAuthority(options = {}) {
    const db = dbFrom(options), uid = clean(options.uid || global.firebase?.auth?.().currentUser?.uid);
    if (!db?.ref || !uid) return false;
    const dm = await onceValue(db,'campaña/config/dm_uid');
    if (uid !== dm && uid !== 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1') return false;
    if (authorities.has(db)) return true;
    const ref = db.ref(ROOTS.requests), worker = {chains:new Map(),queued:new Set(),rows:{},timer:null,stopped:false};
    const process = async (playerId,key) => {
      const request = db.ref(`${ROOTS.requests}/${playerId}/${key}`),token = `${uid}:${Math.random()}`;
      // Keep a cached value while transacting: an uncached null would abort.
      let hold;await new Promise((resolve,reject)=>{hold=()=>resolve();request.on('value',hold,reject);});
      try {
        const claim = await request.transaction(row => {
          if (!row || (row.status !== 'pending' && !(row.status === 'processing' && Date.now()-Number(row.claimedAt)>60000))) return;
          return {...row,status:'processing',claimToken:token,claimedAt:Date.now()};
        },undefined,false);
        if (!claim.committed) return;
        let outcome;
        try { outcome={status:'resolved',response:JSON.parse(JSON.stringify(await resolveRequest(db,playerId,claim.snapshot.val())))}; }
        catch (error) { console.error('[Loot recovery]',error);outcome={status:'rejected',message:'No se pudo completar la recuperación. Los recursos confirmados se conservan.'}; }
        await request.transaction(row => row?.claimToken===token?{...row,...outcome,resolvedAt:Date.now()}:undefined,undefined,false);
      } finally { request.off('value',hold); }
    };
    const drain = () => {
      if(worker.stopped)return;
      for (const [playerId,rows] of Object.entries(worker.rows)) for (const [key,row] of Object.entries(rows||{})) {
        const id=playerId+'/'+key;
        if(worker.queued.has(id)||!(row.status==='pending'||(row.status==='processing'&&Date.now()-Number(row.claimedAt)>60000)))continue;
        worker.queued.add(id);
        // One task per request, serial for a player's inventory. Other players
        // do not wait behind this player's animation/recovery operations.
        const prior=worker.chains.get(playerId)||Promise.resolve();
        const task=prior.then(()=>worker.stopped?undefined:process(playerId,key))
          .catch(error=>console.error('[Loot recovery]',error))
          .finally(()=>{worker.queued.delete(id);if(worker.chains.get(playerId)===task)worker.chains.delete(playerId);});
        worker.chains.set(playerId,task);
      }
    };
    const listener = snapshot => {worker.rows=snapshot.val()||{};drain();};
    worker.stop=()=>{worker.stopped=true;ref.off('value',listener);global.clearInterval(worker.timer);authorities.delete(db);};
    authorities.set(db,worker);ref.on('value',listener);worker.timer=global.setInterval(drain,15000);
    return true;
  }

  function stopAuthority(db) { authorities.get(db)?.stop(); }

  if (global.document) {
    let attempts=0;
    const boot=()=>{
      if (!global.firebase?.apps?.length || !global.firebase?.auth) return false;
      global.firebase.auth().onAuthStateChanged(user=>{
        for (const worker of authorities.values()) worker.stop();
        if (user) installAuthority({uid:user.uid}).catch(error=>console.error('[Loot recovery]',error));
      });
      return true;
    };
    if (!boot()) {const timer=global.setInterval(()=>{if(boot()||++attempts>120)global.clearInterval(timer);},250);}
    global.addEventListener?.('beforeunload',()=>{for(const worker of authorities.values())worker.stop();},{once:true});
  }

  const API = Object.freeze({
    VERSION,
    ROOTS,
    BROWSER_DEPENDENCIES,
    normalizeId,
    safeKey,
    dbFrom,
    ensureDependencies,
    generatedEncounterId,
    ensureEncounterId,
    sideOf,
    isEnemy,
    isDefeated,
    isLootEligible,
    eligibleCombatants,
    canonicalUnitId,
    combatantId,
    corpseIdFor,
    mergeUnitTruth,
    encounterContextFromState,
    finalizeEncounterLoot,
    encounterCorpses,
    transactionValue,
    reserveAction,
    playerBalance,
    transactionRecord,
    applyPendingToPlayer,
    acknowledgePending,
    deliverPending,
    persistKnowledgeFacts,
    executeAction,
    requestAction,
    checkPlayerLootAccess,
    claimCorpse,
    releaseCorpse,
    CORPSE_LEASE_MS,
    installAuthority,
    stopAuthority,
    availableActions,
  });

  global.LuminousLootLivePostCombatRuntime = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
