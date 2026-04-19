# Explicación del proyecto — Sistema de Subastas (API)

**Materia:** Desarrollo de Aplicaciones I — 1° Cuatrimestre 2026
**Entregable cubierto:** punto 4 de la primera entrega — *"Descripción de los endpoints del API Rest diseñado con sus correspondientes parámetros, retornos, códigos de retorno (200, 404, etc.), puede utilizar Swagger"*.

Este documento describe **qué construimos, por qué y cómo correrlo**, y funciona como guía de lectura del código.

---

## 1. Objetivo

Desarrollar el **backend REST** del Sistema de Subastas descripto en el enunciado, con su documentación interactiva en **Swagger** (OpenAPI 3). La API permite:

- Registrar postores en **dos etapas** (carga de datos + generación de clave).
- Aprobar al postor y asignarle una **categoría** (común, especial, plata, oro, platino).
- Gestionar **medios de pago** del postor y verificarlos antes de la subasta.
- Definir **rematadores**, **depósitos**, **artículos** (con imágenes), **seguros** y **subastas** con su **catálogo**.
- Registrar **pujas** con validación completa del dominio.
- Cerrar **ventas**, emitir **multas** por impago y bloquear al usuario.
- Recibir **solicitudes** de postores que quieren incluir un bien en una futura subasta.
- Consultar **métricas** por usuario y por subasta.

> El enunciado aclara que la app consume tablas de un sistema interno existente. Como ese sistema no existe para la cursada, **recreamos todas las tablas** para poder correr la API de punta a punta (incluye las que normalmente serían "solo lectura" como `usuarios` y `rematadores`).

---

## 2. Stack

| Componente              | Versión      | Rol                                                      |
|-------------------------|--------------|----------------------------------------------------------|
| **Python**              | 3.11+        | Lenguaje base                                            |
| **FastAPI**             | 0.115        | Framework web + generación automática de Swagger/OpenAPI |
| **Uvicorn**             | 0.30         | Servidor ASGI                                            |
| **Pydantic v2**         | 2.9          | Validación de request/response, serialización, schemas   |
| **pydantic-settings**   | 2.5          | Carga de configuración desde `.env`                      |
| **SQLAlchemy 2.0**      | 2.0.36       | ORM (estilo `Mapped` / `mapped_column`)                  |
| **Alembic**             | 1.13         | Migraciones de base de datos versionadas                 |
| **SQLite**              | embebido     | Base por defecto — cero configuración para la demo       |

> Cambiar la base a PostgreSQL es un cambio de una línea: setear `DATABASE_URL` en `.env`.

---

## 3. Estructura del proyecto

```
da1/
├── app/
│   ├── main.py                 # FastAPI app + CORS + include_router
│   ├── config.py               # Settings (pydantic-settings + .env)
│   ├── database.py             # engine, SessionLocal, Base, get_db
│   ├── models/                 # SQLAlchemy 2.0 (un archivo por agregado)
│   │   ├── enums.py            # CategoriaUsuario, EstadoSubasta, Moneda, ...
│   │   ├── usuario.py          # Usuario + CuentaCobro
│   │   ├── rematador.py
│   │   ├── medio_pago.py
│   │   ├── articulo.py         # Articulo, ImagenArticulo, Deposito, Seguro
│   │   ├── subasta.py          # Subasta + CatalogoItem (N:M con precio base)
│   │   ├── puja.py
│   │   ├── venta.py
│   │   ├── multa.py
│   │   └── solicitud.py        # SolicitudSubasta + ImagenSolicitud
│   ├── schemas/                # Pydantic v2 (Create / Out / Resoluciones)
│   ├── routers/                # Endpoints por recurso
│   │   ├── usuarios.py
│   │   ├── medios_pago.py
│   │   ├── rematadores.py
│   │   ├── articulos.py        # + depositos_router + seguros_router
│   │   ├── subastas.py
│   │   ├── pujas.py
│   │   ├── ventas.py
│   │   ├── multas.py
│   │   ├── solicitudes.py
│   │   └── metricas.py
│   └── services/
│       └── pujas.py            # Reglas de negocio de las pujas
├── alembic/
│   ├── env.py                  # Toma DATABASE_URL del config
│   ├── script.py.mako
│   └── versions/
│       └── 0001_initial.py     # Migración inicial con todas las tablas
├── alembic.ini
├── requirements.txt
├── seed.py                     # Datos de demo para probar en Swagger
├── .env.example
├── .gitignore
├── README.md
└── explicacion.md              # Este documento
```

