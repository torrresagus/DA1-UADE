"""puja_retira_personalmente

Revision ID: a1b2c3d4e5f6
Revises: 69be1fd6a81a
Create Date: 2026-06-30 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = '69be1fd6a81a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('pujas', schema=None) as batch_op:
        batch_op.add_column(sa.Column('retira_personalmente', sa.Boolean(), nullable=False, server_default=sa.text('0')))


def downgrade() -> None:
    with op.batch_alter_table('pujas', schema=None) as batch_op:
        batch_op.drop_column('retira_personalmente')
