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
