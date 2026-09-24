import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const JS_DIR = path.join(ROOT, "js");
const OUTPUT = path.join(JS_DIR, "class-runtime-manifest.js");

const SUPPORT = [
  {
    id: "support:fighter-maneuver-catalog",
    kind: "support",
    path: "js/fighter-maneuver-catalog.js",
    contexts: ["any"],
    dependsOn: [],
    globalName: "LuminousFighterManeuverCatalog",
    autoload: false,
  },
  {
    id: "support:player-archetype-runtime-core",
    kind: "support",
    path: "js/player-archetype-runtime-core.js",
    contexts: ["any"],
    dependsOn: [],
    globalName: "LuminousArchetypeRuntime",
    autoload: false,
  },
  {
    id: "support:spellcasting-runtime",
    kind: "support",
    path: "js/spellcasting-runtime.js",
    contexts: ["any"],
    dependsOn: [],
    globalName: "LuminousSpellcastingRuntime",
    autoload: false,
  },
  {
    id: "support:universal-speed-runtime",
    kind: "support",
    path: "js/universal-speed-runtime.js",
    contexts: ["any"],
    dependsOn: [],
    globalName: "LuminousUniversalSpeedRuntime",
    autoload: false,
  },
];

const LEGACY_PRIMARY = [
  {
    prefix: "college-of-whispers",
    id: "archetype:college-of-whispers",
    kind: "archetype",
    path: "js/college-of-whispers-runtime.js",
    globalName: "LuminousCollegeOfWhispersRuntime",
  },
];

const DEPENDENCY_OVERRIDES = new Map([
  ["class:sorcerer", ["support:spellcasting-runtime", "support:universal-speed-runtime"]],
  ["archetype:battle-master", ["support:player-archetype-runtime-core", "support:fighter-maneuver-catalog"]],
  ["archetype:mastermind", ["support:player-archetype-runtime-core", "class:rogue"]],
  ["archetype:college-of-whispers", ["support:player-archetype-runtime-core", "class:bard"]],
]);

function pascalCase(value) {
  return String(value)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function primaryEntry(prefix, kind, filename, globalName = null) {
  const id = `${kind}:${prefix}`;
  return {
    prefix,
    id,
    kind,
    path: `js/${filename}`,
    contexts: ["any"],
    dependsOn: [...(DEPENDENCY_OVERRIDES.get(id) || [])],
    globalName: globalName || `Luminous${pascalCase(prefix)}${kind === "class" ? "Class" : "Archetype"}Runtime`,
  };
}

function discoverEntries() {
  const files = new Set(fs.readdirSync(JS_DIR).filter((name) => name.endsWith(".js")));
  const primary = [];

  [...files].sort().forEach((filename) => {
    let match = filename.match(/^(.+)-class-runtime\.js$/);
    if (match) {
      primary.push(primaryEntry(match[1], "class", filename));
      return;
    }
    match = filename.match(/^(.+)-archetype-runtime\.js$/);
    if (match && match[1] !== "player") primary.push(primaryEntry(match[1], "archetype", filename));
  });

  LEGACY_PRIMARY.forEach((legacy) => {
    if (!files.has(path.basename(legacy.path))) return;
    if (!primary.some((entry) => entry.id === legacy.id)) {
      primary.push(primaryEntry(legacy.prefix, legacy.kind, path.basename(legacy.path), legacy.globalName));
    }
  });

  const adapters = [];
  primary.forEach((entry) => {
    for (const context of ["combat", "theatre"]) {
      const filename = `${entry.prefix}-${context}-runtime.js`;
      if (!files.has(filename)) continue;
      adapters.push({
        id: `adapter:${entry.prefix}:${context}`,
        kind: "adapter",
        path: `js/${filename}`,
        contexts: [context],
        dependsOn: [entry.id],
      });
    }
  });

  const order = { support: 0, archetype: 1, class: 2, adapter: 3 };
  return [
    ...SUPPORT,
    ...primary.map(({ prefix, ...entry }) => entry),
    ...adapters,
  ].sort((a, b) => (order[a.kind] - order[b.kind]) || a.id.localeCompare(b.id));
}

function render(entries) {
  return `// GENERATED FILE. Run: npm run generate:class-runtime-manifest\n(function (global) {\n  "use strict";\n\n  const entries = ${JSON.stringify(entries, null, 2)};\n\n  const manifest = Object.freeze({\n    version: 1,\n    generatedFrom: "scripts/generate-class-runtime-manifest.mjs",\n    entries: Object.freeze(entries.map((entry) => Object.freeze({\n      ...entry,\n      contexts: Object.freeze([...(entry.contexts || ["any"])]),\n      dependsOn: Object.freeze([...(entry.dependsOn || [])]),\n    }))),\n  });\n\n  global.LuminousClassRuntimeManifest = manifest;\n  if (typeof module !== "undefined" && module.exports) module.exports = manifest;\n})(typeof window !== "undefined" ? window : globalThis);\n`;
}

const expectedEntries = discoverEntries();
if (process.argv.includes("--check")) {
  if (!fs.existsSync(OUTPUT)) {
    console.error("class-runtime-manifest.js is missing. Run: npm run generate:class-runtime-manifest");
    process.exitCode = 1;
  } else {
    delete globalThis.LuminousClassRuntimeManifest;
    await import(`${pathToFileURL(OUTPUT).href}?check=${Date.now()}`);
    const currentEntries = globalThis.LuminousClassRuntimeManifest?.entries || [];
    if (JSON.stringify(currentEntries) !== JSON.stringify(expectedEntries)) {
      console.error("class-runtime-manifest.js is stale. Run: npm run generate:class-runtime-manifest");
      process.exitCode = 1;
    } else {
      console.log("class-runtime-manifest.js is current.");
    }
  }
} else {
  fs.writeFileSync(OUTPUT, render(expectedEntries), "utf8");
  console.log(`Generated ${path.relative(ROOT, OUTPUT)}.`);
}
