# Bidify — Progreso de implementación

App de subastas (Expo + React Native + expo-router + TypeScript) construida a partir del
diseño de Figma:
https://www.figma.com/design/mW0Afm7sz2k0g1waUoLToJ/Desarollo-De-Apps-1?node-id=84-856

Estado general: **app completa y conectada al backend real** (FastAPI del repo).
`tsc --noEmit` pasa sin errores, el bundle web de Metro compila las 17 rutas, y un smoke
test de integración pasa 20/20 contra el backend.

---

## 🔌 Integración con el backend (FastAPI)

La app ya **no usa datos mock**: consume la API `Sistema de Subastas` (carpeta `app/` del repo).

### Arquitectura de la capa de datos (`src/api/`, `src/context/`)
- `api/types.ts` — espejo TS de los ~48 schemas + enums. Montos Decimal llegan como **string**;
  se convierten con `num()`.
- `api/client.ts` — `apiFetch<T>` (fetch tipado), `ApiError` que preserva el `detail` del backend,
  resolución de base URL multiplataforma (web/iOS `localhost`, Android emu `10.0.2.2`, device por LAN IP).
- `api/endpoints/*` — funciones puras por dominio (usuarios, subastas, pujas, ventas, solicitudes, métricas).
- `api/adapters.ts` — mapeo backend→UI: aplana `Subasta→catálogo→artículo` en cards lot-céntricas,
  une imágenes del artículo + mejor oferta, deriva estado/locked, preview de comisión.
- `api/hooks/*` — hooks React Query (queries con polling de 5s en la sala en vivo + mutations que invalidan).
- `context/session.tsx` — identidad cliente (`usuario_id` como token, persistido en AsyncStorage).
- `context/registration.tsx` — flujo de registro de 2 pantallas sobre la máquina de 3 estados del backend.
- `api/providers.tsx` — `QueryClientProvider` + `SessionProvider` + `RegistrationProvider` en el root.

### Autenticación (importante)
El backend **no tiene auth real** (sin token, sin verificación de password). Por eso:
- **Login** = `GET /usuarios` + match por email; la password es cosmética (no se verifica).
- **Registro** = `etapa-1` → (`aprobacion`, shim de dev `EXPO_PUBLIC_AUTO_APPROVE`) → `etapa-2`.
- La sesión guarda `usuario_id` + el `UsuarioOut`.

### Mapeo pantalla → endpoints (resumen)
- Home → `GET /subastas` + `GET /articulos` (cards = lotes del catálogo).
- Detalle/Sala en vivo → `+ GET /pujas/item/{id}/mejor` (rango válido) y `GET /pujas/item/{id}` (historial).
- Confirmar puja → `POST /pujas` (errores de reglas se muestran con el `detail` en español tal cual).
- Perfil/Métricas → `GET /usuarios/{id}` + `GET /metricas/usuario/{id}`.
- Pagos → `GET/POST/DELETE /usuarios/{id}/medios-pago`.
- Cargar producto / Mis productos → `POST/GET /solicitudes`.
- Notificaciones → sintetizadas de `GET /multas/usuario/{id}` (no hay dominio de notificaciones).

### Stubs honestos (sin backend)
Notificaciones (derivadas de multas), balance/“agregar fondos” (no existe wallet), follow/“siguiendo”,
deltas y gráfico mensual de métricas, avatar (se usan iniciales), contador de espectadores y countdown
en vivo, carga de imágenes (el backend solo acepta URLs → se usan placeholders).

### Cómo correr (frontend + backend)
```bash
# Backend (en la raíz del repo)
.venv/bin/python -m uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
# opcional: cp .env.example .env  (y ajustar EXPO_PUBLIC_API_URL)
npx expo start
```
Verificaciones: `npx tsc --noEmit` (limpio) · `python scripts_smoke/smoke.py http://127.0.0.1:8000` (20/20).

> Nota: en esta máquina el puerto 8000 está ocupado por otro proyecto (“Psico Backend API v2”);
> el backend de subastas se levantó en `:8001` para las pruebas. Ajustá `EXPO_PUBLIC_API_URL` según corresponda.

---

