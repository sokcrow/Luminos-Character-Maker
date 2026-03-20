import { db } from "../core/firebase-config.js";
// Inicializar Firebase
// LÓGICA DE CALENDARIO Y CLIMA AUTOMÁTICO
// Red Climatica Hexagonal por Meses
const redClimatica = {
  1: {
    // Frío y Seco
    Despejado: {
      Despejado: 0.6,
      Nublado: 0.2,
      "Vientos Fuertes": 0.1,
      Nieve: 0.1,
    },
    Nublado: { Despejado: 0.3, Nublado: 0.5, Nieve: 0.2 },
    "Vientos Fuertes": {
      Despejado: 0.4,
      Nublado: 0.3,
      "Vientos Huracanados": 0.1,
      "Vientos Fuertes": 0.2,
    },
    "Vientos Huracanados": { "Vientos Fuertes": 0.7, Despejado: 0.3 },
    Nieve: { Nublado: 0.4, Nieve: 0.4, "Nevada Extrema": 0.2 },
    "Nevada Extrema": { Nieve: 0.8, Nublado: 0.2 },
  },
  2: {
    // Deshielo
    Despejado: { Despejado: 0.4, Nublado: 0.3, Niebla: 0.2, Húmedo: 0.1 },
    Nublado: { Despejado: 0.3, Nublado: 0.4, Lluvia: 0.2, Niebla: 0.1 },
    Niebla: { Despejado: 0.2, Nublado: 0.2, Niebla: 0.5, "Niebla Densa": 0.1 },
    "Niebla Densa": { Niebla: 0.8, Lluvia: 0.2 },
    Húmedo: { Despejado: 0.2, Nublado: 0.4, Lluvia: 0.4 },
    Lluvia: { Nublado: 0.5, Lluvia: 0.4, Húmedo: 0.1 },
  },
  3: {
    // Lluvias Ácidas
    Despejado: { Nublado: 0.5, Húmedo: 0.5 },
    Nublado: { Despejado: 0.1, Nublado: 0.3, Húmedo: 0.3, Lluvia: 0.3 },
    Húmedo: { Nublado: 0.3, Húmedo: 0.4, Lluvia: 0.3 },
    Lluvia: { Húmedo: 0.2, Nublado: 0.3, Lluvia: 0.3, "Lluvia Ácida": 0.2 },
    "Lluvia Ácida": { Lluvia: 0.7, Tormenta: 0.3 },
    Tormenta: { Lluvia: 0.6, Nublado: 0.4 },
  },
  4: {
    // Primavera Contaminada
    Despejado: { Despejado: 0.4, Nublado: 0.3, Niebla: 0.2, Húmedo: 0.1 },
    Nublado: { Despejado: 0.3, Nublado: 0.4, Lluvia: 0.2, Niebla: 0.1 },
    Niebla: { Nublado: 0.3, Niebla: 0.5, "Niebla Densa": 0.2 },
    "Niebla Densa": { Niebla: 0.9, "Lluvia Ácida": 0.1 },
    Húmedo: { Nublado: 0.5, Lluvia: 0.5 },
    Lluvia: { Nublado: 0.6, Lluvia: 0.4 },
    "Lluvia Ácida": { Lluvia: 0.8, "Niebla Densa": 0.2 },
  },
  5: {
    // Vientos Fuertes
    Despejado: { Despejado: 0.4, Nublado: 0.2, "Vientos Fuertes": 0.4 },
    Nublado: {
      Despejado: 0.3,
      Nublado: 0.4,
      Lluvia: 0.2,
      "Vientos Fuertes": 0.1,
    },
    "Vientos Fuertes": {
      Despejado: 0.2,
      Nublado: 0.2,
      "Vientos Fuertes": 0.4,
      "Vientos Huracanados": 0.2,
    },
    "Vientos Huracanados": { "Vientos Fuertes": 0.8, Tormenta: 0.2 },
    Lluvia: { Nublado: 0.5, Lluvia: 0.3, Tormenta: 0.2 },
    Tormenta: { Lluvia: 0.6, "Vientos Huracanados": 0.4 },
  },
  6: {
    // Inicio del Calor
    Despejado: { Despejado: 0.6, Nublado: 0.2, "Ola de Calor": 0.2 },
    Nublado: { Despejado: 0.4, Nublado: 0.4, Lluvia: 0.2 },
    "Ola de Calor": { Despejado: 0.7, "Ola de Calor": 0.3 },
    Lluvia: { Nublado: 0.7, Lluvia: 0.3 },
  },
  7: {
    // Verano Sofocante
    Despejado: { Despejado: 0.5, "Ola de Calor": 0.4, Nublado: 0.1 },
    "Ola de Calor": { Despejado: 0.4, "Ola de Calor": 0.6 },
    Nublado: { Despejado: 0.6, Nublado: 0.2, Tormenta: 0.2 },
    Tormenta: { Nublado: 0.7, Despejado: 0.3 },
  },
  8: {
    // Tormentas de Verano
    Despejado: {
      Despejado: 0.3,
      Nublado: 0.3,
      "Ola de Calor": 0.2,
      Húmedo: 0.2,
    },
    "Ola de Calor": { Despejado: 0.5, Tormenta: 0.5 },
    Nublado: { Despejado: 0.2, Nublado: 0.3, Lluvia: 0.2, Tormenta: 0.3 },
    Húmedo: { Despejado: 0.2, Nublado: 0.2, Lluvia: 0.3, Tormenta: 0.3 },
    Lluvia: { Nublado: 0.3, Lluvia: 0.3, Tormenta: 0.4 },
    Tormenta: {
      Nublado: 0.2,
      Lluvia: 0.2,
      Tormenta: 0.4,
      "Tormenta Eléctrica": 0.2,
    },
    "Tormenta Eléctrica": { Tormenta: 0.8, "Lluvia Ácida": 0.2 },
    "Lluvia Ácida": { Lluvia: 0.8, Tormenta: 0.2 },
  },
  9: {
    // Otoño Húmedo
    Despejado: { Despejado: 0.3, Nublado: 0.4, Húmedo: 0.3 },
    Nublado: { Despejado: 0.2, Nublado: 0.4, Húmedo: 0.2, Lluvia: 0.2 },
    Húmedo: { Nublado: 0.3, Húmedo: 0.4, Niebla: 0.3 },
    Lluvia: { Nublado: 0.4, Lluvia: 0.4, Tormenta: 0.2 },
    Tormenta: { Lluvia: 0.7, Nublado: 0.3 },
    Niebla: { Húmedo: 0.4, Niebla: 0.4, "Niebla Densa": 0.2 },
    "Niebla Densa": { Niebla: 0.8, Lluvia: 0.2 },
  },
  10: {
    // Descenso de Temperaturas
    Despejado: { Despejado: 0.4, Nublado: 0.3, "Vientos Fuertes": 0.3 },
    Nublado: { Despejado: 0.3, Nublado: 0.4, Lluvia: 0.3 },
    Lluvia: { Nublado: 0.6, Lluvia: 0.4 },
    "Vientos Fuertes": {
      Despejado: 0.3,
      Nublado: 0.3,
      "Vientos Fuertes": 0.3,
      "Vientos Huracanados": 0.1,
    },
    "Vientos Huracanados": { "Vientos Fuertes": 0.9, Tormenta: 0.1 },
    Tormenta: { Lluvia: 0.8, "Vientos Fuertes": 0.2 },
  },
  11: {
    // Vientos Helados
    Despejado: {
      Despejado: 0.5,
      Nublado: 0.2,
      "Vientos Fuertes": 0.2,
      Nieve: 0.1,
    },
    Nublado: { Despejado: 0.3, Nublado: 0.4, Nieve: 0.3 },
    "Vientos Fuertes": {
      Despejado: 0.4,
      Nublado: 0.3,
      "Vientos Huracanados": 0.2,
      Nieve: 0.1,
    },
    "Vientos Huracanados": { "Vientos Fuertes": 0.8, "Nevada Extrema": 0.2 },
    Nieve: { Nublado: 0.4, Nieve: 0.4, "Nevada Extrema": 0.2 },
    "Nevada Extrema": { Nieve: 0.7, "Vientos Huracanados": 0.3 },
  },
  12: {
    // Invierno Crudo
    Despejado: { Nublado: 0.4, Nieve: 0.4, "Vientos Fuertes": 0.2 },
    Nublado: { Despejado: 0.1, Nublado: 0.3, Nieve: 0.6 },
    Nieve: { Nublado: 0.3, Nieve: 0.5, "Nevada Extrema": 0.2 },
    "Nevada Extrema": { Nieve: 0.8, "Vientos Huracanados": 0.2 },
    "Vientos Fuertes": { Nublado: 0.4, Nieve: 0.4, "Vientos Huracanados": 0.2 },
    "Vientos Huracanados": { "Vientos Fuertes": 0.5, "Nevada Extrema": 0.5 },
  },
};

