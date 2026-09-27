import { SeededRandom, seededUnit } from "./SeededRandom.js";

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,finite(v,a)));
const smooth01=(v)=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
const key=(x,z)=>x+","+z;

export const CRYSTAL_CAVE_CONTRACT_ID="luminous.crystal-cave-procedural.v2";
export const CRYSTAL_CAVE_WATER_VISUAL=Object.freeze({
  color:0x3278de,
  opacity:1,
  patternMask:Object.freeze({
    enabled:true,
    backgroundColor:0x3278de,
    waterColor:0xffffff,
    low:.14,
    high:.76
  })
});
export const CRYSTAL_CAVE_PASTELS=Object.freeze([
  "#ffb8d8","#e6c1ff","#b9dcff","#bff3dd","#ffd3b8","#f7c6ff"
]);

function normalize(input={}){
  const source=input.bounds||{};
  const minX=finite(source.minX??source.x0,-24),maxX=finite(source.maxX??source.x1,24);
  const minZ=finite(source.minZ??source.z0,-24),maxZ=finite(source.maxZ??source.z1,24);
  return Object.freeze({
    ...input,
    id:String(input.id||"crystalCave"),
    kind:"procedural-interior-cave",
    seed:String(input.seed??"crystal-cave"),
    bounds:Object.freeze({
      minX:Math.min(minX,maxX),maxX:Math.max(minX,maxX),
      minZ:Math.min(minZ,maxZ),maxZ:Math.max(minZ,maxZ)
    }),
    routePoints:Math.max(15,Math.floor(finite(input.routePoints,23))),
    tunnelMinWidth:Math.max(1.8,finite(input.tunnelMinWidth,2.35)),
    tunnelWidthVariance:Math.max(.2,finite(input.tunnelWidthVariance,1.75)),
    chamberCount:Math.max(2,Math.floor(finite(input.chamberCount,3))),
    waterSurfaceTiles:finite(input.waterSurfaceTiles,-.18),
    waterDepthTiles:Math.max(.35,finite(input.waterDepthTiles,.82)),
    metadata:Object.freeze({
      authority:"map-module",
      generator:"CrystalCaveGenerator",
      contract:CRYSTAL_CAVE_CONTRACT_ID,
      interior:true,
      naturalExploration:true,
      hydrologyAuthority:"terrain-water-shared-field",
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
  const route=[];
  const phase=seededUnit(spec.seed,7,11)*Math.PI*2;
  let x=(seededUnit(spec.seed,1,2)-.5)*2;
  const span=spec.bounds.maxZ-spec.bounds.minZ;
  const margin=Math.max(3,span*.065);
  const z0=spec.bounds.minZ+margin,z1=spec.bounds.maxZ-margin;
  for(let i=0;i<spec.routePoints;i++){
    const t=i/Math.max(1,spec.routePoints-1);
    const z=z0+(z1-z0)*t;
    const drift=Math.sin(i*.50+phase)*4.4+(seededUnit(spec.seed,i,31)-.5)*3.0;
    x=x+(clamp(drift,-8.2,8.2)-x)*.48;
    const width=spec.tunnelMinWidth+seededUnit(spec.seed,i,47)*spec.tunnelWidthVariance;
    route.push(Object.freeze({x,z,width}));
  }
  return Object.freeze(route);
}

function makeChambers(spec,route){
  const out=[];
  for(let n=0;n<spec.chamberCount;n++){
    const idx=Math.round((n+1)/(spec.chamberCount+1)*(route.length-1));
    const p=route[idx],side=seededUnit(spec.seed,n,71)>.5?1:-1;
    out.push(Object.freeze({
      x:clamp(p.x+side*(1+seededUnit(spec.seed,n,73)*1.8),spec.bounds.minX+6,spec.bounds.maxX-6),
      z:p.z+(seededUnit(spec.seed,n,79)-.5)*1.6,
      rx:3.8+seededUnit(spec.seed,n,83)*1.9,
      rz:3.4+seededUnit(spec.seed,n,89)*1.7
    }));
  }
  return Object.freeze(out);
}

function makeCrystals(spec,chambers,contains,isWater){
  const out=[];
  chambers.forEach((c,ci)=>{
    const rng=new SeededRandom(spec.seed+":crystals:"+ci);
    for(let k=0;k<3;k++){
      const a=(k/3)*Math.PI*2+rng.range(-.35,.35);
      const rr=Math.min(c.rx,c.rz)*(.58+.08*k);
      const x=c.x+Math.cos(a)*rr,z=c.z+Math.sin(a)*rr;
      if(!contains(x,z,.35)||isWater(x,z))continue;
      out.push(Object.freeze({
        id:key(ci,k),x,z,
        scale:.55+rng.next()*.55,
        lean:rng.range(-.26,.26),
        color:CRYSTAL_CAVE_PASTELS[(ci+k)%CRYSTAL_CAVE_PASTELS.length]
      }));
    }
  });
  return Object.freeze(out);
}

export function createCrystalCaveData(input={}){
  const spec=normalize(input);
  const route=makeRoute(spec);
  const chambers=makeChambers(spec,route);
  const waterChamber=chambers[Math.floor(chambers.length/2)]||chambers[0];
  const water=Object.freeze({
    kind:"lake",
    cx:waterChamber.x+.25,
    cz:waterChamber.z+.15,
    rx:Math.max(2,waterChamber.rx*.58),
    rz:Math.max(1.65,waterChamber.rz*.50),
    surfaceTiles:spec.waterSurfaceTiles,
    maxDepthTiles:spec.waterDepthTiles
  });

  const contains=(tx,tz,margin=0)=>{
    const b=spec.bounds;
    if(tx<b.minX+1||tx>b.maxX-1||tz<b.minZ+1||tz>b.maxZ-1)return false;
    let best=Infinity,allowed=0;
    for(let i=0;i<route.length-1;i++){
      const d=pointSegmentDistance(tx,tz,route[i],route[i+1]);
      if(d.distance<best){best=d.distance;allowed=route[i].width+(route[i+1].width-route[i].width)*d.t;}
    }
    if(best<=Math.max(.72,allowed-margin))return true;
    for(const c of chambers){
      const rx=Math.max(.2,c.rx-margin),rz=Math.max(.2,c.rz-margin);
      if(Math.hypot((tx-c.x)/rx,(tz-c.z)/rz)<=1)return true;
    }
    return false;
  };

  const waterQ=(tx,tz)=>Math.hypot((tx-water.cx)/water.rx,(tz-water.cz)/water.rz);
  const isWater=(tx,tz)=>contains(tx,tz,.18)&&waterQ(tx,tz)<1;

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
    const dry=dryRockHeight(tx,tz);
    const q=waterQ(tx,tz);
    if(q>=1.18)return dry;

    // One shared hydrology field owns both the visible basin and gameplay depth.
    // Outside the waterline the bank grades from dry rock to the exact water surface.
    if(q>=1){
      const bankT=smooth01((1.18-q)/.18);
      return dry+(water.surfaceTiles-dry)*bankT;
    }

    // Inside the waterline the bed starts exactly at the water surface and deepens
    // continuously. No hidden step, fixed legacy depth or second collision surface.
    const depthT=smooth01((1-q)/.78);
    const centerNoise=(dry*.20)*(1-depthT);
    return water.surfaceTiles-water.maxDepthTiles*depthT+centerNoise;
  }

  function sampleWater(point={}){
    const tx=finite(point.x),tz=finite(point.z);
    if(!isWater(tx,tz))return null;
    const ground=floorHeightTilesAt(tx,tz);
    const depth=Math.max(.001,water.surfaceTiles-ground);
    return Object.freeze({
      bodyId:spec.id+":lake",
      type:"lake",
      class:depth>.72?"deepWater":(depth>.28?"water":"shallowWater"),
      depth,
      waterDepth:depth,
      surface:water.surfaceTiles,
      waterSurfaceTiles:water.surfaceTiles,
      groundHeightTiles:ground,
      wetness:1,
      current:null,
      source:"crystal-cave-shared-hydrology"
    });
  }

  function sampleTerrain(point={}){
    const tx=finite(point.x),tz=finite(point.z);
    const open=contains(tx,tz);
    const height=floorHeightTilesAt(tx,tz);
    const waterSample=sampleWater({x:tx,z:tz});
    return Object.freeze({
      height,
      surface:waterSample?"wet-cave-floor":"cave-floor",
      walkable:open,
      moveMultiplier:open?1:0,
      water:waterSample,
      tags:open?["cave","crystal-cave","ground"]:["void"],
      locomotion:waterSample?"swim":"ground"
    });
  }

  const surfaces=[];
  const b=spec.bounds;
  const appendRuns=(predicate,make)=>{
    for(let z=Math.floor(b.minZ);z<Math.ceil(b.maxZ);z++){
      let run=null;
      for(let x=Math.floor(b.minX);x<=Math.ceil(b.maxX);x++){
        const on=x<Math.ceil(b.maxX)&&predicate(x+.5,z+.5);
        if(on&&run===null)run=x;
        if((!on||x===Math.ceil(b.maxX))&&run!==null){
          surfaces.push(Object.freeze(make(run,x,z)));run=null;
        }
      }
    }
  };
  appendRuns((x,z)=>contains(x,z),(x0,x1,z)=>({
    id:`crystal-cave-ground-${z}-${x0}`,layer:"exterior",x0,x1,z0:z,z1:z+1,
    elevation:0,terrain:"stone",walkable:true,combat:true,
    tags:["cave","crystal-cave","ground","procedural-interior"]
  }));
  appendRuns((x,z)=>isWater(x,z),(x0,x1,z)=>({
    id:`crystal-cave-water-${z}-${x0}`,layer:"exterior",x0,x1,z0:z,z1:z+1,
    elevation:water.surfaceTiles,terrain:"water",walkable:true,combat:false,
    locomotion:"swim",moveMultiplier:.56,
    tags:["cave","crystal-cave","water","swim","underground-lake"]
  }));

  const crystals=makeCrystals(spec,chambers,contains,isWater);
  const spawnRoute=route[1],exitRoute=route[route.length-2];

  return Object.freeze({
    id:spec.id,seed:spec.seed,kind:spec.kind,
    metadata:spec.metadata,bounds:spec.bounds,
    route,chambers,water,crystals,
    contains,isWater,waterQ,floorHeightTilesAt,
    sampleTerrain,sampleWater,
    surfaces:Object.freeze(surfaces),
    spawn:Object.freeze({x:spawnRoute.x,y:0,z:spawnRoute.z,layer:"exterior"}),
    exit:Object.freeze({x:exitRoute.x,z:exitRoute.z}),
    update(){},
    snapshot(){
      return {
        id:spec.id,seed:spec.seed,kind:spec.kind,bounds:{...spec.bounds},
        water:{...water},metadata:{...spec.metadata}
      };
    }
  });
}

export function createCrystalCaveDefinition(input={}){
  const spec=normalize(input);
  return Object.freeze({
    id:spec.id,kind:spec.kind,seed:spec.seed,bounds:spec.bounds,metadata:spec.metadata,
    async generate(){return createCrystalCaveData(spec);}
  });
}
