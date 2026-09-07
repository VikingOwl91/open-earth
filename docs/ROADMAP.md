# Open Earth Roadmap

Open Earth starts with solid-Earth science, but the long-term idea can grow into a family of focused Earth-system explorers without turning one map into an overloaded everything-dashboard.

The guiding product idea remains:

> A modern open-source map for understanding what the Earth is doing - and why.

## Current state

### P1 - Geology foundation

Complete.

Core geology, live earthquakes, volcano catalog, plate tectonics, faults, trenches, bathymetry, relationships, provenance, freshness, and inspectors.

### P1.5 - Stabilization and product pass

Complete.

Architecture cleanup, URL/deep-link state, navigation history, holistic UI/UX, accessibility, lifecycle/performance work, privacy/legal/source review, documentation, and regression coverage.

## Next: P1.5x - Regional coverage pass

Before adding new geoscience dimensions, broaden the existing geology/volcano monitoring coverage.

Goals:

- Research additional authoritative regional volcano and geological monitoring providers worldwide.
- Prefer documented APIs, stable JSON/GeoJSON, RSS/Atom/CAP, or other machine-readable official sources.
- Evaluate source authority, licensing/terms, update frequency, geographic coverage, freshness semantics, CORS, identifiers, and technical stability before integration.
- Preserve each authority's original alert/status semantics. A numeric level from one provider must not be assumed equivalent to the same number from another provider.
- Continue distinguishing REFERENCE, OBSERVED, and DERIVED information.
- Use this pass to stress-test the provider abstraction against substantially more real-world authorities rather than adding one-off special cases.

Potential providers/regions to investigate include INGV (Italy), IMO (Iceland), SERNAGEOMIN (Chile), CENAPRED (Mexico), PHIVOLCS (Philippines), KVERT (Kamchatka), IG-EPN (Ecuador), SGC (Colombia), OVSICORI (Costa Rica), MVO (Montserrat), VMGD (Vanuatu), RVO (Papua New Guinea), and other authoritative national or regional geological surveys/observatories.

This list is research input, not an integration commitment.

## P2 - Dynamic Earth

After regional geology coverage is mature, deepen the solid-Earth experience rather than immediately broadening into unrelated hazards.

Candidate capabilities:

- GNSS plate-motion and deformation vectors
- Earthquake focal mechanisms / beachballs
- Historical tsunami events and authoritative tsunami bulletins where they directly connect to solid-Earth events
- InSAR deformation products where practical and appropriately licensed
- Geodetic time series
- Seismic intensity / ShakeMap-style products
- Richer derived geological relationships

P2 should make it easier to understand how the Earth is moving and deforming, not merely add more markers.

## Longer-term idea: an Open Earth family

If Open Earth expands beyond geology, do **not** put every domain and every layer into one giant application.

Instead, treat `open-earth.info` as a shared portal with focused domain experiences underneath it.

Conceptually:

```text
                    Open Earth
                        |
                 Current Earth
                        |
       +----------------+----------------+
       |                |                |
    Geology           Ocean            Fire
       |                |                |
 earthquakes         waves          wildfires
 volcanoes           tsunamis       hotspots
 tectonics           buoys          burn areas
 deformation         sea level
       |
       +------------ Ice / Weather / ...
```

### Current Earth

The default/root experience should eventually be a curated, lightweight view of **noteworthy current events across supported domains**, rather than loading every reference dataset and specialist layer at once.

Examples might include a significant recent earthquake, a volcano status change, a major wildfire, a tsunami bulletin, or another notable current Earth-system event.

Selecting a domain then opens the focused experience for that subject.

### Domain experiences

Possible future domains include:

- **Geology** - the current Open Earth foundation: earthquakes, volcanoes, tectonics, faults, deformation, and related solid-Earth science.
- **Ocean** - waves, rogue waves / Kaventsmaenner, tsunami observations, buoys, sea level, and other ocean observations that fit the product.
- **Fire** - active wildfire/hotspot observations, burned areas, and related authoritative data.
- **Ice** - glaciers, sea ice, ice shelves, snow/ice observations, and related cryosphere data.
- **Weather / Atmosphere** - only if a focused Open Earth experience adds value; avoid becoming a generic weather-app clone.
- Other Earth-system domains may be considered later when they have a clear scientific/product reason to exist.

These are ideas, not scheduled milestones.

## Why split domains

The split is both a product and technical boundary:

- A user investigating a volcano does not need wildfire hotspots, global weather rasters, sea ice, and every ocean buoy loaded into the same map.
- Each domain can have controls, inspectors, terminology, source semantics, and visualizations appropriate to its science.
- The root experience can remain lightweight by loading only current cross-domain events.
- Data/network/rendering load can be distributed instead of making one client load the entire planet's datasets.
- Shared concepts such as map primitives, provenance, freshness, provider metadata, design language, and navigation can be reused where they genuinely remain common.

Do not prematurely choose a monorepo, multi-repo, package, or deployment architecture for this. Build a second real domain first; then extract what is demonstrably shared.

## Scope guardrails

Open Earth should not become a random collection of map layers.

A dataset or domain belongs when it helps users understand an Earth system, event, observation, or relationship and can be represented with trustworthy provenance and appropriate scientific semantics.

Key rules:

1. **Focused experiences over one giant map.** New domains should remain independently understandable and usable.
2. **Finish before expanding.** A domain should become a useful, stable product before another major domain is started.
3. **Authority and provenance first.** Every displayed fact should know where it came from and how old it is.
4. **Observation is not causation.** Spatial or temporal proximity must not silently become a causal claim.
5. **Do not normalize away scientific meaning.** Provider-specific classifications and uncertainty must remain visible.
6. **Keep infrastructure boring.** Prefer static/client-side delivery and direct authoritative sources where practical; add backend infrastructure only when a real requirement demands it.
7. **Ideas are not commitments.** Ocean, Fire, Ice, Weather, and other domains remain future possibilities until the preceding work is mature.

The immediate roadmap remains deliberately narrow:

```text
P1      DONE
P1.5    DONE
P1.5x   Regional geology / volcano coverage
P2      Dynamic Earth

Then stop, evaluate, and only expand into another Earth-system domain if it still makes sense.
```
