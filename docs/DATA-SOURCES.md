# Data sources

Open Earth prefers authoritative public sources and keeps provenance visible in the UI. The operating rule is:

> **Reference geology → normalized repository snapshots. Live activity → direct APIs when browser-safe, otherwise frequently refreshed snapshots.**

Generated snapshots live in `data/`; `scripts/update_data.py` refreshes them and `.github/workflows/update-data.yml` runs the refresh daily. `data/manifest.json` records upstream URLs, generation time, and feature counts.

## P0: implemented

| Layer | Authority / upstream | Runtime strategy | Freshness | Notes |
| --- | --- | --- | --- | --- |
| Earthquakes | USGS Earthquake Hazards Program | direct GeoJSON API | near-real-time | 1h / 24h / 7d feeds; event time, magnitude, depth, place, canonical USGS URL |
| Known Holocene volcanoes | Smithsonian Global Volcanism Program (GVP), Volcanoes of the World | bundled snapshot; GVP WFS preferred by updater | daily snapshot of reference catalog | A catalog is **not** evidence of current activity |
| Volcanic reports | Smithsonian / USGS Weekly Volcanic Activity Report | bundled normalized snapshot generated from official RSS | daily check; source report updates weekly | This is deliberately called `Volcanic reports`: WVAR is not a comprehensive list of every eruption |
| Plate boundaries | PB2002 / Peter Bird, with USGS service retained as historical adapter | bundled snapshot | reference geology | Boundary semantics/classification are a P1 task |
| Active faults | GEM Global Active Faults | bundled snapshot, lazy rendered | daily check of reference dataset | Global dataset has known geographic completeness limits |
| Basemap | OpenFreeMap / OpenMapTiles / OpenStreetMap | direct vector tiles | provider-managed | Dark, Positron, Liberty, Fiord; Classic demo style retained |
| Place search | Nominatim / OpenStreetMap | direct request | live | Local volcano / visible earthquake matching is performed before remote geocoding |

### P0 reliability model

The browser should not depend on upstream CORS policy for reference geology. GitHub Actions performs cross-origin acquisition and normalization, commits changed snapshots, and the static app reads same-origin files. Direct USGS earthquake feeds remain live because they are designed for browser consumption.

If a local snapshot is temporarily absent, the current V2 compatibility adapters can still attempt the previous upstream path. Once the snapshot pipeline has proven stable, those browser-side compatibility fallbacks can be removed.

### Volcanic-report semantics

GVP states that the Weekly Volcanic Activity Report is preliminary and not comprehensive. Inclusion can represent new/continuing eruptive activity, unrest, ash advisories, alert changes, or other significant observations. Open Earth therefore must not equate `appears in WVAR` with `currently erupting`.

Official feed: `https://volcano.si.edu/news/WeeklyVolcanoRSS.xml`

## P1: next geological context

P1 turns the current collection of layers into a map that explains relationships.

### 1. Plate model and boundary semantics

**Goal:** selectable plate polygons/names and typed boundaries.

Desired normalized boundary classes:
- convergent / subduction
- divergent / spreading
- transform
- other / uncertain

Candidate sources: PB2002 and GPlates datasets. Research must verify dataset-specific licensing, attribution, geometry quality, stable identifiers, and whether polygons and boundary types can share one plate ID model.

### 2. Subduction zones and trenches

**Goal:** make volcanic arcs and deep earthquakes understandable rather than showing an unexplained line offshore.

Candidate sources: USGS, GEM and/or GPlates. Prefer a source with explicit trench/subduction semantics and provenance over deriving the classification visually.

### 3. Bathymetry / topographic relief

**Primary candidate: GEBCO.** GEBCO 2026 is a global 15-arc-second ocean-and-land terrain model, publishes a TID grid describing source-data types, and permits copying, adaptation and commercial use with attribution. The raw global grid is several GB, so Open Earth should derive web tiles or a low-resolution visualization rather than ship the grid. Do not present it as navigational data.

### 4. Regional current-volcano status adapters

GVP WVAR remains the global summary. P1 should research authoritative observatory feeds for higher-frequency status, starting with:
- USGS Volcano Hazards Program (United States)
- PVMBG / MAGMA Indonesia
- JMA (Japan)
- INGV (Italy)
- Icelandic Met Office
- GeoNet (New Zealand)
- PHIVOLCS (Philippines)
- VAAC volcanic-ash products

The normalized model must preserve the authority's own alert scale instead of pretending different national scales are interchangeable. USGS, for example, separately publishes ground Volcano Alert Levels and aviation color codes.

### P1 product work

- relationship queries: selected volcano → plate / nearest boundary / nearby earthquakes
- source-health and freshness surfaced per layer
- typed legends rather than one generic plate color
- richer detail/history panel
- source adapters split out of `src/app.js`
- tests for normalization and source fixtures

## P2: deeper solid-Earth exploration

P2 is intentionally planned but not committed to a specific upstream until source/licensing audits are complete.

| Capability | Candidate authority / dataset | Why it belongs |
| --- | --- | --- |
| Historical significant earthquakes | USGS / NOAA NCEI | compare present events with long-term seismic history |
| Historical tsunamis | NOAA NCEI Global Historical Tsunami Database | connects major earthquakes/volcanism to resulting solid-Earth hazards |
| GNSS crustal velocities | EarthScope / geodetic networks | directly visualizes plate motion as measured vectors |
| Earthquake focal mechanisms | USGS and regional networks | shows faulting mechanism, not just magnitude/location |
| Seafloor age | NOAA/NCEI and research datasets | makes spreading ridges and plate creation visually obvious |
| Heat flow | global heat-flow compilations | context for tectonic/volcanic systems |
| Ground deformation / InSAR | satellite/observatory products | shows measurable deformation around active systems |
| Geological maps | OneGeology / national geological surveys | adds rock age/lithology where interoperable licensing permits |
| Geothermal features | national/global geological datasets | useful volcanic/tectonic context without becoming a tourism layer |
| Landslides | authoritative inventories | only where tied to earthquake/volcanic solid-Earth context |

## Source acceptance checklist

A source is not promoted from candidate to implemented until we know:

1. authority and scientific meaning;
2. geographic coverage and known gaps;
3. update cadence and a machine-readable freshness signal;
4. stable IDs and enough metadata to join it to other layers;
5. license / terms / required attribution;
6. browser CORS behavior or a snapshot strategy;
7. expected transfer size and whether simplification/tiling is required;
8. failure behavior: one bad source must never break unrelated layers.

The UI should always distinguish **observed events**, **current reports/status**, and **reference geology**.
