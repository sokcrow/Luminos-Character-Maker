(function (global) {
  "use strict";

  const HEAD_SRC = "https://imgur.com/yshLPnQ.png";
  const TAIL_SRC = "https://imgur.com/XDx0ICt.png";

  // Unbreakable / Red Coin canonical UI assets.
  // `active` = intact Red Coin; `latent` = cracked Red Coin after losing a Clash.
  const UNBREAKABLE_HEAD_SRC = "https://imgur.com/yCxmI84.png";
  const UNBREAKABLE_TAIL_SRC = "https://imgur.com/12jXebG.png";
  const UNBREAKABLE_CRACKED_HEAD_SRC = "https://imgur.com/3wKu1xC.png";
  const UNBREAKABLE_CRACKED_TAIL_SRC = "https://imgur.com/lFKCm2b.png";

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

  function normalizeSide(side) {
    return String(side || "tail").toLowerCase() === "head" ? "head" : "tail";
  }

  function normalizeCoinType(value) {
    const raw = String(value || "normal").trim().toLowerCase();
    if (raw === "unbreakable" || raw === "red" || raw === "red_coin" || raw === "unbreakable_coin") {
      return "unbreakable";
    }
    return "normal";
  }

  function normalizeCoinStatus(value) {
    const raw = String(value || "active").trim().toLowerCase();
    if (raw === "latent" || raw === "cracked") return "latent";
    return "active";
  }

  function coinVisualState(coin = {}) {
    const type = normalizeCoinType(coin.type ?? coin.coinType);
    const status = type === "unbreakable"
      ? normalizeCoinStatus(coin.status ?? coin.coinStatus)
      : "active";
    return Object.freeze({
      type,
      status,
      unbreakable: type === "unbreakable",
      cracked: type === "unbreakable" && status === "latent",
    });
  }

  function rollSide(headsChance, rng) {
    const random = typeof rng === "function" ? rng : global.Math.random;
    return (random() * 100) < clampHeadsChance(headsChance) ? "head" : "tail";
  }

  function coinSrc(side, coin = {}) {
    const normalizedSide = normalizeSide(side);
    const state = coinVisualState(coin);

    if (state.unbreakable) {
      if (state.cracked) {
        return normalizedSide === "head"
          ? UNBREAKABLE_CRACKED_HEAD_SRC
          : UNBREAKABLE_CRACKED_TAIL_SRC;
      }
      return normalizedSide === "head"
        ? UNBREAKABLE_HEAD_SRC
        : UNBREAKABLE_TAIL_SRC;
    }

    return normalizedSide === "head" ? HEAD_SRC : TAIL_SRC;
  }

  function playSideSfx(side, options = {}) {
    if (options.silent || typeof global.Audio !== "function") return;
    try {
      const audio = new global.Audio(normalizeSide(side) === "head" ? HEAD_SFX : TAIL_SFX);
      audio.volume = Math.max(0, Math.min(1, numberOr(options.volume, 0.3)));
      const result = audio.play();
      if (result?.catch) result.catch(() => {});
    } catch (_) {}
  }

  function createCoinNode(doc, index, coinDefinition = {}) {
    const state = coinVisualState(coinDefinition);
    const wrapper = doc.createElement("div");
    wrapper.className = "coin-toss-item luminous-core-coin";
    wrapper.dataset.coinIndex = String(index);
    wrapper.dataset.state = "spinning";
    wrapper.dataset.coinType = state.type;
    wrapper.dataset.coinStatus = state.status;
    Object.assign(wrapper.style, {
      width: "60px",
      height: "60px",
      position: "relative",
      cursor: "default",
    });

    const image = doc.createElement("img");
    image.src = coinSrc("tail", coinDefinition);
    image.alt = state.unbreakable
      ? (state.cracked ? `Cracked Red Coin ${index + 1}` : `Red Coin ${index + 1}`)
      : `Coin ${index + 1}`;
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

    return { wrapper, image, animation, definition: coinDefinition, visualState: state };
  }

  function runAnimatedRoll(options = {}) {
    const doc = options.document || global.document;
    const container = options.container;
    if (!doc || !container) return Promise.reject(new Error("Coin Engine requiere un contenedor DOM."));

    const providedCoins = Array.isArray(options.coins)
      ? options.coins
      : (Array.isArray(options.coinDefinitions) ? options.coinDefinitions : []);
    const fallbackCount = providedCoins.length || DEFAULT_COIN_COUNT;
    const coinCount = Math.max(1, Math.trunc(numberOr(options.coinCount, fallbackCount)));
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
      const definition = providedCoins[index] || {};
      const node = createCoinNode(doc, index, definition);
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

        const definition = node.definition || {};
        const visualState = node.visualState || coinVisualState(definition);
        const forcedSide = String(definition.side || "").toLowerCase();
        const side = forcedSide === "head" || forcedSide === "tail"
          ? forcedSide
          : rollSide(headsChance, options.rng);
        const src = coinSrc(side, definition);

        node.wrapper.dataset.side = side;
        node.image.dataset.side = side;
        node.image.alt = `${visualState.cracked ? "Cracked " : ""}${visualState.unbreakable ? "Red Coin " : ""}${side === "head" ? "Head" : "Tail"}`;
        node.image.src = src;

        // A latent Unbreakable Coin has already lost its Clash. CombatEngine resolves
        // that doctrine at fixed Power 1, so the generic UI toss must not grant its
        // normal Heads bonus a second time.
        const contributesHeadBonus = side === "head" && !visualState.cracked;
        if (contributesHeadBonus) currentTotal += HEAD_BONUS;
        if (options.totalNode) options.totalNode.textContent = String(currentTotal);
        playSideSfx(side, options);

        const coin = {
          index,
          side,
          src,
          type: visualState.type,
          status: visualState.status,
          unbreakable: visualState.unbreakable,
          cracked: visualState.cracked,
          contributesHeadBonus,
        };
        coins[index] = coin;
        resolved += 1;
        options.onCoinResolved?.({
          ...coin,
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
    UNBREAKABLE_HEAD_SRC,
    UNBREAKABLE_TAIL_SRC,
    UNBREAKABLE_CRACKED_HEAD_SRC,
    UNBREAKABLE_CRACKED_TAIL_SRC,
    HEAD_SFX,
    TAIL_SFX,
    DEFAULT_COIN_COUNT,
    HEAD_BONUS,
    clampHeadsChance,
    normalizeCoinType,
    normalizeCoinStatus,
    coinVisualState,
    rollSide,
    coinSrc,
    runAnimatedRoll,
  });
})(typeof window !== "undefined" ? window : globalThis);
