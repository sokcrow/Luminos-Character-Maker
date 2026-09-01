const clean = (value) => String(value ?? '').trim();

/**
 * Pointer-side interaction state for tactical tokens.
 *
 * This runtime deliberately delegates hit-testing and control permissions to
 * Engine.tokenAtEvent(), which already uses token-interaction + token-control.
 * It never writes hover/selection into canonical token state or Firebase.
 */
export function installTokenInteractionRuntime(host = globalThis) {
    if (host?.LuminousVttTokenInteractionRuntime?.__v1) return host.LuminousVttTokenInteractionRuntime;
    if (host?.LuminousVttTokenInteractionRuntime?.stop) host.LuminousVttTokenInteractionRuntime.stop();

    let stopped = false;
    let hoveredTokenId = '';
    let selectedTokenId = '';
    const metrics = {
        pointerMoves: 0,
        pointerDowns: 0,
        hoverChanges: 0,
        selectionChanges: 0,
        ignoredDuringDrag: 0,
        ignoredOutsideCanvas: 0,
        hitTests: 0,
        semanticEvents: 0,
    };

    const runtime = () => host?.LuminousVttRuntime || null;

    function eventCtor() {
        return host?.CustomEvent || globalThis.CustomEvent;
    }

    function eventTouchesCanvas(engine, event) {
        const canvas = engine?.canvas;
        if (!canvas || !event) return false;
        if (event.target === canvas) return true;
        try {
            return Array.isArray(event.composedPath?.()) && event.composedPath().includes(canvas);
        } catch (_) {
            return false;
        }
    }

    function emit(engine, type, detail) {
        const canvas = engine?.canvas;
        const EventCtor = eventCtor();
        if (!canvas?.dispatchEvent || typeof EventCtor !== 'function') return false;
        canvas.dispatchEvent(new EventCtor(type, { detail }));
        host?.LuminousVttSceneDirty?.emit?.(canvas, {
            reason: 'interaction',
            render: true,
            vision: false,
            active: true,
            sourceEvent: type,
            tokenId: detail?.tokenId || detail?.previousTokenId || null,
            meta: detail,
        });
        metrics.semanticEvents += 1;
        return true;
    }

    function idOf(token) {
        return clean(token?.id);
    }

    function setHovered(engine, token) {
        const next = idOf(token);
        if (next === hoveredTokenId) return false;
        const previous = hoveredTokenId;
        hoveredTokenId = next;
        metrics.hoverChanges += 1;
        emit(engine, 'vtt:token-hover-changed', {
            tokenId: next || null,
            previousTokenId: previous || null,
            hovered: Boolean(next),
            transient: true,
        });
        return true;
    }

    function setSelected(engine, token) {
        const next = idOf(token);
        if (next === selectedTokenId) return false;
        const previous = selectedTokenId;
        selectedTokenId = next;
        metrics.selectionChanges += 1;
        emit(engine, 'vtt:token-selection-changed', {
            tokenId: next || null,
            previousTokenId: previous || null,
            selected: Boolean(next),
            transient: true,
        });
        return true;
    }

    function hitTest(engine, event) {
        if (!engine || typeof engine.tokenAtEvent !== 'function') return null;
        metrics.hitTests += 1;
        try {
            return engine.tokenAtEvent(event) || null;
        } catch (_) {
            return null;
        }
    }

    function onMouseMove(event) {
        const engine = runtime()?.engine;
        if (!engine) return;
        metrics.pointerMoves += 1;

        if (engine.tokenDrag) {
            metrics.ignoredDuringDrag += 1;
            return;
        }

        if (!eventTouchesCanvas(engine, event)) {
            metrics.ignoredOutsideCanvas += 1;
            setHovered(engine, null);
            return;
        }

        setHovered(engine, hitTest(engine, event));
    }

    function onMouseDown(event) {
        const engine = runtime()?.engine;
        if (!engine || Number(event?.button ?? 0) !== 0 || engine.tokenMotion) return;
        metrics.pointerDowns += 1;
        if (!eventTouchesCanvas(engine, event)) return;
        const token = hitTest(engine, event);
        setHovered(engine, token);
        setSelected(engine, token);
    }

    function onBlur() {
        const engine = runtime()?.engine;
        if (engine) setHovered(engine, null);
    }

    host?.addEventListener?.('mousemove', onMouseMove, false);
    host?.addEventListener?.('mousedown', onMouseDown, false);
    host?.addEventListener?.('blur', onBlur, false);

    const api = Object.freeze({
        __v1: true,
        setHovered(token = null) {
            const engine = runtime()?.engine;
            return engine ? setHovered(engine, token) : false;
        },
        setSelected(token = null) {
            const engine = runtime()?.engine;
            return engine ? setSelected(engine, token) : false;
        },
        clearHover() {
            const engine = runtime()?.engine;
            return engine ? setHovered(engine, null) : false;
        },
        clearSelection() {
            const engine = runtime()?.engine;
            return engine ? setSelected(engine, null) : false;
        },
        snapshot() {
            return Object.freeze({
                ...metrics,
                hoveredTokenId: hoveredTokenId || null,
                selectedTokenId: selectedTokenId || null,
                dragging: Boolean(runtime()?.engine?.tokenDrag),
            });
        },
        stop() {
            if (stopped) return false;
            stopped = true;
            host?.removeEventListener?.('mousemove', onMouseMove, false);
            host?.removeEventListener?.('mousedown', onMouseDown, false);
            host?.removeEventListener?.('blur', onBlur, false);
            const engine = runtime()?.engine;
            if (engine) {
                setHovered(engine, null);
                setSelected(engine, null);
            }
            if (host.LuminousVttTokenInteractionRuntime === api) delete host.LuminousVttTokenInteractionRuntime;
            return true;
        },
    });

    host.LuminousVttTokenInteractionRuntime = api;
    return api;
}

if (typeof window !== 'undefined') installTokenInteractionRuntime(window);
