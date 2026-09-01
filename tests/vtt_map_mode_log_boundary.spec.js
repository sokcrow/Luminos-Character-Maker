const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const instanceSource = fs.readFileSync(path.join(__dirname, '..', 'js/instance-control.js'), 'utf8');

function createClassList(initial = []) {
    const values = new Set(initial);
    return {
        add(...items) { items.forEach((item) => values.add(item)); },
        remove(...items) { items.forEach((item) => values.delete(item)); },
        toggle(item, force) {
            if (force === true) { values.add(item); return true; }
            if (force === false) { values.delete(item); return false; }
            if (values.has(item)) { values.delete(item); return false; }
            values.add(item); return true;
        },
        contains(item) { return values.has(item); },
    };
}

function createPlayerDocument() {
    const nodes = new Map();
    const theatre = {
        id: 'theatre-view-player',
        style: {},
        classList: createClassList(),
        setAttribute() {},
    };
    const logButton = {
        id: 'btn-toggle-theatre-log-player',
        disabled: false,
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = String(value); },
    };
    const inventoryButton = {
        id: 'btn-global-inventory',
        disabled: false,
        setAttribute() {},
    };
    const logContainer = {
        id: 'theatre-log-container',
        style: { display: 'flex' },
        classList: createClassList(['active']),
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = String(value); },
    };
    const phoneWrapper = {
        style: {},
        dataset: {},
        classList: createClassList(),
    };
    [theatre, logButton, inventoryButton, logContainer].forEach((node) => nodes.set(node.id, node));

    const body = {
        classList: createClassList(),
        appendChild(node) {
            node.parentNode = body;
            nodes.set(node.id, node);
            return node;
        },
        removeChild(node) {
            nodes.delete(node.id);
            node.parentNode = null;
            node.removed = true;
            return node;
        },
    };

    return {
        body,
        phoneWrapper,
        getElementById(id) { return nodes.get(id) || null; },
        querySelector(selector) { return selector === '.sheet-phone-wrapper' ? phoneWrapper : null; },
        createElement(tagName) {
            const attributes = new Map();
            return {
                tagName: String(tagName).toUpperCase(),
                style: {},
                dataset: {},
                classList: createClassList(),
                setAttribute(name, value) { attributes.set(name, String(value)); },
                removeAttribute(name) { attributes.delete(name); },
                addEventListener() {},
                remove() {
                    if (this.parentNode) this.parentNode.removeChild(this);
                    else this.removed = true;
                },
            };
        },
    };
}

function loadInstanceControl() {
    const context = { window: { setTimeout }, console, setTimeout };
    vm.runInNewContext(instanceSource, context, { filename: 'js/instance-control.js' });
    return context.window.LuminousInstanceControl;
}

function snapshot(value) {
    return {
        val: () => value,
        exists: () => value !== null && value !== undefined &&
            (typeof value !== 'object' || Object.keys(value).length > 0),
    };
}

function createMapQueueDb(message, instance = 'mapa') {
    const state = {
        'campaña/estado_mundo/instancia_activa': instance,
        'campaña/teatro/cola': message ? { message_1: { ...message } } : {},
    };
    const refs = [];

    const resolve = (refPath) => {
        if (Object.prototype.hasOwnProperty.call(state, refPath)) return state[refPath];
        if (refPath.startsWith('campaña/teatro/cola/')) {
            const key = refPath.slice('campaña/teatro/cola/'.length);
            return state['campaña/teatro/cola'][key];
        }
        return undefined;
    };

    const assign = (refPath, value) => {
        if (refPath.startsWith('campaña/teatro/cola/')) {
            const key = refPath.slice('campaña/teatro/cola/'.length);
            state['campaña/teatro/cola'][key] = value;
            return;
        }
        state[refPath] = value;
    };

    const db = {
        ref(refPath) {
            refs.push(refPath);
            return {
                once: async () => snapshot(resolve(refPath)),
                orderByChild() { return this; },
                limitToFirst() { return this; },
                transaction(update, done) {
                    const current = resolve(refPath);
                    const candidate = update(current ? { ...current } : current);
                    if (candidate === undefined) {
                        done(null, false, snapshot(current));
                        return;
                    }
                    assign(refPath, candidate);
                    done(null, true, snapshot(candidate));
                },
                update: async (changes) => assign(refPath, { ...(resolve(refPath) || {}), ...changes }),
                remove: async () => {
                    if (refPath.startsWith('campaña/teatro/cola/')) {
                        const key = refPath.slice('campaña/teatro/cola/'.length);
                        delete state['campaña/teatro/cola'][key];
                    } else {
                        delete state[refPath];
                    }
                },
                on() {},
                off() {},
            };
        },
    };

    return { db, refs, state };
}

