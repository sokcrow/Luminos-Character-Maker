# Rest & Recover System

This document is the canonical implementation contract for Luminous rests.

## Recover Slots

Recover Slots belong to a **Class**, not to total Character Level.

```text
Max Recover Slots = floor(Class Level / 5)
```

Multiclass characters therefore maintain one independent pool per Class. The Class Base HP used by Recover is the existing `hpPer5` value from `js/character-build-rules.js` (for example, Barbarian = 12).

A normal spent Recover Slot is restored by a Long Rest. A Trait may explicitly Block a spent Recover Slot for more than one Long Rest; blocked slots remain unavailable until their Long-Rest counter reaches zero.

## Recover action

Each Recover action chooses one Class and spends one or more available Recover Slots from that Class.

```text
Recovered HP = 5 + (Class Base HP × Recover Slots spent in this Recover action)
```

The flat `+5` is applied **once per Recover action**, not once per slot. Two separate 1-slot Recover actions therefore receive the `+5` twice.

Healing can never raise the unit above Max HP.

## Short Rest

Duration: **1–2 in-world hours**. The DM and players decide the exact duration within that range.

A Short Rest does not restore Recover Slots by itself. Players may spend their remaining Recover Slots during the rest.

Traits do not automatically regain uses during a Short Rest. A Trait must explicitly opt in:

```text
[On Short Rest] Recover X Uses.
[On Short Rest] Recover All Uses.
```

The canonical data representations are:

```js
activation: { uses: { recoverOnShortRest: X } }
```

or, for all uses, the existing reset declaration:

```js
activation: { uses: { reset: "short_rest" } }
```

Short-Rest-triggered Trait effects still use the existing `short_rest` Trait trigger.

### Augmentation recovery

Only Augments may add Max-HP-based recovery to a Short Rest. An Augment declares:

```js
mechanics: { shortRestRecoveryPercent: X }
```

All applicable Augment percentages are added together, then globally capped:

```text
Combined Short Rest Augment Bonus <= 5% Max HP
```

The cap is global, not per Augment. This bonus applies only to a Recover made in `short_rest` context. A Trait that performs a Recover during combat does not receive the Short Rest Augment bonus.

## Long Rest

Duration: **6–8 in-world hours**. The DM and players decide the exact duration within that range.

A completed Long Rest:

- restores HP to Max HP;
- restores all normally spent Recover Slots;
- advances multi-Long-Rest Blocked Recover Slot counters;
- restores all Trait uses;
- executes effects/counters explicitly bound to the `long_rest` Trait trigger/reset scope.

There is intentionally **no daily cooldown or once-per-24-hours restriction**. Players may Long Rest repeatedly. The balancing cost is world time: each rest consumes its full 6–8 hours while the campaign world, factions, opportunities, EXP sources and resources may continue changing.

## World-time integration

`LuminousRestRuntime` emits:

```text
luminous:rest-completed
luminous:world-time-advance-requested
```

The world-time event includes the rest type and exact number of hours. The Rest system does not invent or directly mutate a campaign calendar; the world/time subsystem owns that state and can consume this event.

## Improved Demonic Resistance

`Path of the Devil Lineage` already defines:

```text
Quick Action: Spend 1 Recover Slot and perform that Recover immediately.
The used Recover Slot becomes Blocked until 2 Long Rests are completed.
```

`js/rest-runtime-integration.js` connects that Trait to the real Recover resource. Activation is rejected before spending the Quick Action if the source Class has no available Recover Slot. On success it performs a normal 1-slot Recover using the Class Base HP and blocks that slot for exactly two completed Long Rests.
