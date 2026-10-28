# ADR-0005 · Compatibilidad explícita con evidencia

- **Estado**: Aceptada — 2026-10-28

## Contexto
Una compatibilidad errónea entre un implante y un componente tiene consecuencias clínicas y comerciales. La especificación prohíbe inferirla por similitud.

## Decisión
- Tabla `compatibility_links`. El lado del implante puede ser una variante, un producto o una plataforma; el lado del componente, un producto o una variante. Estados: `pending`, `verified`, `rejected` y `retired`.
- Un `CHECK` exige `evidence_document_id` o `evidence_reference`, `verified_at` y `verified_by` para pasar a `verified`. Verificar requiere el permiso `compatibility.verify`. Los cambios se auditan.
- Los clientes solo ven los vínculos `verified`. Sin un vínculo verificado, la respuesta es «pendiente de verificación».
- Las **alternativas comerciales** (`product_alternatives`) son una tabla distinta y nunca se presentan como compatibilidad.

## Consecuencias
- Cargar las compatibilidades requiere trabajo del equipo técnico-comercial, con fuentes del fabricante.
- Los vínculos a nivel de plataforma reducen la carga sin inferir nada: son una afirmación explícita y documentada («el pilar X es compatible con la plataforma P del sistema S»).
