# Enchantment Compendium — English Editorial Review v5

> **DESIGN ONLY · NOT APPROVED · NOT PLAYABLE.** This document contains candidate inscriptions, not enabled gameplay abilities. No recipe or cost is approved by this catalog.

## Authoritative design direction (requested correction)

- **Exactly one Base Effect per named Enchantment.** Rank II and Rank III never unlock additional or unrelated effects.
- **Rank I = Base × 1; Rank II = Ceil(Base × 1.50); Rank III = Ceil(Base × 2.50).** Each scalable magnitude is rounded upward independently.
- **The same trigger, conditions and behavior apply at all three Ranks.** Fixed activation limits, resource costs, cooldowns, target caps, thresholds, source identity, type restrictions, and hard mechanical limits do not scale.
- **Enchantments are exclusive to the equipment kind and compatible chassis IDs listed for the entry.** Weapon effects belong only to their compatible Weapons; Shield, Armor and Accessory effects have separate categories and chassis gates.
- **Item display name:** e.g. `Flamebound Longsword`; inscription heading `Flamebound III`. No generic `Longsword +3` player-facing design for this catalog.
- **No flat Base Power, Final Power, Clash Power or Offensive Level filler.** Effects have meaningful triggers, status usage, costs and counterplay.
- **Compatibility remains design data until an authoritative Item Instance hook enforces it.** This review catalog is not imported into the live runtime. Canonical Status caps/immunities and source-binding/attunement requirements still apply.
- **Economy needs separate approval:** the V1.1 numerical recipes do not grant approval to enchantment-specific prices or materials.

### Rounding examples

| Scalable magnitude | Base I | II · Ceil ×1.50 | III · Ceil ×2.50 |
|:--|--:|--:|--:|
| 1 | 1 | 2 | 3 |
| 2 | 2 | 3 | 5 |
| 3 | 3 | 5 | 8 |
| 4 | 4 | 6 | 10 |
| 5 | 5 | 8 | 13 |
| 6 | 6 | 9 | 15 |

**Total:** 104 draft inscriptions (42 original + 42 elemental/wearer designs + 20 new passive/ward designs) across 14 schools. Equipment classes: 36 weapon, 16 shield, 19 armor, 33 accessory.

## Weapon Enchantments (21)

### Flamebound — Infernal

**Example item:** Flamebound Longsword  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `longsword`, `greatsword`, `rapier`, `scimitar`, `shortsword`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The blade remembers every flame that failed to consume it. When drawn, the embers trapped beneath its edge begin searching for something new to burn.

**Base Effect:** Once per Turn, when a Skill bound to this weapon hits an enemy already suffering Burn, consume 1 Burn Count to unleash 2 Fixed Damage and inflict 2 Burn Potency / 1 Count.

**Rank I (×1.00):** Once per Turn, when a Skill bound to this weapon hits an enemy already suffering Burn, consume 1 Burn Count to unleash 2 Fixed Damage and inflict 2 Burn Potency / 1 Count.

**Rank II (×1.50, Ceil):** Once per Turn, when a Skill bound to this weapon hits an enemy already suffering Burn, consume 1 Burn Count to unleash 3 Fixed Damage and inflict 3 Burn Potency / 2 Count.

**Rank III (×2.50, Ceil):** Once per Turn, when a Skill bound to this weapon hits an enemy already suffering Burn, consume 1 Burn Count to unleash 5 Fixed Damage and inflict 5 Burn Potency / 3 Count.

**Scaling keys:** damage=2, potency=2, count=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Cinder Requiem — Infernal

**Example item:** Cinder Requiem Rapier  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `rapier`, `shortsword`, `scimitar`, `dagger`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> Every life claimed by the weapon leaves one unspoken verse smoldering along its fuller.

**Base Effect:** Once per Turn, a weapon-linked Hit against a Burning enemy consumes 1 Burn Count and transfers 2 Burn Potency / 1 Count to one other enemy within valid range.

**Rank I (×1.00):** Once per Turn, a weapon-linked Hit against a Burning enemy consumes 1 Burn Count and transfers 2 Burn Potency / 1 Count to one other enemy within valid range.

**Rank II (×1.50, Ceil):** Once per Turn, a weapon-linked Hit against a Burning enemy consumes 1 Burn Count and transfers 3 Burn Potency / 2 Count to one other enemy within valid range.

**Rank III (×2.50, Ceil):** Once per Turn, a weapon-linked Hit against a Burning enemy consumes 1 Burn Count and transfers 5 Burn Potency / 3 Count to one other enemy within valid range.

**Scaling keys:** potency=2, count=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Pyrelash — Infernal

**Example item:** Pyrelash Whip  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `whip`, `flail`, `scimitar`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The lash draws fire from unfinished strikes, collecting the heat of blows that almost landed.

**Base Effect:** After losing a Clash with this weapon, store one Spark (maximum 2). Once per Turn, your next weapon-linked Hit may consume one Spark to inflict 2 Burn Potency / 2 Count.

**Rank I (×1.00):** After losing a Clash with this weapon, store one Spark (maximum 2). Once per Turn, your next weapon-linked Hit may consume one Spark to inflict 2 Burn Potency / 2 Count.

**Rank II (×1.50, Ceil):** After losing a Clash with this weapon, store one Spark (maximum 2). Once per Turn, your next weapon-linked Hit may consume one Spark to inflict 3 Burn Potency / 3 Count.

**Rank III (×2.50, Ceil):** After losing a Clash with this weapon, store one Spark (maximum 2). Once per Turn, your next weapon-linked Hit may consume one Spark to inflict 5 Burn Potency / 5 Count.

**Scaling keys:** potency=2, count=2  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Frostwrought — Glacial

**Example item:** Frostwrought Greatsword  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `greatsword`, `longsword`, `greataxe`, `maul`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The edge is not cold; it steals the moment in which the victim expected to move.

**Base Effect:** Once per Turn, the first weapon-linked Hit inflicts 2 Chill Count; if the target already had Chill before that Hit, also inflict 1 Bind for its next Turn.

**Rank I (×1.00):** Once per Turn, the first weapon-linked Hit inflicts 2 Chill Count; if the target already had Chill before that Hit, also inflict 1 Bind for its next Turn.

**Rank II (×1.50, Ceil):** Once per Turn, the first weapon-linked Hit inflicts 3 Chill Count; if the target already had Chill before that Hit, also inflict 2 Bind for its next Turn.

**Rank III (×2.50, Ceil):** Once per Turn, the first weapon-linked Hit inflicts 5 Chill Count; if the target already had Chill before that Hit, also inflict 3 Bind for its next Turn.

**Scaling keys:** chill=2, bind=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Rimeglass — Glacial

**Example item:** Rimeglass Dagger  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `dagger`, `rapier`, `shortsword`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> Cracks along the glass edge spread inward rather than outward; each wound becomes a map of winter.

**Base Effect:** Once per Turn, a weapon-linked Hit on a Chilled target consumes 1 Chill Count to inflict 2 Rupture Potency / 1 Count.

**Rank I (×1.00):** Once per Turn, a weapon-linked Hit on a Chilled target consumes 1 Chill Count to inflict 2 Rupture Potency / 1 Count.

**Rank II (×1.50, Ceil):** Once per Turn, a weapon-linked Hit on a Chilled target consumes 1 Chill Count to inflict 3 Rupture Potency / 2 Count.

**Rank III (×2.50, Ceil):** Once per Turn, a weapon-linked Hit on a Chilled target consumes 1 Chill Count to inflict 5 Rupture Potency / 3 Count.

**Scaling keys:** potency=2, count=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Winter's Grasp — Glacial

**Example item:** Winter's Grasp Spear  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `spear`, `pike`, `lance`, `trident`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The runes do not bind flesh. They slow the decision that precedes escape.

**Base Effect:** Once per Turn, when this weapon hits an enemy with greater Speed than the wielder, inflict 1 Bind for its next Turn and 2 Chill Count.

**Rank I (×1.00):** Once per Turn, when this weapon hits an enemy with greater Speed than the wielder, inflict 1 Bind for its next Turn and 2 Chill Count.

**Rank II (×1.50, Ceil):** Once per Turn, when this weapon hits an enemy with greater Speed than the wielder, inflict 2 Bind for its next Turn and 3 Chill Count.

**Rank III (×2.50, Ceil):** Once per Turn, when this weapon hits an enemy with greater Speed than the wielder, inflict 3 Bind for its next Turn and 5 Chill Count.

**Scaling keys:** bind=1, chill=2  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Stormwake — Tempest

**Example item:** Stormwake Scimitar  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `scimitar`, `shortsword`, `longsword`, `rapier`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The weapon calls lightning only when the wielder dares to finish the exchange.

**Base Effect:** Once per Turn, a weapon-linked Hit inflicts 2 Shock Count. If the target already had Shock before the Hit, move 1 of its Shock Count to one other valid enemy.

**Rank I (×1.00):** Once per Turn, a weapon-linked Hit inflicts 2 Shock Count. If the target already had Shock before the Hit, move 1 of its Shock Count to one other valid enemy.

**Rank II (×1.50, Ceil):** Once per Turn, a weapon-linked Hit inflicts 3 Shock Count. If the target already had Shock before the Hit, move 2 of its Shock Count to one other valid enemy.

**Rank III (×2.50, Ceil):** Once per Turn, a weapon-linked Hit inflicts 5 Shock Count. If the target already had Shock before the Hit, move 3 of its Shock Count to one other valid enemy.

**Scaling keys:** shock=2, transfer=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Thundercall — Tempest

**Example item:** Thundercall Warhammer  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `warhammer`, `maul`, `mace`, `morningstar`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The hammer announces its arrival long after the blow, when every bone remembers the thunder.

**Base Effect:** Once per Turn, after winning a Clash with this weapon against a Shocked enemy, the next Hit of that Skill inflicts 2 Tremor Potency / 1 Count.

**Rank I (×1.00):** Once per Turn, after winning a Clash with this weapon against a Shocked enemy, the next Hit of that Skill inflicts 2 Tremor Potency / 1 Count.

**Rank II (×1.50, Ceil):** Once per Turn, after winning a Clash with this weapon against a Shocked enemy, the next Hit of that Skill inflicts 3 Tremor Potency / 2 Count.

**Rank III (×2.50, Ceil):** Once per Turn, after winning a Clash with this weapon against a Shocked enemy, the next Hit of that Skill inflicts 5 Tremor Potency / 3 Count.

**Scaling keys:** potency=2, count=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Skybreaker — Tempest

**Example item:** Skybreaker Lance  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `lance`, `pike`, `halberd`, `spear`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The spear never chases the sky. It waits for the sky to fall onto its point.

**Base Effect:** Once per Turn, a weapon-linked Hit against an enemy protected by Shield inflicts 2 Shock Count and deals 3 additional damage to the Shield only.

**Rank I (×1.00):** Once per Turn, a weapon-linked Hit against an enemy protected by Shield inflicts 2 Shock Count and deals 3 additional damage to the Shield only.

**Rank II (×1.50, Ceil):** Once per Turn, a weapon-linked Hit against an enemy protected by Shield inflicts 3 Shock Count and deals 5 additional damage to the Shield only.

**Rank III (×2.50, Ceil):** Once per Turn, a weapon-linked Hit against an enemy protected by Shield inflicts 5 Shock Count and deals 8 additional damage to the Shield only.

**Scaling keys:** shock=2, shieldDamage=3  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Bloodthorn — Sanguine

**Example item:** Bloodthorn Dagger  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `dagger`, `rapier`, `shortsword`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> Its crimson barbs bloom only where a living heartbeat answers the thrust.

**Base Effect:** Once per Turn, your first Critical Hit from this weapon inflicts 2 Bleed Potency / 2 Count.

**Rank I (×1.00):** Once per Turn, your first Critical Hit from this weapon inflicts 2 Bleed Potency / 2 Count.

**Rank II (×1.50, Ceil):** Once per Turn, your first Critical Hit from this weapon inflicts 3 Bleed Potency / 3 Count.

**Rank III (×2.50, Ceil):** Once per Turn, your first Critical Hit from this weapon inflicts 5 Bleed Potency / 5 Count.

**Scaling keys:** potency=2, count=2  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Crimson Oath — Sanguine

**Example item:** Crimson Oath Longsword  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `longsword`, `greatsword`, `scimitar`, `rapier`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> Each vow carved into the blade is paid for twice: once in blood, once in what remains.

**Base Effect:** At Turn Start, optionally sacrifice 3 HP; this weapon's next Hit during the Turn inflicts 2 Bleed Potency / 2 Count. Once per Turn.

**Rank I (×1.00):** At Turn Start, optionally sacrifice 3 HP; this weapon's next Hit during the Turn inflicts 2 Bleed Potency / 2 Count. Once per Turn.

**Rank II (×1.50, Ceil):** At Turn Start, optionally sacrifice 3 HP; this weapon's next Hit during the Turn inflicts 3 Bleed Potency / 3 Count. Once per Turn.

**Rank III (×2.50, Ceil):** At Turn Start, optionally sacrifice 3 HP; this weapon's next Hit during the Turn inflicts 5 Bleed Potency / 5 Count. Once per Turn.

**Scaling keys:** potency=2, count=2  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Hollow Fang — Sanguine

**Example item:** Hollow Fang Dagger  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `dagger`, `shortsword`, `sickle`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The fang drinks only what its prey can still afford to lose.

**Base Effect:** Once per Turn, after this weapon hits an enemy already suffering Bleed, restore up to 2 HP, limited by the wearer's missing HP.

**Rank I (×1.00):** Once per Turn, after this weapon hits an enemy already suffering Bleed, restore up to 2 HP, limited by the wearer's missing HP.

**Rank II (×1.50, Ceil):** Once per Turn, after this weapon hits an enemy already suffering Bleed, restore up to 3 HP, limited by the wearer's missing HP.

**Rank III (×2.50, Ceil):** Once per Turn, after this weapon hits an enemy already suffering Bleed, restore up to 5 HP, limited by the wearer's missing HP.

**Scaling keys:** healing=2  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Ruptureloom — Sanguine

**Example item:** Ruptureloom Pike  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `pike`, `spear`, `lance`, `war_pick`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> Fine cracks in the spearhead widen only when the target attempts to continue fighting.

**Base Effect:** Once per Turn, the first weapon-linked Hit inflicts 2 Rupture Potency / 2 Count. On the third Hit by this weapon against the same enemy during this Encounter, trigger existing Rupture once, consuming its normal Count.

**Rank I (×1.00):** Once per Turn, the first weapon-linked Hit inflicts 2 Rupture Potency / 2 Count. On the third Hit by this weapon against the same enemy during this Encounter, trigger existing Rupture once, consuming its normal Count.

**Rank II (×1.50, Ceil):** Once per Turn, the first weapon-linked Hit inflicts 3 Rupture Potency / 3 Count. On the third Hit by this weapon against the same enemy during this Encounter, trigger existing Rupture once, consuming its normal Count.

**Rank III (×2.50, Ceil):** Once per Turn, the first weapon-linked Hit inflicts 5 Rupture Potency / 5 Count. On the third Hit by this weapon against the same enemy during this Encounter, trigger existing Rupture once, consuming its normal Count.

**Scaling keys:** potency=2, count=2  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Heartseeker — Sanguine

**Example item:** Heartseeker Longbow  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `shortbow`, `longbow`, `light_crossbow`, `heavy_crossbow`, `hand_crossbow`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The bowstring tightens around the sound of a failing pulse, not the shape of a target.

**Base Effect:** The first Hit each Turn by this weapon marks one target until your next Turn End; the next Hit from this same weapon against that target inflicts 2 Bleed Potency / 2 Count and clears the mark.

**Rank I (×1.00):** The first Hit each Turn by this weapon marks one target until your next Turn End; the next Hit from this same weapon against that target inflicts 2 Bleed Potency / 2 Count and clears the mark.

