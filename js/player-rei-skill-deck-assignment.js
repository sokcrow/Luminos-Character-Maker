(function (global) {
  "use strict";

  if (global.LuminousReiSkillDeckAssignment) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousReiSkillDeckAssignment;
    return;
  }

  const VERSION = 1;
  const DECK = Object.freeze({
    tier1: "rei_twin_fang",
    tier2: "rei_crimson_moon_sweep",
    tier3: "rei_heaven_rending_execution",
    schemaVersion: 1,
  });
  const SLOTS = Object.freeze([
    DECK.tier1, DECK.tier1, DECK.tier1,
    DECK.tier2, DECK.tier2,
    DECK.tier3,
  ]);
  const IDS = Object.freeze([DECK.tier1, DECK.tier2, DECK.tier3]);
  const INDEX = Object.freeze(Object.fromEntries(IDS.map((id) => [id, true])));
  const inProgress = new Set();

  function normalizedName(value) {
    return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function isRei(character = {}) {
    const identity = character.characterIdentity || {};
    const names = [identity.name, character.characterName, character.character_name, character.nombre, character.name];
    return names.some((name) => normalizedName(name) === "rei");
  }

  function assignments() {
    const deck = { ...DECK };
    const slots = [...SLOTS];
    const ids = [...IDS];
    const index = { ...INDEX };
    return {
      skillDeck: deck,
      skillSlotIds: slots,
      skillIds: ids,
      equippedSkillIndex: index,
      "characterBuild/skillDeck": deck,
      "characterBuild/skillSlotIds": slots,
      "characterBuild/skillIds": ids,
      "characterBuild/equippedSkillIndex": index,
      "characterBuild/skillLoadoutSource": "rei_signature",
      "characterBuild/signatureSkillCharacterId": "rei",
      "characterBuild/reiSignatureDeckVersion": VERSION,
    };
  }

  async function assignForAuthenticatedRei(playerId, player = {}, options = {}) {
    const id = String(playerId ?? "").trim();
    if (!id || !isRei(player)) return { assigned: false, reason: "NOT_REI" };
    const firebase = options.firebase || global.firebase;
    const user = options.user || firebase?.auth?.()?.currentUser;
    // Only the linked character may write its own player record.
    if (!user?.uid || !player?.uid || user.uid !== player.uid) return { assigned: false, reason: "OWNER_MISMATCH" };
    const db = options.db || firebase?.database?.();
    if (!db?.ref) return { assigned: false, reason: "DATABASE_UNAVAILABLE" };
    if (inProgress.has(id)) return { assigned: false, reason: "IN_PROGRESS" };
    inProgress.add(id);
    try {
      const ref = db.ref("campaña/jugadores/" + id);
      const current = await ref.child("characterBuild/reiSignatureDeckVersion").once("value");
      if (Number(current?.val?.()) >= VERSION) return { assigned: false, reason: "ALREADY_ASSIGNED" };
      // Multi-location update writes only deck-related fields, never overwrites
      // level, equipment, attributes, other spells, or the rest of characterBuild.
      await ref.update(assignments());
      return { assigned: true, reason: "ASSIGNED" };
    } finally {
      inProgress.delete(id);
    }
  }

  function onPlayerData(event = {}) {
    const detail = event.detail || {};
    if (!detail.playerId || !isRei(detail.data || {})) return;
    assignForAuthenticatedRei(detail.playerId, detail.data).catch((error) => {
      global.console?.error?.("[Rei Skill Deck] Assignment failed:", error);
    });
  }

  const api = Object.freeze({
    version: VERSION, DECK, SLOTS, IDS, isRei, assignments,
    assignForAuthenticatedRei, onPlayerData,
  });
  global.LuminousReiSkillDeckAssignment = api;
  global.addEventListener?.("luminous:player-data", onPlayerData);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
