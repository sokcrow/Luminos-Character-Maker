(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.LuminousVttDmEditMode = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
    'use strict';

    function createController({ isDm = false, mapData, topologyController, verticalPortalController, root = browserRoot } = {}) {
        if (!mapData) throw new Error('MAP_DATA_REQUIRED');
        mapData.dmEditMode ||= { active: false };
        mapData.dmEditMode.active = Boolean(isDm && mapData.dmEditMode.active);

        const button = root?.document?.getElementById?.('vtt-dm-edit-toggle') || null;

        function apply() {
            const active = Boolean(isDm && mapData.dmEditMode.active);
            root?.document?.body?.classList?.toggle('vtt-dm-edit-active', active);
            root?.document?.body?.classList?.toggle('vtt-dm-edit-available', Boolean(isDm));
            if (button) {
                button.hidden = !isDm;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-pressed', active ? 'true' : 'false');
                button.textContent = active ? 'EDIT MODE · ON' : 'EDIT MODE';
            }
            topologyController?.renderMode?.();
            verticalPortalController?.renderMode?.();
            if (!active) {
                topologyController?.setTool?.('select');
                verticalPortalController?.setTool?.('select', false);
            }
            return active;
        }

        function setActive(value) {
            mapData.dmEditMode.active = Boolean(isDm && value);
            return apply();
        }

        function toggle() {
            return setActive(!mapData.dmEditMode.active);
        }

        const clickHandler = () => toggle();
        button?.addEventListener?.('click', clickHandler);
        apply();

        function stop() {
            button?.removeEventListener?.('click', clickHandler);
        }

        return Object.freeze({
            isDm: Boolean(isDm),
            isActive: () => Boolean(isDm && mapData.dmEditMode.active),
            setActive,
            toggle,
            apply,
            stop,
        });
    }

    return Object.freeze({ createController });
});
