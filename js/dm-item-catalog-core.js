(function (global) {
  "use strict";

  if (global.LuminousDmItemCatalogCore) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousDmItemCatalogCore;
    return;
  }

  const VERSION = 1;
  const DEFAULT_ICON = "Assets/Icons/items/fallback/generic_item.png";
  const CATALOG_NAME_RE = /^Luminous.*(?:Item|Weapon|Armor|Shield|Ammo|Food|Meat|Healing|Medical|Medicinal|Chemical|Material|Component|Tool|Jewelry|Valuable|Ore|Ingot|Gem|Hide|Pelt|Organ|Blood|Ichor|Venom|Ooze|Essence|Plant|Produce|Feather|Upgrade|Throwable|Culinary|Retail|Ranged|Firearm|StatusCure|HardParts|ScaleShellChitin).*Catalog$/;
  const RECIPE_CATALOG_NAME_RE = /RecipeCatalog$/i;
  const STACK_VARIANT_FIELDS = Object.freeze([
    "stackable", "stackPolicy", "family", "group", "category", "itemType", "quality", "iconFamily", "icon_family",
    "size", "sizeId", "lineageId", "lineageName",
    "culinaryProperties", "culinaryAffinities", "culinaryAffinityProfileId", "affinityTarget", "affinityBranch",
    "processedForm", "processingMethod", "processingMethodId", "processingTemplateId", "templateId",
    "recipeId", "dishFamily", "mealFocus", "stars", "taste", "sp", "culinaryEffects", "freshness",
    "materialId", "materialIds", "materialChoices", "composition", "combatGrade", "ammoGrade", "caliber",
    "ammoType", "projectileType", "payload", "profile", "ammoProfile", "reinforced", "upgradeIds",
    "durability", "maxDurability", "available", "spent", "destroyed",
    "sourceLine", "sourceInstanceId", "sourceEntityId", "originCreatureType", "originCreatureId",
    "originRaceId", "originSubtypeId", "provenance",
    "unitValueAhn", "totalValueAhn", "productionValueAhn", "productionValue", "retailValueAhn"
  ]);

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

  const PRICE_FIELDS = Object.freeze([
    "productionValueAhn",
    "productionValue",
    "createdProductionValueAhn",
    "standardProductionValueAhn",
    "craftBaseValueAhn",
    "cookedBaseValueAhn",
    "totalValueAhn",
    "standardMediumValueAhn",
    "mediumStandardValueAhn",
    "standardUnitValueAhn",
    "standardValueAhn",
    "standardChassisValueAhn",
    "unitValueAhn",
    "baseValueAhn",
    "baseMundaneValueAhn",
    "enchantmentBaseValueAhn",
    "roughValueAhn",
    "priceAhn",
    "retailValueAhn",
    "valorBase",
    "costo",
    "price"
  ]);

  function priceOf(item) {
    for (const field of PRICE_FIELDS) {
      const raw = item && item[field];
      if (raw == null || raw === "") continue;
      const number = Number(raw);
      // Zero in legacy price/costo/valorBase is frequently a placeholder.
      // Prefer the first authored positive canonical value instead.
      if (Number.isFinite(number) && number > 0) return Math.round(number);
    }
    return 0;
  }

  function positivePriceOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
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
      price: positivePriceOr(raw.price, price),
      costo: positivePriceOr(raw.costo, price),
      valorBase: positivePriceOr(raw.valorBase, price),
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

    ["ITEMS", "DEFINITIONS", "PARTS", "COMPONENTS", "UPGRADES"].forEach((field) => {
      add(api && api[field]);
    });

    ["list", "listParts", "listSimpleCookedDefinitions", "listRetailCookieDefinitions"].forEach((method) => {
      if (!api || typeof api[method] !== "function") return;
      try { add(api[method]({})); } catch (_) {
        try { add(api[method]()); } catch (_) {}
      }
    });

    return rows;
  }

  function catalogNamespace(source) {
    return normalizeId(
      clean(source || "catalog")
        .replace(/^Luminous/, "")
        .replace(/Catalog$/, "")
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    ) || "catalog";
  }

  function collectCatalogMap(root, options) {
    const host = root || global;
    const iconRegistry = options && options.iconRegistry || host.LuminousItemIconRegistry;
    const buckets = new Map();

    Object.keys(host)
      .filter((key) => CATALOG_NAME_RE.test(key) && !RECIPE_CATALOG_NAME_RE.test(key))
      .sort()
      .forEach((key) => {
        const api = host[key];
        rowsFromCatalog(api).forEach((row) => {
          const adapted = adaptDefinition(row, { source: key, iconRegistry: iconRegistry });
          const id = definitionIdOf(adapted);
          if (!id) return;

          const bucket = buckets.get(id) || [];
          const duplicateIndex = bucket.findIndex((entry) =>
            entry.__catalogSource === key && sameDefinition(entry, adapted)
          );
          if (duplicateIndex >= 0) {
            bucket[duplicateIndex] = Object.assign({}, bucket[duplicateIndex], adapted);
          } else {
            bucket.push(adapted);
          }
          buckets.set(id, bucket);
        });
      });

    const map = {};
    buckets.forEach((rows, id) => {
      if (rows.length === 1) {
        map[id] = Object.assign({}, rows[0], { __catalogKey: id });
        return;
      }

      rows.forEach((row, index) => {
        const baseKey = catalogNamespace(row.__catalogSource) + "__" + id;
        let catalogKey = baseKey;
        let suffix = 2;
        while (map[catalogKey]) {
          catalogKey = baseKey + "__" + suffix;
          suffix += 1;
        }
        map[catalogKey] = Object.assign({}, row, {
          __catalogKey: catalogKey,
          __canonicalCollisionId: id,
          __canonicalCollisionIndex: index
        });
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
      const targetKey = out[key] ? key : id;
      const canonical = out[targetKey] || {};
      out[targetKey] = adaptDefinition(Object.assign({}, canonical, row, {
        id: row.id || canonical.id || targetKey,
        definitionId: row.definitionId || canonical.definitionId || id
      }), {
        fallbackId: id,
        source: row.__catalogSource || "firebase",
        iconRegistry: iconRegistry
      });
      out[targetKey].__catalogKey = targetKey;
    });

    return out;
  }

  function buildCatalogMap(root, firebaseItems, options) {
    return mergeFirebaseItems(collectCatalogMap(root || global, options), firebaseItems || {}, options);
  }

  function stableNormalize(value) {
    if (Array.isArray(value)) return value.map(stableNormalize);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce((out, key) => {
      if (value[key] !== undefined) out[key] = stableNormalize(value[key]);
      return out;
    }, {});
  }

  function normalizedVariantData(item) {
    const source = item || {};
    const out = {};
    const nested = source.variantData || source.variant_data || {};
    STACK_VARIANT_FIELDS.forEach((field) => {
      const value = source[field] !== undefined ? source[field] : nested[field];
      if (value !== undefined) out[field] = clone(value);
    });
    if (nested && typeof nested === "object") Object.assign(out, clone(nested));
    return out;
  }

  function stackVariantSignature(item) {
    const source = item || {};
    return JSON.stringify(stableNormalize({
      tier: clean(source.tier || "I").toLowerCase(),
      qualityTier: Number(source.qualityTier ?? source.quality_tier ?? 1) || 1,
      quality: normalizeId(source.quality || source.baseQuality || "standard"),
      condition: Number(source.condition ?? source.currentCondition ?? source.currentDurability ?? source.durability ?? 100),
      conditionMax: Number(source.conditionMax ?? source.maxCondition ?? source.maxDurability ?? 100),
      manufacturerId: clean(source.manufacturerId || source.manufacturer_id || ""),
      productLineId: clean(source.productLineId || source.product_line_id || ""),
      modelName: clean(source.modelName || source.model_name || ""),
      commissionName: clean(source.commissionName || source.commission_name || ""),
      installedModuleIds: asArray(source.installedModuleIds || source.installed_module_ids).map(String).sort(),
      installedModules: clone(source.installedModules || []),
      signatureTechnologyIds: asArray(source.signatureTechnologyIds || source.signature_technology_ids).map(String).sort(),
      signatureComponents: clone(source.signatureComponents || []),
      chargesCurrent: source.chargesCurrent ?? source.charges_current ?? source.charges ?? null,
      chargesMax: source.chargesMax ?? source.charges_max ?? source.maxCharges ?? null,
      rechargeRule: clone(source.rechargeRule || source.recharge_rule || null),
      stolen: source.stolen === true,
      runtimeState: clone(source.runtimeState || source.runtime_state || {}),
      customData: clone(source.customData || source.custom_data || {}),
      variantData: normalizedVariantData(source)
    }));
  }

  function sameDefinition(a, b) {
    const aid = definitionIdOf(a);
    const bid = definitionIdOf(b);
    const sameBase = aid && bid
      ? aid === bid
      : normalizeId(itemName(a)) === normalizeId(itemName(b));
    if (!sameBase) return false;
    return stackVariantSignature(a) === stackVariantSignature(b);
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
    CATALOG_NAME_RE,
    RECIPE_CATALOG_NAME_RE,
    PRICE_FIELDS,
    normalizeId,
    definitionIdOf,
    itemName,
    inferCategory,
    isItemDefinition,
    priceOf,
    resolveIcon,
    adaptDefinition,
    catalogNamespace,
    collectCatalogMap,
    mergeFirebaseItems,
    buildCatalogMap,
    normalizedVariantData,
    stackVariantSignature,
    sameDefinition,
    quantityOf,
    quantityPatch,
    createGrantPayload
  });

  global.LuminousDmItemCatalogCore = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
