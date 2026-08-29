import './ramp-core.js';
import './ramp-portal-patch.js';
import './ramp-route-patch.js';
import './ramp-movement-patch.js';
import './ramp-renderer-patch.js';

export function start({runtime=window.LuminousVttRuntime,mapData=runtime?.engine?.mapData}={}){
  if(!runtime?.engine||!mapData)return null;
  if(window.LuminousVttRampRuntime?.api)return window.LuminousVttRampRuntime.api;
  window.LuminousVttRampPortalPatch?.install?.();
  window.LuminousVttRampRoutePatch?.install?.();
  window.LuminousVttRampMovementPatch?.install?.();
  const portals=window.LuminousVttVerticalPortal,core=window.LuminousVttRamp;
  if(!portals||!core)throw new Error('RAMP_RUNTIME_REQUIRED');
  mapData.verticalPortals=(mapData.verticalPortals||[]).map(p=>p?.type==='ramp'?portals.normalizePortal(p,mapData):p);
  const stopRenderer=window.LuminousVttRampRendererPatch?.install?.(runtime.engine.renderer,mapData)||(()=>{});
  let stopped=false;
  const api=Object.freeze({core,validate:(p)=>core.validate(p,mapData),stop(){if(stopped)return;stopped=true;stopRenderer();}});
  window.LuminousVttRampRuntime={api};
  window.LuminousVttRuntime=Object.freeze({...window.LuminousVttRuntime,ramps:api});
  return api;
}

function boot(attempt=0){const runtime=window.LuminousVttRuntime;if(runtime?.engine){const api=start({runtime,mapData:runtime.engine.mapData});if(api)window.addEventListener('beforeunload',()=>api.stop?.(),{once:true});return;}if(attempt<100)window.setTimeout(()=>boot(attempt+1),100);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
