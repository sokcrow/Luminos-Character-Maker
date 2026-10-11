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
    window.__enchanterFixture = { sword, viewer, commits:0, saves:0, events:0,clock:1710000000000 };
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
      SERVICE_LABELS:{ enchant:"Enchant", strengthen:"Strengthen" },
      SERVICE_IDS:["enchant","strengthen"],
      normalizeProviderProfile(provider){ return provider; },
      walletBalance(owner){ return {resolved:true,balance:owner.ahn}; },
      quoteEnchantService(provider,item,id,rank) {
        return {quoted:true,service:"enchant",definitionId:id,rank,totalAhn:100,
          materials:{plan:{valid:true}},duration:{resolved:false,hours:8}};
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
      getWorldTimestamp:async()=>window.__enchanterFixture.clock,
      subscribeWorldTimestamp:listener=>{
        window.__enchanterClockListener=listener;
        listener(window.__enchanterFixture.clock);
        return ()=>{window.__enchanterClockListener=null;};
      },
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
      presentation(){ return {magicDetected:true,enchantmentLines:[{known:false,text:"ᚠᛉᚻ"}],knowledge:{rankKnown:false}}; },
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


test("changing Rank or Item invalidates previous payment confirmation", async ({page}) => {
  await boot(page);
  const confirm=page.locator("#enchanter-ui-confirm");
  const commit=page.locator("#enchanter-ui-commit");
  await confirm.check();
  await expect(commit).toBeEnabled();
  await page.locator("#enchanter-ui-rank").selectOption("2");
  await expect(confirm).not.toBeChecked();
  await expect(commit).toBeDisabled();

  await page.evaluate(() => {
    const other={
      instanceId:"sword_2",definitionId:"sword_2",nombre:"Second Sword",
      itemType:"weapon",category:"weapon",tier:5,condition:100,conditionMax:100,
    };
    window.__enchanterFixture.viewer.inventario_activo.sword_2=other;
    window.LuminousEnchanterUi.state.items.push(other);
    window.LuminousEnchanterUi.render();
  });
  await confirm.check();
  await expect(commit).toBeEnabled();
  await page.locator('[data-enchanter-item="1"]').click();
  await expect(confirm).not.toBeChecked();
  await expect(commit).toBeDisabled();
  await expect(page.locator("#enchanter-ui-current")).toContainText("Second Sword");
  expect(await page.evaluate(() => window.__enchanterFixture.commits)).toBe(0);
});

test("timed service remains pending across panel reopening and only delivers when ready", async ({page}) => {
  await boot(page);
  await page.evaluate(() => {
    const S=window.LuminousItemEnchanterServiceRuntime;
    const quote=S.quoteEnchantService;
    S.quoteEnchantService=(...args)=>({
      ...quote(...args),duration:{resolved:true,hours:8},
    });
    S.serviceReady=(job,world)=>Number(world)>=Number(job.readyAt);
    S.startDeferredServiceTransaction=(owner,item,serviceQuote,options)=>{
      const player=JSON.parse(JSON.stringify(owner));
      player.ahn-=100;
      player.enchanterTransactions ||= {};
      player.enchanterJobs ||= {};
      player.enchanterTransactions[options.transactionId]={
        committed:true,status:"in_service",chargedAhn:100,
      };
      const job={jobId:options.transactionId,status:"in_service",
        itemInstanceId:item.instanceId,service:"enchant",totalAhn:100,
        clockSource:"campaign",readyAt:Number(options.worldTimestamp)+8*60*60*1000,
        itemBefore:JSON.parse(JSON.stringify(item)),providerId:"tester"};
      delete player.inventario_activo[item.instanceId];
      player.enchanterJobs[job.jobId]=job;
      return {committed:true,started:true,transactionId:job.jobId,chargedAhn:100,
        itemInstanceId:item.instanceId,service:"enchant",job,player};
    };
    S.completeDeferredServiceTransaction=(owner,id,options)=>{
      const job=owner.enchanterJobs[id];
      if(!S.serviceReady(job,options.worldTimestamp))return {committed:false,reason:"service_not_ready"};
      const player=JSON.parse(JSON.stringify(owner));
      player.inventario_activo.sword_1={
        ...job.itemBefore,magic:{enchantments:[{definitionId:"flamebound",rank:1}]},
      };
      player.enchanterJobs[id].status="completed";
      player.enchanterTransactions[id+":delivery"]={committed:true,chargedAhn:0};
      return {committed:true,delivered:true,transactionId:id+":delivery",
        chargedAhn:0,itemInstanceId:job.itemInstanceId,service:job.service,player};
    };
    window.LuminousEnchanterUi.render();
  });
  await page.locator("#enchanter-ui-confirm").check();
  await page.locator("#enchanter-ui-commit").click();
  await expect(page.locator("#enchanter-ui-preview-content")).toContainText("Entrega:");
  await expect(page.locator("#enchanter-ui-commit")).toBeDisabled();
  expect(await page.evaluate(() => ({
    ahn:window.__enchanterFixture.viewer.ahn,
    escrowed:window.__enchanterFixture.viewer.inventario_activo.sword_1===undefined,
    saves:window.__enchanterFixture.saves,
  }))).toEqual({ahn:900,escrowed:true,saves:1});
  await page.evaluate(() => {
    window.LuminousEnchanterUi.close();
    window.__openEnchanter();
  });
  await expect(page.locator("#enchanter-ui-preview-content")).toContainText("Entrega:");
  await page.evaluate(() => {
    const job=Object.values(window.__enchanterFixture.viewer.enchanterJobs)[0];
    window.__enchanterFixture.clock=job.readyAt;
    window.__enchanterClockListener(job.readyAt);
  });
  await page.locator("#enchanter-ui-confirm").check();
  await expect(page.locator("#enchanter-ui-commit")).toHaveText("RETIRAR ITEM");
  await page.locator("#enchanter-ui-commit").click();
  await expect(page.locator("#enchanter-ui-status")).toContainText("COMPLETE");
  expect(await page.evaluate(() => ({
    ahn:window.__enchanterFixture.viewer.ahn,
    magic:window.__enchanterFixture.viewer.inventario_activo.sword_1.magic,
    saves:window.__enchanterFixture.saves,
  }))).toMatchObject({ahn:900,magic:{enchantments:[{definitionId:"flamebound",rank:1}]},saves:2});
});

test("shop terminal never quotes or consumes provider-stock reagents", async ({page}) => {
  await boot(page);
  await page.evaluate(() => {
    const S=window.LuminousItemEnchanterServiceRuntime;
    window.__providerMaterialsSeen=[];
    const quote=S.quoteEnchantService;
    S.quoteEnchantService=(provider,item,id,rank,opts)=>{
      window.__providerMaterialsSeen.push(opts.providerMaterials.length);
      if(opts.providerMaterials.length) return {quoted:false,reason:"provider_stock_requires_server_atomic_commit"};
      return quote(provider,item,id,rank,opts);
    };
    window.LuminousEnchanterUi.close();
    window.__openEnchanter = () => window.LuminousEnchanterUi.open({
      viewer:window.__enchanterFixture.viewer,
      provider:{id:"tester",name:"Testing Enchanter",services:["enchant"],
        maxRank:3,knownEnchantments:["flamebound"]},
      providerMaterials:[{instanceId:"shop_reagent",definitionId:"ruby",quantity:2}],
      onSave:async()=>{window.__enchanterFixture.saves++;},
    });
    window.__openEnchanter();
  });
  await expect(page.locator("#enchanter-ui-preview-content")).toContainText("Resultado previsto");
  await page.locator("#enchanter-ui-confirm").check();
  await page.locator("#enchanter-ui-commit").click();
  expect(await page.evaluate(()=>({
    seen:window.__providerMaterialsSeen,
    spent:window.LuminousEnchanterUi.state.providerMaterials[0].quantity,
  }))).toMatchObject({spent:2});
  expect(await page.evaluate(()=>window.__providerMaterialsSeen.every(n=>n===0))).toBe(true);
});

test("undetected enchantment does not expose occupied slots or inscription count",async ({page})=>{
  await boot(page);
  await page.evaluate(()=>{
    const sword=window.__enchanterFixture.sword;
    sword.magic={enchantments:[{definitionId:"flamebound",rank:2}],
      enchantmentSlots:{used:2,max:3}};
    window.LuminousItemMagicKnowledgeRuntime={presentation:()=>({
      magicDetected:false,enchantmentLines:[{known:false,text:"ᚠᛉᚻ"}],
    })};
    window.LuminousEnchanterUi.render();
  });
  const card=page.locator("#enchanter-ui-current");
  await expect(card).toContainText("Inscripciones mágicas no detectadas.");
  await expect(card).not.toContainText("SLOTS");
  await expect(card).not.toContainText("ᚠᛉᚻ");
  await expect(card.locator("li")).toHaveCount(0);
});

test("Bound gem extraction needs separate irreversible Item destruction approval",async ({page})=>{
  await boot(page);
  await page.evaluate(()=>{
    const S=window.LuminousItemEnchanterServiceRuntime;
    const E=window.LuminousItemEnchantmentEngine;
    E.gemAnchors=()=>[{anchorId:"socket_1",gemDefinitionId:"ruby",gemQuality:"fine"}];
    window.LuminousOreIngotGemCatalog={gemMagicProfile:()=>({displayName:"Ruby"})};
    window.LuminousItemMagicRuntime={isMagicItem:()=>true};
    window.LuminousItemMagicKnowledgeRuntime={presentation:()=>({
      magicDetected:true,enchantmentLines:[],knowledge:{},
    })};
    S.SERVICE_IDS.push("extract_gem");
    S.quoteGemProcedure=()=>({quoted:true,service:"extract_gem",procedure:"safe_extract",
      destroysItem:true,bound:true,totalAhn:100,materials:{plan:{valid:true}}});
    S.commitServiceTransaction=(owner,item,quote,options)=>{
      window.__destructionConfirmedByEngine=options.confirmDestruction===true;
      if(!window.__destructionConfirmedByEngine)
        return {committed:false,reason:"bound_gem_removal_destroys_item"};
      owner.ahn-=100;
      item.destroyed=true;
      owner.enchanterTransactions ||= {};
      owner.enchanterTransactions[options.transactionId]={committed:true,chargedAhn:100};
      return {committed:true,transactionId:options.transactionId,chargedAhn:100,
        itemInstanceId:item.instanceId,service:"extract_gem"};
    };
    const ui=window.LuminousEnchanterUi;
    ui.state.provider.services.push("extract_gem");
    ui.state.service="extract_gem";
    ui.render();
  });
  await expect(page.locator("#enchanter-ui-destruction-wrap")).toBeVisible();
  await expect(page.locator("#enchanter-ui-validation")).toContainText("DESTRUCCIÓN IRREVERSIBLE");
  await page.locator("#enchanter-ui-confirm").check();
  await expect(page.locator("#enchanter-ui-commit")).toBeDisabled();
  await page.locator("#enchanter-ui-confirm-destruction").check();
  await expect(page.locator("#enchanter-ui-commit")).toBeEnabled();
  await page.locator("#enchanter-ui-commit").click();
  await expect(page.locator("#enchanter-ui-status")).toContainText("COMPLETE");
  expect(await page.evaluate(()=>window.__destructionConfirmedByEngine)).toBe(true);
});
