const WATER_ASSET_PATHS = Object.freeze({
  water: 'Assets/Images/World/Water/water_seamless.png',
  foamMain: 'Assets/Images/World/Water/coast_foam_seamless.png',
  foamDetail: 'Assets/Images/World/Water/coast_foam_seamless.png',
});

export const DEFAULT_WATER_CONFIG = Object.freeze({
  texture: WATER_ASSET_PATHS.water,
  tileWorldSize: 3.0,
  scrollSpeed: Object.freeze({x:0.010,y:0.004}),
  // Optional physical flow in world-units / second. When present it is converted
  // to texture cycles using tileWorldSize, so rivers can visually match current speed.
  flowWorldSpeed: null,
  color: 0xffffff,
  opacity: 0.92,
  roughness: 0.42,
  metalness: 0.02,
  secondLayer: null,
  distortion: null,
  flowMap: null,
  colorVariation: null,
  depth: null,
  // Optional: reinterpret the seamless water image as a luminance mask instead of
  // multiplying its RGB. This prevents dark source pixels from becoming black water.
  patternMask: null,
  // Visual-only vertex agitation. Physics/surfaceHeightAt stay authoritative and flat.
  surfaceWave: null,
});

export const DEFAULT_FOAM_CONFIG = Object.freeze({
  enabled: true,
  texture: WATER_ASSET_PATHS.foamMain,
  width: 0.42,
  innerWidth: 0.08,
  outerWidth: 0.34,
  tileWorldLength: 2.4,
  scrollSpeed: 0.020,
  pulseAmplitude: 0.025,
  pulseSpeed: 1.4,
  pulseFrequency: 1.15,
  widthVariation: 0.12,
  // Mask-space scale/surge are neutral by default. Sea profiles enlarge the
  // authored foam mask and couple its sampling to the same shoreline wave pulse.
  maskScale: 1.0,
  maskWaveAmplitude: 0.0,
  opacity: 0.78,
  // Shore foam is terrain/water decoration. Keep it barely above the water plane
  // and render it before units so transparent character sprites always stay on top.
  yOffset: 0.010,
  renderOrder: -3,
  simplifyTolerance: 0.035,
  detail: null,
});

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,finite(v,a)));
const point=(p)=>({x:finite(p?.x),y:finite(p?.y),z:finite(p?.z)});
const distXZ=(a,b)=>Math.hypot(finite(b?.x)-finite(a?.x),finite(b?.z)-finite(a?.z));
const key2=(x,z,eps)=>Math.round(x/eps)+','+Math.round(z/eps);
const smooth01=(value)=>{const t=clamp(value,0,1);return t*t*(3-2*t);};

export function waterCurrentImmersionFactor({
  waterDepth=0,
  referenceDepth=1,
  minFactor=.06,
  onset=.12,
  fullAt=.90,
}={}){
  const depth=Math.max(0,finite(waterDepth));
  if(depth<=0)return 0;
  const reference=Math.max(.001,finite(referenceDepth,1));
  const normalized=clamp(depth/reference,0,1);
  const start=clamp(onset,0,.95),end=clamp(fullAt,start+.001,1);
  const ramp=smooth01((normalized-start)/(end-start));
  return clamp(finite(minFactor,.06)+(1-finite(minFactor,.06))*ramp,0,1);
}

export function resolveWaterAssetUrl(assetPath, baseUrl=import.meta.url){
  const rel=String(assetPath||'');
  return new URL('../../../'+rel,baseUrl).href;
}

function perpendicularDistanceXZ(p,a,b){
  const dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz;
  if(len2<1e-12)return distXZ(p,a);
  const t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/len2,0,1);
  return Math.hypot(p.x-(a.x+dx*t),p.z-(a.z+dz*t));
}

function rdp(points,epsilon){
  if(points.length<3)return points.slice();
  let max=0,index=-1;
  for(let i=1;i<points.length-1;i++){
    const d=perpendicularDistanceXZ(points[i],points[0],points[points.length-1]);
    if(d>max){max=d;index=i;}
  }
  if(max<=epsilon||index<0)return [points[0],points[points.length-1]];
  const left=rdp(points.slice(0,index+1),epsilon),right=rdp(points.slice(index),epsilon);
  return left.slice(0,-1).concat(right);
}

export function simplifyShoreline(points,{tolerance=0.035,closed=false}={}){
  let src=(points||[]).map(point).filter((p,i,a)=>i===0||distXZ(p,a[i-1])>1e-6);
  if(src.length<3)return src;
  if(closed&&distXZ(src[0],src[src.length-1])<1e-6)src=src.slice(0,-1);
  if(Number(tolerance)<=0)return src;
  if(closed){
    const pivot=src.reduce((best,p,i)=>p.x<best.p.x?{p,i}:best,{p:src[0],i:0}).i;
    src=src.slice(pivot).concat(src.slice(0,pivot));
    const open=src.concat([src[0]]);
    const simple=rdp(open,Math.max(0,tolerance));
    simple.pop();
    return simple.length>=3?simple:src;
  }
  return rdp(src,Math.max(0,tolerance));
}

export function shorelineDistances(points,{closed=false}={}){
  const out=[0];
  for(let i=1;i<points.length;i++)out.push(out[i-1]+distXZ(points[i-1],points[i]));
  if(closed&&points.length>1)return {distances:out,total:out[out.length-1]+distXZ(points[points.length-1],points[0])};
  return {distances:out,total:out[out.length-1]||0};
}

