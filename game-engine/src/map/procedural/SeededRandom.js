function hashSeed(value) {
  const text = String(value ?? "0");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class SeededRandom {
  constructor(seed = 0) {
    this.seed = String(seed ?? 0);
    this.state = hashSeed(this.seed) || 0x6d2b79f5;
  }

  next() {
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  range(min = 0, max = 1) {
    const lo = Number(min) || 0;
    const hi = Number(max) || 0;
    return lo + (hi - lo) * this.next();
  }

  integer(min = 0, max = 1) {
    const lo = Math.ceil(Math.min(Number(min) || 0, Number(max) || 0));
    const hi = Math.floor(Math.max(Number(min) || 0, Number(max) || 0));
    return lo + Math.floor(this.next() * Math.max(1, hi - lo + 1));
  }

  fork(label) {
    return new SeededRandom(`${this.seed}:${String(label ?? "fork")}`);
  }
}

export function seededUnit(seed, x = 0, z = 0) {
  return new SeededRandom(`${String(seed ?? 0)}:${Math.trunc(x)}:${Math.trunc(z)}`).next();
}
