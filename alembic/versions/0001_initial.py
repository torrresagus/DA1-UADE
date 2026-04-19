"""migracion inicial: todas las tablas del dominio

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-19

"""
from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


CATEGORIA = sa.Enum(
    "COMUN", "ESPECIAL", "PLATA", "ORO", "PLATINO", name="categoriausuario"
)
ESTADO_REGISTRO = sa.Enum(
    "PENDIENTE_VERIFICACION",
    "APROBADO_FASE_1",
    "COMPLETO",
    "RECHAZADO",
    "BLOQUEADO",
    name="estadoregistro",
)
ESTADO_SUBASTA = sa.Enum(
    "PROGRAMADA", "ABIERTA", "CERRADA", "CANCELADA", name="estadosubasta"
)
ESTADO_SOLICITUD = sa.Enum(
    "INGRESADA",
    "EN_INSPECCION",
    "ACEPTADA",
    "RECHAZADA",
    "DEVUELTA",
    name="estadosolicitud",
)
ESTADO_ARTICULO = sa.Enum(
    "DISPONIBLE", "EN_SUBASTA", "VENDIDO", "RETIRADO", name="estadoarticulo"
)
ESTADO_PUJA = sa.Enum("PENDIENTE", "CONFIRMADA", "RECHAZADA", name="estadopuja")
MONEDA = sa.Enum("ARS", "USD", name="moneda")
TIPO_MP = sa.Enum(
    "CUENTA_BANCARIA", "TARJETA_CREDITO", "CHEQUE_CERTIFICADO", name="tipomediopago"
)
ESTADO_MP = sa.Enum("PENDIENTE", "VERIFICADO", "RECHAZADO", name="estadomediopago")