function tangentAt(points,index,closed){
  const n=points.length;
  const prev=points[index===0?(closed?n-1:0):index-1];
  const next=points[index===n-1?(closed?0:n-1):index+1];
  let x=next.x-prev.x,z=next.z-prev.z,len=Math.hypot(x,z);
  if(len<1e-8){x=1;z=0;len=1;}
  return {x:x/len,z:z/len};
}

function waterNormalAt(p,tangent,isWaterAt,probeDistance){
  let nx=-tangent.z,nz=tangent.x;
  if(typeof isWaterAt==='function'){
    const d=Math.max(.01,probeDistance);
    const plus=!!isWaterAt(p.x+nx*d,p.z+nz*d);
    const minus=!!isWaterAt(p.x-nx*d,p.z-nz*d);
    if(minus&&!plus){nx=-nx;nz=-nz;}
    else if(plus===minus){
      const plus2=!!isWaterAt(p.x+nx*d*2.3,p.z+nz*d*2.3);
      const minus2=!!isWaterAt(p.x-nx*d*2.3,p.z-nz*d*2.3);
      if(minus2&&!plus2){nx=-nx;nz=-nz;}
    }
  }
  return {x:nx,z:nz};
}

export function buildShoreFoamRibbonData({
  shoreline,
  isWaterAt=null,
  closed=false,
  innerWidth=DEFAULT_FOAM_CONFIG.innerWidth,
  outerWidth=DEFAULT_FOAM_CONFIG.outerWidth,
  baseWidth=DEFAULT_FOAM_CONFIG.width,
  widthVariation=DEFAULT_FOAM_CONFIG.widthVariation,
  foamTileWorldLength=DEFAULT_FOAM_CONFIG.tileWorldLength,
  simplifyTolerance=DEFAULT_FOAM_CONFIG.simplifyTolerance,
  waterProbeDistance=null,
  seed=0,
}={}){
  const pts=simplifyShoreline(shoreline,{tolerance:simplifyTolerance,closed});
  if(pts.length<2)return null;
  const {distances,total}=shorelineDistances(pts,{closed});
  const positions=[],uv=[],foamNormals=[],foamDistance=[],indices=[];
  const innerEdge=[],outerEdge=[],normals=[];
  const tileLen=Math.max(.05,finite(foamTileWorldLength,2.4));
  const probe=waterProbeDistance??Math.max(.08,finite(baseWidth,.42)*.65);
  const count=pts.length;

  for(let i=0;i<count;i++){
    const p=pts[i],t=tangentAt(pts,i,closed),normal=waterNormalAt(p,t,isWaterAt,probe);
    const d=distances[i]||0;
    const waveA=Math.sin(d*.77+finite(seed)*.173);
    const waveB=Math.sin(d*1.91+1.7+finite(seed)*.071);
    const variation=clamp((waveA*.68+waveB*.32)*finite(widthVariation,.12),-.28,.28);
    const targetWidth=Math.max(.02,finite(baseWidth,.42)*(1+variation));
    const inRatio=Math.max(.02,finite(innerWidth,.08))/Math.max(.02,finite(innerWidth,.08)+finite(outerWidth,.34));
    const iw=targetWidth*inRatio,ow=targetWidth*(1-inRatio);
    const inner={x:p.x-normal.x*iw,y:p.y,z:p.z-normal.z*iw};
    const outer={x:p.x+normal.x*ow,y:p.y,z:p.z+normal.z*ow};
    innerEdge.push(inner);outerEdge.push(outer);normals.push(normal);
    const u=d/tileLen;
    positions.push(inner.x,inner.y,inner.z, outer.x,outer.y,outer.z);
    uv.push(u,0,u,1);
    foamNormals.push(normal.x,0,normal.z, normal.x,0,normal.z);
    foamDistance.push(d,d);
  }

  const segments=closed?count:count-1;
  for(let i=0;i<segments;i++){
    const j=(i+1)%count,a=i*2,b=a+1,c=j*2,d=c+1;
    indices.push(a,c,b,b,c,d);
  }

  return Object.freeze({shoreline:pts,innerEdge,outerEdge,normals,distances,total,positions,uv,foamNormals,foamDistance,indices,closed,tileWorldLength:tileLen});
}

export function createShoreFoamGeometry(THREE,data){
  if(!THREE||!data)return null;
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));
  geo.setAttribute('foamNormal',new THREE.Float32BufferAttribute(data.foamNormals,3));
  geo.setAttribute('foamDistance',new THREE.Float32BufferAttribute(data.foamDistance,1));
  geo.setIndex(data.indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.userData={shoreFoamRibbon:true,closed:data.closed,totalLength:data.total};
  return geo;
}

function marchingSegments(caseIndex,x0,z0,x1,z1){
  const top={x:(x0+x1)/2,z:z0},right={x:x1,z:(z0+z1)/2},bottom={x:(x0+x1)/2,z:z1},left={x:x0,z:(z0+z1)/2};
  const map={
    0:[],1:[[left,bottom]],2:[[bottom,right]],3:[[left,right]],
    4:[[top,right]],5:[[top,left],[bottom,right]],6:[[top,bottom]],7:[[top,left]],
    8:[[left,top]],9:[[top,bottom]],10:[[left,bottom],[top,right]],11:[[top,right]],
    12:[[left,right]],13:[[bottom,right]],14:[[left,bottom]],15:[]
  };
  return map[caseIndex]||[];
}