**Por qué esta estructura:** separa **dominio** (models), **contrato API** (schemas), **transporte** (routers) y **reglas de negocio** (services). Permite testear cada capa y crecer sin mezclar responsabilidades.

---

## 4. Modelo de dominio

### 4.1 Entidades

| Entidad               | Descripción                                                                 |
|-----------------------|-----------------------------------------------------------------------------|
| **Usuario**           | Postor. Guarda datos personales, documento, categoría y estado de registro. |
| **CuentaCobro**       | Cuenta bancaria (puede ser del exterior) para liquidar ventas del usuario.  |
| **MedioPago**         | Cuenta bancaria / tarjeta / cheque certificado. Puede tener garantía.       |
| **Rematador**         | Martillero asignado a una subasta.                                          |
| **Articulo**          | Pieza / ítem. Puede agrupar varios elementos (juego de té, etc.).           |
| **ImagenArticulo**    | Imágenes del artículo (se esperan ~6).                                      |
| **Deposito**          | Ubicación física donde se guarda una pieza entregada.                       |
| **Seguro**            | Póliza que cubre una o más piezas **de un mismo dueño**.                    |
| **Subasta**           | Evento con fecha, ubicación, moneda, categoría mínima y rematador.          |
| **CatalogoItem**      | Relación N:M entre `Subasta` y `Articulo`, con su precio base y orden.      |
| **Puja**              | Oferta de un usuario sobre un `CatalogoItem`, con timestamp.                |
| **Venta**             | Cierre: artículo vendido al mejor postor, con comisión y envío.             |
| **Multa**             | Penalidad por impago (10%) que bloquea al usuario hasta regularizar.        |
| **SolicitudSubasta**  | Pedido de un postor para incluir un bien propio en una futura subasta.      |

### 4.2 Enumeraciones

```text
CategoriaUsuario  : comun | especial | plata | oro | platino
EstadoRegistro    : pendiente_verificacion | aprobado_fase_1 | completo | rechazado | bloqueado
EstadoSubasta     : programada | abierta | cerrada | cancelada
EstadoSolicitud   : ingresada | en_inspeccion | aceptada | rechazada | devuelta
EstadoArticulo    : disponible | en_subasta | vendido | retirado
EstadoPuja        : pendiente | confirmada | rechazada
Moneda            : ARS | USD
TipoMedioPago     : cuenta_bancaria | tarjeta_credito | cheque_certificado
EstadoMedioPago   : pendiente | verificado | rechazado
```

### 4.3 Diagrama conceptual (ER simplificado)

```
Usuario 1──* MedioPago
Usuario 1──* CuentaCobro
Usuario 1──* Puja ──* CatalogoItem *── 1 Subasta *── 1 Rematador
Usuario 1──* SolicitudSubasta 1──* ImagenSolicitud
Usuario 1──* Multa
Usuario 1──* Venta ──1 MedioPago
                └──1 CatalogoItem
Articulo 1──* ImagenArticulo
Articulo *──1 Deposito
Articulo *──* Seguro  (seguros_articulos)
Subasta  1──* CatalogoItem ──* Puja
CatalogoItem 1──1 Venta
```

---

## 5. Reglas de negocio (implementadas en `app/services/pujas.py` y routers)

### 5.1 Registración (2 etapas)
1. El postor envía datos en **`POST /usuarios/registro/etapa-1`** → estado `pendiente_verificacion`.
2. La empresa aprueba y asigna categoría: **`POST /usuarios/{id}/aprobacion`** → estado `aprobado_fase_1`.
3. El postor completa registro con su clave: **`POST /usuarios/{id}/registro/etapa-2`** → estado `completo`.

### 5.2 Acceso a una subasta
- El usuario debe estar `completo`.
- **Categoría del usuario ≥ categoría mínima de la subasta** (orden: comun < especial < plata < oro < platino).

