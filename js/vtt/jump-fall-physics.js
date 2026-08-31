(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LuminousVttJumpFallPhysics=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const FALL_DAMAGE_TABLE=Object.freeze([
    Object.freeze({minFt:0,pct:0}),
    Object.freeze({minFt:15,pct:5}),
    Object.freeze({minFt:20,pct:10}),
    Object.freeze({minFt:25,pct:15}),
    Object.freeze({minFt:30,pct:20}),
    Object.freeze({minFt:35,pct:30}),
    Object.freeze({minFt:40,pct:40}),
    Object.freeze({minFt:45,pct:50}),
    Object.freeze({minFt:50,pct:60}),
    Object.freeze({minFt:55,pct:75}),
    Object.freeze({minFt:60,pct:90}),
    Object.freeze({minFt:65,pct:100}),
  ]);
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,finite(v,min)));
  const clean=(v)=>String(v??'').trim().toLowerCase();
  const cellKey=(col,row)=>`${Math.trunc(finite(col))}_${Math.trunc(finite(row))}`;

  function horizontalJumpFt({runUpFt=0,checkPower=0}={}){
    return 5*Math.floor(Math.max(0,finite(runUpFt))/10)+5*Math.floor(Math.max(0,finite(checkPower))/4);
  }
  function verticalJumpFt({strMod=0,checkPower=0}={}){
    return 5*Math.max(0,Math.floor(finite(strMod)/2))+5*Math.floor(Math.max(0,finite(checkPower))/10);
  }
  function fallBaseDamagePct(distanceFt=0){
    const distance=Math.max(0,finite(distanceFt));
    let pct=0;
    for(const row of FALL_DAMAGE_TABLE){if(distance+1e-9>=row.minFt)pct=row.pct;else break;}
    return pct;
  }
  function fallSkillMitigationPct(checkPower=0){return 5*Math.floor(Math.max(0,finite(checkPower))/5);}
  function resolveFallDamage({distanceFt=0,maxHp=0,checkPower=0,externalMitigationPct=0}={}){
    const basePct=fallBaseDamagePct(distanceFt);
    const skillMitigationPct=fallSkillMitigationPct(checkPower);
    const externalPct=Math.max(0,finite(externalMitigationPct));
    let afterSkill=Math.max(0,basePct-skillMitigationPct);
    if(basePct>=100)afterSkill=Math.max(50,afterSkill);
    const finalPct=clamp(afterSkill-externalPct,0,100);
    const hp=Math.max(0,finite(maxHp));
    return Object.freeze({distanceFt:Math.max(0,finite(distanceFt)),basePct,skillMitigationPct,externalMitigationPct:externalPct,afterSkillPct:afterSkill,finalPct,damage:Math.max(0,Math.floor(hp*finalPct/100)),maxHp:hp});
  }

  function gridBounds(mapData={}){
    const grid=mapData.grid||{};
    return {cols:Math.max(1,Math.trunc(finite(grid.cols,1))),rows:Math.max(1,Math.trunc(finite(grid.rows,1))),size:Math.max(1,finite(grid.size,70)),feetPerCell:Math.max(0.001,finite(grid.distancePerCell,5))};
  }
  function cellFromPoint(point={},mapData={}){
    const g=gridBounds(mapData);
    return {col:Math.max(0,Math.min(g.cols-1,Math.floor(finite(point.x)/g.size))),row:Math.max(0,Math.min(g.rows-1,Math.floor(finite(point.y)/g.size)))};
  }
  function pointForCell(cell={},mapData={},zLayer=0){
    const g=gridBounds(mapData);
    return {x:(Math.trunc(finite(cell.col))+0.5)*g.size,y:(Math.trunc(finite(cell.row))+0.5)*g.size,col:Math.trunc(finite(cell.col)),row:Math.trunc(finite(cell.row)),z:Number(zLayer)||0,zLayer:Number(zLayer)||0};
  }
  function elevationForLayer(mapData={},zLayer=0){
    const spatial=root?.LuminousVttSpatialVision;
    if(spatial?.elevationForLayer)return finite(spatial.elevationForLayer(mapData,zLayer),0);
    const level=mapData.zLevels?.[String(zLayer)]??mapData.zLevels?.[zLayer];
    if(Number.isFinite(Number(level?.elevationFt)))return Number(level.elevationFt);
    return Number(zLayer||0)*Math.max(1,finite(mapData.defaultZStepFt,10));
  }
  function layerElevationForPoint(mapData={},zLayer=0,point={}){
    const cell=cellFromPoint(point,mapData);
    const surface=mapData.surfaceLayers?.[String(zLayer)]?.[cellKey(cell.col,cell.row)];
    return elevationForLayer(mapData,zLayer)+finite(surface?.elevationOffsetFt,0);
  }
  function planeSupportsCell(mapData={},zLayer=0,col=0,row=0){
    const planes=Array.isArray(mapData.horizontalPlanes)?mapData.horizontalPlanes:[];
    const api=root?.LuminousVttHorizontalPlanes;
    for(const raw of planes){
      const plane=api?.normalizePlane?api.normalizePlane(raw,mapData):raw;
      if(!plane||plane.state==='destroyed'||plane.walkableTop!==true)continue;
      const supportLayer=Math.max(...(Array.isArray(plane.between)?plane.between:[plane.zLayer,plane.toZLayer]).map(Number).filter(Number.isFinite));
      if(Number(supportLayer)!==Number(zLayer))continue;
      const f=plane.footprint||{};
      if(col>=finite(f.minCol)&&col<=finite(f.maxCol)&&row>=finite(f.minRow)&&row<=finite(f.maxRow))return {supported:true,source:'horizontal_plane',plane};
    }
    return null;
  }
  function supportAtCell(mapData={},zLayer=0,col=0,row=0){
    const openingApi=root?.LuminousVttFloorOpenings;
    let opening=openingApi?.openingAtCell?.(mapData,zLayer,col,row)||null;
    if(!opening){
      opening=(Array.isArray(mapData.floorOpenings)?mapData.floorOpenings:[]).find((raw)=>{
        const layer=Number(raw?.zLayer??raw?.between?.[0]??0);
        if(layer!==Number(zLayer))return false;
        const f=raw?.footprint||raw||{};
        const minCol=Math.min(finite(f.minCol??f.from?.col),finite(f.maxCol??f.to?.col));
        const maxCol=Math.max(finite(f.minCol??f.from?.col),finite(f.maxCol??f.to?.col));
        const minRow=Math.min(finite(f.minRow??f.from?.row),finite(f.maxRow??f.to?.row));
        const maxRow=Math.max(finite(f.minRow??f.from?.row),finite(f.maxRow??f.to?.row));
        return col>=minCol&&col<=maxCol&&row>=minRow&&row<=maxRow;
      })||null;
    }
    if(opening){
      let supported=openingApi?.supportAtCell?.(mapData,zLayer,col,row)?.supported;
      if(supported==null){
        const closed=String(opening.state||'open')==='closed';
        const fallThrough=opening.fallThrough!=null?Boolean(opening.fallThrough):!closed;
        supported=opening.walkable===true||closed||!fallThrough;
      }
      return {supported:supported!==false,source:'floor_opening',opening};
    }
    const plane=planeSupportsCell(mapData,zLayer,col,row);
    if(plane)return plane;
    const layer=mapData.surfaceLayers?.[String(zLayer)]??mapData.surfaceLayers?.[zLayer];
    if(layer&&typeof layer==='object'&&!Array.isArray(layer)&&Object.keys(layer).length){
      const surface=layer[cellKey(col,row)]||null;
      return {supported:Boolean(surface),source:surface?'surface':'surface_void',surface};
    }
    return {supported:true,source:'legacy_default'};
  }
  function supportAtPoint(mapData={},zLayer=0,point={}){
    const cell=cellFromPoint(point,mapData);
    return {...supportAtCell(mapData,zLayer,cell.col,cell.row),cell};
  }
  function supportModelActive(mapData={},zLayer=0){
    const layer=mapData.surfaceLayers?.[String(zLayer)]??mapData.surfaceLayers?.[zLayer];
    if(layer&&typeof layer==='object'&&!Array.isArray(layer)&&Object.keys(layer).length)return true;
    if((mapData.floorOpenings||[]).some(raw=>Number(raw?.zLayer??raw?.between?.[0])===Number(zLayer)))return true;
    return (mapData.horizontalPlanes||[]).some(raw=>raw?.walkableTop===true&&(Array.isArray(raw.between)?raw.between.map(Number).includes(Number(zLayer)):Number(raw.toZLayer)===Number(zLayer)));
  }
  function layerCandidates(mapData={},startZ=0){
    const set=new Set([Number(startZ)||0]);
    Object.keys(mapData.zLevels||{}).forEach(key=>{if(Number.isFinite(Number(key)))set.add(Number(key));});
    Object.keys(mapData.surfaceLayers||{}).forEach(key=>{if(Number.isFinite(Number(key)))set.add(Number(key));});
    (mapData.floorOpenings||[]).forEach(o=>{(Array.isArray(o?.between)?o.between:[o?.zLayer,o?.toZLayer]).forEach(z=>{if(Number.isFinite(Number(z)))set.add(Number(z));});});
    (mapData.horizontalPlanes||[]).forEach(p=>{(Array.isArray(p?.between)?p.between:[p?.zLayer,p?.toZLayer]).forEach(z=>{if(Number.isFinite(Number(z)))set.add(Number(z));});});
    return [...set].sort((a,b)=>elevationForLayer(mapData,b)-elevationForLayer(mapData,a));
  }
  function findLandingBelow(mapData={},fromZ=0,point={}){
    const fromElevation=layerElevationForPoint(mapData,fromZ,point);
    for(const z of layerCandidates(mapData,fromZ)){
      const elevation=layerElevationForPoint(mapData,z,point);
      if(elevation>=fromElevation-1e-9)continue;
      const support=supportAtPoint(mapData,z,point);
      if(support.supported)return {valid:true,zLayer:z,elevationFt:elevation,distanceFt:Math.max(0,fromElevation-elevation),support,point:{...point,z,zLayer:z}};
    }
    return {valid:false,reason:'NO_LANDING_SUPPORT'};
  }
  function horizontalDistanceFt(a={},b={},mapData={}){
    const g=gridBounds(mapData);
    return Math.hypot(finite(b.x)-finite(a.x),finite(b.y)-finite(a.y))/g.size*g.feetPerCell;
  }
  function jumpMovementCostFt({horizontalFt=0,verticalRiseFt=0}={}){
    const distance=Math.hypot(Math.max(0,finite(horizontalFt)),Math.max(0,finite(verticalRiseFt)));
    return Math.ceil(distance/5)*5;
  }
  function traceCells(a={},b={},mapData={}){
    const g=gridBounds(mapData),distancePx=Math.hypot(finite(b.x)-finite(a.x),finite(b.y)-finite(a.y));
    const steps=Math.max(1,Math.ceil(distancePx/(g.size/4))),out=[],seen=new Set();
    for(let i=0;i<=steps;i+=1){
      const t=i/steps,cell=cellFromPoint({x:finite(a.x)+(finite(b.x)-finite(a.x))*t,y:finite(a.y)+(finite(b.y)-finite(a.y))*t},mapData),key=cellKey(cell.col,cell.row);
      if(!seen.has(key)){seen.add(key);out.push(cell);}
    }
    return out;
  }
  function unsupportedCellsBetween(mapData={},zLayer=0,a={},b={}){
    return traceCells(a,b,mapData).filter(cell=>!supportAtCell(mapData,zLayer,cell.col,cell.row).supported);
  }
  function strengthModifier(character={}){
    const fixed=root?.LuminousFixedDamageRuntime;
    if(fixed?.strengthModifier)return fixed.strengthModifier(character);
    const explicit=character.strengthMod??character.str_mod??character.strModifier;
    if(Number.isFinite(Number(explicit)))return Number(explicit);
    const stats=character.stats||character.dndStats||{};
    const score=[stats.fuerza,stats.strength,stats.str,character.fuerza,character.strength,character.str].find(v=>Number.isFinite(Number(v)));
    return Math.floor((finite(score,10)-10)/2);
  }
  function planJump({token={},from={},target={},mapData={},runUpFt=0,checkPower=0,strMod=null,targetZ=null}={}){
    const fromZ=Number(token.zLayer??token.gridPosition?.z??token.z?.[0]??0)||0;
    const toZ=targetZ==null?fromZ:Number(targetZ)||0;
    const destination=supportAtPoint(mapData,toZ,target);
    if(!destination.supported)return {valid:false,reason:'JUMP_LANDING_UNSUPPORTED',destination};
    const gap=unsupportedCellsBetween(mapData,fromZ,from,target);
    if(!gap.length&&fromZ===toZ)return {valid:false,reason:'JUMP_GAP_REQUIRED'};
    const interaction=root?.LuminousVttTokenInteraction;
    const clear=interaction?.isPathClear?.(token,from,target,mapData)||{valid:true};
    if(!clear.valid)return {valid:false,reason:clear.reason||'JUMP_PATH_BLOCKED',blocker:clear};
    const horizontalFt=horizontalDistanceFt(from,target,mapData);
    const fromElevation=layerElevationForPoint(mapData,fromZ,from);
    const targetElevation=layerElevationForPoint(mapData,toZ,target);
    const verticalRiseFt=Math.max(0,targetElevation-fromElevation);
    const resolvedStrMod=strMod==null?strengthModifier(token):finite(strMod);
    const maxHorizontalFt=horizontalJumpFt({runUpFt,checkPower});
    const maxVerticalFt=verticalJumpFt({strMod:resolvedStrMod,checkPower});
    const movementCostFt=jumpMovementCostFt({horizontalFt,verticalRiseFt});
    const targetCell=cellFromPoint(target,mapData),endpoint=pointForCell(targetCell,mapData,toZ);
    const valid=horizontalFt<=maxHorizontalFt+1e-9&&verticalRiseFt<=maxVerticalFt+1e-9;
    return {valid,reason:valid?null:(horizontalFt>maxHorizontalFt+1e-9?'JUMP_HORIZONTAL_RANGE_INSUFFICIENT':'JUMP_VERTICAL_RANGE_INSUFFICIENT'),movementType:'jump',mode:'jump',path:[{...from,z:fromZ,zLayer:fromZ},endpoint],cells:[cellFromPoint(from,mapData),targetCell],routeCostFt:movementCostFt,costFt:movementCostFt,movementCostFt,horizontalFt,verticalRiseFt,runUpFt:Math.max(0,finite(runUpFt)),checkPower:Math.max(0,finite(checkPower)),strMod:resolvedStrMod,maxHorizontalFt,maxVerticalFt,fromElevationFt:fromElevation,targetElevationFt:targetElevation,targetZ:toZ,destination,gapCells:gap};
  }
  function fallPlan({token={},from={},target=null,mapData={}}={}){
    const fromZ=Number(token.zLayer??token.gridPosition?.z??token.z?.[0]??0)||0;
    const point=target||from;
    const support=supportAtPoint(mapData,fromZ,point);
    if(support.supported)return {valid:false,reason:'FALL_SUPPORT_PRESENT'};
    const landing=findLandingBelow(mapData,fromZ,point);
    if(!landing.valid)return landing;
    const targetCell=cellFromPoint(point,mapData),endpoint=pointForCell(targetCell,mapData,landing.zLayer);
    return {valid:true,movementType:'fall',mode:'fall',path:[{...from,z:fromZ,zLayer:fromZ},endpoint],cells:[cellFromPoint(from,mapData),targetCell],routeCostFt:0,costFt:0,movementCostFt:0,fromZ,targetZ:landing.zLayer,fallDistanceFt:landing.distanceFt,landingElevationFt:landing.elevationFt,landing};
  }

  function withSupportAwareTerrain(mapData={},zLayer=0,movementMode='walk',callback){
    if(typeof callback!=='function')return null;
    if(clean(movementMode)==='fly'||!supportModelActive(mapData,zLayer))return callback();
    mapData.movement||={};mapData.movement.terrain||={};
    const key=String(zLayer),original=mapData.movement.terrain[key],base=(original&&typeof original==='object'&&!Array.isArray(original))?original:{};
    const proxy=new Proxy(base,{get(target,prop,receiver){
      if(typeof prop==='string'&&/^\d+_\d+$/.test(prop)){
        const [col,row]=prop.split('_').map(Number);
        if(!supportAtCell(mapData,zLayer,col,row).supported){const current=Reflect.get(target,prop,receiver);return {...(current&&typeof current==='object'?current:{}),blocked:true,_unsupportedVoid:true};}
      }
      return Reflect.get(target,prop,receiver);
    }});
    mapData.movement.terrain[key]=proxy;
    try{return callback();}finally{if(original===undefined)delete mapData.movement.terrain[key];else mapData.movement.terrain[key]=original;}
  }
  function installSupportAwarePathfinding(targetRoot=root){
    const base=targetRoot?.LuminousVttPathfinding;
    if(!base||base.__jumpFallSupportAware)return base||null;
    const wrapped=Object.freeze({...base,__jumpFallSupportAware:true,
      pointPassable(token,point,mapData={},zLayer=base.tokenLayer?.(token)??0,options={}){
        return withSupportAwareTerrain(mapData,zLayer,options.movementMode||'walk',()=>base.pointPassable(token,point,mapData,zLayer,options));
      },
      edgePassable(token,fromCell,toCell,mapData={},zLayer=base.tokenLayer?.(token)??0,options={}){
        return withSupportAwareTerrain(mapData,zLayer,options.movementMode||'walk',()=>base.edgePassable(token,fromCell,toCell,mapData,zLayer,options));
      },
      findPath(options={}){
        const token=options.token||{},mapData=options.mapData||{},zLayer=options.zLayer??base.tokenLayer?.(token)??0;
        return withSupportAwareTerrain(mapData,zLayer,options.movementMode||'walk',()=>base.findPath(options));
      }
    });
    targetRoot.LuminousVttPathfinding=wrapped;
    return wrapped;
  }

  return Object.freeze({FALL_DAMAGE_TABLE,horizontalJumpFt,verticalJumpFt,fallBaseDamagePct,fallSkillMitigationPct,resolveFallDamage,gridBounds,cellKey,cellFromPoint,pointForCell,elevationForLayer,layerElevationForPoint,supportAtCell,supportAtPoint,supportModelActive,layerCandidates,findLandingBelow,horizontalDistanceFt,jumpMovementCostFt,traceCells,unsupportedCellsBetween,strengthModifier,planJump,fallPlan,withSupportAwareTerrain,installSupportAwarePathfinding});
});