export function extractFieldShorelines({
  bounds,
  resolution=64,
  isWaterAt,
  simplifyTolerance=0.04,
  closeTolerance=null,
}={}){
  if(!bounds||typeof isWaterAt!=='function')return [];
  const nx=Math.max(4,Math.round(resolution)),nz=nx;
  const x0=finite(bounds.x0),x1=finite(bounds.x1),z0=finite(bounds.z0),z1=finite(bounds.z1);
  const dx=(x1-x0)/nx,dz=(z1-z0)/nz;
  const grid=Array.from({length:nz+1},(_,iz)=>Array.from({length:nx+1},(_,ix)=>!!isWaterAt(x0+ix*dx,z0+iz*dz)));
  const segs=[];
  for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
    const a=grid[iz][ix]?8:0,b=grid[iz][ix+1]?4:0,c=grid[iz+1][ix+1]?2:0,d=grid[iz+1][ix]?1:0;
    const ci=a|b|c|d;
    for(const pair of marchingSegments(ci,x0+ix*dx,z0+iz*dz,x0+(ix+1)*dx,z0+(iz+1)*dz))segs.push(pair);
  }
  if(!segs.length)return [];
  const eps=Math.max(1e-5,Math.min(Math.abs(dx),Math.abs(dz))*.2);
  const nodes=new Map(),unused=new Set(segs.map((_,i)=>i));
  const add=(p,i,end)=>{const k=key2(p.x,p.z,eps);if(!nodes.has(k))nodes.set(k,[]);nodes.get(k).push({i,end});};
  segs.forEach((s,i)=>{add(s[0],i,0);add(s[1],i,1);});
  const contours=[];
  while(unused.size){
    const first=unused.values().next().value;unused.delete(first);
    const line=[segs[first][0],segs[first][1]];
    for(const atEnd of [true,false]){
      let guard=0;
      while(guard++<segs.length+4){
        const p=atEnd?line[line.length-1]:line[0],bucket=nodes.get(key2(p.x,p.z,eps))||[];
        const next=bucket.find(e=>unused.has(e.i));
        if(!next)break;
        unused.delete(next.i);
        const seg=segs[next.i],q=seg[next.end===0?1:0];
        if(atEnd)line.push(q);else line.unshift(q);
      }
    }
    const close=closeTolerance??Math.max(Math.abs(dx),Math.abs(dz))*1.35;
    const closed=line.length>3&&distXZ(line[0],line[line.length-1])<=close;
    if(closed)line.pop();
    const simplified=simplifyShoreline(line,{tolerance:simplifyTolerance,closed});
    if(simplified.length>=2)contours.push({points:simplified,closed});
  }
  return contours.sort((a,b)=>b.points.length-a.points.length);
}

export class WaterTextureCache {
  constructor({THREE,baseUrl=import.meta.url}={}){
    if(!THREE?.TextureLoader)throw new Error('WATER_BODY_THREE_REQUIRED');
    this.THREE=THREE;this.baseUrl=baseUrl;this.loader=new THREE.TextureLoader();
    this.sources=new Map();this.variants=new Map();this.activeVariants=new Set();
    try{this.loader.setCrossOrigin?.('anonymous')}catch{}
  }
  async source(role,pathOverride=null){
    const asset=pathOverride||WATER_ASSET_PATHS[role];
    const url=resolveWaterAssetUrl(asset,this.baseUrl);
    if(this.sources.has(url))return this.sources.get(url);
    const promise=new Promise((resolve,reject)=>{
      this.loader.load(url,tex=>{
        tex.colorSpace=this.THREE.SRGBColorSpace||tex.colorSpace;
        tex.needsUpdate=true;resolve(tex);
      },undefined,reject);
    });
    this.sources.set(url,promise);
    return promise;
  }
  async variant(role,{path=null,scrollX=0,scrollY=0,wrapT=null,repeatX=1,repeatY=1}={}){
    const asset=path||WATER_ASSET_PATHS[role],sx=finite(scrollX),sy=finite(scrollY),rx=Math.max(.0001,finite(repeatX,1)),ry=Math.max(.0001,finite(repeatY,1));
    const key=[role,asset,sx.toFixed(6),sy.toFixed(6),rx.toFixed(6),ry.toFixed(6),wrapT||'default'].join('|');
    if(this.variants.has(key))return this.variants.get(key);
    const promise=this.source(role,asset).then(src=>{
      const t=src.clone();
      t.image=src.image;
      t.wrapS=this.THREE.RepeatWrapping;
      t.wrapT=wrapT??this.THREE.RepeatWrapping;
      t.magFilter=this.THREE.LinearFilter;
      t.minFilter=this.THREE.LinearMipmapLinearFilter;
      t.repeat.set(rx,ry);
      t.needsUpdate=true;
      const entry={texture:t,scrollX:sx,scrollY:sy,repeatX:rx,repeatY:ry};
      this.activeVariants.add(entry);
      return entry;
    });
    this.variants.set(key,promise);
    return promise;
  }
  update(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    for(const entry of this.activeVariants){
      if(!entry?.texture)continue;
      entry.texture.offset.x=(entry.texture.offset.x+entry.scrollX*dt)%1;
      entry.texture.offset.y=(entry.texture.offset.y+entry.scrollY*dt)%1;
    }
  }
}

