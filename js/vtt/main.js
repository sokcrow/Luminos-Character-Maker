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
import './movement-connectivity.js';
import './movement-destination-claims.js';
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

    const stopIfDisposed = (runtime, label = 'runtime') => {
        if (!lifecycle.isDisposed()) return false;
        try {
            runtime?.stop?.();
        } catch (error) {
            console.warn(`VTT lifecycle late-stop failed for ${label}.`, error);
        }
        return true;
    };

    const reportBootstrapError = (label, error) => {
        if (lifecycle.isDisposed()) return;
        console.error(`VTT ${label} bootstrap failed:`, error);
    };

    import('./map-authoring-bootstrap.js')
        .then(async (module) => {
            if (lifecycle.isDisposed()) return null;
            const mapAuthoringRuntime = await module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData });
            if (stopIfDisposed(mapAuthoringRuntime, 'map-authoring')) return null;

            const surfaceModule = await import('./surface-bootstrap.js');
            if (lifecycle.isDisposed()) return null;
            const surfaceRuntime = await surfaceModule.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData });
            if (stopIfDisposed(surfaceRuntime, 'surfaces')) return null;

            const structureModule = await import('./structure-bootstrap.js');
            if (lifecycle.isDisposed()) return null;
            const structureRuntime = await structureModule.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData });
            if (stopIfDisposed(structureRuntime, 'structures')) return null;
            return structureRuntime;
        })
        .catch((error) => reportBootstrapError('map authoring / surfaces / structures', error));

    import('./wall-builder-bootstrap.js')
        .then(async (module) => {
            if (lifecycle.isDisposed()) return null;
            const runtime = await module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData });
            if (stopIfDisposed(runtime, 'wall-builder')) return null;
            return runtime;
        })
        .catch((error) => reportBootstrapError('wall builder', error));

    import('./actor-library-bootstrap.js')
        .then(async (module) => {
            if (lifecycle.isDisposed()) return null;
            const actorLibrary = module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData });
            const resolvedActorLibrary = await actorLibrary;
            if (stopIfDisposed(resolvedActorLibrary, 'actor-library')) return null;
            tokenAppearanceApi?.installRenderer?.(engine.renderer);
            return resolvedActorLibrary;
        })
        .catch((error) => reportBootstrapError('actor library', error));

    import('./movement-bootstrap.js')
        .then(async (module) => {
            if (lifecycle.isDisposed()) return null;
            const runtime = await module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData });
            if (stopIfDisposed(runtime, 'movement')) return null;
            return runtime;
        })
        .catch((error) => reportBootstrapError('movement', error));

    import('./procedural-generator-bootstrap.js')
        .then(async (generatorModule) => {
            if (lifecycle.isDisposed()) return null;
            const proceduralRuntime = await generatorModule.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData });
            if (stopIfDisposed(proceduralRuntime, 'procedural-generator')) return null;

            const chunkModule = await import('./procedural-chunk-streaming-runtime.js');
            if (lifecycle.isDisposed()) return null;
            const chunkRuntime = await chunkModule.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData, procedural: window.LuminousVttRuntime?.procedural });
            if (stopIfDisposed(chunkRuntime, 'procedural-chunks')) return null;

            const transitionModule = await import('./regional-local-transition-runtime.js');
            if (lifecycle.isDisposed()) return null;
            const transitionRuntime = await transitionModule.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData });
            if (stopIfDisposed(transitionRuntime, 'regional-local-transition')) return null;

            const simulationModule = await import('./map-simulation-runtime.js');
            if (lifecycle.isDisposed()) return null;
            const simulationRuntime = await simulationModule.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData });
            if (stopIfDisposed(simulationRuntime, 'map-simulation')) return null;
            return simulationRuntime;
        })
        .catch((error) => reportBootstrapError('procedural / regional-local / map simulation', error));

    import('./world-object-mainline-integration.js')
        .then(async (module) => {
            if (lifecycle.isDisposed()) return null;
            const worldObjectsRuntime = await module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData });
            if (stopIfDisposed(worldObjectsRuntime, 'world-objects')) return null;

            const hudModule = await import('./map-hud-bootstrap.js');
            if (lifecycle.isDisposed()) return null;
            const hudRuntime = await hudModule.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData });
            if (stopIfDisposed(hudRuntime, 'map-hud')) return null;
            return hudRuntime;
        })
        .catch((error) => reportBootstrapError('world object / map HUD', error));

    // E belongs exclusively to token PoV Look Lock/Unlock. Camera uses F/Home/Space and never consumes E.
    const handlePageHide = () => disposeRuntime('pagehide');
    const handleBeforeUnload = () => disposeRuntime('beforeunload');
    window.addEventListener('pagehide', handlePageHide, { once: true });
    window.addEventListener('beforeunload', handleBeforeUnload, { once: true });
});
