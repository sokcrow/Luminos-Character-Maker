const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export class WebGLWorldTransform {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
        this.viewportWidth = 1;
        this.viewportHeight = 1;
        this.matrix = new Float32Array(9);
        this.sync(null, { width: 1, height: 1 });
    }

    sync(camera, viewport = {}) {
        this.x = finite(camera?.x, 0);
        this.y = finite(camera?.y, 0);
        this.zoom = Math.max(0.0001, finite(camera?.zoom, 1));
        this.viewportWidth = Math.max(1, finite(viewport.width, 1));
        this.viewportHeight = Math.max(1, finite(viewport.height, 1));

        const sx = (2 * this.zoom) / this.viewportWidth;
        const sy = (-2 * this.zoom) / this.viewportHeight;
        const tx = ((2 * this.x * this.zoom) / this.viewportWidth) - 1;
        const ty = 1 - ((2 * this.y * this.zoom) / this.viewportHeight);

        // Column-major mat3 for GLSL: clip = u_world * vec3(world, 1).
        this.matrix[0] = sx;
        this.matrix[1] = 0;
        this.matrix[2] = 0;
        this.matrix[3] = 0;
        this.matrix[4] = sy;
        this.matrix[5] = 0;
        this.matrix[6] = tx;
        this.matrix[7] = ty;
        this.matrix[8] = 1;
        return this;
    }

    worldToScreen(worldX, worldY) {
        return {
            x: (finite(worldX) + this.x) * this.zoom,
            y: (finite(worldY) + this.y) * this.zoom,
        };
    }

    screenToWorld(screenX, screenY) {
        return {
            x: (finite(screenX) / this.zoom) - this.x,
            y: (finite(screenY) / this.zoom) - this.y,
        };
    }

    worldToClip(worldX, worldY) {
        const screen = this.worldToScreen(worldX, worldY);
        return {
            x: ((screen.x / this.viewportWidth) * 2) - 1,
            y: 1 - ((screen.y / this.viewportHeight) * 2),
        };
    }

    snapshot() {
        return Object.freeze({
            x: this.x,
            y: this.y,
            zoom: this.zoom,
            viewportWidth: this.viewportWidth,
            viewportHeight: this.viewportHeight,
            matrix: Array.from(this.matrix),
        });
    }
}
