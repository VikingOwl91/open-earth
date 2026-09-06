# Data sources

Open Earth prefers authoritative public sources and keeps provenance visible in the UI. The operating rule is:

> **Reference geology → normalized repository snapshots. Live activity → direct APIs when browser-safe, otherwise frequently refreshed snapshots.**

Generated snapshots live in `data/`; `scripts/update_data.py` refreshes them and `.github/workflows/update-data.yml` runs the refresh daily. `data/manifest.json` records upstream URLs, generation time, and feature counts.

## Implemented layers

| Layer | Authority / upstream | Runtime strategy | Freshness | Notes |
| --- | --- | --- | --- | --- |
| Earthquakes | USGS Earthquake Hazards Program | direct GeoJSON API + FDSNWS catalog | near-real-time live; on-demand historical | 1h / 24h / 7d feeds + custom parameter searches (mag, depth, radius, bounds) |
| Known Holocene volcanoes | Smithsonian Global Volcanism Program (GVP), Volcanoes of the World | bundled snapshot; GVP WFS preferred by updater | daily snapshot of reference catalog | Reference catalog of ~1,350 Holocene volcanoes. A catalog entry is not evidence of current activity |
| Volcanic reports | Smithsonian / USGS Weekly Volcanic Activity Report | bundled normalized snapshot generated from official RSS | daily check; source report updates weekly | WVAR covers selected volcanoes with new or ongoing unrest; it is not a comprehensive global census |
| Regional volcano monitoring | PVMBG, USGS, JMA, GeoNet | bundled daily snapshots from official agency APIs | daily updater; agency updates occur on alert change | Preserves native alert scales: PVMBG (Levels I-IV), USGS (Alert/Color), JMA (Warnings 1-5), GeoNet (VAL 0-5) |
| Plate boundaries | PB2002 / Peter Bird (2003) | bundled snapshot | reference geology | Categorized by boundary kinematics: subduction, convergent, divergent, transform |
| Plate polygons | PB2002 / Peter Bird (2003) | bundled snapshot | reference geology | 52 named tectonic plates with containing polygon query support |
| Seafloor trenches | IHO-IOC GEBCO Gazetteer of Undersea Feature Names | bundled snapshot | reference geology | Named seafloor trenches with official generic classifications |
| Bathymetry | GEBCO 2026 Gridded Bathymetry | direct WMS raster tiles from gebco.net | remote service | Global shaded-relief topography/bathymetry context. Scientific visualization only, not for navigation |
| Active faults | GEM Global Active Faults | bundled snapshot, lazy rendered | reference geology | Global fault kinematics and slip rates where mapped |
| Basemap | OpenFreeMap / OpenMapTiles / OpenStreetMap | direct vector tiles | provider-managed | Dark, Positron, Liberty, Fiord, and Classic styles |
| Place search | Nominatim / OpenStreetMap | direct request | live | Local volcano and visible earthquake matching before remote geocoding |

## Architecture and reliability model

The browser should not depend on upstream CORS policy for reference geology. GitHub Actions performs cross-origin acquisition and normalization, commits changed snapshots, and the static web client reads same-origin files from `data/`. Direct USGS earthquake feeds remain live because they are explicitly designed for browser consumption.

Failure isolation is enforced in `.github/workflows/update-data.yml`: every upstream refresh step (GVP core snapshots, GEBCO trenches, and each regional volcano monitoring provider) runs with isolated error handling so an upstream outage never blocks data updates for the rest of the application.

## Regional volcano monitoring providers

Open Earth avoids conflating distinct national warning conventions into an oversimplified common alert scale. Instead, the multi-provider system presents the authority's native scale with clear provenance.

### Implemented providers

1. **PVMBG / MAGMA Indonesia (Pusat Vulkanologi dan Mitigasi Bencana Geologi)**
   - API: `https://magma.esdm.go.id/api/v1/gunung-api/tingkat-aktivitas`
   - Coverage: 127 active Indonesian volcanoes
   - Native scale: Level I (Normal), Level II (Waspada), Level III (Siaga), Level IV (Awas)
   - Matching: Exact Smithsonian VolcanoNumber match where assigned; fallback to normalized Indonesian edifice name.

2. **USGS Volcano Hazards Program (United States)**
   - API: `https://volcanoes.usgs.gov/hans-public/api/volcano/getMonitoredVolcanoes`
   - Coverage: 68 monitored volcanoes across Cascades, Alaska, Hawaii, California, Yellowstone, and CNMI
   - Native scale: Ground Volcano Alert Level (NORMAL, ADVISORY, WATCH, WARNING) and Aviation Color Code (GREEN, YELLOW, ORANGE, RED)
   - Matching: Official GVP `vnum` mapping provided directly by USGS HANS.

3. **Japan Meteorological Agency (JMA Bosai)**
   - API: `https://www.jma.go.jp/bosai/warning/data/warning.json` + `volcano_dictionary.json` + `volcano_list.json`
   - Coverage: 111 active volcanoes in Japan with live municipal warning zones
   - Native scale: Volcanic Warning Levels 1 to 5 (Do not approach crater, Do not approach volcano, Evacuate)
   - Matching: Curated mapping of JMA Bosai volcano codes to Smithsonian VolcanoNumbers.

