import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import HTTPException, Request, Response
import server

ORIGIN = 'https://site.example'
HEADERS = {'Origin': ORIGIN, 'X-CSRF-Protection': '1'}
ADMIN = {'user_id': 'admin-test', 'email': 'admin', 'role': 'admin'}


class CookieAuth(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.users = AsyncMock()
        self.users.find_one.return_value = {**ADMIN, 'password_hash': 'mock-hash'}
        self.db_patch = patch.object(server.db, 'users', self.users)
        self.db_patch.start()
        self.env_patch = patch.dict(os.environ, {'CORS_ORIGINS': ORIGIN, 'AUTH_COOKIE_SAMESITE': 'none'})
        self.env_patch.start()

    def tearDown(self):
        self.env_patch.stop()
        self.db_patch.stop()

    def request(self, method='POST', headers=None, cookie=None, scheme='https', host='api.example'):
        values = dict(headers or {})
        if cookie: values['Cookie'] = 'access_token=' + cookie
        return Request({'type': 'http', 'method': method, 'scheme': scheme, 'path': '/',
            'server': (host, 443), 'headers': [(k.lower().encode(), v.encode()) for k, v in values.items()]})

    async def test_login_returns_only_user_and_sets_protected_cookie(self):
        response = Response()
        with patch.object(server, 'verify_password', return_value=True):
            result = await server.login(server.LoginRequest(email='admin', password='example'), response, self.request(headers=HEADERS))
        self.assertEqual(set(result), {'user'})
        cookie = response.headers['set-cookie'].lower()
        for attribute in ['httponly', 'secure', 'samesite=none', 'path=/']:
            self.assertIn(attribute, cookie)
        self.assertNotIn('password_hash', result['user'])

    async def test_login_blocks_foreign_origin_and_missing_csrf_header(self):
        for headers in [{'Origin': ORIGIN}, {'Origin': 'https://attacker.example', 'X-CSRF-Protection': '1'}, {'X-CSRF-Protection': '1'}]:
            with self.assertRaises(HTTPException) as error:
                await server.login(server.LoginRequest(email='admin', password='example'), Response(), self.request(headers=headers))
            self.assertEqual(error.exception.status_code, 403)
        self.users.find_one.assert_not_awaited()

    async def test_bearer_token_alone_is_no_longer_accepted(self):
        token = server.create_access_token(ADMIN['user_id'], ADMIN['email'])
        with self.assertRaises(HTTPException) as error:
            await server.get_current_admin(self.request('GET', {'Authorization': 'Bearer ' + token}))
        self.assertEqual(error.exception.status_code, 401)

    async def test_cookie_does_not_allow_unprotected_admin_write(self):
        token = server.create_access_token(ADMIN['user_id'], ADMIN['email'])
        with self.assertRaises(HTTPException) as error:
            await server.get_current_admin(self.request('DELETE', {'Origin': ORIGIN}, cookie=token))
        self.assertEqual(error.exception.status_code, 403)

    async def test_valid_cookie_restores_session_and_allows_protected_write(self):
        self.users.find_one.return_value = ADMIN
        token = server.create_access_token(ADMIN['user_id'], ADMIN['email'])
        for method in ['GET', 'DELETE']:
            user = await server.get_current_admin(self.request(method, HEADERS, cookie=token))
            self.assertEqual(user, ADMIN)

    async def test_logout_blocks_csrf_and_removes_cookie_on_success(self):
        with self.assertRaises(HTTPException) as error:
            await server.logout(Response(), self.request(headers={'Origin': 'https://attacker.example'}))
        self.assertEqual(error.exception.status_code, 403)
        response = Response()
        await server.logout(response, self.request(headers=HEADERS))
        self.assertIn('Max-Age=0', response.headers['set-cookie'])
        self.assertIn('HttpOnly', response.headers['set-cookie'])

    def test_insecure_cookie_is_allowed_only_on_loopback_development(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop('AUTH_COOKIE_SAMESITE', None)
            local = server.session_cookie_options(self.request(scheme='http', host='127.0.0.1'))
            public = server.session_cookie_options(self.request(scheme='http', host='api.example'))
        self.assertFalse(local['secure'])
        self.assertEqual(local['samesite'], 'lax')
        self.assertTrue(public['secure'])

    async def test_expired_and_wrong_type_cookies_are_rejected(self):
        import jwt
        for claims in [dict(sub='admin-test', exp=1, type='access'),
                       dict(sub='admin-test', exp=4102444800, type='refresh')]:
            token = jwt.encode(claims, server.JWT_SECRET, algorithm=server.JWT_ALG)
            with self.assertRaises(HTTPException) as error:
                await server.get_current_admin(self.request('GET', cookie=token))
            self.assertEqual(error.exception.status_code, 401)
