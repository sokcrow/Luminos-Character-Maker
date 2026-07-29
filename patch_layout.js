const fs = require('fs');
let content = fs.readFileSync('dm-combat-creator.html', 'utf8');

const search = `            <div style="margin-top: 15px;">
                <button type="button" id="save-skill-db-btn" onclick="saveSkillToDB()" style="width: 100%; padding: 8px; margin-top: 5px; background: #8a0303; color: white; border: none; cursor: pointer; font-weight: bold;">[ GUARDAR HABILIDAD EN DB ]</button>
            </div>
        </fieldset>


        </div> <!-- End module-skills -->`;

const replace = `            <div style="margin-top: 15px;">
                <button type="button" id="save-skill-db-btn" onclick="saveSkillToDB()" style="width: 100%; padding: 8px; margin-top: 5px; background: #8a0303; color: white; border: none; cursor: pointer; font-weight: bold;">[ GUARDAR HABILIDAD EN DB ]</button>
            </div>
        </fieldset>

        </div> <!-- End ms-left -->
        <div id="ms-right" style="flex: 1; overflow-y: auto; padding-left: 5px; border-left: 1px solid #444;">
            <div style="background: rgba(20,20,20,0.95); border: 1px solid #886633; color: #fff; border-radius: 6px; display: flex; flex-direction: column; margin-bottom: 20px;">
                <div class="dm-header" style="background: #201000; padding: 8px; text-align: center; font-size: 14px; font-weight: bold; border-bottom: 1px solid #886633; color: #ffdd44; letter-spacing: 1px; text-transform: uppercase;">
                    Directorio Activo
                </div>
                <div style="padding: 10px; display: flex; flex-direction: column; gap: 8px;">
                    <input type="text" id="skill-dir-search" placeholder="Buscar por nombre, daño o pecado..." onkeyup="filterSkillDirectory()" style="width: 100%; box-sizing: border-box; background: #000; color: #fff; border: 1px solid #555; padding: 4px; font-size: 11px; margin-bottom: 5px;">
                    <div id="skill-directory-list" style="overflow-y: auto; background: rgba(0,0,0,0.5); border: 1px solid #443311; padding: 4px; border-radius: 3px; max-height: 400px; display: flex; flex-direction: column; gap: 4px;">
                    </div>
                </div>
            </div>
        </div>

        </div> <!-- End module-skills -->`;

content = content.replace(search, replace);
fs.writeFileSync('dm-combat-creator.html', content);
