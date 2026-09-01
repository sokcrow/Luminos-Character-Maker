const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const topology = require('../js/vtt/topology.js');
const interactions = require('../js/vtt/topology-interaction.js');
const authority = require('../js/vtt/topology-interaction-authority.js');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const grid = { size:70, cols:10, rows:10, distancePerCell:5 };
const edge = { from:{ col:2, row:0 }, to:{ col:2, row:1 }, z:[0] };

test('legacy topology states migrate to independent open, lock and condition axes', () => {
  const locked = topology.normalizeElement({ id:'legacy-lock', type:'door', state:'locked', ...edge });
  expect(locked).toMatchObject({ openState:'closed', lockState:'locked', condition:'normal' });
  const broken = topology.normalizeElement({ id:'legacy-broken', type:'door', state:'broken', ...edge });
  expect(broken).toMatchObject({ openState:'open', lockState:'unlocked', condition:'broken' });
});

test('broken openings can still close while destroyed openings leave topology entirely passable', () => {
  const brokenClosed = topology.normalizeElement({ id:'broken', type:'door', openState:'closed', lockState:'unlocked', condition:'broken', ...edge });
  expect(topology.effectiveFlags(brokenClosed)).toEqual({ blocksMovement:true, blocksVision:true });
  const opened = topology.applyAction(brokenClosed, 'open').element;
  expect(topology.effectiveFlags(opened)).toEqual({ blocksMovement:false, blocksVision:false });
  const destroyed = topology.normalizeElement({ ...brokenClosed, condition:'destroyed', structural:{ hp:0, hardness:4, damaged:0, profile:'thick' } });
  expect(topology.effectiveFlags(destroyed)).toEqual({ blocksMovement:false, blocksVision:false });
});

test('Hardness, Damaged and structural profiles use the Luminous structural rules', () => {
  const h3 = topology.normalizeElement({ id:'h3', type:'door', structural:{ hp:1, hardness:3, damaged:0, profile:'thick' }, ...edge });
  expect(topology.structuralStats(h3)).toMatchObject({ baseShield:1500, currentMaxShield:1500, strengthThreshold:18 });
  const damaged = topology.normalizeElement({ ...h3, structural:{ hp:1, hardness:2, damaged:10, profile:'thick' } });
  expect(topology.structuralStats(damaged).currentMaxShield).toBe(500);
  const normal = topology.normalizeElement({ ...h3, structural:{ hp:1, hardness:1, damaged:0, profile:'normal' } });
  const blunt = topology.applyStructuralDamage(normal, 250, { damageType:'blunt', turnKey:'round-1' });
  expect(blunt.damage).toBe(375);
  expect(blunt.element.structural.shieldRemaining).toBe(125);
  expect(topology.closeStructuralTurn(blunt.element, 'round-1').structural.damaged).toBe(1);
  const reinforced = topology.normalizeElement({ ...h3, structural:{ hp:1, hardness:3, damaged:0, profile:'reinforced' } });
  expect(topology.applyStructuralDamage(reinforced, 1000, { damageType:'blunt', turnKey:'round-1' }).damage).toBe(750);
});

test('Strength uses DC 15 + Hardness and success executes force instead of instant break', () => {
  const door = topology.normalizeElement({ id:'force-door', type:'door', state:'locked', structural:{ hp:1, hardness:4, damaged:0, profile:'thick' }, ...edge });
  expect(topology.checkDescriptor(door, 'strength')).toMatchObject({ action:'force', threshold:19 });
  const forced = topology.applyAction(door, 'force').element;
  expect(forced.condition).toBe('normal');
  expect(forced.structural.turnDamage).toBe(10);
  expect(forced.structural.shieldRemaining).toBe(1990);
  const jammed = topology.normalizeElement({ ...door, lockState:'unlocked', condition:'jammed' });
  expect(topology.applyAction(jammed, 'force').element).toMatchObject({ openState:'open', lockState:'unlocked', condition:'broken' });
});

test('simple windows default to Hardness 0 and a successful force can destroy them', () => {
  const simpleWindow = topology.createElement({ id:'simple-window', type:'window', from:edge.from, to:edge.to, zLayer:0 });
  expect(simpleWindow.structural.hardness).toBe(0);
  expect(topology.applyAction(simpleWindow, 'force').element.condition).toBe('destroyed');
});

test('interaction range measures from token edge and reports interior/exterior side', () => {
  const door = topology.createElement({ id:'door', type:'door', from:edge.from, to:edge.to, zLayer:0 });
  const mapData = { grid, topology:[door] };
  const inside = { id:'player', x:70, y:35, radius:20, z:[0] };
  const facts = interactions.factsFor(door, inside, mapData, {});
  expect(facts.withinRange).toBe(true);
  expect(facts.distanceFt).toBeCloseTo(3.5714, 3);
  expect(facts.side).toBe('left');
  expect(facts.isInterior).toBe(true);
  const far = interactions.factsFor(door, { ...inside, x:-20 }, mapData, {});
  expect(far.withinRange).toBe(false);
});

