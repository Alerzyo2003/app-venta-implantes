import 'server-only';

import type { ProductFormOptions } from '@/components/catalog/product-form';
import type { CatalogReferences } from '@/lib/data/catalog';
import { categoryOptions, toOptions } from '@/lib/options';

export function productFormOptions(refs: CatalogReferences): ProductFormOptions {
  return {
    categories: categoryOptions(refs.categories),
    brands: toOptions(refs.brands),
    manufacturers: toOptions(refs.manufacturers),
    systems: toOptions(refs.systems),
  };
}
