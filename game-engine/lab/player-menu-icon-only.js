(() => {
  const frame = document.getElementById("gameFrame");
  if (!frame) return;

  let pollTimer = null;

  function removeVisibleMenuLabels(menu) {
    menu.querySelectorAll(".paper-menu-label").forEach(label => label.remove());
    menu.querySelectorAll("[data-label]").forEach(button => button.removeAttribute("data-label"));
  }

  function enforceIconOnlyMenu() {
    let doc;
    let win;
    try {
      doc = frame.contentDocument;
      win = frame.contentWindow;
    } catch (_) {
      return false;
    }

    const menu = doc?.getElementById("paperPlayerMenuStrip");
    if (!menu) return false;

    removeVisibleMenuLabels(menu);

    if (!menu.__luminousIconOnlyObserver && win?.MutationObserver) {
      const observer = new win.MutationObserver(() => removeVisibleMenuLabels(menu));
      observer.observe(menu, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-label"] });
      menu.__luminousIconOnlyObserver = observer;
    }

    return true;
  }

  function startEnforcement() {
    if (pollTimer) clearInterval(pollTimer);
    if (enforceIconOnlyMenu()) return;

    pollTimer = setInterval(() => {
      if (!enforceIconOnlyMenu()) return;
      clearInterval(pollTimer);
      pollTimer = null;
    }, 100);
  }

  frame.addEventListener("load", startEnforcement);
  startEnforcement();
})();
