"""Pobla la base con datos de demo para probar el API en Swagger."""
from datetime import datetime, timedelta
from decimal import Decimal

from app.database import Base, SessionLocal, engine
from app.models import (
    Articulo,
    CatalogoItem,
    CategoriaUsuario,
    Deposito,
    EstadoMedioPago,
    EstadoRegistro,
    EstadoSubasta,
    ImagenArticulo,
    MedioPago,
    Moneda,
    Rematador,
    Subasta,
    TipoMedioPago,
    Usuario,
)


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Usuario).count() > 0:
            print("La base ya tiene datos, se omite seed.")
            return

        rematador = Rematador(nombre="Carlos", apellido="Pérez", matricula="MAT-001")
        db.add(rematador)

        ana = Usuario(
            nombre="Ana",
            apellido="Gómez",
            email="ana@example.com",
            domicilio="Av. Corrientes 1234",
            pais="Argentina",
            categoria=CategoriaUsuario.PLATA,
            estado_registro=EstadoRegistro.COMPLETO,
            password_hash="hashed:demo1234",
        )
        luis = Usuario(
            nombre="Luis",
            apellido="Martínez",
            email="luis@example.com",
            domicilio="Rivadavia 555",
            pais="Argentina",
            categoria=CategoriaUsuario.ORO,
            estado_registro=EstadoRegistro.COMPLETO,
            password_hash="hashed:demo1234",
        )
        db.add_all([ana, luis])
        db.flush()

        db.add_all([
            MedioPago(
                usuario_id=ana.id,
                tipo=TipoMedioPago.TARJETA_CREDITO,
                titular="Ana Gómez",
                detalle="**** 1234",
                pais="Argentina",
                estado=EstadoMedioPago.VERIFICADO,
                verificado=True,
            ),
            MedioPago(
                usuario_id=luis.id,
                tipo=TipoMedioPago.CHEQUE_CERTIFICADO,
                titular="Luis Martínez",
                detalle="Cheque Banco Nación 001",
                pais="Argentina",
                monto_garantia=Decimal("200000.00"),
                moneda="ARS",
                estado=EstadoMedioPago.VERIFICADO,
                verificado=True,
            ),
        ])

        deposito = Deposito(
            nombre="Depósito Central", direccion="Av. Warnes 1000", ciudad="CABA"
        )
        db.add(deposito)
        db.flush()

        cuadro = Articulo(
            numero_pieza="PZ-001",
            descripcion="Óleo sobre lienzo firmado",
            precio_base=Decimal("10000.00"),
            moneda="ARS",
            artista="X. Rivera",
            fecha_obra="1978",
            historia="Ex colección privada europea.",
            cantidad_elementos=1,
            deposito_id=deposito.id,
        )
        te = Articulo(
            numero_pieza="PZ-002",
            descripcion="Juego de té de porcelana (18 piezas)",
            precio_base=Decimal("5000.00"),
            moneda="ARS",
            cantidad_elementos=18,
            deposito_id=deposito.id,
        )
        db.add_all([cuadro, te])
        db.flush()

        db.add_all([
            ImagenArticulo(articulo_id=cuadro.id, url="https://placehold.co/600x400?text=Cuadro-1", orden=1),
            ImagenArticulo(articulo_id=cuadro.id, url="https://placehold.co/600x400?text=Cuadro-2", orden=2),
            ImagenArticulo(articulo_id=te.id, url="https://placehold.co/600x400?text=Te-1", orden=1),
        ])

        subasta = Subasta(
            nombre="Subasta de Abril",
            fecha_hora=datetime.utcnow() + timedelta(days=1),
            ubicacion="Salón Dorado, CABA",
            categoria_minima=CategoriaUsuario.PLATA,
            moneda=Moneda.ARS,
            estado=EstadoSubasta.ABIERTA,
            rematador_id=rematador.id,
        )
        db.add(subasta)
        db.flush()

        db.add_all([
            CatalogoItem(
                subasta_id=subasta.id,
                articulo_id=cuadro.id,
                precio_base=Decimal("10000.00"),
                orden=1,
            ),
            CatalogoItem(
                subasta_id=subasta.id,
                articulo_id=te.id,
                precio_base=Decimal("5000.00"),
                orden=2,
            ),
        ])

        db.commit()
        print("Seed OK: rematador, 2 usuarios, 2 artículos, 1 subasta abierta con 2 ítems.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
