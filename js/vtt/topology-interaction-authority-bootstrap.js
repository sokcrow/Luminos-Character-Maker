(function (root) {
    'use strict';

    const DIRECT = new Set(['open', 'close', 'lock', 'unlock', 'open_curtain', 'close_curtain']);
    let attempts = 0;
    let timer = null;

    function install() {
        const runtime = root.LuminousVttRuntime;
        const authorityApi = root.LuminousVttTopologyInteractionAuthority;
        if (!runtime?.controller || !runtime?.bridge || !runtime?.engine?.mapData || !authorityApi?.createAuthority) return false;
        if (root.LuminousVttTopologyInteractionAuthorityRuntime?.authority) return true;

        const controller = runtime.controller;
        const authority = authorityApi.createAuthority({
            mapData: runtime.engine.mapData,
            stateBridge: runtime.bridge,
            notify: (message, mode) => controller.notify?.(message, mode),
        });
        authority.start();

        const baseExecute = controller.executeInteractionAction.bind(controller);
        controller.executeInteractionAction = async function executeInteractionActionWithAuthority(action, model) {
            if (DIRECT.has(action?.id)) {
                const elementId = String(model?.elementId || '');
                if (!elementId) return controller.notify?.('El objeto ya no está disponible.', 'error');
                try {
                    return await authority.requestAction(elementId, action.id, model?.actorTokenId || null);
                } catch (error) {
                    controller.notify?.(String(error?.message || error), 'error');
                    return { valid: false, reason: error?.message || 'INTERACTION_FAILED' };
                }
            }
            return baseExecute(action, model);
        };

        const stop = () => authority.stop();
        root.addEventListener?.('beforeunload', stop, { once: true });
        root.LuminousVttTopologyInteractionAuthorityRuntime = Object.freeze({ authority, stop });
        return true;
    }

    function retry() {
        if (install()) {
            if (timer) root.clearInterval(timer);
            timer = null;
            return;
        }
        attempts += 1;
        if (attempts >= 80 && timer) {
            root.clearInterval(timer);
            timer = null;
            console.warn('Topology interaction authority bootstrap could not find the VTT runtime.');
        }
    }

    retry();
    if (!root.LuminousVttTopologyInteractionAuthorityRuntime?.authority) timer = root.setInterval(retry, 50);
})(typeof window !== 'undefined' ? window : globalThis);
