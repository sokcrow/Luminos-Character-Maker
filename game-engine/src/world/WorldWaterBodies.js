const WATER_TEXTURE='Assets/Images/World/Water/water_seamless.png';
const FOAM_TEXTURE='Assets/Images/World/Water/coast_foam_seamless.png';
export const WORLD_WATER_ASSETS=Object.freeze({water:WATER_TEXTURE,foam:FOAM_TEXTURE});
export const DEFAULT_WATER_BODY_WATER=Object.freeze({
  texture:WATER_TEXTURE,tileWorldSize:3,scrollSpeed:Object.freeze({x:.010,y:.004}),
  opacity:1,color:0xffffff,roughness:.72,metalness:0,
  detail:Object.freeze({enabled:false,texture:null,tileWorldSize:1.5,scrollSpeed:Object.freeze({x:-.006,y:.008}),opacity:.18})
});
export const DEFAULT_WATER_BODY_FOAM=Object.freeze({
  enabled:true,texture:FOAM_TEXTURE,width:.42,landWidthRatio:.24,tileWorldLength:1.8,
  scrollSpeed:.020,pulseAmplitude:.028,pulseSpeed:1.25,pulseFrequency:.42,widthVariation:.08,
  opacity:.88,elevationOffset:.018,simplifyTolerance:0,normalProbeDistance:.16,
  detail:Object.freeze({enabled:false,texture:null,widthScale:.92,tileWorldLength:1.15,scrollSpeed:-.010,opacity:.24})
});
const EPS=1e-7;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,finite(v,a)));
const point=p=>Array.isArray(p)?{x:finite(p[0]),z:finite(p[1])}:{x:finite(p?.x),z:finite(p?.z)};
const same=(a,b)=>Math.abs(a.x-b.x)<=EPS&&Math.abs(a.z-b.z)<=EPS;
function freezeDeep(v){if(!v||typeof v!=='object')return v;if(Array.isArray(v))return Object.freeze(v.map(freezeDeep));const o={};for(const [k,e] of Object.entries(v))o[k]=freezeDeep(e);return Object.freeze(o)}
function scroll(v,f={x:0,y:0}){if(Number.isFinite(Number(v)))return{x:Number(v),y:0};if(Array.isArray(v))return{x:finite(v[0]),y:finite(v[1])};return{x:finite(v?.x,f.x),y:finite(v?.y,f.y)}}
export function normalizeWaterBodyConfig(input={}){
  const wi=input.water||{},fi=input.foam||{};
  const water={...DEFAULT_WATER_BODY_WATER,...wi,tileWorldSize:Math.max(.01,finite(wi.tileWorldSize,3)),scrollSpeed:scroll(wi.scrollSpeed,DEFAULT_WATER_BODY_WATER.scrollSpeed),opacity:clamp(wi.opacity??1,0,1),
    detail:{...DEFAULT_WATER_BODY_WATER.detail,...(wi.detail||{}),scrollSpeed:scroll(wi.detail?.scrollSpeed,DEFAULT_WATER_BODY_WATER.detail.scrollSpeed)}};
  const foam={...DEFAULT_WATER_BODY_FOAM,...fi,enabled:fi.enabled!==false,width:Math.max(.01,finite(fi.width,.42)),landWidthRatio:clamp(fi.landWidthRatio??.24,0,.95),
    tileWorldLength:Math.max(.01,finite(fi.tileWorldLength,1.8)),scrollSpeed:finite(fi.scrollSpeed,.020),pulseAmplitude:Math.max(0,finite(fi.pulseAmplitude,.028)),
    pulseSpeed:finite(fi.pulseSpeed,1.25),pulseFrequency:finite(fi.pulseFrequency,.42),widthVariation:clamp(fi.widthVariation??.08,0,.35),
    opacity:clamp(fi.opacity??.88,0,1),elevationOffset:finite(fi.elevationOffset,.018),simplifyTolerance:Math.max(0,finite(fi.simplifyTolerance,0)),
    normalProbeDistance:Math.max(.01,finite(fi.normalProbeDistance,.16)),detail:{...DEFAULT_WATER_BODY_FOAM.detail,...(fi.detail||{})}};
  foam.pulseAmplitude=Math.min(foam.pulseAmplitude,foam.width*.2);
  return freezeDeep({water,foam});
}
export function resolveWorldWaterTextureUrl(path,baseUrl=import.meta.url){return path?new URL('../../../'+String(path).replace(/^\/+/,''),baseUrl).href:null}
function segD2(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz;if(l<=EPS)return(p.x-a.x)**2+(p.z-a.z)**2;const t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/l,0,1),x=a.x+dx*t,z=a.z+dz*t;return(p.x-x)**2+(p.z-z)**2}
function rdp(ps,tol){if(ps.length<=2||tol<=0)return ps.slice();const keep=new Uint8Array(ps.length),stack=[[0,ps.length-1]],limit=tol*tol;keep[0]=keep[ps.length-1]=1;while(stack.length){const [a,b]=stack.pop();let best=-1,dist=limit;for(let i=a+1;i<b;i++){const d=segD2(ps[i],ps[a],ps[b]);if(d>dist){dist=d;best=i}}if(best>=0){keep[best]=1;stack.push([a,best],[best,b])}}return ps.filter((_,i)=>keep[i])}
export function simplifyShoreline(input,tolerance=0,{closed=true}={}){
  let ps=(input||[]).map(point);if(ps.length>1&&same(ps[0],ps.at(-1)))ps=ps.slice(0,-1);
  if(ps.length<(closed?3:2)||tolerance<=0)return ps;if(!closed)return rdp(ps,tolerance);
  let split=1,best=-1;for(let i=1;i<ps.length;i++){const d=(ps[i].x-ps[0].x)**2+(ps[i].z-ps[0].z)**2;if(d>best){best=d;split=i}}
  const a=rdp(ps.slice(0,split+1),tolerance),b=rdp([...ps.slice(split),ps[0]],tolerance),out=[...a.slice(0,-1),...b.slice(0,-1)];
  return out.length>=3?out:ps;
}
export function polygonSignedArea(input){const ps=(input||[]).map(point);let a=0;for(let i=0;i<ps.length;i++){const p=ps[i],q=ps[(i+1)%ps.length];a+=p.x*q.z-q.x*p.z}return a*.5}
export function pointInPolygon(p0,input){const p=point(p0),ps=(input||[]).map(point);let inside=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++){const a=ps[i],b=ps[j],hit=((a.z>p.z)!==(b.z>p.z))&&p.x<(b.x-a.x)*(p.z-a.z)/((b.z-a.z)||EPS)+a.x;if(hit)inside=!inside}return inside}
function tangent(ps,i,closed){const n=ps.length,a=ps[i>0?i-1:(closed?n-1:0)],b=ps[i<n-1?i+1:(closed?0:n-1)];let x=b.x-a.x,z=b.z-a.z,l=Math.hypot(x,z);if(l<=EPS)return{x:1,z:0};return{x:x/l,z:z/l}}
function waterNormal({p,t,ps,closed,isWaterAt,waterSide,probe,prev}){
  const left={x:-t.z,z:t.x},right={x:t.z,z:-t.x},lp={x:p.x+left.x*probe,z:p.z+left.z*probe},rp={x:p.x+right.x*probe,z:p.z+right.z*probe};
  if(typeof isWaterAt==='function'){let l=null,r=null;try{l=!!isWaterAt(lp.x,lp.z)}catch{}try{r=!!isWaterAt(rp.x,rp.z)}catch{}if(l!==null&&r!==null&&l!==r)return l?left:right}
  if(closed){const li=pointInPolygon(lp,ps),ri=pointInPolygon(rp,ps),want=waterSide!=='outside';if(li!==ri)return li===want?left:right}
  if(prev)return left.x*prev.x+left.z*prev.z>=0?left:right;return left;
}
function phase(s){let h=2166136261>>>0;for(const c of String(s||'shore')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0)/4294967296*Math.PI*2}
const widthWave=(d,p)=>Math.sin(d*.47+p)*.55+Math.sin(d*.19+p*1.71)*.30+Math.sin(d*.83-p*.63)*.15;
export function buildShoreFoamRibbonData(input,opt={}){
  const closed=opt.closed!==false,ps=simplifyShoreline(input,Math.max(0,finite(opt.simplifyTolerance)),{closed});
  if(ps.length<(closed?3:2))throw new Error('WATER_SHORELINE_POINTS_REQUIRED');
  const width=Math.max(.01,finite(opt.width,.42)),landRatio=clamp(opt.landWidthRatio??.24,0,.95),tile=Math.max(.01,finite(opt.tileWorldLength,1.8)),
    variation=clamp(opt.widthVariation??.08,0,.35),y=finite(opt.waterY)+finite(opt.elevationOffset,.018),probe=Math.max(.01,finite(opt.normalProbeDistance,Math.min(width*.5,.16))),
    waterSide=opt.waterSide==='outside'?'outside':'inside',seed=phase(opt.seed||opt.id);
  const dist=new Float64Array(ps.length+(closed?1:0));for(let i=1;i<ps.length;i++)dist[i]=dist[i-1]+Math.hypot(ps[i].x-ps[i-1].x,ps[i].z-ps[i-1].z);
  let total=dist[ps.length-1];if(closed){total+=Math.hypot(ps[0].x-ps.at(-1).x,ps[0].z-ps.at(-1).z);dist[ps.length]=total}
  const normals=[];let prev=null;for(let i=0;i<ps.length;i++){const n=waterNormal({p:ps[i],t:tangent(ps,i,closed),ps,closed,isWaterAt:opt.isWaterAt,waterSide,probe,prev});normals.push(n);prev=n}
  const samples=ps.length+(closed?1:0),positions=new Float32Array(samples*6),uvs=new Float32Array(samples*4),waterNormals=new Float32Array(samples*4),along=new Float32Array(samples*2),side=new Float32Array(samples*2);
  const debug={shoreline:[],inner:[],outer:[],normals:[],uDivisions:[]},land=width*landRatio,wet=width*(1-landRatio);
  function write(si,pi,d){const p=ps[pi],n=normals[pi],scale=1+widthWave(d,seed)*variation,iw=land*scale,ow=wet*scale,inner={x:p.x-n.x*iw,y,z:p.z-n.z*iw},outer={x:p.x+n.x*ow,y,z:p.z+n.z*ow},bp=si*6,bu=si*4,ba=si*4,bs=si*2,u=d/tile;
    positions.set([inner.x,y,inner.z,outer.x,y,outer.z],bp);uvs.set([u,0,u,1],bu);waterNormals.set([n.x,n.z,n.x,n.z],ba);along[bs]=along[bs+1]=d;side[bs]=-iw;side[bs+1]=ow;
    debug.shoreline.push({x:p.x,y,z:p.z,u});debug.inner.push(inner);debug.outer.push(outer);debug.normals.push({x:p.x,y,z:p.z,nx:n.x,nz:n.z})}
  for(let i=0;i<ps.length;i++)write(i,i,dist[i]);if(closed)write(ps.length,0,total);
  const seg=samples-1,Index=samples*2>65535?Uint32Array:Uint16Array,indices=new Index(seg*6);for(let i=0;i<seg;i++){const a=i*2,o=i*6;indices.set([a,a+2,a+1,a+1,a+2,a+3],o)}
  for(let r=1;r<Math.floor(total/tile+EPS);r++)debug.uDivisions.push({distance:r*tile,u:r});
  return Object.freeze({closed,points:Object.freeze(ps.map(p=>Object.freeze({...p}))),positions,uvs,indices,waterNormals,along,side,totalLength:total,repeats:total/tile,tileWorldLength:tile,waterSide,debug});
}

