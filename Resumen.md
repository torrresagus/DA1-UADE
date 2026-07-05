# Bidify — Resumen completo del proyecto

> **Instrucción para Claude:** Leé este archivo al comienzo de cada sesión para tener contexto completo del proyecto sin necesidad de analizar el código fuente.
> **Última actualización:** 2026-07-04 (sesión 3)

---

## 1. Contexto académico

- **Materia:** Desarrollo de Aplicaciones I (DA1) — UADE, 1C 2026
- **Alumno:** Kevin Alajarin (alajarinkevin@hotmail.com)
- **Proyecto:** Trabajo práctico grupal — app móvil de subastas llamada **Bidify**
- **Entregas:** 3 etapas (wireframes/API → 50% funcional → 100% funcional + desplegado)
- **Estado actual (2026-07-04):** backend deployado en Fly.io, APK Android generado con EAS Build, panel admin con gestión de cuentas y productos

---

## 2. Arquitectura general

```
DA1-UADE/
├── app/                  # Backend Python (FastAPI)
├── frontend/             # Frontend móvil (Expo / React Native)
├── alembic/              # Migraciones de base de datos
├── templates/            # Templates HTML del panel de admin
│   └── admin/            # lista.html, detalle.html, login.html, cuentas.html
├── seed_demo.py          # Script que insertó las 5 subastas demo
├── fix_images.py         # Script que actualizó imágenes a URLs Unsplash correctas
├── seed.db               # DB pre-cargada con datos demo (copiada al volumen en primer boot)
├── Dockerfile            # Imagen Docker para Fly.io
├── fly.toml              # Configuración de Fly.io
├── .dockerignore         # Excluye subastas.db local, media/, frontend/, etc.
└── subastas.db           # Base de datos SQLite (dev local)
```

### Producción (Fly.io)
- **Backend:** `https://bidify-da1.fly.dev`
- **Admin:** `https://bidify-da1.fly.dev/admin`
- **Volumen persistente:** `bidify_data` montado en `/data` (región `gru` — São Paulo)
  - `/data/subastas.db` — base de datos SQLite
  - `/data/media/` — imágenes subidas por usuarios
- **Primer boot:** el CMD del Dockerfile copia `seed.db` a `/data/subastas.db` si el volumen está vacío
- **APK Android:** generado con EAS Build (perfil `preview`), conecta directo a `https://bidify-da1.fly.dev`
  - Build ID: `de56afb7-a0a9-4a3f-96ec-d058adbee1de` (EAS / @kevin100301/bidify)

### Desarrollo local
- Backend: `python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- Frontend: `cd frontend && npx expo start`
- Todo junto (Windows): `local.bat`

---

## 3. Stack técnico

### Backend
- **Python 3.11+** · FastAPI + Uvicorn · Pydantic v2 + pydantic-settings
- **SQLAlchemy 2.0** (Mapped/mapped_column) · **Alembic** (migraciones en `alembic/versions/`)
- **SQLite** por defecto (configurable vía `.env` con `DATABASE_URL`)
- **WebSocket** nativo de FastAPI para pujas en tiempo real
- Storage de imágenes: `/data/media/` en producción, `./media/` en dev — servido como StaticFiles en `/media`
- Scheduler automático cada 15 segundos (en `main.py`)
- **Jinja2** para el panel de administración web (`/admin`)

### Frontend
- **Expo SDK 54** · React Native 0.81.5 · TypeScript
- **expo-router** (file-based routing)
- **@tanstack/react-query** para data fetching y caché
- **@react-native-async-storage/async-storage** para persistir sesión
- **@expo/vector-icons** (Ionicons)
- Variable de entorno: `EXPO_PUBLIC_API_URL=https://bidify-da1.fly.dev` (en `.env` y `eas.json`)
- WebSocket: `API_BASE_URL.replace(/^http/, 'ws')` → `wss://bidify-da1.fly.dev`

### Configuración backend (`app/config.py`)
- `empresa_email`: "empresa@bidify.local" (usuario id=5 que compra lotes sin pujas)
- `database_url`: `sqlite:////data/subastas.db` en producción
- `media_dir`: `/data/media` en producción

---

## 4. Modelos de datos (backend)

