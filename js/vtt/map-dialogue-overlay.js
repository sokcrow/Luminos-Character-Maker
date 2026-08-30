const INSTANCE_PATH = 'campaña/estado_mundo/instancia_activa';
const DEFAULT_DIALOGUE_PATH = 'campaña/estado_mundo/dialogo_activo';
const MIN_VISIBLE_MS = 1200;

function hostWindow(root = window) {
    try {
        if (root.parent && root.parent !== root && root.parent.document) return root.parent;
    } catch (_) {}
    return root;
}

function hideOverlay(element, timerRef) {
    if (timerRef.value) {
        clearTimeout(timerRef.value);
        timerRef.value = null;
    }
    element.hidden = true;
    element.textContent = '';
}

function createOverlay(documentRef) {
    const element = documentRef.createElement('div');
    element.id = 'vtt-map-dialogue-overlay';
    element.hidden = true;
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    Object.assign(element.style, {
        position: 'fixed',
        left: '50%',
        bottom: '7vh',
        transform: 'translateX(-50%)',
        width: 'max-content',
        maxWidth: '72vw',
        padding: '8px 14px',
        border: '1px solid rgba(220, 220, 220, 0.35)',
        background: 'rgba(5, 5, 5, 0.78)',
        color: '#f1f1f1',
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 'clamp(13px, 1.35vw, 18px)',
        lineHeight: '1.35',
        textAlign: 'center',
        textShadow: '0 1px 3px #000',
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.45)',
        pointerEvents: 'none',
        zIndex: '7000',
        whiteSpace: 'pre-wrap',
    });
    documentRef.body.appendChild(element);
    return element;
}

export function start({ root = window } = {}) {
    if (root.LuminousVttMapDialogueOverlay?.active) return root.LuminousVttMapDialogueOverlay;

    const host = hostWindow(root);
    const firebase = host?.firebase || root?.firebase || null;
    const db = firebase?.database?.() || null;
    const documentRef = root.document;
    if (!db || !documentRef?.body) return null;

    const theatre = host?.LuminousTheatreState || null;
    const dialoguePath = theatre?.getPaths?.().dialogue || DEFAULT_DIALOGUE_PATH;
    const dialogueRef = db.ref(dialoguePath);
    const instanceRef = db.ref(INSTANCE_PATH);
    const element = createOverlay(documentRef);
    const timerRef = { value: null };
    let mapActive = false;
    let currentDialogue = null;

    const render = () => {
        const payload = currentDialogue || {};
        if (!mapActive || !payload.mensaje || payload.tipo_dialogo === 'pensamiento') {
            hideOverlay(element, timerRef);
            return;
        }

        const now = Date.now();
        const durationMs = Math.max(MIN_VISIBLE_MS, Number(payload.durationMs) || 3000);
        const startedAt = Number(payload.startedAt) || now;
        const remainingMs = Math.max(0, (startedAt + durationMs) - now);
        if (!remainingMs) {
            hideOverlay(element, timerRef);
            return;
        }

        const resolved = typeof theatre?.resolveLanguageText === 'function'
            ? theatre.resolveLanguageText(payload.mensaje, payload)
            : String(payload.mensaje || '');
        const text = String(resolved || '').trim();
        if (!text) {
            hideOverlay(element, timerRef);
            return;
        }

        if (timerRef.value) clearTimeout(timerRef.value);
        element.textContent = text;
        element.hidden = false;
        timerRef.value = setTimeout(() => hideOverlay(element, timerRef), remainingMs);
    };

    const onDialogue = (snapshot) => {
        currentDialogue = snapshot.val() || null;
        render();
    };
    const onInstance = (snapshot) => {
        mapActive = snapshot.val() === 'mapa';
        render();
    };

    dialogueRef.on('value', onDialogue);
    instanceRef.on('value', onInstance);

    const api = Object.freeze({
        active: true,
        stop() {
            dialogueRef.off?.('value', onDialogue);
            instanceRef.off?.('value', onInstance);
            hideOverlay(element, timerRef);
            element.remove?.();
            if (root.LuminousVttMapDialogueOverlay === api) delete root.LuminousVttMapDialogueOverlay;
        },
    });
    root.LuminousVttMapDialogueOverlay = api;
    return api;
}

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => start(), { once: true });
    } else {
        start();
    }
}
