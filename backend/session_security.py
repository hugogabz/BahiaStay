"""Cookie policy and CSRF protection for the browser admin session."""
import os
from fastapi import HTTPException, Request


def trusted_origins():
    values = os.environ.get('CORS_ORIGINS', '').split(',')
    values.append(os.environ.get('FRONTEND_URL', ''))
    return list(dict.fromkeys(value.strip().rstrip('/') for value in values
        if value.strip().startswith(('https://', 'http://')) and '*' not in value))


def require_admin_request(request: Request):
    # A custom header forces browser preflight; the exact origin must also match.
    if (request.headers.get('X-CSRF-Protection') != '1'
            or request.headers.get('Origin') not in trusted_origins()):
        raise HTTPException(status_code=403, detail='Origem da requisição não autorizada')


def session_cookie_options(request: Request):
    local_http = request.url.scheme == 'http' and request.url.hostname in {'localhost', '127.0.0.1', '::1'}
    same_site = os.environ.get('AUTH_COOKIE_SAMESITE', 'lax' if local_http else 'none').lower()
    if same_site not in {'lax', 'strict', 'none'}:
        raise ValueError('AUTH_COOKIE_SAMESITE must be lax, strict or none')
    return {'httponly': True, 'secure': not local_http or same_site == 'none',
            'samesite': same_site, 'path': '/'}
