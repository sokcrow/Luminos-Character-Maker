(function (global) {
  "use strict";
  if (global.LuminousCreatureCompendium) return;
  const state = {open: false, busy: false, loading: false, sources: [], selected: "", player: {}, db: null, playerId: ""};
  const clean = value => String(value ?? "").trim();
  const esc = value => clean(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const live = () => global.LuminousLootLivePostCombatRuntime;
  const knowledge = () => global.LuminousLootKnowledgeRuntime;
  const unitId = unit => live().canonicalUnitId(unit);
  const factsFor = id => Object.values(state.player.compendium?.units?.[id]?.facts || {});
  const descriptionFor = id => factsFor(id).find(fact => fact.id === "lore.basic_description")?.value;
  function combatWindow() {
    if (global.LuminousCombat073) return global;
    for (const id of ["mirror-view", "combat-entry-view"]) {
      try {
        const viewer = global.document?.getElementById(id)?.contentWindow;
        if (viewer?.LuminousCombat073 || viewer?.LuminousCombatLiveAdapter073?.state) return viewer;
      } catch (_) { /* An unavailable or foreign frame cannot supply encounter context. */ }
    }
    return global;
  }
  function resolveContext(options = {}) {
    const viewer = combatWindow(), adapter = viewer.LuminousCombatLiveAdapter073?.state;
    const loot = global.LuminousPlayerPostCombatLoot?.state;
    const scope = options.db ? [adapter, loot].find(source => source?.db === options.db)
      : adapter?.db ? adapter : loot?.db ? loot : null;
    const own = scope === adapter && adapter?.uid ? Object.entries(adapter.players || {}).find(([,player]) =>
      [player.uid, player.vinculado_a, player.vinculo_jugador].includes(adapter.uid))?.[0] : "";
    const fallbackPlayer = !scope && !options.db
      ? global.localStorage?.getItem("playerId") || global.datosJugador?.playerId || global.datosJugador?.id : "";
    return {
      db: options.db || scope?.db || global.firebase?.database?.(),
      playerId: clean(options.playerId || scope?.playerId || own || fallbackPlayer),
      user: adapter?.user || viewer.firebase?.auth?.().currentUser || global.firebase?.auth?.().currentUser,
      runtime: viewer.LuminousCombat073 || null,
    };
  }
  const isRunning = () => combatWindow().LuminousCombat073?.uiState?.().running === true;
  let returnFocus = null;

  function ensureModal() {
    let modal = global.document.getElementById("creature-compendium");
    if (modal) return modal;
    const style = global.document.createElement("style");
    style.textContent = `
      #creature-compendium{position:fixed;inset:0;z-index:2147483600;background:#07090cdd;display:grid;place-items:center;padding:16px;box-sizing:border-box;color:#eee9de;font:16px/1.5 Arial,sans-serif}
      #creature-compendium[hidden]{display:none!important}
      #creature-compendium *{box-sizing:border-box}
      #creature-compendium .creature-book{width:min(850px,100%);max-height:calc(100dvh - 32px);display:flex;flex-direction:column;background:#171b20;border:1px solid #a18c55;border-radius:12px;overflow:hidden;box-shadow:0 16px 65px #0009}
      #creature-compendium header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;border-bottom:1px solid #464130}
      #creature-compendium h2,#creature-compendium h3{margin:0;color:#e5d19a}
      #creature-compendium button,#creature-compendium select{font:inherit;min-height:44px;border:1px solid #8e7c50;border-radius:6px;background:#282820;color:#fff;padding:9px 14px;max-width:100%}
      #creature-compendium button{cursor:pointer}#creature-compendium button:disabled{opacity:.55;cursor:default}
      #creature-compendium :focus-visible{outline:3px solid #e8cd83;outline-offset:2px}
      #creature-compendium .creature-content{padding:18px 20px;overflow:auto;overscroll-behavior:contain;min-height:0;overflow-wrap:anywhere}
      #creature-compendium select{width:100%;margin:6px 0 18px}
      #creature-compendium .creature-description{white-space:pre-wrap}
      #creature-compendium .creature-controls{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin:16px 0}
      #creature-compendium .creature-status{color:#e5d19a;min-height:24px}
      #creature-compendium .creature-coins{display:flex;gap:8px;flex-wrap:wrap;min-height:4px}
      #creature-compendium .creature-coins img{max-width:40px;max-height:40px}
      #creature-compendium .creature-known{border-top:1px solid #464130;margin-top:20px;padding-top:14px}
      @media(max-width:600px){#creature-compendium{padding:8px;padding-bottom:max(8px,env(safe-area-inset-bottom))}#creature-compendium .creature-book{max-height:calc(100dvh - 16px)}#creature-compendium header,#creature-compendium .creature-content{padding:12px}#creature-compendium h2{font-size:21px}#creature-compendium .creature-controls button{width:100%}}
      @media(prefers-reduced-motion:reduce){#creature-compendium *{animation:none!important;transition:none!important}}
    `;
    global.document.head.appendChild(style);
    modal = global.document.createElement("div");
    modal.id = "creature-compendium";
    modal.hidden = true;
    modal.innerHTML = `<section class="creature-book" role="dialog" aria-modal="true" aria-labelledby="creature-book-title"><header><h2 id="creature-book-title">Compendio de criaturas</h2><button type="button" data-creature-close aria-label="Cerrar Compendio">×</button></header><div class="creature-content"><div data-creature-body></div><div class="creature-coins" data-creature-coins></div><p class="creature-status" role="status" aria-live="polite"></p></div></section>`;
    modal.querySelector("[data-creature-close]").onclick = close;
    modal.onclick = event => {if (event.target === modal) close();};
    modal.addEventListener("keydown", event => {
      if (event.key === "Escape") {event.preventDefault(); close();}
      if (event.key !== "Tab") return;
      const nodes = [...modal.querySelectorAll("button:not(:disabled),select:not(:disabled)")].filter(node => node.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && global.document.activeElement === first) {event.preventDefault(); last?.focus();}
      else if (!event.shiftKey && global.document.activeElement === last) {event.preventDefault(); first?.focus();}
    });
    global.document.body.appendChild(modal);
    return modal;
  }

  function message(text) {ensureModal().querySelector(".creature-status").textContent = text;}
  function knownBodyMarkup(id) {
    const facts = factsFor(id), lines = [];
    const labels = {organic:"Biológico",construct:"Constructo",mineral:"Rocoso",plant:"Vegetal",ooze:"Cieno",synthetic:"Sintético",ethereal:"Etéreo",mixed:"Mixto",
      flesh:"Carne",blood:"Sangre",bone:"Hueso",hide:"Piel",pelt:"Pelaje",scale:"Escamas",chitin:"Quitina",shell:"Caparazón",metal:"Metal",mechanical:"Mecánico",stone:"Piedra",wood:"Madera",crystal:"Cristal",gel:"Gel",fiber:"Fibra",feather:"Plumas"};
    for (const fact of facts) {
      if (fact.id === "biology.body_kind") lines.push(`<p>Cuerpo: ${esc(labels[fact.value] || "Estudiado")}</p>`);
      if (fact.id === "biology.materials") lines.push(`<p>Materiales: ${esc((fact.value || []).map(value => labels[value] || "Otro material").join(", "))}</p>`);
      if (fact.id === "biology.edible") lines.push(`<p>${fact.value ? "Se conocen recursos comestibles." : "Cuerpo no comestible."}</p>`);
      if (fact.id === "biology.harvestable_resources") lines.push(`<p>${(fact.value || []).length} tipos de recursos estudiados.</p>`);
    }
    return lines.length ? `<section class="creature-known"><h3>Anatomía conocida</h3>${lines.join("")}</section>` : "";
  }

  function render() {
    const body = ensureModal().querySelector("[data-creature-body]");
    if (!state.sources.length) {body.innerHTML = '<p>Aún no has registrado criaturas. Podrás consultar las que encuentres en combate o al explorar sus restos.</p>'; return;}
    if (!state.sources.some(unit => unitId(unit) === state.selected)) state.selected = unitId(state.sources[0]);
    const unit = state.sources.find(row => unitId(row) === state.selected), description = descriptionFor(state.selected);
    const attempt = state.player.compendium?.historyAttempts?.[attemptKey(state.selected)];
    body.innerHTML = `<label for="creature-book-select">Criatura</label><select id="creature-book-select" ${state.busy ? "disabled" : ""}>${state.sources.map(row => `<option value="${esc(unitId(row))}" ${unitId(row) === state.selected ? "selected" : ""}>${esc(row.name || "Criatura registrada")}</option>`).join("")}</select><h3>${esc(description?.name || unit.name || "Criatura")}</h3><p class="creature-description">${esc(description?.description || "Descripción básica aún no descubierta.")}</p><div class="creature-controls"><button type="button" data-creature-history ${description || attempt || state.busy || isRunning() ? "disabled" : ""}>${description ? "Descripción conocida" : attempt ? "Historia ya intentada" : "Recordar · Historia"}</button><span>Historia (INT) · 5 Coins</span></div>${knownBodyMarkup(state.selected)}`;
    body.querySelector("select").onchange = event => {state.selected = event.target.value;message("");render();};
    body.querySelector("[data-creature-history]").onclick = () => recall().catch(error => message(error.message || "No se pudo consultar la criatura."));
  }

  function attemptKey(id) {
    const encounterId = state.encounterId || "exploration";
    return live().safeKey(`${encounterId}:${id}`);
  }

  async function recall() {
    if (state.busy || state.loading || isRunning()) return;
    state.busy = true;
    const id = state.selected, unit = state.sources.find(row => unitId(row) === id);
    const key = attemptKey(id);
    try {
      if (!knowledge().basicDescription(unit)) {message("Esta criatura todavía no tiene una descripción básica disponible.");return;}
      render(); message("Recordando…");
      const actorSnap = await state.db.ref(`campaña/jugadores/${state.playerId}`).once("value");
      const actor = actorSnap.val() || {};
      const definition = global.LuminousLootPostCombatRuntime.checkDefinition(actor, "history");
      const check = global.LuminousCoinEngine?.runAnimatedRoll
        ? await global.LuminousLootCheckRuntime.rollCheckWithCoinEngine(definition, {container:ensureModal().querySelector("[data-creature-coins]"),auto:true,intervalMs:180})
        : global.LuminousLootCheckRuntime.rollCheck(definition);
      const facts = knowledge().basicDescriptionFacts(unit, check, {discoveredBy:state.playerId,discoveredAt:Date.now(),provenance:{encounterId:state.encounterId || null}});
      const tx = await live().transactionValue(state.db.ref(`campaña/jugadores/${state.playerId}/compendium`), raw => {
        if (raw?.historyAttempts?.[key]) return undefined;
        const base = raw || knowledge().createCompendium(state.playerId);
        for (const entry of Object.values(base.units || {})) entry.facts = Object.fromEntries(Object.values(entry.facts || {}).map(fact => [fact.id,fact]));
        const merged = JSON.parse(JSON.stringify(knowledge().mergeFacts(base,id,facts)));
        merged.historyAttempts = {...merged.historyAttempts,[key]:{success:check.success,total:check.total,threshold:check.threshold}};
        for (const entry of Object.values(merged.units || {})) entry.facts = Object.fromEntries(Object.values(entry.facts || {}).map(fact => [encodeURIComponent(fact.id).replace(/\./g,"%2E"),fact]));
        return merged;
      });
      state.player.compendium = tx.snapshot?.val?.() || state.player.compendium;
      message(!tx.committed ? "Ya habías intentado recordar esta criatura." : !check.success ? `Historia: ${check.total}/${check.threshold}. No recuerdas más información.` : facts.length ? `Historia: ${check.total}/${check.threshold}. Descripción añadida al Compendio.` : "Superaste Historia, pero esta criatura todavía no tiene una descripción básica registrada.");
    } finally {state.busy = false;render();}
  }

  async function open(options = {}) {
    if (state.busy || state.loading) return;
    state.loading = true;
    returnFocus = global.document.activeElement;
    const modal = ensureModal(); modal.hidden = false; state.open = true;
    modal.querySelector("[data-creature-body]").innerHTML = "";
    modal.querySelector("[data-creature-coins]").innerHTML = "";
    modal.querySelector("[data-creature-close]").focus();
    message("Cargando Compendio…");
    try {
      await live().ensureDependencies();
      const context = resolveContext(options);
      state.db = context.db;
      state.playerId = context.playerId;
      if (!state.db || !state.playerId || !context.user) throw Error("Entra con tu personaje para abrir el Compendio.");
      const [player, combat, encounters] = await Promise.all([
        state.db.ref(`campaña/jugadores/${state.playerId}`).once("value"),
        state.db.ref("campaña/combate/estado").once("value"),
        state.db.ref("campaña/loot_encounters").once("value"),
      ]);
      state.player = player.val() || {};
      const combatState = combat.val() || {};
      state.encounterId = combatState.encounterId || null;
      const sources = new Map();
      const add = unit => {const id = unitId(unit);if(id) sources.set(id,unit);};
      for (const id of Object.keys(state.player.compendium?.units || {})) add({libraryUnitId:id});
      for (const row of Object.values(encounters.val() || {})) {
        if (row.meta?.participants?.[state.playerId] !== true) continue;
        for (const corpse of Object.values(row.corpses || {})) add({libraryUnitId:corpse.sourceUnitId,name:corpse.name});
      }
      const combatants = context.runtime?.combatants?.() || {};
      for (const unit of Object.values(combatants)) {
        if (unit.faction === "enemy" && unit.battleActive !== false && !unit.isBackup && !unit.escaped) add(unit);
      }
      if (options.unit && Object.values(combatants).includes(options.unit)) add(options.unit);
      state.sources = await Promise.all([...sources.values()].map(async unit => {
        const snapshot = await state.db.ref(`campaña/base_datos_unidades/${live().safeKey(unitId(unit))}`).once("value");
        return {...unit,...(snapshot.val() || {}),libraryUnitId:unitId(unit)};
      }));
      state.selected = options.unit ? unitId(options.unit) : state.selected;
      render();message(isRunning() ? "Puedes leer el Compendio. Espera a Planning para usar Historia." : "Consulta lo aprendido o usa Historia para recordar su descripción básica.");
    } catch (error) {message(error.message || "No se pudo abrir el Compendio.");}
    finally {state.loading = false;}
  }
  function close() {if(state.busy)return;state.open=false;ensureModal().hidden=true;returnFocus?.focus?.();}
  function install() {
    if (!global.document || !live() || global.document.getElementById("btn-creature-compendium")) return false;
    const anchor = global.document.getElementById("btn-global-inventory");
    const parent = anchor?.parentElement || global.document.querySelector("#combat-entry-menu nav") || global.document.getElementById("mirror-bar");
    if (!parent) return false;
    const button = global.document.createElement("button");button.id="btn-creature-compendium";button.type="button";button.className="hud-menu-item";button.textContent="Compendio";
    button.style.minHeight="44px";button.onclick=()=>open();parent.appendChild(button);return true;
  }
  global.LuminousCreatureCompendium = Object.freeze({state,open,close,install,recall,resolveContext,isRunning});
  if (global.document) {
    if (!install()) {let tries=0;const timer=global.setInterval(()=>{if(install()||++tries>120)global.clearInterval(timer);},250);}
  }
})(typeof window !== "undefined" ? window : globalThis);

