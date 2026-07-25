"""Create marketplace extension tables without seed data."""
from alembic import op
from app.database import Base
from app import models  # noqa: F401

revision = "20260725_02"
down_revision = "20260724_01"
branch_labels = None
depends_on = None

def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())

def downgrade() -> None:
    tables = [
        "artisan_inquiries","audit_logs","campaigns","payment_methods","document_verifications","risk_signals",
        "device_tokens","invoices","subscriptions","referrals","promotions","notifications",
        "artisan_availability","favorites","disputes","reviews","job_messages","job_milestones",
        "quotes","payment_transactions",
    ]
    bind = op.get_bind()
    for name in tables:
        table = Base.metadata.tables.get(name)
        if table is not None:
            table.drop(bind=bind, checkfirst=True)
