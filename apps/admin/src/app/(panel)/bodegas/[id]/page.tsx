import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { NoPermission } from '@/components/no-permission';
import { Card, PageHeader } from '@/components/ui/layout';
import { WarehouseForm } from '@/components/warehouses/warehouse-form';
import { can } from '@/lib/auth/access';
import { requireStaff } from '@/lib/auth/dal';
import { getTerritory, getWarehouse } from '@/lib/data/inventory';
import { regionGroups } from '@/lib/data/territory-groups';

import { saveWarehouse } from '../actions';

export const metadata: Metadata = { title: 'Editar bodega' };

export default async function EditWarehousePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff();
  if (!can(ctx, 'warehouses.manage')) return <NoPermission section="la administración de bodegas" />;
  const { id } = await params;
  const [warehouse, territory] = await Promise.all([getWarehouse(ctx, id), getTerritory(ctx)]);
  if (!warehouse) notFound();
  return (
    <>
      <PageHeader back={<BackLink href="/bodegas">Bodegas</BackLink>} title={`Bodega ${warehouse.code}`} />
      <Card>
        <WarehouseForm action={saveWarehouse.bind(null, warehouse.id)} regions={regionGroups(territory)} warehouse={warehouse} submitLabel="Guardar cambios" />
      </Card>
    </>
  );
}
