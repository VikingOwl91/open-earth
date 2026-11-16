# SEO proposal: static landing pages for Open Earth

Status: proposal only. No application code, no generated pages.
Written 2026-11-16 against `main` at b727251. Every external term below was read on 2026-11-16 (URLs given). Repo claims name the file or command behind them.

Basic on-page SEO (head tags, robots, sitemap) is handled elsewhere and is a prerequisite here, not part of this proposal.

## 1. Short answer

Do not generate pages for all volcanoes now. Ship one crawlable "Sources and method" page first (option b), fix the deploy gap that already leaves the live data stale, and decide on a small pilot of generated volcano pages (option c, subset) only after that and only with reference content in the static HTML. Do not prerender the map (option d).

## 2. Findings that change the question

Three premises in the brief did not hold when checked.

| Premise | What I found | Evidence |
| --- | --- | --- |
| About 1,400 volcanoes | The catalog is 1,214 Holocene volcanoes (VOTW 5.4.0). `docs/DATA-SOURCES.md` still says "~1,350". | `data/manifest.json` `counts.volcanoes` = 1214; 1,214 unique `VolcanoNumber`; `src/data.js:11` names VOTW 5.4.0 |
| schema.org has no Volcano type | It does: Thing > Place > Landform > Volcano, "A volcano, like Fujisan." It has no properties of its own. | https://schema.org/Volcano, read 2026-11-16 |
| Production gets the daily data refresh | It does not. The live data files are about 71 days older than `main`. | see below |

Live site check (curl, 2026-11-16 15:42 UTC):

| URL | `last-modified` | Notes |
| --- | --- | --- |
| `https://open-earth.info/` | Mon, 05 Oct 2026 18:28:19 GMT | server: Caddy; script tag points at `ui-releases/responsive-20261005T182759Z/src/app.js` |
| `https://open-earth.info/data/volcanoes.json` | Sun, 06 Sep 2026 16:51:44 GMT | |
| `https://open-earth.info/data/manifest.json` | Sun, 06 Sep 2026 16:51:44 GMT | live `generatedAt` is 2026-09-06; repo `generatedAt` is 2026-11-16 |
| `https://open-earth.info/data/imo-volcano-status.json` | 404 | the IMO provider is merged in the repo but not deployed |
| `/robots.txt`, `/sitemap.xml` | 404 | basic SEO not live yet |

Conclusion: the repo has no deploy workflow (`.github/workflows/` holds only `ci.yml` and `update-data.yml`; `grep -rin deploy docs README.md CONTRIBUTING.md .github` finds only the README "Deployment" paragraph and the roadmap note that the deploy contract is intentionally not published). Production is deployed by hand or by something outside the repo, and the daily bot commits (`open-earth-data-bot`, last 2026-11-16) do not reach it. Any alert status baked into static pages would be as old as the last manual deploy. This matters more than any SEO tactic and is open question 1.

## 3. Data reality

Measured with throwaway scripts against the files in `data/` (not committed).

### 3.1 Volume and size

| File | Size | Rows |
| --- | --- | --- |
| `data/volcanoes.json` | 2.2 MB | 1,214 volcanoes |
| `data/eruptions.json` | 10 MB | 11,089 eruptions, 891 of the catalog volcanoes have at least one row, 323 have none |
| `data/volcanic-reports.json` | 84 KB | 27 weekly reports |
| `data/usgs-volcano-status.json` | 48 KB | 67 statuses (62 match a catalog volcano) |
| `data/pvmbg-status.json` | 32 KB | 69 statuses (65 matched) |
| `data/imo-volcano-status.json` | 32 KB | 33 statuses (33 matched) |
| `data/jma-volcano-status.json` | 12 KB | 12 statuses (12 matched) |
| `data/geonet-volcano-status.json` | 12 KB | 12 statuses (8 matched) |

Docs drift: `docs/DATA-SOURCES.md` claims 127 PVMBG, 111 JMA and 68 USGS volcanoes; the snapshots hold 69, 12 and 67. I did not investigate why (JMA may only list volcanoes with a current warning). Static pages must be generated from the snapshots, not from the docs.

