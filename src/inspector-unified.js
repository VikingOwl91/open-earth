/* Rich drawer adapters for non-volcanic canonical features. Loaded after inspector-v2. */
(() => {
  const tabs=(items,active)=>`<nav class="drawer-tabs">${items.map(([id,label])=>`<button data-unified-tab="${id}" class="${id===active?'active':''}">${label}</button>`).join('')}</nav>`;
  const shell=(eyebrow,title,icon,items,active,content)=>`<header class="drawer-head"><div><div class="eyebrow">${eyebrow}</div><h2>${icon?`<span class="feature-icon" aria-hidden="true">${icon}</span>`:''}${title}</h2></div></header>${tabs(items,active)}<div class="drawer-content">${content}</div>`;
  const sourceSection=s=>`<section class="drawer-section"><div class="inspector-heading">Sources</div>${sourceLine(s)}${snapshotAge()?`<p class="source">Open Earth snapshot: ${esc(snapshotAge())}</p>`:''}</section>`;
  function render(layer,f,tab='overview'){
    const p=f.properties||{},body=document.querySelector('#details-body'),panel=document.querySelector('#details'),coords=f.geometry?.coordinates||[],isQuake=layer==='earthquakes',isFault=layer==='faults';
    const items=isQuake?[['overview','Overview'],['nearby','Nearby'],['sources','Sources']]:[['overview','Overview'],['nearby','Nearby'],['sources','Sources']];
    let eyebrow,title,icon,content,source;
    if(isQuake){
      eyebrow=historicalMode?'Historical earthquake · USGS':'Live earthquake · USGS';title=`M ${esc(value(p.mag,'?'))} · ${esc(value(p.place,'Earthquake'))}`;icon='●';source=SOURCES.earthquakes;
      if(tab==='nearby')content=coords.length>=2?relationships(coords):'';
      else if(tab==='sources')content=`${sourceSection(source)}${p.url?`<section class="drawer-section"><a class="drawer-source-link" href="${esc(p.url)}" target="_blank" rel="noreferrer">USGS event details ↗</a></section>`:''}`;
      else content=`<section class="drawer-section"><div class="inspector-heading">Event</div><div class="meta">${fact('Time',p.time?new Date(Number(p.time)).toLocaleString():null)}${fact('Magnitude',p.mag!=null?`M ${p.mag}`:null)}${fact('Depth',coords[2]!=null?`${coords[2]} km`:null)}${coords.length>=2?fact('Coordinates',`${(+coords[1]).toFixed(3)}, ${(+coords[0]).toFixed(3)}`):''}${fact('Status',value(p.status,p.type))}</div></section>${p.url?`<a class="drawer-source-link" href="${esc(p.url)}" target="_blank" rel="noreferrer">USGS event details ↗</a>`:''}`;
    } else if(isFault){
      eyebrow='Active fault · GEM';title=esc(value(p.name,p.Name,p.fault_name,'Mapped fault'));icon='╱';source=SOURCES.faults;
      const c=featureCenter(f),near=c&&typeof boundaryContext==='function'?boundaryContext(c):null;
      if(tab==='nearby')content=c?relationships(c):'';
      else if(tab==='sources')content=sourceSection(source);
      else content=`<section class="drawer-section"><div class="inspector-heading">Fault information</div><div class="meta">${fact('Slip type',value(p.slip_type,p.slip_type_text,p.sense,'Not specified'))}${fact('Dip direction',value(p.dip_dir,p.dip_direction))}${fact('Slip rate',value(p.slip_rate,p.slip_rate_text))}${near?fact('Nearest plate boundary',`${near.label} · ${Math.round(near.distance)} km`):''}</div></section><section class="drawer-card"><div class="inspector-heading">Geological context</div><p class="semantic-note">Mapped active fault from GEM. Plate-boundary context is derived independently from PB2002.</p></section>`;
    } else return false;
    body.innerHTML=shell(eyebrow,title,icon,items,tab,content);panel.hidden=false;body.querySelectorAll('[data-unified-tab]').forEach(b=>b.onclick=()=>render(layer,f,b.dataset.unifiedTab));return true;
  }
  function featureCenter(f){const pts=[];const walk=x=>Array.isArray(x)&&typeof x[0]==='number'?pts.push(x):Array.isArray(x)&&x.forEach(walk);walk(f.geometry?.coordinates);return pts.length?[pts.reduce((s,p)=>s+p[0],0)/pts.length,pts.reduce((s,p)=>s+p[1],0)/pts.length]:null}
  const prior=detail;detail=function(layer,f){if(render(layer,f,'overview'))return;prior(layer,f)};

  /* tectonics.js has its own click path, so give typed boundaries the same drawer directly. */
  showTectonicDetail=function(f){
    selectTectonicStep(f);const p=f.properties||{},code=value(p.Boundary_Code,p.STEPCLASS),meta=STEP_META[code]||{label:'Plate boundary',family:'other'},body=document.querySelector('#details-body'),panel=document.querySelector('#details'),c=featureCenter(f),items=[['overview','Overview'],['nearby','Nearby'],['sources','Sources']];
    const draw=tab=>{let content;if(tab==='nearby')content=c?relationships(c):'';else if(tab==='sources')content=sourceSection(SOURCES.plates);else content=`<section class="drawer-section"><div class="inspector-heading">Boundary information</div><div class="meta">${fact('Class',meta.family)}${fact('Plate pair',value(p.Plate_Pair,p.PLATEBOUND))}${fact('Step length',p.STEPLENGTH!=null?`${Number(p.STEPLENGTH).toFixed(1)} km`:null)}${fact('Relative velocity',p.VELOCITYLE!=null?`${Number(p.VELOCITYLE).toFixed(1)} mm/yr`:null)}</div></section><section class="drawer-card"><div class="inspector-heading">Tectonic context</div><p>${esc(value(p.Boundary_Label,meta.label))}</p><p class="semantic-note">Boundary classification and relative motion come from the PB2002 plate model.</p></section>`;body.innerHTML=shell(`Plate tectonics · ${esc(code||'PB2002')}`,esc(value(p.Boundary_Label,meta.label)),'━',items,tab,content);panel.hidden=false;body.querySelectorAll('[data-unified-tab]').forEach(b=>b.onclick=()=>draw(b.dataset.unifiedTab))};draw('overview');
  };
})();
