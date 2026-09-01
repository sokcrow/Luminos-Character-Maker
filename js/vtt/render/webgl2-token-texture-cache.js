const clean = (value) => String(value ?? '').trim();

function uvCover(width, height) {
    const w = Math.max(1, Number(width) || 1);
    const h = Math.max(1, Number(height) || 1);
    if (w > h) {
        const visible = h / w;
        const margin = (1 - visible) / 2;
        return new Float32Array([margin, 0, 1 - margin, 1]);
    }
    if (h > w) {
        const visible = w / h;
        const margin = (1 - visible) / 2;
        return new Float32Array([0, margin, 1, 1 - margin]);
    }
    return new Float32Array([0, 0, 1, 1]);
}

export function createWebGL2TokenTextureCache(renderer, { ImageCtor = globalThis.Image } = {}) {
    const entries = new Map();
    const stats = {
        loads: 0,
        ready: 0,
        failed: 0,
        texturesCreated: 0,
        texturesDeleted: 0,
        acquires: 0,
        releases: 0,
    };
    let destroyed = false;

    const deleteTexture = (entry) => {
        if (!entry?.texture || !renderer?.gl) return false;
        renderer.gl.deleteTexture(entry.texture);
        entry.texture = null;
        stats.texturesDeleted += 1;
        return true;
    };

    const upload = (entry) => {
        const gl = renderer?.gl;
        if (destroyed || !gl || renderer.destroyed || renderer.contextLost || !entry?.image || !entry.imageReady || entry.failed) return false;
        deleteTexture(entry);
        const texture = gl.createTexture();
        if (!texture) return false;
        try {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, entry.image);
            entry.texture = texture;
            entry.width = Number(entry.image.naturalWidth || entry.image.width) || 1;
            entry.height = Number(entry.image.naturalHeight || entry.image.height) || 1;
            entry.uvRect = uvCover(entry.width, entry.height);
            entry.ready = true;
            stats.texturesCreated += 1;
            return true;
        } catch (_) {
            try { gl.deleteTexture(texture); } catch (_) {}
            entry.texture = null;
            entry.ready = false;
            entry.failed = true;
            stats.failed += 1;
            return false;
        }
    };

    const createEntry = (url) => {
        const entry = {
            url,
            refs: 0,
            image: null,
            imageReady: false,
            ready: false,
            failed: false,
            texture: null,
            width: 1,
            height: 1,
            uvRect: new Float32Array([0, 0, 1, 1]),
        };
        entries.set(url, entry);
        stats.loads += 1;
        if (typeof ImageCtor !== 'function') {
            entry.failed = true;
            stats.failed += 1;
            return entry;
        }
        const image = new ImageCtor();
        entry.image = image;
        if (!url.startsWith('data:') && !url.startsWith('blob:')) {
            try { image.crossOrigin = 'anonymous'; } catch (_) {}
        }
        image.onload = () => {
            if (destroyed || entry.failed) return;
            entry.imageReady = true;
            if (upload(entry)) stats.ready += 1;
            renderer.markLayerDirty?.('tokens');
        };
        image.onerror = () => {
            if (entry.failed) return;
            entry.failed = true;
            stats.failed += 1;
            renderer.markLayerDirty?.('tokens');
        };
        image.src = url;
        return entry;
    };

    const acquire = (rawUrl) => {
        const url = clean(rawUrl);
        if (!url || destroyed) return null;
        const entry = entries.get(url) || createEntry(url);
        entry.refs += 1;
        stats.acquires += 1;
        return entry;
    };

    const release = (entryOrUrl) => {
        const entry = typeof entryOrUrl === 'string' ? entries.get(clean(entryOrUrl)) : entryOrUrl;
        if (!entry || !entries.has(entry.url)) return false;
        entry.refs = Math.max(0, entry.refs - 1);
        stats.releases += 1;
        if (entry.refs > 0) return true;
        deleteTexture(entry);
        entries.delete(entry.url);
        return true;
    };

    const restore = () => {
        for (const entry of entries.values()) {
            entry.texture = null;
            entry.ready = false;
            if (entry.imageReady && !entry.failed) upload(entry);
        }
    };

    const destroy = () => {
        if (destroyed) return false;
        destroyed = true;
        for (const entry of entries.values()) deleteTexture(entry);
        entries.clear();
        return true;
    };

    const diagnostics = () => ({
        ...stats,
        activeEntries: entries.size,
        activeReferences: [...entries.values()].reduce((sum, entry) => sum + entry.refs, 0),
        readyEntries: [...entries.values()].filter((entry) => entry.ready && entry.texture).length,
    });

    return Object.freeze({ acquire, release, restore, destroy, diagnostics, entries });
}

export { uvCover };
