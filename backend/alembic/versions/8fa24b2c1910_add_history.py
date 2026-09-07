"""Add account history.

Revision ID: 8fa24b2c1910
Revises: d66983dfe219
"""
from alembic import op
import sqlalchemy as sa

revision = "8fa24b2c1910"
down_revision = "d66983dfe219"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "history_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entry_id", sa.String(36), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.UniqueConstraint("user_id", "entry_id"),
    )
    op.create_index("ix_history_owner_kind", "history_entries", ["user_id", "kind", "id"])


def downgrade():
    op.drop_table("history_entries")
