import sys
import unittest
from pathlib import Path
from unittest.mock import patch, Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from photo_storage import upload_image, validate_image, StorageUnavailable


class PhotoStorageTests(unittest.TestCase):
    def test_fake_images_and_large_files_are_rejected(self):
        for data in [b'<script>bad</script>', b'\x89PNG\r\n\x1a\n' + b'x' * (3 * 1024 * 1024)]:
            with self.assertRaises(ValueError):
                validate_image(data)

    def test_missing_configuration_does_not_contact_cloudinary(self):
        with patch.dict('os.environ', {}, clear=True), patch('photo_storage.requests.post') as post:
            with self.assertRaises(StorageUnavailable):
                upload_image(b'\x89PNG\r\n\x1a\n' + b'x'*20, 'bahia-stay/test')
            post.assert_not_called()

    def test_upload_is_signed_and_returns_only_public_asset_fields(self):
        config = {'CLOUDINARY_CLOUD_NAME': 'example', 'CLOUDINARY_API_KEY': 'key', 'CLOUDINARY_API_SECRET': 'private'}
        response = Mock()
        response.json.return_value = {'secure_url': 'https://res.cloudinary.com/example/image/upload/test.png', 'public_id': 'bahia-stay/test'}
        with patch.dict('os.environ', config, clear=True), patch('photo_storage.requests.post', return_value=response) as post:
            result = upload_image(b'\x89PNG\r\n\x1a\n' + b'x'*20, 'bahia-stay/test')
        self.assertEqual(result['storage_path'], 'bahia-stay/test')
        self.assertNotIn('private', str(result))
        self.assertIn('signature', post.call_args.kwargs['data'])
        self.assertFalse(post.call_args.kwargs['allow_redirects'])
