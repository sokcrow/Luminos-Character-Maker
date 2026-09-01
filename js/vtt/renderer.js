import { createRenderer } from './render/renderer-factory.js';
import { RENDERER_BACKENDS, resolveRendererBackend } from './render/renderer-backend.js';

export class Renderer {
    constructor(canvas, mapData) {
        const resolution = resolveRendererBackend();
        try {
            const renderer = createRenderer(canvas, mapData, { backend: resolution.backend });
            renderer.backendResolution = resolution;
            if (resolution.fallback) {
                console.warn('VTT renderer fallback activated.', resolution);
            }
            return renderer;
        } catch (error) {
            if (resolution.backend !== RENDERER_BACKENDS.WEBGL_2) throw error;

            console.warn('VTT WebGL2 initialization failed; falling back to Canvas2D.', error);
            const renderer = createRenderer(canvas, mapData, { backend: RENDERER_BACKENDS.CANVAS_2D });
            renderer.backendResolution = Object.freeze({
                ...resolution,
                backend: RENDERER_BACKENDS.CANVAS_2D,
                available: false,
                fallback: true,
                reason: 'WEBGL2_INIT_FAILED',
                error: String(error?.message || error || 'Unknown WebGL2 initialization error'),
            });
            return renderer;
        }
    }
}
