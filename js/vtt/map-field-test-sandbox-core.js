(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LuminousVttMapFieldTestSandbox=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const CONFIG=Object.freeze({
    schemaVersion:1,
    seed:'map-field-test-2026',
    generatorVersion:'field_test_1',
    worldId:'luminous-field-test',
    regionId:'field-region-k',
    hexRadius:3,
    regionalHexCount:37,
    chunkSize:40,
    logicalChunkCols:3,
    logicalChunkRows:3,
    playerCount:8,
  });
  const LEGAL_CLASSES=Object.freeze(['nest','backstreets','outskirts']);
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const hexKey=h=>`${CONFIG.regionId}:${Number(h?.q)||0},${Number(h?.r)||0}`;
  const axialDistance=(q,r)=>(Math.abs(q)+Math.abs(r)+Math.abs(q+r))/2;

  function landcoverFor(q,r,jurisdiction){
    if(jurisdiction==='nest')return'urban_core';
    if(jurisdiction==='backstreets')return(q+r)%2===0?'dense_urban':'industrial';
    if(q===2&&r===-1)return'rural_villa';
    const pick=Math.abs((q*17)+(r*31))%4;
    return ['wilderness_forest','rural_plains','wilderness_hills','wilderness_swamp'][pick];
  }
  function travelTerrainFor(landcover){
    if(landcover.includes('forest'))return'forest';
    if(landcover.includes('hills'))return'hills';
    if(landcover.includes('swamp'))return'swamp';
    if(landcover==='urban_core'||landcover==='dense_urban'||landcover==='industrial')return'road';
    return'plains';
  }
  function jurisdictionFor(q,r){const d=axialDistance(q,r);return d===0?'nest':d===1?'backstreets':'outskirts';}
  function featureFlags(q,r){
    return Object.freeze({
      road:r===0,
      dirtRoad:q===1,
      rail:r===-1&&q>=-2,
      checkpoint:q===0&&r===0,
      villa:q===2&&r===-1,
    });
  }
  function createRegionalHexes(){
    const out=[];
    for(let q=-CONFIG.hexRadius;q<=CONFIG.hexRadius;q+=1){
      const minR=Math.max(-CONFIG.hexRadius,-q-CONFIG.hexRadius);
      const maxR=Math.min(CONFIG.hexRadius,-q+CONFIG.hexRadius);
      for(let r=minR;r<=maxR;r+=1){
        const jurisdiction=jurisdictionFor(q,r),landcover=landcoverFor(q,r,jurisdiction),features=featureFlags(q,r);
        out.push(Object.freeze({
          q,r,key:hexKey({q,r}),distance:axialDistance(q,r),jurisdiction,landcover,
          terrain:travelTerrainFor(landcover),
          settlementId:features.villa?'field_villa':jurisdiction==='nest'?'field_nest':'',
          requiredAccess:jurisdiction==='nest'?Object.freeze(['nest_pass']):Object.freeze([]),
          features,
        }));
      }
    }
    return Object.freeze(out.sort((a,b)=>a.q-b.q||a.r-b.r));
  }
  function routeEdges(){
    const edges=[];
    const addLine=(idPrefix,points,routeType,extra={})=>{
      for(let i=0;i<points.length-1;i+=1){
        const from=points[i],to=points[i+1];
        edges.push({id:`${idPrefix}_${i}`,from:{district:CONFIG.regionId,...from},to:{district:CONFIG.regionId,...to},routeType,...extra});
      }
    };
    addLine('road_spine',[-3,-2,-1,0,1,2,3].map(q=>({q,r:0})),'road');
    addLine('dirt_connector',[-3,-2,-1,0,1,2].map(r=>({q:1,r})),'dirt_road',{routeQualityMultiplier:1.15});
    addLine('rail_line',[-2,-1,0,1,2,3].map(q=>({q,r:-1})),'rail');
    return Object.freeze(edges);
  }
  function createGraphDefinition(){
    const hexes=createRegionalHexes();
    return Object.freeze({
      id:'field_test_graph',revision:1,autoConnectAdjacent:true,
      nodes:hexes.map(h=>({
        hex:{district:CONFIG.regionId,q:h.q,r:h.r},jurisdiction:h.jurisdiction,terrain:h.terrain,
        settlementId:h.settlementId,requiredAccess:h.requiredAccess,
        metadata:{landcover:h.landcover,features:clone(h.features)},
      })),
      edges:routeEdges(),
    });
  }

  const ZONE_DEFINITIONS=Object.freeze([
    Object.freeze({id:'nest_checkpoint',name:'Nest Gate',kind:'nest_entry',legalClass:'nest',landcover:'urban_core',regionalHex:{q:0,r:0},zLayers:[0],features:['checkpoint','controlled_access','exterior']}),
    Object.freeze({id:'backstreets_market',name:'Backstreets Market',kind:'street',legalClass:'backstreets',landcover:'dense_urban',regionalHex:{q:1,r:0},zLayers:[0],features:['street','shops','exterior']}),
    Object.freeze({id:'field_villa',name:'Outskirts Villa',kind:'villa',legalClass:'outskirts',landcover:'rural_villa',regionalHex:{q:2,r:-1},zLayers:[0,1],features:['villa','interior','exterior']}),
    Object.freeze({id:'multilevel_factory',name:'Backstreets Factory',kind:'building',legalClass:'backstreets',landcover:'industrial',regionalHex:{q:1,r:-1},zLayers:[0,1,2],features:['industrial','interior','stairs','roof']}),
    Object.freeze({id:'wilderness_forest',name:'Outskirts Forest',kind:'wilderness',legalClass:'outskirts',landcover:'wilderness_forest',regionalHex:{q:-2,r:1},zLayers:[0],features:['wilderness','forest','low_visibility']}),
    Object.freeze({id:'road_corridor',name:'Regional Road Corridor',kind:'road',legalClass:'backstreets',landcover:'dense_urban',regionalHex:{q:-1,r:0},zLayers:[0],features:['road','exterior']}),
    Object.freeze({id:'rail_station',name:'Outskirts Rail Station',kind:'rail',legalClass:'outskirts',landcover:'industrial',regionalHex:{q:-2,r:-1},zLayers:[0,1],features:['rail','station','interior','exterior']}),
    Object.freeze({id:'outskirts_ruins',name:'Outskirts Ruins',kind:'ruins',legalClass:'outskirts',landcover:'wilderness_hills',regionalHex:{q:0,r:2},zLayers:[0,1],features:['ruins','interior','exterior']}),
  ]);

  function createLocalZones(seed=CONFIG.seed){
    return Object.freeze(ZONE_DEFINITIONS.map((raw,index)=>Object.freeze({
      ...clone(raw),worldId:CONFIG.worldId,regionId:CONFIG.regionId,
      seed:`${seed}:zone:${raw.id}`,
      generatorVersion:CONFIG.generatorVersion,
      chunkSize:CONFIG.chunkSize,
      chunkCols:CONFIG.logicalChunkCols,
      chunkRows:CONFIG.logicalChunkRows,
      logicalCells:CONFIG.chunkSize*CONFIG.chunkSize*CONFIG.logicalChunkCols*CONFIG.logicalChunkRows,
      activeChunk:Object.freeze({col:index%2,row:1}),
    })));
  }
  function position(zone,chunkCol,chunkRow,zLayer=0){
    return Object.freeze({
      worldId:CONFIG.worldId,regionId:CONFIG.regionId,zoneId:zone.id,
      chunkCol,chunkRow,x:17.5*70,y:17.5*70,zLayer,elevationFt:zLayer*10,
      regionalHex:Object.freeze({district:CONFIG.regionId,...zone.regionalHex}),
    });
  }
  function createPlayers(zones=createLocalZones()){
    const byId=Object.fromEntries(zones.map(z=>[z.id,z]));
    return Object.freeze([
      Object.freeze({id:'P1',playerId:'P1',role:'player',position:position(byId.backstreets_market,0,1,0),scenario:'shared-zone-a'}),
      Object.freeze({id:'P2',playerId:'P2',role:'player',position:position(byId.backstreets_market,1,1,0),scenario:'shared-zone-b'}),
      Object.freeze({id:'P3',playerId:'P3',role:'player',position:position(byId.field_villa,0,1,0),scenario:'villa'}),
      Object.freeze({id:'P4',playerId:'P4',role:'player',position:position(byId.multilevel_factory,1,1,2),scenario:'multilevel'}),
      Object.freeze({id:'P5',playerId:'P5',role:'player',position:position(byId.wilderness_forest,0,1,0),scenario:'wilderness'}),
      Object.freeze({id:'P6',playerId:'P6',role:'player',position:position(byId.road_corridor,1,1,0),scenario:'road'}),
      Object.freeze({id:'P7',playerId:'P7',role:'player',position:position(byId.rail_station,0,1,0),scenario:'regional-travel',regionalTravel:true}),
      Object.freeze({id:'P8',playerId:'P8',role:'player',position:position(byId.outskirts_ruins,1,1,1),scenario:'reconnect',reconnect:true}),
    ]);
  }
  function createScenario(seed=CONFIG.seed){
    const zones=createLocalZones(seed),players=createPlayers(zones),regionalHexes=createRegionalHexes();
    return Object.freeze({
      schemaVersion:CONFIG.schemaVersion,seed,generatorVersion:CONFIG.generatorVersion,
      worldId:CONFIG.worldId,regionId:CONFIG.regionId,
      regionalHexes,graphDefinition:createGraphDefinition(),zones,players,
      dmSequence:Object.freeze(['FREE','FOLLOW:P1','VIEW_AS:P1','FOLLOW:P4','FREE','VIEW_AS:P8']),
      acceptance:Object.freeze({maxPlayers:8,maxActiveChunks:8,maxLiveCells:12800,maxActiveZones:8,liveChunkCells:1600,logicalZoneCells:14400}),
    });
  }

  return Object.freeze({CONFIG,LEGAL_CLASSES,axialDistance,hexKey,jurisdictionFor,createRegionalHexes,routeEdges,createGraphDefinition,createLocalZones,createPlayers,createScenario});
});
