"""Verified public identities and labelled examples for the existing seed catalog."""
import json
from copy import deepcopy
from pathlib import Path

IDENTITIES = json.loads(Path(__file__).with_suffix('.json').read_text(encoding='utf-8'))


def enrich_catalog_identity(document):
    metadata = IDENTITIES.get(document.get('id'))
    if metadata is None:
        return document
    result = deepcopy(document)
    if (result.get('host') or {}).get('name', '') in metadata['expectedHostNames']:
        stored_photo = (result.get('host') or {}).get('photo')
        stored_path = (result.get('host') or {}).get('photo_storage_path')
        result['host'] = deepcopy(metadata['host'])
        if stored_photo:
            result['host'].update(photo=stored_photo, photo_storage_path=stored_path)
    if metadata.get('sourceUrl'):
        result['sourceUrl'] = metadata['sourceUrl']
    if not result.get('sampleReviews'):
        result['sampleReviews'] = deepcopy(metadata['sampleReviews'])
    return result
