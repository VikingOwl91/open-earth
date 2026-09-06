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

## P1.5 stabilization and consolidated modular architecture

P1 proved the scientific feature set, but runtime feature additions created a monkey-patch chain (`app.js` -> `ui-fixes.js` -> `tectonics.js` -> `exploration.js` -> `history.js` -> `inspector-v2.js` -> `bathymetry.js` -> `trenches.js` -> `semantic-markers.js` -> `inspector-unified.js` -> `pvmbg.js` -> `pvmbg-inspector.js`).

P1.5 consolidates this into clean, modular, unidirectional ES modules under `src/` without monkey-patching or circular dependencies:

```text
┌─────────────────────────────────────────────────────────────┐
│                          index.html                         │
└───────┬──────────────────────┬──────────────────────┬───────┘
        │                      │                      │
   ┌────▼─────┐          ┌─────▼──────┐         ┌─────▼──────┐
   │  geo.js  │          │  state.js  │         │ providers.js│
   └────┬─────┘          └─────┬──────┘         └─────┬──────┘
        │                      │                      │
        │                ┌─────▼──────┐               │
        ├───────────────►│  data.js   │◄──────────────┤
        │                └─────┬──────┘               │
        │                      │                      │
   ┌────▼─────┐          ┌─────▼──────┐         ┌─────▼──────┐
   │  map.js  │◄─────────┤inspector.js│         │  search.js │
   └────┬─────┘          └─────┬──────┘         └─────┬──────┘
        │                      │                      │
        │                ┌─────▼──────┐               │
        └───────────────►│   app.js   │◄──────────────┘
                         └─────┬──────┘
                         ┌─────▼──────┐
                         │ modals.js  │
                         └────────────┘
```

### Module roles

1. **`src/geo.js`**: Pure spatial math (`haversine`, `pointSegmentKm`, `nearestLine`, `segments`, `pointInRing`, `pointInPolygon`, `containingPlate`, `boundaryContext`, `centerOfGeometry`, `nearbyQuakes`, `STEP_META`) and HTML escaping/formatting (`esc`, `norm`, `value`, `fmtDate`). Zero dependencies, runs identically in browser and Node.js test runners.
2. **`src/state.js`**: Centralized state management. Serializes and parses the URL state schema (`?v=type:id&c=lat,lng,z...`), manages `localStorage` fallback persistence, pushes state on feature selection, replaces state on camera drag, and handles `popstate` events for browser Back/Forward navigation.
3. **`src/providers.js`**: Adapters for regional volcano monitoring authorities (PVMBG, USGS, JMA, GeoNet). Preserves native alert scales, applies conservative fuzzy matching against Smithsonian VolcanoNumbers, computes relative alert ages, and emits custom alert events.
4. **`src/data.js`**: In-memory data store with single-flight cache (`fetchCache`) and promise re-use. Eliminates duplicate network requests for `eruptions.json`, `trenches.json`, and reference catalogs. Exposes direct entity lookups (`findVolcano`, `findReportForVolcano`, `findEruptionsForVolcano`, `findTrench`, `findFault`, `findBoundary`, `findEarthquake`).
5. **`src/map.js`**: MapLibre GL wrapper. Handles layer creation, styling, and toggling. Provides robust basemap switching across all 5 styles (`dark`, `positron`, `liberty`, `fiord`, `classic`) by listening to MapLibre's `style.load` lifecycle event and rehydrating all application sources, layers, and selections.
6. **`src/inspector.js`**: Unified feature inspector for all 5 feature types (`volcano`, `earthquake`, `trench`, `fault`, `boundary`). Implements header actions (Back, Share URL, Close), tabbed views (Overview, History, Nearby, Sources), bounded report summaries (preventing wall-of-text issues), lazy Wikipedia imagery, and 3-tier geodynamic classification.
7. **`src/search.js`**: Search orchestrator. Unifies local catalog matching (volcanoes, trenches) with remote OpenStreetMap Nominatim geocoding and historical USGS seismic catalog queries via FDSNWS.
8. **`src/modals.js`**: Accessible dialog controllers for About, Impressum (German legal representation), and Datenschutz (privacy & audited network requests).
9. **`src/app.js`**: Bootstrapper wiring the modules, synchronizing DOM controls, and managing application startup.

### Solved architectural debts

- **Elimination of runtime monkey-patching**: 13 legacy scripts and stylesheets were removed in favor of the clean modular architecture.
- **Single-fetch guarantee**: Layer data is fetched at most once per session and cached in-memory.
- **Kilauea wall-of-text**: Long narrative reports now render a clean bounded excerpt with an interactive toggle (`Show full report (N words) ↓` / `Collapse report ↑`), ensuring basic volcano details and observatory alerts remain immediately visible.
- **Full deep linking & browser history**: Selecting features pushes history entries; dragging the map replaces URL camera parameters; browser Back and Forward buttons navigate through the feature selection stack seamlessly.
- **Resilient basemap rehydration**: Switching basemaps reliably rehydrates all geological and earthquake layers without layer loss or orphaned listeners.

## P2 architecture

P2 adds deeper optional datasets such as historical earthquakes/tsunamis, GNSS velocity vectors, focal mechanisms, seafloor age, heat flow, InSAR deformation and interoperable geological maps. Each remains an independent adapter/layer so Open Earth does not turn into a monolithic disaster dashboard.

See `DATA-SOURCES.md` for the source registry, acceptance checklist, and candidate authorities.

