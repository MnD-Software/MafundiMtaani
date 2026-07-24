"""Create the first administrator explicitly. This is never run at application startup."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "api"))

from sqlalchemy import select
from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import User, UserRole

email = os.environ.get("MAFUNDI_ADMIN_EMAIL", "").strip().lower()
password = os.environ.get("MAFUNDI_ADMIN_PASSWORD", "")
name = os.environ.get("MAFUNDI_ADMIN_NAME", "Platform Administrator")
if not email or len(password) < 12:
    raise SystemExit("Set MAFUNDI_ADMIN_EMAIL and MAFUNDI_ADMIN_PASSWORD (12+ characters).")

Base.metadata.create_all(bind=engine)
with SessionLocal() as db:
    if db.scalar(select(User).where(User.email == email)):
        raise SystemExit("An account with this email already exists.")
    db.add(User(email=email, password_hash=hash_password(password), name=name, role=UserRole.admin))
    db.commit()
print(f"Created administrator {email}")
