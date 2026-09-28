// GENERATED FILE. Run: npm run generate:class-runtime-manifest
(function (global) {
  "use strict";

  const entries = [
  {
    "id": "support:caster-spellcasting-traits-runtime",
    "kind": "support",
    "path": "js/caster-spellcasting-traits-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [
      "support:spellcasting-runtime"
    ],
    "globalName": "LuminousCasterSpellcastingTraitsRuntime",
    "autoload": false
  },
  {
    "id": "support:creature-type-catalog",
    "kind": "support",
    "path": "js/creature-type-catalog.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [],
    "globalName": "LuminousCreatureTypeCatalog",
    "autoload": false
  },
  {
    "id": "support:fighter-maneuver-catalog",
    "kind": "support",
    "path": "js/fighter-maneuver-catalog.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [],
    "globalName": "LuminousFighterManeuverCatalog",
    "autoload": false
  },
  {
    "id": "support:fighting-style-runtime",
    "kind": "support",
    "path": "js/fighting-style-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [],
    "globalName": "LuminousFightingStyleRuntime"
  },
  {
    "id": "support:player-archetype-runtime-core",
    "kind": "support",
    "path": "js/player-archetype-runtime-core.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [],
    "globalName": "LuminousArchetypeRuntime",
    "autoload": false
  },
  {
    "id": "support:spellcasting-runtime",
    "kind": "support",
    "path": "js/spellcasting-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [],
    "globalName": "LuminousSpellcastingRuntime",
    "autoload": false
  },
  {
    "id": "support:universal-action-economy",
    "kind": "support",
    "path": "js/universal-action-economy.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [],
    "globalName": "LuminousActionEconomy",
    "autoload": false
  },
  {
    "id": "support:universal-speed-runtime",
    "kind": "support",
    "path": "js/universal-speed-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [],
    "globalName": "LuminousUniversalSpeedRuntime",
    "autoload": false
  },
  {
    "id": "support:weapon-property-runtime",
    "kind": "support",
    "path": "js/weapon-property-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [],
    "globalName": "LuminousWeaponPropertyRuntime"
  },
  {
    "id": "archetype:battle-master",
    "kind": "archetype",
    "path": "js/battle-master-archetype-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [
      "support:player-archetype-runtime-core",
      "support:fighter-maneuver-catalog"
    ],
    "globalName": "LuminousBattleMasterArchetypeRuntime"
  },
  {
    "id": "archetype:bilgewater-buccaneer",
    "kind": "archetype",
    "path": "js/bilgewater-buccaneer-archetype-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [
      "support:player-archetype-runtime-core",
      "class:ranger"
    ],
    "globalName": "LuminousBilgewaterBuccaneerArchetypeRuntime"
  },
  {
    "id": "archetype:bilgewater-demolisher",
    "kind": "archetype",
    "path": "js/bilgewater-demolisher-archetype-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [
      "support:player-archetype-runtime-core",
      "class:ranger"
    ],
    "globalName": "LuminousBilgewaterDemolisherArchetypeRuntime"
  },
  {
    "id": "archetype:champion",
    "kind": "archetype",
    "path": "js/champion-archetype-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [
      "support:player-archetype-runtime-core",
      "support:fighting-style-runtime"
    ],
    "globalName": "LuminousChampionArchetypeRuntime"
  },
  {
    "id": "archetype:college-of-whispers",
    "kind": "archetype",
    "path": "js/college-of-whispers-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [
      "support:player-archetype-runtime-core",
      "class:bard"
    ],
    "globalName": "LuminousCollegeOfWhispersRuntime"
  },
  {
    "id": "archetype:mastermind",
    "kind": "archetype",
    "path": "js/mastermind-archetype-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [
      "support:player-archetype-runtime-core",
      "class:rogue"
    ],
    "globalName": "LuminousMastermindArchetypeRuntime"
  },
  {
    "id": "archetype:path-of-the-zealot",
    "kind": "archetype",
    "path": "js/path-of-the-zealot-archetype-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [],
    "globalName": "LuminousPathOfTheZealotArchetypeRuntime"
  },
  {
    "id": "class:barbarian",
    "kind": "class",
    "path": "js/barbarian-class-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [],
    "globalName": "LuminousBarbarianClassRuntime"
  },
  {
    "id": "class:bard",
    "kind": "class",
    "path": "js/bard-class-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [],
    "globalName": "LuminousBardClassRuntime"
  },
  {
    "id": "class:fighter",
    "kind": "class",
    "path": "js/fighter-class-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [
      "support:fighting-style-runtime",
      "support:universal-action-economy"
    ],
    "globalName": "LuminousFighterClassRuntime"
  },
  {
    "id": "class:monk",
    "kind": "class",
    "path": "js/monk-class-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [
      "support:weapon-property-runtime",
      "support:universal-speed-runtime"
    ],
    "globalName": "LuminousMonkClassRuntime"
  },
  {
    "id": "class:ranger",
    "kind": "class",
    "path": "js/ranger-class-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [
      "support:creature-type-catalog",
      "support:fighting-style-runtime",
      "support:caster-spellcasting-traits-runtime"
    ],
    "globalName": "LuminousRangerClassRuntime"
  },
  {
    "id": "class:rogue",
    "kind": "class",
    "path": "js/rogue-class-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [],
    "globalName": "LuminousRogueClassRuntime"
  },
  {
    "id": "class:sorcerer",
    "kind": "class",
    "path": "js/sorcerer-class-runtime.js",
    "contexts": [
      "any"
    ],
    "dependsOn": [
      "support:spellcasting-runtime",
      "support:universal-speed-runtime"
    ],
    "globalName": "LuminousSorcererClassRuntime"
  },
  {
    "id": "adapter:bilgewater-buccaneer:combat",
    "kind": "adapter",
    "path": "js/bilgewater-buccaneer-combat-runtime.js",
    "contexts": [
      "combat"
    ],
    "dependsOn": [
      "archetype:bilgewater-buccaneer"
    ]
  },
  {
    "id": "adapter:bilgewater-demolisher:combat",
    "kind": "adapter",
    "path": "js/bilgewater-demolisher-combat-runtime.js",
    "contexts": [
      "combat"
    ],
    "dependsOn": [
      "archetype:bilgewater-demolisher"
    ]
  },
  {
    "id": "adapter:mastermind:theatre",
    "kind": "adapter",
    "path": "js/mastermind-theatre-runtime.js",
    "contexts": [
      "theatre"
    ],
    "dependsOn": [
      "archetype:mastermind"
    ]
  },
  {
    "id": "adapter:rogue:combat",
    "kind": "adapter",
    "path": "js/rogue-combat-runtime.js",
    "contexts": [
      "combat"
    ],
    "dependsOn": [
      "class:rogue"
    ]
  },
  {
    "id": "adapter:rogue:theatre",
    "kind": "adapter",
    "path": "js/rogue-theatre-runtime.js",
    "contexts": [
      "theatre"
    ],
    "dependsOn": [
      "class:rogue"
    ]
  }
];

  const manifest = Object.freeze({
    version: 1,
    generatedFrom: "scripts/generate-class-runtime-manifest.mjs",
    entries: Object.freeze(entries.map((entry) => Object.freeze({
      ...entry,
      contexts: Object.freeze([...(entry.contexts || ["any"])]),
      dependsOn: Object.freeze([...(entry.dependsOn || [])]),
    }))),
  });

  global.LuminousClassRuntimeManifest = manifest;
  if (typeof module !== "undefined" && module.exports) module.exports = manifest;
})(typeof window !== "undefined" ? window : globalThis);
