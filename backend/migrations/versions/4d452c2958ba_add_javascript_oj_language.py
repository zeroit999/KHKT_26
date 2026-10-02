"""add javascript oj language

Revision ID: 4d452c2958ba
Revises: 138ed9179db8
Create Date: 2026-10-02 08:42:47.765955

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4d452c2958ba'
down_revision = '138ed9179db8'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint(
        "ck_oj_submissions_language",
        "oj_submissions",
        type_="check",
    )

    op.create_check_constraint(
        "ck_oj_submissions_language",
        "oj_submissions",
        "language IN "
        "('CPP23', 'PYTHON314', 'JAVA21', 'JAVASCRIPT')",
    )


def downgrade():
    op.drop_constraint(
        "ck_oj_submissions_language",
        "oj_submissions",
        type_="check",
    )

    op.create_check_constraint(
        "ck_oj_submissions_language",
        "oj_submissions",
        "language IN "
        "('CPP23', 'PYTHON314', 'JAVA21')",
    )
