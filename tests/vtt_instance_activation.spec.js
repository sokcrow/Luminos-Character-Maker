const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const dashboardHtml = read('hoja_de_DM.html');
const instanceSource = read('js/instance-control.js');
const dashboardCss = read('css/on-game-dashboard.css');

function fakeClassList() {
    return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
}

function createPlayerDocument() {
    const nodes = new Map();
    const theatre = {
        id: 'theatre-view-player',
        style: {},
        classList: fakeClassList(),
        setAttribute() {},
    };
    nodes.set(theatre.id, theatre);

    const body = {
        classList: fakeClassList(),
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
        getElementById(id) { return nodes.get(id) || null; },
        createElement(tagName) {
            const attributes = new Map();
            return {
                tagName: String(tagName).toUpperCase(),
                style: {},
                dataset: {},
                classList: fakeClassList(),
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
    const context = { window: {}, console };
    vm.runInNewContext(instanceSource, context, { filename: 'js/instance-control.js' });
    return context.window.LuminousInstanceControl;
}

test('DM game controls expose the tactical map as a canonical instance', () => {
    expect(dashboardHtml).toContain('name="instancia" value="mapa"');
    expect(dashboardHtml).toContain('id="modulo-mapa"');
    expect(dashboardHtml).toContain('<iframe data-vtt-src="vtt.html" title="Mapa táctico D&amp;D"></iframe>');
    expect(dashboardHtml).toContain('js/vtt/dm-map-lazy-loader.js');
    expect(instanceSource).toContain('activeInstance === "mapa"');
    expect(instanceSource).toContain('activeModuleId = "modulo-mapa"');
    expect(instanceSource).toContain('SALIDA ACTUAL: MAPA TÁCTICO');
});

test('player instance routing opens the same VTT when the DM activates mapa', () => {
    expect(instanceSource).toContain('const mapActive = activeInstance === "mapa"');
    expect(instanceSource).toContain('mapView.id = "player-instance-map"');
    expect(instanceSource).toContain('mapView.src = "vtt.html"');
    expect(instanceSource).toContain('mapView.style.display = mapActive ? "block" : "none"');
    expect(instanceSource).toContain('documentRef.body.classList.toggle("player-instance-map", mapActive)');
});

test('player map runtime is destroyed on MAPA -> TEATRO and recreated on return', () => {
    const instanceControl = loadInstanceControl();
    const documentRef = createPlayerDocument();

    instanceControl.applyPlayerInstance('mapa', documentRef);
    const firstMap = documentRef.getElementById('player-instance-map');
    expect(firstMap).not.toBeNull();
    expect(firstMap.src).toBe('vtt.html');

    instanceControl.applyPlayerInstance('teatro', documentRef);
    expect(firstMap.removed).toBe(true);
    expect(documentRef.getElementById('player-instance-map')).toBeNull();
    expect(documentRef.getElementById('theatre-view-player').style.display).toBe('flex');

    instanceControl.applyPlayerInstance('mapa', documentRef);
    const secondMap = documentRef.getElementById('player-instance-map');
    expect(secondMap).not.toBeNull();
    expect(secondMap).not.toBe(firstMap);
    expect(secondMap.src).toBe('vtt.html');
});

test('map module owns the available dashboard viewport', () => {
    expect(dashboardCss).toContain('#modulo-mapa { flex-direction: column; }');
    expect(dashboardCss).toContain('#modulo-mapa iframe { width: 100%; height: 100%; border: 0; background: #000; }');
});
