import re

with open('js/combatEngine.js', 'r', encoding='utf-8') as f:
    content = f.read()


search_init = """        // Ensure attack sequence architecture arrays exist
        unit.attack_tier_1_sequence = unit.attack_tier_1_sequence || [];
        unit.attack_tier_2_sequence = unit.attack_tier_2_sequence || [];
        unit.attack_tier_3_sequence = unit.attack_tier_3_sequence || [];

        // Initialize Original Sequences Memory (Base State Reversion)"""

replace_init = """        // Ensure attack sequence architecture arrays exist
        unit.attack_tier_1_sequence = unit.attack_tier_1_sequence || [];
        unit.attack_tier_2_sequence = unit.attack_tier_2_sequence || [];
        unit.attack_tier_3_sequence = unit.attack_tier_3_sequence || [];

        // Migrate skillRange
        let allSkills = [].concat(unit.attack_tier_1_sequence, unit.attack_tier_2_sequence, unit.attack_tier_3_sequence);
        allSkills.forEach(s => {
            if (s && s.skillRange === undefined) s.skillRange = 1;
        });

        // Initialize Original Sequences Memory (Base State Reversion)"""

content = content.replace(search_init, replace_init)


search_aoe = """    calculateAoETargets: function(skill, primaryTarget, allPossibleTargets) {
        if (!primaryTarget || !skill) return [];

        if (skill.targeting_type === 'Indiscriminate' && skill._cachedIndiscriminateTargets) {
            let hits = [primaryTarget];
            skill._cachedIndiscriminateTargets.forEach(t => {
                if (t.hp > 0) hits.push(t);
            });
            return hits;
        }

        let remainingWeight = (skill.atkWeight || 1) - (primaryTarget.slotWeight || 1);
        let targetsHit = [primaryTarget];

        if (remainingWeight <= 0) return targetsHit;

        // Remove primary target from pool
        let possibleTargets = allPossibleTargets.filter(t => t !== primaryTarget && t.hp > 0);

        // Ensure everyone has grid_pos
        possibleTargets = possibleTargets.filter(t => t.grid_pos);
        if (!primaryTarget.grid_pos) return targetsHit;

        let cx = primaryTarget.grid_pos.x;
        let cy = primaryTarget.grid_pos.y;

        // Calculate exact distance to epicenter
        possibleTargets.forEach(t => {
            t._distToEpicenter = Math.sqrt(Math.pow(t.grid_pos.x - cx, 2) + Math.pow(t.grid_pos.y - cy, 2));
        });

        // Group by distance
        let grouped = {};
        possibleTargets.forEach(t => {
            let d = t._distToEpicenter.toFixed(4); // Use fixed precision for float ties
            if (!grouped[d]) grouped[d] = [];
            grouped[d].push(t);
        });

        // Sort distances ascending
        let sortedDistances = Object.keys(grouped).map(Number).sort((a, b) => a - b);

        for (let d of sortedDistances) {
            if (remainingWeight <= 0) break;

            let group = grouped[d.toFixed(4)];
            if (group.length <= remainingWeight) {
                // Everyone in this distance group gets hit
                group.forEach(t => {
                    targetsHit.push(t);
                    remainingWeight -= (t.slotWeight || 1);
                });
            } else {
                // RNG tiebreaker for remaining weight
                let shuffled = group.sort(() => 0.5 - Math.random());
                for (let i = 0; i < remainingWeight && i < shuffled.length; i++) {
                    targetsHit.push(shuffled[i]);
                }
                remainingWeight = 0; // Depleted
            }
        }

        return targetsHit;
    },"""

