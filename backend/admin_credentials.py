"""Use this deployment's configured credentials, independent of legacy DB hashes."""
import hmac
import os


def credentials_match(email, password):
    configured_login = os.environ.get('ADMIN_EMAIL', '').strip().lower()
    configured_password = os.environ.get('ADMIN_PASSWORD', '')
    if not configured_login or not configured_password:
        return False
    return (hmac.compare_digest(email.strip().lower().encode(), configured_login.encode())
            and hmac.compare_digest(password.encode(), configured_password.encode()))