test('DM authority rejects actor-token spoofing and revalidates physical checks', async () => {
  const door = topology.createElement({ id:'owned-door', type:'door', from:edge.from, to:edge.to, zLayer:0 });
  const actor = {
    id:'player:p1', x:70, y:35, radius:20, z:[0],
    ownerUid:'uid-p1', canonicalOwnerUid:'uid-p1', playerId:'p1', actorId:'actor-p1', canonicalScope:'player',
  };
  const mapData = { id:'ownership-map', grid, topology:[door], tokens:[actor] };
  const root = {
    LuminousVttStateBridge: {
      hostWindow: () => ({}),
      inventoryHasItem: () => false,
    },
    LuminousVttTopology: topology,
    LuminousVttTopologyInteraction: interactions,
  };
  const runtime = authority.createAuthority({
    mapData,
    stateBridge: { mapId:'ownership-map', isDm:true, applyCanonicalAction: async () => ({ valid:true }) },
    root,
  });

  const base = {
    targetKind:'topology', targetId:'owned-door', actorTokenId:'player:p1', action:'open',
    playerId:'p1', actorId:'actor-p1',
  };
  await expect(runtime.validateRequest({ ...base, requesterUid:'uid-attacker' })).resolves.toMatchObject({ valid:false, reason:'ACTOR_NOT_OWNED' });
  await expect(runtime.validateRequest({ ...base, requesterUid:'uid-p1' })).resolves.toMatchObject({ valid:true });
  await expect(runtime.validateRequest({ ...base, requesterUid:'uid-p1', playerId:'victim' })).resolves.toMatchObject({ valid:false, reason:'ACTOR_NOT_OWNED' });
  await expect(runtime.validateRequest({ ...base, action:'force', requesterUid:'uid-p1' })).resolves.toMatchObject({ valid:true });

  actor.x = -20;
  const outOfRange = await runtime.validateRequest({ ...base, action:'force', requesterUid:'uid-p1' });
  expect(outOfRange.valid).toBe(false);
  expect(outOfRange.reason).toBe('Debes estar a 5 ft o menos.');

  expect(authority.actorOwnership({ id:'npc', playerId:'p1' }, { requesterUid:'uid-p1', playerId:'p1' }))
    .toMatchObject({ valid:false, reason:'ACTOR_OWNERSHIP_UNVERIFIED' });
});

test('radial affordances keep unavailable actions visible with an understandable reason', () => {
  const door = topology.normalizeElement({ id:'locked-door', type:'door', state:'locked', ...edge, interaction:{ rangeFt:5, interiorSide:'left', lockSide:'interior', keyId:'tower-key' } });
  const actor = { id:'player', x:210, y:35, radius:20, z:[0] };
  const facts = interactions.factsFor(door, actor, { grid, topology:[door] }, { hasKey:false, hasLockpick:false });
  const actions = interactions.actionsFor(door, facts);
  expect(actions.find((entry) => entry.id === 'open')).toMatchObject({ enabled:false, reason:'Está cerrada con seguro.' });
  expect(actions.find((entry) => entry.id === 'unlock')).toMatchObject({ enabled:false, reason:'Necesitas la llave correcta.' });
  expect(actions.find((entry) => entry.id === 'pick_lock')).toMatchObject({ enabled:false, reason:'Necesitas una Ganzúa.' });
});

test('curtains are interior-only while their underlying window keeps independent state', () => {
  const curtain = topology.createElement({ id:'curtain', type:'curtain_window', from:edge.from, to:edge.to, zLayer:0 });
  const actor = { id:'player', x:210, y:35, radius:20, z:[0] };
  const facts = interactions.factsFor(curtain, actor, { grid, topology:[curtain] }, {});
  const openCurtain = interactions.actionsFor(curtain, facts).find((entry) => entry.id === 'open_curtain');
  expect(openCurtain).toMatchObject({ enabled:false, reason:'La cortina sólo se manipula desde el interior.' });
});

test('GOAP receives the same canonical opening facts used by the radial menu', () => {
  const door = topology.normalizeElement({ id:'goap-door', type:'door', state:'locked', structural:{ hp:1, hardness:3, damaged:2, profile:'thick' }, ...edge });
  const actor = { id:'npc', x:70, y:35, radius:20, z:[0] };
  const facts = interactions.factsFor(door, actor, { grid, topology:[door] }, {});
  expect(interactions.goapFacts(door, facts)).toMatchObject({ isOpen:false, isLocked:true, hardness:3, damaged:2, strengthThreshold:18, canTraverse:false });
});

test('VTT loads radial UI, structural authoring and DM-validated interaction authority', () => {
  const html = read('vtt.html');
  const controller = read('js/vtt/topology-controller.js');
  const radial = read('js/vtt/interaction-radial.js');
  const authoritySource = read('js/vtt/topology-interaction-authority.js');
  const authorityBootstrap = read('js/vtt/topology-interaction-authority-bootstrap.js');
  const stateBridge = read('js/vtt/state-bridge.js');
  const css = read('css/vtt-interactions.css');
  expect(html).toContain('css/vtt-interactions.css');
  expect(html).toContain('js/vtt/topology-interaction.js');
  expect(html).toContain('js/vtt/interaction-radial.js');
  expect(html).toContain('js/vtt/topology-interaction-authority.js');
  expect(html).toContain('id="vtt-topology-hardness"');
  expect(controller).toContain("CustomEvent('vtt:structure-attack-requested'");
  expect(controller).toContain('handleContextMenu');
  expect(controller).toContain('handlePointerDown');
  expect(radial).toContain('PAGE_SIZE = 8');
  expect(css).toContain('.vtt-radial-action');
  expect(authority.DIRECT_ACTIONS).toEqual(['open', 'close', 'lock', 'unlock', 'open_curtain', 'close_curtain']);
  expect(authority.CHECK_ACTIONS).toEqual(['pick_lock', 'force']);
  expect(authoritySource).toContain('validateRequest');
  expect(authoritySource).toContain('requesterInventory');
  expect(authoritySource).toContain('actorOwnership');
  expect(authorityBootstrap).toContain("pick_lock: 'lockpick'");
  expect(authorityBootstrap).toContain('actorTokenId');
  expect(stateBridge).toContain('validateTopologyCheckRequest');
  expect(stateBridge).toContain('actorTokenId: safeActorTokenId');
  expect(stateBridge).toContain('vttValidationReason');
});