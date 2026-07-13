// --- DATA GLOBALS ---
let currentWeek = 1;
let currentGold = 1000;
let currentMorale = 0;
let hirelings = [];

// Base array of 100 mixed names
const NAMES_DB = [
    "Alaric", "Brutus", "Cassius", "Dante", "Elias", "Faust", "Gregor", "Heathcliff", "Ishmael", "Jude",
    "Kael", "Lucius", "Meursault", "Nero", "Orion", "Percival", "Quentin", "Rodion", "Sinclair", "Tiberius",
    "Urien", "Valerius", "Wolfgang", "Xander", "Yi Sang", "Zane", "Alden", "Balthazar", "Caius", "Don Quixote",
    "Ezra", "Felix", "Gideon", "Hong Lu", "Ignatius", "Jasper", "Klaus", "Lazarus", "Magnus", "Nicodemus",
    "Octavius", "Phineas", "Ryoshu", "Silas", "Thaddeus", "Ulysses", "Victor", "Wallace", "Xerxes", "Yorick",
    "Zebediah", "Amelia", "Beatrice", "Clara", "Desdemona", "Eleanor", "Fiona", "Genevieve", "Hazel", "Iris",
    "Josephine", "Katerina", "Lilith", "Matilda", "Nadia", "Ophelia", "Penelope", "Rowena", "Seraphina", "Theresa",
    "Ursula", "Vesper", "Winifred", "Xenia", "Yvaine", "Zelda", "Arthur", "Barnaby", "Cormac", "Declan",
    "Evander", "Finnian", "Gareth", "Horatio", "Ivor", "Julian", "Killian", "Leander", "Merrick", "Niall",
    "Oisin", "Puck", "Quinlan", "Ronan", "Stellan", "Tristan", "Uther", "Vaughn", "Wyatt", "Xavi"
];

// Canvas Globals
const canvas = document.getElementById("bastion-canvas");
const ctx = canvas.getContext("2d");

const CELL_SIZE = 32;
const COLS = 32; // 1024 / 32
const ROWS = 24; // 768 / 32

const TYPE_EMPTY = 0;
const TYPE_ROOM = 1;
const TYPE_CORRIDOR = 2;
const TYPE_DOOR = 3;

class Cell {
    constructor(c, r) {
        this.c = c;
        this.r = r;
        this.type = TYPE_EMPTY;
        this.roomId = null;
    }
}

// Initialize Map Grid
let grid = [];
for (let r = 0; r < ROWS; r++) {
    let row = [];
    for (let c = 0; c < COLS; c++) {
        row.push(new Cell(c, r));
    }
    grid.push(row);
}

// Base Installations matching 2x2, 4x4, 6x6 grids
const ROOMS = [
    { id: 0, name: "Cuarteles", col: 2, row: 2, w: 4, h: 4 },
    { id: 1, name: "Herrería", col: 8, row: 2, w: 4, h: 4 },
    { id: 2, name: "Granja", col: 14, row: 2, w: 6, h: 6 },
    { id: 3, name: "Almacén", col: 2, row: 8, w: 4, h: 4 },
    { id: 4, name: "Taberna", col: 8, row: 8, w: 4, h: 4 },
    { id: 5, name: "Santuario", col: 22, row: 2, w: 4, h: 4 },
    { id: 6, name: "Sala Mando", col: 14, row: 10, w: 6, h: 6 },
];

function initGrid() {
    ROOMS.forEach(room => {
        for(let r = room.row; r < room.row + room.h; r++) {
            for(let c = room.col; c < room.col + room.w; c++) {
                grid[r][c].type = TYPE_ROOM;
                grid[r][c].roomId = room.id;
            }
        }
    });
}
initGrid();

// --- BUILD MODE (DM) ---
let currentBuildMode = null; // "corridor", "door", "erase"
let isDrawing = false;

document.querySelectorAll('.btn-build').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (currentBuildMode === e.target.dataset.mode) {
            currentBuildMode = null;
            e.target.classList.remove('active-mode');
        } else {
            document.querySelectorAll('.btn-build').forEach(b => b.classList.remove('active-mode'));
            currentBuildMode = e.target.dataset.mode;
            e.target.classList.add('active-mode');
        }
    });
});

function handleCanvasInteraction(e) {
    if (!currentBuildMode || !isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const c = Math.floor(x / CELL_SIZE);
    const r = Math.floor(y / CELL_SIZE);

    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
        const cell = grid[r][c];
        if (currentBuildMode === 'corridor') {
            if (cell.type === TYPE_EMPTY || cell.type === TYPE_DOOR) {
                cell.type = TYPE_CORRIDOR;
                cell.roomId = null;
            }
        } else if (currentBuildMode === 'door') {
            // Door can be placed anywhere except over another door
            if (cell.type !== TYPE_DOOR) {
                cell.type = TYPE_DOOR;
                cell.roomId = null; // overriding room wall if placed on edge
            }
        } else if (currentBuildMode === 'erase') {
            // Can only erase corridors and doors to avoid deleting core rooms
            if (cell.type === TYPE_CORRIDOR || cell.type === TYPE_DOOR) {
                cell.type = TYPE_EMPTY;
                cell.roomId = null;
            }
        }
    }
}

