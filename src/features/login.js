import { db } from "../core/firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
  const titleScreen = document.getElementById("title-screen");
  const loginScreen = document.getElementById("login-screen");
  const titlePrompt = document.getElementById("title-prompt");
  const playerIdInput = document.getElementById("player-id-input");
  const btnLogin = document.getElementById("btn-login");
  const loginStatus = document.getElementById("login-status");

  titlePrompt.textContent = "Click para Ingresar";

  titleScreen.addEventListener("click", () => {
    titleScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    playerIdInput.focus();
  });

  const handleLogin = () => {
    const rawId = playerIdInput.value.trim();
    if (!rawId) return;

    // Quitamos .toLowerCase() para respetar mayúsculas de los perfiles existentes
    const userId = rawId.replace(/\s+/g, "");
    localStorage.setItem("playerId", userId);

    loginStatus.textContent = "Verificando en la base de datos...";
    btnLogin.disabled = true;

    db.ref("campaña/jugadores/" + userId)
      .once("value")
      .then((snapshot) => {
        const localStateStr = localStorage.getItem("luminousState");
        let localState = null;
        if (localStateStr) {
          try {
            localState = JSON.parse(localStateStr);
          } catch (e) {
            console.error("Error parsing local luminousState:", e);
          }
        }

        const hasMatchingLocalState =
          localState &&
          localState.characterName &&
          localState.characterName.replace(/\s+/g, "") === userId;

        if (snapshot.exists()) {
          if (hasMatchingLocalState) {
            loginStatus.textContent =
              "Sincronizando datos locales con la nube...";
            db.ref("campaña/jugadores/" + userId)
              .update(localState)
              .then(() => {
                loginStatus.textContent =
                  "Datos sincronizados. Redirigiendo...";
                setTimeout(() => {
                  window.location.href = "hoja_personaje.html";
                }, 800);
              })
              .catch((err) => {
                console.error("Firebase update error:", err);
                loginStatus.textContent =
                  "Identidad confirmada. Redirigiendo...";
                setTimeout(() => {
                  window.location.href = "hoja_personaje.html";
                }, 800);
              });
          } else {
            loginStatus.textContent = "Identidad confirmada. Redirigiendo...";
            setTimeout(() => {
              window.location.href = "hoja_personaje.html";
            }, 800);
          }
        } else {
          if (hasMatchingLocalState) {
            loginStatus.textContent =
              "Recuperando datos locales. Guardando en la nube...";
            db.ref("campaña/jugadores/" + userId)
              .set(localState)
              .then(() => {
                loginStatus.textContent = "Datos recuperados. Redirigiendo...";
                setTimeout(() => {
                  window.location.href = "hoja_personaje.html";
                }, 800);
              })
              .catch((err) => {
                console.error("Firebase save error:", err);
                loginStatus.textContent =
                  "Usuario no encontrado. Iniciando registro...";
                setTimeout(() => {
                  window.location.href = "creacion_personaje.html";
                }, 800);
              });
          } else {
            loginStatus.textContent =
              "Usuario no encontrado. Iniciando registro...";
            setTimeout(() => {
              window.location.href = "creacion_personaje.html";
            }, 800);
          }
        }
      })
      .catch((err) => {
        console.error("Firebase error:", err);
        loginStatus.textContent = "Error de conexión. Intente nuevamente.";
        loginStatus.style.color = "red";
        btnLogin.disabled = false;
      });
  };

  btnLogin.addEventListener("click", handleLogin);
  playerIdInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  });

  // Hover effect on login button
  btnLogin.addEventListener("mouseenter", () => {
    btnLogin.style.background = "var(--gold-bright)";
    btnLogin.style.color = "black";
  });
  btnLogin.addEventListener("mouseleave", () => {
    btnLogin.style.background = "transparent";
    btnLogin.style.color = "var(--gold-bright)";
  });
});