const climaIconos = {
  Despejado: "☀️",
  Nublado: "☁️",
  Húmedo: "💧",
  Lluvia: "🌧️",
  "Lluvia Ácida": "☣️",
  Tormenta: "⛈️",
  "Tormenta Eléctrica": "🌩️",
  Niebla: "🌫️",
  "Niebla Densa": "🌁",
  "Ola de Calor": "🔥",
  Nieve: "❄️",
  "Nevada Extrema": "🏔️",
  "Vientos Fuertes": "💨",
  "Vientos Huracanados": "🌪️",
};

let currentHora = "12:00";
let currentCalendario = { año: 984, mes: 1, dia: 1, clima: "Despejado" };

function updateUI() {
  const dias = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  const fecha = new Date(
    currentCalendario.año,
    currentCalendario.mes - 1,
    currentCalendario.dia,
  );
  const diaSemana = dias[fecha.getDay()];

  const timeDisplay = document.querySelector(".sheet-time-display");
  if (timeDisplay) {
    timeDisplay.innerText = `${currentHora} | ${diaSemana}`;
  }

  const dateDisplay = document.querySelector(".sheet-date-display");
  if (dateDisplay) {
    dateDisplay.innerText = "";
  }

  const widgetTime = document.querySelector(".sheet-widget-time");
  if (widgetTime) {
    widgetTime.innerText = currentHora;
  }

  const widgetDate = document.querySelector(".sheet-widget-date");
  if (widgetDate) {
    const diaStr = String(currentCalendario.dia).padStart(2, "0");
    const mesStr = String(currentCalendario.mes).padStart(2, "0");
    widgetDate.innerText = `${diaStr}/${mesStr}/${currentCalendario.año}`;
  }
}

