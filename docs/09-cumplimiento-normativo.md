# Cumplimiento normativo (Chile) — consideraciones de diseño

Versión 0.1 — 2026-10-28.

> **Aviso**: este documento **no es asesoría legal** y **no declara cumplimiento** de ninguna norma. Enumera las materias que un asesor legal o regulatorio debe revisar ([D-14](07-decisiones-pendientes.md)) y explica cómo el diseño técnico facilita cumplirlas. Las referencias normativas deben confirmarse en su texto vigente.

## 1. Protección de datos personales

| Materia | Norma de referencia | Cómo lo apoya el diseño |
|---|---|---|
| Tratamiento de datos personales, finalidad y consentimiento | Ley 19.628 y **Ley 21.719**, que la reforma y crea la Agencia de Protección de Datos Personales. Su entrada en vigencia completa debe confirmarse; se espera para diciembre de 2026 | Consentimientos con versión y fecha (`consents`), finalidad declarada en la política de privacidad, minimización (no se almacenan datos de pacientes) |
| Derechos de los titulares (acceso, rectificación, supresión, oposición, portabilidad) | Ley 21.719 | Edición del perfil, eliminación de la cuenta desde la app y exportación de los datos propios (F7). Procedimiento documentado |
| Seguridad de los datos | Ley 21.719 | RLS, cifrado en tránsito (TLS) y en reposo (Supabase), MFA del personal, auditoría y respaldos |
| Transferencia internacional (servidores en Brasil u otro país) | Ley 21.719 | Elegir la región sa-east-1 e informarlo en la política de privacidad; revisar los requisitos de transferencia |
| Notificación de brechas | Ley 21.719 | Auditoría, logs y un procedimiento de respuesta a incidentes (por documentar antes de producción) |

**Conservación vs. eliminación**: al eliminar una cuenta se anonimizan los datos personales y se borra el acceso. Los pedidos y los documentos tributarios se conservan por el plazo que exige la normativa tributaria, desvinculados de la cuenta.

## 2. Consumidor y comercio electrónico

| Materia | Norma de referencia | Cómo lo apoya el diseño |
|---|---|---|
| Información de precios (precio total con impuestos para consumidores), condiciones y costos de despacho antes de pagar | Ley 19.496 (y sus modificaciones, incluida la Ley 21.398) | Modo boleta con precios brutos. Resumen con despacho e impuestos antes de confirmar |
| Derecho de retracto en compras a distancia, garantía legal, devoluciones | Ley 19.496 | Módulo de devoluciones (F6) con políticas configurables. Textos legales versionados |
| Comunicaciones promocionales: consentimiento y medio para desuscribirse | Ley 19.496 | Consentimiento por canal. Envíos promocionales solo con consentimiento vigente. Enlace de baja |
| Aplicabilidad B2B | Las compras de empresas pueden regirse por otras reglas (por ejemplo, la Ley 20.416 para las empresas de menor tamaño) | El tipo de documento (factura o boleta) y el tipo de cuenta permiten aplicar las políticas que correspondan |

## 3. Tributario (SII)

- Emisión de boleta o factura electrónica por cada venta, IVA del 19 % y conservación de los documentos.
- El sistema calcula el IVA según [ADR-0004](adr/0004-montos-clp-e-iva.md). **No emite DTE** hasta integrar un proveedor certificado ([D-04](07-decisiones-pendientes.md)).

## 4. Dispositivos médicos

- Los implantes dentales y varios insumos son **dispositivos médicos**. Su importación, distribución, almacenamiento, publicidad y venta pueden estar sujetos a control del **Instituto de Salud Pública (ISP)**: registro o control sanitario, rotulado, trazabilidad y restricciones de venta y publicidad al público general. Esto debe confirmarse con un asesor regulatorio para cada tipo de producto.
- El diseño ya contempla:
  - **Trazabilidad por lote y vencimiento**: qué pedidos recibieron cada lote, para responder a alertas o retiros de mercado.
  - **Restricción de venta a profesionales verificados**, configurable por producto.
  - **Condiciones de almacenamiento y documentación técnica** (fichas e instrucciones de uso) en la ficha de producto.
  - **Opiniones sin afirmaciones médicas** (moderación, F7).
  - **Sin recomendaciones clínicas**: las listas por procedimiento son listas de compra.

## 5. Tiendas de aplicaciones

| Requisito | Estado de diseño |
|---|---|
| Eliminación de la cuenta desde la app (Apple App Store Review Guidelines 5.1.1(v); política de Google Play con enlace web de eliminación) | Contemplado (CTA-12) |
| Etiquetas de privacidad (App Store) y sección de seguridad de los datos (Google Play) | Se completarán en F9 según los SDK usados |
| Venta de bienes físicos con pagos externos (no requiere compras dentro de la app) | Aplica: productos físicos |
| Cuenta de demostración para la revisión | Se preparará en F9 con datos marcados como de prueba |

## 6. Accesibilidad

- Buenas prácticas WCAG 2.2 AA (contraste, tamaños táctiles, etiquetas y texto dinámico). Considerar la Ley 20.422 sobre igualdad de oportunidades e inclusión de personas con discapacidad.

## 7. Ciberseguridad

- La Ley 21.663 (Ley Marco de Ciberseguridad) aplica principalmente a servicios esenciales y operadores de importancia vital. Debe evaluarse su aplicabilidad. Igualmente se adoptan sus buenas prácticas: gestión de incidentes, MFA, mínimo privilegio y registros.
