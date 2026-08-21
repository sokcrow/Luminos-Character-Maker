(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc) return;

  const state = {
    actorId: null,
    dirty: false,
    unsubscribe: null,
    syncQueued: false,
  };

  const $ = (id) => doc.getElementById(id);
  const statsApi = () => global.LuminousNpcStats;
  const manager = () => global.LuminousCharacterManager;

  function selectedActorId() {
    return doc.querySelector("#character-manager-roster .cm-roster-entry.is-selected")?.dataset?.actorId || null;
  }

  function proficiencyOptions(selected) {
    const api = statsApi();
    if (!api) return "";
    return Object.entries(api.PROFICIENCY_STATES).map(([id, definition]) =>
      `<option value="${id}"${id === selected ? " selected" : ""}>${definition.label}</option>`,
    ).join("");
  }

  function formatModifier(value) {
    const numeric = Number(value) || 0;
    return numeric >= 0 ? `+${numeric}` : String(numeric);
  }

  function mount() {
    const studio = $("character-manager-studio");
    const nav = studio?.querySelector(".cm-module-nav");
    const stack = studio?.querySelector(".cm-module-stack");
    if (!studio || !nav || !stack || !statsApi() || !manager()) return false;
    if ($("character-manager-npc-stats-tab")) return true;

    const tab = doc.createElement("button");
    tab.id = "character-manager-npc-stats-tab";
    tab.type = "button";
    tab.className = "cm-module-tab cm-npc-stats-tab";
    tab.dataset.section = "npc-stats";
    tab.hidden = true;
    tab.setAttribute("aria-label", "Stats NPC");
    tab.title = "Stats NPC";
    tab.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/><path d="M2 19h22"/></svg><span>STATS</span>';

    const advancedTab = nav.querySelector('[data-section="advanced"]');
    if (advancedTab) nav.insertBefore(tab, advancedTab);
    else nav.appendChild(tab);
    nav.classList.add("cm-module-nav--npc-stats");

    const module = doc.createElement("section");
    module.id = "character-manager-npc-stats-module";
    module.className = "cm-module cm-npc-stats-module";
    module.dataset.module = "npc-stats";
    module.innerHTML = `
      <header><span>STATS NPC</span><small>NPC / D&amp;D</small></header>
      <div class="cm-npc-stats-note">Disponible únicamente para personajes sin jugador asignado. Clase y Trasfondo no forman parte del perfil NPC.</div>
      <div class="cm-npc-stats-core">
        <label class="cm-field"><span>PROFICIENCY BONUS</span><input id="character-manager-npc-prof" type="number" min="0" max="20" step="1" value="1"></label>
        <label class="cm-field"><span>SP / COIN ENGINE</span><input id="character-manager-npc-sp" type="number" min="-100" max="100" step="1" value="0"></label>
        <div class="cm-npc-heads-preview"><span>HEADS</span><strong id="character-manager-npc-heads">50%</strong><small>5 COINS · +4 / HEAD</small></div>
      </div>
      <div id="character-manager-npc-abilities" class="cm-npc-ability-grid"></div>
      <div class="cm-npc-stats-actions">
        <span id="character-manager-npc-stats-feedback" class="cm-npc-stats-feedback" aria-live="polite"></span>
        <button id="character-manager-npc-stats-save" type="button" class="cm-npc-stats-save">GUARDAR STATS</button>
      </div>`;

    const advancedModule = stack.querySelector('[data-module="advanced"]');
    if (advancedModule) stack.insertBefore(module, advancedModule);
    else stack.appendChild(module);

    tab.addEventListener("click", () => activateStatsModule());
    $("character-manager-npc-stats-save")?.addEventListener("click", save);
    $("character-manager-npc-prof")?.addEventListener("input", onProfileInput);
    $("character-manager-npc-sp")?.addEventListener("input", onProfileInput);
    $("character-manager-player")?.addEventListener("change", () => scheduleSync(true));
    $("character-manager-type")?.addEventListener("change", () => scheduleSync(false));

    const roster = $("character-manager-roster");
    if (roster) {
      const observer = new MutationObserver(() => scheduleSync(false));
      observer.observe(roster, { childList: true });
    }
    doc.addEventListener("click", (event) => {
      if (event.target?.closest?.("#character-manager-roster .cm-roster-entry")) {
        global.setTimeout(() => scheduleSync(true), 0);
      }
    });

    state.unsubscribe = manager().subscribeAll?.(() => scheduleSync(false));
    scheduleSync(true);
    return true;
  }

  function activateStatsModule() {
    if (!state.actorId) return;
    doc.querySelectorAll("#character-manager-studio .cm-module-tab").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.section === "npc-stats");
    });
    doc.querySelectorAll("#character-manager-studio .cm-module").forEach((section) => {
      section.classList.toggle("is-active", section.dataset.module === "npc-stats");
    });
  }

  function leaveStatsModuleIfNeeded() {
    const tab = $("character-manager-npc-stats-tab");
    if (!tab?.classList.contains("is-active")) return;
    const identity = doc.querySelector('#character-manager-studio .cm-module-tab[data-section="identity"]');
    identity?.click();
  }

  function scheduleSync(force) {
    if (force) state.dirty = false;
    if (state.syncQueued) return;
    state.syncQueued = true;
    global.requestAnimationFrame?.(() => {
      state.syncQueued = false;
      sync(force);
    }) || global.setTimeout(() => {
      state.syncQueued = false;
      sync(force);
    }, 0);
  }

  function sync(force = false) {
    if (!mount()) return;
    const actorId = selectedActorId();
    const record = actorId ? manager().getActor(actorId) : null;
    const selectedPlayer = $("character-manager-player")?.value || "";
    const eligible = Boolean(record && statsApi().canDmControl(record) && !selectedPlayer);
    const tab = $("character-manager-npc-stats-tab");
    if (tab) tab.hidden = !eligible;

    if (!eligible) {
      state.actorId = actorId;
      leaveStatsModuleIfNeeded();
      return;
    }

    const changedActor = state.actorId !== actorId;
    state.actorId = actorId;
    if (!force && !changedActor && state.dirty) return;
    renderProfile(record);
  }

  function renderProfile(record) {
    const api = statsApi();
    if (!record || !api) return;
    const profile = api.normalizeProfile(record.actor || {});
    const host = $("character-manager-npc-abilities");
    if (!host) return;

    $("character-manager-npc-prof").value = profile.proficiencyBonus;
    $("character-manager-npc-sp").value = profile.sp;
    $("character-manager-npc-heads").textContent = `${api.headsChanceFromSp(profile.sp)}%`;
    host.replaceChildren();

    api.ABILITIES.forEach((ability) => {
      const card = doc.createElement("section");
      card.className = "cm-npc-ability-card";
      card.dataset.abilityId = ability.id;
      const score = profile.stats[ability.key];
      const modifier = api.abilityModifier(score);
      const saveState = profile.abilityProficiency[ability.id];
      card.innerHTML = `
        <header><strong>${ability.code}</strong><span>${ability.name}</span></header>
        <div class="cm-npc-ability-score">
          <label><span>SCORE</span><input class="cm-npc-score" data-ability-key="${ability.key}" type="number" min="1" max="30" step="1" value="${score}"></label>
          <div><span>MOD</span><strong data-ability-mod>${formatModifier(modifier)}</strong></div>
        </div>
        <label class="cm-npc-save-prof"><span>SAVE PROFICIENCY</span><select class="cm-npc-ability-prof" data-ability-prof="${ability.id}">${proficiencyOptions(saveState)}</select></label>
        <div class="cm-npc-skill-stack"></div>`;

      const skillStack = card.querySelector(".cm-npc-skill-stack");
      if (!ability.skills.length) {
        skillStack.innerHTML = '<div class="cm-npc-no-skills">NO ASSOCIATED SKILLS</div>';
      } else {
        ability.skills.forEach((skill) => {
          const skillState = profile.skillProficiency[skill.id];
          const row = doc.createElement("label");
          row.className = "cm-npc-skill-row";
          row.dataset.skillId = skill.id;
          row.innerHTML = `<span><strong>${skill.name}</strong><small>${skill.spanish}</small></span><b data-skill-value>${formatModifier(api.skillValue(profile, skill.id)?.base || 0)}</b><select class="cm-npc-skill-prof" data-skill-prof="${skill.id}" aria-label="Proficiency ${skill.name}">${proficiencyOptions(skillState)}</select>`;
          skillStack.appendChild(row);
        });
      }
      host.appendChild(card);
    });

    host.querySelectorAll("input, select").forEach((control) => control.addEventListener("input", onProfileInput));
    host.querySelectorAll("select").forEach((control) => control.addEventListener("change", onProfileInput));
    state.dirty = false;
    feedback("PERFIL NPC CARGADO", "ok");
  }

  function collectProfile() {
    const api = statsApi();
    const existing = state.actorId ? api.profileForActor(state.actorId)?.profile : api.normalizeProfile({});
    const profile = api.normalizeProfile(existing || {});
    profile.proficiencyBonus = Math.max(0, Math.min(20, Number.parseInt($("character-manager-npc-prof")?.value, 10) || 0));
    profile.sp = Math.max(-100, Math.min(100, Number.parseInt($("character-manager-npc-sp")?.value, 10) || 0));

    doc.querySelectorAll("#character-manager-npc-abilities .cm-npc-score").forEach((input) => {
      profile.stats[input.dataset.abilityKey] = Math.max(1, Math.min(30, Number.parseInt(input.value, 10) || 10));
    });
    doc.querySelectorAll("#character-manager-npc-abilities .cm-npc-ability-prof").forEach((select) => {
      profile.abilityProficiency[select.dataset.abilityProf] = api.normalizeProficiencyState(select.value);
    });
    doc.querySelectorAll("#character-manager-npc-abilities .cm-npc-skill-prof").forEach((select) => {
      profile.skillProficiency[select.dataset.skillProf] = api.normalizeProficiencyState(select.value);
    });
    return profile;
  }

  function refreshComputedValues() {
    const api = statsApi();
    if (!api) return;
    const profile = collectProfile();
    $("character-manager-npc-heads").textContent = `${api.headsChanceFromSp(profile.sp)}%`;
    api.ABILITIES.forEach((ability) => {
      const card = doc.querySelector(`#character-manager-npc-abilities .cm-npc-ability-card[data-ability-id="${ability.id}"]`);
      const modNode = card?.querySelector("[data-ability-mod]");
      if (modNode) modNode.textContent = formatModifier(api.abilityModifier(profile.stats[ability.key]));
      ability.skills.forEach((skill) => {
        const skillNode = card?.querySelector(`.cm-npc-skill-row[data-skill-id="${skill.id}"] [data-skill-value]`);
        if (skillNode) skillNode.textContent = formatModifier(api.skillValue(profile, skill.id)?.base || 0);
      });
    });
  }

  function onProfileInput() {
    state.dirty = true;
    refreshComputedValues();
    feedback("CAMBIOS SIN GUARDAR", "busy");
  }

  function feedback(text, mode = "") {
    const node = $("character-manager-npc-stats-feedback");
    if (!node) return;
    node.textContent = text || "";
    node.dataset.mode = mode;
  }

  async function save() {
    if (!state.actorId) return;
    const record = manager().getActor(state.actorId);
    if (!statsApi().canDmControl(record) || $("character-manager-player")?.value) {
      feedback("ASIGNA EL ACTOR COMO NPC SIN JUGADOR PARA EDITAR STATS", "error");
      return;
    }
    const button = $("character-manager-npc-stats-save");
    if (button) button.disabled = true;
    feedback("GUARDANDO", "busy");
    try {
      await statsApi().saveActorProfile(state.actorId, collectProfile());
      state.dirty = false;
      feedback("STATS SINCRONIZADOS", "ok");
      scheduleSync(true);
    } catch (error) {
      console.error("NPC Stats save failed:", error);
      feedback(`ERROR / ${error.message || error}`, "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function start() {
    let attempts = 0;
    const timer = global.setInterval(() => {
      attempts += 1;
      if (mount() || attempts > 100) global.clearInterval(timer);
    }, 100);
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})(window);
