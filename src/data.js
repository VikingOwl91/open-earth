/**
 * Open Earth - Data Store & Loader
 * Centralizes all snapshot and live API fetching. Eliminates duplicate requests,
 * caches data in-memory, and provides fast lookups.
 */
(() => {
  'use strict';

  const SOURCES = {
    earthquakes: { name: 'USGS Earthquake Hazards Program', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php' },
    volcanoes: { name: 'Smithsonian Global Volcanism Program · VOTW 5.4.0', url: 'https://volcano.si.edu/volcanolist_holocene.cfm' },
    activity: { name: 'Smithsonian / USGS Weekly Volcanic Activity Report', url: 'https://volcano.si.edu/reports_weekly.cfm' },
    plates: { name: 'PB2002 plate boundaries · Peter Bird', url: 'https://github.com/fraxen/tectonicplates' },
    faults: { name: 'GEM Global Active Faults', url: 'https://github.com/GEMScienceTools/gem-global-active-faults' },
    trenches: { name: 'IHO-IOC GEBCO Undersea Feature Names Gazetteer', url: 'https://www.gebco.net/data-products/undersea-feature-names' }
  };

  const FEEDS = {
    hour: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
    day: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
    week: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson'
  };

  const EMPTY = Object.freeze({ type: 'FeatureCollection', features: [] });

  class DataStore {
    constructor() {
      this.manifest = null;
      this.earthquakes = EMPTY;
      this.volcanoes = EMPTY;
      this.activity = EMPTY;
      this.plates = EMPTY;
      this.plateSteps = EMPTY;
      this.platePolygons = EMPTY;
      this.trenches = EMPTY;
      this.faults = EMPTY;
      this.eruptions = EMPTY;

      this.historicalMode = false;
      this.historicalData = null;

      this.failures = new Set();
      this.promises = new Map();
      this.listeners = new Set();
    }

    notify(event, data) {
      for (const fn of this.listeners) {
        fn(event, data);
      }
    }

    subscribe(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }

    async fetchJson(url, label) {
      try {
        const r = await fetch(url, { cache: 'no-cache' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        this.failures.delete(label);
        return await r.json();
      } catch (e) {
        this.failures.add(label);
        console.warn(`[OpenEarth] Failed fetching ${label} from ${url}:`, e);
        return null;
      }
    }

    fetchCached(key, fetcher) {
      if (!this.promises.has(key)) {
        this.promises.set(key, fetcher().catch(e => {
          this.promises.delete(key);
          throw e;
        }));
      }
      return this.promises.get(key);
    }

    async loadManifest() {
      return this.fetchCached('manifest', async () => {
        const d = await this.fetchJson('./data/manifest.json', 'manifest');
        if (d) this.manifest = d;
        return this.manifest;
      });
    }

    snapshotAge() {
      const raw = this.manifest?.generatedAt;
      if (!raw) return '';
      const ms = Date.now() - Date.parse(raw);
      if (!Number.isFinite(ms)) return '';
      const h = Math.max(0, Math.floor(ms / 36e5));
      return h < 24 ? `${h}h old` : `${Math.floor(h / 24)}d old`;
    }

    getStatusSummary() {
      const core = ['earthquakes', 'volcanoes', 'plates'];
      const ok = core.filter(x => !this.failures.has(x)).length;
      const age = this.snapshotAge();
      let text = `${ok}/3 core sources healthy`;
      if (age) text += ` · snapshot ${age}`;
      if (this.failures.size > 0) {
        text += ` · issues: ${[...this.failures].join(', ')}`;
      }
      return text;
    }

    async loadEarthquakes(range = 'day') {
      const url = FEEDS[range] || FEEDS.day;
      const d = await this.fetchJson(url, 'earthquakes');
      this.earthquakes = d?.features ? d : EMPTY;
      this.historicalMode = false;
      this.notify('earthquakes', this.earthquakes);
      return this.earthquakes;
    }

    async loadVolcanoes() {
      return this.fetchCached('volcanoes', async () => {
        const d = await this.fetchJson('./data/volcanoes.json', 'volcanoes');
        this.volcanoes = d?.features ? d : EMPTY;
        this.notify('volcanoes', this.volcanoes);
        return this.volcanoes;
      });
    }

    async loadActivity() {
      return this.fetchCached('activity', async () => {
        const d = await this.fetchJson('./data/volcanic-reports.json', 'activity');
        this.activity = d?.features ? d : EMPTY;
        this.notify('activity', this.activity);
        return this.activity;
      });
    }

    async loadPlates() {
      return this.fetchCached('plates', async () => {
        const d = await this.fetchJson('./data/plates.json', 'plates');
        this.plates = d?.features ? d : EMPTY;
        this.notify('plates', this.plates);
        return this.plates;
      });
    }

    async loadTectonics() {
      return this.fetchCached('tectonics', async () => {
        const [steps, poly] = await Promise.all([
          this.fetchJson('./data/plate-steps.json', 'plateSteps'),
          this.fetchJson('./data/plate-polygons.json', 'platePolygons')
        ]);
        this.plateSteps = steps?.features ? steps : EMPTY;
        this.platePolygons = poly?.features ? poly : EMPTY;
        this.notify('tectonics', { steps: this.plateSteps, polygons: this.platePolygons });
        return { steps: this.plateSteps, polygons: this.platePolygons };
      });
    }

    async loadTrenches() {
      return this.fetchCached('trenches', async () => {
        const d = await this.fetchJson('./data/trenches.json', 'trenches');
        this.trenches = d?.features ? d : EMPTY;
        this.notify('trenches', this.trenches);
        return this.trenches;
      });
    }

    async loadFaults() {
      return this.fetchCached('faults', async () => {
        const d = await this.fetchJson('./data/faults.json', 'faults');
        this.faults = d?.features ? d : EMPTY;
        this.notify('faults', this.faults);
        return this.faults;
      });
    }

    async loadEruptions() {
      return this.fetchCached('eruptions', async () => {
        const d = await this.fetchJson('./data/eruptions.json', 'eruptions');
        this.eruptions = d?.features ? d : EMPTY;
        this.notify('eruptions', this.eruptions);
        return this.eruptions;
      });
    }

    async runHistoricalSearch(params) {
      const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?${params.toString()}`;
      const d = await this.fetchJson(url, 'historicalEarthquakes');
      if (d?.features) {
        this.historicalData = d;
        this.historicalMode = true;
        this.earthquakes = d;
        this.notify('earthquakes', this.earthquakes);
        return d;
      }
      throw new Error('No features returned from USGS catalog');
    }

    /* Fast feature lookups */

    findVolcano(idOrName) {
      if (!idOrName || !this.volcanoes?.features) return null;
      const s = String(idOrName).trim();
      const normS = (typeof norm === 'function' ? norm(s) : s.toLowerCase());
      return this.volcanoes.features.find(f => {
        const p = f.properties || {};
        const vnum = String(p.Volcano_Number || p.volcano_number || '').trim();
        if (vnum && vnum === s) return true;
        const vname = (typeof norm === 'function' ? norm(p.Volcano_Name || '') : String(p.Volcano_Name || '').toLowerCase());
        return vname === normS;
      }) || null;
    }

    findReportForVolcano(p) {
      if (!p || !this.activity?.features) return null;
      const vnum = String(p.Volcano_Number || p.volcano_number || p.VolcanoNumber || '').trim();
      const vname = typeof norm === 'function' ? norm(p.Volcano_Name || p.Report_Name || '') : '';
      return this.activity.features.find(f => {
        const q = f.properties || {};
        const qNum = String(q.Volcano_Number || q.volcano_number || '').trim();
        if (vnum && qNum && vnum === qNum) return true;
        const qName = typeof norm === 'function' ? norm(q.Volcano_Name || q.Report_Name || '') : '';
        return vname && qName && vname === qName;
      }) || null;
    }

    findEruptionsForVolcano(p) {
      if (!p || !this.eruptions?.features) return [];
      const vnum = String(p.Volcano_Number || p.volcano_number || p.VolcanoNumber || '').trim();
      const vname = typeof norm === 'function' ? norm(p.Volcano_Name || '') : '';
      return this.eruptions.features.filter(f => {
        const q = f.properties || {};
        const qNum = String(q.Volcano_Number || q.volcano_number || '').trim();
        if (vnum && qNum && vnum === qNum) return true;
        const qName = typeof norm === 'function' ? norm(q.Volcano_Name || '') : '';
        return vname && qName && vname === qName;
      });
    }

    findTrench(idOrName) {
      if (!idOrName || !this.trenches?.features) return null;
      const s = String(idOrName).toLowerCase().replace(/[-_\s]+/g, '');
      return this.trenches.features.find(f => {
        const n = String(f.properties?.Name || '').toLowerCase().replace(/[-_\s]+/g, '');
        return n === s || s.includes(n);
      }) || null;
    }

    findFault(idOrName) {
      if (!idOrName || !this.faults?.features) return null;
      const s = String(idOrName).trim();
      return this.faults.features.find(f => {
        const p = f.properties || {};
        return (p.catalog_id && String(p.catalog_id).trim() === s) ||
               (p.name && String(p.name).trim().toLowerCase() === s.toLowerCase());
      }) || null;
    }

    findBoundary(seqnumOrCode) {
      if (!seqnumOrCode || !this.plateSteps?.features) return null;
      const s = String(seqnumOrCode).trim();
      return this.plateSteps.features.find(f => {
        const p = f.properties || {};
        if (p.SEQNUM != null && String(Math.round(p.SEQNUM)) === s) return true;
        const key = `${p.Plate_Pair || p.PLATEBOUND}:${p.Boundary_Code || p.STEPCLASS}`;
        if (key === s) return true;
        if (p.Boundary_Code === s || p.STEPCLASS === s) return true;
        if (p.Boundary_Family && p.Boundary_Family.toLowerCase() === s.toLowerCase()) return true;
        return false;
      }) || null;
    }

    findEarthquake(id) {
      if (!id || !this.earthquakes?.features) return null;
      const s = String(id).trim();
      return this.earthquakes.features.find(f => {
        return f.id === s || f.properties?.id === s || f.properties?.code === s;
      }) || null;
    }
  }

  const Data = {
    SOURCES,
    FEEDS,
    EMPTY,
    DataStore
  };

  if (typeof window !== 'undefined') {
    window.OpenEarth = window.OpenEarth || {};
    window.OpenEarth.dataStore = new DataStore();
    window.SOURCES = SOURCES;
    window.feeds = FEEDS;
    window.empty = EMPTY;

    // Backward compatibility data accessors
    Object.defineProperty(window, 'quakeData', {
      get: () => window.OpenEarth.dataStore.earthquakes,
      set: d => { window.OpenEarth.dataStore.earthquakes = d; }
    });
    Object.defineProperty(window, 'volcanoData', {
      get: () => window.OpenEarth.dataStore.volcanoes,
      set: d => { window.OpenEarth.dataStore.volcanoes = d; }
    });
    Object.defineProperty(window, 'activityData', {
      get: () => window.OpenEarth.dataStore.activity,
      set: d => { window.OpenEarth.dataStore.activity = d; }
    });
    Object.defineProperty(window, 'plateData', {
      get: () => window.OpenEarth.dataStore.plates,
      set: d => { window.OpenEarth.dataStore.plates = d; }
    });
    Object.defineProperty(window, 'plateStepData', {
      get: () => window.OpenEarth.dataStore.plateSteps,
      set: d => { window.OpenEarth.dataStore.plateSteps = d; }
    });
    Object.defineProperty(window, 'platePolygonData', {
      get: () => window.OpenEarth.dataStore.platePolygons,
      set: d => { window.OpenEarth.dataStore.platePolygons = d; }
    });
    Object.defineProperty(window, 'trenchData', {
      get: () => window.OpenEarth.dataStore.trenches,
      set: d => { window.OpenEarth.dataStore.trenches = d; }
    });
    Object.defineProperty(window, 'faultData', {
      get: () => window.OpenEarth.dataStore.faults,
      set: d => { window.OpenEarth.dataStore.faults = d; }
    });
    Object.defineProperty(window, 'eruptionData', {
      get: () => window.OpenEarth.dataStore.eruptions,
      set: d => { window.OpenEarth.dataStore.eruptions = d; }
    });
    Object.defineProperty(window, 'historicalMode', {
      get: () => window.OpenEarth.dataStore.historicalMode,
      set: v => { window.OpenEarth.dataStore.historicalMode = v; }
    });

    window.snapshotAge = () => window.OpenEarth.dataStore.snapshotAge();
    window.setStatus = () => {
      const el = document.querySelector('#status');
      if (el) el.textContent = window.OpenEarth.dataStore.getStatusSummary();
    };
    window.sourceLine = s => `<p class="source">Source: <a href="${s.url}" target="_blank" rel="noreferrer">${esc(s.name)}</a></p>`;
    window.volcanoCatalogMatch = p => window.OpenEarth.dataStore.findVolcano(p?.Volcano_Number || p?.Volcano_Name);
    window.reportForVolcano = p => window.OpenEarth.dataStore.findReportForVolcano(p);
    window.reportsForVolcano = p => {
      const r = window.OpenEarth.dataStore.findReportForVolcano(p);
      return r ? [r] : [];
    };
    window.localSnapshot = (file, label) => window.OpenEarth.dataStore.fetchJson(`./data/${file}`, label);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Data;
  }
})();
