"""Add explicit scheduled job time."""

from alembic import op
import sqlalchemy as sa

revision = "20260725_14"
down_revision = "20260725_13"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {item["name"] for item in inspector.get_columns("jobs")}
    if "scheduled_for" not in columns:
        op.add_column("jobs", sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True))
    if "preferred_artisan_id" not in columns:
        op.add_column("jobs", sa.Column("preferred_artisan_id", sa.String(length=36), sa.ForeignKey("artisans.id"), nullable=True))
    indexes = {item["name"] for item in sa.inspect(op.get_bind()).get_indexes("jobs")}
    if "ix_jobs_scheduled_for" not in indexes:
        op.create_index("ix_jobs_scheduled_for", "jobs", ["scheduled_for"])
    if "ix_jobs_preferred_artisan_id" not in indexes:
        op.create_index("ix_jobs_preferred_artisan_id", "jobs", ["preferred_artisan_id"])


def downgrade() -> None:
    op.drop_index("ix_jobs_preferred_artisan_id", table_name="jobs")
    op.drop_constraint("fk_jobs_preferred_artisan", "jobs", type_="foreignkey")
    op.drop_column("jobs", "preferred_artisan_id")
    op.drop_index("ix_jobs_scheduled_for", table_name="jobs")
    op.drop_column("jobs", "scheduled_for")
