"""Bahia Stay backend — public API + admin CRUD + bookings + photo uploads.

Env variables required (see /app/backend/.env):
  MONGO_URL, DB_NAME, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD,
  EMERGENT_LLM_KEY (for object storage), APP_NAME, CORS_ORIGINS
"""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import json
import uuid
import logging
import bcrypt
import jwt
import stripe
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Request, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict, model_validator
from io import BytesIO
from booking_price import price_booking
from coldpayments import Coldpayments, sandbox_enabled, verify_signature
from starlette.concurrency import run_in_threadpool


database_url = os.environ.get('DATABASE_URL')
if database_url:
    from postgres_store import PostgresStore
    client = db = PostgresStore(database_url)
else:
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]


STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = os.environ.get("APP_NAME", "bahia-stay")
storage_key: Optional[str] = None

def init_storage(force: bool = False) -> str:
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple[bytes, str]:
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key}, timeout=60,
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


JWT_ALG = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def get_current_admin(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


class LoginRequest(BaseModel):
    email: str = Field(min_length=1, max_length=254)
    password: str

class LoginResponse(BaseModel):
    access_token: str
    user: dict

class Coords(BaseModel):
    lat: float
    lng: float

class PropertyPhoto(BaseModel):
    id: str
    url: str
    storage_path: Optional[str] = None

class HostInfo(BaseModel):
    name: str = "Família Fonseca"
    bio: str = "Anfitriões há anos nas melhores praias do Brasil."
    photo: Optional[str] = None
    photo_storage_path: Optional[str] = None
    since: Optional[int] = 2019
    languages: List[str] = ["Português", "Inglês"]
    response_time: str = "em até 1 hora"

class SeasonalPricing(BaseModel):
    newYearPercent: float = Field(default=40, ge=0, le=300)
    julyPercent: float = Field(default=20, ge=0, le=300)

class UnavailablePeriod(BaseModel):
    check_in: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    check_out: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")

    @model_validator(mode="after")
    def validate_period(self):
        start = datetime.strptime(self.check_in, "%Y-%m-%d")
        end = datetime.strptime(self.check_out, "%Y-%m-%d")
        if end <= start:
            raise ValueError("A saída deve ser depois da entrada.")
        return self

class PropertyIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str
    destination: str
    neighborhood: str
    tagline: str
    description: str
    pricePerNight: float
    weeklyPrice: float
    weeklyPackagePromo: float
    seasonalPricing: SeasonalPricing = Field(default_factory=SeasonalPricing)
    unavailableDates: List[UnavailablePeriod] = []
    rating: float = 4.9
    reviews: int = 0
    guests: int
    bedrooms: int
    beds: int
    baths: float
    coords: Coords
    amenities: List[str] = []
    images: List[str] = []
    host: HostInfo = Field(default_factory=HostInfo)

class PropertyOut(PropertyIn):
    id: str
    photos: List[PropertyPhoto] = []

class BookingCreate(BaseModel):
    property_id: str
    check_in: str
    check_out: str
    guests: int = Field(ge=1, le=100)
    guest_name: Optional[str] = None
    guest_contact: Optional[str] = None
    total: Optional[float] = None

class BookingStatusUpdate(BaseModel):
    status: str

class CheckoutRequest(BaseModel):
    booking_id: str
    origin_url: str


stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

def test_payments_enabled():
    key = os.environ.get("STRIPE_SECRET_KEY", "")
    return (os.environ.get('PAYMENT_PROVIDER', 'coldpay') == 'stripe'
            and os.environ.get("PAYMENTS_ENABLED", "false").lower() == "true"
            and key.startswith(("sk_test_", "rk_test_")))


app = FastAPI(title="Bahia Stay API")
api_router = APIRouter(prefix="/api")


@app.on_event("startup")
async def startup():
    if database_url:
        await db.initialize()

    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.properties.create_index("id", unique=True)
    await db.bookings.create_index("property_id")
    await db.payment_transactions.create_index("session_id", unique=True)


    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Administrador",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Admin seeded: %s", admin_email)
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )
        logger.info("Admin password updated for %s", admin_email)


    count = await db.properties.count_documents({})
    if count == 0:
        seed_path = ROOT_DIR / "seed_properties.json"
        if seed_path.exists():
            with open(seed_path, "r", encoding="utf-8") as f:
                items = json.load(f)
            for item in items:
                item["photos"] = [
                    {"id": f"ph_{uuid.uuid4().hex[:10]}", "url": u, "storage_path": None}
                    for u in item.get("images", [])
                ]
                item.setdefault("host", HostInfo().model_dump())
                item["created_at"] = datetime.now(timezone.utc).isoformat()
                item["updated_at"] = item["created_at"]
            await db.properties.insert_many(items)
            logger.info("Seeded %d properties", len(items))


    default_host = HostInfo().model_dump()
    await db.properties.update_many(
        {"host": {"$exists": False}},
        {"$set": {"host": default_host}},
    )


    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.warning("Storage init deferred: %s", e)


