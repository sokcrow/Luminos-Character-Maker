const { test, expect } = require('@playwright/test');
const elemental = require('../js/elemental-status-runtime.js');
const core = require('../js/item-equipment-core.js');
const catalog = require('../js/equipment-catalog-v2.js');
const modules = require('../js/equipment-module-catalog.js');
const recipes = require('../js/equipment-recipe-engine.js');

test.describe('Item + Equipment Core v2', () => {
  test('ships the agreed first-delivery catalog sizes', () => {
    expect(catalog.counts).toMatchObject({basicStructural:18,mechanicalElectronic:18,elementalComponents:16,specializedComponents:8,materials:60,weaponChassis:20,armorChassis:10,accessoryChassis:10,items:100});
    expect(modules.counts).toMatchObject({elemental:20,status:18,physical:8,defense:5,utility:5,engineering:4,modules:60});
  });
  test('requires explicit stable IDs and keeps Tier numeric internally', () => {
    const ids=[...catalog.ITEMS,...modules.MODULES].map(e=>e.id);expect(new Set(ids).size).toBe(ids.length);ids.forEach(id=>expect(core.LOCAL_ID_RE.test(id)).toBeTruthy());
    catalog.ITEMS.forEach(entry=>{const normalized=core.normalizeDefinition(entry);expect(normalized.tier).toBeGreaterThanOrEqual(1);expect(normalized.tier).toBeLessThanOrEqual(10);expect(normalized.canonicalId).toMatch(/^item:/);});
    expect(core.tierToRoman(8)).toBe('VIII');expect(core.romanToTier('Tier X')).toBe(10);
  });
  test('Workshop and MK are product identity while Tier remains independent', () => {
    expect(core.workshopName('Aurelion')).toBe('Aurelion Workshop');expect(core.workshopName('Luan Workshop')).toBe('Luan Workshop');
    expect(core.displayProductName({workshopName:'Aurelion',productName:'Heavy Hammer',mark:1})).toBe('Aurelion Workshop Heavy Hammer');
    expect(core.displayProductName({workshopName:'Aurelion',productName:'Heavy Hammer',mark:3})).toBe('Aurelion Workshop Heavy Hammer MK III');
    const line=modules.lineAtMark('oscillation_driver',4);expect(line.mark).toBe(4);expect(line.displayName).toContain('MK IV');
  });
  test('consumes the existing elemental translation runtime', () => {
    expect(core.resolveElement('fire',elemental)).toEqual({element:'fire',sin:'Wrath',status:'burn'});expect(core.resolveElement('cold',elemental)).toEqual({element:'cold',sin:'Gloom',status:'chill'});expect(core.resolveElement('lightning',elemental)).toEqual({element:'lightning',sin:'Envy',status:'shock'});expect(core.resolveElement('thunder',elemental)).toEqual({element:'thunder',sin:'Wrath',status:'tremor'});expect(core.resolveElement('force',elemental)).toEqual({element:'force',sin:'Sloth',status:'force'});
  });
  test('all module and chassis material references resolve', () => {
    const missing=[];[...catalog.CHASSIS,...modules.MODULES].forEach(entry=>(entry.crafting?.ingredients||[]).forEach(i=>{if(!catalog.byId[i.materialId])missing.push(`${entry.id}:${i.materialId}`);}));expect(missing).toEqual([]);
  });
  test('weighted material rarity resists filler dilution', () => {
    const result=recipes.calculateMaterialTier([{materialId:'scrap_metal',quantity:8,role:'filler'},{materialId:'proprietary_component',quantity:1,role:'signature'}]);expect(result.highestCoreTier).toBe(7);expect(result.tier).toBeGreaterThanOrEqual(6);
  });
  test('builds Workshop equipment and a real material recipe', () => {
    const built=recipes.equipmentDefinitionFromBuild({id:'aurelion_heavy_hammer_mk2',workshopName:'Aurelion',productName:'Heavy Hammer',chassisId:'heavy_hammer_chassis',mark:2,modules:[{id:'oscillation_driver',mark:2},{id:'resonance_stabilizer',mark:1}],checkSkillId:'skill:manejo',checkThreshold:14});
    expect(built.definition.displayName).toBe('Aurelion Workshop Heavy Hammer MK II');expect(built.definition.moduleSelections).toHaveLength(2);expect(built.recipe.ingredients.length).toBeGreaterThan(3);expect(built.recipe.requirements.check).toEqual({required:true,skillId:'skill:manejo',threshold:14});expect(built.recipe.computed.materialCostAhn).toBeGreaterThan(0);
  });
  test('does not invent a craft DC when the DM has not configured one', () => {
    const recipe=recipes.deriveEquipmentRecipe({id:'plain_hammer',chassisId:'hammer_chassis'});expect(recipe.requirements.check.required).toBeTruthy();expect(recipe.requirements.check.skillId).toBeNull();expect(recipe.requirements.check.threshold).toBeNull();
  });
  test('legacy projection preserves Roman Tier and numeric tier_value', () => {
    const projected=core.legacyProjection({id:'test_blade',name:'Test Blade',category:'weapon',tier:6,economy:{basePriceAhn:123000}});expect(projected.tier).toBe('VI');expect(projected.tier_value).toBe(6);expect(projected.price).toBe(123000);
  });
});
