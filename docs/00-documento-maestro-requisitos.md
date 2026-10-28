# Documento maestro de requisitos

| Campo | Valor |
|---|---|
| Proyecto | Plataforma de venta de implantes dentales e insumos odontológicos (Chile) |
| Nombre comercial | **Pendiente**. Se usa una configuración temporal en `packages/brand` |
| Versión del documento | 0.1 |
| Última actualización | 2026-10-28 |
| Estado del proyecto | Fase 1 (análisis y arquitectura) terminada. Fase 2 (cimientos) en curso |

Este documento es la **fuente única de requisitos**. Cada requisito tiene un identificador estable (`MOD-NN`). El estado de cada requisito (terminado, en desarrollo, pendiente o probado) se registra en [`08-estado-de-avance.md`](08-estado-de-avance.md), con el mismo identificador. Si un requisito cambia, se actualiza aquí y se anota en el historial al final.

Documentos relacionados:

- [01 Arquitectura](01-arquitectura.md)
- [02 Modelo de datos](02-modelo-de-datos.md)
- [03 Mapa de pantallas](03-mapa-de-pantallas.md)
- [04 Matriz de permisos](04-matriz-de-permisos.md)
- [05 Integraciones](05-integraciones.md)
- [06 Plan de implementación y MVP](06-plan-de-implementacion.md)
- [07 Decisiones pendientes](07-decisiones-pendientes.md)
- [08 Estado de avance](08-estado-de-avance.md)
- [09 Cumplimiento normativo](09-cumplimiento-normativo.md)
- [10 Pruebas](10-pruebas.md)
- [ADR: registro de decisiones de arquitectura](adr/)

---

## 1. Objetivo

Construir un producto comercial real (no una demostración) de comercio electrónico B2B/B2C especializado en implantes dentales, componentes de implantología e insumos odontológicos, para operar en Chile. Incluye:

1. Una aplicación móvil para iOS y Android.
2. Un backend con una base de datos centralizada.
3. Un panel web administrativo.
4. Una tienda web sincronizada con la aplicación.

## 2. Principios obligatorios (no negociables)

| ID | Principio |
|---|---|
| P-01 | No se presentan datos ficticios como reales: productos, pedidos, pagos, stock, clientes, estados de despacho ni números de seguimiento. Los datos de prueba solo existen en las pruebas automatizadas y están marcados como tales. |
| P-02 | No se simulan integraciones. Una integración solo se declara operativa después de configurarla y probarla contra el servicio real o su ambiente oficial de integración. |
| P-03 | No se inventan credenciales, claves, endpoints ni resultados de pruebas. |
| P-04 | El servidor calcula y valida precios, descuentos, impuestos, totales, permisos, stock y pagos. El cliente solo muestra lo que devuelve el servidor. |
| P-05 | La autorización se aplica en el backend (RLS y funciones con verificación de permisos). Ocultar elementos en la interfaz no cuenta como seguridad. |
| P-06 | Hay una única fuente de verdad para los datos comerciales: una sola base de datos, un solo catálogo y un solo inventario para todos los canales. |
| P-07 | Las operaciones críticas (pedido, reserva de stock, pago, movimiento de inventario) son transaccionales e idempotentes. |
| P-08 | No hay botones sin función ni pantallas que aparenten integraciones inexistentes. Una función no disponible no se muestra, o se indica explícitamente su estado real. |
| P-09 | No se registran contraseñas, tokens privados ni datos sensibles en los logs. Los secretos nunca se guardan en el código fuente. |
| P-10 | Las compatibilidades técnicas solo se muestran si están verificadas y respaldadas por una fuente. Nunca se infieren por similitud de marca, dimensiones o apariencia. |
| P-11 | Se distinguen siempre los datos reales de las estimaciones o proyecciones (plazos de entrega, pronósticos, rentabilidad). |
| P-12 | La plataforma no almacena datos de pacientes. Las listas por procedimiento son listas de compra y no constituyen recomendaciones clínicas. |
| P-13 | No se declara cumplimiento legal, certificación ni publicación en tiendas sin una verificación real. |

## 3. Glosario

