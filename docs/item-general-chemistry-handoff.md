# General Chemistry / Industrial / Environmental V1 handoff

## Scope

Chemistry V1 is a **transversal crafting family**, not a standalone collection of bottles.

Its job is to provide reusable inputs and finished supplies for:

- existing Craft Components;
- existing Armor physical Upgrades where chemistry is relevant;
- pharmaceutical chemistry / Medicine;
- electronics and precision fabrication;
- Augment-grade component crafting;
- future Maintenance / Repair;
- future Construction / Bases / Infrastructure;
- future Environmental Hazard gameplay;
- future chemical payload / throwable systems.

Future systems are not simulated early. A craftable chemistry Item may exist before its consumer engine, but it must declare the consumer hook it is intended for.

## Visual taxonomy

46 approved icon families are active:

- 16 raw chemical/environmental families;
- 12 processed compound families;
- 10 finished industrial families;
- 8 finished environmental families.

The corrected URLs are canonical:

- \`industrial_lubricant_pack\` → \`https://imgur.com/kE23Jlc.png\`
- \`filter_cartridge\` → \`https://imgur.com/o0kvdU7.png\`

## Catalogs

### Raw Chemistry

\`js/item-catalog-chemical-raw.js\`

32 raw game-facing reagents, two per raw visual family.

These are abstract game materials. Chemistry V1 intentionally does not encode real-world synthesis instructions.

Every raw item carries:

- Universal Item Quality compatibility;
- Production Value;
- semantic reagent tags;
- \`consumerHooks\` describing systems that may consume it.

Examples of immediately relevant tags:

- \`chemical_reagent\`
- \`resin\`
- \`pigment_source\`
- \`conductive_material\`
- \`insulator\`
- \`advanced_material\`

Those tags already line up with existing Craft Component contracts.

### Processed Chemistry

\`js/item-catalog-chemical-processed.js\`

12 processed outputs:

- Cleaning Compound
- Sealant Compound
- Lubricant Compound
- Polymer Compound
- Adhesive Compound
- Pigment Compound
- Reactive Compound
- Corrosive Solution
- Neutralizing Solution
- Decontamination Solution
- Stabilized Compound
- Treatment Solution

### Finished Products

\`js/item-chemistry-recipe-catalog.js\`

18 products:

Industrial:
- Industrial Cleaner
- Industrial Sealant
- Industrial Lubricant Pack
- Industrial Coating
- Repair Adhesive
- Chemical Cartridge
- Chemical Canister
- Reactive Canister
- Corrosive Canister
- Maintenance Kit

Environmental:
- Water Purifier
- Filter Cartridge
- Spill Absorbent Kit
- Decontamination Spray
- Neutralizer Spray
- Containment Foam
- Hazard Bag
- Environmental Kit

## Integration states

Finished chemistry recipes use one of two states.

### active_component

The item already has a meaningful consumer or semantic role in an existing Items system.

Examples:

- Industrial Sealant → \`sealant\` / Craft Component input
- Repair Adhesive → \`adhesive\` / Craft Component input
- Industrial Coating → material recipe for Armor's Anti-Corrosion Coating
- chemical raw conductive/insulating materials → existing Electrical Component requirements
- Stabilized/Polymer compounds → \`advanced_material\` path used by Augment-grade Component crafting

### prepared

The item is a real craftable inventory object with Quality, Production Value and consumer tags, but its dedicated gameplay engine does not exist yet.

Examples:

- Maintenance Kit → future Maintenance / Repair
- Water Purifier / Filter Cartridge → future Survival / Infrastructure
- Decontamination Spray / Spill Kit → future Environmental Hazards
- Reactive / Corrosive Canisters → future payload / throwable systems

Prepared items **do not gain placeholder runtime buffs or fake Use actions**.

## Craft thresholds

Chemistry follows the canonical Item crafting scale:

- TH 18 — simple / field preparation;
- TH 22 — Workshop / laboratory processing;
- TH 28 — advanced / Corp / exotic processing;
- improvised required tools → +3 TH.

Standard chemical processing uses Chemical Tools. Assembly-oriented final products may use Fabrication Tools.

## Economy

Chemistry follows:

\`\`\`
Craft Base Value = sum(consumed input Production Values) × process multiplier
\`\`\`

Universal Item Quality then modifies the crafted Production Value through the canonical quality engine.

## Existing integration

### Craft Components

No replacement of the Craft Component system is required.

Chemistry outputs deliberately expose tags already consumed by the canonical component graph:

\`\`\`
chemical_reagent
resin
sealant
adhesive
pigment_source
conductive_material
insulator
advanced_material
\`\`\`

This means Chemistry supplies existing component crafting rather than duplicating it.

### Armor

\`Anti-Corrosion Coating\` now carries a material recipe contract:

- 1 × Industrial Coating
- Chemical Processing
- Chemical Tools
- TH 22

Its existing gameplay effect is unchanged.

### Augments

The full Augmentation runtime remains future work.

However, the existing \`augment_grade_component\` recipe already accepts \`advanced_material\`. Chemistry V1's Polymer / Stabilized paths expose that semantic tag, so the material graph is prepared without inventing Augment effects early.

## Safety / abstraction boundary

Reactive, corrosive and future payload items are abstract gameplay components. No real-world explosive, weapon-manufacturing or hazardous synthesis recipe is encoded.

## Next consumer systems

Chemistry is now ready to be consumed incrementally by:

1. Maintenance / Repair;
2. Environmental Hazards;
3. Construction / Bases / Infrastructure;
4. Augmentations;
5. abstract chemical payload / throwable crafting.

Those systems should consume the existing semantic hooks instead of creating duplicate chemical inventories.
