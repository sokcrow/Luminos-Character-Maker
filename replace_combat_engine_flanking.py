import sys

def main():
    filepath = 'js/combatEngine.js'

    with open(filepath, 'r') as f:
        content = f.read()

    # Step 4: Dynamic Movement and Flanking Modifiers
    # We need FLANKING_DAMAGE_MULTIPLIER and FLANKING_POWER_BONUS
    # Also evaluateFlanking function
    # And vector movement logic during attack

    globals_insertion = """    FLANKING_DAMAGE_MULTIPLIER: 1.20,
    FLANKING_POWER_BONUS: 2,

"""
    if "FLANKING_DAMAGE_MULTIPLIER:" not in content:
        content = content.replace("currentState: 'COMBAT_ACTIVE',", "currentState: 'COMBAT_ACTIVE',\n" + globals_insertion, 1)

    # Let's replace evaluateFlanking to use true adjacent opposite checking based on vectors
    # We want to know if there's any ally diametrically opposite around the target relative to the attacker

    old_evaluate_flanking = """    evaluateFlanking: function(attackerCoords, allyCoords, targetCoords) {
        // Un flanqueo ocurre si las coordenadas del atacante y el aliado están
        // diametralmente opuestas alrededor del objetivo.
        // Vector desde el objetivo al aliado
        let vecAllyX = allyCoords.x - targetCoords.x;
        let vecAllyY = allyCoords.y - targetCoords.y;

        // Vector desde el objetivo al atacante
        let vecAtkX = attackerCoords.x - targetCoords.x;
        let vecAtkY = attackerCoords.y - targetCoords.y;

        // Deben ser vectores no nulos
        if ((vecAllyX === 0 && vecAllyY === 0) || (vecAtkX === 0 && vecAtkY === 0)) return false;

        // Son diametralmente opuestos si vecAtk == -vecAlly
        return (vecAtkX === -vecAllyX && vecAtkY === -vecAllyY);
    }"""

    new_evaluate_flanking = """    evaluateFlanking: function(attackerCoords, allyCoords, targetCoords) {
        // Flanking check with direct adjacent opposite. We just check if they are diametrically opposite in a 1-cell radius (or straight line)
        let vecAllyX = allyCoords.x - targetCoords.x;
        let vecAllyY = allyCoords.y - targetCoords.y;

        let vecAtkX = attackerCoords.x - targetCoords.x;
        let vecAtkY = attackerCoords.y - targetCoords.y;

        if ((vecAllyX === 0 && vecAllyY === 0) || (vecAtkX === 0 && vecAtkY === 0)) return false;

        // Normalize vectors for direction comparison in case they are further away
        let normAllyX = vecAllyX === 0 ? 0 : vecAllyX / Math.abs(vecAllyX);
        let normAllyY = vecAllyY === 0 ? 0 : vecAllyY / Math.abs(vecAllyY);

        let normAtkX = vecAtkX === 0 ? 0 : vecAtkX / Math.abs(vecAtkX);
        let normAtkY = vecAtkY === 0 ? 0 : vecAtkY / Math.abs(vecAtkY);

        return (normAtkX === -normAllyX && normAtkY === -normAllyY);
    },

    moveAttackerToTarget: function(attacker, target) {
        if (!attacker.grid_pos || !target.grid_pos) return;

        let vecX = target.grid_pos.x - attacker.grid_pos.x;
        let vecY = target.grid_pos.y - attacker.grid_pos.y;

        // Normalize to find target adjacent cell in the direction of the vector
        let dirX = vecX === 0 ? 0 : (vecX > 0 ? 1 : -1);
        let dirY = vecY === 0 ? 0 : (vecY > 0 ? 1 : -1);

        let targetX = target.grid_pos.x - dirX;
        let targetY = target.grid_pos.y - dirY;

        // Ensure cell is free. If occupied, orbit the target.
        let allAlive = this.getAllAliveUnits();

        const isOccupied = (x, y) => {
            if (x === target.grid_pos.x && y === target.grid_pos.y) return true; // Can't stand ON the target
            return allAlive.some(u => u !== attacker && u.grid_pos && u.grid_pos.x === x && u.grid_pos.y === y);
        };

        if (isOccupied(targetX, targetY)) {
            // Orbit: check 8 adjacent cells
            let found = false;
            let offsets = [
                {x: 0, y: -1}, {x: 1, y: -1}, {x: 1, y: 0}, {x: 1, y: 1},
                {x: 0, y: 1}, {x: -1, y: 1}, {x: -1, y: 0}, {x: -1, y: -1}
            ];
            // Sort offsets by distance to preferred targetX, targetY
            offsets.sort((a, b) => {
                let cellA_x = target.grid_pos.x + a.x;
                let cellA_y = target.grid_pos.y + a.y;
                let cellB_x = target.grid_pos.x + b.x;
                let cellB_y = target.grid_pos.y + b.y;
                let distA = Math.abs(cellA_x - targetX) + Math.abs(cellA_y - targetY);
                let distB = Math.abs(cellB_x - targetX) + Math.abs(cellB_y - targetY);
                return distA - distB;
            });

            for (let offset of offsets) {
                let checkX = target.grid_pos.x + offset.x;
                let checkY = target.grid_pos.y + offset.y;
                if (!isOccupied(checkX, checkY)) {
                    targetX = checkX;
                    targetY = checkY;
                    found = true;
                    break;
                }
            }
        }

        attacker.grid_pos.x = targetX;
        attacker.grid_pos.y = targetY;
    }"""

    if "moveAttackerToTarget: function" not in content:
        content = content.replace(old_evaluate_flanking, new_evaluate_flanking)

    with open(filepath, 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
