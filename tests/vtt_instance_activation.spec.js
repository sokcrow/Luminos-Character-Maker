const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const dashboardHtml = read('hoja_de_DM.html');
const instanceSource = read('js/instance-control.js');
const dashboardCss = read('css/on-game-dashboard.css');

test('DM game controls expose the tactical map as a canonical instance', () => {
    expect(dashboardHtml).toContain('name="instancia" value="mapa"');
    expect(dashboardHtml).toContain('id="modulo-mapa"');
    expect(dashboardHtml).toContain('<iframe src="vtt.html" title="Mapa táctico D&amp;D"></iframe>');
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

test('map module owns the available dashboard viewport', () => {
    expect(dashboardCss).toContain('#modulo-mapa { flex-direction: column; }');
    expect(dashboardCss).toContain('#modulo-mapa iframe { width: 100%; height: 100%; border: 0; background: #000; }');
});
