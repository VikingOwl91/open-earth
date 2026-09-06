/* P1 trenches: named seafloor features from the IHO-IOC GEBCO Gazetteer. */
(() => {
  let trenchData={type:'FeatureCollection',features:[]},selected=null,activeTab='overview';
  const SOURCE='trenches', LINE='trenches-line', LABEL='trenches-label', HIT='trenches-hit', SELECT='trench-selection';
  const nameOf=f=>{const n=String(value(f?.properties?.Name,f?.properties?.name,'')).trim(),g=String(value(f?.properties?.Generic,f?.properties?.generic,'Trench')).trim();if(!n)return g||'Named trench';return new RegExp(`\\b${g}$`,'i').test(n)?n:`${n} ${g}`};
  const genericOf=f=>value(f?.properties?.Generic,f?.properties?.generic,'Trench');
  function enabled(){return typeof viewState!=='undefined'&&viewState?.layers?.trenches!==undefined?viewState.layers.trenches!==false:(document.querySelector('#trenches')?.checked ?? true)}
  function install(){
    if(!map?.getStyle?.())return;
    try {
      if(!map.getSource(SOURCE))map.addSource(SOURCE,{type:'geojson',data:trenchData});
      const before=['tectonic-subduction','tectonic-convergent','faults','earthquakes','volcanoes','activity'].find(id=>map.getLayer(id));
      if(!map.getLayer(LINE))map.addLayer({id:LINE,type:'line',source:SOURCE,filter:['in',['geometry-type'],['literal',['LineString','MultiLineString']]],layout:{visibility:enabled()?'visible':'none'},paint:{'line-color':'#7dd9e8','line-width':['interpolate',['linear'],['zoom'],1,1,5,1.8,8,2.5],'line-opacity':.55,'line-dasharray':[2,2]}},before);
      if(!map.getLayer(HIT))map.addLayer({id:HIT,type:'line',source:SOURCE,filter:['in',['geometry-type'],['literal',['LineString','MultiLineString']]],layout:{visibility:enabled()?'visible':'none'},paint:{'line-color':'rgba(0,0,0,0)','line-width':14}},before);
      if(!map.getLayer(LABEL))map.addLayer({id:LABEL,type:'symbol',source:SOURCE,minzoom:3,layout:{visibility:enabled()?'visible':'none','symbol-placement':'line','text-field':['coalesce',['get','Name'],'Trench'],'text-size':['interpolate',['linear'],['zoom'],3,10,6,12,9,14],'text-letter-spacing':.08,'text-max-angle':35},paint:{'text-color':'#a8e8f1','text-halo-color':'rgba(3,18,25,.9)','text-halo-width':1.5,'text-opacity':.85}},before);
      if(!map.getSource(SELECT))map.addSource(SELECT,{type:'geojson',data:selected||{type:'FeatureCollection',features:[]}});
      if(!map.getLayer(SELECT))map.addLayer({id:SELECT,type:'line',source:SELECT,layout:{visibility:enabled()?'visible':'none'},paint:{'line-color':'#f4fbff','line-width':['interpolate',['linear'],['zoom'],2,3,7,6],'line-opacity':1}},before);
      for(const id of [LINE,HIT,LABEL,SELECT])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',enabled()?'visible':'none');
    } catch(e) {
      console.warn('trenches install error', e);
      window.installError = e.message;
    }
  }
  async function load(){
    const d=await localSnapshot('trenches.json','trenches');
    trenchData=d?.features?d:{type:'FeatureCollection',features:[]};
    window.trenchData=trenchData;
    install();map.getSource(SOURCE)?.setData(trenchData);
    const count=document.querySelector('#trench-count');if(count)count.textContent=trenchData.features.length||'0';
  }
  function centerOfGeometry(g){
    const pts=[];const walk=x=>Array.isArray(x)&&typeof x[0]==='number'?pts.push(x):Array.isArray(x)&&x.forEach(walk);walk(g?.coordinates);
    if(!pts.length)return null;return [pts.reduce((s,p)=>s+p[0],0)/pts.length,pts.reduce((s,p)=>s+p[1],0)/pts.length];
  }
  window.trenchData=trenchData;
  window.showTrenchDetail=(f,tab='overview')=>render(f,tab);
  window.nearestTrench=coords=>(trenchData.features.length&&typeof nearestLine==='function'?nearestLine(coords,trenchData):null);
  window.trenchCenter=centerOfGeometry;
  window.trenchName=nameOf;
  window.testRunInstall=install;

  function sourceContent(){return `<section class="drawer-section"><div class="inspector-heading">Sources</div><p class="source"><a class="drawer-source-link" href="https://www.gebco.net/data-products/undersea-feature-names" target="_blank" rel="noreferrer">IHO-IOC GEBCO Gazetteer of Undersea Feature Names ↗</a></p>${snapshotAge()?`<p class="source">Open Earth snapshot: ${esc(snapshotAge())}</p>`:''}<p class="semantic-note">GEBCO supplies the recognized undersea feature name and mapped geometry. PB2002 is kept as a separate source for plate-boundary interpretation.</p></section>`}
  function render(f,tab=activeTab){
    activeTab=tab;selected={type:'Feature',properties:{...(f.properties||{})},geometry:f.geometry};
    window.selectedTrenchFeature=selected;
    if(typeof selectedMapFeature!=='undefined')selectedMapFeature={layer:'trenches',feature:selected};
    map.getSource('tectonic-selection')?.setData({type:'FeatureCollection',features:[]});
    map.getSource('line-selection')?.setData({type:'FeatureCollection',features:[]});
    map.getSource('selection')?.setData({type:'FeatureCollection',features:[]});
    map.getSource(SELECT)?.setData(selected);
    const body=document.querySelector('#details-body'),panel=document.querySelector('#details'),coords=centerOfGeometry(f.geometry),boundary=coords&&typeof boundaryContext==='function'?boundaryContext(coords):null,plate=coords&&typeof containingPlate==='function'?containingPlate(coords):null;
    const tabs=`<nav class="drawer-tabs"><button data-trench-tab="overview">Overview</button><button data-trench-tab="nearby">Nearby</button><button data-trench-tab="sources">Sources</button></nav>`;
    let content;
    if(tab==='nearby')content=coords&&typeof relationships==='function'?relationships(coords):'<section class="drawer-section"><p class="semantic-note">No nearby tectonic context available.</p></section>';
    else if(tab==='sources')content=sourceContent();
    else content=`<section class="drawer-section"><div class="inspector-heading">Basic information</div><div class="meta">${fact('Feature type',genericOf(f))}${coords?fact('Approx. center',`${coords[1].toFixed(3)}, ${coords[0].toFixed(3)}`):''}${plate?fact('PB2002 plate',plateName(plate)):''}${boundary?fact('Nearest boundary',`${boundary.label} · ${Math.round(boundary.distance)} km`):''}</div></section><section class="drawer-card"><div class="inspector-heading">Tectonic context</div><p>Deep-ocean trench / named seafloor feature</p><p class="semantic-note">The trench geometry and name come from GEBCO. Nearby PB2002 boundaries provide the tectonic interpretation separately rather than treating every subduction boundary as a named trench.</p></section>`;
    body.innerHTML=`<header class="drawer-head"><div><div class="eyebrow">Seafloor · GEBCO Gazetteer</div><h2><span class="feature-icon" aria-hidden="true">⌄</span>${esc(nameOf(f))}</h2></div></header>${tabs}<div class="drawer-content">${content}</div>`;
    panel.hidden=false;body.querySelectorAll('[data-trench-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.trenchTab===activeTab);b.onclick=()=>render(f,b.dataset.trenchTab)});
  }
  document.querySelector('#trenches')?.addEventListener('change',e=>{
    if(typeof viewState!=='undefined'&&viewState?.layers){
      viewState.layers.trenches=e.target.checked;
      if(typeof saveState==='function')saveState();
    }
    install();
  });
  document.querySelector('#details-close')?.addEventListener('click',()=>{
    activeTab='overview';
    selected=null;
    window.selectedTrenchFeature=null;
    map.getSource(SELECT)?.setData({type:'FeatureCollection',features:[]});
  });
  const priorDetailForTrench = typeof detail === 'function' ? detail : null;
  if (priorDetailForTrench) {
    detail = function(layer, f) {
      if (layer !== 'trenches') {
        selected = null;
        window.selectedTrenchFeature = null;
        map.getSource(SELECT)?.setData({type:'FeatureCollection',features:[]});
      }
      return priorDetailForTrench(layer, f);
    };
  }
  map.on('click',e=>{if(!enabled()||!map.getLayer(HIT))return;const hits=map.queryRenderedFeatures(e.point,{layers:[HIT]});if(hits[0])render(hits[0],'overview')});
  map.on('mousemove',e=>{if(!enabled()||!map.getLayer(HIT))return;const hits=map.queryRenderedFeatures(e.point,{layers:[HIT]});if(hits.length)map.getCanvas().style.cursor='pointer'});
  const addLayersBeforeTrenches = typeof addLayers === 'function' ? addLayers : null;
  if (addLayersBeforeTrenches) {
    addLayers = function() {
      addLayersBeforeTrenches();
      install();
      if (trenchData?.features?.length && map.getSource(SOURCE)) {
        map.getSource(SOURCE).setData(trenchData);
      }
      if (selected && map.getSource(SELECT)) {
        map.getSource(SELECT).setData(selected);
      }
    };
  }
  map.on('load',()=>{install();load()});
  map.on('style.load',()=>setTimeout(()=>{install();map.getSource(SOURCE)?.setData(trenchData);if(selected)map.getSource(SELECT)?.setData(selected)},0));
  map.on('idle',()=>{if(enabled()&&!map.getLayer(LINE)){install();map.getSource(SOURCE)?.setData(trenchData);if(selected)map.getSource(SELECT)?.setData(selected)}});
  if(map.getStyle())setTimeout(install,0);
  load();
})();