### Enums (`app/models/enums.py`)
- `CategoriaUsuario`: comun(1) < especial(2) < plata(3) < oro(4) < platino(5)
- `EstadoRegistro`: pendiente_verificacion | aprobado_fase_1 | completo | rechazado | bloqueado
- `EstadoSubasta`: programada | abierta | cerrada | cancelada
- `EstadoSolicitud`: ingresada | en_inspeccion | aceptada | rechazada | confirmada_por_usuario | rechazada_por_usuario | devuelta
- `EstadoArticulo`: disponible | en_subasta | vendido | retirado
- `EstadoPuja`: pendiente | confirmada | rechazada
- `Moneda`: ARS | USD
- `TipoMedioPago`: cuenta_bancaria | tarjeta_credito | cheque_certificado
- `EstadoMedioPago`: pendiente | verificado | rechazado

> **IMPORTANTE — SQLAlchemy Enum type:** El modelo usa `mapped_column(Enum(EstadoSubasta))` (no `String`). SQLAlchemy almacena el **nombre** del enum en la DB (ej: `'ABIERTA'`). Al filtrar, usar el enum member directamente (`Subasta.estado == EstadoSubasta.ABIERTA`) o `.name` explícito. En `cierre.py` se usa `.name` porque hay asignaciones directas también.

### Modelos principales
```
Usuario:       id, nombre, apellido, email, password_hash, doc_frente_url, doc_dorso_url,
               domicilio, pais, categoria, estado_registro, bloqueado_por_impago, fecha_alta
CuentaCobro:   id, usuario_id, banco, pais, numero_cuenta, titular, declarada_antes_subasta
MedioPago:     id, usuario_id, tipo, titular, detalle, pais, monto_garantia, moneda,
               estado, verificado, fecha_creacion
Articulo:      id, numero_pieza (unique), descripcion, precio_base, moneda, dueno_actual_id,
               artista, fecha_obra, historia, cantidad_elementos, estado, deposito_id
ImagenArticulo: id, articulo_id, url, orden
Deposito:      id, nombre, direccion, ciudad
Seguro:        id, nro_poliza (unique), compania, beneficiario_id, monto_cubierto, moneda, vigente
Subasta:       id, nombre, fecha_hora, ubicacion, categoria_minima, moneda, estado,
               rematador_id, es_coleccion, nombre_coleccion
CatalogoItem:  id, subasta_id, articulo_id, precio_base, orden, vendido
Puja:          id, subasta_id, catalogo_item_id, usuario_id, monto, fecha_hora, estado,
               retira_personalmente
Venta:         id, catalogo_item_id (unique), comprador_id, medio_pago_id, monto_final,
               comision, costo_envio, retira_personalmente, moneda, fecha, pagada
Multa:         id, usuario_id, venta_id, monto, moneda, motivo, pagada, fecha,
               fecha_vencimiento, derivada_justicia
Rematador:     id, nombre, apellido, matricula (unique)
SolicitudSubasta: id, usuario_id, descripcion, datos_historicos, declara_propiedad,
               origen_licito_acreditado, revisar_origen, acepta_devolucion_con_cargo,
               cantidad_elementos, estado, motivo_rechazo, precio_base_propuesto,
               comision_propuesta, fecha_subasta_propuesta, respuesta_usuario, fecha
ImagenSolicitud: id, solicitud_id, url, orden
Notificacion:  id, usuario_id, tipo, titulo, cuerpo, leida, fecha
```

---

## 5. Endpoints del backend

### Salud
- `GET /health`

### Usuarios (`/usuarios`)
- `POST /registro/etapa-1` → UsuarioOut
- `POST /{id}/aprobacion` → UsuarioOut (empresa asigna categoría)
- `POST /{id}/registro/etapa-2` → UsuarioOut (completa registro + clave)
- `POST /login` → UsuarioOut
- `GET /` · `GET /{id}`
- `POST /{id}/recategorizar` · `PATCH /{id}/cambiar-password` · `PATCH /{id}/cambiar-email`
- `POST /{id}/cuentas-cobro` · `GET /{id}/cuentas-cobro`

### Medios de Pago (`/usuarios/{id}/medios-pago`)
- `POST /` · `GET /` · `POST /{mp_id}/verificar` · `DELETE /{mp_id}`

### Artículos (`/articulos`)
- `POST /` → ArticuloOut (crea + genera seguro automático)
- `GET /` · `GET /{id}` · `PUT /{id}/deposito/{deposito_id}`

