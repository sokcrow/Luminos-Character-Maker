(function (global) {
  'use strict';
  if (global.LuminousCombatDmSetup073) return;

  const ROOTS = Object.freeze({
    players: 'campaña/jugadores',
    actors: 'campaña/actores',
    units: 'campaña/base_datos_unidades',
    combatants: 'campaña/combate/combatants'
  });
  const LIBRARY_SYNC_SCRIPT = 'js/combat-unit-library-sync.js';
  const clean = (value) => String(value ?? '').trim();
  const safe = (value, fallback = 'id') => clean(value).replace(/[.#$\[\]\/]/g, '_') || fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const finite = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  const state = {
    db: null,
    players: {},
    actors: {},
    units: {},
    combatants: {},
    subs: [],
    mounted: false,
    started: false,
    seedAttempted: false
  };

  function adapter() { return global.LuminousCombatLiveAdapter073 || null; }
  function adapterState() { return adapter()?.state || null; }
  function isDm() { return adapterState()?.role === 'dm'; }

  function firstNumber(object, keys, fallback) {
    for (const key of keys) {
      let value = object;
      for (const part of key.split('.')) value = value?.[part];
      const number = finite(value, null);
      if (number != null) return number;
    }
    return fallback;
  }

  function explicitSprite(record = {}) {
    return clean(record.combatSprite || record.sprite_combate || record.combat_sprite || record.combatVisual?.spriteUrl);
  }

  function genericSprite(record = {}) {
    return clean(record.visual?.spriteUrl || record.tokenImage || record.sprite || record.idle_sprite || record.img || record.image || record.portrait || record.icono);
  }

  function spriteFor(record = {}) { return explicitSprite(record) || genericSprite(record); }

  function spriteFromSources(primary = [], genericOrder = primary) {
    for (const record of primary.filter(Boolean)) {
      const sprite = explicitSprite(record);
      if (sprite) return sprite;
    }
    for (const record of genericOrder.filter(Boolean)) {
      const sprite = genericSprite(record);
      if (sprite) return sprite;
    }
    return '';
  }

  function nameFor(record = {}, fallback = 'Unit') {
    return clean(record.characterName || record.character_name || record.nombre || record.name || record.displayName || fallback) || fallback;
  }

  function uidForPlayer(player = {}) {
    return clean(player.uid || player.vinculado_a || player.vinculo_jugador || player.ownerUid || player.canonicalOwnerUid);
  }

  function actorIdForPlayer(player = {}) {
    return clean(player.linkedActorId || player.actorId || player.actor_id || player.actorRef?.id || player.characterBuild?.actorId);
  }

  function actorForPlayer(playerId, player = {}) {
    const explicit = actorIdForPlayer(player);
    if (explicit && state.actors[explicit]) return { id: explicit, record: state.actors[explicit] };
    const uid = uidForPlayer(player);
    const row = Object.entries(state.actors || {}).find(([, actor]) => {
      const linkedPlayer = clean(actor?.playerId || actor?.ownerPlayerId || actor?.linkedPlayerId);
      const linkedUid = clean(actor?.uid || actor?.ownerUid || actor?.linkedPlayerUID || actor?.linkedPlayerUid);
      return linkedPlayer === playerId || (uid && linkedUid === uid);
    });
    return row ? { id: row[0], record: row[1] || {} } : null;
  }

  function isPlayerUnit(unit = {}) {
    const category = clean(unit.actorCategory || unit.category || unit.type || unit.canonicalScope).toLowerCase();
    return unit.isPlayer === true || category === 'player';
  }

  function resolvePlayerUnit(playerId, player = {}) {
    const uid = uidForPlayer(player);
    const actorId = actorIdForPlayer(player);
    const explicit = clean(player.unitId || player.unit_id || player.unitRef?.id || player.characterBuild?.unitId);
    const rows = Object.entries(state.units || {}).map(([id, unit]) => {
      if (!isPlayerUnit(unit || {})) return { id, unit, score: -1 };
      const canonicalUnitId = clean(unit?.id || unit?.unitId || unit?.unit_id || id);
      let score = 0;
      if (explicit && (id === explicit || canonicalUnitId === explicit)) score += 10000;
      if (clean(unit?.playerId || unit?.ownerPlayerId || unit?.linkedPlayerId) === playerId) score += 5000;
      if (uid && clean(unit?.linkedPlayerUID || unit?.linkedPlayerUid || unit?.ownerUid || unit?.canonicalOwnerUid) === uid) score += 4000;
      if (actorId && clean(unit?.actorId || unit?.linkedActorId || unit?.linked_actor_id) === actorId) score += 3000;
      return { id, unit: unit || {}, score };
    }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score);
    return rows[0] || null;
  }

  function loadoutSource(record = {}) {
    return record.action_slots ?? record.skillSlotIds ?? record.skillIds ?? record.skill_ids ?? record.mechanics?.skills ?? record.equippedSkills ?? [];
  }

  function skillIdsFor(record = {}) {
    const raw = loadoutSource(record);
    let ids = [];
    if (Array.isArray(raw)) ids = raw.map((value) => clean(value?.id || value?.skillId || value)).filter(Boolean);
    else if (raw && typeof raw === 'object') ids = Object.values(raw).map((value) => clean(value?.id || value?.skillId || value)).filter(Boolean);
    if (!ids.length && record.equippedSkillIndex && typeof record.equippedSkillIndex === 'object') {
      ids = Object.keys(record.equippedSkillIndex).filter((id) => record.equippedSkillIndex[id] === true);
    }
    return [...new Set(ids)];
  }

  function slotsFor(record = {}) {
    return Math.max(1, Math.trunc(firstNumber(record, ['actionSlots', 'activeSlots', 'action_slots_count', 'initialActionSlots', 'maxActionSlots'], 1) || 1));
  }

  function slotIndex(count) {
    return Object.fromEntries(Array.from({ length: Math.max(1, count) }, (_, index) => [String(index), true]));
  }

  function equipped(ids) { return Object.fromEntries(ids.map((id) => [id, true])); }

  function baseStats(record = {}) {
    const maxHp = Math.max(1, firstNumber(record, ['maxHp', 'maxHP', 'hp_max', 'hpMax', 'combatStats.hp_max', 'hp'], 1) || 1);
    return {
      maxHp,
      hp: Math.max(0, firstNumber(record, ['hp', 'currentHp', 'currentHP', 'hp_actual', 'combatStats.hp_actual'], maxHp) ?? maxHp),
      sp: firstNumber(record, ['sp', 'currentSp', 'currentSP', 'sp_actual', 'combatStats.sp_actual'], 0) || 0,
      speed: firstNumber(record, ['speed', 'currentSpeed', 'speedValue', 'maxSpeed'], 0) || 0,
      level: firstNumber(record, ['level', 'characterBuild.calculatedAtLevel'], 1) || 1
    };
  }

  function buildPlayer(playerId, player = {}) {
    const actorRow = actorForPlayer(playerId, player);
    const actor = actorRow?.record || {};
    const unitRow = resolvePlayerUnit(playerId, player);
    const unit = unitRow?.unit || {};
    const source = { ...clone(actor), ...clone(unit), ...clone(player) };
    const uid = uidForPlayer(player) || clean(source.uid || source.ownerUid);
    const ids = skillIdsFor(unit).length ? skillIdsFor(unit) : skillIdsFor(source);
    const slots = slotsFor(source);
    const stats = baseStats(source);
    const id = `player:${safe(playerId, 'player')}`;
    const sprite = spriteFromSources([player, actor, unit], [unit, actor, player]);
    return {
      ...clone(source),
      id,
      combatId: id,
      name: nameFor(source, playerId),
      characterName: nameFor(source, playerId),
      faction: 'ally',
      faccion: 'ally',
      category: 'player',
      actorCategory: 'player',
      canonicalScope: 'player',
      isPlayer: true,
      playerId,
      ownerPlayerId: playerId,
      canonicalPlayerKey: playerId,
      ownerUid: uid || null,
      canonicalOwnerUid: uid || null,
      characterLink: { mode: 'player', uid: uid || null, playerId, actorId: actorRow?.id || null },
      actorId: actorRow?.id || null,
      unitRef: unitRow ? { scope: 'units', id: unitRow.id } : null,
      img: sprite || null,
      combatSprite: sprite || null,
      sprite_combate: sprite || null,
      tokenImage: sprite || null,
      portrait: sprite || null,
      ...stats,
      actionSlots: slots,
      activeSlots: slots,
      actionSlotIndex: slotIndex(slots),
      skillIds: ids,
      skillSlotIds: ids,
      equippedSkillIndex: equipped(ids),
      statusEffects: clone(source.statusEffects || {}),
      battleActive: true,
      entrySource: 'combat_v073_dm_setup',
      enteredCombatAt: Date.now()
    };
  }

  function buildUnit(unitId, unit = {}, faction = 'enemy', serial = '') {
    const side = faction === 'ally' ? 'ally' : 'enemy';
    const source = clone(unit) || {};
    const ids = skillIdsFor(source);
    const slots = slotsFor(source);
    const stats = baseStats(source);
    const id = `${side}:unit:${safe(unitId, 'unit')}:${serial || Date.now().toString(36)}`;
    const sprite = spriteFor(source);
    return {
      ...source,
      id,
      combatId: id,
      name: nameFor(source, unitId),
      characterName: nameFor(source, unitId),
      faction: side,
      faccion: side,
      category: side,
      actorCategory: side,
      canonicalScope: 'unit',
      isPlayer: false,
      unitRef: { scope: 'units', id: unitId },
      libraryUnitId: unitId,
      img: sprite || null,
      combatSprite: sprite || null,
      sprite_combate: sprite || null,
      tokenImage: sprite || null,
      portrait: sprite || null,
      ...stats,
      actionSlots: slots,
      activeSlots: slots,
      actionSlotIndex: slotIndex(slots),
      skillIds: ids,
      skillSlotIds: ids,
      equippedSkillIndex: equipped(ids),
      statusEffects: clone(source.statusEffects || {}),
      battleActive: true,
      entrySource: 'combat_v073_dm_setup',
      enteredCombatAt: Date.now()
    };
  }

  async function deployPlayer(playerId) {
    if (!isDm()) throw new Error('DM_ONLY');
    const player = state.players[playerId];
    if (!player) throw new Error('PLAYER_NOT_FOUND');
    const combatant = buildPlayer(playerId, player);
    await state.db.ref(`${ROOTS.combatants}/${combatant.id}`).set(combatant);
    return combatant;
  }

  async function deployUnits(unitId, faction, quantity) {
    if (!isDm()) throw new Error('DM_ONLY');
    const unit = state.units[unitId];
    if (!unit || isPlayerUnit(unit)) throw new Error('UNIT_NOT_FOUND');
    const count = Math.max(1, Math.min(20, Math.trunc(Number(quantity) || 1)));
    const updates = {};
    for (let index = 0; index < count; index += 1) {
      const serial = `${Date.now().toString(36)}_${index}_${Math.random().toString(36).slice(2, 6)}`;
      const combatant = buildUnit(unitId, unit, faction, serial);
      updates[combatant.id] = combatant;
    }
    await state.db.ref(ROOTS.combatants).update(updates);
    return count;
  }

  async function removeCombatant(id) {
    if (!isDm()) throw new Error('DM_ONLY');
    await state.db.ref(`${ROOTS.combatants}/${id}`).remove();
  }

  async function clearEncounter() {
    if (!isDm()) throw new Error('DM_ONLY');
    await state.db.ref(ROOTS.combatants).remove();
    await state.db.ref('campaña/combate/plannedActions').remove();
    await state.db.ref('campaña/combate/readyPlayers').remove();
  }

  function esc(value) {
    return clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function setMsg(text, bad = false) {
    const node = global.document?.getElementById('c073-setup-msg');
    if (!node) return;
    node.textContent = text;
    node.style.color = bad ? '#ff8b78' : '#9fd6a8';
  }

  function render() {
    if (!state.mounted) return;
    const playerSelect = global.document.getElementById('c073-player');
    const unitSelect = global.document.getElementById('c073-unit');
    const roster = global.document.getElementById('c073-roster');
    if (playerSelect) {
      const previous = playerSelect.value;
      playerSelect.innerHTML = '<option value="">— Campaign Player —</option>' + Object.entries(state.players || {})
        .sort((a, b) => nameFor(a[1], a[0]).localeCompare(nameFor(b[1], b[0])))
        .map(([id, player]) => `<option value="${esc(id)}">${esc(nameFor(player, id))}${state.combatants[`player:${safe(id)}`] ? ' · EN COMBATE' : ''}</option>`).join('');
      if (state.players[previous]) playerSelect.value = previous;
    }
    if (unitSelect) {
      const previous = unitSelect.value;
      unitSelect.innerHTML = '<option value="">— Enemy / NPC Unit Library —</option>' + Object.entries(state.units || {})
        .filter(([, unit]) => !isPlayerUnit(unit || {}))
        .sort((a, b) => nameFor(a[1], a[0]).localeCompare(nameFor(b[1], b[0])))
        .map(([id, unit]) => `<option value="${esc(id)}">${esc(nameFor(unit, id))}${spriteFor(unit) ? ' · SPRITE' : ' · SIN SPRITE'}${skillIdsFor(unit).length ? ` · ${skillIdsFor(unit).length} SKILLS` : ''}${unit?.metadata?.weaponSkillsPendingCanonicalCatalog ? ' · WEAPON SKILLS PENDING' : ''}</option>`).join('');
      if (state.units[previous]) unitSelect.value = previous;
    }
    if (roster) {
      roster.innerHTML = Object.entries(state.combatants || {}).length
        ? Object.entries(state.combatants).map(([id, combatant]) => `<div style="display:flex;gap:6px;align-items:center;margin:3px 0"><span style="flex:1">${esc(nameFor(combatant, id))} · ${esc(combatant.faction || '')} · ${skillIdsFor(combatant).length} skills${spriteFor(combatant) ? ' · sprite' : ''}</span><button data-remove="${esc(id)}">×</button></div>`).join('')
        : '<div style="opacity:.65">Aún no hay combatientes desplegados.</div>';
      roster.querySelectorAll('[data-remove]').forEach((button) => {
        button.onclick = () => removeCombatant(button.dataset.remove).catch((error) => setMsg(error.message, true));
      });
    }
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

  async function ensureLibraryMaterialized() {
    if (state.seedAttempted || !state.db?.ref || !isDm()) return false;
    state.seedAttempted = true;
    try {
      if (!global.LuminousCombatUnitLibrarySync) await loadScript(LIBRARY_SYNC_SCRIPT);
      const api = global.LuminousCombatUnitLibrarySync;
      if (!api) throw new Error('UNIT_LIBRARY_SYNC_UNAVAILABLE');
      const result = await api.ensureMissing(state.db);
      if (result.unitsWritten || result.skillsWritten) setMsg(`Unit Library reparada · +${result.unitsWritten} Units · +${result.skillsWritten} Skills`);
      return result;
    } catch (error) {
      state.seedAttempted = false;
      setMsg(`Unit Library auto-sync falló · ${error?.message || error}`, true);
      return false;
    }
  }

  function mount() {
    if (state.mounted || !isDm() || !global.document?.body) return false;
    state.mounted = true;
    const wrap = global.document.createElement('details');
    wrap.id = 'c073-dm-setup';
    wrap.open = true;
    wrap.style.cssText = 'position:fixed;z-index:2147483000;right:12px;top:12px;width:min(440px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:rgba(8,6,12,.97);border:1px solid #735c36;color:#ddd;padding:8px;font:12px system-ui;box-shadow:0 10px 28px #000';
    wrap.innerHTML = `<summary style="cursor:pointer;color:#d7aa58;font-weight:700">ENCOUNTER SETUP · COMBAT v0.7.3</summary><div style="margin-top:8px;display:grid;gap:8px"><div style="opacity:.72">FIELD solamente. La edición de Combat Sprites y la Unit Library vive en Panel DM → COMBATE.</div><div style="display:flex;gap:6px"><select id="c073-player" style="flex:1;min-width:0"></select><button id="c073-add-player">ADD PLAYER</button></div><div style="display:flex;gap:6px"><select id="c073-unit" style="flex:1;min-width:0"></select><input id="c073-qty" type="number" min="1" max="20" value="1" style="width:46px"><button id="c073-enemy">ENEMY</button><button id="c073-ally">ALLY</button></div><div style="display:flex;justify-content:space-between;align-items:center"><b>FIELD ROSTER</b><button id="c073-clear">CLEAR</button></div><div id="c073-roster"></div><div id="c073-setup-msg" style="min-height:16px;color:#9fd6a8">Verificando Unit Library…</div></div>`;
    global.document.body.appendChild(wrap);
    const player = global.document.getElementById('c073-player');
    const unit = global.document.getElementById('c073-unit');
    const qty = global.document.getElementById('c073-qty');
    global.document.getElementById('c073-add-player').onclick = async () => {
      if (!player.value) return setMsg('Selecciona un Campaign Player.', true);
      try { setMsg('Desplegando Player…'); await deployPlayer(player.value); setMsg('Player desplegado.'); }
      catch (error) { setMsg(`No se pudo desplegar: ${error.message}`, true); }
    };
    global.document.getElementById('c073-enemy').onclick = async () => {
      if (!unit.value) return setMsg('Selecciona una Unit real de la librería.', true);
      try { setMsg('Desplegando enemigo…'); await deployUnits(unit.value, 'enemy', qty.value); setMsg('Enemigo(s) desplegado(s).'); }
      catch (error) { setMsg(`No se pudo desplegar: ${error.message}`, true); }
    };
    global.document.getElementById('c073-ally').onclick = async () => {
      if (!unit.value) return setMsg('Selecciona una Unit real de la librería.', true);
      try { setMsg('Desplegando aliado…'); await deployUnits(unit.value, 'ally', qty.value); setMsg('Aliado(s) desplegado(s).'); }
      catch (error) { setMsg(`No se pudo desplegar: ${error.message}`, true); }
    };
    global.document.getElementById('c073-clear').onclick = async () => {
      if (!global.confirm('¿Vaciar todo el encounter y planes READY?')) return;
      try { await clearEncounter(); setMsg('Encounter vacío.'); }
      catch (error) { setMsg(error.message, true); }
    };
    render();
    ensureLibraryMaterialized();
    return true;
  }

  function subscribe(path, key) {
    const ref = state.db.ref(path);
    const handler = (snapshot) => { state[key] = snapshot.val() || {}; render(); };
    ref.on('value', handler);
    state.subs.push(() => ref.off('value', handler));
  }

  function start() {
    if (state.started) return true;
    const adapterRuntime = adapterState();
    if (!adapterRuntime?.db?.ref || !isDm()) return false;
    state.started = true;
    state.db = adapterRuntime.db;
    subscribe(ROOTS.players, 'players');
    subscribe(ROOTS.actors, 'actors');
    subscribe(ROOTS.units, 'units');
    subscribe(ROOTS.combatants, 'combatants');
    mount();
    return true;
  }

  function stop() {
    state.subs.splice(0).forEach((unsubscribe) => { try { unsubscribe(); } catch (_) {} });
    state.started = false;
  }

  let tries = 0;
  const timer = global.setInterval(() => {
    tries += 1;
    if (start() || tries > 120) global.clearInterval(timer);
  }, 250);
  global.addEventListener('beforeunload', stop, { once: true });
  global.LuminousCombatDmSetup073 = Object.freeze({
    version: '0.7.3-dm-setup.2',
    state,
    start,
    mount,
    buildPlayer,
    buildUnit,
    deployPlayer,
    deployUnits,
    removeCombatant,
    clearEncounter,
    ensureLibraryMaterialized,
    resolvePlayerUnit,
    actorForPlayer
  });
})(window);