### 5.3 Validación de pujas
Implementado en `validar_y_registrar_puja`:

1. La subasta debe estar `abierta`.
2. El `CatalogoItem` no debe estar vendido.
3. El usuario no debe estar bloqueado por impago ni tener multas impagas.
4. La categoría del usuario debe alcanzar la de la subasta.
5. El usuario necesita **al menos un medio de pago verificado**.
6. Si tiene **cheque certificado** con `monto_garantia`, la suma de sus ventas + la puja actual no puede superar ese monto.
7. **Rango del monto:**
   - **Mínimo:** `última_oferta + 1% * precio_base` (o `precio_base` si no hay ofertas).
   - **Máximo:** `última_oferta + 20% * precio_base`.
   - El máximo **no aplica** si la subasta es categoría `oro` o `platino`.

El endpoint **`GET /pujas/item/{id}/mejor`** devuelve la mejor oferta y el rango válido para la próxima puja — pensado para que el cliente móvil valide antes de enviar.

### 5.4 Cierre y pago
- **`POST /ventas/cerrar/{catalogo_item_id}`** toma la mejor puja y genera una `Venta` con comisión y envío. Marca el artículo como `vendido`.
- **`POST /ventas/{id}/impago`** genera una multa del **10%** del valor ofertado y **bloquea** al usuario.
- **`POST /multas/{id}/pagar`** marca la multa como paga; si no quedan multas impagas, **desbloquea** al usuario.

### 5.5 Solicitudes de incorporación
- Requieren `declara_propiedad = true` y `acepta_devolucion_con_cargo = true` (validado en el POST).
- La empresa resuelve: `aceptada` / `rechazada` / `devuelta` con motivo y precio base / comisión / fecha propuestos.

### 5.6 Seguro
- Sólo cubre piezas **de un mismo dueño**; el beneficiario es el dueño. Se valida al crear el seguro.

---

## 6. Endpoints — resumen por recurso

