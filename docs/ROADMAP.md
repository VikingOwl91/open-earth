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

## P1.75 - Mobile experience

Before P2 adds more scientific capability and UI complexity, make the existing Open Earth geology experience genuinely usable on phones and small touch devices.

This should be a deliberate mobile product pass rather than merely making the desktop layout technically responsive.

Goals include:

- touch-first map interaction and controls
- inspectors that work comfortably on narrow screens, likely using mobile-appropriate sheets/panels rather than squeezed desktop sidebars
- usable layer and filter controls without covering the map
- search, history, deep links, and sharing that remain practical on mobile
- sensible viewport/safe-area handling and browser chrome behavior
- readable provenance, freshness, source, and scientific-context information on small screens
- accessibility and adequate touch targets
- performance and payload review for mobile networks and less powerful devices
- test the real application on representative mobile viewport sizes and touch interaction, not only desktop responsive emulation

The objective is feature and semantic parity where it makes sense, not pixel-for-pixel desktop parity. Mobile may use different interaction patterns when they better fit the device.

## P1.9 - Frontend architecture bake-off

Before P2 adds another layer of state, visualization, and interaction complexity, evaluate whether the current Vanilla JavaScript + native ES modules architecture is still the simplest way to build Open Earth.

This is an evaluation milestone, **not a pre-decided framework migration**. Staying on Vanilla is a valid outcome if the bake-off does not demonstrate a meaningful improvement.

Start by documenting concrete pain points observed while building P1 through P1.75. In particular, look for places where Open Earth is beginning to recreate framework machinery itself: UI state synchronization, DOM lifecycle, component composition, event wiring, inspector variants, responsive/mobile variants, and shared interactive primitives.

Candidate approaches should include at least:

- **Vanilla JS + native ES modules** as the baseline
- **Svelte** as the primary framework candidate
- **Lit / Web Components** as a standards-oriented lightweight candidate
- **Solid** as another lightweight reactive candidate worth measuring

**htmx** may be documented as considered, but it is not an obvious fit for the current architecture because Open Earth is a static, highly interactive client-side map rather than a server-rendered hypermedia application. It should only enter the implementation bake-off if a concrete architecture makes it competitive without introducing a backend merely to accommodate the framework.

The bake-off should use one or more representative vertical slices from the real application rather than toy counters. Good candidates include an inspector with provenance/freshness state, search + selection + URL state, a mobile sheet, or another interaction that exercises MapLibre integration and real Open Earth state.

Evaluate candidates against explicit criteria such as:

- implementation complexity and amount of application-owned glue
- readability and maintainability
- state and lifecycle correctness
- MapLibre integration and imperative escape hatches
- desktop/mobile component reuse without forcing identical UX
- bundle/payload cost and startup performance
- runtime memory/CPU where differences are meaningful
- accessibility ergonomics
- testing ergonomics
- build/tooling complexity and dependency surface
- long-term maintenance risk and ecosystem maturity
- suitability for future focused Open Earth domain experiences

Any prototype should preserve existing scientific semantics, data contracts, URL/deep-link behavior, and MapLibre behavior closely enough to make the comparison meaningful. Do not combine a framework migration with a broad redesign and then attribute the result to the framework.

If a candidate wins, document **why**, what gets migrated, what remains framework-independent, and a staged migration path. Prefer keeping scientific/data/provider logic independent of the UI framework where practical.

If no candidate clearly beats Vanilla, keep Vanilla and record the result. The purpose of P1.9 is to reduce future development complexity, not to modernize the stack for its own sake.

## P2 - Dynamic Earth

After regional geology coverage is mature, the current product has a solid mobile experience, and the frontend architecture has been deliberately evaluated, deepen the solid-Earth experience rather than immediately broadening into unrelated hazards.

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

## Open telemetry and public nerd logs

If Open Earth eventually needs usage telemetry, the telemetry system should follow the same openness and provenance principles as the scientific data.

The telemetry implementation itself should be part of the public repository rather than a hidden third-party analytics black box. Its event schema, collection behavior, retention rules, aggregation logic, and public metrics should be inspectable.

The guiding principle is:

> **These stats describe Open Earth, not its users.**

Possible telemetry includes aggregate visits, explored topics, inspector opens, layer usage, provider/runtime health, traffic served, and similar product-level statistics. Avoid user profiles, cross-site tracking, fingerprinting, or telemetry whose purpose is to identify individual visitors.

Where practical, publish the aggregate data itself as machine-readable open data as well as presenting it in the UI.

A future optional **Nerd logs** panel could expose fun and useful public statistics such as:

- visitors / visits over time
- events explored
- most explored topic (for example volcanoes vs earthquakes)
- most explored current events or features
- relative interest across future domains such as Geology, Ocean, Fire, and Ice
- provider health / freshness summaries
- data served
- IPv4 vs IPv6 traffic, because of course

Metric definitions must be explicit. For example, "most explored topic" should say whether it means inspector opens, layer activations, or another concrete event rather than presenting an opaque analytics score.

Telemetry is a future capability, not an immediate requirement. For simple traffic counts, server access-log aggregation may be sufficient before any client-side event collection exists.

Any telemetry that is actually deployed must be reflected accurately in the privacy documentation.

## Open and reproducible operation

The long-term Open Earth philosophy should extend beyond application source code:

- **Open source** - application and telemetry implementation are public.
- **Open data** - use authoritative open/public data where licensing permits, with source and freshness visible.
- **Open methodology** - derived values and relationships should be explainable and reproducible.
- **Open telemetry** - collection and aggregation behavior is public, and aggregate statistics can themselves be public data.
- **Reproducible infrastructure** - document enough of the production architecture that another operator can host Open Earth in substantially the same way.

The actual production server is intentionally **not** public configuration/state. Do not publish secrets, deployment credentials, recovery details, private host metadata, security-sensitive operational state, or an exact production snapshot merely for philosophical purity.

Instead, a future sanitized infrastructure reference may document the relevant architecture, Caddy/static-hosting setup, deployment contract, release layout, health checks, rollback model, and telemetry pipeline without exposing the real host unnecessarily.

The goal is reproducibility, not giving the internet a blueprint of a live machine.

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
7. **Ideas are not commitments.** Ocean, Fire, Ice, Weather, telemetry, and other domains remain future possibilities until the preceding work is mature.

The immediate roadmap remains deliberately narrow:

```text
P1      DONE
P1.5    DONE
P1.5x   Regional geology / volcano coverage
P1.75   Mobile experience
P1.9    Frontend architecture bake-off
P2      Dynamic Earth

Then stop, evaluate, and only expand into another Earth-system domain if it still makes sense.
```
