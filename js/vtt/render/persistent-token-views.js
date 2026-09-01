import { TokenViewRegistry } from './token-view-registry.js';

/**
 * Installs the persistent token-view lifecycle on the WebGL2 backend while the
 * native GPU token pipeline is still being migrated into WebGL2Renderer.
 *
 * The registry is synchronized from renderer.mapData.tokens before each render
 * (and before legacy drawTokens seams), so token identity survives position/state
 * changes and removed tokens are deterministically destroyed.
 */
export function installPersistentTokenViews(renderer) {
    if (!renderer || renderer.backend !== 'webgl2') return renderer;
    if (renderer.__persistentTokenViewsInstalled) return renderer;

    const registry = new TokenViewRegistry();
    renderer.tokenViews = registry;
    renderer.__persistentTokenViewsInstalled = true;

    const syncTokenViews = () => {
        if (renderer.destroyed) return registry.size;
        return registry.sync(renderer.mapData?.tokens || []);
    };

    if (typeof renderer.drawTokens === 'function') {
        const drawTokens = renderer.drawTokens.bind(renderer);
        renderer.drawTokens = (...args) => {
            syncTokenViews();
            return drawTokens(...args);
        };
    }

    if (typeof renderer.render === 'function') {
        const render = renderer.render.bind(renderer);
        renderer.render = (...args) => {
            syncTokenViews();
            return render(...args);
        };
    }

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
            registry.clear();
            return destroy(...args);
        };
    }

    return renderer;
}