canvas.addEventListener('mousedown', (e) => { isDrawing = true; handleCanvasInteraction(e); });
canvas.addEventListener('mousemove', (e) => { handleCanvasInteraction(e); });
canvas.addEventListener('mouseup', () => { isDrawing = false; });
canvas.addEventListener('mouseleave', () => { isDrawing = false; });


// --- A* PATHFINDING ---
function heuristic(a, b) {
    // Manhattan distance
    return Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
}

function getNeighbors(cell) {
    const neighbors = [];
    const dirs = [[0,-1], [0,1], [-1,0], [1,0]]; // Up, Down, Left, Right

    for (const [dc, dr] of dirs) {
        const nc = cell.c + dc;
        const nr = cell.r + dr;
        if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) {
            const next = grid[nr][nc];
            if (next.type !== TYPE_EMPTY) {
                let canMove = false;

                // Allowed transitions to enforce walls:
                // Inside same room
                if (cell.type === TYPE_ROOM && next.type === TYPE_ROOM) {
                    if (cell.roomId === next.roomId) canMove = true;
                }
                // Any cell to a Door, or Door to any cell
                else if (cell.type === TYPE_DOOR || next.type === TYPE_DOOR) {
                    canMove = true;
                }
                // Corridor to Corridor
                else if (cell.type === TYPE_CORRIDOR && next.type === TYPE_CORRIDOR) {
                    canMove = true;
                }

                if (canMove) {
                    neighbors.push(next);
                }
            }
        }
    }
    return neighbors;
}

function findPath(startCell, endCell) {
    let openSet = [startCell];
    let cameFrom = new Map();
    let gScore = new Map();
    let fScore = new Map();

    gScore.set(startCell, 0);
    fScore.set(startCell, heuristic(startCell, endCell));

    while(openSet.length > 0) {
        // Get lowest fScore
        let current = openSet[0];
        let lowestIndex = 0;
        for (let i = 1; i < openSet.length; i++) {
            if (fScore.get(openSet[i]) < fScore.get(current)) {
                current = openSet[i];
                lowestIndex = i;
            }
        }

        if (current === endCell) {
            let path = [current];
            while (cameFrom.has(current)) {
                current = cameFrom.get(current);
                path.push(current);
            }
            return path.reverse();
        }

        openSet.splice(lowestIndex, 1);

        let neighbors = getNeighbors(current);
        for (let neighbor of neighbors) {
            let tentativeG = gScore.get(current) + 1;

            if (!gScore.has(neighbor) || tentativeG < gScore.get(neighbor)) {
                cameFrom.set(neighbor, current);
                gScore.set(neighbor, tentativeG);
                fScore.set(neighbor, tentativeG + heuristic(neighbor, endCell));
                if (!openSet.includes(neighbor)) {
                    openSet.push(neighbor);
                }
            }
        }
    }
    return null; // No path found
}


// --- HIRELING AGENT CLASS ---
class HirelingAgent {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.grade = 10;
        this.weeksWorked = 0;
        this.salary = 1.4;

        // Start at a random room
        const startRoom = ROOMS[Math.floor(Math.random() * ROOMS.length)];
        const startC = startRoom.col + Math.floor(Math.random() * startRoom.w);
        const startR = startRoom.row + Math.floor(Math.random() * startRoom.h);

        this.c = startC;
        this.r = startR;
        this.x = this.c * CELL_SIZE + CELL_SIZE/2;
        this.y = this.r * CELL_SIZE + CELL_SIZE/2;

        this.targetRoom = null;
        this.path = [];

