# Changelog — Bidify (frontend Expo + integración API)

App de subastas **Bidify** (Expo SDK 56 · React Native 0.85 · expo-router · TypeScript)
construida desde el diseño de Figma y conectada al backend FastAPI del repo
(`Sistema de Subastas API`).

---

## [No publicado] — 2026-06-06

### Resumen
Se transformó el template stock de Expo en la app **Bidify** completa: 17 pantallas, design
system propio, navegación por archivos, y **conexión real al backend FastAPI** (sin datos mock).
Verificado con `tsc` (0 errores), bundle web de Metro (17 rutas) y un smoke test de
integración (20/20) contra el backend.

### Added — Design system y componentes
- `src/constants/theme.ts`: paleta oscura Bidify (bg `#141923`, dorado `#E9C349`, superficies,
  bordes, estados live/upcoming/success/danger), `Spacing`, `Radius`, tipografía.
- Componentes UI (`src/components/ui/`): `Button`, `Badge`, `Card`, `Chip`, `Input`, `Icon`
  (Ionicons), `Screen`, `BidifyMark` (logo martillo + glow), `states` (Loading/Error/Empty).
- `AuctionCard`, `ScreenHeader`, `BottomTabBar` (tab bar custom oscuro/dorado).

### Added — Navegación (expo-router)
- Stack raíz: **Splash → Onboarding → (auth) → (tabs)** + rutas de detalle/live/modal.
- Grupos `(auth)` (login, registro x2) y `(tabs)` (home, métricas, notificaciones, perfil).
- Splash nativo (`app.json`) con fondo `#141923` + logo.

### Added — 17 pantallas
Splash, Onboarding, Login, Registro (Cuenta/Finalizar), Home, Detalle, Sala en Vivo,
Confirmación de Puja, Resultado, Perfil, Pagos, Historial, Métricas, Carga de Producto,
Estado del Producto (con modo lista "Mis productos"), Notificaciones.

### Added — Capa de datos / integración backend (`src/api/`, `src/context/`)
- `types.ts`: espejo TS de los ~48 schemas + enums (montos Decimal llegan como string → `num()`).
- `client.ts`: `apiFetch<T>`, `ApiError` (preserva `detail`), base URL multiplataforma
  (web/iOS `localhost`, Android emu `10.0.2.2`, device por LAN IP vía `expo-constants`).
- `endpoints/*`: funciones puras por dominio (usuarios, subastas, pujas, ventas, solicitudes, métricas).
- `adapters.ts`: aplana `Subasta→catálogo→artículo` en cards lot-céntricas + une imagen/mejor oferta,
  deriva estado/locked, preview de comisión.
- `hooks/*`: React Query (queries con polling 5s en vivo + mutations que invalidan).
- `context/session.tsx`: identidad cliente (`usuario_id` como token, persistido en AsyncStorage).
- `context/registration.tsx`: registro 2 pantallas sobre la máquina de 3 estados del backend
  (etapa-1 → aprobación → etapa-2), con shim `EXPO_PUBLIC_AUTO_APPROVE`.
- `providers.tsx`: `QueryClientProvider` + `SessionProvider` + `RegistrationProvider` en el root.

### Added — Auth (al modelo real del backend, que NO tiene auth)
- Login = `GET /usuarios` + match por email (password cosmética, no se verifica server-side).
- Sesión persistida; guards de `usuarioId` en todas las pantallas.

### Added — Tooling / docs
- Dependencias: `@expo/vector-icons`, `@tanstack/react-query`, `@react-native-async-storage/async-storage`.
- `.env.example` (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AUTO_APPROVE`).
- `scripts_smoke/smoke.py`: smoke test de integración (registro→medio de pago→puja real).
- `frontend/PROGRESO.md`, `frontend/DESIGN_COPY.md` (copys del diseño extraídos del `.fig`).

### Changed — Refinamiento contra el diseño
- Pagos: "Cartera & Pagos" + sección **Cuentas bancarias** real (endpoint `cuentas-cobro`).
- Copys alineados al diseño: Login ("Bienvenido de Nuevo"), Detalle ("Historia & Procedencia"),
  Confirmación ("Tu oferta de puja" / "Comisión del Comprador (10%)"), Sala ("Oferta actual/sugerida"),
  Resultado ("Volver a subastas"), Onboarding ("Subastas de Élite").
- Resultado reformulado a "Puja confirmada" (el backend confirma puja, no victoria).

### Fixed — Review adversarial (5 bugs)
- `auction/[id]`: CTA dejaba entrar a pujar lotes no abiertos → puja 400 garantizada (ahora gated por estado).
- `live/[id]`: sin gate de estado + badge "En vivo" hardcodeado → ahora derivado del estado.
- `profile`: "Estado de productos" abría `/product-status` sin id (pantalla de error) → `product-status`
  ahora tiene modo lista ("Mis productos") con `useMisSolicitudes`.
- `register-account`: password no validada a ≥8 caracteres.
- `result`: "Proceder al pago" engañoso → "Ver mi historial".

### Removed
- Pantallas/َcomponentes demo del template Expo (explore, hint-row, web-badge, animated-icon,
  app-tabs, collapsible, themed-view, external-link) y el mock `src/data/auctions.ts`.

### Verificación
- `npx tsc --noEmit` → 0 errores.
- `npx expo export --platform web` → bundle OK (17 rutas).
- `python scripts_smoke/smoke.py http://127.0.0.1:8001` → **20/20**.
- Lint: limpio salvo 1 error preexistente del template (`src/hooks/use-color-scheme.web.ts`).

---

## Pendiente / Known gaps

### Pixel-perfect contra Figma (bloqueado por rate limit del MCP)
- El **Figma MCP (plan Starter)** quedó rate-limited en duro; no se pudo extraer la geometría/
  colores exactos de cada nodo. Se recuperó el **copy y la estructura** desde el `.fig` local
  (ver `frontend/DESIGN_COPY.md`) y se refinó eso. Para el match exacto al pixel hace falta
  destrabar el MCP (esperar reset largo o subir el plan) y traer `get_design_context` por nodo.

### Elementos del diseño SIN backend (stub honesto, no se simulan)
El mock de Figma ("Aureum / Luxe Auction") incluye features que la API no expone:
- Wallet de fondos / "Poder de Puja" / Depositar fondos (no hay endpoint de saldo).
- 7 tipos de notificación (solo "multa impaga" tiene señal real vía `GET /multas`).
- Verificación biométrica/legal en el registro.
- Métricas de "rendimiento por categoría" y deltas mes-a-mes / serie temporal.
- Editar perfil, avatar, follow/"siguiendo", contador de espectadores y countdown en vivo.
- Upload de archivos de imagen (el backend solo acepta URLs → se usan placeholders).

### Auth / seguridad (limitación del backend)
- El backend no tiene autenticación real: cualquiera puede actuar como cualquier `usuario_id`.
  El login es cosmético (match por email). No apto para producción tal cual.

### Infra de pruebas
- En esta máquina el `:8000` lo ocupa otro proyecto; el backend de subastas se probó en `:8001`.
  Ajustar `EXPO_PUBLIC_API_URL` según el entorno (device/emulador/web).

### Próximos pasos sugeridos
1. Destrabar el Figma MCP y hacer el pase de pixel-geometry por pantalla.
2. Si el backend suma endpoints (notificaciones, wallet, follow), reemplazar los stubs.
3. Tests E2E (Detox/Maestro) sobre los flujos de registro y puja.
