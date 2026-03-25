const fs = require('fs');
const path = 'hoja_personaje.js';
let content = fs.readFileSync(path, 'utf8');

const searchStr = `        const skillTotal = baseVal + modVal;

        let sp = parseInt(pd.combatStats?.sp_actual ?? pd.sp) || 0;
        if (sp > 45) sp = 45;
        if (sp < -45) sp = -45;

        // Heads Probability = 50 + SP
        const probHeads = 50 + sp;

        // Roll 5 coins
        let headsCount = 0;
        const container = document.getElementById("coin-toss-coins-container");
        if (container) container.innerHTML = ""; // Clear old coins

        for (let i = 0; i < 5; i++) {
          const roll = Math.random() * 100;
          const isHeads = roll < probHeads;

          const img = document.createElement("img");
          img.className = "coin-img";
          if (isHeads) {
            img.src = "https://imgur.com/yshLPnQ.png";
            img.classList.add("coin-heads");
            headsCount++;
          } else {
            img.src = "https://imgur.com/XDx0ICt.png";
          }
          if (container) container.appendChild(img);
        }

        const finalResult = headsCount * 3 + skillTotal;

        // Update UI
        const nameEl = document.getElementById("coin-toss-skill-name");
        if (nameEl) nameEl.textContent = displayName;

        const resultEl = document.getElementById("coin-toss-total-result");
        if (resultEl) resultEl.textContent = finalResult;

        const panel = document.getElementById("coin-toss-panel");
        if (panel) panel.style.display = "flex";

        // Send to Theatre of the Mind Log
        if (typeof db !== "undefined" && db.ref) {
          try {
            const actorSelect = document.getElementById("player-actor-select");
            const selectExp = document.getElementById(
              "player-expression-select",
            );

            const assignedActorId = window.datosJugador?.actorId || null;
            const selectedActorId = assignedActorId
              ? assignedActorId
              : actorSelect
                ? actorSelect.value
                : "base";

            let actorParaEnviar = {
              nombre: pd.characterName || "Jugador",
              titulo: "",
              color_nombre: "#ffffff",
              color_titulo: "#aaaaaa",
              escala: 1.0,
              sprite: "https://i.imgur.com/kP8s7Ww.png",
            };

            if (
              selectedActorId &&
              selectedActorId !== "base" &&
              window.actoresJugador &&
              window.actoresJugador[selectedActorId]
            ) {
              const dataActor = window.actoresJugador[selectedActorId];
              if (dataActor) {
                actorParaEnviar = {
                  nombre: dataActor.nombre || actorParaEnviar.nombre,
                  titulo: dataActor.titulo || "",
                  color_nombre: dataActor.color_nombre || "#ffffff",
                  color_titulo: dataActor.color_titulo || "#aaaaaa",
                  escala:
                    dataActor.escala !== undefined
                      ? parseFloat(dataActor.escala)
                      : 1.0,
                  sprite: dataActor.sprite || actorParaEnviar.sprite,
                };
              }
            }

            let selectedSprite = actorParaEnviar.sprite;
            try {
              if (
                selectExp &&
                selectExp.style.display !== "none" &&
                selectExp.options.length > 0
              ) {
                const val = selectExp.value;
                if (val && val.trim() !== "") {
                  selectedSprite = val;
                }
              }
            } catch (e) {
              console.warn("Fallo leyendo expresión, usando sprite base.", e);
            }

            const msgText = \`Tira [\${displayName}]: Resultado: \${finalResult} (\${headsCount * 3} Caras + \${skillTotal} Modificador)\`;

            const payload = {
              nombre: actorParaEnviar.nombre || "Jugador",
              titulo: actorParaEnviar.titulo || "",
              color_nombre: actorParaEnviar.color_nombre || "#ffffff",
              color_titulo: actorParaEnviar.color_titulo || "#aaaaaa",
              escala: isNaN(actorParaEnviar.escala)
                ? 1.0
                : actorParaEnviar.escala,
              sprite: selectedSprite || "https://i.imgur.com/kP8s7Ww.png",
              icono:
                actorParaEnviar.icono ||
                "https://via.placeholder.com/80/000000/ffffff?text=J",
              mensaje: msgText,
              timestamp: Date.now(),
            };

            db.ref("campaña/teatro/cola")
              .push(payload)
              .catch((e) => {
                console.error("Error enviando tirada a la cola del teatro:", e);
              });
          } catch (err) {
            console.error("Fallo enviando tirada al teatro de la mente:", err);
          }
        }
      }`;

