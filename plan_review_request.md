The user wants to simplify the crafting system:
1. They want the crafting system to simply know what items are on the crafting table, without needing to learn the recipe beforehand. So any items placed on the table that match a recipe will produce the result, without skill checks or coin tosses.
2. "Tengo X1 y X2 y estos hacen Y y ya, sin tiradas ni nada". So, I need to remove the whole `dc`, `habilidadReq`, `spValue`, probability calculation, and coin toss animation from the `fabricarBtn` click listener.
3. Upon clicking `btn-craft-fabricar`, if there's a matching recipe, it should immediately execute the synthesis (deduct ingredients and give the result) successfully (`exito = true`), without any random failure penalty or roll information.

Steps:
1. Modify the `fabricarBtn` click listener (lines 1335 to 1430 in `hoja_personaje.js`):
   - Replace the entire block that calculates `dc`, `habilidadReq`, `skillMod`, `spValue`, `probCara`, and triggers `coinTossPanel`.
   - Instead, simply determine the destination (`inventario_stash` or `inventario`), get the slider value for quantity, and directly call `ejecutarSintesisDin(playerName, receta, cantidadFabricar, currentPlayerData[destination] || {}, true, null, destination)`.
   - The user's playerName can be retrieved with `document.querySelector('input[name="attr_character_name"]')?.value.trim()`.
2. Modify `validarMesaCraft` in `hoja_personaje.js`:
   - Remove the code that checks if the recipe is `discovered` (lines 1563-1577).
   - Instead, always show the actual item preview (`previewSlot.innerHTML` with full `resultIconUrl`, `resultItemName`, `resultDesc` without `silhouetted` class or `brightness(0)` filter) so the user can see what they are making even before making it.
   - Remove the `skillReqDisplay` logic (lines 1518-1526, 1592-1596) that displays required rolls or DC.
3. Modify `ejecutarSintesisDin` in `hoja_personaje.js` (lines 2872-2877):
   - Remove the `!exito` check and penalty deduction logic, since all crafting will now succeed.
4. Verify the changes using `read_file` or running playwright tests (`npx playwright test test_crafting.spec.js` / `test_crafting_ui.spec.js` if applicable, although maybe tests need to be updated due to UI changes).
5. Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
