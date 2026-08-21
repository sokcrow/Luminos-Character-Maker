(function (global) {
  "use strict";

  const HEAD_SRC = "https://imgur.com/yshLPnQ.png";
  const TAIL_SRC = "https://imgur.com/XDx0ICt.png";
  const HEAD_SFX = "Assets/Audio/SFX/UI/Coin%20SFX/Coin_Heads.wav";
  const TAIL_SFX = "Assets/Audio/SFX/UI/Coin%20SFX/Coin_Tails.wav";
  const DEFAULT_COIN_COUNT = 5;
  const HEAD_BONUS = 4;
  const DEFAULT_INTERVAL_MS = 600;

  function numberOr(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function clampHeadsChance(value) {
    return Math.max(5, Math.min(95, numberOr(value, 50)));
  }

  function rollSide(headsChance, rng) {
    const random = typeof rng === "function" ? rng : global.Math.random;
    return (random() * 100) < clampHeadsChance(headsChance) ? "head" : "tail";
  }

  function coinSrc(side) {
    return side === "head" ? HEAD_SRC : TAIL_SRC;
  }

  function playSideSfx(side, options = {}) {
    if (options.silent || typeof global.Audio !== "function") return;
    try {
      const audio = new global.Audio(side === "head" ? HEAD_SFX : TAIL_SFX);
      audio.volume = Math.max(0, Math.min(1, numberOr(options.volume, 0.3)));
      const result = audio.play();
      if (result?.catch) result.catch(() => {});
    } catch (_) {}
  }

  function createCoinNode(doc, index) {
    const wrapper = doc.createElement("div");
    wrapper.className = "coin-toss-item luminous-core-coin";
    wrapper.dataset.coinIndex = String(index);
    wrapper.dataset.state = "spinning";
    Object.assign(wrapper.style, {
      width: "60px",
      height: "60px",
      position: "relative",
      cursor: "default",
    });

    const image = doc.createElement("img");
    image.src = TAIL_SRC;
    image.alt = `Coin ${index + 1}`;
    Object.assign(image.style, {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transition: "transform 0.3s",
    });
    wrapper.appendChild(image);

    let animation = null;
    if (typeof image.animate === "function") {
      animation = image.animate(
        [{ transform: "rotateY(0deg)" }, { transform: "rotateY(360deg)" }],
        { duration: 150, iterations: Infinity },
      );
    } else {
      image.classList.add("luminous-core-coin-spinning");
    }

    return { wrapper, image, animation };
  }

  function runAnimatedRoll(options = {}) {
    const doc = options.document || global.document;
    const container = options.container;
    if (!doc || !container) return Promise.reject(new Error("Coin Engine requiere un contenedor DOM."));

    const coinCount = Math.max(1, Math.trunc(numberOr(options.coinCount, DEFAULT_COIN_COUNT)));
    const base = Math.trunc(numberOr(options.base, 0));
    const headsChance = clampHeadsChance(options.headsChance);
    const intervalMs = Math.max(80, Math.trunc(numberOr(options.intervalMs, DEFAULT_INTERVAL_MS)));
    const auto = options.auto !== false;
    const coins = [];
    const nodes = [];
    let currentTotal = base;
    let resolved = 0;
    let completed = false;

    container.replaceChildren();
    if (options.totalNode) options.totalNode.textContent = String(currentTotal);

    const fragment = doc.createDocumentFragment();
    for (let index = 0; index < coinCount; index += 1) {
      const node = createCoinNode(doc, index);
      nodes.push(node);
      fragment.appendChild(node.wrapper);
    }
    container.appendChild(fragment);

    return new Promise((resolve) => {
      const finish = () => {
        if (completed || resolved < coinCount) return;
        completed = true;
        const result = {
          base,
          total: currentTotal,
          heads: coins.filter((coin) => coin.side === "head").length,
          coinCount,
          headBonus: HEAD_BONUS,
          headsChance,
          coins: coins.slice(),
        };
        options.onComplete?.(result);
        resolve(result);
      };

      const resolveCoin = (index) => {
        const node = nodes[index];
        if (!node || node.wrapper.dataset.state === "resolved") return;
        node.wrapper.dataset.state = "resolved";
        node.animation?.cancel?.();
        node.image.classList.remove("luminous-core-coin-spinning");

        const side = rollSide(headsChance, options.rng);
        node.wrapper.dataset.side = side;
        node.image.dataset.side = side;
        node.image.alt = side === "head" ? "Head" : "Tail";
        node.image.src = coinSrc(side);
        if (side === "head") currentTotal += HEAD_BONUS;
        if (options.totalNode) options.totalNode.textContent = String(currentTotal);
        playSideSfx(side, options);

        const coin = { index, side, src: coinSrc(side) };
        coins[index] = coin;
        resolved += 1;
        options.onCoinResolved?.({
          index,
          side,
          src: coin.src,
          currentTotal,
          resolved,
          coinCount,
          headsChance,
        });
        finish();
      };

      nodes.forEach((node, index) => {
        if (auto) {
          global.setTimeout(() => resolveCoin(index), (index + 1) * intervalMs);
        } else {
          node.wrapper.style.cursor = "pointer";
          node.wrapper.addEventListener("click", () => resolveCoin(index), { once: true });
        }
      });
    });
  }

  global.LuminousCoinEngine = Object.freeze({
    HEAD_SRC,
    TAIL_SRC,
    HEAD_SFX,
    TAIL_SFX,
    DEFAULT_COIN_COUNT,
    HEAD_BONUS,
    clampHeadsChance,
    rollSide,
    coinSrc,
    runAnimatedRoll,
  });
})(window);
