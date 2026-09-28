(() => {
  const frame = document.getElementById('gameFrame');
  if (!frame) return;

  const INSTALL_MARK = '__luminousLoaderDiagnosticsInstalled';
  const POLL_MS = 100;
  const BACKGROUND_STAGES = new Set([
    'Preparando vecinos',
    'Cargando vecinos',
    'Cargando protagonista',
    'Protagonista listo',
    'Cargando acciones',
    'Preparando a Belle'
  ]);
  let lastWindow = null;

  function safeText(value) {
    if (value == null) return '';
    return String(value).replace(/\s+/g, ' ').trim();
  }

  function describeError(errorLike) {
    if (!errorLike) return 'Error desconocido';
    if (typeof errorLike === 'string') return safeText(errorLike);
    const message = safeText(errorLike.message || errorLike.reason || errorLike.type || errorLike);
    const name = safeText(errorLike.name);
    return name && name !== 'Error' ? `${name}: ${message}` : message;
  }

  function classifyErrorCode(message, source = 'game') {
    const text = safeText(message);
    if (/resolveTerrainSlopeSlide.*not a function/i.test(text)) return 'E-MOVE-SLOPE-001';
    if (/TERRAIN_SURFACE_STANDARD.*is not defined/i.test(text)) return 'E-TERRAIN-SURFACE-001';
    if (/is not a function/i.test(text)) return 'E-RUNTIME-FUNC-001';
    if (/dynamically imported module|importing a module script failed|failed to fetch.*module|module script/i.test(text)) return 'E-MODULE-LOAD-001';
    if (source === 'promise' || /promesa rechazada|unhandledrejection/i.test(text)) return 'E-PROMISE-001';
    if (source === 'javascript' || /javascript\s*·/i.test(text)) return 'E-JS-001';
    if (/watchdog|timeout|sin avanzar|atasc/i.test(text)) return 'E-LOAD-TIMEOUT-001';
    if (/error al iniciar el prototipo/i.test(text)) return 'E-BOOT-001';
    return 'E-LOAD-UNKNOWN';
  }

  function errorSpecificity(message, source = 'game') {
    const code = classifyErrorCode(message, source);
    if (code === 'E-MOVE-SLOPE-001' || code === 'E-TERRAIN-SURFACE-001' || code === 'E-RUNTIME-FUNC-001') return 100;
    if (code === 'E-MODULE-LOAD-001') return 95;
    if (code === 'E-JS-001') return 90;
    if (code === 'E-PROMISE-001') return 85;
    if (code === 'E-LOAD-TIMEOUT-001') return 60;
    if (code === 'E-BOOT-001') return 10;
    return 40;
  }

  function isBackgroundProgress(stage) {
    return BACKGROUND_STAGES.has(safeText(stage));
  }

  function setOuterStatus(text) {
    const badge = document.getElementById('bridgeBadge');
    if (!badge) return;
    badge.textContent = text;
    badge.classList.remove('good');
    badge.classList.add('waiting');
  }

  function install(win) {
    if (!win || win[INSTALL_MARK] || typeof win.setLoadProgress !== 'function') return false;

    const doc = win.document;
    const initialPercent = Number(win.__paperLoadPct || 0);
    const state = {
      percent: initialPercent,
      requestedPercent: initialPercent,
      stage: safeText(doc.getElementById('loaderStage')?.textContent) || 'Preparando carga',
      hint: safeText(doc.getElementById('loaderHint')?.textContent),
      lastSignalAt: performance.now(),
      background: null,
      failed: false,
      error: null,
      errorCode: null,
      errorRank: 0,
      errorSource: null
    };

    const originalSetLoadProgress = win.setLoadProgress.bind(win);
    const originalPaperLoadFailed = typeof win.paperLoadFailed === 'function'
      ? win.paperLoadFailed.bind(win)
      : null;

    function publish() {
      win.__luminosLoaderDiagnostics = {
        percent: state.percent,
        requestedPercent: state.requestedPercent,
        stage: state.stage,
        hint: state.hint,
        lastSignalAt: state.lastSignalAt,
        background: state.background,
        failed: state.failed,
        error: state.error,
        errorCode: state.errorCode,
        errorSource: state.errorSource
      };
    }

    function recordBackground(requested, stage, hint, reason) {
      state.background = {
        requestedPercent: requested,
        stage: safeText(stage),
        hint: safeText(hint),
        reason,
        at: performance.now()
      };
      publish();
    }

    win.setLoadProgress = (pct, stage, hint) => {
      const stageText = safeText(stage);
      const hintText = safeText(hint);
      const nextStage = stageText || state.stage;
      const nextHint = hintText || state.hint;
      const requested = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));

      // Los warm-ups de sprites se lanzan fire-and-forget durante el arranque.
      // Deben quedar registrados, pero nunca pueden mover la barra ni apropiarse
      // de la fase foreground. Esto evita falsos "78% · Preparando a Belle".
      if (isBackgroundProgress(stageText)) {
        recordBackground(requested, stageText, hintText, 'known-warmup');
        return;
      }

      // Una tarea asíncrona atrasada tampoco puede reaparecer después de que el
      // foreground ya avanzó más allá de su porcentaje.
      if (requested < state.percent) {
        recordBackground(requested, stageText, hintText, 'late-lower-percent');
        return;
      }

      const signalChanged = requested !== state.requestedPercent || nextStage !== state.stage || nextHint !== state.hint;
      if (signalChanged) {
        state.lastSignalAt = performance.now();
        // El watchdog interno debe considerar avance de fase/detalle, no sólo el ancho de la barra.
        win.__paperLoadLastProgressAt = state.lastSignalAt;
      }

      state.requestedPercent = requested;
      state.percent = Math.max(state.percent, requested);
      state.stage = nextStage;
      state.hint = nextHint;
      publish();
      return originalSetLoadProgress(pct, stage, hint);
    };

    function reportFailure(message, source = 'game') {
      const error = describeError(message);
      const rank = errorSpecificity(error, source);
      if (state.failed && rank <= state.errorRank) return false;

      const firstFailure = !state.failed;
      const phase = state.stage || 'Fase desconocida';
      const detail = state.hint || 'Sin detalle adicional';
      const code = classifyErrorCode(error, source);

      state.failed = true;
      state.error = error;
      state.errorCode = code;
      state.errorRank = rank;
      state.errorSource = source;
      publish();

      const diagnostic = `${code} · ${error} · Fase: ${phase} · ${detail} · ${state.percent}%`;
      if (firstFailure && originalPaperLoadFailed) originalPaperLoadFailed(diagnostic);

      const stageEl = doc.getElementById('loaderStage');
      const hintEl = doc.getElementById('loaderHint');
      const retry = doc.getElementById('loaderRetry');
      if (stageEl) stageEl.textContent = `Error ${code} · ${phase}`;
      if (hintEl) hintEl.textContent = `${detail} · ${error}`;
      if (retry) retry.classList.add('show');

      setOuterStatus(`Error ${code} · ${phase}`);
      console.error('[LuminousLoader]', {
        code,
        source,
        message: state.error,
        phase,
        detail,
        percent: state.percent,
        requestedPercent: state.requestedPercent,
        background: state.background,
        diagnostics: win.__luminosLoaderDiagnostics
      });
      return true;
    }

    win.paperLoadFailed = (message) => reportFailure(message, 'game');

    win.addEventListener('error', (event) => {
      // Ignora fallos de recursos opcionales (IMG/texture); esos no traen error/message JS.
      if (win.__paperLoaded || !win.__paperLoaderActive || (!event.error && !event.message)) return;
      const where = event.filename
        ? `${event.filename.split('/').pop()}:${event.lineno || '?'}:${event.colno || '?'}`
        : 'script';
      reportFailure(`JavaScript · ${describeError(event.error || event.message)} · ${where}`, 'javascript');
    });

    win.addEventListener('unhandledrejection', (event) => {
      if (win.__paperLoaded || !win.__paperLoaderActive) return;
      reportFailure(`Promesa rechazada · ${describeError(event.reason)}`, 'promise');
    });

    win[INSTALL_MARK] = true;
    publish();
    console.info('[LuminousLoader] Diagnóstico de carga activo.');
    return true;
  }

  function tryInstall() {
    let win = null;
    try {
      win = frame.contentWindow;
      if (!win) return;
      if (win !== lastWindow) lastWindow = win;
      install(win);
    } catch (error) {
      // El Lab y el juego son same-origin en producción. Si todavía está navegando,
      // el siguiente ciclo vuelve a intentarlo sin bloquear la carga.
    }
  }

  frame.addEventListener('load', tryInstall);
  const poll = setInterval(() => {
    tryInstall();
    try {
      const win = frame.contentWindow;
      if (win?.__paperLoaded) clearInterval(poll);
    } catch (_) {}
  }, POLL_MS);

  tryInstall();
})();
