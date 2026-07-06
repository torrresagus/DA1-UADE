# Arquitectura — Sistema de Subastas (Bidify)

Documento de arquitectura y **mapa de flujos** de la app. Cada flujo enlaza a los
archivos y funciones reales que lo implementan (hipervínculos clicables en VS Code y
GitHub). Pensado para la exposición: seguí los links mientras contás cada flujo.

- **Backend:** [`app/`](app/) — API REST con **FastAPI** + **SQLAlchemy** (SQLite por defecto), migraciones con **Alembic**, tiempo real con **WebSockets**.
- **Frontend:** [`frontend/`](frontend/) — app móvil **Expo / React Native** (TypeScript), datos con **React Query**, navegación **expo-router**.
- **Documento del enunciado:** [`Enunciado.md`](Enunciado.md) · **API navegable:** `GET /docs` (Swagger) al levantar el backend.

---

## 1. Vista general (capas)

```
┌──────────────────────────── FRONTEND (Expo / React Native) ────────────────────────────┐
│  Pantallas (expo-router)        Hooks (React Query)        Capa API (fetch)             │
│  frontend/src/app/*      ──►     frontend/src/api/hooks/*   ──►  frontend/src/api/       │
│  (UI + validaciones)            (estado servidor, caché)        endpoints/* + client.ts │
│                                  adapters.ts (backend → view-model)                      │
└───────────────┬──────────────────────────────────────────────────────┬─────────────────┘
                │  HTTP (REST, JSON)                                     │  WebSocket (pujas en vivo)
┌───────────────▼──────────────────────────────────────────────────────▼─────────────────┐
│                                   BACKEND (FastAPI)                                      │
│  Routers (HTTP)            Services (reglas de negocio)        Models (SQLAlchemy)       │
│  app/routers/*      ──►    app/services/*               ──►    app/models/*              │
│  Schemas (Pydantic, validación entrada/salida)  app/schemas/*                            │
│                                                                                          │
│  ⏱  Scheduler cada 15s (app/main.py::_scheduler) → app/services/cierre.py  (el "motor")  │
└──────────────────────────────────────────────┬───────────────────────────────────────── ┘
                                                │
                                     Base de datos (SQLite / Alembic)
```

**Identidad:** la app no usa JWT. Login por email + contraseña (bcrypt) que devuelve el
usuario; el `usuario_id` es la identidad en las llamadas siguientes. La regla del enunciado
"sólo registrados ven el precio base" **se aplica en el servidor** (ver **Flujo 3**).

---

## 2. Estructura del repositorio

