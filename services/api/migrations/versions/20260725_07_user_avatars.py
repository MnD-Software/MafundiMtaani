"""Add persistent user avatars."""
from alembic import op
import sqlalchemy as sa
revision="20260725_07"
down_revision="20260725_06"
branch_labels=None
depends_on=None
def upgrade()->None:
    op.add_column("users",sa.Column("avatar_url",sa.String(500),nullable=False,server_default=""))
def downgrade()->None:
    op.drop_column("users","avatar_url")
