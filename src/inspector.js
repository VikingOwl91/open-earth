/**
 * Open Earth - Unified Feature Inspector
 * Renders consistent, source-aware inspectors for:
 * - Volcanoes (GVP catalog, weekly reports, regional observatory alerts, eruption history)
 * - Earthquakes (USGS live feed and historical catalog queries)
 * - Undersea Trenches (GEBCO Undersea Feature Names Gazetteer)
 * - Active Faults (GEM Global Active Faults)
 * - Plate Boundaries (PB2002 step kinematics & relative velocity)
 */
(() => {
  'use strict';

  const imageCache = new Map();

  class InspectorController {
    constructor(panelEl, bodyEl, stateManager, dataStore, mapController) {
      this.panel = panelEl;
      this.body = bodyEl;
      this.stateManager = stateManager;
      this.dataStore = dataStore;
      this.mapController = mapController;

      this.currentLayer = null;
      this.currentFeature = null;
      this.activeTab = 'overview';
      this.navStack = [];
      this.expandedReports = new Set(); // Track expanded report keys

      this._bindEvents();
    }

    _bindEvents() {
      const closeBtn = document.querySelector('#details-close');
      if (closeBtn) {
        closeBtn.onclick = () => this.close();
      }
    }

    close() {
      this.panel.classList.remove('open');
      this.panel.hidden = true;
      this.currentLayer = null;
      this.currentFeature = null;
      this.navStack = [];
      if (this.mapController) {
        this.mapController.clearSelection();
      }
    }

    pushNav(layer, feature) {
      if (!this.currentFeature) return;
      const top = this.navStack[this.navStack.length - 1];
      if (top && top.layer === this.currentLayer && top.feature === this.currentFeature) return;
      if (this.navStack.length >= 20) this.navStack.shift();
      this.navStack.push({ layer: this.currentLayer, feature: this.currentFeature, tab: this.activeTab });
    }

    popNav() {
      const prev = this.navStack.pop();
      if (!prev) return;
      this.inspect(prev.layer, prev.feature, prev.tab, false);
    }

    inspect(layer, feature, tab = 'overview', pushToStack = true) {
      if (!feature) return;

      if (pushToStack && this.currentFeature && (this.currentFeature !== feature || this.currentLayer !== layer)) {
        this.pushNav(this.currentLayer, this.currentFeature);
      }

      this.currentLayer = layer;
      this.currentFeature = feature;
      this.activeTab = tab;

      if (this.mapController) {
        this.mapController.selectFeature(layer, feature);
      }

      this.render();
      this.panel.hidden = false;
      // Slight tick to ensure transition works smoothly
      requestAnimationFrame(() => this.panel.classList.add('open'));
    }

    render() {
      const layer = this.currentLayer;
      const feature = this.currentFeature;
      const tab = this.activeTab;
      if (!feature) return;

      const esc = window.OpenEarth?.geo?.esc || (s => s);
      const val = window.OpenEarth?.geo?.value || ((...xs) => xs[0]);

      let eyebrow = '';
      let title = '';
      let icon = '';
      let badgesHtml = '';
      let tabsList = [['overview', 'Overview'], ['nearby', 'Nearby'], ['sources', 'Sources']];
      let contentHtml = '';

      if (layer === 'volcanoes' || layer === 'activity') {
        const p = feature.properties || {};
        const cat = this.dataStore.findVolcano(p.Volcano_Number || p.volcano_name || p.Volcano_Name);
        const props = { ...(cat?.properties || {}), ...p };
        const coords = (cat?.geometry || feature.geometry)?.coordinates || [];
        const vnum = props.Volcano_Number || props.volcano_number || '';
        const name = val(props.Volcano_Name, props.VolcanoName, props.Report_Name, 'Volcano');
        const report = this.dataStore.findReportForVolcano(props);
        const regional = window.OpenEarth?.providers?.regionalMonitoringForVolcano?.(props) || [];

        eyebrow = `Volcano${vnum ? ` · GVP ${esc(vnum)}` : ''}`;
        icon = '<span class="feature-icon volcano-icon" aria-hidden="true">▲</span>';
        title = esc(name);

        if (report) {
          badgesHtml += '<em class="badge badge-activity">ACTIVE · WEEKLY REPORT</em>';
        }
        for (const r of regional) {
          const sev = (r.severity || 'normal').toLowerCase();
          badgesHtml += `<em class="badge regional-badge severity-${esc(sev)}">${esc(r.label.toUpperCase())}</em>`;
        }

        tabsList = [['overview', 'Overview'], ['history', 'History'], ['nearby', 'Nearby'], ['sources', 'Sources']];

        if (tab === 'history') {
          contentHtml = this._renderVolcanoHistory(props, vnum);
        } else if (tab === 'nearby') {
          contentHtml = this._renderNearby(coords);
        } else if (tab === 'sources') {
          contentHtml = this._renderVolcanoSources(props, report, regional);
        } else {
          contentHtml = this._renderVolcanoOverview(props, coords, report, regional);
        }
      } else if (layer === 'earthquakes') {
        const p = feature.properties || {};
        const coords = feature.geometry?.coordinates || [];
        const isHistorical = this.dataStore.historicalMode;

        eyebrow = isHistorical ? 'Historical earthquake · USGS' : 'Live earthquake · USGS';
        icon = '<span class="feature-icon quake-icon" aria-hidden="true">●</span>';
        title = `M ${esc(val(p.mag, '?'))} · ${esc(val(p.place, 'Earthquake'))}`;

        if (p.mag >= 6.0) {
          badgesHtml += '<em class="badge badge-warning">MAJOR EVENT</em>';
        }

        if (tab === 'nearby') {
          contentHtml = coords.length >= 2 ? this._renderNearby(coords) : '<p class="note">No coordinates available.</p>';
        } else if (tab === 'sources') {
          contentHtml = this._renderQuakeSources(p);
        } else {
          contentHtml = this._renderQuakeOverview(p, coords);
        }
      } else if (layer === 'trenches') {
        const p = feature.properties || {};
        const coords = window.OpenEarth?.geo?.centerOfGeometry(feature.geometry);
        const name = p.Name || 'Undersea Trench';

        eyebrow = 'Seafloor · GEBCO Gazetteer';
        icon = '<span class="feature-icon trench-icon" aria-hidden="true">⌄</span>';
        title = `${esc(name)} Trench`;

        if (tab === 'nearby') {
          contentHtml = coords ? this._renderNearby(coords) : '<p class="note">No coordinates available.</p>';
        } else if (tab === 'sources') {
          contentHtml = this._renderTrenchSources();
        } else {
          contentHtml = this._renderTrenchOverview(p, coords);
        }
      } else if (layer === 'faults') {
        const p = feature.properties || {};
        const coords = window.OpenEarth?.geo?.centerOfGeometry(feature.geometry);
        const name = val(p.name, p.Name, p.fault_name, p.catalog_id, 'Active fault');

        eyebrow = 'Active fault · GEM';
        icon = '<span class="feature-icon fault-icon" aria-hidden="true">╱</span>';
        title = esc(name);

        if (tab === 'nearby') {
          contentHtml = coords ? this._renderNearby(coords) : '<p class="note">No coordinates available.</p>';
        } else if (tab === 'sources') {
          contentHtml = this._renderFaultSources();
        } else {
          contentHtml = this._renderFaultOverview(p, coords);
        }
      } else if (layer === 'plates') {
        const p = feature.properties || {};
        const code = val(p.Boundary_Code, p.STEPCLASS);
        const meta = window.OpenEarth?.geo?.STEP_META?.[code] || { label: 'Plate boundary', family: 'other' };
        const coords = window.OpenEarth?.geo?.centerOfGeometry(feature.geometry);

        eyebrow = `Plate tectonics · ${esc(code || 'PB2002')}`;
        icon = '<span class="feature-icon plate-icon" aria-hidden="true">━</span>';
        title = esc(val(p.Boundary_Label, meta.label));

        if (tab === 'nearby') {
          contentHtml = coords ? this._renderNearby(coords) : '<p class="note">No coordinates available.</p>';
        } else if (tab === 'sources') {
          contentHtml = this._renderPlateSources();
        } else {
          contentHtml = this._renderPlateOverview(p, coords, meta);
        }
      }

      // Render the complete inspector shell
      const hasBack = this.navStack.length > 0;
      const backHtml = hasBack
        ? '<button class="drawer-back-btn" id="inspector-back" type="button" aria-label="Go back to previous feature">← Back</button>'
        : '';

      const shareHtml = '<button class="drawer-share-btn" id="inspector-share" type="button" aria-label="Share this feature" title="Share feature link">⎘ Share</button>';

      const tabsHtml = `
        <nav class="drawer-tabs" role="tablist">
          ${tabsList.map(([id, label]) => `
            <button role="tab" aria-selected="${id === tab}" data-tab="${id}" class="${id === tab ? 'active' : ''}">
              ${label}
            </button>
          `).join('')}
        </nav>
      `;

      this.body.innerHTML = `
        <header class="drawer-head">
          <div class="drawer-head-actions">
            ${backHtml}
            ${shareHtml}
          </div>
          <div class="drawer-eyebrow">${eyebrow}</div>
          <h2 class="drawer-title">
            ${icon}
            <span>${title}</span>
            ${badgesHtml ? `<div class="drawer-badges">${badgesHtml}</div>` : ''}
          </h2>
        </header>
        ${tabsHtml}
        <div class="drawer-content" role="tabpanel">
          ${contentHtml}
        </div>
      `;

      this._wireInspectorEvents();
    }

    _wireInspectorEvents() {
      // Back button
      const backBtn = this.body.querySelector('#inspector-back');
      if (backBtn) {
        backBtn.onclick = () => this.popNav();
      }

      // Share button
      const shareBtn = this.body.querySelector('#inspector-share');
      if (shareBtn) {
        shareBtn.onclick = async () => {
          const res = await this.stateManager.share(`Open Earth · ${this.currentFeature?.properties?.Volcano_Name || this.currentFeature?.properties?.name || 'Feature'}`);
          const originalText = shareBtn.textContent;
          if (res.success) {
            shareBtn.textContent = '✓ Copied!';
            shareBtn.classList.add('copied');
            setTimeout(() => {
              shareBtn.textContent = originalText;
              shareBtn.classList.remove('copied');
            }, 2000);
          }
        };
      }

      // Tab buttons
      this.body.querySelectorAll('[data-tab]').forEach(btn => {
        btn.onclick = () => {
          this.activeTab = btn.dataset.tab;
          this.render();
        };
      });

      // Report expand/collapse buttons (Kilauea fix)
      this.body.querySelectorAll('[data-toggle-report]').forEach(btn => {
        btn.onclick = () => {
          const key = btn.dataset.toggleReport;
          if (this.expandedReports.has(key)) {
            this.expandedReports.delete(key);
          } else {
            this.expandedReports.add(key);
          }
          this.render();
        };
      });

      // Relationship clickable items
      this.body.querySelectorAll('[data-inspect-feature]').forEach(btn => {
        btn.onclick = () => {
          const layer = btn.dataset.inspectLayer;
          const id = btn.dataset.inspectId;
          this._navigateToRelated(layer, id);
        };
      });
    }

    _navigateToRelated(layer, id) {
      let target = null;
      if (layer === 'volcanoes' || layer === 'activity') {
        target = this.dataStore.findVolcano(id);
      } else if (layer === 'trenches') {
        target = this.dataStore.findTrench(id);
      } else if (layer === 'faults') {
        target = this.dataStore.findFault(id);
      } else if (layer === 'plates') {
        target = this.dataStore.findBoundary(id);
      } else if (layer === 'earthquakes') {
        target = this.dataStore.findEarthquake(id);
      }

      if (target) {
        // Pan map toward feature
        const coords = target.geometry?.type === 'Point'
          ? target.geometry.coordinates
          : window.OpenEarth?.geo?.centerOfGeometry(target.geometry);
        if (coords && this.mapController?.map) {
          this.mapController.map.flyTo({ center: [coords[0], coords[1]], zoom: Math.max(6, this.mapController.map.getZoom()) });
        }
        this.inspect(layer, target, 'overview', true);
      }
    }

    /* Sub-renderer: Volcano Overview (with bounded report preview) */
    _renderVolcanoOverview(p, coords, report, regional) {
      const esc = window.OpenEarth?.geo?.esc || (s => s);
      const val = window.OpenEarth?.geo?.value || ((...xs) => xs[0]);
      const fmtDate = window.OpenEarth?.geo?.fmtDate || (s => s);

      const name = val(p.Volcano_Name, p.VolcanoName, p.Report_Name, 'Volcano');
      const country = val(p.Country, p.country);
      const type = val(p.Primary_Volcano_Type, p.PrimaryVolcanoType, p.Volcano_Type);
      const elev = val(p.Elevation_m, p.Elevation);
      const lastErupt = val(p.Last_Known_Eruption, p.LastKnownEruption);
      const tect = val(p.Tectonic_Setting, p.TectonicSetting);

      const plate = coords.length >= 2 ? window.OpenEarth?.geo?.containingPlate(coords, this.dataStore.platePolygons) : null;
      const plateTxt = plate ? window.OpenEarth?.geo?.plateName(plate) : null;

      // 1. POI Hero image (lazy)
      const heroHtml = this._getHeroImageHtml(name, country);

      // 2. Weekly activity report card (Bounded Preview to prevent Kilauea wall of text!)
      let reportCardHtml = '';
      if (report) {
        const rp = report.properties || {};
        const date = fmtDate(val(rp.Report_Published, rp.Report_Date));
        const fullSummary = val(rp.Report_Summary, rp.Summary, '');
        const url = val(rp.Report_URL, window.SOURCES.activity.url);
        const reportKey = `volcano:${val(p.Volcano_Number, name)}`;
        const isExpanded = this.expandedReports.has(reportKey);

        const wordCount = fullSummary.trim() ? fullSummary.trim().split(/\s+/).length : 0;
        const isLongReport = fullSummary.length > 320;

        let displayedSummary = fullSummary;
        let toggleHtml = '';

        if (isLongReport) {
          if (!isExpanded) {
            displayedSummary = fullSummary.slice(0, 300).trim() + '…';
            toggleHtml = `<button class="report-toggle-btn" data-toggle-report="${esc(reportKey)}" type="button">Show full report (${wordCount} words) ↓</button>`;
          } else {
            toggleHtml = `<button class="report-toggle-btn" data-toggle-report="${esc(reportKey)}" type="button">Collapse report ↑</button>`;
          }
        }

        reportCardHtml = `
          <section class="drawer-card activity-card">
            <div class="card-eyebrow">Recent activity · GVP weekly report</div>
            ${date ? `<time class="card-time">${esc(date)}</time>` : ''}
            <div class="report-body ${isExpanded ? 'expanded' : 'collapsed'}">
              <p>${esc(displayedSummary)}</p>
            </div>
            <div class="report-actions">
              ${toggleHtml}
              <a class="external-link" href="${esc(url)}" target="_blank" rel="noreferrer">Read on Smithsonian GVP ↗</a>
            </div>
            <p class="semantic-note">The GVP Weekly Volcanic Activity Report highlights active unrest; it is not an official hazard advisory.</p>
          </section>
        `;
      }

      // 3. Regional observatory status cards
      let regionalCardsHtml = '';
      for (const r of regional) {
        const sev = (r.severity || 'normal').toLowerCase();
        regionalCardsHtml += `
          <section class="drawer-card regional-card severity-${esc(sev)}">
            <div class="card-header-row">
              <span class="card-eyebrow">Regional status · ${esc(r.providerName)}</span>
              ${r.snapshotAge ? `<span class="card-age">${esc(r.snapshotAge)}</span>` : ''}
            </div>
            <div class="regional-status-badge severity-${esc(sev)}">${esc(r.label)}</div>
            ${r.note ? `<p class="regional-note">${esc(r.note)}</p>` : ''}
            ${r.reportUrl ? `<div class="card-actions"><a class="external-link" href="${esc(r.reportUrl)}" target="_blank" rel="noreferrer">Official agency notice ↗</a></div>` : ''}
          </section>
        `;
      }

      // 4. Basic information facts
      const coordStr = coords.length >= 2 ? `${coords[1].toFixed(3)}, ${coords[0].toFixed(3)}` : null;
      const locStr = [country, coordStr].filter(Boolean).join(' · ');

      const factsHtml = `
        <section class="drawer-section">
          <div class="section-heading">Basic Information</div>
          <div class="fact-list">
            ${this._factRow('Location', locStr)}
            ${this._factRow('Type', type)}
            ${this._factRow('Elevation', elev != null ? `${elev} m` : null)}
            ${this._factRow('Last known eruption', lastErupt)}
            ${this._factRow('Tectonic setting', tect)}
            ${this._factRow('PB2002 Plate', plateTxt)}
          </div>
        </section>
      `;

      return `${heroHtml}${reportCardHtml}${regionalCardsHtml}${factsHtml}`;
    }

    _renderVolcanoHistory(p, vnum) {
      const esc = window.OpenEarth?.geo?.esc || (s => s);
      const val = window.OpenEarth?.geo?.value || ((...xs) => xs[0]);
      const eruptions = this.dataStore.findEruptionsForVolcano(p);
      const historyUrl = vnum
        ? `https://volcano.si.edu/volcano.cfm?vn=${encodeURIComponent(vnum)}&vtab=Eruptions`
        : 'https://volcano.si.edu/search_eruption.cfm';

      if (!eruptions.length) {
        return `
          <section class="drawer-section">
            <div class="section-heading">Eruption History</div>
            <p class="note">No GVP catalog eruptions recorded for this volcano.</p>
            <a class="external-link" href="${esc(historyUrl)}" target="_blank" rel="noreferrer">Search Smithsonian GVP ↗</a>
          </section>
        `;
      }

      const rows = eruptions.slice(0, 15).map(e => {
        const ep = e.properties || {};
        const year = val(ep.Start_Year, ep.StartYear, ep.start_year);
        const category = val(ep.Eruption_Category, ep.Activity_Type, 'Confirmed Eruption');
        const vei = val(ep.VEI, ep.ExplosivityIndexMax, ep.vei);
        const eNum = val(ep.Eruption_Number, ep.EruptionNumber);
        const eventUrl = eNum ? `${historyUrl}#event-${encodeURIComponent(eNum)}` : historyUrl;

        return `
          <a class="timeline-row" href="${esc(eventUrl)}" target="_blank" rel="noreferrer">
            <time class="timeline-time">${year ? esc(year) : 'Date uncertain'}</time>
            ${vei !== null && vei !== '' ? `<span class="timeline-vei">VEI ${esc(vei)}</span>` : ''}
            <span class="timeline-category">${esc(category)}</span>
            <span class="timeline-arrow">↗</span>
          </a>
        `;
      }).join('');

      return `
        <section class="drawer-section">
          <div class="section-heading">Eruption History · Smithsonian GVP</div>
          <div class="timeline-list">${rows}</div>
          ${eruptions.length > 15 ? `<p class="semantic-note">Showing the 15 most recent of ${eruptions.length.toLocaleString()} catalog eruption records.</p>` : ''}
          <div class="drawer-link-bar">
            <a class="external-link" href="${esc(historyUrl)}" target="_blank" rel="noreferrer">View full eruption history on GVP ↗</a>
          </div>
          <p class="semantic-note">Dates and VEI values are catalog facts from the Smithsonian Global Volcanism Program and may be approximate.</p>
        </section>
      `;
    }

    _renderVolcanoSources(p, report, regional) {
      const esc = window.OpenEarth?.geo?.esc || (s => s);
      const age = this.dataStore.snapshotAge();

      let regionalSourcesHtml = '';
      for (const r of regional) {
        regionalSourcesHtml += `
          <div class="source-item">
            <strong>${esc(r.providerName)}</strong>
            <p><a href="${esc(r.sourceUrl)}" target="_blank" rel="noreferrer">Agency Portal ↗</a></p>
            ${r.snapshotAge ? `<span class="source-age">Snapshot: ${esc(r.snapshotAge)}</span>` : ''}
            <p class="semantic-note">${esc(r.provenance)}</p>
          </div>
        `;
      }

      return `
        <section class="drawer-section">
          <div class="section-heading">Authoritative Sources</div>
          <div class="source-list">
            <div class="source-item">
              <strong>Smithsonian Global Volcanism Program · VOTW 5.4.0</strong>
              <p><a href="${window.SOURCES.volcanoes.url}" target="_blank" rel="noreferrer">volcano.si.edu ↗</a></p>
              ${age ? `<span class="source-age">Catalog snapshot: ${esc(age)}</span>` : ''}
              <p class="semantic-note">Reference catalog of Holocene volcanoes. A catalog entry does not represent active unrest.</p>
            </div>
            ${report ? `
              <div class="source-item">
                <strong>Smithsonian / USGS Weekly Volcanic Activity Report</strong>
                <p><a href="${window.SOURCES.activity.url}" target="_blank" rel="noreferrer">Weekly Reports ↗</a></p>
                <p class="semantic-note">Weekly bulletin summarizing ongoing volcanic unrest and notable activity.</p>
              </div>
            ` : ''}
            ${regionalSourcesHtml}
          </div>
        </section>
      `;
    }

    _renderNearby(coords) {
      const esc = window.OpenEarth?.geo?.esc || (s => s);
      const boundary = window.OpenEarth?.geo?.boundaryContext(coords, this.dataStore.plateSteps);
      const plate = window.OpenEarth?.geo?.containingPlate(coords, this.dataStore.platePolygons);
      const plateName = plate ? window.OpenEarth?.geo?.plateName(plate) : 'Unknown';
      const trenchHit = window.OpenEarth?.geo?.nearestLine(coords, this.dataStore.trenches);
      const faultHit = this.dataStore.faults.features.length ? window.OpenEarth?.geo?.nearestLine(coords, this.dataStore.faults) : null;
      const quakes = window.OpenEarth?.geo?.nearbyQuakes(coords, this.dataStore.earthquakes, 250);
      const strongest = quakes[0];

      return `
        <div class="provenance-tier-group">
          <!-- Tier 1: REFERENCE -->
          <div class="tier-card tier-reference">
            <span class="tier-badge">REFERENCE · CATALOG FACTS</span>
            <div class="fact-list">
              ${this._factRow('Containing Plate', plate ? esc(plateName) : 'Unknown')}
              ${boundary ? this._factRow('Tectonic Boundary Class', esc(boundary.label)) : ''}
            </div>
          </div>

          <!-- Tier 2: OBSERVED -->
          <div class="tier-card tier-observed">
            <span class="tier-badge">OBSERVED · SEISMICITY & ACTIVITY</span>
            <div class="fact-list">
              ${this._factRow('Earthquakes (250 km)', `${quakes.length} events`)}
              ${strongest ? this._factRowHtml('Strongest Nearby Quake', `<button class="inline-nav-btn" data-inspect-feature="true" data-inspect-layer="earthquakes" data-inspect-id="${esc(strongest.id)}" type="button">M ${strongest.properties?.mag} · ${Math.round(strongest._distance)} km away →</button>`) : ''}
            </div>
          </div>

          <!-- Tier 3: DERIVED -->
          <div class="tier-card tier-derived">
            <span class="tier-badge">DERIVED · SPATIAL PROXIMITY</span>
            <div class="fact-list">
              ${boundary ? this._factRowHtml('Nearest Plate Boundary', `<button class="inline-nav-btn" data-inspect-feature="true" data-inspect-layer="plates" data-inspect-id="${esc(boundary.feature.properties?.SEQNUM != null ? Math.round(boundary.feature.properties.SEQNUM) : boundary.code)}" type="button">${esc(boundary.label)} · ${Math.round(boundary.distance)} km →</button>`) : ''}
              ${trenchHit ? this._factRowHtml('Nearest Trench', `<button class="inline-nav-btn" data-inspect-feature="true" data-inspect-layer="trenches" data-inspect-id="${esc(trenchHit.feature.properties?.Name)}" type="button">${esc(trenchHit.feature.properties?.Name)} Trench · ${Math.round(trenchHit.distance)} km →</button>`) : ''}
              ${faultHit ? this._factRowHtml('Nearest Active Fault', `<button class="inline-nav-btn" data-inspect-feature="true" data-inspect-layer="faults" data-inspect-id="${esc(faultHit.feature.properties?.catalog_id || faultHit.feature.properties?.name)}" type="button">${esc(faultHit.feature.properties?.name || 'Fault')} · ${Math.round(faultHit.distance)} km →</button>`) : ''}
            </div>
            <p class="analytical-disclaimer">Spatial proximity is an analytical calculation, not evidence of direct geological causation.</p>
          </div>
        </div>
      `;
    }

    _renderQuakeOverview(p, coords) {
      const esc = window.OpenEarth?.geo?.esc || (s => s);
      const val = window.OpenEarth?.geo?.value || ((...xs) => xs[0]);
      const depth = coords[2] != null ? `${Number(coords[2]).toFixed(1)} km` : 'Unknown';
      const timeStr = p.time ? new Date(Number(p.time)).toLocaleString() : 'Unknown';
      const coordStr = coords.length >= 2 ? `${(+coords[1]).toFixed(3)}, ${(+coords[0]).toFixed(3)}` : null;

      return `
        <section class="drawer-section">
          <div class="section-heading">Event Details</div>
          <div class="fact-list">
            ${this._factRow('Time', timeStr)}
            ${this._factRow('Magnitude', `M ${val(p.mag, '?')}`)}
            ${this._factRow('Depth', depth)}
            ${this._factRow('Coordinates', coordStr)}
            ${this._factRow('Status', val(p.status, p.type))}
          </div>
          ${p.url ? `
            <div class="drawer-link-bar">
              <a class="external-link" href="${esc(p.url)}" target="_blank" rel="noreferrer">View USGS Event Page ↗</a>
            </div>
          ` : ''}
        </section>
      `;
    }

    _renderQuakeSources(p) {
      const esc = window.OpenEarth?.geo?.esc || (s => s);
      return `
        <section class="drawer-section">
          <div class="section-heading">Authoritative Sources</div>
          <div class="source-list">
            <div class="source-item">
              <strong>USGS Earthquake Hazards Program</strong>
              <p><a href="${window.SOURCES.earthquakes.url}" target="_blank" rel="noreferrer">earthquake.usgs.gov ↗</a></p>
              <p class="semantic-note">Near-real-time seismic monitoring data provided as public domain scientific records by the United States Geological Survey.</p>
            </div>
            ${p.url ? `
              <div class="source-item">
                <a class="external-link" href="${esc(p.url)}" target="_blank" rel="noreferrer">Official USGS Event Bulletin ↗</a>
              </div>
            ` : ''}
          </div>
        </section>
      `;
    }

    _renderTrenchOverview(p, coords) {
      const esc = window.OpenEarth?.geo?.esc || (s => s);
      const coordStr = coords ? `${coords[1].toFixed(3)}, ${coords[0].toFixed(3)}` : null;
      const plate = coords ? window.OpenEarth?.geo?.containingPlate(coords, this.dataStore.platePolygons) : null;
      const plateName = plate ? window.OpenEarth?.geo?.plateName(plate) : null;
      const boundary = coords ? window.OpenEarth?.geo?.boundaryContext(coords, this.dataStore.plateSteps) : null;

      return `
        <section class="drawer-section">
          <div class="section-heading">Undersea Feature</div>
          <div class="fact-list">
            ${this._factRow('Feature Type', 'Trench / Deep Ocean Valley')}
            ${this._factRow('Approx. Center', coordStr)}
            ${this._factRow('PB2002 Plate', plateName)}
            ${boundary ? this._factRowHtml('Nearest Plate Boundary', `<button class="inline-nav-btn" data-inspect-feature="true" data-inspect-layer="plates" data-inspect-id="${esc(boundary.feature.properties?.SEQNUM != null ? Math.round(boundary.feature.properties.SEQNUM) : boundary.code)}" type="button">${esc(boundary.label)} · ${Math.round(boundary.distance)} km →</button>`) : ''}
          </div>
        </section>
        <section class="drawer-card">
          <div class="card-eyebrow">Geological Context</div>
          <p class="semantic-note">Undersea feature name and mapped line geometry from the IHO-IOC GEBCO Gazetteer of Undersea Feature Names. Subduction interpretation is derived independently from PB2002.</p>
        </section>
      `;
    }

    _renderTrenchSources() {
      const age = this.dataStore.snapshotAge();
      return `
        <section class="drawer-section">
          <div class="section-heading">Authoritative Sources</div>
          <div class="source-list">
            <div class="source-item">
              <strong>IHO-IOC GEBCO Gazetteer of Undersea Feature Names</strong>
              <p><a href="${window.SOURCES.trenches.url}" target="_blank" rel="noreferrer">gebco.net/undersea-feature-names ↗</a></p>
              ${age ? `<span class="source-age">Snapshot: ${age}</span>` : ''}
              <p class="semantic-note">Official internationally recognized undersea feature names maintained by the Sub-Committee on Undersea Feature Names (SCUFN).</p>
            </div>
          </div>
        </section>
      `;
    }

    _renderFaultOverview(p, coords) {
      const esc = window.OpenEarth?.geo?.esc || (s => s);
      const val = window.OpenEarth?.geo?.value || ((...xs) => xs[0]);
      const nearBound = coords ? window.OpenEarth?.geo?.boundaryContext(coords, this.dataStore.plateSteps) : null;

      return `
        <section class="drawer-section">
          <div class="section-heading">Fault Characteristics</div>
          <div class="fact-list">
            ${this._factRow('Slip Type', val(p.slip_type, p.slip_type_text, p.sense, 'Not specified'))}
            ${this._factRow('Dip Direction', val(p.dip_dir, p.dip_direction))}
            ${this._factRow('Net Slip Rate', val(p.net_slip_rate, p.slip_rate))}
            ${nearBound ? this._factRowHtml('Nearest Plate Boundary', `<button class="inline-nav-btn" data-inspect-feature="true" data-inspect-layer="plates" data-inspect-id="${esc(nearBound.feature.properties?.SEQNUM != null ? Math.round(nearBound.feature.properties.SEQNUM) : nearBound.code)}" type="button">${esc(nearBound.label)} · ${Math.round(nearBound.distance)} km →</button>`) : ''}
          </div>
        </section>
        <section class="drawer-card">
          <div class="card-eyebrow">Geological Context</div>
          <p class="semantic-note">Mapped active fault trace from GEM Global Active Faults database. Kinematic classifications reflect the regional peer-reviewed scientific studies synthesized by GEM.</p>
        </section>
      `;
    }

    _renderFaultSources() {
      const age = this.dataStore.snapshotAge();
      return `
        <section class="drawer-section">
          <div class="section-heading">Authoritative Sources</div>
          <div class="source-list">
            <div class="source-item">
              <strong>GEM Global Active Faults Database</strong>
              <p><a href="${window.SOURCES.faults.url}" target="_blank" rel="noreferrer">GEM Science Tools ↗</a></p>
              ${age ? `<span class="source-age">Snapshot: ${age}</span>` : ''}
              <p class="semantic-note">Global Earth Model database compiled by the GEM Foundation under CC BY-SA 4.0 license.</p>
            </div>
          </div>
        </section>
      `;
    }

    _renderPlateOverview(p, coords, meta) {
      const esc = window.OpenEarth?.geo?.esc || (s => s);
      const val = window.OpenEarth?.geo?.value || ((...xs) => xs[0]);
      const pair = val(p.Plate_Pair, p.PLATEBOUND);
      const length = p.STEPLENGTH != null ? `${Number(p.STEPLENGTH).toFixed(1)} km` : null;
      const vel = p.VELOCITYLE != null ? `${Number(p.VELOCITYLE).toFixed(1)} mm/yr` : null;

      return `
        <section class="drawer-section">
          <div class="section-heading">Boundary Kinematics</div>
          <div class="fact-list">
            ${this._factRow('Boundary Class', meta.family)}
            ${this._factRow('Plate Pair', pair)}
            ${this._factRow('Step Length', length)}
            ${this._factRow('Relative Velocity', vel)}
          </div>
        </section>
        <section class="drawer-card">
          <div class="card-eyebrow">Tectonic Model</div>
          <p class="semantic-note">PB2002 global plate model by Peter Bird (2003). Relative plate velocity and boundary classification are calculated from global geodetic and geological constraints.</p>
        </section>
      `;
    }

    _renderPlateSources() {
      return `
        <section class="drawer-section">
          <div class="section-heading">Authoritative Sources</div>
          <div class="source-list">
            <div class="source-item">
              <strong>PB2002: An Updated Digital Model of Plate Boundaries</strong>
              <p><a href="${window.SOURCES.plates.url}" target="_blank" rel="noreferrer">Peter Bird (2003) · G-Cubed ↗</a></p>
              <p class="semantic-note">Peter Bird, Geochemistry Geophysics Geosystems, 4(3), 1027, doi:10.1029/2001GC000252.</p>
            </div>
          </div>
        </section>
      `;
    }

    _factRow(label, value) {
      if (value == null || String(value).trim() === '') return '';
      const esc = window.OpenEarth?.geo?.esc || (s => s);
      return `
        <div class="fact-row">
          <span class="fact-label">${esc(label)}</span>
          <span class="fact-val">${esc(value)}</span>
        </div>
      `;
    }

    _factRowHtml(label, html) {
      if (html == null || String(html).trim() === '') return '';
      const esc = window.OpenEarth?.geo?.esc || (s => s);
      return `
        <div class="fact-row">
          <span class="fact-label">${esc(label)}</span>
          <span class="fact-val">${html}</span>
        </div>
      `;
    }

    _getHeroImageHtml(name, country) {
      const cacheKey = `${name}:${country || ''}`;
      if (imageCache.has(cacheKey)) {
        const item = imageCache.get(cacheKey);
        if (!item) return '';
        return `
          <div class="poi-hero">
            <a href="${item.url}" target="_blank" rel="noreferrer">
              <img src="${item.src}" alt="${name}" loading="lazy"/>
              <span>${item.title} · Wikipedia ↗</span>
            </a>
          </div>
        `;
      }

      // Asynchronous background load
      this._loadWikiImage(name, country, cacheKey);
      return `<div class="poi-hero loading" data-hero-name="${name}"><div class="poi-image-placeholder">Loading image…</div></div>`;
    }

    async _loadWikiImage(name, country, cacheKey) {
      try {
        const q = encodeURIComponent(`${name} volcano ${country || ''}`);
        const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrlimit=1&prop=pageimages|info&piprop=thumbnail&pithumbsize=900&inprop=url&format=json&origin=*`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        const page = Object.values(d.query?.pages || {})[0];
        if (!page?.thumbnail?.source) {
          imageCache.set(cacheKey, null);
          const el = this.body.querySelector(`[data-hero-name="${name}"]`);
          if (el) el.remove();
          return;
        }

        const data = {
          src: page.thumbnail.source,
          url: page.fullurl || '#',
          title: page.title
        };
        imageCache.set(cacheKey, data);

        const el = this.body.querySelector(`[data-hero-name="${name}"]`);
        if (el) {
          el.outerHTML = `
            <div class="poi-hero">
              <a href="${data.url}" target="_blank" rel="noreferrer">
                <img src="${data.src}" alt="${name}" loading="lazy"/>
                <span>${data.title} · Wikipedia ↗</span>
              </a>
            </div>
          `;
        }
      } catch {
        imageCache.set(cacheKey, null);
        const el = this.body.querySelector(`[data-hero-name="${name}"]`);
        if (el) el.remove();
      }
    }
  }

  const Inspector = {
    InspectorController
  };

  if (typeof window !== 'undefined') {
    window.OpenEarth = window.OpenEarth || {};
    window.OpenEarth.inspectorModule = Inspector;

    // Backward compatibility globals for P1 navigation
    window.detail = (layer, feature) => {
      if (window.OpenEarth.inspector) {
        window.OpenEarth.inspector.inspect(layer, feature, 'overview');
      }
    };
    window.showTectonicDetail = f => window.detail('plates', f);
    window.showTrenchDetail = f => window.detail('trenches', f);
    window.selectFeature = (layer, f) => window.detail(layer, f);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Inspector;
  }
})();