function contourKey(p,tolerance){return Math.round(p.x/tolerance)+':'+Math.round(p.z/tolerance)}
function contourLength(points,closed=false){let d=0;for(let i=1;i<points.length;i++)d+=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);if(closed&&points.length>2)d+=Math.hypot(points[0].x-points.at(-1).x,points[0].z-points.at(-1).z);return d}
export function traceWaterShorelinesFromSampler({
  bounds,isWaterAt,columns=48,rows=48,refineSteps=3,stitchTolerance=null,
  minLength=0,maxContours=64,simplifyTolerance=0,
}={}){
  if(!bounds||typeof isWaterAt!=='function')throw new Error('WATER_SHORELINE_SAMPLER_REQUIRED');
  const x0=finite(bounds.x0),x1=finite(bounds.x1),z0=finite(bounds.z0),z1=finite(bounds.z1);
  const nx=Math.max(2,Math.round(finite(columns,48))),nz=Math.max(2,Math.round(finite(rows,48)));
  const dx=(x1-x0)/nx,dz=(z1-z0)/nz;
  if(Math.abs(dx)<=EPS||Math.abs(dz)<=EPS)throw new Error('WATER_SHORELINE_BOUNDS_INVALID');
  const wet=new Uint8Array((nx+1)*(nz+1)),at=(ix,iz)=>wet[iz*(nx+1)+ix]===1;
  for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++)wet[iz*(nx+1)+ix]=isWaterAt(x0+ix*dx,z0+iz*dz)?1:0;
  const refine=Math.max(0,Math.min(8,Math.round(finite(refineSteps,3))));
  function crossing(a,b,wa){
    let lo={...a},hi={...b},loWet=wa;
    for(let i=0;i<refine;i++){const m={x:(lo.x+hi.x)*.5,z:(lo.z+hi.z)*.5},mw=!!isWaterAt(m.x,m.z);if(mw===loWet)lo=m;else hi=m}
    return{x:(lo.x+hi.x)*.5,z:(lo.z+hi.z)*.5};
  }
  const segments=[];
  const add=(a,b)=>{if(Math.hypot(a.x-b.x,a.z-b.z)>EPS)segments.push([a,b])};
  for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
    const p0={x:x0+ix*dx,z:z0+iz*dz},p1={x:p0.x+dx,z:p0.z},p2={x:p0.x+dx,z:p0.z+dz},p3={x:p0.x,z:p0.z+dz};
    const w0=at(ix,iz),w1=at(ix+1,iz),w2=at(ix+1,iz+1),w3=at(ix,iz+1),hits=[];
    if(w0!==w1)hits.push({edge:0,p:crossing(p0,p1,w0)});
    if(w1!==w2)hits.push({edge:1,p:crossing(p1,p2,w1)});
    if(w2!==w3)hits.push({edge:2,p:crossing(p2,p3,w2)});
    if(w3!==w0)hits.push({edge:3,p:crossing(p3,p0,w3)});
    if(hits.length===2)add(hits[0].p,hits[1].p);
    else if(hits.length===4){
      const centerWet=!!isWaterAt(p0.x+dx*.5,p0.z+dz*.5),byEdge=new Map(hits.map(h=>[h.edge,h.p]));
      // Resolve 5/10 ambiguity from the real field at the cell center.
      const diagonal02=w0===w2&&w0!==w1&&w1===w3;
      if(diagonal02&&centerWet===w0){add(byEdge.get(0),byEdge.get(3));add(byEdge.get(1),byEdge.get(2))}
      else{add(byEdge.get(0),byEdge.get(1));add(byEdge.get(2),byEdge.get(3))}
    }
  }
  const tol=Math.max(EPS,finite(stitchTolerance,Math.min(Math.abs(dx),Math.abs(dz))*.20));
  const nodes=new Map(),unused=new Set(segments.map((_,i)=>i));
  for(let i=0;i<segments.length;i++)for(let end=0;end<2;end++){const k=contourKey(segments[i][end],tol);if(!nodes.has(k))nodes.set(k,[]);nodes.get(k).push({i,end})}
  function nextFor(p,exclude){
    const list=nodes.get(contourKey(p,tol))||[];
    for(const ref of list)if(unused.has(ref.i)&&ref.i!==exclude)return ref;
    return null;
  }
  const contours=[];
  while(unused.size){
    const seed=unused.values().next().value,seg=segments[seed];unused.delete(seed);
    let pts=[seg[0],seg[1]],closed=false;
    for(let guard=0;guard<segments.length+2;guard++){
      const ref=nextFor(pts.at(-1),-1);if(!ref)break;unused.delete(ref.i);const s2=segments[ref.i],q=ref.end===0?s2[1]:s2[0];pts.push(q);
      if(same(pts[0],q)||contourKey(pts[0],tol)===contourKey(q,tol)){closed=true;pts.pop();break}
    }
    if(!closed){
      for(let guard=0;guard<segments.length+2;guard++){
        const ref=nextFor(pts[0],-1);if(!ref)break;unused.delete(ref.i);const s2=segments[ref.i],q=ref.end===0?s2[1]:s2[0];pts.unshift(q);
        if(same(pts.at(-1),q)||contourKey(pts.at(-1),tol)===contourKey(q,tol)){closed=true;pts.shift();break}
      }
    }
    if(pts.length<(closed?3:2))continue;
    pts=simplifyShoreline(pts,simplifyTolerance,{closed});
    const length=contourLength(pts,closed);if(length+EPS<Math.max(0,finite(minLength)))continue;
    contours.push(Object.freeze({points:Object.freeze(pts.map(p=>Object.freeze({...p}))),closed,length}));
  }
  contours.sort((a,b)=>b.length-a.length);
  return Object.freeze(contours.slice(0,Math.max(1,Math.round(finite(maxContours,64)))));
}

