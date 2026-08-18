(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const auth = window.firebase.auth();
    const db = window.firebase.database();

    auth.onAuthStateChanged((user) => {
      const authBlocker = document.getElementById("auth-blocker");
      if (!user) {
        if (authBlocker) authBlocker.style.display = "flex";
        return;
      }

      db.ref("campaña/config/dm_uid").once("value").then((snapshot) => {
        const expectedUid = snapshot.val() || "e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1";
        if (user.uid !== expectedUid) {
          if (authBlocker) authBlocker.style.display = "flex";
          return;
        }
        if (authBlocker) authBlocker.style.display = "none";
        initializeDashboard(db);
      }).catch((error) => {
        console.error("Error verificando UID:", error);
        if (authBlocker) authBlocker.style.display = "flex";
      });
    });

    function initializeDashboard(database) {
      const theatre = window.LuminousTheatreState;
      if (!theatre) throw new Error("LuminousTheatreState debe cargarse antes del dashboard del DM.");

      const paths = () => theatre.getPaths();
      const DEFAULT_TITLE_COLOR = "#3b2918";
      const SCENARIOS_ROOT = "campaña/escenarios";
      let scenariosDatabase = {};
      let isProcessingQueue = false;
      let processorGeneration = 0;

      window.LuminousInstanceControl.bindDashboard({ db: database });

      const status = document.getElementById("connection-status");
      if (status) {
        database.ref(".info/connected").on("value", (snapshot) => {
          const online = snapshot.val() === true;
          status.textContent = online ? "● SINCRONIZADO" : "● SIN CONEXIÓN";
          status.classList.toggle("offline", !online);
        });
      }

      // --- BIBLIOTECA DE LUGARES / ESCENARIOS ---
      const scenarioSelect = document.getElementById("theatre-scenario-select");
      const locationFilter = document.getElementById("theatre-scenario-location-filter");
      const tagFilter = document.getElementById("theatre-scenario-tag-filter");
      const scenarioNameInput = document.getElementById("theatre-scenario-name");
      const bgInput = document.getElementById("theatre-background-input");
      const locInput = document.getElementById("theatre-location-input");
      const tagsInput = document.getElementById("theatre-scenario-tags");
      const btnSaveScenario = document.getElementById("btn-save-scenario");
      const btnUseScenario = document.getElementById("btn-use-scenario");
      const btnDeleteScenario = document.getElementById("btn-delete-scenario");
      const btnUpdateScene = document.getElementById("btn-update-scene");

      function ensureScenarioMetadataInputs() {
        if (!tagsInput || document.getElementById("theatre-scenario-region")) return;
        const region = document.createElement("input");
        region.id = "theatre-scenario-region";
        region.type = "text";
        region.placeholder = "Región / sección / capítulo";
        region.style.cssText = tagsInput.style.cssText;

        const category = document.createElement("input");
        category.id = "theatre-scenario-category";
        category.type = "text";
        category.placeholder = "Categoría / área";
        category.style.cssText = tagsInput.style.cssText;

        tagsInput.parentElement?.insertBefore(region, tagsInput);
        tagsInput.parentElement?.insertBefore(category, tagsInput);
      }

      ensureScenarioMetadataInputs();
      const regionInput = () => document.getElementById("theatre-scenario-region");
      const categoryInput = () => document.getElementById("theatre-scenario-category");

      function normalizedTags() {
        return [...new Set((tagsInput?.value || "").split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
      }

      function scenarioPayload() {
        return {
          nombre: scenarioNameInput?.value.trim() || "",
          fondo: bgInput?.value.trim() || "",
          locacion: locInput?.value.trim() || "",
          region: regionInput()?.value.trim() || "",
          categoria: categoryInput()?.value.trim() || "",
          sub_etiquetas: normalizedTags()
        };
      }

      function renderScenarioSelect() {
        if (!scenarioSelect) return;
        const previous = scenarioSelect.value;
        scenarioSelect.innerHTML = '<option value="">Selecciona un escenario guardado...</option>';
        const locValue = locationFilter?.value || "";
        const tagValue = tagFilter?.value.toLowerCase().trim() || "";
        const locations = new Set();
        const grouped = new Map();

        for (const [scenarioId, data] of Object.entries(scenariosDatabase)) {
          if (data.locacion) locations.add(data.locacion);
          if (locValue && data.locacion !== locValue) continue;
          const searchableTags = [data.region, data.categoria, ...(data.sub_etiquetas || [])].filter(Boolean).map(String);
          if (tagValue && !searchableTags.some((tag) => tag.toLowerCase().includes(tagValue))) continue;
          const group = data.region || data.seccion || data.capitulo || data.locacion || "Sin sección";
          if (!grouped.has(group)) grouped.set(group, []);
          grouped.get(group).push([scenarioId, data]);
        }

        for (const groupName of [...grouped.keys()].sort((a, b) => a.localeCompare(b))) {
          const optgroup = document.createElement("optgroup");
          optgroup.label = groupName;
          for (const [scenarioId, data] of grouped.get(groupName).sort((a, b) => String(a[1].nombre || "").localeCompare(String(b[1].nombre || "")))) {
            const option = document.createElement("option");
            option.value = scenarioId;
            const category = data.categoria ? ` · ${data.categoria}` : "";
            option.textContent = `${data.locacion || "Sin loc"} · ${data.nombre || "Sin nombre"}${category}`;
            optgroup.appendChild(option);
          }
          scenarioSelect.appendChild(optgroup);
        }

        if (locationFilter) {
          const currentLocation = locationFilter.value;
          locationFilter.innerHTML = '<option value="">Todas las localizaciones</option>';
          for (const location of [...locations].sort((a, b) => a.localeCompare(b))) {
            const option = document.createElement("option");
            option.value = location;
            option.textContent = location;
            locationFilter.appendChild(option);
          }
          locationFilter.value = currentLocation;
        }
        if (scenariosDatabase[previous]) scenarioSelect.value = previous;
      }

      database.ref(SCENARIOS_ROOT).on("value", (snapshot) => {
        scenariosDatabase = snapshot.val() || {};
        renderScenarioSelect();
      });
      locationFilter?.addEventListener("change", renderScenarioSelect);
      tagFilter?.addEventListener("input", renderScenarioSelect);

      scenarioSelect?.addEventListener("change", (event) => {
        const data = scenariosDatabase[event.target.value];
        if (!data) {
          if (scenarioNameInput) scenarioNameInput.value = "";
          if (bgInput) bgInput.value = "";
          if (locInput) locInput.value = "";
          if (tagsInput) tagsInput.value = "";
          if (regionInput()) regionInput().value = "";
          if (categoryInput()) categoryInput().value = "";
          return;
        }
        if (scenarioNameInput) scenarioNameInput.value = data.nombre || "";
        if (bgInput) bgInput.value = data.fondo || "";
        if (locInput) locInput.value = data.locacion || "";
        if (tagsInput) tagsInput.value = (data.sub_etiquetas || []).join(", ");
        if (regionInput()) regionInput().value = data.region || data.seccion || data.capitulo || "";
        if (categoryInput()) categoryInput().value = data.categoria || "";
      });

      btnSaveScenario?.addEventListener("click", () => {
        const data = scenarioPayload();
        if (!data.nombre || !data.fondo || !data.locacion) {
          alert("Nombre, fondo y localización son obligatorios.");
          return;
        }
        const scenarioId = scenarioSelect?.value || database.ref(SCENARIOS_ROOT).push().key;
        const now = window.firebase.database.ServerValue.TIMESTAMP;
        const write = Object.assign({}, data, { updatedAt: now });
        if (!scenarioSelect?.value) write.createdAt = now;
        database.ref(`${SCENARIOS_ROOT}/${scenarioId}`).update(write).then(() => {
          if (scenarioSelect) scenarioSelect.value = scenarioId;
        }).catch((error) => alert("Error al guardar: " + error));
      });

      async function useScenarioFromInputs() {
        const data = scenarioPayload();
        if (!data.fondo || !data.locacion) {
          alert("Fondo y localización son obligatorios para usar el escenario.");
          return;
        }
        await theatre.changeScene(Object.assign({}, data, { escenarioId: scenarioSelect?.value || null }));
      }

      btnUseScenario?.addEventListener("click", () => useScenarioFromInputs().catch((error) => alert("Error aplicando escenario: " + error)));
      btnUpdateScene?.addEventListener("click", () => useScenarioFromInputs().catch((error) => alert("Error aplicando escenario: " + error)));

      btnDeleteScenario?.addEventListener("click", () => {
        const scenarioId = scenarioSelect?.value;
        if (!scenarioId || !confirm("¿Estás seguro de que quieres borrar este escenario?")) return;
        database.ref(`${SCENARIOS_ROOT}/${scenarioId}`).remove().then(() => {
          if (scenarioSelect) scenarioSelect.value = "";
          scenarioSelect?.dispatchEvent(new Event("change"));
        }).catch((error) => alert("Error al borrar: " + error));
      });

      // --- COLA FIFO: SOLO EL DM PUBLICA EL ESTADO DE ESCENA ---
      function nextQueueItem() {
        return database.ref(paths().queue).orderByChild("createdAt").limitToFirst(1).once("value");
      }

      async function dropQueueForTransition() {
        processorGeneration += 1;
        isProcessingQueue = false;
        await database.ref(paths().queue).remove();
      }

      async function processQueue() {
        if (isProcessingQueue) return;
        const generation = processorGeneration;

        const [instanceSnap, sceneSnap] = await Promise.all([
          database.ref("campaña/estado_mundo/instancia_activa").once("value"),
          database.ref(paths().scene).once("value")
        ]);
        if (generation !== processorGeneration || instanceSnap.val() !== "teatro") return;
        const scene = sceneSnap.val() || {};
        if (scene.transitioning) {
          await dropQueueForTransition();
          return;
        }

        const queueSnap = await nextQueueItem();
        if (generation !== processorGeneration || !queueSnap.exists()) return;
        const msgKey = Object.keys(queueSnap.val())[0];
        const queueRef = database.ref(`${paths().queue}/${msgKey}`);
        isProcessingQueue = true;

        const claimed = await new Promise((resolve, reject) => {
          queueRef.transaction((current) => {
            if (!current) return current;
            const now = Date.now();
            const stuck = current.processing && current.processingStartedAt && (now - Number(current.processingStartedAt) > 120000);
            if (current.processing && !stuck) return;
            current.processing = true;
            current.processingStartedAt = window.firebase.database.ServerValue.TIMESTAMP;
            return current;
          }, (error, committed, snapshot) => {
            if (error) reject(error);
            else resolve(committed ? snapshot.val() : null);
          });
        }).catch((error) => {
          console.error("No se pudo reclamar el mensaje de Theatre:", error);
          return null;
        });

        if (!claimed || generation !== processorGeneration) {
          isProcessingQueue = false;
          if (generation === processorGeneration) setTimeout(processQueue, 250);
          return;
        }

        const freshScene = (await database.ref(paths().scene).once("value")).val() || {};
        if (generation !== processorGeneration || freshScene.transitioning || theatre.messageIsStaleForScene(claimed, freshScene)) {
          await queueRef.remove();
          isProcessingQueue = false;
          if (generation === processorGeneration) processQueue();
          return;
        }

        const textLength = String(claimed.mensaje || "").length;
        claimed.speedMs = 30;
        claimed.durationMs = (textLength * claimed.speedMs) + 3000;
        const result = await theatre.publishIntervention(msgKey, claimed).catch((error) => {
          console.error("Error publicando intervención del Theatre Engine:", error);
          return { published: false, reason: "error" };
        });

        if (!result?.published) {
          await queueRef.remove();
          isProcessingQueue = false;
          if (generation === processorGeneration) processQueue();
          return;
        }

        setTimeout(async () => {
          if (generation !== processorGeneration) return;
          try {
            await database.ref(`${paths().log}/${msgKey}`).set(result.payload);
            await queueRef.remove();
          } catch (error) {
            console.error("Error archivando la intervención del Theatre:", error);
          } finally {
            if (generation === processorGeneration) {
              isProcessingQueue = false;
              processQueue();
            }
          }
        }, claimed.durationMs);
      }

      database.ref(paths().queue).on("child_added", () => processQueue());
      database.ref("campaña/estado_mundo/instancia_activa").on("value", (snapshot) => {
        if (snapshot.val() === "teatro") processQueue();
      });
      database.ref(paths().scene).on("value", (snapshot) => {
        const scene = snapshot.val() || {};
        if (scene.transitioning) {
          dropQueueForTransition().catch((error) => console.error("No se pudo cortar la cola durante transición:", error));
        } else {
          processQueue();
        }
      });

      // --- COMPOSITOR DE DIÁLOGO DEL DM ---
      const btnSendDialogue = document.getElementById("btn-send-dialogue");
      const speakerSelect = document.getElementById("theatre-speaker-select");
      const expressionSelect = document.getElementById("theatre-expression-select");

      btnSendDialogue?.addEventListener("click", async () => {
        const dialogueInput = document.getElementById("theatre-dialogue-input");
        const typeSelect = document.getElementById("dm-tipo-dialogo-select");
        const languageSelect = document.getElementById("theatre-language-select");
        const text = dialogueInput?.value.trim() || "";
        if (!text) return;

        let type = typeSelect?.value || "dialogo";
        let speaker = {
          nombre: "",
          titulo: "",
          actorId: null,
          expression: "Neutral",
          sprite: null,
          icono: null,
          color_nombre: "#ffffff",
          color_titulo: DEFAULT_TITLE_COLOR
        };

        if (!speakerSelect || speakerSelect.value === "narrador") {
          type = "narracion";
        } else {
          const option = speakerSelect.options[speakerSelect.selectedIndex];
          const expressionOption = expressionSelect?.options[expressionSelect.selectedIndex];
          speaker = {
            nombre: option.dataset.nombre || "",
            titulo: option.dataset.titulo || "",
            actorId: speakerSelect.value,
            expression: expressionSelect?.value || "Neutral",
            sprite: expressionOption?.dataset.sprite || null,
            icono: option.dataset.icono || null,
            color_nombre: option.dataset.colorNombre || "#ffffff",
            color_titulo: option.dataset.colorTitulo || DEFAULT_TITLE_COLOR
          };
        }

        const queued = await theatre.enqueueIntervention({
          mensaje: text,
          nombre: speaker.nombre,
          titulo: speaker.titulo,
          actorId: speaker.actorId,
          expression: speaker.expression,
          sprite: speaker.sprite,
          icono: speaker.icono,
          color_nombre: speaker.color_nombre,
          color_titulo: speaker.color_titulo,
          tipo_dialogo: type,
          mostrar_identidad: type !== "narracion",
          idiomaId: languageSelect?.value || null
        });

        if (!queued.queued) {
          if (queued.reason === "transition") alert("La escena está en transición. El mensaje no fue enviado.");
          return;
        }
        if (dialogueInput) dialogueInput.value = "";
      });

      database.ref(`${paths().scene}/actores`).on("value", (snapshot) => {
        if (!speakerSelect) return;
        const currentSelection = speakerSelect.value;
        const actors = snapshot.val() || {};
        speakerSelect.innerHTML = '<option value="narrador">Narrador</option>';
        for (const [actorId, actor] of Object.entries(actors)) {
          const option = document.createElement("option");
          option.value = actorId;
          option.textContent = actor.nombre || actorId;
          option.dataset.nombre = actor.nombre || "";
          option.dataset.titulo = actor.titulo || "";
          option.dataset.icono = actor.icono || "";
          option.dataset.colorNombre = actor.color_nombre || "#ffffff";
          option.dataset.colorTitulo = actor.color_titulo || DEFAULT_TITLE_COLOR;
          option.dataset.expresiones = JSON.stringify(actor.expresiones || {});
          option.dataset.preparedExpression = actor.expresionPreparada || actor.expresionActiva || "Neutral";
          speakerSelect.appendChild(option);
        }
        speakerSelect.value = currentSelection && actors[currentSelection] ? currentSelection : "narrador";
        speakerSelect.dispatchEvent(new Event("change"));
      });

      speakerSelect?.addEventListener("change", (event) => {
        if (!expressionSelect) return;
        expressionSelect.innerHTML = "";
        if (event.target.value === "narrador") {
          const option = document.createElement("option");
          option.value = "Neutral";
          option.textContent = "Neutral";
          expressionSelect.appendChild(option);
          return;
        }

        const speakerOption = event.target.options[event.target.selectedIndex];
        let expressions = {};
        try { expressions = JSON.parse(speakerOption.dataset.expresiones || "{}"); } catch (error) {}
        if (!Object.keys(expressions).length) expressions = { Neutral: "" };
        for (const [expression, spriteUrl] of Object.entries(expressions)) {
          const option = document.createElement("option");
          option.value = expression;
          option.textContent = expression;
          option.dataset.sprite = spriteUrl;
          expressionSelect.appendChild(option);
        }
        const prepared = speakerOption.dataset.preparedExpression;
        if (prepared && expressions[prepared] !== undefined) expressionSelect.value = prepared;
      });

      expressionSelect?.addEventListener("change", () => {
        if (!speakerSelect || speakerSelect.value === "narrador") return;
        // Selection only prepares; reveal happens when the queue publishes the intervention.
        theatre.prepareExpression(speakerSelect.value, expressionSelect.value);
      });

      const btnTriggerCombat = document.getElementById("btn-trigger-combat");
      btnTriggerCombat?.addEventListener("click", () => {
        database.ref("campaña/estado_mundo/instancia_activa").set("combate");
        database.ref("campaña/combate").update({
          estado: "COMBAT_ACTIVE",
          startedAt: window.firebase.database.ServerValue.TIMESTAMP
        });
      });
    }
  });
})();
