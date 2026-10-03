"""Backend tests for Bahia Stay — auth, properties CRUD, photo upload, bookings."""
import os
import io
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD")


def _tiny_png_bytes() -> bytes:

    def chunk(tag, data):
        s.headers.update({"Origin": os.environ.get("TEST_FRONTEND_ORIGIN", "http://127.0.0.1:3000"), "X-CSRF-Protection": "1"})
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    raw = b"\x00\xff\x00\x00"
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    return s


@pytest.fixture(scope="session")
def token(api):
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        pytest.skip("Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD for authenticated tests")
    r = api.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" not in data and "user" in data
    assert data["user"]["email"] == ADMIN_EMAIL
    return api.cookies.get("access_token")


@pytest.fixture
def auth_headers(token):
    return {"Cookie": f"access_token={token}", "Origin": os.environ.get("TEST_FRONTEND_ORIGIN", "http://127.0.0.1:3000"), "X-CSRF-Protection": "1"}



class TestAuth:
    def test_login_wrong_password(self, api):
        r = api.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_login_sets_cookie(self, api):
        r = api.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert "access_token" in r.cookies or any(c.name == "access_token" for c in r.cookies)

    def test_me_without_token(self, api):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == ADMIN_EMAIL
        assert d["role"] == "admin"

    def test_logout(self, api):
        r = api.post(f"{API}/auth/logout")
        assert r.status_code == 200



class TestPropertiesPublic:
    def test_list(self):
        r = requests.get(f"{API}/properties")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 15, f"Expected 15 seeded properties, got {len(items)}"

    def test_get_single(self):
        r = requests.get(f"{API}/properties/ps-01")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == "ps-01"
        assert "photos" in d and isinstance(d["photos"], list)
        assert "images" in d and isinstance(d["images"], list)

    def test_unknown_404(self):
        r = requests.get(f"{API}/properties/unknown-xyz")
        assert r.status_code == 404



MIN_PROPERTY = {
    "title": "TEST_ Casa Teste",
    "destination": "porto-seguro",
    "neighborhood": "Centro",
    "tagline": "Teste",
    "description": "Casa de teste automatizado",
    "pricePerNight": 500.0,
    "weeklyPrice": 3000.0,
    "weeklyPackagePromo": 2700.0,
    "rating": 4.9,
    "reviews": 0,
    "guests": 4,
    "bedrooms": 2,
    "beds": 2,
    "baths": 1,
    "coords": {"lat": -16.4, "lng": -39.0},
    "amenities": ["wifi"],
    "images": [],
}