// Referencia al nodo de la hora en la base de datos
const timeRef = db.ref("campaña/hora_actual");

// Escuchar cambios en tiempo real (equivalente a onValue en v8)
timeRef.on("value", (snapshot) => {
  const horaActual = snapshot.val();
  if (horaActual) {
    currentHora = horaActual;
    updateUI();
  }
});

db.ref("campaña/calendario").on("value", (snapshot) => {
  const data = snapshot.val();
  if (data) {
    currentCalendario.año = data.año || 984;
    currentCalendario.dia = data.dia || 1;
    currentCalendario.mes = data.mes || 1;
    currentCalendario.clima = data.clima || "Despejado";

    updateUI();

    const climaNodo = currentCalendario.clima;
    const mes = currentCalendario.mes;
    const iconoClima = climaIconos[climaNodo] || "☀️";

    // Update Widget Current Weather
    const widgetWeatherIcon = document.querySelector(
      ".sheet-widget-weather-icon",
    );
    const widgetWeatherText = document.querySelector(
      ".sheet-widget-weather-text",
    );
    if (widgetWeatherIcon && widgetWeatherText) {
      widgetWeatherIcon.innerText = iconoClima;
      widgetWeatherText.innerText = climaNodo;
    }

    // Update Widget Forecast Probabilities
    if (redClimatica[mes] && redClimatica[mes][climaNodo]) {
      const transiciones = redClimatica[mes][climaNodo];
      const probsContainer = document.getElementById("dynamic-forecast-probs");

      if (probsContainer) {
        probsContainer.innerHTML = ""; // Limpiar anteriores

        for (const [nodoSiguiente, prob] of Object.entries(transiciones)) {
          const probPct = Math.round(prob * 100);
          const icono = climaIconos[nodoSiguiente] || "☀️";
          const span = document.createElement("span");
          span.innerText = `${icono} ${probPct}%`;

          // Highlight extreme nodes (Hazards) with a slightly different color if desired
          if (
            probPct < 30 &&
            [
              "Lluvia Ácida",
              "Tormenta Eléctrica",
              "Niebla Densa",
              "Ola de Calor",
              "Nevada Extrema",
              "Vientos Huracanados",
            ].includes(nodoSiguiente)
          ) {
            span.style.color = "var(--red-neon)";
            span.style.textShadow = "0 0 5px var(--red-neon)";
          }

          probsContainer.appendChild(span);
        }
      }
    } else {
      // Fallback clear
      const probsContainer = document.getElementById("dynamic-forecast-probs");
      if (probsContainer) probsContainer.innerHTML = "<span>Sin datos</span>";
    }
  }
});

