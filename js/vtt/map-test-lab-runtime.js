import {TEST_LAB_ID,TEST_LAB_IDS,TEST_LAB_UPPER_ELEVATION_FT,labStructures,labScenarioMatrix} from './map-test-lab.js';

const MODE_KEY='luminous:vtt:test-lab-mode';
const MODES=Object.freeze(['control','structures','elevation','all']);
const clean=value=>String(value??'').trim();

function isLabMap(mapData={}){
  return clean(mapData.id||mapData.mapId)===TEST_LAB_ID;
}

function ensureUpperLevel(mapData={}){
  mapData.zLevels||={};
  if(!mapData.zLevels['1']){
    mapData.zLevels['1']={zLayer:1,elevationFt:TEST_LAB_UPPER_ELEVATION_FT,label:'Elevation Lab',background:{url:'',storagePath:'',fit:'stretch',opacity:1}};
  }
}

function removeLabStructures(mapData={}){
  const ids=new Set(TEST_LAB_IDS.structures);
  mapData.structures=(Array.isArray(mapData.structures)?mapData.structures:[]).filter(entry=>!ids.has(clean(entry?.id)));
  globalThis.LuminousVttStructureCore?.ensureMapState?.(mapData);
}

function addLabStructures(mapData={}){
  const core=globalThis.LuminousVttStructureCore;
  core?.ensureMapState?.(mapData);
  const current=Array.isArray(mapData.structures)?mapData.structures:[];
  const ids=new Set(current.map(entry=>clean(entry?.id)));
  const incoming=labStructures().filter(entry=>!ids.has(entry.id)).map(entry=>core?.normalizeInstance?.(entry,mapData)||entry);
  mapData.structures=[...current,...incoming];
  core?.ensureMapState?.(mapData);
}

function labPortals(root,mapData={}){
  ensureUpperLevel(mapData);
  const portals=root?.LuminousVttVerticalPortal;
  const ramps=root?.LuminousVttRamp;
  const result=[];
  if(ramps?.createRampPortal){
    const ramp=ramps.createRampPortal({
      from:{col:4,row:20},to:{col:10,row:20},fromZ:0,toZ:1,mapData,widthFt:5,maxGrade:.5,costMultiplier:1,railings:true,
    });
    result.push({...ramp,id:TEST_LAB_IDS.ramp});
  }
  if(portals?.createPortal){
    const stairs=portals.createPortal({
      type:'stairs',from:{col:4,row:28},to:{col:7,row:28},fromZ:0,toZ:1,mapData,layout:'straight',widthFt:5,
    });
    result.push({...stairs,id:TEST_LAB_IDS.stairs,state:'open',allowsMovement:true,bidirectional:true});
  }
  return result;
}

function emitDirty(root,engine,mode){
  root?.LuminousVttSceneDirty?.emit?.(engine.canvas,{reason:'topology',render:true,vision:true,active:false,sourceEvent:'test-lab:mode',meta:{mode}});
}

async function applyMode(root,engine,mode){
  const normalized=MODES.includes(mode)?mode:'control';
  const mapData=engine.mapData;
  if(!isLabMap(mapData))throw new Error('TEST_LAB_NOT_ACTIVE');
  ensureUpperLevel(mapData);
  removeLabStructures(mapData);
  if(normalized==='structures'||normalized==='all')addLabStructures(mapData);

  const bridge=root?.LuminousVttRuntime?.verticalBridge;
  if(bridge?.replaceAll){
    const labIds=new Set([TEST_LAB_IDS.ramp,TEST_LAB_IDS.stairs]);
    const keep=(Array.isArray(mapData.verticalPortals)?mapData.verticalPortals:[]).filter(portal=>!labIds.has(clean(portal?.id)));
    const add=(normalized==='elevation'||normalized==='all')?labPortals(root,mapData):[];
    await bridge.replaceAll([...keep,...add]);
  }else{
    const labIds=new Set([TEST_LAB_IDS.ramp,TEST_LAB_IDS.stairs]);
    const keep=(Array.isArray(mapData.verticalPortals)?mapData.verticalPortals:[]).filter(portal=>!labIds.has(clean(portal?.id)));
    mapData.verticalPortals=[...keep,...((normalized==='elevation'||normalized==='all')?labPortals(root,mapData):[])];
  }

  try{root.sessionStorage?.setItem?.(MODE_KEY,normalized);}catch(_){}
  emitDirty(root,engine,normalized);
  return normalized;
}

function tokenReadout(engine){
  const token=engine.viewerToken?.()||engine.mapData?.tokens?.[0]||null;
  if(!token)return'No token loaded';
  const z=Number(token.zLayer??token.gridPosition?.z??token.z?.[0]??0)||0;
  const elevation=Number(token.elevationFt)||0;
  return`${clean(token.name||token.id||'TOKEN')} · x ${Number(token.x||0).toFixed(1)} · y ${Number(token.y||0).toFixed(1)} · Z${z} · ${elevation.toFixed(2)} ft`;
}

