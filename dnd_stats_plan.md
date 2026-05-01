1. **Update Firebase JSON Schema inside `hoja_personaje.html` and `pantalla_dm.html` to reflect D&D 5e Structure + Custom Combat Actions**
   - The JSON schema to be applied will introduce properties inside `combatStats`:
     - `ac`: Number (Armor Class)
     - `speed`: Number (Speed)
     - `initiative`: Number (Initiative)
     - `stats`: Object with D&D 5e stats:
       - `fuerza`: { base: number, bonus: number }
       - `destreza`: { base: number, bonus: number }
       - `constitucion`: { base: number, bonus: number }
       - `inteligencia`: { base: number, bonus: number }
       - `sabiduria`: { base: number, bonus: number }
       - `carisma`: { base: number, bonus: number }
     - `sp_actual`: Number (Sanity/Stamina current)
     - `sp_max`: Number (Sanity/Stamina max) - Currently only `sp_actual` exists, we will prepare it nicely.
     - `combat_actions`: Array/Object (prep for coin clash system, e.g. `[ { id, name, cantidad_monedas, valor_moneda } ]`)

2. **Update DM Screen UI (`pantalla_dm.html`)**
   - Add new input fields for AC, Speed, Initiative, and the 6 main D&D stats (base and bonus) in the `dm-combat-modal`.
   - Ensure a "Editar Stats 5e" button logic triggers this correctly.
   - Update the Javascript handling for `btn-open-modal` to fetch and load these values from `combatStats` (or fallback to defaults like 10 for stats, 0 for bonus).
   - Update the Javascript handling for `btn-save-stats` to save these new inputs correctly into `combatStats` for the selected player in Firebase. Prepare the `combat_actions` node with an empty array or basic object if not existing.

3. **Update Player Character Sheet UI (`hoja_personaje.html` & `hoja_personaje.js`)**
   - In `hoja_personaje.html`, locate the current "CUERPO" and "Mente" etc. attributes and skill layout and replace it with a D&D 5e layout showing AC, Speed, Initiative, and the 6 stats (Fuerza, Destreza, Constitución, Inteligencia, Sabiduría, Carisma).
   - The inputs for the stats should be read-only since only the DM can change them.
   - Maintain the existing visual style (classes, cards, headers) but refactor it to fit D&D stats.
   - The SP sphere (HUD SP) should be retained.
   - In `hoja_personaje.js`, listen to updates from Firebase (using `db.ref().on` or similar) to fetch the 5e stats.
   - Implement the D&D 5e modifier calculation logic: `Math.floor((Stat - 10) / 2)` where `Stat = base + bonus` for each of the 6 main stats.
   - Update the DOM elements in real-time when the data changes, taking care of read-only elements.

4. **Testing and Verification (Pre-commit step)**
   - Call `pre_commit_instructions` tool and perform verifications.
   - Make sure visual and functional verification works via Playwright instructions.
   - Ensure the DM's editing capability persists to Firebase.
   - Ensure the Player's sheet updates in real-time and calculates modifiers without allowing edits.
   - Ensure no regressions with `Ahn` currency or transaction logic.

5. **Submit Changes**
   - Commit and submit changes with a descriptive message and correct branch.
