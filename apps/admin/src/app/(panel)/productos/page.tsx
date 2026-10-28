import { formatDateTime, PRODUCT_KINDS } from '@repo/domain';
import { Plus, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ProductStatusBadge } from '@/components/catalog/status-badges';
import { NoPermission } from '@/components/no-permission';
import { buttonClasses, LinkButton } from '@/components/ui/button';
import { controlClasses } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/feedback';
import { PageHeader, TableWrap, td, th } from '@/components/ui/layout';
import { Pagination } from '@/components/ui/pagination';
import { can } from '@/lib/auth/access';
import { requireStaff } from '@/lib/auth/dal';
import { getCategories, isUuid, searchProducts } from '@/lib/data/catalog';
import { categoryOptions } from '@/lib/options';
import { firstParam, listHref, parsePage } from '@/lib/pagination';
import { PRODUCT_STATUS_LABELS, PRODUCT_STATUSES, type ProductStatus } from '@/lib/schemas/product';

export const metadata: Metadata = { title: 'Productos' };

const PAGE_SIZE = 25;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!can(ctx, 'catalog.read')) return <NoPermission section="Productos" />;

  const params = await searchParams;
  const query = firstParam(params.q).slice(0, 100);
  const statusParam = firstParam(params.estado);
  const status = (PRODUCT_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as ProductStatus) : null;
  const categoryParam = firstParam(params.categoria);
  const categoryId = isUuid(categoryParam) ? categoryParam : null;
  const page = parsePage(firstParam(params.pagina));

  const [{ rows, total }, categories] = await Promise.all([
    searchProducts(ctx, { query, status, categoryId, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    getCategories(ctx),
  ]);
  const filters = { q: query, estado: status, categoria: categoryId };
  const hasFilters = Boolean(query || status || categoryId);

  return (
    <>
      <PageHeader
        title="Productos"
        description="Catálogo completo, incluidos borradores y archivados. Busca por nombre, marca, SKU, código del fabricante o GTIN."
        actions={
          can(ctx, 'catalog.create') ? (
            <LinkButton href="/productos/nuevo">
              <Plus aria-hidden className="size-4" /> Nuevo producto
            </LinkButton>
          ) : null
        }
      />

      <form action="/productos" method="get" role="search" className="grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-[1fr_12rem_14rem_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">Buscar</label>
          <input id="q" name="q" type="search" defaultValue={query} placeholder="Nombre, marca, SKU o GTIN" className={controlClasses} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="estado" className="text-sm font-medium">Estado</label>
          <select id="estado" name="estado" defaultValue={status ?? ''} className={controlClasses}>
            <option value="">Todos</option>
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>{PRODUCT_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="categoria" className="text-sm font-medium">Categoría</label>
          <select id="categoria" name="categoria" defaultValue={categoryId ?? ''} className={controlClasses}>
            <option value="">Todas</option>
            {categoryOptions(categories).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={buttonClasses('primary')}>
            <Search aria-hidden className="size-4" /> Buscar
          </button>
          {hasFilters ? (
            <Link href="/productos" className={buttonClasses('ghost')}>Limpiar</Link>
          ) : null}
        </div>
      </form>

      {rows.length === 0 ? (
        hasFilters || page > 1 ? (
          <EmptyState title="Sin resultados">
            No hay productos que coincidan con la búsqueda. <Link className="font-medium text-primary underline" href="/productos">Ver todos</Link>
          </EmptyState>
        ) : (
          <EmptyState
            title="Aún no hay productos"
            action={can(ctx, 'catalog.create') ? <LinkButton href="/productos/nuevo">Crear el primer producto</LinkButton> : undefined}>
            Los productos se crean como borrador; se publican cuando tienen al menos una variante activa.
          </EmptyState>
        )
      ) : (
        <>
          <TableWrap caption="Productos del catálogo">
            <thead>
              <tr>
                <th scope="col" className={th}>Producto</th>
                <th scope="col" className={th}>Tipo</th>
                <th scope="col" className={th}>Categoría</th>
                <th scope="col" className={th}>Marca</th>
                <th scope="col" className={`${th} text-right`}>Variantes</th>
                <th scope="col" className={th}>Estado</th>
                <th scope="col" className={th}>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-subtle/60">
                  <td className={td}>
                    <Link href={`/productos/${p.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-xs text-fg-muted">{p.slug}</p>
                  </td>
                  <td className={td}>{PRODUCT_KINDS[p.product_kind]?.label ?? p.product_kind}</td>
                  <td className={td}>{p.category_name}</td>
                  <td className={td}>{p.brand_name ?? '—'}</td>
                  <td className={`${td} text-right tabular-nums`}>
                    {p.active_variant_count} / {p.variant_count}
                  </td>
                  <td className={td}><ProductStatusBadge status={p.status} /></td>
                  <td className={`${td} whitespace-nowrap text-fg-muted`}>{formatDateTime(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <p className="text-xs text-fg-muted">Variantes: activas / total.</p>
        </>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(n) => listHref('/productos', { ...filters, pagina: n })} />
    </>
  );
}
