(function (global) {
  'use strict';

  if (global.LuminousDmCombatTabManager) return;

  const ROOTS = Object.freeze({
    players: 'campaña/jugadores',
    actors: 'campaña/actores',
    units: 'campaña/base_datos_unidades',
    skills: 'campaña/base_datos_skills',
    combatants: 'campaña/combate/combatants',
    dmUid: 'campaña/config/dm_uid'
  });
  const FALLBACK_DM_UID = 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
  const CATALOG_SCRIPTS = [
    'js/combat-skill-schema.js',
    'js/skill-catalog-kobold-tier1.js',
    'js/skill-catalog-wolf.js',
    'js/unit-rank-runtime.js',
    'js/universal-action-economy.js',
    'js/universal-ranged-ammo-runtime.js',
    'js/goblin-unit-runtime.js',
    'js/wolf-unit-runtime.js',
    'js/unit-catalog-kobold-tier1.js',
    'js/unit-catalog-goblin.js',
    'js/unit-catalog-wolf.js'
  ];

  const state = {
    db: null,
    mounted: false,
    started: false,
    players: {},
    actors: {},
    units: {},
    combatants: {},
    selectedType: 'unit',
    selectedId: '',
    spriteUrl: '',
    x: 0,
    y: 0,
    scale: 1,
    unsubscribers: []
  };

  const clean = (value) => String(value ?? '').trim();
  const escapeHtml = (value) => clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  function nameFor(record = {}, fallback = 'Entry') {
    return clean(record.characterName || record.character_name || record.nombre || record.name || record.displayName || fallback) || fallback;
  }

  function spriteFor(record = {}) {
    return clean(
      record.combatSprite || record.sprite_combate || record.combat_sprite || record.tokenImage ||
      record.sprite || record.idle_sprite || record.portrait || record.icono || record.img ||
      record.image || record.visual?.spriteUrl || record.combatVisual?.spriteUrl
    );
  }

  function host() {
    return global.document?.getElementById('tab-combate') || null;
  }

  function setMessage(text, isError = false) {
    const node = global.document?.getElementById('dm-combat-tab-manager-message');
    if (!node) return;
    node.textContent = text;
    node.style.color = isError ? '#ff6b6b' : '#8fd39a';
  }

  function collectionFor(type) {
    if (type === 'player') return state.players;
    if (type === 'actor') return state.actors;
    return state.units;
  }

  function canonicalPath(type, id) {
    if (type === 'player') return `${ROOTS.players}/${id}`;
    if (type === 'actor') return `${ROOTS.actors}/${id}`;
    return `${ROOTS.units}/${id}`;
  }

  function selectedRecord() {
    return collectionFor(state.selectedType)?.[state.selectedId] || null;
  }

  function targetMatches(combatant = {}, type, id) {
    if (type === 'player') {
      return clean(combatant.canonicalPlayerKey || combatant.ownerPlayerId || combatant.playerId || combatant.characterLink?.playerId) === id;
    }
    if (type === 'actor') {
      return clean(combatant.actorId || combatant.linkedActorId || combatant.actorRef?.id || combatant.characterLink?.actorId) === id;
    }
    return clean(combatant.libraryUnitId || combatant.unitRef?.id || combatant.unitId) === id;
  }

  function syncControls() {
    const doc = global.document;
    if (!doc) return;
    const url = doc.getElementById('dm-combat-tab-sprite-url');
    const x = doc.getElementById('dm-combat-tab-sprite-x');
    const y = doc.getElementById('dm-combat-tab-sprite-y');
    const scale = doc.getElementById('dm-combat-tab-sprite-scale');
    if (url) url.value = state.spriteUrl;
    if (x) x.value = String(state.x);
    if (y) y.value = String(state.y);
    if (scale) scale.value = String(state.scale);
    const xValue = doc.getElementById('dm-combat-tab-x-value');
    const yValue = doc.getElementById('dm-combat-tab-y-value');
    const scaleValue = doc.getElementById('dm-combat-tab-scale-value');
    if (xValue) xValue.textContent = String(Math.round(state.x));
    if (yValue) yValue.textContent = String(Math.round(state.y));
    if (scaleValue) scaleValue.textContent = state.scale.toFixed(2);
  }

  function renderPreview() {
    const image = global.document?.getElementById('dm-combat-tab-sprite-preview');
    if (!image) return;
    image.src = state.spriteUrl || '';
    image.style.display = state.spriteUrl ? 'block' : 'none';
    image.style.transform = `translate(calc(-50% + ${state.x}px), calc(-50% + ${state.y}px)) scale(${state.scale})`;
  }

  function renderSelector() {
    const selector = global.document?.getElementById('dm-combat-tab-entity');
    if (!selector) return;
    const collection = collectionFor(state.selectedType);
    const previous = state.selectedId;
    const rows = Object.entries(collection || {}).sort((a, b) => nameFor(a[1], a[0]).localeCompare(nameFor(b[1], b[0])));
    selector.innerHTML = '<option value="">— Seleccionar —</option>' + rows.map(([id, record]) =>
      `<option value="${escapeHtml(id)}">${escapeHtml(nameFor(record, id))}</option>`
    ).join('');
    if (collection?.[previous]) selector.value = previous;
    else state.selectedId = '';

    const count = global.document?.getElementById('dm-combat-tab-unit-count');
    if (count) count.textContent = `${Object.keys(state.units || {}).length} Units en Firebase`;
  }

  function loadSelected() {
    const source = selectedRecord() || {};
    state.spriteUrl = spriteFor(source);
    state.x = Number(source.spriteX ?? source.combatSpriteX ?? source.combatVisual?.x ?? 0) || 0;
    state.y = Number(source.spriteY ?? source.combatSpriteY ?? source.combatVisual?.y ?? 0) || 0;
    state.scale = Number(source.scale ?? source.visualScale ?? source.combatScale ?? source.combatVisual?.scale ?? 1) || 1;
    syncControls();
    renderPreview();
  }

  function bindDrag(stage) {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    stage.addEventListener('pointerdown', (event) => {
      if (!state.spriteUrl) return;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      stage.setPointerCapture?.(event.pointerId);
    });
    stage.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      state.x = Math.max(-400, Math.min(400, state.x + event.clientX - lastX));
      state.y = Math.max(-250, Math.min(250, state.y + event.clientY - lastY));
      lastX = event.clientX;
      lastY = event.clientY;
      syncControls();
      renderPreview();
    });
    const stop = () => { dragging = false; };
    stage.addEventListener('pointerup', stop);
    stage.addEventListener('pointercancel', stop);
  }

  async function currentUserIsDm() {
    const user = global.firebase?.auth?.().currentUser;
    if (!user || !state.db?.ref) return false;
    const snapshot = await state.db.ref(ROOTS.dmUid).once('value');
    const dmUid = clean(snapshot.val()) || FALLBACK_DM_UID;
    return user.uid === dmUid || user.uid === FALLBACK_DM_UID;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = global.document?.querySelector?.(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === '1' || existing.readyState === 'complete') return resolve(existing);
        existing.addEventListener('load', () => resolve(existing), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = global.document.createElement('script');
      script.src = src;
      script.async = false;
      script.addEventListener('load', () => {
        script.dataset.loaded = '1';
        resolve(script);
      }, { once: true });
      script.addEventListener('error', reject, { once: true });
      global.document.head.appendChild(script);
    });
  }

  async function ensureCatalogs() {
    for (const src of CATALOG_SCRIPTS) await loadScript(src);
    return Boolean(
      global.LuminousKoboldUnitCatalog &&
      global.LuminousGoblinUnitCatalog &&
      global.LuminousWolfUnitCatalog &&
      global.CombatSkillSchema
    );
  }

  function mergePayloads(...payloads) {
    const merged = {};
    for (const payload of payloads) {
      for (const [id, value] of Object.entries(payload || {})) {
        if (Object.prototype.hasOwnProperty.call(merged, id)) throw new Error(`DUPLICATE_LIBRARY_ID:${id}`);
        merged[id] = value;
      }
    }
    return merged;
  }

  async function syncUnitLibrary() {
    if (!(await currentUserIsDm())) throw new Error('DM_ONLY');
    setMessage('Sincronizando catálogos Kobold / Goblin / Wolf…');
    if (!(await ensureCatalogs())) throw new Error('CATALOGS_NOT_READY');

    const schema = global.CombatSkillSchema;
    const kobolds = global.LuminousKoboldUnitCatalog;
    const goblins = global.LuminousGoblinUnitCatalog;
    const wolves = global.LuminousWolfUnitCatalog;
    const units = mergePayloads(kobolds.firebasePayload(), goblins.firebasePayload(), wolves.firebasePayload());
    const skills = mergePayloads(
      kobolds.firebaseSkillPayload(schema),
      wolves.firebaseSkillPayload(schema)
    );
    const updates = {};
    for (const [id, value] of Object.entries(units)) updates[`${ROOTS.units}/${id}`] = value;
    for (const [id, value] of Object.entries(skills)) updates[`${ROOTS.skills}/${id}`] = value;
    await state.db.ref().update(updates);
    setMessage(`SYNC OK · ${Object.keys(units).length} Units · ${Object.keys(skills).length} Skills`);
    return { units: Object.keys(units).length, skills: Object.keys(skills).length };
  }

  async function saveSprite() {
    if (!(await currentUserIsDm())) throw new Error('DM_ONLY');
    if (!state.selectedId) throw new Error('SELECT_ENTRY');

    const payload = {
      combatSprite: state.spriteUrl || null,
      sprite_combate: state.spriteUrl || null,
      spriteX: state.x,
      spriteY: state.y,
      scale: state.scale,
      visualScale: state.scale,
      combatVisual: {
        spriteUrl: state.spriteUrl || null,
        x: state.x,
        y: state.y,
        scale: state.scale,
        updatedAt: global.firebase.database.ServerValue.TIMESTAMP
      }
    };

    const updates = {};
    for (const [key, value] of Object.entries(payload)) {
      updates[`${canonicalPath(state.selectedType, state.selectedId)}/${key}`] = value;
    }
    for (const [combatantId, combatant] of Object.entries(state.combatants || {})) {
      if (!targetMatches(combatant, state.selectedType, state.selectedId)) continue;
      updates[`${ROOTS.combatants}/${combatantId}/combatSprite`] = state.spriteUrl || null;
      updates[`${ROOTS.combatants}/${combatantId}/img`] = state.spriteUrl || null;
      updates[`${ROOTS.combatants}/${combatantId}/spriteX`] = state.x;
      updates[`${ROOTS.combatants}/${combatantId}/spriteY`] = state.y;
      updates[`${ROOTS.combatants}/${combatantId}/scale`] = state.scale;
      updates[`${ROOTS.combatants}/${combatantId}/visualScale`] = state.scale;
    }

    await state.db.ref().update(updates);
    setMessage('Combat Sprite guardado. Si estaba en FIELD, también se actualizó ahí.');
  }

  function subscribe(path, key) {
    const ref = state.db.ref(path);
    const handler = (snapshot) => {
      state[key] = snapshot.val() || {};
      renderSelector();
      if (state.selectedId) loadSelected();
    };
    ref.on('value', handler);
    state.unsubscribers.push(() => ref.off('value', handler));
  }

  function mount() {
    if (state.mounted) return true;
    const combatTab = host();
    if (!combatTab) return false;
    state.mounted = true;

    const section = global.document.createElement('section');
    section.id = 'dm-combat-tab-manager';
    section.className = 'panel-cyber';
    section.style.cssText = 'margin-top:20px;max-width:none;width:100%;box-sizing:border-box;';
    section.innerHTML = `
      <h3>Combat Library</h3>
      <div class="form-cyber-container" style="align-items:stretch;">
        <div class="form-cyber" style="max-width:none;flex:1 1 360px;">
          <h4>Unit Library</h4>
          <p style="color:#aaa;margin:0;line-height:1.5;">Sincroniza Kobolds, Goblins y Wolves canónicos directamente desde este menú de Combate.</p>
          <button id="dm-combat-tab-sync-units" class="btn-cyber" style="background:#111;color:#c49a00;border:1px solid #c49a00;">SYNC UNIT LIBRARY</button>
          <div id="dm-combat-tab-unit-count" style="color:#888;font-size:12px;">0 Units en Firebase</div>
        </div>

        <div class="form-cyber" style="max-width:none;flex:2 1 620px;">
          <h4>Combat Sprite Mockup</h4>
          <div style="display:grid;grid-template-columns:minmax(120px,.45fr) minmax(180px,1fr);gap:8px;">
            <select id="dm-combat-tab-type">
              <option value="player">PLAYER</option>
              <option value="actor">NPC ACTOR</option>
              <option value="unit" selected>ENEMY UNIT</option>
            </select>
            <select id="dm-combat-tab-entity"><option value="">— Seleccionar —</option></select>
          </div>
          <input id="dm-combat-tab-sprite-url" type="url" placeholder="Combat Sprite URL" />

          <div id="dm-combat-tab-stage" style="position:relative;height:340px;overflow:hidden;border:1px solid #58472f;background:radial-gradient(circle at 50% 80%,#29231d 0,#111217 42%,#050507 100%);touch-action:none;cursor:grab;">
            <div style="position:absolute;left:0;right:0;bottom:64px;border-top:1px solid rgba(196,154,0,.35);"></div>
            <div style="position:absolute;inset:auto 0 0;height:64px;background:linear-gradient(180deg,rgba(20,20,20,.15),rgba(0,0,0,.75));"></div>
            <div style="position:absolute;left:12px;top:10px;color:#81735e;font-size:11px;letter-spacing:1px;">MOCK BATTLEFIELD · ARRASTRA EL SPRITE</div>
            <div style="position:absolute;left:50%;bottom:59px;width:160px;border-top:1px dashed rgba(0,221,255,.28);transform:translateX(-50%);"></div>
            <img id="dm-combat-tab-sprite-preview" alt="Combat sprite preview" style="display:none;position:absolute;left:50%;top:58%;max-width:280px;max-height:280px;transform-origin:center;user-select:none;pointer-events:none;" />
          </div>

          <label>X <span id="dm-combat-tab-x-value">0</span><input id="dm-combat-tab-sprite-x" type="range" min="-400" max="400" step="1" value="0" style="width:100%;" /></label>
          <label>Y <span id="dm-combat-tab-y-value">0</span><input id="dm-combat-tab-sprite-y" type="range" min="-250" max="250" step="1" value="0" style="width:100%;" /></label>
          <label>SCALE <span id="dm-combat-tab-scale-value">1.00</span><input id="dm-combat-tab-sprite-scale" type="range" min="0.25" max="3" step="0.05" value="1" style="width:100%;" /></label>
          <div style="display:flex;gap:8px;">
            <button id="dm-combat-tab-reset" class="btn-cyber" type="button" style="background:#111;color:#aaa;border:1px solid #555;">RESET</button>
            <button id="dm-combat-tab-save" class="btn-cyber" type="button" style="flex:1;background:#15351b;color:#8fd39a;border:1px solid #4f9b5e;">SAVE COMBAT SPRITE</button>
          </div>
          <div id="dm-combat-tab-manager-message" style="min-height:18px;color:#8fd39a;font-size:12px;">Edita aquí el sprite antes de desplegarlo al combate.</div>
        </div>
      </div>`;

    const existingPanel = combatTab.querySelector('.panel-cyber');
    if (existingPanel) existingPanel.insertAdjacentElement('afterend', section);
    else combatTab.appendChild(section);

    const type = global.document.getElementById('dm-combat-tab-type');
    const entity = global.document.getElementById('dm-combat-tab-entity');
    const url = global.document.getElementById('dm-combat-tab-sprite-url');
    const x = global.document.getElementById('dm-combat-tab-sprite-x');
    const y = global.document.getElementById('dm-combat-tab-sprite-y');
    const scale = global.document.getElementById('dm-combat-tab-sprite-scale');
    const stage = global.document.getElementById('dm-combat-tab-stage');

    type.addEventListener('change', () => {
      state.selectedType = type.value;
      state.selectedId = '';
      renderSelector();
      loadSelected();
    });
    entity.addEventListener('change', () => {
      state.selectedId = entity.value;
      loadSelected();
    });
    url.addEventListener('input', () => {
      state.spriteUrl = clean(url.value);
      renderPreview();
    });
    x.addEventListener('input', () => {
      state.x = Number(x.value) || 0;
      syncControls();
      renderPreview();
    });
    y.addEventListener('input', () => {
      state.y = Number(y.value) || 0;
      syncControls();
      renderPreview();
    });
    scale.addEventListener('input', () => {
      state.scale = Number(scale.value) || 1;
      syncControls();
      renderPreview();
    });
    global.document.getElementById('dm-combat-tab-reset').addEventListener('click', () => {
      state.x = 0;
      state.y = 0;
      state.scale = 1;
      syncControls();
      renderPreview();
    });
    global.document.getElementById('dm-combat-tab-save').addEventListener('click', () => {
      saveSprite().catch((error) => setMessage(error?.message || String(error), true));
    });
    global.document.getElementById('dm-combat-tab-sync-units').addEventListener('click', () => {
      syncUnitLibrary().catch((error) => setMessage(`SYNC FAILED · ${error?.message || error}`, true));
    });
    bindDrag(stage);
    renderSelector();
    return true;
  }

  function start() {
    if (state.started) return true;
    if (!host()) return false;
    state.started = true;

    const boot = () => {
      try {
        if (!global.firebase?.database || !Array.isArray(global.firebase.apps) || !global.firebase.apps.length) return false;
        state.db = global.firebase.database();
        if (!state.db?.ref) return false;
        mount();
        subscribe(ROOTS.players, 'players');
        subscribe(ROOTS.actors, 'actors');
        subscribe(ROOTS.units, 'units');
        subscribe(ROOTS.combatants, 'combatants');
        return true;
      } catch (error) {
        console.error('[DM Combat Tab Manager] boot failed', error);
        return false;
      }
    };

    if (boot()) return true;
    let attempts = 0;
    const timer = global.setInterval(() => {
      attempts += 1;
      if (boot() || attempts >= 100) global.clearInterval(timer);
    }, 100);
    return true;
  }

  global.addEventListener('beforeunload', () => {
    state.unsubscribers.splice(0).forEach((unsubscribe) => {
      try { unsubscribe(); } catch (_) {}
    });
  }, { once: true });

  global.LuminousDmCombatTabManager = Object.freeze({
    ROOTS,
    state,
    start,
    mount,
    syncUnitLibrary,
    saveSprite
  });

  start();
})(window);
