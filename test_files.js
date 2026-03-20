const fs = require('fs');

const files = ['hoja_personaje.css', 'hoja_personaje.html', 'pantalla_dm.html'];
let hasError = false;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('neon') || content.includes('cyber') || content.includes('glow') || content.includes('rounded')) {
    console.log(`Warning: Found forbidden keywords in ${file}`);
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if (line.toLowerCase().includes('neon') || line.toLowerCase().includes('cyber') || line.toLowerCase().includes('glow') || line.toLowerCase().includes('rounded')) {
            // print with context
            console.log(`Line ${i+1}: ${line}`);
        }
    });
    hasError = true;
  }
}

if (!hasError) {
  console.log("Clean! No forbidden keywords found.");
}
