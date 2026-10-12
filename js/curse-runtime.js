(function (global) {
  "use strict";
  if (global.LuminousCurseRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCurseRuntime;
    return;
  }

  // Initial, executable Item-curse vocabulary. New named Curses must be
  // authored and shipped with an executable adverse-effect adapter.
  // This is NOT an Enchantment property and does not consume Magic slots.
  const DEFINITIONS = Object.freeze([
    Object.freeze({
      id: "cursed_binding",
      name: "Atadura maldita",
      family: "binding",
      targetKinds: Object.freeze(["item"]),
      adverseEffect: "equipment_lock",
      description: "Una vez equipado, este objeto no puede retirarse mientras la atadura esté activa.",
      maxIntensity: 1,
      allowedResolutions: Object.freeze(["suppress", "seal", "break", "transfer"]),
    }),
  ]);
  const byId = new Map(DEFINITIONS.map((definition) => [definition.id, definition]));
  let serial = 0;
  const copy = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalize = (value) => String(value || "").trim().toLowerCase();
  const itemId = (item) => String(item?.instanceId || item?.instance_id || "").trim();
  const entryList = (item) => Array.isArray(item?.curseInstances) ? item.curseInstances : [];
  const unresolved = (entry) => entry && entry.state !== "resolved";
  const active = (entry) => unresolved(entry) && entry.state === "active";
  const definitionOf = (id) => byId.get(String(id || "")) || null;

  function listDefinitions(targetKind = "item") {
    return DEFINITIONS.filter((definition) => definition.targetKinds.includes(targetKind)).map(copy);
  }
  function instances(item, options = {}) {
    return entryList(item)
      .filter((entry) => options.includeResolved === true || unresolved(entry))
      .map((entry) => ({
        ...copy(entry),
        definition: definitionOf(entry.definitionId) ? copy(definitionOf(entry.definitionId)) : null,
      }));
  }
  function hasCurse(item) {
    return entryList(item).some(unresolved);
  }
  function itemUnequipLocked(item) {
    return entryList(item).some((entry) =>
      active(entry) && definitionOf(entry.definitionId)?.adverseEffect === "equipment_lock");
  }
  function snapshot(item) {
    return JSON.stringify(entryList(item));
  }
  function applyItem(item, definitionId, options = {}) {
    if (!item || !itemId(item)) return { applied:false, reason:"missing_item_instance" };
    const definition = definitionOf(definitionId);
    if (!definition || !definition.targetKinds.includes("item")) {
      return { applied:false, reason:"unsupported_curse_definition" };
    }
    if (!definition.adverseEffect || !["equipment_lock"].includes(definition.adverseEffect)) {
      return { applied:false, reason:"curse_effect_not_executable" };
    }
    const next = copy(item);
    const curses = entryList(next);
    const same = curses.filter((entry) => unresolved(entry) && entry.definitionId === definition.id);
    if (same.length >= definition.maxIntensity) {
      return { applied:false, reason:"curse_intensity_limit_reached" };
    }
    serial += 1;
    const instance = {
      schemaVersion:1,
      instanceId: String(options.instanceId || ("curse:" + definition.id + ":" + itemId(next) + ":" + Date.now() + ":" + serial)),
      definitionId:definition.id,
      family:definition.family,
      targetKind:"item",
      targetInstanceId:itemId(next),
      intensity:1,
      state:"active",
      origin:copy(options.origin || {source:"dm_item_editor"}),
      appliedAt:Number(options.appliedAt ?? Date.now()),
    };
    if (curses.some((entry) => entry.instanceId === instance.instanceId)) {
      return { applied:false, reason:"duplicate_curse_instance" };
    }
    next.curseInstances = [...curses, instance];
    return { applied:true, item:next, instance:copy(instance) };
  }
  function resolveItem(item, curseInstanceId, operation, options = {}) {
    if (!item || !itemId(item)) return {changed:false,reason:"missing_item_instance"};
    const next = copy(item);
    const entries = entryList(next);
    const index = entries.findIndex((entry) => entry.instanceId === String(curseInstanceId || ""));
    if (index < 0 || !unresolved(entries[index])) {
      return {changed:false,reason:"curse_instance_not_found"};
    }
    const current = entries[index];
    const definition = definitionOf(current.definitionId);
    if (!definition) return {changed:false,reason:"unknown_curse_definition"};
    const op = normalize(operation);
    const allowed = definition.allowedResolutions.includes(op) ||
      (op === "resume" && current.state === "suppressed" && definition.allowedResolutions.includes("suppress")) ||
      (op === "unseal" && current.state === "sealed" && definition.allowedResolutions.includes("seal"));
    if (!allowed) return {changed:false,reason:"curse_resolution_not_allowed"};
    const transitions = {
      suppress:current.state === "active" ? "suppressed" : null,
      seal:["active", "suppressed"].includes(current.state) ? "sealed" : null,
      resume:current.state === "suppressed" ? "active" : null,
      unseal:current.state === "sealed" ? "active" : null,
      break:"resolved",
      remove:"resolved",
    };
    const state = transitions[op] || null;
    if (!state) return {changed:false,reason:"curse_invalid_state_transition"};
    entries[index] = {
      ...current,
      state,
      ...(state === "resolved"
        ? {resolvedBy:op, resolvedAt:Number(options.resolvedAt ?? Date.now())}
        : {}),
    };
    next.curseInstances = entries;
    return {changed:true,item:next,instance:copy(entries[index]),operation:op};
  }
  function transferItem(source, destination, curseInstanceId) {
    if (!source || !destination || !itemId(source) || !itemId(destination) ||
        itemId(source) === itemId(destination)) return {transferred:false,reason:"invalid_transfer_target"};
    const src = copy(source), dst = copy(destination);
    const sourceList = entryList(src), destinationList = entryList(dst);
    const index = sourceList.findIndex((entry) => entry.instanceId === String(curseInstanceId || "") && unresolved(entry));
    if (index < 0) return {transferred:false,reason:"curse_instance_not_found"};
    const instance = sourceList[index];
    const definition = definitionOf(instance.definitionId);
    if (!definition?.allowedResolutions.includes("transfer") || !definition.targetKinds.includes("item")) {
      return {transferred:false,reason:"curse_transfer_not_allowed"};
    }
    if (destinationList.filter((entry) => unresolved(entry) && entry.definitionId === definition.id).length >= definition.maxIntensity ||
        destinationList.some((entry) => entry.instanceId === instance.instanceId)) {
      return {transferred:false,reason:"curse_target_conflict"};
    }
    sourceList.splice(index, 1);
    dst.curseInstances = [...destinationList, {...instance,targetInstanceId:itemId(dst)}];
    src.curseInstances = sourceList;
    return {transferred:true,source:src,destination:dst};
  }

  const api = Object.freeze({
    version:1, listDefinitions, getDefinition:(id) => copy(definitionOf(id)),
    instances, snapshot, hasCurse, itemUnequipLocked, applyItem, resolveItem, transferItem,
  });
  global.LuminousCurseRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
