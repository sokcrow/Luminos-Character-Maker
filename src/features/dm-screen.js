import { db } from "../core/firebase-config.js";
// Inicializar Firebase
// --- LÓGICA BOTÓN COLLAPSE CONTROLES MÓVIL ---
document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("btn-toggle-dm-tools");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      const wrapper = document.getElementById("dm-tools-wrapper");
      wrapper.classList.toggle("open");
      this.innerText = wrapper.classList.contains("open")
        ? "▼ Ocultar Controles DM"
        : "🛠️ Mostrar Controles DM";
    });
  }

  const logToggleBtn = document.getElementById("btn-toggle-theatre-log");
  if (logToggleBtn) {
    logToggleBtn.addEventListener("click", function () {
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

// --- LÓGICA DE TABS MODO DIRECTOR ---
document.querySelectorAll(".dm-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.id === "btn-modo-director") return;

    // Remove active class from all buttons and panes
    document
      .querySelectorAll(".dm-tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".dm-tab-pane")
      .forEach((p) => p.classList.remove("active"));

    // Add active class to clicked button and target pane
    btn.classList.add("active");
    const targetPane = document.getElementById(btn.dataset.tab);
    if (targetPane) targetPane.classList.add("active");
  });
});

document.getElementById("btn-modo-director").addEventListener("click", () => {
  document.querySelector(".dm-tabs-nav").style.display = "none";
  document.querySelector(".dm-tabs-content").style.display = "none";

  const theatreView = document.getElementById("theatre-view-dm");
  if (theatreView) {
    theatreView.style.display = "flex";
  }
});

// --- LÓGICA DE CALENDARIO Y CLIMA AUTOMÁTICO ---

// Días por mes (Año con meses variados)
const diasPorMes = {
  1: 31,
  2: 28,
  3: 31,
  4: 30,
  5: 31,
  6: 30,
  7: 31,
  8: 31,
  9: 30,
  10: 31,
  11: 30,
  12: 31,
};

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

function calcularSiguienteClima(climaActual, mesActual) {
  // Fallback si el clima actual no existe en el mes nuevo por un salto raro
  let transiciones = redClimatica[mesActual][climaActual];
  if (!transiciones) {
    // Tomar un clima al azar del mes o Despejado
    const climasDisponibles = Object.keys(redClimatica[mesActual]);
    transiciones = redClimatica[mesActual][climasDisponibles[0]];
  }

  const rand = Math.random();
  let sum = 0;
  for (const [siguiente, prob] of Object.entries(transiciones)) {
    sum += prob;
    if (rand <= sum) {
      return siguiente;
    }
  }
  return Object.keys(transiciones)[0]; // Fallback
}

let estadoActual = {
  año: 984,
  dia: 1,
  mes: 1,
  clima: "Despejado",
};

// Escuchar el estado actual desde Firebase para inicializar las variables locales
db.ref("campaña/calendario").on("value", (snapshot) => {
  const data = snapshot.val();
  if (data) {
    estadoActual.año = data.año || 984;
    estadoActual.dia = data.dia || 1;
    estadoActual.mes = data.mes || 1;
    estadoActual.clima = data.clima || "Despejado";

    // Actualizar UI
    document.getElementById("lbl-auto-fecha").innerText =
      `Año ${estadoActual.año} / Mes ${estadoActual.mes} / Día ${estadoActual.dia}`;
    document.getElementById("lbl-auto-clima").innerText = estadoActual.clima;

    document.getElementById("debug-año").value = estadoActual.año;
    document.getElementById("debug-dia").value = estadoActual.dia;
    document.getElementById("debug-mes").value = estadoActual.mes;
    document.getElementById("debug-clima").value = estadoActual.clima;

    // Inyectar/actualizar radial de clima
    if (typeof renderClimaRadial === "function") {
      renderClimaRadial(estadoActual.clima, estadoActual.mes);
    }
  }
});

document.getElementById("btn-fijar-hora").addEventListener("click", () => {
  const newTime = document.getElementById("dm-time-input").value;

  if (newTime) {
    // Guardar (set) el valor en el nodo de Firebase
    db.ref("campaña/hora_actual")
      .set(newTime)
      .then(() => {
        console.log("Hora global actualizada a:", newTime);
        alert("Hora fijada a: " + newTime);
      })
      .catch((error) => {
        console.error("Error al actualizar la hora:", error);
        alert("Error al fijar la hora.");
      });
  }
});

document.getElementById("btn-avanzar-hora").addEventListener("click", () => {
  const currentTime = document.getElementById("dm-time-input").value;

  if (currentTime) {
    let [hours, minutes] = currentTime.split(":").map(Number);

    // Random amount between 5 and 10 minutes
    const minutesToAdd = Math.floor(Math.random() * (10 - 5 + 1)) + 5;

    minutes += minutesToAdd;

    if (minutes >= 60) {
      minutes -= 60;
      hours = (hours + 1) % 24;
    }

    const newTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    document.getElementById("dm-time-input").value = newTime;

    db.ref("campaña/hora_actual")
      .set(newTime)
      .then(() => {
        console.log("Hora global avanzada a:", newTime);
      })
      .catch((error) => {
        console.error("Error al actualizar la hora:", error);
        alert("Error al avanzar la hora.");
      });
  } else {
    alert("Por favor, ingresa o carga una hora inicial en el Reloj Global.");
  }
});

document.getElementById("btn-avanzar-dia").addEventListener("click", () => {
  let nuevoAño = estadoActual.año;
  let nuevoMes = estadoActual.mes;
  let nuevoDia = estadoActual.dia + 1;

  const diasMesActual = diasPorMes[nuevoMes] || 30;

  if (nuevoDia > diasMesActual) {
    nuevoDia = 1;
    nuevoMes++;
    if (nuevoMes > 12) {
      nuevoMes = 1; // Un año nuevo
      nuevoAño++;
    }
  }

  const nuevoClima = calcularSiguienteClima(estadoActual.clima, nuevoMes);

  const nuevoEstado = {
    año: nuevoAño,
    dia: nuevoDia,
    mes: nuevoMes,
    clima: nuevoClima,
  };

  db.ref("campaña/calendario")
    .set(nuevoEstado)
    .then(() => {
      console.log("Calendario (Auto) actualizado:", nuevoEstado);

      // Lógica de Auto-Restock de tiendas
      const diasSemana = [
        "Domingo",
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
      ];
      // JS Date usa meses 0-11
      const fechaJS = new Date(nuevoAño, nuevoMes - 1, nuevoDia);
      const nuevoDiaSemana = diasSemana[fechaJS.getDay()];

      db.ref("campaña/tiendas")
        .once("value")
        .then((snapshot) => {
          const tiendas = snapshot.val();
          if (tiendas) {
            const updates = {};
            for (const [idTienda, tiendaData] of Object.entries(tiendas)) {
              if (
                tiendaData.dia_restock === nuevoDiaSemana &&
                tiendaData.items
              ) {
                for (const [idItem, itemData] of Object.entries(
                  tiendaData.items,
                )) {
                  if (itemData.stock_maximo !== -1) {
                    updates[`${idTienda}/items/${idItem}/stock_actual`] =
                      itemData.stock_maximo;
                  }
                }
              }
            }
            if (Object.keys(updates).length > 0) {
              db.ref("campaña/tiendas")
                .update(updates)
                .then(() =>
                  console.log(
                    "Restock de tiendas completado para el día:",
                    nuevoDiaSemana,
                  ),
                )
                .catch((e) => console.error("Error en restock:", e));
            }
          }
        });
    })
    .catch((error) => {
      console.error("Error al actualizar calendario (Auto):", error);
      alert("Error al actualizar calendario.");
    });
});

document.getElementById("btn-forzar-estado").addEventListener("click", () => {
  const debugAño = parseInt(document.getElementById("debug-año").value) || 984;
  const debugDia = parseInt(document.getElementById("debug-dia").value) || 1;
  const debugMes = parseInt(document.getElementById("debug-mes").value) || 1;
  const debugClima =
    document.getElementById("debug-clima").value || "Despejado";

  const estadoForzado = {
    año: debugAño,
    dia: debugDia,
    mes: debugMes,
    clima: debugClima,
  };

  db.ref("campaña/calendario")
    .set(estadoForzado)
    .then(() => {
      console.log("Calendario (Debug) actualizado:", estadoForzado);
      alert("Estado del calendario forzado con éxito.");
    })
    .catch((error) => {
      console.error("Error al forzar calendario:", error);
      alert("Error al forzar calendario.");
    });
});

// --- NUEVA LÓGICA DE METEOROLOGÍA Y CLIMA ---
document.getElementById("btn-guardar-clima").addEventListener("click", () => {
  const nombre = document.getElementById("clima-nombre").value.trim();
  const desc = document.getElementById("clima-desc").value.trim();
  const efectos = document.getElementById("clima-efectos").value.trim();
  const estacion = document.getElementById("clima-estacion").value;
  const esHazard = document.getElementById("clima-hazard").checked;
  const peso = parseFloat(document.getElementById("clima-peso").value) || 0;

  if (!nombre) {
    alert("El nombre del clima es obligatorio.");
    return;
  }

  const idClima = nombre.toLowerCase().replace(/[^a-z0-9]/g, "_");

  db.ref(`campaña/climas_info/${idClima}`)
    .set({
      nombre: nombre,
      descripcion: desc,
      efectos: efectos,
      estacion: estacion,
      es_hazard: esHazard,
      peso: peso,
    })
    .then(() => {
      alert("Clima guardado exitosamente.");
      document.getElementById("clima-nombre").value = "";
      document.getElementById("clima-desc").value = "";
      document.getElementById("clima-efectos").value = "";
      document.getElementById("clima-hazard").checked = false;
      document.getElementById("clima-peso").value = "";
    })
    .catch((err) => {
      alert("Error guardando clima: " + err);
    });
});

// Helper: Actualizar Visualizador Radial
function renderClimaRadial(climaActual, mesActual) {
  const container = document.getElementById("clima-radial-container");
  if (!container) return;

  const estacionActual = obtenerEstacion(mesActual);

  // Fetch weathers from Firebase to calculate probabilities dynamically
  db.ref("campaña/climas_info")
    .once("value")
    .then((snapshot) => {
      const climas = snapshot.val();
      container.innerHTML = ""; // Limpiar

      // Centro: Clima Actual y Estación
      const centro = document.createElement("div");
      centro.style.cssText =
        "position: absolute; z-index: 10; background: #222; border: 2px solid #c49a00; border-radius: 50%; padding: 15px; text-align: center; box-shadow: 0 0 15px rgba(196,154,0,0.5); display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100px; height: 100px;";
      centro.innerHTML = `<strong style="color:#0df; font-size:1.1em;">${climaActual}</strong><span style="font-size:0.8em; color:#aaa;">${estacionActual} (Mes ${mesActual})</span>`;
      container.appendChild(centro);

      if (!climas) {
        const errorText = document.createElement("div");
        errorText.style.cssText =
          "position: absolute; bottom: -30px; color: #ff4444;";
        errorText.innerText = "No hay climas creados en BD.";
        container.appendChild(errorText);
        return;
      }

      // Filtrar climas por estación y calcular suma de pesos
      let sumaPesos = 0;
      const climasPosibles = [];

      for (const [idClima, data] of Object.entries(climas)) {
        if (data.estacion === "Todas" || data.estacion === estacionActual) {
          climasPosibles.push(data);
          sumaPesos += data.peso;
        }
      }

      if (climasPosibles.length === 0 || sumaPesos === 0) {
        const errorText = document.createElement("div");
        errorText.style.cssText =
          "position: absolute; bottom: -30px; color: #ff4444;";
        errorText.innerText = "Sin climas para esta estación.";
        container.appendChild(errorText);
        return;
      }

      const totalNodos = climasPosibles.length;
      const radio = 110; // Distancia desde el centro

      climasPosibles.forEach((data, i) => {
        const probPct = Math.round((data.peso / sumaPesos) * 100);
        const angulo = (i / totalNodos) * (2 * Math.PI) - Math.PI / 2; // Empezar desde arriba (-90deg)

        const posX = Math.cos(angulo) * radio;
        const posY = Math.sin(angulo) * radio;

        const orbital = document.createElement("div");
        orbital.style.cssText = `
                    position: absolute;
                    left: calc(50% + ${posX}px - 40px);
                    top: calc(50% + ${posY}px - 25px);
                    width: 80px;
                    background: #111;
                    border: 1px solid #0df;
                    border-radius: 6px;
                    padding: 5px;
                    text-align: center;
                    box-shadow: 0 0 10px rgba(0,221,255,0.3);
                    font-size: 0.85em;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                `;

        if (data.es_hazard) {
          orbital.style.borderColor = "#ff4444";
          orbital.style.boxShadow = "0 0 10px rgba(255,68,68,0.5)";
          orbital.innerHTML = `<strong style="color:#ff4444;">${data.nombre}</strong><span style="color:#fff;">${probPct}%</span>`;
        } else {
          orbital.innerHTML = `<strong style="color:#fff;">${data.nombre}</strong><span style="color:#0df;">${probPct}%</span>`;
        }

        container.appendChild(orbital);
      });
    });
}

// --- ZONA A: RED BANCARIA ---
const bancoContainer = document.getElementById("banco-jugadores-container");
const jugadoresContainer = document.getElementById("grid-jugadores");

db.ref("campaña/jugadores/").on("value", (snapshot) => {
  bancoContainer.innerHTML = "";
  const jugadores = snapshot.val();
  window.jugadoresData = jugadores; // Guarda para el modal
  // Remove cards for players that no longer exist
  if (jugadoresContainer) {
    const currentNames = Object.keys(jugadores || {});
    const existingCards = jugadoresContainer.querySelectorAll(
      '[id^="player-card-"]',
    );
    existingCards.forEach((card) => {
      const cardName = card.id.replace("player-card-", "");
      if (!currentNames.includes(cardName)) {
        card.remove();
      }
    });
  }

  if (jugadores) {
    for (const [nombre, data] of Object.entries(jugadores)) {
      // --- Populate Gestión de Jugadores ---
      if (jugadoresContainer) {
        // Check if card already exists
        let pCard = document.getElementById(`player-card-${nombre}`);

        const perfil = data.perfil || {};
        const lvl = data.level || perfil.level || 1;
        const xp = data.xp || perfil.xp || 0;

        const combatStats = data.combatStats || {};
        const hpBase =
          combatStats.hp_base || data.hp_base || perfil.hp_base || 0;
        const hpCoef = combatStats.hp_coefficient || data.hp_coefficient || 0;
        const defLvlMod = combatStats.def_lvl_mod || 0;
        const totalDefLvl = lvl + defLvlMod;
        const hpMax =
          combatStats.hp_max ||
          data.hp_max ||
          perfil.hp_max ||
          Math.floor(hpBase + totalDefLvl * hpCoef) ||
          0;
        const hpActual =
          combatStats.hp_actual !== undefined ? combatStats.hp_actual : hpMax;

        const clase = data.class || perfil.clase || "Desconocida";
        const raza = data.race || perfil.raza || "Desconocida";

        if (!pCard) {
          pCard = document.createElement("div");
          pCard.id = `player-card-${nombre}`;
          pCard.style.cssText =
            "background: #0a0a0a; padding: 10px; border-radius: 0; border: 1px solid #0df; display: flex; flex-direction: column; gap: 10px; width: 300px; position: relative; box-shadow: 0 0 10px rgba(139, 0, 0, 0.4);";

          pCard.innerHTML = `
                      <h4 style="margin: 0; color: #0df; font-family: 'BebasKai', sans-serif; text-align: center; border-bottom: 1px solid #333; padding-bottom: 5px;">${nombre}</h4>
                      <div class="player-subinfo" style="font-size: 0.85em; color: #aaa; text-align: center; margin-bottom: 5px;">${clase} | ${raza}</div>
                      <div style="text-align:center; color:#FFD700; font-weight:bold; margin-bottom: 10px;"><span class="currency-symbol">₳</span> <span class="player-ahn">${data.ahn || 0}</span></div>

                      <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between; margin-bottom: 5px;">
                          <input type="text" class="dm-edit-name" value="${data.characterName || ""}" placeholder="Nombre Personaje" style="flex: 1; padding:4px; background:#111; color:#0df; border:1px solid #0df; border-radius:3px; text-align:center; font-family:'BebasKai', sans-serif;">
                          <button class="btn-save-name" data-id="${nombre}" style="background: #222; color: #0df; border: 1px solid #0df; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-weight: bold; transition: all 0.2s; font-size:12px;">Guardar Nombre</button>
                      </div>

                      <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 5px;">
                          <div style="display: flex; flex-direction: column; width: 50%;">
                              <label style="color:#c49a00; font-size:12px;">Level:</label>
                              <span class="player-lvl" style="color: #fff; font-weight: bold;">${lvl}</span>
                          </div>
                          <div style="display: flex; flex-direction: column; width: 50%;">
                              <label style="color:#c49a00; font-size:12px;">XP:</label>
                              <span class="player-xp" style="color: #fff; font-weight: bold;">${xp}</span>
                          </div>
                      </div>

                      <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 10px;">
                          <div style="display: flex; flex-direction: column; width: 50%;">
                              <label style="color:#c49a00; font-size:12px;">HP:</label>
                              <span style="color: #ff4444; font-weight: bold;"><span class="player-hp-actual">${hpActual}</span> / <span class="player-hp-max">${hpMax}</span></span>
                          </div>
                          <div style="display: flex; flex-direction: column; width: 50%;">
                              <label style="color:#c49a00; font-size:12px;">SP:</label>
                              <span class="player-sp" style="color: #00ddff; font-weight: bold;">${combatStats.sp_actual || 0}</span>
                          </div>
                      </div>

                      <button class="btn-cyber btn-open-modal" data-id="${nombre}" style="margin-top: 5px; background: #8b0000; color: white; border: 1px solid #ff4444; padding: 8px; border-radius: 3px; cursor: pointer; font-weight: bold; transition: all 0.2s; font-family: 'BebasKai', sans-serif;">⚙️ Editar Stats de Combate</button>
                      <button class="btn-ver-inventario" data-player="${nombre}" style="margin-top: 5px; background: #222; color: #0df; border: 1px solid #0df; padding: 8px; border-radius: 3px; cursor: pointer; font-weight: bold; transition: all 0.2s;">Ver Inventario</button>
                  `;

          const btnGuardarNombre = pCard.querySelector(".btn-save-name");
          const inputNombre = pCard.querySelector(".dm-edit-name");

          btnGuardarNombre.onclick = () => {
            const nuevoNombre = inputNombre.value;
            db.ref(`campaña/jugadores/${nombre}`)
              .update({ characterName: nuevoNombre })
              .then(() => {
                const oldText = btnGuardarNombre.innerText;
                btnGuardarNombre.innerText = "¡Guardado!";
                btnGuardarNombre.style.background = "#0df";
                btnGuardarNombre.style.color = "#000";
                setTimeout(() => {
                  btnGuardarNombre.innerText = oldText;
                  btnGuardarNombre.style.background = "#222";
                  btnGuardarNombre.style.color = "#0df";
                }, 1000);
              })
              .catch((e) => console.error("Error al actualizar nombre:", e));
          };

          jugadoresContainer.appendChild(pCard);
        } else {
          // Update existing card ONLY if the inputs are not actively being focused/edited
          const subInfo = pCard.querySelector(".player-subinfo");
          const nameInput = pCard.querySelector(".dm-edit-name");

          if (nameInput && document.activeElement !== nameInput)
            nameInput.value = data.characterName || "";
          subInfo.innerText = `${clase} | ${raza}`;

          const ahnDisplay = pCard.querySelector(".player-ahn");
          if (ahnDisplay) ahnDisplay.innerText = data.ahn || 0;

          const lvlDisplay = pCard.querySelector(".player-lvl");
          if (lvlDisplay) lvlDisplay.innerText = lvl;

          const xpDisplay = pCard.querySelector(".player-xp");
          if (xpDisplay) xpDisplay.innerText = xp;

          const hpActualDisplay = pCard.querySelector(".player-hp-actual");
          if (hpActualDisplay) hpActualDisplay.innerText = hpActual;

          const hpMaxDisplay = pCard.querySelector(".player-hp-max");
          if (hpMaxDisplay) hpMaxDisplay.innerText = hpMax;

          const spDisplay = pCard.querySelector(".player-sp");
          if (spDisplay) spDisplay.innerText = combatStats.sp_actual || 0;
        }
      }
      const tarjeta = document.createElement("div");
      tarjeta.style.cssText =
        "background: #222; padding: 15px; border-radius: 6px; border: 1px solid #444; display: flex; flex-direction: column; align-items: center; gap: 10px; width: 200px; position: relative;";

      const btnEliminar = document.createElement("button");
      btnEliminar.innerText = "🗑️";
      btnEliminar.title = "Eliminar Jugador";
      btnEliminar.style.cssText =
        "position: absolute; top: 5px; right: 5px; background: transparent; border: none; cursor: pointer; font-size: 16px;";
      btnEliminar.onclick = () => {
        if (
          confirm(
            `¿Estás seguro de que deseas eliminar permanentemente al jugador "${nombre}"? Esta acción no se puede deshacer.`,
          )
        ) {
          db.ref(`campaña/jugadores/${nombre}`)
            .remove()
            .then(() => alert(`Jugador ${nombre} eliminado.`))
            .catch((e) => alert("Error al eliminar jugador: " + e));
        }
      };

      const title = document.createElement("strong");
      title.style.color = "#fff";
      title.innerText = nombre;

      const inputAhn = document.createElement("input");
      inputAhn.type = "number";
      inputAhn.value = data.ahn || 0;
      inputAhn.style.cssText =
        "padding: 5px; width: 80%; text-align: center; background: #111; color: #0df; border: 1px solid #c49a00; border-radius: 3px; font-size: 16px; font-weight: bold;";

      const btnForzar = document.createElement("button");
      btnForzar.innerText = "Forzar Transacción";
      btnForzar.style.cssText =
        "background: #8b0000; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; width: 100%;";
      btnForzar.onclick = () => {
        const nuevoAhn = parseInt(inputAhn.value) || 0;
        db.ref(`campaña/jugadores/${nombre}`)
          .update({ ahn: nuevoAhn })
          .then(() => alert(`Ahn actualizado para ${nombre}`))
          .catch((e) => alert("Error: " + e));
      };

      tarjeta.appendChild(btnEliminar);
      tarjeta.appendChild(title);
      tarjeta.appendChild(inputAhn);
      tarjeta.appendChild(btnForzar);
      bancoContainer.appendChild(tarjeta);
    }

    // --- Populate Terminal de Comunicaciones Select ---
    const commsJugadorSelect = document.getElementById("comms-jugador");
    if (commsJugadorSelect) {
      commsJugadorSelect.innerHTML =
        '<option value="">Selecciona Jugador...</option>';
      for (const nombre of Object.keys(jugadores)) {
        const option = document.createElement("option");
        option.value = nombre;
        option.textContent = nombre;
        commsJugadorSelect.appendChild(option);
      }
    }

    // --- Populate Generador de Botín Jugador Select ---
    const lootJugadorSelect = document.getElementById("loot-select-jugador");
    if (lootJugadorSelect) {
      lootJugadorSelect.innerHTML =
        '<option value="">Selecciona Jugador...</option>';
      for (const nombre of Object.keys(jugadores)) {
        const option = document.createElement("option");
        option.value = nombre;
        option.textContent = nombre;
        lootJugadorSelect.appendChild(option);
      }
    }

    // --- Populate Recetas Checkboxes ---
    const recetaJugadores = document.getElementById("lista-check-jugadores");
    if (recetaJugadores) {
      recetaJugadores.innerHTML = "";
      for (const nombre of Object.keys(jugadores)) {
        const lbl = document.createElement("label");
        lbl.style.cssText =
          "color:#fff; font-size:12px; display:flex; align-items:center; gap:3px; background:#111; padding:3px 6px; border-radius:3px; border:1px solid #333; cursor:pointer;";
        lbl.innerHTML = `<input type="checkbox" value="${nombre}" class="check-jugador-receta" /> ${nombre}`;
        recetaJugadores.appendChild(lbl);
      }
    }

    // --- Populate Tienda Jugadores Presentes Checkboxes ---
    const tiendaJugadoresPresentes = document.getElementById(
      "tienda-jugadores-presentes",
    );
    if (tiendaJugadoresPresentes) {
      tiendaJugadoresPresentes.innerHTML = "";
      for (const nombre of Object.keys(jugadores)) {
        const lbl = document.createElement("label");
        lbl.style.cssText =
          "color:#fff; font-size:12px; display:flex; align-items:center; gap:3px; background:#111; padding:3px 6px; border-radius:3px; border:1px solid #333; cursor:pointer;";
        lbl.innerHTML = `<input type="checkbox" value="${nombre}" class="tienda-jugador-cb" /> ${nombre}`;
        tiendaJugadoresPresentes.appendChild(lbl);
      }
    }
  } else {
    bancoContainer.innerHTML =
      '<span style="color: #888;">No hay jugadores activos.</span>';
    const tiendaJugadoresPresentes = document.getElementById(
      "tienda-jugadores-presentes",
    );
    if (tiendaJugadoresPresentes)
      tiendaJugadoresPresentes.innerHTML =
        '<span style="color:#888; font-size:12px;">Sin jugadores</span>';
  }
});

// --- TERMINAL DE COMUNICACIONES LOGIC ---
document.getElementById("btn-enviar-mail").addEventListener("click", () => {
  const jugador = document.getElementById("comms-jugador").value;
  const remitente = document.getElementById("comms-remitente").value.trim();
  const asunto = document.getElementById("comms-asunto").value.trim();
  const mensaje = document.getElementById("comms-mensaje").value.trim();

  if (!jugador || !remitente || !asunto || !mensaje) {
    alert("Completa todos los campos para enviar la transmisión.");
    return;
  }

  db.ref(`campaña/jugadores/${jugador}/correos`)
    .push({
      remitente: remitente,
      asunto: asunto,
      mensaje: mensaje,
      fecha: Date.now(),
      leido: false,
    })
    .then(() => {
      document.getElementById("comms-asunto").value = "";
      document.getElementById("comms-mensaje").value = "";
      alert(`Transmisión enviada a ${jugador} exitosamente.`);
    })
    .catch((err) => {
      console.error("Error al enviar correo: ", err);
      alert("Hubo un error al enviar el correo.");
    });
});

document.getElementById("btn-ejecutar-tx").addEventListener("click", () => {
  const nombre = document.getElementById("banco-nombre").value.trim();
  const monto = parseInt(document.getElementById("banco-monto").value) || 0;
  const concepto = document.getElementById("banco-concepto").value.trim();

  if (!nombre) {
    alert("El nombre del personaje es requerido.");
    return;
  }
  if (!concepto) {
    alert("El concepto es requerido.");
    return;
  }
  if (monto === 0) {
    alert("El monto no puede ser cero.");
    return;
  }

  const playerRef = db.ref(`campaña/jugadores/${nombre}`);
  playerRef
    .child("ahn")
    .once("value")
    .then((snapshot) => {
      const currentAhn = parseInt(snapshot.val()) || 0;
      const newAhn = currentAhn + monto;

      // Actualizar saldo
      playerRef
        .update({ ahn: newAhn })
        .then(() => {
          // Guardar transacción
          const transaccion = {
            monto: monto,
            concepto: concepto,
            timestamp: Date.now(),
          };
          playerRef
            .child("transacciones")
            .push(transaccion)
            .then(() => {
              alert(
                `Transacción ejecutada con éxito. Nuevo saldo de ${nombre}: ${newAhn} Ahn.`,
              );
              document.getElementById("banco-nombre").value = "";
              document.getElementById("banco-monto").value = "";
              document.getElementById("banco-concepto").value = "";
            });
        })
        .catch((e) => alert("Error actualizando saldo: " + e));
    })
    .catch((e) => alert("Error leyendo saldo actual: " + e));
});

// --- LÓGICA DEL DASHBOARD DE FORJA Y MERCADO ---

let dbItemsCache = {}; // Caché local de TODOS los ítems globales
let tiendaActualEditada = null; // ID de la tienda abierta en el modal

let editModeItemKey = null;

// --- ETIQUETAS DE ÍTEMS GLOBALES ---
let currentItemTags = [];
const forjaTagsContainer = document.getElementById("forja-tags-container");
const forjaTagInput = document.getElementById("forja-tag-input");

function renderForjaTags() {
  forjaTagsContainer.innerHTML = "";
  currentItemTags.forEach((tag, index) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.innerHTML = `${tag} <span style="color:#ff4444; font-weight:bold; margin-left:5px;">&times;</span>`;
    chip.onclick = () => {
      currentItemTags.splice(index, 1);
      renderForjaTags();
    };
    forjaTagsContainer.appendChild(chip);
  });
}

