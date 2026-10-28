import type { RegionGroup } from '@/components/warehouses/warehouse-form';
import type { Territory } from '@/lib/data/inventory';

/** Comunas agrupadas por región (orden oficial de norte a sur) para selectores. */
export function regionGroups(territory: Territory): RegionGroup[] {
  return territory.regions.map((r) => ({
    code: r.code,
    name: r.name,
    comunas: territory.comunas.filter((c) => c.region_code === r.code).map((c) => ({ code: c.code, name: c.name })),
  }));
}
