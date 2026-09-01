const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const cleanId = (value) => String(value ?? '').trim();

function tokenZLayer(token = {}, fallback = 0) {
    if (Number.isFinite(Number(token.zLayer))) return Number(token.zLayer);
    if (Number.isFinite(Number(token.gridPosition?.z))) return Number(token.gridPosition.z);
    if (Array.isArray(token.z) && token.z.length && Number.isFinite(Number(token.z[0]))) return Number(token.z[0]);
    return finite(fallback);
}

/**
 * Persistent render-side identity for one tactical token.
 *
 * Step 1 intentionally owns no texture/program yet. GPU resources can be attached
 * later without changing the TokenView identity used by selection, hover or drag.
 */
export class TokenView {
    constructor(token, { onPositionChange = null } = {}) {
        const id = cleanId(token?.id);
        if (!id) throw new Error('TOKEN_VIEW_ID_REQUIRED');

        this.id = id;
        this.token = token;
        this.x = finite(token?.x);
        this.y = finite(token?.y);
        this.zLayer = tokenZLayer(token);
        this.visible = token?.visible !== false;
        this.destroyed = false;
        this.revision = 0;
        this.resources = new Map();
        this.onPositionChange = typeof onPositionChange === 'function' ? onPositionChange : null;
    }

    setPosition(x, y, zLayer = this.zLayer) {
        if (this.destroyed) return false;
        const nextX = finite(x, this.x);
        const nextY = finite(y, this.y);
        const nextZ = finite(zLayer, this.zLayer);
        if (nextX === this.x && nextY === this.y && nextZ === this.zLayer) return false;

        this.x = nextX;
        this.y = nextY;
        this.zLayer = nextZ;
        this.revision += 1;
        this.onPositionChange?.(this);
        return true;
    }

    setVisible(visible) {
        if (this.destroyed) return false;
        const next = Boolean(visible);
        if (next === this.visible) return false;
        this.visible = next;
        this.revision += 1;
        return true;
    }

    sync(token) {
        if (this.destroyed) return false;
        const id = cleanId(token?.id);
        if (!id) throw new Error('TOKEN_VIEW_ID_REQUIRED');
        if (id !== this.id) throw new Error('TOKEN_VIEW_ID_MISMATCH');

        this.token = token;
        const positionChanged = this.setPosition(token?.x, token?.y, tokenZLayer(token, this.zLayer));
        const visibilityChanged = this.setVisible(token?.visible !== false);
        return positionChanged || visibilityChanged;
    }

    attachResource(key, resource, dispose = null) {
        if (this.destroyed) throw new Error('TOKEN_VIEW_DESTROYED');
        const resourceKey = cleanId(key);
        if (!resourceKey) throw new Error('TOKEN_VIEW_RESOURCE_KEY_REQUIRED');
        this.releaseResource(resourceKey);
        this.resources.set(resourceKey, {
            resource,
            dispose: typeof dispose === 'function' ? dispose : null,
        });
        return resource;
    }

    releaseResource(key) {
        const resourceKey = cleanId(key);
        const entry = this.resources.get(resourceKey);
        if (!entry) return false;
        this.resources.delete(resourceKey);
        entry.dispose?.(entry.resource);
        return true;
    }

    destroy() {
        if (this.destroyed) return false;
        for (const key of [...this.resources.keys()]) this.releaseResource(key);
        this.destroyed = true;
        this.token = null;
        this.onPositionChange = null;
        return true;
    }
}

export function tokenViewId(token) {
    return cleanId(token?.id);
}
