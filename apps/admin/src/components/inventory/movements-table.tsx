import { formatDateTime } from '@repo/domain';
import Link from 'next/link';

import { TableWrap, td, th } from '@/components/ui/layout';
import type { MovementRow } from '@/lib/data/inventory';
import { MOVEMENT_TYPE_LABELS } from '@/lib/schemas/inventory';

const nf = new Intl.NumberFormat('es-CL', { signDisplay: 'exceptZero' });
const plain = new Intl.NumberFormat('es-CL');

export function MovementsTable({ rows, showProduct }: { rows: MovementRow[]; showProduct: boolean }) {
  return (
    <TableWrap caption="Movimientos de inventario">
      <thead>
        <tr>
          <th scope="col" className={th}>Fecha</th>
          {showProduct ? <th scope="col" className={th}>Producto</th> : null}
          <th scope="col" className={th}>Tipo</th>
          <th scope="col" className={th}>Bodega</th>
          <th scope="col" className={th}>Lote</th>
          <th scope="col" className={`${th} text-right`}>Cantidad</th>
          <th scope="col" className={`${th} text-right`}>Saldo</th>
          <th scope="col" className={th}>Motivo</th>
          <th scope="col" className={th}>Responsable</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.id}>
            <td className={`${td} whitespace-nowrap`}>{formatDateTime(m.occurred_at, { withTime: true })}</td>
            {showProduct ? (
              <td className={td}>
                <Link href={`/inventario/${m.variant_id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  {m.product_name}
                </Link>
                <p className="font-mono text-xs text-fg-muted">{m.sku}</p>
              </td>
            ) : null}
            <td className={td}>{MOVEMENT_TYPE_LABELS[m.movement_type] ?? m.movement_type}</td>
            <td className={`${td} font-mono text-xs whitespace-nowrap`}>{m.warehouse_code}</td>
            <td className={`${td} font-mono text-xs whitespace-nowrap`}>{m.lot_number ?? '—'}</td>
            <td className={`${td} text-right font-semibold tabular-nums ${m.quantity < 0 ? 'text-danger' : 'text-success'}`}>
              {nf.format(m.quantity)}
            </td>
            <td className={`${td} text-right tabular-nums`}>{plain.format(m.on_hand_after)}</td>
            <td className={td}>{m.reason ?? (m.reference_type === 'order' ? 'Pedido' : '—')}</td>
            <td className={td}>{m.actor_name ?? 'Sistema'}</td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}
