# Open Earth

**A modern open-source map for understanding what the Earth is doing — and why.**

Open Earth combines live seismic activity with volcanoes and tectonic context in one small, source-aware web app.

## MVP

- Live earthquakes from the USGS GeoJSON feed
- Holocene volcano catalog from Smithsonian GVP WFS
- Tectonic plate boundaries from USGS
- Layer toggles and earthquake time windows
- Search for places, volcanoes, and visible earthquake names
- Clickable features with source links and timestamps
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

Very early MVP. Expect rough edges and upstream-source quirks.

## License

MIT
