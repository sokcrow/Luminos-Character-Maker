import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('Player caster sees real Skills and Spells menus', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/tests/combat-v073-player-menu-visual-fixture.html');

  await page.waitForFunction(() => Boolean(window.LuminousCombatEconomyMenu073));
  await page.waitForFunction(() => {
    const api = window.LuminousCombatEconomyMenu073;
    return api?.spellRowsForPlayer?.().some((row) => row.spellId === 'mage_hand');
  });

  await page.evaluate(() => {
    window.activeMenu = 'skills';
    window.LuminousCombatEconomyMenu073.setTab('skills', 'action');
    window.LuminousCombatEconomyMenu073.renderSkills();
  });
  await expect(page.locator('#category-body')).toContainText('Visible Test Skill');

  await page.evaluate(() => {
    window.activeMenu = 'spells';
    window.LuminousCombatEconomyMenu073.setTab('spells', 'action');
    window.LuminousCombatEconomyMenu073.renderSpells();
  });
  await expect(page.locator('#category-body')).toContainText('Mage Hand');

  fs.mkdirSync('artifacts/player-menu-visual', { recursive: true });
  await page.screenshot({ path: 'artifacts/player-menu-visual/player-skills-spells.png', fullPage: true });
});
