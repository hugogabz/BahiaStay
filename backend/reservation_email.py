"""Reservation summaries and optional server-side transactional mail."""
import os
import re
from datetime import date
from html import escape
import requests
from starlette.concurrency import run_in_threadpool
from catalog_identity import enrich_catalog_identity


def mail_configured():
    return bool(os.environ.get('RESEND_API_KEY') and os.environ.get('RESERVATION_EMAIL_FROM'))


def build_confirmation(booking, prop, payment):
    address = booking.get('guest_contact', '') or ''
    local, separator, domain = address.partition('@')
    masked = (local[:1] + '***@' + domain) if separator else None
    return {'booking_id': booking['id'], 'check_in': booking['check_in'], 'check_out': booking['check_out'],
        'nights': (date.fromisoformat(booking['check_out']) - date.fromisoformat(booking['check_in'])).days,
        'guests': booking['guests'], 'amount': payment['amount'], 'currency': payment.get('currency', 'brl'),
        'email_address': masked, 'test_mode': True,
        'property': {'id': prop['id'], 'title': prop['title'], 'neighborhood': prop.get('neighborhood', ''),
            'destination': prop.get('destination', ''), 'host': (prop.get('host') or {}).get('name', ''),
            'description': prop.get('description', ''), 'amenities': prop.get('amenities', []),
            'guests': prop.get('guests'), 'bedrooms': prop.get('bedrooms'), 'beds': prop.get('beds'), 'baths': prop.get('baths'),
            'photo': next((p['url'] for p in prop.get('photos', []) if p.get('url')), None)}}


def send_confirmation(booking, summary):
    if not mail_configured():
        return {'status': 'not_configured'}
    address = booking.get('guest_contact', '') or ''
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', address):
        return {'status': 'missing_address'}
    prop = summary['property']
    money = f"R$ {summary['amount']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
    start = date.fromisoformat(summary['check_in']).strftime('%d/%m/%Y')
    end = date.fromisoformat(summary['check_out']).strftime('%d/%m/%Y')
    rows = [('Referência', summary['booking_id']), ('Casa', prop['title']), ('Localização', prop['neighborhood']),
        ('Entrada', start), ('Saída', end), ('Noites', summary['nights']), ('Hóspedes', summary['guests']), ('Valor confirmado', money)]
    text = 'Bahia Stay — confirmação da reserva\n\n' + '\n'.join(f'{label}: {value}' for label, value in rows)
    text += '\n\nPagamento em ambiente de teste, sem cobrança real. Este resumo não é uma nota fiscal.\nConfirme as instruções de chegada com o suporte.'
    html_rows = ''.join(f'<tr><th align="left" style="padding:12px;border-bottom:1px solid #e6dfd5">{escape(label)}</th><td style="padding:12px;border-bottom:1px solid #e6dfd5">{escape(str(value))}</td></tr>' for label, value in rows)
    html = f'<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#173f43"><h1>Bahia Stay</h1><h2>Sua reserva foi confirmada</h2><p>Olá, {escape(booking.get("guest_name") or "hóspede")}.</p><table style="width:100%;border-collapse:collapse">{html_rows}</table><p>Guarde este resumo e confirme as instruções de chegada com o suporte.</p><p style="font-size:12px;color:#62625f">Pagamento em ambiente de teste, sem cobrança real. Este resumo não é uma nota fiscal.</p></div>'
    try:
        response = requests.post('https://api.resend.com/emails', headers={
            'Authorization': 'Bearer ' + os.environ['RESEND_API_KEY'],
            'Idempotency-Key': 'reservation/' + booking['id']},
            json={'from': os.environ['RESERVATION_EMAIL_FROM'], 'to': [address],
                'subject': 'Bahia Stay — confirmação da sua reserva', 'html': html, 'text': text},
            timeout=10, allow_redirects=False)
        response.raise_for_status()
        message_id = response.json().get('id')
        if not message_id:
            raise ValueError('Missing email confirmation')
        return {'status': 'sent', 'message_id': message_id}
    except (requests.RequestException, ValueError):
        return {'status': 'failed'}


async def confirmation_for_payment(db, payment):
    if payment.get('payment_status') != 'paid':
        return None
    booking = await db.bookings.find_one({'id': payment.get('booking_id')}, {'_id': 0})
    if not booking or booking.get('status') != 'approved' or booking.get('payment_status') != 'paid':
        return None
    summary = payment.get('confirmation_summary')
    if not summary:
        prop = await db.properties.find_one({'id': booking['property_id']}, {'_id': 0})
        if not prop:
            return None
        summary = build_confirmation(booking, enrich_catalog_identity(prop), payment)
        await db.payment_transactions.update_one({'session_id': payment['session_id']}, {'$set': {'confirmation_summary': summary}})
    return {**summary, 'email_status': (payment.get('confirmation_email') or {}).get('status', 'not_configured' if not mail_configured() else 'pending')}


async def ensure_confirmation_email(db, payment):
    if payment.get('payment_status') != 'paid' or (payment.get('confirmation_email') or {}).get('status') in ('sent', 'failed', 'missing_address') or not mail_configured():
        return
    summary = await confirmation_for_payment(db, payment)
    if not summary:
        return
    booking = await db.bookings.find_one({'id': payment['booking_id']}, {'_id': 0})
    result = await run_in_threadpool(send_confirmation, booking, summary)
    await db.payment_transactions.update_one({'session_id': payment['session_id']}, {'$set': {'confirmation_email': result}})
