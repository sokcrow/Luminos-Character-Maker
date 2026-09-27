import { createProceduralMapData } from "./ProceduralMapGenerator.js";
import { SeededRandom, seededUnit } from "./SeededRandom.js";

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,finite(v,a)));
const key=(x,z)=>x+","+z;
const smooth01=v=>{const t=clamp(v,0,1);return t*t*(3-2*t)};

export const CRYSTAL_CAVE_CONTRACT_ID="luminous.crystal-cave-procedural.v2";
export const CRYSTAL_CAVE_PASTELS=Object.freeze([
  "#ffb8d8","#e6c1ff","#b9dcff","#bff3dd","#ffd3b8","#f7c6ff"
]);

function normalizeBounds(bounds={}){
  if("x0" in bounds||"x1" in bounds||"z0" in bounds||"z1" in bounds){
    const x0=finite(bounds.x0,-24),x1=finite(bounds.x1,24),z0=finite(bounds.z0,-24),z1=finite(bounds.z1,24);
    return Object.freeze({x0:Math.min(x0,x1),x1:Math.max(x0,x1),z0:Math.min(z0,z1),z1:Math.max(z0,z1)});
  }
  const minX=finite(bounds.minX,-24),maxX=finite(bounds.maxX,24),minZ=finite(bounds.minZ,-24),maxZ=finite(bounds.maxZ,24);
  return Object.freeze({x0:Math.min(minX,maxX),x1:Math.max(minX,maxX),z0:Math.min(minZ,maxZ),z1:Math.max(minZ,maxZ)});
}

function normalize(input={}){
  const bounds=normalizeBounds(input.bounds||{x0:-24,x1:24,z0:-24,z1:24});
  return Object.freeze({
    ...input,
    id:String(input.id||"crystalCave"),
    kind:"procedural-interior-cave",
    seed:String(input.seed??"crystal-cave"),
    bounds,
    chunkSize:Math.max(8,finite(input.chunkSize,8)),
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
      terrainAuthority:"shared-height-field",
      hydrologyAuthority:"shared-bathymetry",
      ...(input.metadata||{})
    })
  });
}

function pointSegmentDistance(px,pz,a,b){
  const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz||1;
  const t=clamp(((px-a.x)*dx+(pz-a.z)*dz)/den,0,1);
  const x=a.x+dx*t,z=a.z+dz*t;
  return {distance:Math.hypot(px-x,pz-z),t,x,z};
}

function makeRoute(spec){
  const {bounds}=spec,route=[];
  const phase=seededUnit(spec.seed,7,11)*Math.PI*2;
  const spanZ=bounds.z1-bounds.z0;
  const count=Math.max(18,Math.round(spanZ/1.92));
  let x=(seededUnit(spec.seed,1,2)-.5)*2.0;
  for(let i=0;i<count;i++){
    const t=i/Math.max(1,count-1);
    const z=bounds.z0+3+t*(spanZ-6);
    const drift=Math.sin(i*.50+phase)*4.4+(seededUnit(spec.seed,i,31)-.5)*3.0;
    x=x+(clamp(drift,bounds.x0+7,bounds.x1-7)-x)*.48;
    const width=2.35+seededUnit(spec.seed,i,47)*1.75;
    route.push(Object.freeze({x,z,width}));
  }
  return Object.freeze(route);
}

function makeChambers(spec,route){
  const picks=[.28,.53,.78];
  return Object.freeze(picks.map((ratio,n)=>{
    const idx=Math.max(1,Math.min(route.length-2,Math.round((route.length-1)*ratio)));
    const p=route[idx],side=seededUnit(spec.seed,n,71)>.5?1:-1;
    return Object.freeze({
      x:clamp(p.x+side*(1.0+seededUnit(spec.seed,n,73)*1.8),spec.bounds.x0+6,spec.bounds.x1-6),
      z:p.z+(seededUnit(spec.seed,n,79)-.5)*1.6,
      rx:3.8+seededUnit(spec.seed,n,83)*1.9,
      rz:3.4+seededUnit(spec.seed,n,89)*1.7
    });
  }));
}

function caveContains(spec,route,chambers,tx,tz,margin=0){
  const b=spec.bounds;
  if(tx<b.x0+1||tx>b.x1-1||tz<b.z0+1||tz>b.z1-1)return false;
  let best=Infinity,allowed=.72;
  for(let i=0;i<route.length-1;i++){
    const d=pointSegmentDistance(tx,tz,route[i],route[i+1]);
    if(d.distance<best){best=d.distance;allowed=route[i].width+(route[i+1].width-route[i].width)*d.t;}
  }
  if(best<=Math.max(.72,allowed-margin))return true;
  for(const c of chambers){
    const rx=Math.max(.25,c.rx-margin),rz=Math.max(.25,c.rz-margin);
    if(Math.hypot((tx-c.x)/rx,(tz-c.z)/rz)<=1)return true;
  }
  return false;
}

