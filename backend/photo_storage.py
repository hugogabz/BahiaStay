"""Server-side signed uploads to the project's Cloudinary image library."""
import hashlib
import os
import re
import time
import requests

MAX_IMAGE_BYTES = 3 * 1024 * 1024


class StorageUnavailable(Exception):
    pass


def validate_image(data):
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise ValueError('Envie uma imagem de até 3 MB.')
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if data[:6] in (b'GIF87a', b'GIF89a'):
        return 'image/gif'
    if data.startswith(b'RIFF') and data[8:12] == b'WEBP':
        return 'image/webp'
    raise ValueError('Envie uma imagem JPG, PNG, WebP ou GIF válida.')


def storage_configured():
    return all(os.environ.get(name) for name in ('CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'))


def upload_image(data, public_id):
    content_type = validate_image(data)
    cloud = os.environ.get('CLOUDINARY_CLOUD_NAME', '')
    key = os.environ.get('CLOUDINARY_API_KEY', '')
    secret = os.environ.get('CLOUDINARY_API_SECRET', '')
    if not storage_configured() or not re.fullmatch(r'[a-zA-Z0-9_-]+', cloud):
        raise StorageUnavailable('Configure o Cloudinary na API para enviar novas fotos.')
    params = {'overwrite': 'false', 'public_id': public_id, 'timestamp': str(int(time.time()))}
    signed = '&'.join(f'{key}={value}' for key, value in sorted(params.items()))
    signature = hashlib.sha256((signed + secret).encode()).hexdigest()
    try:
        response = requests.post(f'https://api.cloudinary.com/v1_1/{cloud}/image/upload',
            data={**params, 'api_key': key, 'signature': signature},
            files={'file': ('image', data, content_type)}, timeout=12, allow_redirects=False)
        response.raise_for_status()
        payload = response.json()
        url = payload.get('secure_url', '')
        if not url.startswith(f'https://res.cloudinary.com/{cloud}/') or payload.get('public_id') != public_id:
            raise ValueError('Invalid upload response')
        return {'url': url, 'storage_path': public_id}
    except (requests.RequestException, ValueError):
        raise StorageUnavailable('Não foi possível enviar a foto. Confira a configuração do Cloudinary e tente novamente.') from None
