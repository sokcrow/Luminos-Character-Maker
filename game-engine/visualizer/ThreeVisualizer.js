const THREE_MODULE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mix(a, b, amount) {
  return a + (b - a) * amount;
}

function colorChannels(hex) {
  const value = Number.parseInt(String(hex).replace("#", ""), 16);
  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255
  };
}

function terrainColor(sample = {}) {
  const grass = colorChannels("#668d4f");
  const wet = colorChannels("#486b49");
  const rock = colorChannels("#81796b");
  const bank = colorChannels("#82765d");
  const slope = clamp(finite(sample.slope) / 0.9, 0, 1);
  const wetness = clamp(finite(sample.hydrology?.wetness), 0, 1);
  const bankAmount = /bank/i.test(String(sample.hydrology?.class || "")) ? 0.72 : 0;
  const base = {
    r: mix(grass.r, wet.r, wetness * 0.75),
    g: mix(grass.g, wet.g, wetness * 0.75),
    b: mix(grass.b, wet.b, wetness * 0.75)
  };
  const rocky = {
    r: mix(base.r, rock.r, slope * 0.78),
    g: mix(base.g, rock.g, slope * 0.78),
    b: mix(base.b, rock.b, slope * 0.78)
  };
  return {
    r: mix(rocky.r, bank.r, bankAmount),
    g: mix(rocky.g, bank.g, bankAmount),
    b: mix(rocky.b, bank.b, bankAmount)
  };
}

function normalizedBounds(mapSystem) {
  const bounds = mapSystem?.active?.data?.bounds || mapSystem?.active?.definition?.bounds || {};
  return {
    minX: finite(bounds.minX, -64),
    maxX: finite(bounds.maxX, 64),
    minZ: finite(bounds.minZ, -64),
    maxZ: finite(bounds.maxZ, 64)
  };
}

function createTexture(THREE, url, repeatX = 10, repeatY = 10) {
  const texture = new THREE.TextureLoader().load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createTerrainMesh(THREE, runtime, bounds, segments = 112) {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.minX + bounds.maxX) * 0.5;
  const centerZ = (bounds.minZ + bounds.maxZ) * 0.5;
  const geometry = new THREE.PlaneGeometry(width, depth, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(centerX, 0, centerZ);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const sample = runtime.map.sampleTerrain({ x, z }) || {};
    positions.setY(index, finite(sample.height));
    const color = terrainColor(sample);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = "procedural-terrain";
  return mesh;
}

function createWaterMeshes(THREE, runtime, bounds, segments = 104) {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const dx = width / segments;
  const dz = depth / segments;
  const waterPositions = [];
  const waterUvs = [];
  const foamPositions = [];
  const foamUvs = [];

  function waterAt(x, z) {
    return runtime.map.sampleWater({ x, z });
  }

  function pushCell(targetPositions, targetUvs, x0, x1, z0, z1, y, uvScale = 0.075) {
    targetPositions.push(
      x0, y, z0, x1, y, z0, x1, y, z1,
      x0, y, z0, x1, y, z1, x0, y, z1
    );
    targetUvs.push(
      x0 * uvScale, z0 * uvScale, x1 * uvScale, z0 * uvScale, x1 * uvScale, z1 * uvScale,
      x0 * uvScale, z0 * uvScale, x1 * uvScale, z1 * uvScale, x0 * uvScale, z1 * uvScale
    );
  }

  for (let iz = 0; iz < segments; iz += 1) {
    const z0 = bounds.minZ + iz * dz;
    const z1 = z0 + dz;
    for (let ix = 0; ix < segments; ix += 1) {
      const x0 = bounds.minX + ix * dx;
      const x1 = x0 + dx;
      const centerX = (x0 + x1) * 0.5;
      const centerZ = (z0 + z1) * 0.5;
      const water = waterAt(centerX, centerZ);
      if (!water?.depth) continue;
      const y = finite(water.surface, runtime.map.sampleTerrain({ x: centerX, z: centerZ })?.height + 0.08);
      pushCell(waterPositions, waterUvs, x0, x1, z0, z1, y + 0.035);

      const neighbors = [
        waterAt(centerX - dx, centerZ),
        waterAt(centerX + dx, centerZ),
        waterAt(centerX, centerZ - dz),
        waterAt(centerX, centerZ + dz)
      ];
      if (neighbors.some(sample => !sample?.depth)) {
        pushCell(foamPositions, foamUvs, x0, x1, z0, z1, y + 0.065, 0.16);
      }
    }
  }

  function geometryFrom(positions, uvs) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    return geometry;
  }

  const waterTexture = createTexture(THREE, "../../Assets/Images/World/Water/water_seamless.png", 12, 12);
  const foamTexture = createTexture(THREE, "../../Assets/Images/World/Water/coast_foam_seamless.png", 18, 18);

  const waterMaterial = new THREE.MeshStandardMaterial({
    map: waterTexture,
    color: 0x6da6b2,
    transparent: true,
    opacity: 0.82,
    roughness: 0.28,
    metalness: 0.05,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const foamMaterial = new THREE.MeshBasicMaterial({
    map: foamTexture,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const waterMesh = new THREE.Mesh(geometryFrom(waterPositions, waterUvs), waterMaterial);
  const foamMesh = new THREE.Mesh(geometryFrom(foamPositions, foamUvs), foamMaterial);
  waterMesh.renderOrder = 2;
  foamMesh.renderOrder = 3;
  waterMesh.name = "procedural-water";
  foamMesh.name = "procedural-coast-foam";
  return { waterMesh, foamMesh, waterTexture, foamTexture };
}

function createPlayerMesh(THREE) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.52, 1.05, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xe8d7a4, roughness: 0.68 })
  );
  body.castShadow = true;
  body.receiveShadow = true;
  body.position.y = 1.05;
  group.add(body);

  const facing = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.55, 8),
    new THREE.MeshStandardMaterial({ color: 0x37434c, roughness: 0.72 })
  );
  facing.rotation.x = Math.PI / 2;
  facing.position.set(0, 1.1, -0.78);
  group.add(facing);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);
  group.name = "player-unit";
  return group;
}

