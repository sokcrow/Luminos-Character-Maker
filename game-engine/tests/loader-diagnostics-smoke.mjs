import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('game-engine/lab/index.html', 'utf8');
const diagnostics = fs.readFileSync('game-engine/lab/loader-diagnostics.js', 'utf8');
const forest = fs.readFileSync('game-engine/lab/game/forest-0.3.3.1.html', 'utf8');

assert.match(index, /<script src="\.\/loader-diagnostics\.js"><\/script>/, 'Lab must load loader diagnostics');
assert.match(diagnostics, /win\.setLoadProgress\s*=\s*\(pct, stage, hint\)/, 'Diagnostics must wrap progress updates');
assert.match(diagnostics, /win\.__paperLoadLastProgressAt\s*=\s*state\.lastSignalAt/, 'Stage or hint changes must keep the loader watchdog alive');
assert.match(diagnostics, /Error de carga/, 'Failures must be visible in the loader UI');
assert.match(diagnostics, /unhandledrejection/, 'Unhandled promise rejections must be captured while loading');
assert.match(diagnostics, /win\.addEventListener\('error'/, 'JavaScript errors must be captured while loading');
assert.match(diagnostics, /Fase:/, 'Failure details must identify the active phase');
assert.match(forest, /Cargando vecinos/, 'Neighbor-loading stage must remain identifiable');
assert.match(forest, /Personaje \$\{i\+1\} de \$\{entries\.length\}/, 'Neighbor-loading detail must identify the character being loaded');

console.log('Loader diagnostics smoke: OK');
