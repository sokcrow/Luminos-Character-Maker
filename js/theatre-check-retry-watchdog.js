(function (global) {
  "use strict";

  const firebase = global.firebase;
  if (!firebase?.auth || global.LuminousTheatreCheckRetryWatchdog) return;

  const RETRY_MS = 5000;
  let timer = null;

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
    if (timer) return timer;
    retryAuthorizedBindings();
    timer = global.setInterval(retryAuthorizedBindings, RETRY_MS);
    return timer;
  }

  function stop() {
    if (!timer) return;
    global.clearInterval(timer);
    timer = null;
  }

  const auth = firebase.auth?.();
  if (auth?.onAuthStateChanged) {
    auth.onAuthStateChanged((user) => {
      if (user) start();
      else stop();
    });
  }

  if (auth?.currentUser) start();
  else {
    let attempts = 0;
    const bootstrap = global.setInterval(() => {
      attempts += 1;
      if (global.LuminousTheatreCheckCoordinator && firebase.auth?.().currentUser) {
        global.clearInterval(bootstrap);
        start();
      } else if (attempts >= 150) {
        global.clearInterval(bootstrap);
      }
    }, 100);
  }

  global.LuminousTheatreCheckRetryWatchdog = Object.freeze({
    RETRY_MS,
    retryAuthorizedBindings,
    start,
    stop,
  });
})(window);
