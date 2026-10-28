import { ORDER_STATUS_LABELS, type OrderStatus } from '@repo/domain';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Alert } from '@/components/ui/feedback';
import { PageHeader, Stat } from '@/components/ui/layout';
import { requireStaff } from '@/lib/auth/dal';
import { getDashboardSummary } from '@/lib/data/dashboard';

export const metadata: Metadata = { title: 'Inicio' };

const nf = new Intl.NumberFormat('es-CL');

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

export default async function DashboardPage() {
  const ctx = await requireStaff();
  const summary = await getDashboardSummary(ctx);
  const { products, inventory, orders } = summary;

  return (
    <>
      <PageHeader title="Inicio" description="Resumen operativo calculado en este momento a partir de los datos reales." />

      {products ? (
        <Section title="Catálogo">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Publicados" value={nf.format(products.published)} />
            <Stat label="Borradores" value={nf.format(products.draft)} />
            <Stat label="Archivados" value={nf.format(products.archived)} />
          </dl>
          {products.published_without_active_variant > 0 ? (
            <Alert tone="warning" title="Productos publicados sin variantes activas">
              {nf.format(products.published_without_active_variant)} producto(s) se muestran en el catálogo pero no se pueden
              comprar. <Link className="font-semibold underline" href="/productos?estado=published">Revisar productos publicados</Link>.
            </Alert>
          ) : null}
        </Section>
      ) : null}

      {inventory ? (
        <Section title="Inventario">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat
              label="Variantes agotadas"
              value={nf.format(inventory.out_of_stock)}
              tone={inventory.out_of_stock > 0 ? 'danger' : 'default'}
              hint="Publicadas y activas, sin unidades disponibles para la venta"
            />
            <Stat
              label="Últimas unidades"
              value={nf.format(inventory.low_stock)}
              tone={inventory.low_stock > 0 ? 'warning' : 'default'}
              hint={`Con ${inventory.low_stock_threshold} unidades disponibles o menos`}
            />
            <Stat
              label="Lotes por vencer"
              value={nf.format(inventory.expiring_lots)}
              tone={inventory.expiring_lots > 0 ? 'warning' : 'default'}
              hint={`Vencen en los próximos ${inventory.expiry_warning_days} días y tienen stock`}
            />
            <Stat
              label="Lotes vencidos con stock"
              value={nf.format(inventory.expired_lots_with_stock)}
              tone={inventory.expired_lots_with_stock > 0 ? 'danger' : 'default'}
              hint="No se venden: requieren baja o devolución"
            />
            <Stat
              label="Lotes en cuarentena o retirados"
              value={nf.format(inventory.blocked_lots_with_stock)}
              tone={inventory.blocked_lots_with_stock > 0 ? 'warning' : 'default'}
              hint="Con stock bloqueado para la venta"
            />
          </dl>
          <p className="text-sm">
            <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/inventario?alertas=1">
              Ver variantes con alertas de stock
            </Link>
          </p>
        </Section>
      ) : null}

      {orders ? (
        <Section title="Pedidos por estado">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((status) => (
              <Stat key={status} label={ORDER_STATUS_LABELS[status]} value={nf.format(orders[status] ?? 0)} />
            ))}
          </dl>
          <p className="text-xs text-fg-muted">La gestión de pedidos desde el panel se incorpora en el incremento de pedidos y pagos.</p>
        </Section>
      ) : null}

      {summary.pending_verifications !== undefined ? (
        <Section title="Clientes">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Verificaciones profesionales pendientes" value={nf.format(summary.pending_verifications)} />
          </dl>
        </Section>
      ) : null}
    </>
  );
}
