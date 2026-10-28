import type { Metadata } from 'next';
import Link from 'next/link';

import { NoPermission } from '@/components/no-permission';
import { Alert, Badge, EmptyState } from '@/components/ui/feedback';
import { Card, CardTitle, PageHeader, TableWrap, td, th } from '@/components/ui/layout';
import { WarehouseForm } from '@/components/warehouses/warehouse-form';
import { can } from '@/lib/auth/access';
import { requireStaff } from '@/lib/auth/dal';
import { getTerritory, getWarehouses } from '@/lib/data/inventory';
import { regionGroups } from '@/lib/data/territory-groups';

import { saveWarehouse } from './actions';

export const metadata: Metadata = { title: 'Bodegas' };

export default async function WarehousesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaff();
  if (!can(ctx, 'inventory.read')) return <NoPermission section="Bodegas" />;
  const params = await searchParams;
  const canManage = can(ctx, 'warehouses.manage');
  const [warehouses, territory] = await Promise.all([getWarehouses(ctx), canManage ? getTerritory(ctx) : Promise.resolve(null)]);

  return (
    <>
      <PageHeader title="Bodegas" description="Lugares donde se guarda el stock. Las bodegas vendibles y activas abastecen las ventas." />
      {params.creada === '1' ? <Alert tone="success">Bodega creada.</Alert> : null}

      {warehouses.length === 0 ? (
        <EmptyState title="Aún no hay bodegas">Crea la primera bodega para registrar ingresos de mercadería.</EmptyState>
      ) : (
        <TableWrap caption="Bodegas">
          <thead>
            <tr>
              <th scope="col" className={th}>Código</th>
              <th scope="col" className={th}>Nombre</th>
              <th scope="col" className={th}>Ubicación</th>
              <th scope="col" className={`${th} text-right`}>Prioridad</th>
              <th scope="col" className={th}>Uso</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((w) => (
              <tr key={w.id} className="hover:bg-subtle/60">
                <td className={`${td} font-mono text-xs`}>
                  {canManage ? (
                    <Link href={`/bodegas/${w.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">{w.code}</Link>
                  ) : (
                    w.code
                  )}
                </td>
                <td className={td}>{w.name}</td>
                <td className={td}>{[w.address_line, w.comuna?.name].filter(Boolean).join(', ') || '—'}</td>
                <td className={`${td} text-right tabular-nums`}>{w.priority}</td>
                <td className={td}>
                  <span className="flex flex-wrap gap-1">
                    {w.is_active ? <Badge tone="success">Activa</Badge> : <Badge>Inactiva</Badge>}
                    {w.is_sellable ? <Badge tone="info">Vendible</Badge> : <Badge tone="warning">No vendible</Badge>}
                    {w.is_pickup_point ? <Badge tone="accent">Punto de retiro</Badge> : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      {canManage && territory ? (
        <Card>
          <CardTitle>Nueva bodega</CardTitle>
          <WarehouseForm action={saveWarehouse.bind(null, null)} regions={regionGroups(territory)} submitLabel="Crear bodega" />
        </Card>
      ) : null}
    </>
  );
}
