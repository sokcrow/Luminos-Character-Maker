# Item Combat Completion

## Objective
Finish the Item system as an independent combat workstream without mixing it with the Combat Action Economy, Skill Creator, XP, or map branches.

## Existing base confirmed on `main`

### Runtime
`js/item-runtime-engine.js` already provides a broad Item runtime foundation:
- Item identity/category/tag normalization.
- Inventory lookup and quantities.
- Item instances, condition/durability, quality, stolen/origin metadata and charges.
- Equipment validation through the anatomy/equipment engine.
- Equip/unequip for weapons, armor, shields and accessories.
- Consumable/use profiles and use scheduling through the Action Economy.
- HP/SP recovery, statuses, injury treatment, repair, ammo, modules and runtime effects.
- `actionCostFor()` already exists as the entry point for Item action cost.

### Item Creator
`dm-item-creator.html` already stores key combat links:
- Weapons require `weapon_details.base_skill_id`.
- Shields can reference `shield_details.clashable_guard_skill_id`.
- Consumables already expose direct HP/SP recovery and status-oriented data.

## Combat rules already decided

### Use Item
Items must not hard-code all use behavior into the Universal Action. The Item definition decides whether it can be used and what it does.

Two combat execution paths are required:

- **Action**: consumable/effect resolves at 100% of its defined effect.
- **Quick Action**: consumable/effect resolves at 50% only when the Item explicitly supports quick use.

Quick Action remains a team resource; this Item PR only needs to expose the correct Item-side contract.

Recommended canonical Item field:

```js
quickUse: {
  allowed: true,
  multiplier: 0.5,
  effectOverride: null
}
```

Binary/non-scalable effects must not be blindly halved. They require either:
- `quickUse.allowed = false`, or
- a specific `quickUse.effectOverride`.

Examples of effects that need explicit handling:
- Remove a Status entirely.
- Cure an Injury.
- Toggle/activate a device.
- Apply an effect whose meaning cannot be represented at 50%.

### Scheduled use must be exactly-once
A scheduled Item use is a single committed combat action. Re-delivering the same scheduled entry must never apply its effects or inventory cost twice.

The runtime must therefore treat a scheduled-use identifier as idempotent across the **entire resolution**, not just consumption:
- validate Item availability before applying HP/SP/Status/effects;
- if quantity/charges are insufficient, apply **no effect**;
- mark a scheduled entry resolved only after successful commit;
- replaying an already-resolved entry returns the previous resolution / an `already_resolved` result without applying effects again;
- a cancelled scheduled entry consumes nothing and applies nothing;
- effects and quantity/charge changes commit together from the caller's perspective.

This requirement exists because the current legacy path can apply effects before discovering insufficient quantity and can replay the same planned entry more than once. The completion work must remove both failure modes.

### Throw
Throw will use a Skill rather than a separate damage formula.

The final Throw calculation is intentionally deferred until the Skill/CombatAction contract is finalized.

Item-side requirements:
- An Item/Weapon can declare that it is throwable.
- A throwable definition can reference a Skill.
- The linked Skill determines STR/DEX scaling, Power, Coins, damage, Effects and targeting.
- Battle Viewer can use an Item/object projectile sprite when provided.

Recommended contract:

```js
throwable: {
  enabled: true,
  skillId: "skill_id",
  projectileSprite: null,
  consumeOnThrow: false,
  recoverable: true
}
```

Do not create a second Throw combat formula inside ItemRuntime.

## Work remaining

### P0 — Combat contract
- [ ] Normalize Item combat metadata into one stable runtime shape.
- [ ] Add explicit `quickUse` normalization.
- [ ] Add explicit `throwable` normalization.
- [ ] Preserve legacy Item fields while serializing canonical runtime fields.
- [ ] Define Item -> CombatAction adapter entry points once `CombatAction` lands.
- [ ] Ensure weapons continue referencing Skills through `base_skill_id` rather than embedding duplicate Skill rules.
- [ ] Ensure shields continue referencing defensive Skills through `clashable_guard_skill_id`.

