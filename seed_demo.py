"""Seed 5 demo auctions for Fly.io deploy."""
import sqlite3

DB = "subastas.db"
EMPRESA_ID = 5
REMATADOR_ID = 1
DEPOSITO_ID = 1

conn = sqlite3.connect(DB)
conn.execute("PRAGMA foreign_keys = OFF")
c = conn.cursor()

# ── Articulos ────────────────────────────────────────────────────────────────
# (numero_pieza, descripcion, precio_base, artista, historia, cantidad_elementos, estado)
art_data = [
    # 3 PROGRAMADAS
    ("PZ-101", "Violin Stradivarius réplica siglo XVIII", 250000,
     "Anónimo", "Réplica artesanal de gran precisión, madera de arce y abeto seleccionados.", 1, "DISPONIBLE"),
    ("PZ-102", "Colección de monedas romanas siglo I", 180000,
     "Anónimo", "Lote de 12 denarios en excelente estado de conservación.", 12, "DISPONIBLE"),
    ("PZ-103", "Cámara Leica M3 cromada 1954", 95000,
     "Ernst Leitz", "Cuerpo en estado coleccionable, obturador funcionando perfectamente.", 1, "DISPONIBLE"),
    # 1 ORO PROGRAMADA
    ("PZ-104", "Reloj Omega Seamaster vintage 1968", 320000,
     "Omega SA", "Movimiento automático calibre 565, esfera azul original intacta.", 1, "DISPONIBLE"),
    # 1 PLATINO PROGRAMADA — wait, we need 2 CERRADAS and 3 PROGRAMADAS
    # Breakdown: 1 PLATINO (CERRADA), 1 ORO (PROGRAMADA), 3 COMUN (2 PROGRAMADA + 1 CERRADA)
    # CERRADA articulos
    ("PZ-105", "Gramófono Edison Phonograph 1910", 140000,
     "Thomas Edison", "Fonógrafo de cilindros en perfecto estado, bocina original de latón.", 1, "VENDIDO"),
    ("PZ-106", "Conjunto de porcelana china Dinastía Ming", 480000,
     "Anónimo", "12 piezas originales del período Xuande, certificadas por experto.", 12, "VENDIDO"),
]

art_ids = []
for (np, desc, pb, artista, hist, cant, est) in art_data:
    c.execute("""
        INSERT INTO articulos
            (numero_pieza, descripcion, precio_base, moneda, dueno_actual_id,
             artista, historia, cantidad_elementos, estado, deposito_id)
        VALUES (?, ?, ?, 'ARS', ?, ?, ?, ?, ?, ?)
    """, (np, desc, pb, EMPRESA_ID, artista, hist, cant, est, DEPOSITO_ID))
    art_ids.append(c.lastrowid)

# art_ids[0]=PZ-101 COMUN PROGRAMADA
# art_ids[1]=PZ-102 COMUN PROGRAMADA
# art_ids[2]=PZ-103 COMUN PROGRAMADA  (one will be CERRADA)
# art_ids[3]=PZ-104 ORO PROGRAMADA
# art_ids[4]=PZ-105 PLATINO CERRADA
# art_ids[5]=PZ-106 (extra for CERRADA — we only need 2 CERRADA subastas)

# ── Subastas ─────────────────────────────────────────────────────────────────
# (nombre, fecha_hora_utc, categoria_minima, estado)
subasta_data = [
    # 3 PROGRAMADAS: 1 ORO, 2 COMUN (4-6 days ahead at 21:00 UTC = 18:00 local)
    ("Subasta de Arte y Colección — Rango Oro",
     "2026-07-08 21:00:00", "ORO", "PROGRAMADA"),
    ("Subasta de Relojes y Fotografía",
     "2026-07-09 21:00:00", "COMUN", "PROGRAMADA"),
    ("Subasta de Instrumentos Musicales",
     "2026-07-10 21:00:00", "COMUN", "PROGRAMADA"),
    # 2 CERRADAS: 1 PLATINO, 1 COMUN
    ("Gran Subasta de Antigüedades — Rango Platino",
     "2026-07-01 21:00:00", "PLATINO", "CERRADA"),
    ("Subasta de Porcelana y Fonógrafos",
     "2026-07-02 21:00:00", "COMUN", "CERRADA"),
]

sub_ids = []
for (nombre, fecha, cat, est) in subasta_data:
    c.execute("""
        INSERT INTO subastas
            (nombre, fecha_hora, ubicacion, categoria_minima, moneda, estado,
             rematador_id, es_coleccion, nombre_coleccion)
        VALUES (?, ?, 'Sala Principal — Bidify', ?, 'ARS', ?, ?, 0, NULL)
    """, (nombre, fecha, cat, est, REMATADOR_ID))
    sub_ids.append(c.lastrowid)

# sub_ids[0] = ORO PROGRAMADA
# sub_ids[1] = COMUN PROGRAMADA (relojes/foto)
# sub_ids[2] = COMUN PROGRAMADA (instrumentos)
# sub_ids[3] = PLATINO CERRADA
# sub_ids[4] = COMUN CERRADA

