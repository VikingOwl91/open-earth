# Architecture

Open Earth starts deliberately small: a static browser application that reads public geoscience services directly.

```text
USGS earthquakes ─┐
Smithsonian GVP ──┼─> source adapters ─> normalized features ─> map + UI
USGS plates ──────┘
```

## Principles

1. **Source-aware by default.** Preserve source IDs, URLs, timestamps, and source names through normalization and rendering.
2. **Separate events from features.** An earthquake is an event; a volcano or plate boundary is a geological feature. A catalog field such as `last_eruption` must never be presented as proof of current activity.
3. **Progressive enhancement.** One unavailable upstream source should disable one layer, not break the app.
4. **No backend until it earns its keep.** Add a worker/cache/database only when browser-direct access becomes a concrete limitation.
5. **Deep-linkable state later.** Map position, selected feature, layers, and time window should eventually be representable in the URL.

## MVP model

Adapters return GeoJSON-like features plus normalized metadata:

```js
{
  kind: "earthquake" | "volcano" | "plate-boundary",
  source: { id, name, url, fetchedAt },
  geometry,
  properties
}
```

The MVP currently renders source GeoJSON directly where practical and keeps source-specific parsing isolated in `src/app.js`. Split adapters into modules once they become non-trivial.

## Likely next steps

- distinguish plate-boundary types visually
- current volcanic activity as a separate layer from the GVP volcano catalog
- proper geocoding/search provider and URL state
- volcano detail/history panel
- nearby geological context queries
- source-health/freshness UI
- tests for source normalization
