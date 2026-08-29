const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const appearance = require('../js/vtt/token-appearance.js');
const characterBridge = require('../js/vtt/character-vision-bridge.js');
const tokenControl = require('../js/vtt/token-control.js');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const mainSource = read('js/vtt/main.js');
const verticalYieldSource = read('js/vtt/vertical-portal-controller-token-yield.js');

test('fichas prefer the Actor image and compute a centered cover crop', () => {
    expect(appearance.imageSource({ tokenImage: 'actor-token.png', portrait: 'portrait.png' })).toBe('actor-token.png');

    const wide = appearance.coverRect(400, 200, 100, 120, 56);
    expect(wide).toEqual({ x: 44, y: 92, width: 112, height: 56 });

    const tall = appearance.coverRect(200, 400, 100, 120, 56);
    expect(tall).toEqual({ x: 72, y: 64, width: 56, height: 112 });
});

test('canonical player fichas inherit Actor identity instead of generic person data', () => {
    const token = { id: 'player:p1', icon: 'person', characterLink: { mode: 'player', playerId: 'p1' } };
    characterBridge.applyActorPresentation(
        token,
        { characterName: 'Fallback Player', portrait: 'player.png' },
        { nombre: 'Lanae', tokenImage: 'lanae-token.png' },
    );

    expect(token.name).toBe('Lanae');
    expect(token.tokenImage).toBe('lanae-token.png');
    expect(token.portrait).toBe('lanae-token.png');
});

test('DM control resolver can select every draggable ficha regardless of ownership', () => {
    const resolveDmControl = tokenControl.createResolver({ isDm: true });
    expect(resolveDmControl({ id: 'player:someone-else', draggable: true, ownerUid: 'other-user' })).toBe(true);
    expect(resolveDmControl({ id: 'npc:enemy', draggable: true, characterLink: { actorId: 'enemy' } })).toBe(true);
    expect(resolveDmControl({ id: 'locked-prop', draggable: false })).toBe(false);
});

test('DM vertical authoring yields capture-phase clicks when a ficha is the hit target', () => {
    expect(mainSource).toContain("from './vertical-portal-controller-token-yield.js'");
    expect(verticalYieldSource).toContain('this.engine?.tokenAtEvent?.(event)');
    expect(verticalYieldSource).toContain('return super.handleMouseDown(event)');
});

test('common ficha renderer is installed for both surfaces and restored after DM actor bootstrap', () => {
    expect(mainSource).toContain("import './token-appearance.js'");
    expect(mainSource.match(/tokenAppearanceApi\?\.installRenderer\?\.\(engine\.renderer\)/g)?.length).toBe(2);
    expect(mainSource).toContain('characterVisionBridge?.syncTokens?.()');
});
