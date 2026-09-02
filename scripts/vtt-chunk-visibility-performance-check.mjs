import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  createChunkSpatialIndex,
  queryChunkRect,
  queryPlayerPov,
  queryDmSimplified,
  workingSetCounts,
  drawUnitCounts,
} from '../js/vtt/visibility-working-set.js';

const GRID_SIZE=70;
const COLS=40;
const ROWS=40;
const CHUNK_WIDTH=COLS*GRID_SIZE;
const CHUNK_HEIGHT=ROWS*GRID_SIZE;

function rng(seed=0x5eed1234){
  let state=seed>>>0;
  return()=>{
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state/0x100000000;
  };
}

function buildScene(){
  const random=rng();
  const topology=[];
  for(let row=0;row<=ROWS;row+=2){
    for(let col=0;col<COLS;col+=2){
      topology.push({id:`h-${col}-${row}`,type:'wall',from:{col,row},to:{col:Math.min(COLS,col+2),row},z:[0]});
    }
  }
  for(let col=0;col<=COLS;col+=2){
    for(let row=0;row<ROWS;row+=2){
      topology.push({id:`v-${col}-${row}`,type:'wall',from:{col,row},to:{col,row:Math.min(ROWS,row+2)},z:[0]});
    }
  }

  const surfaces=[];
  for(let row=0;row<ROWS;row++)for(let col=0;col<COLS;col++)surfaces.push({id:`surface-${col}-${row}`,col,row});

  const worldObjects=Array.from({length:320},(_,i)=>({
    id:`obj-${i}`,
    x:(1+Math.floor(random()*(COLS-2)))*GRID_SIZE,
    y:(1+Math.floor(random()*(ROWS-2)))*GRID_SIZE,
    radiusPx:10+(i%4)*5,
  }));
  const tokens=Array.from({length:96},(_,i)=>({
    id:`token-${i}`,
    x:(1+Math.floor(random()*(COLS-2)))*GRID_SIZE,
    y:(1+Math.floor(random()*(ROWS-2)))*GRID_SIZE,
    radiusPx:18,
  }));
  const lights=Array.from({length:72},(_,i)=>({
    id:`light-${i}`,
    x:(1+Math.floor(random()*(COLS-2)))*GRID_SIZE,
    y:(1+Math.floor(random()*(ROWS-2)))*GRID_SIZE,
    radiusPx:28,
  }));
  return{topology,worldObjects,tokens,lights,surfaces};
}

function totalScene(scene){return workingSetCounts(scene);}
function pct(part,total){return total>0?(part/total)*100:0;}
function measure(label,iterations,fn){
  for(let i=0;i<50;i++)fn(i);
  const started=performance.now();
  let checksum=0;
  for(let i=0;i<iterations;i++)checksum+=fn(i);
  const elapsed=performance.now()-started;
  return{label,iterations,totalMs:elapsed,avgMs:elapsed/iterations,checksum};
}

const scene=buildScene();
const world=totalScene(scene);
const index=createChunkSpatialIndex(scene,{gridSize:GRID_SIZE,bucketCells:4});

assert.equal(index.totals.surfaces,1600,'single simulated production chunk must contain 40x40 surface cells');
assert.ok(world.total>2500,'simulated chunk must be dense enough to expose culling differences');

// Approximate a 16:9 tactical camera footprint while keeping a safety margin around the player.
const viewport={
  minX:8*GRID_SIZE,
  minY:13*GRID_SIZE,
  maxX:32*GRID_SIZE,
  maxY:27*GRID_SIZE,
};
const viewportSet=queryChunkRect(index,viewport);
const viewportCounts=workingSetCounts(viewportSet);

// The 120-degree cone is authoritative; two extra cells are retained as preload to avoid pop-in.
const player={x:20*GRID_SIZE,y:20*GRID_SIZE,facingDeg:0};
const playerSet=queryPlayerPov(index,player,{fovDeg:120,rangePx:11*GRID_SIZE,preloadPx:2*GRID_SIZE});
const playerCounts=workingSetCounts(playerSet);

const dmSet=queryDmSimplified(index,viewport,{groupCells:4});
const dmVisibleCounts=workingSetCounts(dmSet.visible);
const dmDrawCounts=drawUnitCounts(dmSet.drawUnits);

assert.ok(viewportCounts.total<world.total*0.55,`viewport should reject most of the chunk: ${viewportCounts.total}/${world.total}`);
assert.ok(playerCounts.total<viewportCounts.total*0.75,`120 degree POV should be materially smaller than rectangular viewport: ${playerCounts.total}/${viewportCounts.total}`);
assert.ok(dmDrawCounts.total<dmVisibleCounts.total*0.35,`DM simplified draw units should be far below raw visible entities: ${dmDrawCounts.total}/${dmVisibleCounts.total}`);
assert.ok(playerCounts.surfaces<world.surfaces*0.35,'player POV must not retain most surface cells');

const movementFrames=240;
const playerMovement=measure('player-120-pov',movementFrames,(frame)=>{
  const t=frame/(movementFrames-1);
  const moving={
    x:(5+(30*t))*GRID_SIZE,
    y:(20+Math.sin(t*Math.PI*4)*4)*GRID_SIZE,
    facingDeg:Math.sin(t*Math.PI*2)*35,
  };
  return workingSetCounts(queryPlayerPov(index,moving,{fovDeg:120,rangePx:11*GRID_SIZE,preloadPx:2*GRID_SIZE})).total;
});

const dmMovement=measure('dm-simplified',movementFrames,(frame)=>{
  const t=frame/(movementFrames-1);
  const centerX=(10+20*t)*GRID_SIZE;
  const bounds={minX:centerX-12*GRID_SIZE,minY:13*GRID_SIZE,maxX:centerX+12*GRID_SIZE,maxY:27*GRID_SIZE};
  return drawUnitCounts(queryDmSimplified(index,bounds,{groupCells:4}).drawUnits).total;
});

const fullScan=measure('full-world-scan',movementFrames,()=>world.total);

const report={
  chunk:{cols:COLS,rows:ROWS,widthPx:CHUNK_WIDTH,heightPx:CHUNK_HEIGHT,gridSize:GRID_SIZE},
  world,
  viewport:{...viewportCounts,percentOfWorld:Number(pct(viewportCounts.total,world.total).toFixed(2))},
  player120:{...playerCounts,percentOfWorld:Number(pct(playerCounts.total,world.total).toFixed(2))},
  dmSimplified:{visible:dmVisibleCounts,drawUnits:dmDrawCounts,drawPercentOfVisible:Number(pct(dmDrawCounts.total,dmVisibleCounts.total).toFixed(2))},
  movement:{player120:playerMovement,dmSimplified:dmMovement,fullScan},
};

console.log('vtt simulated chunk visibility performance: ok');
console.log(JSON.stringify(report,null,2));