### Subastas (`/subastas`)
- `POST /` · `GET /` (query: estado) · `GET /publicas`
- `GET /{id}` · `POST /{id}/estado`
- `POST /{id}/catalogo` · `GET /{id}/catalogo`

### Pujas (`/pujas`)
- `POST /` → PujaOut
- `GET /item/{catalogo_item_id}` · `GET /item/{catalogo_item_id}/mejor` → MejorOferta
- `GET /usuario/{usuario_id}`

### Ventas (`/ventas`)
- `POST /cerrar/{catalogo_item_id}` · `POST /cerrar-sin-pujas/{catalogo_item_id}`
- `POST /{id}/impago` · `POST /{id}/pagar` → VentaOut (+ recategoriza)
- `GET /` · `GET /{id}`
- `GET /usuario/{usuario_id}` → list[VentaOut] *(ventas donde el usuario es comprador)*

### Multas (`/multas`)
- `POST /` · `GET /usuario/{usuario_id}` · `POST /{id}/pagar` · `POST /{id}/derivar-justicia`

### Solicitudes (`/solicitudes`)
- `POST /{usuario_id}` · `GET /{id}` · `GET /` (query: estado)
- `POST /{id}/resolver` → empresa acepta/rechaza + propone precio/comisión (**usado internamente por el panel admin**)
- `POST /{id}/responder` → usuario acepta (crea Articulo + Seguro + Subasta) o rechaza
  - Campo `iniciar_inmediatamente: bool` → si true, crea subasta ABIERTA con 2 min de ventana

### Panel de Administración (`/admin`)
- `GET /admin/login` · `POST /admin/login` → autenticación con cookie (usuario: `admin`, clave: `bidify2026`)
- `GET /admin/logout`
- `GET /admin` → sección **Productos** (solicitudes de subasta, filtrable por estado)
- `GET /admin/solicitudes/{id}` → detalle con fotos, flags y formulario de resolución
- `POST /admin/solicitudes/{id}/iniciar-inspeccion` → INGRESADA → EN_INSPECCION (manual)
- `POST /admin/solicitudes/{id}/resolver` → acepta (precio, comisión, fecha) o rechaza (motivo)
- `GET /admin/cuentas` → sección **Cuentas** (usuarios, filtrable: pendiente/aprobadas/completas/bloqueadas)
- `POST /admin/usuarios/{id}/aprobar` → PENDIENTE_VERIFICACION → APROBADO_FASE_1 + notif
- `POST /admin/usuarios/{id}/rechazar` → PENDIENTE_VERIFICACION → BLOQUEADO + notif

### Notificaciones
- `GET /usuarios/{id}/notificaciones` · `POST /notificaciones/{id}/leer`

### Métricas (`/metricas`)
- `GET /usuario/{id}` · `GET /usuario/{id}/por-categoria` · `GET /subasta/{id}`

### Uploads
- `POST /uploads` → {url} (jpg, png, webp, gif, heic; max 8MB)

### WebSocket
- `WS /ws/subastas/{subasta_id}` → broadcast de pujas (1 usuario = 1 subasta)

---

## 6. Scheduler (`app/services/cierre.py`) — corre cada 15s

| Función | Condición | Acción |
|---|---|---|
| `procesar_usuarios_pendientes()` | **no-op** — aprobación **manual** desde `/admin/cuentas` | retorna 0 |
| `procesar_subastas_programadas()` | estado=PROGRAMADA, fecha_hora≤ahora | → ABIERTA, fecha_hora += **2min** |
| `procesar_subastas_vencidas()` | estado=ABIERTA, fecha_hora≤ahora | → CERRADA, genera Ventas |
| `procesar_medios_pago_pendientes()` | estado=PENDIENTE, +15s | → VERIFICADO |
| `procesar_solicitudes_pendientes()` | **no-op** — transición INGRESADA → EN_INSPECCION es **manual** desde el panel admin |
| `procesar_ventas_impagas()` | pagada=False, +1min | genera Multa 10% + bloquea usuario |
| `procesar_multas_vencidas()` | pagada=False, fecha_vencimiento≤ahora | deriva a justicia, BLOQUEADO |

### Tiempos de espera (demo rápida)

