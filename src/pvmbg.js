/* Regional volcano monitoring: PVMBG / MAGMA Indonesia snapshot. */
(() => {
  let statuses=[],fetchedAt=null;
  const aliases={'anakkrakatau':'krakatau','krakatau':'krakatau','lewotobilakilaki':'lewotobilakilaki'};
  const key=s=>aliases[norm(s)]||norm(s);
  window.pvmbgForVolcano=p=>{
    if(!/indonesia/i.test(String(value(p?.Country,p?.country,''))))return null;
    const n=key(value(p?.Volcano_Name,p?.VolcanoName,p?.Report_Name,''));if(!n)return null;
    return statuses.find(x=>{const k=key(x.name);return k===n||k.includes(n)||n.includes(k)})||null;
  };
  window.pvmbgSnapshotAge=()=>fetchedAt?relativeAge(fetchedAt):null;
  function relativeAge(t){const ms=Date.now()-new Date(t).getTime();if(!Number.isFinite(ms))return null;const h=Math.max(0,Math.floor(ms/36e5));return h<1?'< 1h old':h<48?`${h}h old`:`${Math.floor(h/24)}d old`}
  async function load(){try{const r=await fetch('./data/pvmbg-status.json',{cache:'no-cache'});if(!r.ok)throw Error(r.status);const d=await r.json();statuses=Array.isArray(d.statuses)?d.statuses:[];fetchedAt=d.fetchedAt||null;window.dispatchEvent(new CustomEvent('openearth:pvmbg-ready',{detail:{count:statuses.length}}))}catch(e){console.warn('PVMBG status snapshot unavailable',e)}}
  load();
})();
