import {createHandler} from '../../services/audio-r2/worker.mjs';
const tokenExpiry=Math.floor(Date.now()/1000)+3600;
export const origin='https://sokcrow.github.io';
export const jwt=uid=>Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,aud:'luminous-system',iss:'https://securetoken.google.com/luminous-system',exp:tokenExpiry})).toString('base64url')+'.signature';
export function setup(){
 const objects=new Map();let active={};
 const bucket={
  async head(key){const object=objects.get(key);return object?{...object,body:undefined}:null;},
  async list({prefix}){return {objects:[...objects.values()].filter(o=>o.key.startsWith(prefix)),truncated:false};},
  async put(key,bytes,options){if(objects.has(key)&&options.onlyIf)return null;const object={key,size:bytes.byteLength,bytes:new Uint8Array(bytes),httpEtag:'"etag"',httpMetadata:options.httpMetadata,customMetadata:options.customMetadata};objects.set(key,object);return object;},
  async get(key,{range}={}){const object=objects.get(key);if(!object)return null;const bytes=range?object.bytes.slice(range.offset,range.offset+range.length):object.bytes;return {...object,body:new Response(bytes).body};},
  async delete(key){objects.delete(key);}
 };
 const env={AUDIO_BUCKET:bucket,AUDIO_SIGNING_KEY:'a-test-key-that-is-longer-than-thirty-two-characters',ALLOWED_ORIGINS:origin,FIREBASE_DATABASE_URL:'https://luminous-system-default-rtdb.firebaseio.com',FIREBASE_PROJECT_ID:'luminous-system'};
 const requests=[];
 const firebase=async url=>{url=new URL(url);requests.push(url);if(![jwt('dm'),jwt('player'),jwt('outsider')].includes(url.searchParams.get('auth')))return new Response('{}',{status:401});const path=decodeURIComponent(url.pathname);if(path.endsWith('/config/dm_uid.json'))return Response.json('dm');if(path.includes('/members/'))return Response.json(path.endsWith('/outsider.json')?false:true);if(path.endsWith('/audio_director.json'))return Response.json(active);return Response.json(null);};
 const handler=createHandler(firebase);
 const request=async(path,{uid='dm',method='GET',body,headers={}}={})=>handler(new Request('https://limbus-audio.account.workers.dev'+path,{method,headers:{Origin:origin,Authorization:'Bearer '+jwt(uid),...headers},...(body?{body}:{} )}),env);
 return {env,handler,request,objects,requests,setActive:value=>{active=value;}};
}

// Small, playable PCM WAV for upload and browser regressions.
export function wavBytes(){
 const wav=Buffer.alloc(44+1600);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(1600,40);
 for(let i=0;i<800;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/8000)*4000),44+i*2);
 return new Uint8Array(wav);
}