function makeFoamMaterial(THREE,texture,config){
  const uniforms={
    map:{value:texture},
    uTime:{value:0},
    uUvOffset:{value:0},
    uPulseAmplitude:{value:Math.max(0,finite(config.pulseAmplitude,.025))},
    uPulseSpeed:{value:finite(config.pulseSpeed,1.4)},
    uPulseFrequency:{value:finite(config.pulseFrequency,1.15)},
    uMaskScale:{value:Math.max(.01,finite(config.maskScale,1))},
    uMaskWaveAmplitude:{value:finite(config.maskWaveAmplitude,0)},
    uOpacity:{value:clamp(config.opacity??.78,0,1)}
  };
  const mat=new THREE.ShaderMaterial({
    uniforms,
    transparent:true,
    depthWrite:false,
    depthTest:true,
    side:THREE.DoubleSide,
    vertexShader:`
      attribute vec3 foamNormal;
      attribute float foamDistance;
      varying vec2 vUv;
      varying float vWavePulse;
      uniform float uTime;
      uniform float uPulseAmplitude;
      uniform float uPulseSpeed;
      uniform float uPulseFrequency;
      void main(){
        vUv=uv;
        float pulse=sin(uTime*uPulseSpeed + foamDistance*uPulseFrequency);
        vWavePulse=pulse;
        float weight=mix(0.35,1.0,uv.y);
        vec3 displaced=position + foamNormal*(pulse*uPulseAmplitude*weight);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(displaced,1.0);
      }
    `,
    fragmentShader:`
      uniform sampler2D map;
      uniform float uOpacity;
      uniform float uUvOffset;
      uniform float uMaskScale;
      uniform float uMaskWaveAmplitude;
      varying vec2 vUv;
      varying float vWavePulse;
      void main(){
        float maskV=clamp(0.5+(vUv.y-0.5)/max(0.01,uMaskScale)+vWavePulse*uMaskWaveAmplitude,0.0,1.0);
        vec4 tex=texture2D(map,vec2(vUv.x+uUvOffset,maskV));
        float a=tex.a*uOpacity;
        if(a<0.015)discard;
        gl_FragColor=vec4(tex.rgb,a);
      }
    `
  });
  mat.userData.shoreFoam=true;
  return mat;
}


function normalizeSurfaceWave(config={}){
  const raw=config?.surfaceWave||{};
  return Object.freeze({
    enabled:raw.enabled===true,
    amplitude:Math.max(0,finite(raw.amplitude,.025)),
    secondaryAmplitude:Math.max(0,finite(raw.secondaryAmplitude,.012)),
    frequency:Math.max(.01,finite(raw.frequency,3.6)),
    secondaryFrequency:Math.max(.01,finite(raw.secondaryFrequency,6.4)),
    crossFrequency:Math.max(.01,finite(raw.crossFrequency,4.8)),
    speed:finite(raw.speed,2.4),
    secondarySpeed:finite(raw.secondarySpeed,3.7),
    edgeStrength:clamp(raw.edgeStrength??.28,0,1)
  });
}

function ensureWaterAcrossAttribute(THREE,geometry){
  if(!geometry?.attributes?.uv||geometry.attributes.waterAcross)return geometry;
  const uv=geometry.attributes.uv,count=uv.count;
  let min=Infinity,max=-Infinity;
  for(let i=0;i<count;i++){const v=uv.getY(i);min=Math.min(min,v);max=Math.max(max,v);}
  const span=Math.max(1e-6,max-min),arr=new Float32Array(count);
  for(let i=0;i<count;i++)arr[i]=clamp((uv.getY(i)-min)/span,0,1);
  geometry.setAttribute('waterAcross',new THREE.Float32BufferAttribute(arr,1));
  return geometry;
}

function makePatternMaskWaterMaterial(THREE,texture,config,{repeatX=1,repeatY=1}={}){
  const pattern=config.patternMask||{};
  const wave=normalizeSurfaceWave(config);
  const bg=new THREE.Color(pattern.backgroundColor??0xffffff);
  const water=new THREE.Color(pattern.waterColor??config.color??0x2f6fdb);
  const uniforms={
    map:{value:texture},
    uRepeat:{value:new THREE.Vector2(repeatX,repeatY)},
    uOffset:{value:new THREE.Vector2(0,0)},
    uBackground:{value:bg},
    uWater:{value:water},
    uLow:{value:clamp(pattern.low??.16,0,.95)},
    uHigh:{value:clamp(pattern.high??.78,.05,1)},
    uOpacity:{value:clamp(config.opacity??1,0,1)},
    uTime:{value:0},
    uWaveAmplitude:{value:wave.amplitude},
    uWaveSecondaryAmplitude:{value:wave.secondaryAmplitude},
    uWaveFrequency:{value:wave.frequency},
    uWaveSecondaryFrequency:{value:wave.secondaryFrequency},
    uWaveCrossFrequency:{value:wave.crossFrequency},
    uWaveSpeed:{value:wave.speed},
    uWaveSecondarySpeed:{value:wave.secondarySpeed},
    uWaveEdgeStrength:{value:wave.edgeStrength}
  };
  const vertexShader=wave.enabled?`
      attribute float waterAcross;
      varying vec2 vUv;
      uniform float uTime;
      uniform float uWaveAmplitude;
      uniform float uWaveSecondaryAmplitude;
      uniform float uWaveFrequency;
      uniform float uWaveSecondaryFrequency;
      uniform float uWaveCrossFrequency;
      uniform float uWaveSpeed;
      uniform float uWaveSecondarySpeed;
      uniform float uWaveEdgeStrength;
      void main(){
        vUv=uv;
        float center=1.0-abs(clamp(waterAcross,0.0,1.0)*2.0-1.0);
        float bankWeight=mix(uWaveEdgeStrength,1.0,smoothstep(0.0,1.0,center));
        float primary=sin(uv.x*uWaveFrequency-uTime*uWaveSpeed);
        float secondary=sin(uv.x*uWaveSecondaryFrequency+uv.y*uWaveCrossFrequency-uTime*uWaveSecondarySpeed);
        float chop=primary*uWaveAmplitude+secondary*uWaveSecondaryAmplitude;
        vec3 displaced=position+normal*(chop*bankWeight);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(displaced,1.0);
      }
    `:`
      varying vec2 vUv;
      void main(){
        vUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `;
  const mat=new THREE.ShaderMaterial({
    uniforms,
    transparent:(config.opacity??1)<1,
    depthWrite:true,
    depthTest:true,
    side:THREE.DoubleSide,
    toneMapped:false,
    vertexShader,
    fragmentShader:`
      uniform sampler2D map;
      uniform vec2 uRepeat;
      uniform vec2 uOffset;
      uniform vec3 uBackground;
      uniform vec3 uWater;
      uniform float uLow;
      uniform float uHigh;
      uniform float uOpacity;
      varying vec2 vUv;
      void main(){
        vec4 tex=texture2D(map,vUv*uRepeat+uOffset);
        float lum=dot(tex.rgb,vec3(0.299,0.587,0.114));
        float pattern=smoothstep(uLow,max(uLow+.001,uHigh),lum)*tex.a;
        vec3 rgb=mix(uBackground,uWater,pattern);
        gl_FragColor=vec4(rgb,uOpacity);
      }
    `
  });
  mat.userData.waterPatternMask=true;
  mat.userData.waterSurfaceWave=wave;
  return mat;
}

