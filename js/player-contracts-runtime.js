(function (global) {
  "use strict";

  let activeRef = null;
  let activeHandler = null;

  function dispose() {
    if (activeRef && activeHandler) activeRef.off("value", activeHandler);
    activeRef = null;
    activeHandler = null;
  }

  function init({ db, playerId }) {
    const core = global.LuminousEconomyContractsCore;
    const container = document.getElementById("player-contracts-list");
    if (!core || !db || !playerId || !container) return;

    dispose();
    activeRef = db.ref("campaña/economia/contratos");

    function render(snapshot) {
      const contracts = snapshot.val() || {};
      container.innerHTML = "";
      let visible = 0;

      Object.entries(contracts).forEach(([contractId, contract]) => {
        if (!contract || contract.status === "completed" || contract.status === "failed") return;
        const participant = core.participantFor(contract, playerId);
        if (!participant || (participant.status || "active") !== "active") return;
        visible += 1;

        const card = document.createElement("section");
        card.className = "player-contract-card";

        const title = document.createElement("h3");
        title.textContent = contract.nombre || "Contrato sin nombre";
        card.appendChild(title);

        const meta = document.createElement("div");
        meta.className = "economy-v2-meta";
        const pct = core.clampAdvancePercent(contract.porcentajeAdelanto || 0);
        meta.textContent = pct > 0
          ? `Adelanto pactado: ${pct}% · El resto se paga al completar.`
          : "Sin adelanto · Pago al completar.";
        card.appendChild(meta);

        const amounts = document.createElement("div");
        amounts.className = "player-contract-amounts";
        [
          ["Tu recompensa", participant.recompensaTotal || 0],
          ["Adelanto recibido", participant.adelantoAhn || 0],
          ["Pendiente", participant.pagoPendienteAhn ?? participant.recompensaTotal ?? 0],
        ].forEach(([label, amount]) => {
          const box = document.createElement("div");
          const small = document.createElement("span");
          small.textContent = label;
          const strong = document.createElement("strong");
          strong.textContent = `${core.positiveWhole(amount).toLocaleString("es-MX")} Ahn`;
          box.append(small, strong);
          amounts.appendChild(box);
        });
        card.appendChild(amounts);

        if (participant.legacy) {
          const legacy = document.createElement("div");
          legacy.className = "economy-v2-meta";
          legacy.textContent = "Contrato heredado: el DM debe abrir Economía una vez para migrarlo antes de poder salir desde aquí.";
          card.appendChild(legacy);
        } else {
          const leave = document.createElement("button");
          leave.type = "button";
          leave.className = "player-contract-leave";
          leave.textContent = "Salir del contrato";
          leave.addEventListener("click", async () => {
            const confirmed = global.confirm(
              `¿Seguro que quieres salir de “${contract.nombre || "este contrato"}”? Renunciarás al pago pendiente de esta misión.`
            );
            if (!confirmed) return;
            leave.disabled = true;
            try {
              await db.ref(`campaña/economia/contratos/${contractId}/participantes/${playerId}/status`).set("cancelled");
            } catch (error) {
              console.error("No se pudo cancelar la participación del contrato:", error);
              global.alert("No se pudo salir del contrato. Verifica tu conexión o permisos.");
              leave.disabled = false;
            }
          });
          card.appendChild(leave);
        }

        container.appendChild(card);
      });

      if (!visible) {
        const empty = document.createElement("div");
        empty.className = "economy-v2-empty";
        empty.textContent = "No tienes misiones activas.";
        container.appendChild(empty);
      }
    }

    activeHandler = render;
    activeRef.on("value", activeHandler, (error) => {
      console.error("Error cargando contratos del jugador:", error);
      container.innerHTML = '<div class="economy-v2-empty">No se pudieron cargar tus misiones.</div>';
    });
  }

  global.LuminousPlayerContractsRuntime = Object.freeze({ init, dispose });
})(typeof window !== "undefined" ? window : globalThis);
