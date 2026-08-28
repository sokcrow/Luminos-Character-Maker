(function (global) {
  "use strict";

  if (global.LuminousCharacterPersistenceFirebase) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCharacterPersistenceFirebase;
    return;
  }

  const persistence = global.LuminousCharacterPersistence || (typeof require === "function" ? require("./character-persistence.js") : null);
  if (!persistence) return;

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  async function readRaw(ref) {
    if (!ref?.once) throw new Error("A Firebase-like ref with once('value') is required.");
    const snapshot = await ref.once("value");
    return snapshot?.val ? snapshot.val() : null;
  }

  async function readCharacter(ref, options = {}) {
    const raw = await readRaw(ref);
    if (raw == null) {
      return {
        ok: false,
        character: null,
        rawBackup: raw,
        diagnostics: { errors: [{ code: "EMPTY_CHARACTER_SAVE", message: "Character save is empty." }], warnings: [] },
      };
    }
    return persistence.load(raw, options);
  }

  async function saveCharacter(ref, character, options = {}) {
    if (!ref?.set) throw new Error("A Firebase-like ref with set() is required.");
    const prepared = persistence.prepareForSave(character, options);
    if (!prepared.ok) return { ...prepared, written: false };
    await ref.set(clone(prepared.character));
    return { ...prepared, written: true };
  }

  async function migrateCharacterRef(ref, options = {}) {
    const raw = await readRaw(ref);
    const result = persistence.load(raw, options);
    if (!result.ok) return { ...result, written: false, backupWritten: false };

    let backupWritten = false;
    if (options.backupRef) {
      if (!options.backupRef?.set) throw new Error("backupRef must expose set().");
      await options.backupRef.set(clone(raw));
      backupWritten = true;
    }

    const prepared = persistence.prepareForSave(result.character, options);
    if (!prepared.ok) return { ...prepared, written: false, backupWritten };
    await ref.set(clone(prepared.character));
    return { ...prepared, written: true, backupWritten };
  }

  async function modifyAndSave(ref, modifier, options = {}) {
    if (typeof modifier !== "function") throw new Error("modifyAndSave requires a modifier function.");
    const loaded = await readCharacter(ref, options);
    if (!loaded.ok) return { ...loaded, written: false };
    const working = clone(loaded.character);
    const modified = await modifier(working);
    return saveCharacter(ref, modified === undefined ? working : modified, options);
  }

  const api = Object.freeze({ readRaw, readCharacter, saveCharacter, migrateCharacterRef, modifyAndSave });
  global.LuminousCharacterPersistenceFirebase = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
