const cleanId = (value) => String(value ?? '').trim();
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function layerOf(token = {}, fallback = 0) {
    if (Number.isFinite(Number(token.zLayer))) return Number(token.zLayer);
    if (Number.isFinite(Number(token.gridPosition?.z))) return Number(token.gridPosition.z);
    if (Array.isArray(token.z) && token.z.length && Number.isFinite(Number(token.z[0]))) return Number(token.z[0]);
    return finite(fallback);
}

function previewTokenClone(token, preview) {
    const zLayer = finite(preview?.zLayer, layerOf(token));
    return {
        ...token,
        x: finite(preview?.x, token?.x),
        y: finite(preview?.y, token?.y),
        zLayer,
        z: [zLayer],
        gridPosition: token?.gridPosition ? { ...token.gridPosition, z: zLayer } : token?.gridPosition,
        transientPreview: true,
    };
}

/**
 * Renderer-wide transient token preview API.
 *
 * The canonical token object never changes. WebGL2 stores preview coordinates on
 * its persistent TokenView. Canvas2D swaps a shallow preview clone into the token
 * array only for the synchronous drawTokens call and restores the original entry
 * immediately afterwards.
 */
export function installTransientTokenPreview(renderer) {
    if (!renderer || renderer.__transientTokenPreviewInstalled) return renderer;

    const previews = new Map();
    const stats = { updates: 0, clears: 0 };
    renderer.__transientTokenPreviewInstalled = true;

    renderer.previewToken = (tokenId, position = {}) => {
        if (renderer.destroyed) return false;
        const id = cleanId(tokenId);
        if (!id) return false;
        const token = (renderer.mapData?.tokens || []).find((entry) => cleanId(entry?.id) === id);
        if (!token) return false;
        const next = {
            x: finite(position.x, token.x),
            y: finite(position.y, token.y),
            zLayer: finite(position.zLayer, layerOf(token)),
        };
        const current = previews.get(id);
        if (current && current.x === next.x && current.y === next.y && current.zLayer === next.zLayer) return false;
        previews.set(id, next);
        renderer.tokenViews?.setPreview?.(id, next);
        stats.updates += 1;
        return true;
    };

    renderer.clearTokenPreview = (tokenId) => {
        const id = cleanId(tokenId);
        if (!id) return false;
        const removed = previews.delete(id);
        const viewCleared = renderer.tokenViews?.clearPreview?.(id) === true;
        if (removed || viewCleared) stats.clears += 1;
        return removed || viewCleared;
    };

    renderer.clearTokenPreviews = () => {
        const ids = [...previews.keys()];
        let cleared = 0;
        for (const id of ids) if (renderer.clearTokenPreview(id)) cleared += 1;
        renderer.tokenViews?.clearPreviews?.();
        return cleared;
    };

    renderer.tokenPreview = (tokenId) => previews.get(cleanId(tokenId)) || null;

    if (renderer.backend === 'canvas2d' && typeof renderer.drawTokens === 'function') {
        const drawTokens = renderer.drawTokens.bind(renderer);
        renderer.drawTokens = (...args) => {
            if (!previews.size) return drawTokens(...args);
            const tokens = renderer.mapData?.tokens;
            if (!Array.isArray(tokens) || !tokens.length) return drawTokens(...args);

            const swaps = [];
            for (const [id, preview] of previews) {
                const index = tokens.findIndex((token) => cleanId(token?.id) === id);
                if (index < 0) continue;
                const canonical = tokens[index];
                swaps.push([index, canonical]);
                tokens[index] = previewTokenClone(canonical, preview);
            }

            try {
                return drawTokens(...args);
            } finally {
                for (const [index, canonical] of swaps) tokens[index] = canonical;
            }
        };
    }

    if (typeof renderer.diagnostics === 'function') {
        const diagnostics = renderer.diagnostics.bind(renderer);
        renderer.diagnostics = (...args) => ({
            ...diagnostics(...args),
            transientTokenPreview: {
                ...stats,
                active: previews.size,
            },
        });
    }

    if (typeof renderer.destroy === 'function') {
        const destroy = renderer.destroy.bind(renderer);
        renderer.destroy = (...args) => {
            renderer.clearTokenPreviews();
            previews.clear();
            return destroy(...args);
        };
    }

    return renderer;
}
