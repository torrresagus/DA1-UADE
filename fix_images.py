"""Reemplaza imágenes de los artículos del seed con fotos Unsplash que coinciden con cada producto."""
import sqlite3

BASE = "https://images.unsplash.com/photo-{}?w=800&q=80"

# art_id → [(long_photo_id, orden), ...]
IMAGES = {
    8: [  # Violin Stradivarius
        (BASE.format("1612225330812-01a9c6b355ec"), 1),  # violín sobre tela blanca
        (BASE.format("1624367171718-14026220ee35"), 2),  # violín sobre papel blanco
        (BASE.format("1492563817904-5f1dc687974f"), 3),  # violín marrón
    ],
    9: [  # Colección de monedas romanas
        (BASE.format("1718140245037-8d02a29e425e"), 1),  # moneda antigua con perfil
        (BASE.format("1680396761982-0bdd9675af35"), 2),  # pila de monedas
        (BASE.format("1672945690877-5307346cde57"), 3),  # monedas sobre fondo negro
    ],
    10: [  # Cámara Leica M3
        (BASE.format("1649342609352-45b14364650a"), 1),  # Leica sobre mesa
        (BASE.format("1466553359530-7387151ec321"), 2),  # cámara vintage negra
        (BASE.format("1649342609020-abb97337c6d2"), 3),  # lente de cámara
    ],
    11: [  # Reloj Omega Seamaster
        (BASE.format("1677445166019-4fa91a090e49"), 1),  # reloj sobre estuche marrón
        (BASE.format("1605544906466-6d3268a268bd"), 2),  # reloj analógico dorado/plateado
        (BASE.format("1556453007-ee036169934b"),   3),  # Omega cronógrafo plateado
    ],
    12: [  # Gramófono Edison Phonograph
        (BASE.format("1518893883800-45cd0954574b"), 1),  # closeup gramófono
        (BASE.format("1635264349913-219c2229483b"), 2),  # fonógrafo antiguo en madera
        (BASE.format("1781719398272-6b119fdc6afa"), 3),  # gramófono y piano
    ],
    13: [  # Porcelana china Dinastía Ming
        (BASE.format("1776332514405-557bf85af096"), 1),  # vasijas azul/blanco con dragones
        (BASE.format("1723779232054-6f6be572c0e8"), 2),  # jarrón azul con aves
        (BASE.format("1770354227649-059bbfc475db"), 3),  # jarrón luminoso azul floral
    ],
}

for db_path in ("subastas.db", "seed.db"):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    for art_id, imgs in IMAGES.items():
        c.execute("DELETE FROM imagenes_articulo WHERE articulo_id = ?", (art_id,))
        for (url, orden) in imgs:
            c.execute(
                "INSERT INTO imagenes_articulo (articulo_id, url, orden) VALUES (?, ?, ?)",
                (art_id, url, orden),
            )
    conn.commit()
    conn.close()
    print(f"[OK] {db_path} actualizado.")

# Verificación rápida
conn = sqlite3.connect("subastas.db")
c = conn.cursor()
c.execute("""
    SELECT a.numero_pieza, a.descripcion, i.url, i.orden
    FROM imagenes_articulo i
    JOIN articulos a ON a.id = i.articulo_id
    WHERE a.numero_pieza LIKE 'PZ-1%'
    ORDER BY a.id, i.orden
""")
for row in c.fetchall():
    print(f"  {row[0]} ({row[3]}): ...{row[2][-40:]}")
conn.close()