4. **GeoNet New Zealand (GNS Science)**
   - API: `https://api.geonet.org.nz/volcano/val`
   - Coverage: 12 monitored volcanic centers in New Zealand and the Kermadec Arc
   - Native scale: New Zealand Volcanic Alert Level 0 to 5 and Aviation Color Code
   - Matching: Curated mapping of GeoNet volcano identifiers to Smithsonian VolcanoNumbers.

### Vetted and deferred providers

The following providers were systematically evaluated and deferred due to technical and scientific limitations in their upstream endpoints:

- **IMO (Icelandic Met Office)**:
  - Technical status: Icelandic volcano alert levels are published exclusively as a static server-side rendered PNG graphic (`https://en.vedur.is/photos/volcanoes/volcano_status.png`) coupled to an HTML client-side image map coordinate grid.
  - Reason for deferral: No machine-readable JSON, GeoJSON, or XML status endpoint exists. The public RSS feed publishes narrative text bulletins without structured status codes. Automating OCR or image parsing would introduce fragile, unverified assumptions into an authoritative pipeline. Deferred until IMO publishes an official structured API.

- **INGV / DPC (Istituto Nazionale di Geofisica e Vulcanologia / Dipartimento della Protezione Civile, Italy)**:
  - Technical status: The Italian national volcanic alert system is managed under the National Civil Protection department. The public display is embedded inside a proprietary Gatsby client-side SPA without open, documented public JSON endpoints. INGV regional observatories (Catania, Naples, Rome) issue weekly and daily bulletins as PDF reports.
  - Reason for deferral: Absence of a stable, documented machine-readable API endpoint. Deferred until an open structured feed is established.

- **PHIVOLCS (Philippine Institute of Volcanology and Seismology)**:
  - Technical status: The designated endpoint (`wovodat.phivolcs.dost.gov.ph`) fails SSL certificate verification with self-signed and untrusted certificate chain errors, preventing secure automated fetching in automated pipelines. In addition, status data is bound to dynamic client-side widget scripts.
  - Reason for deferral: SSL/TLS validation failures and lack of a stable headless REST API. Deferred until standard HTTPS certificate chains and open endpoints are deployed.

## 3-tier geodynamic classification model

When examining any feature on Open Earth, the inspector presents a structured geodynamic classification across three distinct tiers to ensure scientific clarity:

1. **REFERENCE (Authoritative catalog facts)**:
   - Containing tectonic plate from the PB2002 model.
   - Catalog tectonic setting from the Smithsonian GVP (e.g. Subduction zone / Continental crust).
   - Authoritative edifice classification (e.g. Stratovolcano, Caldera, Shield).
   - Fault kinematics from the GEM Active Faults database (e.g. Normal, Reverse, Strike-slip).

2. **OBSERVED (Live and recent events)**:
   - Official alert level from the responsible national observatory (PVMBG, USGS, JMA, GeoNet).
   - Active weekly reports from the Smithsonian / USGS WVAR.
   - Live and recent seismicity within 250 km from the USGS Earthquake Hazards Program.

3. **DERIVED (Analytical spatial proximity analysis)**:
   - Distance and relative motion to the nearest PB2002 plate boundary step.
   - Distance and name of the nearest GEBCO undersea trench.
   - Distance and name of the nearest volcanic center or active fault.
   - Clear analytical attribution and disclaimer:
     > "Analytical interpretation based on spatial proximity, not an authoritative named arc classification."

## Undersea trenches and GEBCO bathymetry

- **GEBCO Gazetteer**: Undersea feature names and mapped line geometries are sourced from the IHO-IOC GEBCO Gazetteer of Undersea Feature Names. This provides recognized geographical names (e.g. Sunda Trench, Mariana Trench, Aleutian Trench) rather than treating subduction zones as anonymous lines.
- **GEBCO Shaded Relief**: Bathymetric shaded relief is provided through the GEBCO Web Map Service (WMS) as an optional contextual overlay.
- **Non-navigation notice**:
  > "Notice: GEBCO bathymetric data and undersea feature names are provided for scientific research and educational map visualization only. Not for navigation."

## Inspector navigation history

Open Earth maintains an in-memory navigation stack (`window.inspectorNav`) across all five feature types:
- Volcano
- Earthquake
- Active Fault
- Plate Boundary
- Undersea Trench

When exploring spatial relationships (for example, navigating from Krakatau to the Sunda Trench, and from the Sunda Trench to the Java subduction boundary), a persistent back button (`← Back to <Origin>`) allows the user to retrace their steps without losing geographic or analytical context.

## Future P2 candidates

| Capability | Candidate authority / dataset | Why it belongs |
| --- | --- | --- |
| Historical significant earthquakes | USGS / NOAA NCEI | Compare present events with long-term seismic history |
| Historical tsunamis | NOAA NCEI Global Historical Tsunami Database | Connects major earthquakes and volcanism to resulting marine hazards |
| GNSS crustal velocities | EarthScope / geodetic networks | Visualizes plate motion as measured vectors |
| Earthquake focal mechanisms | USGS and regional networks | Illustrates fault slip mechanisms (beachballs) |
| Seafloor age | NOAA/NCEI and Müller et al. | Makes seafloor spreading and oceanic plate creation visually clear |
| Heat flow | Global heat flow compilations | Deep geophysical context for volcanic and rift systems |
| Ground deformation / InSAR | Satellite / observatory products | Shows measurable surface deformation around active volcanic systems |