**Rank II (×1.50, Ceil):** The first Hit each Turn by this weapon marks one target until your next Turn End; the next Hit from this same weapon against that target inflicts 3 Bleed Potency / 3 Count and clears the mark.

**Rank III (×2.50, Ceil):** The first Hit each Turn by this weapon marks one target until your next Turn End; the next Hit from this same weapon against that target inflicts 5 Bleed Potency / 5 Count and clears the mark.

**Scaling keys:** potency=2, count=2  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Gravewhisper — Umbral

**Example item:** Gravewhisper Sickle  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `sickle`, `glaive`, `scimitar`, `war_pick`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> Its edge carries the last thought of those who never found the strength to scream.

**Base Effect:** Once per Turn, the first Hit from this weapon inflicts 2 Sinking Potency / 2 Count; if that Hit drains the target's last positive SP, recover up to 2 SP.

**Rank I (×1.00):** Once per Turn, the first Hit from this weapon inflicts 2 Sinking Potency / 2 Count; if that Hit drains the target's last positive SP, recover up to 2 SP.

**Rank II (×1.50, Ceil):** Once per Turn, the first Hit from this weapon inflicts 3 Sinking Potency / 3 Count; if that Hit drains the target's last positive SP, recover up to 3 SP.

**Rank III (×2.50, Ceil):** Once per Turn, the first Hit from this weapon inflicts 5 Sinking Potency / 5 Count; if that Hit drains the target's last positive SP, recover up to 5 SP.

**Scaling keys:** potency=2, count=2, sp=2  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Spectral Covenant — Umbral

**Example item:** Spectral Covenant Longsword  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `longsword`, `greatsword`, `rapier`, `spear`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> A half-forgotten oath follows the weapon from the sheath, waiting for an ally's last stand.

**Base Effect:** When an ally crosses a Stagger Threshold, gain one Vow (maximum 2; once per Turn). Your next Hit with this weapon may consume one Vow to inflict 2 Sinking Potency / 1 Count and grant that ally 3 temporary Shield.

**Rank I (×1.00):** When an ally crosses a Stagger Threshold, gain one Vow (maximum 2; once per Turn). Your next Hit with this weapon may consume one Vow to inflict 2 Sinking Potency / 1 Count and grant that ally 3 temporary Shield.

**Rank II (×1.50, Ceil):** When an ally crosses a Stagger Threshold, gain one Vow (maximum 2; once per Turn). Your next Hit with this weapon may consume one Vow to inflict 3 Sinking Potency / 2 Count and grant that ally 5 temporary Shield.

**Rank III (×2.50, Ceil):** When an ally crosses a Stagger Threshold, gain one Vow (maximum 2; once per Turn). Your next Hit with this weapon may consume one Vow to inflict 5 Sinking Potency / 3 Count and grant that ally 8 temporary Shield.

**Scaling keys:** potency=2, count=1, shield=3  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Dawnbound — Sanctified

**Example item:** Dawnbound Longsword  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `longsword`, `greatsword`, `rapier`, `spear`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> Light gathers along the blade only where its bearer refuses to strike an already beaten foe.

**Base Effect:** Once per Turn, a Hit from this weapon against a Shielded enemy inflicts 2 Radiance Count; if the Hit breaks that Shield, additionally inflict 1 Radiance Count.

**Rank I (×1.00):** Once per Turn, a Hit from this weapon against a Shielded enemy inflicts 2 Radiance Count; if the Hit breaks that Shield, additionally inflict 1 Radiance Count.

**Rank II (×1.50, Ceil):** Once per Turn, a Hit from this weapon against a Shielded enemy inflicts 3 Radiance Count; if the Hit breaks that Shield, additionally inflict 2 Radiance Count.

**Rank III (×2.50, Ceil):** Once per Turn, a Hit from this weapon against a Shielded enemy inflicts 5 Radiance Count; if the Hit breaks that Shield, additionally inflict 3 Radiance Count.

**Scaling keys:** radiance=2, breakBonus=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Sunpiercer — Sanctified

**Example item:** Sunpiercer Spear  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `spear`, `lance`, `pike`, `trident`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> Its point does not chase shadows; it makes them confess their shape.

**Base Effect:** Once per Turn, when a Hit from this weapon breaks an enemy Shield, inflict 2 Radiance Count on its owner and remove up to 1 removable temporary concealment layers if any exist.

**Rank I (×1.00):** Once per Turn, when a Hit from this weapon breaks an enemy Shield, inflict 2 Radiance Count on its owner and remove up to 1 removable temporary concealment layers if any exist.

**Rank II (×1.50, Ceil):** Once per Turn, when a Hit from this weapon breaks an enemy Shield, inflict 3 Radiance Count on its owner and remove up to 2 removable temporary concealment layers if any exist.

**Rank III (×2.50, Ceil):** Once per Turn, when a Hit from this weapon breaks an enemy Shield, inflict 5 Radiance Count on its owner and remove up to 3 removable temporary concealment layers if any exist.

**Scaling keys:** radiance=2, concealment=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Gravemark — Anomalous

**Example item:** Gravemark Warhammer  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `warhammer`, `maul`, `mace`, `morningstar`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> Each blow leaves the memory of a second impact that has not happened yet.

**Base Effect:** Once per Turn, the first Hit from this weapon inflicts 2 Tremor Potency / 2 Count. After the third Hit against the same enemy in this Encounter, trigger Tremor Burst once if it has Tremor.

**Rank I (×1.00):** Once per Turn, the first Hit from this weapon inflicts 2 Tremor Potency / 2 Count. After the third Hit against the same enemy in this Encounter, trigger Tremor Burst once if it has Tremor.

**Rank II (×1.50, Ceil):** Once per Turn, the first Hit from this weapon inflicts 3 Tremor Potency / 3 Count. After the third Hit against the same enemy in this Encounter, trigger Tremor Burst once if it has Tremor.

**Rank III (×2.50, Ceil):** Once per Turn, the first Hit from this weapon inflicts 5 Tremor Potency / 5 Count. After the third Hit against the same enemy in this Encounter, trigger Tremor Burst once if it has Tremor.

**Scaling keys:** potency=2, count=2  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Chains of Ruin — Anomalous

**Example item:** Chains of Ruin Whip  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `whip`, `flail`, `glaive`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The links have no length until their victim tries to move away.

**Base Effect:** Once per Turn, the first weapon-linked Hit inflicts 1 Bind for the target's next Turn. If that Bound enemy attacks an ally before Bind expires, it receives 2 Rupture Potency / 1 Count.

**Rank I (×1.00):** Once per Turn, the first weapon-linked Hit inflicts 1 Bind for the target's next Turn. If that Bound enemy attacks an ally before Bind expires, it receives 2 Rupture Potency / 1 Count.

**Rank II (×1.50, Ceil):** Once per Turn, the first weapon-linked Hit inflicts 2 Bind for the target's next Turn. If that Bound enemy attacks an ally before Bind expires, it receives 3 Rupture Potency / 2 Count.

**Rank III (×2.50, Ceil):** Once per Turn, the first weapon-linked Hit inflicts 3 Bind for the target's next Turn. If that Bound enemy attacks an ally before Bind expires, it receives 5 Rupture Potency / 3 Count.

**Scaling keys:** bind=1, potency=2, count=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Nullwake — Anomalous

**Example item:** Nullwake Dagger  
**Equipment kind:** `weapon`  
**Compatible canonical chassis IDs:** `dagger`, `rapier`, `shortsword`, `war_pick`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> Everything near the relic becomes momentarily uncertain of the rules that hold it together.

**Base Effect:** Once per Turn, when this weapon Hits an enemy carrying a removable temporary positive Status, remove up to 1 Count from one such Status of your choice.

**Rank I (×1.00):** Once per Turn, when this weapon Hits an enemy carrying a removable temporary positive Status, remove up to 1 Count from one such Status of your choice.

**Rank II (×1.50, Ceil):** Once per Turn, when this weapon Hits an enemy carrying a removable temporary positive Status, remove up to 2 Count from one such Status of your choice.

**Rank III (×2.50, Ceil):** Once per Turn, when this weapon Hits an enemy carrying a removable temporary positive Status, remove up to 3 Count from one such Status of your choice.

**Scaling keys:** count=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

## Armor Enchantments (6)

### Emberheart — Infernal

**Example item:** Emberheart Breastplate  
**Equipment kind:** `armor`  
**Compatible canonical chassis IDs:** `breastplate`, `half_plate`, `chain_mail`, `plate_armor`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> There is no warmth in the gem until the wearer has suffered for someone else.

**Base Effect:** Once per Turn, direct enemy damage to your HP stores one Ember (maximum 2). At next Turn Start, consume the stored Ember to gain 4 temporary Shield per charge.

**Rank I (×1.00):** Once per Turn, direct enemy damage to your HP stores one Ember (maximum 2). At next Turn Start, consume the stored Ember to gain 4 temporary Shield per charge.

**Rank II (×1.50, Ceil):** Once per Turn, direct enemy damage to your HP stores one Ember (maximum 2). At next Turn Start, consume the stored Ember to gain 6 temporary Shield per charge.

**Rank III (×2.50, Ceil):** Once per Turn, direct enemy damage to your HP stores one Ember (maximum 2). At next Turn Start, consume the stored Ember to gain 10 temporary Shield per charge.

**Scaling keys:** shield=4  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Whiteout — Glacial

**Example item:** Whiteout Leather Armor  
**Equipment kind:** `armor`  
**Compatible canonical chassis IDs:** `padded_armor`, `leather_armor`, `hide_armor`, `chain_shirt`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The ward sheds snow that is never there, concealing the bearer in the instant before impact.

**Base Effect:** Once per Turn, when a direct enemy Attack Skill misses the wearer, inflict 2 Chill Count on that attacker; if it had Chill before missing, gain 3 temporary Shield.

**Rank I (×1.00):** Once per Turn, when a direct enemy Attack Skill misses the wearer, inflict 2 Chill Count on that attacker; if it had Chill before missing, gain 3 temporary Shield.

**Rank II (×1.50, Ceil):** Once per Turn, when a direct enemy Attack Skill misses the wearer, inflict 3 Chill Count on that attacker; if it had Chill before missing, gain 5 temporary Shield.

**Rank III (×2.50, Ceil):** Once per Turn, when a direct enemy Attack Skill misses the wearer, inflict 5 Chill Count on that attacker; if it had Chill before missing, gain 8 temporary Shield.

**Scaling keys:** chill=2, shield=3  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Static Veil — Tempest

**Example item:** Static Veil Chain Mail  
**Equipment kind:** `armor`  
**Compatible canonical chassis IDs:** `chain_shirt`, `scale_mail`, `ring_mail`, `chain_mail`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The air catches against the armor, holding every missed strike like a debt unpaid.

**Base Effect:** Once per Turn, when a direct enemy Attack Skill misses the wearer, inflict 2 Shock Count on the attacker. If the attacker already had Shock, gain 3 temporary Shield.

**Rank I (×1.00):** Once per Turn, when a direct enemy Attack Skill misses the wearer, inflict 2 Shock Count on the attacker. If the attacker already had Shock, gain 3 temporary Shield.

**Rank II (×1.50, Ceil):** Once per Turn, when a direct enemy Attack Skill misses the wearer, inflict 3 Shock Count on the attacker. If the attacker already had Shock, gain 5 temporary Shield.

**Rank III (×2.50, Ceil):** Once per Turn, when a direct enemy Attack Skill misses the wearer, inflict 5 Shock Count on the attacker. If the attacker already had Shock, gain 8 temporary Shield.

**Scaling keys:** shock=2, shield=3  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Butcher's Hymn — Sanguine

**Example item:** Butcher's Hymn Breastplate  
**Equipment kind:** `armor`  
**Compatible canonical chassis IDs:** `breastplate`, `half_plate`, `chain_mail`, `plate_armor`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The plates hum louder with every wound their owner survives, refusing the comfort of silence.

**Base Effect:** Once per Turn, when direct enemy damage reduces the wearer's HP, gain 2 Poise Potency / 2 Count.

**Rank I (×1.00):** Once per Turn, when direct enemy damage reduces the wearer's HP, gain 2 Poise Potency / 2 Count.

**Rank II (×1.50, Ceil):** Once per Turn, when direct enemy damage reduces the wearer's HP, gain 3 Poise Potency / 3 Count.

**Rank III (×2.50, Ceil):** Once per Turn, when direct enemy damage reduces the wearer's HP, gain 5 Poise Potency / 5 Count.

**Scaling keys:** potency=2, count=2  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Halo of Ash — Sanctified

**Example item:** Halo of Ash Breastplate  
**Equipment kind:** `armor`  
**Compatible canonical chassis IDs:** `breastplate`, `half_plate`, `chain_mail`, `plate_armor`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> Its halo shines only after the armor has failed to keep another from pain.

**Base Effect:** Once per Turn, after legally intercepting direct enemy damage intended for an ally, gain 1 Protection for the next Turn and grant that ally 4 temporary Shield.

**Rank I (×1.00):** Once per Turn, after legally intercepting direct enemy damage intended for an ally, gain 1 Protection for the next Turn and grant that ally 4 temporary Shield.

**Rank II (×1.50, Ceil):** Once per Turn, after legally intercepting direct enemy damage intended for an ally, gain 2 Protection for the next Turn and grant that ally 6 temporary Shield.

**Rank III (×2.50, Ceil):** Once per Turn, after legally intercepting direct enemy damage intended for an ally, gain 3 Protection for the next Turn and grant that ally 10 temporary Shield.

**Scaling keys:** protection=1, shield=4  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Requiem Coil — Anomalous

**Example item:** Requiem Coil Breastplate  
**Equipment kind:** `armor`  
**Compatible canonical chassis IDs:** `breastplate`, `half_plate`, `splint_armor`, `plate_armor`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The coil listens to blows. When it speaks, it repeats only what the bearer survived.

**Base Effect:** Once per Turn, when your Guard prevents direct enemy damage while wearing this armor, store up to 4 prevented damage. Your next weapon-linked Hit spends that Memory to deal equal extra Fixed Damage.

**Rank I (×1.00):** Once per Turn, when your Guard prevents direct enemy damage while wearing this armor, store up to 4 prevented damage. Your next weapon-linked Hit spends that Memory to deal equal extra Fixed Damage.

**Rank II (×1.50, Ceil):** Once per Turn, when your Guard prevents direct enemy damage while wearing this armor, store up to 6 prevented damage. Your next weapon-linked Hit spends that Memory to deal equal extra Fixed Damage.

**Rank III (×2.50, Ceil):** Once per Turn, when your Guard prevents direct enemy damage while wearing this armor, store up to 10 prevented damage. Your next weapon-linked Hit spends that Memory to deal equal extra Fixed Damage.

**Scaling keys:** memory=4  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

## Shield Enchantments (6)

### Ashwake — Infernal

**Example item:** Ashwake Tower Shield  
**Equipment kind:** `shield`  
**Compatible canonical chassis IDs:** `shield_round`, `shield_heater`, `shield_tower`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> A black furnace sleeps behind the plating, opening its vents only when its bearer stands against the tide.

**Base Effect:** Once per Turn, after a Guard with this shield prevents enemy damage, the attacker suffers 2 Burn Potency / 1 Count.

**Rank I (×1.00):** Once per Turn, after a Guard with this shield prevents enemy damage, the attacker suffers 2 Burn Potency / 1 Count.

**Rank II (×1.50, Ceil):** Once per Turn, after a Guard with this shield prevents enemy damage, the attacker suffers 3 Burn Potency / 2 Count.

**Rank III (×2.50, Ceil):** Once per Turn, after a Guard with this shield prevents enemy damage, the attacker suffers 5 Burn Potency / 3 Count.

**Scaling keys:** potency=2, count=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Permafrost — Glacial

