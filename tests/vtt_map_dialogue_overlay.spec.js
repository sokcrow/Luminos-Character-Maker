const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const mainSource = read('js/vtt/main.js');
const overlaySource = read('js/vtt/map-dialogue-overlay.js');

test('VTT loads the transient Map Mode dialogue overlay', () => {
    expect(mainSource).toContain("import './map-dialogue-overlay.js';");
    expect(mainSource).toContain('window.LuminousVttMapDialogueOverlay?.stop?.()');
});

test('Map dialogue overlay reads active dialogue without touching Theatre Log', () => {
    expect(overlaySource).toContain("campaña/estado_mundo/instancia_activa");
    expect(overlaySource).toContain("campaña/estado_mundo/dialogo_activo");
    expect(overlaySource).toContain('resolveLanguageText');
    expect(overlaySource).toContain("payload.tipo_dialogo === 'pensamiento'");
    expect(overlaySource).not.toContain('campaña/teatro/log');
    expect(overlaySource).not.toContain('.push(');
});
