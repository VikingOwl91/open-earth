import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.update_pvmbg import parse_pvmbg_html, level_from_header, load_gvp_lookup

FIXTURE_PATH = ROOT / 'tests' / 'fixtures' / 'magma_tingkat_aktivitas.html'

class TestPvmbgParser(unittest.TestCase):
    def setUp(self):
        self.assertTrue(FIXTURE_PATH.exists(), f'Fixture not found at {FIXTURE_PATH}')
        self.html = FIXTURE_PATH.read_text(encoding='utf-8')
        self.gvp_lookup = load_gvp_lookup()

    def test_level_from_header_precision(self):
        self.assertEqual(level_from_header('Level IV (Awas)'), 'IV')
        self.assertEqual(level_from_header('Level III (Siaga)'), 'III')
        self.assertEqual(level_from_header('Level II (Waspada)'), 'II')
        self.assertEqual(level_from_header('Level I (Normal)'), 'I')
        # Crucial: Must never match word boundaries in Indonesian place names
        self.assertIsNone(level_from_header('Merapi - Daerah Istimewa Yogyakarta'))
        self.assertIsNone(level_from_header('Lewotobi Laki-laki - Nusa Tenggara Timur'))
        self.assertIsNone(level_from_header('Awu - Sulawesi Utara'))

    def test_parse_fixture_counts_and_structure(self):
        rows, counts = parse_pvmbg_html(self.html, gvp_lookup=self.gvp_lookup)
        self.assertEqual(len(rows), 69)
        self.assertEqual(counts, {'Awas': 0, 'Siaga': 5, 'Waspada': 22, 'Normal': 42})

        by_name = {r['name']: r for r in rows}
        
        # Test key volcanoes
        krakatau = by_name.get('Anak Krakatau')
        self.assertIsNotNone(krakatau)
        self.assertEqual(krakatau['level'], 'III')
        self.assertEqual(krakatau['label'], 'Siaga')
        self.assertEqual(krakatau.get('volcanoNumber'), 262000)
        self.assertTrue(krakatau['reportUrl'].startswith('https://magma.esdm.go.id/'))

        merapi = by_name.get('Merapi')
        self.assertIsNotNone(merapi)
        self.assertEqual(merapi['level'], 'III')
        self.assertEqual(merapi['label'], 'Siaga')
        self.assertEqual(merapi.get('volcanoNumber'), 263250)

        semeru = by_name.get('Semeru')
        self.assertIsNotNone(semeru)
        self.assertEqual(semeru['level'], 'III')
        self.assertEqual(semeru['label'], 'Siaga')
        self.assertEqual(semeru.get('volcanoNumber'), 263300)

        lewotobi = by_name.get('Lewotobi Laki-laki')
        self.assertIsNotNone(lewotobi)
        self.assertEqual(lewotobi['level'], 'III')
        self.assertEqual(lewotobi['label'], 'Siaga')
        self.assertEqual(lewotobi.get('volcanoNumber'), 264180)

        # Sumbing in Jawa Tengah must match 263220, not 261180
        sumbing = by_name.get('Sumbing')
        self.assertIsNotNone(sumbing)
        self.assertEqual(sumbing.get('volcanoNumber'), 263220)

    def test_fail_closed_on_corrupted_markup(self):
        with self.assertRaises(RuntimeError):
            parse_pvmbg_html('<html><body>No tables here</body></html>')

        with self.assertRaises(RuntimeError):
            # Missing levels
            corrupted = '<table><tr><td>Level IV (Awas)</td></tr></table>'
            parse_pvmbg_html(corrupted)

if __name__ == '__main__':
    unittest.main()
