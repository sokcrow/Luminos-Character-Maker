(function (global) {
    'use strict';

    const Schema = global.CombatSkillSchema;
    if (!Schema || typeof document === 'undefined') return;

    const KNOWN_STATS = Schema.CONDITION_STATS || [];
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

    function updateValueMetadata(box, stat) {
        const valueInput = box.querySelector('input[data-cond="value"]');
        if (!valueInput) return;
        const canonical = Schema.normalizeConditionStat(stat);
        valueInput.removeAttribute('min');
        valueInput.removeAttribute('max');
        valueInput.placeholder = '';
        valueInput.title = '';

        if (canonical === 'hp_percent' || canonical === 'sp_percent') {
            valueInput.min = '0';
            valueInput.max = '100';
            valueInput.step = '1';
            valueInput.placeholder = '0–100%';
            valueInput.title = 'Percentage of the current value compared with its maximum.';
        } else if (canonical === 'hp_current' || canonical === 'hp_max') {
            valueInput.step = '1';
            valueInput.placeholder = 'HP';
        } else if (canonical === 'sp_current' || canonical === 'sp_max') {
            valueInput.step = '1';
            valueInput.placeholder = 'SP';
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
        installObservers();
        runHudSmokeIndicator();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else setTimeout(init, 0);
})(typeof window !== 'undefined' ? window : globalThis);
