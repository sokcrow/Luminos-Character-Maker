import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCombatLive, loaderParts } from '../scripts/build-combat-live.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.equal(buildCombatLive({ check: true }).action, 'verified');
const temp = mkdtempSync(path.join(root, '.combat-build-'));
try {
  const files = ['Battle-viewer.html', 'combat/source/combat-v073-live.html', 'combat/combat-v073-live.manifest.json', ...loaderParts()];
  for (const file of files) {
    mkdirSync(path.dirname(path.join(temp, file)), { recursive: true });
    cpSync(path.join(root, file), path.join(temp, file));
  }
  const original = new Map(files.map((file) => [file, readFileSync(path.join(temp, file))]));
  assert.equal(buildCombatLive({ root: temp }).action, 'unchanged');
  for (const file of files) assert.deepEqual(readFileSync(path.join(temp, file)), original.get(file), `no-op build changed ${file}`);
  const source = path.join(temp, 'combat/source/combat-v073-live.html');
  writeFileSync(source, Buffer.concat([readFileSync(source), Buffer.from('\n<!-- build roundtrip fixture -->\n')]));
  assert.throws(() => buildCombatLive({ root: temp, check: true }), /source and packed runtime differ/);
  assert.equal(buildCombatLive({ root: temp }).action, 'built');
  assert.equal(buildCombatLive({ root: temp, check: true }).action, 'verified');
  const rebuilt = loaderParts(temp).map((file) => readFileSync(path.join(temp, file)));
  assert.equal(buildCombatLive({ root: temp }).action, 'unchanged');
  loaderParts(temp).forEach((file, index) => assert.deepEqual(readFileSync(path.join(temp, file)), rebuilt[index]));
  const manifestPath = path.join(temp, 'combat/combat-v073-live.manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath));
  manifest.sourceSha256 = 'invalid';
  writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(() => buildCombatLive({ root: temp, check: true }), /integrity differs/);
  assert.throws(() => buildCombatLive({ root: temp, extract: true }), /will not overwrite/);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
console.log('Combat editable source and packed build roundtrip: ok');
