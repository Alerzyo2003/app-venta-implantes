# ADR-0001 · Monorepo con pnpm workspaces

- **Estado**: Aceptada — 2026-10-28

## Contexto
Tres clientes (app móvil, panel y tienda) comparten reglas de presentación, validaciones, tipos de base de datos e identidad visual. La especificación pide evitar las dependencias innecesarias.

## Decisión
Un monorepo con **pnpm workspaces** y `node-linker=hoisted`. Metro (React Native) resuelve mejor un `node_modules` plano, y es la configuración documentada por Expo para pnpm. Paquetes internos con el prefijo `@repo/*`. Sin Turborepo ni Nx por ahora: los scripts de pnpm (`pnpm -r`, `--filter`) bastan.

## Alternativas
- Repositorios separados: duplicación de tipos y reglas, y versiones desalineadas.
- Turborepo o Nx: caché de tareas útil a mayor escala. Se puede agregar más adelante sin reestructurar.

## Consecuencias
- Un solo `pnpm install`. Las versiones compartidas se controlan en un solo lugar.
- Las dependencias nativas de Expo se instalan con `npx expo install` para mantener la compatibilidad con el SDK.