| Carpeta / archivo | Qué contiene |
|---|---|
| [`app/main.py`](app/main.py) | Arranque de FastAPI, CORS, montaje de routers y el **scheduler** ([`_scheduler`](app/main.py#L43)). |
| [`app/config.py`](app/config.py) | Configuración (envío, gastos, premio de seguro, SMTP, depósito, etc.). |
| [`app/database.py`](app/database.py) | Motor SQLAlchemy, `SessionLocal`, `get_db`. |
| [`app/models/`](app/models/) | Tablas del dominio (Usuario, Subasta, Articulo, Puja, Venta, Multa, Solicitud, Seguro…). |
| [`app/schemas/`](app/schemas/) | Esquemas Pydantic (validación de entrada/salida + `response_model`). |
| [`app/routers/`](app/routers/) | Endpoints HTTP por dominio. |
| [`app/services/`](app/services/) | Reglas de negocio: [`pujas`](app/services/pujas.py), [`cierre`](app/services/cierre.py), [`categorias`](app/services/categorias.py), [`realtime`](app/services/realtime.py), [`auth`](app/services/auth.py), [`email`](app/services/email.py). |
| [`alembic/versions/`](alembic/versions/) | Migraciones de esquema. |
| [`seed.py`](seed.py) | Datos de demo (3 usuarios, 7 piezas, 3 subastas, seguro, solicitud). |
| [`templates/admin/`](templates/admin/) | Panel web de administración (Jinja2). |
| [`frontend/src/`](frontend/src/) | App Expo (ver **sección 12 — Frontend**). |

---

## 3. El motor: scheduler automático

Es lo que hace que la demo "viva sola". [`app/main.py::_scheduler`](app/main.py#L43) corre cada
**15 segundos** y avanza toda la máquina de estados en
[`app/services/cierre.py`](app/services/cierre.py):

1. **Aprueba** usuarios pendientes (etapa 1) y les envía el mail para completar el registro → [`procesar_usuarios_pendientes`](app/services/cierre.py#L232).
2. **Verifica** medios de pago pendientes → [`procesar_medios_pago_pendientes`](app/services/cierre.py#L265).
3. **Avanza** solicitudes (INGRESADA → EN_INSPECCION) → [`procesar_solicitudes_pendientes`](app/services/cierre.py#L300).
4. **Abre** subastas programadas que llegaron a su hora → [`procesar_subastas_programadas`](app/services/cierre.py#L171).
5. **Cierra** subastas vencidas y genera las Ventas → [`procesar_subastas_vencidas`](app/services/cierre.py#L194) → [`_cerrar_item`](app/services/cierre.py#L105).
6. **Multa** las ventas impagas (10%) y bloquea → [`procesar_ventas_impagas`](app/services/cierre.py#L339).
7. **Deriva a la justicia** las multas vencidas → [`procesar_multas_vencidas`](app/services/cierre.py#L407).

> Para la demo los tiempos están acortados (segundos en vez de horas/días).

---

## 4. Flujos del dominio

### Flujo 1 — Registro de postores y categorías

**Enunciado:** registración en 2 etapas; verificación externa → categoría; mail para
generar clave; identificación antes de participar. Categorías: común, especial, plata, oro, platino.

- Etapa 1 (datos + fotos del documento) → [`registrar_etapa_1`](app/routers/usuarios.py) · [`app/routers/usuarios.py`](app/routers/usuarios.py)
- Aprobación + categoría + **mail** → [`aprobar_usuario`](app/routers/usuarios.py#L54) (también automático en el scheduler)
- Etapa 2 (genera clave) → [`registrar_etapa_2`](app/routers/usuarios.py)
- Login (email + bcrypt) → [`login`](app/routers/usuarios.py) · hashing en [`app/services/auth.py`](app/services/auth.py)
- Mail → [`app/services/email.py`](app/services/email.py) (SMTP con fallback a log)
- Categorías/ranking → [`app/models/enums.py`](app/models/enums.py) (`CategoriaUsuario`, `CATEGORIA_RANK`)
- Frontend: [`(auth)/register-account.tsx`](frontend/src/app/%28auth%29/register-account.tsx), [`(auth)/register-finish.tsx`](frontend/src/app/%28auth%29/register-finish.tsx), [`context/session.tsx`](frontend/src/context/session.tsx)

### Flujo 2 — Medios de pago

**Enunciado:** al menos un medio; cuentas (incl. extranjeras), tarjetas y cheques
certificados (con monto garantizado, verificado antes de la subasta); sólo un medio
verificado habilita a pujar; la diversidad mejora la categoría.

- CRUD + verificación → [`app/routers/medios_pago.py`](app/routers/medios_pago.py) ([`actualizar_medio_pago`](app/routers/medios_pago.py#L55) reinicia la verificación)
- Modelo (tipo, país, `monto_garantia`, moneda, verificado) → [`app/models/medio_pago.py`](app/models/medio_pago.py)
- Recategorización por diversidad/actividad → [`app/services/categorias.py`](app/services/categorias.py)
- Frontend: [`payments.tsx`](frontend/src/app/payments.tsx), [`hooks/useMediosPago.ts`](frontend/src/api/hooks/useMediosPago.ts)

### Flujo 3 — Catálogo y subastas (precio base público vs. privado)

**Enunciado:** catálogos públicos, pero **sólo los registrados ven el precio base**; el
acceso a una subasta requiere categoría del usuario ≥ categoría de la subasta.

- Endpoints + ocultamiento de precio → [`app/routers/subastas.py`](app/routers/subastas.py): [`listar_subastas`](app/routers/subastas.py#L63) / [`obtener_subasta`](app/routers/subastas.py) / `listar_catalogo` aceptan `usuario_id`; si no es registrado, el precio se devuelve como `null` (ver [`_es_registrado`](app/routers/subastas.py#L36) y `_ocultar_precios`).
- Ítems del catálogo, moneda (ARS/USD, no bimonetaria), rematador, colección → [`app/models/subasta.py`](app/models/subasta.py), [`app/models/articulo.py`](app/models/articulo.py), [`app/models/rematador.py`](app/models/rematador.py)
- Frontend: invitado navega el catálogo sin precio, registrado envía su `usuario_id` → [`hooks/useAuctions.ts`](frontend/src/api/hooks/useAuctions.ts), [`api/adapters.ts`](frontend/src/api/adapters.ts), [`components/auction-card.tsx`](frontend/src/components/auction-card.tsx), [`(tabs)/home.tsx`](frontend/src/app/%28tabs%29/home.tsx)

### Flujo 4 — Acceso en vivo, conexión única y tiempo real

**Enunciado:** varias subastas simultáneas, pero un usuario no puede estar conectado a
más de una a la vez; los conectados reciben las ofertas en tiempo real.

- Manager de conexiones (una subasta por usuario) + broadcast → [`app/services/realtime.py`](app/services/realtime.py)
- Endpoint WebSocket → [`app/routers/ws.py`](app/routers/ws.py) (`/ws/subastas/{id}`, rechazo code 4001)
- Frontend: [`hooks/useLiveSubasta.ts`](frontend/src/api/hooks/useLiveSubasta.ts), pantalla [`live/[id].tsx`](frontend/src/app/live/[id].tsx)

### Flujo 5 — Pujas (subasta dinámica ascendente)

**Enunciado:** la puja debe superar la mejor oferta; **mínimo = última + 1% del valor
base**, **máximo = última + 20% del valor base** (no aplica a oro/platino); sólo con medio
verificado; no se admite otra puja hasta que el sistema confirma e informa al resto.

- Reglas de monto (con ejemplo del enunciado) → [`rango_valido`](app/services/pujas.py#L59) · registro atómico + validaciones → [`validar_y_registrar_puja`](app/services/pujas.py#L80) · [`app/services/pujas.py`](app/services/pujas.py)
- Endpoint (valida + difunde por WS y recién responde) → [`crear_puja`](app/routers/pujas.py#L34) · [`app/routers/pujas.py`](app/routers/pujas.py)
- Modelo (guarda orden y `medio_pago_id`) → [`app/models/puja.py`](app/models/puja.py)
- Frontend: [`bid-confirmation.tsx`](frontend/src/app/bid-confirmation.tsx), [`hooks/usePujas.ts`](frontend/src/api/hooks/usePujas.ts)

### Flujo 6 — Cierre, venta, comisión, envío, seguro y liquidación

**Enunciado:** el último postor gana; se registra la venta con el medio de pago; importe =
puja + comisión + envío a la dirección declarada; retiro personal → pierde el seguro; el
dinero del vendedor va a su cuenta a la vista; si nadie puja, la empresa compra al valor base.

- Cierre automático (el de la demo) → [`_cerrar_item`](app/services/cierre.py#L105): usa el `medio_pago_id` de la puja, invalida el seguro si retira, calcula el envío e informa el importe, y **liquida al consignante** en su cuenta a la vista.
- Cierre/impago manual (endpoints) → [`app/routers/ventas.py`](app/routers/ventas.py)
- Modelos → [`app/models/venta.py`](app/models/venta.py)
- Frontend: [`result.tsx`](frontend/src/app/result.tsx), [`history.tsx`](frontend/src/app/history.tsx)

### Flujo 7 — Multas e impago

**Enunciado:** impago → multa del 10% de lo ofertado, a pagar antes de volver a participar,
con 72hs para presentar fondos; incumplimiento → derivación a la justicia y sin acceso.

- Generación de multa + bloqueo → [`procesar_ventas_impagas`](app/services/cierre.py#L339) / [`registrar_impago`](app/routers/ventas.py)
- Derivación a la justicia → [`procesar_multas_vencidas`](app/services/cierre.py#L407)
- Modelo → [`app/models/multa.py`](app/models/multa.py) · Frontend: [`multas.tsx`](frontend/src/app/multas.tsx)

### Flujo 8 — Solicitudes de venta de bienes

**Enunciado:** el usuario ofrece un bien (≥6 fotos, declara propiedad, origen lícito);
inspección; aceptar/rechazar informando por la app; colección si son muchos; devolución con
cargo; ante dudas de origen se avisa a las autoridades.

- Carga + declaración + **aviso a autoridades** → [`crear_solicitud`](app/routers/solicitudes.py) y [`_avisar_autoridades`](app/routers/solicitudes.py#L58) · [`app/routers/solicitudes.py`](app/routers/solicitudes.py)
- Resolución de la empresa (precio base, comisión, fecha, motivo, gastos) → [`resolver_solicitud`](app/routers/solicitudes.py)
- Respuesta del usuario + creación de artículo/seguro/subasta + colección → [`responder_solicitud`](app/routers/solicitudes.py)
- Panel admin → [`app/routers/admin.py`](app/routers/admin.py) + [`templates/admin/`](templates/admin/)
- Modelo/estados → [`app/models/solicitud.py`](app/models/solicitud.py), [`app/models/enums.py`](app/models/enums.py) (`EstadoSolicitud`)
- Frontend: [`upload-product.tsx`](frontend/src/app/upload-product.tsx), [`product-status.tsx`](frontend/src/app/product-status.tsx)

### Flujo 9 — Seguros, depósito y póliza

**Enunciado:** cada bien recibido se asegura por su valor base; una póliza cubre varias
piezas del mismo dueño; el dueño ve el depósito y la póliza y puede aumentar la cobertura
pagando la diferencia del premio.

- Seguros, depósitos, aumento de póliza → [`app/routers/articulos.py`](app/routers/articulos.py) ([`aumentar_seguro`](app/routers/articulos.py#L156) notifica la diferencia de premio)
- Modelo (póliza, `premio`, `vigente`, depósito) → [`app/models/articulo.py`](app/models/articulo.py)
- Frontend: [`seguros.tsx`](frontend/src/app/seguros.tsx)

### Flujo 10 — Métricas e historial

**Enunciado:** cada usuario ve su participación (asistidas, ganadas, importes) y métricas
por categoría; historial de pujas.

- Agregaciones SQL reales → [`app/routers/metricas.py`](app/routers/metricas.py)
- Frontend: [`(tabs)/metrics.tsx`](frontend/src/app/%28tabs%29/metrics.tsx), [`history.tsx`](frontend/src/app/history.tsx), [`hooks/useMetricas.ts`](frontend/src/api/hooks/useMetricas.ts)

### Flujo 11 — Notificaciones (mensajes privados)

Importe a pagar, resolución de solicitudes, multas, liquidaciones y seguros se comunican
como notificaciones (mensajes privados del enunciado).

- Backend → [`app/routers/notificaciones.py`](app/routers/notificaciones.py), [`app/models/notificacion.py`](app/models/notificacion.py)
- Frontend: [`(tabs)/notifications.tsx`](frontend/src/app/%28tabs%29/notifications.tsx), [`hooks/useNotificaciones.ts`](frontend/src/api/hooks/useNotificaciones.ts)

### Flujo 12 — Imágenes y uploads

**Enunciado:** cada pieza tiene ~6 imágenes; las solicitudes suben ≥6 fotos y las fotos
del documento en el registro.

**Cómo funciona:**

1. **Subida** → [`app/routers/uploads.py`](app/routers/uploads.py) (`POST /uploads`): guarda el archivo en `./media/` y devuelve una **ruta relativa** `/media/<archivo>`. Front: [`api/upload.ts`](frontend/src/api/upload.ts).
2. **Servido** → el backend expone `./media` como estáticos en `/media` (montado en [`app/main.py`](app/main.py)).
3. **Render en el panel admin** → usa `img.url` mismo-origen ([`templates/admin/detalle.html`](templates/admin/detalle.html)) → carga directo.
4. **Render en la app** → antes de mostrar cualquier imagen, la app la pasa por **`resolveImageUrl`** ([`api/client.ts`](frontend/src/api/client.ts)), aplicado en [`api/adapters.ts`](frontend/src/api/adapters.ts) (card, detalle y puja en vivo) y en [`app/product-status.tsx`](frontend/src/app/product-status.tsx).

> **Por qué `resolveImageUrl`:** las URLs `/media/...` deben apuntar a un host que el
> dispositivo pueda alcanzar. La función reescribe el origen de cualquier `/media/...`
> (relativa o absoluta a un host viejo: `localhost`, `10.0.2.2`, IP LAN) al host actual
> (`API_BASE_URL`), y deja intactas las URLs públicas (Unsplash/Picsum) y los URIs locales
> (`file://`, `content://`). Esto arregla el caso "las fotos subidas se ven en el admin
> pero no en la APK", que pasaba porque antes la URL se guardaba fija al host de la subida.

---

## 12. Frontend (Expo / React Native)

Arquitectura por capas (de afuera hacia adentro):

- **Pantallas** ([`frontend/src/app/`](frontend/src/app/)) — UI + validaciones de formulario. Navegación por archivos (expo-router).
- **Hooks** ([`frontend/src/api/hooks/`](frontend/src/api/hooks/)) — estado del servidor con React Query (caché, refetch, tiempo real).
- **Adapters** ([`frontend/src/api/adapters.ts`](frontend/src/api/adapters.ts)) — traducen las formas del backend a *view-models* de la UI.
- **Capa API** ([`frontend/src/api/endpoints/`](frontend/src/api/endpoints/) + [`client.ts`](frontend/src/api/client.ts)) — wrappers `fetch` tipados; `client.ts` centraliza URL base, errores (`ApiError`) y detección de falta de conexión.
- **Sesión** ([`frontend/src/context/session.tsx`](frontend/src/context/session.tsx)) — login, modo invitado, persistencia en AsyncStorage.
- **Manejo de errores/estados** → [`components/ui/states.tsx`](frontend/src/components/ui/states.tsx) (loading/error/empty) e [`components/ui/input.tsx`](frontend/src/components/ui/input.tsx) (validación inline).

---

## 13. Cómo correr

Backend (desde la raíz):

```bash
make local          # crea venv, instala deps, migra y siembra la BD (una vez)
make run            # levanta la API en http://localhost:8000  (Swagger en /docs)
```

Frontend:

```bash
make frontend       # instala node_modules (si falta) y levanta Expo web
# o dentro de frontend/: npm install && npm run web
```

Usuarios de demo (contraseña `demo1234`): `ana@example.com` (plata), `luis@example.com`
(oro), `sofia@example.com` (platino). Admin: `admin` / `bidify2026` en `/admin`.

---

## 14. Mapa rápido: enunciado → código

| Requisito del enunciado | Dónde |
|---|---|
| Registro en 2 etapas + categoría + mail | [`app/routers/usuarios.py`](app/routers/usuarios.py), [`app/services/email.py`](app/services/email.py) |
| Medios de pago (CRUD, verificación, garantía) | [`app/routers/medios_pago.py`](app/routers/medios_pago.py) |
| Precio base sólo a registrados | [`listar_subastas`](app/routers/subastas.py#L63) + [`_es_registrado`](app/routers/subastas.py#L36) |
| Conexión única + tiempo real | [`app/services/realtime.py`](app/services/realtime.py), [`app/routers/ws.py`](app/routers/ws.py) |
| Puja: +1% mín / +20% máx (no oro/platino) | [`rango_valido`](app/services/pujas.py#L59) |
| Sólo con medio verificado | [`validar_y_registrar_puja`](app/services/pujas.py#L80) |
| Cierre: venta, comisión, envío, seguro, liquidación | [`_cerrar_item`](app/services/cierre.py#L105) |
| Multa 10% + 72hs + justicia | [`procesar_ventas_impagas`](app/services/cierre.py#L339), [`procesar_multas_vencidas`](app/services/cierre.py#L407) |
| Solicitudes, inspección, colección, autoridades | [`app/routers/solicitudes.py`](app/routers/solicitudes.py) |
| Seguro por valor base + aumentar póliza | [`app/routers/articulos.py`](app/routers/articulos.py) |
| Métricas de participación | [`app/routers/metricas.py`](app/routers/metricas.py) |
| Imágenes de piezas/solicitudes (subida y render) | [`app/routers/uploads.py`](app/routers/uploads.py), `resolveImageUrl` en [`frontend/src/api/client.ts`](frontend/src/api/client.ts) |
