const DEFAULT_CACHE = "luminous-game-engine-assets-v1";

export class BrowserAssetCache {
  constructor({ cacheName = DEFAULT_CACHE } = {}) {
    this.cacheName = cacheName;
    this.objectUrls = new Set();
  }

  get supported() {
    return Boolean(globalThis.caches && globalThis.fetch);
  }

  async response(url, { reload = false } = {}) {
    if (!url) throw new Error("Asset URL is required");
    const request = new Request(url, { mode: "cors", credentials: "omit" });
    if (!this.supported) return fetch(request);

    const cache = await caches.open(this.cacheName);
    if (!reload) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }

    const response = await fetch(request);
    if (!response.ok) throw new Error(`Asset request failed: ${response.status} ${url}`);
    await cache.put(request, response.clone());
    return response;
  }

  async objectUrl(url, options = {}) {
    const response = await this.response(url, options);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    this.objectUrls.add(objectUrl);
    return objectUrl;
  }

  revoke(objectUrl) {
    if (!this.objectUrls.has(objectUrl)) return false;
    URL.revokeObjectURL(objectUrl);
    this.objectUrls.delete(objectUrl);
    return true;
  }

  async clear() {
    if (!this.supported) return false;
    return caches.delete(this.cacheName);
  }

  dispose() {
    for (const url of this.objectUrls) URL.revokeObjectURL(url);
    this.objectUrls.clear();
  }
}
