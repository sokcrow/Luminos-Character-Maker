import { test, expect } from '@playwright/test';
import { createWebGL2TokenTextureCache, uvCover } from '../js/vtt/render/webgl2-token-texture-cache.js';

class FakeImage {
    constructor() {
        this.naturalWidth = 200;
        this.naturalHeight = 100;
        this.width = 200;
        this.height = 100;
        this.onload = null;
        this.onerror = null;
    }
    set src(value) {
        this._src = value;
        this.onload?.();
    }
    get src() { return this._src; }
}

class FakeGl {
    constructor() {
        this.TEXTURE_2D = 1;
        this.RGBA = 2;
        this.UNSIGNED_BYTE = 3;
        this.LINEAR = 4;
        this.CLAMP_TO_EDGE = 5;
        this.TEXTURE_MIN_FILTER = 6;
        this.TEXTURE_MAG_FILTER = 7;
        this.TEXTURE_WRAP_S = 8;
        this.TEXTURE_WRAP_T = 9;
        this.UNPACK_FLIP_Y_WEBGL = 10;
        this.created = 0;
        this.deleted = 0;
    }
    createTexture() { this.created += 1; return { id: this.created }; }
    deleteTexture() { this.deleted += 1; }
    bindTexture() {}
    pixelStorei() {}
    texParameteri() {}
    texImage2D() {}
}

function fakeRenderer() {
    return {
        gl: new FakeGl(),
        destroyed: false,
        contextLost: false,
        dirty: 0,
        markLayerDirty(name) { if (name === 'tokens') this.dirty += 1; },
    };
}

test('twenty tokens sharing one Actor icon use one image load and one WebGLTexture', () => {
    const renderer = fakeRenderer();
    const cache = createWebGL2TokenTextureCache(renderer, { ImageCtor: FakeImage });
    const entries = [];
    for (let i = 0; i < 20; i += 1) entries.push(cache.acquire('actor-agatha.png'));

    expect(new Set(entries).size).toBe(1);
    expect(renderer.gl.created).toBe(1);
    expect(cache.diagnostics()).toMatchObject({
        loads: 1,
        texturesCreated: 1,
        activeEntries: 1,
        activeReferences: 20,
        readyEntries: 1,
    });

    for (let i = 0; i < 19; i += 1) cache.release(entries[i]);
    expect(cache.diagnostics()).toMatchObject({ activeEntries: 1, activeReferences: 1 });
    cache.release(entries[19]);
    expect(cache.diagnostics()).toMatchObject({ activeEntries: 0, activeReferences: 0 });
    expect(renderer.gl.deleted).toBe(1);
});

test('context restore recreates one shared GPU texture without reloading the image', () => {
    const renderer = fakeRenderer();
    const cache = createWebGL2TokenTextureCache(renderer, { ImageCtor: FakeImage });
    cache.acquire('actor-agatha.png');
    const before = cache.diagnostics();

    cache.restore();
    const after = cache.diagnostics();

    expect(before.loads).toBe(1);
    expect(after.loads).toBe(1);
    expect(after.texturesCreated).toBe(2);
    expect(after.readyEntries).toBe(1);
});

test('cover UVs crop wide and tall Actor images without changing gameplay size', () => {
    expect(Array.from(uvCover(200, 100))).toEqual([0.25, 0, 0.75, 1]);
    expect(Array.from(uvCover(100, 200))).toEqual([0, 0.25, 1, 0.75]);
    expect(Array.from(uvCover(100, 100))).toEqual([0, 0, 1, 1]);
});
