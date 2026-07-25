"""Add subscription payment tracking."""
from alembic import op
import sqlalchemy as sa

revision = "20260725_03"
down_revision = "20260725_02"
branch_labels = None
depends_on = None

def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {item["name"] for item in inspector.get_columns("subscriptions")}
    if "provider_reference" not in columns:
        op.add_column("subscriptions", sa.Column("provider_reference", sa.String(120), nullable=True))
    if "phone" not in columns:
        op.add_column("subscriptions", sa.Column("phone", sa.String(30), nullable=False, server_default=""))
    indexes = {item["name"] for item in sa.inspect(op.get_bind()).get_indexes("subscriptions")}
    if "ix_subscriptions_provider_reference" not in indexes:
        op.create_index("ix_subscriptions_provider_reference", "subscriptions", ["provider_reference"], unique=True)

def downgrade() -> None:
    op.drop_index("ix_subscriptions_provider_reference", table_name="subscriptions")
    op.drop_column("subscriptions", "phone")
    op.drop_column("subscriptions", "provider_reference")
