import os
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from reservation_email import build_confirmation, send_confirmation, ensure_confirmation_email, confirmation_for_payment

BOOKING = {'id':'booking-test','status':'approved','payment_status':'paid','check_in':'2030-12-21','check_out':'2030-12-25','guests':2,'guest_name':'Maria','guest_contact':'maria@example.com','property_id':'house-test'}
PROPERTY = {'id':'house-test','title':'Casa <praia>','neighborhood':'Centro','destination':'arraial','photos':[{'url':'https://example.com/photo.jpg'}],'host':{'name':'Ana'}}
PAYMENT = {'session_id':'test-session','booking_id':'booking-test','payment_status':'paid','amount':1848,'currency':'brl'}

class ReservationEmailTests(unittest.TestCase):
    def test_confirmation_preserves_paid_amount_and_masks_contact(self):
        result=build_confirmation(BOOKING, PROPERTY, PAYMENT)
        self.assertEqual(result['nights'],4)
        self.assertEqual(result['amount'],1848)
        self.assertNotIn('guest_contact',result)
        self.assertNotIn('maria@example.com',str(result))

    @patch('reservation_email.requests.post')
    def test_no_configuration_never_sends(self, post):
        with patch.dict(os.environ, {'RESEND_API_KEY':'','RESERVATION_EMAIL_FROM':''}):
            self.assertEqual(send_confirmation(BOOKING,build_confirmation(BOOKING,PROPERTY,PAYMENT))['status'],'not_configured')
        post.assert_not_called()

    @patch('reservation_email.requests.post')
    def test_email_is_escaped_and_uses_idempotency(self, post):
        post.return_value=Mock(status_code=200)
        post.return_value.json.return_value={'id':'email-test'}
        with patch.dict(os.environ, {'RESEND_API_KEY':'test-private','RESERVATION_EMAIL_FROM':'reservas@example.com'}):
            result=send_confirmation(BOOKING,build_confirmation(BOOKING,PROPERTY,PAYMENT))
        self.assertEqual(result['status'],'sent')
        self.assertIn('Casa &lt;praia&gt;',post.call_args.kwargs['json']['html'])
        self.assertEqual(post.call_args.kwargs['headers']['Idempotency-Key'],'reservation/booking-test')
        self.assertFalse(post.call_args.kwargs['allow_redirects'])

    @patch('reservation_email.requests.post')
    def test_provider_failure_never_claims_sent(self, post):
        post.return_value=Mock(status_code=400)
        post.return_value.raise_for_status.side_effect=__import__('requests').HTTPError()
        with patch.dict(os.environ, {'RESEND_API_KEY':'test-private','RESERVATION_EMAIL_FROM':'reservas@example.com'}):
            self.assertEqual(send_confirmation(BOOKING,build_confirmation(BOOKING,PROPERTY,PAYMENT))['status'],'failed')

class NotificationSafety(unittest.IsolatedAsyncioTestCase):
    async def test_pending_booking_never_returns_confirmed_details(self):
        db=Mock(bookings=AsyncMock(), properties=AsyncMock(), payment_transactions=AsyncMock())
        db.bookings.find_one.return_value={**BOOKING,'status':'pending'}
        self.assertIsNone(await confirmation_for_payment(db,PAYMENT))
        db.properties.find_one.assert_not_awaited()

    async def test_paid_booking_snapshots_house_and_persists_email_result(self):
        db=Mock(bookings=AsyncMock(), properties=AsyncMock(), payment_transactions=AsyncMock())
        db.bookings.find_one.return_value=BOOKING
        db.properties.find_one.return_value=PROPERTY
        with patch.dict(os.environ, {'RESEND_API_KEY':'test-private','RESERVATION_EMAIL_FROM':'reservas@example.com'}), patch('reservation_email.send_confirmation',return_value={'status':'sent','message_id':'email-test'}) as send:
            await ensure_confirmation_email(db,PAYMENT)
        send.assert_called_once()
        updates=[call.args[1]['$set'] for call in db.payment_transactions.update_one.await_args_list]
        self.assertEqual(updates[-1]['confirmation_email']['status'],'sent')
        self.assertEqual(updates[0]['confirmation_summary']['amount'],1848)

    async def test_unpaid_never_sends(self):
        db=Mock()
        with patch('reservation_email.send_confirmation') as send:
            await ensure_confirmation_email(db,{**PAYMENT,'payment_status':'pending'})
        send.assert_not_called()

    async def test_sent_confirmation_is_not_repeated(self):
        db=Mock()
        with patch('reservation_email.send_confirmation') as send:
            await ensure_confirmation_email(db,{**PAYMENT,'confirmation_email':{'status':'sent'}})
        send.assert_not_called()
