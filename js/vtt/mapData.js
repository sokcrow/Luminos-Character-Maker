export const mockMapData = {
    grid: {
        cols: 30,
        rows: 30,
        size: 70
    },
    walls: [
        { x1: 0, y1: 0, x2: 2100, y2: 0, z: [0, 1], blocksMovement: true, blocksVision: true },
        { x1: 2100, y1: 0, x2: 2100, y2: 2100, z: [0, 1], blocksMovement: true, blocksVision: true },
        { x1: 2100, y1: 2100, x2: 0, y2: 2100, z: [0, 1], blocksMovement: true, blocksVision: true },
        { x1: 0, y1: 2100, x2: 0, y2: 0, z: [0, 1], blocksMovement: true, blocksVision: true },

        { x1: 70, y1: 70, x2: 2030, y2: 70, z: [0, 1], blocksMovement: true, blocksVision: true },
        { x1: 2030, y1: 70, x2: 2030, y2: 2030, z: [0, 1], blocksMovement: true, blocksVision: true },
        { x1: 2030, y1: 2030, x2: 70, y2: 2030, z: [0, 1], blocksMovement: true, blocksVision: true },
        { x1: 70, y1: 2030, x2: 70, y2: 70, z: [0, 1], blocksMovement: true, blocksVision: true },

        { x1: 350, y1: 70, x2: 350, y2: 490, z: [0], blocksMovement: true, blocksVision: true },
        { x1: 350, y1: 490, x2: 350, y2: 630, z: [0], blocksMovement: true, blocksVision: false },
        { x1: 700, y1: 70, x2: 700, y2: 980, z: [1], blocksMovement: true, blocksVision: true }
    ],
    tokens: [
        {
            id: 'player1',
            x: 245,
            y: 245,
            radius: 28,
            color: '#00ffcc',
            backgroundColor: '#20242a',
            iconColor: '#ffffff',
            icon: 'person',
            draggable: true,
            gridPosition: { col: 3, row: 3, z: 0 },
            z: [0]
        }
    ],
    lights: []
};
