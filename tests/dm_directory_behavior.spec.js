const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Comportamiento de Sincronización del Directorio DM', () => {
  test.beforeEach(async ({ page }) => {
    // Bloquear los scripts reales de firebase para inyectar nuestro mock
    await page.route('**/*firebase*.js', route => route.fulfill({ body: '' }));

    await page.addInitScript(() => {
      // Fixture
      const fixtureJugadores = {};
      for (let i = 1; i <= 8; i++) {
          fixtureJugadores[`jugador${i}`] = { characterName: `Jugador ${i}`, online: true };
      }
      // Enlazar al menos uno
      fixtureJugadores['jugador1'].actorId = 'actor_jugador1';

      const fixtureActores = {};
      // 8 de tipo Jugador en la ruta heredada
      for (let i = 1; i <= 8; i++) {
          fixtureActores[`actor_jugador${i}`] = { nombre: `Actor Jugador ${i}`, tipo: 'Jugador', vinculo_jugador: `jugador${i}` };
      }
      // 10 de otro tipo (NPCs) en la ruta heredada
      for (let i = 1; i <= 10; i++) {
          fixtureActores[`npc_${i}`] = { nombre: `NPC Antiguo ${i}`, tipo: 'Enemigo' };
      }

      // Añadir colisión en la ruta moderna
      const fixtureNpcs = {
          'npc_1': { nombre: 'NPC Moderno 1', tipo: 'Aliado' } // Colisiona con npc_1 de actores
      };

      window.mockFirebaseData = {
          'jugadores': fixtureJugadores,
          'actores': fixtureActores,
          'base_datos_npcs': fixtureNpcs
      };

      window.mockListeners = {};

      window.firebase = {
          initializeApp: () => {},
          auth: () => ({
              onAuthStateChanged: (cb) => cb({ uid: 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1' }),
              setPersistence: () => Promise.resolve()
          }),
          database: () => ({
              ServerValue: { TIMESTAMP: Date.now() },
              ref: (dbPath) => {
                  const cleanPath = dbPath.replace('campaña/', '');
                  return {
                      on: (event, cb, errCb) => {
                          if (event === 'value' && window.mockFirebaseData[cleanPath] !== undefined) {
                              window.mockListeners[dbPath] = { cb, errCb };
                              // Emitir snapshot inicial simulado
                              cb({ val: () => window.mockFirebaseData[cleanPath] });
                          }
                      },
                      once: async (event, cb) => {
                          if (cb) cb({ val: () => null });
                          return { val: () => null };
                      },
                      update: async () => {},
                      set: async () => {},
                      remove: async () => {},
                      push: () => ({ key: 'mock_key', set: async () => {} })
                  };
              }
          })
      };
    });

    const uri = `file://${path.resolve(__dirname, '..', 'pantalla_dm.html')}`;
    await page.goto(uri);
    await page.waitForTimeout(500); // Esperar procesamiento DOM inicial
  });

  test('Renderiza correctamente 8 jugadores y clasifica NPCs vs Jugadores', async ({ page }) => {
    // 8 cards en grid-personajes-jugadores
    const playerCards = await page.locator('#grid-personajes-jugadores .cyber-card').count();
    expect(playerCards).toBe(8);

    // 10 NPCs heredados (-1 por el overriden + 1 moderno = 10 únicos)
    const npcCards = await page.locator('#grid-actores .character-card').count();
    expect(npcCards).toBe(10);

    // Validar colisión y prioridad: La versión moderna debe sobreescribir a la antigua
    const firstNpcText = await page.locator('#grid-actores .character-card').nth(0).innerText();
    expect(firstNpcText).toContain('NPC Moderno 1');
    expect(firstNpcText).not.toContain('NPC Antiguo 1');
  });

  test('Emite un nuevo snapshot y el directorio vuelve a renderizarse sin recargar', async ({ page }) => {
    // Enviar un nuevo snapshot con 1 NPC extra
    await page.evaluate(() => {
        window.mockFirebaseData['base_datos_npcs']['npc_nuevo'] = { nombre: 'NPC Totalmente Nuevo', tipo: 'Aliado' };
        window.mockListeners['campaña/base_datos_npcs'].cb({ val: () => window.mockFirebaseData['base_datos_npcs'] });
    });

    await page.waitForTimeout(200);

    const npcCards = await page.locator('#grid-actores .character-card').count();
    expect(npcCards).toBe(11); // 10 originales + 1 nuevo
    const textContent = await page.locator('#grid-actores').innerText();
    expect(textContent).toContain('NPC Totalmente Nuevo');
  });

  test('Maneja base_datos_npcs nula y conserva los actores de la ruta heredada', async ({ page }) => {
    // Emitir null en base_datos_npcs
    await page.evaluate(() => {
        window.mockListeners['campaña/base_datos_npcs'].cb({ val: () => null });
    });

    await page.waitForTimeout(200);

    // Al ser nula, la caché moderna se limpia, pero la de actores (heredada) retiene sus 10 NPCs.
    // La colisión se resuelve a favor del legado.
    const npcCards = await page.locator('#grid-actores .character-card').count();
    expect(npcCards).toBe(10);

    const firstNpcText = await page.locator('#grid-actores .character-card').nth(0).innerText();
    expect(firstNpcText).toContain('NPC Antiguo 1');
  });

  test('Callback de error muestra mensaje sin destruir los datos ya renderizados', async ({ page }) => {
    // Emitir un error
    await page.evaluate(() => {
        window.mockListeners['campaña/base_datos_npcs'].errCb({ message: 'Permission Denied' });
    });

    await page.waitForTimeout(200);

    // Los datos preexistentes permanecen (10 NPCs renderizados)
    const npcCards = await page.locator('#grid-actores .character-card').count();
    expect(npcCards).toBe(10);

    // El mensaje de error aparece inyectado
    const errorDivs = await page.locator('div', { hasText: 'Error de conexión con Firebase' }).count();
    expect(errorDivs).toBeGreaterThan(0);
  });
});
