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
            if (!token.z.includes(zLayer)) continue;

            const radius = tokenRules?.tokenRadius?.(token, this.mapData.grid)
                || token.radius
                || (this.mapData.grid.size * 0.4);

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
            this.ctx.restore();
            return;
        }

        if (!renderData) return;

        const { fovPolygon, visionRadius, tokenPos, isLookingAway } = renderData;

        this.ctx.save();
        camera.applyTransformSimple(this.ctx);

        if (fovPolygon && fovPolygon.length > 0) {
            this.ctx.beginPath();
            this.ctx.moveTo(fovPolygon[0].x, fovPolygon[0].y);
            for (let i = 1; i < fovPolygon.length; i++) {
                this.ctx.lineTo(fovPolygon[i].x, fovPolygon[i].y);
            }
            this.ctx.closePath();
            this.ctx.clip();

            this.ctx.beginPath();
            this.ctx.arc(tokenPos.x, tokenPos.y, visionRadius, 0, Math.PI * 2, false);
            this.ctx.clip();
        }

        this.ctx.fillStyle = '#111';
        const cameraRectSize = 10000;
        this.ctx.fillRect(
            tokenPos.x - cameraRectSize/2,
            tokenPos.y - cameraRectSize/2,
            cameraRectSize,
            cameraRectSize
        );

        this.drawGrid();

        if (activeZ > 0) {
            this.drawWalls(activeZ - 1, true);
        }

        this.drawWalls(activeZ, false);
        this.drawTokens(activeZ);

        if (isLookingAway) {
            const gradient = this.ctx.createRadialGradient(
                tokenPos.x, tokenPos.y, visionRadius * 0.5,
                tokenPos.x, tokenPos.y, visionRadius
            );
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');

            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(tokenPos.x, tokenPos.y, visionRadius, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();

        if (isLookingAway) {
            this.ctx.save();
            camera.applyTransformSimple(this.ctx);
            this.ctx.globalAlpha = 0.5;
            this.drawTokens(this.mapData.tokens[0].z[0]);
            this.ctx.restore();
        }
    }
}
