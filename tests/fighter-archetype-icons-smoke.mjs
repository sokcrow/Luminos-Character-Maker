import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const icons={
  champion:"vwXlH5h",
  battle_master:"6ocetrb",
  samurai:"fMi1RTd",
  banneret:"OACiNRB",
};
const png=Buffer.from([137,80,78,71,13,10,26,10]);
const directory=path.join(base,"Assets/Icons/archetypes");
for(const id of Object.keys(icons)){
  const destination=path.join(directory,id+".png");
  assert.ok(fs.existsSync(destination),"Missing bundled Fighter icon: "+id);
  const data=fs.readFileSync(destination);
  assert.ok(data.subarray(0,8).equals(png),"Expected a valid PNG for "+id);
  assert.ok(data.length>2048,"Icon image is unexpectedly small: "+id);
  const width=data.readUInt32BE(16),height=data.readUInt32BE(20);
  assert.ok(width>=32 && height>=32 && width<=8192 && height<=8192,
    "Unexpected Fighter icon dimensions: "+id+" "+width+"x"+height);
}
// This is a shared archetype directory. Other classes may add their own
// artwork without invalidating the four required Fighter assets.
for (const id of Object.keys(icons)) {
  assert.ok(fs.readdirSync(directory).includes(id+".png"),
    "Required Fighter archetype icon must remain present: "+id);
}

const importer=fs.readFileSync(path.join(base,"scripts/import-fighter-archetype-icons.py"),"utf8");
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
  "  global.__fighterIconTest={archetypeIconPath,archetypeSealMarkup,bindArchetypeIconFallback};\n"+marker);
const fakeWindow={document:{readyState:"loading",addEventListener(){}}};
vm.runInNewContext(injected,{window:fakeWindow,console},{timeout:3000});
const api=fakeWindow.__fighterIconTest;
assert.ok(api,"Fighter icon helper should initialize");
for(const id of Object.keys(icons)){
  const expected="Assets/Icons/archetypes/"+id+".png";
  assert.equal(api.archetypeIconPath("fighter",id),expected);
  assert.equal(api.archetypeIconPath("wizard",id),"",
    "Only Fighter may use these class-specific Archetype portraits");
  const markup=api.archetypeSealMarkup({classId:"fighter"},{id},"star");
  assert.ok(markup.includes('src="'+expected+'"'),"Tree branch must use local icon "+id);
  assert.match(markup,/aria-hidden="true"/);
  assert.match(markup,/loading="lazy"/);
}
assert.equal(api.archetypeIconPath("fighter","not_a_real_archetype"),"");
assert.match(api.archetypeSealMarkup({classId:"wizard"},{id:"bladesinger"},"star"),
  /player-progression-sigil/,
  "Non-Fighter Archetypes should keep existing SVG sigils");
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
console.log("fighter-archetype-icons-smoke: 4 bundled PNGs, tree wiring, SVG fallback and other classes preserved");
