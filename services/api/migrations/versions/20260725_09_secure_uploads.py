"""Add private durable file storage."""
from alembic import op
from app.database import Base
from app import models  # noqa: F401

revision = "20260725_09"
down_revision = "20260725_08"
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.tables["stored_files"].create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    Base.metadata.tables["stored_files"].drop(bind=op.get_bind(), checkfirst=True)
