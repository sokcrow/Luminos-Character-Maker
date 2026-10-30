import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (name) => readFileSync(resolve(root, name), "utf8");
const js = read("js/luminous-audio-director.js");
const css = read("css/luminous-audio-director.css");
const rules = JSON.parse(read("database.rules.json")).rules["campaña"].audio_director;

class FakeAudio {
  constructor(src = "") {
    this.src = src;
    this.volume = 0;
    this.loop = false;
    this.preload = "none";
  }
  addEventListener() {}
  play() { return Promise.resolve(); }
  pause() {}
  removeAttribute(key) { this[key] = ""; }
  load() {}
}

function boot(stored = {}) {
  const callbacks = {};
  const window = {
    document: { readyState: "loading", addEventListener: (key, fn) => { callbacks[key] = fn; } },
    localStorage: {
      getItem: (key) => stored[key] || null,
      setItem: (key, value) => { stored[key] = value; }
    },
    addEventListener: (key, fn) => { callbacks[key] = fn; }
  };
  runInNewContext(js, { window, Audio: FakeAudio, URL });
  return { api: window.LuminousAudio, callbacks };
}

const { api } = boot();
assert.deepEqual({ ...api.getPreferences() }, { music: 40, sfx: 40 });
const voice = new FakeAudio();
api.registerElement(voice, "sfx", 0.5);
assert.equal(voice.volume, 0.2);
api.setVolume("sfx", 70);
assert.equal(voice.volume, 0.35);
api.setVolume("music", 500);
assert.equal(api.getPreferences().music, 100);
api.setVolume("sfx", 0);
assert.equal(voice.volume, 0);
assert.equal(api.library.music.length > 0, true);
assert.equal(api.library.sfx.length > 0, true);
for (const kind of ["music", "ambience", "sfx"]) assert.equal(api.getAvailableTracks(kind).length,0,"system audio is excluded from the Director catalog");

