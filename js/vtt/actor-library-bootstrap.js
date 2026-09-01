export function start({ runtime = window.LuminousVttRuntime, mapData = runtime?.engine?.mapData } = {}) {
  if (!runtime?.engine || !runtime?.tokenStateBridge || !runtime.bridge?.isDm || !mapData) return null;
  const actors = window.LuminousVttActorLibrary;
  const stateApi = window.LuminousVttActorLibraryState;
  if (!actors || !stateApi) return null;

  const engine = runtime.engine;
  const tokenBridge = runtime.tokenStateBridge;
  const imageCache = new Map();
  const cardNodes = new Map();
  let filter = 'all';
  let search = '';
  let selectedActorKey = '';
  let lastListSignature = '';
  const libraryBridge = stateApi.createBridge({ onChanged: (list) => renderList(list) });

  function tokenImage(token) {
    const url = String(token?.tokenImage || token?.portrait || '').trim();
    if (!url || typeof Image === 'undefined') return null;
    let entry = imageCache.get(url);
    if (!entry) {
      const image = new Image();
      entry = { image, ready: false };
      image.onload = () => { entry.ready = true; };
      image.onerror = () => { entry.failed = true; };
      image.src = url;
      imageCache.set(url, entry);
    }
    return entry.ready ? entry.image : null;
  }

  const originalPersonIcon = engine.renderer.drawPersonIcon.bind(engine.renderer);
  engine.renderer.drawPersonIcon = function actorTokenImage(token, radius) {
    const image = tokenImage(token);
    if (!image) return originalPersonIcon(token, radius);
    const ctx = engine.renderer.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(token.x, token.y, radius * 0.92, 0, Math.PI * 2);
    ctx.clip();
    const size = radius * 1.84;
    ctx.drawImage(image, token.x - size / 2, token.y - size / 2, size, size);
    ctx.restore();
  };

  function injectUi() {
    if (document.getElementById('vtt-actor-library-toggle')) return;
    const style = document.createElement('style');
    style.id = 'vtt-actor-library-style';
    style.textContent = `
      .vtt-actor-library-toggle{position:fixed;left:105px;top:18px;z-index:33000}.vtt-actor-library{position:fixed;right:18px;top:62px;z-index:32980;width:330px;max-height:calc(100vh - 82px);overflow:auto;background:#101010;color:#fff;border:2px solid #fff;padding:12px;font:12px monospace;box-shadow:6px 6px 0 #000}.vtt-actor-library[hidden]{display:none}.vtt-actor-library header{display:flex;justify-content:space-between;align-items:center}.vtt-actor-filters{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}.vtt-actor-library input,.vtt-actor-library select{background:#070707;color:#fff;border:1px solid #777;padding:6px}.vtt-actor-card{display:grid;grid-template-columns:44px 1fr;gap:8px;align-items:center;border:1px solid #555;margin:6px 0;padding:6px;cursor:grab;background:#151515}.vtt-actor-card:active{cursor:grabbing}.vtt-actor-thumb{width:40px;height:40px;border-radius:50%;background:#222;object-fit:cover;border:2px solid #777}.vtt-actor-card small{color:#aaa}.vtt-actor-empty{padding:10px;color:#aaa;border:1px dashed #555}
    `;
    document.head.appendChild(style);
    const toggle = document.createElement('button');
    toggle.id = 'vtt-actor-library-toggle';
    toggle.className = 'brutalist-button vtt-actor-library-toggle';
    toggle.textContent = 'ACTORS';
    document.body.appendChild(toggle);
    const panel = document.createElement('aside');
    panel.id = 'vtt-actor-library-panel';
    panel.className = 'vtt-actor-library';
    panel.hidden = true;
    panel.innerHTML = `<header><strong>ACTOR / TOKEN LIBRARY</strong><button type="button" class="brutalist-button" data-actor-close>×</button></header><div class="vtt-actor-filters"><input data-actor-search placeholder="Search actor"><select data-actor-filter><option value="all">ALL</option><option value="player">PLAYERS</option><option value="npc">NPCS</option><option value="enemy">ENEMIES</option><option value="boss">BOSSES</option><option value="ally">ALLIES</option><option value="object">OBJECTS</option><option value="vehicle">VEHICLES</option></select></div><small>Drag an actor onto the map. Right-click a spawned NPC/enemy token to remove it.</small><div id="vtt-actor-list"></div>`;
    document.body.appendChild(panel);
    toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) renderList(); });
    panel.querySelector('[data-actor-close]')?.addEventListener('click', () => { panel.hidden = true; });
    panel.querySelector('[data-actor-search]')?.addEventListener('input', (event) => { search = String(event.target.value || '').trim().toLowerCase(); renderList(); });
    panel.querySelector('[data-actor-filter]')?.addEventListener('change', (event) => { filter = event.target.value; renderList(); });
  }

  function actorsVisible(source = libraryBridge.list()) {
    return (source || []).filter((actor) => {
      if (filter !== 'all' && actor.category !== filter) return false;
      if (search && !`${actor.name} ${actor.actorId} ${actor.category}`.toLowerCase().includes(search)) return false;
      return true;
    });
  }

  function actorCardSignature(actor) {
    return JSON.stringify([actor.key, actor.name, actor.category, actor.scope, actor.portrait || '']);
  }

  function listSignature(list = []) {
    return JSON.stringify((list || []).map((actor) => actorCardSignature(actor)));
  }

  function makeThumb(actor) {
    if (actor.portrait) {
      const image = document.createElement('img');
      image.className = 'vtt-actor-thumb';
      image.alt = '';
      image.dataset.actorThumb = '1';
      image.dataset.actorSrc = actor.portrait;
      image.src = actor.portrait;
      return image;
    }
    const fallback = document.createElement('div');
    fallback.className = 'vtt-actor-thumb';
    fallback.dataset.actorThumb = '1';
    return fallback;
  }

  function createActorCard(actor) {
    const card = document.createElement('article');
    card.className = 'vtt-actor-card';
    card.draggable = true;
    card.dataset.actorKey = actor.key;
    card.appendChild(makeThumb(actor));

    const info = document.createElement('div');
    const name = document.createElement('strong');
    name.dataset.actorName = '1';
    const br = document.createElement('br');
    const meta = document.createElement('small');
    meta.dataset.actorMeta = '1';
    info.append(name, br, meta);
    card.appendChild(info);

    card.addEventListener('dragstart', (event) => {
      selectedActorKey = card.dataset.actorKey;
      event.dataTransfer?.setData('text/x-luminous-actor', selectedActorKey);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    });
    cardNodes.set(actor.key, card);
    return card;
  }

  function updateActorCard(card, actor) {
    card.dataset.actorKey = actor.key;
    const name = card.querySelector('[data-actor-name]');
    const meta = card.querySelector('[data-actor-meta]');
    if (name && name.textContent !== actor.name) name.textContent = actor.name;
    const metaText = `${actor.category.toUpperCase()} · ${actor.scope}`;
    if (meta && meta.textContent !== metaText) meta.textContent = metaText;

    let thumb = card.querySelector('[data-actor-thumb]');
    if (actor.portrait) {
      if (!(thumb instanceof HTMLImageElement)) {
        const replacement = makeThumb(actor);
        thumb?.replaceWith(replacement);
        thumb = replacement;
      } else if (thumb.dataset.actorSrc !== actor.portrait) {
        thumb.dataset.actorSrc = actor.portrait;
        thumb.src = actor.portrait;
      }
    } else if (thumb instanceof HTMLImageElement) {
      const replacement = makeThumb(actor);
      thumb.replaceWith(replacement);
    }
    card.dataset.actorRender = actorCardSignature(actor);
  }

  function renderList(source = libraryBridge.list()) {
    const node = document.getElementById('vtt-actor-list');
    if (!node) return;
    const list = actorsVisible(source);
    const signature = listSignature(list);
    if (signature === lastListSignature) return;
    lastListSignature = signature;

    const wanted = new Set(list.map((actor) => actor.key));
    for (const [key, card] of [...cardNodes.entries()]) {
      if (wanted.has(key)) continue;
      card.remove();
      cardNodes.delete(key);
    }

    let empty = node.querySelector('[data-actor-empty]');
    if (!list.length) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'vtt-actor-empty';
        empty.dataset.actorEmpty = '1';
        empty.textContent = 'No actors match this filter.';
        node.appendChild(empty);
      }
      return;
    }
    empty?.remove();

    list.forEach((actor, index) => {
      let card = cardNodes.get(actor.key);
      if (!card) card = createActorCard(actor);
      if (card.dataset.actorRender !== actorCardSignature(actor)) updateActorCard(card, actor);
      const expected = node.children[index] || null;
      if (expected !== card) node.insertBefore(card, expected);
    });
  }

  function existingPlayerToken(actor) {
    return (mapData.tokens || []).find((token) => actor.category === 'player' && (String(token.canonicalPlayerKey || token.playerId || '') === String(actor.playerId || actor.sourceId)));
  }

  async function placeActor(actor, point) {
    if (!actor) return;
    const existing = existingPlayerToken(actor);
    if (existing) {
      const snapped = actors.snap(point, mapData);
      existing.x = snapped.x; existing.y = snapped.y;
      existing.zLayer = Number(engine.activeZ) || 0;
      existing.z = [existing.zLayer];
      existing.gridPosition = { col: snapped.col, row: snapped.row, z: existing.zLayer };
      await tokenBridge.saveToken(existing);
      return existing;
    }
    const token = actors.tokenFromActor(actor, point, mapData, engine.activeZ);
    if (actor.category === 'player') {
      mapData.tokens ||= [];
      mapData.tokens.push(token);
      await tokenBridge.saveToken(token);
    } else {
      await tokenBridge.createWorldToken(token);
    }
    return token;
  }

  function onDragOver(event) {
    if (!selectedActorKey && !event.dataTransfer?.types?.includes('text/x-luminous-actor')) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  async function onDrop(event) {
    const key = event.dataTransfer?.getData('text/x-luminous-actor') || selectedActorKey;
    selectedActorKey = '';
    if (!key) return;
    event.preventDefault();
    const actor = libraryBridge.get(key);
    if (!actor) return;
    try {
      const token = await placeActor(actor, engine.eventWorldPoint(event));
      runtime.controller?.notify?.(`${token?.name || actor.name} placed.`, 'success');
    } catch (error) {
      runtime.controller?.notify?.(`Could not place actor: ${String(error.message || error)}`, 'error');
    }
  }

  async function onContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();

    const token = engine.tokenAtEvent(event);
    if (!token?.dynamicActorToken || token.canonicalScope !== 'world') return;
    if (!window.confirm(`Remove ${token.name || token.id} from this map?`)) return;
    try { await tokenBridge.deleteWorldToken(token.id); runtime.controller?.notify?.('Token removed.', 'success'); }
    catch (error) { runtime.controller?.notify?.(String(error.message || error), 'error'); }
  }

  injectUi();
  libraryBridge.start();
  renderList();
  engine.canvas.addEventListener('dragover', onDragOver);
  engine.canvas.addEventListener('drop', onDrop);
  engine.canvas.addEventListener('contextmenu', onContextMenu);

  const api = Object.freeze({
    libraryBridge,
    placeActor,
    stop() {
      libraryBridge.stop();
      engine.canvas.removeEventListener('dragover', onDragOver);
      engine.canvas.removeEventListener('drop', onDrop);
      engine.canvas.removeEventListener('contextmenu', onContextMenu);
      engine.renderer.drawPersonIcon = originalPersonIcon;
      cardNodes.clear();
      lastListSignature = '';
      document.getElementById('vtt-actor-library-toggle')?.remove();
      document.getElementById('vtt-actor-library-panel')?.remove();
      document.getElementById('vtt-actor-library-style')?.remove();
    },
  });
  window.LuminousVttRuntime = Object.freeze({ ...window.LuminousVttRuntime, actorLibrary: api });
  return api;
}