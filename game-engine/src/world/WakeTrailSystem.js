const DEFAULT_WAKE_TEXTURE='Assets/Images/World/Water/wake_trail.png';

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,finite(v,a)));
const smooth01=(v)=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
const resolveValue=(v,ctx)=>typeof v==='function'?v(ctx):v;

export const DEFAULT_WAKE_CONFIG=Object.freeze({
  enabled:true,
  type:'dynamic',
  texture:DEFAULT_WAKE_TEXTURE,
  radius:.45,
  minRelativeSpeed:.15,
  maxRelativeSpeed:3.0,
  width:1.4,
  length:5.0,
  maxExtraLength:3.0,
  widthMultiplier:1.0,
  widening:1.30,
  tileWorldLength:2.5,
  scrollSpeed:.25,
  fadeStart:.72,
  opacity:.90,
  smallOffset:.014,
  pointSpacing:.22,
  wakeLifetime:1.55,
  maxPoints:28
});

export function relativeWaterVelocity(actorVelocity={},waterFlow={}){
  return {
    x:finite(actorVelocity.x)-finite(waterFlow.x),
    y:finite(actorVelocity.y)-finite(waterFlow.y),
    z:finite(actorVelocity.z)-finite(waterFlow.z)
  };
}

export function wakeStrengthForSpeed(speed,{minRelativeSpeed=.15,maxRelativeSpeed=3}={}){
  const lo=Math.max(0,finite(minRelativeSpeed,.15)),hi=Math.max(lo+.001,finite(maxRelativeSpeed,3));
  return smooth01((Math.max(0,finite(speed))-lo)/(hi-lo));
}

export function resolveWakeDimensions(config={},radius=.45,strength=0){
  const s=clamp(strength,0,1),r=Math.max(.02,finite(radius,config.radius??.45));
  const baseLength=Math.max(.05,finite(config.length,5));
  const extra=Math.max(0,finite(config.maxExtraLength,3));
  const widthBase=Math.max(.03,finite(config.width,1.4));
  const widthMul=Math.max(.05,finite(config.widthMultiplier,1));
  return {
    length:Math.min(baseLength+extra,baseLength+extra*s),
    width:Math.min(r*widthBase*widthMul, r*widthBase*widthMul*(.70+s*.30))
  };
}

export function wakeTailAlpha(progress,fadeStart=.72){
  const p=clamp(progress,0,1),start=clamp(fadeStart,0,.98);
  return 1-smooth01((p-start)/Math.max(.001,1-start));
}

export function buildWakeRibbonData(points,{
  baseWidth=.5,
  widening=1.3,
  tileWorldLength=2.5
}={}){
  const pts=(points||[]).map(p=>({x:finite(p.x),y:finite(p.y),z:finite(p.z)}));
  if(pts.length<2)return null;
  const distances=[0];
  for(let i=1;i<pts.length;i++)distances.push(distances[i-1]+Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z));
  const total=Math.max(.001,distances.at(-1));
  const positions=[],uv=[],progress=[],left=[],right=[];
  const width0=Math.max(.01,finite(baseWidth,.5)),open=Math.max(.15,finite(widening,1.3)),tile=Math.max(.05,finite(tileWorldLength,2.5));
  for(let i=0;i<pts.length;i++){
    const prev=pts[i===0?0:i-1],next=pts[i===pts.length-1?pts.length-1:i+1];
    let tx=next.x-prev.x,tz=next.z-prev.z,len=Math.hypot(tx,tz);
    if(len<1e-6){tx=1;tz=0;len=1}
    tx/=len;tz/=len;
    const nx=-tz,nz=tx,t=distances[i]/total;
    const taper=1-.10*smooth01((t-.82)/.18);
    const half=width0*.5*(1+(open-1)*t)*taper;
    const l={x:pts[i].x+nx*half,y:pts[i].y,z:pts[i].z+nz*half};
    const r={x:pts[i].x-nx*half,y:pts[i].y,z:pts[i].z-nz*half};
    left.push(l);right.push(r);
    positions.push(l.x,l.y,l.z,r.x,r.y,r.z);
    const u=distances[i]/tile;
    uv.push(u,0,u,1);
    progress.push(t,t);
  }
  return {points:pts,positions,uv,progress,left,right,distances,total};
}

