const fs = require('fs');

let content = fs.readFileSync('hoja_personaje.js', 'utf8');

const oldFunc = `    async function consumirIngredientes(slotsData) { // returns updates object instead of executing directly
        // origins array has {list, key, cant}
        // we need to subtract from these origins
        const updates = {};

        // Flatten required consumption
        const consumptionNeeded = {}; // {list_key: amountToSubtract}

        for (let i=1; i<=5; i++) {
            const data = slotsData[i];
            if (data && data.origins) {
                let remainingToConsume = data.cantidadUsar;
                for (const origin of data.origins) {
                    if (remainingToConsume <= 0) break;

                    const availableInThisOrigin = origin.cant;
                    const path = \`campaña/jugadores/\${currentName}/\${origin.list}/\${origin.key}\`;

                    if (availableInThisOrigin <= remainingToConsume) {
                        updates[path] = null; // Borrar ítem
                        remainingToConsume -= availableInThisOrigin;
                    } else {
                        // Quedan algunos
                        updates[path + '/cantidad'] = availableInThisOrigin - remainingToConsume;
                        remainingToConsume = 0;
                    }
                }
            }
        }

        if (Object.keys(updates).length > 0) {
            return updates;
        }
        return updates;
    }`;

const newFunc = `    async function consumirIngredientes(slotsData) { // returns updates object instead of executing directly
        const updates = {};

        // Track the current available quantities to prevent double-spending when reading multiple times
        // key format: "list/key"
        const currentStock = {};

        for (let i=1; i<=5; i++) {
            const data = slotsData[i];
            if (data && data.origins) {
                let remainingToConsume = data.cantidadUsar;
                for (const origin of data.origins) {
                    if (remainingToConsume <= 0) break;

                    const stockKey = \`\${origin.list}/\${origin.key}\`;
                    if (currentStock[stockKey] === undefined) {
                        currentStock[stockKey] = origin.cant;
                    }

                    const availableInThisOrigin = currentStock[stockKey];
                    const basePath = \`campaña/jugadores/\${currentName}/\${origin.list}/\${origin.key}\`;

                    if (availableInThisOrigin <= remainingToConsume) {
                        // Consumir todo lo de este origin
                        updates[basePath] = null;
                        if (updates[basePath + '/cantidad'] !== undefined) delete updates[basePath + '/cantidad'];

                        remainingToConsume -= availableInThisOrigin;
                        currentStock[stockKey] = 0;
                    } else {
                        // Consumir parcialmente
                        currentStock[stockKey] = availableInThisOrigin - remainingToConsume;
                        if (updates[basePath] !== null) {
                            updates[basePath + '/cantidad'] = currentStock[stockKey];
                        }
                        remainingToConsume = 0;
                    }
                }
            }
        }

        return updates;
    }`;

content = content.replace(oldFunc, newFunc);
fs.writeFileSync('hoja_personaje.js', content, 'utf8');
console.log('consumirIngredientes patched');
