"""Add saved searches and notification preferences."""
from alembic import op
from app.database import Base
from app import models  # noqa: F401

revision = "20260725_12"
down_revision = "20260725_11"
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    for name in ["saved_searches", "notification_preferences"]:
        Base.metadata.tables[name].create(bind=bind, checkfirst=True)

def downgrade() -> None:
    bind = op.get_bind()
    for name in ["notification_preferences", "saved_searches"]:
        Base.metadata.tables[name].drop(bind=bind, checkfirst=True)
