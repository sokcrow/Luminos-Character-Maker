(function (global) {
  "use strict";

  const manager = global.LuminousCharacterManager;
  const firebase = global.firebase;
  if (!manager || !firebase?.database) return;

  const db = firebase.database();
  const DEFAULT_SCENE = "campaña/estado_mundo/escena_actual";
  let scenePath = null;
  let sceneRef = null;
  let sceneListener = null;
  let currentScene = {};
  let syncing = false;

  function paths() {
    return global.LuminousTheatreState?.getPaths?.() || { scene: DEFAULT_SCENE };
  }

  function masterIdFor(instanceId, actor) {
    return actor?.identityId || actor?.identidadId || actor?.sourceActorId || (manager.getActor(instanceId) ? instanceId : null);
  }

  async function syncMasterScaleToScene() {
    if (syncing || !sceneRef) return;
    const actors = currentScene?.actores || {};
    const updates = {};

    Object.entries(actors).forEach(([instanceId, liveActor]) => {
      if (liveActor?.sync_master_scale === false || liveActor?.syncMasterScale === false) return;
      const masterId = masterIdFor(instanceId, liveActor);
      if (!masterId) return;
      const master = manager.getActor(masterId)?.actor;
      const masterScale = Number(master?.escala);
      if (!Number.isFinite(masterScale) || masterScale <= 0) return;
      const liveScale = Number(liveActor?.escala);
      if (Number.isFinite(liveScale) && Math.abs(liveScale - masterScale) < 0.0001) return;
      updates[`actores/${instanceId}/escala`] = masterScale;
    });

    if (!Object.keys(updates).length) return;
    syncing = true;
    try {
      await sceneRef.update(updates);
    } catch (error) {
      console.error("Character Manager live scale sync failed:", error);
    } finally {
      syncing = false;
    }
  }

  function bindScene() {
    const nextPath = paths().scene || DEFAULT_SCENE;
    if (sceneRef && scenePath === nextPath) return;
    if (sceneRef && sceneListener) sceneRef.off("value", sceneListener);
    scenePath = nextPath;
    sceneRef = db.ref(scenePath);
    sceneListener = (snapshot) => {
      currentScene = snapshot.val() || {};
      syncMasterScaleToScene();
    };
    sceneRef.on("value", sceneListener);
  }

  manager.init({ db });
  manager.subscribeActors(() => {
    bindScene();
    syncMasterScaleToScene();
  });

  bindScene();
  global.setInterval(bindScene, 1000);

  global.LuminousCharacterLiveSync = Object.freeze({
    sync: syncMasterScaleToScene,
    getScenePath: () => scenePath,
  });
})(window);
