"""add auth version for token revocation

Revision ID: 138ed9179db8
Revises: 148b809fe186
Create Date: 2026-09-21 08:24:27.896289

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '138ed9179db8'
down_revision = '148b809fe186'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "auth_version",
            sa.Integer(),
            server_default=sa.text("1"),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_column("users", "auth_version")
