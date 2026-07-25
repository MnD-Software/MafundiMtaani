"""add artisan profile photos

Revision ID: 20260725_13
Revises: 20260725_12
"""
from alembic import op
import sqlalchemy as sa

revision = "20260725_13"
down_revision = "20260725_12"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("artisans", sa.Column("avatar_url", sa.String(length=500), nullable=False, server_default=""))
    op.add_column("artisans", sa.Column("years_experience", sa.Integer(), nullable=False, server_default="0"))
    op.create_table(
        "inquiry_messages",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("inquiry_id", sa.String(length=36), sa.ForeignKey("artisan_inquiries.id"), nullable=False),
        sa.Column("sender_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_inquiry_messages_inquiry_id", "inquiry_messages", ["inquiry_id"])
    op.create_index("ix_inquiry_messages_sender_id", "inquiry_messages", ["sender_id"])


def downgrade():
    op.drop_index("ix_inquiry_messages_sender_id", table_name="inquiry_messages")
    op.drop_index("ix_inquiry_messages_inquiry_id", table_name="inquiry_messages")
    op.drop_table("inquiry_messages")
    op.drop_column("artisans", "years_experience")
    op.drop_column("artisans", "avatar_url")
