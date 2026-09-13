(function (global) {
  'use strict';

  if (global.LuminousDmCombatTabManager) return;

  const ROOTS = Object.freeze({
    players: 'campaña/jugadores',
    actors: 'campaña/actores',
    legacyNpcs: 'campaña/base_datos_npcs',
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
    auth: null,
    user: null,
    mounted: false,
    started: false,
    bound: false,
    players: {},
    actors: {},
    legacyNpcs: {},
    units: {},
    combatants: {},
    selectedType: 'enemy',
    selectedKey: '',
    spriteUrl: '',
    x: 0,
    y: 0,
    scale: 1,
    unsubscribers: [],
    authUnsubscribe: null
  };

  const clean = (value) => String(value ?? '').trim();
  const normalize = (value) => clean(value).toLowerCase().replace(/[\s_-]+/g, ' ');
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

  function isEnemyRecord(record = {}) {
    if (record.hostile === true || record.enemy === true || record.enemigo === true) return true;
    const values = [
      record.tipo, record.type, record.category, record.actorCategory,
      record.alignment, record.alineamiento, record.faction, record.faccion
    ].map(normalize).filter(Boolean);
    return values.some((value) => ['enemy', 'enemigo', 'hostile', 'hostil'].includes(value));
  }

  function descriptor(kind, id, record, source) {
    let path = ROOTS.units;
    if (kind === 'player') path = ROOTS.players;
    else if (source === 'actor') path = ROOTS.actors;
    else if (source === 'legacyNpc') path = ROOTS.legacyNpcs;
    return {
      key: `${source}:${id}`,
      id,
      kind,
      source,
      path: `${path}/${id}`,
      record: record || {},
      name: nameFor(record || {}, id)
    };
  }

  function allDescriptors() {
    const players = Object.entries(state.players || {}).map(([id, row]) => descriptor('player', id, row, 'player'));
    const actors = Object.entries(state.actors || {}).map(([id, row]) => descriptor('actor', id, row, 'actor'));
    const legacyNpcs = Object.entries(state.legacyNpcs || {}).map(([id, row]) => descriptor('actor', id, row, 'legacyNpc'));
    const units = Object.entries(state.units || {}).map(([id, row]) => descriptor('unit', id, row, 'unit'));
    return { players, actors, legacyNpcs, units };
  }

  function descriptorsFor(type) {
    const all = allDescriptors();
    if (type === 'player') return all.players;
    if (type === 'actor') return [...all.actors, ...all.legacyNpcs];
    if (type === 'unit') return all.units;
    return [
      ...all.units,
      ...all.actors.filter((row) => isEnemyRecord(row.record)),
      ...all.legacyNpcs.filter((row) => isEnemyRecord(row.record))
    ];
  }

  function selectedDescriptor() {
    return descriptorsFor(state.selectedType).find((row) => row.key === state.selectedKey) || null;
  }

  function sourceLabel(row) {
    if (row.source === 'unit') return 'UNIT';
    if (row.source === 'legacyNpc') return 'NPC DB';
    if (row.source === 'actor') return 'ACTOR';
    return 'PLAYER';
  }

  function targetMatches(combatant = {}, row) {
    if (!row) return false;
    if (row.kind === 'player') {
      return clean(combatant.canonicalPlayerKey || combatant.ownerPlayerId || combatant.playerId || combatant.characterLink?.playerId) === row.id;
    }
    if (row.kind === 'actor') {
      return clean(combatant.actorId || combatant.linkedActorId || combatant.actorRef?.id || combatant.characterLink?.actorId) === row.id;
    }
    return clean(combatant.libraryUnitId || combatant.unitRef?.id || combatant.unitId) === row.id;
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

  function setPlaceholder(text) {
    const placeholder = global.document?.getElementById('dm-combat-tab-sprite-placeholder');
    if (!placeholder) return;
    placeholder.textContent = text;
    placeholder.style.display = 'grid';
  }

  function renderPreview() {
    const doc = global.document;
    const image = doc?.getElementById('dm-combat-tab-sprite-preview');
    const placeholder = doc?.getElementById('dm-combat-tab-sprite-placeholder');
    const name = doc?.getElementById('dm-combat-tab-preview-name');
    const source = doc?.getElementById('dm-combat-tab-preview-source');
    if (!image || !placeholder) return;

    const row = selectedDescriptor();
    if (name) name.textContent = row ? row.name : 'COMBATANT PREVIEW';
    if (source) source.textContent = row ? `${sourceLabel(row)} · ${row.path}` : 'Selecciona una entidad para editar su sprite';

    const transform = `translate(calc(-50% + ${state.x}px), ${state.y}px) scale(${state.scale})`;
    image.style.transform = transform;
    placeholder.style.transform = transform;

    if (!row) {
      image.removeAttribute('src');
      image.style.display = 'none';
      setPlaceholder('SELECCIONA\nENTIDAD');
      return;
    }
    if (!state.spriteUrl) {
      image.removeAttribute('src');
      image.style.display = 'none';
      setPlaceholder('SIN COMBAT\nSPRITE');
      return;
    }

    image.onload = () => {
      image.style.display = 'block';
      placeholder.style.display = 'none';
    };
    image.onerror = () => {
      image.style.display = 'none';
      setPlaceholder('SPRITE NO\nCARGA');
      setMessage('La URL del Combat Sprite no pudo cargarse.', true);
    };
    image.src = state.spriteUrl;
  }

  function renderSelector() {
    const doc = global.document;
    const selector = doc?.getElementById('dm-combat-tab-entity');
    if (!selector) return;
    const rows = descriptorsFor(state.selectedType)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    const previous = state.selectedKey;
    selector.innerHTML = '<option value="">— Seleccionar —</option>' + rows.map((row) =>
      `<option value="${escapeHtml(row.key)}">[${sourceLabel(row)}] ${escapeHtml(row.name)}</option>`
    ).join('');
    if (rows.some((row) => row.key === previous)) selector.value = previous;
    else state.selectedKey = '';

    const count = doc.getElementById('dm-combat-tab-unit-count');
    if (count) {
      count.textContent = `${Object.keys(state.units || {}).length} Units · ${Object.keys(state.legacyNpcs || {}).length} NPC DB · ${Object.keys(state.actors || {}).length} Actors`;
    }
  }

  function loadSelected() {
    const row = selectedDescriptor();
    const source = row?.record || {};
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
      if (!selectedDescriptor()) return;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      stage.style.cursor = 'grabbing';
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
    const stop = () => {
      dragging = false;
      stage.style.cursor = 'grab';
    };
    stage.addEventListener('pointerup', stop);
    stage.addEventListener('pointercancel', stop);
  }

  async function currentUserIsDm() {
    const user = state.user || global.firebase?.auth?.().currentUser;
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
    const skills = mergePayloads(kobolds.firebaseSkillPayload(schema), wolves.firebaseSkillPayload(schema));
    const updates = {};
    for (const [id, value] of Object.entries(units)) updates[`${ROOTS.units}/${id}`] = value;
    for (const [id, value] of Object.entries(skills)) updates[`${ROOTS.skills}/${id}`] = value;
    await state.db.ref().update(updates);
    setMessage(`SYNC OK · ${Object.keys(units).length} Units · ${Object.keys(skills).length} Skills`);
    return { units: Object.keys(units).length, skills: Object.keys(skills).length };
  }

  async function saveSprite() {
    if (!(await currentUserIsDm())) throw new Error('DM_ONLY');
    const row = selectedDescriptor();
    if (!row) throw new Error('SELECT_ENTRY');

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
    for (const [key, value] of Object.entries(payload)) updates[`${row.path}/${key}`] = value;
    for (const [combatantId, combatant] of Object.entries(state.combatants || {})) {
      if (!targetMatches(combatant, row)) continue;
      updates[`${ROOTS.combatants}/${combatantId}/combatSprite`] = state.spriteUrl || null;
      updates[`${ROOTS.combatants}/${combatantId}/img`] = state.spriteUrl || null;
      updates[`${ROOTS.combatants}/${combatantId}/spriteX`] = state.x;
      updates[`${ROOTS.combatants}/${combatantId}/spriteY`] = state.y;
      updates[`${ROOTS.combatants}/${combatantId}/scale`] = state.scale;
      updates[`${ROOTS.combatants}/${combatantId}/visualScale`] = state.scale;
    }

    await state.db.ref().update(updates);
    setMessage(`Combat Sprite guardado en ${row.path}.`);
  }

  function unsubscribeData() {
    state.unsubscribers.splice(0).forEach((unsubscribe) => {
      try { unsubscribe(); } catch (_) {}
    });
    state.bound = false;
  }

  function subscribe(path, key) {
    const ref = state.db.ref(path);
    const handler = (snapshot) => {
      state[key] = snapshot.val() || {};
      renderSelector();
      if (state.selectedKey) loadSelected();
    };
    const onError = (error) => {
      console.error(`[DM Combat Tab Manager] ${path}`, error);
      setMessage(`No se pudo leer ${path}: ${error?.message || error}`, true);
    };
    ref.on('value', handler, onError);
    state.unsubscribers.push(() => ref.off('value', handler));
  }

  function bindData() {
    if (!state.user || !state.db?.ref) return false;
    unsubscribeData();
    state.bound = true;
    subscribe(ROOTS.players, 'players');
    subscribe(ROOTS.actors, 'actors');
    subscribe(ROOTS.legacyNpcs, 'legacyNpcs');
    subscribe(ROOTS.units, 'units');
    subscribe(ROOTS.combatants, 'combatants');
    setMessage('Firebase autenticado · cargando Combat Library…');
    return true;
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
          <h4>Fuentes de Combate</h4>
          <p style="color:#aaa;margin:0;line-height:1.5;">Lee Unit Library, Actors y la biblioteca histórica <code>base_datos_npcs</code>. No tienes que recrear enemigos viejos.</p>
          <button id="dm-combat-tab-sync-units" class="btn-cyber" style="background:#111;color:#c49a00;border:1px solid #c49a00;">SYNC UNIT LIBRARY</button>
          <div id="dm-combat-tab-unit-count" style="color:#888;font-size:12px;">Cargando Firebase…</div>
        </div>

        <div class="form-cyber" style="max-width:none;flex:2 1 620px;">
          <h4>Combat Sprite Mockup</h4>
          <div style="display:grid;grid-template-columns:minmax(150px,.55fr) minmax(220px,1fr);gap:8px;">
            <select id="dm-combat-tab-type">
              <option value="enemy" selected>ENEMIES · ALL SOURCES</option>
              <option value="unit">UNIT LIBRARY</option>
              <option value="actor">NPC / ACTOR</option>
              <option value="player">PLAYER</option>
            </select>
            <select id="dm-combat-tab-entity"><option value="">— Seleccionar —</option></select>
          </div>
          <input id="dm-combat-tab-sprite-url" type="url" placeholder="Combat Sprite URL" />

          <div id="dm-combat-tab-stage" style="position:relative;height:390px;overflow:hidden;border:1px solid #58472f;background:radial-gradient(ellipse at 50% 82%,#2a241c 0,#151419 37%,#09090d 70%,#040406 100%);touch-action:none;cursor:grab;">
            <div style="position:absolute;left:0;right:0;bottom:92px;border-top:1px solid rgba(196,154,0,.38);"></div>
            <div style="position:absolute;left:50%;bottom:70px;width:250px;height:68px;transform:translateX(-50%);border:1px solid rgba(196,154,0,.48);border-radius:50%;box-shadow:0 0 30px rgba(196,154,0,.1),inset 0 0 35px rgba(0,0,0,.8);"></div>
            <div style="position:absolute;left:12px;top:10px;color:#81735e;font-size:11px;letter-spacing:1px;">MOCK BATTLEFIELD · ARRASTRA EL SPRITE</div>

            <div style="position:absolute;left:50%;top:32px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;z-index:8;">
              <strong style="font-family:'Bebas Neue',sans-serif;font-size:48px;line-height:1;color:#ffe877;text-shadow:0 0 10px rgba(255,232,119,.45);">5</strong>
              <div style="display:flex;gap:5px;">
                <svg width="42" height="42" viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 88,23 98,64 72,96 28,96 2,64 12,23" fill="#19140f" stroke="#a37c35" stroke-width="8"/></svg>
                <svg width="42" height="42" viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 88,23 98,64 72,96 28,96 2,64 12,23" fill="#19140f" stroke="#a37c35" stroke-width="8"/></svg>
              </div>
            </div>

            <div id="dm-combat-tab-sprite-placeholder" style="position:absolute;left:50%;bottom:93px;width:150px;height:205px;transform-origin:bottom center;place-items:center;text-align:center;white-space:pre-line;color:#8c7a63;border:1px dashed #66543c;background:linear-gradient(180deg,rgba(70,55,40,.24),rgba(20,16,14,.5));clip-path:polygon(34% 0,66% 0,79% 19%,74% 39%,88% 69%,77% 100%,23% 100%,12% 69%,26% 39%,21% 19%);font:700 12px/1.35 monospace;z-index:3;">SELECCIONA\nENTIDAD</div>
            <img id="dm-combat-tab-sprite-preview" alt="Combat Sprite preview" style="display:none;position:absolute;left:50%;bottom:93px;max-height:255px;max-width:290px;transform-origin:bottom center;object-fit:contain;filter:drop-shadow(0 16px 8px rgba(0,0,0,.8));user-select:none;pointer-events:none;z-index:4;" />

            <div style="position:absolute;left:50%;bottom:24px;transform:translateX(-50%);width:min(430px,86%);z-index:9;">
              <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:4px;">
                <div><div id="dm-combat-tab-preview-name" style="color:#f0d19b;font-weight:800;letter-spacing:.08em;">COMBATANT PREVIEW</div><div id="dm-combat-tab-preview-source" style="max-width:330px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#766d62;font-size:9px;">Selecciona una entidad para editar su sprite</div></div>
                <div style="width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#4dc6cc,#248b99);border:3px solid #a37c35;font-weight:900;">0</div>
              </div>
              <div style="height:18px;border:2px solid #4f231d;background:#210908;box-shadow:inset 0 0 10px #000;position:relative;"><div style="position:absolute;inset:0;width:78%;background:linear-gradient(90deg,#a91e13,#ff4a22);"></div><span style="position:absolute;left:8px;top:0;color:white;font:700 12px/18px monospace;text-shadow:1px 1px #000;">120 / 120 HP</span></div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <label>X <span id="dm-combat-tab-x-value">0</span><input id="dm-combat-tab-sprite-x" type="range" min="-400" max="400" step="1" value="0" style="width:100%;" /></label>
            <label>Y <span id="dm-combat-tab-y-value">0</span><input id="dm-combat-tab-sprite-y" type="range" min="-250" max="250" step="1" value="0" style="width:100%;" /></label>
          </div>
          <label>SCALE <span id="dm-combat-tab-scale-value">1.00</span><input id="dm-combat-tab-sprite-scale" type="range" min="0.20" max="4" step="0.05" value="1" style="width:100%;" /></label>
          <div style="display:flex;gap:8px;">
            <button id="dm-combat-tab-reset" class="btn-cyber" type="button">RESET POSITION</button>
            <button id="dm-combat-tab-save" class="btn-cyber" type="button" style="flex:1;background:#18351b;color:#9fe8a8;border:1px solid #4f9f5a;">SAVE COMBAT SPRITE</button>
          </div>
          <div id="dm-combat-tab-manager-message" style="min-height:18px;color:#8fd39a;font-size:12px;">Esperando autenticación Firebase…</div>
        </div>
      </div>`;
    combatTab.appendChild(section);

    const doc = global.document;
    const type = doc.getElementById('dm-combat-tab-type');
    const entity = doc.getElementById('dm-combat-tab-entity');
    const url = doc.getElementById('dm-combat-tab-sprite-url');
    const x = doc.getElementById('dm-combat-tab-sprite-x');
    const y = doc.getElementById('dm-combat-tab-sprite-y');
    const scale = doc.getElementById('dm-combat-tab-sprite-scale');
    const stage = doc.getElementById('dm-combat-tab-stage');

    type.addEventListener('change', () => {
      state.selectedType = type.value;
      state.selectedKey = '';
      renderSelector();
      loadSelected();
    });
    entity.addEventListener('change', () => {
      state.selectedKey = entity.value;
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
    doc.getElementById('dm-combat-tab-reset').addEventListener('click', () => {
      state.x = 0;
      state.y = 0;
      state.scale = 1;
      syncControls();
      renderPreview();
    });
    doc.getElementById('dm-combat-tab-save').addEventListener('click', () => {
      saveSprite().catch((error) => setMessage(`SAVE FAILED · ${error?.message || error}`, true));
    });
    doc.getElementById('dm-combat-tab-sync-units').addEventListener('click', () => {
      syncUnitLibrary().catch((error) => setMessage(`SYNC FAILED · ${error?.message || error}`, true));
    });
    bindDrag(stage);
    renderSelector();
    renderPreview();
    return true;
  }

  function start() {
    if (state.started) return true;
    if (!host()) return false;
    state.started = true;
    mount();

    const boot = () => {
      if (!global.firebase?.database || !global.firebase?.auth || !Array.isArray(global.firebase.apps) || !global.firebase.apps.length) return false;
      state.db = global.firebase.database();
      state.auth = global.firebase.auth();
      if (!state.db?.ref || !state.auth?.onAuthStateChanged) return false;
      state.authUnsubscribe = state.auth.onAuthStateChanged((user) => {
        state.user = user || null;
        if (!user) {
          unsubscribeData();
          state.players = {};
          state.actors = {};
          state.legacyNpcs = {};
          state.units = {};
          state.combatants = {};
          renderSelector();
          loadSelected();
          setMessage('Firebase no autenticado. La biblioteca requiere sesión DM.', true);
          return;
        }
        bindData();
      }, (error) => setMessage(`AUTH FAILED · ${error?.message || error}`, true));
      return true;
    };

    if (boot()) return true;
    let attempts = 0;
    const timer = global.setInterval(() => {
      attempts += 1;
      if (boot() || attempts > 120) global.clearInterval(timer);
    }, 250);
    return true;
  }

  function stop() {
    unsubscribeData();
    if (typeof state.authUnsubscribe === 'function') {
      try { state.authUnsubscribe(); } catch (_) {}
    }
    state.authUnsubscribe = null;
    state.started = false;
  }

  global.addEventListener('beforeunload', stop, { once: true });
  global.LuminousDmCombatTabManager = Object.freeze({
    version: '1.1.0',
    ROOTS,
    state,
    start,
    stop,
    mount,
    bindData,
    descriptorsFor,
    selectedDescriptor,
    syncUnitLibrary,
    saveSprite,
    renderPreview
  });

  start();
})(window);
