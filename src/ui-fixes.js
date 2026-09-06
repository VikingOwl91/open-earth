/* Map lifecycle + selection polish. Kept separate while the V2 branch settles. */
let selectedMapFeature=null;
let selectionPulseFrame=0;

function ensureSelectionLayer(){
  if(!map.getSource('selection')) map.addSource('selection',{type:'geojson',data:empty});
  if(!map.getLayer('selection')) map.addLayer({
    id:'selection',type:'circle',source:'selection',
    paint:{
      'circle-radius':14,
      'circle-color':'rgba(99,215,230,0.08)',
      'circle-stroke-color':'#63d7e6',
      'circle-stroke-width':3,
      'circle-stroke-opacity':.95
    }
  });
}

function restoreSelection(){
  ensureSelectionLayer();
  map.getSource('selection')?.setData(selectedMapFeature?.feature||empty);
}

function animateSelection(ts=0){
  if(map.getLayer('selection')&&selectedMapFeature){
    const phase=(Math.sin(ts/360)+1)/2;
    map.setPaintProperty('selection','circle-radius',12+phase*8);
    map.setPaintProperty('selection','circle-stroke-width',2+phase*2);
    map.setPaintProperty('selection','circle-stroke-opacity',.95-phase*.5);
    map.setPaintProperty('selection','circle-color',`rgba(99,215,230,${.12-phase*.08})`);
  }
  selectionPulseFrame=requestAnimationFrame(animateSelection);
}
selectionPulseFrame=requestAnimationFrame(animateSelection);

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
function waitForStyle(token,timeoutMs=10000){
  return new Promise((resolve,reject)=>{
    const started=performance.now();
    const check=()=>{
      if(token!==styleChangeToken)return reject(new Error('superseded style change'));
      try{if(map.isStyleLoaded())return resolve()}catch{}
      if(performance.now()-started>timeoutMs)return reject(new Error('style load timed out'));
      setTimeout(check,50);
    };
    check();
  });
}

changeBasemap=async function(name){
  if(!BASEMAPS[name]||name===viewState.basemap)return;
  const token=++styleChangeToken;
  saveCamera();
  viewState.basemap=name;
  saveState();
  loading(true);
  const camera={...viewState.camera};
  const projection=viewState.projection;

  try{
    map.setStyle(BASEMAPS[name]);
    await waitForStyle(token);
    if(token!==styleChangeToken)return;

    /* setStyle removes all custom sources/layers. Recreate them only after the
       new style is actually complete, then restore view state and selection. */
    addLayers();
    setProjection(projection,false);
    map.jumpTo({center:camera.center,zoom:camera.zoom,bearing:camera.bearing,pitch:camera.pitch});
    applyVisibility();
    restoreSelection();

    /* Give MapLibre one paint frame with the restored overlays before removing
       the transition indicator. */
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  }catch(error){
    if(token===styleChangeToken)console.error('Basemap rehydrate failed',error);
  }finally{
    if(token===styleChangeToken)loading(false);
  }
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
