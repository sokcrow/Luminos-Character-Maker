(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttMapSwitchGuard = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const clean = (value) => String(value ?? '').trim();

  function createGuard({ currentMapId, resolveActiveDefinition, reload, notify, log = console } = {}) {
    const current = clean(currentMapId) || 'default';
    let reloadPending = false;

    return async function handleMapChanged(mapId) {
      const target = clean(mapId);
      if (!target || target === current) return { action: 'ignore', reason: 'SAME_OR_EMPTY' };
      if (reloadPending) return { action: 'ignore', reason: 'RELOAD_PENDING' };

      reloadPending = true;
      try {
        const definition = typeof resolveActiveDefinition === 'function'
          ? await resolveActiveDefinition()
          : null;
        const resolvedId = clean(definition?.id || definition?.mapId);

        if (!definition || resolvedId !== target) {
          reloadPending = false;
          log?.error?.('VTT map switch blocked: active map definition unavailable.', {
            currentMapId: current,
            targetMapId: target,
            resolvedMapId: resolvedId || null,
          });
          notify?.(`No se pudo activar el mapa "${target}". Se mantiene el mapa actual.`, 'error');
          return {
            action: 'blocked',
            reason: 'MAP_DEFINITION_UNAVAILABLE',
            targetMapId: target,
            resolvedMapId: resolvedId || null,
          };
        }

        if (typeof reload !== 'function') {
          reloadPending = false;
          notify?.('No se pudo recargar el VTT para completar el cambio de mapa.', 'error');
          return { action: 'blocked', reason: 'RELOAD_UNAVAILABLE', targetMapId: target };
        }

        reload();
        return { action: 'reload', targetMapId: target };
      } catch (error) {
        reloadPending = false;
        log?.error?.('VTT map switch validation failed.', error);
        notify?.(`No se pudo validar el mapa "${target}". Se mantiene el mapa actual.`, 'error');
        return { action: 'blocked', reason: 'VALIDATION_FAILED', targetMapId: target, error };
      }
    };
  }

  return Object.freeze({ createGuard });
});
