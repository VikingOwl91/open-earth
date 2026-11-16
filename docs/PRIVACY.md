# Privacy & Network Request Audit (Datenschutz)

Open Earth is designed from the ground up as a client-side, privacy-respecting static application.

## Core Privacy Principles

1. **No Backend or User Tracking**
   - Open Earth operates without a user account system, application database, or tracking backend.
   - Open Earth itself sets no cookies: no session cookies, tracking cookies or advertising beacons, and no third-party analytics services (no Google Analytics, no Matomo).
   - Images and map data are requested by your browser directly from third-party hosts, and those hosts can set cookies of their own. Observed on 2026-11-16: `thumb.wikimedia.org` set two cookies when a Wikipedia preview image was shown without `crossorigin="anonymous"`; with it, none were stored. See [Cookies and device storage](#cookies-and-device-storage).
   - Open Earth does run cookieless, aggregate page analytics with a self-hosted OpenPanel instance. What it sends is listed under [Page analytics](#page-analytics-openpanel).

2. **Local Storage Usage**
   - Open Earth uses browser `localStorage` solely to preserve your selected map layer toggles, active basemap, and projection mode across browser visits (`open-earth:view:v1`).
   - No personally identifiable information or browsing history is ever recorded in `localStorage`.

3. **URL State**
   - Current map coordinates, selected feature identifiers, and layer visibility flags are encoded directly into the URL hash/query string (e.g. `?v=volcano:332010&c=-6.10,105.42,8`) to allow bookmarking and link sharing without any server-side state persistence.

---

## Audited Browser Network Destinations

When you use Open Earth, your browser makes network requests only to fetch static assets and public scientific datasets:

| Domain | Service / Purpose | Data Sent | Caching & Lifetime |
| --- | --- | --- | --- |
| **Origin (`localhost` or host domain)** | Open Earth HTML, CSS, JavaScript, icons, and fallback geological snapshots (`data/*.json`). | Standard HTTP GET request with standard browser headers. | Cached by browser according to standard HTTP cache headers. |
| **`raw.githubusercontent.com`** | Latest public geological snapshots committed to the Open Earth repository (`data/*.json`). | Standard HTTP GET with standard browser headers, so GitHub sees your IP address, user agent and the referrer origin. The URL is a fixed file path; no map state, search terms or identifiers are sent. If the request fails or GitHub does not start answering within 4 seconds, the same file is fetched from the origin instead. | Cache revalidation is requested; GitHub's CDN sends `Cache-Control: max-age=300`, so an updated snapshot can take up to five minutes to appear. |
| **`earthquake.usgs.gov`** | Real-time and historical seismic event feeds from the United States Geological Survey Earthquake Hazards Program. | Requested time windows, bounding boxes, or minimum magnitudes in query parameters. | Live requests via HTTPS GET. |
| **`tiles.openfreemap.org`** | OpenFreeMap style sheets, vector tiles, glyphs and sprites for the Dark, Positron, Liberty and Fiord basemaps (`src/map.js`). | Standard tile coordinate requests (`/{z}/{x}/{y}`). | Standard browser tile cache. |
| **`demotiles.maplibre.org`** | MapLibre demo style and tiles, used only for the Classic basemap (`src/map.js`). | Standard tile coordinate requests. | Standard browser tile cache. |
| **`wms.gebco.net`** | General Bathymetric Chart of the Oceans (GEBCO) WMS raster bathymetry tiles. | Standard WMS BBOX bounding box parameters. | Standard browser image tile cache. |
| **`nominatim.openstreetmap.org`** | OpenStreetMap Nominatim geocoding service. Contacted while you type in the search bar (at least 2 characters, about 0.2 s after the last keystroke) when the volcano catalog has fewer than 5 local matches (`src/search.js`). | The text typed so far, as the `q` query parameter. | Standard HTTPS GET. |
| **`en.wikipedia.org`** | Wikipedia API search for a preview image when the inspector opens a volcano (`src/inspector.js`). | Search text built from the volcano name and country, for example `Krakatau volcano Indonesia`. Sent once per volcano and page load; the result is cached in memory. | Standard HTTPS GET. |
| **`thumb.wikimedia.org`** | The preview image itself. The host comes from the Wikipedia API response, not from the code; `thumb.wikimedia.org` was the host returned for a test lookup on 2026-11-16. Other Wikimedia hosts such as `upload.wikimedia.org` are possible for other images but were not observed. | Standard HTTP GET for the image. The `<img>` carries `crossorigin="anonymous"`, so the request is sent without credentials and Chromium did not store the host's `Set-Cookie` headers. Observed on 2026-11-16 without that attribute: the host set `NetworkProbeLimit` and `WMF-Uniq` (see [Cookies and device storage](#cookies-and-device-storage)). | Standard browser image cache. |
| **`unpkg.com`** | CDN hosting MapLibre GL JS and CSS vendor distribution files. | Standard HTTP GET for static JavaScript and stylesheet assets. | Standard CDN edge caching. |
| **`op.nachtigall.dev`** | Self-hosted OpenPanel instance receiving page analytics events. Not contacted on `localhost`, loopback addresses or `file:`. | Page URL (including the map state in the query string), page title, referrer, and standard request headers. See [Page analytics](#page-analytics-openpanel). | Retention is not documented here yet. |

No other network connections are established by the application.

---

## Page analytics (OpenPanel)

Open Earth counts page views and outgoing link clicks with [OpenPanel](https://openpanel.dev), an open-source analytics tool. The instance is self-hosted by the Open Earth operator at `op.nachtigall.dev`. The purpose is aggregate product statistics (for example how often the site is opened and which sources are followed). No advertising, no cross-site tracking, no personal profiles.

### Configuration (as deployed)

The configuration lives in `src/analytics.js`:

```js
{
  apiUrl: 'https://op.nachtigall.dev/api',
  clientId: '75cb34b1-c4d2-4299-a93f-f5563fbaf40c', // public client identifier
  trackScreenViews: true,
  trackOutgoingLinks: true,
  trackAttributes: true,
  filter: createScreenViewFilter() // see "What leaves the browser"
}
```

- Session replay is not enabled and not configured. The replay script is never requested.
- `identify`, `increment`, `decrement` and `setGlobalProperties` are not called. No user identifier is assigned or sent by the page.
- No element in Open Earth carries a `data-track` attribute, so `trackAttributes` currently sends nothing. Any future `data-track` event must be aggregate-level (for example "layer toggled") and be added to this document.
- The tracker script is a vendored, pinned copy served from the Open Earth origin (`vendor/openpanel/op1.js`, `@openpanel/web` 1.4.4, MIT). It is byte-identical to `https://openpanel.dev/op1.js` as of 2026-11-16, so openpanel.dev is not contacted by visitors. See `vendor/openpanel/README.md`.
- On `localhost`, `*.localhost`, `127.0.0.1`, `::1` and `file:` the tracker is neither loaded nor initialised.

### What leaves the browser

Observed in headless Chromium against this code (event bodies captured and answered by a local stand-in, nothing was sent to the real instance), checked against the readable tracker source:

| Event | When | Payload fields |
| --- | --- | --- |
| `screen_view` | On page load and when the address bar URL changes through the History API, except changes that only alter the map camera (see below). Open Earth rewrites the URL about 0.4 s after a pan or zoom and on feature selection. | `__path` = the full page URL including query string and fragment, `__title` = page title, `__referrer` = `document.referrer` |
| `link_out` | Click on a link whose `href` starts with `http` and points to another host (for example the GitHub or source links) | `href` (target URL), `text` (link text or title), `__path` (current full page URL), `__referrer` |

The full page URL contains the map state: selected feature (`v=type:id`), map center and zoom (`c=lat,lng,zoom`), projection, basemap, layer selection and any historical-search parameters. The map position and selected feature of each sent view are therefore transmitted to the analytics server.

A `filter` function in `src/analytics.js` (`createScreenViewFilter`) drops a `screen_view` when its URL differs from the previously sent `screen_view` only in the `c` (camera) parameter. Panning or zooming alone therefore sends nothing. The first view of a visit is always sent, and so is every change to any other parameter (selected feature, projection, basemap, range, layers, historical search). A sent view still carries the full URL including the current `c` value, so the initial page view and later changes carry the map position at that moment. `link_out` and any other event are not affected by the filter. If an event does not have the expected shape, the filter lets it through. Observed in headless Chromium (event bodies captured by a local stand-in): one load, two pans and one feature selection produced four `screen_view` events before the filter and two after it.

Request metadata sent with every event (standard for any HTTP request, plus the SDK headers): `openpanel-client-id`, `openpanel-sdk-name` (`web`), `openpanel-sdk-version`, `Content-Type`, `Origin`, `Referer`, `User-Agent`, `Accept-Language`, `Sec-CH-UA*` client hints where the browser sends them, and the client IP address as seen by the server. The script does not send screen size, timezone, installed fonts, canvas or other fingerprinting values in the payload.

### Cookies and device storage

- Open Earth (the pages, scripts and the analytics tracker) sets no cookies. Observed in Chromium: after the first page load, `context.cookies()` was empty.
- Third-party hosts are different, because the browser requests images and map data from them directly and they can answer with `Set-Cookie`. Observed on 2026-11-16 in headless Chromium against the code before the `crossorigin` change (page load, search for Krakatau, select it so the inspector shows its Wikipedia thumbnail): two cookies were stored, both for the host that serves the thumbnail and not for Open Earth.

  | Cookie | Domain | Notes |
  | --- | --- | --- |
  | `NetworkProbeLimit` | `thumb.wikimedia.org` | Value `0.001`, expires about one hour later, `Secure`, `SameSite=None`, not `HttpOnly` |
  | `WMF-Uniq` | `.thumb.wikimedia.org` | `HttpOnly`, `Secure`, `SameSite=None`, expires 2027-11-16 |

  This describes what that host did in one test run. It is not a statement about Wikimedia's cookie policy, and which cookies a host sets can change. No cookie was stored for any other host in that run. With `crossorigin="anonymous"` on the thumbnail `<img>` (current code), the same steps for Krakatau, Etna and Fuji left the cookie jar empty and the image still rendered, because the host answers with `Access-Control-Allow-Origin: *`; the host still sends `Set-Cookie` headers, the browser ignores them for credential-less requests. `curl -I` against `upload.wikimedia.org` image URLs and `en.wikipedia.org` API responses also showed `Set-Cookie` headers; the API request from the page is a `fetch` without credentials, and no `en.wikipedia.org` cookie was stored in the browser test. Cookies from other third-party hosts in other situations (other basemaps, other images, other regions) were not checked.
- The tracker sets no cookies and writes nothing to `localStorage`, `sessionStorage` or IndexedDB. Observed in a browser session (load, map pans, outgoing link click, opening the privacy dialog): `document.cookie` empty, no `sessionStorage` entries, no IndexedDB databases, and the only `localStorage` key is the application's own `open-earth:view:v1`, which is present without the tracker too. In the tracker source, `sessionStorage` is only read at start-up and is only written by a revenue-tracking function that Open Earth does not use.
- Visitors are not recognised by a stored identifier. The OpenPanel documentation describes unique-visitor counting through a daily rotating hash of non-identifying signals; how the self-hosted server derives and stores that value has not been verified for this document.

### Legal basis, retention, opt-out

- Legal basis: legitimate interest in aggregate usage statistics (Art. 6(1)(f) GDPR). This is a description of the intended basis and has not been reviewed legally.
- Retention: not documented yet. To be filled in from the OpenPanel instance configuration.
- Server-side handling of the IP address and user agent (hashing, geolocation, derived device and browser fields): determined by the instance configuration and not verified here.
- There is no in-app opt-out. Requests to `op.nachtigall.dev` can be blocked in the browser or by a content blocker without affecting the map. Privacy questions: contact@nachtigall.dev.

### Content Security Policy

The project currently sets no Content-Security-Policy. If one is added, the analytics needs `script-src 'self'` (the vendored tracker and `src/analytics.js` are external same-origin files, no inline script and no `unsafe-inline`) and `connect-src https://op.nachtigall.dev`. If the tracker is switched back to `https://openpanel.dev/op1.js`, add `https://openpanel.dev` to `script-src`.

### Not checked

Server-side behaviour of the live instance (cookies set in real `POST /track` responses, IP handling, retention), a legal review of the legal basis, and whether the information in the Privacy dialog satisfies Art. 13 GDPR in full.
