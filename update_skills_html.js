const fs = require('fs');

let html = fs.readFileSync('hoja_personaje.html', 'utf8');

// We need to find where to put the new skills section.
// The D&D 5E stats end here:
/*
                  <!-- CHA -->
                  <div class="sheet-attr-group">
                    <div class="sheet-attr-card" style="min-height: auto; padding: 10px;">
                      <h3 style="font-size: 16px;">CARISMA (CHA)</h3>
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 0;">
                        <span id="display-cha-mod" style="font-size: 32px; font-weight: bold; color: #fff;">+0</span>
                        <div style="font-size: 14px; color: #888; font-family: 'Courier New', Courier, monospace;">
                          Base: <span id="display-cha-base">10</span> | Bonus: <span id="display-cha-bonus">0</span>
                        </div>
                      </div>
                      <button type="action" name="act_roll_skill_carisma" class="sheet-roll-skill-btn" style="margin-top: 10px; width: 100%;">[ TIRAR ]</button>
                    </div>
                  </div>

                </div>
              </div>
*/

const searchBlock = `                  <!-- CHA -->
                  <div class="sheet-attr-group">
                    <div class="sheet-attr-card" style="min-height: auto; padding: 10px;">
                      <h3 style="font-size: 16px;">CARISMA (CHA)</h3>
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 0;">
                        <span id="display-cha-mod" style="font-size: 32px; font-weight: bold; color: #fff;">+0</span>
                        <div style="font-size: 14px; color: #888; font-family: 'Courier New', Courier, monospace;">
                          Base: <span id="display-cha-base">10</span> | Bonus: <span id="display-cha-bonus">0</span>
                        </div>
                      </div>
                      <button type="action" name="act_roll_skill_carisma" class="sheet-roll-skill-btn" style="margin-top: 10px; width: 100%;">[ TIRAR ]</button>
                    </div>
                  </div>

                </div>`;

const skillsHtml = `
                <!-- D&D 5E SKILLS LIST -->
                <div style="margin-top: 25px; border-top: 2px solid #3e2723; padding-top: 15px;">
                  <h3 style="color: #c49a00; text-align: center; margin-bottom: 15px; font-family: 'BebasKai', sans-serif; font-size: 24px; letter-spacing: 2px;">HABILIDADES (SKILLS)</h3>

                  <div style="display: flex; justify-content: center; margin-bottom: 15px;">
                     <div style="background: #1a1a1a; border: 1px solid #c49a00; padding: 5px 15px; border-radius: 4px; font-family: 'Courier New', Courier, monospace; color: #fff;">
                       BONO DE COMPETENCIA: <span id="display-proficiency-bonus" style="font-weight: bold; color: #0df;">+2</span>
                     </div>
                  </div>

                  <div id="player-skills-container" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                    <!-- JS will inject the 18 skills here to keep HTML clean and logic centralized -->
                  </div>
                </div>
`;

if (html.includes(searchBlock)) {
    const replaced = html.replace(searchBlock, searchBlock + skillsHtml);
    fs.writeFileSync('hoja_personaje.html', replaced, 'utf8');
    console.log("HTML Skills updated");
} else {
    console.log("Search block not found!");
}