| Proceso | Tiempo | Notas |
|---|---|---|
| Registro (etapa 1) → aprobación | **Manual** — admin hace clic en `/admin/cuentas` | era 15s automático, ahora manual |
| Verificación medio de pago | **15 segundos** | automático vía scheduler |
| Solicitud: INGRESADA → EN_INSPECCION | **Manual** — admin hace clic "Iniciar inspección" en `/admin` | — |
| Solicitud: EN_INSPECCION → ACEPTADA | **Manual** — admin completa precio/comisión/fecha y acepta | — |
| Venta impaga → Multa | **1 minuto** | `_TIMER_IMPAGO` |
| Multa vencida → Justicia | **72 horas** | fijo en `procesar_multas_vencidas` |
| Duración de una subasta abierta | **2 minutos** | `_DURACION_SUBASTA` |

---

## 7. Servicios del backend

### `app/services/categorias.py`
- Score = tipos medios verificados + ventas pagadas. Umbrales: ≥2→especial, ≥4→plata, ≥6→oro, ≥8→platino. Solo sube, nunca baja.

### `app/services/pujas.py`
- `mejor_puja(db, catalogo_item_id)` → Puja | None
- `rango_valido(precio_base, ultimo_monto, cat_subasta)` → (minimo, maximo)
- Validaciones: rango, subasta ABIERTA, usuario categorizado, medio verificado, sin multas impagas, threading lock

### `app/services/realtime.py`
- `ConnectionManager`: gestiona WebSocket por subasta, 1 conexión por usuario

---

## 8. Pantallas del frontend

```
frontend/src/app/
├── index.tsx                    # Splash / check de sesión
├── onboarding.tsx               # Tour inicial
├── history.tsx                  # Historial de pujas + compras pendientes/pagadas (botón "Pagar compra")
├── bid-confirmation.tsx         # Confirmación antes de pujar
├── result.tsx                   # Resultado de subasta
├── payments.tsx                 # Medios de pago y cuentas de cobro
├── multas.tsx                   # Mis multas (pagar, historial)
├── seguros.tsx                  # Mis pólizas de seguro
├── product-status.tsx           # Estado de bienes (solicitudes con checkbox iniciar ya)
├── upload-product.tsx           # Solicitar incluir un bien (multi-foto, selector ARS/USD, checkbox multi-elemento)
├── settings.tsx                 # Ajustes (contraseña, email, notificaciones, legal)
├── (auth)/
│   ├── login.tsx                # KeyboardAvoidingView corregido (behavior 'height' en Android)
│   ├── register-account.tsx     # Etapa 1: datos personales + DNI (KeyboardAvoidingView corregido)
│   └── register-finish.tsx      # Etapa 2: clave, polling auto cada 5s para APROBADO_FASE_1
├── (tabs)/
│   ├── home.tsx                 # Listado de subastas con filtros (refetch cada 30s)
│   ├── profile.tsx
│   ├── metrics.tsx
│   └── notifications.tsx        # Notificaciones tipo "venta" tienen botón "Ir a Historial para pagar"
├── auction/[id].tsx             # Detalle de lote (muestra moneda junto al precio)
└── live/[id].tsx                # Sala en vivo: countdown, pujas, precios con moneda, invalidación de caché al cerrar
```

---

## 9. Capa API del frontend

### Hooks clave (React Query)
| Hook | Archivo | Intervalo |
|---|---|---|
| `useAuctions` | hooks/useAuctions.ts | refetch 30s |
| `useAuctionDetail` | hooks/useAuctions.ts | refetch 5s |
| `useMejorOferta` | hooks/useAuctions.ts | refetch 5s |
| `usePujasItem` | hooks/useAuctions.ts | refetch 5s |
| `useMultasUsuario` | hooks/useMultas.ts | refetch 10s |
| `useUnpaidMultaCount` | hooks/useMultas.ts | — |
| `usePagarMulta` | hooks/useMultas.ts | mutation |
| `useVentasUsuario` | hooks/useMultas.ts | refetch 15s |
| `usePagarVenta` | hooks/useMultas.ts | mutation |
| `useMediosPago` | hooks/useMediosPago.ts | — |
| `useLiveSubasta` | hooks/useLiveSubasta.ts | WebSocket |

### Cliente y tipos
- `apiFetch<T>()` en `client.ts` — fetch tipado con `ApiError`
- `Money = string | number` → usar siempre `num()` antes de operar aritméticamente
- `queryKeys` centralizado en `query-client.ts` (incluye `ventasUsuario`)

