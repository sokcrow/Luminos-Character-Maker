'use strict';

importScripts(
  './topology.js',
  './surface-core.js',
  './horizontal-plane-core.js',
  './building-physics-core.js',
  './semantic-map-core.js',
  './building-semantic-core.js',
  './building-archetype-core.js',
  './vertical-portal.js',
  './building-navigation-core.js',
  './procedural-zone-core.js',
  './urban-fabric-core.js',
  './procedural-building-generator.js',
  './procedural-building-mix-patch.js',
  './procedural-generator-core.js',
);

function errorPayload(error) {
  return {
    message: String(error?.message || error || 'PROCEDURAL_GENERATION_FAILED'),
    name: String(error?.name || 'Error'),
    failures: Array.isArray(error?.failures) ? error.failures : null,
  };
}

self.addEventListener('message', (event) => {
  const requestId = String(event?.data?.requestId || '');
  if (!requestId || event?.data?.type !== 'generate') return;
  try {
    const core = self.LuminousVttProceduralGenerator;
    if (!core?.generateZone) throw new Error('PROCEDURAL_GENERATOR_WORKER_REQUIRED');
    const plan = core.generateZone(event.data.options || {});
    self.postMessage({ type: 'generated', requestId, plan });
  } catch (error) {
    self.postMessage({ type: 'failed', requestId, error: errorPayload(error) });
  }
});
