(function (global) {
  'use strict';

  const ROCK_ASSET = 'https://imgur.com/P4J48yc.png';
  const HOLDING_ROCK = 'https://imgur.com/529fa4E.png';
  const WITHOUT_ROCK = 'https://imgur.com/zmA1FPz.png';
  const DAGGER = 'https://imgur.com/evsrs1B.png';

  function runtime() {
    return global.LuminousThrownProjectileSequenceRuntime
      || (typeof require === 'function' ? (() => { try { return require('./thrown-projectile-sequence-runtime.js'); } catch (_) { return null; } })() : null);
  }

  function install() {
    const api = runtime();
    if (!api?.registerProfile) return false;
    api.registerProfile('winged_kobold_falling_rock', {
      type: 'thrown_projectile',
      projectileAsset: ROCK_ASSET,
      projectileSize: 54,
      originAnchor: { x: 0.58, y: 0.58 },
      targetAnchor: { x: 0.50, y: 0.52 },
      groundAnchor: { x: 0.56, y: 0.86 },
      groundOffsetOnHit: { x: 22, y: 0 },
      approach: { enabled: true, actorLeft: '45%', actorTop: '92px' },
      holdingSprite: HOLDING_ROCK,
      releaseSprite: WITHOUT_ROCK,
      postActionSprite: DAGGER,
      returnToOrigin: true,
      resumeHover: true,
      hover: { distance: 7, duration: 1300 },
      arc: 74,
      hitArc: 58,
      spin: 300,
      hitSpin: 270,
      rollDistance: 150,
      rollRotation: 520,
      timings: {
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
      },
      metadata: {
        approvedSequence: true,
        saveSuccess: 'miss_ground_roll_vanish',
        saveFailure: 'hit_bounce_ground_roll_vanish',
        postAction: 'equip_dagger_return_hover',
      },
    });
    return true;
  }

  const api = Object.freeze({
    version: '1.0.0',
    FALLING_ROCK_SKILL_ID: 'winged_kobold_falling_rock',
    assets: Object.freeze({ rock: ROCK_ASSET, holdingRock: HOLDING_ROCK, withoutRock: WITHOUT_ROCK, dagger: DAGGER }),
    install,
  });

  global.LuminousKoboldThrownProjectileProfiles = api;
  install();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