export function applyPlanarWorldUVs(geometry,{tileWorldSize=3,axes='xy',offsetX=0,offsetZ=0,THREE=null}={}){
  const p=geometry?.getAttribute?.('position')||geometry?.attributes?.position;if(!p)throw new Error('WATER_SURFACE_POSITION_REQUIRED');const size=Math.max(.01,finite(tileWorldSize,3)),uv=new Float32Array(p.count*2);
  const read=(axis,i)=>typeof p['get'+axis.toUpperCase()]==='function'?p['get'+axis.toUpperCase()](i):p.array[i*p.itemSize+({x:0,y:1,z:2}[axis]??0)];
  for(let i=0;i<p.count;i++){uv[i*2]=(read('x',i)+offsetX)/size;uv[i*2+1]=(read(axes==='xz'?'z':'y',i)+offsetZ)/size}
  geometry.setAttribute('uv',THREE?.Float32BufferAttribute?new THREE.Float32BufferAttribute(uv,2):{array:uv,itemSize:2,count:p.count});return geometry;
}
function configureTexture(THREE,tex,kind){if(!tex)return null;tex.wrapS=THREE.RepeatWrapping;tex.wrapT=kind==='foam'?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;if('colorSpace'in tex&&THREE.SRGBColorSpace)tex.colorSpace=THREE.SRGBColorSpace;if('magFilter'in tex&&THREE.LinearFilter)tex.magFilter=THREE.LinearFilter;if('minFilter'in tex&&THREE.LinearMipmapLinearFilter)tex.minFilter=THREE.LinearMipmapLinearFilter;tex.needsUpdate=true;return tex}
export function createWorldWaterTextureCache({THREE,baseUrl=import.meta.url,renderer=null,logger=console}={}){
  if(!THREE?.TextureLoader)throw new Error('WORLD_WATER_THREE_REQUIRED');const loader=new THREE.TextureLoader(),tasks=new Map(),aniso=Math.max(1,Number(renderer?.capabilities?.getMaxAnisotropy?.())||1);try{loader.setCrossOrigin?.('anonymous')}catch{}
  function load(path,kind='water'){const key=kind+':'+path;if(tasks.has(key))return tasks.get(key).promise;const url=resolveWorldWaterTextureUrl(path,baseUrl),task={path,kind,url,status:'loading',texture:null,error:null,promise:null};
    task.promise=new Promise(resolve=>loader.load(url,tex=>{configureTexture(THREE,tex,kind);if('anisotropy'in tex)tex.anisotropy=Math.min(aniso,8);task.status='ready';task.texture=tex;resolve(tex)},undefined,error=>{task.status='error';task.error=error||new Error('WORLD_WATER_TEXTURE_LOAD_FAILED');logger?.warn?.('Repository water texture failed:',path,url,error);resolve(null)}));tasks.set(key,task);return task.promise}
  return Object.freeze({load,texture:(p,k='water')=>tasks.get(k+':'+p)?.texture||null,status:(p,k='water')=>Object.freeze({path:p,kind:k,status:tasks.get(k+':'+p)?.status||'idle'}),dispose:()=>{for(const t of tasks.values())t.texture?.dispose?.();tasks.clear()}});
}
function installUvScroll(mat,uniforms,key){mat.onBeforeCompile=shader=>{shader.uniforms.luminousUvOffset=uniforms.uvOffset;shader.uniforms.luminousUvScale=uniforms.uvScale;shader.uniforms.luminousUvBase=uniforms.uvBase;shader.vertexShader=shader.vertexShader.replace('#include <uv_pars_vertex>','#include <uv_pars_vertex>\\nuniform vec2 luminousUvOffset; uniform vec2 luminousUvScale; uniform vec2 luminousUvBase;').replace('#include <map_vertex>','#include <map_vertex>\\n#ifdef USE_MAP\\n vMapUv = vMapUv * luminousUvScale + luminousUvBase + luminousUvOffset;\\n#endif')};mat.customProgramCacheKey=()=>key}
function waterMaterial(THREE,cfg){const uniforms={uvOffset:{value:new THREE.Vector2(0,0)},uvScale:{value:new THREE.Vector2(1,1)},uvBase:{value:new THREE.Vector2(0,0)}},material=new THREE.MeshStandardMaterial({color:cfg.color,map:null,roughness:cfg.roughness,metalness:cfg.metalness,transparent:true,opacity:cfg.opacity,alphaTest:.001,side:THREE.DoubleSide,depthWrite:true,depthTest:true});installUvScroll(material,uniforms,'luminous-water-v3-alpha');material.userData.luminousWaterUniforms=uniforms;return{material,uniforms}}
function foamMaterial(THREE,cfg){const uniforms={uvOffset:{value:new THREE.Vector2(0,0)},time:{value:0},pulseAmplitude:{value:cfg.pulseAmplitude},pulseSpeed:{value:cfg.pulseSpeed},pulseFrequency:{value:cfg.pulseFrequency}},material=new THREE.MeshBasicMaterial({color:0xffffff,map:null,transparent:true,opacity:0,alphaTest:.001,side:THREE.DoubleSide,depthWrite:false,depthTest:true});material.userData.luminousTargetOpacity=cfg.opacity;
  material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,{luminousUvOffset:uniforms.uvOffset,luminousFoamTime:uniforms.time,luminousFoamPulseAmplitude:uniforms.pulseAmplitude,luminousFoamPulseSpeed:uniforms.pulseSpeed,luminousFoamPulseFrequency:uniforms.pulseFrequency});
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\\nattribute vec2 luminousFoamNormal; attribute float luminousFoamAlong; uniform float luminousFoamTime; uniform float luminousFoamPulseAmplitude; uniform float luminousFoamPulseSpeed; uniform float luminousFoamPulseFrequency;')
      .replace('#include <uv_pars_vertex>','#include <uv_pars_vertex>\\nuniform vec2 luminousUvOffset;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\\nfloat luminousPulse=sin(luminousFoamTime*luminousFoamPulseSpeed+luminousFoamAlong*luminousFoamPulseFrequency)*luminousFoamPulseAmplitude; transformed.x+=luminousFoamNormal.x*luminousPulse; transformed.z+=luminousFoamNormal.y*luminousPulse;')
      .replace('#include <map_vertex>','#include <map_vertex>\\n#ifdef USE_MAP\\n vMapUv += luminousUvOffset;\\n#endif')};material.customProgramCacheKey=()=> 'luminous-shore-foam-v1';material.userData.luminousFoamUniforms=uniforms;return{material,uniforms}}
