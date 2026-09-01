const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const actorLibrary = require('../js/vtt/actor-library.js');
const actorState = require('../js/vtt/actor-library-state.js');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

class Ref {
  constructor() { this.handlers = new Set(); }
  on(event, handler) { if (event === 'value') this.handlers.add(handler); }
  off(event, handler) { if (event === 'value') this.handlers.delete(handler); }
  emit(value) { for (const handler of [...this.handlers]) handler({ val: () => value }); }
}

function fakeRoot() {
  const refs = new Map();
  const refFor = (key) => {
    if (!refs.has(key)) refs.set(key, new Ref());
    return refs.get(key);
  };
  return {
    refs,
    root: {
      LuminousVttActorLibrary: actorLibrary,
      firebase: { database: () => ({ ref: refFor }) },
    },
  };
}

test('actor library ignores player realtime changes that do not affect the actor card/token definition', () => {
  const { root, refs } = fakeRoot();
  const changes = [];
  const bridge = actorState.createBridge({ root, onChanged: (list) => changes.push(list) });
  bridge.start();

  refs.get(actorState.PLAYERS_ROOT).emit({
    p1: {
      characterName: 'Agatha',
      icono: '/img/agatha.png',
      vttTokenState: { mapA: { position: { x: 10, y: 20 } } },
    },
  });
  expect(changes).toHaveLength(1);
  expect(changes[0][0]).toMatchObject({ name: 'Agatha', portrait: '/img/agatha.png' });

  refs.get(actorState.PLAYERS_ROOT).emit({
    p1: {
      characterName: 'Agatha',
      icono: '/img/agatha.png',
      vttTokenState: { mapA: { position: { x: 200, y: 350 } } },
    },
  });
  expect(changes).toHaveLength(1);

  refs.get(actorState.PLAYERS_ROOT).emit({
    p1: {
      characterName: 'Agatha Renamed',
      icono: '/img/agatha.png',
      vttTokenState: { mapA: { position: { x: 200, y: 350 } } },
    },
  });
  expect(changes).toHaveLength(2);
  expect(changes[1][0].name).toBe('Agatha Renamed');

  bridge.stop();
});

test('DM actor menu reconciles keyed cards instead of replacing the full list HTML', () => {
  const source = read('js/vtt/actor-library-bootstrap.js');
  expect(source).toContain('const cardNodes = new Map()');
  expect(source).toContain('let lastListSignature');
  expect(source).toContain('if (signature === lastListSignature) return');
  expect(source).toContain('node.insertBefore(card, expected)');
  expect(source).not.toContain('node.innerHTML = list.length');
});
