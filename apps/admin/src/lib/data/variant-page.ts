import 'server-only';

import { productKindHasField } from '@repo/domain';

import type { Option } from '@/components/ui/field';
import type { StaffContext } from '@/lib/auth/dal';
import { getCatalogReferences, getIvaRateBp, type ProductDetail } from '@/lib/data/catalog';
import { toOptions } from '@/lib/options';

/** Opciones del formulario de variantes según el sistema de implantes del producto. */
export async function variantFormContext(ctx: StaffContext, product: ProductDetail) {
  const [refs, ivaRateBp] = await Promise.all([getCatalogReferences(ctx), getIvaRateBp(ctx)]);
  const platforms: Option[] =
    productKindHasField(product.product_kind, 'platform') && product.implant_system_id
      ? refs.platforms
          .filter((p) => p.implant_system_id === product.implant_system_id)
          .map((p) => ({ value: p.id, label: `${p.code} · ${p.name}${p.is_active ? '' : ' (inactiva)'}` }))
      : [];
  return { platforms, connectionTypes: toOptions(refs.connectionTypes), ivaRateBp };
}
