const { test, expect } = require('@playwright/test');
const fs = require('fs');
const pt = require('path');
const vm = require('vm');

test('el jugador solo utiliza su actor asignado y envía payload correcto', async () => {
    const html = fs.readFileSync(pt.join(__dirname, '..', 'hoja_personaje.html'), 'utf-8');
    const js = fs.readFileSync(pt.join(__dirname, '..', 'hoja_personaje.js'), 'utf-8');
    const engine = fs.readFileSync(pt.join(__dirname, '..', 'js', 'theatre-engine.js'), 'utf-8');

    expect(html).not.toMatch(/player-theatre-input/);
    expect(html).not.toMatch(/btn-player-theatre-send/);

    expect(js).toContain('resolveTheatreLogIcon');

    // Assure that sprite is ignored by regex rules required.
    const illegalLogSprite = /msg\.sprite|entry\.sprite|actorSprite/;

    // We check only the renderizarLog functionality block roughly.
    const renderBlock = js.substring(js.indexOf('const renderizarLog'), js.indexOf('db.ref("campaña/teatro/log")'));
    expect(renderBlock).not.toMatch(illegalLogSprite);
});

test('applyPlayerInstance(teatro) agrega player-instance-theatre sin UI tracker real', async () => {
    const js = fs.readFileSync(pt.join(__dirname, '..', 'js', 'instance-control.js'), 'utf-8');

    // Configurar JSDOM / context para ejecutar applyPlayerInstance
    const context = vm.createContext({
      window: {
        location: { pathname: '/hoja_personaje.html' },
        addEventListener: () => {}
      },
      document: {
        body: {
          classList: {
            classes: new Set(),
            toggle: function(cls, force) {
              if (force) this.classes.add(cls);
              else this.classes.delete(cls);
            },
            add: function(cls) { this.classes.add(cls); },
            remove: function(cls) { this.classes.delete(cls); },
            contains: function(cls) { return this.classes.has(cls); }
          }
        },
        getElementById: () => ({ classList: { toggle: () => {}, add: () => {}, remove: () => {} }, style: {}, setAttribute: () => {} }),
        querySelectorAll: () => []
      },
      console: console,
      db: { ref: () => ({ once: () => Promise.resolve({ val: () => null }) }) },
      campanaId: 'test-camp'
    });

    context.globalThis = context;
    context.window = context;

    vm.runInContext(js, context);

    // Execute explicitly
    vm.runInContext("LuminousInstanceControl.applyPlayerInstance('teatro', document);", context);
    expect(context.document.body.classList.contains('player-instance-theatre')).toBe(true);

    vm.runInContext("LuminousInstanceControl.applyPlayerInstance('ninguno', document);", context);
    expect(context.document.body.classList.contains('player-instance-theatre')).toBe(false);
});

test('el modal de jugador incluye readonly nodes', async () => {
    const html = fs.readFileSync(pt.join(__dirname, '..', 'hoja_personaje.html'), 'utf-8');
    const css = fs.readFileSync(pt.join(__dirname, '..', 'css', 'theatre-hud.css'), 'utf-8');

    expect(html).toContain('id="theatre-modal-readonly-icon"');
    expect(html).toContain('id="theatre-modal-readonly-name"');
    expect(html).toContain('id="theatre-modal-readonly-title"');
    expect(html).toContain('BebasKai');
    expect(css).toContain('font-family: "Roboto", Arial, sans-serif !important;');
});

test('los SVG de Actuar e Historial usan currentColor y las clases mantienen is-active', async () => {
    const html = fs.readFileSync(pt.join(__dirname, '..', 'hoja_personaje.html'), 'utf-8');
    const js = fs.readFileSync(pt.join(__dirname, '..', 'hoja_personaje.js'), 'utf-8');
    const css = fs.readFileSync(pt.join(__dirname, '..', 'css', 'theatre-hud.css'), 'utf-8');

    // Button definition SVG
    expect(html).toContain('stroke="currentColor"');
    // JS Logic
    expect(html).toContain('logToggleBtnPlayer.classList.toggle("is-active", isOpen);');
    // CSS layout overrides exist
    expect(css).toMatch(/body\.player-instance-theatre\s+#hud-menu-dropdown\s+\.hud-menu-item--theatre/s);
    expect(css).toContain('width: 24px !important;');
});

test('payload conserva icono y createdAt sin cruzar datos y rechaza envios sin actor', async () => {
    const js = fs.readFileSync(pt.join(__dirname, '..', 'hoja_personaje.js'), 'utf-8');

    // Icon Logic
    expect(js).toContain('icono_jugador: actorAssigned.icono_jugador || null');
    // Creation timestamp fix
    expect(js).toContain('createdAt: firebase.database.ServerValue.TIMESTAMP');
    // Null safety rejection
    expect(js).toContain('No hay actor asignado al jugador. No se puede enviar el mensaje');
    // Icon resolution priority check
    expect(js).toContain('finalIcon = actorParaEnviar.icono || actorParaEnviar.icono_jugador || window.datosJugador?.icono_jugador || window.datosJugador?.icono || null;');
});
