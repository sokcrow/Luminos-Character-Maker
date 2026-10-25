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
assert.match(combatViewer, /html=html\.replace\('<\/body>','<script src="js\/luminous-audio-director\.js/);

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
