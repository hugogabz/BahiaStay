import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from catalog_identity import enrich_catalog_identity


class CatalogIdentityTests(unittest.TestCase):
    def test_admin_bio_and_details_survive_with_verified_name(self):
        item = {'id': 'ref_22239854', 'hostEdited': True, 'host': {'name': 'Itamar Gama', 'bio': 'Contato atualizado', 'since': '2020'}}
        result = enrich_catalog_identity(item)
        self.assertEqual(result['host']['bio'], 'Contato atualizado')
        self.assertEqual(result['host']['since'], '2020')
        self.assertTrue(result['host']['verified'])

    def test_changed_host_is_not_marked_as_verified(self):
        item = {'id': 'ref_22239854', 'hostEdited': True, 'host': {'name': 'Outro responsável', 'verified': True, 'sourceUrl': 'old'}}
        result = enrich_catalog_identity(item)
        self.assertFalse(result['host']['verified'])
        self.assertNotIn('sourceUrl', result['host'])

    def test_verified_listing_has_source_and_verified_host(self):
        item = enrich_catalog_identity({'id': 'ref_22239854', 'host': {'name': 'Itamar Gama'}})
        self.assertEqual(item['host']['name'], 'Itamar Gama')
        self.assertTrue(item['host']['verified'])
        self.assertIn('/rooms/22239854', item['sourceUrl'])

    def test_legacy_house_does_not_present_generic_host_as_real(self):
        item = enrich_catalog_identity({'id': 'ps-01', 'host': {'name': 'Família Fonseca'}})
        self.assertEqual(item['host']['name'], '')
        self.assertFalse(item['host']['verified'])
        self.assertGreaterEqual(len(item['sampleReviews']), 2)

    def test_unknown_admin_listing_is_not_reassigned(self):
        item = {'id': 'custom', 'host': {'name': 'Maria'}}
        self.assertEqual(enrich_catalog_identity(item), item)

    def test_enrichment_preserves_prices_photos_dates_and_custom_host_edits(self):
        item = {'id': 'ref_22239854', 'pricePerNight': 321, 'host': {'name': 'Novo responsável'}, 'images': ['photo'], 'unavailableDates': []}
        result = enrich_catalog_identity(item)
        self.assertEqual(result['host']['name'], 'Novo responsável')
        for key in ['pricePerNight', 'images', 'unavailableDates']:
            self.assertEqual(result[key], item[key])
