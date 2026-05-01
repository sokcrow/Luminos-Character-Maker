const fs = require('fs');

let html = fs.readFileSync('hoja_personaje.html', 'utf8');

const startTag = '<div id="stats-container"';
const endTag = '</div>\n              </div>\n            </div>'; // approximate end

const startIndex = html.indexOf(startTag);
if (startIndex === -1) {
  console.log("Could not find stats-container");
  process.exit(1);
}

// We need to find the matching closing div of `hud-tab-content` or `sheet-attributes-section`.
// We will use a script to find the correct ending by looking for `</div>\n          </div>\n          <div class="hud-modal-footer">` or similar

const statsContainerReplacement = `
              <div id="stats-container" class="sheet-attributes-section" style="position: relative;">

                <!-- D&D 5E Combat Top Bar -->
                <div style="display: flex; justify-content: space-around; background: #1a1a1a; padding: 10px; border: 1px solid #3e2723; border-radius: 4px; margin-bottom: 15px;">
                  <div style="text-align: center;">
                    <div style="color: #c49a00; font-size: 12px; font-family: 'Courier New', Courier, monospace;">ARMOR CLASS</div>
                    <div id="display-ac" style="color: #fff; font-size: 24px; font-weight: bold; font-family: 'BebasKai', sans-serif;">10</div>
                  </div>
                  <div style="text-align: center;">
                    <div style="color: #c49a00; font-size: 12px; font-family: 'Courier New', Courier, monospace;">SPEED</div>
                    <div id="display-speed" style="color: #fff; font-size: 24px; font-weight: bold; font-family: 'BebasKai', sans-serif;">30</div>
                  </div>
                  <div style="text-align: center;">
                    <div style="color: #c49a00; font-size: 12px; font-family: 'Courier New', Courier, monospace;">INITIATIVE</div>
                    <div id="display-initiative" style="color: #fff; font-size: 24px; font-weight: bold; font-family: 'BebasKai', sans-serif;">+0</div>
                  </div>
                </div>

                <!-- D&D 5E Core Stats Grid -->
                <div class="sheet-attributes-grid" style="grid-template-columns: repeat(3, 1fr); gap: 15px;">

                  <!-- STR -->
                  <div class="sheet-attr-group">
                    <div class="sheet-attr-card" style="min-height: auto; padding: 10px;">
                      <h3 style="font-size: 16px;">FUERZA (STR)</h3>
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 0;">
                        <span id="display-str-mod" style="font-size: 32px; font-weight: bold; color: #fff;">+0</span>
                        <div style="font-size: 14px; color: #888; font-family: 'Courier New', Courier, monospace;">
                          Base: <span id="display-str-base">10</span> | Bonus: <span id="display-str-bonus">0</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- DEX -->
                  <div class="sheet-attr-group">
                    <div class="sheet-attr-card" style="min-height: auto; padding: 10px;">
                      <h3 style="font-size: 16px;">DESTREZA (DEX)</h3>
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 0;">
                        <span id="display-dex-mod" style="font-size: 32px; font-weight: bold; color: #fff;">+0</span>
                        <div style="font-size: 14px; color: #888; font-family: 'Courier New', Courier, monospace;">
                          Base: <span id="display-dex-base">10</span> | Bonus: <span id="display-dex-bonus">0</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- CON -->
                  <div class="sheet-attr-group">
                    <div class="sheet-attr-card" style="min-height: auto; padding: 10px;">
                      <h3 style="font-size: 16px;">CONSTITUCIÓN (CON)</h3>
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 0;">
                        <span id="display-con-mod" style="font-size: 32px; font-weight: bold; color: #fff;">+0</span>
                        <div style="font-size: 14px; color: #888; font-family: 'Courier New', Courier, monospace;">
                          Base: <span id="display-con-base">10</span> | Bonus: <span id="display-con-bonus">0</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- INT -->
                  <div class="sheet-attr-group">
                    <div class="sheet-attr-card" style="min-height: auto; padding: 10px;">
                      <h3 style="font-size: 16px;">INTELIGENCIA (INT)</h3>
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 0;">
                        <span id="display-int-mod" style="font-size: 32px; font-weight: bold; color: #fff;">+0</span>
                        <div style="font-size: 14px; color: #888; font-family: 'Courier New', Courier, monospace;">
                          Base: <span id="display-int-base">10</span> | Bonus: <span id="display-int-bonus">0</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- WIS -->
                  <div class="sheet-attr-group">
                    <div class="sheet-attr-card" style="min-height: auto; padding: 10px;">
                      <h3 style="font-size: 16px;">SABIDURÍA (WIS)</h3>
                      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 0;">
                        <span id="display-wis-mod" style="font-size: 32px; font-weight: bold; color: #fff;">+0</span>
                        <div style="font-size: 14px; color: #888; font-family: 'Courier New', Courier, monospace;">
                          Base: <span id="display-wis-base">10</span> | Bonus: <span id="display-wis-bonus">0</span>
                        </div>
                      </div>
                    </div>
                  </div>

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
                    </div>
                  </div>

                </div>
              </div>`;


// Find the end index of the old block we want to replace
// The block ends right before <div class="hud-tab-content" id="perks-container" style="display:none;">
// Wait, looking at the grep earlier... we need to see what comes after stats-container

const newHtml = html.substring(0, startIndex) + statsContainerReplacement + html.substring(html.indexOf('</div>\n            </div>\n          </div>\n        </div>\n      </div>\n\n      <!-- Coin Toss Panel (Modal) -->'));

fs.writeFileSync('hoja_personaje.html', newHtml, 'utf8');
console.log("HTML Replacement Done");
