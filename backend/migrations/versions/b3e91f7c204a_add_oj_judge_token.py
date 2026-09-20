"""add OJ judge ownership token

Revision ID: b3e91f7c204a
Revises: 8f4c2a71d903
"""

from alembic import op
import sqlalchemy as sa


revision = "b3e91f7c204a"
down_revision = "8f4c2a71d903"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "oj_submissions",
        sa.Column(
            "judge_token",
            sa.String(length=36),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_oj_submissions_judge_token",
        "oj_submissions",
        ["judge_token"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        "ix_oj_submissions_judge_token",
        table_name="oj_submissions",
    )

    op.drop_column(
        "oj_submissions",
        "judge_token",
    )
