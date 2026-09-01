import '../movement-zero-work-drag.js';
import { Canvas2DRenderer } from './canvas2d-renderer.js';
import { installDmObserverOverlay } from './dm-observer-overlay.js';
import { installPersistentTokenViews } from './persistent-token-views.js';
import { installTransientTokenPreview } from './transient-token-preview.js';
import { RENDERER_BACKENDS } from './renderer-backend.js';
import { WebGL2Renderer } from './webgl2-renderer.js';

export function createRenderer(canvas, mapData, { backend = RENDERER_BACKENDS.CANVAS_2D } = {}) {
    const renderer = backend === RENDERER_BACKENDS.WEBGL_2
        ? new WebGL2Renderer(canvas, mapData)
        : new Canvas2DRenderer(canvas, mapData);

    installPersistentTokenViews(renderer);
    installTransientTokenPreview(renderer);
    return installDmObserverOverlay(renderer);
}
