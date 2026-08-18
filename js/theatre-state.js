const LuminousTheatreState = {
    DEFAULT_PLATE_COLOR: "#4a4a4a",
    MAX_VISIBLE_ACTORS: 5,

    isValidImageUrl(value) {
        if (!value || typeof value !== "string") return false;
        const val = value.trim();
        return val.startsWith("http") || val.startsWith("data:image/") || (val.includes("/") && val.length > 2);
    },

    normalizeDialogueType(value) {
        if (value === "narracion" || value === "pensamiento") return value;
        return "dialogo";
    },

    resolveDmDialogueMode(speakerId, requestedType) {
        if (!speakerId || speakerId.toLowerCase() === "narrador" || speakerId === "narrador") {
            return {
                tipo_dialogo: "narracion",
                mostrar_identidad: false
            };
        }

        if (requestedType === "narracion" || requestedType === "pensamiento") {
             return {
                tipo_dialogo: requestedType,
                mostrar_identidad: false
            };
        }

        return {
            tipo_dialogo: "dialogo",
            mostrar_identidad: true
        };
    },

    normalizeAssignedActorIds(value, legacyActorId) {
        let result = [];

        if (Array.isArray(value)) {
            result = value;
        } else if (value && typeof value === 'object') {
            result = Object.keys(value).map(k => value[k] === true ? k : value[k]);
        } else if (typeof value === 'string') {
            result = [value];
        } else if (typeof value === 'number') {
             result = [String(value)];
        }

        if (result.length === 0 && legacyActorId && typeof legacyActorId === 'string') {
            result = [legacyActorId];
        }

        return [...new Set(result.filter(id => id && typeof id === 'string' && id.trim().length > 0))];
    },

    updateVisibleActors(currentVisible, dialogue, spokenAt, maximum = 5) {
        const nextVisible = { ...currentVisible };

        if (!dialogue || !dialogue.actorId || dialogue.mostrar_identidad === false || dialogue.tipo_dialogo === "narracion" || dialogue.tipo_dialogo === "pensamiento") {
            return nextVisible;
        }

        if (!LuminousTheatreState.isValidImageUrl(dialogue.sprite)) {
             return nextVisible;
        }

        const actorId = dialogue.actorId;
        const currentData = nextVisible[actorId] || {};

        nextVisible[actorId] = {
            ...currentData,
            actorId: actorId,
            sprite: dialogue.sprite,
            expression: dialogue.expression || currentData.expression || "",
            lastSpokenAt: spokenAt || Date.now()
        };

        const keys = Object.keys(nextVisible);
        if (keys.length > maximum) {
            keys.sort((a, b) => (nextVisible[a].lastSpokenAt || 0) - (nextVisible[b].lastSpokenAt || 0));
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
