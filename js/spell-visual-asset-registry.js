(function (global) {
  "use strict";

  if (global.LuminousSpellVisualAssetRegistry) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousSpellVisualAssetRegistry;
    return;
  }

  const VERSION = 1;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  const ASSETS = Object.freeze({
    // Status icons
    illusion: Object.freeze({
      id: "illusion", kind: "status", path: "Assets/Icons/status/cantrips/illusion.png",
      tags: Object.freeze(["spell", "cantrip", "status", "positive", "minor_illusion"])
    }),
    blade_guard: Object.freeze({
      id: "blade_guard", kind: "status", path: "Assets/Icons/status/cantrips/blade_guard.png",
      tags: Object.freeze(["spell", "cantrip", "status", "positive", "blade_ward"])
    }),
    sword_burst: Object.freeze({
      id: "sword_burst", kind: "status", path: "Assets/Icons/status/cantrips/blade_guard.png",
      tags: Object.freeze(["spell", "cantrip", "status", "positive", "sword_burst"]),
      sharesAssetWith: "blade_guard"
    }),
    dancing_light: Object.freeze({
      id: "dancing_light", kind: "status", path: "Assets/Icons/status/cantrips/dancing_light.png",
      tags: Object.freeze(["spell", "cantrip", "status", "positive", "dancing_lights"])
    }),
    light: Object.freeze({
      id: "light", kind: "status", path: "Assets/Icons/status/cantrips/light.png",
      tags: Object.freeze(["spell", "cantrip", "status", "positive", "light"])
    }),
    guidance: Object.freeze({
      id: "guidance", kind: "status", path: "Assets/Icons/status/cantrips/guidance.png",
      tags: Object.freeze(["spell", "cantrip", "status", "positive", "guidance"])
    }),
    resistance: Object.freeze({
      id: "resistance", kind: "status", path: "Assets/Icons/status/cantrips/resistance.png",
      tags: Object.freeze(["spell", "cantrip", "status", "positive", "resistance"])
    }),
    booming: Object.freeze({
      id: "booming", kind: "status", path: "Assets/Icons/status/cantrips/booming.png",
      tags: Object.freeze(["spell", "cantrip", "status", "negative", "booming_blade"])
    }),
    shillelagh: Object.freeze({
      id: "shillelagh", kind: "status", path: "Assets/Icons/status/cantrips/shillelagh.png",
      tags: Object.freeze(["spell", "cantrip", "status", "positive", "shillelagh"])
    }),

    // Spell-created Units
    infestation: Object.freeze({
      id: "infestation", kind: "spell_unit", path: "Assets/Images/SpellUnits/infestation.png",
      unitKind: "summon", tags: Object.freeze(["spell", "cantrip", "unit", "summon", "infestation"])
    }),
    create_bonfire: Object.freeze({
      id: "create_bonfire", kind: "spell_unit", path: "Assets/Images/SpellUnits/bonfire.png",
      unitKind: "summon", tags: Object.freeze(["spell", "cantrip", "unit", "summon", "bonfire", "create_bonfire"])
    }),
    produce_flame: Object.freeze({
      id: "produce_flame", kind: "spell_unit", path: "Assets/Images/SpellUnits/produce_flame.png",
      unitKind: "background_unit", tags: Object.freeze(["spell", "cantrip", "unit", "background_unit", "produce_flame"])
    }),
    mage_hand: Object.freeze({
      id: "mage_hand", kind: "spell_unit", path: "Assets/Images/SpellUnits/mage_hand.png",
      unitKind: "background_unit", tags: Object.freeze(["spell", "cantrip", "unit", "background_unit", "mage_hand"])
    }),

    // Spell-created Items. Item icons still resolve through the item icon registry.
    thought_strand: Object.freeze({
      id: "thought_strand", kind: "item", path: "Assets/Icons/items/utility/thought_strand.png",
      iconFamily: "thought_strand", tags: Object.freeze(["spell", "cantrip", "item", "temporary_item", "encode_thoughts", "thought_strand"])
    }),
    magic_stone: Object.freeze({
      id: "magic_stone", kind: "item", path: "Assets/Icons/items/resource/ammo.png",
      iconFamily: "ammo", reuseExisting: true,
      tags: Object.freeze(["spell", "cantrip", "item", "temporary_item", "ammo", "sling_ammo", "magic_stone"])
    })
  });

  const ALIASES = Object.freeze({
    bonfire: "create_bonfire",
    dancing_lights: "dancing_light",
    minor_illusion: "illusion",
    blade_ward: "blade_guard",
    encode_thoughts: "thought_strand"
  });

  function canonicalId(value) {
    const id = normalizeId(value);
    return ALIASES[id] || id;
  }

  function get(value) {
    const entry = ASSETS[canonicalId(value)];
    return entry ? clone(entry) : null;
  }

  function resolve(value, options = {}) {
    const entry = get(value);
    if (!entry) return null;
    if (entry.kind === "item" && entry.iconFamily) {
      const itemRegistry = global.LuminousItemIconRegistry;
      const itemPath = itemRegistry?.resolveIcon?.(entry.iconFamily, { fallback: false });
      if (itemPath) return itemPath;
    }
    return entry.path || options.fallback || null;
  }

  function list(options = {}) {
    const kind = normalizeId(options.kind || "");
    const tag = normalizeId(options.tag || "");
    return Object.values(ASSETS)
      .filter((entry) => !kind || normalizeId(entry.kind) === kind)
      .filter((entry) => !tag || entry.tags.some((value) => normalizeId(value) === tag))
      .map(clone);
  }

  function byKind(kind) { return list({ kind }); }
  function byTag(tag) { return list({ tag }); }
  function has(value) { return Boolean(ASSETS[canonicalId(value)]); }

  const api = Object.freeze({
    VERSION, ASSETS, ALIASES,
    normalizeId, canonicalId, has, get, resolve, list, byKind, byTag
  });

  global.LuminousSpellVisualAssetRegistry = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