document.getElementById("btn-add-tag").addEventListener("click", () => {
  const val = forjaTagInput.value.trim();
  if (val && !currentItemTags.includes(val)) {
    currentItemTags.push(val);
    renderForjaTags();
    forjaTagInput.value = "";
  }
});

function resetItemForm() {
  document.getElementById("forja-nombre").value = "";
  document.getElementById("forja-icono").value = "";
  document.getElementById("forja-tier").value = "1";
  document.getElementById("forja-tag-input").value = "";
  currentItemTags = [];
  renderForjaTags();
  document.getElementById("forja-costo").value = "";
  document.getElementById("forja-usos").value = "";
  document.getElementById("forja-limite-activo").value = "";
  document.getElementById("forja-limite-alijo").value = "";
  document.getElementById("forja-vinculo-item").value = "";
  document.getElementById("forja-vinculo-cant").value = "";
  document.getElementById("forja-vinculo-max").value = "";
  document.getElementById("forja-desc").value = "";
  document.getElementById("btn-crear-item").innerText = "Crear Ítem";
  document.getElementById("btn-cancelar-item").style.display = "none";
  editModeItemKey = null;
}

document
  .getElementById("btn-cancelar-item")
  .addEventListener("click", resetItemForm);

// CREAR O ACTUALIZAR ÍTEM GLOBAL
document.getElementById("btn-crear-item").addEventListener("click", () => {
  const nombre = document.getElementById("forja-nombre").value.trim();
  if (!nombre) {
    alert("El nombre es requerido");
    return;
  }

  const icono = document.getElementById("forja-icono").value.trim();
  const tier = document.getElementById("forja-tier").value;
  const costo = parseInt(document.getElementById("forja-costo").value) || 0;
  const usos = parseInt(document.getElementById("forja-usos").value) || 0;
  const limite_activo =
    parseInt(document.getElementById("forja-limite-activo").value) || 2;
  const limite_alijo =
    parseInt(document.getElementById("forja-limite-alijo").value) || 99;

  const vinculo_item = document
    .getElementById("forja-vinculo-item")
    .value.trim();
  const vinculo_cantidad =
    parseInt(document.getElementById("forja-vinculo-cant").value) || 0;
  const vinculo_stacks_max =
    parseInt(document.getElementById("forja-vinculo-max").value) || 0;

  const desc = document.getElementById("forja-desc").value.trim();

  if (currentItemTags.length === 0) {
    alert("Agrega al menos una etiqueta al ítem.");
    return;
  }

  const item = {
    nombre,
    icono,
    tags: currentItemTags,
    tier,
    costo,
    usos,
    descripcion: desc,
    limite_activo,
    limite_alijo,
  };

  if (vinculo_item) {
    item.vinculo_item = vinculo_item;
    item.vinculo_cantidad = vinculo_cantidad;
    item.vinculo_stacks_max = vinculo_stacks_max;
    item.carga_actual = 0;
  }

  const isEditing = editModeItemKey !== null;

  function propagarActualizacionItem(originalKey, newKey, newItemData) {
    const updates = {};

    // Actualizar en jugadores
    db.ref("campaña/jugadores")
      .once("value")
      .then((snap) => {
        const jugadores = snap.val();
        if (jugadores) {
          for (const [idJugador, dataJugador] of Object.entries(jugadores)) {
            // Inventario Activo
            if (dataJugador.inventario_activo) {
              for (const [keyInv, dataItem] of Object.entries(
                dataJugador.inventario_activo,
              )) {
                if (
                  dataItem.nombre === originalKey ||
                  (editModeItemKey && dataItem.nombre === editModeItemKey)
                ) {
                  updates[
                    `campaña/jugadores/${idJugador}/inventario_activo/${keyInv}/nombre`
                  ] = newItemData.nombre;
                  updates[
                    `campaña/jugadores/${idJugador}/inventario_activo/${keyInv}/icono`
                  ] = newItemData.icono;
                  updates[
                    `campaña/jugadores/${idJugador}/inventario_activo/${keyInv}/tags`
                  ] = newItemData.tags;
                  updates[
                    `campaña/jugadores/${idJugador}/inventario_activo/${keyInv}/tier`
                  ] = newItemData.tier;
                  updates[
                    `campaña/jugadores/${idJugador}/inventario_activo/${keyInv}/costo`
                  ] = newItemData.costo;
                  updates[
                    `campaña/jugadores/${idJugador}/inventario_activo/${keyInv}/usos`
                  ] = newItemData.usos;
                  updates[
                    `campaña/jugadores/${idJugador}/inventario_activo/${keyInv}/descripcion`
                  ] = newItemData.descripcion;
                }
              }
            }
            // Inventario Stash
            if (dataJugador.inventario_stash) {
              for (const [keyInv, dataItem] of Object.entries(
                dataJugador.inventario_stash,
              )) {
                if (
                  dataItem.nombre === originalKey ||
                  (editModeItemKey && dataItem.nombre === editModeItemKey)
                ) {
                  updates[
                    `campaña/jugadores/${idJugador}/inventario_stash/${keyInv}/nombre`
                  ] = newItemData.nombre;
                  updates[
                    `campaña/jugadores/${idJugador}/inventario_stash/${keyInv}/icono`
                  ] = newItemData.icono;
                  updates[
                    `campaña/jugadores/${idJugador}/inventario_stash/${keyInv}/tags`
                  ] = newItemData.tags;
                  updates[
                    `campaña/jugadores/${idJugador}/inventario_stash/${keyInv}/tier`
                  ] = newItemData.tier;
                  updates[
                    `campaña/jugadores/${idJugador}/inventario_stash/${keyInv}/costo`
                  ] = newItemData.costo;
                  updates[
                    `campaña/jugadores/${idJugador}/inventario_stash/${keyInv}/usos`
                  ] = newItemData.usos;
                  updates[
                    `campaña/jugadores/${idJugador}/inventario_stash/${keyInv}/descripcion`
                  ] = newItemData.descripcion;
                }
              }
            }
          }
        }

        // Actualizar en tiendas
        return db.ref("campaña/tiendas").once("value");
      })
      .then((snap) => {
        const tiendas = snap.val();
        if (tiendas) {
          for (const [idTienda, dataTienda] of Object.entries(tiendas)) {
            if (dataTienda.items) {
              if (originalKey !== newKey) {
                // Si cambió la key (el nombre), movemos el nodo
                if (dataTienda.items[originalKey]) {
                  const itemTiendaData = {
                    ...dataTienda.items[originalKey],
                    ...newItemData,
                  };
                  updates[`campaña/tiendas/${idTienda}/items/${newKey}`] =
                    itemTiendaData;
                  updates[`campaña/tiendas/${idTienda}/items/${originalKey}`] =
                    null;
                }
              } else {
                // Actualizar in-place
                if (dataTienda.items[newKey]) {
                  updates[
                    `campaña/tiendas/${idTienda}/items/${newKey}/nombre`
                  ] = newItemData.nombre;
                  updates[`campaña/tiendas/${idTienda}/items/${newKey}/icono`] =
                    newItemData.icono;
                  updates[`campaña/tiendas/${idTienda}/items/${newKey}/tags`] =
                    newItemData.tags;
                  updates[`campaña/tiendas/${idTienda}/items/${newKey}/tier`] =
                    newItemData.tier;
                  updates[`campaña/tiendas/${idTienda}/items/${newKey}/usos`] =
                    newItemData.usos;
                  updates[
                    `campaña/tiendas/${idTienda}/items/${newKey}/descripcion`
                  ] = newItemData.descripcion;
                  // Not updating cost/price here because store could have custom price
                }
              }
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          return db.ref().update(updates);
        }
      })
      .then(() => {
        console.log("Propagación de ítem completada.");
      })
      .catch((err) => {
        console.error("Error propagando ítem: ", err);
      });
  }

  if (isEditing && editModeItemKey !== nombre) {
    // Name changed, delete old one
    db.ref(`campaña/base_datos_items/${editModeItemKey}`)
      .remove()
      .then(() => db.ref(`campaña/base_datos_items/${nombre}`).set(item))
      .then(() => {
        propagarActualizacionItem(editModeItemKey, nombre, item);
        alert("Ítem actualizado exitosamente");
        resetItemForm();
      })
      .catch((e) => alert("Error actualizando ítem: " + e));
  } else {
    db.ref(`campaña/base_datos_items/${nombre}`)
      .set(item)
      .then(() => {
        if (isEditing) propagarActualizacionItem(nombre, nombre, item);
        alert(
          isEditing
            ? "Ítem actualizado exitosamente"
            : "Ítem creado exitosamente",
        );
        resetItemForm();
      })
      .catch((e) => alert("Error guardando ítem: " + e));
  }
});

// RENDERIZAR ÍTEMS GLOBALES EN GRID
const gridItemsGlobales = document.getElementById("grid-items-globales");
db.ref("campaña/base_datos_items").on("value", (snapshot) => {
  gridItemsGlobales.innerHTML = "";
  const items = snapshot.val();
  dbItemsCache = items || {};

  if (items) {
    for (const [key, data] of Object.entries(items)) {
      const card = document.createElement("div");
      card.className = "card-cyber card-item";

      // Guardar info para los filtros
      card.dataset.name = data.nombre.toLowerCase();
      card.dataset.tier = (data.tier || "").toLowerCase();

      let tagsStr = "";
      let tagsLower = "";
      if (data.tags && Array.isArray(data.tags)) {
        tagsStr = data.tags.join(", ");
        tagsLower = data.tags.map((t) => t.toLowerCase()).join(",");
      } else if (data.tipo) {
        // Fallback para items antiguos en DB
        tagsStr = data.tipo;
        tagsLower = data.tipo.toLowerCase();
      } else {
        tagsStr = "Sin etiquetas";
      }
      card.dataset.tags = tagsLower;

      const imgUrl =
        data.icono || "https://via.placeholder.com/60/222222/00ddff?text=?";
      card.innerHTML = `
                <button class="btn-delete-item" data-id="${key}" style="position: absolute; top: 5px; right: 5px; background: transparent; border: none; cursor: pointer; font-size: 16px;" title="Eliminar Ítem">🗑️</button>
                <img src="${imgUrl}" alt="${data.nombre}">
                <h5>${data.nombre}</h5>
                <span style="font-size: 0.8em;">${tagsStr}</span>
                <span style="color:#0df; font-weight:bold;"><span class="currency-symbol">₳</span> ${data.costo}</span>
             `;

      // Evento para eliminar
      const btnDelete = card.querySelector(".btn-delete-item");
      btnDelete.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("¿Estás seguro de eliminar este ítem permanentemente?")) {
          db.ref("campaña/base_datos_items/" + key)
            .remove()
            .then(() => alert("Ítem eliminado."))
            .catch((err) => alert("Error al eliminar: " + err));
        }
      });

      // Evento para editar
      card.addEventListener("click", () => {
        editModeItemKey = key;
        document.getElementById("forja-nombre").value = data.nombre || "";
        document.getElementById("forja-icono").value = data.icono || "";
        document.getElementById("forja-tier").value = data.tier || "1";

        currentItemTags =
          data.tags && Array.isArray(data.tags)
            ? [...data.tags]
            : data.tipo
              ? [data.tipo]
              : [];
        renderForjaTags();

        document.getElementById("forja-costo").value =
          data.costo !== undefined ? data.costo : "";
        document.getElementById("forja-usos").value =
          data.usos !== undefined ? data.usos : "";
        document.getElementById("forja-limite-activo").value =
          data.limite_activo !== undefined ? data.limite_activo : "";
        document.getElementById("forja-limite-alijo").value =
          data.limite_alijo !== undefined ? data.limite_alijo : "";
        document.getElementById("forja-vinculo-item").value =
          data.vinculo_item || "";
        document.getElementById("forja-vinculo-cant").value =
          data.vinculo_cantidad !== undefined ? data.vinculo_cantidad : "";
        document.getElementById("forja-vinculo-max").value =
          data.vinculo_stacks_max !== undefined ? data.vinculo_stacks_max : "";
        document.getElementById("forja-desc").value = data.descripcion || "";

        document.getElementById("btn-crear-item").innerText = "Actualizar Ítem";
        document.getElementById("btn-cancelar-item").style.display = "block";

        // Scroll to top/form area smoothly
        document
          .getElementById("dashboard-mercado")
          .scrollIntoView({ behavior: "smooth" });
      });

      gridItemsGlobales.appendChild(card);
    }
    // Llamar al filtro después de renderizar para mantener el estado de búsqueda actual
    filterDMItems();
  } else {
    gridItemsGlobales.innerHTML =
      '<span style="color: #888;">No hay ítems registrados.</span>';
  }

  // --- Populate Añadir Ítem a Tabla Select ---
  const lootItemSelect = document.getElementById("loot-select-item");
  if (lootItemSelect) {
    lootItemSelect.innerHTML =
      '<option value="">Selecciona Ítem Global...</option>';
    if (items) {
      // Ordenar ítems alfabéticamente
      const sortedKeys = Object.keys(items).sort();
      for (const key of sortedKeys) {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = items[key].nombre;
        lootItemSelect.appendChild(option);
      }
    }
  }

  // --- Populate Receta Ítem Resultado Select ---
  const recetaItemResultado = document.getElementById("receta-item-resultado");
  if (recetaItemResultado) {
    recetaItemResultado.innerHTML =
      '<option value="">Selecciona Ítem...</option>';
    if (items) {
      const sortedKeys = Object.keys(items).sort();
      for (const key of sortedKeys) {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = items[key].nombre;
        recetaItemResultado.appendChild(option);
      }
    }
  }

  // Actualizar selects de ingredientes ya creados
  const selectsIngredientes = document.querySelectorAll(".select-ingrediente");
  selectsIngredientes.forEach((sel) => {
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">Selecciona Ítem...</option>';
    if (items) {
      const sortedKeys = Object.keys(items).sort();
      for (const key of sortedKeys) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = items[key].nombre;
        sel.appendChild(opt);
      }
    }
    if (currentVal && items[currentVal]) sel.value = currentVal;
  });
});

