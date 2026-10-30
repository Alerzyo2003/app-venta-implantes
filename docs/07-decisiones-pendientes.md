# Decisiones pendientes de aprobación

Versión 0.1 — 2026-10-28. Cada decisión incluye una **recomendación** y su impacto. Mientras no haya respuesta, el desarrollo avanza solo en lo que no depende de ella. Cuando se resuelva una, se registra aquí la fecha y la opción elegida.

| ID | Decisión | Bloquea | Estado |
|---|---|---|---|
| D-01 | Proyecto Supabase para desarrollo, staging y producción | Inc. 1 (pruebas reales), despliegue | **Aprobada para desarrollo** (2026-10-29); producción pendiente |
| D-02 | Modelo comercial y visibilidad (B2B, B2C o mixto; precios; venta de implantes) | Inc. 1 | **Pendiente** |
| D-03 | Proveedor de pagos | Inc. 4 | **Pendiente** |
| D-04 | Precios netos o brutos y proveedor de facturación electrónica | Inc. 3 (visualización), F6 (DTE) | **Pendiente** (se asume la recomendación como valor por defecto configurable) |
| D-05 | Cobertura y modalidades de despacho | Inc. 3 | **Pendiente** |
| D-06 | ¿Se exige cuenta para el carrito y la compra? | Inc. 3 | **Pendiente** (se asume la recomendación) |
| D-07 | Requisitos de la verificación profesional | Inc. 1 | **Pendiente** |
| D-08 | Proveedor de correo transaccional y dominio | Inc. 1 (producción), Inc. 4 | **Pendiente** |
| D-09 | Monitoreo de errores | Inc. 5 | **Pendiente** |
| D-10 | Hosting web y dominios | Inc. 1 (panel desplegado) | **Pendiente** |
| D-11 | Cuentas de Apple, Google y Expo, e identificadores de la app | Inc. 5, F9 | **En curso** (2026-10-30): cuenta Expo creada y primera versión de prueba para Android compilada; faltan Google Play, Apple y los identificadores definitivos |
| D-12 | Política de stock negativo y preventa | — | **Pendiente** (se asume: no se permite) |
| D-13 | Duración de la reserva de stock durante el pago | Inc. 3 | **Pendiente** (se asume: 30 min) |
| D-14 | Asesoría legal y regulatoria | Producción | **Pendiente** |
| D-15 | Moneda de venta | — | **Pendiente** (se asume: solo CLP) |
| D-16 | OCR de texto para la búsqueda por fotografía | F3 (etapa 2) | **Pendiente** |
| D-17 | Nombre comercial e identidad definitiva | Publicación | **Pendiente** (se usa una configuración temporal) |

---

### D-01 · Proyecto Supabase

En tu organización de Supabase existen 6 proyectos (`bd-app`, `tienda-clinica`, `clinica-externa`, `clinica-dental-suscripciones`, `portal-suscripciones`, `softdent-duoc`). **Ninguno se modificó.** No está claro que alguno corresponda a esta plataforma.

- **Recomendación**: crear proyectos **nuevos y dedicados**, en la región **sa-east-1 (São Paulo)**:
  - `implantes-dev` (desarrollo/staging; puede ser del plan gratuito si el límite de proyectos activos lo permite).
  - `implantes-prod` (producción en plan Pro, por los respaldos diarios y la ausencia de pausas por inactividad; PITR opcional).
- Si prefieres reutilizar `tienda-clinica`, confírmalo: está en `us-east-1` (mayor latencia desde Chile) e inactivo.
- **Impacto**: sin un proyecto no se pueden probar de punta a punta Auth, la API ni Storage, y la app no puede conectarse.
- Crear un proyecto puede tener costo. **Necesito tu aprobación expresa** para crearlo con el conector de Supabase.

