const { test, expect } = require("@playwright/test");
const path = require("path");

const UI = path.resolve(__dirname, "../js/item-enchanter-ui.js");

async function boot(page, shouldSave = true) {
  await page.setContent("<!doctype html><html><head></head><body></body></html>");
  await page.evaluate((shouldSave) => {
    const sword = {
      instanceId:"sword_1", definitionId:"sword",
      nombre:"Training Sword", itemType:"weapon",
      category:"weapon", tier:5, condition:100, conditionMax:100,
    };
    const viewer = { id:"player", ahn:1000, inventario_activo:{ sword_1:sword } };
    window.__enchanterFixture = { sword, viewer, commits:0, saves:0, events:0 };
    window.addEventListener("luminous:enchanter-service-committed", () => {
      window.__enchanterFixture.events += 1;
    });
    window.LuminousEnchantmentCatalog = {
      ELIGIBLE_ITEM_KINDS:["weapon"],
      get(id){ return id==="flamebound" ? { id, name:"Flamebound" } : null; },
    };
    window.LuminousItemEnchantmentEngine = {
      baseSlotCapacity(){ return 3; },
      slotsUsed(refs){ return refs.reduce((sum, ref) => sum + (Number(ref.rank)||1), 0); },
      appliedEnchantments(item){ return item.magic?.enchantments || []; },
    };
    const projected = (item) => ({
      ...item,
      magic:{enchantments:[{definitionId:"flamebound",rank:1}]},
    });
    window.LuminousItemEnchanterServiceRuntime = {
      SERVICE_LABELS:{ enchant:"Enchant" },
      normalizeProviderProfile(provider){ return provider; },
      walletBalance(owner){ return {resolved:true,balance:owner.ahn}; },
      quoteEnchantService(provider,item,id,rank) {
        return {quoted:true,service:"enchant",definitionId:id,rank,totalAhn:100,
          materials:{plan:{valid:true}},duration:{resolved:true,hours:8}};
      },
      playerServicePreview() {
        return {
          available:true,priceAhn:100,effects:["Damage +10% (fire)"],
          materials:[],duration:{hours:8},difficulty:{text:"Difficult"},
          controlledResult:{text:"Unknown"},
          projectedMagicalDurability:null,
        };
      },
      previewServiceResult(item) {
        return {previewed:true,item:projected(item)};
      },
      commitServiceTransaction(owner,item,quote,options) {
        window.__enchanterFixture.commits += 1;
        owner.ahn -= 100;
        item.magic = projected(item).magic;
        owner.enchanterTransactions ||= {};
        owner.enchanterTransactions[options.transactionId]={committed:true};
        return {committed:true,transactionId:options.transactionId,chargedAhn:100,service:"enchant"};
      },
    };
    window.__openEnchanter = () => window.LuminousEnchanterUi.open({
      viewer,
      items:[sword],
      provider:{ id:"tester", name:"Testing Enchanter",services:["enchant"],maxRank:3,
        knownEnchantments:["flamebound"] },
      onSave: async () => {
        window.__enchanterFixture.saves += 1;
        if (window.__enchanterSaveFails) throw new Error("network save did not confirm");
      },
    });
    window.__enchanterSaveFails = !shouldSave;
  }, shouldSave);
  await page.addScriptTag({path:UI});
  await page.evaluate(() => window.__openEnchanter());
}

test("player can see projected Item slots before confirming; preview is side-effect free", async ({page}) => {
  await boot(page);
  await expect(page.locator("#enchanter-ui-preview-content")).toContainText("Resultado previsto");
  await expect(page.locator("#enchanter-ui-preview-content")).toContainText("Slots ocupados después del servicio: 1 / 3");
  await expect(page.locator("#enchanter-ui-preview-content")).toContainText("100");
  await expect(page.locator("#enchanter-ui-commit")).toBeDisabled();
  expect(await page.evaluate(() => window.__enchanterFixture.sword.magic)).toBeUndefined();
});

test("player confirmation only reports COMPLETE after the save callback resolves", async ({page}) => {
  await boot(page);
  await page.locator("#enchanter-ui-confirm").check();
  await page.locator("#enchanter-ui-commit").click();
  await expect(page.locator("#enchanter-ui-status")).toContainText("COMPLETE");
  expect(await page.evaluate(() => ({
    commits:window.__enchanterFixture.commits,
    saves:window.__enchanterFixture.saves,
    events:window.__enchanterFixture.events,
    ahn:window.__enchanterFixture.viewer.ahn,
  }))).toEqual({commits:1,saves:1,events:1,ahn:900});
});

test("ambiguous remote save failure locks repeat charge until page reload", async ({page}) => {
  await boot(page,false);
  await page.locator("#enchanter-ui-confirm").check();
  await page.locator("#enchanter-ui-commit").click();
  await expect(page.locator("#enchanter-ui-status")).toContainText("SAVE NOT CONFIRMED");
  await expect(page.locator("#enchanter-ui-commit")).toBeDisabled();
  await page.evaluate(() => {
    window.LuminousEnchanterUi.close();
    window.__openEnchanter();
  });
  await page.locator("#enchanter-ui-confirm").check();
  await expect(page.locator("#enchanter-ui-commit")).toBeDisabled();
  expect(await page.evaluate(() => ({
    commits:window.__enchanterFixture.commits,
    saves:window.__enchanterFixture.saves,
    events:window.__enchanterFixture.events,
  }))).toEqual({commits:1,saves:1,events:0});
});

test("unidentified installed magic stays obfuscated without breaking rank-sensitive service selection", async ({page}) => {
  await boot(page);
  await page.evaluate(() => {
    const {sword} = window.__enchanterFixture;
    sword.magic = {enchantments:[{definitionId:"flamebound",rank:2}]};
    window.LuminousItemMagicKnowledgeRuntime = {
      presentation(){ return {enchantmentLines:[{known:false,text:"ᚠᛉᚻ"}],knowledge:{rankKnown:false}}; },
    };
    const provider=window.LuminousEnchanterUi.state.provider;
    provider.services.push("strengthen");
    window.LuminousItemEnchanterServiceRuntime.quoteStrengthenService = function(provider,item,definitionId,targetRank) {
      window.__rankAttempt = {definitionId,targetRank};
      return {quoted:false,reason:"recipe_knowledge_required"};
    };
    window.LuminousEnchanterUi.state.service = "strengthen";
    window.LuminousEnchanterUi.render();
  });
  await expect(page.locator("#enchanter-ui-current")).toContainText("ᚠᛉᚻ");
  await expect(page.locator("#enchanter-ui-current")).not.toContainText("Flamebound");
  await expect(page.locator("#enchanter-ui-enchantment option")).toContainText("Inscripción sin identificar");
  expect(await page.evaluate(() => window.__rankAttempt)).toEqual({
    definitionId:"flamebound",targetRank:3,
  });
});