// --- LÓGICA DE BÚSQUEDA Y FILTRADO (DM) ---
const searchInputDM = document.getElementById("buscador-items-dm");
const filterBtnsDM = document.querySelectorAll("#filtros-dm .dm-filter-btn");

function filterDMItems() {
  const query = searchInputDM ? searchInputDM.value.toLowerCase() : "";
  let activeFilter = "todo";

  filterBtnsDM.forEach((btn) => {
    if (btn.classList.contains("active")) {
      activeFilter = btn.getAttribute("data-filter").toLowerCase();
    }
  });

  const dmGrid = document.getElementById("grid-items-globales");
  if (dmGrid) {
    const cards = dmGrid.querySelectorAll(".card-item");
    cards.forEach((card) => {
      const name = card.dataset.name || "";
      const tier = card.dataset.tier || "";
      const tags = card.dataset.tags || "";

      const matchesQuery =
        name.includes(query) || tier.includes(query) || tags.includes(query);
      const matchesFilter =
        activeFilter === "todo" || tags.includes(activeFilter);

      if (matchesQuery && matchesFilter) {
        card.style.display = "flex";
      } else {
        card.style.display = "none";
      }
    });
  }
}

if (searchInputDM) {
  searchInputDM.addEventListener("input", filterDMItems);
}