function buildSurfaceRuns(spec,contains,inWater,waterSurfaceTiles){
  const out=[];
  const append=(predicate,make)=>{
    for(let z=Math.floor(spec.bounds.z0);z<Math.ceil(spec.bounds.z1);z++){
      let run=null;
      for(let x=Math.floor(spec.bounds.x0);x<=Math.ceil(spec.bounds.x1);x++){
        const on=x<Math.ceil(spec.bounds.x1)&&predicate(x+.5,z+.5);
        if(on&&run===null)run=x;
        if((!on||x===Math.ceil(spec.bounds.x1))&&run!==null){
          out.push(make(run,x,z));run=null;
        }
      }
    }
  };
  append((x,z)=>contains(x,z),(x0,x1,z)=>Object.freeze({
    id:`crystal-cave-ground-${z}-${x0}`,layer:"exterior",x0,x1,z0:z,z1:z+1,
    elevation:0,terrain:"stone",walkable:true,combat:true,
    tags:["cave","crystal-cave","ground","procedural-interior"]
  }));
  append((x,z)=>inWater(x,z),(x0,x1,z)=>Object.freeze({
    id:`crystal-cave-water-${z}-${x0}`,layer:"exterior",x0,x1,z0:z,z1:z+1,
    elevation:waterSurfaceTiles,terrain:"water",walkable:true,combat:false,locomotion:"swim",
    moveMultiplier:.56,
    tags:["cave","crystal-cave","water","swim","underground-lake"]
  }));
  return Object.freeze(out);
}

function crystalFormations(spec,chambers,contains,inWater){
  const out=[];
  chambers.forEach((c,ci)=>{
    const rng=new SeededRandom(spec.seed+":crystals:"+ci);
    for(let k=0;k<3;k++){
      const a=(k/3)*Math.PI*2+rng.range(-.25,.45);
      const rr=Math.min(c.rx,c.rz)*(.58+.08*k);
      const x=c.x+Math.cos(a)*rr,z=c.z+Math.sin(a)*rr;
      if(!contains(x,z,.35)||inWater(x,z))continue;
      out.push(Object.freeze({
        id:`chamber-${ci}-crystal-${k}`,x,z,
        scale:rng.range(.55,1.10),lean:rng.range(-.24,.24),
        color:CRYSTAL_CAVE_PASTELS[(ci+k)%CRYSTAL_CAVE_PASTELS.length]
      }));
    }
  });
  return Object.freeze(out);
}

