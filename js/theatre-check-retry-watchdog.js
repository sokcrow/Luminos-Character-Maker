(function (global) {
  "use strict";

  const firebase = global.firebase;
  if (!firebase?.auth || global.LuminousTheatreCheckRetryWatchdog) return;

  const RETRY_MS = 5000;
  const MAX_RETRY_ATTEMPTS = 12;
  let timer = null;
  let retryAttempts = 0;

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
    retryAttempts = 0;

    // Successful bindings already install Firebase listeners. There is nothing
    // to poll after that point, so keep the static Player surface timer-free.
    if (retryAuthorizedBindings()) return null;

    timer = global.setInterval(() => {
      retryAttempts += 1;
      if (retryAuthorizedBindings() || retryAttempts >= MAX_RETRY_ATTEMPTS) stop();
    }, RETRY_MS);
    return timer;
  }

  function stop() {
    if (!timer) return;
    global.clearInterval(timer);
    timer = null;
    retryAttempts = 0;
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
    MAX_RETRY_ATTEMPTS,
    retryAuthorizedBindings,
    start,
    stop,
  });
})(window);
