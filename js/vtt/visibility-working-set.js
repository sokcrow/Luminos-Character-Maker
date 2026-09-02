const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const degToRad=(value)=>finite(value)*Math.PI/180;
const normalizeAngle=(value)=>{
  let angle=value%(Math.PI*2);
  if(angle>Math.PI)angle-=Math.PI*2;
  if(angle<-Math.PI)angle+=Math.PI*2;
  return angle;
};

function pointOf(value={},gridSize=70){
  if(Number.isFinite(Number(value.x))&&Number.isFinite(Number(value.y)))return{x:Number(value.x),y:Number(value.y)};
  if(Number.isFinite(Number(value.col))&&Number.isFinite(Number(value.row)))return{x:(Number(value.col)+0.5)*gridSize,y:(Number(value.row)+0.5)*gridSize};
  const source=value.position||value.gridPosition||value.anchor;
  if(source&&source!==value)return pointOf(source,gridSize);
  const a=value.a||value.from||value.start||value.p1;
  const b=value.b||value.to||value.end||value.p2;
  if(a&&b){
    const pa=pointOf(a,gridSize),pb=pointOf(b,gridSize);
    return{x:(pa.x+pb.x)/2,y:(pa.y+pb.y)/2};
  }
  return{x:0,y:0};
}

function boundsOf(value={},gridSize=70){
  if([value.x1,value.y1,value.x2,value.y2].every(v=>Number.isFinite(Number(v)))){
    return{minX:Math.min(Number(value.x1),Number(value.x2)),minY:Math.min(Number(value.y1),Number(value.y2)),maxX:Math.max(Number(value.x1),Number(value.x2)),maxY:Math.max(Number(value.y1),Number(value.y2))};
  }
  const a=value.a||value.from||value.start||value.p1;
  const b=value.b||value.to||value.end||value.p2;
  if(a&&b){
    const pa=pointOf(a,gridSize),pb=pointOf(b,gridSize);
    return{minX:Math.min(pa.x,pb.x),minY:Math.min(pa.y,pb.y),maxX:Math.max(pa.x,pb.x),maxY:Math.max(pa.y,pb.y)};
  }
  const p=pointOf(value,gridSize);
  const radius=Math.max(1,finite(value.radiusPx,value.radius||gridSize*0.25));
  return{minX:p.x-radius,minY:p.y-radius,maxX:p.x+radius,maxY:p.y+radius};
}

function centerOf(bounds){return{x:(bounds.minX+bounds.maxX)/2,y:(bounds.minY+bounds.maxY)/2};}
function intersects(a,b){return !(a.maxX<b.minX||a.minX>b.maxX||a.maxY<b.minY||a.minY>b.maxY);}
function bucketKey(col,row){return`${col}:${row}`;}

export function createChunkSpatialIndex(scene={},options={}){
  const gridSize=Math.max(1,finite(options.gridSize,70));
  const bucketCells=Math.max(1,Math.trunc(finite(options.bucketCells,4)));
  const bucketSize=gridSize*bucketCells;
  const collections=['topology','worldObjects','tokens','lights','surfaces'];
  const buckets=new Map();
  const totals={};
  for(const name of collections){
    const list=Array.isArray(scene[name])?scene[name]:[];
    totals[name]=list.length;
    for(const entity of list){
      const bounds=boundsOf(entity,gridSize);
      const minCol=Math.floor(bounds.minX/bucketSize),maxCol=Math.floor(bounds.maxX/bucketSize);
      const minRow=Math.floor(bounds.minY/bucketSize),maxRow=Math.floor(bounds.maxY/bucketSize);
      for(let row=minRow;row<=maxRow;row++)for(let col=minCol;col<=maxCol;col++){
        const key=bucketKey(col,row);
        let bucket=buckets.get(key);
        if(!bucket){bucket={topology:[],worldObjects:[],tokens:[],lights:[],surfaces:[]};buckets.set(key,bucket);}
        bucket[name].push(entity);
      }
    }
  }
  return Object.freeze({gridSize,bucketCells,bucketSize,buckets,totals,collections:Object.freeze(collections)});
}

