/* Keep browser image menus out of game surfaces; keep text editing and game hooks. */
(function (global) {
  'use strict';
  if (global.LimbusGameInteractions) return;
  const doc = global.document;
  doc.documentElement.classList.add('limbus-game-interactions');

  function pathFor(event) {
    if (typeof event.composedPath === 'function') return event.composedPath();
    const path = [];
    for (let node = event.target; node; node = node.parentNode) path.push(node);
    return path;
  }
  function nativeContext(path) {
    let editable = false, resolved = false;
    for (const node of path) {
      if (node?.nodeType !== 1) continue;
      if (node.matches('input,textarea,select,[data-native-contextmenu="true"]')) return true;
      if (!resolved && node.hasAttribute('contenteditable')) {
        const value = node.getAttribute('contenteditable').toLowerCase();
        if (['', 'true', 'plaintext-only', 'false'].includes(value)) {
          resolved = true;
          editable = value !== 'false';
        }
      }
    }
    return editable;
  }
  doc.addEventListener('contextmenu', event => {
    if (!nativeContext(pathFor(event))) event.preventDefault();
    // Bubble after target handlers so game actions run before the native menu
    // is cancelled. Never stop propagation or intercept pointer/touch events.
  });
  doc.addEventListener('dragstart', event => {
    const path = pathFor(event);
    const gameDrag = path.some(node => node?.getAttribute?.('draggable')?.toLowerCase() === 'true');
    if (!nativeContext(path) && !gameDrag) event.preventDefault();
  });
  global.LimbusGameInteractions = Object.freeze({ version: 1 });
})(window);
