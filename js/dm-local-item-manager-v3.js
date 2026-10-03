(function (global) {
  "use strict";

  if (global.LuminousDmLocalItemManagerV3) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousDmLocalItemManagerV3;
    return;
  }

  const VERSION = 3;
  const DEFAULT_ICON = "Assets/Icons/items/fallback/generic_item.png";
  const CATALOG_NAME_RE = /^Luminous.*Catalog$/;
  const RECIPE_NAME_RE = /RecipeCatalog$/i;
  const FIELD_HINTS = [
    "ITEMS", "DEFINITIONS", "PARTS", "COMPONENTS", "UPGRADES", "TOOLS",
    "AMMO", "MATERIALS", "EQUIPMENT", "ENTRIES", "CATALOG"
  ];
  const PRICE_FIELDS = [
    "price", "costo", "valorBase", "priceAhn", "unitValueAhn", "standardUnitValueAhn",
    "standardValueAhn", "standardChassisValueAhn", "mediumStandardValueAhn",
    "retailValueAhn", "baseValueAhn", "productionValueAhn", "productionValue"
  ];

  const state = {
    mounted: false,
    items: new Map(),
    localKeys: new Set(),
    cards: new Map(),
    selectedKey: "",
    players: new Map(),
    firebaseBound: false,
    searchBound: false,
    activeFilter: "todo",
    firebaseRetry: null
  };

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clean = (value) => String(value == null ? "" : value).trim();
  const normalizeId = (value) => clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  function asArray(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  }

  function definitionIdOf(item, fallbackId) {
    return normalizeId(
      item && (
        item.definitionId || item.definition_id || item.canonicalId ||
        item.itemId || item.item_id || item.id || item.key
      ) || fallbackId || item && (item.nombre || item.name || item.label)
    );
  }

  function itemName(item, fallbackId) {
    return clean(item && (item.displayName || item.nombre || item.name || item.label)) || clean(fallbackId) || "Item";
  }

  function tagList(item) {
    const out = [];
    ["tags", "itemTags", "useTags", "recipeRoles", "flavorTags", "functionalTags", "craftTags", "materialTags"].forEach((field) => {
      asArray(item && item[field]).forEach((tag) => {
        const value = clean(tag);
        if (value) out.push(value);
      });
    });
    if (typeof (item && item.tag) === "string") {
      item.tag.split(/[|,]/).forEach((tag) => {
        const value = clean(tag);
        if (value) out.push(value);
      });
    }
    return Array.from(new Set(out));
  }

  function inferCategory(item) {
    const explicit = normalizeId(item && (
      item.category || item.tipo_categoria || item.itemType || item.item_type ||
      item.kind || item.type
    ));
    const family = normalizeId(item && (
      item.family || item.group || item.iconFamily || item.icon_family ||
      item.weaponFamily || item.toolCategory
    ));
    const hay = [explicit, family, ...tagList(item).map(normalizeId)].filter(Boolean);
    const has = (needle) => hay.some((value) => value === needle || value.includes(needle));

    if (has("upgrade") || has("enhancement") || has("module")) return "upgrade";
    if (has("ammo") || has("ammunition") || has("munition") || has("projectile")) return "ammo";
    if (has("tool") || has("kit") || has("supplies") || has("utensil")) return "tool";
    if (has("shield")) return "shield";
    if (has("armor")) return "armor";
    if (has("weapon") || has("sword") || has("dagger") || has("axe") || has("hammer") ||
        has("spear") || has("bow") || has("crossbow") || has("rifle") || has("pistol") ||
        has("shotgun") || has("revolver")) return "weapon";
    if (has("accessory") || has("jewelry") || has("valuable")) return "accessory";
    if (has("consumable") || has("food") || has("medicine") || has("medical") ||
        has("healing") || has("status_cure") || has("throwable") || has("ration") ||
        has("drink")) return "consumable";
    if (has("component") || has("ingredient") || has("material") || has("ore") ||
        has("ingot") || has("gem") || has("meat") || has("chemical") || has("reagent") ||
        has("plant") || has("produce") || has("hide") || has("pelt") || has("organ") ||
        has("blood") || has("ichor") || has("venom") || has("ooze") || has("essence") ||
        has("feather") || has("fiber") || has("scrap")) return "material";
    if (has("augmentation") || has("augment")) return "augmentation";
    return explicit || "item";
  }

  function priceOf(item) {
    for (const field of PRICE_FIELDS) {
      const value = Number(item && item[field]);
      if (Number.isFinite(value)) return Math.round(value);
    }
    return 0;
  }

  function rowLooksLikeItem(row) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return false;
    const id = definitionIdOf(row);
    const name = itemName(row, id);
    if (!id || !name) return false;
    const hints = [
      row.category, row.tipo_categoria, row.itemType, row.item_type, row.family,
      row.group, row.iconFamily, row.icon_family, row.weaponFamily, row.toolCategory,
      row.stackable, row.purchasable, row.sourceLine, row.recipeRoles, row.tags
    ];
    return hints.some((value) => value !== undefined && value !== null) ||
      PRICE_FIELDS.some((field) => row[field] !== undefined);
  }

  function resolveIcon(item, fallbackId) {
    const explicit = [item && item.icono, item && item.icon, item && item.image, item && item.img]
      .map(clean)
      .find(Boolean);
    if (explicit) return explicit;

    const registry = global.LuminousItemIconRegistry;
    if (registry && registry.get && registry.resolveIcon) {
      const candidates = [
        item && item.iconFamily,
        item && item.icon_family,
        item && item.weaponFamily,
        item && item.toolCategory,
        item && item.family,
        item && item.group,
        item && item.category,
        fallbackId,
        item && item.id
      ].map(normalizeId).filter(Boolean);

      for (const candidate of candidates) {
        try {
          const found = registry.get(candidate, { fallback: false });
          if (!found) continue;
          const icon = clean(registry.resolveIcon(found.id, { fallback: false }));
          if (icon) return icon;
        } catch (_) {}
      }
    }
    return DEFAULT_ICON;
  }

  function normalizeDefinition(raw, options) {
    const source = options && options.source || "local";
    const fallbackId = options && options.fallbackId || "";
    const item = clone(raw) || {};
    const definitionId = definitionIdOf(item, fallbackId);
    if (!definitionId) return null;
    const nombre = itemName(item, definitionId);
    const category = inferCategory(item);
    const tags = Array.from(new Set([...tagList(item), category]));
    const tier = clean(item.tier || item.qualityTier || item.baseQuality || "I") || "I";
    const price = priceOf(item);
    const icon = resolveIcon(item, definitionId);

    return Object.assign({}, item, {
      id: item.id || definitionId,
      definitionId,
      canonicalId: item.canonicalId || definitionId,
      nombre,
      name: item.name || nombre,
      category,
      tipo_categoria: category,
      tags,
      tier,
      price: item.price !== undefined ? item.price : price,
      costo: item.costo !== undefined ? item.costo : price,
      valorBase: item.valorBase !== undefined ? item.valorBase : price,
      icono: icon,
      icon: item.icon || icon,
      __dmSource: source
    });
  }

  function extractRows(api, sourceName) {
    const rows = [];
    const seen = new WeakSet();

    function inspect(value, fallbackKey, depth) {
      if (!value || depth > 3) return;
      if (Array.isArray(value)) {
        value.forEach((entry, index) => inspect(entry, fallbackKey || String(index), depth + 1));
        return;
      }
      if (typeof value !== "object") return;
      if (seen.has(value)) return;
      seen.add(value);

      if (rowLooksLikeItem(value)) {
        const row = normalizeDefinition(value, { source: sourceName, fallbackId: fallbackKey });
        if (row) rows.push(row);
        return;
      }

      Object.entries(value).forEach(([key, entry]) => {
        if (typeof entry === "function") return;
        inspect(entry, key, depth + 1);
      });
    }

    FIELD_HINTS.forEach((field) => inspect(api && api[field], "", 0));

    if (api && typeof api === "object") {
      Object.entries(api).forEach(([key, value]) => {
        if (FIELD_HINTS.includes(key) || typeof value === "function") return;
        if (Array.isArray(value) || (value && typeof value === "object" && key === key.toUpperCase())) {
          inspect(value, key, 0);
        }
      });

      Object.entries(api).forEach(([key, fn]) => {
        if (typeof fn !== "function" || !/^list/i.test(key)) return;
        try { inspect(fn.call(api), "", 0); } catch (_) {
          try { inspect(fn.call(api, {}), "", 0); } catch (_) {}
        }
      });
    }

    return rows;
  }

  function collectLocalItems(host) {
    const root = host || global;
    const collected = new Map();

    Object.keys(root)
      .filter((key) => CATALOG_NAME_RE.test(key) && !RECIPE_NAME_RE.test(key))
      .sort()
      .forEach((sourceName) => {
        const api = root[sourceName];
        extractRows(api, sourceName).forEach((row) => {
          const baseKey = row.definitionId;
          const existing = collected.get(baseKey);
          if (!existing) {
            collected.set(baseKey, row);
            return;
          }

          const sameMeaning =
            normalizeId(existing.nombre) === normalizeId(row.nombre) &&
            existing.category === row.category;
          if (sameMeaning) {
            const richer = Object.keys(row).length > Object.keys(existing).length ? row : existing;
            collected.set(baseKey, richer);
            return;
          }

          let key = normalizeId(sourceName) + "__" + baseKey;
          let suffix = 2;
          while (collected.has(key)) {
            key = normalizeId(sourceName) + "__" + baseKey + "__" + suffix;
            suffix += 1;
          }
          collected.set(key, row);
        });
      });

    return collected;
  }

  function itemSignature(item) {
    if (!item) return "";
    return JSON.stringify({
      id: item.definitionId,
      name: item.nombre,
      category: item.category,
      tier: item.tier,
      price: item.price,
      icon: item.icono,
      tags: item.tags
    });
  }

  function itemObject() {
    const out = {};
    state.items.forEach((item, key) => {
      out[key] = item;
    });
    return out;
  }

  function syncCompatibilityCache() {
    global.dbItemsCache = itemObject();
  }

  function escapeHtml(value) {
    return clean(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function cardFor(key, item) {
    const card = global.document.createElement("div");
    card.className = "card-cyber card-item";
    card.dataset.dmItemKey = key;
    card.style.cursor = "pointer";
    card.addEventListener("click", () => selectItem(key));
    updateCard(card, key, item);
    return card;
  }

  function updateCard(card, key, item) {
    card.dataset.name = clean(item.nombre).toLowerCase();
    card.dataset.tier = clean(item.tier).toLowerCase();
    card.dataset.tags = [...(item.tags || []), item.category || ""].map((value) => clean(value).toLowerCase()).join(",");
    card.dataset.category = clean(item.category).toLowerCase();
    card.innerHTML = `
      <img src="${escapeHtml(resolveIcon(item, item.definitionId || key))}" alt="${escapeHtml(item.nombre)}">
      <h5>${escapeHtml(item.nombre)}</h5>
      <span style="font-size:0.8em;color:#aaa;">${escapeHtml((item.tags || []).join(", ") || item.category || "item")}</span>
      <span style="color:#0df;font-weight:bold;"><span class="currency-symbol">₳</span> ${Number(item.price || item.costo || 0).toLocaleString()}</span>
    `;
  }

  function upsertCard(key, item) {
    const grid = global.document && global.document.getElementById("grid-items-globales");
    if (!grid) return;
    let card = state.cards.get(key);
    if (!card) {
      card = cardFor(key, item);
      state.cards.set(key, card);
      grid.appendChild(card);
    } else {
      updateCard(card, key, item);
    }
  }

  function removeCard(key) {
    const card = state.cards.get(key);
    if (card) card.remove();
    state.cards.delete(key);
    if (state.selectedKey === key) {
      state.selectedKey = "";
      const title = global.document && global.document.getElementById("consumo-item-nombre");
      const details = global.document && global.document.getElementById("consumo-item-detalles");
      if (title) title.textContent = "Selecciona un Ítem";
      if (details) details.textContent = "Selecciona un ítem del directorio local para otorgarlo.";
    }
  }

  function renderAll() {
    if (!global.document) return;
    const grid = global.document.getElementById("grid-items-globales");
    if (!grid) return;
    const fragment = global.document.createDocumentFragment();
    state.cards.clear();

    [...state.items.entries()]
      .sort((a, b) => clean(a[1].nombre).localeCompare(clean(b[1].nombre)))
      .forEach(([key, item]) => {
        const card = cardFor(key, item);
        state.cards.set(key, card);
        fragment.appendChild(card);
      });

    grid.replaceChildren(fragment);
    applyFilter();
    populateLootSelect();
    syncCompatibilityCache();
  }

  function updateSummary() {
    if (!global.document) return;
    const status = global.document.getElementById("dm-item-catalog-status");
    const summary = global.document.getElementById("dm-content-registry-counts");
    const visible = [...state.cards.values()].filter((card) => card.style.display !== "none").length;
    if (status) status.textContent = visible + " / " + state.items.size + " Items locales visibles · listo";
    if (summary) summary.textContent = state.items.size + " Items locales · carga directa · Firebase no bloquea";
  }

  function applyFilter() {
    if (!global.document) return;
    const search = global.document.getElementById("buscador-items-dm");
    const query = clean(search && search.value).toLowerCase();
    let visible = 0;

    state.cards.forEach((card) => {
      const matchesText =
        !query ||
        (card.dataset.name || "").includes(query) ||
        (card.dataset.tier || "").includes(query) ||
        (card.dataset.tags || "").includes(query);
      const matchesCategory =
        state.activeFilter === "todo" ||
        (card.dataset.category || "") === state.activeFilter ||
        (card.dataset.tags || "").includes(state.activeFilter);
      const show = matchesText && matchesCategory;
      card.style.display = show ? "flex" : "none";
      if (show) visible += 1;
    });

    const status = global.document.getElementById("dm-item-catalog-status");
    if (status) status.textContent = visible + " / " + state.items.size + " Items locales visibles · listo";
  }

  function bindSearchAndFilters() {
    if (!global.document || state.searchBound) return;
    state.searchBound = true;
    const search = global.document.getElementById("buscador-items-dm");
    if (search) search.addEventListener("input", applyFilter);

    global.document.querySelectorAll("#filtros-dm .dm-filter-btn").forEach((button) => {
      button.addEventListener("click", () => {
        global.document.querySelectorAll("#filtros-dm .dm-filter-btn").forEach((node) => node.classList.remove("active"));
        button.classList.add("active");
        state.activeFilter = clean(button.dataset.filter || "todo").toLowerCase();
        applyFilter();
      });
    });
  }

  function selectItem(key) {
    const item = state.items.get(key);
    if (!item || !global.document) return;
    state.selectedKey = key;

    const title = global.document.getElementById("consumo-item-nombre");
    const details = global.document.getElementById("consumo-item-detalles");
    if (title) title.textContent = item.nombre;
    if (details) {
      details.innerHTML =
        "<strong>Tipo:</strong> " + escapeHtml(item.category || "item") +
        " &nbsp; <strong>Tier:</strong> " + escapeHtml(item.tier || "I") +
        " &nbsp; <strong>ID:</strong> " + escapeHtml(item.definitionId || key) +
        "<br><strong>Tags:</strong> " + escapeHtml((item.tags || []).join(", ") || "—");
    }

    const panel = global.document.getElementById("panel-consumo-item");
    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function populateLootSelect() {
    if (!global.document) return;
    const select = global.document.getElementById("loot-select-item");
    if (!select) return;
    const current = select.value;
    const fragment = global.document.createDocumentFragment();
    const first = global.document.createElement("option");
    first.value = "";
    first.textContent = "Selecciona Ítem Local...";
    fragment.appendChild(first);

    [...state.items.entries()]
      .sort((a, b) => clean(a[1].nombre).localeCompare(clean(b[1].nombre)))
      .forEach(([key, item]) => {
        const option = global.document.createElement("option");
        option.value = key;
        option.textContent = item.nombre + " [" + (item.category || "item") + " · " + (item.tier || "I") + "]";
        fragment.appendChild(option);
      });

    select.replaceChildren(fragment);
    if (current && state.items.has(current)) select.value = current;
  }

  function refreshPlayersSelect() {
    if (!global.document) return;
    const select = global.document.getElementById("otorgar-item-jugador");
    if (!select) return;
    const current = select.value;
    select.replaceChildren();
    const first = global.document.createElement("option");
    first.value = "";
    first.textContent = "Seleccionar Jugador Destino...";
    select.appendChild(first);

    [...state.players.keys()].sort().forEach((playerId) => {
      const data = state.players.get(playerId) || {};
      const option = global.document.createElement("option");
      option.value = playerId;
      option.textContent = clean(data.nombre || data.name || playerId) || playerId;
      select.appendChild(option);
    });
    if (current && state.players.has(current)) select.value = current;
  }

  function quantityOf(item) {
    return Math.max(0, Math.trunc(Number(item && (item.quantity ?? item.cantidad ?? item.qty ?? item.count ?? 1)) || 0));
  }

  function makeGrantPayload(item, quantity, playerId) {
    const runtime = global.LuminousItemInventoryRuntime;
    let instance = null;
    if (runtime && typeof runtime.createItemInstance === "function") {
      try {
        instance = runtime.createItemInstance(item, {
          quantity,
          qualityTier: Number(item.qualityTier || 1) || 1,
          currentOwnerId: playerId
        });
      } catch (_) {}
    }

    const payload = Object.assign({}, clone(item), instance || {});
    payload.definitionId = definitionIdOf(payload, item.definitionId);
    payload.nombre = item.nombre || item.name || payload.definitionId;
    payload.name = item.name || item.nombre || payload.nombre;
    payload.quantity = quantity;
    payload.cantidad = quantity;
    payload.currentOwnerId = playerId;
    delete payload.__dmSource;
    return payload;
  }

  function canStack(a, b) {
    const runtime = global.LuminousItemInventoryRuntime;
    if (runtime && typeof runtime.canStack === "function") {
      try { return runtime.canStack(a, b); } catch (_) {}
    }
    return definitionIdOf(a) === definitionIdOf(b) &&
      clean(a && a.tier || "I") === clean(b && b.tier || "I");
  }

  async function grantSelected(containerName) {
    if (!global.document) return;
    const item = state.items.get(state.selectedKey);
    const playerSelect = global.document.getElementById("otorgar-item-jugador");
    const qtyInput = global.document.getElementById("otorgar-item-cant");
    const playerId = clean(playerSelect && playerSelect.value);
    const quantity = Math.max(1, Math.trunc(Number(qtyInput && qtyInput.value) || 1));

    if (!item) {
      global.alert && global.alert("Selecciona un ítem.");
      return;
    }
    if (!playerId) {
      global.alert && global.alert("Selecciona un jugador destino.");
      return;
    }
    if (!global.firebase || !global.firebase.apps || !global.firebase.apps.length) {
      global.alert && global.alert("Firebase todavía no está listo para escribir el inventario.");
      return;
    }

    const db = global.firebase.database();
    const containerRef = db.ref("campaña/jugadores/" + playerId + "/" + containerName);
    const payload = makeGrantPayload(item, quantity, playerId);
    const snapshot = await containerRef.once("value");
    const current = snapshot.val() || {};
    let stackKey = "";

    Object.entries(current).some(([key, existing]) => {
      if (!existing || !canStack(existing, payload)) return false;
      stackKey = key;
      return true;
    });

    if (stackKey) {
      await containerRef.child(stackKey).transaction((existing) => {
        if (!existing) return payload;
        const next = Object.assign({}, existing);
        const total = quantityOf(existing) + quantity;
        next.quantity = total;
        next.cantidad = total;
        next.currentOwnerId = playerId;
        return next;
      });
    } else {
      const pushed = containerRef.push();
      if (!payload.instanceId) payload.instanceId = pushed.key;
      await pushed.set(payload);
    }

    const destination = containerName === "inventario_activo" ? "Inventario Activo" : "Alijo";
    global.alert && global.alert(item.nombre + " x" + quantity + " → " + destination + " de " + playerId);
  }

  function bindGrantButtons() {
    if (!global.document) return;
    const stash = global.document.getElementById("btn-otorgar-stash");
    const active = global.document.getElementById("btn-otorgar-activo");
    if (stash && stash.dataset.dmItemManagerV3Bound !== "1") {
      stash.dataset.dmItemManagerV3Bound = "1";
      stash.addEventListener("click", () => grantSelected("inventario_stash").catch((error) => {
        console.error("DM item grant failed:", error);
        global.alert && global.alert("No se pudo otorgar el ítem: " + (error && error.message || error));
      }));
    }
    if (active && active.dataset.dmItemManagerV3Bound !== "1") {
      active.dataset.dmItemManagerV3Bound = "1";
      active.addEventListener("click", () => grantSelected("inventario_activo").catch((error) => {
        console.error("DM active item grant failed:", error);
        global.alert && global.alert("No se pudo equipar el ítem: " + (error && error.message || error));
      }));
    }
  }

  function applyFirebaseItem(pathName, key, raw) {
    const catalogKey = "firebase__" + normalizeId(pathName) + "__" + normalizeId(key);
    if (!raw) {
      state.items.delete(catalogKey);
      removeCard(catalogKey);
      syncCompatibilityCache();
      updateSummary();
      populateLootSelect();
      return;
    }

    const item = normalizeDefinition(raw, { source: pathName, fallbackId: key });
    if (!item) return;
    item.__firebasePath = pathName;
    item.__firebaseKey = key;
    state.items.set(catalogKey, item);
    upsertCard(catalogKey, item);
    syncCompatibilityCache();
    applyFilter();
    populateLootSelect();
  }

  function bindFirebase() {
    if (state.firebaseBound) return true;
    if (!global.firebase || !global.firebase.apps || !global.firebase.apps.length) return false;
    state.firebaseBound = true;

    const db = global.firebase.database();
    const playersRef = db.ref("campaña/jugadores");
    playersRef.on("child_added", (snapshot) => {
      state.players.set(snapshot.key, snapshot.val() || {});
      refreshPlayersSelect();
    });
    playersRef.on("child_changed", (snapshot) => {
      state.players.set(snapshot.key, snapshot.val() || {});
      refreshPlayersSelect();
    });
    playersRef.on("child_removed", (snapshot) => {
      state.players.delete(snapshot.key);
      refreshPlayersSelect();
    });

    [
      "campaña/base_datos_items",
      "campaña/base_datos_aumentos"
    ].forEach((pathName) => {
      const ref = db.ref(pathName);
      ref.on("child_added", (snapshot) => applyFirebaseItem(pathName, snapshot.key, snapshot.val()));
      ref.on("child_changed", (snapshot) => applyFirebaseItem(pathName, snapshot.key, snapshot.val()));
      ref.on("child_removed", (snapshot) => applyFirebaseItem(pathName, snapshot.key, null));
    });

    return true;
  }

  function ensureFirebaseBindings() {
    if (bindFirebase()) return;
    if (state.firebaseRetry) return;
    state.firebaseRetry = global.setInterval(() => {
      if (bindFirebase()) {
        global.clearInterval(state.firebaseRetry);
        state.firebaseRetry = null;
      }
    }, 500);
  }

  function refreshLocal() {
    const next = collectLocalItems(global);
    const previousLocalKeys = new Set(state.localKeys);
    const nextLocalKeys = new Set(next.keys());

    previousLocalKeys.forEach((key) => {
      if (nextLocalKeys.has(key)) return;
      state.items.delete(key);
      state.localKeys.delete(key);
      removeCard(key);
    });

    next.forEach((item, key) => {
      const previous = state.items.get(key);
      state.items.set(key, item);
      state.localKeys.add(key);
      if (!state.mounted) return;
      if (!previous || itemSignature(previous) !== itemSignature(item)) upsertCard(key, item);
    });

    syncCompatibilityCache();
    if (state.mounted) {
      applyFilter();
      populateLootSelect();
      updateSummary();
    }
    return itemObject();
  }

  function mount() {
    if (!global.document) return false;
    refreshLocal();
    bindSearchAndFilters();
    bindGrantButtons();
    renderAll();
    ensureFirebaseBindings();
    state.mounted = true;

    global.addEventListener("luminous:item-definition-changed", refreshLocal);
    global.addEventListener("luminous:item-catalog-changed", refreshLocal);
    return true;
  }

  function getItem(keyOrDefinitionId) {
    if (state.items.has(keyOrDefinitionId)) return clone(state.items.get(keyOrDefinitionId));
    const wanted = normalizeId(keyOrDefinitionId);
    for (const item of state.items.values()) {
      if (item.definitionId === wanted) return clone(item);
    }
    return null;
  }

  function snapshot() {
    return Object.freeze({
      version: VERSION,
      ready: true,
      mounted: state.mounted,
      count: state.items.size,
      items: Object.freeze(itemObject())
    });
  }

  const API = Object.freeze({
    version: VERSION,
    collectLocalItems,
    normalizeDefinition,
    refreshLocal,
    mount,
    selectItem,
    grantSelected,
    getItem,
    getItemsObject: itemObject,
    snapshot,
    ownsCatalog: () => true
  });

  global.LuminousDmLocalItemManagerV3 = API;

  if (global.document) {
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", mount, { once: true });
    } else {
      mount();
    }
  }

  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
