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

The browser treats repository snapshots as authoritative. It must not silently retry CORS-prone scientific upstreams when a snapshot is empty; emptiness/staleness is surfaced as data state instead.

## Normalized feature direction

Adapters should converge on a source-aware envelope rather than leaking upstream field names everywhere:

```js
{
  kind: 'earthquake' | 'volcano' | 'volcanic-report' | 'plate-boundary' | 'fault',
  id: 'source-stable-id',
  source: { id: 'gvp', name: 'Smithsonian Global Volcanism Program', url: 'https://…', fetchedAt: '2026-…' },
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

P1 adds **relationships**, typed geological context, and time-aware exploration:

- historical search by time range, magnitude/depth, region/map bounds and feature type
- plate polygons + stable plate IDs
- typed plate boundaries
- subduction zones / trenches
- GEBCO-derived bathymetric/topographic visualization
- regional volcano-status adapters
- selected-feature context queries (volcano → plate → boundary → nearby events)
- adapter modules and fixture-based normalization tests
- per-layer freshness/health UI

### Geology Context Inspector target

The details card should evolve into the primary explanation surface rather than a raw-property popup. For a selected volcano such as Krakatau, target sections are:

- **Overview:** canonical name, aliases, GVP ID, country/region, coordinates, type and elevation.
- **Status / Activity:** current observatory status where available plus the latest GVP Weekly Volcanic Activity Report, report period, summary and source link. A weekly report remains a report, not a universal active/inactive truth flag.
- **Geology:** tectonic setting, volcanic arc, plate/subduction context and eventually trench/bathymetry context.
- **History:** selected eruption/report history with links to the authoritative catalog; historical search should be able to pivot from here.
- **Nearby:** nearest boundary/trench/fault and relevant earthquakes for an explicit time/radius window.
- **Sources:** provenance and freshness for every fact group.

Search should prefer exact/local scientific entities over geocoding results. A query such as `krakatau` should present the GVP volcano first and may show the Nominatim place separately; selecting one must never borrow coordinates/properties from the other.

The long-term visual direction is a dense but readable dark GIS explorer: map remains primary, selected activity is visually distinct, search results identify entity type/source, and the inspector can grow into tabbed Overview / Activity / Geology / History / Nearby / Sources views without hiding provenance.

Raster-scale products such as GEBCO must be preprocessed into web-appropriate tiles/overviews; multi-gigabyte scientific grids never belong in the runtime bundle.

## P2 architecture

P2 adds deeper optional datasets such as historical earthquakes/tsunamis, GNSS velocity vectors, focal mechanisms, seafloor age, heat flow, InSAR deformation and interoperable geological maps. Each remains an independent adapter/layer so Open Earth does not turn into a monolithic disaster dashboard.

See `DATA-SOURCES.md` for the source registry, acceptance checklist, and candidate authorities.