### 3.2 Fields per volcano, by the project's three tiers

Present in `data/volcanoes.json` properties (counts of 1,214): `VolcanoNumber`, `VolcanoName`, `Country`, `Remarks`, coordinates (all 1,214); `VolcanoType` 1,213; `Elevation` 1,212; `TectonicSetting` 1,208; `LastEruption` 848 (366 null); `Within_5km/10km/30km/100km` population counts 1,178; `VPImageFileName`, `VPImageCaption`, `VPImageCredit` 1,143 (71 have no image).

| Tier | Fields | Static-safe? |
| --- | --- | --- |
| REFERENCE | name, country, GVP number, type, elevation, tectonic setting, `Remarks` (median 121 words, p10 72 words, 5 shorter than 200 characters), last known eruption year, eruption list (VEI, dates, evidence), coordinates | Yes. Changes at GVP release cadence, not daily. |
| OBSERVED | regional alert status (`label`, `nativeStatus`, `observedAt`), GVP/USGS weekly report text, live earthquakes within 250 km | Stale by construction. Earthquakes are live API calls in the browser and can never be static. |
| DERIVED | containing plate, nearest boundary, nearest trench, nearest volcano or fault, computed in the browser (`src/geo.js`, `src/inspector.js`) | Possible but would need a second implementation in Python. Risk of divergence from the map. Not needed for a first version. |

### 3.3 Who is covered by observed status

Union of the five regional snapshots matched to the catalog by `volcanoNumber`: 180 volcanoes (Indonesia 65, United States 62, Iceland 33, Japan 12, New Zealand 8). Weekly reports add 27 more (union 195). Volcanoes with a last eruption in 2000 or later: 231; union with the 195: 337.

So 1,019 of 1,214 pages (84 percent) would have no observed content at all. They would be GVP reference data re-presented.

### 3.4 What would make a page useful rather than thin

Honest assessment: the unique value of Open Earth is not any single volcano's facts (GVP, USGS and Wikipedia already hold them). It is the cross-source view with preserved semantics. In order of usefulness:

1. Eruption history table from GVP (dates, VEI, evidence method, uncertainty), rendered as a readable table. 58 rows for Krakatau. Median volcano has 4. Real content, but it is GVP's.
2. The authority's native alert scale explained next to the volcano, with provider, scale name and a link to the authority. Unique in framing (no merged scale), but the level itself must not be baked in (section 6.4).
3. Plain-language reading guide per volcano type and tectonic setting. Templated across hundreds of pages, so by itself it counts as boilerplate.
4. A link into the live map at the volcano.

