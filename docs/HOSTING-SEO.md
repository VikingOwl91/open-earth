# Hosting, crawling and performance baseline (SEO)

Observed on 2026-11-16 with plain `curl` requests against `https://open-earth.info` (read-only, a handful of URLs) and a local Lighthouse run of `main` at `b727251`. Everything below is a snapshot: re-run the verify commands before relying on a row.

Contents: [Crawl files](#crawl-files) | [Live findings](#live-findings-vs-recommended) | [Caddy snippet](#caddy-snippet) | [CSP proposal](#content-security-policy-proposal) | [Verify](#verify-with-curl) | [Performance baseline](#performance-baseline) | [Not verified](#not-verified)

## Crawl files

- `robots.txt` allows everything and points at the sitemap. It does **not** disallow `data/`, `src/` or `vendor/`.
- `sitemap.xml` lists exactly one URL, `https://open-earth.info/`, with no `lastmod`.

### Why `data/` stays crawlable

The snapshots are large (about 30 MB raw, `plate-steps.json` alone 9.2 MB), so blocking them looks attractive. Decision: do not block.

- The site is one indexable URL. There is no crawl budget to protect; Google fetches subresources with conditional requests and caches them, and the host already answers `If-None-Match` with 304.
- Google renders the page and the map loads these files at start. Blocking them would most likely leave the rendered page showing "Loading public sources..." and empty counters (not tested), and Search Console reports blocked page resources.
- What we actually want is "do not index the JSON files". That is a header job, not a robots job: `X-Robots-Tag: noindex` on `/data/*` (see the Caddy snippet). A robots `Disallow` would also hide that header from crawlers.
- Revisit only with evidence: if server logs show a crawler pulling the large files repeatedly, add `Disallow: /data/plate-steps.json` style rules for that crawler specifically, not a blanket block.

Google documents a 15 MB limit per fetched file; the largest file here (`eruptions.json`, 10.5 MB raw) is under it, `faults.json` and `plate-steps.json` (about 9 MB) are below it too. Keep that in mind if the snapshots grow.

### Sitemap and `lastmod`

- Only the root URL is listed. Deep links (`/?v=volcano:...&c=...`) are application state of the same document, not separate pages; they must not be listed and should canonicalise to `/` (the `<link rel="canonical">` belongs in `index.html`).
- About, Impressum and Privacy are modals inside `index.html`. They have no URLs of their own, so there is nothing to list for them.
- `lastmod` is omitted on purpose. A hardcoded date would be false after the next release, and search engines ignore `lastmod` values that prove unreliable. If you want it later, set it at deploy time from the real change time of the page, for example `git log -1 --format=%cI -- index.html src` in the deploy step, and never edit it by hand.
- The `<loc>` must match the canonical URL exactly, including the trailing slash.

## Live findings vs recommended

| Item | Live (2026-11-16) | Recommended |
| --- | --- | --- |
| `/` | 200, `text/html; charset=utf-8`, `etag`, `last-modified: Mon, 05 Oct 2026 18:28:19 GMT`, no `cache-control` | add `Cache-Control: no-cache` |
| `/robots.txt` | 404, empty body | file added in this change, takes effect on deploy |
| `/sitemap.xml` | 404, empty body | file added in this change, takes effect on deploy |
| `/data/volcanoes.json` | 200, `application/json`, `last-modified: Sun, 06 Sep 2026 16:51:44 GMT`, 2,271,248 B raw, 524,707 B with gzip | add `Cache-Control: no-cache`, `X-Robots-Tag: noindex` |
| `/src/app.js` | 200, `text/javascript; charset=utf-8`, `etag`, no `cache-control` | `Cache-Control: no-cache` (unversioned file names) |
| Unknown path | 404, `content-length: 0`, no body. `/src/`, `/data/`, `/vendor/openpanel/` also 404 | keep: real 404, no SPA fallback, no directory listing |
| Query string URL (`/?q=1`) | 200, same document and ETag as `/` | fine, canonical tag handles it |
| http to https | `308 Permanent Redirect` to `https://open-earth.info/` | keep |
| `www.open-earth.info` | no DNS answer (curl: could not resolve host), so nothing to redirect | optional: add DNS plus a redirect block (below) |
| Compression | `zstd` and `gzip` served for html, js, json; `Accept-Encoding: br` alone gets an uncompressed body | keep `encode zstd gzip`; brotli would need a Caddy plugin and is not required |
| Cache headers | none on any path. Only `etag` and `last-modified`, so browsers apply heuristic freshness. A conditional request with `If-None-Match` returns 304 | explicit `Cache-Control` per path class (below) |
| Content types | `.json` `application/json`, `.js` `text/javascript; charset=utf-8`, `.html` `text/html; charset=utf-8` | keep |
| HTTP version | HTTP/2; no `alt-svc` header seen, so HTTP/3 is not advertised | optional |
| HSTS | absent | add, start with a short `max-age` |
| Other security headers | none seen (no `X-Content-Type-Options`, `Referrer-Policy`, CSP, `Permissions-Policy`, framing protection) | add (below) |

Two quirks worth knowing when you test:

- `curl -I` with `Accept-Encoding: zstd` reports `content-length: 13` for HEAD, which is the size of an empty zstd frame, not of the document. Use a GET with `-D -` (see Verify) to read real sizes.
- Heuristic freshness matters here: `index.html` has `last-modified` 2026-10-05 and no `cache-control`, so a browser may legally reuse it for roughly a tenth of its age (days) without asking. A release can therefore reach returning visitors late. The data files are not affected inside the app, because `src/data.js` and `src/providers.js` fetch with `cache: 'no-cache'`.

### Deploy gap (observation, no judgment)

The repository has no deploy workflow, and the live site is not the current `main`:

- Live `index.html` is 8,278 bytes; `main` is 7,954. The live page loads `./ui-releases/responsive-20261005T182759Z/src/style.css` and `.../src/app.js`, has a "Refresh data" row, and has no `<script src="./src/analytics.js">`.
- `https://open-earth.info/src/analytics.js`, `/vendor/openpanel/op1.js` and `/data/imo-volcano-status.json` return 404, but exist in `main`.
- `https://open-earth.info/data/manifest.json` has `generatedAt: 2026-09-06T16:46:37Z`, while `update-data.yml` in the repository runs daily.

Consequence for SEO work: robots.txt, sitemap.xml, head metadata and headers only exist for crawlers once the site is redeployed and the headers are applied in Caddy. Check the verify commands after every deploy.

### Where this differs from other docs

- `docs/ARCHITECTURE.md` (Static hosting requirements) asks for compression, the right MIME type, long-lived cache headers on snapshots and `no-cache` on `manifest.json`. Compression and MIME type are met. No `Cache-Control` is sent at all. Long-lived caching of `data/*.json` is also not useful in practice: the app requests them with `cache: 'no-cache'`, so they always revalidate. This document recommends `no-cache` (revalidate, 304 when unchanged) for all of `data/`.
- `docs/PRIVACY.md` says no CSP is set today; that matches the live headers. Its third-party table lists `basemaps.cartocdn.com`, but the code requests basemaps from `tiles.openfreemap.org` (`src/map.js`), and `demotiles.maplibre.org` only for the `classic` style. That table is stale and was not edited here.

## Caddy snippet

For the `open-earth.info` site block. The site root path is a placeholder; keep your own. The block passed `caddy validate` and was served in a throwaway Caddy v2.11.9 container (`caddy:2-alpine`, site address swapped to `http://:8792`, repository mounted read-only) where the cache classes, `X-Robots-Tag`, zstd, the security headers and the 404 for `/does-not-exist` and `/data/` behaved as listed in the Verify table. It was not run against your real Caddy or its other site blocks.

```caddyfile
open-earth.info {
	root * /srv/open-earth    # placeholder: use the real site root
	encode zstd gzip

	header {
		Strict-Transport-Security "max-age=300"        # raise to 31536000 once verified; no includeSubDomains, no preload
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		X-Frame-Options "DENY"
		Permissions-Policy "geolocation=(), camera=(), microphone=(), payment=(), usb=()"
		# Proposal only. Run report-only first, see the CSP section.
		Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' https://unpkg.com; img-src 'self' data: blob: https://tiles.openfreemap.org https://wms.gebco.net https://thumb.wikimedia.org https://upload.wikimedia.org; connect-src 'self' https://tiles.openfreemap.org https://demotiles.maplibre.org https://wms.gebco.net https://earthquake.usgs.gov https://nominatim.openstreetmap.org https://en.wikipedia.org https://op.nachtigall.dev; font-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'"
	}

	# Unversioned file names: always revalidate, the ETag makes it a cheap 304.
	@revalidate path / /index.html /src/* /data/*
	header @revalidate Cache-Control "no-cache"

	# Pinned vendored tracker: changes rarely, one day is enough.
	@vendor path /vendor/*
	header @vendor Cache-Control "public, max-age=86400"

	@crawlfiles path /robots.txt /sitemap.xml
	header @crawlfiles Cache-Control "public, max-age=3600"

	# Snapshots are data, not pages: crawlable (the map needs them) but not indexable.
	@data path /data/*
	header @data X-Robots-Tag "noindex"

	# Static files only. Do NOT add try_files {path} /index.html (an SPA fallback
	# would turn every unknown URL into a soft 404). Unknown paths must stay 404.
	file_server
}

# Optional, only after a DNS record for www exists:
www.open-earth.info {
	redir https://open-earth.info{uri} permanent
}
```

Notes:

- `http` to `https` is already handled (308); Caddy's automatic HTTPS does this, nothing to add.
- `X-Frame-Options` and `frame-ancestors` do the same job for old and new browsers; `frame-ancestors` is ignored in a report-only policy, so keep the header until the CSP is enforced.
- `max-age=300` for HSTS is deliberately timid. Once the verify commands pass over a few days, move to `31536000`.
- If the Wikipedia thumbnails or the Subresource Integrity attributes (below) change which origins are used, edit the CSP, not the other way round.
- Subresource Integrity for the two `unpkg.com` tags (`maplibre-gl.js` and `.css`, pinned to 5.7.1) is a worthwhile `index.html` change: add `integrity` and `crossorigin="anonymous"`. The hashes were not computed here.

## Content Security Policy proposal

This is a proposal, not a tested policy. Ship it as `Content-Security-Policy-Report-Only` first, browse the whole app (every basemap, bathymetry, search, inspector with a Wikipedia image, historical search, About/Impressum/Privacy), and read the console for violations before switching to the enforcing header.

Origins, derived from the code:

| Directive | Origin | Source in code |
| --- | --- | --- |
| `script-src`, `style-src` | `https://unpkg.com` | `index.html`: `maplibre-gl@5.7.1` `.js` and `.css` |
| `script-src` | `'self'` | `src/*.js`, `src/analytics.js` (loads `./vendor/openpanel/op1.js`); no inline scripts in `index.html` |
| `connect-src`, `img-src` | `https://tiles.openfreemap.org` | `src/map.js` basemap styles (dark, positron, liberty, fiord); style JSON, tiles, glyphs, sprites |
| `connect-src` | `https://demotiles.maplibre.org` | `src/map.js` `classic` style |
| `connect-src`, `img-src` | `https://wms.gebco.net` | `src/map.js` GEBCO WMS bathymetry |
| `connect-src` | `https://earthquake.usgs.gov` | `src/data.js` live feeds and FDSNWS historical search |
| `connect-src` | `https://nominatim.openstreetmap.org` | `src/search.js` geocoding |
| `connect-src` | `https://en.wikipedia.org` | `src/inspector.js` thumbnail lookup |
| `img-src` | `https://thumb.wikimedia.org`, `https://upload.wikimedia.org` | not in the code: the Wikipedia API returns the thumbnail URL at runtime. The first host was seen in the report-only trial below (it was the one that violated the first draft); `upload.wikimedia.org` is the other host Wikipedia uses for images and is included as a precaution, not observed |
| `connect-src` | `https://op.nachtigall.dev` | `src/analytics.js` `apiUrl` |
| `worker-src` | `'self' blob:` | MapLibre creates its worker from a blob (a `blob:` request shows up in the Lighthouse trace) |
| `img-src` | `data: blob:` | `index.html` favicon is a `data:` URI; MapLibre uses blob images |

Not included, on purpose:

- `https://raw.githubusercontent.com`: not requested by the current frontend (only `scripts/update_data.py` uses it, in CI). If the WIP lands and the browser fetches from there, add it to `connect-src`.
- `https://openpanel.dev`: only needed if the tracker is switched back to the CDN copy (see `docs/PRIVACY.md`).
- `'unsafe-inline'` and `'unsafe-eval'`: `grep` finds no inline `style=` attributes and no inline scripts in `index.html` or `src/*.js`. If the trial reports violations, fix the cause instead of adding them. If `index.html` gains a JSON-LD block (`<script type="application/ld+json">`), it is data and is not governed by `script-src`.

Trial run so far: the policy above, as report-only behind that test Caddy, was loaded in Chromium 156 with a deep-linked volcano (Krakatau), all five basemaps, the bathymetry and faults toggles, the inspector with its Wikipedia image, a search, and the About and Privacy dialogs. The first draft produced one violation (`img-src` for the thumbnail host `thumb.wikimedia.org`); after adding it the same walk-through reported 0 violations. The trial ran on `127.0.0.1`, where analytics is disabled by design, so `op.nachtigall.dev` was not exercised, and it covered Chromium only. Repeat it on the real host before enforcing.

Links out (GitHub, Ko-fi, provider pages) are navigations, not subresources, so the CSP does not affect them.

## Verify with curl

Use GET with `-D -` and discard the body (`-sS -o /dev/null -D -`). HEAD output for compressed responses is misleading.

```sh
curl -sS -o /dev/null -D - -H 'Accept-Encoding: gzip, zstd' https://open-earth.info/ | grep -iE '^(HTTP|content-type|content-encoding|cache-control|etag|last-modified|strict-transport|x-content-type|referrer-policy|x-frame|permissions-policy|content-security|x-robots)'
```

| Check | Command | Expect |
| --- | --- | --- |
| robots.txt | `curl -sS -i https://open-earth.info/robots.txt` | 200, `text/plain`, contains `Sitemap:` |
| sitemap | `curl -sS -i https://open-earth.info/sitemap.xml` | 200, XML content type (Caddy sends `text/xml`), one `<loc>` |
| Real 404 | `curl -sS -o /dev/null -w '%{http_code}\n' https://open-earth.info/does-not-exist` | `404` (not `200`) |
| http to https | `curl -sSI http://open-earth.info/` | `308` and `location: https://open-earth.info/` |
| www redirect | `curl -sSI https://www.open-earth.info/` | 301/308 to the apex (only after DNS exists) |
| Compression | `curl -sS -o /dev/null -D - -H 'Accept-Encoding: zstd' https://open-earth.info/data/volcanoes.json \| grep -i content-encoding` | `zstd`; repeat with `gzip` |
| Size on the wire | `curl -sS -o /dev/null -H 'Accept-Encoding: gzip' -w '%{size_download}\n' https://open-earth.info/data/volcanoes.json` | about 0.5 MB (2.27 MB raw) |
| Revalidation | `curl -sS -o /dev/null -w '%{http_code}\n' -H 'If-None-Match: <etag from the GET above>' https://open-earth.info/` | `304` |
| Cache classes | `curl -sS -o /dev/null -D - https://open-earth.info/src/app.js \| grep -i cache-control` (also `/`, `/data/manifest.json`, `/vendor/openpanel/op1.js`) | `no-cache`, `no-cache`, `no-cache`, `public, max-age=86400` |
| Content types | `curl -sS -o /dev/null -D - https://open-earth.info/data/manifest.json \| grep -i content-type` (and `/src/app.js`) | `application/json`, `text/javascript` |
| HTTP/2 | `curl -sS -o /dev/null -w '%{http_version}\n' https://open-earth.info/` | `2` |
| Security headers | the grep above | HSTS, nosniff, referrer-policy, frame, permissions-policy, CSP report-only present |
| Noindex on data | `curl -sS -o /dev/null -D - https://open-earth.info/data/manifest.json \| grep -i x-robots-tag` | `noindex` |
| No noindex on page | `curl -sS -o /dev/null -D - https://open-earth.info/ \| grep -i x-robots-tag` | no output |

Outside curl: after deploy, submit `https://open-earth.info/sitemap.xml` in Google Search Console and Bing Webmaster Tools, and use the URL Inspection tool's rendered view to confirm the map shell and the head metadata are seen as intended.

## Performance baseline

Core Web Vitals proxy numbers for the first load of `main` at `b727251`, measured once on 2026-11-16 on a workstation.

### Method and limits

- Lighthouse 13.6.0 (`npx --yes lighthouse@13.6.0`, installed in the npx cache, no project dependency added), Chromium 156 headless, flags `--headless=new --no-sandbox --enable-unsafe-swiftshader --use-angle=swiftshader --ignore-gpu-blocklist`.
- Page served from a throwaway Node static server on `127.0.0.1:8790` (kept outside the repo, root = the worktree). It sends gzip (level 6), `ETag` and `Last-Modified`, no `Cache-Control`, and a real 404, to resemble the live host. Production serves zstd/gzip from Caddy; sizes differ slightly (the live `volcanoes.json` is 524,707 B gzip, the local one 512,157 B).
- Mobile: Lighthouse default (emulated phone, simulated slow 4G: 150 ms RTT, 1.6 Mbps, 4x CPU slowdown). Desktop: `--preset=desktop` (40 ms RTT, 10 Mbps, no CPU slowdown). Both use Lighthouse's simulated throttling, which re-computes timings from an unthrottled trace.
- 3 runs each, median reported (range in brackets).
- Third-party requests (unpkg, OpenFreeMap tiles, USGS feed) went over the real internet; only the first-party files were local. Map rendering uses SwiftShader (software WebGL), which slows main-thread and paint work compared with a real GPU.
- Analytics is disabled on `localhost` by design (`src/analytics.js`), so `op.nachtigall.dev` and `op1.js` are not in these numbers.
- This is lab data from one machine. There is no field data (CrUX) for the site. INP cannot be measured without interaction; Total Blocking Time is used as its lab proxy. Lighthouse's Performance score was never the goal, only a coarse indicator.

### Results

| Metric | Mobile (median, range) | Desktop (median, range) |
| --- | --- | --- |
| First Contentful Paint | 2.99 s (2.98 to 2.99) | 0.72 s (0.71 to 0.75) |
| Largest Contentful Paint | 2.99 s (same as FCP) | 0.72 s (same as FCP) |
| Cumulative Layout Shift | 0.095 | 0.011 |
| Total Blocking Time | 4.07 s (3.98 to 6.11) | 0.83 s (0.78 to 1.04) |
| Speed Index | 5.0 s (4.9 to 5.7) | 2.2 s (2.1 to 2.3) |
| Time to Interactive | 11.8 s (11.6 to 14.0) | 2.6 s (2.5 to 2.8) |
| Performance score | 0.54 (0.52 to 0.54) | 0.67 (0.66 to 0.68) |
| SEO category | 100 | 100 |

What the numbers point at:

- The LCP element is the brand mark `div.mark` ("◎") in `header.brand`. It is a text glyph, so LCP equals FCP, and it waits about 560 ms of render delay for render-blocking resources. Lighthouse lists the `unpkg.com` MapLibre CSS and JS plus the local scripts as render-blocking, with an estimated 2.08 s of savings on mobile.
- The only layout shift is the MapLibre attribution control in the bottom-right corner (0.095 on mobile, just under the 0.1 "good" limit; 0.011 on desktop).
- TBT is dominated by script execution: `maplibre-gl.js` about 4.3 s and `src/app.js` about 2.0 s of main-thread time under the 4x mobile slowdown, plus 20 long tasks (the longest about 1 s).

### First-load transfer

Mobile run 1 (the other runs differ mainly in the tile requests; desktop run 1 had 67 requests, 7.71 MB): 64 requests, 7.15 MB transferred, 21.3 MB decoded.

| Origin | Requests | Transferred |
| --- | --- | --- |
| first party (`data/`, `src/`, `/`) | 27 | 3.22 MB |
| `tiles.openfreemap.org` (tiles, glyphs, sprite) | 29 | 3.65 MB |
| `unpkg.com` (MapLibre JS and CSS) | 2 | 0.26 MB |
| `earthquake.usgs.gov` (24 h feed) | 1 | 0.02 MB |

Largest first-party resources, sizes with gzip (raw size in brackets):

| Resource | Transferred | Raw | Loaded |
| --- | --- | --- | --- |
| `data/plate-steps.json` | 2.49 MB | 9.20 MB | eager (boot, with plate polygons) |
| `data/volcanoes.json` | 0.51 MB | 2.27 MB | eager |
| `data/plate-polygons.json` | 80 KB | 229 KB | eager |
| `data/plates.json` | 50 KB | 166 KB | eager |
| `data/volcanic-reports.json` | 23 KB | 86 KB | eager |
| `src/*.js` (10 files) | about 42 KB | about 150 KB | eager, synchronous, end of `body` |
| `src/*.css` (3 files) | about 10 KB | about 42 KB | eager, render-blocking |
| provider status files (`usgs`, `pvmbg`, `jma`, `geonet`, `imo`) | about 12 KB | about 130 KB | eager |

Largest third-party resources: four OpenFreeMap vector tiles at 0.6 to 0.73 MB each, `maplibre-gl.js` at 248 KB (941 KB raw), the 2x sprite at 119 KB.

Lazy (not requested in any run, confirmed in the Lighthouse network log and in the code): `data/faults.json` (9.3 MB raw, 2.33 MB gzip) only when the Active faults layer is switched on; `data/eruptions.json` (10.5 MB raw, 0.44 MB gzip) only when a volcano's History tab is opened; Wikipedia thumbnails on selection; Nominatim only on search.

`src/app.js` waits for `Promise.all` over manifest, earthquakes, volcanoes, activity, plates, tectonics (`plate-steps.json` plus polygons) and trenches before it rehydrates the map layers. The 2.5 MB tectonics download therefore gates every data layer. On Lighthouse's mobile profile (about 1.47 Mbps download) 2.49 MB is roughly 13 s of pure transfer; that figure is arithmetic, not a measured time-to-first-layer.

### Recommendations

Not implemented here (app code and the data pipeline are out of scope for this change). Expected effects are estimates unless stated.

1. **Do not let `plate-steps.json` gate the other layers.** Render earthquakes, volcanoes and plates as soon as their own files arrive, and add the tectonic step layer when it loads. It is 77% of first-party transfer and the largest single item. Expected effect: time to first visible data on slow links drops by most of the tectonics download (about 13 s on the simulated mobile profile by the arithmetic above); no effect on LCP/FCP.
2. **Shrink `plate-steps.json` in the pipeline.** Measured offline on the checked-in file with gzip level 6: 2.54 MB as is; 2.27 MB (minus 11%) after dropping properties the code does not read (it keeps `SEQNUM`, `PLATEBOUND`, `STEPLENGTH`, `VELOCITYLE`, `STEPCLASS`, `Boundary_*`, `Plate_Pair`); 1.41 MB (minus 45%) when coordinates are also rounded to 3 decimals (about 100 m). The inspector's use of each property and the visual result were not checked. This belongs in `scripts/update_data.py`.
3. **Take the render-blocking third-party assets off the critical path.** Vendor MapLibre next to the OpenPanel copy (`vendor/`, same pinned 5.7.1) so it is same-origin, cacheable by this host's rules, covered by `script-src 'self'`, and gone from `docs/PRIVACY.md`'s third-party list; add `defer` to the local scripts. Lighthouse estimates up to about 2 s of savings on the mobile profile, which would bring FCP/LCP from 3.0 s toward the 2.5 s "good" line; unverified.
4. **Reserve space for the attribution control** (or set `attributionControl: { compact: true }` explicitly) to remove the 0.095 mobile shift and leave CLS clearly under 0.1. Expected: below 0.02, unverified.
5. **Apply the cache classes from the Caddy snippet.** `no-cache` plus ETag turns repeat-visit loads of `src/` and `data/` into 304s and removes heuristic staleness of `index.html`. No effect on first load; repeat-visit gain was not measured.

TBT (about 4 s on mobile) has no cheap fix: it is mostly MapLibre start-up and parsing multi-MB GeoJSON in the page. Recommendations 1 and 2 reduce the GeoJSON part; they do not touch MapLibre's own cost.

## Not verified

- Behaviour of the owner's actual Caddyfile and server: the snippet was only tested in a throwaway container, not on the live host.
- Whether Caddy's `encode` serves `br` (it did not for `Accept-Encoding: br` alone) beyond that one observation, and any `www` handling (no DNS record exists to test).
- The CSP on the real host and in browsers other than Chromium; the analytics request to `op.nachtigall.dev` under the policy; the `upload.wikimedia.org` entry (not observed).
- Real-device and field performance (CrUX, GPU rendering, real network), repeat-visit performance, and the effect of any recommendation.
- Google's actual crawl and render of the live site (no Search Console access used).
- Deploy process: the cause of the gap between live and `main` is unknown; only the differences were observed.
