(function (global) {
  "use strict";

  if (global.LuminousAnatomyEquipmentEngine) return;

  const VALID_STATES = new Set(["available", "disabled", "missing", "replaced"]);
  const VALID_SUBSTRATES = new Set(["biological", "mechanical"]);

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function emit(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch (_) {}
    return detail;
  }

  function createAnatomy() {
    return { version: 1, parts: {}, order: [] };
  }

  function uniquePartId(anatomy, wanted) {
    const base = normalizeId(wanted || "part") || "part";
    if (!anatomy.parts[base]) return base;
    let index = 2;
    while (anatomy.parts[`${base}_${index}`]) index += 1;
    return `${base}_${index}`;
  }

  function addPart(anatomy, spec = {}) {
    if (!anatomy || typeof anatomy !== "object") anatomy = createAnatomy();
    if (!anatomy.parts || typeof anatomy.parts !== "object") anatomy.parts = {};
    if (!Array.isArray(anatomy.order)) anatomy.order = [];

    const type = normalizeId(spec.type || spec.slotType || spec.id || "part");
    const side = normalizeId(spec.side || "none");
    const suggested = spec.id || [side !== "none" ? side : null, type].filter(Boolean).join("_");
    const id = uniquePartId(anatomy, suggested);
    const parentId = spec.parentId ? normalizeId(spec.parentId) : null;
    const state = VALID_STATES.has(normalizeId(spec.state)) ? normalizeId(spec.state) : "available";
    const substrate = VALID_SUBSTRATES.has(normalizeId(spec.substrate)) ? normalizeId(spec.substrate) : "biological";

    anatomy.parts[id] = {
      id,
      type,
      side,
      parentId,
      state,
      substrate,
      canHoldItem: spec.canHoldItem === true || type === "hand",
      handEquivalent: spec.handEquivalent === true || type === "hand",
      tags: asArray(spec.tags).map(normalizeId).filter(Boolean),
      source: normalizeId(spec.source || "base"),
      metadata: clone(spec.metadata || {}),
    };
    anatomy.order.push(id);
    return anatomy.parts[id];
  }

  function addFingerSet(anatomy, handId, side, count = 5, options = {}) {
    const total = Math.max(0, Math.trunc(numberOr(count, 5)));
    const result = [];
    for (let index = 1; index <= total; index += 1) {
      result.push(addPart(anatomy, {
        id: `${side || "extra"}_finger_${index}`,
        type: "finger",
        side: side || "none",
        parentId: handId,
        substrate: options.substrate || "biological",
        source: options.source || "base",
      }));
    }
    return result;
  }

  function addArmBranch(anatomy, spec = {}) {
    const side = normalizeId(spec.side || "extra");
    const source = spec.source || "extra";
    const substrate = spec.substrate || "biological";
    const arm = addPart(anatomy, {
      id: spec.id || `${side}_arm`, type: "arm", side, parentId: spec.parentId || "torso", substrate, source,
    });
    if (spec.withHand === false) return { arm, hand: null, fingers: [] };
    const hand = addPart(anatomy, {
      id: spec.handId || `${side}_hand`, type: "hand", side, parentId: arm.id, substrate, source, canHoldItem: true, handEquivalent: true,
    });
    const fingers = addFingerSet(anatomy, hand.id, side, spec.fingers ?? 5, { substrate, source });
    return { arm, hand, fingers };
  }

  function addLegBranch(anatomy, spec = {}) {
    const side = normalizeId(spec.side || "extra");
    const source = spec.source || "extra";
    const substrate = spec.substrate || "biological";
    const leg = addPart(anatomy, {
      id: spec.id || `${side}_leg`, type: "leg", side, parentId: spec.parentId || "torso", substrate, source,
    });
    if (spec.withFoot === false) return { leg, foot: null };
    const foot = addPart(anatomy, {
      id: spec.footId || `${side}_foot`, type: "foot", side, parentId: leg.id, substrate, source,
    });
    return { leg, foot };
  }

  function createHumanoidAnatomy(options = {}) {
    const anatomy = createAnatomy();
    addPart(anatomy, { id: "torso", type: "torso", source: "base" });
    const head = addPart(anatomy, { id: "head", type: "head", parentId: "torso", source: "base" });
    addPart(anatomy, { id: "left_eye", type: "eye", side: "left", parentId: head.id, source: "base" });
    addPart(anatomy, { id: "right_eye", type: "eye", side: "right", parentId: head.id, source: "base" });
    addArmBranch(anatomy, { side: "left", source: "base", fingers: options.fingersPerHand ?? 5 });
    addArmBranch(anatomy, { side: "right", source: "base", fingers: options.fingersPerHand ?? 5 });
    addLegBranch(anatomy, { side: "left", source: "base" });
    addLegBranch(anatomy, { side: "right", source: "base" });
    return anatomy;
  }

  function descendantsOf(anatomy, partId) {
    const root = normalizeId(partId);
    const found = [];
    const visit = (parentId) => {
      anatomy.order.forEach((id) => {
        const part = anatomy.parts[id];
        if (part?.parentId === parentId) {
          found.push(id);
          visit(id);
        }
      });
    };
    visit(root);
    return found;
  }

  function setPartState(anatomy, partId, nextState, options = {}) {
    const id = normalizeId(partId);
    const state = normalizeId(nextState);
    if (!anatomy?.parts?.[id] || !VALID_STATES.has(state)) return null;
    const targets = [id, ...(options.cascade === false ? [] : descendantsOf(anatomy, id))];
    targets.forEach((targetId) => {
      const part = anatomy.parts[targetId];
      if (!part) return;
      part.state = state;
      if (options.substrate && VALID_SUBSTRATES.has(normalizeId(options.substrate))) part.substrate = normalizeId(options.substrate);
      if (options.source) part.stateSource = normalizeId(options.source);
    });
    return anatomy.parts[id];
  }

  function replaceBranch(anatomy, partId, options = {}) {
    const substrate = normalizeId(options.substrate || "mechanical");
    const root = setPartState(anatomy, partId, "replaced", { cascade: true, substrate, source: options.source || "augmentation" });
    return root;
  }

  function restoreBranch(anatomy, partId, options = {}) {
    const id = normalizeId(partId);
    const root = anatomy?.parts?.[id];
    if (!root) return { restored: false, reason: "missing_part" };
    const method = normalizeId(options.method || "biological");
    if (root.substrate === "mechanical" && ["biological", "regeneration", "healing"].includes(method)) {
      return { restored: false, reason: "biological_healing_cannot_repair_mechanical", part: root };
    }
    if (root.substrate === "biological" && ["mechanical_repair", "repair"].includes(method) && options.allowReplacement !== true) {
      return { restored: false, reason: "mechanical_repair_cannot_regrow_biological", part: root };
    }
    const substrate = options.substrate || (method === "replacement" ? "mechanical" : root.substrate);
    const state = method === "replacement" ? "replaced" : "available";
    setPartState(anatomy, id, state, { cascade: true, substrate, source: options.source || method });
    return { restored: true, part: anatomy.parts[id] };
  }

  function isPartUsable(part) {
    return Boolean(part) && ["available", "replaced"].includes(normalizeId(part.state));
  }

  function partsByType(anatomy, type, options = {}) {
    const wanted = normalizeId(type);
    return (anatomy?.order || []).map((id) => anatomy.parts[id]).filter((part) => {
      if (!part || part.type !== wanted) return false;
      return options.usableOnly === false ? true : isPartUsable(part);
    });
  }

  function addBodyGrant(anatomy, rawGrant, options = {}) {
    if (!rawGrant) return [];
    const grant = typeof rawGrant === "string" ? { type: rawGrant } : rawGrant;
    const type = normalizeId(grant.type || grant.bodyPart || grant.partType || grant.slot);
    const source = grant.source || options.source || "grant";
    const count = Math.max(1, Math.trunc(numberOr(grant.count, 1)));
    const added = [];

    for (let index = 0; index < count; index += 1) {
      if (type === "arm") {
        const side = grant.side || `extra_${partsByType(anatomy, "arm", { usableOnly: false }).length + 1}`;
        added.push(addArmBranch(anatomy, { ...grant, side, source }));
      } else if (type === "leg") {
        const side = grant.side || `extra_${partsByType(anatomy, "leg", { usableOnly: false }).length + 1}`;
        added.push(addLegBranch(anatomy, { ...grant, side, source }));
      } else {
        added.push(addPart(anatomy, {
          ...grant,
          id: grant.id || `${grant.side ? `${grant.side}_` : ""}${type || "part"}`,
          type: type || "part",
          parentId: grant.parentId || (type === "tail" || type === "wing" ? "torso" : grant.parentId),
          source,
          canHoldItem: grant.canHoldItem === true,
          handEquivalent: grant.handEquivalent === true,
        }));
      }
    }
    return added;
  }

  function augmentationMechanics(augmentation = {}) {
    return augmentation.mechanics || augmentation.anatomy || augmentation.bodyModification || augmentation;
  }

  function applyAugmentation(anatomy, augmentation = {}) {
    const mechanics = augmentationMechanics(augmentation);
    const source = augmentation.id || augmentation.name || "augmentation";
    asArray(mechanics.addBodyParts || mechanics.addBodyPart || mechanics.addsBodyParts).forEach((grant) => addBodyGrant(anatomy, grant, { source }));

    asArray(mechanics.replaceBodyPart || mechanics.replacesBodyPart || mechanics.replaces).forEach((replacement) => {
      if (!replacement) return;
      const partId = typeof replacement === "string" ? replacement : (replacement.partId || replacement.id || replacement.target);
      if (!partId) return;
      replaceBranch(anatomy, partId, {
        substrate: typeof replacement === "object" ? (replacement.substrate || "mechanical") : "mechanical",
        source,
      });
    });
    return anatomy;
  }

  function applyInjury(anatomy, injury = {}) {
    if (injury.active === false) return anatomy;
    const state = normalizeId(injury.slotEffect || injury.anatomyState || (injury.structural ? "missing" : ""));
    if (!VALID_STATES.has(state) || state === "available" || state === "replaced") return anatomy;
    const targets = asArray(injury.affectedParts || injury.bodyPart || injury.partId).filter(Boolean);
    targets.forEach((partId) => setPartState(anatomy, partId, state, { cascade: true, source: injury.id || injury.name || "injury" }));
    return anatomy;
  }

  function resolveCharacterAnatomy(character = {}, options = {}) {
    const anatomy = options.baseAnatomy ? clone(options.baseAnatomy) : createHumanoidAnatomy(options);
    const grants = [
      ...asArray(character.raceBodyParts),
      ...asArray(character.extraBodyParts),
      ...asArray(character.bodyPartsAdded),
      ...asArray(character.anatomyGrants),
    ];
    grants.forEach((grant) => addBodyGrant(anatomy, grant, { source: "character" }));
    asArray(character.augmentations || character.augments || character.bodyAugmentations).forEach((augmentation) => applyAugmentation(anatomy, augmentation));
    asArray(character.injuries).forEach((injury) => applyInjury(anatomy, injury));
    return anatomy;
  }

  function itemKind(item = {}) {
    const explicit = normalizeId(item.equipment?.kind || item.equipmentSchema?.kind || item.kind || item.category || item.itemType || item.tipo || item.type || item.tag);
    if (["weapon", "arma"].includes(explicit)) return "weapon";
    if (["shield", "escudo"].includes(explicit)) return "shield";
    if (["armor", "armadura"].includes(explicit)) return "armor";
    if (["accessory", "accessories", "accesorio"].includes(explicit)) return "accessory";
    if (["augmentation", "augment", "aumento", "alteracion_corporal"].includes(explicit)) return "augmentation";
    return explicit || "item";
  }

  function normalizeBlocker(raw) {
    if (typeof raw === "string") return { type: normalizeId(raw), count: Infinity };
    return {
      type: normalizeId(raw?.type || raw?.slot || raw?.bodyPart),
      count: raw?.count == null ? Infinity : Math.max(0, Math.trunc(numberOr(raw.count, 0))),
    };
  }

  function normalizeItemRequirements(item = {}, character = {}) {
    const schema = item.equipment || item.equipmentSchema || {};
    const kind = itemKind(item);
    const blockers = asArray(schema.blocksAccessorySlots || item.blocksAccessorySlots || item.blocks || item.blockedAccessorySlots)
      .map(normalizeBlocker).filter((entry) => entry.type);

    let handCost = Math.max(0, Math.trunc(numberOr(schema.handCost ?? item.handCost ?? item.handsRequired, 0)));
    if (!handCost && kind === "weapon") handCost = item.twoHanded === true || normalizeId(item.handedness) === "two_handed" ? 2 : 1;
    if (!handCost && kind === "shield") handCost = 1;
    const twoHandedAsOne = character?.equipmentRules?.twoHandedAsOneHanded === true
      || character?.twoHandedAsOneHanded === true
      || asArray(character?.traits).some((trait) => trait?.mechanics?.twoHandedAsOneHanded === true);
    if (handCost === 2 && twoHandedAsOne) handCost = 1;

    const accessoryType = normalizeId(schema.accessoryType || schema.bodySlot || item.accessorySlot || item.bodySlot || item.slotType || item.equipBodyPart);
    let accessoryCost = Math.max(1, Math.trunc(numberOr(schema.slotCost ?? item.slotCost, 1)));
    if (kind !== "accessory") accessoryCost = 0;

    return {
      kind,
      handCost,
      armorCost: kind === "armor" ? 1 : 0,
      accessoryType: kind === "accessory" ? (accessoryType || "legacy_accessory") : null,
      accessoryCost,
      blockers,
      legacySlot: normalizeId(item.equipped_slot || item.equippedSlot),
    };
  }

  function isEquipped(item = {}) {
    return item.equipped === true || Boolean(item.equipped_slot || item.equippedSlot || item.equippedPartIds || item.assignedBodyParts);
  }

  function equippedEntries(rawItems) {
    const list = Array.isArray(rawItems) ? rawItems : Object.entries(rawItems || {}).map(([key, value]) => ({ key, ...(value || {}) }));
    return list.filter((item) => item && isEquipped(item));
  }

  function blockedSetForArmor(anatomy, blockers) {
    const blocked = new Set();
    blockers.forEach((blocker) => {
      const matches = partsByType(anatomy, blocker.type);
      const count = Number.isFinite(blocker.count) ? blocker.count : matches.length;
      matches.slice(0, count).forEach((part) => blocked.add(part.id));
    });
    return blocked;
  }

  function validateEquipment(character = {}, rawItems = [], options = {}) {
    const anatomy = options.anatomy || resolveCharacterAnatomy(character, options);
    const items = equippedEntries(rawItems);
    const assignments = [];
    const invalid = [];
    const handPool = (anatomy.order || []).map((id) => anatomy.parts[id]).filter((part) => isPartUsable(part) && (part.type === "hand" || part.handEquivalent));
    const usedHands = new Set();
    const usedAccessoryParts = new Set();
    const blockedAccessoryParts = new Set();
    let armorUsed = false;

    const rows = items.map((item) => ({ item, req: normalizeItemRequirements(item, character) }));
    rows.filter((row) => row.req.kind === "armor").forEach((row) => {
      if (armorUsed) invalid.push({ item: row.item, reason: "armor_slot_unavailable", requirements: row.req });
      else {
        armorUsed = true;
        row.req.blockers.forEach((blocker) => blockedSetForArmor(anatomy, [blocker]).forEach((id) => blockedAccessoryParts.add(id)));
        assignments.push({ item: row.item, kind: "armor", partIds: ["torso"] });
      }
    });

    rows.filter((row) => ["weapon", "shield"].includes(row.req.kind)).forEach((row) => {
      const free = handPool.filter((part) => !usedHands.has(part.id));
      if (free.length < row.req.handCost) {
        invalid.push({ item: row.item, reason: "not_enough_functional_hands", requirements: row.req });
        return;
      }
      const chosen = free.slice(0, row.req.handCost);
      chosen.forEach((part) => usedHands.add(part.id));
      assignments.push({ item: row.item, kind: row.req.kind, partIds: chosen.map((part) => part.id) });
    });

    const accessoryRows = rows.filter((row) => row.req.kind === "accessory")
      .sort((a, b) => Number(b.req.blockers.length > 0) - Number(a.req.blockers.length > 0));
    let legacyAccessoriesUsed = 0;
    accessoryRows.forEach((row) => {
      if (row.req.accessoryType === "legacy_accessory") {
        if (legacyAccessoriesUsed >= 4) invalid.push({ item: row.item, reason: "legacy_accessory_capacity", requirements: row.req });
        else {
          legacyAccessoriesUsed += 1;
          assignments.push({ item: row.item, kind: "accessory", partIds: [`legacy_accessory_${legacyAccessoriesUsed}`] });
        }
        return;
      }
      const candidates = partsByType(anatomy, row.req.accessoryType).filter((part) => !usedAccessoryParts.has(part.id) && !blockedAccessoryParts.has(part.id));
      if (candidates.length < row.req.accessoryCost) {
        invalid.push({ item: row.item, reason: "accessory_body_slot_unavailable", requirements: row.req });
        return;
      }
      const chosen = candidates.slice(0, row.req.accessoryCost);
      chosen.forEach((part) => usedAccessoryParts.add(part.id));
      assignments.push({ item: row.item, kind: "accessory", partIds: chosen.map((part) => part.id) });

      row.req.blockers.forEach((blocker) => {
        chosen.forEach((root) => {
          const localIds = [root.id, ...descendantsOf(anatomy, root.id)];
          const matching = localIds.map((id) => anatomy.parts[id]).filter((part) => part?.type === blocker.type && isPartUsable(part));
          const count = Number.isFinite(blocker.count) ? blocker.count : matching.length;
          matching.slice(0, count).forEach((part) => blockedAccessoryParts.add(part.id));
        });
      });
    });

    rows.filter((row) => !["armor", "weapon", "shield", "accessory", "augmentation"].includes(row.req.kind)).forEach((row) => {
      assignments.push({ item: row.item, kind: row.req.kind, partIds: [] });
    });

    return {
      valid: invalid.length === 0,
      anatomy,
      assignments,
      invalid,
      capacities: {
        hands: handPool.length,
        freeHands: Math.max(0, handPool.length - usedHands.size),
        armor: 1,
        accessoryByType: anatomy.order.reduce((acc, id) => {
          const part = anatomy.parts[id];
          if (isPartUsable(part)) acc[part.type] = (acc[part.type] || 0) + 1;
          return acc;
        }, {}),
      },
      blockedAccessoryParts: [...blockedAccessoryParts],
    };
  }

  function clearEquippedState(item) {
    if (!item || typeof item !== "object") return item;
    item.equipped = false;
    item.equipped_slot = null;
    item.equippedSlot = null;
    item.equippedPartIds = [];
    item.assignedBodyParts = [];
    return item;
  }

  function revalidateEquipment(character = {}, rawItems = [], options = {}) {
    const result = validateEquipment(character, rawItems, options);
    const lootPool = Array.isArray(options.lootPool) ? options.lootPool : null;
    result.invalid.forEach((entry) => {
      const item = entry.item;
      clearEquippedState(item);
      const dropped = { item, reason: entry.reason, characterId: character.id || character.unitId || character.playerId || null };
      if (typeof options.onDropToLoot === "function") options.onDropToLoot(dropped);
      else if (lootPool) lootPool.push(item);
      emit("luminous:equipment-invalidated", dropped);
    });
    emit("luminous:equipment-revalidated", { character, result });
    return result;
  }

  function collectEquippedItems(character = {}) {
    const containers = [character.equipment, character.activeInventory, character.inventory, character.inventario, character.items];
    const result = [];
    const seen = new Set();
    containers.forEach((container) => {
      equippedEntries(container).forEach((item) => {
        const key = item.key || item.id || item.itemId || item;
        if (seen.has(key)) return;
        seen.add(key);
        result.push(item);
      });
    });
    return result;
  }

  function rebuildCharacter(character = {}, options = {}) {
    const anatomy = resolveCharacterAnatomy(character, options);
    character.anatomyRuntime = anatomy;
    const items = options.items || collectEquippedItems(character);
    const validation = revalidateEquipment(character, items, { ...options, anatomy });
    return { anatomy, validation };
  }

  const api = Object.freeze({
    VALID_STATES: Object.freeze([...VALID_STATES]),
    VALID_SUBSTRATES: Object.freeze([...VALID_SUBSTRATES]),
    normalizeId,
    createAnatomy,
    createHumanoidAnatomy,
    addPart,
    addBodyGrant,
    descendantsOf,
    setPartState,
    replaceBranch,
    restoreBranch,
    isPartUsable,
    partsByType,
    applyAugmentation,
    applyInjury,
    resolveCharacterAnatomy,
    normalizeItemRequirements,
    collectEquippedItems,
    validateEquipment,
    revalidateEquipment,
    rebuildCharacter,
  });

  global.LuminousAnatomyEquipmentEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
