import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const tests = [
  "tests/combat-v073-live-cutover-smoke.mjs",
  "tests/combat-v073-dm-editor-smoke.mjs",
  "tests/dm-combat-live-viewer-smoke.mjs",
  "tests/dm-combat-unit-library-real-ui-smoke.mjs",
  "tests/combat-v073-live-sync-hotfix-smoke.mjs",
  "tests/unit-combat-instantiator-smoke.mjs",
  "tests/universal-library-authority-smoke.mjs",
  "tests/player-vitals-realtime-bridge-smoke.mjs",
  "tests/combat-v073-economy-menu-smoke.mjs",
  "tests/combat-mobile-boot-smoke.mjs",
  "tests/dm-player-loadout-manager-smoke.mjs",
  "tests/player-skills-hud-smoke.mjs",
  "tests/combat-v074-player-skill-planner-smoke.mjs",
  "tests/combat-v074-player-spell-planner-smoke.mjs",
  "tests/combat-v073-player-menu-inventory-click-smoke.mjs",
  "tests/combat-player-active-inventory-authority-smoke.mjs",
  "tests/item-runtime-canonical-combat-use-smoke.mjs",
  "tests/player-vitals-universal-sync-smoke.mjs",
  "tests/combat-v073-speed-persistence-smoke.mjs",
  "tests/combat-v073-dm-observer-smoke.mjs",
  "tests/combat-v073-limbus-facing-runtime-smoke.mjs",
  "tests/combat-v073-player-renderer-performance-smoke.mjs",
  "tests/combat-backup-lifecycle-smoke.mjs",
  "tests/unit-rank-command-smoke.mjs",
  "tests/enemy-action-slot-allocator-smoke.mjs",
  "tests/wolf-unit-library-smoke.mjs",
  "tests/combat-v073-theatre-isolation-smoke.mjs",
  "tests/combat-v074-dm-console-smoke.mjs",
  "tests/combat-live-build-smoke.mjs",
  "tests/combat-live-subscription-recovery.mjs",
  "tests/combat-v074-firebase-contract-smoke.mjs",
  "tests/combat-v074-ownership-smoke.mjs",
  "tests/combat-v074-ownership-resolution-smoke.mjs",
  "tests/combat-action-queue-smoke.mjs"
];
let failures = 0;
for (const file of tests) {
  const result = spawnSync(process.execPath, [file], { cwd: root, stdio: 'inherit', timeout: 45000 });
  if (result.status !== 0) { failures++; console.error('FAILED:', file, result.error?.message || ''); }
}
console.log('Combat Phase 0:', tests.length - failures, '/', tests.length, 'checks passed');
if (failures) process.exitCode = 1;
