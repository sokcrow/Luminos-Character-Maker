import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../hoja_personaje.html', import.meta.url), 'utf8');
const mobileCss = fs.readFileSync(new URL('../css/player-mobile-runtime.css', import.meta.url), 'utf8');

for (const id of ['dialogue-title','dialogue-name','dialogue-text','theatre-stage']) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Player Theatre DOM must expose #${id}`);
  assert.match(
    html,
    new RegExp(`getElementById\\(["']${id}["']\\)`),
    `Player Theatre runtime must bind the real #${id} node`
  );
}

for (const stale of [
  'player-theatre-plate-title',
  'player-theatre-plate-name',
  'player-theatre-dialogue-text',
  'player-theatre-stage'
]) {
  assert.equal(
    html.includes(`getElementById("${stale}")`) || html.includes(`getElementById('${stale}')`),
    false,
    `Player Theatre runtime must not bind removed legacy id #${stale}`
  );
}

assert.match(
  html,
  /getElementById\(["']theatre-view-player["']\)\s*\|\|\s*document\.getElementById\(["']modulo-teatro["']\)/,
  'Player Theatre background listener must target the Player theatre view'
);

assert.match(
  mobileCss,
  /player-instance-theatre:not\(\.player-cellphone-surface-open\) #theatre-view-player[\s\S]*z-index:\s*12000\s*!important/,
  'Mobile Theatre must stack above the dormant cellphone wrapper'
);

assert.match(
  mobileCss,
  /player-instance-theatre:not\(\.player-cellphone-surface-open\) \.hud-sidebar-right[\s\S]*z-index:\s*13000\s*!important/,
  'Mobile Theatre HUD must stack above the Theatre surface'
);

console.log('player theatre mobile render contract: ok');
