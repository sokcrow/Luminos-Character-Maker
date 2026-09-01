const clean = (value) => String(value ?? '').trim();

/**
 * Bridges transient token interaction events into persistent TokenViews.
 * No canonical token fields are mutated and no texture/material resources are
 * recreated; only TokenView.interaction changes.
 */
export function installTokenInteractionViews(renderer) {
    if (!renderer || renderer.backend !== 'webgl2' || !renderer.tokenViews) return renderer;
    if (renderer.__tokenInteractionViewsInstalled) return renderer;
    renderer.__tokenInteractionViewsInstalled = true;

    const tracked = {
        hovered: '',
        selected: '',
        targeted: '',
    };
    const stats = {
        events: 0,
        stateChanges: 0,
        noops: 0,
        clears: 0,
    };

    const patchFor = (kind, value) => ({ [kind]: Boolean(value) });

    const updateView = (tokenId, kind, value) => {
        const id = clean(tokenId);
        if (!id) return false;
        const view = renderer.tokenViews.get(id);
        if (!view || view.destroyed) return false;
        const changed = view.setInteractionState(patchFor(kind, value));
        if (changed) stats.stateChanges += 1;
        else stats.noops += 1;
        return changed;
    };

    const setTracked = (kind, tokenId) => {
        const next = clean(tokenId);
        const previous = clean(tracked[kind]);
        if (next === previous) {
            stats.noops += 1;
            return false;
        }
        if (previous) updateView(previous, kind, false);
        tracked[kind] = next;
        if (next) updateView(next, kind, true);
        else stats.clears += 1;
        return true;
    };

    const onHover = (event) => {
        stats.events += 1;
        setTracked('hovered', event?.detail?.tokenId);
    };
    const onSelection = (event) => {
        stats.events += 1;
        setTracked('selected', event?.detail?.tokenId);
    };
    const onTarget = (event) => {
        stats.events += 1;
        setTracked('targeted', event?.detail?.tokenId);
    };
    const onSceneDirty = (event) => {
        const detail = event?.detail || {};
        if (detail.reason !== 'token' || !detail.tokenId) return;
        const id = clean(detail.tokenId);
        if (renderer.tokenViews.get(id)) return;
        for (const kind of Object.keys(tracked)) {
            if (clean(tracked[kind]) === id) {
                tracked[kind] = '';
                stats.clears += 1;
            }
        }
    };

    renderer.setTokenHovered = (tokenId = null) => setTracked('hovered', tokenId);
    renderer.setTokenSelected = (tokenId = null) => setTracked('selected', tokenId);
    renderer.setTokenTargeted = (tokenId = null) => setTracked('targeted', tokenId);
    renderer.clearTokenInteraction = (kind = null) => {
        if (kind && Object.prototype.hasOwnProperty.call(tracked, kind)) return setTracked(kind, null);
        let changed = false;
        for (const key of Object.keys(tracked)) changed = setTracked(key, null) || changed;
        return changed;
    };

    renderer.canvas?.addEventListener?.('vtt:token-hover-changed', onHover);
    renderer.canvas?.addEventListener?.('vtt:token-selection-changed', onSelection);
    renderer.canvas?.addEventListener?.('vtt:token-target-changed', onTarget);
    renderer.canvas?.addEventListener?.('vtt:scene-dirty', onSceneDirty);

    if (typeof renderer.diagnostics === 'function') {
        const diagnostics = renderer.diagnostics.bind(renderer);
        renderer.diagnostics = (...args) => ({
            ...diagnostics(...args),
            tokenInteraction: {
                ...stats,
                hoveredTokenId: tracked.hovered || null,
                selectedTokenId: tracked.selected || null,
                targetedTokenId: tracked.targeted || null,
            },
        });
    }

    if (typeof renderer.destroy === 'function') {
        const destroy = renderer.destroy.bind(renderer);
        renderer.destroy = (...args) => {
            renderer.canvas?.removeEventListener?.('vtt:token-hover-changed', onHover);
            renderer.canvas?.removeEventListener?.('vtt:token-selection-changed', onSelection);
            renderer.canvas?.removeEventListener?.('vtt:token-target-changed', onTarget);
            renderer.canvas?.removeEventListener?.('vtt:scene-dirty', onSceneDirty);
            renderer.clearTokenInteraction?.();
            return destroy(...args);
        };
    }

    return renderer;
}
