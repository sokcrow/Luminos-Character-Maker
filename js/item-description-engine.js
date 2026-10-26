(function (global) {
  "use strict";

  if (global.LuminousItemDescriptionEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemDescriptionEngine;
    return;
  }

  const VERSION = 1;

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clean = (value) => String(value ?? "").trim();
  const normalizeId = (value) => clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);

  function explicitDescription(item = {}) {
    return clean(item.descripcion || item.description || item.desc || item.flavorText || item.flavor_text);
  }

  function tokens(item = {}) {
    const values = [
      item.family,
      item.category,
      item.tipo_categoria,
      item.itemType,
      item.item_type,
      item.kind,
      item.group,
      item.iconFamily,
      item.icon_family,
      item.form,
      item.materialClass,
      item.toolCategory,
      item.processedForm,
      item.outputForm,
      item.processingMethod,
      ...asArray(item.tags),
      ...asArray(item.itemTags),
      ...asArray(item.useTags),
      ...asArray(item.reagentTags),
      ...asArray(item.materialTags),
      ...asArray(item.functionalTags),
      ...asArray(item.recipeRoles),
    ];
    return new Set(values.map(normalizeId).filter(Boolean));
  }

  function hasAny(set, ...wanted) {
    return wanted.flat().map(normalizeId).filter(Boolean).some((value) => set.has(value));
  }

  function humanize(value) {
    const text = clean(value);
    if (!text) return "";
    return text
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function firstUsefulTag(item = {}, ignored = []) {
    const block = new Set(ignored.map(normalizeId));
    const candidates = [
      ...asArray(item.useTags),
      ...asArray(item.reagentTags),
      ...asArray(item.functionalTags),
      ...asArray(item.tags),
    ].map(normalizeId).filter(Boolean);
    return candidates.find((tag) => !block.has(tag)) || "";
  }

  function healingDescription(item = {}) {
    const runtime = item.runtime || {};
    if (runtime.hybridHealing) {
      return "Suministro de recuperación combinada pensado para estabilizar cuerpo y mente. Al usarse puede restaurar HP y SP según su formulación.";
    }
    if (runtime.spHealing || runtime.effects?.spRestore || runtime.spRestore) {
      return "Consumible de recuperación mental diseñado para aliviar el desgaste y restaurar SP. Su presentación permite emplearlo como apoyo durante o después de una situación exigente.";
    }
    return "Consumible médico destinado a recuperar HP y estabilizar daño reciente. Su efecto depende de la potencia y el formato del suministro.";
  }

  function statusDescription(item = {}) {
    return "Tratamiento especializado para reducir o eliminar estados perjudiciales. Está pensado para controlar alteraciones persistentes sin sustituir una recuperación completa.";
  }

  function medicalDescription(item = {}) {
    return "Suministro médico para tratar heridas, lesiones o complicaciones físicas concretas. Se utiliza como parte de la atención de campo o de una recuperación más cuidadosa.";
  }

  function foodDescription(item = {}, set) {
    if (hasAny(set, "retail_food", "cookie_pack", "packaged_food")) {
      return "Alimento preparado y envasado para consumo directo. Aporta sustento sin requerir preparación adicional.";
    }
    if (hasAny(set, "culinary_staple", "culinary_staples", "ingredient")) {
      return "Ingrediente culinario de uso común, pensado para formar parte de comidas, raciones o preparaciones más elaboradas.";
    }
    if (hasAny(set, "meat", "raw_meat")) {
      return "Corte de carne aprovechable obtenido de una criatura. Puede cocinarse, conservarse o combinarse con otros ingredientes.";
    }
    return "Comida preparada para recuperar fuerzas y cubrir necesidades básicas de alimentación. Su calidad y preparación pueden modificar el resultado final.";
  }

  function biologicalMaterialDescription(set) {
    if (hasAny(set, "hide_pelt", "hide", "pelt", "leather_raw")) {
      return "Piel o pelaje sin procesar recuperado de una criatura. Sirve como materia prima para cuero, textiles, protecciones y otros trabajos.";
    }
    if (hasAny(set, "hard_parts", "bone", "horn", "tooth", "claw", "carapace_part")) {
      return "Parte biológica rígida recuperada de una criatura. Puede aprovecharse como material estructural, componente o recurso de fabricación.";
    }
    if (hasAny(set, "scale_shell_chitin", "scale", "shell", "chitin")) {
      return "Cubierta natural resistente obtenida de una criatura. Su dureza la hace útil en protecciones, refuerzos y fabricación especializada.";
    }
    if (hasAny(set, "feather_raw_fiber", "feather", "fiber", "raw_fiber")) {
      return "Material fibroso o plumaje recolectado de una criatura. Puede transformarse en textiles, rellenos o componentes ligeros.";
    }
    if (hasAny(set, "organ_gland", "organ", "gland")) {
      return "Órgano o glándula conservada para usos médicos, químicos o de investigación. Requiere manejo cuidadoso para mantener su utilidad.";
    }
    if (hasAny(set, "blood_ichor", "blood", "ichor")) {
      return "Fluido biológico recolectado y conservado como materia prima. Puede emplearse en medicina, química o procesos especializados.";
    }
    if (hasAny(set, "venom_secretion", "venom", "secretion")) {
      return "Secreción biológica de alta actividad, recolectada para procesamiento especializado. Se maneja como reactivo y no como consumible directo.";
    }
    if (hasAny(set, "ooze_gel", "ooze", "gel")) {
      return "Masa gelatinosa de origen biológico con propiedades útiles como reactivo o material de procesamiento. Su composición varía según la fuente.";
    }
    if (hasAny(set, "essence_core", "essence", "core")) {
      return "Núcleo o residuo concentrado de una criatura, apreciado por sus propiedades poco comunes. Se utiliza en fabricación y procesos de alto nivel.";
    }
    return "";
  }

  function mineralDescription(item = {}, set) {
    const form = normalizeId(item.form);
    if (form === "raw_mineral" || hasAny(set, "raw_mineral", "ore")) {
      return "Mineral en bruto extraído o recuperado como materia prima. Debe procesarse antes de alcanzar todo su potencial de fabricación.";
    }
    if (form === "alloy" || hasAny(set, "alloy")) {
      return "Aleación refinada preparada para fabricación estructural y técnica. Combina propiedades de varios materiales en una forma utilizable.";
    }
    if (hasAny(set, "refined_metal", "ingot", "metal_stock")) {
      return "Metal refinado y listo para fabricación. Puede emplearse en armas, armaduras, herramientas, componentes y trabajos industriales.";
    }
    if (hasAny(set, "gem", "gemstone", "rough_gem", "cut_gem")) {
      return "Piedra de valor material y ornamental. Puede utilizarse en joyería, intercambio o trabajos de precisión.";
    }
    return "Material mineral destinado a fabricación, refinamiento o intercambio. Su utilidad depende de su forma y grado de procesamiento.";
  }

  function plantDescription(set) {
    if (hasAny(set, "plant_produce", "produce", "botanical")) {
      return "Producto vegetal recolectado para alimentación, medicina o procesamiento. Puede utilizarse directamente o como ingrediente.";
    }
    return "";
  }

  function chemicalDescription(set) {
    if (hasAny(set, "chemical_raw")) {
      return "Reactivo industrial sin procesar utilizado como materia prima en química, mantenimiento o fabricación especializada. No está destinado al consumo directo.";
    }
    if (hasAny(set, "chemical_processed", "processed_chemical")) {
      return "Compuesto químico procesado y preparado para uso técnico. Funciona como insumo en fabricación, mantenimiento o síntesis especializada.";
    }
    if (hasAny(set, "medicinal_raw")) {
      return "Materia prima de grado médico utilizada para formular tratamientos, suministros y preparados farmacéuticos.";
    }
    if (hasAny(set, "medicinal_processed", "medicine_component")) {
      return "Componente medicinal procesado listo para integrarse en tratamientos o suministros médicos más complejos.";
    }
    return "";
  }

  function componentDescription(item = {}, set) {
    if (hasAny(set, "weapon_component", "weapon_components")) {
      return "Componente de arma destinado a ensamblaje, reparación o personalización. Su forma determina qué configuraciones puede soportar.";
    }
    if (hasAny(set, "ranged_weapon_component", "ranged_weapon_components")) {
      return "Componente mecánico para armas a distancia. Forma parte del conjunto estructural o funcional necesario para montar el arma.";
    }
    if (hasAny(set, "firearm_component", "firearm_components")) {
      return "Componente técnico de arma de fuego representado de forma abstracta para fabricación y mantenimiento dentro del juego.";
    }
    if (hasAny(set, "armor_component", "armor_components")) {
      return "Componente de armadura utilizado para construir, reforzar o reparar una pieza protectora.";
    }
    if (hasAny(set, "shield_component", "shield_components")) {
      return "Componente de escudo destinado a su estructura, agarre o refuerzo. Se utiliza en fabricación y reparación.";
    }
    if (hasAny(set, "throwable_component", "throwable_components")) {
      return "Componente de objeto arrojadizo utilizado para formar su carcasa, carga o mecanismo funcional dentro del sistema de fabricación.";
    }
    if (hasAny(set, "craft_components", "craft_component", "component")) {
      return "Componente procesado de fabricación. Está preparado para actuar como pieza intermedia en herramientas, equipo, dispositivos u otros objetos.";
    }
    return "";
  }

  function upgradeDescription(item = {}, set) {
    const subject = hasAny(set, "armor_upgrade", "armor_upgrades") ? "armadura"
      : hasAny(set, "shield_upgrade", "shield_upgrades") ? "escudo"
        : hasAny(set, "ranged_weapon_upgrade", "ranged_weapon_upgrades") ? "arma a distancia"
          : "arma";
    const status = clean(item.statusType);
    const damage = clean(item.damageType);
    if (status) return `Modificación para ${subject} que altera su comportamiento para favorecer efectos de ${humanize(status)}. Debe instalarse sobre una pieza compatible.`;
    if (damage) return `Modificación para ${subject} orientada a mejorar su rendimiento de ${humanize(damage)}. Debe instalarse sobre una pieza compatible.`;
    return `Modificación para ${subject} que cambia una de sus propiedades de combate, resistencia o manejo. Debe instalarse sobre una pieza compatible.`;
  }

  function weaponDescription(item = {}, set) {
    const props = asArray(item.properties || item.weaponProperties || item.tags).map(normalizeId);
    const ranged = props.some((value) => ["ammunition", "loading", "ranged"].includes(value)) || hasAny(set, "ranged_weapon");
    if (ranged) return "Arma diseñada para combatir a distancia. Su comportamiento depende de su configuración, munición y propiedades de manejo.";
    return "Arma de combate cuyo rendimiento depende de su forma, material, calidad y propiedades de manejo.";
  }

  function ammoDescription(item = {}, set) {
    if (hasAny(set, "ammo_component")) {
      return "Componente abstracto de munición utilizado por el sistema de fabricación del juego. No representa instrucciones ni especificaciones del mundo real.";
    }
    return "Munición preparada para un arma compatible. Su perfil determina cómo se comporta al utilizarse en combate.";
  }

  function toolDescription(item = {}) {
    const tag = firstUsefulTag(item, ["tool", "reusable", "crafted_item"]);
    if (tag) return `Juego reutilizable de herramientas pensado para tareas de ${humanize(tag).toLowerCase()}. Su eficacia puede depender de calidad, habilidad y contexto.`;
    return "Juego reutilizable de herramientas para trabajos especializados de fabricación, mantenimiento, recolección o soporte.";
  }

  function jewelryDescription(item = {}, set) {
    if (hasAny(set, "valuable", "treasure") || normalizeId(item.kind) === "valuable") {
      return "Objeto valioso apreciado principalmente por su material, rareza y acabado. Puede conservarse como tesoro o intercambiarse por su valor.";
    }
    return "Pieza ornamental que puede fabricarse con distintos metales y gemas. Su valor depende de los materiales, el acabado y cualquier modificación adicional.";
  }

  function genericDescription(item = {}, set) {
    if (hasAny(set, "equipment", "armor")) return "Pieza de equipo diseñada para protección o uso especializado. Sus prestaciones dependen de su calidad, materiales y configuración.";
    if (hasAny(set, "shield")) return "Equipo defensivo destinado a bloquear o mitigar ataques. Su rendimiento depende de sus materiales, condición y configuración.";
    if (hasAny(set, "ingredient", "material")) return "Materia prima o ingrediente destinado a fabricación, procesamiento o intercambio.";
    if (hasAny(set, "consumable")) return "Consumible de uso limitado con un efecto definido por su función y preparación.";
    if (hasAny(set, "valuable")) return "Objeto de valor destinado principalmente a intercambio, colección o recompensa.";
    return "Objeto utilizable dentro del inventario. Sus propiedades dependen de su tipo, calidad y configuración.";
  }

  function describe(item = {}) {
    const explicit = explicitDescription(item);
    if (explicit) return explicit;

    const set = tokens(item);
    const runtime = item.runtime || {};

    if (runtime.healing || runtime.hybridHealing || runtime.spHealing || runtime.effects?.hpRestore || runtime.effects?.spRestore || hasAny(set, "healing_hp", "healing_sp", "healing_hybrid")) {
      return healingDescription(item);
    }
    if (runtime.statusCure || runtime.handler === "status_cure" || hasAny(set, "status_cure")) return statusDescription(item);
    if (runtime.injuryTreatment || runtime.handler === "medical_supply" || hasAny(set, "medical_supply")) return medicalDescription(item);

    if (hasAny(set, "food", "retail_food", "culinary_staples", "culinary_staple", "meat", "raw_meat")) return foodDescription(item, set);

    const bio = biologicalMaterialDescription(set);
    if (bio) return bio;

    if (hasAny(set, "ore_ingot_gem", "raw_mineral", "ore", "refined_metal", "ingot", "alloy", "gem", "gemstone")) return mineralDescription(item, set);

    const plant = plantDescription(set);
    if (plant) return plant;

    const chemical = chemicalDescription(set);
    if (chemical) return chemical;

    if (hasAny(set, "jewelry_valuables", "jewelry", "valuable", "treasure")) return jewelryDescription(item, set);
    if (hasAny(set, "tools", "tool") || normalizeId(item.itemType) === "tool") return toolDescription(item);

    if (hasAny(set, "firearm_ammunition", "ammo", "ammunition", "ammo_component") || normalizeId(item.itemType).includes("ammo")) return ammoDescription(item, set);

    if (hasAny(set, "upgrade", "weapon_upgrade", "weapon_upgrades", "armor_upgrade", "armor_upgrades", "shield_upgrade", "shield_upgrades", "ranged_weapon_upgrade", "ranged_weapon_upgrades") || item.slotCost != null) {
      return upgradeDescription(item, set);
    }

    const component = componentDescription(item, set);
    if (component) return component;

    if (hasAny(set, "weapons", "weapon") || normalizeId(item.itemType) === "weapon") return weaponDescription(item, set);

    return genericDescription(item, set);
  }

  function enrich(item = {}) {
    if (!item || typeof item !== "object") return item;
    const existing = explicitDescription(item);
    const description = existing || describe(item);
    const out = clone(item) || {};
    if (!clean(out.description)) out.description = description;
    if (!clean(out.descripcion)) out.descripcion = description;
    return out;
  }

  const API = Object.freeze({
    version: VERSION,
    explicitDescription,
    describe,
    enrich,
    tokens,
  });

  global.LuminousItemDescriptionEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