replace_aoe = """    calculateAoETargets: function(skill, primaryTarget, allPossibleTargets, unitAttacker) {
        if (!primaryTarget || !skill) return [];

        if (skill.targeting_type === 'Indiscriminate' && skill._cachedIndiscriminateTargets) {
            let hits = [primaryTarget];
            skill._cachedIndiscriminateTargets.forEach(t => {
                if (t.hp > 0) hits.push(t);
            });
            return hits;
        }

        let remainingWeight = (skill.atkWeight || skill.weight || 1) - (primaryTarget.slotWeight || 1);
        let targetsHit = [primaryTarget];

        if (remainingWeight <= 0) return targetsHit;

        // Remove primary target from pool
        let possibleTargets = allPossibleTargets.filter(t => t !== primaryTarget && t.hp > 0);

        // Ensure everyone has grid_pos
        possibleTargets = possibleTargets.filter(t => t.grid_pos);
        if (!primaryTarget.grid_pos || (skill.targeting_type === 'AoE' && !unitAttacker.grid_pos)) return targetsHit;

        let skillRange = skill.skillRange !== undefined ? skill.skillRange : 1;

        if (skill.targeting_type === 'AoE') {
            let pattern = skill.aoe_pattern || 'Radius';

            if (pattern === 'Self') {
                let cx = unitAttacker.grid_pos.x;
                let cy = unitAttacker.grid_pos.y;
                possibleTargets.forEach(t => {
                    t._distToEpicenter = Math.sqrt(Math.pow(t.grid_pos.x - cx, 2) + Math.pow(t.grid_pos.y - cy, 2));
                });
                // Filter by range
                possibleTargets = possibleTargets.filter(t => t._distToEpicenter <= skillRange);
            } else if (pattern === 'Radius') {
                let cx = primaryTarget.grid_pos.x;
                let cy = primaryTarget.grid_pos.y;
                possibleTargets.forEach(t => {
                    t._distToEpicenter = Math.sqrt(Math.pow(t.grid_pos.x - cx, 2) + Math.pow(t.grid_pos.y - cy, 2));
                });
                // Filter by range
                possibleTargets = possibleTargets.filter(t => t._distToEpicenter <= skillRange);
            } else if (pattern === 'Cone') {
                let ax = unitAttacker.grid_pos.x;
                let ay = unitAttacker.grid_pos.y;
                let px = primaryTarget.grid_pos.x;
                let py = primaryTarget.grid_pos.y;

                // Attack Vector V
                let vx = px - ax;
                let vy = py - ay;
                let magV = Math.sqrt(vx * vx + vy * vy);

                possibleTargets.forEach(t => {
                    let tx = t.grid_pos.x;
                    let ty = t.grid_pos.y;

                    // Vector W (Attacker -> Target)
                    let wx = tx - ax;
                    let wy = ty - ay;
                    let magW = Math.sqrt(wx * wx + wy * wy);

                    t._distToEpicenter = magW; // Distance to attacker for sorting

                    if (magV === 0 || magW === 0) {
                        t._inCone = false;
                    } else {
                        // Dot product for angle
                        let dot = (vx * wx + vy * wy);
                        let cosTheta = dot / (magV * magW);
                        // cos(22.5 degrees) ~ 0.9238795
                        if (magW <= skillRange && cosTheta >= 0.9238795) {
                            t._inCone = true;
                        } else {
                            t._inCone = false;
                        }
                    }
                });

                // Filter by cone and range
                possibleTargets = possibleTargets.filter(t => t._inCone);
            }
        } else {
            // Default Radius around primary target logic (for legacy AoE logic if targeting type isn't properly AoE but passed here somehow)
            let cx = primaryTarget.grid_pos.x;
            let cy = primaryTarget.grid_pos.y;
            possibleTargets.forEach(t => {
                t._distToEpicenter = Math.sqrt(Math.pow(t.grid_pos.x - cx, 2) + Math.pow(t.grid_pos.y - cy, 2));
            });
        }

        // Group by distance
        let grouped = {};
        possibleTargets.forEach(t => {
            let d = t._distToEpicenter.toFixed(4); // Use fixed precision for float ties
            if (!grouped[d]) grouped[d] = [];
            grouped[d].push(t);
        });

        // Sort distances ascending
        let sortedDistances = Object.keys(grouped).map(Number).sort((a, b) => a - b);

        for (let d of sortedDistances) {
            if (remainingWeight <= 0) break;

            let group = grouped[d.toFixed(4)];
            if (group.length <= remainingWeight) {
                // Everyone in this distance group gets hit
                group.forEach(t => {
                    targetsHit.push(t);
                    remainingWeight -= (t.slotWeight || 1);
                });
            } else {
                // RNG tiebreaker for remaining weight
                let shuffled = group.sort(() => 0.5 - Math.random());
                for (let i = 0; i < remainingWeight && i < shuffled.length; i++) {
                    targetsHit.push(shuffled[i]);
                }
                remainingWeight = 0; // Depleted
            }
        }

        return targetsHit;
    },"""

content = content.replace(search_aoe, replace_aoe)

with open('js/combatEngine.js', 'w', encoding='utf-8') as f:
    f.write(content)
