(function (global) {
    "use strict";

    const DECK_VERSION = 2;
    const DEFAULT_CAPACITY = 12;
    const DEFAULT_MAX_UNIQUE_SKILLS = 8;
    const HAND_SIZE = 2;
    const TIER_COPIES = Object.freeze({ 1: 3, 2: 2, 3: 1 });

    const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
    const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

    function skillId(skill = {}) {
        return String(skill.id ?? skill.skillId ?? skill.skill_id ?? skill.name ?? skill.nombre ?? "").trim();
    }

    function normalizeTier(value) {
        if (typeof value === "string") {
            const raw = value.trim().toUpperCase();
            if (raw === "I") return 1;
            if (raw === "II") return 2;
            if (raw === "III") return 3;
        }
        const tier = Math.trunc(Number(value));
        return [1, 2, 3].includes(tier) ? tier : null;
    }

    function tierOf(skill = {}) {
        return normalizeTier(skill.tier ?? skill.skillTier ?? skill.skill_tier ?? skill.skillLevel ?? skill.skill_level);
    }

    function copiesForTier(tier) {
        return TIER_COPIES[normalizeTier(tier)] || 0;
    }

    function availabilityType(skill = {}) {
        return normalizeId(skill.availability?.type ?? skill.availabilityType ?? skill.skillAvailability ?? skill.skill_availability ?? "deck");
    }

    function isDeckEligible(skill = {}) {
        if (skill.deck?.enabled === false || skill.inDeck === false || skill.in_deck === false) return false;
        return !["granted", "free", "off_deck", "offdeck", "defensive", "defense"].includes(availabilityType(skill));
    }

    function copiesForSkill(skill = {}) {
        const tier = tierOf(skill);
        if (tier) return copiesForTier(tier);

        // Legacy-readable only. Canonical combat Skills should author Tier I/II/III.
        const legacy = Math.trunc(Number(skill.deckCopies ?? skill.skillAmount ?? skill.skill_amount));
        return [1, 2, 3].includes(legacy) ? legacy : 0;
    }

    function buildDeckDefinition(equippedSkills = [], options = {}) {
        const capacity = Math.max(1, Math.trunc(Number(options.capacity ?? DEFAULT_CAPACITY)) || DEFAULT_CAPACITY);
        const maxUniqueSkills = Math.max(1, Math.trunc(Number(options.maxUniqueSkills ?? DEFAULT_MAX_UNIQUE_SKILLS)) || DEFAULT_MAX_UNIQUE_SKILLS);
        const requireFull = options.requireFull !== false;
        const cards = [];
        const excludedSkillIds = [];
        const uniqueIds = new Set();

        for (const rawSkill of Array.isArray(equippedSkills) ? equippedSkills : []) {
            if (!rawSkill || typeof rawSkill !== "object") continue;
            const id = skillId(rawSkill);
            if (!id) throw new Error("deck_skill_id_required");
            if (!isDeckEligible(rawSkill)) {
                excludedSkillIds.push(id);
                continue;
            }

            const tier = tierOf(rawSkill);
            const copies = copiesForSkill(rawSkill);
            if (!copies) throw new Error(`deck_skill_tier_required:${id}`);
            uniqueIds.add(id);

            for (let copyIndex = 0; copyIndex < copies; copyIndex++) {
                cards.push({
                    cardTemplateId: `${id}::copy::${copyIndex + 1}`,
                    skillId: id,
                    tier,
                    copyIndex,
                    skill: clone(rawSkill),
                });
            }
        }

        if (uniqueIds.size > maxUniqueSkills) throw new Error(`deck_unique_skill_limit_exceeded:${uniqueIds.size}/${maxUniqueSkills}`);
        if (cards.length > capacity) throw new Error(`deck_capacity_exceeded:${cards.length}/${capacity}`);
        if (requireFull && cards.length !== capacity) throw new Error(`deck_must_equal_capacity:${cards.length}/${capacity}`);

        return {
            version: DECK_VERSION,
            capacity,
            maxUniqueSkills,
            cardCount: cards.length,
            uniqueSkillCount: uniqueIds.size,
            cards,
            excludedSkillIds,
            combatReady: cards.length === capacity,
        };
    }

    function shuffleDeck(deck = [], random = Math.random) {
        const rng = typeof random === "function" ? random : Math.random;
        for (let i = deck.length - 1; i > 0; i--) {
            const roll = Math.max(0, Math.min(0.999999999999, Number(rng()) || 0));
            const j = Math.floor(roll * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    function createRuntimeState(definition) {
        return {
            version: DECK_VERSION,
            definition: clone(definition),
            slots: {},
            drawSerial: 0,
            lastTurnStartRound: null,
        };
    }

    function initDeck(unit, equippedSkills, options = {}) {
        if (!unit || typeof unit !== "object") throw new Error("deck_unit_required");
        const definition = buildDeckDefinition(equippedSkills, options);
        unit.skillDeck = createRuntimeState(definition);

        // Legacy-readable mirror. Canonical slot draws never consume this array.
        unit.deck = definition.cards.map((card) => clone(card.skill));
        return unit.skillDeck;
    }

    function hasDeck(unit = {}) {
        return Boolean(unit.skillDeck?.definition?.cards?.length);
    }

    function ensureDrawPile(state, slot, random) {
        if (slot.drawPile.length) return;
        slot.cycle += 1;
        slot.drawPile = state.definition.cards.map((card) => clone(card));
        shuffleDeck(slot.drawPile, random);
    }

    function drawCard(state, slot, random) {
        ensureDrawPile(state, slot, random);
        const template = slot.drawPile.shift();
        if (!template) throw new Error("deck_draw_failed");
        state.drawSerial += 1;
        return {
            drawId: `${slot.id}::draw::${state.drawSerial}`,
            cardTemplateId: template.cardTemplateId,
            skillId: template.skillId,
            tier: template.tier,
            copyIndex: template.copyIndex,
            cycle: slot.cycle,
            skill: clone(template.skill),
        };
    }

    function fillHand(state, slot, random) {
        while (slot.hand.length < HAND_SIZE) slot.hand.push(drawCard(state, slot, random));
        if (slot.hand.length > HAND_SIZE) slot.hand = slot.hand.slice(-HAND_SIZE);
        return slot.hand;
    }

    function createSlotState(state, slotId, options = {}) {
        const slot = {
            id: String(slotId),
            hand: [],
            drawPile: [],
            cycle: 0,
            usedDrawId: null,
            createdRound: options.round ?? null,
            lastTurnStartRound: options.round ?? null,
        };
        fillHand(state, slot, options.random);
        return slot;
    }

    function rotateSlotAtTurnStart(state, slot, options = {}) {
        const oldest = slot.hand[0] || null;
        const newest = slot.hand[1] || null;
        const usedDrawId = slot.usedDrawId ? String(slot.usedDrawId) : null;
        const usedNewest = Boolean(newest && usedDrawId === newest.drawId);

        // Every surviving Slot ages one card per Turn Start. If the newest card was
        // actually executed last round, it also leaves, accelerating the build by 2.
        slot.hand = usedNewest ? [] : (newest ? [newest] : []);
        slot.usedDrawId = null;
        fillHand(state, slot, options.random);
        slot.lastTurnStartRound = options.round ?? null;

        return {
            slotId: slot.id,
            removedOldestDrawId: oldest?.drawId || null,
            removedUsedNewestDrawId: usedNewest ? newest?.drawId || null : null,
            hand: clone(slot.hand),
        };
    }

    function slotIdsForCount(unit, count) {
        const actorId = String(unit?.id ?? unit?.unitId ?? unit?.characterId ?? "unit");
        const total = Math.max(0, Math.trunc(Number(count) || 0));
        return Array.from({ length: total }, (_, index) => `${actorId}_slot_${index}`);
    }

    function onTurnStart(unit, options = {}) {
        if (!hasDeck(unit)) return { synced: false, reason: "deck_not_initialized", slots: {} };
        const state = unit.skillDeck;
        const round = options.round ?? ((Number(state.lastTurnStartRound) || 0) + 1);
        const random = typeof options.random === "function" ? options.random : Math.random;
        const desiredSlotIds = Array.isArray(options.slotIds)
            ? options.slotIds.map(String)
            : slotIdsForCount(unit, options.slotCount ?? Object.keys(state.slots).length);
        const desired = new Set(desiredSlotIds);
        const removedSlotIds = [];
        const createdSlotIds = [];
        const rotated = [];

        for (const slotId of Object.keys(state.slots)) {
            if (desired.has(slotId)) continue;
            removedSlotIds.push(slotId);
            delete state.slots[slotId];
        }

        for (const slotId of desiredSlotIds) {
            let slot = state.slots[slotId];
            if (!slot) {
                slot = createSlotState(state, slotId, { random, round });
                state.slots[slotId] = slot;
                createdSlotIds.push(slotId);
                continue;
            }
            if (slot.lastTurnStartRound === round) continue;
            rotated.push(rotateSlotAtTurnStart(state, slot, { random, round }));
        }

        state.lastTurnStartRound = round;
        return {
            synced: true,
            round,
            createdSlotIds,
            removedSlotIds,
            rotated,
            slots: snapshot(unit).slots,
        };
    }

    function getSlot(unit, slotId) {
        return unit?.skillDeck?.slots?.[String(slotId)] || null;
    }

    function getSlotHand(unit, slotId) {
        const slot = getSlot(unit, slotId);
        return slot ? clone(slot.hand) : [];
    }

    function getHandOptions(unit, slotId) {
        return getSlotHand(unit, slotId).map((card, handIndex) => ({
            ...clone(card.skill),
            __deckCard: {
                slotId: String(slotId),
                drawId: card.drawId,
                skillId: card.skillId,
                handIndex,
                tier: card.tier,
            },
        }));
    }

    function markCardUsed(unit, slotId, drawId) {
        const slot = getSlot(unit, slotId);
        if (!slot) return { used: false, reason: "deck_slot_missing" };
        const card = slot.hand.find((entry) => entry.drawId === String(drawId));
        if (!card) return { used: false, reason: "deck_card_not_in_hand" };
        slot.usedDrawId = card.drawId;
        return { used: true, slotId: slot.id, drawId: card.drawId, skillId: card.skillId };
    }

    function bindActionToCard(action, unit, slotId, cardRef) {
        if (!action || typeof action !== "object") throw new Error("deck_action_required");
        const slot = getSlot(unit, slotId);
        if (!slot) throw new Error("deck_slot_missing");

        let card = null;
        if (typeof cardRef === "number") card = slot.hand[cardRef] || null;
        else if (typeof cardRef === "string") card = slot.hand.find((entry) => entry.drawId === cardRef) || null;
        else if (cardRef?.drawId) card = slot.hand.find((entry) => entry.drawId === String(cardRef.drawId)) || null;
        if (!card) throw new Error("deck_card_not_in_hand");

        action.actionSlotId = String(slotId);
        action.metadata = {
            ...(action.metadata || {}),
            deckCard: {
                slotId: String(slotId),
                drawId: card.drawId,
                skillId: card.skillId,
            },
        };
        return action;
    }

    function markActionUsed(unit, action = {}) {
        const ref = action.metadata?.deckCard || action.metadata?.deckSelection || null;
        if (!ref?.drawId) return { used: false, reason: "action_has_no_deck_card" };
        const slotId = String(ref.slotId || action.actionSlotId || "");
        if (!slotId) return { used: false, reason: "action_has_no_deck_slot" };
        return markCardUsed(unit, slotId, ref.drawId);
    }

    function snapshot(unit = {}) {
        if (!hasDeck(unit)) return { initialized: false };
        const state = unit.skillDeck;
        const slots = {};
        for (const [slotId, slot] of Object.entries(state.slots)) {
            slots[slotId] = {
                id: slot.id,
                hand: clone(slot.hand),
                drawPileRemaining: slot.drawPile.length,
                cycle: slot.cycle,
                usedDrawId: slot.usedDrawId,
                createdRound: slot.createdRound,
                lastTurnStartRound: slot.lastTurnStartRound,
            };
        }
        return {
            initialized: true,
            version: state.version,
            capacity: state.definition.capacity,
            cardCount: state.definition.cardCount,
            combatReady: state.definition.combatReady,
            lastTurnStartRound: state.lastTurnStartRound,
            slots,
        };
    }

    // Legacy helper retained for old prototype callers. Canonical combat uses
    // onTurnStart() and independent per-Slot state; there is no preview card.
    function drawHandForSlot(deck) {
        const source = Array.isArray(deck) ? deck : [];
        return {
            activeOptions: source.splice(0, HAND_SIZE),
            previewOption: null,
        };
    }

    // Defensive Skills are permanent options outside the Deck. This helper no
    // longer replaces a drawn card; it exposes the option separately.
    function injectDefensiveSkill(currentHand, defensiveSkill) {
        const hand = currentHand && typeof currentHand === "object" ? clone(currentHand) : { activeOptions: [], previewOption: null };
        hand.defensiveOptions = Array.isArray(hand.defensiveOptions) ? hand.defensiveOptions : [];
        hand.defensiveOptions.push(clone(defensiveSkill));
        return hand;
    }

    const DeckEngine = Object.freeze({
        DECK_VERSION,
        DEFAULT_CAPACITY,
        DEFAULT_MAX_UNIQUE_SKILLS,
        HAND_SIZE,
        TIER_COPIES,
        skillId,
        tierOf,
        copiesForTier,
        copiesForSkill,
        isDeckEligible,
        buildDeckDefinition,
        initDeck,
        hasDeck,
        shuffleDeck,
        createSlotState,
        rotateSlotAtTurnStart,
        slotIdsForCount,
        onTurnStart,
        getSlot,
        getSlotHand,
        getHandOptions,
        markCardUsed,
        bindActionToCard,
        markActionUsed,
        snapshot,
        drawHandForSlot,
        injectDefensiveSkill,
    });

    global.LuminousDeckEngine = DeckEngine;
    global.DeckEngine = DeckEngine;
    if (typeof module !== "undefined" && module.exports) module.exports = DeckEngine;
})(typeof window !== "undefined" ? window : globalThis);
