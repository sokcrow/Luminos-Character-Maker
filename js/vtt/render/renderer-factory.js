import '../movement-zero-work-drag.js';
import '../token-interaction-runtime.js';
import '../rama4-field-stability-compat.js';
import { Canvas2DRenderer } from './canvas2d-renderer.js';
import { installDmObserverOverlay } from './dm-observer-overlay.js';
import { installPersistentTokenViews } from './persistent-token-views.js';
import { installRemoteTokenInterpolation } from './remote-token-interpolation.js';
import { installTokenInteractionViews } from './token-interaction-view.js';
import { installTransientTokenPreview } from './transient-token-preview.js';
import { installWebGL2TokenInteractionLayer } from './webgl2-token-interaction-layer.js';
import { installWebGL2TokenLayer } from './webgl2-token-layer.js';
import { RENDERER_BACKENDS } from './renderer-backend.js';
import { WebGL2Renderer } from './webgl2-renderer.js';

export function createRenderer(canvas, mapData, { backend = RENDERER_BACKENDS.CANVAS_2D } = {}) {
    const renderer = backend === RENDERER_BACKENDS.WEBGL_2
        ? new WebGL2Renderer(canvas, mapData)
        : new Canvas2DRenderer(canvas, mapData);

    installPersistentTokenViews(renderer);
    installTransientTokenPreview(renderer);
    installRemoteTokenInterpolation(renderer, {
        minDurationMs: 120,
        defaultDurationMs: 160,
        maxDurationMs: 240,
    });
    installTokenInteractionViews(renderer);
    installWebGL2TokenLayer(renderer);
    installWebGL2TokenInteractionLayer(renderer);
    return installDmObserverOverlay(renderer);
}