**Example item:** Permafrost Tower Shield  
**Equipment kind:** `shield`  
**Compatible canonical chassis IDs:** `shield_round`, `shield_heater`, `shield_tower`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> A sealed glacier is layered into the metal; what it cannot stop it refuses to release.

**Base Effect:** Once per Turn, after this shield successfully prevents direct damage through Guard, store up to 4 prevented damage. At next Turn Start convert the stored damage into equal temporary Shield and clear it.

**Rank I (×1.00):** Once per Turn, after this shield successfully prevents direct damage through Guard, store up to 4 prevented damage. At next Turn Start convert the stored damage into equal temporary Shield and clear it.

**Rank II (×1.50, Ceil):** Once per Turn, after this shield successfully prevents direct damage through Guard, store up to 6 prevented damage. At next Turn Start convert the stored damage into equal temporary Shield and clear it.

**Rank III (×2.50, Ceil):** Once per Turn, after this shield successfully prevents direct damage through Guard, store up to 10 prevented damage. At next Turn Start convert the stored damage into equal temporary Shield and clear it.

**Scaling keys:** memory=4  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Stormcage — Tempest

**Example item:** Stormcage Buckler  
**Equipment kind:** `shield`  
**Compatible canonical chassis IDs:** `shield_buckler`, `shield_round`, `shield_heater`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> Copper veins across the shield pulse whenever an enemy mistakes its silence for safety.

**Base Effect:** Once per Turn, a successful Guard with this shield inflicts 2 Shock Count on the attacker. When this instance's Shock converts into Paralysis, gain 4 temporary Shield.

**Rank I (×1.00):** Once per Turn, a successful Guard with this shield inflicts 2 Shock Count on the attacker. When this instance's Shock converts into Paralysis, gain 4 temporary Shield.

**Rank II (×1.50, Ceil):** Once per Turn, a successful Guard with this shield inflicts 3 Shock Count on the attacker. When this instance's Shock converts into Paralysis, gain 6 temporary Shield.

**Rank III (×2.50, Ceil):** Once per Turn, a successful Guard with this shield inflicts 5 Shock Count on the attacker. When this instance's Shock converts into Paralysis, gain 10 temporary Shield.

**Scaling keys:** shock=2, shield=4  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Void Anchor — Umbral

**Example item:** Void Anchor Heater Shield  
**Equipment kind:** `shield`  
**Compatible canonical chassis IDs:** `shield_round`, `shield_heater`, `shield_tower`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The sigil weighs nothing until the moment something tries to escape its reach.

**Base Effect:** Once per Turn, after a Guard with this shield against a melee attacker, inflict 1 Bind for its next Turn. If that attacker Hits the bearer while Bound, gain 4 temporary Shield after taking the damage.

**Rank I (×1.00):** Once per Turn, after a Guard with this shield against a melee attacker, inflict 1 Bind for its next Turn. If that attacker Hits the bearer while Bound, gain 4 temporary Shield after taking the damage.

**Rank II (×1.50, Ceil):** Once per Turn, after a Guard with this shield against a melee attacker, inflict 2 Bind for its next Turn. If that attacker Hits the bearer while Bound, gain 6 temporary Shield after taking the damage.

**Rank III (×2.50, Ceil):** Once per Turn, after a Guard with this shield against a melee attacker, inflict 3 Bind for its next Turn. If that attacker Hits the bearer while Bound, gain 10 temporary Shield after taking the damage.

**Scaling keys:** bind=1, shield=4  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Oathkeeper — Sanctified

**Example item:** Oathkeeper Tower Shield  
**Equipment kind:** `shield`  
**Compatible canonical chassis IDs:** `shield_round`, `shield_heater`, `shield_tower`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> Every name carved into the shield is an oath that outlived its author.

**Base Effect:** Choose one ally at Encounter Start. Once per Turn, after legally intercepting a direct attack intended for that ally with this shield, gain 4 temporary Shield before receiving the intercepted damage.

**Rank I (×1.00):** Choose one ally at Encounter Start. Once per Turn, after legally intercepting a direct attack intended for that ally with this shield, gain 4 temporary Shield before receiving the intercepted damage.

**Rank II (×1.50, Ceil):** Choose one ally at Encounter Start. Once per Turn, after legally intercepting a direct attack intended for that ally with this shield, gain 6 temporary Shield before receiving the intercepted damage.

**Rank III (×2.50, Ceil):** Choose one ally at Encounter Start. Once per Turn, after legally intercepting a direct attack intended for that ally with this shield, gain 10 temporary Shield before receiving the intercepted damage.

**Scaling keys:** shield=4  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Radiant Bastion — Sanctified

**Example item:** Radiant Bastion Heater Shield  
**Equipment kind:** `shield`  
**Compatible canonical chassis IDs:** `shield_round`, `shield_heater`, `shield_tower`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The fortress engraved inside the metal is not a place. It is a promise the bearer must keep.

**Base Effect:** Once per Turn, when a Guard with this shield prevents enemy damage, distribute 4 total temporary Shield between up to two nearby allies.

**Rank I (×1.00):** Once per Turn, when a Guard with this shield prevents enemy damage, distribute 4 total temporary Shield between up to two nearby allies.

**Rank II (×1.50, Ceil):** Once per Turn, when a Guard with this shield prevents enemy damage, distribute 6 total temporary Shield between up to two nearby allies.

**Rank III (×2.50, Ceil):** Once per Turn, when a Guard with this shield prevents enemy damage, distribute 10 total temporary Shield between up to two nearby allies.

**Scaling keys:** shield=4  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

## Accessory Enchantments (9)

### Scorchweave — Infernal

**Example item:** Scorchweave Brooch  
**Equipment kind:** `accessory`  
**Compatible canonical chassis IDs:** `brooch`, `bracelet`, `anklet`, `pendant`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The cloth weighs nothing, yet smoke coils behind every motion its owner refuses to finish.

**Base Effect:** Once per Turn, a successful Evade marks the attacker until Turn End; the first Hit from one of your equipped weapons against that marked attacker inflicts 2 Burn Potency / 1 Count and consumes the mark.

**Rank I (×1.00):** Once per Turn, a successful Evade marks the attacker until Turn End; the first Hit from one of your equipped weapons against that marked attacker inflicts 2 Burn Potency / 1 Count and consumes the mark.

**Rank II (×1.50, Ceil):** Once per Turn, a successful Evade marks the attacker until Turn End; the first Hit from one of your equipped weapons against that marked attacker inflicts 3 Burn Potency / 2 Count and consumes the mark.

**Rank III (×2.50, Ceil):** Once per Turn, a successful Evade marks the attacker until Turn End; the first Hit from one of your equipped weapons against that marked attacker inflicts 5 Burn Potency / 3 Count and consumes the mark.

**Scaling keys:** potency=2, count=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Black Ice — Glacial

**Example item:** Black Ice Anklet  
**Equipment kind:** `accessory`  
**Compatible canonical chassis IDs:** `anklet`, `bracelet`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> Each step leaves a shadow of ice a heartbeat behind the foot that made it.

**Base Effect:** Once per Turn, a successful Evade grants 1 Haste next Turn; if the attacker already had Chill, extend that attacker's Chill Count by 2.

**Rank I (×1.00):** Once per Turn, a successful Evade grants 1 Haste next Turn; if the attacker already had Chill, extend that attacker's Chill Count by 2.

**Rank II (×1.50, Ceil):** Once per Turn, a successful Evade grants 2 Haste next Turn; if the attacker already had Chill, extend that attacker's Chill Count by 3.

**Rank III (×2.50, Ceil):** Once per Turn, a successful Evade grants 3 Haste next Turn; if the attacker already had Chill, extend that attacker's Chill Count by 5.

**Scaling keys:** haste=1, chill=2  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Galeheart — Tempest

**Example item:** Galeheart Bracelet  
**Equipment kind:** `accessory`  
**Compatible canonical chassis IDs:** `bracelet`, `anklet`, `earrings`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> A trapped storm beats against the wearer's pulse whenever the battlefield changes direction.

**Base Effect:** Once per Turn, after a successful Evade, gain 1 Haste next Turn. If the attacker already had Bind, extend that Bind by 1.

**Rank I (×1.00):** Once per Turn, after a successful Evade, gain 1 Haste next Turn. If the attacker already had Bind, extend that Bind by 1.

**Rank II (×1.50, Ceil):** Once per Turn, after a successful Evade, gain 2 Haste next Turn. If the attacker already had Bind, extend that Bind by 2.

**Rank III (×2.50, Ceil):** Once per Turn, after a successful Evade, gain 3 Haste next Turn. If the attacker already had Bind, extend that Bind by 3.

**Scaling keys:** haste=1, bind=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Drownsong — Umbral

**Example item:** Drownsong Ring  
**Equipment kind:** `accessory`  
**Compatible canonical chassis IDs:** `ring`, `pendant`, `necklace`, `brooch`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The ring sings beneath running water, but only the wearer hears the drowned choir.

**Base Effect:** Once per Turn, after direct enemy effects lower the wearer's SP, inflict 2 Sinking Potency / 1 Count on the responsible enemy.

**Rank I (×1.00):** Once per Turn, after direct enemy effects lower the wearer's SP, inflict 2 Sinking Potency / 1 Count on the responsible enemy.

**Rank II (×1.50, Ceil):** Once per Turn, after direct enemy effects lower the wearer's SP, inflict 3 Sinking Potency / 2 Count on the responsible enemy.

**Rank III (×2.50, Ceil):** Once per Turn, after direct enemy effects lower the wearer's SP, inflict 5 Sinking Potency / 3 Count on the responsible enemy.

**Scaling keys:** potency=2, count=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Nightfall — Umbral

**Example item:** Nightfall Pendant  
**Equipment kind:** `accessory`  
**Compatible canonical chassis IDs:** `pendant`, `anklet`, `brooch`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> No torch can settle on its silhouette; every witness remembers a different outline.

**Base Effect:** Once per Turn, after a successful Evade, become Veiled until Turn End. Your next successful Attack Skill against a valid target while Veiled inflicts 2 Sinking Potency / 1 Count and ends Veiled.

**Rank I (×1.00):** Once per Turn, after a successful Evade, become Veiled until Turn End. Your next successful Attack Skill against a valid target while Veiled inflicts 2 Sinking Potency / 1 Count and ends Veiled.

**Rank II (×1.50, Ceil):** Once per Turn, after a successful Evade, become Veiled until Turn End. Your next successful Attack Skill against a valid target while Veiled inflicts 3 Sinking Potency / 2 Count and ends Veiled.

**Rank III (×2.50, Ceil):** Once per Turn, after a successful Evade, become Veiled until Turn End. Your next successful Attack Skill against a valid target while Veiled inflicts 5 Sinking Potency / 3 Count and ends Veiled.

**Scaling keys:** potency=2, count=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Eclipsed Crown — Umbral

**Example item:** Eclipsed Crown Brooch  
**Equipment kind:** `accessory`  
**Compatible canonical chassis IDs:** `brooch`, `ring`, `pendant`, `hairpin`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The crown turns whispers into debts, and demands a memory every time it answers.

**Base Effect:** At Turn Start, pay 4 SP to mark one visible enemy until Turn End. Once per Turn, the next successful Attack Skill against that target inflicts 3 Sinking Potency / 1 Count and clears the mark.

**Rank I (×1.00):** At Turn Start, pay 4 SP to mark one visible enemy until Turn End. Once per Turn, the next successful Attack Skill against that target inflicts 3 Sinking Potency / 1 Count and clears the mark.

**Rank II (×1.50, Ceil):** At Turn Start, pay 4 SP to mark one visible enemy until Turn End. Once per Turn, the next successful Attack Skill against that target inflicts 5 Sinking Potency / 2 Count and clears the mark.

**Rank III (×2.50, Ceil):** At Turn Start, pay 4 SP to mark one visible enemy until Turn End. Once per Turn, the next successful Attack Skill against that target inflicts 8 Sinking Potency / 3 Count and clears the mark.

**Scaling keys:** potency=3, count=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Mercy's Last Light — Sanctified

**Example item:** Mercy's Last Light Pendant  
**Equipment kind:** `accessory`  
**Compatible canonical chassis IDs:** `pendant`, `necklace`, `brooch`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The glass lantern brightens in proportion to how much its owner cannot bear to lose.

**Base Effect:** Once per Turn, when a nearby ally drops below 30% HP after direct enemy damage, spend 4 SP to grant that ally 6 temporary Shield.

**Rank I (×1.00):** Once per Turn, when a nearby ally drops below 30% HP after direct enemy damage, spend 4 SP to grant that ally 6 temporary Shield.

**Rank II (×1.50, Ceil):** Once per Turn, when a nearby ally drops below 30% HP after direct enemy damage, spend 4 SP to grant that ally 9 temporary Shield.

**Rank III (×2.50, Ceil):** Once per Turn, when a nearby ally drops below 30% HP after direct enemy damage, spend 4 SP to grant that ally 15 temporary Shield.

**Scaling keys:** shield=6  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Mirrorheart — Anomalous

**Example item:** Mirrorheart Pendant  
**Equipment kind:** `accessory`  
**Compatible canonical chassis IDs:** `pendant`, `brooch`, `ring`, `necklace`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The surface reflects the wounds it sees rather than the face that wears it.

**Base Effect:** Once per Turn, after an enemy directly Hits you and inflicts Burn, Bleed, or Sinking, record up to 2 Potency / 1 Count of one such Status. Your next successful Attack Skill inflicts the stored Status on its target and empties the mirror.

**Rank I (×1.00):** Once per Turn, after an enemy directly Hits you and inflicts Burn, Bleed, or Sinking, record up to 2 Potency / 1 Count of one such Status. Your next successful Attack Skill inflicts the stored Status on its target and empties the mirror.

**Rank II (×1.50, Ceil):** Once per Turn, after an enemy directly Hits you and inflicts Burn, Bleed, or Sinking, record up to 3 Potency / 2 Count of one such Status. Your next successful Attack Skill inflicts the stored Status on its target and empties the mirror.

**Rank III (×2.50, Ceil):** Once per Turn, after an enemy directly Hits you and inflicts Burn, Bleed, or Sinking, record up to 5 Potency / 3 Count of one such Status. Your next successful Attack Skill inflicts the stored Status on its target and empties the mirror.

**Scaling keys:** potency=2, count=1  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

### Chronolock — Anomalous

**Example item:** Chronolock Bracelet  
**Equipment kind:** `accessory`  
**Compatible canonical chassis IDs:** `bracelet`, `ring`, `anklet`  
**Review status:** PROPOSED · NOT IMPLEMENTED

> The watch has thirteen hands. The thirteenth moves only when the wearer has made a choice it cannot undo.

**Base Effect:** Once per Encounter, borrow one Quick Action this Turn and lose one Quick Action next Turn as an unavoidable debt. When the debt is paid, gain 4 temporary Shield.

**Rank I (×1.00):** Once per Encounter, borrow one Quick Action this Turn and lose one Quick Action next Turn as an unavoidable debt. When the debt is paid, gain 4 temporary Shield.

**Rank II (×1.50, Ceil):** Once per Encounter, borrow one Quick Action this Turn and lose one Quick Action next Turn as an unavoidable debt. When the debt is paid, gain 6 temporary Shield.

**Rank III (×2.50, Ceil):** Once per Encounter, borrow one Quick Action this Turn and lose one Quick Action next Turn as an unavoidable debt. When the debt is paid, gain 10 temporary Shield.

**Scaling keys:** shield=4  
**Restrictions:** Compatible chassis only. The trigger, activation frequency, threshold, resource costs, valid targets, and any 'one charge' requirements do not scale. Existing Status caps, immunity, source binding and attunement still apply. No recursive self-triggering.

---

## Approval and engineering checklist

