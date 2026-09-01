const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const engine = read("js/theatre-engine.js");
const controls = read("js/theatre-controls.js");
const dashboard = read("js/on-game-dashboard.js");
const dmHtml = read("hoja_de_DM.html");

// These regression tests intentionally assert the architectural contract of #511.
test("#511: Firebase is authoritative and the stage never invents visible actors", () => {
  expect(engine).toContain("sceneRef.on(\"value\", sceneListener)");
  expect(engine).toContain("dialogueRef.on(\"value\", dialogueListener)");
  expect(engine).toContain("an empty/missing visible list means an empty stage");
  expect(engine).toContain("normalizeIdList(scene?.actores_visibles)");
  expect(engine).not.toContain("validActors.slice(0, 5)");
});

test("#511: actor pool and visible FIFO are separate; existing speakers never move", () => {
  expect(engine).toContain("if (visibles.includes(actorId)) return visibles;");
  expect(engine).toContain("visibles.push(actorId);");
  expect(engine).toContain("while (visibles.length > maxVisible) visibles.shift();");
  expect(engine).not.toContain("visibles.splice(index, 1)");
  expect(controls).toContain("Pool and HUD are separate");
  expect(controls).not.toContain("delete actors[oldestKey]");
  expect(controls).toContain("btn-hide");
});

test("#511: visible maximum is DM-configurable from 1 through 5", () => {
  expect(engine).toContain("Math.max(1, Math.min(DEFAULT_MAX_VISIBLE, parsed))");
  expect(controls).toContain('id="theatre-max-visible"');
  for (const value of [1, 2, 3, 4, 5]) expect(controls).toContain(`<option value="${value}">${value}</option>`);
});

test("#511: selected expressions remain prepared until the intervention is published", () => {
  expect(engine).toContain("expresionPreparada");
  expect(engine).toContain("async function revealPreparedExpression");
  expect(engine).toContain("await revealPreparedExpression(message.actorId, message.expression, message.sprite)");
  expect(controls).toContain("Preparing never changes expresionActiva/sprite");
  expect(dashboard).toContain("Selection only prepares; reveal happens when the queue publishes the intervention");
  expect(dashboard).not.toContain("expresionActiva: speakerData.expression");
});

test("#511: dialogue and focus are current Firebase state suitable for late joiners", () => {
  expect(engine).toContain("[paths.dialogue]: activePayload");
  expect(engine).toContain("`${paths.scene}/active_actor`");
  expect(engine).toContain("`${paths.scene}/focus_mode`");
  expect(engine).toContain("Persistent by contract: completion never clears the active dialogue");
});

test("#511: narration/thought dim sprites, narration hides plates, and /em is an active actor action", () => {
  expect(engine).toContain("if (isThought || isNarrator)");
  expect(engine).toContain('img.style.filter = "brightness(0.4)"');
  expect(engine).toContain('type === "narracion"');
  expect(engine).toContain('/^\\/em(?:\\s+|$)/i');
  expect(engine).toContain("return `(${actorLabel} ${transformed})`");
  expect(engine).toContain('type !== "pensamiento" && type !== "narracion"');
});

test("#511: No Actors and own-sprite hiding are render-only preferences", () => {
  expect(engine).toContain('scene?.modo_presentacion === "no-actors"');
  expect(controls).toContain('id="theatre-no-actors"');
  expect(engine).toContain('const LOCAL_SHOW_SELF_KEY = "luminous.theatre.showOwnActor"');
  expect(engine).toContain("global.localStorage?.setItem");
  expect(engine).toContain('label.id = "theatre-self-visibility-control"');
  expect(engine).toContain("getSelfVisibilityStorageKey(viewerKey, actorId)");
  expect(engine).toContain("!isOwnActorIdentity(actorId) || shouldShowOwnActor(actorId)");
});