### Adapters (`api/adapters.ts`)
- `toAuctionDetailVM()` incluye `closingTime` con sufijo `'Z'` forzado para UTC correcto
- `toLotCard()` incluye `moneda: subasta.moneda` y `bidLabel` — muestra "Precio base" si no hay mejor oferta (LAZY-MEJOR), "Puja actual" si sí la hay
- `bidderLabel()` — muestra "Vos" para el usuario propio en historial de la sala en vivo
- `cleanTitle()` — limpia `articulo.descripcion`: quita el prefijo `"Título — "` y el sufijo `"(precio sugerido: ...)"` que agrega el formulario de carga

---

## 10. Moneda (ARS / USD)

La app es **multi-moneda**. Cada subasta tiene su propio campo `moneda` (ARS o USD) que determina todo el flujo.

- **Dónde se muestra:** card de subasta, detalle, sala en vivo (precios, rango, historial de pujas, input), historial, multas, seguros
- **Formato:** `$12,000 USD` / `$850,000 ARS` — el símbolo `$` más el código de moneda como sufijo
- **Al confirmar puja:** los medios de pago se filtran por moneda de la subasta (USD → solo medios USD)
- **Al cargar un producto:** selector ARS/USD para el precio sugerido (se embebe en el texto de la descripción)

---

## 11. Flujo completo de uso (para pruebas)

1. **Registro:** etapa 1 (datos + DNI) → admin entra a `https://bidify-da1.fly.dev/admin/cuentas` → aprueba la cuenta → usuario recibe notificación → etapa 2 (clave)
2. **Medios de pago:** agregar uno → esperar ~15s (scheduler auto-verifica)
3. **Ver subastas:** home muestra lotes en vivo, próximos, cerrados con filtros
4. **Sala en vivo:** countdown hasta `fecha_hora`, botón Pujar con rango válido
5. **Confirmar puja:** pantalla de confirmación → vuelve a sala en vivo
6. **Cierre automático:** scheduler cierra subasta a los 2 minutos de abierta
7. **Pagar compra:** Notificaciones → botón "Ir a Historial para pagar" → sección "Compras pendientes de pago" → botón "Pagar compra"
8. **Si no paga en 1min:** scheduler genera multa → ir a Multas (o Notificaciones) → pagar multa
9. **Subir bien:** upload-product → solicitud (INGRESADA) → **admin entra a `https://bidify-da1.fly.dev/admin`**, pestaña **Productos** → tab "Recién ingresadas" → Ver → "Iniciar inspección" → tab "Pendientes de revisión" → Ver → completar precio/comisión/fecha (en hora local GMT-3) → Aceptar → solicitud pasa a ACEPTADA → usuario acepta en product-status (con checkbox "iniciar ya")
10. **Métricas:** tab Métricas muestra estadísticas de participación

---

## 12. Reglas de negocio críticas

| Regla | Detalle |
|---|---|
| **Sin JWT** | `usuario_id` integer ES la identidad. Login devuelve `UsuarioOut`. |
| **Montos como string** | Backend serializa `Decimal` como strings. En TS usar `num()` siempre. |
| **Categorías** | Score = tipos medios verificados + ventas pagadas. Solo sube. |
| **Pujas válidas** | Rango: última oferta +1% a +20% sobre precio base. Sin límite superior en oro/platino. |
| **1 subasta por usuario** | No puede conectarse a más de una subasta simultáneamente (WebSocket). |
| **Multas** | 10% del monto, 72hs para pagar, deriva a justicia si no. Bloquea para pujar. |
| **Sin pujas** | La empresa (empresa@bidify.local, id=5) compra al precio base al cierre. |
| **Registro flow** | PENDIENTE_VERIFICACION → **APROBADO_FASE_1** (manual, admin en `/admin/cuentas`) → COMPLETO (usuario completa etapa 2) |
| **Solicitud flow** | INGRESADA → EN_INSPECCION (**manual**, admin hace clic "Iniciar inspección") → ACEPTADA o RECHAZADA (manual, admin via `/admin`) |
| **Seguro automático** | Al aceptar solicitud, se genera seguro con `nro_poliza=POL-SOL-{id}` |
| **iniciar_inmediatamente** | Si el usuario lo marca al aceptar propuesta, la subasta se crea ABIERTA con 2min de ventana |
| **cantidad_elementos** | El vendedor indica en el formulario si el bien tiene múltiples elementos (checkbox + número). Se propaga al Articulo al confirmar la solicitud. |
| **Moneda no bimonetaria** | Una subasta es ARS o USD, nunca mezcla. Los medios de pago se filtran según la moneda de la subasta. |