export function queryChunkRect(index,bounds={}){
  const result={topology:[],worldObjects:[],tokens:[],lights:[],surfaces:[]};
  if(!index?.buckets)return result;
  const safe={minX:finite(bounds.minX),minY:finite(bounds.minY),maxX:finite(bounds.maxX),maxY:finite(bounds.maxY)};
  const minCol=Math.floor(safe.minX/index.bucketSize),maxCol=Math.floor(safe.maxX/index.bucketSize);
  const minRow=Math.floor(safe.minY/index.bucketSize),maxRow=Math.floor(safe.maxY/index.bucketSize);
  for(const name of index.collections){
    const seen=new Set();
    for(let row=minRow;row<=maxRow;row++)for(let col=minCol;col<=maxCol;col++){
      const bucket=index.buckets.get(bucketKey(col,row));
      for(const entity of bucket?.[name]||[]){
        if(seen.has(entity))continue;
        seen.add(entity);
        if(intersects(boundsOf(entity,index.gridSize),safe))result[name].push(entity);
      }
    }
  }
  return result;
}

function pointsForPov(entity,gridSize){
  const bounds=boundsOf(entity,gridSize),points=[centerOf(bounds)];
  const a=entity?.a||entity?.from||entity?.start||entity?.p1;
  const b=entity?.b||entity?.to||entity?.end||entity?.p2;
  if(a)points.push(pointOf(a,gridSize));
  if(b)points.push(pointOf(b,gridSize));
  return points;
}

function pointInsidePov(point,viewer,rangePx,halfFovRad){
  const dx=point.x-viewer.x,dy=point.y-viewer.y;
  const distance=Math.hypot(dx,dy);
  if(distance>rangePx)return false;
  if(distance<=1e-6)return true;
  const target=Math.atan2(dy,dx),facing=degToRad(viewer.facingDeg||0);
  return Math.abs(normalizeAngle(target-facing))<=halfFovRad;
}

export function queryPlayerPov(index,viewer={},options={}){
  const fovDeg=clamp(finite(options.fovDeg,120),1,360);
  const rangePx=Math.max(index.gridSize,finite(options.rangePx,index.gridSize*12));
  const preloadPx=Math.max(0,finite(options.preloadPx,index.gridSize*2));
  const radius=rangePx+preloadPx;
  const bounds={minX:finite(viewer.x)-radius,minY:finite(viewer.y)-radius,maxX:finite(viewer.x)+radius,maxY:finite(viewer.y)+radius};
  const candidates=queryChunkRect(index,bounds);
  const halfFov=degToRad(fovDeg/2);
  const result={topology:[],worldObjects:[],tokens:[],lights:[],surfaces:[],meta:{fovDeg,rangePx,preloadPx}};
  for(const name of index.collections){
    result[name]=candidates[name].filter(entity=>pointsForPov(entity,index.gridSize).some(point=>pointInsidePov(point,viewer,radius,halfFov)));
  }
  return result;
}

export function queryDmSimplified(index,viewport={},options={}){
  const visible=queryChunkRect(index,viewport);
  const groupCells=Math.max(1,Math.trunc(finite(options.groupCells,index.bucketCells)));
  const groupSize=index.gridSize*groupCells;
  const groupedUnits=(list)=>{
    const groups=new Set();
    for(const entity of list){
      const p=centerOf(boundsOf(entity,index.gridSize));
      groups.add(bucketKey(Math.floor(p.x/groupSize),Math.floor(p.y/groupSize)));
    }
    return groups.size;
  };
  const drawUnits={
    topology:groupedUnits(visible.topology),
    worldObjects:groupedUnits(visible.worldObjects),
    tokens:visible.tokens.length,
    lights:groupedUnits(visible.lights),
    surfaces:groupedUnits(visible.surfaces),
  };
  return{visible,drawUnits,meta:{simplified:true,groupCells}};
}

export function workingSetCounts(set={}){
  const counts={};let total=0;
  for(const name of ['topology','worldObjects','tokens','lights','surfaces']){
    const count=Array.isArray(set[name])?set[name].length:0;
    counts[name]=count;total+=count;
  }
  return{...counts,total};
}

export function drawUnitCounts(units={}){
  const counts={};let total=0;
  for(const name of ['topology','worldObjects','tokens','lights','surfaces']){
    const count=Math.max(0,finite(units[name],0));counts[name]=count;total+=count;
  }
  return{...counts,total};
}
