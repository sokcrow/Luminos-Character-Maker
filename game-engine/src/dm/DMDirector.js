export class DMDirector {
  constructor(engine) {
    this.engine = engine;
  }

  inspectPlayer() {
    const player = this.engine.session.player;
    const items = this.engine.bridge("luminous-items");
    return {
      player,
      inventory: player && items?.available ? items.snapshot(player) : null,
      worldSpace: this.engine.session.worldSpace || null,
      combatMovement: this.engine.session.combatMovement?.snapshot?.() || null,
      engine: this.engine.metrics()
    };
  }

  setPlayerFlag(key, value) {
    const player = this.engine.session.player;
    if (!player) return { ok: false, reason: "no_player" };
    player.flags ||= {};
    player.flags[String(key)] = value;
    const result = { ok: true, key: String(key), value };
    this.engine.events.emit("dm:player-flag", result);
    return result;
  }

  emit(type, detail = {}) {
    this.engine.events.emit(String(type), detail);
    return { ok: true, type: String(type) };
  }

  execute(command = {}) {
    const type = String(command.type || "").trim();
    if (type === "inspect_player") return this.inspectPlayer();
    if (type === "set_player_flag") return this.setPlayerFlag(command.key, command.value);
    if (type === "emit") return this.emit(command.event, command.detail);
    return { ok: false, reason: "unknown_dm_command", type };
  }
}
