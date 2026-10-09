# Enchantment Compendium — English Editorial Review v3

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

**Total:** 42 draft inscriptions — 21 weapon, 6 shield, 6 armor, 9 accessory.

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
