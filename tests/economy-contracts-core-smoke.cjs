const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  delete globalThis.LuminousEconomyContractsCore;
  await import(pathToFileURL(path.resolve(__dirname, "../js/economy-contracts-core.js")).href);
  const core = globalThis.LuminousEconomyContractsCore;
  assert.ok(core);
  assert.equal(core.VERSION, 2);

  assert.deepEqual(core.splitWholeAmount(1000, ["a", "b", "c"]), { a: 334, b: 333, c: 333 });
  assert.equal(core.clampAdvancePercent(99), 50);
  assert.equal(core.clampAdvancePercent(33.5), 33);

  const participants = core.buildContractParticipants(
    {
      a: { uid: "u1", characterName: "Alice" },
      b: { uid: "u2", displayName: "Bob" },
    },
    ["a", "b"],
    1000001,
    33
  );
  assert.equal(participants.a.recompensaTotal, 500001);
  assert.equal(participants.b.recompensaTotal, 500000);
  assert.equal(participants.a.adelantoAhn, 165000);
  assert.equal(participants.a.pagoPendienteAhn, 335001);
  assert.ok(Number.isInteger(participants.a.adelantoAhn));

  const thursday = new Date(2026, 9, 1, 12, 0, 0);
  const mondayDue = core.initialSalaryDueDate(thursday, 7, 1, 1);
  assert.equal(mondayDue.getDay(), 1);
  assert.equal(mondayDue.getDate(), 5);
  assert.equal(core.salaryScheduleLabel({ frecuencia: 7, diaPagoSemana: 1 }), "Cada Lunes");

  const daily = core.initialSalaryDueDate(thursday, 1, 1, 1);
  assert.equal(daily.getDate(), 2);

  const salary = { frecuencia: 7, diaPagoSemana: 1, proximoPagoTs: mondayDue.getTime() };
  const afterThreeWeeks = new Date(2026, 9, 20, 12, 0, 0);
  const due = core.duePaymentsThrough(salary, afterThreeWeeks);
  assert.equal(due.count, 3);
  assert.equal(new Date(due.nextPaymentTs).getDate(), 26);

  console.log("Economy contracts/payroll v2 smoke: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
