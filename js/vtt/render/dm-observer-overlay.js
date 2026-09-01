const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function drawCanvas2DObserverOutlines(renderer, outlines = [], camera = null) {
    const ctx = renderer?.ctx;
    if (!ctx || !camera) return 0;

    let drawn = 0;
    ctx.save();
    camera.applyTransformSimple?.(ctx);
    for (const raw of Array.isArray(outlines) ? outlines : []) {
        const x = finite(raw?.x);
        const y = finite(raw?.y);
        const radius = Math.max(0, finite(raw?.radius));
        if (!(radius > 0)) continue;

        const cone = Math.max(0, Math.min(360, finite(raw?.coneDeg, 120)));
        const facing = finite(raw?.facingDeg);
        const half = Math.min(180, cone / 2) * Math.PI / 180;
        const center = facing * Math.PI / 180;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, radius, center - half, center + half);
        ctx.closePath();
        ctx.globalAlpha = raw?.selected ? 0.85 : 0.45;
        ctx.strokeStyle = raw?.color || '#d7b151';
        ctx.lineWidth = raw?.selected ? 3 : 2;
        ctx.stroke();
        drawn += 1;
    }
    ctx.restore();
    return drawn;
}

/**
 * Installs the temporary backend seam used by DM Observer during the staged
 * Canvas2D -> WebGL2 migration. DM Observer only supplies world-space outline
 * data; each renderer owns how that data is drawn.
 */
export function installDmObserverOverlay(renderer) {
    if (!renderer || typeof renderer.drawDmObserverOutlines === 'function') return renderer;

    if (renderer.backend === 'canvas2d' && renderer.ctx) {
        renderer.drawDmObserverOutlines = (outlines, camera) => drawCanvas2DObserverOutlines(renderer, outlines, camera);
    }

    return renderer;
}
