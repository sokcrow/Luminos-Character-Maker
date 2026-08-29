const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test.describe('DM Equipment Forge HUD contract', () => {
  test('exposes the equipment workflow without item-by-item icon dependency', () => {
    const html=read('dm-equipment-forge.html'),js=read('js/dm-equipment-forge.js');
    for(const text of ['EQUIPMENT FORGE','BUILD','CATALOG','MATERIALS','MODULES','RECIPES','DEPLOY CORE CATALOG','Explicit ID','Workshop','Revision / MK']) expect(html).toContain(text);
    expect(js).toContain('legacyProjection');expect(js).toContain('equipmentDefinitionFromBuild');expect(js).toContain('base_datos_modulos');
    expect(html).not.toMatch(/[😀-🙏🌀-🿿]/u);
  });
});
