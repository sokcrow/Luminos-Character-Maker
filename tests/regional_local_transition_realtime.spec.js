const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const core = read('js/regional-local-transition-core.js');
const runtime = read('js/vtt/regional-local-transition-runtime.js');
const travelRuntime = read('js/regional-travel-runtime.js');
const streamingRuntime = read('js/vtt/world-streaming-runtime.js');
const main = read('js/vtt/main.js');
const rules = JSON.parse(read('database.rules.json'));

test.describe('Regional ↔ Local Realtime/performance contract', () => {
  test('transition core is pure and contains no Realtime or timer loop', () => {
    expect(core).not.toContain('firebase');
    expect(core).not.toContain('.database(');
    expect(core).not.toContain('setInterval(');
    expect(core).not.toContain('requestAnimationFrame(');
    expect(core).not.toContain('.on("value"');
    expect(core).not.toContain(".on('value'");
  });

  test('runtime only requests a regional exit on mouseup, never mousemove or per-frame', () => {
    expect(runtime).toContain("window.addEventListener('mouseup',captureBoundary,true)");
    expect(runtime).not.toContain("addEventListener('mousemove'");
    expect(runtime).not.toContain('setInterval(');
    expect(runtime).not.toContain('requestAnimationFrame(');
    expect(runtime).not.toContain('setTimeout(');
  });

  test('DM commits target worldPosition and consumes request in one atomic root update', () => {
    expect(runtime).toContain("updates[`${PLAYER_ROOT}/${firebaseKey(playerId,'player')}/worldPosition`]=targetPosition");
    expect(runtime).toContain("updates[`${REQUEST_ROOT}/${mapId}/${requestId}`]=null");
    expect(runtime).toContain('await db.ref().update(updates)');
    expect(runtime).not.toContain('playerWorldRef(playerId).set(');
  });

  test('player listens only to its own authoritative worldPosition, not another global players listener', () => {
    expect(runtime).toContain("subscribe(playerWorldRef(identity.playerId),'value'");
    expect(runtime).not.toContain("db.ref(PLAYER_ROOT).on('value'");
    expect(runtime).not.toContain('db.ref(PLAYER_ROOT).on("value"');
  });

  test('regional travel arrival remains one multipath write for every party member', () => {
    expect(travelRuntime).toContain('await db.ref().update(updates)');
    expect(travelRuntime).toContain('LuminousRegionalLocalTransitionCore');
    expect(travelRuntime).toContain('routing.destinationEntrySide');
    expect(travelRuntime).not.toContain('setInterval(');
  });

  test('local world streaming preserves regional identity while tokens move inside a zone', () => {
    for (const key of ['regionalHex','transitionId','regionalGraphId','regionalGraphRevision','regionalGraphFingerprint','travelArrivalId']) {
      expect(streamingRuntime).toContain(key);
    }
    expect(streamingRuntime).toContain('regionalMetadata(prior)');
  });

  test('main boot order guarantees generator then chunk streaming then regional-local bridge', () => {
    const generator = main.indexOf("import('./procedural-generator-bootstrap.js')");
    const chunks = main.indexOf("import('./procedural-chunk-streaming-runtime.js')");
    const transition = main.indexOf("import('./regional-local-transition-runtime.js')");
    expect(generator).toBeGreaterThan(-1);
    expect(chunks).toBeGreaterThan(generator);
    expect(transition).toBeGreaterThan(chunks);
    expect(main).toContain('regionalLocalTransition?.stop?.()');
    expect(main).toContain('proceduralChunks?.stop?.()');
  });

  test('Firebase rules make player transition requests create-only and ownership-bound', () => {
    const requestRule = rules.rules.vtt_regional_local_transition_requests.$mapId.$requestId['.write'];
    expect(requestRule).toContain('!data.exists()');
    expect(requestRule).toContain('newData.exists()');
    expect(requestRule).toContain("newData.child('requesterUid').val() === auth.uid");
    expect(requestRule).toContain("newData.child('playerId').isString()");
    expect(requestRule).toContain("root.child('campaña').child('jugadores').child(newData.child('playerId').val()).child('uid').val() === auth.uid");
    expect(requestRule).toContain("auth.uid === 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1'");
  });

  test('new transition path never writes or subscribes to the global calendar', () => {
    expect(runtime).not.toContain('campaña/calendario');
    expect(runtime).not.toContain('world_scheduler');
    expect(core).not.toContain('campaña/calendario');
  });

  test('authoritative apply activates only destination chunk and saves legacy visual state once', () => {
    expect(runtime).toContain('chunks.activateChunk(next,next.activeChunk,{tokenId:token.id,persist:false,publish:false,center:false})');
    const saves = (runtime.match(/tokenStateBridge\?\.saveToken\?\./g) || []).length;
    expect(saves).toBe(1);
    expect(runtime).not.toContain('for(const chunk');
    expect(runtime).not.toContain('for (const chunk');
  });
});
