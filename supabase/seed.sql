-- Semilla SOLO para desarrollo local (`supabase db reset`). No se ejecuta en producción.
--
-- Intencionalmente vacía: los datos de referencia (roles, permisos, categorías, regiones y
-- comunas, configuración) viven en las migraciones porque también se necesitan en producción.
-- No se cargan productos, precios, stock, pedidos ni clientes ficticios (principio P-01):
-- el catálogo real se carga desde el panel o con la importación de plantillas (CAT-09).
select 1;