**Resolución (2026-10-29)**: aprobado el proyecto de desarrollo. Se creó
`plataforma-implantes-dev` (ref `snxzwnvhohzonzpypxxd`) en **sa-east-1**, plan gratuito, en la
organización «Clinica dignidad». Los proyectos existentes no se modificaron. El proyecto de
producción se decidirá antes del lanzamiento. Estado de las migraciones en
[`supabase/README.md`](../supabase/README.md#proyecto-de-desarrollo-d-01).

### D-02 · Modelo comercial y visibilidad

Opciones:

1. **B2B exclusivo**: solo profesionales y clínicas verificadas compran; los demás ven el catálogo sin precios.
2. **Mixto (recomendado)**: cualquiera con cuenta compra insumos generales; los implantes y componentes quirúrgicos (`requires_professional`) solo los compran profesionales verificados.
3. **B2C abierto**.

- **Recomendación**: opción 2. Catálogo visible públicamente; precios visibles para usuarios con sesión (`pricing.visibility = authenticated`). Venta de los productos marcados como «solo profesionales» únicamente a cuentas verificadas. Todo es configurable en `app_settings` y por producto.
- Además debe confirmarse con un asesor regulatorio si la venta de implantes a público general está permitida ([D-14](#d-14--asesoría-legal-y-regulatoria)).

### D-03 · Proveedor de pagos

- **Recomendación**: **Transbank Webpay Plus** (tarjetas de crédito, débito y prepago; el medio más reconocido en Chile), más **transferencia bancaria con confirmación manual** auditada para clientes B2B. Alternativa de alta más rápida: Mercado Pago. Comparativa en [05 §2](05-integraciones.md#2-pagos-chile--decisión-d-03).
- **Necesito**: el proveedor elegido y el estado de la afiliación. Para desarrollo bastan las credenciales de integración que publica el proveedor. Para producción, sus credenciales comerciales, entregadas por un canal seguro (nunca en el chat ni en el repositorio).
- **Nota**: este entorno de desarrollo no tiene acceso de red a Transbank ni a Mercado Pago. Las pruebas de pago deberán ejecutarse desde CI o desde un equipo con acceso.

### D-04 · Precios e impuestos; facturación electrónica

- **Recomendación**:
  - Guardar los precios **netos** y calcular el IVA del 19 % en el servidor.
  - Mostrar a los profesionales y empresas el precio **neto + IVA**, y a los consumidores el precio **con IVA incluido**, según el documento elegido (factura o boleta).
  - Reglas de redondeo en [ADR-0004](adr/0004-montos-clp-e-iva.md).
  - Contratar un proveedor de DTE con API y ambiente de certificación (Bsale, OpenFactura, LibreDTE u otro).
- **Necesito**: confirmar si se emitirán boletas, facturas o ambas, y elegir el proveedor de DTE (o indicar el ERP que ya usan).

### D-05 · Despacho

- **Recomendación para el MVP**: retiro en bodega + despacho estándar con tarifa por comuna o región configurable + despacho prioritario solo en las comunas que el negocio defina. El envío se registra manualmente con el número de seguimiento real del transportista. En F6, integrar un agregador (Shipit, Envíame u otro).
- **Necesito**: dirección de la bodega o punto de retiro, cobertura inicial (¿solo la RM o todo Chile?), transportistas habituales y tarifas.

### D-06 · Cuenta obligatoria para comprar

- **Recomendación**: navegación sin cuenta, pero **el carrito y la compra requieren una cuenta verificada por correo**. Así se mantiene el historial en el servidor, la verificación profesional y la recuperación de carritos. Es coherente con el foco B2B.

### D-07 · Verificación profesional

- **Recomendación**: el profesional sube su RUT, profesión y número de registro en el Registro Nacional de Prestadores Individuales de Salud (Superintendencia de Salud), con un respaldo opcional (título o certificado). El personal lo verifica manualmente en el registro público y aprueba o rechaza en el panel, con auditoría. Las clínicas se verifican con su RUT y razón social.
- **Necesito**: confirmar los requisitos y quién revisa.

### D-08 · Correo transaccional

- **Recomendación**: Resend o Amazon SES, con un dominio propio verificado (SPF, DKIM y DMARC).
- **Necesito**: el dominio y la elección del proveedor.

### D-09 · Monitoreo de errores

- **Recomendación**: Sentry (plan gratuito para comenzar), con filtrado de datos personales.

### D-10 · Hosting web

- **Recomendación**: Vercel para el panel y la tienda (integración directa con Next.js y vistas previas por rama), con dominios separados (por ejemplo `admin.<dominio>` y `www.<dominio>`).

### D-11 · Cuentas de las tiendas y de EAS

- **Necesito**: una cuenta de Apple Developer Program (persona jurídica recomendada), una cuenta de Google Play Console, una cuenta u organización de Expo e identificadores definitivos (por ejemplo `cl.<empresa>.app`). Mientras tanto se usan identificadores temporales configurables.

### D-12 · Stock negativo y preventa

- **Recomendación**: **no permitir** el stock negativo ni la preventa en el MVP (garantizado con restricciones de la base de datos). Si se requiere la venta contra pedido, se diseñará como «pedido especial» con un estado propio.

### D-13 · Duración de la reserva

- **Recomendación**: 30 minutos para completar el pago. Configurable (`checkout.reservation_minutes`). Si el pago se aprueba después del vencimiento, se intenta reservar de nuevo y, si no hay stock, se genera un reembolso.

### D-14 · Asesoría legal y regulatoria

- Antes de producción se necesita revisión legal de: términos y condiciones, política de privacidad (Ley 19.628 y Ley 21.719), derecho de retracto y garantías (Ley 19.496), comunicaciones promocionales, transferencia internacional de datos (servidores fuera de Chile) y la **normativa sanitaria del ISP** aplicable a la importación, distribución, publicidad y venta de implantes dentales (dispositivos médicos). Ver [09](09-cumplimiento-normativo.md).

### D-15 · Moneda

- **Recomendación**: vender solo en CLP. Registrar los costos de los proveedores extranjeros en su moneda, con tipo de cambio.

### D-16 · OCR de texto

- **Recomendación**: comenzar con la lectura de códigos GS1/UDI (más confiable, sin costo). Evaluar el OCR con ML Kit en el dispositivo (sin costo por uso; requiere *development build*) en lugar de un servicio en la nube.

### D-17 · Identidad

- Se usa `packages/brand/src/brand.ts` (nombre «Marca provisional», paleta azul profundo, blanco y turquesa). Cambiar el nombre, los colores, el logo o los contactos requiere editar un solo archivo. Los identificadores de la app se leen de variables de entorno.

## Registro de decisiones tomadas

| Fecha | ID | Decisión | Aprobada por |
|---|---|---|---|
| — | — | (sin decisiones aprobadas aún) | — |
