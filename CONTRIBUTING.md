# Contributing to Open Earth

Thank you for contributing to Open Earth! Open Earth is an open-source, source-aware living geology explorer dedicated to making Earth's active geological systems transparent and accessible.

## Principles

1. **Static Runtime**: Open Earth runs entirely in the browser without accounts, databases, or application servers.
2. **Every Fact Has a Source**: Never discard provenance, source timestamps, or agency alert scales.
3. **Focused Scope**: Open Earth focuses strictly on solid-Earth geology (seismicity, volcanism, plate kinematics, undersea trenches, active faulting). Atmospheric weather, wildfires, and general disaster management are out of scope.
4. **Privacy First**: Zero cookies, zero analytics, zero user tracking.

---

## Local Development

Open Earth uses vanilla ES modules and standard web APIs, requiring no heavy JavaScript bundling build steps.

### Prerequisites

- Python 3.10+ (for background data normalization scripts and local testing)
- Node.js 18+ (for running unit test suites)

### Running the Web Application

Start any local static file server from the repository root:

```bash
# Using Python
python3 -m http.server 8080
```

Open `http://localhost:8080` in your web browser.

---

## Running Tests

Before submitting any pull request, verify that both the JavaScript and Python test suites pass:

```bash
# Run Node.js JavaScript unit tests
node --test tests/*.test.js

# Run Python data pipeline unit tests
pytest
```

---

## Repository Structure

```text
open-earth/
├── data/                  # Generated normalized GeoJSON/JSON snapshots
├── docs/
│   ├── ARCHITECTURE.md    # Architecture and modular system design
│   ├── DATA-SOURCES.md    # Upstream data provider registry & specifications
│   └── PRIVACY.md         # Network request audit and privacy documentation
├── scripts/               # Python normalization and update pipelines
│   ├── update_data.py     # Core data snapshot updater (GVP, plates, faults)
│   ├── update_trenches.py # GEBCO undersea trenches updater
│   └── update_volcano_providers.py # Regional volcano monitoring updater
├── src/                   # Modular client-side application code
│   ├── app.js             # Application bootstrapper and orchestrator
│   ├── data.js            # In-memory data store with single-flight caching
│   ├── geo.js             # Spatial math and text normalization utilities
│   ├── inspector.css      # Styles for feature inspector drawer and tabs
│   ├── inspector.js       # Unified inspector controller for all feature types
│   ├── map.js             # MapLibre GL wrapper, layers, and basemap switcher
│   ├── modals.js          # Accessible dialog modals (About, Impressum, Privacy)
│   ├── providers.js       # Regional volcano monitoring provider adapters
│   ├── search.js          # Search controller (local entities + Nominatim + USGS catalog)
│   ├── state.js           # URL-first state management and history navigation
│   └── style.css          # Core design tokens, layout, and control styling
├── tests/                 # Unit test suites (JavaScript and Python)
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
