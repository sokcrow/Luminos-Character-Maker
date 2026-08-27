(function (global) {
  "use strict";

  function combine(formula, skills, milestones) {
    return Object.freeze({ ...(formula || {}), ...(skills || {}), ...(milestones || {}) });
  }

  if (typeof module !== "undefined" && module.exports) {
    const formula = require("./trait-formula-view-patch.js");
    const skills = require("./skill-trait-breakdown-patch.js");
    const milestones = require("./milestone-revert-patch.js");
    module.exports = combine(formula, skills, milestones);
    return;
  }

  const doc = global.document;
  if (!doc) return;
  const scripts = [
    ["trait-formula-view-patch-script", "js/trait-formula-view-patch.js"],
    ["skill-trait-breakdown-patch-script", "js/skill-trait-breakdown-patch.js"],
    ["milestone-revert-patch-script", "js/milestone-revert-patch.js"],
  ];
  const refresh = () => {
    global.LuminousMilestoneTraitModifierPatch = combine(
      global.LuminousTraitFormulaViewPatch,
      global.LuminousSkillTraitBreakdownPatch,
      global.LuminousMilestoneRevertPatch,
    );
  };
  scripts.forEach(([id, src]) => {
    let script = doc.getElementById(id);
    if (!script) {
      script = doc.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      script.dataset.ui = "milestone-trait-modifier-patch";
      doc.head?.appendChild(script);
    }
    script.addEventListener?.("load", refresh, { once: true });
  });
  refresh();
})(typeof window !== "undefined" ? window : globalThis);
