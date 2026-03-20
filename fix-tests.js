const fs = require("fs");

let testFile = fs.readFileSync("tests/test_hud.spec.js", "utf8");

// Replace `file://${path.resolve(__dirname, "../hoja_personaje.html")}`
// with `http://localhost:3000/hoja_personaje.html`

testFile = testFile.replace(
  'const filePath = `file://${path.resolve(__dirname, "../hoja_personaje.html")}`;',
  "const filePath = `http://localhost:3000/hoja_personaje.html`;",
);

fs.writeFileSync("tests/test_hud.spec.js", testFile);
