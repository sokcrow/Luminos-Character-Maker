/* A shared, measured area for contextual player alerts. */
(function (global) {
  'use strict';
  const doc = global.document;
  if (!doc || global.LuminousPlayerContextualDock) return;
  const dock = doc.createElement('aside');
  dock.id = 'player-contextual-dock';
  dock.setAttribute('aria-label', 'Oportunidades disponibles');
  dock.hidden = true;
  const style = doc.createElement('style');
  style.textContent = `
#player-contextual-dock{position:fixed;z-index:11000;max-width:calc(100vw - 24px);display:flex;gap:8px;box-sizing:border-box;pointer-events:auto}
#player-contextual-dock[hidden]{display:none!important}
#player-contextual-dock button{min-height:48px;min-width:48px;max-width:100%;display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #d7b257;border-radius:12px;background:#17120bec;color:#f7e4b7;font:700 14px system-ui;cursor:pointer;box-shadow:0 0 12px #bb8b3444}
#player-contextual-dock button:focus-visible{outline:3px solid #fff;outline-offset:3px}
#player-contextual-dock button img{width:28px!important;height:28px!important;object-fit:contain}
@media(prefers-reduced-motion:no-preference){#player-contextual-dock button.available{animation:player-loot-glow 2.4s ease-in-out infinite}@keyframes player-loot-glow{50%{box-shadow:0 0 20px #d7b25788}}}
@media(max-width:600px),(max-height:480px){#player-contextual-dock button{padding:6px 10px}}
`;
  doc.head.appendChild(style); doc.body.appendChild(dock);
  const blockers = '#system-loading-overlay,.hud-sidebar-right.is-open,.hud-modal,.inventory-modal,[role="dialog"],#modal-escritura-teatro,#postcombat-loot-modal,#creature-compendium,#shop-modal,#tienda-overlay,.sheet-phone-wrapper:not(.phone-hidden),[aria-modal="true"]';
  const obstacles = '.hud-sidebar-right,#player-combat-hud,#theatre-log-container,#theatre-dialogue-box,#theatre-dialogue-container,#btn-shop-notifier,#player-mobile-entry-gate,#player-mobile-standby,[data-player-dock-obstacle]';
  let frame = null;
  const visible = node => { const css = global.getComputedStyle(node); return !node.hidden && css.display !== 'none' && css.visibility !== 'hidden' && Number(css.opacity) !== 0 && node.getClientRects().length > 0; };
  const overlaps = (a,b) => a.left < b.right+10 && a.right+10 > b.left && a.top < b.bottom+10 && a.bottom+10 > b.top;
  function layout() {
    frame = null;
    const available = [...dock.children].some(node => node.classList.contains('available'));
    const blocked = [...doc.querySelectorAll(blockers)].some(node => !dock.contains(node) && visible(node));
    if (!available || blocked) { if (!dock.hidden) dock.hidden = true; return false; }
    dock.hidden = false;
    const vv = global.visualViewport;
    const left = (vv?.offsetLeft || 0)+12, top = (vv?.offsetTop || 0)+12;
    const width = vv?.width || global.innerWidth, height = vv?.height || global.innerHeight;
    const size = dock.getBoundingClientRect();
    // Read safe-area insets using a probe, then test all four reserved corners.
    const safe = global.getComputedStyle(probe);
    const l=left+parseFloat(safe.paddingLeft), t=top+parseFloat(safe.paddingTop);
    const r=left+width-24-parseFloat(safe.paddingRight)-size.width;
    const b=top+height-24-parseFloat(safe.paddingBottom)-size.height;
    const rects = [...doc.querySelectorAll(obstacles)].filter(visible).map(n => n.getBoundingClientRect());
    const point = [[r,b],[l,b],[l,t],[r,t]].find(([x,y]) => x>=l && y>=t && !rects.some(rect => overlaps({left:x,top:y,right:x+size.width,bottom:y+size.height},rect)));
    if (!point) { dock.hidden = true; return false; }
    const x = `${point[0]}px`, y = `${point[1]}px`;
    if (dock.style.left !== x) dock.style.left=x;
    if (dock.style.top !== y) dock.style.top=y;
    return true;
  }
  const probe = doc.createElement('div');
  probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  doc.body.appendChild(probe);
  function schedule() { if (frame === null) frame = global.requestAnimationFrame(layout); }
  new MutationObserver(records => {
    const relevant = node => node?.nodeType === 1 && (node.matches(`${blockers},${obstacles}`) || node === doc.body);
    if(records.some(r => !dock.contains(r.target) && r.target !== dock &&
      (relevant(r.target) || [...r.addedNodes].some(relevant) || [...r.removedNodes].some(relevant)))) schedule();
  }).observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden','open']});
  // Availability changes on a dock button also need a layout pass.
  new MutationObserver(schedule).observe(dock,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  global.addEventListener('resize',schedule,{passive:true});
  global.addEventListener('orientationchange',schedule,{passive:true});
  global.visualViewport?.addEventListener('resize',schedule,{passive:true});
  global.visualViewport?.addEventListener('scroll',schedule,{passive:true});
  doc.addEventListener('transitionend',schedule,true);
  global.LuminousPlayerContextualDock = Object.freeze({mount(button){dock.appendChild(button);schedule();return dock;},refresh:schedule,layout});
})(window);
