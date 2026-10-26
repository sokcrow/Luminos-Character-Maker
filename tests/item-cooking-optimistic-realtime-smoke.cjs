const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  delete globalThis.LuminousItemRealtimeSync;
  let notify = null;
  let finishSave = null;
  let calls = 0;
  let events = 0;
  let reloadCount = 0;
  let reloadFails = false;
  let onReload = null;
  let authoritative = null;
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
    async loadPlayerInventory() {
      reloadCount++;
      if (reloadFails) throw new Error("connection_lost_during_reconciliation");
      return onReload ? onReload() : {loaded:true,state:clone(authoritative)};
    },
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
  authoritative = clone(baseline);
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
  assert.equal(reloadCount,1,"a rejected write must explicitly reload server inventory");
  assert.equal(peer.reconciliationRequired,false);
  assert.equal(events,2,"the authoritative rollback is applied even if its value event was buffered");
  // A late queued speculative callback must not resurrect a rejected write.
  notify(clone(pending));
  assert.deepEqual(unit.inventario_activo,baseline.inventario_activo);
  assert.equal(events,2);
  notify(clone(baseline)); // A later listener event is still allowed.
  assert.equal(events,3);

  const confirmed = peer.saveConfirmed(clone(pending));
  notify(clone(pending));
  assert.deepEqual(unit.inventario_activo,baseline.inventario_activo);
  assert.equal(events,3);
  finishSave.resolve({saved:true});
  assert.equal((await confirmed).saved,true);
  assert.deepEqual(unit.inventario_activo,pending.inventario_activo);
  assert.equal(events,4,"confirmed event is published once after ack");
  assert.equal(peer.revision,4);

  // Rejecting update() as an exception must recover authoritative state too.
  const prior = clone(unit);
  const thrown = peer.saveConfirmed({...clone(pending),
    inventario_activo:{curry:{itemId:"curry",quantity:2}}});
  notify({inventario_activo:{curry:{itemId:"curry",quantity:2}},
    inventario_stash:clone(pending.inventario_stash)});
  assert.deepEqual(unit,prior);
  authoritative = clone(prior);
  finishSave.reject(new Error("firebase_denied"));
  await assert.rejects(thrown,/firebase_denied/);
  assert.deepEqual(unit,prior);
  assert.equal(reloadCount,2);
  assert.equal(peer.reconciliationRequired,false);

  // Codex P1 regression: another client updates inventory during our write;
  // the buffered concurrent snapshot is not replayed after the rejection.
  // Re-fetch and publish that authoritative state before permitting more saves.
  const concurrent = clone(prior);
  concurrent.inventario_activo.remoteGift = {itemId:"gift",quantity:3};
  const conflict = peer.saveConfirmed(clone(pending));
  notify(clone(pending)); // Local optimistic cache.
  notify(clone(concurrent)); // Remote authoritative change while pending.
  assert.deepEqual(unit,prior,"remote change remains buffered until the write settles");
  authoritative = clone(concurrent);
  finishSave.resolve({saved:false,reason:"server_rejected"});
  assert.equal((await conflict).saved,false);
  assert.deepEqual(unit,concurrent,"concurrent write must be recovered and published");
  assert.equal(peer.reconciliationRequired,false);
  assert.equal(reloadCount,3);
  notify(clone(pending)); // Late optimistic echo must still be ignored.
  assert.deepEqual(unit,concurrent);

  // A rollback snapshot arriving before the rejection must not be lost.
  const restored = clone(concurrent);
  restored.inventario_activo.remoteGift.quantity = 5;
  const rollback = peer.saveConfirmed(clone(pending));
  notify(clone(pending));
  notify(clone(restored)); // RTDB rollback before the save promise rejects.
  authoritative = clone(restored);
  finishSave.resolve({saved:false,reason:"server_rejected"});
  await rollback;
  assert.deepEqual(unit,restored);
  assert.equal(reloadCount,4);

  // Codex P1 regression: a stale multi-path reload resolves AFTER the
  // listener has already published another client's newer inventory.
  // Discard that old read, retry, and only then allow future writes.
  const staleRead = clone(restored);
  const nextRemote = clone(restored);
  nextRemote.inventario_activo.remoteGift.quantity = 9;
  nextRemote.inventario_activo.otherClientItem = {itemId:"gem",quantity:2};
  let resolveStaleRead = null;
  let raceReads = 0;
  const eventsBeforeReloadRace = events;
  onReload = () => {
    raceReads++;
    return raceReads === 1
      ? new Promise(resolve => { resolveStaleRead = resolve; })
      : {loaded:true,state:clone(authoritative)};
  };
  const raced = peer.saveConfirmed(clone(pending));
  notify(clone(pending));
  finishSave.resolve({saved:false,reason:"server_rejected"});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(raceReads,1,"the first reload is in flight");
  assert.equal(peer.reconciliationRequired,true);
  assert.equal((await peer.save(unit)).reason,"inventory_refresh_required",
    "do not allow unrelated inventory saves during reconciliation");
  authoritative = clone(nextRemote);
  notify(clone(nextRemote));
  assert.deepEqual(unit,nextRemote,"a newer subscription event is published immediately");
  resolveStaleRead({loaded:true,state:staleRead});
  assert.equal((await raced).saved,false);
  assert.equal(raceReads,2,"reconciliation must retry on revision change");
  assert.deepEqual(unit,nextRemote,"the slow stale reload must never overwrite the newer inventory");
  assert.equal(events,eventsBeforeReloadRace+2,
    "only the new subscription event and the retried reload may be published");
  assert.equal(peer.reconciliationRequired,false);
  onReload = null;

  // Fail closed if Firebase cannot reload the server state. Future writes
  // must not overwrite someone else's update using the stale HUD snapshot.
  const unavailable = peer.saveConfirmed(clone(pending));
  notify(clone(pending));
  reloadFails = true;
  finishSave.resolve({saved:false,reason:"offline"});
  assert.equal((await unavailable).saved,false);
  assert.equal(peer.reconciliationRequired,true);
  assert.equal((await peer.save(unit)).reason,"inventory_refresh_required");
  assert.equal((await peer.move("onion","to_stash")).reason,"inventory_refresh_required");
  assert.equal((await peer.saveConfirmed(clone(pending))).reason,"inventory_refresh_required");
  reloadFails = false;
  peer.dispose();
  assert.equal(notify,null);
  assert.equal(calls,7);
  console.log("Cooking optimistic realtime barrier smoke: OK (revision-safe reload race, rollback, concurrent changes, rejection, blocked stale writes)");
})().catch(error => { console.error(error); process.exitCode = 1; });
