import sys

def main():
    filepath = 'js/combatEngine.js'

    with open(filepath, 'r') as f:
        content = f.read()

    # Indiscriminate targeting caches targets at Round Start.
    # Hook into triggerPhase for [Round Start]

    search_logic = "if (phaseTag === '[Round Start]') {"
    replace_logic = """if (phaseTag === '[Round Start]') {
                unit.isImmobilized = unit.statusEffects && unit.statusEffects['immobilized'] && unit.statusEffects['immobilized'].count > 0;

                // Cache indiscriminate targets
                if (!unit.isImmobilized) {
                    let allSkills = [].concat(unit.attack_tier_1_sequence || [], unit.attack_tier_2_sequence || [], unit.attack_tier_3_sequence || []);
                    allSkills.forEach(skill => {
                        if (skill && skill.targeting_type === 'Indiscriminate') {
                            let weight = skill.atkWeight || 1;
                            if (weight > 1) {
                                let allAlive = this.getAllAliveUnits().filter(u => u !== unit); // Exclude self
                                // Shuffle
                                allAlive.sort(() => 0.5 - Math.random());
                                skill._cachedIndiscriminateTargets = allAlive.slice(0, weight - 1);
                            }
                        }
                    });
                }
"""

    if "skill._cachedIndiscriminateTargets =" not in content:
        content = content.replace(search_logic + "\n                unit.isImmobilized = unit.statusEffects && unit.statusEffects['immobilized'] && unit.statusEffects['immobilized'].count > 0;", replace_logic, 1)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