filterBtnsDM.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtnsDM.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    filterDMItems();
  });
});

// --- LÓGICA DE REGLAS DE TIENDA ---
let currentTiendaReglas = {};
let editModeTiendaKey = null;
const tiendaReglasContainer = document.getElementById(
  "tienda-reglas-container",
);
const tiendaReglaTagInput = document.getElementById("tienda-regla-tag");
const tiendaReglaPctInput = document.getElementById("tienda-regla-pct");

function renderTiendaReglas() {
  tiendaReglasContainer.innerHTML = "";
  for (const [tag, pct] of Object.entries(currentTiendaReglas)) {
    const ruleItem = document.createElement("div");
    ruleItem.className = "rule-item";
    ruleItem.innerHTML = `
                <span>[${tag}] - Paga al ${pct}%</span>
                <button class="btn-remove-rule" title="Eliminar regla">&times;</button>
            `;
    ruleItem.querySelector(".btn-remove-rule").onclick = () => {
      delete currentTiendaReglas[tag];
      renderTiendaReglas();
    };
    tiendaReglasContainer.appendChild(ruleItem);
  }
}

document.getElementById("btn-add-regla").addEventListener("click", () => {
  const tag = tiendaReglaTagInput.value.trim();
  const pct = parseInt(tiendaReglaPctInput.value);

  if (tag && !isNaN(pct)) {
    currentTiendaReglas[tag] = pct;
    renderTiendaReglas();
    tiendaReglaTagInput.value = "";
    tiendaReglaPctInput.value = "";
  } else {
    alert("Ingresa una etiqueta y un porcentaje de compra válido.");
  }
});

function resetTiendaForm() {
  document.getElementById("tienda-nombre").value = "";
  document.getElementById("tienda-icono").value = "";
  document.getElementById("tienda-icono-fisico").value = "";
  document.getElementById("tienda-fisica-activa").checked = false;
  document.getElementById("tienda-dias-entrega").value = "";
  document
    .querySelectorAll(".tienda-jugador-cb")
    .forEach((cb) => (cb.checked = false));
  document.getElementById("tienda-restock-dia").value = "Lunes";
  document.getElementById("tienda-mod-venta").value = "";
  document.getElementById("tienda-tasa-defecto").value = "";
  currentTiendaReglas = {};
  renderTiendaReglas();
  document.getElementById("btn-crear-tienda").innerText = "Crear Tienda";
  document.getElementById("btn-cancelar-tienda").style.display = "none";
  editModeTiendaKey = null;
}

document
  .getElementById("btn-cancelar-tienda")
  .addEventListener("click", resetTiendaForm);

// CREAR O ACTUALIZAR TIENDA
document.getElementById("btn-crear-tienda").addEventListener("click", () => {
  const nombre = document.getElementById("tienda-nombre").value.trim();
  const icono = document.getElementById("tienda-icono").value.trim();
  let iconoFisico = document.getElementById("tienda-icono-fisico").value.trim();
  const fisicaActiva = document.getElementById("tienda-fisica-activa").checked;
  const diasEntrega =
    parseInt(document.getElementById("tienda-dias-entrega").value) || 0;
  const diaRestock = document.getElementById("tienda-restock-dia").value;
  const modVenta =
    parseInt(document.getElementById("tienda-mod-venta").value) || 100;
  const tasaDefecto = parseInt(
    document.getElementById("tienda-tasa-defecto").value,
  );

  if (!nombre) {
    alert("El nombre de la tienda es requerido.");
    return;
  }
  if (isNaN(tasaDefecto)) {
    alert("La tasa por defecto es requerida.");
    return;
  }

  if (fisicaActiva && !iconoFisico) {
    iconoFisico = "https://i.imgur.com/kP8s7Ww.png"; // Ciberpunk default icon
  }

  const jugadoresPresentes = {};
  document.querySelectorAll(".tienda-jugador-cb").forEach((cb) => {
    if (cb.checked) {
      jugadoresPresentes[cb.value] = true;
    }
  });

  const isEditing = editModeTiendaKey !== null;
  // In edit mode, if name didn't change enough to alter ID, we use the original.
  const idTienda = isEditing
    ? editModeTiendaKey
    : nombre.toLowerCase().replace(/[^a-z0-9]/g, "_");

  const tiendaData = {
    nombre: nombre,
    icono: icono,
    icono_fisico: iconoFisico,
    fisica_activa: fisicaActiva,
    dias_entrega: diasEntrega,
    jugadores_presentes: jugadoresPresentes,
    dia_restock: diaRestock,
    mod_venta: modVenta,
    tasas_por_etiqueta: currentTiendaReglas,
    tasa_defecto: tasaDefecto,
  };

  if (isEditing) {
    db.ref(`campaña/tiendas/${editModeTiendaKey}`)
      .update(tiendaData)
      .then(() => {
        alert("Tienda actualizada exitosamente.");
        resetTiendaForm();
      })
      .catch((e) => alert("Error actualizando tienda: " + e));
  } else {
    tiendaData.items = {}; // Empty initially
    db.ref(`campaña/tiendas/${idTienda}`)
      .set(tiendaData)
      .then(() => {
        alert("Tienda creada exitosamente.");
        resetTiendaForm();
      })
      .catch((e) => alert("Error creando tienda: " + e));
  }
});

// RENDERIZAR TIENDAS EN GRID
const gridTiendas = document.getElementById("grid-tiendas");
db.ref("campaña/tiendas").on("value", (snapshot) => {
  gridTiendas.innerHTML = "";
  const tiendas = snapshot.val();

  if (tiendas) {
    for (const [idTienda, data] of Object.entries(tiendas)) {
      const card = document.createElement("div");
      card.className = "card-cyber card-store";

      const imgUrl =
        data.icono || "https://via.placeholder.com/60/222222/c49a00?text=$";
      card.innerHTML = `
                    <button class="btn-delete-store" data-id="${idTienda}" style="position: absolute; top: 5px; right: 5px; background: transparent; border: none; cursor: pointer; font-size: 16px;" title="Eliminar Tienda">🗑️</button>
                    <button class="btn-edit-store" data-id="${idTienda}" style="position: absolute; top: 5px; right: 30px; background: transparent; border: none; cursor: pointer; font-size: 16px;" title="Editar Info">✏️</button>
                    <img src="${imgUrl}" alt="${data.nombre}">
                    <h5 style="color:#c49a00;">${data.nombre}</h5>
                    <span>Restock: ${data.dia_restock}</span>
                    <label class="switch" style="margin-top: 5px;" title="Activar / Desactivar Tienda">
                        <input type="checkbox" class="toggle-activa-store" data-id="${idTienda}" ${data.activa ? "checked" : ""}>
                        <span class="slider"></span>
                    </label>
                `;

      // Evento para editar
      const btnEdit = card.querySelector(".btn-edit-store");
      btnEdit.addEventListener("click", (e) => {
        e.stopPropagation();
        editModeTiendaKey = idTienda;
        document.getElementById("tienda-nombre").value = data.nombre || "";
        document.getElementById("tienda-icono").value = data.icono || "";
        document.getElementById("tienda-icono-fisico").value =
          data.icono_fisico || "";
        document.getElementById("tienda-fisica-activa").checked =
          data.fisica_activa || false;
        document.getElementById("tienda-dias-entrega").value =
          data.dias_entrega !== undefined ? data.dias_entrega : "";
        document.querySelectorAll(".tienda-jugador-cb").forEach((cb) => {
          cb.checked = !!(
            data.jugadores_presentes && data.jugadores_presentes[cb.value]
          );
        });
        document.getElementById("tienda-restock-dia").value =
          data.dia_restock || "Lunes";
        document.getElementById("tienda-mod-venta").value =
          data.mod_venta !== undefined ? data.mod_venta : "";
        document.getElementById("tienda-tasa-defecto").value =
          data.tasa_defecto !== undefined ? data.tasa_defecto : "";

        currentTiendaReglas = data.tasas_por_etiqueta || {};
        renderTiendaReglas();

        document.getElementById("btn-crear-tienda").innerText =
          "Actualizar Tienda";
        document.getElementById("btn-cancelar-tienda").style.display = "block";

        document
          .getElementById("dashboard-mercado")
          .scrollIntoView({ behavior: "smooth" });
      });

      // Evento para eliminar
      const btnDelete = card.querySelector(".btn-delete-store");
      btnDelete.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("¿Estás seguro de eliminar esta tienda permanentemente?")) {
          db.ref("campaña/tiendas/" + idTienda)
            .remove()
            .then(() => alert("Tienda eliminada."))
            .catch((err) => alert("Error al eliminar: " + err));
        }
      });

      // Evento para activar/desactivar
      const toggleActiva = card.querySelector(".toggle-activa-store");
      toggleActiva.addEventListener("change", (e) => {
        e.stopPropagation();
        const checked = e.target.checked;
        if (checked) {
          // Desactivar todas las demás tiendas
          const updates = {};
          for (const otherId of Object.keys(tiendas)) {
            updates[`${otherId}/activa`] = otherId === idTienda;
          }
          db.ref("campaña/tiendas").update(updates);
        } else {
          db.ref(`campaña/tiendas/${idTienda}`).update({ activa: false });
        }
      });

      // Evento para abrir el Editor Interactivo (evitando clics en botones/switches)
      card.addEventListener("click", (e) => {
        if (
          e.target.tagName !== "BUTTON" &&
          e.target.tagName !== "INPUT" &&
          e.target.className !== "slider"
        ) {
          abrirModalTienda(idTienda, data);
        }
      });

      gridTiendas.appendChild(card);
    }
  } else {
    gridTiendas.innerHTML =
      '<span style="color: #888;">No hay tiendas creadas.</span>';
  }
});

// --- LÓGICA DEL MODAL EDITOR DE TIENDAS ---
const modalEditar = document.getElementById("modal-editar-tienda");
const btnCerrarModal = document.getElementById("btn-cerrar-modal");
const btnGuardarInventario = document.getElementById("btn-guardar-inventario");
const listaItemsModal = document.getElementById("modal-tienda-lista-items");

btnCerrarModal.addEventListener("click", () => {
  modalEditar.style.display = "none";
  tiendaActualEditada = null;
});

function abrirModalTienda(idTienda, dataTienda) {
  tiendaActualEditada = idTienda;
  document.getElementById("modal-tienda-titulo").innerText =
    `Editando Tienda: ${dataTienda.nombre}`;

  listaItemsModal.innerHTML = "";
  const itemsTienda = dataTienda.items || {};

  // Iterar sobre TODOS los ítems globales para mostrarlos
  for (const [keyItem, dataGlobal] of Object.entries(dbItemsCache)) {
    const itemEnTienda = itemsTienda[keyItem]; // Existe en la tienda?

    const isChecked = itemEnTienda ? "checked" : "";
    const precioActual = itemEnTienda ? itemEnTienda.costo : dataGlobal.costo;
    const stockActual = itemEnTienda ? itemEnTienda.stock_maximo : -1;
    const requisitoActual =
      itemEnTienda && itemEnTienda.requisito_aparicion
        ? itemEnTienda.requisito_aparicion
        : "Siempre";

    const row = document.createElement("div");
    row.className = "modal-item-row";
    // Data attributes for easy saving
    row.dataset.key = keyItem;

    let tagsStr = "";
    if (dataGlobal.tags && Array.isArray(dataGlobal.tags)) {
      tagsStr = dataGlobal.tags.join(", ");
    } else if (dataGlobal.tipo) {
      tagsStr = dataGlobal.tipo;
    } else {
      tagsStr = "Sin etiquetas";
    }

    const imgUrl =
      dataGlobal.icono || "https://via.placeholder.com/40/222222/00ddff?text=?";

    row.innerHTML = `
                <img src="${imgUrl}" alt="${dataGlobal.nombre}">
                <div class="modal-item-info">
                    <h5>${dataGlobal.nombre}</h5>
                    <span style="font-size: 0.8em;">${tagsStr}</span>
                </div>
                <div class="modal-item-inputs">
                    <label style="font-size: 12px; color: #aaa;">Precio:</label>
                    <input type="number" class="input-precio" value="${precioActual}">
                    <label style="font-size: 12px; color: #aaa;">Stock:</label>
                    <input type="number" class="input-stock" value="${stockActual}" title="-1 para infinito">
                    <label style="font-size: 12px; color: #aaa;">Req:</label>
                    <select class="input-requisito" style="padding: 5px; background: #111; color: #0df; border: 1px solid #444; border-radius: 3px;">
                        <option value="Siempre" ${requisitoActual === "Siempre" ? "selected" : ""}>Siempre</option>
                        <option value="Solo en Primavera" ${requisitoActual === "Solo en Primavera" ? "selected" : ""}>Solo en Primavera</option>
                        <option value="Solo en Verano" ${requisitoActual === "Solo en Verano" ? "selected" : ""}>Solo en Verano</option>
                        <option value="Solo en Otoño" ${requisitoActual === "Solo en Otoño" ? "selected" : ""}>Solo en Otoño</option>
                        <option value="Solo en Invierno" ${requisitoActual === "Solo en Invierno" ? "selected" : ""}>Solo en Invierno</option>
                        <option value="Solo con Lluvia Ácida" ${requisitoActual === "Solo con Lluvia Ácida" ? "selected" : ""}>Solo con Lluvia Ácida</option>
                    </select>
                </div>
                <label class="switch">
                    <input type="checkbox" class="toggle-item" ${isChecked}>
                    <span class="slider"></span>
                </label>
            `;

    listaItemsModal.appendChild(row);
  }

  modalEditar.style.display = "flex";
}