export function createCrystalCaveData(input={}){
  const spec=normalize(input);
  const base=createProceduralMapData({
    id:spec.id,kind:spec.kind,seed:spec.seed,
    bounds:{minX:spec.bounds.x0,maxX:spec.bounds.x1,minZ:spec.bounds.z0,maxZ:spec.bounds.z1},
    altitude:spec.altitude,scale:spec.scale,moisture:spec.moisture,aridity:spec.aridity,
    hydrology:{type:"none"},landform:spec.landform,
    biome:"crystal-cave",biomeProfile:"interior-rock",surface:"cave-floor",
    metadata:spec.metadata
  });
  const route=makeRoute(spec);
  const chambers=makeChambers(spec,route);
  const contains=(tx,tz,margin=0)=>caveContains(spec,route,chambers,finite(tx),finite(tz),Math.max(0,finite(margin)));
  const wc=chambers[1];
  const water=Object.freeze({
    kind:"lake",
    cx:wc.x+.25,cz:wc.z+.15,
    rx:Math.max(2.0,wc.rx*.58),rz:Math.max(1.65,wc.rz*.50),
    surfaceTiles:finite(input.waterSurfaceTiles,-.18),
    maxDepthTiles:Math.max(.32,finite(input.maxWaterDepthTiles,.82)),
    bankWidth:Math.max(.12,finite(input.waterBankWidth,.22))
  });
  const waterQ=(tx,tz)=>Math.hypot((finite(tx)-water.cx)/water.rx,(finite(tz)-water.cz)/water.rz);
  const inWater=(tx,tz)=>contains(tx,tz,.16)&&waterQ(tx,tz)<=1;

  function dryRockHeight(tx,tz){
    const phase=seededUnit(spec.seed,7,11)*Math.PI*2;
    const n1=Math.sin(tx*.48+phase)*Math.cos(tz*.37-phase*.7);
    const n2=Math.sin((tx+tz)*.23+phase*1.3);
    let h=n1*.085+n2*.055;
    for(const c of chambers){
      const q=Math.hypot((tx-c.x)/c.rx,(tz-c.z)/c.rz);
      if(q<1)h-=Math.cos(q*Math.PI*.5)*.055;
    }
    return h;
  }

  function floorHeightTilesAt(tx,tz){
    tx=finite(tx);tz=finite(tz);
    const dry=dryRockHeight(tx,tz),q=waterQ(tx,tz);
    if(q>=1+water.bankWidth)return dry;

    // Shore grade: the same field used by mesh + physics descends smoothly toward
    // the waterline before swimming begins, so there is no hidden step at q=1.
    if(q>=1){
      const t=smooth01((1+water.bankWidth-q)/water.bankWidth);
      const shorelineTarget=water.surfaceTiles-.025;
      return dry+(shorelineTarget-dry)*t;
    }

    // Bathymetry: depth is derived from the rendered floor itself.
    // At the edge the floor is only 0.025 tile under the surface; toward the center
    // it approaches maxDepthTiles. There is no separate legacy depth constant.
    const center=smooth01((1-q)/.78);
    const depth=.025+(water.maxDepthTiles-.025)*center;
    return water.surfaceTiles-depth;
  }

  function sampleWater(point={}){
    const tx=finite(point.x),tz=finite(point.z);
    if(!inWater(tx,tz))return null;
    const ground=floorHeightTilesAt(tx,tz);
    const depth=Math.max(.001,water.surfaceTiles-ground);
    return Object.freeze({
      bodyId:spec.id+":underground-lake",
      type:"lake",class:depth>=.72?"deepWater":(depth>=.28?"water":"shallowWater"),
      depth,surface:water.surfaceTiles,ground,
      wetness:1,current:null,source:"crystal-cave-shared-bathymetry"
    });
  }

  function sampleTerrain(point={}){
    const tx=finite(point.x),tz=finite(point.z);
    const open=contains(tx,tz),height=floorHeightTilesAt(tx,tz),waterSample=sampleWater({x:tx,z:tz});
    return Object.freeze({
      ...base.sampleTerrain({x:tx,y:finite(point.y),z:tz}),
      height,surface:waterSample?"wet-cave-floor":"cave-floor",
      walkable:open,moveMultiplier:open?1:0,water:waterSample,
      tags:waterSample?["cave","crystal-cave","water"]:["cave","crystal-cave","ground"]
    });
  }

  const surfaces=buildSurfaceRuns(spec,contains,inWater,water.surfaceTiles);
  const formations=crystalFormations(spec,chambers,contains,inWater);
  const spawnRoute=route[1],exitRoute=route[route.length-2];

  function chunkAt(x,z){
    return {cx:Math.floor((finite(x)-spec.bounds.x0)/spec.chunkSize),cz:Math.floor((finite(z)-spec.bounds.z0)/spec.chunkSize)};
  }
  function chunksAround(point={},radius=spec.activeRadius){
    const center=chunkAt(point.x,point.z),out=[];
    for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
      const x0=spec.bounds.x0+(center.cx+dx)*spec.chunkSize;
      const z0=spec.bounds.z0+(center.cz+dz)*spec.chunkSize;
      out.push(Object.freeze({
        cx:center.cx+dx,cz:center.cz+dz,x0,z0,x1:x0+spec.chunkSize,z1:z0+spec.chunkSize,
        active:!(x0>=spec.bounds.x1||z0>=spec.bounds.z1||x0+spec.chunkSize<=spec.bounds.x0||z0+spec.chunkSize<=spec.bounds.z0)
      }));
    }
    return out;
  }

  return Object.freeze({
    id:spec.id,kind:spec.kind,seed:spec.seed,bounds:spec.bounds,metadata:spec.metadata,
    chunkSize:spec.chunkSize,activeRadius:spec.activeRadius,base,
    route,chambers,water,formations,surfaces,
    contains,inWater,waterQ,floorHeightTilesAt,sampleTerrain,sampleWater,
    chunkAt,chunksAround,
    spawn:Object.freeze({x:spawnRoute.x,y:0,z:spawnRoute.z,layer:"exterior"}),
    exit:Object.freeze({x:exitRoute.x,z:exitRoute.z}),
    snapshot(){return {
      id:spec.id,seed:spec.seed,kind:spec.kind,bounds:spec.bounds,
      chunkSize:spec.chunkSize,activeRadius:spec.activeRadius,
      water:{...water},metadata:{...spec.metadata}
    }}
  });
}

export function createCrystalCaveDefinition(input={}){
  const spec=normalize(input);
  return Object.freeze({
    id:spec.id,kind:spec.kind,seed:spec.seed,
    bounds:{minX:spec.bounds.x0,maxX:spec.bounds.x1,minZ:spec.bounds.z0,maxZ:spec.bounds.z1},
    metadata:spec.metadata,
    async generate(){return createCrystalCaveData(spec);}
  });
}
