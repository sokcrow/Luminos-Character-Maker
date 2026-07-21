import { Engine } from './engine.js';
import { mockMapData } from './mapData.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('vtt-canvas');
    if (!canvas) {
        console.error("VTT Canvas not found!");
        return;
    }

    const engine = new Engine(canvas, mockMapData);

    // Start the game loop
    engine.start();

    // Example: add keyboard listener to change Z-layer for testing
    window.addEventListener('keydown', (e) => {
        if (e.key === '0') {
            engine.setZLayer(0);
            console.log("Switched to Z-Layer 0");
        } else if (e.key === '1') {
            engine.setZLayer(1);
            console.log("Switched to Z-Layer 1");
        } else if (e.key === '2') {
            engine.setZLayer(2);
            console.log("Switched to Z-Layer 2");
        }
    });
});
