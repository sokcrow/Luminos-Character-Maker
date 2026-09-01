const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const cleanId = (value) => String(value ?? '').trim();

function tokenZLayer(token = {}, fallback = 0) {
    if (Number.isFinite(Number(token.zLayer))) return Number(token.zLayer);
    if (Number.isFinite(Number(token.gridPosition?.z))) return Number(token.gridPosition.z);
    if (Array.isArray(token.z) && token.z.length && Number.isFinite(Number(token.z[0]))) return Number(token.z[0]);
    return finite(fallback);
}

function normalizeAngleDeg(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return finite(fallback);
    const normalized = numeric % 360;
    return normalized < 0 ? normalized + 360 : normalized;
}

function explicitFacingDeg(token = {}) {
    const raw = token?.lookState?.yawDeg ?? token?.facingDeg ?? token?.rotationDeg;
    return Number.isFinite(Number(raw)) ? normalizeAngleDeg(raw) : null;
}

function facingFromDelta(dx, dy, fallback = 0) {
    if (Math.hypot(finite(dx), finite(dy)) < 0.001) return normalizeAngleDeg(fallback);
    return normalizeAngleDeg((Math.atan2(finite(dy), finite(dx)) * 180) / Math.PI, fallback);
}

/**
 * Persistent render-side identity for one tactical token.
 *
 * Canonical x/y/zLayer are synchronized from token-state. Step 3 adds a separate
 * transient preview position for drag/realtime visuals so pointer feedback never
 * mutates the canonical token or writes back to Firebase before validation.
 * Step 6 keeps hover/selection/targeting equally transient and render-side only.
 * Step 8 keeps orientation render-side too: explicit token facing is consumed when
 * available, otherwise motion deltas update the TokenView facing without inventing
 * a new gameplay authority or mutating canonical state.
 */
export class TokenView {
    constructor(token, { onPositionChange = null, onPreviewChange = null, onInteractionChange = null, onFacingChange = null } = {}) {
        const id = cleanId(token?.id);
        if (!id) throw new Error('TOKEN_VIEW_ID_REQUIRED');

        this.id = id;
        this.token = token;
        this.x = finite(token?.x);
        this.y = finite(token?.y);
        this.zLayer = tokenZLayer(token);
        this.facingDeg = explicitFacingDeg(token) ?? 0;
        this.previewPosition = null;
        this.previewFacingDeg = null;
        this.interaction = Object.freeze({ hovered: false, selected: false, targeted: false });
        this.visible = token?.visible !== false;
        this.destroyed = false;
        this.revision = 0;
        this.resources = new Map();
        this.onPositionChange = typeof onPositionChange === 'function' ? onPositionChange : null;
        this.onPreviewChange = typeof onPreviewChange === 'function' ? onPreviewChange : null;
        this.onInteractionChange = typeof onInteractionChange === 'function' ? onInteractionChange : null;
        this.onFacingChange = typeof onFacingChange === 'function' ? onFacingChange : null;
    }

    get hasPreview() {
        return Boolean(this.previewPosition);
    }

    get renderX() {
        return this.previewPosition?.x ?? this.x;
    }

    get renderY() {
        return this.previewPosition?.y ?? this.y;
    }

    get renderZLayer() {
        return this.previewPosition?.zLayer ?? this.zLayer;
    }

    get renderFacingDeg() {
        return this.previewFacingDeg ?? this.facingDeg;
    }

    get isMoving() {
        return Boolean(this.previewPosition);
    }

    get isVertical() {
        return Boolean(this.token?.verticalMovement);
    }

    get motionState() {
        if (this.isVertical) return 'vertical';
        if (this.isMoving) return 'moving';
        return 'idle';
    }

    get hovered() {
        return this.interaction.hovered;
    }

    get selected() {
        return this.interaction.selected;
    }

    get targeted() {
        return this.interaction.targeted;
    }

