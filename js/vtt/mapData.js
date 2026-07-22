export const mockMapData = {
    grid: {
        cols: 30,
        rows: 30,
        size: 70
    },
    walls: [
        // Exterior boundaries (blocks both)
        { x1: 0, y1: 0, x2: 2100, y2: 0, z: [0, 1], blocksMovement: true, blocksVision: true },
        { x1: 2100, y1: 0, x2: 2100, y2: 2100, z: [0, 1], blocksMovement: true, blocksVision: true },
        { x1: 2100, y1: 2100, x2: 0, y2: 2100, z: [0, 1], blocksMovement: true, blocksVision: true },
        { x1: 0, y1: 2100, x2: 0, y2: 0, z: [0, 1], blocksMovement: true, blocksVision: true },

        // Exterior house walls on multiple Z layers (0 and 1)
        { x1: 70, y1: 70, x2: 2030, y2: 70, z: [0, 1], blocksMovement: true, blocksVision: true },
        { x1: 2030, y1: 70, x2: 2030, y2: 2030, z: [0, 1], blocksMovement: true, blocksVision: true },
        { x1: 2030, y1: 2030, x2: 70, y2: 2030, z: [0, 1], blocksMovement: true, blocksVision: true },
        { x1: 70, y1: 2030, x2: 70, y2: 70, z: [0, 1], blocksMovement: true, blocksVision: true },

        // Interior wall on Z layer 0 only
        { x1: 350, y1: 70, x2: 350, y2: 490, z: [0], blocksMovement: true, blocksVision: true },

        // Window on Z layer 0 (blocks movement, allows vision)
        { x1: 350, y1: 490, x2: 350, y2: 630, z: [0], blocksMovement: true, blocksVision: false },

        // Interior wall on Z layer 1 only
        { x1: 700, y1: 70, x2: 700, y2: 980, z: [1], blocksMovement: true, blocksVision: true }
    ],
    tokens: [
        // Player token starting on Z layer 0
        { id: "player1", x: 210, y: 210, radius: 25, color: "#00ffcc", z: [0] }
    ],
    lights: [
        // Lights to be added later
    ]
};
