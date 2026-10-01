(function (global) {
  "use strict";

  const state = {
    db: null,
    getWorldDate: null,
    players: {},
    contracts: {},
    payrollLock: null,
    initialized: false,
    migratingContracts: new Set(),
    migratingSalaries: new Set(),
  };

  const byId = (id) => document.getElementById(id);
  const core = () => global.LuminousEconomyContractsCore;

  function playerName(key) {
    return core().playerDisplayName(key, state.players[key] || {});
  }

  function currentWorldDate() {
    const value = typeof state.getWorldDate === "function" ? state.getWorldDate() : new Date();
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  function money(value) {
    return core().positiveWhole(value).toLocaleString("es-MX") + " Ahn";
  }

  function syncPlayerPickers() {
    const contractPicker = byId("contrato-jugadores-checkboxes");
    const salarySelect = byId("salario-jugador");
    const roster = byId("economy-player-roster");
    const checked = contractPicker
      ? new Set(Array.from(contractPicker.querySelectorAll("input:checked")).map((input) => input.value))
      : new Set();
    const selectedSalary = salarySelect?.value || "";

    if (contractPicker) {
      contractPicker.innerHTML = "";
      Object.entries(state.players).forEach(([key, player]) => {
        const label = document.createElement("label");
        label.className = "economy-v2-player-option";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = key;
        input.className = "check-jugador-contrato";
        input.checked = checked.has(key);

        const text = document.createElement("span");
        const strong = document.createElement("strong");
        strong.textContent = core().playerDisplayName(key, player);
        const small = document.createElement("small");
        small.textContent = key === strong.textContent ? "ID interno" : `ID: ${key}`;
        text.append(strong, small);
        label.append(input, text);
        contractPicker.appendChild(label);
      });
      if (!contractPicker.children.length) {
        contractPicker.innerHTML = '<div class="economy-v2-empty">No hay jugadores vinculados.</div>';
      }
    }

    if (salarySelect) {
      salarySelect.innerHTML = '<option value="">Selecciona jugador...</option>';
      Object.entries(state.players).forEach(([key, player]) => {
        const option = document.createElement("option");
        option.value = key;
        const visible = core().playerDisplayName(key, player);
        option.textContent = visible === key ? visible : `${visible} — ${key}`;
        salarySelect.appendChild(option);
      });
      if (selectedSalary && state.players[selectedSalary]) salarySelect.value = selectedSalary;
    }

    if (roster) {
      roster.innerHTML = "";
      Object.entries(state.players).forEach(([key, player]) => {
        const row = document.createElement("div");
        row.className = "economy-v2-roster-row";
        row.dataset.playerKey = key;

        const keyEl = document.createElement("code");
        keyEl.textContent = key;
        keyEl.title = "ID interno estable; no se cambia para no romper referencias.";

        const input = document.createElement("input");
        input.type = "text";
        input.className = "economy-player-name-input";
        input.value = core().playerDisplayName(key, player);
        input.setAttribute("aria-label", `Nombre visible de ${key}`);

        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn-cyber economy-save-player-name";
        button.textContent = "Guardar nombre";

        row.append(keyEl, input, button);
        roster.appendChild(row);
      });
      if (!roster.children.length) {
        roster.innerHTML = '<div class="economy-v2-empty">No hay jugadores vinculados.</div>';
      }
    }
  }

  async function savePlayerVisibleName(playerKey, newName) {
    const name = String(newName || "").trim();
    if (!playerKey || !name) throw new Error("Nombre inválido");
    await state.db.ref(`campaña/jugadores/${playerKey}`).update({
      displayName: name,
    });
  }

  function syncSalaryScheduleControls() {
    const frequency = core().normalizedFrequency(byId("salario-frecuencia")?.value);
    const weekWrap = byId("salario-dia-semana-wrap");
    const monthWrap = byId("salario-dia-mes-wrap");
    if (weekWrap) weekWrap.style.display = frequency === 7 ? "flex" : "none";
    if (monthWrap) monthWrap.style.display = frequency === 30 ? "flex" : "none";
    updateSalaryPreview();
  }

  function updateSalaryPreview() {
    const preview = byId("salario-preview");
    if (!preview) return;
    const frequency = core().normalizedFrequency(byId("salario-frecuencia")?.value);
    const weekday = core().normalizeWeekday(byId("salario-dia-semana")?.value);
    const monthDay = core().clampMonthDay(byId("salario-dia-mes")?.value);
    const due = core().initialSalaryDueDate(currentWorldDate(), frequency, weekday, monthDay);
    const schedule = core().salaryScheduleLabel({
      frecuencia: frequency,
      diaPagoSemana: weekday,
      diaPagoMes: monthDay,
    });
    preview.textContent = `${schedule}. Primer pago: ${core().formatWorldDate(due)}.`;
  }

  function freshPlayerBalance(player) {
    const financeBalance = Number(player?.finance?.currentBalance);
    if (Number.isFinite(financeBalance)) return Math.trunc(financeBalance);
    return core().whole(player?.ahn, 0);
  }

  function addTransactionUpdates(updates, playerKey, amount, concept) {
    const historyKey = state.db.ref(`campaña/jugadores/${playerKey}/finance/transactionHistory`).push().key;
    const legacyKey = state.db.ref(`campaña/jugadores/${playerKey}/transacciones`).push().key;
    const tx = {
      monto: core().whole(amount, 0),
      concepto: concept,
      timestamp: Date.now(),
      fecha: Date.now(),
      unread: true,
    };
    updates[`campaña/jugadores/${playerKey}/finance/transactionHistory/${historyKey}`] = tx;
    updates[`campaña/jugadores/${playerKey}/transacciones/${legacyKey}`] = tx;
  }

  async function createContract() {
    const name = byId("contrato-nombre")?.value.trim() || "";
    const total = core().positiveWhole(byId("contrato-recompensa")?.value);
    const advancePercent = core().clampAdvancePercent(byId("contrato-adelanto")?.value);
    const selected = Array.from(document.querySelectorAll(".check-jugador-contrato:checked")).map((input) => input.value);

    if (!name || total <= 0 || selected.length === 0) {
      global.alert("Falta el nombre, una recompensa válida o al menos un jugador.");
      return;
    }

    const playersSnap = await state.db.ref("campaña/jugadores").once("value");
    const players = playersSnap.val() || {};
    const participants = core().buildContractParticipants(players, selected, total, advancePercent);
    const contractKey = state.db.ref("campaña/economia/contratos").push().key;
    const updates = {};
    const balances = {};

    updates[`campaña/economia/contratos/${contractKey}`] = {
      schemaVersion: 2,
      nombre: name,
      recompensa: total,
      porcentajeAdelanto: advancePercent,
      asignados: selected,
      participantes: participants,
      status: "active",
      fecha: Date.now(),
    };

    selected.forEach((playerKey) => {
      const participant = participants[playerKey];
      const advance = core().positiveWhole(participant?.adelantoAhn);
      if (!advance || !players[playerKey]) return;
      const current = balances[playerKey] ?? freshPlayerBalance(players[playerKey]);
      const next = current + advance;
      balances[playerKey] = next;
      updates[`campaña/jugadores/${playerKey}/ahn`] = next;
      updates[`campaña/jugadores/${playerKey}/finance/currentBalance`] = next;
      addTransactionUpdates(updates, playerKey, advance, `Adelanto de contrato: ${name} (${advancePercent}%)`);
    });

    await state.db.ref().update(updates);
    byId("contrato-nombre").value = "";
    byId("contrato-recompensa").value = "";
    byId("contrato-adelanto").value = "0";
    document.querySelectorAll(".check-jugador-contrato:checked").forEach((input) => { input.checked = false; });
  }

  async function migrateLegacyContract(contractId, contract) {
    if (!contractId || state.migratingContracts.has(contractId) || contract?.participantes) return;
    const assigned = Array.isArray(contract?.asignados) ? contract.asignados.filter(Boolean) : [];
    if (!assigned.length) return;
    state.migratingContracts.add(contractId);
    try {
      const participants = core().buildContractParticipants(state.players, assigned, contract.recompensa, 0);
      await state.db.ref(`campaña/economia/contratos/${contractId}`).update({
        schemaVersion: 2,
        porcentajeAdelanto: 0,
        participantes: participants,
        status: contract.status || "active",
      });
    } finally {
      state.migratingContracts.delete(contractId);
    }
  }

  function renderContracts(contracts) {
    const container = byId("contratos-activos-container");
    if (!container) return;
    container.innerHTML = "";
    const entries = Object.entries(contracts || {}).filter(([, data]) => data && data.status !== "completed" && data.status !== "failed");
    if (!entries.length) {
      container.innerHTML = '<div class="economy-v2-empty">Sin misiones activas.</div>';
      return;
    }

    entries.forEach(([id, data]) => {
      if (!data.participantes) migrateLegacyContract(id, data).catch((error) => console.error("No se pudo migrar contrato:", error));
      const participants = data.participantes || core().buildContractParticipants(state.players, data.asignados || [], data.recompensa, 0);
      const card = document.createElement("article");
      card.className = "economy-v2-card economy-v2-card--contract";
      card.dataset.contractId = id;

      const chips = Object.entries(participants).map(([key, participant]) => {
        const status = participant?.status || "active";
        const label = participant?.nombre || playerName(key);
        const reward = core().positiveWhole(participant?.recompensaTotal);
        const advance = core().positiveWhole(participant?.adelantoAhn);
        const pending = core().positiveWhole(participant?.pagoPendienteAhn ?? reward - advance);
        return `<span class="economy-v2-chip" data-status="${core().escapeHtml(status)}"><strong>${core().escapeHtml(label)}</strong><span>${money(reward)} · adelanto ${money(advance)} · pendiente ${money(pending)}</span></span>`;
      }).join("");

      card.innerHTML = `
        <h4 class="economy-v2-title">${core().escapeHtml(data.nombre || "Contrato")}</h4>
        <div class="economy-v2-money">Bolsa total: ${money(data.recompensa)}</div>
        <div class="economy-v2-meta">Adelanto: ${core().clampAdvancePercent(data.porcentajeAdelanto || 0)}%</div>
        <div class="economy-v2-chip-row">${chips}</div>
        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
          <button type="button" class="btn-cyber btn-completar-contrato" data-id="${id}" style="flex:1; background:#07340f; color:#84ff9b; border-color:#2b8d3e;">Completar</button>
          <button type="button" class="btn-cyber btn-fallar-contrato" data-id="${id}" style="flex:1; background:#3a0b0b; color:#ff8b8b; border-color:#8d3030;">Fallar</button>
        </div>`;
      container.appendChild(card);
    });
  }

  async function completeContract(contractId) {
    const [contractSnap, playersSnap] = await Promise.all([
      state.db.ref(`campaña/economia/contratos/${contractId}`).once("value"),
      state.db.ref("campaña/jugadores").once("value"),
    ]);
    const contract = contractSnap.val();
    const players = playersSnap.val() || {};
    if (!contract) return;

    const activeKeys = core().activeParticipantKeys(contract);
    const updates = {};
    const balances = {};
    const fallbackShares = core().splitWholeAmount(contract.recompensa, contract.asignados || activeKeys);

    activeKeys.forEach((playerKey) => {
      if (!players[playerKey]) return;
      const participant = core().participantFor(contract, playerKey);
      const pending = core().positiveWhole(participant?.pagoPendienteAhn ?? fallbackShares[playerKey] ?? 0);
      if (!pending) return;
      const current = balances[playerKey] ?? freshPlayerBalance(players[playerKey]);
      const next = current + pending;
      balances[playerKey] = next;
      updates[`campaña/jugadores/${playerKey}/ahn`] = next;
      updates[`campaña/jugadores/${playerKey}/finance/currentBalance`] = next;
      addTransactionUpdates(updates, playerKey, pending, `Contrato completado: ${contract.nombre || "Misión"}`);
    });

    updates[`campaña/economia/contratos/${contractId}`] = null;
    await state.db.ref().update(updates);
  }

  async function failContract(contractId) {
    const raw = global.prompt("Multa por jugador activo (Ahn). Usa 0 si solo quieres cerrar el contrato:", "0");
    if (raw === null) return;
    const fine = core().positiveWhole(raw);
    if (String(raw).trim() !== String(fine) && Number(raw) !== fine) {
      global.alert("La multa debe ser un número entero de Ahn.");
      return;
    }

    const [contractSnap, playersSnap] = await Promise.all([
      state.db.ref(`campaña/economia/contratos/${contractId}`).once("value"),
      state.db.ref("campaña/jugadores").once("value"),
    ]);
    const contract = contractSnap.val();
    const players = playersSnap.val() || {};
    if (!contract) return;

    const activeKeys = core().activeParticipantKeys(contract);
    const updates = {};
    const balances = {};

    activeKeys.forEach((playerKey) => {
      if (!players[playerKey] || !fine) return;
      const current = balances[playerKey] ?? freshPlayerBalance(players[playerKey]);
      const next = current - fine;
      balances[playerKey] = next;
      updates[`campaña/jugadores/${playerKey}/ahn`] = next;
      updates[`campaña/jugadores/${playerKey}/finance/currentBalance`] = next;
      addTransactionUpdates(updates, playerKey, -fine, `Contrato fallado: ${contract.nombre || "Misión"}`);
    });

    updates[`campaña/economia/contratos/${contractId}`] = null;
    await state.db.ref().update(updates);
  }

  function legacySalaryPatch(salary, worldDate) {
    const remaining = Math.max(1, core().whole(salary?.diasRestantes, core().normalizedFrequency(salary?.frecuencia)));
    const due = core().startOfDay(worldDate);
    due.setDate(due.getDate() + remaining);
    const frequency = core().normalizedFrequency(salary?.frecuencia);
    return {
      schemaVersion: 2,
      frecuencia: frequency,
      diaPagoSemana: frequency === 7 ? due.getDay() : null,
      diaPagoMes: frequency === 30 ? due.getDate() : null,
      proximoPagoTs: due.getTime(),
    };
  }

  async function createSalary() {
    const playerKey = byId("salario-jugador")?.value || "";
    const amount = core().positiveWhole(byId("salario-monto")?.value);
    const frequency = core().normalizedFrequency(byId("salario-frecuencia")?.value);
    const weekday = core().normalizeWeekday(byId("salario-dia-semana")?.value);
    const monthDay = core().clampMonthDay(byId("salario-dia-mes")?.value);

    if (!playerKey || !state.players[playerKey] || amount <= 0) {
      global.alert("Selecciona un jugador y un monto entero válido.");
      return;
    }

    const due = core().initialSalaryDueDate(currentWorldDate(), frequency, weekday, monthDay);
    await state.db.ref("campaña/economia/salarios").push().set({
      schemaVersion: 2,
      jugador: playerKey,
      nombreJugador: playerName(playerKey),
      monto: amount,
      frecuencia: frequency,
      diaPagoSemana: frequency === 7 ? weekday : null,
      diaPagoMes: frequency === 30 ? monthDay : null,
      proximoPagoTs: due.getTime(),
      fecha: Date.now(),
    });
    byId("salario-monto").value = "";
    updateSalaryPreview();
  }

  function renderSalaries(salaries) {
    const container = byId("salarios-activos-container");
    if (!container) return;
    container.innerHTML = "";
    const entries = Object.entries(salaries || {});
    if (!entries.length) {
      container.innerHTML = '<div class="economy-v2-empty">Sin salarios activos.</div>';
      return;
    }

    entries.forEach(([id, salary]) => {
      const card = document.createElement("article");
      card.className = "economy-v2-card economy-v2-card--salary";
      let nextLabel = "Pendiente de migrar";
      if (Number.isFinite(Number(salary.proximoPagoTs))) {
        nextLabel = core().formatWorldDate(Number(salary.proximoPagoTs));
      }
      card.innerHTML = `
        <button type="button" class="btn-eliminar-salario" data-id="${id}" aria-label="Eliminar salario" style="position:absolute; top:8px; right:8px; background:transparent; color:#ff6b6b; border:0; cursor:pointer; font-size:18px;">×</button>
        <h4 class="economy-v2-title">${core().escapeHtml(playerName(salary.jugador))}</h4>
        <div class="economy-v2-money">+${money(salary.monto)}</div>
        <div class="economy-v2-meta">${core().escapeHtml(core().salaryScheduleLabel(salary))}</div>
        <div class="economy-v2-meta">Próximo pago: <strong style="color:#e4c46b;">${core().escapeHtml(nextLabel)}</strong></div>`;
      container.appendChild(card);
    });
  }

  function processPayroll(worldDate) {
    if (!state.db || !core()) return Promise.resolve();
    if (state.payrollLock) return state.payrollLock;

    state.payrollLock = (async () => {
      const now = worldDate instanceof Date ? worldDate : new Date(worldDate || currentWorldDate());
      if (Number.isNaN(now.getTime())) return;

      const [salarySnap, playersSnap] = await Promise.all([
        state.db.ref("campaña/economia/salarios").once("value"),
        state.db.ref("campaña/jugadores").once("value"),
      ]);
      const salaries = salarySnap.val() || {};
      const players = playersSnap.val() || {};
      const updates = {};
      const balances = {};

      for (const [salaryId, rawSalary] of Object.entries(salaries)) {
        let salary = { ...rawSalary };
        if (!Number.isFinite(Number(salary.proximoPagoTs))) {
          const patch = legacySalaryPatch(salary, now);
          Object.assign(salary, patch);
          Object.entries(patch).forEach(([field, value]) => {
            updates[`campaña/economia/salarios/${salaryId}/${field}`] = value;
          });
          continue;
        }

        const due = core().duePaymentsThrough(salary, now);
        if (!due.count) continue;
        const playerKey = salary.jugador;
        if (!playerKey || !players[playerKey]) continue;

        const totalPayment = core().positiveWhole(salary.monto) * due.count;
        const current = balances[playerKey] ?? freshPlayerBalance(players[playerKey]);
        const next = current + totalPayment;
        balances[playerKey] = next;
        updates[`campaña/jugadores/${playerKey}/ahn`] = next;
        updates[`campaña/jugadores/${playerKey}/finance/currentBalance`] = next;
        updates[`campaña/economia/salarios/${salaryId}/proximoPagoTs`] = due.nextPaymentTs;
        addTransactionUpdates(
          updates,
          playerKey,
          totalPayment,
          `Pago de nómina: ${core().salaryScheduleLabel(salary)}${due.count > 1 ? ` ×${due.count}` : ""}`
        );
      }

      if (Object.keys(updates).length) await state.db.ref().update(updates);
    })().catch((error) => {
      console.error("Error procesando nóminas:", error);
    }).finally(() => {
      state.payrollLock = null;
    });

    return state.payrollLock;
  }

  function bindEvents() {
    byId("btn-crear-contrato")?.addEventListener("click", () => {
      createContract().catch((error) => {
        console.error("Error creando contrato:", error);
        global.alert("No se pudo crear el contrato.");
      });
    });
    byId("btn-crear-salario")?.addEventListener("click", () => {
      createSalary().catch((error) => {
        console.error("Error creando salario:", error);
        global.alert("No se pudo crear el salario.");
      });
    });

    ["salario-frecuencia", "salario-dia-semana", "salario-dia-mes"].forEach((id) => {
      byId(id)?.addEventListener("change", syncSalaryScheduleControls);
      byId(id)?.addEventListener("input", syncSalaryScheduleControls);
    });

    byId("economy-player-roster")?.addEventListener("click", (event) => {
      const button = event.target.closest(".economy-save-player-name");
      if (!button) return;
      const row = button.closest(".economy-v2-roster-row");
      const input = row?.querySelector(".economy-player-name-input");
      if (!row?.dataset.playerKey || !input) return;
      button.disabled = true;
      savePlayerVisibleName(row.dataset.playerKey, input.value)
        .catch((error) => {
          console.error("No se pudo cambiar el nombre visible:", error);
          global.alert("No se pudo guardar el nombre.");
        })
        .finally(() => { button.disabled = false; });
    });

    byId("contratos-activos-container")?.addEventListener("click", (event) => {
      const complete = event.target.closest(".btn-completar-contrato");
      const fail = event.target.closest(".btn-fallar-contrato");
      const button = complete || fail;
      if (!button) return;
      const contractId = button.dataset.id;
      if (!contractId) return;
      button.disabled = true;
      const task = complete ? completeContract(contractId) : failContract(contractId);
      task.catch((error) => {
        console.error("Error actualizando contrato:", error);
        global.alert("No se pudo actualizar el contrato.");
      }).finally(() => { button.disabled = false; });
    });

    byId("salarios-activos-container")?.addEventListener("click", (event) => {
      const button = event.target.closest(".btn-eliminar-salario");
      if (!button?.dataset.id) return;
      if (!global.confirm("¿Eliminar este salario recurrente?")) return;
      state.db.ref(`campaña/economia/salarios/${button.dataset.id}`).remove().catch((error) => {
        console.error("Error eliminando salario:", error);
        global.alert("No se pudo eliminar el salario.");
      });
    });
  }

  function init({ db, getWorldDate }) {
    if (!db || !core()) return;
    state.db = db;
    state.getWorldDate = getWorldDate;
    if (state.initialized) return;
    state.initialized = true;

    bindEvents();
    syncSalaryScheduleControls();

    db.ref("campaña/jugadores").on("value", (snapshot) => {
      state.players = snapshot.val() || {};
      syncPlayerPickers();
      renderContracts(state.contracts);
    });

    db.ref("campaña/economia/contratos").on("value", (snapshot) => {
      state.contracts = snapshot.val() || {};
      renderContracts(state.contracts);
    });

    db.ref("campaña/economia/salarios").on("value", (snapshot) => {
      renderSalaries(snapshot.val() || {});
    });

    db.ref("campaña/calendario/timestamp").on("value", (snapshot) => {
      const value = snapshot.val();
      if (!value) return;
      processPayroll(new Date(value));
    });
  }

  global.LuminousDMEconomyRuntime = Object.freeze({
    init,
    processPayroll,
  });
})(typeof window !== "undefined" ? window : globalThis);
