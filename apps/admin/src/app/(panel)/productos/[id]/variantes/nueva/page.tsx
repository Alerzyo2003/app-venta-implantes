import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { VariantForm } from '@/components/catalog/variant-form';
import { NoPermission } from '@/components/no-permission';
import { Card, PageHeader } from '@/components/ui/layout';
import { can } from '@/lib/auth/access';
import { requireStaff } from '@/lib/auth/dal';
import { getProduct } from '@/lib/data/catalog';
import { variantFormContext } from '@/lib/data/variant-page';

import { saveVariant } from '../../../actions';

export const metadata: Metadata = { title: 'Nueva variante' };

export default async function NewVariantPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff();
  if (!can(ctx, 'catalog.create')) return <NoPermission section="la creación de variantes" />;
  const { id } = await params;
  const product = await getProduct(ctx, id);
  if (!product) notFound();
  const form = await variantFormContext(ctx, product);

  return (
    <>
      <PageHeader back={<BackLink href={`/productos/${product.id}`}>{product.name}</BackLink>} title="Nueva variante" />
      <Card>
        <VariantForm
          action={saveVariant.bind(null, product.id, null)}
          kind={product.product_kind}
          platforms={form.platforms}
          connectionTypes={form.connectionTypes}
          price={null}
          canEditPrice={can(ctx, 'prices.update')}
          ivaRateBp={form.ivaRateBp}
          taxClass={product.tax_class}
          submitLabel="Crear variante"
        />
      </Card>
    </>
  );
}
