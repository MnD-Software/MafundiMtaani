"""Add trusted contacts, SOS alerts and consent records."""
from alembic import op
from app.database import Base
from app import models  # noqa: F401
revision="20260725_08"
down_revision="20260725_07"
branch_labels=None
depends_on=None
def upgrade()->None:
    bind=op.get_bind()
    for name in ["trusted_contacts","sos_alerts","consent_records"]: Base.metadata.tables[name].create(bind=bind,checkfirst=True)
def downgrade()->None:
    bind=op.get_bind()
    for name in ["consent_records","sos_alerts","trusted_contacts"]: Base.metadata.tables[name].drop(bind=bind,checkfirst=True)
