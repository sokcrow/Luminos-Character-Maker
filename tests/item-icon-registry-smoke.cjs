const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemIconRegistry;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-icon-registry.js')).href);
  const registry = globalThis.LuminousItemIconRegistry;

  assert.ok(registry);
  assert.equal(registry.VERSION, 20);
  assert.equal(registry.DEFAULT_GROUP, 'generic_item');
  assert.equal(Object.keys(registry.GROUPS).length, 262);

  const groups = registry.list();
  assert.equal(new Set(groups.map((entry) => entry.id)).size, groups.length);
  for (const entry of groups) {
    assert.equal(typeof entry.label, 'string');
    assert.equal(typeof entry.labelEs, 'string');
    assert.match(entry.icon, /^https:\/\/imgur\.com\/[A-Za-z0-9]+\.png$/);
  }

  const legacyCritical = [
    'healing_hp', 'food', 'meat_mammal', 'hide_mammal', 'hard_bone', 'scale_reptile',
    'feather_raw', 'organ_internal', 'blood', 'venom_raw', 'ooze_gel', 'essence_raw',
    'energy_core', 'fruit_raw', 'vegetable_raw', 'grain_seed_raw', 'spice_herb_raw',
    'medicinal_herb_raw', 'fungus_raw', 'botanical_extract_raw', 'ore_raw', 'metal_ingot',
    'gem_rough', 'gem_cut', 'structural_stock', 'fasteners_hardware', 'wire_cable',
    'glass_component', 'container', 'tool', 'repair_kit', 'weapon_melee', 'weapon_ranged'
  ];
  for (const id of legacyCritical) assert.equal(registry.has(id), true, id);

  const culinaryIcons = {
    animal_milk: 'https://imgur.com/IxaxoZ1.png',
    animal_egg: 'https://imgur.com/x4caPXf.png',
    animal_honey: 'https://imgur.com/eNuLm5s.png',
    culinary_water: 'https://imgur.com/Nqu6azm.png',
    culinary_seasoning: 'https://imgur.com/w6S1WYi.png',
    culinary_sweetener: 'https://imgur.com/oSwtrjm.png',
    culinary_flour: 'https://imgur.com/1tyQhuN.png',
    culinary_dough: 'https://imgur.com/TD8XMl8.png',
    culinary_dairy: 'https://imgur.com/H0y92fH.png',
    culinary_oil: 'https://imgur.com/8zxhiiP.png',
    culinary_stock: 'https://imgur.com/SDq6v2E.png',
    culinary_sauce: 'https://imgur.com/kjo19dQ.png',
    culinary_culture: 'https://imgur.com/VUet0PY.png',
    food_bread: 'https://imgur.com/Nuxo0td.png',
    food_meal: 'https://imgur.com/vIEGDjC.png',
    food_soup: 'https://imgur.com/ZsJeTRz.png',
    food_stew: 'https://imgur.com/goOaMAZ.png',
    food_fried: 'https://imgur.com/GKZpTyn.png',
    food_baked: 'https://imgur.com/PSWonqY.png',
    food_dessert: 'https://imgur.com/Yx7PuNo.png',
    food_snack: 'https://imgur.com/bvRPR9n.png',
    ration_field: 'https://imgur.com/3Mak6XC.png',
    ration_preserved: 'https://imgur.com/3bK29IS.png',
    ration_canned: 'https://imgur.com/38PbW0M.png',
    ration_emergency: 'https://imgur.com/SIRWsEZ.png',
    drink_water: 'https://imgur.com/qn4PPTy.png',
    drink_juice: 'https://imgur.com/ytqtH1l.png',
    drink_hot: 'https://imgur.com/Yui2IeC.png',
    drink_can: 'https://imgur.com/5zE9jAZ.png',
    drink_beer: 'https://imgur.com/jN7uKet.png',
    drink_wine: 'https://imgur.com/zzgeqPy.png',
    drink_spirit: 'https://imgur.com/XPOUo7k.png',
    drink_cocktail: 'https://imgur.com/IKC5vpu.png'
  };
  for (const [id, icon] of Object.entries(culinaryIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
  }



  const throwableIcons = {
    fragmentation_throwable:'https://imgur.com/86SI68G.png',
    incendiary_throwable:'https://imgur.com/nxjMC8Q.png',
    cryogenic_throwable:'https://imgur.com/BS4HOXl.png',
    shock_throwable:'https://imgur.com/MzZcjBD.png',
    concussive_throwable:'https://imgur.com/Hb5VIiL.png',
    smoke_throwable:'https://imgur.com/u7E4CBP.png',
    flash_throwable:'https://imgur.com/1khxhvI.png',
    marking_throwable:'https://imgur.com/DmxDyfg.png',
    grenade_shell:'https://imgur.com/6lp2xrs.png',
    fragmentation_filler:'https://imgur.com/Mz3ZOb7.png',
    concussive_charge:'https://imgur.com/DZo1Ry5.png',
    cryogenic_reagent:'https://imgur.com/ID7ksk9.png',
    cryogenic_solution:'https://imgur.com/ID7ksk9.png',
    shock_charge:'https://imgur.com/zo5fDsD.png'
  };
  for (const [id, icon] of Object.entries(throwableIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
  }

  const medicalIcons = {
    herb_healing: 'https://imgur.com/MxYeHQj.png',
    herb_calming: 'https://imgur.com/K3WjGc9.png',
    herb_antidote: 'https://imgur.com/oJI2jmC.png',
    herb_stimulant: 'https://imgur.com/1yUNJJK.png',
    herb_toxic: 'https://imgur.com/UK26wpe.png',
    fungus_medicinal: 'https://imgur.com/RlLxRue.png',
    fungus_toxic: 'https://imgur.com/sel7SAk.png',
    pharma_reagent: 'https://imgur.com/D4hvPjc.png',
    antiseptic_reagent: 'https://imgur.com/aFf6zkx.png',
    electrolyte_reagent: 'https://imgur.com/iK5xWGb.png',
    medical_solvent: 'https://imgur.com/j2ujAaZ.png',
    medical_buffer: 'https://imgur.com/X0nCYce.png',
    medical_polymer: 'https://imgur.com/1Az78Cj.png',
    chemical_toxin: 'https://imgur.com/lub4VM4.png',
    bio_reagent: 'https://imgur.com/NtN9T9e.png',
    regenerative_reagent: 'https://imgur.com/uETqg7y.png',
    medicinal_extract: 'https://imgur.com/zVIhrJx.png',
    medicinal_concentrate: 'https://imgur.com/JLU1ppg.png',
    sterile_solution: 'https://imgur.com/RzUAPKm.png',
    antiseptic_solution: 'https://imgur.com/kk3jRHU.png',
    antitoxin_base: 'https://imgur.com/xeTT6XR.png',
    pharmaceutical_powder: 'https://imgur.com/XuqELY5.png',
    medical_gel_base: 'https://imgur.com/wuprmWD.png',
    ointment_base: 'https://imgur.com/NL3BAUG.png',
    stabilized_reagent: 'https://imgur.com/DL8QPJF.png',
    toxin_extract: 'https://imgur.com/Y3Wfv56.png',
    medicine_tablet: 'https://imgur.com/RpE4r67.png',
    medicine_capsule: 'https://imgur.com/loy7XOq.png',
    medicine_ampoule: 'https://imgur.com/ViP7EkI.png',
    medicine_vial: 'https://imgur.com/cKupyxd.png',
    medicine_inhaler: 'https://imgur.com/JKdJjqn.png',
    medicine_patch: 'https://imgur.com/iox3gDW.png',
    medicine_topical: 'https://imgur.com/UuvoIW4.png',
    medicine_dressing: 'https://imgur.com/Hcdd3uo.png',
    medicine_kit: 'https://imgur.com/EirGGzN.png',
    antidote_ampoule: 'https://imgur.com/Xo6Yc2Z.png',
    antidote_tablet: 'https://imgur.com/9dyygcB.png',
    antidote_vial: 'https://imgur.com/NBfD4Ph.png',
    antidote_inhaler: 'https://imgur.com/cazx8yG.png',
    poison_vial: 'https://imgur.com/A9gDv3u.png',
    poison_capsule: 'https://imgur.com/AXj1bK7.png',
    poison_coating: 'https://imgur.com/fNbIBAw.png',
    toxic_aerosol: 'https://imgur.com/t7qoFpM.png',
    toxic_ampoule: 'https://imgur.com/op7yURL.png'
  };
  for (const [id, icon] of Object.entries(medicalIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
  }


  const chemistryIcons = {
    industrial_solvent:'https://imgur.com/ZffaWPf.png',
    industrial_lubricant:'https://imgur.com/4237RQy.png',
    industrial_resin:'https://imgur.com/d9IL3TQ.png',
    industrial_polymer:'https://imgur.com/UuZO4jM.png',
    industrial_adhesive:'https://imgur.com/YgCZ9xB.png',
    industrial_pigment:'https://imgur.com/2TM8f2U.png',
    chemical_catalyst:'https://imgur.com/uy5blne.png',
    chemical_stabilizer:'https://imgur.com/WfynG6n.png',
    chemical_reactive:'https://imgur.com/mfG1y4T.png',
    chemical_corrosive:'https://imgur.com/vUb0Jzj.png',
    chemical_conductive:'https://imgur.com/QaoKXuj.png',
    chemical_insulator:'https://imgur.com/Vc0QRCu.png',
    environmental_absorbent:'https://imgur.com/BiqIrzt.png',
    environmental_neutralizer:'https://imgur.com/KSMxxwE.png',
    environmental_filter_media:'https://imgur.com/fi2CGWv.png',
    water_treatment_reagent:'https://imgur.com/joU55O6.png',
    cleaning_compound:'https://imgur.com/ldloU3y.png',
    sealant_compound:'https://imgur.com/Tuupj00.png',
    lubricant_compound:'https://imgur.com/4RSPK2U.png',
    polymer_compound:'https://imgur.com/2foeDpV.png',
    adhesive_compound:'https://imgur.com/BAf5rk0.png',
    pigment_compound:'https://imgur.com/0in07BB.png',
    reactive_compound:'https://imgur.com/MMBR0SW.png',
    corrosive_solution:'https://imgur.com/sH6e9Oj.png',
    neutralizing_solution:'https://imgur.com/GgcgKdR.png',
    decontamination_solution:'https://imgur.com/3ejmfgY.png',
    stabilized_compound:'https://imgur.com/UgUbgiK.png',
    treatment_solution:'https://imgur.com/GpubG66.png',
    industrial_cleaner:'https://imgur.com/Lrexv15.png',
    industrial_sealant:'https://imgur.com/3Mnzb5K.png',
    industrial_lubricant_pack:'https://imgur.com/kE23Jlc.png',
    industrial_coating:'https://imgur.com/rfpKeST.png',
    repair_adhesive:'https://imgur.com/QD4uVsU.png',
    chemical_cartridge:'https://imgur.com/qw8Wokw.png',
    chemical_canister:'https://imgur.com/eI69yEk.png',
    reactive_canister:'https://imgur.com/nUmbKv3.png',
    corrosive_canister:'https://imgur.com/cIFMMNA.png',
    maintenance_kit:'https://imgur.com/VE8IfKf.png',
    water_purifier:'https://imgur.com/CXwtccN.png',
    filter_cartridge:'https://imgur.com/o0kvdU7.png',
    spill_absorbent_kit:'https://imgur.com/FLrklb5.png',
    decontamination_spray:'https://imgur.com/lpUIdPZ.png',
    neutralizer_spray:'https://imgur.com/MgIMGzQ.png',
    containment_foam:'https://imgur.com/u3tOTn6.png',
    hazard_bag:'https://imgur.com/BLj9Scr.png',
    environmental_kit:'https://imgur.com/F5BbEu2.png'
  };
  for (const [id, icon] of Object.entries(chemistryIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
  }

  const weaponIcons = {
    weapon_sword: 'https://imgur.com/3AEGrWu.png',
    weapon_dagger: 'https://imgur.com/K3d5UEA.png',
    weapon_polearm: 'https://imgur.com/WWODflC.png',
    weapon_hammer: 'https://imgur.com/WwAq8r.png',
    weapon_firearm_shotgun: 'https://imgur.com/46tMIlQ.png',
    weapon_sling: 'https://imgur.com/hmPPD07.png',
    weapon_firearm_pistol: 'https://imgur.com/gJJgmqX.png',
    weapon_net: 'https://imgur.com/T3u9Z3N.png',
    weapon_firearm_revolver: 'https://imgur.com/GCEeR8H.png',
    weapon_firearm_smg: 'https://imgur.com/L5FQuTA.png',
    weapon_spear: 'https://imgur.com/DUGcpP5.png',
    weapon_crossbow: 'https://imgur.com/83PWc1r.png',
    weapon_pick: 'https://imgur.com/dTwA4cO.png',
    weapon_whip: 'https://imgur.com/Nw8Mdnp.png',
    weapon_blunt: 'https://imgur.com/XElPYSo.png',
    weapon_blowgun: 'https://imgur.com/qkKi2DL.png',
    weapon_firearm_rifle: 'https://imgur.com/aXXrcFQ.png',
    weapon_staff: 'https://imgur.com/AChSLCZ.png',
    weapon_axe: 'https://imgur.com/Fp9MJRw.png',
    weapon_bow: 'https://imgur.com/PWnWMq1.png'
  };
  for (const [id, icon] of Object.entries(weaponIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
    assert.equal(registry.get(id).domain, 'equipment');
  }

  const equipmentIds = registry.list({ domain: 'equipment' }).map((entry) => entry.id);
  assert.equal(equipmentIds.length, 31);
  assert.deepEqual(equipmentIds.slice(0, 22), [
    'weapon_melee', 'weapon_ranged',
    'weapon_sword', 'weapon_dagger', 'weapon_polearm', 'weapon_hammer',
    'weapon_firearm_shotgun', 'weapon_sling', 'weapon_firearm_pistol', 'weapon_net',
    'weapon_firearm_revolver', 'weapon_firearm_smg', 'weapon_spear', 'weapon_crossbow',
    'weapon_pick', 'weapon_whip', 'weapon_blunt', 'weapon_blowgun', 'weapon_firearm_rifle',
    'weapon_staff', 'weapon_axe', 'weapon_bow'
  ]);
  assert.deepEqual(equipmentIds.slice(22), ['shield', 'shield_buckler', 'shield_round', 'shield_heater', 'shield_tower', 'accessory', 'armor_light', 'armor_medium', 'armor_heavy']);

  const shieldIcons = {
    shield_buckler: 'https://imgur.com/mct54op.png',
    shield_round: 'https://imgur.com/XBJvyX3.png',
    shield_heater: 'https://imgur.com/cIj9CrB.png',
    shield_tower: 'https://imgur.com/mUnjNz4.png'
  };
  for (const [id, icon] of Object.entries(shieldIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
    assert.equal(registry.get(id).domain, 'equipment');
  }
  assert.equal(registry.canonicalGroupId('buckler'), 'shield_buckler');
  assert.equal(registry.canonicalGroupId('round_shield'), 'shield_round');
  assert.equal(registry.canonicalGroupId('heater_shield'), 'shield_heater');
  assert.equal(registry.canonicalGroupId('tower_shield'), 'shield_tower');

  const weaponAliasExpectations = {
    sword: 'weapon_sword', dagger: 'weapon_dagger', polearm: 'weapon_polearm', pole_arm: 'weapon_polearm',
    hammer: 'weapon_hammer', shotgun: 'weapon_firearm_shotgun', sling: 'weapon_sling',
    pistol: 'weapon_firearm_pistol', net: 'weapon_net', revolver: 'weapon_firearm_revolver',
    smg: 'weapon_firearm_smg', spear: 'weapon_spear', crossbow: 'weapon_crossbow',
    pick: 'weapon_pick', pickaxe: 'weapon_pick', whip: 'weapon_whip', blunt_weapon: 'weapon_blunt',
    blowgun: 'weapon_blowgun', rifle: 'weapon_firearm_rifle', staff: 'weapon_staff', axe: 'weapon_axe', bow: 'weapon_bow'
  };
  for (const [alias, expected] of Object.entries(weaponAliasExpectations)) assert.equal(registry.canonicalGroupId(alias), expected);

  const legacyAliasExpectations = {
    'Light Armor': 'armor_light', 'Melee Weapon': 'weapon_melee', food_meat: 'food', meat: 'meat_mammal',
    hide_leather: 'hide_mammal', bone_horn: 'hard_bone', fang: 'hard_claw', tusk: 'hard_horn',
    scale: 'scale_reptile', shell: 'shell_carapace', chitin: 'chitin_plate', feather: 'feather_raw',
    wool: 'animal_fiber_raw', raw_silk: 'silk_raw', ore: 'ore_raw', ore_mineral: 'ore_raw',
    ingot: 'metal_ingot', rough_gem: 'gem_rough', cut_gem: 'gem_cut', heart: 'organ_internal',
    eye: 'organ_sensory', brain: 'organ_brain', gland: 'organ_gland', humanoid_blood: 'blood',
    exotic_fluid: 'ichor', venom: 'venom_raw', acid: 'acid_secretion', ink: 'ink_secretion',
    slime: 'ooze_gel', arcane_essence: 'essence_raw', mana_core: 'energy_core', fruit: 'fruit_raw',
    vegetables: 'vegetable_raw', grain: 'grain_seed_raw', spice: 'spice_herb_raw', mushroom: 'fungus_raw',
    resin: 'botanical_extract_raw', processed_stock: 'structural_stock', fasteners: 'fasteners_hardware',
    wire: 'wire_cable', vessel: 'container', harvesting_tool: 'harvest_kit', smithing_tool: 'smithing_tools',
    technical_tool: 'technical_tools', chemical_tool: 'chemical_tools'
  };
  for (const [alias, expected] of Object.entries(legacyAliasExpectations)) assert.equal(registry.canonicalGroupId(alias), expected);

  assert.equal(registry.resolveIcon('ore_mineral'), 'https://imgur.com/xR1qk05.png');
  assert.equal(registry.resolveIcon('harvesting_tool'), 'https://imgur.com/o1ZbzmZ.png');
  assert.equal(registry.resolveIcon('wire'), 'https://imgur.com/NHMef8W.png');
  assert.equal(registry.resolveIcon('bow'), 'https://imgur.com/PWnWMq1.png');

  assert.equal(registry.canonicalGroupId('constructor'), 'constructor');
  assert.equal(registry.has('constructor'), false);
  assert.equal(registry.get('constructor', { fallback: false }), null);
  assert.equal(registry.get('constructor').id, 'generic_item');
  assert.equal(registry.resolveIcon('nightshade'), registry.resolveIcon('generic_item'));
  assert.equal(registry.get('missing-family').id, 'generic_item');
  assert.equal(registry.get('missing-family', { fallback: false }), null);
  assert.equal(registry.resolveIcon('healing_hp', { iconOverride: 'https://example.test/custom.png' }), 'https://example.test/custom.png');

  console.log(`Item icon registry smoke: OK (${groups.length} families, culinary + medical + weapon-specific families)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