- [ ] Approve the name and lore for each inscription.
- [ ] Confirm the unique base mechanic (no new effects in higher Ranks).
- [ ] Confirm each scalable magnitude and the integer Ceil outputs for all three Ranks.
- [ ] Confirm authoritative equipment kind/chassis compatibility and composed Item Instance IDs.
- [ ] Confirm on-hit/guard/evade/critical/turn-end event sources and activation timing.
- [ ] Check for recursion, infinite loops, Status immunity/caps, legal targets, and legal action costs.
- [ ] Approve item rarity, crafting ingredients, labor AHN and Attunement separately.
- [ ] Integrate and test a named-enchantment engine *after* all review decisions; do not represent this design dataset as implemented.

## Volume II — Elemental & Wearer-Centric Expansion (42 new inscriptions)

**Source of new designs:** editorial proposals researched against the existing Luminous Status Library, Elemental Status Runtime, Trait Engine trigger list, and canonical weapon/armor/shield/accessory chassis catalogs. They are not claims of existing active gameplay support.

### What the new volume introduces

- **Elemental expansions:** Infernal (Fire / Burn), Glacial (Cold / Chill), Tempest (Lightning / Shock), Corrosive (Acid / Corrosion), Venomous (Poison), Tidal (water fantasy resolved with existing Sinking, Bind, Shield and Haste rather than an invented Wet status), and Geomantic (Earth / Tremor / Stagger).
- **Bearer-centric enchantments:** conditional HP recovery, SP restoration or SP costs, Speed via Haste/Bind, situational Offensive Level Up/Down and Defensive Level Up/Down, temporary Ability Score increases (STR/DEX/CON/INT/WIS/CHA).
- **Single-effect scaling preserved:** all the new enchantments retain their exact trigger, cost, threshold, duration and compatible chassis at Rank I–III; only their named numeric magnitudes scale by Ceil(1× / 1.5× / 2.5×).
- **Ability Score warning:** temporary STR/DEX/CON/INT/WIS/CHA Score modifications are design-only. Canonical score, Check and Save authority must prevent a temporary bonus from permanently altering maximum HP, inventory capacity, progression or other persisted stats.
- **Offense / Defense warning:** these use bounded existing Statuses (Offensive Level Up/Down, Defensive Level Up/Down), not unconditional flat Base Power / Clash Power / Final Power grants.

### Infernal — 2 new

#### Hellbrand (WEAPON)

**Item example:** Hellbrand Longsword  
**Compatible canonical chassis IDs:** `longsword`, `greatsword`, `scimitar`  
**Combat axes:** Fire / SP / Status  
**Status:** PROPOSED / NOT IMPLEMENTED

> The steel eats its master's breath so the world may choke on its smoke.

**Single Base Effect:** Once per Turn at Turn Start, pay 3 SP to prime this weapon until Turn End. The next weapon-linked Hit inflicts 2 Burn Potency / 2 Count, then clears the priming.

**Rank I (×1.00):** Once per Turn at Turn Start, pay 3 SP to prime this weapon until Turn End. The next weapon-linked Hit inflicts 2 Burn Potency / 2 Count, then clears the priming.

**Rank II (×1.50, Ceil):** Once per Turn at Turn Start, pay 3 SP to prime this weapon until Turn End. The next weapon-linked Hit inflicts 3 Burn Potency / 3 Count, then clears the priming.

**Rank III (×2.50, Ceil):** Once per Turn at Turn Start, pay 3 SP to prime this weapon until Turn End. The next weapon-linked Hit inflicts 5 Burn Potency / 5 Count, then clears the priming.

**Scalable magnitudes:** potency=2; count=2  
**Restrictions:** The 3 SP payment is fixed, not multiplied; miss forfeits the priming. No free damage, SP debt cannot go below zero.

---

#### Phoenix Tether (ARMOR)

**Item example:** Phoenix Tether Breastplate  
**Compatible canonical chassis IDs:** `breastplate`, `half_plate`, `plate_armor`  
**Combat axes:** Fire / HP / Survival  
**Status:** PROPOSED / NOT IMPLEMENTED

> Each seam is tied with an ember saved from a funeral pyre; when the body falters, the thread begins to burn.

**Single Base Effect:** Once per Encounter, after direct enemy damage drops you below 25% HP but leaves you alive, recover 5 HP at the next Turn Start and suffer 1 Burn Count (1 Potency) as a fixed backlash.

**Rank I (×1.00):** Once per Encounter, after direct enemy damage drops you below 25% HP but leaves you alive, recover 5 HP at the next Turn Start and suffer 1 Burn Count (1 Potency) as a fixed backlash.

**Rank II (×1.50, Ceil):** Once per Encounter, after direct enemy damage drops you below 25% HP but leaves you alive, recover 8 HP at the next Turn Start and suffer 1 Burn Count (1 Potency) as a fixed backlash.

**Rank III (×2.50, Ceil):** Once per Encounter, after direct enemy damage drops you below 25% HP but leaves you alive, recover 13 HP at the next Turn Start and suffer 1 Burn Count (1 Potency) as a fixed backlash.

**Scalable magnitudes:** healing=5  
**Restrictions:** The 25% threshold and self-Burn backlash stay fixed. Healing cannot resurrect, prevent the triggering hit, or exceed missing HP.

---

### Glacial — 2 new

#### Everfrost Seal (ACCESSORY)

**Item example:** Everfrost Seal Pendant  
**Compatible canonical chassis IDs:** `ring`, `pendant`, `necklace`  
**Combat axes:** Cold / SP / Status  
**Status:** PROPOSED / NOT IMPLEMENTED

> A drop of glacial silence is suspended inside the jewel, waiting to drink back the cold.

**Single Base Effect:** Once per Turn at Turn Start, if you have Chill, remove exactly 1 Chill Count and restore 3 SP.

**Rank I (×1.00):** Once per Turn at Turn Start, if you have Chill, remove exactly 1 Chill Count and restore 3 SP.

**Rank II (×1.50, Ceil):** Once per Turn at Turn Start, if you have Chill, remove exactly 1 Chill Count and restore 5 SP.

**Rank III (×2.50, Ceil):** Once per Turn at Turn Start, if you have Chill, remove exactly 1 Chill Count and restore 8 SP.

**Scalable magnitudes:** sp=3  
**Restrictions:** Chill expenditure remains one across Ranks. No SP restoration without actual Chill, and no extension of Chill or immunity bypass.

---

#### Icevein Bulwark (SHIELD)

**Item example:** Icevein Bulwark Heater Shield  
**Compatible canonical chassis IDs:** `shield_heater`, `shield_tower`, `shield_round`  
**Combat axes:** Cold / Defensive Level / Status  
**Status:** PROPOSED / NOT IMPLEMENTED

> The shield's heart is colder than the air around it, hardening when a winter-marked hand strikes.

**Single Base Effect:** Once per Turn, when a Guard with this shield prevents direct damage from an attacker already affected by Chill, gain 1 Defensive Level Up for your next Turn.

**Rank I (×1.00):** Once per Turn, when a Guard with this shield prevents direct damage from an attacker already affected by Chill, gain 1 Defensive Level Up for your next Turn.

**Rank II (×1.50, Ceil):** Once per Turn, when a Guard with this shield prevents direct damage from an attacker already affected by Chill, gain 2 Defensive Level Up for your next Turn.

**Rank III (×2.50, Ceil):** Once per Turn, when a Guard with this shield prevents direct damage from an attacker already affected by Chill, gain 3 Defensive Level Up for your next Turn.

**Scalable magnitudes:** defense=1  
**Restrictions:** Requires attacker to already have Chill before the Guard. Never changes the current Guard's result retroactively.

---

### Tempest — 2 new

#### Thunderstride (ACCESSORY)

**Item example:** Thunderstride Anklet  
**Compatible canonical chassis IDs:** `anklet`, `bracelet`  
**Combat axes:** Lightning / Speed / Status  
**Status:** PROPOSED / NOT IMPLEMENTED

> Lightning jumps from every step; the wearer learns to move before thunder chooses a direction.

**Single Base Effect:** Once per Turn, when your own Attack Skill inflicts Shock on a target, gain 1 Haste for your next Turn.

**Rank I (×1.00):** Once per Turn, when your own Attack Skill inflicts Shock on a target, gain 1 Haste for your next Turn.

**Rank II (×1.50, Ceil):** Once per Turn, when your own Attack Skill inflicts Shock on a target, gain 2 Haste for your next Turn.

**Rank III (×2.50, Ceil):** Once per Turn, when your own Attack Skill inflicts Shock on a target, gain 3 Haste for your next Turn.

**Scalable magnitudes:** haste=1  
**Restrictions:** Haste follows canonical duration and cannot generate new Action Slots. A single Skill inflicting multiple Shock packets triggers once.

---

#### Tempest Crown (WEAPON)

**Item example:** Tempest Crown Scimitar  
**Compatible canonical chassis IDs:** `longsword`, `scimitar`, `rapier`  
**Combat axes:** Lightning / Offensive Level / Status  
**Status:** PROPOSED / NOT IMPLEMENTED

> Every successful discharge leaves the wielder one heartbeat ahead of the storm.

**Single Base Effect:** Once per Turn, after a weapon-linked Hit against an enemy already carrying Shock, gain 1 Offensive Level Up on the next weapon-linked Skill this Turn.

**Rank I (×1.00):** Once per Turn, after a weapon-linked Hit against an enemy already carrying Shock, gain 1 Offensive Level Up on the next weapon-linked Skill this Turn.

**Rank II (×1.50, Ceil):** Once per Turn, after a weapon-linked Hit against an enemy already carrying Shock, gain 2 Offensive Level Up on the next weapon-linked Skill this Turn.

**Rank III (×2.50, Ceil):** Once per Turn, after a weapon-linked Hit against an enemy already carrying Shock, gain 3 Offensive Level Up on the next weapon-linked Skill this Turn.

**Scalable magnitudes:** offense=1  
**Restrictions:** Does not increase Base Power or Clash Power directly. The buff expires unused at Turn End and cannot increase the Hit that triggered it.

---

### Corrosive — 6 new

#### Acidwake (WEAPON)

**Item example:** Acidwake Longsword  
**Compatible canonical chassis IDs:** `longsword`, `scimitar`, `shortsword`  
**Combat axes:** Acid / Corrosion / Shield  
**Status:** PROPOSED / NOT IMPLEMENTED

> The edge carries a hunger for metal; the cleaner the guard, the sweeter the ruin.

**Single Base Effect:** Once per Turn, a weapon-linked Hit against an enemy currently protected by a Shield inflicts 2 Corrosion Count and deals 3 additional damage to its Shield only.

**Rank I (×1.00):** Once per Turn, a weapon-linked Hit against an enemy currently protected by a Shield inflicts 2 Corrosion Count and deals 3 additional damage to its Shield only.

**Rank II (×1.50, Ceil):** Once per Turn, a weapon-linked Hit against an enemy currently protected by a Shield inflicts 3 Corrosion Count and deals 5 additional damage to its Shield only.

**Rank III (×2.50, Ceil):** Once per Turn, a weapon-linked Hit against an enemy currently protected by a Shield inflicts 5 Corrosion Count and deals 8 additional damage to its Shield only.

**Scalable magnitudes:** corrosion=2; shieldDamage=3  
**Restrictions:** Does not overflow damage into HP. Corrosion is canonical and does not destroy Item Instances or equipment without an explicit damage system.

---

#### Rustthorn (WEAPON)

**Item example:** Rustthorn Dagger  
**Compatible canonical chassis IDs:** `dagger`, `rapier`, `shortsword`  
**Combat axes:** Acid / Corrosion / Offensive Level  
**Status:** PROPOSED / NOT IMPLEMENTED

> Its point leaves no visible hole, only a sudden doubt in the enemy's ability to hold their ground.

**Single Base Effect:** Once per Turn, a Hit from this weapon against an enemy already carrying Corrosion inflicts 1 Offensive Level Down until the end of its next Turn.

**Rank I (×1.00):** Once per Turn, a Hit from this weapon against an enemy already carrying Corrosion inflicts 1 Offensive Level Down until the end of its next Turn.

**Rank II (×1.50, Ceil):** Once per Turn, a Hit from this weapon against an enemy already carrying Corrosion inflicts 2 Offensive Level Down until the end of its next Turn.

**Rank III (×2.50, Ceil):** Once per Turn, a Hit from this weapon against an enemy already carrying Corrosion inflicts 3 Offensive Level Down until the end of its next Turn.

**Scalable magnitudes:** offenseDown=1  
**Restrictions:** Requires pre-existing Corrosion. Temporary level debuffs are not equipment damage and cannot permanently reduce character progression.

---

#### Vitriol Reaver (WEAPON)

**Item example:** Vitriol Reaver Warhammer  
**Compatible canonical chassis IDs:** `warhammer`, `maul`, `war_pick`  
**Combat axes:** Acid / Corrosion / Defensive Level  
**Status:** PROPOSED / NOT IMPLEMENTED

> The hammer's song is the sound of a fortress remembering it was once only ore.

**Single Base Effect:** Once per Turn, when this weapon breaks an enemy Shield, inflict 2 Corrosion Count and 1 Defensive Level Down on its owner for the next Turn.

**Rank I (×1.00):** Once per Turn, when this weapon breaks an enemy Shield, inflict 2 Corrosion Count and 1 Defensive Level Down on its owner for the next Turn.

**Rank II (×1.50, Ceil):** Once per Turn, when this weapon breaks an enemy Shield, inflict 3 Corrosion Count and 2 Defensive Level Down on its owner for the next Turn.

**Rank III (×2.50, Ceil):** Once per Turn, when this weapon breaks an enemy Shield, inflict 5 Corrosion Count and 3 Defensive Level Down on its owner for the next Turn.

**Scalable magnitudes:** corrosion=2; defenseDown=1  
**Restrictions:** Requires an actual Shield break by this exact weapon. No bonus damage against unshielded HP and no repeated breaks of the same Shield.

---

#### Acidblood Mantle (ARMOR)

**Item example:** Acidblood Mantle Leather Armor  
**Compatible canonical chassis IDs:** `leather_armor`, `hide_armor`, `scale_mail`  
**Combat axes:** Acid / Corrosion / Defensive Level / HP  
**Status:** PROPOSED / NOT IMPLEMENTED

> The lining is harmless while untouched. The first hostile wound wakes the venomous lacquer.

**Single Base Effect:** Once per Turn, after a direct enemy Attack Skill actually damages the wearer's HP, inflict 2 Corrosion Count on the attacker and gain 1 Defensive Level Up for the next Turn.

**Rank I (×1.00):** Once per Turn, after a direct enemy Attack Skill actually damages the wearer's HP, inflict 2 Corrosion Count on the attacker and gain 1 Defensive Level Up for the next Turn.

**Rank II (×1.50, Ceil):** Once per Turn, after a direct enemy Attack Skill actually damages the wearer's HP, inflict 3 Corrosion Count on the attacker and gain 2 Defensive Level Up for the next Turn.

**Rank III (×2.50, Ceil):** Once per Turn, after a direct enemy Attack Skill actually damages the wearer's HP, inflict 5 Corrosion Count on the attacker and gain 3 Defensive Level Up for the next Turn.

**Scalable magnitudes:** corrosion=2; defense=1  
**Restrictions:** Not triggered by self-damage, Burn, Poison ticks, or a fully absorbed Hit. The buff cannot retroactively prevent damage.

---

#### Caustic Parapet (SHIELD)

**Item example:** Caustic Parapet Heater Shield  
**Compatible canonical chassis IDs:** `shield_heater`, `shield_tower`, `shield_round`  
**Combat axes:** Acid / Corrosion / Guard  
**Status:** PROPOSED / NOT IMPLEMENTED

> A pale foam blossoms across the rim, eating at every blade forced against it.

**Single Base Effect:** Once per Turn, after a Guard with this shield prevents direct melee damage, inflict 2 Corrosion Count on the melee attacker.

