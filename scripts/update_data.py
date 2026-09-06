#!/usr/bin/env python3
"""Refresh browser-safe Open Earth reference/activity snapshots using stdlib only."""
from __future__ import annotations
import csv, io, json, re, unicodedata, urllib.request
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data'; OUT.mkdir(exist_ok=True)
UA={'User-Agent':'OpenEarth/0.1 (+https://github.com/VikingOwl91/open-earth)'}
URLS={
 'volcano_wfs':'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=GVP-VOTW%3AE3WebApp_HoloceneVolcanoes&outputFormat=application%2Fjson&srsName=EPSG%3A4326',
 'volcano_csv':'https://raw.githubusercontent.com/mhmnia/eq-volcano-explorer/main/data/gvp_holocene_volcanoes.csv',
 'plates':'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json',
 'faults':'https://raw.githubusercontent.com/GEMScienceTools/gem-global-active-faults/master/geojson/gem_active_faults_harmonized.geojson',
 'activity':'https://volcano.si.edu/news/WeeklyVolcanoRSS.xml',
}

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=90) as r:return r.read()
def write(name,obj):
    (OUT/name).write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
def norm(s):
    s=unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]','',s)
def volcanoes_from_csv(raw):
    rows=list(csv.reader(io.StringIO(raw.decode('utf-8-sig')))); hi=next(i for i,r in enumerate(rows) if 'Volcano Number' in r and 'Volcano Name' in r); h=rows[hi]; ix={v:i for i,v in enumerate(h)}
    fs=[]
    for r in rows[hi+1:]:
        try: lat=float(r[ix['Latitude']]); lon=float(r[ix['Longitude']])
        except (ValueError,IndexError): continue
        def v(k): return r[ix[k]] if k in ix and ix[k]<len(r) else ''
        fs.append({'type':'Feature','properties':{'Volcano_Number':v('Volcano Number'),'Volcano_Name':v('Volcano Name'),'Country':v('Country'),'Primary_Volcano_Type':v('Primary Volcano Type'),'Activity_Evidence':v('Activity Evidence'),'Last_Known_Eruption':v('Last Known Eruption'),'Elevation_m':v('Elevation (m)'),'Tectonic_Setting':v('Tectonic Setting')},'geometry':{'type':'Point','coordinates':[lon,lat]}})
    return {'type':'FeatureCollection','features':fs}
def load_volcanoes():
    try:
        obj=json.loads(get(URLS['volcano_wfs']));
        if obj.get('features'): return obj
    except Exception as e: print('GVP WFS fallback:',e)
    return volcanoes_from_csv(get(URLS['volcano_csv']))
def activity(volcanoes):
    root=ET.fromstring(get(URLS['activity'])); by_name={norm(f.get('properties',{}).get('Volcano_Name')):f for f in volcanoes['features']}; fs=[]; seen=set()
    for item in root.findall('.//item'):
        title=(item.findtext('title') or '').strip(); link=(item.findtext('link') or '').strip(); desc=(item.findtext('description') or '').strip(); pub=(item.findtext('pubDate') or '').strip()
        candidate=re.split(r'\s+[\(\|\-]\s*|\s+\(',title,1)[0].strip(); key=norm(candidate); f=by_name.get(key)
        if not f:
            matches=[(k,v) for k,v in by_name.items() if k and (k in norm(title) or norm(title).startswith(k))]
            if matches: f=max(matches,key=lambda kv:len(kv[0]))[1]
        if not f: print('Unmatched activity item:',title); continue
        vid=f['properties'].get('Volcano_Number') or key
        if vid in seen: continue
        seen.add(vid); p=dict(f['properties']); p.update({'Report_Name':title,'Report_URL':link or 'https://volcano.si.edu/reports_weekly.cfm','Report_Published':pub,'Report_Summary':re.sub('<[^>]+>',' ',desc).strip()}); fs.append({'type':'Feature','properties':p,'geometry':f['geometry']})
    return {'type':'FeatureCollection','features':fs}
def main():
    fetched=datetime.now(timezone.utc).isoformat(); volcanoes=load_volcanoes(); plates=json.loads(get(URLS['plates'])); faults=json.loads(get(URLS['faults'])); reports=activity(volcanoes)
    for obj in (volcanoes,plates,faults,reports): obj['openEarth']={'fetchedAt':fetched}
    write('volcanoes.json',volcanoes); write('plates.json',plates); write('faults.json',faults); write('volcanic-reports.json',reports)
    write('manifest.json',{'generatedAt':fetched,'sources':{k:v for k,v in URLS.items()},'counts':{'volcanoes':len(volcanoes['features']),'plates':len(plates['features']),'faults':len(faults['features']),'volcanicReports':len(reports['features'])}})
    print('Updated:',json.loads((OUT/'manifest.json').read_text()))
if __name__=='__main__': main()