### P0 — Use Item in combat
- [ ] Full Action use resolves 100% of scalable consumable effects.
- [ ] Quick Action use resolves the configured quick-use behavior, normally 50%.
- [ ] Quick use must reject Items that do not explicitly allow it.
- [ ] Quick use must support explicit overrides for binary effects.
- [ ] Validate quantity/charges before applying any effect.
- [ ] Item consumption/quantity/charges happen only after a valid execution path is confirmed.
- [ ] Cancelled scheduled Item Actions apply no effect and consume nothing.
- [ ] Make scheduled resolution idempotent: the same action ID can resolve successfully at most once.
- [ ] Replayed scheduled entries must not duplicate HP/SP/Status/effects or inventory mutations.

### P0 — Targeting and effect ownership
- [ ] Normalize Self / Ally / Enemy / Target use modes.
- [ ] Keep Item effects attached to the specific Item Action, never as a permanent mutation of the whole Unit definition.
- [ ] Route Item-applied Status/HP/SP/effects through the shared effect runtime where possible.
- [ ] Preserve the original Item instance/reference for consumption and inventory updates.

### P1 — Throw support
- [ ] Add Item Creator fields for throwable configuration.
- [ ] Add linked Throw Skill selector.
- [ ] Support STR or DEX scaling through the linked Skill, not ItemRuntime math.
- [ ] Add optional projectile/object sprite.
- [ ] Define whether throwing consumes, drops, or preserves the Item instance.
- [ ] Define recoverable thrown Items after Encounter resolution.
- [ ] Support thrown consumables and thrown weapons without duplicating their effects.

### P1 — Weapons and shields
- [ ] Validate that `base_skill_id` references an existing Skill.
- [ ] Resolve equipped weapon Skill references into the combat kit/deck without copying stale Skill definitions.
- [ ] Validate `clashable_guard_skill_id` for shields.
- [ ] Ensure weapon/shield Offense/Defense modifiers are applied once and do not double-stack with the linked Skill.
- [ ] Connect weapon damage-type conversion and power-reduction penalty to the final CombatAction compilation path.

### P1 — Consumables and charges
- [ ] Canonicalize quantity vs charges semantics.
- [ ] Define which consumables consume stack quantity and which consume charges.
- [ ] Handle zero quantity/zero charge disabling consistently in UI and runtime.
- [ ] Preserve HP/SP caps and SP's Luminous combat range rules when applying recovery.
- [ ] Define rounding policy for 50% Quick Action effects.

### P1 — Battle Viewer / Action Planner
- [ ] Expose usable Items to the Action Planner.
- [ ] Filter Items by available Action vs team Quick Action.
- [ ] Show target selection only when the Item requires it.
- [ ] Show expected full/quick effect in the HUD before confirmation.
- [ ] Render projectile/object sprite for Throw when configured.
- [ ] Resolve inventory consumption only after the combat action is committed/resolved.

### P2 — Persistence and cleanup
- [ ] Persist canonical combat metadata from `dm-item-creator.html`.
- [ ] Load legacy Items without data loss.
- [ ] Preserve instance condition, quantity, charges and installed modules through combat.
- [ ] Add validation messages for broken Skill references.
- [ ] Add migration helpers only where necessary; do not rewrite all legacy Item data eagerly.

### P2 — Tests
- [ ] Full Action consumable = 100% effect.
- [ ] Quick Action consumable = configured 50% effect.
- [ ] Binary Item rejects Quick Action when no override exists.
- [ ] Cancelled scheduled use applies no effect and consumes no quantity/charges.
- [ ] Insufficient quantity/charges applies no effect.
- [ ] Successful scheduled use applies effects and consumes inventory exactly once.
- [ ] Replaying the same scheduled action ID is a no-op for both effects and inventory.
- [ ] Weapon resolves valid `base_skill_id`.
- [ ] Shield resolves valid `clashable_guard_skill_id`.
- [ ] Throwable Item resolves its linked Skill.
- [ ] Throw does not use a second independent damage formula.
- [ ] Item combat modifiers do not leak into unrelated Skills/Spells.

## Explicitly out of scope
- Final Throw Power/Coin formula: belongs to Skill/CombatAction work.
- Team Action Slot distribution.
- Quick Action team budget itself.
- Grapple / Help / Retreat / Escape / Improvise rules.
- XP rewards.
- Map/VTT interactions.
- Tactical AI decision scoring beyond exposing Item actions as legal options.

## Dependency order

```text
CombatAction contract
        ↓
Item -> CombatAction adapter
        ↓
Use Item / Quick Use
        ↓
Throw Skill integration
        ↓
Battle Viewer + Planner
        ↓
Tactical AI item valuation
```
