import { formatCalendarDate } from '@repo/domain';
import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { StockBadge } from '@/components/inventory/stock-badge';
import { NoPermission } from '@/components/no-permission';
import { buttonClasses } from '@/components/ui/button';
import { controlClasses } from '@/components/ui/field';
import { Badge, EmptyState } from '@/components/ui/feedback';
import { PageHeader, TableWrap, td, th } from '@/components/ui/layout';
import { Pagination } from '@/components/ui/pagination';
import { can } from '@/lib/auth/access';
import { requireStaff } from '@/lib/auth/dal';
import { isUuid } from '@/lib/data/catalog';
import { getWarehouses, inventoryOverview } from '@/lib/data/inventory';
import { firstParam, listHref, parsePage } from '@/lib/pagination';

export const metadata: Metadata = { title: 'Inventario' };

const PAGE_SIZE = 25;
const nf = new Intl.NumberFormat('es-CL');

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!can(ctx, 'inventory.read')) return <NoPermission section="Inventario" />;

  const params = await searchParams;
  const query = firstParam(params.q).slice(0, 100);
  const warehouseParam = firstParam(params.bodega);
  const warehouseId = isUuid(warehouseParam) ? warehouseParam : null;
  const alertsOnly = firstParam(params.alertas) === '1';
  const page = parsePage(firstParam(params.pagina));

  const [{ rows, total }, warehouses] = await Promise.all([
    inventoryOverview(ctx, { query, warehouseId, alertsOnly, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    getWarehouses(ctx),
  ]);
  const filters = { q: query, bodega: warehouseId, alertas: alertsOnly ? '1' : null };
  const hasFilters = Boolean(query || warehouseId || alertsOnly);

  return (
    <>
      <PageHeader
        title="Inventario"
        description="Disponible = stock vendible (lotes disponibles y vigentes en bodegas de venta) menos lo reservado y comprometido en pedidos."
        actions={
          <Link href="/inventario/movimientos" className={buttonClasses('outline')}>
            Libro de movimientos
          </Link>
        }
      />

      <form action="/inventario" method="get" role="search" className="grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-[1fr_14rem_auto_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">Buscar</label>
          <input id="q" name="q" type="search" defaultValue={query} placeholder="Producto o SKU" className={controlClasses} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bodega" className="text-sm font-medium">Bodega</label>
          <select id="bodega" name="bodega" defaultValue={warehouseId ?? ''} className={controlClasses}>
            <option value="">Todas</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.code} · {w.name}{w.is_active ? '' : ' (inactiva)'}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium sm:pb-2.5">
          <input type="checkbox" name="alertas" value="1" defaultChecked={alertsOnly} className="size-4 accent-primary" />
          Solo con alertas
        </label>
        <div className="flex gap-2">
          <button type="submit" className={buttonClasses('primary')}>
            <Search aria-hidden className="size-4" /> Filtrar
          </button>
          {hasFilters ? <Link href="/inventario" className={buttonClasses('ghost')}>Limpiar</Link> : null}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={hasFilters ? 'Sin resultados' : 'Aún no hay variantes en el catálogo'}>
          {hasFilters
            ? alertsOnly
              ? 'No hay variantes publicadas con stock bajo o agotado.'
              : 'No hay variantes que coincidan con la búsqueda.'
            : 'El inventario se lleva por variante: crea productos y variantes, y luego registra sus ingresos.'}
        </EmptyState>
      ) : (
        <TableWrap caption="Inventario por variante">
          <thead>
            <tr>
              <th scope="col" className={th}>Producto</th>
              <th scope="col" className={th}>SKU</th>
              <th scope="col" className={`${th} text-right`}>Disponible</th>
              <th scope="col" className={`${th} text-right`}>En bodega</th>
              <th scope="col" className={`${th} text-right`}>Reservado</th>
              <th scope="col" className={`${th} text-right`}>Comprometido</th>
              <th scope="col" className={th}>Próx. vencimiento</th>
              <th scope="col" className={th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const onSale = r.product_status === 'published' && r.variant_status === 'active';
              return (
                <tr key={r.variant_id} className="hover:bg-subtle/60">
                  <td className={td}>
                    <Link href={`/inventario/${r.variant_id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                      {r.product_name}
                    </Link>
                    {r.variant_label ? <p className="text-xs text-fg-muted">{r.variant_label}</p> : null}
                  </td>
                  <td className={`${td} font-mono text-xs`}>{r.sku}</td>
                  <td className={`${td} text-right font-semibold tabular-nums`}>{nf.format(r.available)}</td>
                  <td className={`${td} text-right tabular-nums`}>{nf.format(r.on_hand)}</td>
                  <td className={`${td} text-right tabular-nums`}>{nf.format(r.reserved)}</td>
                  <td className={`${td} text-right tabular-nums`}>{nf.format(r.committed)}</td>
                  <td className={`${td} whitespace-nowrap`}>{r.next_expiry ? formatCalendarDate(r.next_expiry) : '—'}</td>
                  <td className={td}>{onSale ? <StockBadge status={r.stock_status} /> : <Badge>No a la venta</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(n) => listHref('/inventario', { ...filters, pagina: n })} />
    </>
  );
}
