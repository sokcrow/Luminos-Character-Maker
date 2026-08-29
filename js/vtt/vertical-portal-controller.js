export class VerticalPortalController {
    constructor(canvas, engine, mapData, stateBridge) {
        this.canvas = canvas;
        this.engine = engine;
        this.mapData = mapData;
        this.stateBridge = stateBridge;
        this.runtime = globalThis.LuminousVttVerticalPortal;
        this.routeRuntime = globalThis.LuminousVttStairRoute;
        this.topology = globalThis.LuminousVttTopology;
        this.isDm = Boolean(stateBridge?.isDm);
        this.tool = 'select';
        this.drawStart = null;
        this.selectedId = null;
        this.topologyController = null;

        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);

        this.mapData.verticalPortalEditor = { visible: false, preview: null, selectedId: null };
        this.bindCanvas();
        this.bindUi();
        this.renderMode();
    }

    editActive() { return Boolean(this.isDm && this.mapData.dmEditMode?.active); }
    setTopologyController(controller) { this.topologyController = controller || null; }

    bindCanvas() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown, true);
        window.addEventListener('mousemove', this.handleMouseMove, true);
        window.addEventListener('mouseup', this.handleMouseUp, true);
    }

    bindUi() {
        document.querySelectorAll('[data-vtt-vertical-tool]').forEach((button) => {
            button.addEventListener('click', () => this.setTool(button.dataset.vttVerticalTool));
        });
        document.querySelectorAll('[data-vtt-tool]').forEach((button) => {
            button.addEventListener('click', () => {
                if (button.dataset.vttTool !== 'select' || this.tool !== 'select') this.setTool('select', false);
            });
        });
        document.getElementById('vtt-vertical-target-z')?.addEventListener('change', () => this.clearPreview());
        document.getElementById('vtt-vertical-editor-target')?.addEventListener('change', (event) => this.updateSelectedTarget(Number(event.target.value)));
        document.getElementById('vtt-vertical-layout')?.addEventListener('change', (event) => this.updateSelected({ layout: event.target.value }));
        document.getElementById('vtt-vertical-width')?.addEventListener('change', (event) => this.updateSelected({ widthFt: Math.max(2, Number(event.target.value) || 5) }));
        document.getElementById('vtt-vertical-delete')?.addEventListener('click', () => {
            if (!this.selectedId || !this.editActive()) return;
            this.stateBridge.deletePortal(this.selectedId)
                .then(() => {
                    this.selectedId = null;
                    this.syncEditorState();
                    this.renderEditor();
                    this.notify('Conexión vertical eliminada.', 'success');
                })
                .catch((error) => this.notify(String(error.message || error), 'error'));
        });
    }

    renderMode() {
        const active = this.editActive();
        const toolbar = document.getElementById('vtt-vertical-toolbar');
        if (toolbar) toolbar.hidden = !active;
        this.mapData.verticalPortalEditor ||= {};
        this.mapData.verticalPortalEditor.visible = active;
        document.body.classList.toggle('vtt-vertical-editor-enabled', active);
        if (!active) {
            this.tool = 'select';
            this.drawStart = null;
            this.clearPreview();
        }
        this.refreshTargetOptions();
        this.renderToolButtons();
        this.renderEditor();
    }

    setTool(tool, resetTopology = true) {
        const valid = ['select', 'opening', 'balcony_edge', 'stairs', 'erase'];
        this.tool = this.editActive() && valid.includes(tool) ? tool : 'select';
        this.drawStart = null;
        this.clearPreview();
        if (resetTopology && this.tool !== 'select') this.topologyController?.setTool?.('select');
        this.renderToolButtons();
    }

    renderToolButtons() {
        document.querySelectorAll('[data-vtt-vertical-tool]').forEach((button) => button.classList.toggle('is-active', button.dataset.vttVerticalTool === this.tool));
    }

    worldPoint(event) { return this.engine.eventWorldPoint(event); }
    activeLayer() { return Number(this.engine.activeZ || 0); }

    zLevelEntries() {
        const levels = this.mapData.zLevels || {};
        if (Array.isArray(levels)) {
            return levels
                .map((entry) => ({ zLayer: Number(entry?.zLayer ?? entry?.z ?? 0), label: entry?.label || `Z ${entry?.zLayer ?? entry?.z ?? 0}` }))
                .sort((a, b) => a.zLayer - b.zLayer);
        }
        return Object.entries(levels)
            .map(([key, entry]) => ({ zLayer: Number(entry?.zLayer ?? key), label: entry?.label || `Z ${entry?.zLayer ?? key}` }))
            .sort((a, b) => a.zLayer - b.zLayer);
    }

    preferredTargetLayer() {
        const active = this.activeLayer();
        const layers = this.zLevelEntries().map((entry) => entry.zLayer).filter((layer) => layer !== active);
        if (layers.includes(active + 1)) return active + 1;
        if (layers.includes(active - 1)) return active - 1;
        return layers[0] ?? active + 1;
    }

    refreshTargetOptions(selectId = 'vtt-vertical-target-z', desiredValue = null) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const active = this.activeLayer();
        const previous = desiredValue ?? Number(select.value);
        const entries = this.zLevelEntries().filter((entry) => entry.zLayer !== active);
        select.replaceChildren();
        for (const entry of entries) {
            const option = document.createElement('option');
            option.value = String(entry.zLayer);
            option.textContent = `${entry.label} · Z${entry.zLayer}`;
            select.appendChild(option);
        }
        const values = entries.map((entry) => entry.zLayer);
        const nextValue = values.includes(Number(previous)) ? Number(previous) : this.preferredTargetLayer();
        if (values.includes(nextValue)) select.value = String(nextValue);
    }

    targetLayer() {
        const value = Number(document.getElementById('vtt-vertical-target-z')?.value);
        return Number.isFinite(value) && value !== this.activeLayer() ? value : this.preferredTargetLayer();
    }

    portalAtEvent(event) {
        if (!this.runtime) return null;
        return this.runtime.hitTest(this.mapData.verticalPortals, this.worldPoint(event), this.mapData, this.activeLayer());
    }

    snapVertex(event) { return this.topology?.snapPointToVertex(this.worldPoint(event), this.mapData.grid) || null; }
    axisAligned(from, candidate) { return this.topology?.axisAlignedVertex?.(from, candidate) || candidate; }
    sameVertex(a, b) { return this.topology?.sameVertex?.(a, b) || (a?.col === b?.col && a?.row === b?.row); }

    setPreview(preview) {
        this.mapData.verticalPortalEditor ||= {};
        this.mapData.verticalPortalEditor.preview = preview;
    }
    clearPreview() { this.setPreview(null); }

    handleMouseDown(event) {
        if (event.button !== 0 || !this.editActive()) return;
        if (this.engine?.tokenAtEvent?.(event)) return;
        const hit = this.portalAtEvent(event);
        if (this.tool === 'select') {
            if (!hit) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            this.selectedId = hit.id;
            this.syncEditorState();
            this.renderEditor();
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        if (this.tool === 'erase') {
            if (!hit) return;
            this.stateBridge.deletePortal(hit.id)
                .then(() => this.notify('Conexión vertical eliminada.', 'success'))
                .catch((error) => this.notify(String(error.message || error), 'error'));
            return;
        }

        const start = this.snapVertex(event);
        if (!start) return;
        this.drawStart = start;
        this.setPreview({ type: this.tool, from: start, to: start, between: [this.activeLayer(), this.targetLayer()] });
    }

    handleMouseMove(event) {
        if (!this.editActive() || !this.drawStart || !['opening', 'balcony_edge', 'stairs'].includes(this.tool)) return;
        const candidate = this.snapVertex(event);
        if (!candidate) return;
        const to = this.axisAligned(this.drawStart, candidate);
        this.setPreview({ type: this.tool, from: this.drawStart, to, between: [this.activeLayer(), this.targetLayer()] });
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    handleMouseUp(event) {
        if (event.button !== 0 || !this.editActive() || !this.drawStart || !['opening', 'balcony_edge', 'stairs'].includes(this.tool)) return;
        const from = this.drawStart;
        const candidate = this.snapVertex(event);
        const to = candidate ? this.axisAligned(from, candidate) : from;
        const type = this.tool;
        const fromZ = this.activeLayer();
        const toZ = this.targetLayer();
        this.drawStart = null;
        this.clearPreview();
        event.preventDefault();
        event.stopImmediatePropagation();
        if (this.sameVertex(from, to) || fromZ === toZ) return;

        const portal = this.runtime.createPortal({ type, from, to, fromZ, toZ, mapData: this.mapData });
        this.stateBridge.savePortal(portal)
            .then((saved) => {
                this.selectedId = saved.id;
                this.syncEditorState();
                this.renderEditor();
                this.notify(`${this.runtime.labelFor(saved)} guardado · Z${fromZ} ↔ Z${toZ}.`, 'success');
            })
            .catch((error) => this.notify(String(error.message || error), 'error'));
    }

    selectedPortal() {
        return (this.mapData.verticalPortals || []).find((portal) => String(portal.id) === String(this.selectedId)) || null;
    }

    syncEditorState() {
        this.mapData.verticalPortalEditor ||= {};
        this.mapData.verticalPortalEditor.visible = this.editActive();
        this.mapData.verticalPortalEditor.selectedId = this.selectedId;
    }

    renderEditor() {
        const editor = document.getElementById('vtt-vertical-editor');
        if (!editor) return;
        if (!this.editActive()) {
            editor.hidden = true;
            return;
        }

        const raw = this.selectedPortal();
        editor.hidden = !raw;
        if (!raw) return;
        const portal = this.runtime.normalizePortal(raw, this.mapData);
        const layers = this.runtime.portalLayers(portal);
        const current = this.activeLayer();
        const other = layers[0] === current ? layers[1] : layers[0];

        document.getElementById('vtt-vertical-type').textContent = portal.type === 'stairs'
            ? `${this.runtime.labelFor(portal)} · ${this.runtime.layoutLabel(portal)}`
            : this.runtime.labelFor(portal);
        document.getElementById('vtt-vertical-id').textContent = portal.id;
        document.getElementById('vtt-vertical-from-z').textContent = `Z${current}`;
        const movement = document.getElementById('vtt-vertical-movement');
        if (movement) movement.textContent = portal.allowsMovement ? `TRANSICIÓN: ${String(portal.movementMode || 'stairs').toUpperCase()}` : 'SOLO VISIÓN / LUZ';
        this.refreshTargetOptions('vtt-vertical-editor-target', other);

        const stairFields = document.getElementById('vtt-stair-fields');
        if (stairFields) stairFields.hidden = portal.type !== 'stairs';
        if (portal.type === 'stairs') {
            const layout = document.getElementById('vtt-vertical-layout');
            const width = document.getElementById('vtt-vertical-width');
            const length = document.getElementById('vtt-vertical-path-length');
            if (layout) layout.value = portal.layout;
            if (width) width.value = portal.widthFt;
            const route = this.routeRuntime?.routeFor?.(portal, this.mapData);
            if (length) length.textContent = route ? `${route.pathLengthFt.toFixed(1)} ft` : '—';
        }
    }

    updateSelected(patch) {
        const raw = this.selectedPortal();
        if (!raw || !this.editActive()) return;
        const next = this.runtime.normalizePortal({ ...raw, ...patch }, this.mapData);
        this.stateBridge.savePortal(next)
            .then(() => {
                this.renderEditor();
                this.notify('Conexión vertical actualizada.', 'success');
            })
            .catch((error) => this.notify(String(error.message || error), 'error'));
    }

    updateSelectedTarget(targetZ) {
        const raw = this.selectedPortal();
        if (!raw || !Number.isFinite(Number(targetZ)) || !this.editActive()) return;
        const portal = this.runtime.normalizePortal(raw, this.mapData);
        const current = this.activeLayer();
        if (Number(targetZ) === current) return;
        portal.between = [current, Number(targetZ)];
        this.stateBridge.savePortal(portal)
            .then(() => this.notify(`Conexión actualizada · Z${current} ↔ Z${targetZ}.`, 'success'))
            .catch((error) => this.notify(String(error.message || error), 'error'));
    }

    handlePortalsChanged() {
        if (this.selectedId && !this.selectedPortal()) this.selectedId = null;
        this.syncEditorState();
        this.renderEditor();
    }

    handleLayerChanged() {
        this.drawStart = null;
        this.clearPreview();
        if (this.selectedId && !this.runtime.portalOnLayer(this.selectedPortal(), this.activeLayer())) this.selectedId = null;
        this.refreshTargetOptions();
        this.syncEditorState();
        this.renderEditor();
    }

    notify(message, mode = 'info') {
        const node = document.getElementById('vtt-notice');
        if (!node) return;
        node.textContent = message;
        node.dataset.mode = mode;
        node.hidden = false;
        window.clearTimeout(this.noticeTimer);
        this.noticeTimer = window.setTimeout(() => { node.hidden = true; }, 3200);
    }

    destroy() {
        this.canvas.removeEventListener('mousedown', this.handleMouseDown, true);
        window.removeEventListener('mousemove', this.handleMouseMove, true);
        window.removeEventListener('mouseup', this.handleMouseUp, true);
        this.clearPreview();
    }
}
