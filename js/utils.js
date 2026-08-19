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


/**
 * Helper: Calcular datos de nivel (Nivel, Porcentaje de XP, XP Faltante) a partir del total de XP
 * @param {number|string} xp
 * @returns {object} { level, xpPercent, xpMissing }
 */
function calculateLevelData(xp) {
    const xpTable = {
        1: 0, 2: 60, 3: 120, 4: 180, 5: 240, 6: 300, 7: 420, 8: 540, 9: 660, 10: 780,
        11: 900, 12: 1260, 13: 1620, 14: 1980, 15: 2340, 16: 2700, 17: 3460, 18: 4220, 19: 4980, 20: 5740,
        21: 6500, 22: 8000, 23: 9500, 24: 11000, 25: 12500, 26: 14000, 27: 15800, 28: 17600, 29: 19400, 30: 21200,
        31: 23000, 32: 25200, 33: 27400, 34: 29600, 35: 31800, 36: 34000, 37: 36800, 38: 39600, 39: 42400, 40: 45200,
        41: 48000, 42: 51200, 43: 54400, 44: 57600, 45: 60800, 46: 64000, 47: 68200, 48: 72400, 49: 76600, 50: 80800,
        51: 85000, 52: 88000, 53: 91000, 54: 94000, 55: 97000, 56: 100000, 57: 104000, 58: 108000, 59: 112000, 60: 116000,
        61: 120000, 62: 124000, 63: 128000, 64: 132000, 65: 136000, 66: 140000, 67: 145000, 68: 150000, 69: 155000, 70: 160000,
        71: 165000, 72: 171000, 73: 177000, 74: 183000, 75: 189000, 76: 195000, 77: 201000, 78: 207000, 79: 213000, 80: 219000,
        81: 225000, 82: 233000, 83: 241000, 84: 249000, 85: 257000, 86: 265000, 87: 273000, 88: 281000, 89: 289000, 90: 297000,
        91: 305000, 92: 315000, 93: 325000, 94: 335000, 95: 345000, 96: 355000, 97: 365000, 98: 375000, 99: 385000, 100: 395000
    };

    let numericXp = parseInt(xp) || 0;
    if (numericXp < 0) numericXp = 0;

    let currentLevel = 1;
    for (let i = 1; i <= 100; i++) {
        if (numericXp >= xpTable[i]) {
            currentLevel = i;
        } else {
            break;
        }
    }

    if (currentLevel >= 100) {
        return {
            level: 100,
            xpPercent: 100,
            xpMissing: 0
        };
    }

    const currentLevelXP = xpTable[currentLevel];
    const nextLevelXP = xpTable[currentLevel + 1];
    const xpIntoLevel = numericXp - currentLevelXP;
    const xpRequiredForNextLevel = nextLevelXP - currentLevelXP;

    let xpPercent = Math.floor((xpIntoLevel / xpRequiredForNextLevel) * 100);
    // Limit to 0-100 just in case
    xpPercent = Math.max(0, Math.min(100, xpPercent));

    return {
        level: currentLevel,
        xpPercent: xpPercent,
        xpMissing: nextLevelXP - numericXp
    };
}

/**
 * Carga la capa visual del Personal Terminal solo cuando existe la hoja del jugador.
 * Se mantiene aquí porque utils.js ya forma parte del bootstrap síncrono de hoja_personaje.html.
 * @param {Document} doc
 * @returns {HTMLLinkElement|null}
 */
function ensurePlayerTerminalStyles(doc) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null);
    if (!documentRef?.querySelector?.('.sheet-phone-wrapper')) return null;

    let link = documentRef.getElementById('player-terminal-stylesheet');
    if (link) return link;

    link = documentRef.createElement('link');
    link.id = 'player-terminal-stylesheet';
    link.rel = 'stylesheet';
    link.href = 'css/player-terminal.css';
    link.dataset.ui = 'personal-terminal';
    documentRef.head?.appendChild(link);
    return link;
}

/**
 * Carga los retoques funcionales/visuales del jugador sin tocar el HTML gigante.
 * @param {Document} doc
 * @returns {{link: HTMLLinkElement|null, script: HTMLScriptElement|null}|null}
 */
function ensurePlayerUxPolishAssets(doc) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null);
    if (!documentRef?.querySelector?.('.sheet-phone-wrapper')) return null;

    let link = documentRef.getElementById('player-ux-polish-stylesheet');
    if (!link) {
        link = documentRef.createElement('link');
        link.id = 'player-ux-polish-stylesheet';
        link.rel = 'stylesheet';
        link.href = 'css/player-ux-polish.css';
        link.dataset.ui = 'player-ux-polish';
        documentRef.head?.appendChild(link);
    }

    let script = documentRef.getElementById('player-ux-polish-script');
    if (!script) {
        script = documentRef.createElement('script');
        script.id = 'player-ux-polish-script';
        script.src = 'js/player-ux-polish.js';
        script.async = false;
        script.dataset.ui = 'player-ux-polish';
        documentRef.head?.appendChild(script);
    }

    return { link, script };
}

if (typeof document !== 'undefined') {
    ensurePlayerTerminalStyles(document);
    ensurePlayerUxPolishAssets(document);
}

// Compatibilidad para entornos de prueba (Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        obtenerEstacion,
        calculateLevelData,
        ensurePlayerTerminalStyles,
        ensurePlayerUxPolishAssets
    };
}
