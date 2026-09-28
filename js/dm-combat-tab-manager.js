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
  const LIBRARY_SYNC_SCRIPT = 'js/combat-unit-library-sync.js';

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
    skills: {},
    combatants: {},
    selectedType: 'enemy',
    selectedKey: '',
    spriteUrl: '',
    x: 0,
    y: 0,
    scale: 1,
    autoSeedAttempted: false,
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

  function explicitSprite(record = {}) {
    return clean(record.combatSprite || record.sprite_combate || record.combat_sprite || record.combatVisual?.spriteUrl);
  }

  function genericSprite(record = {}) {
    return clean(
      record.visual?.spriteUrl || record.tokenImage || record.sprite || record.idle_sprite ||
      record.img || record.image || record.portrait || record.icono
    );
  }

  function spriteFor(record = {}) {
    return explicitSprite(record) || genericSprite(record);
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

  function playerUid(player = {}) {
    return clean(player.uid || player.vinculado_a || player.vinculo_jugador || player.ownerUid || player.canonicalOwnerUid);
  }

  function playerActorId(player = {}) {
    return clean(player.linkedActorId || player.actorId || player.actor_id || player.actorRef?.id || player.characterBuild?.actorId);
  }

  function playerUnitId(player = {}) {
    return clean(player.unitId || player.unit_id || player.unitRef?.id || player.characterBuild?.unitId);
  }

  function isPlayerUnit(unit = {}) {
    const category = normalize(unit.actorCategory || unit.category || unit.type || unit.canonicalScope);
    return unit.isPlayer === true || category === 'player' || normalize(unit.canonicalScope) === 'player';
  }

  function linkedActor(playerId, player = {}) {
    const explicit = playerActorId(player);
    if (explicit && state.actors[explicit]) return { id: explicit, record: state.actors[explicit] };
    const uid = playerUid(player);
    const row = Object.entries(state.actors || {}).find(([, actor]) => {
      const actorPlayerId = clean(actor?.playerId || actor?.ownerPlayerId || actor?.linkedPlayerId);
      const actorUid = clean(actor?.uid || actor?.ownerUid || actor?.linkedPlayerUID || actor?.linkedPlayerUid);
      return actorPlayerId === playerId || (uid && actorUid === uid);
    });
    return row ? { id: row[0], record: row[1] || {} } : null;
  }

  function linkedPlayerUnit(playerId, player = {}) {
    const explicit = playerUnitId(player);
    const uid = playerUid(player);
    const actorId = playerActorId(player);
    const rows = Object.entries(state.units || {}).map(([id, unit]) => {
      if (!isPlayerUnit(unit || {})) return { id, unit, score: -1 };
      const unitId = clean(unit?.id || unit?.unitId || unit?.unit_id || id);
      let score = 0;
      if (explicit && (id === explicit || unitId === explicit)) score += 10000;
      if (clean(unit?.playerId || unit?.ownerPlayerId || unit?.linkedPlayerId) === playerId) score += 5000;
      if (uid && clean(unit?.linkedPlayerUID || unit?.linkedPlayerUid || unit?.ownerUid || unit?.canonicalOwnerUid) === uid) score += 4000;
      if (actorId && clean(unit?.actorId || unit?.linkedActorId || unit?.linked_actor_id) === actorId) score += 3000;
      return { id, unit: unit || {}, score };
    }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score);
    return rows[0] ? { id: rows[0].id, record: rows[0].unit } : null;
  }

  function playerSources(playerId, player = {}) {
    const actor = linkedActor(playerId, player);
    const unit = linkedPlayerUnit(playerId, player);
    return {
      player,
      actor,
      unit,
      records: [player, actor?.record || null, unit?.record || null].filter(Boolean),
      savePaths: [
        `${ROOTS.players}/${playerId}`,
        actor ? `${ROOTS.actors}/${actor.id}` : null,
        unit ? `${ROOTS.units}/${unit.id}` : null
      ].filter(Boolean)
    };
  }

  function playerSprite(sources) {
    for (const record of sources.records) {
      const sprite = explicitSprite(record);
      if (sprite) return sprite;
    }
    for (const record of [sources.unit?.record, sources.actor?.record, sources.player].filter(Boolean)) {
      const sprite = genericSprite(record);
      if (sprite) return sprite;
    }
    return '';
  }

  function visualRecordForPlayer(sources) {
    const sprite = playerSprite(sources);
    const ordered = [sources.player, sources.actor?.record, sources.unit?.record].filter(Boolean);
    if (sprite) {
      const matching = ordered.find((record) => explicitSprite(record) === sprite || genericSprite(record) === sprite);
      if (matching) return matching;
    }
    return ordered.find((record) => record.combatVisual || record.spriteX != null || record.spriteY != null || record.visualScale != null || record.scale != null) || sources.player || {};
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
    const row = {
      key: `${source}:${id}`,
      id,
      kind,
      source,
      path: `${path}/${id}`,
      savePaths: [`${path}/${id}`],
      record: record || {},
      name: nameFor(record || {}, id),
      sprite: spriteFor(record || {}),
      visualRecord: record || {}
    };
    if (kind === 'player') {
      const sources = playerSources(id, record || {});
      row.playerSources = sources;
      row.savePaths = sources.savePaths;
      row.sprite = playerSprite(sources);
      row.visualRecord = visualRecordForPlayer(sources);
      const linked = [];
      if (sources.actor) linked.push(`ACTOR:${sources.actor.id}`);
      if (sources.unit) linked.push(`UNIT:${sources.unit.id}`);
      row.linkedLabel = linked.join(' + ');
    }
    return row;
  }

  function allDescriptors() {
    const players = Object.entries(state.players || {}).map(([id, row]) => descriptor('player', id, row, 'player'));
    const actors = Object.entries(state.actors || {}).map(([id, row]) => descriptor('actor', id, row, 'actor'));
    const legacyNpcs = Object.entries(state.legacyNpcs || {}).map(([id, row]) => descriptor('actor', id, row, 'legacyNpc'));
    const units = Object.entries(state.units || {}).filter(([, row]) => !isPlayerUnit(row || {})).map(([id, row]) => descriptor('unit', id, row, 'unit'));
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
    if (source) source.textContent = row ? `${sourceLabel(row)}${row.linkedLabel ? ` + ${row.linkedLabel}` : ''} · ${row.savePaths.join(' | ')}` : 'Selecciona una entidad para editar su sprite';
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

  function catalogStatusText() {
    const units = Object.values(state.units || {}).filter((unit) => !isPlayerUnit(unit || {}));
    const pendingSprite = units.filter((unit) => unit?.metadata?.spritePending === true || !spriteFor(unit || {})).length;
    const pendingSkills = units.filter((unit) => unit?.metadata?.weaponSkillsPendingCanonicalCatalog === true).length;
    return `${units.length} Units · ${Object.keys(state.legacyNpcs || {}).length} NPC DB · ${Object.keys(state.actors || {}).length} Actors · ${Object.keys(state.skills || {}).length} Skills · ${pendingSprite} sprite pending · ${pendingSkills} weapon-skill pending`;
  }

  function renderSelector() {
    const doc = global.document;
    const selector = doc?.getElementById('dm-combat-tab-entity');
    if (!selector) return;
    const rows = descriptorsFor(state.selectedType).slice().sort((a, b) => a.name.localeCompare(b.name));
    const previous = state.selectedKey;
    selector.innerHTML = '<option value="">— Seleccionar —</option>' + rows.map((row) =>
      `<option value="${escapeHtml(row.key)}">[${sourceLabel(row)}] ${escapeHtml(row.name)}${row.sprite ? ' · SPRITE' : ' · SIN SPRITE'}</option>`
    ).join('');
    if (rows.some((row) => row.key === previous)) selector.value = previous;
    else state.selectedKey = '';
    const count = doc.getElementById('dm-combat-tab-unit-count');
    if (count) count.textContent = catalogStatusText();
  }

  function loadSelected() {
    const row = selectedDescriptor();
    const source = row?.visualRecord || row?.record || {};
    state.spriteUrl = row?.sprite || '';
    state.x = Number(source.spriteX ?? source.combatSpriteX ?? source.combatVisual?.x ?? source.visual?.spriteX ?? 0) || 0;
    state.y = Number(source.spriteY ?? source.combatSpriteY ?? source.combatVisual?.y ?? source.visual?.spriteY ?? 0) || 0;
    state.scale = Number(source.visualScale ?? source.combatScale ?? source.combatVisual?.scale ?? source.visual?.scale ?? source.scale ?? 1) || 1;
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
        existing.addEventListener('error', () => reject(new Error(`SCRIPT_LOAD_FAILED:${src}`)), { once: true });
        return;
      }
      const script = global.document.createElement('script');
      script.src = src;
      script.async = false;
      script.addEventListener('load', () => {
        script.dataset.loaded = '1';
        resolve(script);
      }, { once: true });
      script.addEventListener('error', () => reject(new Error(`SCRIPT_LOAD_FAILED:${src}`)), { once: true });
      global.document.head.appendChild(script);
    });
  }

  async function librarySync() {
    if (!global.LuminousCombatUnitLibrarySync) await loadScript(LIBRARY_SYNC_SCRIPT);
    const api = global.LuminousCombatUnitLibrarySync;
    if (!api) throw new Error('UNIT_LIBRARY_SYNC_UNAVAILABLE');
    return api;
  }

  async function autoSeedUnitLibrary() {
    if (state.autoSeedAttempted || !(await currentUserIsDm())) return false;
    state.autoSeedAttempted = true;
    try {
      setMessage('Verificando Unit Library canónica…');
      const api = await librarySync();
      const result = await api.ensureMissing(state.db);
      if (result.unitsWritten || result.skillsWritten) {
        setMessage(`AUTO SYNC OK · +${result.unitsWritten} Units · +${result.skillsWritten} Skills`);
      } else {
        setMessage(`Unit Library canónica lista · ${result.unitCount} Units · ${result.skillCount} Skills`);
      }
      return result;
    } catch (error) {
      state.autoSeedAttempted = false;
      setMessage(`AUTO SYNC FAILED · ${error?.message || error}`, true);
      return false;
    }
  }

  async function syncUnitLibrary() {
    if (!(await currentUserIsDm())) throw new Error('DM_ONLY');
    setMessage('Sincronizando catálogos Kobold / Goblin / Wolf…');
    const api = await librarySync();
    const result = await api.syncAll(state.db);
    setMessage(`SYNC OK · ${result.unitCount} Units · ${result.skillCount} Skills · Goblin conserva pendientes declarados si el catálogo aún no tiene sprite/weapon Skills.`);
    return result;
  }

  async function saveSprite() {
    if (!(await currentUserIsDm())) throw new Error('DM_ONLY');
    const row = selectedDescriptor();
    if (!row) throw new Error('SELECT_ENTRY');
    const timestamp = global.firebase?.database?.ServerValue?.TIMESTAMP || Date.now();
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
        updatedAt: timestamp
      }
    };
    const updates = {};
    for (const path of row.savePaths) {
      for (const [key, value] of Object.entries(payload)) updates[`${path}/${key}`] = value;
    }
    for (const [combatantId, combatant] of Object.entries(state.combatants || {})) {
      if (!targetMatches(combatant, row)) continue;
      updates[`${ROOTS.combatants}/${combatantId}/combatSprite`] = state.spriteUrl || null;
      updates[`${ROOTS.combatants}/${combatantId}/sprite_combate`] = state.spriteUrl || null;
      updates[`${ROOTS.combatants}/${combatantId}/img`] = state.spriteUrl || null;
      updates[`${ROOTS.combatants}/${combatantId}/tokenImage`] = state.spriteUrl || null;
      updates[`${ROOTS.combatants}/${combatantId}/spriteX`] = state.x;
      updates[`${ROOTS.combatants}/${combatantId}/spriteY`] = state.y;
      updates[`${ROOTS.combatants}/${combatantId}/scale`] = state.scale;
      updates[`${ROOTS.combatants}/${combatantId}/visualScale`] = state.scale;
      updates[`${ROOTS.combatants}/${combatantId}/combatVisual`] = payload.combatVisual;
    }
    await state.db.ref().update(updates);
    setMessage(`Combat Sprite guardado y propagado · ${row.savePaths.length} fuente(s) canónica(s).`);
    return true;
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
    subscribe(ROOTS.skills, 'skills');
    subscribe(ROOTS.combatants, 'combatants');
    setMessage('Firebase autenticado · verificando Combat Library…');
    global.setTimeout(() => { autoSeedUnitLibrary(); }, 0);
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
          <p style="color:#aaa;margin:0;line-height:1.5;">La Unit Library canónica se materializa automáticamente desde Kobold, Goblin y Wolf. Actors/NPC DB siguen disponibles como fuentes históricas.</p>
          <button id="dm-combat-tab-sync-units" class="btn-cyber" style="background:#111;color:#c49a00;border:1px solid #c49a00;">FORCE SYNC UNIT LIBRARY</button>
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
            <div style="position:absolute;left:50%;top:32px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;z-index:8;"><strong style="font-family:'Bebas Neue',sans-serif;font-size:48px;line-height:1;color:#ffe877;text-shadow:0 0 10px rgba(255,232,119,.45);">5</strong><span style="font-size:34px;color:#a37c35;letter-spacing:4px;">⬡⬡</span></div>
            <div id="dm-combat-tab-sprite-placeholder" style="position:absolute;left:50%;bottom:93px;width:150px;height:205px;transform-origin:bottom center;place-items:center;text-align:center;white-space:pre-line;color:#8c7a63;border:1px dashed #66543c;background:linear-gradient(180deg,rgba(70,55,40,.24),rgba(20,16,14,.5));clip-path:polygon(34% 0,66% 0,79% 19%,74% 39%,88% 69%,77% 100%,23% 100%,12% 69%,26% 39%,21% 19%);font:700 12px/1.35 monospace;z-index:3;">SELECCIONA\nENTIDAD</div>
            <img id="dm-combat-tab-sprite-preview" alt="Combat Sprite preview" style="display:none;position:absolute;left:50%;bottom:93px;max-height:255px;max-width:290px;transform-origin:bottom center;object-fit:contain;filter:drop-shadow(0 16px 8px rgba(0,0,0,.8));user-select:none;pointer-events:none;z-index:4;" />
            <div style="position:absolute;left:50%;bottom:24px;transform:translateX(-50%);width:min(430px,86%);z-index:9;"><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:4px;"><div><div id="dm-combat-tab-preview-name" style="color:#f0d19b;font-weight:800;letter-spacing:.08em;">COMBATANT PREVIEW</div><div id="dm-combat-tab-preview-source" style="max-width:330px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#766d62;font-size:9px;">Selecciona una entidad para editar su sprite</div></div><div style="width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#4dc6cc,#248b99);border:3px solid #a37c35;font-weight:900;">0</div></div><div style="height:18px;border:2px solid #4f231d;background:#210908;box-shadow:inset 0 0 10px #000;position:relative;"><div style="position:absolute;inset:0;width:78%;background:linear-gradient(90deg,#a91e13,#ff4a22);"></div><span style="position:absolute;left:8px;top:0;color:white;font:700 12px/18px monospace;text-shadow:1px 1px #000;">120 / 120 HP</span></div></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <label>X <span id="dm-combat-tab-x-value">0</span><input id="dm-combat-tab-sprite-x" type="range" min="-400" max="400" step="1" value="0" style="width:100%;" /></label>
            <label>Y <span id="dm-combat-tab-y-value">0</span><input id="dm-combat-tab-sprite-y" type="range" min="-250" max="250" step="1" value="0" style="width:100%;" /></label>
          </div>
          <label>SCALE <span id="dm-combat-tab-scale-value">1.00</span><input id="dm-combat-tab-sprite-scale" type="range" min="0.20" max="4" step="0.05" value="1" style="width:100%;" /></label>
          <div style="display:flex;gap:8px;"><button id="dm-combat-tab-reset" class="btn-cyber" type="button">RESET POSITION</button><button id="dm-combat-tab-save" class="btn-cyber" type="button" style="flex:1;background:#18351b;color:#9fe8a8;border:1px solid #4f9f5a;">SAVE COMBAT SPRITE</button></div>
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
          state.skills = {};
          state.combatants = {};
          state.autoSeedAttempted = false;
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
    version: '1.2.0',
    ROOTS,
    state,
    start,
    stop,
    mount,
    bindData,
    descriptorsFor,
    selectedDescriptor,
    playerSources,
    linkedActor,
    linkedPlayerUnit,
    autoSeedUnitLibrary,
    syncUnitLibrary,
    saveSprite,
    renderPreview
  });
  start();
})(window);
