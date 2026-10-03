import sys
import os
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


class SettlementSafety(unittest.IsolatedAsyncioTestCase):
    def test_test_checkout_requires_explicit_enable_and_test_key(self):
        for enabled, key, expected in [('false', 'sk_test_example', False), ('true', 'sk_live_example', False), ('true', '', False), ('true', 'sk_test_example', True)]:
            with patch.dict(os.environ, {'PAYMENT_PROVIDER': 'stripe', 'PAYMENTS_ENABLED': enabled, 'STRIPE_SECRET_KEY': key}):
                self.assertEqual(server.test_payments_enabled(), expected)

    async def test_paid_matching_test_payment_is_confirmed(self):
        transactions = AsyncMock()
        transactions.find_one.return_value = {'booking_id': 'example', 'amount': 100, 'currency': 'brl', 'payment_status': 'pending'}
        bookings = AsyncMock()
        with patch.object(server.db, 'payment_transactions', transactions), patch.object(server.db, 'bookings', bookings):
            await server._settle_paid_session('cs_test_example', {'payment_status': 'paid', 'livemode': False, 'amount_total': 10000, 'currency': 'brl'})
        bookings.update_one.assert_awaited_once()
        self.assertEqual(bookings.update_one.await_args.args[1]['$set']['payment_status'], 'paid')

    async def test_duplicate_confirmation_does_not_repeat_updates(self):
        transactions = AsyncMock()
        transactions.find_one.return_value = {'payment_status': 'paid'}
        with patch.object(server.db, 'payment_transactions', transactions):
            await server._settle_paid_session('cs_test_example', {'payment_status': 'paid'})
        transactions.update_one.assert_not_awaited()

    async def check_rejected(self, session):
        transactions = AsyncMock()
        transactions.find_one.return_value = {'session_id': 'cs_test_example', 'booking_id': 'example', 'amount': 100, 'currency': 'brl', 'payment_status': 'pending'}
        bookings = AsyncMock()
        with patch.object(server.db, 'payment_transactions', transactions), patch.object(server.db, 'bookings', bookings):
            await server._settle_paid_session('cs_test_example', session)
        transactions.update_one.assert_not_awaited()
        bookings.update_one.assert_not_awaited()

    async def test_completed_but_unpaid_is_not_confirmed(self):
        await self.check_rejected({'payment_status': 'unpaid', 'status': 'complete', 'livemode': False, 'amount_total': 10000, 'currency': 'brl'})

    async def test_wrong_amount_is_not_confirmed(self):
        await self.check_rejected({'payment_status': 'paid', 'livemode': False, 'amount_total': 1, 'currency': 'brl'})

    async def test_live_payment_is_not_confirmed_in_test_integration(self):
        await self.check_rejected({'payment_status': 'paid', 'livemode': True, 'amount_total': 10000, 'currency': 'brl'})


if __name__ == '__main__':
    unittest.main()
