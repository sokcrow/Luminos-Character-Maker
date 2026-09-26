export class TouchMovementAdapter {
  constructor({ root = document, onIntent = null } = {}) {
    this.root = root;
    this.onIntent = typeof onIntent === "function" ? onIntent : () => {};
    this.active = new Map();
    this.buttons = Array.from(this.root.querySelectorAll("[data-touch-move]"));
    this.listeners = [];
    this.mount();
  }

  mount() {
    this.buttons.forEach(button => {
      const direction = button.getAttribute("data-touch-move");
      const start = event => {
        event.preventDefault();
        if (event.pointerId != null) {
          try { button.setPointerCapture(event.pointerId); } catch {}
          this.active.set(event.pointerId, direction);
        } else {
          this.active.set(direction, direction);
        }
        button.dataset.active = "true";
        this.emit();
      };
      const stop = event => {
        event.preventDefault();
        if (event.pointerId != null) this.active.delete(event.pointerId);
        else this.active.delete(direction);
        if (![...this.active.values()].includes(direction)) delete button.dataset.active;
        this.emit();
      };
      const context = event => event.preventDefault();

      button.addEventListener("pointerdown", start, { passive: false });
      button.addEventListener("pointerup", stop, { passive: false });
      button.addEventListener("pointercancel", stop, { passive: false });
      button.addEventListener("lostpointercapture", stop, { passive: false });
      button.addEventListener("contextmenu", context);
      this.listeners.push([button, "pointerdown", start], [button, "pointerup", stop], [button, "pointercancel", stop], [button, "lostpointercapture", stop], [button, "contextmenu", context]);
    });

    const clear = () => this.reset();
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    this.listeners.push([window, "blur", clear], [document, "visibilitychange", clear]);
    this.emit();
  }

  vector() {
    let moveX = 0;
    let moveZ = 0;
    for (const direction of this.active.values()) {
      if (direction === "left") moveX -= 1;
      if (direction === "right") moveX += 1;
      if (direction === "up") moveZ -= 1;
      if (direction === "down") moveZ += 1;
    }
    return {
      moveX: Math.max(-1, Math.min(1, moveX)),
      moveZ: Math.max(-1, Math.min(1, moveZ))
    };
  }

  emit() {
    this.onIntent(this.vector());
  }

  reset() {
    this.active.clear();
    this.buttons.forEach(button => delete button.dataset.active);
    this.emit();
  }

  dispose() {
    this.reset();
    this.listeners.forEach(([target, type, listener]) => target.removeEventListener(type, listener));
    this.listeners = [];
  }
}
