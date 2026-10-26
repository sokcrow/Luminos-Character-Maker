// Compare identical browser workloads on current main and PR head.
// Absolute frame/cue gates live in combat-loot-performance.spec.mjs; this gate
// also prevents a "green" PR that meaningfully regresses round/loot latency.
// The previous requirement of 8–15% improvements on EVERY unrelated PR was
// written for the dedicated performance cutover and is obsolete as a generic
// pull_request gate. Allow 15% noise under 4× CPU/WAN emulation.
import fs from 'node:fs';
import path from 'node:path';

const [baselineRoot, candidateRoot] = process.argv.slice(2);
if (!baselineRoot || !candidateRoot) {
  console.error('Usage: node tests/combat-loot-performance-compare.mjs <baseline-dir> <candidate-dir>');
  process.exit(2);
}
function findFile(root, name) {
  if (!fs.existsSync(root)) throw new Error('Missing benchmark directory: ' + root);
  const found = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === name) found.push(full);
    }
  };
  walk(root);
  if (found.length !== 1) throw new Error('Expected one ' + name + ' in ' + root + ', got ' + found.length);
  return JSON.parse(fs.readFileSync(found[0], 'utf8'));
}
const checks = [
  { file: 'combat-1coins-1enemies.json', metric: 'wallMs', ratio: 1.15, name: '1v1 round, 1 Coin' },
  { file: 'combat-3coins-1enemies.json', metric: 'wallMs', ratio: 1.15, name: '1v1 round, 3 Coins' },
  { file: 'combat-1coins-8enemies.json', metric: 'wallMs', ratio: 1.15, name: '1v8 round' },
  { file: 'loot.json', metric: 'finalizeMs', ratio: 1.15, name: 'Eight-corpse loot finalization' },
  { file: 'loot.json', metric: 'lootMs', ratio: 1.15, name: 'Loot click to confirmed inventory' },
  { file: 'loot-dependencies.json', metric: 'dependencyMs', ratio: 1.15, name: 'Cold loot dependency load' },
];
const cache = new Map();
const get = (root, file) => {
  const key = root + '/' + file;
  if (!cache.has(key)) cache.set(key, findFile(root, file));
  return cache.get(key);
};
let failed = false;
const rows = [];
for (const check of checks) {
  const before = Number(get(baselineRoot, check.file)[check.metric]);
  const after = Number(get(candidateRoot, check.file)[check.metric]);
  if (!Number.isFinite(before) || before <= 0 || !Number.isFinite(after) || after <= 0) {
    throw new Error('Invalid benchmark for ' + check.name + ': ' + before + ' / ' + after);
  }
  const changePercent = 100 * (after / before - 1);
  const pass = after <= before * check.ratio;
  failed ||= !pass;
  rows.push({ ...check, before, after, changePercent, pass });
  console.log((pass ? 'PASS ' : 'FAIL ') + check.name + ': baseline=' + before.toFixed(0)
    + 'ms, PR=' + after.toFixed(0) + 'ms, change=' + changePercent.toFixed(1)
    + '% (maximum allowed regression ' + ((check.ratio - 1) * 100).toFixed(0) + '%)');
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const table = ['### Browser wall-time regression gate', '',
    '| Scenario | Current main | PR | Change | Gate |',
    '| --- | ---: | ---: | ---: | --- |',
    ...rows.map(r => '| ' + r.name + ' | ' + r.before.toFixed(0) + ' ms | '
      + r.after.toFixed(0) + ' ms | ' + r.changePercent.toFixed(1)
      + '% | ' + (r.pass ? 'PASS' : 'FAIL') + ' |'), ''];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, table.join('\n'));
}
if (failed) process.exitCode = 1;
