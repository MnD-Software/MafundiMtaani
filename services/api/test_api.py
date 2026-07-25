import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

TEST_DB = Path("test_mafundi.db")
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["MAFUNDI_DATABASE_URL"] = f"sqlite:///./{TEST_DB}"
os.environ["MAFUNDI_JWT_SECRET"] = "test-secret-that-is-long-enough-for-ci"

from fastapi.testclient import TestClient
from sqlalchemy import select
from app.auth import hash_password
from app.database import SessionLocal
from app.main import app
from app.models import User, UserRole
from app.config import Settings


def register(client: TestClient, email: str, account_type: str = "client") -> str:
    response = client.post("/v1/auth/register", json={"email": email, "password": "A-secure-password-123", "name": "Test User", "phone": "+254700000001", "account_type": account_type})
    assert response.status_code == 201
    return response.json()["access_token"]


def create_admin() -> str:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == "admin@test.local"))
        if not user:
            user = User(email="admin@test.local", password_hash=hash_password("Admin-password-123"), name="Admin", role=UserRole.admin)
            db.add(user); db.commit(); db.refresh(user)
    with TestClient(app) as client:
        return client.post("/v1/auth/login", json={"email":"admin@test.local","password":"Admin-password-123"}).json()["access_token"]


def test_health_and_empty_database():
    with TestClient(app) as client:
        assert client.get("/health").json()["status"] == "ok"
        assert client.get("/v1/artisans").json() == []


def test_cors_configuration_accepts_render_formats():
    assert Settings(cors_origins="https://app.vercel.app", _env_file=None).cors_origin_list == ["https://app.vercel.app"]
    assert Settings(cors_origins="https://one.app, https://two.app/", _env_file=None).cors_origin_list == ["https://one.app", "https://two.app"]
    assert Settings(cors_origins='["https://one.app","https://two.app"]', _env_file=None).cors_origin_list == ["https://one.app", "https://two.app"]


def test_nairobi_estates_are_exposed():
    with TestClient(app) as client:
        payload = client.get("/v1/estates").json()
        assert payload["total"] >= 120
        assert "Umoja" in payload["areas"]
        assert "Mukuru Kwa Njenga" in payload["areas"]
        assert "Buruburu Phase 5" in payload["areas"]


def test_job_creation_requires_client_and_is_private():
    with TestClient(app) as client:
        first = register(client, "client1@test.local")
        second = register(client, "client2@test.local")
        payload = {"client_name":"Jane Doe","client_phone":"+254700123456","trade":"Plumbing","title":"Fix a leaking tap","description":"The kitchen tap has been leaking since yesterday.","area":"Kilimani","urgency":"today","budget_min":1000,"budget_max":5000}
        assert client.post("/v1/jobs", json=payload).status_code == 401
        created = client.post("/v1/jobs", headers={"Authorization":f"Bearer {first}"}, json=payload)
        assert created.status_code == 201
        job_id = created.json()["id"]
        assert client.get(f"/v1/jobs/{job_id}", headers={"Authorization":f"Bearer {second}"}).status_code == 403
        assert client.get(f"/v1/jobs/{job_id}", headers={"Authorization":f"Bearer {first}"}).status_code == 200


def test_admin_endpoints_enforce_rbac():
    with TestClient(app) as client:
        client_token = register(client, "ordinary@test.local")
        assert client.get("/v1/admin/metrics").status_code == 401
        assert client.get("/v1/admin/metrics", headers={"Authorization":f"Bearer {client_token}"}).status_code == 403
        admin_token = create_admin()
        response = client.get("/v1/admin/metrics", headers={"Authorization":f"Bearer {admin_token}"})
        assert response.status_code == 200
        assert response.json()["payments_received"] == 0
        assert response.json()["finance_source"] == "payment_transactions"


def test_dashboard_metrics_are_role_scoped():
    with TestClient(app) as client:
        client_token = register(client, "dashboard-client@test.local")
        response = client.get("/v1/dashboard/metrics", headers={"Authorization":f"Bearer {client_token}"})
        assert response.status_code == 200
        assert response.json()["role"] == "client"
        assert response.json()["money_spent"] == 0
        admin_token = create_admin()
        assert client.get("/v1/dashboard/metrics", headers={"Authorization":f"Bearer {admin_token}"}).status_code == 403


def test_artisan_application_and_admin_approval():
    with TestClient(app) as client:
        artisan_token = register(client, "artisan@test.local", "artisan")
        created = client.post("/v1/applications", headers={"Authorization":f"Bearer {artisan_token}"}, json={"name":"Applicant","phone":"+254700999111","trade":"Painting","area":"Donholm","years_experience":4,"documents":["national_id","portfolio","police_clearance","references"]})
        assert created.status_code == 201
        admin_token = create_admin()
        reviewed = client.patch(f"/v1/admin/applications/{created.json()['id']}", headers={"Authorization":f"Bearer {admin_token}"}, json={"status":"approved","review_note":"Verified"})
        assert reviewed.status_code == 200
        assert reviewed.json()["status"] == "approved"


