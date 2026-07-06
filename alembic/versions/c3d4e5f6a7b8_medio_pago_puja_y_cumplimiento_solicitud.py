"""puja.medio_pago_id + solicitud: origen_documentacion_url, autoridad_avisada, gastos_devolucion

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-06
"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Medio de pago seleccionado en la puja (se propaga a la Venta al cierre).
    op.add_column('pujas', sa.Column('medio_pago_id', sa.Integer(), nullable=True))

    # Cumplimiento / devolución de solicitudes de subasta.
    op.add_column(
        'solicitudes_subasta',
        sa.Column('origen_documentacion_url', sa.String(length=500), nullable=True),
    )
    op.add_column(
        'solicitudes_subasta',
        sa.Column('autoridad_avisada', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        'solicitudes_subasta',
        sa.Column('gastos_devolucion', sa.Numeric(14, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('solicitudes_subasta', 'gastos_devolucion')
    op.drop_column('solicitudes_subasta', 'autoridad_avisada')
    op.drop_column('solicitudes_subasta', 'origen_documentacion_url')
    op.drop_column('pujas', 'medio_pago_id')
