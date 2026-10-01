import { createProceduralMapData } from "./ProceduralMapGenerator.js";
import { seededUnit } from "./SeededRandom.js";

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,finite(v,a)));
const smooth01=v=>{const t=clamp(v,0,1);return t*t*(3-2*t)};

export const CRYSTAL_CAVE_CONTRACT_ID="luminous.crystal-cave-procedural.v2";
export const CRYSTAL_CAVE_PASTELS=Object.freeze([
  "#ffb8d8","#e6c1ff","#b9dcff","#bff3dd","#ffd3b8","#f7c6ff"
]);
export const CRYSTAL_CAVE_WATER_VISUAL=Object.freeze({
  color:0x3278de,
  opacity:1,
  patternMask:Object.freeze({enabled:true,backgroundColor:0x3278de})
});

export const CRYSTAL_CAVE_BLUEPRINT=Object.freeze({
  id:"mine-floor-1",
  label:"Piso 1 · Entrada de Mina",
  widthTiles:256,
  heightTiles:128,
  chunkSize:128,
  chunks:Object.freeze([
    Object.freeze({id:"mine-floor-1:chunk-a",cx:0,cz:0,x0:0,x1:128,z0:0,z1:128,label:"Entrada e instalaciones"}),
    Object.freeze({id:"mine-floor-1:chunk-b",cx:1,cz:0,x0:128,x1:256,z0:0,z1:128,label:"Cristales, jefe y descenso"})
  ])
});

const BLUEPRINT_ROOMS=Object.freeze([
  Object.freeze({id:"vestibule",label:"Vestíbulo de mina",shape:"rect",cx:40,cz:103,hx:25,hz:11,kind:"facility"}),
  Object.freeze({id:"camp",label:"Campamento minero abandonado",shape:"ellipse",cx:31,cz:76,rx:18,rz:15,kind:"safe"}),
  Object.freeze({id:"supply",label:"Almacén de suministros",shape:"rect",cx:24,cz:38,hx:14,hz:12,kind:"facility"}),
  Object.freeze({id:"tools",label:"Depósito de herramientas",shape:"rect",cx:58,cz:41,hx:14,hz:10,kind:"facility"}),
  Object.freeze({id:"infirmary",label:"Enfermería",shape:"rect",cx:66,cz:61,hx:12,hz:9,kind:"facility"}),
  Object.freeze({id:"control",label:"Sala de control",shape:"rect",cx:91,cz:79,hx:19,hz:10,kind:"facility"}),
  Object.freeze({id:"gallery",label:"Galería de extracción inicial",shape:"rect",cx:121,cz:61,hx:25,hz:9,kind:"facility"}),
  Object.freeze({id:"crystalNiche",label:"Nicho de cristal",shape:"ellipse",cx:132,cz:28,rx:24,rz:18,kind:"cave"}),
  Object.freeze({id:"lowerGrotto",label:"Galería secundaria inundada",shape:"ellipse",cx:179,cz:98,rx:20,rz:15,kind:"cave"}),
  Object.freeze({id:"boss",label:"Cámara del capataz corrompido",shape:"ellipse",cx:209,cz:33,rx:23,rz:20,kind:"boss"}),
  Object.freeze({id:"scavengers",label:"Galería de carroñeros",shape:"ellipse",cx:230,cz:72,rx:17,rz:18,kind:"cave"}),
  Object.freeze({id:"elevator",label:"Pozo de descenso / montacargas",shape:"rect",cx:237,cz:111,hx:12,hz:10,kind:"facility"})
]);

