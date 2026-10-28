import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { VariantForm } from '@/components/catalog/variant-form';
import { NoPermission } from '@/components/no-permission';
import { Card, PageHeader } from '@/components/ui/layout';
import { can } from '@/lib/auth/access';
import { requireStaff } from '@/lib/auth/dal';
import { getBasePrices, getProduct, getVariant } from '@/lib/data/catalog';
import { variantFormContext } from '@/lib/data/variant-page';

import { saveVariant } from '../../../actions';

export const metadata: Metadata = { title: 'Editar variante' };

export default async function EditVariantPage({ params }: { params: Promise<{ id: string; variantId: string }> }) {
  const ctx = await requireStaff();
  if (!can(ctx, 'catalog.update')) return <NoPermission section="la edición de variantes" />;
  const { id, variantId } = await params;
  const product = await getProduct(ctx, id);
  if (!product) notFound();
  const variant = await getVariant(ctx, product.id, variantId);
  if (!variant) notFound();
  const [form, prices] = await Promise.all([variantFormContext(ctx, product), getBasePrices(ctx, [variant.id])]);

  return (
    <>
      <PageHeader
        back={<BackLink href={`/productos/${product.id}`}>{product.name}</BackLink>}
        title={`Variante ${variant.sku}`}
        actions={
          can(ctx, 'inventory.read') ? (
            <Link href={`/inventario/${variant.id}`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Ver inventario de esta variante
            </Link>
          ) : null
        }
      />
      <Card>
        <VariantForm
          action={saveVariant.bind(null, product.id, variant.id)}
          kind={product.product_kind}
          platforms={form.platforms}
          connectionTypes={form.connectionTypes}
          variant={variant}
          price={prices.get(variant.id) ?? null}
          canEditPrice={can(ctx, 'prices.update')}
          ivaRateBp={form.ivaRateBp}
          taxClass={product.tax_class}
          submitLabel="Guardar variante"
        />
      </Card>
    </>
  );
}
