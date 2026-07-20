const fs = require('fs');
const content = fs.readFileSync('pantalla_dm.html', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('dashboard-mercado') || line.includes('tab-forja')) {
    console.log(`${index + 1}: ${line}`);
  }
});
