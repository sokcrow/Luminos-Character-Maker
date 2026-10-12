const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  delete globalThis.LuminousItemRealtimeSync;
  let notify = null;
  let finishSave = null;
  let calls = 0;
  let events = 0;
  const clone = value => JSON.parse(JSON.stringify(value));
  globalThis.LuminousItemPersistenceRuntime = {
    playerPaths(id) { return {base:"campaña/jugadores/"+id}; },
    subscribePlayerInventory(db,id,callback) {
      notify = callback;
      return () => { notify = null; };
    },
    applyInventoryState(unit,snapshot) {
      unit.inventario_activo = clone(snapshot.inventario_activo);
      unit.inventario_stash = clone(snapshot.inventario_stash);
      return {applied:true};
    },
    serializeInventoryState: clone,
    saveInventoryState() {
      calls++;
      return new Promise((resolve,reject) => { finishSave = {resolve,reject}; });
    }
  };
  await import(pathToFileURL(path.resolve(__dirname,"../js/item-realtime-sync.js")).href);
  const sync = globalThis.LuminousItemRealtimeSync;
  const baseline = {
    inventario_activo: {onion:{itemId:"onion",quantity:2}},
    inventario_stash: {stone:{itemId:"stone",quantity:1}}
  };
  const pending = {
    inventario_activo: {
      onion:{itemId:"onion",quantity:1},
      curry:{itemId:"curry",quantity:1}
    },
    inventario_stash: clone(baseline.inventario_stash)
  };
  const unit = clone(baseline);
  const peer = sync.bindPlayerInventory({
    db:{ref(){return {};}},
    playerId:"alice",unit,watchStashAccess:false,
    onInventory(){events++;}
  });
  assert.equal(peer.bound,true);
  assert.equal(typeof peer.saveConfirmed,"function");
  notify(clone(baseline));
  assert.equal(events,1);

  // RTDB emits local 'value' notifications BEFORE its update() promise
  // resolves. Until the server acknowledges, not even inventory listeners
  // should see the cooked dish or consumed onion.
  const rejection = peer.saveConfirmed(clone(pending));
  notify(clone(pending));
  assert.deepEqual(unit.inventario_activo,baseline.inventario_activo);
  assert.equal(events,1);
  assert.equal(peer.revision,1);
  assert.equal((await peer.save(unit)).reason,"confirmed_inventory_save_in_progress");
  assert.equal((await peer.move("onion","to_stash")).reason,"confirmed_inventory_save_in_progress");
  finishSave.resolve({saved:false,reason:"permission_denied"});
  assert.equal((await rejection).saved,false);
  assert.deepEqual(unit.inventario_activo,baseline.inventario_activo);
  assert.equal(events,1);
  // A late queued speculative callback must not resurrect a rejected write.
  notify(clone(pending));
  assert.deepEqual(unit.inventario_activo,baseline.inventario_activo);
  assert.equal(events,1);
  notify(clone(baseline)); // Firebase rolls back its optimistic local cache.
  assert.deepEqual(unit.inventario_activo,baseline.inventario_activo);
  assert.equal(events,2);

  const confirmed = peer.saveConfirmed(clone(pending));
  notify(clone(pending));
  assert.deepEqual(unit.inventario_activo,baseline.inventario_activo);
  assert.equal(events,2);
  finishSave.resolve({saved:true});
  assert.equal((await confirmed).saved,true);
  assert.deepEqual(unit.inventario_activo,pending.inventario_activo);
  assert.equal(events,3,"confirmed event is published once after ack");
  assert.equal(peer.revision,3);

  // Rejecting update() as an exception must discard the local write too.
  const prior = clone(unit);
  const thrown = peer.saveConfirmed({...clone(pending),
    inventario_activo:{curry:{itemId:"curry",quantity:2}}});
  notify({inventario_activo:{curry:{itemId:"curry",quantity:2}},
    inventario_stash:clone(pending.inventario_stash)});
  assert.deepEqual(unit,prior);
  finishSave.reject(new Error("firebase_denied"));
  await assert.rejects(thrown,/firebase_denied/);
  assert.deepEqual(unit,prior);
  peer.dispose();
  assert.equal(notify,null);
  assert.equal(calls,3);
  console.log("Cooking optimistic realtime barrier smoke: OK (reject, late echo, confirmed, exception)");
})().catch(error => { console.error(error); process.exitCode = 1; });