---

## 13. Panel de Administración Web

- **URL producción:** `https://bidify-da1.fly.dev/admin`
- **Credenciales:** usuario `admin`, contraseña `bidify2026` (hardcodeadas en `app/routers/admin.py`)
- **Auth:** cookie HTTP-only `bidify_admin_token` (hash SHA-256 de las credenciales). Sin cookie válida redirige al login.
- **Templates:** `templates/admin/login.html`, `lista.html`, `detalle.html`, `cuentas.html` — Jinja2, sin dependencias externas

### Sección Productos (`/admin`)
- Solicitudes de subasta filtradas por estado: Recién ingresadas / Pendientes de revisión / Aceptadas / Rechazadas / Confirmadas / Rechazadas por usuario
- **Flujo:** tab "Recién ingresadas" → Ver → "Iniciar inspección" → aparece en "Pendientes de revisión" → Ver → completar precio/comisión/fecha → Aceptar o Rechazar
- El precio base se pre-llena extrayendo `(precio sugerido: X)` de la descripción; la comisión se auto-calcula al 10%

### Sección Cuentas (`/admin/cuentas`)
- Lista de usuarios filtrada por estado: Pendientes de aprobación / Aprobadas (fase 1) / Completas / Bloqueadas
- Muestra: nombre, email, país/domicilio, fecha de alta, links al DNI (frente/dorso), estado
- **Botones (solo en "Pendientes"):** ✓ Aprobar → APROBADO_FASE_1 + notif | ✗ Rechazar → BLOQUEADO + notif
- Excluye al usuario empresa (id=5) de la lista

### Comportamiento general
- **Botón Actualizar:** recarga la lista sin F5
- **Horarios:** filtro Jinja2 `to_ba` convierte todos los datetimes UTC → GMT-3 para mostrar
- **Formulario de resolución:** ingresa hora local (GMT-3), backend le suma 3h para guardar en UTC
- **Estado rechazada\_por\_usuario:** muestra la propuesta aceptada por la empresa + nota de rechazo del usuario

---

## 14. Datos demo (producción)

Subastas cargadas en Fly.io:

| ID | Nombre | Categoría | Estado | Producto |
|---|---|---|---|---|
| 1 | Subasta de Arte y Colección — Rango Oro | ORO | PROGRAMADA (2026-07-08) | Reloj Omega Seamaster |
| 2 | Subasta de Relojes y Fotografía | COMUN | PROGRAMADA (2026-07-09) | Cámara Leica M3 |
| 3 | Subasta de Instrumentos Musicales | COMUN | PROGRAMADA (2026-07-10) | Violín Stradivarius |
| 4 | Gran Subasta de Antigüedades — Rango Platino | PLATINO | CERRADA (2026-07-01) | Porcelana Ming |
| 5 | Subasta de Porcelana y Fonógrafos | COMUN | CERRADA (2026-07-02) | Monedas romanas + Gramófono |

Imágenes: URLs de Unsplash verificadas que coinciden con cada producto (3 fotos por artículo).

---

## 15. Gotchas y bugs conocidos (LEER ANTES DE TOCAR)

### SQLite + datetimes con 'T' vs espacio
- **El bug:** SQLAlchemy 2.x guarda datetimes con espacio (`2026-07-01 18:34:51`), pero datos históricos en la DB pueden tener `T` (`2026-07-01T18:34:51`). SQLite compara como texto y `'T'` (ASCII 84) > `' '` (ASCII 32), por lo que fechas con `T` parecen estar en el futuro.
- **Fix aplicado:** se normalizó la DB con `UPDATE subastas SET fecha_hora = REPLACE(fecha_hora, 'T', ' ')` en todas las tablas.
- **Si vuelve a pasar:** correr ese SQL en todas las tablas con columnas datetime.