function ribbonGeometry(THREE,d){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(d.positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(d.uvs,2));g.setAttribute('luminousFoamNormal',new THREE.Float32BufferAttribute(d.waterNormals,2));g.setAttribute('luminousFoamAlong',new THREE.Float32BufferAttribute(d.along,1));g.setAttribute('luminousFoamSide',new THREE.Float32BufferAttribute(d.side,1));g.setIndex(new THREE.BufferAttribute(d.indices,1));g.computeVertexNormals?.();g.computeBoundingSphere?.();return g}
function lineGeometry(THREE,ps){const a=new Float32Array(ps.flatMap(p=>[p.x,p.y,p.z])),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));return g}
function debugGroup(THREE,d,width){const g=new THREE.Group();g.name='shore-foam-ribbon-debug';const line=(name,ps,color)=>{const m=new THREE.LineBasicMaterial({color,transparent:true,opacity:.95,depthTest:false}),o=new THREE.Line(lineGeometry(THREE,ps),m);o.name=name;o.renderOrder=500;g.add(o)};
  line('shoreline-original',d.debug.shoreline,0xffd966);line('shoreline-inner-edge',d.debug.inner,0xff5c5c);line('shoreline-outer-edge-water',d.debug.outer,0x4dd7ff);
  const n=[];for(const p of d.debug.normals)n.push({x:p.x,y:p.y+.006,z:p.z},{x:p.x+p.nx*Math.max(.12,width*.8),y:p.y+.006,z:p.z+p.nz*Math.max(.12,width*.8)});if(n.length){const o=new THREE.LineSegments(lineGeometry(THREE,n),new THREE.LineBasicMaterial({color:0x62ff85,depthTest:false}));o.name='shoreline-water-normals';o.renderOrder=501;g.add(o)}
  const div=[];for(const cut of d.debug.uDivisions){for(let s=0;s<d.along.length/2-1;s++){const a=d.along[s*2],b=d.along[(s+1)*2];if(cut.distance<a-EPS||cut.distance>b+EPS||Math.abs(b-a)<=EPS)continue;const t=clamp((cut.distance-a)/(b-a),0,1);for(let e=0;e<2;e++){const i=(s*2+e)*3,j=((s+1)*2+e)*3;div.push({x:d.positions[i]+(d.positions[j]-d.positions[i])*t,y:d.positions[i+1]+.01,z:d.positions[i+2]+(d.positions[j+2]-d.positions[i+2])*t})}break}}
  if(div.length){const o=new THREE.LineSegments(lineGeometry(THREE,div),new THREE.LineBasicMaterial({color:0xd966ff,depthTest:false}));o.name='shoreline-uv-repeat-divisions';o.renderOrder=502;g.add(o)}g.visible=false;return g}
