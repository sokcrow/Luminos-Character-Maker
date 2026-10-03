(function (global) {
  "use strict";

  if (!global || global.LuminousCanonicalPlayerMenuIcons) return;

  const ICONS = Object.freeze({
    inventory: "Assets/Images/Buttons/Inventory.png",
    skills: "Assets/Images/Buttons/Skills.png",
    spells: "Assets/Images/Buttons/Spells.png",
  });

  const SOURCE_HINTS = Object.freeze([
    { key: "skills", test: (src) => /SkillAttack\.png|\/Skills\.png(?:[?#]|$)/i.test(src) },
    { key: "spells", test: (src) => /DJ5lKid\.png|\/Spells\.png(?:[?#]|$)/i.test(src) },
    { key: "inventory", test: (src) => /\/Inventory\.(?:png|svg)(?:[?#]|$)/i.test(src) },
  ]);

  const CONTROL_PATTERNS = Object.freeze({
    inventory: /(?:^|\b)(?:inventory|inventario|items?|objetos?)(?:\b|$)/i,
    skills: /(?:^|\b)(?:skills?|habilidades?)(?:\b|$)/i,
    spells: /(?:^|\b)(?:spells?|hechizos?)(?:\b|$)/i,
  });

  const clean = (value) => String(value ?? "").trim();

  function controlDescriptor(control) {
    const direct = [
      control.getAttribute?.("data-label"),
      control.getAttribute?.("aria-label"),
      control.getAttribute?.("title"),
      control.getAttribute?.("name"),
      control.getAttribute?.("id"),
      control.getAttribute?.("data-action"),
      control.getAttribute?.("data-menu-action"),
      control.getAttribute?.("data-player-menu-action"),
    ].map(clean).filter(Boolean);

    const text = clean(control.textContent).replace(/\s+/g, " ");
    if (text && text.length <= 40) direct.push(text);
    return direct.join(" ");
  }

  function keyForControl(control) {
    const descriptor = controlDescriptor(control);
    if (!descriptor) return null;
    for (const [key, pattern] of Object.entries(CONTROL_PATTERNS)) {
      if (pattern.test(descriptor)) return key;
    }
    return null;
  }

  function keyForImage(img) {
    const src = clean(img?.getAttribute?.("src") || img?.src);
    if (!src) return null;
    return SOURCE_HINTS.find((entry) => entry.test(src))?.key || null;
  }

  function canonicalizeControl(control, forcedKey = null) {
    const key = forcedKey || keyForControl(control);
    const canonicalSrc = ICONS[key];
    if (!canonicalSrc) return false;

    let img = control.querySelector?.("img");
    if (!img) {
      img = global.document.createElement("img");
      img.width = 28;
      img.height = 28;
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      control.prepend(img);
    }

    if (img.getAttribute("src") !== canonicalSrc) img.setAttribute("src", canonicalSrc);
    img.classList.add("luminous-canonical-player-menu-icon");
    img.alt = "";
    img.setAttribute("aria-hidden", "true");

    control.querySelectorAll?.("svg").forEach((svg) => {
      if (!svg.closest("img")) svg.remove();
    });
    control.dataset.luminousCanonicalMenuIcon = key;
    return true;
  }

  function canonicalizeImage(img) {
    const key = keyForImage(img);
    if (!key) return false;
    const control = img.closest?.("button,[role='button'],a");
    if (control) return canonicalizeControl(control, key);
    const canonicalSrc = ICONS[key];
    if (canonicalSrc && img.getAttribute("src") !== canonicalSrc) {
      img.setAttribute("src", canonicalSrc);
      img.classList.add("luminous-canonical-player-menu-icon");
      return true;
    }
    return false;
  }

  function apply(root = global.document) {
    if (!root?.querySelectorAll) return 0;
    let changed = 0;

    root.querySelectorAll("button,[role='button'],a").forEach((control) => {
      if (keyForControl(control) && canonicalizeControl(control)) changed += 1;
    });

    root.querySelectorAll("img").forEach((img) => {
      if (canonicalizeImage(img)) changed += 1;
    });

    return changed;
  }

  function install() {
    const doc = global.document;
    if (!doc?.documentElement) return false;

    if (!doc.getElementById("luminous-canonical-player-menu-icon-style")) {
      const style = doc.createElement("style");
      style.id = "luminous-canonical-player-menu-icon-style";
      style.textContent = ".luminous-canonical-player-menu-icon{display:block;object-fit:contain;max-width:100%;max-height:100%}";
      doc.head?.appendChild(style);
    }

    apply(doc);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          const target = mutation.target;
          if (target?.matches?.("img")) canonicalizeImage(target);
          else if (target?.matches?.("button,[role='button'],a")) canonicalizeControl(target);
          continue;
        }
        mutation.addedNodes.forEach((node) => {
          if (node?.nodeType !== 1) return;
          if (node.matches?.("button,[role='button'],a")) canonicalizeControl(node);
          if (node.matches?.("img")) canonicalizeImage(node);
          apply(node);
        });
      }
    });
    observer.observe(doc.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["src", "data-label", "aria-label", "title", "name", "id", "data-action", "data-menu-action", "data-player-menu-action"],
    });

    global.addEventListener?.("load", () => apply(doc), { once: true });
    global.setTimeout?.(() => apply(doc), 0);
    global.setTimeout?.(() => apply(doc), 250);
    global.setTimeout?.(() => apply(doc), 1000);

    global.LuminousCanonicalPlayerMenuIcons = Object.freeze({
      version: "1.0.0",
      icons: ICONS,
      apply,
      keyForControl,
    });
    return true;
  }

  install();
})(typeof window !== "undefined" ? window : globalThis);
