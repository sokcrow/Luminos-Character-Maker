export class TopologyController {
    constructor(canvas, engine, mapData, stateBridge) {
        this.canvas = canvas;
        this.engine = engine;
        this.mapData = mapData;
        this.stateBridge = stateBridge;
        this.topology = globalThis.LuminousVttTopology;
        this.interactions = globalThis.LuminousVttTopologyInteraction;
        this.isDm = Boolean(stateBridge?.isDm);
        this.tool = 'select';
        this.drawStart = null;
        this.selectedId = null;
        this.longPressTimer = null;
        this.longPressTriggered = false;

        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.clearLongPress = this.clearLongPress.bind(this);
        this.handleDocumentClick = this.handleDocumentClick.bind(this);

        const radialHost = document.getElementById('vtt-context-menu');
        this.radial = radialHost && globalThis.LuminousVttInteractionRadial?.createRadialMenu
            ? globalThis.LuminousVttInteractionRadial.createRadialMenu({
                host: radialHost,
                onAction: (action, model) => this.executeInteractionAction(action, model),
            })
            : null;

        this.bindCanvas();
        this.bindUi();
        this.renderMode();
    }

    editActive() { return Boolean(this.isDm && this.mapData.dmEditMode?.active); }
    interactionMode() { return !this.editActive(); }

    bindCanvas() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown, true);
        this.canvas.addEventListener('contextmenu', this.handleContextMenu, true);
        this.canvas.addEventListener('pointerdown', this.handlePointerDown, true);
        this.canvas.addEventListener('pointerup', this.clearLongPress, true);
        this.canvas.addEventListener('pointercancel', this.clearLongPress, true);
        this.canvas.addEventListener('pointermove', (event) => {
            if (!this.longPressTimer) return;
            const dx = Number(event.clientX) - Number(this.longPressOrigin?.x || 0);
            const dy = Number(event.clientY) - Number(this.longPressOrigin?.y || 0);
            if (Math.hypot(dx, dy) > 12) this.clearLongPress();
        }, true);
        window.addEventListener('mousemove', this.handleMouseMove, true);
        window.addEventListener('mouseup', this.handleMouseUp, true);
        document.addEventListener('click', this.handleDocumentClick);
    }

    bindUi() {
        document.querySelectorAll('[data-vtt-tool]').forEach((button) => {
            button.addEventListener('click', () => this.setTool(button.dataset.vttTool));
        });
        document.getElementById('vtt-topology-open-state')?.addEventListener('change', (event) => this.updateSelected({ openState: event.target.value }));
        document.getElementById('vtt-topology-lock-state')?.addEventListener('change', (event) => this.updateSelected({ lockState: event.target.value }));
        document.getElementById('vtt-topology-condition')?.addEventListener('change', (event) => this.updateSelected({ condition: event.target.value }));
        document.getElementById('vtt-topology-hardness')?.addEventListener('change', (event) => this.updateSelectedStructural('hardness', event.target.value, 0, 10));
        document.getElementById('vtt-topology-damaged')?.addEventListener('change', (event) => this.updateSelectedStructural('damaged', event.target.value, 0, 20));
        document.getElementById('vtt-topology-profile')?.addEventListener('change', (event) => this.updateSelectedStructural('profile', event.target.value));
        document.getElementById('vtt-topology-lockpick')?.addEventListener('change', (event) => this.updateSelectedThreshold('lockpick', event.target.value));
        document.getElementById('vtt-topology-interior-side')?.addEventListener('change', (event) => this.updateSelectedInteraction('interiorSide', event.target.value));
        document.getElementById('vtt-topology-lock-side')?.addEventListener('change', (event) => this.updateSelectedInteraction('lockSide', event.target.value));
        document.getElementById('vtt-topology-key-id')?.addEventListener('change', (event) => this.updateSelectedInteraction('keyId', event.target.value.trim() || null));
        document.getElementById('vtt-topology-traversable')?.addEventListener('change', (event) => this.updateSelected({ traversable: Boolean(event.target.checked) }));
        document.getElementById('vtt-topology-curtain-state')?.addEventListener('change', (event) => this.updateSelected({ curtainState: event.target.value }));
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
        if (this.longPressTriggered) {
            this.longPressTriggered = false;
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (this.engine.tokenAtEvent(event)) return;

        const hit = this.topologyAtEvent(event);
        if (this.interactionMode()) {
            if (!hit || hit.type === 'wall') {
                this.hideContextMenu();
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            this.openPlayerMenu(hit, event.clientX, event.clientY);
            return;
        }

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

    handleContextMenu(event) {
        if (!this.interactionMode() || this.engine.tokenAtEvent(event)) return;
        const hit = this.topologyAtEvent(event);
        if (!hit || hit.type === 'wall') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        this.openPlayerMenu(hit, event.clientX, event.clientY);
    }

    handlePointerDown(event) {
        if (!this.interactionMode() || event.pointerType === 'mouse' || this.engine.tokenAtEvent(event)) return;
        const hit = this.topologyAtEvent(event);
        if (!hit || hit.type === 'wall') return;
        this.clearLongPress();
        this.longPressOrigin = { x: event.clientX, y: event.clientY };
        this.longPressTimer = window.setTimeout(() => {
            this.longPressTimer = null;
            this.longPressTriggered = true;
            this.openPlayerMenu(hit, event.clientX, event.clientY);
        }, 460);
    }

    clearLongPress() {
        if (this.longPressTimer) window.clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
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

    tokenOnActiveLayer(token) {
        const layers = Array.isArray(token?.z) ? token.z.map(Number) : [Number(token?.zLayer ?? token?.z) || 0];
        return layers.includes(Number(this.engine.activeZ));
    }

    currentPlayerToken() {
        const tokens = (this.mapData.tokens || []).filter((token) => token && this.tokenOnActiveLayer(token));
        return tokens.find((token) => token.viewer === true || token.controlled === true || token.isControlled === true)
            || tokens.find((token) => token.characterLink?.mode === 'current_player' || token.characterLink?.mode === 'current-player')
            || tokens.find((token) => token.canonicalScope === 'player' && token.draggable !== false)
            || tokens.find((token) => token.draggable !== false)
            || tokens[0]
            || null;
    }

    closingBlocked(element) {
        if (element.openState !== 'open') return false;
        const line = this.topology.segment(element, this.mapData.grid);
        return (this.mapData.tokens || []).some((token) => {
            if (!token || !this.tokenOnActiveLayer(token)) return false;
            const radius = this.interactions?.tokenRadiusPx(token, this.mapData.grid) || Number(token.radius) || 0;
            const distance = this.topology.pointToSegmentDistance(
                { x: Number(token.x) || 0, y: Number(token.y) || 0 },
                { x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 },
            );
            return distance < Math.max(4, radius * 0.9);
        });
    }

    learnMemoryFact(detail) {
        try { window.dispatchEvent(new CustomEvent('vtt:memory-learn', { detail })); } catch (_) {}
    }

    async interactionFacts(element) {
        const token = this.currentPlayerToken();
        if (!token || !this.interactions) return null;
        const hasLockpick = await this.stateBridge.hasItem('lockpick').catch(() => false);
        const keyId = element.interaction?.keyId;
        const hasKey = keyId ? await this.stateBridge.hasItem(keyId).catch(() => false) : false;
        return this.interactions.factsFor(element, token, this.mapData, {
            hasLockpick,
            hasKey,
            blockedByOccupant: this.closingBlocked(element),
        });
    }

    async openPlayerMenu(rawElement, clientX, clientY) {
        if (!this.radial || !this.interactions) return;
        const element = this.topology.normalizeElement(rawElement);
        const facts = await this.interactionFacts(element);
        if (!facts) {
            this.notify('No hay una ficha controlada disponible para interactuar.', 'error');
            return;
        }
        if (element.lockState === 'locked') this.learnMemoryFact({ kind: 'lock_state', elementId: element.id, type: element.type, locked: true });
        const actions = this.interactions.actionsFor(element, facts);
        const stats = this.topology.structuralStats(element);
        this.radial.open({
            x: clientX,
            y: clientY,
            eyebrow: facts.isInterior ? 'INTERIOR · 5 FT' : 'EXTERIOR · 5 FT',
            title: this.interactions.TYPE_LABELS[element.type] || 'OBJETO',
            subtitle: this.interactions.stateLabel(element),
            detail: `DUREZA ${stats.hardness} · DAMAGED ${stats.damaged}/20 · DC STR ${stats.strengthThreshold}`,
            actions,
            elementId: element.id,
            actorTokenId: facts.actorToken?.id || null,
            facts,
        });
    }

    async executeInteractionAction(action, model) {
        const element = (this.mapData.topology || []).find((entry) => String(entry.id) === String(model?.elementId));
        if (!element) {
            this.notify('El objeto ya no está disponible.', 'error');
            return;
        }
        try {
            if (['open', 'close', 'lock', 'unlock', 'open_curtain', 'close_curtain'].includes(action.id)) {
                await this.stateBridge.requestDirectAction(element.id, action.id);
                return;
            }
            if (action.id === 'pick_lock') {
                await this.stateBridge.requestTopologyCheck(element.id, 'lockpick');
                return;
            }
            if (action.id === 'force') {
                await this.stateBridge.requestTopologyCheck(element.id, 'strength');
                return;
            }
            if (action.id === 'attack') {
                window.dispatchEvent(new CustomEvent('vtt:structure-attack-requested', {
                    detail: {
                        mapId: this.stateBridge.mapId,
                        elementId: element.id,
                        actorTokenId: model?.actorTokenId || null,
                        structural: this.topology.structuralStats(element),
                    },
                }));
                this.notify('Estructura seleccionada como objetivo de ataque.', 'success');
                return;
            }
            if (action.id === 'inspect') {
                const text = this.interactions.inspectText(element);
                this.learnMemoryFact({ kind: 'structure_inspected', elementId: element.id, type: element.type, summary: text });
                this.notify(text, 'info');
            }
        } catch (error) {
            this.notify(String(error.message || error), 'error');
        }
    }

    hideContextMenu() {
        if (this.radial) this.radial.close('controller');
        else {
            const menu = document.getElementById('vtt-context-menu');
            if (menu) menu.hidden = true;
        }
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
        const interactive = normalized.type !== 'wall';
        document.getElementById('vtt-topology-interaction-fields').hidden = !interactive;
        document.getElementById('vtt-topology-thickness-field').hidden = interactive;
        if (!interactive) {
            document.getElementById('vtt-topology-thickness').value = normalized.thicknessFt;
            return;
        }

        const stats = this.topology.structuralStats(normalized);
        document.getElementById('vtt-topology-open-state').value = normalized.openState;
        document.getElementById('vtt-topology-lock-state').value = normalized.lockState;
        document.getElementById('vtt-topology-condition').value = normalized.condition;
        document.getElementById('vtt-topology-hardness').value = stats.hardness;
        document.getElementById('vtt-topology-damaged').value = stats.damaged;
        document.getElementById('vtt-topology-profile').value = stats.profile;
        document.getElementById('vtt-topology-strength-dc').textContent = String(stats.strengthThreshold);
        document.getElementById('vtt-topology-shield').textContent = String(stats.currentMaxShield);
        document.getElementById('vtt-topology-lockpick').value = normalized.thresholds.lockpick;
        document.getElementById('vtt-topology-interior-side').value = normalized.interaction.interiorSide;
        document.getElementById('vtt-topology-lock-side').value = normalized.interaction.lockSide;
        document.getElementById('vtt-topology-key-id').value = normalized.interaction.keyId || '';
        const traversableField = document.getElementById('vtt-topology-traversable-field');
        const curtainField = document.getElementById('vtt-topology-curtain-field');
        if (traversableField) traversableField.hidden = !['window', 'curtain_window'].includes(normalized.type);
        if (curtainField) curtainField.hidden = normalized.type !== 'curtain_window';
        if (['window', 'curtain_window'].includes(normalized.type)) document.getElementById('vtt-topology-traversable').checked = normalized.traversable;
        if (normalized.type === 'curtain_window') document.getElementById('vtt-topology-curtain-state').value = normalized.curtainState;
    }

    updateSelected(patch) {
        const element = this.selectedElement();
        if (!element || !this.editActive()) return;
        this.stateBridge.saveElement(this.topology.normalizeElement({ ...element, ...patch }))
            .then(() => this.renderEditor())
            .catch((error) => this.notify(String(error.message || error), 'error'));
    }

    updateSelectedThreshold(key, value) {
        const element = this.selectedElement();
        if (!element || element.type === 'wall' || !this.editActive()) return;
        const thresholds = { ...element.thresholds, [key]: Math.max(0, Math.trunc(Number(value) || 0)) };
        this.updateSelected({ thresholds });
    }

    updateSelectedStructural(key, value, min = null, max = null) {
        const element = this.selectedElement();
        if (!element || element.type === 'wall' || !this.editActive()) return;
        const structural = { ...this.topology.normalizeElement(element).structural };
        structural[key] = min == null ? value : Math.max(min, Math.min(max, Math.trunc(Number(value) || 0)));
        this.updateSelected({ structural });
    }

    updateSelectedInteraction(key, value) {
        const element = this.selectedElement();
        if (!element || element.type === 'wall' || !this.editActive()) return;
        const interaction = { ...this.topology.normalizeElement(element).interaction, [key]: value };
        this.updateSelected({ interaction });
    }

    handleTopologyChanged() {
        if (this.selectedId && !this.selectedElement()) this.selectedId = null;
        if (this.radial?.isOpen()) this.hideContextMenu();
        this.renderEditor();
    }

    notify(message, mode = 'info') {
        const node = document.getElementById('vtt-notice');
        if (!node) return;
        node.textContent = message;
        node.dataset.mode = mode;
        node.hidden = false;
        window.clearTimeout(this.noticeTimer);
        this.noticeTimer = window.setTimeout(() => { node.hidden = true; }, 4200);
    }
}
