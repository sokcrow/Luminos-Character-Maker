# Fighter Archetype — Combined Arms Specialist

Status: **Design Closed**

Design source: Runeterra-inspired martial gunpowder gameplay. The canonical archetype name and rules are setting-neutral except for explicitly retained Trait/Upgrade names.

## Progression

- Level 15: Parley, Trial by Fire
- Level 35: Powder Keg
- Level 50: Combat Tonic
- Level 75: Cannon Barrage, Silver Serpents
- Level 90: Powder Mastery

---

## Level 15 — Parley

[After using a Melee Skill] Once per Turn, use **Parley** against a Different Target.

Parley can target Background Units, including your Powder Kegs.

### Parley

- Tier: 1
- Type: Ranged Attack Skill
- Base Power: 6
- Coin Power: +5
- Coins: 1
- ATK Weight: 1
- Damage Type: Pierce
- Scaling: Dexterity
- Unclashable
- Guaranteed Critical

---

## Level 15 — Trial by Fire

The first Coin that Hits with a Melee Skill inflicts **1 Burn Potency and 2 Burn Count**.

When one of your Powder Kegs is destroyed by you, **Trial by Fire can activate again this Turn**.

---

## Level 35 — Powder Keg

**Quick Action**

Place **1 Powder Keg** on the battlefield.

A Powder Keg can be targeted by any Unit.

### Powder Keg

- Background Unit
- HP: 25
- ATK Weight: 3 Max

[On Turn Start] Lose 5 HP. Cannot be reduced below 5 HP by this effect.

[On Death by Enemy] Negate this Unit's [On Death] effects.

[On Death] Deal **floor(Summoner's Class Level / 2) Blunt Damage** and inflict **1 Bind Potency and floor(Summoner's Class Level / 15) Bind Count**.

### Heavy Explosion

If the Powder Keg is killed by a Critical Hit, its [On Death] Damage is Critical.

### Powder Rush

[On Death by Summoner] The Summoner gains **floor(Summoner's Class Level / 15) Haste**.

This effect does not activate if the Powder Keg is destroyed by another Ally.

### Chain Reaction

When another Powder Keg dies, this Powder Keg also explodes and resolves its [On Death] effect against selected targets.

### Background Unit requirement

Powder Keg introduces the **Background Unit** battlefield category.

A Background Unit exists on the battlefield and can be interacted with normally when its own rules allow it, but **does not count toward the normal Field Unit Limit**.

Implementation must preserve the Powder Keg's Summoner reference for effects that use Summoner's Class Level or require kill attribution.

---

## Level 50 — Combat Tonic

[Long Rest] Create **3 Combat Tonics**.

**Max Combat Tonics: 6**

**Quick Action**

[On Use] Consume 1 Combat Tonic.

Remove **1 Negative Status** from yourself.

Recover **floor(Class Level / 7)% Max HP**.

---

## Level 75 — Cannon Barrage

**Action**

Select an Area on the battlefield.

For the next **3 Turns**:

[On Turn Start] Deal **floor(Class Level / 5) Blunt Damage** to enemies inside the Area.

---

## Level 75 — Silver Serpents

Gain Silver Serpents through your Archetype abilities.

Silver Serpents are cumulative and are spent to unlock permanent Cannon Barrage Upgrades.

### Parley

[On Hit] Gain **2 Silver Serpents**.

### Trial by Fire

When Trial by Fire inflicts Burn, gain **1 Silver Serpent**.

Max once per Turn.

### Powder Keg

When one of your Powder Kegs explodes and damages at least one Enemy, gain **4 Silver Serpents**.

Silver Serpents are gained once per Powder Keg, regardless of the number of targets damaged.

### Cannon Barrage

Each Turn Cannon Barrage damages at least one Enemy, gain **2 Silver Serpents**.

Additional Hits from **Fire at Will** do not grant additional Silver Serpents.

### Cannon Barrage Upgrade Cost

When you have **20 Silver Serpents**, you may consume **20 Silver Serpents** to select one Cannon Barrage Upgrade you do not already have.

You can obtain a maximum of **3 Cannon Barrage Upgrades**.

### Death's Daughter

The first Cannon Hit of Cannon Barrage deals **+30% Damage**.

### Fire at Will

Each time Cannon Barrage activates, it **Hits twice** instead of once.

### Raise Morale

Each time Cannon Barrage activates, Allies inside the Area:

- Recover **floor(Class Level / 15) SP**.
- Gain **2 Haste**.

---

## Level 90 — Powder Mastery

[On Turn Start] Place **1 Powder Keg** on the battlefield.

Powder Keg's [On Death] effect targets **all Enemies** instead of using its normal ATK Weight.

---

## Runtime integration notes

This archetype must integrate through the universal Class Runtime Manifest / Bootstrap.

Do not add a hardcoded archetype load to Battle, Theatre, or Status entrypoints.

If the runtime requires dependency ordering, add that dependency to `DEPENDENCY_OVERRIDES` in `scripts/generate-class-runtime-manifest.mjs` and regenerate `js/class-runtime-manifest.js`.

The runtime implementation must support:

- a guaranteed-Critical Skill rule for Parley;
- Background Units that do not consume the normal Field Unit Limit;
- Summoner ownership and kill attribution for Powder Kegs;
- Powder Keg Chain Reaction;
- persistent/trackable Combat Tonics;
- Cannon Barrage Area duration and Turn Start resolution;
- Silver Serpent generation, spending, and permanent upgrade selection;
- Powder Mastery's replacement of Powder Keg ATK Weight with all-Enemy targeting.