| Término | Definición |
|---|---|
| Producto | Modelo comercial (por ejemplo, una línea de implantes de un fabricante). Agrupa variantes. |
| Variante / SKU | Unidad vendible con SKU interno propio, código del fabricante, precio y stock. En implantes, cada combinación diámetro × longitud es una variante. |
| Sistema de implantes | Familia técnica de un fabricante que comparte conexiones y plataformas. |
| Plataforma | Interfaz protésica de un sistema (por ejemplo, plataforma estrecha o regular). |
| Tipo de conexión | Geometría de unión implante-pilar (por ejemplo, hexágono interno o cono Morse). Se administra como tabla. |
| Compatibilidad verificada | Relación explícita entre un implante (variante, producto o plataforma) y un componente, con fuente técnica, fecha de verificación y responsable. |
| Alternativa comercial | Producto que se ofrece cuando otro está agotado. **No** implica compatibilidad técnica. |
| Stock físico | Unidades presentes en bodega. |
| Stock reservado | Unidades retenidas temporalmente por pedidos pendientes de pago, con vencimiento. |
| Stock comprometido | Unidades asignadas a pedidos pagados o confirmados que aún no se despachan. |
| Stock disponible | Físico − reservado − comprometido, en bodegas habilitadas para la venta. |
| Lote | Partida identificada por número de lote y, cuando corresponde, fecha de vencimiento. |
| FEFO | *First Expired, First Out*: primero sale lo que vence antes. |
| Precio neto | Precio sin IVA. |
| Precio bruto | Precio con IVA (19 % en Chile para bienes afectos). |
| DTE | Documento Tributario Electrónico del SII (boleta o factura electrónica). |
| RUT | Rol Único Tributario chileno. Se valida con el dígito verificador (módulo 11). |
| UDI / GS1 | Identificación única de dispositivos médicos. Los códigos GS1 (DataMatrix, GS1-128) codifican GTIN, lote y vencimiento. |
| RLS | *Row Level Security* de PostgreSQL: políticas por fila que limitan qué datos ve o modifica cada usuario. |
| RPC | Función de base de datos invocada desde los clientes a través de la API de Supabase. |
| Idempotencia | Repetir la misma solicitud produce el mismo resultado sin duplicar efectos. |

## 4. Actores y tipos de cuenta

- **Visitante**: sin sesión. Puede ver el catálogo según la configuración de visibilidad ([D-02](07-decisiones-pendientes.md)).
- **Clientes**: cliente general, odontólogo, implantólogo, clínica dental u organización comercial. La verificación profesional es configurable.
- **Usuarios de clínica**: administrador de clínica, odontólogo, asistente o encargado de compras, dentro de una organización.
- **Personal interno**: administrador general, administrador comercial, vendedor, encargado de inventario, encargado de despacho, responsable de compras y soporte.
- **Sistemas externos**: proveedor de pagos, transportistas, facturación electrónica, correo, push y WhatsApp.

## 5. Requisitos funcionales

Prioridad: **MVP** = primera versión funcional (ver [06](06-plan-de-implementacion.md)); **F2…F9** = fase posterior según el plan.

### 5.1 Cuentas, registro y autenticación (CTA)

| ID | Requisito | Prioridad |
|---|---|---|
| CTA-01 | Registro con nombre, correo, teléfono y contraseña segura (o un proveedor equivalente). | MVP |
| CTA-02 | Verificación de correo obligatoria antes de comprar. | MVP |
| CTA-03 | Recuperación y restablecimiento de contraseña. | MVP |
| CTA-04 | Aceptación de términos y política de privacidad, registrando la versión aceptada y la fecha. | MVP |
| CTA-05 | Preferencias de comunicaciones por canal (correo, push, WhatsApp), con consentimiento explícito e historial. | MVP |
| CTA-06 | Tipos de cuenta: cliente general, odontólogo, implantólogo, clínica y organización comercial. | MVP |
| CTA-07 | Verificación profesional configurable (documentos, revisión por el personal y estado). | MVP |
| CTA-08 | Perfil: datos personales y profesionales, y datos de la clínica cuando corresponda. | MVP |
| CTA-09 | Direcciones de despacho (varias, con una predeterminada) y datos de facturación (RUT, razón social, giro). | MVP |
| CTA-10 | Historial permanente de pedidos en el servidor, consultable desde cualquier dispositivo. | MVP |
| CTA-11 | Cierre de sesión, sesión persistente segura y cierre de sesión en todos los dispositivos. | MVP |
| CTA-12 | Eliminación de cuenta desde la app (exigencia de App Store y Google Play), con anonimización y conservación de los registros tributarios exigidos por ley. | MVP |
| CTA-13 | Autenticación multifactor (TOTP) obligatoria para el personal interno. | MVP |
| CTA-14 | Un cliente nunca puede ver pedidos ni datos de otra persona. Se aplica con RLS y se verifica con pruebas. | MVP |

