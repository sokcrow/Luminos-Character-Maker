(function (global) {
    'use strict';

    const CONDITION_STAT_ALIASES = Object.freeze({
        HP: 'hp_current', hp: 'hp_current', current_hp: 'hp_current', hp_current: 'hp_current',
        'HP Actual': 'hp_current', 'Current HP': 'hp_current',
        hp_percent: 'hp_percent', hp_pct: 'hp_percent', current_hp_percent: 'hp_percent',
        'HP %': 'hp_percent', 'HP Actual %': 'hp_percent', 'Current HP %': 'hp_percent',
        max_hp: 'hp_max', hp_max: 'hp_max', 'HP Máximo': 'hp_max', 'Max HP': 'hp_max',
        SP: 'sp_current', sp: 'sp_current', current_sp: 'sp_current', sp_current: 'sp_current',
        'SP Actual': 'sp_current', 'Current SP': 'sp_current',
        sp_percent: 'sp_percent', sp_pct: 'sp_percent', current_sp_percent: 'sp_percent',
        'SP %': 'sp_percent', 'SP Actual %': 'sp_percent', 'Current SP %': 'sp_percent',
        max_sp: 'sp_max', sp_max: 'sp_max', 'SP Máximo': 'sp_max', 'Max SP': 'sp_max'
    });

    const CONDITION_STATS = Object.freeze([
        { value: 'hp_current', label: 'Current HP', unit: 'HP' },
        { value: 'hp_percent', label: 'HP %', unit: '%' },
        { value: 'hp_max', label: 'Max HP', unit: 'HP' },
        { value: 'sp_current', label: 'Current SP', unit: 'SP' },
        { value: 'sp_percent', label: 'SP %', unit: '%' },
        { value: 'sp_max', label: 'Max SP', unit: 'SP' },
        { value: 'took_damage_this_turn', label: 'Took Damage This Turn', unit: '' },
        { value: 'took_damage_last_turn', label: 'Took Damage Last Turn', unit: '' },
        { value: 'took_no_damage_this_turn', label: 'Took No Damage This Turn', unit: '' },
        { value: 'took_no_damage_last_turn', label: 'Took No Damage Last Turn', unit: '' },
        { value: 'took_slash_damage', label: 'Took Slash Damage', unit: '' },
        { value: 'took_pierce_damage', label: 'Took Pierce Damage', unit: '' },
        { value: 'took_blunt_damage', label: 'Took Blunt Damage', unit: '' }
    ]);

    const CONDITION_OPERATOR_ALIASES = Object.freeze({
        '<': '<', 'less than': '<', below: '<',
        '<=': '<=', 'less than or equal': '<=', 'or less': '<=',
        '=': '=', '==': '=', 'equal to': '=', equals: '=',
        '>=': '>=', 'more than or equal': '>=', 'or more': '>=',
        '>': '>', 'more than': '>', above: '>'
    });

    const DEFAULT_EFFECT = Object.freeze({
        trigger: '[On Use]',
        target: 'target',
        type: 'status',
        status: '',
        potency: 0,
        count: 0,
        maxCap: 0,
        scaleTarget: null,
        scaleCondition: null,
        is_reuse: false,
        target_ally: false,
        timing: 'immediate',
        condition: null
    });

    const DEFAULTS = Object.freeze({
        id: '',
        name: '',
        type: 'Attack',
        tier: 1,
        basePower: 4,
        coinPower: 4,
        coinAmount: 1,
        coinType: 'positive',
        attackWeight: 1,
        skillRange: 1,
        damageType: 'contundente',
        sinAffinity: 'sinless',
        scalingStat: 'Fuerza',
        statUsed: '',
        skillUsed: '',
        targetingType: 'Focused Attack',
        aoePattern: 'Self',
        skillAmount: 1,
        sourceType: 'skill',
        sourceId: '',
        isItemSkill: false,
        isDefense: false,
        defenseSubtype: '',
        isClashable: true,
        isUnclashable: false,
        isIndiscriminate: false,
        isTargetFixed: false,
        requiresUnlock: false,
        effects: [],
        coins: [],
        evolutionChain: null,
        schemaVersion: 2
    });

    const NUMBER_FIELDS = new Set([
        'tier', 'basePower', 'coinPower', 'coinAmount',
        'attackWeight', 'skillRange', 'skillAmount'
    ]);

    const BOOLEAN_FIELDS = new Set([
        'isItemSkill', 'isDefense', 'isClashable', 'isUnclashable',
        'isIndiscriminate', 'isTargetFixed', 'requiresUnlock'
    ]);

    function firstDefined(source, keys, fallback) {
        for (const key of keys) {
            if (source[key] !== undefined && source[key] !== null && source[key] !== '') return source[key];
        }
        return fallback;
    }

    function asNumber(value, fallback, min) {
        const parsed = Number(value);
        const valid = Number.isFinite(parsed) ? parsed : fallback;
        return typeof min === 'number' ? Math.max(min, valid) : valid;
    }

    function asBoolean(value, fallback) {
        if (value === undefined || value === null) return fallback;
        if (typeof value === 'string') {
            if (value.toLowerCase() === 'true') return true;
            if (value.toLowerCase() === 'false') return false;
        }
        return Boolean(value);
    }

    function normalizeConditionStat(value) {
        const raw = String(value ?? '').trim();
        return CONDITION_STAT_ALIASES[raw] || raw || 'hp_current';
    }

    function normalizeConditionOperator(value) {
        const raw = String(value ?? '').trim().toLowerCase();
        return CONDITION_OPERATOR_ALIASES[raw] || String(value ?? '=') || '=';
    }

    function normalizeCondition(rawCondition) {
        if (!rawCondition || typeof rawCondition !== 'object') return null;
        return {
            ...rawCondition,
            target: firstDefined(rawCondition, ['target'], 'target'),
            stat: normalizeConditionStat(firstDefined(rawCondition, ['stat'], 'hp_current')),
            operator: normalizeConditionOperator(firstDefined(rawCondition, ['operator'], '=')),
            value: asNumber(firstDefined(rawCondition, ['value'], 0), 0)
        };
    }

    function normalizeEffect(rawEffect, fallbackTrigger) {
        const raw = rawEffect && typeof rawEffect === 'object' ? rawEffect : {};
        return {
            ...raw,
            trigger: firstDefined(raw, ['trigger'], fallbackTrigger || DEFAULT_EFFECT.trigger),
            target: firstDefined(raw, ['target'], DEFAULT_EFFECT.target),
            type: firstDefined(raw, ['type'], DEFAULT_EFFECT.type),
            status: firstDefined(raw, ['status'], DEFAULT_EFFECT.status),
            potency: asNumber(firstDefined(raw, ['potency'], DEFAULT_EFFECT.potency), DEFAULT_EFFECT.potency),
            count: asNumber(firstDefined(raw, ['count'], DEFAULT_EFFECT.count), DEFAULT_EFFECT.count),
            maxCap: asNumber(firstDefined(raw, ['maxCap', 'max_cap'], DEFAULT_EFFECT.maxCap), DEFAULT_EFFECT.maxCap),
            scaleTarget: firstDefined(raw, ['scaleTarget', 'scale_target'], DEFAULT_EFFECT.scaleTarget),
            scaleCondition: firstDefined(raw, ['scaleCondition', 'scale_condition'], DEFAULT_EFFECT.scaleCondition),
            is_reuse: asBoolean(firstDefined(raw, ['is_reuse', 'isReuse'], DEFAULT_EFFECT.is_reuse), DEFAULT_EFFECT.is_reuse),
            target_ally: asBoolean(firstDefined(raw, ['target_ally', 'targetAlly'], DEFAULT_EFFECT.target_ally), DEFAULT_EFFECT.target_ally),
            timing: firstDefined(raw, ['timing'], DEFAULT_EFFECT.timing),
            condition: normalizeCondition(raw.condition)
        };
    }

    function normalizeCoin(rawCoin, index) {
        const coin = rawCoin && typeof rawCoin === 'object' ? rawCoin : {};
        return {
            ...coin,
            index,
            type: firstDefined(coin, ['type', 'coinType'], 'normal'),
            status: firstDefined(coin, ['status'], 'active'),
            effects: Array.isArray(coin.effects)
                ? coin.effects.map(effect => normalizeEffect(effect, '[On Hit]'))
                : []
        };
    }

    function normalizeCombatSkill(rawSkill) {
        const raw = rawSkill && typeof rawSkill === 'object' ? rawSkill : {};
        const skill = {
            ...raw,
            id: firstDefined(raw, ['id', 'skillId'], DEFAULTS.id),
            name: firstDefined(raw, ['name', 'nombre'], DEFAULTS.name),
            type: firstDefined(raw, ['type', 'skillType'], DEFAULTS.type),
            tier: firstDefined(raw, ['tier'], DEFAULTS.tier),
            basePower: firstDefined(raw, ['basePower', 'base_power'], DEFAULTS.basePower),
            coinPower: firstDefined(raw, ['coinPower', 'coin_power'], DEFAULTS.coinPower),
            coinAmount: firstDefined(raw, ['coinAmount', 'coin_count', 'coinCount'], DEFAULTS.coinAmount),
            coinType: firstDefined(raw, ['coinType', 'coin_type'], DEFAULTS.coinType),
            attackWeight: firstDefined(raw, ['attackWeight', 'atkWeight', 'weight'], DEFAULTS.attackWeight),
            skillRange: firstDefined(raw, ['skillRange', 'range'], DEFAULTS.skillRange),
            damageType: firstDefined(raw, ['damageType', 'dmgType', 'attackType', 'tipo_dano'], DEFAULTS.damageType),
            sinAffinity: firstDefined(raw, ['sinAffinity', 'affinity', 'sin', 'pecado'], DEFAULTS.sinAffinity),
            scalingStat: firstDefined(raw, ['scalingStat', 'scaling_stat'], DEFAULTS.scalingStat),
            statUsed: firstDefined(raw, ['statUsed', 'stat_used'], DEFAULTS.statUsed),
            skillUsed: firstDefined(raw, ['skillUsed', 'skill_used'], DEFAULTS.skillUsed),
            targetingType: firstDefined(raw, ['targetingType', 'targeting_type'], DEFAULTS.targetingType),
            aoePattern: firstDefined(raw, ['aoePattern', 'aoe_pattern'], DEFAULTS.aoePattern),
            skillAmount: firstDefined(raw, ['skillAmount', 'skill_amount'], DEFAULTS.skillAmount),
            sourceType: firstDefined(raw, ['sourceType', 'source_type'], DEFAULTS.sourceType),
            sourceId: firstDefined(raw, ['sourceId', 'source_id'], DEFAULTS.sourceId),
            isItemSkill: firstDefined(raw, ['isItemSkill', 'is_item_skill'], DEFAULTS.isItemSkill),
            isDefense: firstDefined(raw, ['isDefense', 'is_defense'], DEFAULTS.isDefense),
            defenseSubtype: firstDefined(raw, ['defenseSubtype', 'defense_subtype'], DEFAULTS.defenseSubtype),
            isClashable: firstDefined(raw, ['isClashable', 'is_clashable'], DEFAULTS.isClashable),
            isUnclashable: firstDefined(raw, ['isUnclashable', 'is_unclashable'], DEFAULTS.isUnclashable),
            isIndiscriminate: firstDefined(raw, ['isIndiscriminate', 'is_indiscriminate'], DEFAULTS.isIndiscriminate),
            isTargetFixed: firstDefined(raw, ['isTargetFixed', 'is_target_fixed'], DEFAULTS.isTargetFixed),
            requiresUnlock: firstDefined(raw, ['requiresUnlock', 'requires_unlock'], DEFAULTS.requiresUnlock),
            effects: Array.isArray(raw.effects) ? raw.effects.map(effect => normalizeEffect(effect, '[On Use]')) : [],
            evolutionChain: firstDefined(raw, ['evolutionChain', 'evolution_chain'], DEFAULTS.evolutionChain),
            schemaVersion: 2
        };

        NUMBER_FIELDS.forEach(field => {
            const minimum = ['tier', 'coinAmount', 'attackWeight', 'skillRange', 'skillAmount'].includes(field) ? 1 : undefined;
            skill[field] = asNumber(skill[field], DEFAULTS[field], minimum);
        });
        BOOLEAN_FIELDS.forEach(field => { skill[field] = asBoolean(skill[field], DEFAULTS[field]); });

        if (skill.isUnclashable) skill.isClashable = false;
        if (skill.isDefense && !skill.defenseSubtype) skill.defenseSubtype = 'Guard';

        const rawCoins = Array.isArray(raw.coins) ? raw.coins : [];
        skill.coins = Array.from({ length: skill.coinAmount }, (_, index) => normalizeCoin(rawCoins[index], index));
        return skill;
    }

    function serializeCombatSkill(inputSkill, options) {
        const opts = { includeLegacyAliases: true, ...(options || {}) };
        const skill = normalizeCombatSkill(inputSkill);
        const output = { ...skill };

        if (opts.includeLegacyAliases) {
            output.weight = skill.attackWeight;
            output.atkWeight = skill.attackWeight;
            output.range = skill.skillRange;
            output.targeting_type = skill.targetingType;
            output.aoe_pattern = skill.aoePattern;
            output.scaling_stat = skill.scalingStat;
            output.tipo_dano = skill.damageType;
            output.dmgType = skill.damageType;
            output.attackType = skill.damageType;
            output.pecado = skill.sinAffinity;
            output.affinity = skill.sinAffinity;
            output.skill_amount = skill.skillAmount;
            output.source_type = skill.sourceType;
            output.source_id = skill.sourceId;
            output.is_item_skill = skill.isItemSkill;
            output.is_defense = skill.isDefense;
            output.defense_subtype = skill.defenseSubtype;
            output.is_unclashable = skill.isUnclashable;
            output.is_indiscriminate = skill.isIndiscriminate;
            output.is_target_fixed = skill.isTargetFixed;
            output.requires_unlock = skill.requiresUnlock;
            output.evolution_chain = skill.evolutionChain;
        }
        return output;
    }

    function resolveConditionUnit(condition, context) {
        const ctx = context && typeof context === 'object' ? context : {};
        const targetKey = condition?.target || 'target';
        if (targetKey === 'self') return ctx.self || ctx.attacker || ctx.unit || null;
        if (targetKey === 'target') return ctx.target || ctx.currentTarget || ctx.defender || null;
        if (targetKey === 'ally') return ctx.ally || null;
        return ctx[targetKey] || null;
    }

    function readConditionStat(unit, statInput) {
        if (!unit) return 0;
        const stat = normalizeConditionStat(statInput);
        const currentHp = asNumber(firstDefined(unit, ['hp', 'currentHp', 'currentHP'], 0), 0);
        const maxHp = asNumber(firstDefined(unit, ['maxHp', 'maxHP'], 0), 0);
        const currentSp = asNumber(firstDefined(unit, ['sp', 'currentSp', 'currentSP'], 0), 0);
        const maxSp = asNumber(firstDefined(unit, ['maxSp', 'maxSP'], 0), 0);

        if (stat === 'hp_current') return currentHp;
        if (stat === 'hp_max') return maxHp;
        if (stat === 'hp_percent') return maxHp > 0 ? (currentHp / maxHp) * 100 : 0;
        if (stat === 'sp_current') return currentSp;
        if (stat === 'sp_max') return maxSp;
        if (stat === 'sp_percent') return maxSp > 0 ? (currentSp / maxSp) * 100 : 0;
        if (stat === 'took_damage_this_turn') return unit.took_damage_this_turn ? 1 : 0;
        if (stat === 'took_damage_last_turn') return unit.took_damage_last_turn ? 1 : 0;
        if (stat === 'took_no_damage_this_turn') return unit.took_damage_this_turn ? 0 : 1;
        if (stat === 'took_no_damage_last_turn') return unit.took_damage_last_turn ? 0 : 1;
        if (stat === 'took_slash_damage') return unit.took_slash_damage ? 1 : 0;
        if (stat === 'took_pierce_damage') return unit.took_pierce_damage ? 1 : 0;
        if (stat === 'took_blunt_damage') return unit.took_blunt_damage ? 1 : 0;

        const statusCollection = unit.statusEffects || unit.statuses || {};
        if (Array.isArray(statusCollection)) {
            const found = statusCollection.find(entry => String(entry?.id || entry?.status || '') === stat);
            if (!found) return 0;
            if (typeof found === 'number') return found;
            return asNumber(firstDefined(found, ['potency', 'count', 'value'], 0), 0);
        }
        const status = statusCollection && typeof statusCollection === 'object' ? statusCollection[stat] : null;
        if (typeof status === 'number') return status;
        return status && typeof status === 'object'
            ? asNumber(firstDefined(status, ['potency', 'count', 'value'], 0), 0)
            : 0;
    }

    function compareConditionValues(actual, operatorInput, expected) {
        const operator = normalizeConditionOperator(operatorInput);
        if (operator === '<') return actual < expected;
        if (operator === '<=') return actual <= expected;
        if (operator === '=') return actual === expected;
        if (operator === '>=') return actual >= expected;
        if (operator === '>') return actual > expected;
        return false;
    }

    function evaluateCondition(conditionInput, context) {
        const condition = normalizeCondition(conditionInput);
        if (!condition) return true;
        const unit = resolveConditionUnit(condition, context);
        if (!unit) return false;
        const actual = readConditionStat(unit, condition.stat);
        return compareConditionValues(actual, condition.operator, condition.value);
    }

    function targetLabel(target) {
        const labels = {
            self: 'self', target: 'target', ally: 'ally', allies: 'allies', enemies: 'enemies'
        };
        return labels[target] || String(target || 'target');
    }

    function thresholdPhrase(operator, value, metric, subject, percent) {
        const numeric = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
        const shown = percent ? `${numeric}% ${metric}` : `${numeric} ${metric}`;
        const self = subject === 'self';

        if (percent) {
            if (operator === '<=') return self ? `At ${shown} or less` : `If ${subject} is at ${shown} or less`;
            if (operator === '>=') return self ? `At ${shown} or more` : `If ${subject} is at ${shown} or more`;
            if (operator === '<') return self ? `Below ${shown}` : `If ${subject} is below ${shown}`;
            if (operator === '>') return self ? `Above ${shown}` : `If ${subject} is above ${shown}`;
            return self ? `At ${shown}` : `If ${subject} is at ${shown}`;
        }

        if (operator === '<=') return self ? `At ${shown} or less` : `If ${subject} has ${shown} or less`;
        if (operator === '>=') return self ? `At ${shown} or more` : `If ${subject} has ${shown} or more`;
        if (operator === '<') return self ? `Below ${shown}` : `If ${subject} has less than ${shown}`;
        if (operator === '>') return self ? `Above ${shown}` : `If ${subject} has more than ${shown}`;
        return self ? `At ${shown}` : `If ${subject} has ${shown}`;
    }

    function formatSkillCondition(conditionInput) {
        const condition = normalizeCondition(conditionInput);
        if (!condition) return '';
        const subject = targetLabel(condition.target);
        const stat = condition.stat;
        const operator = condition.operator;
        const value = condition.value;

        if (stat === 'hp_percent') return thresholdPhrase(operator, value, 'HP', subject, true);
        if (stat === 'sp_percent') return thresholdPhrase(operator, value, 'SP', subject, true);
        if (stat === 'hp_current') return thresholdPhrase(operator, value, 'HP', subject, false);
        if (stat === 'sp_current') return thresholdPhrase(operator, value, 'SP', subject, false);

        const number = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
        if (stat === 'hp_max' || stat === 'sp_max') {
            const metric = stat === 'hp_max' ? 'Max HP' : 'Max SP';
            if (operator === '<=') return `If ${subject}'s ${metric} is ${number} or less`;
            if (operator === '>=') return `If ${subject}'s ${metric} is ${number} or more`;
            if (operator === '<') return `If ${subject}'s ${metric} is below ${number}`;
            if (operator === '>') return `If ${subject}'s ${metric} is above ${number}`;
            return `If ${subject}'s ${metric} is ${number}`;
        }

        const friendly = CONDITION_STATS.find(item => item.value === stat)?.label || stat.replaceAll('_', ' ');
        if (operator === '<=') return `If ${subject} ${friendly} is ${number} or less`;
        if (operator === '>=') return `If ${subject} ${friendly} is ${number} or more`;
        if (operator === '<') return `If ${subject} ${friendly} is below ${number}`;
        if (operator === '>') return `If ${subject} ${friendly} is above ${number}`;
        return `If ${subject} ${friendly} is ${number}`;
    }

    function validateCombatSkill(inputSkill) {
        const skill = normalizeCombatSkill(inputSkill);
        const errors = [];
        const warnings = [];
        if (!String(skill.name || '').trim()) errors.push('El nombre de la Skill es obligatorio.');
        if (skill.coinAmount < 1) errors.push('Coin Amount debe ser al menos 1.');
        if (skill.attackWeight < 1) errors.push('Attack Weight debe ser al menos 1.');
        if (skill.skillRange < 1) errors.push('Range debe ser al menos 1.');
        if (skill.skillAmount < 1) errors.push('Skill Amount debe ser al menos 1.');
        if (skill.isDefense && !skill.defenseSubtype) errors.push('Una Defense Skill necesita defenseSubtype.');
        if (skill.targetingType !== 'AoE' && skill.aoePattern && skill.aoePattern !== 'Self') warnings.push('aoePattern se conserva, pero sólo se usa cuando targetingType es AoE.');

        const validateEffect = (effect, label) => {
            if (!effect.trigger) errors.push(`${label} necesita trigger.`);
            if (effect.type === 'status' && !String(effect.status || '').trim()) warnings.push(`${label} es Status pero no tiene status id.`);
            if (effect.condition) {
                if (['hp_percent', 'sp_percent'].includes(effect.condition.stat) && (effect.condition.value < 0 || effect.condition.value > 100)) {
                    errors.push(`${label}: el porcentaje debe estar entre 0 y 100.`);
                }
                if (!['<', '<=', '=', '>=', '>'].includes(effect.condition.operator)) {
                    errors.push(`${label}: operador de condición inválido.`);
                }
            }
        };

        skill.effects.forEach((effect, index) => validateEffect(effect, `Global Effect ${index + 1}`));
        skill.coins.forEach((coin, coinIndex) => {
            coin.effects.forEach((effect, effectIndex) => validateEffect(effect, `Coin ${coinIndex + 1}, Effect ${effectIndex + 1}`));
        });
        return { valid: errors.length === 0, errors, warnings, skill };
    }

    function runSmokeTest() {
        const source = {
            id: 'smoke_condition_skill',
            name: 'Condition Smoke Test',
            effects: [{
                trigger: '[On Hit]',
                target: 'target',
                type: 'percentage_damage',
                potency: 20,
                condition: { target: 'target', stat: 'HP %', operator: '<=', value: 50 }
            }]
        };
        const normalized = normalizeCombatSkill(source);
        const serialized = serializeCombatSkill(normalized, { includeLegacyAliases: true });
        const roundTrip = normalizeCombatSkill(JSON.parse(JSON.stringify(serialized)));
        const condition = roundTrip.effects[0].condition;
        const checks = {
            canonicalStat: condition.stat === 'hp_percent',
            canonicalOperator: condition.operator === '<=',
            valuePreserved: condition.value === 50,
            formatted: formatSkillCondition(condition) === 'If target is at 50% HP or less',
            passesAt40Percent: evaluateCondition(condition, { target: { hp: 40, maxHp: 100 } }) === true,
            failsAt60Percent: evaluateCondition(condition, { target: { hp: 60, maxHp: 100 } }) === false
        };
        return { passed: Object.values(checks).every(Boolean), checks, normalized: roundTrip };
    }

    global.CombatSkillSchema = Object.freeze({
        VERSION: 2,
        DEFAULTS,
        DEFAULT_EFFECT,
        CONDITION_STATS,
        normalizeConditionStat,
        normalizeConditionOperator,
        normalizeCondition,
        normalizeEffect,
        normalizeCombatSkill,
        serializeCombatSkill,
        readConditionStat,
        compareConditionValues,
        evaluateCondition,
        formatSkillCondition,
        validateCombatSkill,
        runSmokeTest
    });

    if (typeof document !== 'undefined' && /dm-skill-creator\.html$/i.test(global.location?.pathname || '')) {
        const currentSrc = document.currentScript?.src || '';
        const uiSrc = currentSrc
            ? currentSrc.replace(/combat-skill-schema\.js(?:\?.*)?$/i, 'combat-skill-condition-ui.js')
            : 'js/combat-skill-condition-ui.js';
        if (!document.querySelector('script[data-combat-skill-condition-ui]')) {
            const script = document.createElement('script');
            script.src = uiSrc;
            script.dataset.combatSkillConditionUi = 'true';
            script.defer = true;
            document.head.appendChild(script);
        }
    }
})(typeof window !== 'undefined' ? window : globalThis);
