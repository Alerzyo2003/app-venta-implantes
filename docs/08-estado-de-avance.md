# Estado de avance

Última actualización: 2026-10-30.

Estados:

- **Pendiente**: no iniciado.
- **En desarrollo**: iniciado, incompleto.
- **Terminado**: implementado; las pruebas automatizadas aún no cubren todo el flujo o falta probarlo contra un servicio real.
- **Probado**: implementado y verificado con pruebas ejecutadas y registradas en [10-pruebas.md](10-pruebas.md). Se indica el nivel: *BD* (PostgreSQL local con RLS reales), *dominio*, *E2E local* (panel con la base local y el emulador `tools/local-api`).

> Regla: nada se marca **Probado** sin una ejecución real registrada. Ninguna función está probada todavía contra un proyecto Supabase real ni en dispositivos físicos (ver [10-pruebas.md](10-pruebas.md#pendiente-de-probar-requiere-servicios-o-equipos-que-aún-no-existen)).

## Resumen por fase

| Fase / incremento | Estado |
|---|---|
| Fase 1 — Análisis y arquitectura | **Terminado** (documentos 00–10 y ADR) |
| Incremento 0 — Cimientos | **Terminado** (monorepo, dominio, esquema con RLS y RPC, app y panel base, pruebas) |
| Incremento 1 — Cuentas y catálogo | **En desarrollo** (app y backend listos; en el panel faltan referencias, fotos y documentos, compatibilidades e importación CSV) |
| Incremento 2 — Inventario | **En desarrollo** (backend y panel listos y probados localmente; falta verificación con Supabase real) |
| Incremento 3 — Carrito y pedidos | **En desarrollo** (backend probado; falta el checkout en la app, que depende del pago y del despacho) |
| Incremento 4 — Pago real | **Pendiente** (D-03) |
| Incremento 5 — Endurecimiento | **En desarrollo** (MFA del personal y eliminación de cuenta listos; faltan monitoreo, respaldos y builds EAS) |
| Fases F4–F9 | Pendiente |

## Detalle por requisito (MVP)

### Cuentas (CTA)

| ID | Estado | Detalle |
|---|---|---|
| CTA-01 | Terminado | Registro en la app con validación compartida; perfil creado por trigger (probado en BD). Falta probar con Supabase Auth real. |
| CTA-02 | En desarrollo | La compra exige correo confirmado (probado en BD). El envío de correos depende del SMTP (D-08). |
| CTA-03 | Terminado | App y panel; el panel valida el formulario y los enlaces inválidos (E2E local). Envío real pendiente (D-08). |
| CTA-04 | Probado (BD) | Aceptación versionada de términos y privacidad. Textos legales pendientes (D-14). |
| CTA-05 | Probado (BD) | Consentimientos por canal con historial; pantalla de preferencias en la app. |
| CTA-06 | Terminado | Tipos de cuenta en el registro. |
| CTA-07 | En desarrollo | Solicitud y revisión en la base (probadas); envío desde la app sin adjuntos (Storage pendiente); revisión en el panel pendiente. |
| CTA-08 | Terminado | Perfil en la app. |
| CTA-09 | Probado (BD) | Direcciones con comunas oficiales y facturación con RUT validado; pantallas en la app. |
| CTA-10 | Probado (BD) | Historial de pedidos en el servidor; consulta en la app. |
| CTA-11 | En desarrollo | Sesión persistente segura (app: almacenamiento cifrado fragmentado; panel: cookies del servidor) y cierre de sesión. Falta «cerrar en todos los dispositivos». |
| CTA-12 | Probado (BD) | Eliminación con anonimización y bloqueo si hay pedidos en curso; botón en la app. |
| CTA-13 | Probado (BD, E2E local) | La base exige `aal2` al personal; el panel enrola y verifica TOTP. Falta probar con Supabase Auth real. |
| CTA-14 | Probado (BD) | Aislamiento por RLS. |

### Catálogo y búsqueda (CAT, BUS, CMP)

| ID | Estado | Detalle |
|---|---|---|
| CAT-01 | En desarrollo | 12 categorías iniciales cargadas; administración desde el panel pendiente. |
| CAT-02 | En desarrollo | Modelo y permisos probados; administración desde el panel pendiente. |
| CAT-03 | En desarrollo | Panel: datos, variantes, precio e impuestos (E2E local). Fotos y documentos pendientes (Storage). |
| CAT-04 | Probado (dominio, E2E local) | Campos técnicos según el tipo de producto en el panel y en la app. |
| CAT-05 | En desarrollo | Crear, editar, publicar, archivar y descontinuar variantes listos; duplicar pendiente. |
| CAT-06 | Pendiente | Requiere Storage (proyecto Supabase, D-01). |
| CAT-07 | Probado (BD, E2E local) | SKU sin distinguir mayúsculas y GTIN únicos; GTIN con dígito verificador. |
| CAT-08 | Probado (BD) | Auditoría de cambios; vista en el panel pendiente. |
| CAT-09 | Pendiente | Importación y exportación CSV. |
| CAT-10 | Probado (BD) | Productos solo para profesionales verificados. |
| BUS-01 a BUS-05 | Probado (BD, dominio) | Texto, códigos, medidas, filtros, orden, tildes y errores de escritura. |
| BUS-06 | Terminado | Búsquedas recientes y sugerencias en la app. |
| BUS-07 | Terminado | Lector GS1/UDI probado en el dominio; escáner en la app sin prueba en dispositivo. |
| BUS-08 | Pendiente | OCR (D-16). |
| CMP-01 a CMP-03 | Probado (BD) | Vínculos con evidencia obligatoria; los clientes solo ven verificados. Gestión desde el panel pendiente. |

### Compra, pagos e inventario (CAR, PAG, INV, PRC)

| ID | Estado | Detalle |
|---|---|---|
| CAR-01 a CAR-03 | Probado (BD) | Carrito en el servidor y cotización (precios, IVA, despacho) calculada por la base; carrito en la app. |
| CAR-04 | Pendiente | Checkout en la app: depende del pago (D-03) y del despacho (D-05). La app no muestra botones de pago simulados. |
| CAR-05 a CAR-07 | Probado (BD) | Pedido idempotente, reserva con vencimiento, sin sobreventa en concurrencia, cambios de precio informados. |
| PAG-01 | Pendiente | Proveedor de pagos (D-03). |
| PAG-02 | Probado (BD, dominio) | Estados y transiciones de pago. |
| PAG-03, PAG-04 | En desarrollo | Aplicación idempotente de resultados probada en BD; falta el adaptador del proveedor y su webhook. |
| PAG-05 | Terminado | Solo se guardan los últimos 4 dígitos. |
| PAG-08, PAG-09, PAG-10 | Pendiente | Comprobantes, facturación electrónica (D-04) y transferencias (D-03). |
| INV-01 | Probado (BD, E2E local) | Físico, reservado, comprometido y disponible; vista en el panel. |
| INV-02 | Probado (BD, E2E local) | Libro inmutable con motivo y responsable visible en el panel. |
| INV-03 | Probado (BD, E2E local) | Sin stock negativo. |
| INV-04 | Probado (BD) | Lotes y vencimientos; en el panel, ingreso con lote y cambio de estado (sin prueba E2E de lotes todavía). |
| INV-05 | Probado (BD) | Pedidos que contienen un lote. |
| INV-06 | Probado (BD, E2E local) | Varias bodegas, vendibles o no, y puntos de retiro; administración en el panel. |
| PRC-01 | Probado (BD, E2E local) | Lista base; precio neto por variante en el panel con historial auditado. |
| PRC-03 | Probado (BD) | Historial de precios y precios históricos en los pedidos. |

### Roles, seguridad y calidad (ROL, SEG, SYN, QA, PUB)

| ID | Estado | Detalle |
|---|---|---|
| ROL-01 | En desarrollo | 7 roles y 40 permisos; el panel adapta la navegación (E2E local). Gestión de roles en el panel pendiente. |
| ROL-02 | Probado (BD) | Operaciones sensibles validadas en la base. |
| ROL-03 | Probado (BD) | Auditoría de solo inserción; vista en el panel pendiente. |
| SEG-01 | Terminado | RLS, MFA del personal, cookies de sesión HttpOnly con cierre por inactividad, CSP con nonce y cabeceras de seguridad. |
| SEG-02 | En desarrollo | Secretos fuera del código y errores sin detalles técnicos. Webhooks y límites propios pendientes. |
| SEG-03 | Pendiente | Respaldo y restauración (requiere proyecto real). |
| SEG-04 | Pendiente | Textos legales (D-14). |
| SYN-01 | Probado (BD, unitarias) | Pedidos e inventario idempotentes (BD); la app reintenta solo errores de red, con espera exponencial (unitarias). |
| SYN-02 | En desarrollo | La app informa la falta de conexión y conserva en memoria lo ya consultado; falta la caché persistente en el dispositivo. |
| QA-01 | En desarrollo | Unitarias, BD y E2E local registradas en [10-pruebas.md](10-pruebas.md). |
| PUB-01 | Terminado | Variantes, ícono, pantalla de inicio e identificadores configurables; builds EAS pendientes de las cuentas (D-11). |

## Bitácora de sesiones

| Fecha | Sesión | Resultado |
|---|---|---|
| 2026-10-28 | 1 | Inspección del entorno: repositorio vacío; Node 22, pnpm 10 y PostgreSQL 16 disponibles; Docker sin acceso a las imágenes de Supabase. Documentación de la fase 1. |
| 2026-10-28 | 1 | Monorepo, paquete de dominio, esquema Supabase (9 migraciones) con RLS y RPC, base local de pruebas sin Docker, app móvil Expo, panel Next.js y emulador local para pruebas E2E. |
| 2026-10-29 | 2 | D-01 aprobada: proyecto `plataforma-implantes-dev` creado (sa-east-1, gratuito). Migraciones `0100`–`0400` y parte de `0500` aplicadas; el resto quedó detenido porque el conector de Supabase pidió confirmaciones que no se alcanzaron a responder y luego quedó conectado a otra cuenta. |
| 2026-10-30 | 2 | Red del entorno habilitada hacia el proyecto. Huella del esquema (`pnpm db:fingerprint`) para comprobar que el proyecto remoto coincide con las migraciones. Conector reconectado: `0500`–`0800` aplicadas; `0100`–`0800` verificadas con la huella (idénticas al repositorio) y pg_cron funcionando. `0900` a la espera de la confirmación del conector. |
