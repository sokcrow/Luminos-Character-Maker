/**
 * Helper: Determinar Estación basado en el mes (1-12)
 * @param {number} mes
 * @returns {string}
 */
function obtenerEstacion(mes) {
    if (mes >= 3 && mes <= 5) return "Primavera";
    if (mes >= 6 && mes <= 8) return "Verano";
    if (mes >= 9 && mes <= 11) return "Otoño";
    return "Invierno"; // 12, 1, 2
}

// Compatibilidad para entornos de prueba (Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { obtenerEstacion };
}
