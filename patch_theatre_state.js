const fs = require('fs');

const code = `
const LuminousTheatreState = {
    DEFAULT_PLATE_COLOR: "#4a4a4a",
    MAX_VISIBLE_ACTORS: 5,

    isValidImageUrl(url) {
        if (!url || typeof url !== 'string') return false;
        return url.trim().length > 0;
    },

    normalizeDialogueType(value) {
        if (value === 'narracion' || value === 'pensamiento') return value;
        return 'dialogo';
    },

    resolveDmDialogueMode(speakerId, requestedType) {
        if (!speakerId || speakerId.toLowerCase() === "narrador" || speakerId === "narrador") {
            return {
                tipo_dialogo: "narracion",
                mostrar_identidad: false
            };
        }

        if (requestedType === 'narracion') {
            return {
                tipo_dialogo: "narracion",
                mostrar_identidad: false
            };
        } else if (requestedType === 'pensamiento') {
            return {
                tipo_dialogo: "pensamiento",
                mostrar_identidad: false
            };
        }

        return {
            tipo_dialogo: "dialogo",
            mostrar_identidad: true
        };
    },

    normalizeAssignedActorIds(value, legacyActorId) {
        let rawIds = [];
        if (Array.isArray(value)) {
            rawIds = value;
        } else if (value && typeof value === 'object') {
            rawIds = Object.keys(value).filter(k => value[k] === true);
        } else if (typeof value === 'string') {
            rawIds = [value];
        } else if (legacyActorId) {
            rawIds = [legacyActorId];
        }
        return [...new Set(rawIds.filter(id => id && typeof id === 'string'))];
    },

    updateVisibleActors(currentVisible, dialogue, spokenAt, maximum = 5) {
        const nextVisible = { ...currentVisible };

        if (!dialogue || dialogue.mostrar_identidad === false || dialogue.tipo_dialogo === 'narracion' || dialogue.tipo_dialogo === 'pensamiento') {
            return nextVisible;
        }

        if (!dialogue.actorId || (!LuminousTheatreState.isValidImageUrl(dialogue.sprite) && !dialogue.expression)) {
            return nextVisible;
        }

        const id = dialogue.actorId;
        const existingData = nextVisible[id] || {};

        nextVisible[id] = {
            ...existingData,
            sprite: dialogue.sprite,
            expression: dialogue.expression || existingData.expression || '',
            lastSpokeAt: spokenAt || Date.now()
        };

        const keys = Object.keys(nextVisible);
        if (keys.length > maximum) {
            keys.sort((a, b) => (nextVisible[a].lastSpokeAt || 0) - (nextVisible[b].lastSpokeAt || 0));
            const diff = keys.length - maximum;
            for (let i = 0; i < diff; i++) {
                delete nextVisible[keys[i]];
            }
        }

        return nextVisible;
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = LuminousTheatreState;
} else if (typeof window !== "undefined") {
    window.LuminousTheatreState = LuminousTheatreState;
}
`;

fs.writeFileSync('js/theatre-state.js', code);
