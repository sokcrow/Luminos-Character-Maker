export class LuminousItemsBridge {
  constructor(root = globalThis) {
    this.root = root;
    this.engine = null;
  }

  attach(engine) {
    this.engine = engine;
    engine.events.emit("items:bridge-state", this.status());
  }

  detach() {
    this.engine = null;
  }

  get inventory() {
    return this.root.LuminousItemInventoryRuntime || null;
  }

  get runtime() {
    return this.root.LuminousItemRuntime || null;
  }

  get available() {
    return Boolean(this.inventory && this.runtime);
  }

  status() {
    return {
      available: this.available,
      inventoryVersion: this.inventory?.version ?? null,
      inventorySchemaVersion: this.inventory?.schemaVersion ?? null,
      hasItemRuntime: Boolean(this.runtime)
    };
  }

  createInstance(definitionOrId, options = {}) {
    if (!this.inventory?.createItemInstance) throw new Error("Luminous Item Inventory Runtime is not loaded");
    return this.inventory.createItemInstance(definitionOrId, options);
  }

  snapshot(player, options = {}) {
    if (!this.inventory?.inventorySnapshot) throw new Error("Luminous Item Inventory Runtime is not loaded");
    return this.inventory.inventorySnapshot(player, options);
  }

  describe(player) {
    return this.inventory?.describeInventory?.(player) || null;
  }

  find(player, ref, options = {}) {
    return this.inventory?.findItem?.(player, ref, options) || null;
  }

  moveToStash(player, ref, amount = null, options = {}) {
    const result = this.inventory?.moveToStash?.(player, ref, amount, options)
      || { moved: false, reason: "inventory_runtime_unavailable" };
    this.engine?.events.emit("items:moved", { direction: "stash", ref, amount, result });
    return result;
  }

  moveToActive(player, ref, amount = null, options = {}) {
    const result = this.inventory?.moveToActive?.(player, ref, amount, options)
      || { moved: false, reason: "inventory_runtime_unavailable" };
    this.engine?.events.emit("items:moved", { direction: "active", ref, amount, result });
    return result;
  }

  use(player, ref, options = {}) {
    const item = typeof ref === "object" ? ref : this.find(player, ref, options);
    if (!item) return { ok: false, reason: "item_not_found" };
    const result = this.runtime?.useItem?.(player, item, options)
      || { ok: false, reason: "item_runtime_unavailable" };
    this.engine?.events.emit("items:used", { ref, item, result });
    return result;
  }
}
