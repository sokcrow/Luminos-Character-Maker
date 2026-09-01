export const RENDERER_BACKENDS = Object.freeze({
    CANVAS_2D: 'canvas2d',
    WEBGL_2: 'webgl2',
});

const normalizeBackend = (value) => String(value || '').trim().toLowerCase();

export function supportsWebGL2(root = globalThis) {
    const documentRef = root?.document;
    if (!documentRef?.createElement) return false;
    try {
        const probe = documentRef.createElement('canvas');
        const gl = probe.getContext?.('webgl2');
        return Boolean(gl);
    } catch {
        return false;
    }
}

export function resolveRendererBackend({ search = globalThis?.location?.search || '', root = globalThis } = {}) {
    let requested = RENDERER_BACKENDS.CANVAS_2D;
    try {
        const params = new URLSearchParams(search);
        requested = normalizeBackend(params.get('renderer')) || RENDERER_BACKENDS.CANVAS_2D;
    } catch {
        requested = RENDERER_BACKENDS.CANVAS_2D;
    }

    if (requested !== RENDERER_BACKENDS.WEBGL_2) {
        return Object.freeze({
            requested,
            backend: RENDERER_BACKENDS.CANVAS_2D,
            available: true,
            fallback: requested !== RENDERER_BACKENDS.CANVAS_2D,
            reason: requested === RENDERER_BACKENDS.CANVAS_2D ? null : 'UNKNOWN_RENDERER_BACKEND',
        });
    }

    const available = supportsWebGL2(root);
    return Object.freeze({
        requested,
        backend: available ? RENDERER_BACKENDS.WEBGL_2 : RENDERER_BACKENDS.CANVAS_2D,
        available,
        fallback: !available,
        reason: available ? null : 'WEBGL2_UNAVAILABLE',
    });
}
