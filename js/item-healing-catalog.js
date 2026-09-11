(function (global) {
  "use strict";

  const HP_ICON_GROUP = "healing_hp";
  const HP_ICON_URL = "https://imgur.com/GcnX53v.png";

  const HP_BANDS = Object.freeze({
    I: "10-30 HP",
    II: "20-60 HP",
    III: "50-100 HP",
    IV: "80-150 HP",
    V: "120-200+ HP",
  });

  const ROLE_CONFIG = Object.freeze({
    budget: {
      actionCost: "action",
      useCases: ["outside_combat", "self", "ally"],
      summary: "Best Ahn-per-HP option; intended for routine recovery when action economy is not the priority.",
    },
    standard: {
      actionCost: "action",
      useCases: ["combat", "outside_combat", "self", "ally"],
      summary: "Balanced recovery, price and burst for general inventory use.",
    },
    combat: {
      actionCost: "quick_action",
      useCases: ["combat", "self", "ally"],
      summary: "Pays a premium for Quick Action access during combat planning.",
    },
    rescue: {
      actionCost: "action",
      useCases: ["combat", "outside_combat", "ally", "critical_recovery"],
      summary: "Highest burst in its Tier; expensive but attractive when an ally is close to defeat.",
    },
  });

  function makeItem({ id, name, tier, hp, priceAhn, role, description }) {
    const roleConfig = ROLE_CONFIG[role];
    if (!roleConfig) throw new Error(`Unknown healing role: ${role}`);
    const tierNumber = ["I", "II", "III", "IV", "V"].indexOf(tier) + 1;
    return Object.freeze({
      canonicalId: `item:${id}`,
      definitionId: `item:${id}`,
      displayName: name,
      nombre: name,
      category: "consumable",
      tipo_categoria: "consumable",
      subtype: "medical",
      tier,
      tierNumber,
      function: ["use"],
      iconGroup: HP_ICON_GROUP,
      priceAhn,
      valorBase: priceAhn,
      tags: ["healing_hp", "medical", `tier_${tierNumber}`, role, "ally_targetable"],
      description,
      descripcion: description,
      runtime: {
        actionCost: roleConfig.actionCost,
        targetMode: "self_or_target",
        consumeQty: 1,
        effects: {
          hpRestore: hp,
        },
      },
      consumable_details: {
        curacion_hp: hp,
        curacion_sp: 0,
        action_cost: roleConfig.actionCost,
      },
      design: {
        batch: "hp_healing_v1",
        role,
        hpRestore: hp,
        hpBand: HP_BANDS[tier],
        useCases: [...roleConfig.useCases],
        purchaseRationale: roleConfig.summary,
        ahnPerHp: Math.round(priceAhn / hp),
        currency: "Ahn",
      },
    });
  }

  const ITEMS = Object.freeze([
    makeItem({
      id: "coagulant_gauze_patch_i",
      name: "Coagulant Gauze Patch I",
      tier: "I",
      hp: 5,
      priceAhn: 1000,
      role: "budget",
      description: "Cheap pressure dressing with coagulant mesh. Low burst, excellent value for routine wounds and post-combat recovery.",
    }),
    makeItem({
      id: "basic_recovery_ampoule_i",
      name: "Basic Recovery Ampoule I",
      tier: "I",
      hp: 8,
      priceAhn: 2400,
      role: "standard",
      description: "Entry-grade medical ampoule for ordinary trauma. A practical carry item for low-HP personnel.",
    }),
    makeItem({
      id: "snapdose_injector_i",
      name: "SnapDose Injector I",
      tier: "I",
      hp: 6,
      priceAhn: 3500,
      role: "combat",
      description: "Fast injector designed for immediate field use. Less efficient per Ahn, but preserves the user's main Action Slot.",
    }),
    makeItem({
      id: "field_trauma_pack_i",
      name: "Field Trauma Pack I",
      tier: "I",
      hp: 10,
      priceAhn: 5000,
      role: "rescue",
      description: "Compact trauma bundle meant to stabilize a badly injured low-HP ally in one use.",
    }),

    makeItem({
      id: "clotfoam_cartridge_ii",
      name: "ClotFoam Cartridge II",
      tier: "II",
      hp: 12,
      priceAhn: 6000,
      role: "budget",
      description: "Expanding clotting foam for affordable field treatment. Efficient between encounters and useful on allies.",
    }),
    makeItem({
      id: "recovery_ampoule_ii",
      name: "Recovery Ampoule II",
      tier: "II",
      hp: 16,
      priceAhn: 9000,
      role: "standard",
      description: "Reliable mid-grade recovery ampoule with enough output to matter for trained combatants.",
    }),
    makeItem({
      id: "redline_injector_ii",
      name: "Redline Injector II",
      tier: "II",
      hp: 14,
      priceAhn: 12000,
      role: "combat",
      description: "Quick-deploy injector for combat planning. Premium pricing trades efficiency for tempo.",
    }),
    makeItem({
      id: "rescue_medpack_ii",
      name: "Rescue Medpack II",
      tier: "II",
      hp: 20,
      priceAhn: 16000,
      role: "rescue",
      description: "High-output Tier II medpack for pulling an ally away from a dangerous HP threshold.",
    }),

    makeItem({
      id: "hemostatic_nanogel_iii",
      name: "Hemostatic Nanogel III",
      tier: "III",
      hp: 24,
      priceAhn: 22000,
      role: "budget",
      description: "Dense regenerative gel sold as a cost-effective solution for sustained expedition recovery.",
    }),
    makeItem({
      id: "regeneration_ampoule_iii",
      name: "Regeneration Ampoule III",
      tier: "III",
      hp: 32,
      priceAhn: 30000,
      role: "standard",
      description: "Professional recovery ampoule balancing cost, inventory value and meaningful mid-combat healing.",
    }),
    makeItem({
      id: "rapid_recovery_injector_iii",
      name: "Rapid Recovery Injector III",
      tier: "III",
      hp: 28,
      priceAhn: 42000,
      role: "combat",
      description: "Fast-action medical injector for agents who cannot afford to spend their primary action on treatment.",
    }),
    makeItem({
      id: "trauma_stabilizer_iii",
      name: "Trauma Stabilizer III",
      tier: "III",
      hp: 40,
      priceAhn: 55000,
      role: "rescue",
      description: "Heavy single-use stabilizer with enough recovery to change the outcome of an ally rescue.",
    }),

    makeItem({
      id: "synth_tissue_sealant_iv",
      name: "Synth-Tissue Sealant IV",
      tier: "IV",
      hp: 45,
      priceAhn: 75000,
      role: "budget",
      description: "Industrial synthetic tissue sealant. Expensive in absolute terms, but efficient for high-HP personnel outside combat.",
    }),
    makeItem({
      id: "regeneration_ampoule_iv",
      name: "Regeneration Ampoule IV",
      tier: "IV",
      hp: 60,
      priceAhn: 100000,
      role: "standard",
      description: "High-grade recovery ampoule intended for veteran agents with large HP pools.",
    }),
    makeItem({
      id: "priority_combat_injector_iv",
      name: "Priority Combat Injector IV",
      tier: "IV",
      hp: 50,
      priceAhn: 135000,
      role: "combat",
      description: "Premium rapid injector. Sacrifices Ahn efficiency for a substantial Quick Action recovery window.",
    }),
    makeItem({
      id: "critical_care_pack_iv",
      name: "Critical Care Pack IV",
      tier: "IV",
      hp: 75,
      priceAhn: 180000,
      role: "rescue",
      description: "Critical-care bundle built for major trauma and high-value ally recovery.",
    }),

    makeItem({
      id: "corp_grade_regenerator_v",
      name: "Corp-Grade Regenerator V",
      tier: "V",
      hp: 80,
      priceAhn: 250000,
      role: "budget",
      description: "Bulk corporate regenerative compound. The most economical Tier V option for repeated recovery between fights.",
    }),
    makeItem({
      id: "hyper_regeneration_ampoule_v",
      name: "Hyper-Regeneration Ampoule V",
      tier: "V",
      hp: 100,
      priceAhn: 325000,
      role: "standard",
      description: "Top-grade medical ampoule capable of restoring a meaningful fraction of a 200 HP veteran's health.",
    }),
    makeItem({
      id: "emergency_reconstruction_injector_v",
      name: "Emergency Reconstruction Injector V",
      tier: "V",
      hp: 90,
      priceAhn: 450000,
      role: "combat",
      description: "Extremely expensive Quick Action reconstruction dose for emergencies where action tempo is worth more than money.",
    }),
    makeItem({
      id: "full_trauma_reconstructor_v",
      name: "Full Trauma Reconstructor V",
      tier: "V",
      hp: 125,
      priceAhn: 650000,
      role: "rescue",
      description: "Maximum-burst medical system in the first catalog. Intended to save a severely wounded high-HP ally, not for routine topping off.",
    }),
  ]);

  const byId = new Map(ITEMS.map((item) => [item.canonicalId, item]));

  const api = Object.freeze({
    version: 1,
    batchId: "hp_healing_v1",
    iconGroup: HP_ICON_GROUP,
    iconUrl: HP_ICON_URL,
    hpBands: HP_BANDS,
    items: ITEMS,
    get(id) {
      const key = String(id || "").startsWith("item:") ? String(id) : `item:${id}`;
      return byId.get(key) || null;
    },
    listByTier(tier) {
      return ITEMS.filter((item) => item.tier === String(tier || "").toUpperCase());
    },
    listByRole(role) {
      return ITEMS.filter((item) => item.design.role === String(role || "").toLowerCase());
    },
  });

  global.LuminousItemHealingCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
