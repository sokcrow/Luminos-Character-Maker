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
    combatState: {},
    instance: null,
    autoOpened: null,
    renderGeneration: 0,
    selectedLootId: null,
    claim: null,
    claims: {},
    claimHeartbeat: null,
    claiming: false,
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
    if (!global.document.getElementById("postcombat-loot-corpse-css")) {
      const link = global.document.createElement("link");
      link.id = "postcombat-loot-corpse-css";
      link.rel = "stylesheet";
      link.href = "css/postcombat-loot-corpse.css?v=20261022-1";
      global.document.head.appendChild(link);
    }
  }

  function ensureButton() {
    let button = global.document?.getElementById(BUTTON_ID);
    if (button) return button;
    const inventory = global.document?.getElementById("btn-global-inventory");
    const menu = inventory?.parentElement || global.document?.querySelector(".hud-menu-dropdown") || global.document?.querySelector('#combat-entry-menu nav') || global.document?.getElementById('mirror-bar');
    if (!menu) return null;
    button = global.document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "hud-menu-item";
    button.title = "Revisar botín post-combate";
    button.innerHTML = '<img src="Assets/Icons/items/utility/harvest_kit.png" width="40" height="40" alt="" aria-hidden="true" class="hud-menu-local-icon" style="width:40px;height:40px;object-fit:contain;"><span>Botín</span><span class="postcombat-loot-badge">0</span>';
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
          <div class="loot-sigil" aria-hidden="true">✥</div>
          <div><h2 id="postcombat-loot-title">LOOT CORPSE</h2><p>TOMA LO QUE PERMANECE · RECUPERACIÓN POST-COMBATE</p></div>
          <p class="loot-motto">LOS CAÍDOS NO OLVIDAN SUS PERTENENCIAS</p>
          <button class="loot-close" type="button" aria-label="Cerrar saqueo">×</button>
        </header>
        <div class="loot-message" id="postcombat-loot-message" role="status" aria-live="polite"></div>
        <div class="loot-stage">
          <aside class="loot-column loot-left" aria-label="Cadáveres disponibles">
            <div class="loot-column-head"><h3>CAÍDOS</h3><span id="postcombat-loot-corpse-count"></span></div>
            <div id="postcombat-loot-corpse-nav" class="loot-corpses"></div>
            <div class="loot-corpse-bottom"><b>RESTOS DE LA BATALLA</b>Lo que recuperes depende de tu búsqueda, tu habilidad y aquello que el enemigo llevaba consigo.</div>
          </aside>
          <main class="loot-column loot-center">
            <div class="loot-column-head"><h3>PERTENENCIAS Y RESTOS</h3><span>SAQUEO COMPARTIDO</span></div>
            <div id="postcombat-loot-list" class="loot-content-scroll"></div>
            <div class="loot-coin-roll"><div id="postcombat-loot-coins" style="display:flex;gap:5px;flex-wrap:wrap" aria-label="Resultado de las monedas"></div><div class="loot-roll-total" id="postcombat-loot-total" aria-live="polite"></div></div>
          </main>
          <aside class="loot-column loot-right" aria-label="Inventario del personaje">
            <div class="loot-column-head"><h3>INVENTARIO</h3><span>ACTIVO</span></div>
            <div id="postcombat-loot-inventory-summary" class="loot-inventory-meta"></div>
            <div id="postcombat-loot-inventory" class="loot-inventory-list"></div>
            <div id="postcombat-loot-wallet" class="loot-wallet"></div>
          </aside>
        </div>
        <footer class="loot-foot"><span>BUSCAR · COSECHAR · EXTRAER · DESMONTAR · EXAMINAR · AUTOPSIA</span><span>EL BOTÍN NO SE REGENERA</span></footer>
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
      .filter(row=>!row.meta?.participants||row.meta.participants[resolvePlayerId()]===true)
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

  function bodyResources(interaction = {}) {
    const source = interaction.harvest?.resources || [];
    return Array.isArray(source) ? source : Object.values(source);
  }

  function bodyDiscoveredByPlayer(interaction = {}, playerId = "") {
    return (interaction.attempts || []).some(entry =>
      clean(entry.actorId) === playerId &&
      ["examine", "autopsy"].includes(normalizeId(entry.actionId)) &&
      (entry.success === true || entry.check?.success === true));
  }

  function bodySlot(resource = {}) {
    const name = resourceLabel(resource);
    const remaining = Math.max(0, Number(resource.remaining || 0));
    return `<div class="loot-discovery known${remaining ? "" : " depleted"}" title="${esc(name)}">
      <b>${esc(name)}</b><small>${remaining ? remaining + " DISP." : "AGOTADO"}</small>
    </div>`;
  }

  function leasedByAnother(lootId) {
    const occupant = state.claims?.[lootId];
    return occupant && Number(occupant.expiresAt || 0) > Date.now() &&
      (clean(occupant.playerId) !== resolvePlayerId() ||
        clean(occupant.uid) !== clean(global.firebase?.auth?.().currentUser?.uid));
  }

  function ownsCorpse(lootId) {
    return state.claim?.lootInstanceId === lootId &&
      Number(state.claim?.expiresAt || 0) > Date.now() && !leasedByAnother(lootId);
  }

  async function leaveCorpse() {
    const prior = state.claim;
    state.claim = null;
    if (state.claimHeartbeat) { global.clearInterval(state.claimHeartbeat); state.claimHeartbeat = null; }
    if (prior?.lootInstanceId && state.db) {
      await live().releaseCorpse({db:state.db,playerId:resolvePlayerId(),lootInstanceId:prior.lootInstanceId});
    }
  }

  async function enterCorpse(lootId) {
    if (state.claiming || !lootId || !state.open) return;
    if (ownsCorpse(lootId)) return;
    state.claiming = true;
    try {
      if (state.claim?.lootInstanceId && state.claim.lootInstanceId !== lootId) await leaveCorpse();
      state.selectedLootId = lootId;
      if (leasedByAnother(lootId)) { setMessage("Otro personaje está revisando ese cadáver. Elige uno libre.", true); return; }
      const result = await live().claimCorpse({db:state.db,playerId:resolvePlayerId(),lootInstanceId:lootId});
      if (!result.acquired) { setMessage("Este cadáver está ocupado. Se liberará cuando el personaje termine o expire su reserva.", true); return; }
      state.claim = {lootInstanceId:lootId,expiresAt:Number(result.claim?.expiresAt || 0)};
      if (!state.open) { await leaveCorpse(); return; }
      if (state.claimHeartbeat) global.clearInterval(state.claimHeartbeat);
      state.claimHeartbeat = global.setInterval(async () => {
        if (!state.open || !state.claim || state.busy) return;
        try {
          const renewed = await live().claimCorpse({db:state.db,playerId:resolvePlayerId(),
            lootInstanceId:state.claim.lootInstanceId,skipAccess:true});
          if (!renewed.acquired) { state.claim=null;setMessage("Perdiste la reserva de este cadáver.", true); }
          else state.claim.expiresAt = Number(renewed.claim.expiresAt);
        } catch (_) { state.claim=null; setMessage("No se pudo mantener la reserva del cadáver.",true); }
      },25000);
      setMessage("");
    } finally {
      state.claiming = false;
      if (state.open) render().catch(error=>setMessage(error?.message || String(error),true));
    }
  }

  function pendingForPlayer(interaction = {}) {
    const playerId = resolvePlayerId();
    return (interaction.pendingDeliveries || []).filter((entry) => clean(entry.actorId) === playerId);
  }


  function visibleDiscoveredItems(interaction = {}, playerId = "") {
    const entries = Array.isArray(interaction.carried) ? interaction.carried : Object.values(interaction.carried || {});
    return entries.filter((entry) =>
      [...(entry.discoveredBy || []), ...(entry.recoveredBy || [])].some((id) => clean(id) === playerId)
    ).map((entry) => {
      let item = entry.item || {};
      try { item = global.LuminousItemInventoryRuntime?.resolveItem?.(item) || item; } catch (_) { /* Keep the saved instance. */ }
      return {
        name: clean(item.displayName || item.name || item.nombre || titleCase(entry.definitionId || "Pertenencia recuperada")),
        quantity: Math.max(1, Number(entry.quantity ?? item.quantity ?? 1)),
        icon: clean(item.iconUrl || item.icon || item.imageUrl || item.image || ""),
        status: "Recuperado",
      };
    });
  }

  function visibleRecoveredResources(interaction = {}, playerId = "") {
    const resources = interaction.harvest?.resources || [];
    return (Array.isArray(resources) ? resources : Object.values(resources))
      .filter((entry) => (entry.recoveredBy || []).some((row) => clean(row?.actorId || row) === playerId))
      .map((entry) => ({
        name: resourceLabel(entry),
        quantity: Math.max(1, Number(entry.capacity || 0) - Number(entry.remaining || 0)),
        icon: "",
        status: "Extraído",
      }));
  }

  // Only allow icons coming from the game's asset directories, never arbitrary
  // remote URLs or values from untrusted inventory metadata.
  function lootIcon(path) {
    const value = clean(path).replace(/^\.?\//, "");
    return /^(Assets|assets)\//.test(value) && !value.includes("..") && !/["'<>]/.test(value) ? value : "";
  }

  function knownItemSlot(entry = {}) {
    const icon = lootIcon(entry.icon);
    const name = clean(entry.name || "Objeto");
    const quantity = Math.max(1, Number(entry.quantity || 1));
    return `<div class="loot-discovery known" title="${esc(name)} · ${esc(entry.status || "Recuperado")}">
      ${icon ? `<img src="${esc(icon)}" alt="">` : `<b>${esc(name)}</b>`}
      <small>${quantity}</small>
    </div>`;
  }

  function playerInventoryMarkup(actor = {}) {
    const inventory = global.LuminousItemInventoryRuntime;
    let snapshot;
    try { snapshot = inventory?.inventorySnapshot?.(actor) || null; } catch (_) { snapshot = null; }
    const active = snapshot?.active || [];
    const described = inventory?.describeInventory?.(actor) || {};
    const used = Number(described.activeSlots ?? active.length);
    const limit = Math.max(used, Number(described.activeSlotLimit ?? snapshot?.activeSlotLimit ?? 0));
    const stashInfo = described.stashSlotLimit ? ` · STASH ${Number(described.stashSlots || 0)} / ${Number(described.stashSlotLimit)}` : "";
    const summary = global.document?.getElementById("postcombat-loot-inventory-summary");
    const host = global.document?.getElementById("postcombat-loot-inventory");
    const wallet = global.document?.getElementById("postcombat-loot-wallet");
    if (summary) summary.innerHTML = `<b>${used} / ${limit || "—"}</b> ESPACIOS OCUPADOS${stashInfo}
      <div class="loot-capacity-bar"><i style="width:${limit ? Math.min(100, used / limit * 100) : 0}%"></i></div>`;
    if (host) {
      const slots = active.slice(0, 48).map(({ item }) => {
        const name = clean(item?.displayName || item?.name || item?.nombre || titleCase(item?.definitionId || "Objeto"));
        const icon = lootIcon(item?.iconUrl || item?.icon || item?.imageUrl || item?.image || "");
        const quantity = Math.max(1, Number(item?.quantity || 1));
        return `<div class="loot-pack-item" title="${esc(name)}">${icon ? `<img src="${esc(icon)}" alt="">` : `<span>${esc(name)}</span>`}${quantity > 1 ? `<small>${quantity}</small>` : ""}</div>`;
      });
      const blanks = Math.max(0, Math.min(limit || 12, 16) - slots.length);
      host.innerHTML = slots.join("") + Array.from({ length: blanks }, () => '<div class="loot-pack-item blank" aria-hidden="true"></div>').join("");
    }
    if (wallet) wallet.innerHTML = `<small>MONEDERO</small>✣ ${Number(live().playerBalance(actor) || 0).toLocaleString("es-MX")} AHN`;
  }

  async function render() {
    const list = global.document?.getElementById("postcombat-loot-list");
    const nav = global.document?.getElementById("postcombat-loot-corpse-nav");
    if (!list || !nav || !state.db || !state.activeEncounterId) return;
    const generation = ++state.renderGeneration;
    if (!list.children.length) list.innerHTML = '<div class="loot-empty">Revisando restos disponibles…</div>';
    const encounter = state.encounters[state.activeEncounterId] || {};
    if (encounter.meta?.open === false) { close(); return; }
    const [corpses, playerSnap] = await Promise.all([
      Promise.all(Object.values(encounter.corpses || {}).map(readCorpse)),
      state.db.ref(`campaña/jugadores/${resolvePlayerId()}`).once("value"),
    ]);
    if (generation !== state.renderGeneration || !state.open) return;
    const actor = clone(playerSnap.val() || {});
    const playerId = resolvePlayerId();
    actor.id = actor.id || playerId;
    playerInventoryMarkup(actor);

    const count = global.document.getElementById("postcombat-loot-corpse-count");
    if (count) count.textContent = `${corpses.length} RESTOS`;
    const navRows = [];
    const rows = [];

    for (const corpse of corpses) {
      const interaction = corpse.interaction;
      if (!interaction?.lootInstanceId) continue;
      for (const key of ["carried", "attempts", "pendingDeliveries"]) {
        if (!Array.isArray(interaction[key])) interaction[key] = Object.values(interaction[key] || {});
      }
      if (!Array.isArray(interaction.harvest?.resources) && interaction.harvest) {
        interaction.harvest.resources = Object.values(interaction.harvest.resources || {});
      }
      const actions = live().availableActions(interaction, actor, { playerId });
      const pending = pendingForPlayer(interaction);
      const known = visibleDiscoveredItems(interaction, playerId);
      const anatomyKnown = bodyDiscoveredByPlayer(interaction, playerId);
      const bodyKnown = anatomyKnown ? bodyResources(interaction) : visibleRecoveredResources(interaction, playerId);
      const occupied = leasedByAnother(interaction.lootInstanceId);
      const accessible = ownsCorpse(interaction.lootInstanceId);
      const remainingRecoverable = actions.length > 0 || pending.length > 0;
      const name = clean(corpse.index.name || corpse.index.sourceUnitId || "Restos");
      const lootId = interaction.lootInstanceId;
      navRows.push(`<button type="button" class="loot-corpse-choice${state.selectedLootId === lootId ? " active" : ""}" data-corpse-select="${esc(lootId)}">
        <span class="loot-corpse-glyph" aria-hidden="true">✥</span>
        <span><strong>${esc(name)}</strong><small>${occupied ? "EN USO" : pending.length ? "RECUPERACIÓN PENDIENTE" : remainingRecoverable ? "RESTOS DISPONIBLES" : "REGISTRADO"}</small></span>
      </button>`);

      const resourceActionMarkup = actions.map((action) => {
        let select = "";
        if (["harvest", "extract", "salvage"].includes(action)) {
          const resources = postCombat().eligibleResources(interaction, action);
          if (anatomyKnown && resources.length > 1) {
            select = `<select class="loot-resource" data-resource-for="${esc(action)}" aria-label="Elegir recurso a recuperar">${resources.map((resource) => `<option value="${esc(resource.resourceId || resource.id)}">${esc(resourceLabel(resource))}</option>`).join("")}</select>`;
          } else if (anatomyKnown && resources.length === 1) {
            select = `<input type="hidden" data-resource-for="${esc(action)}" value="${esc(resources[0].resourceId || resources[0].id)}">`;
          }
        }
        const penalty = Number(postCombat().anatomyPenalty?.(actor,action) || 0);
        return `<div class="loot-resource-group">${select}<button type="button" class="loot-action" data-loot-action="${esc(action)}" data-loot-id="${esc(lootId)}" ${accessible ? "" : "disabled"} title="${penalty ? "Sin Medicina: +8 a la dificultad" : ""}">${esc(actionLabel(action))}</button>${penalty ? '<small class="loot-skill-penalty">SIN MEDICINA · +8 TH</small>' : ""}</div>`;
      }).join("");
      const pendingHtml = pending.map((entry) => `<button type="button" class="loot-action pending" data-pending-id="${esc(entry.id)}" data-loot-id="${esc(lootId)}" ${accessible ? "" : "disabled"}>Recoger pendiente</button>`).join("");
      const discoverySlots = known.slice(0, 24).map(knownItemSlot).join("");
      const searchedSuccessfully = interaction.attempts.some(attempt =>
        clean(attempt.actorId) === playerId && normalizeId(attempt.actionId) === "search" && attempt.success === true);
      const bagsEmpty = !interaction.carried.some(item => Number(item.remaining || 0) > 0) &&
        Number(interaction.currency?.remaining || 0) <= 0;
      const emptySlots = searchedSuccessfully && !known.length && bagsEmpty
        ? '<div class="loot-empty">Sin pertenencias restantes.</div>'
        : Array.from({ length: Math.max(0, 6 - known.length) }, () => '<div class="loot-discovery unknown" aria-hidden="true">✧</div>').join("");
      const bodyGrid = bodyKnown.slice(0,24).map((resource) => anatomyKnown ? bodySlot(resource) : knownItemSlot(resource)).join("");
      const bodyBlanks = anatomyKnown && !bodyKnown.length ? '<div class="loot-empty">No se encontraron materiales recuperables.</div>' :
        Array.from({length:Math.max(0, 6 - bodyKnown.length)},()=>'<div class="loot-discovery unknown" aria-hidden="true">✧</div>').join("");
      rows.push(`<article class="loot-corpse${state.selectedLootId === lootId ? " selected" : ""}" data-loot-card="${esc(lootId)}">
        <div class="loot-corpse-title"><strong>${esc(name)}</strong><span>${pending.length ? "ENTREGA PENDIENTE" : remainingRecoverable ? "RECUPERACIÓN POSIBLE" : "SIN ACCIONES DISPONIBLES"}</span></div>
        <p class="loot-corpse-note">${known.length ? "Pertenencias recuperadas de este enemigo." : "Las bolsas permanecen ocultas hasta superar Buscar. El botín no se regenera."}</p>
        <div class="loot-recovered-title">${known.length ? "OBJETOS RECUPERADOS" : "SIN DESCUBRIMIENTOS"}</div>
        <div class="loot-recovered-grid">${discoverySlots}${emptySlots}</div>
        <div class="loot-recovered-title">CUERPO · ${anatomyKnown ? "RECURSOS EXAMINADOS" : "SIN EXAMINAR"}</div>
        <div class="loot-recovered-grid">${bodyGrid}${bodyBlanks}</div>
        <div class="loot-action-title">ACCIONES DISPONIBLES ${occupied ? "· OCUPADO POR OTRO PERSONAJE" : accessible ? "· TU TURNO" : "· SELECCIONA ESTE CADÁVER"}</div>
        <div class="loot-actions">${resourceActionMarkup}${pendingHtml || ""}</div>
        ${accessible ? `<button type="button" class="loot-release" data-corpse-release="${esc(lootId)}">SOLTAR CADÁVER</button>` : ""}
        ${!actions.length && !pending.length ? '<div class="loot-empty">No quedan acciones para este personaje en estos restos.</div>' : ""}
      </article>`);
    }

    if (!state.selectedLootId || !corpses.some((corpse) => corpse.interaction?.lootInstanceId === state.selectedLootId)) {
      state.selectedLootId = corpses.find((corpse) => corpse.interaction?.lootInstanceId)?.interaction?.lootInstanceId || null;
    }
    list.innerHTML = rows.length ? rows.join("") : '<div class="loot-empty">No se encontraron restos disponibles para este encuentro.</div>';
    nav.innerHTML = navRows.join("");
    nav.querySelectorAll("[data-corpse-select]").forEach((button) => {
      button.classList.toggle("active", button.dataset.corpseSelect === state.selectedLootId);
      button.addEventListener("click", () => {
        const next = button.dataset.corpseSelect;
        if (state.busy || state.claiming || leasedByAnother(next)) {setMessage("Este cadáver está ocupado o hay una acción en curso.",true);return;}
        enterCorpse(next).catch(error=>setMessage(error?.message || String(error),true));
      });
    });
    list.querySelectorAll("[data-corpse-release]").forEach(button => {
      button.addEventListener("click", () => {
        if (state.busy) {setMessage("Finaliza la tirada antes de soltar el cadáver.",true);return;}
        leaveCorpse().then(()=>render()).catch(error=>setMessage(error?.message || String(error),true));
      });
    });
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
    if (!ownsCorpse(lootInstanceId)) { state.busy=false;setMessage("Primero debes reservar este cadáver.",true);return; }
    const actionId = normalizeId(button.dataset.lootAction);
    const card = button.closest("[data-loot-card]");
    const resourceNode = card?.querySelector(`[data-resource-for="${actionId}"]`);
    const targetResourceId = clean(resourceNode?.value);
    try {
      await live().ensureDependencies();
      const playerId = resolvePlayerId();
      // Read the character and validate access simultaneously. These are
      // independent reads; serial WAN round trips delayed the first loot Coin.
      const [playerSnap] = await Promise.all([
        state.db.ref(`campaña/jugadores/${playerId}`).once("value"),
        // Keep authorization strict: do not start a Coin roll until Firebase
        // confirms ownership and participation in this victory.
        live().checkPlayerLootAccess({db:state.db,playerId,lootInstanceId}),
      ]);
      const actor = clone(playerSnap.val() || {});
      actor.id = actor.id || playerId;
      const checkResult = await animatedCheck(actor, actionId, { targetResourceId });
      const result = await live().requestAction({
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
      } else if (result.check?.success) {
        const itemCount = result.materialized?.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;
        const ahn = Number(result.materialized?.currency?.amount || 0);
        const parts = [itemCount ? `${itemCount} unidad(es) recuperadas` : "", ahn ? `${ahn.toLocaleString()} Ahn` : ""].filter(Boolean);
        setMessage(parts.length ? `Éxito · ${parts.join(" · ")}.` : "Éxito · nueva información añadida al Compendium.");
      } else {
        setMessage("La acción no tuvo éxito. El cadáver no generó botín nuevo; simplemente no recuperaste nada con este intento.");
      }
      await refreshEncounters();
    } finally {
      state.busy = false;
    }
  }

  async function claimPending(button) {
    if (state.busy) return;
    state.busy = true;
    try {
      if (!ownsCorpse(clean(button.dataset.lootId))) throw Error("El cadáver ya no está reservado por tu personaje.");
      const result = await live().requestAction({
        db: state.db,
        lootInstanceId: clean(button.dataset.lootId),
        deliveryId: clean(button.dataset.pendingId),
        playerId: resolvePlayerId(),
        now: Date.now(),
      });
      if (result.delivered) setMessage(result.duplicate ? "La recuperación ya estaba acreditada; se confirmó sin duplicarla." : "Recuperación pendiente entregada.");
      else setMessage("Todavía no hay espacio suficiente para recibir esa recuperación.", true);
      await refreshEncounters();
    } finally {
      state.busy = false;
    }
  }

  async function refreshEncounters() {
    if (!state.db) return;
    const snap = await state.db.ref(live().ROOTS.encounterLoot).once("value");
    state.encounters = clone(snap.val() || {});
    const latest = latestEncounter();
    if (state.activeEncounterId && state.activeEncounterId !== latest?.id) leaveCorpse().catch(()=>{});
    state.activeEncounterId = latest?.id || null;
    const corpseCount = latest ? Object.keys(latest.corpses || {}).length : 0;
    const button = ensureButton();
    if (button) {
      button.classList.toggle("available", corpseCount > 0);
      const badge = button.querySelector(".postcombat-loot-badge");
      if (badge) badge.textContent = String(corpseCount);
    }
    if (state.open && state.activeEncounterId) await render();
    maybeOpenResult();
  }

  function maybeOpenResult(){
    const completed=state.combatState,encounter=state.encounters[completed.encounterId];
    if(encounter?.meta?.open===false||!Object.keys(encounter?.corpses||{}).length||state.instance!=='teatro'||completed.phase!=='ENDED'||completed.result!=='victory'||!encounter||encounter.meta?.participants?.[resolvePlayerId()]!==true)return;
    const key=`luminous:loot-seen:${resolvePlayerId()}:${completed.encounterId}`;
    if(state.autoOpened===key||global.localStorage?.getItem?.(key)==='true')return;
    state.activeEncounterId=completed.encounterId;state.autoOpened=key;
    global.localStorage?.setItem?.(key,'true');open();
  }

  function open() {
    if (!state.activeEncounterId) return;
    const modal = ensureModal();
    state.open = true;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    render().then(() => {
      const id = state.selectedLootId;
      if (state.open && id && !ownsCorpse(id)) return enterCorpse(id);
    }).catch((error) => setMessage(error?.message || String(error), true));
  }

  function close() {
    if (state.busy) {setMessage("Termina la recuperación antes de cerrar.",true);return;}
    state.open = false;
    state.renderGeneration++;
    leaveCorpse().catch(() => {});
    const modal = global.document?.getElementById(MODAL_ID);
    modal?.classList.remove("open");
    modal?.setAttribute("aria-hidden", "true");
  }

  function bindRealtime() {
    if (!state.db?.ref) return false;
    const ref = state.db.ref(live().ROOTS.encounterLoot);
    const handler = (snap) => {
      state.encounters = clone(snap.val() || {});
      if (state.open && state.encounters[state.activeEncounterId]?.meta?.open === false) close();
      const latest = latestEncounter();
      if (state.activeEncounterId && state.activeEncounterId !== latest?.id) leaveCorpse().catch(()=>{});
      state.activeEncounterId = latest?.id || null;
      const count = latest ? Object.keys(latest.corpses || {}).length : 0;
      const button = ensureButton();
      button?.classList.toggle("available", count > 0);
      const badge = button?.querySelector(".postcombat-loot-badge");
      if (badge) badge.textContent = String(count);
      if (state.open && !state.activeEncounterId) close();
      if (state.open) render().catch((error) => setMessage(error?.message || String(error), true));
      maybeOpenResult();
    };
    ref.on("value", handler);
    state.listeners.push(() => ref.off("value", handler));
    const leasesRef = state.db.ref(live().ROOTS.claims);
    const onLease = snap => {state.claims=snap.val()||{};if (state.open) render().catch(()=>{});};
    leasesRef.on("value",onLease);
    state.listeners.push(()=>leasesRef.off("value",onLease));
    const corpseStateRef = state.db.ref(live().ROOTS.postCombat);
    const onCorpse = () => {if(state.open) render().catch(()=>{});};
    corpseStateRef.on("value",onCorpse);
    state.listeners.push(()=>corpseStateRef.off("value",onCorpse));
    for(const [path,key] of [[live().ROOTS.combatState,'combatState'],['campaña/estado_mundo/instancia_activa','instance']]){
      const watched=state.db.ref(path),listener=snapshot=>{state[key]=snapshot.val()||{};maybeOpenResult();};
      watched.on('value',listener);state.listeners.push(()=>watched.off('value',listener));
    }
    return true;
  }

  async function install(options = {}) {
    if (state.db&&(!options.playerId||options.playerId===state.playerId)&&(!options.db||options.db===state.db)) return true;
    state.listeners.splice(0).forEach(off=>off());close();state.encounters={};state.combatState={};state.instance=null;state.autoOpened=null;state.selectedLootId=null;state.claim=null;state.claims={};
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
