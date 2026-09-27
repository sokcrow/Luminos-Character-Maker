import { createProceduralMapData } from "./ProceduralMapGenerator.js";
import { SeededRandom, seededUnit } from "./SeededRandom.js";

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,finite(v,a)));
const key=(x,z)=>x+","+z;

export const CRYSTAL_CAVE_CONTRACT_ID="luminous.crystal-cave-procedural.v1";
export const CRYSTAL_CAVE_PASTELS=Object.freeze([
  "#ffb8d8","#e6c1ff","#b9dcff","#bff3dd","#ffd3b8","#f7c6ff"
]);

function normalize(input={}){
  const bounds=input.bounds||{minX:-160,maxX:160,minZ:-160,maxZ:160};
  return Object.freeze({
    ...input,
    id:String(input.id||"crystal-cave-procedural"),
    kind:"procedural-interior-cave",
    seed:String(input.seed??"crystal-cave"),
    bounds,
    chunkSize:Math.max(12,finite(input.chunkSize,24)),
    activeRadius:Math.max(1,Math.floor(finite(input.activeRadius,2))),
    altitude:finite(input.altitude,0),
    scale:Math.max(.25,finite(input.scale,1)),
    moisture:clamp(input.moisture??.68,0,1),
    aridity:clamp(input.aridity??.18,0,1),
    hydrology:{type:String(input.hydrology?.type||"lake")},
    landform:{rolling:.34,hills:.48,ridges:.26,...(input.landform||{})},
    metadata:Object.freeze({
      authority:"map-module",
      generator:"CrystalCaveGenerator",
      contract:CRYSTAL_CAVE_CONTRACT_ID,
      interior:true,
      streaming:"nearby-chunks",
      ...(input.metadata||{})
    })
  });
}

function caveCell(spec,cx,cz){
  const rng=new SeededRandom(spec.seed+":cell:"+key(cx,cz));
  const spine=Math.round(Math.sin(cx*.72+seededUnit(spec.seed,3,7)*6.28)*1.6);
  const chamber=seededUnit(spec.seed+":chamber",cx,cz)>.78;
  const branch=seededUnit(spec.seed+":branch",cx,cz)>.70 && Math.abs(cz-spine)<=2;
  const open=Math.abs(cz-spine)<=1 || chamber || branch;
  const voidPit=open && seededUnit(spec.seed+":void",cx,cz)>.94 && Math.abs(cx)>1;
  const water=open && !voidPit && seededUnit(spec.seed+":water",cx,cz)>.83;
  const waterType=water && seededUnit(spec.seed+":water-type",cx,cz)>.55?"river":"pool";
  const crystalDensity=open&&!voidPit ? .18+rng.next()*.62 : 0;
  return Object.freeze({cx,cz,open,voidPit,water,waterType,chamber,branch,crystalDensity});
}

function crystals(spec,cell){
  if(!cell.open||cell.voidPit)return [];
  const rng=new SeededRandom(spec.seed+":crystals:"+key(cell.cx,cell.cz));
  const count=Math.floor(2+cell.crystalDensity*8);
  const half=spec.chunkSize*.46;
  const out=[];
  for(let i=0;i<count;i++){
    out.push(Object.freeze({
      id:key(cell.cx,cell.cz)+":crystal:"+i,
      x:cell.cx*spec.chunkSize+rng.range(-half,half),
      z:cell.cz*spec.chunkSize+rng.range(-half,half),
      scale:rng.range(.55,2.15),
      lean:rng.range(-.32,.32),
      color:CRYSTAL_CAVE_PASTELS[rng.integer(0,CRYSTAL_CAVE_PASTELS.length-1)]
    }));
  }
  return out;
}

