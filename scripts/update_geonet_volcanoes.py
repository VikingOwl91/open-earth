#!/usr/bin/env python3
"""Snapshot GeoNet (GNS Science) New Zealand volcanic alert levels for Open Earth.

Fetches current Volcanic Alert Levels (VAL) and Aviation Colour Codes from the
official GeoNet API. Fails closed if the upstream schema changes or is corrupted.
"""
from __future__ import annotations
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'geonet-volcano-status.json'
URL = 'https://api.geonet.org.nz/volcano/val'

UA = {
    'User-Agent': 'Mozilla/5.0 (compatible; OpenEarth/0.1; +https://github.com/VikingOwl91/open-earth)',
    'Accept': 'application/json',
}

CURATED_GEONET_GVP = {
    'whiteisland': 241040,           # Whakaari / White Island
    'ruapehu': 241100,               # Ruapehu
    'taupo': 241070,                 # Taupo
    'tongariro': 241080,             # Tongariro
    'ngauruhoe': 241080,             # Ngauruhoe (cone of Tongariro complex)
    'taranakiegmont': 241030,         # Taranaki / Egmont
    'aucklandvolcanicfield': 241020,  # Auckland Volcanic Field
    'mayorisland': 241021,           # Tuhua / Mayor Island
    'okataina': 241050,              # Okataina
    'rotorua': 241030,               # Rotorua
}

VAL_SEVERITIES = {
    0: 'normal',
    1: 'advisory',
    2: 'watch',
    3: 'warning',
    4: 'warning',
    5: 'warning',
}


def fetch_geonet_data(url: str = URL, retries: int = 3, timeout: int = 20) -> dict:
    """Fetch GeoNet VAL GeoJSON feed."""
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            last_err = f'HTTP {e.code}: {e.reason}'
        except urllib.error.URLError as e:
            last_err = f'Network error: {e.reason}'
        except Exception as e:
            last_err = f'{type(e).__name__}: {e}'

        if attempt < retries:
            time.sleep(1.5 * attempt)

    raise RuntimeError(f'GeoNet fetch failed after {retries} attempts: {last_err}')


def parse_geonet_data(geojson_data: dict) -> list[dict]:
    """Parse GeoNet features into common provider model."""
    features = geojson_data.get('features', [])
    if not isinstance(features, list) or len(features) < 5:
        raise RuntimeError(f'GeoNet returned unexpected feature count ({len(features) if isinstance(features, list) else 0}); refusing snapshot')

    statuses = []
    for f in features:
        p = f.get('properties', {})
        vid = str(p.get('volcanoID') or '').strip().lower()
        title = str(p.get('volcanoTitle') or vid.capitalize()).strip()
        level = p.get('level')
        acc = str(p.get('acc') or '').strip()
        activity = str(p.get('activity') or '').strip()
        hazards = str(p.get('hazards') or '').strip()

        if level is None:
            continue

        native_parts = [f'Level {level}']
        if acc:
            native_parts.append(acc.upper())
        status_label = ' · '.join(native_parts)

        native_full = f'Level {level} ({activity})' if activity else f'Level {level}'

        record = {
            'providerId': 'geonet',
            'providerName': 'GeoNet New Zealand (GNS Science)',
            'name': title,
            'volcanoId': vid,
            'level': f'Level {level}',
            'colorCode': acc.upper() if acc else None,
            'nativeStatus': native_full,
            'label': status_label,
            'severity': VAL_SEVERITIES.get(level, 'normal'),
            'activity': activity,
            'hazards': hazards,
            'reportUrl': f'https://www.geonet.org.nz/volcano/{vid}',
            'provenance': 'Official New Zealand Volcanic Alert Level published by GeoNet / GNS Science.',
            'note': hazards or activity or None,
        }

        vnum = CURATED_GEONET_GVP.get(vid)
        if vnum:
            record['volcanoNumber'] = vnum
            record['matchingMethod'] = 'curated_geonet_id'

        statuses.append(record)

    return statuses


def main():
    print(f'Fetching GeoNet volcanic alert levels from {URL}...')
    raw = fetch_geonet_data(URL)
    statuses = parse_geonet_data(raw)

    fetched = datetime.now(timezone.utc).isoformat()
    payload = {
        'source': {
            'name': 'GeoNet New Zealand (GNS Science)',
            'url': 'https://www.geonet.org.nz/volcano',
        },
        'provider': {
            'id': 'geonet',
            'name': 'GeoNet New Zealand (GNS Science)',
            'url': 'https://www.geonet.org.nz/volcano',
        },
        'fetchedAt': fetched,
        'statuses': statuses,
    }

    tmp_out = OUT.with_suffix('.tmp')
    tmp_out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(tmp_out, OUT)

    mapped = [s for s in statuses if 'volcanoNumber' in s]
    elevated = [s for s in statuses if s.get('severity') != 'normal']
    print(f'GeoNet: {len(statuses)} volcanoes ({len(elevated)} elevated, {len(mapped)} mapped to GVP)')


if __name__ == '__main__':
    main()
