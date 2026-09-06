/**
 * Open Earth - Search & Historical Earthquake Catalog Controller
 * Provides instantaneous local geological entity search with remote Nominatim fallback,
 * and parameterized historical USGS FDSNWS earthquake catalog queries.
 */
(() => {
  'use strict';

  class SearchController {
    constructor(inputEl, resultsEl, stateManager, dataStore, mapController, inspectorController) {
      this.input = inputEl;
      this.results = resultsEl;
      this.stateManager = stateManager;
      this.dataStore = dataStore;
      this.mapController = mapController;
      this.inspector = inspectorController;

      this.timer = null;
      this._bindSearch();
      this._bindHistory();
    }

    _bindSearch() {
      if (!this.input || !this.results) return;

      this.input.addEventListener('input', () => {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.search(this.input.value), 220);
      });

      // Close results when clicking outside
      document.addEventListener('click', e => {
        if (!this.input.contains(e.target) && !this.results.contains(e.target)) {
          this.results.hidden = true;
        }
      });
    }

    async search(query) {
      const q = String(query || '').trim();
      if (q.length < 2) {
        this.results.hidden = true;
        this.results.innerHTML = '';
        return;
      }

      const esc = window.OpenEarth?.geo?.esc || (s => s);
      const norm = window.OpenEarth?.geo?.norm || (s => s.toLowerCase());
      const normQ = norm(q);

      // 1. Local Volcano matching
      const localHits = [];
      for (const f of this.dataStore.volcanoes.features || []) {
        const p = f.properties || {};
        const name = p.Volcano_Name || '';
        const vnum = p.Volcano_Number || '';
        const normName = norm(name);
        if (normName.includes(normQ) || vnum === q) {
          localHits.push({
            type: 'volcano',
            label: `🌋 ${name}${p.Country ? ` · ${p.Country}` : ''}`,
            coords: f.geometry?.coordinates,
            feature: f,
            priority: normName.startsWith(normQ) ? 0 : 1
          });
        }
        if (localHits.length >= 10) break;
      }

      localHits.sort((a, b) => a.priority - b.priority);

      // 2. Local Trenches matching
      for (const f of this.dataStore.trenches.features || []) {
        const name = f.properties?.Name || '';
        if (norm(name).includes(normQ)) {
          const coords = window.OpenEarth?.geo?.centerOfGeometry(f.geometry);
          localHits.push({
            type: 'trench',
            label: `⌄ ${name} Trench`,
            coords,
            feature: f
          });
        }
      }

      // 3. Remote Nominatim fallback for place/city names
      let remoteHits = [];
      if (localHits.length < 5) {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=4&q=${encodeURIComponent(q)}`);
          if (r.ok) {
            const data = await r.json();
            remoteHits = data.map(x => ({
              type: 'place',
              label: `⌖ ${x.display_name}`,
              coords: [+x.lon, +x.lat],
              feature: null
            }));
          }
        } catch {}
      }

      const combined = [...localHits.slice(0, 5), ...remoteHits].slice(0, 7);
      if (!combined.length) {
        this.results.innerHTML = '<div class="search-empty">No results found</div>';
        this.results.hidden = false;
        return;
      }

      this.results.innerHTML = combined.map((item, i) => `
        <button type="button" data-search-hit="${i}" class="search-hit-btn">
          ${esc(item.label)}
        </button>
      `).join('');

      this.results.hidden = false;

      this.results.querySelectorAll('[data-search-hit]').forEach(btn => {
        btn.onclick = () => {
          const item = combined[+btn.dataset.searchHit];
          this.results.hidden = true;
          this.input.value = item.label.replace(/^[^ ]+ /, '');

          if (item.coords && this.mapController?.map) {
            this.mapController.map.flyTo({ center: [item.coords[0], item.coords[1]], zoom: item.type === 'volcano' ? 8 : 6 });
          }

          if (item.feature && this.inspector) {
            const layer = item.type === 'volcano' ? 'volcanoes' : item.type === 'trench' ? 'trenches' : 'plates';
            this.inspector.inspect(layer, item.feature);
          }
        };
      });
    }

    _bindHistory() {
      const histStart = document.querySelector('#history-start');
      const histEnd = document.querySelector('#history-end');
      const histMag = document.querySelector('#history-mag');
      const histRadius = document.querySelector('#history-radius');
      const histSelected = document.querySelector('#history-selected');
      const histStatus = document.querySelector('#history-status');
      const runBtn = document.querySelector('#history-run');
      const liveBtn = document.querySelector('#history-live');

      if (!runBtn || !liveBtn) return;

      // Initialize default date range: past 1 year
      if (histEnd && !histEnd.value) {
        const end = new Date();
        const start = new Date(end);
        start.setUTCFullYear(end.getUTCFullYear() - 1);
        histEnd.value = end.toISOString().slice(0, 10);
        histStart.value = start.toISOString().slice(0, 10);
      }

      runBtn.onclick = async () => {
        if (!histStart.value || !histEnd.value) {
          if (histStatus) histStatus.textContent = 'Please select a valid date range.';
          return;
        }

        const params = new URLSearchParams({
          format: 'geojson',
          starttime: histStart.value,
          endtime: histEnd.value,
          minmagnitude: histMag?.value || '4',
          orderby: 'time',
          limit: '20000'
        });

        const selected = this.inspector?.currentFeature;
        const coords = selected?.geometry?.type === 'Point'
          ? selected.geometry.coordinates
          : window.OpenEarth?.geo?.centerOfGeometry(selected?.geometry);
        const useSelected = histSelected ? histSelected.checked : true;

        if (useSelected && coords && coords.length >= 2) {
          params.set('latitude', coords[1]);
          params.set('longitude', coords[0]);
          params.set('maxradiuskm', histRadius?.value || '250');
        } else if (this.mapController?.map) {
          const b = this.mapController.map.getBounds();
          params.set('minlatitude', b.getSouth());
          params.set('maxlatitude', b.getNorth());
          params.set('minlongitude', b.getWest());
          params.set('maxlongitude', b.getEast());
        }

        if (histStatus) histStatus.textContent = 'Searching USGS catalog…';
        try {
          const data = await this.dataStore.runHistoricalSearch(params);
          const count = data.features?.length || 0;
          if (histStatus) {
            histStatus.textContent = `${count.toLocaleString()} historical earthquakes · ${histStart.value} → ${histEnd.value}`;
          }
          const quakeCountEl = document.querySelector('#quake-count');
          if (quakeCountEl) quakeCountEl.textContent = count;

          // Uncheck live range buttons
          document.querySelectorAll('#range button').forEach(b => b.classList.remove('active'));

          // Update state URL
          this.stateManager.update({
            historicalQuery: {
              start: histStart.value,
              end: histEnd.value,
              minMag: histMag?.value || '4',
              radius: histRadius?.value || '250',
              scope: useSelected ? 'selected' : 'bounds'
            }
          }, { pushHistory: true });

          // Re-render inspector if open
          if (this.inspector?.currentFeature) {
            this.inspector.render();
          }
        } catch (e) {
          if (histStatus) histStatus.textContent = `USGS search failed: ${e.message}`;
        }
      };

      liveBtn.onclick = async () => {
        if (histStatus) histStatus.textContent = 'Restoring live earthquake feed…';
        const range = this.stateManager.get().earthquakeRange || 'day';
        await this.dataStore.loadEarthquakes(range);
        if (histStatus) histStatus.textContent = 'Live earthquake feed active.';
        const quakeCountEl = document.querySelector('#quake-count');
        if (quakeCountEl) quakeCountEl.textContent = this.dataStore.earthquakes.features?.length || 0;

        document.querySelectorAll('#range button').forEach(b => {
          b.classList.toggle('active', b.dataset.range === range);
        });

        this.stateManager.update({ historicalQuery: null }, { pushHistory: true });

        if (this.inspector?.currentFeature) {
          this.inspector.render();
        }
      };
    }
  }

  const SearchModule = {
    SearchController
  };

  if (typeof window !== 'undefined') {
    window.OpenEarth = window.OpenEarth || {};
    window.OpenEarth.searchModule = SearchModule;
    window.historicalSearch = () => window.OpenEarth.searchController?._bindHistory();
    window.backToLive = () => document.querySelector('#history-live')?.click();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchModule;
  }
})();