### 5.2 Clínicas y compras colaborativas (ORG)

| ID | Requisito | Prioridad |
|---|---|---|
| ORG-01 | Organización (clínica u organización comercial) con varios usuarios. | F4 |
| ORG-02 | Roles de clínica: administrador, odontólogo, asistente y encargado de compras, con permisos diferenciados. | F4 |
| ORG-03 | Direcciones, listas de compra e historial comercial compartidos dentro de la organización. | F4 |
| ORG-04 | Precios especiales por organización. | F4 |
| ORG-05 | Solicitudes de pedido con aprobación previa a la compra, registrando quién creó, modificó y aprobó. | F4 |

### 5.3 Catálogo (CAT)

| ID | Requisito | Prioridad |
|---|---|---|
| CAT-01 | Categorías y subcategorías administrables. Categorías iniciales: las 12 de la especificación. | MVP |
| CAT-02 | Marcas, fabricantes, sistemas de implantes, plataformas y tipos de conexión administrables. | MVP |
| CAT-03 | Ficha de producto: nombre, marca, fabricante, SKU, código del fabricante, categoría, descripción, fotos, precio, costo, moneda, impuestos, stock, variantes, medidas, plataforma, conexión, sistema, compatibilidades, lotes, documentación técnica, instrucciones de uso, almacenamiento, estado de publicación, disponibilidad y proveedor. | MVP |
| CAT-04 | Campos técnicos adaptados al tipo de producto (implante, pilar, transfer, tornillo, análogo, biomaterial, instrumental, kit, prótesis o insumo general). | MVP |
| CAT-05 | Crear, editar, duplicar y desactivar productos. Gestión de productos agotados y descontinuados. | MVP |
| CAT-06 | Subida de fotografías y documentos técnicos. | MVP |
| CAT-07 | Detección de SKU duplicados (único sin distinguir mayúsculas) y de GTIN duplicados. | MVP |
| CAT-08 | Historial de modificaciones de cada producto, mediante auditoría. | MVP |
| CAT-09 | Importación y exportación del catálogo con plantillas validadas (CSV/Excel), con informe de errores por fila. | MVP |
| CAT-10 | Restricción de productos para profesionales verificados (por producto), según el modelo comercial. | MVP |

### 5.4 Buscador inteligente (BUS)

| ID | Requisito | Prioridad |
|---|---|---|
| BUS-01 | Búsqueda por nombre, marca, fabricante, SKU, código del fabricante, sistema, diámetro, longitud, plataforma, conexión, categoría y referencia técnica. | MVP |
| BUS-02 | Interpretación de medidas en texto libre («implante de 4.0 x 10 mm», «4,0x10», «Ø4 L10»). | MVP |
| BUS-03 | Búsqueda directa por código, ignorando guiones, espacios y puntos. | MVP |
| BUS-04 | Filtros combinables y ordenamiento (relevancia, precio, nombre y novedades). | MVP |
| BUS-05 | Tolerancia razonable a errores de escritura y a tildes (trigramas y `unaccent`). | MVP |
| BUS-06 | Búsquedas recientes (en el dispositivo) y sugerencias mientras se escribe. | MVP |
| BUS-07 | Lectura de códigos GS1/UDI del envase con la cámara (GTIN, lote y vencimiento) para identificar el producto, con confirmación del usuario antes de agregarlo al carrito. | F3 |
| BUS-08 | Reconocimiento de texto (OCR) de etiquetas como respaldo, con coincidencias probables y alternativa de búsqueda manual. La foto nunca se usa como prueba de compatibilidad. | F3 (requiere [D-16](07-decisiones-pendientes.md)) |

### 5.5 Compatibilidad, comparador y alternativas (CMP)

