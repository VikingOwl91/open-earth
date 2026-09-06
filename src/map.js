/**
 * Open Earth - MapLibre Lifecycle, Layer Ownership & Interaction Controller
 * Sole owner of MapLibre map instance, sources, layers, style rehydration,
 * projections, selection highlights, and hover tooltips.
 */
(() => {
  'use strict';

  const BASEMAPS = {
    dark: 'https://tiles.openfreemap.org/styles/dark',
    positron: 'https://tiles.openfreemap.org/styles/positron',
    liberty: 'https://tiles.openfreemap.org/styles/liberty',
    fiord: 'https://tiles.openfreemap.org/styles/fiord',
    classic: 'https://demotiles.maplibre.org/style.json'
  };

  const GEBCO_WMS = 'https://wms.gebco.net/mapserv?service=WMS&version=1.1.1&request=GetMap&layers=gebco_latest_sub_ice_topo&styles=&format=image/png&transparent=true&srs=EPSG:3857&width=512&height=512&bbox={bbox-epsg-3857}';

  const TECTONIC_LAYERS = [
    'tectonic-subduction',
    'tectonic-convergent',
    'tectonic-divergent',
    'tectonic-transform',
    'tectonic-other'
  ];

  const POINT_HOVER_LAYERS = ['activity', 'volcanoes', 'earthquakes'];

  class MapController {
    constructor(containerId, stateManager, dataStore) {
      this.containerId = containerId;
      this.stateManager = stateManager;
      this.dataStore = dataStore;

      const state = stateManager.get();
      this.map = new maplibregl.Map({
        container: containerId,
        style: BASEMAPS[state.basemap] || BASEMAPS.dark,
        center: state.camera.center,
        zoom: state.camera.zoom,
        bearing: state.camera.bearing,
        pitch: state.camera.pitch,
        attributionControl: true
      });

      this.map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

      this.selectedPointFeature = null;
      this.selectedLineFeature = null;
      this.hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
      this.hoverKey = '';
      this.pulseFrame = null;
      this.isRehydrating = false;

      this._init();
    }

    _init() {
      this._createTriangleMarkers();
      this._bindMapEvents();
      this._startPulseAnimation();

      this.map.on('load', () => {
        this.setProjection(this.stateManager.get().projection, false);
        this.rehydrateLayers();
      });
    }

    _createTriangleMarkers() {
      const makeTriangle = (fill, stroke) => {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        ctx.beginPath();
        ctx.moveTo(16, 3);
        ctx.lineTo(29, 27);
        ctx.lineTo(3, 27);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = stroke;
        ctx.stroke();
        return ctx.getImageData(0, 0, size, size);
      };

      if (!this.map.hasImage('open-earth-volcano')) {
        this.map.addImage('open-earth-volcano', makeTriangle('#ff625e', '#fff0e9'), { pixelRatio: 2 });
      }
      if (!this.map.hasImage('open-earth-activity')) {
        this.map.addImage('open-earth-activity', makeTriangle('#ff9b45', '#fff0e9'), { pixelRatio: 2 });
      }
    }

    rehydrateLayers() {
      const state = this.stateManager.get();
      const ds = this.dataStore;

      // 1. GEBCO Bathymetry raster
      if (!this.map.getSource('gebco-bathymetry')) {
        this.map.addSource('gebco-bathymetry', {
          type: 'raster',
          tiles: [GEBCO_WMS],
          tileSize: 512,
          attribution: 'GEBCO Compilation Group (2026)'
        });
      }
      if (!this.map.getLayer('gebco-bathymetry')) {
        this.map.addLayer({
          id: 'gebco-bathymetry',
          type: 'raster',
          source: 'gebco-bathymetry',
          layout: { visibility: state.layers.bathymetry ? 'visible' : 'none' },
          paint: {
            'raster-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.18, 2, 0.24, 4, 0.24, 5.5, 0.18, 6.5, 0.10, 7.5, 0.03, 8, 0],
            'raster-saturation': -0.72,
            'raster-contrast': 0.18,
            'raster-brightness-min': 0.12,
            'raster-brightness-max': 0.72,
            'raster-fade-duration': 180
          }
        });
      }

      // 2. Plate polygons (PB2002)
      if (!this.map.getSource('plate-polygons')) {
        this.map.addSource('plate-polygons', { type: 'geojson', data: ds.platePolygons });
      } else {
        this.map.getSource('plate-polygons').setData(ds.platePolygons);
      }
      if (!this.map.getLayer('plate-polygons')) {
        this.map.addLayer({
          id: 'plate-polygons',
          type: 'fill',
          source: 'plate-polygons',
          layout: { visibility: state.layers.plates ? 'visible' : 'none' },
          paint: { 'fill-color': '#63d7e6', 'fill-opacity': 0.025 }
        });
      }
      if (!this.map.getLayer('plate-polygon-lines')) {
        this.map.addLayer({
          id: 'plate-polygon-lines',
          type: 'line',
          source: 'plate-polygons',
          minzoom: 2,
          layout: { visibility: state.layers.plates ? 'visible' : 'none' },
          paint: { 'line-color': 'rgba(99,215,230,.10)', 'line-width': 0.6 }
        });
      }

      // 3. Plate boundaries & steps (PB2002)
      if (!this.map.getSource('plates')) {
        this.map.addSource('plates', { type: 'geojson', data: ds.plates });
      } else {
        this.map.getSource('plates').setData(ds.plates);
      }
      if (!this.map.getLayer('plates-casing')) {
        this.map.addLayer({
          id: 'plates-casing',
          type: 'line',
          source: 'plates',
          layout: { visibility: state.layers.plates ? 'visible' : 'none' },
          paint: { 'line-color': 'rgba(3,26,34,.5)', 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 3, 6, 5], 'line-opacity': 0.08 }
        });
      }
      if (!this.map.getLayer('plates')) {
        this.map.addLayer({
          id: 'plates',
          type: 'line',
          source: 'plates',
          layout: { visibility: state.layers.plates ? 'visible' : 'none' },
          paint: { 'line-color': '#45d9ec', 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 1.6, 5, 2.5, 9, 3.2], 'line-opacity': 0.10 }
        });
      }

      if (!this.map.getSource('plate-steps')) {
        this.map.addSource('plate-steps', { type: 'geojson', data: ds.plateSteps });
      } else {
        this.map.getSource('plate-steps').setData(ds.plateSteps);
      }
      const specs = [
        ['tectonic-subduction', ['==', ['get', 'Boundary_Family'], 'subduction'], '#ff8b62', 3.2],
        ['tectonic-convergent', ['==', ['get', 'Boundary_Family'], 'convergent'], '#ffbd66', 2.5],
        ['tectonic-divergent', ['==', ['get', 'Boundary_Family'], 'divergent'], '#58d7e7', 2.4],
        ['tectonic-transform', ['==', ['get', 'Boundary_Family'], 'transform'], '#d58cff', 2.2],
        ['tectonic-other', ['==', ['get', 'Boundary_Family'], 'other'], '#8aa4aa', 1.5]
      ];
      for (const [id, filter, color, width] of specs) {
        if (!this.map.getLayer(id)) {
          this.map.addLayer({
            id,
            type: 'line',
            source: 'plate-steps',
            filter,
            layout: { visibility: state.layers.plates ? 'visible' : 'none' },
            paint: {
              'line-color': color,
              'line-width': ['interpolate', ['linear'], ['zoom'], 0, width * 0.55, 5, width, 9, width * 1.35],
              'line-opacity': 0.9
            }
          });
        }
      }

      // 4. Trenches (GEBCO Gazetteer)
      if (!this.map.getSource('trenches')) {
        this.map.addSource('trenches', { type: 'geojson', data: ds.trenches });
      } else {
        this.map.getSource('trenches').setData(ds.trenches);
      }
      if (!this.map.getLayer('trenches-line')) {
        this.map.addLayer({
          id: 'trenches-line',
          type: 'line',
          source: 'trenches',
          filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]],
          layout: { visibility: state.layers.trenches ? 'visible' : 'none' },
          paint: {
            'line-color': '#7dd9e8',
            'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1, 5, 1.8, 8, 2.5],
            'line-opacity': 0.55,
            'line-dasharray': [2, 2]
          }
        });
      }
      if (!this.map.getLayer('trenches-hit')) {
        this.map.addLayer({
          id: 'trenches-hit',
          type: 'line',
          source: 'trenches',
          filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]],
          layout: { visibility: state.layers.trenches ? 'visible' : 'none' },
          paint: { 'line-color': 'rgba(0,0,0,0)', 'line-width': 14 }
        });
      }
      if (!this.map.getLayer('trenches-label')) {
        this.map.addLayer({
          id: 'trenches-label',
          type: 'symbol',
          source: 'trenches',
          minzoom: 3,
          layout: {
            visibility: state.layers.trenches ? 'visible' : 'none',
            'symbol-placement': 'line',
            'text-field': ['coalesce', ['get', 'Name'], 'Trench'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 6, 12, 9, 14],
            'text-letter-spacing': 0.08,
            'text-max-angle': 35
          },
          paint: {
            'text-color': '#a8e8f1',
            'text-halo-color': 'rgba(3,18,25,.9)',
            'text-halo-width': 1.5,
            'text-opacity': 0.85
          }
        });
      }

      // 5. Active Faults (GEM)
      if (!this.map.getSource('faults')) {
        this.map.addSource('faults', { type: 'geojson', data: ds.faults });
      } else {
        this.map.getSource('faults').setData(ds.faults);
      }
      if (!this.map.getLayer('faults')) {
        this.map.addLayer({
          id: 'faults',
          type: 'line',
          source: 'faults',
          layout: { visibility: state.layers.faults ? 'visible' : 'none' },
          paint: {
            'line-color': '#d58cff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.7, 8, 2],
            'line-opacity': 0.75
          }
        });
      }

      // 6. Volcanoes (GVP)
      if (!this.map.getSource('volcanoes')) {
        this.map.addSource('volcanoes', { type: 'geojson', data: ds.volcanoes });
      } else {
        this.map.getSource('volcanoes').setData(ds.volcanoes);
      }
      if (!this.map.getLayer('volcanoes')) {
        this.map.addLayer({
          id: 'volcanoes',
          type: 'symbol',
          source: 'volcanoes',
          layout: {
            'icon-image': 'open-earth-volcano',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.75, 4, 1, 8, 1.35],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            visibility: state.layers.volcanoes ? 'visible' : 'none'
          }
        });
      }

      // 7. Volcanic Reports (GVP WVAR)
      if (!this.map.getSource('activity')) {
        this.map.addSource('activity', { type: 'geojson', data: ds.activity });
      } else {
        this.map.getSource('activity').setData(ds.activity);
      }
      if (!this.map.getLayer('activity')) {
        this.map.addLayer({
          id: 'activity',
          type: 'symbol',
          source: 'activity',
          layout: {
            'icon-image': 'open-earth-activity',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 1, 4, 1.35, 8, 1.7],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            visibility: state.layers.activity ? 'visible' : 'none'
          }
        });
      }

      // 8. Earthquakes (USGS)
      if (!this.map.getSource('earthquakes')) {
        this.map.addSource('earthquakes', { type: 'geojson', data: ds.earthquakes });
      } else {
        this.map.getSource('earthquakes').setData(ds.earthquakes);
      }
      if (!this.map.getLayer('earthquakes')) {
        this.map.addLayer({
          id: 'earthquakes',
          type: 'circle',
          source: 'earthquakes',
          layout: { visibility: state.layers.earthquakes ? 'visible' : 'none' },
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['coalesce', ['get', 'mag'], 0], 0, 4, 4, 7, 7, 13],
            'circle-color': ['interpolate', ['linear'], ['coalesce', ['get', 'mag'], 0], 0, '#ffe06b', 4, '#ffb347', 6, '#ff5c57'],
            'circle-stroke-color': '#fff5c2',
            'circle-stroke-width': 1,
            'circle-opacity': 0.9
          }
        });
      }

      // 9. Selection Layers
      // Point selection (pulsing circle)
      if (!this.map.getSource('selection')) {
        this.map.addSource('selection', { type: 'geojson', data: this.selectedPointFeature || ds.EMPTY });
      } else {
        this.map.getSource('selection').setData(this.selectedPointFeature || ds.EMPTY);
      }
      if (!this.map.getLayer('selection-casing')) {
        this.map.addLayer({
          id: 'selection-casing',
          type: 'circle',
          source: 'selection',
          paint: {
            'circle-radius': 14,
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-color': 'rgba(3,26,34,.82)',
            'circle-stroke-width': 6,
            'circle-stroke-opacity': 0.82
          }
        });
      }
      if (!this.map.getLayer('selection')) {
        this.map.addLayer({
          id: 'selection',
          type: 'circle',
          source: 'selection',
          paint: {
            'circle-radius': 14,
            'circle-color': 'rgba(99,215,230,.10)',
            'circle-stroke-color': '#63d7e6',
            'circle-stroke-width': 3,
            'circle-stroke-opacity': 1
          }
        });
      }

      // Line selection (crisp white line + casing)
      if (!this.map.getSource('line-selection')) {
        this.map.addSource('line-selection', { type: 'geojson', data: this.selectedLineFeature || ds.EMPTY });
      } else {
        this.map.getSource('line-selection').setData(this.selectedLineFeature || ds.EMPTY);
      }
      if (!this.map.getLayer('line-selection-casing')) {
        this.map.addLayer({
          id: 'line-selection-casing',
          type: 'line',
          source: 'line-selection',
          paint: {
            'line-color': '#031a22',
            'line-width': ['interpolate', ['linear'], ['zoom'], 0, 6, 6, 9, 10, 13],
            'line-opacity': 0.9
          }
        });
      }
      if (!this.map.getLayer('line-selection')) {
        this.map.addLayer({
          id: 'line-selection',
          type: 'line',
          source: 'line-selection',
          paint: {
            'line-color': '#f4fbff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 0, 3, 6, 5, 10, 7],
            'line-opacity': 1
          }
        });
      }

      // 10. Hover Layers (preview)
      if (!this.map.getSource('hover-point')) {
        this.map.addSource('hover-point', { type: 'geojson', data: ds.EMPTY });
      }
      if (!this.map.getLayer('hover-point')) {
        this.map.addLayer({
          id: 'hover-point',
          type: 'circle',
          source: 'hover-point',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 9, 6, 14, 10, 19],
            'circle-color': ['coalesce', ['get', 'Hover_Fill'], 'rgba(99,215,230,.10)'],
            'circle-stroke-color': ['coalesce', ['get', 'Hover_Color'], '#63d7e6'],
            'circle-stroke-width': 3,
            'circle-opacity': 0.95
          }
        });
      }

      if (!this.map.getSource('hover-line')) {
        this.map.addSource('hover-line', { type: 'geojson', data: ds.EMPTY });
      }
      if (!this.map.getLayer('hover-line-casing')) {
        this.map.addLayer({
          id: 'hover-line-casing',
          type: 'line',
          source: 'hover-line',
          paint: { 'line-color': '#031a22', 'line-width': 8, 'line-opacity': 0.65 }
        });
      }
      if (!this.map.getLayer('hover-line')) {
        this.map.addLayer({
          id: 'hover-line',
          type: 'line',
          source: 'hover-line',
          paint: {
            'line-color': ['coalesce', ['get', 'Hover_Color'], '#f4fbff'],
            'line-width': 4,
            'line-opacity': 0.95
          }
        });
      }

      this.applyVisibility();
    }

    applyVisibility() {
      const layers = this.stateManager.get().layers;
      const setVis = (id, on) => {
        if (this.map.getLayer(id)) {
          this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
        }
      };

      setVis('earthquakes', layers.earthquakes);
      setVis('activity', layers.activity);
      setVis('volcanoes', layers.volcanoes);
      setVis('plates', layers.plates);
      setVis('plates-casing', layers.plates);
      setVis('plate-polygons', layers.plates);
      setVis('plate-polygon-lines', layers.plates);
      for (const id of TECTONIC_LAYERS) setVis(id, layers.plates);

      setVis('trenches-line', layers.trenches);
      setVis('trenches-hit', layers.trenches);
      setVis('trenches-label', layers.trenches);

      setVis('faults', layers.faults);
      setVis('gebco-bathymetry', layers.bathymetry);
    }

    setProjection(mode, persist = true) {
      mode = mode === 'globe' ? 'globe' : 'mercator';
      if (this.map.setProjection) {
        this.map.setProjection({ type: mode });
      }
      if (persist) {
        this.stateManager.update({ projection: mode }, { pushHistory: false, replaceHistory: true });
      }
      const note = document.querySelector('#projection-note');
      if (note) {
        note.textContent = mode === 'globe'
          ? 'Globe uses MapLibre’s native spherical projection.'
          : 'Classic Web Mercator projection.';
      }
      const sel = document.querySelector('#projection');
      if (sel) sel.value = mode;
    }

    changeBasemap(name) {
      if (!BASEMAPS[name]) return;
      const current = this.stateManager.get().basemap;
      if (name === current && !this.isRehydrating) return;

      this.isRehydrating = true;
      this.stateManager.update({ basemap: name }, { pushHistory: false, replaceHistory: true });

      const loadingEl = document.querySelector('#map-loading');
      if (loadingEl) loadingEl.hidden = false;

      const finish = () => {
        if (loadingEl) loadingEl.hidden = true;
        this.isRehydrating = false;
      };

      this.map.once('style.load', () => {
        this._createTriangleMarkers();
        this.setProjection(this.stateManager.get().projection, false);
        this.rehydrateLayers();
        if (this.selectedLineFeature) {
          this.map.getSource('line-selection')?.setData(this.selectedLineFeature);
        }
        if (this.selectedPointFeature) {
          this.map.getSource('selection')?.setData(this.selectedPointFeature);
        }
        finish();
      });

      setTimeout(finish, 6000);
      this.map.setStyle(BASEMAPS[name], { diff: false });
    }

    selectFeature(layer, feature) {
      if (!feature) {
        this.clearSelection();
        return;
      }

      const isLine = feature.geometry?.type === 'LineString' || feature.geometry?.type === 'MultiLineString';

      if (isLine) {
        this.selectedPointFeature = null;
        this.selectedLineFeature = {
          type: 'Feature',
          properties: { ...(feature.properties || {}) },
          geometry: feature.geometry
        };
        this.map.getSource('selection')?.setData(this.dataStore.EMPTY);
        this.map.getSource('line-selection')?.setData(this.selectedLineFeature);
      } else {
        this.selectedLineFeature = null;
        this.selectedPointFeature = {
          type: 'Feature',
          properties: { ...(feature.properties || {}) },
          geometry: feature.geometry
        };
        this.map.getSource('line-selection')?.setData(this.dataStore.EMPTY);
        this.map.getSource('selection')?.setData(this.selectedPointFeature);
      }

      const identity = window.OpenEarth.state.getFeatureIdentity(layer, feature);
      this.stateManager.update({ selectedFeature: identity }, { pushHistory: true });
    }

    clearSelection() {
      this.selectedPointFeature = null;
      this.selectedLineFeature = null;
      this.map.getSource('selection')?.setData(this.dataStore.EMPTY);
      this.map.getSource('line-selection')?.setData(this.dataStore.EMPTY);
      this.stateManager.update({ selectedFeature: null }, { pushHistory: false, replaceHistory: true });
    }

    _startPulseAnimation() {
      const animate = ts => {
        if (this.selectedPointFeature && this.map.getLayer('selection')) {
          const p = (Math.sin(ts / 360) + 1) / 2;
          const r = 12 + p * 8;
          this.map.setPaintProperty('selection', 'circle-radius', r);
          this.map.setPaintProperty('selection', 'circle-stroke-width', 2.5 + p * 1.5);
          this.map.setPaintProperty('selection', 'circle-stroke-opacity', 1 - p * 0.35);
          if (this.map.getLayer('selection-casing')) {
            this.map.setPaintProperty('selection-casing', 'circle-radius', r);
          }
        }
        this.pulseFrame = requestAnimationFrame(animate);
      };
      this.pulseFrame = requestAnimationFrame(animate);
    }

    _bindMapEvents() {
      // Camera changes
      this.map.on('moveend', () => {
        const c = this.map.getCenter();
        const camera = {
          center: [c.lng, c.lat],
          zoom: this.map.getZoom(),
          bearing: this.map.getBearing(),
          pitch: this.map.getPitch()
        };
        this.stateManager.debounceReplaceCamera(camera);
      });

      // Hover
      this.map.on('mousemove', e => this._onMouseMove(e));
      this.map.on('mouseout', () => this._onMouseOut());

      // Click features
      const clickLayers = ['earthquakes', 'volcanoes', 'activity', 'trenches-hit', ...TECTONIC_LAYERS];
      for (const id of clickLayers) {
        this.map.on('click', id, e => {
          const f = e.features?.[0];
          if (!f) return;
          let layer = id;
          if (id === 'trenches-hit') layer = 'trenches';
          else if (TECTONIC_LAYERS.includes(id)) layer = 'plates';
          if (window.OpenEarth?.inspector) {
            window.OpenEarth.inspector.inspect(layer, f);
          }
        });
      }

      // Faults click
      this.map.on('click', e => {
        if (this.stateManager.get().layers.faults && this.map.getLayer('faults')) {
          const direct = this.map.queryRenderedFeatures(e.point, { layers: ['faults'] });
          if (direct.length && window.OpenEarth?.inspector) {
            window.OpenEarth.inspector.inspect('faults', direct[0]);
          }
        }
      });
    }

    _onMouseMove(e) {
      const state = this.stateManager.get();
      const pointLayers = POINT_HOVER_LAYERS.filter(id => this.map.getLayer(id) && this.map.getLayoutProperty(id, 'visibility') !== 'none');
      const pointHits = pointLayers.length ? this.map.queryRenderedFeatures(e.point, { layers: pointLayers }) : [];

      let hit = null;
      let kind = null;

      if (pointHits.length) {
        const priority = { activity: 0, volcanoes: 1, earthquakes: 2 };
        pointHits.sort((a, b) => (priority[a.layer.id] ?? 9) - (priority[b.layer.id] ?? 9));
        hit = pointHits[0];
        kind = hit.layer.id;
      } else {
        // Line features
        const visibleTectonic = TECTONIC_LAYERS.filter(id => this.map.getLayer(id) && this.map.getLayoutProperty(id, 'visibility') !== 'none');
        const tectonicHit = visibleTectonic.length ? this.map.queryRenderedFeatures(e.point, { layers: visibleTectonic })[0] : null;

        const trenchHit = state.layers.trenches && this.map.getLayer('trenches-hit')
          ? this.map.queryRenderedFeatures(e.point, { layers: ['trenches-hit'] })[0]
          : null;

        const faultHit = state.layers.faults && this.map.getLayer('faults')
          ? this.map.queryRenderedFeatures(e.point, { layers: ['faults'] })[0]
          : null;

        hit = trenchHit || tectonicHit || faultHit;
        if (trenchHit) kind = 'trench';
        else if (tectonicHit) kind = 'tectonic';
        else if (faultHit) kind = 'fault';
      }

      if (!hit) {
        this.hoverKey = '';
        this.hoverPopup.remove();
        this._setHoverGeometry(null);
        this.map.getCanvas().style.cursor = '';
        return;
      }

      this.map.getCanvas().style.cursor = 'pointer';
      this._setHoverGeometry(hit, kind);

      const p = hit.properties || {};
      const key = `${kind}:${p.id || p.code || p.Volcano_Number || p.Volcano_Name || p.Boundary_Code || p.STEPCLASS || p.Name || p.name || p.place || 'feature'}`;
      if (key !== this.hoverKey) {
        this.hoverKey = key;
        this.hoverPopup.setHTML(this._tooltipFor(hit, kind));
      }
      this.hoverPopup.setLngLat(e.lngLat).addTo(this.map);
    }

    _onMouseOut() {
      this.hoverKey = '';
      this.hoverPopup.remove();
      this._setHoverGeometry(null);
      this.map.getCanvas().style.cursor = '';
    }

    _setHoverGeometry(hit, kind) {
      const pointSource = this.map.getSource('hover-point');
      const lineSource = this.map.getSource('hover-line');
      if (!hit) {
        pointSource?.setData(this.dataStore.EMPTY);
        lineSource?.setData(this.dataStore.EMPTY);
        return;
      }

      const [color, fill] = this._hoverColors(kind, hit);
      const feature = {
        type: 'Feature',
        properties: { ...(hit.properties || {}), Hover_Color: color, Hover_Fill: fill },
        geometry: hit.geometry
      };

      if (hit.geometry?.type === 'Point') {
        pointSource?.setData(feature);
        lineSource?.setData(this.dataStore.EMPTY);
      } else {
        lineSource?.setData(feature);
        pointSource?.setData(this.dataStore.EMPTY);
      }
    }

    _hoverColors(kind, f) {
      if (kind === 'activity') return ['#ff9b45', 'rgba(255,155,69,.18)'];
      if (kind === 'volcanoes') {
        const p = f.properties || {};
        const active = this.dataStore.activity.features.some(x =>
          (p.Volcano_Number && x.properties?.Volcano_Number === p.Volcano_Number) ||
          (p.Volcano_Name && x.properties?.Report_Name === p.Volcano_Name)
        );
        return active ? ['#ff9b45', 'rgba(255,155,69,.18)'] : ['#ff625e', 'rgba(255,98,94,.14)'];
      }
      if (kind === 'earthquakes') return ['#ffe06b', 'rgba(255,224,107,.15)'];
      if (kind === 'fault') return ['#d58cff', 'rgba(213,140,255,.12)'];
      if (kind === 'trench') return ['#7dd9e8', 'rgba(125,217,232,.15)'];

      const p = f.properties || {};
      const family = p.Boundary_Family;
      const colors = { subduction: '#ff8b62', convergent: '#ffbd66', divergent: '#58d7e7', transform: '#d58cff' };
      return [colors[family] || '#f4fbff', 'rgba(244,251,255,.08)'];
    }

    _tooltipFor(f, kind) {
      const p = f.properties || {};
      const esc = window.OpenEarth?.geo?.esc || (s => s);
      const val = window.OpenEarth?.geo?.value || ((...xs) => xs[0]);

      if (kind === 'tectonic') {
        const code = val(p.Boundary_Code, p.STEPCLASS);
        const meta = window.OpenEarth?.geo?.STEP_META?.[code] || { label: 'Plate boundary' };
        const pair = val(p.Plate_Pair, p.PLATEBOUND);
        const v = Number(p.VELOCITYLE);
        return `<strong>${esc(val(p.Boundary_Label, meta.label))}</strong>${pair ? `<br>${esc(pair)}` : ''}${Number.isFinite(v) ? `<br>${v.toFixed(1)} mm/yr relative velocity` : ''}<br><small>PB2002 · click for details</small>`;
      }
      if (kind === 'trench') {
        const name = p.Name || 'Undersea Trench';
        return `<strong>${esc(name)} Trench</strong><br>GEBCO Gazetteer undersea feature<br><small>Click for details</small>`;
      }
      if (kind === 'fault') {
        return `<strong>${esc(val(p.name, p.Name, p.fault_name, 'Mapped active fault'))}</strong>${val(p.slip_type, p.slip_type_text, p.sense) ? `<br>${esc(val(p.slip_type, p.slip_type_text, p.sense))}` : ''}<br><small>GEM active fault · click for details</small>`;
      }
      if (kind === 'earthquakes') {
        return `<strong>M ${esc(val(p.mag, '?'))}</strong><br>${esc(val(p.place, 'Earthquake'))}<br><small>${this.dataStore.historicalMode ? 'USGS historical catalog' : 'USGS live feed'} · click for details</small>`;
      }
      if (kind === 'activity') {
        return `<strong>Weekly volcanic report</strong><br>${esc(val(p.Volcano_Name, p.Report_Name, 'Volcano'))}<br><small>Smithsonian / USGS · click for report</small>`;
      }
      return `<strong>${esc(val(p.Volcano_Name, p.VolcanoName, 'Known volcano'))}</strong>${val(p.Country) ? `<br>${esc(p.Country)}` : ''}<br><small>Smithsonian GVP catalog · click for details</small>`;
    }
  }

  const MapModule = {
    BASEMAPS,
    TECTONIC_LAYERS,
    POINT_HOVER_LAYERS,
    MapController
  };

  if (typeof window !== 'undefined') {
    window.OpenEarth = window.OpenEarth || {};
    window.OpenEarth.mapModule = MapModule;
    window.BASEMAPS = BASEMAPS;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapModule;
  }
})();
