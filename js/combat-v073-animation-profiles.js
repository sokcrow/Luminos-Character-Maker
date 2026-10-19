/* Original presentation recipes. No combat formulas, remote assets or RNG. */
(function(global){
  'use strict';
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  const profiles=freeze({
    slash:{id:'slash',shape:'slash',color:'#f6ca87',accent:'#fff1cf',sound:'steel',travel:0,impact:260,kick:1,priority:1},
    pierce:{id:'pierce',shape:'pierce',color:'#eecbb5',accent:'#fff4dc',sound:'pierce',travel:0,impact:230,kick:1,priority:1},
    blunt:{id:'blunt',shape:'burst',color:'#edab73',accent:'#ffdf9a',sound:'thud',travel:0,impact:300,kick:2,priority:2},
    projectile:{id:'projectile',shape:'pierce',color:'#deb57b',accent:'#fff1cf',sound:'pierce',travel:170,impact:230,kick:1,priority:1},
    arcane:{id:'arcane',shape:'sigil',color:'#b7a1f2',accent:'#f1d9ff',sound:'magic',travel:180,impact:300,kick:1,priority:2},
    fire_bolt:{id:'fire_bolt',shape:'flame',color:'#ff9255',accent:'#ffec9c',sound:'fire',travel:190,impact:320,kick:2,priority:3,cutin:true},
    ray_of_frost:{id:'ray_of_frost',shape:'frost',color:'#8ed6ec',accent:'#e5fbff',sound:'frost',travel:160,impact:300,kick:1,priority:3,cutin:true},
    eldritch_blast:{id:'eldritch_blast',shape:'sigil',color:'#aeb4ff',accent:'#e9e2ff',sound:'magic',travel:180,impact:310,kick:2,priority:3,cutin:true},
    sacred_flame:{id:'sacred_flame',shape:'sigil',color:'#f3d884',accent:'#fff9d9',sound:'magic',travel:0,impact:340,kick:1,priority:3,cutin:true},
    healing:{id:'healing',shape:'heal',color:'#8cdbc0',accent:'#e0fff1',sound:'heal',travel:0,impact:380,kick:0,priority:1},
    guard:{id:'guard',shape:'guard',color:'#91d8e7',accent:'#e2faff',sound:'guard',travel:0,impact:310,kick:0,priority:2},
    evade:{id:'evade',shape:'evade',color:'#bbe3df',accent:'#f1fffa',sound:'evade',travel:0,impact:220,kick:0,priority:1},
    counter:{id:'counter',shape:'slash',color:'#f09693',accent:'#ffe5bd',sound:'steel',travel:0,impact:280,kick:2,priority:2},
  });
  const aliases=freeze({fire_bolt:'fire_bolt',ray_of_frost:'ray_of_frost',eldritch_blast:'eldritch_blast',sacred_flame:'sacred_flame',magic_missile:'arcane',cure_wounds:'healing',healing_word:'healing'});
  const normalize=value=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  function resolve(entry){
    const plan=entry?.plan||{},d=plan.data||{},id=normalize(d.skillId||d.id||plan.skillId),defense=normalize(d.defenseType||d.defenseKind);
    if(profiles[defense])return profiles[defense];
    if(aliases[id])return profiles[aliases[id]];
    if(d.healing||d.heal||normalize(d.kind)==='heal'||normalize(d.targetType)==='heal')return profiles.healing;
    if(/spell/.test(`${plan.type||''} ${d.kind||''}`.toLowerCase()))return profiles.arcane;
    if(d.isRanged===true||d.range===true||/^(range|ranged|distance)$/.test(String(d.rangeType||d.range||'').toLowerCase()))return profiles.projectile;
    const damage=normalize(d.damageType);
    if(/pierce|perfor/.test(damage))return profiles.pierce;
    if(/blunt|contund/.test(damage))return profiles.blunt;
    return profiles.slash;
  }
  global.LuminousCombatAnimationProfiles073=Object.freeze({version:1,profiles,aliases,resolve,normalize});
})(typeof window==='undefined'?globalThis:window);