export function createCrystalCaveData(input={}){
  const spec=normalize(input);
  const base=createProceduralMapData({
    ...spec,
    biome:"crystal-cave",
    biomeProfile:"interior-rock",
    surface:"cave-floor"
  });
  const cache=new Map();
  const getCell=(cx,cz)=>{
    const k=key(cx,cz);
    if(!cache.has(k))cache.set(k,caveCell(spec,cx,cz));
    return cache.get(k);
  };
  const chunkAt=(x,z)=>({cx:Math.floor(finite(x)/spec.chunkSize),cz:Math.floor(finite(z)/spec.chunkSize)});
  function chunksAround(point={},radius=spec.activeRadius){
    const c=chunkAt(point.x,point.z),out=[];
    for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
      const cell=getCell(c.cx+dx,c.cz+dz);
      out.push(Object.freeze({...cell,crystals:crystals(spec,cell)}));
    }
    return out;
  }
  function sampleTerrain(point={}){
    const c=chunkAt(point.x,point.z),cell=getCell(c.cx,c.cz);
    const baseSample=base.sampleTerrain(point);
    if(cell.voidPit)return {...baseSample,height:-18,surface:"void",walkable:false,moveMultiplier:0,cell};
    return {...baseSample,height:baseSample.height*.42,surface:cell.water?"wet-cave-floor":"cave-floor",walkable:cell.open,moveMultiplier:cell.open?baseSample.moveMultiplier:0,cell};
  }
  function sampleWater(point={}){
    const c=chunkAt(point.x,point.z),cell=getCell(c.cx,c.cz);
    if(!cell.water||cell.voidPit)return null;
    const terrain=sampleTerrain(point);
    return {bodyId:spec.id+":"+key(c.cx,c.cz),type:cell.waterType,class:"shallowWater",depth:cell.waterType==="river"?.55:.9,surface:terrain.height+.18,wetness:1,current:cell.waterType==="river"?{x:1,z:.15,strength:.65,label:"Corriente subterránea"}:null,source:"crystal-cave-module"};
  }
  function resolveMovement({from={},proposed={}}={}){
    const next={x:finite(proposed.x),y:finite(proposed.y),z:finite(proposed.z)};
    next.x=clamp(next.x,spec.bounds.minX,spec.bounds.maxX);next.z=clamp(next.z,spec.bounds.minZ,spec.bounds.maxZ);
    const terrain=sampleTerrain(next);
    if(!terrain.walkable)return {x:finite(from.x),y:finite(from.y),z:finite(from.z)};
    next.y=terrain.height;return next;
  }
  return Object.freeze({
    id:spec.id,seed:spec.seed,bounds:spec.bounds,metadata:spec.metadata,chunkSize:spec.chunkSize,activeRadius:spec.activeRadius,
    base,getCell,chunkAt,chunksAround,sampleTerrain,sampleWater,resolveMovement,update(){},
    snapshot(){return {id:spec.id,seed:spec.seed,kind:spec.kind,bounds:spec.bounds,chunkSize:spec.chunkSize,activeRadius:spec.activeRadius,metadata:{...spec.metadata}}}
  });
}

export function createCrystalCaveDefinition(input={}){
  const spec=normalize(input);
  return Object.freeze({
    id:spec.id,kind:spec.kind,seed:spec.seed,bounds:spec.bounds,metadata:spec.metadata,
    async generate(){return createCrystalCaveData(spec);}
  });
}


// -----------------------------------------------------------------------------
// Crystal Cave runtime topology v2
// Single authority for the Lab/Game Engine cave adapter. Coordinates are in map
// tiles so renderer, grid, terrain height field and water gameplay all sample the
// same deterministic data instead of rebuilding their own copy of the cave.
// -----------------------------------------------------------------------------
export function crystalCaveSeedUnit(seed,a=0,b=0,c=0){
  const str=String(seed)+"|"+a+"|"+b+"|"+c;
  let h=2166136261>>>0;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  h^=h>>>16;h=Math.imul(h,0x7feb352d)>>>0;h^=h>>>15;h=Math.imul(h,0x846ca68b)>>>0;h^=h>>>16;
  return (h>>>0)/4294967295;
}

function caveSmooth01(value){
  const t=clamp(value,0,1);
  return t*t*(3-2*t);
}

function cavePointSegmentDistance(px,pz,a,b){
  const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz||1;
  const t=clamp(((px-a.x)*dx+(pz-a.z)*dz)/den,0,1);
  const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
  return {distance:Math.hypot(px-x,pz-z),t,x,z};
}

