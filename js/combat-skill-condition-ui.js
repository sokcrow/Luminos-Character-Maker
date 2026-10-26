(function (global) {
    'use strict';

    const BaseSchema = global.CombatSkillSchema;
    if (!BaseSchema || typeof document === 'undefined') return;

    const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
    const canonicalScalingStat = (value) => String(value ?? 'fuerza')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    function prepareCanonicalInput(input) {
        const raw = input && typeof input === 'object' ? { ...input } : {};
        const canonicalWins = [
            ['sourceId', 'source_id'],
            ['statUsed', 'stat_used'],
            ['skillUsed', 'skill_used']
        ];
        canonicalWins.forEach(([canonical, legacy]) => {
            if (hasOwn(raw, canonical)) delete raw[legacy];
        });
        if (hasOwn(raw, 'scalingStat')) raw.scalingStat = canonicalScalingStat(raw.scalingStat);
        else if (hasOwn(raw, 'scaling_stat')) raw.scaling_stat = canonicalScalingStat(raw.scaling_stat);
        return raw;
    }

    function normalizeCombatSkill(input) {
        const skill = BaseSchema.normalizeCombatSkill(prepareCanonicalInput(input));
        skill.scalingStat = canonicalScalingStat(skill.scalingStat);
        return skill;
    }

    function serializeCombatSkill(input, options) {
        const normalized = normalizeCombatSkill(input);
        const output = BaseSchema.serializeCombatSkill(normalized, options);
        output.scalingStat = normalized.scalingStat;
        if (!options || options.includeLegacyAliases !== false) output.scaling_stat = normalized.scalingStat;
        return output;
    }

    function validateCombatSkill(input) {
        const result = BaseSchema.validateCombatSkill(normalizeCombatSkill(input));
        return { ...result, skill: normalizeCombatSkill(result.skill) };
    }

    global.CombatSkillSchema = Object.freeze({
        ...BaseSchema,
        normalizeCombatSkill,
        serializeCombatSkill,
        validateCombatSkill
    });

    const Schema = global.CombatSkillSchema;

    // SP in the creator follows Luminous/Limbus semantics: only Current SP is authored.
    // Legacy sp_percent/sp_max remain readable by the schema, but are intentionally hidden here.
    const KNOWN_STATS = (Schema.CONDITION_STATS || []).filter(item => !['sp_percent', 'sp_max'].includes(item.value));
    const KNOWN_VALUES = new Set(KNOWN_STATS.map(item => item.value));

    function operatorLabel(value) {
        const op = Schema.normalizeConditionOperator(value);
        if (op === '<') return 'less than';
        if (op === '<=') return 'or less';
        if (op === '=') return 'exactly';
        if (op === '>=') return 'or more';
        if (op === '>') return 'more than';
        return value;
    }

    function updateOperatorLabels(box) {
        const select = box.querySelector('select[data-cond="operator"]');
        if (!select) return;
        Array.from(select.options).forEach(option => {
            option.textContent = operatorLabel(option.value);
        });
    }

    function clampCurrentSpValue(box) {
        const rawInput = box.querySelector('input[data-cond="stat"]');
        const valueInput = box.querySelector('input[data-cond="value"]');
        if (!rawInput || !valueInput) return;
        if (Schema.normalizeConditionStat(rawInput.value) !== 'sp_current') return;
        const value = Number(valueInput.value);
        if (!Number.isFinite(value)) return;
        valueInput.value = String(Math.max(-45, Math.min(45, value)));
    }

    function updateValueMetadata(box, stat) {
        const valueInput = box.querySelector('input[data-cond="value"]');
        if (!valueInput) return;
        const canonical = Schema.normalizeConditionStat(stat);
        valueInput.removeAttribute('min');
        valueInput.removeAttribute('max');
        valueInput.placeholder = '';
        valueInput.title = '';

        if (canonical === 'hp_percent') {
            valueInput.min = '0';
            valueInput.max = '100';
            valueInput.step = '1';
            valueInput.placeholder = '0–100%';
            valueInput.title = 'Current HP as a percentage of Max HP.';
        } else if (canonical === 'hp_current' || canonical === 'hp_max') {
            valueInput.step = '1';
            valueInput.placeholder = 'HP';
        } else if (canonical === 'sp_current') {
            valueInput.min = '-45';
            valueInput.max = '45';
            valueInput.step = '1';
            valueInput.placeholder = '-45–45 SP';
            valueInput.title = 'Current SP. Luminous combat SP ranges from -45 to 45.';
            clampCurrentSpValue(box);
        }
    }

    function createStatPicker(rawInput) {
        const picker = document.createElement('select');
        picker.className = 'condition-stat-picker';
        picker.setAttribute('aria-label', 'Condition property');

        KNOWN_STATS.forEach(item => {
            const option = document.createElement('option');
            option.value = item.value;
            option.textContent = item.label;
            picker.appendChild(option);
        });

        const custom = document.createElement('option');
        custom.value = '__custom__';
        custom.textContent = 'Status / Runtime ID…';
        picker.appendChild(custom);

        rawInput.classList.add('condition-stat-raw');
        rawInput.placeholder = 'Status ID / runtime flag';
        rawInput.title = 'Custom Status or runtime condition ID.';
        rawInput.parentNode.insertBefore(picker, rawInput);
        return picker;
    }

    function syncPickerFromRaw(box, picker, rawInput) {
        const canonical = Schema.normalizeConditionStat(rawInput.value);
        if (KNOWN_VALUES.has(canonical)) {
            picker.value = canonical;
            rawInput.value = canonical;
            rawInput.style.display = 'none';
            updateValueMetadata(box, canonical);
        } else {
            picker.value = '__custom__';
            rawInput.style.display = '';
            updateValueMetadata(box, rawInput.value);
        }
    }

    function upgradeConditionBox(box) {
        if (!box || box.dataset.canonicalConditionUi === 'true') return;
        const rawInput = box.querySelector('input[data-cond="stat"]');
        const valueInput = box.querySelector('input[data-cond="value"]');
        if (!rawInput) return;

        box.dataset.canonicalConditionUi = 'true';
        const picker = createStatPicker(rawInput);
        syncPickerFromRaw(box, picker, rawInput);
        updateOperatorLabels(box);

        picker.addEventListener('change', () => {
            if (picker.value === '__custom__') {
                rawInput.style.display = '';
                rawInput.value = '';
                rawInput.focus();
                updateValueMetadata(box, '');
                return;
            }
            rawInput.value = picker.value;
            rawInput.style.display = 'none';
            updateValueMetadata(box, picker.value);
            rawInput.dispatchEvent(new Event('change', { bubbles: true }));
        });

        rawInput.addEventListener('change', () => {
            syncPickerFromRaw(box, picker, rawInput);
        });

        if (valueInput) {
            valueInput.addEventListener('input', () => clampCurrentSpValue(box));
            valueInput.addEventListener('change', () => clampCurrentSpValue(box));
        }
    }

    function upgradeAllConditions(root) {
        const scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll('.condition-box').forEach(upgradeConditionBox);
    }

    function prettifyPreviewRow(row) {
        if (!row) return;
        const textNodes = Array.from(row.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
        const textNode = textNodes[textNodes.length - 1];
        if (!textNode) return;

        const pattern = / · If (self|target|ally|allies|enemies) ([A-Za-z0-9_%.-]+) (<=|>=|<|>|=|equal to) (-?\d+(?:\.\d+)?)/g;
        const next = String(textNode.nodeValue || '').replace(pattern, (match, target, stat, operator, value) => {
            return ` · ${Schema.formatSkillCondition({ target, stat, operator, value: Number(value) })}`;
        });
        if (next !== textNode.nodeValue) textNode.nodeValue = next;
    }

    function prettifyPreview() {
        document.querySelectorAll('#previewEffects .preview-effect').forEach(prettifyPreviewRow);
    }

    function hardenScalingSelect() {
        const select = document.getElementById('f-scaling');
        if (!select) return;
        const current = canonicalScalingStat(select.value || select.selectedOptions?.[0]?.textContent || 'fuerza');
        Array.from(select.options).forEach(option => {
            option.value = canonicalScalingStat(option.textContent);
        });
        select.value = current;
        if (!select.value && select.options.length) select.selectedIndex = 0;
    }

    function syncImmutableSkillId() {
        const input = document.getElementById('f-id');
        const meta = document.getElementById('editMeta');
        if (!input || !meta) return;
        const text = String(meta.textContent || '');
        const locked = Boolean(input.value.trim()) && (/^Editando\b/i.test(text) || /^Guardado\b/i.test(text));
        input.readOnly = locked;
        input.title = locked
            ? 'Skill ID is immutable after the first save because Decks, Items and combat references may depend on it.'
            : 'ID can be chosen before the first save.';
    }

    function installCreatorHardening() {
        hardenScalingSelect();
        syncImmutableSkillId();
        const meta = document.getElementById('editMeta');
        const idInput = document.getElementById('f-id');
        if (meta) new MutationObserver(syncImmutableSkillId).observe(meta, { childList: true, subtree: true, characterData: true });
        if (idInput) new MutationObserver(syncImmutableSkillId).observe(idInput, { attributes: true, attributeFilter: ['value'] });
        document.getElementById('skillList')?.addEventListener('click', () => setTimeout(() => {
            hardenScalingSelect();
            syncImmutableSkillId();
        }, 0));
        document.getElementById('btnNew')?.addEventListener('click', () => setTimeout(() => {
            hardenScalingSelect();
            syncImmutableSkillId();
        }, 0));
        document.getElementById('btnDuplicate')?.addEventListener('click', () => setTimeout(() => {
            hardenScalingSelect();
            syncImmutableSkillId();
        }, 0));
    }

    function installObservers() {
        const editor = document.getElementById('editorScroll');
        if (editor) {
            const editorObserver = new MutationObserver(() => upgradeAllConditions(editor));
            editorObserver.observe(editor, { childList: true, subtree: true });
            upgradeAllConditions(editor);
        }

        const preview = document.getElementById('previewEffects');
        if (preview) {
            const previewObserver = new MutationObserver(() => prettifyPreview());
            previewObserver.observe(preview, { childList: true, subtree: true, characterData: true });
            prettifyPreview();
        }
    }

    function exposeConditionLegend() {
        const datalist = document.getElementById('conditionStats');
        if (!datalist) return;
        datalist.innerHTML = KNOWN_STATS
            .map(item => `<option value="${item.value}">${item.label}</option>`)
            .join('');
    }

    function runHudSmokeIndicator() {
        const result = Schema.runSmokeTest();
        const compat = document.querySelector('.compat');
        if (compat) {
            compat.textContent += result.passed ? ' · Conditions ✓' : ' · Conditions ✕';
            if (!result.passed) {
                compat.style.borderColor = '#7f332d';
                compat.style.color = '#e17868';
            }
        }
        const schemaMeta = document.getElementById('schemaMeta');
        if (schemaMeta && result.passed) schemaMeta.textContent = 'schemaVersion 2 · condition smoke ✓';
        if (result.passed) console.info('[CombatSkillSchema] Condition smoke test passed.', result.checks);
        else console.error('[CombatSkillSchema] Condition smoke test failed.', result.checks);
    }

    function init() {
        exposeConditionLegend();
        installCreatorHardening();
        installObservers();
        runHudSmokeIndicator();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else setTimeout(init, 0);
})(typeof window !== 'undefined' ? window : globalThis);
