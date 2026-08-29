import { Engine } from './engine.js';
import { TopologyController } from './topology-controller.js';
import { VerticalPortalController } from './vertical-portal-controller.js';
import { mockMapData } from './mapData.js';
import './map-authoring.js';
import './map-authoring-state.js';
import './map-switch-guard.js';
import './actor-library.js';
import './actor-library-state.js';
import './token-state-dynamic-patch.js';
import './pathfinding.js';
import './movement-engine.js';
import './movement-state.js';
import './movement-integration-patch.js';

document.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('vtt-canvas');
    if (!canvas) {
        console.error('VTT Canvas not found!');
        return;
    }

    const mapAuthoring = globalThis.LuminousVttMapAuthoring;
    const mapAuthoringState = globalThis.LuminousVttMapAuthoringState;
    try {
        const activeDefinition = await mapAuthoringState?.resolveActiveDefinition?.({ fallback: mockMapData });
        if (activeDefinition) mapAuthoring?.applyDefinition?.(mockMapData, activeDefinition);
    } catch (error) {
        console.warn('VTT map authoring: falling back to bundled map.', error);
    }

    mockMapData.dmEditMode ||= { active: false };
    const engine = new Engine(canvas, mockMapData);
    let controller = null;
    let verticalController = null;

    const stateApi = globalThis.LuminousVttStateBridge;
    if (!stateApi) {
        console.error('VTT state bridge not found.');
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

    // Z tools bind first so an active vertical authoring tool wins over topology/token drag.
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
        onTokensChanged: () => {
            if (bridge.isDm) return;
            const viewer = (mockMapData.tokens || []).find((token) => token.viewer === true)
                || (mockMapData.tokens || []).find((token) => token.characterLink?.mode === 'current_player');
            const zLayer = Number(viewer?.zLayer ?? viewer?.gridPosition?.z ?? viewer?.z?.[0]);
            if (Number.isFinite(zLayer) && zLayer !== engine.activeZ) applyLayer(zLayer);
        },
    });

    bridge.start();
    verticalBridge.start();
    tokenStateBridge.start();

    const characterVisionApi = globalThis.LuminousVttCharacterVisionBridge;
    const characterVisionBridge = characterVisionApi?.createBridge?.({
        mapData: mockMapData,
        onSensesChanged: () => {},
    }) || null;
    characterVisionBridge?.start?.();

    const checkPortal = globalThis.LuminousVttCheckPortal?.start?.() || null;

    const exportBtn = document.getElementById('btn-export-uv');
    exportBtn?.addEventListener('click', () => engine.exportUVTemplate());

    canvas.addEventListener('vtt:token-moved', (event) => {
        const detail = event.detail || {};
        const token = (mockMapData.tokens || []).find((entry) => String(entry.id) === String(detail.tokenId));
        if (!token) return;
        tokenStateBridge.saveToken(token).catch((error) => {
            console.error('VTT token persistence failed:', error);
            controller?.notify?.('No se pudo sincronizar la posición de la ficha.', 'error');
        });
    });

    canvas.addEventListener('vtt:token-z-transition', (event) => {
        const detail = event.detail || {};
        const token = (mockMapData.tokens || []).find((entry) => String(entry.id) === String(detail.tokenId));
        if (detail.complete && token?.viewer === true && Number.isFinite(Number(detail.targetZ))) applyLayer(Number(detail.targetZ));
    });

    engine.start();

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
    });

    const initialMapId = String(mockMapData.id || mockMapData.mapId || 'default');
    const mapSwitchGuard = globalThis.LuminousVttMapSwitchGuard?.createGuard?.({
        currentMapId: initialMapId,
        resolveActiveDefinition: () => mapAuthoringState?.resolveActiveDefinition?.({ fallback: mockMapData }),
        reload: () => window.location.reload(),
        notify: (message, mode) => controller?.notify?.(message, mode),
        log: console,
    }) || null;
    const stopMapWatch = mapAuthoringState?.watchActiveMap?.({
        onChanged: (mapId) => {
            if (!mapId || String(mapId) === initialMapId) return;
            if (!mapSwitchGuard) {
                console.error('VTT map switch guard unavailable; refusing blind reload.', { initialMapId, mapId });
                controller?.notify?.('No se pudo validar el cambio de mapa. Se mantiene el mapa actual.', 'error');
                return;
            }
            void mapSwitchGuard(mapId);
        },
    }) || (() => {});

    import('./map-authoring-bootstrap.js')
        .then((module) => module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData }))
        .catch((error) => console.error('VTT map authoring bootstrap failed:', error));
    import('./actor-library-bootstrap.js')
        .then((module) => module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData }))
        .catch((error) => console.error('VTT actor library bootstrap failed:', error));
    import('./movement-bootstrap.js')
        .then((module) => module.start?.({ runtime: window.LuminousVttRuntime, mapData: mockMapData }))
        .catch((error) => console.error('VTT movement bootstrap failed:', error));

    window.addEventListener('keydown', (event) => {
        if (event.key === '0') applyLayer(0);
        else if (event.key === '1') applyLayer(1);
        else if (event.key === '2') applyLayer(2);
        // E belongs exclusively to token PoV Look Lock/Unlock. DM Edit Mode remains available via its button.
        else if (event.key === 'Escape') {
            controller.hideContextMenu();
            controller.setTool('select');
            verticalController.setTool('select', false);
        }
    });

    window.addEventListener('beforeunload', () => {
        stopMapWatch();
        window.LuminousVttRuntime?.movement?.stop?.();
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
    }, { once: true });
});