// GUARDAR INVENTARIO
btnGuardarInventario.addEventListener("click", () => {
  if (!tiendaActualEditada) return;

  const updates = {};
  const filas = listaItemsModal.querySelectorAll(".modal-item-row");

  filas.forEach((fila) => {
    const toggle = fila.querySelector(".toggle-item");
    if (toggle.checked) {
      const keyItem = fila.dataset.key;
      const dataGlobal = dbItemsCache[keyItem];
      const precio =
        parseInt(fila.querySelector(".input-precio").value) || dataGlobal.costo;
      const stockMax = parseInt(fila.querySelector(".input-stock").value) || -1;
      const requisito = fila.querySelector(".input-requisito").value;

      // Construir el objeto del ítem para la tienda
      updates[keyItem] = {
        ...dataGlobal,
        costo: precio,
        stock_maximo: stockMax,
        stock_actual: stockMax, // Se resetea al máximo al guardar
        requisito_aparicion: requisito,
      };
    }
  });

  // Sobrescribir el nodo 'items' de la tienda con el nuevo objeto updates
  db.ref(`campaña/tiendas/${tiendaActualEditada}/items`)
    .set(updates)
    .then(() => {
      alert("Inventario de la tienda actualizado exitosamente.");
      modalEditar.style.display = "none";
      tiendaActualEditada = null;
    })
    .catch((e) => alert("Error guardando inventario: " + e));
});

// --- LÓGICA DEL MODAL DE INVENTARIO (DM) ---
const modalInvDM = document.getElementById("modal-inventario-dm");
const btnCerrarModalInv = document.getElementById("btn-cerrar-modal-inv");
const listaActivosModal = document.getElementById("modal-inv-lista-activos");
const listaStashModal = document.getElementById("modal-inv-lista-stash");
let currentInvPlayer = null;
let invStashRef = null;
let invActivoRef = null;

btnCerrarModalInv.addEventListener("click", () => {
  modalInvDM.style.display = "none";
  currentInvPlayer = null;

  if (invStashRef) {
    invStashRef.off();
    invStashRef = null;
  }
  if (invActivoRef) {
    invActivoRef.off();
    invActivoRef = null;
  }
});

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("btn-ver-inventario")) {
    const playerName = e.target.getAttribute("data-player");
    abrirModalInventario(playerName);
  }
});

function renderInvRow(key, item, listType) {
  const row = document.createElement("div");
  row.style.cssText =
    "display: flex; align-items: center; background: #222; padding: 10px; border-radius: 4px; border: 1px solid #333; gap: 15px; margin-bottom: 5px; flex-wrap: wrap;";

  const switchAction = listType === "stash" ? "to_activo" : "to_stash";
  const switchIcon = listType === "stash" ? "Equipar" : "Desequipar";
  const switchColor = listType === "stash" ? "#0df" : "#c49a00";

  // Enforce array for tags backward compatibility
  let tagsStr =
    item.tags && Array.isArray(item.tags)
      ? item.tags.join(", ")
      : item.tipo || "Sin Tipo";

  row.innerHTML = `
            <img src="${item.icono || "https://via.placeholder.com/40"}" style="width: 40px; height: 40px; object-fit: contain; background: #000; border-radius: 4px;">
            <div style="flex: 1; min-width: 150px;">
                <h5 style="margin: 0; color: #fff;">${item.nombre}</h5>
                <span style="font-size: 12px; color: #888;">[${tagsStr}] Tier ${item.tier || "I"}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <button class="btn-inv-mod" data-action="${switchAction}" data-key="${key}" data-list="${listType}" style="background:transparent; border:1px solid ${switchColor}; color:${switchColor}; cursor:pointer; padding:5px 10px; font-weight:bold; border-radius: 4px; font-size: 11px;" title="Mover">${switchIcon}</button>
                <div style="width: 1px; height: 20px; background: #444; margin: 0 5px;"></div>
                <button class="btn-inv-mod" data-action="minus" data-key="${key}" data-list="${listType}" style="background:#440000; border:1px solid #ff0000; color:#fff; cursor:pointer; padding:5px 10px; font-weight:bold; border-radius: 4px;">-</button>
                <span style="color:#0df; font-weight:bold; width: 30px; text-align:center;">${item.cantidad}</span>
                <button class="btn-inv-mod" data-action="plus" data-key="${key}" data-list="${listType}" style="background:#004400; border:1px solid #00ff00; color:#fff; cursor:pointer; padding:5px 10px; font-weight:bold; border-radius: 4px;">+</button>
                <button class="btn-inv-mod" data-action="delete" data-key="${key}" data-list="${listType}" style="background:transparent; border:none; color:#ff4444; cursor:pointer; font-size:18px; margin-left:10px;" title="Eliminar">🗑️</button>
            </div>
        `;
  return row;
}

function populateAddSelect() {
  const selectAdd = document.getElementById("dm-inv-add-select");
  if (!selectAdd) return;
  selectAdd.innerHTML =
    '<option value="">Selecciona un Ítem de la BD...</option>';

  if (dbItemsCache) {
    const sortedKeys = Object.keys(dbItemsCache).sort((a, b) =>
      dbItemsCache[a].nombre.localeCompare(dbItemsCache[b].nombre),
    );
    for (const key of sortedKeys) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = `${dbItemsCache[key].nombre} [Tier ${dbItemsCache[key].tier || "I"}]`;
      selectAdd.appendChild(opt);
    }
  }
}

document.getElementById("btn-dm-inv-add").addEventListener("click", () => {
  if (!currentInvPlayer) return;
  const itemKey = document.getElementById("dm-inv-add-select").value;
  const targetList = document.getElementById("dm-inv-add-target").value;
  const cant = parseInt(document.getElementById("dm-inv-add-cant").value) || 1;

  if (!itemKey) {
    alert("Selecciona un ítem de la lista.");
    return;
  }

  const dataGlobal = dbItemsCache[itemKey];
  if (!dataGlobal) {
    alert("El ítem ya no existe en la BD global.");
    return;
  }

  const targetRef = db.ref(
    `campaña/jugadores/${currentInvPlayer}/${targetList}`,
  );

  // Push the item. Note: we clone data so it doesn't break if global item changes
  targetRef.once("value", (snap) => {
    let foundKey = null;
    let currentCant = 0;
    const targetData = snap.val() || {};

    // Check if it already exists to increment quantity instead
    for (const [k, item] of Object.entries(targetData)) {
      if (
        item.nombre === dataGlobal.nombre &&
        (parseInt(item.tier) || 1) === (parseInt(dataGlobal.tier) || 1)
      ) {
        foundKey = k;
        currentCant = item.cantidad || 1;
        break;
      }
    }

    if (foundKey) {
      targetRef
        .child(foundKey)
        .update({ cantidad: currentCant + cant })
        .then(() =>
          alert(
            `Se añadieron ${cant} a ${dataGlobal.nombre} en ${targetList}.`,
          ),
        );
    } else {
      const newItem = {
        ...dataGlobal,
        cantidad: cant,
        valorBase: dataGlobal.costo || 0, // Para la tienda
      };
      targetRef
        .push(newItem)
        .then(() =>
          alert(`Ítem ${dataGlobal.nombre} x${cant} añadido a ${targetList}.`),
        );
    }
  });
});

function abrirModalInventario(playerName) {
  // Detach previous listeners if they exist
  if (invStashRef) {
    invStashRef.off();
  }
  if (invActivoRef) {
    invActivoRef.off();
  }

  currentInvPlayer = playerName;
  document.getElementById("modal-inv-titulo").innerText =
    `Inventario de: ${playerName}`;
  modalInvDM.style.display = "flex";

  populateAddSelect();

  // Listen to Stash
  invStashRef = db.ref(`campaña/jugadores/${playerName}/inventario_stash`);
  invStashRef.on("value", (snap) => {
    if (currentInvPlayer !== playerName) return;
    listaStashModal.innerHTML = "";
    const stash = snap.val();
    if (!stash) {
      listaStashModal.innerHTML =
        '<div style="color:#666; text-align:center; padding: 10px; background: #111; border-radius: 4px;">Stash vacío.</div>';
    } else {
      for (const [key, item] of Object.entries(stash)) {
        listaStashModal.appendChild(renderInvRow(key, item, "stash"));
      }
    }
  });

  // Listen to Activo
  invActivoRef = db.ref(`campaña/jugadores/${playerName}/inventario_activo`);
  invActivoRef.on("value", (snap) => {
    if (currentInvPlayer !== playerName) return;
    listaActivosModal.innerHTML = "";
    const activo = snap.val();
    if (!activo) {
      listaActivosModal.innerHTML =
        '<div style="color:#666; text-align:center; padding: 10px; background: #111; border-radius: 4px;">No hay ítems equipados.</div>';
    } else {
      for (const [key, item] of Object.entries(activo)) {
        listaActivosModal.appendChild(renderInvRow(key, item, "activo"));
      }
    }
  });
}

document
  .querySelector("#modal-inventario-dm .modal-body")
  .addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-inv-mod")) {
      const action = e.target.getAttribute("data-action");
      const key = e.target.getAttribute("data-key");
      const listType = e.target.getAttribute("data-list");

      const listName =
        listType === "stash" ? "inventario_stash" : "inventario_activo";
      const itemRef = db.ref(
        `campaña/jugadores/${currentInvPlayer}/${listName}/${key}`,
      );

      itemRef.once("value", (snap) => {
        const item = snap.val();
        if (!item) return;

        if (action === "plus") {
          itemRef.update({ cantidad: item.cantidad + 1 });
        } else if (action === "minus") {
          if (item.cantidad > 1) {
            itemRef.update({ cantidad: item.cantidad - 1 });
          } else {
            itemRef.remove();
          }
        } else if (action === "delete") {
          if (confirm("¿Eliminar este ítem por completo?")) {
            itemRef.remove();
          }
        } else if (action === "to_activo" || action === "to_stash") {
          const targetListName =
            action === "to_activo" ? "inventario_activo" : "inventario_stash";
          const targetRef = db.ref(
            `campaña/jugadores/${currentInvPlayer}/${targetListName}`,
          );

          // Move 1 unit
          let itemToMove = { ...item, cantidad: 1 };

          targetRef.once("value", (targetSnap) => {
            const targetData = targetSnap.val() || {};
            let foundKey = null;
            let targetCurrentCant = 0;

            for (const [k, targetItem] of Object.entries(targetData)) {
              if (
                targetItem.nombre === item.nombre &&
                (parseInt(targetItem.tier) || 1) === (parseInt(item.tier) || 1)
              ) {
                foundKey = k;
                targetCurrentCant = targetItem.cantidad || 1;
                break;
              }
            }

            // Add to target
            let promiseAdd;
            if (foundKey) {
              promiseAdd = targetRef
                .child(foundKey)
                .update({ cantidad: targetCurrentCant + 1 });
            } else {
              promiseAdd = targetRef.push(itemToMove);
            }

            // Remove from source
            promiseAdd.then(() => {
              if (item.cantidad > 1) {
                itemRef.update({ cantidad: item.cantidad - 1 });
              } else {
                itemRef.remove();
              }
            });
          });
        }
      });
    }
  });

// --- LÓGICA DE TABLAS DE LOOT ---
let dbTablasCache = {};

// A. CREAR TABLA DE LOOT
document
  .getElementById("btn-crear-tabla-loot")
  .addEventListener("click", () => {
    const nombreInput = document
      .getElementById("loot-nombre-tabla")
      .value.trim();
    if (!nombreInput) {
      alert("Ingresa un nombre para la tabla de loot.");
      return;
    }

    const idTabla = nombreInput.toLowerCase().replace(/[^a-z0-9]/g, "_");

    db.ref(`campaña/tablas_loot/${idTabla}`)
      .set({
        nombre: nombreInput,
        items: {}, // Inicializamos vacío para luego agregarle items
      })
      .then(() => {
        alert(`Tabla '${nombreInput}' creada exitosamente.`);
        document.getElementById("loot-nombre-tabla").value = "";
      })
      .catch((e) => alert("Error creando tabla de loot: " + e));
  });

// B. ESCUCHAR TABLAS DE LOOT (Para Selects y Caché)
db.ref("campaña/tablas_loot").on("value", (snapshot) => {
  const tablas = snapshot.val();
  dbTablasCache = tablas || {};

  const selectTablaAdd = document.getElementById("loot-select-tabla");
  const selectTablaRoll = document.getElementById("loot-select-tabla-roll");

  if (selectTablaAdd && selectTablaRoll) {
    selectTablaAdd.innerHTML = '<option value="">Selecciona Tabla...</option>';
    selectTablaRoll.innerHTML = '<option value="">Selecciona Tabla...</option>';

    if (tablas) {
      for (const [idTabla, data] of Object.entries(tablas)) {
        const opt1 = document.createElement("option");
        opt1.value = idTabla;
        opt1.textContent = data.nombre;
        selectTablaAdd.appendChild(opt1);

        const opt2 = document.createElement("option");
        opt2.value = idTabla;
        opt2.textContent = data.nombre;
        selectTablaRoll.appendChild(opt2);
      }
    }
  }
});

