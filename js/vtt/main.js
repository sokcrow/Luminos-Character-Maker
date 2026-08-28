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

    // Vertical controller binds capture listeners first so an active Z tool wins over
    // topology selection or token dragging. When no vertical tool is active it yields.
    verticalController = new VerticalPortalController(canvas, engine, mockMapData, verticalBridge);
    controller = new TopologyController(canvas, engine, mockMapData, bridge);
    verticalController.setTopologyController(controller);

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
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            engine.exportUVTemplate();
        });
    }

    engine.start();

    window.LuminousVttRuntime = Object.freeze({
        engine,
        controller,
        bridge,
        verticalController,
        verticalBridge,
        characterVisionBridge,
    });

    const applyLayer = (zLayer) => {
        engine.setZLayer(zLayer);
        controller.handleTopologyChanged();
        verticalController.handleLayerChanged();
    };

    window.addEventListener('keydown', (event) => {
        if (event.key === '0') {
            applyLayer(0);
        } else if (event.key === '1') {
            applyLayer(1);
        } else if (event.key === '2') {
            applyLayer(2);
        } else if (event.key === 'Escape') {
            controller.hideContextMenu();
            controller.setTool('select');
            verticalController.setTool('select', false);
        }
    });

    window.addEventListener('beforeunload', () => {
        characterVisionBridge?.stop?.();
        verticalController.destroy();
        verticalBridge.stop();
        bridge.stop();
        checkPortal?.stop?.();
        engine.stop();
    }, { once: true });
});