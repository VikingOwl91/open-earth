import json
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.update_jma_volcanoes import parse_jma_warnings

WARNINGS_PATH = ROOT / 'tests' / 'fixtures' / 'jma_warning.json'
DICT_PATH = ROOT / 'tests' / 'fixtures' / 'jma_dictionary.json'


class TestJmaVolcanoParser(unittest.TestCase):
    def setUp(self):
        self.assertTrue(WARNINGS_PATH.exists(), f'Fixture not found at {WARNINGS_PATH}')
        self.assertTrue(DICT_PATH.exists(), f'Fixture not found at {DICT_PATH}')
        self.warnings = json.loads(WARNINGS_PATH.read_text(encoding='utf-8'))
        self.dict_data = json.loads(DICT_PATH.read_text(encoding='utf-8'))

    def test_parse_fixture_counts_and_mapping(self):
        statuses = parse_jma_warnings(self.warnings, self.dict_data)
        self.assertGreaterEqual(len(statuses), 10)

        by_code = {s['volcanoCode']: s for s in statuses}

        # Sakurajima (506) - Level 3
        sakura = by_code.get('506')
        self.assertIsNotNone(sakura)
        self.assertEqual(sakura['providerId'], 'jma')
        self.assertEqual(sakura['name'], 'Sakurajima')
        self.assertEqual(sakura['nameJp'], '桜島')
        self.assertEqual(sakura['level'], 'Level 3')
        self.assertEqual(sakura['nativeStatus'], 'レベル３（入山規制）')
        self.assertEqual(sakura['severity'], 'watch')
        self.assertEqual(sakura.get('volcanoNumber'), 282080)
        self.assertEqual(sakura.get('matchingMethod'), 'curated_jma_code')

        # Asosan (503) - Level 2
        aso = by_code.get('503')
        self.assertIsNotNone(aso)
        self.assertEqual(aso['name'], 'Asosan')
        self.assertEqual(aso['level'], 'Level 2')
        self.assertEqual(aso['nativeStatus'], 'レベル２（火口周辺規制）')
        self.assertEqual(aso['severity'], 'advisory')
        self.assertEqual(aso.get('volcanoNumber'), 282110)

        # Bayonnaise Rocks (323) - Marine Warning
        bayo = by_code.get('323')
        self.assertIsNotNone(bayo)
        self.assertEqual(bayo['nativeStatus'], '周辺海域警戒')
        self.assertEqual(bayo.get('volcanoNumber'), 284080)

    def test_fail_closed_on_corrupted_data(self):
        with self.assertRaises(RuntimeError):
            parse_jma_warnings({'invalid': 'not a list'}, self.dict_data)


if __name__ == '__main__':
    unittest.main()