// C. AÑADIR ÍTEM A TABLA
document
  .getElementById("btn-anadir-item-loot")
  .addEventListener("click", () => {
    const idTabla = document.getElementById("loot-select-tabla").value;
    const idItem = document.getElementById("loot-select-item").value;
    const probabilidad = parseInt(
      document.getElementById("loot-probabilidad").value,
      10,
    );

    if (!idTabla) {
      alert("Selecciona una tabla de loot.");
      return;
    }
    if (!idItem) {
      alert("Selecciona un ítem para añadir.");
      return;
    }
    if (isNaN(probabilidad) || probabilidad < 1 || probabilidad > 100) {
      alert("Ingresa una probabilidad válida entre 1 y 100.");
      return;
    }

    const dataGlobal = dbItemsCache[idItem];
    if (!dataGlobal) {
      alert("Ítem no encontrado en base de datos global.");
      return;
    }

    db.ref(`campaña/tablas_loot/${idTabla}/items`)
      .push({
        id_item: idItem,
        nombre: dataGlobal.nombre,
        probabilidad: probabilidad,
      })
      .then(() => {
        alert(
          `Ítem '${dataGlobal.nombre}' añadido a la tabla con ${probabilidad}% de probabilidad.`,
        );
        document.getElementById("loot-probabilidad").value = "";
        document.getElementById("loot-select-item").value = "";
      })
      .catch((e) => alert("Error al añadir ítem a la tabla: " + e));
  });

// D. GENERADOR DE BOTÍN (TIRADA)
document.getElementById("btn-tirar-loot").addEventListener("click", () => {
  const idJugador = document.getElementById("loot-select-jugador").value;
  const idTabla = document.getElementById("loot-select-tabla-roll").value;

  if (!idJugador) {
    alert("Selecciona un jugador destino para el botín.");
    return;
  }
  if (!idTabla) {
    alert("Selecciona una tabla de loot para tirar.");
    return;
  }

  const tablaData = dbTablasCache[idTabla];
  if (!tablaData || !tablaData.items) {
    alert("Esta tabla de loot está vacía o no existe.");
    return;
  }

  const logDiv = document.getElementById("loot-log");
  let logMessage = `--- Tirada de Botín: ${tablaData.nombre} ---\nDestino: ${idJugador}\n\n`;
  let itemsDropeados = [];

  // Iterar sobre los items de la tabla
  for (const [keyItemTabla, itemInfo] of Object.entries(tablaData.items)) {
    const tirada = Math.floor(Math.random() * 100) + 1; // 1-100

    if (tirada <= itemInfo.probabilidad) {
      // El item cayó
      const fullItemData = dbItemsCache[itemInfo.id_item];
      if (fullItemData) {
        itemsDropeados.push(fullItemData);
        logMessage += `[ÉXITO] ${tirada}% vs ${itemInfo.probabilidad}% -> ¡Cayó ${itemInfo.nombre}!\n`;
      } else {
        logMessage += `[ERROR] El ítem original para ${itemInfo.nombre} ya no existe en la BD.\n`;
      }
    } else {
      // Falló
      logMessage += `[FALLO] ${tirada}% vs ${itemInfo.probabilidad}% -> No cayó ${itemInfo.nombre}.\n`;
    }
  }

  // Entregar items a jugador
  if (itemsDropeados.length > 0) {
    logMessage += `\nRESUMEN: Entregando ${itemsDropeados.length} ítem(s) al stash de ${idJugador}...`;

    const promises = itemsDropeados.map((item) => {
      // Hacer push al inventario_stash del jugador
      return db
        .ref(`campaña/jugadores/${idJugador}/inventario_stash`)
        .push(item);
    });

    Promise.all(promises)
      .then(() => {
        logMessage += `\n[ENTREGA COMPLETADA]`;
        logDiv.style.color = "#0df";
        logDiv.innerText = logMessage;
      })
      .catch((e) => {
        logMessage += `\n[ERROR AL ENTREGAR] ${e}`;
        logDiv.style.color = "#ff4444";
        logDiv.innerText = logMessage;
      });
  } else {
    logMessage += `\nRESUMEN: No cayó absolutamente nada.`;
    logDiv.style.color = "#c49a00";
    logDiv.innerText = logMessage;
  }
});

// --- LÓGICA GESTIÓN DE ACTORES ---
let dbActoresCache = {};
let editModeActorKey = null;

function createExpresionRow(name = "", url = "") {
  const container = document.getElementById("actor-expresiones-container");
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "5px";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "actor-expresion-name";
  nameInput.placeholder = "Nombre (ej. Feliz)";
  nameInput.value = name;
  nameInput.style.cssText = "flex: 1; padding: 5px;";

  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.className = "actor-expresion-url";
  urlInput.placeholder = "URL del Sprite";
  urlInput.value = url;
  urlInput.style.cssText = "flex: 2; padding: 5px;";

  const removeBtn = document.createElement("button");
  removeBtn.className = "btn-cyber btn-remove-expresion";
  removeBtn.style.cssText =
    "background:#800; color:#fff; border:none; padding:0 10px; font-weight:bold; cursor:pointer;";
  removeBtn.innerText = "X";
  removeBtn.addEventListener("click", () => row.remove());

  row.appendChild(nameInput);
  row.appendChild(urlInput);
  row.appendChild(removeBtn);
  container.appendChild(row);
}

document.getElementById("btn-add-expresion").addEventListener("click", () => {
  createExpresionRow();
});

function resetActorForm() {
  document.getElementById("actor-nombre").value = "";
  document.getElementById("actor-titulo").value = "";
  document.getElementById("actor-color-nombre").value = "#ffffff";
  document.getElementById("actor-color-titulo").value = "#c49a00";
  document.getElementById("actor-escala").value = "1.0";
  document.getElementById("actor-icono").value = "";
  document.getElementById("actor-sprite").value = "";
  document.getElementById("actor-tipo-npc").checked = true;
  document.getElementById("actor-expresiones-container").innerHTML = "";

  document.getElementById("btn-crear-actor").innerText = "Crear Actor";
  document.getElementById("btn-cancelar-actor").style.display = "none";
  editModeActorKey = null;
}

document
  .getElementById("btn-cancelar-actor")
  .addEventListener("click", resetActorForm);

document.getElementById("actor-escala").addEventListener("input", (e) => {
  if (editModeActorKey !== null) {
    const nuevaEscala = parseFloat(e.target.value) || 1.0;
    db.ref(`campaña/actores/${editModeActorKey}`).update({
      escala: nuevaEscala,
    });

    // Si el actor está en escena, actualizar su estado para reflejar el cambio en tiempo real
    const actorData = dbActoresCache[editModeActorKey];
    if (actorData) {
      db.ref("campaña/teatro/estado_actual")
        .once("value")
        .then((snap) => {
          const state = snap.val();
          if (state && state.nombre === actorData.nombre) {
            db.ref("campaña/teatro/estado_actual").update({
              escala: nuevaEscala,
            });
          }
        });
    }
  }
});

function renderListaActores() {
  const gridActores = document.getElementById("grid-actores");
  if (!gridActores) return;

  gridActores.innerHTML = "";

  if (Object.keys(dbActoresCache).length === 0) {
    gridActores.innerHTML =
      '<span style="color: #888;">No hay actores registrados.</span>';
    return;
  }

  for (const [actorId, actorData] of Object.entries(dbActoresCache)) {
    const card = document.createElement("div");
    card.className = "card-cyber card-store"; // reusing store card style for the pointer cursor and hover

    const imgUrl =
      actorData.icono ||
      actorData.sprite ||
      "https://via.placeholder.com/60/222222/ffffff?text=?";
    const badgeColor = actorData.tipo === "Jugador" ? "#0df" : "#ff4444";
    const badgeText = actorData.tipo || "NPC";

    card.innerHTML = `
                <div style="position: absolute; top: 5px; left: 5px; background: ${badgeColor}; color: #000; font-size: 10px; padding: 2px 5px; border-radius: 3px; font-weight: bold;">[${badgeText}]</div>
                <button class="btn-delete-actor" data-id="${actorId}" style="position: absolute; top: 5px; right: 5px; background: transparent; border: none; cursor: pointer; font-size: 16px;" title="Eliminar Actor">🗑️</button>
                <button class="btn-edit-actor" data-id="${actorId}" style="position: absolute; top: 5px; right: 30px; background: transparent; border: none; cursor: pointer; font-size: 16px;" title="Editar Actor">✏️</button>
                <img src="${imgUrl}" alt="${actorData.nombre}" style="border-radius: 50%; border-color: ${actorData.color_titulo || "#555"};">
                <h5 style="color:${actorData.color_nombre || "#fff"};">${actorData.nombre}</h5>
                <span style="color:${actorData.color_titulo || "#c49a00"};">${actorData.titulo || ""}</span>
            `;

    // Delete event
    const btnDelete = card.querySelector(".btn-delete-actor");
    btnDelete.addEventListener("click", (e) => {
      e.stopPropagation();
      if (
        confirm(
          `¿Estás seguro de eliminar permanentemente al actor "${actorData.nombre}"?`,
        )
      ) {
        db.ref(`campaña/actores/${actorId}`)
          .remove()
          .then(() => alert("Actor eliminado."))
          .catch((err) => alert("Error al eliminar: " + err));
      }
    });

    // Edit event
    const btnEdit = card.querySelector(".btn-edit-actor");
    btnEdit.addEventListener("click", (e) => {
      e.stopPropagation();
      editModeActorKey = actorId;

      document.getElementById("actor-nombre").value = actorData.nombre || "";
      document.getElementById("actor-titulo").value = actorData.titulo || "";
      document.getElementById("actor-color-nombre").value =
        actorData.color_nombre || "#ffffff";
      document.getElementById("actor-color-titulo").value =
        actorData.color_titulo || "#c49a00";
      document.getElementById("actor-escala").value =
        actorData.escala !== undefined ? actorData.escala : "1.0";
      document.getElementById("actor-icono").value = actorData.icono || "";
      document.getElementById("actor-sprite").value = actorData.sprite || "";

      if (actorData.tipo === "Jugador") {
        document.getElementById("actor-tipo-jugador").checked = true;
      } else {
        document.getElementById("actor-tipo-npc").checked = true;
      }

      document.getElementById("actor-expresiones-container").innerHTML = "";
      if (actorData.expresiones) {
        for (const [name, url] of Object.entries(actorData.expresiones)) {
          if (name !== "Neutral") {
            createExpresionRow(name, url);
          }
        }
      }

      document.getElementById("btn-crear-actor").innerText = "Actualizar Actor";
      document.getElementById("btn-cancelar-actor").style.display = "block";

      // Scroll to top of actors tab smoothly
      document
        .getElementById("dashboard-actores")
        .scrollIntoView({ behavior: "smooth" });
    });

    gridActores.appendChild(card);
  }
}

// Escuchar actores para la lista y el select
db.ref("campaña/actores").on("value", (snapshot) => {
  dbActoresCache = snapshot.val() || {};
  renderListaActores();
  renderActorAsignacion();
});

let dbJugadoresCache = {};

// Escuchar jugadores para la lista (reusando el que ya existe o creando nuevo listener local aquí)
db.ref("campaña/jugadores").on("value", (snapshot) => {
  dbJugadoresCache = snapshot.val() || {};
  renderActorAsignacion();
});

function renderActorAsignacion() {
  const container = document.getElementById("actor-asignacion-lista");
  if (!container) return;

  container.innerHTML = "";

  if (Object.keys(dbJugadoresCache).length === 0) {
    container.innerHTML =
      '<span style="color: #888;">No hay jugadores conectados/registrados.</span>';
    return;
  }

  for (const [playerName, playerData] of Object.entries(dbJugadoresCache)) {
    const row = document.createElement("div");
    row.style.cssText =
      "display: flex; gap: 15px; align-items: center; background: #111; padding: 10px; border-radius: 4px; border: 1px solid #444; width: 100%; max-width: 400px; justify-content: space-between;";

    const nameLabel = document.createElement("span");
    nameLabel.style.color = "#fff";
    nameLabel.style.fontWeight = "bold";
    nameLabel.innerText = playerName;

    const select = document.createElement("select");
    select.style.cssText =
      "padding: 5px; background: #222; color: #0df; border: 1px solid #0df; border-radius: 3px; max-width: 200px;";

    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.innerText = "Ninguno / Default";
    select.appendChild(defaultOpt);

    for (const [actorId, actorData] of Object.entries(dbActoresCache)) {
      const opt = document.createElement("option");
      opt.value = actorId;
      const tag = actorData.tipo ? `[${actorData.tipo}] ` : "[NPC] ";
      opt.innerText = tag + actorData.nombre;
      if (playerData.actorId === actorId) {
        opt.selected = true;
      }
      select.appendChild(opt);
    }

    select.addEventListener("change", (e) => {
      const selectedActorId = e.target.value;
      db.ref(`campaña/jugadores/${playerName}`)
        .update({
          actorId: selectedActorId,
        })
        .then(() => {
          console.log(`Actor asignado a ${playerName}: ${selectedActorId}`);
        })
        .catch((err) => alert("Error al asignar actor: " + err));
    });

    row.appendChild(nameLabel);
    row.appendChild(select);
    container.appendChild(row);
  }
}

// --- LÓGICA DEL TEATRO (MODO DIRECTOR) ---

let isTheatreContinuous = false;
let continuousTimeout = null;

