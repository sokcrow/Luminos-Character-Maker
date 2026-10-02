(function (global) {
  "use strict";

  if (global.LuminousDmItemCatalogCore) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousDmItemCatalogCore;
    return;
  }

  const VERSION = 1;
  const DEFAULT_ICON = "Assets/Icons/items/fallback/generic_item.png";
  const CATALOG_NAME_RE = /^Luminous.*(?:Item|Weapon|Armor|Shield|Ammo|Food|Meat|Healing|Medical|Medicinal|Chemical|Material|Component|Tool|Jewelry|Valuable|Ore|Ingot|Gem|Hide|Pelt|Organ|Blood|Ichor|Venom|Ooze|Essence|Plant|Produce|Feather|Upgrade|Throwable|Culinary|Retail|Ranged|Firearm|StatusCure).*Catalog$/;

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
    return Array.isArray(value) ? value.slice() : [value];
  }

  function definitionIdOf(item, fallbackId) {
    return normalizeId(
      item && (item.definitionId || item.definition_id || item.canonicalId || item.itemId || item.item_id || item.id || item.key)
      || fallbackId
      || item && (item.nombre || item.name)
    );
  }

  function itemName(item, fallbackId) {
    return clean(item && (item.displayName || item.nombre || item.name || item.label)) || clean(fallbackId) || "Item";
  }

  function tagList(item) {
    const out = [];
    asArray(item && item.tags).forEach((tag) => out.push(clean(tag)));
    asArray(item && item.itemTags).forEach((tag) => out.push(clean(tag)));
    asArray(item && item.useTags).forEach((tag) => out.push(clean(tag)));
    if (typeof (item && item.tag) === "string") item.tag.split(/[|,]/).forEach((tag) => out.push(clean(tag)));
    return out.filter(Boolean);
  }

  function inferCategory(item) {
    const explicit = normalizeId(item && (item.category || item.tipo_categoria || item.itemType || item.item_type || item.kind || item.type));
    const family = normalizeId(item && (item.family || item.group || item.iconFamily || item.icon_family));
    const tags = tagList(item).map(normalizeId);
    const hay = [explicit, family].concat(tags).filter(Boolean);

    const has = (needle) => hay.some((value) => value === needle || value.indexOf(needle) !== -1);

    if (has("upgrade") || has("enhancement") || has("module")) return "upgrade";
    if (has("ammo") || has("ammunition") || has("munition") || has("projectile")) return "ammo";
    if (has("tool") || has("kit") || has("supplies") || has("utensils")) return "tool";
    if (has("consumable") || has("food") || has("medicine") || has("medical") || has("healing") || has("status_cure") || has("throwable") || has("ration") || has("drink")) return "consumable";
    if (has("component") || has("ingredient") || has("material") || has("ore") || has("ingot") || has("gem") || has("meat") || has("chemical") || has("reagent") || has("plant") || has("produce") || has("hide") || has("pelt") || has("organ") || has("blood") || has("ichor") || has("venom") || has("ooze") || has("essence") || has("feather") || has("fiber") || has("scrap")) return "material";
    if (has("augmentation") || has("augment")) return "augmentation";
    if (has("accessory") || has("jewelry") || has("valuable")) return "accessory";
    if (has("shield")) return "shield";
    if (has("armor")) return "armor";
    if (has("weapon") || has("sword") || has("dagger") || has("axe") || has("hammer") || has("spear") || has("bow") || has("crossbow") || has("rifle") || has("pistol") || has("shotgun") || has("revolver")) return "weapon";
    if (explicit === "utility") return "utility";
    return explicit || "item";
  }

  function isItemDefinition(item) {
    if (!item || typeof item !== "object") return false;
    const id = definitionIdOf(item);
    if (!id || !itemName(item, id)) return false;
    const category = inferCategory(item);
    if (category !== "item") return true;
    return Boolean(
      item.itemType || item.item_type || item.iconFamily || item.icon_family ||
      item.stackable !== undefined || item.standardValueAhn !== undefined ||
      item.standardChassisValueAhn !== undefined || item.unitValueAhn !== undefined ||
      item.retailValueAhn !== undefined || item.recipe
    );
  }

  function priceOf(item) {
    const candidates = [
      item && item.price,
      item && item.costo,
      item && item.valorBase,
      item && item.unitValueAhn,
      item && item.standardValueAhn,
      item && item.standardChassisValueAhn,
      item && item.retailValueAhn,
      item && item.baseValueAhn,
      item && item.productionValueAhn
    ];
    for (const value of candidates) {
      const number = Number(value);
      if (Number.isFinite(number)) return Math.round(number);
    }
    return 0;
  }

  function resolveIcon(item, registry, fallbackId) {
    const localExplicit = [item && item.icono, item && item.icon, item && item.image, item && item.img]
      .map(clean)
      .find((value) => value && !/^(?:https?:)?\/\//i.test(value) && !/^(?:data|blob):/i.test(value));
    if (localExplicit) return localExplicit;

    const iconRegistry = registry || global.LuminousItemIconRegistry;
    const candidates = [
      item && item.iconFamily,
      item && item.icon_family,
      item && item.weaponFamily,
      item && item.toolCategory,
      item && item.family,
      item && item.group,
      item && item.itemType,
      item && item.item_type,
      item && item.category,
      item && item.tipo_categoria,
      fallbackId,
      item && item.definitionId,
      item && item.id
    ].map(normalizeId).filter(Boolean);

    if (iconRegistry && iconRegistry.get && iconRegistry.resolveIcon) {
      for (const candidate of candidates) {
        const row = iconRegistry.get(candidate, { fallback: false });
        if (!row) continue;
        const icon = clean(iconRegistry.resolveIcon(row.id, { fallback: false }));
        if (icon) return icon;
      }
    }

    const externalExplicit = [item && item.icono, item && item.icon, item && item.image, item && item.img]
      .map(clean)
      .find(Boolean);
    return externalExplicit || DEFAULT_ICON;
  }

  function adaptDefinition(item, options) {
    options = options || {};
    const raw = clone(item) || {};
    const id = definitionIdOf(raw, options.fallbackId);
    const name = itemName(raw, id);
    const category = inferCategory(raw);
    const tags = Array.from(new Set(tagList(raw).concat([category]).map(clean).filter(Boolean)));
    const price = priceOf(raw);
    const tier = clean(raw.tier || raw.qualityTier || raw.baseQuality || "I") || "I";
    const icon = resolveIcon(raw, options.iconRegistry, id);

    return Object.assign({}, raw, {
      id: raw.id || id,
      definitionId: raw.definitionId || id,
      canonicalId: raw.canonicalId || id,
      nombre: raw.nombre || name,
      name: raw.name || name,
      category: category,
      tipo_categoria: category,
      tier: tier,
      tags: tags,
      price: raw.price !== undefined ? raw.price : price,
      costo: raw.costo !== undefined ? raw.costo : price,
      valorBase: raw.valorBase !== undefined ? raw.valorBase : price,
      icono: icon,
      icon: raw.icon || icon,
      __catalogSource: options.source || raw.__catalogSource || "canonical"
    });
  }

  function rowsFromCatalog(api) {
    const rows = [];
    const add = (value) => {
      if (!value) return;
      if (Array.isArray(value)) value.forEach(add);
      else if (typeof value === "object") {
        if (isItemDefinition(value)) rows.push(value);
        else Object.entries(value).forEach(([key, entry]) => {
          if (entry && typeof entry === "object" && isItemDefinition(Object.assign({ id: entry.id || key }, entry))) {
            rows.push(Object.assign({ id: entry.id || key }, entry));
          }
        });
      }
    };

    add(api && api.ITEMS);
    add(api && api.DEFINITIONS);

    ["list", "listSimpleCookedDefinitions", "listRetailCookieDefinitions"].forEach((method) => {
      if (!api || typeof api[method] !== "function") return;
      try { add(api[method]({})); } catch (_) {
        try { add(api[method]()); } catch (_) {}
      }
    });

    return rows;
  }

  function collectCatalogMap(root, options) {
    const host = root || global;
    const iconRegistry = options && options.iconRegistry || host.LuminousItemIconRegistry;
    const map = {};

    Object.keys(host).filter((key) => CATALOG_NAME_RE.test(key)).forEach((key) => {
      const api = host[key];
      rowsFromCatalog(api).forEach((row) => {
        const adapted = adaptDefinition(row, { source: key, iconRegistry: iconRegistry });
        const id = definitionIdOf(adapted);
        if (!id) return;
        map[id] = map[id] ? Object.assign({}, adapted, map[id]) : adapted;
      });
    });

    return map;
  }

  function mergeFirebaseItems(canonicalMap, firebaseItems, options) {
    const out = Object.assign({}, canonicalMap || {});
    const iconRegistry = options && options.iconRegistry || global.LuminousItemIconRegistry;

    Object.entries(firebaseItems || {}).forEach(([key, row]) => {
      if (!row || typeof row !== "object") return;
      const id = definitionIdOf(row, key);
      const canonical = out[id] || {};
      out[id] = adaptDefinition(Object.assign({}, canonical, row, {
        id: row.id || canonical.id || id,
        definitionId: row.definitionId || canonical.definitionId || id
      }), {
        fallbackId: id,
        source: row.__catalogSource || "firebase",
        iconRegistry: iconRegistry
      });
    });

    return out;
  }

  function buildCatalogMap(root, firebaseItems, options) {
    return mergeFirebaseItems(collectCatalogMap(root || global, options), firebaseItems || {}, options);
  }

  function sameDefinition(a, b) {
    const aid = definitionIdOf(a);
    const bid = definitionIdOf(b);
    if (aid && bid) return aid === bid;
    return normalizeId(itemName(a)) === normalizeId(itemName(b))
      && clean(a && a.tier || "I") === clean(b && b.tier || "I");
  }

  function quantityOf(item) {
    const value = Number(item && (item.quantity !== undefined ? item.quantity : item.cantidad));
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 1;
  }

  function quantityPatch(item, nextQuantity) {
    const next = Math.max(0, Math.trunc(Number(nextQuantity) || 0));
    return { quantity: next, cantidad: next };
  }

  function createGrantPayload(item, quantity, options) {
    options = options || {};
    const adapted = adaptDefinition(item, {
      fallbackId: definitionIdOf(item),
      source: item && item.__catalogSource || "dm_catalog",
      iconRegistry: options.iconRegistry
    });
    const qty = Math.max(1, Math.trunc(Number(quantity) || 1));
    const runtime = options.inventoryRuntime || global.LuminousItemInventoryRuntime;
    let instance = null;
    try {
      if (runtime && typeof runtime.createItemInstance === "function") {
        instance = runtime.createItemInstance(adapted, { quantity: qty });
      }
    } catch (_) {}

    return Object.assign({}, adapted, instance || {}, {
      id: adapted.id,
      definitionId: adapted.definitionId,
      canonicalId: adapted.canonicalId,
      nombre: adapted.nombre,
      name: adapted.name,
      category: adapted.category,
      tipo_categoria: adapted.tipo_categoria,
      iconFamily: adapted.iconFamily || adapted.icon_family || null,
      icono: adapted.icono,
      icon: adapted.icon,
      tags: adapted.tags,
      price: adapted.price,
      costo: adapted.costo,
      valorBase: adapted.valorBase,
      quantity: qty,
      cantidad: qty
    });
  }

  const API = Object.freeze({
    VERSION,
    DEFAULT_ICON,
    normalizeId,
    definitionIdOf,
    itemName,
    inferCategory,
    isItemDefinition,
    priceOf,
    resolveIcon,
    adaptDefinition,
    collectCatalogMap,
    mergeFirebaseItems,
    buildCatalogMap,
    sameDefinition,
    quantityOf,
    quantityPatch,
    createGrantPayload
  });

  global.LuminousDmItemCatalogCore = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
