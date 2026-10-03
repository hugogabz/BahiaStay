import hashlib
import hmac
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from coldpayments import Coldpayments, sandbox_enabled, verify_signature


class ColdpaymentsSafety(unittest.TestCase):
    def test_production_and_unconfirmed_environments_stay_disabled(self):
        config = {'PAYMENT_PROVIDER': 'coldpay', 'PAYMENTS_ENABLED': 'true',
                  'COLDPAYMENTS_SANDBOX_CONFIRMED': 'true', 'COLDPAYMENTS_API_KEY': 'private-example',
                  'COLDPAYMENTS_API_BASE_URL': 'https://sandbox.example/api/v1', 'COLDPAYMENTS_WEBHOOK_SECRET': 'example'}
        with patch.dict(os.environ, config):
            self.assertTrue(sandbox_enabled())
            for changes in ({'COLDPAYMENTS_SANDBOX_CONFIRMED': 'false'}, {'PAYMENTS_ENABLED': 'false'},
                            {'COLDPAYMENTS_API_BASE_URL': 'https://coldpayments.com/api/v1'},
                            {'COLDPAYMENTS_API_BASE_URL': 'http://sandbox.example/api/v1'},
                            {'COLDPAYMENTS_API_KEY': ''}, {'COLDPAYMENTS_WEBHOOK_SECRET': ''}):
                with patch.dict(os.environ, changes):
                    self.assertFalse(sandbox_enabled())

    def test_signature_checks_body_secret_and_five_minute_window(self):
        body = b'{"id":"pay_example","status":"PAID"}'
        signature = hmac.new(b'example', b'1000.' + body, hashlib.sha256).hexdigest()
        self.assertTrue(verify_signature(body, '1000', signature, 'example', now=1000))
        for payload, timestamp, secret, now in ((body + b' ', '1000', 'example', 1000),
                (body, '1000', 'wrong', 1000), (body, '1000', 'example', 1301),
                (body, '1000', 'example', 699), (body, 'invalid', 'example', 1000)):
            self.assertFalse(verify_signature(payload, timestamp, signature, secret, now=now))

    @patch('coldpayments.requests.request')
    def test_disabled_client_never_calls_network(self, request):
        with patch.dict(os.environ, {'PAYMENTS_ENABLED': 'false'}):
            with self.assertRaises(ValueError):
                Coldpayments().create_pix('booking-example', 10000, 'Casa')
        request.assert_not_called()


class ColdpaymentsSettlement(unittest.IsolatedAsyncioTestCase):
    async def test_only_matching_paid_pix_approves_booking(self):
        import server
        for status, amount, expected in [('AWAITING_PAYMENT', 10000, False), ('PAID', 1, False), ('PAID', 10000, True)]:
            transactions, bookings = AsyncMock(), AsyncMock()
            transactions.find_one.return_value = {'amount': 100, 'session_id': 'cp_example', 'booking_id': 'example'}
            with patch.object(server.db, 'payment_transactions', transactions), patch.object(server.db, 'bookings', bookings):
                await server.settle_pix({'id': 'pay_example', 'status': status, 'amountCents': amount})
            self.assertEqual(bookings.update_one.await_count, int(expected))

    async def test_disabled_checkout_and_webhook_never_contact_gateway(self):
        import server
        from fastapi import HTTPException
        with patch.dict(os.environ, {'PAYMENT_PROVIDER': 'coldpay', 'PAYMENTS_ENABLED': 'false'}), patch('coldpayments.requests.request') as request:
            with self.assertRaises(HTTPException) as checkout:
                await server.create_pix_checkout(Mock())
            with self.assertRaises(HTTPException) as webhook:
                await server.coldpayments_webhook(Mock())
            self.assertEqual(checkout.exception.status_code, 503)
            self.assertEqual(webhook.exception.status_code, 503)
            request.assert_not_called()

    @patch('coldpayments.sandbox_enabled', return_value=True)
    @patch('coldpayments.requests.request')
    def test_pix_uses_documented_fields_and_stable_idempotency(self, request, enabled):
        request.return_value = Mock(status_code=201)
        request.return_value.json.return_value = {'id': 'pay_example', 'amountCents': 10000,
            'method': 'PIX', 'status': 'AWAITING_PAYMENT', 'copyPaste': 'example',
            'qrCodeBase64': 'data:image/png;base64,ZXhhbXBsZQ==', 'expiresAt': '2030-01-01T00:30:00Z'}
        with patch.dict(os.environ, {'COLDPAYMENTS_API_BASE_URL': 'https://sandbox.example/api/v1', 'COLDPAYMENTS_API_KEY': 'private-example'}):
            client = Coldpayments()
            client.create_pix('booking-example', 10000, 'Casa')
            client.create_pix('booking-example', 10000, 'Casa')
        calls = request.call_args_list
        self.assertEqual(calls[0].kwargs['headers']['X-Idempotency-Key'], calls[1].kwargs['headers']['X-Idempotency-Key'])
        self.assertEqual(calls[0].kwargs['json']['amountCents'], 10000)
        self.assertFalse(calls[0].kwargs['json']['passThroughFee'])
        self.assertFalse(calls[0].kwargs['allow_redirects'])

    @patch('coldpayments.sandbox_enabled', return_value=True)
    @patch('coldpayments.requests.request')
    def test_limit_is_checked_before_network(self, request, enabled):
        for amount in (99, 200001):
            with self.assertRaises(ValueError):
                Coldpayments().create_pix('example', amount, 'Casa')
        request.assert_not_called()