**Rank I (×1.00):** Once per Turn, after a Guard with this shield prevents direct melee damage, inflict 2 Corrosion Count on the melee attacker.

**Rank II (×1.50, Ceil):** Once per Turn, after a Guard with this shield prevents direct melee damage, inflict 3 Corrosion Count on the melee attacker.

**Rank III (×2.50, Ceil):** Once per Turn, after a Guard with this shield prevents direct melee damage, inflict 5 Corrosion Count on the melee attacker.

**Scalable magnitudes:** corrosion=2  
**Restrictions:** Only a real Guard with this source shield qualifies. The corrosion affects the attacker, not the attacker's physical gear.

---

#### Alkahest Charm (ACCESSORY)

**Item example:** Alkahest Charm Pendant  
**Compatible canonical chassis IDs:** `ring`, `pendant`, `brooch`  
**Combat axes:** Acid / Corrosion / HP  
**Status:** PROPOSED / NOT IMPLEMENTED

> Every poison has an antidote somewhere; this charm demands that it be brewed inside the wearer's own blood.

**Single Base Effect:** Once per Turn at Turn Start, if you are affected by Corrosion, remove exactly 1 Corrosion Count and recover 3 HP.

**Rank I (×1.00):** Once per Turn at Turn Start, if you are affected by Corrosion, remove exactly 1 Corrosion Count and recover 3 HP.

**Rank II (×1.50, Ceil):** Once per Turn at Turn Start, if you are affected by Corrosion, remove exactly 1 Corrosion Count and recover 5 HP.

**Rank III (×2.50, Ceil):** Once per Turn at Turn Start, if you are affected by Corrosion, remove exactly 1 Corrosion Count and recover 8 HP.

**Scalable magnitudes:** hp=3  
**Restrictions:** The removal cost remains 1 Count. No healing without Corrosion and no HP gained above Max HP.

---

### Venomous — 6 new

#### Viper's Mercy (WEAPON)

**Item example:** Viper's Mercy Dagger  
**Compatible canonical chassis IDs:** `dagger`, `shortsword`, `rapier`  
**Combat axes:** Poison / Status / Critical  
**Status:** PROPOSED / NOT IMPLEMENTED

> The serpent engraved upon the blade opens its eyes only when blood first touches the edge.

**Single Base Effect:** Once per Turn, the first Critical Hit from this weapon inflicts 1 Poison Potency / 3 Count.

**Rank I (×1.00):** Once per Turn, the first Critical Hit from this weapon inflicts 1 Poison Potency / 3 Count.

**Rank II (×1.50, Ceil):** Once per Turn, the first Critical Hit from this weapon inflicts 2 Poison Potency / 5 Count.

**Rank III (×2.50, Ceil):** Once per Turn, the first Critical Hit from this weapon inflicts 3 Poison Potency / 8 Count.

**Scalable magnitudes:** potency=1; count=3  
**Restrictions:** A real Critical Hit is required. Does not modify critical chance, and Poison's unusual Potency/Count formula stays canonical.

---

#### Widowmaker's Kiss (WEAPON)

**Item example:** Widowmaker's Kiss Longbow  
**Compatible canonical chassis IDs:** `longbow`, `shortbow`, `hand_crossbow`  
**Combat axes:** Poison / Speed / Status  
**Status:** PROPOSED / NOT IMPLEMENTED

> The arrows bear no venom in the quiver. It blossoms only inside a prey that has already been poisoned.

**Single Base Effect:** Once per Turn, a weapon-linked Hit against an enemy already affected by Poison inflicts 3 additional Poison Count and 1 Bind for its next Turn.

**Rank I (×1.00):** Once per Turn, a weapon-linked Hit against an enemy already affected by Poison inflicts 3 additional Poison Count and 1 Bind for its next Turn.

**Rank II (×1.50, Ceil):** Once per Turn, a weapon-linked Hit against an enemy already affected by Poison inflicts 5 additional Poison Count and 2 Bind for its next Turn.

**Rank III (×2.50, Ceil):** Once per Turn, a weapon-linked Hit against an enemy already affected by Poison inflicts 8 additional Poison Count and 3 Bind for its next Turn.

**Scalable magnitudes:** count=3; bind=1  
**Restrictions:** Poison must exist before the Hit. Bind affects Speed using canonical rules; does not immobilize or remove Action Slots.

---

#### Plaguecarapace (ARMOR)

**Item example:** Plaguecarapace Scale Mail  
**Compatible canonical chassis IDs:** `hide_armor`, `scale_mail`, `chain_mail`  
**Combat axes:** Poison / HP / Survival  
**Status:** PROPOSED / NOT IMPLEMENTED

> A colony of dormant creatures lives between its plates, feeding on the suffering of anything that approaches.

**Single Base Effect:** Once per Turn, when a Poisoned enemy's direct Attack Skill damages your HP, restore 3 HP after the Hit resolves.

**Rank I (×1.00):** Once per Turn, when a Poisoned enemy's direct Attack Skill damages your HP, restore 3 HP after the Hit resolves.

**Rank II (×1.50, Ceil):** Once per Turn, when a Poisoned enemy's direct Attack Skill damages your HP, restore 5 HP after the Hit resolves.

**Rank III (×2.50, Ceil):** Once per Turn, when a Poisoned enemy's direct Attack Skill damages your HP, restore 8 HP after the Hit resolves.

**Scalable magnitudes:** hp=3  
**Restrictions:** The attack must first deal real HP damage; no zero-damage heal farming. Recovery cannot exceed missing HP.

---

#### Serpentglass (ACCESSORY)

**Item example:** Serpentglass Ring  
**Compatible canonical chassis IDs:** `ring`, `pendant`, `brooch`  
**Combat axes:** Poison / SP / Status  
**Status:** PROPOSED / NOT IMPLEMENTED

> Through its green glass the wearer sees each toxin as a thread that can be cut and spun into thought.

**Single Base Effect:** Once per Turn at Turn Start, while you carry Poison, remove exactly 1 Poison Count and recover 3 SP.

**Rank I (×1.00):** Once per Turn at Turn Start, while you carry Poison, remove exactly 1 Poison Count and recover 3 SP.

**Rank II (×1.50, Ceil):** Once per Turn at Turn Start, while you carry Poison, remove exactly 1 Poison Count and recover 5 SP.

**Rank III (×2.50, Ceil):** Once per Turn at Turn Start, while you carry Poison, remove exactly 1 Poison Count and recover 8 SP.

**Scalable magnitudes:** sp=3  
**Restrictions:** The Count expenditure is fixed. Does not remove Poison Potency for free or prevent future Poison applications.

---

#### Basilisk Shell (SHIELD)

**Item example:** Basilisk Shell Round Shield  
**Compatible canonical chassis IDs:** `shield_buckler`, `shield_round`, `shield_heater`  
**Combat axes:** Poison / Guard / Status  
**Status:** PROPOSED / NOT IMPLEMENTED

> The carved eye in the shield never blinks, even when the bearer does.

**Single Base Effect:** Once per Turn, after guarding a direct melee attack with this shield, inflict 1 Poison Potency / 2 Count on the attacker.

**Rank I (×1.00):** Once per Turn, after guarding a direct melee attack with this shield, inflict 1 Poison Potency / 2 Count on the attacker.

**Rank II (×1.50, Ceil):** Once per Turn, after guarding a direct melee attack with this shield, inflict 2 Poison Potency / 3 Count on the attacker.

**Rank III (×2.50, Ceil):** Once per Turn, after guarding a direct melee attack with this shield, inflict 3 Poison Potency / 5 Count on the attacker.

**Scalable magnitudes:** potency=1; count=2  
**Restrictions:** Guard with the actual shield must be valid. The ward does not petrify enemies and cannot trigger from poison damage itself.

---

#### Noxious Oath (WEAPON)

**Item example:** Noxious Oath Spear  
**Compatible canonical chassis IDs:** `spear`, `trident`, `pike`  
**Combat axes:** Poison / SP / Status  
**Status:** PROPOSED / NOT IMPLEMENTED

> The spearhead bears the oath of a physician who promised that no wound should end quickly.

**Single Base Effect:** At Turn Start, pay 3 SP to prime this weapon for that Turn; the next weapon-linked Hit inflicts 1 Poison Potency / 3 Count, then consumes the prime. Once per Turn.

**Rank I (×1.00):** At Turn Start, pay 3 SP to prime this weapon for that Turn; the next weapon-linked Hit inflicts 1 Poison Potency / 3 Count, then consumes the prime. Once per Turn.

**Rank II (×1.50, Ceil):** At Turn Start, pay 3 SP to prime this weapon for that Turn; the next weapon-linked Hit inflicts 2 Poison Potency / 5 Count, then consumes the prime. Once per Turn.

**Rank III (×2.50, Ceil):** At Turn Start, pay 3 SP to prime this weapon for that Turn; the next weapon-linked Hit inflicts 3 Poison Potency / 8 Count, then consumes the prime. Once per Turn.

**Scalable magnitudes:** potency=1; count=3  
**Restrictions:** SP payment remains 3 across all Ranks. A miss loses the prime, and the wielder cannot go into negative SP debt.

---

### Tidal — 6 new

#### Undertide (WEAPON)

**Item example:** Undertide Trident  
**Compatible canonical chassis IDs:** `trident`, `spear`, `glaive`  
**Combat axes:** Water / Sinking / SP  
**Status:** PROPOSED / NOT IMPLEMENTED

> The weapon drags the silence from the bottom of the sea into every fresh wound.

**Single Base Effect:** Once per Turn, the first Hit with this weapon inflicts 2 Sinking Potency / 2 Count.

**Rank I (×1.00):** Once per Turn, the first Hit with this weapon inflicts 2 Sinking Potency / 2 Count.

**Rank II (×1.50, Ceil):** Once per Turn, the first Hit with this weapon inflicts 3 Sinking Potency / 3 Count.

**Rank III (×2.50, Ceil):** Once per Turn, the first Hit with this weapon inflicts 5 Sinking Potency / 5 Count.

**Scalable magnitudes:** potency=2; count=2  
**Restrictions:** Water is flavor, not a newly registered Wet status. Sinking uses the existing canonical SP interaction.

---

#### Ripcurrent (WEAPON)

**Item example:** Ripcurrent Spear  
**Compatible canonical chassis IDs:** `spear`, `pike`, `trident`  
**Combat axes:** Water / Speed / Sinking  
**Status:** PROPOSED / NOT IMPLEMENTED

> Currents never chase the strongest swimmer; they pull the one who believed they could outrun them.

**Single Base Effect:** Once per Turn, a weapon-linked Hit against a target faster than the wielder inflicts 1 Bind for its next Turn and 2 Sinking Count.

**Rank I (×1.00):** Once per Turn, a weapon-linked Hit against a target faster than the wielder inflicts 1 Bind for its next Turn and 2 Sinking Count.

**Rank II (×1.50, Ceil):** Once per Turn, a weapon-linked Hit against a target faster than the wielder inflicts 2 Bind for its next Turn and 3 Sinking Count.

**Rank III (×2.50, Ceil):** Once per Turn, a weapon-linked Hit against a target faster than the wielder inflicts 3 Bind for its next Turn and 5 Sinking Count.

**Scalable magnitudes:** bind=1; sinking=2  
**Restrictions:** Requires a valid Speed comparison; does not forcibly move, knock prone or immobilize the target.

---

#### Drowned Regalia (ARMOR)

**Item example:** Drowned Regalia Chain Shirt  
**Compatible canonical chassis IDs:** `chain_shirt`, `scale_mail`, `half_plate`  
**Combat axes:** Water / SP / Shield  
**Status:** PROPOSED / NOT IMPLEMENTED

> The links drip with seawater that refuses to touch the ground, gathering where thought has been wounded.

**Single Base Effect:** Once per Turn, after an enemy directly damages your SP, gain 4 temporary Shield after the SP loss resolves.

**Rank I (×1.00):** Once per Turn, after an enemy directly damages your SP, gain 4 temporary Shield after the SP loss resolves.

**Rank II (×1.50, Ceil):** Once per Turn, after an enemy directly damages your SP, gain 6 temporary Shield after the SP loss resolves.

**Rank III (×2.50, Ceil):** Once per Turn, after an enemy directly damages your SP, gain 10 temporary Shield after the SP loss resolves.

**Scalable magnitudes:** shield=4  
**Restrictions:** No Shield from voluntarily spent SP, status ticks, or completely blocked SP damage. It does not retroactively prevent SP loss.

---

#### Tideguard (SHIELD)

**Item example:** Tideguard Round Shield  
**Compatible canonical chassis IDs:** `shield_round`, `shield_heater`, `shield_tower`  
**Combat axes:** Water / SP / Guard  
**Status:** PROPOSED / NOT IMPLEMENTED

> The waves caught inside the shield remember each life they carried to shore.

**Single Base Effect:** Once per Turn, after a Guard with this shield actually prevents direct enemy damage, restore 2 SP to its wearer.

**Rank I (×1.00):** Once per Turn, after a Guard with this shield actually prevents direct enemy damage, restore 2 SP to its wearer.

**Rank II (×1.50, Ceil):** Once per Turn, after a Guard with this shield actually prevents direct enemy damage, restore 3 SP to its wearer.

**Rank III (×2.50, Ceil):** Once per Turn, after a Guard with this shield actually prevents direct enemy damage, restore 5 SP to its wearer.

**Scalable magnitudes:** sp=2  
**Restrictions:** Cannot recover beyond Max SP. A Guard preventing zero damage does not count.

---

#### Brineglass (ACCESSORY)

**Item example:** Brineglass Ring  
**Compatible canonical chassis IDs:** `ring`, `pendant`, `necklace`  
**Combat axes:** Water / Sinking / SP  
**Status:** PROPOSED / NOT IMPLEMENTED

> A strand of deep-sea glass rings softly when a troubled mind finds another to anchor itself against.

**Single Base Effect:** Once per Turn, after your Attack Skill successfully Hits an enemy who already had Sinking, recover 2 SP.

**Rank I (×1.00):** Once per Turn, after your Attack Skill successfully Hits an enemy who already had Sinking, recover 2 SP.

**Rank II (×1.50, Ceil):** Once per Turn, after your Attack Skill successfully Hits an enemy who already had Sinking, recover 3 SP.

**Rank III (×2.50, Ceil):** Once per Turn, after your Attack Skill successfully Hits an enemy who already had Sinking, recover 5 SP.

**Scalable magnitudes:** sp=2  
**Restrictions:** The enemy needs Sinking before the Hit. No recovery from missed attacks, status ticks, or targets without valid SP.

---

#### Currentstep (ACCESSORY)

**Item example:** Currentstep Anklet  
**Compatible canonical chassis IDs:** `anklet`, `bracelet`  
**Combat axes:** Water / Speed / SP  
**Status:** PROPOSED / NOT IMPLEMENTED

> The wearer steps through the echo of an incoming strike as if the battlefield were running water.

**Single Base Effect:** Once per Turn, after a successful Evade, gain 1 Haste for your next Turn and recover 2 SP.

**Rank I (×1.00):** Once per Turn, after a successful Evade, gain 1 Haste for your next Turn and recover 2 SP.

**Rank II (×1.50, Ceil):** Once per Turn, after a successful Evade, gain 2 Haste for your next Turn and recover 3 SP.

**Rank III (×2.50, Ceil):** Once per Turn, after a successful Evade, gain 3 Haste for your next Turn and recover 5 SP.

**Scalable magnitudes:** haste=1; sp=2  
**Restrictions:** A single Evade triggers once. No free Action Slots, and SP recovery cannot exceed Max SP.

---

### Geomantic — 6 new

#### Faultforge (WEAPON)

