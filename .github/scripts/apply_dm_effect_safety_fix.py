from pathlib import Path

def rep(text, old, new, label):
    if old not in text: raise SystemExit('missing '+label)
    return text.replace(old,new,1)

p=Path('js/dm-managed-effect-engine.js'); t=p.read_text(encoding='utf-8')
old='''  function render() {
    const panel = ensurePanel();
    if (!panel) return;
    const now = Date.now();
    const active = Object.values(state.effects || {}).filter((effect) => isActive(effect, now));
    panel.innerHTML = `<h4 style="margin:0 0 8px;color:#d4ad58;">EFECTOS ACTIVOS PARA DM (${active.length})</h4>`;
    if (!active.length) {
      panel.insertAdjacentHTML("beforeend", '<div style="opacity:.65;">Sin efectos temporales activos.</div>');
      return;
    }
    active.sort((a, b) => Number(a.expiresAt || 0) - Number(b.expiresAt || 0));
    active.forEach((effect) => {
      const card = global.document.createElement("div");
      card.style.cssText = "border-top:1px solid #29313a;padding:8px 0;";
      const modifier = Number(effect.modifier?.value || 0) || 0;
      card.innerHTML = `<div style="color:#fff;font-weight:700;">${effect.name || effect.effectId || "Effect"}</div><div>${effect.subjectName || effect.subjectPlayerId || "Player"} → ${effect.targetName || effect.targetId || "Target"}</div><div style="color:#e6c56c;">Tiempo restante: ${formatRemaining(effect, now)}</div><div style="font-size:11px;opacity:.8;margin-top:4px;">${effect.note || ""}</div><div style="font-size:11px;margin-top:4px;">CHA Check · bono configurado: +${modifier} Check Power</div>`;
      const controls = global.document.createElement("div");'''
new='''  function appendTextLine(parent, text, style = "") {
    const line = global.document.createElement("div");
    if (style) line.style.cssText = style;
    line.textContent = String(text ?? "");
    parent.appendChild(line);
    return line;
  }

  function render() {
    const panel = ensurePanel();
    if (!panel) return;
    const now = Date.now();
    const active = Object.values(state.effects || {}).filter((effect) => isActive(effect, now));
    panel.replaceChildren();
    const heading = global.document.createElement("h4");
    heading.style.cssText = "margin:0 0 8px;color:#d4ad58;";
    heading.textContent = `EFECTOS ACTIVOS PARA DM (${active.length})`;
    panel.appendChild(heading);
    if (!active.length) {
      appendTextLine(panel, "Sin efectos temporales activos.", "opacity:.65;");
      return;
    }
    active.sort((a, b) => Number(a.expiresAt || 0) - Number(b.expiresAt || 0));
    active.forEach((effect) => {
      const card = global.document.createElement("div");
      card.style.cssText = "border-top:1px solid #29313a;padding:8px 0;";
      const modifier = Number(effect.modifier?.value || 0) || 0;
      appendTextLine(card, effect.name || effect.effectId || "Effect", "color:#fff;font-weight:700;");
      appendTextLine(card, `${effect.subjectName || effect.subjectPlayerId || "Player"} → ${effect.targetName || effect.targetId || "Target"}`);
      appendTextLine(card, `Tiempo restante: ${formatRemaining(effect, now)}`, "color:#e6c56c;");
      appendTextLine(card, effect.note || "", "font-size:11px;opacity:.8;margin-top:4px;");
      appendTextLine(card, `CHA Check · bono configurado: +${modifier} Check Power`, "font-size:11px;margin-top:4px;");
      const controls = global.document.createElement("div");'''
t=rep(t,old,new,'render')
p.write_text(t,encoding='utf-8')

p=Path('js/player-trait-runtime.js'); t=p.read_text(encoding='utf-8')
t=rep(t,'''    const record = { id: ref.key, effectId: descriptor.effectId || descriptor.sourceTraitId || "dm_effect", name: descriptor.name || "DM Managed Effect", sourceTraitId: descriptor.sourceTraitId || null, subjectPlayerId: state.playerId || null, subjectName: character?.characterName || character?.nombre || character?.name || state.playerId || "Player", targetId: descriptor.targetId || target?.id || target?.actorId || target?.characterId || null, targetName: descriptor.targetName || target?.name || target?.nombre || target?.characterName || "Target", check: { ...(descriptor.check || {}) }, modifier: { ...(descriptor.modifier || {}) }, note: descriptor.note || "", active: true, approved: false, startsAt: now, expiresAt: now + Math.round(hours * 3600000), durationHours: hours };
    ref.set(record).catch((error) => console.error("No se pudo registrar el efecto administrado por DM:", error));''','''    const subjectUid = currentAuthUid();
    if (!subjectUid) return null;
    const record = { id: ref.key, effectId: descriptor.effectId || descriptor.sourceTraitId || "dm_effect", name: descriptor.name || "DM Managed Effect", sourceTraitId: descriptor.sourceTraitId || null, subjectUid, subjectPlayerId: state.playerId || null, subjectName: character?.characterName || character?.nombre || character?.name || state.playerId || "Player", targetId: descriptor.targetId || target?.id || target?.actorId || target?.characterId || null, targetName: descriptor.targetName || target?.name || target?.nombre || target?.characterName || "Target", check: { ...(descriptor.check || {}) }, modifier: { ...(descriptor.modifier || {}) }, note: descriptor.note || "", active: true, approved: false, startsAt: now, expiresAt: now + Math.round(hours * 3600000), durationHours: hours };
    ref.set(record).catch((error) => console.error("No se pudo registrar el efecto administrado por DM:", error));''','subject uid')
t=rep(t,'''      if (!effect || effect.active === false || effect.approved !== true) return;
      if (Number(effect.expiresAt || 0) && Number(effect.expiresAt) <= now) return;''','''      if (!effect || effect.active === false || effect.approved !== true || effect.consumedAt) return;
      if (Number(effect.expiresAt || 0) && Number(effect.expiresAt) <= now) return;''','consumed guard')
t=rep(t,'''      if (state.db && effect.id) state.db.ref(`${DM_MANAGED_EFFECTS_ROOT}/${effect.id}`).update({ approved: false, lastConsumedAt: now }).catch(() => {});''','''      if (state.db && effect.id) state.db.ref(`${DM_MANAGED_EFFECTS_ROOT}/${effect.id}/consumedAt`).set(now).catch(() => {});''','consume write')
p.write_text(t,encoding='utf-8')
print('DM effect safety fix applied')