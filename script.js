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

// Base Installations
const ROOMS = [
    { name: "Cuarteles", x: 100, y: 100, width: 250, height: 150 },
    { name: "Herrería", x: 400, y: 100, width: 200, height: 150 },
    { name: "Granja", x: 650, y: 100, width: 250, height: 250 },
    { name: "Almacén", x: 100, y: 300, width: 200, height: 250 },
    { name: "Taberna", x: 350, y: 300, width: 250, height: 200 },
    { name: "Santuario", x: 700, y: 400, width: 200, height: 200 },
    { name: "Sala de Mando", x: 250, y: 600, width: 350, height: 120 }
];

// --- HIRELLING AGENT CLASS ---
class HirelingAgent {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.grade = 10;
        this.weeksWorked = 0;
        this.salary = 1.4; // Fixed salary for Grade 10

        // Position & Movement
        // Spawn randomly somewhere on canvas initially
        this.x = Math.random() * (canvas.width - 20) + 10;
        this.y = Math.random() * (canvas.height - 20) + 10;
        this.targetRoom = null;
        this.targetX = this.x;
        this.targetY = this.y;

        this.speed = 1.5 + Math.random() * 1.5; // Slight variation in speed
        this.state = "idle"; // "idle", "walking", "working"
        this.waitTime = 0;

        this.pickNewTarget();
    }

    pickNewTarget() {
        // Pick random room
        const room = ROOMS[Math.floor(Math.random() * ROOMS.length)];
        this.targetRoom = room;
        // Pick a point inside the room, keeping a small padding
        const padding = 15;
        this.targetX = room.x + padding + Math.random() * (room.width - padding * 2);
        this.targetY = room.y + padding + Math.random() * (room.height - padding * 2);
        this.state = "walking";
    }

    update() {
        if (this.state === "walking") {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 5) {
                // Arrived
                this.x = this.targetX;
                this.y = this.targetY;
                this.state = "working";
                // Wait between 100 to 300 frames (~1.5s to 5s at 60fps)
                this.waitTime = Math.floor(100 + Math.random() * 200);
            } else {
                // Move towards target
                this.x += (dx / dist) * this.speed;
                this.y += (dy / dist) * this.speed;
            }
        } else if (this.state === "working") {
            this.waitTime--;
            if (this.waitTime <= 0) {
                this.pickNewTarget();
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = "#00FF00"; // Green dot
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Optional: draw small pulse if working
        if (this.state === "working" && this.waitTime % 30 < 15) {
            ctx.strokeStyle = "rgba(0, 255, 0, 0.5)";
            ctx.beginPath();
            ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}


// --- CANVAS RENDERING ---
function drawGrid() {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    const gridSize = 40;

    ctx.beginPath();
    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
}

function drawRooms() {
    ctx.lineWidth = 2;
    ROOMS.forEach(room => {
        // Room background (dark semi transparent)
        ctx.fillStyle = "rgba(42, 22, 16, 0.4)"; // limbus dark brown alpha
        ctx.fillRect(room.x, room.y, room.width, room.height);

        // Room border
        ctx.strokeStyle = "#D32F2F"; // limbus red
        ctx.strokeRect(room.x, room.y, room.width, room.height);

        // Inner border (blueprint style)
        ctx.strokeStyle = "rgba(211, 47, 47, 0.3)";
        ctx.strokeRect(room.x + 4, room.y + 4, room.width - 8, room.height - 8);

        // Room name
        ctx.fillStyle = "#d8cdb8"; // limbus cream
        ctx.font = "16px 'Oswald', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(room.name, room.x + room.width / 2, room.y + room.height / 2);
    });
}

function animate() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawGrid();
    drawRooms();

    // Update and draw hirelings
    hirelings.forEach(h => {
        h.update();
        h.draw(ctx);
    });

    requestAnimationFrame(animate);
}


// --- LOGIC & UI UPDATES ---

function updateStatsUI() {
    document.getElementById("ui-week").innerText = currentWeek;
    // Format gold to 1 decimal if needed
    document.getElementById("ui-gold").innerText = currentGold.toFixed(1);
    document.getElementById("ui-morale").innerText = currentMorale;
}

function updateTableUI() {
    const tbody = document.getElementById("hirelings-tbody");
    // Use fragment for performance
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

    // Just in case they go negative
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
// Start animation loop
requestAnimationFrame(animate);