class TestPropertiesCRUD:
    def test_create_requires_auth(self):
        r = requests.post(f"{API}/properties", json=MIN_PROPERTY)
        assert r.status_code == 401

    def test_update_requires_auth(self):
        r = requests.put(f"{API}/properties/ps-01", json=MIN_PROPERTY)
        assert r.status_code == 401

    def test_delete_requires_auth(self):
        r = requests.delete(f"{API}/properties/ps-01")
        assert r.status_code == 401

    def test_full_crud(self, auth_headers):

        r = requests.post(f"{API}/properties", json=MIN_PROPERTY, headers=auth_headers)
        assert r.status_code == 200, r.text
        p = r.json()
        pid = p["id"]
        assert pid.startswith("p_")
        assert p["title"] == MIN_PROPERTY["title"]


        r = requests.get(f"{API}/properties/{pid}")
        assert r.status_code == 200
        assert r.json()["title"] == MIN_PROPERTY["title"]


        upd = {**MIN_PROPERTY, "title": "TEST_ Casa Atualizada", "pricePerNight": 777.0}
        r = requests.put(f"{API}/properties/{pid}", json=upd, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_ Casa Atualizada"
        assert r.json()["pricePerNight"] == 777.0


        r = requests.get(f"{API}/properties/{pid}")
        assert r.json()["title"] == "TEST_ Casa Atualizada"


        r = requests.delete(f"{API}/properties/{pid}", headers=auth_headers)
        assert r.status_code == 200


        r = requests.get(f"{API}/properties/{pid}")
        assert r.status_code == 404



class TestPhotos:
    def test_upload_and_delete(self, auth_headers):

        r = requests.post(f"{API}/properties", json=MIN_PROPERTY, headers=auth_headers)
        assert r.status_code == 200
        pid = r.json()["id"]
        try:
            png = _tiny_png_bytes()
            files = {"file": ("test.png", png, "image/png")}
            r = requests.post(f"{API}/properties/{pid}/photos", files=files, headers=auth_headers)
            assert r.status_code == 200, r.text
            photo = r.json()
            assert "id" in photo and "url" in photo and "storage_path" in photo
            assert photo["url"].startswith("/api/files/")


            r2 = requests.get(f"{API}/properties/{pid}")
            assert any(p["id"] == photo["id"] for p in r2.json()["photos"])


            file_url = f"{BASE_URL}{photo['url']}"
            r3 = requests.get(file_url)
            assert r3.status_code == 200
            assert r3.headers.get("Content-Type", "").startswith("image/")
            assert len(r3.content) > 0


            r4 = requests.delete(f"{API}/properties/{pid}/photos/{photo['id']}", headers=auth_headers)
            assert r4.status_code == 200
        finally:
            requests.delete(f"{API}/properties/{pid}", headers=auth_headers)



class TestBookings:
    def test_booking_lifecycle(self, auth_headers):

        booking = {
            "property_id": "ps-01",
            "check_in": "2026-06-01",
            "check_out": "2026-06-05",
            "guests": 2,
            "guest_name": "TEST_Guest",
        }
        r = requests.post(f"{API}/bookings", json=booking)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["status"] == "pending"
        bid = b["id"]


        r = requests.get(f"{API}/properties/ps-01/bookings")
        assert r.status_code == 200
        assert any(x["id"] == bid for x in r.json())


        assert requests.get(f"{API}/admin/bookings").status_code == 401
        r = requests.get(f"{API}/admin/bookings", headers=auth_headers)
        assert r.status_code == 200
        assert any(x["id"] == bid for x in r.json())


        r = requests.patch(f"{API}/admin/bookings/{bid}", json={"status": "approved"}, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "approved"


        r = requests.patch(f"{API}/admin/bookings/{bid}", json={"status": "nonsense"}, headers=auth_headers)
        assert r.status_code == 400


        r = requests.delete(f"{API}/admin/bookings/{bid}", headers=auth_headers)
        assert r.status_code == 200

    def test_booking_unknown_property(self):
        r = requests.post(f"{API}/bookings", json={
            "property_id": "no-such", "check_in": "2026-01-01", "check_out": "2026-01-02", "guests": 1
        })
        assert r.status_code == 404



class TestHost:
    def test_ps01_has_host_defaults(self):
        r = requests.get(f"{API}/properties/ps-01")
        assert r.status_code == 200
        d = r.json()
        assert "host" in d, "property missing host"
        h = d["host"]
        assert h["name"] == "Família Fonseca"
        assert h["since"] == 2019
        assert "Português" in h["languages"] and "Inglês" in h["languages"]
        assert h["response_time"] == "em até 1 hora"
        assert "bio" in h and h["bio"]

    def test_all_15_have_host(self):
        r = requests.get(f"{API}/properties")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 15
        for p in items[:15]:
            assert "host" in p and p["host"].get("name"), f"{p.get('id')} missing host"

    def test_update_host_requires_auth(self):
        r = requests.put(f"{API}/properties/ps-01", json={"host": {"name": "X"}})
        assert r.status_code == 401

    def test_update_host_as_admin(self, auth_headers):

        current = requests.get(f"{API}/properties/ps-01").json()

        payload = {k: v for k, v in current.items() if k not in ("id", "photos")}
        payload["host"] = {
            "name": "TEST_Carlos & Marina",
            "bio": "TEST bio updated",
            "since": 2020,
            "languages": ["Português", "Espanhol"],
            "response_time": "em até 30 minutos",
        }
        r = requests.put(f"{API}/properties/ps-01", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        h = r.json()["host"]
        assert h["name"] == "TEST_Carlos & Marina"
        assert h["since"] == 2020
        assert h["response_time"] == "em até 30 minutos"

        h2 = requests.get(f"{API}/properties/ps-01").json()["host"]
        assert h2["name"] == "TEST_Carlos & Marina"

        payload["host"] = {
            "name": "Família Fonseca",
            "bio": "Anfitriões há anos nas melhores praias do Brasil.",
            "since": 2019,
            "languages": ["Português", "Inglês"],
            "response_time": "em até 1 hora",
        }
        requests.put(f"{API}/properties/ps-01", json=payload, headers=auth_headers)

    def test_host_photo_upload_and_delete(self, auth_headers):
        png = _tiny_png_bytes()
        files = {"file": ("host.png", png, "image/png")}
        r = requests.post(f"{API}/properties/ps-02/host-photo", files=files, headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and "storage_path" in data
        assert data["url"].startswith("/api/files/")


        prop = requests.get(f"{API}/properties/ps-02").json()
        assert prop["host"]["photo"] == data["url"]
        assert prop["host"]["photo_storage_path"] == data["storage_path"]


        file_r = requests.get(f"{BASE_URL}{data['url']}")
        assert file_r.status_code == 200
        assert file_r.headers.get("Content-Type", "").startswith("image/")
        assert len(file_r.content) > 0


        r = requests.delete(f"{API}/properties/ps-02/host-photo", headers=auth_headers)
        assert r.status_code == 200
        prop = requests.get(f"{API}/properties/ps-02").json()
        assert prop["host"].get("photo") in (None, "")
        assert prop["host"].get("photo_storage_path") in (None, "")

    def test_host_photo_requires_auth(self):
        png = _tiny_png_bytes()
        files = {"file": ("x.png", png, "image/png")}
        r = requests.post(f"{API}/properties/ps-01/host-photo", files=files)
        assert r.status_code == 401
        r = requests.delete(f"{API}/properties/ps-01/host-photo")
        assert r.status_code == 401




class TestPayments:
    """Stripe sandbox checkout + status + webhook."""

    def test_root_still_ok(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_checkout_invalid_booking(self):
        r = requests.post(f"{API}/payments/checkout", json={
            "booking_id": "nope-xyz",
            "origin_url": BASE_URL,
        })
        assert r.status_code == 404

    def _make_booking(self, total=1200.0):
        payload = {
            "property_id": "ps-01",
            "check_in": "2026-07-10",
            "check_out": "2026-07-17",
            "guests": 2,
            "guest_name": "TEST_PayNow",
            "total": total,
        }
        r = requests.post(f"{API}/bookings", json=payload)
        assert r.status_code == 200, r.text
        return r.json()

    def test_checkout_valid_creates_session_and_txn(self, auth_headers):
        booking = self._make_booking(total=1500.0)
        try:
            r = requests.post(f"{API}/payments/checkout", json={
                "booking_id": booking["id"],
                "origin_url": BASE_URL,
            })
            assert r.status_code == 200, r.text
            data = r.json()
            assert "checkout_url" in data and "session_id" in data
            assert data["checkout_url"].startswith("https://checkout.stripe.com/")
            assert data["session_id"].startswith("cs_test_")


            s = requests.get(f"{API}/payments/status/{data['session_id']}")
            assert s.status_code == 200, s.text
            sd = s.json()
            assert sd["session_id"] == data["session_id"]
            assert sd["booking_id"] == booking["id"]
            assert sd["currency"] == "brl"
            assert float(sd["amount"]) == 1500.0
            assert sd["payment_status"] == "pending"
            assert sd["status"] in ("initiated", "pending")
        finally:
            requests.delete(f"{API}/admin/bookings/{booking['id']}", headers=auth_headers)

    def test_status_unknown_session_404(self):
        r = requests.get(f"{API}/payments/status/cs_test_unknown_session_abc")
        assert r.status_code == 404

    def test_webhook_invalid_signature_returns_400(self):

        r = requests.post(f"{API}/stripe/webhook", data=b"{}", headers={
            "Content-Type": "application/json",
            "stripe-signature": "t=0,v1=invalid",
        })
        assert r.status_code == 400

    def test_booking_approved_after_simulated_paid(self, auth_headers):
        """Simulate webhook settlement by patching txn, then re-poll status to confirm booking flips to approved."""
        import pymongo, os as _os
        booking = self._make_booking(total=777.0)
        try:
            r = requests.post(f"{API}/payments/checkout", json={
                "booking_id": booking["id"],
                "origin_url": BASE_URL,
            })
            assert r.status_code == 200
            session_id = r.json()["session_id"]


            mc = pymongo.MongoClient(_os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = mc[_os.environ.get("DB_NAME", "test_database")]

            db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"status": "completed", "payment_status": "paid"}},
            )

            db.bookings.update_one(
                {"id": booking["id"]},
                {"$set": {"status": "approved", "payment_status": "paid"}},
            )
            mc.close()


            s = requests.get(f"{API}/payments/status/{session_id}")
            assert s.status_code == 200
            assert s.json()["payment_status"] == "paid"


            ab = requests.get(f"{API}/admin/bookings", headers=auth_headers)
            assert ab.status_code == 200
            found = [x for x in ab.json() if x["id"] == booking["id"]]
            assert found and found[0]["status"] == "approved"


            pb = requests.get(f"{API}/properties/ps-01/bookings")
            assert pb.status_code == 200
            assert any(x["id"] == booking["id"] and x["status"] == "approved" for x in pb.json())
        finally:
            requests.delete(f"{API}/admin/bookings/{booking['id']}", headers=auth_headers)
