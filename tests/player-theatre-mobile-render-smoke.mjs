import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../hoja_personaje.html', import.meta.url), 'utf8');
const mobileCss = fs.readFileSync(new URL('../css/player-mobile-runtime.css', import.meta.url), 'utf8');
const checkCss = fs.readFileSync(new URL('../css/theatre-check-coordinator.css', import.meta.url), 'utf8');
const engine = fs.readFileSync(new URL('../js/theatre-engine.js', import.meta.url), 'utf8');

for (const id of ['dialogue-title','dialogue-name','dialogue-text','theatre-stage']) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Player Theatre DOM must expose #${id}`);
  assert.match(
    engine,
    new RegExp(`getElementById\\(["']${id}["']\\)`),
    `Canonical Theatre Engine must bind the real #${id} node`
  );
}

assert.match(
  html,
  /<script src=["']js\/theatre-engine\.js[^"']*["']><\/script>/,
  'Player sheet must load the canonical Theatre Engine'
);

assert.match(
  html,
  /id=["']btn-toggle-theatre-self-actor["'][\s\S]{0,900}Assets\/Images\/Buttons\/Player\.svg/,
  'Player Theatre self visibility must live in the hamburger menu'
);
assert.match(
  engine,
  /getElementById\(["']btn-toggle-theatre-self-actor["']\)/,
  'Theatre Engine must bind the hamburger self-visibility toggle'
);
assert.equal(
  engine.includes("position:absolute;right:16px;top:16px"),
  false,
  'Legacy floating self-visibility checkbox must not return'
);
assert.match(
  checkCss,
  /--theatre-player-menu-safe-top:[^;]+;/,
  'Player checks must reserve a safe vertical zone below the hamburger rail'
);
assert.match(
  checkCss,
  /body\.player-instance-theatre \.theatre-check-front-layer \.theatre-check-command-prompt[\s\S]{0,500}top:var\(--theatre-player-menu-safe-top\)!important;/,
  'Player check prompts must stay below the hamburger rail'
);

assert.match(engine, /scene:\s*["']campaña\/estado_mundo\/escena_actual["']/);
assert.match(engine, /dialogue:\s*["']campaña\/estado_mundo\/dialogo_activo["']/);

for (const legacyPath of [
  'campaña/teatro/estado_actual',
  'campaña/teatro/max_sprites'
]) {
  assert.equal(
    html.includes(`db.ref("${legacyPath}")`) || html.includes(`db.ref('${legacyPath}')`),
    false,
    `Player sheet must not install legacy Theatre renderer listener ${legacyPath}`
  );
}

assert.match(
  mobileCss,
  /player-instance-theatre:not\(\.player-cellphone-surface-open\) #theatre-view-player[\s\S]*z-index:\s*4000\s*!important/,
  'Mobile Theatre must stack above the dormant cellphone wrapper'
);

assert.match(
  mobileCss,
  /player-instance-theatre:not\(\.player-cellphone-surface-open\) \.hud-sidebar-right[\s\S]*z-index:\s*19500\s*!important/,
  'Mobile Theatre HUD must stack above the Theatre surface'
);

console.log('player theatre mobile render contract: ok');

assert.match(
  mobileCss,
  /player-instance-theatre:not\(\.player-cellphone-surface-open\) \.hud-modal[\s\S]*z-index:\s*20000\s*!important/,
  'Mobile Theatre menus must stack above the Theatre surface'
);

assert.match(
  mobileCss,
  /player-instance-theatre:not\(\.player-cellphone-surface-open\) \.inventory-modal[\s\S]*z-index:\s*20000\s*!important/,
  'Mobile Theatre inventory must stack above the Theatre surface'
);