| Recurso       | Método | Ruta                                            | Descripción                                    | Códigos |
|---------------|--------|-------------------------------------------------|------------------------------------------------|---------|
| Usuarios      | POST   | `/usuarios/registro/etapa-1`                    | Alta del postor (etapa 1)                      | 201, 409 |
| Usuarios      | POST   | `/usuarios/{id}/aprobacion`                     | Aprobación + categoría                         | 200, 404 |
| Usuarios      | POST   | `/usuarios/{id}/registro/etapa-2`               | Generación de clave                            | 200, 404, 409 |
| Usuarios      | GET    | `/usuarios`                                     | Listado                                        | 200 |
| Usuarios      | GET    | `/usuarios/{id}`                                | Detalle                                        | 200, 404 |
| Cuentas cobro | POST   | `/usuarios/{id}/cuentas-cobro`                  | Declarar cuenta de cobro                       | 201, 404 |
| Cuentas cobro | GET    | `/usuarios/{id}/cuentas-cobro`                  | Listar cuentas del usuario                     | 200 |
| Medios pago   | POST   | `/usuarios/{id}/medios-pago`                    | Registrar medio de pago                        | 201, 404 |
| Medios pago   | GET    | `/usuarios/{id}/medios-pago`                    | Listar medios                                  | 200 |
| Medios pago   | POST   | `/usuarios/{id}/medios-pago/{mp}/verificar`     | Verificar / rechazar                           | 200, 404 |
| Medios pago   | DELETE | `/usuarios/{id}/medios-pago/{mp}`               | Eliminar                                       | 204, 404 |
| Rematadores   | POST   | `/rematadores`                                  | Alta                                           | 201, 409 |
| Rematadores   | GET    | `/rematadores`, `/rematadores/{id}`             | Listar / detalle                               | 200, 404 |
| Artículos     | POST   | `/articulos`                                    | Alta con imágenes                              | 201, 409 |
| Artículos     | GET    | `/articulos`, `/articulos/{id}`                 | Listar / detalle                               | 200, 404 |
| Artículos     | PUT    | `/articulos/{id}/deposito/{dep}`                | Asignar depósito                               | 200, 404 |
| Depósitos     | POST   | `/depositos`                                    | Alta                                           | 201 |
| Depósitos     | GET    | `/depositos`                                    | Listar                                         | 200 |
| Seguros       | POST   | `/seguros`                                      | Crear póliza (valida dueño único)              | 201, 400, 409 |
| Seguros       | GET    | `/seguros`                                      | Listar                                         | 200 |
| Subastas      | POST   | `/subastas`                                     | Alta                                           | 201, 404 |
| Subastas      | GET    | `/subastas`                                     | Listar (filtro por estado)                     | 200 |
| Subastas      | GET    | `/subastas/publicas`                            | Catálogo público **sin precios base**          | 200 |
| Subastas      | GET    | `/subastas/{id}`                                | Detalle (con control opcional de acceso)       | 200, 403, 404 |
| Subastas      | POST   | `/subastas/{id}/estado`                         | Cambiar estado                                 | 200, 404 |
| Subastas      | POST   | `/subastas/{id}/catalogo`                       | Agregar ítem                                   | 201, 404 |
| Subastas      | GET    | `/subastas/{id}/catalogo`                       | Catálogo completo con precios                  | 200, 404 |
| Pujas         | POST   | `/pujas`                                        | Registrar puja (valida reglas)                 | 201, 400, 404 |
| Pujas         | GET    | `/pujas/item/{id}`                              | Historial de un ítem                           | 200 |
| Pujas         | GET    | `/pujas/item/{id}/mejor`                        | Mejor oferta + rango válido                    | 200, 404 |
| Pujas         | GET    | `/pujas/usuario/{id}`                           | Historial de un usuario                        | 200 |
| Ventas        | POST   | `/ventas/cerrar/{catalogo_item_id}`             | Cerrar venta (toma mejor puja)                 | 201, 400, 404, 409 |
| Ventas        | POST   | `/ventas/{id}/impago`                           | Registrar impago → multa + bloqueo             | 201, 404, 409 |
| Ventas        | GET    | `/ventas`, `/ventas/{id}`                       | Listar / detalle                               | 200, 404 |
| Ventas        | POST   | `/ventas/{id}/pagar`                            | Marcar como pagada                             | 200, 404 |
| Multas        | POST   | `/multas`                                       | Alta manual                                    | 201, 404 |
| Multas        | GET    | `/multas/usuario/{id}`                          | Listar por usuario                             | 200 |
| Multas        | POST   | `/multas/{id}/pagar`                            | Pagar (puede desbloquear al usuario)           | 200, 404 |
| Solicitudes   | POST   | `/solicitudes/{usuario_id}`                     | Solicitar incluir bien en subasta              | 201, 400, 404 |
| Solicitudes   | GET    | `/solicitudes`, `/solicitudes/{id}`             | Listar / detalle                               | 200, 404 |
| Solicitudes   | POST   | `/solicitudes/{id}/resolver`                    | Aceptar / rechazar                             | 200, 404 |
| Métricas      | GET    | `/metricas/usuario/{id}`                        | Pujas, ganadas, importes                       | 200 |
| Métricas      | GET    | `/metricas/subasta/{id}`                        | Items, vendidos, total de pujas                | 200 |
| Sistema       | GET    | `/health`                                       | Healthcheck                                    | 200 |

**Total:** 40 paths, 52 operaciones documentadas en Swagger.

### 6.1 Códigos HTTP usados

| Código | Cuándo                                                                   |
|--------|---------------------------------------------------------------------------|
| 200    | GET ok / actualización ok                                                |
| 201    | Creación de recurso                                                      |
| 204    | Eliminación ok (sin body)                                                |
| 400    | Regla de negocio violada (puja fuera de rango, declaración faltante, …)  |
| 403    | Usuario no autorizado (categoría insuficiente, registro incompleto)      |
| 404    | Recurso no encontrado                                                    |
| 409    | Conflicto (email duplicado, matrícula repetida, ítem ya vendido, …)      |

---

## 7. Ejemplo de flujo end-to-end

