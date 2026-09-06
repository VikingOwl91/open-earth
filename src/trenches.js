/* P1 trenches: named seafloor features from the IHO-IOC GEBCO Gazetteer. */
(() => {
  let trenchData={type:'FeatureCollection',features:[]},selected=null;
  const SOURCE='trenches', LINE='trenches-line', LABEL='trenches-label', HIT='trenches-hit', SELECT='trench-selection';
  const nameOf=f=>value(f?.properties?.Name,f?.properties?.name,'Named trench');
  function enabled(){return document.querySelector('#trenches')?.checked ?? true}
  function install(){
    if(!map?.isStyleLoaded?.())return;
    if(!map.getSource(SOURCE))map.addSource(SOURCE,{type:'geojson',data:trenchData});
    const before=['tectonic-subduction','tectonic-convergent','faults','earthquakes','volcanoes','activity'].find(id=>map.getLayer(id));
    if(!map.getLayer(LINE))map.addLayer({id:LINE,type:'line',source:SOURCE,filter:['in',['geometry-type'],['literal',['LineString','MultiLineString']]],layout:{visibility:enabled()?'visible':'none'},paint:{'line-color':'#7dd9e8','line-width':['interpolate',['linear'],['zoom'],1,1,5,1.8,8,2.5],'line-opacity':.55,'line-dasharray':[2,2]}},before);
    if(!map.getLayer(HIT))map.addLayer({id:HIT,type:'line',source:SOURCE,filter:['in',['geometry-type'],['literal',['LineString','MultiLineString']]],layout:{visibility:enabled()?'visible':'none'},paint:{'line-color':'rgba(0,0,0,0)','line-width':14}},before);
    if(!map.getLayer(LABEL))map.addLayer({id:LABEL,type:'symbol',source:SOURCE,minzoom:3,layout:{visibility:enabled()?'visible':'none','symbol-placement':'line','text-field':['coalesce',['get','Name'],'Trench'],'text-size':['interpolate',['linear'],['zoom'],3,10,6,12,9,14],'text-letter-spacing':.08,'text-max-angle':35},paint:{'text-color':'#a8e8f1','text-halo-color':'rgba(3,18,25,.9)','text-halo-width':1.5,'text-opacity':.85}},before);
    if(!map.getSource(SELECT))map.addSource(SELECT,{type:'geojson',data:selected||{type:'FeatureCollection',features:[]}});
    if(!map.getLayer(SELECT))map.addLayer({id:SELECT,type:'line',source:SELECT,paint:{'line-color':'#f4fbff','line-width':['interpolate',['linear'],['zoom'],2,3,7,6],'line-opacity':1}},before);
    for(const id of [LINE,HIT,LABEL])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',enabled()?'visible':'none');
  }
  async function load(){
    const d=await localSnapshot('trenches.json','trenches');
    trenchData=d?.features?d:{type:'FeatureCollection',features:[]};
    install();map.getSource(SOURCE)?.setData(trenchData);
    const count=document.querySelector('#trench-count');if(count)count.textContent=trenchData.features.length||'—';
  }
  function show(f){
    selected={type:'Feature',properties:{...(f.properties||{})},geometry:f.geometry};map.getSource(SELECT)?.setData(selected);
    const body=document.querySelector('#details-body'),panel=document.querySelector('#details'),p=f.properties||{};
    body.innerHTML=`<div class="eyebrow">Seafloor · GEBCO Gazetteer</div><h2>${esc(nameOf(f))}</h2><div class="inspector-section"><div class="inspector-heading">Feature</div><div class="meta">${fact('Type',value(p.Generic,'Trench'))}${fact('Tectonic context','Deep-ocean trench / named seafloor feature')}</div><p class="semantic-note">The mapped geometry and name describe the recognized undersea feature. Nearby PB2002 subduction boundaries provide the tectonic interpretation separately.</p></div><div class="inspector-section"><div class="inspector-heading">Source</div><p class="source">IHO-IOC GEBCO Gazetteer of Undersea Feature Names</p>${snapshotAge()?`<p class="source">Open Earth snapshot: ${esc(snapshotAge())}</p>`:''}</div>`;
    panel.hidden=false;
  }
  document.querySelector('#trenches')?.addEventListener('change',install);
  map.on('click',e=>{if(!enabled()||!map.getLayer(HIT))return;const hits=map.queryRenderedFeatures(e.point,{layers:[HIT]});if(hits[0])show(hits[0])});
  map.on('mousemove',e=>{if(!enabled()||!map.getLayer(HIT))return;const hits=map.queryRenderedFeatures(e.point,{layers:[HIT]});if(hits.length)map.getCanvas().style.cursor='pointer'});
  map.on('load',()=>{install();load()});
  map.on('style.load',()=>setTimeout(()=>{install();map.getSource(SOURCE)?.setData(trenchData);if(selected)map.getSource(SELECT)?.setData(selected)},0));
})();
