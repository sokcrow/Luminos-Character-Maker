import { TokenView, tokenViewId } from './token-view.js';

export class TokenViewRegistry {
    constructor() {
        this.views = new Map();
        this.stats = {
            created: 0,
            destroyed: 0,
            positionUpdates: 0,
            targetedSyncs: 0,
            fullSyncs: 0,
        };
    }

    get size() {
        return this.views.size;
    }

    ensure(token) {
        const id = tokenViewId(token);
        if (!id) throw new Error('TOKEN_VIEW_ID_REQUIRED');

        const current = this.views.get(id);
        if (current) {
            current.sync(token);
            return current;
        }

        const view = new TokenView(token, {
            onPositionChange: () => {
                this.stats.positionUpdates += 1;
            },
        });
        this.views.set(id, view);
        this.stats.created += 1;
        return view;
    }

    syncToken(token) {
        this.stats.targetedSyncs += 1;
        return this.ensure(token);
    }

    get(tokenId) {
        return this.views.get(String(tokenId ?? '').trim());
    }

    setPreview(tokenId, position = {}) {
        const view = this.get(tokenId);
        if (!view) return false;
        return view.setPreviewPosition(position.x, position.y, position.zLayer ?? view.zLayer);
    }

    clearPreview(tokenId) {
        const view = this.get(tokenId);
        if (!view) return false;
        return view.clearPreviewPosition();
    }

    clearPreviews() {
        let changed = 0;
        for (const view of this.views.values()) {
            if (view.clearPreviewPosition()) changed += 1;
        }
        return changed;
    }

    remove(tokenId) {
        const id = String(tokenId ?? '').trim();
        const view = this.views.get(id);
        if (!view) return false;

        this.views.delete(id);
        if (view.destroy()) this.stats.destroyed += 1;
        return true;
    }

    sync(tokens = []) {
        this.stats.fullSyncs += 1;
        const seen = new Set();
        for (const token of Array.isArray(tokens) ? tokens : []) {
            const id = tokenViewId(token);
            if (!id) continue;
            seen.add(id);
            this.ensure(token);
        }

        for (const id of [...this.views.keys()]) {
            if (!seen.has(id)) this.remove(id);
        }
        return this.size;
    }

    clear() {
        for (const id of [...this.views.keys()]) this.remove(id);
        return this.size;
    }

    diagnostics() {
        return {
            ...this.stats,
            active: this.views.size,
        };
    }
}
