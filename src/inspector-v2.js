/* Rich drawer inspector: in-app event drill-down, POI imagery, tabs and semantic map markers. */
(() => {
  let eruptionData=empty,activeTab='overview';
  const pval=(p,...keys)=>value(...keys.map(k=>p?.[k]));
  const vid=p=>String(pval(p,'Volcano_Number','VolcanoNumber','volcano_number')||'');
  const vname=p=>norm(pval(p,'Volcano_Name','VolcanoName','volcano_name'));
  const eNum=p=>pval(p,'Eruption_Number','EruptionNumber','eruption_number');
  const eYear=p=>Number(pval(p,'Start_Year','StartDateYear','StartYear','start_year'))||null;
  const eMonth=p=>Number(pval(p,'Start_Month','StartDateMonth','StartMonth','start_month'))||null;
  const eDay=p=>Number(pval(p,'Start_Day','StartDateDay','StartDay','start_day'))||null;
  const eVei=p=>pval(p,'VEI','ExplosivityIndexMax','Vei','vei');
  const eCategory=p=>pval(p,'Eruption_Category','Activity_Type','EruptionCategory')||'GVP eruption';
  const eruptionLabel=p=>{const y=eYear(p),m=eMonth(p),d=eDay(p);if(!y)return'Date uncertain';if(m&&d)return new Date(Date.UTC(y,m-1,d)).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});if(m)return new Date(Date.UTC(y,m-1,1)).toLocaleDateString(undefined,{year:'numeric',month:'short',timeZone:'UTC'});return String(y)};
  const eruptionSort=p=>eYear(p)?Date.UTC(eYear(p),Math.max(0,(eMonth(p)||1)-1),eDay(p)||1):-Infinity;
  const eruptionUrl=(volcano,p)=>{const base=`https://volcano.si.edu/volcano.cfm?vn=${encodeURIComponent(vid(volcano))}&vtab=Eruptions`,n=eNum(p);return n?`${base}#event-${encodeURIComponent(n)}`:base};
  function eruptionsFor(p){const id=vid(p),name=vname(p);return (eruptionData.features||[]).filter(f=>{const q=f.properties||{};return(id&&vid(q)===id)||(name&&vname(q)===name)}).sort((a,b)=>eruptionSort(b.properties)-eruptionSort(a.properties))}
  function catalogProps(incoming){const c=volcanoCatalogMatch(incoming);return {catalog:c,p:{...(c?.properties||{}),...incoming},geometry:c?.geometry}}
  function tabs(){return `<nav class="drawer-tabs"><button data-drawer-tab="overview">Overview</button><button data-drawer-tab="history">History</button><button data-drawer-tab="nearby">Nearby</button><button data-drawer-tab="sources">Sources</button></nav>`}
  function eventRows(p){const es=eruptionsFor(p);return `<div class="event-list">${es.slice(0,12).map((e,i)=>{const q=e.properties||{},v=eVei(q);return `<button class="event-row" data-eruption="${i}"><time>${esc(eruptionLabel(q))}</time>${v!==null&&v!==''?`<b>VEI ${esc(v)}</b>`:''}<span>${esc(eCategory(q))}</span><i>›</i></button>`}).join('')}</div>${es.length>12?`<p class="semantic-note">Showing 12 of ${es.length.toLocaleString()} GVP eruption records.</p>`:''}`}
  function reportCard(p){const r=reportForVolcano(p),q=r?.properties||{};if(!r)return'';const date=fmtDate(value(q.Report_Published,q.Report_Date)),summary=value(q.Report_Summary,q.Summary),url=value(q.Report_URL,SOURCES.activity.url);return `<section class="drawer-card activity-card"><div class="inspector-heading">Recent activity · GVP weekly report</div>${date?`<time>${esc(date)}</time>`:''}${summary?`<p>${esc(summary)}</p>`:''}<a href="${esc(url)}" target="_blank" rel="noreferrer">Read full report ↗</a></section>`}
  function overview(p,coords){const report=reportForVolcano(p),type=value(p.Primary_Volcano_Type,p.PrimaryVolcanoType,p.Volcano_Type),elev=value(p.Elevation_m,p.Elevation),last=value(p.Last_Known_Eruption,p.LastKnownEruption),tect=value(p.Tectonic_Setting,p.TectonicSetting),country=value(p.Country,p.country);return `<div class="poi-hero" data-poi-image><div class="poi-image-placeholder">Loading image…</div></div>${reportCard(p)}<section class="drawer-section"><div class="inspector-heading">Basic information</div><div class="meta">${fact('Location',[country,coords.length>=2?`${(+coords[1]).toFixed(3)}, ${(+coords[0]).toFixed(3)}`:null].filter(Boolean).join(' · '))}${fact('Type',type)}${fact('Elevation',elev!=null?`${elev} m`:null)}${fact('Last known eruption',last)}${fact('Tectonic setting',tect)}</div></section>`}
  function sources(p){const has=!!reportForVolcano(p);return `<section class="drawer-section"><div class="inspector-heading">Sources</div>${sourceLine(SOURCES.volcanoes)}${has?sourceLine(SOURCES.activity):''}${snapshotAge()?`<p class="source">Open Earth snapshot: ${esc(snapshotAge())}</p>`:''}</section>`}
  function renderVolcano(f,tab=activeTab){activeTab=tab;const incoming=f.properties||{},x=catalogProps(incoming),p=x.p,coords=(x.geometry||f.geometry)?.coordinates||[],name=value(p.Volcano_Name,p.VolcanoName,p.Report_Name,'Volcano'),number=vid(p),has=!!reportForVolcano(p),body=document.querySelector('#details-body'),panel=document.querySelector('#details');let content='';if(tab==='history')content=`<section class="drawer-section"><div class="inspector-heading">Eruption history</div>${eventRows(p)}<a class="drawer-source-link" href="https://volcano.si.edu/volcano.cfm?vn=${encodeURIComponent(number)}&vtab=Eruptions" target="_blank" rel="noreferrer">View full history on GVP ↗</a></section>`;else if(tab==='nearby')content=coords.length>=2?relationships(coords):'';else if(tab==='sources')content=sources(p);else content=overview(p,coords);body.innerHTML=`<header class="drawer-head"><div><div class="eyebrow">Volcano${number?` · GVP ${esc(number)}`:''}</div><h2><span class="feature-icon volcano-icon" aria-hidden="true">▲</span>${esc(name)} ${has?'<em>ACTIVE · WEEKLY REPORT</em>':''}</h2></div></header>${tabs()}<div class="drawer-content">${content}</div>`;panel.hidden=false;wireDrawer(f,p);if(tab==='overview')loadPoiImage(name,p.Country)}
  function wireDrawer(f,p){document.querySelectorAll('[data-drawer-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.drawerTab===activeTab);b.onclick=()=>renderVolcano(f,b.dataset.drawerTab)});const es=eruptionsFor(p);document.querySelectorAll('[data-eruption]').forEach(b=>b.onclick=()=>showEruption(f,p,es[+b.dataset.eruption]?.properties||{}))}
  function showEruption(f,volcano,p){const body=document.querySelector('#details-body'),v=eVei(p),n=eNum(p);body.innerHTML=`<button class="drawer-back" type="button">← Eruption history</button><section class="event-detail"><div class="eyebrow">GVP eruption${n?` · ${esc(n)}`:''}</div><h2>${esc(eruptionLabel(p))}</h2>${v!==null&&v!==''?`<span class="vei-badge">VEI ${esc(v)}</span>`:''}<div class="meta">${fact('Classification',eCategory(p))}${fact('Start',eruptionLabel(p))}${fact('End',pval(p,'End_Date','EndDate')||pval(p,'EndDateYear','End_Year'))}${fact('Evidence',pval(p,'Evidence_Method','EvidenceMethod'))}</div><p class="semantic-note">Dates, classification and VEI are catalog facts from the Smithsonian Global Volcanism Program and may be revised as evidence changes.</p><a class="drawer-source-link" href="${esc(eruptionUrl(volcano,p))}" target="_blank" rel="noreferrer">Open source record on GVP ↗</a></section>`;body.querySelector('.drawer-back').onclick=()=>renderVolcano(f,'history')}
  async function loadPoiImage(name,country){const hero=document.querySelector('[data-poi-image]');if(!hero)return;try{const q=encodeURIComponent(`${name} volcano ${country||''}`),r=await fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrlimit=1&prop=pageimages|info&piprop=thumbnail&pithumbsize=900&inprop=url&format=json&origin=*`);if(!r.ok)throw Error(r.status);const d=await r.json(),page=Object.values(d.query?.pages||{})[0];if(!page?.thumbnail?.source)throw Error('no image');hero.innerHTML=`<a href="${esc(page.fullurl||'#')}" target="_blank" rel="noreferrer"><img src="${esc(page.thumbnail.source)}" alt="${esc(name)}"/><span>${esc(page.title)} · Wikipedia ↗</span></a>`}catch{hero.innerHTML='<div class="poi-image-placeholder">No preview image available</div>'}}

  /* Volcano markers are real MapLibre icon layers. A generated RGBA triangle avoids
     font/glyph dependencies and survives every basemap style rehydrate. */
  const markerImage=(fill,stroke)=>{
    const size=32,data=new Uint8Array(size*size*4),canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,size,size);ctx.beginPath();ctx.moveTo(16,3);ctx.lineTo(29,27);ctx.lineTo(3,27);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=stroke;ctx.stroke();
    const pixels=ctx.getImageData(0,0,size,size);data.set(pixels.data);return {width:size,height:size,data};
  };
  function ensureMarkerImages(){
    if(!map.hasImage('open-earth-volcano'))map.addImage('open-earth-volcano',markerImage('#ff625e','#fff0e9'),{pixelRatio:2});
    if(!map.hasImage('open-earth-activity'))map.addImage('open-earth-activity',markerImage('#ff9b45','#fff0e9'),{pixelRatio:2});
  }
  function installSemanticMarkers(){
    if(!map.isStyleLoaded())return;
    const visibility=id=>map.getLayer(id)?(map.getLayoutProperty(id,'visibility')||'visible'):'visible';
    const vv=visibility('volcanoes'),av=visibility('activity');
    for(const id of ['volcanoes-halo','volcanoes','activity'])if(map.getLayer(id))map.removeLayer(id);
    ensureMarkerImages();
    if(map.getSource('volcanoes'))map.addLayer({id:'volcanoes',type:'symbol',source:'volcanoes',layout:{'icon-image':'open-earth-volcano','icon-size':['interpolate',['linear'],['zoom'],0,.75,4,1,8,1.35],'icon-allow-overlap':true,'icon-ignore-placement':true,visibility:vv}});
    if(map.getSource('activity'))map.addLayer({id:'activity',type:'symbol',source:'activity',layout:{'icon-image':'open-earth-activity','icon-size':['interpolate',['linear'],['zoom'],0,1,4,1.35,8,1.7],'icon-allow-overlap':true,'icon-ignore-placement':true,visibility:av}});
  }
  const previousAddLayers=addLayers;addLayers=function(){previousAddLayers();installSemanticMarkers()};
  const priorDetail=detail;detail=function(layer,f){if(layer==='volcanoes'||layer==='activity'){renderVolcano(f,'overview');return}priorDetail(layer,f)};
  document.querySelector('#details-close')?.addEventListener('click',()=>activeTab='overview');
  async function load(){const d=await localSnapshot('eruptions.json','eruptions');eruptionData=d?.features?d:empty;if(map.isStyleLoaded())installSemanticMarkers()}
  load();
})();
