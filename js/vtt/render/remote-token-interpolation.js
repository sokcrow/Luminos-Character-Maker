const clean = (value) => String(value ?? '').trim();
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function layerOf(token = {}, fallback = 0) {
    if (Number.isFinite(Number(token.zLayer))) return Number(token.zLayer);
    if (Number.isFinite(Number(token.gridPosition?.z))) return Number(token.gridPosition.z);
    if (Array.isArray(token.z) && token.z.length && Number.isFinite(Number(token.z[0]))) return Number(token.z[0]);
    return finite(fallback);
}

function positionOfView(view) {
    return {
        x: finite(view?.x),
        y: finite(view?.y),
        zLayer: finite(view?.zLayer),
    };
}

function renderedPosition(renderer, view) {
    const preview = renderer.tokenPreview?.(view?.id) || null;
    return preview || {
        x: finite(view?.renderX, view?.x),
        y: finite(view?.renderY, view?.y),
        zLayer: finite(view?.renderZLayer, view?.zLayer),
    };
}

function tokenFor(renderer, tokenId, view = null) {
    if (view?.token) return view.token;
    return (renderer.mapData?.tokens || []).find((token) => clean(token?.id) === clean(tokenId)) || null;
}

function restoreCanonicalToken(token, canonical) {
    if (!token || !canonical) return false;
    token.x = canonical.x;
    token.y = canonical.y;
    token.zLayer = canonical.zLayer;
    token.z = [canonical.zLayer];
    if (token.gridPosition && typeof token.gridPosition === 'object') {
        token.gridPosition.z = canonical.zLayer;
    }
    return true;
}

function positionsNear(left, right, epsilon = 0.01) {
    if (!left || !right) return false;
    return Math.abs(finite(left.x) - finite(right.x)) <= epsilon
        && Math.abs(finite(left.y) - finite(right.y)) <= epsilon
        && Math.abs(finite(left.zLayer) - finite(right.zLayer)) <= epsilon;
}

/**
 * Smooths remote movement snapshots entirely on the render side.
 *
 * movement-realtime historically applies incoming previews to token.x/y before
 * dispatching vtt:token-preview-moved. On WebGL2 this bridge immediately restores
 * the canonical token from TokenView state and moves only previewPosition. The
 * same persistent TokenView, visual resource, and Actor WebGLTexture are retained.
 */
