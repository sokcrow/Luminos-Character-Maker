import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  WORLD_FLOOR_MATERIAL_BINDINGS,
  WORLD_FLOOR_PRESET_MATERIALS,
  worldFloorTexturePath,
  resolveWorldFloorTextureUrl,
  createRepositoryWorldFloorTextureRuntime,
} from '../src/world/WorldFloorTextures.js';

assert.equal(worldFloorTexturePath('floor_grass_01'), 'Assets/Images/World/Floors/floor_grass_01.png');
assert.ok(resolveWorldFloorTextureUrl('floor_grass_01').endsWith('/Assets/Images/World/Floors/floor_grass_01.png'));
assert.equal(WORLD_FLOOR_MATERIAL_BINDINGS.forestGround, 'floor_grass_01');
assert.equal(WORLD_FLOOR_MATERIAL_BINDINGS.desertGround, 'floor_sand_01');
assert.equal(WORLD_FLOOR_MATERIAL_BINDINGS.swampGroundFX, 'floor_swamp_01');
assert.equal(WORLD_FLOOR_PRESET_MATERIALS.iceGround, 'floor_ice_01');
assert.equal(WORLD_FLOOR_PRESET_MATERIALS.caveGround, 'floor_cave_01');
assert.equal(WORLD_FLOOR_PRESET_MATERIALS.concreteFloor, 'floor_concrete_01');

class FakeRepeat {
  constructor(x=1,y=1){ this.x=x; this.y=y; }
  set(x,y){ this.x=x; this.y=y; return this; }
}
class FakeTexture {
  constructor(url=''){ this.url=url; this.repeat=new FakeRepeat(1,1); this.needsUpdate=false; }
  clone(){
    const next=new FakeTexture(this.url);
    next.repeat.set(this.repeat.x,this.repeat.y);
    return next;
  }
}
class FakeColor {
  constructor(){ this.hex=0; }
  setHex(hex){ this.hex=hex; }
}
class FakeMaterial {
  constructor(options={}){
    this.map=options.map||null;
    this.color=new FakeColor();
    this.userData={};
    this.needsUpdate=false;
    this.uuid='mat-'+FakeMaterial.serial++;
  }
}
FakeMaterial.serial=1;
class FakeTextureLoader {
  setCrossOrigin(){}
  load(url,onLoad){
    queueMicrotask(()=>onLoad(new FakeTexture(url)));
  }
}
const THREE={
  TextureLoader:FakeTextureLoader,
  MeshStandardMaterial:FakeMaterial,
  RepeatWrapping:'repeat',
  SRGBColorSpace:'srgb',
  LinearFilter:'linear',
  LinearMipmapLinearFilter:'mipmap',
};

const proceduralFallback=new FakeTexture('procedural');
proceduralFallback.repeat.set(.34,.34);
const mats={
  forestGround:new FakeMaterial({map:proceduralFallback}),
  forestPath:new FakeMaterial({map:new FakeTexture('procedural-path')}),
  desertGround:new FakeMaterial({map:new FakeTexture('procedural-desert')}),
  swampGround:new FakeMaterial({map:new FakeTexture('procedural-swamp')}),
  swampGroundFX:new FakeMaterial({map:new FakeTexture('procedural-swamp-fx')}),
  arcticGround:new FakeMaterial({map:new FakeTexture('procedural-arctic')}),
  floor:new FakeMaterial({map:new FakeTexture('procedural-floor')}),
};
const refreshed=[];
const runtime=createRepositoryWorldFloorTextureRuntime({
  THREE,
  mats,
  renderer:{capabilities:{getMaxAnisotropy:()=>4}},
  baseUrl:'https://example.test/game-engine/src/world/WorldFloorTextures.js',
  onMaterialTextureReady:(event)=>refreshed.push(event),
});

assert.equal(runtime.mode,'repository-local');
assert.equal(runtime.status('floor_grass_01').status,'idle');
assert.equal(mats.forestGround.userData.worldFloorTextureId,'floor_grass_01');
assert.equal(mats.floor.userData.worldFloorTextureId,'floor_wood_01');
assert.ok(mats.worldFloorById.floor_marble_01);
assert.ok(mats.concreteFloor);

await runtime.ensureMaterial(mats.forestGround);
assert.equal(runtime.status('floor_grass_01').status,'ready');
assert.equal(mats.forestGround.userData.worldFloorTextureState,'ready');
assert.ok(mats.forestGround.map.url.endsWith('/Assets/Images/World/Floors/floor_grass_01.png'));
assert.equal(mats.forestGround.map.repeat.x,.34,'existing UV repeat must survive hot swap');
assert.ok(refreshed.some((event)=>event.material===mats.forestGround), 'forest ground must refresh when local PNG is ready');

const dirtMaterial=runtime.materialForTerrain('dirt',{ensure:false});
assert.equal(dirtMaterial.userData.worldFloorTextureId,'floor_dirt_01');

const forestHtml=await fs.readFile(new URL('../lab/game/forest-0.3.3.1.html', import.meta.url),'utf8');
assert.match(forestHtml,/createRepositoryWorldFloorTextureRuntime/);
assert.match(forestHtml,/worldFloorTextureRuntime\?\.ensureMaterial\(material\)/);
assert.match(forestHtml,/worldFloorSourceMaterialUuid/);
assert.match(forestHtml,/WORLD FLOOR TEXTURES V1 · repository-local/);

console.log('game engine world floor textures smoke: ok');
