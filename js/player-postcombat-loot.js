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
    requests: {},
    claimHeartbeat: null,
    claiming: false,
    activeTab: "actions",
    returnFocus: null,
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
      link.href = "css/postcombat-loot-corpse.css?v=20261023-shared-belongings-1";
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
          <div class="loot-sigil" id="postcombat-loot-selected-sprite" aria-hidden="true">✥</div>
          <div><h2 id="postcombat-loot-title">BOTÍN</h2><p>RECUPERACIÓN POST-COMBATE</p></div>
          <p class="loot-motto">LOS CAÍDOS NO OLVIDAN SUS PERTENENCIAS</p>
          <button class="loot-close" type="button" aria-label="Cerrar saqueo">×</button>
        </header>
        <div class="loot-message" id="postcombat-loot-message" role="status" aria-live="polite"></div>
        <nav class="loot-tabs" role="tablist" aria-label="Secciones del botín">
          <button type="button" role="tab" id="loot-tab-actions" data-loot-tab="actions" aria-controls="loot-panel-actions" aria-selected="true">Tiradas</button>
          <button type="button" role="tab" id="loot-tab-results" data-loot-tab="results" aria-controls="loot-panel-results" aria-selected="false" tabindex="-1">Cadáver</button>
          <button type="button" role="tab" id="loot-tab-inventory" data-loot-tab="inventory" aria-controls="loot-panel-inventory" aria-selected="false" tabindex="-1">Inventario</button>
          <button type="button" role="tab" id="loot-tab-space" data-loot-tab="space" aria-controls="loot-panel-space" aria-selected="false" tabindex="-1">Espacio</button>
        </nav>
        <div class="loot-stage">
          <aside class="loot-column loot-left" aria-label="Cadáveres disponibles">
            <label class="loot-corpse-picker">Cadáver<select id="postcombat-loot-corpse-picker" aria-label="Elegir cadáver"></select></label>
            <div class="loot-column-head"><h3>CAÍDOS</h3><span id="postcombat-loot-corpse-count"></span></div>
            <div id="postcombat-loot-corpse-nav" class="loot-corpses"></div>
            <div class="loot-corpse-bottom"><b>RESTOS DE LA BATALLA</b>Lo que recuperes depende de tu búsqueda, tu habilidad y aquello que el enemigo llevaba consigo.</div>
          </aside>
          <section class="loot-column loot-center" id="loot-panel-actions" role="tabpanel" aria-labelledby="loot-tab-actions" tabindex="0" data-loot-panel="actions">
            <div class="loot-column-head"><h3>TIRADAS DISPONIBLES</h3><span>SAQUEO COMPARTIDO</span></div>
            <div id="postcombat-loot-list" class="loot-content-scroll"></div>
            <div class="loot-coin-roll"><div id="postcombat-loot-coins" style="display:flex;gap:5px;flex-wrap:wrap" aria-label="Resultado de las monedas"></div><div class="loot-roll-total" id="postcombat-loot-total" aria-live="polite"></div></div>
          </section>
          <section class="loot-column loot-center" id="loot-panel-results" role="tabpanel" aria-labelledby="loot-tab-results" tabindex="0" data-loot-panel="results" hidden>
            <div class="loot-column-head"><h3>PERTENENCIAS Y HALLAZGOS</h3><span>DEL CADÁVER SELECCIONADO</span></div>
            <div id="postcombat-loot-results" class="loot-content-scroll"></div>
          </section>
          <section class="loot-column loot-right" id="loot-panel-inventory" role="tabpanel" aria-labelledby="loot-tab-inventory" tabindex="0" data-loot-panel="inventory" hidden>
            <div class="loot-column-head"><h3>INVENTARIO</h3><span>ACTIVO</span></div>
            <div id="postcombat-loot-inventory-summary" class="loot-inventory-meta"></div>
            <div id="postcombat-loot-inventory" class="loot-inventory-list"></div>
            <div id="postcombat-loot-wallet" class="loot-wallet"></div>
          </section>
          <section class="loot-column loot-center" id="loot-panel-space" role="tabpanel" aria-labelledby="loot-tab-space" tabindex="0" data-loot-panel="space" hidden>
            <div class="loot-column-head"><h3>ESPACIO DISPONIBLE</h3><span>INVENTARIO Y STASH</span></div>
            <div id="postcombat-loot-capacity" class="loot-content-scroll"></div>
          </section>
        </div>
        <footer class="loot-foot"><span>BUSCAR · SUSTRAER · COSECHAR · EXTRAER · DESMONTAR · EXAMINAR · AUTOPSIA</span><span>EL BOTÍN NO SE REGENERA</span></footer>
      </section>`;
    modal.querySelector(".loot-close").addEventListener("click", close);
    modal.querySelector("#postcombat-loot-corpse-picker").addEventListener("change", event => {
      selectCorpse(event.target.value);
    });
    modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
    modal.querySelectorAll("[data-loot-tab]").forEach(button => {
      button.addEventListener("click", () => selectTab(button.dataset.lootTab));
      button.addEventListener("keydown", event => {
        const tabs = Array.from(modal.querySelectorAll("[data-loot-tab]"));
        const index = tabs.indexOf(button);
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
          event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : -1;
        if (next < 0) return;
        event.preventDefault();
        selectTab(tabs[next].dataset.lootTab);
        tabs[next].focus();
      });
    });
    modal.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key !== "Tab") return;
      const focusable = Array.from(modal.querySelectorAll('button:not(:disabled), select:not(:disabled), [tabindex="0"]'))
        .filter(node => node.getClientRects().length && !node.closest("[hidden]"));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && global.document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && global.document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    global.document.body.appendChild(modal);
    selectTab(state.activeTab);
    return modal;
  }

  function selectTab(tab) {
    if (!["actions", "results", "inventory", "space"].includes(tab)) return;
    state.activeTab = tab;
    const modal = global.document?.getElementById(MODAL_ID);
    if (!modal) return;
    modal.dataset.lootView = tab;
    modal.querySelectorAll("[data-loot-tab]").forEach(button => {
      const selected = button.dataset.lootTab === tab;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    modal.querySelectorAll("[data-loot-panel]").forEach(panel => { panel.hidden = panel.dataset.lootPanel !== tab; });
  }

  function selectCorpse(lootId) {
    if (state.busy || state.claiming || leasedByAnother(lootId)) {
      setMessage("Este cadáver está ocupado o hay una acción en curso.", true);
      const picker = global.document?.getElementById("postcombat-loot-corpse-picker");
      if (picker) picker.value = state.selectedLootId || "";
      return;
    }
    enterCorpse(lootId).catch(error => showLootError(error));
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

  // Translate RTDB errors into a useful player-facing message.
  function showLootError(error) {
    const reason = String(error?.code || error?.message || error || "");
    if (/permission[_\s-]?denied/i.test(reason)) {
      setMessage("No se pudo acceder a este botín. Pide al DM que compruebe el acceso de tu personaje y los permisos de saqueo.", true);
      return;
    }
    setMessage(error?.message || String(error), true);
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
      collect: "Recoger",
      pickpocket: "Sustraer",
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
    const icon = resolveLootIcon(resource.iconUrl, resource.icon, resource.imageUrl, resource.materialId, resource.resourceId, resource.family, resource.category, "material");
    return `<button type="button" class="loot-discovery known${remaining ? "" : " depleted"}" title="${esc(name)}" aria-label="${esc(name)}: ${remaining ? remaining + " disponibles" : "agotado"}" data-loot-detail="${esc(name)}">
      <img src="${esc(icon)}" alt="" loading="lazy"><small>${remaining ? remaining : "0"}</small>
    </button>`;
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
      if (state.open) render().catch(error=>showLootError(error));
    }
  }

  function pendingForPlayer(interaction = {}) {
    const playerId = resolvePlayerId();
    return (interaction.pendingDeliveries || []).filter((entry) => clean(entry.actorId) === playerId);
  }


  function lootItemDefinition(id) {
    return global.LuminousItemInventoryRuntime?.resolveDefinition?.(id)
      || global.LuminousWeaponCatalog?.get?.(id)
      || global.LuminousHpHealingCatalog?.get?.(id)
      || global.LuminousCulinaryStaplesCatalog?.get?.(id) || {};
  }

  function visibleDiscoveredItems(interaction = {}, playerId = "") {
    const entries = Array.isArray(interaction.carried) ? interaction.carried : Object.values(interaction.carried || {});
    return entries.filter((entry) =>
      Number(entry.recoveredQuantitiesBy?.[playerId] || 0) > 0 ||
      (entry.recoveredBy || []).some((id) => clean(id) === playerId)
    ).map((entry) => {
      let item = entry.item || {};
      let definition = {};
      try {
        const inv = global.LuminousItemInventoryRuntime;
        definition = lootItemDefinition(entry.definitionId || item.definitionId);
        item = inv?.resolveItem?.(item) || item;
      } catch (_) { /* Keep the saved instance. */ }
      return {
        name: clean(item.displayName || item.name || item.nombre || definition.name || "Pertenencia recuperada"),
        quantity: Math.max(1, Number(entry.recoveredQuantitiesBy?.[playerId] ?? entry.quantity ?? item.quantity ?? 1)),
        icon: resolveLootIcon(item.iconUrl, item.icon, item.imageUrl, item.image, definition.iconUrl, definition.icon, item.iconFamily, definition.iconFamily, definition.family, entry.definitionId),
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
        icon: resolveLootIcon(entry.iconUrl, entry.icon, entry.materialId, entry.resourceId, entry.family, entry.category, "material"),
        status: "Extraído",
      }));
  }

  // Only allow icons coming from the game's asset directories, never arbitrary
  // remote URLs or values from untrusted inventory metadata.
  const GENERIC_ITEM_ICON = "Assets/Icons/items/fallback/generic_item.png";
  function lootIcon(path) {
    const value = clean(path).replace(/^\.?\//, "");
    return /^(Assets|assets)\//.test(value) && !value.includes("..") && !/["'<>]/.test(value) ? value : "";
  }
  function resolveLootIcon(...candidates) {
    const registry = global.LuminousItemIconRegistry;
    for (const candidate of candidates) {
      const explicit = lootIcon(candidate);
      if (explicit) return explicit;
      const key = clean(candidate);
      if (!key || !registry?.has?.(key)) continue;
      const icon = lootIcon(registry.resolveIcon(key, { fallback: false }));
      if (icon) return icon;
    }
    return GENERIC_ITEM_ICON;
  }

  // Accept battle sprite sources without allowing a scripted URI in img src.
  function corpseSpriteSrc(value) {
    const raw = clean(value);
    if (!raw || raw.length > 4000000 || /[<>"'\x00-\x1f]/.test(raw)) return "";
    if (/^https?:\/\/[^\s]+$/i.test(raw)) return raw;
    if (/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(raw)) return raw;
    if (/^(?!\/)(?!\.\.)(?:[a-z0-9_.-]+\/)*[a-z0-9_.-]+(?:[?#][a-z0-9_=%&.+#/-]+)?$/i.test(raw) && !raw.includes("../")) return raw;
    return "";
  }
  function corpseSpriteMarkup(url) {
    const src = corpseSpriteSrc(url);
    return src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : "✥";
  }

  function knownItemSlot(entry = {}) {
    const icon = resolveLootIcon(entry.icon);
    const name = clean(entry.name || "Objeto");
    const quantity = Math.max(1, Number(entry.quantity || 1));
    return `<button type="button" class="loot-discovery known" title="${esc(name)} · ${esc(entry.status || "Recuperado")}" aria-label="${esc(name)}, cantidad ${quantity}" data-loot-detail="${esc(name)} · ×${quantity}">
      <img src="${esc(icon)}" alt="" loading="lazy"><small>${quantity}</small>
    </button>`;
  }

  function corpseBelongingsMarkup(interaction, accessible, requests = []) {
    const slots = postCombat().corpseBelongings(interaction);
    if (!slots.length) return '<div class="loot-empty">No quedan pertenencias ni dinero.</div>';
    const lootId = interaction.lootInstanceId;
    return slots.map(slot => {
      if (!slot.revealed) return '<div class="loot-belonging unknown" aria-label="Casilla ocupada sin revelar"><strong>???</strong><span>Sin revelar</span></div>';
      const currency = slot.kind === "currency";
      const item = slot.item || {};
      const definition = currency ? {} : lootItemDefinition(slot.definitionId);
      const name = currency ? `${slot.amount.toLocaleString()} Ahn` : clean(item.displayName || item.name || definition.name || "Pertenencia");
      const icon = currency ? "" : resolveLootIcon(item.iconUrl, item.icon, definition.iconUrl, definition.icon, item.iconFamily, definition.iconFamily, slot.definitionId);
      const queued = requests.some(request => request.actionId === "collect" &&
        (currency ? request.targetCurrency === true : request.targetItemId === slot.instanceId));
      return `<div class="loot-belonging known">${icon ? `<img src="${esc(icon)}" alt="" loading="lazy">` : '<span class="loot-cash-glyph" aria-hidden="true">₳</span>'}
        <strong>${esc(name)}</strong>${currency ? "" : `<span>×${slot.quantity}</span>`}
        <button type="button" class="loot-action" data-loot-collect="${esc(lootId)}" ${currency ? 'data-target-currency="true"' : `data-target-item="${esc(slot.instanceId)}"`}
          aria-label="Recoger ${esc(name)}" ${accessible && !queued ? "" : "disabled"}>${queued ? "En espera" : "Recoger"}</button></div>`;
    }).join("");
  }

  function playerInventoryMarkup(actor = {}) {
    const inventory = global.LuminousItemInventoryRuntime;
    let snapshot;
    try { snapshot = inventory?.inventorySnapshot?.(actor) || null; } catch (_) { snapshot = null; }
    const active = snapshot?.active || [];
    let described;
    try { described = inventory?.describeInventory?.(actor) || {}; } catch (_) { described = {}; }
    const used = Number(described.activeSlots ?? active.length);
    const rawLimit = described.activeSlotLimit ?? snapshot?.activeSlotLimit;
    const limit = rawLimit == null ? null : Math.max(0, Number(rawLimit) || 0);
    const stashInfo = described.stashSlotLimit ? ` · STASH ${Number(described.stashSlots || 0)} / ${Number(described.stashSlotLimit)}` : "";
    const summary = global.document?.getElementById("postcombat-loot-inventory-summary");
    const host = global.document?.getElementById("postcombat-loot-inventory");
    const wallet = global.document?.getElementById("postcombat-loot-wallet");
    if (summary) summary.innerHTML = `<b>${used} / ${limit ?? "—"}</b> ESPACIOS OCUPADOS${stashInfo}
      <div class="loot-capacity-bar"><i style="width:${limit ? Math.min(100, used / limit * 100) : 0}%"></i></div>`;
    const capacity = global.document?.getElementById("postcombat-loot-capacity");
    if (capacity) {
      const capacityCard = (label, occupied, maximum) => {
        const free = maximum == null ? null : Math.max(0, maximum - occupied);
        return `<section class="loot-space-card"><h4>${label}</h4><p><b>${free ?? "—"}</b> ${free == null ? "Capacidad sin confirmar" : "espacios libres"}</p>
          <span>${occupied} / ${maximum ?? "—"} ocupados</span><div class="loot-capacity-bar"><i style="width:${maximum ? Math.min(100, occupied / maximum * 100) : 0}%"></i></div>
          ${free === 0 ? '<p class="loot-space-full">Sin espacio libre.</p>' : ""}</section>`;
      };
      const stashLimit = described.stashSlotLimit ?? snapshot?.stashSlotLimit;
      capacity.innerHTML = capacityCard("Inventario activo", used, limit) +
        capacityCard("Stash", Number(described.stashSlots ?? snapshot?.stash?.length ?? 0), stashLimit == null ? null : Math.max(0, Number(stashLimit) || 0)) +
        '<p class="loot-corpse-note">La entrega comprueba si cada objeto cabe según las reglas de inventario. Si una recuperación queda pendiente, podrás reintentar recogerla desde Tiradas después de liberar espacio.</p>';
    }
    if (host) {
      const slots = active.map(({ item }) => {
        let definition = {};
        try { definition = lootItemDefinition(item?.definitionId || item?.itemId); } catch (_) { /* A legacy item still gets a neutral icon. */ }
        const name = clean(item?.displayName || item?.name || item?.nombre || definition.name || "Objeto");
        const icon = resolveLootIcon(item?.iconUrl, item?.icon, item?.imageUrl, item?.image, definition.iconUrl, definition.icon, item?.iconFamily, definition.iconFamily, item?.family, definition.family, item?.category);
        const quantity = Math.max(1, Number(item?.quantity || 1));
        return `<button type="button" class="loot-pack-item" title="${esc(name)}" aria-label="${esc(name)}, cantidad ${quantity}" data-loot-detail="${esc(name)} · ×${quantity}"><img src="${esc(icon)}" alt="" loading="lazy">${quantity > 1 ? `<small>${quantity}</small>` : ""}</button>`;
      });
      const blanks = Math.max(0, Math.min(limit ?? 12, 16) - slots.length);
      host.innerHTML = slots.join("") + Array.from({ length: blanks }, () => '<div class="loot-pack-item blank" aria-hidden="true"></div>').join("");
      if (!active.length) host.insertAdjacentHTML("afterbegin", '<p class="loot-inventory-empty">Tu inventario activo está vacío.</p>');
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
    const pickerRows = [];
    const rows = [];
    const resultRows = [];

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
      const pendingRequests = Object.values(state.requests || {}).filter(request => request && request.lootInstanceId === interaction.lootInstanceId && (request.status === "pending" || request.status === "processing"));
      const pending = pendingForPlayer(interaction);
      const known = visibleDiscoveredItems(interaction, playerId);
      const anatomyKnown = bodyDiscoveredByPlayer(interaction, playerId);
      const bodyKnown = anatomyKnown ? bodyResources(interaction) : visibleRecoveredResources(interaction, playerId);
      const occupied = leasedByAnother(interaction.lootInstanceId);
      const accessible = ownsCorpse(interaction.lootInstanceId);
      const remainingRecoverable = actions.length > 0 || postCombat().corpseBelongings(interaction).length > 0 || pending.length > 0 || pendingRequests.length > 0;
      const name = clean(corpse.index.name || corpse.index.sourceUnitId || "Restos");
      const lootId = interaction.lootInstanceId;
      const spriteMarkup = corpseSpriteMarkup(corpse.index.spriteUrl || corpse.loot?.spriteUrl);
      pickerRows.push(`<option value="${esc(lootId)}" ${occupied ? "disabled" : ""}>${esc(name)}${occupied ? " · En uso" : ""}</option>`);
      navRows.push(`<button type="button" class="loot-corpse-choice${state.selectedLootId === lootId ? " active" : ""}" data-corpse-select="${esc(lootId)}">
        <span class="loot-corpse-glyph" aria-hidden="true">${spriteMarkup}</span>
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
        const requiredSkill = postCombat().lootSkillForAction?.(action) || "skill";
        const penalty = Number(postCombat().lootProficiencyPenalty?.(actor,action) || 0);
        const skillLabel = ({ investigation:"Investigation", survival:"Survival", medicine:"Medicine", arcana:"Arcana" })[requiredSkill] || titleCase(requiredSkill);
        const penaltyText = penalty ? `SIN ${esc(skillLabel.toUpperCase())} · +${penalty} TH` : "";
        const queued = pendingRequests.some(request => normalizeId(request.actionId) === action);
        return `<div class="loot-resource-group">${select}<button type="button" class="loot-action${queued ? " pending" : ""}" data-loot-action="${esc(action)}" data-loot-id="${esc(lootId)}" ${accessible && !queued ? "" : "disabled"} title="${queued ? "Esta recuperación está pendiente" : penalty ? `Sin competencia en ${esc(skillLabel)}: +${penalty} al TH` : `Skill: ${esc(skillLabel)}`}">${queued ? "En espera" : esc(actionLabel(action))}</button>${penalty && !queued ? `<small class="loot-skill-penalty">${penaltyText}</small>` : ""}</div>`;
      }).join("");
      const pendingHtml = pending.map((entry) => `<button type="button" class="loot-action pending" data-pending-id="${esc(entry.id)}" data-loot-id="${esc(lootId)}" ${accessible ? "" : "disabled"}>Recoger pendiente</button>`).join("");
      const discoverySlots = known.map(knownItemSlot).join("");
      const emptySlots = !known.length ? '<p class="loot-corpse-note">Todavía no has recogido pertenencias de estos restos.</p>' : "";
      const bodyGrid = bodyKnown.map((resource) => anatomyKnown ? bodySlot(resource) : knownItemSlot(resource)).join("");
      const bodyBlanks = anatomyKnown && !bodyKnown.length ? '<div class="loot-empty">No se encontraron materiales recuperables.</div>' :
        Array.from({length:Math.max(0, 6 - bodyKnown.length)},()=>'<div class="loot-discovery unknown" aria-hidden="true">✧</div>').join("");
      const attempts = interaction.attempts.filter(attempt => clean(attempt.actorId) === playerId);
      resultRows.push(`<article class="loot-result-card${state.selectedLootId === lootId ? " selected" : ""}" data-loot-result="${esc(lootId)}">
        <div class="loot-corpse-title"><strong>${esc(name)}</strong></div>
        <div class="loot-recovered-title">INVENTARIO DEL CADÁVER · COMPARTIDO</div>
        <p class="loot-corpse-note">Buscar revela para todos. Recoge solo lo que quieras llevarte; el resto permanece aquí.</p>
        <div class="loot-belongings-grid">${corpseBelongingsMarkup(interaction, accessible, pendingRequests)}</div>
        <div class="loot-recovered-title">TUS OBJETOS RECUPERADOS</div>
        <div class="loot-recovered-grid">${discoverySlots}${emptySlots}</div>
        <div class="loot-recovered-title">CUERPO · ${anatomyKnown ? "RECURSOS EXAMINADOS" : "SIN EXAMINAR"}</div>
        <div class="loot-recovered-grid">${bodyGrid}${bodyBlanks}</div>
        <div class="loot-recovered-title">TUS INTENTOS</div>
        ${pendingRequests.map(request => `<p class="loot-queue-status">${esc(actionLabel(request.actionId))} · Pendiente de validación</p>`).join("")}
        ${pending.length ? '<p class="loot-queue-status">Tienes entregas pendientes. Revisa Espacio y vuelve a Tiradas para recogerlas.</p>' : ""}
        ${attempts.length ? `<ol class="loot-attempts">${attempts.slice().reverse().map(attempt => `<li><strong>${esc(actionLabel(attempt.actionId))}</strong><span>${attempt.actionId === "collect" ? "Recogido" : attempt.success === true ? "Éxito" : "Sin éxito"}${attempt.actionId !== "collect" && Number.isFinite(attempt.total) && Number.isFinite(attempt.threshold) ? ` · ${attempt.total} / TH ${attempt.threshold}` : ""}</span></li>`).join("")}</ol>` : '<p class="loot-corpse-note">Todavía no has completado tiradas en estos restos.</p>'}
      </article>`);
      rows.push(`<article class="loot-corpse${state.selectedLootId === lootId ? " selected" : ""}" data-loot-card="${esc(lootId)}">
        <div class="loot-corpse-title"><strong>${esc(name)}</strong><span>${pending.length ? "ENTREGA PENDIENTE" : remainingRecoverable ? "RECUPERACIÓN POSIBLE" : "SIN ACCIONES DISPONIBLES"}</span></div>
        <p class="loot-corpse-note">${interaction.belongingsRevealed === true ? "Pertenencias reveladas para todos. Abre Cadáver para recogerlas." : "Buscar revela las pertenencias para todos. Sustraer recupera algo al azar sin revelar el resto."}</p>
        ${pendingRequests.length ? `<p class="loot-queue-status" role="status">${pendingRequests.length} recuperación${pendingRequests.length === 1 ? "" : "es"} pendiente${pendingRequests.length === 1 ? "" : "s"} de validación. Puedes salir y volver después.</p>` : ""}
        <div class="loot-action-title">ACCIONES DISPONIBLES ${occupied ? "· OCUPADO POR OTRO PERSONAJE" : accessible ? "· TU TURNO" : "· SELECCIONA ESTE CADÁVER"}</div>
        <div class="loot-actions">${resourceActionMarkup}${pendingHtml || ""}</div>
        ${accessible ? `<button type="button" class="loot-release" data-corpse-release="${esc(lootId)}">SOLTAR CADÁVER</button>` : ""}
        ${!actions.length && !pending.length ? '<div class="loot-empty">No quedan acciones para este personaje en estos restos.</div>' : ""}
      </article>`);
    }

    if (!state.selectedLootId || !corpses.some((corpse) => corpse.interaction?.lootInstanceId === state.selectedLootId)) {
      state.selectedLootId = corpses.find((corpse) => corpse.interaction?.lootInstanceId)?.interaction?.lootInstanceId || null;
    }
    const chosenCorpse = corpses.find(corpse => corpse.interaction?.lootInstanceId === state.selectedLootId);
    const badgeSprite = global.document.getElementById("postcombat-loot-selected-sprite");
    if (badgeSprite) badgeSprite.innerHTML = corpseSpriteMarkup(chosenCorpse?.index?.spriteUrl || chosenCorpse?.loot?.spriteUrl);
    list.innerHTML = rows.length ? rows.join("") : '<div class="loot-empty">No se encontraron restos disponibles para este encuentro.</div>';
    const results = global.document.getElementById("postcombat-loot-results");
    if (results) results.innerHTML = resultRows.length ? resultRows.join("") : '<div class="loot-empty">No hay resultados disponibles.</div>';
    // The first render chooses a corpse after building the cards. Keep both panels in sync.
    for (const host of [list, results]) host?.querySelectorAll("[data-loot-card], [data-loot-result]").forEach(card => card.classList.toggle("selected", (card.dataset.lootCard || card.dataset.lootResult) === state.selectedLootId));
    nav.innerHTML = navRows.join("");
    const picker = global.document.getElementById("postcombat-loot-corpse-picker");
    if (picker) {
      picker.innerHTML = pickerRows.join("");
      picker.value = state.selectedLootId || "";
      picker.disabled = !pickerRows.length;
    }
    nav.querySelectorAll("[data-corpse-select]").forEach((button) => {
      button.classList.toggle("active", button.dataset.corpseSelect === state.selectedLootId);
      button.addEventListener("click", () => {
        selectCorpse(button.dataset.corpseSelect);
      });
    });
    for (const host of [list, results, global.document.getElementById("postcombat-loot-inventory")]) {
      host?.querySelectorAll?.("[data-loot-detail]").forEach(button => button.addEventListener("click", () => setMessage(button.dataset.lootDetail || "Objeto")));
      host?.querySelectorAll?.("[data-loot-detail] img[src]").forEach(image => image.addEventListener("error", () => {
        if (!image.src.endsWith("/fallback/generic_item.png")) image.src = GENERIC_ITEM_ICON;
      }, { once: true }));
    }
    list.querySelectorAll("[data-corpse-release]").forEach(button => {
      button.addEventListener("click", () => {
        if (state.busy) {setMessage("Finaliza la tirada antes de soltar el cadáver.",true);return;}
        leaveCorpse().then(()=>render()).catch(error=>showLootError(error));
      });
    });
    list.querySelectorAll("[data-loot-action]").forEach((button) => {
      button.addEventListener("click", () => runAction(button).catch((error) => showLootError(error)));
    });
    results?.querySelectorAll("[data-loot-collect]").forEach(button => {
      button.addEventListener("click", () => collectBelonging(button).catch(error => showLootError(error)));
    });
    list.querySelectorAll("[data-pending-id]").forEach((button) => {
      button.addEventListener("click", () => claimPending(button).catch((error) => showLootError(error)));
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
    selectTab("actions");
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
      // The exclusive corpse lease was authorized by Firebase in enterCorpse().
      // Revalidate ownership for every roll, overlapping the authorization read
      // with the coin animation instead of serializing independent WAN work.
      // The DM authority also checks ownership and participation before delivery.
      const accessPromise = live().checkPlayerLootAccess({db:state.db,playerId,lootInstanceId})
        .then(() => ({ok:true}), error => ({ok:false,error}));
      const playerSnap = await state.db.ref(`campaña/jugadores/${playerId}`).once("value");
      const actor = clone(playerSnap.val() || {});
      actor.id = actor.id || playerId;
      let checkResult;
      try { checkResult = await animatedCheck(actor, actionId, { targetResourceId }); }
      catch (error) { await accessPromise; throw error; }
      const access = await accessPromise;
      if (!access.ok) throw access.error;
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

      if (result.queued) {
        setMessage("Acción guardada. El DM la revisará al conectarse; si caduca la reserva del cadáver, tendrás que intentarlo de nuevo.", false);
      } else if (!result.committed) {
        setMessage("Otro intento ya resolvió esta acción o el recurso dejó de estar disponible.", true);
      } else if (result.delivery && !result.delivery.delivered) {
        setMessage("La recuperación quedó reservada. Libera espacio en Inventario o Stash y usa «Recoger pendiente».", false);
      } else if (result.check?.success) {
        const itemCount = result.materialized?.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;
        const ahn = Number(result.materialized?.currency?.amount || 0);
        const parts = [itemCount ? `${itemCount} unidad(es) recuperadas` : "", ahn ? `${ahn.toLocaleString()} Ahn` : ""].filter(Boolean);
        if (actionId === "search") {
          setMessage("Pertenencias y dinero revelados para todos. Elige qué recoger en Cadáver.");
          selectTab("results");
        } else setMessage(parts.length ? `Éxito · ${parts.join(" · ")}.` : "Éxito · nueva información añadida al Compendium.");
      } else {
        setMessage("La acción no tuvo éxito. El cadáver no generó botín nuevo; simplemente no recuperaste nada con este intento.");
      }
      await refreshEncounters();
    } finally {
      state.busy = false;
    }
  }

  async function collectBelonging(button) {
    if (state.busy) return;
    const lootInstanceId = clean(button.dataset.lootCollect);
    if (!ownsCorpse(lootInstanceId)) throw Error("Reserva este cadáver antes de recoger sus pertenencias.");
    state.busy = true;
    try {
      const result = await live().requestAction({db: state.db, playerId: resolvePlayerId(), lootInstanceId,
        actionId: "collect", targetItemId: clean(button.dataset.targetItem) || undefined,
        targetCurrency: button.dataset.targetCurrency === "true"});
      if (result.queued) setMessage("Recogida guardada, pendiente de validación.");
      else if (!result.committed) setMessage("Esa pertenencia ya fue recogida o está reservada.", true);
      else if (result.delivery && !result.delivery.delivered) setMessage("Recogida reservada. Libera espacio y usa «Recoger pendiente» en Tiradas.");
      else setMessage("Recogido. Las demás pertenencias permanecen en el cadáver.");
      await refreshEncounters();
    } finally { state.busy = false; }
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
      if (result.queued) setMessage("Recogida solicitada. Quedará pendiente hasta que vuelva el DM.");
      else if (result.delivered) setMessage(result.duplicate ? "La recuperación ya estaba acreditada; se confirmó sin duplicarla." : "Recuperación pendiente entregada.");
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
    state.returnFocus = global.document.activeElement;
    selectTab("actions");
    state.open = true;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    modal.querySelector(".loot-close")?.focus();
    render().then(() => {
      const id = state.selectedLootId;
      if (state.open && id && !ownsCorpse(id)) return enterCorpse(id);
    }).catch((error) => showLootError(error));
  }

  function close() {
    if (state.busy) {setMessage("Termina la recuperación antes de cerrar.",true);return;}
    state.open = false;
    state.renderGeneration++;
    leaveCorpse().catch(() => {});
    const modal = global.document?.getElementById(MODAL_ID);
    modal?.classList.remove("open");
    modal?.setAttribute("aria-hidden", "true");
    if (state.returnFocus?.isConnected) state.returnFocus.focus();
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
      if (state.open) render().catch((error) => showLootError(error));
      maybeOpenResult();
    };
    ref.on("value", handler);
    state.listeners.push(() => ref.off("value", handler));
    const leasesRef = state.db.ref(live().ROOTS.claims);
    const onLease = snap => {state.claims=snap.val()||{};if (state.open) render().catch(()=>{});};
    leasesRef.on("value",onLease);
    state.listeners.push(()=>leasesRef.off("value",onLease));
    const requestsRef = state.db.ref(`${live().ROOTS.requests}/${resolvePlayerId()}`);
    const onRequests = snapshot => { state.requests = snapshot.val() || {}; if (state.open) render().catch(error => showLootError(error)); };
    requestsRef.on("value", onRequests);
    state.listeners.push(() => requestsRef.off("value", onRequests));
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
    state.listeners.splice(0).forEach(off=>off());close();state.encounters={};state.combatState={};state.instance=null;state.autoOpened=null;state.selectedLootId=null;state.claim=null;state.claims={};state.requests={};
    // RTDB rejects the loot listeners when they subscribe before Auth finishes.
    if (!global.firebase?.auth?.().currentUser) return false;
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
    let authOff = null;
    let timer = null;
    const attempt = () => {
      if (!global.firebase?.database || !resolvePlayerId() || !live()) return false;
      const auth = global.firebase?.auth?.();
      if (!auth?.currentUser) {
        // Auth often hydrates after the character page; resume without opening
        // unauthenticated realtime listeners or imposing a 30-second login limit.
        if (!authOff && typeof auth?.onAuthStateChanged === "function") {
          authOff = auth.onAuthStateChanged((user) => {
            if (user && attempt()) {
              if (timer) global.clearInterval(timer);
              authOff?.();
              authOff = null;
            }
          });
        }
        return false;
      }
      install().catch((error) => global.console?.error?.("[PostCombat Loot]", error));
      return true;
    };
    if (attempt()) return;
    let tries = 0;
    timer = global.setInterval(() => {
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
    collectBelonging,
  });

  if (global.document?.readyState === "loading") global.document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})(window);