        this.speed = 1.0 + Math.random() * 1.5;
        this.state = "working";
        this.waitTime = 60;
    }

    pickNewTarget() {
        let attempts = 0;
        let foundPath = false;

        // Try up to 5 times to find a reachable room
        while(attempts < 5 && !foundPath) {
            const room = ROOMS[Math.floor(Math.random() * ROOMS.length)];
            const tc = room.col + Math.floor(Math.random() * room.w);
            const tr = room.row + Math.floor(Math.random() * room.h);

            const startCell = grid[this.r][this.c];
            const endCell = grid[tr][tc];

            const path = findPath(startCell, endCell);
            if (path && path.length > 1) {
                this.targetRoom = room;
                this.path = path.slice(1); // skip current cell
                this.state = "walking";
                foundPath = true;
            }
            attempts++;
        }

        if (!foundPath) {
            // Blocked, wait and try again
            this.state = "working";
            this.waitTime = 120;
        }
    }

    update() {
        if (this.state === "walking") {
            if (this.path.length > 0) {
                const nextCell = this.path[0];
                const targetX = nextCell.c * CELL_SIZE + CELL_SIZE/2;
                const targetY = nextCell.r * CELL_SIZE + CELL_SIZE/2;

                const dx = targetX - this.x;
                const dy = targetY - this.y;
                const dist = Math.sqrt(dx*dx + dy*dy);

                if (dist < this.speed) {
                    // Reached center of next cell
                    this.x = targetX;
                    this.y = targetY;
                    this.c = nextCell.c;
                    this.r = nextCell.r;
                    this.path.shift();
                } else {
                    this.x += (dx/dist) * this.speed;
                    this.y += (dy/dist) * this.speed;
                }
            } else {
                // Arrived at final destination
                this.state = "working";
                this.waitTime = Math.floor(120 + Math.random() * 300);
            }
        } else if (this.state === "working") {
            this.waitTime--;
            if (this.waitTime <= 0) {
                this.pickNewTarget();
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = "#00FF00";
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();

        if (this.state === "working" && this.waitTime % 30 < 15) {
            ctx.strokeStyle = "rgba(0, 255, 0, 0.5)";
            ctx.beginPath();
            ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

// --- CANVAS RENDERING ---
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Rooms (Base floors and borders)
    ctx.lineWidth = 2;
    ROOMS.forEach(room => {
        const x = room.col * CELL_SIZE;
        const y = room.row * CELL_SIZE;
        const w = room.w * CELL_SIZE;
        const h = room.h * CELL_SIZE;

        ctx.fillStyle = "rgba(42, 22, 16, 0.4)";
        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = "#D32F2F";
        ctx.strokeRect(x, y, w, h);

        ctx.strokeStyle = "rgba(211, 47, 47, 0.3)";
        ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);

        ctx.fillStyle = "#d8cdb8";
        ctx.font = "16px 'Oswald', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(room.name, x + w / 2, y + h / 2);
    });

    // 2. Draw Corridors and Doors (Overlays)
    for(let r=0; r<ROWS; r++) {
        for(let c=0; c<COLS; c++) {
            const type = grid[r][c].type;
            const x = c * CELL_SIZE;
            const y = r * CELL_SIZE;

            if (type === TYPE_CORRIDOR) {
                ctx.fillStyle = "rgba(100, 100, 100, 0.3)"; // subtle corridor
                ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
            } else if (type === TYPE_DOOR) {
                ctx.fillStyle = "rgba(255, 215, 0, 0.8)"; // Gold door
                ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
            }
        }
    }

    // 3. Draw Grid Lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += CELL_SIZE) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    for (let y = 0; y <= canvas.height; y += CELL_SIZE) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // 4. Update and draw hirelings
    hirelings.forEach(h => {
        h.update();
        h.draw(ctx);
    });

    requestAnimationFrame(animate);
}

// --- LOGIC & UI UPDATES ---
function updateStatsUI() {
    document.getElementById("ui-week").innerText = currentWeek;
    document.getElementById("ui-gold").innerText = currentGold.toFixed(1);
    document.getElementById("ui-morale").innerText = currentMorale;
}

function updateTableUI() {
    const tbody = document.getElementById("hirelings-tbody");
    const fragment = document.createDocumentFragment();

    hirelings.forEach(h => {
        const tr = document.createElement("tr");

        const tdName = document.createElement("td");
        tdName.innerText = h.name;

        const tdGrade = document.createElement("td");
        tdGrade.innerText = h.grade;

        const tdWeeks = document.createElement("td");
        tdWeeks.innerText = h.weeksWorked;

        const tdSalary = document.createElement("td");
        tdSalary.innerText = h.salary;

        tr.appendChild(tdName);
        tr.appendChild(tdGrade);
        tr.appendChild(tdWeeks);
        tr.appendChild(tdSalary);

        fragment.appendChild(tr);
    });

    tbody.innerHTML = "";
    tbody.appendChild(fragment);
}

function hireRandom() {
    const randomName = NAMES_DB[Math.floor(Math.random() * NAMES_DB.length)];
    const newHireling = new HirelingAgent(Date.now(), randomName);
    hirelings.push(newHireling);
    updateTableUI();
}

function advanceWeek() {
    currentWeek++;
    let totalSalary = 0;
    hirelings.forEach(h => {
        h.weeksWorked++;
        totalSalary += h.salary;
    });

    currentGold -= totalSalary;
    if (currentGold < 0) {
        console.warn("Gold is negative! The Bastion is in debt.");
    }

    updateStatsUI();
    updateTableUI();
}

// --- INIT ---
document.getElementById("btn-hire").addEventListener("click", hireRandom);
document.getElementById("btn-advance-week").addEventListener("click", advanceWeek);

updateStatsUI();
requestAnimationFrame(animate);
