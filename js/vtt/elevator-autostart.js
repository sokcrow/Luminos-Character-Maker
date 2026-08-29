import { start } from './elevator-bootstrap.js';
function boot(attempt=0){const runtime=window.LuminousVttRuntime;if(runtime?.engine&&runtime?.verticalBridge){const api=start({runtime,mapData:runtime.engine.mapData});if(api)window.addEventListener('beforeunload',()=>api.stop?.(),{once:true});return;}if(attempt<100)window.setTimeout(()=>boot(attempt+1),100);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
