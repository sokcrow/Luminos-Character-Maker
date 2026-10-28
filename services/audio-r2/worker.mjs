/* Private R2 audio library. Firebase validates the user's existing ID token;
   no Firebase admin credentials or R2 keys are exposed to the browser. */
const BOOTSTRAP_DM = 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
const MAX_BYTES = 25 * 1024 * 1024;
const TICKET_SECONDS = 3600;
const ID = /^r2_[a-f0-9]{64}$/;
const SCOPES = /^(default|[A-Za-z0-9_-]{1,100})$/;
class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail = (status,message) => { throw new HttpError(status,message); };
const json = (value,status=200) => new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const hex = bytes => Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
function scopeRoot(scope){return scope==='default'?'campaña':`campaña/encuentros/${scope}/state/campaña`;}
function objectKey(scope,id){return `${scope}/files/${id}`;}
async function firebaseRead(env,path,token,fetcher){
  const base = new URL(env.FIREBASE_DATABASE_URL);
  if(base.protocol!=='https:' || !/\.(firebaseio\.com|firebasedatabase\.app)$/.test(base.hostname)) fail(503,'Servicio sin configurar.');
  const url=new URL('/'+path.split('/').map(encodeURIComponent).join('/')+'.json',base);
  url.searchParams.set('auth',token);
  const response=await fetcher(url,{headers:{Accept:'application/json'},redirect:'error'});
  if(!response.ok) fail(response.status===401||response.status===403?401:503,'No se pudo validar la sesión de juego.');
  return response.json();
}
async function authorize(request,env,scope,write,fetcher){
  const token=request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
  if(!token || token.length>12000) fail(401,'Inicia sesión en Limbus.');
  // This authenticated RTDB read is the signature/token validation boundary.
  // Never trust the decoded claims unless Firebase has accepted this same token.
  const dm=await firebaseRead(env,scopeRoot(scope)+'/config/dm_uid',token,fetcher);
  let claims;
  try{claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{fail(401,'Sesión inválida.');}
  if(claims.aud!==env.FIREBASE_PROJECT_ID || claims.iss!==`https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}` || typeof claims.sub!=='string' || !claims.sub || claims.sub.length>128 || claims.exp*1000<=Date.now()) fail(401,'Sesión inválida.');
  if(scope!=='default'){
    const member=await firebaseRead(env,`campaña/encuentros/${scope}/members/${claims.sub}`,token,fetcher);
    if(member!==true) fail(403,'No perteneces a este encuentro.');
  }
  if(write && claims.sub!==dm && claims.sub!==BOOTSTRAP_DM) fail(403,'Sólo el DM puede gestionar archivos.');
  return token;
}
async function signature(env,path,expiry){
  if(!env.AUDIO_SIGNING_KEY || env.AUDIO_SIGNING_KEY.length<32) fail(503,'Falta activar la biblioteca de audio.');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.AUDIO_SIGNING_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${path}\n${expiry}`)));
}
function metadata(object){
  const m=object.customMetadata||{};
  return {id:object.key.split('/').pop(),label:m.label||'Audio',kind:m.kind,bytes:object.size,createdAt:Number(m.createdAt)||0};
}
async function signedEntry(object,scope,request,env){
  const entry=metadata(object),path=`/media/${scope}/${entry.id}`;
  const expires=Math.floor(Date.now()/1000)+TICKET_SECONDS;
  const url=new URL(path,request.url);url.searchParams.set('e',expires);url.searchParams.set('sig',await signature(env,path,expires));
  return {...entry,url:url.href,expiresAt:expires*1000};
}
function sniff(bytes){
  const b=new Uint8Array(bytes),text=(a,n)=>String.fromCharCode(...b.slice(a,a+n));
  if(text(0,3)==='ID3' || b.length>2 && b[0]===255 && (b[1]&224)===224) return 'audio/mpeg';
  if(text(0,4)==='OggS') return 'audio/ogg';
  if(text(0,4)==='RIFF' && text(8,4)==='WAVE') return 'audio/wav';
  if(text(0,4)==='fLaC') return 'audio/flac';
  if(text(4,4)==='ftyp' && ['M4A ','M4B ','isom','mp42'].includes(text(8,4))) return 'audio/mp4';
  fail(415,'Usa un archivo MP3, OGG, WAV, FLAC o M4A válido.');
}
async function boundedBody(request){
  const advertised=Number(request.headers.get('Content-Length'));
  if(advertised>MAX_BYTES) fail(413,'El máximo es 25 MB por archivo.');
  if(!request.body) fail(400,'Falta el archivo.');
  const reader=request.body.getReader(),chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();fail(413,'El máximo es 25 MB por archivo.');}chunks.push(value);}
  if(!size) fail(400,'El archivo está vacío.');
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
async function media(request,env,url){
  const match=url.pathname.match(/^\/media\/([A-Za-z0-9_-]{1,100})\/(r2_[a-f0-9]{64})$/);
  if(!match || !['GET','HEAD'].includes(request.method)) fail(404,'Audio no encontrado.');
  const expiry=Number(url.searchParams.get('e')),provided=url.searchParams.get('sig')||'';
  if(!Number.isInteger(expiry)||expiry<Math.floor(Date.now()/1000)||expiry>Math.floor(Date.now()/1000)+TICKET_SECONDS+60) fail(403,'El acceso al audio expiró.');
  const expected=await signature(env,url.pathname,expiry);
  if(provided.length!==expected.length) fail(403,'Acceso inválido.');
  let different=0;for(let i=0;i<expected.length;i++)different|=expected.charCodeAt(i)^provided.charCodeAt(i);
  if(different)fail(403,'Acceso inválido.');
  const key=objectKey(match[1],match[2]),head=await env.AUDIO_BUCKET.head(key);
  if(!head)fail(404,'Este audio ya no está en la biblioteca.');
  const headers=new Headers({'Content-Type':head.httpMetadata?.contentType||'application/octet-stream','Accept-Ranges':'bytes','ETag':head.httpEtag,'Cache-Control':'private, max-age=300','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
  let range=null;
  const requested=request.headers.get('Range');
  if(requested){
    const m=requested.match(/^bytes=(\d*)-(\d*)$/);if(!m || (!m[1]&&!m[2]))fail(416,'Rango de audio inválido.');
    const start=m[1]?Number(m[1]):Math.max(0,head.size-Number(m[2]));
    const end=m[1]&&m[2]?Math.min(Number(m[2]),head.size-1):head.size-1;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start> end||start>=head.size) return new Response(null,{status:416,headers:{'Content-Range':`bytes */${head.size}`}});
    range={offset:start,length:end-start+1};headers.set('Content-Range',`bytes ${start}-${end}/${head.size}`);
  }
  headers.set('Content-Length',String(range?.length??head.size));
  if(request.method==='HEAD')return new Response(null,{status:range?206:200,headers});
  const object=await env.AUDIO_BUCKET.get(key,range?{range}:{});
  if(!object)fail(404,'Audio no encontrado.');
  return new Response(object.body,{status:range?206:200,headers});
}
export function createHandler(fetcher=fetch){return async function handler(request,env){
  const origin=request.headers.get('Origin'),allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
  const cors=new Headers({'Vary':'Origin','Access-Control-Allow-Methods':'GET,HEAD,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type,Range','Access-Control-Expose-Headers':'Content-Range,Content-Length,ETag'});
  if(origin&&allowed.includes(origin))cors.set('Access-Control-Allow-Origin',origin);
  let response;
  try{
    if(origin&&!allowed.includes(origin))fail(403,'Este sitio no está autorizado.');
    if(!env.AUDIO_BUCKET||!env.AUDIO_SIGNING_KEY||env.AUDIO_SIGNING_KEY.length<32)fail(503,'Biblioteca sin configurar.');
    if(request.method==='OPTIONS')response=new Response(null,{status:204});
    else{
      const url=new URL(request.url);
      if(url.pathname.startsWith('/media/'))response=await media(request,env,url);
      else{
        const scope=url.searchParams.get('scope')||'default';if(!SCOPES.test(scope))fail(400,'Encuentro inválido.');
        const write=['PUT','DELETE'].includes(request.method);
        const token=await authorize(request,env,scope,write,fetcher);
        if(url.pathname==='/catalog'&&request.method==='GET'){
          let cursor,objects=[];
          do{const page=await env.AUDIO_BUCKET.list({prefix:scope+'/files/',include:['customMetadata','httpMetadata'],cursor});objects.push(...page.objects);cursor=page.truncated?page.cursor:undefined;}while(cursor);
          const tracks=await Promise.all(objects.filter(o=>ID.test(o.key.split('/').pop())).map(o=>signedEntry(o,scope,request,env)));
          response=json({tracks,bytes:objects.reduce((sum,o)=>sum+o.size,0),maxFileBytes:MAX_BYTES});
        }else if(url.pathname==='/tracks'&&request.method==='PUT'){
          const kind=url.searchParams.get('kind');if(!['music','ambience','sfx'].includes(kind))fail(400,'Elige música, ambiente o efecto.');
          const label=(url.searchParams.get('name')||'Audio').normalize().trim().slice(0,120);if(!label)fail(400,'Escribe un nombre.');
          const bytes=await boundedBody(request),contentType=sniff(bytes),id='r2_'+hex(await crypto.subtle.digest('SHA-256',bytes)),key=objectKey(scope,id);
          let object=await env.AUDIO_BUCKET.head(key),duplicate=Boolean(object);
          if(!object){object=await env.AUDIO_BUCKET.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType},customMetadata:{label,kind,createdAt:String(Date.now())}});if(!object){object=await env.AUDIO_BUCKET.head(key);duplicate=true;}}
          response=json({track:await signedEntry(object,scope,request,env),duplicate},duplicate?200:201);
        }else if(url.pathname.startsWith('/tracks/')&&request.method==='DELETE'){
          const id=url.pathname.slice('/tracks/'.length);if(!ID.test(id))fail(400,'Audio inválido.');
          const state=await firebaseRead(env,scopeRoot(scope)+'/audio_director',token,fetcher)||{};
          if([state.music?.trackId,state.ambience?.trackId].includes(id))fail(409,'Detén la pista antes de eliminarla.');
          await env.AUDIO_BUCKET.delete(objectKey(scope,id));response=json({deleted:true});
        }else fail(404,'Ruta no encontrada.');
      }
    }
  }catch(error){response=json({error:error instanceof HttpError?error.message:'No se pudo completar la operación de audio.'},error.status||500);}
  for(const [name,value]of cors)response.headers.set(name,value);
  return response;
};}
export default {fetch:createHandler()};
