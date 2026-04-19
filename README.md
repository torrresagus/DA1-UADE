# Sistema de Subastas — API (UADE DA1 1C 2026)

API REST del proyecto de **Desarrollo de Aplicaciones I**. Cubre la registración
de postores, catálogo de bienes, subastas dinámicas ascendentes, pujas, ventas,
multas por impago, solicitudes de incorporación de bienes, seguros y depósitos.

> Nota: el enunciado menciona que la app consume tablas del sistema interno de
> la empresa. Como ese sistema no existe, en este proyecto se **recrean** todas
> las tablas (usuarios, rematadores, artículos, etc.) para poder ejecutar la API
> de punta a punta.

## Stack

- Python 3.11+
- FastAPI + Uvicorn
- Pydantic v2 + pydantic-settings
- SQLAlchemy 2.0
- Alembic (migraciones)
- SQLite por defecto (sin configuración adicional)

## Puesta en marcha

```bash
python -m venv .venv
source .venv/bin/activate       # en Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

### Correr migraciones con Alembic

```bash
alembic upgrade head
```

### (Opcional) Cargar datos de demo

```bash
python seed.py
```

### Levantar el servidor

```bash
uvicorn app.main:app --reload
```

Abrir **Swagger UI**: <http://127.0.0.1:8000/docs>
Abrir **ReDoc**: <http://127.0.0.1:8000/redoc>

## Endpoints principales

| Recurso            | Prefijo                         |
|--------------------|---------------------------------|
| Usuarios / postores| `/usuarios`                     |
| Medios de pago     | `/usuarios/{id}/medios-pago`    |
| Rematadores        | `/rematadores`                  |
| Artículos          | `/articulos`                    |
| Depósitos          | `/depositos`                    |
| Seguros            | `/seguros`                      |
| Subastas           | `/subastas`                     |
| Pujas              | `/pujas`                        |
| Ventas             | `/ventas`                       |
| Multas             | `/multas`                       |
| Solicitudes        | `/solicitudes`                  |
| Métricas           | `/metricas`                     |

Todos los endpoints documentan parámetros, body, **códigos HTTP** (200, 201,
204, 400, 403, 404, 409) y ejemplos en Swagger.

## Reglas de negocio implementadas

- Registración en dos etapas + aprobación con categoría
  (común / especial / plata / oro / platino).
- Acceso a subastas por categoría del usuario ≥ categoría mínima de la subasta.
- Puja válida si el usuario tiene al menos un medio de pago **verificado**.
- Incremento mínimo de puja: última oferta + 1% del precio base.
- Incremento máximo: última oferta + 20% del precio base
  (excepto subastas **oro** y **platino**, sin tope).
- Si el usuario tiene **cheque certificado**, sus compras no pueden superar el
  monto garantizado.
- Impago: genera multa del 10% del valor ofertado y **bloquea** al usuario
  hasta regularizar.
- Solicitudes de incorporación: requieren declaración de propiedad y aceptación
  de devolución con cargo.
- Seguro: sólo cubre piezas de un mismo dueño (beneficiario único).

## Flujo de usuario (Bidify) — mapeo pantallas ↔ endpoints

El equipo de UX definió el flujo de la app móvil **Bidify**. Esta API cubre los
endpoints que cada pantalla consume.

### 1. Acceso e identidad

| # | Pantalla             | Endpoints                                                |
|---|----------------------|-----------------------------------------------------------|
| 1 | Splash Screen        | —                                                         |
| 2 | Onboarding           | —                                                         |
| 3 | Login                | *(pendiente: `POST /auth/login` — próxima entrega)*       |

### 2. Registro y verificación

| #   | Pantalla                 | Endpoints                                                   |
|-----|--------------------------|-------------------------------------------------------------|
| 4   | Registro Paso 1 – Cuenta | `POST /usuarios/registro/etapa-1`                           |
| 4.1 | Validación Pendiente     | `GET /usuarios/{id}` *(poll del `estado_registro`)*         |
| 5   | Registro Paso 2 – Finalizar | `POST /usuarios/{id}/registro/etapa-2` + `POST /usuarios/{id}/medios-pago` |

### 3. Exploración y participación

| # | Pantalla                  | Endpoints                                                                 |
|---|---------------------------|---------------------------------------------------------------------------|
| 6 | Home / Subastas Activas   | `GET /subastas/publicas` (sin categoría), `GET /subastas?estado=abierta` |
| 7 | Detalle de Subasta        | `GET /subastas/{id}` + `GET /subastas/{id}/catalogo`                      |
| 8 | Sala de Subasta en Vivo   | `GET /pujas/item/{id}/mejor` (polling) + `POST /pujas`                    |

### 4. Transacción y resultados

| #    | Pantalla                  | Endpoints                                                  |
|------|---------------------------|------------------------------------------------------------|
| 9    | Confirmación de Puja      | `GET /pujas/item/{id}/mejor` (rango válido) + `POST /pujas` |
| 10   | Resultado Ganó            | `GET /ventas/{id}` (desglose de comisión + envío)          |
| 10.1 | Resultado Perdió          | `GET /pujas/item/{id}` (historial del ítem)                |
| 10.2 | Pago Aprobado             | `POST /ventas/{id}/pagar`                                  |

### 5. Gestión del usuario y activos

| #  | Pantalla              | Endpoints                                                                 |
|----|-----------------------|---------------------------------------------------------------------------|
| 11 | Perfil                | `GET /usuarios/{id}` + `GET /metricas/usuario/{id}`                       |
| 12 | Gestión de Pagos      | `GET/POST/DELETE /usuarios/{id}/medios-pago` + `.../verificar`            |
| 13 | Historial             | `GET /pujas/usuario/{id}` + `GET /ventas` (filtradas por comprador)       |
| 14 | Métricas              | `GET /metricas/usuario/{id}`                                              |

### 6. Flujo del vendedor

| #  | Pantalla              | Endpoints                                                      |
|----|-----------------------|----------------------------------------------------------------|
| 15 | Carga de Producto     | `POST /solicitudes/{usuario_id}` (con imágenes y declaraciones)|
| 16 | Estado del Producto   | `GET /solicitudes/{id}` + `POST /solicitudes/{id}/resolver`    |
| 17 | Notificaciones        | *(pendiente: `GET /notificaciones` — próxima entrega)*         |

> Los botones **+1% / +5% / +10%** de la Sala en Vivo (Pantalla 8) se validan
> contra `GET /pujas/item/{id}/mejor`, que devuelve `minimo_proxima` y
> `maximo_proxima` para no romper las reglas de rango del dominio.

## Estructura

```
app/
  main.py            # FastAPI app + montaje de routers
  config.py          # Settings (pydantic-settings)
  database.py        # engine + SessionLocal + Base
  models/            # SQLAlchemy 2.0 (Mapped/mapped_column)
  schemas/           # Pydantic v2
  routers/           # Endpoints por recurso
  services/pujas.py  # Reglas de pujas
alembic/             # Migraciones
seed.py              # Datos de demo
```
