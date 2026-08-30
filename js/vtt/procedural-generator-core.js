(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LuminousVttProceduralGenerator=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const SCHEMA_VERSION=1;
  const GENERATOR_VERSION='1.0.0';
  const clean=v=>String(v??'').trim();
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

  function requireLocal(path){if(typeof require!=='undefined'){try{return require(path);}catch(_){}}return null;}
  const dep=(name,path)=>root?.[name]||requireLocal(path);
  function zoneCore(){return dep('LuminousVttProceduralZone','./procedural-zone-core.js');}
  function fabricCore(){return dep('LuminousVttUrbanFabric','./urban-fabric-core.js');}
  function buildingGenerator(){return dep('LuminousVttProceduralBuildings','./procedural-building-generator.js');}
  function semanticCore(){return dep('LuminousVttSemanticMap','./semantic-map-core.js');}
  function buildingCore(){return dep('LuminousVttBuildingSemantics','./building-semantic-core.js');}
  function archetypeCore(){return dep('LuminousVttBuildingArchetypes','./building-archetype-core.js');}
  function navigationCore(){return dep('LuminousVttBuildingNavigation','./building-navigation-core.js');}
  function physicsCore(){return dep('LuminousVttBuildingPhysics','./building-physics-core.js');}
  function planeCore(){return dep('LuminousVttHorizontalPlanes','./horizontal-plane-core.js');}
  function surfaceCore(){return dep('LuminousVttSurfaceCore','./surface-core.js');}

  function semanticAreaForCorridor(corridor){
    const isAlley=corridor.kind==='alley';
    return{id:corridor.id,kind:'area',label:corridor.id.replace(/_/g,' ').toUpperCase(),spatialType:isAlley?'alley':'street',functionalType:isAlley?'service':'circulation',access:'public',zLayer:0,geometry:clone(corridor.geometry),tags:[...new Set(['procedural','required_continuity',...(corridor.tags||[])])],roles:[],capabilities:isAlley?['service_route']:['public_route'],metadata:{generated:true,source:corridor.source,socketId:corridor.socketId||null,semanticId:corridor.semanticId||corridor.id}};
  }

  function semanticAreaForAlley(alley){
    return{id:alley.id,kind:'area',label:alley.alleyClass.replace(/_/g,' ').toUpperCase(),spatialType:'alley',functionalType:'service',access:'public',zLayer:0,geometry:clone(alley.geometry),tags:[...new Set(['procedural','required_continuity',alley.alleyClass,...(alley.tags||[])])],roles:[],capabilities:['service_route'],metadata:{generated:true,alleyClass:alley.alleyClass,blockId:alley.blockId}};
  }

  function buildSemantics(fabric={},generated={}){
    const sc=semanticCore();if(!sc)throw new Error('SEMANTIC_MAP_CORE_REQUIRED');
    const corridorAreas=(fabric.streets||[]).map(semanticAreaForCorridor),alleyAreas=(fabric.alleys||[]).map(semanticAreaForAlley);
    const ids=new Set(),areas=[];for(const a of [...corridorAreas,...alleyAreas,...(generated.areas||[])])if(!ids.has(a.id)){ids.add(a.id);areas.push(a);}
    return sc.normalizeSemantics({buildings:generated.buildings||[],areas,points:generated.points||[],relations:generated.relations||[]});
  }

  function paintRect(cellMap,g,materialId,source){
    for(let row=g.minRow;row<=g.maxRow;row++)for(let col=g.minCol;col<=g.maxCol;col++)cellMap.set(`0:${col}:${row}`,{zLayer:0,col,row,materialId,source});
  }

  function buildSurfaceCells(fabric={},generated={}){
    const profile=fabric.profile||{},zone=fabric.zone,cellMap=new Map();
    paintRect(cellMap,{minCol:0,minRow:0,maxCol:zone.cols-1,maxRow:zone.rows-1},profile.baseMaterialId||'concrete','base');
    for(const street of fabric.streets||[])paintRect(cellMap,street.geometry,street.kind==='alley'?(profile.alleyMaterialId||'concrete'):(profile.streetMaterialId||'asphalt'),street.id);
    for(const alley of fabric.alleys||[])paintRect(cellMap,alley.geometry,profile.alleyMaterialId||'concrete',alley.id);
    for(const cell of generated.surfaceCells||[])cellMap.set(`0:${cell.col}:${cell.row}`,clone(cell));
    return[...cellMap.values()];
  }

  function roofPlane(building,footprint,mapData){
    const pc=planeCore();const raw={id:`${building.id}_roof`,type:'roof',zLayer:0,toZLayer:1,between:[0,1],footprint:clone(footprint),state:'intact',heightAboveFloorFt:10,walkableTop:true,procedural:{generated:true,buildingId:building.id}};
    return pc?.normalizePlane?{...pc.normalizePlane(raw,mapData),procedural:raw.procedural}:raw;
  }

  function physicalPlanFor(building,semantics,footprint){
    const bc=buildingCore(),points=bc?.pointsOfBuilding(semantics,building.id)||[],entrances=points.filter(p=>p.type==='entrance'&&p.physicalRefId).map(p=>({id:p.id,zLayer:0,topologyId:p.physicalRefId}));
    return{id:`${building.id}_physical`,segments:[{id:`${building.id}_z0`,zLayer:0,footprint:clone(footprint)}],levels:[0],entrances,verticalConnectorIds:[],continuities:[],corridors:[],rules:{requireEnclosure:true,requireEntrance:true,requireVerticalConnectivity:true,requireConnectorOpenings:true,requireOverhead:true}};
  }

  function buildFootprintByBuilding(generated={}){
    const result={};
    for(const cell of generated.surfaceCells||[]){if(!cell.buildingId)continue;const g=result[cell.buildingId]||={minCol:cell.col,minRow:cell.row,maxCol:cell.col,maxRow:cell.row};g.minCol=Math.min(g.minCol,cell.col);g.minRow=Math.min(g.minRow,cell.row);g.maxCol=Math.max(g.maxCol,cell.col);g.maxRow=Math.max(g.maxRow,cell.row);}
    return result;
  }

  function candidateMap(fabric={},generated={},options={}){
    const zone=fabric.zone,grid={cols:zone.cols,rows:zone.rows,size:Math.max(8,finite(options.gridSize,70)),distancePerCell:5,distanceUnit:'ft'},base={grid,zLevels:{'0':{zLayer:0,elevationFt:0,label:'Ground Floor'}},defaultZStepFt:15,topology:clone(generated.topology||[]),verticalPortals:[],structures:[],floorOpenings:[],horizontalPlanes:[],semantics:null};
    base.semantics=buildSemantics(fabric,generated);
    const footprints=buildFootprintByBuilding(generated);base.horizontalPlanes=(base.semantics.buildings||[]).filter(b=>footprints[b.id]).map(b=>roofPlane(b,footprints[b.id],base));
    return{mapData:base,footprints,physicalPlans:(base.semantics.buildings||[]).filter(b=>footprints[b.id]).map(b=>physicalPlanFor(b,base.semantics,footprints[b.id]))};
  }

  function corridorForSocket(fabric={},socket={}){
    return(fabric.streets||[]).find(s=>s.socketId===socket.id||(s.semanticId&&socket.semanticId&&s.semanticId===socket.semanticId))||null;
  }

  function materializeBoundaryCorridors(fabric={}){
    const zone=fabric.zone||{},streets=fabric.streets||=[];
    for(const socket of zone.sockets||[]){
      if(!['alley','service_route'].includes(socket.type)||corridorForSocket(fabric,socket))continue;
      const vertical=socket.edge==='north'||socket.edge==='south',geometry=vertical?{minCol:socket.span.fromCell,minRow:0,maxCol:socket.span.toCell,maxRow:zone.rows-1}:{minCol:0,minRow:socket.span.fromCell,maxCol:zone.cols-1,maxRow:socket.span.toCell};
      streets.push({schemaVersion:SCHEMA_VERSION,id:socket.semanticId||`socket_corridor_${socket.id}`,semanticId:socket.semanticId||`socket_corridor_${socket.id}`,key:`socket:${socket.id}`,kind:'alley',orientation:vertical?'vertical':'horizontal',geometry,widthTiles:socket.span.toCell-socket.span.fromCell+1,source:'boundary_socket',socketId:socket.id,tags:['procedural','required_continuity',socket.type]});
    }
    return fabric;
  }

  function reserveNonStreetCorridors(fabric={}){
    const fc=fabricCore(),reserved=(fabric.streets||[]).filter(x=>x.kind==='alley');if(!fc||!reserved.length)return fabric;
    const keep=(fabric.parcels||[]).filter(parcel=>!reserved.some(c=>fc.intersects(parcel.geometry,c.geometry))),ids=new Set(keep.map(p=>p.id));
    fabric.parcels=keep;fabric.edgeRelations=(fabric.edgeRelations||[]).filter(r=>ids.has(r.parcelA)&&ids.has(r.parcelB));return fabric;
  }

  function corridorBoundarySpecs(fabric={},corridor={}){
    const zone=fabric.zone||{},g=corridor.geometry||{},type=corridor.kind==='alley'?'service_route':'street',semanticId=corridor.semanticId||corridor.id,out=[];
    if(corridor.orientation==='vertical'){
      if(g.minRow<=0)out.push({edge:'north',type,span:{fromCell:g.minCol,toCell:g.maxCol},semanticId});
      if(g.maxRow>=zone.rows-1)out.push({edge:'south',type,span:{fromCell:g.minCol,toCell:g.maxCol},semanticId});
    }else{
      if(g.minCol<=0)out.push({edge:'west',type,span:{fromCell:g.minRow,toCell:g.maxRow},semanticId});
      if(g.maxCol>=zone.cols-1)out.push({edge:'east',type,span:{fromCell:g.minRow,toCell:g.maxRow},semanticId});
    }
    return out;
  }

  function ensureCorridorBoundarySockets(fabric={}){
    const zc=zoneCore(),zone=fabric.zone;if(!zc||!zone)return fabric;
    zone.sockets=Array.isArray(zone.sockets)?zone.sockets:[];
    for(const corridor of fabric.streets||[])for(const spec of corridorBoundarySpecs(fabric,corridor)){
      const exists=zone.sockets.some(s=>s.edge===spec.edge&&s.type===spec.type&&s.span?.fromCell===spec.span.fromCell&&s.span?.toCell===spec.span.toCell&&(!s.semanticId||s.semanticId===spec.semanticId));
      if(exists)continue;
      zone.sockets.push(zc.normalizeSocket({id:`auto_${spec.edge}_${corridor.id}`,edge:spec.edge,type:spec.type,span:spec.span,semanticId:spec.semanticId,continuationRequired:true,tags:['procedural','auto_continuity'],metadata:{generated:true,corridorId:corridor.id}},zone.sockets.length,zone));
    }
    return fabric;
  }

  function boundarySocketValidation(fabric={}){
    const errors=[],warnings=[],zone=fabric.zone||{};
    for(const socket of zone.sockets||[]){
      if(!socket.continuationRequired||!['street','alley','service_route'].includes(socket.type))continue;
      const corridor=corridorForSocket(fabric,socket);if(!corridor){errors.push({code:'PROCEDURAL_BOUNDARY_SOCKET_UNSATISFIED',socketId:socket.id});continue;}
      if(socket.semanticId&&corridor.semanticId!==socket.semanticId)errors.push({code:'PROCEDURAL_BOUNDARY_SEMANTIC_MISMATCH',socketId:socket.id,expected:socket.semanticId,actual:corridor.semanticId});
    }
    for(const corridor of fabric.streets||[])for(const spec of corridorBoundarySpecs(fabric,corridor)){
      const found=(zone.sockets||[]).some(s=>s.edge===spec.edge&&['street','alley','service_route'].includes(s.type)&&s.span?.fromCell===spec.span.fromCell&&s.span?.toCell===spec.span.toCell&&s.semanticId===spec.semanticId);
      if(!found)errors.push({code:'PROCEDURAL_CORRIDOR_SOCKET_MISSING',corridorId:corridor.id,edge:spec.edge});
    }
    return{valid:errors.length===0,errors,warnings};
  }

  function validateCandidate(fabric={},generated={},candidate={},options={}){
    const zc=zoneCore(),fc=fabricCore(),sc=semanticCore(),bc=buildingCore(),ac=archetypeCore(),nc=navigationCore(),pc=physicsCore();
    if(!zc||!fc||!sc||!bc||!ac||!nc||!pc)throw new Error('PROCEDURAL_VALIDATION_DEPENDENCY_REQUIRED');
    const mapData=candidate.mapData,checks={},errors=[],warnings=[];
    checks.zone=zc.validateZone(fabric.zone);checks.fabric=fc.validateFabric(fabric);checks.boundary=boundarySocketValidation(fabric);checks.semantic=sc.validateSemantics(mapData.semantics,mapData);checks.buildings=bc.validateBuildingSemantics(mapData.semantics,mapData);checks.archetypes=ac.validateAllBuildingArchetypes(mapData.semantics,mapData);
    checks.navigation={results:[]};for(const building of mapData.semantics.buildings||[])checks.navigation.results.push(nc.validateGraph(mapData.semantics,building.id,mapData));checks.navigation.errors=checks.navigation.results.flatMap(x=>x.errors||[]);checks.navigation.warnings=checks.navigation.results.flatMap(x=>x.warnings||[]);checks.navigation.valid=checks.navigation.errors.length===0;
    checks.physics={results:(candidate.physicalPlans||[]).map(plan=>pc.validatePlan(plan,mapData))};checks.physics.errors=checks.physics.results.flatMap(x=>x.errors||[]);checks.physics.warnings=[];checks.physics.valid=checks.physics.errors.length===0;
    for(const value of Object.values(checks)){errors.push(...(value.errors||[]));warnings.push(...(value.warnings||[]));}
    const minBuildings=Math.max(1,Math.trunc(finite(options.minBuildings,4)));if((mapData.semantics.buildings||[]).length<minBuildings)errors.push({code:'PROCEDURAL_BUILDING_COUNT_TOO_LOW',actual:mapData.semantics.buildings.length,min:minBuildings});
    return{valid:errors.length===0,errors,warnings,checks,summary:{buildings:mapData.semantics.buildings.length,areas:mapData.semantics.areas.length,points:mapData.semantics.points.length,relations:mapData.semantics.relations.length,topology:mapData.topology.length,roofs:mapData.horizontalPlanes.length}};
  }

  function planSignature(plan={}){
    const fc=fabricCore();if(!fc)return'';
    const payload={version:GENERATOR_VERSION,seed:plan.seed,attempt:plan.attempt,profileId:plan.profileId,zone:plan.zone,streets:(plan.fabric?.streets||[]).map(x=>[x.id,x.geometry]),alleys:(plan.fabric?.alleys||[]).map(x=>[x.id,x.geometry]),parcels:(plan.fabric?.parcels||[]).map(x=>[x.id,x.buildable]),buildings:(plan.mapData?.semantics?.buildings||[]).map(x=>[x.id,x.archetypeId]),areas:(plan.mapData?.semantics?.areas||[]).map(x=>[x.id,x.functionalType,x.geometry])};
    return fc.hash32(JSON.stringify(payload)).toString(16).padStart(8,'0');
  }

  function generateAttempt(options={},attempt=0){
    const zc=zoneCore(),fc=fabricCore(),bg=buildingGenerator();if(!zc||!fc||!bg)throw new Error('PROCEDURAL_GENERATOR_DEPENDENCY_REQUIRED');
    const seed=clean(options.seed)||'luminous-zone',profile=fc.normalizeProfile(options.profileId||options.profile||'mixed_urban'),attemptSeed=`${seed}::attempt:${attempt}`,rng=fc.createRng(attemptSeed),zone=zc.createZone({id:options.zoneId||'zone_0_0',districtId:options.districtId,coord:options.coord,chunkCols:options.chunkCols,chunkRows:options.chunkRows,profileId:profile.id,seed,sockets:options.sockets||[]});
    const fabric=fc.generateFabricPlan(zone,profile,rng);materializeBoundaryCorridors(fabric);reserveNonStreetCorridors(fabric);ensureCorridorBoundarySockets(fabric);
    const generated=bg.generateBuildings(fabric,rng),candidate=candidateMap(fabric,generated,options),validation=validateCandidate(fabric,generated,candidate,options);
    const plan={schemaVersion:SCHEMA_VERSION,generatorVersion:GENERATOR_VERSION,seed,attempt,attemptSeed,profileId:profile.id,zone:fabric.zone,fabric,generated,mapData:candidate.mapData,physicalPlans:candidate.physicalPlans,surfaceCells:buildSurfaceCells(fabric,generated),validation};plan.signature=planSignature(plan);return plan;
  }

  function generateZone(options={}){
    const maxAttempts=Math.max(1,Math.trunc(finite(options.maxAttempts,8))),failures=[];
    for(let attempt=0;attempt<maxAttempts;attempt++){
      const plan=generateAttempt(options,attempt);if(plan.validation.valid)return plan;failures.push({attempt,signature:plan.signature,errors:plan.validation.errors.slice(0,12)});
    }
    const error=new Error('PROCEDURAL_GENERATION_FAILED');error.failures=failures;throw error;
  }

  function surfaceLayersFromCells(cells=[]){
    const sc=surfaceCore(),layers={};
    for(const cell of cells){const z=String(Number(cell.zLayer)||0),key=sc?.cellKey?sc.cellKey(cell.col,cell.row):`${cell.col}_${cell.row}`;(layers[z]||={})[key]={materialId:cell.materialId,elevationOffsetFt:0};}
    return layers;
  }

  function applyPlan(mapData={},plan={},options={}){
    if(!plan?.validation?.valid)throw new Error('PROCEDURAL_PLAN_INVALID');
    const replaceScene=options.replaceScene!==false,preserveTokens=clone(mapData.tokens||[]),preserveId=mapData.id||mapData.mapId,preserveName=mapData.name||mapData.label;
    mapData.grid=clone(plan.mapData.grid);mapData.zLevels=clone(plan.mapData.zLevels);mapData.defaultZStepFt=15;
    if(replaceScene){mapData.walls=[];mapData.topology=[];mapData.verticalPortals=[];mapData.structures=[];mapData.floorOpenings=[];mapData.horizontalPlanes=[];mapData.worldObjects=[];mapData.surfaceLayers={};}
    mapData.topology=clone(plan.mapData.topology);mapData.verticalPortals=[];mapData.structures=[];mapData.floorOpenings=[];mapData.horizontalPlanes=clone(plan.mapData.horizontalPlanes);mapData.semantics=clone(plan.mapData.semantics);mapData.surfaceLayers=surfaceLayersFromCells(plan.surfaceCells);mapData.tokens=preserveTokens;
    if(preserveId){mapData.id=preserveId;mapData.mapId=preserveId;}if(preserveName)mapData.name=preserveName;
    const sc=surfaceCore();if(sc?.ensureMapState)sc.ensureMapState(mapData);
    mapData.procedural={schemaVersion:SCHEMA_VERSION,generatorVersion:GENERATOR_VERSION,seed:plan.seed,attempt:plan.attempt,profileId:plan.profileId,signature:plan.signature,zone:clone(plan.zone),fabricSummary:clone(plan.validation.checks.fabric.summary),generatedAt:Date.now()};
    return mapData;
  }

  return Object.freeze({
    SCHEMA_VERSION,GENERATOR_VERSION,buildSemantics,buildSurfaceCells,candidateMap,corridorForSocket,materializeBoundaryCorridors,reserveNonStreetCorridors,corridorBoundarySpecs,ensureCorridorBoundarySockets,boundarySocketValidation,
    validateCandidate,planSignature,generateAttempt,generateZone,surfaceLayersFromCells,applyPlan,
  });
});
