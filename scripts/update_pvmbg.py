#!/usr/bin/env python3
"""Snapshot MAGMA Indonesia/PVMBG volcano activity levels for Open Earth.

MAGMA exposes its public activity levels as an HTML table. Parse that table using
only the Python standard library and fail closed if the page no longer resembles
the expected source. We never replace a good snapshot with suspicious data.
"""
from __future__ import annotations
import html, json, re, urllib.parse, urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'data'/'pvmbg-status.json'
URL='https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas'
UA={'User-Agent':'Mozilla/5.0 (compatible; OpenEarth/0.1; +https://github.com/VikingOwl91/open-earth)','Accept':'text/html,application/xhtml+xml'}
LEVELS={'IV':'Awas','III':'Siaga','II':'Waspada','I':'Normal'}

class ActivityTable(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows=[]; self.row=None; self.cell=None; self.link=None
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='tr': self.row=[]
        elif tag=='td' and self.row is not None: self.cell={'text':[],'links':[]}
        elif tag=='a' and self.cell is not None: self.link=a.get('href')
    def handle_data(self,data):
        if self.cell is not None: self.cell['text'].append(data)
    def handle_endtag(self,tag):
        if tag=='a' and self.cell is not None and self.link:
            self.cell['links'].append(self.link); self.link=None
        elif tag=='td' and self.row is not None and self.cell is not None:
            self.cell['text']=' '.join(''.join(self.cell['text']).split()); self.row.append(self.cell); self.cell=None
        elif tag=='tr' and self.row is not None:
            if self.row: self.rows.append(self.row)
            self.row=None

def level_from(text):
    text=' '.join(text.split())
    m=re.search(r'(?:Level\s*)?(IV|III|II|I)\b(?:\s*[-–—:(]*\s*(Awas|Siaga|Waspada|Normal))?',text,re.I)
    if m: return m.group(1).upper()
    for roman,label in LEVELS.items():
        if re.search(rf'\b{label}\b',text,re.I): return roman
    return None

def main():
    req=urllib.request.Request(URL,headers=UA)
    with urllib.request.urlopen(req,timeout=120) as r: page=r.read().decode('utf-8','replace')
    parser=ActivityTable(); parser.feed(page)
    rows=[]; current_level=None; seen=set()
    for cells in parser.rows:
        texts=[c['text'] for c in cells]; joined=' | '.join(texts)
        detected=level_from(joined)
        # MAGMA groups volcano rows beneath a level heading; remember the heading for
        # following rows that do not repeat the level text themselves.
        if detected: current_level=detected
        if not current_level: continue
        links=[u for c in cells for u in c['links'] if u and u!='#']
        report=next((u for u in links if 'laporan' in u.lower() or 'gunung-api' in u.lower()),links[0] if links else '')
        # A volcano row contains the named volcano anchor. Prefer its text, then a
        # compact non-numeric cell. Skip pure level/header rows.
        name=''
        for c in cells:
            if c['links'] and c['text'] and not level_from(c['text']) and not re.search(r'lihat laporan|detail',c['text'],re.I):
                name=c['text']; break
        if not name:
            candidates=[t for t in texts if t and not t.isnumeric() and not level_from(t) and not re.search(r'lihat laporan|lokasi|status|aktivitas',t,re.I)]
            name=next((t for t in candidates if len(t)<=100),'')
        if not name or not report: continue
        # Some cells render "Volcano - location". Keep the canonical volcano part.
        name=re.split(r'\s+-\s+',name,1)[0].strip()
        if len(name)<2 or len(name)>100: continue
        report=urllib.parse.urljoin(URL,html.unescape(report))
        key=name.casefold()
        if key in seen: continue
        seen.add(key); rows.append({'name':name,'level':current_level,'label':LEVELS[current_level],'reportUrl':report})
    if len(rows)<10:
        raise RuntimeError(f'PVMBG parser found only {len(rows)} statuses across {len(parser.rows)} table rows; refusing suspicious snapshot')
    fetched=datetime.now(timezone.utc).isoformat()
    OUT.write_text(json.dumps({'source':{'name':'PVMBG / MAGMA Indonesia','url':URL},'fetchedAt':fetched,'statuses':rows},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    counts={label:sum(1 for r in rows if r['label']==label) for label in LEVELS.values()}
    print(f'PVMBG: {len(rows)} activity statuses {counts}')
if __name__=='__main__': main()
