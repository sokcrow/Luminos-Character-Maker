export const mockMapData = {
    grid: {
        cols: 30,
        rows: 30,
        size: 70
    },
    walls: [
        // Exterior walls on multiple Z layers (0 and 1)
        { x1: 70, y1: 70, x2: 2030, y2: 70, z: [0, 1] },
        { x1: 2030, y1: 70, x2: 2030, y2: 2030, z: [0, 1] },
        { x1: 2030, y1: 2030, x2: 70, y2: 2030, z: [0, 1] },
        { x1: 70, y1: 2030, x2: 70, y2: 70, z: [0, 1] },

        // Interior wall on Z layer 0 only
        { x1: 350, y1: 70, x2: 350, y2: 490, z: [0] },

        // Interior wall on Z layer 1 only
        { x1: 700, y1: 70, x2: 700, y2: 980, z: [1] }
    ],
    tokens: [
        // Player token starting on Z layer 0
        { id: "player1", x: 140, y: 140, radius: 30, color: "#00ffcc", z: [0] }
    ],
    lights: [
        // Lights to be added later
    ]
};
