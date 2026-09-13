import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const viewer=read('Battle-viewer.html');
const instanceControl=read('js/instance-control.js');

assert.ok(viewer.includes('COMBAT_WEBGL_PERF_PATCH_MISSING'),'Combat renderer optimization must remain scoped to Battle-viewer bootstrap');
assert.ok(viewer.includes("parentVisibilityObserver=new parent.MutationObserver(syncSurfaceActive)"),'Combat iframe must suspend itself when its own iframe/ancestors become hidden');
assert.ok(viewer.includes("attributeFilter:['class','style','aria-hidden']"),'Combat parent observer must only watch visibility-relevant attributes');
assert.ok(viewer.includes('if(!surfaceActive){')&&viewer.includes('if(rafId){cancelAnimationFrame(rafId);rafId=0}'),'hidden Combat must cancel RAF immediately');
assert.ok(viewer.includes('cameraTransitionActive=false;continuousUntil=0'),'hidden Combat must clear transient renderer animation state');
assert.ok(instanceControl.includes('combatView.style.display = combatActive ? "block" : "none"'),'instance control must continue isolating Player Combat from Theatre with iframe display state');
assert.ok(instanceControl.includes('theatreView.style.display = theatreActive ? "flex" : "none"'),'Theatre visibility contract must remain independent from Combat renderer state');

const theatreFiles=fs.readdirSync(path.join(root,'js'))
  .filter(name=>name.startsWith('theatre-')&&name.endsWith('.js'));
assert.ok(theatreFiles.length>0,'repository must contain Theatre runtime files for isolation coverage');
for(const name of theatreFiles){
  const source=read(`js/${name}`);
  assert.ok(!source.includes('COMBAT_WEBGL_PERF_PATCH_MISSING'),`${name} must not contain Combat renderer patch hooks`);
  assert.ok(!source.includes("0.8.3-review-fixes"),`${name} must not depend on Combat renderer version`);
  assert.ok(!source.includes('domSpriteMode'),`${name} must not depend on Combat sprite composition mode`);
  assert.ok(!source.includes('cameraTransitionActive'),`${name} must not depend on Combat camera renderer state`);
}

for(const file of ['hoja_personaje.html','hoja_de_DM.html','pantalla_dm.html']){
  if(!fs.existsSync(path.join(root,file)))continue;
  const source=read(file);
  assert.ok(!source.includes('COMBAT_WEBGL_PERF_PATCH_MISSING'),`${file} must not install Combat renderer patch into the parent page`);
  assert.ok(!source.includes("0.8.3-review-fixes"),`${file} must not expose Combat renderer internals globally`);
  assert.ok(!source.includes('cameraTransitionActive'),`${file} must not expose Combat camera renderer state`);
}

assert.ok(!viewer.includes('js/theatre-engine.js'),'Battle-viewer bootstrap must not load Theatre engine');
assert.ok(!viewer.includes('js/theatre-controls.js'),'Battle-viewer bootstrap must not load Theatre controls');

console.log(`combat v0.7.3 Theatre isolation smoke: ok · ${theatreFiles.length} Theatre runtime files checked`);
