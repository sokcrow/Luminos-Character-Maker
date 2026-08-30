const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('discovery runtime is event-driven and never polls or writes per frame',()=>{
  const runtime=read('js/vtt/player-discovery-runtime.js');
  expect(runtime).not.toContain('setInterval(');expect(runtime).not.toContain('setTimeout(');expect(runtime).not.toContain('requestAnimationFrame(');
  expect(runtime).not.toContain(".on('value'");expect(runtime).not.toContain('.on("value"');
  expect(runtime).toContain("once('value')");expect(runtime).toContain('.transaction(');
  expect(runtime).toContain("'vtt:token-moved'");expect(runtime).toContain("'vtt:procedural-chunk-loaded'");
});

test('discovery persists only below the current player subtree and has no global player-root listener',()=>{
  const runtime=read('js/vtt/player-discovery-runtime.js');
  expect(runtime).toContain('campaña/jugadores');expect(runtime).toContain('/mapDiscovery/');
  expect(runtime).toContain('identity.playerId');expect(runtime).not.toContain("db.ref(PLAYER_ROOT).on");
  expect(runtime).not.toContain('campaña/estado_mundo/playerDiscovery');
});

test('reconnect loads only the current zone and keeps no registry of visited zones',()=>{
  const runtime=read('js/vtt/player-discovery-runtime.js');
  expect(runtime).toContain('currentRecord=null');expect(runtime).toContain('currentZone=');
  expect(runtime).not.toContain('visitedZones');expect(runtime).not.toContain('discoveryCache');
  expect(runtime).toContain('Core.storageKey(raw)');
});

test('memory overlay renders remembered snapshots, not current live topology state',()=>{
  const runtime=read('js/vtt/player-discovery-runtime.js');
  expect(runtime).toContain('snapshot.element');expect(runtime).toContain('memory.topology');
  expect(runtime).not.toContain('mapData.topology.find');
  expect(runtime).toContain('Core.pointVisible');
});

test('map simulation owns discovery bootstrap and shuts it down with the lifecycle',()=>{
  const simulation=read('js/vtt/map-simulation-runtime.js');
  expect(simulation).toContain("from './player-discovery-runtime.js'");
  expect(simulation).toContain('startPlayerDiscovery({runtime:globalThis.LuminousVttRuntime,mapData})');
  expect(simulation).toContain('LuminousVttPlayerDiscoveryRuntime?.api?.stop?.()');
});

test('discovery modules parse cleanly',()=>{
  execFileSync(process.execPath,['--check',path.join(ROOT,'js/vtt/player-discovery-core.js')]);
  execFileSync(process.execPath,['--input-type=module','--check'],{input:read('js/vtt/player-discovery-runtime.js'),stdio:['pipe','pipe','pipe']});
  execFileSync(process.execPath,['--input-type=module','--check'],{input:read('js/vtt/map-simulation-runtime.js'),stdio:['pipe','pipe','pipe']});
});

test('database rules already scope player discovery writes to the owning player record',()=>{
  const rules=JSON.parse(read('database.rules.json'));
  const playerRule=rules.rules['campaña']['jugadores']['$nombre_personaje']['.write'];
  expect(playerRule).toContain("data.child('uid').val() === auth.uid");
  expect(playerRule).toContain("auth.uid === 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1'");
});
