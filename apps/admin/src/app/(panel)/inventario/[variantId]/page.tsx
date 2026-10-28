import { randomUUID } from 'node:crypto';

import { formatCalendarDate, formatDateTime } from '@repo/domain';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { ProductStatusBadge } from '@/components/catalog/status-badges';
import { MovementsTable } from '@/components/inventory/movements-table';
import { LotStatusBadge } from '@/components/inventory/stock-badge';
import { AdjustForm, LotStatusForm, ReceiveForm } from '@/components/inventory/stock-forms';
import { NoPermission } from '@/components/no-permission';
import { Alert, Badge, EmptyState } from '@/components/ui/feedback';
import { Card, CardTitle, PageHeader, TableWrap, td, th } from '@/components/ui/layout';
import { can } from '@/lib/auth/access';
import { requireStaff } from '@/lib/auth/dal';
import { getMovements, getVariantInventory, getWarehouses } from '@/lib/data/inventory';
import { listHref } from '@/lib/pagination';

import { adjustStock, changeLotStatus, receiveStock } from '../actions';

export const metadata: Metadata = { title: 'Inventario de variante' };

const nf = new Intl.NumberFormat('es-CL');

function todayInChile(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
}

export default async function VariantInventoryPage({ params }: { params: Promise<{ variantId: string }> }) {
  const ctx = await requireStaff();
  if (!can(ctx, 'inventory.read')) return <NoPermission section="Inventario" />;
  const { variantId } = await params;

  const data = await getVariantInventory(ctx, variantId);
  if (!data) notFound();
  const [warehouses, movements] = await Promise.all([
    getWarehouses(ctx),
    getMovements(ctx, { variantId, warehouseId: null, limit: 15, offset: 0 }),
  ]);
  const { variant, balances, lots } = data;
  const product = variant.product;
  const today = todayInChile();

  const activeWarehouses = warehouses
    .filter((w) => w.is_active)
    .map((w) => ({ value: w.id, label: `${w.code} · ${w.name}${w.is_sellable ? '' : ' (no vendible)'}` }));
  const warehouseCode = (id: string) => warehouses.find((w) => w.id === id)?.code ?? '—';
  const lotOptions = product.tracks_lots
    ? lots.map((l) => ({
        value: l.id,
        label: `${l.lot_number}${l.expiry_date ? ` · vence ${formatCalendarDate(l.expiry_date)}` : ''}`,
      }))
    : null;
  const totals = balances.reduce(
    (acc, b) => ({ onHand: acc.onHand + b.on_hand, reserved: acc.reserved + b.reserved, committed: acc.committed + b.committed }),
    { onHand: 0, reserved: 0, committed: 0 },
  );

  return (
    <>
      <PageHeader
        back={<BackLink href="/inventario">Inventario</BackLink>}
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{variant.sku}</span>
            {variant.label ? <span>· {variant.label}</span> : null}
            <ProductStatusBadge status={product.status} />
            {product.tracks_lots ? <Badge tone="info">Con lote{product.tracks_expiry ? ' y vencimiento' : ''}</Badge> : null}
          </span>
        }
        actions={
          can(ctx, 'catalog.read') ? (
            <Link href={`/productos/${product.id}`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Ver ficha del producto
            </Link>
          ) : null
        }
      />

      <Card>
        <CardTitle>Saldos por bodega</CardTitle>
        {balances.length === 0 ? (
          <p className="text-sm text-fg-muted">Sin movimientos: esta variante aún no tiene stock registrado.</p>
        ) : (
          <TableWrap caption="Saldos por bodega">
            <thead>
              <tr>
                <th scope="col" className={th}>Bodega</th>
                <th scope="col" className={`${th} text-right`}>En bodega</th>
                <th scope="col" className={`${th} text-right`}>Reservado</th>
                <th scope="col" className={`${th} text-right`}>Comprometido</th>
                <th scope="col" className={th}>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.warehouse_id}>
                  <td className={td}>
                    {b.warehouse.code} · {b.warehouse.name}
                    {!b.warehouse.is_sellable ? <span className="text-xs text-fg-muted"> (no vendible)</span> : null}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{nf.format(b.on_hand)}</td>
                  <td className={`${td} text-right tabular-nums`}>{nf.format(b.reserved)}</td>
                  <td className={`${td} text-right tabular-nums`}>{nf.format(b.committed)}</td>
                  <td className={`${td} whitespace-nowrap text-fg-muted`}>{formatDateTime(b.updated_at, { withTime: true })}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={td}>Total</td>
                <td className={`${td} text-right tabular-nums`}>{nf.format(totals.onHand)}</td>
                <td className={`${td} text-right tabular-nums`}>{nf.format(totals.reserved)}</td>
                <td className={`${td} text-right tabular-nums`}>{nf.format(totals.committed)}</td>
                <td className={td} />
              </tr>
            </tbody>
          </TableWrap>
        )}
      </Card>

      {product.tracks_lots ? (
        <Card>
          <CardTitle>Lotes</CardTitle>
          {lots.length === 0 ? (
            <p className="text-sm text-fg-muted">Sin lotes registrados. Se crean al registrar un ingreso.</p>
          ) : (
            <TableWrap caption="Lotes de la variante">
              <thead>
                <tr>
                  <th scope="col" className={th}>Lote</th>
                  <th scope="col" className={th}>Vencimiento</th>
                  <th scope="col" className={th}>Estado</th>
                  <th scope="col" className={th}>Stock por bodega</th>
                  {can(ctx, 'inventory.lots') ? <th scope="col" className={th}>Acción</th> : null}
                </tr>
              </thead>
              <tbody>
                {lots.map((l) => {
                  const expired = l.expiry_date !== null && l.expiry_date < today;
                  const stock = l.lot_balances.filter((lb) => lb.on_hand > 0);
                  return (
                    <tr key={l.id}>
                      <td className={`${td} font-mono text-xs`}>{l.lot_number}</td>
                      <td className={`${td} whitespace-nowrap`}>
                        {l.expiry_date ? formatCalendarDate(l.expiry_date) : '—'}
                        {expired ? <span className="ml-2"><Badge tone="danger">Vencido</Badge></span> : null}
                      </td>
                      <td className={td}><LotStatusBadge status={l.status} /></td>
                      <td className={td}>
                        {stock.length === 0
                          ? 'Sin stock'
                          : stock.map((lb) => `${warehouseCode(lb.warehouse_id)}: ${nf.format(lb.on_hand)}`).join(' · ')}
                      </td>
                      {can(ctx, 'inventory.lots') ? (
                        <td className={td}>
                          <LotStatusForm
                            action={changeLotStatus.bind(null, variant.id, l.id)}
                            current={l.status}
                            lotId={l.id}
                            lotNumber={l.lot_number}
                          />
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </Card>
      ) : null}

      {can(ctx, 'inventory.receive') || can(ctx, 'inventory.adjust') ? (
        activeWarehouses.length === 0 ? (
          <Alert tone="warning" title="No hay bodegas activas">
            Para registrar ingresos o ajustes,{' '}
            {can(ctx, 'warehouses.manage') ? <Link className="font-semibold underline" href="/bodegas">crea una bodega</Link> : 'pide que se cree una bodega'}.
          </Alert>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {can(ctx, 'inventory.receive') ? (
              <Card>
                <CardTitle>Registrar ingreso</CardTitle>
                <ReceiveForm
                  action={receiveStock.bind(null, variant.id)}
                  warehouses={activeWarehouses}
                  tracksLots={product.tracks_lots}
                  tracksExpiry={product.tracks_expiry}
                  requestId={randomUUID()}
                />
              </Card>
            ) : null}
            {can(ctx, 'inventory.adjust') ? (
              <Card>
                <CardTitle>Ajustar stock</CardTitle>
                {lotOptions && lotOptions.length === 0 ? (
                  <p className="text-sm text-fg-muted">Esta variante controla lotes: registra un ingreso antes de ajustar.</p>
                ) : (
                  <AdjustForm
                    action={adjustStock.bind(null, variant.id)}
                    warehouses={activeWarehouses}
                    lots={lotOptions}
                    requestId={randomUUID()}
                  />
                )}
              </Card>
            ) : null}
          </div>
        )
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-fg">Últimos movimientos</h2>
          {movements.total > movements.rows.length ? (
            <Link
              href={listHref('/inventario/movimientos', { variante: variant.id })}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Ver los {nf.format(movements.total)} movimientos
            </Link>
          ) : null}
        </div>
        {movements.rows.length === 0 ? (
          <EmptyState title="Sin movimientos">Los ingresos, ajustes y despachos de esta variante aparecerán aquí.</EmptyState>
        ) : (
          <MovementsTable rows={movements.rows} showProduct={false} />
        )}
      </section>
    </>
  );
}
