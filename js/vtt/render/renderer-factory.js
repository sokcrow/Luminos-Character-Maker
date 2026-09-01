import { Canvas2DRenderer } from './canvas2d-renderer.js';
import { RENDERER_BACKENDS } from './renderer-backend.js';
import { WebGL2Renderer } from './webgl2-renderer.js';

export function createRenderer(canvas, mapData, { backend = RENDERER_BACKENDS.CANVAS_2D } = {}) {
    if (backend === RENDERER_BACKENDS.WEBGL_2) {
        return new WebGL2Renderer(canvas, mapData);
    }
    return new Canvas2DRenderer(canvas, mapData);
}
