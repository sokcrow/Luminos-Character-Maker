import { Camera } from './camera.js';
import { Renderer } from './renderer.js';

export class Engine {
    constructor(canvas, mapData) {
        this.canvas = canvas;
        this.mapData = mapData;

        this.camera = new Camera(canvas);
        this.renderer = new Renderer(canvas, mapData);

        this.currentZLayer = 0; // The active floor (Z-layer)
        this.isRunning = false;

        this.handleResize = this.handleResize.bind(this);
        this.loop = this.loop.bind(this);

        this.init();
    }

    init() {
        window.addEventListener('resize', this.handleResize);
        this.handleResize(); // Initial sizing

        // Center the camera on the map initially
        this.centerCamera();
    }

    centerCamera() {
        const { cols, rows, size } = this.mapData.grid;
        const mapWidth = cols * size;
        const mapHeight = rows * size;

        this.camera.x = (this.canvas.width / 2) - (mapWidth / 2);
        this.camera.y = (this.canvas.height / 2) - (mapHeight / 2);
    }

    handleResize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            requestAnimationFrame(this.loop);
        }
    }

    stop() {
        this.isRunning = false;
    }

    loop() {
        if (!this.isRunning) return;

        // Update logic (if any physics/animations need stepping)
        this.update();

        // Render logic
        this.renderer.render(this.camera, this.currentZLayer);

        requestAnimationFrame(this.loop);
    }

    update() {
        // Handle logic updates per frame here
    }

    setZLayer(z) {
        this.currentZLayer = z;
    }
}