for (const kind of ["music", "ambience", "sfx"]) {
  for (const asset of api.library[kind]) {
    assert.equal(asset.url.startsWith("Assets/Audio/"), true, asset.id);
    assert.equal(asset.url.includes("example."), false, asset.id);
  }
}
for (const page of ["index.html", "hoja_personaje.html", "pantalla_dm.html", "hoja_de_DM.html", "combate.html"]) {
  const markup = read(page);
  assert.match(markup, /css\/luminous-audio-director\.css/);
  assert.match(markup, /js\/luminous-audio-director\.js/);
}
const combatViewer = read("Battle-viewer.html");
assert.match(combatViewer, /html=html\.replace\('<\/body>','<script src="js\/audio-cloud-library\.js/);

assert.match(js, /isHostedInsideAudioShell/, "Combat iframe must not double up music");
assert.match(css, /max-width:600px/);
assert.match(css, /max-height:440px/);
assert.match(css, /safe-area-inset-bottom/);
assert.match(css, /min-height:44px/);
assert.match(rules[".write"], /dm_uid/);
assert.match(rules[".write"], /auth\.uid/);
assert.match(rules.music[".validate"], /'lament'/);
assert.match(rules.ambience[".validate"], /'bus'/);
assert.match(rules.cue[".validate"], /coin-heads/);
assert.match(rules.cue[".validate"], /coin-tails/);
console.log("Luminous audio director: preferences, sources, responsive entrypoints and RTDB authority OK");

// Exercise real event/rollback handlers without connecting to production.
let plays = 0;
class ObservedAudio extends FakeAudio {
  play() { plays++; return Promise.resolve(); }
}
const sandbox = {
  document: { readyState: 'loading', addEventListener() {} },
  location: { href: 'https://example.test/hoja_personaje.html' },
  localStorage: { getItem: () => null }, addEventListener() {}
};
const instrumented = js.replace('  global.LuminousAudio = Object.freeze({', `
  global.audioTest = {receiveCue, receiveLoop, directorWrite, music, syncPosition,
    setRef(ref){audioRef=ref;isDirector=true;authenticatedUser={uid:'dm'};},
    state:()=>musicState};
  global.LuminousAudio = Object.freeze({`);
runInNewContext(instrumented, {window:sandbox, Audio:ObservedAudio, URL});
const handlers = sandbox.audioTest;
handlers.receiveCue(null);
handlers.receiveCue({nonce:'stale',cueId:'coin-heads',at:Date.now()-60000});
assert.equal(plays,0,'Reconnection must not replay expired sound effects');
handlers.receiveCue({nonce:'fresh',cueId:'coin-heads',at:Date.now()});
handlers.receiveCue({nonce:'fresh',cueId:'coin-heads',at:Date.now()});
assert.equal(plays,1,'A fresh nonce plays exactly once');
const original = {active:true,trackId:'lament',startedAt:100};
handlers.receiveLoop('music',original);
handlers.setRef({child(){return {set:async data=>{
  handlers.receiveLoop('music',data); // Firebase local optimistic event.
  throw new Error('PERMISSION_DENIED');
}};}});
assert.equal(await handlers.directorWrite('music',{active:true,trackId:'lament',startedAt:200}),false);
assert.equal(handlers.state().startedAt,100,'Rejected writes restore the state before the optimistic event');

const scopedAudio=JSON.parse(read('database.rules.json')).rules.campaña.encuentros.$encounterId.state.campaña.audio_director;
const dbState={campaña:{config:{dm_uid:'global-dm'},encuentros:{room:{members:{host:true,player:true},state:{campaña:{config:{dm_uid:'host'}}}}}}};
function snapshot(v){return{val:()=>v??null,child:path=>snapshot(path.split('/').reduce((n,k)=>n?.[k],v))};}
const allowed=uid=>new Function('auth','root','$encounterId',`return (${scopedAudio['.write']});`)({uid},snapshot(dbState),'room');
assert.equal(allowed('host'),true);
for(const uid of ['player','global-dm','outsider'])assert.equal(allowed(uid),false);
// Validate the stop cue union in both campaigns, retaining the same DM-only
// authority and rejecting blank play cues or malformed stop messages.
function cueSnapshot(value){return{
 val:()=>value??null,exists:()=>value!==null&&value!==undefined,
 isString:()=>typeof value==='string',isNumber:()=>typeof value==='number'&&Number.isFinite(value),
 hasChildren:keys=>keys.every(key=>value?.[key]!==undefined&&value?.[key]!==null),
 child:key=>cueSnapshot(value?.[key])
};}
const stopCue={action:'stop',cueId:'',nonce:'stop-1',at:Date.now()};
for(const audioRules of [rules,scopedAudio]){
 const expression=audioRules.cue['.validate'].replace(/\.matches\(/g,'.match(');
 const valid=value=>Boolean(new Function('newData',`return (${expression});`)(cueSnapshot(value)));
 assert.equal(valid(stopCue),true);
 for(const cueId of ['coin-heads','coin-tails','r2_'+'a'.repeat(64)])assert.equal(valid({cueId,nonce:'play-1',at:Date.now()}),true);
 for(const value of [{cueId:'',nonce:'x',at:1},{...stopCue,cueId:'coin-heads'},{...stopCue,at:'now'},{...stopCue,nonce:42},{...stopCue,action:'unknown'}])assert.equal(valid(value),false);
}
const globalWrite=uid=>new Function('auth','root',`return (${rules['.write']});`)(uid?{uid}:null,snapshot(dbState));
assert.equal(globalWrite('global-dm'),true);
for(const uid of ['player','outsider',null])assert.equal(globalWrite(uid),false);
console.log('Audio reconnect freshness, rejected-write rollback and isolated authority: OK');

// Shared clock and pause preserve a late listener's position without a second player.
handlers.music.readyState = 1;
handlers.music.duration = 100;
handlers.music.currentTime = 0;
handlers.receiveLoop('music', {active:true,trackId:'lament',startedAt:Date.now()-65000});
assert.ok(handlers.music.currentTime >= 64 && handlers.music.currentTime <= 66);
handlers.receiveLoop('music', {active:false,trackId:'lament',startedAt:0,positionMs:42000});
assert.equal(handlers.music.currentTime,42);
assert.equal(handlers.state().active,false);
console.log('Audio shared-clock seek and persistent pause position: OK');
