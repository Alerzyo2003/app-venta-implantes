import { dimensionsLabel, formatCLP, formatDateTime, PRODUCT_KINDS, productKindHasField } from '@repo/domain';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { ProductForm } from '@/components/catalog/product-form';
import { ProductStatusActions, type StatusTransition } from '@/components/catalog/product-status-actions';
import { ProductStatusBadge, VariantStatusBadge } from '@/components/catalog/status-badges';
import { NoPermission } from '@/components/no-permission';
import { LinkButton } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { Card, CardTitle, PageHeader, TableWrap, td, th } from '@/components/ui/layout';
import { can } from '@/lib/auth/access';
import { requireStaff, type StaffContext } from '@/lib/auth/dal';
import { getBasePrices, getCatalogReferences, getProduct, getVariants, type ProductDetail } from '@/lib/data/catalog';
import { productFormOptions } from '@/lib/data/catalog-options';
import type { FormState } from '@/lib/forms';
import { TAX_CLASS_LABELS } from '@/lib/schemas/product';

import { setProductStatus, updateProduct } from '../actions';

export const metadata: Metadata = { title: 'Producto' };

function transitionsFor(ctx: StaffContext, product: ProductDetail, hasActiveVariant: boolean): StatusTransition[] {
  const out: StatusTransition[] = [];
  const { status } = product;
  if (status === 'draft' && can(ctx, 'catalog.publish') && hasActiveVariant) {
    out.push({ to: 'published', label: 'Publicar', variant: 'primary' });
  }
  if (status === 'published' && can(ctx, 'catalog.update')) {
    out.push({
      to: 'draft',
      label: 'Pasar a borrador',
      variant: 'outline',
      confirm: 'El producto dejará de mostrarse a los clientes. ¿Continuar?',
    });
  }
  if (status === 'archived' && can(ctx, 'catalog.delete')) {
    out.push({ to: 'draft', label: 'Restaurar como borrador', variant: 'outline' });
  }
  if (status !== 'archived' && can(ctx, 'catalog.delete')) {
    out.push({
      to: 'archived',
      label: 'Archivar',
      variant: 'danger',
      confirm: 'El producto se retirará del catálogo y de los listados. ¿Archivarlo?',
    });
  }
  return out;
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireStaff();
  if (!can(ctx, 'catalog.read')) return <NoPermission section="Productos" />;
  const { id } = await params;
  const query = await searchParams;

  const product = await getProduct(ctx, id);
  if (!product) notFound();
  const [variants, refs] = await Promise.all([getVariants(ctx, id), getCatalogReferences(ctx)]);
  const prices = await getBasePrices(ctx, variants.map((v) => v.id));

  const kind = PRODUCT_KINDS[product.product_kind];
  const hasActiveVariant = variants.some((v) => v.status === 'active');
  const transitions = transitionsFor(ctx, product, hasActiveVariant);
  const actionFor: Record<string, (prev: FormState) => Promise<FormState>> = {};
  for (const t of transitions) actionFor[t.to] = setProductStatus.bind(null, product.id, t.to);

  const category = refs.categories.find((c) => c.id === product.category_id)?.name ?? '—';
  const platformName = (pid: string | null) => {
    const p = refs.platforms.find((x) => x.id === pid);
    return p ? `${p.code} · ${p.name}` : '—';
  };
  const connectionName = (cid: string | null) => refs.connectionTypes.find((x) => x.id === cid)?.name ?? '—';
  const showDims = productKindHasField(product.product_kind, 'diameterMm') || productKindHasField(product.product_kind, 'lengthMm');
  const showPlatform = productKindHasField(product.product_kind, 'platform');
  const showPrices = can(ctx, 'prices.read');

  return (
    <>
      <PageHeader
        back={<BackLink href="/productos">Productos</BackLink>}
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ProductStatusBadge status={product.status} />
            <span>
              {kind.label} · {category}
            </span>
          </span>
        }
      />

      {query.creado === '1' ? (
        <Alert tone="success" title="Producto creado como borrador">
          Agrega al menos una variante activa para poder publicarlo.
        </Alert>
      ) : null}
      {query.estado === 'published' ? (
        <Alert tone="success">Producto publicado: ya es visible en la tienda y la app.</Alert>
      ) : null}
      {query.estado === 'draft' ? (
        <Alert tone="success">El producto quedó como borrador y no se muestra a los clientes.</Alert>
      ) : null}
      {query.estado === 'archived' ? <Alert tone="success">Producto archivado.</Alert> : null}
      {query.variante === 'creada' ? <Alert tone="success">Variante creada.</Alert> : null}
      {query.variante === 'actualizada' ? <Alert tone="success">Variante actualizada.</Alert> : null}
      {product.status === 'published' && !hasActiveVariant ? (
        <Alert tone="warning" title="Publicado sin variantes activas">
          Los clientes ven el producto pero no pueden comprarlo. Activa una variante o pásalo a borrador.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card>
          <CardTitle>Datos del producto</CardTitle>
          {can(ctx, 'catalog.update') ? (
            <ProductForm
              action={updateProduct.bind(null, product.id)}
              options={productFormOptions(refs)}
              product={product}
              submitLabel="Guardar cambios"
            />
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-fg-muted">Dirección web</dt><dd>{product.slug}</dd></div>
              <div><dt className="text-fg-muted">Tributación</dt><dd>{TAX_CLASS_LABELS[product.tax_class]}</dd></div>
              <div className="sm:col-span-2"><dt className="text-fg-muted">Descripción breve</dt><dd>{product.short_description ?? '—'}</dd></div>
              <div><dt className="text-fg-muted">Controla lotes</dt><dd>{product.tracks_lots ? 'Sí' : 'No'}</dd></div>
              <div><dt className="text-fg-muted">Controla vencimiento</dt><dd>{product.tracks_expiry ? 'Sí' : 'No'}</dd></div>
              <div><dt className="text-fg-muted">Solo profesionales</dt><dd>{product.requires_professional ? 'Sí' : 'No'}</dd></div>
            </dl>
          )}
        </Card>

        {/* En móvil, el estado y sus acciones van antes del formulario largo. */}
        <div className="order-first flex flex-col gap-6 lg:order-none">
          <Card>
            <CardTitle>Publicación</CardTitle>
            <dl className="mb-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-fg-muted">Estado</dt><dd><ProductStatusBadge status={product.status} /></dd></div>
              <div className="flex justify-between gap-2"><dt className="text-fg-muted">Publicado</dt><dd>{product.published_at ? formatDateTime(product.published_at, { withTime: true }) : '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-fg-muted">Creado</dt><dd>{formatDateTime(product.created_at, { withTime: true })}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-fg-muted">Actualizado</dt><dd>{formatDateTime(product.updated_at, { withTime: true })}</dd></div>
            </dl>
            {product.status === 'draft' && !hasActiveVariant && can(ctx, 'catalog.publish') ? (
              <p className="mb-3 text-xs text-fg-muted">Para publicar, agrega al menos una variante activa.</p>
            ) : null}
            <ProductStatusActions transitions={transitions} actionFor={actionFor} />
          </Card>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-fg">Variantes</h2>
          {can(ctx, 'catalog.create') ? (
            <LinkButton href={`/productos/${product.id}/variantes/nueva`} variant="outline" size="sm">
              <Plus aria-hidden className="size-4" /> Agregar variante
            </LinkButton>
          ) : null}
        </div>
        {variants.length === 0 ? (
          <EmptyState title="Sin variantes">
            Cada variante es una medida o presentación que se vende (con su SKU, precio y stock).
          </EmptyState>
        ) : (
          <TableWrap caption="Variantes del producto">
            <thead>
              <tr>
                <th scope="col" className={th}>SKU</th>
                <th scope="col" className={th}>Variante</th>
                {showDims ? <th scope="col" className={th}>Medidas</th> : null}
                {showPlatform ? <th scope="col" className={th}>Plataforma</th> : null}
                {showPlatform ? <th scope="col" className={th}>Conexión</th> : null}
                <th scope="col" className={th}>GTIN</th>
                {showPrices ? <th scope="col" className={`${th} text-right`}>Precio neto</th> : null}
                <th scope="col" className={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className="hover:bg-subtle/60">
                  <td className={`${td} font-mono text-xs`}>
                    {can(ctx, 'catalog.update') ? (
                      <Link href={`/productos/${product.id}/variantes/${v.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                        {v.sku}
                      </Link>
                    ) : (
                      v.sku
                    )}
                    {v.manufacturer_ref ? <p className="text-fg-muted">Ref. {v.manufacturer_ref}</p> : null}
                  </td>
                  <td className={td}>{v.label ?? '—'}</td>
                  {showDims ? <td className={`${td} whitespace-nowrap`}>{dimensionsLabel({ diameterMm: v.diameter_mm, lengthMm: v.length_mm }) ?? '—'}</td> : null}
                  {showPlatform ? <td className={td}>{platformName(v.platform_id)}</td> : null}
                  {showPlatform ? <td className={td}>{connectionName(v.connection_type_id)}</td> : null}
                  <td className={`${td} font-mono text-xs`}>{v.gtin ?? '—'}</td>
                  {showPrices ? (
                    <td className={`${td} text-right tabular-nums`}>
                      {prices.has(v.id) ? formatCLP(prices.get(v.id)!) : <span className="text-warning">Sin precio</span>}
                    </td>
                  ) : null}
                  <td className={td}><VariantStatusBadge status={v.status} /></td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        {showPrices && variants.some((v) => !prices.has(v.id)) ? (
          <p className="text-xs text-fg-muted">Las variantes sin precio no se pueden agregar al carrito.</p>
        ) : null}
      </section>
    </>
  );
}
