(function (global) {
  "use strict";

  if (global.LuminousEconomyContractsCore) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousEconomyContractsCore;
    return;
  }

  const VERSION = 2;
  const WEEKDAYS = Object.freeze(["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]);

  function whole(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : fallback;
  }

  function positiveWhole(value, fallback = 0) {
    return Math.max(0, whole(value, fallback));
  }

  function clampAdvancePercent(value) {
    return Math.max(0, Math.min(50, whole(value, 0)));
  }

  function playerDisplayName(playerKey, player = {}) {
    return String(
      player.displayName ||
      player.characterName ||
      player.character_name ||
      player.nombre ||
      player.name ||
      playerKey ||
      "Jugador"
    ).trim() || String(playerKey || "Jugador");
  }

  function splitWholeAmount(total, playerKeys) {
    const keys = Array.from(new Set((playerKeys || []).filter(Boolean).map(String)));
    const amount = positiveWhole(total);
    if (!keys.length) return {};
    const base = Math.floor(amount / keys.length);
    let remainder = amount - base * keys.length;
    return Object.fromEntries(keys.map((key) => {
      const share = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      return [key, share];
    }));
  }

  function buildContractParticipants(playersByKey, selectedKeys, totalReward, advancePercent) {
    const keys = Array.from(new Set((selectedKeys || []).filter(Boolean).map(String)));
    const shares = splitWholeAmount(totalReward, keys);
    const pct = clampAdvancePercent(advancePercent);
    const participants = {};

    keys.forEach((key) => {
      const player = (playersByKey && playersByKey[key]) || {};
      const rewardShare = positiveWhole(shares[key]);
      const advanceAhn = Math.floor((rewardShare * pct) / 100);
      participants[key] = {
        uid: player.uid || null,
        nombre: playerDisplayName(key, player),
        status: "active",
        recompensaTotal: rewardShare,
        adelantoAhn: advanceAhn,
        pagoPendienteAhn: Math.max(0, rewardShare - advanceAhn),
      };
    });

    return participants;
  }

  function participantFor(contract, playerKey) {
    if (!contract || !playerKey) return null;
    if (contract.participantes && contract.participantes[playerKey]) {
      return contract.participantes[playerKey];
    }
    const assigned = Array.isArray(contract.asignados) ? contract.asignados : [];
    if (!assigned.includes(playerKey)) return null;
    const shares = splitWholeAmount(contract.recompensa, assigned);
    return {
      uid: null,
      nombre: String(playerKey),
      status: "active",
      recompensaTotal: shares[playerKey] || 0,
      adelantoAhn: 0,
      pagoPendienteAhn: shares[playerKey] || 0,
      legacy: true,
    };
  }

  function activeParticipantKeys(contract) {
    if (!contract) return [];
    if (contract.participantes && typeof contract.participantes === "object") {
      return Object.entries(contract.participantes)
        .filter(([, data]) => (data?.status || "active") === "active")
        .map(([key]) => key);
    }
    return Array.isArray(contract.asignados) ? contract.asignados.filter(Boolean) : [];
  }

  function normalizedFrequency(value) {
    const freq = whole(value, 7);
    return freq === 1 || freq === 30 ? freq : 7;
  }

  function normalizeWeekday(value) {
    const day = whole(value, 1);
    return ((day % 7) + 7) % 7;
  }

  function clampMonthDay(value) {
    return Math.max(1, Math.min(31, whole(value, 1)));
  }

  function cloneDate(value) {
    if (value instanceof Date) return new Date(value.getTime());
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  function startOfDay(value) {
    const date = cloneDate(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function setClampedMonthDay(date, monthDay) {
    const day = clampMonthDay(monthDay);
    date.setDate(Math.min(day, daysInMonth(date.getFullYear(), date.getMonth())));
    return date;
  }

  function initialSalaryDueDate(worldDate, frequency, weekday, monthDay) {
    const now = cloneDate(worldDate);
    const base = startOfDay(now);
    const freq = normalizedFrequency(frequency);

    if (freq === 1) {
      base.setDate(base.getDate() + 1);
      return base;
    }

    if (freq === 7) {
      const target = normalizeWeekday(weekday);
      let delta = (target - base.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      base.setDate(base.getDate() + delta);
      return base;
    }

    const targetDay = clampMonthDay(monthDay);
    let candidate = new Date(base.getFullYear(), base.getMonth(), 1);
    setClampedMonthDay(candidate, targetDay);
    if (candidate.getTime() <= now.getTime()) {
      candidate = new Date(base.getFullYear(), base.getMonth() + 1, 1);
      setClampedMonthDay(candidate, targetDay);
    }
    return candidate;
  }

  function nextSalaryDueDate(currentDue, salary = {}) {
    const next = startOfDay(currentDue);
    const freq = normalizedFrequency(salary.frecuencia);

    if (freq === 1) {
      next.setDate(next.getDate() + 1);
      return next;
    }
    if (freq === 7) {
      next.setDate(next.getDate() + 7);
      return next;
    }

    const desiredDay = clampMonthDay(salary.diaPagoMes || next.getDate());
    const targetMonth = next.getMonth() + 1;
    const targetYear = next.getFullYear();
    next.setDate(1);
    next.setMonth(targetMonth);
    setClampedMonthDay(next, desiredDay);
    if (next.getFullYear() < targetYear) next.setFullYear(targetYear);
    return next;
  }

  function duePaymentsThrough(salary, worldDate, cap = 366) {
    const now = cloneDate(worldDate);
    let dueTs = Number(salary?.proximoPagoTs);
    if (!Number.isFinite(dueTs)) return { count: 0, nextPaymentTs: null };

    let count = 0;
    let due = new Date(dueTs);
    const safeCap = Math.max(1, whole(cap, 366));
    while (due.getTime() <= now.getTime() && count < safeCap) {
      count += 1;
      due = nextSalaryDueDate(due, salary);
    }
    return { count, nextPaymentTs: due.getTime() };
  }

  function salaryScheduleLabel(salary = {}) {
    const freq = normalizedFrequency(salary.frecuencia);
    if (freq === 1) return "Todos los días";
    if (freq === 7) return `Cada ${WEEKDAYS[normalizeWeekday(salary.diaPagoSemana)]}`;
    return `Día ${clampMonthDay(salary.diaPagoMes)} de cada mes`;
  }

  function formatWorldDate(value) {
    const date = cloneDate(value);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${WEEKDAYS[date.getDay()]} ${dd}/${mm}/${date.getFullYear()}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  const api = Object.freeze({
    VERSION,
    WEEKDAYS,
    whole,
    positiveWhole,
    clampAdvancePercent,
    playerDisplayName,
    splitWholeAmount,
    buildContractParticipants,
    participantFor,
    activeParticipantKeys,
    normalizedFrequency,
    normalizeWeekday,
    clampMonthDay,
    cloneDate,
    startOfDay,
    initialSalaryDueDate,
    nextSalaryDueDate,
    duePaymentsThrough,
    salaryScheduleLabel,
    formatWorldDate,
    escapeHtml,
  });

  global.LuminousEconomyContractsCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
