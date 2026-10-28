# ADR-0002 · Supabase como backend

- **Estado**: Aceptada (falta crear el proyecto: D-01) — 2026-10-28

## Contexto
La especificación propone Supabase «sujeto a validación técnica». Se necesita PostgreSQL transaccional, autenticación con verificación de correo y MFA, autorización por filas, almacenamiento de archivos y funciones de servidor con secretos.

## Decisión
Usar Supabase (PostgreSQL, Auth, PostgREST, Storage, Edge Functions y pg_cron), un proyecto por entorno, en la región sa-east-1. Validación y comparación con alternativas en [01-arquitectura.md §2.1](../01-arquitectura.md#21-supabase-como-backend).

## Consecuencias
- Toda la autorización de datos se expresa en RLS y se prueba.
- La portabilidad está asegurada por usar SQL estándar en migraciones versionadas.
- Se depende de los límites del plan contratado (conexiones, Edge Functions, almacenamiento). Se revisarán antes de producción.
