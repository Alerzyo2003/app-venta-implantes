import { Badge, type Tone } from '@/components/ui/feedback';
import {
  PRODUCT_STATUS_LABELS,
  VARIANT_STATUS_LABELS,
  type ProductStatus,
  type VariantStatus,
} from '@/lib/schemas/product';

const PRODUCT_TONES: Record<ProductStatus, Tone> = { published: 'success', draft: 'neutral', archived: 'warning' };
const VARIANT_TONES: Record<VariantStatus, Tone> = { active: 'success', inactive: 'neutral', discontinued: 'warning' };

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return <Badge tone={PRODUCT_TONES[status]}>{PRODUCT_STATUS_LABELS[status]}</Badge>;
}

export function VariantStatusBadge({ status }: { status: VariantStatus }) {
  return <Badge tone={VARIANT_TONES[status]}>{VARIANT_STATUS_LABELS[status].replace(' (oculta)', '')}</Badge>;
}