    setFacingDeg(value) {
        if (this.destroyed || !Number.isFinite(Number(value))) return false;
        const next = normalizeAngleDeg(value, this.facingDeg);
        if (next === this.facingDeg) return false;
        const previous = this.facingDeg;
        this.facingDeg = next;
        this.revision += 1;
        this.onFacingChange?.(this, previous, next, 'canonical');
        return true;
    }

    setPosition(x, y, zLayer = this.zLayer) {
        if (this.destroyed) return false;
        const nextX = finite(x, this.x);
        const nextY = finite(y, this.y);
        const nextZ = finite(zLayer, this.zLayer);
        if (nextX === this.x && nextY === this.y && nextZ === this.zLayer) return false;

        const previousX = this.x;
        const previousY = this.y;
        this.x = nextX;
        this.y = nextY;
        this.zLayer = nextZ;
        const explicit = explicitFacingDeg(this.token);
        if (explicit == null && (nextX !== previousX || nextY !== previousY)) {
            const nextFacing = facingFromDelta(nextX - previousX, nextY - previousY, this.facingDeg);
            if (nextFacing !== this.facingDeg) {
                const previousFacing = this.facingDeg;
                this.facingDeg = nextFacing;
                this.onFacingChange?.(this, previousFacing, nextFacing, 'movement');
            }
        }
        this.revision += 1;
        this.onPositionChange?.(this);
        return true;
    }

    setPreviewPosition(x, y, zLayer = this.zLayer) {
        if (this.destroyed) return false;
        const previousRenderX = this.renderX;
        const previousRenderY = this.renderY;
        const next = {
            x: finite(x, previousRenderX),
            y: finite(y, previousRenderY),
            zLayer: finite(zLayer, this.renderZLayer),
        };
        const current = this.previewPosition;
        if (current && next.x === current.x && next.y === current.y && next.zLayer === current.zLayer) return false;

        if (next.x !== previousRenderX || next.y !== previousRenderY) {
            this.previewFacingDeg = facingFromDelta(next.x - previousRenderX, next.y - previousRenderY, this.renderFacingDeg);
        }
        this.previewPosition = next;
        this.revision += 1;
        this.onPreviewChange?.(this, 'set');
        return true;
    }

    clearPreviewPosition() {
        if (this.destroyed || !this.previewPosition) return false;
        this.previewPosition = null;
        this.previewFacingDeg = null;
        this.revision += 1;
        this.onPreviewChange?.(this, 'clear');
        return true;
    }

    setInteractionState(patch = {}) {
        if (this.destroyed || !patch || typeof patch !== 'object') return false;
        const current = this.interaction;
        const next = {
            hovered: patch.hovered == null ? current.hovered : Boolean(patch.hovered),
            selected: patch.selected == null ? current.selected : Boolean(patch.selected),
            targeted: patch.targeted == null ? current.targeted : Boolean(patch.targeted),
        };
        if (next.hovered === current.hovered && next.selected === current.selected && next.targeted === current.targeted) return false;
        this.interaction = Object.freeze(next);
        this.revision += 1;
        this.onInteractionChange?.(this, current, this.interaction);
        return true;
    }

    clearInteractionState() {
        return this.setInteractionState({ hovered: false, selected: false, targeted: false });
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
        const explicit = explicitFacingDeg(token);
        const facingChanged = explicit == null ? false : this.setFacingDeg(explicit);
        const visibilityChanged = this.setVisible(token?.visible !== false);
        return positionChanged || facingChanged || visibilityChanged;
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
        this.previewPosition = null;
        this.previewFacingDeg = null;
        this.interaction = Object.freeze({ hovered: false, selected: false, targeted: false });
        this.destroyed = true;
        this.token = null;
        this.onPositionChange = null;
        this.onPreviewChange = null;
        this.onInteractionChange = null;
        this.onFacingChange = null;
        return true;
    }
}

export function tokenViewId(token) {
    return cleanId(token?.id);
}