## ✅ Lo que se hizo

### Fundaciones (design system)
- **`src/constants/theme.ts`** — paleta oscura de Bidify:
  - Fondo `#141923`, acento dorado `#E9C349`, superficies de tarjeta, bordes y colores de
    estado (live/upcoming/success/danger).
  - Escalas de `Spacing`, `Radius` y tipografía.
  - La app es dark-only: `Colors.light` y `Colors.dark` son idénticos para mantener
    compatibilidad con los componentes temáticos.
- **`src/components/themed-text.tsx`** — escala tipográfica nueva (title, subtitle, heading,
  small, caption, price, label, link, etc.).

### Componentes compartidos (`src/components/ui/`)
- `Button` — variantes `primary` (dorado) / `secondary` / `ghost` / `danger`, tamaños sm/md/lg,
  estados loading y disabled.
- `Badge` — tonos `live`, `upcoming`, `gold`, `neutral`, `success`, `danger` (chips de estado).
- `Card` — superficie base con borde, opción `elevated` y `onPress`.
- `Chip` — filtros de categoría (activo/inactivo).
- `Input` — campo de texto con label, ícono leading/trailing.
- `Icon` — wrapper sobre Ionicons (`@expo/vector-icons`, instalado en esta sesión).
- `Screen` — contenedor full-screen con safe-area y fondo oscuro.
- `BidifyMark` — logo del martillo dorado con badge circular y glow radial.

### Otros componentes
- `AuctionCard` — tarjeta de producto (imagen, badges, puja actual, botón PUJAR).
- `ScreenHeader` — header con botón de volver + título + acción derecha.
- `BottomTabBar` — tab bar custom oscuro con activo en dorado.

### Navegación / routing (expo-router)
Reestructurado desde el template demo de Expo:
- Root `Stack`: **Splash → Onboarding → (auth) → (tabs)** + rutas de detalle/live/modal.
- Se eliminaron las pantallas y componentes demo de Expo (explore, hints, web-badge,
  animated-icon, app-tabs, collapsible, themed-view, external-link).
- Splash nativo (`app.json`) actualizado a fondo `#141923` + logo del martillo.
- Se agregó `expo-env.d.ts` (referencia a `expo/types`).

### Pantallas implementadas (17/17)

| # | Pantalla | Archivo | Nodo Figma | Nivel |
|---|----------|---------|------------|-------|
| 1 | Splash | `app/index.tsx` | 84:856 | **Según diseño real** |
| 2 | Onboarding | `app/onboarding.tsx` | 90:5 | Funcional / on-brand |
| 3 | Login | `app/(auth)/login.tsx` | 84:865 | Funcional / on-brand |
| 4 | Registro (cuenta) | `app/(auth)/register-account.tsx` | 84:410 | Funcional / on-brand |
| 5 | Registro (finalizar) | `app/(auth)/register-finish.tsx` | 84:1448 | Funcional / on-brand |
| 6 | Home (Subastas Activas) | `app/(tabs)/home.tsx` | 84:525 | **Según screenshot real** |
| 7 | Detalle de producto | `app/auction/[id].tsx` | 84:718 | Funcional / on-brand |
| 8 | Sala en Vivo | `app/live/[id].tsx` | 84:916 | Funcional / on-brand |
| 9 | Confirmación de Puja | `app/bid-confirmation.tsx` | 84:1053 | Funcional / on-brand |
| 10 | Resultado (Ganador) | `app/result.tsx` | 84:326 | Funcional / on-brand |
| 11 | Perfil | `app/(tabs)/profile.tsx` | 84:1798 | Funcional / on-brand |
| 12 | Gestión de Pagos | `app/payments.tsx` | 84:1638 | Funcional / on-brand |
| 13 | Historial | `app/history.tsx` | 84:2030 | Funcional / on-brand |
| 14 | Métricas | `app/(tabs)/metrics.tsx` | 84:1202 | Funcional / on-brand |
| 15 | Carga de Producto | `app/upload-product.tsx` | 84:2 | Funcional / on-brand |
| 16 | Estado del Producto | `app/product-status.tsx` | 84:101 | Funcional / on-brand |
| 17 | Notificaciones | `app/(tabs)/notifications.tsx` | 84:208 | Funcional / on-brand |

