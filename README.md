# 🌍 Open Earth

> **A modern open-source map for understanding what the Earth is doing — and why.**

Open Earth is an open-source, source-aware explorer for earthquakes, volcanoes, tectonics, faults, trenches, bathymetry, and the relationships between them.

**[Explore Open Earth →](https://open-earth.info)**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live](https://img.shields.io/badge/live-open--earth.info-success)](https://open-earth.info)
[![Vanilla JS](https://img.shields.io/badge/frontend-Vanilla%20JS-f7df1e)](#development)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Y4N626HMX7)

## What Open Earth does

Public Earth-science data is extraordinarily rich, but it is spread across specialist catalogs, observatories, feeds, and scientific products. Open Earth brings those sources into one explorable map while preserving where information came from, how old it is, and what it actually means.

A core rule of the project is:

> **Every displayed fact should know where it came from and how old it is.**

Open Earth also distinguishes between:

- **REFERENCE** — authoritative catalog or model information
- **OBSERVED** — live or recent observations and official status information
- **DERIVED** — relationships computed by Open Earth, such as spatial proximity

Spatial proximity is context, **not a claim of causation**.

## ✨ Features

- **Live earthquakes** from the USGS GeoJSON feed with magnitude and depth filtering
- **Historical earthquake search** with spatial-radius and map-bound pivots
- **Holocene volcano catalog** from the Smithsonian Global Volcanism Program (GVP)
- **Regional volcano monitoring** from multiple authoritative providers:
  - PVMBG / MAGMA Indonesia
  - USGS Volcano Hazards Program
  - Japan Meteorological Agency (JMA)
  - GeoNet New Zealand / GNS Science
- **Plate tectonics** using the PB2002 model with named plates and typed boundary kinematics
- **Active faults** from the GEM Global Active Faults database
- **Named undersea trenches** from the IHO-IOC GEBCO Gazetteer
- **Optional bathymetric shaded relief**
- **Relationship exploration** across volcanoes, earthquakes, faults, boundaries, and trenches
- **Unified inspectors** with provenance, freshness, source context, and bounded report excerpts
- **Search and navigable history**, including browser Back/Forward and shareable URL state
- **Static deployment** with no account, database, API key, application backend, or runtime build service required

For the complete source inventory, semantics, licenses, and provenance notes, see **[Data Sources](docs/DATA-SOURCES.md)**.

## 🗺️ Roadmap

Open Earth is being built deliberately in stages rather than becoming an everything-map all at once.

| Phase | Focus | Status |
| --- | --- | --- |
| **P1** | Geology foundation | ✅ Done |
| **P1.5** | Stabilization and product pass | ✅ Done |
| **P1.5x** | Global/regional geology and volcano coverage | 🔜 Next |
| **P1.75** | Mobile experience | Planned |
| **P1.9** | Frontend architecture bake-off | Planned |
| **P2** | Dynamic Earth: deformation, focal mechanisms, InSAR, geodesy, etc. | Planned |

P1.9 explicitly evaluates whether Vanilla JS remains the best development model or whether Svelte, Lit/Web Components, Solid, or another approach meaningfully reduces complexity. A framework migration is **not** predetermined; Vanilla winning the bake-off is a valid result.

Longer term, Open Earth may grow into a family of focused Earth-system explorers — for example Geology, Ocean, Fire, and Ice — behind a lightweight **Current Earth** overview. Those are ideas rather than commitments.

**[Read the full roadmap and project vision →](docs/ROADMAP.md)**

## 🔬 Project principles

Open Earth favors scientific meaning and inspectability over opaque convenience:

1. **Authority and provenance first.** Sources and freshness should remain visible.
2. **Observation is not causation.** Nearby features do not automatically explain one another.
3. **Do not normalize away meaning.** Provider-specific alert levels and uncertainty retain their original semantics.
4. **Focused experiences over one giant map.** Future Earth-system domains should remain understandable on their own.
5. **Keep infrastructure boring.** Static/client-side delivery remains the default until a real requirement demands more.
6. **Open where it matters.** Source, data provenance, methodology, future telemetry logic, and reproducible infrastructure guidance should be inspectable.

The longer-term telemetry principle is deliberately simple:

> **These stats describe Open Earth, not its users.**

See the **[Roadmap](docs/ROADMAP.md)** for the open-telemetry / public Nerd Logs idea and the reproducible-infrastructure direction.

## 🧑‍💻 Development

The current application intentionally has a very small stack:

- Vanilla JavaScript
- Native ES modules
- HTML + CSS
- MapLibre GL JS
- Static JSON datasets plus live authoritative feeds
- Python scripts for data preparation/update tasks

There is currently **no Node application runtime, frontend bundler, database, or application backend**.

Run it locally with any static HTTP server, for example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

For the internals, start with **[Architecture](docs/ARCHITECTURE.md)**. If you want to contribute, see **[Contributing](CONTRIBUTING.md)**.

## 📚 Documentation

| Document | What's inside |
| --- | --- |
| **[Roadmap](docs/ROADMAP.md)** | Current phases, mobile work, frontend bake-off, future domains, open telemetry, and long-term project direction |
| **[Architecture](docs/ARCHITECTURE.md)** | Application structure, state/data boundaries, and technical architecture |
| **[Data Sources](docs/DATA-SOURCES.md)** | Scientific providers, datasets, provenance, freshness, licensing, and source semantics |
| **[Privacy](docs/PRIVACY.md)** | Current privacy behavior and tracking policy |
| **[Contributing](CONTRIBUTING.md)** | How to work on and contribute to Open Earth |

These documents intentionally cross-reference the same project rules from different angles: architecture should respect the scientific semantics documented by the data layer, privacy must stay accurate as telemetry evolves, and roadmap changes should not silently override the project's scope and provenance principles.

## 🌐 Deployment

The production site is available at **[open-earth.info](https://open-earth.info)**.

Open Earth is currently designed to remain straightforward to self-host: serve `index.html`, `src/`, and `data/` from a static HTTP server. The production infrastructure itself is intentionally not published as a live-machine configuration, but the roadmap includes a future sanitized, reproducible infrastructure reference.

## 🔒 Privacy

The current application is designed as a static, zero-tracking experience. Open Earth does not need an account to explore the map.

If privacy-preserving telemetry is introduced later, its implementation, schema, aggregation behavior, and metric definitions should be public, and this documentation must be updated to describe what is actually deployed.

**[Read the privacy documentation →](docs/PRIVACY.md)**

## 🤝 Contributing

Issues, source improvements, provider research, scientific corrections, accessibility work, performance improvements, and code contributions are welcome.

Before changing scientific semantics or adding a data provider, please read **[Data Sources](docs/DATA-SOURCES.md)** and **[Architecture](docs/ARCHITECTURE.md)**. For the development workflow, see **[Contributing](CONTRIBUTING.md)**.

## 📄 License

Open Earth is released under the **[MIT License](LICENSE)**.