function createDebugGroup(THREE,data,{normalLength=.22}={}){
  const g=new THREE.Group();g.name='WaterBodyShoreDebug';
  const line=(pts,color,closed=false)=>{
    const arr=[];for(let i=0;i<pts.length-1;i++)arr.push(pts[i].x,pts[i].y,pts[i].z,pts[i+1].x,pts[i+1].y,pts[i+1].z);
    if(closed&&pts.length>2)arr.push(pts.at(-1).x,pts.at(-1).y,pts.at(-1).z,pts[0].x,pts[0].y,pts[0].z);
    if(!arr.length)return;
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
    const mesh=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color,depthTest:false,transparent:true,opacity:.9}));
    mesh.renderOrder=999;g.add(mesh);
  };
  line(data.shoreline,0xffff00,data.closed);
  line(data.innerEdge,0xff3355,data.closed);
  line(data.outerEdge,0x33ddff,data.closed);
  const normalPos=[];
  for(let i=0;i<data.shoreline.length;i+=Math.max(1,Math.floor(data.shoreline.length/24))){
    const p=data.shoreline[i],n=data.normals[i];normalPos.push(p.x,p.y+.006,p.z,p.x+n.x*normalLength,p.y+.006,p.z+n.z*normalLength);
  }
  if(normalPos.length){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(normalPos,3));
    const mesh=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x77ff77,depthTest:false}));
    mesh.renderOrder=999;g.add(mesh);
  }
  const uvTicks=[],tile=Math.max(.05,Number(data.tileWorldLength)||1);
  let nextTick=tile;
  for(let i=1;i<data.distances.length&&nextTick<=data.total+1e-6;i++){
    const d0=data.distances[i-1],d1=data.distances[i];
    while(nextTick>=d0&&nextTick<=d1&&d1>d0){
      const q=(nextTick-d0)/(d1-d0),lerp=(a,b)=>a+(b-a)*q;
      const ia=data.innerEdge[i-1],ib=data.innerEdge[i],oa=data.outerEdge[i-1],ob=data.outerEdge[i];
      uvTicks.push(lerp(ia.x,ib.x),lerp(ia.y,ib.y)+.008,lerp(ia.z,ib.z),lerp(oa.x,ob.x),lerp(oa.y,ob.y)+.008,lerp(oa.z,ob.z));
      nextTick+=tile;
    }
  }
  if(uvTicks.length){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(uvTicks,3));
    const mesh=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xff66ff,depthTest:false}));
    mesh.renderOrder=999;mesh.userData.debugClass='foam-uv-repeat';g.add(mesh);
  }
  return g;
}

function mergeConfig(base,override){
  return {
    ...base,...(override||{}),
    scrollSpeed:{...(base.scrollSpeed||{}),...(override?.scrollSpeed||{})},
    surfaceWave:override?.surfaceWave===null?null:{
      ...(base.surfaceWave||{}),
      ...(override?.surfaceWave||{})
    }
  };
}

