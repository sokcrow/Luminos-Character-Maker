import sys

def main():
    filepath = 'js/combatEngine.js'

    with open(filepath, 'r') as f:
        content = f.read()

    # Need to intercept the actual target acquisition for Indiscriminate during execute / attack
    # We'll just hook this at the point where indiscriminate targets are applied (AoE calculation is usually where secondary targets are resolved).
    # Since we replaced calculateAoETargets, let's inject a handler for Indiscriminate there too, as it acts similarly by resolving secondary targets.

    search_logic = "if (!primaryTarget || !skill) return [];"

    replace_logic = """if (!primaryTarget || !skill) return [];

        if (skill.targeting_type === 'Indiscriminate' && skill._cachedIndiscriminateTargets) {
            let hits = [primaryTarget];
            skill._cachedIndiscriminateTargets.forEach(t => {
                if (t.hp > 0) hits.push(t);
            });
            return hits;
        }
"""
    if "skill.targeting_type === 'Indiscriminate' && skill._cachedIndiscriminateTargets" not in content:
        content = content.replace(search_logic, replace_logic, 1)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
