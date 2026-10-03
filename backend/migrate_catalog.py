"""Import the public catalog into a configured Neon database without overwrites."""
import asyncio
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from postgres_store import PostgresStore

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / '.env')


async def main():
    url = os.environ.get('DATABASE_URL')
    if not url:
        raise SystemExit('Configure DATABASE_URL before importing the catalog.')
    db = PostgresStore(url)
    await db.initialize()
    items = json.loads((ROOT / 'seed_properties.json').read_text(encoding='utf-8'))
    inserted = 0
    for item in items:
        if await db.properties.find_one({'id': item['id']}):
            continue
        item['photos'] = [{'id': f'ph_{i}', 'url': url, 'storage_path': None} for i, url in enumerate(item.get('images', []))]
        await db.properties.insert_one(item)
        inserted += 1
    print(f'Imported {inserted} properties; existing properties preserved.')


if __name__ == '__main__':
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