export function resolveWaterBodyVisualProfile(id,waterConfig={},foamConfig={}){
  const water={...(waterConfig||{})},foam={...(foamConfig||{})};
  const coastal=/(^|:)(coast|sea|ocean)(:|$)/i.test(String(id||''));
  if(!coastal)return {profile:'default',water,foam};

  // Ocean/coast treatment: larger repeat scale, but caller opacity remains
  // authoritative so the animated texture can sit over the depth-color shader.
  water.tileWorldSize=Math.max(.05,finite(water.tileWorldSize,DEFAULT_WATER_CONFIG.tileWorldSize)*1.52);
  water.opacity=clamp(water.opacity??DEFAULT_WATER_CONFIG.opacity,0,1);
  water.roughness=Math.max(.48,clamp(water.roughness??DEFAULT_WATER_CONFIG.roughness,0,1));

  foam.width=Math.max(.02,finite(foam.width,DEFAULT_FOAM_CONFIG.width)*1.36);
  foam.innerWidth=Math.max(.01,finite(foam.innerWidth,DEFAULT_FOAM_CONFIG.innerWidth)*1.16);
  foam.outerWidth=Math.max(.01,finite(foam.outerWidth,DEFAULT_FOAM_CONFIG.outerWidth)*1.40);
  foam.tileWorldLength=Math.max(.05,finite(foam.tileWorldLength,DEFAULT_FOAM_CONFIG.tileWorldLength)*1.72);
  foam.scrollSpeed=finite(foam.scrollSpeed,DEFAULT_FOAM_CONFIG.scrollSpeed)*1.55;
  foam.pulseAmplitude=Math.max(.05,finite(foam.pulseAmplitude,DEFAULT_FOAM_CONFIG.pulseAmplitude)*1.85);
  foam.pulseSpeed=finite(foam.pulseSpeed,DEFAULT_FOAM_CONFIG.pulseSpeed)*1.28;
  foam.pulseFrequency=Math.max(.30,finite(foam.pulseFrequency,DEFAULT_FOAM_CONFIG.pulseFrequency)*.82);
  foam.widthVariation=Math.max(.16,finite(foam.widthVariation,DEFAULT_FOAM_CONFIG.widthVariation));
  foam.maskScale=Math.max(1.35,finite(foam.maskScale,DEFAULT_FOAM_CONFIG.maskScale));
  foam.maskWaveAmplitude=Math.max(.08,finite(foam.maskWaveAmplitude,DEFAULT_FOAM_CONFIG.maskWaveAmplitude));

  return {profile:'sea',water,foam};
}

