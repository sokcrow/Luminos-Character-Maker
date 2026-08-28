import { Engine } from './engine.js';
import { TopologyController } from './topology-controller.js';
import { mockMapData } from './mapData.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('vtt-canvas');
    if (!canvas) {
        console.error('VTT Canvas not found!');
        return;
    }

    const engine = new Engine(canvas, mockMapData);
    let controller = null;

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

    controller = new TopologyController(canvas, engine, mockMapData, bridge);
    bridge.start();

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
        characterVisionBridge,
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === '0') {
            engine.setZLayer(0);
            controller.handleTopologyChanged();
        } else if (event.key === '1') {
            engine.setZLayer(1);
            controller.handleTopologyChanged();
        } else if (event.key === '2') {
            engine.setZLayer(2);
            controller.handleTopologyChanged();
        } else if (event.key === 'Escape') {
            controller.hideContextMenu();
            controller.setTool('select');
        }
    });

    window.addEventListener('beforeunload', () => {
        characterVisionBridge?.stop?.();
        bridge.stop();
        checkPortal?.stop?.();
        engine.stop();
    }, { once: true });
});