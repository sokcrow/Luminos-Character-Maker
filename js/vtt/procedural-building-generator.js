(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LuminousVttProceduralBuildings=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const SCHEMA_VERSION=1;
  const clean=v=>String(v??'').trim();
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const slug=(v,f='value')=>clean(v).toLowerCase().replace(/[^a-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||f;
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

  const WEIGHTS=Object.freeze({
    dense_backstreet:Object.freeze({shop:.44,apartment_building:.31,workshop:.2,warehouse:.05}),
    mixed_urban:Object.freeze({shop:.3,apartment_building:.35,workshop:.2,warehouse:.15}),
    residential:Object.freeze({shop:.12,apartment_building:.72,workshop:.06,warehouse:.1}),
    commercial:Object.freeze({shop:.55,apartment_building:.2,workshop:.16,warehouse:.09}),
    industrial:Object.freeze({shop:.08,apartment_building:.04,workshop:.36,warehouse:.52}),
    open_complex:Object.freeze({shop:.18,apartment_building:.27,workshop:.25,warehouse:.3}),
  });

  function topologyCore(){
    if(root?.LuminousVttTopology)return root.LuminousVttTopology;
    if(typeof require!=='undefined'){try{return require('./topology.js');}catch(_){}}
    return null;
  }
  function fabricCore(){
    if(root?.LuminousVttUrbanFabric)return root.LuminousVttUrbanFabric;
    if(typeof require!=='undefined'){try{return require('./urban-fabric-core.js');}catch(_){}}
    return null;
  }

  function edgeKey(from,to,z=0){
    const a={col:Number(from.col),row:Number(from.row)},b={col:Number(to.col),row:Number(to.row)};
    const first=a.col<b.col||a.col===b.col&&a.row<=b.row?a:b,second=first===a?b:a;
    return`z${z}:${first.col},${first.row}>${second.col},${second.row}`;
  }

  function makeTopology({id,type='wall',from,to,zLayer=0,buildingId=null,parcelId=null,zoneId=null}={}){
    const core=topologyCore();
    const base=core?.createElement?core.createElement({id,type,from,to,zLayer,thicknessFt:.5}):{id,type,from:clone(from),to:clone(to),z:[zLayer],state:type==='wall'?null:'closed',thicknessFt:type==='wall'?.5:0};
    return{...base,procedural:{generated:true,zoneId,buildingId,parcelId}};
  }

  function perimeterEdges(g={}){
    const out=[];
    for(let c=g.minCol;c<=g.maxCol;c++){
      out.push({edge:'north',from:{col:c,row:g.minRow},to:{col:c+1,row:g.minRow}});
      out.push({edge:'south',from:{col:c,row:g.maxRow+1},to:{col:c+1,row:g.maxRow+1}});
    }
    for(let r=g.minRow;r<=g.maxRow;r++){
      out.push({edge:'west',from:{col:g.minCol,row:r},to:{col:g.minCol,row:r+1}});
      out.push({edge:'east',from:{col:g.maxCol+1,row:r},to:{col:g.maxCol+1,row:r+1}});
    }
    return out;
  }

  function exteriorDoorSpec(g={},edge='north',bias=.5){
    const t=Math.max(.1,Math.min(.9,finite(bias,.5)));
    if(edge==='north'||edge==='south'){
      const col=Math.max(g.minCol,Math.min(g.maxCol,Math.floor(g.minCol+(g.maxCol-g.minCol+1)*t)));
      const row=edge==='north'?g.minRow:g.maxRow+1;
      return{edge,from:{col,row},to:{col:col+1,row},cell:{col,row:edge==='north'?g.minRow:g.maxRow}};
    }
    const row=Math.max(g.minRow,Math.min(g.maxRow,Math.floor(g.minRow+(g.maxRow-g.minRow+1)*t)));
    const col=edge==='west'?g.minCol:g.maxCol+1;
    return{edge,from:{col,row},to:{col,row:row+1},cell:{col:edge==='west'?g.minCol:g.maxCol,row}};
  }

  function rectOverlapLength(a0,a1,b0,b1){return Math.max(0,Math.min(a1,b1)-Math.max(a0,b0)+1);}
  function adjacentAlleys(parcel={},alleys=[]){
    const g=parcel.geometry,out=[];
    for(const alley of alleys){const a=alley.geometry;
      if(g.minRow===a.maxRow+1&&rectOverlapLength(g.minCol,g.maxCol,a.minCol,a.maxCol)>0)out.push({edge:'north',alley});
      if(g.maxRow+1===a.minRow&&rectOverlapLength(g.minCol,g.maxCol,a.minCol,a.maxCol)>0)out.push({edge:'south',alley});
      if(g.minCol===a.maxCol+1&&rectOverlapLength(g.minRow,g.maxRow,a.minRow,a.maxRow)>0)out.push({edge:'west',alley});
      if(g.maxCol+1===a.minCol&&rectOverlapLength(g.minRow,g.maxRow,a.minRow,a.maxRow)>0)out.push({edge:'east',alley});
    }
    return out.sort((x,y)=>(x.alley.alleyClass==='service_alley'?-1:0)-(y.alley.alleyClass==='service_alley'?-1:0));
  }

  function weightedPick(weights={},rng){
    const entries=Object.entries(weights).filter(([,w])=>w>0),total=entries.reduce((n,[,w])=>n+w,0);let roll=rng.next()*total;
    for(const [id,w] of entries){roll-=w;if(roll<=0)return id;}return entries[entries.length-1]?.[0]||'shop';
  }

  function assignArchetype(profileId='mixed_urban',parcel={},rng){
    const fc=fabricCore(),area=fc?fc.width(parcel.buildable)*fc.height(parcel.buildable):100,weights={...(WEIGHTS[profileId]||WEIGHTS.mixed_urban)};
    if(area<130)weights.warehouse=0;
    if(area<70)weights.workshop*=.5;
    return weightedPick(weights,rng);
  }

  function area(id,buildingId,label,spatialType,functionalType,access,geometry,extra={}){
    return{id,kind:'area',buildingId,label,spatialType,functionalType,access,zLayer:0,geometry:clone(geometry),tags:['procedural',...(extra.tags||[])],roles:extra.roles||[],capabilities:extra.capabilities||[],parentId:extra.parentId||null,metadata:{generated:true,...(extra.metadata||{})}};
  }
  function point(id,buildingId,label,type,access,position,physicalRefId,parentId,extra={}){
    return{id,kind:'point',buildingId,label,type,access,zLayer:0,position:clone(position),physicalRefId:physicalRefId||null,parentId:parentId||null,tags:['procedural',...(extra.tags||[])],roles:extra.roles||[],capabilities:extra.capabilities||[],metadata:{generated:true,...(extra.metadata||{})}};
  }
  function relation(id,type,fromId,toId,physicalRefId=null,bidirectional=true,extra={}){
    return{id,kind:'relation',type,fromId,toId,physicalRefId:physicalRefId||null,bidirectional,tags:['procedural',...(extra.tags||[])],metadata:{generated:true,...(extra.metadata||{})}};
  }

  function splitDepth(g={},frontage='north',frontRatio=.64){
    if(frontage==='north'||frontage==='south'){
      const total=g.maxRow-g.minRow+1,front=Math.max(2,Math.min(total-2,Math.round(total*frontRatio)));
      if(frontage==='north')return{front:{...g,maxRow:g.minRow+front-1},rear:{...g,minRow:g.minRow+front},divider:{orientation:'horizontal',coord:g.minRow+front}};
      return{front:{...g,minRow:g.maxRow-front+1},rear:{...g,maxRow:g.maxRow-front},divider:{orientation:'horizontal',coord:g.maxRow-front+1}};
    }
    const total=g.maxCol-g.minCol+1,front=Math.max(2,Math.min(total-2,Math.round(total*frontRatio)));
    if(frontage==='west')return{front:{...g,maxCol:g.minCol+front-1},rear:{...g,minCol:g.minCol+front},divider:{orientation:'vertical',coord:g.minCol+front}};
    return{front:{...g,minCol:g.maxCol-front+1},rear:{...g,maxCol:g.maxCol-front},divider:{orientation:'vertical',coord:g.maxCol-front+1}};
  }

  function dividerElements(g={},divider={},doorId,buildingId,parcelId,zoneId){
    const edges=[];
    if(divider.orientation==='horizontal')for(let c=g.minCol;c<=g.maxCol;c++)edges.push({from:{col:c,row:divider.coord},to:{col:c+1,row:divider.coord}});
    else for(let r=g.minRow;r<=g.maxRow;r++)edges.push({from:{col:divider.coord,row:r},to:{col:divider.coord,row:r+1}});
    const doorEdge=edges[Math.floor(edges.length/2)],doorKey=edgeKey(doorEdge.from,doorEdge.to,0),topology=[];
    for(let i=0;i<edges.length;i++){
      const e=edges[i],isDoor=edgeKey(e.from,e.to,0)===doorKey;
      topology.push(makeTopology({id:isDoor?doorId:`${buildingId}_divider_wall_${i}`,type:isDoor?'door':'wall',from:e.from,to:e.to,buildingId,parcelId,zoneId}));
    }
    return{topology,door:topology.find(x=>x.id===doorId),doorEdge};
  }

  function dedupeTopology(elements=[]){
    const map=new Map();
    for(const e of elements){const key=edgeKey(e.from,e.to,Array.isArray(e.z)?e.z[0]:0),current=map.get(key);if(!current||current.type==='wall'&&e.type!=='wall')map.set(key,e);}
    return[...map.values()];
  }

  function serviceDoorCandidate(parcel,storageGeometry,alleys){
    for(const entry of adjacentAlleys(parcel,alleys)){
      const spec=exteriorDoorSpec(parcel.buildable,entry.edge,.66);
      const c=spec.cell;if(c.col>=storageGeometry.minCol&&c.col<=storageGeometry.maxCol&&c.row>=storageGeometry.minRow&&c.row<=storageGeometry.maxRow)return{...entry,spec};
    }
    return null;
  }

  function envelopeTopology(buildingId,parcel,zoneId,doors=[]){
    const blocked=new Set(doors.map(d=>edgeKey(d.spec.from,d.spec.to,0))),out=[];
    let i=0;for(const e of perimeterEdges(parcel.buildable)){if(blocked.has(edgeKey(e.from,e.to,0)))continue;out.push(makeTopology({id:`${buildingId}_outer_wall_${i++}`,type:'wall',from:e.from,to:e.to,buildingId,parcelId:parcel.id,zoneId}));}
    for(const d of doors)out.push(makeTopology({id:d.id,type:'door',from:d.spec.from,to:d.spec.to,buildingId,parcelId:parcel.id,zoneId}));
    return out;
  }

  function commonBuilding(parcel,archetypeId,zoneId){
    const id=`building_${parcel.id}`;
    const warehouse=archetypeId==='warehouse';
    return{id,kind:'building',label:`${archetypeId.replace(/_/g,' ').toUpperCase()} · ${parcel.id}`,archetypeId,defaultAccess:warehouse?'service':'semi_public',tags:['procedural',archetypeId],verticalConnectorIds:[],accessProfile:warehouse?{requirePublicZone:false,requireControlledZone:true,requireEntrance:true,requirePublicEntrance:false}:undefined,metadata:{generated:true,zoneId,parcelId:parcel.id,blockId:parcel.blockId}};
  }

  function addExternalConnection(relations,externalAreaId,pointId,doorId,prefix){
    if(externalAreaId)relations.push(relation(`${prefix}_external`,`connects`,externalAreaId,pointId,doorId,true,{tags:['boundary_connection']}));
  }

  function generateShop(building,parcel,fabric,zoneId){
    const bid=building.id,frontage=parcel.frontage.edge,split=splitDepth(parcel.buildable,frontage,.64),mainDoor={id:`${bid}_entrance_door`,spec:exteriorDoorSpec(parcel.buildable,frontage,.5)},service=serviceDoorCandidate(parcel,split.rear,fabric.alleys),doors=[mainDoor];
    if(service)doors.push({id:`${bid}_service_door`,spec:service.spec});
    const divider=dividerElements(parcel.buildable,split.divider,`${bid}_staff_door`,bid,parcel.id,zoneId),areas=[
      area(`${bid}_shop`,bid,'Shop Floor','room','shop','public',split.front,{capabilities:['buy','sell']}),
      area(`${bid}_storage`,bid,'Storage','room','storage','service',split.rear,{roles:['shop_inventory'],capabilities:['store_items']}),
    ],points=[],relations=[];
    points.push(point(`${bid}_entrance`,bid,'Public Entrance','entrance','public',mainDoor.spec.cell,mainDoor.id,`${bid}_shop`));
    relations.push(relation(`${bid}_entrance_inside`,'connects',`${bid}_entrance`,`${bid}_shop`,null,true));
    addExternalConnection(relations,parcel.frontage.streetId,`${bid}_entrance`,mainDoor.id,bid);
    relations.push(relation(`${bid}_shop_storage`,'connects',`${bid}_shop`,`${bid}_storage`,`${bid}_staff_door`,true));
    if(service){points.push(point(`${bid}_service_access`,bid,'Service Access','service_access','service',service.spec.cell,`${bid}_service_door`,`${bid}_storage`));relations.push(relation(`${bid}_service_inside`,'connects',`${bid}_storage`,`${bid}_service_access`,null,true));addExternalConnection(relations,service.alley.id,`${bid}_service_access`,`${bid}_service_door`,`${bid}_service`);}
    return{areas,points,relations,topology:dedupeTopology([...envelopeTopology(bid,parcel,zoneId,doors),...divider.topology]),surfaceMaterialId:'tile'};
  }

  function generateApartment(building,parcel,fabric,zoneId){
    const bid=building.id,frontage=parcel.frontage.edge,split=splitDepth(parcel.buildable,frontage,.28),mainDoor={id:`${bid}_entrance_door`,spec:exteriorDoorSpec(parcel.buildable,frontage,.5)},divider=dividerElements(parcel.buildable,split.divider,`${bid}_apartment_door`,bid,parcel.id,zoneId),areas=[
      area(`${bid}_circulation`,bid,'Shared Circulation','hallway','circulation','semi_public',split.front),
      area(`${bid}_apartment`,bid,'Apartment','room','apartment','private',split.rear,{roles:['residence']}),
    ],points=[point(`${bid}_entrance`,bid,'Building Entrance','entrance','semi_public',mainDoor.spec.cell,mainDoor.id,`${bid}_circulation`)],relations=[];
    relations.push(relation(`${bid}_entrance_inside`,'connects',`${bid}_entrance`,`${bid}_circulation`,null,true));
    addExternalConnection(relations,parcel.frontage.streetId,`${bid}_entrance`,mainDoor.id,bid);
    relations.push(relation(`${bid}_circulation_apartment`,'connects',`${bid}_circulation`,`${bid}_apartment`,`${bid}_apartment_door`,true));
    return{areas,points,relations,topology:dedupeTopology([...envelopeTopology(bid,parcel,zoneId,[mainDoor]),...divider.topology]),surfaceMaterialId:'wood'};
  }

  function generateWorkshop(building,parcel,fabric,zoneId){
    const bid=building.id,frontage=parcel.frontage.edge,split=splitDepth(parcel.buildable,frontage,.65),mainDoor={id:`${bid}_entrance_door`,spec:exteriorDoorSpec(parcel.buildable,frontage,.5)},service=serviceDoorCandidate(parcel,split.rear,fabric.alleys),doors=[mainDoor];if(service)doors.push({id:`${bid}_service_door`,spec:service.spec});
    const divider=dividerElements(parcel.buildable,split.divider,`${bid}_storage_door`,bid,parcel.id,zoneId),areas=[area(`${bid}_work`,bid,'Workshop','room','workshop','semi_public',split.front),area(`${bid}_storage`,bid,'Storage','room','storage','service',split.rear)],points=[point(`${bid}_entrance`,bid,'Workshop Entrance','entrance','semi_public',mainDoor.spec.cell,mainDoor.id,`${bid}_work`)],relations=[];
    relations.push(relation(`${bid}_entrance_inside`,'connects',`${bid}_entrance`,`${bid}_work`,null,true));addExternalConnection(relations,parcel.frontage.streetId,`${bid}_entrance`,mainDoor.id,bid);relations.push(relation(`${bid}_work_storage`,'connects',`${bid}_work`,`${bid}_storage`,`${bid}_storage_door`,true));
    if(service){points.push(point(`${bid}_service_access`,bid,'Service Access','service_access','service',service.spec.cell,`${bid}_service_door`,`${bid}_storage`));relations.push(relation(`${bid}_service_inside`,'connects',`${bid}_storage`,`${bid}_service_access`,null,true));addExternalConnection(relations,service.alley.id,`${bid}_service_access`,`${bid}_service_door`,`${bid}_service`);}
    return{areas,points,relations,topology:dedupeTopology([...envelopeTopology(bid,parcel,zoneId,doors),...divider.topology]),surfaceMaterialId:'metal'};
  }

  function generateWarehouse(building,parcel,fabric,zoneId){
    const bid=building.id,frontage=parcel.frontage.edge,adj=adjacentAlleys(parcel,fabric.alleys)[0]||null,targetEdge=adj?.edge||frontage,door={id:`${bid}_loading_door`,spec:exteriorDoorSpec(parcel.buildable,targetEdge,.5)},storage=area(`${bid}_storage`,bid,'Warehouse Storage','room','storage','service',parcel.buildable,{capabilities:['store_items','bulk_storage']}),entrance=point(`${bid}_entrance`,bid,'Warehouse Entrance','entrance','service',door.spec.cell,door.id,storage.id),loading=point(`${bid}_loading`,bid,'Loading Point','loading_point','service',door.spec.cell,door.id,storage.id),relations=[relation(`${bid}_entrance_inside`,'connects',entrance.id,storage.id,null,true),relation(`${bid}_loading_inside`,'connects',loading.id,storage.id,null,true)];
    addExternalConnection(relations,adj?.alley.id||parcel.frontage.streetId,entrance.id,door.id,bid);addExternalConnection(relations,adj?.alley.id||parcel.frontage.streetId,loading.id,door.id,`${bid}_loading`);
    return{areas:[storage],points:[entrance,loading],relations,topology:envelopeTopology(bid,parcel,zoneId,[door]),surfaceMaterialId:'concrete'};
  }

  function generateBuilding(parcel={},fabric={},rng,zoneId='zone'){
    const profileId=fabric.profile?.id||parcel.profileId||'mixed_urban',archetypeId=assignArchetype(profileId,parcel,rng),building=commonBuilding(parcel,archetypeId,zoneId);
    let generated;if(archetypeId==='apartment_building')generated=generateApartment(building,parcel,fabric,zoneId);else if(archetypeId==='workshop')generated=generateWorkshop(building,parcel,fabric,zoneId);else if(archetypeId==='warehouse')generated=generateWarehouse(building,parcel,fabric,zoneId);else generated=generateShop(building,parcel,fabric,zoneId);
    return{building,archetypeId,parcelId:parcel.id,footprint:clone(parcel.buildable),...generated};
  }

  function generateBuildings(fabric={},rngInput=null){
    const fc=fabricCore();if(!fc)throw new Error('URBAN_FABRIC_CORE_REQUIRED');
    const rng=rngInput||fc.createRng(`${fabric.zone?.seed||fabric.zone?.id||'zone'}:buildings`),buildings=[],areas=[],points=[],relations=[],topology=[],surfaceCells=[];
    for(const parcel of fabric.parcels||[]){
      if(!rng.chance(fabric.profile?.density??.75))continue;
      const result=generateBuilding(parcel,fabric,rng,fabric.zone?.id||'zone');buildings.push(result.building);areas.push(...result.areas);points.push(...result.points);relations.push(...result.relations);topology.push(...result.topology);
      const g=result.footprint;for(let row=g.minRow;row<=g.maxRow;row++)for(let col=g.minCol;col<=g.maxCol;col++)surfaceCells.push({zLayer:0,col,row,materialId:result.surfaceMaterialId,buildingId:result.building.id});
    }
    return{schemaVersion:SCHEMA_VERSION,buildings,areas,points,relations,topology:dedupeTopology(topology),surfaceCells};
  }

  return Object.freeze({
    SCHEMA_VERSION,WEIGHTS,edgeKey,perimeterEdges,exteriorDoorSpec,adjacentAlleys,weightedPick,assignArchetype,
    splitDepth,dividerElements,dedupeTopology,serviceDoorCandidate,envelopeTopology,generateBuilding,generateBuildings,
  });
});
