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
 'eruptions':'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=GVP-VOTW%3ASmithsonian_VOTW_Holocene_Eruptions&outputFormat=application%2Fjson&srsName=EPSG%3A4326',
 'plates':'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json',
 'plate_steps':'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_steps.json',
 'plate_polygons':'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_plates.json',
 'faults':'https://raw.githubusercontent.com/GEMScienceTools/gem-global-active-faults/master/geojson/gem_active_faults_harmonized.geojson',
 'activity':'https://volcano.si.edu/news/WeeklyVolcanoRSS.xml',
}
STEP_TYPES={'SUB':('subduction','Subduction zone'),'OSR':('divergent','Oceanic spreading ridge'),'CRB':('divergent','Continental rift boundary'),'OTF':('transform','Oceanic transform fault'),'CTF':('transform','Continental transform fault'),'OCB':('convergent','Oceanic convergent boundary'),'CCB':('convergent','Continental convergent boundary')}
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=120) as r:return r.read()
def write(name,obj):(OUT/name).write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
def norm(s):
    s=unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().lower();return re.sub(r'[^a-z0-9]','',s)
def pick(p,*keys):
    for k in keys:
        if p.get(k) not in (None,''):return p[k]
    return ''
def normalize_feature(f):
    p=dict(f.get('properties') or {});g=f.get('geometry') or {}
    p.update({'Volcano_Number':pick(p,'Volcano_Number','VolcanoNumber','volcano_number','VNum','NUMBER'),'Volcano_Name':pick(p,'Volcano_Name','VolcanoName','volcano_name','V_Name','NAME','Name'),'Country':pick(p,'Country','COUNTRY','country'),'Primary_Volcano_Type':pick(p,'Primary_Volcano_Type','PrimaryVolcanoType','primary_volcano_type','Volcano_Type','TYPE'),'Elevation_m':pick(p,'Elevation_m','Elevation','elevation','ELEVATION'),'Last_Known_Eruption':pick(p,'Last_Known_Eruption','Last_Eruption_Year','LastEruptionYear','Last_Eruption','LAST_ERUPTION'),'Tectonic_Setting':pick(p,'Tectonic_Setting','TectonicSetting','tectonic_setting','TECTONIC_SETTING')})
    return {'type':'Feature','properties':p,'geometry':g}
def volcanoes_from_csv(raw):
    rows=list(csv.reader(io.StringIO(raw.decode('utf-8-sig'))));hi=next(i for i,r in enumerate(rows) if 'Volcano Number' in r and 'Volcano Name' in r);h=rows[hi];ix={v:i for i,v in enumerate(h)};fs=[]
    for r in rows[hi+1:]:
        try:lat=float(r[ix['Latitude']]);lon=float(r[ix['Longitude']])
        except (ValueError,IndexError):continue
        def v(k):return r[ix[k]] if k in ix and ix[k]<len(r) else ''
        fs.append({'type':'Feature','properties':{'Volcano_Number':v('Volcano Number'),'Volcano_Name':v('Volcano Name'),'Country':v('Country'),'Primary_Volcano_Type':v('Primary Volcano Type'),'Activity_Evidence':v('Activity Evidence'),'Last_Known_Eruption':v('Last Known Eruption'),'Elevation_m':v('Elevation (m)'),'Tectonic_Setting':v('Tectonic Setting')},'geometry':{'type':'Point','coordinates':[lon,lat]}})
    return {'type':'FeatureCollection','features':fs}
def load_volcanoes():
    try:
        obj=json.loads(get(URLS['volcano_wfs']));fs=[normalize_feature(f) for f in obj.get('features',[])]
        if len(fs)>500:return {'type':'FeatureCollection','features':fs}
    except Exception as e:print('GVP WFS fallback:',e)
    return volcanoes_from_csv(get(URLS['volcano_csv']))
def normalize_eruptions(obj):
    fs=[]
    for f in obj.get('features',[]):
        p=dict(f.get('properties') or {})
        p.update({'Volcano_Number':pick(p,'Volcano_Number','VolcanoNumber','volcano_number','VolcanoNo'),'Volcano_Name':pick(p,'Volcano_Name','VolcanoName','volcano_name'),'Eruption_Number':pick(p,'Eruption_Number','EruptionNumber','eruption_number'),'Eruption_Category':pick(p,'Eruption_Category','EruptionCategory','eruption_category','EruptionCategoryName'),'Start_Date':pick(p,'Start_Date','StartDate','start_date'),'Start_Year':pick(p,'Start_Year','StartYear','start_year'),'End_Date':pick(p,'End_Date','EndDate','end_date'),'End_Year':pick(p,'End_Year','EndYear','end_year'),'VEI':pick(p,'VEI','Vei','vei')})
        fs.append({'type':'Feature','properties':p,'geometry':f.get('geometry')})
    return {'type':'FeatureCollection','features':fs}
