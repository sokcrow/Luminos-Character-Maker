(function(root,factory){
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LuminousVttUrbanFabric=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const SCHEMA_VERSION=1;
  const clean=v=>String(v??'').trim();
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)));
  const slug=(v,f='value')=>clean(v).toLowerCase().replace(/[^a-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||f;
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

  const PROFILES=Object.freeze({
    dense_backstreet:Object.freeze({id:'dense_backstreet',label:'Dense Backstreet',density:.9,attachBias:.8,alleyBias:.32,serviceAccessBias:.58,secondaryRoadChance:.72,primaryRoadWidth:4,secondaryRoadWidth:3,minParcel:6,preferredParcel:10,maxParcel:17,preferredAlleyWidth:1,setback:0,baseMaterialId:'concrete',streetMaterialId:'asphalt',alleyMaterialId:'concrete'}),
    mixed_urban:Object.freeze({id:'mixed_urban',label:'Mixed Urban',density:.76,attachBias:.56,alleyBias:.34,serviceAccessBias:.46,secondaryRoadChance:.56,primaryRoadWidth:4,secondaryRoadWidth:4,minParcel:7,preferredParcel:13,maxParcel:20,preferredAlleyWidth:2,setback:0,baseMaterialId:'concrete',streetMaterialId:'asphalt',alleyMaterialId:'concrete'}),
    residential:Object.freeze({id:'residential',label:'Residential',density:.66,attachBias:.34,alleyBias:.48,serviceAccessBias:.52,secondaryRoadChance:.42,primaryRoadWidth:5,secondaryRoadWidth:4,minParcel:9,preferredParcel:16,maxParcel:24,preferredAlleyWidth:2,setback:1,baseMaterialId:'grass',streetMaterialId:'asphalt',alleyMaterialId:'sidewalk'}),
    commercial:Object.freeze({id:'commercial',label:'Commercial',density:.82,attachBias:.7,alleyBias:.26,serviceAccessBias:.62,secondaryRoadChance:.66,primaryRoadWidth:6,secondaryRoadWidth:4,minParcel:7,preferredParcel:12,maxParcel:19,preferredAlleyWidth:2,setback:0,baseMaterialId:'sidewalk',streetMaterialId:'asphalt',alleyMaterialId:'concrete'}),
    industrial:Object.freeze({id:'industrial',label:'Industrial',density:.58,attachBias:.12,alleyBias:.14,serviceAccessBias:.72,secondaryRoadChance:.34,primaryRoadWidth:7,secondaryRoadWidth:6,minParcel:14,preferredParcel:23,maxParcel:34,preferredAlleyWidth:3,setback:1,baseMaterialId:'dirt',streetMaterialId:'asphalt',alleyMaterialId:'concrete'}),
    open_complex:Object.freeze({id:'open_complex',label:'Open Complex',density:.4,attachBias:.08,alleyBias:.12,serviceAccessBias:.4,secondaryRoadChance:.2,primaryRoadWidth:6,secondaryRoadWidth:5,minParcel:16,preferredParcel:28,maxParcel:38,preferredAlleyWidth:3,setback:2,baseMaterialId:'grass',streetMaterialId:'asphalt',alleyMaterialId:'sidewalk'}),
  });

  function zoneCore(){
    if(root?.LuminousVttProceduralZone)return root.LuminousVttProceduralZone;
    if(typeof require!=='undefined'){try{return require('./procedural-zone-core.js');}catch(_){}}
    return null;
  }

  function hash32(text=''){
    let h=2166136261>>>0;
    for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
    return h>>>0;
  }

  function createRng(seed='luminous'){
    let state=hash32(seed)||0x6d2b79f5;
    function next(){
      state=(state+0x6d2b79f5)>>>0;
      let t=state;
      t=Math.imul(t^(t>>>15),t|1);
      t^=t+Math.imul(t^(t>>>7),t|61);
      return((t^(t>>>14))>>>0)/4294967296;
    }
    return Object.freeze({
      seed:String(seed),
      next,
      chance:p=>next()<clamp(finite(p),0,1),
      int:(min,max)=>{const a=Math.ceil(Math.min(min,max)),b=Math.floor(Math.max(min,max));return a+Math.floor(next()*Math.max(1,b-a+1));},
      pick:list=>Array.isArray(list)&&list.length?list[Math.floor(next()*list.length)]:null,
    });
  }

  function normalizeProfile(raw='mixed_urban'){
    const base=typeof raw==='string'?(PROFILES[slug(raw,'mixed_urban')]||PROFILES.mixed_urban):(PROFILES[slug(raw?.id,'mixed_urban')]||PROFILES.mixed_urban);
    const src=typeof raw==='object'&&raw?raw:{};
    return{
      ...clone(base),...clone(src),
      id:slug(src.id||base.id,'mixed_urban'),
      density:clamp(finite(src.density,base.density),0,1),
      attachBias:clamp(finite(src.attachBias,base.attachBias),0,1),
      alleyBias:clamp(finite(src.alleyBias,base.alleyBias),0,1),
      serviceAccessBias:clamp(finite(src.serviceAccessBias,base.serviceAccessBias),0,1),
      secondaryRoadChance:clamp(finite(src.secondaryRoadChance,base.secondaryRoadChance),0,1),
      primaryRoadWidth:Math.max(2,Math.trunc(finite(src.primaryRoadWidth,base.primaryRoadWidth))),
      secondaryRoadWidth:Math.max(2,Math.trunc(finite(src.secondaryRoadWidth,base.secondaryRoadWidth))),
      minParcel:Math.max(5,Math.trunc(finite(src.minParcel,base.minParcel))),
      preferredParcel:Math.max(5,Math.trunc(finite(src.preferredParcel,base.preferredParcel))),
      maxParcel:Math.max(6,Math.trunc(finite(src.maxParcel,base.maxParcel))),
      preferredAlleyWidth:Math.max(1,Math.trunc(finite(src.preferredAlleyWidth,base.preferredAlleyWidth))),
      setback:Math.max(0,Math.trunc(finite(src.setback,base.setback))),
    };
  }

  function rect(minCol,minRow,maxCol,maxRow){return{minCol:Math.trunc(minCol),minRow:Math.trunc(minRow),maxCol:Math.trunc(maxCol),maxRow:Math.trunc(maxRow)};}
  function width(r){return r.maxCol-r.minCol+1;}
  function height(r){return r.maxRow-r.minRow+1;}
  function intersects(a,b){return!(a.maxCol<b.minCol||b.maxCol<a.minCol||a.maxRow<b.minRow||b.maxRow<a.minRow);}
  function inside(r,zone){return r.minCol>=0&&r.minRow>=0&&r.maxCol<zone.cols&&r.maxRow<zone.rows&&r.minCol<=r.maxCol&&r.minRow<=r.maxRow;}

  function corridorId(orientation,start,end,index){return`street_${orientation}_${start}_${end}_${index}`;}
  function addCorridor(list,zone,orientation,start,end,options={}){
    const max=orientation==='vertical'?zone.cols-1:zone.rows-1;
    let a=Math.max(0,Math.min(max,Math.trunc(start))),b=Math.max(0,Math.min(max,Math.trunc(end)));
    if(a>b)[a,b]=[b,a];
    const geometry=orientation==='vertical'?rect(a,0,b,zone.rows-1):rect(0,a,zone.cols-1,b);
    const key=`${orientation}:${a}:${b}`;
    if(list.some(x=>x.key===key))return list.find(x=>x.key===key);
    const kind=options.kind==='alley'?'alley':'street';
    const item={
      schemaVersion:SCHEMA_VERSION,
      id:options.id||corridorId(orientation,a,b,list.length),
      semanticId:options.semanticId||options.id||null,
      key,kind,orientation,geometry,
      widthTiles:b-a+1,
      source:options.source||'generated',
      socketId:options.socketId||null,
      tags:[...new Set(['procedural','required_continuity',...(options.tags||[])])],
    };
    list.push(item);return item;
  }

  function centeredBand(center,total,widthTiles){
    const half=Math.floor(widthTiles/2),start=Math.max(0,Math.min(total-widthTiles,center-half));
    return[start,start+widthTiles-1];
  }

  function chooseSecondaryBand(total,widthTiles,rng,side){
    const center=side==='low'?rng.int(Math.floor(total*.22),Math.floor(total*.34)):rng.int(Math.floor(total*.66),Math.floor(total*.78));
    return centeredBand(center,total,widthTiles);
  }

  function generateStreetNetwork(zoneInput={},profileInput='mixed_urban',rngInput=null){
    const zc=zoneCore();if(!zc)throw new Error('PROCEDURAL_ZONE_CORE_REQUIRED');
    const zone=zc.normalizeZone(zoneInput),profile=normalizeProfile(profileInput),rng=rngInput||createRng(zone.seed||zone.id),streets=[];
    const [cx0,cx1]=centeredBand(Math.floor(zone.cols/2),zone.cols,profile.primaryRoadWidth);
    const [cy0,cy1]=centeredBand(Math.floor(zone.rows/2),zone.rows,profile.primaryRoadWidth);
    addCorridor(streets,zone,'vertical',cx0,cx1,{id:'street_primary_ns',semanticId:'street_primary_ns',tags:['primary']});
    addCorridor(streets,zone,'horizontal',cy0,cy1,{id:'street_primary_ew',semanticId:'street_primary_ew',tags:['primary']});

    for(const socket of zone.sockets){
      if(!['street','service_route'].includes(socket.type))continue;
      const orientation=socket.edge==='north'||socket.edge==='south'?'vertical':'horizontal';
      addCorridor(streets,zone,orientation,socket.span.fromCell,socket.span.toCell,{
        id:socket.semanticId||`socket_corridor_${socket.id}`,
        semanticId:socket.semanticId||`socket_corridor_${socket.id}`,
        source:'boundary_socket',socketId:socket.id,tags:[socket.type],kind:socket.type==='service_route'?'alley':'street',
      });
    }

    if(rng.chance(profile.secondaryRoadChance)){
      const side=rng.chance(.5)?'low':'high',[a,b]=chooseSecondaryBand(zone.cols,profile.secondaryRoadWidth,rng,side);
      if(Math.abs(((a+b)/2)-((cx0+cx1)/2))>profile.secondaryRoadWidth*2)addCorridor(streets,zone,'vertical',a,b,{id:`street_secondary_ns_${side}`,tags:['secondary']});
    }
    if(rng.chance(profile.secondaryRoadChance)){
      const side=rng.chance(.5)?'low':'high',[a,b]=chooseSecondaryBand(zone.rows,profile.secondaryRoadWidth,rng,side);
      if(Math.abs(((a+b)/2)-((cy0+cy1)/2))>profile.secondaryRoadWidth*2)addCorridor(streets,zone,'horizontal',a,b,{id:`street_secondary_ew_${side}`,tags:['secondary']});
    }
    return streets;
  }

  function mergeBands(bands=[]){
    const sorted=bands.map(b=>({start:b.start,end:b.end})).sort((a,b)=>a.start-b.start),out=[];
    for(const band of sorted){
      const last=out[out.length-1];
      if(last&&band.start<=last.end+1)last.end=Math.max(last.end,band.end);else out.push({...band});
    }
    return out;
  }

  function complements(total,bands=[],minSize=6){
    const merged=mergeBands(bands),out=[];let cursor=0;
    for(const band of merged){if(band.start-cursor>=minSize)out.push({start:cursor,end:band.start-1});cursor=Math.max(cursor,band.end+1);}
    if(total-cursor>=minSize)out.push({start:cursor,end:total-1});
    return out;
  }

  function adjacentCorridor(streets,orientation,coordinate){
    return streets.find(s=>s.orientation===orientation&&(orientation==='vertical'?(s.geometry.minCol===coordinate||s.geometry.maxCol===coordinate):(s.geometry.minRow===coordinate||s.geometry.maxRow===coordinate)))||null;
  }

  function deriveBlocks(zoneInput={},streets=[],profileInput='mixed_urban'){
    const zc=zoneCore();if(!zc)throw new Error('PROCEDURAL_ZONE_CORE_REQUIRED');
    const zone=zc.normalizeZone(zoneInput),profile=normalizeProfile(profileInput);
    const splitters=streets.filter(s=>s.kind==='street');
    const xb=splitters.filter(s=>s.orientation==='vertical').map(s=>({start:s.geometry.minCol,end:s.geometry.maxCol}));
    const yb=splitters.filter(s=>s.orientation==='horizontal').map(s=>({start:s.geometry.minRow,end:s.geometry.maxRow}));
    const xs=complements(zone.cols,xb,Math.max(8,profile.minParcel)),ys=complements(zone.rows,yb,Math.max(8,profile.minParcel)),blocks=[];
    for(const xr of xs)for(const yr of ys){
      const geometry=rect(xr.start,yr.start,xr.end,yr.end),frontage=[];
      const north=adjacentCorridor(splitters,'horizontal',geometry.minRow-1),south=adjacentCorridor(splitters,'horizontal',geometry.maxRow+1),west=adjacentCorridor(splitters,'vertical',geometry.minCol-1),east=adjacentCorridor(splitters,'vertical',geometry.maxCol+1);
      if(north)frontage.push({edge:'north',streetId:north.id});if(south)frontage.push({edge:'south',streetId:south.id});if(west)frontage.push({edge:'west',streetId:west.id});if(east)frontage.push({edge:'east',streetId:east.id});
      if(!frontage.length)continue;
      blocks.push({schemaVersion:SCHEMA_VERSION,id:`block_${blocks.length}`,geometry,frontage,chunkIds:zc.chunksForRect(zone,geometry),profileId:profile.id});
    }
    return blocks;
  }

  function insetBuildable(parcelRect,frontageEdge,setback){
    const g={...parcelRect},s=Math.max(0,setback);
    if(s===0)return g;
    if(frontageEdge!=='west')g.minCol+=s;if(frontageEdge!=='east')g.maxCol-=s;
    if(frontageEdge!=='north')g.minRow+=s;if(frontageEdge!=='south')g.maxRow-=s;
    return g;
  }

  function rearEdge(edge){return({north:'south',south:'north',east:'west',west:'east'})[edge];}
  function alleyRectForRear(block,frontageEdge,w){
    if(frontageEdge==='north')return rect(block.minCol,block.maxRow-w+1,block.maxCol,block.maxRow);
    if(frontageEdge==='south')return rect(block.minCol,block.minRow,block.maxCol,block.minRow+w-1);
    if(frontageEdge==='west')return rect(block.maxCol-w+1,block.minRow,block.maxCol,block.maxRow);
    return rect(block.minCol,block.minRow,block.minCol+w-1,block.maxRow);
  }
  function shrinkForRear(block,frontageEdge,w){
    const g={...block};
    if(frontageEdge==='north')g.maxRow-=w;else if(frontageEdge==='south')g.minRow+=w;else if(frontageEdge==='west')g.maxCol-=w;else g.minCol+=w;
    return g;
  }
  function passageAlleyRect(buildArea,frontageEdge,start,w){
    return frontageEdge==='north'||frontageEdge==='south'?rect(start,buildArea.minRow,start+w-1,buildArea.maxRow):rect(buildArea.minCol,start,buildArea.maxCol,start+w-1);
  }

  function subdivideBlock(block={},profileInput='mixed_urban',rngInput=null){
    const profile=normalizeProfile(profileInput),rng=rngInput||createRng(block.id),frontage=rng.pick(block.frontage)||block.frontage?.[0];
    if(!frontage)return{parcels:[],alleys:[],edgeRelations:[]};
    let buildArea={...block.geometry};const alleys=[],parcels=[],edgeRelations=[];
    const depth=frontage.edge==='north'||frontage.edge==='south'?height(buildArea):width(buildArea);
    if(depth>=profile.minParcel+profile.preferredAlleyWidth+3&&rng.chance(profile.serviceAccessBias)){
      const w=Math.min(profile.preferredAlleyWidth,Math.max(1,depth-profile.minParcel-2)),g=alleyRectForRear(buildArea,frontage.edge,w);
      alleys.push({id:`alley_${block.id}_rear`,geometry:g,alleyClass:'service_alley',tags:['service_route','procedural'],blockId:block.id});
      buildArea=shrinkForRear(buildArea,frontage.edge,w);
    }
    const alongX=frontage.edge==='north'||frontage.edge==='south',start=alongX?buildArea.minCol:buildArea.minRow,end=alongX?buildArea.maxCol:buildArea.maxRow;
    let cursor=start,lastParcel=null,index=0;
    while(cursor<=end){
      const remaining=end-cursor+1;
      if(remaining<profile.minParcel){if(lastParcel){if(alongX){lastParcel.geometry.maxCol=end;lastParcel.buildable.maxCol=Math.max(lastParcel.buildable.maxCol,end-profile.setback);}else{lastParcel.geometry.maxRow=end;lastParcel.buildable.maxRow=Math.max(lastParcel.buildable.maxRow,end-profile.setback);}}break;}
      let target=rng.int(Math.max(profile.minParcel,profile.preferredParcel-3),Math.min(profile.maxParcel,profile.preferredParcel+3));
      let span=Math.min(target,remaining);
      if(remaining-span>0&&remaining-span<profile.minParcel)span=remaining;
      const pg=alongX?rect(cursor,buildArea.minRow,cursor+span-1,buildArea.maxRow):rect(buildArea.minCol,cursor,buildArea.maxCol,cursor+span-1);
      const buildable=insetBuildable(pg,frontage.edge,profile.setback);
      if(width(buildable)>=5&&height(buildable)>=5){
        const parcel={schemaVersion:SCHEMA_VERSION,id:`parcel_${block.id}_${index++}`,blockId:block.id,geometry:pg,buildable,frontage:{...frontage},serviceEdges:[],alleyEdges:[],profileId:profile.id};
        const rear=alleys.find(a=>a.alleyClass==='service_alley');if(rear)parcel.serviceEdges.push({edge:rearEdge(frontage.edge),alleyId:rear.id});
        if(lastParcel)edgeRelations.push({id:`edge_${lastParcel.id}_${parcel.id}`,parcelA:lastParcel.id,parcelB:parcel.id,relation:'attached_buildings',widthTiles:0});
        parcels.push(parcel);lastParcel=parcel;
      }
      cursor+=span;if(cursor>end)break;
      const gapW=Math.min(profile.preferredAlleyWidth,end-cursor+1);
      if(end-cursor+1>=profile.minParcel+gapW&&rng.chance(profile.alleyBias)){
        const alley= {id:`alley_${block.id}_passage_${alleys.length}`,geometry:passageAlleyRect(buildArea,frontage.edge,cursor,gapW),alleyClass:'passage_alley',tags:['pedestrian','service_route','procedural'],blockId:block.id};
        alleys.push(alley);
        if(lastParcel){lastParcel.alleyEdges.push({edge:alongX?'east':'south',alleyId:alley.id});const rel=edgeRelations[edgeRelations.length-1];if(rel&&rel.parcelA===lastParcel.id&&!parcels.some(p=>p.id===rel.parcelB))edgeRelations.pop();}
        cursor+=gapW;lastParcel=null;
      }
    }
    for(let i=0;i<parcels.length-1;i++){
      const a=parcels[i],b=parcels[i+1];
      const touching=alongX?a.geometry.maxCol+1===b.geometry.minCol:a.geometry.maxRow+1===b.geometry.minRow;
      if(!edgeRelations.some(r=>r.parcelA===a.id&&r.parcelB===b.id)){
        const gap=alleys.find(x=>alongX?x.geometry.minCol>a.geometry.maxCol&&x.geometry.maxCol<b.geometry.minCol:x.geometry.minRow>a.geometry.maxRow&&x.geometry.maxRow<b.geometry.minRow);
        edgeRelations.push({id:`edge_${a.id}_${b.id}`,parcelA:a.id,parcelB:b.id,relation:touching?'attached_buildings':'alley',widthTiles:gap?(alongX?width(gap.geometry):height(gap.geometry)):0,alleyId:gap?.id||null});
      }
    }
    return{parcels,alleys,edgeRelations};
  }

  function generateFabricPlan(zoneInput={},profileInput='mixed_urban',rngInput=null){
    const zc=zoneCore();if(!zc)throw new Error('PROCEDURAL_ZONE_CORE_REQUIRED');
    const zone=zc.normalizeZone(zoneInput),profile=normalizeProfile(profileInput),rng=rngInput||createRng(zone.seed||zone.id);
    const streets=generateStreetNetwork(zone,profile,rng),blocks=deriveBlocks(zone,streets,profile),parcels=[],alleys=[],edgeRelations=[];
    for(const block of blocks){
      const part=subdivideBlock(block,profile,rng);parcels.push(...part.parcels);alleys.push(...part.alleys);edgeRelations.push(...part.edgeRelations);
    }
    for(const parcel of parcels)parcel.chunkIds=zc.chunksForRect(zone,parcel.geometry);
    return{schemaVersion:SCHEMA_VERSION,zone,profile,streets,blocks,parcels,alleys,edgeRelations};
  }

  function validateFabric(plan={}){
    const zone=plan.zone||{},errors=[],warnings=[],parcels=plan.parcels||[],streets=plan.streets||[],alleys=plan.alleys||[];
    if(!streets.length)errors.push({code:'FABRIC_STREET_REQUIRED'});
    for(const s of streets){if(!inside(s.geometry,zone))errors.push({code:'FABRIC_STREET_OUT_OF_BOUNDS',streetId:s.id});if(s.kind==='street'){const spans=s.orientation==='vertical'?s.geometry.minRow===0&&s.geometry.maxRow===zone.rows-1:s.geometry.minCol===0&&s.geometry.maxCol===zone.cols-1;if(!spans)errors.push({code:'FABRIC_STREET_CONTINUITY_BROKEN',streetId:s.id});}}
    for(const a of alleys)if(!inside(a.geometry,zone))errors.push({code:'FABRIC_ALLEY_OUT_OF_BOUNDS',alleyId:a.id});
    for(const p of parcels){
      if(!inside(p.geometry,zone)||!inside(p.buildable,zone))errors.push({code:'FABRIC_PARCEL_OUT_OF_BOUNDS',parcelId:p.id});
      if(!p.frontage?.streetId)errors.push({code:'FABRIC_PARCEL_FRONTAGE_REQUIRED',parcelId:p.id});
      if(streets.some(s=>intersects(p.geometry,s.geometry)))errors.push({code:'FABRIC_PARCEL_OVERLAPS_STREET',parcelId:p.id});
      if(alleys.some(a=>intersects(p.geometry,a.geometry)))errors.push({code:'FABRIC_PARCEL_OVERLAPS_ALLEY',parcelId:p.id});
    }
    for(let i=0;i<parcels.length;i++)for(let j=i+1;j<parcels.length;j++)if(intersects(parcels[i].geometry,parcels[j].geometry))errors.push({code:'FABRIC_PARCEL_OVERLAP',parcelA:parcels[i].id,parcelB:parcels[j].id});
    const ids=new Set(parcels.map(p=>p.id));for(const r of plan.edgeRelations||[])if(!ids.has(r.parcelA)||!ids.has(r.parcelB))warnings.push({code:'FABRIC_EDGE_RELATION_ORPHANED',edgeId:r.id});
    return{valid:errors.length===0,errors,warnings,summary:{streets:streets.length,blocks:(plan.blocks||[]).length,parcels:parcels.length,alleys:alleys.length,edgeRelations:(plan.edgeRelations||[]).length}};
  }

  return Object.freeze({
    SCHEMA_VERSION,PROFILES,hash32,createRng,normalizeProfile,rect,width,height,intersects,inside,
    generateStreetNetwork,mergeBands,complements,deriveBlocks,subdivideBlock,generateFabricPlan,validateFabric,
  });
});
