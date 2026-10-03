"""Coldpayments PIX adapter. External requests require a confirmed sandbox.

API contract: https://coldpayments.com/docs. No production charges are enabled.
"""
import hashlib
import hmac
import os
import re
import time
from urllib.parse import urlsplit

import requests


def sandbox_enabled():
    url = urlsplit(os.environ.get('COLDPAYMENTS_API_BASE_URL', ''))
    host = (url.hostname or '').lower().rstrip('.')
    return bool(os.environ.get('PAYMENT_PROVIDER') == 'coldpay'
        and os.environ.get('PAYMENTS_ENABLED') == 'true'
        and os.environ.get('COLDPAYMENTS_SANDBOX_CONFIRMED') == 'true'
        and os.environ.get('COLDPAYMENTS_API_KEY')
        and os.environ.get('COLDPAYMENTS_WEBHOOK_SECRET')
        and url.scheme == 'https' and host and not url.username and not url.password
        and not url.query and not url.fragment
        and host not in ('coldpayments.com', 'www.coldpayments.com'))


def verify_signature(body, timestamp, signature, secret, now=None):
    try:
        if not secret or abs((time.time() if now is None else now) - int(timestamp)) > 300:
            return False
        expected = hmac.new(secret.encode(), timestamp.encode() + b'.' + body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)
    except (TypeError, ValueError, AttributeError):
        return False


class Coldpayments:
    def _request(self, method, path, payload=None, idempotency=None):
        if not sandbox_enabled():
            raise ValueError('Sandbox Coldpayments não configurado')
        headers = {'X-API-Key': os.environ['COLDPAYMENTS_API_KEY'], 'Content-Type': 'application/json'}
        if idempotency:
            headers['X-Idempotency-Key'] = idempotency
        try:
            response = requests.request(method, os.environ['COLDPAYMENTS_API_BASE_URL'].rstrip('/') + path,
                json=payload, headers=headers, timeout=20, allow_redirects=False)
            if response.status_code not in (200, 201):
                raise ValueError('Gateway indisponível; tente novamente mais tarde')
            data = response.json()
            if not isinstance(data, dict):
                raise ValueError('Resposta inválida do gateway')
            return data
        except (requests.RequestException, requests.exceptions.JSONDecodeError):
            # Do not include gateway bodies, credentials or request objects in errors.
            raise ValueError('Não foi possível consultar o gateway') from None

    def create_pix(self, booking_id, amount_cents, title):
        if type(amount_cents) is not int or not 100 <= amount_cents <= 200000:
            raise ValueError('O PIX aceita reservas de R$ 1,00 a R$ 2.000,00')
        data = self._request('POST', '/payments', {
            'amountCents': amount_cents, 'method': 'PIX', 'description': f'Reserva — {title}',
            'product': title, 'expiresInSeconds': 1800, 'passThroughFee': False,
            'metadata': {'booking_id': booking_id},
        }, idempotency=f'booking-pix-{booking_id}')
        if (not isinstance(data.get('id'), str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', data['id'])
            or data.get('amountCents') != amount_cents or data.get('method') != 'PIX'
            or data.get('status') != 'AWAITING_PAYMENT'
            or not isinstance(data.get('copyPaste'), str)
            or not isinstance(data.get('qrCodeBase64'), str)
            or not data['qrCodeBase64'].startswith('data:image/png;base64,')):
            raise ValueError('Resposta PIX inválida; aguarde antes de tentar novamente')
        return data

    def get_payment(self, payment_id):
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', payment_id):
            raise ValueError('Identificador inválido')
        return self._request('GET', f'/payments/{payment_id}')
