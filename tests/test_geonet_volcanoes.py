import json
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.update_geonet_volcanoes import parse_geonet_data

FIXTURE_PATH = ROOT / 'tests' / 'fixtures' / 'geonet_val.json'


class TestGeoNetVolcanoParser(unittest.TestCase):
    def setUp(self):
        self.assertTrue(FIXTURE_PATH.exists(), f'Fixture not found at {FIXTURE_PATH}')
        self.raw_data = json.loads(FIXTURE_PATH.read_text(encoding='utf-8'))

    def test_parse_fixture_counts_and_mapping(self):
        statuses = parse_geonet_data(self.raw_data)
        self.assertEqual(len(statuses), 12)

        by_id = {s['volcanoId']: s for s in statuses}

        # White Island (Level 2, Yellow)
        wi = by_id.get('whiteisland')
        self.assertIsNotNone(wi)
        self.assertEqual(wi['providerId'], 'geonet')
        self.assertEqual(wi['name'], 'White Island')
        self.assertEqual(wi['level'], 'Level 2')
        self.assertEqual(wi['colorCode'], 'YELLOW')
        self.assertEqual(wi['severity'], 'watch')
        self.assertEqual(wi.get('volcanoNumber'), 241040)
        self.assertEqual(wi.get('matchingMethod'), 'curated_geonet_id')
        self.assertTrue(wi['reportUrl'].endswith('/whiteisland'))

        # Ruapehu (Level 1, Green)
        rua = by_id.get('ruapehu')
        self.assertIsNotNone(rua)
        self.assertEqual(rua['level'], 'Level 1')
        self.assertEqual(rua['colorCode'], 'GREEN')
        self.assertEqual(rua['severity'], 'advisory')
        self.assertEqual(rua.get('volcanoNumber'), 241100)

        # Taupo (Level 0, Green)
        tau = by_id.get('taupo')
        self.assertIsNotNone(tau)
        self.assertEqual(tau['level'], 'Level 0')
        self.assertEqual(tau['severity'], 'normal')
        self.assertEqual(tau.get('volcanoNumber'), 241070)

    def test_fail_closed_on_insufficient_features(self):
        with self.assertRaises(RuntimeError):
            parse_geonet_data({'features': []})


if __name__ == '__main__':
    unittest.main()
