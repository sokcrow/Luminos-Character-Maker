import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const icons={
  path_of_the_devil_lineage:"4h6v4lS",
  path_of_the_zealot:"Lzyiywu",
};
const png=Buffer.from([137,80,78,71,13,10,26,10]);
const directory=path.join(base,"Assets/Icons/archetypes");
for(const id of Object.keys(icons)){
  const destination=path.join(directory,id+".png");
  assert.ok(fs.existsSync(destination),"Missing bundled Barbarian icon: "+id);
  const data=fs.readFileSync(destination);
  assert.ok(data.subarray(0,8).equals(png),"Expected a valid PNG for "+id);
  assert.ok(data.length>2048,"Icon image is unexpectedly small: "+id);
  const width=data.readUInt32BE(16),height=data.readUInt32BE(20);
  assert.ok(width>=32 && height>=32 && width<=8192 && height<=8192,
    "Unexpected Barbarian icon dimensions: "+id+" "+width+"x"+height);
}
// This is a shared archetype directory. Other classes may add their own
// artwork without invalidating the four required Barbarian assets.
for (const id of Object.keys(icons)) {
  assert.ok(fs.readdirSync(directory).includes(id+".png"),
    "Required Barbarian archetype icon must remain present: "+id);
}

const importer=fs.readFileSync(path.join(base,"scripts/import-barbarian-archetype-icons.py"),"utf8");
for(const [id,imgurId] of Object.entries(icons)){
  assert.ok(importer.includes('"'+id+'": "'+imgurId+'"'),
    "Imported artwork must match the user-supplied Imgur image: "+id);
}

const source=fs.readFileSync(path.join(base,"js/player-progression-tree.js"),"utf8");
const css=fs.readFileSync(path.join(base,"css/player-progression-mystic.css"),"utf8");
assert.match(css,/\.player-progression-branch-preview__seal \.player-progression-archetype-icon/);
assert.match(css,/object-fit:contain/);
assert.match(source,/bindArchetypeIconFallback\(preview, fallbackKind\)/);
const marker="  // Hand-drawn-style vector sigils are decorative only;";
assert.ok(source.includes(marker),"Could not instrument the canonical tree runtime");
const injected=source.replace(marker,
  "  global.__barbarianIconTest={archetypeIconPath,archetypeSealMarkup,bindArchetypeIconFallback};\n"+marker);
const fakeWindow={document:{readyState:"loading",addEventListener(){}}};
vm.runInNewContext(injected,{window:fakeWindow,console},{timeout:3000});
const api=fakeWindow.__barbarianIconTest;
assert.ok(api,"Barbarian icon helper should initialize");
for(const id of Object.keys(icons)){
  const expected="Assets/Icons/archetypes/"+id+".png";
  assert.equal(api.archetypeIconPath("barbarian",id),expected);
  assert.equal(api.archetypeIconPath("fighter",id),"",
    "Fighter must not accidentally use Barbarian-specific Archetype portraits");
  assert.equal(api.archetypeIconPath("wizard",id),"",
    "Unrelated Class must not use Barbarian Archetype portraits");
  const markup=api.archetypeSealMarkup({classId:"barbarian"},{id},"star");
  assert.ok(markup.includes('src="'+expected+'"'),"Tree branch must use local icon "+id);
  assert.match(markup,/aria-hidden="true"/);
  assert.match(markup,/loading="lazy"/);
}
assert.equal(api.archetypeIconPath("barbarian","not_a_real_archetype"),"");
assert.equal(api.archetypeIconPath("fighter","champion"),
  "Assets/Icons/archetypes/champion.png",
  "Existing Fighter icons must remain available");
assert.match(api.archetypeSealMarkup({classId:"wizard"},{id:"bladesinger"},"star"),
  /player-progression-sigil/,
  "Classes without artwork must keep their SVG sigils");
let onError;
const image={addEventListener(name,handler,opts){
  assert.equal(name,"error"); assert.equal(opts.once,true);onError=handler;
},outerHTML:""};
api.bindArchetypeIconFallback({querySelector(sel){
  assert.equal(sel,".player-progression-archetype-icon");return image;
}},"star");
assert.equal(typeof onError,"function","Broken art must have an SVG fallback");
onError();
assert.match(image.outerHTML,/player-progression-sigil/,
  "Missing images should be replaced by their original sigil");
console.log("barbarian-archetype-icons-smoke: 4 bundled PNGs, tree wiring, SVG fallback and other classes preserved");
