/* Transitional UI/lifecycle fixes kept separate so the map state remains inspectable. */
let selectedMapFeature=null;

function ensureSelectionLayer(){
  if(!map.getSource('selection')) map.addSource('selection',{type:'geojson',data:empty});
  if(!map.getLayer('selection')) map.addLayer({
    id:'selection',type:'circle',source:'selection',
    paint:{
      'circle-radius':['interpolate',['linear'],['zoom'],0,8,5,13,9,18],
      'circle-color':'rgba(255,255,255,0)',
      'circle-stroke-color':'#ffffff',
      'circle-stroke-width':3,
      'circle-opacity':1
    }
  });
}

function restoreSelection(){
  ensureSelectionLayer();
  map.getSource('selection')?.setData(selectedMapFeature?.feature||empty);
}

const originalAddLayers=addLayers;
addLayers=function(){
  originalAddLayers();
  restoreSelection();
};

selectFeature=function(layer,f){
  selectedMapFeature={layer,feature:{type:'Feature',properties:{...(f.properties||{})},geometry:f.geometry}};
  restoreSelection();
  detail(layer,f);
};

document.querySelector('#details-close').addEventListener('click',()=>{
  selectedMapFeature=null;
  map.getSource('selection')?.setData(empty);
});

let styleChangeToken=0;
changeBasemap=function(name){
  if(!BASEMAPS[name]||name===viewState.basemap)return;
  const token=++styleChangeToken;
  saveCamera();
  viewState.basemap=name;
  saveState();
  loading(true);
  const camera={...viewState.camera};
  const projection=viewState.projection;

  map.once('style.load',()=>{
    if(token!==styleChangeToken)return;
    try{
      addLayers();
      setProjection(projection,false);
      map.jumpTo({center:camera.center,zoom:camera.zoom,bearing:camera.bearing,pitch:camera.pitch});
      applyVisibility();
      restoreSelection();
    }finally{
      requestAnimationFrame(()=>loading(false));
    }
  });
  map.setStyle(BASEMAPS[name]);
};

/* Search-result selection should use the same visual selection path. */
document.querySelector('#search-results').addEventListener('click',()=>{
  setTimeout(()=>{
    const name=document.querySelector('#search')?.value;
    if(!name)return;
    const f=volcanoData.features?.find(v=>norm(v.properties?.Volcano_Name)===norm(name));
    if(f)selectFeature('volcanoes',f);
  },550);
});

/* Safety valve: a failed style request must never leave the UI blocked forever. */
map.on('error',()=>loading(false));
