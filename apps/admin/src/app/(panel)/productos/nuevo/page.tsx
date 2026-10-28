import type { Metadata } from 'next';

import { BackLink } from '@/components/back-link';
import { ProductForm } from '@/components/catalog/product-form';
import { NoPermission } from '@/components/no-permission';
import { Card, PageHeader } from '@/components/ui/layout';
import { can } from '@/lib/auth/access';
import { requireStaff } from '@/lib/auth/dal';
import { getCatalogReferences } from '@/lib/data/catalog';
import { productFormOptions } from '@/lib/data/catalog-options';

import { createProduct } from '../actions';

export const metadata: Metadata = { title: 'Nuevo producto' };

export default async function NewProductPage() {
  const ctx = await requireStaff();
  if (!can(ctx, 'catalog.create')) return <NoPermission section="la creación de productos" />;
  const refs = await getCatalogReferences(ctx);
  return (
    <>
      <PageHeader
        back={<BackLink href="/productos">Productos</BackLink>}
        title="Nuevo producto"
        description="Se crea como borrador. Después agrega sus variantes (medidas o presentaciones) y publícalo."
      />
      <Card>
        <ProductForm action={createProduct} options={productFormOptions(refs)} submitLabel="Crear producto" />
      </Card>
    </>
  );
}
