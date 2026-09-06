# Privacy & Network Request Audit (Datenschutz)

Open Earth is designed from the ground up as a client-side, privacy-respecting static application.

## Core Privacy Principles

1. **No Backend or User Tracking**
   - Open Earth operates without a user account system, application database, or tracking backend.
   - There are no session cookies, tracking cookies, advertising beacons, or third-party analytics scripts (no Google Analytics, no Matomo, no telemetry).

2. **Local Storage Usage**
   - Open Earth uses browser `localStorage` solely to preserve your selected map layer toggles, active basemap, and projection mode across browser visits (`open_earth_state`).
   - No personally identifiable information or browsing history is ever recorded in `localStorage`.

3. **URL State**
   - Current map coordinates, selected feature identifiers, and layer visibility flags are encoded directly into the URL hash/query string (e.g. `?v=volcano:332010&c=-6.10,105.42,8`) to allow bookmarking and link sharing without any server-side state persistence.

---

## Audited Browser Network Destinations

When you use Open Earth, your browser makes network requests only to fetch static assets and public scientific datasets:

| Domain | Service / Purpose | Data Sent | Caching & Lifetime |
| --- | --- | --- | --- |
| **Origin (`localhost` or host domain)** | Open Earth HTML, CSS, JavaScript, icons, and bundled geological snapshots (`data/*.json`). | Standard HTTP GET request with standard browser headers. | Cached by browser according to standard HTTP cache headers. |
| **`earthquake.usgs.gov`** | Real-time and historical seismic event feeds from the United States Geological Survey Earthquake Hazards Program. | Requested time windows, bounding boxes, or minimum magnitudes in query parameters. | Live requests via HTTPS GET. |
| **`basemaps.cartocdn.com`** | Vector and raster basemap style sheets and tiles (Dark Matter and Positron styles). | Standard tile coordinate requests (`/{z}/{x}/{y}`). | Standard browser tile cache. |
| **`demotiles.maplibre.org`** | Demo vector tiles used for the Liberty basemap style. | Standard tile coordinate requests. | Standard browser tile cache. |
| **`wms.gebco.net`** | General Bathymetric Chart of the Oceans (GEBCO) WMS raster bathymetry tiles. | Standard WMS BBOX bounding box parameters. | Standard browser image tile cache. |
| **`nominatim.openstreetmap.org`** | OpenStreetMap Nominatim geocoding service. Only contacted when you type a query into the search bar that is not matched in local geological catalogs. | User-typed search query string. | Standard HTTPS GET. |
| **`en.wikipedia.org`** | Lazy thumbnail image and summary for selected geological features with linked Wikipedia articles. | Feature title in Wikipedia API query. | Standard HTTPS GET with referrer policy. |
| **`unpkg.com`** | CDN hosting MapLibre GL JS and CSS vendor distribution files. | Standard HTTP GET for static JavaScript and stylesheet assets. | Standard CDN edge caching. |

No other network connections are established by the application.