| ID | Requisito | Prioridad |
|---|---|---|
| CMP-01 | Base de datos explícita de compatibilidades entre implante (variante, producto o plataforma) y componente (producto o variante). | MVP |
| CMP-02 | Cada compatibilidad tiene una fuente técnica (documento o referencia), fecha de verificación y responsable. Una compatibilidad no puede quedar «verificada» sin esos datos. | MVP |
| CMP-03 | Los clientes solo ven compatibilidades verificadas. Si no hay información confirmada, se muestra «compatibilidad pendiente de verificación». | MVP |
| CMP-04 | Comparador de productos con atributos documentados equivalentes (misma definición y unidad), precio y disponibilidad. | F4 |
| CMP-05 | Alternativas comerciales aprobadas para productos agotados, rotuladas claramente como «alternativa de compra» y distintas de «componente compatible». | F4 |

### 5.6 Kits, listas y armador por procedimiento (KIT)

| ID | Requisito | Prioridad |
|---|---|---|
| KIT-01 | Armador visual de kits personalizados: agregar y quitar productos, cantidades, verificación de compatibilidad documentada, disponibilidad y precio total. | F4 |
| KIT-02 | Guardar, duplicar, editar, reutilizar y compartir kits y listas con usuarios autorizados. | F4 |
| KIT-03 | Kits predefinidos y packs promocionales creados por el administrador. | F4 |
| KIT-04 | La disponibilidad de un kit se calcula a partir de sus componentes reales. No existe stock independiente del kit. | F4 |
| KIT-05 | El pedido conserva una copia de los componentes, cantidades y precios del kit. | F4 |
| KIT-06 | Listas de materiales por procedimiento o preferencia del profesional: editables y sin presentarse como recomendación clínica. | F4 |

### 5.7 Carrito y proceso de compra (CAR)

| ID | Requisito | Prioridad |
|---|---|---|
| CAR-01 | Carrito persistido en el servidor y asociado a la cuenta, accesible desde las pantallas comerciales. | MVP |
| CAR-02 | Selección de variante, consulta de disponibilidad y modificación de cantidades. | MVP |
| CAR-03 | Cotización del carrito calculada por el servidor: precios vigentes, descuentos, IVA, despacho y total. | MVP |
| CAR-04 | Checkout con dirección, modalidad de despacho, medio de pago, resumen, confirmación y seguimiento. | MVP |
| CAR-05 | Creación de pedido transaccional e idempotente: sin pedidos duplicados ante reintentos o doble toque. | MVP |
| CAR-06 | Reserva de stock al crear el pedido, con vencimiento; liberación automática si el pago no se concreta. | MVP |
| CAR-07 | Manejo de cambios de stock o de precio entre el carrito y la confirmación, informando al usuario. | MVP |
| CAR-08 | Descuentos autorizados (cupones o promociones) validados por el servidor. | F4 |

### 5.8 Pagos, reembolsos, conciliación y facturación (PAG)

| ID | Requisito | Prioridad |
|---|---|---|
| PAG-01 | Integración con un proveedor de pagos disponible en Chile, mediante adaptadores intercambiables. Proveedor pendiente: [D-03](07-decisiones-pendientes.md). | MVP |
| PAG-02 | Estados de pago: creado, pendiente, autorizado, aprobado, rechazado, anulado, expirado, reembolsado (total o parcial) y con error. | MVP |
| PAG-03 | El pedido se marca como pagado solo con la confirmación servidor a servidor del proveedor (commit, consulta de estado o webhook verificado), nunca por el regreso del usuario desde la página de pago. | MVP |
| PAG-04 | Webhooks autenticados (firma o verificación), idempotentes y registrados. | MVP |
| PAG-05 | No se almacenan números completos de tarjeta ni códigos de seguridad. Solo los últimos 4 dígitos, si el proveedor los entrega. | MVP |
| PAG-06 | Reembolsos y anulaciones vinculados a operaciones reales del proveedor. | F6 |
| PAG-07 | Conciliación entre los pagos registrados y las liquidaciones del proveedor, e historial de operaciones. | F6 |
| PAG-08 | Comprobantes de pago visibles para el cliente. | MVP |
| PAG-09 | Facturación electrónica (boleta y factura) como módulo independiente. Proveedor pendiente: [D-04](07-decisiones-pendientes.md). No se declara la emisión de DTE sin una integración probada. | F6 |
| PAG-10 | Transferencia bancaria con confirmación manual por el personal autorizado, auditada (si se aprueba en [D-03](07-decisiones-pendientes.md)). | MVP opcional |

