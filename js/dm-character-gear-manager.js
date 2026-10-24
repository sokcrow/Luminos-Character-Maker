/* DM inventory modal: equip actual inventory instances or surgically install Augments. */
(function (global) {
  "use strict";
  const doc = global.document;
  if (!doc || global.LuminousDmCharacterGearManager) return;
  const state = { db: null, playerId: "", player: null, ref: null, listener: null, busy: false };
  const core = () => global.LuminousDmCharacterGearCore;
  const bridge = () => global.LuminousItemEquipmentBridge;
  const augment = () => global.LuminousItemAugmentationRuntime;
  const clean = value => String(value == null ? "" : value).trim();
  const installed = () => augment()?.installedAugments?.(state.player || {})?.value || [];
  const byId = value => doc.getElementById(value);

  function playerIdFromModal() {
    const text = clean(byId("modal-inv-titulo")?.textContent);
    const match = text.match(/Inventario\s+de:\s*(.+)$/i);
    return match ? clean(match[1]) : "";
  }
  function friendly(reason) {
    const messages = {
      required_body_part_unavailable: "La parte corporal necesaria no está disponible.",
      required_body_part_type_unavailable: "El personaje no tiene suficientes partes corporales compatibles.",
      body_part_substrate_incompatible: "El material o tejido corporal no admite este Augment.",
      augmentation_already_installed: "Este Augment ya está instalado.",
      augmentation_not_removable: "Este Augment es permanente y no se puede extraer.",
      equipment_assignment_failed: "La anatomía o el equipo actual impiden equipar ese objeto.",
      bound_item_unequip_locked: "Este objeto está vinculado y no puede desequiparse.",
      incompatible_equipment_slot: "El espacio elegido no es compatible con este objeto."
    };
    return messages[reason] || reason;
  }
  function say(message, error) {
    const node = byId("dm-gear-feedback");
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = error ? "error" : "success";
    node.setAttribute("role", error ? "alert" : "status");
  }

  async function requireScript(id, url, name) {
    if (global[name]) return;
    let element = byId(id);
    if (!element) {
      element = doc.createElement("script");
      element.id = id;
      element.src = url;
      element.async = false;
      doc.head.appendChild(element);
    }
    if (global[name]) return;
    await new Promise((resolve, reject) => {
      element.addEventListener("load", resolve, { once: true });
      element.addEventListener("error", reject, { once: true });
    });
    if (!global[name]) throw new Error("No se pudo iniciar el motor de equipamiento");
  }
  let depsPromise = null;
  function dependencies() {
    if (!depsPromise) depsPromise = (async () => {
      await requireScript("dm-gear-item-runtime", "js/item-runtime-engine.js", "LuminousItemRuntime");
      await requireScript("dm-gear-inventory-runtime", "js/item-inventory-runtime.js", "LuminousItemInventoryRuntime");
      await requireScript("dm-gear-anatomy", "js/anatomy-equipment-engine.js", "LuminousAnatomyEquipmentEngine");
      await requireScript("dm-gear-augments", "js/item-augmentation-runtime.js", "LuminousItemAugmentationRuntime");
      await requireScript("dm-gear-magic", "js/item-magic-runtime.js", "LuminousItemMagicRuntime");
      await requireScript("dm-gear-bridge", "js/item-equipment-bridge.js", "LuminousItemEquipmentBridge");
    })().catch(error => { depsPromise = null; throw error; });
    return depsPromise;
  }

  function option(select, text, value) {
    const el = doc.createElement("option");
    el.textContent = text;
    el.value = value;
    select.appendChild(el);
  }
  function itemName(item) { return core()?.labelOf(item) || "Objeto"; }
  function resetOptions(select, placeholder) {
    const old = select.value;
    select.replaceChildren();
    option(select, placeholder, "");
    return old;
  }
  function inventoryOptions() {
    const select = byId("dm-gear-item");
    if (!select) return;
    const old = resetOptions(select, "Elegir objeto del inventario activo");
    const bag = state.player?.inventario_activo || {};
    Object.entries(bag).forEach(([key, item]) => {
      if (!item || !bridge()?.compatibleSlots?.(item)?.some(slot => !slot.startsWith("augment"))) return;
      option(select, itemName(item), key);
    });
    if ([...select.options].some(o => o.value === old)) select.value = old;
    changeItem();
  }
  function changeItem() {
    const bag = state.player?.inventario_activo || {};
    const item = bag[byId("dm-gear-item")?.value];
    const select = byId("dm-gear-slot");
    if (!select) return;
    const old = resetOptions(select, "Elegir espacio");
    const names = { mainHand: "Mano principal", offHand: "Mano secundaria", armor: "Armadura",
      accessory0: "Accesorio 1", accessory1: "Accesorio 2" };
    (bridge()?.compatibleSlots?.(item || {}) || [])
      .filter(slot => Object.prototype.hasOwnProperty.call(names, slot))
      .forEach(slot => option(select, names[slot], slot));
    if ([...select.options].some(o => o.value === old)) select.value = old;
    byId("dm-gear-equip").disabled = !item || !select.options.length || select.options.length < 2;
  }

  function renderSlots() {
    const host = byId("dm-gear-equipped");
    if (!host) return;
    host.replaceChildren();
    const refs = state.player?.itemEquipmentRefs || {};
    const bag = state.player?.inventario_activo || {};
    const resolve = id => Object.values(bag).find(i => core()?.idOf(i) === clean(id)) || null;
    const slots = [["mainHand", "Mano principal"], ["offHand", "Mano secundaria"],
      ["armor", "Armadura"], ["accessory0", "Accesorio 1"], ["accessory1", "Accesorio 2"]];
    slots.forEach(([slot, label]) => {
      const id = slot.startsWith("accessory") ? (refs.accessoryIds || [])[Number(slot.slice(-1))] : refs[slot];
      const item = resolve(id);
      const row = doc.createElement("div"); row.className = "dm-gear-slot-row";
      const name = doc.createElement("span");
      name.textContent = label + ": " + (item ? itemName(item) : id ? "Sin objeto válido" : "Vacío");
      row.appendChild(name);
      if (item) {
        const btn = doc.createElement("button");btn.type = "button";
        btn.textContent = "Quitar";btn.dataset.unequip = slot;btn.disabled = state.busy;
        row.appendChild(btn);
      }
      host.appendChild(row);
    });
  }

  function renderAugments() {
    const select = byId("dm-gear-augment-item");
    const host = byId("dm-gear-augments");
    if (!select || !host) return;
    const old = resetOptions(select, "Elegir Augment para instalar");
    for (const [source, bag] of [["active", state.player?.inventario_activo || {}],
      ["stash", state.player?.inventario_stash || {}]]) {
      Object.entries(bag).forEach(([key, item]) => {
        if (item && augment()?.isAugmentation?.(item)) option(select, itemName(item) + (source === "stash" ? " · Alijo" : " · Inventario"), source + "|" + key);
      });
    }
    if ([...select.options].some(o => o.value === old)) select.value = old;
    byId("dm-gear-install").disabled = state.busy || !select.value;
    host.replaceChildren();
    const augments = installed();
    if (!augments.length) {
      const empty = doc.createElement("p");
      empty.textContent = "El personaje no tiene Augments instalados.";
      host.appendChild(empty);
    }
    augments.forEach(item => {
      const row = doc.createElement("div");row.className = "dm-gear-slot-row";
      const name = doc.createElement("span");
      name.textContent = itemName(item) + " · Instalado" +
        (item.installedBodyPartIds?.length ? " · " + item.installedBodyPartIds.length + " zona(s)" : "");
      row.appendChild(name);
      const btn = doc.createElement("button");btn.type = "button";
      btn.textContent = "Extraer";btn.dataset.extract = core()?.idOf(item) || "";
      btn.disabled = state.busy || !btn.dataset.extract ||
        augment()?.canRemoveAugment?.(state.player, item)?.allowed !== true;
      if (btn.disabled) btn.title = "La extracción está prohibida por las reglas del Augment";
      row.appendChild(btn);
      host.appendChild(row);
    });
  }

  function render() {
    const name = byId("dm-gear-player");
    if (name) name.textContent = state.playerId
      ? "Equipamiento de " + clean(state.player?.characterName || state.player?.nombre || state.player?.name || state.playerId)
      : "Elige un personaje";
    inventoryOptions();renderSlots();renderAugments();
    const busy = state.busy || !state.player;
    for (const id of ["dm-gear-item","dm-gear-slot","dm-gear-augment-item"])
      if (byId(id)) byId(id).disabled = busy;
    if (byId("dm-gear-equip")) byId("dm-gear-equip").disabled = busy || !byId("dm-gear-item")?.value || !byId("dm-gear-slot")?.value;
    if (byId("dm-gear-install")) byId("dm-gear-install").disabled = busy || !byId("dm-gear-augment-item")?.value;
    byId("dm-gear-equipped")?.querySelectorAll("button").forEach(button => button.disabled = busy);
  }

  function subscribe() {
    const id = playerIdFromModal();
    if (!id || id === state.playerId) return;
    if (!global.firebase?.database) return;
    if (state.listener && state.ref) state.ref.off("value", state.listener);
    state.playerId = id;
    state.player = null;
    state.db = global.firebase.database();
    state.ref = state.db.ref("campaña/jugadores/" + id);
    state.listener = snap => { state.player = snap.val() || null;render(); };
    state.ref.on("value", state.listener);
    say("Cargando equipamiento del personaje…");
  }

  async function apply(command) {
    if (state.busy || !state.playerId || !state.ref) return;
    state.busy = true;render();
    const id = state.playerId;
    try {
      await dependencies();
      if (command.type === "install") command.at = Date.now();
      let last = null;
      // A single Firebase transaction changes both the carried inventory and
      // the installed/body equipment. There is no half-installed Augment.
      const tx = await state.ref.transaction(current => {
        last = core().apply(current, command, {
          equipment: bridge(), augmentation: augment(), inventory: global.LuminousItemInventoryRuntime
        });
        return last.ok ? last.unit : undefined;
      }, undefined, false);
      if (!tx.committed) throw new Error(friendly(last?.reason || "No se pudo confirmar el cambio"));
      if (id === state.playerId) say(last?.label || "Cambios guardados en el personaje");
    } catch (error) {
      if (id === state.playerId) say(friendly(error.message || "No se pudo guardar el equipamiento"), true);
    } finally {
      state.busy = false;render();
    }
  }

  function mount() {
    const body = doc.querySelector("#modal-inventario-dm .modal-body");
    if (!body || byId("dm-character-gear-manager")) return;
    const link = doc.createElement("link");link.rel = "stylesheet";link.href = "css/dm-character-gear-manager.css?v=20261024-1";
    doc.head.appendChild(link);
    const section = doc.createElement("section");
    section.id = "dm-character-gear-manager";
    section.innerHTML = [
      '<header><h3>EQUIPAR PERSONAJE</h3><p id="dm-gear-player">Elige un personaje</p></header>',
      '<div class="dm-gear-panels">',
      '<div class="dm-gear-panel"><h4>Armas, armaduras y accesorios</h4>',
      '<p>Los objetos equipados continúan siendo propiedad del personaje.</p>',
      '<label>Objeto<select id="dm-gear-item"></select></label>',
      '<label>Espacio<select id="dm-gear-slot"></select></label>',
      '<button id="dm-gear-equip" type="button">Equipar</button>',
      '<div id="dm-gear-equipped" aria-label="Equipamiento actual"></div></div>',
      '<div class="dm-gear-panel"><h4>Augments instalados</h4>',
      '<p>Instalar retira el Augment del inventario y lo vincula a la anatomía. No es un accesorio.</p>',
      '<label>Augment<select id="dm-gear-augment-item"></select></label>',
      '<button id="dm-gear-install" type="button">Instalar en el cuerpo</button>',
      '<div id="dm-gear-augments" aria-label="Augments instalados"></div></div></div>',
      '<p id="dm-gear-feedback" role="status" aria-live="polite">Selecciona un jugador para comenzar.</p>'
    ].join("");
    body.appendChild(section);
    byId("dm-gear-item").addEventListener("change", changeItem);
    byId("dm-gear-augment-item").addEventListener("change", renderAugments);
    byId("dm-gear-equip").addEventListener("click", () => apply({
      type: "equip", key: byId("dm-gear-item").value, slot: byId("dm-gear-slot").value
    }));
    byId("dm-gear-install").addEventListener("click", () => {
      const [source, ...key] = byId("dm-gear-augment-item").value.split("|");
      if (!source || !key.length) return;
      if (global.confirm && !global.confirm("Este Augment dejará de estar en la mochila y quedará instalado en el cuerpo del personaje. ¿Confirmar instalación?")) return;
      apply({ type: "install", source, key: key.join("|") });
    });
    section.addEventListener("click", event => {
      const remove = event.target.closest("[data-unequip]");
      const extract = event.target.closest("[data-extract]");
      if (remove) apply({type:"unequip",slot:remove.dataset.unequip});
      else if (extract && global.confirm?.("¿Extraer el Augment e intentar devolverlo al inventario activo?"))
        apply({type:"remove",key:extract.dataset.extract});
    });
    doc.addEventListener("click", event => {
      if (event.target.closest?.(".btn-ver-inventario")) global.setTimeout(subscribe, 0);
    }, true);
    const title = byId("modal-inv-titulo");
    if (title && global.MutationObserver)
      new MutationObserver(subscribe).observe(title,{childList:true,characterData:true,subtree:true});
    dependencies().then(() => {subscribe();render();}).catch(error=>say(error.message,true));
    render();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded",mount,{once:true});
  else mount();
  global.LuminousDmCharacterGearManager = Object.freeze({ state, mount, subscribe, render });
})(typeof globalThis !== "undefined" ? globalThis : window);
