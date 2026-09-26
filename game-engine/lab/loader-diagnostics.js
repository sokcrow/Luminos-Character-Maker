(() => {
  const frame = document.getElementById('gameFrame');
  if (!frame) return;

  const INSTALL_MARK = '__luminousLoaderDiagnosticsInstalled';
  const POLL_MS = 100;
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
      failed: false,
      error: null
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
        failed: state.failed,
        error: state.error
      };
    }

    win.setLoadProgress = (pct, stage, hint) => {
      const nextStage = safeText(stage) || state.stage;
      const nextHint = safeText(hint) || state.hint;
      const requested = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
      const signalChanged = requested !== state.requestedPercent || nextStage !== state.stage || nextHint !== state.hint;

      if (signalChanged) {
        state.lastSignalAt = performance.now();
        // El watchdog interno debe considerar avance de fase/detalle aunque el porcentaje visual
        // siga retenido por la regla monotónica (por ejemplo, 78% -> otra fase con 60%).
        win.__paperLoadLastProgressAt = state.lastSignalAt;
      }

      state.requestedPercent = requested;
      state.percent = Math.max(state.percent, requested);
      state.stage = nextStage;
      state.hint = nextHint;
      publish();
      return originalSetLoadProgress(pct, stage, hint);
    };

    win.paperLoadFailed = (message) => {
      if (state.failed) return;
      state.failed = true;
      state.error = describeError(message);
      publish();

      const phase = state.stage || 'Fase desconocida';
      const detail = state.hint || 'Sin detalle adicional';
      const diagnostic = `${state.error} · Fase: ${phase} · ${detail} · ${state.percent}%`;

      if (originalPaperLoadFailed) originalPaperLoadFailed(diagnostic);

      const stageEl = doc.getElementById('loaderStage');
      const hintEl = doc.getElementById('loaderHint');
      const retry = doc.getElementById('loaderRetry');
      if (stageEl) stageEl.textContent = `Error de carga · ${phase}`;
      if (hintEl) hintEl.textContent = `${detail} · ${state.error}`;
      if (retry) retry.classList.add('show');

      setOuterStatus(`Error de carga · ${phase}`);
      console.error('[LuminousLoader]', {
        message: state.error,
        phase,
        detail,
        percent: state.percent,
        requestedPercent: state.requestedPercent,
        diagnostics: win.__luminosLoaderDiagnostics
      });
    };

    win.addEventListener('error', (event) => {
      // Ignora fallos de recursos opcionales (IMG/texture); esos no traen error/message JS.
      if (win.__paperLoaded || !win.__paperLoaderActive || (!event.error && !event.message)) return;
      const where = event.filename
        ? `${event.filename.split('/').pop()}:${event.lineno || '?'}:${event.colno || '?'}`
        : 'script';
      win.paperLoadFailed(`JavaScript · ${describeError(event.error || event.message)} · ${where}`);
    });

    win.addEventListener('unhandledrejection', (event) => {
      if (win.__paperLoaded || !win.__paperLoaderActive) return;
      win.paperLoadFailed(`Promesa rechazada · ${describeError(event.reason)}`);
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
