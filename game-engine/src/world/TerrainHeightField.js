const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function normalizedSegments(value,label){
  const n=Math.floor(finite(value,0));
  if(n<1)throw new Error(`${label} must be >= 1`);
  return n;
}

export function createTriangulatedHeightField({
  x0=0,x1=1,z0=0,z1=1,segmentsX=1,segmentsZ=1,heights=[]
}={}){
  const sx=normalizedSegments(segmentsX,"segmentsX");
  const sz=normalizedSegments(segmentsZ,"segmentsZ");
  const minX=finite(x0),maxX=finite(x1,1),minZ=finite(z0),maxZ=finite(z1,1);
  if(!(maxX>minX)||!(maxZ>minZ))throw new Error("terrain height field bounds must have positive size");
  const expected=(sx+1)*(sz+1);
  if(!heights||heights.length!==expected)throw new Error(`terrain height field expected ${expected} heights, got ${heights?.length??0}`);
  const data=Float64Array.from(heights,value=>finite(value));
  const dx=(maxX-minX)/sx,dz=(maxZ-minZ)/sz,stride=sx+1;
  const contains=(x,z)=>Number.isFinite(Number(x))&&Number.isFinite(Number(z))&&x>=minX&&x<=maxX&&z>=minZ&&z<=maxZ;

  function locate(x,z){
    if(!contains(x,z))return null;
    const gx=clamp((Number(x)-minX)/dx,0,sx),gz=clamp((Number(z)-minZ)/dz,0,sz);
    const ix=Math.min(sx-1,Math.floor(gx)),iz=Math.min(sz-1,Math.floor(gz));
    const u=clamp(gx-ix,0,1),v=clamp(gz-iz,0,1);
    const a=iz*stride+ix,b=a+1,c=a+stride,d=c+1;
    return {ix,iz,u,v,h00:data[a],h10:data[b],h01:data[c],h11:data[d]};
  }

  function triangleSample(x,z){
    const q=locate(x,z);if(!q)return null;
    const {ix,iz,u,v,h00,h10,h01,h11}=q;
    let height,du,dv,triangle;
    if((ix+iz)&1){
      if(u+v<=1){
        height=h00+(h10-h00)*u+(h01-h00)*v;
        du=h10-h00;dv=h01-h00;triangle="acb";
      }else{
        height=h10*(1-v)+h01*(1-u)+h11*(u+v-1);
        du=h11-h01;dv=h11-h10;triangle="bcd";
      }
    }else if(v>=u){
      height=h00*(1-v)+h01*(v-u)+h11*u;
      du=h11-h01;dv=h01-h00;triangle="acd";
    }else{
      height=h00*(1-u)+h11*v+h10*(u-v);
      du=h10-h00;dv=h11-h10;triangle="adb";
    }
    const hx=du/dx,hz=dv/dz,risePerRun=Math.hypot(hx,hz);
    return Object.freeze({height,hx,hz,risePerRun,angleDeg:Math.atan(risePerRun)*180/Math.PI,ix,iz,u,v,triangle});
  }

  return Object.freeze({
    x0:minX,x1:maxX,z0:minZ,z1:maxZ,segmentsX:sx,segmentsZ:sz,
    contains,
    heightAt:(x,z)=>triangleSample(x,z)?.height??null,
    slopeAt:(x,z)=>{
      const s=triangleSample(x,z);
      return s?Object.freeze({hx:s.hx,hz:s.hz,risePerRun:s.risePerRun,angleDeg:s.angleDeg}):null;
    },
    sampleAt:triangleSample
  });
}

export default Object.freeze({createTriangulatedHeightField});
