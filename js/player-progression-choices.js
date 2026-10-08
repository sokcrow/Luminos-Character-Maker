(function (global) {
  "use strict";
  if (global.LuminousPlayerProgressionChoices) return;
  const doc = global.document;
  const PLAYER_ROOT = "campaña/jugadores";
  const TRAIT_DEFINITIONS_ROOT = "campaña/config/traits/definitions";
  const STATS = Object.freeze([
    ["fuerza","STR","Fuerza"], ["destreza","DEX","Destreza"],
    ["constitucion","CON","Constitución"], ["inteligencia","INT","Inteligencia"],
    ["sabiduria","WIS","Sabiduría"], ["carisma","CHA","Carisma"],
  ]);
  const text = value => String(value ?? "").trim();
  const id = value => text(value).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  const api = () => global.LuminousClassMilestones;
  const progressionCore = () => global.LuminousPlayerProgressionTreeCore;
  // Use the same sources and map normalization as the visible class/archetype
  // tree. Every eligibility check must agree with what the player sees.
  const normalizedClasses = character => progressionCore()?.normalizeClasses?.(character) || [];
  const normalizedSelections = character => progressionCore()?.normalizeSelections?.(character) || [];
  const earnedMilestone = (character, classId, level) =>
    !!api()?.earnedMilestones(normalizedClasses(character))
      .some(entry => entry.classId === id(classId) && entry.milestoneLevel === Number(level));
  const make = (tag, className, label) => {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    if (label != null) element.textContent = String(label);
    return element;
  };
  const option = (value, label) => {
    const node = make("option", "", label);
    node.value = value;
    return node;
  };
  const feedback = () => {
    const node = make("p","player-progression-choice-feedback");
    node.setAttribute("role","alert");
    node.hidden = true;
    return node;
  };
  const say = (node, message, kind = "error") => {
    node.textContent = message;
    node.dataset.kind = kind;
    node.hidden = !message;
  };
  const root = (db, playerId) => {
    if (!db?.ref || !text(playerId)) throw new Error("No hay conexión para guardar estas elecciones.");
    return db.ref(`${PLAYER_ROOT}/${text(playerId)}`);
  };
  const isEarned = earnedMilestone;
  const savedChoice = (character, classId, level) =>
    api()?.choiceAt(character?.characterBuild?.classMilestones, classId, level)
      || api()?.choiceAt(character?.classMilestones, classId, level) || null;
  const choiceLabel = (choice, definitions = {}) => {
    if (!choice) return "";
    if (choice.type === "trait") return "Trait General: " + (definitions[choice.traitId]?.name || choice.traitId);
    return Object.entries(choice.allocation || {}).map(([key,n]) =>
      "+" + n + " " + (STATS.find(stat=>stat[0]===key)?.[1] || key.toUpperCase())).join(" · ");
  };
  const milestoneNodes = (classModel, character) => {
    const milestones = api();
    if (!milestones) return classModel.commonNodes || [];
    const map = new Map((classModel.commonNodes || []).map(node => [Number(node.level), { ...node, items:[...(node.items || [])] }]));
    for (const level of milestones.milestoneLevelsForClass(classModel.classId)) {
      const old = map.get(level) || { level, items: [], status: level <= classModel.classLevel ? "earned" : "future" };
      const selected = savedChoice(character,classModel.classId,level);
      old.choiceMilestone = true;
      old.milestoneClaimed = !!selected;
      old.items.push({
        id:"class_milestone_" + level,
        name:selected ? "Mejora elegida: " + choiceLabel(selected) : "Elegir mejora de atributos o Trait General",
        description:selected ? "Esta elección ya fue guardada." : "Elige +2 a un Stat, +1 a dos Stats diferentes o un Trait General.",
        kind:"milestone_choice",
        formulas:[],
      });
      map.set(level,old);
    }
    return [...map.values()].sort((a,b)=>a.level-b.level);
  };
  const allDefinitions = async (db) => {
    const local = global.LuminousTraitCatalogCore?.allDefinitions?.() || {};
    if (!db?.ref) return local;
    try {
      const ref = db.ref(TRAIT_DEFINITIONS_ROOT);
      const snapshot = typeof ref.once === "function"
        ? await ref.once("value")
        : typeof ref.get === "function" ? await ref.get() : null;
      return { ...local, ...(snapshot?.val?.() || {}) };
    } catch (_) {
      return local;
    }
  };
  const generalOptions = (definitions, character) => {
    const selected = new Set(api()?.selectedGeneralTraitIds(character) || []);
    return Object.entries(definitions || {})
      .filter(([,def]) => api()?.isGeneralTraitDefinition(def))
      .map(([key,def]) => ({ id:id(def.id || key), name:text(def.name || key), description:text(def.description) }))
      .filter(entry => entry.id && !selected.has(entry.id))
      .sort((a,b)=>a.name.localeCompare(b.name,"es"));
  };
  const updateLocal = (character, saved) => {
    if (character && saved && typeof saved === "object") Object.assign(character,saved);
  };

  function renderMilestone(host, { character = {}, classId, level, db, playerId, onSaved } = {}) {
    if (!doc || !host || !api()) return false;
    host.replaceChildren();
    const outer = make("section","player-progression-choice-panel");
    outer.dataset.choiceKind = "class_milestone";
    outer.appendChild(make("h4","","MEJORA DE CLASE · NIVEL " + level));
    const rules = make("p","player-progression-choice-rule",
      "Elige +2 a un atributo, +1 a dos atributos diferentes o un Trait General. Los atributos no pueden superar 20.");
    outer.appendChild(rules);
    host.appendChild(outer);
    const saved = savedChoice(character,classId,level);
    if (saved) {
      outer.appendChild(make("strong","player-progression-choice-saved","✓ GUARDADO · " + choiceLabel(saved)));
      return true;
    }
    if (!isEarned(character,classId,level)) {
      outer.appendChild(make("p","player-progression-choice-muted",
        "Se desbloquea al alcanzar el nivel " + level + " de esta clase."));
      return true;
    }
    const form = make("div","player-progression-choice-form");
    const mode = make("select","player-progression-choice-select");
    mode.setAttribute("aria-label","Tipo de mejora de clase");
    mode.append(
      option("stats_two","+2 a un atributo"),
      option("stats_split","+1 a dos atributos"),
      option("trait","Elegir Trait General")
    );
    const controls = make("div","player-progression-choice-controls");
    const submit = make("button","player-progression-choice-save","CONFIRMAR MEJORA");
    submit.type = "button";
    const notice = feedback();
    form.append(mode,controls,submit,notice);
    outer.appendChild(form);
    let traitDefinitions = null;
    let loadToken = 0;
    const addStat = (value, label) => {
      const select = make("select","player-progression-choice-stat");
      select.setAttribute("aria-label",label);
      STATS.forEach(([key,code,name]) => select.appendChild(option(key,code+" · "+name)));
      select.value = value;
      return select;
    };
    const renderInputs = async () => {
      const token = ++loadToken;
      controls.replaceChildren();
      say(notice,"");
      if (mode.value === "stats_two") {
        controls.appendChild(addStat("fuerza","Atributo que recibe +2"));
      } else if (mode.value === "stats_split") {
        controls.append(addStat("fuerza","Primer atributo que recibe +1"),
          addStat("destreza","Segundo atributo que recibe +1"));
      } else {
        controls.appendChild(make("p","player-progression-choice-muted","Buscando Traits Generales…"));
        traitDefinitions = await allDefinitions(db);
        if (token !== loadToken || mode.value !== "trait") return;
        controls.replaceChildren();
        const entries = generalOptions(traitDefinitions,character);
        if (!entries.length) {
          controls.appendChild(make("p","player-progression-choice-muted","No hay Traits Generales disponibles."));
          return;
        }
        const select = make("select","player-progression-choice-trait");
        select.setAttribute("aria-label","Trait General");
        select.appendChild(option("","Selecciona un Trait General"));
        for (const entry of entries) select.appendChild(option(entry.id,entry.name));
        const description = make("p","player-progression-choice-trait-description");
        select.addEventListener("change",()=>{
          description.textContent = entries.find(entry=>entry.id===select.value)?.description || "";
        });
        controls.append(select,description);
      }
    };
    mode.addEventListener("change",()=>{void renderInputs();});
    submit.addEventListener("click",async()=>{
      if (submit.disabled) return;
      const statSelectors = [...controls.querySelectorAll(".player-progression-choice-stat")];
      const proposed = mode.value === "trait"
        ? { type:"trait", traitId:controls.querySelector(".player-progression-choice-trait")?.value || "" }
        : mode.value === "stats_split"
          ? { type:"stats", allocation: {
              [statSelectors[0]?.value || "fuerza"]:1,
              [statSelectors[1]?.value || "destreza"]:1
            } }
          : { type:"stats", allocation:{ [statSelectors[0]?.value || "fuerza"]:2 } };
      if (mode.value === "stats_split" && statSelectors[0]?.value === statSelectors[1]?.value) {
        say(notice,"Elige dos atributos diferentes.");
        return;
      }
      const prevalidation = api().validateChoice(proposed, character.stats || {});
      if (!prevalidation.valid) {
        say(notice,prevalidation.errors.join(" "));
        return;
      }
      if (proposed.type === "trait") {
        const def = traitDefinitions?.[proposed.traitId];
        if (!def || !api().isGeneralTraitDefinition(def)) {
          say(notice,"Selecciona un Trait General válido.");return;
        }
      }
      submit.disabled = true;
      submit.textContent = "GUARDANDO…";
      let abortReason = "No se pudo reclamar este Milestone.";
      try {
        const playerRef = root(db,playerId);
        const tx = current => {
          if (!current || typeof current !== "object") {
            abortReason = "No se encontró el personaje."; return;
          }
          const build = current.characterBuild || {};
          if (!earnedMilestone(current, classId, level)) {
            abortReason = "Aún no alcanzaste el nivel requerido para esta mejora.";return;
          }
          let preservedMilestones;
          try {
            // Keep BOTH top-level and characterBuild claims, including arrays,
            // before duplicate checks and before applying any stat bonuses.
            preservedMilestones = api().mergeMilestoneChoices(current);
          } catch (error) {
            abortReason = error?.message || "No fue posible conservar los Milestones anteriores.";
            return;
          }
          if (api().choiceAt(preservedMilestones,classId,level)) {
            abortReason = "Esta mejora ya fue reclamada.";return;
          }
          const checked = api().validateChoice(proposed,current.stats || {});
          if (!checked.valid) { abortReason=checked.errors.join(" ");return; }
          if (checked.choice.type === "trait"
            && api().selectedGeneralTraitIds({characterBuild:{classMilestones:preservedMilestones}})
              .includes(id(proposed.traitId))) {
            abortReason = "Ese Trait General ya se eligió.";return;
          }
          let baseStatsApplied = false;
          if (checked.choice.type === "stats") {
            const applied = api().applyPlayerStatAllocation(current,checked.choice.allocation);
            if (!applied.valid) { abortReason=applied.errors.join(" ");return; }
            current.stats = current.stats && typeof current.stats==="object" ? current.stats : {};
            Object.keys(applied.allocation).forEach(key=>{
              api().writeCanonicalStat(current.stats,key,applied.stats[key]);
            });
            if (applied.baseStats) current.baseStats = applied.baseStats;
            baseStatsApplied = Boolean(applied.baseStats);
          }
          current.characterBuild = build;
          build.classMilestones = preservedMilestones;
          if (!build.classMilestones[id(classId)] || typeof build.classMilestones[id(classId)] !== "object")
            build.classMilestones[id(classId)] = {};
          build.classMilestones[id(classId)][String(level)] = {
            classId:id(classId),milestoneLevel:Number(level),...checked.choice,selectedAt:Date.now(),
            ...(checked.choice.type === "stats" ? { baseStatsApplied } : {}),
          };
          // No shadow legacy store: reverting a migrated claim must remove
          // the sole canonical claim, not reveal an old top-level duplicate.
          delete current.classMilestones;
          return current;
        };
        const result = await playerRef.transaction(tx);
        if (!result?.committed) throw new Error(abortReason);
        updateLocal(character,result.snapshot?.val?.());
        say(notice,"Mejora guardada.","success");
        global.LuminousPlayerTraitRuntime?.refresh?.();
        onSaved?.();
      } catch (error) {
        say(notice,error?.message || abortReason);
      } finally {
        submit.disabled = false;
        submit.textContent = "CONFIRMAR MEJORA";
      }
    });
    void renderInputs();
    return true;
  }

  function maneuverLimit(character = {}) {
    const fighterLevel = normalizedClasses(character).find(entry => entry.classId === "fighter")?.levels || 0;
    const selectedBattleMaster = normalizedSelections(character).some(
      entry => entry.classId === "fighter" && entry.archetypeId === "battle_master");
    if (!selectedBattleMaster || fighterLevel < 15) return 0;
    const base = fighterLevel>=90?5:fighterLevel>=50?4:3;
    const runtime = global.LuminousBattleMasterArchetypeRuntime;
    const extra = character?.superiorTechnique === true || character?.characterBuild?.superiorTechnique === true ||
      (api()?.selectedGeneralTraitIds?.(character) || []).includes("superior_technique") ||
      [character.traits,character.traitDefinitions,character.characterBuild?.traits].some(list=>
        Array.isArray(list)&&list.some(entry=>id(typeof entry==="string"?entry:entry?.id||entry?.name)==="superior_technique"));
    // The Battle Master runtime does not yet examine classMilestones. A Trait
    // chosen there must still grant its extra slot even after runtime boot.
    return Math.max(base + (extra?1:0),
      Number(runtime?.maneuverCapacity?.(character)) || 0);
  }
  const chosenManeuvers = (character = {}) => {
    const stored = character?.characterBuild?.maneuvers?.battle_master;
    return [...new Set((Array.isArray(stored)?stored:[]).map(id).filter(Boolean))];
  };

  function renderManeuvers(host,{character={},db,playerId,onSaved}={}) {
    if (!doc || !host) return false;
    host.replaceChildren();
    const count = maneuverLimit(character);
    const outer = make("section","player-progression-choice-panel player-progression-maneuver-panel");
    outer.dataset.choiceKind = "battle_master_maneuvers";
    outer.appendChild(make("h4","","MANIOBRAS · BATTLE MASTER"));
    host.appendChild(outer);
    if (!count) {
      outer.appendChild(make("p","player-progression-choice-muted",
        "Selecciona Battle Master y alcanza Fighter nivel 15 para aprender maniobras."));
      return true;
    }
    const catalog = global.LuminousFighterManeuverCatalog;
    const entries = catalog?.list?.() || Object.values(catalog?.MANEUVERS || {});
    if (!entries.length) {
      outer.appendChild(make("p","player-progression-choice-muted",
        "El catálogo de maniobras todavía no está disponible."));
      return false;
    }
    const existing = chosenManeuvers(character);
    const chosen = new Set(existing);
    const needsReduction = existing.length > count;
    outer.appendChild(make("p","player-progression-choice-rule", needsReduction
      ? "Tienes "+existing.length+" maniobras aprendidas, pero ahora sólo puedes conservar "+count+
        ". Desmarca "+(existing.length-count)+" maniobra(s) aprendida(s) y guarda la selección. No puedes reemplazarlas por otras."
      : "Aprende "+count+" maniobras. Las que ya conoces se conservan; los espacios nuevos se desbloquean con la progresión."));
    const counter = make("strong","player-progression-maneuver-counter","");
    const list = make("div","player-progression-maneuver-list");
    list.setAttribute("role","group");
    list.setAttribute("aria-label","Maniobras disponibles");
    const checkboxes = [];
    const notice = feedback();
    const save = make("button","player-progression-choice-save","GUARDAR MANIOBRAS");
    save.type="button";
    const update = () => {
      counter.textContent = chosen.size+" / "+count+" MANIOBRAS ELEGIDAS";
      save.disabled = chosen.size !== count || (chosen.size===existing.length && existing.every(m=>chosen.has(m)));
    };
    for(const maneuver of entries) {
      const row = make("label","player-progression-maneuver");
      const input = make("input");
      input.type="checkbox";
      input.value=maneuver.id;
      input.checked=chosen.has(maneuver.id);
      // Normal progression locks mastered maneuvers. If a milestone is
      // reverted and capacity shrinks, only mastered maneuvers can be
      // unchecked to reduce the list; new maneuvers cannot be substituted.
      input.disabled=needsReduction ? !existing.includes(maneuver.id) : existing.includes(maneuver.id);
      const content = make("span","player-progression-maneuver-copy");
      content.append(make("strong","",maneuver.name),make("small","",maneuver.description));
      if(existing.includes(maneuver.id)) content.appendChild(make("em","","APRENDIDA"));
      row.append(input,content);
      input.addEventListener("change",()=>{
        if(input.checked && chosen.size>=count){input.checked=false; say(notice,"Ya elegiste el máximo de maniobras.");return;}
        if(input.checked)chosen.add(maneuver.id);
        else chosen.delete(maneuver.id);
        say(notice,"");update();
      });
      checkboxes.push(input);
      list.appendChild(row);
    }
    outer.append(counter,list,save,notice);
    update();
    save.addEventListener("click",async()=>{
      if(save.disabled)return;
      const proposed=[...chosen];
      if(proposed.length!==count){say(notice,"Completa los "+count+" espacios antes de guardar.");return;}
      save.disabled=true;save.textContent="GUARDANDO…";
      let abortReason="No se pudieron guardar las maniobras.";
      try{
        const playerRef=root(db,playerId);
        const result=await playerRef.transaction(current=>{
          if(!current||typeof current!=="object"){abortReason="No se encontró el personaje.";return;}
          const currentLimit=maneuverLimit(current);
          const prior=chosenManeuvers(current);
          if(currentLimit!==proposed.length){abortReason="Tu límite de maniobras cambió. Actualiza Avance.";return;}
          if (prior.length > currentLimit) {
            // The DM may have reverted Superior Technique. Permit ONLY
            // discarding the excess from the previously learned set. If
            // somebody changed the learned list since the picker opened,
            // require a refresh instead of silently removing their choices.
            if (!needsReduction || prior.length !== existing.length
              || prior.some(key=>!existing.includes(key))) {
              abortReason="Las maniobras cambiaron. Vuelve a abrir el selector antes de reducirlas.";return;
            }
            if (proposed.some(key=>!prior.includes(key))) {
              abortReason="Al reducir maniobras sólo puedes conservar las ya aprendidas.";return;
            }
          } else if(prior.some(key=>!proposed.includes(key))){
            abortReason="No puedes perder maniobras ya aprendidas.";return;
          }
          if(new Set(proposed).size!==proposed.length || proposed.some(key=>!catalog?.get?.(key))){
            abortReason="La selección contiene una maniobra desconocida.";return;
          }
          current.characterBuild = current.characterBuild && typeof current.characterBuild==="object" ? current.characterBuild : {};
          current.characterBuild.maneuvers = current.characterBuild.maneuvers
            && typeof current.characterBuild.maneuvers==="object" && !Array.isArray(current.characterBuild.maneuvers)
            ? current.characterBuild.maneuvers : {};
          current.characterBuild.maneuvers.battle_master=proposed;
          return current;
        });
        if(!result?.committed)throw Error(abortReason);
        updateLocal(character,result.snapshot?.val?.());
        say(notice,"Maniobras guardadas.","success");
        onSaved?.();
      }catch(error){say(notice,error?.message||abortReason);}
      finally{save.disabled=false;save.textContent="GUARDAR MANIOBRAS";update();}
    });
    return true;
  }
  global.LuminousPlayerProgressionChoices = Object.freeze({
    milestoneNodes, renderMilestone,renderManeuvers,maneuverLimit,chosenManeuvers,
  });
})(typeof window !== "undefined" ? window : globalThis);
