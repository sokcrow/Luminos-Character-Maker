import { Engine } from './engine.js';
import { TopologyController } from './topology-controller.js';
import { VerticalPortalController } from './vertical-portal-controller.js';
import { mockMapData } from './mapData.js';
import './map-authoring.js';
import './surface-core.js';
import './surface-renderer.js';
import './surface-authoring-patch.js';
import './structure-core.js';
import './structure-authoring-patch.js';
import './physical-resolver.js';
import './structure-topology-patch.js';
import './structure-physical-patch.js';
import './map-authoring-state.js';
import './map-switch-guard.js';
import './runtime-lifecycle.js';
import './topology-replace-state-patch.js';
import './actor-library.js';
import './actor-library-state.js';
import './token-appearance.js';
import './token-state-dynamic-patch.js';
import './pathfinding.js';
import './movement-engine.js';
import './movement-state.js';
import './physical-state-patch.js';
import './movement-integration-patch.js';
import './map-dialogue-overlay.js';

document.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('vtt-canvas');
    if (!canvas) {
        console.error('VTT Canvas not found!');
        return;
    }

    const lifecycle = globalThis.LuminousVttRuntimeLifecycle?.createLifecycle?.({ log: console }) || {
        dispose: () => true,
        isDisposed: () => false,
        run: async (_label, load, start) => ({ status: 'started', runtime: await start(await load()) }),
    };

    const mapAuthoring = globalThis.LuminousVttMapAuthoring;
    const mapAuthoringState = globalThis.LuminousVttMapAuthoringState;
    try {
        const activeDefinition = await mapAuthoringState?.resolveActiveDefinition?.({ fallback: mockMapData });
        if (activeDefinition) mapAuthoring?.applyDefinition?.(mockMapData, activeDefinition);
    } catch (error) {
        console.warn('VTT map authoring: falling back to bundled map.', error);
    }
    globalThis.LuminousVttSurfaceCore?.ensureMapState?.(mockMapData);
    globalThis.LuminousVttStructureCore?.ensureMapState?.(mockMapData);

    mockMapData.dmEditMode ||= { active: false };
    const engine = new Engine(canvas, mockMapData);
    const tokenAppearanceApi = globalThis.LuminousVttTokenAppearance;
    tokenAppearanceApi?.installRenderer?.(engine.renderer);
    let controller = null;
    let verticalController = null;
    let characterVisionBridge = null;

    const stateApi = globalThis.LuminousVttStateBridge;
    if (!stateApi) {
        console.error('VTT state bridge not found!');
        return;
    }

    const bridge = stateApi.createBridge({
        mapData: mockMapData,
        onTopologyChanged: () => controller?.handleTopologyChanged(),
        notify: (message, mode) => controller?.notify(message, mode),
    });

    const verticalStateApi = globalThis.LuminousVttVerticalPortalState;
    if (!verticalStateApi) {
        console.error('VTT vertical portal state bridge not found.');
        return;
    }

    const verticalBridge = verticalStateApi.createBridge({
        mapData: mockMapData,
        isDm: bridge.isDm,
        onChanged: () => verticalController?.handlePortalsChanged(),
        notify: (message, mode) => verticalController?.notify(message, mode),
    });

    verticalController = new VerticalPortalController(canvas, engine, mockMapData, verticalBridge);
    controller = new TopologyController(canvas, engine, mockMapData, bridge);
    verticalController.setTopologyController(controller);

    const tokenControlApi = globalThis.LuminousVttTokenControl;
    engine.setTokenControlResolver(tokenControlApi?.createResolver?.({ isDm: bridge.isDm }) || null);
    if (!bridge.isDm) {
        const viewer = (mockMapData.tokens || []).find((token) => token.characterLink?.mode === 'current_player');
        if (viewer) viewer.viewer = true;
    }

    const editMode = globalThis.LuminousVttDmEditMode?.createController?.({
        isDm: bridge.isDm,
        mapData: mockMapData,
        topologyController: controller,
        verticalPortalController: verticalController,
    }) || null;

    const applyLayer = (zLayer) => {
        engine.setZLayer(zLayer);
        controller.handleTopologyChanged();
        verticalController.handleLayerChanged();
    };

    const tokenStateApi = globalThis.LuminousVttTokenState;
    if (!tokenStateApi) {
        console.error('VTT canonical token state bridge not found.');
        return;
    }

    const tokenStateBridge = tokenStateApi.createBridge({
        mapData: mockMapData,
        isDm: bridge.isDm,
        notify: (message, mode) => controller?.notify(message, mode),
        onTokensChanged: (change = {}) => {
            characterVisionBridge?.syncTokens?.();
            const viewer = (mockMapData.tokens || []).find((token) => token.viewer === true)
                || (mockMapData.tokens || []).find((token) => token.characterLink?.mode === 'current_player')
                || null;
            const EventCtor = window.CustomEvent || globalThis.CustomEvent;
            if (typeof EventCtor === 'function') {
                canvas.dispatchEvent(new EventCtor('vtt:canonical-tokens-synced', {
                    detail: {
                        scope: String(change.scope || 'unknown'),
                        tokenIds: (mockMapData.tokens || []).map((token) => String(token?.id || '')).filter(Boolean),
                        viewerTokenId: viewer?.id ? String(viewer.id) : null,
                    },
                }));
            }
            if (bridge.isDm) return;
            const zLayer = Number(viewer?.zLayer ?? viewer?.gridPosition?.z ?? viewer?.z?.[0]);
            if (Number.isFinite(zLayer) && zLayer !== engine.activeZ) applyLayer(zLayer);
        },
    });

    bridge.start();
    verticalBridge.start();
    tokenStateBridge.start();

    const characterVisionApi = globalThis.LuminousVttCharacterVisionBridge;
    characterVisionBridge = characterVisionApi?.createBridge?.({
        mapData: mockMapData,
        onSensesChanged: () => {},
    }) || null;
    characterVisionBridge?.start?.();

    const checkPortal = globalThis.LuminousVttCheckPortal?.start?.() || null;

    const exportBtn = document.getElementById('btn-export-uv');
    const handleExport = () => engine.exportUVTemplate();
    exportBtn?.addEventListener('click', handleExport);

    const handleTokenMoved = (event) => {
        if (lifecycle.isDisposed()) return;
        const detail = event.detail || {};
        const token = (mockMapData.tokens || []).find((entry) => String(entry.id) === String(detail.tokenId));
        if (!token) return;
        tokenStateBridge.saveToken(token).catch((error) => {
            if (lifecycle.isDisposed()) return;
            console.error('VTT token persistence failed:', error);
            controller?.notify?.('No se pudo sincronizar la posición de la ficha.', 'error');
        });
    };
    canvas.addEventListener('vtt:token-moved', handleTokenMoved);

    const handleTokenZTransition = (event) => {
        if (lifecycle.isDisposed()) return;
        const detail = event.detail || {};
        const token = (mockMapData.tokens || []).find((entry) => String(entry.id) === String(detail.tokenId));
        if (detail.complete && token?.viewer === true && Number.isFinite(Number(detail.targetZ))) applyLayer(Number(detail.targetZ));
    };
    canvas.addEventListener('vtt:token-z-transition', handleTokenZTransition);

    engine.start();

    const initialMapId = String(mockMapData.id || mockMapData.mapId || 'default');
    const mapSwitchGuard = globalThis.LuminousVttMapSwitchGuard?.createGuard?.({
        currentMapId: initialMapId,
        resolveActiveDefinition: () => mapAuthoringState?.resolveActiveDefinition?.({ fallback: mockMapData }),
        reload: () => window.location.reload(),
        notify: (message, mode) => controller?.notify(message, mode),
        log: console,
    }) || null;
    const stopMapWatch = mapAuthoringState?.watchActiveMap?.({
        onChanged: (mapId) => {
            if (!mapId || String(mapId) === initialMapId || lifecycle.isDisposed()) return;
            if (!mapSwitchGuard) {
                console.error('VTT map switch guard unavailable; refusing blind reload.', { initialMapId, mapId });
                controller?.notify?.('No se pudo validar el cambio de mapa. Se mantiene el mapa actual.', 'error');
                return;
            }
            void mapSwitchGuard(mapId);
        },
    }) || (() => {});

    const handleKeydown = (event) => {
        if (lifecycle.isDisposed()) return;
        if (event.key === '0') applyLayer(0);
        else if (event.key === '1') applyLayer(1);
        else if (event.key === '2') applyLayer(2);
        else if (event.key === 'Escape') {
            controller.hideContextMenu();
            controller.setTool('select');
            verticalController.setTool('select', false);
        }
    };
    window.addEventListener('keydown', handleKeydown);

    function disposeRuntime(reason = 'vtt-document-teardown') {
        if (!lifecycle.dispose(reason)) return false;

        stopMapWatch();
        exportBtn?.removeEventListener?.('click', handleExport);
        canvas.removeEventListener('vtt:token-moved', handleTokenMoved);
        canvas.removeEventListener('vtt:token-z-transition', handleTokenZTransition);
        window.removeEventListener('keydown', handleKeydown);

        window.LuminousVttMapDialogueOverlay?.stop?.();
        window.LuminousVttWallBuilderRuntime?.stop?.();
        window.LuminousVttStructureRuntime?.stop?.();
        window.LuminousVttSurfaceRuntime?.stop?.();
        window.LuminousVttMapHudRuntime?.stop?.();
        window.LuminousVttRuntime?.mapSimulation?.stop?.();
        window.LuminousVttRuntime?.regionalLocalTransition?.stop?.();
        window.LuminousVttRuntime?.worldStreaming?.stop?.();
        window.LuminousVttRuntime?.proceduralChunks?.stop?.();
        window.LuminousVttRuntime?.procedural?.stop?.();
        window.LuminousVttRuntime?.movement?.stop?.();
        window.LuminousVttRuntime?.worldObjects?.stop?.();
        window.LuminousVttRuntime?.actorLibrary?.stop?.();
        window.LuminousVttRuntime?.mapAuthoring?.stop?.();
        editMode?.stop?.();
        characterVisionBridge?.stop?.();
        tokenStateBridge.stop();
        verticalController.destroy();
        verticalBridge.stop();
        bridge.stop();
        checkPortal?.stop?.();
        engine.stop();
        engine.camera?.destroy?.();
        window.removeEventListener('resize', engine.handleResize);
        canvas.removeEventListener('mousedown', engine.handleTokenMouseDown);
        window.removeEventListener('mousemove', engine.handleTokenMouseMove);
        window.removeEventListener('mouseup', engine.handleTokenMouseUp);
        return true;
    }

    window.LuminousVttRuntime = Object.freeze({
        engine,
        controller,
        bridge,
        verticalController,
        verticalBridge,
        tokenStateBridge,
        editMode,
        characterVisionBridge,
        setLayer: applyLayer,
        dispose: disposeRuntime,
        isDisposed: lifecycle.isDisposed,
    });

    const reportBootstrapError = (label, error) => {
        if (lifecycle.isDisposed()) return;
        console.error(`VTT ${label} bootstrap failed:`, error);
    };

    void (async () => {
        try {
            await lifecycle.run('map-authoring', () => import('./map-authoring-bootstrap.js'), (module) => module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData }));
            await lifecycle.run('surfaces', () => import('./surface-bootstrap.js'), (module) => module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData }));
            await lifecycle.run('structures', () => import('./structure-bootstrap.js'), (module) => module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData }));
        } catch (error) {
            reportBootstrapError('map authoring / surfaces / structures', error);
        }
    })();

    void lifecycle.run('wall-builder', () => import('./wall-builder-bootstrap.js'), (module) => module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData }))
        .catch((error) => reportBootstrapError('wall builder', error));

    void lifecycle.run('actor-library', () => import('./actor-library-bootstrap.js'), (module) => {
        const actorLibrary = module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData });
        if (!lifecycle.isDisposed()) tokenAppearanceApi?.installRenderer?.(engine.renderer);
        return actorLibrary;
    }).catch((error) => reportBootstrapError('actor library', error));

    void lifecycle.run('movement', () => import('./movement-bootstrap.js'), (module) => module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData }))
        .catch((error) => reportBootstrapError('movement', error));

    void (async () => {
        try {
            await lifecycle.run('procedural-generator', () => import('./procedural-generator-bootstrap.js'), (module) => module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData }));
            await lifecycle.run('procedural-chunks', () => import('./procedural-chunk-streaming-runtime.js'), (module) => module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData, procedural: window.LuminousVttRuntime?.procedural }));
            await lifecycle.run('regional-local-transition', () => import('./regional-local-transition-runtime.js'), (module) => module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData }));
            await lifecycle.run('map-simulation', () => import('./map-simulation-runtime.js'), (module) => module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData }));
        } catch (error) {
            reportBootstrapError('procedural / regional-local / map simulation', error);
        }
    })();

    void (async () => {
        try {
            await lifecycle.run('world-objects', () => import('./world-object-mainline-integration.js'), (module) => module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData }));
            await lifecycle.run('map-hud', () => import('./map-hud-bootstrap.js'), (module) => module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData }));
        } catch (error) {
            reportBootstrapError('world object / map HUD', error);
        }
    })();

    // E belongs exclusively to token PoV Look Lock/Unlock. Camera uses F/Home/Space and never consumes E.
    const handlePageHide = () => disposeRuntime('pagehide');
    const handleBeforeUnload = () => disposeRuntime('beforeunload');
    window.addEventListener('pagehide', handlePageHide, { once: true });
    window.addEventListener('beforeunload', handleBeforeUnload, { once: true });
});