function obtenerTiempoRelativo(timestamp) {
  const ahora = Date.now();
  const diffMilisegundos = ahora - timestamp;
  const diffDias = Math.floor(diffMilisegundos / (1000 * 60 * 60 * 24));

  if (diffDias === 0) return "Hoy";
  if (diffDias === 1) return "Ayer";
  return `Hace ${diffDias} días`;
}

// --- LÓGICA DE BLOQUEO DE ALIJO ---
window.isStashUnlocked = false; // Default blocked
db.ref("campaña/ajustes_globales/alijo_desbloqueado").on("value", (snap) => {
  window.isStashUnlocked = snap.val() === true;

  const stashContainer = document.getElementById("inv-stash");
  if (stashContainer) {
    if (window.isStashUnlocked) {
      stashContainer.style.filter = "none";
      stashContainer.style.opacity = "1";
    } else {
      stashContainer.style.filter = "grayscale(1)";
      stashContainer.style.opacity = "0.6";
    }
  }

  // Refresh detail card button state if a stash item is currently being viewed
  const detailCard = document.getElementById("item-detail-card");
  if (detailCard && detailCard.classList.contains("active")) {
    // A bit hacky, but clicking the currently active slot again re-renders the card
    const activeSlot = document.querySelector(".item-slot.active");
    if (activeSlot) {
      activeSlot.click();
    }
  }
});

// --- LÓGICA DEL TEATRO DE LA MENTE (PLAYER VIEW) ---
let isTheatreBlocked = false;
let currentAssignedActor = null;
let playerSpritesEnEscena = new Set();
let currentMaxSprites = 4;

db.ref("campaña/teatro/max_sprites").on("value", (snap) => {
  const val = snap.val();
  if (val) {
    currentMaxSprites = parseInt(val) || 4;
  }
});

// Listen to active state
db.ref("campaña/teatro/activo").on("value", (snap) => {
  const isActivo = snap.val();
  const theatreView = document.getElementById("theatre-view-player");
  if (theatreView) {
    if (isActivo) {
      theatreView.classList.add("theatre-active");
    } else {
      theatreView.classList.remove("theatre-active");
    }
  }
});