export class WaterBody {
  constructor(system,options={}){
    this.system=system;this.THREE=system.THREE;this.id=String(options.id||('water-'+system.serial++));
    this.parent=options.parent;this.group=new this.THREE.Group();this.group.name='WaterBody:'+this.id;
    this.parent?.add?.(this.group);
    this.surface=options.surface||{};
    this.shorelines=Array.isArray(options.shorelines)?options.shorelines:[];
    this.isWaterAt=options.isWaterAt||null;
    this.surfaceHeightAt=typeof options.surfaceHeightAt==='function'?options.surfaceHeightAt:null;
    this.flowAt=typeof options.flowAt==='function'?options.flowAt:null;
    this.water=mergeConfig(DEFAULT_WATER_CONFIG,options.water);
    this.foam={...DEFAULT_FOAM_CONFIG,...(options.foam||{})};
    const visualProfile=resolveWaterBodyVisualProfile(this.id,this.water,this.foam);
    this.water=visualProfile.water;
    this.foam=visualProfile.foam;
    this.group.userData.waterBodyProfile=visualProfile.profile;
    this.debug=!!options.debug;this.disposed=false;
    this.waterMesh=null;this.foamMeshes=[];this.debugGroups=[];this.ready=this.build();
  }
  async build(){
    const THREE=this.THREE;
    // Some bodies (notably ocean coasts) use WaterBody only for interaction + foam.
    // In that mode the authored/PaperFX surface remains the sole visible water layer.
    if(this.surface?.geometry&&this.surface.enabled!==false){
      const speed=this.water.scrollSpeed||{};
      const tileWorldSize=Math.max(.05,finite(this.water.tileWorldSize,DEFAULT_WATER_CONFIG.tileWorldSize));
      const physicalFlow=this.water.flowWorldSpeed;
      const scrollX=physicalFlow&&Number.isFinite(Number(physicalFlow.x))
        ?finite(physicalFlow.x)/tileWorldSize
        :finite(speed.x);
      const scrollY=physicalFlow&&Number.isFinite(Number(physicalFlow.y))
        ?finite(physicalFlow.y)/tileWorldSize
        :finite(speed.y);
      const entry=await this.system.textures.variant('water',{
        path:this.water.texture,scrollX,scrollY,wrapT:THREE.RepeatWrapping,
        repeatX:1/tileWorldSize,repeatY:1/tileWorldSize
      });
      if(this.disposed)return this;
      let alphaMap=null;
      if(this.surface.alphaMap){
        alphaMap=this.surface.alphaMap.clone?.()||this.surface.alphaMap;
        if(alphaMap!==this.surface.alphaMap&&this.surface.alphaMap.image)alphaMap.image=this.surface.alphaMap.image;
        if('channel' in alphaMap&&this.surface.geometry?.attributes?.uv1)alphaMap.channel=1;
        alphaMap.needsUpdate=true;
      }
      let mat;
      if(this.water.patternMask?.enabled){
        if(alphaMap)console.warn('WaterBody patternMask ignores surface alphaMap; use shaped geometry for this mode:',this.id);
        if(this.water.surfaceWave?.enabled)ensureWaterAcrossAttribute(THREE,this.surface.geometry);
        mat=makePatternMaskWaterMaterial(THREE,entry.texture,this.water,{
          repeatX:1/tileWorldSize,repeatY:1/tileWorldSize
        });
        mat.depthWrite=this.surface.depthWrite!==false;
        this.patternMaterial=mat;
        this.patternTexture=entry.texture;
      }else{
        mat=new THREE.MeshStandardMaterial({
          map:entry.texture,color:this.water.color??0xffffff,transparent:(this.water.opacity??1)<1||!!alphaMap,
          opacity:clamp(this.water.opacity??1,0,1),roughness:clamp(this.water.roughness??.42,0,1),
          metalness:clamp(this.water.metalness??.02,0,1),side:THREE.DoubleSide,
          alphaMap,alphaTest:alphaMap?0.01:0,
          depthWrite:this.surface.depthWrite!==false
        });
      }
      const mesh=new THREE.Mesh(this.surface.geometry,mat);
      if(this.surface.position)mesh.position.copy?.(this.surface.position);
      else mesh.position.set(finite(this.surface.x),finite(this.surface.y),finite(this.surface.z));
      if(this.surface.rotation)mesh.rotation.set(finite(this.surface.rotation.x),finite(this.surface.rotation.y),finite(this.surface.rotation.z));
      if(Number.isFinite(this.surface.rotationX))mesh.rotation.x=this.surface.rotationX;
      mesh.receiveShadow=this.surface.receiveShadow!==false;
      mesh.renderOrder=finite(this.surface.renderOrder,-4);
      mesh.userData={
        ...(mesh.userData||{}),waterBodyId:this.id,waterBodySurface:true,
        waterTextureScroll:{x:scrollX,y:scrollY},
        waterFlowWorldSpeed:physicalFlow?{x:finite(physicalFlow.x),y:finite(physicalFlow.y)}:null,
        visualSurfaceDisplacementOnly:!!this.water.surfaceWave?.enabled
      };
      this.group.add(mesh);this.waterMesh=mesh;
    }
    if(this.foam.enabled!==false&&this.shorelines.length){
      // Foam motion is mesh-local because different rivers can have different
      // authored current speeds. Keep the shared texture variant stationary and
      // advance uUvOffset once per foam mesh in update().
      const foamEntry=await this.system.textures.variant('foamMain',{
        path:this.foam.texture,scrollX:0,scrollY:0,wrapT:THREE.ClampToEdgeWrapping
      });
      if(this.disposed)return this;
      const detailCfg=this.foam.detail?.enabled?{
        texture:this.foam.detail.texture||WATER_ASSET_PATHS.foamDetail,
        widthScale:Math.max(.25,finite(this.foam.detail.widthScale,.72)),
        tileWorldLength:Math.max(.05,finite(this.foam.detail.tileWorldLength,this.foam.tileWorldLength*.72)),
        scrollSpeed:finite(this.foam.detail.scrollSpeed,-.01),
        opacity:clamp(this.foam.detail.opacity??Math.max(.08,this.foam.opacity*.42),0,1),
        yOffset:finite(this.foam.detail.yOffset,.012),
        pulseAmplitude:Math.max(0,finite(this.foam.detail.pulseAmplitude,this.foam.pulseAmplitude*.62)),
        pulseSpeed:finite(this.foam.detail.pulseSpeed,this.foam.pulseSpeed*1.12),
        pulseFrequency:finite(this.foam.detail.pulseFrequency,this.foam.pulseFrequency*1.21)
      }:null;
      const detailEntry=detailCfg?await this.system.textures.variant('foamDetail',{
        path:detailCfg.texture,scrollX:0,scrollY:0,wrapT:THREE.ClampToEdgeWrapping
      }):null;
      for(let index=0;index<this.shorelines.length;index++){
        const src=this.shorelines[index],line=Array.isArray(src)?src:src?.points,closed=!!src?.closed;
        const data=buildShoreFoamRibbonData({
          shoreline:line,isWaterAt:this.isWaterAt,closed,
          innerWidth:this.foam.innerWidth,outerWidth:this.foam.outerWidth,baseWidth:this.foam.width,
          widthVariation:this.foam.widthVariation,foamTileWorldLength:this.foam.tileWorldLength,
          simplifyTolerance:this.foam.simplifyTolerance,seed:index+this.id.length
        });
        if(!data)continue;
        const geo=createShoreFoamGeometry(THREE,data),mat=makeFoamMaterial(THREE,foamEntry.texture,this.foam);
        const mesh=new THREE.Mesh(geo,mat);mesh.position.y=finite(this.foam.yOffset,.010);mesh.renderOrder=finite(this.foam.renderOrder,-3);
        mesh.userData={shoreFoamRibbon:true,waterBodyId:this.id,shorelineIndex:index,foamScrollSpeed:finite(this.foam.scrollSpeed,.02)};
        this.group.add(mesh);this.foamMeshes.push(mesh);
        {
          const dg=createDebugGroup(THREE,data);dg.position.y=mesh.position.y+.01;dg.visible=this.debug;
          this.group.add(dg);this.debugGroups.push(dg);
        }

        if(detailCfg&&detailEntry){
          const detailData=buildShoreFoamRibbonData({
            shoreline:line,isWaterAt:this.isWaterAt,closed,
            innerWidth:this.foam.innerWidth*detailCfg.widthScale,
            outerWidth:this.foam.outerWidth*detailCfg.widthScale,
            baseWidth:this.foam.width*detailCfg.widthScale,
            widthVariation:this.foam.widthVariation*.72,
            foamTileWorldLength:detailCfg.tileWorldLength,
            simplifyTolerance:this.foam.simplifyTolerance,
            seed:index+this.id.length+91
          });
          if(detailData){
            const dg=createShoreFoamGeometry(THREE,detailData),dm=makeFoamMaterial(THREE,detailEntry.texture,{
              ...this.foam,...detailCfg,
              pulseAmplitude:detailCfg.pulseAmplitude,pulseSpeed:detailCfg.pulseSpeed,pulseFrequency:detailCfg.pulseFrequency,
              opacity:detailCfg.opacity
            });
            const detailMesh=new THREE.Mesh(dg,dm);
            detailMesh.position.y=finite(this.foam.yOffset,.010)+detailCfg.yOffset;
            detailMesh.renderOrder=finite(this.foam.renderOrder,-3)+1;
            detailMesh.userData={shoreFoamRibbon:true,foamDetail:true,waterBodyId:this.id,shorelineIndex:index,foamScrollSpeed:detailCfg.scrollSpeed};
            this.group.add(detailMesh);this.foamMeshes.push(detailMesh);
          }
        }
      }
      if(detailCfg)this.group.userData.foamDetailConfig={...detailCfg};
    }
    return this;
  }
  containsPoint(position){
    if(!position)return false;
    if(typeof this.isWaterAt==='function'){
      try{return !!this.isWaterAt(finite(position.x),finite(position.z),position)}
      catch{return false}
    }
    return false;
  }
  getSurfaceHeightAt(position){
    if(typeof this.surfaceHeightAt==='function'){
      try{
        const y=Number(this.surfaceHeightAt(position||{}));
        if(Number.isFinite(y))return y;
      }catch{}
    }
    if(this.waterMesh){
      const p=new this.THREE.Vector3();
      this.waterMesh.getWorldPosition?.(p);
      if(Number.isFinite(p.y))return p.y;
    }
    return finite(this.surface?.position?.y??this.surface?.y,0);
  }
  getFlowAt(position){
    if(typeof this.flowAt==='function'){
      try{
        const v=this.flowAt(position||{})||{};
        return {x:finite(v.x),y:finite(v.y),z:finite(v.z)};
      }catch{}
    }
    return {x:0,y:0,z:0};
  }
  setDebug(show){
    this.debug=!!show;
    for(const g of this.debugGroups)g.visible=this.debug;
  }
  update(dt,time){
    if(this.patternMaterial?.uniforms?.uOffset&&this.patternTexture?.offset){
      this.patternMaterial.uniforms.uOffset.value.set(this.patternTexture.offset.x,this.patternTexture.offset.y);
    }
    if(this.patternMaterial?.uniforms?.uTime)this.patternMaterial.uniforms.uTime.value=time;
    for(const mesh of this.foamMeshes){
      if(mesh.material?.uniforms?.uTime)mesh.material.uniforms.uTime.value=time;
      if(mesh.material?.uniforms?.uUvOffset){
        const speed=finite(mesh.userData?.foamScrollSpeed,0);
        mesh.material.uniforms.uUvOffset.value=(mesh.material.uniforms.uUvOffset.value+speed*dt)%1;
      }
    }
  }
  dispose(){
    this.disposed=true;
    this.group.traverse?.(o=>{
      if(o.geometry)o.geometry.dispose?.();
      if(o.material){
        if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());
        else o.material.dispose?.();
      }
    });
    this.group.removeFromParent?.();
  }
}

