(function (global) {
  "use strict";
  if (global.LuminousCurseRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCurseRuntime;
    return;
  }

  const VERSION = 2;
  const catalog = global.LuminousCurseCatalog ||
    (typeof require === "function" ? require("./curse-catalog.js") : null);
  if (!catalog) throw new Error("LuminousCurseCatalog must load before Curse Runtime.");

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const itemId = (item) => String(item?.instanceId || item?.instance_id || "").trim();
  const entries = (item) => Array.isArray(item?.curseInstances) ? item.curseInstances : [];
  const unresolved = (instance) => instance.state !== "resolved";
  let serial = 0;

  // Server-authorized definitions, not user-supplied executable recipes.
  const known = (id) => catalog.get(id);
  const plainObject = (value) => value != null && typeof value === "object" && !Array.isArray(value);
  function safeMetadata(value) {
    if (!plainObject(value) || catalog.containsExecutablePayload(value)) return false;
    return Object.keys(value).every(key => ["source","sourceInstanceId","createdBy","ritualId","campaignId"].includes(key) &&
      typeof value[key] === "string" && value[key].length > 0 && value[key].length <= 160);
  }
  function validateInstance(item, instance) {
    if (!itemId(item) || !plainObject(instance) || catalog.containsExecutablePayload(instance)) {
      return {valid:false,reason:"invalid_curse_instance"};
    }
    const definition = known(instance.definitionId);
    if (!definition || !definition.targetKinds.includes("item")) return {valid:false,reason:"unknown_curse_definition"};
    if (instance.schemaVersion !== 1 || !/^[\w:.-]{3,180}$/.test(String(instance.instanceId || "")) ||
        instance.targetKind !== "item" || instance.targetInstanceId !== itemId(item) ||
        instance.family !== definition.family || !catalog.STATES.includes(instance.state) ||
        !Number.isInteger(instance.intensity) || instance.intensity < 1 ||
        instance.intensity > definition.maxIntensity || !safeMetadata(instance.origin)) {
      return {valid:false,reason:"invalid_curse_instance"};
    }
    if (!Number.isFinite(Number(instance.appliedAt)) || Number(instance.appliedAt) < 0) return {valid:false,reason:"invalid_curse_timestamp"};
    if (instance.eventIds !== undefined &&
        (!Array.isArray(instance.eventIds) || instance.eventIds.length > 32 ||
         new Set(instance.eventIds).size !== instance.eventIds.length ||
         instance.eventIds.some(id => typeof id !== "string" || !/^[\w:.-]{1,180}$/.test(id)))) {
      return {valid:false,reason:"invalid_curse_event_history"};
    }
    if (instance.state === "resolved" &&
        (!["remove","break"].includes(instance.resolvedBy) || !Number.isFinite(Number(instance.resolvedAt)))) {
      return {valid:false,reason:"invalid_curse_resolution"};
    }
    return {valid:true,definition};
  }
  function validated(item, options = {}) {
    return entries(item).filter(instance =>
      validateInstance(item,instance).valid &&
      (options.includeResolved === true || unresolved(instance)));
  }
  function snapshot(item) { return JSON.stringify(entries(item)); }
  function instances(item, options = {}) {
    return validated(item,options)
      .map(instance => ({...clone(instance),definition:known(instance.definitionId)}));
  }
  function listDefinitions(targetKind = "item") { return catalog.list(targetKind); }
  function hasCurse(item) { return validated(item).length > 0; }
  function activeEffects(item, trigger = "passive") {
    const out = validated(item)
      .filter(instance => instance.state === "active")
      .map(instance => {
        const definition = known(instance.definitionId);
        if (definition.trigger !== trigger) return null;
        return {
          type:definition.adverseEffect,trigger:definition.trigger,
          curseInstanceId:instance.instanceId,definitionId:definition.id,
          priority:definition.priority,intensity:instance.intensity,
          targetKind:instance.targetKind,targetInstanceId:instance.targetInstanceId,
        };
      }).filter(Boolean);
    out.sort((a,b) => b.priority-a.priority || a.curseInstanceId.localeCompare(b.curseInstanceId));
    return out.map(clone);
  }
  function itemUnequipLocked(item) {
    return activeEffects(item).some(effect => effect.type === "equipment_lock");
  }
  function canApply(item, definitionId, options = {}) {
    if (!item || !itemId(item)) return {allowed:false,reason:"missing_item_instance"};
    const definition = known(definitionId);
    if (!definition || !definition.targetKinds.includes("item")) return {allowed:false,reason:"unsupported_curse_definition"};
    if (!catalog.validateDefinition(definition).valid ||
        definition.adverseEffect !== "equipment_lock" || definition.trigger !== "passive") {
      return {allowed:false,reason:"curse_effect_not_executable"};
    }
    const invalid = entries(item).find(instance => !validateInstance(item,instance).valid);
    if (invalid) return {allowed:false,reason:"invalid_existing_curse_instance"};
    if (options.origin !== undefined && !safeMetadata(options.origin)) {
      return {allowed:false,reason:"invalid_curse_origin"};
    }
    if (options.instanceId !== undefined && !/^[\w:.-]{3,180}$/.test(String(options.instanceId))) {
      return {allowed:false,reason:"invalid_curse_instance_id"};
    }
    if (options.eventId !== undefined && !/^[\w:.-]{1,180}$/.test(String(options.eventId))) {
      return {allowed:false,reason:"invalid_curse_event_id"};
    }
    // An ItemInstance with multiple physical copies requires splitting before
    // assigning a curse to one object. Never silently curse the whole stack.
    const quantity = Number(item.quantity ?? item.cantidad ?? 1);
    if (!Number.isFinite(quantity) || quantity !== 1) return {allowed:false,reason:"curse_requires_single_item"};
    const matches = validated(item).filter(instance => instance.definitionId === definition.id);
    if (matches.length > 1) return {allowed:false,reason:"duplicate_curse_sources"};
    const existing = matches[0] || null;
    if (existing && options.eventId && existing.eventIds?.includes(options.eventId)) {
      return {allowed:false,reason:"duplicate_curse_event",idempotent:true};
    }
    if (options.instanceId && entries(item).some(instance => instance.instanceId === options.instanceId)) {
      return {allowed:false,reason:"duplicate_curse_instance"};
    }
    if (existing && (definition.stacking === "non_stackable" || existing.intensity >= definition.maxIntensity)) {
      return {allowed:false,reason:"curse_intensity_limit_reached"};
    }
    return {allowed:true,definition,existing:existing ? clone(existing):null};
  }
  function applyItem(item, definitionId, options = {}) {
    const gate = canApply(item,definitionId,options);
    if (!gate.allowed) return {applied:false,reason:gate.reason,idempotent:gate.idempotent === true};
    const next = clone(item);
    const list = entries(next);
    const eventId = options.eventId == null ? null : String(options.eventId);
    let instance;
    if (gate.existing) {
      const index = list.findIndex(row => row.instanceId === gate.existing.instanceId);
      instance = {...list[index],intensity:gate.existing.intensity+1};
      if (eventId) instance.eventIds = [...(instance.eventIds || []),eventId].slice(-32);
      list[index] = instance;
    } else {
      serial += 1;
      instance = {
        schemaVersion:1,
        instanceId:String(options.instanceId || ("curse:"+gate.definition.id+":"+itemId(next)+":"+Date.now()+":"+serial)),
        definitionId:gate.definition.id,
        family:gate.definition.family,
        targetKind:"item",
        targetInstanceId:itemId(next),
        intensity:1,
        state:"active",
        origin:clone(options.origin || {source:"dm_item_editor"}),
        appliedAt:Number(options.appliedAt ?? Date.now()),
        ...(eventId ? {eventIds:[eventId]} : {}),
      };
      list.push(instance);
    }
    next.curseInstances = list;
    return {applied:true,item:next,instance:clone(instance),intensified:!!gate.existing};
  }
  function canResolve(item, instanceId, operation) {
    if (!item || !itemId(item)) return {allowed:false,reason:"missing_item_instance"};
    const invalid = entries(item).find(instance => !validateInstance(item,instance).valid);
    if (invalid) return {allowed:false,reason:"invalid_existing_curse_instance"};
    const instance = validated(item).find(entry => entry.instanceId === String(instanceId || ""));
    if (!instance) return {allowed:false,reason:"curse_instance_not_found"};
    const definition = known(instance.definitionId);
    const op = String(operation || "").trim().toLowerCase();
    const allowed = definition.allowedResolutions.includes(op) ||
      (op === "resume" && definition.allowedResolutions.includes("suppress")) ||
      (op === "unseal" && definition.allowedResolutions.includes("seal"));
    if (!allowed) return {allowed:false,reason:"curse_resolution_not_allowed"};
    const transitions = {
      suppress:instance.state === "active" ? "suppressed" : null,
      seal:["active","suppressed"].includes(instance.state) ? "sealed" : null,
      resume:instance.state === "suppressed" ? "active" : null,
      unseal:instance.state === "sealed" ? "active" : null,
      remove:"resolved",break:"resolved",
    };
    const nextState = transitions[op] || null;
    if (!nextState) return {allowed:false,reason:"curse_invalid_state_transition"};
    return {allowed:true,instance:clone(instance),operation:op,nextState};
  }
  function resolveItem(item,instanceId,operation,options = {}) {
    const gate = canResolve(item,instanceId,operation);
    if (!gate.allowed) return {changed:false,reason:gate.reason};
    const next = clone(item);
    const list = entries(next);
    const index = list.findIndex(entry => entry.instanceId === gate.instance.instanceId);
    const updated = {
      ...list[index],
      state:gate.nextState,
      ...(gate.nextState === "resolved"
        ? {resolvedBy:gate.operation,resolvedAt:Number(options.resolvedAt ?? Date.now())}
        : {}),
    };
    list[index] = updated;
    next.curseInstances = list;
    return {changed:true,item:next,instance:clone(updated),operation:gate.operation};
  }
  function transferItem(source,destination,instanceId) {
    if (!source || !destination || !itemId(source) || !itemId(destination) ||
        itemId(source) === itemId(destination)) return {transferred:false,reason:"invalid_transfer_target"};
    if (entries(source).some(instance => !validateInstance(source,instance).valid) ||
        entries(destination).some(instance => !validateInstance(destination,instance).valid)) {
      return {transferred:false,reason:"invalid_existing_curse_instance"};
    }
    const src = clone(source),dst = clone(destination);
    const sourceList = entries(src),destinationList = entries(dst);
    const index = sourceList.findIndex(entry => entry.instanceId === String(instanceId || "") && unresolved(entry));
    if (index < 0) return {transferred:false,reason:"curse_instance_not_found"};
    const instance = sourceList[index];
    const def = known(instance.definitionId);
    if (!def?.allowedResolutions.includes("transfer") || !def.targetKinds.includes("item")) {
      return {transferred:false,reason:"curse_transfer_not_allowed"};
    }
    const quantity = Number(destination.quantity ?? destination.cantidad ?? 1);
    if (!Number.isFinite(quantity) || quantity !== 1) return {transferred:false,reason:"curse_requires_single_item"};
    if (destinationList.some(entry => entry.instanceId === instance.instanceId ||
        (unresolved(entry) && entry.definitionId === def.id))) {
      return {transferred:false,reason:"curse_target_conflict"};
    }
    sourceList.splice(index,1);
    src.curseInstances = sourceList;
    dst.curseInstances = [...destinationList,{...instance,targetInstanceId:itemId(dst)}];
    return {transferred:true,source:src,destination:dst};
  }
  const api = Object.freeze({
    VERSION,version:VERSION,FAMILIES:catalog.FAMILIES,TARGET_KINDS:catalog.TARGET_KINDS,
    listDefinitions,getDefinition:(id)=>known(id),
    validateDefinition:catalog.validateDefinition,validateInstance,
    instances,snapshot,hasCurse,activeEffects,itemUnequipLocked,
    canApply,applyItem,canResolve,resolveItem,transferItem,
  });
  global.LuminousCurseRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
