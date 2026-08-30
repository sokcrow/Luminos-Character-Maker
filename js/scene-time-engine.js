(function (global) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = require('./scene-time-core.js');
    return;
  }
  function load(id, src, done) {
    let script = document.getElementById(id);
    if (script) {
      if (done && !script.dataset.loaded) script.addEventListener('load', done, { once: true });
      else done?.();
      return;
    }
    script = document.createElement('script'); script.id = id; script.src = src; script.async = false;
    if (done) script.addEventListener('load', () => { script.dataset.loaded = 'true'; done(); }, { once: true });
    document.head?.appendChild(script);
  }
  const worldScheduler = () => load(
    'world-time-scheduler-core',
    'js/world-time-scheduler-core.js',
    () => load(
      'regional-travel-core',
      'js/regional-travel-core.js',
      () => load(
        'regional-world-graph-core',
        'js/regional-world-graph-core.js',
        () => load(
          'world-time-scheduler-runtime',
          'js/world-time-scheduler-runtime.js',
          () => load(
            'regional-travel-runtime',
            'js/regional-travel-runtime.js',
            () => load('regional-world-graph-runtime', 'js/regional-world-graph-runtime.js')
          )
        )
      )
    )
  );
  const runtime = () => {
    load('scene-time-v1-runtime', 'js/scene-time-runtime.js');
    worldScheduler();
  };
  const spellcasting = () => {
    const basic = () => load('luminous-spellcasting-basic-rules', 'js/spellcasting-basic-rules-runtime.js');
    if (global.LuminousSpellcastingRuntime) basic();
    else load('luminous-spellcasting-runtime', 'js/spellcasting-runtime.js', basic);
  };
  spellcasting();
  if (global.LuminousSceneTimeCore) runtime();
  else load('scene-time-v1-core', 'js/scene-time-core.js', runtime);
})(typeof window !== 'undefined' ? window : globalThis);
