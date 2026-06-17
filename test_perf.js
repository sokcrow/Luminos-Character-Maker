// Simulate the performance issue
const mockActoresCache = {};
for (let i = 0; i < 100; i++) {
  mockActoresCache[`actor_${i}`] = { nombre: `Actor ${i}`, icono: `icon_${i}.png` };
}

const mockLogs = {};
for (let i = 0; i < 500; i++) {
  mockLogs[`log_${i}`] = { nombre: `Actor ${i % 100}` };
}

function renderLogsO2() {
  const start = performance.now();
  for (const [key, msg] of Object.entries(mockLogs)) {
    let dynamicIcon = null;
    const actorMatch = Object.values(mockActoresCache).find(
      (actor) =>
        actor.nombre &&
        msg.nombre &&
        actor.nombre.toLowerCase() === msg.nombre.toLowerCase(),
    );
    if (actorMatch && actorMatch.icono) {
      dynamicIcon = actorMatch.icono;
    }
  }
  const end = performance.now();
  console.log(`O(N^2) time: ${end - start}ms`);
}

function renderLogsO1() {
  const start = performance.now();
  const lowerCaseNameMap = new Map();
  for (const actor of Object.values(mockActoresCache)) {
      if (actor.nombre) {
          lowerCaseNameMap.set(actor.nombre.toLowerCase(), actor);
      }
  }

  for (const [key, msg] of Object.entries(mockLogs)) {
    let dynamicIcon = null;
    if (msg.nombre) {
        const actorMatch = lowerCaseNameMap.get(msg.nombre.toLowerCase());
        if (actorMatch && actorMatch.icono) {
            dynamicIcon = actorMatch.icono;
        }
    }
  }
  const end = performance.now();
  console.log(`O(N) time: ${end - start}ms`);
}

renderLogsO2();
renderLogsO1();
