# Plataforma de venta de implantes dentales e insumos odontológicos

Plataforma de comercio electrónico B2B/B2C para Chile: app móvil (iOS/Android), panel administrativo, tienda web sincronizada y backend central en Supabase.

> **Nombre comercial pendiente.** La identidad visual es temporal y se configura en [`packages/brand`](packages/brand).

## Estado

Fase 1 (análisis y arquitectura) terminada. Cimientos (incremento 0) en desarrollo. El detalle está en [`docs/08-estado-de-avance.md`](docs/08-estado-de-avance.md).

**Ninguna integración externa (pagos, facturación, despacho, correo, push, WhatsApp Business) está operativa todavía.** Ver las [decisiones pendientes](docs/07-decisiones-pendientes.md).

## Documentación

| Documento | Contenido |
|---|---|
| [00 Documento maestro de requisitos](docs/00-documento-maestro-requisitos.md) | Requisitos con identificador, prioridad y criterios de aceptación |
| [01 Arquitectura](docs/01-arquitectura.md) | Componentes, justificación, ventajas y limitaciones, entornos, seguridad |
| [02 Modelo de datos](docs/02-modelo-de-datos.md) | Tablas, relaciones, máquinas de estado y definiciones de stock |
| [03 Mapa de pantallas](docs/03-mapa-de-pantallas.md) | App, tienda y panel; lineamientos de UX |
| [04 Matriz de permisos](docs/04-matriz-de-permisos.md) | Roles, permisos y capas de aplicación |
| [05 Integraciones](docs/05-integraciones.md) | Pagos, DTE, despacho, correo, push, WhatsApp y OCR |
| [06 Plan de implementación](docs/06-plan-de-implementacion.md) | MVP, incrementos, fases y estrategia de pruebas |
| [07 Decisiones pendientes](docs/07-decisiones-pendientes.md) | Decisiones que requieren aprobación, con recomendación |
| [08 Estado de avance](docs/08-estado-de-avance.md) | Funciones terminadas, en desarrollo, pendientes y probadas |
| [09 Cumplimiento normativo](docs/09-cumplimiento-normativo.md) | Materias legales y regulatorias a revisar |
| [10 Pruebas](docs/10-pruebas.md) | Cómo ejecutar las pruebas y registro de resultados |
| [ADR](docs/adr/) | Decisiones de arquitectura |

## Estructura

```
apps/mobile      App Expo (iOS/Android)
apps/admin       Panel administrativo (Next.js)
packages/brand   Identidad visual temporal
packages/domain  Lógica de negocio compartida y probada
supabase/        Migraciones, semilla, pruebas de base de datos
tools/local-db   Base de datos local de pruebas (sin Docker)
docs/            Documentación viva
```

## Requisitos de desarrollo

- Node.js 22 (ver `.nvmrc`) y pnpm 10.
- PostgreSQL 16 o superior en el PATH (para las pruebas de base de datos sin Docker), **o** Docker con la [Supabase CLI](https://supabase.com/docs/guides/local-development).

Las instrucciones de instalación y ejecución por aplicación están en [`docs/10-pruebas.md`](docs/10-pruebas.md) y en el README de cada app.
