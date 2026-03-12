1. **Update `hoja_personaje.html`**
   - In `.sheet-tab-profile`, add the toggle state: `<input type="hidden" name="attr_show_profile_edit" class="sheet-state-profile-edit" value="0" />`
   - Modify the header to include the settings button: `<button type="action" name="act_toggle_profile_edit" class="sheet-icon-btn">⚙️</button>`.
   - Add `.sheet-profile-view-card` which displays the Avatar, Nivel, Character Name, Identity, Class, Race as read-only spans, alongside the XP and Ahn displays.
   - Add `.sheet-profile-edit-form` containing the text/number inputs for Avatar URL, Level, Rank, Name, Identity, Class, Race, and Background.
   - Wrap the remaining technical configuration sections (Speed, Slots, Luck, HP, Stagger, Modifiers) inside `<details class="sheet-dm-advanced-config"><summary>⚠️ Configuración Avanzada (Solo DM)</summary> ... </details>`.

2. **Update `hoja_personaje.css`**
   - Use `replace_with_git_merge_diff` to add classes for the new profile UI:
     - Toggle visibility: `.sheet-state-profile-edit[value="0"] ~ .sheet-profile-edit-form { display: none; }` and `.sheet-state-profile-edit[value="1"] ~ .sheet-profile-view-card { display: none; }`
     - Styles for `.sheet-profile-view-card`, `.sheet-id-card-body`, `.sheet-id-card-avatar`, etc.
     - Styles for the `.sheet-dm-advanced-config` (details and summary tags).

3. **Update `hoja_personaje.js`**
   - Use `replace_with_git_merge_diff` to add an event listener for `clicked:toggle_profile_edit` to flip the value of `show_profile_edit` between "0" and "1".

4. **Verify Changes**
   - Use a short Python script to check for unclosed HTML tags and syntax issues.
   - Use `read_file` to review modified sections and ensure everything is placed properly.

5. **Pre-commit verification**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.

6. **Submit**
   - Commit the changes and submit.
