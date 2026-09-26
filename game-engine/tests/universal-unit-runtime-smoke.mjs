import assert from 'node:assert/strict';
import fs from 'node:fs';

const game=fs.readFileSync(new URL('../lab/game/forest-0.3.3.1.html',import.meta.url),'utf8');

assert.match(game,/UNIVERSAL_UNIT_STANDARD=Object\.freeze\(/,'Universal Unit standard must exist');
assert.match(game,/referenceUnitId:'hero'/,'Hero must be the reference contract, not a separate runtime type');
assert.match(game,/function resolveUniversalUnitSpec\(spec=\{\}\)/,'All new Units must normalize through one schema');
assert.match(game,/runtimeContract:UNIVERSAL_UNIT_STANDARD\.id/,'Every Unit must carry the universal runtime contract');
assert.match(game,/function unitContractViolations\(unit\)/,'Runtime must be able to validate any Unit');
assert.match(game,/for\(const unit of units\)\{UnitControllerSystem\.update\(unit,dt\);UnitMovementSystem\.update\(unit,dt\);UnitEnvironmentSystem\.update\(unit,dt\);UnitLocomotionSystem\.update\(unit,dt\);UnitAnimationSystem\.update\(unit,dt\);UnitNeedsSystem\.update\(unit,dt\)/,'Every active Unit must pass through the same systems');
assert.match(game,/const playerUnit=registerUnit\(\{/,'The local protagonist must be a normal registered Unit');
assert.match(game,/belleState\.unit=registerUnit\(\{/,'Belle must be a normal registered Unit');
assert.match(game,/npc\.unit=registerUnit\(\{/,'Ambient characters must be normal registered Units');
assert.doesNotMatch(game,/function registerPlayerUnit\b/,'There must be no Player-specific Unit constructor');
assert.doesNotMatch(game,/function registerNPCUnit\b/,'There must be no NPC-specific Unit constructor');
assert.match(game,/standard:UNIVERSAL_UNIT_STANDARD/,'Public Unit API must expose the canonical contract');
assert.match(game,/contractViolations/,'Architecture audit must reject Units outside the contract');

console.log('universal-unit-runtime-smoke: ok');
