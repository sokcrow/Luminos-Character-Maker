const assert = require("assert");
const { obtenerEstacion } = require("../js/utils");

console.log("🧪 Iniciando pruebas para obtenerEstacion...");

try {
  // Primavera: Meses 3, 4, 5
  assert.strictEqual(
    obtenerEstacion(3),
    "Primavera",
    "Mes 3 debería ser Primavera",
  );
  assert.strictEqual(
    obtenerEstacion(4),
    "Primavera",
    "Mes 4 debería ser Primavera",
  );
  assert.strictEqual(
    obtenerEstacion(5),
    "Primavera",
    "Mes 5 debería ser Primavera",
  );

  // Verano: Meses 6, 7, 8
  assert.strictEqual(obtenerEstacion(6), "Verano", "Mes 6 debería ser Verano");
  assert.strictEqual(obtenerEstacion(7), "Verano", "Mes 7 debería ser Verano");
  assert.strictEqual(obtenerEstacion(8), "Verano", "Mes 8 debería ser Verano");

  // Otoño: Meses 9, 10, 11
  assert.strictEqual(obtenerEstacion(9), "Otoño", "Mes 9 debería ser Otoño");
  assert.strictEqual(obtenerEstacion(10), "Otoño", "Mes 10 debería ser Otoño");
  assert.strictEqual(obtenerEstacion(11), "Otoño", "Mes 11 debería ser Otoño");

  // Invierno: Meses 12, 1, 2
  assert.strictEqual(
    obtenerEstacion(12),
    "Invierno",
    "Mes 12 debería ser Invierno",
  );
  assert.strictEqual(
    obtenerEstacion(1),
    "Invierno",
    "Mes 1 debería ser Invierno",
  );
  assert.strictEqual(
    obtenerEstacion(2),
    "Invierno",
    "Mes 2 debería ser Invierno",
  );

  // Casos extra (fuera de rango normal)
  assert.strictEqual(
    obtenerEstacion(0),
    "Invierno",
    "Mes 0 debería caer en Invierno por defecto",
  );
  assert.strictEqual(
    obtenerEstacion(13),
    "Invierno",
    "Mes 13 debería caer en Invierno por defecto",
  );

  console.log("✅ Todas las pruebas pasaron exitosamente.");
} catch (error) {
  console.error("❌ Error en las pruebas:", error.message);
  process.exit(1);
}
