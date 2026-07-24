import os
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


def test_nairobi_estates_are_exposed():
    with TestClient(app) as client:
        payload = client.get("/v1/estates").json()
        assert payload["total"] >= 70
        assert "Umoja" in payload["areas"]


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
        assert client.get("/v1/admin/metrics", headers={"Authorization":f"Bearer {admin_token}"}).status_code == 200


def test_artisan_application_and_admin_approval():
    with TestClient(app) as client:
        artisan_token = register(client, "artisan@test.local", "artisan")
        created = client.post("/v1/applications", headers={"Authorization":f"Bearer {artisan_token}"}, json={"name":"Applicant","phone":"+254700999111","trade":"Painting","area":"Donholm","years_experience":4,"documents":["national_id","portfolio","police_clearance","references"]})
        assert created.status_code == 201
        admin_token = create_admin()
        reviewed = client.patch(f"/v1/admin/applications/{created.json()['id']}", headers={"Authorization":f"Bearer {admin_token}"}, json={"status":"approved","review_note":"Verified"})
        assert reviewed.status_code == 200
        assert reviewed.json()["status"] == "approved"
