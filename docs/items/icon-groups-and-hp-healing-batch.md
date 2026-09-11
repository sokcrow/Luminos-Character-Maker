# Item icon groups + HP Healing Batch V1

This document defines the first canonical visual grouping contract for Luminous items and the first authored batch of HP healing consumables.

## Why grouped icons

Most consumables, materials and generic loot do not need one unique illustration per ItemDefinition. Item identity stays in the ItemDefinition; the visual family is selected through `iconGroup`.

Resolution order is:

1. `iconOverride` / legacy explicit icon when an item genuinely needs unique art.
2. `iconGroup` shared art.
3. Category/subtype inference.
4. `generic_item` fallback.

Changing one URL in `LuminousItemIconRegistry` therefore updates the whole family without editing every ItemDefinition.

## Canonical icon groups

### Recovery and consumables

| Group | Asset |
| --- | --- |
| `healing_hp` | https://imgur.com/GcnX53v.png |
| `healing_sp` | https://imgur.com/LCpKGIH.png |
| `healing_hybrid` | https://imgur.com/DrIZie0.png |
| `status_cure` | https://imgur.com/17tJuSM.png |
| `buff_consumable` | https://imgur.com/9wGle81.png |
| `poison_consumable` | https://imgur.com/VsWisJQ.png |
| `consumable_other` | https://imgur.com/1RZqDFI.png |
| `medical_supply` | https://imgur.com/CrWqqZh.png |
| `throwable` | https://imgur.com/3w2YnUX.png |

### Food and survival

| Group | Asset |
| --- | --- |
| `food_meat` | https://imgur.com/uFmUpuD.png |
| `ration` | https://imgur.com/6yDrI9e.png |
| `drink` | https://imgur.com/Tf3bZPM.png |

### Scrap, crafting and materials

| Group | Asset |
| --- | --- |
| `scrap_mechanical` | https://imgur.com/IrtN5aS.png |
| `electronic_parts` | https://imgur.com/wTNk2Te.png |
| `precision_component` | https://imgur.com/8684d59.png |
| `circuitry` | https://imgur.com/FfDiki6.png |
| `chemical` | https://imgur.com/MvbtE4u.png |
| `textile` | https://imgur.com/4gr0EeJ.png |
| `hide_leather` | https://imgur.com/nK6vQIR.png |
| `ore_mineral` | https://imgur.com/Pwm1Idx.png |
| `organic_material` | https://imgur.com/lqQbJds.png |
| `plant_herb` | https://imgur.com/DucSfXD.png |
| `bone_horn` | https://imgur.com/fUEV5vu.png |
| `organ_gland` | https://imgur.com/rXlXbOG.png |
| `toxin_material` | https://imgur.com/4kqV4TO.png |
| `abnormality_part` | https://imgur.com/JpK4vSq.png |
| `craft_component` | https://imgur.com/exU9uZ1.png |

### Resources and utility

| Group | Asset |
| --- | --- |
| `ammo` | https://imgur.com/gFEZebC.png |
| `energy_cell` | https://imgur.com/32d4YwR.png |
| `fuel` | https://imgur.com/mOsNK1L.png |
| `repair_kit` | https://imgur.com/OZdAHys.png |
| `tool` | https://imgur.com/rGCFKQD.png |
| `key_access` | https://imgur.com/trjsYlm.png |
| `document` | https://imgur.com/Mx8Vwn9.png |
| `data_storage` | https://imgur.com/9vCVQL4.png |
| `valuable` | https://imgur.com/XhS73M2.png |
| `relic` | https://imgur.com/WfXrRoE.png |
| `quest_item` | https://imgur.com/eLUFiXE.png |
| `generic_item` | https://imgur.com/clIQfGj.png |

### Equipment fallback families

Unique or signature equipment may still use `iconOverride`, but ordinary equipment now has a safe family fallback.

| Group | Asset |
| --- | --- |
| `weapon_melee` | https://imgur.com/3AEGrWu.png |
| `weapon_ranged` | https://imgur.com/PWnWMq1.png |
| `shield` | https://imgur.com/UnS3IAr.png |
| `accessory` | https://imgur.com/G6YFWYw.png |
| `armor_light` | https://imgur.com/yO2oNKD.png |
| `armor_medium` | https://imgur.com/Yq7KrcC.png |
| `armor_heavy` | https://imgur.com/Jqri9Tk.png |

Total in V1: **46 visual families**.

## HP healing design target

Player HP can range roughly from **10 to 200**. A useful healing catalog therefore cannot be one flat progression where every higher Tier simply invalidates the lower one.

Each Tier contains four purchase roles:

- **Budget** — best Ahn per restored HP; strongest reason to buy for routine/out-of-combat recovery.
- **Standard** — balanced carry item for self, combat and ally recovery.
- **Combat** — lower Ahn efficiency, but `quick_action` makes it valuable when action tempo matters.
- **Rescue** — highest burst in the Tier; intentionally expensive because saving a critical ally can be worth more than efficiency.

All definitions use `targetMode: "self_or_target"`. Current Item Runtime defaults to the user when no target is supplied and can heal an ally when the caller supplies `options.target`.

