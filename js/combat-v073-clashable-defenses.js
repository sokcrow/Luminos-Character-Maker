(function (global, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.LuminousClashableDefenses073 = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  // The DM schema uses ClashableGuard/ClashableCounter while the live
  // battle viewer stores lowercase defenseType. Keep one canonical spelling.
  const normalize = value => String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  function defenseTypeOf(source = {}) {
    const data = source?.data && typeof source.data === "object" ? source.data : source;
    return normalize(data.defenseType || data.defenseSubtype || data.defense_subtype ||
      (normalize(data.type) !== "defense" ? data.type : ""));
  }
  function isDefensePlan(plan = {}) {
    const data = plan?.data || {};
    return normalize(plan.type) === "defense" ||
      normalize(data.kind) === "defense" ||
      data.isDefense === true || data.is_defense === true ||
      ["guard", "evade", "counter", "clashableguard", "clashablecounter"].includes(defenseTypeOf(data));
  }
  function isClashableDefensePlan(plan = {}) {
    if (!isDefensePlan(plan)) return false;
    const data = plan?.data || {};
    return ["clashableguard", "clashablecounter"].includes(defenseTypeOf(data)) &&
      data.isClashable !== false && data.is_clashable !== false &&
      data.isUnclashable !== true && data.is_unclashable !== true &&
      Math.max(0, Number(data.coinAmount ?? data.coin_count ?? data.coins?.length ?? 0)) > 0;
  }
  function canChallengeDefense(plan = {}) {
    const data = plan?.data || {};
    return data.isClashable !== false && data.is_clashable !== false &&
      data.isUnclashable !== true && data.is_unclashable !== true;
  }
  function resultForClash(winnerPlan, loserPlan, losingDefensePower = 0, winningDefensePower = 0) {
    const winnerType = isClashableDefensePlan(winnerPlan) ? defenseTypeOf(winnerPlan.data) : "";
    const loserType = isClashableDefensePlan(loserPlan) ? defenseTypeOf(loserPlan.data) : "";
    const power = value => Math.max(0, Number(value) || 0);
    return Object.freeze({
      guardWin: winnerType === "clashableguard",
      guardTremorPower: winnerType === "clashableguard" ? power(winningDefensePower) : 0,
      guardMitigation: loserType === "clashableguard" ? power(losingDefensePower) : 0,
      counterWin: winnerType === "clashablecounter",
      performHits: winnerType !== "clashableguard",
    });
  }
  return Object.freeze({
    normalize, defenseTypeOf, isDefensePlan, isClashableDefensePlan,
    canChallengeDefense, resultForClash
  });
});
