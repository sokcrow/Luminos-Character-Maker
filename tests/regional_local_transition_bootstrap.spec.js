const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('regional-local bootstrap keeps procedural runtimes singleton-safe', () => {
  const main = read('js/vtt/main.js');
  const generator = read('js/vtt/procedural-generator-bootstrap.js');
  const chunks = read('js/vtt/procedural-chunk-streaming-runtime.js');
  const transition = read('js/vtt/regional-local-transition-runtime.js');

  expect(generator).toContain('LuminousVttProceduralGeneratorRuntime?.api');
  expect(chunks).toContain('LuminousVttProceduralChunkStreamingRuntime?.api');
  expect(transition).toContain('LuminousVttRegionalLocalTransitionRuntime?.api');
  expect(main).toContain("import('./procedural-generator-bootstrap.js')");
  expect(main).toContain("import('./procedural-chunk-streaming-runtime.js')");
  expect(main).toContain("import('./regional-local-transition-runtime.js')");
});
