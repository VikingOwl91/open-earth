/**
 * Open Earth - Application State & Shareable URL Manager
 * Handles URL parsing, stable feature serialization, history push/replace,
 * and localStorage view persistence.
 */
(() => {
  'use strict';

  const STATE_KEY = 'open-earth:view:v1';

  const DEFAULT_STATE = {
    basemap: 'dark',
    projection: 'mercator',
    earthquakeRange: 'day',
    layers: {
      earthquakes: true,
      activity: true,
      volcanoes: true,
      plates: true,
      trenches: true,
      faults: false,
      bathymetry: false
    },
    camera: {
      center: [110, -4],
      zoom: 2.25,
      bearing: 0,
      pitch: 0
    },
    selectedFeature: null, // { type: 'volcano'|'earthquake'|'trench'|'fault'|'boundary', id: '...' }
    historicalQuery: null
  };

  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');
  }

  /**
   * Derive a stable upstream identity string for a feature.
   * Never relies on array indices or ephemeral IDs.
   */
  function getFeatureIdentity(layer, feature) {
    if (!feature) return null;
    const p = feature.properties || {};

    if (layer === 'volcanoes' || layer === 'activity' || p.Volcano_Number || p.volcano_number) {
      const num = p.Volcano_Number || p.volcano_number || p.VolcanoNumber;
      if (num) return { type: 'volcano', id: String(num).trim() };
      const name = p.Volcano_Name || p.volcano_name || p.Report_Name;
      if (name) return { type: 'volcano', id: slugify(name) };
    }

    if (layer === 'earthquakes' || p.mag !== undefined || p.time !== undefined) {
      const id = feature.id || p.id || p.code;
      if (id) return { type: 'earthquake', id: String(id).trim() };
    }

    if (layer === 'trenches' || p.Generic === 'Trench' || p.generic === 'Trench') {
      const name = p.Name || p.name || 'trench';
      return { type: 'trench', id: slugify(name) };
    }

    if (layer === 'faults' || p.catalog_id || p.catalog_name) {
      const id = p.catalog_id || p.name || p.fault_name;
      if (id) return { type: 'fault', id: String(id).trim() };
    }

    if (layer === 'plates' || p.Boundary_Code || p.STEPCLASS || p.SEQNUM !== undefined) {
      const seq = p.SEQNUM != null ? String(Math.round(p.SEQNUM)) : null;
      if (seq) return { type: 'boundary', id: seq };
      const pair = p.Plate_Pair || p.PLATEBOUND;
      const code = p.Boundary_Code || p.STEPCLASS;
      if (pair && code) return { type: 'boundary', id: `${pair}:${code}` };
    }

    return null;
  }

  /**
   * Parse URL query parameters into a partial state object.
   */
  function parseUrlState(search = window.location.search) {
    if (!search || search.length < 2) return null;
    const params = new URLSearchParams(search);
    const parsed = {};

    // Feature identity: ?v=volcano:332010 or ?feature=volcano:332010
    const rawFeat = params.get('v') || params.get('feature');
    if (rawFeat) {
      const idx = rawFeat.indexOf(':');
      if (idx > 0) {
        const type = rawFeat.slice(0, idx).toLowerCase();
        const id = rawFeat.slice(idx + 1);
        parsed.selectedFeature = { type, id };
      }
    }

    // Camera: ?c=lat,lng,zoom or ?c=lat,lng,zoom,bearing,pitch
    const rawCamera = params.get('c');
    if (rawCamera) {
      const parts = rawCamera.split(',').map(Number);
      if (parts.length >= 3 && parts.every(Number.isFinite)) {
        parsed.camera = {
          center: [parts[1], parts[0]], // Store as [lng, lat]
          zoom: parts[2],
          bearing: parts[3] || 0,
          pitch: parts[4] || 0
        };
      }
    }

    // Projection: ?proj=globe
    const proj = params.get('proj');
    if (proj === 'globe' || proj === 'mercator') {
      parsed.projection = proj;
    }

    // Basemap: ?base=positron
    const base = params.get('base');
    if (base && ['dark', 'positron', 'liberty', 'fiord', 'classic'].includes(base)) {
      parsed.basemap = base;
    }

    // Earthquake range: ?range=hour
    const range = params.get('range');
    if (range && ['hour', 'day', 'week'].includes(range)) {
      parsed.earthquakeRange = range;
    }

    // Layers: ?layers=faults,bathymetry
    const layers = params.get('layers');
    if (layers) {
      const active = layers.split(',').map(s => s.trim().toLowerCase());
      parsed.layers = {
        earthquakes: active.includes('earthquakes') || active.includes('quakes'),
        activity: active.includes('activity'),
        volcanoes: active.includes('volcanoes'),
        plates: active.includes('plates'),
        trenches: active.includes('trenches'),
        faults: active.includes('faults'),
        bathymetry: active.includes('bathymetry')
      };
    }

    // Historical search parameters: ?h_start=...&h_end=...
    const hStart = params.get('h_start');
    const hEnd = params.get('h_end');
    if (hStart && hEnd) {
      parsed.historicalQuery = {
        start: hStart,
        end: hEnd,
        minMag: params.get('h_mag') || '4',
        radius: params.get('h_radius') || '250',
        scope: params.get('h_scope') || 'selected'
      };
    }

    return parsed;
  }

  /**
   * Serialize current state into a URL query string.
   */
  function serializeUrlState(state) {
    const params = new URLSearchParams();

    if (state.selectedFeature?.type && state.selectedFeature?.id) {
      params.set('v', `${state.selectedFeature.type}:${state.selectedFeature.id}`);
    }

    if (state.camera?.center?.length >= 2 && Number.isFinite(state.camera.zoom)) {
      const lat = state.camera.center[1].toFixed(4).replace(/\.?0+$/, '');
      const lng = state.camera.center[0].toFixed(4).replace(/\.?0+$/, '');
      const z = state.camera.zoom.toFixed(2).replace(/\.?0+$/, '');
      params.set('c', `${lat},${lng},${z}`);
    }

    if (state.projection && state.projection !== 'mercator') {
      params.set('proj', state.projection);
    }

    if (state.basemap && state.basemap !== 'dark') {
      params.set('base', state.basemap);
    }

    if (state.earthquakeRange && state.earthquakeRange !== 'day') {
      params.set('range', state.earthquakeRange);
    }

    // Only serialize non-default layers
    const nonDefault = Object.entries(DEFAULT_STATE.layers).some(([k, v]) => state.layers?.[k] !== v);
    if (nonDefault && state.layers) {
      const active = Object.entries(state.layers)
        .filter(([, on]) => on)
        .map(([k]) => k);
      params.set('layers', active.join(','));
    }

    if (state.historicalQuery?.start && state.historicalQuery?.end) {
      params.set('h_start', state.historicalQuery.start);
      params.set('h_end', state.historicalQuery.end);
      if (state.historicalQuery.minMag) params.set('h_mag', state.historicalQuery.minMag);
      if (state.historicalQuery.radius) params.set('h_radius', state.historicalQuery.radius);
      if (state.historicalQuery.scope) params.set('h_scope', state.historicalQuery.scope);
    }

    const str = params.toString();
    return str ? `?${str}` : '';
  }

  /**
   * Read view state from localStorage and merge with defaults.
   */
  function readSavedState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
      if (!raw) return structuredClone(DEFAULT_STATE);
      return {
        ...structuredClone(DEFAULT_STATE),
        ...raw,
        layers: { ...DEFAULT_STATE.layers, ...(raw.layers || {}) },
        camera: { ...DEFAULT_STATE.camera, ...(raw.camera || {}) }
      };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  /**
   * Save view state to localStorage.
   */
  function saveState(state) {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch {}
  }

  class StateManager {
    constructor() {
      const saved = readSavedState();
      const urlState = parseUrlState();
      this.state = {
        ...saved,
        ...(urlState || {}),
        layers: { ...saved.layers, ...(urlState?.layers || {}) },
        camera: { ...saved.camera, ...(urlState?.camera || {}) }
      };
      this.listeners = new Set();
      this._replaceTimer = null;
      this._setupPopstate();
    }

    get() {
      return this.state;
    }

    update(partial, { saveLocal = true, pushHistory = false, replaceHistory = false } = {}) {
      const prevFeature = this.state.selectedFeature;
      this.state = {
        ...this.state,
        ...partial,
        layers: partial.layers ? { ...this.state.layers, ...partial.layers } : this.state.layers,
        camera: partial.camera ? { ...this.state.camera, ...partial.camera } : this.state.camera
      };

      if (saveLocal) saveState(this.state);

      if (pushHistory) {
        this.pushHistoryState();
      } else if (replaceHistory) {
        this.replaceHistoryState();
      }

      for (const fn of this.listeners) {
        fn(this.state, { prevFeature });
      }
    }

    subscribe(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }

    pushHistoryState() {
      if (typeof window === 'undefined' || !window.history?.pushState) return;
      const url = `${window.location.pathname}${serializeUrlState(this.state)}`;
      window.history.pushState({ ...this.state }, '', url);
    }

    replaceHistoryState() {
      if (typeof window === 'undefined' || !window.history?.replaceState) return;
      const url = `${window.location.pathname}${serializeUrlState(this.state)}`;
      window.history.replaceState({ ...this.state }, '', url);
    }

    debounceReplaceCamera(camera) {
      this.state.camera = camera;
      saveState(this.state);
      clearTimeout(this._replaceTimer);
      this._replaceTimer = setTimeout(() => {
        this.replaceHistoryState();
      }, 400);
    }

    getShareableUrl() {
      if (typeof window === 'undefined') return '';
      return `${window.location.origin}${window.location.pathname}${serializeUrlState(this.state)}`;
    }

    async share(title = 'Open Earth') {
      const url = this.getShareableUrl();
      if (navigator.share) {
        try {
          await navigator.share({ title, url });
          return { method: 'share', success: true };
        } catch (e) {
          if (e.name === 'AbortError') return { method: 'share', success: false, cancelled: true };
        }
      }
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          return { method: 'clipboard', success: true };
        }
      } catch {}
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return { method: 'execCommand', success: true };
      } catch {
        return { method: 'none', success: false };
      }
    }

    _setupPopstate() {
      if (typeof window === 'undefined') return;
      window.addEventListener('popstate', e => {
        const restored = e.state || parseUrlState() || readSavedState();
        this.update(restored, { saveLocal: true, pushHistory: false, replaceHistory: false });
        if (window.OpenEarth?.onStateRestored) {
          window.OpenEarth.onStateRestored(restored);
        }
      });
    }
  }

  const State = {
    DEFAULT_STATE,
    slugify,
    getFeatureIdentity,
    parseUrlState,
    serializeUrlState,
    readSavedState,
    saveState,
    StateManager
  };

  if (typeof window !== 'undefined') {
    window.OpenEarth = window.OpenEarth || {};
    window.OpenEarth.state = State;
    // Backward compatibility globals for P1 helpers
    window.readState = readSavedState;
    window.saveState = () => saveState(window.OpenEarth.appState?.get() || DEFAULT_STATE);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = State;
  }
})();
