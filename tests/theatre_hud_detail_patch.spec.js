const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const engine = read("js/theatre-engine.js");
const controls = read("js/theatre-controls.js");
const dashboard = read("js/on-game-dashboard.js");
const playerHtml = read("hoja_personaje.html");
const playerJs = read("hoja_personaje.js");
const dialogueCss = read("css/theatre-dialogue.css");
const hudCss = read("css/theatre-hud.css");

function block(source, start, end) {
  const from = source.indexOf(start);
  const to = end ? source.indexOf(end, from) : source.length;
  expect(from).toBeGreaterThanOrEqual(0);
  return source.slice(from, to < 0 ? source.length : to);
}

test("patch: fallback de placas es gris #4a4a4a", () => {
  expect(engine).toContain('getSafeCssColor(value, "#4a4a4a")');
  expect(dialogueCss).toContain("#4a4a4a 0%, #4a4a4a 68%");
  expect(engine).not.toContain('getSafeCssColor(value, "#aaaaaa")');
});

test("patch: el texto de las placas siempre es blanco", () => {
  expect(engine).toContain('element.style.setProperty("color", "#ffffff", "important")');
  expect(dialogueCss).toMatch(/\.theatre-plate-title\s*\{[\s\S]*?color:\s*#ffffff;/);
  expect(dialogueCss).toMatch(/\.theatre-plate-name\s*\{[\s\S]*?color:\s*#ffffff;/);
});

test("patch: color personalizado se aplica al fondo y borde, no al texto", () => {
  expect(engine).toContain('`linear-gradient(90deg, ${plateColor} 0%, ${plateColor} 68%, #17110b 100%)`');
  expect(engine).toContain('element.style.setProperty("border-left-color", plateColor, "important")');
  expect(engine).not.toMatch(/style\.color\s*=\s*dialogData\.color_(?:nombre|titulo)/);
});

test("patch: narrador nunca muestra identidad", () => {
  expect(engine).toContain('if (!actorId || type === "narracion" || type === "pensamiento" || dialogData.mostrar_identidad === false)');
  expect(dashboard).toContain('type = "narracion";');
  expect(dashboard).toContain('mostrar_identidad: actorDialogue');
});

test("patch: pensamiento nunca muestra identidad", () => {
  expect(engine).toContain('if (!actorId || type === "narracion" || type === "pensamiento" || dialogData.mostrar_identidad === false)');
  expect(dashboard).toContain('mostrar_identidad: actorDialogue');
  expect(playerJs).toContain('const mostrarIdentidad = tipoDialogo !== "pensamiento";');
});

test("patch: pensamiento no publica expresión ni sprite", () => {
  expect(dashboard).toContain('expression: actorDialogue ? speaker.expression : null');
  expect(dashboard).toContain('sprite: actorDialogue ? speaker.sprite : null');
  expect(engine).toContain('type !== "pensamiento" && type !== "narracion"');
});

test("patch: catalogar un actor no lo hace visible ni selecciona expresión", () => {
  const spawn = block(controls, "function spawnSelectedActor", "function renderLiveActors");
  expect(spawn).toContain('db.ref(`${paths().scene}/actores/${actorInstanceId}`).set(actorPayload)');
  expect(spawn).not.toContain("updateVisibleActors(actorInstanceId");
  expect(spawn).not.toContain("expresionActiva:");
  expect(spawn).not.toContain("expresionPreparada:");
});

test("patch: máximo visible continúa limitado a cinco", () => {
  expect(engine).toContain("const DEFAULT_MAX_VISIBLE = 5");
  expect(engine).toContain("Math.max(1, Math.min(DEFAULT_MAX_VISIBLE, parsed))");
  expect(engine).toContain("while (visibles.length > maxVisible) visibles.shift();");
});

test("patch: el sexto actor nuevo reemplaza al primero sin reordenar hablantes existentes", () => {
  const visible = block(engine, "async function updateVisibleActors", "async function removeVisibleActor");
  expect(visible).toContain("if (visibles.includes(actorId)) return visibles;");
  expect(visible).toContain("visibles.push(actorId);");
  expect(visible).toContain("visibles.shift()");
  expect(visible).not.toContain("visibles.splice");
});

test("patch: sprite inválido no entra en visibles ni se revela", () => {
  expect(engine).toContain("function getValidSpriteUrl");
  expect(engine).toContain('if (!getValidSpriteUrl(actorData?.sprite || actorData?.url)) return false;');
  expect(engine).toContain("if (!validSprite) return false;");
});

test("patch: log prioriza icono universal y nunca usa sprite", () => {
  const log = block(playerJs, "function resolveTheatreLogIcon", "// === ENVÍO AL TEATRO");
  expect(log).toContain("return msg.icono || cachedIcon || fallbackIcon;");
  expect(log).toContain("actorById");
  expect(log).toContain("actorByName");
  expect(log).not.toContain("msg.sprite");
  expect(engine).toContain("function buildTheatreInitialsIcon(name)");
});

test("patch: log sustituye el placeholder externo por iniciales locales", () => {
  expect(engine).toContain("data:image/svg+xml");
  expect(engine).toContain('src.includes("via.placeholder.com")');
  expect(engine).toContain('img.addEventListener("error", fallback, { once: true })');
});

test("patch: selector de personaje se oculta con cero o uno", () => {
  expect(engine).toContain('actorSelect.id = "player-actor-select"');
  expect(playerJs).toContain('if (validCount <= 1)');
  expect(playerJs).toContain('selectActor.style.display = "none"');
});

test("patch: selector de personaje se muestra con varios", () => {
  expect(playerJs).toContain('selectActor.style.display = "block"');
  expect(playerHtml).not.toContain('>Mi personaje</option>');
});

test("patch: resizeFontToFit puede reducir font-size y CSS no lo bloquea", () => {
  expect(engine).toContain('textEl.style.fontSize = `${size}px`;');
  const dialogueRule = block(hudCss, "#theatre-view-player .theatre-dialogue-text,", "#theatre-view-player .theatre-dialogue-text::before");
  expect(dialogueRule).not.toMatch(/font-size:[^;]*!important/);
});

test("patch: no se agrega un segundo listener de envío", () => {
  const send = block(playerJs, "// === ENVÍO AL TEATRO", "  window.getAssignedTheatreActor = function() {");
  expect((send.match(/addEventListener\("click", sendTheatreMessage\)/g) || [])).toHaveLength(1);
  const compatibilityHook = block(engine, "function installPlayerComposerCompatibility", "function patchTheatreLogPortrait");
  expect(compatibilityHook).not.toContain('addEventListener("click"');
  expect(compatibilityHook).not.toContain("sendTheatreMessage");
});

test("patch: Tienda y Forja permanecen presentes", () => {
  expect(playerHtml).toContain('id="shop-modal"');
  expect(playerHtml).toContain('id="btn-shop-notifier"');
  expect(playerHtml).toContain('id="forja-selection-modal"');
  expect(playerHtml).toContain('id="forja-roll-modal"');
});

test("patch: compositor conserva actor, tipo y expresión reales", () => {
  expect(engine).toContain('actorSelect.id = "player-actor-select"');
  expect(engine).toContain('typeSelect.id = "player-tipo-dialogo-select"');
  expect(playerHtml).toContain('id="player-expression"');
  expect(playerJs).toContain("opt.dataset.sprite = spriteUrl;");
  expect(playerJs).toContain("const assignedActor = window.getAssignedTheatreActor();");
});

test("patch: geometría 16:9 conserva diálogo inferior y cinco sprites dentro del ancho", () => {
  expect(dialogueCss).toContain("left: 4vw;");
  expect(dialogueCss).toContain("right: 4vw;");
  expect(dialogueCss).toContain("bottom: 24px;");
  expect(dialogueCss).toContain("height: clamp(150px, 21vh, 205px);");
  expect(hudCss).toContain("flex: 0 1 20%;");
  expect(hudCss).toContain("max-width: 20%;");
  const spriteRule = block(hudCss, "#theatre-view-player > #theatre-stage > .theatre-sprite,", "/* Compatibilidad");
  expect(spriteRule).not.toContain("aspect-ratio: 16 / 9");
});

test("patch: menú hamburguesa reutiliza herramientas existentes sin duplicarlas", () => {
  const menuIdCount = (playerHtml.match(/id="hud-menu-dropdown"/g) || []).length;
  const toggleIdCount = (playerHtml.match(/id="btn-toggle-hud-menu"/g) || []).length;
  expect(menuIdCount).toBe(1);
  expect(toggleIdCount).toBe(1);
  expect(playerJs).toContain('const btnMenu = e.target.closest("#btn-toggle-hud-menu")');
  expect(playerJs).toContain('sidebar.classList.toggle("is-open")');
  const hamburgerBlock = block(playerJs, "// --- LÓGICA DEL TOGGLE DEL MENÚ HAMBURGUESA DERECHO ---", "// --- LÓGICA DEL TOGGLE DEL HUD DE COMBATE");
  expect(hamburgerBlock).not.toContain("cloneNode");
  expect(hamburgerBlock).not.toContain("appendChild");
});

test("patch: tipografías del Teatro usan BebasKai y Roboto con los fallbacks requeridos", () => {
  expect(hudCss).toContain('font-family: "BebasKai", Impact, "Arial Narrow", sans-serif !important;');
  expect(hudCss).toContain('font-family: "Roboto", Arial, sans-serif !important;');
  expect(dialogueCss).not.toContain('"Bebas Kai"');
  expect(playerHtml).not.toContain("'Bebas Kai'");
});

test("patch: compositor permanece centrado sobre el HUD y no ocupa el panel completo", () => {
  expect(playerHtml).toContain('id="modal-escritura-teatro" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); z-index: 9999; justify-content: center; align-items: center;"');
  expect(playerHtml).toContain("max-width: 500px");
  expect(hudCss).toContain("#modal-escritura-teatro textarea");
});

test("patch: compositor del DM conserva narración, diálogo y pensamiento", () => {
  const dmHtml = read("hoja_de_DM.html");
  expect(dmHtml).toContain('id="dm-tipo-dialogo-select"');
  expect(dmHtml).toContain('<option value="dialogo">Diálogo</option>');
  expect(dmHtml).toContain('<option value="narracion">Narración</option>');
  expect(dmHtml).toContain('<option value="pensamiento">Pensamiento</option>');
  expect(dashboard).toContain('if (!speakerSelect || speakerSelect.value === "narrador")');
  expect(dashboard).toContain('type = "narracion";');
});
