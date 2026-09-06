# Architecture

Open Earth is a static, source-aware geology explorer. A backend is not required for users, but a small build-time data pipeline shields the browser from CORS, upstream churn, and unnecessarily large reference downloads.

```text
                         ┌─ USGS earthquakes ────────────────> browser (live)
                         │
upstream geology ─> scheduled normalizer ─> data/*.json ───> browser
                         │
                         └─ data/manifest.json (freshness + provenance)

browser data ─> source adapters ─> normalized features ─> map + details/search
```

## Principles

1. **Source-aware by default.** Preserve source IDs, URLs, timestamps, source names, and acquisition time through normalization and rendering.
2. **Separate events, reports, status and features.** An earthquake is an event; a WVAR entry is a report; an observatory alert is a status; a volcano/fault/plate is a geological feature. Never infer one category from another.
3. **Reference geology → snapshots. Live activity → APIs where appropriate.** Stable or heavy data is acquired outside the browser. Truly live, browser-safe feeds such as USGS earthquakes stay direct.
4. **Progressive enhancement.** One unavailable upstream source disables or stales one layer, not the app.
5. **Static runtime.** No account, API key, application server or database is required to explore the map.
6. **Freshness is data.** Every generated snapshot records when it was acquired. Future UI should expose this per layer.
7. **Do not silently homogenize scientific semantics.** National volcano alert scales, boundary classifications and confidence fields keep their original meaning; normalized convenience fields must retain the original value/source.
8. **Deep-linkable state.** Map position, selected feature, layers, basemap, projection and time window should ultimately be representable in the URL.

## P0 pipeline

`scripts/update_data.py` uses only Python's standard library and writes normalized browser-safe artifacts under `data/`:

- `volcanoes.json`
- `volcanic-reports.json`
- `plates.json`
- `faults.json`
- `manifest.json`

`.github/workflows/update-data.yml` runs daily and can be dispatched manually. It commits only changed generated data. Earthquakes intentionally remain direct USGS feeds.

The current V2 keeps compatibility fallbacks while the pipeline proves itself. They should be removed after the generated datasets are stable.

## Normalized feature direction

Adapters should converge on a source-aware envelope rather than leaking upstream field names everywhere:

```js
{
  kind: 'earthquake' | 'volcano' | 'volcanic-report' | 'plate-boundary' | 'fault',
  id: 'source-stable-id',
  source: {
    id: 'gvp',
    name: 'Smithsonian Global Volcanism Program',
    url: 'https://…',
    fetchedAt: '2026-…'
  },
  observedAt: null,
  validFrom: null,
  validTo: null,
  geometry: {},
  properties: {},
  raw: {}
}
```

Do not force every source into every temporal field. Reference geology may only have `fetchedAt`; an earthquake has `observedAt`; an alert may have a validity interval.

## P1 architecture

P1 adds **relationships** and typed geological context:

- plate polygons + stable plate IDs
- typed plate boundaries
- subduction zones / trenches
- GEBCO-derived bathymetric/topographic visualization
- regional volcano-status adapters
- selected-feature context queries (volcano → plate → boundary → nearby events)
- adapter modules and fixture-based normalization tests
- per-layer freshness/health UI

Raster-scale products such as GEBCO must be preprocessed into web-appropriate tiles/overviews; multi-gigabyte scientific grids never belong in the runtime bundle.

## P2 architecture

P2 adds deeper optional datasets such as historical earthquakes/tsunamis, GNSS velocity vectors, focal mechanisms, seafloor age, heat flow, InSAR deformation and interoperable geological maps. Each remains an independent adapter/layer so Open Earth does not turn into a monolithic disaster dashboard.

See `DATA-SOURCES.md` for the source registry, acceptance checklist, and candidate authorities.
