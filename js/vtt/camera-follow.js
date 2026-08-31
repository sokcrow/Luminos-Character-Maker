(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttCameraFollow = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  const clean = (value) => String(value ?? '').trim();
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  function normalizeKey(value) { return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function layerOf(token = {}) { if (Number.isFinite(Number(token.zLayer))) return Number(token.zLayer); if (Number.isFinite(Number(token.gridPosition?.z))) return Number(token.gridPosition.z); if (Array.isArray(token.z) && token.z.length) return Number(token.z[0]) || 0; return 0; }
  function controlledToken({ runtime, mapData, targetId = null } = {}) {
    const tokens = Array.isArray(mapData?.tokens) ? mapData.tokens : [];
    if (targetId) { const explicit = tokens.find((token) => clean(token.id) === clean(targetId)); if (explicit) return explicit; }
    const isDm = Boolean(runtime?.bridge?.isDm || runtime?.tokenState?.isDm);
    if (isDm) { const previewId = mapData?.lighting?.dmPreviewTokenId; if (!previewId) return null; return tokens.find((token) => clean(token.id) === clean(previewId)) || null; }
    const viaPov = runtime?.pov?.controlledViewers?.()?.[0] || runtime?.lighting?.controlledViewers?.()?.[0];
    if (viaPov) return viaPov;
    return tokens.find((token) => token.viewer === true) || tokens.find((token) => token.characterLink?.mode === 'current_player') || null;
  }
  function modifierFromSkillValue(value) { if (Number.isFinite(Number(value))) return Number(value); if (!value || typeof value !== 'object') return null; for (const key of ['modifier','mod','bonus','total','value','valor']) if (Number.isFinite(Number(value[key]))) return Number(value[key]); return null; }
  function modifierFromCarrier(carrier = {}) {
    if (!carrier || typeof carrier !== 'object') return null;
    for (const key of ['perceptionModifier','perceptionMod','percepcionModifier','percepcionMod','modifierPerception','modifierPercepcion']) if (Number.isFinite(Number(carrier[key]))) return Number(carrier[key]);
    const containers = [carrier.skills, carrier.habilidades, carrier.skillModifiers, carrier.skill_modifiers, carrier.characterBuild?.skills, carrier.characterBuild?.habilidades, carrier.build?.skills, carrier.build?.habilidades].filter((entry) => entry && typeof entry === 'object');
    for (const container of containers) for (const [key, value] of Object.entries(container)) { if (!['perception','percepcion'].includes(normalizeKey(key))) continue; const modifier = modifierFromSkillValue(value); if (modifier != null) return modifier; }
    return null;
  }
  function perceptionModifier(token = {}, host = root) { for (const carrier of [token, token.actor, token.raw, token.character, token.characterBuild, token.build, host?.datosJugador]) { const modifier = modifierFromCarrier(carrier); if (modifier != null) return Math.max(-10, Math.min(20, modifier)); } return 0; }
  function cameraPolicyForModifier(modifier = 0) { const mod = finite(modifier, 0); let minZoom = 0.85; if (mod <= -2) minZoom = 0.90; else if (mod <= 0) minZoom = 0.85; else if (mod <= 2) minZoom = 0.75; else if (mod <= 4) minZoom = 0.65; else if (mod <= 6) minZoom = 0.55; else minZoom = 0.50; return Object.freeze({ perceptionModifier: mod, minZoom, maxZoom: 5, maxLookFt: Math.max(40, Math.min(140, 60 + (mod * 10))) }); }
  function feetToPixels(feet, mapData = {}) { const gridSize = Math.max(1, finite(mapData.grid?.size, 70)); const distancePerCell = Math.max(0.001, finite(mapData.grid?.distancePerCell, 5)); return (Math.max(0, finite(feet)) / distancePerCell) * gridSize; }
  function clampPointAround(point = {}, target = {}, radiusPx = 0) { const x=finite(point.x),y=finite(point.y),tx=finite(target.x),ty=finite(target.y),radius=Math.max(0,finite(radiusPx)),dx=x-tx,dy=y-ty,distance=Math.hypot(dx,dy); if (!radius || distance <= radius) return {x,y,clamped:false}; const scale=radius/distance; return {x:tx+(dx*scale),y:ty+(dy*scale),clamped:true}; }
  function tokenRulesActive({ isDm = false, mapData = {}, token = null } = {}) { if (!token) return false; if (!isDm) return true; return Boolean(mapData.lighting?.dmPreviewTokenId); }
  function isEditableTarget(target) { const tag=String(target?.tagName||'').toLowerCase(); return Boolean(target?.isContentEditable || ['input','textarea','select','button'].includes(tag)); }

  function createController({ runtime, mapData = runtime?.engine?.mapData, root: host = root } = {}) {
    const engine=runtime?.engine,camera=engine?.camera,canvas=engine?.canvas;
    if (!engine || !camera || !canvas || !mapData) throw new Error('CAMERA_FOLLOW_RUNTIME_REQUIRED');
    const isDm=Boolean(runtime?.bridge?.isDm || runtime?.tokenState?.isDm);
    let enabled=!isDm,targetId=null,stopped=false,lastSignature='',lastPolicyKey='';
    const liveRuntime=()=>host?.LuminousVttRuntime||runtime;
    const target=()=>controlledToken({runtime:liveRuntime(),mapData,targetId});
    function policyState(){const token=target(),active=tokenRulesActive({isDm,mapData,token});if(!active)return{active:false,token,perceptionModifier:null,minZoom:.1,maxZoom:5,maxLookFt:null};return{active:true,token,...cameraPolicyForModifier(perceptionModifier(token,host))};}
    function applyPolicy(force=false){const policy=policyState(),key=policy.active?`${clean(policy.token?.id)}|${policy.perceptionModifier}|${policy.minZoom}|${policy.maxLookFt}`:'free';if(force||key!==lastPolicyKey){lastPolicyKey=key;if(policy.active){camera.setZoomBounds?.(policy.minZoom,policy.maxZoom);const radiusPx=feetToPixels(policy.maxLookFt,mapData);camera.setCenterConstraint?.((point)=>{const liveToken=target();return liveToken?clampPointAround(point,liveToken,radiusPx):point;});}else{camera.setCenterConstraint?.(null);camera.setZoomBounds?.(.1,5);}}camera.enforceCenterConstraint?.();return policy;}
    function state(){const policy=policyState(),token=policy.token,mode=enabled?'follow':policy.active?'look':'free';return{enabled,targetId:token?clean(token.id):targetId,hasTarget:Boolean(token),targetLayer:token?layerOf(token):null,mode,isDm,tokenRules:policy.active,perceptionModifier:policy.perceptionModifier,minZoom:policy.minZoom,maxZoom:policy.maxZoom,maxLookFt:policy.maxLookFt};}
    const emit=(reason='sync')=>{const detail={...state(),reason};const EventCtor=host?.CustomEvent||root?.CustomEvent||globalThis.CustomEvent;if(typeof EventCtor==='function')canvas.dispatchEvent(new EventCtor('vtt:camera-follow-changed',{detail}));return detail;};
    function signature(token){if(!token)return'';return[clean(token.id),Number(token.x)||0,Number(token.y)||0,layerOf(token)].join('|');}
    function center(reason='follow'){if(!enabled||stopped)return false;const token=target();if(!token)return false;applyPolicy();const ok=camera.centerOnWorldPoint?.({x:token.x,y:token.y})===true;if(ok){lastSignature=signature(token);emit(reason);}return ok;}
    function sync(reason='state-sync',{forceCenter=false}={}){if(stopped)return state();const token=target();applyPolicy();if(!token){lastSignature='';emit(reason);return state();}if(enabled&&(forceCenter||signature(token)!==lastSignature))center(reason);else if(!enabled&&camera.enforceCenterConstraint?.())emit('look-clamped');return state();}
    function setEnabled(value,{reason='user',centerNow=true}={}){const token=target(),next=Boolean(value)&&Boolean(token);if(enabled===next){applyPolicy();if(next&&centerNow)center(reason);return state();}enabled=next;applyPolicy(true);if(enabled&&centerNow)center(reason);else emit(reason);return state();}
    function toggle(){return setEnabled(!enabled,{reason:enabled?'look-around':'follow'});}
    function setTarget(id,{follow=true}={}){targetId=clean(id)||null;if(follow&&target())enabled=true;lastSignature='';applyPolicy(true);if(enabled)center('target');else emit('target');return state();}
    function clearTarget(){targetId=null;lastSignature='';applyPolicy(true);if(enabled)center('target-clear');else emit('target-clear');return state();}
    function recenter(){if(!target())return false;enabled=true;lastSignature='';applyPolicy(true);return center('recenter');}
    const onManualPan=()=>{const policy=applyPolicy();if(enabled){enabled=false;emit(policy.active?'look-around':'manual-pan');}};
    const onTokenMoved=(event)=>{const token=target();if(!token)return;if(event?.detail?.tokenId!=null&&clean(event.detail.tokenId)!==clean(token.id))return;sync(event?.type==='vtt:token-preview-moved'?'token-drag-preview':'token-moved');};
    const onCanonicalSync=()=>sync('canonical-token-sync',{forceCenter:true});
    const onWorldTransition=()=>sync('world-transition',{forceCenter:true});
    const onKeyDown=(event)=>{if(isEditableTarget(event.target)||event.ctrlKey||event.metaKey||event.altKey)return;if((event.code==='KeyF'||String(event.key).toLowerCase()==='f')&&target()){toggle();event.preventDefault?.();}else if((event.code==='Home'||event.key==='Home')&&target()){recenter();event.preventDefault?.();}};
    camera.setManualPanListener?.(onManualPan);
    canvas.addEventListener('vtt:token-preview-moved',onTokenMoved);
    canvas.addEventListener('vtt:token-moved',onTokenMoved);
    canvas.addEventListener('vtt:token-z-transition',onTokenMoved);
    canvas.addEventListener('vtt:canonical-tokens-synced',onCanonicalSync);
    canvas.addEventListener('vtt:regional-local-transition-applied',onWorldTransition);
    canvas.addEventListener('vtt:procedural-chunk-loaded',onWorldTransition);
    host?.addEventListener?.('keydown',onKeyDown);
    applyPolicy(true);if(enabled)host?.setTimeout?.(()=>sync('initial',{forceCenter:true}),0);
    function stop(){if(stopped)return;stopped=true;camera.setManualPanListener?.(null);camera.setCenterConstraint?.(null);camera.setZoomBounds?.(.1,5);canvas.removeEventListener('vtt:token-preview-moved',onTokenMoved);canvas.removeEventListener('vtt:token-moved',onTokenMoved);canvas.removeEventListener('vtt:token-z-transition',onTokenMoved);canvas.removeEventListener('vtt:canonical-tokens-synced',onCanonicalSync);canvas.removeEventListener('vtt:regional-local-transition-applied',onWorldTransition);canvas.removeEventListener('vtt:procedural-chunk-loaded',onWorldTransition);host?.removeEventListener?.('keydown',onKeyDown);}
    return Object.freeze({state,target,center,sync,recenter,setEnabled,toggle,setTarget,clearTarget,applyPolicy,stop});
  }
  return Object.freeze({layerOf,controlledToken,modifierFromSkillValue,modifierFromCarrier,perceptionModifier,cameraPolicyForModifier,feetToPixels,clampPointAround,tokenRulesActive,createController});
});
