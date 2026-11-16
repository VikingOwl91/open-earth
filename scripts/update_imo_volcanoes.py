#!/usr/bin/env python3
"""Snapshot Icelandic Met Office (IMO) volcano alert levels for Open Earth.

Fetches the documented IMO Volcanoes API (OpenAPI at
https://api.vedur.is/volcanoes/openapi.json, CC BY 4.0). Each volcano carries
its current Volcano Alert Level System (VALS) notice and its current ICAO
Aviation Color Code from the latest VONA. The two scales are independent and
are stored side by side without conversion. Fails closed if the upstream schema
changes or the response looks truncated.
"""
from __future__ import annotations
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'imo-volcano-status.json'
VOLCANOES_CATALOG = ROOT / 'data' / 'volcanoes.json'
URL = 'https://api.vedur.is/volcanoes/volcanoes'
SOURCE_URL = 'https://en.vedur.is/earthquakes-and-volcanism/volcanoes/'
PROVIDER_NAME = 'Icelandic Met Office (IMO)'

UA = {
    'User-Agent': 'Mozilla/5.0 (compatible; OpenEarth/0.1; +https://github.com/VikingOwl91/open-earth)',
    'Accept': 'application/json',
}

VALS_SEVERITIES = {
    0: 'normal',
    1: 'advisory',
    2: 'watch',
    3: 'warning',
}


def load_gvp_lookup() -> dict[int, dict]:
    """Load GVP volcanoes mapped by Volcano_Number."""
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
        print(f'Warning: Could not load GVP catalog for IMO cross-referencing: {e}')
        return {}


def fetch_imo_data(url: str = URL, retries: int = 3, timeout: int = 30) -> list[dict]:
    """Fetch the IMO volcano list with retries on transient errors."""
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

    raise RuntimeError(f'IMO fetch failed after {retries} attempts: {last_err}')


def parse_imo_data(raw_items: list[dict], gvp_lookup: dict[int, dict] | None = None) -> list[dict]:
    """Normalize IMO volcano records into the common provider model."""
    if not isinstance(raw_items, list):
        raise RuntimeError('IMO response is not a JSON list')
    if len(raw_items) < 20:
        raise RuntimeError(f'IMO returned only {len(raw_items)} volcanoes; refusing suspicious snapshot')

    if gvp_lookup is None:
        gvp_lookup = load_gvp_lookup()

    statuses = []
    for item in raw_items:
        vals = (item.get('vals') or {}).get('current')
        if not vals:
            continue
        info = vals.get('alert_level_info') or {}
        level = info.get('level')
        if level not in VALS_SEVERITIES:
            raise RuntimeError(f"IMO returned unknown VALS level {level!r} for {item.get('code')}; refusing snapshot")

        name = str(item.get('si_name') or item.get('name') or item.get('code') or '').strip()
        color_en = str(info.get('code_en') or '').strip()
        meaning = str(info.get('description_en') or '').strip()

        vona = (item.get('vona') or {}).get('current') or {}
        acc = str((vona.get('aviation_color') or {}).get('code') or '').strip().upper()

        label_parts = [f'VALS {level}', color_en.upper()] if color_en else [f'VALS {level}']
        if acc:
            label_parts.append(f'ACC {acc}')
        native = f'VALS {level} {color_en}'.strip()
        if meaning:
            native += f' - {meaning}'
        if acc:
            native += f'; Aviation Color Code {acc}'

        record = {
            'providerId': 'imo',
            'providerName': PROVIDER_NAME,
            'name': name,
            'volcanoId': item.get('code'),
            'level': f'VALS {level}',
            'levelName': color_en or None,
            'colorCode': acc or None,
            'nativeStatus': native,
            'label': ' · '.join(label_parts),
            'severity': VALS_SEVERITIES[level],
            'activity': meaning or None,
            'observedAt': vals.get('published_at'),
            'colorCodeObservedAt': vona.get('published_at'),
            'reportUrl': SOURCE_URL,
            'provenance': 'Official Volcano Alert Level System (VALS) notice and ICAO Aviation Color Code published by the Icelandic Met Office.',
            'note': 'VALS and the Aviation Color Code are independent IMO scales and may differ at any given time.',
        }

        raw_vnum = item.get('si_code')
        try:
            vnum = int(raw_vnum)
        except (ValueError, TypeError):
            vnum = None
        if vnum is not None:
            record['volcanoNumber'] = vnum
            record['matchingMethod'] = 'official_si_code' if vnum in gvp_lookup else 'unverified_si_code'

        statuses.append(record)

    if len(statuses) < 20:
        raise RuntimeError(f'IMO produced only {len(statuses)} VALS statuses; refusing suspicious snapshot')

    return statuses


def main():
    print(f'Fetching IMO volcano alert levels from {URL}...')
    raw = fetch_imo_data(URL)
    gvp_lookup = load_gvp_lookup()
    statuses = parse_imo_data(raw, gvp_lookup=gvp_lookup)

    fetched = datetime.now(timezone.utc).isoformat()
    payload = {
        'source': {
            'name': PROVIDER_NAME,
            'url': SOURCE_URL,
            'api': 'https://api.vedur.is/volcanoes/openapi.json',
            'license': 'CC BY 4.0',
        },
        'provider': {
            'id': 'imo',
            'name': PROVIDER_NAME,
            'url': SOURCE_URL,
        },
        'fetchedAt': fetched,
        'statuses': statuses,
    }

    tmp_out = OUT.with_suffix('.tmp')
    tmp_out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(tmp_out, OUT)

    elevated = [s for s in statuses if s.get('severity') != 'normal']
    mapped = [s for s in statuses if s.get('matchingMethod') == 'official_si_code']
    print(f'IMO: {len(statuses)} volcanoes ({len(elevated)} elevated, {len(mapped)} mapped to GVP)')


if __name__ == '__main__':
    main()