// --- LÓGICA BOTÓN COLLAPSE CONTROLES MÓVIL JUGADOR ---
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtnPlayer = document.getElementById(
    "btn-toggle-player-theatre-tools",
  );
  if (toggleBtnPlayer) {
    toggleBtnPlayer.addEventListener("click", function () {
      const wrapper = document.getElementById("player-theatre-tools-wrapper");
      if (wrapper) {
        wrapper.classList.toggle("open");
        this.innerText = wrapper.classList.contains("open")
          ? "▼ Ocultar Chat y Opciones"
          : "💬 Mostrar Chat y Opciones";
      }
    });
  }

  const logToggleBtnPlayer = document.getElementById(
    "btn-toggle-theatre-log-player",
  );
  if (logToggleBtnPlayer) {
    logToggleBtnPlayer.addEventListener("click", function () {
      // The theatre log is typically unique per view or shared if same DOM.
      // In this file, there is a '#theatre-log-container' for the player view.
      const logContainer = document.getElementById("theatre-log-container");
      if (logContainer) {
        logContainer.classList.toggle("open");
        const logIcon = this.querySelector(".log-icon-doc");
        const closeIcon = this.querySelector(".log-icon-close");
        if (logContainer.classList.contains("open")) {
          if (logIcon) logIcon.style.display = "none";
          if (closeIcon) closeIcon.style.display = "block";
        } else {
          if (logIcon) logIcon.style.display = "block";
          if (closeIcon) closeIcon.style.display = "none";
        }
      }
    });
  }
});

// Listen to block state
db.ref("campaña/teatro/bloqueado").on("value", (snap) => {
  isTheatreBlocked = snap.val();
  const input = document.getElementById("player-theatre-input");
  const btn = document.getElementById("btn-player-theatre-send");
  if (input && btn) {
    if (isTheatreBlocked) {
      input.disabled = true;
      btn.disabled = true;
      input.placeholder =
        "El Director ha bloqueado las interacciones (Modo Lore)...";
    } else {
      input.disabled = false;
      btn.disabled = false;
      input.placeholder = "¿Qué quieres decir o hacer? (Escribe aquí...)";
    }
  }
});

// Listen to location
db.ref("campaña/teatro/locacion").on("value", (snap) => {
  const loc = snap.val();
  const locText = document.getElementById("player-theatre-location-text");
  if (locText && loc) locText.innerText = loc;
});

// Listen to background
db.ref("campaña/teatro/fondo").on("value", (snap) => {
  const bg = snap.val();
  const view = document.getElementById("theatre-view-player");
  if (view && bg) view.style.backgroundImage = `url('${bg}')`;
});

