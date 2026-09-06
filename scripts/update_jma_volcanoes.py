#!/usr/bin/env python3
"""Snapshot Japan Meteorological Agency (JMA) volcano warning levels for Open Earth.

Fetches current volcanic warnings and forecasts from the official JMA Bosai API.
Fails closed if the upstream schema changes or is corrupted.
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
OUT = ROOT / 'data' / 'jma-volcano-status.json'
VOLCANOES_CATALOG = ROOT / 'data' / 'volcanoes.json'

URL_WARNINGS = 'https://www.jma.go.jp/bosai/volcano/data/warning.json'
URL_DICT = 'https://www.jma.go.jp/bosai/volcano/const/volcano_dictionary.json'
URL_LIST = 'https://www.jma.go.jp/bosai/volcano/const/volcano_list.json'

UA = {
    'User-Agent': 'Mozilla/5.0 (compatible; OpenEarth/0.1; +https://github.com/VikingOwl91/open-earth)',
    'Accept': 'application/json',
}

# Curated mapping from JMA volcano codes to Smithsonian GVP Volcano Numbers
CURATED_JMA_GVP = {
    '101': 285060,  # Shiretoko-Iozan
    '102': 285050,  # Rausudake
    '103': 285041,  # Mashu
    '104': 285040,  # Atosanupuri
    '105': 285030,  # Meakandake
    '107': 285080,  # Taisetsuzan
    '108': 285070,  # Tokachidake
    '110': 285110,  # Tarumaesan
    '111': 285100,  # Kuttara
    '112': 285010,  # Usuzan
    '113': 285020,  # Hokkaido-Komagatake
    '114': 285002,  # Esan
    '115': 285001,  # Oshima-Oshima
    '116': 285150,  # Rishirizan
    '117': 285140,  # Yoteizan
    '202': 283250,  # Iwakisan
    '203': 283240,  # Hakkodasan
    '204': 283220,  # Towada
    '205': 283210,  # Akita-Yakeyama
    '206': 283260,  # Hachimantai
    '207': 283230,  # Iwatesan
    '208': 283200,  # Akita-Komagatake
    '209': 283190,  # Chokaisan
    '210': 283181,  # Kurikomayama
    '211': 283171,  # Naruko
    '212': 283180,  # Zaozan
    '213': 283170,  # Azumayama
    '214': 283160,  # Adatarayama
    '215': 283150,  # Bandaisan
    '216': 283141,  # Hiuchigatake
    '301': 283140,  # Nasudake
    '302': 283130,  # Nikko-Shiranesan
    '303': 283131,  # Akagisan
    '304': 283121,  # Harunasan
    '305': 283120,  # Kusatsu-Shiranesan
    '306': 283110,  # Asamayama
    '307': 283090,  # Niigata-Yakeyama
    '308': 283091,  # Myokosan
    '309': 283081,  # Midagahara
    '310': 283070,  # Yakedake
    '311': 283060,  # Norikuradake
    '312': 283040,  # Ontakesan
    '313': 283010,  # Hakusan
    '314': 283030,  # Fujisan
    '315': 283080,  # Hakoneyama
    '316': 284001,  # Izu-Tobu
    '317': 284010,  # Izu-Oshima
    '318': 284020,  # Niijima
    '319': 284030,  # Kozushima
    '320': 284040,  # Miyakejima
    '321': 284050,  # Hachijojima
    '322': 284060,  # Aogashima
    '323': 284080,  # Beyonesu (Bayonnaise) Rocks
    '324': 284070,  # Sumisujima (Smith Rocks)
    '325': 284071,  # Izu-Torishima
    '326': 284090,  # Nishinoshima
    '327': 284100,  # Kaitoku Seamount
    '328': 284110,  # Funka Asane
    '329': 284120,  # Ioto (Iwo-jima)
    '330': 284122,  # Kita-Fukutokutai
    '331': 284130,  # Fukutoku-Oka-no-Ba
    '350': 283120,  # Kusatsu-Shiranesan (Yugama)
    '351': 283120,  # Kusatsu-Shiranesan (Motoshirane)
    '502': 282070,  # Kujusan
    '503': 282110,  # Asosan (Aso)
    '504': 282100,  # Unzendake (Unzen)
    '505': 282090,  # Kirishimayama
    '506': 282080,  # Sakurajima
    '507': 282040,  # Kaimondake
    '508': 282060,  # Satsuma-Iojima (Kikai)
    '509': 282050,  # Kuchinoerabujima
    '510': 282031,  # Nakanoshima
    '511': 282030,  # Suwanosejima
    '550': 282090,  # Kirishimayama (Ohachi)
    '551': 282090,  # Kirishimayama (Shinmoedake)
    '552': 282090,  # Kirishimayama (Ebino)
    '601': 282010,  # Io-Torishima
}

JMA_LEVEL_TRANSLATIONS = {
    '11': ('Level 1', 'Volcanic Forecast (Potential for increased activity)', 'normal'),
    '12': ('Level 2', 'Near-crater Warning (Restriction on proximity to crater)', 'advisory'),
    '13': ('Level 3', 'Near-crater Warning (Restriction on proximity to volcano)', 'watch'),
    '14': ('Level 4', 'Residential Area Warning (Evacuation of elderly, etc.)', 'warning'),
    '15': ('Level 5', 'Residential Area Warning (Evacuation)', 'warning'),
    '21': ('Non-residential Warning', 'Caution advised around the crater', 'advisory'),
    '22': ('Near-crater Warning', 'Caution advised around crater', 'advisory'),
    '23': ('Non-residential Warning', 'Caution in non-residential areas near crater', 'watch'),
    '31': ('Volcanic Warning', 'Extreme caution in residential areas', 'warning'),
    '36': ('Marine Warning', 'Caution advised for sea area near volcano', 'advisory'),
}


def fetch_json(url: str, retries: int = 3, timeout: int = 20) -> dict | list:
    """Fetch JSON with retries."""
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

    raise RuntimeError(f'JMA fetch from {url} failed after {retries} attempts: {last_err}')


def parse_jma_warnings(warnings_raw: list[dict], dict_raw: dict) -> list[dict]:
    """Parse JMA warning records into the common provider model."""
    if not isinstance(warnings_raw, list):
        raise RuntimeError('JMA warning data is not a list')

    volcanoes_meta = {v['code']: v for v in dict_raw.get('volcanoes', [])}

    statuses = []
    seen = set()

    for w in warnings_raw:
        event_id = str(w.get('eventId') or '').strip()
        vmeta = volcanoes_meta.get(event_id, {})
        vname_jp = vmeta.get('name') or ''
        vname_en = vmeta.get('enName') or ''
        name = vname_en or vname_jp or f'JMA Volcano {event_id}'

        target_item = None
        for vi in w.get('volcanoInfos', []):
            if '対象火山' in vi.get('type', ''):
                items = vi.get('items', [])
                if items:
                    target_item = items[0]
                    break

        if not target_item:
            continue

        native_name = target_item.get('name') or '火山情報'
        code = str(target_item.get('code') or '')

        # Determine level text and severity
        trans = JMA_LEVEL_TRANSLATIONS.get(code)
        if trans:
            level_code, english_desc, severity = trans
            status_label = f'{level_code} · {native_name}'
        else:
            m = re.search(r'レベル([１２３４５12345])', native_name)
            if m:
                lvl_digit = m.group(1).translate(str.maketrans('１２３４５', '12345'))
                level_code = f'Level {lvl_digit}'
                status_label = f'{level_code} · {native_name}'
                severity = 'warning' if int(lvl_digit) >= 4 else 'watch' if int(lvl_digit) == 3 else 'advisory' if int(lvl_digit) == 2 else 'normal'
            else:
                level_code = native_name
                status_label = native_name
                severity = 'advisory'

        vnum = CURATED_JMA_GVP.get(event_id)
        matching_method = 'curated_jma_code' if vnum else 'none'

        key = event_id or name
        if key in seen:
            continue
        seen.add(key)

        record = {
            'providerId': 'jma',
            'providerName': 'Japan Meteorological Agency',
            'name': name,
            'nameJp': vname_jp,
            'volcanoCode': event_id,
            'level': level_code,
            'nativeStatus': native_name,
            'label': status_label,
            'severity': severity,
            'observedAt': w.get('reportDatetime'),
            'reportUrl': f'https://www.data.jma.go.jp/multi/volcano/volcano_detail.html?code={event_id}&lang=en',
            'provenance': 'Official volcanic warning level published by the Japan Meteorological Agency (JMA).',
            'note': trans[1] if trans else None,
        }

        if vnum is not None:
            record['volcanoNumber'] = vnum
            record['matchingMethod'] = matching_method

        statuses.append(record)

    return statuses


def main():
    print(f'Fetching JMA warnings from {URL_WARNINGS}...')
    warnings_raw = fetch_json(URL_WARNINGS)
    dict_raw = fetch_json(URL_DICT)

    statuses = parse_jma_warnings(warnings_raw, dict_raw)

    fetched = datetime.now(timezone.utc).isoformat()
    payload = {
        'source': {
            'name': 'Japan Meteorological Agency (JMA)',
            'url': 'https://www.jma.go.jp/bosai/map.html#contents=volcano',
        },
        'provider': {
            'id': 'jma',
            'name': 'Japan Meteorological Agency',
            'url': 'https://www.jma.go.jp/bosai/map.html#contents=volcano',
        },
        'fetchedAt': fetched,
        'statuses': statuses,
    }

    tmp_out = OUT.with_suffix('.tmp')
    tmp_out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(tmp_out, OUT)

    mapped = [s for s in statuses if 'volcanoNumber' in s]
    print(f'JMA: {len(statuses)} active warnings ({len(mapped)} mapped to GVP)')


if __name__ == '__main__':
    main()