def load_eruptions():
    try:
        obj=json.loads(get(URLS['eruptions']));out=normalize_eruptions(obj)
        if len(out['features'])>1000:return out
        raise RuntimeError(f"unexpected eruption count {len(out['features'])}")
    except Exception as e:
        print('GVP eruption snapshot unavailable:',e);return {'type':'FeatureCollection','features':[]}
def normalize_steps(obj):
    fs=[]
    for f in obj.get('features',[]):
        p=dict(f.get('properties') or {});code=str(p.get('STEPCLASS') or '').upper();family,label=STEP_TYPES.get(code,('other','Other / uncertain boundary'));p.update({'Boundary_Code':code,'Boundary_Family':family,'Boundary_Label':label,'Plate_Pair':p.get('PLATEBOUND') or ''});fs.append({'type':'Feature','properties':p,'geometry':f.get('geometry')})
    return {'type':'FeatureCollection','features':fs}
def normalize_plate_polygons(obj):
    fs=[]
    for f in obj.get('features',[]):
        p=dict(f.get('properties') or {});code=pick(p,'PlateCode','PLATE','Code','Name','NAME');name=pick(p,'PlateName','Plate_Name','Name','NAME') or code;p.update({'Plate_Code':code,'Plate_Name':name});fs.append({'type':'Feature','properties':p,'geometry':f.get('geometry')})
    return {'type':'FeatureCollection','features':fs}
def activity(volcanoes):
    root=ET.fromstring(get(URLS['activity']));features=volcanoes['features'];by_number={str(f['properties'].get('Volcano_Number')):f for f in features if f['properties'].get('Volcano_Number') not in (None,'')};names=sorted(((norm(f['properties'].get('Volcano_Name')),f) for f in features if f['properties'].get('Volcano_Name')),key=lambda x:len(x[0]),reverse=True);fs=[];seen=set();items=root.findall('.//item')
    for item in items:
        title=(item.findtext('title') or '').strip();link=(item.findtext('link') or '').strip();guid=(item.findtext('guid') or '').strip();desc=(item.findtext('description') or '').strip();pub=(item.findtext('pubDate') or '').strip();hay=' '.join((title,link,guid,desc));m=re.search(r'WVAR\d{8}-(\d{5,6})',hay,re.I) or re.search(r'(?:vn|volcano(?:number)?)\D*(\d{5,6})',hay,re.I);f=by_number.get(m.group(1)) if m else None
        if not f:
            nt=norm(title)
            for n,candidate in names:
                if n and (n in nt or nt.startswith(n)):f=candidate;break
        if not f:print('Unmatched activity item:',title);continue
        p=dict(f['properties']);vid=str(p.get('Volcano_Number') or norm(p.get('Volcano_Name')));report=guid or link or title;key=(vid,report)
        if key in seen:continue
        seen.add(key);p.update({'Report_Name':title,'Report_URL':link or guid or 'https://volcano.si.edu/reports_weekly.cfm','Report_Published':pub,'Report_Summary':re.sub('<[^>]+>',' ',desc).strip(),'Report_Source':'Smithsonian / USGS Weekly Volcanic Activity Report'});fs.append({'type':'Feature','properties':p,'geometry':f['geometry']})
    print(f'GVP activity: matched {len(fs)}/{len(items)} RSS items');return {'type':'FeatureCollection','features':fs}
def main():
    fetched=datetime.now(timezone.utc).isoformat();volcanoes=load_volcanoes();eruptions=load_eruptions();plates=json.loads(get(URLS['plates']));steps=normalize_steps(json.loads(get(URLS['plate_steps'])));plate_polygons=normalize_plate_polygons(json.loads(get(URLS['plate_polygons'])));faults=json.loads(get(URLS['faults']));reports=activity(volcanoes)
    datasets=(volcanoes,eruptions,plates,steps,plate_polygons,faults,reports)
    for obj in datasets:obj['openEarth']={'fetchedAt':fetched}
    write('volcanoes.json',volcanoes);write('eruptions.json',eruptions);write('plates.json',plates);write('plate-steps.json',steps);write('plate-polygons.json',plate_polygons);write('faults.json',faults);write('volcanic-reports.json',reports)
    write('manifest.json',{'generatedAt':fetched,'sources':URLS,'counts':{'volcanoes':len(volcanoes['features']),'eruptions':len(eruptions['features']),'plates':len(plates['features']),'plateSteps':len(steps['features']),'platePolygons':len(plate_polygons['features']),'faults':len(faults['features']),'volcanicReports':len(reports['features'])}});print('Updated:',json.loads((OUT/'manifest.json').read_text()))
if __name__=='__main__':main()