### 5.9 Cotizaciones (COT)

| ID | Requisito | Prioridad |
|---|---|---|
| COT-01 | Cotización con número único, datos de la empresa y del cliente, emisión, vigencia, productos, códigos, cantidades, precios, descuentos, impuestos, total, condiciones de pago y despacho, observaciones y estado. | F4 |
| COT-02 | PDF descargable y compartible, generado en el servidor y consultable desde la cuenta. | F4 |
| COT-03 | Conversión de una cotización aprobada y vigente en pedido, sin duplicar productos y con trazabilidad. | F4 |
| COT-04 | Conservación de los precios y condiciones históricos de cada cotización. | F4 |

### 5.10 Compras recurrentes y reposición (REC)

| ID | Requisito | Prioridad |
|---|---|---|
| REC-01 | Comprar nuevamente desde un pedido anterior, revalidando el precio y el stock actuales. | F4 |
| REC-02 | Favoritos, listas habituales, kits guardados y productos comprados frecuentemente. | MVP (favoritos) / F4 |
| REC-03 | Pedidos programados con frecuencia y cantidades configurables. Antes de cada ejecución se revalidan disponibilidad, precio y condiciones, y se notifica al cliente. Sin cargos automáticos sin autorización expresa. | F4 |

### 5.11 Alertas (ALE)

| ID | Requisito | Prioridad |
|---|---|---|
| ALE-01 | Para clientes: aviso de reposición de stock (solo cuando el inventario ya se actualizó), seguimiento de favoritos, cambios de precio opcionales y recordatorios de compra. | F6 |
| ALE-02 | Para administradores: stock bajo, agotados, riesgo de quiebre, lotes por vencer, productos sin movimiento y órdenes pendientes de recepción. | F6 |
| ALE-03 | Sin alertas duplicadas, con preferencias configurables. | F6 |
| ALE-04 | Alertas de costos: aumentos de costo, caída de margen y umbrales mínimos. No modifican precios sin una regla aprobada. | F7 |

### 5.12 Inventario, lotes y bodegas (INV)

| ID | Requisito | Prioridad |
|---|---|---|
| INV-01 | Inventario centralizado: stock físico, reservado, comprometido y disponible. | MVP |
| INV-02 | Movimientos (entradas, salidas, ajustes, devoluciones y transferencias) con producto, cantidad, fecha, motivo y responsable, en un libro inmutable. | MVP |
| INV-03 | Sin stock negativo (restricción de base de datos). | MVP |
| INV-04 | Lotes y vencimientos cuando corresponda: número de lote, vencimiento, proveedor, recepción, ubicación y documentos. | MVP |
| INV-05 | Trazabilidad de lotes: qué pedidos contienen un lote específico (ante una alerta de calidad o un retiro de mercado). | MVP (modelo) / F6 (despacho con lote) |
| INV-06 | Múltiples bodegas: stock por bodega, reservas por ubicación y bodegas habilitadas para la venta. | MVP (modelo) |
| INV-07 | Transferencias entre bodegas y control de diferencias de inventario (conteos). | F5 |

### 5.13 Proveedores y órdenes de compra (PRV)

| ID | Requisito | Prioridad |
|---|---|---|
| PRV-01 | Proveedores con datos comerciales, productos asociados, costos, plazos y cantidades mínimas. | F5 |
| PRV-02 | Órdenes de compra con aprobación obligatoria antes del envío. | F5 |
| PRV-03 | Recepciones parciales y completas con escáner, comparación contra la orden, lotes y vencimientos. El stock se actualiza solo al confirmar la recepción. | F5 |
| PRV-04 | Historial de costos por proveedor y comparación de abastecimiento (indicando si faltan impuestos, fletes u otros costos). | F5 |
| PRV-05 | Órdenes de compra sugeridas (borradores) según ventas, rotación, stock, reservas y plazos, que el administrador revisa y aprueba. | F7 |

### 5.14 Pronóstico de demanda (PRO)

