#!/usr/bin/env python3
"""Snapshot USGS Volcano Hazards Program activity levels for Open Earth.

Fetches monitored U.S. volcanoes and aviation color codes from the official
USGS HANS public API. Fails closed if data structure is unexpected or
corrupted, retaining existing valid snapshot.
"""
from __future__ import annotations
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'usgs-volcano-status.json'
VOLCANOES_CATALOG = ROOT / 'data' / 'volcanoes.json'
URL = 'https://volcanoes.usgs.gov/hans-public/api/volcano/getMonitoredVolcanoes'
UA = {
    'User-Agent': 'Mozilla/5.0 (compatible; OpenEarth/0.1; +https://github.com/VikingOwl91/open-earth)',
    'Accept': 'application/json',
}

ALERT_SEVERITIES = {
    'WARNING': 'warning',
    'WATCH': 'watch',
    'ADVISORY': 'advisory',
    'NORMAL': 'normal',
    'UNASSIGNED': 'unassigned',
}


def norm(s: str) -> str:
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]', '', s)


def load_gvp_lookup() -> dict[int, dict]:
    """Load GVP U.S. volcanoes mapped by Volcano_Number."""
    if not VOLCANOES_CATALOG.exists():
        return {}
    try:
        data = json.loads(VOLCANOES_CATALOG.read_text(encoding='utf-8'))
        lookup: dict[int, dict] = {}
        for f in data.get('features', []):
            p = f.get('properties') or {}
            num = p.get('Volcano_Number') or p.get('VolcanoNumber')
            if num:
                try:
                    lookup[int(num)] = p
                except (ValueError, TypeError):
                    continue
        return lookup
    except Exception as e:
        print(f'Warning: Could not load GVP catalog for USGS cross-referencing: {e}', file=sys.stderr)
        return {}


def parse_usgs_data(raw_items: list[dict], gvp_lookup: dict[int, dict] | None = None) -> list[dict]:
    """Normalize USGS monitored volcano records into the common provider model."""
    if not isinstance(raw_items, list):
        raise RuntimeError('USGS response is not a JSON list')
    if len(raw_items) < 20:
        raise RuntimeError(f'USGS returned only {len(raw_items)} items; refusing suspicious snapshot')

    if gvp_lookup is None:
        gvp_lookup = load_gvp_lookup()

    statuses = []
    seen_ids = set()

    for item in raw_items:
        vname = str(item.get('volcano_name') or '').strip()
        if not vname or vname.lower() in ('alaskan volcanoes', 'cascade range'):
            # Regional group buckets are not individual volcanoes
            continue

        raw_vnum = item.get('vnum')
        vnum_int = None
        matching_method = 'none'
        if raw_vnum:
            try:
                cand = int(raw_vnum)
                if cand in gvp_lookup:
                    vnum_int = cand
                    matching_method = 'official_vnum'
                else:
                    vnum_int = cand
                    matching_method = 'unverified_vnum'
            except (ValueError, TypeError):
                pass

        alert_level = str(item.get('alert_level') or 'UNASSIGNED').strip().upper()
        color_code = str(item.get('color_code') or 'UNASSIGNED').strip().upper()

        if alert_level == 'UNASSIGNED' and color_code != 'UNASSIGNED':
            native_status = color_code
        elif color_code == 'UNASSIGNED' and alert_level != 'UNASSIGNED':
            native_status = alert_level
        elif alert_level == 'UNASSIGNED' and color_code == 'UNASSIGNED':
            native_status = 'UNASSIGNED'
        else:
            native_status = f'{alert_level} / {color_code}'

        key = vnum_int or norm(vname)
        if key in seen_ids:
            continue
        seen_ids.add(key)

        record = {
            'providerId': 'usgs',
            'providerName': 'USGS Volcano Hazards Program',
            'name': vname,
            'alertLevel': alert_level,
            'colorCode': color_code,
            'nativeStatus': native_status,
            'label': native_status,
            'severity': ALERT_SEVERITIES.get(alert_level, 'normal'),
            'observatory': item.get('obs_fullname') or 'USGS Volcano Hazards Program',
            'observedAt': item.get('sent_utc'),
            'reportUrl': item.get('notice_url') or 'https://volcanoes.usgs.gov/hans-public/',
            'provenance': 'Official alert level and aviation color code published by USGS Volcano Hazards Program.',
        }
        if vnum_int is not None:
            record['volcanoNumber'] = vnum_int
            record['matchingMethod'] = matching_method
        if item.get('volcano_cd'):
            record['volcanoCode'] = item['volcano_cd']

        statuses.append(record)

    return statuses


def fetch_usgs_data(url: str = URL, retries: int = 3, timeout: int = 20) -> list[dict]:
    """Fetch USGS monitored volcanoes JSON with retries on transient errors."""
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

    raise RuntimeError(f'USGS upstream fetch failed after {retries} attempts: {last_err}')


def main():
    print(f'Fetching USGS monitored volcanoes from {URL}...')
    raw = fetch_usgs_data(URL)
    gvp_lookup = load_gvp_lookup()
    statuses = parse_usgs_data(raw, gvp_lookup=gvp_lookup)

    fetched = datetime.now(timezone.utc).isoformat()
    payload = {
        'source': {
            'name': 'USGS Volcano Hazards Program',
            'url': 'https://volcanoes.usgs.gov/hans-public/',
        },
        'provider': {
            'id': 'usgs',
            'name': 'USGS Volcano Hazards Program',
            'url': 'https://volcanoes.usgs.gov/hans-public/',
        },
        'fetchedAt': fetched,
        'statuses': statuses,
    }

    tmp_out = OUT.with_suffix('.tmp')
    tmp_out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(tmp_out, OUT)

    elevated = [s for s in statuses if s.get('alertLevel') not in ('NORMAL', 'UNASSIGNED')]
    mapped = [s for s in statuses if 'volcanoNumber' in s]
    print(f'USGS: {len(statuses)} monitored volcanoes ({len(elevated)} elevated, {len(mapped)} mapped to GVP)')


if __name__ == '__main__':
    main()