Outside combat, Item Runtime applies the consumable immediately without Action Economy cost. In combat planning, normal healing uses an Action Slot while Combat-role injectors consume the existing `quick_action` resource.

## Ahn economy

The character code already uses **Ahn** as the campaign currency, with starting backgrounds ranging from very poor characters with tens of thousands of Ahn to wealthy backgrounds with millions. The first healing batch is priced to make Tier choice a real inventory/economic decision instead of a negligible fee.

The price curve deliberately makes:

- Tier I something even poor characters can reasonably stock.
- Tier II/III meaningful expedition spending.
- Tier IV a serious purchase.
- Tier V emergency/corporate-grade medicine whose use should be a decision.

## HP Healing Batch V1

| Tier | Item | Role | HP | Price | Ahn / HP | Intended band |
| --- | --- | --- | ---: | ---: | ---: | --- |
| I | Coagulant Gauze Patch I | Budget | 5 | 1,000 Ahn | 200 | 10-30 HP |
| I | Basic Recovery Ampoule I | Standard | 8 | 2,400 Ahn | 300 | 10-30 HP |
| I | SnapDose Injector I | Combat / Quick Action | 6 | 3,500 Ahn | 583 | 10-30 HP |
| I | Field Trauma Pack I | Rescue | 10 | 5,000 Ahn | 500 | 10-30 HP |
| II | ClotFoam Cartridge II | Budget | 12 | 6,000 Ahn | 500 | 20-60 HP |
| II | Recovery Ampoule II | Standard | 16 | 9,000 Ahn | 563 | 20-60 HP |
| II | Redline Injector II | Combat / Quick Action | 14 | 12,000 Ahn | 857 | 20-60 HP |
| II | Rescue Medpack II | Rescue | 20 | 16,000 Ahn | 800 | 20-60 HP |
| III | Hemostatic Nanogel III | Budget | 24 | 22,000 Ahn | 917 | 50-100 HP |
| III | Regeneration Ampoule III | Standard | 32 | 30,000 Ahn | 938 | 50-100 HP |
| III | Rapid Recovery Injector III | Combat / Quick Action | 28 | 42,000 Ahn | 1,500 | 50-100 HP |
| III | Trauma Stabilizer III | Rescue | 40 | 55,000 Ahn | 1,375 | 50-100 HP |
| IV | Synth-Tissue Sealant IV | Budget | 45 | 75,000 Ahn | 1,667 | 80-150 HP |
| IV | Regeneration Ampoule IV | Standard | 60 | 100,000 Ahn | 1,667 | 80-150 HP |
| IV | Priority Combat Injector IV | Combat / Quick Action | 50 | 135,000 Ahn | 2,700 | 80-150 HP |
| IV | Critical Care Pack IV | Rescue | 75 | 180,000 Ahn | 2,400 | 80-150 HP |
| V | Corp-Grade Regenerator V | Budget | 80 | 250,000 Ahn | 3,125 | 120-200+ HP |
| V | Hyper-Regeneration Ampoule V | Standard | 100 | 325,000 Ahn | 3,250 | 120-200+ HP |
| V | Emergency Reconstruction Injector V | Combat / Quick Action | 90 | 450,000 Ahn | 5,000 | 120-200+ HP |
| V | Full Trauma Reconstructor V | Rescue | 125 | 650,000 Ahn | 5,200 | 120-200+ HP |

### Why this still gives lower-Tier items a reason to exist

A character should not automatically buy the highest heal they can find.

- A 20 HP character can solve most ordinary damage cheaply with Tier I/II medicine.
- A 70 HP character gets good routine value from Tier II/III and may carry one Rescue item.
- A 140-200 HP veteran can justify Tier IV/V because smaller consumables no longer change the fight enough.
- Quick Action injectors are deliberately less efficient: the player is purchasing **tempo**, not raw HP.
- Rescue items are deliberately burst-heavy: their value is highest when an ally would otherwise be lost.

## Runtime schema used by the batch

Example:

```js
{
  canonicalId: "item:regeneration_ampoule_iii",
  category: "consumable",
  subtype: "medical",
  tier: "III",
  iconGroup: "healing_hp",
  priceAhn: 30000,
  valorBase: 30000,
  function: ["use"],
  runtime: {
    actionCost: "action",
    targetMode: "self_or_target",
    consumeQty: 1,
    effects: { hpRestore: 32 }
  },
  consumable_details: {
    curacion_hp: 32,
    action_cost: "action"
  }
}
```

`consumable_details` remains as a compatibility mirror while the canonical runtime reads `runtime.effects.hpRestore` and `runtime.actionCost`.

## Scope of this PR

This PR intentionally establishes **definitions and contracts**, not production seeding.

Included:

- canonical icon registry;
- 46 shared visual families;
- first 20 HP Healing ItemDefinitions;
- Tier I-V purchase/use roles;
- compatibility fields for the current Item Runtime;
- smoke validation.

Not included yet:

- writing these definitions into production Firebase;
- assigning `iconGroup` to all 560 spreadsheet ItemDefinitions;
- changing the Player HUD/DM Forge to render the new registry directly;
- SP Healing, Hybrid, Cure, food or crafting batches.

Those can follow on top of this stable registry without redefining the visual contract.
