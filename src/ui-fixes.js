/* Map lifecycle + selection polish. Kept separate while the V2 branch settles. */
let selectedMapFeature=null;
let selectionPulseFrame=0;

function ensureSelectionLayer(){
  if(!map.getSource('selection')) map.addSource('selection',{type:'geojson',data:empty});
  /* Dark casing keeps the cyan selection legible on light and satellite-like maps. */
  if(!map.getLayer('selection-casing')) map.addLayer({
    id:'selection-casing',type:'circle',source:'selection',
    paint:{
      'circle-radius':14,
      'circle-color':'rgba(0,0,0,0)',
      'circle-stroke-color':'rgba(3,26,34,.82)',
      'circle-stroke-width':6,
      'circle-stroke-opacity':.82
    }
  });
  if(!map.getLayer('selection')) map.addLayer({
    id:'selection',type:'circle',source:'selection',
    paint:{
      'circle-radius':14,
      'circle-color':'rgba(99,215,230,0.10)',
      'circle-stroke-color':'#63d7e6',
      'circle-stroke-width':3,
      'circle-stroke-opacity':1
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
    const radius=12+phase*8;
    map.setPaintProperty('selection','circle-radius',radius);
    map.setPaintProperty('selection','circle-stroke-width',2.5+phase*1.5);
    map.setPaintProperty('selection','circle-stroke-opacity',1-phase*.35);
    map.setPaintProperty('selection','circle-color',`rgba(99,215,230,${.16-phase*.08})`);
    if(map.getLayer('selection-casing')){
      map.setPaintProperty('selection-casing','circle-radius',radius);
      map.setPaintProperty('selection-casing','circle-stroke-width',6+phase*1.5);
      map.setPaintProperty('selection-casing','circle-stroke-opacity',.82-phase*.22);
    }
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

  map.once('style.load',()=>{
    if(token!==styleChangeToken)return;
    try{
      /* diff:false guarantees the old app-owned sources do not survive the
         style swap. addLayers() has an early-return guard on earthquakes, so
         a diffed style could preserve the source while dropping its layers. */
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

  try{map.setStyle(BASEMAPS[name],{diff:false})}
  catch(error){console.error('Basemap change failed',error);finish()}

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