| ID | Requisito | Prioridad |
|---|---|---|
| PRO-01 | Rotación, cobertura, riesgo de agotamiento, cantidad sugerida, baja rotación, tendencias y plazos. | F7 |
| PRO-02 | Nivel de confianza explícito. Se distinguen datos reales de proyecciones. Si el historial es insuficiente, se informa y no se inventa precisión. | F7 |

### 5.15 Despacho y seguimiento (DES)

| ID | Requisito | Prioridad |
|---|---|---|
| DES-01 | Cobertura por comuna, modalidades (retiro, estándar y prioritario), costos y plazos estimados configurables. | MVP |
| DES-02 | Envíos con transportista, número de seguimiento real (solo si existe), estados e incidencias. | MVP (manual) |
| DES-03 | Distinción entre plazo estimado y fecha de entrega confirmada. | MVP |
| DES-04 | Integración con transportistas mediante API cuando existan credenciales ([D-05](07-decisiones-pendientes.md)). | F6 |
| DES-05 | Gestión de pedidos incompletos (despachos parciales). | F6 |

### 5.16 WhatsApp comercial (WSP)

| ID | Requisito | Prioridad |
|---|---|---|
| WSP-01 | Contacto con un asesor desde la ficha, el carrito, una cotización, un pedido o el centro de soporte, con un mensaje prellenado (SKU, nombre o número de pedido) y sin datos sensibles. | MVP (enlace click-to-chat) |
| WSP-02 | Contactos comerciales y horarios configurables. | MVP |
| WSP-03 | Se distingue «abrir WhatsApp» de «mensaje enviado» o «respondido». Nunca se afirma un envío sin la confirmación del servicio. | MVP |
| WSP-04 | Registro de las consultas por el equipo y vinculación con el CRM y sus oportunidades. | F6 |

### 5.17 CRM y recuperación (CRM)

| ID | Requisito | Prioridad |
|---|---|---|
| CRM-01 | Clientes, organizaciones, consultas, oportunidades, seguimientos, responsable, próxima acción, fecha, historial y estado. | F6 |
| CRM-02 | Identificación de clientes nuevos y recurrentes, y de oportunidades que requieren atención. | F6 |
| CRM-03 | Detección de carritos abandonados y cotizaciones pendientes, con recordatorios dentro de la app y medición de la recuperación, respetando los consentimientos. | F6 |

### 5.18 Soporte y reclamos (SOP)

| ID | Requisito | Prioridad |
|---|---|---|
| SOP-01 | Tickets vinculados a cliente, producto y pedido: número, categoría, descripción, prioridad, responsable, fecha, respuestas, adjuntos, estado y resolución. | F6 |
| SOP-02 | Estados: abierto, en revisión, esperando al cliente, resuelto y cerrado. El cliente consulta sus casos desde la app. | F6 |
| SOP-03 | Asignación de responsables y medición de tiempos de respuesta. | F6 |

### 5.19 Devoluciones, cambios y garantías (DEV)

| ID | Requisito | Prioridad |
|---|---|---|
| DEV-01 | Solicitud desde el pedido: motivo, fotos, producto, cantidad y lote. | F6 |
| DEV-02 | Revisión, aprobación o rechazo, cambio de producto o reembolso, y registro de la resolución. | F6 |
| DEV-03 | Trazabilidad del producto devuelto. No se reingresa al stock vendible sin inspección (cuarentena). | F6 |

### 5.20 Precios, promociones y fidelización (PRC/FID/OPI)

| ID | Requisito | Prioridad |
|---|---|---|
| PRC-01 | Lista de precios base. | MVP |
| PRC-02 | Descuentos porcentuales y por monto, promociones por volumen, packs, cupones, precios por cliente y por clínica, listas de precios, acuerdos, vigencias, límites de uso y margen mínimo autorizado. | F4 |
| PRC-03 | Historial de cambios de precio. Los pedidos confirmados conservan sus precios históricos. | MVP |
| FID-01 | Niveles de cliente con beneficios configurables, auditables. Programa de referidos opcional. | F7 |
| OPI-01 | Opiniones de compradores verificados con moderación y reportes. Sin afirmaciones médicas sin respaldo. | F7 |

### 5.21 Tienda web sincronizada (WEB)

