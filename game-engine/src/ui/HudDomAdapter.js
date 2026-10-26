import { HUD_VIEW_MODEL_CONTRACT_ID } from "./HudViewModel.js";

export class HudDomAdapter {
  constructor({ root = globalThis.document || null } = {}) {
    this.root = root;
  }

  available() {
    return Boolean(this.root?.querySelector);
  }

  render(model) {
    if (!this.available()) return false;
    if (model?.contract !== HUD_VIEW_MODEL_CONTRACT_ID) {
      throw new Error("HudDomAdapter received an incompatible HUD model");
    }

    const status = this.root.querySelector("[data-hud-status]");
    const map = this.root.querySelector("[data-hud-map]");
    const unit = this.root.querySelector("[data-hud-unit]");
    const output = this.root.querySelector("[data-hud-json]");

    if (status) {
      status.textContent = model.engine.running
        ? `Runtime activo · ${model.engine.frames} frames`
        : "Runtime detenido";
    }
    if (map) {
      map.textContent = model.map.id
        ? `${model.map.id} · ${model.map.authority || "sin autoridad"}`
        : "Sin mapa activo";
    }
    if (unit) {
      unit.textContent = model.unit
        ? `${model.unit.id} · ${model.unit.locomotion || "sin locomoción"} · (${model.unit.transform.x}, ${model.unit.transform.y}, ${model.unit.transform.z})`
        : "Sin Unit objetivo";
    }
    if (output) output.textContent = JSON.stringify(model, null, 2);
    return true;
  }
}
