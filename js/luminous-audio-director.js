/* Luminous Audio Director — one campaign soundtrack, individual listening preferences.
 * Audio sources are registered assets; the DM controls shared intent, never player volume. */
(function (global) {
  "use strict";
  if (global.LuminousAudio) return;

  const SETTINGS_KEY = "luminous.audio.preferences.v1";
  const ROOT = "campaña/audio_director";
  const BOOTSTRAP_DM = "e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1";
  const LIBRARY = Object.freeze({
    music: Object.freeze([
      Object.freeze({ id: "lament", label: "In Hell We Live, Lament — Instrumental", url: "Assets/Audio/Intro%20audio/Limbus%20Company%20OST%20-%20In%20Hell%20We%20Live%2C%20Lament%20Instrumental.mp3" })
    ]),
    ambience: Object.freeze([
      Object.freeze({ id: "bus", label: "Motor y traqueteo del bus", url: "Assets/Audio/Intro%20audio/220618_StorySound_1_busRattle.wav" })
    ]),
    sfx: Object.freeze([
      Object.freeze({ id: "coin-heads", label: "Moneda: cara", url: "Assets/Audio/SFX/UI/Coin%20SFX/Coin_Heads.wav" }),
      Object.freeze({ id: "coin-tails", label: "Moneda: cruz", url: "Assets/Audio/SFX/UI/Coin%20SFX/Coin_Tails.wav" })
    ])
  });

  function clamp(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
  }
  function readPrefs() {
    try {
      const stored = JSON.parse(global.localStorage.getItem(SETTINGS_KEY) || "{}");
      return { music: clamp(stored.music, 40), sfx: clamp(stored.sfx, 40) };
    } catch (_) {
      return { music: 40, sfx: 40 };
    }
  }
  const prefs = readPrefs();
  const registered = new Map();
  const oneShots = new Set();
  const music = new Audio();
  const ambience = new Audio();
  music.loop = true;
  ambience.loop = true;
  music.preload = "none";
  ambience.preload = "none";

  let authenticatedUser = null;
  let isDirector = false;
  let database = null;
  let audioRef = null;
  let configRef = null;
  let offsetRef = null;
  let audioListener = null;
  let configListener = null;
  let offsetListener = null;
  let musicState = null;
  let ambienceState = null;
  let previousMusicKey = null;
  let previousAmbienceKey = null;
  let firstCueReceived = false;
  let previousCue = null;
  const receivedCues = new Set();
  let ownCue = null;
  let pendingWrite = null;
  let serverOffset = 0;
  let mounted = false;
  let panel = null;
  let trigger = null;
  let lastFocus = null;
  let statusNode = null;
  let hintNode = null;
  let cloudLibrary = null;
  let libraryRevision = null;
  const availableTracks = kind => LIBRARY[kind].concat(cloudLibrary?.tracks(kind) || []);
  function refreshCloudView() {
    if (!panel) return;
    panel.querySelectorAll('[data-audio-select]').forEach(select => {
      const kind = select.dataset.audioSelect;
      const chosen = select.value;
      select.replaceChildren();
      availableTracks(kind).forEach(entry => {
        const option = global.document.createElement('option'); option.value = entry.id; option.textContent = entry.label; select.appendChild(option);
      });
      if (Array.from(select.options).some(o => o.value === chosen)) select.value = chosen;
      const group = select.closest('[data-audio-kind]');
      if (group) {
        let remote = group.querySelector('.audio-remote-choices');
        if (!remote) { remote = global.document.createElement('div'); remote.className = 'audio-remote-choices'; select.after(remote); }
        remote.replaceChildren();
        (cloudLibrary?.tracks(kind) || []).forEach(entry => {
          const card = global.document.createElement('button'); card.type = 'button'; card.className = 'audio-track-card'; card.textContent = entry.label;
          card.setAttribute('aria-pressed', String(select.value === entry.id));
          card.addEventListener('click', () => { select.value = entry.id; group.querySelectorAll('.audio-track-card').forEach(node => node.setAttribute('aria-pressed', String(node === card))); });
          remote.appendChild(card);
        });
      }
    });
    renderCanonicalAudio();
    // Reconcile loop intent only; refreshing a catalog never replays a cue.
    receiveLoop('music', musicState); receiveLoop('ambience', ambienceState);
  }

  const byId = (kind, id) => availableTracks(kind).find((entry) => entry.id === id);
  const adjustedVolume = (bus, gain) => (prefs[bus] / 100) * gain;

  function applyVolumes() {
    music.volume = adjustedVolume("music", 1);
    ambience.volume = adjustedVolume("sfx", 1);
    registered.forEach((registration, element) => {
      element.volume = Math.max(0, Math.min(1, adjustedVolume(registration.bus, registration.gain)));
    });
    oneShots.forEach((element) => { element.volume = adjustedVolume("sfx", 1); });
    if (panel) {
      ["music", "sfx"].forEach((bus) => {
        const range = panel.querySelector('[data-audio-range="' + bus + '"]');
        const output = panel.querySelector('[data-audio-value="' + bus + '"]');
        if (range) range.value = String(prefs[bus]);
        if (output) output.textContent = prefs[bus] + "%";
      });
    }
  }
  function setVolume(bus, value) {
    if (bus !== "music" && bus !== "sfx") return;
    prefs[bus] = clamp(value, prefs[bus]);
    try { global.localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs)); } catch (_) { /* local only */ }
    applyVolumes();
  }
  function registerElement(element, bus, gain) {
    if (!element || (bus !== "music" && bus !== "sfx")) return;
    registered.set(element, { bus, gain: Number.isFinite(gain) ? Math.max(0, Math.min(1, gain)) : 1 });
    applyVolumes();
  }
  function playSafely(element) {
    if (!element || !element.src) return;
    const result = element.play();
    if (result && typeof result.catch === "function") {
      result.catch(error => { setHint(error?.name === 'NotAllowedError'
        ? 'El navegador requiere un toque para reproducir. Pulsa «Activar audio».'
        : 'No se pudo reproducir el archivo. Revisa su formato y tu conexión.'); });
    }
  }
  function setHint(message) {
    if (hintNode) hintNode.textContent = message;
  }
  function serverNow() { return Date.now() + serverOffset; }
  function syncPosition(element, state) {
    if (!element || !state || !state.active || !Number.isFinite(state.startedAt) || state.startedAt <= 0) return;
    function seek() {
      if (!Number.isFinite(element.duration) || element.duration <= 0) return;
      const elapsed = Math.max(0, (serverNow() - state.startedAt) / 1000);
      const position = state.loop === false ? Math.min(elapsed, element.duration) : elapsed % element.duration;
      if (Math.abs((element.currentTime || 0) - position) > 1.25) {
        try { element.currentTime = position; } catch (_) { /* awaiting metadata */ }
      }
    }
    if (element.readyState >= 1) seek();
    else element.addEventListener("loadedmetadata", seek, { once: true });
  }
  function receiveLoop(kind, state) {
    const element = kind === "music" ? music : ambience;
    const oldKey = kind === "music" ? previousMusicKey : previousAmbienceKey;
    const entry = state ? byId(kind, state.trackId) : null;
    const nextKey = entry ? entry.id + ":" + String(state.startedAt || 0) + ":" + String(state.active) + ":" + String(state.positionMs || 0) + ":" + String(state.loop) + (entry.expiresAt ? ":" + entry.url : "") : "off";
    if (kind === "music") musicState = state;
    else ambienceState = state;
    if (nextKey === oldKey) { updateStatus(); return; }
    if (kind === "music") previousMusicKey = nextKey;
    else previousAmbienceKey = nextKey;
    if (!entry) {
      element.pause();
      element.removeAttribute("src");
      element.load();
    } else {
      const absoluteUrl = new URL(entry.url, global.location.href).href;
      if (element.src !== absoluteUrl) element.src = absoluteUrl;
      element.loop = state.loop !== false;
      if (state.active) { syncPosition(element, state); playSafely(element); }
      else { element.pause(); try { element.currentTime = Math.max(0, Number(state.positionMs) || 0) / 1000; } catch (_) {} }
    }
    updateStatus();
  }
  function playEffect(id, at) {
    const entry = byId("sfx", id);
    if (!entry || entry.expiresAt && entry.expiresAt <= Date.now()) {
      if (cloudLibrary?.endpoint && /^r2_[a-f0-9]{64}$/.test(id)) {
        cloudLibrary.refresh().then(() => {
          const resolved = byId("sfx", id);
          if (resolved && (!at || Math.abs(serverNow() - at) <= 5000) && resolved.expiresAt > Date.now()) playEffect(id, at);
        }).catch(error => setHint(error.message));
      }
      return false;
    }
    // Limit concurrent bursts and always release ended audio elements.
    if (oneShots.size >= 12) return false;
    const sound = new Audio(entry.url);
    sound.volume = adjustedVolume("sfx", 1);
    oneShots.add(sound);
    const release = () => oneShots.delete(sound);
    sound.addEventListener("ended", release, { once: true });
    sound.addEventListener("error", release, { once: true });
    const result = sound.play();
    if (result && typeof result.catch === "function") result.catch(error => {
      release();
      setHint(error?.name === 'NotAllowedError' ? 'Pulsa «Activar audio» para permitir los sonidos.' : 'No se pudo reproducir este efecto. Revisa el archivo y la conexión.');
    });
    return true;
  }
  function receiveCue(cue) {
    const token = cue && typeof cue.nonce === "string" ? cue.nonce : "";
    if (!firstCueReceived) {
      firstCueReceived = true;
      previousCue = token;
      if (token) receivedCues.add(token);
      return; // A late join never replays the last sound of a previous scene.
    }
    if (!token || token === previousCue || receivedCues.has(token)) return;
    previousCue = token;
    receivedCues.add(token);
    if (receivedCues.size > 128) receivedCues.delete(receivedCues.values().next().value);
    if (cue.action === 'stop') {
      oneShots.forEach(sound => sound.pause());
      oneShots.clear();
      return;
    }
    if (token === ownCue) { ownCue = null; return; }
    // Reconnecting may deliver a newer nonce that is nevertheless long expired.
    const age = serverNow() - Number(cue.at);
    if (!Number.isFinite(age) || age < -5000 || age > 5000) return;
    playEffect(cue.cueId, cue.at);
  }
  function updateStatus() {
    if (!statusNode) return;
    const item = musicState ? byId("music", musicState.trackId) : null;
    const ambiance = ambienceState && ambienceState.active ? byId("ambience", ambienceState.trackId) : null;
    statusNode.textContent = item ? "Música de campaña: " + item.label : "La campaña está en silencio.";
    if (item && !musicState.active) statusNode.textContent += " · En pausa";
    if (item && musicState.active && music.paused) statusNode.textContent += " · Pulsa Activar audio si no lo escuchas";
    if (ambiance) statusNode.textContent += " · Ambiente: " + ambiance.label;
    renderCanonicalAudio();
  }
  function optionsFor(kind) {
    return LIBRARY[kind].map((entry) => '<option value="' + entry.id + '">' + entry.label + '</option>').join("");
  }
  function updateDirectorView() {
    if (!panel) return;
    const section = panel.querySelector("[data-audio-director]");
    if (section) section.hidden = !isDirector;
    cloudLibrary?.setDirector(isDirector);
    renderCanonicalAudio();
    panel.querySelectorAll("[data-audio-command]").forEach((button) => { button.disabled = !isDirector || Boolean(pendingWrite) || Boolean(cloudLibrary?.deleting); });
  }
  function showPanel() {
    if (!panel) return;
    lastFocus = global.document.activeElement;
    panel.hidden = false;
    if (panel.tagName === "DIALOG" && !panel.open) panel.showModal();
    trigger && trigger.setAttribute("aria-expanded", "true");
    const first = panel.querySelector("[data-audio-close]");
    first && first.focus();
    applyVolumes();
    updateStatus();
    if (cloudLibrary?.endpoint) cloudLibrary.refresh().catch(error => setHint(error.message));
  }
  function closePanel() {
    if (!panel) return;
    if (panel.tagName === "DIALOG" && panel.open) panel.close();
    panel.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }
  async function directorWrite(channel, data) {
    if (!isDirector || !authenticatedUser || !audioRef) {
      setHint("Sólo el Director puede controlar el audio de campaña.");
      return;
    }
    const ref = audioRef;
    const previous = channel === "music" ? musicState : ambienceState;
    const request = {};
    pendingWrite = request;
    updateDirectorView();
    try {
      if (channel === 'effects') await ref.update(data);
      else await ref.child(channel).set(data);
      setHint("Se envió el cambio a la campaña.");
      return true;
    } catch (_) {
      setHint("No se pudo enviar el audio. Revisa la conexión y permisos del DM.");
      // A click can start local playback before RTDB confirms the write.
      // Always restore the last confirmed session when that write fails.
      if (audioRef === ref && pendingWrite === request) {
        if (channel === "music") { previousMusicKey = null; receiveLoop("music", previous); }
        if (channel === "ambience") { previousAmbienceKey = null; receiveLoop("ambience", previous); }
      }
      return false;
    } finally {
      if (pendingWrite === request) pendingWrite = null;
      updateDirectorView();
    }
  }
  function previewLoopOnGesture(kind, entry) {
    // Direct user interaction unlocks audio in browsers that block remote
    // Firebase events from calling play() without a click.
    const element = kind === "music" ? music : ambience;
    const url = new URL(entry.url, global.location.href).href;
    if (element.src !== url) element.src = url;
    playSafely(element);
  }
  function command(type) {
    if (!isDirector || !audioRef || pendingWrite || cloudLibrary?.deleting) return;
    const stamp = global.firebase.database.ServerValue.TIMESTAMP;
    const selects = (kind) => panel.querySelector('[data-audio-select="' + kind + '"]');
    if (type === "play-music") {
      const trackId = selects("music").value;
      const entry = byId("music", trackId);
      if (entry) {
        previewLoopOnGesture("music", entry);
        let resume = musicState?.trackId === trackId && !musicState?.active ? Number(musicState.positionMs) || 0 : 0;
        if (Number.isFinite(music.duration) && music.duration > 0 && resume >= music.duration * 1000) resume = 0;
        directorWrite("music", { trackId, active: true, startedAt: resume ? serverNow() - resume : stamp, loop: musicState?.loop !== false });
      }
    } else if (type === "pause-music") {
      if (!musicState?.active) return;
      const elapsed = Math.max(0, serverNow() - Number(musicState.startedAt || serverNow()));
      const positionMs = Number.isFinite(music.duration) && music.duration > 0 ? elapsed % (music.duration * 1000) : elapsed;
      directorWrite("music", { active: false, trackId: musicState.trackId, startedAt: 0, positionMs, loop: musicState.loop !== false });
    } else if (type === "stop-music") {
      directorWrite("music", { active: false, trackId: "", startedAt: 0 });
    } else if (type === "play-ambience") {
      const trackId = selects("ambience").value;
      const entry = byId("ambience", trackId);
      if (entry) {
        previewLoopOnGesture("ambience", entry);
        directorWrite("ambience", { trackId, active: true, startedAt: stamp });
      }
    } else if (type === "stop-ambience") {
      directorWrite("ambience", { active: false, trackId: "", startedAt: 0 });
    } else if (type === 'stop-effects') {
      const nonce = audioRef.child('events').push().key;
      directorWrite('effects', {
        ambience: { active: false, trackId: '', startedAt: 0 },
        cue: { action: 'stop', cueId: '', nonce, at: stamp }
      });
    } else if (type === "cue") {
      const cueId = selects("sfx").value;
      if (!byId("sfx", cueId)) return;
      const nonce = audioRef.child("events").push().key;
      ownCue = nonce;
      directorWrite("cue", { cueId, nonce, at: stamp }).then(ok => { if (ok) playEffect(cueId); });
    }
  }
  let canonicalFilter = 'all', canonicalFavorites = new Set(), canonicalShuffle = false;
  function canonicalNode(id) { return panel?.querySelector('#pa-' + id); }
  function canonicalPlay(kind, id) {
    const select = panel.querySelector('[data-audio-select="' + kind + '"]');
    if (!select || !isDirector || pendingWrite) return;
    select.value = id;
    command(kind === 'sfx' ? 'cue' : 'play-' + kind);
  }
  function renderCanonicalAudio() {
    if (!panel?.classList.contains('canonical-audio')) return;
    const list = canonicalNode('trackList'), query = canonicalNode('searchMusic').value.trim().toLocaleLowerCase();
    list.replaceChildren();
    const all = availableTracks('music');
    const tracks = all.filter(t => t.label.toLocaleLowerCase().includes(query) && (canonicalFilter !== 'favorites' || canonicalFavorites.has(t.id)) && (canonicalFilter !== 'custom' || t.id.startsWith('r2_')));
    canonicalNode('catalogCount').textContent = tracks.length + ' pistas';
    canonicalNode('catalogTitle').textContent = ({all:'Todas las pistas',favorites:'Favoritos',custom:'Mis canciones'})[canonicalFilter];
    const button = (label, handler, className='small-control') => {
      const b=global.document.createElement('button');b.type='button';b.className=className;b.textContent=label;b.onclick=handler;return b;
    };
    for (const entry of tracks) {
      const row=global.document.createElement('div');row.className='track-item'+(musicState?.trackId===entry.id&&musicState.active?' playing':'');row.dataset.trackId=entry.id;
      const art=canonicalNode('nowArt').cloneNode(true);art.removeAttribute('id');art.className='track-art'+(entry.id.startsWith('r2_')?' custom':'');
      const info=global.document.createElement('div');info.className='track-info';
      const title=global.document.createElement('div');title.className='track-name';title.textContent=entry.label;
      const meta=global.document.createElement('div');meta.className='track-meta';meta.textContent=entry.id.startsWith('r2_')?'Tu biblioteca compartida':'Biblioteca de Limbus';info.append(title,meta);
      const play=button('▶',()=>canonicalPlay('music',entry.id),'track-action play');play.setAttribute('aria-label','Reproducir '+entry.label);play.disabled=!isDirector||Boolean(pendingWrite)||Boolean(cloudLibrary?.deleting);
      const favorite=button(canonicalFavorites.has(entry.id)?'★':'☆',()=>{
        if(canonicalFavorites.has(entry.id))canonicalFavorites.delete(entry.id);else canonicalFavorites.add(entry.id);
        try{global.localStorage.setItem('limbus.audio.favorites',JSON.stringify([...canonicalFavorites]));}catch(_){}
        renderCanonicalAudio();
        list.querySelector('[data-track-id="'+entry.id+'"] .favorite')?.focus();
      },'track-action favorite');favorite.setAttribute('aria-label','Favorito: '+entry.label);favorite.setAttribute('aria-pressed',String(canonicalFavorites.has(entry.id)));
      const actions=global.document.createElement('div');actions.className='track-actions';actions.append(favorite,play);
      row.append(art,info,actions);list.appendChild(row);
    }
    if(!tracks.length)list.textContent='No hay pistas que coincidan.';
    const fillEffects=(target,kind)=>{
      target.replaceChildren();
      for(const entry of availableTracks(kind)){
        const b=button(entry.label,()=>canonicalPlay(kind,entry.id),'quick-sfx');
        b.disabled=!isDirector||Boolean(pendingWrite)||Boolean(cloudLibrary?.deleting);target.appendChild(b);
      }
    };
    fillEffects(canonicalNode('ambientFxGrid'),'ambience');fillEffects(canonicalNode('oneShotFxGrid'),'sfx');fillEffects(canonicalNode('quickGrid'),'sfx');
    const selected=musicState&&byId('music',musicState.trackId);
    canonicalNode('nowTitle').textContent=selected?.label||'Ninguna pista seleccionada';
    canonicalNode('nowSub').textContent=selected?(musicState.active?'Sonando para la mesa':'En pausa'):'Selecciona música para comenzar';
    canonicalNode('playBtn').textContent=musicState?.active?'Ⅱ':'▶';
    canonicalNode('playBtn').setAttribute('aria-label',musicState?.active?'Pausar':'Reproducir');
    for(const id of ['playBtn','prevBtn','nextBtn','repeatBtn','seek','stopAllEffects','stopAllQuick'])canonicalNode(id).disabled=!isDirector||Boolean(pendingWrite)||Boolean(cloudLibrary?.deleting);
    if (musicState?.trackId && !selected) canonicalNode('playBtn').disabled = true;
    canonicalNode('repeatBtn').setAttribute('aria-pressed',String(musicState?.loop!==false));
    for(const id of ['musicVolume','footerVolume'])canonicalNode(id).value=prefs.music;
    canonicalNode('sfxVolume').value=prefs.sfx;
    canonicalNode('musicValue').textContent=canonicalNode('footerValue').textContent=prefs.music+'%';
    canonicalNode('sfxValue').textContent=prefs.sfx+'%';
  }
  function buildMusicDirector(surface) {
    if (!global.LuminousDirectorTemplates) return;
    surface.classList.add('canonical-audio');
    surface.setAttribute('aria-label','Music Director');
    surface.innerHTML=global.LuminousDirectorTemplates.audio;
    const app=surface.querySelector('.app');app.setAttribute('data-audio-director','');
    const node=id=>canonicalNode(id);
    const native=global.document.createElement('div');native.className='canonical-native-audio';native.setAttribute('aria-hidden','true');
    for(const kind of ['music','ambience','sfx']){
      const select=global.document.createElement('select');select.dataset.audioSelect=kind;select.innerHTML=optionsFor(kind);native.appendChild(select);
    }
    for(const name of ['play-music','pause-music','stop-music','play-ambience','stop-ambience','cue']){
      const b=global.document.createElement('button');b.type='button';b.dataset.audioCommand=name;native.appendChild(b);
    }
    app.appendChild(native);
    const status=global.document.createElement('p');status.className='sr';status.setAttribute('data-audio-status','');status.setAttribute('aria-live','polite');
    const hint=global.document.createElement('p');hint.setAttribute('data-audio-hint','');hint.setAttribute('role','status');
    node('nowSub').after(status,hint);
    const activate=global.document.createElement('button');activate.type='button';activate.className='small-control';activate.setAttribute('data-audio-activate','');activate.textContent='Activar audio';surface.querySelector('.mix-card').appendChild(activate);
    try{canonicalFavorites=new Set(JSON.parse(global.localStorage.getItem('limbus.audio.favorites')||'[]'));}catch(_){}
    const setMode=mode=>{
      surface.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.mode===mode)));
      for(const [key,id] of [['music','musicScreen'],['sfx','sfxScreen'],['custom','customScreen']])node(id).classList.toggle('active',mode===key);
    };
    surface.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
    for(const id of ['sidebarFilters','mobileFilters']){
      for(const [key,label] of [['all','Todas las pistas'],['favorites','Favoritos'],['custom','Mis canciones']]){
        const b=global.document.createElement('button');b.type='button';b.className='filter-btn';b.textContent=label;b.onclick=()=>{canonicalFilter=key;renderCanonicalAudio();};node(id).appendChild(b);
      }
    }
    node('searchMusic').oninput=renderCanonicalAudio;
    node('listButton').onclick=()=>{node('trackList').classList.remove('grid-view');node('listButton').setAttribute('aria-pressed','true');node('gridButton').setAttribute('aria-pressed','false');};
    node('gridButton').onclick=()=>{node('trackList').classList.add('grid-view');node('listButton').setAttribute('aria-pressed','false');node('gridButton').setAttribute('aria-pressed','true');};
    for(const id of ['musicVolume','footerVolume'])node(id).oninput=()=>{setVolume('music',node(id).value);renderCanonicalAudio();};
    node('sfxVolume').oninput=()=>{setVolume('sfx',node('sfxVolume').value);renderCanonicalAudio();};
    node('resetMixer').onclick=()=>{setVolume('music',40);setVolume('sfx',40);renderCanonicalAudio();};
    function mobilePane(pane){
      app.dataset.mobile=pane;
      node('mobileLibrary').setAttribute('aria-selected',String(pane==='library'));node('mobileMixer').setAttribute('aria-selected',String(pane==='mixer'));
      const mobile=global.matchMedia?.('(max-width:960px)').matches;
      node('catalog').hidden=Boolean(mobile&&pane==='mixer');node('mixer').hidden=Boolean(mobile&&pane==='library');
    }
    node('mobileLibrary').onclick=()=>mobilePane('library');node('mobileMixer').onclick=()=>mobilePane('mixer');
    global.addEventListener('resize',()=>mobilePane(app.dataset.mobile||'library'));mobilePane('library');
    node('playBtn').onclick=()=>{
      if (musicState?.active) command('pause-music');
      else if (musicState?.trackId) canonicalPlay('music', musicState.trackId);
      else command('play-music');
    };
    function next(delta){
      const tracks=availableTracks('music');if(!tracks.length)return;
      const index=tracks.findIndex(t=>t.id===musicState?.trackId);
      const target=canonicalShuffle?Math.floor(Math.random()*tracks.length):(index+delta+tracks.length)%tracks.length;
      canonicalPlay('music',tracks[target].id);
    }
    node('prevBtn').onclick=()=>next(-1);node('nextBtn').onclick=()=>next(1);
    node('shuffleBtn').onclick=()=>{canonicalShuffle=!canonicalShuffle;node('shuffleBtn').setAttribute('aria-pressed',String(canonicalShuffle));};
    node('repeatBtn').onclick=()=>{if(musicState&&!pendingWrite)directorWrite('music',{...musicState,loop:musicState.loop===false});};
    node('stopAllEffects').onclick=node('stopAllQuick').onclick=()=>command('stop-effects');
    node('seek').onchange=()=>{
      if(!isDirector||pendingWrite||!musicState||!Number.isFinite(music.duration)||music.duration<=0)return;
      const positionMs=Number(node('seek').value)/1000*music.duration*1000;
      directorWrite('music',{...musicState,startedAt:musicState.active?serverNow()-positionMs:0,positionMs});
    };
    function progress(){
      const format=seconds=>Number.isFinite(seconds)?Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0'):'0:00';
      node('elapsed').textContent=format(music.currentTime);node('duration').textContent=format(music.duration);
      if(global.document.activeElement!==node('seek'))node('seek').value=music.duration>0?music.currentTime/music.duration*1000:0;
    }
    music.addEventListener('timeupdate',progress);music.addEventListener('loadedmetadata',progress);
    music.addEventListener('ended',()=>{
      if(isDirector&&!pendingWrite&&musicState?.active&&musicState.loop===false)
        directorWrite('music',{...musicState,active:false,startedAt:0,positionMs:0});
    });
    renderCanonicalAudio();
  }

  function buildPanel() {
    if (mounted || !global.document.body) return;
    mounted = true;
    const doc = global.document;
    const hudMenu = doc.getElementById("hud-menu-dropdown");
    trigger = doc.createElement("button");
    trigger.type = "button";
    trigger.id = "luminous-audio-open";
    trigger.className = hudMenu ? "hud-menu-item luminous-audio-menu-entry" : "luminous-audio-floating";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", "luminous-audio-panel");
    trigger.setAttribute("aria-label", "Opciones de sonido");
    trigger.innerHTML = '<span class="luminous-audio-symbol" aria-hidden="true">♫</span><span>Sonido</span>';
    if (hudMenu) hudMenu.appendChild(trigger);
    else doc.body.appendChild(trigger);

    panel = doc.createElement(doc.body.classList.contains("on-game-dashboard") ? "dialog" : "section");
    panel.className = "luminous-audio-panel";
    panel.id = "luminous-audio-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Opciones de sonido");
    panel.hidden = true;
    panel.innerHTML = '<div class="luminous-audio-card">' +
      '<header class="luminous-audio-header"><div><p>CONFIGURACIÓN</p><h2>Audio de Luminous</h2></div>' +
      '<button type="button" data-audio-close aria-label="Cerrar opciones de sonido">×</button></header>' +
      '<div class="luminous-audio-scroll">' +
        '<p class="luminous-audio-info">Tu volumen es privado y se guarda en este dispositivo.</p>' +
        '<section class="luminous-audio-section"><h3>♫ Música</h3><label for="luminous-music-range">Volumen de música</label>' +
        '<div class="luminous-audio-slider"><input id="luminous-music-range" data-audio-range="music" type="range" min="0" max="100" step="1" aria-label="Volumen de música"><output data-audio-value="music"></output></div></section>' +
        '<section class="luminous-audio-section"><h3>Efectos de sonido</h3><label for="luminous-sfx-range">Volumen de efectos</label>' +
        '<div class="luminous-audio-slider"><input id="luminous-sfx-range" data-audio-range="sfx" type="range" min="0" max="100" step="1" aria-label="Volumen de efectos"><output data-audio-value="sfx"></output></div></section>' +
        '<button type="button" data-audio-activate class="luminous-audio-activate">Activar audio</button>' +
        '<p class="luminous-audio-status" data-audio-status aria-live="polite"></p>' +
        '<section class="luminous-audio-director" data-audio-director hidden><h3>Consola del Director</h3>' +
          '<p>Controla qué escuchan los participantes conectados.</p>' +
          '<label for="luminous-music-track">Pista musical</label><select id="luminous-music-track" data-audio-select="music">' + optionsFor("music") + '</select>' +
          '<div class="luminous-audio-actions"><button data-audio-command="play-music" type="button">Reproducir música</button><button data-audio-command="stop-music" type="button">Detener</button></div>' +
          '<label for="luminous-ambience-track">Ambiente</label><select id="luminous-ambience-track" data-audio-select="ambience">' + optionsFor("ambience") + '</select>' +
          '<div class="luminous-audio-actions"><button data-audio-command="play-ambience" type="button">Activar ambiente</button><button data-audio-command="stop-ambience" type="button">Silenciar ambiente</button></div>' +
          '<label for="luminous-sfx-track">Efecto puntual</label><select id="luminous-sfx-track" data-audio-select="sfx">' + optionsFor("sfx") + '</select>' +
          '<button data-audio-command="cue" class="luminous-audio-send" type="button">Emitir efecto a todos</button>' +
        '</section><p class="luminous-audio-hint" data-audio-hint role="status" aria-live="polite"></p>' +
      '</div></div>';
    if (doc.body.classList.contains("on-game-dashboard")) buildMusicDirector(panel);
    doc.body.appendChild(panel);
    panel.addEventListener("cancel", event => { event.preventDefault(); closePanel(); });
    statusNode = panel.querySelector("[data-audio-status]");
    hintNode = panel.querySelector("[data-audio-hint]");
    trigger.addEventListener("click", (event) => { event.stopPropagation(); showPanel(); });
    panel.querySelector("[data-audio-close]").addEventListener("click", closePanel);
    panel.addEventListener("click", (event) => { if (event.target === panel) closePanel(); });
    panel.querySelectorAll("[data-audio-range]").forEach((range) => {
      range.addEventListener("input", () => setVolume(range.dataset.audioRange, range.value));
    });
    panel.querySelectorAll("[data-audio-command]").forEach((button) => {
      button.addEventListener("click", () => command(button.dataset.audioCommand));
    });
    panel.querySelector("[data-audio-activate]").addEventListener("click", () => {
      if (musicState && musicState.active) { syncPosition(music, musicState); playSafely(music); }
      if (ambienceState && ambienceState.active) { syncPosition(ambience, ambienceState); playSafely(ambience); }
      setHint("Intentando activar el audio. Si tu navegador lo bloquea, pulsa otra vez.");
    });
    doc.addEventListener("keydown", (event) => {
      if (panel.hidden) return;
      if (event.key === "Escape") { event.preventDefault(); closePanel(); }
      if (event.key === "Tab") {
        const nodes = Array.from(panel.querySelectorAll('button:not(:disabled):not([hidden]),input:not(:disabled),select:not(:disabled)'))
          .filter((node) => node.getClientRects().length > 0);
        if (!nodes.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    applyVolumes();
    updateStatus();
    updateDirectorView();
  }
  function detachFirebase() {
    cloudLibrary?.destroy(); cloudLibrary = null; libraryRevision = null;
    oneShots.forEach(sound => sound.pause()); oneShots.clear();
    if (audioRef && audioListener) audioRef.off("value", audioListener);
    if (configRef && configListener) configRef.off("value", configListener);
    if (offsetRef && offsetListener) offsetRef.off("value", offsetListener);
    audioRef = null;
    configRef = null;
    offsetRef = null;
    audioListener = null;
    configListener = null;
    offsetListener = null;
    firstCueReceived = false;
    previousCue = null;
    receivedCues.clear();
    ownCue = null;
    pendingWrite = null;
    isDirector = false;
    musicState = null;
    ambienceState = null;
    previousMusicKey = null;
    previousAmbienceKey = null;
    receiveLoop("music", null);
    receiveLoop("ambience", null);
    updateDirectorView();
  }
  function connectFirebase() {
    if (!global.firebase || !global.firebase.apps || !global.firebase.apps.length) return;
    const auth = global.firebase.auth();
    auth.onAuthStateChanged((user) => {
      detachFirebase();
      authenticatedUser = user;
      if (!user) return;
      database = global.firebase.database();
      if (global.LuminousAudioLibrary) {
        cloudLibrary = new global.LuminousAudioLibrary({user, db: database, onChange: refreshCloudView, onBusyChange: updateDirectorView});
        cloudLibrary.mount(panel);
      }
      configRef = database.ref("campaña/config/dm_uid");
      configListener = (snapshot) => {
        isDirector = user.uid === BOOTSTRAP_DM || user.uid === snapshot.val();
        updateDirectorView();
      };
      configRef.on("value", configListener, () => { isDirector = user.uid === BOOTSTRAP_DM; updateDirectorView(); });
      offsetRef = database.ref(".info/serverTimeOffset");
      offsetListener = (snapshot) => { serverOffset = Number(snapshot.val()) || 0; };
      offsetRef.on("value", offsetListener);
      audioRef = database.ref(ROOT);
      audioListener = (snapshot) => {
        const value = snapshot.val() || {};
        if (value.library_revision !== libraryRevision) {
          libraryRevision = value.library_revision;
          if (cloudLibrary?.endpoint) cloudLibrary.refresh().catch(error => setHint(error.message));
        }
        receiveLoop("music", value.music);
        receiveLoop("ambience", value.ambience);
        receiveCue(value.cue);
      };
      audioRef.on("value", audioListener, () => { setHint("La sincronización de audio no está disponible."); });
    });
  }
  global.addEventListener("storage", (event) => {
    if (event.key !== SETTINGS_KEY) return;
    const settings = readPrefs();
    prefs.music = settings.music;
    prefs.sfx = settings.sfx;
    applyVolumes();
  });

  function isHostedInsideAudioShell() {
    // Live combat is embedded by the player/Director shell. Those pages own
    // the music bus; a second one in the iframe would double the soundtrack.
    try {
      if (!global.parent || global.parent === global) return false;
      return /(?:^|\/)(?:hoja_personaje|hoja_de_DM|pantalla_dm|combate)\.html$/i
        .test(global.parent.location.pathname);
    } catch (_) {
      return false; // Standalone/cross-origin viewer remains independently usable.
    }
  }
  [music, ambience].forEach((element, index) => {
    let retrying = false;
    element.addEventListener('playing', () => { retrying = false; });
    element.addEventListener('error', () => {
      const kind = index === 0 ? 'music' : 'ambience';
      const state = index === 0 ? musicState : ambienceState;
      if (!cloudLibrary?.endpoint || !String(state?.trackId || '').startsWith('r2_')) return;
      if (retrying) { setHint('No se pudo cargar este audio. Revisa el archivo y la conexión.'); return; }
      retrying = true;
      cloudLibrary.refresh({invalidateUrls:true}).then(() => {
        const current = index === 0 ? musicState : ambienceState;
        if (current?.trackId !== state.trackId) return;
        if (index === 0) previousMusicKey = null; else previousAmbienceKey = null;
        receiveLoop(kind, current);
      }).catch(error => setHint(error.message));
    });
  });
  function init() {
    if (isHostedInsideAudioShell()) return;
    buildPanel();
    // These are the actual login audio elements. Voice and bus share the effects bus.
    const introVoice = global.document.getElementById("audio-inicio");
    const introFx = global.document.getElementById("audio-sfx");
    const introMusic = global.document.getElementById("audio-music");
    if (introVoice) registerElement(introVoice, "sfx", 1);
    if (introFx) registerElement(introFx, "sfx", 0.5);
    if (introMusic) registerElement(introMusic, "music", 1);
    connectFirebase();
  }
  global.LuminousAudio = Object.freeze({
    library: LIBRARY,
    getPreferences: () => ({ music: prefs.music, sfx: prefs.sfx }),
    setVolume,
    registerElement,
    playEffect,
    openOptions: showPanel,
    getAvailableTracks: kind => availableTracks(kind).map(entry => ({...entry}))
  });
  if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
