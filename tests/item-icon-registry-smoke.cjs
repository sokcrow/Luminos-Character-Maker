const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemIconRegistry;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-icon-registry.js')).href);
  const registry = globalThis.LuminousItemIconRegistry;

  assert.ok(registry);
  assert.equal(registry.VERSION, 14);
  assert.equal(registry.DEFAULT_GROUP, 'generic_item');
  assert.equal(Object.keys(registry.GROUPS).length, 101);
  assert.equal(registry.has('healing_hp'), true);
  assert.equal(registry.has('weapon_melee'), true);
  assert.equal(registry.has('structural_stock'), true);
  assert.equal(registry.has('fasteners_hardware'), true);
  assert.equal(registry.has('wire_cable'), true);
  assert.equal(registry.has('glass_component'), true);
  assert.equal(registry.has('container'), true);
  assert.equal(registry.has('trap'), false);
  assert.equal(registry.has('currency'), false);

  const groups = registry.list();
  assert.equal(new Set(groups.map((entry) => entry.id)).size, groups.length);
  for (const entry of groups) {
    assert.equal(typeof entry.label, 'string');
    assert.equal(typeof entry.labelEs, 'string');
    assert.match(entry.icon, /^https:\/\/imgur\.com\/[A-Za-z0-9]+\.png$/);
  }

  assert.deepEqual(registry.list({ domain: 'equipment' }).map((entry) => entry.id), ['weapon_melee', 'weapon_ranged', 'shield', 'accessory', 'armor_light', 'armor_medium', 'armor_heavy']);
  assert.deepEqual(registry.list({ domain: 'material' }).filter((entry) => entry.id.startsWith('meat_')).map((entry) => entry.id), ['meat_mammal', 'meat_bird', 'meat_fish', 'meat_shellfish', 'meat_reptile', 'meat_draconic', 'meat_insectoid']);

  const botanicalIds = ['fruit_raw', 'vegetable_raw', 'grain_seed_raw', 'spice_herb_raw', 'medicinal_herb_raw', 'fungus_raw', 'botanical_extract_raw'];
  assert.deepEqual(registry.list({ domain: 'material' }).filter((entry) => botanicalIds.includes(entry.id)).map((entry) => entry.id), botanicalIds);

  const mineralIconIds = ['ore_raw', 'metal_ingot', 'gem_rough', 'gem_cut'];
  assert.deepEqual(registry.list({ domain: 'material' }).filter((entry) => mineralIconIds.includes(entry.id)).map((entry) => entry.id), mineralIconIds);

  const componentIconIds = ['structural_stock', 'fasteners_hardware', 'wire_cable', 'glass_component', 'container'];
  assert.deepEqual(registry.list({ domain: 'material' }).filter((entry) => componentIconIds.includes(entry.id)).map((entry) => entry.id), componentIconIds);

  const toolIconIds = ['tool', 'harvest_kit', 'cooking_tools', 'smithing_tools', 'fabrication_tools', 'textile_tools', 'medical_tools', 'technical_tools', 'lapidary_tools', 'chemical_tools', 'repair_kit'];
  assert.deepEqual(
    registry.list({ domain: 'utility' }).filter((entry) => toolIconIds.includes(entry.id)).map((entry) => entry.id),
    ['repair_kit', 'tool', 'harvest_kit', 'cooking_tools', 'smithing_tools', 'fabrication_tools', 'textile_tools', 'medical_tools', 'technical_tools', 'lapidary_tools', 'chemical_tools']
  );

  const aliasExpectations = {
    'Light Armor': 'armor_light', 'Melee Weapon': 'weapon_melee', food_meat: 'food', meat: 'meat_mammal', hide_leather: 'hide_mammal', bone_horn: 'hard_bone', fang: 'hard_claw', tusk: 'hard_horn', scale: 'scale_reptile', shell: 'shell_carapace', chitin: 'chitin_plate', feather: 'feather_raw', wool: 'animal_fiber_raw', raw_silk: 'silk_raw', ore: 'ore_raw', mineral: 'ore_raw', ore_mineral: 'ore_raw', raw_mineral: 'ore_raw', ingot: 'metal_ingot', refined_metal: 'metal_ingot', alloy: 'metal_ingot', rough_gem: 'gem_rough', raw_gem: 'gem_rough', cut_gem: 'gem_cut', polished_gem: 'gem_cut', heart: 'organ_internal', eye: 'organ_sensory', brain: 'organ_brain', gland: 'organ_gland', humanoid_blood: 'blood', exotic_fluid: 'ichor', venom: 'venom_raw', toxic_secretion: 'venom_raw', acid: 'acid_secretion', ink: 'ink_secretion', pheromone: 'bio_secretion', slime: 'ooze_gel', conductive_gel: 'ooze_gel', arcane_essence: 'essence_raw', mana_core: 'energy_core', fruit: 'fruit_raw', vegetables: 'vegetable_raw', grain: 'grain_seed_raw', legume: 'grain_seed_raw', nut: 'grain_seed_raw', spice: 'spice_herb_raw', culinary_herb: 'spice_herb_raw', medicinal_herb: 'medicinal_herb_raw', toxic_herb: 'medicinal_herb_raw', mushroom: 'fungus_raw', sap: 'botanical_extract_raw', resin: 'botanical_extract_raw', botanical_extract: 'botanical_extract_raw', processed_stock: 'structural_stock', structural_material: 'structural_stock', fasteners: 'fasteners_hardware', hardware: 'fasteners_hardware', wire: 'wire_cable', cable: 'wire_cable', processed_glass: 'glass_component', glassware: 'glass_component', vessel: 'container', generic_container: 'container', harvesting_tool: 'harvest_kit', harvesting_tools: 'harvest_kit', cooking_tool: 'cooking_tools', smithing_tool: 'smithing_tools', fabrication_tool: 'fabrication_tools', textile_tool: 'textile_tools', medical_tool: 'medical_tools', technical_tool: 'technical_tools', lapidary_tool: 'lapidary_tools', chemical_tool: 'chemical_tools'
  };
  for (const [alias, expected] of Object.entries(aliasExpectations)) assert.equal(registry.canonicalGroupId(alias), expected);

  const expectedIcons = {
    healing_hp: 'https://imgur.com/GcnX53v.png', food: 'https://imgur.com/uFmUpuD.png', meat_mammal: 'https://imgur.com/GQAGWzK.png', hide_mammal: 'https://imgur.com/nK6vQIR.png', hard_bone: 'https://imgur.com/HrqeZ0a.png', scale_reptile: 'https://imgur.com/cJz55WQ.png', feather_raw: 'https://imgur.com/EPkBtW0.png', organ_internal: 'https://imgur.com/rXlXbOG.png', blood: 'https://imgur.com/7a75QU2.png', venom_raw: 'https://imgur.com/8dBvLD5.png', ooze_gel: 'https://imgur.com/91cMoMg.png', essence_raw: 'https://imgur.com/Yay5U5o.png', energy_core: 'https://imgur.com/KBSJN7y.png', fruit_raw: 'https://imgur.com/JA0yMwM.png', vegetable_raw: 'https://imgur.com/QWUZK4g.png', grain_seed_raw: 'https://imgur.com/Z0TuVti.png', spice_herb_raw: 'https://imgur.com/zvEvhjc.png', medicinal_herb_raw: 'https://imgur.com/FY3Sda7.png', fungus_raw: 'https://imgur.com/YRTeaK5.png', botanical_extract_raw: 'https://imgur.com/818zarC.png', ore_raw: 'https://imgur.com/xR1qk05.png', metal_ingot: 'https://imgur.com/BNTZ6FI.png', gem_rough: 'https://imgur.com/18tq0PQ.png', gem_cut: 'https://imgur.com/sDAhiUI.png', structural_stock: 'https://imgur.com/C985Ijj.png', fasteners_hardware: 'https://imgur.com/UvxjuRG.png', wire_cable: 'https://imgur.com/NHMef8W.png', glass_component: 'https://imgur.com/s4C3Jog.png', container: 'https://imgur.com/DvIOvQk.png', harvest_kit: 'https://imgur.com/o1ZbzmZ.png', cooking_tools: 'https://imgur.com/9J5aoNo.png', smithing_tools: 'https://imgur.com/U9eG3Iw.png', fabrication_tools: 'https://imgur.com/KBJtJvx.png', textile_tools: 'https://imgur.com/GroyHFc.png', medical_tools: 'https://imgur.com/q0qnACw.png', technical_tools: 'https://imgur.com/oPFjjqC.png', lapidary_tools: 'https://imgur.com/EWDbp22.png', chemical_tools: 'https://imgur.com/jlcBHuz.png', toxin_material: 'https://imgur.com/8dBvLD5.png'
  };
  for (const [id, icon] of Object.entries(expectedIcons)) assert.equal(registry.resolveIcon(id), icon);

  assert.equal(registry.resolveIcon('ore_mineral'), 'https://imgur.com/xR1qk05.png');
  assert.equal(registry.resolveIcon('ingot'), 'https://imgur.com/BNTZ6FI.png');
  assert.equal(registry.resolveIcon('rough_gem'), 'https://imgur.com/18tq0PQ.png');
  assert.equal(registry.resolveIcon('cut_gem'), 'https://imgur.com/sDAhiUI.png');
  assert.equal(registry.resolveIcon('harvesting_tool'), 'https://imgur.com/o1ZbzmZ.png');
  assert.equal(registry.resolveIcon('chemical_tool'), 'https://imgur.com/jlcBHuz.png');
  assert.equal(registry.resolveIcon('fruit'), 'https://imgur.com/JA0yMwM.png');
  assert.equal(registry.resolveIcon('container'), 'https://imgur.com/DvIOvQk.png');
  assert.equal(registry.resolveIcon('wire'), 'https://imgur.com/NHMef8W.png');

  // Unknown IDs that happen to exist on Object.prototype must remain unknown.
  assert.equal(registry.canonicalGroupId('constructor'), 'constructor');
  assert.equal(registry.has('constructor'), false);
  assert.equal(registry.get('constructor', { fallback: false }), null);
  assert.equal(registry.get('constructor').id, 'generic_item');

  assert.equal(registry.resolveIcon('nightshade'), registry.resolveIcon('generic_item'));
  assert.equal(registry.get('missing-family').id, 'generic_item');
  assert.equal(registry.get('missing-family', { fallback: false }), null);
  assert.equal(registry.resolveIcon('healing_hp', { iconOverride: 'https://example.test/custom.png' }), 'https://example.test/custom.png');

  console.log(`Item icon registry smoke: OK (${groups.length} families)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
