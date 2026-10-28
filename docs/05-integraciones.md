# Integraciones

Versión 0.1 — 2026-10-28.

**Estado general: ninguna integración externa está configurada ni operativa todavía.** Cada una requiere una decisión comercial ([07](07-decisiones-pendientes.md)) y credenciales del negocio. Las condiciones comerciales y técnicas de cada proveedor deben verificarse en su documentación vigente al momento de contratar. Desde el entorno de desarrollo actual, los sitios de Transbank, Mercado Pago y SII no son accesibles por la política de red; por eso no se pudieron consultar ni probar.

## 1. Principios

1. **Adaptadores**: cada integración se implementa detrás de una interfaz propia (`PaymentProvider`, `ShippingProvider`, `InvoiceProvider`, `MessageChannel`). Cambiar de proveedor no altera el modelo de datos.
2. **Secretos solo en el servidor**: en los secretos de las Edge Functions (`supabase secrets set`) o en las variables de servidor del hosting web. Nunca en la app, en el repositorio ni en variables `EXPO_PUBLIC_*` o `NEXT_PUBLIC_*`.
3. **Ambientes separados**: credenciales de integración o sandbox en desarrollo y staging; credenciales productivas solo en producción.
4. **Verificación**: los webhooks se validan (firma HMAC o consulta servidor a servidor) y se registran en `payment_events` u otra tabla equivalente con su identificador único.
5. **Estado honesto**: hasta que una integración se configura y se prueba, la interfaz no ofrece esa opción.

## 2. Pagos (Chile) — decisión [D-03](07-decisiones-pendientes.md)

| Opción | Tipo | Ventajas | Consideraciones |
|---|---|---|---|
| **Transbank Webpay Plus** | Pasarela directa (crédito, débito, prepago) | Medio más reconocido en Chile y cuotas. Ambiente de integración público para desarrollo | Afiliación comercial con Transbank y proceso de validación antes de producción. Flujo de redirección con **confirmación (*commit*) servidor a servidor**, más consulta de estado |
| **Mercado Pago** | Pasarela/agregador | Alta rápida, SDK, *webhooks* firmados, varios medios | Comisiones y plazos de liberación de fondos propios. Fondos en la cuenta de Mercado Pago |
| **Flow** | Agregador | Varios medios (Webpay, transferencias, otros) con una sola integración. Confirmación servidor a servidor firmada | Comisión del agregador |
| **Khipu / Fintoc** | Transferencias bancarias automatizadas | Bajo costo, habitual en B2B, conciliación automática | Experiencia distinta a la tarjeta. Contrato propio |
| **Transferencia manual** | Sin integración | Sin costo, común entre clínicas | Requiere que el personal confirme el depósito (con auditoría). Más lenta |

**Recomendación**: **Webpay Plus** como medio principal de tarjeta, más **transferencia bancaria con confirmación manual** para clientes B2B. Más adelante, evaluar Khipu o Fintoc para automatizar las transferencias. Si se prioriza la rapidez de la puesta en marcha, Mercado Pago es una alternativa con menor fricción de alta.

**Qué se necesitará** (cuando se apruebe):

- Ambiente de integración: credenciales de prueba oficiales del proveedor (las publica el mismo proveedor; no se inventan).
- Producción: código de comercio y llave secreta (o *access token*), entregados por el proveedor tras la afiliación.
- Configuración: `supabase secrets set PAYMENTS_PROVIDER=... PAYMENTS_ENV=integration|production ...`
- Dominio y URL de retorno HTTPS de la Edge Function.

## 3. Facturación electrónica (SII) — decisión [D-04](07-decisiones-pendientes.md)

- Boleta y factura electrónicas obligatorias. La integración se hace mediante un proveedor de facturación (por ejemplo Bsale, OpenFactura de Haulmer, LibreDTE, Nubox o Defontana) o directamente con el SII (más complejo: certificado digital, CAF y timbraje).
- **Recomendación**: un proveedor con API REST, ambiente de certificación y emisión de boletas y facturas, que devuelva el PDF y el XML del DTE. El módulo `invoices` (F6) guarda el folio, el estado y los documentos.
- **No se emitirá ni se mostrará ningún documento tributario hasta tener una integración probada en certificación.**

## 4. Despacho — decisión [D-05](07-decisiones-pendientes.md)

