(function (global) {
  'use strict';

  const VERSION = '1.0.0';
  const profiles = Object.create(null);
  const normalizeId = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const sleep = (ms) => new Promise((resolve) => global.setTimeout(resolve, Math.max(0, Number(ms) || 0)));

  const DEFAULT_TIMING = Object.freeze({
    approach: 650,
    aim: 350,
    releaseHold: 250,
    projectile: 560,
    hitProjectile: 470,
    bounce: 300,
    impactPause: 100,
    roll: 940,
    equip: 260,
    return: 620,
  });

  function normalizeProfile(input = {}) {
    const timings = { ...DEFAULT_TIMING, ...(input.timings || {}) };
    return {
      id: normalizeId(input.id || input.skillId || input.sourceId),
      type: normalizeId(input.type || 'thrown_projectile'),
      projectileAsset: String(input.projectileAsset || ''),
      projectileSize: Math.max(8, numberOr(input.projectileSize, 54)),
      originAnchor: { x: numberOr(input.originAnchor?.x, 0.58), y: numberOr(input.originAnchor?.y, 0.58) },
      targetAnchor: { x: numberOr(input.targetAnchor?.x, 0.5), y: numberOr(input.targetAnchor?.y, 0.52) },
      groundAnchor: { x: numberOr(input.groundAnchor?.x, 0.56), y: numberOr(input.groundAnchor?.y, 0.86) },
      groundOffsetOnHit: { x: numberOr(input.groundOffsetOnHit?.x, 22), y: numberOr(input.groundOffsetOnHit?.y, 0) },
      approach: {
        enabled: input.approach?.enabled !== false,
        actorLeft: input.approach?.actorLeft ?? '45%',
        actorTop: input.approach?.actorTop ?? '92px',
      },
      releaseSprite: input.releaseSprite || null,
      postActionSprite: input.postActionSprite || null,
      holdingSprite: input.holdingSprite || null,
      returnToOrigin: input.returnToOrigin !== false,
      resumeHover: input.resumeHover !== false,
      hover: {
        distance: numberOr(input.hover?.distance, 7),
        duration: Math.max(200, numberOr(input.hover?.duration, 1300)),
      },
      arc: numberOr(input.arc, 74),
      hitArc: numberOr(input.hitArc, 58),
      spin: numberOr(input.spin, 300),
      hitSpin: numberOr(input.hitSpin, 270),
      rollDistance: numberOr(input.rollDistance, 150),
      rollRotation: numberOr(input.rollRotation, 520),
      timings,
      metadata: clone(input.metadata || {}),
    };
  }

  function registerProfile(skillId, profile = {}) {
    const id = normalizeId(skillId || profile.id || profile.skillId);
    if (!id) throw new Error('THROWN_PROJECTILE_PROFILE_ID_REQUIRED');
    const normalized = normalizeProfile({ ...profile, id });
    profiles[id] = Object.freeze(normalized);
    return clone(profiles[id]);
  }

  function getProfile(skillId) {
    const profile = profiles[normalizeId(skillId)];
    return profile ? clone(profile) : null;
  }

  function listProfiles() { return Object.values(profiles).map(clone); }

  function buildSequencePlan(outcome, profileInput = {}) {
    const profile = normalizeProfile(profileInput);
    const success = outcome === true || normalizeId(outcome) === 'success' || normalizeId(outcome) === 'save_success';
    const phases = ['capture_origin'];
    if (profile.approach.enabled) phases.push('approach');
    phases.push('release', 'projectile_from_actor');
    if (success) phases.push('miss_to_ground');
    else phases.push('hit_target', 'bounce_to_ground');
    phases.push('roll', 'vanish');
    if (profile.postActionSprite) phases.push('equip_post_action');
    if (profile.returnToOrigin) phases.push('return_to_origin');
    if (profile.resumeHover) phases.push('resume_hover');
    return { outcome: success ? 'save_success' : 'save_failure', phases, profile };
  }

  function ensureStyle(doc = global.document) {
    if (!doc?.head || doc.getElementById('luminous-thrown-projectile-sequence-style')) return false;
    const style = doc.createElement('style');
    style.id = 'luminous-thrown-projectile-sequence-style';
    style.textContent = [
      '.luminous-flying-hover{animation:luminousFlyingHover var(--luminous-hover-duration,1300ms) ease-in-out infinite alternate;}',
      '@keyframes luminousFlyingHover{from{transform:translateY(calc(var(--luminous-hover-distance,7px) * -0.55));}to{transform:translateY(var(--luminous-hover-distance,7px));}}',
      '.luminous-thrown-projectile{position:absolute;z-index:1800;pointer-events:none;object-fit:contain;transform-origin:center;}',
      '.luminous-thrown-impact{position:absolute;z-index:1799;pointer-events:none;border-radius:50%;background:radial-gradient(ellipse,rgba(215,184,108,.65),rgba(215,184,108,.08) 55%,transparent 70%);opacity:0;}',
      '.luminous-thrown-impact.active{animation:luminousThrownImpact .42s ease-out;}',
      '@keyframes luminousThrownImpact{0%{opacity:0;transform:scale(.2)}25%{opacity:1}100%{opacity:0;transform:scale(1.7)}}'
    ].join('');
    doc.head.appendChild(style);
    return true;
  }

  function elementPoint(stage, element, anchor = {}) {
    const sr = stage.getBoundingClientRect();
    const er = element.getBoundingClientRect();
    return {
      x: er.left - sr.left + er.width * numberOr(anchor.x, 0.5),
      y: er.top - sr.top + er.height * numberOr(anchor.y, 0.5),
    };
  }

  function resolveStage(options = {}) {
    const doc = options.document || global.document;
    return options.stage || doc?.getElementById?.('battlefield') || doc?.getElementById?.('game-container') || null;
  }

  function resolveActorElement(actorId, options = {}) {
    const doc = options.document || global.document;
    return options.actorElement || doc?.getElementById?.(`anchor-${actorId}`)?.closest?.('.sprite-container') || doc?.getElementById?.(`anchor-${actorId}`) || null;
  }

  function resolveActorSprite(actorId, actorElement, options = {}) {
    const doc = options.document || global.document;
    return options.actorSprite || doc?.getElementById?.(`anchor-${actorId}`)?.querySelector?.('.sprite-img') || actorElement?.querySelector?.('.sprite-img') || null;
  }

  function resolveTargetElement(targetId, options = {}) {
    const doc = options.document || global.document;
    return options.targetElement || doc?.getElementById?.(`anchor-${targetId}`)?.closest?.('.sprite-container') || doc?.getElementById?.(`anchor-${targetId}`) || null;
  }

  function setHover(element, enabled, profileInput = {}) {
    if (!element?.classList) return false;
    const profile = normalizeProfile(profileInput);
    element.style?.setProperty?.('--luminous-hover-distance', `${profile.hover.distance}px`);
    element.style?.setProperty?.('--luminous-hover-duration', `${profile.hover.duration}ms`);
    element.classList.toggle('luminous-flying-hover', Boolean(enabled));
    return true;
  }

  function createProjectile(stage, profile, doc) {
    const img = doc.createElement('img');
    img.className = 'luminous-thrown-projectile';
    img.src = profile.projectileAsset;
    img.alt = '';
    img.style.width = `${profile.projectileSize}px`;
    img.style.height = `${profile.projectileSize}px`;
    stage.appendChild(img);
    return img;
  }

  function createImpact(stage, doc) {
    const impact = doc.createElement('div');
    impact.className = 'luminous-thrown-impact';
    impact.style.width = '110px';
    impact.style.height = '42px';
    stage.appendChild(impact);
    return impact;
  }

  function place(element, point, width = 0, height = 0) {
    element.style.left = `${point.x - width / 2}px`;
    element.style.top = `${point.y - height / 2}px`;
  }

  async function animateFlight(projectile, from, to, options = {}) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const arc = numberOr(options.arc, 70);
    const spin = numberOr(options.spin, 240);
    const animation = projectile.animate([
      { transform: 'translate(0px,0px) rotate(0deg) scale(.9)', offset: 0 },
      { transform: `translate(${dx * .48}px,${dy * .42 - arc}px) rotate(${spin * .45}deg) scale(1)`, offset: .48 },
      { transform: `translate(${dx}px,${dy}px) rotate(${spin}deg) scale(1.06)`, offset: 1 },
    ], { duration: Math.max(1, Number(options.duration) || 1), easing: 'cubic-bezier(.32,.03,.68,.98)', fill: 'forwards' });
    await animation.finished;
  }

  async function animateBounce(projectile, from, to, duration) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const animation = projectile.animate([
      { transform: 'translate(0,0) rotate(0deg)', offset: 0 },
      { transform: `translate(${dx * .5}px,${dy * .15 - 36}px) rotate(120deg)`, offset: .45 },
      { transform: `translate(${dx}px,${dy}px) rotate(240deg)`, offset: 1 },
    ], { duration: Math.max(1, Number(duration) || 1), easing: 'cubic-bezier(.25,.7,.45,1)', fill: 'forwards' });
    await animation.finished;
  }

  async function animateRoll(projectile, profile) {
    const animation = projectile.animate([
      { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate(${profile.rollDistance * .72}px,4px) rotate(${profile.rollRotation * .72}deg) scale(.88)`, opacity: 1, offset: .72 },
      { transform: `translate(${profile.rollDistance}px,6px) rotate(${profile.rollRotation}deg) scale(.78)`, opacity: 0 },
    ], { duration: profile.timings.roll, easing: 'ease-out', fill: 'forwards' });
    await animation.finished;
  }

  function flashImpact(impact, point) {
    place(impact, point, 110, 42);
    impact.classList.remove('active');
    void impact.offsetWidth;
    impact.classList.add('active');
  }

  function spriteFor(profile, key, options = {}) {
    const override = options.sprites?.[key];
    if (override) return override;
    return profile[key] || null;
  }

  async function play(input = {}) {
    const profile = normalizeProfile(input.profile || getProfile(input.skillId) || {});
    if (!profile.projectileAsset) return { played: false, reason: 'projectile_asset_required' };
    const doc = input.document || global.document;
    const stage = resolveStage(input);
    const actorId = String(input.actorId || input.actor?.id || input.actor?.unitId || '');
    const targetId = String(input.targetId || input.target?.id || input.target?.unitId || '');
    const actorElement = resolveActorElement(actorId, input);
    const actorSprite = resolveActorSprite(actorId, actorElement, input);
    const targetElement = resolveTargetElement(targetId, input);
    if (!doc || !stage || !actorElement || !targetElement) return { played: false, reason: 'sequence_elements_missing' };
    ensureStyle(doc);

    const success = input.saveSuccess === true || normalizeId(input.outcome) === 'save_success' || normalizeId(input.outcome) === 'success';
    const plan = buildSequencePlan(success, profile);
    const projectile = createProjectile(stage, profile, doc);
    const impact = createImpact(stage, doc);
    const original = {
      left: actorElement.style.left,
      top: actorElement.style.top,
      bottom: actorElement.style.bottom,
      transform: actorElement.style.transform,
      sprite: actorSprite?.getAttribute?.('src') || null,
    };

    try {
      setHover(actorElement, false, profile);
      if (profile.approach.enabled) {
        actorElement.style.left = profile.approach.actorLeft;
        actorElement.style.top = profile.approach.actorTop;
        await sleep(profile.timings.approach);
      }
      await sleep(profile.timings.aim);

      const from = elementPoint(stage, actorElement, profile.originAnchor);
      place(projectile, from, profile.projectileSize, profile.projectileSize);
      const releaseSprite = spriteFor(profile, 'releaseSprite', input);
      if (actorSprite && releaseSprite) actorSprite.src = releaseSprite;
      input.onRelease?.({ profile, actorElement, actorSprite, projectile });
      await sleep(profile.timings.releaseHold);

      const targetPoint = elementPoint(stage, targetElement, profile.targetAnchor);
      const ground = elementPoint(stage, targetElement, profile.groundAnchor);
      let rollOrigin = ground;

      if (success) {
        await animateFlight(projectile, from, ground, { duration: profile.timings.projectile, arc: profile.arc, spin: profile.spin });
        flashImpact(impact, ground);
      } else {
        await animateFlight(projectile, from, targetPoint, { duration: profile.timings.hitProjectile, arc: profile.hitArc, spin: profile.hitSpin });
        flashImpact(impact, targetPoint);
        input.onHit?.({ profile, targetElement, targetPoint });
        await sleep(profile.timings.impactPause);
        rollOrigin = { x: ground.x + profile.groundOffsetOnHit.x, y: ground.y + profile.groundOffsetOnHit.y };
        place(projectile, targetPoint, profile.projectileSize, profile.projectileSize);
        await animateBounce(projectile, targetPoint, rollOrigin, profile.timings.bounce);
        flashImpact(impact, rollOrigin);
      }

      input.onGround?.({ profile, point: rollOrigin });
      await sleep(profile.timings.impactPause);
      place(projectile, rollOrigin, profile.projectileSize, profile.projectileSize);
      await animateRoll(projectile, profile);
      projectile.remove();

      const postSprite = spriteFor(profile, 'postActionSprite', input);
      if (actorSprite && postSprite) actorSprite.src = postSprite;
      await sleep(profile.timings.equip);

      if (profile.returnToOrigin) {
        actorElement.style.left = original.left;
        actorElement.style.top = original.top;
        actorElement.style.bottom = original.bottom;
        actorElement.style.transform = original.transform;
        await sleep(profile.timings.return);
      }
      if (profile.resumeHover) setHover(actorElement, true, profile);
      input.onEnd?.({ profile, plan, actorElement, actorSprite });
      return { played: true, outcome: plan.outcome, phases: plan.phases };
    } finally {
      projectile.remove?.();
      impact.remove?.();
    }
  }

  function saveOutcomeFromResult(result = {}, targetId) {
    const rows = result?.resolution?.results || result?.results || [];
    const row = rows.find((entry) => !targetId || String(entry?.targetId || '') === String(targetId)) || rows[0];
    if (!row) return null;
    return row?.result?.isSuccess === true;
  }

  function playForCombatResult(input = {}) {
    const action = input.action || input.result?.action || {};
    const skillId = input.skillId || action.source?.id || action.metadata?.sourceDefinition?.id;
    const profile = input.profile || getProfile(skillId);
    if (!profile) return Promise.resolve({ played: false, reason: 'sequence_profile_missing' });
    const targetId = input.targetId || action.targeting?.mainTargetId || action.targeting?.targetIds?.[0];
    const saveSuccess = input.saveSuccess ?? saveOutcomeFromResult(input.result || {}, targetId);
    return play({ ...input, profile, skillId, actorId: input.actorId || action.actorId, targetId, saveSuccess });
  }

  const api = Object.freeze({
    version: VERSION,
    DEFAULT_TIMING,
    normalizeProfile,
    registerProfile,
    getProfile,
    listProfiles,
    buildSequencePlan,
    ensureStyle,
    elementPoint,
    setHover,
    play,
    playForCombatResult,
    saveOutcomeFromResult,
  });

  global.LuminousThrownProjectileSequenceRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