# ── Catalogo Items ────────────────────────────────────────────────────────────
# (subasta_id, articulo_id, precio_base, orden, vendido)
catalogo = [
    (sub_ids[0], art_ids[3], 320000, 1, 0),   # ORO PROG: Omega
    (sub_ids[1], art_ids[2], 95000,  1, 0),   # COMUN PROG: Leica
    (sub_ids[2], art_ids[0], 250000, 1, 0),   # COMUN PROG: Violin
    (sub_ids[3], art_ids[5], 480000, 1, 1),   # PLATINO CERRADA: Porcelana Ming
    (sub_ids[4], art_ids[1], 180000, 1, 1),   # COMUN CERRADA: Monedas romanas
    (sub_ids[4], art_ids[4], 140000, 2, 1),   # COMUN CERRADA: Gramófono (2nd item)
]

ci_ids = {}
for (sub_id, art_id, pb, orden, vendido) in catalogo:
    c.execute("""
        INSERT INTO catalogo_items (subasta_id, articulo_id, precio_base, orden, vendido)
        VALUES (?, ?, ?, ?, ?)
    """, (sub_id, art_id, pb, orden, vendido))
    ci_ids[(sub_id, art_id)] = c.lastrowid

# ── Ventas (for CERRADA items) ────────────────────────────────────────────────
ci_platino_porcelana = ci_ids[(sub_ids[3], art_ids[5])]
ci_comun_monedas     = ci_ids[(sub_ids[4], art_ids[1])]
ci_comun_gramofono   = ci_ids[(sub_ids[4], art_ids[4])]

ventas = [
    (ci_platino_porcelana, EMPRESA_ID, 480000, "2026-07-01 22:30:00"),
    (ci_comun_monedas,     EMPRESA_ID, 180000, "2026-07-02 22:15:00"),
    (ci_comun_gramofono,   EMPRESA_ID, 140000, "2026-07-02 22:20:00"),
]
for (ci_id, comprador, monto, fecha) in ventas:
    c.execute("""
        INSERT INTO ventas
            (catalogo_item_id, comprador_id, medio_pago_id, monto_final, comision,
             costo_envio, retira_personalmente, moneda, fecha, pagada)
        VALUES (?, ?, NULL, ?, 0, 0, 1, 'ARS', ?, 0)
    """, (ci_id, comprador, monto, fecha))

# ── Imagenes ──────────────────────────────────────────────────────────────────
# 3 images per articulo, stable picsum.photos URLs
img_sets = {
    art_ids[0]: [  # Violin
        ("https://picsum.photos/id/1062/800/600", 1),
        ("https://picsum.photos/id/1048/800/600", 2),
        ("https://picsum.photos/id/160/800/600",  3),
    ],
    art_ids[1]: [  # Monedas romanas
        ("https://picsum.photos/id/669/800/600",  1),
        ("https://picsum.photos/id/667/800/600",  2),
        ("https://picsum.photos/id/665/800/600",  3),
    ],
    art_ids[2]: [  # Leica M3
        ("https://picsum.photos/id/250/800/600",  1),
        ("https://picsum.photos/id/251/800/600",  2),
        ("https://picsum.photos/id/252/800/600",  3),
    ],
    art_ids[3]: [  # Omega
        ("https://picsum.photos/id/378/800/600",  1),
        ("https://picsum.photos/id/379/800/600",  2),
        ("https://picsum.photos/id/380/800/600",  3),
    ],
    art_ids[4]: [  # Gramófono
        ("https://picsum.photos/id/117/800/600",  1),
        ("https://picsum.photos/id/119/800/600",  2),
        ("https://picsum.photos/id/120/800/600",  3),
    ],
    art_ids[5]: [  # Porcelana Ming
        ("https://picsum.photos/id/447/800/600",  1),
        ("https://picsum.photos/id/449/800/600",  2),
        ("https://picsum.photos/id/450/800/600",  3),
    ],
}

for art_id, imgs in img_sets.items():
    for (url, orden) in imgs:
        c.execute(
            "INSERT INTO imagenes_articulo (articulo_id, url, orden) VALUES (?, ?, ?)",
            (art_id, url, orden)
        )

conn.commit()
conn.close()
print("Seed completado.")

# Verify
conn2 = sqlite3.connect(DB)
c2 = conn2.cursor()
c2.execute("SELECT id, nombre, categoria_minima, estado FROM subastas")
for row in c2.fetchall():
    print(" subasta:", row)
c2.execute("SELECT COUNT(*) FROM catalogo_items")
print(" catalogo_items:", c2.fetchone())
c2.execute("SELECT COUNT(*) FROM ventas")
print(" ventas:", c2.fetchone())
c2.execute("SELECT COUNT(*) FROM imagenes_articulo")
print(" imagenes:", c2.fetchone())
conn2.close()
