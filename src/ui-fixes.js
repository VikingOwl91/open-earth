/* Map lifecycle + selection polish. Kept separate while the V2 branch settles. */
let selectedMapFeature=null;
let selectionPulseFrame=0;

function ensureSelectionLayer(){
  if(!map.getSource('selection')) map.addSource('selection',{type:'geojson',data:empty});
  if(!map.getLayer('selection-casing')) map.addLayer({id:'selection-casing',type:'circle',source:'selection',paint:{'circle-radius':14,'circle-color':'rgba(0,0,0,0)','circle-stroke-color':'rgba(3,26,34,.82)','circle-stroke-width':6,'circle-stroke-opacity':.82}});
  if(!map.getLayer('selection')) map.addLayer({id:'selection',type:'circle',source:'selection',paint:{'circle-radius':14,'circle-color':'rgba(99,215,230,0.10)','circle-stroke-color':'#63d7e6','circle-stroke-width':3,'circle-stroke-opacity':1}});
}
function restoreSelection(){ensureSelectionLayer();map.getSource('selection')?.setData(selectedMapFeature?.feature||empty)}
function animateSelection(ts=0){if(map.getLayer('selection')&&selectedMapFeature){const phase=(Math.sin(ts/360)+1)/2,radius=12+phase*8;map.setPaintProperty('selection','circle-radius',radius);map.setPaintProperty('selection','circle-stroke-width',2.5+phase*1.5);map.setPaintProperty('selection','circle-stroke-opacity',1-phase*.35);map.setPaintProperty('selection','circle-color',`rgba(99,215,230,${.16-phase*.08})`);if(map.getLayer('selection-casing')){map.setPaintProperty('selection-casing','circle-radius',radius);map.setPaintProperty('selection-casing','circle-stroke-width',6+phase*1.5);map.setPaintProperty('selection-casing','circle-stroke-opacity',.82-phase*.22)}}selectionPulseFrame=requestAnimationFrame(animateSelection)}
selectionPulseFrame=requestAnimationFrame(animateSelection);
const originalAddLayers=addLayers;addLayers=function(){originalAddLayers();restoreSelection()};
selectFeature=function(layer,f){selectedMapFeature={layer,feature:{type:'Feature',properties:{...(f.properties||{})},geometry:f.geometry}};restoreSelection();detail(layer,f)};
document.querySelector('#details-close').addEventListener('click',()=>{selectedMapFeature=null;map.getSource('selection')?.setData(empty)});
let styleChangeToken=0;
changeBasemap=function(name){if(!BASEMAPS[name]||name===viewState.basemap)return;const token=++styleChangeToken;saveCamera();viewState.basemap=name;saveState();loading(true);const camera={...viewState.camera},projection=viewState.projection;let settled=false;const finish=()=>{if(settled||token!==styleChangeToken)return;settled=true;loading(false)};map.once('style.load',()=>{if(token!==styleChangeToken)return;try{addLayers();setProjection(projection,false);map.jumpTo({center:camera.center,zoom:camera.zoom,bearing:camera.bearing,pitch:camera.pitch});applyVisibility();restoreSelection();requestAnimationFrame(()=>requestAnimationFrame(finish))}catch(error){console.error('Basemap rehydrate failed',error);finish()}});try{map.setStyle(BASEMAPS[name],{diff:false})}catch(error){console.error('Basemap change failed',error);finish()}setTimeout(finish,8000)};

