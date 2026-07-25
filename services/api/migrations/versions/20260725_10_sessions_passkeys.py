"""Add revocable sessions and WebAuthn passkeys."""
from alembic import op
from app.database import Base
from app import models  # noqa: F401

revision = "20260725_10"
down_revision = "20260725_09"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    for name in ["auth_sessions", "passkey_credentials", "passkey_challenges"]:
        Base.metadata.tables[name].create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for name in ["passkey_challenges", "passkey_credentials", "auth_sessions"]:
        Base.metadata.tables[name].drop(bind=bind, checkfirst=True)
