(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const magic = window.LuminousItemEnchantmentRuntime;
  const catalog = window.LuminousEnchantmentRecipeCatalog;
  const labels = {
    weapon: "Armas", armor: "Armaduras", shield: "Escudos",
    accessory: "Accesorios", valuable: "Objetos valiosos",
    offensive_level: "Nivel ofensivo", defensive_level: "Nivel defensivo",
    guard_power: "Poder de guardia", base_power: "Poder base",
    final_power: "Poder final", clash_power: "Poder de choque",
    speed: "Velocidad", min_speed: "Velocidad mínima", max_speed: "Velocidad máxima",
  };
  const money = (v) => (Number(v) || 0).toLocaleString("es-MX") + " AHN";
  function option(select, value, title) {
    const el = document.createElement("option");
    el.value = value;
    el.textContent = title;
    select.appendChild(el);
  }
  if (!magic || !catalog) {
    $("enchantment-recipe").textContent = "No fue posible cargar el catálogo de encantamientos.";
    return;
  }
  const family = $("enchantment-kind");
  for (const [kind, channels] of Object.entries(magic.CHANNELS_BY_KIND)) {
    option(family, kind, labels[kind] || kind);
    const card = document.createElement("article");
    card.className = "family";
    const h3 = document.createElement("h3");
    h3.textContent = labels[kind] || kind;
    card.appendChild(h3);
    const small = document.createElement("small");
    small.textContent = ["accessory","valuable"].includes(kind) ? "Debe estar preparado para encantarse y equipado como accesorio." :
      kind === "weapon" ? "Solo actúa sobre Skills vinculadas a esta arma equipada." : "Se activa con el objeto equipado.";
    card.appendChild(small);
    channels.forEach((channel) => {
      const tag = document.createElement("span"); tag.className = "channel";
      tag.textContent = labels[channel] || channel; card.appendChild(tag);
    });
    $("enchantment-family-list").appendChild(card);
  }
  const gemSelector = $("enchantment-gem");
  catalog.cutGems().forEach((entry) => option(gemSelector, entry.id, entry.name));
  if (catalog.cutGems().some((entry) => entry.id === "ruby")) gemSelector.value = "ruby";
  function refreshFocus() {
    const previous = $("enchantment-focus").value;
    const focus = $("enchantment-focus");
    focus.replaceChildren();
    for (const channel of magic.CHANNELS_BY_KIND[family.value] || []) option(focus, channel, labels[channel] || channel);
    if ([...focus.options].some((x) => x.value === previous)) focus.value = previous;
    render();
  }
  function render() {
    const base = Number($("enchantment-base").value);
    const kind = family.value;
    const item = {
      instanceId: "compendium_preview", itemType: kind, enchantmentReady: true,
      baseMundaneValueAhn: base, productionValueAhn: base,
    };
    const prepared = catalog.quote(item, {
      tier: Number($("enchantment-tier").value), channel: $("enchantment-focus").value, gemId: gemSelector.value,
    });
    const host = $("enchantment-recipe");
    host.replaceChildren();
    if (!prepared.valid) {
      host.textContent = prepared.reason === "unpriced_item"
        ? "Introduce un valor mundano mayor que cero para calcular el valor encantado."
        : "No hay receta válida para esta combinación.";
      return;
    }
    const title = document.createElement("h3");
    title.textContent = "Ritual de encantamiento +" + prepared.tier;
    host.appendChild(title);
    const list = document.createElement("ul");
    for (const material of prepared.materials) {
      const li = document.createElement("li");
      li.textContent = material.name + " × " + material.quantity + " — " + money(material.valueAhn);
      list.appendChild(li);
    }
    host.appendChild(list);
    const dl = document.createElement("dl");
    for (const [name,value] of [
      ["Valor estimado de materiales",money(prepared.materialValueAhn)],
      ["AHN cobrados por el taller",money(prepared.chargedAhn)],
      ["Coste conjunto de producción",money(prepared.estimatedCraftValueAhn)],
      ["Valor mundano del objeto",money(prepared.baseValueAhn)],
      ["Valor estimado del objeto encantado",money(prepared.enchantedValueAhn)],
    ]) {
      const dt=document.createElement("dt");dt.textContent=name;
      const dd=document.createElement("dd");dd.textContent=value;
      dl.append(dt,dd);
    }
    host.appendChild(dl);
    const foot = document.createElement("p");
    foot.className = "notice";
    foot.textContent = "Resonancia registrada: " + (prepared.resonanceTags.join(", ") || "sin resonancia") +
      ". Solo se cobra el taller si ya posees todos los materiales. El valor final incluye un piso de coste de producción.";
    host.appendChild(foot);
  }
  family.addEventListener("change", refreshFocus);
  ["enchantment-focus","enchantment-tier","enchantment-gem","enchantment-base"].forEach((id) => {
    $(id).addEventListener("input", render);
    $(id).addEventListener("change", render);
  });
  refreshFocus();
})();