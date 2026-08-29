import './elevator-core.js';
import './elevator-portal-patch.js';
import './elevator-state-patch.js';
import './floor-opening-core.js';
import './elevator-renderer-patch.js';

const PANEL_ID='vtt-elevator-panel',STYLE_ID='vtt-elevator-style';
const clean=v=>String(v??'').trim();

export function start({runtime=window.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData)return null;
  if(window.LuminousVttElevatorRuntime?.api)return window.LuminousVttElevatorRuntime.api;
  window.LuminousVttElevatorPortalPatch?.install?.();window.LuminousVttElevatorStatePatch?.install?.();
  const core=window.LuminousVttElevator,portals=window.LuminousVttVerticalPortal,openingCore=window.LuminousVttFloorOpenings;
  if(!core||!portals)throw new Error('ELEVATOR_RUNTIME_REQUIRED');
  mapData.verticalPortals=(mapData.verticalPortals||[]).map(p=>p?.type==='elevator'?portals.normalizePortal(p,mapData):p);
  const engine=runtime.engine,canvas=engine.canvas,verticalBridge=runtime.verticalBridge,isDm=Boolean(runtime.bridge?.isDm),tokenBridge=runtime.tokenStateBridge;
  const stopRenderer=window.LuminousVttElevatorRendererPatch?.install?.(engine.renderer,mapData)||(()=>{});
  let panel=null,panelElevatorId=null,stopped=false,finishing=new Set(),tickTimer=null,panelTimer=null;

  function activeZ(){return Number(engine.activeZ)||0;}
  function elevatorById(id){const raw=(mapData.verticalPortals||[]).find(p=>p?.type==='elevator'&&clean(p.id)===clean(id));return raw?portals.normalizePortal(raw,mapData):null;}
  function upsertLocal(portal){const list=Array.isArray(mapData.verticalPortals)?mapData.verticalPortals:[],i=list.findIndex(p=>clean(p.id)===clean(portal.id));if(i>=0)list[i]=portal;else list.push(portal);mapData.verticalPortals=list;return portal;}
  function requesterToken(request={}){const pid=clean(request.playerId),uid=clean(request.requesterUid),aid=clean(request.actorId);return(mapData.tokens||[]).find(t=>(pid&&clean(t.canonicalPlayerKey||t.playerId)===pid)||(uid&&clean(t.canonicalOwnerUid||t.ownerUid)===uid)||(aid&&clean(t.actorId)===aid))||null;}
  function localViewer(){return(mapData.tokens||[]).find(t=>t.viewer===true)||(mapData.tokens||[]).find(t=>t.characterLink?.mode==='current_player')||null;}
  function feetPerPixel(){return Math.max(.001,Number(mapData.grid?.distancePerCell)||5)/Math.max(1,Number(mapData.grid?.size)||70);}
  function distanceToCabin(token,portal){if(!token)return Infinity;const r=core.footprintRect(portal,mapData),x=Number(token.x)||0,y=Number(token.y)||0,dx=Math.max(r.x-x,0,x-(r.x+r.width)),dy=Math.max(r.y-y,0,y-(r.y+r.height));return Math.hypot(dx,dy)*feetPerPixel();}
  function canRequester(request,portal,action,targetZ){if(isDm&&!clean(request.requesterUid)&&!clean(request.playerId))return{valid:true};const token=requesterToken(request);if(!token)return{valid:false,reason:'ELEVATOR_REQUESTER_TOKEN_REQUIRED'};if(action==='go'){if(core.tokenLayer(token)!==Number(portal.currentZ)||!core.pointInFootprint(portal,token,mapData))return{valid:false,reason:'ELEVATOR_CABIN_REQUIRED'};return{valid:true,token};}if(action==='call'){if(core.tokenLayer(token)!==Number(targetZ)||distanceToCabin(token,portal)>5+1e-9)return{valid:false,reason:'ELEVATOR_CALL_OUT_OF_REACH'};return{valid:true,token};}return{valid:true,token};}
  function circuitPowered(portal){if(portal.powered===false)return false;if(!portal.circuitId)return true;const light=window.LuminousVttRuntime?.lighting?.engine||window.LuminousVttLightingEngine,scene=mapData.lighting?.scene;if(!light?.circuitPower||!scene)return portal.powered!==false;return light.circuitPower(scene,portal.circuitId).powered!==false;}
  async function savePortal(portal){upsertLocal(portal);const saved=await verticalBridge?.savePortal?.(portal);return saved||portal;}
  async function saveTokens(tokens=[]){for(const token of tokens)await tokenBridge?.saveToken?.(token);}
  async function persistDefinition(){const authoring=window.LuminousVttMapAuthoring,bridge=window.LuminousVttRuntime?.mapAuthoring?.bridge;if(authoring?.definitionFromMapData&&bridge?.saveDefinition)await bridge.saveDefinition(authoring.definitionFromMapData(mapData));}
  function ensureShaftOpenings(raw){if(!openingCore)return[];const portal=portals.normalizePortal(raw,mapData),specs=core.shaftOpeningSpecs(portal,mapData),existing=new Map((mapData.floorOpenings||[]).map(o=>[clean(o.id),o]));for(const spec of specs)existing.set(spec.id,openingCore.normalizeOpening(spec,mapData));mapData.floorOpenings=[...existing.values()];window.LuminousVttSurfaceCore?.syncFloorOpeningTerrain?.(mapData);canvas.dispatchEvent(new CustomEvent('vtt:floor-opening-changed',{detail:{reason:'elevator-shaft',elevatorId:portal.id}}));return specs;}
  function removeShaftOpenings(elevatorId){const prefix=`floor_shaft_${clean(elevatorId)}_`;const before=(mapData.floorOpenings||[]).length;mapData.floorOpenings=(mapData.floorOpenings||[]).filter(o=>!clean(o.id).startsWith(prefix));window.LuminousVttSurfaceCore?.syncFloorOpeningTerrain?.(mapData);return before-mapData.floorOpenings.length;}
  async function registerElevator(raw){const portal=portals.normalizePortal(raw,mapData);upsertLocal(portal);ensureShaftOpenings(portal);await persistDefinition();return portal;}
  async function unregisterElevator(id){removeShaftOpenings(id);await persistDefinition();return true;}

  async function handleRequest(request={}){
    const portal=elevatorById(request.elevatorId);if(!portal)return{valid:false,reason:'ELEVATOR_NOT_FOUND'};
    const action=['call','go','open','close'].includes(clean(request.action))?clean(request.action):'go',targetZ=Number(request.targetZ);
    if(!circuitPowered(portal))return{valid:false,reason:'ELEVATOR_UNPOWERED'};
    const auth=canRequester(request,portal,action,targetZ);if(!auth.valid)return auth;
    if(action==='open'||action==='close'){const changed=core.setDoor(portal,action==='open'?'open':'closed',mapData);if(!changed.valid)return changed;await savePortal(changed.portal);return{valid:true,portal:changed.portal};}
    const passengers=core.tokensInCabin(portal,mapData.tokens,mapData),passengerIds=passengers.map(t=>clean(t.id)).filter(Boolean),trip=core.beginTrip(portal,targetZ,mapData,Date.now(),passengerIds);if(!trip.valid)return trip;
    if(trip.alreadyThere){await savePortal(trip.portal);return{valid:true,alreadyThere:true,portal:trip.portal};}
    core.attachPassengers(mapData.tokens,trip.portal,mapData);await savePortal(trip.portal);await saveTokens(passengers);canvas.dispatchEvent(new CustomEvent('vtt:elevator-trip-start',{detail:{elevatorId:portal.id,fromZ:portal.currentZ,toZ:targetZ,passengerIds}}));return{valid:true,portal:trip.portal,travelMs:trip.travelMs,passengerIds};
  }

  async function finishTrip(raw){const portal=portals.normalizePortal(raw,mapData);if(finishing.has(portal.id))return;finishing.add(portal.id);try{const done=core.completeTrip(portal,mapData,Date.now());if(!done.valid)return;const passengers=(mapData.tokens||[]).filter(t=>done.passengerIds.includes(clean(t.id)));core.arrivePassengers(mapData.tokens,done.passengerIds,done.arrivedZ,mapData);await savePortal(done.portal);await saveTokens(passengers);canvas.dispatchEvent(new CustomEvent('vtt:elevator-arrived',{detail:{elevatorId:portal.id,targetZ:done.arrivedZ,passengerIds:done.passengerIds}}));runtime.controller?.notify?.(`Elevador llegó a Z${done.arrivedZ}.`,'success');}finally{finishing.delete(portal.id);}}
  function tick(){const now=Date.now();for(const raw of mapData.verticalPortals||[]){if(raw?.type!=='elevator')continue;const portal=portals.normalizePortal(raw,mapData);if(portal.motionState!=='moving')continue;core.updatePassengerElevation(mapData.tokens,portal,mapData,now);if(isDm&&now+1>=portal.arriveAt)void finishTrip(portal);}renderPanel();}

  function ensureUi(){if(!document.getElementById(STYLE_ID)){const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`#${PANEL_ID}{position:fixed;right:18px;bottom:18px;z-index:34000;width:min(320px,calc(100vw - 36px));background:#10100d;border:2px solid #f3d35b;box-shadow:6px 6px 0 #000;color:#fff;padding:12px;font:12px monospace}#${PANEL_ID}[hidden]{display:none}#${PANEL_ID} header{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}#${PANEL_ID} .elevator-status{padding:7px;border:1px solid #6f642c;margin:7px 0;line-height:1.5}#${PANEL_ID} .elevator-stops{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}#${PANEL_ID} button{min-height:34px}`;document.head.appendChild(style);}panel=document.getElementById(PANEL_ID);if(!panel){panel=document.createElement('aside');panel.id=PANEL_ID;panel.hidden=true;document.body.appendChild(panel);}return panel;}
  async function request(portal,targetZ,action){const result=await verticalBridge?.requestElevatorAction?.(portal.id,targetZ,action);if(result?.valid===false)runtime.controller?.notify?.(result.reason||'Elevador no disponible.','error');else runtime.controller?.notify?.(result?.pending?'Solicitud de elevador enviada.':'Elevador activado.','success');renderPanel();return result;}
  function renderPanel(){if(!panel||!panelElevatorId)return;const portal=elevatorById(panelElevatorId);if(!portal){panel.hidden=true;panelElevatorId=null;return;}const viewer=localViewer(),viewerInside=viewer&&core.tokenLayer(viewer)===Number(portal.currentZ)&&core.pointInFootprint(portal,viewer,mapData),atViewedFloor=Number(portal.currentZ)===activeZ(),moving=portal.motionState==='moving',powered=circuitPowered(portal);panel.hidden=false;const status=moving?`MOVIENDO · Z${portal.currentZ} → Z${portal.targetZ}`:`CABINA Z${portal.currentZ} · PUERTA ${portal.doorState.toUpperCase()}`;panel.innerHTML=`<header><strong>${portal.label||'ELEVATOR'}</strong><button type="button" data-elevator-close>×</button></header><div class="elevator-status">${status}<br>${powered?'POWERED':'NO POWER'}${portal.circuitId?` · CIRCUIT ${portal.circuitId}`:''}</div><div class="elevator-stops"></div>`;const stops=panel.querySelector('.elevator-stops');if(!moving&&powered){if(atViewedFloor&&viewerInside){for(const z of portal.stops){const b=document.createElement('button');b.type='button';b.className='brutalist-button';b.textContent=z===portal.currentZ?`Z${z} · HERE`:`GO Z${z}`;b.disabled=z===portal.currentZ;b.onclick=()=>request(portal,z,'go');stops.appendChild(b);}}else{const z=activeZ();if(portal.stops.includes(z)){const b=document.createElement('button');b.type='button';b.className='brutalist-button';b.textContent=atViewedFloor?'OPEN / ENTER':`CALL Z${z}`;b.onclick=()=>request(portal,z,atViewedFloor?'open':'call');stops.appendChild(b);}}}panel.querySelector('[data-elevator-close]')?.addEventListener('click',()=>{panel.hidden=true;panelElevatorId=null;});}
  function onDoubleClick(event){const point=engine.eventWorldPoint(event),portal=core.hitTest(mapData.verticalPortals,point,mapData,activeZ());if(!portal)return;event.preventDefault();event.stopImmediatePropagation();panelElevatorId=portal.id;ensureUi();renderPanel();}

  ensureUi();canvas.addEventListener('dblclick',onDoubleClick,true);tickTimer=window.setInterval(tick,100);panelTimer=window.setInterval(renderPanel,500);
  const api=Object.freeze({core,handleRequest,registerElevator,unregisterElevator,ensureShaftOpenings,removeShaftOpenings,openPanel(id){panelElevatorId=id;ensureUi();renderPanel();},stop(){if(stopped)return;stopped=true;window.clearInterval(tickTimer);window.clearInterval(panelTimer);canvas.removeEventListener('dblclick',onDoubleClick,true);stopRenderer();panel?.remove();document.getElementById(STYLE_ID)?.remove();}});
  window.LuminousVttElevatorRuntime={api};window.LuminousVttRuntime=Object.freeze({...window.LuminousVttRuntime,elevators:api});return api;
}
