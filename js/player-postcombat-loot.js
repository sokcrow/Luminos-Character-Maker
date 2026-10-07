(function (global) {
  "use strict";

  if (global.LuminousPlayerPostCombatLoot) return;

  const VERSION = 1;
  const BUTTON_ID = "btn-postcombat-loot";
  const MODAL_ID = "postcombat-loot-modal";
  const STYLE_ID = "postcombat-loot-style";
  const state = {
    db: null,
    playerId: null,
    encounters: {},
    activeEncounterId: null,
    open: false,
    busy: false,
    message: "",
    error: false,
    listeners: [],
  };

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clean = (value) => String(value ?? "").trim();
  const normalizeId = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const esc = (value) => clean(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const titleCase = (value) => clean(value).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  function live() { return global.LuminousLootLivePostCombatRuntime || null; }
  function postCombat() { return global.LuminousLootPostCombatRuntime || null; }
  function checks() { return global.LuminousLootCheckRuntime || null; }

  function resolvePlayerId() {
    return clean(state.playerId || global.localStorage?.getItem?.("playerId") || global.datosJugador?.playerId || global.datosJugador?.id);
  }

  function ensureStyle() {
    if (global.document?.getElementById(STYLE_ID)) return;
    const style = global.document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
#${BUTTON_ID}{display:none}
#${BUTTON_ID}.available{display:flex}
#${BUTTON_ID} .postcombat-loot-badge{min-width:18px;height:18px;border-radius:9px;padding:0 5px;display:grid;place-items:center;background:#8b1e1e;color:#fff;font:700 11px/1 system-ui;margin-left:auto}
#${MODAL_ID}{position:fixed;inset:0;z-index:2147482500;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.76);backdrop-filter:blur(3px)}
#${MODAL_ID}.open{display:flex}
#${MODAL_ID} .loot-shell{width:min(880px,94vw);max-height:88vh;overflow:hidden;background:#0b0b0b;border:1px solid #8f722f;box-shadow:0 18px 80px #000;display:flex;flex-direction:column}
#${MODAL_ID} .loot-head{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid #493a1d;background:linear-gradient(90deg,#15110a,#0b0b0b)}
#${MODAL_ID} .loot-head h2{margin:0;color:#d7b257;font:700 22px/1 "BebasKai",system-ui;letter-spacing:.08em}
#${MODAL_ID} .loot-head p{margin:3px 0 0;color:#8f8f8f;font:12px system-ui}
#${MODAL_ID} .loot-close{margin-left:auto;background:#1a1a1a;border:1px solid #555;color:#ddd;width:36px;height:36px;cursor:pointer;font-size:20px}
#${MODAL_ID} .loot-body{padding:14px;overflow:auto;display:grid;gap:12px}
#${MODAL_ID} .loot-message{display:none;padding:9px 11px;border-left:3px solid #8f722f;background:#12100b;color:#ddd;font:13px system-ui}
#${MODAL_ID} .loot-message.show{display:block}
#${MODAL_ID} .loot-message.error{border-left-color:#a43b35;color:#ffb3ad;background:#170b0a}
#${MODAL_ID} .loot-corpse{border:1px solid #343434;background:#111;padding:12px}
#${MODAL_ID} .loot-corpse-title{display:flex;align-items:center;gap:10px;margin-bottom:10px}
#${MODAL_ID} .loot-corpse-title strong{color:#eee;font:700 18px/1 "BebasKai",system-ui;letter-spacing:.05em}
#${MODAL_ID} .loot-corpse-title span{color:#777;font:12px system-ui}
#${MODAL_ID} .loot-actions{display:flex;flex-wrap:wrap;gap:8px}
#${MODAL_ID} .loot-action{background:#151515;color:#ddd;border:1px solid #555;padding:9px 12px;cursor:pointer;font:700 12px system-ui;text-transform:uppercase;letter-spacing:.04em}
#${MODAL_ID} .loot-action:hover:not(:disabled){border-color:#d7b257;color:#fff;background:#211b0d}
#${MODAL_ID} .loot-action:disabled{opacity:.45;cursor:default}
#${MODAL_ID} .loot-action.pending{border-color:#667f91;color:#bfe8ff}
#${MODAL_ID} .loot-resource{background:#090909;color:#ddd;border:1px solid #444;padding:8px;max-width:210px}
#${MODAL_ID} .loot-roll{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:64px;padding-top:10px}
#${MODAL_ID} .loot-roll-total{min-width:52px;color:#d7b257;font:700 24px "BebasKai",system-ui;text-align:center}
#${MODAL_ID} .loot-empty{padding:28px;text-align:center;color:#777;font:14px system-ui;border:1px dashed #333}
@media(max-width:640px){#${MODAL_ID}{align-items:flex-end}#${MODAL_ID} .loot-shell{width:100vw;max-height:82vh;border-left:0;border-right:0;border-bottom:0}#${MODAL_ID} .loot-actions{display:grid;grid-template-columns:1fr 1fr}#${MODAL_ID} .loot-resource{max-width:none;width:100%}}
`;
    global.document.head.appendChild(style);
  }

  function ensureButton() {
    let button = global.document?.getElementById(BUTTON_ID);
    if (button) return button;
    const inventory = global.document?.getElementById("btn-global-inventory");
    const menu = inventory?.parentElement || global.document?.querySelector(".hud-menu-dropdown");
    if (!menu) return null;
    button = global.document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "hud-menu-item";
    button.title = "Revisar botín post-combate";
    button.innerHTML = '<span aria-hidden="true" style="font-size:22px;width:40px;text-align:center">⌁</span><span>Botín</span><span class="postcombat-loot-badge">0</span>';
    button.addEventListener("click", () => open());
    if (inventory?.nextSibling) menu.insertBefore(button, inventory.nextSibling);
    else menu.appendChild(button);
    return button;
  }

  function ensureModal() {
    let modal = global.document?.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = global.document.createElement("div");
    modal.id = MODAL_ID;
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <section class="loot-shell" role="dialog" aria-modal="true" aria-labelledby="postcombat-loot-title">
        <header class="loot-head">
          <div><h2 id="postcombat-loot-title">RECUPERACIÓN POST-COMBATE</h2><p>Busca, cosecha o examina los restos disponibles.</p></div>
          <button class="loot-close" type="button" aria-label="Cerrar">×</button>
        </header>
        <div class="loot-body">
          <div class="loot-message" id="postcombat-loot-message"></div>
          <div id="postcombat-loot-list"></div>
          <div class="loot-roll"><div id="postcombat-loot-coins" style="display:flex;gap:5px;flex-wrap:wrap"></div><div class="loot-roll-total" id="postcombat-loot-total"></div></div>
        </div>
      </section>`;
    modal.querySelector(".loot-close").addEventListener("click", close);
    modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
    global.document.body.appendChild(modal);
    return modal;
  }

  function setMessage(text, error = false) {
    state.message = clean(text);
    state.error = error === true;
    const node = global.document?.getElementById("postcombat-loot-message");
    if (!node) return;
    node.textContent = state.message;
    node.classList.toggle("show", Boolean(state.message));
    node.classList.toggle("error", state.error);
  }

  function latestEncounter() {
    return Object.entries(state.encounters || {})
      .map(([id, row]) => ({ id, ...(row || {}) }))
      .filter((row) => row.meta?.open !== false && normalizeId(row.meta?.result) === "victory" && Number(row.meta?.corpseCount || Object.keys(row.corpses || {}).length) > 0)
      .sort((a, b) => Number(b.meta?.finalizedAt || 0) - Number(a.meta?.finalizedAt || 0))[0] || null;
  }

  async function readCorpse(corpseIndex) {
    const db = state.db;
    const lootId = clean(corpseIndex.lootInstanceId);
    const [interactionSnap, lootSnap] = await Promise.all([
      db.ref(`${live().ROOTS.postCombat}/${lootId}`).once("value"),
      db.ref(`${live().ROOTS.lootInstances}/${lootId}`).once("value"),
    ]);
    return {
      index: clone(corpseIndex),
      interaction: clone(interactionSnap.val() || {}),
      loot: clone(lootSnap.val() || {}),
    };
  }

  function resourceLabel(resource = {}) {
    const id = normalizeId(resource.resourceId || resource.id);
    const authored = clean(resource.lineageName || resource.materialName);
    return authored || titleCase(id || "recurso");
  }

  function actionLabel(actionId) {
    return ({
      search: "Buscar",
      harvest: "Cosechar",
      extract: "Extraer",
      salvage: "Desmontar",
      examine: "Examinar",
      autopsy: "Autopsia",
    })[actionId] || titleCase(actionId);
  }

  function pendingForPlayer(interaction = {}) {
    const playerId = resolvePlayerId();
    return (interaction.pendingDeliveries || []).filter((entry) => clean(entry.actorId) === playerId);
  }

  async function render() {
    const list = global.document?.getElementById("postcombat-loot-list");
    if (!list || !state.db || !state.activeEncounterId) return;
    list.innerHTML = '<div class="loot-empty">Revisando restos disponibles…</div>';
    const encounter = state.encounters[state.activeEncounterId] || {};
    const corpses = await Promise.all(Object.values(encounter.corpses || {}).map(readCorpse));
    const playerSnap = await state.db.ref(`campaña/jugadores/${resolvePlayerId()}`).once("value");
    const actor = playerSnap.val() || {};
    actor.id = actor.id || resolvePlayerId();

    const rows = [];
    for (const corpse of corpses) {
      const interaction = corpse.interaction;
      if (!interaction?.lootInstanceId) continue;
      const actions = live().availableActions(interaction, actor, { playerId: resolvePlayerId() });
      const pending = pendingForPlayer(interaction);
      if (!actions.length && !pending.length) continue;

      const actionHtml = actions.map((action) => {
        let select = "";
        if (["harvest","extract","salvage"].includes(action)) {
          const resources = postCombat().eligibleResources(interaction, action);
          if (resources.length > 1) {
            select = `<select class="loot-resource" data-resource-for="${esc(action)}">${resources.map((resource) => `<option value="${esc(resource.resourceId || resource.id)}">${esc(resourceLabel(resource))}</option>`).join("")}</select>`;
          } else if (resources.length === 1) {
            select = `<input type="hidden" data-resource-for="${esc(action)}" value="${esc(resources[0].resourceId || resources[0].id)}">`;
          }
        }
        return `${select}<button type="button" class="loot-action" data-loot-action="${esc(action)}" data-loot-id="${esc(interaction.lootInstanceId)}">${esc(actionLabel(action))}</button>`;
      }).join("");

      const pendingHtml = pending.map((entry) => `<button type="button" class="loot-action pending" data-pending-id="${esc(entry.id)}" data-loot-id="${esc(interaction.lootInstanceId)}">Recoger pendiente</button>`).join("");
      rows.push(`
        <article class="loot-corpse" data-loot-card="${esc(interaction.lootInstanceId)}">
          <div class="loot-corpse-title"><strong>${esc(corpse.index.name || corpse.index.sourceUnitId || "Restos")}</strong><span>${pending.length ? "Recuperación pendiente" : "Disponible"}</span></div>
          <div class="loot-actions">${actionHtml}${pendingHtml}</div>
        </article>`);
    }

    list.innerHTML = rows.length ? rows.join("") : '<div class="loot-empty">No quedan acciones post-combate disponibles.</div>';
    list.querySelectorAll("[data-loot-action]").forEach((button) => {
      button.addEventListener("click", () => runAction(button).catch((error) => setMessage(error?.message || String(error), true)));
    });
    list.querySelectorAll("[data-pending-id]").forEach((button) => {
      button.addEventListener("click", () => claimPending(button).catch((error) => setMessage(error?.message || String(error), true)));
    });
  }

  async function animatedCheck(actor, actionId, options = {}) {
    const definition = postCombat().checkDefinition(actor, actionId, options);
    const container = global.document.getElementById("postcombat-loot-coins");
    const totalNode = global.document.getElementById("postcombat-loot-total");
    if (checks()?.rollCheckWithCoinEngine && global.LuminousCoinEngine?.runAnimatedRoll && container) {
      return checks().rollCheckWithCoinEngine(definition, {
        document: global.document,
        container,
        totalNode,
        intervalMs: 180,
        auto: true,
      });
    }
    return checks().rollCheck(definition);
  }

  async function runAction(button) {
    if (state.busy) return;
    state.busy = true;
    setMessage("");
    const lootInstanceId = clean(button.dataset.lootId);
    const actionId = normalizeId(button.dataset.lootAction);
    const card = button.closest("[data-loot-card]");
    const resourceNode = card?.querySelector(`[data-resource-for="${actionId}"]`);
    const targetResourceId = clean(resourceNode?.value);
    try {
      await live().ensureDependencies();
      const playerId = resolvePlayerId();
      const playerSnap = await state.db.ref(`campaña/jugadores/${playerId}`).once("value");
      const actor = clone(playerSnap.val() || {});
      actor.id = actor.id || playerId;
      const checkResult = await animatedCheck(actor, actionId, { targetResourceId });
      const result = await live().executeAction({
        db: state.db,
        playerId,
        actor,
        actionId,
        lootInstanceId,
        targetResourceId: targetResourceId || undefined,
        checkResult,
        now: Date.now(),
      });

      if (!result.committed) {
        setMessage("Otro intento ya resolvió esta acción o el recurso dejó de estar disponible.", true);
      } else if (result.delivery && !result.delivery.delivered) {
        setMessage("La recuperación quedó reservada. Libera espacio en Inventario o Stash y usa «Recoger pendiente».", false);
      } else if (checkResult.success) {
        const itemCount = result.materialized?.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;
        const ahn = Number(result.materialized?.currency?.amount || 0);
        const parts = [itemCount ? `${itemCount} unidad(es) recuperadas` : "", ahn ? `${ahn.toLocaleString()} Ahn` : ""].filter(Boolean);
        setMessage(parts.length ? `Éxito · ${parts.join(" · ")}.` : "Éxito · nueva información añadida al Compendium.");
      } else {
        setMessage("La acción no tuvo éxito. El cadáver no generó botín nuevo; simplemente no recuperaste nada con este intento.");
      }
      await refreshEncounters();
      await render();
    } finally {
      state.busy = false;
    }
  }

  async function claimPending(button) {
    if (state.busy) return;
    state.busy = true;
    try {
      const result = await live().deliverPending({
        db: state.db,
        lootInstanceId: clean(button.dataset.lootId),
        deliveryId: clean(button.dataset.pendingId),
        playerId: resolvePlayerId(),
        now: Date.now(),
      });
      if (result.delivered) setMessage(result.duplicate ? "La recuperación ya estaba acreditada; se confirmó sin duplicarla." : "Recuperación pendiente entregada.");
      else setMessage("Todavía no hay espacio suficiente para recibir esa recuperación.", true);
      await refreshEncounters();
      await render();
    } finally {
      state.busy = false;
    }
  }

  async function refreshEncounters() {
    if (!state.db) return;
    const snap = await state.db.ref(live().ROOTS.encounterLoot).once("value");
    state.encounters = clone(snap.val() || {});
    const latest = latestEncounter();
    state.activeEncounterId = latest?.id || null;
    const corpseCount = latest ? Object.keys(latest.corpses || {}).length : 0;
    const button = ensureButton();
    if (button) {
      button.classList.toggle("available", corpseCount > 0);
      const badge = button.querySelector(".postcombat-loot-badge");
      if (badge) badge.textContent = String(corpseCount);
    }
    if (state.open && state.activeEncounterId) await render();
  }

  function open() {
    if (!state.activeEncounterId) return;
    const modal = ensureModal();
    state.open = true;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    render().catch((error) => setMessage(error?.message || String(error), true));
  }

  function close() {
    state.open = false;
    const modal = global.document?.getElementById(MODAL_ID);
    modal?.classList.remove("open");
    modal?.setAttribute("aria-hidden", "true");
  }

  function bindRealtime() {
    if (!state.db?.ref) return false;
    const ref = state.db.ref(live().ROOTS.encounterLoot);
    const handler = (snap) => {
      state.encounters = clone(snap.val() || {});
      const latest = latestEncounter();
      state.activeEncounterId = latest?.id || null;
      const count = latest ? Object.keys(latest.corpses || {}).length : 0;
      const button = ensureButton();
      button?.classList.toggle("available", count > 0);
      const badge = button?.querySelector(".postcombat-loot-badge");
      if (badge) badge.textContent = String(count);
      if (state.open) render().catch((error) => setMessage(error?.message || String(error), true));
    };
    ref.on("value", handler);
    state.listeners.push(() => ref.off("value", handler));
    return true;
  }

  async function install(options = {}) {
    if (state.db) return true;
    state.db = options.db || (global.firebase?.database ? global.firebase.database() : null);
    state.playerId = clean(options.playerId || resolvePlayerId());
    if (!state.db?.ref || !state.playerId) return false;
    ensureStyle();
    ensureButton();
    ensureModal();
    await live().ensureDependencies();
    bindRealtime();
    await refreshEncounters();
    return true;
  }

  function boot() {
    const attempt = () => {
      if (!global.firebase?.database || !resolvePlayerId() || !live()) return false;
      install().catch((error) => global.console?.error?.("[PostCombat Loot]", error));
      return true;
    };
    if (attempt()) return;
    let tries = 0;
    const timer = global.setInterval(() => {
      tries += 1;
      if (attempt() || tries > 120) global.clearInterval(timer);
    }, 250);
  }

  global.LuminousPlayerPostCombatLoot = Object.freeze({
    VERSION,
    state,
    install,
    open,
    close,
    refreshEncounters,
    render,
    runAction,
    claimPending,
  });

  if (global.document?.readyState === "loading") global.document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})(window);