function disposeObject(o){o?.traverse?.(c=>{c.geometry?.dispose?.();for(const tex of c.userData?.luminousOwnedTextures||[])tex?.dispose?.();const ms=Array.isArray(c.material)?c.material:[c.material];for(const m of ms)m?.dispose?.()});o?.parent?.remove?.(o)}
export function createWorldWaterBodyRuntime({THREE,renderer=null,baseUrl=import.meta.url,logger=console,showShoreFoamRibbon=false}={}){
  if(!THREE?.Mesh||!THREE?.BufferGeometry)throw new Error('WORLD_WATER_THREE_REQUIRED');const textures=createWorldWaterTextureCache({THREE,renderer,baseUrl,logger}),bodies=new Map();let debugVisible=!!showShoreFoamRibbon,elapsed=0;
  const attach=(rec,kind,path,mat)=>textures.load(path,kind).then(tex=>{if(tex&&!rec.disposed){mat.map=tex;mat.transparent=true;if(kind==='foam')mat.opacity=finite(mat.userData?.luminousTargetOpacity,1);mat.needsUpdate=true}return tex});
  function createWaterBody(opt={}){const id=String(opt.id||'water-body-'+(bodies.size+1));if(bodies.has(id))throw new Error('WATER_BODY_DUPLICATE:'+id);if(!opt.parent?.add)throw new Error('WATER_BODY_PARENT_REQUIRED');
    const config=normalizeWaterBodyConfig(opt),group=new THREE.Group();group.name='water-body:'+id;opt.parent.add(group);const rec={id,config,group,surface:null,surfaceUniforms:null,foamMeshes:[],foamUniforms:[],debugGroups:[],promises:[],disposed:false};
    if(opt.surfaceGeometry||opt.surfaceMesh){const surface=opt.surfaceMesh||new THREE.Mesh(opt.surfaceGeometry,null),geo=surface.geometry;if(opt.generateWaterUVs!==false)applyPlanarWorldUVs(geo,{tileWorldSize:config.water.tileWorldSize,axes:opt.surfaceUvAxes||'xy',offsetX:finite(opt.surfaceUvOffsetX),offsetZ:finite(opt.surfaceUvOffsetZ),THREE});
      const kit=waterMaterial(THREE,config.water),uvScale=opt.surfaceUvScale,uvBase=opt.surfaceUvBase;if(uvScale)kit.uniforms.uvScale.value.set(finite(uvScale.x??uvScale[0],1),finite(uvScale.y??uvScale[1],1));if(uvBase)kit.uniforms.uvBase.value.set(finite(uvBase.x??uvBase[0]),finite(uvBase.y??uvBase[1]));if(surface.material&&opt.disposeReplacedSurfaceMaterial===true)surface.material.dispose?.();surface.material=kit.material;if(!opt.surfaceMesh){if(opt.surfaceRotationX!=null)surface.rotation.x=finite(opt.surfaceRotationX);if(opt.waterY!=null)surface.position.y=finite(opt.waterY)}
      surface.name=surface.name||id+':surface';surface.userData.luminousWaterBodyId=id;surface.userData.luminousWaterSurface=true;surface.receiveShadow=opt.receiveShadow!==false;surface.renderOrder=finite(opt.waterRenderOrder,-4);if(surface.parent!==group)group.add(surface);rec.surface=surface;rec.surfaceUniforms=kit.uniforms;rec.promises.push(attach(rec,'water',config.water.texture,kit.material))}
    if(config.foam.enabled){const shores=Array.isArray(opt.shorelines)?opt.shorelines:(opt.shoreline?[opt.shoreline]:[]);for(let i=0;i<shores.length;i++){const raw=shores[i],desc=Array.isArray(raw)?{points:raw}:raw,data=buildShoreFoamRibbonData(desc.points,{...config.foam,id:id+':'+i,waterY:desc.waterY??opt.waterY??0,closed:desc.closed!==false,waterSide:desc.waterSide||opt.waterSide||'inside',isWaterAt:desc.isWaterAt||opt.isWaterAt}),geo=ribbonGeometry(THREE,data),kit=foamMaterial(THREE,config.foam),mesh=new THREE.Mesh(geo,kit.material);
      mesh.name=id+':shore-foam:'+i;mesh.renderOrder=finite(opt.foamRenderOrder,40);mesh.userData.luminousWaterBodyId=id;mesh.userData.luminousShoreFoam=true;mesh.userData.shorelineLength=data.totalLength;mesh.userData.foamRepeats=data.repeats;group.add(mesh);rec.foamMeshes.push(mesh);rec.foamUniforms.push(kit.uniforms);rec.promises.push(attach(rec,'foam',config.foam.texture,kit.material));const dbg=debugGroup(THREE,data,config.foam.width);dbg.visible=debugVisible;group.add(dbg);rec.debugGroups.push(dbg)}}
    rec.ready=()=>Promise.all(rec.promises).then(()=>rec);rec.setDebugVisible=v=>{for(const d of rec.debugGroups)d.visible=!!v};rec.dispose=()=>{if(rec.disposed)return false;rec.disposed=true;disposeObject(group);bodies.delete(id);return true};bodies.set(id,rec);return rec}
  function update(dt){const step=Math.max(0,Math.min(.1,finite(dt)));elapsed+=step;for(const rec of bodies.values()){const s=rec.config.water.scrollSpeed;if(rec.surfaceUniforms){rec.surfaceUniforms.uvOffset.value.x+=s.x*step;rec.surfaceUniforms.uvOffset.value.y+=s.y*step}for(const u of rec.foamUniforms){u.time.value=elapsed;u.uvOffset.value.x+=rec.config.foam.scrollSpeed*step}}}
  function setDebug(o={}){if('showShoreFoamRibbon'in o)debugVisible=!!o.showShoreFoamRibbon;for(const r of bodies.values())r.setDebugVisible(debugVisible);return Object.freeze({showShoreFoamRibbon:debugVisible})}
  return Object.freeze({mode:'repository-local',assets:WORLD_WATER_ASSETS,textures,createWaterBody,removeWaterBody:id=>bodies.get(String(id))?.dispose?.()||false,getWaterBody:id=>bodies.get(String(id))||null,update,setDebug,status:()=>Object.freeze({bodyCount:bodies.size,showShoreFoamRibbon:debugVisible,elapsed,assetMode:'repository-local'}),dispose:()=>{for(const r of [...bodies.values()])r.dispose();textures.dispose()}});
}
export default Object.freeze({WORLD_WATER_ASSETS,DEFAULT_WATER_BODY_WATER,DEFAULT_WATER_BODY_FOAM,normalizeWaterBodyConfig,resolveWorldWaterTextureUrl,simplifyShoreline,polygonSignedArea,pointInPolygon,buildShoreFoamRibbonData,traceWaterShorelinesFromSampler,applyPlanarWorldUVs,createWorldWaterTextureCache,createWorldWaterBodyRuntime});
