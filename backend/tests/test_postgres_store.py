import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from postgres_store import where, project, apply_update


class DocumentStorageRules(unittest.TestCase):
    def test_values_are_query_parameters(self):
        query, values = where({'email': "x' OR TRUE --"})
        self.assertNotIn('OR TRUE', query.as_string())
        self.assertIn("x' OR TRUE --", values)

    def test_private_fields_are_excluded(self):
        self.assertEqual(project({'email': 'admin', 'password_hash': 'private'}, {'password_hash': 0}), {'email': 'admin'})

    def test_photo_updates_do_not_mutate_original(self):
        document = {'photos': [{'id': 'one'}, {'id': 'two'}]}
        changed = apply_update(document, {'$pull': {'photos': {'id': 'one'}}, '$set': {'title': 'Casa'}})
        self.assertEqual(changed['photos'], [{'id': 'two'}])
        self.assertEqual(len(document['photos']), 2)

    def test_unsupported_operators_are_rejected(self):
        with self.assertRaises(ValueError):
            where({'title': {'$where': 'arbitrary code'}})


if __name__ == '__main__':
    unittest.main()
