"""Pobla la base con datos de demo (con fotos reales) para probar el API y la app.

Las imágenes son reales y se cargan por hotlink:
- 2 fotos temáticas de Unsplash (IDs verificados) por pieza.
- 4 fotos reales de Picsum (deterministas por seed) para completar las 6.
"""
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
    EstadoSolicitud,
    EstadoSubasta,
    ImagenArticulo,
    ImagenSolicitud,
    MedioPago,
    Moneda,
    Rematador,
    Seguro,
    SolicitudSubasta,
    Subasta,
    TipoMedioPago,
    Usuario,
)

_UNSPLASH = "https://images.unsplash.com/photo-{id}?w=800&q=80&auto=format&fit=crop"


def imgs(slug: str, unsplash_ids: list[str]) -> list[str]:
    """6 URLs reales por pieza: las Unsplash temáticas + Picsum hasta completar 6."""
    urls = [_UNSPLASH.format(id=i) for i in unsplash_ids]
    n = 1
    while len(urls) < 6:
        urls.append(f"https://picsum.photos/seed/{slug}-{n}/800/600")
        n += 1
    return urls[:6]


def _print_credenciales():
    print()
    print("=" * 52)
    print("  USUARIOS DE PRUEBA (contraseña: demo1234)")
    print("=" * 52)
    print(f"  {'EMAIL':<22} {'CLAVE':<10} CATEGORÍA")
    print("-" * 52)
    for email, categoria in (
        ("ana@example.com",   "PLATA"),
        ("luis@example.com",  "ORO"),
        ("sofia@example.com", "PLATINO"),
    ):
        print(f"  {email:<22} {'demo1234':<10} {categoria}")
    print("=" * 52)


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Usuario).count() > 0:
            print("La base ya tiene datos, se omite seed.")
            _print_credenciales()
            return

        # ── Rematadores ──────────────────────────────────────────────────────
        rem1 = Rematador(nombre="Carlos", apellido="Pérez", matricula="MAT-001")
        rem2 = Rematador(nombre="Lucía", apellido="Fernández", matricula="MAT-002")
        db.add_all([rem1, rem2])

        # ── Usuarios ─────────────────────────────────────────────────────────
        ana = Usuario(
            nombre="Ana", apellido="Gómez", email="ana@example.com",
            domicilio="Av. Corrientes 1234", pais="Argentina",
            categoria=CategoriaUsuario.PLATA, estado_registro=EstadoRegistro.COMPLETO,
            password_hash="hashed:demo1234",
        )
        luis = Usuario(
            nombre="Luis", apellido="Martínez", email="luis@example.com",
            domicilio="Rivadavia 555", pais="Argentina",
            categoria=CategoriaUsuario.ORO, estado_registro=EstadoRegistro.COMPLETO,
            password_hash="hashed:demo1234",
        )
        sofia = Usuario(
            nombre="Sofía", apellido="Rossi", email="sofia@example.com",
            domicilio="Av. del Libertador 4000", pais="Argentina",
            categoria=CategoriaUsuario.PLATINO, estado_registro=EstadoRegistro.COMPLETO,
            password_hash="hashed:demo1234",
        )
        db.add_all([ana, luis, sofia])
        db.flush()

        # ── Medios de pago (verificados) ─────────────────────────────────────
        db.add_all([
            MedioPago(usuario_id=ana.id, tipo=TipoMedioPago.TARJETA_CREDITO,
                      titular="Ana Gómez", detalle="**** 1234", pais="Argentina",
                      moneda="ARS", estado=EstadoMedioPago.VERIFICADO, verificado=True),
            MedioPago(usuario_id=luis.id, tipo=TipoMedioPago.CHEQUE_CERTIFICADO,
                      titular="Luis Martínez", detalle="Cheque Banco Nación 001",
                      pais="Argentina", monto_garantia=Decimal("2000000.00"),
                      moneda="ARS", estado=EstadoMedioPago.VERIFICADO, verificado=True),
            MedioPago(usuario_id=luis.id, tipo=TipoMedioPago.TARJETA_CREDITO,
                      titular="Luis Martínez", detalle="**** 9000 (internacional)",
                      pais="Estados Unidos", moneda="USD",
                      estado=EstadoMedioPago.VERIFICADO, verificado=True),
            MedioPago(usuario_id=sofia.id, tipo=TipoMedioPago.CUENTA_BANCARIA,
                      titular="Sofía Rossi", detalle="IBAN ****6677", pais="Italia",
                      moneda="USD", estado=EstadoMedioPago.VERIFICADO, verificado=True),
        ])

        # ── Depósitos ────────────────────────────────────────────────────────
        dep1 = Deposito(nombre="Depósito Central", direccion="Av. Warnes 1000", ciudad="CABA")
        dep2 = Deposito(nombre="Depósito Norte", direccion="Panamericana Km 35", ciudad="Pilar")
        db.add_all([dep1, dep2])
        db.flush()

        # ── Artículos (cada uno con 6 fotos reales) ──────────────────────────
        oleo = Articulo(
            numero_pieza="PZ-001",
            descripcion="Óleo sobre lienzo 'Atardecer en el Riachuelo', con marco de época.",
            precio_base=Decimal("850000.00"), moneda="ARS", dueno_actual_id=ana.id,
            artista="Benito Quinquela Martín (atrib.)", fecha_obra="1930",
            historia="Ex colección privada europea. Restaurado en 1998.",
            cantidad_elementos=1, deposito_id=dep1.id,
        )
        reloj = Articulo(
            numero_pieza="PZ-002",
            descripcion="Reloj de pulsera cronógrafo suizo, caja de acero, cuerda manual.",
            precio_base=Decimal("12000.00"), moneda="USD", deposito_id=dep2.id,
            artista=None, fecha_obra="1968",
            historia="Edición limitada. Service oficial reciente.", cantidad_elementos=1,
        )
        anillo = Articulo(
            numero_pieza="PZ-003",
            descripcion="Anillo solitario con diamante de 2.1 ct, engarce en oro blanco 18k.",
            precio_base=Decimal("18000.00"), moneda="USD", deposito_id=dep2.id,
            cantidad_elementos=1,
        )
        te = Articulo(
            numero_pieza="PZ-004",
            descripcion="Juego de té de porcelana inglesa (18 piezas) con detalles en oro.",
            precio_base=Decimal("320000.00"), moneda="ARS", dueno_actual_id=luis.id,
            cantidad_elementos=18, deposito_id=dep1.id,
        )
        escultura = Articulo(
            numero_pieza="PZ-005",
            descripcion="Escultura de bronce patinado sobre base de mármol.",
            precio_base=Decimal("600000.00"), moneda="ARS", deposito_id=dep1.id,
            artista="Taller de A. Rodin", fecha_obra="1910",
            historia="Vaciado de época, numerado en la base.", cantidad_elementos=1,
        )
        guitarra = Articulo(
            numero_pieza="PZ-006",
            descripcion="Guitarra acústica de luthier, tapa de cedro macizo.",
            precio_base=Decimal("9000.00"), moneda="USD", deposito_id=dep2.id,
            fecha_obra="1975", historia="Construida por un luthier reconocido.",
            cantidad_elementos=1,
        )
        monedas = Articulo(
            numero_pieza="PZ-007",
            descripcion="Colección de 12 monedas de plata conmemorativas en estuche.",
            precio_base=Decimal("7500.00"), moneda="USD", deposito_id=dep2.id,
            cantidad_elementos=12,
        )
        db.add_all([oleo, reloj, anillo, te, escultura, guitarra, monedas])
        db.flush()

        fotos = {
            oleo.id: imgs("oleo", ["1578321272176-b7bbc0679853", "1606760227091-3dd870d97f1d"]),
            reloj.id: imgs("reloj", ["1547996160-81dfa63595aa", "1515562141207-7a88fb7ce338"]),
            anillo.id: imgs("anillo", ["1554907984-15263bfd63bd", "1611591437281-460bfbe1220a"]),
            te.id: imgs("te", ["1518998053901-5348d3961a04", "1605100804763-247f67b3557e"]),
            escultura.id: imgs("escultura", ["1599643478518-a784e5dc4c8f", "1610701596007-11502861dcfa"]),
            guitarra.id: imgs("guitarra", ["1525909002-1b05e0c869d8", "1495121605193-b116b5b9c5fe"]),
            monedas.id: imgs("monedas", ["1578662996442-48f60103fc96", "1556139930-c23fa4a4f934"]),
        }
        for art_id, urls in fotos.items():
            for orden, url in enumerate(urls, start=1):
                db.add(ImagenArticulo(articulo_id=art_id, url=url, orden=orden))

        # ── Subastas + catálogo ──────────────────────────────────────────────
        sub_arte = Subasta(
            nombre="Arte y Antigüedades de Junio", fecha_hora=datetime.utcnow() + timedelta(days=1),
            ubicacion="Salón Dorado, CABA", categoria_minima=CategoriaUsuario.PLATA,
            moneda=Moneda.ARS, estado=EstadoSubasta.ABIERTA, rematador_id=rem1.id,
        )
        sub_lujo = Subasta(
            nombre="Relojería & Alta Joyería", fecha_hora=datetime.utcnow() + timedelta(days=2),
            ubicacion="Hotel Alvear, CABA", categoria_minima=CategoriaUsuario.ORO,
            moneda=Moneda.USD, estado=EstadoSubasta.ABIERTA, rematador_id=rem2.id,
        )
        sub_premium = Subasta(
            nombre="Colección Premium", fecha_hora=datetime.utcnow() + timedelta(days=7),
            ubicacion="Puerto Madero, CABA", categoria_minima=CategoriaUsuario.PLATINO,
            moneda=Moneda.USD, estado=EstadoSubasta.PROGRAMADA, rematador_id=rem1.id,
        )
        db.add_all([sub_arte, sub_lujo, sub_premium])
        db.flush()

        db.add_all([
            CatalogoItem(subasta_id=sub_arte.id, articulo_id=oleo.id, precio_base=oleo.precio_base, orden=1),
            CatalogoItem(subasta_id=sub_arte.id, articulo_id=te.id, precio_base=te.precio_base, orden=2),
            CatalogoItem(subasta_id=sub_arte.id, articulo_id=escultura.id, precio_base=escultura.precio_base, orden=3),
            CatalogoItem(subasta_id=sub_lujo.id, articulo_id=reloj.id, precio_base=reloj.precio_base, orden=1),
            CatalogoItem(subasta_id=sub_lujo.id, articulo_id=anillo.id, precio_base=anillo.precio_base, orden=2),
            CatalogoItem(subasta_id=sub_premium.id, articulo_id=guitarra.id, precio_base=guitarra.precio_base, orden=1),
            CatalogoItem(subasta_id=sub_premium.id, articulo_id=monedas.id, precio_base=monedas.precio_base, orden=2),
        ])

        # ── Seguro (cubre piezas de un mismo dueño: ana) ─────────────────────
        seguro = Seguro(
            nro_poliza="POL-0001", compania="La Protectora Seguros",
            beneficiario_id=ana.id, monto_cubierto=Decimal("900000.00"), moneda="ARS",
        )
        seguro.articulos = [oleo]
        db.add(seguro)

        # ── Solicitud de demo (aceptada por la empresa, a la espera del usuario) ─
        sol = SolicitudSubasta(
            usuario_id=ana.id,
            descripcion="Reloj de bolsillo de plata, herencia familiar.",
            datos_historicos="Circa 1900, funcionando.",
            declara_propiedad=True, origen_licito_acreditado=True,
            acepta_devolucion_con_cargo=True, estado=EstadoSolicitud.ACEPTADA,
            precio_base_propuesto=Decimal("150000.00"), comision_propuesta=Decimal("15000.00"),
            fecha_subasta_propuesta=datetime.utcnow() + timedelta(days=20),
        )
        for orden, url in enumerate(imgs("solicitud", ["1509048191080-d2984bad6ae5", "1524805444758-089113d48a6d"]), start=1):
            sol.imagenes.append(ImagenSolicitud(url=url, orden=orden))
        db.add(sol)

        db.commit()
        print("Seed OK: 2 rematadores, 3 usuarios, 7 piezas (6 fotos c/u), "
              "3 subastas, 1 seguro, 1 solicitud aceptada.")
        _print_credenciales()
    finally:
        db.close()


if __name__ == "__main__":
    run()
