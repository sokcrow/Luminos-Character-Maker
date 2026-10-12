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
    message: "", messageType: "", lastDish: null, focusReturn: null, stationId: null
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
  function inventorySession() {
    const inventory = inventoryUnit();
    const peer = hud()?.state?.peer;
    if (!inventory || !peer?.bound) return null;
    const revision = Number(peer.revision);
    const snapshot = {
      active: inventory.inventario_activo,
      stash: inventory.inventario_stash,
      equipment: inventory.equipment
    };
    return {
      inventory, peer,
      playerId: hud()?.state?.playerId,
      revision: Number.isFinite(revision) ? revision : null,
      active: snapshot.active, stash: snapshot.stash, equipment: snapshot.equipment,
      stashUnlocked: includeStash(),
      signature: JSON.stringify(snapshot)
    };
  }
  function inventorySessionCurrent(session) {
    if (!session) return false;
    const inventory = inventoryUnit();
    const peer = hud()?.state?.peer;
    if (inventory !== session.inventory || peer !== session.peer || !peer?.bound ||
        hud()?.state?.playerId !== session.playerId ||
        inventory?.inventario_activo !== session.active ||
        inventory?.inventario_stash !== session.stash ||
        inventory?.equipment !== session.equipment ||
        includeStash() !== session.stashUnlocked) return false;
    if (session.revision !== null && Number(peer.revision) !== session.revision) return false;
    // Realtime snapshots replace containers. The signature also notices local
    // in-place inventory edits while a five-coin animation is playing.
    return JSON.stringify({ active:inventory.inventario_activo,
      stash:inventory.inventario_stash, equipment:inventory.equipment }) === session.signature;
  }
  function stagedCookingUnit(u, session) {
    return {
      ...u,
      inventario_activo: JSON.parse(JSON.stringify(session.active || {})),
      inventario_stash: JSON.parse(JSON.stringify(session.stash || {})),
      equipment: JSON.parse(JSON.stringify(session.equipment || {}))
    };
  }
  function currentStation(u) {
    const selected = state.stationId == null
      ? (u?.currentCookingStationId || u?.cookingStationId || "")
      : state.stationId;
    return equipment()?.canonicalStationId?.(selected) || id(selected);
  }
  function stationSelector(u, disabled) {
    const selected = currentStation(u);
    const stations = Object.values(equipment()?.STATIONS || {});
    const known = stations.some(function (station) { return station.id === selected; });
    const choices = [{ id: "", label: "Sin estación" }, ...stations];
    if (selected && !known) choices.push({ id: selected, label: label(selected) });
    return '<label class="cooking-book-station">' +
      '<span>ESTACIÓN UTILIZADA</span>' +
      '<select id="cooking-v2-station" data-cook-station aria-label="Estación utilizada para cocinar" ' +
      (disabled ? 'disabled ' : '') + '>' +
      choices.map(function (station) {
        return '<option value="' + esc(station.id) + '"' +
          (station.id === selected ? ' selected' : '') +
          '>' + esc(station.label) + '</option>';
      }).join("") +
      '</select></label>';
  }
  // Only equipment in an accessible container may modify the cooking TH.
  // The equipment engine otherwise scans stashInventory/stash unconditionally.
  function cookingOptions(u) {
    const stashAllowed = includeStash();
    const accessible = stashAllowed ? u : {
      ...u, inventario_stash: null, stashInventory: null, stash: null
    };
    return {
      includeStash: stashAllowed,
      equipment: {
        stationId: currentStation(u),
        availableToolIds: equipment()?.carriedToolIds?.(accessible) || []
      }
    };
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
  const DEMO_ART_DIR = "Assets/Icons/items/cooking_hud/";
  const COOKING_ICONS = '<svg class="cooking-book-sprite" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>' +
    '<symbol id="cook-art-utensils" viewBox="0 0 24 24"><path d="M4 2v7a3 3 0 0 0 6 0V2M7 2v20M16 2c-2 3-3 6-3 9a3 3 0 0 0 4 3v8M17 2v20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></symbol>' +
    '<symbol id="cook-art-all" viewBox="0 0 24 24"><path d="M3 14h18a8 8 0 0 1-9 7 8 8 0 0 1-9-7ZM4 14c0-4 3-6 8-6s8 2 8 6M8 2c-2 2 2 3 0 5M13 2c-2 2 2 3 0 5M18 2c-2 2 2 3 0 5" stroke="currentColor" fill="none" stroke-width="1.5"/></symbol>' +
    '<symbol id="cook-art-meals" viewBox="0 0 24 24"><path d="M2 15q2-8 10-8t10 8q0 5-10 5T2 15Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M7 13h.1M11 10h.1M16 14h.1" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></symbol>' +
    '<symbol id="cook-art-soups" viewBox="0 0 24 24"><path d="M2 9h20v8a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V9ZM3 9l4-3h10l4 3M12 2v4" fill="none" stroke="currentColor" stroke-width="1.7"/></symbol>' +
    '<symbol id="cook-art-drinks" viewBox="0 0 24 24"><path d="M3 7h14v11a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7ZM17 9h4v5a4 4 0 0 1-4 4M6 2l2 3M12 2l-1 3" fill="none" stroke="currentColor" stroke-width="1.7"/></symbol>' +
    '<symbol id="cook-art-desserts" viewBox="0 0 24 24"><path d="M3 12h18l-3 8H6l-3-8ZM2 12q1-6 5-4 1-4 5-2 4-2 5 2M12 2v3" fill="none" stroke="currentColor" stroke-width="1.7"/></symbol>' +
    '<symbol id="cook-art-heart" viewBox="0 0 24 24"><path d="M12 21 3.5 13a5.6 5.6 0 0 1 8.5-7 5.6 5.6 0 0 1 8.5 7L12 21Z" fill="currentColor"/></symbol>' +
    '<symbol id="cook-art-blade" viewBox="0 0 24 24"><path d="M20 2 9 14l-4-1 1 4-3 4 4-3 4 1-1-4L22 4l-2-2Z" fill="currentColor"/></symbol>' +
    '<symbol id="cook-art-shield" viewBox="0 0 24 24"><path d="m12 2 9 4v5c0 6-4 10-9 11C7 21 3 17 3 11V6l9-4Z" fill="currentColor"/></symbol>' +
    '<symbol id="cook-art-flame" viewBox="0 0 24 24"><path d="M12 2q5 6 3 10 3-1 3-5 6 8 1 13-6 5-12 0Q1 14 12 2ZM12 13q-5 5-1 8 5 2 4-2 0-3-3-6Z" fill="currentColor"/></symbol>' +
    '</defs></svg>';
  function svgIcon(symbol, className) {
    return '<svg class="' + esc(className || "") + '" aria-hidden="true"><use href="#cook-art-' + esc(symbol) + '"/></svg>';
  }
  function artworkKey(recipe) {
    const name = id(recipe?.name || recipe?.id);
    const family = id(recipe?.dishFamily);
    if (/fish|seafood|crustacean/.test(name)) return "fish";
    if (/soup|stew|porridge|broth|mushroom/.test(name + " " + family)) return "mushroom";
    if (/tart|cake|pie|cookie|pastry|pudding|dessert|sweet/.test(name + " " + family)) return "tart";
    if (/tea|coffee|lemonade|juice|beverage|drink/.test(name)) return "tea";
    if (/skewer|kebab|spice/.test(name)) return "skewer";
    if (/ration|jerky/.test(name)) return "ration";
    if (/bread|loaf|toast|pita|bun|sandwich|burger/.test(name + " " + family)) return "bread";
    if (/egg|omelet|omelette/.test(name)) return "egg";
    if (/salad|fruit|vegetable/.test(name)) return "salad";
    if (/grill|steak|roast|meat|beef|pork|chicken/.test(name)) return "grilled";
    return ({ soups:"mushroom", desserts:"tart", drinks:"tea", meals:"grilled" })[categoryFor(recipe)] || "grilled";
  }
  function iconFor(recipe) { return DEMO_ART_DIR + artworkKey(recipe) + ".webp"; }
  function fallbackFor(recipe) { return DEMO_ART_DIR + ({ soups:"mushroom", desserts:"tart", drinks:"tea", meals:"grilled" })[categoryFor(recipe)] + ".webp"; }
  function ingredientIcon(item, requirement) {
    const key = id(item?.itemId || item?.definitionId || requirement);
    if (/salt/.test(key)) return DEMO_ART_DIR + "salt.webp";
    if (/herb|aromatic/.test(key)) return DEMO_ART_DIR + "herbs.webp";
    if (/meat|protein|poultry/.test(key)) return DEMO_ART_DIR + "raw_meat.webp";
    return "";
  }
  function ingredientEmoji(requirement) {
    const key = id(requirement);
    if (/fish|seafood/.test(key)) return "🐟";
    if (/egg/.test(key)) return "🥚";
    if (/vegetable|plant|leaf/.test(key)) return "🥬";
    if (/mushroom|fungus/.test(key)) return "🍄";
    if (/fruit|berry/.test(key)) return "🍎";
    if (/water|broth|stock/.test(key)) return "💧";
    if (/flour|grain|dough|corn/.test(key)) return "🌾";
    if (/bread|baked/.test(key)) return "🍞";
    if (/milk|cream|dairy/.test(key)) return "🥛";
    if (/cheese/.test(key)) return "🧀";
    if (/sweetener|honey/.test(key)) return "🍯";
    if (/spice|season|sauce/.test(key)) return "🌶";
    return "✦";
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
    return runtime()?.previewCook?.(u, recipe.id, cookingOptions(u)) ||
      { valid: false, reason: "cooking_unavailable" };
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
      COOKING_ICONS +
      '<div class="cooking-book">' +
        '<header class="cooking-book-header">' +
          '<span class="cooking-book-brand-mark">' + svgIcon("utensils") + '</span>' +
          '<div class="cooking-book-brand-ribbon"><h2>COOKING</h2></div>' +
          '<button type="button" class="cooking-book-close" data-cook-close aria-label="Cerrar recetario">×</button>' +
        '</header>' +
        '<div class="cooking-book-content">' +
          '<section class="cooking-book-index cooking-book-panel" aria-label="Elegir receta">' +
            '<nav class="cooking-book-categories" id="cooking-v2-categories" aria-label="Categorías"></nav>' +
            '<div class="cooking-book-list" id="cooking-v2-list"></div>' +
            '<footer class="cooking-book-list-footnote" id="cooking-v2-count"></footer>' +
          '</section>' +
          '<section class="cooking-book-detail cooking-book-panel" id="cooking-v2-detail" aria-label="Detalles de la receta"></section>' +
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
    modal.addEventListener("change", function (event) {
      if (!event.target?.matches?.("[data-cook-station]") || state.working) return;
      const selected = id(event.target.value);
      const canonical = equipment()?.canonicalStationId?.(selected) || selected;
      if (canonical && !Object.prototype.hasOwnProperty.call(equipment()?.STATIONS || {}, canonical)) return;
      state.stationId = canonical;
      state.quantity = 1;
      message("", "");
      renderDetail();
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
          svgIcon(entry.id, "cooking-book-category-icon") +
          '<span>' + entry.label + '</span>' +
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
          '<span class="cooking-book-recipe-name">' + (known ? esc(recipe.name) : 'Receta desconocida') + '</span>' +
          '<span class="cooking-book-recipe-cross">' + svgIcon("utensils") + '</span>' +
          '<span class="cooking-book-recipe-status">' +
            '<span class="cooking-book-stars" aria-label="La calidad se determina al cocinar">☆☆☆</span>' +
            '<small class="cooking-book-recipe-ready ' + (ready ? 'is-ready' : '') + '">' +
              (ready ? 'LISTA' : (known ? 'FALTAN' : 'BLOQ.')) + '</small>' +
          '</span>' +
        '</button>';
    }).join("") : '<p class="cooking-book-empty">No hay recetas en esta categoría.</p>';
    const count = doc.getElementById("cooking-v2-count");
    if (count) count.textContent = selectionData.filtered.filter(function (recipe) { return knows(u, recipe); }).length + " RECETAS DESCUBIERTAS";
  }

  // Reserve ingredients through the same greedy resolver as executeCook, one
  // portion at a time. Summing independent candidates is incorrect when one
  // stack can satisfy multiple recipe requirements (e.g. onion as vegetable
  // and aromatic). Keep this reservation preview read-only.
  function ingredientAvailability(recipe, rows, quantity) {
    const requirements = recipe?.ingredients || [];
    const requested = Math.max(1, Math.min(5, Math.trunc(Number(quantity) || 1)));
    const available = (Array.isArray(rows) ? rows : []).map(function (row) {
      const amount = Number(row.quantity ?? row.qty ?? row.cantidad ?? 0);
      return { ...row, quantity: Number.isFinite(amount) ? Math.max(0, amount) : 0 };
    });
    const assigned = requirements.map(function () { return 0; });
    const firstItems = requirements.map(function () { return null; });
    for (let portion = 0; portion < requested; portion += 1) {
      const result = resolve(recipe, available);
      if (!result?.assignments) break;
      for (let index = 0; index < requirements.length; index += 1) {
        for (const allocation of result.assignments[index]?.allocations || []) {
          const units = Math.max(0, Number(allocation.units) || 0);
          assigned[index] += units;
          if (!firstItems[index]) firstItems[index] = allocation.item;
          if (available[allocation.inventoryIndex]) {
            available[allocation.inventoryIndex].quantity = Math.max(
              0, available[allocation.inventoryIndex].quantity - units
            );
          }
        }
      }
      // Even when a portion is incomplete, reserve the available matches
      // for later requested portions so unrelated stock is not underreported.
    }
    return requirements.map(function (ingredient, index) {
      const required = Math.max(1, Math.trunc(Number(ingredient.quantity) || 1)) * requested;
      return Object.freeze({
        requirement: ingredient.requirement,
        allocated: assigned[index],
        required: required,
        missing: ingredient.optional !== true && assigned[index] < required,
        firstItem: firstItems[index]
      });
    });
  }

  function renderIngredients(recipe, resolution, rows) {
    const allocations = ingredientAvailability(recipe, rows, state.quantity);
    return (recipe.ingredients || []).map(function (ingredient, index) {
      const availability = allocations[index];
      const have = availability.allocated;
      const required = availability.required;
      const good = !availability.missing;
      const first = availability.firstItem ||
        resolution?.assignments?.[index]?.allocations?.[0]?.item ||
        resolver()?.candidatesForRequirement?.(ingredient.requirement, rows || [])?.[0]?.item ||
        null;
      const name = first?.displayName || first?.name || label(ingredient.requirement);
      const art = ingredientIcon(first, ingredient.requirement);
      return '<div class="cooking-book-ingredient' + (good ? '' : ' is-missing') + '">' +
        '<div class="cooking-book-ingredient-icon">' +
          (art ? image(art, art, "cooking-book-ingredient-art") :
          '<span class="cooking-book-ingredient-emoji" aria-hidden="true">' + ingredientEmoji(ingredient.requirement) + '</span>') +
        '</div>' +
        '<span class="cooking-book-ingredient-name">' + esc(name) +
          (ingredient.optional ? '<small>Opcional</small>' : '') +
          '<span class="cooking-book-ingredient-count">' + have + ' / ' + required + '</span>' +
        '</span>' +
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
        const symbol = /hp|salud|vida/i.test(effect) ? "heart" : /sp|energía|energia/i.test(effect) ? "flame" :
          /attack|ataque|daño|damage|power/i.test(effect) ? "blade" : "shield";
        return '<span class="cooking-book-effect">' + svgIcon(symbol) + '<span>' + esc(effect) + '</span></span>';
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
        '<div class="cooking-book-title-ribbon">' + svgIcon("utensils") +
          '<h3>' + esc(known ? recipe.name : "Receta desconocida") + '</h3></div>' +
        '<div class="cooking-book-hero">' +
          '<div class="cooking-book-hero-copy">' +
            '<span class="cooking-book-course">' + esc(label(recipe.course)) + '</span>' +
            '<p class="cooking-book-description">' + (known
              ? 'Prepara ' + esc(recipe.name) + ' mediante ' + esc(label(recipe.method).toLowerCase()) + '.'
              : 'Aprende esta receta para descubrir su preparación.') + '</p>' +
            '<div class="cooking-book-meta">' +
              '<span>' + esc(ABILITY_NAMES[recipe.ability] || label(recipe.ability)) + '</span>' +
              (preview.valid ? '<span>Dificultad ' + esc(preview.effectiveTh) + '</span>' : '') +
            '</div>' +
            stationSelector(u, state.working) +
          '</div>' +
          '<div class="cooking-book-hero-art">' +
            image(known && artworkKey(recipe)==="grilled" ? DEMO_ART_DIR + "hero.webp" :
              (known ? iconFor(recipe) : fallbackFor(recipe)), fallbackFor(recipe), "cooking-book-dish-art") +
          '</div>' +
        '</div>' +
        '<div class="cooking-book-section-heading"><span>EFECTOS</span></div>' +
        (known ? renderEffects(u, recipe, preview) :
          '<p class="cooking-book-note">Aprende la receta para descubrir sus efectos.</p>') +
        '<div class="cooking-book-section-heading"><span>INGREDIENTES</span></div>' +
        '<div class="cooking-book-ingredients">' +
          (known ? renderIngredients(recipe, resolved, data.rows) : '<p class="cooking-book-note">Ingredientes desconocidos.</p>') +
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
          '<div class="cooking-book-counter" aria-label="Cantidad que cocinar">' +
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
            '>' + (state.working ? 'COCINANDO…' : 'COCINAR') + svgIcon("utensils") + '</button>' +
        '</div>' +
      '</footer>' +
      '<div class="cooking-book-bottom-status">' +
        '<span class="' + (preview.valid && count ? 'is-ready' : 'is-blocked') + '">' +
          (preview.valid && count ? '● LISTO PARA COCINAR · MÁX. ' + count :
            '● NO SE PUEDE COCINAR') + '</span>' +
        '<span id="cooking-v2-status" class="cooking-book-status" role="status" aria-live="polite" data-kind="' +
            esc(state.messageType) + '">' + esc(state.message) + '</span>' +
      '</div>';
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
    return modifier + extra + checkTraitBonus(u, abilityId, normalized);
  }
  // Apply the identical pure contribution pipeline used by the normal player
  // ability Check preview and Skill/Ability breakdown. Bonuses are pre-coin.
  function checkTraitBonus(u, abilityId, proficiencyState) {
    const patch = global.LuminousSkillTraitBreakdownPatch;
    const engine = global.LuminousTraitEngine;
    if (!patch?.resolvedDmTraits || !engine) return 0;
    const traits = patch.resolvedDmTraits(u);
    const check = { kind:"ability", abilityId:id(abilityId), proficiencyState };
    return [
      ...(patch.checkPowerContributions?.(engine, traits, u, check) || []),
      ...(patch.finalPowerContributions?.(engine, traits, u, check) || []),
      ...(patch.specialCheckContributions?.(traits, u, check) || [])
    ].reduce(function (sum, row) {
      const amount = Number(row?.amount);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
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

    const session = inventorySession();
    if (!session) {
      message("La conexión del inventario no está disponible.", "error");
      return;
    }
    // Stage all portions off the live containers. A realtime refresh during any
    // animation discards the entire batch instead of losing cooked dishes.
    const staged = stagedCookingUnit(u, session);
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
        if (!inventorySessionCurrent(session)) throw new Error("COOKING_INVENTORY_CHANGED");
        if (!recipePreview(staged, recipe).valid) break;
        message("Preparando " + (index + 1) + " de " + requested + "…", "pending");
        const rolling = await coins().runAnimatedRoll({
          container: coinHost, coinCount: 5, base: abilityBase(u, recipe.ability),
          headsChance: headsChance(u), intervalMs: 350, auto: true
        });
        if (!inventorySessionCurrent(session)) throw new Error("COOKING_INVENTORY_CHANGED");
        const outcome = runtime().executeCook(staged, recipe.id, rolling.total, cookingOptions(staged));
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
        if (!inventorySessionCurrent(session)) throw new Error("COOKING_INVENTORY_CHANGED");
        // Persist a detached snapshot first. Never expose cooked items or
        // consumed ingredients in the live HUD when persistence may still fail.
        // Preserve other inventory-owned metadata and equipment references.
        const pendingSave = {
          ...session.inventory,
          inventario_activo: staged.inventario_activo,
          inventario_stash: staged.inventario_stash,
          equipment: staged.equipment
        };
        try {
          const peer = session.peer;
          // The production peer must quarantine RTDB optimistic listener
          // snapshots until the write has been acknowledged by Firebase.
          if (!peer?.bound || typeof peer.saveConfirmed !== "function") {
            throw new Error("CONFIRMED_SAVE_NOT_AVAILABLE");
          }
          const saved = await peer.saveConfirmed(pendingSave);
          if (saved?.saved !== true) throw new Error(saved?.reason || "SAVE_FAILED");
          // Firebase can deliver an updated snapshot while the save awaits.
          // Do not overwrite those authoritative containers with stale copies.
          if (inventorySessionCurrent(session)) {
            const live = inventoryUnit();
            live.inventario_activo = staged.inventario_activo;
            live.inventario_stash = staged.inventario_stash;
          }
          hud()?.renderAll?.();
          state.lastDish = made[made.length - 1].displayName + " · " +
            made[made.length - 1].stars + "★";
          message("¡" + made.length + (made.length === 1 ? " plato preparado" : " platos preparados") +
            " y guardados en el inventario!", "success");
        } catch (_) {
          message("No se pudo guardar la preparación. El inventario no cambió; vuelve a intentarlo cuando haya conexión.", "error");
        }
      } else if (state.messageType !== "error") {
        message("No se pudo cocinar. Comprueba ingredientes y espacio libre.", "error");
      }
    } catch (error) {
      message(error?.message === "COOKING_INVENTORY_CHANGED"
        ? "El inventario cambió durante la preparación. Se canceló el lote sin consumir ingredientes; revisa las existencias y vuelve a intentarlo."
        : "La tirada no se completó. No se han consumido ingredientes para esa tirada.", "error");
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
    state.stationId = null;
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
    categoryFor: categoryFor, maxQuantity: maxQuantity, abilityBase: abilityBase, headsChance: headsChance,
    currentStation: currentStation, ingredientAvailability: ingredientAvailability,
    checkTraitBonus: checkTraitBonus, inventorySession: inventorySession, inventorySessionCurrent: inventorySessionCurrent
  });
  global.LuminousCookingUi = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
