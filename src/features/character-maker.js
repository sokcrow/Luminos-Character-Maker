import { db } from "../core/firebase-config.js";
import {
  atributosLista,
  skillsTree,
  classesData,
  backgroundsData,
  professionsData,
  psychologicalBackgroundsData,
  racesData,
} from "./character-data.js";

document.addEventListener("DOMContentLoaded", () => {
  const modValues = {
    cuspide: { label: "Cúspide", val: 3, class: "stat-val-pos" },
    excelente: { label: "Excelente", val: 2, class: "stat-val-pos" },
    bueno: { label: "Bueno", val: 1, class: "stat-val-pos" },
    deficiente: { label: "Deficiente", val: -1, class: "stat-val-neg" },
    punto_ciego: { label: "Punto Ciego", val: -2, class: "stat-val-neg" },
    critica: { label: "Crítica", val: -3, class: "stat-val-neg" },
  };

  const dothyResponses = {
    origenes: {
      humano: "La humanidad siempre es un buen lienzo...",
      humano_mutante: "Interesante... el cambio es parte de la evolución.",
      humano_cyborg: "Metal y carne unidos... una combinación muy peculiar.",
      tiefling:
        "Un legado del inframundo. No te preocupes, aquí no juzgamos a nadie.",
      warforged: "Un alma forjada en acero. Eres alguien bastante especial.",
      felinae: "Agilidad y gracia... siempre viene bien en estos rumbos.",
      semi_dragon: "Sangre antigua y poderosa. Una elección formidable.",
      lupae: "Un espíritu salvaje. La lealtad será tu mayor fuerza.",
      moonfae: "Magia y misterio de la luna. Será fascinante verte en acción.",
      undae: "El fluir del agua en tu interior... muy refrescante.",
      elnae: "Ligeros como el viento. Tu perspectiva será de gran ayuda.",
      yuanti_pura_sangre:
        "Una herencia venenosa, pero muy intrigante. Me agrada.",
      lanae: "Una fortaleza nacida en las montañas. Impresionante.",
      tsune: "Astucia e ilusiones... esto será muy divertido.",
    },
    trasfondos: {
      alta_cuna: "Ah, una vida de comodidades... veamos cómo te adaptas aquí.",
      aristocracia_mercantil:
        "Los negocios son importantes, el trueque siempre abre puertas.",
      nobleza_caida:
        "Las caídas son duras, pero siempre se puede volver a brillar.",
      cuna_de_eruditos:
        "El conocimiento es poder, y tú tienes mucho potencial.",
      linaje_militar:
        "Disciplina y honor... valores muy útiles en esta ciudad.",
      familia_de_granjeros:
        "El trabajo duro forja el carácter. Admiro tu persistencia.",
      artesano_independiente: "La creatividad es una herramienta maravillosa.",
      fuerzas_de_seguridad:
        "Conoces el orden desde adentro, eso te dará ventaja.",
      burocracia_menor:
        "Paciencia y detalle... habilidades muy infravaloradas.",
      huerfano_callejero:
        "La calle te enseñó a sobrevivir, y eso no se olvida.",
      escoria_criminal: "A veces hay que romper las reglas para avanzar.",
      exiliado_proscrito:
        "Un lobo solitario... pero quizás aquí encuentres una manada.",
      esclavo_liberado: "La libertad es invaluable. Me alegra que la tengas.",
      experimento_fallido:
        "Las cicatrices son solo muestra de que sobreviviste.",
      academico_desacreditado:
        "A veces la verdad es incómoda. Aquí podrás usarla.",
      siervo_corporativo:
        "Conoces los engranajes de la máquina. Eres muy valioso.",
      deudor_vitalicio:
        "Una carga pesada... pero te prometo que te ayudaré a aliviarla.",
      miembro_culto:
        "La fe mueve montañas, aunque a veces las direcciones cambien.",
    },
    profesiones: {
      medico_cirujano: "La curación es un arte noble... y muy solicitado.",
      ingeniero_mecanico:
        "Construir y reparar... siempre necesitamos a alguien así.",
      erudito_academico:
        "Siempre es bueno tener a alguien que entienda los misterios.",
      abogado_burocrata:
        "Las palabras pueden ser armas más afiladas que las espadas.",
      chef_gastronomico: "¡Oh! Una buena comida siempre levanta el ánimo.",
      herrero_armero:
        "La forja es el corazón de la defensa. Excelente elección.",
      boticario_alquimista:
        "Pociones y remedios... un conocimiento muy práctico.",
      sastre_tejedor: "El estilo y la protección pueden ir de la mano.",
      ladron_de_guante_blanco:
        "Silencio y elegancia. Serás muy útil en las sombras.",
      contrabandista_traficante: "Saber mover cosas siempre tiene su valor.",
      cazarrecompensas_rastreador:
        "Un cazador siempre encuentra su presa. Impresionante.",
      informante_espia: "Los secretos son la verdadera moneda de este mundo.",
      musico_artista:
        "El arte y la música alegran incluso los corazones más oscuros.",
      clerigo_fanatico:
        "La devoción te guiará cuando la oscuridad intente cegarte.",
      guardia_soldado: "Firmeza y vigilancia. Eres un pilar seguro.",
    },
    psicologia: {
      el_apostador:
        "El riesgo es parte de la vida, solo intenta no perderlo todo.",
      el_inestable:
        "Tus emociones son intensas, pero te ayudarán a sentirte vivo.",
      el_ex_soldado:
        "El campo de batalla forjó tu mente. Tu experiencia es invaluable.",
      el_paria:
        "A veces sentirse fuera de lugar es el primer paso para encontrarse.",
      el_atormentado:
        "Lidiar con los recuerdos no es fácil, pero aquí estarás a salvo.",
      el_trasgresor:
        "Todos cruzamos líneas alguna vez. Lo importante es qué hacemos después.",
      el_caido: "La altura da vértigo, pero te enseñó mucho antes de caer.",
      la_herramienta_rota:
        "Quizás solo necesitas un nuevo propósito, y yo te ayudaré a encontrarlo.",
      el_aspirante:
        "La ambición te llevará lejos, siempre y cuando no te consuma.",
      el_archivista: "Tu mente es un tesoro de información.",
      el_artesano: "Entender cómo funcionan las cosas te da una ventaja única.",
      el_residente:
        "La paciencia y la observación son virtudes que pocos tienen.",
    },
  };

  // 4. Estado Global
  const luminousState = {
    midraAttempts: 0,
    midraAmulet: false,
    characterName: null,
    originId: null,
    subraceId: null,
    backgroundId: null,
    professionIds: [],
    professionPerkIds: [],
    psychologicalBackgroundId: null,
    psychologicalIdeal: null,
    psychologicalVinculo: null,
    psychologicalGrieta: null,
    clase: null,
    hpCoef: null,
    modifiers: {}, // Mods de atributos (Vigor, etc.)
    humanPerks: [],
    baseStats: { cuerpo: 0, mente: 0, alma: 0 }, // Stats principales
    ahn: 0,
    activeEntity: "golden",
    dothyBlessing: false,
  };

  function renderOrigins() {
    if (!gridContainer) return;
    gridContainer.innerHTML = "";

    let optionsHtml =
      '<option value="" disabled selected>Selecciona Atributo</option>';
    atributosLista.forEach((attr) => {
      optionsHtml += `<option value="${attr}">${attr}</option>`;
    });

    racesData.forEach((raza) => {
      const card = document.createElement("div");
      card.className = "origin-card";
      card.dataset.id = raza.id;

      let bodyHtml = "";

      if (raza.isHuman) {
        let selectsHtml = "";
        for (const [key, data] of Object.entries(modValues)) {
          const sign = data.val > 0 ? "+" : "";
          selectsHtml += `
                            <div class="human-select-row">
                                <label>
                                    <span>${data.label}</span>
                                    <span class="${data.class}">${sign}${data.val}</span>
                                </label>
                                <select class="choice-select human-mod-select" data-mod="${key}">
                                    ${optionsHtml}
                                </select>
                            </div>
                        `;
        }

        let perksOptionsHtml =
          '<option value="" disabled selected>Selecciona Perk</option>';
        if (raza.perks) {
          raza.perks.forEach((p) => {
            perksOptionsHtml += `<option value="${p.id}">${p.nombre}</option>`;
          });
        }

        let perksSelectsHtml = "";
        if (raza.perksSelection) {
          for (let i = 0; i < raza.perksSelection; i++) {
            perksSelectsHtml += `
                                <div class="human-select-row" style="margin-top: 10px; display: block;">
                                    <select class="choice-select human-perk-select" data-index="${i}" style="width: 100%;">
                                        ${perksOptionsHtml}
                                    </select>
                                    <div class="perk-desc" id="human-perk-desc-${i}" style="font-size: 11px; color: var(--text-muted); margin-top: 4px; display: none;"></div>
                                </div>
                            `;
          }
        }

        bodyHtml = `
                        <div class="stats-box">
                            <div style="font-size: 13px; color: var(--text-muted); text-align: center; margin-bottom: 5px;">Personaliza tus atributos</div>
                            <div class="human-selects">
                                ${selectsHtml}
                            </div>
                            <div style="font-size: 13px; color: var(--text-muted); text-align: center; margin-top: 15px; margin-bottom: 5px; border-top: 1px dashed #444; padding-top: 10px;">Elige ${raza.perksSelection || 0} Perks</div>
                            <div class="human-perk-selects">
                                ${perksSelectsHtml}
                            </div>
                            <div class="human-error-msg" id="human-error" style="margin-top: 10px;">Hay opciones repetidas o sin seleccionar.</div>
                        </div>
                    `;
      } else if (raza.subrazas) {
        let subraceOptions =
          '<option value="" disabled selected>Selecciona Subraza</option>';
        raza.subrazas.forEach((sr) => {
          subraceOptions += `<option value="${sr.id}">${sr.nombre}</option>`;
        });

        let perksHtml = "";
        if (raza.perks) {
          perksHtml = `<div class="trait-box" style="margin-top: 15px; border-top: 1px dashed #444; padding-top: 10px;">`;
          raza.perks.forEach((p) => {
            perksHtml += `
                                <div style="margin-bottom: 8px;">
                                    <div class="trait-title">${p.nombre}</div>
                                    <div class="trait-desc">${p.desc}</div>
                                </div>
                            `;
          });
          perksHtml += `</div>`;
        }

        bodyHtml = `
                        <div class="stats-box">
                            <div class="subrace-container">
                                <select class="choice-select subrace-select" data-race="${raza.id}">
                                    ${subraceOptions}
                                </select>
                                <div class="subrace-stats-display" style="margin-top: 10px; display: grid; gap: 8px;"></div>
                            </div>
                        </div>
                        ${perksHtml}
                    `;
      } else {
        let statsHtml = "";
        for (const [key, attrName] of Object.entries(raza.mods)) {
          const data = modValues[key];
          const sign = data.val > 0 ? "+" : "";
          statsHtml += `
                            <div class="stat-row">
                                <div class="stat-col">
                                    <span class="stat-name-label">${data.label}</span>
                                    <span class="stat-label">${attrName}</span>
                                </div>
                                <span class="${data.class}">${sign}${data.val}</span>
                            </div>
                        `;
        }

        let perksHtml = "";
        if (raza.perks) {
          perksHtml = `<div class="trait-box" style="margin-top: 15px; border-top: 1px dashed #444; padding-top: 10px;">`;
          raza.perks.forEach((p) => {
            perksHtml += `
                                <div style="margin-bottom: 8px;">
                                    <div class="trait-title">${p.nombre}</div>
                                    <div class="trait-desc">${p.desc}</div>
                                </div>
                            `;
          });
          perksHtml += `</div>`;
        }

        bodyHtml = `
                        <div class="stats-box">
                            ${statsHtml}
                        </div>
                        ${perksHtml}
                    `;
      }

      card.innerHTML = `
                    <div class="card-header">
                        <h2>${raza.nombre}</h2>
                    </div>
                    <div class="card-body">
                        ${bodyHtml}
                    </div>
                `;

      card.addEventListener("click", (e) => {
        if (e.target.tagName === "SELECT" || e.target.tagName === "OPTION")
          return;
        seleccionarOrigen(raza.id);
      });

      gridContainer.appendChild(card);
    });

    gridContainer.addEventListener("change", (e) => {
      if (
        e.target.classList.contains("human-mod-select") ||
        e.target.classList.contains("human-perk-select")
      ) {
        if (e.target.classList.contains("human-perk-select")) {
          const index = e.target.dataset.index;
          const descDiv = document.getElementById(`human-perk-desc-${index}`);
          const humanRace = racesData.find((r) => r.id === "humano");
          const perkData = humanRace.perks.find((p) => p.id === e.target.value);
          if (perkData && descDiv) {
            descDiv.textContent = perkData.desc;
            descDiv.style.display = "block";
          }
        }
        validarHumano();
      } else if (e.target.classList.contains("subrace-select")) {
        const raceId = e.target.dataset.race;
        const subraceId = e.target.value;
        mostrarStatsSubraza(raceId, subraceId, e.target.nextElementSibling);
        validarOrigenConSubraza();
      }
    });
  }

  function mostrarStatsSubraza(raceId, subraceId, displayDiv) {
    const raza = racesData.find((r) => r.id === raceId);
    const subraza = raza.subrazas.find((sr) => sr.id === subraceId);
    let statsHtml = "";
    for (const [key, attrName] of Object.entries(subraza.mods)) {
      const data = modValues[key];
      const sign = data.val > 0 ? "+" : "";
      statsHtml += `
                    <div class="stat-row">
                        <div class="stat-col">
                            <span class="stat-name-label">${data.label}</span>
                            <span class="stat-label">${attrName}</span>
                        </div>
                        <span class="${data.class}">${sign}${data.val}</span>
                    </div>
                `;
    }

    if (subraza.perks) {
      statsHtml += `<div class="trait-box" style="margin-top: 15px; border-top: 1px dashed #444; padding-top: 10px;">`;
      subraza.perks.forEach((p) => {
        statsHtml += `
                        <div style="margin-bottom: 8px;">
                            <div class="trait-title" style="color: var(--green-success);">${p.nombre}</div>
                            <div class="trait-desc">${p.desc}</div>
                        </div>
                    `;
      });
      statsHtml += `</div>`;
    }

    displayDiv.innerHTML = statsHtml;
  }

  function renderBackgrounds() {
    let bgGridContainer = document.getElementById("background-grid");
    if (!bgGridContainer) return;
    bgGridContainer.innerHTML = "";

    backgroundsData.forEach((bg) => {
      const card = document.createElement("div");
      card.className = "origin-card";
      card.dataset.id = bg.id;
      card.dataset.response = bg.entityResponse;

      card.innerHTML = `
                    <div class="card-header" style="text-align: left;">
                        <h2>${bg.name}</h2>
                        <span style="font-size: 0.8rem; color: #FFD700; font-style: italic;">${bg.category}</span>
                    </div>
                    <div class="card-body" style="text-align: left; padding: 15px;">
                        <p style="margin-bottom: 10px; font-size: 0.9rem;"><strong>Descripción:</strong> ${bg.desc}</p>
                        <p style="margin-bottom: 10px; font-size: 0.9rem; color: var(--green-success);"><strong>Beneficio:</strong> ${bg.benefit}</p>
                        <p style="font-size: 0.9rem; color: var(--cyan-tech);"><strong>Fondos y Posesiones:</strong> ${bg.funds}</p>
                    </div>
                `;

      card.addEventListener("click", () => {
        seleccionarBackground(bg.id);
      });

      bgGridContainer.appendChild(card);
    });
  }

  function seleccionarBackground(id) {
    luminousState.backgroundId = id;

    const cards = document.querySelectorAll("#background-grid .origin-card");
    cards.forEach((card) => {
      if (card.dataset.id === id) {
        card.classList.add("selected");
      } else {
        card.classList.remove("selected");
      }
    });

    const bgGridContainer = document.getElementById("background-grid");
    bgGridContainer.classList.add("has-selection");

    const btnConfirmarTrasfondo = document.getElementById(
      "btn-confirmar-trasfondo",
    );
    if (btnConfirmarTrasfondo) {
      btnConfirmarTrasfondo.disabled = false;
    }
  }

  // 6. Lógica de Selección y Validación
  function seleccionarOrigen(id) {
    luminousState.originId = id;

    const cards = document.querySelectorAll(".origin-card");
    cards.forEach((card) => {
      if (card.dataset.id === id) {
        card.classList.add("selected");
      } else {
        card.classList.remove("selected");
      }
    });

    if (id) {
      gridContainer.classList.add("has-selection");
    } else {
      gridContainer.classList.remove("has-selection");
    }

    if (id === "humano") {
      validarHumano();
    } else {
      const raza = racesData.find((r) => r.id === id);
      if (raza.subrazas) {
        validarOrigenConSubraza();
      } else {
        luminousState.modifiers = {};
        for (const [key, attrName] of Object.entries(raza.mods)) {
          luminousState.modifiers[attrName] = modValues[key].val;
        }
        btnConfirmarOrigen.disabled = false;
      }
    }
  }

  function validarOrigenConSubraza() {
    const raza = racesData.find((r) => r.id === luminousState.originId);
    if (!raza || !raza.subrazas) return;

    const selectedCard = document.querySelector(
      `.origin-card[data-id="${luminousState.originId}"]`,
    );
    const select = selectedCard.querySelector(".subrace-select");

    if (!select.value) {
      btnConfirmarOrigen.disabled = true;
    } else {
      luminousState.subraceId = select.value;
      const subraza = raza.subrazas.find((sr) => sr.id === select.value);
      luminousState.modifiers = {};
      for (const [key, attrName] of Object.entries(subraza.mods)) {
        luminousState.modifiers[attrName] = modValues[key].val;
      }
      btnConfirmarOrigen.disabled = false;
    }
  }

  function validarHumano() {
    if (luminousState.originId !== "humano") return;

    const modSelects = document.querySelectorAll(".human-mod-select");
    const perkSelects = document.querySelectorAll(".human-perk-select");
    const errorMsg = document.getElementById("human-error");
    const modValuesSelected = [];
    const perkValuesSelected = [];
    let isValid = true;

    modSelects.forEach((s) => s.classList.remove("error"));
    perkSelects.forEach((s) => s.classList.remove("error"));

    // Validar modificadores
    modSelects.forEach((select) => {
      const val = select.value;
      if (!val) {
        isValid = false;
      } else if (modValuesSelected.includes(val)) {
        isValid = false;
        select.classList.add("error");
        const firstDuplicate = Array.from(modSelects).find(
          (s) => s.value === val,
        );
        if (firstDuplicate) firstDuplicate.classList.add("error");
      } else {
        modValuesSelected.push(val);
      }
    });

    // Validar perks
    perkSelects.forEach((select) => {
      const val = select.value;
      if (!val) {
        isValid = false;
      } else if (perkValuesSelected.includes(val)) {
        isValid = false;
        select.classList.add("error");
        const firstDuplicate = Array.from(perkSelects).find(
          (s) => s.value === val,
        );
        if (firstDuplicate) firstDuplicate.classList.add("error");
      } else {
        perkValuesSelected.push(val);
      }
    });

    if (!isValid) {
      errorMsg.style.display = "block";
      btnConfirmarOrigen.disabled = true;
    } else {
      errorMsg.style.display = "none";
      btnConfirmarOrigen.disabled = false;

      // Actualizar estado de modificadores
      luminousState.modifiers = {};
      modSelects.forEach((select) => {
        const modKey = select.dataset.mod;
        const attrName = select.value;
        luminousState.modifiers[attrName] = modValues[modKey].val;
      });

      // Actualizar estado de perks de humano
      luminousState.humanPerks = [];
      const humanRace = racesData.find((r) => r.id === "humano");
      perkSelects.forEach((select) => {
        const perkId = select.value;
        const perkData = humanRace.perks.find((p) => p.id === perkId);
        if (perkData) {
          luminousState.humanPerks.push(perkData);
        }
      });
    }
  }

  // Referencias a los contenedores
  const phasePurpleIntro = document.getElementById("phase-purple-intro");
  const purpleDialogueText = document.getElementById("purple-dialogue-text");
  const phaseIntro = document.getElementById("phase-intro"); // La entidad dorada original

  // Diálogos de la entidad morada
  const purpleDialogues = [
    "Oh...",
    "Estás a punto de abrir los ojos.",
    "Debo advertirte...",
    "El mundo al que estás por entrar es... turbulento. Está roto.",
    "A veces, puede ser muy cruel.",
    "Me asusta pensar en las heridas que podrías llevarte allá afuera.",
    "Pero...",
    "Quiero prometerte algo.",
    "Si prestas suficiente atención...",
    "Encontrarás destellos de una belleza inmensa, incluso en el centro de todo este caos.",
    "Por favor... cuídate mucho.",
  ];

  let purpleStep = 0;
  let isPurpleTyping = false;
  let purpleTypingTimeout;

  // Función para escribir el texto letra por letra
  function typePurpleText(text) {
    purpleDialogueText.innerHTML = "";
    isPurpleTyping = true;
    let charIndex = 0;

    function typeNext() {
      if (charIndex < text.length) {
        purpleDialogueText.innerHTML += text.charAt(charIndex);
        charIndex++;
        purpleTypingTimeout = setTimeout(typeNext, 60); // 60ms da un ritmo suave y sereno
      } else {
        isPurpleTyping = false; // Terminó de escribir
      }
    }
    typeNext();
  }

  // Función que maneja los clics del jugador
  function handlePurpleClick(e) {
    // Prevenir comportamientos raros en móviles
    if (e.type === "touchstart") e.preventDefault();

    if (isPurpleTyping) {
      // 1. Si está escribiendo, el clic autocompleta la oración
      clearTimeout(purpleTypingTimeout);
      purpleDialogueText.innerHTML = purpleDialogues[purpleStep];
      isPurpleTyping = false;
    } else {
      // 2. Si ya terminó de escribir, avanza al siguiente paso
      purpleStep++;

      if (purpleStep < purpleDialogues.length) {
        // Escribir la siguiente oración
        typePurpleText(purpleDialogues[purpleStep]);
      } else {
        // 3. Ya no hay más diálogos, iniciar la transición
        finishPurplePhase();
      }
    }
  }

  // Función para limpiar la fase morada y dar paso a la dorada
  function finishPurplePhase() {
    // Remover los eventos de clic para que no interfieran después
    phasePurpleIntro.removeEventListener("click", handlePurpleClick);
    phasePurpleIntro.removeEventListener("touchstart", handlePurpleClick);

    // Guardar en el navegador que el jugador ya vio este intro
    localStorage.setItem("sok_hasSeenPurpleIntro", "true");

    // Desvanecer la pantalla morada
    phasePurpleIntro.classList.add("fade-out");

    // Esperar a que termine el fade-out (asumiendo transición CSS de 1.5s)
    setTimeout(() => {
      phasePurpleIntro.classList.add("hidden");

      // Revelar a la entidad dorada
      phaseIntro.classList.remove("hidden");
      phaseIntro.classList.remove("fade-out");

      // Iniciar la secuencia de la entidad dorada
      // Asegúrate de que introStep esté en 0 en tu código original
      typeIntroText(introDialogues[introStep]);
    }, 1500);
  }

  // Asignar los eventos de clic a la pantalla completa de la fase morada
  phasePurpleIntro.addEventListener("click", handlePurpleClick);
  phasePurpleIntro.addEventListener("touchstart", handlePurpleClick, {
    passive: false,
  });

  const introDialogueText = document.getElementById("intro-dialogue-text");
  const nameInputContainer = document.getElementById("name-input-container");
  const characterNameInput = document.getElementById("character-name-input");
  const confirmNameBtn = document.getElementById("confirm-name-btn");

  let introStep = 0;
  let isIntroTyping = false;
  let typingTimeout;
  let characterName = "";

  const introPhrases = [
    "Vaya..",
    "no esperaba a nadie...",
    "Aún..",
    "Debes estar inquieto...",
    "¿Cómo te llamas?",
  ];

  function typeIntroText(htmlText) {
    introDialogueText.innerHTML = "";
    isIntroTyping = true;

    // We need to handle <br> tags properly, so we create a temporary element
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlText;

    let nodes = Array.from(tempDiv.childNodes);
    let currentText = "";
    let nodeIndex = 0;
    let charIndex = 0;

    function typeNext() {
      if (nodeIndex >= nodes.length) {
        isIntroTyping = false;
        if (introStep === 4) {
          // ¿Cómo te llamas?
          nameInputContainer.classList.remove("hidden");
          characterNameInput.focus();
        }
        return;
      }

      let node = nodes[nodeIndex];

      if (node.nodeType === Node.TEXT_NODE) {
        if (charIndex < node.textContent.length) {
          currentText += node.textContent.charAt(charIndex);
          introDialogueText.innerHTML = currentText;
          charIndex++;
          typingTimeout = setTimeout(typeNext, 50);
        } else {
          nodeIndex++;
          charIndex = 0;
          typeNext();
        }
      } else if (
        node.nodeType === Node.ELEMENT_NODE &&
        node.nodeName === "BR"
      ) {
        currentText += "<br>";
        introDialogueText.innerHTML = currentText;
        nodeIndex++;
        charIndex = 0;
        typingTimeout = setTimeout(typeNext, 50);
      } else {
        // For other elements, just append them (not strictly needed here since we only use <br>)
        currentText += node.outerHTML;
        introDialogueText.innerHTML = currentText;
        nodeIndex++;
        charIndex = 0;
        typeNext();
      }
    }

    typeNext();
  }

  function finishIntroPhase() {
    setTimeout(() => {
      phaseIntro.classList.add("fade-out");
      setTimeout(() => {
        phaseIntro.classList.add("hidden");
        phase1.classList.remove("hidden");
      }, 1500);
    }, 1000); // Wait a bit after typing finishes before transitioning
  }

  function handleIntroAdvance(e) {
    if (e.type === "touchstart") e.preventDefault();

    // If we are waiting for name input, don't advance on click
    if (introStep === 4 && !isIntroTyping) return;

    if (isIntroTyping) {
      clearTimeout(typingTimeout);
      introDialogueText.innerHTML = introPhrases[introStep];
      isIntroTyping = false;

      if (introStep === 4) {
        nameInputContainer.classList.remove("hidden");
        characterNameInput.focus();
      }
    } else {
      introStep++;
      if (introStep < introPhrases.length) {
        typeIntroText(introPhrases[introStep]);
      }
    }
  }

  phaseIntro.addEventListener("click", handleIntroAdvance);
  phaseIntro.addEventListener("touchstart", handleIntroAdvance, {
    passive: false,
  });

  // Prevent clicks on the input from advancing the phase
  nameInputContainer.addEventListener("click", (e) => e.stopPropagation());
  nameInputContainer.addEventListener(
    "touchstart",
    (e) => e.stopPropagation(),
    { passive: false },
  );

  function typeSequence(phrases, cssClass, callback) {
    introDialogueText.innerHTML = "";
    introDialogueText.className = cssClass; // apply the required text class
    let seqStep = 0;
    let seqTyping = false;
    let seqTimeout;

    function typeNextPhrase(text) {
      introDialogueText.innerHTML = "";
      seqTyping = true;
      let charIndex = 0;

      function typeNextChar() {
        if (charIndex < text.length) {
          introDialogueText.innerHTML += text.charAt(charIndex);
          charIndex++;
          seqTimeout = setTimeout(typeNextChar, 50);
        } else {
          seqTyping = false;
        }
      }
      typeNextChar();
    }

    function advanceSequence(e) {
      if (e && e.type === "touchstart") e.preventDefault();
      if (seqTyping) {
        clearTimeout(seqTimeout);
        introDialogueText.innerHTML = phrases[seqStep];
        seqTyping = false;
      } else {
        seqStep++;
        if (seqStep < phrases.length) {
          typeNextPhrase(phrases[seqStep]);
        } else {
          phaseIntro.removeEventListener("click", advanceSequence);
          phaseIntro.removeEventListener("touchstart", advanceSequence);
          callback();
        }
      }
    }

    // Temporarily replace the main event listener
    phaseIntro.removeEventListener("click", handleIntroAdvance);
    phaseIntro.removeEventListener("touchstart", handleIntroAdvance);

    phaseIntro.addEventListener("click", advanceSequence);
    phaseIntro.addEventListener("touchstart", advanceSequence, {
      passive: false,
    });

    typeNextPhrase(phrases[seqStep]);
  }

  confirmNameBtn.addEventListener("click", () => {
    const name = characterNameInput.value.trim();
    if (!name) return;

    const nameLower = name.toLowerCase();

    const group1 = [
      "pierre",
      "calipsys",
      "jeske",
      "dalzay",
      "ishamon",
      "angelo",
      "agatha",
    ];
    const group2 = [
      "shajady",
      "lysbe",
      "annelize",
      "so",
      "lyon",
      "aubellyon",
      "xae",
      "xaelunyar",
    ];

    if (group1.includes(nameLower)) {
      characterNameInput.value = "";
      nameInputContainer.classList.add("hidden");
      const phrases = [
        "No comas ansias...",
        "Tal vez me explique mal...",
        "No busco a quien representas",
        "Aún...",
        "Solo quisiera saber...",
        "Que esencia es la que está aquí...",
      ];
      typeSequence(phrases, "golden-text", () => {
        // Restore intro state
        introDialogueText.className = "golden-text";
        introDialogueText.innerHTML = introPhrases[introStep];
        nameInputContainer.classList.remove("hidden");
        phaseIntro.addEventListener("click", handleIntroAdvance);
        phaseIntro.addEventListener("touchstart", handleIntroAdvance, {
          passive: false,
        });
      });
    } else if (group2.includes(nameLower)) {
      luminousState.activeEntity = "dothy";
      luminousState.dothyBlessing = true;
      nameInputContainer.classList.add("hidden");
      // Hide golden glow
      const glow = phaseIntro.querySelector(".background-glow");
      if (glow) glow.style.display = "none";

      const phrases = [
        "¿Tal vez te cansaste de perseguir dragones y magos?...",
        "Intentas escapar de la Asension...",
        "Pero ambos sabemos que esta realidad solo será un descanso...",
        "No te preocupes te Guiare por este camino...",
        "Y Sembrare la Bases para encontrarnos...",
        "¿Mi Nombre?",
        "Ah.",
        "Soy Dothy...",
        "Tal vez aun no signifique nada para ti",
        "Pero en el futuro...",
        "Estoy segura que nos encontraremos...",
      ];
      typeSequence(phrases, "text-dothy", () => {
        // Note: characterName is assigned at the very end
        luminousState.characterName = name;
        characterName = name;
        nameInputContainer.classList.add("hidden");
        finishIntroPhase();
      });
    } else {
      luminousState.characterName = name;
      characterName = name;
      nameInputContainer.classList.add("hidden");
      finishIntroPhase();
    }
  });

  characterNameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      confirmNameBtn.click();
    }
  });

  // Verificar si es la primera vez que entra a la página usando localStorage
  const hasSeenPurpleIntro = localStorage.getItem("sok_hasSeenPurpleIntro");

  if (!hasSeenPurpleIntro) {
    // Es la primera vez: Ocultar dorada, mostrar morada e iniciar
    phaseIntro.classList.add("hidden");
    phasePurpleIntro.classList.remove("hidden");
    typePurpleText(purpleDialogues[purpleStep]);
  } else {
    // Ya lo vio antes: Ocultar morada, mostrar dorada e iniciar la dorada
    phasePurpleIntro.classList.add("hidden");
    phaseIntro.classList.remove("hidden");

    // Aquí invocas la función de tipeo de la entidad dorada que ya tienes
    typeIntroText(introPhrases[introStep]);
  }

  const phase1 = document.getElementById("phase1");
  const phaseDialogue = document.getElementById("phase-dialogue");
  const dialogueText = document.getElementById("dialogue-text");

  let currentDialogueStep = 0;
  let dialogues = [
    "Interesante...",
    "Te he observado por un tiempo...",
    "Tal vez sea interesante...",
  ];

  let gridContainer = document.getElementById("origin-grid");
  let btnConfirmarOrigen = document.getElementById("btn-confirmar-origen");

  renderOrigins();

  btnConfirmarOrigen.addEventListener("click", () => {
    if (btnConfirmarOrigen.disabled) return;

    if (luminousState.activeEntity === "dothy" && luminousState.originId) {
      const reaction =
        dothyResponses.origenes[luminousState.originId] ||
        "Tienes potencial...";
      dialogues = [reaction, "Me intriga...", "Veamos qué más hay en ti..."];
    }

    // Transition to Phase 2 (Black screen + first dialogue)
    phase1.classList.add("fade-out");

    setTimeout(() => {
      phase1.classList.add("hidden");
      phase1.classList.remove("fade-out");

      // Show dialogue phase
      phaseDialogue.classList.remove("hidden");
      showDialogue(currentDialogueStep);
    }, 1500); // Wait for fade out
  });

  // Handle dialogue progression
  phaseDialogue.addEventListener("click", () => {
    currentDialogueStep++;

    if (currentDialogueStep < dialogues.length) {
      showDialogue(currentDialogueStep);
    } else {
      // Transition to Phase 2 (Background Selection)
      phaseDialogue.classList.add("fade-out");
      setTimeout(() => {
        phaseDialogue.classList.add("hidden");
        phaseDialogue.classList.remove("fade-out");

        const phase2 = document.getElementById("phase2");
        phase2.classList.remove("hidden");
        renderBackgrounds();
      }, 1000);
    }
  });

  // Logic for Phase 2 (Backgrounds)
  let btnConfirmarTrasfondo = document.getElementById(
    "btn-confirmar-trasfondo",
  );
  const phase2 = document.getElementById("phase2");
  const phaseDialogue2 = document.getElementById("phase-dialogue-2");
  const dialogueText2 = document.getElementById("dialogue-text-2");
  const nameInputContainer2 = document.getElementById("name-input-container-2");
  const characterNameInput2 = document.getElementById("character-name-input-2");
  const confirmNameBtn2 = document.getElementById("confirm-name-btn-2");

  let dialogue2Step = 0;
  let dialogue2Phrases = [];
  let isTypingDialogue2 = false;
  let typingTimeout2;

  const nameTrapResponses = [
    "No...",
    "¿Quién?",
    "Ese eco hace mucho que se apagó. Intenta de nuevo.",
    "No juegues conmigo.",
    "Ese nombre no te pertenece.",
    "Un fantasma no tiene lugar aquí. Dime tu verdadero nombre.",
    "Ese espacio ya fue reclamado por el olvido. Elige otro.",
    "No pronuncies lo que no entiendes. ¿Cómo te llaman?",
  ];

  btnConfirmarTrasfondo.addEventListener("click", () => {
    if (btnConfirmarTrasfondo.disabled) return;

    // Get selected background's response
    const selectedBg = backgroundsData.find(
      (bg) => bg.id === luminousState.backgroundId,
    );
    const responseText = selectedBg ? selectedBg.entityResponse : "...";

    // El usuario pidió "incluir un bucle que analice cada respuesta elegida"
    // de la fase 2. Las opciones elegidas son el background (trasfondo).
    // Parse Ahn and Perks for selected background (recompensa de Fase 2)
    if (selectedBg) {
      if (selectedBg.funds) {
        let parsedAhn =
          parseInt(
            selectedBg.funds.replace(/,/g, "").replace(/[^0-9-]/g, ""),
          ) || 0;
        if (luminousState.activeEntity === "dothy") {
          parsedAhn = Math.floor(parsedAhn * 1.5);
        }
        luminousState.ahn = (luminousState.ahn || 0) + parsedAhn;
      }

      if (selectedBg.benefit) {
        const benefits = selectedBg.benefit.split(",");
        benefits.forEach((b) => {
          b = b.trim();
          if (!/^[-+]\d+/.test(b)) {
            if (!luminousState.humanPerks) luminousState.humanPerks = [];
            luminousState.humanPerks.push({
              id:
                "bg_perk_" +
                Date.now() +
                "_" +
                Math.random().toString(36).substring(2, 9),
              nombre: b,
              desc: "Obtenido del trasfondo: " + selectedBg.name,
            });
          } else {
            let match = b.match(/^([-+]\d+)\s+(.+)$/);
            if (match) {
              let val = parseInt(match[1]);
              let stat = match[2].trim();
              luminousState.modifiers[stat] =
                (luminousState.modifiers[stat] || 0) + val;
            }
          }
        });
      }
    }

    if (luminousState.activeEntity === "dothy") {
      const reaction =
        dothyResponses.trasfondos[luminousState.backgroundId] ||
        "Interesante elección...";
      dialogue2Phrases = [
        reaction,
        "Es fascinante ver de dónde vienes.",
        "¿Y cómo te haces llamar?",
      ];
    } else {
      dialogue2Phrases = [responseText, "Ya veo...", "¿Qué nombre te dieron?"];
    }

    dialogue2Step = 0;

    // Transition to Phase Dialogue 2
    phase2.classList.add("fade-out");

    setTimeout(() => {
      phase2.classList.add("hidden");
      phase2.classList.remove("fade-out");

      // Show dialogue 2
      phaseDialogue2.classList.remove("hidden");
      typeDialogue2(dialogue2Phrases[dialogue2Step]);
    }, 1500); // Wait for fade out
  });

  function typeDialogue2(text) {
    if (luminousState.activeEntity === "dothy") {
      dialogueText2.className = "text-dothy";
      const glow = phaseDialogue2.querySelector(".background-glow");
      if (glow) glow.style.display = "none";
    } else if (luminousState.activeEntity === "midra") {
      dialogueText2.className = "text-midra";
      const glow = phaseDialogue2.querySelector(".background-glow");
      if (glow) glow.style.display = "none";
    } else {
      dialogueText2.className = "golden-text";
    }

    dialogueText2.innerHTML = "";
    isTypingDialogue2 = true;
    let charIndex = 0;

    function typeNext() {
      if (charIndex < text.length) {
        dialogueText2.innerHTML += text.charAt(charIndex);
        charIndex++;
        typingTimeout2 = setTimeout(typeNext, 50);
      } else {
        isTypingDialogue2 = false;
        if (dialogue2Step === 2) {
          // ¿Qué nombre te dieron?
          nameInputContainer2.classList.remove("hidden");
          characterNameInput2.focus();
        }
      }
    }
    typeNext();
  }

  function handleDialogue2Advance(e) {
    if (e.type === "touchstart") e.preventDefault();

    // If waiting for input, don't advance
    if (dialogue2Step === 2 && !isTypingDialogue2) return;

    if (isTypingDialogue2) {
      clearTimeout(typingTimeout2);
      dialogueText2.innerHTML = dialogue2Phrases[dialogue2Step];
      isTypingDialogue2 = false;
      if (dialogue2Step === 2) {
        nameInputContainer2.classList.remove("hidden");
        characterNameInput2.focus();
      }
    } else {
      dialogue2Step++;
      if (dialogue2Step < dialogue2Phrases.length) {
        typeDialogue2(dialogue2Phrases[dialogue2Step]);
      }
    }
  }

  phaseDialogue2.addEventListener("click", handleDialogue2Advance);
  phaseDialogue2.addEventListener("touchstart", handleDialogue2Advance, {
    passive: false,
  });

  nameInputContainer2.addEventListener("click", (e) => e.stopPropagation());
  nameInputContainer2.addEventListener(
    "touchstart",
    (e) => e.stopPropagation(),
    { passive: false },
  );

  function typeSequence2(phrases, cssClass, callback) {
    dialogueText2.innerHTML = "";
    dialogueText2.className = cssClass;
    let seqStep = 0;
    let seqTyping = false;
    let seqTimeout;

    function typeNextPhrase(text) {
      dialogueText2.innerHTML = "";
      seqTyping = true;
      let charIndex = 0;

      function typeNextChar() {
        if (charIndex < text.length) {
          dialogueText2.innerHTML += text.charAt(charIndex);
          charIndex++;
          seqTimeout = setTimeout(typeNextChar, 50);
        } else {
          seqTyping = false;
        }
      }
      typeNextChar();
    }

    function advanceSequence(e) {
      if (e && e.type === "touchstart") e.preventDefault();
      if (seqTyping) {
        clearTimeout(seqTimeout);
        dialogueText2.innerHTML = phrases[seqStep];
        seqTyping = false;
      } else {
        seqStep++;
        if (seqStep < phrases.length) {
          typeNextPhrase(phrases[seqStep]);
        } else {
          phaseDialogue2.removeEventListener("click", advanceSequence);
          phaseDialogue2.removeEventListener("touchstart", advanceSequence);
          callback();
        }
      }
    }

    // Temporarily replace the main event listener
    phaseDialogue2.removeEventListener("click", handleDialogue2Advance);
    phaseDialogue2.removeEventListener("touchstart", handleDialogue2Advance);

    phaseDialogue2.addEventListener("click", advanceSequence);
    phaseDialogue2.addEventListener("touchstart", advanceSequence, {
      passive: false,
    });

    typeNextPhrase(phrases[seqStep]);
  }

  confirmNameBtn2.addEventListener("click", () => {
    const name = characterNameInput2.value.trim();
    if (!name) return;

    if (name.toLowerCase() === "midra") {
      luminousState.midraAttempts += 1;
      const attempts = luminousState.midraAttempts;

      const triggerMidraEvent2 = (phrases, colorClass, onComplete) => {
        nameInputContainer2.classList.add("hidden");
        typeSequence2(phrases, colorClass, onComplete);
      };

      const restoreInputState2 = () => {
        characterNameInput2.value = "";
        dialogueText2.className =
          luminousState.activeEntity === "dothy" ? "text-dothy" : "golden-text";
        dialogueText2.innerHTML =
          luminousState.activeEntity === "dothy"
            ? "¿Cual es tu verdadero nombre?"
            : dialogue2Phrases[2];
        nameInputContainer2.classList.remove("hidden");
        phaseDialogue2.addEventListener("click", handleDialogue2Advance);
        phaseDialogue2.addEventListener("touchstart", handleDialogue2Advance, {
          passive: false,
        });
      };

      if (attempts === 1) {
        triggerMidraEvent2(
          [
            "...",
            "Mi maestro está en medio de sus oraciones.",
            "Apenas estoy aprendiendo de él, no puedo dejar que lo interrumpas.",
          ],
          "text-dothy",
          restoreInputState2,
        );
      } else if (attempts === 2) {
        triggerMidraEvent2(
          [
            "...",
            "¿Otra vez tú?",
            "Te dije que está ocupado. Sus milagros requieren demasiada concentración para lidiar contigo ahora.",
          ],
          "text-dothy",
          restoreInputState2,
        );
      } else if (attempts === 3) {
        triggerMidraEvent2(
          [
            "...",
            "Empiezas a colmar mi paciencia.",
            "La fe de mi maestro es inquebrantable, pero la mía no.",
          ],
          "text-dothy",
          restoreInputState2,
        );
      } else if (attempts === 4) {
        triggerMidraEvent2(
          [
            "...",
            "¡Por favor, detente!",
            "Si rompes su trance de sanación y algo sale mal, las consecuencias recaerán sobre mí...",
          ],
          "text-dothy",
          restoreInputState2,
        );
      } else if (attempts === 5) {
        luminousState.midraAmulet = true;
        triggerMidraEvent2(
          [
            "...",
            "Dothy, está bien. Déjalos pasar.",
            "Veo que siguen igual de necios...",
            "Es bueno verlos, viejos amigos.",
            "Aunque sea en esta extraña realidad.",
            "Fui borrado de su mundo, pero mi esencia en Ox los recuerda.",
            "Les dejo esto para el camino. Sobrevivan.",
          ],
          "text-midra",
          () => {
            luminousState.activeEntity = "dothy";
            luminousState.dothyBlessing = true;
            const glow = phaseDialogue2.querySelector(".background-glow");
            if (glow) glow.style.display = "none";

            const dothyPhrases = [
              "¿Tal vez te cansaste de perseguir dragones y magos?...",
              "Intentas escapar de la Asension...",
              "Pero ambos sabemos que esta realidad solo será un descanso...",
              "No te preocupes te Guiare por este camino...",
              "Y Sembrare la Bases para encontrarnos...",
              "¿Mi Nombre?",
              "Ah.",
              "Soy Dothy...",
              "Tal vez aun no signifique nada para ti",
              "Pero en el futuro...",
              "Estoy segura que nos encontraremos...",
              "¿Cual es tu verdadero nombre?",
            ];
            typeSequence2(dothyPhrases, "text-dothy", () => {
              characterNameInput2.value = "";
              dialogueText2.className = "text-dothy";
              dialogueText2.innerHTML = "¿Cual es tu verdadero nombre?";
              nameInputContainer2.classList.remove("hidden");
              phaseDialogue2.addEventListener("click", handleDialogue2Advance);
              phaseDialogue2.addEventListener(
                "touchstart",
                handleDialogue2Advance,
                { passive: false },
              );
            });
          },
        );
      } else if (attempts > 5) {
        const annoyedDialogues = [
          ["...", "Él ya se fue.", "¿Podemos continuar de verdad?"],
          ["...", "No va a volver a salir.", "Dime tu nombre real."],
          [
            "...",
            "Esto ya no es gracioso.",
            "Necesito registrar tu esencia, no la de mi maestro.",
          ],
        ];
        let index = (attempts - 6) % annoyedDialogues.length;
        triggerMidraEvent2(
          annoyedDialogues[index],
          "text-dothy",
          restoreInputState2,
        );
      }
    } else {
      // Valid name
      luminousState.characterName = name;
      characterName = name;
      nameInputContainer2.classList.add("hidden");

      // Fade out Golden Entity to absolute darkness
      phaseDialogue2.classList.add("fade-out");
      setTimeout(() => {
        phaseDialogue2.classList.add("hidden");
        phaseDialogue2.classList.remove("fade-out");

        // Start Purple Intervention Phase
        startPurpleIntervention();
      }, 1500);
    }
  });

  characterNameInput2.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      confirmNameBtn2.click();
    }
  });

  function showDialogue(step) {
    const dialogueContainer = document.getElementById("phase-dialogue");
    if (luminousState.activeEntity === "dothy") {
      dialogueText.className = "text-dothy";
      const glow = dialogueContainer.querySelector(".background-glow");
      if (glow) glow.style.display = "none";
    } else if (luminousState.activeEntity === "midra") {
      dialogueText.className = "text-midra";
      const glow = dialogueContainer.querySelector(".background-glow");
      if (glow) glow.style.display = "none";
    } else {
      dialogueText.className = "golden-text";
    }

    // Remove animation to re-trigger it
    dialogueText.style.animation = "none";
    dialogueText.offsetHeight; /* trigger reflow */
    dialogueText.style.animation = null;

    dialogueText.textContent = dialogues[step];
  }

  // Logic for Phase Purple Intervention
  const phasePurpleIntervention = document.getElementById(
    "phase-purple-intervention",
  );
  const purpleInterventionText = document.getElementById(
    "purple-intervention-text",
  );
  const purpleButtonsContainer = document.getElementById(
    "purple-buttons-container",
  );

  let pIntervStep = 0;
  let isTypingPInterv = false;
  let typingTimeoutPInterv;
  let purplePhaseState = 0; // 0: initial, 1: focus selected, 2: skill selected, 3: reading final
  let primaryFocus = "";

  let pIntervPhrases = [
    "Perdió el interés en ti.",
    "De momento. Eso nos da algo de tiempo.",
    "Veo que has crecido...",
    "Dime... ¿En qué te enfocaste para sobrevivir a esa etapa?",
  ];

  const skillOptions = {
    Aprender: {
      question:
        "El conocimiento en este mundo es un arma de doble filo. ¿Cuál fue la hoja que más afilaste?",
      options: [
        {
          text: "Recordé cada rostro, cada error y cada mapa que vi.",
          skill: "Memoria",
        },
        {
          text: "Desarmé la lógica de los problemas para encontrar sus fallas.",
          skill: "Análisis",
        },
        {
          text: "Estudié la anatomía, los químicos y las máquinas.",
          skill: "Ciencia",
        },
        {
          text: "Desenterré la historia oculta del mundo y sus verdaderos dueños.",
          skill: "Lore",
        },
        {
          text: "Aprendí a buscar pistas y rastrear lo que no quería ser encontrado.",
          skill: "Investigación",
        },
        {
          text: "Leí el lenguaje corporal para descubrir las mentiras de los demás.",
          skill: "Perspicacia",
        },
        {
          text: "Aprendí el arte de llegar a acuerdos y regatear por mi vida.",
          skill: "Negociación",
        },
        {
          text: "Usé el encanto y la manipulación emocional para abrir puertas.",
          skill: "Seducción",
        },
        {
          text: "Tejí fachadas y mentiras tan perfectas que se volvieron reales.",
          skill: "Engaño",
        },
        {
          text: "Calculé los riesgos y me preparé táctica y cautelosamente.",
          skill: "Prudencia",
        },
        {
          text: "Me volví un líder capaz de inspirar a otros a seguirme.",
          skill: "Carisma",
        },
      ],
    },
    Fortalecerme: {
      question:
        "El castigo físico rompe a los débiles. ¿Cómo adaptaste tu carne para sobrevivir?",
      options: [
        {
          text: "Entrené mis pulmones para correr y resistir sin agotarme.",
          skill: "Cardio",
        },
        {
          text: "Aumenté mi fuerza bruta para derribar obstáculos y enemigos.",
          skill: "Fortaleza",
        },
        {
          text: "Endurecí mi cuerpo para soportar el clima extremo, el hambre y el dolor.",
          skill: "Vigor",
        },
        {
          text: "Dejé que mi lado más animal me guiara para reaccionar antes de pensar.",
          skill: "Instinto",
        },
        {
          text: "Agudicé mi vista y oído para detectar las emboscadas en la oscuridad.",
          skill: "Percepción",
        },
        {
          text: "Entrené mi equilibrio para trepar y moverme por donde otros caerían.",
          skill: "Agilidad",
        },
        {
          text: "Eduqué mis manos para ser preciso con herramientas, armas y mecanismos.",
          skill: "Manejo",
        },
        {
          text: "Pulí mis reacciones físicas para esquivar ataques en una fracción de segundo.",
          skill: "Reflejos",
        },
        {
          text: "Aprendí a caminar sin hacer ruido y a desaparecer en las sombras.",
          skill: "Sigilo",
        },
      ],
    },
    Meditar: {
      question:
        "El alma humana es un fuego extraño y frágil. ¿Cómo mantuviste el tuyo encendido?",
      options: [
        {
          text: "Conectando genuinamente con el dolor de otros para no perder mi humanidad.",
          skill: "Empatía",
        },
        {
          text: "Forjando una determinación violenta e inquebrantable que me impedía rendirme.",
          skill: "Voluntad",
        },
        {
          text: "Aferrándome a una creencia o dogma absoluto que me servía de escudo.",
          skill: "Fe",
        },
        {
          text: "Enterrando mis miedos y traumas tan profundo que ya no podían paralizarme.",
          skill: "Represión",
        },
        {
          text: "Manteniendo una frialdad y paciencia aterradoras bajo la peor de las presiones.",
          skill: "Templanza",
        },
        {
          text: "Volviéndome alguien imponente, dominando a otros con mi sola presencia.",
          skill: "Presencia",
        },
        {
          text: "Sintiendo y comprendiendo los flujos de las energías extrañas del mundo.",
          skill: "Arcana",
        },
      ],
    },
  };

  let finalDialogueText = [
    "Comprendo...",
    "Así fue como forjaste tu camino, tallando tus talentos.",
    "Pero para sostener ese poder, tuviste que dejar algo atrás.",
    "Dime... ¿Qué parte de ti dejaste morir por completo?",
  ];

  const finalOptions = {
    Aprender: [
      { text: "[ Mi resistencia física ]", sacrificeBranch: "Cuerpo" },
      { text: "[ Mi paz espiritual ]", sacrificeBranch: "Alma" },
    ],
    Fortalecerme: [
      { text: "[ Mi sed de conocimiento ]", sacrificeBranch: "Mente" },
      { text: "[ Mi fe interior ]", sacrificeBranch: "Alma" },
    ],
    Meditar: [
      { text: "[ El filo de mi intelecto ]", sacrificeBranch: "Mente" },
      { text: "[ La fuerza de mi sangre ]", sacrificeBranch: "Cuerpo" },
    ],
  };

  function startPurpleIntervention() {
    if (luminousState.activeEntity === "dothy") {
      pIntervPhrases = [
        "Ya se fue...",
        "Tienes tiempo para respirar, no te preocupes.",
        "Se nota que has crecido desde entonces...",
        "Dime, ¿En qué te enfocaste para superar esa etapa?",
      ];
      finalDialogueText = [
        "Entiendo...",
        "Así fue como encontraste tu camino y afinaste tus talentos.",
        "Pero todo en este mundo exige un precio, algo que debiste dejar atrás.",
        "Dime... ¿Qué parte de ti decidiste abandonar?",
      ];
    } else if (luminousState.activeEntity === "midra") {
      pIntervPhrases = [
        "...",
        "Pudimos despistarla un poco.",
        "Te has endurecido.",
        "Dime... ¿En qué te enfocaste para sobrevivir a esa etapa?",
      ];
      finalDialogueText = [
        "Comprendo...",
        "Así fue como forjaste tu camino, tallando tus talentos.",
        "Pero para sostener ese poder, tuviste que dejar algo atrás.",
        "Dime... ¿Qué parte de ti dejaste morir por completo?",
      ];
    }

    phasePurpleIntervention.classList.remove("hidden");
    pIntervStep = 0;
    purplePhaseState = 0;

    // Clear previous buttons
    purpleButtonsContainer.innerHTML = `
                    <button class="purple-btn focus-btn" data-action="Aprender">[ Aprender ]</button>
                    <button class="purple-btn focus-btn" data-action="Fortalecerme">[ Fortalecerme ]</button>
                    <button class="purple-btn focus-btn" data-action="Meditar">[ Meditar ]</button>
                `;

    typePIntervText(pIntervPhrases[pIntervStep]);
  }

  function typePIntervText(text, showButtonsCallback) {
    if (luminousState.activeEntity === "dothy") {
      purpleInterventionText.className = "text-dothy";
      const glow = phasePurpleIntervention.querySelector(
        ".background-glow-purple",
      );
      if (glow) glow.style.display = "none";
    } else if (luminousState.activeEntity === "midra") {
      purpleInterventionText.className = "text-midra";
      const glow = phasePurpleIntervention.querySelector(
        ".background-glow-purple",
      );
      if (glow) glow.style.display = "none";
    } else {
      purpleInterventionText.className = "purple-text";
    }

    purpleInterventionText.innerHTML = "";
    isTypingPInterv = true;
    let charIndex = 0;

    function typeNext() {
      if (charIndex < text.length) {
        if (text.substr(charIndex, 4) === "<br>") {
          purpleInterventionText.innerHTML += "<br>";
          charIndex += 4;
        } else {
          purpleInterventionText.innerHTML += text.charAt(charIndex);
          charIndex++;
        }
        typingTimeoutPInterv = setTimeout(typeNext, 50);
      } else {
        isTypingPInterv = false;
        if (showButtonsCallback) {
          showButtonsCallback();
        }
      }
    }
    typeNext();
  }

  function handlePIntervAdvance(e) {
    if (e.type === "touchstart") e.preventDefault();

    // We only advance by click on text when we are NOT waiting for a button click
    if (!purpleButtonsContainer.classList.contains("hidden")) return;

    if (isTypingPInterv) {
      clearTimeout(typingTimeoutPInterv);
      if (purplePhaseState === 0) {
        purpleInterventionText.innerHTML = pIntervPhrases[pIntervStep];
      } else if (purplePhaseState === 1) {
        purpleInterventionText.innerHTML = skillOptions[primaryFocus].question;
      } else if (purplePhaseState === 2) {
        purpleInterventionText.innerHTML = finalDialogueText[pIntervStep];
      }
      isTypingPInterv = false;

      if (purplePhaseState === 0 && pIntervStep === pIntervPhrases.length - 1) {
        purpleButtonsContainer.classList.remove("hidden");
      } else if (purplePhaseState === 1) {
        purpleButtonsContainer.classList.remove("hidden");
      } else if (
        purplePhaseState === 2 &&
        pIntervStep === finalDialogueText.length - 1
      ) {
        purpleButtonsContainer.classList.remove("hidden");
      }
    } else {
      if (purplePhaseState === 0) {
        pIntervStep++;
        if (pIntervStep < pIntervPhrases.length) {
          typePIntervText(pIntervPhrases[pIntervStep], () => {
            if (pIntervStep === pIntervPhrases.length - 1) {
              purpleButtonsContainer.classList.remove("hidden");
            }
          });
        }
      } else if (purplePhaseState === 2) {
        pIntervStep++;
        if (pIntervStep < finalDialogueText.length) {
          typePIntervText(finalDialogueText[pIntervStep], () => {
            if (pIntervStep === finalDialogueText.length - 1) {
              purpleButtonsContainer.classList.remove("hidden");
            }
          });
        }
      }
    }
  }

  phasePurpleIntervention.addEventListener("click", handlePIntervAdvance);
  phasePurpleIntervention.addEventListener("touchstart", handlePIntervAdvance, {
    passive: false,
  });

  purpleButtonsContainer.addEventListener("click", (e) => {
    e.stopPropagation();

    const branchMapping = {
      Aprender: "Mente",
      Fortalecerme: "Cuerpo",
      Meditar: "Alma",
    };

    if (e.target.classList.contains("focus-btn")) {
      const action = e.target.dataset.action;
      primaryFocus = action;
      purpleButtonsContainer.classList.add("hidden");

      const focusBranch = branchMapping[primaryFocus];

      // Apply +2 to all skills in the focused branch
      if (skillsTree[focusBranch]) {
        skillsTree[focusBranch].forEach((skill) => {
          luminousState.modifiers[skill] =
            (luminousState.modifiers[skill] || 0) + 2;
        });
      }

      // Skip the skill selection (purplePhaseState = 1) and go directly to final question
      purplePhaseState = 2;
      pIntervStep = 0;

      // Populate final buttons
      purpleButtonsContainer.innerHTML = "";
      finalOptions[primaryFocus].forEach((opt) => {
        const btn2 = document.createElement("button");
        btn2.className = "purple-btn final-btn";
        btn2.style.display = "block";
        btn2.style.width = "100%";
        btn2.style.margin = "10px 0";
        btn2.innerHTML = `${opt.text}`;
        btn2.dataset.sacrificeBranch = opt.sacrificeBranch;
        purpleButtonsContainer.appendChild(btn2);
      });

      typePIntervText(finalDialogueText[pIntervStep], () => {
        if (pIntervStep === finalDialogueText.length - 1) {
          purpleButtonsContainer.classList.remove("hidden");
        }
      });
    } else if (e.target.classList.contains("final-btn")) {
      const btn = e.target;
      const sacrificeBranch = btn.dataset.sacrificeBranch;

      purpleButtonsContainer.classList.add("hidden");

      const allBranches = ["Cuerpo", "Mente", "Alma"];
      const focusBranch = branchMapping[primaryFocus];
      const leftoverBranch = allBranches.find(
        (b) => b !== focusBranch && b !== sacrificeBranch,
      );

      // Apply +1 to the remaining branch
      if (skillsTree[leftoverBranch]) {
        skillsTree[leftoverBranch].forEach((skill) => {
          luminousState.modifiers[skill] =
            (luminousState.modifiers[skill] || 0) + 1;
        });
      }

      // Fade out and go to phase-dialogue-3
      phasePurpleIntervention.classList.add("fade-out");
      setTimeout(() => {
        phasePurpleIntervention.classList.add("hidden");
        phasePurpleIntervention.classList.remove("fade-out");
        startDialogue3();
      }, 1500);
    }
  });
  purpleButtonsContainer.addEventListener(
    "touchstart",
    (e) => e.stopPropagation(),
    { passive: false },
  );

  // Logic for Phase Dialogue 3 and Phase 3 (Professions)
  const phaseDialogue3 = document.getElementById("phase-dialogue-3");
  const dialogueText3 = document.getElementById("dialogue-text-3");
  const phase3 = document.getElementById("phase3");

  let dialogue3Step = 0;
  let isTypingDialogue3 = false;
  let typingTimeout3;

  let dialogue3Phrases = [
    "Vaya...",
    "La compasión siempre me ha parecido un desperdicio de tiempo.",
    "Al final, a este mundo no le importa lo que sufriste en tu juventud.",
    "Solo le importa para qué sirves.",
    "El conocimiento cuesta. La experiencia duele. Y ese trozo de papel que dice que eres útil... te endeuda hasta la médula.",
    "Dime... ¿En qué decidiste desperdiciar tu tiempo para intentar salir del fondo y cuál fue tu truco para sobrevivir?",
  ];

  function startDialogue3() {
    if (luminousState.activeEntity === "dothy") {
      dialogue3Phrases = [
        "Ya veo...",
        "A veces compadecerse de uno mismo es natural, ¿no crees?",
        "Pero al mundo exterior le importa poco tu historia.",
        "Solo les importa de qué les sirves.",
        "El conocimiento es poder, pero la experiencia duele. Y ese papel que asegura tu valía... cuesta mucho más que Ahn.",
        "Cuéntame... ¿A qué te dedicaste para abrirte paso y cuál fue tu truco para no rendirte?",
      ];
    } else if (luminousState.activeEntity === "midra") {
      dialogue3Phrases = [
        "Vaya...",
        "La compasión siempre me ha parecido un desperdicio de tiempo.",
        "Al final, a este mundo no le importa lo que sufriste en tu juventud.",
        "Solo le importa para qué sirves.",
        "El conocimiento cuesta. La experiencia duele. Y ese trozo de papel que dice que eres útil... te endeuda hasta la médula.",
        "Dime... ¿En qué decidiste desperdiciar tu tiempo para intentar salir del fondo y cuál fue tu truco para sobrevivir?",
      ];
    }
    phaseDialogue3.classList.remove("hidden");
    dialogue3Step = 0;
    typeDialogue3(dialogue3Phrases[dialogue3Step]);
  }

  function typeDialogue3(text) {
    if (luminousState.activeEntity === "dothy") {
      dialogueText3.className = "text-dothy";
      const glow = phaseDialogue3.querySelector(".background-glow");
      if (glow) glow.style.display = "none";
    } else if (luminousState.activeEntity === "midra") {
      dialogueText3.className = "text-midra";
      const glow = phaseDialogue3.querySelector(".background-glow");
      if (glow) glow.style.display = "none";
    } else {
      dialogueText3.className = "golden-text";
    }

    dialogueText3.innerHTML = "";
    isTypingDialogue3 = true;
    let charIndex = 0;

    function typeNext() {
      if (charIndex < text.length) {
        dialogueText3.innerHTML += text.charAt(charIndex);
        charIndex++;
        // Faster typing speed (20ms) for "tajos rápidos y precisos"
        typingTimeout3 = setTimeout(typeNext, 20);
      } else {
        isTypingDialogue3 = false;
      }
    }
    typeNext();
  }

  function handleDialogue3Advance(e) {
    if (e.type === "touchstart") e.preventDefault();

    if (isTypingDialogue3) {
      clearTimeout(typingTimeout3);
      dialogueText3.innerHTML = dialogue3Phrases[dialogue3Step];
      isTypingDialogue3 = false;
    } else {
      dialogue3Step++;
      if (dialogue3Step < dialogue3Phrases.length) {
        typeDialogue3(dialogue3Phrases[dialogue3Step]);
      } else {
        // Transition to Phase 3
        phaseDialogue3.classList.add("fade-out");
        setTimeout(() => {
          phaseDialogue3.classList.add("hidden");
          phaseDialogue3.classList.remove("fade-out");
          phase3.classList.remove("hidden");
          renderProfessions();
        }, 1000);
      }
    }
  }

  phaseDialogue3.addEventListener("click", handleDialogue3Advance);
  phaseDialogue3.addEventListener("touchstart", handleDialogue3Advance, {
    passive: false,
  });

  function renderProfessions() {
    let profGridContainer = document.getElementById("profession-grid");
    if (!profGridContainer) return;
    profGridContainer.innerHTML = "";

    professionsData.forEach((prof) => {
      const card = document.createElement("div");
      card.className = "origin-card profession-card";
      card.dataset.id = prof.id;

      let perksOptionsHtml =
        '<option value="" disabled selected>Selecciona UN Perk</option>';
      if (prof.perks) {
        prof.perks.forEach((p) => {
          perksOptionsHtml += `<option value="${p.id}">${p.nombre}</option>`;
        });
      }

      // Format cost with commas
      const costString = prof.cost.toLocaleString("en-US") + " Ahn";

      card.innerHTML = `
                        <div class="card-header" style="text-align: left;">
                            <h2>${prof.name}</h2>
                            <span style="font-size: 0.8rem; color: #FFD700; font-style: italic;">${prof.category}</span>
                        </div>
                        <div class="card-body" style="text-align: left; padding: 15px; display: flex; flex-direction: column;">
                            <div style="margin-bottom: 10px; font-size: 0.9rem;">
                                <span style="color: var(--cyan-tech);"><strong>Costo:</strong> -${costString}</span><br>
                                <span style="color: var(--green-success);"><strong>Atributos:</strong> ${prof.attributes}</span>
                            </div>

                            <div style="margin-top: auto; border-top: 1px dashed #444; padding-top: 10px;">
                                <select class="choice-select profession-perk-select" data-prof-id="${prof.id}" style="width: 100%; margin-bottom: 5px;">
                                    ${perksOptionsHtml}
                                </select>
                                <div class="perk-desc" id="prof-perk-desc-${prof.id}" style="font-size: 11px; color: var(--text-muted); display: none;"></div>
                            </div>
                        </div>
                    `;

      // Handle card click
      const handleCardClick = (e) => {
        // Don't select the card if clicking the dropdown itself
        if (e.target.tagName === "SELECT" || e.target.tagName === "OPTION")
          return;
        if (e.type === "touchstart") e.preventDefault();
        seleccionarProfesion(prof.id);
      };
      card.addEventListener("click", handleCardClick);
      card.addEventListener("touchstart", handleCardClick, { passive: false });

      // Handle perk dropdown change
      const selectEl = card.querySelector(".profession-perk-select");
      selectEl.addEventListener("change", (e) => {
        const perkId = e.target.value;
        const descDiv = card.querySelector(`#prof-perk-desc-${prof.id}`);
        const perkData = prof.perks.find((p) => p.id === perkId);

        if (perkData && descDiv) {
          descDiv.innerHTML = `<strong>${perkData.nombre}:</strong> ${perkData.desc}`;
          descDiv.style.display = "block";
        }

        // We must re-validate the profession selection to see if Confirm should be enabled
        validarProfesion();
      });

      profGridContainer.appendChild(card);
    });
  }

  function seleccionarProfesion(id) {
    if (!luminousState.professionIds) {
      luminousState.professionIds = [];
    }

    const index = luminousState.professionIds.indexOf(id);
    if (index > -1) {
      luminousState.professionIds.splice(index, 1);
    } else {
      if (luminousState.professionIds.length < 3) {
        luminousState.professionIds.push(id);
      }
    }

    const cards = document.querySelectorAll(
      "#profession-grid .profession-card",
    );
    cards.forEach((card) => {
      if (luminousState.professionIds.includes(card.dataset.id)) {
        card.classList.add("selected");
      } else {
        card.classList.remove("selected");
      }
    });

    const profGridContainer = document.getElementById("profession-grid");
    if (luminousState.professionIds.length > 0) {
      profGridContainer.classList.add("has-selection");
    } else {
      profGridContainer.classList.remove("has-selection");
    }

    validarProfesion();
  }

  // Logic for Phase 4 (Psychological Backgrounds)
  function renderPsychologicalBackgrounds() {
    let psychoGridContainer = document.getElementById("psychological-grid");
    if (!psychoGridContainer) return;
    psychoGridContainer.innerHTML = "";

    psychologicalBackgroundsData.forEach((bg) => {
      const card = document.createElement("div");
      card.className = "origin-card psycho-card";
      card.dataset.id = bg.id;

      let idealOptionsHtml =
        '<option value="" disabled selected>Selecciona un Ideal</option>';
      if (bg.ideales) {
        bg.ideales.forEach((p) => {
          idealOptionsHtml += `<option value="${p.nombre}">${p.nombre}</option>`;
        });
      }

      let vinculoOptionsHtml =
        '<option value="" disabled selected>Selecciona un Vínculo</option>';
      if (bg.vinculos) {
        bg.vinculos.forEach((p) => {
          vinculoOptionsHtml += `<option value="${p.nombre}">${p.nombre}</option>`;
        });
      }

      let grietaOptionsHtml =
        '<option value="" disabled selected>Selecciona una Grieta</option>';
      if (bg.grietas) {
        bg.grietas.forEach((p) => {
          grietaOptionsHtml += `<option value="${p.nombre}">${p.nombre}</option>`;
        });
      }

      card.innerHTML = `
                        <div class="card-header" style="text-align: left;">
                            <h2>${bg.name}</h2>
                        </div>
                        <div class="card-body" style="text-align: left; padding: 15px; display: flex; flex-direction: column;">
                            <div class="concept-text" style="font-style: italic; color: #FFD700; margin-bottom: 10px;">"${bg.quote}"</div>
                            <div class="concept-text">${bg.desc}</div>

                            <div class="psycho-selects-container" style="display: none; flex-direction: column; gap: 10px; margin-top: auto; border-top: 1px dashed #444; padding-top: 10px;">
                                <div>
                                    <select class="choice-select psycho-ideal-select" data-psycho-id="${bg.id}" style="width: 100%;">
                                        ${idealOptionsHtml}
                                    </select>
                                    <div class="perk-desc" id="psycho-ideal-desc-${bg.id}" style="font-size: 11px; color: var(--text-muted); display: none; margin-top: 5px;"></div>
                                </div>
                                <div>
                                    <select class="choice-select psycho-vinculo-select" data-psycho-id="${bg.id}" style="width: 100%;">
                                        ${vinculoOptionsHtml}
                                    </select>
                                    <div class="perk-desc" id="psycho-vinculo-desc-${bg.id}" style="font-size: 11px; color: var(--text-muted); display: none; margin-top: 5px;"></div>
                                </div>
                                <div>
                                    <select class="choice-select psycho-grieta-select" data-psycho-id="${bg.id}" style="width: 100%;">
                                        ${grietaOptionsHtml}
                                    </select>
                                    <div class="perk-desc" id="psycho-grieta-desc-${bg.id}" style="font-size: 11px; color: var(--text-muted); display: none; margin-top: 5px;"></div>
                                </div>
                            </div>
                        </div>
                    `;

      // Add CSS dynamically for selected state to show selects
      if (!document.getElementById("psycho-styles")) {
        const style = document.createElement("style");
        style.id = "psycho-styles";
        style.innerHTML = `
                            .psycho-card.selected .psycho-selects-container {
                                display: flex !important;
                            }
                        `;
        document.head.appendChild(style);
      }

      // Handle card click
      const handleCardClick = (e) => {
        if (e.target.tagName === "SELECT" || e.target.tagName === "OPTION")
          return;
        if (e.type === "touchstart") e.preventDefault();
        seleccionarPsychologicalBackground(bg.id);
      };
      card.addEventListener("click", handleCardClick);
      card.addEventListener("touchstart", handleCardClick, { passive: false });

      // Handle dropdown changes
      const idealSelect = card.querySelector(".psycho-ideal-select");
      idealSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        const descDiv = card.querySelector(`#psycho-ideal-desc-${bg.id}`);
        const itemData = bg.ideales.find((p) => p.nombre === val);
        if (itemData && descDiv) {
          descDiv.innerHTML = `<strong>${itemData.nombre}:</strong> ${itemData.desc}`;
          descDiv.style.display = "block";
        }
        validarPsychologicalBackground();
      });

      const vinculoSelect = card.querySelector(".psycho-vinculo-select");
      vinculoSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        const descDiv = card.querySelector(`#psycho-vinculo-desc-${bg.id}`);
        const itemData = bg.vinculos.find((p) => p.nombre === val);
        if (itemData && descDiv) {
          descDiv.innerHTML = `<strong>${itemData.nombre}:</strong> ${itemData.desc}`;
          descDiv.style.display = "block";
        }
        validarPsychologicalBackground();
      });

      const grietaSelect = card.querySelector(".psycho-grieta-select");
      grietaSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        const descDiv = card.querySelector(`#psycho-grieta-desc-${bg.id}`);
        const itemData = bg.grietas.find((p) => p.nombre === val);
        if (itemData && descDiv) {
          descDiv.innerHTML = `<strong>${itemData.nombre}:</strong> ${itemData.desc}`;
          descDiv.style.display = "block";
        }
        validarPsychologicalBackground();
      });

      psychoGridContainer.appendChild(card);
    });
  }

  function seleccionarPsychologicalBackground(id) {
    luminousState.psychologicalBackgroundId = id;

    const cards = document.querySelectorAll("#psychological-grid .psycho-card");
    cards.forEach((card) => {
      if (card.dataset.id === id) {
        card.classList.add("selected");
      } else {
        card.classList.remove("selected");
      }
    });

    const psychoGridContainer = document.getElementById("psychological-grid");
    if (id) {
      psychoGridContainer.classList.add("has-selection");
    } else {
      psychoGridContainer.classList.remove("has-selection");
    }

    validarPsychologicalBackground();
  }

  function validarPsychologicalBackground() {
    const btnConfirmarPsicologia = document.getElementById(
      "btn-confirmar-psicologia",
    );
    if (!luminousState.psychologicalBackgroundId) {
      btnConfirmarPsicologia.disabled = true;
      return;
    }

    const selectedCard = document.querySelector(
      `.psycho-card[data-id="${luminousState.psychologicalBackgroundId}"]`,
    );
    if (!selectedCard) {
      btnConfirmarPsicologia.disabled = true;
      return;
    }

    const idealSelect = selectedCard.querySelector(".psycho-ideal-select");
    const vinculoSelect = selectedCard.querySelector(".psycho-vinculo-select");
    const grietaSelect = selectedCard.querySelector(".psycho-grieta-select");

    if (!idealSelect.value || !vinculoSelect.value || !grietaSelect.value) {
      btnConfirmarPsicologia.disabled = true;
    } else {
      luminousState.psychologicalIdeal = idealSelect.value;
      luminousState.psychologicalVinculo = vinculoSelect.value;
      luminousState.psychologicalGrieta = grietaSelect.value;
      btnConfirmarPsicologia.disabled = false;
    }
  }

  function validarProfesion() {
    const btnConfirmarProfesion = document.getElementById(
      "btn-confirmar-profesion",
    );
    if (
      !luminousState.professionIds ||
      luminousState.professionIds.length === 0
    ) {
      btnConfirmarProfesion.disabled = true;
      return;
    }

    let allValid = true;
    luminousState.professionPerkIds = [];

    for (let i = 0; i < luminousState.professionIds.length; i++) {
      const profId = luminousState.professionIds[i];
      const selectedCard = document.querySelector(
        `.profession-card[data-id="${profId}"]`,
      );
      if (!selectedCard) {
        allValid = false;
        break;
      }

      const select = selectedCard.querySelector(".profession-perk-select");
      if (!select || !select.value) {
        allValid = false;
        break;
      } else {
        luminousState.professionPerkIds.push(select.value);
      }
    }

    btnConfirmarProfesion.disabled = !allValid;
  }

  const btnConfirmarProfesion = document.getElementById(
    "btn-confirmar-profesion",
  );
  if (btnConfirmarProfesion) {
    const handleConfirmProfClick = (e) => {
      if (e.type === "touchstart") e.preventDefault();
      if (btnConfirmarProfesion.disabled) return;

      // Apply profession attributes to state
      luminousState.professionIds.forEach((profId) => {
        const prof = professionsData.find((p) => p.id === profId);
        if (prof && prof.mods) {
          for (const [key, val] of Object.entries(prof.mods)) {
            luminousState.modifiers[key] =
              (luminousState.modifiers[key] || 0) + val;
          }
        }
      });

      // For now, save state locally (or send it somewhere if you want)
      localStorage.setItem("luminousState", JSON.stringify(luminousState));

      // Transition out to Phase 4
      phase3.classList.add("fade-out");
      setTimeout(() => {
        phase3.classList.add("hidden");
        phase3.classList.remove("fade-out");
        startDialogue4();
      }, 1000);
    };
    btnConfirmarProfesion.addEventListener("click", handleConfirmProfClick);
    btnConfirmarProfesion.addEventListener(
      "touchstart",
      handleConfirmProfClick,
      { passive: false },
    );
  }

  // Logic for Phase Dialogue 4
  const phaseDialogue4 = document.getElementById("phase-dialogue-4");
  const dialogueText4 = document.getElementById("dialogue-text-4");
  const phase4 = document.getElementById("phase4");

  let dialogue4Step = 0;
  let isTypingDialogue4 = false;
  let typingTimeout4;

  let dialogue4Phrases = [
    "Bien... ya tenemos tu molde.",
    "Pero todos en esta Ciudad cargan con fantasmas.",
    "Dime... ¿qué sombras te perseguían antes de llegar aquí?",
  ];

  function startDialogue4() {
    if (luminousState.activeEntity === "dothy") {
      const reaction =
        dothyResponses.profesiones[luminousState.professionIds?.[0]] ||
        "Muy bien... ya tenemos una idea clara.";
      dialogue4Phrases = [
        reaction,
        "Pero nadie escapa de su pasado, todos cargamos con algún fantasma.",
        "Cuéntame... ¿Qué sombras te acompañaban antes de llegar hasta aquí?",
      ];
    } else if (luminousState.activeEntity === "midra") {
      dialogue4Phrases = [
        "Bien... ya tenemos tu molde.",
        "Pero todos en esta Ciudad cargan con fantasmas.",
        "Dime... ¿qué sombras te perseguían antes de llegar aquí?",
      ];
    }
    phaseDialogue4.classList.remove("hidden");
    dialogue4Step = 0;
    typeDialogue4(dialogue4Phrases[dialogue4Step]);
  }

  function typeDialogue4(text) {
    if (luminousState.activeEntity === "dothy") {
      dialogueText4.className = "text-dothy";
      const glow = phaseDialogue4.querySelector(".background-glow");
      if (glow) glow.style.display = "none";
    } else if (luminousState.activeEntity === "midra") {
      dialogueText4.className = "text-midra";
      const glow = phaseDialogue4.querySelector(".background-glow");
      if (glow) glow.style.display = "none";
    } else {
      dialogueText4.className = "golden-text";
    }

    dialogueText4.innerHTML = "";
    isTypingDialogue4 = true;
    let charIndex = 0;

    function typeNext() {
      if (charIndex < text.length) {
        dialogueText4.innerHTML += text.charAt(charIndex);
        charIndex++;
        typingTimeout4 = setTimeout(typeNext, 40);
      } else {
        isTypingDialogue4 = false;
      }
    }
    typeNext();
  }

  function handleDialogue4Advance(e) {
    if (e.type === "touchstart") e.preventDefault();

    if (isTypingDialogue4) {
      clearTimeout(typingTimeout4);
      dialogueText4.innerHTML = dialogue4Phrases[dialogue4Step];
      isTypingDialogue4 = false;
    } else {
      dialogue4Step++;
      if (dialogue4Step < dialogue4Phrases.length) {
        typeDialogue4(dialogue4Phrases[dialogue4Step]);
      } else {
        // Transition to Phase 4
        phaseDialogue4.classList.add("fade-out");
        setTimeout(() => {
          phaseDialogue4.classList.add("hidden");
          phaseDialogue4.classList.remove("fade-out");
          phase4.classList.remove("hidden");
          renderPsychologicalBackgrounds();
        }, 1000);
      }
    }
  }

  phaseDialogue4.addEventListener("click", handleDialogue4Advance);
  phaseDialogue4.addEventListener("touchstart", handleDialogue4Advance, {
    passive: false,
  });

  // Phase 5 Logic
  const phaseDialogue5 = document.getElementById("phase-dialogue-5");
  const dialogueText5 = document.getElementById("dialogue-text-5");
  const phase5 = document.getElementById("phase5");

  let dialogue5Step = 0;
  let isTypingDialogue5 = false;
  let typingTimeout5;

  let dialogue5Phrases = [
    "Tu mente está lista. Tus demonios te conocen.",
    "Pero cuando la Ciudad exija sangre...",
    "¿Con qué le vas a pagar?",
  ];

  function startDialogue5() {
    if (luminousState.activeEntity === "dothy") {
      const reaction =
        dothyResponses.psicologia[luminousState.psychologicalBackgroundId] ||
        "Tu mente está despejada...";
      dialogue5Phrases = [
        reaction,
        "Ya sabes a qué te enfrentas, pero cuando llegue el momento...",
        "¿Cómo decidirás luchar?",
      ];
    } else if (luminousState.activeEntity === "midra") {
      dialogue5Phrases = [
        "Tu mente está lista. Tus demonios te conocen.",
        "Pero cuando la Ciudad exija sangre...",
        "¿Con qué le vas a pagar?",
      ];
    }
    phaseDialogue5.classList.remove("hidden");
    dialogue5Step = 0;
    typeDialogue5(dialogue5Phrases[dialogue5Step]);
  }

  function typeDialogue5(text) {
    if (luminousState.activeEntity === "dothy") {
      dialogueText5.className = "text-dothy";
      const glow = phaseDialogue5.querySelector(".background-glow");
      if (glow) glow.style.display = "none";
    } else if (luminousState.activeEntity === "midra") {
      dialogueText5.className = "text-midra";
      const glow = phaseDialogue5.querySelector(".background-glow");
      if (glow) glow.style.display = "none";
    } else {
      dialogueText5.className = "golden-text";
    }

    dialogueText5.innerHTML = "";
    isTypingDialogue5 = true;
    let charIndex = 0;

    function typeNext() {
      if (charIndex < text.length) {
        dialogueText5.innerHTML += text.charAt(charIndex);
        charIndex++;
        typingTimeout5 = setTimeout(typeNext, 40);
      } else {
        isTypingDialogue5 = false;
      }
    }
    typeNext();
  }

  function handleDialogue5Advance(e) {
    if (e.type === "touchstart") e.preventDefault();

    if (isTypingDialogue5) {
      clearTimeout(typingTimeout5);
      dialogueText5.innerHTML = dialogue5Phrases[dialogue5Step];
      isTypingDialogue5 = false;
    } else {
      dialogue5Step++;
      if (dialogue5Step < dialogue5Phrases.length) {
        typeDialogue5(dialogue5Phrases[dialogue5Step]);
      } else {
        // Transition to Phase 5
        phaseDialogue5.classList.add("fade-out");
        setTimeout(() => {
          phaseDialogue5.classList.add("hidden");
          phaseDialogue5.classList.remove("fade-out");
          phase5.classList.remove("hidden");
          renderClasses();
          renderPointBuy();
        }, 1000);
      }
    }
  }

  phaseDialogue5.addEventListener("click", handleDialogue5Advance);
  phaseDialogue5.addEventListener("touchstart", handleDialogue5Advance, {
    passive: false,
  });

  const btnConfirmarPsicologia = document.getElementById(
    "btn-confirmar-psicologia",
  );
  if (btnConfirmarPsicologia) {
    const handleConfirmPsychoClick = (e) => {
      if (e.type === "touchstart") e.preventDefault();
      if (btnConfirmarPsicologia.disabled) return;

      // Transition out to phase 5
      phase4.classList.add("fade-out");
      setTimeout(() => {
        phase4.classList.add("hidden");
        phase4.classList.remove("fade-out");

        // Begin Phase 5 dialogue transition
        const phaseDialogue5 = document.getElementById("phase-dialogue-5");
        phaseDialogue5.classList.remove("hidden");

        // We will add logic for Phase 5 here
        startDialogue5();
        startDialogue5();
      }, 1000);
    };
    btnConfirmarPsicologia.addEventListener("click", handleConfirmPsychoClick);
    btnConfirmarPsicologia.addEventListener(
      "touchstart",
      handleConfirmPsychoClick,
      { passive: false },
    );
  }

  function renderClasses() {
    const classGrid = document.getElementById("class-grid");
    if (!classGrid) return;
    classGrid.innerHTML = "";

    classesData.forEach((clase) => {
      const card = document.createElement("div");
      card.className = "origin-card class-card";
      card.dataset.id = clase.id;

      const statsText = Object.entries(clase.stats)
        .filter(([_, val]) => val > 0)
        .map(
          ([key, val]) =>
            `+${val} ${key.charAt(0).toUpperCase() + key.slice(1)}`,
        )
        .join(", ");

      card.innerHTML = `
                        <div class="card-header" style="text-align: left;">
                            <h2>${clase.name}</h2>
                            <span style="font-size: 0.8rem; color: #FFD700; font-style: italic;">Coeficiente de HP: ${clase.hpCoef}</span>
                        </div>
                        <div class="card-body" style="text-align: left; padding: 15px; display: flex; flex-direction: column; justify-content: center;">
                            <div style="font-size: 0.9rem; color: var(--green-success);"><strong>Estadísticas Base:</strong><br>${statsText}</div>
                        </div>
                    `;

      const handleCardClick = (e) => {
        if (e.type === "touchstart") e.preventDefault();
        seleccionarClase(clase.id);
      };
      card.addEventListener("click", handleCardClick);
      card.addEventListener("touchstart", handleCardClick, { passive: false });

      classGrid.appendChild(card);
    });
  }

  function seleccionarClase(id) {
    const selectedClass = classesData.find((c) => c.id === id);
    if (!selectedClass) return;

    luminousState.clase = selectedClass.name;
    luminousState.hpCoef = selectedClass.hpCoef;

    const cards = document.querySelectorAll("#class-grid .class-card");
    cards.forEach((card) => {
      if (card.dataset.id === id) {
        card.classList.add("selected");
      } else {
        card.classList.remove("selected");
      }
    });

    const classGridContainer = document.getElementById("class-grid");
    classGridContainer.classList.add("has-selection");

    validarFase5();
  }

  function renderPointBuy() {
    const skillsContainer = document.getElementById("skills-point-buy");
    const pointsCounter = document.getElementById("points-counter");
    if (!skillsContainer || !pointsCounter) return;
    skillsContainer.innerHTML = "";

    // Add grid styling specific for skills
    const skillCardStyle = `
                    background-color: var(--bg-card);
                    border: 1px solid #333;
                    border-radius: 6px;
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                `;

    const btnStyle = `
                    background: transparent;
                    color: var(--text-main);
                    border: 1px solid #444;
                    border-radius: 4px;
                    padding: 5px 10px;
                    cursor: pointer;
                    font-family: 'Share Tech Mono', monospace;
                    font-size: 14px;
                `;

    for (const [category, skills] of Object.entries(skillsTree)) {
      const sectionWrapper = document.createElement("div");

      const header = document.createElement("h3");
      header.style.cssText =
        "color: var(--cyan-tech); border-bottom: 1px solid #444; margin: 0 0 15px 0; padding-bottom: 5px;";
      header.textContent = `Rama de ${category}`;
      sectionWrapper.appendChild(header);

      const innerGrid = document.createElement("div");
      innerGrid.className = "origin-grid";
      // Override grid-template-columns inline for these specific grids, making it look dense
      innerGrid.style.gridTemplateColumns =
        "repeat(auto-fill, minmax(220px, 1fr))";
      innerGrid.style.margin = "0";
      innerGrid.style.padding = "0";
      innerGrid.style.width = "100%";

      skills.forEach((skill) => {
        const card = document.createElement("div");
        card.style.cssText = skillCardStyle;

        let baseVal = luminousState.modifiers[skill] || 0;
        let compradoVal = puntosDistribuidos[skill] || 0;
        let totalVal = baseVal + compradoVal;

        card.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: bold; font-size: 14px; color: var(--text-main);">${skill}</span>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <button class="point-btn point-minus" data-skill="${skill}" style="${btnStyle}">-</button>
                                    <span class="point-val" id="point-val-${skill}" style="font-size: 16px; color: var(--cyan-tech); width: 20px; text-align: center; display: none;">${compradoVal}</span>
                                    <button class="point-btn point-plus" data-skill="${skill}" style="${btnStyle}">+</button>
                                </div>
                            </div>
                            <span class="skill-total-display" id="skill-display-${skill}" style="font-size: 11px; color: var(--text-muted); text-align: right; margin-top: 5px;">
                                Base: +${baseVal} | Comprado: +${compradoVal} | Total: +${totalVal}
                            </span>
                        `;
        innerGrid.appendChild(card);
      });

      sectionWrapper.appendChild(innerGrid);
      skillsContainer.appendChild(sectionWrapper);
    }

    if (!skillsContainer.dataset.listenerAttached) {
      skillsContainer.dataset.listenerAttached = "true";
      skillsContainer.addEventListener("click", (e) => {
        if (e.target.classList.contains("point-minus")) {
          const skill = e.target.dataset.skill;
          if (puntosDistribuidos[skill] > 0) {
            puntosDistribuidos[skill]--;
            puntosRestantes++;
            let baseVal = luminousState.modifiers[skill] || 0;
            let compradoVal = puntosDistribuidos[skill];
            let totalVal = baseVal + compradoVal;
            document.getElementById(`skill-display-${skill}`).textContent =
              `Base: +${baseVal} | Comprado: +${compradoVal} | Total: +${totalVal}`;
            pointsCounter.textContent = puntosRestantes;
            validarFase5();
          }
        } else if (e.target.classList.contains("point-plus")) {
          const skill = e.target.dataset.skill;
          if (puntosDistribuidos[skill] < 3 && puntosRestantes > 0) {
            puntosDistribuidos[skill]++;
            puntosRestantes--;
            let baseVal = luminousState.modifiers[skill] || 0;
            let compradoVal = puntosDistribuidos[skill];
            let totalVal = baseVal + compradoVal;
            document.getElementById(`skill-display-${skill}`).textContent =
              `Base: +${baseVal} | Comprado: +${compradoVal} | Total: +${totalVal}`;
            pointsCounter.textContent = puntosRestantes;
            validarFase5();
          }
        }
      });
    }
  }

  function validarFase5() {
    const btnConfirmarClase = document.getElementById("btn-confirmar-clase");
    if (!btnConfirmarClase) return;

    if (luminousState.clase && puntosRestantes === 0) {
      btnConfirmarClase.disabled = false;
    } else {
      btnConfirmarClase.disabled = true;
    }
  }

  const btnConfirmarClase = document.getElementById("btn-confirmar-clase");
  if (btnConfirmarClase) {
    const handleConfirmClaseClick = (e) => {
      if (e.type === "touchstart") e.preventDefault();
      if (btnConfirmarClase.disabled) return;

      // 1. Add class stats to baseStats
      const selectedClassData = classesData.find(
        (c) => c.name === luminousState.clase,
      );
      if (selectedClassData && selectedClassData.stats) {
        for (const [key, val] of Object.entries(selectedClassData.stats)) {
          luminousState.baseStats[key] =
            (luminousState.baseStats[key] || 0) + val;
        }
      }

      // 2. Add distributed points to modifiers
      for (const [skill, val] of Object.entries(puntosDistribuidos)) {
        if (val > 0) {
          luminousState.modifiers[skill] =
            (luminousState.modifiers[skill] || 0) + val;
        }
      }

      // 3. Save to Firebase
      const playerId = localStorage.getItem("playerId");
      if (playerId) {
        db.ref("campaña/jugadores/" + playerId)
          .set(luminousState)
          .then(() => {
            window.location.href = "hoja_personaje.html";
          })
          .catch((err) => {
            console.error("Error saving to Firebase:", err);
            alert("Error al guardar personaje. Revisa la conexión.");
          });
      } else {
        alert("Error: No se encontró el ID de jugador. Vuelve al inicio.");
        window.location.href = "index.html";
      }
    };

    btnConfirmarClase.addEventListener("click", handleConfirmClaseClick);
    btnConfirmarClase.addEventListener("touchstart", handleConfirmClaseClick, {
      passive: false,
    });
  }
});