const BLUEPRINT_CORRIDORS=Object.freeze([
  // Ruta principal amarilla de la referencia.
  Object.freeze({id:"entrance-vestibule",a:{x:7,z:113},b:{x:26,z:105},width:7,route:"primary"}),
  Object.freeze({id:"vestibule-camp",a:{x:31,z:94},b:{x:31,z:88},width:8,route:"primary"}),
  Object.freeze({id:"camp-main-a",a:{x:34,z:72},b:{x:50,z:68},width:9,route:"primary"}),
  Object.freeze({id:"main-a-control",a:{x:50,z:68},b:{x:82,z:76},width:9,route:"primary"}),
  Object.freeze({id:"control-gallery",a:{x:104,z:74},b:{x:112,z:68},width:9,route:"primary"}),
  Object.freeze({id:"gallery-main",a:{x:112,z:63},b:{x:145,z:61},width:10,route:"primary"}),
  Object.freeze({id:"gallery-bridge",a:{x:145,z:61},b:{x:156,z:61},width:8,route:"primary"}),
  Object.freeze({id:"bridge-boss",a:{x:184,z:61},b:{x:195,z:49},width:8,route:"primary"}),
  Object.freeze({id:"boss-right",a:{x:226,z:45},b:{x:231,z:56},width:8,route:"primary"}),
  Object.freeze({id:"right-spine",a:{x:232,z:55},b:{x:234,z:101},width:9,route:"primary"}),
  Object.freeze({id:"right-elevator",a:{x:234,z:91},b:{x:237,z:102},width:8,route:"primary"}),

  // Instalaciones abandonadas / ramales bloqueados.
  Object.freeze({id:"camp-supply",a:{x:30,z:62},b:{x:27,z:50},width:7,route:"facility"}),
  Object.freeze({id:"supply-tools",a:{x:38,z:41},b:{x:44,z:41},width:7,route:"facility"}),
  Object.freeze({id:"tools-infirmary",a:{x:66,z:49},b:{x:66,z:52},width:7,route:"facility"}),
  Object.freeze({id:"infirmary-control",a:{x:75,z:66},b:{x:82,z:74},width:8,route:"facility"}),
  Object.freeze({id:"gallery-crystal",a:{x:128,z:52},b:{x:132,z:44},width:8,route:"secondary"}),

  // Ruta secundaria azul punteada de la referencia.
  Object.freeze({id:"gallery-lower",a:{x:143,z:69},b:{x:154,z:82},width:7,route:"secondary"}),
  Object.freeze({id:"lower-loop-a",a:{x:154,z:82},b:{x:164,z:94},width:8,route:"secondary"}),
  Object.freeze({id:"lower-loop-b",a:{x:164,z:94},b:{x:193,z:98},width:8,route:"secondary"}),
  Object.freeze({id:"lower-loop-c",a:{x:193,z:98},b:{x:210,z:90},width:8,route:"secondary"}),
  Object.freeze({id:"lower-loop-d",a:{x:210,z:90},b:{x:220,z:82},width:8,route:"secondary"})
]);

const BRIDGE=Object.freeze({id:"bridge",label:"Pasarela sobre grieta",shape:"rect",cx:170,cz:61,hx:15,hz:5,kind:"bridge"});
const CHASMS=Object.freeze([
  Object.freeze({id:"main-rift",label:"Grieta principal",cx:173,cz:75,rx:17,rz:22,depthTiles:5.5}),
  Object.freeze({id:"lower-rift",label:"Grieta cristalina",cx:184,cz:91,rx:13,rz:14,depthTiles:6.5})
]);
const ENTRANCE=Object.freeze({x:7,y:0,z:113,layer:"exterior"});
const ELEVATOR_EXIT=Object.freeze({x:237,z:111});

const LANDMARKS=Object.freeze([
  Object.freeze({id:"entrance",label:"Entrada exterior",x:7,z:113,kind:"transition"}),
  Object.freeze({id:"camp",label:"Campamento minero abandonado",x:31,z:76,kind:"safe"}),
  Object.freeze({id:"supply",label:"Almacén de suministros",x:24,z:38,kind:"loot"}),
  Object.freeze({id:"tools",label:"Depósito de herramientas",x:58,z:41,kind:"loot"}),
  Object.freeze({id:"infirmary",label:"Enfermería",x:66,z:61,kind:"medical"}),
  Object.freeze({id:"control",label:"Sala de control",x:91,z:79,kind:"control"}),
  Object.freeze({id:"crystal-niche",label:"Nicho de cristal",x:132,z:28,kind:"crystal"}),
  Object.freeze({id:"bridge",label:"Pasarela sobre grieta",x:170,z:61,kind:"bridge"}),
  Object.freeze({id:"boss",label:"Cámara del capataz corrompido",x:209,z:33,kind:"boss"}),
  Object.freeze({id:"scavengers",label:"Galería de carroñeros",x:230,z:72,kind:"encounter"}),
  Object.freeze({id:"elevator",label:"Pozo de descenso / montacargas",x:237,z:111,kind:"floor-transition"})
]);

