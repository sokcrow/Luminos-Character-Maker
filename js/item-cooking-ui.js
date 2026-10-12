(function (global) {
  "use strict";
  if (global.LuminousCookingUi) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCookingUi;
    return;
  }

  const VERSION = 2;
  const doc = global.document;
  const CATEGORIES = Object.freeze([
    { id: "all", label: "TODAS", symbol: "✦" },
    { id: "meals", label: "COMIDAS", symbol: "♨" },
    { id: "soups", label: "SOPAS", symbol: "◉" },
    { id: "drinks", label: "BEBIDAS", symbol: "◈" },
    { id: "desserts", label: "POSTRES", symbol: "✧" }
  ]);
  const ABILITY_NAMES = { dex: "Destreza", int: "Inteligencia", wis: "Sabiduría" };
  const STAT_NAMES = { dex: "destreza", int: "inteligencia", wis: "sabiduria" };
  const state = {
    category: "all", recipeId: null, quantity: 1, working: false,
    message: "", messageType: "", lastDish: null, focusReturn: null
  };

  function recipes() { return global.LuminousCookingRecipeCatalog || null; }
  function runtime() { return global.LuminousCookingRuntime || null; }
  function resolver() { return global.LuminousCookingRecipeResolver || null; }
  function equipment() { return global.LuminousCookingEquipmentEngine || null; }
  function cookingV2() { return global.LuminousCookingV2Engine || null; }
  function hud() { return global.LuminousInventoryHudV2 || null; }
  function coins() { return global.LuminousCoinEngine || null; }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }
  function id(value) {
    return String(value == null ? "" : value).trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function label(value) {
    return String(value == null ? "" : value).replace(/_/g, " ")
      .replace(/\b[a-z]/g, function (char) { return char.toUpperCase(); });
  }
  // Inventory realtime is authoritative for item mutation; the character sheet is
  // authoritative for stats, proficiency, known recipes and station context.
  // HUD hydration does NOT copy those fields.
  function inventoryUnit() {
    const state = hud()?.state;
    return state?.peer?.bound === true && state?.unit && typeof state.unit === "object"
      ? state.unit : null;
  }
  function unit() {
    const inventory = inventoryUnit();
    const sheet = global.datosJugador;
    if (!inventory || !sheet || typeof sheet !== "object" || !Object.keys(sheet).length) return null;
    const boundId = String(hud()?.state?.playerId || "");
    if (boundId && sheet.playerId && String(sheet.playerId) !== boundId) return null;
    const combined = { ...sheet, ...inventory };
    // A HUD snapshot can have legacy/stale values: never mask current sheet rules.
    [
      "stats", "scores", "abilityProficiency", "proficiencies", "toolProficiencies",
      "tool_proficiencies", "cookingKnowledge", "knownRecipes",
      "knownCookingRecipes", "recipeKnowledge", "currentCookingStationId",
      "cookingStationId", "cookingProficiencyBonus", "cookProficiencyBonus",
      "proficiencyBonus", "proficiency", "level", "effectiveLevel",
    ].forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(sheet, key)) combined[key] = sheet[key];
    });
    // Always mutate the very containers bound to the inventory realtime peer.
    combined.inventario_activo = inventory.inventario_activo;
    combined.inventario_stash = inventory.inventario_stash;
    combined.equipment = inventory.equipment;
    return combined;
  }
  function includeStash() {
    return hud()?.state?.stashUnlocked === true;
  }
  function currentStation(u) {
    return u?.currentCookingStationId || u?.cookingStationId || "";
  }
  function categoryFor(recipe) {
    const course = id(recipe.course), family = id(recipe.dishFamily);
    const identity = id(recipe.id || recipe.name);
    if (course === "dessert" || /dessert|pastry|cake|cookie|pie|tart|pudding/.test(family)) return "desserts";
    if (course === "soup" || /soup|stew|porridge|broth/.test(family + " " + identity)) return "soups";
    if (/drink|beverage|tea|coffee|juice|cocktail/.test(course + " " + family) ||
      /^(tea|coffee|juice|cocktail|lemonade|soda)_/.test(identity)) return "drinks";
    return "meals";
  }
  function iconFor(recipe) {
    const family = id(recipe.iconFamily || recipe.id || "food");
    return "Assets/Icons/items/consumable/" + family + ".png";
  }
  function fallbackFor(recipe) {
    const family = categoryFor(recipe);
    const names = { meals: "food_meal", soups: "food_soup", drinks: "drink", desserts: "food_dessert" };
    return "Assets/Icons/items/consumable/" + (names[family] || "food") + ".png";
  }
  function ingredientIcon(item, requirement) {
    const key = id(item?.iconFamily || item?.itemId || item?.definitionId || requirement || "craft_component");
    return "Assets/Icons/items/material/" + key + ".png";
  }
  function image(src, fallback, className) {
    return '<img class="' + esc(className) + '" src="' + esc(src) +
      '" data-fallback="' + esc(fallback) + '" alt="" loading="lazy">';
  }
  function allRecipes() {
    return recipes()?.list?.() || [];
  }
  function knows(u, recipe) {
    if (!u) return false;
    return !cookingV2()?.hasExplicitKnowledgeStore?.(u) || cookingV2().knowsRecipe(u, recipe);
  }
  function viewFor(u) {
    const inventory = runtime()?.inventoryView?.(u, { includeStash: includeStash() });
    return inventory?.rows || [];
  }
  function selection(u) {
    const all = allRecipes();
    const filtered = all.filter(function (recipe) {
      return state.category === "all" || categoryFor(recipe) === state.category;
    });
    if (!filtered.some(function (recipe) { return recipe.id === state.recipeId; })) {
      state.recipeId = filtered[0]?.id || null;
      state.quantity = 1;
    }
    return { all: all, filtered: filtered, recipe: filtered.find(function (recipe) {
      return recipe.id === state.recipeId;
    }) || null, rows: u ? viewFor(u) : [] };
  }
  function resolve(recipe, rows) {
    return resolver()?.resolveRecipe?.(recipe, rows) || null;
  }
  function recipePreview(u, recipe) {
    return runtime()?.previewCook?.(u, recipe.id, {
      includeStash: includeStash(), equipment: { stationId: currentStation(u) }
    }) || { valid: false, reason: "cooking_unavailable" };
  }
  function maxQuantity(recipe, rows) {
    if (!resolver() || !recipe) return 0;
    const available = rows.map(function (row) {
      return { ...row, quantity: Number(row.quantity ?? row.qty ?? row.cantidad ?? 1) || 0 };
    });
    let count = 0;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = resolve(recipe, available);
      if (!result?.valid) break;
      for (const consume of result.consumptionPlan || []) {
        available[consume.inventoryIndex].quantity -= consume.units;
      }
      count += 1;
    }
    return count;
  }
  function message(copy, type) {
    state.message = copy || "";
    state.messageType = type || "";
    const host = doc?.getElementById("cooking-v2-status");
    if (host) {
      host.textContent = state.message;
      host.dataset.kind = state.messageType;
    }
  }

  function ensureUi() {
    if (!doc) return null;
    let launch = doc.getElementById("inventory-v2-cook-button");
    if (!launch) {
      const tabs = doc.querySelector("#inventory-modal .inventory-tabs");
      if (tabs) {
        launch = doc.createElement("button");
        launch.type = "button";
        launch.id = "inventory-v2-cook-button";
        launch.className = "inv-tab-btn";
        launch.textContent = "COCINA";
        launch.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          open();
        });
        tabs.appendChild(launch);
      }
    }

    let modal = doc.getElementById("cooking-v1-modal");
    if (modal) return modal;
    modal = doc.createElement("div");
    modal.id = "cooking-v1-modal";
    modal.className = "cooking-book-overlay";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Recetario de cocina");
    modal.innerHTML =
      '<div class="cooking-book">' +
        '<header class="cooking-book-header">' +
          '<div class="cooking-book-brand"><span class="cooking-book-brand-mark" aria-hidden="true">✥</span>' +
            '<div><span class="cooking-book-eyebrow">EL RECETARIO</span>' +
            '<h2>COCINA</h2></div></div>' +
          '<button type="button" class="cooking-book-close" data-cook-close aria-label="Cerrar recetario">×</button>' +
        '</header>' +
        '<div class="cooking-book-content">' +
          '<section class="cooking-book-index" aria-label="Elegir receta">' +
            '<nav class="cooking-book-categories" id="cooking-v2-categories" aria-label="Categorías"></nav>' +
            '<div class="cooking-book-list" id="cooking-v2-list"></div>' +
          '</section>' +
          '<section class="cooking-book-detail" id="cooking-v2-detail" aria-label="Detalles de la receta"></section>' +
        '</div>' +
      '</div>';
    doc.body.appendChild(modal);
    modal.addEventListener("click", function (event) {
      if (event.target === modal || event.target.closest("[data-cook-close]")) {
        close();
        return;
      }
      const categoryButton = event.target.closest("[data-cook-category]");
      if (categoryButton && !state.working) {
        state.category = categoryButton.dataset.cookCategory;
        state.recipeId = null;
        state.quantity = 1;
        render();
        return;
      }
      const recipeButton = event.target.closest("[data-cook-recipe]");
      if (recipeButton && !state.working) {
        state.recipeId = recipeButton.dataset.cookRecipe;
        state.quantity = 1;
        render();
        return;
      }
      const quantityButton = event.target.closest("[data-cook-quantity]");
      if (quantityButton && !state.working) {
        state.quantity = Math.max(1, state.quantity + Number(quantityButton.dataset.cookQuantity || 0));
        renderDetail();
        return;
      }
      if (event.target.closest("[data-cook-confirm]")) execute();
    });
    modal.addEventListener("error", function (event) {
      const img = event.target;
      if (img?.tagName !== "IMG" || !img.dataset.fallback) return;
      if (!img.src.endsWith(img.dataset.fallback)) {
        img.src = img.dataset.fallback;
      }
      img.removeAttribute("data-fallback");
    }, true);
    modal.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        close();
      }
      if (event.key === "Tab") {
        const focusable = Array.from(modal.querySelectorAll("button:not([disabled])"));
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && doc.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && doc.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    return modal;
  }

  function renderCategories(all) {
    const host = doc.getElementById("cooking-v2-categories");
    if (!host) return;
    host.innerHTML = CATEGORIES.map(function (entry) {
      const count = entry.id === "all" ? all.length : all.filter(function (recipe) {
        return categoryFor(recipe) === entry.id;
      }).length;
      return '<button type="button" class="cooking-book-category' +
        (state.category === entry.id ? ' is-active' : '') +
        '" data-cook-category="' + entry.id +
        '" aria-pressed="' + (state.category === entry.id) + '">' +
          '<span aria-hidden="true" class="cooking-book-category-icon">' + entry.symbol + '</span>' +
          '<span>' + entry.label + '</span><small>' + count + '</small>' +
        '</button>';
    }).join("");
  }

  function renderList(selectionData, u) {
    const host = doc.getElementById("cooking-v2-list");
    if (!host) return;
    const rows = selectionData.rows;
    host.innerHTML = selectionData.filtered.length ? selectionData.filtered.map(function (recipe) {
      const known = knows(u, recipe);
      const resolved = resolve(recipe, rows);
      const goodQuality = !resolved?.valid ||
        cookingV2()?.checkGourmetComponents?.(recipe, resolved.recipeInputs || [])?.valid !== false;
      const ready = known && resolved?.valid && goodQuality;
      const selected = recipe.id === state.recipeId;
      const fallback = fallbackFor(recipe);
      return '<button type="button" class="cooking-book-recipe' +
        (selected ? ' is-active' : '') + (!known ? ' is-locked' : '') +
        '" data-cook-recipe="' + esc(recipe.id) + '" aria-pressed="' + selected + '">' +
          image(known ? iconFor(recipe) : fallback, fallback, "cooking-book-recipe-icon") +
          '<span class="cooking-book-recipe-name">' + (known ? esc(recipe.name) : 'Receta desconocida') +
          '<small>' + (known ? esc(label(recipe.method)) : 'Sin aprender') + '</small></span>' +
          '<span class="cooking-book-recipe-ready ' + (ready ? 'is-ready' : '') + '">' +
            (ready ? 'LISTA' : (known ? 'FALTAN' : '✦')) + '</span>' +
        '</button>';
    }).join("") : '<p class="cooking-book-empty">No hay recetas en esta categoría.</p>';
  }

  function renderIngredients(recipe, resolution) {
    return (recipe.ingredients || []).map(function (ingredient, index) {
      const assignment = resolution?.assignments?.[index];
      const have = (assignment?.allocations || []).reduce(function (sum, row) {
        return sum + Number(row.units || 0);
      }, 0);
      const required = Math.max(1, Number(ingredient.quantity) || 1);
      const good = have >= required || ingredient.optional === true;
      const first = assignment?.allocations?.[0]?.item || null;
      const name = first?.displayName || first?.name || label(ingredient.requirement);
      return '<div class="cooking-book-ingredient' + (good ? '' : ' is-missing') + '">' +
        image(ingredientIcon(first, ingredient.requirement), "Assets/Icons/items/material/craft_component.png", "cooking-book-ingredient-icon") +
        '<span class="cooking-book-ingredient-name">' + esc(name) +
          (ingredient.optional ? '<small>Opcional</small>' : '') + '</span>' +
        '<span class="cooking-book-ingredient-count">' + have + ' / ' + required + '</span>' +
      '</div>';
    }).join("");
  }

  function renderEffects(u, recipe, preview) {
    const v2 = cookingV2()?.get?.(recipe);
    if (!v2 || v2.adoption !== "adapt") {
      return '<p class="cooking-book-note">Los efectos se calculan al preparar el plato, según su calidad.</p>';
    }
    const potential = cookingV2()?.resolvePreparedFunction?.(recipe, 3, u, {
      equipment: preview.equipment || {}
    });
    const effects = [];
    if (Number(potential?.maxHpBonus) > 0) effects.push('HP máximo +' + potential.maxHpBonus);
    if (Number(potential?.spRecovery) > 0) effects.push('Recupera ' + potential.spRecovery + ' SP');
    for (const effect of potential?.effects || []) {
      effects.push('+' + effect.power + ' ' + label(effect.target));
    }
    if (!effects.length) effects.push('Sustento y restauración al consumir');
    return '<p class="cooking-book-note">Efectos estimados a ★★★. La calidad final depende de tu tirada.</p>' +
      '<div class="cooking-book-effects">' + effects.map(function (effect) {
        return '<span class="cooking-book-effect"><span aria-hidden="true">✦</span>' + esc(effect) + '</span>';
      }).join("") + '</div>';
  }

  function renderDetail() {
    const host = doc?.getElementById("cooking-v2-detail");
    const u = unit();
    if (!host) return;
    if (!u || !runtime() || !recipes() || !resolver()) {
      host.innerHTML = '<p class="cooking-book-empty">Esperando el inventario del personaje…</p>';
      return;
    }
    const data = selection(u);
    const recipe = data.recipe;
    if (!recipe) {
      host.innerHTML = '<p class="cooking-book-empty">Selecciona una receta para ver cómo prepararla.</p>';
      return;
    }
    const known = knows(u, recipe);
    const resolved = resolve(recipe, data.rows);
    const preview = known ? recipePreview(u, recipe) : { valid: false, reason: "unknown_recipe_knowledge" };
    const count = preview.valid ? maxQuantity(recipe, data.rows) : 0;
    state.quantity = Math.max(1, Math.min(state.quantity, count || 1));
    const stationId = currentStation(u);
    const stationName = equipment()?.STATIONS?.[id(stationId)]?.label || (stationId ? label(stationId) : "Sin estación");
    const eq = preview.equipment;
    const warnings = [
      ...(eq?.missingToolIds || []).map(function (x) { return 'Herramienta no disponible: ' + label(x); }),
      ...(eq?.missingStationIds || []).map(function (x) { return 'Estación recomendada: ' + label(x); })
    ];
    const reason = !known ? "Todavía no has aprendido esta receta."
      : !resolved?.valid ? "Necesitas reunir los ingredientes señalados."
      : preview.reason === "gourmet_component_quality" ? "La calidad de algunos ingredientes es insuficiente."
      : preview.valid ? "" : "Esta receta no puede prepararse todavía.";
    host.innerHTML =
      '<div class="cooking-book-scroll">' +
        '<div class="cooking-book-title-ribbon"><h3>' + esc(known ? recipe.name : "Receta desconocida") + '</h3></div>' +
        '<div class="cooking-book-hero">' +
          '<div class="cooking-book-hero-copy">' +
            '<span class="cooking-book-course">' + esc(label(recipe.course)) + '</span>' +
            '<p class="cooking-book-description">' + (known
              ? 'Prepara ' + esc(recipe.name) + ' mediante ' + esc(label(recipe.method).toLowerCase()) + '.'
              : 'Aprende esta receta para descubrir su preparación.') + '</p>' +
            '<div class="cooking-book-meta">' +
              '<span>' + esc(ABILITY_NAMES[recipe.ability] || label(recipe.ability)) + '</span>' +
              (preview.valid ? '<span>Dificultad ' + esc(preview.effectiveTh) + '</span>' : '') +
              '<span>' + esc(stationName) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="cooking-book-hero-art">' +
            image(known ? iconFor(recipe) : fallbackFor(recipe), fallbackFor(recipe), "cooking-book-dish-art") +
          '</div>' +
        '</div>' +
        '<div class="cooking-book-section-heading"><span>EFECTOS</span></div>' +
        (known ? renderEffects(u, recipe, preview) :
          '<p class="cooking-book-note">Aprende la receta para descubrir sus efectos.</p>') +
        '<div class="cooking-book-section-heading"><span>INGREDIENTES</span></div>' +
        '<div class="cooking-book-ingredients">' +
          (known ? renderIngredients(recipe, resolved) : '<p class="cooking-book-note">Ingredientes desconocidos.</p>') +
        '</div>' +
        (known && warnings.length
          ? '<p class="cooking-book-equipment-note">' + warnings.map(esc).join(' · ') +
            '. Cocinar sin equipo apropiado aumenta la dificultad.</p>' : '') +
        (reason ? '<p class="cooking-book-warning">' + esc(reason) + '</p>' : '') +
        '<div id="cooking-v2-roll-results" class="cooking-book-roll-results" aria-live="polite">' +
          (state.lastDish ? 'Última preparación: ' + esc(state.lastDish) : '') +
        '</div>' +
        '<div id="cooking-v2-coins" class="cooking-book-coins" aria-label="Tirada de cocina"></div>' +
      '</div>' +
      '<footer class="cooking-book-actions">' +
        '<div class="cooking-book-quantity">' +
          '<span>CANTIDAD</span>' +
          '<div class="cooking-book-counter">' +
            '<button type="button" data-cook-quantity="-1" aria-label="Reducir cantidad" ' +
              (state.working || state.quantity <= 1 ? 'disabled' : '') + '>‹</button>' +
            '<strong>' + state.quantity + '</strong>' +
            '<button type="button" data-cook-quantity="1" aria-label="Aumentar cantidad" ' +
              (state.working || state.quantity >= count ? 'disabled' : '') + '>›</button>' +
          '</div>' +
        '</div>' +
        '<div class="cooking-book-submit">' +
          '<button type="button" data-cook-confirm ' +
            (!preview.valid || !known || !count || state.working || !coins()?.runAnimatedRoll ? 'disabled' : '') +
            '>' + (state.working ? 'COCINANDO…' : 'COCINAR') + '</button>' +
          '<div id="cooking-v2-status" class="cooking-book-status" role="status" aria-live="polite" data-kind="' +
            esc(state.messageType) + '">' + esc(state.message) + '</div>' +
        '</div>' +
      '</footer>';
  }

  function render() {
    const modal = ensureUi();
    if (!modal) return;
    const u = unit();
    const data = selection(u);
    renderCategories(data.all);
    renderList(data, u);
    renderDetail();
  }

  function abilityBase(u, ability) {
    const name = STAT_NAMES[id(ability)] || id(ability);
    const abilityId = id(ability);
    const derived = global.LuminousDerivedStats?.resolveAbility?.(u, abilityId)?.score;
    const score = Number(derived ?? u?.stats?.[name] ?? u?.stats?.[abilityId] ?? u?.scores?.[abilityId] ?? 10);
    const value = Number.isFinite(score) ? score : 10;
    const proficiency = global.LuminousProficiencyRuntime;
    const modifier = proficiency?.abilityModifier?.(value) ?? Math.floor((value - 10) / 2);
    const stateValue = u?.abilityProficiency?.[abilityId] ?? u?.abilityProficiency?.[name] ?? "none";
    const normalized = String(stateValue || "none").toLowerCase();
    const multiplier = { none: 0, half: .5, proficient: 1, expertise: 2 }[normalized] ?? 0;
    const level = Number(u?.level) || 1;
    const bonus = Math.min(6, 2 + Math.floor((Math.max(1, level) - 1) / 20));
    const extra = proficiency?.contribution?.(level, normalized) ??
      Math.floor(bonus * multiplier);
    return modifier + extra;
  }
  function headsChance(u) {
    const raw = Number(u?.sp ?? u?.sp_actual ?? u?.combatStats?.sp_actual ?? 0);
    return Math.max(5, Math.min(95, 50 + (Number.isFinite(raw) ? raw : 0)));
  }

  async function execute() {
    if (state.working) return;
    const u = unit(), recipe = recipes()?.get?.(state.recipeId);
    if (!u || !recipe || !knows(u, recipe)) {
      message("Espera a que se cargue tu ficha y el inventario.", "error");
      return;
    }
    const preview = recipePreview(u, recipe);
    if (!preview.valid || !coins()?.runAnimatedRoll) {
      message("No se puede iniciar esta preparación.", "error");
      return;
    }
    const requested = Math.min(state.quantity, maxQuantity(recipe, viewFor(u)));
    if (requested < 1) {
      message("No tienes ingredientes suficientes.", "error");
      render();
      return;
    }

    state.working = true;
    state.lastDish = null;
    renderDetail();
    const modal = ensureUi();
    const coinHost = modal.querySelector("#cooking-v2-coins");
    const resultHost = modal.querySelector("#cooking-v2-roll-results");
    coinHost?.scrollIntoView?.({ block: "nearest" });
    const made = [];
    try {
      for (let index = 0; index < requested; index += 1) {
        if (!recipePreview(u, recipe).valid) break;
        message("Preparando " + (index + 1) + " de " + requested + "…", "pending");
        const rolling = await coins().runAnimatedRoll({
          container: coinHost, coinCount: 5, base: abilityBase(u, recipe.ability),
          headsChance: headsChance(u), intervalMs: 350, auto: true
        });
        const outcome = runtime().executeCook(u, recipe.id, rolling.total, {
          includeStash: includeStash(), equipment: { stationId: currentStation(u) }
        });
        if (!outcome.cooked) {
          message(outcome.reason === "output_inventory_full"
            ? "No hay espacio en el inventario activo."
            : "La preparación no pudo completarse.", "error");
          break;
        }
        made.push(outcome.item);
        resultHost.textContent = "Tirada " + rolling.total + " · " +
          outcome.item.stars + "★ · " + outcome.item.displayName;
      }

      if (made.length) {
        try {
          const peer = hud()?.state?.peer;
          if (!peer?.bound || !peer.save) throw new Error("SAVE_NOT_AVAILABLE");
          const saved = await peer.save(inventoryUnit());
          if (saved?.saved !== true) throw new Error(saved?.reason || "SAVE_FAILED");
          hud()?.renderAll?.();
          state.lastDish = made[made.length - 1].displayName + " · " +
            made[made.length - 1].stars + "★";
          message("¡" + made.length + (made.length === 1 ? " plato preparado" : " platos preparados") +
            " y guardados en el inventario!", "success");
        } catch (_) {
          message("Se preparó el plato, pero no se pudo guardar. Reintenta al recuperar la conexión.", "error");
        }
      } else if (state.messageType !== "error") {
        message("No se pudo cocinar. Comprueba ingredientes y espacio libre.", "error");
      }
    } catch (_) {
      message("La tirada no se completó. No se han consumido ingredientes para esa tirada.", "error");
    } finally {
      state.working = false;
      render();
    }
  }

  function close() {
    const modal = ensureUi();
    if (!modal || state.working) return false;
    modal.hidden = true;
    state.focusReturn?.focus?.();
    return true;
  }
  function open() {
    const modal = ensureUi();
    if (!modal) return false;
    state.focusReturn = doc.activeElement;
    state.message = "";
    state.messageType = "";
    modal.hidden = false;
    render();
    modal.querySelector("[data-cook-close]")?.focus();
    return true;
  }
  function craftable() {
    const u = unit();
    if (!u || !runtime() || !resolver()) return [];
    const rows = viewFor(u);
    return (resolver().craftableRecipes(rows) || []).filter(function (result) {
      return knows(u, result.recipe);
    });
  }
  function boot() { return Boolean(ensureUi()); }
  function refreshIfOpen() {
    const modal = doc?.getElementById("cooking-v1-modal");
    if (modal && !modal.hidden && !state.working) render();
  }
  if (doc) {
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
    else boot();
    for (const eventName of [
      "luminous:player-data", "luminous:inventory-realtime", "luminous:stash-access-changed"
    ]) global.addEventListener?.(eventName, refreshIfOpen);
  }
  const API = Object.freeze({
    VERSION: VERSION, boot: boot, open: open, close: close,
    craftable: craftable, renderPreview: renderDetail,
    categoryFor: categoryFor, maxQuantity: maxQuantity, abilityBase: abilityBase, headsChance: headsChance
  });
  global.LuminousCookingUi = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