```text
1. POST /rematadores                                (alta del martillero)
2. POST /usuarios/registro/etapa-1                  (Ana manda sus datos)
3. POST /usuarios/1/aprobacion  {categoria: "plata"}
4. POST /usuarios/1/registro/etapa-2                (Ana define clave)
5. POST /usuarios/1/medios-pago                     (tarjeta)
6. POST /usuarios/1/medios-pago/1/verificar {verificado:true}
7. POST /articulos                                   (cuadro, 6 imágenes)
8. POST /subastas                                    (cat mínima: plata)
9. POST /subastas/1/catalogo   {articulo_id:1, precio_base:10000}
10. POST /subastas/1/estado    {estado:"abierta"}
11. GET  /pujas/item/1/mejor                         (ver rango)
12. POST /pujas                {catalogo_item_id:1, usuario_id:1, monto:10100}
13. POST /subastas/1/estado    {estado:"cerrada"}
14. POST /ventas/cerrar/1?medio_pago_id=1&comision_pct=0.10
15. POST /ventas/1/pagar                             (o /impago → multa + bloqueo)
16. GET  /metricas/usuario/1
```

Probado manualmente y pasa todas las validaciones (ver README).

---

## 8. Cómo correr

```bash
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env

alembic upgrade head                  # crea todas las tablas
python seed.py                        # datos de demo (opcional)

uvicorn app.main:app --reload
```

- Swagger UI: <http://127.0.0.1:8000/docs>
- ReDoc:      <http://127.0.0.1:8000/redoc>
- OpenAPI JSON: <http://127.0.0.1:8000/openapi.json>

### Variables de entorno (`.env`)

| Variable       | Default                     | Descripción                                |
|----------------|-----------------------------|--------------------------------------------|
| `DATABASE_URL` | `sqlite:///./subastas.db`   | Conexión SQLAlchemy                        |
| `APP_NAME`     | `Sistema de Subastas API`   | Título de la API en Swagger                |
| `SECRET_KEY`   | `changeme-uade-da1-2026`    | Placeholder para futuro login con JWT      |

---

## 9. Decisiones y limitaciones conocidas

- **SQLite** es el default para simplificar la corrección. En producción se usa PostgreSQL cambiando `DATABASE_URL`.
- **Autenticación**: no se implementa login/JWT en esta entrega (el foco era el diseño del API y la documentación en Swagger). El campo `password_hash` se guarda como placeholder (`hashed:<password>`) — un próximo iteración usará `passlib[bcrypt]`.
- **Streaming de la subasta en vivo**: queda fuera del alcance (lo aclara el enunciado).
- **Tiempo real entre postores conectados**: la entrega 1 expone endpoints para consultar mejor oferta y rango, que el cliente móvil puede pollear o, más adelante, escuchar vía WebSocket.
- **Tablas "legacy"**: el enunciado indica que algunas tablas son del sistema interno existente. Las recreamos acá para que la app corra sola; al integrar con el sistema real, `alembic` no debería gestionar esas tablas (se marcarían como externas).

---

## 10. Checklist de la consigna

| Requisito del enunciado                                                                 | Dónde |
|------------------------------------------------------------------------------------------|-------|
| Registro del postor en 2 etapas + aprobación con categoría                               | `routers/usuarios.py` |
| Medios de pago (cuenta, tarjeta, cheque) con verificación                                | `routers/medios_pago.py` |
| Catálogo público **sin** precios base / catálogo completo para registrados               | `routers/subastas.py` (`/publicas` vs `/catalogo`) |
| Subastas por categoría, moneda única (ARS/USD) y rematador                               | `models/subasta.py` |
| Rango de pujas 1% / 20%, excepción oro/platino                                           | `services/pujas.py` |
| Cheque certificado: tope de gasto                                                        | `services/pujas.py` |
| Venta → comisión, costo de envío, retiro personal                                        | `routers/ventas.py` |
| Multa 10% por impago + bloqueo del usuario                                               | `routers/ventas.py` + `routers/multas.py` |
| Solicitudes con declaración de propiedad y aceptación de devolución con cargo            | `routers/solicitudes.py` |
| Seguro por pieza de un mismo dueño                                                       | `routers/articulos.py` (`/seguros`) |
| Historial de pujas por ítem y por usuario                                                | `routers/pujas.py` |
| Métricas (pujas, ganadas, importes)                                                      | `routers/metricas.py` |
| Documentación de endpoints con parámetros, retornos y códigos HTTP                       | **Swagger en `/docs`** |
