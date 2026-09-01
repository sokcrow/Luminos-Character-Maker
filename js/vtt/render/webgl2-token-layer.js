import { createWebGL2TokenTextureCache } from './webgl2-token-texture-cache.js';

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clean = (value) => String(value ?? '').trim();
const RESOURCE_KEY = 'webgl2-token-visual';

const TOKEN_VERTEX_SHADER = `#version 300 es
in vec2 a_unit;
uniform mat3 u_world;
uniform vec2 u_center;
uniform float u_radius;
out vec2 v_local;
out vec2 v_uv;
void main() {
    v_local = a_unit;
    v_uv = (a_unit * 0.5) + 0.5;
    vec2 worldPosition = u_center + (a_unit * u_radius);
    vec3 clip = u_world * vec3(worldPosition, 1.0);
    gl_Position = vec4(clip.xy, 0.0, 1.0);
}`;

const TOKEN_FRAGMENT_SHADER = `#version 300 es
precision mediump float;
in vec2 v_local;
in vec2 v_uv;
uniform vec4 u_background;
uniform vec4 u_border;
uniform vec4 u_icon;
uniform vec4 u_uvRect;
uniform sampler2D u_texture;
uniform float u_hasTexture;
uniform float u_borderWidth;
uniform float u_personIcon;
uniform float u_alpha;
out vec4 outColor;

void main() {
    float distanceFromCenter = length(v_local);
    if (distanceFromCenter > 1.0) discard;

    vec4 color = u_background;
    if (u_hasTexture > 0.5) {
        vec2 uv = mix(u_uvRect.xy, u_uvRect.zw, v_uv);
        vec4 sampled = texture(u_texture, uv);
        color = mix(u_background, sampled, sampled.a);
    } else if (u_personIcon > 0.5) {
        float head = step(length(v_local - vec2(0.0, -0.24)), 0.22);
        vec2 bodyPoint = vec2(v_local.x / 0.47, (v_local.y - 0.34) / 0.42);
        float body = step(dot(bodyPoint, bodyPoint), 1.0) * step(0.02, v_local.y);
        if (max(head, body) > 0.5) color = u_icon;
    }

    if (distanceFromCenter >= 1.0 - u_borderWidth) color = u_border;
    outColor = vec4(color.rgb, color.a * u_alpha);
}`;

function rgba(color, fallback = '#ffffff') {
    const text = String(color || fallback).trim();
    const short = /^#([0-9a-f]{3})$/i.exec(text);
    const full = /^#([0-9a-f]{6})$/i.exec(text);
    let hex = String(fallback || '#ffffff').replace('#', '');
    if (short) hex = short[1].split('').map((entry) => entry + entry).join('');
    else if (full) hex = full[1];
    if (!/^[0-9a-f]{6}$/i.test(hex)) hex = 'ffffff';
    return new Float32Array([
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
        1,
    ]);
}

export function tokenRadiusForView(view, mapData = {}) {
    const token = view?.token || {};
    const tokenRules = globalThis.LuminousVttTokenInteraction;
    const ruleRadius = tokenRules?.tokenRadius?.(token, mapData?.grid);
    return Math.max(2, finite(ruleRadius, finite(token.radius, finite(mapData?.grid?.size, 70) * 0.4)));
}

export function tokenVisualDescriptor(view, mapData = {}) {
    const token = view?.token || {};
    const radius = tokenRadiusForView(view, mapData);
    const icon = String(token.icon || 'person').toLowerCase();
    const imageSource = clean(token.icono);
    const verticalAlpha = token.verticalMovement ? 0.82 : 1;
    const borderWidth = Math.max(0.03, Math.min(0.35, Math.max(2, radius * 0.08) / radius));
    const backgroundColor = token.backgroundColor || '#20242a';
    const borderColor = token.color || '#ffffff';
    const iconColor = token.iconColor || '#ffffff';
    return {
        radius,
        icon,
        imageSource,
        personIcon: icon === 'person',
        verticalAlpha,
        borderWidth,
        backgroundColor,
        borderColor,
        iconColor,
        signature: [radius, icon, imageSource, verticalAlpha, borderWidth, backgroundColor, borderColor, iconColor].join('|'),
    };
}

function createProgram(renderer) {
    const gl = renderer.gl;
    const vertexShader = renderer.compileShader(gl.VERTEX_SHADER, TOKEN_VERTEX_SHADER);
    const fragmentShader = renderer.compileShader(gl.FRAGMENT_SHADER, TOKEN_FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) {
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        throw new Error('Unable to allocate WebGL2 token program.');
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program) || 'Unknown WebGL2 token program link error.';
        gl.deleteProgram(program);
        throw new Error(message);
    }
    return program;
}