@api_router.post("/auth/login", response_model=LoginResponse)
async def login(body: LoginRequest, response: Response):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")
    token = create_access_token(user["user_id"], email)

    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=7 * 24 * 3600, path="/",
    )
    safe_user = {
        "user_id": user["user_id"], "email": user["email"],
        "name": user.get("name", ""), "role": user.get("role", "admin"),
    }
    return {"access_token": token, "user": safe_user}

@api_router.get("/auth/me")
async def me(current: dict = Depends(get_current_admin)):
    return current

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


def _normalize_property(doc: dict) -> dict:
    out = {k: v for k, v in doc.items() if k != "_id"}

    photos = out.get("photos") or []
    if not photos and out.get("images"):
        photos = [{"id": f"ph_{i}", "url": u, "storage_path": None} for i, u in enumerate(out["images"])]
    out["photos"] = photos

    out["images"] = [p["url"] for p in photos]
    return out

@api_router.get("/properties")
async def list_properties():
    cursor = db.properties.find({}, {"_id": 0})
    items = [doc async for doc in cursor]
    reservations = [b async for b in db.bookings.find(
        {"status": {"$in": ["pending", "approved"]}},
        {"_id": 0, "property_id": 1, "check_in": 1, "check_out": 1},
    )]
    for item in items:
        item["bookedDates"] = [
            {"check_in": b["check_in"], "check_out": b["check_out"]}
            for b in reservations if b["property_id"] == item["id"]
        ]
    return [_normalize_property(d) for d in items]

@api_router.get("/properties/{pid}")
async def get_property(pid: str):
    doc = await db.properties.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Property not found")
    booked = [b async for b in db.bookings.find(
        {"property_id": pid, "status": {"$in": ["pending", "approved"]}},
        {"_id": 0, "check_in": 1, "check_out": 1},
    )]
    doc["bookedDates"] = booked
    return _normalize_property(doc)

@api_router.post("/properties")
async def create_property(body: PropertyIn, _: dict = Depends(get_current_admin)):
    pid = f"p_{uuid.uuid4().hex[:10]}"
    doc = body.model_dump()
    doc["id"] = pid
    doc["photos"] = [
        {"id": f"ph_{uuid.uuid4().hex[:10]}", "url": u, "storage_path": None}
        for u in doc.get("images", [])
    ]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["updated_at"] = doc["created_at"]
    await db.properties.insert_one(doc)
    doc.pop("_id", None)
    return _normalize_property(doc)

@api_router.put("/properties/{pid}")
async def update_property(pid: str, body: PropertyIn, _: dict = Depends(get_current_admin)):
    existing = await db.properties.find_one({"id": pid})
    if not existing:
        raise HTTPException(status_code=404, detail="Property not found")
    update = body.model_dump()
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    update.pop("images", None)
    await db.properties.update_one({"id": pid}, {"$set": update})
    doc = await db.properties.find_one({"id": pid}, {"_id": 0})
    return _normalize_property(doc)

