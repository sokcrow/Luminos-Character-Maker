(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttDmMapLazyLoader = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';

  function resolveMapFrame(documentRef = browserRoot?.document) {
    const section = documentRef?.getElementById?.('modulo-mapa');
    const frame = section?.querySelector?.('iframe[data-vtt-src]');
    return { section, frame };
  }

  function ensureLoaded(documentRef = browserRoot?.document) {
    const { section, frame } = resolveMapFrame(documentRef);
    if (!section || !frame || !section.classList?.contains?.('active-module')) return false;
    if (frame.getAttribute?.('src')) return true;

    const src = String(frame.dataset?.vttSrc || frame.getAttribute?.('data-vtt-src') || '').trim();
    if (!src) return false;
    frame.setAttribute?.('src', src);
    return true;
  }

  function ensureUnloaded(documentRef = browserRoot?.document) {
    const { section, frame } = resolveMapFrame(documentRef);
    if (!section || !frame || section.classList?.contains?.('active-module')) return false;
    if (!frame.getAttribute?.('src')) return false;

    // Navigating an iframe with its src removed tears down the VTT document.
    // That gives vtt/main.js a real unload lifecycle so its animation loop,
    // Firebase subscriptions and bridges cannot keep running behind Theatre.
    frame.removeAttribute?.('src');
    return !frame.getAttribute?.('src');
  }

  function sync(documentRef = browserRoot?.document) {
    const { section } = resolveMapFrame(documentRef);
    if (!section) return false;
    return section.classList?.contains?.('active-module')
      ? ensureLoaded(documentRef)
      : ensureUnloaded(documentRef);
  }

  function start({ documentRef = browserRoot?.document, MutationObserverCtor = browserRoot?.MutationObserver } = {}) {
    const section = documentRef?.getElementById?.('modulo-mapa');
    if (!section) return () => {};

    const check = () => sync(documentRef);
    check();

    if (typeof MutationObserverCtor !== 'function') return () => {};
    const observer = new MutationObserverCtor(check);
    observer.observe(section, { attributes: true, attributeFilter: ['class', 'aria-hidden'] });
    return () => observer.disconnect();
  }

  function autoStart() {
    const documentRef = browserRoot?.document;
    if (!documentRef) return;
    const boot = () => {
      if (browserRoot.__luminousVttDmMapLazyLoaderStop) return;
      browserRoot.__luminousVttDmMapLazyLoaderStop = start({ documentRef });
    };
    if (documentRef.readyState === 'loading') documentRef.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }

  autoStart();
  return Object.freeze({ ensureLoaded, ensureUnloaded, sync, start });
});
