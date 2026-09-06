/* P1 exploration workflow: richer USGS historical search + navigable relationship cards. */
(() => {
  const details = document.querySelector('#details'),
    historyDetails = document.querySelector('.history-search'),
    start = document.querySelector('#history-start'),
    end = document.querySelector('#history-end'),
    minMag = document.querySelector('#history-mag'),
    radius = document.querySelector('#history-radius'),
    aroundSelected = document.querySelector('#history-selected'),
    status = document.querySelector('#history-status'),
    run = document.querySelector('#history-run');
  const grid = historyDetails?.querySelector('.history-grid');
  const field = (label, id, attrs) => {
    const el = document.createElement('label');
    el.innerHTML = `${label}<input id="${id}" ${attrs}/>`;
    grid?.append(el);
    return el.querySelector('input');
  };
  const maxMag = document.querySelector('#history-max-mag') || field('Max magnitude', 'history-max-mag', 'type="number" min="0" max="10" step="0.1" placeholder="Any"'),
    minDepth = document.querySelector('#history-min-depth') || field('Min depth', 'history-min-depth', 'type="number" step="1" placeholder="Any"'),
    maxDepth = document.querySelector('#history-max-depth') || field('Max depth', 'history-max-depth', 'type="number" step="1" placeholder="Any"');
  let scope = document.querySelector('#history-scope');
  if (!scope && aroundSelected) {
    const wrap = document.createElement('label');
    wrap.className = 'history-scope';
    wrap.innerHTML = 'Search area<select id="history-scope"><option value="selected">Around selected feature</option><option value="bounds">Current map bounds</option></select>';
    aroundSelected.replaceWith(wrap);
    scope = wrap.querySelector('select');
  }

  /* Navigation stack for inspector transitions across all 5 feature types. */
  window.inspectorNav = {
    stack: [],
    push(entry) {
      if (!entry || !entry.feature) return;
      const top = this.stack[this.stack.length - 1];
      if (top && top.layer === entry.layer && top.title === entry.title) return;
      if (this.stack.length >= 20) this.stack.shift();
      this.stack.push(entry);
    },
    pop() {
      return this.stack.pop() || null;
    },
    peek() {
      return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
    },
    clear() {
      this.stack = [];
    },
    back() {
      const prev = this.pop();
      if (!prev) return;
      window.restoreInspectorState(prev);
    }
  };

  window.getCurrentInspectorEntry = function() {
    if (window.selectedTrenchFeature) {
      return {
        layer: 'trenches',
        feature: window.selectedTrenchFeature,
        title: typeof window.trenchName === 'function' ? window.trenchName(window.selectedTrenchFeature) : 'Trench',
        coords: typeof window.trenchCenter === 'function' ? window.trenchCenter(window.selectedTrenchFeature.geometry) : null
      };
    }
    if (typeof selectedMapFeature !== 'undefined' && selectedMapFeature?.feature) {
      const layer = selectedMapFeature.layer;
      const f = selectedMapFeature.feature;
      let title = 'Feature';
      if (layer === 'volcanoes' || layer === 'activity') {
        const p = f.properties || {};
        title = value(p.Volcano_Name, p.VolcanoName, p.Report_Name, 'Volcano');
      } else if (layer === 'earthquakes') {
        const p = f.properties || {};
        const mag = p.mag != null ? Number(p.mag).toFixed(1) : '?';
        const place = value(p.place, 'Earthquake');
        title = `M ${mag} · ${place}`;
      } else if (layer === 'faults') {
        const p = f.properties || {};
        title = value(p.name, p.Name, p.fault_name, 'Mapped fault');
      } else if (layer === 'plates') {
        const p = f.properties || {};
        const code = value(p.Boundary_Code, p.STEPCLASS);
        const meta = (typeof STEP_META !== 'undefined' && STEP_META[code]) || { label: 'Plate boundary' };
        title = value(p.Boundary_Label, meta.label);
      }
      return { layer, feature: f, title, coords: f.geometry?.coordinates || null };
    }
    return null;
  };

  window.restoreInspectorState = function(entry) {
    if (!entry) return;
    const { layer, feature } = entry;
    if (layer === 'trenches') {
      if (typeof window.showTrenchDetail === 'function') {
        window.showTrenchDetail(feature, 'overview');
        const c = typeof window.trenchCenter === 'function' ? window.trenchCenter(feature.geometry) : null;
        if (c) map.easeTo({ center: c, zoom: Math.max(map.getZoom(), 5) });
      }
    } else if (layer === 'volcanoes' || layer === 'activity') {
      if (typeof detail === 'function') detail(layer, feature);
      const c = feature.geometry?.coordinates;
      if (c && c.length >= 2) map.easeTo({ center: [c[0], c[1]], zoom: Math.max(map.getZoom(), 6) });
    } else if (layer === 'plates') {
      if (typeof showTectonicDetail === 'function' && (feature.properties?.Boundary_Family || feature.properties?.STEPCLASS)) {
        showTectonicDetail(feature);
      } else if (typeof selectFeature === 'function') {
        selectFeature('plates', feature);
      }
      const coords = feature.geometry?.coordinates;
      const first = feature.geometry?.type === 'LineString' ? coords?.[Math.floor(coords.length / 2)] : null;
      if (first) map.easeTo({ center: first, zoom: Math.max(map.getZoom(), 6) });
    } else if (layer === 'faults') {
      if (typeof detail === 'function') detail('faults', feature);
      const coords = feature.geometry?.coordinates;
      const first = feature.geometry?.type === 'LineString' ? coords?.[Math.floor(coords.length / 2)] : null;
      if (first) map.easeTo({ center: first, zoom: Math.max(map.getZoom(), 6) });
    } else if (layer === 'earthquakes') {
      if (typeof detail === 'function') detail('earthquakes', feature);
      const c = feature.geometry?.coordinates;
      if (c && c.length >= 2) map.easeTo({ center: [c[0], c[1]], zoom: Math.max(map.getZoom(), 7) });
    }
  };

  window.renderInspectorNavBar = function() {
    const prev = window.inspectorNav?.peek();
    if (!prev) return '';
    return `<div class="drawer-nav-bar"><button class="drawer-nav-back" type="button" aria-label="Back">← Back to ${esc(prev.title)}</button></div>`;
  };

  window.wireInspectorNavBar = function(container) {
    const btn = container?.querySelector('.drawer-nav-back');
    if (btn) {
      btn.onclick = e => {
        e.stopPropagation();
        window.inspectorNav?.back();
      };
    }
  };

  function nearestVolcano(coords, maxKm = 1000, excludeId = null) {
    if (!volcanoData?.features?.length) return null;
    let best = null;
    for (const f of volcanoData.features) {
      const c = f.geometry?.coordinates;
      if (!c || c.length < 2) continue;
      const p = f.properties || {};
      const vid = String(value(p.Volcano_Number, p.VolcanoNumber, p.volcano_number) || '');
      if (excludeId && vid && vid === String(excludeId)) continue;
      const d = haversine(coords, c);
      if (d <= maxKm && (!best || d < best.distance)) {
        best = { distance: d, feature: f };
      }
    }
    return best;
  }
  window.nearestVolcano = nearestVolcano;

  function selectedPoint() {
    let f = selectedMapFeature?.feature;
    if (!f && typeof selectedTectonicStep !== 'undefined' && selectedTectonicStep) f = selectedTectonicStep;
    if (!f && window.selectedTrenchFeature) f = window.selectedTrenchFeature;
    const c = f?.geometry?.coordinates;
    if (Array.isArray(c) && Number.isFinite(+c[0]) && Number.isFinite(+c[1])) return [+c[0], +c[1]];
    if (f?.geometry && typeof window.trenchCenter === 'function') {
      const center = window.trenchCenter(f.geometry);
      if (center) return center;
    }
    const grid = document.querySelector('[data-pivot-lng]');
    if (grid && Number.isFinite(+grid.dataset.pivotLng) && Number.isFinite(+grid.dataset.pivotLat)) return [+grid.dataset.pivotLng, +grid.dataset.pivotLat];
    return null;
  }

  function setScope(mode) {
    if (scope) scope.value = mode;
    if (radius?.closest('label')) radius.closest('label').hidden = mode !== 'selected';
  }
  scope?.addEventListener('change', () => setScope(scope.value));
  setScope(scope?.value || 'selected');

  function validateDates() {
    if (!start?.value || !end?.value) throw new Error('Choose a start and end date.');
    if (start.value > end.value) throw new Error('Start date must be before end date.');
  }
  function addNumber(params, key, input) {
    if (input?.value !== '' && Number.isFinite(Number(input.value))) params.set(key, input.value);
  }

  historicalSearch = async function historicalSearchEnhanced() {
    try {
      validateDates();
      const params = new URLSearchParams({ format: 'geojson', starttime: start.value, endtime: end.value, orderby: 'time', limit: '20000' });
      addNumber(params, 'minmagnitude', minMag);
      addNumber(params, 'maxmagnitude', maxMag);
      addNumber(params, 'mindepth', minDepth);
      addNumber(params, 'maxdepth', maxDepth);
      const mode = scope?.value || 'selected', pivot = selectedPoint();
      if (mode === 'selected') {
        if (!pivot) throw new Error('Select a point feature first, or use current map bounds.');
        params.set('latitude', pivot[1]);
        params.set('longitude', pivot[0]);
        params.set('maxradiuskm', radius?.value || '250');
      } else {
        const b = map.getBounds();
        params.set('minlatitude', b.getSouth());
        params.set('maxlatitude', b.getNorth());
        params.set('minlongitude', b.getWest());
        params.set('maxlongitude', b.getEast());
      }
      status.textContent = 'Searching USGS earthquake catalog…';
      run.disabled = true;
      const r = await fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`);
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      historicalData = await r.json();
      historicalMode = true;
      quakeData = historicalData;
      window.openEarthHistoricalQuery = {
        start: start.value,
        end: end.value,
        scope: mode,
        radius: mode === 'selected' ? Number(radius?.value || 250) : null,
        pivot: mode === 'selected' ? pivot : null,
        minMagnitude: minMag?.value || null,
        maxMagnitude: maxMag?.value || null,
        minDepth: minDepth?.value || null,
        maxDepth: maxDepth?.value || null
      };
      map.getSource('earthquakes')?.setData(quakeData);
      document.querySelector('#quake-count').textContent = quakeData.features.length.toLocaleString();
      document.querySelectorAll('#range button').forEach(b => b.classList.remove('active'));
      const area = mode === 'selected' ? `${radius?.value || 250} km radius` : 'current map bounds';
      status.innerHTML = `<strong>${quakeData.features.length.toLocaleString()}</strong> earthquakes · ${esc(start.value)} → ${esc(end.value)} · ${esc(area)}${quakeData.features.length >= 20000 ? '<br>Result limit reached - narrow the query for a complete result set.' : ''}`;
      if (selectedMapFeature) detail(selectedMapFeature.layer, selectedMapFeature.feature);
    } catch (e) {
      console.warn('historical earthquake search failed', e);
      status.textContent = `Search failed: ${e.message}`;
    } finally {
      run.disabled = false;
    }
  };

  if (run) {
    const replacement = run.cloneNode(true);
    run.replaceWith(replacement);
    replacement.addEventListener('click', () => historicalSearch());
  }

  function relationshipCard(action, valueText, label, extra = '') {
    return `<button type="button" class="relationship-card" data-rel-action="${action}" ${extra}><b>${valueText}</b><span>${label}</span></button>`;
  }

  function enhancedRelationships(coords) {
    const boundary = typeof boundaryContext === 'function' ? boundaryContext(coords) : (plateData.features.length ? nearestLine(coords, plateData) : null);
    const plate = typeof containingPlate === 'function' ? containingPlate(coords) : null;
    const fault = faultData.features.length ? nearestLine(coords, faultData) : null;
    const trenchOn = viewState?.layers?.trenches !== false;
    const trench = trenchOn && (typeof window.nearestTrench === 'function' ? window.nearestTrench(coords) : (window.trenchData?.features?.length && typeof nearestLine === 'function' ? nearestLine(coords, window.trenchData) : null));
    const qs = nearbyQuakes(coords, quakeData, 250);
    const strong = qs[0];

    const currentFeat = selectedMapFeature?.feature || window.selectedTrenchFeature;
    const p = currentFeat?.properties || {};
    const currentVid = String(value(p.Volcano_Number, p.VolcanoNumber, p.volcano_number) || '');
    const isVolcano = (selectedMapFeature?.layer === 'volcanoes' || selectedMapFeature?.layer === 'activity');
    const nearV = nearestVolcano(coords, 1000, isVolcano ? currentVid : null);
    const nearVName = nearV ? value(nearV.feature.properties?.Volcano_Name, nearV.feature.properties?.VolcanoName, 'Volcano') : null;

    // REFERENCE tier (authoritative catalog facts)
    const plateTxt = plate ? esc(plateName(plate)) : 'Not in PB2002 polygon';
    const gvpSetting = isVolcano ? value(p.Tectonic_Setting, p.TectonicSetting) : null;
    const volcanoType = isVolcano ? value(p.Primary_Volcano_Type, p.PrimaryVolcanoType, p.Volcano_Type) : null;

    let refHtml = `<div class="tier-card tier-reference"><span class="tier-badge">REFERENCE · CATALOG FACTS</span><div class="meta">${fact('Containing plate', `${plateTxt} (PB2002)`)}`;
    if (gvpSetting) refHtml += fact('GVP tectonic setting', gvpSetting);
    if (volcanoType) refHtml += fact('Volcano type', volcanoType);
    if (currentFeat && window.selectedTrenchFeature) {
      refHtml += fact('Gazetteer name', esc(window.trenchName ? window.trenchName(window.selectedTrenchFeature) : 'Trench'));
      refHtml += fact('Feature type', esc(window.selectedTrenchFeature.properties?.Generic || 'Trench'));
    } else if (selectedMapFeature?.layer === 'faults') {
      refHtml += fact('Slip type', esc(value(p.slip_type, p.slip_type_text, 'Not specified')));
      if (p.slip_rate || p.slip_rate_text) refHtml += fact('Slip rate', esc(value(p.slip_rate, p.slip_rate_text)));
    } else if (selectedMapFeature?.layer === 'plates') {
      const code = value(p.Boundary_Code, p.STEPCLASS);
      refHtml += fact('Boundary code', esc(code || 'PB2002'));
      if (p.Plate_Pair || p.PLATEBOUND) refHtml += fact('Plate pair', esc(value(p.Plate_Pair, p.PLATEBOUND)));
    } else if (selectedMapFeature?.layer === 'earthquakes') {
      if (currentFeat.id) refHtml += fact('USGS event ID', esc(currentFeat.id));
    }
    refHtml += '</div></div>';

    // OBSERVED tier (live and recent monitoring observations)
    let obsHtml = `<div class="tier-card tier-observed"><span class="tier-badge">OBSERVED · MONITORING & SEISMICITY</span><div class="meta">`;
    if (isVolcano) {
      const regList = typeof window.regionalMonitoringForVolcano === 'function' ? window.regionalMonitoringForVolcano(p) : [];
      if (regList.length) {
        obsHtml += fact('Regional alert', regList.map(r => `${r.providerName}: ${r.nativeStatus || r.label}`).join(', '));
      } else {
        obsHtml += fact('Regional monitoring', 'No active regional status');
      }
      const report = typeof reportForVolcano === 'function' ? reportForVolcano(p) : null;
      obsHtml += fact('GVP activity bulletin', report ? 'Active weekly report on file' : 'No active weekly bulletin');
    }
    obsHtml += fact('Nearby seismicity', `${qs.length} earthquakes / 250 km (${historicalMode ? 'search' : 'current'})`);
    if (strong) obsHtml += fact('Strongest nearby', `M ${Number(strong.properties.mag).toFixed(1)} (${Math.round(strong._distance)} km away)`);
    obsHtml += '</div></div>';

    // DERIVED tier (analytical proximity relationships)
    let derHtml = `<div class="tier-card tier-derived"><span class="tier-badge">DERIVED · SPATIAL ANALYSIS</span><div class="meta">`;
    if (boundary) derHtml += fact('Nearest boundary', `${boundary.label} · ${boundary.pair ? boundary.pair + ' · ' : ''}${Math.round(boundary.distance)} km away`);
    if (trench) {
      const tName = typeof window.trenchName === 'function' ? window.trenchName(trench.feature) : (trench.feature.properties?.Name || 'Trench');
      derHtml += fact('Nearest trench', `${tName} · ${Math.round(trench.distance)} km away`);
    }
    if (nearV) derHtml += fact(isVolcano ? 'Neighbor volcano' : 'Nearest volcano', `${nearVName} · ${Math.round(nearV.distance)} km away`);
    if (fault) derHtml += fact('Nearest active fault', `${Math.round(fault.distance)} km away`);
    derHtml += `</div><p class="analytical-disclaimer">Analytical interpretation based on spatial proximity, not an authoritative named arc classification.</p></div>`;

    const geodynamicSection = `<div class="inspector-section tectonic-model"><div class="inspector-heading">Geodynamic classification</div><div class="provenance-tier-group">${refHtml}${obsHtml}${derHtml}</div></div>`;

    // Interactive spatial cards
    const trenchLabel = trench ? esc(typeof window.trenchName === 'function' ? window.trenchName(trench.feature) : (trench.feature.properties?.Name || 'Trench')) : 'nearest named trench';
    const volcanoLabel = nearV ? esc(nearVName) : (isVolcano ? 'neighbor volcano' : 'nearest volcano');

    const cardsHtml = `<div class="inspector-section"><div class="inspector-heading">Interactive spatial relationships</div><div class="relationship-grid interactive" data-pivot-lng="${coords[0]}" data-pivot-lat="${coords[1]}">${relationshipCard('boundary', boundary ? `${Math.round(boundary.distance)} km` : (viewState?.layers?.plates === false ? 'off' : 'None'), boundary ? esc((boundary.label || 'typed boundary').toLowerCase()) : 'nearest typed boundary', boundary ? '' : 'disabled')}${relationshipCard('trench', trench ? `${Math.round(trench.distance)} km` : (trenchOn ? 'None' : 'off'), trenchLabel, trench ? '' : 'disabled')}${relationshipCard('volcano', nearV ? `${Math.round(nearV.distance)} km` : 'None', volcanoLabel, nearV ? '' : 'disabled')}${relationshipCard('history', `${qs.length}`, `earthquakes / 250 km (${historicalMode ? 'search' : 'current'})`, `data-lng="${coords[0]}" data-lat="${coords[1]}"`)}${relationshipCard('strongest', strong ? `M ${Number(strong.properties.mag).toFixed(1)}` : 'None', strong ? `${Math.round(strong._distance)} km away` : 'strongest nearby', strong ? `data-id="${esc(strong.id || '')}"` : 'disabled')}${relationshipCard('fault', fault ? `${Math.round(fault.distance)} km` : (viewState?.layers?.faults ? 'None' : 'off'), 'nearest active fault', fault ? '' : 'disabled')}</div><p class="relationship-hint">Click a relationship to explore it on the map or use it as a historical-search pivot.</p></div>`;

    return geodynamicSection + cardsHtml;
  }
  relationships = enhancedRelationships;

  function rerenderSelected() {
    if (selectedMapFeature) detail(selectedMapFeature.layer, selectedMapFeature.feature);
  }

  function openHistoryForSelected() {
    historyDetails.open = true;
    setScope('selected');
    if (radius) radius.value = '250';
    historyDetails.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    status.textContent = 'Ready to search 250 km around the selected feature.';
  }

  function selectRelationshipFeature(kind, pivot) {
    const c = pivot || selectedPoint();
    if (!c) return;
    const current = window.getCurrentInspectorEntry?.();

    if (kind === 'trench') {
      const hit = typeof window.nearestTrench === 'function' ? window.nearestTrench(c) : (window.trenchData?.features?.length && typeof nearestLine === 'function' ? nearestLine(c, window.trenchData) : null);
      if (!hit?.feature) return;
      if (current) window.inspectorNav.push(current);
      if (typeof window.showTrenchDetail === 'function') window.showTrenchDetail(hit.feature);
      const center = typeof window.trenchCenter === 'function' ? window.trenchCenter(hit.feature.geometry) : null;
      if (center) map.easeTo({ center, zoom: Math.max(map.getZoom(), 5) });
      return;
    }

    if (kind === 'volcano') {
      const currentFeat = selectedMapFeature?.feature;
      const currentVid = currentFeat?.properties ? String(value(currentFeat.properties.Volcano_Number, currentFeat.properties.VolcanoNumber, currentFeat.properties.volcano_number) || '') : null;
      const hit = nearestVolcano(c, 1000, currentVid);
      if (!hit?.feature) return;
      if (current) window.inspectorNav.push(current);
      if (typeof detail === 'function') detail('volcanoes', hit.feature);
      const coords = hit.feature.geometry?.coordinates;
      if (coords) map.easeTo({ center: coords, zoom: Math.max(map.getZoom(), 7) });
      return;
    }

    const hit = kind === 'boundary' ? (typeof boundaryContext === 'function' ? boundaryContext(c) : nearestLine(c, plateData)) : nearestLine(c, faultData);
    if (!hit?.feature) return;
    if (current) window.inspectorNav.push(current);
    if (kind === 'boundary' && typeof showTectonicDetail === 'function' && hit.feature.properties?.Boundary_Family) {
      showTectonicDetail(hit.feature);
    } else {
      selectFeature(kind === 'fault' ? 'faults' : 'plates', hit.feature);
    }
    const coords = hit.feature.geometry?.coordinates, first = hit.feature.geometry?.type === 'LineString' ? coords?.[Math.floor(coords.length / 2)] : null;
    if (first) map.easeTo({ center: first, zoom: Math.max(map.getZoom(), 6) });
  }

  details?.addEventListener('click', e => {
    const card = e.target.closest('[data-rel-action]');
    if (!card || card.disabled) return;
    const grid = card.closest('[data-pivot-lng]');
    const pivot = (grid && Number.isFinite(+grid.dataset.pivotLng) && Number.isFinite(+grid.dataset.pivotLat)) ? [+grid.dataset.pivotLng, +grid.dataset.pivotLat] : null;
    const action = card.dataset.relAction;
    if (action === 'history') return openHistoryForSelected();
    if (action === 'boundary' || action === 'fault' || action === 'trench' || action === 'volcano') {
      return selectRelationshipFeature(action, pivot);
    }
    if (action === 'strongest') {
      const c = pivot || selectedPoint(), quake = c ? nearbyQuakes(c, quakeData, 250)[0] : null;
      if (quake) {
        const current = window.getCurrentInspectorEntry?.();
        if (current) window.inspectorNav.push(current);
        map.easeTo({ center: quake.geometry.coordinates, zoom: Math.max(map.getZoom(), 7) });
        selectFeature('earthquakes', quake);
      }
    }
  });

  document.querySelector('#details-close')?.addEventListener('click', () => {
    window.inspectorNav?.clear();
  });

  rerenderSelected();
})();