function mountPanel(root,engine,api){
  const documentRef=root?.document;
  if(!documentRef||documentRef.getElementById('vtt-test-lab-panel'))return documentRef?.getElementById('vtt-test-lab-panel')||null;
  const matrix=labScenarioMatrix();
  const panel=documentRef.createElement('aside');
  panel.id='vtt-test-lab-panel';
  panel.setAttribute('aria-label','Luminous Test Lab controls');
  Object.assign(panel.style,{position:'fixed',right:'14px',bottom:'14px',zIndex:'10050',width:'360px',maxHeight:'48vh',overflow:'auto',padding:'12px',background:'rgba(10,10,12,.94)',border:'1px solid #8f969d',font:'12px monospace',color:'#eef1f3',boxShadow:'0 8px 24px rgba(0,0,0,.45)'});
  panel.innerHTML=`
    <strong style="display:block;margin-bottom:8px">LUMINOUS TEST LAB // MOVEMENT</strong>
    <div data-lab-modes style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      <button type="button" data-lab-mode="control">CONTROL</button>
      <button type="button" data-lab-mode="structures">STRUCTURES</button>
      <button type="button" data-lab-mode="elevation">ELEVATION</button>
      <button type="button" data-lab-mode="all">ALL</button>
    </div>
    <div data-lab-status style="margin-bottom:8px">Ready</div>
    <div data-lab-token style="margin-bottom:10px">${tokenReadout(engine)}</div>
    <div style="line-height:1.45">
      <div><b>CONTROL / STRUCTURES:</b> C${matrix.control.from.col},R${matrix.control.from.row} → C${matrix.control.to.col},R${matrix.control.to.row}. Same A→B; STRUCTURES adds physical blockers.</div>
      <div style="margin-top:6px"><b>RAMP:</b> Z0 C${matrix.ramp.from.col},R${matrix.ramp.from.row} → Z1 C${matrix.ramp.to.col},R${matrix.ramp.to.row}. Drop on the entry; elevation must rise continuously.</div>
      <div style="margin-top:6px"><b>STAIRS:</b> Z0 C${matrix.stairs.from.col},R${matrix.stairs.from.row} → Z1 C${matrix.stairs.to.col},R${matrix.stairs.to.row}. No cell-center teleport.</div>
    </div>`;
  documentRef.body.appendChild(panel);
  const status=panel.querySelector('[data-lab-status]');
  const token=panel.querySelector('[data-lab-token]');
  for(const button of panel.querySelectorAll('[data-lab-mode]')){
    button.addEventListener('click',async()=>{
      const mode=button.dataset.labMode;
      panel.querySelectorAll('[data-lab-mode]').forEach(node=>{node.disabled=true;});
      status.textContent=`Applying ${mode}…`;
      try{
        const applied=await api.setMode(mode);
        status.textContent=`MODE: ${applied.toUpperCase()}`;
        panel.dataset.mode=applied;
      }catch(error){status.textContent=clean(error?.message||error)||'TEST_LAB_MODE_FAILED';}
      finally{panel.querySelectorAll('[data-lab-mode]').forEach(node=>{node.disabled=false;});}
    });
  }
  const refresh=()=>{token.textContent=tokenReadout(engine);};
  engine.canvas?.addEventListener?.('vtt:token-preview-moved',refresh);
  engine.canvas?.addEventListener?.('vtt:token-moved',refresh);
  api._panelStop=()=>{
    engine.canvas?.removeEventListener?.('vtt:token-preview-moved',refresh);
    engine.canvas?.removeEventListener?.('vtt:token-moved',refresh);
    panel.remove();
  };
  return panel;
}

export function installTestLabRuntime(root=globalThis,engine=root?.LuminousVttRuntime?.engine){
  if(!engine||!isLabMap(engine.mapData))return null;
  if(engine.__testLabMechanicRuntime)return engine.__testLabMechanicRuntime;
  const api={
    mode:'control',
    _panelStop:null,
    async setMode(mode){this.mode=await applyMode(root,engine,mode);return this.mode;},
    stop(){this._panelStop?.();if(engine.__testLabMechanicRuntime===this)delete engine.__testLabMechanicRuntime;},
  };
  engine.__testLabMechanicRuntime=api;
  root.LuminousVttTestLabRuntime=api;
  mountPanel(root,engine,api);
  let initial='control';
  try{const saved=root.sessionStorage?.getItem?.(MODE_KEY);if(MODES.includes(saved))initial=saved;}catch(_){}
  void api.setMode(initial).then(mode=>{const panel=root.document?.getElementById?.('vtt-test-lab-panel');if(panel){panel.dataset.mode=mode;const status=panel.querySelector('[data-lab-status]');if(status)status.textContent=`MODE: ${mode.toUpperCase()}`;}}).catch(error=>root?.console?.error?.('VTT Test Lab mode init failed:',error));
  return api;
}

export function startTestLabRuntime(root=globalThis){
  let attempts=0,stopped=false,installed=null;
  const tick=()=>{
    if(stopped||installed)return;
    const engine=root?.LuminousVttRuntime?.engine;
    if(engine){installed=installTestLabRuntime(root,engine);if(!isLabMap(engine.mapData))return;}
    attempts+=1;
    if(!installed&&attempts<240)root?.setTimeout?.(tick,25);
  };
  tick();
  return Object.freeze({stop(){stopped=true;installed?.stop?.();}});
}

if(typeof window!=='undefined')window.LuminousVttTestLabMechanicBootstrap=startTestLabRuntime(window);