| Opción | Comentario |
|---|---|
| Despacho manual (MVP) | El personal crea el envío e ingresa el transportista y el número de seguimiento **real**. Los estados se actualizan manualmente. |
| Agregadores (Shipit, Envíame u otros) | Una API para cotizar, generar etiquetas y hacer seguimiento con varios transportistas. Recomendado para crecer. |
| Transportistas directos (Chilexpress, Starken, Blue Express, Correos de Chile) | API propia de cada uno. Requiere cuenta empresa y credenciales. |
| Reparto propio o retiro en bodega | Configurable por comuna (`shipping_rates`) y por bodega punto de retiro. |

Tarifas y cobertura por comuna se administran en el panel. Los plazos siempre se presentan como estimados hasta que el transportista confirma la entrega.

## 5. Correo transaccional — decisión [D-08](07-decisiones-pendientes.md)

- Supabase Auth necesita un SMTP propio en producción: el SMTP por defecto tiene límites estrictos y no sirve para producción.
- Opciones: Resend, Amazon SES, Postmark o SendGrid. **Recomendación**: Resend o Amazon SES, con un dominio propio y SPF, DKIM y DMARC configurados.
- Uso: verificación de correo, recuperación de contraseña, confirmación de pedido y de pago, y cambios de estado del envío.

## 6. Notificaciones push

- Expo Push Service, con credenciales FCM (Android, proyecto de Firebase) y APNs (iOS, cuenta Apple Developer) cargadas en EAS.
- Tokens en `push_tokens` (F6). El envío desde una Edge Function usa el *access token* de Expo como secreto. Se registra el estado devuelto por los *receipts* de Expo.

## 7. WhatsApp

- **MVP**: enlace *click-to-chat* (`https://wa.me/<número>?text=<mensaje>`) con el SKU, el nombre del producto o el número de pedido. Abre WhatsApp en el dispositivo. **El sistema no sabe si el mensaje se envió**, y la interfaz no lo afirma. El número y los horarios se configuran en `app_settings`.
- **F6**: WhatsApp Business Platform (Cloud API de Meta) para notificaciones con plantillas aprobadas y recepción de mensajes. Requiere verificación de la empresa en Meta, un número dedicado y plantillas aprobadas. Los estados de entrega y lectura se registran solo cuando la API los informa.

## 8. Lectura de envases (búsqueda por fotografía)

- **Etapa 1 (F3)**: códigos de barras con `expo-camera` (DataMatrix, GS1-128, EAN-13, QR). El parser GS1 (`packages/domain`) extrae el GTIN (01), el lote (10) y el vencimiento (17). Se busca el producto por GTIN o código y **se pide confirmación** antes de agregarlo.
- **Etapa 2 (opcional, [D-16](07-decisiones-pendientes.md))**: OCR de texto con ML Kit en el dispositivo (requiere *development build*) o un servicio en la nube (con costo por uso). Muestra coincidencias probables con su nivel de confianza y la opción de búsqueda manual.
- La lectura de una foto **nunca** se usa para afirmar una compatibilidad.

## 9. Monitoreo y analítica — decisión [D-09](07-decisiones-pendientes.md)

- Errores: Sentry (`@sentry/react-native` y `@sentry/nextjs`), con filtrado de datos personales.
- Analítica de producto (opcional): solo con consentimiento cuando corresponda.

## 10. Infraestructura y publicación

| Servicio | Uso | Requiere |
|---|---|---|
| Supabase | Backend (dev/staging/prod) | Proyecto dedicado por entorno ([D-01](07-decisiones-pendientes.md)) |
| EAS (Expo) | Compilación y envío a las tiendas | Cuenta de Expo, Apple Developer Program, Google Play Console ([D-11](07-decisiones-pendientes.md)) |
| Hosting web | Panel y tienda | Vercel u otro ([D-10](07-decisiones-pendientes.md)) y dominio |
| GitHub Actions | CI: lint, typecheck y pruebas | Repositorio actual |

## 11. Credenciales mínimas para avanzar (resumen)

| Para | Credencial | Dónde se configura |
|---|---|---|
| Pruebas con backend real | Proyecto Supabase de desarrollo: URL y clave publicable (anon) | `.env` local de cada app (no se versiona) |
| Despliegue de migraciones | Token de acceso de Supabase y *project ref* | Secretos de GitHub Actions |
| Pagos en integración | Credenciales de prueba oficiales del proveedor elegido | `supabase secrets set` |
| Correo | API key del proveedor y dominio verificado | Ajustes SMTP de Supabase Auth y secretos de la Edge Function |
| Push | Credenciales FCM y APNs | EAS credentials |
