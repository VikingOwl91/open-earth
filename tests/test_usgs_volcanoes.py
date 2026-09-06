import json
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.update_usgs_volcanoes import parse_usgs_data, load_gvp_lookup

FIXTURE_PATH = ROOT / 'tests' / 'fixtures' / 'usgs_monitored.json'


class TestUsgsVolcanoParser(unittest.TestCase):
    def setUp(self):
        self.assertTrue(FIXTURE_PATH.exists(), f'Fixture not found at {FIXTURE_PATH}')
        self.raw_data = json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))
        self.gvp_lookup = load_gvp_lookup()

    def test_parse_fixture_counts_and_mapping(self):
        statuses = parse_usgs_data(self.raw_data, gvp_lookup=self.gvp_lookup)
        # Should exclude regional buckets ("Alaskan Volcanoes", "Cascade Range")
        self.assertGreaterEqual(len(statuses), 60)

        by_name = {s['name']: s for s in statuses}

        # Great Sitkin
        gs = by_name.get('Great Sitkin')
        self.assertIsNotNone(gs)
        self.assertEqual(gs['providerId'], 'usgs')
        self.assertEqual(gs['alertLevel'], 'WATCH')
        self.assertEqual(gs['colorCode'], 'ORANGE')
        self.assertEqual(gs['nativeStatus'], 'WATCH / ORANGE')
        self.assertEqual(gs['severity'], 'watch')
        self.assertEqual(gs.get('volcanoNumber'), 311120)
        self.assertEqual(gs.get('matchingMethod'), 'official_vnum')
        self.assertEqual(gs['observatory'], 'Alaska Volcano Observatory')

        # Kilauea
        kil = by_name.get('Kilauea')
        self.assertIsNotNone(kil)
        self.assertEqual(kil['alertLevel'], 'ADVISORY')
        self.assertEqual(kil['colorCode'], 'YELLOW')
        self.assertEqual(kil['severity'], 'advisory')
        self.assertEqual(kil.get('volcanoNumber'), 332010)

        # Mount St. Helens (Normal)
        msh = by_name.get('Mount St. Helens')
        self.assertIsNotNone(msh)
        self.assertEqual(msh['alertLevel'], 'NORMAL')
        self.assertEqual(msh['colorCode'], 'GREEN')
        self.assertEqual(msh['severity'], 'normal')
        self.assertEqual(msh.get('volcanoNumber'), 321050)

    def test_fail_closed_on_corrupt_data(self):
        with self.assertRaises(RuntimeError):
            parse_usgs_data([])

        with self.assertRaises(RuntimeError):
            parse_usgs_data({'invalid': 'structure'})


if __name__ == '__main__':
    unittest.main()
