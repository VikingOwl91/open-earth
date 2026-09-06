#!/usr/bin/env python3
"""Snapshot named trench geometries from the authoritative IHO-IOC GEBCO Gazetteer."""
from __future__ import annotations
import json, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data'/'trenches.json'
SERVICE='https://services2.arcgis.com/C8EMgrsFcRFL6LrL/arcgis/rest/services/Undersea_Features/FeatureServer'
UA={'User-Agent':'OpenEarth/0.1 (+https://github.com/VikingOwl91/open-earth)'}

def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=120) as r:
        return json.load(r)

def query(layer):
    params=urllib.parse.urlencode({'where':'1=1','outFields':'*','returnGeometry':'true','outSR':'4326','f':'json','resultRecordCount':'2000'})
    obj=get_json(f'{SERVICE}/{layer}/query?{params}')
    if obj.get('error'): raise RuntimeError(obj['error'])
    return obj.get('features',[])

def is_trench(attrs):
    return any(str(v).strip().lower() in {'trench','trenches'} for v in attrs.values() if v is not None)

def props(attrs):
    name=next((attrs.get(k) for k in ('Name','NAME','name','FeatureName','FEATURE_NAME','GazetteerName') if attrs.get(k)),None)
    generic=next((attrs.get(k) for k in ('Generic','GENERIC','generic','GenericTerm','GENERIC_TERM','FeatureType') if attrs.get(k)),None)
    if not name:
        strings=[str(v) for v in attrs.values() if isinstance(v,str) and v.strip() and v.strip().lower() not in {'trench','trenches'}]
        name=strings[0] if strings else 'Named trench'
    return {'Name':name,'Generic':generic or 'Trench','Source':'IHO-IOC GEBCO Gazetteer of Undersea Feature Names'}

def feature(raw,layer):
    g=raw.get('geometry') or {}; a=raw.get('attributes') or {}
    if layer==1 and g.get('paths'):
        geometry={'type':'MultiLineString' if len(g['paths'])>1 else 'LineString','coordinates':g['paths'] if len(g['paths'])>1 else g['paths'][0]}
    elif layer==2 and g.get('rings'):
        geometry={'type':'Polygon','coordinates':g['rings']}
    elif layer==0 and 'x' in g and 'y' in g:
        geometry={'type':'Point','coordinates':[g['x'],g['y']]}
    else:return None
    return {'type':'Feature','properties':props(a),'geometry':geometry}

def main():
    out=[]
    for layer in (0,1,2):
        for raw in query(layer):
            if not is_trench(raw.get('attributes') or {}):continue
            f=feature(raw,layer)
            if f:out.append(f)
    obj={'type':'FeatureCollection','features':out,'openEarth':{'fetchedAt':datetime.now(timezone.utc).isoformat(),'source':'IHO-IOC GEBCO Gazetteer of Undersea Feature Names','service':SERVICE}}
    OUT.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(f'GEBCO trenches: {len(out)} named features')
if __name__=='__main__':main()
