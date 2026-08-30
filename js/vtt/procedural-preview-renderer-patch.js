(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LuminousVttProceduralPreviewRenderer=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const clean=v=>String(v??'').trim();
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

  function rectPath(ctx,g,size){
    ctx.rect(g.minCol*size,g.minRow*size,(g.maxCol-g.minCol+1)*size,(g.maxRow-g.minRow+1)*size);
  }

  function footprintByBuilding(plan={}){
    const out=new Map();
    for(const cell of plan.generated?.surfaceCells||[]){
      const id=clean(cell.buildingId);if(!id)continue;
      const g=out.get(id)||{minCol:cell.col,minRow:cell.row,maxCol:cell.col,maxRow:cell.row};
      g.minCol=Math.min(g.minCol,cell.col);g.minRow=Math.min(g.minRow,cell.row);g.maxCol=Math.max(g.maxCol,cell.col);g.maxRow=Math.max(g.maxRow,cell.row);out.set(id,g);
    }
    return out;
  }

  function archetypeColor(id=''){
    const key=clean(id);
    if(key==='shop')return'#f2c45b';
    if(key==='apartment_building')return'#6ec8ff';
    if(key==='workshop')return'#ff9a62';
    if(key==='warehouse')return'#b98aff';
    return'#d6d9dd';
  }

  function drawZone(ctx,plan,options={}){
    const grid=plan.mapData?.grid||{},size=Math.max(1,finite(grid.size,70)),cols=Math.max(1,finite(grid.cols,120)),rows=Math.max(1,finite(grid.rows,120));
    ctx.save();
    ctx.fillStyle='rgba(8,10,12,.62)';ctx.fillRect(0,0,cols*size,rows*size);
    ctx.strokeStyle='#f0ca59';ctx.lineWidth=4;ctx.setLineDash([18,10]);ctx.strokeRect(0,0,cols*size,rows*size);ctx.setLineDash([]);
    if(options.showChunks!==false){
      const chunkSize=Math.max(1,finite(plan.zone?.chunkSize,40));ctx.strokeStyle='rgba(240,202,89,.28)';ctx.lineWidth=2;ctx.setLineDash([10,12]);
      for(let c=chunkSize;c<cols;c+=chunkSize){ctx.beginPath();ctx.moveTo(c*size,0);ctx.lineTo(c*size,rows*size);ctx.stroke();}
      for(let r=chunkSize;r<rows;r+=chunkSize){ctx.beginPath();ctx.moveTo(0,r*size);ctx.lineTo(cols*size,r*size);ctx.stroke();}
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawCorridors(ctx,plan,options={}){
    const size=Math.max(1,finite(plan.mapData?.grid?.size,70));
    for(const corridor of plan.fabric?.streets||[]){
      const alley=corridor.kind==='alley';ctx.save();ctx.beginPath();rectPath(ctx,corridor.geometry,size);ctx.fillStyle=alley?'rgba(88,205,153,.32)':'rgba(255,255,255,.24)';ctx.fill();ctx.strokeStyle=alley?'rgba(112,235,180,.92)':'rgba(255,255,255,.72)';ctx.lineWidth=2;ctx.stroke();ctx.restore();
    }
    for(const alley of plan.fabric?.alleys||[]){ctx.save();ctx.beginPath();rectPath(ctx,alley.geometry,size);ctx.fillStyle='rgba(88,205,153,.28)';ctx.fill();ctx.strokeStyle='rgba(112,235,180,.78)';ctx.lineWidth=2;ctx.stroke();ctx.restore();}
  }

  function drawParcels(ctx,plan,options={}){
    if(options.showParcels===false)return;const size=Math.max(1,finite(plan.mapData?.grid?.size,70));
    ctx.save();ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=1;ctx.setLineDash([5,7]);
    for(const parcel of plan.fabric?.parcels||[]){const g=parcel.buildable||parcel.geometry;if(!g)continue;ctx.beginPath();rectPath(ctx,g,size);ctx.stroke();}
    ctx.restore();
  }

  function drawBuildings(ctx,plan,options={}){
    const size=Math.max(1,finite(plan.mapData?.grid?.size,70)),footprints=footprintByBuilding(plan),semantics=plan.mapData?.semantics||{};
    for(const building of semantics.buildings||[]){
      const g=footprints.get(building.id);if(!g)continue;const color=archetypeColor(building.archetypeId);ctx.save();ctx.beginPath();rectPath(ctx,g,size);ctx.fillStyle=color;ctx.globalAlpha=.28;ctx.fill();ctx.globalAlpha=.95;ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke();
      if(options.showLabels!==false){const x=(g.minCol+g.maxCol+1)*size/2,y=(g.minRow+g.maxRow+1)*size/2,label=`${clean(building.archetypeId||'building').replace(/_/g,' ').toUpperCase()}`;ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.textBaseline='middle';const m=ctx.measureText(label);ctx.fillStyle='rgba(0,0,0,.78)';ctx.fillRect(x-m.width/2-6,y-10,m.width+12,20);ctx.fillStyle=color;ctx.fillText(label,x,y);}
      ctx.restore();
    }
    if(options.showRooms!==false){
      for(const area of semantics.areas||[]){if(!area.buildingId||area.geometry?.type!=='rect')continue;ctx.save();ctx.beginPath();rectPath(ctx,area.geometry,size);ctx.strokeStyle='rgba(255,255,255,.32)';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();}
    }
  }

  function drawTopology(ctx,plan,options={}){
    if(options.showTopology===false)return;const topology=root?.LuminousVttTopology,grid=plan.mapData?.grid;if(!topology||!grid)return;
    for(const raw of plan.mapData?.topology||[]){const e=topology.normalizeElement?topology.normalizeElement(raw):raw,line=topology.segment?topology.segment(e,grid):null;if(!line)continue;ctx.save();ctx.lineCap='round';ctx.strokeStyle=e.type==='door'?'#ffcf5a':'rgba(255,255,255,.52)';ctx.lineWidth=e.type==='door'?4:2;ctx.beginPath();ctx.moveTo(line.x1,line.y1);ctx.lineTo(line.x2,line.y2);ctx.stroke();ctx.restore();}
  }

  function drawLegend(ctx,renderer,plan){
    const summary=plan.validation?.summary||{},label=`PREVIEW · ${plan.profileId||'zone'} · ${plan.zone?.cols||0}×${plan.zone?.rows||0} · B ${summary.buildings||0} · ${plan.signature||''}`;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.font='bold 12px monospace';const m=ctx.measureText(label);ctx.fillStyle='rgba(0,0,0,.86)';ctx.fillRect(18,18,m.width+20,30);ctx.strokeStyle='#f0ca59';ctx.lineWidth=1;ctx.strokeRect(18,18,m.width+20,30);ctx.fillStyle='#f0ca59';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(label,28,33);ctx.restore();
  }

  function drawPreview(renderer,camera,mapData){
    const editor=mapData.proceduralEditor,plan=editor?.previewPlan;if(!plan)return;const ctx=renderer.ctx;ctx.save();camera.applyTransformSimple(ctx);drawZone(ctx,plan,editor.previewOptions||{});drawCorridors(ctx,plan,editor.previewOptions||{});drawParcels(ctx,plan,editor.previewOptions||{});drawBuildings(ctx,plan,editor.previewOptions||{});drawTopology(ctx,plan,editor.previewOptions||{});ctx.restore();drawLegend(ctx,renderer,plan);
  }

  function install(renderer,mapData){
    if(!renderer||renderer.__proceduralPreviewRendererPatch)return()=>{};const original=renderer.render?.bind(renderer);if(!original)return()=>{};
    renderer.render=function(camera,activeZ,renderData,isExporting=false){const result=original(camera,activeZ,renderData,isExporting);if(!isExporting&&mapData.dmEditMode?.active===true&&mapData.proceduralEditor?.previewPlan)drawPreview(renderer,camera,mapData);return result;};
    renderer.__proceduralPreviewRendererPatch=true;
    return()=>{renderer.render=original;delete renderer.__proceduralPreviewRendererPatch;};
  }

  return Object.freeze({install,drawPreview,footprintByBuilding,archetypeColor});
});
