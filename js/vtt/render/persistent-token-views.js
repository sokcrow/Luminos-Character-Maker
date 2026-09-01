import { TokenViewRegistry } from './token-view-registry.js';

const cleanId = (value) => String(value ?? '').trim();

/**
 * Installs the persistent token-view lifecycle on the WebGL2 backend.
 *
 * Step 2 keeps one bootstrap/full sync, then follows token-specific scene-dirty
 * events so a movement update touches one TokenView instead of walking every
 * token before every render. Token dirties without an id remain a safe batch
 * fallback for bootstrap/structural changes.
 *
 * Later render layers may decorate renderer.syncTokenView/syncTokenViews (for
 * example the Actor texture layer). Scene-dirty deliberately goes through those
 * public renderer APIs so each layer can react to the same targeted canonical
 * update without creating a parallel event path.
 */
export function installPersistentTokenViews(renderer) {
    if (!renderer || renderer.backend !== 'webgl2') return renderer;
    if (renderer.__persistentTokenViewsInstalled) return renderer;

    const registry = new TokenViewRegistry();
    renderer.tokenViews = registry;
    renderer.__persistentTokenViewsInstalled = true;

    const fullSync = () => {
        if (renderer.destroyed) return registry.size;
        return registry.sync(renderer.mapData?.tokens || []);
    };

    const targetedSync = (tokenId) => {
        if (renderer.destroyed) return false;
        const id = cleanId(tokenId);
        if (!id) {
            fullSync();
            return false;
        }

        const currentView = registry.get(id);
        const currentToken = currentView?.token;
        if (currentToken && cleanId(currentToken.id) === id && (renderer.mapData?.tokens || []).includes(currentToken)) {
            registry.syncToken(currentToken);
            return true;
        }

        const token = (renderer.mapData?.tokens || []).find((entry) => cleanId(entry?.id) === id);
        if (token) {
            registry.syncToken(token);
            return true;
        }

        registry.remove(id);
        return false;
    };

    renderer.syncTokenViews = fullSync;
    renderer.syncTokenView = targetedSync;

    const onSceneDirty = (event) => {
        const detail = event?.detail || {};
        if (detail.reason !== 'token') return;
        const id = cleanId(detail.tokenId);
        if (id) renderer.syncTokenView?.(id);
        else renderer.syncTokenViews?.();
    };

    renderer.canvas?.addEventListener?.('vtt:scene-dirty', onSceneDirty);

    // Bootstrap existing tokens exactly once. Subsequent renders do not scan the
    // whole token list; scene-dirty is now the synchronization boundary.
    fullSync();

    if (typeof renderer.diagnostics === 'function') {
        const diagnostics = renderer.diagnostics.bind(renderer);
        renderer.diagnostics = (...args) => ({
            ...diagnostics(...args),
            tokenViews: registry.diagnostics(),
        });
    }

    if (typeof renderer.destroy === 'function') {
        const destroy = renderer.destroy.bind(renderer);
        renderer.destroy = (...args) => {
            renderer.canvas?.removeEventListener?.('vtt:scene-dirty', onSceneDirty);
            registry.clear();
            return destroy(...args);
        };
    }

    return renderer;
}
