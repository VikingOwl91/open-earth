# Open Earth

**A modern open-source map for understanding what the Earth is doing - and why.**

Open Earth combines live seismic activity with volcanoes and tectonic context in one small, source-aware web app.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Y4N626HMX7)

## Features

- Live earthquakes from the USGS GeoJSON feed with magnitude and depth filtering
- Enriched historical earthquake catalog search with spatial radius and map bound pivots
- Holocene volcano catalog from the Smithsonian Global Volcanism Program (GVP)
- Multi-provider regional volcano monitoring:
  - PVMBG / MAGMA Indonesia (Level I to IV alert levels)
  - USGS Volcano Hazards Program (Alert levels and aviation color codes)
  - Japan Meteorological Agency (JMA volcanic warnings)
  - GeoNet New Zealand / GNS Science (Volcanic Alert Levels)
- PB2002 tectonic plate model with named plates and typed boundary kinematics (subduction, convergent, divergent, transform)
- IHO-IOC GEBCO Gazetteer named undersea trenches and optional shaded-relief bathymetry
- Active faults from the GEM Global Active Faults database
- 3-tier geodynamic classification distinguishing authoritative catalog facts (REFERENCE), live/recent observations (OBSERVED), and spatial proximity analysis (DERIVED)
- Navigable relationship graph with back-stack history across all 5 feature types (Volcano, Earthquake, Fault, Boundary, Trench)
- Search for places, volcanoes, and visible earthquake regions
- Static deployment: no account, database, API key, or backend required

## Run locally

This is a static ES-module app, so any local HTTP server works:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Why this exists

Excellent public datasets already exist, but they are fragmented across specialist tools. Open Earth aims to make the relationship between **earthquakes, volcanoes, and plate tectonics** immediately explorable without hiding where the data came from or how fresh it is.

A core rule:

> Every displayed fact should know where it came from and how old it is.

See [DATA-SOURCES.md](docs/DATA-SOURCES.md) and [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Scope

Open Earth is a geology explorer, not a general disaster dashboard. Wildfires, storms, floods, and similar hazards are intentionally out of scope unless they directly support solid-Earth context.

## Status

P1 feature-complete: multi-provider regional monitoring, tectonic boundary kinematics, GEBCO trenches, navigable relationship stack, and geodynamic classification tiers.

## License

MIT
