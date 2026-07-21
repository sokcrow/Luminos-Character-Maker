export const mockMapData = {
    grid: {
        cols: 20,
        rows: 15,
        cellSize: 70
    },
    walls: [
        // Exterior walls on multiple Z layers (0 and 1)
        { x1: 70, y1: 70, x2: 1330, y2: 70, z: [0, 1] },
        { x1: 1330, y1: 70, x2: 1330, y2: 980, z: [0, 1] },
        { x1: 1330, y1: 980, x2: 70, y2: 980, z: [0, 1] },
        { x1: 70, y1: 980, x2: 70, y2: 70, z: [0, 1] },

        // Interior wall on Z layer 0 only
        { x1: 350, y1: 70, x2: 350, y2: 490, z: [0] },

        // Interior wall on Z layer 1 only
        { x1: 700, y1: 70, x2: 700, y2: 980, z: [1] }
    ],
    lights: [
        // Lights to be added later
    ]
};