export function resolveWakeAssetUrl(assetPath=DEFAULT_WAKE_TEXTURE,baseUrl=import.meta.url){
  return new URL('../../../'+String(assetPath||DEFAULT_WAKE_TEXTURE),baseUrl).href;
}

class WakeTextureAsset {
  constructor({THREE,baseUrl=import.meta.url,path=DEFAULT_WAKE_TEXTURE}={}){
    this.THREE=THREE;this.path=path;this.url=resolveWakeAssetUrl(path,baseUrl);
    this.texture=null;this.error=null;this.loading=null;
  }
  load(){
    if(this.texture)return Promise.resolve(this.texture);
    if(this.loading)return this.loading;
    this.loading=new Promise((resolve,reject)=>{
      const loader=new this.THREE.TextureLoader();
      loader.load(this.url,tex=>{
        tex.wrapS=this.THREE.RepeatWrapping;
        tex.wrapT=this.THREE.ClampToEdgeWrapping;
        tex.colorSpace=this.THREE.SRGBColorSpace||tex.colorSpace;
        tex.magFilter=this.THREE.LinearFilter;
        tex.minFilter=this.THREE.LinearMipmapLinearFilter;
        tex.needsUpdate=true;
        this.texture=tex;resolve(tex);
      },undefined,err=>{
        this.error=err||new Error('WAKE_TEXTURE_LOAD_FAILED');
        reject(this.error);
      });
    });
    return this.loading;
  }
  status(){return {path:this.path,url:this.url,ready:!!this.texture,error:!!this.error};}
}