**Item example:** Faultforge Maul  
**Compatible canonical chassis IDs:** `maul`, `warhammer`, `mace`  
**Combat axes:** Earth / Tremor / Stagger  
**Status:** PROPOSED / NOT IMPLEMENTED

> Every blow sketches a new fault beneath the enemy's feet, even on a battlefield of polished stone.

**Single Base Effect:** Once per Turn, the first Hit with this weapon inflicts 3 Tremor Potency / 2 Count.

**Rank I (×1.00):** Once per Turn, the first Hit with this weapon inflicts 3 Tremor Potency / 2 Count.

**Rank II (×1.50, Ceil):** Once per Turn, the first Hit with this weapon inflicts 5 Tremor Potency / 3 Count.

**Rank III (×2.50, Ceil):** Once per Turn, the first Hit with this weapon inflicts 8 Tremor Potency / 5 Count.

**Scalable magnitudes:** potency=3; count=2  
**Restrictions:** Tremor modifies Stagger mechanics through its existing Burst rule; this effect does not itself cause HP damage.

---

#### Stoneheart (ARMOR)

**Item example:** Stoneheart Breastplate  
**Compatible canonical chassis IDs:** `breastplate`, `half_plate`, `plate_armor`  
**Combat axes:** Earth / HP / CON Score  
**Status:** PROPOSED / NOT IMPLEMENTED

> The cuirass lends the wearer the patience of mountains, but only after pain has proved their resolve.

**Single Base Effect:** Once per Turn, after a direct enemy Hit removes at least 25% of your current Max HP, gain 1 temporary CON Score until the end of your next Turn.

**Rank I (×1.00):** Once per Turn, after a direct enemy Hit removes at least 25% of your current Max HP, gain 1 temporary CON Score until the end of your next Turn.

**Rank II (×1.50, Ceil):** Once per Turn, after a direct enemy Hit removes at least 25% of your current Max HP, gain 2 temporary CON Score until the end of your next Turn.

**Rank III (×2.50, Ceil):** Once per Turn, after a direct enemy Hit removes at least 25% of your current Max HP, gain 3 temporary CON Score until the end of your next Turn.

**Scalable magnitudes:** score=1  
**Restrictions:** The 25% damage threshold is fixed. Temporary scores never permanently alter Max HP or heal HP; Score-derived effects need authoritative recomputation.

---

#### Bedrock Aegis (SHIELD)

**Item example:** Bedrock Aegis Tower Shield  
**Compatible canonical chassis IDs:** `shield_heater`, `shield_tower`  
**Combat axes:** Earth / Defensive Level / Guard  
**Status:** PROPOSED / NOT IMPLEMENTED

> At every impact, the shield becomes heavier with the memory of all the earth beneath it.

**Single Base Effect:** Once per Turn, after a Guard with this shield prevents at least 5 direct damage, gain 1 Defensive Level Up for your next Turn.

**Rank I (×1.00):** Once per Turn, after a Guard with this shield prevents at least 5 direct damage, gain 1 Defensive Level Up for your next Turn.

**Rank II (×1.50, Ceil):** Once per Turn, after a Guard with this shield prevents at least 5 direct damage, gain 2 Defensive Level Up for your next Turn.

**Rank III (×2.50, Ceil):** Once per Turn, after a Guard with this shield prevents at least 5 direct damage, gain 3 Defensive Level Up for your next Turn.

**Scalable magnitudes:** defense=1  
**Restrictions:** The 5 damage requirement is fixed. Does not apply to the Guard that generated it and cannot stack from multiple Guard hits in the same Turn.

---

#### Gravity's Hold (WEAPON)

**Item example:** Gravity's Hold Halberd  
**Compatible canonical chassis IDs:** `halberd`, `pike`, `glaive`  
**Combat axes:** Earth / Speed / Offensive Level  
**Status:** PROPOSED / NOT IMPLEMENTED

> The blade does not strike faster enemies. It makes the distance between their decisions weigh more.

**Single Base Effect:** Once per Turn, a weapon-linked Hit against an enemy with greater Speed inflicts 1 Bind and 1 Offensive Level Down for its next Turn.

**Rank I (×1.00):** Once per Turn, a weapon-linked Hit against an enemy with greater Speed inflicts 1 Bind and 1 Offensive Level Down for its next Turn.

**Rank II (×1.50, Ceil):** Once per Turn, a weapon-linked Hit against an enemy with greater Speed inflicts 2 Bind and 2 Offensive Level Down for its next Turn.

**Rank III (×2.50, Ceil):** Once per Turn, a weapon-linked Hit against an enemy with greater Speed inflicts 3 Bind and 3 Offensive Level Down for its next Turn.

**Scalable magnitudes:** bind=1; offenseDown=1  
**Restrictions:** Requires the target to be faster before the Hit. No arbitrary position changes or Action Slot deletion.

---

#### Bastion Root (ARMOR)

**Item example:** Bastion Root Plate Armor  
**Compatible canonical chassis IDs:** `splint_armor`, `chain_mail`, `plate_armor`  
**Combat axes:** Earth / Defensive Level / Position  
**Status:** PROPOSED / NOT IMPLEMENTED

> Vines of stone blossom around those who choose to stand and endure rather than flee.

**Single Base Effect:** At Turn End, if you used no Evade and moved no distance this Turn, gain 1 Defensive Level Up during your next Turn. Once per Turn.

**Rank I (×1.00):** At Turn End, if you used no Evade and moved no distance this Turn, gain 1 Defensive Level Up during your next Turn. Once per Turn.

**Rank II (×1.50, Ceil):** At Turn End, if you used no Evade and moved no distance this Turn, gain 2 Defensive Level Up during your next Turn. Once per Turn.

**Rank III (×2.50, Ceil):** At Turn End, if you used no Evade and moved no distance this Turn, gain 3 Defensive Level Up during your next Turn. Once per Turn.

**Scalable magnitudes:** defense=1  
**Restrictions:** The condition cannot be met by an Incapacitated wearer. Movement legality and post-Turn buff cleanup require the combat movement hook.

---

#### Seismic Lens (ACCESSORY)

**Item example:** Seismic Lens Pendant  
**Compatible canonical chassis IDs:** `pendant`, `brooch`, `ring`  
**Combat axes:** Earth / Tremor / SP  
**Status:** PROPOSED / NOT IMPLEMENTED

> The crystal catches vibrations no ear can hear, returning them as fragments of clarity.

**Single Base Effect:** Once per Turn, after you or an ally triggers Tremor Burst on an enemy within valid range, recover 2 SP.

**Rank I (×1.00):** Once per Turn, after you or an ally triggers Tremor Burst on an enemy within valid range, recover 2 SP.

**Rank II (×1.50, Ceil):** Once per Turn, after you or an ally triggers Tremor Burst on an enemy within valid range, recover 3 SP.

**Rank III (×2.50, Ceil):** Once per Turn, after you or an ally triggers Tremor Burst on an enemy within valid range, recover 5 SP.

**Scalable magnitudes:** sp=2  
**Restrictions:** Requires an actual Tremor Burst and an authorized target source; multiple Bursts in one Skill do not stack recovery.

---

### Vital — 6 new

#### Lifewoven Grace (ACCESSORY)

**Item example:** Lifewoven Grace Pendant  
**Compatible canonical chassis IDs:** `pendant`, `necklace`, `brooch`  
**Combat axes:** HP / SP / Healing  
**Status:** PROPOSED / NOT IMPLEMENTED

> Every thread of the charm is a promise that the heart will not be asked to beat alone.

**Single Base Effect:** Once per Turn at Turn Start, if you are below 50% HP, you may spend 3 SP to restore 4 HP.

**Rank I (×1.00):** Once per Turn at Turn Start, if you are below 50% HP, you may spend 3 SP to restore 4 HP.

**Rank II (×1.50, Ceil):** Once per Turn at Turn Start, if you are below 50% HP, you may spend 3 SP to restore 6 HP.

**Rank III (×2.50, Ceil):** Once per Turn at Turn Start, if you are below 50% HP, you may spend 3 SP to restore 10 HP.

**Scalable magnitudes:** hp=4  
**Restrictions:** Both the 50% trigger and 3 SP cost are fixed. Cannot heal a wearer at 0 HP or exceed Max HP.

---

#### Soulkindle (ACCESSORY)

**Item example:** Soulkindle Ring  
**Compatible canonical chassis IDs:** `ring`, `bracelet`, `pendant`  
**Combat axes:** SP / Attack / Recovery  
**Status:** PROPOSED / NOT IMPLEMENTED

> The ring burns with stolen courage whenever its bearer spends more spirit than they can afford.

**Single Base Effect:** Once per Turn, if you begin an Attack Skill below 50% SP and that Skill Hits an enemy, recover 3 SP after the Skill resolves.

**Rank I (×1.00):** Once per Turn, if you begin an Attack Skill below 50% SP and that Skill Hits an enemy, recover 3 SP after the Skill resolves.

**Rank II (×1.50, Ceil):** Once per Turn, if you begin an Attack Skill below 50% SP and that Skill Hits an enemy, recover 5 SP after the Skill resolves.

**Rank III (×2.50, Ceil):** Once per Turn, if you begin an Attack Skill below 50% SP and that Skill Hits an enemy, recover 8 SP after the Skill resolves.

**Scalable magnitudes:** sp=3  
**Restrictions:** An actual Skill Hit is required. The threshold is checked before Skill resolution and stays fixed across Ranks.

---

#### Heartforge (ARMOR)

**Item example:** Heartforge Breastplate  
**Compatible canonical chassis IDs:** `breastplate`, `half_plate`, `chain_mail`  
**Combat axes:** HP / Recovery / Survival  
**Status:** PROPOSED / NOT IMPLEMENTED

> The furnace woven into the armor repays wounds slowly, refusing the seductive lie of instant immortality.

**Single Base Effect:** Once per Turn, after direct enemy damage lowers your HP, store a Heartbeat until your next Turn Start. Consume it then to recover 3 HP.

**Rank I (×1.00):** Once per Turn, after direct enemy damage lowers your HP, store a Heartbeat until your next Turn Start. Consume it then to recover 3 HP.

**Rank II (×1.50, Ceil):** Once per Turn, after direct enemy damage lowers your HP, store a Heartbeat until your next Turn Start. Consume it then to recover 5 HP.

**Rank III (×2.50, Ceil):** Once per Turn, after direct enemy damage lowers your HP, store a Heartbeat until your next Turn Start. Consume it then to recover 8 HP.

**Scalable magnitudes:** hp=3  
**Restrictions:** Only one Heartbeat may be stored per Turn. Cannot activate from status ticks, revive at 0 HP, or exceed Max HP.

---

#### Redline Band (ACCESSORY)

**Item example:** Redline Band Bracelet  
**Compatible canonical chassis IDs:** `bracelet`, `ring`, `anklet`  
**Combat axes:** HP / STR Score / Ability Score  
**Status:** PROPOSED / NOT IMPLEMENTED

> When the pulse becomes a warning rather than a rhythm, the band answers with a brutal final reserve.

**Single Base Effect:** Once per Encounter, at Turn Start while below 25% HP, gain 1 temporary STR Score until Turn End.

**Rank I (×1.00):** Once per Encounter, at Turn Start while below 25% HP, gain 1 temporary STR Score until Turn End.

**Rank II (×1.50, Ceil):** Once per Encounter, at Turn Start while below 25% HP, gain 2 temporary STR Score until Turn End.

**Rank III (×2.50, Ceil):** Once per Encounter, at Turn Start while below 25% HP, gain 3 temporary STR Score until Turn End.

**Scalable magnitudes:** score=1  
**Restrictions:** HP threshold is fixed. Temporary Score never permanently modifies inventory weight, Max HP or learned proficiency; requires Score override integration.

---

#### Mindglass (ACCESSORY)

**Item example:** Mindglass Brooch  
**Compatible canonical chassis IDs:** `brooch`, `pendant`, `ring`  
**Combat axes:** INT Score / WIS Save / Ability Score  
**Status:** PROPOSED / NOT IMPLEMENTED

> Failures splinter within the jewel, each one leaving an idea too sharp to be forgotten.

**Single Base Effect:** Once per Encounter, after failing a WIS Save against an enemy effect, gain 1 temporary INT Score for your next INT Check in the same Encounter.

**Rank I (×1.00):** Once per Encounter, after failing a WIS Save against an enemy effect, gain 1 temporary INT Score for your next INT Check in the same Encounter.

**Rank II (×1.50, Ceil):** Once per Encounter, after failing a WIS Save against an enemy effect, gain 2 temporary INT Score for your next INT Check in the same Encounter.

**Rank III (×2.50, Ceil):** Once per Encounter, after failing a WIS Save against an enemy effect, gain 3 temporary INT Score for your next INT Check in the same Encounter.

**Scalable magnitudes:** score=1  
**Restrictions:** No reroll or retroactive correction of the failed Save; temporary Score expires after one eligible Check or Encounter End.

---

#### Resolve Thread (ACCESSORY)

**Item example:** Resolve Thread Necklace  
**Compatible canonical chassis IDs:** `necklace`, `pendant`, `brooch`  
**Combat axes:** SP / WIS Score / Ability Score  
**Status:** PROPOSED / NOT IMPLEMENTED

> Each knot in the cord marks a night the wearer survived without speaking of it.

**Single Base Effect:** Once per Encounter, after direct enemy effects reduce your SP below 25% of Max SP, gain 1 temporary WIS Score until the end of your next Turn.

**Rank I (×1.00):** Once per Encounter, after direct enemy effects reduce your SP below 25% of Max SP, gain 1 temporary WIS Score until the end of your next Turn.

**Rank II (×1.50, Ceil):** Once per Encounter, after direct enemy effects reduce your SP below 25% of Max SP, gain 2 temporary WIS Score until the end of your next Turn.

**Rank III (×2.50, Ceil):** Once per Encounter, after direct enemy effects reduce your SP below 25% of Max SP, gain 3 temporary WIS Score until the end of your next Turn.

**Scalable magnitudes:** score=1  
**Restrictions:** Requires real enemy-origin SP loss across the threshold. No permanent change to class Saves or the Score itself.

---

### Runic — 6 new

#### Vanguard's Script (WEAPON)

**Item example:** Vanguard's Script Longsword  
**Compatible canonical chassis IDs:** `longsword`, `rapier`, `spear`, `scimitar`  
**Combat axes:** Offensive Level / Speed / Attack  
**Status:** PROPOSED / NOT IMPLEMENTED

> The runes brighten only when the wielder finds an opening that momentum itself failed to notice.

**Single Base Effect:** Once per Turn, after a weapon-linked Hit against an enemy with lower Speed than the wielder, gain 1 Offensive Level Up for your next weapon-linked Skill before Turn End.

**Rank I (×1.00):** Once per Turn, after a weapon-linked Hit against an enemy with lower Speed than the wielder, gain 1 Offensive Level Up for your next weapon-linked Skill before Turn End.

**Rank II (×1.50, Ceil):** Once per Turn, after a weapon-linked Hit against an enemy with lower Speed than the wielder, gain 2 Offensive Level Up for your next weapon-linked Skill before Turn End.

**Rank III (×2.50, Ceil):** Once per Turn, after a weapon-linked Hit against an enemy with lower Speed than the wielder, gain 3 Offensive Level Up for your next weapon-linked Skill before Turn End.

**Scalable magnitudes:** offense=1  
**Restrictions:** Only the next Skill is enhanced, never the triggering Hit. No direct Base Power, Final Power or Clash Power bonuses.

---

#### Sentinel's Inscription (SHIELD)

**Item example:** Sentinel's Inscription Heater Shield  
**Compatible canonical chassis IDs:** `shield_round`, `shield_heater`, `shield_tower`  
**Combat axes:** Defensive Level / Guard / Status  
**Status:** PROPOSED / NOT IMPLEMENTED

> The shield refuses to reward its wielder for hiding. It answers only a blow truly held back.

