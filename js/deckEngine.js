const DeckEngine = {
    /**
     * Initializes a unit's deck and drawing logic.
     * @param {Object} unit - The unit whose deck is to be initialized.
     * @param {Array} equippedSkills - Array of skill objects equipped by the unit.
     */
    initDeck: function(unit, equippedSkills) {
        // Initialize deck based on equipped skills
        unit.deck = [];
        equippedSkills.forEach(skill => {
            // Default amount is 1 if not specified
            let amount = skill.skillAmount || 1;
            for (let i = 0; i < amount; i++) {
                unit.deck.push(Object.assign({}, skill));
            }
        });

        // Shuffle the deck initially
        this.shuffleDeck(unit.deck);
    },

    /**
     * Shuffles a deck array in place using the Fisher-Yates algorithm.
     * @param {Array} deck - The deck array to shuffle.
     */
    shuffleDeck: function(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    },

    /**
     * Draws the hand for a given action slot.
     * Returns 2 active skills and 1 preview skill.
     * If the deck runs out, it needs to be reshuffled from a discard pile (to be implemented as needed).
     * @param {Array} deck - The unit's current deck of skills.
     * @returns {Object} An object containing the drawn skills.
     */
    drawHandForSlot: function(deck) {
        // We need at least 3 skills for a full hand (2 active, 1 preview)
        // If there are fewer than 3 skills, we will just return what we have.
        // In a full implementation, you would move a discard pile back to the deck and reshuffle.

        let hand = {
            activeOptions: [],
            previewOption: null
        };

        if (deck.length >= 1) {
            hand.activeOptions.push(deck.shift());
        }
        if (deck.length >= 1) {
            hand.activeOptions.push(deck.shift());
        }
        if (deck.length >= 1) {
            hand.previewOption = deck.shift();
        }

        return hand;
    },

    /**
     * Injects a defensive skill into the hand, replacing a specified active option.
     * This bypasses the random deck draw and is triggered by a long-press in the UI.
     * @param {Object} currentHand - The current hand object (returned by drawHandForSlot).
     * @param {Object} defensiveSkill - The static defensive skill to inject.
     * @param {number} indexToReplace - The index of the active option to replace (0 or 1).
     * @returns {Object} The updated hand.
     */
    injectDefensiveSkill: function(currentHand, defensiveSkill, indexToReplace) {
        if (!currentHand || !currentHand.activeOptions) return currentHand;

        if (indexToReplace >= 0 && indexToReplace < currentHand.activeOptions.length) {
            // Replace the selected slot with the defensive skill
            currentHand.activeOptions[indexToReplace] = Object.assign({}, defensiveSkill);
        }

        return currentHand;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeckEngine;
} else if (typeof window !== 'undefined') {
    window.DeckEngine = DeckEngine;
}