export function createCrystalCaveRuntimeData(input={}){
  const seed=String(input.seed??"crystal-cave");
  const bounds=Object.freeze({
    x0:finite(input.bounds?.x0,-24),x1:finite(input.bounds?.x1,24),
    z0:finite(input.bounds?.z0,-24),z1:finite(input.bounds?.z1,24)
  });
  const route=[];
  const phase=crystalCaveSeedUnit(seed,7,11)*Math.PI*2;
  let x=(crystalCaveSeedUnit(seed,1,2)-.5)*2;
  const routeCount=Math.max(12,Math.floor(finite(input.routeCount,23)));
  const zStart=bounds.z0+3,zEnd=bounds.z1-3;
  for(let i=0;i<routeCount;i++){
    const t=i/Math.max(1,routeCount-1),z=zStart+(zEnd-zStart)*t;
    const drift=Math.sin(i*.50+phase)*4.4+(crystalCaveSeedUnit(seed,i,31)-.5)*3.0;
    x=x+(clamp(drift,-8.2,8.2)-x)*.48;
    const width=2.35+crystalCaveSeedUnit(seed,i,47)*1.75;
    route.push(Object.freeze({x,z,width}));
  }

  const chamberIndices=[.27,.54,.81].map(t=>Math.max(1,Math.min(route.length-2,Math.round((route.length-1)*t))));
  const chambers=chamberIndices.map((idx,n)=>{
    const p=route[idx],side=crystalCaveSeedUnit(seed,n,71)>.5?1:-1;
    return Object.freeze({
      x:clamp(p.x+side*(1+crystalCaveSeedUnit(seed,n,73)*1.8),bounds.x0+6,bounds.x1-6),
      z:p.z+(crystalCaveSeedUnit(seed,n,79)-.5)*1.6,
      rx:3.8+crystalCaveSeedUnit(seed,n,83)*1.9,
      rz:3.4+crystalCaveSeedUnit(seed,n,89)*1.7
    });
  });

  const contains=(tx,tz,margin=0)=>{
    if(tx<bounds.x0+1||tx>bounds.x1-1||tz<bounds.z0+1||tz>bounds.z1-1)return false;
    let best=Infinity,allowed=0;
    for(let i=0;i<route.length-1;i++){
      const d=cavePointSegmentDistance(tx,tz,route[i],route[i+1]);
      if(d.distance<best){best=d.distance;allowed=route[i].width+(route[i+1].width-route[i].width)*d.t;}
    }
    if(best<=Math.max(.72,allowed-margin))return true;
    for(const c of chambers){
      const rx=Math.max(.05,c.rx-margin),rz=Math.max(.05,c.rz-margin);
      if(Math.hypot((tx-c.x)/rx,(tz-c.z)/rz)<=1)return true;
    }
    return false;
  };

  const waterChamber=chambers[1];
  const water=Object.freeze({
    kind:"lake",
    cx:waterChamber.x+.25,cz:waterChamber.z+.15,
    rx:Math.max(2.3,waterChamber.rx*.62),rz:Math.max(1.95,waterChamber.rz*.55),
    surfaceTiles:finite(input.water?.surfaceTiles,-.18),
    maxDepthTiles:Math.max(.48,finite(input.water?.maxDepthTiles,.92)),
    shoreDepthTiles:Math.max(.015,finite(input.water?.shoreDepthTiles,.035)),
    bankOuterRatio:Math.max(1.08,finite(input.water?.bankOuterRatio,1.30))
  });

  const waterQ=(tx,tz)=>Math.hypot((tx-water.cx)/water.rx,(tz-water.cz)/water.rz);
  const inWater=(tx,tz)=>contains(tx,tz,.10)&&waterQ(tx,tz)<=1;

  const naturalFloorHeightTilesAt=(tx,tz)=>{
    const n1=Math.sin(tx*.48+phase)*Math.cos(tz*.37-phase*.7);
    const n2=Math.sin((tx+tz)*.23+phase*1.3);
    let h=n1*.085+n2*.055;
    for(const c of chambers){
      const q=Math.hypot((tx-c.x)/c.rx,(tz-c.z)/c.rz);
      if(q<1)h-=Math.cos(q*Math.PI*.5)*.055;
    }
    return h;
  };

  const floorHeightTilesAt=(tx,tz)=>{
    let h=naturalFloorHeightTilesAt(tx,tz);
    const q=waterQ(tx,tz);
    if(q<water.bankOuterRatio){
      const bank=caveSmooth01((water.bankOuterRatio-q)/(water.bankOuterRatio-1));
      const shoreFloor=water.surfaceTiles-water.shoreDepthTiles;
      h=h+(shoreFloor-h)*bank;
      if(q<1){
        const inward=caveSmooth01((1-q)/.72);
        const depth=water.shoreDepthTiles+(water.maxDepthTiles-water.shoreDepthTiles)*inward;
        h=water.surfaceTiles-depth;
      }
    }
    return h;
  };

  const sampleWater=(point={})=>{
    const tx=finite(point.x),tz=finite(point.z);
    if(!inWater(tx,tz))return null;
    const ground=floorHeightTilesAt(tx,tz);
    const depth=Math.max(.01,water.surfaceTiles-ground);
    return Object.freeze({
      bodyId:"crystal-cave-underground-lake",
      type:"lake",
      class:depth>=1.25?"deepWater":"shallowWater",
      depth,
      surface:water.surfaceTiles,
      ground,
      wetness:1,
      current:null,
      source:"crystal-cave-runtime-field"
    });
  };

  const sampleTerrain=(point={})=>{
    const tx=finite(point.x),tz=finite(point.z);
    const walkable=contains(tx,tz);
    const waterSample=sampleWater({x:tx,z:tz});
    return Object.freeze({
      height:floorHeightTilesAt(tx,tz),
      surface:waterSample?"wet-cave-floor":"cave-floor",
      walkable,
      moveMultiplier:walkable?1:0,
      water:waterSample
    });
  };

  const surfaces=[];
  const appendRuns=(predicate,make)=>{
    for(let z=Math.floor(bounds.z0);z<Math.ceil(bounds.z1);z++){
      let run=null;
      for(let x=Math.floor(bounds.x0);x<=Math.ceil(bounds.x1);x++){
        const on=x<Math.ceil(bounds.x1)&&predicate(x+.5,z+.5);
        if(on&&run===null)run=x;
        if((!on||x===Math.ceil(bounds.x1))&&run!==null){
          surfaces.push(make(run,x,z));run=null;
        }
      }
    }
  };
  appendRuns((tx,tz)=>contains(tx,tz),(x0,x1,z)=>Object.freeze({
    id:"crystal-cave-ground-"+z+"-"+x0,layer:"exterior",x0,x1,z0:z,z1:z+1,
    elevation:0,terrain:"stone",walkable:true,combat:true,
    tags:["cave","crystal-cave","ground","procedural-interior"]
  }));
  appendRuns((tx,tz)=>inWater(tx,tz),(x0,x1,z)=>Object.freeze({
    id:"crystal-cave-water-"+z+"-"+x0,layer:"exterior",x0,x1,z0:z,z1:z+1,
    elevation:water.surfaceTiles,terrain:"water",walkable:true,combat:false,locomotion:"swim",
    moveMultiplier:.56,
    tags:["cave","crystal-cave","water","swim","underground-lake"]
  }));

  const spawnRoute=route[1],exitRoute=route[route.length-2];
  return Object.freeze({
    id:"crystalCave",seed,bounds,
    metadata:Object.freeze({
      authority:"map-module",
      generator:"CrystalCaveGenerator",
      contract:"luminous.crystal-cave-runtime.v2",
      topology:"route+chambers",
      terrain:"continuous-height-field",
      hydrology:"continuous-depth-field"
    }),
    route:Object.freeze(route),chambers:Object.freeze(chambers),water,
    contains,inWater,waterQ,naturalFloorHeightTilesAt,floorHeightTilesAt,
    sampleTerrain,sampleWater,
    surfaces:Object.freeze(surfaces),
    spawn:Object.freeze({x:spawnRoute.x,y:0,z:spawnRoute.z,layer:"exterior"}),
    exit:Object.freeze({x:exitRoute.x,z:exitRoute.z})
  });
}
