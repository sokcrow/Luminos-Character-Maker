export class EventBus {
  #listeners = new Map();

  on(type, handler) {
    if (!type || typeof handler !== "function") return () => {};
    const set = this.#listeners.get(type) || new Set();
    set.add(handler);
    this.#listeners.set(type, set);
    return () => this.off(type, handler);
  }

  once(type, handler) {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(type, handler) {
    const set = this.#listeners.get(type);
    if (!set) return false;
    const removed = set.delete(handler);
    if (!set.size) this.#listeners.delete(type);
    return removed;
  }

  emit(type, payload) {
    const set = this.#listeners.get(type);
    if (!set) return 0;
    let count = 0;
    for (const handler of [...set]) {
      handler(payload);
      count += 1;
    }
    return count;
  }

  clear() {
    this.#listeners.clear();
  }
}
