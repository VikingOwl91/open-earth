const SOURCES={
  earthquakes:{name:'USGS Earthquake Hazards Program',url:'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php'},
  volcanoes:{name:'Smithsonian Global Volcanism Program',url:'https://volcano.si.edu/database/webservices.cfm'},
  plates:{name:'USGS Plate Boundaries',url:'https://earthquake.usgs.gov/arcgis/rest/services/eq/map_plateboundaries/MapServer'}
};
const feeds={hour:'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',day:'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',week:'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson'};
const empty={type:'FeatureCollection',features:[]};
let quakeData=empty,volcanoData=empty;
const failures=new Set();

const map=new maplibregl.Map({container:'map',style:'https://demotiles.maplibre.org/style.json',center:[110,-4],zoom:2.25,attributionControl:true});
map.addControl(new maplibregl.NavigationControl({showCompass:true}),'bottom-right');

const esc=s=>String(s??'Unknown').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const sourceLine=s=>`<p class="source">Source: <a href="${s.url}" target="_blank" rel="noreferrer">${s.name}</a></p>`;
const setStatus=()=>{const ok=['earthquakes','volcanoes','plates'].filter(x=>!failures.has(x)).length;document.querySelector('#status').textContent=`${ok}/3 public sources healthy${failures.size?` · unavailable: ${[...failures].join(', ')}`:''}`};
async function json(url,label){try{const r=await fetch(url);if(!r.ok)throw new Error(`${r.status}`);failures.delete(label);return await r.json()}catch(e){failures.add(label);console.warn(`${label} unavailable`,e);return empty}finally{setStatus()}}

function addLayers(){
  map.addSource('earthquakes',{type:'geojson',data:empty});
  map.addLayer({id:'earthquakes',type:'circle',source:'earthquakes',paint:{'circle-radius':['interpolate',['linear'],['coalesce',['get','mag'],0],0,3,4,5,7,12],'circle-color':['interpolate',['linear'],['coalesce',['get','mag'],0],0,'#ffe06b',4,'#ffb347',6,'#ff5c57'],'circle-stroke-color':'#fff3b0','circle-stroke-width':.6,'circle-opacity':.85}});
  map.addSource('volcanoes',{type:'geojson',data:empty});
  map.addLayer({id:'volcanoes',type:'circle',source:'volcanoes',paint:{'circle-radius':4,'circle-color':'#ff625e','circle-stroke-color':'#ffd1c9','circle-stroke-width':.7,'circle-opacity':.85}});
  map.addSource('plates',{type:'geojson',data:empty});
  map.addLayer({id:'plates',type:'line',source:'plates',paint:{'line-color':'#58d9e8','line-width':1.4,'line-opacity':.72}});
}

async function loadQuakes(range='day'){
  quakeData=await json(feeds[range],'earthquakes');
  map.getSource('earthquakes')?.setData(quakeData);
  document.querySelector('#quake-count').textContent=quakeData.features?.length??0;
}
async function loadVolcanoes(){
  const params=new URLSearchParams({service:'WFS',version:'1.0.0',request:'GetFeature',typeName:'GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes',outputFormat:'application/json',srsName:'EPSG:4326'});
  volcanoData=await json(`https://webservices.volcano.si.edu/geoserver/GVP-VOTW/wfs?${params}`,'volcanoes');
  map.getSource('volcanoes')?.setData(volcanoData);
  document.querySelector('#volcano-count').textContent=volcanoData.features?.length??0;
}
async function loadPlates(){
  const url='https://earthquake.usgs.gov/arcgis/rest/services/eq/map_plateboundaries/MapServer/1/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson';
  const data=await json(url,'plates');map.getSource('plates')?.setData(data);
}

function popup(layer,feature,lngLat){
  const p=feature.properties||{};let html='';
  if(layer==='earthquakes')html=`<div class="popup"><h3>M ${esc(p.mag)} · ${esc(p.place)}</h3><p>Depth: ${esc(feature.geometry?.coordinates?.[2])} km</p><p>${p.time?new Date(Number(p.time)).toLocaleString():'Time unknown'}</p>${p.url?`<p><a href="${esc(p.url)}" target="_blank" rel="noreferrer">USGS event details ↗</a></p>`:''}${sourceLine(SOURCES.earthquakes)}</div>`;
  else if(layer==='volcanoes'){const name=p.Volcano_Name||p.V_Name||p.name||p.NAME||'Volcano';html=`<div class="popup"><h3>🌋 ${esc(name)}</h3><p>Catalog feature · not a live-eruption indicator.</p>${sourceLine(SOURCES.volcanoes)}</div>`}
  else html=`<div class="popup"><h3>Plate boundary</h3><p>${esc(p.type||p.TYPE||p.Name||p.NAME||'Tectonic boundary')}</p>${sourceLine(SOURCES.plates)}</div>`;
  new maplibregl.Popup({maxWidth:'320px'}).setLngLat(lngLat).setHTML(html).addTo(map);
}

function wireMap(){
  for(const layer of ['earthquakes','volcanoes','plates']){
    map.on('click',layer,e=>{if(e.features?.[0])popup(layer,e.features[0],e.lngLat)});
    map.on('mouseenter',layer,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',layer,()=>map.getCanvas().style.cursor='');
  }
}

function wireControls(){
  for(const id of ['earthquakes','volcanoes','plates'])document.querySelector(`#${id}`).addEventListener('change',e=>map.setLayoutProperty(id,'visibility',e.target.checked?'visible':'none'));
  document.querySelector('#range').addEventListener('click',e=>{const r=e.target.dataset.range;if(!r)return;document.querySelectorAll('#range button').forEach(b=>b.classList.toggle('active',b===e.target));loadQuakes(r)});
  const input=document.querySelector('#search'),box=document.querySelector('#search-results');let timer;
  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>search(input.value),250)});
  async function search(q){
    q=q.trim();if(q.length<2){box.hidden=true;return}
    const local=[];
    for(const f of volcanoData.features||[]){const p=f.properties||{},name=p.Volcano_Name||p.V_Name||p.name||p.NAME;if(name?.toLowerCase().includes(q.toLowerCase()))local.push({label:`🌋 ${name}`,coords:f.geometry.coordinates})}
    for(const f of quakeData.features||[]){const name=f.properties?.place;if(name?.toLowerCase().includes(q.toLowerCase()))local.push({label:`◉ ${name}`,coords:f.geometry.coordinates})}
    let remote=[];try{const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`);if(r.ok)remote=(await r.json()).map(x=>({label:`⌖ ${x.display_name}`,coords:[+x.lon,+x.lat]}))}catch{}
    const results=[...local.slice(0,5),...remote].slice(0,7);box.innerHTML='';for(const item of results){const b=document.createElement('button');b.textContent=item.label;b.onclick=()=>{map.flyTo({center:item.coords.slice(0,2),zoom:7});box.hidden=true;input.value=item.label.replace(/^[^ ]+ /,'')};box.appendChild(b)}box.hidden=!results.length;
  }
}

map.on('load',async()=>{addLayers();wireMap();wireControls();await Promise.all([loadQuakes(),loadVolcanoes(),loadPlates()])});
