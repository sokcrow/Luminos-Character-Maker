import sys

def main():
    filepath = 'js/combatEngine.js'

    with open(filepath, 'r') as f:
        content = f.read()

    # Locate and modify calculateAoETargets

    # Old logic:
    # 1. Filter out primary target
    # 2. Sort by 'untargeted' then speed

    # New logic:
    # Geometric spread, friendly fire allowed, based on distance to primary target epicentre. Ties resolved by RNG.

    search_logic = "        // Filter out the primary target from the possible targets"

    # Find the bounds of calculateAoETargets
    start_idx = content.find("calculateAoETargets: function(skill, primaryTarget, allPossibleTargets) {")
    end_idx = content.find("triggerEvent: function(tag, context, targetsHit = []) {", start_idx)

    if start_idx == -1 or end_idx == -1:
        print("Could not find calculateAoETargets")
        return

    old_func = content[start_idx:end_idx]

    new_func = """calculateAoETargets: function(skill, primaryTarget, allPossibleTargets) {
        if (!primaryTarget || !skill) return [];
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
    },

    """

    content = content.replace(old_func, new_func)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
