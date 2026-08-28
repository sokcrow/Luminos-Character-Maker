export class Renderer {
    constructor(canvas, mapData) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.mapData = mapData;
    }

    clear(isExporting) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!isExporting) {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    drawGrid(isExporting = false) {
        const { cols, rows, size } = this.mapData.grid;
        const width = cols * size;
        const height = rows * size;

        this.ctx.strokeStyle = isExporting ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;

        this.ctx.beginPath();
        for (let x = 0; x <= cols; x++) {
            this.ctx.moveTo(x * size, 0);
            this.ctx.lineTo(x * size, height);
        }
        for (let y = 0; y <= rows; y++) {
            this.ctx.moveTo(0, y * size);
            this.ctx.lineTo(width, y * size);
        }
        this.ctx.stroke();
    }

    drawWalls(zLayer, isOnionSkin = false) {
        if (!this.mapData.walls) return;
        this.ctx.save();
        if (isOnionSkin) {
            this.ctx.strokeStyle = '#666666';
            this.ctx.globalAlpha = 0.3;
        } else {
            this.ctx.strokeStyle = '#ff0000';
            this.ctx.globalAlpha = 1.0;
        }
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        for (const wall of this.mapData.walls) {
            if (wall.z.includes(zLayer)) {
                this.ctx.moveTo(wall.x1, wall.y1);
                this.ctx.lineTo(wall.x2, wall.y2);
            }
        }
        this.ctx.stroke();
        this.ctx.restore();
    }

    topologyStyle(element, preview = false) {
        if (preview) return { stroke: '#ffffff', width: 4, dash: [8, 5], label: '' };
        const state = element.state;
        const broken = state === 'broken';
        const open = state === 'open';
        const styles = {
            wall: { stroke: '#ff3030', width: 4, label: 'WALL' },
            door: { stroke: '#ffb000', width: 7, label: state === 'locked' ? 'D·LOCK' : 'DOOR' },
            window: { stroke: '#00cfff', width: 6, label: state === 'locked' ? 'W·LOCK' : 'WINDOW' },
            curtain_window: { stroke: '#b784ff', width: 7, label: state === 'locked' ? 'C·LOCK' : 'CURTAIN' },
        };
        const base = styles[element.type] || styles.wall;
        return { ...base, dash: broken ? [5, 7] : open ? [12, 9] : [] };
    }

    drawTopologyElement(element, isOnionSkin = false, preview = false) {
        const topology = globalThis.LuminousVttTopology;
        if (!topology) return;
        const normalized = preview ? element : topology.normalizeElement(element);
        const line = topology.segment(normalized, this.mapData.grid);
        const style = this.topologyStyle(normalized, preview);
        const ctx = this.ctx;

        ctx.save();
        ctx.globalAlpha = isOnionSkin ? 0.28 : preview ? 0.75 : 1;
        ctx.strokeStyle = isOnionSkin ? '#6f6f6f' : style.stroke;
        ctx.lineWidth = style.width;
        ctx.lineCap = 'round';
        ctx.setLineDash(style.dash || []);
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (!preview && normalized.type !== 'wall' && !isOnionSkin) {
            const mx = (line.x1 + line.x2) / 2;
            const my = (line.y1 + line.y2) / 2;
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const label = normalized.state === 'broken' ? 'BROKEN' : style.label;
            const metrics = ctx.measureText(label);
            ctx.fillStyle = 'rgba(0,0,0,.82)';
            ctx.fillRect(mx - (metrics.width / 2) - 5, my - 9, metrics.width + 10, 18);
            ctx.fillStyle = style.stroke;
            ctx.fillText(label, mx, my);
        }
        ctx.restore();
    }

    drawTopology(zLayer, isOnionSkin = false) {
        const topology = globalThis.LuminousVttTopology;
        if (!topology || !Array.isArray(this.mapData.topology)) return;
        this.mapData.topology.forEach((element) => {
            if (topology.elementOnLayer(element, zLayer)) this.drawTopologyElement(element, isOnionSkin, false);
        });
        const preview = this.mapData.topologyPreview;
        if (!isOnionSkin && preview && topology.elementOnLayer(preview, zLayer)) {
            this.drawTopologyElement(preview, false, true);
        }
    }

    drawPersonIcon(token, radius) {
        const ctx = this.ctx;
        const iconColor = token.iconColor || '#ffffff';
        ctx.fillStyle = iconColor;
        ctx.beginPath();
        ctx.arc(token.x, token.y - radius * 0.24, radius * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(token.x, token.y + radius * 0.46, radius * 0.47, Math.PI, Math.PI * 2);
        ctx.lineTo(token.x + radius * 0.47, token.y + radius * 0.56);
        ctx.lineTo(token.x - radius * 0.47, token.y + radius * 0.56);
        ctx.closePath();
        ctx.fill();
    }

    drawTokens(zLayer) {
        if (!this.mapData.tokens) return;
        const tokenRules = globalThis.LuminousVttTokenInteraction;
        for (const token of this.mapData.tokens) {
            const tokenLayer = Number(token.zLayer ?? token.gridPosition?.z ?? token.z?.[0] ?? 0);
            if (tokenLayer !== Number(zLayer)) continue;
            const radius = tokenRules?.tokenRadius?.(token, this.mapData.grid) || token.radius || (this.mapData.grid.size * 0.4);
            this.ctx.save();
            this.ctx.fillStyle = token.backgroundColor || '#20242a';
            this.ctx.beginPath();
            this.ctx.arc(token.x, token.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            if ((token.icon || 'person') === 'person') this.drawPersonIcon(token, radius);
            this.ctx.strokeStyle = token.color || '#ffffff';
            this.ctx.lineWidth = Math.max(2, radius * 0.08);
            this.ctx.beginPath();
            this.ctx.arc(token.x, token.y, radius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();
        }
    }

    render(camera, activeZ, renderData, isExporting = false) {
        this.clear(isExporting);

        if (isExporting) {
            this.ctx.save();
            camera.applyTransformSimple(this.ctx);
            this.drawGrid(true);
            this.drawWalls(activeZ, false);
            this.drawTopology(activeZ, false);
            this.ctx.restore();
            return;
        }

        if (!renderData || renderData.visible === false) return;
        const { fovPolygon, visionRadius, tokenPos, monochrome } = renderData;
        if (!fovPolygon || fovPolygon.length < 3 || visionRadius <= 0) return;

        this.ctx.save();
        camera.applyTransformSimple(this.ctx);
        this.ctx.beginPath();
        this.ctx.moveTo(fovPolygon[0].x, fovPolygon[0].y);
        for (let i = 1; i < fovPolygon.length; i++) this.ctx.lineTo(fovPolygon[i].x, fovPolygon[i].y);
        this.ctx.closePath();
        this.ctx.clip();

        this.ctx.beginPath();
        this.ctx.arc(tokenPos.x, tokenPos.y, visionRadius, 0, Math.PI * 2, false);
        this.ctx.clip();

        if (monochrome) this.ctx.filter = 'grayscale(1)';
        this.ctx.fillStyle = '#111';
        const cameraRectSize = 10000;
        this.ctx.fillRect(tokenPos.x - cameraRectSize / 2, tokenPos.y - cameraRectSize / 2, cameraRectSize, cameraRectSize);

        this.drawGrid();
        if (activeZ > 0) {
            this.drawWalls(activeZ - 1, true);
            this.drawTopology(activeZ - 1, true);
        }
        this.drawWalls(activeZ, false);
        this.drawTopology(activeZ, false);
        this.drawTokens(activeZ);
        this.ctx.restore();
    }
}