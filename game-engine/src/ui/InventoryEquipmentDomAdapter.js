function button(label, action, payload = {}) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = "inventory-action";
  node.textContent = label;
  node.dataset.action = action;
  Object.entries(payload).forEach(([key, value]) => {
    if (value != null) node.dataset[key] = String(value);
  });
  return node;
}

function empty(label) {
  const node = document.createElement("div");
  node.className = "inventory-empty";
  node.textContent = label;
  return node;
}

function iconNode(src, label) {
  const wrap = document.createElement("div");
  wrap.className = "inventory-icon";
  if (!src) {
    wrap.textContent = "·";
    return wrap;
  }
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.loading = "lazy";
  img.addEventListener("error", () => { wrap.textContent = label?.slice(0, 1)?.toUpperCase() || "?"; img.remove(); }, { once: true });
  wrap.appendChild(img);
  return wrap;
}

function itemCard(item) {
  const card = document.createElement("article");
  card.className = "inventory-item";
  card.dataset.instanceId = item.instanceId;

  card.appendChild(iconNode(item.icon, item.name));
  const info = document.createElement("div");
  info.className = "inventory-item-info";
  const title = document.createElement("strong");
  title.textContent = item.name;
  const meta = document.createElement("span");
  meta.textContent = `${item.kind}${item.quantity > 1 ? ` · x${item.quantity}` : ""}${item.equippedSlot ? ` · ${item.equippedSlot}` : ""}`;
  info.append(title, meta);
  card.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "inventory-item-actions";
  if (item.container === "active") {
    if (item.equippedSlot) {
      actions.appendChild(button("Quitar", "unequip", { slot: item.equippedSlot }));
    } else if (item.compatibleSlots?.length) {
      actions.appendChild(button("Equipar", "equip", { instanceId: item.instanceId, slot: item.compatibleSlots[0] }));
    }
    actions.appendChild(button("→ Alijo", "stash", { instanceId: item.instanceId }));
  } else {
    actions.appendChild(button("→ Activo", "active", { instanceId: item.instanceId }));
  }
  card.appendChild(actions);
  return card;
}

function equipmentSlot(slot) {
  const node = document.createElement("article");
  node.className = "equipment-slot";
  const label = document.createElement("span");
  label.className = "equipment-slot-label";
  label.textContent = slot.label;
  node.appendChild(label);
  if (!slot.item) {
    const vacant = document.createElement("span");
    vacant.className = "equipment-slot-empty";
    vacant.textContent = "Vacío";
    node.appendChild(vacant);
    return node;
  }
  node.appendChild(iconNode(slot.item.icon, slot.item.name));
  const name = document.createElement("strong");
  name.textContent = slot.item.name;
  node.appendChild(name);
  node.appendChild(button("Quitar", "unequip", { slot: slot.slot }));
  return node;
}

export class InventoryEquipmentDomAdapter {
  constructor({ root, onAction } = {}) {
    if (!root) throw new Error("InventoryEquipmentDomAdapter requires root");
    this.root = root;
    this.onAction = typeof onAction === "function" ? onAction : () => {};
    this.handleClick = event => {
      const target = event.target.closest?.("[data-action]");
      if (!target || !this.root.contains(target)) return;
      this.onAction({ ...target.dataset });
    };
    this.root.addEventListener("click", this.handleClick);
  }

  render(model) {
    if (!model) return;
    const activeRoot = this.root.querySelector("[data-inventory-active]");
    const stashRoot = this.root.querySelector("[data-inventory-stash]");
    const equipmentRoot = this.root.querySelector("[data-equipment-slots]");
    const activeCount = this.root.querySelector("[data-active-count]");
    const stashCount = this.root.querySelector("[data-stash-count]");
    if (activeCount) activeCount.textContent = `${model.activeSlots}/${model.activeSlotLimit}`;
    if (stashCount) stashCount.textContent = `${model.stashSlots}/${model.stashSlotLimit}`;
    if (activeRoot) activeRoot.replaceChildren(...(model.active.length ? model.active.map(itemCard) : [empty("Inventario activo vacío")]));
    if (stashRoot) stashRoot.replaceChildren(...(model.stash.length ? model.stash.map(itemCard) : [empty("Alijo vacío")]));
    if (equipmentRoot) equipmentRoot.replaceChildren(...model.equipment.map(equipmentSlot));
    this.root.dataset.contract = model.contract;
  }

  dispose() {
    this.root.removeEventListener("click", this.handleClick);
  }
}