const ENCOUNTERS=Object.freeze([
  Object.freeze({id:"miners-corrupted",label:"Mineros corrompidos",x:119,z:61,radius:9,tier:"standard"}),
  Object.freeze({id:"bats-niche",label:"Murciélagos",x:132,z:36,radius:8,tier:"standard"}),
  Object.freeze({id:"bats-lower",label:"Murciélagos",x:181,z:92,radius:9,tier:"standard"}),
  Object.freeze({id:"boss-foreman",label:"Capataz corrompido",x:209,z:33,radius:13,tier:"boss"}),
  Object.freeze({id:"scavengers",label:"Carroñeros",x:230,z:72,radius:11,tier:"standard"})
]);

const LOOT=Object.freeze([
  Object.freeze({id:"loot-supply",x:24,z:38,kind:"chest"}),
  Object.freeze({id:"loot-tools",x:58,z:41,kind:"chest"}),
  Object.freeze({id:"loot-control",x:91,z:79,kind:"chest"}),
  Object.freeze({id:"loot-crystal",x:132,z:28,kind:"chest"})
]);

const BLOCKED_DOORS=Object.freeze([
  Object.freeze({id:"door-supply-tools",x:41,z:41,axis:"x",span:5.6,label:"Puerta bloqueada · almacenes"}),
  Object.freeze({id:"door-infirmary-gallery",x:78,z:68,axis:"x",span:5.2,label:"Puerta bloqueada · enfermería"})
]);

// Props / dressing visibles tomados del croquis. No inventan loot ni reglas de combate:
// únicamente describen qué debe verse en cada sala.
const BLUEPRINT_DRESSING=Object.freeze([
  Object.freeze({id:"entry-support-a",type:"support",x:13,z:110,room:"vestibule"}),
  Object.freeze({id:"entry-support-b",type:"support",x:21,z:106,room:"vestibule"}),
  Object.freeze({id:"vestibule-rail-a",type:"rail",x:32,z:105,length:14,axis:"x",room:"vestibule"}),
  Object.freeze({id:"vestibule-crate-a",type:"crate",x:44,z:103,room:"vestibule"}),

  Object.freeze({id:"camp-fire",type:"campfire",x:31,z:76,room:"camp"}),
  Object.freeze({id:"camp-bed-a",type:"bedroll",x:24,z:78,rot:-.20,room:"camp"}),
  Object.freeze({id:"camp-bed-b",type:"bedroll",x:38,z:79,rot:.16,room:"camp"}),
  Object.freeze({id:"camp-crate-a",type:"crate",x:24,z:71,room:"camp"}),
  Object.freeze({id:"camp-crate-b",type:"crate",x:39,z:72,room:"camp"}),

  Object.freeze({id:"supply-crate-a",type:"crate",x:18,z:34,room:"supply"}),
  Object.freeze({id:"supply-crate-b",type:"crate",x:24,z:34,room:"supply"}),
  Object.freeze({id:"supply-crate-c",type:"crate",x:30,z:34,room:"supply"}),
  Object.freeze({id:"supply-shelf-a",type:"shelf",x:17,z:43,length:7,axis:"z",room:"supply"}),
  Object.freeze({id:"supply-shelf-b",type:"shelf",x:31,z:43,length:7,axis:"z",room:"supply"}),

  Object.freeze({id:"tools-workbench",type:"workbench",x:57,z:42,room:"tools"}),
  Object.freeze({id:"tools-rack-a",type:"toolRack",x:50,z:36,length:6,axis:"x",room:"tools"}),
  Object.freeze({id:"tools-rack-b",type:"toolRack",x:64,z:36,length:6,axis:"x",room:"tools"}),
  Object.freeze({id:"tools-crate",type:"crate",x:63,z:46,room:"tools"}),

  Object.freeze({id:"infirmary-bed-a",type:"bed",x:59,z:58,rot:0,room:"infirmary"}),
  Object.freeze({id:"infirmary-bed-b",type:"bed",x:66,z:58,rot:0,room:"infirmary"}),
  Object.freeze({id:"infirmary-bed-c",type:"bed",x:73,z:58,rot:0,room:"infirmary"}),
  Object.freeze({id:"infirmary-cabinet",type:"medicalCabinet",x:72,z:65,room:"infirmary"}),

  Object.freeze({id:"control-console-a",type:"console",x:84,z:76,room:"control"}),
  Object.freeze({id:"control-console-b",type:"console",x:92,z:76,room:"control"}),
  Object.freeze({id:"control-console-c",type:"console",x:100,z:76,room:"control"}),
  Object.freeze({id:"control-lamp-a",type:"lamp",x:84,z:83,color:0xffc676,room:"control"}),
  Object.freeze({id:"control-lamp-b",type:"lamp",x:100,z:83,color:0xffc676,room:"control"}),

  Object.freeze({id:"gallery-rail-a",type:"rail",x:116,z:64,length:10,axis:"x",room:"gallery"}),
  Object.freeze({id:"gallery-rail-b",type:"rail",x:130,z:64,length:10,axis:"x",room:"gallery"}),
  Object.freeze({id:"gallery-support-a",type:"support",x:109,z:60,room:"gallery"}),
  Object.freeze({id:"gallery-support-b",type:"support",x:137,z:60,room:"gallery"}),

  Object.freeze({id:"bridge-deck",type:"bridgeDeck",x:170,z:61,length:30,width:8,axis:"x",room:"bridge"}),
  Object.freeze({id:"bridge-lamp-a",type:"lamp",x:158,z:61,color:0x8ecbff,room:"bridge"}),
  Object.freeze({id:"bridge-lamp-b",type:"lamp",x:182,z:61,color:0x8ecbff,room:"bridge"}),

  Object.freeze({id:"boss-seal",type:"bossSeal",x:209,z:33,room:"boss"}),
  Object.freeze({id:"boss-support-a",type:"support",x:197,z:28,room:"boss"}),
  Object.freeze({id:"boss-support-b",type:"support",x:221,z:28,room:"boss"}),
  Object.freeze({id:"boss-crate-a",type:"crate",x:199,z:42,room:"boss"}),

  Object.freeze({id:"scavenger-debris-a",type:"debris",x:226,z:67,room:"scavengers"}),
  Object.freeze({id:"scavenger-debris-b",type:"debris",x:235,z:77,room:"scavengers"}),
  Object.freeze({id:"scavenger-crate",type:"crate",x:225,z:80,room:"scavengers"}),

  Object.freeze({id:"elevator-cage",type:"elevator",x:237,z:111,room:"elevator"}),
  Object.freeze({id:"elevator-lamp",type:"lamp",x:237,z:104,color:0xffd43b,room:"elevator"})
]);

