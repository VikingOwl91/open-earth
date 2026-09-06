# Data sources

Open Earth prefers authoritative public sources and keeps provenance visible in the UI.

## Earthquakes — USGS Earthquake Hazards Program

MVP feed:

`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson`

The UI can switch between the USGS hour/day/week feeds. These are near-real-time event feeds and include event time, magnitude, depth, place, and canonical USGS detail URLs.

Documentation: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php

## Volcano catalog — Smithsonian Global Volcanism Program

MVP service: GVP Volcanoes of the World GeoServer / OGC WFS.

`https://webservices.volcano.si.edu/geoserver/GVP-VOTW/wfs`

The MVP requests the Holocene volcano layer as GeoJSON. This is a **catalog/reference layer**, not a live-eruption feed. Fields such as last known eruption must not be interpreted as current activity.

Documentation: https://volcano.si.edu/database/webservices.cfm

## Plate boundaries — USGS

MVP service: USGS ArcGIS REST plate-boundary map service.

`https://earthquake.usgs.gov/arcgis/rest/services/eq/map_plateboundaries/MapServer`

The app requests the Plates feature layer as GeoJSON.

Service: https://earthquake.usgs.gov/arcgis/rest/services/eq/map_plateboundaries/MapServer

## Future current-volcanism sources

Current volcanic activity deserves its own source model rather than overloading the static GVP catalog. Candidates include GVP Weekly Volcanic Activity Reports, national observatories (for example PVMBG, USGS, JMA, INGV), and VAAC / volcanic-ash aviation products.

Any future adapter should document update cadence, geographic coverage, licensing/terms, and what an "active" record actually means.
