import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,cpSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCombatLive,loaderParts} from './build-combat-live.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export function packageCombatRelease(output='artifacts/combat-release'){
  buildCombatLive({root,check:true});
  const destination=path.resolve(root,output),relative=path.relative(root,destination);
  if(!relative.startsWith('artifacts'+path.sep)||relative.includes('..'))throw Error('Release output must be inside artifacts/');
  if(existsSync(destination))throw Error('Release output already exists; use a new empty directory.');
  const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root}).toString().split('\0').filter(Boolean);
  const roots=new Set(['Assets','assets','Fonts','css','js','status-effects','game-codex','game-engine']);
  const pages=new Set(['index.html','mirror.html','combate.html','Battle-viewer.html','hoja_de_DM.html','hoja_personaje.html','hoja_personaje.js','hoja_personaje.css','pantalla_dm.html','creacion_personaje.html','vinculacion.html','dm-combat-creator.html','dm-skill-creator.html','dm-trait-creator.html']);
  const parts=new Set(loaderParts(root));parts.add('combat/combat-v073-live.manifest.json');
  const shipped=files.filter(file=>pages.has(file)||parts.has(file)||(roots.has(file.split('/')[0])&&!/(^|\/)(lab|tests|node_modules)\//.test(file))).sort();
  const missing=shipped.filter(file=>!existsSync(path.join(root,file)));
  if(missing.length)throw Error(`Release requires a complete checkout (${missing.length} runtime files are absent). Build in CI or materialize Assets/ and Fonts/ first.`);
  const publicDir=path.join(destination,'public');mkdirSync(publicDir,{recursive:true});
  const manifest={schemaVersion:1,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),entry:'combate.html',runtime:JSON.parse(readFileSync(path.join(root,'combat/combat-v073-live.manifest.json'))).sourceSha256,files:{}};
  for(const file of shipped){
    const source=path.join(root,file),target=path.join(publicDir,file);
    if(!statSync(source).isFile())throw Error(`Not a regular release file: ${file}`);
    mkdirSync(path.dirname(target),{recursive:true});cpSync(source,target);
    manifest.files[file]=createHash('sha256').update(readFileSync(target)).digest('hex');
  }
  for(const file of ['combate.html','Battle-viewer.html','js/combat-entry.js','js/combat-firebase-config.js',...loaderParts(root)])if(!manifest.files[file])throw Error(`Missing release dependency: ${file}`);
  writeFileSync(path.join(publicDir,'.nojekyll'),'');
  writeFileSync(path.join(destination,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  cpSync(path.join(root,'database.rules.json'),path.join(destination,'database.rules.json'));
  writeFileSync(path.join(destination,'firebase.json'),JSON.stringify({database:{rules:'database.rules.json'},hosting:{public:'public',ignore:[],headers:[{source:'**',headers:[{key:'Cache-Control',value:'no-cache'}]}]}},null,2)+'\n');
  writeFileSync(path.join(destination,'LEEME.txt'),'Luminous — versión integrada de combate\n\nAcceso: combate.html. Usa la misma cuenta de la ficha.\nPublica public/ completo; no solo Battle-viewer.html.\nLa configuración incluida corresponde a luminous-system, igual que las fichas existentes.\nNo ejecutar desde file://; para revisión local: python3 -m http.server 4173 --bind 127.0.0.1 --directory public\nLuego abre http://127.0.0.1:4173/combate.html\n\nAntes de activar esta versión online, revisar y publicar las reglas database.rules.json del mismo paquete.\nFirebase: firebase deploy --only database,hosting --project luminous-system --config firebase.json\nGitHub Pages u otro hosting estático: publica public/; las reglas de Firebase se publican por separado.\nEsta orden no se ejecuta al construir ni descargar el paquete.\n\nLas pruebas automáticas usan Auth/RTDB emulados; no certifican el despliegue de producción.\n');
  return {files:shipped.length,publicDir,entry:'combate.html'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{if(process.argv.length>3)throw Error('Usage: node scripts/package-combat-release.mjs [artifacts/output]');console.log(JSON.stringify(packageCombatRelease(process.argv[2]),null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}
