/* P1 bathymetry: optional GEBCO 2026 shaded-relief context below Open Earth geology. */
(() => {
  const SOURCE_ID='gebco-bathymetry';
  const LAYER_ID='gebco-bathymetry';
  const WMS='https://wms.gebco.net/mapserv?service=WMS&version=1.1.1&request=GetMap&layers=gebco_latest_sub_ice_topo&styles=&format=image/png&transparent=true&srs=EPSG:3857&width=512&height=512&bbox={bbox-epsg-3857}';

  function enabled(){
    if(typeof viewState!=='undefined'&&viewState?.layers?.bathymetry!==undefined){
      return viewState.layers.bathymetry===true;
    }
    return document.querySelector('#bathymetry')?.checked ?? false;
  }
  function firstOverlay(){
    const overlays=['earthquakes','volcanoes-halo','volcanoes','activity','plates-casing','plates','plate-polygons','plate-polygon-lines','tectonic-subduction','tectonic-convergent','tectonic-divergent','tectonic-transform','faults','trenches-line'];
    const layers=map.getStyle()?.layers||[];
    for(const l of layers){
      if(overlays.includes(l.id))return l.id;
    }
    return undefined;
  }
  function install(){
    if(!map?.getStyle?.())return;
    if(!map.getSource(SOURCE_ID))map.addSource(SOURCE_ID,{type:'raster',tiles:[WMS],tileSize:512,attribution:'GEBCO Compilation Group (2026)'});
    if(!map.getLayer(LAYER_ID))map.addLayer({id:LAYER_ID,type:'raster',source:SOURCE_ID,layout:{visibility:enabled()?'visible':'none'},paint:{
      'raster-opacity':['interpolate',['linear'],['zoom'],0,0.18,2,0.24,4,0.24,5.5,0.18,6.5,0.10,7.5,0.03,8,0],
      'raster-saturation':-0.72,
      'raster-contrast':0.18,
      'raster-brightness-min':0.12,
      'raster-brightness-max':0.72,
      'raster-fade-duration':180
    }},firstOverlay());
    else map.setLayoutProperty(LAYER_ID,'visibility',enabled()?'visible':'none');
  }
  function sync(){try{install()}catch(e){console.warn('GEBCO bathymetry setup failed',e)}}

  document.querySelector('#bathymetry')?.addEventListener('change',e=>{
    if(typeof viewState!=='undefined'&&viewState?.layers){
      viewState.layers.bathymetry=e.target.checked;
      if(typeof saveState==='function')saveState();
    }
    sync();
  });
  const addLayersBeforeBathymetry = typeof addLayers === 'function' ? addLayers : null;
  if (addLayersBeforeBathymetry) {
    addLayers = function() {
      addLayersBeforeBathymetry();
      sync();
    };
  }
  map.on('load',()=>setTimeout(sync,0));
  map.on('style.load',()=>setTimeout(sync,0));
  map.on('idle',()=>{if(enabled()&&!map.getLayer(LAYER_ID))sync()});
})();