### SQLAlchemy Enum type — NAME vs VALUE
- El modelo usa `mapped_column(Enum(EstadoSubasta))` — SQLAlchemy guarda el **nombre** (`'ABIERTA'`) no el valor (`'abierta'`).
- En `cierre.py` se usan comparaciones con `.name` explícito para evitar ambigüedad.
- En `solicitudes.py` al crear Subasta se pasa el enum member directamente (`estado=EstadoSubasta.ABIERTA`), lo que SQLAlchemy maneja correctamente.

### Timezones — GMT-3 (Buenos Aires)
- **Problema raíz:** el backend almacena datetimes UTC sin indicador de zona (`"2026-07-05 15:45:00"`). `new Date()` sin normalizar los interpreta como hora local en algunos engines, dando +3h de error.
- **Fix frontend:** `parseUtcDate(iso)` en `utils/format.ts` — reemplaza el espacio por `T` y agrega `Z` antes de pasar a `Date`. Aplicado en `adapters.ts`, `notifications.tsx`, `multas.tsx`, `history.tsx`, `product-status.tsx`.
- **Fix admin panel (backend):** filtro Jinja2 `to_ba` en `admin.py` — convierte datetime naive UTC a GMT-3 antes de formatear con `strftime`. El formulario de resolución ingresa hora local y el backend agrega +3h al guardar `fecha_subasta_propuesta`.

### Countdown en sala en vivo
- `closingTime` se normaliza a UTC añadiendo `'Z'` al string en `adapters.ts` (la DB no guarda timezone).
- `localClosed` fuerza el cierre visual después de 20s si el backend no responde.
- Al cerrar (backend o local), se invalida `queryKeys.lots()` para refrescar el home.

### Imágenes múltiples en upload-product
- La subida es **secuencial** (no paralela) porque conexiones paralelas daban error de timeout.

### KeyboardAvoidingView en pantallas de auth
- `login.tsx`, `register-account.tsx` y `register-finish.tsx` usan `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`.
- En Android, `undefined` no hace nada — siempre usar `'height'`.

### package-lock.json debe estar sincronizado
- EAS Build usa `npm ci` internamente. Si el lock file está desactualizado (falta algún paquete transitivo), el build falla con "Unknown error in Install dependencies".
- **Fix:** borrar `node_modules/` y `package-lock.json`, correr `npm install` para regenerar, commitear el lock file nuevo.

---

## 16. Deploy — Fly.io

```bash
# Instalar flyctl (solo primera vez)
iwr https://fly.io/install.ps1 -useb | iex
$env:PATH += ";$env:USERPROFILE\.fly\bin"

# Login
flyctl auth login

# Crear app y volumen (solo primera vez)
flyctl apps create bidify-da1
flyctl volumes create bidify_data --region gru --size 1 --app bidify-da1

# Deploy (cada vez que hay cambios)
flyctl deploy --remote-only

# Ver logs en vivo
flyctl logs --app bidify-da1

# Abrir shell en el contenedor
flyctl ssh console --app bidify-da1
```

**Advertencia:** `DATABASE_URL` está en `[env]` del `fly.toml` (no en secrets). Para producción real conviene moverlo a `flyctl secrets set DATABASE_URL=...`, pero para la entrega académica está bien así.

---

## 17. EAS Build — APK Android

```bash
cd frontend

# Login (solo primera vez)
eas whoami  # verificar sesión

# Build APK (perfil preview)
eas build --platform android --profile preview --non-interactive

# El APK se descarga desde la URL que imprime al terminar
```

**Proyecto EAS:** `@kevin100301/bidify` (ID: `66893e2c-eae9-43b6-956a-80f7d02bd58c`)
**La URL del backend está inlineada en `eas.json`** bajo `build.preview.android.env.EXPO_PUBLIC_API_URL`.

---

## 18. Design system

- **Fondo principal:** `#141923` · **Acento dorado:** `#E9C349`
- Iconos: Ionicons · Fuente: sistema · Paleta oscura con dorado para primarios

---

## 19. Comandos útiles

```bash
# Backend (local)
pip install -r requirements.txt
alembic upgrade head
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (local)
cd frontend && npm install && npx expo start

# Swagger UI (local)
http://localhost:8000/docs

# Admin panel (producción)
https://bidify-da1.fly.dev/admin

# Ver/modificar DB en producción
flyctl ssh console --app bidify-da1
# dentro del contenedor:
sqlite3 /data/subastas.db
```
