# Regional Archetype Adaptation Backlog

Status: **Working Draft**

This document keeps the remaining regional adaptation work separate from already integrated player options.

## Player-facing rule

Regional adaptation must not create an extra role-selection layer.

A player selects the Class and its actual Archetype option. Region and mechanical family may be stored as metadata for organization, but labels such as `marksman`, `fighter`, `assassin`, or other source-game roles are not additional choices in the player flow.

Example already integrated:

- Ranger → Bilgewater → Demolisher
- Ranger → Bilgewater → Buccaneer

Internal metadata may still use values such as:

- `regionId: "bilgewater"`
- `familyId: "marksman"`

Champion/source references are design notes only. They are not player-facing archetype names or required character identities.

## Integrated Bilgewater options

Merged in PR #829:

### Ranger — Demolisher

Status: **Integrated**

Mechanical identity:
- shotgun specialization;
- heavy impact;
- Smoke Screen;
- Protection/reload loop;
- Collateral Damage;
- End of the Line.

Original mechanical reference used during design: Graves.

### Ranger — Buccaneer

Status: **Integrated**

Mechanical identity:
- pistol specialization;
- Target Shift / source-aware Target Mark;
- Ricochet Quick Action;
- Sea Legs;
- Powder Rain;
- Broadside + Covering Fire from FIELD/BACKUP.

Original mechanical reference used during design: Miss Fortune.

## Bilgewater work still open

### Fighter — Combined Arms Specialist

Status: **Design Closed / Runtime Pending**

The closed design from PR #781 contains:

- Lv15: Parley + Trial by Fire
- Lv35: Powder Keg
- Lv50: Combat Tonic
- Lv75: Cannon Barrage + Silver Serpents
- Lv90: Powder Mastery

Original mechanical reference used during design: Gangplank.

This option must be implemented as its own Fighter Archetype/runtime and must not be folded into the Ranger Bilgewater options.

### Remaining Bilgewater adaptations

Status: **Pending Design Pass**

Do not infer or recreate champion-to-Class assignments from memory.

For each remaining Bilgewater adaptation:

1. confirm the previously intended champion/mechanical reference;
2. choose the Luminous Class from the required gameplay loop;
3. decide whether an existing regional Archetype can express it or a new Archetype is required;
4. close Levels 15 / 35 / 50 / 75 / 90;
5. implement and validate the runtime;
6. expose only the final canonical Archetype name to players.

## Shadow Isles work

Status: **Pending Design Pass**

Shadow Isles remains a separate regional workstream.

No Shadow Isles champion is assigned to a Class by this document. Existing conversation-era mappings must be explicitly reconfirmed before runtime work begins rather than reconstructed from source-game roles.

For every accepted option, record:

- Class;
- canonical player-facing Archetype name;
- `regionId: "shadow_isles"`;
- optional internal family metadata;
- Levels 15 / 35 / 50 / 75 / 90;
- required shared systems;
- runtime/test files.

## Integration rule

Each finished Archetype must:

- use the universal Class Runtime Manifest / Bootstrap;
- declare dependency ordering in `scripts/generate-class-runtime-manifest.mjs`;
- regenerate `js/class-runtime-manifest.js`;
- reuse existing Combat Action, Save, Status, deployment, equipment, ammunition, Spellcasting and action-economy systems where applicable;
- avoid parallel mechanics when the engine already owns the rule;
- include runtime smoke coverage before merge.

## Current next step

Continue Bilgewater from the remaining confirmed champion/class mapping, then move to the Shadow Isles queue after Bilgewater's remaining options are placed in their respective Classes.