export class ThreeVisualizer {
  constructor({ root, runtime, player } = {}) {
    if (!root) throw new Error("ThreeVisualizer requires a root element");
    if (!runtime) throw new Error("ThreeVisualizer requires GameRuntime");
    if (!player) throw new Error("ThreeVisualizer requires a player Unit");
    this.root = root;
    this.runtime = runtime;
    this.player = player;
    this.THREE = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.playerMesh = null;
    this.water = null;
    this.resizeObserver = null;
    this.frameHandle = null;
    this.disposed = false;
    this.lastCameraTarget = null;
    this.cameraProfile = null;
  }

  async mount() {
    if (this.renderer) return this;
    const THREE = await import(THREE_MODULE_URL);
    this.THREE = THREE;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9db7c2);
    this.scene.fog = new THREE.FogExp2(0x9db7c2, 0.0095);

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.root.replaceChildren(this.renderer.domElement);
    this.renderer.domElement.setAttribute("aria-label", "Mundo 3D jugable");

    const hemisphere = new THREE.HemisphereLight(0xc9e0e8, 0x4c493b, 2.05);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(0xfff0cf, 2.15);
    sun.position.set(-24, 42, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    this.scene.add(sun);

    const bounds = normalizedBounds(this.runtime.map);
    this.scene.add(createTerrainMesh(THREE, this.runtime, bounds));
    this.water = createWaterMeshes(THREE, this.runtime, bounds);
    this.scene.add(this.water.waterMesh, this.water.foamMesh);

    this.playerMesh = createPlayerMesh(THREE);
    this.scene.add(this.playerMesh);

    this.runtime.camera.attachBridge({
      cameraProfile: () => this.cameraProfile,
      setCameraTarget: (target, profile) => {
        this.cameraProfile = profile || this.cameraProfile;
        if (target) this.lastCameraTarget = { ...target };
      },
      updateCamera: payload => {
        this.cameraProfile = payload?.profile || this.cameraProfile;
        this.lastCameraTarget = payload?.target ? { ...payload.target } : this.lastCameraTarget;
      }
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.root);
    this.resize();
    this.#renderFrame(0);
    return this;
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const rect = this.root.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  #syncPlayer(dt) {
    if (!this.playerMesh) return;
    const transform = this.player.transform || {};
    const x = finite(transform.x);
    const y = finite(transform.y);
    const z = finite(transform.z);
    this.playerMesh.position.set(x, y, z);
    const vx = finite(this.player.state?.velocity?.x);
    const vz = finite(this.player.state?.velocity?.z);
    if (Math.hypot(vx, vz) > 0.02) {
      const targetYaw = Math.atan2(-vx, -vz);
      const current = this.playerMesh.rotation.y;
      const delta = Math.atan2(Math.sin(targetYaw - current), Math.cos(targetYaw - current));
      this.playerMesh.rotation.y += delta * clamp(dt * 12, 0, 1);
    }
  }

  #syncCamera(dt) {
    const target = this.lastCameraTarget || this.player.transform;
    if (!target || !this.camera) return;
    const profile = this.cameraProfile || {};
    const distance = 15 + finite(profile.distance, 0.42) * 17;
    const height = 11 + finite(profile.height, 0.433) * 19;
    const lookAhead = finite(profile.lookAhead, 0.62) * 1.6;
    const desiredX = finite(target.x) + distance * 0.72;
    const desiredY = finite(target.y) + height;
    const desiredZ = finite(target.z) + distance;
    const amount = 1 - Math.exp(-Math.max(0, dt) * 8.5);
    this.camera.position.x = mix(this.camera.position.x || desiredX, desiredX, amount || 1);
    this.camera.position.y = mix(this.camera.position.y || desiredY, desiredY, amount || 1);
    this.camera.position.z = mix(this.camera.position.z || desiredZ, desiredZ, amount || 1);
    this.camera.lookAt(finite(target.x) - lookAhead, finite(target.y) + 0.85, finite(target.z) - lookAhead);
  }

  #renderFrame(timeMs) {
    if (this.disposed) return;
    const previous = this._lastRenderAt || timeMs;
    const dt = clamp((timeMs - previous) / 1000, 0, 0.1);
    this._lastRenderAt = timeMs;
    this.#syncPlayer(dt);
    this.#syncCamera(dt || 1 / 60);
    if (this.water) {
      const time = timeMs * 0.000055;
      this.water.waterTexture.offset.set(time, time * 0.42);
      this.water.foamTexture.offset.set(time * 0.34, -time * 0.18);
    }
    this.renderer?.render(this.scene, this.camera);
    this.frameHandle = requestAnimationFrame(t => this.#renderFrame(t));
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frameHandle != null) cancelAnimationFrame(this.frameHandle);
    this.resizeObserver?.disconnect();
    this.scene?.traverse?.(object => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose?.());
      else object.material?.dispose?.();
    });
    this.water?.waterTexture?.dispose?.();
    this.water?.foamTexture?.dispose?.();
    this.renderer?.dispose?.();
    this.root.replaceChildren();
  }
}