function iniciarAvanceContinuo(delay = 5000) {
  // the children check here was failing because the queue container always has children (or we might be advancing before rendering). Let's use queueItems length if possible, or just the queue container. But queueItems might not be in scope here. Let's use a simpler check:
  if (isTheatreContinuous) {
    if (continuousTimeout) clearTimeout(continuousTimeout);
    continuousTimeout = setTimeout(() => {
      const btn = document.getElementById("btn-theatre-avanzar");
      const dmInput = document.getElementById("dm-theatre-input");

      // Si el DM está escribiendo (input no está vacío), posponemos el avance para no interrumpirlo
      if (dmInput && dmInput.value.trim() !== "") {
        iniciarAvanceContinuo(2000); // Check again in 2 seconds
        return;
      }

      if (btn) btn.click();
    }, delay);
  }
}

// Toggle Exit
document.getElementById("btn-exit-theatre").addEventListener("click", () => {
  document.getElementById("theatre-view-dm").style.display = "none";
  document.querySelector(".dm-tabs-nav").style.display = "flex";
  document.querySelector(".dm-tabs-content").style.display = "flex";
  db.ref("campaña/teatro").update({ activo: false });
});

// When entering Modo Director, set active true
document.getElementById("btn-modo-director").addEventListener("click", () => {
  db.ref("campaña/teatro").update({ activo: true });
});

// Lock Toggle
document.getElementById("dm-theatre-lock").addEventListener("change", (e) => {
  db.ref("campaña/teatro").update({ bloqueado: e.target.checked });
});

// Listen to Lock
db.ref("campaña/teatro/bloqueado").on("value", (snap) => {
  const bloqueado = snap.val();
  const cb = document.getElementById("dm-theatre-lock");
  if (cb) cb.checked = !!bloqueado;
});

// Max Sprites Change
document
  .getElementById("dm-theatre-max-sprites")
  .addEventListener("change", (e) => {
    const val = parseInt(e.target.value) || 4;
    db.ref("campaña/teatro").update({ max_sprites: val });
  });

// Continuous Mode Toggle
document
  .getElementById("dm-theatre-continuous")
  .addEventListener("change", (e) => {
    db.ref("campaña/teatro").update({ continuo: e.target.checked });
  });

// Listen to Continuous Mode
db.ref("campaña/teatro/continuo").on("value", (snap) => {
  const continuo = snap.val();
  isTheatreContinuous = !!continuo;
  const cb = document.getElementById("dm-theatre-continuous");
  if (cb) cb.checked = isTheatreContinuous;
});

// Desbloquear Alijo (Stash) a Jugadores
const stashToggle = document.getElementById("dm-stash-unlock");
if (stashToggle) {
  // Sync initial state
  db.ref("campaña/ajustes_globales/alijo_desbloqueado").on("value", (snap) => {
    stashToggle.checked = snap.val() === true;
  });

  // Handle change
  stashToggle.addEventListener("change", (e) => {
    db.ref("campaña/ajustes_globales").update({
      alijo_desbloqueado: e.target.checked,
    });
  });
}

// Update Location
document.getElementById("btn-update-location").addEventListener("click", () => {
  const loc = document.getElementById("dm-theatre-location").value.trim();
  if (loc) {
    db.ref("campaña/teatro").update({ locacion: loc });
    document.getElementById("theatre-location-text").innerText = loc;
  }
});

// Update Background
document.getElementById("btn-update-bg").addEventListener("click", () => {
  const bg = document.getElementById("dm-theatre-bg").value.trim();
  if (bg) {
    db.ref("campaña/teatro").update({ fondo: bg });
  }
});

document.getElementById("btn-clear-queue").addEventListener("click", () => {
  if (
    confirm("¿Estás seguro de que quieres limpiar toda la cola de actuación?")
  ) {
    db.ref("campaña/teatro/cola").remove();
  }
});

// Listen to Location
db.ref("campaña/teatro/locacion").on("value", (snap) => {
  const loc = snap.val();
  if (loc) {
    document.getElementById("theatre-location-text").innerText = loc;
    const locInput = document.getElementById("dm-theatre-location");
    if (locInput && document.activeElement !== locInput) {
      locInput.value = loc;
    }
  }
});

// Listen to Background
db.ref("campaña/teatro/fondo").on("value", (snap) => {
  const bg = snap.val();
  const view = document.getElementById("theatre-view-dm");
  if (view && bg) {
    view.style.backgroundImage = `url('${bg}')`;
  }
  if (bg) {
    const bgInput = document.getElementById("dm-theatre-bg");
    if (bgInput && document.activeElement !== bgInput) {
      bgInput.value = bg;
    }
  }
});

// Listen to Log
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

// --- Escenario / Active Roster Logic ---
let escenarioActores = [];
let activeSpeakerId = null;

function renderEscenario() {
  const container = document.getElementById("dm-escenario");
  if (!container) return;
  container.innerHTML = "";

  escenarioActores.forEach((actorId) => {
    const actorData = dbActoresCache[actorId];
    if (!actorData) return;

    const isSpeaker = actorId === activeSpeakerId;
    const imgUrl =
      actorData.icono ||
      actorData.sprite ||
      "https://via.placeholder.com/40/222222/ffffff?text=?";
    const badgeColor = actorData.tipo === "Jugador" ? "#0df" : "#ff4444";

    const avatarDiv = document.createElement("div");
    avatarDiv.style.cssText = `
                position: relative; width: 45px; height: 45px; cursor: pointer; border-radius: 50%;
                border: 2px solid ${isSpeaker ? "#c49a00" : "#444"};
                box-shadow: ${isSpeaker ? "0 0 10px rgba(196,154,0,0.8)" : "none"};
                transition: all 0.2s ease;
                background-image: url('${imgUrl}'); background-size: cover; background-position: center;
                flex-shrink: 0;
            `;

    const removeBtn = document.createElement("div");
    removeBtn.innerHTML = "&times;";
    removeBtn.style.cssText = `
                position: absolute; top: -5px; right: -5px; background: #ff4444; color: white;
                border-radius: 50%; width: 15px; height: 15px; font-size: 12px; line-height: 15px;
                text-align: center; font-weight: bold; cursor: pointer; border: 1px solid #111;
            `;

    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      escenarioActores = escenarioActores.filter((id) => id !== actorId);
      if (activeSpeakerId === actorId) {
        activeSpeakerId = null;
        document.getElementById("dm-expression-select").style.display = "none";
      }
      renderEscenario();
    });

    avatarDiv.addEventListener("click", () => {
      activeSpeakerId = actorId;
      renderEscenario();

      // Update Expressions
      const exprSelect = document.getElementById("dm-expression-select");
      exprSelect.innerHTML = "";
      if (
        actorData.expresiones &&
        Object.keys(actorData.expresiones).length > 1
      ) {
        exprSelect.style.display = "block";
        for (const [name, url] of Object.entries(actorData.expresiones)) {
          const opt = document.createElement("option");
          opt.value = url;
          opt.innerText = name;
          exprSelect.appendChild(opt);
        }
      } else {
        exprSelect.style.display = "none";
      }
    });

    avatarDiv.appendChild(removeBtn);
    container.appendChild(avatarDiv);
  });
}

function renderModalLlamarEscena(filtro = "NPC") {
  const container = document.getElementById("lista-llamar-escena");
  if (!container) return;
  container.innerHTML = "";

  for (const [actorId, actorData] of Object.entries(dbActoresCache)) {
    const tipoActor = actorData.tipo || "NPC";
    if (
      (filtro === "NPC" && tipoActor !== "NPC") ||
      (filtro === "Jugador" && tipoActor !== "Jugador")
    ) {
      continue;
    }

    const imgUrl =
      actorData.icono ||
      actorData.sprite ||
      "https://via.placeholder.com/60/222222/ffffff?text=?";

    const card = document.createElement("div");
    card.style.cssText =
      "background: #222; border: 1px solid #444; border-radius: 4px; padding: 5px; width: 100px; display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: 0.2s ease;";

    card.innerHTML = `
                <img src="${imgUrl}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 1px solid ${actorData.color_titulo || "#555"}; margin-bottom: 5px;">
                <span style="color: ${actorData.color_nombre || "#fff"}; font-size: 12px; text-align: center; word-break: break-word;">${actorData.nombre}</span>
            `;

    card.addEventListener("mouseover", () => (card.style.borderColor = "#0df"));
    card.addEventListener("mouseout", () => (card.style.borderColor = "#444"));

    card.addEventListener("click", () => {
      if (!escenarioActores.includes(actorId)) {
        escenarioActores.push(actorId);
        renderEscenario();
      }
      document.getElementById("modal-llamar-escena").style.display = "none";
    });

    container.appendChild(card);
  }
}

document.getElementById("btn-llamar-escena").addEventListener("click", () => {
  document.getElementById("modal-llamar-escena").style.display = "flex";
  renderModalLlamarEscena("NPC"); // Default tab
  document.getElementById("tab-escena-npcs").style.background = "#222";
  document.getElementById("tab-escena-npcs").style.color = "#0df";
  document.getElementById("tab-escena-jugadores").style.background = "#111";
  document.getElementById("tab-escena-jugadores").style.color = "#888";
});

document
  .getElementById("btn-cerrar-modal-escena")
  .addEventListener("click", () => {
    document.getElementById("modal-llamar-escena").style.display = "none";
  });

document.getElementById("tab-escena-npcs").addEventListener("click", (e) => {
  e.target.style.background = "#222";
  e.target.style.color = "#0df";
  document.getElementById("tab-escena-jugadores").style.background = "#111";
  document.getElementById("tab-escena-jugadores").style.color = "#888";
  renderModalLlamarEscena("NPC");
});

document
  .getElementById("tab-escena-jugadores")
  .addEventListener("click", (e) => {
    e.target.style.background = "#222";
    e.target.style.color = "#0df";
    document.getElementById("tab-escena-npcs").style.background = "#111";
    document.getElementById("tab-escena-npcs").style.color = "#888";
    renderModalLlamarEscena("Jugador");
  });

let queueItems = [];
window.queueItems = queueItems;
// Listen to Queue
db.ref("campaña/teatro/cola").on("value", (snap) => {
  const queueContainer = document.getElementById("dm-theatre-queue");
  if (!queueContainer) return;
  queueContainer.innerHTML = "";
  queueItems = [];
  window.queueItems = queueItems;
  const cola = snap.val();
  if (!cola) {
    queueContainer.innerHTML =
      '<span style="color: #666; text-align: center;">La cola está vacía.</span>';
    return;
  }

  // Convert to array and maintain Firebase's push order (keys are chronological)
  for (const [key, msgData] of Object.entries(cola)) {
    queueItems.push({ key: key, ...msgData });
    const itemDiv = document.createElement("div");
    itemDiv.style.cssText =
      "padding: 5px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; gap: 5px;";
    itemDiv.innerHTML = `
                <div style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
                    <span class="queue-item-blink" style="font-size: 12px; margin-bottom: 2px;">[${msgData.nombre}]</span>
                    <span style="color: #ccc; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${msgData.mensaje}">${msgData.mensaje}</span>
                </div>
                <div style="display: flex; gap: 5px; flex-shrink: 0;">
                    <button class="btn-aprobar-cola" data-key="${key}" style="background: #004400; color: #fff; border: 1px solid #00ff00; border-radius: 3px; cursor: pointer; font-size: 10px; padding: 3px 5px;" title="Aprobar">✓</button>
                    <button class="btn-editar-cola" data-key="${key}" style="background: #222; color: #0df; border: 1px solid #0df; border-radius: 3px; cursor: pointer; font-size: 10px; padding: 3px 5px;" title="Editar">✏️</button>
                    <button class="btn-eliminar-cola" data-key="${key}" style="background: #440000; color: #fff; border: 1px solid #ff0000; border-radius: 3px; cursor: pointer; font-size: 10px; padding: 3px 5px;" title="Rechazar/Eliminar">X</button>
                </div>
            `;

    const btnAprobar = itemDiv.querySelector(".btn-aprobar-cola");
    btnAprobar.addEventListener("click", (e) => {
      e.stopPropagation();
      // Move directly to estado_actual
      const state = {
        nombre: msgData.nombre || "",
        titulo: msgData.titulo || "",
        color_nombre: msgData.color_nombre || "#ffffff",
        color_titulo: msgData.color_titulo || "#c49a00",
        escala: msgData.escala !== undefined ? msgData.escala : 1.0,
        sprite: msgData.sprite || "",
        mensaje: msgData.mensaje || "",
        timestamp: Date.now(),
      };
      db.ref("campaña/teatro/estado_actual")
        .set(state)
        .then(() => {
          if (state.mensaje) {
            db.ref("campaña/teatro/log").push(state);
          }
          db.ref(`campaña/teatro/cola/${key}`).remove();
        });
    });

    const btnEditar = itemDiv.querySelector(".btn-editar-cola");
    btnEditar.addEventListener("click", (e) => {
      e.stopPropagation();
      const nuevoMensaje = prompt("Edita el mensaje:", msgData.mensaje);
      if (nuevoMensaje !== null && nuevoMensaje.trim() !== "") {
        db.ref(`campaña/teatro/cola/${key}`).update({
          mensaje: nuevoMensaje.trim(),
        });
      }
    });

    const btnEliminar = itemDiv.querySelector(".btn-eliminar-cola");
    btnEliminar.addEventListener("click", (e) => {
      e.stopPropagation();
      db.ref(`campaña/teatro/cola/${key}`).remove();
    });

    queueContainer.appendChild(itemDiv);
  }

  // Reactivar ciclo de avance continuo si estamos en dicho modo y la cola se llena
  const textBox = document.getElementById("theatre-dialogue-text");
  const isTypingText = textBox && textBox.typewriterInterval;

  if (
    isTheatreContinuous &&
    !continuousTimeout &&
    !isTypingText &&
    queueItems.length > 0
  ) {
    iniciarAvanceContinuo(5000);
  }
});

// Si el DM borra su texto, el modo continuo debería reactivarse (verificar la cola)
document.getElementById("dm-theatre-input").addEventListener("input", (e) => {
  if (isTheatreContinuous && e.target.value.trim() === "") {
    const textBox = document.getElementById("theatre-dialogue-text");
    const isTypingText = textBox && textBox.typewriterInterval;

    if (!continuousTimeout && !isTypingText && queueItems.length > 0) {
      iniciarAvanceContinuo(5000);
    }
  }
});

