(function (global) {
    'use strict';

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
            if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
                return source[key];
            }
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

    function normalizeCondition(rawCondition) {
        if (!rawCondition || typeof rawCondition !== 'object') return null;
        return {
            ...rawCondition,
            target: firstDefined(rawCondition, ['target'], 'target'),
            stat: firstDefined(rawCondition, ['stat'], 'HP'),
            operator: firstDefined(rawCondition, ['operator'], 'equal to'),
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
            effects: Array.isArray(raw.effects)
                ? raw.effects.map(effect => normalizeEffect(effect, '[On Use]'))
                : [],
            evolutionChain: firstDefined(raw, ['evolutionChain', 'evolution_chain'], DEFAULTS.evolutionChain),
            schemaVersion: 2
        };

        NUMBER_FIELDS.forEach((field) => {
            const minimum = ['tier', 'coinAmount', 'attackWeight', 'skillRange', 'skillAmount'].includes(field) ? 1 : undefined;
            skill[field] = asNumber(skill[field], DEFAULTS[field], minimum);
        });

        BOOLEAN_FIELDS.forEach((field) => {
            skill[field] = asBoolean(skill[field], DEFAULTS[field]);
        });

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
        if (skill.targetingType !== 'AoE' && skill.aoePattern && skill.aoePattern !== 'Self') {
            warnings.push('aoePattern se conserva, pero sólo se usa cuando targetingType es AoE.');
        }

        skill.effects.forEach((effect, index) => {
            if (!effect.trigger) errors.push(`Global Effect ${index + 1} necesita trigger.`);
            if (effect.type === 'status' && !String(effect.status || '').trim()) {
                warnings.push(`Global Effect ${index + 1} es Status pero no tiene status id.`);
            }
        });

        skill.coins.forEach((coin, coinIndex) => {
            coin.effects.forEach((effect, effectIndex) => {
                if (!effect.trigger) errors.push(`Coin ${coinIndex + 1}, Effect ${effectIndex + 1} necesita trigger.`);
                if (effect.type === 'status' && !String(effect.status || '').trim()) {
                    warnings.push(`Coin ${coinIndex + 1}, Effect ${effectIndex + 1} es Status pero no tiene status id.`);
                }
            });
        });

        return { valid: errors.length === 0, errors, warnings, skill };
    }

    global.CombatSkillSchema = Object.freeze({
        VERSION: 2,
        DEFAULTS,
        DEFAULT_EFFECT,
        normalizeCondition,
        normalizeEffect,
        normalizeCombatSkill,
        serializeCombatSkill,
        validateCombatSkill
    });
})(window);
