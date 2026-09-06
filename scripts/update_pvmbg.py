#!/usr/bin/env python3
"""Snapshot MAGMA Indonesia/PVMBG volcano activity levels for Open Earth.

MAGMA exposes its public activity levels as an HTML table. Parse that table using
only the Python standard library and fail closed if the page no longer resembles
the expected source. We never replace a good snapshot with suspicious data.
"""
from __future__ import annotations
import html, json, os, re, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'pvmbg-status.json'
VOLCANOES_CATALOG = ROOT / 'data' / 'volcanoes.json'
URL = 'https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas'
UA = {
    'User-Agent': 'Mozilla/5.0 (compatible; OpenEarth/0.1; +https://github.com/VikingOwl91/open-earth)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5,id;q=0.3',
}
LEVELS = {'IV': 'Awas', 'III': 'Siaga', 'II': 'Waspada', 'I': 'Normal'}

CURATED_ALIASES = {
    'anakkrakatau': 262000,          # Krakatau
    'anakranakah': 264071,           # Ranakah
    'batutara': 264260,              # Tara, Batu
    'bromo': 263310,                 # Tengger Caldera (Bromo cone)
    'burnitelong': 261050,           # Telong, Bur ni
    'dieng': 263200,                 # Dieng Volcanic Complex
    'gede': 263060,                  # Gede-Pangrango
    'ilewerung': 264250,             # Iliwerung
    'ililewotolok': 264230,          # Lewotolok
    'lokon': 266100,                 # Lokon-Empung
    'peutsague': 261030,             # Peuet Sague
    'rokatenda': 264150,             # Paluweh (Rokatenda cone)
    'tandikat': 261150,              # Tandikat-Singgalang
    'tangkoko': 266130,              # Tangkoko-Duasudara
    'lewotobilakilaki': 264180,      # Lewotobi (active summit cone)
}


def norm(s: str) -> str:
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]', '', s)


