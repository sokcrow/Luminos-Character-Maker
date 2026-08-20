/**
 * Helper: Determinar Estación basado en el mes (1-12)
 * @param {number} mes
 * @returns {string}
 */
function obtenerEstacion(mes) {
    if (mes >= 3 && mes <= 5) return "Primavera";
    if (mes >= 6 && mes <= 8) return "Verano";
    if (mes >= 9 && mes <= 11) return "Otoño";
    return "Invierno";
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
        if (numericXp >= xpTable[i]) currentLevel = i;
        else break;
    }

    if (currentLevel >= 100) return { level: 100, xpPercent: 100, xpMissing: 0 };

    const currentLevelXP = xpTable[currentLevel];
    const nextLevelXP = xpTable[currentLevel + 1];
    const xpIntoLevel = numericXp - currentLevelXP;
    const xpRequiredForNextLevel = nextLevelXP - currentLevelXP;
    let xpPercent = Math.floor((xpIntoLevel / xpRequiredForNextLevel) * 100);
    xpPercent = Math.max(0, Math.min(100, xpPercent));

    return { level: currentLevel, xpPercent, xpMissing: nextLevelXP - numericXp };
}

function ensureStyleAsset(documentRef, id, href, dataset) {
    let link = documentRef.getElementById(id);
    if (link) return link;
    link = documentRef.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    if (dataset) Object.assign(link.dataset, dataset);
    documentRef.head?.appendChild(link);
    return link;
}

function ensureScriptAsset(documentRef, id, src, dataset) {
    let script = documentRef.getElementById(id);
    if (script) return script;
    script = documentRef.createElement('script');
    script.id = id;
    script.src = src;
    script.async = false;
    if (dataset) Object.assign(script.dataset, dataset);
    documentRef.head?.appendChild(script);
    return script;
}

function ensurePlayerTerminalStyles(doc) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null);
    if (!documentRef?.querySelector?.('.sheet-phone-wrapper')) return null;
    return ensureStyleAsset(documentRef, 'player-terminal-stylesheet', 'css/player-terminal.css', { ui: 'personal-terminal' });
}

function ensurePlayerTerminalVisibility(doc) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null);
    if (!documentRef?.querySelector?.('.sheet-phone-wrapper')) return null;
    const link = ensureStyleAsset(documentRef, 'player-terminal-overlay-stylesheet', 'css/player-terminal-overlay.css', { ui: 'player-terminal-overlay' });
    const script = ensureScriptAsset(documentRef, 'player-terminal-visibility-script', 'js/player-terminal-visibility.js', { ui: 'player-terminal-visibility' });
    return { link, script };
}

function ensurePlayerUxPolishAssets(doc) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null);
    if (!documentRef?.querySelector?.('.sheet-phone-wrapper')) return null;
    const link = ensureStyleAsset(documentRef, 'player-ux-polish-stylesheet', 'css/player-ux-polish.css', { ui: 'player-ux-polish' });
    const script = ensureScriptAsset(documentRef, 'player-ux-polish-script', 'js/player-ux-polish.js', { ui: 'player-ux-polish' });
    return { link, script };
}

function ensurePlayerStatsAbilityBarAssets(doc) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null);
    if (!documentRef?.querySelector?.('.sheet-phone-wrapper')) return null;
    const link = ensureStyleAsset(documentRef, 'player-stats-ability-bar-stylesheet', 'css/player-stats-ability-bar.css', { ui: 'player-stats-ability-bar' });
    const script = ensureScriptAsset(documentRef, 'player-stats-ability-bar-script', 'js/player-stats-ability-bar.js', { ui: 'player-stats-ability-bar' });
    return { link, script };
}

function ensureDmPlayerDndStudioAssets(doc) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null);
    if (!documentRef?.querySelector?.('#dashboard-jugadores')) return null;
    const link = ensureStyleAsset(documentRef, 'dm-player-dnd-studio-stylesheet', 'css/dm-player-dnd-studio.css', { ui: 'dm-player-dnd-studio' });
    const guard = ensureScriptAsset(documentRef, 'dm-player-dnd-studio-hotfix-script', 'js/dm-player-dnd-studio-hotfix.js', { ui: 'dm-player-dnd-hotfix' });
    const script = ensureScriptAsset(documentRef, 'dm-player-dnd-studio-script', 'js/dm-player-dnd-studio.js', { ui: 'dm-player-dnd-studio' });
    return { link, guard, script };
}

function ensurePlayerSplashFramingAssets(doc) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null);
    const isPlayer = documentRef?.querySelector?.('.sheet-phone-wrapper');
    const isDm = documentRef?.querySelector?.('#dashboard-jugadores');
    if (!isPlayer && !isDm) return null;
    const link = ensureStyleAsset(documentRef, 'player-splash-framing-stylesheet', 'css/player-splash-framing.css', { ui: 'player-splash-framing' });
    const script = ensureScriptAsset(documentRef, 'player-splash-framing-script', 'js/player-splash-framing.js', { ui: 'player-splash-framing' });
    return { link, script };
}