/* Repository snapshots are authoritative for reference geology and weekly reports. */
let dataManifest=null;
async function localSnapshot(path,label){try{const r=await fetch(`./data/${path}`,{cache:'no-cache'});if(!r.ok)throw Error(r.status);const data=await r.json();failures.delete(label);setStatus();return data}catch(e){failures.add(label);setStatus();console.warn(`local ${label} snapshot unavailable`,e);return null}}
async function loadManifest(){try{const r=await fetch('./data/manifest.json',{cache:'no-cache'});if(!r.ok)throw Error(r.status);dataManifest=await r.json()}catch(e){console.warn('data manifest unavailable',e)}}
function snapshotAge(){const raw=dataManifest?.generatedAt;if(!raw)return '';const ms=Date.now()-Date.parse(raw);if(!Number.isFinite(ms))return '';const h=Math.max(0,Math.floor(ms/36e5));return h<24?`${h}h old`:`${Math.floor(h/24)}d old`}
const baseSetStatus=setStatus;setStatus=function(){baseSetStatus();const el=document.querySelector('#status'),age=snapshotAge();if(el&&age)el.textContent+=` · snapshot ${age}`};
loadVolcanoes=async function(){const local=await localSnapshot('volcanoes.json','volcanoes');volcanoData=local?.features?local:empty;map.getSource('volcanoes')?.setData(volcanoData);document.querySelector('#volcano-count').textContent=volcanoData.features.length};
loadPlates=async function(){const local=await localSnapshot('plates.json','plates');plateData=local?.features?local:empty;map.getSource('plates')?.setData(plateData)};
loadActivity=async function(){const local=await localSnapshot('volcanic-reports.json','activity');activityData=local?.features?local:empty;map.getSource('activity')?.setData(activityData);document.querySelector('#activity-count').textContent=activityData.features.length};
loadFaults=async function(){if(faultData.features.length)return;document.querySelector('#fault-count').textContent='…';const local=await localSnapshot('faults.json','faults');faultData=local?.features?local:empty;map.getSource('faults')?.setData(faultData);document.querySelector('#fault-count').textContent=faultData.features.length};

function value(...xs){return xs.find(x=>x!==undefined&&x!==null&&String(x).trim()&&String(x).trim().toLowerCase()!=='unknown')??null}
function volcanoCatalogMatch(p){const number=String(value(p.Volcano_Number,p.VolcanoNumber,p.volcano_number)||'');const name=value(p.Volcano_Name,p.VolcanoName,p.volcano_name,p.Report_Name);return volcanoData.features.find(v=>{const q=v.properties||{};return(number&&String(value(q.Volcano_Number,q.VolcanoNumber,q.volcano_number)||'')===number)||(name&&norm(value(q.Volcano_Name,q.VolcanoName,q.volcano_name))===norm(name))})}
function reportForVolcano(p){const number=String(value(p.Volcano_Number,p.VolcanoNumber,p.volcano_number)||'');const name=value(p.Volcano_Name,p.VolcanoName,p.volcano_name);return activityData.features.find(v=>{const q=v.properties||{};return(number&&String(value(q.Volcano_Number,q.VolcanoNumber,q.volcano_number)||'')===number)||(name&&norm(value(q.Volcano_Name,q.VolcanoName,q.volcano_name))===norm(name))})}
function fmtDate(raw){if(!raw)return null;const d=new Date(raw);return Number.isNaN(d.valueOf())?String(raw):d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}
function fact(label,val){return val===null||val===undefined||String(val).trim()===''?'':`<div class="fact"><b>${esc(label)}</b>${esc(val)}</div>`}
function volcanoDetail(f){
  const incoming=f.properties||{},catalog=volcanoCatalogMatch(incoming),p={...(catalog?.properties||{}),...incoming},report=reportForVolcano(p),rp=report?.properties||{};
  const coords=(catalog?.geometry||f.geometry)?.coordinates||[],name=value(p.Volcano_Name,p.VolcanoName,p.volcano_name,rp.Volcano_Name,'Volcano'),number=value(p.Volcano_Number,p.VolcanoNumber,p.volcano_number),country=value(p.Country,p.country),type=value(p.Primary_Volcano_Type,p.PrimaryVolcanoType,p.primary_volcano_type,p.Volcano_Type,p.volcano_type),elevation=value(p.Elevation_m,p.Elevation,p.elevation_m),eruption=value(p.Last_Known_Eruption,p.LastKnownEruption,p.last_known_eruption),tectonic=value(p.Tectonic_Setting,p.TectonicSetting,p.tectonic_setting);
  const reportTitle=value(rp.Report_Name,rp.Report_Title),reportDate=fmtDate(value(rp.Report_Published,rp.Report_Date,rp.report_published)),summary=value(rp.Report_Summary,rp.Summary),reportUrl=value(rp.Report_URL,SOURCES.activity.url),hasReport=!!report;
  const loc=[country,Number.isFinite(+coords[1])&&Number.isFinite(+coords[0])?`${(+coords[1]).toFixed(3)}, ${(+coords[0]).toFixed(3)}`:null].filter(Boolean).join(' · ');
  return `<div class="eyebrow">Volcano${number?` · GVP ${esc(number)}`:''}</div><h2>🌋 ${esc(name)}</h2>${hasReport?'<span class="live-badge">Weekly activity report</span>':''}
    <div class="inspector-section"><div class="inspector-heading">Overview</div><div class="meta">${fact('Location',loc)}${fact('Volcano type',type)}${fact('Elevation',elevation!==null?`${elevation} m`:null)}${fact('Last known eruption',eruption)}${fact('Tectonic setting',tectonic)}</div></div>
    ${hasReport?`<div class="inspector-section activity-section"><div class="inspector-heading">Latest weekly report</div>${reportDate?`<div class="report-date">Published ${esc(reportDate)}</div>`:''}${reportTitle&&norm(reportTitle)!==norm(name)?`<div class="report-title">${esc(reportTitle)}</div>`:''}${summary?`<p class="report-summary">${esc(summary)}</p>`:''}<a href="${esc(reportUrl)}" target="_blank" rel="noreferrer">Open GVP weekly report ↗</a><p class="semantic-note">A Weekly Volcanic Activity Report is a report of noteworthy activity, not an official alert level and not a complete list of all erupting volcanoes.</p></div>`:''}
    <div class="inspector-section"><div class="inspector-heading">Sources</div>${sourceLine(SOURCES.volcanoes)}${hasReport?sourceLine(SOURCES.activity):''}${snapshotAge()?`<p class="source">Open Earth snapshot: ${esc(snapshotAge())}</p>`:''}</div>`;
}
const baseDetail=detail;detail=function(layer,f){
  const body=document.querySelector('#details-body'),panel=document.querySelector('#details');
  if((layer==='volcanoes'||layer==='activity')&&body){body.innerHTML=volcanoDetail(f);panel.hidden=false;return}
  baseDetail(layer,f);if(body&&snapshotAge())body.insertAdjacentHTML('beforeend',`<p class="source">Open Earth snapshot: ${esc(snapshotAge())}</p>`)
};