// Iluminación authored del Piso 1 según la referencia visual.
// Las instalaciones usan luz industrial cálida; las zonas de cristal conservan luz fría/colorida.
const FACILITY_LIGHTS=Object.freeze([
  // Entrada / vestíbulo
  Object.freeze({id:"light-entry-a",x:16,z:108,y:2.15,color:0xffb86b,intensity:1.15,range:8.5,kind:"industrial"}),
  Object.freeze({id:"light-entry-b",x:36,z:104,y:2.15,color:0xffc47d,intensity:1.05,range:8.0,kind:"industrial"}),
  Object.freeze({id:"light-entry-c",x:52,z:100,y:2.10,color:0xffb86b,intensity:.95,range:7.4,kind:"industrial"}),

  // Campamento seguro
  Object.freeze({id:"light-camp-a",x:24,z:73,y:1.80,color:0xffb56a,intensity:.80,range:6.5,kind:"lantern"}),
  Object.freeze({id:"light-camp-b",x:39,z:74,y:1.80,color:0xffb56a,intensity:.80,range:6.5,kind:"lantern"}),

  // Almacén
  Object.freeze({id:"light-supply-a",x:18,z:36,y:2.05,color:0xffbe76,intensity:1.10,range:7.5,kind:"industrial"}),
  Object.freeze({id:"light-supply-b",x:30,z:44,y:2.05,color:0xffbe76,intensity:1.00,range:7.2,kind:"industrial"}),

  // Herramientas
  Object.freeze({id:"light-tools-a",x:51,z:38,y:2.05,color:0xffb86b,intensity:1.05,range:7.3,kind:"industrial"}),
  Object.freeze({id:"light-tools-b",x:64,z:44,y:2.05,color:0xffb86b,intensity:.95,range:7.0,kind:"industrial"}),

  // Enfermería: un poco más clara y neutra
  Object.freeze({id:"light-infirmary-a",x:59,z:58,y:2.10,color:0xffd6ad,intensity:1.25,range:7.8,kind:"medical"}),
  Object.freeze({id:"light-infirmary-b",x:71,z:62,y:2.10,color:0xffd6ad,intensity:1.20,range:7.8,kind:"medical"}),

  // Sala de control
  Object.freeze({id:"light-control-a",x:83,z:77,y:2.15,color:0xffbc72,intensity:1.00,range:7.0,kind:"industrial"}),
  Object.freeze({id:"light-control-b",x:94,z:79,y:2.15,color:0xffbc72,intensity:1.05,range:7.2,kind:"industrial"}),
  Object.freeze({id:"light-control-c",x:103,z:80,y:2.15,color:0xffbc72,intensity:.95,range:6.8,kind:"industrial"}),

  // Galería de extracción / corredor principal
  Object.freeze({id:"light-gallery-a",x:108,z:61,y:2.20,color:0xffb66a,intensity:.95,range:7.0,kind:"industrial"}),
  Object.freeze({id:"light-gallery-b",x:121,z:61,y:2.20,color:0xffb66a,intensity:.95,range:7.0,kind:"industrial"}),
  Object.freeze({id:"light-gallery-c",x:136,z:61,y:2.20,color:0xffb66a,intensity:.95,range:7.0,kind:"industrial"}),
  Object.freeze({id:"light-gallery-d",x:147,z:61,y:2.20,color:0xffb66a,intensity:.85,range:6.5,kind:"industrial"}),

  // Pasarela sobre grieta: lámparas frías para mezclarse con cristales
  Object.freeze({id:"light-bridge-a",x:158,z:61,y:1.75,color:0x86c9ff,intensity:.85,range:6.4,kind:"bridge"}),
  Object.freeze({id:"light-bridge-b",x:182,z:61,y:1.75,color:0x86c9ff,intensity:.85,range:6.4,kind:"bridge"}),

  // Cámara del capataz / ala derecha
  Object.freeze({id:"light-boss-a",x:198,z:38,y:2.20,color:0xffad64,intensity:.90,range:7.0,kind:"industrial"}),
  Object.freeze({id:"light-boss-b",x:220,z:38,y:2.20,color:0xffad64,intensity:.90,range:7.0,kind:"industrial"}),
  Object.freeze({id:"light-right-a",x:231,z:58,y:2.10,color:0xffb66a,intensity:.85,range:6.5,kind:"industrial"}),
  Object.freeze({id:"light-right-b",x:233,z:78,y:2.10,color:0xffb66a,intensity:.85,range:6.5,kind:"industrial"}),
  Object.freeze({id:"light-elevator-a",x:237,z:104,y:2.10,color:0xffd23f,intensity:1.15,range:7.2,kind:"elevator"})
]);

