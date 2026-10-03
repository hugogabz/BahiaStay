"""Persist the existing document-shaped catalog in indexed PostgreSQL JSONB tables."""
import copy
import re
from types import SimpleNamespace

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb


TABLE_KEYS = {'users': 'user_id', 'properties': 'id', 'bookings': 'id', 'payment_transactions': 'session_id'}


def where(query):
    clauses, values = [], []
    for field, value in query.items():
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', field):
            raise ValueError('Invalid database field')
        if isinstance(value, dict):
            if set(value) == {'$in'}:
                clauses.append('data ->> %s = ANY(%s)')
                values.extend([field, [str(v) for v in value['$in']]])
            elif set(value) == {'$ne'}:
                clauses.append('data ->> %s IS DISTINCT FROM %s')
                values.extend([field, str(value['$ne'])])
            elif set(value) == {'$exists'}:
                clauses.append('(data ? %s) = %s')
                values.extend([field, bool(value['$exists'])])
            else:
                raise ValueError('Unsupported database predicate')
        else:
            clauses.append('data ->> %s = %s')
            values.extend([field, str(value)])
    return sql.SQL(' AND '.join(clauses) if clauses else 'TRUE'), values


def project(document, projection):
    document = copy.deepcopy(document)
    if not projection:
        return document
    included = [key for key, value in projection.items() if value and key != '_id']
    if included:
        return {key: document[key] for key in included if key in document}
    return {key: value for key, value in document.items() if projection.get(key, 1)}


def apply_update(document, update):
    result = copy.deepcopy(document)
    if set(update) - {'$set', '$unset', '$push', '$pull'}:
        raise ValueError('Unsupported database update')
    result.update(update.get('$set', {}))
    for field in update.get('$unset', {}):
        result.pop(field, None)
    for field, value in update.get('$push', {}).items():
        result.setdefault(field, []).append(value)
    for field, condition in update.get('$pull', {}).items():
        result[field] = [value for value in result.get(field, []) if not all(value.get(k) == v for k, v in condition.items())]
    return result


class Cursor:
    def __init__(self, collection, query, projection):
        self.collection, self.query, self.projection = collection, query, projection
        self.order = None

    def sort(self, field, direction):
        self.order = (field, direction)
        return self

    async def iterate(self):
        condition, values = where(self.query)
        statement = sql.SQL('SELECT data FROM {} WHERE {}').format(self.collection.table, condition)
        if self.order:
            statement += sql.SQL(' ORDER BY data ->> %s {}').format(sql.SQL('DESC' if self.order[1] == -1 else 'ASC'))
            values.append(self.order[0])
        async with await self.collection.store.connect() as connection:
            cursor = await connection.execute(statement, values)
            async for row in cursor:
                yield project(row[0], self.projection)

    def __aiter__(self):
        return self.iterate()


class Collection:
    def __init__(self, store, name):
        self.store, self.name, self.table = store, name, sql.Identifier('bahia_' + name)

    async def create_index(self, field, unique=False):
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', field):
            raise ValueError('Invalid index field')
        statement = sql.SQL('CREATE {} INDEX IF NOT EXISTS {} ON {} ((data ->> {}))').format(
            sql.SQL('UNIQUE' if unique else ''), sql.Identifier('bahia_' + self.name + '_' + field), self.table, sql.Literal(field))
        async with await self.store.connect() as connection:
            await connection.execute(statement)

    def find(self, query, projection=None):
        return Cursor(self, query, projection)

    async def find_one(self, query, projection=None):
        condition, values = where(query)
        async with await self.store.connect() as connection:
            cursor = await connection.execute(sql.SQL('SELECT data FROM {} WHERE {} LIMIT 1').format(self.table, condition), values)
            row = await cursor.fetchone()
        return project(row[0], projection) if row else None

    async def count_documents(self, query):
        condition, values = where(query)
        async with await self.store.connect() as connection:
            cursor = await connection.execute(sql.SQL('SELECT count(*) FROM {} WHERE {}').format(self.table, condition), values)
            return (await cursor.fetchone())[0]

    async def insert_one(self, document):
        key = document[TABLE_KEYS[self.name]]
        async with await self.store.connect() as connection:
            await connection.execute(sql.SQL('INSERT INTO {} (id, data) VALUES (%s, %s)').format(self.table), [key, Jsonb(document)])
        return SimpleNamespace(inserted_id=key)

    async def insert_many(self, documents):
        async with await self.store.connect() as connection:
            cursor = connection.cursor()
            await cursor.executemany(sql.SQL('INSERT INTO {} (id, data) VALUES (%s, %s)').format(self.table), [(document[TABLE_KEYS[self.name]], Jsonb(document)) for document in documents])

    async def update(self, query, update, one):
        condition, values = where(query)
        statement = sql.SQL('SELECT id, data FROM {} WHERE {} {} FOR UPDATE').format(self.table, condition, sql.SQL('LIMIT 1' if one else ''))
        matched, modified = 0, 0
        async with await self.store.connect() as connection:
            cursor = await connection.execute(statement, values)
            for key, document in await cursor.fetchall():
                matched += 1
                changed = apply_update(document, update)
                if changed != document:
                    await connection.execute(sql.SQL('UPDATE {} SET data = %s WHERE id = %s').format(self.table), [Jsonb(changed), key])
                    modified += 1
        return SimpleNamespace(matched_count=matched, modified_count=modified)

    async def update_one(self, query, update):
        return await self.update(query, update, True)

    async def update_many(self, query, update):
        return await self.update(query, update, False)

    async def delete(self, query, one):
        condition, values = where(query)
        statement = sql.SQL('DELETE FROM {} WHERE id IN (SELECT id FROM {} WHERE {} {})').format(self.table, self.table, condition, sql.SQL('LIMIT 1' if one else ''))
        async with await self.store.connect() as connection:
            cursor = await connection.execute(statement, values)
            return SimpleNamespace(deleted_count=cursor.rowcount)

    async def delete_one(self, query):
        return await self.delete(query, True)

    async def delete_many(self, query):
        return await self.delete(query, False)


class PostgresStore:
    def __init__(self, url):
        self.url = url
        for name in TABLE_KEYS:
            setattr(self, name, Collection(self, name))

    async def connect(self):
        return await psycopg.AsyncConnection.connect(self.url, connect_timeout=10)

    async def initialize(self):
        async with await self.connect() as connection:
            for name in TABLE_KEYS:
                await connection.execute(sql.SQL('CREATE TABLE IF NOT EXISTS {} (id TEXT PRIMARY KEY, data JSONB NOT NULL)').format(sql.Identifier('bahia_' + name)))

    def close(self):
        pass
