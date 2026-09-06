#!/usr/bin/env python3
"""Snapshot MAGMA Indonesia/PVMBG volcano activity levels for Open Earth.

MAGMA does not publish a documented JSON API for this view, so this adapter parses
its public activity-level page and deliberately fails closed if the markup no longer
looks like the expected source. No stale status is invented.
"""
from __future__ import annotations
import html, json, re, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'data'/'pvmbg-status.json'
URL='https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas'
UA={'User-Agent':'OpenEarth/0.1 (+https://github.com/VikingOwl91/open-earth)'}
LEVELS={'IV':'Awas','III':'Siaga','II':'Waspada','I':'Normal'}

def clean(s):
    s=re.sub(r'<script\b.*?</script>|<style\b.*?</style>',' ',s,flags=re.I|re.S)
    return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',s))).strip()

def main():
    req=urllib.request.Request(URL,headers=UA)
    with urllib.request.urlopen(req,timeout=120) as r: page=r.read().decode('utf-8','replace')
    # Each public report link carries a report id/signature. Use the surrounding card
    # text for name/location/level instead of depending on private application state.
    links=list(re.finditer(r'href=["\']([^"\']*/gunung-api/laporan/\d+[^"\']*)["\']',page,re.I))
    rows=[]; seen=set()
    for m in links:
        block=page[max(0,m.start()-1800):min(len(page),m.end()+900)]; text=clean(block)
        lm=re.search(r'Level\s*(IV|III|II|I)\s*\((Awas|Siaga|Waspada|Normal)\)',text,re.I)
        if not lm: continue
        level=lm.group(1).upper(); report=html.unescape(m.group(1)); report='https://magma.esdm.go.id'+report if report.startswith('/') else report
        # The volcano name is normally the nearest heading/anchor text before the report link.
        candidates=re.findall(r'<(?:h[1-6]|strong|b|a)[^>]*>(.*?)</(?:h[1-6]|strong|b|a)>',block[:m.start()-max(0,m.start()-1800)],re.I|re.S)
        names=[clean(x) for x in candidates if clean(x) and not re.search(r'level|laporan|detail|selengkap',clean(x),re.I)]
        name=names[-1] if names else ''
        if not name or len(name)>80: continue
        key=(name.lower(),level)
        if key in seen: continue
        seen.add(key); rows.append({'name':name,'level':level,'label':LEVELS[level],'reportUrl':report})
    if len(rows)<10: raise RuntimeError(f'PVMBG parser found only {len(rows)} statuses; refusing suspicious snapshot')
    fetched=datetime.now(timezone.utc).isoformat(); OUT.write_text(json.dumps({'source':{'name':'PVMBG / MAGMA Indonesia','url':URL},'fetchedAt':fetched,'statuses':rows},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(f'PVMBG: {len(rows)} activity statuses')
if __name__=='__main__': main()