export class WaterBodySystem {
  constructor({THREE,baseUrl=import.meta.url,showShoreFoamRibbon=false}={}){
    if(!THREE)throw new Error('WATER_BODY_THREE_REQUIRED');
    this.THREE=THREE;this.textures=new WaterTextureCache({THREE,baseUrl});this.bodies=new Map();
    this.showShoreFoamRibbon=!!showShoreFoamRibbon;this.time=0;this.serial=1;
  }
  createWaterBody(options={}){
    const body=new WaterBody(this,{...options,debug:options.debug??this.showShoreFoamRibbon});
    this.bodies.set(body.id,body);return body;
  }
  remove(id){
    const body=typeof id==='string'?this.bodies.get(id):id;
    if(!body)return false;body.dispose();this.bodies.delete(body.id);return true;
  }
  clearBodies(){for(const b of [...this.bodies.values()])this.remove(b);}
  listBodies(){return [...this.bodies.values()];}
  findBodyAt(position){
    const bodies=[...this.bodies.values()];
    for(let i=bodies.length-1;i>=0;i--)if(bodies[i]?.containsPoint?.(position))return bodies[i];
    return null;
  }
  setDebug(show){this.showShoreFoamRibbon=!!show;for(const b of this.bodies.values())b.setDebug(show);}
  update(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    this.time+=dt;
    this.textures.update(dt);
    for(const b of this.bodies.values())b.update(dt,this.time);
  }
  status(){
    return {bodyCount:this.bodies.size,showShoreFoamRibbon:this.showShoreFoamRibbon,time:this.time,
      assets:WATER_ASSET_PATHS,bodies:[...this.bodies.values()].map(b=>({id:b.id,foamMeshes:b.foamMeshes.length,ready:!!b.waterMesh}))};
  }
}

export function createWaterBodySystem(options){return new WaterBodySystem(options);}

export default Object.freeze({
  WATER_ASSET_PATHS,
  DEFAULT_WATER_CONFIG,
  DEFAULT_FOAM_CONFIG,
  resolveWaterBodyVisualProfile,
  simplifyShoreline,
  shorelineDistances,
  buildShoreFoamRibbonData,
  createShoreFoamGeometry,
  waterCurrentImmersionFactor,
  extractFieldShorelines,
  WaterTextureCache,
  WaterBody,
  WaterBodySystem,
  createWaterBodySystem,
});
