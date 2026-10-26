(function (global) {
  "use strict";

  const firebase = global.firebase;
  if (!firebase?.auth || global.LuminousTheatreCheckRetryWatchdog) return;

  function retryAuthorizedBindings() {
    const user = firebase.auth?.().currentUser;
    const coordinator = global.LuminousTheatreCheckCoordinator;
    if (!user || !coordinator?.bindAuthorizedData) return false;
    try {
      return Boolean(coordinator.bindAuthorizedData());
    } catch (error) {
      console.warn("No se pudieron reintentar los bindings de Theatre Checks:", error);
      return false;
    }
  }

  function start() {
    return retryAuthorizedBindings();
  }

  function stop() {
    return true;
  }

  const auth = firebase.auth?.();
  auth?.onAuthStateChanged?.((user) => {
    if (user) start();
  });

  // Retry only when something that can make the binding succeed actually
  // changes. Never wake a static Theatre/Player page on a timer.
  global.addEventListener?.("luminous:theatre-check-coordinator-ready", start);
  global.addEventListener?.("luminous:player-data", start);
  global.addEventListener?.("luminous:player-instance-changed", start);
  global.addEventListener?.("online", start);

  if (auth?.currentUser) start();

  global.LuminousTheatreCheckRetryWatchdog = Object.freeze({
    retryAuthorizedBindings,
    start,
    stop,
  });
})(window);
