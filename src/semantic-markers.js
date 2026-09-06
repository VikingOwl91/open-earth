/* Semantic point markers.
 *
 * app.js intentionally owns source creation. This module owns the visual
 * representation of volcano point sources and converts the legacy circle
 * layers into symbol layers only after the sources exist. Keeping this as a
 * final script also makes the invariant survive the existing style-rehydrate
 * compatibility wrappers.
 */
(() => {
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

  const visibility = id => {
    const layer = map.getLayer(id);
    return layer ? (map.getLayoutProperty(id, 'visibility') || 'visible') : 'visible';
  };

  function install() {
    if (!map.isStyleLoaded() || !map.getSource('volcanoes') || !map.getSource('activity')) return false;

    const volcanoVisibility = visibility('volcanoes');
    const activityVisibility = visibility('activity');

    for (const id of ['volcanoes-halo', 'volcanoes', 'activity']) {
      if (map.getLayer(id)) map.removeLayer(id);
    }

    if (!map.hasImage('open-earth-volcano')) {
      map.addImage('open-earth-volcano', makeTriangle('#ff625e', '#fff0e9'), { pixelRatio: 2 });
    }
    if (!map.hasImage('open-earth-activity')) {
      map.addImage('open-earth-activity', makeTriangle('#ff9b45', '#fff0e9'), { pixelRatio: 2 });
    }

    map.addLayer({
      id: 'volcanoes',
      type: 'symbol',
      source: 'volcanoes',
      layout: {
        'icon-image': 'open-earth-volcano',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 0, .75, 4, 1, 8, 1.35],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        visibility: volcanoVisibility
      }
    });

    map.addLayer({
      id: 'activity',
      type: 'symbol',
      source: 'activity',
      layout: {
        'icon-image': 'open-earth-activity',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 1, 4, 1.35, 8, 1.7],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        visibility: activityVisibility
      }
    });

    return true;
  }

  let scheduled = false;
  const scheduleInstall = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      try { install(); }
      catch (error) { console.error('Semantic marker installation failed', error); }
    });
  };

  /* style.load fires before some of the compatibility hydration code has
     recreated Open Earth's sources/layers, so styledata alone is not enough.
     idle is the stable post-hydration boundary. */
  map.on('load', scheduleInstall);
  map.on('style.load', scheduleInstall);
  map.on('idle', () => {
    if (map.getLayer('volcanoes')?.type !== 'symbol' || map.getLayer('activity')?.type !== 'symbol') {
      scheduleInstall();
    }
  });

  /* The script can be evaluated after the initial map load on a fast/cache-hot
     localhost reload. Install immediately when that is the case. */
  if (map.loaded()) scheduleInstall();
})();
