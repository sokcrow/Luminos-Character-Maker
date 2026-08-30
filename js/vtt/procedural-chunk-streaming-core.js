(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LuminousVttProceduralChunkStreaming=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const SCHEMA_VERSION=1;
  const CHUNK_SIZE=40;
  const MODE='chunk_streamed';
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Math.trunc(finite(v,min))));
  const clean=v=>String(v??'').trim();

  function normalizeCoord(raw={}){return{col:Math.trunc(finite(raw.col??raw.chunkCol,0)),row:Math.trunc(finite(raw.row??raw.chunkRow,0))};}
  function chunkKey(raw={}){const c=normalizeCoord(raw);return`${c.col},${c.row}`;}
  function deriveChunkSeed(seed,raw={}){const c=normalizeCoord(raw);return`${clean(seed)||'luminous-zone'}:chunk:${c.col},${c.row}`;}

  function createDescriptor(raw={}){
    const chunkCols=clamp(raw.chunkCols??raw.logicalChunkCols??raw.zone?.chunkCols,1,3),chunkRows=clamp(raw.chunkRows??raw.logicalChunkRows??raw.zone?.chunkRows,1,3),active=normalizeCoord(raw.activeChunk||{});
    const chunkSeeds={};for(const[key,value]of Object.entries(raw.chunkSeeds||{})){const seed=clean(value);if(seed)chunkSeeds[key]=seed;}
    return{
      schemaVersion:SCHEMA_VERSION,mode:MODE,zoneId:clean(raw.zoneId||raw.zone?.id||'zone_streamed')||'zone_streamed',seed:clean(raw.seed||raw.zone?.seed)||'luminous-zone',
      profileId:clean(raw.profileId||raw.zone?.profileId||raw.profile?.id)||'mixed_urban',profile:clone(raw.profile||null),chunkSize:CHUNK_SIZE,chunkCols,chunkRows,
      logicalCols:chunkCols*CHUNK_SIZE,logicalRows:chunkRows*CHUNK_SIZE,chunkSeeds,
      activeChunk:{col:clamp(active.col,0,chunkCols-1),row:clamp(active.row,0,chunkRows-1)},
    };
  }

  function containsChunk(descriptor={},raw={}){const d=createDescriptor(descriptor),c=normalizeCoord(raw);return c.col>=0&&c.row>=0&&c.col<d.chunkCols&&c.row<d.chunkRows;}
  function seedForChunk(descriptor={},raw={}){const d=createDescriptor(descriptor),key=chunkKey(raw);return d.chunkSeeds[key]||deriveChunkSeed(d.seed,raw);}
  function withChunkSeed(descriptor={},coord={},seed=''){const d=createDescriptor(descriptor),c=normalizeCoord(coord);if(!containsChunk(d,c))throw new Error('PROCEDURAL_CHUNK_OUT_OF_RANGE');const value=clean(seed);return{...d,chunkSeeds:{...d.chunkSeeds,...(value?{[chunkKey(c)]:value}:{})}};}

  function liveGrid(grid={}){return{...clone(grid),cols:CHUNK_SIZE,rows:CHUNK_SIZE,size:Math.max(8,finite(grid.size,70)),distancePerCell:Math.max(.1,finite(grid.distancePerCell,5)),distanceUnit:clean(grid.distanceUnit)||'ft'};}
  function performanceBudget(descriptor={}){const d=createDescriptor(descriptor),liveCells=CHUNK_SIZE*CHUNK_SIZE,logicalCells=d.logicalCols*d.logicalRows;return{liveCells,logicalCells,loadedChunks:1,logicalChunks:d.chunkCols*d.chunkRows,liveFraction:liveCells/logicalCells};}

  function chunkGenerationOptions(descriptor={},rawCoord={},overrides={}){
    const d=createDescriptor(descriptor),coord=normalizeCoord(rawCoord);if(!containsChunk(d,coord))throw new Error('PROCEDURAL_CHUNK_OUT_OF_RANGE');
    return{...clone(overrides),zoneId:`${d.zoneId}_chunk_${coord.col}_${coord.row}`,seed:seedForChunk(d,coord),profile:d.profile||d.profileId,profileId:d.profile||d.profileId,chunkCols:1,chunkRows:1,minBuildings:Math.max(1,Math.trunc(finite(overrides.minBuildings,1)))};
  }

  function detectBoundaryExit(point={},grid={}){
    const g=liveGrid(grid),width=g.cols*g.size,height=g.rows*g.size,x=finite(point.x,NaN),y=finite(point.y,NaN);if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    const dx=x<0?-1:(x>=width?1:0),dy=y<0?-1:(y>=height?1:0);if(!dx&&!dy)return null;
    return{dx,dy,edges:[dy<0?'north':dy>0?'south':null,dx<0?'west':dx>0?'east':null].filter(Boolean),width,height};
  }

  function resolveTransition(descriptor={},point={},grid={}){
    const d=createDescriptor(descriptor),exit=detectBoundaryExit(point,grid);if(!exit)return null;
    const target={col:d.activeChunk.col+exit.dx,row:d.activeChunk.row+exit.dy},valid=containsChunk(d,target);
    return{valid,reason:valid?null:'PROCEDURAL_ZONE_BOUNDARY',from:clone(d.activeChunk),target,exit};
  }

  function entryCell(point={},grid={},exit={}){
    const g=liveGrid(grid),rawCol=Math.floor(finite(point.x,0)/g.size),rawRow=Math.floor(finite(point.y,0)/g.size);
    const col=exit.dx>0?0:exit.dx<0?CHUNK_SIZE-1:clamp(rawCol,0,CHUNK_SIZE-1),row=exit.dy>0?0:exit.dy<0?CHUNK_SIZE-1:clamp(rawRow,0,CHUNK_SIZE-1);
    return{col,row,x:(col+.5)*g.size,y:(row+.5)*g.size};
  }

  function withActiveChunk(descriptor={},coord={}){const d=createDescriptor(descriptor),next=normalizeCoord(coord);if(!containsChunk(d,next))throw new Error('PROCEDURAL_CHUNK_OUT_OF_RANGE');return{...d,activeChunk:next};}

  return Object.freeze({SCHEMA_VERSION,CHUNK_SIZE,MODE,createDescriptor,normalizeCoord,chunkKey,deriveChunkSeed,seedForChunk,withChunkSeed,containsChunk,liveGrid,performanceBudget,chunkGenerationOptions,detectBoundaryExit,resolveTransition,entryCell,withActiveChunk});
});