test('Map Mode keeps player menus above the VTT and blocks only Theatre Log access', () => {
    const instanceControl = loadInstanceControl();
    const documentRef = createPlayerDocument();

    instanceControl.applyPlayerInstance('mapa', documentRef);

    const mapView = documentRef.getElementById('player-instance-map');
    const logButton = documentRef.getElementById('btn-toggle-theatre-log-player');
    const inventoryButton = documentRef.getElementById('btn-global-inventory');
    const logContainer = documentRef.getElementById('theatre-log-container');

    expect(mapView.style.zIndex).toBe('8000');
    expect(logButton.disabled).toBe(true);
    expect(logButton.attributes['aria-disabled']).toBe('true');
    expect(inventoryButton.disabled).toBe(false);
    expect(logContainer.style.display).toBe('none');
    expect(logContainer.classList.contains('active')).toBe(false);
    expect(documentRef.phoneWrapper.classList.contains('phone-hidden')).toBe(true);
    expect(documentRef.phoneWrapper.style.zIndex).toBe('10000');

    instanceControl.applyPlayerInstance('teatro', documentRef);
    expect(logButton.disabled).toBe(false);
    expect(logButton.attributes['aria-disabled']).toBe('false');
    expect(documentRef.phoneWrapper.style.zIndex).toBe('');
    expect(documentRef.phoneWrapper.classList.contains('phone-hidden')).toBe(false);
});

test('Map Mode publishes queued speech but never touches the Theatre Log', async () => {
    const instanceControl = loadInstanceControl();
    const { db, refs, state } = createMapQueueDb({ mensaje: 'NPC chatter', createdAt: 1 });
    const timers = [];
    const published = [];
    const theatre = {
        getPaths: () => ({ queue: 'campaña/teatro/cola', log: 'campaña/teatro/log' }),
        publishIntervention: async (messageId, payload) => {
            published.push({ messageId, payload });
            return { published: true, payload };
        },
    };

    const processor = instanceControl.createMapDialogueQueueProcessor({
        db,
        theatre,
        setTimer: (callback, delay) => timers.push({ callback, delay }),
    });

    expect(await processor.process()).toBe(true);
    expect(published).toHaveLength(1);
    expect(published[0].messageId).toBe('message_1');
    expect(timers).toHaveLength(1);
    expect(timers[0].delay).toBeGreaterThanOrEqual(3000);
    expect(refs).not.toContain('campaña/teatro/log');

    await timers[0].callback();
    expect(state['campaña/teatro/cola'].message_1).toBeUndefined();
    expect(refs).not.toContain('campaña/teatro/log');
});

test('Map dialogue processor does not consume or alter Theatre-mode messages', async () => {
    const instanceControl = loadInstanceControl();
    const { db, state } = createMapQueueDb({ mensaje: 'Theatre line', createdAt: 1 }, 'teatro');
    let published = false;
    const theatre = {
        getPaths: () => ({ queue: 'campaña/teatro/cola', log: 'campaña/teatro/log' }),
        publishIntervention: async () => { published = true; return { published: true }; },
    };
    const processor = instanceControl.createMapDialogueQueueProcessor({ db, theatre, setTimer: () => {} });

    expect(await processor.process()).toBe(false);
    expect(published).toBe(false);
    expect(state['campaña/teatro/cola'].message_1.mensaje).toBe('Theatre line');
});
