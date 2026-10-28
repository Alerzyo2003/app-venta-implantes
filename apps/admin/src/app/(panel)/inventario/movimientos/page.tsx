import type { Metadata } from 'next';
import Link from 'next/link';

import { BackLink } from '@/components/back-link';
import { MovementsTable } from '@/components/inventory/movements-table';
import { NoPermission } from '@/components/no-permission';
import { buttonClasses } from '@/components/ui/button';
import { controlClasses } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/layout';
import { Pagination } from '@/components/ui/pagination';
import { can } from '@/lib/auth/access';
import { requireStaff } from '@/lib/auth/dal';
import { isUuid } from '@/lib/data/catalog';
import { getMovements, getWarehouses } from '@/lib/data/inventory';
import { firstParam, listHref, parsePage } from '@/lib/pagination';

export const metadata: Metadata = { title: 'Movimientos de inventario' };

const PAGE_SIZE = 50;

export default async function MovementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!can(ctx, 'inventory.read')) return <NoPermission section="Inventario" />;

  const params = await searchParams;
  const warehouseParam = firstParam(params.bodega);
  const warehouseId = isUuid(warehouseParam) ? warehouseParam : null;
  const variantParam = firstParam(params.variante);
  const variantId = isUuid(variantParam) ? variantParam : null;
  const page = parsePage(firstParam(params.pagina));

  const [{ rows, total }, warehouses] = await Promise.all([
    getMovements(ctx, { variantId, warehouseId, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    getWarehouses(ctx),
  ]);
  const filters = { bodega: warehouseId, variante: variantId };

  return (
    <>
      <PageHeader
        back={<BackLink href="/inventario">Inventario</BackLink>}
        title="Libro de movimientos"
        description="Registro inmutable de ingresos, ajustes y despachos: no se edita ni se borra."
      />
      <form action="/inventario/movimientos" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-4">
        {variantId ? <input type="hidden" name="variante" value={variantId} /> : null}
        <div className="flex min-w-56 flex-col gap-1.5">
          <label htmlFor="bodega" className="text-sm font-medium">Bodega</label>
          <select id="bodega" name="bodega" defaultValue={warehouseId ?? ''} className={controlClasses}>
            <option value="">Todas</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.code} · {w.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClasses('primary')}>Filtrar</button>
        {warehouseId || variantId ? (
          <Link href="/inventario/movimientos" className={buttonClasses('ghost')}>
            {variantId ? 'Ver todas las variantes' : 'Limpiar'}
          </Link>
        ) : null}
      </form>
      {rows.length === 0 ? (
        <EmptyState title="Sin movimientos">Aquí aparecerán los ingresos, ajustes y despachos registrados.</EmptyState>
      ) : (
        <MovementsTable rows={rows} showProduct />
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(n) => listHref('/inventario/movimientos', { ...filters, pagina: n })} />
    </>
  );
}