Items 3 and any generated prose are exactly what Google's policies call out. Google's spam policy defines scaled content abuse as "many pages are generated for the primary purpose of manipulating search rankings and not helping users" and doorway abuse as pages "created to rank for specific, similar search queries" (https://developers.google.com/search/docs/essentials/spam-policies, read 2026-11-16). Pages that are a faithful, attributed re-presentation with a real function (a stable citable URL, a readable eruption table, the map link) are defensible. Pages padded to look different are not. Measured: only 1 duplicated `Remarks` opening in the catalog, so the GVP text itself is unique per volcano.

## 4. Licensing and attribution

### 4.1 Smithsonian GVP

Source: https://volcano.si.edu/gvp_termsofuse.cfm ("Terms of Use for GVP Content"), read 2026-11-16 by direct fetch (WebFetch got HTTP 403; curl with a descriptive User-Agent returned 200). Citation page: https://volcano.si.edu/gvp_votw.cfm. Underlying: https://www.si.edu/termsofuse.

Quoted terms:

- "All material created by and made available on this website by GVP is governed by the Smithsonian Terms of Use. The Smithsonian invites visitors to use its online content for personal, educational and other non-commercial purposes."
- Permitted non-commercial use is conditional: "You must cite the author and source of the Content as you would material from any printed work." "You must also cite and link to, when possible, the SI Website as the source of the Content." "You may not remove any copyright, trademark, or other proprietary notices including attribution information, credits, and notices, that are placed in or near the text, images, or data."
- Database: "The database compilation is a product of employees of the United States, and falls under (2) in the Intellectual Property Rights in Content section above." Item (2) is "the Content was never eligible for copyright protection because it was created by an employee of the United States as part of his or her official duties". "Database content includes the majority of material describing volcanoes and eruptive activity provided through this website, downloads, or webservices."
- Weekly report: "This online publication of current volcanic activity is a product of employees of the United States, and falls under (2) above."
- Photographs: "Unless otherwise noted in the caption for an image, GVP makes no guarantee or assurance regarding copyright status; it is your responsibility to determine what permission(s) are needed to use the Content and, if necessary, to obtain such permission." Photos credited to a Smithsonian employee or other US agency fall under (2); others are not covered.
- Commercial use: "You may not use the Content for commercial purposes. This means that you may not sell the Content or sell materials, products or services that use and incorporate the Content, nor may you use the Content to promote or advertise products or services."
- General citation line: "Global Volcanism Program, Smithsonian Institution" with a hyperlink to https://volcano.si.edu/. "More specific deep-linking is allowed as long as this minimum citation standard is met."
- Database citation, as printed on the database page: "Global Volcanism Program, 2026. [Database] Volcanoes of the World (v. 5.4.0; 7 Aug 2026). Distributed by Smithsonian Institution, compiled by Venzke, E. https://doi.org/10.5479/si.GVP.VOTW5-2026.5.4". A per-volcano form exists: "Global Volcanism Program, 2026. St. Helens (321050) in [Database] ...".

Conclusion:

| Content | May be republished in static pages? |
| --- | --- |
| Catalog facts (name, country, type, elevation, tectonic setting, coordinates, last eruption) | Yes, non-commercial, with the citation and link above. The terms say database content is a US government work. |
| Eruption records | Same as above. |
| `Remarks` volcano profile text | Part of "database content" per the terms, so yes on the same conditions. Quote it as GVP text, do not paraphrase or edit it silently, keep it attributed. |
| Weekly report text | Same, with a link to the report. |
| `VPImageFileName` / `VPImageCaption` / `VPImageCredit` photos | No. GVP gives no copyright assurance for photos. The snapshot holds only file name, caption and credit, not the image. Do not embed. A text link to the GVP volcano page is fine. |
| Commercial use | Not allowed. See the Ko-fi question in section 9. |

The terms do clearly allow this for non-commercial use with attribution. What they do not do is grant an open licence (no CC0, no CC BY). The Smithsonian's own terms say the "compilation" is Smithsonian-owned while individual components may not be. The safer variant, if the owner wants zero ambiguity: ask GVP in writing (the terms point to https://volcano.si.edu contacts and the Smithsonian terms page) whether a generated, attributed, non-commercial page per volcano is in scope. I did not contact them.

Related: the repo never records the VOTW version in the snapshot (only `fetchedAt`); `src/data.js:11` hard-codes "VOTW 5.4.0". The required citation names a version and date, so the generator needs the version from the snapshot. That is a small change to `scripts/update_data.py`, not part of this proposal.

Also note: GVP's robots.txt carries a Content-Signal of `search=yes,ai-train=no,use=reference` (https://volcano.si.edu/robots.txt, read 2026-11-16). Search indexing of our pages is not what it restricts, but it shows the publisher cares about downstream use. Keep attribution prominent.

### 4.2 Regional providers

| Provider | Terms found | Required attribution | Static-page use |
| --- | --- | --- | --- |
| USGS | "USGS-authored or produced data and information are considered to be in the U.S. Public Domain." Some non-USGS photos and graphics are copyrighted. Source: https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits (2026-11-16). I could not read the HANS API page (HTTP 403), so API-specific terms are unverified. | "proper credit be given", example "Credit: U.S. Geological Survey" | Level text and link to the notice are fine. No images. |
| JMA | Terms "based on the Public Data License (Version 1.0)" and "compatible with the Creative Commons Attribution License 4.0". Source: https://www.jma.go.jp/jma/en/copyright.html (2026-11-16) | "The user must cite the source when using the Content." Example "Source: Japan Meteorological Agency website (URL of relevant page)". Edited content must state it was edited. | Fine. State that Open Earth shows JMA's level without recomputing it. |
| PVMBG / MAGMA | No terms, licence, privacy or API documentation found on https://magma.esdm.go.id/v1 (fetched 2026-11-16). A web search found none either. | Unknown | Not established. Treat as unverified (see below). |
| GeoNet | "GeoNet content is copyright Earth Sciences New Zealand and is licensed under a Creative Commons Attribution 3.0 New Zealand License." (https://www.geonet.org.nz/data and https://www.geonet.org.nz/disclaimer, 2026-11-16). This is CC BY 3.0 NZ, not 4.0. The copyright holder is named "Earth Sciences New Zealand"; our snapshot and docs say "GNS Science". | Attribution under CC BY. The disclaimer page names no separate wording. | Fine with attribution and a link to the licence. Update the provider name in the snapshot. |
| IMO | The OpenAPI document declares `info.license` "Attribution 4.0 International (CC BY 4.0)" (https://api.vedur.is/volcanoes/openapi.json, 2026-11-16). The web conditions page (https://en.vedur.is/about-imo/the-web/conditions, 2026-11-16) says "reference must be made to the Icelandic Meteorological Office and the date of data downloading" and "no authorisation is given to change data ... unless the source and modification is stated clearly". | IMO, plus the download date | Fine. The snapshot's `fetchedAt` supplies the download date, so show it. |

PVMBG is the gap. Until the owner confirms terms with PVMBG, static pages should show Indonesian status only as a link ("Monitored by PVMBG, level published at <MAGMA link>") and not republish the level text. The map already shows PVMBG levels at runtime from the same snapshot, so this is a stricter standard than the app applies today. State that choice openly. Note that `pvmbg-status.json` `reportUrl` values carry a `?signature=` query. Do not publish those in static pages; link to the MAGMA volcano page instead.

Attribution text for every page, as a template (all variables from snapshots):

> Catalog and eruption data: Global Volcanism Program, 2026. [Database] Volcanoes of the World (v. 5.4.0; 7 Aug 2026). Distributed by Smithsonian Institution, compiled by Venzke, E. https://doi.org/10.5479/si.GVP.VOTW5-2026.5.4. Used for non-commercial purposes under the Smithsonian Terms of Use (https://www.si.edu/termsofuse). Status: <provider name>, <native label>, data downloaded <fetchedAt> (<licence>).

### 4.3 Wikipedia and Wikimedia images

How the app sources them: `src/inspector.js` `_loadWikiImage` (around line 838) calls `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=<name> volcano <country>&gsrlimit=1&prop=pageimages|info&piprop=thumbnail&pithumbsize=900...&origin=*` from the visitor's browser and hotlinks `page.thumbnail.source` (an `upload.wikimedia.org` URL). It shows the article title and a link to the article. It does not fetch or show the file's author or licence. `docs/PRIVACY.md` lists `en.wikipedia.org` as the contacted host and says "Feature title in Wikipedia API query". The match is the top full-text search hit (`gsrlimit=1`), so a wrong article or image is possible and unchecked. I did not run test queries for all volcanoes.

Terms read 2026-11-16:

- Commons file reuse (https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia): "Each media file has its licensing specified on its file description page." Some licences "require that the original creator be attributed". Hotlinking "is also possible, but is not recommended."
- Wikimedia Terms of Use (https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use): text is CC BY-SA 4.0 and GFDL, attribution "Through hyperlink (where possible) or URL to the page or pages that you are reusing", modified text must be shared alike, and non-text media "follow their own licenses".
- User-Agent policy (https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy): browser apps "are encouraged to include the `Api-User-Agent` header". The app does not send one (the `fetch` call has no headers); not a blocker, but noted.

What this means for static pages:

| Use | Verdict |
| --- | --- |
| Embedding or hotlinking the Wikipedia lead image in a static page | No. The file's licence, author and any restriction are unknown to the app; the in-map display (a link plus title, per visitor, on demand) is not the same act as publishing the image on indexable pages. A static page would need per-file author and licence, which needs an API call per image at build time and a licence allow-list. Out of scope for the first version. |
| Copying Wikipedia article text | No. CC BY-SA share-alike would pull the page into that licence and the text would duplicate Wikipedia. |
| Linking to the Wikipedia article | Yes. Even that needs a verified title; the search-based match is not good enough to generate a link at build time without review. Use Wikidata or the GVP-listed link only if a verified mapping exists. I did not look for one. |

## 5. Options

Effort: S = a day or two, M = about a week, L = several weeks. These are my estimates, not measured.

| | (a) Basic SEO only | (b) One richer static page | (c) Generated per-volcano pages | (d) Prerender the map app |
| --- | --- | --- | --- | --- |
| Effort | none beyond others' work | S | M for a pilot subset, L for all plus ops | L, ongoing |
| SEO upside | brand queries only | brand and "what is Open Earth" queries; credibility for provenance | long-tail volcano-name queries, if indexed | none that (b) does not give, since content is canvas |
| Risk | low | low | thin or duplicate content; stale status; licence handling; deploy gap | breaks static simplicity; hydration bugs |
| Ongoing cost | none | edit when sources change | generator, tests, sitemap, slug stability, monitoring | high |
| Fit with principles | yes | yes | yes only with conditions below | poor |

### (a) Do nothing beyond basic SEO

Google renders JavaScript and indexes rendered HTML ("Google also uses the rendered HTML to index the page", https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics, 2026-11-16), but the rendered HTML here is controls and a canvas. The only indexable text is the sidebar labels and the About modal. Nothing to match a volcano query. Choose (a) if the owner values the map as a tool over discovery.

### (b) A single static "Sources and method" page

A real HTML file (for example `/about/` or `/data/`), not a modal, containing: what Open Earth is, the REFERENCE/OBSERVED/DERIVED model, each provider with scale, coverage count, freshness semantics, licence and attribution (the table in 4.2, once PVMBG is settled), the "observation is not causation" statement, the VOTW citation, and a link to the map. Content comes from `docs/DATA-SOURCES.md`, which is already written in that tone. Hand-written, no generator. This also closes a documentation gap: `grep -i "licen\|terms"` over `src/modals.js` finds only the MIT link, and `docs/DATA-SOURCES.md` records terms only for IMO and some deferred providers, not for GVP, USGS, JMA, PVMBG or GeoNet. Recommended.

### (c) Generated static pages

Subsets (counts from section 3):

| Subset | Pages | Observed content | Comment |
| --- | --- | --- | --- |
| All catalog volcanoes | 1,214 | 16 percent | Highest thin-content and doorway risk |
| Regional status or weekly report | 195 | 100 percent | Best story, smallest. Status cannot be baked in, so observed value is only in the hydrated block |
| Above plus last eruption in 2000 or later | 337 | 58 percent | Reasonable pilot ceiling |
| Pilot | 40 to 60 hand-chosen | | Chosen by the owner from the 195, spread across the five providers |

URL scheme: `/volcano/<gvp-number>-<slug>/`. Facts: 1,214 unique numbers; slugs collide for 4 names (`sumbing`, `flores`, `san-cristobal`, `azul-cerro`), the number prefix resolves that; 23 names contain non-ASCII characters (for example "Kermadec Arc at 24.8°S") and need transliteration. The number is the identity (the map already resolves `?v=volcano:<VolcanoNumber>` via `findVolcano` in `src/data.js`). A GVP rename would change the slug and break links, so the generator should keep slugs in a small committed registry file and redirect, or serve any slug for a known number. Needs an owner-side Caddy rule if redirects are used.

Per-page contents (reference only): H1 name and country, facts table with source label per row, `Remarks` quoted and attributed, eruption table, "Monitored by" provider line with the native scale named, the VOTW citation, a plain `<a href>` "Open on the map" to `/?v=volcano:<number>` (works today: `tests/state.test.js` pins the `v=volcano:332010` format, and `src/app.js` `restoreSelectedFeature` handles it), and a link to the GVP volcano page.

Canonical and linking: each page canonicalises to itself. The map deep links (`/?v=...`) are canonicalised to `/` by the basic-SEO work; confirm that decision with that agent before shipping, because it determines whether the map URLs compete with the pages. Crawlable links: Google "can only discover your links if they are `<a>` HTML elements with an `href` attribute" (same JS SEO doc), so add a `/volcano/` index page grouping by country, linked from the About page and the sitemap.

Structured data: schema.org/Volcano exists, with `geo`, `containedInPlace`, `sameAs` inherited from Place and Thing. Google's structured data gallery (https://developers.google.com/search/docs/appearance/structured-data/search-gallery, 2026-11-16) lists Article, Breadcrumb and Dataset among its features and does not list Place or Landform. So `Volcano` markup gives no rich-result eligibility that I can show. Recommendation: BreadcrumbList (supported) and an optional minimal `Volcano` object with `name`, `geo`, `sameAs` = the GVP URL, as machine-readable context only, with no promise of any search feature. Do not use `Dataset` per page: Google's Dataset page (https://developers.google.com/search/docs/appearance/structured-data/dataset, 2026-11-16) is about describing a dataset's metadata and recommends the markup on the canonical landing page of a dataset, not on pages about places. Put a `Dataset` description on the About page at most. Do not put alert levels in JSON-LD.

Sitemap: one entry per page is about 100 KB for 1,214 URLs (estimate). Google's limit is "50MB (uncompressed) or 50,000 URLs" per file, so one `sitemap.xml` suffices; no index needed (https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap, 2026-11-16). Google ignores `priority` and `changefreq` and uses `lastmod` only "if it's consistently and verifiably" accurate. Set `lastmod` from the catalog snapshot for reference pages, or omit it. Do not stamp the build date on every page.

Page weight and Core Web Vitals: estimate 4 KB median, 22 KB max, about 6 MB for all 1,214 (computed with an assumed template overhead of 2.8 KB and 90 bytes per eruption row; the template is not built, so treat as order of magnitude). Server-rendered text with a small stylesheet and no map library should be well inside good LCP and CLS territory. Not measured, because nothing exists. The map link, not an embedded map, keeps it that way: embedding MapLibre in each page would make the static pages as heavy as the app.

Accessibility and mobile: plain semantic HTML (heading hierarchy, `<table>` with `<caption>` and `scope`, `lang="en"`, visible focus, system font stack), a single-column layout with the same 16 px gutters and touch-size links as the P1.75 mobile pass. Colour is never the only carrier of status. Provider names in other languages (`nameJp`) get `lang` attributes.

Privacy: none expected, and I checked what applies. Static pages make no third-party requests if they use no CDN, no Wikipedia call and no map. The one decision is analytics: `src/analytics.js` is not on these pages unless added, and `docs/PRIVACY.md` says it sends the full page URL. If the tracker is added to generated pages, it sends only the static path (no map state), and `docs/PRIVACY.md` must say so. Simplest honest default: no tracker on static pages, rely on Search Console and server logs, which also keeps the page count out of the product analytics. This is a recommendation, not something I verified in a browser.

Freshness of alert status: see 6.4.

Build and deploy: see 6.1 to 6.3.

### (d) Prerender the map app

Reject. The visible content is a WebGL canvas, so a prerendered DOM would be the sidebar and a loading state. It would add a headless-browser build step (the opposite of "boring and static"), would fight the roadmap's P1.9 framework evaluation, and would be rewritten if that evaluation chose a framework. If any prerendering is ever wanted, it belongs after P1.9, not before.

## 6. Design for the pilot (only if stage 2 is approved)

### 6.1 Generator

`scripts/build_volcano_pages.py`, stdlib only, same style as `scripts/update_*.py` (the existing scripts import only the standard library; see `scripts/update_data.py` header). Input: `data/*.json`. Output: a directory ignored by git (`dist/` is already in `.gitignore`). Deterministic: sorted by volcano number, no timestamps in HTML, no randomness, escaped output, stable slugs from a registry. A test in `tests/` renders a fixed fixture (one volcano with regional status, one without images, one with a duplicate slug) and compares bytes, which fits the existing `pytest tests/` job in `ci.yml`.

### 6.2 Where it runs

| Option | Pros | Cons |
| --- | --- | --- |
| In `update-data.yml`, commit pages to `main` | Same pipeline as snapshots | About 6 MB of pages added to `main` at first; if HTML embeds nothing daily-varying, later diffs are small, but every GVP release touches many pages. The git pack is already 43 MB (`git count-objects -vH`) with 88 commits touching `data/`. Not needed. |
| In CI (`ci.yml`) as a build check only | Validates the generator on every PR, nothing committed | Does not deploy |
| At deploy time on the owner's side | Pages always match the deployed `data/` | Needs a deploy script; depends on open question 1 |

Recommendation: generate at deploy, run the generator in CI as a check, do not commit output. If the owner's deploy is "copy the repo checkout", a post-checkout `python3 scripts/build_volcano_pages.py` step is one line.

### 6.3 Deploy contract

The repo cannot answer who builds and deploys. Whatever the answer, the contract should be: deploy publishes `index.html`, `src/`, `vendor/`, `data/` and the generated `volcano/` directory, plus `sitemap.xml`, from the same commit, and `data/` is refreshed at least as often as the bot commits it. That makes pages, sitemap and map data consistent. The roadmap already plans a sanitised infrastructure reference; this contract belongs there.

### 6.4 Alert status in static HTML

Three ways, ordered by how much they risk:

1. Bake level and age into the HTML. Honest only if the age is visible and the deploy runs daily. Search snippets can show stale levels for weeks. Not recommended for anything safety-adjacent.
2. Omit status from the HTML entirely. Honest and boring, but gives up the "current status" query.
3. Recommended: reference-only static HTML ("monitored by <provider>, scale <name>, link to the authority") plus a progressive-enhancement block. A small ES module on the page fetches the same-origin `data/<provider>-status.json`, finds the volcano by number, and renders the provider's own `label` and `nativeStatus`, `observedAt` where present and the snapshot age. No script, no status (a clear sentence says so). The level never enters `<title>`, meta description or JSON-LD.

Consequences of option 3: the generated HTML is stable across days (small diffs, cacheable, byte-reproducible); status honesty rests on the snapshot, whose age is shown; if the data files on the server are old the page shows the old age. Note on age: an old `observedAt` is a long-standing unchanged level, not stale data (IMO documents this in `docs/DATA-SOURCES.md`; USGS Akutan shows 2019-09-06 and GeoNet and PVMBG carry no `observedAt` at all), so show `fetchedAt` and `observedAt` as two labelled facts. The hydration code must not reuse numeric levels across providers or colour-map them to one scale. The snapshots carry `label` and `nativeStatus`, so the module does not need `src/providers.js` normalisation.

## 7. Staged plan

| Stage | What | Gate to move on |
| --- | --- | --- |
| 0 | Basic on-page SEO (others). Owner answers open questions 1 to 4. | Production serves current `data/` and has `robots.txt` and `sitemap.xml`. |
| 1 | Option (b): hand-written `/about/` (or `/data/`) with the provider table, citations and the three-tier model. Register the site in Search Console and Bing Webmaster Tools. Fix GeoNet naming and record the VOTW version in `data/manifest.json`. | 8 to 12 weeks of impressions for brand and source queries; no Search Console coverage problems. |
| 2 | Pilot of 40 to 60 reference-only pages from the 195 monitored volcanoes, option 3 hydration, own sitemap. Generator, tests and the CI check. | After 8 to 12 weeks: are pilot URLs indexed (not "Crawled, currently not indexed" or "Duplicate"), do they get impressions for volcano name queries. |
| 3 | Widen to 337, then consider all 1,214. | Pilot indexed and earning impressions; a manual review of 10 pages found nothing misleading; stage 3 does not collide with P1.75 and P1.9 work. |

What to measure (all in Search Console, no new tracking): indexed versus submitted URLs for the pilot sitemap, impressions and clicks for queries containing a pilot volcano name, queries that reach `/about/`, and the "Crawled, currently not indexed" count. Compare the volcano-name query list against what Wikipedia, GVP and USGS already rank for; if impressions stay near zero, stop.

Explicit non-goals: no prerendering of the map; no pages for earthquakes, faults, plates or trenches; no Wikipedia text or images in static pages; no GVP photos; no merged or normalised alert scale; no alert levels in title, description, JSON-LD or snippets; no generated prose about causes or hazards; no comparison pages or "best volcanoes" listicles; no hosted service, database or serverless function; no ads; no analytics beyond what `docs/PRIVACY.md` lists; no work that preempts P1.5x, P1.75 or P1.9.

## 8. Realistic expectations

Open Earth is a niche tool competing with the organisations that produce or curate the same facts. For a query like "Krakatau volcano status", the results are going to be dominated by USGS, the Smithsonian GVP, Wikipedia, the national agencies and news. A new domain with GVP-derived text has no obvious reason to outrank the source it quotes, and Google may treat it as a duplicate of GVP. What is plausible: brand queries ("open earth volcano map"), queries describing the function ("volcano alert levels by country map"), source-comparison and method questions that the About page can answer, and some long-tail hits where Open Earth's framing adds something (several authorities, native scales, explicit age). The main value of stage 1 is trust and findability of the project itself. The pilot is an experiment with a stop condition, not a growth plan. I have no traffic data for the site and I give no forecast numbers.

## 9. Open questions only the owner can answer

1. Who builds and deploys production, how often, and from what? The live `data/` is 71 days older than `main` and the IMO snapshot is missing. Until this is fixed the map itself shows old status.
2. Is Open Earth strictly non-commercial? The GVP terms forbid commercial use, and the footer has a Ko-fi "Support" link (`index.html`). Whether donations count is a legal judgement I will not make. If the answer is uncertain, ask GVP in writing before stage 2.
3. PVMBG terms: any contact at PVMBG or a documented policy? Until then, no level text from PVMBG on static pages.
4. Is the site registered in Search Console, and is there any existing baseline for impressions?
5. Should `docs/DATA-SOURCES.md` get the licence table from section 4.2, the real counts from the snapshots and the GeoNet licence correction? I left them untouched, so those docs are stale: they still say about 1,350 volcanoes and 127, 111 and 68 for PVMBG, JMA and USGS.
6. Are redirects allowed on the server (Caddy rules) if a slug ever changes, or must slugs be frozen forever?
7. Which language(s)? English only is assumed. German or Indonesian pages would multiply content and compliance work and are not proposed.
8. Does the owner want an imprint link and privacy statement on static pages? For Germany and the EU the app already has an Impressum modal (`index.html` footer); static pages would need the same links as real pages. I did not run the `website-compliance` checks.

## 10. What I could not verify

- Production deploy mechanism (no access, nothing in the repo).
- USGS HANS API specific terms (page returned 403), PVMBG terms (none found), the Smithsonian Terms of Use legal text beyond the GVP page and what was returned for www.si.edu/termsofuse.
- Whether GVP's "non-commercial" scope covers a site with a donation link.
- Wikipedia match quality for all volcanoes; per-image licences.
- Real Core Web Vitals, Search Console data, current rankings, and how Google would treat generated pages from this data. Page size figures are estimates from a throwaway script, not built pages.
- Whether canonicalising `/?v=...` to `/` is what the basic-SEO work chose.
- Why the JMA and PVMBG snapshot counts are far below the numbers in the docs.