**Single Base Effect:** Once per Turn, after a Guard with this shield prevents direct enemy damage, gain 1 Defensive Level Up during your next Turn.

**Rank I (×1.00):** Once per Turn, after a Guard with this shield prevents direct enemy damage, gain 1 Defensive Level Up during your next Turn.

**Rank II (×1.50, Ceil):** Once per Turn, after a Guard with this shield prevents direct enemy damage, gain 2 Defensive Level Up during your next Turn.

**Rank III (×2.50, Ceil):** Once per Turn, after a Guard with this shield prevents direct enemy damage, gain 3 Defensive Level Up during your next Turn.

**Scalable magnitudes:** defense=1  
**Restrictions:** The Guard must prevent positive damage. Does not retroactively improve the Guard and does not provide permanent Level progression.

---

#### Quickglyph (ACCESSORY)

**Item example:** Quickglyph Anklet  
**Compatible canonical chassis IDs:** `anklet`, `bracelet`, `earrings`  
**Combat axes:** Speed / Haste / Attack  
**Status:** PROPOSED / NOT IMPLEMENTED

> The sigil writes a moment of future momentum beneath the wearer's skin.

**Single Base Effect:** Once per Turn, after your Attack Skill Hits an enemy with higher Speed than yours, gain 1 Haste during your next Turn.

**Rank I (×1.00):** Once per Turn, after your Attack Skill Hits an enemy with higher Speed than yours, gain 1 Haste during your next Turn.

**Rank II (×1.50, Ceil):** Once per Turn, after your Attack Skill Hits an enemy with higher Speed than yours, gain 2 Haste during your next Turn.

**Rank III (×2.50, Ceil):** Once per Turn, after your Attack Skill Hits an enemy with higher Speed than yours, gain 3 Haste during your next Turn.

**Scalable magnitudes:** haste=1  
**Restrictions:** The target must be faster before the Hit, and Haste cannot create new Action Slots.

---

#### Titan's Testament (WEAPON)

**Item example:** Titan's Testament Maul  
**Compatible canonical chassis IDs:** `maul`, `warhammer`, `greataxe`  
**Combat axes:** STR Score / Ability Score / Clash  
**Status:** PROPOSED / NOT IMPLEMENTED

> The weapon's name is a challenge to giants, and it begins to answer only when something stronger stands against it.

**Single Base Effect:** Once per Encounter, after winning a Clash against a target with a larger Size category, gain 1 temporary STR Score until Turn End.

**Rank I (×1.00):** Once per Encounter, after winning a Clash against a target with a larger Size category, gain 1 temporary STR Score until Turn End.

**Rank II (×1.50, Ceil):** Once per Encounter, after winning a Clash against a target with a larger Size category, gain 2 temporary STR Score until Turn End.

**Rank III (×2.50, Ceil):** Once per Encounter, after winning a Clash against a target with a larger Size category, gain 3 temporary STR Score until Turn End.

**Scalable magnitudes:** score=1  
**Restrictions:** No score change if the target is not larger. Never modifies the completed Clash or applies permanently to inventory capacity.

---

#### Foxfire Loom (ARMOR)

**Item example:** Foxfire Loom Leather Armor  
**Compatible canonical chassis IDs:** `padded_armor`, `leather_armor`, `hide_armor`  
**Combat axes:** DEX Score / Ability Score / Evade  
**Status:** PROPOSED / NOT IMPLEMENTED

> A hundred foxes are stitched into the lining, each waiting to borrow the wearer's skin for one flawless escape.

**Single Base Effect:** Once per Turn, after a successful Evade against a direct enemy attack, gain 1 temporary DEX Score until the end of your next Turn.

**Rank I (×1.00):** Once per Turn, after a successful Evade against a direct enemy attack, gain 1 temporary DEX Score until the end of your next Turn.

**Rank II (×1.50, Ceil):** Once per Turn, after a successful Evade against a direct enemy attack, gain 2 temporary DEX Score until the end of your next Turn.

**Rank III (×2.50, Ceil):** Once per Turn, after a successful Evade against a direct enemy attack, gain 3 temporary DEX Score until the end of your next Turn.

**Scalable magnitudes:** score=1  
**Restrictions:** Cannot retroactively improve the successful Evade. Other derived stats recalculate only through an approved temporary Score pipeline.

---

#### Sovereign's Echo (ACCESSORY)

**Item example:** Sovereign's Echo Ring  
**Compatible canonical chassis IDs:** `ring`, `pendant`, `brooch`  
**Combat axes:** CHA Score / Ability Score / Save  
**Status:** PROPOSED / NOT IMPLEMENTED

> The seal carries the weight of a spoken command, but listens most closely when the bearer resists another's will.

**Single Base Effect:** Once per Encounter, after successfully saving against Charmed or Frightened from an enemy, gain 1 temporary CHA Score until Encounter End or until your next CHA Check, whichever comes first.

**Rank I (×1.00):** Once per Encounter, after successfully saving against Charmed or Frightened from an enemy, gain 1 temporary CHA Score until Encounter End or until your next CHA Check, whichever comes first.

**Rank II (×1.50, Ceil):** Once per Encounter, after successfully saving against Charmed or Frightened from an enemy, gain 2 temporary CHA Score until Encounter End or until your next CHA Check, whichever comes first.

**Rank III (×2.50, Ceil):** Once per Encounter, after successfully saving against Charmed or Frightened from an enemy, gain 3 temporary CHA Score until Encounter End or until your next CHA Check, whichever comes first.

**Scalable magnitudes:** score=1  
**Restrictions:** Does not block the triggering Status without the successful Save. No automatic social-check success or permanent score increase.

---


## Volume III — Fundamental Passives, HP / SP Sustaining, and Typed Resistance Wards (20 new inscriptions)

**IMPORTANT: Editorial only.** These entries are intended to fill baseline gear-enchantment roles that don't require an attack proc: enduring maximum HP, passive HP regeneration, passive SP recovery, reduction of involuntary SP loss, typed physical damage resistance, and seven SIN affinity-specific damage wards.

### Magnitude and rounding contract

| Magnitude | Rank I (Base) | Rank II (Ceil ×1.5) | Rank III (Ceil ×2.5) |
|---|---:|---:|---:|
| Base Max HP increase | 5% | 8% | 13% |
| HP regeneration per Turn Start | 2% | 3% | 5% |
| SP recovery per Turn Start | 2 | 3 | 5 |
| Physical or SIN-specific resistance multiplier subtraction | −0.06 | −0.09 | −0.15 |
| SP loss reduction per qualifying loss event | 1 | 2 | 3 |

**Rounding details:** Percentages store integer percentage points, so `ceil(5 × 1.5) = 8` percentage points. The resistance bonus stores hundredths internally: `ceil(6 × 1.5) = 9 hundredths = 0.09`; there is no accidental `ceil(0.06 × 1.5) = 1` bug. After the rank is resolved, a regeneration tick heals `ceil(effective Max HP × ranked percent / 100)` full HP points. All costs, conditional thresholds, duration, target axes, and per-Turn frequencies remain fixed.

**Physical types**: Slash, Pierce and Blunt, read as a subtraction from the matching incoming physical damage multiplier (not post-damage flat reduction). Armor's 0.30 minimum must be respected. **SIN types**: Wrath, Lust, Sloth, Gluttony, Gloom, Pride, Envy. Each ward affects exactly one incoming matching SIN damage multiplier. A narrative element alone (e.g. Fire) does not imply the Wrath SIN tag. The existing Item Armor runtime establishes the physical resistance calculation; the SIN-specific hook and its lower bound need to be established in gameplay before these wards can be implemented.

**HP Max and Decay:** The percent bonus is computed from the authoritative derived base Max HP; the enchanted Max HP must never use a previous enchanted value as input. Recalculate effective Max HP, current HP clamp, and Stagger Thresholds together with other modifiers including Decay. Equipping does not heal the difference. **SP loss reduction:** Applies to an actual involuntary SP-loss event such as enemy SP damage or status damage, not SP paid to activate a Skill. It cannot turn a loss into a net gain. **Stacking:** The proposal is strongest active same-axis resistance ward wins; additive stacking is not pre-approved.

### New signatures

#### Vital (7)

##### Heartbound · ACCESSORY

**Example:** Heartbound Pendant  
**Compatible chassis:** `pendant`, `necklace`, `ring`  
**Axes:** HP, Max HP, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> The heart's name is carved into a small stone that refuses to forget how many beats remain.

**Base Effect:** While this accessory is equipped, increase the wearer's canonical Base Max HP by 5%. Recalculate effective Max HP and Stagger Thresholds from the final value.

**Rank I (×1):** While this accessory is equipped, increase the wearer's canonical Base Max HP by 5%. Recalculate effective Max HP and Stagger Thresholds from the final value.

**Rank II (Ceil ×1.50):** While this accessory is equipped, increase the wearer's canonical Base Max HP by 8%. Recalculate effective Max HP and Stagger Thresholds from the final value.

**Rank III (Ceil ×2.50):** While this accessory is equipped, increase the wearer's canonical Base Max HP by 13%. Recalculate effective Max HP and Stagger Thresholds from the final value.

**Base scalable magnitudes:** percent: 5.

**Limits and implementation gates:** Base Max HP means the already-derived canonical HP baseline, not current HP or permanent CON. Equipping does not heal; unequipping clamps current HP to effective Max HP. Never compounds from the previous enchanted total.

---

##### Bloodroot · ARMOR

**Example:** Bloodroot Breastplate  
**Compatible chassis:** `hide_armor`, `scale_mail`, `breastplate`, `half_plate`  
**Axes:** HP, HP Regeneration, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> A vein of amber runs beneath the armor, delivering one stubborn heartbeat after another.

**Base Effect:** At Turn Start, if the wearer is alive and below Max HP, recover HP equal to 2% of effective Max HP, rounded up to a whole HP point.

**Rank I (×1):** At Turn Start, if the wearer is alive and below Max HP, recover HP equal to 2% of effective Max HP, rounded up to a whole HP point.

**Rank II (Ceil ×1.50):** At Turn Start, if the wearer is alive and below Max HP, recover HP equal to 3% of effective Max HP, rounded up to a whole HP point.

**Rank III (Ceil ×2.50):** At Turn Start, if the wearer is alive and below Max HP, recover HP equal to 5% of effective Max HP, rounded up to a whole HP point.

**Base scalable magnitudes:** percent: 2.

**Limits and implementation gates:** Turn Start is the proposed timing. No recovery from 0 HP, no over-healing, no healing loop outside normal Turn Start; the integer HP amount uses Ceil after the rank percentage is computed.

---

##### Serenity Well · ACCESSORY

**Example:** Serenity Well Ring  
**Compatible chassis:** `ring`, `pendant`, `necklace`, `brooch`  
**Axes:** SP, SP Recovery, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> In the ring's center, a droplet hangs perfectly still even when the wielder's mind breaks into storm.

**Base Effect:** At Turn Start, recover 2 SP up to the wearer's current maximum SP.

**Rank I (×1):** At Turn Start, recover 2 SP up to the wearer's current maximum SP.

**Rank II (Ceil ×1.50):** At Turn Start, recover 3 SP up to the wearer's current maximum SP.

**Rank III (Ceil ×2.50):** At Turn Start, recover 5 SP up to the wearer's current maximum SP.

**Base scalable magnitudes:** sp: 2.

**Limits and implementation gates:** Turn Start is the proposed timing; no benefit at full SP, no generation above Max SP, and no activation while unable to receive resource recovery.

---

##### Mindward · ACCESSORY

**Example:** Mindward Brooch  
**Compatible chassis:** `pendant`, `ring`, `brooch`, `hairpin`  
**Axes:** SP, SP Loss Reduction, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> Every whispered doubt is forced to pass through the inscription before it can touch its bearer.

**Base Effect:** When the wearer would lose SP from a non-voluntary loss event, reduce that SP loss by 1 (minimum final loss 0).

**Rank I (×1):** When the wearer would lose SP from a non-voluntary loss event, reduce that SP loss by 1 (minimum final loss 0).

**Rank II (Ceil ×1.50):** When the wearer would lose SP from a non-voluntary loss event, reduce that SP loss by 2 (minimum final loss 0).

**Rank III (Ceil ×2.50):** When the wearer would lose SP from a non-voluntary loss event, reduce that SP loss by 3 (minimum final loss 0).

**Base scalable magnitudes:** loss: 1.

**Limits and implementation gates:** Includes enemy-origin direct SP damage and status-caused SP loss. Does not discount voluntarily spent SP costs or grant SP; each actual loss event resolves once, not once per damage subcomponent.

---

##### Soulvault · ACCESSORY

**Example:** Soulvault Necklace  
**Compatible chassis:** `ring`, `pendant`, `necklace`  
**Axes:** SP, Max SP, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> Seven sealed chambers within the pendant guard thoughts the mind has not yet learned how to carry.

**Base Effect:** While equipped, increase the wearer's canonical Base Max SP by 5%, recomputing effective Max SP without restoring the missing SP.

**Rank I (×1):** While equipped, increase the wearer's canonical Base Max SP by 5%, recomputing effective Max SP without restoring the missing SP.

**Rank II (Ceil ×1.50):** While equipped, increase the wearer's canonical Base Max SP by 8%, recomputing effective Max SP without restoring the missing SP.

**Rank III (Ceil ×2.50):** While equipped, increase the wearer's canonical Base Max SP by 13%, recomputing effective Max SP without restoring the missing SP.

**Base scalable magnitudes:** percent: 5.

**Limits and implementation gates:** Additional proposed resource counterpart to Heartbound. Max SP derivation must be verified against character/SP rules; does not permanently change Base Score or heal when equipped.

---

##### Mender's Sigil · ACCESSORY

**Example:** Mender's Sigil Ring  
**Compatible chassis:** `ring`, `pendant`, `brooch`  
**Axes:** HP, Healing Received, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> Its gold lines brighten not when the body breaks, but when another hand begins to mend it.

**Base Effect:** While equipped, increase the HP healed by a valid healing effect received by the wearer by 5%, rounding the final healed HP amount up.

**Rank I (×1):** While equipped, increase the HP healed by a valid healing effect received by the wearer by 5%, rounding the final healed HP amount up.

**Rank II (Ceil ×1.50):** While equipped, increase the HP healed by a valid healing effect received by the wearer by 8%, rounding the final healed HP amount up.

**Rank III (Ceil ×2.50):** While equipped, increase the HP healed by a valid healing effect received by the wearer by 13%, rounding the final healed HP amount up.

**Base scalable magnitudes:** percent: 5.

**Limits and implementation gates:** Healing must already be valid; this does not trigger by itself. No HP beyond Max HP and no repeated boost from the same source; healing-percent interactions await pipeline review.

---

##### Clarity's Return · ACCESSORY

**Example:** Clarity's Return Pendant  
**Compatible chassis:** `pendant`, `brooch`, `hairpin`  
**Axes:** SP, SP Recovery, Save  
**Editorial status:** PROPOSED · NOT PLAYABLE

> A mirrored thought waits just beyond every spell that attempts to scatter the mind.

**Base Effect:** Once per Turn, after successfully passing a Save against an enemy effect that would have caused SP loss, recover 2 SP.

**Rank I (×1):** Once per Turn, after successfully passing a Save against an enemy effect that would have caused SP loss, recover 2 SP.

**Rank II (Ceil ×1.50):** Once per Turn, after successfully passing a Save against an enemy effect that would have caused SP loss, recover 3 SP.

**Rank III (Ceil ×2.50):** Once per Turn, after successfully passing a Save against an enemy effect that would have caused SP loss, recover 5 SP.

**Base scalable magnitudes:** sp: 2.

**Limits and implementation gates:** Only a successful Save against an actual SP-threatening enemy effect qualifies. No self-created tests, recovery above Max SP, or activation from voluntary SP payment.

---

