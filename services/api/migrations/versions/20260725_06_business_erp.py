"""Add business team and ERPNext outbox tables."""
from alembic import op
from app.database import Base
from app import models  # noqa: F401
revision="20260725_06"
down_revision="20260725_05"
branch_labels=None
depends_on=None
def upgrade()->None:
    bind=op.get_bind()
    for name in ["business_organizations","organization_members","integration_outbox"]: Base.metadata.tables[name].create(bind=bind,checkfirst=True)
def downgrade()->None:
    bind=op.get_bind()
    for name in ["integration_outbox","organization_members","business_organizations"]: Base.metadata.tables[name].drop(bind=bind,checkfirst=True)
