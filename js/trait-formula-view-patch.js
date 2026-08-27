(function (global) {
  "use strict";
  if (global.LuminousTraitFormulaViewPatch) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousTraitFormulaViewPatch;
    return;
  }

  const doc = global.document || null;
  const FORMULA_FUNCTIONS = new Set(["floor", "ceil", "round", "abs", "min", "max", "clamp"]);
  const VARIABLE_LABELS = Object.freeze({
    Level: "LEVEL", ClassLevel: "CLASS LEVEL", Proficiency: "PROFICIENCY",
    StrengthMod: "STR MOD", DexterityMod: "DEX MOD", ConstitutionMod: "CON MOD",
    IntelligenceMod: "INT MOD", WisdomMod: "WIS MOD", CharismaMod: "CHA MOD",
    OffensiveLevel: "OFFENSIVE LEVEL", DefensiveLevel: "DEFENSIVE LEVEL",
    MinSpeed: "MIN SPEED", MaxSpeed: "MAX SPEED", MaxHP: "MAX HP", CurrentHP: "CURRENT HP",
    MaxSP: "MAX SP", CurrentSP: "CURRENT SP",
  });
  const VARIABLE_ALIASES = Object.freeze({
    Level: ["Level"], ClassLevel: ["ClassLevel", "Class Level", "CLASS LEVEL"], Proficiency: ["Proficiency", "PROFICIENCY"],
    StrengthMod: ["StrengthMod", "Strength Mod", "STR MOD", "STR_MOD"],
    DexterityMod: ["DexterityMod", "Dexterity Mod", "DEX MOD", "DEX_MOD"],
    ConstitutionMod: ["ConstitutionMod", "Constitution Mod", "CON MOD", "CON_MOD"],
    IntelligenceMod: ["IntelligenceMod", "Intelligence Mod", "INT MOD", "INT_MOD"],
    WisdomMod: ["WisdomMod", "Wisdom Mod", "WIS MOD", "WIS_MOD"],
    CharismaMod: ["CharismaMod", "Charisma Mod", "CHA MOD", "CHA_MOD"],
    OffensiveLevel: ["OffensiveLevel", "Offensive Level", "OFFENSIVE LEVEL"],
    DefensiveLevel: ["DefensiveLevel", "Defensive Level", "DEFENSIVE LEVEL"],
    MinSpeed: ["MinSpeed", "Min Speed", "MIN SPEED"], MaxSpeed: ["MaxSpeed", "Max Speed", "MAX SPEED"],
    MaxHP: ["MaxHP", "Max HP", "MAX HP"], CurrentHP: ["CurrentHP", "Current HP", "CURRENT HP"],
    MaxSP: ["MaxSP", "Max SP", "MAX SP"], CurrentSP: ["CurrentSP", "Current SP", "CURRENT SP"],
  });
  let trayPatched = false;

  const escapeRegExp = (value) => String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function formatNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    const rounded = Number(number.toFixed(Number.isInteger(number) ? 0 : 2));
    return Object.is(rounded, -0) ? "0" : String(rounded);
  }
  function formulaIdentifiers(formula) {
    const matches = String(formula || "").match(/[A-Za-z_][A-Za-z0-9_.]*/g) || [];
    return [...new Set(matches.filter((identifier) => !FORMULA_FUNCTIONS.has(identifier.toLowerCase())))];
  }
  function variableEntry(variables = {}, identifier) {
    const key = Object.keys(variables).find((candidate) => candidate.toLowerCase() === String(identifier).toLowerCase());
    return key ? { key, value: variables[key] } : null;
  }
  function humanVariable(identifier) {
    const exact = Object.keys(VARIABLE_LABELS).find((key) => key.toLowerCase() === String(identifier).toLowerCase());
    return exact ? VARIABLE_LABELS[exact] : String(identifier).replace(/_/g, " ").toUpperCase();
  }
  function tokenizeFormula(formula) {
    const text = String(formula ?? "").trim();
    const tokens = [];
    let cursor = 0;
    const pattern = /[A-Za-z_][A-Za-z0-9_.]*|\d*\.?\d+|[()+\-*/%,]/g;
    let match;
    while ((match = pattern.exec(text))) {
      if (text.slice(cursor, match.index).trim()) return null;
      tokens.push(match[0]);
      cursor = match.index + match[0].length;
    }
    if (text.slice(cursor).trim()) return null;
    return tokens.length ? tokens : null;
  }
  function renderFormulaTokens(formula, variables) {
    const tokens = tokenizeFormula(formula);
    if (!tokens) return String(formula || "");
    return tokens.map((token) => {
      if (token === "*") return "×";
      if (/^[A-Za-z_]/.test(token) && !FORMULA_FUNCTIONS.has(token.toLowerCase())) {
        if (variables) {
          const entry = variableEntry(variables, token);
          if (entry) return formatNumber(entry.value);
        }
        return humanVariable(token);
      }
      return token;
    }).join(" ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/\s+,\s+/g, ", ");
  }
  const humanizeFormula = (formula) => renderFormulaTokens(formula, null);
  const substituteFormula = (formula, variables = {}) => renderFormulaTokens(formula, variables);
  const ensureParentheses = (text) => {
    const value = String(text || "").trim();
    return value.startsWith("(") && value.endsWith(")") ? value : `(${value})`;
  };

  function collectTraitFormulas(trait = {}) {
    const formulas = new Set();
    const visit = (value, key = "") => {
      if (value == null) return;
      if (typeof value === "string" || typeof value === "number") {
        if (/formula/i.test(key) && String(value).trim()) formulas.add(String(value).trim());
        return;
      }
      if (Array.isArray(value)) return value.forEach((entry) => visit(entry, key));
      if (typeof value === "object") Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
    };
    visit(trait);
    return [...formulas].sort((a, b) => b.length - a.length);
  }

  function resolveFormula(engine, trait = {}, formula, runtime = {}) {
    if (!engine?.buildVariables || !engine?.evaluateFormula || formula == null) return null;
    const character = runtime.character || runtime.self || {};
    const variables = engine.buildVariables(character, runtime, trait);
    const identifiers = formulaIdentifiers(formula);
    if (identifiers.some((identifier) => !variableEntry(variables, identifier))) return null;
    try {
      const value = engine.evaluateFormula(formula, variables);
      if (!Number.isFinite(Number(value))) return null;
      return {
        formula: String(formula), humanFormula: humanizeFormula(formula), substitutedFormula: substituteFormula(formula, variables),
        value: Number(value), display: formatNumber(value), variables,
        breakdown: identifiers.map((identifier) => {
          const entry = variableEntry(variables, identifier);
          return { identifier, label: humanVariable(identifier), value: Number(entry.value), display: formatNumber(entry.value) };
        }),
      };
    } catch (_) { return null; }
  }

  function aliasPattern(identifier) {
    const canonical = Object.keys(VARIABLE_ALIASES).find((key) => key.toLowerCase() === String(identifier).toLowerCase());
    const aliases = canonical ? VARIABLE_ALIASES[canonical] : [identifier];
    return `(?:${aliases.map((alias) => escapeRegExp(alias).replace(/\\ /g, "\\s+")).join("|")})`;
  }
  function formulaPattern(formula) {
    const tokens = tokenizeFormula(formula);
    if (!tokens) return null;
    const body = tokens.map((token) => {
      if (token === "*") return "(?:\\*|×|[xX])";
      if (/^[A-Za-z_]/.test(token)) return FORMULA_FUNCTIONS.has(token.toLowerCase()) ? escapeRegExp(token) : aliasPattern(token);
      return escapeRegExp(token);
    }).join("\\s*");
    return `(?:\\(\\s*${body}\\s*\\)|${body})`;
  }
  function formulaRegex(formula) {
    const pattern = formulaPattern(formula);
    if (!pattern) return null;
    try { return new RegExp(pattern, "gi"); } catch (_) { return null; }
  }

  function createFormulaControl(trait, resolved) {
    const control = doc.createElement("button");
    control.type = "button";
    control.className = "player-trait-live-formula-value";
    control.textContent = resolved.display;
    control.dataset.traitFormula = resolved.formula;
    control.setAttribute("aria-expanded", "false");
    control.setAttribute("aria-label", `${trait?.name || trait?.id || "Trait"}: resultado ${resolved.display}. Ver cálculo.`);
    const tooltip = doc.createElement("span");
    tooltip.className = "player-trait-live-formula-tooltip";
    tooltip.setAttribute("role", "tooltip");
    const title = doc.createElement("strong"); title.textContent = trait?.name || trait?.id || "TRAIT"; tooltip.appendChild(title);
    const original = doc.createElement("code"); original.textContent = ensureParentheses(resolved.humanFormula); tooltip.appendChild(original);
    const substituted = doc.createElement("code"); substituted.textContent = ensureParentheses(resolved.substitutedFormula); tooltip.appendChild(substituted);
    resolved.breakdown.forEach((row) => { const line = doc.createElement("span"); line.className = "player-trait-live-formula-row"; line.textContent = `${row.label}: ${row.display}`; tooltip.appendChild(line); });
    const total = doc.createElement("b"); total.className = "player-trait-live-formula-total"; total.textContent = `Resultado: ${resolved.display}`; tooltip.appendChild(total);
    control.appendChild(tooltip);
    const setOpen = (open) => { control.classList.toggle("is-open", Boolean(open)); control.setAttribute("aria-expanded", open ? "true" : "false"); };
    control.addEventListener("click", (event) => { event.stopPropagation(); setOpen(!control.classList.contains("is-open")); });
    control.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); control.blur(); } });
    control.addEventListener("blur", () => setOpen(false));
    return control;
  }

  function decorateTraitFormulaDescription(card, trait = {}, runtime = {}, engine = global.LuminousTraitEngine) {
    if (!doc || !card || !engine) return 0;
    const description = card.querySelector?.(".player-trait-card__description");
    if (!description) return 0;
    const formulas = collectTraitFormulas(trait).map((formula) => ({ resolved: resolveFormula(engine, trait, formula, runtime), regex: formulaRegex(formula) })).filter((entry) => entry.resolved && entry.regex);
    if (!formulas.length) return 0;
    const walker = doc.createTreeWalker(description, global.NodeFilter?.SHOW_TEXT || 4);
    const nodes = []; let node; while ((node = walker.nextNode())) nodes.push(node);
    let replaced = 0;
    nodes.forEach((textNode) => {
      if (!textNode.parentElement || textNode.parentElement.closest(".player-trait-resolved-value, .player-trait-live-formula-value, .player-trait-formula-tooltip, .player-trait-live-formula-tooltip")) return;
      let segments = [{ text: textNode.nodeValue || "", resolved: null }];
      formulas.forEach((entry) => {
        const next = [];
        segments.forEach((segment) => {
          if (segment.resolved || !segment.text) return next.push(segment);
          entry.regex.lastIndex = 0; let cursor = 0; let match; let matched = false;
          while ((match = entry.regex.exec(segment.text))) {
            matched = true;
            if (match.index > cursor) next.push({ text: segment.text.slice(cursor, match.index), resolved: null });
            next.push({ text: "", resolved: entry.resolved });
            cursor = match.index + match[0].length;
            if (!match[0].length) entry.regex.lastIndex += 1;
          }
          if (!matched) next.push(segment);
          else if (cursor < segment.text.length) next.push({ text: segment.text.slice(cursor), resolved: null });
        });
        segments = next;
      });
      if (!segments.some((segment) => segment.resolved)) return;
      const fragment = doc.createDocumentFragment();
      segments.forEach((segment) => { if (segment.resolved) { fragment.appendChild(createFormulaControl(trait, segment.resolved)); replaced += 1; } else if (segment.text) fragment.appendChild(doc.createTextNode(segment.text)); });
      textNode.replaceWith(fragment);
    });
    return replaced;
  }

  function ensureStyles() {
    if (!doc || doc.getElementById("trait-formula-view-patch-style")) return;
    const style = doc.createElement("style"); style.id = "trait-formula-view-patch-style";
    style.textContent = `.player-trait-live-formula-value{position:relative;display:inline-flex;align-items:center;justify-content:center;min-width:1.6em;margin:0 .12em;padding:.02em .25em;border:0;background:transparent;color:#fff27a;font:inherit;font-weight:900;line-height:1;text-shadow:0 0 5px rgba(255,242,122,.95),0 0 12px rgba(255,215,80,.68);cursor:help;vertical-align:baseline}.player-trait-live-formula-value:hover,.player-trait-live-formula-value:focus,.player-trait-live-formula-value.is-open{outline:none;color:#fffbd0;text-shadow:0 0 7px #fff,0 0 16px rgba(255,220,80,.95)}.player-trait-live-formula-tooltip{position:absolute;z-index:220000;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);display:none;min-width:240px;max-width:360px;padding:10px 12px;border:1px solid rgba(255,235,130,.8);background:rgba(8,10,13,.97);box-shadow:0 8px 30px rgba(0,0,0,.55),0 0 16px rgba(255,220,80,.22);color:#f4f1dd;text-align:left;white-space:normal;font:600 12px/1.35 monospace}.player-trait-live-formula-value:hover .player-trait-live-formula-tooltip,.player-trait-live-formula-value:focus .player-trait-live-formula-tooltip,.player-trait-live-formula-value.is-open .player-trait-live-formula-tooltip{display:grid;gap:5px}.player-trait-live-formula-tooltip strong{color:#fff27a;letter-spacing:.04em}.player-trait-live-formula-tooltip code{display:block;padding:3px 5px;background:rgba(255,255,255,.05);color:#fff}.player-trait-live-formula-row{display:block;color:#d8d5c6}.player-trait-live-formula-total{display:block;margin-top:2px;padding-top:5px;border-top:1px solid rgba(255,255,255,.14);color:#fff27a}`;
    doc.head?.appendChild(style);
  }
  function patchTraitTray() {
    const proto = global.LuminousTraitPlayerTray?.TraitPlayerTray?.prototype;
    if (!proto || trayPatched || proto.__formulaPreviewPatched) return Boolean(proto?.__formulaPreviewPatched);
    const original = proto.renderTraitCard;
    if (typeof original !== "function") return false;
    proto.renderTraitCard = function (trait, action) {
      const card = original.call(this, trait, action);
      decorateTraitFormulaDescription(card, trait, this.getRuntime?.() || {}, global.LuminousTraitEngine);
      return card;
    };
    Object.defineProperty(proto, "__formulaPreviewPatched", { value: true, configurable: true });
    trayPatched = true;
    global.LuminousPlayerTraitRuntime?.refresh?.();
    return true;
  }
  function tick() { ensureStyles(); patchTraitTray(); }
  function boot() { tick(); global.setInterval?.(tick, 500); }

  const api = Object.freeze({ VARIABLE_LABELS, formulaIdentifiers, tokenizeFormula, humanizeFormula, substituteFormula, collectTraitFormulas, resolveFormula, formulaPattern, decorateTraitFormulaDescription, patchTraitTray, tick });
  global.LuminousTraitFormulaViewPatch = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (doc) { if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true }); else boot(); }
})(typeof window !== "undefined" ? window : globalThis);