const CRYSTAL_LIGHT_ZONES=Object.freeze([
  Object.freeze({id:"crystal-zone-niche",x:132,z:28,y:1.35,color:0x6fafff,intensity:1.85,range:13.5}),
  Object.freeze({id:"crystal-zone-rift",x:170,z:69,y:.55,color:0x5d9fff,intensity:1.45,range:11.5}),
  Object.freeze({id:"crystal-zone-lower",x:181,z:96,y:.75,color:0x8d86ff,intensity:1.35,range:10.5}),
  Object.freeze({id:"crystal-zone-boss",x:209,z:28,y:1.05,color:0x73b7ff,intensity:.95,range:8.0})
]);

const PRIMARY_ROUTE=Object.freeze([
  [7,113,7],[18,109,7],[30,104,7],[40,98,8],[37,88,8],[31,79,8],
  [35,69,8],[49,68,8],[64,64,8],[80,72,8],[96,70,8],[111,64,8],
  [126,61,9],[141,61,9],[157,61,8],[170,61,6],[183,61,6],[194,50,8],
  [205,41,9],[218,43,9],[228,55,8],[232,72,9],[234,91,9],[237,111,8]
].map((p,i)=>Object.freeze({id:"route-"+i,x:p[0],z:p[1],width:p[2]})));