test("#511: identity knowledge is per viewer and temporary nameplate presentation is separate", () => {
  expect(engine).toContain('const IDENTITY_KNOWLEDGE_ROOT = "campaña/teatro/conocimiento_identidad"');
  expect(engine).toContain('name: override.nombre ?? override.name ?? (known ? realName : "???")');
  expect(engine).toContain('title: override.titulo ?? override.title ?? (known ? realTitle : "???")');
  expect(engine).toContain("async function setIdentityKnown");
  expect(engine).toContain("async function setNameplateOverride");
  expect(controls).toContain("btn-reveal-identity");
  expect(controls).toContain("btn-override-nameplate");
  expect(engine).not.toMatch(/mensaje.*includes\(.*nombre/i);
});

test("#511: legacy prototype nameplate nodes are explicitly removed", () => {
  expect(engine).toContain("function removeLegacyPrototypePanels");
  expect(engine).toContain(".theatre-nameplate-prototype");
  expect(engine).toContain("[data-theatre-prototype]");
  expect(dmHtml).toContain('class="theatre-plates-container"');
});

test("#511: clear scene only clears current visual state", () => {
  const clearStart = engine.indexOf("async function clearScene()");
  const clearEnd = engine.indexOf("function wait", clearStart);
  const clearBody = engine.slice(clearStart, clearEnd);
  expect(clearBody).toContain("actores_visibles");
  expect(clearBody).toContain("nameplate_overrides");
  expect(clearBody).toContain("active_actor");
  expect(clearBody).toContain("paths.dialogue");
  expect(clearBody).not.toContain("/actores`");
  expect(clearBody).not.toContain("fondo:");
  expect(clearBody).not.toContain("locacion:");
});

test("#511: scene changes are fade cuts and messages from the cut are discarded", () => {
  expect(engine).toContain('transition_phase: "out"');
  expect(engine).toContain('transition_phase: "in"');
  expect(engine).toContain("scene_cut_at");
  expect(engine).toContain("await db.ref(paths.queue).remove()");
  expect(dashboard).toContain("freshScene.transitioning || theatre.messageIsStaleForScene(claimed, freshScene)");
  expect(dashboard).toContain("dropQueueForTransition");
  expect(dashboard).toContain("theatre.changeScene");
});

test("#511: place library has grouping metadata and enters Theatre through changeScene", () => {
  expect(dashboard).toContain('id = "theatre-scenario-region"');
  expect(dashboard).toContain('id = "theatre-scenario-category"');
  expect(dashboard).toContain("data.region || data.seccion || data.capitulo || data.locacion");
  expect(dashboard).toContain("await theatre.changeScene");
});

test("#511: partial languages are deterministic, monotonic and consume character percentages only", () => {
  expect(engine).toContain("function deterministicVocabularyKnown");
  expect(engine).toContain("stableHash(key) % 100000 < Math.round(knowledge * 1000)");
  expect(engine).toContain("extractLanguageKnowledge");
  expect(engine).toContain("return clampPercentage(value)");
  expect(engine).toContain('return "[...]"');
  expect(engine).toContain("(Está hablando una lengua que no entiendes)");
  expect(engine).not.toMatch(/idiomas.*\.set\(/);
  expect(engine).not.toMatch(/languages.*\.set\(/);
});

test("#511: Distortion Languages bypass percentage learning and can replace the full message", () => {
  expect(engine).toContain("function isDistortionDefinition");
  expect(engine).toContain("function understandsDistortion");
  expect(engine).toContain("if (understandsDistortion(profile, languageId)) return text;");
  expect(engine).toContain('"Tik... Tok..."');
});

test("#511: room-scoped paths allow future independent Theatre instances", () => {
  expect(engine).toContain("function resolveRoomPaths(roomId)");
  expect(engine).toContain("campaña/teatro/salas/${normalized}");
  expect(engine).toContain("function setRoom(roomId)");
  expect(controls).toContain("LuminousTheatreState?.getPaths");
  expect(dashboard).toContain("const paths = () => theatre.getPaths()");
});
