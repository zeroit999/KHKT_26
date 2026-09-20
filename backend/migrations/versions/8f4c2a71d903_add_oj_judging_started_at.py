"""add OJ judging started timestamp

Revision ID: 8f4c2a71d903
Revises: 57e8e140f469
"""

from alembic import op
import sqlalchemy as sa


revision = "8f4c2a71d903"
down_revision = "57e8e140f469"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "oj_submissions",
        sa.Column(
            "judging_started_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_oj_submissions_judging_started_at",
        "oj_submissions",
        ["judging_started_at"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        "ix_oj_submissions_judging_started_at",
        table_name="oj_submissions",
    )

    op.drop_column(
        "oj_submissions",
        "judging_started_at",
    )
