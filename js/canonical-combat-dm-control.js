(function (global) {
  "use strict";
  const ROOT = "campaña/combate/canonical_v073";
  const clean = (v) => String(v ?? "").trim();
  const clone = (v) => v == null ? v : JSON.parse(JSON.stringify(v));
  const state = { db:null, uid:null, dmUid:null, ready:false };

  async function init(options = {}) {
    const auth = options.auth || (global.firebase?.auth ? global.firebase.auth() : null);
    state.db = options.db || (global.firebase?.database ? global.firebase.database() : null);
    const user = auth?.currentUser;
    if (!user?.uid || !state.db?.ref) return false;
    state.uid = user.uid;
    state.dmUid = clean((await state.db.ref("campaña/config/dm_uid").once("value")).val() || "e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1");
    state.ready = state.uid === state.dmUid;
    return state.ready;
  }

  function requireDm() {
    if (!state.ready || !state.db?.ref) throw new Error("DM_AUTH_REQUIRED");
  }

  async function setSession(input = {}) {
    requireDm();
    const payload = {
      active:Boolean(input.active),
      encounterId:clean(input.encounterId) || null,
      phase:clean(input.phase) || "planning",
      round:Math.max(1, Math.trunc(Number(input.round) || 1)),
      background:input.background || null,
      updatedAt:global.firebase?.database?.ServerValue?.TIMESTAMP || Date.now(),
      updatedBy:state.uid,
    };
    await state.db.ref(`${ROOT}/session`).update(payload);
    return payload;
  }

  async function putCombatant(id, unit = {}) {
    requireDm();
    const key = clean(id || unit.id || unit.combatId);
    if (!key) throw new Error("COMBATANT_ID_REQUIRED");
    const payload = { ...clone(unit), id:key, updatedBy:state.uid };
    await state.db.ref(`${ROOT}/combatants/${key}`).set(payload);
    return payload;
  }

  async function removeCombatant(id) {
    requireDm();
    const key = clean(id);
    if (!key) return false;
    await state.db.ref(`${ROOT}/combatants/${key}`).remove();
    return true;
  }

  async function setView(uid, input = {}) {
    requireDm();
    const target = clean(uid);
    if (!target) throw new Error("PLAYER_UID_REQUIRED");
    const view = {
      playerCombatantId:clean(input.playerCombatantId) || null,
      visibleCombatantIds:Array.isArray(input.visibleCombatantIds) ? [...new Set(input.visibleCombatantIds.map(clean).filter(Boolean))] : null,
      camera:{
        mode:clean(input.camera?.mode || "player") || "player",
        focusId:clean(input.camera?.focusId) || null,
        x:Number.isFinite(Number(input.camera?.x)) ? Number(input.camera.x) : null,
        y:Number.isFinite(Number(input.camera?.y)) ? Number(input.camera.y) : null,
        scale:Number.isFinite(Number(input.camera?.scale)) ? Number(input.camera.scale) : null,
      },
      ui:{ showRootMenu:input.ui?.showRootMenu !== false, readOnly:Boolean(input.ui?.readOnly) },
      updatedBy:state.uid,
    };
    await state.db.ref(`${ROOT}/views/${target}`).set(view);
    return view;
  }

  global.LuminousCanonicalCombatDmControl = Object.freeze({ ROOT, init, setSession, putCombatant, removeCombatant, setView });
})(window);
