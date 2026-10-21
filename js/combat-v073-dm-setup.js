(function (global) {
  'use strict';
  if (global.LuminousCombatDmSetup073) return;

  const ROOTS = Object.freeze({
    players: 'campaña/jugadores',
    actors: 'campaña/actores',
    units: 'campaña/base_datos_unidades',
    combatants: 'campaña/combate/combatants',
    state: 'campaña/combate/estado'
  });
  const LIBRARY_SYNC_SCRIPT = 'js/combat-unit-library-sync.js?v=20261021-encounter-3';
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
    seedAttempted: false,
    libraryReady: false,
    repairTimer: null,
    lastRepairDigest: ''
  };

  function adapter() { return global.LuminousCombatLiveAdapter073 || null; }
  function adapterState() { return adapter()?.state || null; }
  function isDm() { return (adapterState()?.role === 'dm'||adapterState()?.isAuthority===true); }

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

  function skillDeckSlots(value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const deck = {
      tier1: clean(source.tier1 ?? source.t1 ?? source['1'] ?? source.skill1),
      tier2: clean(source.tier2 ?? source.t2 ?? source['2'] ?? source.skill2),
      tier3: clean(source.tier3 ?? source.t3 ?? source['3'] ?? source.skill3)
    };
    const out = [];
    [[1, 3], [2, 2], [3, 1]].forEach(([tier, copies]) => {
      const id = deck[`tier${tier}`];
      for (let index = 0; id && index < copies; index += 1) out.push(id);
    });
    return out;
  }

  function loadoutSource(record = {}) {
    const canonicalDeck = skillDeckSlots(record.characterBuild?.skillDeck || record.skillDeck || {});
    if (canonicalDeck.length) return canonicalDeck;
    return record.skillSlotIds ?? record.skillIds ?? record.skill_ids ?? record.action_slots ?? record.mechanics?.skills ?? record.equippedSkills ?? [];
  }

  function skillSlotIdsFor(record = {}) {
    const loadout = global.LuminousCombatSkillLoadout074;
    if (loadout) {
      const slots = loadout.skillSlotIdsFor(record);
      return slots.length ? slots : loadout.skillIdsFor(record);
    }
    const raw = loadoutSource(record);
    let ids = [];
    if (Array.isArray(raw)) ids = raw.map((value) => clean(value?.id || value?.skillId || value)).filter(Boolean);
    else if (raw && typeof raw === 'object') {
      ids = Object.entries(raw)
        .sort(([left], [right]) => {
          const a = Number(left), b = Number(right);
          return Number.isFinite(a) && Number.isFinite(b) ? a - b : String(left).localeCompare(String(right));
        })
        .map(([, value]) => clean(value?.id || value?.skillId || value))
        .filter(Boolean);
    }
    if (!ids.length && record.equippedSkillIndex && typeof record.equippedSkillIndex === 'object') {
      ids = Object.keys(record.equippedSkillIndex).filter((id) => record.equippedSkillIndex[id] === true);
    }
    return ids;
  }

  function skillIdsFor(record = {}) {
    return [...new Set(skillSlotIdsFor(record))];
  }

  function slotsFor(record = {}) {
    return Math.max(1, Math.trunc(firstNumber(record, ['actionSlots', 'activeSlots', 'action_slots_count', 'initialActionSlots', 'maxActionSlots'], 1) || 1));
  }

  function slotIndex(count) {
    return Object.fromEntries(Array.from({ length: Math.max(1, count) }, (_, index) => [String(index), true]));
  }

  function equipped(ids) { return Object.fromEntries(ids.map((id) => [id, true])); }

  function usableItems(source) {
    const items=source.inventario_activo||source.activeInventory||source.inventory||{};
    return Object.fromEntries(Object.entries(items).filter(([,item])=>item&&Number(item.quantity??item.qty??item.cantidad??item.stack??item.count??1)>0)
      .map(([key,item])=>[clean(item.instanceId||item.instance_id||key),true]));
  }

  function baseStats(record = {}) {
    const maxHp = Math.max(1, firstNumber(record, ['maxHp', 'maxHP', 'hp_max', 'hpMax', 'mechanics.maxHp', 'mechanics.hp', 'combatStats.hp_max', 'hp'], 1) || 1);
    return {
      maxHp,
      hp: Math.max(0, firstNumber(record, ['hp', 'currentHp', 'currentHP', 'hp_actual', 'combatStats.hp_actual'], maxHp) ?? maxHp),
      sp: firstNumber(record, ['sp', 'currentSp', 'currentSP', 'sp_actual', 'mechanics.sp', 'combatStats.sp_actual'], 0) || 0,
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
    // The Player build is authoritative; a linked Unit may contain an older deck.
    // An explicitly empty Player loadout also must not resurrect that old deck.
    const hasPlayerLoadout = global.LuminousCombatSkillLoadout074?.hasSkillLoadout(player) ??
      ['skillDeck','skillSlotIds','skillIds','equippedSkillIndex'].some(key => player[key] != null || player.characterBuild?.[key] != null);
    const slotIds = hasPlayerLoadout ? skillSlotIdsFor(player) : skillSlotIdsFor(source);
    const ids = [...new Set(slotIds)];
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
      skillDeck: hasPlayerLoadout ? clone(player.characterBuild?.skillDeck || player.skillDeck || null) : clone(source.skillDeck || null),
      skillIds: ids,
      skillSlotIds: slotIds,
      equippedSkillIndex: equipped(ids),
      usableItemIndex: usableItems(source),
      statusEffects: clone(source.statusEffects || {}),
      battleActive: true,
      isBackup: false,
      deploymentState: 'field',
      deployment: 'field',
      removed: false,
      entrySource: 'combat_v073_dm_setup',
      enteredCombatAt: Date.now()
    };
  }

  function buildUnit(unitId, unit = {}, faction = 'enemy', serial = '') {
    const side = faction === 'ally' ? 'ally' : 'enemy';
    const source = global.LuminousUnitCombatInstantiator?.normalizeDefinition
      ? global.LuminousUnitCombatInstantiator.normalizeDefinition(unitId,unit,{initializeEncounter:true})
      : clone(unit) || {};
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
      isBackup: false,
      deploymentState: 'field',
      deployment: 'field',
      removed: false,
      entrySource: 'combat_v073_dm_setup',
      enteredCombatAt: Date.now()
    };
  }

  async function ensureEncounterIdentity() {
    const current=(await state.db.ref(ROOTS.state).once('value')).val();
    if(!current||current.phase==='ENDED'||current.active===false)
      return global.LuminousCombatSession.start({db:state.db,uid:adapterState()?.uid});
    const runtime = global.LuminousLootLivePostCombatRuntime;
    if (!runtime?.ensureEncounterId) return null;
    return runtime.ensureEncounterId({ db: state.db });
  }

  async function deployPlayer(playerId) {
    if (!isDm()) throw new Error('DM_ONLY');
    requirePlanning();
    const player = state.players[playerId];
    if (!player) throw new Error('PLAYER_NOT_FOUND');
    const combatant = buildPlayer(playerId, player);
    await ensureEncounterIdentity();
    return (await global.LuminousCombatSession.deploy({db:state.db,units:[combatant]}))[0];
  }

  async function deployUnits(unitId, faction, quantity) {
    if (!isDm()) throw new Error('DM_ONLY');
    requirePlanning();
    const unit = state.units[unitId];
    if (!unit || isPlayerUnit(unit)) throw new Error('UNIT_NOT_FOUND');
    const count = Math.max(1, Math.min(20, Math.trunc(Number(quantity) || 1)));
    await ensureEncounterIdentity();
    const updates = {};
    for (let index = 0; index < count; index += 1) {
      const serial = `${Date.now().toString(36)}_${index}_${Math.random().toString(36).slice(2, 6)}`;
      const combatant = buildUnit(unitId, unit, faction, serial);
      updates[combatant.id] = combatant;
    }
    await global.LuminousCombatSession.deploy({db:state.db,units:Object.values(updates)});
    return count;
  }

  async function removeCombatant(id) {
    if (!isDm()) throw new Error('DM_ONLY');
    requirePlanning();
    const unit=state.combatants[id]||state.reserves?.[id],owner=global.LuminousCombatParticipants?.isPlayer(unit)?canonicalPlayerId(unit):null;
    const updates={[`${ROOTS.combatants}/${id}`]:null,[`campaña/combate/reserves/${id}`]:null};
    if(owner){updates[`campaña/combate/readyPlayers/${owner}`]=null;updates[`campaña/combate/plannedActions/${owner}`]=null;}
    await state.db.ref().update(updates);
  }

  async function clearEncounter() {
    if (!isDm()) throw new Error('DM_ONLY');
    requirePlanning();
    const next={
      encounterId: null,
      encounterCreatedAt: null,
      result: null,
      outcome: null,
      endedAt: null,
      endedBy: null,
      transition: null,
      phase: 'SETUP',
      round: 1,
      completedRound: null,
      active: false,
      updatedAt: global.firebase?.database?.ServerValue?.TIMESTAMP ?? Date.now(),
    };
    const updates={
      [ROOTS.combatants]:null,
      'campaña/combate/reserves':null,
      'campaña/combate/defeated':null,
      'campaña/combate/departed':null,
      'campaña/combate/participants':null,
      'campaña/combate/plannedActions':null,
      'campaña/combate/readyPlayers':null,
      'campaña/combate/authority/current':null,
      'campaña/combate/playback/current':null,
    };
    for(const [key,value]of Object.entries(next))updates[`${ROOTS.state}/${key}`]=value;
    await state.db.ref().update(updates);
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
    const locked = !planningPhase();
    for (const id of ['c073-add-player','c073-enemy','c073-ally','c073-clear']) {
      const button = global.document.getElementById(id); if (button) button.disabled = locked || (['c073-enemy','c073-ally'].includes(id) && !state.libraryReady);
    }
    const playerSelect = global.document.getElementById('c073-player');
    const unitSelect = global.document.getElementById('c073-unit');
    const roster = global.document.getElementById('c073-roster');
    if (playerSelect) {
      const previous = state.selectedPlayer || playerSelect.value;
      playerSelect.innerHTML = '<option value="">— Campaign Player —</option>' + Object.entries(state.players || {})
        .sort((a, b) => nameFor(a[1], a[0]).localeCompare(nameFor(b[1], b[0])))
        .map(([id, player]) => `<option value="${esc(id)}">${esc(nameFor(player, id))}${global.LuminousCombatParticipants?.isField(state.combatants[`player:${safe(id)}`]) ? ' · EN COMBATE' : ''}</option>`).join('');
      if (state.players[previous]) playerSelect.value = previous;
    }
    if (unitSelect) {
      const previous = state.selectedUnit || unitSelect.value;
      const markup = '<option value="">— Enemy / NPC Unit Library —</option>' + Object.entries(state.units || {})
        .filter(([, unit]) => !isPlayerUnit(unit || {}))
        .sort((a, b) => nameFor(a[1], a[0]).localeCompare(nameFor(b[1], b[0])))
        .map(([id, unit]) => `<option value="${esc(id)}">${esc(nameFor(unit, id))}${spriteFor(unit) ? ' · SPRITE' : ' · SIN SPRITE'}${skillIdsFor(unit).length ? ` · ${skillIdsFor(unit).length} SKILLS` : ''}${unit?.metadata?.weaponSkillsPendingCanonicalCatalog ? ' · WEAPON SKILLS PENDING' : ''}</option>`).join('');
      if (state.unitOptionsMarkup !== markup) { unitSelect.innerHTML = markup; state.unitOptionsMarkup = markup; }
      if (state.units[previous]) unitSelect.value = previous;
    }
    if (roster) {
      const members=global.LuminousCombatParticipants,progress=members?.progress(state.combatants,state.readyPlayers,state.encounter?.round||1);
      const reserveRows=Object.entries(state.reserves||{}).map(([id,unit])=>`<div style="display:flex;gap:6px;align-items:center;margin:3px 0"><span style="flex:1">${esc(nameFor(unit,id))} · ${unit.faction==='enemy'?'Enemigo':'Aliado'} · RESERVA</span><button data-remove="${esc(id)}" aria-label="Quitar reserva">×</button></div>`).join('');
      roster.innerHTML = Object.entries(state.combatants || {}).length
        ? Object.entries(state.combatants).map(([id, combatant]) => `<div style="display:flex;gap:6px;align-items:center;margin:3px 0"><span style="flex:1">${esc(nameFor(combatant, id))} · ${esc(combatant.faction || '')}${members?.isPlayer(combatant)?' · '+(members.isField(combatant)?(state.readyPlayers?.[members.playerId(combatant)]?.ready===true&&Number(state.readyPlayers[members.playerId(combatant)].round)===Number(state.encounter?.round||1)?'LISTO':'PREPARANDO'):'FUERA DEL COMBATE'):''} · ${skillIdsFor(combatant).length} skills${spriteFor(combatant) ? ' · sprite' : ''}</span><button data-remove="${esc(id)}">×</button></div>`).join('')
        : '<div style="opacity:.65">Aún no hay combatientes desplegados.</div>';
      if(reserveRows)roster.insertAdjacentHTML('beforeend',`<div style="margin-top:8px"><b>Refuerzos en reserva</b>${reserveRows}</div>`);
      if(progress?.total)roster.insertAdjacentHTML('afterbegin',`<div class="combat-participant-progress">Participantes: ${progress.total} · Listos ${progress.ready}/${progress.total}</div>`);
      roster.querySelectorAll('[data-remove]').forEach((button) => {
        button.disabled = locked;
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
      if (!await api.ensureDeploymentRuntime()) throw new Error('UNIT_DEPLOYMENT_UNAVAILABLE');
      const result = await api.ensureMissing(state.db);
      state.libraryReady = true;
      schedulePlayerStateRepair();
      render();
      if (result.unitsWritten || result.skillsWritten) setMsg('Biblioteca de unidades actualizada.');
      return result;
    } catch (error) {
      state.seedAttempted = false;
      global.console?.error?.('[Combat unit library]',error);
      setMsg('No se pudo preparar la biblioteca. Recarga el encuentro para volver a intentarlo.', true);
      return false;
    }
  }

  function planningPhase() {
    if(String(state.encounter?.phase||'').toUpperCase()==='ENDING')return false;
    if (['sealed','running'].includes(String(state.authorityPhase || global.LuminousCombatAuthority073?.state.current?.phase || '').toLowerCase())) return false;
    const phase = clean(adapterState()?.combatState).toLowerCase().replace(/[\s-]+/g, '_');
    return !['combat','combat_sealed','running','sealed','combat_running','combat_resolution'].includes(phase);
  }

  function requirePlanning() {
    if (!planningPhase()) throw new Error('Espera a que termine la ronda antes de cambiar los combatientes.');
  }

  function canonicalPlayerId(unit = {}) {
    return clean(unit.canonicalPlayerKey || unit.ownerPlayerId || unit.playerId || unit.characterLink?.playerId);
  }

  function firebaseValue(value) {
    if (value == null || typeof value !== 'object') return value ?? null;
    // RTDB has no empty containers and may return numeric-key objects as
    // arrays. Object key order is not a change to a character's loadout.
    const entries = Object.keys(value).sort().map(key => [key, firebaseValue(value[key])])
      .filter(([, child]) => child !== null);
    return entries.length ? Object.fromEntries(entries) : null;
  }

  function syncFieldsFromBuiltPlayer(current = {}, built = {}) {
    const fields = [
      'skillDeck','skillIds','skillSlotIds','equippedSkillIndex',
      'canonicalPlayerKey','canonicalOwnerUid','isPlayer','usableItemIndex',
      'characterBuild','classes','classLevels',
      'spellIds','spellSelections','knownSpellIds','preparedSpellIds',
      'traitDefinitions','combatTraits','actionTraits','traits','classTraits','archetypeTraits','features',
      'inventario_activo','inventario_stash','itemInventorySchemaVersion','itemEquipmentRefs','attunedItemInstanceIds'
    ];
    const patch = {};
    fields.forEach((key) => {
      if (built[key] === undefined) return;
      if (built[key] === null && current[key] == null) return;
      if (JSON.stringify(firebaseValue(current[key])) !== JSON.stringify(firebaseValue(built[key]))) patch[key] = clone(built[key]);
    });
    // Keep the combat's allocated slot count. A campaign sheet can still
    // have the initial count while later rounds grant additional slots.
    const index = slotIndex(slotsFor(current));
    if (JSON.stringify(firebaseValue(current.actionSlotIndex)) !== JSON.stringify(firebaseValue(index))) patch.actionSlotIndex = index;
    return patch;
  }

  function initialUnitVitalRepair(current = {}, combat = {}) {
    // Repair only the historical missing-stat fallback before any round has
    // resolved. Never heal a damaged creature or replace an authored 1-HP unit.
    if(isPlayerUnit(current)||Number(current.maxHp)>1||Number(current.hp)!==1||combat.authority?.current||Number(combat.estado?.round||1)!==1)return {};
    const unitId=current.libraryUnitId||current.unitRef?.id,definition=state.units[unitId];
    if(!definition||!global.LuminousUnitCombatInstantiator?.normalizeDefinition)return {};
    const normalized=global.LuminousUnitCombatInstantiator.normalizeDefinition(unitId,definition,{initializeEncounter:false});
    if(!(normalized.maxHp>1))return {};
    return {hp:normalized.maxHp,maxHp:normalized.maxHp,originalMaxHp:normalized.maxHp};
  }

  async function repairDeployedPlayerState() {
    if (!state.db?.ref || !isDm() || !planningPhase()) return false;
    const updates = {};
    Object.entries(state.combatants || {}).forEach(([combatantKey, current]) => {
      if (!isPlayerUnit(current || {})) {
        const hasAuthority=typeof state.authorityPhase==='string'&&Boolean(state.authorityPhase);
        Object.entries(initialUnitVitalRepair(current,{estado:state.encounter,authority:hasAuthority?{current:{phase:state.authorityPhase}}:null})).forEach(([key,value])=>{updates[`${ROOTS.combatants}/${combatantKey}/${key}`]=value;});
        return;
      }
      const playerId = canonicalPlayerId(current);
      const player = state.players?.[playerId];
      if (!playerId || !player) return;
      const built = buildPlayer(playerId, player);
      const patch = syncFieldsFromBuiltPlayer(current, built);
      Object.entries(patch).forEach(([key, value]) => {
        updates[`${ROOTS.combatants}/${combatantKey}/${key}`] = value;
      });
    });
    if (!Object.keys(updates).length) return false;
    state.lastRepairDigest = JSON.stringify(Object.entries(updates).sort(([a],[b]) => a.localeCompare(b)));
    const ref = state.db.ref('campaña/combate');
    let hold;
    try {
      await new Promise((resolve, reject) => {
        hold = snapshot => resolve(snapshot);
        ref.on('value', hold, reject);
      });
      const result = await ref.transaction(combat => {
        if (!combat || ['sealed','running'].includes(combat.authority?.current?.phase)) return;
        const phase = clean(combat.estado?.phase || combat.estado?.state || combat.estado).toLowerCase();
        if (!['setup','planning','pre_combat_planning'].includes(phase)) return;
        let changed = false;
        const combatants = { ...(combat.combatants || {}) };
        const plannedActions = { ...(combat.plannedActions || {}) }, readyPlayers = { ...(combat.readyPlayers || {}) };
        for (const [key, current] of Object.entries(combatants)) {
          if (!isPlayerUnit(current || {})) {
            const patch=initialUnitVitalRepair(current,combat);
            if(Object.keys(patch).length){combatants[key]={...current,...patch};changed=true;}
            continue;
          }
          const playerId = canonicalPlayerId(current), player = state.players?.[playerId];
          if (!player) continue;
          const patch = syncFieldsFromBuiltPlayer(current, buildPlayer(playerId, player));
          if (!Object.keys(patch).length) continue;
          // Canonical metadata repair must not cancel an unchanged effective deck.
          if (JSON.stringify(firebaseValue(skillSlotIdsFor(current))) !== JSON.stringify(firebaseValue(skillSlotIdsFor(buildPlayer(playerId, player))))) {
            delete plannedActions[playerId]; delete readyPlayers[playerId];
          }
          combatants[key] = { ...current, ...patch }; changed = true;
        }
        return changed ? { ...combat, combatants, plannedActions, readyPlayers } : undefined;
      }, undefined, false);
      return result.committed;
    } catch(error){
      // A planning preview can supersede this repair on the same SDK client.
      if(error?.message==='set'){schedulePlayerStateRepair();return false;}
      throw error;
    } finally { if (hold) ref.off('value', hold); }
  }

  function schedulePlayerStateRepair() {
    if (state.repairTimer || !state.started) return;
    state.repairTimer = global.setTimeout(() => {
      state.repairTimer = null;
      repairDeployedPlayerState().catch((error) => {
        state.lastRepairDigest = '';
        global.console?.error?.('[Combat073 DM Setup player-state repair]', error);
      });
    }, 40);
  }

  function mount() {
    if (state.mounted || !isDm() || !global.document?.body) return false;
    state.mounted = true;
    const wrap = global.document.createElement('details');
    wrap.id = 'c073-dm-setup';
    wrap.open = false;
    wrap.style.cssText = 'position:fixed;z-index:2147483000;right:12px;top:12px;width:min(440px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:rgba(8,6,12,.97);border:1px solid #735c36;color:#ddd;padding:8px;font:12px system-ui;box-shadow:0 10px 28px #000';
    wrap.innerHTML = `<summary style="cursor:pointer;color:#d7aa58;font-weight:700">Encuentro</summary><div style="margin-top:8px;display:grid;gap:8px"><div style="opacity:.72">Añade personajes y unidades al encuentro. Puedes colocar la formación antes de preparar la primera ronda.</div><div style="display:flex;gap:6px"><select id="c073-player" style="flex:1;min-width:0"></select><button id="c073-add-player">Añadir personaje</button></div><div style="display:flex;gap:6px"><select id="c073-unit" style="flex:1;min-width:0"></select><input id="c073-qty" type="number" min="1" max="20" value="1" style="width:46px"><button id="c073-enemy">Enemigo</button><button id="c073-ally">Aliado</button></div><div style="display:flex;justify-content:space-between;align-items:center"><b>Combatientes</b><button id="c073-clear">Vaciar</button></div><button id="combat-stage-placement" type="button" aria-pressed="false">Colocar formación inicial</button><div id="c073-roster"></div><div id="c073-setup-msg" style="min-height:16px;color:#9fd6a8">Preparando unidades…</div></div>`;
    if(adapterState()?.role==='player'&&adapterState()?.isAuthority){
      wrap.dataset.playerHost='true';wrap.style.top='68px';
      const style=global.document.createElement('style');style.textContent='#c073-dm-setup[data-player-host]:not([open]){width:auto!important}';global.document.head.appendChild(style);
    }
    global.document.body.appendChild(wrap);
    const player = global.document.getElementById('c073-player');
    const unit = global.document.getElementById('c073-unit');
    const qty = global.document.getElementById('c073-qty');
    player.onchange = () => { state.selectedPlayer = player.value; };
    unit.onchange = () => { state.selectedUnit = unit.value; };
    global.document.getElementById('c073-add-player').onclick = async () => {
      if (!player.value) return setMsg('Selecciona un Campaign Player.', true);
      try { setMsg('Añadiendo personaje…'); const added=await deployPlayer(player.value); setMsg(added.isBackup?'Personaje en reserva. Entrará cuando haya una plaza libre.':'Personaje en campo.'); }
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
    global.document.getElementById('combat-stage-placement').onclick = () => global.LuminousCombatStage073?.setPlacing(true);
    render();
    ensureLibraryMaterialized();
    return true;
  }

  function subscribe(path, key) {
    const ref = state.db.ref(path);
    const handler = (snapshot) => {
      state[key] = snapshot.val() || {};
      render();
      schedulePlayerStateRepair();
    };
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
    subscribe('campaña/combate/reserves','reserves');
    subscribe('campaña/combate/authority/current/phase', 'authorityPhase');
    subscribe(ROOTS.state, 'encounter');
    subscribe('campaña/combate/readyPlayers','readyPlayers');
    mount();
    return true;
  }

  function stop() {
    state.subs.splice(0).forEach((unsubscribe) => { try { unsubscribe(); } catch (_) {} });
    if (state.repairTimer) global.clearTimeout?.(state.repairTimer);
    state.repairTimer = null;
    state.lastRepairDigest = '';
    state.started = false;
  }

  let tries = 0;
  const timer = global.setInterval(() => {
    tries += 1;
    if (start() || tries > 120) global.clearInterval(timer);
  }, 250);
  global.addEventListener('beforeunload', stop, { once: true });
  global.LuminousCombatDmSetup073 = Object.freeze({
    version: '0.7.3-dm-setup.3-player-state',
    state,
    start,
    mount,
    buildPlayer,
    buildUnit,
    deployPlayer,
    deployUnits,
    ensureEncounterIdentity,
    removeCombatant,
    clearEncounter,
    requirePlanning,
    ensureLibraryMaterialized,
    repairDeployedPlayerState,
    schedulePlayerStateRepair,
    resolvePlayerUnit,
    actorForPlayer
  });
})(window);
