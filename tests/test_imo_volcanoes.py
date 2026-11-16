import copy
import json
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.update_imo_volcanoes import parse_imo_data, load_gvp_lookup

FIXTURE_PATH = ROOT / 'tests' / 'fixtures' / 'imo_volcanoes.json'


class TestImoVolcanoParser(unittest.TestCase):
    def setUp(self):
        self.assertTrue(FIXTURE_PATH.exists(), f'Fixture not found at {FIXTURE_PATH}')
        self.raw_data = json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))
        self.gvp_lookup = load_gvp_lookup()

    def test_parse_fixture_counts_and_mapping(self):
        statuses = parse_imo_data(self.raw_data, gvp_lookup=self.gvp_lookup)
        # Beerenberg (Jan Mayen, Norway) has no IMO notices and is skipped
        self.assertEqual(len(statuses), 33)
        by_id = {s['volcanoId']: s for s in statuses}
        self.assertNotIn('BEE', by_id)

        rey = by_id['REY']
        self.assertEqual(rey['providerId'], 'imo')
        self.assertEqual(rey['level'], 'VALS 2')
        self.assertEqual(rey['levelName'], 'Orange')
        self.assertEqual(rey['severity'], 'watch')
        self.assertEqual(rey['volcanoNumber'], 371020)
        self.assertEqual(rey['matchingMethod'], 'official_si_code')
        self.assertTrue(rey['observedAt'].startswith('2025-10-15'))

    def test_vals_and_aviation_color_code_stay_separate(self):
        by_id = {s['volcanoId']: s for s in parse_imo_data(self.raw_data, gvp_lookup=self.gvp_lookup)}
        rey = by_id['REY']
        # VALS Orange with ACC Yellow: the two native scales must not be merged
        self.assertEqual(rey['levelName'], 'Orange')
        self.assertEqual(rey['colorCode'], 'YELLOW')
        self.assertIn('VALS 2', rey['label'])
        self.assertIn('ACC YELLOW', rey['label'])
        self.assertTrue(rey['colorCodeObservedAt'].startswith('2026-11-10'))

        bar = by_id['BAR']
        self.assertEqual(bar['level'], 'VALS 1')
        self.assertEqual(bar['colorCode'], 'GREEN')
        self.assertEqual(bar['severity'], 'advisory')

        hek = by_id['HEK']
        self.assertEqual(hek['level'], 'VALS 0')
        self.assertEqual(hek['severity'], 'normal')
        self.assertEqual(hek['volcanoNumber'], 372070)

    def test_unverified_si_code_is_flagged(self):
        raw = copy.deepcopy(self.raw_data)
        statuses = parse_imo_data(raw, gvp_lookup={})
        self.assertTrue(all(s['matchingMethod'] == 'unverified_si_code' for s in statuses))

    def test_fail_closed_on_short_or_malformed_response(self):
        with self.assertRaises(RuntimeError):
            parse_imo_data([])
        with self.assertRaises(RuntimeError):
            parse_imo_data({'detail': 'error'})

    def test_fail_closed_on_unknown_vals_level(self):
        raw = copy.deepcopy(self.raw_data)
        raw[1]['vals']['current']['alert_level_info']['level'] = 9
        with self.assertRaises(RuntimeError):
            parse_imo_data(raw, gvp_lookup=self.gvp_lookup)


if __name__ == '__main__':
    unittest.main()
