const fs = require('fs');
const path = 'hoja_personaje.js';
let content = fs.readFileSync(path, 'utf8');

// I notice a potential syntax issue where the if (actName && actName.startsWith("act_roll_skill_")) block isn't closed properly
// Or if it is, the code I injected was closed with "}" but it might have been an open block.
// Let's check the lines around 3120
const problematicBlock = `          } else {
            setTimeout(stopCoin, (i + 1) * 600);
          }
        }

      // Close Coin Toss Panel
      const closeBtn = e.target.closest("#coin-toss-close-btn");
      if (closeBtn && !closeBtn.disabled) {
        const panel = document.getElementById("coin-toss-panel");
        if (panel) panel.style.display = "none";
      }
    });`;

const replacementBlock = `          } else {
            setTimeout(stopCoin, (i + 1) * 600);
          }
        }
      }

      // Close Coin Toss Panel
      const closeBtn = e.target.closest("#coin-toss-close-btn");
      if (closeBtn && !closeBtn.disabled) {
        const panel = document.getElementById("coin-toss-panel");
        if (panel) panel.style.display = "none";
      }
    });`;

if (content.includes(problematicBlock)) {
  content = content.replace(problematicBlock, replacementBlock);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Fixed missing closing brace");
} else {
  console.log("Did not find problematic block");
}
