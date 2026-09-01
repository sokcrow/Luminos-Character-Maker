(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.LuminousVttInteractionRadial = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
    'use strict';

    const PAGE_SIZE = 8;
    const INNER_RADIUS = 118;
    const OUTER_RADIUS = 144;
    const VIEWPORT_MARGIN = 18;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    function createElement(tag, className, text) {
        const node = browserRoot.document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function createRadialMenu({ host, onAction, onClose } = {}) {
        if (!host) throw new Error('RADIAL_HOST_REQUIRED');
        let model = null;
        let page = 0;
        let selectedIndex = 0;
        let keyHandler = null;

        host.classList.add('vtt-interaction-radial');
        host.setAttribute('role', 'menu');
        host.setAttribute('aria-label', 'Interacciones con el mundo');

        function pages() { return Math.max(1, Math.ceil((model?.actions?.length || 0) / PAGE_SIZE)); }
        function pageActions() { return (model?.actions || []).slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE); }

        function position(clientX, clientY) {
            const width = OUTER_RADIUS * 2 + 80;
            const height = OUTER_RADIUS * 2 + 80;
            const x = clamp(clientX - width / 2, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, browserRoot.innerWidth - width - VIEWPORT_MARGIN));
            const y = clamp(clientY - height / 2, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, browserRoot.innerHeight - height - VIEWPORT_MARGIN));
            host.style.left = `${Math.round(x)}px`;
            host.style.top = `${Math.round(y)}px`;
            host.style.setProperty('--radial-pointer-x', `${Math.round(clientX - x)}px`);
            host.style.setProperty('--radial-pointer-y', `${Math.round(clientY - y)}px`);
        }

        function previewAction(action) {
            const preview = host.querySelector('[data-radial-preview]');
            const detail = host.querySelector('[data-radial-detail]');
            if (!preview || !detail) return;
            preview.textContent = action?.label || model?.subtitle || '';
            detail.textContent = action ? (action.enabled ? action.description : action.reason) : (model?.detail || '');
            preview.dataset.disabled = action && !action.enabled ? 'true' : 'false';
        }

        async function activate(action) {
            if (!action) return;
            if (!action.enabled) {
                previewAction(action);
                host.classList.remove('vtt-radial-denied');
                void host.offsetWidth;
                host.classList.add('vtt-radial-denied');
                return;
            }
            close('action');
            if (typeof onAction === 'function') await onAction(action, model);
        }

        function select(delta) {
            const actions = pageActions();
            if (!actions.length) return;
            selectedIndex = (selectedIndex + delta + actions.length) % actions.length;
            const buttons = Array.from(host.querySelectorAll('[data-radial-action]'));
            buttons.forEach((button, index) => button.classList.toggle('is-selected', index === selectedIndex));
            buttons[selectedIndex]?.focus({ preventScroll: true });
            previewAction(actions[selectedIndex]);
        }

        function changePage(delta) {
            const count = pages();
            if (count <= 1) return;
            page = (page + delta + count) % count;
            selectedIndex = 0;
            render();
        }

        function bindKeyboard() {
            if (keyHandler) browserRoot.removeEventListener('keydown', keyHandler, true);
            keyHandler = (event) => {
                if (host.hidden) return;
                if (event.key === 'Escape') {
                    event.preventDefault();
                    close('escape');
                    return;
                }
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                    event.preventDefault(); select(1); return;
                }
                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                    event.preventDefault(); select(-1); return;
                }
                if (event.key === 'PageDown' || event.key === ']') {
                    event.preventDefault(); changePage(1); return;
                }
                if (event.key === 'PageUp' || event.key === '[') {
                    event.preventDefault(); changePage(-1); return;
                }
                if (/^[1-8]$/.test(event.key)) {
                    const action = pageActions()[Number(event.key) - 1];
                    if (action) { event.preventDefault(); activate(action); }
                    return;
                }
                if (event.key === 'Enter' || event.key === ' ') {
                    const action = pageActions()[selectedIndex];
                    if (action) { event.preventDefault(); activate(action); }
                }
            };
            browserRoot.addEventListener('keydown', keyHandler, true);
        }

        function render() {
            host.replaceChildren();
            host.dataset.page = String(page + 1);
            const stage = createElement('div', 'vtt-radial-stage');
            const center = createElement('div', 'vtt-radial-center');
            const eyebrow = createElement('span', 'vtt-radial-eyebrow', model?.eyebrow || 'INTERACTUAR');
            const title = createElement('strong', 'vtt-radial-title', model?.title || 'OBJETO');
            const state = createElement('span', 'vtt-radial-state', model?.subtitle || '');
            const preview = createElement('span', 'vtt-radial-preview', model?.subtitle || '');
            preview.dataset.radialPreview = 'true';
            const detail = createElement('small', 'vtt-radial-detail', model?.detail || '');
            detail.dataset.radialDetail = 'true';
            center.append(eyebrow, title, state, preview, detail);
            stage.appendChild(center);

            const actions = pageActions();
            actions.forEach((item, index) => {
                const angle = (-90 + ((360 / Math.max(actions.length, 1)) * index)) * (Math.PI / 180);
                const button = createElement('button', 'vtt-radial-action');
                button.type = 'button';
                button.dataset.radialAction = item.id;
                button.dataset.tone = item.tone || 'default';
                button.dataset.enabled = item.enabled ? 'true' : 'false';
                button.setAttribute('role', 'menuitem');
                button.setAttribute('aria-disabled', item.enabled ? 'false' : 'true');
                button.setAttribute('aria-label', item.enabled ? item.label : `${item.label}. ${item.reason}`);
                button.style.setProperty('--radial-x', `${Math.cos(angle) * INNER_RADIUS}px`);
                button.style.setProperty('--radial-y', `${Math.sin(angle) * INNER_RADIUS}px`);
                const shortcut = createElement('kbd', 'vtt-radial-shortcut', String(index + 1));
                const icon = createElement('span', 'vtt-radial-icon', item.icon || '•');
                const label = createElement('span', 'vtt-radial-label', item.label);
                button.append(shortcut, icon, label);
                button.addEventListener('mouseenter', () => previewAction(item));
                button.addEventListener('focus', () => {
                    selectedIndex = index;
                    host.querySelectorAll('[data-radial-action]').forEach((entry, idx) => entry.classList.toggle('is-selected', idx === index));
                    previewAction(item);
                });
                button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); activate(item); });
                stage.appendChild(button);
            });

            if (pages() > 1) {
                const pager = createElement('div', 'vtt-radial-pager');
                const previous = createElement('button', 'vtt-radial-page-button', '‹');
                previous.type = 'button'; previous.setAttribute('aria-label', 'Página anterior');
                previous.addEventListener('click', (event) => { event.stopPropagation(); changePage(-1); });
                const label = createElement('span', 'vtt-radial-page-label', `${page + 1}/${pages()}`);
                const next = createElement('button', 'vtt-radial-page-button', '›');
                next.type = 'button'; next.setAttribute('aria-label', 'Página siguiente');
                next.addEventListener('click', (event) => { event.stopPropagation(); changePage(1); });
                pager.append(previous, label, next);
                stage.appendChild(pager);
            }

            host.appendChild(stage);
            host.hidden = false;
            requestAnimationFrame(() => host.classList.add('is-open'));
            const firstEnabled = actions.findIndex((entry) => entry.enabled);
            selectedIndex = firstEnabled >= 0 ? firstEnabled : 0;
            const buttons = Array.from(host.querySelectorAll('[data-radial-action]'));
            buttons[selectedIndex]?.classList.add('is-selected');
            previewAction(actions[selectedIndex] || null);
            bindKeyboard();
        }

        function open(nextModel = {}) {
            model = { ...nextModel, actions: Array.isArray(nextModel.actions) ? nextModel.actions : [] };
            page = 0;
            selectedIndex = 0;
            host.classList.remove('is-open');
            position(Number(nextModel.x) || browserRoot.innerWidth / 2, Number(nextModel.y) || browserRoot.innerHeight / 2);
            render();
        }

        function close(reason = 'close') {
            if (host.hidden) return;
            host.classList.remove('is-open', 'vtt-radial-denied');
            host.hidden = true;
            if (keyHandler) browserRoot.removeEventListener('keydown', keyHandler, true);
            keyHandler = null;
            if (typeof onClose === 'function') onClose(reason, model);
        }

        host.addEventListener('contextmenu', (event) => { event.preventDefault(); close('contextmenu'); });

        return Object.freeze({ open, close, changePage, isOpen: () => !host.hidden, currentModel: () => model });
    }

    return Object.freeze({ PAGE_SIZE, INNER_RADIUS, OUTER_RADIUS, createRadialMenu });
});
