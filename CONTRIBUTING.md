# Contributing to Open Earth

Thank you for contributing to Open Earth! Open Earth is an open-source, source-aware living geology explorer dedicated to making Earth's active geological systems transparent and accessible.

## Principles

1. **Static Runtime**: Open Earth runs entirely in the browser without accounts, databases, or application servers.
2. **Every Fact Has a Source**: Never discard provenance, source timestamps, or agency alert scales.
3. **Focused Scope**: Open Earth focuses strictly on solid-Earth geology (seismicity, volcanism, plate kinematics, undersea trenches, active faulting). Atmospheric weather, wildfires, and general disaster management are out of scope.
4. **Privacy First**: Open Earth sets no cookies and builds no user profiles. Third-party hosts that serve images and map data can set their own, which `docs/PRIVACY.md` documents. The only analytics is cookieless, aggregate OpenPanel page statistics on a self-hosted instance, documented in `docs/PRIVACY.md`. Any new tracking or event must be added there first.

---

## Local Development

Open Earth uses vanilla JavaScript loaded as classic `<script>` tags and standard web APIs, requiring no bundling build steps. Each `src/*.js` file also exposes `module.exports` when run under Node so the unit tests can import it.

### Prerequisites

- Python 3.10+ (for background data normalization scripts and local testing)
- Node.js 18+ (for the JavaScript unit tests and ESLint)

### Running the Web Application

Start any local static file server from the repository root:

```bash
# Using Python
python3 -m http.server 8080
```

Open `http://localhost:8080` in your web browser.

The app loads snapshots from the `main` branch on GitHub first and falls back to the local `data/` files only when GitHub is unreachable or does not respond within 4 seconds. To test locally regenerated snapshots, point `SNAPSHOT_BASE` in `src/data.js` at `./data` or block `raw.githubusercontent.com` in your browser.

---

## Running Tests

Before submitting any pull request, verify that both the JavaScript and Python test suites pass:

```bash
# Run both test suites
npm test && npm run test:py

# Or individually
npm test          # JavaScript unit tests (node --test)
npm run test:py   # Python data pipeline unit tests (pytest)
npm run lint      # ESLint over src/ and tests/ (also run in CI)
```

---

## Repository Structure

```text
open-earth/
├── .github/workflows/     # CI (lint and tests) and the daily data refresh
├── data/                  # Generated normalized GeoJSON/JSON snapshots
├── docs/
│   ├── ARCHITECTURE.md    # Architecture and modular system design
│   ├── DATA-SOURCES.md    # Upstream data provider registry & specifications
│   ├── PRIVACY.md         # Network request audit and privacy documentation
│   └── ROADMAP.md         # Phases, status and long-term direction
├── scripts/               # Python normalization and update pipelines
│   ├── update_data.py     # Core data snapshot updater (GVP, plates, faults)
│   ├── update_trenches.py # GEBCO undersea trenches updater
│   ├── update_pvmbg.py    # PVMBG / MAGMA Indonesia status updater
│   ├── update_usgs_volcanoes.py  # USGS Volcano Hazards Program status updater
│   ├── update_jma_volcanoes.py   # JMA volcanic warnings updater
│   ├── update_geonet_volcanoes.py # GeoNet New Zealand alert level updater
│   └── update_imo_volcanoes.py   # Icelandic Met Office updater
├── src/                   # Modular client-side application code
│   ├── analytics.js       # Cookieless OpenPanel page analytics (off on localhost)
│   ├── app.js             # Application bootstrapper and orchestrator
│   ├── data.js            # In-memory data store with single-flight caching
│   ├── geo.js             # Spatial math and text normalization utilities
│   ├── inspector.css      # Styles for feature inspector drawer and tabs
│   ├── inspector.js       # Unified inspector controller for all feature types
│   ├── map.js             # MapLibre GL wrapper, layers, and basemap switcher
│   ├── modals.js          # Accessible dialog modals (About, Impressum, Privacy)
│   ├── popups.css         # Styles for map popups
│   ├── providers.js       # Regional volcano monitoring provider adapters
│   ├── search.js          # Search controller (local entities + Nominatim + USGS catalog)
│   ├── state.js           # URL-first state management and history navigation
│   └── style.css          # Core design tokens, layout, and control styling
├── tests/                 # Unit test suites (JavaScript and Python) and fixtures
├── vendor/openpanel/      # Vendored, pinned OpenPanel tracker script
├── eslint.config.mjs      # ESLint flat config
└── index.html             # Main entry point with semantic markup
```

---

## Commit Guidelines

We follow Conventional Commits:

- `feat: ...` for user-facing features
- `fix: ...` for bug fixes
- `refactor: ...` for internal restructuring without behavior changes
- `docs: ...` for documentation updates
- `test: ...` for adding or updating test coverage
- `chore: ...` for routine maintenance

Please keep commits focused, self-contained, and accompanied by clear explanations.
