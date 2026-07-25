"""Add artisan portfolio items."""
from alembic import op
from app.database import Base
from app import models  # noqa: F401

revision = "20260725_11"
down_revision = "20260725_10"
branch_labels = None
depends_on = None

def upgrade() -> None:
    Base.metadata.tables["portfolio_items"].create(bind=op.get_bind(), checkfirst=True)

def downgrade() -> None:
    Base.metadata.tables["portfolio_items"].drop(bind=op.get_bind(), checkfirst=True)
