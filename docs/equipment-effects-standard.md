# Universal Equipment Effects — Limbus/Luminos

This standard is **data-driven**. Do not add character-named code paths for Calipsys, Jeske, or other units.

## Canonical runtime

`js/item-equipment-effects-runtime.js` reads `runtime.equipmentEffects` (or
`equipmentEffects`) from **currently equipped** armor/weapons/shields/accessories
and **installed** body augmentations. A broken/disabled item contributes no effects.
Effects are identified by the equipment instance and effect index to prevent
duplicate evaluation from main/offhand references.

| `type` | `trigger` | Parameters | Semantics |
|---|---|---|---|
| `sin_resistance` | `passive` | `sin`, `multiplier` | Use the lower of the existing and equipment-provided SIN multiplier, for the named SIN only |
| `sp_loss_reduction` | `passive` | `value` | Flat reduction per external SP-loss event, strongest equipped source wins; never affects voluntary costs |
| `skill_check_bonus` | `passive` | `skill`, `value` | Add to the named skill's resolved check (not its governing ability score) |
| `check_threshold_reduction` | `passive` | `check`, `value` | Lower the named check's threshold; multiple distinct equipped sources add |
| `heal_hp_percent` | `on_turn_start` | `value` | `floor(maxHp * value / 100)`, capped at max HP, never resurrect at HP 0 |
| `grant_skill` | `passive` | `skillId` | Grant a canonical library Skill while the equipment remains active, outside the offensive deck |

The runtime's API is `LuminousEquipmentEffects`. Do not store bonuses
permanently in base attributes, mutate global Skill definitions, or build
second hard-coded Skills or item registries for the UI.

### Authoring examples (illustrative, not registered items)

Calipsys armor (SIN multiplier is a **test value**, not a balance decision):

```json
{
  "runtime": {
    "equipmentEffects": [
      { "type": "sin_resistance", "sin": "gloom", "multiplier": 0.75 },
      { "type": "sp_loss_reduction", "value": 3 }
    ]
  }
}
```

Jeske eye augmentation (use `LuminousItemAugmentationRuntime` to install on
an available `eye` anatomy part):

```json
{
  "runtime": {
    "augmentation": {
      "enabled": true,
      "targetPartTypes": ["eye"]
    },
    "equipmentEffects": [
      { "type": "skill_check_bonus", "skill": "perception", "value": 1 },
      { "type": "check_threshold_reduction", "check": "analyze", "value": 2 }
    ]
  }
}
```

Jeske armor / shield:

```json
{
  "runtime": {
    "equipmentEffects": [
      { "type": "heal_hp_percent", "trigger": "on_turn_start", "value": 5 }
    ]
  }
}
```

```json
{
  "runtime": {
    "equipmentEffects": [
      { "type": "grant_skill", "skillId": "canonical_shield_bash_skill_id" }
    ]
  }
}
```

`canonical_shield_bash_skill_id` stands for an actual, registered Skill ID;
never invent a Skill in the combat viewer as a fallback.

## Runtime integration

- Equipment effects are loaded in the real battle viewer after the packed
  runtime is expanded and before its first hydration; the source is the same
  equipment/inventory instance used by the combat adapter. Sparse library reads
  include grants from that resolved equipment, without loading the full catalog.
- The Loot Check runtime applies the equipped bonus at roll computation.
  Analyze reduces the *actual* threshold passed to the check.
- Elemental Sinking SP loss and `CombatEngine`'s status-based SP losses pass
  through the common mitigation function. Gloom damage uses the equipped
  Sin resistance in the elemental fallback path and Skill hit calculation.
  The packed viewer also calls the resolver in `damageCombatantSP` and
  `effectiveResistanceFor`, including live Sinking, Skill damage and forecasts.
  Fixed damage and explicitly ignored resistance bypass Sin mitigation;
  voluntary SP costs bypass SP-loss reduction.
- Granted Skill IDs are added only from the canonical Skill catalog and
  explicitly marked `inDeck:false`, `availability.type:'granted'` so they
  cannot be drawn as Tier I/II/III cards.
- Turn-start healing executes **only in the DM-authoritative combat round**,
  once per item effect per encounter/round. The consumption ledger is included
  in combat checkpoints, and no client-side UI hook heals units. Recovered
  execution restores HP and the ledger before applying regeneration. Restoring
  a snapshot without a ledger clears any newer in-memory ledger, so a retry
  before the first checkpoint preserves healing without duplicating it later.

## Not yet standardized by this initial bridge

1. Other legacy or third-party SP-loss paths that bypass
   `CombatEngine` status rules and elemental Sinking must be migrated to
   the common SP-loss API (no blanket, unverified monkey patch).
2. Global Perception checks outside `LuminousLootCheckRuntime` need to
   adopt the same equipment bonus API.
3. Weapon set swapping and in-combat preset/mode switching need an
   authority-validated loadout command, its own action-cost handling,
   per-preset hand persistence, and atomic equipment+deck change.
   Do not confuse the existing saved presets with an in-combat swap action.
4. DM Item Creator fields and the player action-picker UI need to expose these
   new generic effect and equipment-loadout options with parity on mobile and
   desktop (TX-01). Do not expose raw JSON, IDs, or debugging panels.
5. When extending save/load integrations, require server-trusted catalog
   definitions to authenticate gameplay effects. Do not treat client-provided
   arbitrary item metadata as proof of an authorized grant.

These are **gaps**, not finished features. A complete release requires
regression testing of those endpoints and end-to-end DM/player sync.

## Tests

```bash
node tests/equipment-effects-standard-smoke.mjs
node tests/equipment-effects-live-smoke.mjs
node tests/combat-analyze-end-to-end-smoke.mjs
node tests/combat-deck-engine-smoke.mjs
```

The workflow `equipment-effects-standard.yml` runs syntax and compatibility
checks in pull requests. Tests verify no double healing, correct on/off equip
behavior, no SP-cost mitigation, Analyze threshold and Skill separation.
