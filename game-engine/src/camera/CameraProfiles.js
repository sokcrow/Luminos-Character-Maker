export const CAMERA_PROFILES = Object.freeze({
  localFixed: Object.freeze({
    id: "local-fixed",
    distance: 0.42,
    height: 0.433,
    fovBias: -3.25,
    deadZone: 0.72,
    lookAhead: 0.62
  }),
  globalMap: Object.freeze({
    id: "global-map",
    distance: 1,
    height: 1,
    fovBias: 0,
    deadZone: 0,
    lookAhead: 0
  })
});

export function resolveCameraProfile(profile = "localFixed") {
  if (profile && typeof profile === "object") return Object.freeze({ ...profile });
  return CAMERA_PROFILES[profile] || CAMERA_PROFILES.localFixed;
}