export function installWebGL2TokenLayer(renderer) {
    if (!renderer || renderer.backend !== 'webgl2' || !renderer.tokenViews) return renderer;
    if (renderer.__webgl2TokenLayerInstalled) return renderer;
    renderer.__webgl2TokenLayerInstalled = true;

    const stats = {
        frames: 0,
        drawCalls: 0,
        visibleLastFrame: 0,
        resourcesCreated: 0,
        resourcesReleased: 0,
        materialUpdates: 0,
        textureChanges: 0,
        culledLastFrame: 0,
    };
    const textureCache = createWebGL2TokenTextureCache(renderer);
    renderer.tokenTextureCache = textureCache;

    let program = null;
    let quadBuffer = null;
    let locations = null;

    const releasePipeline = () => {
        const gl = renderer.gl;
        if (!gl) return;
        if (quadBuffer) gl.deleteBuffer(quadBuffer);
        if (program) gl.deleteProgram(program);
        quadBuffer = null;
        program = null;
        locations = null;
    };

    const createPipeline = () => {
        if (renderer.destroyed || renderer.contextLost || !renderer.gl) return false;
        releasePipeline();
        const gl = renderer.gl;
        program = createProgram(renderer);
        quadBuffer = gl.createBuffer();
        if (!quadBuffer) throw new Error('Unable to allocate WebGL2 token quad buffer.');
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1,
        ]), gl.STATIC_DRAW);
        locations = {
            unit: gl.getAttribLocation(program, 'a_unit'),
            world: gl.getUniformLocation(program, 'u_world'),
            center: gl.getUniformLocation(program, 'u_center'),
            radius: gl.getUniformLocation(program, 'u_radius'),
            background: gl.getUniformLocation(program, 'u_background'),
            border: gl.getUniformLocation(program, 'u_border'),
            icon: gl.getUniformLocation(program, 'u_icon'),
            uvRect: gl.getUniformLocation(program, 'u_uvRect'),
            texture: gl.getUniformLocation(program, 'u_texture'),
            hasTexture: gl.getUniformLocation(program, 'u_hasTexture'),
            borderWidth: gl.getUniformLocation(program, 'u_borderWidth'),
            personIcon: gl.getUniformLocation(program, 'u_personIcon'),
            alpha: gl.getUniformLocation(program, 'u_alpha'),
        };
        return true;
    };

    const setVisualTexture = (visual, imageSource) => {
        const nextSource = clean(imageSource);
        const previousSource = clean(visual?.textureSource);
        if (nextSource === previousSource) return false;
        if (visual?.textureEntry) textureCache.release(visual.textureEntry);
        visual.textureSource = nextSource;
        visual.textureEntry = nextSource ? textureCache.acquire(nextSource) : null;
        stats.textureChanges += 1;
        return true;
    };

    const ensureVisual = (view) => {
        if (!view || view.destroyed) return null;
        const descriptor = tokenVisualDescriptor(view, renderer.mapData);
        let visual = view.resources.get(RESOURCE_KEY)?.resource || null;
        if (!visual) {
            visual = {
                descriptor,
                background: rgba(descriptor.backgroundColor, '#20242a'),
                border: rgba(descriptor.borderColor, '#ffffff'),
                icon: rgba(descriptor.iconColor, '#ffffff'),
                textureSource: '',
                textureEntry: null,
            };
            setVisualTexture(visual, descriptor.imageSource);
            view.attachResource(RESOURCE_KEY, visual, (resource) => {
                if (resource?.textureEntry) textureCache.release(resource.textureEntry);
                resource.textureEntry = null;
                stats.resourcesReleased += 1;
            });
            stats.resourcesCreated += 1;
            return visual;
        }
        if (visual.descriptor.signature !== descriptor.signature) {
            const imageChanged = visual.descriptor.imageSource !== descriptor.imageSource;
            visual.descriptor = descriptor;
            visual.background = rgba(descriptor.backgroundColor, '#20242a');
            visual.border = rgba(descriptor.borderColor, '#ffffff');
            visual.icon = rgba(descriptor.iconColor, '#ffffff');
            if (imageChanged) setVisualTexture(visual, descriptor.imageSource);
            stats.materialUpdates += 1;
        }
        return visual;
    };

    const viewOnActiveLayer = (view, activeZ) => Number(view?.renderZLayer ?? 0) === Number(activeZ ?? 0);

    const viewInViewport = (view, radius, camera) => {
        if (!camera || typeof renderer.worldToScreen !== 'function') return true;
        const screen = renderer.worldToScreen(view.renderX, view.renderY);
        const viewport = renderer.logicalViewport || renderer.viewportSize?.(camera) || { width: 1, height: 1 };
        const zoom = Math.max(0.01, finite(camera.zoom, 1));
        const padding = radius * zoom;
        return screen.x >= -padding && screen.x <= finite(viewport.width, 1) + padding
            && screen.y >= -padding && screen.y <= finite(viewport.height, 1) + padding;
    };

    const drawTokens = (activeZ = 0, camera = null, renderData = null, isExporting = false) => {
        if (renderer.destroyed || renderer.contextLost || !renderer.gl || !program || !quadBuffer || !locations) return 0;
        if (isExporting || renderData?.visible === false) return 0;
        const layer = renderer.layers?.get?.('tokens');
        if (layer && layer.visible === false) return 0;

        const gl = renderer.gl;
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.enableVertexAttribArray(locations.unit);
        gl.vertexAttribPointer(locations.unit, 2, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix3fv(locations.world, false, renderer.world.matrix);
        gl.uniform1i?.(locations.texture, 0);

        let drawn = 0;
        let culled = 0;
        for (const view of renderer.tokenViews.views.values()) {
            if (!view || view.destroyed || view.visible === false || !viewOnActiveLayer(view, activeZ)) continue;
            const visual = ensureVisual(view);
            if (!visual) continue;
            const descriptor = visual.descriptor;
            if (!viewInViewport(view, descriptor.radius, camera)) {
                culled += 1;
                continue;
            }

            const textureEntry = visual.textureEntry;
            const hasTexture = Boolean(textureEntry?.ready && textureEntry.texture && !textureEntry.failed);
            if (hasTexture) {
                gl.activeTexture?.(gl.TEXTURE0);
                gl.bindTexture?.(gl.TEXTURE_2D, textureEntry.texture);
            }

            gl.uniform2f(locations.center, view.renderX, view.renderY);
            gl.uniform1f(locations.radius, descriptor.radius);
            gl.uniform4fv(locations.background, visual.background);
            gl.uniform4fv(locations.border, visual.border);
            gl.uniform4fv(locations.icon, visual.icon);
            gl.uniform4fv(locations.uvRect, textureEntry?.uvRect || new Float32Array([0, 0, 1, 1]));
            gl.uniform1f(locations.hasTexture, hasTexture ? 1 : 0);
            gl.uniform1f(locations.borderWidth, descriptor.borderWidth);
            gl.uniform1f(locations.personIcon, descriptor.personIcon ? 1 : 0);
            gl.uniform1f(locations.alpha, descriptor.verticalAlpha);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            drawn += 1;
        }

        stats.frames += 1;
        stats.drawCalls += drawn;
        stats.visibleLastFrame = drawn;
        stats.culledLastFrame = culled;
        if (layer) layer.dirty = false;
        return drawn;
    };

    createPipeline();

    renderer.drawTokens = (activeZ = 0, camera = null, renderData = null, isExporting = false) => drawTokens(activeZ, camera, renderData, isExporting);

    const baseRender = renderer.render.bind(renderer);
    renderer.render = (camera, activeZ, renderData, isExporting = false) => {
        const result = baseRender(camera, activeZ, renderData, isExporting);
        drawTokens(activeZ, camera, renderData, isExporting);
        return result;
    };

    const originalSyncTokenView = renderer.syncTokenView?.bind(renderer);
    if (originalSyncTokenView) {
        renderer.syncTokenView = (tokenId) => {
            const result = originalSyncTokenView(tokenId);
            const view = renderer.tokenViews.get(tokenId);
            if (view) ensureVisual(view);
            return result;
        };
    }

    const originalSyncTokenViews = renderer.syncTokenViews?.bind(renderer);
    if (originalSyncTokenViews) {
        renderer.syncTokenViews = (...args) => {
            const result = originalSyncTokenViews(...args);
            for (const view of renderer.tokenViews.views.values()) ensureVisual(view);
            return result;
        };
    }

    for (const view of renderer.tokenViews.views.values()) ensureVisual(view);

    const handleContextRestored = () => {
        if (!renderer.destroyed) {
            createPipeline();
            textureCache.restore();
        }
    };
    renderer.canvas?.addEventListener?.('webglcontextrestored', handleContextRestored, false);

    if (typeof renderer.diagnostics === 'function') {
        const diagnostics = renderer.diagnostics.bind(renderer);
        renderer.diagnostics = (...args) => ({
            ...diagnostics(...args),
            tokenGpu: {
                ...stats,
                activeResources: [...renderer.tokenViews.views.values()].filter((view) => view.resources.has(RESOURCE_KEY)).length,
            },
            tokenTextures: textureCache.diagnostics(),
        });
    }

    if (typeof renderer.destroy === 'function') {
        const destroy = renderer.destroy.bind(renderer);
        renderer.destroy = (...args) => {
            renderer.canvas?.removeEventListener?.('webglcontextrestored', handleContextRestored, false);
            releasePipeline();
            textureCache.destroy();
            return destroy(...args);
        };
    }

    return renderer;
}
