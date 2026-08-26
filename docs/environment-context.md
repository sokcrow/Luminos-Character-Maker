# Environment Context Contract

## Goal

Environment is contextual state for encounters, zones, and actors. It is **not** a second Status Effect engine and it does not apply blanket combat penalties.

Weather, time, encounter type, local cover, water, terrain, and magical/artificial sources are resolved into one `Effective Environment`. Races, classes, archetypes, equipment, spells, and existing rules inspect that context through normal Trait Engine conditions.

## Resolution flow

```text
Weather / Time / Encounter Type
              ↓
      Environment Resolver
              ↓
       Encounter / Zone
              ↓
       Actor-local context
              ↓
      Effective Environment
              ↓
Traits / Vision / Movement / other specialized resolvers
```

Weather never directly edits an actor's attack, defense, saves, HP, SP, or Status Effects.

## Encounter Type

Supported canonical values:

- `outdoor`: exterior weather and sunlight are exposed normally.
- `covered`: exterior light remains, direct sunlight becomes diffuse, and direct precipitation is blocked.
- `indoor`: exterior weather and natural sunlight are blocked. Local light can override the default.
- `underground`: exterior weather and sunlight are blocked; unconfigured natural light defaults to Darkness.
- `underwater`: exterior weather is blocked and the encounter exposes the `Submerged` water context.
- `special`: reserved for encounters driven primarily by explicit overrides.

## Environment State

These are mutually exclusive state values, not stackable effects.

### Light

- `bright`
- `dim`
- `darkness`

`Darkness` describes the objective light state. Darkvision or another sense interprets it later. Magical darkness is represented by `light: "darkness"` with a `magical` state origin rather than a second light level.

### Sunlight

- `direct`
- `diffuse`
- `none`

Sunlight is independent from Light. Bright artificial lighting can therefore coexist with `sunlight: "none"`.

### Visibility

- `clear`
- `obscured`
- `heavily_obscured`

Visibility is independent from Light. Dense fog may be Heavily Obscured in Bright Light; a clear unlit cave can be Darkness with otherwise Clear visibility.

## Environment Effects

Environment effects are triggerable context. Severity documents which downstream resolver may care about them; it does not add a generic modifier.

### Water

| Effect | Purpose |
| --- | --- |
| `near_water` | Relevant accessible water is nearby. Trigger only. |
| `in_water` | Actor is physically in water. Swimming rules may inspect it. Implies `near_water`. |
| `submerged` | Actor is fully underwater. Underwater movement, breathing, combat, and traits may inspect it. Implies `in_water` and `near_water`. |

`Retreat - Submerged` is the canonical naming. Legacy `Sink` / `Retreat - Sink` identifiers normalize to `submerged` for compatibility.

### Exposure

| Effect | Purpose |
| --- | --- |
| `exposed` | Actor receives zone exposure normally. |
| `under_cover` | Blocks direct precipitation and reduces Direct Sunlight to Diffuse Sunlight. |
| `indoors` | Blocks exterior weather and natural sunlight. |

### Weather

| Effect | Purpose |
| --- | --- |
| `rain` | Context trigger; no blanket penalty. |
| `heavy_rain` | Severe rain; implies `rain` and may make visibility Obscured. |
| `snow` | Context trigger; no blanket penalty. |
| `heavy_snow` | Severe snow; implies `snow` and may make visibility Obscured. Accumulated terrain is separate. |
| `fog` | Makes visibility Obscured. |
| `dense_fog` | Makes visibility Heavily Obscured and implies `fog`. |
| `hail` | Preserves the existing Granizo weather as triggerable context. |
| `strong_wind` | Trigger for flight, projectiles, light objects, and mechanics that explicitly care about wind. |
| `storm` | Composite severe weather; implies Heavy Rain and Strong Wind. No additional blanket Storm penalty is added. |

### Temperature

- `extreme_heat`
- `extreme_cold`

They are severe exposure triggers. This change intentionally does **not** invent numeric temperature thresholds or new saves; a dedicated exposure rule can consume them later.

### Terrain

- `difficult_terrain`: movement resolver may increase movement cost.
- `hazardous_terrain`: a specific hazard defines its own consequence.
- `slippery`: actions that care about footing may inspect it.

## Origin tags

Every effect or state source may declare:

- `natural`
- `artificial`
- `magical`

`Natural Environment Effect` is therefore an origin query, not a separate status.

Examples:

```js
{ id: "difficult_terrain", origin: "natural" }
{ id: "difficult_terrain", origin: "artificial" }
{ id: "dense_fog", origin: "magical" }
```

All three can produce similar physical context while remaining distinguishable to Traits.

## Scope

Effects support:

- `encounter`
- `zone`
- `actor`

Weather normally resolves at Encounter scope. Terrain and nearby water commonly resolve at Zone scope. `In Water`, `Submerged`, and exposure relationships commonly resolve at Actor scope. An Underwater Encounter may promote `Submerged` to Encounter scope because every participant shares the medium.

## Weather mapping

The resolver keeps the weather vocabulary already used by `weather-engine.js`:

| Weather | Daylight environment |
| --- | --- |
| `soleado` | Bright Light + Direct Sunlight + Clear |
| `parcialmente_nublado` | Bright Light + Direct Sunlight + Clear |
| `nublado` | Bright Light + Diffuse Sunlight + Clear |
| `llovizna` | Diffuse Sunlight + Rain |
| `lluvia` | Diffuse Sunlight + Rain |
| `tormenta` | Diffuse Sunlight + Storm + Heavy Rain + Strong Wind + Obscured |
| `niebla` | Diffuse Sunlight + Fog + Obscured |
| `nieve` | Diffuse Sunlight + Snow |
| `nevada` | Diffuse Sunlight + Heavy Snow + Obscured |
| `granizo` | Diffuse Sunlight + Hail + Strong Wind + Obscured |

At night the natural Light state becomes `darkness` and Sunlight becomes `none`.

## Trait Engine triggers

No new Trait Engine trigger type is required. The current condition system can already read arbitrary runtime paths. Put the resolved snapshot at `runtime.environment`.

```js
const environment = LuminousEnvironmentEngine.resolveEnvironment({
  weatherId: "nublado",
  encounterType: "outdoor",
  isDay: true,
  water: { nearby: true, origin: "natural" },
});

const runtime = LuminousEnvironmentEngine.withEnvironment(existingRuntime, environment);
```

Traits can then use ordinary conditions.

### Direct Sunlight

```js
{
  path: "environment.state.sunlight",
  operator: "eq",
  value: "direct"
}
```

### Near Water

```js
{
  path: "environment.effectIds",
  operator: "contains",
  value: "near_water"
}
```

### Submerged

```js
{
  path: "environment.effectIds",
  operator: "contains",
  value: "submerged"
}
```

### Natural Environment Effect

```js
{
  path: "environment.origins",
  operator: "contains",
  value: "natural"
}
```

### Weather-category context

```js
{
  path: "environment.categories",
  operator: "contains",
  value: "weather"
}
```

## Mechanical boundary

This contract deliberately does not create generic `-2`, Disadvantage, damage, saves, or Status Effects from normal Environment context.

Downstream systems remain responsible for their own rules:

- Darkness / Heavily Obscured → Vision resolver.
- Difficult Terrain → Movement resolver.
- Submerged → underwater movement, breathing, combat, and trait rules.
- Extreme Heat / Extreme Cold → exposure resolver.
- Strong Wind → only mechanics that explicitly care about wind.

This keeps Environment extensible without duplicating the Status or Trait engines.