def upgrade() -> None:
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nombre", sa.String(80), nullable=False),
        sa.Column("apellido", sa.String(80), nullable=False),
        sa.Column("email", sa.String(180), nullable=False, unique=True, index=True),
        sa.Column("password_hash", sa.String(255)),
        sa.Column("doc_frente_url", sa.String(500)),
        sa.Column("doc_dorso_url", sa.String(500)),
        sa.Column("domicilio", sa.String(250), nullable=False),
        sa.Column("pais", sa.String(80), nullable=False),
        sa.Column("categoria", CATEGORIA, nullable=False),
        sa.Column("estado_registro", ESTADO_REGISTRO, nullable=False),
        sa.Column("bloqueado_por_impago", sa.Boolean, nullable=False),
        sa.Column("fecha_alta", sa.DateTime, nullable=False),
    )

    op.create_table(
        "cuentas_cobro",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("usuario_id", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("banco", sa.String(120), nullable=False),
        sa.Column("pais", sa.String(80), nullable=False),
        sa.Column("numero_cuenta", sa.String(60), nullable=False),
        sa.Column("titular", sa.String(160), nullable=False),
        sa.Column("declarada_antes_subasta", sa.Boolean, nullable=False),
    )

    op.create_table(
        "rematadores",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nombre", sa.String(80), nullable=False),
        sa.Column("apellido", sa.String(80), nullable=False),
        sa.Column("matricula", sa.String(40), nullable=False, unique=True),
    )

    op.create_table(
        "medios_pago",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("usuario_id", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("tipo", TIPO_MP, nullable=False),
        sa.Column("titular", sa.String(160), nullable=False),
        sa.Column("detalle", sa.String(255), nullable=False),
        sa.Column("pais", sa.String(80), nullable=False),
        sa.Column("monto_garantia", sa.Numeric(14, 2)),
        sa.Column("moneda", sa.String(3)),
        sa.Column("estado", ESTADO_MP, nullable=False),
        sa.Column("verificado", sa.Boolean, nullable=False),
    )

    op.create_table(
        "depositos",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("direccion", sa.String(250), nullable=False),
        sa.Column("ciudad", sa.String(120), nullable=False),
    )

    op.create_table(
        "articulos",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("numero_pieza", sa.String(40), nullable=False, unique=True, index=True),
        sa.Column("descripcion", sa.Text, nullable=False),
        sa.Column("precio_base", sa.Numeric(14, 2), nullable=False),
        sa.Column("moneda", sa.String(3), nullable=False),
        sa.Column("dueno_actual_id", sa.Integer, sa.ForeignKey("usuarios.id")),
        sa.Column("artista", sa.String(160)),
        sa.Column("fecha_obra", sa.String(40)),
        sa.Column("historia", sa.Text),
        sa.Column("cantidad_elementos", sa.Integer, nullable=False),
        sa.Column("estado", ESTADO_ARTICULO, nullable=False),
        sa.Column("deposito_id", sa.Integer, sa.ForeignKey("depositos.id")),
    )

    op.create_table(
        "imagenes_articulo",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("articulo_id", sa.Integer, sa.ForeignKey("articulos.id"), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("orden", sa.Integer, nullable=False),
    )

    op.create_table(
        "seguros",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nro_poliza", sa.String(60), nullable=False, unique=True),
        sa.Column("compania", sa.String(120), nullable=False),
        sa.Column("beneficiario_id", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("monto_cubierto", sa.Numeric(14, 2), nullable=False),
        sa.Column("moneda", sa.String(3), nullable=False),
        sa.Column("vigente_desde", sa.DateTime, nullable=False),
    )

    op.create_table(
        "seguros_articulos",
        sa.Column("seguro_id", sa.Integer, sa.ForeignKey("seguros.id"), primary_key=True),
        sa.Column("articulo_id", sa.Integer, sa.ForeignKey("articulos.id"), primary_key=True),
    )

    op.create_table(
        "subastas",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nombre", sa.String(160), nullable=False),
        sa.Column("fecha_hora", sa.DateTime, nullable=False),
        sa.Column("ubicacion", sa.String(250), nullable=False),
        sa.Column("categoria_minima", CATEGORIA, nullable=False),
        sa.Column("moneda", MONEDA, nullable=False),
        sa.Column("estado", ESTADO_SUBASTA, nullable=False),
        sa.Column("rematador_id", sa.Integer, sa.ForeignKey("rematadores.id"), nullable=False),
        sa.Column("es_coleccion", sa.Boolean, nullable=False),
        sa.Column("nombre_coleccion", sa.String(160)),
    )

    op.create_table(
        "catalogo_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("subasta_id", sa.Integer, sa.ForeignKey("subastas.id"), nullable=False),
        sa.Column("articulo_id", sa.Integer, sa.ForeignKey("articulos.id"), nullable=False),
        sa.Column("precio_base", sa.Numeric(14, 2), nullable=False),
        sa.Column("orden", sa.Integer, nullable=False),
        sa.Column("vendido", sa.Boolean, nullable=False),
        sa.UniqueConstraint("subasta_id", "articulo_id"),
    )

    op.create_table(
        "pujas",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("subasta_id", sa.Integer, sa.ForeignKey("subastas.id"), nullable=False),
        sa.Column("catalogo_item_id", sa.Integer, sa.ForeignKey("catalogo_items.id"), nullable=False),
        sa.Column("usuario_id", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("monto", sa.Numeric(14, 2), nullable=False),
        sa.Column("fecha_hora", sa.DateTime, nullable=False, index=True),
        sa.Column("estado", ESTADO_PUJA, nullable=False),
    )

    op.create_table(
        "ventas",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("catalogo_item_id", sa.Integer, sa.ForeignKey("catalogo_items.id"), nullable=False, unique=True),
        sa.Column("comprador_id", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("medio_pago_id", sa.Integer, sa.ForeignKey("medios_pago.id"), nullable=False),
        sa.Column("monto_final", sa.Numeric(14, 2), nullable=False),
        sa.Column("comision", sa.Numeric(14, 2), nullable=False),
        sa.Column("costo_envio", sa.Numeric(14, 2), nullable=False),
        sa.Column("retira_personalmente", sa.Boolean, nullable=False),
        sa.Column("moneda", sa.String(3), nullable=False),
        sa.Column("fecha", sa.DateTime, nullable=False),
        sa.Column("pagada", sa.Boolean, nullable=False),
    )

    op.create_table(
        "multas",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("usuario_id", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("venta_id", sa.Integer, sa.ForeignKey("ventas.id")),
        sa.Column("monto", sa.Numeric(14, 2), nullable=False),
        sa.Column("moneda", sa.String(3), nullable=False),
        sa.Column("motivo", sa.String(250), nullable=False),
        sa.Column("pagada", sa.Boolean, nullable=False),
        sa.Column("fecha", sa.DateTime, nullable=False),
    )

    op.create_table(
        "solicitudes_subasta",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("usuario_id", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("descripcion", sa.Text, nullable=False),
        sa.Column("datos_historicos", sa.Text),
        sa.Column("declara_propiedad", sa.Boolean, nullable=False),
        sa.Column("origen_licito_acreditado", sa.Boolean, nullable=False),
        sa.Column("acepta_devolucion_con_cargo", sa.Boolean, nullable=False),
        sa.Column("estado", ESTADO_SOLICITUD, nullable=False),
        sa.Column("motivo_rechazo", sa.Text),
        sa.Column("precio_base_propuesto", sa.Numeric(14, 2)),
        sa.Column("comision_propuesta", sa.Numeric(14, 2)),
        sa.Column("fecha_subasta_propuesta", sa.DateTime),
        sa.Column("fecha", sa.DateTime, nullable=False),
    )

    op.create_table(
        "imagenes_solicitud",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("solicitud_id", sa.Integer, sa.ForeignKey("solicitudes_subasta.id"), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("orden", sa.Integer, nullable=False),
    )


def downgrade() -> None:
    for tbl in [
        "imagenes_solicitud",
        "solicitudes_subasta",
        "multas",
        "ventas",
        "pujas",
        "catalogo_items",
        "subastas",
        "seguros_articulos",
        "seguros",
        "imagenes_articulo",
        "articulos",
        "depositos",
        "medios_pago",
        "rematadores",
        "cuentas_cobro",
        "usuarios",
    ]:
        op.drop_table(tbl)
