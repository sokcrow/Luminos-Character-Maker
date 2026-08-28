export class TopologyController {
    constructor(canvas, engine, mapData, stateBridge) {
        this.canvas = canvas;
        this.engine = engine;
        this.mapData = mapData;
        this.stateBridge = stateBridge;
        this.topology = globalThis.LuminousVttTopology;
        this.isDm = Boolean(stateBridge?.isDm);
        this.tool = 'select';
        this.drawStart = null;
        this.selectedId = null;

        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleDocumentClick = this.handleDocumentClick.bind(this);

        this.bindCanvas();
        this.bindUi();
        this.renderMode();
    }

    editActive() { return Boolean(this.isDm && this.mapData.dmEditMode?.active); }

    bindCanvas() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown, true);
        window.addEventListener('mousemove', this.handleMouseMove, true);
        window.addEventListener('mouseup', this.handleMouseUp, true);
        document.addEventListener('click', this.handleDocumentClick);
    }

    bindUi() {
        document.querySelectorAll('[data-vtt-tool]').forEach((button) => {
            button.addEventListener('click', () => this.setTool(button.dataset.vttTool));
        });
        document.getElementById('vtt-topology-state')?.addEventListener('change', (event) => this.updateSelected({ state: event.target.value }));
        document.getElementById('vtt-topology-lockpick')?.addEventListener('change', (event) => this.updateSelectedThreshold('lockpick', event.target.value));
        document.getElementById('vtt-topology-break')?.addEventListener('change', (event) => this.updateSelectedThreshold('break', event.target.value));
        document.getElementById('vtt-topology-thickness')?.addEventListener('change', (event) => {
            this.updateSelected({ thicknessFt: Math.max(0.1, Number(event.target.value) || 0.5) });
        });
        document.getElementById('vtt-topology-delete')?.addEventListener('click', () => {
            if (!this.selectedId || !this.editActive()) return;
            this.stateBridge.deleteElement(this.selectedId)
                .then(() => {
                    this.selectedId = null;
                    this.renderEditor();
                    this.notify('Elemento eliminado.', 'success');
                })
                .catch((error) => this.notify(String(error.message || error), 'error'));
        });
    }

    renderMode() {
        const active = this.editActive();
        const toolbar = document.getElementById('vtt-topology-toolbar');
        const exportButton = document.getElementById('btn-export-uv');
        if (toolbar) toolbar.hidden = !active;
        if (exportButton) exportButton.hidden = !this.isDm;
        document.body.classList.toggle('vtt-dm-mode', this.isDm);
        document.body.classList.toggle('vtt-player-mode', !this.isDm);
        if (!active) {
            this.tool = 'select';
            this.drawStart = null;
            this.mapData.topologyPreview = null;
        }
        this.renderToolButtons();
        this.renderEditor();
    }

    setTool(tool) {
        const valid = ['select', 'wall', 'door', 'window', 'curtain_window', 'erase'];
        this.tool = this.editActive() && valid.includes(tool) ? tool : 'select';
        this.drawStart = null;
        this.mapData.topologyPreview = null;
        this.hideContextMenu();
        this.renderToolButtons();
    }

    renderToolButtons() {
        document.querySelectorAll('[data-vtt-tool]').forEach((button) => button.classList.toggle('is-active', button.dataset.vttTool === this.tool));
    }

    worldPoint(event) { return this.engine.eventWorldPoint(event); }

    topologyAtEvent(event) {
        if (!this.topology) return null;
        return this.topology.hitTest(this.mapData.topology, this.worldPoint(event), this.mapData.grid, this.engine.activeZ);
    }

    handleMouseDown(event) {
        if (event.button !== 0) return;
        if (this.engine.tokenAtEvent(event)) return;

        const hit = this.topologyAtEvent(event);
        if (!this.isDm) {
            if (!hit || hit.type === 'wall') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            this.openPlayerMenu(hit, event.clientX, event.clientY);
            return;
        }
        if (!this.editActive()) return;

        if (this.tool === 'select') {
            if (!hit) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            this.selectedId = hit.id;
            this.renderEditor();
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        if (this.tool === 'erase') {
            if (!hit) return;
            this.stateBridge.deleteElement(hit.id)
                .then(() => this.notify('Elemento eliminado.', 'success'))
                .catch((error) => this.notify(String(error.message || error), 'error'));
            return;
        }

        this.drawStart = this.topology.snapPointToVertex(this.worldPoint(event), this.mapData.grid);
        this.mapData.topologyPreview = { type: this.tool, from: this.drawStart, to: this.drawStart, z: [this.engine.activeZ] };
    }

    handleMouseMove(event) {
        if (!this.editActive() || !this.drawStart || !['wall', 'door', 'window', 'curtain_window'].includes(this.tool)) return;
        const candidate = this.topology.snapPointToVertex(this.worldPoint(event), this.mapData.grid);
        const to = this.topology.axisAlignedVertex(this.drawStart, candidate);
        this.mapData.topologyPreview = { type: this.tool, from: this.drawStart, to, z: [this.engine.activeZ] };
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    handleMouseUp(event) {
        if (event.button !== 0 || !this.editActive() || !this.drawStart) return;
        const from = this.drawStart;
        const candidate = this.topology.snapPointToVertex(this.worldPoint(event), this.mapData.grid);
        const to = this.topology.axisAlignedVertex(from, candidate);
        const type = this.tool;
        this.drawStart = null;
        this.mapData.topologyPreview = null;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (this.topology.sameVertex(from, to)) return;

        const element = this.topology.createElement({ type, from, to, zLayer: this.engine.activeZ });
        this.stateBridge.saveElement(element)
            .then((saved) => {
                this.selectedId = saved.id;
                this.renderEditor();
                this.notify('Topología guardada.', 'success');
            })
            .catch((error) => this.notify(String(error.message || error), 'error'));
    }

    handleDocumentClick(event) {
        const menu = document.getElementById('vtt-context-menu');
        if (!menu || menu.hidden || menu.contains(event.target) || event.target === this.canvas) return;
        this.hideContextMenu();
    }

    currentPlayerToken() {
        return (this.mapData.tokens || []).find((token) => {
            if (!token || token.draggable === false) return false;
            const layers = Array.isArray(token.z) ? token.z.map(Number) : [Number(token.z) || 0];
            return layers.includes(Number(this.engine.activeZ));
        }) || this.mapData.tokens?.[0] || null;
    }

    canReach(element) {
        const token = this.currentPlayerToken();
        if (!token) return false;
        const line = this.topology.segment(element, this.mapData.grid);
        const distance = this.topology.pointToSegmentDistance({ x: token.x, y: token.y }, { x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 });
        return distance <= (this.mapData.grid.size * 0.8);
    }

    async openPlayerMenu(rawElement, clientX, clientY) {
        const element = this.topology.normalizeElement(rawElement);
        if (!this.canReach(element)) {
            this.notify('Acércate a la puerta o ventana para interactuar.', 'error');
            return;
        }

        const menu = document.getElementById('vtt-context-menu');
        const title = document.getElementById('vtt-context-title');
        const state = document.getElementById('vtt-context-state');
        const actions = document.getElementById('vtt-context-actions');
        if (!menu || !title || !state || !actions) return;

        const typeLabels = { door: 'PUERTA', window: 'VENTANA', curtain_window: 'VENTANA CON CORTINA' };
        title.textContent = typeLabels[element.type] || 'OBJETO';
        state.textContent = element.state === 'locked' ? 'CERRADA' : String(element.state || '').toUpperCase();
        actions.replaceChildren();

        const addButton = (label, handler, disabled = false, hint = '') => {
            const wrapper = document.createElement('div');
            wrapper.className = 'vtt-context-action';
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.disabled = disabled;
            button.addEventListener('click', async () => {
                this.hideContextMenu();
                try { await handler(); } catch (error) { this.notify(String(error.message || error), 'error'); }
            });
            wrapper.appendChild(button);
            if (hint) {
                const small = document.createElement('small');
                small.textContent = hint;
                wrapper.appendChild(small);
            }
            actions.appendChild(wrapper);
        };

        const direct = this.topology.directActions(element);
        if (direct.includes('open')) addButton('ABRIR', () => this.stateBridge.requestDirectAction(element.id, 'open'));
        if (direct.includes('close')) addButton('CERRAR', () => this.stateBridge.requestDirectAction(element.id, 'close'));

        if (element.state === 'locked') {
            const hasLockpick = await this.stateBridge.hasItem('lockpick');
            addButton('JUEGO DE MANOS', () => this.stateBridge.requestTopologyCheck(element.id, 'lockpick'), !hasLockpick, hasLockpick ? 'Requiere Ganzúa' : 'No tienes Ganzúa');
            addButton('ROMPER · STRENGTH', () => this.stateBridge.requestTopologyCheck(element.id, 'strength'));
            addButton('ROMPER · ATHLETICS', () => this.stateBridge.requestTopologyCheck(element.id, 'athletics'));
        }

        if (element.state === 'broken') {
            const note = document.createElement('div');
            note.className = 'vtt-context-note';
            note.textContent = 'ESTÁ ROTA · PASO LIBRE';
            actions.appendChild(note);
        }

        menu.style.left = `${Math.min(window.innerWidth - 280, Math.max(12, clientX + 12))}px`;
        menu.style.top = `${Math.min(window.innerHeight - 260, Math.max(12, clientY + 12))}px`;
        menu.hidden = false;
    }

    hideContextMenu() {
        const menu = document.getElementById('vtt-context-menu');
        if (menu) menu.hidden = true;
    }

    selectedElement() {
        return (this.mapData.topology || []).find((element) => String(element.id) === String(this.selectedId)) || null;
    }

    renderEditor() {
        const editor = document.getElementById('vtt-topology-editor');
        if (!editor) return;
        if (!this.editActive()) {
            editor.hidden = true;
            return;
        }
        const element = this.selectedElement();
        editor.hidden = !element;
        if (!element) return;

        const normalized = this.topology.normalizeElement(element);
        document.getElementById('vtt-topology-id').textContent = normalized.id;
        document.getElementById('vtt-topology-type').textContent = normalized.type.toUpperCase().replace('_', ' ');
        const stateField = document.getElementById('vtt-topology-state-field');
        const thresholdFields = document.getElementById('vtt-topology-threshold-fields');
        const thicknessField = document.getElementById('vtt-topology-thickness-field');
        const state = document.getElementById('vtt-topology-state');
        const lockpick = document.getElementById('vtt-topology-lockpick');
        const breakThreshold = document.getElementById('vtt-topology-break');
        const thickness = document.getElementById('vtt-topology-thickness');

        const interactive = normalized.type !== 'wall';
        if (stateField) stateField.hidden = !interactive;
        if (thresholdFields) thresholdFields.hidden = !interactive;
        if (thicknessField) thicknessField.hidden = interactive;
        if (state && interactive) state.value = normalized.state;
        if (lockpick && interactive) lockpick.value = normalized.thresholds.lockpick;
        if (breakThreshold && interactive) breakThreshold.value = normalized.thresholds.break;
        if (thickness && !interactive) thickness.value = normalized.thicknessFt;
    }

    updateSelected(patch) {
        const element = this.selectedElement();
        if (!element || !this.editActive()) return;
        this.stateBridge.saveElement(this.topology.normalizeElement({ ...element, ...patch }))
            .catch((error) => this.notify(String(error.message || error), 'error'));
    }

    updateSelectedThreshold(key, value) {
        const element = this.selectedElement();
        if (!element || element.type === 'wall' || !this.editActive()) return;
        const thresholds = { ...element.thresholds, [key]: Math.max(0, Math.trunc(Number(value) || 0)) };
        this.updateSelected({ thresholds });
    }

    handleTopologyChanged() {
        if (this.selectedId && !this.selectedElement()) this.selectedId = null;
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
}