#### Warding (10)

##### Ironbark Inscription · ARMOR

**Example:** Ironbark Inscription Breastplate  
**Compatible chassis:** `hide_armor`, `scale_mail`, `breastplate`, `half_plate`, `plate_armor`  
**Axes:** Slash, Physical Resistance, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> Beneath the armor's grain a thousand crossed branches turn the edge of each slash toward the earth.

**Base Effect:** While this armor is equipped, reduce the incoming Slash damage resistance multiplier by 0.06, applied only to Slash damage.

**Rank I (×1):** While this armor is equipped, reduce the incoming Slash damage resistance multiplier by 0.06, applied only to Slash damage.

**Rank II (Ceil ×1.50):** While this armor is equipped, reduce the incoming Slash damage resistance multiplier by 0.09, applied only to Slash damage.

**Rank III (Ceil ×2.50):** While this armor is equipped, reduce the incoming Slash damage resistance multiplier by 0.15, applied only to Slash damage.

**Typed resistance:** `physical` / `slash` (magnitudes in hundredths).

**Limits and implementation gates:** Resistance delta is a multiplier subtraction, not flat HP damage reduction. Physical resistance must honor the canonical 0.30 minimum; stacking with another ward of the same axis remains blocked pending approval.

---

##### Needlebreaker · ARMOR

**Example:** Needlebreaker Chain Mail  
**Compatible chassis:** `chain_shirt`, `chain_mail`, `splint_armor`, `plate_armor`  
**Axes:** Pierce, Physical Resistance, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> Each ring bends the path of a needle until the narrowest wound finds no road inward.

**Base Effect:** While this armor is equipped, reduce the incoming Pierce damage resistance multiplier by 0.06, applied only to Pierce damage.

**Rank I (×1):** While this armor is equipped, reduce the incoming Pierce damage resistance multiplier by 0.06, applied only to Pierce damage.

**Rank II (Ceil ×1.50):** While this armor is equipped, reduce the incoming Pierce damage resistance multiplier by 0.09, applied only to Pierce damage.

**Rank III (Ceil ×2.50):** While this armor is equipped, reduce the incoming Pierce damage resistance multiplier by 0.15, applied only to Pierce damage.

**Typed resistance:** `physical` / `pierce` (magnitudes in hundredths).

**Limits and implementation gates:** Not general damage immunity. Canonical physical floor 0.30 applies. Does not change Armor Quality, Durability or Shield Guard.

---

##### Gravestone Mantle · ARMOR

**Example:** Gravestone Mantle Half Plate  
**Compatible chassis:** `padded_armor`, `hide_armor`, `half_plate`, `plate_armor`  
**Axes:** Blunt, Physical Resistance, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> A grave's patient weight settles over every blow, making the impact remember it has somewhere else to go.

**Base Effect:** While this armor is equipped, reduce the incoming Blunt damage resistance multiplier by 0.06, applied only to Blunt damage.

**Rank I (×1):** While this armor is equipped, reduce the incoming Blunt damage resistance multiplier by 0.06, applied only to Blunt damage.

**Rank II (Ceil ×1.50):** While this armor is equipped, reduce the incoming Blunt damage resistance multiplier by 0.09, applied only to Blunt damage.

**Rank III (Ceil ×2.50):** While this armor is equipped, reduce the incoming Blunt damage resistance multiplier by 0.15, applied only to Blunt damage.

**Typed resistance:** `physical` / `blunt` (magnitudes in hundredths).

**Limits and implementation gates:** Not a block of Stagger, Fixed Damage, or other unrelated damage. Clamp the physical damage multiplier to the canonical minimum.

---

##### Wrathcinder Aegis · SHIELD

**Example:** Wrathcinder Aegis Heater Shield  
**Compatible chassis:** `shield_round`, `shield_heater`, `shield_tower`  
**Axes:** Wrath, SIN Resistance, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> Flame-drawn letters flare against the shield as fury turns aside from its intended home.

**Base Effect:** While this shield is equipped and its ward is active, reduce the incoming Wrath SIN damage resistance multiplier by 0.06, affecting Wrath damage only.

**Rank I (×1):** While this shield is equipped and its ward is active, reduce the incoming Wrath SIN damage resistance multiplier by 0.06, affecting Wrath damage only.

**Rank II (Ceil ×1.50):** While this shield is equipped and its ward is active, reduce the incoming Wrath SIN damage resistance multiplier by 0.09, affecting Wrath damage only.

**Rank III (Ceil ×2.50):** While this shield is equipped and its ward is active, reduce the incoming Wrath SIN damage resistance multiplier by 0.15, affecting Wrath damage only.

**Typed resistance:** `sin` / `wrath` (magnitudes in hundredths).

**Limits and implementation gates:** Only Wrath affinity. Does not reduce all Fire damage unless the authoritative combat hit is actually assigned Wrath; SIN multiplier hook requires separate integration.

---

##### Roseglass Vow · ACCESSORY

**Example:** Roseglass Vow Brooch  
**Compatible chassis:** `ring`, `brooch`, `pendant`  
**Axes:** Lust, SIN Resistance, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> The rose under the glass has never wilted; it keeps desire from becoming a blade.

**Base Effect:** While this accessory is equipped, reduce the incoming Lust SIN damage resistance multiplier by 0.06, affecting Lust damage only.

**Rank I (×1):** While this accessory is equipped, reduce the incoming Lust SIN damage resistance multiplier by 0.06, affecting Lust damage only.

**Rank II (Ceil ×1.50):** While this accessory is equipped, reduce the incoming Lust SIN damage resistance multiplier by 0.09, affecting Lust damage only.

**Rank III (Ceil ×2.50):** While this accessory is equipped, reduce the incoming Lust SIN damage resistance multiplier by 0.15, affecting Lust damage only.

**Typed resistance:** `sin` / `lust` (magnitudes in hundredths).

**Limits and implementation gates:** Only actual Lust-affinity damage; does not block Charmed or other mental conditions. SIN resistance application requires approved engine integration.

---

##### Hourglass Sanctuary · SHIELD

**Example:** Hourglass Sanctuary Round Shield  
**Compatible chassis:** `shield_buckler`, `shield_round`, `shield_heater`  
**Axes:** Sloth, SIN Resistance, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> The sand inside the ward falls sideways whenever the world attempts to drag its bearer down.

**Base Effect:** While this shield is equipped and its ward is active, reduce the incoming Sloth SIN damage resistance multiplier by 0.06, affecting Sloth damage only.

**Rank I (×1):** While this shield is equipped and its ward is active, reduce the incoming Sloth SIN damage resistance multiplier by 0.06, affecting Sloth damage only.

**Rank II (Ceil ×1.50):** While this shield is equipped and its ward is active, reduce the incoming Sloth SIN damage resistance multiplier by 0.09, affecting Sloth damage only.

**Rank III (Ceil ×2.50):** While this shield is equipped and its ward is active, reduce the incoming Sloth SIN damage resistance multiplier by 0.15, affecting Sloth damage only.

**Typed resistance:** `sin` / `sloth` (magnitudes in hundredths).

**Limits and implementation gates:** Applies to Sloth affinity damage, not loss of actions or Speed. SIN modifiers must be combined in the canonical damage calculation.

---

##### Verdant Covenant · SHIELD

**Example:** Verdant Covenant Tower Shield  
**Compatible chassis:** `shield_round`, `shield_heater`, `shield_tower`  
**Axes:** Gluttony, SIN Resistance, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> Roots of translucent jade drink the greed of any curse that dares come close.

**Base Effect:** While this shield is equipped and its ward is active, reduce the incoming Gluttony SIN damage resistance multiplier by 0.06, affecting Gluttony damage only.

**Rank I (×1):** While this shield is equipped and its ward is active, reduce the incoming Gluttony SIN damage resistance multiplier by 0.06, affecting Gluttony damage only.

**Rank II (Ceil ×1.50):** While this shield is equipped and its ward is active, reduce the incoming Gluttony SIN damage resistance multiplier by 0.09, affecting Gluttony damage only.

**Rank III (Ceil ×2.50):** While this shield is equipped and its ward is active, reduce the incoming Gluttony SIN damage resistance multiplier by 0.15, affecting Gluttony damage only.

**Typed resistance:** `sin` / `gluttony` (magnitudes in hundredths).

**Limits and implementation gates:** Gluttony SIN only, not universal Poison/Acid defense. Requires the correct SIN tag in the authoritative hit.

---

##### Nocturne Shroud · ARMOR

**Example:** Nocturne Shroud Leather Armor  
**Compatible chassis:** `padded_armor`, `leather_armor`, `hide_armor`, `chain_shirt`  
**Axes:** Gloom, SIN Resistance, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> A strip of midnight is sewn into the garment, swallowing only the grief meant to destroy.

**Base Effect:** While this armor is equipped, reduce the incoming Gloom SIN damage resistance multiplier by 0.06, affecting Gloom damage only.

**Rank I (×1):** While this armor is equipped, reduce the incoming Gloom SIN damage resistance multiplier by 0.06, affecting Gloom damage only.

**Rank II (Ceil ×1.50):** While this armor is equipped, reduce the incoming Gloom SIN damage resistance multiplier by 0.09, affecting Gloom damage only.

**Rank III (Ceil ×2.50):** While this armor is equipped, reduce the incoming Gloom SIN damage resistance multiplier by 0.15, affecting Gloom damage only.

**Typed resistance:** `sin` / `gloom` (magnitudes in hundredths).

**Limits and implementation gates:** Does not reduce Sinking SP damage unless combat classifies that damage under the Gloom affinity multiplier. No interaction with permanent despair.

---

##### Crown of Humility · ACCESSORY

**Example:** Crown of Humility Pendant  
**Compatible chassis:** `ring`, `brooch`, `pendant`  
**Axes:** Pride, SIN Resistance, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> The crown bears no jewel, and in its absence the world's proudest words lose their edge.

**Base Effect:** While this accessory is equipped, reduce the incoming Pride SIN damage resistance multiplier by 0.06, affecting Pride damage only.

**Rank I (×1):** While this accessory is equipped, reduce the incoming Pride SIN damage resistance multiplier by 0.06, affecting Pride damage only.

**Rank II (Ceil ×1.50):** While this accessory is equipped, reduce the incoming Pride SIN damage resistance multiplier by 0.09, affecting Pride damage only.

**Rank III (Ceil ×2.50):** While this accessory is equipped, reduce the incoming Pride SIN damage resistance multiplier by 0.15, affecting Pride damage only.

**Typed resistance:** `sin` / `pride` (magnitudes in hundredths).

**Limits and implementation gates:** Pride damage only. Does not negate Radiance or remove buffs. Requires SIN-tagged damage handling.

---

##### Jealousy Mirror · ACCESSORY

**Example:** Jealousy Mirror Ring  
**Compatible chassis:** `brooch`, `pendant`, `ring`  
**Axes:** Envy, SIN Resistance, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> The tiny mirror reflects lightning only when it belongs to someone else.

**Base Effect:** While this accessory is equipped, reduce the incoming Envy SIN damage resistance multiplier by 0.06, affecting Envy damage only.

**Rank I (×1):** While this accessory is equipped, reduce the incoming Envy SIN damage resistance multiplier by 0.06, affecting Envy damage only.

**Rank II (Ceil ×1.50):** While this accessory is equipped, reduce the incoming Envy SIN damage resistance multiplier by 0.09, affecting Envy damage only.

**Rank III (Ceil ×2.50):** While this accessory is equipped, reduce the incoming Envy SIN damage resistance multiplier by 0.15, affecting Envy damage only.

**Typed resistance:** `sin` / `envy` (magnitudes in hundredths).

**Limits and implementation gates:** Envy damage only, not all Shock or Lightning unless canonically tagged as Envy. This is resistance, not damage reflection.

---

#### Runic (3)

##### Silverstep · ACCESSORY

**Example:** Silverstep Anklet  
**Compatible chassis:** `anklet`, `bracelet`, `earrings`  
**Axes:** Speed, Haste, Passive  
**Editorial status:** PROPOSED · NOT PLAYABLE

> A silver footfall is engraved where tomorrow should have been, daring its bearer to arrive early.

**Base Effect:** At Encounter Start, gain 1 Haste for the first Turn of that Encounter.

**Rank I (×1):** At Encounter Start, gain 1 Haste for the first Turn of that Encounter.

**Rank II (Ceil ×1.50):** At Encounter Start, gain 2 Haste for the first Turn of that Encounter.

**Rank III (Ceil ×2.50):** At Encounter Start, gain 3 Haste for the first Turn of that Encounter.

**Base scalable magnitudes:** haste: 1.

**Limits and implementation gates:** Haste is restricted to the first Turn. Does not create Action Slots, add Coins, or grant permanent Speed.

---

##### Warcall Inscription · WEAPON

**Example:** Warcall Inscription Longsword  
**Compatible chassis:** `longsword`, `rapier`, `spear`, `warhammer`  
**Axes:** Offensive Level, Passive, Attack  
**Editorial status:** PROPOSED · NOT PLAYABLE

> The weapon answers the first bell of battle with the certainty of an opening move.

**Base Effect:** At Encounter Start, gain 1 Offensive Level Up for the first Attack Skill sourced from this exact equipped weapon during the first Turn.

**Rank I (×1):** At Encounter Start, gain 1 Offensive Level Up for the first Attack Skill sourced from this exact equipped weapon during the first Turn.

**Rank II (Ceil ×1.50):** At Encounter Start, gain 2 Offensive Level Up for the first Attack Skill sourced from this exact equipped weapon during the first Turn.

**Rank III (Ceil ×2.50):** At Encounter Start, gain 3 Offensive Level Up for the first Attack Skill sourced from this exact equipped weapon during the first Turn.

**Base scalable magnitudes:** offense: 1.

**Limits and implementation gates:** Applies only to the first eligible bound weapon Skill. Not Base Power, Final Power or Clash Power; no global improvement to other weapons.

---

##### Warden's Promise · SHIELD

**Example:** Warden's Promise Tower Shield  
**Compatible chassis:** `shield_round`, `shield_heater`, `shield_tower`  
**Axes:** Defensive Level, Passive, Guard  
**Editorial status:** PROPOSED · NOT PLAYABLE

> One line on the shield is left unfinished until the first impact proves the bearer stayed.

**Base Effect:** At Encounter Start, gain 1 Defensive Level Up for the first Guard Skill sourced from this shield during the first Turn.

**Rank I (×1):** At Encounter Start, gain 1 Defensive Level Up for the first Guard Skill sourced from this shield during the first Turn.

**Rank II (Ceil ×1.50):** At Encounter Start, gain 2 Defensive Level Up for the first Guard Skill sourced from this shield during the first Turn.

**Rank III (Ceil ×2.50):** At Encounter Start, gain 3 Defensive Level Up for the first Guard Skill sourced from this shield during the first Turn.

**Base scalable magnitudes:** defense: 1.

**Limits and implementation gates:** Effect ends when the first Guard is resolved or Turn 1 ends; cannot buff another shield or provide permanent Defensive Level.

---

### Review gates specific to these passives

- [ ] Approve frequency/timing for HP regeneration and SP recovery (Turn Start is a draft assumption).
- [ ] Confirm interactions between Max HP changes, CON, Decay, temporary HP, Stagger Thresholds and equip changes.
- [ ] Confirm whether the stated 0.06 is a direct subtraction to an existing resistance multiplier for the matched damage/SIN type (current design), without changing other resistances.
- [ ] Choose SIN damage multiplier minimum and non-stacking rules before any runtime integration.
- [ ] Verify whether SP loss mitigation covers every involuntary SP-loss packet, with Costs always excluded (current proposal).
- [ ] Confirm passive activation and compatibility when equipped/attuned, including accessories and Source Item Instance identity.
- [ ] Do not silently convert these design proposals into live Item or combat effects, DM prices or production recipes.