export function installRemoteTokenInterpolation(renderer, options = {}) {
    if (!renderer || renderer.backend !== 'webgl2' || !renderer.tokenViews || typeof renderer.previewToken !== 'function') return renderer;
    if (renderer.__remoteTokenInterpolationInstalled) return renderer;
    renderer.__remoteTokenInterpolationInstalled = true;

    const host = options.host || globalThis;
    const now = typeof options.now === 'function'
        ? options.now
        : () => host?.performance?.now?.() ?? Date.now();
    const raf = typeof options.raf === 'function'
        ? options.raf
        : host?.requestAnimationFrame?.bind(host) || ((fn) => host?.setTimeout?.(() => fn(now()), 16));
    const caf = typeof options.caf === 'function'
        ? options.caf
        : host?.cancelAnimationFrame?.bind(host) || host?.clearTimeout?.bind(host);
    const setTimeoutFn = typeof options.setTimeoutFn === 'function'
        ? options.setTimeoutFn
        : host?.setTimeout?.bind(host) || setTimeout;
    const clearTimeoutFn = typeof options.clearTimeoutFn === 'function'
        ? options.clearTimeoutFn
        : host?.clearTimeout?.bind(host) || clearTimeout;

    const minDurationMs = Math.max(16, finite(options.minDurationMs, 60));
    const maxDurationMs = Math.max(minDurationMs, finite(options.maxDurationMs, 160));
    const defaultDurationMs = clamp(finite(options.defaultDurationMs, 100), minDurationMs, maxDurationMs);
    const selfEchoWindowMs = Math.max(250, finite(options.selfEchoWindowMs, 1800));
    const sequenceRestartMs = Math.max(250, finite(options.sequenceRestartMs, 1200));
    const canonicalHoldMs = Math.max(250, finite(options.canonicalHoldMs, 1500));

    const tracks = new Map();
    const recentLocal = new Map();
    let frameId = null;
    let destroyed = false;
    const stats = {
        remoteEvents: 0,
        acceptedSnapshots: 0,
        droppedOutOfOrder: 0,
        selfEchoesIgnored: 0,
        canonicalRestores: 0,
        retargets: 0,
        frames: 0,
        previewUpdates: 0,
        completedTransitions: 0,
        reverts: 0,
        committedHolds: 0,
        canonicalReleases: 0,
    };

    function emitRender(tokenId) {
        const id = clean(tokenId);
        const dirty = host?.LuminousVttSceneDirty;
        if (dirty?.emit && renderer.canvas) {
            dirty.emit(renderer.canvas, {
                reason: 'token',
                render: true,
                vision: false,
                active: true,
                sourceEvent: 'remote-token-interpolation',
                tokenId: id || null,
                meta: { remote: true, interpolated: true },
            });
            return;
        }
        const layer = renderer.layers?.get?.('tokens');
        if (layer) layer.dirty = true;
    }

    function cancelHold(track) {
        if (track?.holdTimer != null) clearTimeoutFn(track.holdTimer);
        if (track) track.holdTimer = null;
    }

    function currentCanonical(id, view = renderer.tokenViews.get(id)) {
        const token = tokenFor(renderer, id, view);
        return token
            ? { x: finite(token.x, view?.x), y: finite(token.y, view?.y), zLayer: layerOf(token, view?.zLayer) }
            : positionOfView(view);
    }

    function canonicalFromView(view) {
        return positionOfView(view);
    }

    function restoreFromTrack(id, track, view = renderer.tokenViews.get(id)) {
        const token = tokenFor(renderer, id, view);
        if (!token || !track?.canonical) return false;
        const restored = restoreCanonicalToken(token, track.canonical);
        if (restored) stats.canonicalRestores += 1;
        return restored;
    }

    function durationFor(track, acceptedAt) {
        const delta = track?.lastAcceptedAt == null ? defaultDurationMs : acceptedAt - track.lastAcceptedAt;
        return clamp(delta > 0 ? delta : defaultDurationMs, minDurationMs, maxDurationMs);
    }

    function scheduleFrame() {
        if (destroyed || frameId != null) return;
        frameId = raf(step);
    }

    function beginTransition(id, target, { clearAfter = false, reverted = false, sequence = null, acceptedAt = now() } = {}) {
        const view = renderer.tokenViews.get(id);
        if (!view || view.destroyed) return false;
        const existing = tracks.get(id) || null;
        const from = renderedPosition(renderer, view);
        const canonical = existing?.canonical || canonicalFromView(view);
        const durationMs = durationFor(existing, acceptedAt);
        const track = existing || {
            id,
            canonical,
            lastSequence: null,
            lastAcceptedAt: null,
            target: { ...from },
            from: { ...from },
            startAt: acceptedAt,
            durationMs,
            animating: false,
            clearAfter: false,
            awaitingCanonical: false,
            holdTimer: null,
        };
        cancelHold(track);
        track.from = { ...from };
        track.target = {
            x: finite(target?.x, from.x),
            y: finite(target?.y, from.y),
            zLayer: finite(target?.zLayer, from.zLayer),
        };
        track.startAt = acceptedAt;
        track.durationMs = durationMs;
        track.animating = true;
        track.clearAfter = Boolean(clearAfter);
        track.awaitingCanonical = false;
        if (sequence != null) track.lastSequence = Number(sequence);
        track.lastAcceptedAt = acceptedAt;
        tracks.set(id, track);
        stats.retargets += 1;
        if (reverted) stats.reverts += 1;
        scheduleFrame();
        return true;
    }

    function releaseToCanonical(id, reason = 'release') {
        const track = tracks.get(id);
        const view = renderer.tokenViews.get(id);
        if (!track || !view) return false;
        cancelHold(track);
        track.awaitingCanonical = false;
        return beginTransition(id, track.canonical || currentCanonical(id, view), {
            clearAfter: true,
            reverted: reason !== 'committed',
            sequence: track.lastSequence,
            acceptedAt: now(),
        });
    }

    function holdUntilCanonical(id, track) {
        if (!track) return false;
        cancelHold(track);
        track.animating = false;
        track.clearAfter = false;
        track.awaitingCanonical = true;
        track.holdTimer = setTimeoutFn(() => {
            const current = tracks.get(id);
            if (!current || !current.awaitingCanonical) return;
            releaseToCanonical(id, 'timeout');
        }, canonicalHoldMs);
        stats.committedHolds += 1;
        return true;
    }

    function step(timestamp) {
        frameId = null;
        if (destroyed) return;
        const frameNow = Number.isFinite(Number(timestamp)) ? Number(timestamp) : now();
        let stillAnimating = false;

        for (const [id, track] of [...tracks.entries()]) {
            if (!track.animating) continue;
            const view = renderer.tokenViews.get(id);
            if (!view || view.destroyed) {
                cancelHold(track);
                tracks.delete(id);
                continue;
            }
            const duration = Math.max(1, finite(track.durationMs, defaultDurationMs));
            const t = clamp((frameNow - finite(track.startAt, frameNow)) / duration, 0, 1);
            const eased = t * (2 - t);
            const next = {
                x: track.from.x + ((track.target.x - track.from.x) * eased),
                y: track.from.y + ((track.target.y - track.from.y) * eased),
                zLayer: t >= 1 ? track.target.zLayer : track.from.zLayer,
            };
            if (renderer.previewToken(id, next)) {
                stats.previewUpdates += 1;
                emitRender(id);
            }
            stats.frames += 1;

            if (t >= 1) {
                track.animating = false;
                stats.completedTransitions += 1;
                if (track.clearAfter) {
                    renderer.clearTokenPreview?.(id);
                    emitRender(id);
                    cancelHold(track);
                    tracks.delete(id);
                }
            } else {
                stillAnimating = true;
            }
        }

        if (stillAnimating) scheduleFrame();
    }

    function pruneRecentLocal(at = now()) {
        for (const [id, seenAt] of recentLocal.entries()) {
            if (at - seenAt > selfEchoWindowMs) recentLocal.delete(id);
        }
    }

    function onPreview(event) {
        const detail = event?.detail || {};
        const id = clean(detail.tokenId);
        if (!id) return;
        const at = now();

        if (detail.remote !== true) {
            recentLocal.set(id, at);
            return;
        }

        stats.remoteEvents += 1;
        pruneRecentLocal(at);
        const view = renderer.tokenViews.get(id);
        if (!view || view.destroyed) return;
        let track = tracks.get(id) || null;
        if (!track) {
            track = {
                id,
                canonical: canonicalFromView(view),
                lastSequence: null,
                lastAcceptedAt: null,
                target: renderedPosition(renderer, view),
                from: renderedPosition(renderer, view),
                startAt: at,
                durationMs: defaultDurationMs,
                animating: false,
                clearAfter: false,
                awaitingCanonical: false,
                holdTimer: null,
            };
            tracks.set(id, track);
        }

        restoreFromTrack(id, track, view);

        if (recentLocal.has(id) && at - recentLocal.get(id) <= selfEchoWindowMs) {
            stats.selfEchoesIgnored += 1;
            if (!track.animating && !track.awaitingCanonical) tracks.delete(id);
            return;
        }

        const sequence = Number.isFinite(Number(detail.sequence)) ? Number(detail.sequence) : null;
        if (sequence != null && track.lastSequence != null && sequence <= track.lastSequence
            && at - finite(track.lastAcceptedAt, at) < sequenceRestartMs) {
            stats.droppedOutOfOrder += 1;
            return;
        }

        if (detail.canonicalRefresh === true && sequence != null && track.lastSequence === sequence) return;

        if (detail.cleared === true) {
            if (detail.committed === true) {
                holdUntilCanonical(id, track);
                return;
            }
            releaseToCanonical(id, detail.reverted || detail.expired ? 'revert' : 'clear');
            return;
        }

        const target = {
            x: finite(detail.x, renderedPosition(renderer, view).x),
            y: finite(detail.y, renderedPosition(renderer, view).y),
            zLayer: finite(detail.z ?? detail.zLayer, renderedPosition(renderer, view).zLayer),
        };
        stats.acceptedSnapshots += 1;
        beginTransition(id, target, { sequence, acceptedAt: at });
    }

    function onCanonicalSync() {
        for (const [id, track] of [...tracks.entries()]) {
            const view = renderer.tokenViews.get(id);
            const token = tokenFor(renderer, id, view);
            if (!view || !token) continue;
            track.canonical = {
                x: finite(token.x, view.x),
                y: finite(token.y, view.y),
                zLayer: layerOf(token, view.zLayer),
            };
            if (track.awaitingCanonical && positionsNear(track.canonical, track.target)) {
                cancelHold(track);
                renderer.clearTokenPreview?.(id);
                emitRender(id);
                tracks.delete(id);
                stats.canonicalReleases += 1;
            }
        }
    }

    function onSceneDirty(event) {
        const detail = event?.detail || {};
        if (detail.reason !== 'token' || !detail.tokenId) return;
        const id = clean(detail.tokenId);
        const view = renderer.tokenViews.get(id);
        if (view) return;
        const track = tracks.get(id);
        if (track) cancelHold(track);
        tracks.delete(id);
        recentLocal.delete(id);
    }

    renderer.canvas?.addEventListener?.('vtt:token-preview-moved', onPreview);
    renderer.canvas?.addEventListener?.('vtt:canonical-tokens-synced', onCanonicalSync);
    renderer.canvas?.addEventListener?.('vtt:scene-dirty', onSceneDirty);

    renderer.clearRemoteTokenInterpolation = (tokenId = null) => {
        if (tokenId != null) {
            const id = clean(tokenId);
            const track = tracks.get(id);
            if (track) cancelHold(track);
            tracks.delete(id);
            recentLocal.delete(id);
            return renderer.clearTokenPreview?.(id) === true;
        }
        for (const track of tracks.values()) cancelHold(track);
        tracks.clear();
        recentLocal.clear();
        return renderer.clearTokenPreviews?.() || 0;
    };

    if (typeof renderer.diagnostics === 'function') {
        const diagnostics = renderer.diagnostics.bind(renderer);
        renderer.diagnostics = (...args) => ({
            ...diagnostics(...args),
            remoteTokenInterpolation: {
                ...stats,
                activeTracks: tracks.size,
                animating: [...tracks.values()].filter((track) => track.animating).length,
                awaitingCanonical: [...tracks.values()].filter((track) => track.awaitingCanonical).length,
            },
        });
    }

    if (typeof renderer.destroy === 'function') {
        const destroy = renderer.destroy.bind(renderer);
        renderer.destroy = (...args) => {
            destroyed = true;
            if (frameId != null) caf?.(frameId);
            frameId = null;
            renderer.canvas?.removeEventListener?.('vtt:token-preview-moved', onPreview);
            renderer.canvas?.removeEventListener?.('vtt:canonical-tokens-synced', onCanonicalSync);
            renderer.canvas?.removeEventListener?.('vtt:scene-dirty', onSceneDirty);
            for (const track of tracks.values()) cancelHold(track);
            tracks.clear();
            recentLocal.clear();
            return destroy(...args);
        };
    }

    return renderer;
}
