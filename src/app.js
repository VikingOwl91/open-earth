/**
 * Open Earth - Main Application Orchestrator
 * Integrates state, data store, map controller, feature inspector, search, and modals.
 */
(() => {
  'use strict';

  async function init() {
    const detailsPanel = document.querySelector('#details');
    const detailsBody = document.querySelector('#details-body');
    const searchInput = document.querySelector('#search');
    const searchResults = document.querySelector('#search-results');

    // 1. Initialize State
    const stateManager = new window.OpenEarth.state.StateManager();
    window.OpenEarth.appState = stateManager;

    // 2. Data Store
    const dataStore = window.OpenEarth.dataStore;

    // 3. Map Controller
    const mapController = new window.OpenEarth.mapModule.MapController('map', stateManager, dataStore);
    window.OpenEarth.mapController = mapController;
    window.map = mapController.map; // Backward compatibility

    // 4. Feature Inspector
    const inspector = new window.OpenEarth.inspectorModule.InspectorController(
      detailsPanel,
      detailsBody,
      stateManager,
      dataStore,
      mapController
    );
    window.OpenEarth.inspector = inspector;

    // 5. Search Controller
    const searchController = new window.OpenEarth.searchModule.SearchController(
      searchInput,
      searchResults,
      stateManager,
      dataStore,
      mapController,
      inspector
    );
    window.OpenEarth.searchController = searchController;

    // 6. UI Controls Binding
    syncControls(stateManager.get());
    wireControls(stateManager, mapController, dataStore, inspector);

    // 7. Subscribe to State Changes (Popstate Back/Forward Restoration)
    window.OpenEarth.onStateRestored = restoredState => {
      syncControls(restoredState);
      mapController.applyVisibility();
      mapController.setProjection(restoredState.projection, false);
      if (restoredState.basemap !== mapController.stateManager.get().basemap) {
        mapController.changeBasemap(restoredState.basemap);
      }
      if (restoredState.selectedFeature) {
        restoreSelectedFeature(restoredState.selectedFeature, dataStore, inspector);
      } else {
        inspector.close();
      }
    };

    // 8. Bootstrap Data Pipeline
    try {
      await dataStore.loadManifest();
      window.setStatus();

      const state = stateManager.get();
      const loadTasks = [
        dataStore.loadEarthquakes(state.earthquakeRange),
        dataStore.loadVolcanoes(),
        dataStore.loadActivity(),
        dataStore.loadPlates(),
        dataStore.loadTectonics(),
        dataStore.loadTrenches()
      ];

      if (state.layers.faults) {
        loadTasks.push(dataStore.loadFaults());
      }

      await Promise.all(loadTasks);

      // Rehydrate all layers on the map
      mapController.rehydrateLayers();

      // Update layer counts in sidebar
      updateLayerCounts(dataStore);
      window.setStatus();

      // Check for deep-linked feature in URL
      if (state.selectedFeature) {
        restoreSelectedFeature(state.selectedFeature, dataStore, inspector);
      }
    } catch (e) {
      console.error('[OpenEarth] Bootstrap error:', e);
    }
  }

  function restoreSelectedFeature(identity, dataStore, inspector) {
    if (!identity?.type || !identity?.id) return;
    const { type, id } = identity;

    let feature = null;
    let layer = null;

    if (type === 'volcano') {
      feature = dataStore.findVolcano(id);
      layer = 'volcanoes';
    } else if (type === 'earthquake') {
      feature = dataStore.findEarthquake(id);
      layer = 'earthquakes';
    } else if (type === 'trench') {
      feature = dataStore.findTrench(id);
      layer = 'trenches';
    } else if (type === 'fault') {
      feature = dataStore.findFault(id);
      layer = 'faults';
    } else if (type === 'boundary') {
      feature = dataStore.findBoundary(id);
      layer = 'plates';
    }

    if (feature && layer) {
      inspector.inspect(layer, feature, 'overview', false);
    }
  }

  function syncControls(state) {
    const baseSel = document.querySelector('#basemap');
    if (baseSel) baseSel.value = state.basemap || 'dark';

    const projSel = document.querySelector('#projection');
    if (projSel) projSel.value = state.projection || 'mercator';

    for (const [id, on] of Object.entries(state.layers || {})) {
      const el = document.querySelector(`#${id}`);
      if (el) el.checked = on;
    }

    document.querySelectorAll('#range button').forEach(b => {
      b.classList.toggle('active', b.dataset.range === state.earthquakeRange);
    });
  }

  function updateLayerCounts(ds) {
    const qEl = document.querySelector('#quake-count');
    if (qEl) qEl.textContent = ds.earthquakes?.features?.length ?? '0';

    const vEl = document.querySelector('#volcano-count');
    if (vEl) vEl.textContent = ds.volcanoes?.features?.length ?? '0';

    const aEl = document.querySelector('#activity-count');
    if (aEl) aEl.textContent = ds.activity?.features?.length ?? '0';

    const tEl = document.querySelector('#trench-count');
    if (tEl) tEl.textContent = ds.trenches?.features?.length ?? '0';

    const fEl = document.querySelector('#fault-count');
    if (fEl) fEl.textContent = ds.faults?.features?.length ? ds.faults.features.length : (ds.faults?.features ? 'off' : '…');
  }

  function wireControls(stateManager, mapController, dataStore, inspector) {
    // Layer checkboxes
    const layerIds = ['earthquakes', 'activity', 'volcanoes', 'plates', 'trenches', 'faults', 'bathymetry'];
    for (const id of layerIds) {
      const el = document.querySelector(`#${id}`);
      if (el) {
        el.addEventListener('change', async e => {
          const checked = e.target.checked;
          const currentLayers = { ...stateManager.get().layers, [id]: checked };
          stateManager.update({ layers: currentLayers }, { pushHistory: false, replaceHistory: true });

          if (id === 'faults' && checked && !dataStore.faults.features.length) {
            const fCount = document.querySelector('#fault-count');
            if (fCount) fCount.textContent = '…';
            await dataStore.loadFaults();
            mapController.rehydrateLayers();
            if (fCount) fCount.textContent = dataStore.faults.features.length;
          }

          mapController.applyVisibility();
        });
      }
    }

    // Earthquake range pills (1h, 24h, 7d)
    const rangeContainer = document.querySelector('#range');
    if (rangeContainer) {
      rangeContainer.addEventListener('click', async e => {
        const r = e.target.dataset.range;
        if (!r) return;
        document.querySelectorAll('#range button').forEach(b => b.classList.toggle('active', b === e.target));
        stateManager.update({ earthquakeRange: r }, { pushHistory: false, replaceHistory: true });
        await dataStore.loadEarthquakes(r);
        mapController.rehydrateLayers();
        const qEl = document.querySelector('#quake-count');
        if (qEl) qEl.textContent = dataStore.earthquakes.features?.length ?? '0';
      });
    }

    // Projection dropdown
    const projSel = document.querySelector('#projection');
    if (projSel) {
      projSel.addEventListener('change', e => {
        mapController.setProjection(e.target.value);
      });
    }

    // Basemap dropdown
    const baseSel = document.querySelector('#basemap');
    if (baseSel) {
      baseSel.addEventListener('change', e => {
        mapController.changeBasemap(e.target.value);
      });
    }

    // Reset view button
    const resetBtn = document.querySelector('#reset-view');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        localStorage.removeItem('open-earth:view:v1');
        window.location.href = window.location.pathname;
      });
    }

    // Modals triggers
    document.querySelector('#open-about')?.addEventListener('click', () => {
      window.OpenEarth.modalController?.open('about');
    });
    document.querySelector('#open-imprint')?.addEventListener('click', () => {
      window.OpenEarth.modalController?.open('imprint');
    });
    document.querySelector('#open-privacy')?.addEventListener('click', () => {
      window.OpenEarth.modalController?.open('privacy');
    });
  }

  // Self-start on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
