"""Add live dispatch, evidence and warranty workflow tables."""
from alembic import op
from app.database import Base
from app import models  # noqa: F401

revision="20260725_04"
down_revision="20260725_03"
branch_labels=None
depends_on=None

def upgrade()->None:
    bind=op.get_bind()
    for name in ["job_tracking_pings","job_evidence","completion_approvals","warranty_claims"]:
        Base.metadata.tables[name].create(bind=bind,checkfirst=True)

def downgrade()->None:
    bind=op.get_bind()
    for name in ["warranty_claims","completion_approvals","job_evidence","job_tracking_pings"]:
        Base.metadata.tables[name].drop(bind=bind,checkfirst=True)