function ensurePlayerTheatreLanguagePolicy(doc) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null);
    if (!documentRef?.querySelector?.('.sheet-phone-wrapper')) return null;
    return ensureScriptAsset(documentRef, 'theatre-language-policy-script', 'js/theatre-language-policy.js', { engine: 'theatre-language-policy' });
}

function ensureDmCharacterManagerAssets(doc) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null);
    if (!documentRef?.querySelector?.('#dashboard-actores')) return null;

    const link = ensureStyleAsset(documentRef, 'character-manager-studio-stylesheet', 'css/character-manager-studio.css', { ui: 'character-manager-studio' });
    ensureStyleAsset(documentRef, 'character-manager-social-stylesheet', 'css/character-manager-social.css', { ui: 'character-manager-social' });
    ensureStyleAsset(documentRef, 'character-manager-domain-ux-stylesheet', 'css/character-manager-domain-ux.css', { ui: 'character-manager-domain-ux' });

    const ensureTakeover = () => ensureScriptAsset(documentRef, 'dm-character-manager-takeover-script', 'js/dm-character-manager-takeover.js', { ui: 'character-manager-takeover' });

    const ensureExtensions = () => {
        const catalog = ensureScriptAsset(documentRef, 'language-catalog-engine-script', 'js/language-catalog-engine.js', { engine: 'language-catalog' });
        const bond = ensureScriptAsset(documentRef, 'bond-engine-script', 'js/bond-engine.js', { engine: 'bond-manager' });
        const ensureSocial = () => ensureScriptAsset(documentRef, 'character-manager-social-script', 'js/character-manager-social-studio.js', { ui: 'character-manager-social' });
        const ensureLanguageUx = () => ensureScriptAsset(documentRef, 'character-manager-language-ux-script', 'js/character-manager-language-ux.js', { ui: 'character-manager-language-ux' });

        if (typeof window !== 'undefined' && window.LuminousBondManager) ensureSocial();
        else bond.addEventListener('load', ensureSocial, { once: true });

        if (typeof window !== 'undefined' && window.LuminousLanguageCatalog) ensureLanguageUx();
        else catalog.addEventListener('load', ensureLanguageUx, { once: true });
    };

    const ensureStudio = () => {
        let studio = documentRef.getElementById('character-manager-studio-script');
        if (studio) {
            if (documentRef.getElementById('character-manager-studio')) {
                ensureTakeover();
                ensureExtensions();
            } else {
                studio.addEventListener('load', ensureTakeover, { once: true });
                studio.addEventListener('load', ensureExtensions, { once: true });
            }
            return studio;
        }

        studio = documentRef.createElement('script');
        studio.id = 'character-manager-studio-script';
        studio.src = 'js/character-manager-studio.js';
        studio.async = false;
        studio.dataset.ui = 'character-manager-studio';
        studio.addEventListener('load', ensureTakeover, { once: true });
        studio.addEventListener('load', ensureExtensions, { once: true });
        documentRef.head?.appendChild(studio);
        return studio;
    };

    let engine = documentRef.getElementById('character-manager-engine-script');
    if (!engine) {
        engine = documentRef.createElement('script');
        engine.id = 'character-manager-engine-script';
        engine.src = 'js/character-manager-engine.js';
        engine.async = false;
        engine.dataset.engine = 'character-manager';
        engine.addEventListener('load', ensureStudio, { once: true });
        documentRef.head?.appendChild(engine);
    } else if (typeof window !== 'undefined' && window.LuminousCharacterManager) {
        ensureStudio();
    } else {
        engine.addEventListener('load', ensureStudio, { once: true });
    }

    return { link, engine };
}

if (typeof document !== 'undefined') {
    ensurePlayerTerminalStyles(document);
    ensurePlayerTerminalVisibility(document);
    ensurePlayerUxPolishAssets(document);
    ensurePlayerStatsAbilityBarAssets(document);
    ensureDmPlayerDndStudioAssets(document);
    ensurePlayerSplashFramingAssets(document);
    ensurePlayerTheatreLanguagePolicy(document);
    ensureDmCharacterManagerAssets(document);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        obtenerEstacion,
        calculateLevelData,
        ensurePlayerTerminalStyles,
        ensurePlayerTerminalVisibility,
        ensurePlayerUxPolishAssets,
        ensurePlayerStatsAbilityBarAssets,
        ensureDmPlayerDndStudioAssets,
        ensurePlayerSplashFramingAssets,
        ensurePlayerTheatreLanguagePolicy,
        ensureDmCharacterManagerAssets
    };
}
