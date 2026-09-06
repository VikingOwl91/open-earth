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
changeBasemap=function(name){
  if(!BASEMAPS[name]||name===viewState.basemap)return;
  const token=++styleChangeToken;
  saveCamera();
  viewState.basemap=name;
  saveState();
  loading(true);
  const camera={...viewState.camera};
  const projection=viewState.projection;
  let settled=false;

  const finish=()=>{
    if(settled||token!==styleChangeToken)return;
    settled=true;
    loading(false);
  };

  /* style.load is the correct point to add application-owned sources/layers.
     Waiting for isStyleLoaded()/idle creates a deadlock: the style is already
     usable here, while glyph/sprite/tile work may still be in flight. */
  map.once('style.load',()=>{
    if(token!==styleChangeToken)return;
    try{
      addLayers();
      setProjection(projection,false);
      map.jumpTo({center:camera.center,zoom:camera.zoom,bearing:camera.bearing,pitch:camera.pitch});
      applyVisibility();
      restoreSelection();
      requestAnimationFrame(()=>requestAnimationFrame(finish));
    }catch(error){
      console.error('Basemap rehydrate failed',error);
      finish();
    }
  });

  try{map.setStyle(BASEMAPS[name])}
  catch(error){console.error('Basemap change failed',error);finish()}

  /* UI safety only; this never gates rehydration. */
  setTimeout(finish,8000);
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