let currentMaxSprites = 4;
db.ref("campaña/teatro/max_sprites").on("value", (snap) => {
  const val = snap.val();
  if (val) {
    currentMaxSprites = parseInt(val) || 4;
    const maxSpritesInput = document.getElementById("dm-theatre-max-sprites");
    if (maxSpritesInput) {
      maxSpritesInput.value = currentMaxSprites;
    }
  }
});

// Render Stage and UI based on current state locally to see what players see
let currentSpritesEnEscena = new Set();

db.ref("campaña/teatro/estado_actual").on("value", (snap) => {
  const state = snap.val();
  if (!state) return;

  // Update text plates
  const titlePlate = document.getElementById("theatre-plate-title");
  const namePlate = document.getElementById("theatre-plate-name");
  const textBox = document.getElementById("theatre-dialogue-text");

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
    } else {
      titlePlate.innerText = state.titulo || "";
    }
    titlePlate.style.color = state.color_titulo || "#d69c52";
    titlePlate.style.borderColor = state.color_titulo || "#c49a00";
  }
  /* The title plate color requirement was: background dark brown, text gold.
           If the user wants the custom color to apply to text: */
  titlePlate.style.color = state.color_titulo || "#d69c52";
  titlePlate.style.borderColor = state.color_titulo || "#c49a00";

  namePlate.innerText = state.nombre || "Desconocido";
  namePlate.style.backgroundColor = state.color_nombre || "#416268";
  namePlate.style.color = "#ffffff";

  // Typewriter effect
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

        iniciarAvanceContinuo(5000); // Siempre esperar 5 segundos al terminar de escribir
      }
    }, 30); // 30ms per character
  } else {
    iniciarAvanceContinuo(5000); // Siempre esperar 5 segundos al terminar de escribir
  }

  // Manage Sprites on Stage
  const stage = document.getElementById("theatre-stage-container");
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

  // Ensure we track by name to update expressions instead of duplicating
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
    currentSpritesEnEscena.add(activeName);
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

    // Limit to max sprites for visual clarity, remove oldest if needed
    while (stage.children.length > currentMaxSprites) {
      let oldestWrapper = Array.from(stage.children).reduce(
        (oldest, current) => {
          let oldestTime = parseInt(oldest.dataset.lastActive || 0);
          let currentTime = parseInt(current.dataset.lastActive || 0);
          return oldestTime < currentTime ? oldest : current;
        },
      );
      if (oldestWrapper) {
        currentSpritesEnEscena.delete(oldestWrapper.dataset.name);
        stage.removeChild(oldestWrapper);
      } else {
        break;
      }
    }
  }

  // Apply active/dimmed classes
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

  // Aseguramos que el auto-advance se detona si no hubo mensaje (ej. solo cambio de imagen)
  if (!fullText || fullText.length === 0) {
    iniciarAvanceContinuo(5000); // Siempre esperar 5 segundos al terminar de escribir
  }
});

// Stop continuous advance on DM input
document.getElementById("dm-theatre-input").addEventListener("input", (e) => {
  if (continuousTimeout) clearTimeout(continuousTimeout);
  // Si se borra el input, se puede reactivar
  if (isTheatreContinuous && e.target.value.trim() === "") {
    const textBox = document.getElementById("theatre-dialogue-text");
    const isTypingText = textBox && textBox.typewriterInterval;
    if (!isTypingText && queueItems.length > 0) {
      iniciarAvanceContinuo(5000);
    }
  }
});

// Entrar a Escena / Avanzar
document
  .getElementById("btn-theatre-avanzar")
  .addEventListener("click", (e) => {
    if (continuousTimeout) clearTimeout(continuousTimeout);
    const dmInput = document.getElementById("dm-theatre-input").value.trim();
    const selectedNpcId = activeSpeakerId;

    // Validar si es llamada automática y DM escribió
    if (e && !e.isTrusted && e.cancelable && dmInput !== "") {
      return;
    }

    // Priority 1: DM Input (Overrides Queue)
    if (dmInput) {
      let state;
      if (selectedNpcId) {
        const actorData = dbActoresCache[selectedNpcId];
        if (actorData) {
          const exprSelect = document.getElementById("dm-expression-select");
          const selectedSprite =
            exprSelect && exprSelect.style.display !== "none"
              ? exprSelect.value
              : actorData.sprite;

          state = {
            nombre: actorData.nombre,
            titulo: actorData.titulo,
            color_nombre: actorData.color_nombre,
            color_titulo: actorData.color_titulo,
            escala: actorData.escala !== undefined ? actorData.escala : 1.0,
            sprite: selectedSprite,
            mensaje: dmInput,
            timestamp: Date.now(),
          };
        }
      } else {
        // Narrator Mode (No NPC selected)
        state = {
          nombre: "",
          titulo: "",
          color_nombre: "transparent",
          color_titulo: "transparent",
          escala: 1.0,
          sprite: "",
          mensaje: dmInput,
          timestamp: Date.now(),
        };
      }

      if (state) {
        db.ref("campaña/teatro/estado_actual").set(state);
        if (state.mensaje) {
          db.ref("campaña/teatro/log").push(state);
        }
        document.getElementById("dm-theatre-input").value = ""; // clear input
        return;
      }
    }

    // Priority 2: Queue Processing
    if (queueItems.length > 0) {
      const nextItem = queueItems[0];
      const state = {
        nombre: nextItem.nombre,
        titulo: nextItem.titulo,
        color_nombre: nextItem.color_nombre,
        color_titulo: nextItem.color_titulo,
        escala: nextItem.escala !== undefined ? nextItem.escala : 1.0,
        sprite: nextItem.sprite,
        mensaje: nextItem.mensaje,
        timestamp: Date.now(),
      };

      // Push to current state
      db.ref("campaña/teatro/estado_actual")
        .set(state)
        .then(() => {
          if (state.mensaje) {
            db.ref("campaña/teatro/log").push(state);
          }
          // Remove from queue
          db.ref(`campaña/teatro/cola/${nextItem.key}`).remove();
        });
    } else {
      console.log("No hay mensajes en cola y el DM no escribió nada.");
    }
  });

document.getElementById("btn-crear-actor").addEventListener("click", () => {
  const nombre = document.getElementById("actor-nombre").value.trim();
  const titulo = document.getElementById("actor-titulo").value.trim();
  const colorNombre = document.getElementById("actor-color-nombre").value;
  const colorTitulo = document.getElementById("actor-color-titulo").value;
  const escala =
    parseFloat(document.getElementById("actor-escala").value) || 1.0;
  const sprite = document.getElementById("actor-sprite").value.trim();
  let icono = document.getElementById("actor-icono").value.trim();
  const tipo = document.getElementById("actor-tipo-jugador").checked
    ? "Jugador"
    : "NPC";

  if (!nombre || !sprite) {
    alert("El nombre del personaje y la URL del sprite son obligatorios.");
    return;
  }

  if (!icono) {
    icono = sprite; // Fallback
  }

  const isEditing = editModeActorKey !== null;
  const idActor = isEditing
    ? editModeActorKey
    : nombre.toLowerCase().replace(/[^a-z0-9]/g, "_");

  const expresiones = {
    Neutral: sprite,
  };

  const exprRows = document.querySelectorAll(
    "#actor-expresiones-container > div",
  );
  exprRows.forEach((row) => {
    const name = row.querySelector(".actor-expresion-name").value.trim();
    const url = row.querySelector(".actor-expresion-url").value.trim();
    if (name && url) {
      expresiones[name] = url;
    }
  });

  const actorData = {
    nombre: nombre,
    titulo: titulo,
    color_nombre: colorNombre,
    color_titulo: colorTitulo,
    escala: escala,
    icono: icono,
    tipo: tipo,
    sprite: sprite,
    expresiones: expresiones,
  };

  if (isEditing) {
    db.ref(`campaña/actores/${editModeActorKey}`)
      .update(actorData)
      .then(() => {
        alert(`Actor '${nombre}' actualizado exitosamente.`);
        resetActorForm();
      })
      .catch((e) => alert("Error actualizando actor: " + e));
  } else {
    db.ref(`campaña/actores/${idActor}`)
      .set(actorData)
      .then(() => {
        alert(`Actor '${nombre}' creado exitosamente.`);
        resetActorForm();
      })
      .catch((e) => alert("Error creando actor: " + e));
  }
});

// Lógica del Modal de Stats de Combate
let activePlayerIdForModal = null;

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("btn-open-modal")) {
    const playerId = e.target.getAttribute("data-id");
    activePlayerIdForModal = playerId;

    // Set Title
    document.getElementById("dm-combat-modal-title").innerText =
      `⚙️ STATS DE COMBATE - ${playerId}`;

    // Obtener los datos actuales o poner defaults
    const playerData =
      window.jugadoresData && window.jugadoresData[playerId]
        ? window.jugadoresData[playerId]
        : {};
    const combatStats = playerData.combatStats || {};

    const lvl = playerData.level || 1;
    const xp = playerData.xp || 0;
    const hpBase = combatStats.hp_base || playerData.hp_base || 0;
    const hpCoef = combatStats.hp_coefficient || playerData.hp_coefficient || 0;
    const defLvlMod = combatStats.def_lvl_mod || 0;
    const totalDefLvl = lvl + defLvlMod;
    const calcHpMax = Math.floor(hpBase + totalDefLvl * hpCoef);
    const hpMax = calcHpMax || 0;
    const hpActual =
      combatStats.hp_actual !== undefined ? combatStats.hp_actual : hpMax;

    // Poblar inputs
    document.getElementById("dm-player-xp").value = xp;
    document.getElementById("dm-hp-max").value = hpMax;
    document.getElementById("dm-hp-actual").value = hpActual;
    document.getElementById("dm-hp-base").value = hpBase;
    document.getElementById("dm-coef").value = hpCoef;
    document.getElementById("dm-def-lvl").value = combatStats.def_lvl_mod || 0;
    document.getElementById("dm-off-lvl").value = combatStats.off_lvl_mod || 0;
    document.getElementById("dm-sp").value = combatStats.sp_actual || 0;
    document.getElementById("dm-action-slots").value =
      combatStats.action_slots || 1;

    // Stagger es array, convertir a string para el input
    let staggerVal = "";
    if (Array.isArray(combatStats.stagger_thresholds)) {
      staggerVal = combatStats.stagger_thresholds.join(", ");
    }
    document.getElementById("dm-stagger").value = staggerVal;

    // Mostrar Modal
    document.getElementById("dm-combat-modal").style.display = "flex";
  }
});

document.getElementById("btn-close-modal").addEventListener("click", () => {
  document.getElementById("dm-combat-modal").style.display = "none";
  activePlayerIdForModal = null;
});

document.getElementById("btn-save-stats").addEventListener("click", () => {
  if (!activePlayerIdForModal) return;

  const xpInput = parseInt(document.getElementById("dm-player-xp").value) || 0;
  const hpActual = parseInt(document.getElementById("dm-hp-actual").value) || 0;
  const hpBase = parseInt(document.getElementById("dm-hp-base").value) || 0;
  const hpCoef = parseFloat(document.getElementById("dm-coef").value) || 0;
  const defLvl = parseInt(document.getElementById("dm-def-lvl").value) || 0;
  const offLvl = parseInt(document.getElementById("dm-off-lvl").value) || 0;
  let sp = parseInt(document.getElementById("dm-sp").value) || 0;
  const actionSlots =
    parseInt(document.getElementById("dm-action-slots").value) || 1;
  const staggerStr = document.getElementById("dm-stagger").value;

  // Forzar rango matemático
  sp = Math.max(-45, Math.min(45, sp));

  // Convertir string de stagger a array de números
  let staggerArr = [];
  if (staggerStr.trim() !== "") {
    staggerArr = staggerStr
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n));
  }

  const updates = {};

  let calculatedLvlData = null;
  if (typeof calculateLevelData === "function") {
    calculatedLvlData = calculateLevelData(xpInput);
  }

  let newLevel = 1;
  if (
    window.jugadoresData &&
    window.jugadoresData[activePlayerIdForModal] &&
    window.jugadoresData[activePlayerIdForModal].level
  ) {
    newLevel = window.jugadoresData[activePlayerIdForModal].level;
  }

  if (calculatedLvlData) {
    newLevel = calculatedLvlData.level;
    updates[`campaña/jugadores/${activePlayerIdForModal}/xp`] = xpInput;
    updates[`campaña/jugadores/${activePlayerIdForModal}/level`] =
      calculatedLvlData.level;
    updates[`campaña/jugadores/${activePlayerIdForModal}/xpPercent`] =
      calculatedLvlData.xpPercent;
    updates[`campaña/jugadores/${activePlayerIdForModal}/xpMissing`] =
      calculatedLvlData.xpMissing;
  } else {
    updates[`campaña/jugadores/${activePlayerIdForModal}/xp`] = xpInput;
  }

  const hpMax = Math.floor(hpBase + (newLevel + defLvl) * hpCoef);

  // Actualizar en root node para compatibilidad con la hoja de personaje
  updates[`campaña/jugadores/${activePlayerIdForModal}/hp_base`] = hpBase;
  updates[`campaña/jugadores/${activePlayerIdForModal}/hp_coefficient`] =
    hpCoef;
  updates[`campaña/jugadores/${activePlayerIdForModal}/hp_max`] = hpMax;

  // Actualizar el nodo de combatStats (sobreescribe completo)
  updates[`campaña/jugadores/${activePlayerIdForModal}/combatStats`] = {
    hp_max: hpMax,
    hp_actual: hpActual,
    hp_base: hpBase,
    hp_coefficient: hpCoef,
    def_lvl_mod: defLvl,
    off_lvl_mod: offLvl,
    sp_actual: sp,
    action_slots: actionSlots,
    stagger_thresholds: staggerArr,
  };

  db.ref()
    .update(updates)
    .then(() => {
      document.getElementById("dm-combat-modal").style.display = "none";
      activePlayerIdForModal = null;
      // Pequeña alerta o feedback visual opcional
    })
    .catch((err) => {
      console.error("Error actualizando stats de combate:", err);
      alert("Hubo un error al guardar los cambios.");
    });
});