const replacementStr = `        const skillTotal = baseVal + modVal;

        let sp = parseInt(pd.combatStats?.sp_actual ?? pd.sp) || 0;

        // Heads Probability = 50 + SP (min 5, max 100)
        let probHeads = 50 + sp;
        if (probHeads < 5) probHeads = 5;
        if (probHeads > 100) probHeads = 100;

        const container = document.getElementById("coin-toss-coins-container");
        if (container) container.innerHTML = "";

        const nameEl = document.getElementById("coin-toss-skill-name");
        if (nameEl) nameEl.textContent = displayName;

        const statsEl = document.getElementById("coin-toss-stats");
        if (statsEl) statsEl.textContent = \`Probabilidad de Heads: \${probHeads}%\`;

        const resultEl = document.getElementById("roll-total-score");
        let currentTotal = skillTotal;
        if (resultEl) resultEl.textContent = currentTotal;

        const closeBtn = document.getElementById("coin-toss-close-btn");
        if (closeBtn) {
            closeBtn.disabled = true;
            closeBtn.style.opacity = "0.5";
            closeBtn.style.cursor = "not-allowed";
        }

        const panel = document.getElementById("coin-toss-panel");
        if (panel) panel.style.display = "flex";

        let coinsStopped = 0;
        const totalCoins = 5;

        // Auto-Toss Toggle status
        const autoTossToggle = document.getElementById("auto-toss-toggle");
        const isAuto = autoTossToggle ? autoTossToggle.checked : false;

        // Generate the 5 coins
        for (let i = 0; i < totalCoins; i++) {
          const coinWrapper = document.createElement("div");
          coinWrapper.className = "coin-toss-item";
          coinWrapper.style.width = "60px";
          coinWrapper.style.height = "60px";
          coinWrapper.style.position = "relative";
          coinWrapper.style.cursor = isAuto ? "default" : "pointer";

          const coinImg = document.createElement("img");
          coinImg.src = "https://imgur.com/XDx0ICt.png"; // Girando / Cruz
          coinImg.style.width = "100%";
          coinImg.style.height = "100%";
          coinImg.style.objectFit = "cover";
          coinImg.style.transition = "transform 0.3s";

          // Basic CSS animation to simulate spinning
          const spinAnim = coinImg.animate(
            [
              { transform: 'rotateY(0deg)' },
              { transform: 'rotateY(360deg)' }
            ],
            {
              duration: 400,
              iterations: Infinity
            }
          );

          coinWrapper.appendChild(coinImg);
          if (container) container.appendChild(coinWrapper);

          const stopCoin = () => {
            if (coinWrapper.dataset.stopped === "true") return;
            coinWrapper.dataset.stopped = "true";

            spinAnim.cancel();

            const roll = Math.random() * 100;
            const isHeads = roll < probHeads;

            if (isHeads) {
              coinImg.src = "https://imgur.com/yshLPnQ.png"; // Cara / Heads
              currentTotal += 3;
              if (resultEl) resultEl.textContent = currentTotal;
            } else {
              coinImg.src = "https://imgur.com/XDx0ICt.png"; // Visual Cruz
              coinImg.style.filter = "grayscale(100%)";
            }

            coinsStopped++;
            if (coinsStopped >= totalCoins) {
              if (closeBtn) {
                closeBtn.disabled = false;
                closeBtn.style.opacity = "1";
                closeBtn.style.cursor = "pointer";
              }
            }
          };

          if (!isAuto) {
            coinWrapper.addEventListener("click", stopCoin);
          } else {
            setTimeout(stopCoin, (i + 1) * 600);
          }
        }`;

if (content.includes(searchStr)) {
  content = content.replace(searchStr, replacementStr);
  console.log("Replaced coin toss logic");
} else {
  console.log("Could not find coin toss block");
}

const closeSearchStr = `      const closeBtn = e.target.closest("#btn-close-coin-toss");
      if (closeBtn) {
        const panel = document.getElementById("coin-toss-panel");
        if (panel) panel.style.display = "none";
      }`;

const closeReplaceStr = `      const closeBtn = e.target.closest("#coin-toss-close-btn");
      if (closeBtn && !closeBtn.disabled) {
        const panel = document.getElementById("coin-toss-panel");
        if (panel) panel.style.display = "none";
      }`;

if (content.includes(closeSearchStr)) {
  content = content.replace(closeSearchStr, closeReplaceStr);
  console.log("Replaced close button logic");
} else {
  console.log("Could not find close button block");
}


const initSearchStr = `function initializeCharacterSheet() {`;
const initReplaceStr = `function initializeCharacterSheet() {
  // Sync Auto-Toss toggle state
  const autoTossToggle = document.getElementById("auto-toss-toggle");
  if (autoTossToggle) {
    const savedState = localStorage.getItem("autoTossState");
    if (savedState === "true") {
      autoTossToggle.checked = true;
    }
    autoTossToggle.addEventListener("change", (e) => {
      localStorage.setItem("autoTossState", e.target.checked);
    });
  }`;

if (content.includes(initSearchStr) && !content.includes("localStorage.getItem(\"autoTossState\")")) {
  content = content.replace(initSearchStr, initReplaceStr);
  console.log("Added init code for Auto-Toss toggle");
}

fs.writeFileSync(path, content, 'utf8');