function normalize(){
  const bounds=Object.freeze({x0:0,x1:CRYSTAL_CAVE_BLUEPRINT.widthTiles,z0:0,z1:CRYSTAL_CAVE_BLUEPRINT.heightTiles});
  return Object.freeze({
    id:"crystalCave",
    kind:"authored-interior-cave",
    seed:"mine-floor-1",
    bounds,
    chunkSize:CRYSTAL_CAVE_BLUEPRINT.chunkSize,
    activeRadius:1,
    altitude:0,
    scale:1,
    moisture:.68,
    aridity:.18,
    hydrology:{type:"lake"},
    landform:{rolling:.12,hills:.08,ridges:.05},
    metadata:Object.freeze({
      authority:"map-module",
      generator:"CrystalCaveGenerator",
      contract:CRYSTAL_CAVE_CONTRACT_ID,
      interior:true,
      layout:"mine-floor-1-blueprint",
      layoutAuthority:"authored-two-chunk",
      chunkCount:2,
      chunkSizeTiles:128,
      worldSizeTiles:Object.freeze({width:256,height:128}),
      streaming:"nearby-chunks",
      terrainAuthority:"shared-height-field",
      hydrologyAuthority:"terrain-water-shared-field",
      hydrology:"continuous-depth-field"
    })
  });
}

function roomContains(room,x,z,margin=0){
  if(room.shape==="rect"){
    return Math.abs(x-room.cx)<=Math.max(.2,room.hx-margin)&&Math.abs(z-room.cz)<=Math.max(.2,room.hz-margin);
  }
  const rx=Math.max(.2,room.rx-margin),rz=Math.max(.2,room.rz-margin);
  return Math.hypot((x-room.cx)/rx,(z-room.cz)/rz)<=1;
}

function segmentDistance(px,pz,a,b){
  const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz||1;
  const t=clamp(((px-a.x)*dx+(pz-a.z)*dz)/den,0,1);
  const x=a.x+dx*t,z=a.z+dz*t;
  return Math.hypot(px-x,pz-z);
}

function corridorContains(c,x,z,margin=0){
  return segmentDistance(x,z,c.a,c.b)<=Math.max(.8,c.width*.5-margin);
}

function roomAt(x,z){
  for(const room of BLUEPRINT_ROOMS)if(roomContains(room,x,z,0))return room;
  if(roomContains(BRIDGE,x,z,0))return BRIDGE;
  return null;
}

function caveContains(spec,x,z,margin=0){
  if(x<spec.bounds.x0+1||x>spec.bounds.x1-1||z<spec.bounds.z0+1||z>spec.bounds.z1-1)return false;

  // La pasarela y las rutas secundarias conservan suelo aunque crucen la grieta.
  if(roomContains(BRIDGE,x,z,margin))return true;
  for(const corridor of BLUEPRINT_CORRIDORS)if(corridorContains(corridor,x,z,margin))return true;

  // La referencia muestra una grieta central real: sin suelo cargado debajo del jugador.
  // Las paredes interiores siguen existiendo como contorno persistente en el renderer.
  for(const chasm of CHASMS){
    const rx=Math.max(.2,chasm.rx+margin),rz=Math.max(.2,chasm.rz+margin);
    if(Math.hypot((x-chasm.cx)/rx,(z-chasm.cz)/rz)<=1)return false;
  }

  for(const room of BLUEPRINT_ROOMS)if(roomContains(room,x,z,margin))return true;
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
  append(
    (x,z)=>contains(x,z),
    (x0,x1,z)=>Object.freeze({
      id:"mine-floor-ground-"+z+"-"+x0,layer:"exterior",x0,x1,z0:z,z1:z+1,
      elevation:0,terrain:"stone",walkable:true,combat:true,
      tags:["cave","mine","crystal-cave","ground","mine-floor-1"]
    })
  );
  append(
    (x,z)=>inWater(x,z),
    (x0,x1,z)=>Object.freeze({
      id:"mine-floor-water-"+z+"-"+x0,layer:"exterior",x0,x1,z0:z,z1:z+1,
      elevation:waterSurfaceTiles,terrain:"water",walkable:true,combat:false,locomotion:"swim",
      moveMultiplier:.56,
      tags:["cave","mine","crystal-cave","water","swim","underground-pool"]
    })
  );
  return Object.freeze(out);
}

