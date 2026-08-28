import { Engine } from './engine.js';
import { TopologyController } from './topology-controller.js';
import { VerticalPortalController } from './vertical-portal-controller.js';
import { mockMapData } from './mapData.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('vtt-canvas');
    if (!canvas) {
        console.error('VTT Canvas not found!');
        return;
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

    bridge.start();
    verticalBridge.start();

    const characterVisionApi = globalThis.LuminousVttCharacterVisionBridge;
    const characterVisionBridge = characterVisionApi?.createBridge?.({
        mapData: mockMapData,
        onSensesChanged: () => {},
    }) || null;
    characterVisionBridge?.start?.();

    const checkPortal = globalThis.LuminousVttCheckPortal?.start?.() || null;

    const exportBtn = document.getElementById('btn-export-uv');
    exportBtn?.addEventListener('click', () => engine.exportUVTemplate());

    const applyLayer = (zLayer) => {
        engine.setZLayer(zLayer);
        controller.handleTopologyChanged();
        verticalController.handleLayerChanged();
    };

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
        editMode,
        characterVisionBridge,
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === '0') applyLayer(0);
        else if (event.key === '1') applyLayer(1);
        else if (event.key === '2') applyLayer(2);
        else if ((event.key === 'e' || event.key === 'E') && bridge.isDm && !event.ctrlKey && !event.metaKey && !event.altKey) editMode?.toggle?.();
        else if (event.key === 'Escape') {
            controller.hideContextMenu();
            controller.setTool('select');
            verticalController.setTool('select', false);
        }
    });

    window.addEventListener('beforeunload', () => {
        editMode?.stop?.();
        characterVisionBridge?.stop?.();
        verticalController.destroy();
        verticalBridge.stop();
        bridge.stop();
        checkPortal?.stop?.();
        engine.stop();
    }, { once: true });
});