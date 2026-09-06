/* P1 history: GVP eruption timeline + source-aware historical earthquake inspector. */
(() => {
  let eruptionData=empty;
  const pval=(p,...keys)=>value(...keys.map(k=>p?.[k]));
  const volcanoId=p=>String(pval(p,'Volcano_Number','VolcanoNumber','volcano_number')||'');
  const volcanoName=p=>norm(pval(p,'Volcano_Name','VolcanoName','volcano_name'));
  function eruptionsFor(p){const id=volcanoId(p),name=volcanoName(p);return (eruptionData.features||[]).filter(f=>{const q=f.properties||{};return (id&&volcanoId(q)===id)||(name&&volcanoName(q)===name)}).sort((a,b)=>eruptionSort(b.properties)-eruptionSort(a.properties))}
  function numberPart(v){const n=Number(v);return Number.isFinite(n)&&n!==0?n:null}
  function eruptionParts(p){
    const date=pval(p,'Start_Date','StartDate','start_date','Start Date');
    if(date){const d=new Date(date);if(!Number.isNaN(d.valueOf()))return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),fromDate:true}}
    return {
      year:numberPart(pval(p,'Start_Year','StartDateYear','StartYear','start_year','Start Year')),
      month:numberPart(pval(p,'Start_Month','StartDateMonth','StartMonth','start_month','Start Month')),
      day:numberPart(pval(p,'Start_Day','StartDateDay','StartDay','start_day','Start Day')),
      fromDate:false
    };
  }
  function eruptionSort(p){const d=eruptionParts(p);if(!d.year)return-Infinity;return Date.UTC(d.year,d.month?d.month-1:0,d.day||1)}
  function eruptionLabel(p){
    const d=eruptionParts(p);if(!d.year)return'Date uncertain';
    if(d.month&&d.day)return new Date(Date.UTC(d.year,d.month-1,d.day)).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});
    if(d.month)return new Date(Date.UTC(d.year,d.month-1,1)).toLocaleDateString(undefined,{year:'numeric',month:'short',timeZone:'UTC'});
    return String(d.year);
  }
  function category(p){return pval(p,'Eruption_Category','Activity_Type','EruptionCategory','eruption_category','Eruption Category')||'GVP eruption'}
  function vei(p){return pval(p,'VEI','ExplosivityIndexMax','Vei','vei')}
  function eruptionNumber(p){return pval(p,'Eruption_Number','EruptionNumber','eruption_number')}
  function historyUrl(p){const id=volcanoId(p);return id?`https://volcano.si.edu/volcano.cfm?vn=${encodeURIComponent(id)}&vtab=Eruptions`:'https://volcano.si.edu/search_eruption.cfm'}
  function eventUrl(volcano,eruption){const base=historyUrl(volcano),n=eruptionNumber(eruption);return n?`${base}#event-${encodeURIComponent(n)}`:base}
  function timelineLink(href,time,label,kind=''){return `<a class="timeline-item timeline-link ${kind}" href="${esc(href)}" target="_blank" rel="noreferrer" title="Open source record"><time>${esc(time)}</time><span>${label}</span><span class="timeline-open" aria-hidden="true">↗</span></a>`}
  historySection=function(p){const eruptions=eruptionsFor(p),reports=reportsForVolcano(p).slice().sort((a,b)=>Date.parse(value(b.properties?.Report_Published,b.properties?.Report_Date)||0)-Date.parse(value(a.properties?.Report_Published,a.properties?.Report_Date)||0));if(!eruptions.length&&!reports.length)return'';const rows=[];for(const r of reports.slice(0,3)){const q=r.properties||{},href=value(q.Report_URL,q.url,q.Link)||historyUrl(p);rows.push(timelineLink(href,fmtDate(value(q.Report_Published,q.Report_Date))||'Report','Weekly activity report','activity-timeline'))}for(const e of eruptions.slice(0,8)){const q=e.properties||{},v=vei(q);rows.push(timelineLink(eventUrl(p,q),eruptionLabel(q),`${esc(category(q))}${v!==null&&v!==''?` · VEI ${esc(v)}`:''}`))}return `<div class="inspector-section"><div class="inspector-heading">Eruption history</div><div class="timeline">${rows.join('')}</div>${eruptions.length>8?`<p class="semantic-note">Showing the 8 most recent of ${eruptions.length.toLocaleString()} GVP eruption records.</p>`:''}<a href="${esc(historyUrl(p))}" target="_blank" rel="noreferrer">Open full GVP eruption history ↗</a><p class="semantic-note">Eruption dates and VEI values reflect the GVP catalog and may be approximate or revised as evidence changes.</p></div>`};

  function originalQuake(f){const id=f?.id||f?.properties?.id||f?.properties?.code;return (quakeData.features||[]).find(q=>q===f||(id&&(q.id===id||q.properties?.id===id||q.properties?.code===id)))||f}
  function quakeDetail(f){const q=originalQuake(f),p=q.properties||{},coords=q.geometry?.coordinates||[],depth=Number(coords[2]),time=Number(p.time),ctx=window.openEarthHistoricalQuery,isHistorical=historicalMode&&!!ctx;const scope=ctx?(ctx.scope==='selected'?`${ctx.radius} km around selected feature`:'current map bounds'):null;return `<div class="eyebrow">${isHistorical?'Historical':'Live'} earthquake</div><h2>M ${esc(p.mag)} · ${esc(p.place)}</h2><div class="inspector-section"><div class="inspector-heading">Event</div><div class="meta">${fact('Time',Number.isFinite(time)?new Date(time).toLocaleString():null)}${fact('Depth',Number.isFinite(depth)?`${depth.toFixed(1)} km`:null)}${fact('Coordinates',Number.isFinite(+coords[1])&&Number.isFinite(+coords[0])?`${(+coords[1]).toFixed(3)}, ${(+coords[0]).toFixed(3)}`:null)}</div></div>${isHistorical?`<div class="inspector-section"><div class="inspector-heading">Catalog query</div><div class="meta">${fact('Period',`${ctx.start} → ${ctx.end}`)}${fact('Scope',scope)}${fact('Magnitude',[ctx.minMagnitude?`≥ ${ctx.minMagnitude}`:'',ctx.maxMagnitude?`≤ ${ctx.maxMagnitude}`:''].filter(Boolean).join(' · ')||null)}${fact('Depth filter',[ctx.minDepth?`≥ ${ctx.minDepth} km`:'',ctx.maxDepth?`≤ ${ctx.maxDepth} km`:''].filter(Boolean).join(' · ')||null)}</div></div>`:''}${p.url?`<p><a href="${esc(p.url)}" target="_blank" rel="noreferrer">USGS event details ↗</a></p>`:''}${sourceLine(SOURCES.earthquakes)}`}
  const detailBeforeHistory=detail;detail=function(layer,f){if(layer!=='earthquakes')return detailBeforeHistory(layer,f);const body=document.querySelector('#details-body'),panel=document.querySelector('#details');body.innerHTML=quakeDetail(f);panel.hidden=false};

  async function loadEruptions(){const d=await localSnapshot('eruptions.json','eruptions');eruptionData=d?.features?d:empty;if(selectedMapFeature&&(selectedMapFeature.layer==='volcanoes'||selectedMapFeature.layer==='activity'))detail(selectedMapFeature.layer,selectedMapFeature.feature)}
  loadEruptions();
})();
