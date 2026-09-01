import { tokenRadiusForView } from './webgl2-token-layer.js';

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const INTERACTION_VERTEX_SHADER = `#version 300 es
in vec2 a_unit;
uniform mat3 u_world;
uniform vec2 u_center;
uniform float u_radius;
out vec2 v_local;
void main() {
    v_local = a_unit;
    vec2 worldPosition = u_center + (a_unit * u_radius);
    vec3 clip = u_world * vec3(worldPosition, 1.0);
    gl_Position = vec4(clip.xy, 0.0, 1.0);
}`;

const INTERACTION_FRAGMENT_SHADER = `#version 300 es
precision mediump float;
in vec2 v_local;
uniform vec4 u_color;
uniform float u_innerRadius;
out vec4 outColor;
void main() {
    float distanceFromCenter = length(v_local);
    if (distanceFromCenter > 1.0 || distanceFromCenter < u_innerRadius) discard;
    outColor = u_color;
}`;

function rgb(color, fallback = '#ffffff') {
    const text = String(color || fallback).trim();
    const short = /^#([0-9a-f]{3})$/i.exec(text);
    const full = /^#([0-9a-f]{6})$/i.exec(text);
    let hex = String(fallback || '#ffffff').replace('#', '');
    if (short) hex = short[1].split('').map((entry) => entry + entry).join('');
    else if (full) hex = full[1];
    if (!/^[0-9a-f]{6}$/i.test(hex)) hex = 'ffffff';
    return [
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
    ];
}

function brighten(base, amount) {
    return base.map((channel) => Math.min(1, channel + ((1 - channel) * amount)));
}

export function tokenInteractionStyle(view) {
    const interaction = view?.interaction || {};
    if (!interaction.hovered && !interaction.selected && !interaction.targeted) return null;

    const base = rgb(view?.token?.color, '#ffffff');
    if (interaction.targeted) {
        return {
            radiusScale: 1.18,
            innerRadius: 0.74,
            color: new Float32Array([...brighten(base, 0.45), 1]),
            state: 'targeted',
        };
    }
    if (interaction.selected) {
        return {
            radiusScale: 1.14,
            innerRadius: 0.80,
            color: new Float32Array([...brighten(base, 0.65), 1]),
            state: 'selected',
        };
    }
    return {
        radiusScale: 1.08,
        innerRadius: 0.88,
        color: new Float32Array([...brighten(base, 0.28), 1]),
        state: 'hovered',
    };
}

function createProgram(renderer) {
    const gl = renderer.gl;
    const vertexShader = renderer.compileShader(gl.VERTEX_SHADER, INTERACTION_VERTEX_SHADER);
    const fragmentShader = renderer.compileShader(gl.FRAGMENT_SHADER, INTERACTION_FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) {
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        throw new Error('Unable to allocate WebGL2 token interaction program.');
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program) || 'Unknown WebGL2 token interaction program link error.';
        gl.deleteProgram(program);
        throw new Error(message);
    }
    return program;
}

export function installWebGL2TokenInteractionLayer(renderer) {
    if (!renderer || renderer.backend !== 'webgl2' || !renderer.tokenViews) return renderer;
    if (renderer.__webgl2TokenInteractionLayerInstalled) return renderer;
    renderer.__webgl2TokenInteractionLayerInstalled = true;

    const stats = {
        frames: 0,
        drawCalls: 0,
        visibleLastFrame: 0,
        hoveredLastFrame: 0,
        selectedLastFrame: 0,
        targetedLastFrame: 0,
        culledLastFrame: 0,
    };

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
        if (!quadBuffer) throw new Error('Unable to allocate WebGL2 token interaction quad buffer.');
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
            color: gl.getUniformLocation(program, 'u_color'),
            innerRadius: gl.getUniformLocation(program, 'u_innerRadius'),
        };
        return true;
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

    const drawTokenInteractions = (activeZ = 0, camera = null, renderData = null, isExporting = false) => {
        if (renderer.destroyed || renderer.contextLost || !renderer.gl || !program || !quadBuffer || !locations) return 0;
        if (isExporting || renderData?.visible === false) return 0;
        const tokenLayer = renderer.layers?.get?.('tokens');
        if (tokenLayer && tokenLayer.visible === false) return 0;

        const gl = renderer.gl;
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.enableVertexAttribArray(locations.unit);
        gl.vertexAttribPointer(locations.unit, 2, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix3fv(locations.world, false, renderer.world.matrix);

        let drawn = 0;
        let culled = 0;
        let hovered = 0;
        let selected = 0;
        let targeted = 0;
        for (const view of renderer.tokenViews.views.values()) {
            if (!view || view.destroyed || view.visible === false || !viewOnActiveLayer(view, activeZ)) continue;
            const style = tokenInteractionStyle(view);
            if (!style) continue;
            const radius = tokenRadiusForView(view, renderer.mapData) * style.radiusScale;
            if (!viewInViewport(view, radius, camera)) {
                culled += 1;
                continue;
            }

            gl.uniform2f(locations.center, view.renderX, view.renderY);
            gl.uniform1f(locations.radius, radius);
            gl.uniform4fv(locations.color, style.color);
            gl.uniform1f(locations.innerRadius, style.innerRadius);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            drawn += 1;
            if (style.state === 'hovered') hovered += 1;
            else if (style.state === 'selected') selected += 1;
            else if (style.state === 'targeted') targeted += 1;
        }

        stats.frames += 1;
        stats.drawCalls += drawn;
        stats.visibleLastFrame = drawn;
        stats.hoveredLastFrame = hovered;
        stats.selectedLastFrame = selected;
        stats.targetedLastFrame = targeted;
        stats.culledLastFrame = culled;
        return drawn;
    };

    createPipeline();
    renderer.drawTokenInteractions = (activeZ = 0, camera = null, renderData = null, isExporting = false) => drawTokenInteractions(activeZ, camera, renderData, isExporting);

    const baseRender = renderer.render.bind(renderer);
    renderer.render = (camera, activeZ, renderData, isExporting = false) => {
        const result = baseRender(camera, activeZ, renderData, isExporting);
        drawTokenInteractions(activeZ, camera, renderData, isExporting);
        return result;
    };

    const handleContextRestored = () => {
        if (!renderer.destroyed) createPipeline();
    };
    renderer.canvas?.addEventListener?.('webglcontextrestored', handleContextRestored, false);

    if (typeof renderer.diagnostics === 'function') {
        const diagnostics = renderer.diagnostics.bind(renderer);
        renderer.diagnostics = (...args) => ({
            ...diagnostics(...args),
            tokenInteractionGpu: { ...stats },
        });
    }

    if (typeof renderer.destroy === 'function') {
        const destroy = renderer.destroy.bind(renderer);
        renderer.destroy = (...args) => {
            renderer.canvas?.removeEventListener?.('webglcontextrestored', handleContextRestored, false);
            releasePipeline();
            return destroy(...args);
        };
    }

    return renderer;
}