- **"Según diseño real"** = construido con datos extraídos de Figma (colores/layout exactos).
- **"Funcional / on-brand"** = pantalla completa y navegable, construida con el mismo design
  system, pero **todavía no verificada pixel a pixel** contra su frame específico de Figma.

### Datos demo
- `src/data/auctions.ts` — datos mock de subastas (Patek Philippe, Porsche 911, Diamante Azul,
  Rolex Daytona) con imágenes de Unsplash como placeholder. Reemplazar por API real cuando exista
  backend.

### Dependencias agregadas
- `@expo/vector-icons` (íconos cross-platform).
- `eslint` + `eslint-config-expo` (configurados por `expo lint`).

---

## ⛔ Lo que falta (bloqueado por el rate limit de Figma)

La cuenta de Figma está en **plan Starter**, que limita la cantidad de llamadas del MCP
(`get_design_context`, `get_screenshot`, `get_variable_defs`). Se alcanzó el límite, así que
**no se pudo extraer el diseño exacto de 15 de las 17 pantallas**.

### Refinamiento pendiente (pixel-match contra Figma)
Cuando se reinicie el límite (o se actualice el plan), hay que extraer el diseño de cada nodo y
ajustar layout/espaciados/colores/copys exactos:

| Pantalla | Nodo a extraer |
|----------|----------------|
| Onboarding | `90:5` |
| Login | `84:865` |
| Registro (cuenta) | `84:410` |
| Registro (finalizar) | `84:1448` |
| Detalle de producto | `84:718` |
| Sala en Vivo | `84:916` |
| Confirmación de Puja | `84:1053` |
| Resultado (Ganador) | `84:326` |
| Perfil | `84:1798` |
| Gestión de Pagos | `84:1638` |
| Historial | `84:2030` |
| Métricas | `84:1202` |
| Carga de Producto | `84:2` |
| Estado del Producto | `84:101` |
| Notificaciones | `84:208` |

`fileKey` de Figma: `mW0Afm7sz2k0g1waUoLToJ`

### Cómo destrabar
1. **Esperar** a que se reinicie el límite del plan Starter y extraer las pantallas en tandas.
2. **Actualizar el plan de Figma** para tener más llamadas del MCP.
3. Seguir refinando "a ojo" desde los screenshots, sin garantía de exactitud pixel a pixel.

### Otros pendientes / mejoras futuras
- Extraer tokens/variables reales de Figma (`get_variable_defs` devolvió vacío; los colores se
  derivaron visualmente).
- Reemplazar imágenes placeholder de Unsplash por assets reales.
- Conectar a un backend real (auth, subastas en vivo via websockets, pagos).
- Lint: `src/hooks/use-color-scheme.web.ts` tiene 1 error de lint **preexistente del template de
  Expo** (patrón de hidratación web intencional, no es código propio). Se puede silenciar.
- Los logos `bidify-logo.png` tienen fondo oscuro (no transparente); funciona sobre fondos
  oscuros, pero conviene un PNG/SVG transparente del martillo para mayor flexibilidad.
- Animaciones: se usan animaciones `entering` de `react-native-reanimated` (splash, modal,
  resultado). Dependen del plugin de worklets que `babel-preset-expo` (SDK 56) incluye
  automáticamente.

---

## ▶️ Cómo correr la app

```bash
cd frontend
npx expo start
```

Verificaciones disponibles:
```bash
npx tsc --noEmit   # type-check (pasa sin errores)
npx expo lint      # lint (1 error preexistente en use-color-scheme.web.ts)
```

---

## 🗂️ Flujo de navegación

```
Splash (index)
  └─> Onboarding
        └─> (auth)/login
              ├─> register-account ─> register-finish ─┐
              └──────────────────────────────────────> (tabs)
                                                          ├─ home  ─> auction/[id] ─> live/[id] ─> bid-confirmation ─> result ─> payments
                                                          ├─ metrics
                                                          ├─ notifications
                                                          └─ profile ─> payments / history / upload-product / product-status
```