@api_router.delete("/properties/{pid}")
async def delete_property(pid: str, _: dict = Depends(get_current_admin)):
    res = await db.properties.delete_one({"id": pid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Property not found")
    await db.bookings.delete_many({"property_id": pid})
    return {"ok": True}


@api_router.post("/properties/{pid}/photos")
async def upload_photo(pid: str, file: UploadFile = File(...), _: dict = Depends(get_current_admin)):
    prop = await db.properties.find_one({"id": pid})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    ext = (file.filename or "jpg").rsplit(".", 1)[-1].lower() or "jpg"
    if ext not in ("jpg", "jpeg", "png", "webp", "gif"):
        raise HTTPException(status_code=400, detail="Only image files are accepted")
    data = await file.read()
    photo_id = f"ph_{uuid.uuid4().hex[:12]}"
    path = f"{APP_NAME}/properties/{pid}/{photo_id}.{ext}"
    content_type = file.content_type or f"image/{ 'jpeg' if ext == 'jpg' else ext }"
    try:
        put_object(path, data, content_type)
    except Exception as e:
        logger.exception("Upload failed")
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")
    photo = {"id": photo_id, "url": f"/api/files/{path}", "storage_path": path}
    await db.properties.update_one(
        {"id": pid},
        {"$push": {"photos": photo}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return photo

@api_router.delete("/properties/{pid}/photos/{photo_id}")
async def delete_photo(pid: str, photo_id: str, _: dict = Depends(get_current_admin)):
    res = await db.properties.update_one(
        {"id": pid},
        {"$pull": {"photos": {"id": photo_id}}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=404, detail="Photo not found")
    return {"ok": True}

@api_router.post("/properties/{pid}/host-photo")
async def upload_host_photo(pid: str, file: UploadFile = File(...), _: dict = Depends(get_current_admin)):
    prop = await db.properties.find_one({"id": pid})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    ext = (file.filename or "jpg").rsplit(".", 1)[-1].lower() or "jpg"
    if ext not in ("jpg", "jpeg", "png", "webp"):
        raise HTTPException(status_code=400, detail="Only image files are accepted")
    data = await file.read()
    path = f"{APP_NAME}/hosts/{pid}/{uuid.uuid4().hex[:12]}.{ext}"
    content_type = file.content_type or f"image/{ 'jpeg' if ext == 'jpg' else ext }"
    try:
        put_object(path, data, content_type)
    except Exception as e:
        logger.exception("Host upload failed")
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")
    url = f"/api/files/{path}"
    await db.properties.update_one(
        {"id": pid},
        {"$set": {
            "host.photo": url,
            "host.photo_storage_path": path,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"url": url, "storage_path": path}

@api_router.delete("/properties/{pid}/host-photo")
async def delete_host_photo(pid: str, _: dict = Depends(get_current_admin)):
    await db.properties.update_one(
        {"id": pid},
        {"$set": {"host.photo": None, "host.photo_storage_path": None,
                   "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True}

@api_router.get("/files/{path:path}")
async def download(path: str):
    try:
        data, content_type = get_object(path)
    except Exception:
        raise HTTPException(status_code=404, detail="File not found")
    return StreamingResponse(BytesIO(data), media_type=content_type)


@api_router.get("/properties/{pid}/bookings")
async def list_property_bookings(pid: str):
    cursor = db.bookings.find(
        {"property_id": pid, "status": {"$in": ["pending", "approved"]}},
        {"_id": 0, "status": 1, "check_in": 1, "check_out": 1},
    )
    return [doc async for doc in cursor]

@api_router.post("/bookings")
async def create_booking(body: BookingCreate):
    prop = await db.properties.find_one({"id": body.property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    doc = body.model_dump()
    reservations = [item async for item in db.bookings.find({"property_id": body.property_id, "status": {"$in": ["pending", "approved"]}})]
    try:
        doc['total'] = price_booking(prop, body.check_in, body.check_out, body.guests, reservations)
    except (ValueError, KeyError, TypeError):
        raise HTTPException(400, 'Datas, disponibilidade ou hóspedes inválidos')
    doc["id"] = f"b_{uuid.uuid4().hex[:12]}"
    doc["status"] = "pending"
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["property_title"] = prop.get("title", "")
    await db.bookings.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/admin/bookings")
async def admin_bookings(_: dict = Depends(get_current_admin)):
    cursor = db.bookings.find({}, {"_id": 0}).sort("created_at", -1)
    return [doc async for doc in cursor]

@api_router.patch("/admin/bookings/{bid}")
async def admin_update_booking(bid: str, body: BookingStatusUpdate, _: dict = Depends(get_current_admin)):
    if body.status not in ("pending", "approved", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.bookings.update_one({"id": bid}, {"$set": {"status": body.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    doc = await db.bookings.find_one({"id": bid}, {"_id": 0})
    return doc

@api_router.delete("/admin/bookings/{bid}")
async def admin_delete_booking(bid: str, _: dict = Depends(get_current_admin)):
    res = await db.bookings.delete_one({"id": bid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"ok": True}


@api_router.get("/")
async def root():
    return {"ok": True, "service": "bahia-stay"}


@api_router.get("/payments/config")
async def payment_config():
    return {'enabled': (sandbox_enabled() or test_payments_enabled()) and bool(os.environ.get('FRONTEND_URL')), 'provider': os.environ.get('PAYMENT_PROVIDER', 'coldpay'), 'test_mode': True}

@api_router.post("/payments/checkout")
async def create_payment_checkout(req: CheckoutRequest, request: Request):
    if os.environ.get('PAYMENT_PROVIDER') == 'coldpay':
        return await create_pix_checkout(req)
    if not test_payments_enabled():
        raise HTTPException(503, "Pagamentos de teste não configurados")
    origin = os.environ.get('FRONTEND_URL', '').rstrip('/')
    if not origin or req.origin_url.rstrip('/') != origin:
        raise HTTPException(400, 'Endereço de retorno não autorizado')
    booking = await db.bookings.find_one({"id": req.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva não encontrada")
    prop = await db.properties.find_one({"id": booking["property_id"]}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Casa não encontrada")

    if booking.get('status') != 'pending' or booking.get('stripe_session_id'):
        raise HTTPException(409, 'Esta reserva já foi processada')
    reservations = [item async for item in db.bookings.find({'property_id': booking['property_id'], 'id': {'$ne': booking['id']}, 'status': {'$in': ['pending', 'approved']}})]
    try:
        amount = price_booking(prop, booking['check_in'], booking['check_out'], booking['guests'], reservations)
    except (ValueError, KeyError, TypeError):
        raise HTTPException(409, 'O período não está mais disponível')
    if amount < 1:
        raise HTTPException(status_code=400, detail="Valor da reserva inválido")

    cover = ""
    if prop.get("photos"):
        cover_url = prop["photos"][0].get("url", "")
        if cover_url.startswith("http"):
            cover = cover_url

    kwargs = dict(
        mode="payment",
        line_items=[{
            "price_data": {
                "currency": "brl",
                "unit_amount": int(round(amount * 100)),
                "product_data": {
                    "name": f"Reserva — {prop['title']}",
                    "description": f"{booking['check_in']} → {booking['check_out']} · {booking['guests']} hóspede(s)",
                    **({"images": [cover]} if cover else {}),
                },
            },
            "quantity": 1,
        }],
        success_url=f"{origin}/pagamento/sucesso?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/pagamento/cancelado?booking_id={booking['id']}",
        metadata={
            "booking_id": booking["id"],
            "property_id": booking["property_id"],
            "property_title": prop["title"],
        },
        locale="pt-BR",
    )
    try:
        session = stripe.checkout.Session.create(**kwargs, idempotency_key=f"checkout-test-{booking['id']}")
    except stripe.error.StripeError as e:
        logger.exception("Stripe create session failed")
        raise HTTPException(status_code=502, detail="Não foi possível abrir o checkout de teste")

    await db.payment_transactions.insert_one({
        "session_id": session.id,
        "booking_id": booking["id"],
        "property_id": booking["property_id"],
        "amount": amount,
        "currency": "brl",
        "status": "initiated",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.bookings.update_one(
        {"id": booking["id"]},
        {"$set": {"stripe_session_id": session.id, "payment_status": "pending", "total": amount}},
    )
    return {"checkout_url": session.url, "session_id": session.id}

async def _settle_paid_session(session_id: str, stripe_session):
    """Idempotent: flip payment & booking to paid/approved."""
    rec = await db.payment_transactions.find_one({"session_id": session_id})
    if not rec:
        return
    if rec.get("payment_status") == "paid":
        return
    if (stripe_session.get("payment_status") != "paid"
        or stripe_session.get("livemode") is not False
        or stripe_session.get("currency") != rec.get("currency")
        or stripe_session.get("amount_total") != int(round(rec["amount"] * 100))):
        return
    await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {
            "status": "completed",
            "payment_status": "paid",
            "stripe_payment_intent_id": stripe_session.get("payment_intent"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    booking_id = rec.get("booking_id")
    if booking_id:
        await db.bookings.update_one(
            {"id": booking_id},
            {"$set": {"status": "approved", "payment_status": "paid"}},
        )

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str):
    rec = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    if rec.get('provider') == 'coldpay':
        if not sandbox_enabled():
            raise HTTPException(503, 'Sandbox Coldpayments não configurado')
        if rec.get('payment_status') != 'paid':
            try:
                payment = await run_in_threadpool(Coldpayments().get_payment, rec['gateway_id'])
                if payment.get('id') != rec['gateway_id']:
                    raise ValueError('Resposta de outra cobrança')
                await settle_pix(payment)
                rec = await db.payment_transactions.find_one({'session_id': session_id}, {'_id': 0})
            except ValueError:
                raise HTTPException(502, 'Não foi possível verificar o PIX agora')
        return {'session_id': session_id, 'payment_status': rec['payment_status'], 'status': rec['status'], 'test_mode': True}
    if rec.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid":
                await _settle_paid_session(session_id, s)
                rec = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe.error.StripeError:
            pass
    return {
        "session_id": rec["session_id"],
        "status": rec["status"],
        "payment_status": rec["payment_status"],
        "amount": rec.get("amount"),
        "currency": rec.get("currency"),
        "booking_id": rec.get("booking_id"),
        "test_mode": True,
    }

@api_router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    if not test_payments_enabled() or not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(503, "Webhook de teste não configurado")
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except (stripe.error.SignatureVerificationError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid signature")
    obj = event["data"]["object"]
    t = event["type"]
    if t in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        try:
            s = stripe.checkout.Session.retrieve(obj["id"])
        except Exception:
            s = obj
        await _settle_paid_session(obj["id"], s)
    elif t == "checkout.session.async_payment_failed":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "failed", "payment_status": "failed",
                       "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
    elif t == "checkout.session.expired":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "expired", "payment_status": "expired",
                       "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
    return {"status": "ok"}


async def create_pix_checkout(req):
    if not sandbox_enabled():
        raise HTTPException(503, 'Sandbox Coldpayments não configurado')
    origin = os.environ.get('FRONTEND_URL', '').rstrip('/')
    if not origin or req.origin_url.rstrip('/') != origin:
        raise HTTPException(400, 'Endereço de retorno não autorizado')
    booking = await db.bookings.find_one({'id': req.booking_id}, {'_id': 0})
    if not booking or booking.get('status') != 'pending':
        raise HTTPException(409, 'Reserva não disponível para pagamento')
    existing = await db.payment_transactions.find_one({'booking_id': booking['id'], 'provider': 'coldpay'}, {'_id': 0})
    if existing:
        return pix_checkout_response(existing)
    prop = await db.properties.find_one({'id': booking['property_id']}, {'_id': 0})
    if not prop:
        raise HTTPException(404, 'Casa não encontrada')
    reservations = [item async for item in db.bookings.find({'property_id': booking['property_id'], 'id': {'$ne': booking['id']}, 'status': {'$in': ['pending', 'approved']}})]
    try:
        amount = price_booking(prop, booking['check_in'], booking['check_out'], booking['guests'], reservations)
        payment = await run_in_threadpool(Coldpayments().create_pix, booking['id'], int(round(amount * 100)), prop['title'])
    except (ValueError, KeyError, TypeError):
        raise HTTPException(502, 'Não foi possível gerar o PIX. Confira a disponibilidade e o limite de R$ 2.000,00.')
    record = {'session_id': 'cp_' + uuid.uuid5(uuid.NAMESPACE_URL, booking['id']).hex,
        'gateway_id': payment['id'], 'provider': 'coldpay', 'booking_id': booking['id'],
        'property_id': booking['property_id'], 'amount': amount, 'currency': 'brl',
        'status': 'initiated', 'payment_status': 'pending', 'copy_paste': payment['copyPaste'],
        'qr_code': payment['qrCodeBase64'], 'expires_at': payment.get('expiresAt'),
        'created_at': datetime.now(timezone.utc).isoformat()}
    # Gateway idempotency and a deterministic unique session also cover concurrent retries.
    if not await db.payment_transactions.find_one({'session_id': record['session_id']}):
        try:
            await db.payment_transactions.insert_one(record)
        except Exception:
            if not await db.payment_transactions.find_one({'session_id': record['session_id']}):
                raise
    await db.bookings.update_one({'id': booking['id']}, {'$set': {'payment_session_id': record['session_id'], 'payment_status': 'pending', 'total': amount}})
    return pix_checkout_response(record)


def pix_checkout_response(record):
    return {key: record.get(key) for key in ('session_id', 'copy_paste', 'qr_code', 'expires_at')} | {'provider': 'coldpay', 'test_mode': True}


async def settle_pix(payment):
    if not isinstance(payment, dict) or payment.get('status') != 'PAID':
        return
    record = await db.payment_transactions.find_one({'gateway_id': payment.get('id'), 'provider': 'coldpay'})
    if not record or payment.get('amountCents') != int(round(record['amount'] * 100)):
        return
    # Repeated deliveries reconcile both records, even after a partial database failure.
    await db.bookings.update_one({'id': record['booking_id'], 'status': {'$in': ['pending', 'approved']}},
        {'$set': {'status': 'approved', 'payment_status': 'paid'}})
    await db.payment_transactions.update_one({'session_id': record['session_id']},
        {'$set': {'status': 'completed', 'payment_status': 'paid', 'updated_at': datetime.now(timezone.utc).isoformat()}})


@api_router.post('/coldpayments/webhook')
async def coldpayments_webhook(request: Request):
    if not sandbox_enabled():
        raise HTTPException(503, 'Sandbox Coldpayments não configurado')
    payload = await request.body()
    if len(payload) > 65536 or not verify_signature(payload,
            request.headers.get('X-Coldpayments-Timestamp', ''),
            request.headers.get('X-Coldpayments-Signature', ''),
            os.environ.get('COLDPAYMENTS_WEBHOOK_SECRET', '')):
        raise HTTPException(400, 'Assinatura inválida')
    try:
        payment = json.loads(payload)
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(400, 'Evento inválido')
    if request.headers.get('X-Coldpayments-Event') == 'payment.paid':
        # Check current provider state as well as the signed delivery.
        if not isinstance(payment, dict) or not isinstance(payment.get('id'), str):
            raise HTTPException(400, 'Evento inválido')
        try:
            confirmed = await run_in_threadpool(Coldpayments().get_payment, payment['id'])
        except ValueError:
            raise HTTPException(502, 'Não foi possível confirmar o evento')
        if confirmed.get('id') == payment['id']:
            await settle_pix(confirmed)
    return {'status': 'ok'}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("bahia-stay")

@app.on_event("shutdown")
async def shutdown():
    client.close()
