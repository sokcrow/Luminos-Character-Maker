import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../lab/game/forest-0.3.3.1.html',import.meta.url),'utf8');
const resolver=html.match(/const SAFE_SPAWN_ROUTE_LIMIT=24;[\s\S]*?const SpawnSafetySystem=Object\.freeze\(\{/u)?.[0]||'';
assert.ok(resolver,'bounded local spawn resolver must exist');
assert.match(resolver,/SAFE_SPAWN_RING_RADII=Object\.freeze\(\[\.75,1\.5,2\.5,4,6,8\]\)/u);
assert.match(resolver,/SAFE_SPAWN_RING_SAMPLES=12/u);
assert.doesNotMatch(resolver,/for\(let tz=/u,'spawn resolver must never full-scan the map grid');
assert.match(html,/if\(isOverworldSector\(mapId\)\)spawnIntent\.y=0;/u);
assert.match(html,/const terrainY=formalGroundYAtWorld\(s\.x,s\.z,currentWorldLayer\);/u);
assert.match(html,/const validity=new Map\(\);/u);
console.log('spawn-loading-smoke: ok');