| ID | Requisito | Prioridad |
|---|---|---|
| WEB-01 | Tienda web con el mismo backend, catálogo, precios y disponibilidad que la app. | F8 |
| WEB-02 | Descubrimiento, búsqueda, fichas y compra según los permisos comerciales. | F8 |

### 5.22 Notificaciones (NOT)

| ID | Requisito | Prioridad |
|---|---|---|
| NOT-01 | Centro de notificaciones en la app: pedidos, pagos, despachos, cotizaciones, soporte, disponibilidad, precios, reposición y promociones autorizadas. | F6 |
| NOT-02 | Canales: push, correo y WhatsApp, solo cuando la integración está configurada. Se registra el estado de envío cuando el proveedor permite verificarlo. | F6 |
| NOT-03 | Preferencias por tipo y canal. Deduplicación. | F6 |
| NOT-04 | Correo transaccional de confirmación de pedido y pago. | MVP (requiere [D-08](07-decisiones-pendientes.md)) |

### 5.23 Roles, permisos y auditoría (ROL)

| ID | Requisito | Prioridad |
|---|---|---|
| ROL-01 | Roles configurables (ver [04](04-matriz-de-permisos.md)) con permisos explícitos para consultar, crear, modificar, aprobar y eliminar. | MVP |
| ROL-02 | Las operaciones sensibles se validan en el backend. | MVP |
| ROL-03 | Auditoría de precios, stock, pedidos, permisos y operaciones financieras, en un registro de solo inserción. | MVP |

### 5.24 Reportes, inteligencia comercial y herramientas (REP/BI)

| ID | Requisito | Prioridad |
|---|---|---|
| REP-01 | Exportación a CSV y Excel (productos, inventario, movimientos, lotes, proveedores, OC, clientes, pedidos, cotizaciones, pagos, devoluciones, despachos, ventas, rentabilidad y tickets), y a PDF cuando corresponda. Con permisos y registro de las exportaciones sensibles. | F7 (MVP: catálogo y pedidos) |
| BI-01 | Indicadores: ventas brutas y netas, pagos recibidos, pedidos completados, ticket promedio, más vendidos, más rentables, márgenes por producto y por categoría, costos, descuentos, despacho, recurrencia, conversión de cotizaciones, recuperación de carritos, rotación, evolución y resultados por vendedor. | F7 |
| BI-02 | Fórmulas documentadas. Se distinguen ingresos, pagos recibidos, costos, margen y utilidad estimada. No se calcula rentabilidad si faltan costos relevantes. | F7 |
| BI-03 | Metas por período, vendedor o categoría. Comisiones solo con reglas aprobadas y acceso restringido. | F7 |
| BI-04 | Calendario de operaciones: entregas, recepciones, cotizaciones por vencer, pedidos pendientes, tareas, seguimientos y reposiciones. | F7 |
| BI-05 | Calculadora de costos para el cliente (compra total) y para el administrador (simulación de márgenes), distinguiendo los costos reales de las estimaciones. | F7 |

### 5.25 Seguridad, sincronización y calidad (SEG/SYN/QA/PUB)

| ID | Requisito | Prioridad |
|---|---|---|
| SEG-01 | Autenticación segura, autorización por rol, RLS, validación en cliente y servidor, sesiones seguras y MFA para el personal. | MVP |
| SEG-02 | Secretos fuera del código, webhooks verificados, límites de solicitudes, manejo seguro de errores y logs sin datos sensibles. | MVP |
| SEG-03 | Copias de seguridad y procedimiento de restauración probado. | MVP (antes de producción) |
| SEG-04 | Política de privacidad, términos y procedimiento de eliminación de cuentas. | MVP (texto legal pendiente) |
| SYN-01 | Todas las interfaces usan el mismo backend. Manejo de operaciones repetidas, conflictos, errores de red, reintentos, reservas y pagos. | MVP |
| SYN-02 | Modo sin conexión: lectura del catálogo y de los pedidos en caché. Las operaciones de compra esperan la conectividad. | MVP (lectura en caché) |
| QA-01 | Pruebas unitarias, de integración y de extremo a extremo de los flujos críticos, documentadas con sus resultados reales. | Continuo |
| PUB-01 | Compilación para iOS y Android con identificadores configurables, ícono, pantalla de inicio, versiones, variables por entorno y documentación de publicación. | F9 (configuración base en F2) |

