(function (global) {
  'use strict';
  if (global.LuminousCombat073UnitDeployBridge) return;

  const clean = (value) => String(value ?? '').trim();
  const clampQty = (value) => Math.max(1, Math.min(20, Math.trunc(Number(value) || 1)));

  function setup() { return global.LuminousCombatDmSetup073 || null; }
  function adapterState() { return global.LuminousCombatLiveAdapter073?.state || null; }
  function isDm() { return adapterState()?.role === 'dm'; }
  function instantiator() { return global.LuminousUnitCombatInstantiator || null; }

  function setMsg(text, bad = false) {
    const node = global.document?.getElementById('c073-setup-msg');
    if (!node) return;
    node.textContent = text;
    node.style.color = bad ? '#ff8b78' : '#9fd6a8';
  }

  async function deployUnits(unitId, faction = 'enemy', quantity = 1, options = {}) {
    const dmSetup = setup();
    const api = instantiator();
    if (!isDm()) throw new Error('DM_ONLY');
    if (!dmSetup?.state?.db?.ref) throw new Error('COMBAT_DB_UNAVAILABLE');
    if (!api?.instantiate) throw new Error('UNIT_COMBAT_INSTANTIATOR_UNAVAILABLE');
    const definition = dmSetup.state.units?.[unitId];
    if (!definition || definition.isPlayer === true) throw new Error('UNIT_NOT_FOUND');

    const count = clampQty(quantity);
    const side = faction === 'ally' ? 'ally' : 'enemy';
    const updates = {};
    for (let index = 0; index < count; index += 1) {
      const serial = `${Date.now().toString(36)}_${index}_${Math.random().toString(36).slice(2, 6)}`;
      const combatant = api.instantiate(unitId, definition, {
        faction: side,
        serial,
        level: options.level,
        rank: options.rank,
        initializeEncounter: true
      });
      updates[combatant.id] = combatant;
    }
    await dmSetup.state.db.ref('campaña/combate/combatants').update(updates);
    return Object.values(updates);
  }

  async function handleButton(button) {
    const select = global.document?.getElementById('c073-unit');
    const qty = global.document?.getElementById('c073-qty');
    const unitId = clean(select?.value);
    if (!unitId) return setMsg('Selecciona una Unit real de la librería.', true);
    const side = button.id === 'c073-ally' ? 'ally' : 'enemy';
    try {
      setMsg(`Materializando Unit → FIELD (${side})…`);
      const deployed = await deployUnits(unitId, side, qty?.value || 1);
      const warnings = deployed[0]?.runtimeDiagnostics || {};
      const notes = [];
      if (warnings.speedFallback) notes.push('Speed fallback 1–6');
      if (warnings.missingSprite) notes.push('sin sprite');
      if (warnings.missingSkills) notes.push('sin Skills');
      setMsg(`${deployed.length} Unit(s) desplegada(s)${notes.length ? ` · ${notes.join(' · ')}` : ''}.`);
    } catch (error) {
      setMsg(`No se pudo desplegar: ${error?.message || error}`, true);
    }
  }

  function capture(event) {
    const target = event.target?.closest?.('#c073-enemy,#c073-ally');
    if (!target || !isDm() || !instantiator()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    handleButton(target);
  }

  function start() {
    if (!global.document?.addEventListener) return false;
    global.document.addEventListener('click', capture, true);
    return true;
  }

  function stop() {
    global.document?.removeEventListener?.('click', capture, true);
  }

  start();
  global.addEventListener?.('beforeunload', stop, { once: true });
  global.LuminousCombat073UnitDeployBridge = Object.freeze({ version: '1.0.0', start, stop, deployUnits });
})(window);
