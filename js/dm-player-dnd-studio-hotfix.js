(function (global) {
  "use strict";

  const doc = global.document;
  global.LuminousDmPlayerDndStudioOwnsRacialStats = true;

  function ensureRacialIntegrationAssets() {
    if (!doc?.head) return;
    const assets = [
      ["canonical-race-integration-script", "js/canonical-race-integration.js", "racial-stats"],
      ["existing-racial-stat-integration-script", "js/existing-racial-stat-integration.js", "racial-stats"],
      ["trait-engine-script", "js/trait-engine.js", "trait-engine"],
      ["racial-trait-catalog-script", "js/racial-trait-catalog.js", "racial-traits"],
      ["canonical-racial-traits-script", "js/canonical-racial-traits.js", "racial-traits"],
      ["half-demon-racial-traits-script", "js/half-demon-racial-traits.js", "racial-traits"],
    ];

    assets.forEach(([id, src, engine]) => {
      if (doc.getElementById(id)) return;
      const script = doc.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      script.dataset.engine = engine;
      doc.head.appendChild(script);
    });
  }

  function ensureClassMilestoneAssets() {
    if (!doc) return;

    if (!doc.getElementById("dm-player-class-milestones-style")) {
      const link = doc.createElement("link");
      link.id = "dm-player-class-milestones-style";
      link.rel = "stylesheet";
      link.href = "css/dm-player-class-milestones.css";
      doc.head?.appendChild(link);
    }

    if (!doc.getElementById("class-milestone-trait-integration-script")) {
      const integration = doc.createElement("script");
      integration.id = "class-milestone-trait-integration-script";
      integration.src = "js/class-milestone-trait-integration.js";
      integration.async = false;
      doc.head?.appendChild(integration);
    }

    const loadUi = () => {
      if (global.LuminousDmPlayerClassMilestones || doc.getElementById("dm-player-class-milestones-script")) return;
      const script = doc.createElement("script");
      script.id = "dm-player-class-milestones-script";
      script.src = "js/dm-player-class-milestones.js";
      script.async = false;
      doc.head?.appendChild(script);
    };

    if (global.LuminousClassMilestones) {
      loadUi();
      return;
    }

    let engineScript = doc.getElementById("class-milestone-engine-script");
    if (!engineScript) {
      engineScript = doc.createElement("script");
      engineScript.id = "class-milestone-engine-script";
      engineScript.src = "js/class-milestone-engine.js";
      engineScript.async = false;
      engineScript.addEventListener("load", loadUi, { once: true });
      doc.head?.appendChild(engineScript);
    } else {
      engineScript.addEventListener("load", loadUi, { once: true });
    }
  }

  function installPlayerProxyMilestoneSync() {
    const EventCtor = global.Event;
    if (!doc || typeof doc.addEventListener !== "function" || typeof EventCtor !== "function") return;
    if (global.LuminousDmPlayerProxyMilestoneSync) return;

    doc.addEventListener("click", (event) => {
      const button = event.target?.closest?.("#grid-jugadores .btn-open-modal");
      if (!button) return;

      const playerId = String(button.getAttribute?.("data-id") || "").trim();
      const select = doc.getElementById("dm-player-dnd-select");
      if (!playerId || !select || select.value === playerId) return;

      select.value = playerId;
      select.dispatchEvent(new EventCtor("change", { bubbles: true }));
    }, true);

    global.LuminousDmPlayerProxyMilestoneSync = true;
  }

  const DM_ABILITIES = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const signed = (value) => numberOr(value, 0) >= 0 ? `+${numberOr(value, 0)}` : String(numberOr(value, 0));

  function syncDmRacialStatBadges() {
    const studio = global.LuminousDmPlayerDndStudio;
    if (!doc || !studio?.effectiveAbilityScore || !studio?.resolveRacialStatBonuses) return false;
    const bonuses = studio.resolveRacialStatBonuses() || {};
    let found = false;

    DM_ABILITIES.forEach((abilityId) => {
      const input = doc.getElementById(`dm-player-stat-${abilityId}`);
      if (!input) return;
      found = true;
      const host = input.closest?.(".dm-player-dnd-ability") || input.parentElement;
      if (!host) return;
      let badge = host.querySelector?.(`[data-racial-effective-stat="${abilityId}"]`);
      if (!badge) {
        badge = doc.createElement("small");
        badge.dataset.racialEffectiveStat = abilityId;
        badge.style.cssText = "display:block;grid-column:1/-1;margin-top:2px;font-size:10px;letter-spacing:.06em;color:#d6b56d;opacity:.95;";
        host.appendChild(badge);
      }
      const base = Number.parseInt(input.value, 10);
      const effective = Number(studio.effectiveAbilityScore(abilityId));
      const bonus = numberOr(bonuses?.[abilityId], 0);
      const baseText = Number.isFinite(base) ? base : 10;
      const effectiveText = Number.isFinite(effective) ? effective : baseText + bonus;
      badge.textContent = `BASE ${baseText} → EFFECTIVE ${effectiveText} · RACE ${signed(bonus)}`;
      input.dataset.effectiveScore = String(effectiveText);
      input.dataset.racialBonus = String(bonus);
      input.title = `Base ${baseText} · Racial ${signed(bonus)} · Effective ${effectiveText}`;
    });
    return found;
  }

  function installDmRacialStatVisibility() {
    if (!doc || global.LuminousDmRacialStatVisibility) return;
    const refresh = () => global.setTimeout?.(syncDmRacialStatBadges, 0);
    doc.addEventListener("input", (event) => {
      if (event.target?.id?.startsWith?.("dm-player-stat-")) refresh();
    }, true);
    doc.addEventListener("change", (event) => {
      const id = String(event.target?.id || "");
      if (id.startsWith("dm-player-stat-") || ["dm-player-build-race", "dm-player-build-subrace", "canonical-racial-stat-choice-1", "canonical-racial-stat-choice-2", "existing-racial-stat-choice-1", "existing-racial-stat-choice-2", "dm-player-dnd-select"].includes(id)) refresh();
    }, true);
    global.setInterval?.(syncDmRacialStatBadges, 500);
    global.LuminousDmRacialStatVisibility = Object.freeze({ sync: syncDmRacialStatBadges });
  }

  ensureRacialIntegrationAssets();
  ensureClassMilestoneAssets();
  installPlayerProxyMilestoneSync();
  installDmRacialStatVisibility();

  if (!global?.Node || global.LuminousDmPlayerDndObserverHotfix) return;

  const descriptor = Object.getOwnPropertyDescriptor(global.Node.prototype, "textContent");
  if (!descriptor?.get || !descriptor?.set) return;

  Object.defineProperty(global.Node.prototype, "textContent", {
    configurable: descriptor.configurable,
    enumerable: descriptor.enumerable,
    get: descriptor.get,
    set(value) {
      const nextValue = value == null ? "" : String(value);
      const isDndLegacyButton =
        this?.nodeType === 1 &&
        this?.matches?.("#grid-jugadores .btn-open-modal") &&
        this?.dataset?.dndStudioProxy === "true";

      if (isDndLegacyButton && descriptor.get.call(this) === nextValue) {
        return;
      }

      descriptor.set.call(this, value);
    },
  });

  global.LuminousDmPlayerDndObserverHotfix = true;
})(window);