function crystalFormations(spec,contains,inWater){
  const authored=[
    [117,24,.95],[124,20,.72],[131,18,1.12],[140,22,.88],[147,30,.76],[137,36,.64],
    [154,53,.58],[163,48,.72],[174,50,.94],[184,54,.62],
    [169,94,.55],[181,88,.86],[191,96,.68],
    [201,26,.58],[216,28,.76]
  ];
  return Object.freeze(authored.map((p,i)=>{
    const jitterX=(seededUnit(spec.seed,i,41)-.5)*1.2;
    const jitterZ=(seededUnit(spec.seed,i,43)-.5)*1.2;
    const x=p[0]+jitterX,z=p[1]+jitterZ;
    if(!contains(x,z,.18)||inWater(x,z))return null;
    return Object.freeze({
      id:"mine-crystal-"+i,x,z,scale:p[2],
      lean:(seededUnit(spec.seed,i,47)-.5)*.30,
      color:CRYSTAL_CAVE_PASTELS[i%CRYSTAL_CAVE_PASTELS.length]
    });
  }).filter(Boolean));
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

  const route=PRIMARY_ROUTE;
  const chambers=Object.freeze([
    Object.freeze({id:"crystalNiche",x:132,z:28,rx:24,rz:18}),
    Object.freeze({id:"lowerGrotto",x:179,z:98,rx:20,rz:15}),
    Object.freeze({id:"boss",x:209,z:33,rx:23,rz:20})
  ]);
  const contains=(x,z,margin=0)=>caveContains(spec,finite(x),finite(z),Math.max(0,finite(margin)));

  const waterInput=input.water||{};
  const water=Object.freeze({
    kind:"lake",
    cx:177,
    cz:108,
    rx:6.0,
    rz:4.2,
    surfaceTiles:finite(waterInput.surfaceTiles??input.waterSurfaceTiles,-.18),
    maxDepthTiles:Math.max(.32,finite(waterInput.maxDepthTiles??input.maxWaterDepthTiles??input.waterDepthTiles,.82)),
    shoreDepthTiles:Math.max(.005,finite(waterInput.shoreDepthTiles,.025)),
    bankOuterRatio:Math.max(1.05,finite(waterInput.bankOuterRatio,1.30)),
    bankWidth:Math.max(.05,finite(waterInput.bankOuterRatio,1.30)-1)
  });
  const waterQ=(x,z)=>Math.hypot((finite(x)-water.cx)/water.rx,(finite(z)-water.cz)/water.rz);
  const inWater=(x,z)=>contains(x,z,.16)&&waterQ(x,z)<=1;

  function dryRockHeight(x,z){
    const room=roomAt(x,z);
    const roomFlat=room&&(room.kind==="facility"||room.kind==="bridge");
    const amp=roomFlat? .012:.045;
    const phase=seededUnit(spec.seed,7,11)*Math.PI*2;
    return Math.sin(x*.19+phase)*Math.cos(z*.17-phase*.7)*amp+
      Math.sin((x+z)*.11+phase*1.3)*amp*.55;
  }

  function floorHeightTilesAt(x,z){
    x=finite(x);z=finite(z);
    const dry=dryRockHeight(x,z),q=waterQ(x,z);
    if(q>=water.bankOuterRatio)return dry;

    if(q>=1){
      const t=smooth01((water.bankOuterRatio-q)/(water.bankOuterRatio-1));
      const shorelineTarget=water.surfaceTiles-water.shoreDepthTiles;
      return dry+(shorelineTarget-dry)*t;
    }

    const center=smooth01((1-q)/.78);
    const depth=water.shoreDepthTiles+(water.maxDepthTiles-water.shoreDepthTiles)*center;
    return water.surfaceTiles-depth;
  }

  function sampleWater(point={}){
    const x=finite(point.x),z=finite(point.z);
    if(!inWater(x,z))return null;
    const ground=floorHeightTilesAt(x,z);
    const depth=Math.max(.001,water.surfaceTiles-ground);
    return Object.freeze({
      bodyId:spec.id+":underground-pool",
      type:"lake",
      class:depth>=.72?"deepWater":(depth>=.28?"water":"shallowWater"),
      depth,
      surface:water.surfaceTiles,
      ground,
      waterSurfaceTiles:water.surfaceTiles,
      groundHeightTiles:ground,
      wetness:1,
      current:null,
      source:"crystal-cave-shared-bathymetry"
    });
  }

  function waterSampleAt(x,z){
    x=finite(x);z=finite(z);
    const q=waterQ(x,z),radius=Math.max(.001,Math.min(water.rx,water.rz));
    const sample=sampleWater({x,z});
    return Object.freeze({
      water:!!sample,
      type:"lake",
      waterSurfaceTiles:water.surfaceTiles,
      waterDepth:sample?.depth||0,
      depth:sample?.depth||0,
      surface:water.surfaceTiles,
      ground:sample?.ground??floorHeightTilesAt(x,z),
      distanceToWater:Math.max(0,(q-1)*radius),
      bankWidthTiles:(water.bankOuterRatio-1)*radius,
      current:null,
      source:"crystal-cave-shared-bathymetry"
    });
  }

  function sampleTerrain(point={}){
    const x=finite(point.x),z=finite(point.z);
    const open=contains(x,z),height=floorHeightTilesAt(x,z),waterSample=sampleWater({x,z});
    const zone=roomAt(x,z);
    return Object.freeze({
      ...base.sampleTerrain({x,y:finite(point.y),z}),
      height,
      surface:waterSample?"wet-cave-floor":"cave-floor",
      walkable:open,
      moveMultiplier:open?1:0,
      water:waterSample,
      zoneId:zone?.id||null,
      tags:waterSample
        ?["cave","mine","crystal-cave","water"]
        :["cave","mine","crystal-cave","ground",zone?.kind||"corridor"]
    });
  }

  const surfaces=buildSurfaceRuns(spec,contains,inWater,water.surfaceTiles);
  const formations=crystalFormations(spec,contains,inWater);
  const chunks=CRYSTAL_CAVE_BLUEPRINT.chunks;

  function chunkAt(x,z){
    x=finite(x);z=finite(z);
    if(z<0||z>=128||x<0||x>=256)return null;
    return chunks[x<128?0:1];
  }

  function chunksAround(point={},radius=spec.activeRadius){
    const center=chunkAt(point.x,point.z);
    if(!center)return [];
    const r=Math.max(0,Math.floor(finite(radius,spec.activeRadius)));
    return chunks.filter(chunk=>Math.abs(chunk.cx-center.cx)<=r).map(chunk=>Object.freeze({...chunk,active:true}));
  }

  return Object.freeze({
    id:spec.id,
    kind:spec.kind,
    seed:spec.seed,
    bounds:spec.bounds,
    metadata:spec.metadata,
    chunkSize:spec.chunkSize,
    activeRadius:spec.activeRadius,
    chunks,
    base,
    route,
    chambers,
    rooms:BLUEPRINT_ROOMS,
    corridors:BLUEPRINT_CORRIDORS,
    bridge:BRIDGE,
    chasms:CHASMS,
    landmarks:LANDMARKS,
    encounters:ENCOUNTERS,
    loot:LOOT,
    blockedDoors:BLOCKED_DOORS,
    dressing:BLUEPRINT_DRESSING,
    facilityLights:FACILITY_LIGHTS,
    crystalLightZones:CRYSTAL_LIGHT_ZONES,
    water,
    formations,
    crystals:formations,
    surfaces,
    contains,
    inWater,
    waterQ,
    floorHeightTilesAt,
    sampleTerrain,
    sampleWater,
    waterSampleAt,
    chunkAt,
    chunksAround,
    spawn:ENTRANCE,
    exteriorExit:Object.freeze({x:ENTRANCE.x,z:ENTRANCE.z}),
    exit:ELEVATOR_EXIT,
    snapshot(){
      return {
        id:spec.id,
        seed:spec.seed,
        kind:spec.kind,
        bounds:spec.bounds,
        chunkSize:spec.chunkSize,
        chunkCount:chunks.length,
        chunks:chunks.map(chunk=>({...chunk})),
        activeRadius:spec.activeRadius,
        water:{...water},
        landmarks:LANDMARKS.map(x=>({...x})),
        dressing:BLUEPRINT_DRESSING.map(x=>({...x})),
        facilityLights:FACILITY_LIGHTS.map(x=>({...x})),
        crystalLightZones:CRYSTAL_LIGHT_ZONES.map(x=>({...x})),
        metadata:{...spec.metadata}
      };
    }
  });
}

export function createCrystalCaveDefinition(input={}){
  const spec=normalize(input);
  return Object.freeze({
    id:spec.id,
    kind:spec.kind,
    seed:spec.seed,
    bounds:{minX:spec.bounds.x0,maxX:spec.bounds.x1,minZ:spec.bounds.z0,maxZ:spec.bounds.z1},
    metadata:spec.metadata,
    async generate(){return createCrystalCaveData(input);}
  });
}

export function createCrystalCaveRuntimeData(input={}){
  return createCrystalCaveData(input);
}
