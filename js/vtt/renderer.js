import { createRenderer } from './render/renderer-factory.js';
import { RENDERER_BACKENDS, resolveRendererBackend } from './render/renderer-backend.js';

function canvas2dFallback(canvas, mapData, resolution, error, reason) {
    console.warn('VTT WebGL2 initialization failed; falling back to Canvas2D.', error);
    const renderer = createRenderer(canvas, mapData, { backend: RENDERER_BACKENDS.CANVAS_2D });
    renderer.backendResolution = Object.freeze({
        ...resolution,
        backend: RENDERER_BACKENDS.CANVAS_2D,
        available: false,
        fallback: true,
        reason,
        error: String(error?.message || error || 'Unknown WebGL2 initialization error'),
    });
    return renderer;
}

function preflightWebGL2(mapData) {
    const documentRef = globalThis?.document;
    if (!documentRef?.createElement) return null;

    const probeCanvas = documentRef.createElement('canvas');
    probeCanvas.width = 4;
    probeCanvas.height = 4;
    let probeRenderer = null;
    try {
        probeRenderer = createRenderer(probeCanvas, mapData, { backend: RENDERER_BACKENDS.WEBGL_2 });
        return null;
    } catch (error) {
        return error;
    } finally {
        try { probeRenderer?.destroy?.(); } catch (_) {}
    }
}

export class Renderer {
    constructor(canvas, mapData) {
        const resolution = resolveRendererBackend();

        if (resolution.backend === RENDERER_BACKENDS.WEBGL_2) {
            const preflightError = preflightWebGL2(mapData);
            if (preflightError) {
                return canvas2dFallback(canvas, mapData, resolution, preflightError, 'WEBGL2_PREFLIGHT_FAILED');
            }
        }

        try {
            const renderer = createRenderer(canvas, mapData, { backend: resolution.backend });
            renderer.backendResolution = resolution;
            if (resolution.fallback) {
                console.warn('VTT renderer fallback activated.', resolution);
            }
            return renderer;
        } catch (error) {
            if (resolution.backend !== RENDERER_BACKENDS.WEBGL_2) throw error;

            // A canvas cannot switch context types after WebGL2 has been acquired.
            // Fall back only when WebGL2 never locked the real VTT canvas.
            let acquiredWebGL2 = null;
            try { acquiredWebGL2 = canvas?.getContext?.('webgl2') || null; } catch (_) {}
            if (!acquiredWebGL2) {
                return canvas2dFallback(canvas, mapData, resolution, error, 'WEBGL2_INIT_FAILED');
            }

            const fatal = new Error('VTT WebGL2 initialization failed after the canvas acquired WebGL2. Reload without ?renderer=webgl2 to use Canvas2D.');
            fatal.cause = error;
            fatal.code = 'WEBGL2_INIT_FAILED_CONTEXT_LOCKED';
            throw fatal;
        }
    }
}
