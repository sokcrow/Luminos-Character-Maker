# Medicine / Pharmaceutical Chemistry V1 handoff

## Scope

This pass establishes the medicine crafting graph inside the canonical Items PR.

It intentionally covers **medicine plus pharmaceutical chemistry**, not the complete general Chemistry family.

Covered:

- natural medicinal and toxic plants/fungi;
- biological and creature-derived reagents already present in the Items graph;
- abstract pharmaceutical raw reagents and clinical materials;
- abstract synthetic toxin reagent;
- ten processed medicinal/chemical intermediates;
- eighteen finished delivery-form recipe chassis;
- Item Quality / Production Value / craft-check integration;
- visual icon families based on material function and finished delivery form;
- the existing 300 HP / SP / Hybrid / Status Cure / Medical Supply consumables retain their mechanical families but now use physical-form icon families.

Deferred to a future general Chemistry pass:

- industrial solvents and bulk chemical feedstocks outside medical use;
- pigments/dyes beyond existing generic craft components;
- fuels and non-medical reactive agents;
- industrial corrosion/cleaning chemistry;
- general laboratory products not used by Medicine;
- additional chemical throwables.
- real-world synthesis/manufacturing detail remains intentionally out of scope.

## Files

- \`js/item-catalog-medicinal-raw.js\`
- \`js/item-catalog-medicinal-processed.js\`
- \`js/item-medicine-recipe-catalog.js\`
- \`js/item-medicine-crafting-engine.js\`
- \`tests/item-medicine-crafting-smoke.cjs\`

Existing catalogs updated for visual delivery form:

- \`js/item-catalog-hp-healing.js\`
- \`js/item-catalog-sp-healing.js\`
- \`js/item-catalog-hybrid-healing.js\`
- \`js/item-catalog-status-cure.js\`
- \`js/item-catalog-medical-supply.js\`
- \`js/item-catalog-plant-produce.js\`
- \`js/item-icon-registry.js\`

## Catalog counts

- 46 new pharmaceutical / clinical raw leaf inputs.
- Existing medicinal plant/fungus sources are referenced rather than duplicated.
- Existing Blood/Ichor, Organ/Gland, Venom/Secretion and Ooze/Gel catalogs can supply biological/toxin/recovery inputs through tags.
- 10 processed medicinal/chemical intermediates.
- 18 active finished-form recipe chassis.
- 3 delivery-form chassis reserved until their icon URLs are supplied:
  - \`medicine_spray\`
  - \`medicine_injector\`
  - \`toxic_canister\`

## Craft thresholds

The medicine pass reuses the canonical Item Quality scale.

- TH 18 — field / simple medical preparation.
- TH 22 — laboratory / Workshop pharmaceutical or chemical processing.
- TH 28 — advanced / Corp / exotic processing.
- Improvised required tools add +3 TH.

Typical checks/tools:

- Medicine + Medical Tools for ordinary clinical preparation.
- Chemical Processing + Chemical Tools for concentration, stabilization, toxin extraction and pharmaceutical processing.

## Graph

\`\`\`
Raw source
  -> processed medicinal/chemical intermediate
    -> finished delivery-form chassis
      -> existing runtime item definition
\`\`\`

Examples:

\`\`\`
Medicinal Herb
  -> Medicinal Extract
    -> Medicinal Concentrate
      -> Medicine Patch / Ampoule / Vial / etc.
\`\`\`

\`\`\`
Venom OR Toxic Herb OR Toxic Mushroom OR Chemical Toxin Reagent
  -> Toxin Extract
    -> Poison Vial / Capsule / Coating / Aerosol / Ampoule
\`\`\`

\`\`\`
Toxin Source
  + Medicinal Extract
  + Stabilizer
    -> Antitoxin Base
      -> Antidote Tablet / Vial / Ampoule / Inhaler
\`\`\`

Creature lineage is preserved by the source Item and may be carried into the crafted stack; a creature toxin and a botanical toxin share recipe roles without becoming the same source material.

## Icon policy

Mechanical family and visual form are separate concepts.

Example:

\`\`\`
family: healing_hp
iconFamily: medicine_ampoule
\`\`\`

Legacy mechanical IDs are retained for compatibility. New visual families should be used for rendering.

The approved medical/pharmaceutical icon expansion contains 44 active icon families. The three pending delivery icons are not invented or given placeholder URLs.

## Next expansion boundary

The natural continuation is **General Chemistry V1** using the same \`chemical_processing\` contract, followed by chemical throwables or Salvage/Recycling depending on item-system priority.
