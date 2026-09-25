import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const outputDir=path.join(root,'Assets','Images','World','Water');
const ASSETS=Object.freeze([
  Object.freeze({id:'water_seamless',file:'water_seamless.png',source:'https://i.imgur.com/ZKjxmk7.png',legacySource:'https://imgur.com/ZKjxmk7.png',requireTransparency:false}),
  Object.freeze({id:'coast_foam_seamless',file:'coast_foam_seamless.png',source:'https://i.imgur.com/tJMwx10.png',legacySource:'https://imgur.com/tJMwx10.png',requireTransparency:true}),
]);
const PNG_SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:(pb<=pc?b:c)}
function transparency(chunks,h){
  const trns=chunks.some(c=>c.type==='tRNS'&&c.data.length),alpha=h.colorType===4||h.colorType===6;
  if(!alpha)return{hasAlphaChannel:false,hasTransparency:trns,transparentPixelsDetected:trns};
  if(h.bitDepth!==8||h.interlace!==0)return{hasAlphaChannel:true,hasTransparency:true,transparentPixelsDetected:null};
  const channels=h.colorType===6?4:2,bpp=channels,rowBytes=h.width*channels,compressed=Buffer.concat(chunks.filter(c=>c.type==='IDAT').map(c=>c.data)),raw=zlib.inflateSync(compressed),expected=(rowBytes+1)*h.height;
  if(raw.length!==expected)throw new Error('PNG_SCANLINE_SIZE_MISMATCH:'+raw.length+':'+expected);
  let offset=0,prev=Buffer.alloc(rowBytes),transparentPixelsDetected=false;
  for(let y=0;y<h.height;y++){const filter=raw[offset++],scan=raw.subarray(offset,offset+rowBytes);offset+=rowBytes;const recon=Buffer.allocUnsafe(rowBytes);
    for(let x=0;x<rowBytes;x++){const left=x>=bpp?recon[x-bpp]:0,up=prev[x]||0,ul=x>=bpp?(prev[x-bpp]||0):0;let v;
      if(filter===0)v=scan[x];else if(filter===1)v=scan[x]+left;else if(filter===2)v=scan[x]+up;else if(filter===3)v=scan[x]+Math.floor((left+up)/2);else if(filter===4)v=scan[x]+paeth(left,up,ul);else throw new Error('PNG_UNSUPPORTED_FILTER:'+filter);recon[x]=v&255}
    for(let x=channels-1;x<rowBytes;x+=channels)if(recon[x]<255){transparentPixelsDetected=true;break}prev=recon}
  return{hasAlphaChannel:true,hasTransparency:transparentPixelsDetected,transparentPixelsDetected};
}
export function inspectPng(buffer){
  if(!Buffer.isBuffer(buffer)||buffer.length<33||!buffer.subarray(0,8).equals(PNG_SIGNATURE))throw new Error('INVALID_PNG_SIGNATURE');
  const chunks=[];let offset=8,ihdr=null,end=false;
  while(offset+12<=buffer.length){const len=buffer.readUInt32BE(offset);offset+=4;const type=buffer.toString('ascii',offset,offset+4);offset+=4;if(offset+len+4>buffer.length)throw new Error('PNG_TRUNCATED_CHUNK:'+type);const data=buffer.subarray(offset,offset+len);offset+=len+4;chunks.push({type,data});
    if(type==='IHDR'){if(len!==13)throw new Error('PNG_INVALID_IHDR');ihdr={width:data.readUInt32BE(0),height:data.readUInt32BE(4),bitDepth:data[8],colorType:data[9],compression:data[10],filter:data[11],interlace:data[12]}}
    if(type==='IEND'){end=true;break}}
  if(!ihdr||!end||!ihdr.width||!ihdr.height)throw new Error('PNG_STRUCTURE_INVALID');
  return Object.freeze({...ihdr,...transparency(chunks,ihdr)});
}
async function download(asset){
  const res=await fetch(asset.source,{redirect:'follow',headers:{'user-agent':'Luminous-Asset-Vendor/1.0'}});
  if(!res.ok)throw new Error('DOWNLOAD_FAILED:'+asset.id+':'+res.status);
  const bytes=Buffer.from(await res.arrayBuffer()),info=inspectPng(bytes);
  if(asset.requireTransparency&&(!info.hasAlphaChannel||info.hasTransparency!==true))throw new Error('FOAM_ALPHA_REQUIRED:'+asset.id+':colorType='+info.colorType);
  return{bytes,info};
}
await fs.mkdir(outputDir,{recursive:true});
const catalog=[];
for(const asset of ASSETS){
  const {bytes,info}=await download(asset),output=path.join(outputDir,asset.file);
  await fs.writeFile(output,bytes); // exact source bytes: no decode, resize or recompression
  catalog.push({id:asset.id,path:path.relative(root,output).split(path.sep).join('/'),bytes:bytes.length,sha256:sha256(bytes),width:info.width,height:info.height,bitDepth:info.bitDepth,colorType:info.colorType,hasAlphaChannel:info.hasAlphaChannel,transparentPixelsDetected:info.transparentPixelsDetected,legacySource:asset.legacySource});
  console.log(asset.id+': '+info.width+'x'+info.height+' · '+bytes.length+' bytes · '+sha256(bytes));
}
const manifest={schemaVersion:1,domain:'world.water',runtimeMode:'repository-local',note:'Runtime loads only repository-local PNG paths. legacySource is provenance/vendor input only. Files are stored byte-for-byte without resizing or recompression.',assetCount:catalog.length,assets:catalog};
await fs.writeFile(path.join(outputDir,'catalog.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
console.log('Wrote Assets/Images/World/Water/catalog.json');
