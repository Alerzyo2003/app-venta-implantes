import { Badge, type Tone } from '@/components/ui/feedback';
import { LOT_STATUS_LABELS, STOCK_STATUS_LABELS, type LotStatus, type StockStatus } from '@/lib/schemas/inventory';

const STOCK_TONES: Record<StockStatus, Tone> = { in_stock: 'success', low_stock: 'warning', out_of_stock: 'danger' };
const LOT_TONES: Record<LotStatus, Tone> = { available: 'success', quarantine: 'warning', recalled: 'danger', expired: 'danger' };

export function StockBadge({ status }: { status: StockStatus }) {
  return <Badge tone={STOCK_TONES[status]}>{STOCK_STATUS_LABELS[status]}</Badge>;
}

export function LotStatusBadge({ status }: { status: LotStatus }) {
  return <Badge tone={LOT_TONES[status]}>{LOT_STATUS_LABELS[status]}</Badge>;
}