def test_quote_job_room_tracking_and_verified_review():
    with TestClient(app) as client:
        client_token = register(client, "workflow-client@test.local")
        artisan_token = register(client, "workflow-artisan@test.local", "artisan")
        application = client.post("/v1/applications", headers={"Authorization":f"Bearer {artisan_token}"}, json={"name":"Workflow Artisan","phone":"+254711222333","trade":"Plumbing","area":"Kilimani","years_experience":5,"documents":["national_id"]})
        admin_token = create_admin()
        assert client.patch(f"/v1/admin/applications/{application.json()['id']}", headers={"Authorization":f"Bearer {admin_token}"}, json={"status":"approved","review_note":"Verified"}).status_code == 200
        job = client.post("/v1/jobs", headers={"Authorization":f"Bearer {client_token}"}, json={"client_name":"Workflow Client","client_phone":"+254700111222","trade":"Plumbing","title":"Repair kitchen sink","description":"The kitchen sink pipe is leaking beneath the cabinet.","area":"Kilimani","urgency":"today","budget_min":2000,"budget_max":6000}).json()
        quote = client.post("/v1/quotes", headers={"Authorization":f"Bearer {artisan_token}"}, json={"job_id":job["id"],"amount":4500,"message":"Parts and labour included.","eta_hours":2})
        assert quote.status_code == 201
        assert client.post(f"/v1/quotes/{quote.json()['id']}/accept", headers={"Authorization":f"Bearer {client_token}"}).status_code == 200
        assert client.post(f"/v1/jobs/{job['id']}/messages", headers={"Authorization":f"Bearer {client_token}"}, json={"body":"Please call on arrival."}).status_code == 201
        assert client.patch(f"/v1/jobs/{job['id']}/status?next_status=in_progress", headers={"Authorization":f"Bearer {artisan_token}"}).status_code == 200
        assert client.patch(f"/v1/jobs/{job['id']}/status?next_status=completed", headers={"Authorization":f"Bearer {artisan_token}"}).status_code == 200
        review = client.post(f"/v1/jobs/{job['id']}/reviews", headers={"Authorization":f"Bearer {client_token}"}, json={"rating":5,"comment":"Excellent verified work."})
        assert review.status_code == 201
        assert review.json()["verified"] is True
        dispute = client.post(f"/v1/jobs/{job['id']}/disputes", headers={"Authorization":f"Bearer {client_token}"}, json={"reason":"Receipt question","details":"I need operations to verify the final receipt.","evidence":[]})
        assert dispute.status_code == 201
        disputes = client.get("/v1/admin/disputes", headers={"Authorization":f"Bearer {admin_token}"})
        assert disputes.status_code == 200
        assert any(item["id"] == dispute.json()["id"] for item in disputes.json())
        assert client.patch(f"/v1/admin/disputes/{dispute.json()['id']}", headers={"Authorization":f"Bearer {admin_token}"}, json={"status":"resolved","resolution":"Receipt verified"}).status_code == 200
        integrations = client.get("/v1/integrations/status", headers={"Authorization":f"Bearer {admin_token}"})
        assert integrations.status_code == 200
        assert integrations.json()["in_app_notifications"]["configured"] is True


def test_growth_billing_devices_and_risk_controls():
    with TestClient(app) as client:
        client_token = register(client, "growth-client@test.local")
        admin_token = create_admin()
        promotion = client.post("/v1/admin/promotions", headers={"Authorization":f"Bearer {admin_token}"}, json={"code":"WELCOME10","description":"Welcome reward","discount_percent":10,"max_discount":500,"usage_limit":10})
        assert promotion.status_code == 201
        discount = client.get("/v1/promotions/WELCOME10?amount=10000", headers={"Authorization":f"Bearer {client_token}"})
        assert discount.status_code == 200
        assert discount.json()["discount"] == 500
        referral = client.get("/v1/referrals/me", headers={"Authorization":f"Bearer {client_token}"})
        assert referral.status_code == 200
        assert referral.json()["code"].startswith("MM-")
        subscription = client.post("/v1/subscriptions", headers={"Authorization":f"Bearer {client_token}"}, json={"plan":"pro"})
        assert subscription.status_code == 200
        assert subscription.json()["payment_required"] is True
        assert client.post("/v1/devices", headers={"Authorization":f"Bearer {client_token}"}, json={"token":"test-device-token-123","platform":"web"}).status_code == 201
        assert client.get("/v1/invoices", headers={"Authorization":f"Bearer {client_token}"}).json() == []
        risky_job = {"client_name":"Risk Client","client_phone":"+254700555666","trade":"Construction","title":"Major property renovation","description":"A high-value full property renovation requiring review.","area":"Karen","urgency":"this_month","budget_min":900000,"budget_max":1500000}
        assert client.post("/v1/jobs", headers={"Authorization":f"Bearer {client_token}"}, json=risky_job).status_code == 201
        signals = client.get("/v1/admin/risk-signals", headers={"Authorization":f"Bearer {admin_token}"})
        assert signals.status_code == 200
        assert any(item["signal_type"] == "high_value_job" for item in signals.json())
        method = client.post("/v1/payment-methods", headers={"Authorization":f"Bearer {client_token}"}, json={"method_type":"mpesa","provider":"safaricom","label":"M-Pesa · 0001","last_four":"0001","is_default":True})
        assert method.status_code == 201
        assert client.get("/v1/payment-methods", headers={"Authorization":f"Bearer {client_token}"}).json()[0]["is_default"] is True
        now=datetime.now(timezone.utc)
        campaign=client.post("/v1/admin/campaigns",headers={"Authorization":f"Bearer {admin_token}"},json={"slug":"test-launch","name":"Launch","headline":"Welcome to Mafundi","message":"Thank you for joining us.","theme":"launch","starts_at":(now-timedelta(hours=1)).isoformat(),"ends_at":(now+timedelta(hours=1)).isoformat()})
        assert campaign.status_code == 201
        assert client.get("/v1/campaigns/active").json()["slug"] == "test-launch"
        assert client.get("/v1/admin/audit-logs",headers={"Authorization":f"Bearer {admin_token}"}).status_code == 200
