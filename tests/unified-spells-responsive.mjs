/* Production modules with deterministic Firebase responses; no live account writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch { playwright = createRequire(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/` )('playwright'); }
const read = file => fs.readFileSync(path.resolve(file), 'utf8');
const sizes = [[360,800],[390,844],[844,390],[768,1024],[1280,720],[1920,1080]];
const browser = await playwright.chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const results = [];
try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    const html = read('hoja_personaje.html');
    const start = html.indexOf('<div id="modal-escritura-teatro"');
    const end = html.indexOf('<script src="js/utils.js', start);
    assert.ok(start > 0 && end > start);
    await page.setContent(`<html><head><style>body{margin:0;background:#080b08;color:#eee;font-family:sans-serif}main{box-sizing:border-box;max-width:1200px;margin:auto;padding:12px}button,select,input{font-family:inherit}</style></head><body><main><div id="dm-player-loadout-host"></div></main>${html.slice(start, end)}</body></html>`);
    await page.addStyleTag({ content: read('css/dm-player-loadout-manager.css') });
    await page.addStyleTag({ content: read('css/theatre-spell-loadout.css') });
    await page.evaluate(() => {
      const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
      const player = { uid: 'uid-a', actorId: 'actor-a', characterName: 'Angelo V.', classId: 'bard', level: 10,
        characterBuild: { classes: [{ classId: 'bard', levels: 10 }] }, spellLoadout: { schemaVersion: 1, spellIds: ['mage_hand', 'distort_value'] } };
      const data = { campaña: { jugadores: { alice: player }, base_datos_unidades: { unit_a: { isPlayer: true } },
        combate: { combatants: { 'player:alice': { isPlayer: true, canonicalPlayerKey: 'alice', canonicalOwnerUid: 'uid-a' } } },
        estado_mundo: { escena_actual: {} }, teatro: {} } };
      const get = path => path.split('/').filter(Boolean).reduce((node, key) => node?.[key], data) ?? null;
      const set = (path, value) => { const parts = path.split('/').filter(Boolean); let node = data;
        for (const part of parts.slice(0,-1)) node = node[part] ??= {};
        if (value === null) delete node[parts.at(-1)]; else node[parts.at(-1)] = copy(value); };
      const db = { ref(path = '') { return { on(event, fn) { fn({ val: () => copy(get(path)) }); }, off() {}, push() { return { key: 'cast-visual' }; },
        async once() { return { val: () => copy(get(path)) }; },
        async update(patch) { for (const [key,value] of Object.entries(patch)) set([path,key].filter(Boolean).join('/'),value); },
        async transaction(fn) { const next = fn(copy(get(path))); if (!next) return { committed: false }; set(path,next); return { committed:true,snapshot:{val:()=>copy(next)} }; }
      }; } };
      window.__spellTest = { data, db, player, get };
      window.firebase = { apps: [{}], database: Object.assign(() => db, { ServerValue: { TIMESTAMP: 1234 } }), auth: () => ({ currentUser: { uid: 'uid-a' } }) };
      window.CombatSkillSchema = {};
      window.LuminousPlayerSignatureSkillCatalog = {};
      window.LuminousCombatSkillLoadout074 = { resolvePlayerUnit: () => ({ ok:true, unitId:'unit_a' }) };
      window.datosJugador = player;
      window.currentPlayerId = 'alice';
      window.getAssignedTheatreActor = () => ({ actorId:'actor-a' });
      window.LuminousTheatreState = { getPaths: () => ({ scene:'campaña/estado_mundo/escena_actual',queue:'campaña/teatro/cola',roomId:'default' }), normalizeAssignedActorIds: id => [id] };
    });
    for (const file of ['spellcasting-runtime','spellcasting-basic-rules-runtime','spell-catalog-core','role-spell-catalog-core','spell-loadout-core','content-registry','content-registry-bootstrap','combat-spell-loadout-074','dm-player-loadout-core','dm-player-loadout-manager','theatre-spell-loadout']) {
      await page.addScriptTag({ content: read(`js/${file}.js`) });
    }
    await page.waitForFunction(() => window.LuminousDmPlayerLoadoutManager.state.ready);
    await page.evaluate(() => {
      const manager = window.LuminousDmPlayerLoadoutManager;
      Object.assign(manager.state, { db: window.__spellTest.db, playerId:'alice',player:window.__spellTest.player,
        units:{unit_a:{isPlayer:true}}, selectedSpellIds:new Set(['mage_hand','distort_value']) });
      manager.render();
      window.dispatchEvent(new CustomEvent('luminous:player-data',{detail:{playerId:'alice',data:window.__spellTest.player}}));
    });
    const checkNoOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}x${height}: horizontal overflow`);
    await checkNoOverflow();
    assert.equal(await page.locator('[data-loadout-spell="mage_hand"]').count(), 1, 'dual-context spell has one checkbox');
    await page.locator('#dm-loadout-spell-context').selectOption('theater');
    assert.equal(await page.locator('[data-loadout-spell="fire_bolt"]').count(), 0);
    await page.locator('[data-loadout-spell="mage_hand"]').uncheck();
    await page.locator('#dm-loadout-spell-context').selectOption('combat');
    assert.equal(await page.locator('[data-loadout-spell="mage_hand"]').isChecked(), false, 'context filters share the same draft');
    await page.locator('#dm-loadout-spell-context').selectOption('theater');
    await page.locator('#dm-loadout-save-spells').click();
    await page.waitForFunction(() => document.getElementById('dm-loadout-spell-feedback').textContent.includes('ACTUALIZADOS'));
    assert.deepEqual(await page.evaluate(() => __spellTest.get('campaña/combate/combatants/player:alice/spellLoadout/spellIds')), ['distort_value']);
    await page.evaluate(() => {
      const player = __spellTest.get('campaña/jugadores/alice'); window.datosJugador = player;
      window.dispatchEvent(new CustomEvent('luminous:player-data',{detail:{playerId:'alice',data:player}}));
      document.getElementById('modal-escritura-teatro').style.display = 'flex';
    });
    assert.equal(await page.locator('#theatre-assigned-spell option').count(), 1);
    await page.locator('#input-teatro-modal').fill('Hace parecer más valiosa la joya.');
    await page.locator('#theatre-cast-assigned-spell').click();
    await page.waitForFunction(() => document.getElementById('theatre-spell-feedback').textContent.includes('enviado'));
    assert.equal(await page.evaluate(() => __spellTest.get('campaña/teatro/cola/cast-visual').spellId), 'distort_value');
    await checkNoOverflow();
    if (process.env.UNIFIED_SPELL_SCREENSHOTS_DIR) {
      fs.mkdirSync(process.env.UNIFIED_SPELL_SCREENSHOTS_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.UNIFIED_SPELL_SCREENSHOTS_DIR, `theatre-${width}x${height}.png`) });
    }
    const touch = await page.locator('#theatre-cast-assigned-spell').boundingBox();
    assert.ok(touch.width >= 44 && touch.height >= 44);
    await page.locator('#btn-cerrar-escritura').evaluate(button => button.addEventListener('click', () => { document.getElementById('modal-escritura-teatro').style.display = 'none'; }));
    await page.locator('#btn-cerrar-escritura').click();
    assert.equal(await page.locator('#modal-escritura-teatro').isVisible(), false);
    await page.locator('#dm-loadout-spell-search').fill('ningun-hechizo');
    assert.equal(await page.locator('.dm-loadout-list-empty').count(), 1);
    await page.locator('#dm-loadout-spell-search').fill('');
    await page.locator('#dm-loadout-spell-context').focus();
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.activeElement !== document.body));
    // Empty canonical selection updates the same Player/Unit/Combatant and hides utility casting.
    await page.evaluate(async () => { const manager = LuminousDmPlayerLoadoutManager; manager.state.selectedSpellIds.clear(); await manager.saveSpells();
      datosJugador = __spellTest.get('campaña/jugadores/alice'); LuminousTheatreSpells.refresh(); });
    assert.equal(await page.locator('#theatre-assigned-spells').isVisible(), false);
    assert.deepEqual(errors, [], `${width}x${height}: browser errors`);
    results.push(`${width}x${height}: assignment, filters, save, Theatre cast, empty state, keyboard and layout OK`);
    await page.close();
  }
} finally { await browser.close(); }
console.log(results.join('\n'));
