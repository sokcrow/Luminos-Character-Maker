# Throwables V1 — Item Recipe Handoff

## Scope

This pass is **catalog-only**.

Throwables V1 now defines the Items, support components and crafting recipes needed for the offensive/tactical throwable family. The catalog closes at 10 finished throwable families. It intentionally does **not** define combat damage, Quick Action behavior, ATK Weight, Saves, field hazards, persistent zones or duel behavior.

Those combat/runtime rules remain deferred.

## New icon families

Finished throwables:

- \`fragmentation_throwable\`
- \`incendiary_throwable\`
- \`cryogenic_throwable\`
- \`shock_throwable\`
- \`concussive_throwable\`
- \`smoke_throwable\`
- \`flash_throwable\`
- \`marking_throwable\`

Support / crafting:

- \`grenade_shell\`
- \`fragmentation_filler\`
- \`concussive_charge\`
- \`cryogenic_reagent\`
- \`cryogenic_solution\`
- \`shock_charge\`

\`cryogenic_reagent\` and \`cryogenic_solution\` intentionally share the supplied icon.

The supplied \`concussive_charge\` Imgur ID is normalized to the registry's canonical direct-image format:

\`https://imgur.com/DZo1Ry5.png\`

## Chemistry extension

Chemistry V1 gains:

### Cryogenic Reagent

A raw abstract cold/thermal-control reagent.

Tags include:

- \`cryogenic_reagent\`
- \`cold_reagent\`
- \`thermal_control_input\`
- \`payload_input\`

### Cryogenic Solution

Workshop chemical processing:

- 1 × Cryogenic Reagent
- 1 × industrial solvent / liquid carrier
- 1 × chemical stabilizer
- Chemical Tools
- TH 22

The output exposes \`cold_payload\` / \`cryogenic_solution\` semantics.

### Reactive Compound

The existing Reactive Compound now also exposes \`combustible_source\`.

This lets an Incendiary Throwable accept the existing abstract reactive chemistry today while leaving room for future concrete Fuel items to expose the same semantic contract. No dedicated \`incendiary_mix\` item is required.

## Throwable support components

\`js/item-catalog-throwable-components.js\`

### Grenade Shell

- housing/casing/structural component
- fasteners/hardware
- Fabrication Tools
- TH 22

### Fragmentation Filler

- abstract metal/scrap/structural feedstock
- Fabrication Tools
- TH 18

### Concussive Charge

- Reactive Compound
- Stabilized Compound
- Chemical Tools
- TH 22

### Shock Charge

- electrical/electronic component
- conductive material
- Stabilized Compound
- Technical Tools
- TH 22

Shock Charge is intentionally reusable beyond Throwables through consumer hooks for electronics, devices and future Augments.

## Finished throwable recipes

\`js/item-throwable-recipe-catalog.js\`

### Fragmentation Throwable

- Grenade Shell
- Fragmentation Filler
- Reactive Compound
- Fabrication Tools
- TH 22

### Incendiary Throwable

- Grenade Shell **or** Chemical Canister
- a \`combustible_source\` / \`fuel\`
- Stabilized Compound
- Chemical Tools
- TH 22

### Cryogenic Throwable

- Grenade Shell **or** Chemical Canister
- Cryogenic Solution
- Chemical Tools
- TH 22

### Shock Throwable

- Grenade Shell
- Shock Charge
- Technical Tools
- TH 22

### Concussive Throwable

- Grenade Shell
- Concussive Charge
- Fabrication Tools
- TH 22

### Smoke Throwable

- Chemical Canister **or** Grenade Shell
- Reactive Compound
- Stabilized Compound
- Chemical Tools
- TH 18

### Flash Throwable

- Grenade Shell
- Reactive Compound
- Stabilized Compound
- Chemical Tools
- TH 22

### Marking Throwable

- Chemical Canister **or** Grenade Shell
- Pigment Compound
- Chemical Tools
- TH 18

### Corrosive Throwable

- Corrosive Canister
- Grenade Shell
- Chemical Tools
- TH 22

The existing Corrosive Canister remains the reusable packaged corrosive payload; the Throwable is the finished delivery item.

### Toxic Throwable

- Chemical Canister **or** Grenade Shell
- Toxin Extract
- Stabilized Reagent **or** Stabilized Compound
- Chemical Tools
- TH 22

The toxin chain remains shared with Medicine/Pharmaceutical Chemistry instead of creating a duplicate toxic chemistry branch.

## Existing items reused instead of duplicated

Throwables V1 does not create redundant visual/item families for payloads that already exist:

- Reactive → \`reactive_canister\`
- Corrosive → \`corrosive_canister\`
- Toxic → \`toxic_aerosol\`
- Containment → \`containment_foam\`

Those existing products remain valid inputs/related payload items for the later combat pass.

## Deferred combat contract

Every new finished throwable currently declares:

\`\`\`js
runtimeEffectImplemented: false
combatContractStatus: "deferred"
\`\`\`

The Item catalog therefore knows how the item is made and valued without prematurely defining how it resolves in combat.
