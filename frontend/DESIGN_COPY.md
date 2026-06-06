# Copys y estructura del diseño (extraídos de `Desarollo De Apps 1.fig`)

Recuperado del `.fig` local (canvas.fig → zstd → kiwi → strings) porque el Figma MCP
quedó rate-limited. Es el **contenido/estructura** del diseño; NO incluye geometría ni
colores exactos (eso requiere el MCP). La marca del mock es "Aureum / Luxe Auction";
nosotros mantenemos **Bidify**. Varios elementos premium NO tienen backend y se dejan
como stub honesto (marcados ⚠️).

## 1. Onboarding / Bienvenida
"Bienvenido al mundo de las subastas", "Subastas de Élite", "Participe en Subastas",
"Premium Auction Access". CTA principal + link "YA TENGO UNA CUENTA".

## 3. Login
"Bienvenido de Nuevo", botón "INICIAR SESIÓN", "¿Olvidaste tu contraseña?", "CREAR CUENTA".

## 4. Registro (Cuenta)
"CREAR CUENTA", "Crear contraseña", "Confirmar contraseña",
consentimiento: "Acepto el envío de mis datos para verificación biométrica y legal mediante
proveedores externos de seguridad financiera." CTA "CONTINUAR REGISTRO". ⚠️ biometría sin backend.

## 5. Registro (Finalizar)
"CONFIRMAR REGISTRO" / "FINALIZAR", términos, "Recibirás una notificación por correo
electrónico con los detalles de tu registro y seguridad."

## 6. Home
"Buscar subastas", "Categoría", filtros EN VIVO / PRÓXIMAS, "RELOJES". Cards: Patek Philippe
Nautilus, Porsche 911 Carrera S, Diamante Azul Eterno (ACCESO EXCLUSIVO PLATINO). "EMPIEZA EN 02:23:34".

## 7. Detalle
"Nautilus 5711/1A", "Oro Rosa 18K", sección "Historia & Procedencia" (descripción larga),
"PUJA ACTUAL", "IR A LA SALA EN VIVO". Specs desde el artículo real.

## 8. Sala en Vivo
"ACTIVIDAD EN VIVO", "OFERTA ACTUAL", "Incremento mínimo: $5,000", historial "Ha pujado $X",
"PUJAR", nota "Al entrar, usted acepta los términos de puja de alta".

## 9. Confirmación de Puja
"CONFIRMAR PUJA", "Tu oferta de puja", "Comisión del Comprador (10%)", "Monto Total", "Puja válida".

## 10. Resultado (Ganador)
"RESULTADO DE SUBASTA", "GANADOR", "Monto de Puja Ganadora", "FINALIZAR Y PAGAR",
"VOLVER A SUBASTAS". (Nosotros usamos "Puja confirmada" porque el backend confirma puja, no victoria.)

## 11. Perfil
"PERFIL", "EDITAR PERFIL", "Mis Métricas", "Mi Historial", stats. ⚠️ editar perfil sin endpoint.

## 12. Gestión de Pagos
"Cartera & Pagos", "Gestione sus métodos de pago premium y fondos para subastas.",
secciones "FONDOS DISPONIBLES / PODER DE PUJA" (⚠️ wallet sin backend), "Depositar Fondos" (⚠️),
"TARJETAS" (medios-pago, real), "CUENTAS BANCARIAS" (cuentas-cobro, real), "Agregar medio de pago",
"GARANTÍA: $120K", "Los fondos de garantía son custodiados en cuentas...".

## 13. Historial
"Mi Historial", "FIN DEL HISTORIAL DE LOS ÚLTIMOS 30 DÍAS", "OFERTADO", por categoría.

## 14. Métricas
"Mis Métricas", "Rendimiento por Categoría" / "ÉXITO POR CATEGORÍA" (⚠️ sin backend per-categoría).

## 15. Carga de Producto
"Suelte la imagen aquí o haga clic para buscar", "Historia & Procedencia". ⚠️ upload de archivos sin backend.

## 16. Estado del Producto
"ACEPTACIÓN DE PRODUCTO" / "PRODUCTO RECHAZADO", "ID DE ENVÍO:", "Envío Premium Seguro",
"Seguro de Tránsito", "RECIBIDO en nuestra bóveda". Timeline desde `solicitud.estado`.

## 17. Notificaciones
7 tipos: Registro, Ganaste, Pago Pendiente, Multa, Estado de Producto, Aceptación, Rechazo.
"5 pendientes". ⚠️ solo "Multa" tiene señal real (GET /multas); el resto no tiene backend.