class ActivityTable(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.row = None
        self.cell = None
        self.link = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'tr':
            self.row = []
        elif tag in ('td', 'th') and self.row is not None:
            self.cell = {'text': [], 'links': []}
        elif tag == 'a' and self.cell is not None:
            self.link = a.get('href')

    def handle_data(self, data):
        if self.cell is not None:
            self.cell['text'].append(data)

    def handle_endtag(self, tag):
        if tag == 'a' and self.cell is not None and self.link:
            self.cell['links'].append(self.link)
            self.link = None
        elif tag in ('td', 'th') and self.row is not None and self.cell is not None:
            self.cell['text'] = ' '.join(''.join(self.cell['text']).split())
            self.row.append(self.cell)
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            if self.row:
                self.rows.append(self.row)
            self.row = None


def level_from_header(text: str) -> str | None:
    """Match official level headings like 'Level IV (Awas)', never plain words ending in 'i'."""
    m = re.search(r'\bLevel\s*(IV|III|II|I)\b(?:\s*\(?(Awas|Siaga|Waspada|Normal)\)?)?', text, re.I)
    if m:
        return m.group(1).upper()
    return None


def fetch_page(url: str, retries: int = 3, backoff: float = 2.0, timeout: int = 30) -> str:
    """Fetch URL with exponential backoff on transient errors."""
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode('utf-8', 'replace')
        except urllib.error.HTTPError as e:
            last_err = f'HTTP {e.code}: {e.reason}'
            print(f'PVMBG fetch attempt {attempt}/{retries} failed ({last_err})', file=sys.stderr)
        except urllib.error.URLError as e:
            last_err = f'Network error: {e.reason}'
            print(f'PVMBG fetch attempt {attempt}/{retries} failed ({last_err})', file=sys.stderr)
        except TimeoutError as e:
            last_err = f'Timeout error ({e})'
            print(f'PVMBG fetch attempt {attempt}/{retries} failed ({last_err})', file=sys.stderr)
        except Exception as e:
            last_err = f'Unexpected error ({type(e).__name__}: {e})'
            print(f'PVMBG fetch attempt {attempt}/{retries} failed ({last_err})', file=sys.stderr)

        if attempt < retries:
            delay = backoff * (2 ** (attempt - 1))
            print(f'Retrying in {delay:.1f}s...', file=sys.stderr)
            time.sleep(delay)

    raise RuntimeError(f'PVMBG upstream fetch failed after {retries} attempts: {last_err}')


def load_gvp_lookup() -> dict[str, list[int]]:
    """Load GVP Indonesian volcanoes mapped by normalized name."""
    if not VOLCANOES_CATALOG.exists():
        return {}
    try:
        data = json.loads(VOLCANOES_CATALOG.read_text(encoding='utf-8'))
        lookup: dict[str, list[int]] = {}
        for f in data.get('features', []):
            p = f.get('properties') or {}
            if 'indonesia' not in str(p.get('Country') or '').lower():
                continue
            num = p.get('Volcano_Number')
            name = p.get('Volcano_Name')
            if num and name:
                try:
                    num_int = int(num)
                except (ValueError, TypeError):
                    continue
                k = norm(name)
                lookup.setdefault(k, []).append(num_int)
        return lookup
    except Exception as e:
        print(f'Warning: Could not load GVP catalog for cross-referencing: {e}', file=sys.stderr)
        return {}


def parse_pvmbg_html(page: str, base_url: str = URL, gvp_lookup: dict[str, list[int]] | None = None) -> tuple[list[dict], dict[str, int]]:
    """Parse MAGMA activity table into structured status records."""
    if gvp_lookup is None:
        gvp_lookup = load_gvp_lookup()

    parser = ActivityTable()
    parser.feed(page)

    rows = []
    current_level = None
    seen = set()
    levels_found = set()

    for cells in parser.rows:
        texts = [c['text'] for c in cells]
        joined = ' | '.join(texts)
        detected = level_from_header(joined)
        if detected:
            current_level = detected
            levels_found.add(detected)

        if not current_level:
            continue

        links = [u for c in cells for u in c['links'] if u and u != '#']
        report = next((u for u in links if 'laporan' in u.lower() or 'gunung-api' in u.lower()), None)
        if not report:
            continue

        raw_text = cells[0]['text'] if cells else ''
        cleaned = re.sub(r'(?i)\s*lihat laporan.*', '', raw_text).strip()
        parts = re.split(r'\s+-\s+', cleaned, maxsplit=1)
        name = parts[0].strip()
        loc = parts[1].strip() if len(parts) > 1 else ''

        if not name or len(name) < 2 or len(name) > 100:
            continue

        report_url = urllib.parse.urljoin(base_url, html.unescape(report))
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)

        entry = {
            'providerId': 'pvmbg',
            'providerName': 'PVMBG / MAGMA Indonesia',
            'name': name,
            'level': current_level,
            'label': LEVELS[current_level],
            'nativeStatus': f'Level {current_level} - {LEVELS[current_level]}',
            'reportUrl': report_url,
        }
        if loc:
            entry['location'] = loc

        # Map to GVP volcano number if unambiguous
        nm = norm(name)
        vnum = None
        matching_method = None
        if nm == 'sumbing' and 'jawa' in norm(loc):
            vnum = 263220
            matching_method = 'curated_location'
        elif nm in CURATED_ALIASES:
            vnum = CURATED_ALIASES[nm]
            matching_method = 'curated_alias'
        elif nm in gvp_lookup:
            candidates = gvp_lookup[nm]
            if len(candidates) == 1:
                vnum = candidates[0]
                matching_method = 'exact_catalog_name'

        if vnum is not None:
            entry['volcanoNumber'] = vnum
            entry['matchingMethod'] = matching_method

        rows.append(entry)

    # Fail closed on suspicious or corrupted page structure
    missing_levels = set(LEVELS.keys()) - levels_found
    if missing_levels:
        raise RuntimeError(f'PVMBG parser schema error: missing expected status groups {missing_levels}')
    if len(rows) < 20:
        raise RuntimeError(f'PVMBG parser found only {len(rows)} statuses across {len(parser.rows)} table rows; refusing suspicious snapshot')

    counts = {label: sum(1 for r in rows if r['label'] == label) for label in LEVELS.values()}
    return rows, counts


def main():
    print(f'Fetching MAGMA activity levels from {URL}...')
    page = fetch_page(URL)
    gvp_lookup = load_gvp_lookup()
    rows, counts = parse_pvmbg_html(page, base_url=URL, gvp_lookup=gvp_lookup)

    fetched = datetime.now(timezone.utc).isoformat()
    payload = {
        'source': {
            'name': 'PVMBG / MAGMA Indonesia',
            'url': URL,
        },
        'provider': {
            'id': 'pvmbg',
            'name': 'PVMBG / MAGMA Indonesia',
            'url': URL,
        },
        'fetchedAt': fetched,
        'statuses': rows,
    }

    # Atomic write to avoid leaving truncated or half-written snapshots
    tmp_out = OUT.with_suffix('.tmp')
    tmp_out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(tmp_out, OUT)

    mapped_count = sum(1 for r in rows if 'volcanoNumber' in r)
    print(f'PVMBG: {len(rows)} activity statuses {counts} ({mapped_count}/{len(rows)} mapped to GVP catalog)')


if __name__ == '__main__':
    main()

