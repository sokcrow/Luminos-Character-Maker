(function (global) {
  "use strict";

  if (global.LuminousDmLootStudio) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousDmLootStudio;
    return;
  }

  const VERSION = 1;
  const ROOT = "campaña/loot_instances";

  const state = {
    installed: false,
    units: {},
    players: {},
    items: {},
    preview: null,
    sessionId: null,
    selectedUnitId: "",
    overrideItems: [],
    removeItemIds: [],
  };

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clean = (value) => String(value ?? "").trim();
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function dbFrom(options = {}) {
    if (options.db) return options.db;
    try { return global.firebase?.database?.() || null; } catch (_) { return null; }
  }
  function inventoryRuntime() { return global.LuminousItemInventoryRuntime || null; }
  function lootRuntime() { return global.LuminousLootInstanceRuntime || null; }
  function encounterRuntime() { return global.LuminousLootEncounterContext || null; }
  function unitSync() { return global.LuminousCombatUnitLibrarySync || null; }

  function currentItems() {
    const local = global.LuminousDmLocalItemManagerV3?.getItemsObject?.();
    if (local && typeof local === "object") return clone(local);
    if (global.dbItemsCache && typeof global.dbItemsCache === "object") return clone(global.dbItemsCache);
    return clone(state.items);
  }

  function itemName(definition = {}, fallback = "") {
    return clean(definition.name || definition.nombre || definition.displayName || definition.id || fallback) || fallback;
  }
  function unitName(unit = {}, fallback = "") {
    return clean(unit.name || unit.nombre || unit.characterName || unit.displayName || unit.id || fallback) || fallback;
  }
  function categoryFor(definition = {}) {
    const raw = normalizeId(definition.category || definition.itemType || definition.family || "material");
    const map = {
      material: "materials", materials: "materials", ingredient: "food", food: "food",
      medicine: "medicine", medical: "medicine", consumable: "consumables", consumables: "consumables",
      tool: "tools", tools: "tools", valuable: "valuables", valuables: "valuables",
      document: "documents", documents: "documents", ammo: "ammunition", ammunition: "ammunition",
      technology: "technology", luxury: "luxury", gem: "gems", gems: "gems",
    };
    return map[raw] || raw;
  }

  async function loadUnits(options = {}) {
    const sync = unitSync();
    let units = {};
    if (sync?.ensureCatalogs && sync?.buildPayloads) {
      await sync.ensureCatalogs();
      const payloads = await sync.buildPayloads();
      units = clone(payloads.units || {});
    } else {
      for (const catalog of [global.LuminousKoboldUnitCatalog, global.LuminousGoblinUnitCatalog, global.LuminousWolfUnitCatalog]) {
        for (const unit of catalog?.list?.() || []) units[unit.id] = unit;
      }
    }

    const db = dbFrom(options);
    if (db?.ref) {
      try {
        const snap = await db.ref("campaña/base_datos_unidades").once("value");
        const authored = snap.val() || {};
        units = { ...units, ...clone(authored) };
      } catch (_) {}
    }
    state.units = units;
    return clone(units);
  }

  async function loadPlayers(options = {}) {
    const db = dbFrom(options);
    if (!db?.ref) return {};
    try {
      const snap = await db.ref("campaña/jugadores").once("value");
      state.players = clone(snap.val() || {});
      return clone(state.players);
    } catch (_) {
      return {};
    }
  }

  function newSessionId(unitId = "") {
    const stamp = Date.now().toString(36);
    const id = normalizeId(unitId || "unit") || "unit";
    return `${id}_${stamp}`;
  }

  function resetPreview(unitId = state.selectedUnitId) {
    state.preview = null;
    state.sessionId = newSessionId(unitId);
    state.selectedUnitId = normalizeId(unitId);
    return state.sessionId;
  }

  function selectedEvents(doc = global.document) {
    const select = doc?.getElementById?.("dm-loot-event");
    return [...(select?.selectedOptions || [])].map((option, index) => ({
      id: `studio_${normalizeId(option.value)}_${index + 1}`,
      eventType: normalizeId(option.value),
    })).filter((entry) => entry.eventType);
  }

  function selectedZone(doc = global.document) {
    const profileId = normalizeId(doc?.getElementById?.("dm-loot-zone")?.value || "");
    return {
      id: profileId ? `studio_${profileId}` : "studio_zone",
      ...(profileId ? { profileId } : { allowCustom: true }),
      source: "dm_loot_studio",
    };
  }

  function overrides() {
    return {
      guaranteedItems: state.overrideItems.map((entry) => ({
        itemId: entry.itemId,
        category: entry.category || "",
        quantity: entry.quantity || 1,
        tags: ["dm_override"],
      })),
      removeItemIds: [...state.removeItemIds],
      reason: state.overrideItems.length || state.removeItemIds.length ? "dm_loot_studio" : "",
    };
  }

  function buildGenerationOptions(unit = {}, options = {}) {
    const sessionId = state.sessionId || resetPreview(unit.id);
    return {
      encounterId: options.encounterId || `dm_loot_studio:${sessionId}`,
      unitId: normalizeId(unit.id),
      unitInstanceId: options.unitInstanceId || `studio:${sessionId}`,
      corpseId: options.corpseId || `corpse:${sessionId}`,
      zone: options.zone || selectedZone(options.document),
      events: options.events || selectedEvents(options.document),
      dmOverrides: options.dmOverrides || overrides(),
      catalog: options.catalog || currentItems(),
      equipmentInstances: options.equipmentInstances,
      damageRecord: options.damageRecord,
      now: options.now ?? Date.now(),
    };
  }

  function generatePreview(unit = {}, options = {}) {
    const runtime = lootRuntime();
    if (!runtime?.generateLootInstance) throw new Error("LOOT_INSTANCE_RUNTIME_REQUIRED");
    if (!unit?.id) throw new Error("DM_LOOT_UNIT_REQUIRED");
    if (state.selectedUnitId !== normalizeId(unit.id) || !state.sessionId) resetPreview(unit.id);
    const generationOptions = buildGenerationOptions(unit, options);
    state.preview = runtime.generateLootInstance(unit, generationOptions);
    return clone(state.preview);
  }

  function regeneratePreview(unit = {}, options = {}) {
    const runtime = lootRuntime();
    if (!state.preview) return generatePreview(unit, options);
    if (state.preview.locked) throw new Error("LOCKED_LOOT_INSTANCE_CANNOT_REGENERATE");
    const base = buildGenerationOptions(unit, {
      ...options,
      encounterId: state.preview.encounterId,
      unitInstanceId: state.preview.sourceUnitInstanceId,
      corpseId: state.preview.corpseId,
    });
    state.preview = runtime.regenerateLootInstance(state.preview, unit, base);
    return clone(state.preview);
  }

  async function lockPreview(unit = {}, options = {}) {
    const runtime = lootRuntime();
    if (!state.preview) throw new Error("DM_LOOT_PREVIEW_REQUIRED");
    if (!state.preview.locked) {
      state.preview = runtime.lockLootInstance(state.preview, {
        unit,
        reason: "dm_loot_studio_finalize",
        now: options.now ?? Date.now(),
      });
    }
    const db = dbFrom(options);
    if (db?.ref) await db.ref(`${ROOT}/${state.preview.lootInstanceId}`).set(clone(state.preview));
    return clone(state.preview);
  }

  function provenanceRows(preview = {}) {
    return {
      "Unit": preview.sourceUnitId || "—",
      "Unit Instance": preview.sourceUnitInstanceId || "—",
      "Corpse": preview.corpseId || "—",
      "Encounter": preview.encounterId || "—",
      "Zone": preview.context?.provenance?.zoneProfileId || preview.context?.provenance?.zoneId || "—",
      "Events": (preview.context?.provenance?.eventTypes || []).join(", ") || "—",
      "Generation": preview.generation ?? 0,
    };
  }

  function viewModel(unit = {}, preview = state.preview) {
    const social = preview?.social || {};
    const body = unit.bodyProfile || {};
    const context = preview?.context || {};
    return {
      unit: {
        id: unit.id || null,
        name: unitName(unit, unit.id),
        bodyKind: body.kind || null,
        bodyMaterials: clone(body.materials || []),
        wealthBand: unit.wealthProfile?.bandId || social.wealthProfile?.bandId || null,
        roles: clone(unit.roleProfile?.roles || social.roleProfile?.roles || []),
      },
      context: {
        zone: context.provenance?.zoneProfileId || context.provenance?.zoneId || null,
        events: clone(context.provenance?.eventTypes || []),
        weights: clone(context.weights || {}),
        rarityWeights: clone(context.rarityWeights || {}),
        impossibleCategories: clone(preview?.impossibleCategories?.all || context.impossibleCategories || []),
        allowedCategories: clone(context.allowedCategories || []),
      },
      generated: {
        carried: clone(preview?.carried || []),
        equipment: clone(preview?.equipment?.items || []),
        currency: clone(preview?.currency || null),
        harvest: clone(preview?.harvest?.resources || []),
      },
      locked: preview?.locked === true,
      provenance: preview ? provenanceRows(preview) : {},
      overrides: clone(overrides()),
    };
  }

  function ownerId(player = {}, fallback = "") {
    return clean(player.playerId || player.uid || player.id || fallback);
  }

  function insertOneWithFallback(player, rawItem, options = {}) {
    const inv = inventoryRuntime();
    if (!inv?.insertItem) throw new Error("ITEM_INVENTORY_RUNTIME_REQUIRED");
    const item = clone(rawItem);
    const id = ownerId(player, options.ownerId);
    if (id) inv.transferOwnership?.(item, id);

    const preferred = normalizeId(options.preferredContainer || "stash") === "active" ? "active" : "stash";
    const fallback = preferred === "stash" ? "active" : "stash";
    const wanted = Math.max(1, Number(item.quantity || 1));
    const first = inv.insertItem(player, item, preferred, options);
    let inserted = Number(first.quantity || 0);
    const receipts = [{ container: preferred, ...clone(first) }];

    if (inserted < wanted) {
      const remainder = clone(item);
      remainder.quantity = wanted - inserted;
      remainder.instanceId = inv.createInstanceId?.(remainder.definitionId || "item") || `${item.instanceId}_rest`;
      const second = inv.insertItem(player, remainder, fallback, options);
      inserted += Number(second.quantity || 0);
      receipts.push({ container: fallback, ...clone(second) });
    }
    return { inserted: inserted === wanted, insertedQuantity: inserted, wanted, receipts };
  }

  function grantInstancesToPlayerRecord(playerRecord = {}, items = [], options = {}) {
    const working = clone(playerRecord);
    const receipts = [];
    for (const raw of items || []) {
      const result = insertOneWithFallback(working, raw, options);
      receipts.push(result);
      if (!result.inserted) {
        return { granted: false, reason: result.receipts.at(-1)?.reason || "inventory_capacity_exceeded", player: clone(playerRecord), receipts };
      }
    }
    return { granted: true, reason: null, player: working, receipts };
  }

  async function grantLockedToPlayer(playerId, options = {}) {
    if (!state.preview?.locked) throw new Error("DM_LOOT_INSTANCE_MUST_BE_LOCKED");
    const db = dbFrom(options);
    if (!db?.ref) throw new Error("DM_LOOT_DATABASE_REQUIRED");
    const grantPath = `${ROOT}/${state.preview.lootInstanceId}/grants/${playerId}`;
    const priorGrant = await db.ref(grantPath).once("value");
    if (priorGrant.val()) throw new Error("DM_LOOT_ALREADY_GRANTED_TO_PLAYER");

    const snap = await db.ref(`campaña/jugadores/${playerId}`).once("value");
    const player = clone(snap.val() || {});
    const result = grantInstancesToPlayerRecord(player, state.preview.carried || [], { ownerId: playerId, preferredContainer: "stash" });
    if (!result.granted) return result;
    await db.ref(`campaña/jugadores/${playerId}`).update({
      inventario_stash: clone(result.player.inventario_stash || {}),
      inventario_activo: clone(result.player.inventario_activo || {}),
    });
    await db.ref(grantPath).set({
      playerId,
      lootInstanceId: state.preview.lootInstanceId,
      itemInstanceIds: (state.preview.carried || []).map((item) => item.instanceId),
      grantedAt: options.now ?? Date.now(),
    });
    return result;
  }

  async function grantLegacyTemplateDrops(options = {}) {
    const db = dbFrom(options);
    const playerId = clean(options.playerId);
    if (!db?.ref || !playerId) throw new Error("DM_LOOT_LEGACY_GRANT_TARGET_REQUIRED");
    const inv = inventoryRuntime();
    if (!inv?.createItemInstance) throw new Error("ITEM_INVENTORY_RUNTIME_REQUIRED");
    const snap = await db.ref(`campaña/jugadores/${playerId}`).once("value");
    const player = clone(snap.val() || {});
    const items = (options.items || []).map((entry, index) => {
      const definition = clone(entry.definition || entry.item || entry);
      const definitionId = normalizeId(entry.itemId || entry.definitionId || definition.id || definition.itemId);
      if (!definitionId) throw new Error("DM_LOOT_LEGACY_ITEM_ID_REQUIRED");
      definition.id = definition.id || definitionId;
      return inv.createItemInstance(definition, {
        quantity: Math.max(1, Number(entry.quantity || 1)),
        currentOwnerId: playerId,
        provenance: {
          acquisitionMethod: "dm_grant",
          sourceKind: "dm_custom_loot_template",
          templateId: normalizeId(options.templateId),
          grantIndex: index,
        },
      });
    });
    const result = grantInstancesToPlayerRecord(player, items, { ownerId: playerId, preferredContainer: "stash" });
    if (!result.granted) return result;
    await db.ref(`campaña/jugadores/${playerId}`).update({
      inventario_stash: clone(result.player.inventario_stash || {}),
      inventario_activo: clone(result.player.inventario_activo || {}),
    });
    return { ...result, items };
  }

  function renderSelectOptions(select, rows, placeholder, labelFn) {
    if (!select) return;
    select.innerHTML = `<option value="">${esc(placeholder)}</option>`
      + rows.map(([id, row]) => `<option value="${esc(id)}">${esc(labelFn(row, id))}</option>`).join("");
  }

  function renderOverrideList(doc = global.document) {
    const host = doc?.getElementById?.("dm-loot-override-list");
    if (!host) return;
    if (!state.overrideItems.length && !state.removeItemIds.length) {
      host.innerHTML = '<span style="color:#777">Sin overrides manuales.</span>';
      return;
    }
    const adds = state.overrideItems.map((entry, index) =>
      `<button type="button" class="dm-loot-chip" data-remove-add="${index}" style="border:1px solid #0df;background:#07161b;color:#bdf;padding:6px 9px;cursor:pointer;">+${esc(itemName(state.items[entry.itemId] || {}, entry.itemId))} ×${entry.quantity}</button>`
    );
    const removes = state.removeItemIds.map((id, index) =>
      `<button type="button" class="dm-loot-chip" data-remove-block="${index}" style="border:1px solid #f66;background:#1b0707;color:#fbb;padding:6px 9px;cursor:pointer;">−${esc(id)}</button>`
    );
    host.innerHTML = [...adds, ...removes].join(" ");
    host.querySelectorAll("[data-remove-add]").forEach((button) => button.addEventListener("click", () => {
      state.overrideItems.splice(Number(button.dataset.removeAdd), 1);
      renderOverrideList(doc);
    }));
    host.querySelectorAll("[data-remove-block]").forEach((button) => button.addEventListener("click", () => {
      state.removeItemIds.splice(Number(button.dataset.removeBlock), 1);
      renderOverrideList(doc);
    }));
  }

  function renderPreview(doc = global.document) {
    const unit = state.units[state.selectedUnitId] || {};
    const model = viewModel(unit, state.preview);
    const status = doc?.getElementById?.("dm-loot-status");
    const source = doc?.getElementById?.("dm-loot-source");
    const context = doc?.getElementById?.("dm-loot-context");
    const output = doc?.getElementById?.("dm-loot-output");
    const provenance = doc?.getElementById?.("dm-loot-provenance");
    const lockBtn = doc?.getElementById?.("dm-loot-lock");
    const regenBtn = doc?.getElementById?.("dm-loot-regenerate");
    const grantBtn = doc?.getElementById?.("dm-loot-grant");

    if (status) {
      status.textContent = !state.preview ? "Selecciona una Unit y genera una vista previa." : (model.locked ? "Loot finalizado · no se puede regenerar." : `Vista previa · generación ${state.preview.generation}`);
      status.style.color = model.locked ? "#77ff99" : "#0df";
    }
    if (lockBtn) lockBtn.disabled = !state.preview || model.locked;
    if (regenBtn) regenBtn.disabled = !state.preview || model.locked;
    if (grantBtn) grantBtn.disabled = !state.preview || !model.locked;

    if (source) source.innerHTML = unit.id ? [
      `<strong>${esc(model.unit.name)}</strong> <span style="color:#777">[${esc(model.unit.id)}]</span>`,
      `<div>Body: <b>${esc(model.unit.bodyKind || "—")}</b> · ${esc(model.unit.bodyMaterials.join(", ") || "—")}</div>`,
      `<div>Wealth: <b>${esc(model.unit.wealthBand || "—")}</b></div>`,
      `<div>Role: <b>${esc(model.unit.roles.join(", ") || "—")}</b></div>`,
    ].join("") : "Sin Unit seleccionada.";

    if (context) {
      const weights = Object.entries(model.context.weights || {}).filter(([, value]) => Number(value) !== 1).map(([key, value]) => `${key} ×${Number(value).toFixed(2)}`).join(", ");
      context.innerHTML = [
        `<div>Zone: <b>${esc(model.context.zone || "—")}</b></div>`,
        `<div>Events: <b>${esc(model.context.events.join(", ") || "—")}</b></div>`,
        `<div>Modifiers: ${esc(weights || "sin ajustes")}</div>`,
        `<div>Impossible: <span style="color:#f88">${esc(model.context.impossibleCategories.join(", ") || "—")}</span></div>`,
        `<div>Allowed by context: <span style="color:#8fd">${esc(model.context.allowedCategories.join(", ") || "—")}</span></div>`,
      ].join("");
    }

    if (output) {
      if (!state.preview) {
        output.innerHTML = '<div style="color:#777">Todavía no hay Loot Instance.</div>';
      } else {
        const carried = model.generated.carried.length
          ? model.generated.carried.map((item) => `<div class="dm-loot-row">• ${esc(item.displayName || item.name || item.definitionId)} ×${Number(item.quantity || 1)} ${model.locked ? "" : `<button type="button" data-exclude-item="${esc(item.definitionId)}" style="margin-left:8px;">Excluir</button>`}</div>`).join("")
          : '<div style="color:#777">Sin carried Items generados.</div>';
        const equipment = model.generated.equipment.length
          ? model.generated.equipment.map((item) => `<div>• ${esc(item.displayName || item.definitionId || item.weaponId || item.equipmentId || "Equipment")}</div>`).join("")
          : '<div style="color:#777">Sin equipment snapshot.</div>';
        const harvest = model.generated.harvest.length
          ? model.generated.harvest.map((res) => `<div>• ${esc(res.id)} · ${Number(res.remaining ?? res.capacity ?? 0)} · ${esc(res.integrity?.status || "unknown")}</div>`).join("")
          : '<div style="color:#777">Sin recursos de cuerpo.</div>';
        output.innerHTML = `
          <h5 style="color:#0df;margin:8px 0 4px;">Carried</h5>${carried}
          <h5 style="color:#c49a00;margin:10px 0 4px;">Equipment</h5>${equipment}
          <h5 style="color:#9f9;margin:10px 0 4px;">Currency</h5><div>${esc(model.generated.currency?.currencyId || "AHN").toUpperCase()} ${Number(model.generated.currency?.amount || 0).toLocaleString()}</div>
          <h5 style="color:#f9c;margin:10px 0 4px;">Corpse / Harvest</h5>${harvest}
        `;
        output.querySelectorAll("[data-exclude-item]").forEach((button) => button.addEventListener("click", () => {
          const id = normalizeId(button.dataset.excludeItem);
          if (id && !state.removeItemIds.includes(id)) state.removeItemIds.push(id);
          renderOverrideList(doc);
          regenerateAndRender(doc).catch(showError);
        }));
      }
    }

    if (provenance) {
      provenance.innerHTML = Object.entries(model.provenance).map(([key, value]) => `<div><span style="color:#777">${esc(key)}:</span> ${esc(value)}</div>`).join("") || "—";
    }
  }

  function showError(error) {
    const status = global.document?.getElementById?.("dm-loot-status");
    if (status) {
      status.textContent = clean(error?.message || error || "No se pudo completar la operación.");
      status.style.color = "#ff7777";
    }
  }

  async function previewAndRender(doc = global.document) {
    const unitId = normalizeId(doc?.getElementById?.("dm-loot-unit")?.value);
    const unit = state.units[unitId];
    if (!unit) throw new Error("Selecciona una Unit válida.");
    if (state.selectedUnitId !== unitId) resetPreview(unitId);
    generatePreview(unit, { document: doc });
    renderPreview(doc);
    return state.preview;
  }

  async function regenerateAndRender(doc = global.document) {
    const unit = state.units[state.selectedUnitId];
    if (!unit) throw new Error("Selecciona una Unit válida.");
    regeneratePreview(unit, { document: doc });
    renderPreview(doc);
    return state.preview;
  }

  async function lockAndRender(doc = global.document) {
    const unit = state.units[state.selectedUnitId];
    if (!unit) throw new Error("Selecciona una Unit válida.");
    await lockPreview(unit);
    renderPreview(doc);
    return state.preview;
  }

  async function grantAndRender(doc = global.document) {
    const playerId = clean(doc?.getElementById?.("dm-loot-player")?.value);
    if (!playerId) throw new Error("Selecciona un jugador destino.");
    const result = await grantLockedToPlayer(playerId);
    if (!result.granted) throw new Error("No hay espacio suficiente en Active Inventory / Stash.");
    const status = doc.getElementById("dm-loot-status");
    if (status) {
      status.textContent = `Items entregados a ${playerId} mediante Inventory Runtime.`;
      status.style.color = "#77ff99";
    }
    return result;
  }

  async function initializeData(doc = global.document) {
    await Promise.all([loadUnits(), loadPlayers()]);
    state.items = currentItems();
    renderSelectOptions(
      doc?.getElementById?.("dm-loot-unit"),
      Object.entries(state.units).sort((a,b) => unitName(a[1],a[0]).localeCompare(unitName(b[1],b[0]))),
      "Selecciona Unit...",
      unitName,
    );
    renderSelectOptions(
      doc?.getElementById?.("dm-loot-player"),
      Object.entries(state.players).sort((a,b) => clean(a[1]?.nombre || a[1]?.name || a[0]).localeCompare(clean(b[1]?.nombre || b[1]?.name || b[0]))),
      "Jugador destino...",
      (player,id) => clean(player.nombre || player.name || id),
    );
    renderSelectOptions(
      doc?.getElementById?.("dm-loot-override-item"),
      Object.entries(state.items).sort((a,b) => itemName(a[1],a[0]).localeCompare(itemName(b[1],b[0]))),
      "Añadir Item override...",
      itemName,
    );

    const encounter = encounterRuntime();
    const zone = doc?.getElementById?.("dm-loot-zone");
    if (zone && encounter?.ZONE_PROFILES) {
      zone.innerHTML = '<option value="">Neutral / authored</option>' + Object.keys(encounter.ZONE_PROFILES).sort().map((id) => `<option value="${esc(id)}">${esc(id.replaceAll("_"," "))}</option>`).join("");
    }
    const event = doc?.getElementById?.("dm-loot-event");
    if (event && encounter?.EVENT_PROFILES) {
      event.innerHTML = Object.keys(encounter.EVENT_PROFILES).sort().map((id) => `<option value="${esc(id)}">${esc(id.replaceAll("_"," "))}</option>`).join("");
    }
    renderOverrideList(doc);
    renderPreview(doc);
  }

  function install(doc = global.document) {
    if (state.installed || !doc?.getElementById?.("dm-loot-studio-app")) return false;
    state.installed = true;

    doc.getElementById("dm-loot-preview")?.addEventListener("click", () => previewAndRender(doc).catch(showError));
    doc.getElementById("dm-loot-regenerate")?.addEventListener("click", () => regenerateAndRender(doc).catch(showError));
    doc.getElementById("dm-loot-lock")?.addEventListener("click", () => lockAndRender(doc).catch(showError));
    doc.getElementById("dm-loot-grant")?.addEventListener("click", () => grantAndRender(doc).catch(showError));
    doc.getElementById("dm-loot-unit")?.addEventListener("change", (event) => {
      resetPreview(event.target.value);
      renderPreview(doc);
    });
    doc.getElementById("dm-loot-zone")?.addEventListener("change", () => {
      if (!state.preview?.locked) state.preview = null;
      renderPreview(doc);
    });
    doc.getElementById("dm-loot-event")?.addEventListener("change", () => {
      if (!state.preview?.locked) state.preview = null;
      renderPreview(doc);
    });
    doc.getElementById("dm-loot-add-override")?.addEventListener("click", () => {
      if (state.preview?.locked) return showError(new Error("El Loot Instance ya está finalizado."));
      const select = doc.getElementById("dm-loot-override-item");
      const quantityInput = doc.getElementById("dm-loot-override-qty");
      const itemId = normalizeId(select?.value);
      const quantity = Math.max(1, Number(quantityInput?.value || 1));
      if (!itemId) return showError(new Error("Selecciona un Item override."));
      const definition = state.items[itemId] || {};
      state.overrideItems.push({ itemId, quantity, category: categoryFor(definition) });
      if (quantityInput) quantityInput.value = "1";
      renderOverrideList(doc);
    });

    initializeData(doc).catch(showError);
    return true;
  }

  const API = Object.freeze({
    VERSION,
    ROOT,
    state,
    normalizeId,
    dbFrom,
    currentItems,
    categoryFor,
    loadUnits,
    loadPlayers,
    newSessionId,
    resetPreview,
    selectedEvents,
    selectedZone,
    overrides,
    buildGenerationOptions,
    generatePreview,
    regeneratePreview,
    lockPreview,
    provenanceRows,
    viewModel,
    insertOneWithFallback,
    grantInstancesToPlayerRecord,
    grantLockedToPlayer,
    grantLegacyTemplateDrops,
    renderOverrideList,
    renderPreview,
    previewAndRender,
    regenerateAndRender,
    lockAndRender,
    grantAndRender,
    initializeData,
    install,
  });

  global.LuminousDmLootStudio = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;

  if (global.document) {
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", () => install(global.document), { once: true });
    else install(global.document);
  }
})(typeof window !== "undefined" ? window : globalThis);
