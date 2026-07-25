"""Add property care, support and artisan earning tables."""
from alembic import op
from app.database import Base
from app import models  # noqa: F401

revision="20260725_05"
down_revision="20260725_04"
branch_labels=None
depends_on=None

def upgrade()->None:
    bind=op.get_bind()
    for name in ["properties","maintenance_schedules","support_tickets","artisan_earnings"]:
        Base.metadata.tables[name].create(bind=bind,checkfirst=True)

def downgrade()->None:
    bind=op.get_bind()
    for name in ["artisan_earnings","support_tickets","maintenance_schedules","properties"]:
        Base.metadata.tables[name].drop(bind=bind,checkfirst=True)