## 6. Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF-01 | **Rendimiento**: búsqueda del catálogo con p95 < 500 ms en el servidor para un catálogo de hasta 50.000 variantes. Listas paginadas. |
| RNF-02 | **Disponibilidad**: los servicios gestionados (Supabase y hosting web) con el SLA del plan contratado. Degradación controlada ante fallas de integraciones. |
| RNF-03 | **Accesibilidad**: contraste WCAG 2.2 AA, tamaños táctiles ≥ 44 pt, soporte de texto dinámico y etiquetas para lectores de pantalla. |
| RNF-04 | **Compatibilidad**: iOS y Android con las versiones mínimas que defina el SDK de Expo vigente, desde teléfonos pequeños hasta tablets. Navegadores modernos en la web. |
| RNF-05 | **Escalabilidad**: arquitectura sin estado en los clientes. Base de datos con índices y paginación. Imágenes servidas desde almacenamiento con CDN. |
| RNF-06 | **Observabilidad**: errores de cliente y servidor registrados con monitoreo (Sentry u otro, [D-09](07-decisiones-pendientes.md)) y sin datos sensibles. |
| RNF-07 | **Mantenibilidad**: TypeScript estricto, módulos desacoplados, migraciones versionadas, pruebas automatizadas e integración continua. |
| RNF-08 | **Idioma y formato**: español de Chile. Moneda CLP sin decimales con separador de miles «.». Fechas en formato dd-mm-aaaa y zona horaria America/Santiago. |

## 7. Criterios finales de aceptación

Corresponden a la sección 46 de la especificación. La evidencia se registra en [10-pruebas.md](10-pruebas.md).

| # | Criterio | Requisitos |
|---|---|---|
| 1 | Los usuarios pueden registrarse e iniciar sesión | CTA-01…03 |
| 2 | Los pedidos quedan guardados en el servidor y asociados a la cuenta correcta | CAR-05, CTA-10 |
| 3 | El historial se puede consultar desde otro dispositivo | CTA-10 |
| 4 | El catálogo y los filtros funcionan con datos reales | CAT, BUS |
| 5 | La compatibilidad usa información verificada | CMP-01…03 |
| 6 | El carrito valida stock, precios y descuentos en el servidor | CAR-03, CAR-06…08 |
| 7 | Los pagos se confirman mediante el mecanismo real de validación | PAG-03, PAG-04 |
| 8 | El administrador gestiona productos, clientes, proveedores e inventario según sus permisos | CAT, INV, PRV, ROL |
| 9 | Las cotizaciones PDF se generan y se convierten en pedidos | COT |
| 10 | Las alertas se activan solo cuando se cumplen sus condiciones | ALE |
| 11 | Los despachos muestran estados reales cuando existe integración | DES |
| 12 | Las devoluciones y los reembolsos conservan su trazabilidad | DEV, PAG-06 |
| 13 | Los kits descuentan correctamente los componentes del inventario | KIT-04, KIT-05 |
| 14 | Las órdenes de compra se aprueban antes de enviarse | PRV-02 |
| 15 | El soporte y los reclamos mantienen su historial | SOP |
| 16 | Las notificaciones respetan las preferencias | NOT-03 |
| 17 | Los informes usan fórmulas coherentes | BI-02 |
| 18 | Los usuarios no pueden acceder a información ajena | CTA-14, SEG-01 |
| 19 | Las pruebas críticas se ejecutan y quedan documentadas | QA-01 |
| 20 | Existe documentación para instalar, configurar, probar y mantener el sistema | PUB-01 |

## 8. Supuestos y restricciones

- La operación es en Chile: moneda CLP, IVA del 19 % y documentos tributarios del SII.
- El stack inicial (React Native + Expo, Supabase y Next.js) lo propuso el cliente y fue validado en [01-arquitectura.md](01-arquitectura.md).
- Las integraciones externas requieren cuentas y credenciales del negocio. Hasta tenerlas, el módulo correspondiente se entrega preparado pero **no operativo**, y así se indica.
- El contenido legal (términos, privacidad y políticas comerciales) debe redactarlo o validarlo un asesor legal. El sistema solo gestiona sus versiones y su aceptación.

## 9. Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-10-28 | 0.1 | Versión inicial a partir de la especificación del proyecto (secciones 1–47). |
