import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const menuSource = read('js/combat-v073-economy-menu.js');
const planSync = read('js/combat-v073-plan-sync.js');
const traitCatalog = read('js/archetype-trait-catalog.js');

assert.ok(menuSource.includes('new Set(["global", "skills", "spells"])'), 'economy tabs must be limited to ACTIONS, SKILLS and SPELLS');
assert.ok(!menuSource.includes('new Set(["global", "skills", "spells", "defense"'), 'Defense must keep its independent UI');
assert.ok(menuSource.includes('data-economy="action"') && menuSource.includes('data-economy="quick_action"') && menuSource.includes('data-economy="reaction"'), 'all three economy tabs must be rendered');

assert.ok(menuSource.includes('source?.economyCost') && menuSource.includes('source?.economy?.cost'), 'content must support structured economy metadata');
assert.ok(menuSource.includes('source?.activation?.actionCost'), 'Traits must use their canonical activation.actionCost contract');
assert.ok(menuSource.includes('LuminousArchetypeTraitCatalog'), 'ACTIONS must resolve current Archetype Traits');
assert.ok(menuSource.includes('unit.traitDefinitions') && menuSource.includes('unit.actionTraits'), 'ACTIONS must read combatant Trait definitions');
assert.ok(traitCatalog.includes('devil_lineage_improved_demonic_resistance') && traitCatalog.includes('actionCost: "quick_action"'), 'real Quick Action Trait fixture must exist');

assert.ok(menuSource.includes('if (tab === ECONOMY.ACTION) return state.originals.renderSkills?.();'), 'normal Skills must retain the canonical action-slot renderer');
assert.ok(menuSource.includes('liveActions("skill").filter'), 'Quick/Reaction Skills must come from the live Unit kit');
assert.ok(menuSource.includes('liveActions("spell")'), 'Spell economy tabs must inspect the live Unit kit');

const quickUseStart = menuSource.indexOf('function useQuickAction');
const quickUseEnd = menuSource.indexOf('function beginQuickAction', quickUseStart);
const quickUseBody = menuSource.slice(quickUseStart, quickUseEnd);
assert.ok(quickUseBody.includes('requestQuickResolution'), 'Quick Action must resolve before spending its economy resource');
assert.ok(quickUseBody.includes('economy.consume(unit, ECONOMY.QUICK'), 'successful Quick Action must consume the independent Quick Action resource');
assert.ok(quickUseBody.indexOf('requestQuickResolution') < quickUseBody.indexOf('economy.consume(unit, ECONOMY.QUICK'), 'failed Quick Actions must not spend the resource');
assert.ok(!quickUseBody.includes('scheduleAction('), 'Quick Actions must not consume or reserve an Action Slot');

const prepareStart = menuSource.indexOf('function prepareReaction');
const prepareEnd = menuSource.indexOf('function triggerPreparedReaction', prepareStart);
const prepareBody = menuSource.slice(prepareStart, prepareEnd);
assert.ok(prepareBody.includes('state.preparedReaction'), 'prepared Reactions must be armed during Planning');
assert.ok(!prepareBody.includes('economy.consume(unit, ECONOMY.REACTION'), 'preparing a Reaction must not spend it');

const triggerStart = menuSource.indexOf('function triggerPreparedReaction');
const triggerEnd = menuSource.indexOf('function loadScript', triggerStart);
const triggerBody = menuSource.slice(triggerStart, triggerEnd);
assert.ok(triggerBody.includes('detail.handled'), 'Reaction resolution must fail closed without a runtime handler');
assert.ok(triggerBody.includes('economy.consume(unit, ECONOMY.REACTION'), 'Reaction must be consumed only on a handled trigger');
assert.ok(triggerBody.indexOf('detail.handled') < triggerBody.indexOf('economy.consume(unit, ECONOMY.REACTION'), 'Reaction must not be spent before successful handling');

assert.ok(menuSource.includes('quickSpentRound') && menuSource.includes('reactionSpentRound'), 'economy spend state must survive live combatant rehydration within a Round');
assert.ok(menuSource.includes('luminous:combat073-quick-action-request'), 'Quick Actions must expose a canonical runtime resolution event');
assert.ok(menuSource.includes('luminous:combat073-reaction-trigger'), 'Reactions must expose a canonical runtime trigger event');

assert.ok(planSync.includes("script.src='js/combat-v073-economy-menu.js'"), 'the live Viewer bridge must actually load the economy menu');
assert.ok(planSync.includes("t==='trait'"), 'Trait Action Slot plans must serialize as Traits instead of Skills');

await import('../js/combat-v073-economy-menu.js');
const api = globalThis.LuminousCombatEconomyMenu073;
assert.ok(api, 'economy menu API must initialize outside the browser for contract tests');
assert.equal(api.normalizeEconomyCost({ economyCost: 'quick_action' }), 'quick_action');
assert.equal(api.normalizeEconomyCost({ activation: { actionCost: 'reaction' } }), 'reaction');
assert.equal(api.normalizeEconomyCost({ actionCost: 'action' }), 'action');
assert.equal(api.normalizeEconomyCost({ cost: 'Quick Action' }), 'action', 'display cost text must not decide economy classification');
assert.equal(api.economyTabFor({ activation: { actionCost: 'quick_action' } }), 'quick_action');

console.log('combat v0.7.3 Action/Quick Action/Reaction menu smoke: ok');