function makeWakeMaterial(THREE,texture,config){
  const mat=new THREE.ShaderMaterial({
    uniforms:{
      map:{value:texture},
      uUvOffset:{value:0},
      uOpacity:{value:0},
      uFadeStart:{value:clamp(config.fadeStart??.72,0,.98)}
    },
    transparent:true,
    depthWrite:false,
    depthTest:true,
    side:THREE.DoubleSide,
    blending:THREE.NormalBlending,
    vertexShader:`
      attribute float trailProgress;
      varying vec2 vUv;
      varying float vTrailProgress;
      void main(){
        vUv=uv;
        vTrailProgress=trailProgress;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader:`
      uniform sampler2D map;
      uniform float uUvOffset;
      uniform float uOpacity;
      uniform float uFadeStart;
      varying vec2 vUv;
      varying float vTrailProgress;
      void main(){
        vec4 sampled=texture2D(map,vec2(vUv.x+uUvOffset,vUv.y));
        float tailFade=1.0-smoothstep(uFadeStart,1.0,vTrailProgress);
        float alpha=sampled.a*tailFade*uOpacity;
        if(alpha<0.01)discard;
        gl_FragColor=vec4(sampled.rgb,alpha);
      }
    `
  });
  mat.userData.wakeTrailMaterial=true;
  return mat;
}

class WakeTrailInstance {
  constructor(system,id,spec={}){
    this.system=system;this.THREE=system.THREE;this.id=id;this.spec=spec;
    this.config={...DEFAULT_WAKE_CONFIG,...(spec.wake||{})};
    this.history=[];this.body=null;this.mesh=null;this.material=null;this.ready=false;
    this.opacity=0;this.targetOpacity=0;this.uvOffset=0;this.lastStaticKey='';
    this.debugGroup=null;this.debugLines=[];
    this.geometry=this.createGeometry(Math.max(4,Math.floor(this.config.maxPoints||28)));
    this.ensureReady();
  }
  createGeometry(maxPoints){
    const THREE=this.THREE,maxVerts=maxPoints*2;
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(maxVerts*3),3));
    geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(maxVerts*2),2));
    geo.setAttribute('trailProgress',new THREE.BufferAttribute(new Float32Array(maxVerts),1));
    const idx=new Uint32Array(Math.max(1,maxPoints-1)*6);
    for(let i=0;i<maxPoints-1;i++){
      const o=i*6,v=i*2;idx[o]=v;idx[o+1]=v+2;idx[o+2]=v+1;idx[o+3]=v+1;idx[o+4]=v+2;idx[o+5]=v+3;
    }
    geo.setIndex(new THREE.BufferAttribute(idx,1));geo.setDrawRange(0,0);
    return geo;
  }
  async ensureReady(){
    try{
      const tex=await this.system.textureAsset.load();
      if(this.system.disposed)return;
      this.material=makeWakeMaterial(this.THREE,tex,this.config);
      this.mesh=new this.THREE.Mesh(this.geometry,this.material);
      this.mesh.renderOrder=finite(this.config.renderOrder,-2);
      this.mesh.frustumCulled=false;
      this.mesh.userData={wakeTrail:true,waterInteractorId:this.id};
      this.system.parent?.add?.(this.mesh);
      this.ready=true;
      if(this.system.showWakeDebug)this.ensureDebug();
    }catch(err){
      this.system.assetError=err||true;
      if(!this.system.warnedMissingAsset){
        this.system.warnedMissingAsset=true;
        console.warn('Wake trail texture unavailable; wake renderer is armed but inactive until the official asset exists:',this.system.textureAsset.path);
      }
    }
  }
  ensureDebug(){
    if(this.debugGroup||!this.system.parent)return;
    const THREE=this.THREE,g=new THREE.Group();g.name='WakeDebug:'+this.id;
    const colors=[0x00ff99,0x33bbff,0xffcc33];
    for(const color of colors){
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(6),3));
      const line=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color,depthTest:false}));
      line.renderOrder=999;g.add(line);this.debugLines.push(line);
    }
    this.system.parent.add(g);this.debugGroup=g;
  }
  setDebug(show){
    if(show)this.ensureDebug();
    if(this.debugGroup)this.debugGroup.visible=!!show;
  }
  resolvePosition(){
    const v=resolveValue(this.spec.position,this.spec)||this.spec.object3D?.position;
    return v?{x:finite(v.x),y:finite(v.y),z:finite(v.z)}:null;
  }
  resolveVelocity(){
    const v=resolveValue(this.spec.velocity,this.spec)||{};
    return {x:finite(v.x),y:finite(v.y),z:finite(v.z)};
  }
  resolveRadius(){return Math.max(.02,finite(resolveValue(this.spec.radius??this.spec.obstacleRadius,this.spec),this.config.radius));}
  enabled(){return resolveValue(this.spec.wakeEnabled??this.config.enabled,this.spec)!==false;}
  surfacePoint(body,p){
    return {x:p.x,y:body.getSurfaceHeightAt(p)+finite(this.config.smallOffset,.014),z:p.z};
  }
  dynamicPoints(body,pos,relative,dt,strength){
    for(const h of this.history)h.age+=dt;
    const lifetime=Math.max(.1,finite(this.config.wakeLifetime,1.55));
    this.history=this.history.filter(h=>h.age<=lifetime&&body.containsPoint(h.position));
    const spacing=Math.max(.03,finite(this.config.pointSpacing,.22));
    const newest=this.history[0];
    if(!newest||Math.hypot(pos.x-newest.position.x,pos.z-newest.position.z)>=spacing){
      this.history.unshift({position:{x:pos.x,y:pos.y,z:pos.z},age:0,strength});
    }
    this.history.length=Math.min(this.history.length,Math.max(3,Math.floor(this.config.maxPoints||28)-1));
    let dx=-relative.x,dz=-relative.z,len=Math.hypot(dx,dz);
    if(len<1e-5){dx=0;dz=1;len=1}dx/=len;dz/=len;
    const radius=this.resolveRadius();
    const start=this.surfacePoint(body,{x:pos.x+dx*radius*.72,z:pos.z+dz*radius*.72});
    const points=[start];
    for(const h of this.history){
      const p=this.surfacePoint(body,h.position);
      if(Math.hypot(p.x-points.at(-1).x,p.z-points.at(-1).z)>.035)points.push(p);
    }
    if(points.length<2){
      const dims=resolveWakeDimensions(this.config,radius,strength);
      points.push(this.surfacePoint(body,{x:start.x+dx*Math.min(dims.length,spacing*2),z:start.z+dz*Math.min(dims.length,spacing*2)}));
    }
    return points;
  }
  staticPoints(body,pos,flow,strength){
    let dx=finite(flow.x),dz=finite(flow.z),mag=Math.hypot(dx,dz);
    if(mag<1e-6)return [];
    dx/=mag;dz/=mag;
    const radius=this.resolveRadius(),dims=resolveWakeDimensions(this.config,radius,strength);
    const startDist=radius*1.02+.025,count=Math.max(4,Math.min(Math.floor(this.config.maxPoints||28),10));
    const points=[];
    for(let i=0;i<count;i++){
      const t=i/(count-1),d=startDist+dims.length*t;
      points.push(this.surfacePoint(body,{x:pos.x+dx*d,z:pos.z+dz*d}));
    }
    return points;
  }
  updateGeometry(points,width){
    const data=buildWakeRibbonData(points,{baseWidth:width,widening:this.config.widening,tileWorldLength:this.config.tileWorldLength});
    if(!data||!this.geometry)return false;
    const count=Math.min(data.points.length,Math.floor(this.geometry.attributes.position.count/2));
    const pos=this.geometry.attributes.position,uv=this.geometry.attributes.uv,prog=this.geometry.attributes.trailProgress;
    for(let i=0;i<count*2;i++){
      pos.setXYZ(i,data.positions[i*3],data.positions[i*3+1],data.positions[i*3+2]);
      uv.setXY(i,data.uv[i*2],data.uv[i*2+1]);
      prog.setX(i,data.progress[i]);
    }
    pos.needsUpdate=uv.needsUpdate=prog.needsUpdate=true;
    this.geometry.setDrawRange(0,Math.max(0,count-1)*6);
    this.geometry.computeBoundingSphere();
    if(this.system.showWakeDebug)this.updateDebug(data);
    return true;
  }
  updateDebug(data){
    this.ensureDebug();
    if(!this.debugLines.length)return;
    const setLine=(line,a,b)=>{
      const p=line.geometry.attributes.position;
      p.setXYZ(0,a.x,a.y+.02,a.z);p.setXYZ(1,b.x,b.y+.02,b.z);p.needsUpdate=true;
    };
    const c0=data.points[0],c1=data.points[Math.min(1,data.points.length-1)],tail=data.points.at(-1);
    setLine(this.debugLines[0],c0,tail);
    setLine(this.debugLines[1],data.left[0],data.right[0]);
    const fi=Math.min(data.points.length-1,Math.max(0,Math.round((this.config.fadeStart??.72)*(data.points.length-1))));
    setLine(this.debugLines[2],data.left[fi],data.right[fi]);
  }
  update(dt){
    const pos=this.resolvePosition();
    const detached=this.spec.object3D&&this.spec.object3D.parent==null;
    if(!pos||detached||!this.enabled()){
      this.targetOpacity=0;this.fade(dt);return;
    }
    const body=this.system.waterBodySystem?.findBodyAt?.(pos)||null;
    if(!body){
      this.body=null;this.targetOpacity=0;this.fade(dt);return;
    }
    this.body=body;
    const actor=this.resolveVelocity(),flow=body.getFlowAt(pos),rel=relativeWaterVelocity(actor,flow);
    const speed=Math.hypot(rel.x,rel.y,rel.z),min=Math.max(0,finite(this.config.minRelativeSpeed,.15));
    const strength=wakeStrengthForSpeed(speed,this.config);
    if(speed<=min){
      this.targetOpacity=0;this.fade(dt);return;
    }
    const radius=this.resolveRadius(),dims=resolveWakeDimensions(this.config,radius,strength);
    const type=String(this.config.type||this.spec.type||'dynamic');
    const points=type==='staticObstacle'
      ?this.staticPoints(body,pos,flow,strength)
      :this.dynamicPoints(body,pos,rel,dt,strength);
    if(points.length>=2)this.updateGeometry(points,dims.width);
    const baseOpacity=clamp(this.config.opacity??.9,0,1);
    this.targetOpacity=baseOpacity*(.35+.65*strength);
    this.uvOffset=(this.uvOffset+finite(this.config.scrollSpeed,.25)*(.45+.55*strength)*dt)%1;
    if(this.material?.uniforms?.uUvOffset)this.material.uniforms.uUvOffset.value=this.uvOffset;
    this.fade(dt);
  }
  fade(dt){
    const k=1-Math.exp(-Math.max(0,dt)*8.5);
    this.opacity=this.opacity+(this.targetOpacity-this.opacity)*k;
    if(this.material?.uniforms?.uOpacity)this.material.uniforms.uOpacity.value=this.opacity;
    if(this.mesh)this.mesh.visible=this.opacity>.008&&this.geometry.drawRange.count>0;
  }
  dispose(){
    this.mesh?.removeFromParent?.();this.debugGroup?.removeFromParent?.();
    this.geometry?.dispose?.();this.material?.dispose?.();
  }
}

export class WakeTrailSystem {
  constructor({THREE,waterBodySystem,parent=null,baseUrl=import.meta.url,texture=DEFAULT_WAKE_TEXTURE,showWakeDebug=false}={}){
    if(!THREE)throw new Error('WAKE_THREE_REQUIRED');
    this.THREE=THREE;this.waterBodySystem=waterBodySystem;this.parent=parent;
    this.showWakeDebug=!!showWakeDebug;this.trails=new Map();this.disposed=false;
    this.textureAsset=new WakeTextureAsset({THREE,baseUrl,path:texture});
    this.warnedMissingAsset=false;this.assetError=null;
  }
  create(id,spec={}){
    const key=String(id);
    this.remove(key);
    const trail=new WakeTrailInstance(this,key,spec);this.trails.set(key,trail);return trail;
  }
  remove(id){const t=this.trails.get(String(id));if(!t)return false;t.dispose();this.trails.delete(String(id));return true;}
  clear(){for(const id of [...this.trails.keys()])this.remove(id);}
  setDebug(show){this.showWakeDebug=!!show;for(const t of this.trails.values())t.setDebug(show);}
  update(dt){for(const t of this.trails.values())t.update(dt);}
  status(){return {trailCount:this.trails.size,showWakeDebug:this.showWakeDebug,asset:this.textureAsset.status(),assetError:!!this.assetError};}
  dispose(){this.disposed=true;this.clear();this.textureAsset.texture?.dispose?.();}
}

export class WaterInteractionSystem {
  constructor(options={}){
    this.wakeTrails=new WakeTrailSystem(options);this.interactors=new Map();
  }
  registerInteractor(id,spec={}){
    const key=String(id);this.interactors.set(key,spec);this.wakeTrails.create(key,spec);return spec;
  }
  unregisterInteractor(id){this.interactors.delete(String(id));return this.wakeTrails.remove(id);}
  clear(){this.interactors.clear();this.wakeTrails.clear();}
  update(dt){this.wakeTrails.update(dt);}
  setDebug(show){this.wakeTrails.setDebug(show);}
  status(){return {...this.wakeTrails.status(),interactorCount:this.interactors.size};}
}

export function createWaterInteractionSystem(options){return new WaterInteractionSystem(options)}

export default Object.freeze({
  DEFAULT_WAKE_TEXTURE,
  DEFAULT_WAKE_CONFIG,
  relativeWaterVelocity,
  wakeStrengthForSpeed,
  resolveWakeDimensions,
  wakeTailAlpha,
  buildWakeRibbonData,
  resolveWakeAssetUrl,
  WakeTrailSystem,
  WaterInteractionSystem,
  createWaterInteractionSystem
});