// Listen to log
db.ref("campaña/teatro/log")
  .limitToLast(20)
  .on("value", (snap) => {
    const logContainer = document.getElementById("theatre-log-container");
    if (!logContainer) return;
    logContainer.innerHTML = "";
    const logs = snap.val();
    if (logs) {
      for (const [key, msg] of Object.entries(logs)) {
        const item = document.createElement("div");
        item.style.marginBottom = "4px";
        item.innerHTML = `<strong style="color: ${msg.color_nombre || "#fff"}">${msg.nombre}:</strong> ${msg.mensaje}`;
        logContainer.appendChild(item);
      }
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  });

// Listen to current state (the actual dialogue and sprites)
db.ref("campaña/teatro/estado_actual").on("value", (snap) => {
  const state = snap.val();
  if (!state) return;

  const titlePlate = document.getElementById("player-theatre-plate-title");
  const namePlate = document.getElementById("player-theatre-plate-name");
  const textBox = document.getElementById("player-theatre-dialogue-text");

  const platesContainer = document.querySelector(".theatre-plates-container");
  if (platesContainer) {
    if (!state.nombre || state.nombre.trim() === "") {
      platesContainer.style.display = "none";
    } else {
      platesContainer.style.display = "flex";
    }
  }

  if (titlePlate) {
    const spanElement = titlePlate.querySelector("span");
    if (spanElement) {
      spanElement.innerText = state.titulo || "";
    }
    /* The title plate color requirement was: background dark brown, text gold.
           If the user wants the custom color to apply to text: */
    titlePlate.style.color = state.color_titulo || "#d69c52";
    titlePlate.style.borderColor = state.color_titulo || "#c49a00";
  }

  if (namePlate) {
    namePlate.innerText = state.nombre || "Desconocido";
    namePlate.style.backgroundColor = state.color_nombre || "#416268";
    namePlate.style.color = "#ffffff";
  }

  if (textBox) {
    if (textBox.typewriterInterval) {
      clearInterval(textBox.typewriterInterval);
    }
    textBox.textContent = "";
    const fullText = state.mensaje || "";
    let charIndex = 0;
    if (fullText.length > 0) {
      textBox.typewriterInterval = setInterval(() => {
        textBox.textContent += fullText.charAt(charIndex);
        charIndex++;
        if (charIndex >= fullText.length) {
          clearInterval(textBox.typewriterInterval);
          textBox.typewriterInterval = null;
        }
      }, 30); // 30ms per character
    }
  }

  const stage = document.getElementById("player-theatre-stage");
  if (!stage) return;

  const activeSpriteUrl = state.sprite;
  const activeName = state.nombre || "Desconocido";
  const actorEscala = state.escala !== undefined ? state.escala : 1.0;

  if (!activeSpriteUrl || activeSpriteUrl.trim() === "") {
    // Narrator mode: dim all existing sprites and return
    Array.from(stage.children).forEach((wrapper) => {
      let img = wrapper.querySelector("img");
      if (img) {
        img.className = "sprite-dimmed";
        img.style.filter = "brightness(0.4) grayscale(0.5)";
        img.style.transform = "translateX(-50%) scale(0.95)";
      }
    });
    return;
  }

  let existingWrapper = Array.from(stage.children).find(
    (wrapper) => wrapper.dataset.name === activeName,
  );

  if (existingWrapper) {
    let img = existingWrapper.querySelector("img");
    img.src = activeSpriteUrl;
    existingWrapper.dataset.url = activeSpriteUrl;
    existingWrapper.dataset.lastActive = Date.now();
    img.style.height = `calc(100vh * ${actorEscala})`;
  } else {
    playerSpritesEnEscena.add(activeName);
    const wrapper = document.createElement("div");
    wrapper.className = "sprite-wrapper";
    wrapper.dataset.url = activeSpriteUrl;
    wrapper.dataset.name = activeName;
    wrapper.dataset.lastActive = Date.now();

    const img = document.createElement("img");
    img.src = activeSpriteUrl;
    img.style.cssText = `height: calc(100vh * ${actorEscala}); object-fit: contain; transition: all 0.4s ease;`;

    wrapper.appendChild(img);
    stage.appendChild(wrapper);

    while (stage.children.length > currentMaxSprites) {
      let oldestWrapper = Array.from(stage.children).reduce(
        (oldest, current) => {
          let oldestTime = parseInt(oldest.dataset.lastActive || 0);
          let currentTime = parseInt(current.dataset.lastActive || 0);
          return oldestTime < currentTime ? oldest : current;
        },
      );
      if (oldestWrapper) {
        playerSpritesEnEscena.delete(oldestWrapper.dataset.name);
        stage.removeChild(oldestWrapper);
      } else {
        break;
      }
    }
  }

  Array.from(stage.children).forEach((wrapper) => {
    let img = wrapper.querySelector("img");
    if (
      wrapper.dataset.name === activeName &&
      wrapper.dataset.url === activeSpriteUrl
    ) {
      img.className = "sprite-active";
      img.style.filter = "none"; // Ensure no dimming
      img.style.transform = "translateX(-50%) scale(1)";
    } else {
      img.className = "sprite-dimmed";
      img.style.filter = "brightness(0.4) grayscale(0.5)";
      img.style.transform = "translateX(-50%) scale(0.95)";
    }
  });
});