/* Local scientific entities win over geocoding. Exact names first, then prefixes.
   This also makes the intended future search model explicit: geology is not a place-search fallback. */
function localVolcanoSearch(query){const q=norm(query);if(!q)return[];return volcanoData.features.filter(f=>{const n=norm(value(f.properties?.Volcano_Name,f.properties?.VolcanoName,f.properties?.volcano_name));return n===q||n.startsWith(q)||n.includes(q)}).sort((a,b)=>{const an=norm(value(a.properties?.Volcano_Name,a.properties?.VolcanoName)),bn=norm(value(b.properties?.Volcano_Name,b.properties?.VolcanoName));return Number(bn===q)-Number(an===q)||Number(bn.startsWith(q))-Number(an.startsWith(q))}).slice(0,6)}
const searchInput=document.querySelector('#search'),searchResults=document.querySelector('#search-results');
searchInput?.addEventListener('input',()=>{const hits=localVolcanoSearch(searchInput.value);if(!hits.length)return;searchResults.innerHTML=hits.map((f,i)=>`<button type="button" data-local-volcano="${i}">🌋 ${esc(value(f.properties?.Volcano_Name,f.properties?.VolcanoName))}${f.properties?.Country?` · ${esc(f.properties.Country)}`:''}</button>`).join('');searchResults.hidden=false;searchResults.querySelectorAll('[data-local-volcano]').forEach(btn=>btn.addEventListener('click',()=>{const f=hits[+btn.dataset.localVolcano],c=f.geometry.coordinates;searchInput.value=value(f.properties?.Volcano_Name,f.properties?.VolcanoName);searchResults.hidden=true;map.flyTo({center:c,zoom:8});selectFeature(reportForVolcano(f)?'activity':'volcanoes',reportForVolcano(f)||f)}))},true);

loadManifest().then(setStatus);
