"""Add subscription payment tracking."""
from alembic import op
import sqlalchemy as sa

revision = "20260725_03"
down_revision = "20260725_02"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("subscriptions", sa.Column("provider_reference", sa.String(120), nullable=True))
    op.add_column("subscriptions", sa.Column("phone", sa.String(30), nullable=False, server_default=""))
    op.create_index("ix_subscriptions_provider_reference", "subscriptions", ["provider_reference"], unique=True)

def downgrade() -> None:
    op.drop_index("ix_subscriptions_provider_reference", table_name="subscriptions")
    op.drop_column("subscriptions", "phone")
    op.drop_column("subscriptions", "provider_reference")
